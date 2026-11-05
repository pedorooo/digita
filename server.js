const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { Server } = require('socket.io');
const { buildStack, isCorrect, MODES } = require('./words');
const { createStats, applyRound, publicStats, statsFor } = require('./stats');

const PORT = Number(process.env.PORT) || 3000;
const COUNTDOWN_MS = 3000;
const HOST_GRACE_MS = 30000; // tempo para o host recarregar a página antes da sala fechar
const DURATIONS = [30, 60, 90, 120];
const MAX_PLAYERS = 30;
// Pontuação: cada modo tem um multiplicador; acertar em menos de 1 s dá +25%
const POINTS = { normal: 1, reversed: 2, emoji: 2, opposite: 2, number: 3, color: 3 };
const FAST_MS = 1000;
const FAST_BONUS = 1.25;
const round2 = (n) => Math.round(n * 100) / 100;
// muda a cada vez que o servidor sobe: páginas antigas abertas recarregam sozinhas
const BUILD_ID = Date.now().toString(36);
// Avatares DiceBear (estilo "thumbs", licença MIT), coloridos só com a paleta do jogo.
// Cada avatar tem um par fundo/corpo fixo com bom contraste: 6 pares × 4 rostos = 24 opções.
const AVATAR_PAIRS = [
  ['ffffd5', '3b2524'], ['ffffd5', '735044'], ['ffffd5', 'b76b53'],
  ['ffffd5', 'e48362'], ['ff9f72', '3b2524'], ['ff9f72', '735044'],
];
const AVATARS = Array.from({ length: 24 }, (_, i) => `digita-${i + 1}`);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules', '@fontsource', 'fredoka', 'files'), { maxAge: '7d' }));
app.get('/avatars.json', (_req, res) => res.json(AVATARS));

// Ícones Phosphor (estilo Fill, licença MIT) num único sprite SVG: <use href="/icons.svg#nome">
const ICONS = [
  'crown', 'fire', 'medal', 'lightning', 'target', 'fast-forward', 'skip-forward', 'trophy', 'alarm', 'eye', 'star',
  'timer', 'check', 'check-circle', 'x', 'paper-plane-right', 'play', 'caret-left', 'caret-right', 'arrow-clockwise',
  'confetti', 'swap', 'hourglass-medium', 'hand-waving', 'smiley-x-eyes', 'pause',
];
const fs = require('fs');
const iconSprite =
  '<svg xmlns="http://www.w3.org/2000/svg">' +
  ICONS.map((name) => {
    const svg = fs.readFileSync(path.join(__dirname, 'node_modules', '@phosphor-icons', 'core', 'assets', 'fill', `${name}-fill.svg`), 'utf8');
    return svg.replace(/^<svg[^>]*>/, `<symbol id="${name}" viewBox="0 0 256 256" fill="currentColor">`).replace(/<\/svg>\s*$/, '</symbol>');
  }).join('') +
  '</svg>';
app.get('/icons.svg', (_req, res) => res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(iconSprite));

// gera o SVG do avatar localmente (funciona sem internet na rede local)
const dicebear = Promise.all([import('@dicebear/core'), import('@dicebear/collection')]);
const avatarCache = new Map();
app.get('/avatar/:seed.svg', async (req, res) => {
  const i = AVATARS.indexOf(req.params.seed);
  if (i < 0) return res.status(404).end();
  let svg = avatarCache.get(i);
  if (!svg) {
    const [{ createAvatar }, { thumbs }] = await dicebear;
    const [bg, body] = AVATAR_PAIRS[i % AVATAR_PAIRS.length];
    svg = createAvatar(thumbs, {
      seed: AVATARS[i],
      backgroundColor: [bg],
      shapeColor: [body],
      eyesColor: ['ffffd5'],
      mouthColor: ['ffffd5'],
    }).toString();
    avatarCache.set(i, svg);
  }
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=604800').send(svg);
});
app.get('/join/:code', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));

function lanAddress() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return 'localhost';
}

const BASE_URL = (process.env.PUBLIC_URL || `http://${lanAddress()}:${PORT}`).replace(/\/$/, '');

/** @type {Map<string, any>} */
const rooms = new Map();

function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I e O
  let code;
  do {
    code = Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function publicEntry(entry) {
  return entry ? { display: entry.display, type: entry.type, color: entry.color || null } : null;
}

function ranking(room) {
  const last = room.stats.lastWinner;
  return [...room.players.values()]
    .map((p) => {
      const st = statsFor(room.stats, p.name);
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
        online: !!p.socketId,
        lastCorrectAt: p.lastCorrectAt,
        wins: st?.wins || 0,
        winStreak: st?.winStreak || 0,
        isLastWinner: !!last && last.name === p.name,
      };
    })
    .sort((a, b) => b.score - a.score || (a.lastCorrectAt ?? Infinity) - (b.lastCorrectAt ?? Infinity));
}

function boardState(room) {
  const players = ranking(room);
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
          .map((x) => ({ id: x.id, ...who(x.id), ms: x.ms, pts: x.pts, fast: x.fast }))
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
    stats: publicStats(room.stats),
    summary: room.revealed ? room.summary : null,
    duration: room.duration,
    remainingMs: room.endsAt ? Math.max(0, room.endsAt - Date.now()) : null,
    players,
    feed,
  };
}

function emitBoard(room) {
  if (room.hostSocketId) io.to(room.hostSocketId).emit('board', boardState(room));
}

function sendWord(room, p) {
  if (!p.socketId) return;
  io.to(p.socketId).emit('word', {
    index: p.index,
    score: p.score,
    points: POINTS[room.stack[p.index]?.type] || 1,
    ...publicEntry(room.stack[p.index]),
  });
}

function sendPlayerState(room, p) {
  if (!p.socketId) return;
  const sock = io.to(p.socketId);
  sock.emit('joined', {
    code: room.code,
    playerId: p.id,
    name: p.name,
    avatar: p.avatar,
    state: room.state,
    stats: statsFor(room.stats, p.name),
    isLastWinner: room.stats.lastWinner?.name === p.name,
  });
  if (room.state === 'countdown') {
    sock.emit('countdown', { remainingMs: Math.max(0, room.startsAt - Date.now()) });
  } else if (room.state === 'playing') {
    sock.emit('round:start', { remainingMs: room.endsAt - Date.now() });
    sendWord(room, p);
  } else if (room.state === 'ended') {
    sock.emit('round:end', { score: p.score, words: p.words });
    if (room.revealed) sendResults(room, p);
  }
}

function startRound(room, duration, modes) {
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
  io.to(room.code).emit('countdown', { remainingMs: COUNTDOWN_MS });
  emitBoard(room);

  room.timer = setTimeout(() => {
    room.state = 'playing';
    room.endsAt = Date.now() + room.duration * 1000;
    io.to(room.code).emit('round:start', { remainingMs: room.duration * 1000 });
    for (const p of room.players.values()) {
      p.shownAt = Date.now();
      sendWord(room, p);
    }
    emitBoard(room);
    room.timer = setTimeout(() => endRound(room), room.duration * 1000);
  }, COUNTDOWN_MS);
}

function endRound(room) {
  clearTimeout(room.timer);
  room.state = 'ended';
  room.endsAt = null;
  room.revealed = false;
  room.summary = applyRound(room.stats, ranking(room), room.duration);
  // jogadores só veem a própria pontuação; a classificação aparece quando o host revelar
  for (const p of room.players.values()) {
    if (p.socketId) io.to(p.socketId).emit('round:end', { score: p.score, words: p.words });
  }
  emitBoard(room);
}

function sendResults(room, p) {
  if (!p.socketId || !room.summary) return;
  io.to(p.socketId).emit('round:results', {
    ranking: ranking(room),
    me: room.summary.personal[p.id] || null,
    awards: room.summary.awards,
    newRecords: room.summary.newRecords,
  });
}

function closeRoom(room) {
  clearTimeout(room.timer);
  clearTimeout(room.hostTimer);
  io.to(room.code).emit('room:closed');
  rooms.delete(room.code);
}

function logWord(room, i) {
  return (room.wordLog[i] ||= { solved: [], skipped: [] });
}

function advance(room, p) {
  p.index++;
  if (p.index >= room.stack.length) {
    // pilha acabou (muito improvável): estende com mais palavras
    room.stack.push(...buildStack(60, room.modes));
  }
  p.shownAt = Date.now();
  sendWord(room, p);
  emitBoard(room);
}

io.on('connection', (socket) => {
  socket.emit('build', BUILD_ID);

  // ---------- HOST ----------
  socket.on('host:create', async ({ code, hostToken } = {}, ack) => {
    if (typeof ack !== 'function') return;
    let room = code && rooms.get(code);
    if (room && room.hostToken === hostToken) {
      clearTimeout(room.hostTimer);
      room.hostSocketId = socket.id;
    } else {
      room = {
        code: newCode(),
        hostToken: crypto.randomUUID(),
        hostSocketId: socket.id,
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
      };
      rooms.set(room.code, room);
    }
    socket.data.hostOf = room.code;
    const joinUrl = `${BASE_URL}/join/${room.code}`;
    const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 480 });
    ack({ code: room.code, hostToken: room.hostToken, joinUrl, qr });
    emitBoard(room);
  });

  socket.on('host:start', ({ duration, modes } = {}) => {
    const room = rooms.get(socket.data.hostOf);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.state === 'countdown' || room.state === 'playing') return;
    if (![...room.players.values()].some((p) => p.socketId)) return;
    startRound(room, Number(duration), modes);
  });

  socket.on('host:stop', () => {
    const room = rooms.get(socket.data.hostOf);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.state === 'playing' || room.state === 'countdown') endRound(room);
  });

  socket.on('host:reveal', () => {
    const room = rooms.get(socket.data.hostOf);
    if (!room || room.hostSocketId !== socket.id || room.state !== 'ended') return;
    room.revealed = true;
    for (const p of room.players.values()) sendResults(room, p);
    emitBoard(room);
  });

  socket.on('host:restart', () => {
    const room = rooms.get(socket.data.hostOf);
    if (!room || room.hostSocketId !== socket.id) return;
    clearTimeout(room.timer);
    for (const [id, p] of room.players) if (!p.socketId) room.players.delete(id);
    room.state = 'lobby';
    room.endsAt = null;
    // reenvia o estado (com as estatísticas atualizadas) para cada celular
    for (const p of room.players.values()) sendPlayerState(room, p);
    emitBoard(room);
  });

  socket.on('host:kick', ({ playerId } = {}) => {
    const room = rooms.get(socket.data.hostOf);
    if (!room || room.hostSocketId !== socket.id) return;
    const p = room.players.get(playerId);
    if (!p) return;
    const ps = p.socketId && io.sockets.sockets.get(p.socketId);
    if (ps) {
      ps.emit('kicked');
      ps.leave(room.code);
      ps.data.room = null;
    }
    room.players.delete(playerId);
    emitBoard(room);
  });

  // ---------- JOGADOR ----------
  socket.on('player:join', ({ code, name, avatar, playerId } = {}, ack) => {
    if (typeof ack !== 'function') return;
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack({ error: 'Sala não encontrada.' });

    let p = playerId && room.players.get(playerId);
    if (!p) {
      name = String(name || '').trim().slice(0, 16);
      if (!name) return ack({ error: 'Digite seu nome.' });
      if (room.players.size >= MAX_PLAYERS) return ack({ error: 'Sala cheia.' });
      const taken = new Set([...room.players.values()].map((x) => x.name.toLowerCase()));
      let finalName = name;
      for (let n = 2; taken.has(finalName.toLowerCase()); n++) finalName = `${name} ${n}`;
      const used = new Set([...room.players.values()].map((x) => x.avatar));
      if (!AVATARS.includes(avatar)) {
        const free = AVATARS.filter((a) => !used.has(a));
        avatar = (free.length ? free : AVATARS)[crypto.randomInt((free.length ? free : AVATARS).length)];
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
    if (p.socketId && p.socketId !== socket.id) io.sockets.sockets.get(p.socketId)?.disconnect(true);
    p.socketId = socket.id;
    socket.data.room = room.code;
    socket.data.playerId = p.id;
    socket.join(room.code);
    ack({ ok: true });
    sendPlayerState(room, p);
    emitBoard(room);
  });

  function currentPlayer() {
    const room = rooms.get(socket.data.room);
    const p = room?.players.get(socket.data.playerId);
    if (!room || !p || p.socketId !== socket.id || room.state !== 'playing') return [];
    return [room, p];
  }

  socket.on('player:answer', ({ text, index } = {}) => {
    const [room, p] = currentPlayer();
    if (!room) return;
    if (index !== p.index) return; // resposta atrasada de uma palavra anterior
    const entry = room.stack[p.index];
    if (isCorrect(entry, text)) {
      const now = Date.now();
      const ms = now - (p.shownAt || now);
      const fast = ms < FAST_MS;
      const pts = round2((POINTS[entry.type] || 1) * (fast ? FAST_BONUS : 1));
      p.score = round2(p.score + pts);
      p.words++;
      p.combo++;
      p.bestCombo = Math.max(p.bestCombo, p.combo);
      p.lastCorrectAt = now;
      if (p.fastestMs == null || ms < p.fastestMs) {
        p.fastestMs = ms;
        p.fastestWord = entry.display;
      }
      logWord(room, p.index).solved.push({ id: p.id, ms, pts, fast });
      socket.emit('answer:right', { answer: entry.answers[0], pts, fast });
      advance(room, p);
    } else {
      p.wrong++;
      socket.emit('answer:wrong');
    }
  });

  socket.on('player:skip', ({ index } = {}) => {
    const [room, p] = currentPlayer();
    if (!room || index !== p.index) return;
    p.skipped++;
    p.combo = 0;
    logWord(room, p.index).skipped.push(p.id);
    socket.emit('answer:skipped', { answer: room.stack[p.index].answers.join(' / ') });
    advance(room, p);
  });

  socket.on('disconnect', () => {
    const hostRoom = rooms.get(socket.data.hostOf);
    if (hostRoom && hostRoom.hostSocketId === socket.id) {
      hostRoom.hostSocketId = null;
      hostRoom.hostTimer = setTimeout(() => closeRoom(hostRoom), HOST_GRACE_MS);
    }
    const room = rooms.get(socket.data.room);
    const p = room?.players.get(socket.data.playerId);
    if (p && p.socketId === socket.id) {
      p.socketId = null;
      // no lobby, quem sai some da lista; durante/depois do jogo continua no ranking
      if (room.state === 'lobby') room.players.delete(p.id);
      emitBoard(room);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n  Digita! rodando`);
  console.log(`  Tela principal: http://localhost:${PORT}`);
  console.log(`  Jogadores entram por: ${BASE_URL}/join/<CÓDIGO>\n`);
});
