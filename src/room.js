// Uma sala do jogo = um Durable Object. Toda a lógica que antes ficava no server.js (Socket.IO)
// roda aqui; o estado fica em memória enquanto houver alguém conectado.
//
// Protocolo (JSON por WebSocket):
//   cliente → servidor: { e: evento, d: dados, ack?: número }
//   servidor → cliente: { e: evento, d: dados }  ou  { ack: número, d: resposta }
import { DurableObject } from 'cloudflare:workers';
import { buildStack, isCorrect, MODES } from './words.js';
import { createStats, applyRound, publicStats, statsFor } from './stats.js';
import { AVATARS } from './avatars.js';

const COUNTDOWN_MS = 3000;
const HOST_GRACE_MS = 30000; // tempo para o host recarregar a página antes da sala fechar
const DURATIONS = [30, 60, 90, 120];
const MAX_PLAYERS = 30;
// Pontuação (sempre inteira) = pontos do modo + bônus de rapidez
const POINTS = { normal: 1, reversed: 2, emoji: 2, opposite: 2, number: 3, color: 3 };
// até 1,5 s: +3 · até 2,5 s: +2 · até 3,2 s: +1 · mais devagar: só os pontos do modo
const SPEED_BONUS = [
  [1500, 3],
  [2500, 2],
  [3200, 1],
];
const speedBonus = (ms) => (SPEED_BONUS.find(([max]) => ms < max) || [0, 0])[1];
// códigos de fechamento: o cliente não tenta reconectar quando recebe >= 4000
const CLOSE_REPLACED = 4000; // mesmo jogador abriu em outra aba
const CLOSE_GONE = 4004; // a sala não existe (mais)

// Jogadores de teste (sala de teste: abra a tela principal com ?teste): respondem sozinhos.
// min/max = tempo para responder (ms), acc = chance de acertar a palavra
const BOTS = [
  { name: 'Ana', avatar: 'digita-5', min: 450, max: 1400, acc: 0.95 },
  { name: 'Bia', avatar: 'digita-2', min: 900, max: 2600, acc: 0.85 },
  { name: 'Caio', avatar: 'digita-9', min: 1300, max: 3300, acc: 0.8 },
  { name: 'Duda', avatar: 'digita-16', min: 700, max: 2000, acc: 0.65 },
  { name: 'Enzo', avatar: 'digita-23', min: 1600, max: 3800, acc: 0.9 },
];

const round2 = (n) => Math.round(n * 100) / 100;
const randomInt = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

function publicEntry(entry) {
  return entry ? { display: entry.display, type: entry.type, color: entry.color || null } : null;
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /** @type {any} */
    this.room = null;
    /** conexões abertas: id → { id, ws, inRoom, playerId } */
    this.conns = new Map();
    // muda a cada deploy: páginas antigas abertas recarregam sozinhas
    this.buildId = env.CF_VERSION_METADATA?.id || 'dev';
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') return this.accept();

    if (url.pathname === '/init' && request.method === 'POST') {
      if (this.room) return new Response('Conflict', { status: 409 });
      const { code } = await request.json();
      this.room = {
        code,
        hostToken: crypto.randomUUID(),
        hostSocketId: null,
        players: new Map(),
        stack: [],
        wordLog: [],
        stats: createStats(),
        summary: null,
        revealed: false,
        state: 'lobby',
        duration: 60,
        endsAt: null,
        startsAt: null,
        timer: null,
        hostTimer: null,
        modes: MODES,
      };
      // se o host nunca chegar a conectar, a sala some sozinha
      this.room.hostTimer = setTimeout(() => this.closeRoom(), HOST_GRACE_MS);
      return Response.json({ hostToken: this.room.hostToken });
    }

    if (url.pathname === '/resume' && request.method === 'POST') {
      const { hostToken } = await request.json();
      const ok = this.room && this.room.hostToken === hostToken;
      return new Response(null, { status: ok ? 204 : 404 });
    }

    return new Response('Not Found', { status: 404 });
  }

  // ---------- conexões ----------

  accept() {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const conn = { id: crypto.randomUUID(), ws: server, inRoom: false, playerId: null };
    this.conns.set(conn.id, conn);

    server.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!msg || typeof msg.e !== 'string') return;
      const ack = Number.isInteger(msg.ack) ? (d) => this.raw(conn, { ack: msg.ack, d }) : null;
      try {
        this.handle(conn, msg.e, msg.d || {}, ack);
      } catch (err) {
        console.error('erro no evento', msg.e, err);
      }
    });
    const onClose = () => this.disconnect(conn);
    server.addEventListener('close', onClose);
    server.addEventListener('error', onClose);

    this.send(conn.id, 'build', this.buildId);
    return new Response(null, { status: 101, webSocket: client });
  }

  raw(conn, obj) {
    try {
      conn.ws.send(JSON.stringify(obj));
    } catch {}
  }

  send(connId, e, d) {
    const conn = connId && this.conns.get(connId);
    if (conn) this.raw(conn, { e, d });
  }

  // equivalente a io.to(room.code): todos os celulares que entraram na sala
  broadcast(e, d) {
    for (const conn of this.conns.values()) if (conn.inRoom) this.raw(conn, { e, d });
  }

  closeConn(conn, code, reason) {
    this.conns.delete(conn.id);
    try {
      conn.ws.close(code, reason);
    } catch {}
  }

  disconnect(conn) {
    if (!this.conns.has(conn.id)) return;
    this.conns.delete(conn.id);
    const room = this.room;
    if (!room) return;
    if (room.hostSocketId === conn.id) {
      room.hostSocketId = null;
      clearTimeout(room.hostTimer);
      room.hostTimer = setTimeout(() => this.closeRoom(), HOST_GRACE_MS);
    }
    const p = conn.playerId && room.players.get(conn.playerId);
    if (p && p.socketId === conn.id) {
      p.socketId = null;
      // no lobby, quem sai some da lista; durante/depois do jogo continua no ranking
      if (room.state === 'lobby') room.players.delete(p.id);
      this.emitBoard();
    }
  }

  // ---------- estado ----------

  // Depois que o tempo acaba as estatísticas já foram atualizadas, mas a coroa/sequência do novo
  // vencedor só pode aparecer quando o host revelar os resultados: até lá, usa a foto de antes.
  badgesHidden() {
    const room = this.room;
    return room.state === 'ended' && !room.revealed && !!room.statsBefore;
  }

  statsOf(name) {
    const room = this.room;
    if (this.badgesHidden()) return room.statsBefore.players[name] || null;
    return statsFor(room.stats, name);
  }

  lastWinnerName() {
    const room = this.room;
    return this.badgesHidden() ? room.statsBefore.lastWinner : room.stats.lastWinner?.name || null;
  }

  ranking() {
    const room = this.room;
    const lastName = this.lastWinnerName();
    return [...room.players.values()]
      .map((p) => {
        const st = this.statsOf(p.name);
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          score: p.score,
          words: p.words,
          skipped: p.skipped,
          wrong: p.wrong,
          bestCombo: p.bestCombo,
          fastestMs: p.fastestMs,
          fastestWord: p.fastestWord,
          index: p.index,
          online: !!p.socketId || !!p.bot,
          bot: !!p.bot,
          lastCorrectAt: p.lastCorrectAt,
          wins: st?.wins || 0,
          winStreak: st?.winStreak || 0,
          isLastWinner: !!lastName && lastName === p.name,
        };
      })
      .sort((a, b) => b.score - a.score || (a.lastCorrectAt ?? Infinity) - (b.lastCorrectAt ?? Infinity));
  }

  boardState() {
    const room = this.room;
    const players = this.ranking();
    // as palavras só vão para a tela principal depois que o tempo acaba (para a revisão palavra por palavra)
    let feed = [];
    if (room.state === 'ended') {
      const furthest = players.reduce((m, p) => Math.max(m, p.index), -1);
      const who = (id) => {
        const p = room.players.get(id);
        return p ? { name: p.name, avatar: p.avatar } : null;
      };
      feed = room.stack.slice(0, Math.min(furthest + 1, room.stack.length)).map((e, i) => {
        const log = room.wordLog[i] || { solved: [], skipped: [] };
        return {
          i,
          display: e.display,
          type: e.type,
          color: e.color || null,
          points: POINTS[e.type] || 1,
          answer: e.answers.join(' / '),
          solved: log.solved
            .filter((x) => who(x.id))
            .map((x) => ({ id: x.id, ...who(x.id), ms: x.ms, pts: x.pts, bonus: x.bonus || 0 }))
            .sort((a, b) => a.ms - b.ms),
          skipped: log.skipped.map(who).filter(Boolean),
          pending: players.filter((p) => p.index === i).map((p) => ({ name: p.name, avatar: p.avatar })),
        };
      });
    }
    return {
      code: room.code,
      state: room.state,
      revealed: room.revealed,
      // estatísticas novas só depois de revelar (senão entregariam o vencedor antes da hora)
      stats: this.badgesHidden() ? null : publicStats(room.stats),
      summary: room.revealed ? room.summary : null,
      duration: room.duration,
      remainingMs: room.endsAt ? Math.max(0, room.endsAt - Date.now()) : null,
      players,
      feed,
    };
  }

  emitBoard() {
    if (this.room?.hostSocketId) this.send(this.room.hostSocketId, 'board', this.boardState());
  }

  sendWord(p) {
    if (p.bot) return this.scheduleBot(p);
    if (!p.socketId) return;
    const room = this.room;
    this.send(p.socketId, 'word', {
      index: p.index,
      score: p.score,
      points: POINTS[room.stack[p.index]?.type] || 1,
      ...publicEntry(room.stack[p.index]),
    });
  }

  sendPlayerState(p) {
    if (!p.socketId) return;
    const room = this.room;
    this.send(p.socketId, 'joined', {
      code: room.code,
      playerId: p.id,
      name: p.name,
      avatar: p.avatar,
      state: room.state,
      stats: this.statsOf(p.name),
      isLastWinner: this.lastWinnerName() === p.name,
    });
    if (room.state === 'countdown') {
      this.send(p.socketId, 'countdown', { remainingMs: Math.max(0, room.startsAt - Date.now()) });
    } else if (room.state === 'playing') {
      this.send(p.socketId, 'round:start', { remainingMs: room.endsAt - Date.now() });
      this.sendWord(p);
    } else if (room.state === 'ended') {
      this.send(p.socketId, 'round:end', { score: p.score, words: p.words });
      if (room.revealed) this.sendResults(p);
    }
  }

  sendResults(p) {
    const room = this.room;
    if (!p.socketId || !room.summary) return;
    this.send(p.socketId, 'round:results', {
      ranking: this.ranking(),
      me: room.summary.personal[p.id] || null,
      awards: room.summary.awards,
      newRecords: room.summary.newRecords,
    });
  }

  // ---------- rodada ----------

  startRound(duration, modes) {
    const room = this.room;
    clearTimeout(room.timer);
    room.duration = DURATIONS.includes(duration) ? duration : 60;
    // só modos conhecidos; se vier vazio/ inválido, usa todos
    const chosen = Array.isArray(modes) ? MODES.filter((m) => modes.includes(m)) : [];
    room.modes = chosen.length ? chosen : MODES;
    room.stack = buildStack(Math.max(120, room.duration * 2), room.modes);
    room.wordLog = [];
    room.revealed = false;
    room.summary = null;
    for (const p of room.players.values()) {
      Object.assign(p, {
        index: 0, score: 0, words: 0, skipped: 0, wrong: 0, combo: 0, bestCombo: 0,
        fastestMs: null, fastestWord: null, lastCorrectAt: null, shownAt: null,
      });
    }
    room.state = 'countdown';
    room.startsAt = Date.now() + COUNTDOWN_MS;
    room.endsAt = null;
    this.broadcast('countdown', { remainingMs: COUNTDOWN_MS });
    this.emitBoard();

    room.timer = setTimeout(() => {
      if (this.room !== room) return;
      room.state = 'playing';
      room.endsAt = Date.now() + room.duration * 1000;
      this.broadcast('round:start', { remainingMs: room.duration * 1000 });
      for (const p of room.players.values()) {
        p.shownAt = Date.now();
        this.sendWord(p);
      }
      this.emitBoard();
      room.timer = setTimeout(() => this.endRound(), room.duration * 1000);
    }, COUNTDOWN_MS);
  }

  endRound() {
    const room = this.room;
    if (!room) return;
    clearTimeout(room.timer);
    for (const p of room.players.values()) clearTimeout(p.botTimer);
    room.state = 'ended';
    room.endsAt = null;
    room.revealed = false;
    // foto das estatísticas antes desta rodada (selos 👑/🔥 só mudam quando os resultados forem revelados)
    const before = { lastWinner: room.stats.lastWinner?.name || null, players: {} };
    for (const p of room.players.values()) {
      const st = statsFor(room.stats, p.name);
      before.players[p.name] = st ? { ...st } : null;
    }
    room.statsBefore = before;
    room.summary = applyRound(room.stats, this.ranking(), room.duration);
    // jogadores só veem a própria pontuação; a classificação aparece quando o host revelar
    for (const p of room.players.values()) {
      if (p.socketId) this.send(p.socketId, 'round:end', { score: p.score, words: p.words });
    }
    this.emitBoard();
  }

  closeRoom() {
    const room = this.room;
    if (!room) return;
    clearTimeout(room.timer);
    clearTimeout(room.hostTimer);
    for (const p of room.players.values()) clearTimeout(p.botTimer);
    this.broadcast('room:closed');
    this.room = null;
    for (const conn of [...this.conns.values()]) this.closeConn(conn, CLOSE_GONE, 'room closed');
  }

  logWord(i) {
    return (this.room.wordLog[i] ||= { solved: [], skipped: [] });
  }

  advance(p) {
    const room = this.room;
    p.index++;
    if (p.index >= room.stack.length) {
      // pilha acabou (muito improvável): estende com mais palavras
      room.stack.push(...buildStack(60, room.modes));
    }
    p.shownAt = Date.now();
    this.sendWord(p);
    this.emitBoard();
  }

  // ---------- respostas (jogadores e bots usam o mesmo caminho) ----------

  answerCorrect(p) {
    const room = this.room;
    const entry = room.stack[p.index];
    const now = Date.now();
    const ms = now - (p.shownAt || now);
    const bonus = speedBonus(ms);
    const pts = (POINTS[entry.type] || 1) + bonus;
    p.score = round2(p.score + pts);
    p.words++;
    p.combo++;
    p.bestCombo = Math.max(p.bestCombo, p.combo);
    p.lastCorrectAt = now;
    if (p.fastestMs == null || ms < p.fastestMs) {
      p.fastestMs = ms;
      p.fastestWord = entry.display;
    }
    this.logWord(p.index).solved.push({ id: p.id, ms, pts, bonus });
    this.send(p.socketId, 'answer:right', { answer: entry.answers[0], pts, bonus });
    this.advance(p);
  }

  skipWord(p) {
    const room = this.room;
    p.skipped++;
    p.combo = 0;
    this.logWord(p.index).skipped.push(p.id);
    this.send(p.socketId, 'answer:skipped', { answer: room.stack[p.index].answers.join(' / ') });
    this.advance(p);
  }

  // ---------- jogadores de teste ----------

  addBots(n) {
    const room = this.room;
    const created = [];
    for (const bot of BOTS.slice(0, Math.max(0, Math.min(n, BOTS.length)))) {
      if (room.players.size >= MAX_PLAYERS) break;
      const taken = new Set([...room.players.values()].map((x) => x.name.toLowerCase()));
      let name = bot.name;
      for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${bot.name} ${k}`;
      const p = {
        id: crypto.randomUUID(), name, avatar: bot.avatar, socketId: null, bot,
        index: 0, score: 0, words: 0, skipped: 0, wrong: 0, combo: 0, bestCombo: 0,
        fastestMs: null, fastestWord: null, lastCorrectAt: null, shownAt: Date.now(), botTimer: null,
      };
      room.players.set(p.id, p);
      created.push(p.name);
    }
    return created;
  }

  // agenda a próxima ação do bot para a palavra atual: acerta, erra (e tenta de novo) ou pula
  scheduleBot(p) {
    const room = this.room;
    clearTimeout(p.botTimer);
    if (room.state !== 'playing') return;
    const { min, max, acc } = p.bot;
    const index = p.index;
    p.botTimer = setTimeout(() => {
      if (this.room !== room || room.state !== 'playing' || p.index !== index || !room.players.has(p.id)) return;
      const r = Math.random();
      if (r < acc) this.answerCorrect(p);
      else if (r < acc + (1 - acc) / 2) {
        p.wrong++;
        this.scheduleBot(p);
      } else this.skipWord(p);
    }, min + Math.random() * (max - min));
  }

  // ---------- eventos ----------

  handle(conn, event, data, ack) {
    const room = this.room;
    const isHost = room && room.hostSocketId === conn.id;

    switch (event) {
      case 'ping':
        return;

      // ---------- HOST ----------
      case 'host:claim': {
        if (!ack) return;
        if (!room || room.hostToken !== data.hostToken) {
          ack({ error: 'gone' });
          return this.closeConn(conn, CLOSE_GONE, 'room not found');
        }
        clearTimeout(room.hostTimer);
        room.hostSocketId = conn.id;
        ack({ ok: true });
        return this.emitBoard();
      }

      case 'host:start': {
        if (!isHost) return;
        if (room.state === 'countdown' || room.state === 'playing') return;
        if (![...room.players.values()].some((p) => p.socketId || p.bot)) return;
        return this.startRound(Number(data.duration), data.modes);
      }

      case 'host:stop': {
        if (!isHost) return;
        if (room.state === 'playing' || room.state === 'countdown') this.endRound();
        return;
      }

      case 'host:reveal': {
        if (!isHost || room.state !== 'ended') return;
        room.revealed = true;
        for (const p of room.players.values()) this.sendResults(p);
        return this.emitBoard();
      }

      case 'host:restart': {
        if (!isHost) return;
        clearTimeout(room.timer);
        for (const [id, p] of room.players) if (!p.socketId && !p.bot) room.players.delete(id);
        room.state = 'lobby';
        room.endsAt = null;
        // reenvia o estado (com as estatísticas atualizadas) para cada celular
        for (const p of room.players.values()) this.sendPlayerState(p);
        return this.emitBoard();
      }

      case 'host:addBots': {
        if (!isHost || room.state !== 'lobby') return;
        this.addBots(Number(data.n) || BOTS.length);
        return this.emitBoard();
      }

      case 'host:kick': {
        if (!isHost) return;
        const p = room.players.get(data.playerId);
        if (!p) return;
        const pc = p.socketId && this.conns.get(p.socketId);
        if (pc) {
          this.raw(pc, { e: 'kicked' });
          pc.inRoom = false;
          pc.playerId = null;
        }
        clearTimeout(p.botTimer);
        room.players.delete(p.id);
        return this.emitBoard();
      }

      // ---------- JOGADOR ----------
      case 'player:join': {
        if (!ack) return;
        if (!room || String(data.code || '').toUpperCase().trim() !== room.code) {
          ack({ error: 'Sala não encontrada.' });
          return this.closeConn(conn, CLOSE_GONE, 'room not found');
        }
        let { name, avatar, playerId } = data;
        let p = playerId && room.players.get(playerId);
        if (!p) {
          name = String(name || '').trim().slice(0, 16);
          if (!name) return ack({ error: 'Digite seu nome.' });
          if (room.players.size >= MAX_PLAYERS) return ack({ error: 'Sala cheia.' });
          const taken = new Set([...room.players.values()].map((x) => x.name.toLowerCase()));
          let finalName = name;
          for (let n = 2; taken.has(finalName.toLowerCase()); n++) finalName = `${name} ${n}`;
          if (!AVATARS.includes(avatar)) {
            const used = new Set([...room.players.values()].map((x) => x.avatar));
            const free = AVATARS.filter((a) => !used.has(a));
            const pool = free.length ? free : AVATARS;
            avatar = pool[randomInt(pool.length)];
          }
          p = {
            id: crypto.randomUUID(),
            name: finalName,
            avatar,
            socketId: null,
            index: 0,
            score: 0,
            words: 0,
            skipped: 0,
            wrong: 0,
            combo: 0,
            bestCombo: 0,
            fastestMs: null,
            fastestWord: null,
            lastCorrectAt: null,
            shownAt: Date.now(),
          };
          room.players.set(p.id, p);
        }
        // se o mesmo jogador abriu em outra aba, desconecta a antiga
        if (p.socketId && p.socketId !== conn.id) {
          const old = this.conns.get(p.socketId);
          if (old) this.closeConn(old, CLOSE_REPLACED, 'replaced');
        }
        p.socketId = conn.id;
        conn.inRoom = true;
        conn.playerId = p.id;
        ack({ ok: true });
        this.sendPlayerState(p);
        return this.emitBoard();
      }

      case 'player:answer': {
        const p = this.currentPlayer(conn);
        if (!p) return;
        if (data.index !== p.index) return; // resposta atrasada de uma palavra anterior
        if (isCorrect(room.stack[p.index], data.text)) {
          this.answerCorrect(p);
        } else {
          p.wrong++;
          this.raw(conn, { e: 'answer:wrong' });
        }
        return;
      }

      case 'player:skip': {
        const p = this.currentPlayer(conn);
        if (!p || data.index !== p.index) return;
        return this.skipWord(p);
      }
    }
  }

  currentPlayer(conn) {
    const room = this.room;
    const p = room && conn.playerId && room.players.get(conn.playerId);
    if (!p || p.socketId !== conn.id || room.state !== 'playing') return null;
    return p;
  }
}
