const socket = io();
const $ = (id) => document.getElementById(id);

// se o servidor reiniciou com código novo, recarrega a página para não ficar com a versão antiga
let buildId = null;
socket.on('build', (id) => {
  if (buildId && buildId !== id) location.reload();
  buildId = id;
});

let duration = 60;
let lastBoard = null;
let timerEnd = null;
let timerInterval = null;
let countdownInterval = null;

// revisão palavra por palavra (controlada aqui na tela principal)
let reviewStep = -1; // -1 = não está revisando
let reviewFromResults = false; // revendo depois de já ter mostrado o placar
let reviewShown = false; // a resposta da palavra atual já foi revelada?

// revisão automática (padrão): mostra a palavra, revela a resposta e passa para a próxima sozinha
const AUTO_WORD_MS = 2200; // tempo com a resposta escondida
const AUTO_ANSWER_MS = 3800; // tempo com a resposta e quem acertou
let autoPlay = true;
let autoTimer = null;
let autoKey = null;

const TYPE_LABEL = { normal: 'normal', reversed: 'ao contrário', emoji: 'emoji', color: 'cor da tinta', opposite: 'oposto', number: 'número' };
const SECTIONS = ['lobby', 'countdown', 'game', 'ended', 'review', 'results', 'connecting'];

function show(id) {
  for (const s of SECTIONS) $(s).classList.toggle('hidden', s !== id);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const secs = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')}s`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// pontos podem ter decimais (bônus de rapidez ×1,25): 3,75 · 12,5 · 7
const pts = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const who = (p) => `<span class="who">${Avatar.img(p.avatar)} ${esc(p.name)}</span>`;

// ---------- criação / reconexão da sala ----------
function createRoom() {
  const saved = JSON.parse(sessionStorage.getItem('digita-host') || 'null');
  socket.emit('host:create', saved || {}, (res) => {
    sessionStorage.setItem('digita-host', JSON.stringify({ code: res.code, hostToken: res.hostToken }));
    $('qr').src = res.qr;
    $('code').innerHTML = Tiles.html(res.code);
    $('joinUrl').textContent = res.joinUrl;
    $('headerCodeText').innerHTML = Tiles.html(res.code, { animate: false });
    $('headerCode').classList.remove('hidden');
  });
}
socket.on('connect', createRoom);

// ---------- controles ----------
$('durations').addEventListener('click', (e) => {
  const d = e.target.dataset.d;
  if (!d) return;
  duration = Number(d);
  for (const b of $('durations').children) b.classList.toggle('active', b === e.target);
});
// ---------- opções da partida ----------
const MODES = [
  { id: 'normal', pts: 1, name: 'Normal', ex: 'casa → casa' },
  { id: 'reversed', pts: 2, name: 'Ao contrário', ex: 'asac → casa' },
  { id: 'emoji', pts: 2, name: 'Emoji', ex: '🐶 🔥 → cachorro-quente' },
  { id: 'color', pts: 3, name: 'Cor da tinta', ex: '<b style="color:#ff4545">AZUL</b> → vermelho' },
  { id: 'opposite', pts: 2, name: 'Oposto', ex: 'quente → frio' },
  { id: 'number', pts: 3, name: 'Número', ex: '47 → quarenta e sete' },
];
const OPTS_KEY = 'digita-options';
const savedOpts = JSON.parse(localStorage.getItem(OPTS_KEY) || 'null') || {};
let modes = new Set(Array.isArray(savedOpts.modes) && savedOpts.modes.length ? savedOpts.modes : MODES.map((m) => m.id));
if ([30, 60, 90, 120].includes(savedOpts.duration)) duration = savedOpts.duration;
for (const b of $('durations').children) b.classList.toggle('active', Number(b.dataset.d) === duration);

function renderModes() {
  $('modes').innerHTML = MODES.map(
    (m) => `<button type="button" class="mode-card ${modes.has(m.id) ? 'on' : ''}" data-mode="${m.id}" aria-pressed="${modes.has(m.id)}">
        <span class="check">${Icon('check')}</span>
        <span class="tag">${m.name}</span>
        <span class="mode-ex">${m.ex}</span>
        <span class="mode-pts">${plural(m.pts, 'ponto', 'pontos')}</span>
      </button>`,
  ).join('');
  $('modesHint').textContent = `${modes.size} de ${MODES.length}`;
}
renderModes();

$('modes').addEventListener('click', (e) => {
  const card = e.target.closest('[data-mode]');
  if (!card) return;
  const id = card.dataset.mode;
  if (modes.has(id)) {
    if (modes.size === 1) {
      // pelo menos um modo precisa ficar ligado
      card.classList.remove('nope');
      void card.offsetWidth;
      card.classList.add('nope');
      return;
    }
    modes.delete(id);
  } else {
    modes.add(id);
  }
  renderModes();
});

function openOptions() {
  $('optionsModal').classList.remove('hidden');
  $('playBtn').focus();
}
function closeOptions() {
  $('optionsModal').classList.add('hidden');
}
$('startBtn').onclick = openOptions;
$('optBack').onclick = closeOptions;
$('optionsModal').addEventListener('click', (e) => {
  if (e.target === $('optionsModal')) closeOptions();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('optionsModal').classList.contains('hidden')) closeOptions();
});
$('playBtn').onclick = () => {
  const chosen = [...modes];
  localStorage.setItem(OPTS_KEY, JSON.stringify({ duration, modes: chosen }));
  closeOptions();
  socket.emit('host:start', { duration, modes: chosen });
};
$('stopBtn').onclick = () => socket.emit('host:stop');
$('againBtn').onclick = () => socket.emit('host:restart');
$('chips').addEventListener('click', (e) => {
  const id = e.target.closest('[data-kick]')?.dataset.kick;
  if (id) socket.emit('host:kick', { playerId: id });
});

$('revealBtn').onclick = () => {
  if (!lastBoard?.feed.length) return socket.emit('host:reveal');
  reviewFromResults = false;
  reviewStep = 0;
  reviewShown = false;
  autoPlay = true;
  $('reviewBoard').innerHTML = '';
  renderReview(true);
};
$('reviewAgainBtn').onclick = () => {
  reviewFromResults = true;
  reviewStep = 0;
  reviewShown = false;
  autoPlay = true;
  $('reviewBoard').innerHTML = '';
  renderReview(true);
};
$('autoBtn').onclick = () => setAuto(!autoPlay);
$('nextBtn').onclick = nextWord;
$('prevBtn').onclick = () => {
  if (reviewStep > 0) {
    reviewStep--;
    reviewShown = true;
    renderReview(true);
  }
};
$('skipReviewBtn').onclick = finishReview;
document.addEventListener('keydown', (e) => {
  if ($('review').classList.contains('hidden')) return;
  if (e.key === ' ') {
    e.preventDefault();
    setAuto(!autoPlay);
  } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
    e.preventDefault();
    nextWord();
  } else if (e.key === 'ArrowLeft') {
    $('prevBtn').click();
  }
});

// 1º clique mostra a resposta e quem acertou; 2º clique passa para a próxima palavra
function nextWord() {
  if (reviewStep < 0 || !lastBoard?.feed.length) return;
  if (!reviewShown) {
    reviewShown = true;
    renderReview(false);
  } else if (reviewStep < lastBoard.feed.length - 1) {
    reviewStep++;
    reviewShown = false;
    renderReview(true);
  } else {
    finishReview();
  }
}

// ---------- revisão automática ----------
function setAuto(on) {
  autoPlay = on;
  autoKey = null; // força reagendar
  $('autoBtn').innerHTML = on ? `${Icon('pause')} Pausar` : `${Icon('play')} Continuar`;
  scheduleAuto();
}

// agenda o próximo passo; só reinicia o relógio quando a palavra/estado mudou
function scheduleAuto() {
  const bar = $('autoBar');
  const key = `${reviewStep}:${reviewShown}`;
  if (!autoPlay || reviewStep < 0) {
    clearTimeout(autoTimer);
    autoKey = null;
    bar.style.transition = 'none';
    bar.style.width = autoPlay ? '0%' : getComputedStyle(bar).width;
    $('autoTrack').classList.toggle('paused', !autoPlay);
    return;
  }
  $('autoTrack').classList.remove('paused');
  if (key === autoKey) return;
  autoKey = key;
  clearTimeout(autoTimer);
  const ms = reviewShown ? AUTO_ANSWER_MS : AUTO_WORD_MS;
  bar.style.transition = 'none';
  bar.style.width = '0%';
  void bar.offsetWidth;
  bar.style.transition = `width ${ms}ms linear`;
  bar.style.width = '100%';
  autoTimer = setTimeout(nextWord, ms);
}

function finishReview() {
  clearTimeout(autoTimer);
  autoKey = null;
  reviewStep = -1;
  if (reviewFromResults || lastBoard?.revealed) show('results');
  else socket.emit('host:reveal'); // avisa os celulares e mostra o placar final
}

// ---------- render ----------
function badges(p) {
  return `${p.isLastWinner ? `<span class="badge crown" title="Último vencedor">${Icon('crown')}</span>` : ''}${
    p.winStreak >= 2 ? `<span class="badge fire" title="Vitórias seguidas">${Icon('fire')}${p.winStreak}</span>` : ''
  }`;
}

// Grade em "anel": o QR ocupa o miolo e os jogadores ficam nas células da borda.
function lobbyGrid(n) {
  let C = 5;
  let R = 4;
  while (2 * C + 2 * R - 4 < n) {
    if (C - R < 4) C++;
    else R++;
  }
  return { C, R };
}

// Escolhe as células da borda bem espalhadas ao redor do centro (esquerda, direita, cima, baixo…)
function lobbySlots(n, C, R) {
  const cells = [];
  for (let r = 1; r <= R; r++) {
    for (let c = 1; c <= C; c++) {
      if (r !== 1 && r !== R && c !== 1 && c !== C) continue;
      const x = (c - (C + 1) / 2) / (C - 1);
      const y = (r - (R + 1) / 2) / (R - 1);
      cells.push({ r, c, a: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 });
    }
  }
  const used = new Set();
  const slots = [];
  for (let k = 0; k < n; k++) {
    const target = (180 + (k * 360) / n) % 360;
    let best = -1;
    let bestD = Infinity;
    cells.forEach((cell, i) => {
      if (used.has(i)) return;
      const d = Math.min(Math.abs(cell.a - target), 360 - Math.abs(cell.a - target));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    used.add(best);
    slots.push(cells[best]);
  }
  return slots;
}

function renderLobby(b) {
  const players = b.players;
  const n = players.length;
  $('playerCount').textContent = n ? plural(n, 'jogador', 'jogadores') : 'Esperando jogadores…';
  $('startBtn').disabled = !players.some((p) => p.online);
  $('playBtn').disabled = $('startBtn').disabled;

  const { C, R } = lobbyGrid(n);
  const stage = $('lobbyStage');
  stage.style.setProperty('--cols', C);
  stage.style.setProperty('--mid-rows', R - 2);
  stage.classList.toggle('dense', C >= 8);
  const center = stage.querySelector('.lobby-center');
  center.style.gridColumn = `2 / ${C}`;
  center.style.gridRow = `2 / ${R}`;

  const wrap = $('chips');
  const slots = lobbySlots(n, C, R);
  const seen = new Set();
  players.forEach((p, i) => {
    seen.add(p.id);
    let box = wrap.querySelector(`[data-id="${p.id}"]`);
    if (!box) {
      box = document.createElement('div');
      box.className = 'slot-box';
      box.dataset.id = p.id;
      box.style.animationDelay = `0s, ${(Math.random() * 2).toFixed(2)}s`;
      wrap.append(box);
    }
    box.innerHTML = `<button class="kick" data-kick="${p.id}" title="Remover">${Icon('x')}</button>${Avatar.img(p.avatar)}<span class="nm">${esc(p.name)}</span><span class="bd">${badges(p)}</span>`;
    box.classList.toggle('offline', !p.online);
    box.style.gridRow = String(slots[i].r);
    box.style.gridColumn = String(slots[i].c);
  });
  for (const box of [...wrap.children]) if (!seen.has(box.dataset.id)) box.remove();
}

// Cartões dos jogadores: avatar, nome e acertos. Mantém os elementos para animar o "+1".
function renderPlayerGrid(el, players, { showScore }) {
  const seen = new Set();
  players.forEach((p, i) => {
    seen.add(p.id);
    let card = el.querySelector(`[data-id="${p.id}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = 'player-card';
      card.dataset.id = p.id;
      card.innerHTML = `<div class="badges"></div><div class="av"></div><div class="nm"></div><div class="sc"></div>`;
      el.append(card);
    }
    card.querySelector('.badges').innerHTML = badges(p);
    const av = card.querySelector('.av');
    if (av.dataset.id !== p.avatar) {
      av.dataset.id = p.avatar;
      av.innerHTML = Avatar.img(p.avatar);
    }
    card.querySelector('.nm').textContent = p.name;
    card.classList.toggle('offline', !p.online);
    const sc = card.querySelector('.sc');
    const text = showScore ? pts(p.score) : '?';
    if (sc.textContent !== text) {
      if (showScore && sc.textContent !== '') {
        card.classList.remove('bump');
        void card.offsetWidth;
        card.classList.add('bump');
      }
      sc.textContent = text;
    }
    card.style.order = showScore ? i : 0;
  });
  for (const card of [...el.children]) if (!seen.has(card.dataset.id)) card.remove();
}

function leaderRows(players) {
  const best = Math.max(1, ...players.map((p) => p.score));
  return players
    .map(
      (p, i) => `
      <div class="leader-row ${p.online ? '' : 'offline'}">
        <span class="pos">${i + 1}</span>
        <span class="name">${Avatar.img(p.avatar)} ${esc(p.name)} ${badges(p)}</span>
        <span class="score">${pts(p.score)}</span>
        <div class="bar"><div style="width:${(p.score / best) * 100}%"></div></div>
      </div>`,
    )
    .join('');
}

function renderReview(newWord = false) {
  const feed = lastBoard.feed;
  const f = feed[reviewStep];
  show('review');
  $('reviewCount').textContent = `Palavra ${reviewStep + 1} de ${feed.length}`;
  $('reviewBar').style.width = `${((reviewStep + 1) / feed.length) * 100}%`;
  $('reviewTag').textContent = `${TYPE_LABEL[f.type]} · ${plural(f.points, 'ponto', 'pontos')}`;
  $('reviewTag').className = `tag ${f.type}`;
  $('reviewDisplay').innerHTML = Tiles.html(f.display, { variant: f.type === 'color' ? 'dark' : '', animate: newWord });
  $('reviewDisplay').style.color = f.type === 'color' ? f.color : '';
  $('reviewDisplay').className = `review-display ${f.type}`;
  $('reviewAnswer').innerHTML = f.type === 'normal' ? '' : `→ <b>${esc(f.answer)}</b>`;

  let html = '';
  if (f.solved.length) {
    html += `<div class="who-group"><div class="who-title good">${Icon('check-circle')} Acertaram (${f.solved.length})</div>${f.solved
      .map(
        (s, i) =>
          `<div class="who-item ${i === 0 ? 'first' : ''}">${who(s)} <span class="muted">${secs(s.ms)}</span> <span class="pts-chip ${s.fast ? 'fast' : ''}" title="${s.fast ? 'Menos de 1s: ×1,25' : ''}">+${pts(s.pts)}${s.fast ? Icon('lightning') : ''}</span></div>`,
      )
      .join('')}</div>`;
  } else {
    html += `<div class="who-group"><div class="who-title bad">Ninguém acertou ${Icon('smiley-x-eyes')}</div></div>`;
  }
  if (f.skipped.length) {
    html += `<div class="who-group"><div class="who-title skip">${Icon('fast-forward')} Pularam</div>${f.skipped
      .map((s) => `<div class="who-item">${who(s)}</div>`)
      .join('')}</div>`;
  }
  if (f.pending.length) {
    html += `<div class="who-group"><div class="who-title muted">${Icon('hourglass-medium')} O tempo acabou aqui</div>${f.pending
      .map((s) => `<div class="who-item">${who(s)}</div>`)
      .join('')}</div>`;
  }
  $('reviewWho').innerHTML = html;

  const card = $('reviewCard');
  if (newWord) {
    card.classList.remove('enter');
    void card.offsetWidth;
    card.classList.add('enter');
  }
  card.classList.toggle('revealed', reviewShown);
  $('prevBtn').disabled = reviewStep === 0;
  const last = reviewStep === feed.length - 1;
  $('nextBtn').innerHTML = !reviewShown
    ? `Mostrar resposta ${Icon('eye')}`
    : last
      ? `Ver placar final ${Icon('trophy')}`
      : `Próxima palavra ${Icon('caret-right')}`;
  $('skipReviewBtn').classList.toggle('hidden', last && reviewShown);
  $('autoBtn').innerHTML = autoPlay ? `${Icon('pause')} Pausar` : `${Icon('play')} Continuar`;
  renderReviewBoard();
  scheduleAuto();
}

// Placar que vai somando durante a revisão: conta as palavras já reveladas
function renderReviewBoard() {
  const feed = lastBoard.feed;
  const totals = new Map(lastBoard.players.map((p) => [p.id, 0]));
  const gained = new Map();
  for (let i = 0; i <= reviewStep && i < feed.length; i++) {
    if (i === reviewStep && !reviewShown) break;
    for (const s of feed[i].solved) {
      totals.set(s.id, (totals.get(s.id) || 0) + s.pts);
      if (i === reviewStep) gained.set(s.id, s.pts);
    }
  }
  const order = [...lastBoard.players].sort((a, b) => totals.get(b.id) - totals.get(a.id) || a.name.localeCompare(b.name));
  const el = $('reviewBoard');
  const seen = new Set();
  order.forEach((p, i) => {
    seen.add(p.id);
    let row = el.querySelector(`[data-id="${p.id}"]`);
    if (!row) {
      row = document.createElement('div');
      row.className = 'board-row';
      row.dataset.id = p.id;
      row.innerHTML = `<span class="pos"></span>${Avatar.img(p.avatar)}<span class="nm">${esc(p.name)}</span><span class="gain"></span><span class="sc"></span>`;
      el.append(row);
    }
    row.style.order = i;
    row.classList.toggle('lead', i === 0 && totals.get(p.id) > 0);
    row.querySelector('.pos').textContent = i + 1;
    const sc = row.querySelector('.sc');
    const value = pts(totals.get(p.id));
    if (sc.textContent !== value) {
      if (sc.textContent !== '') {
        row.classList.remove('bump');
        void row.offsetWidth;
        row.classList.add('bump');
      }
      sc.textContent = value;
    }
    const g = gained.get(p.id);
    row.querySelector('.gain').textContent = g ? `+${pts(g)}` : '';
  });
  for (const row of [...el.children]) if (!seen.has(row.dataset.id)) row.remove();
}

const RECORD_TEXT = {
  bestScore: (r) => `${Icon('trophy')} Mais pontos numa rodada: ${who(r)} com <b>${pts(r.value)}</b> <span class="muted">(${r.duration}s)</span>`,
  fastest: (r) => `${Icon('lightning')} Palavra mais rápida: ${who(r)} em <b>${secs(r.ms)}</b> <span class="muted">(${esc(r.word)})</span>`,
  bestCombo: (r) => `${Icon('fire')} Maior combo: ${who(r)} com <b>${r.value}</b> acertos seguidos`,
  bestWinStreak: (r) => `${Icon('crown')} Mais vitórias seguidas: ${who(r)} com <b>${r.value}</b>`,
};

const AWARD_TEXT = {
  fastest: (a) => `${Icon('lightning')} <b>Mais rápido:</b> ${who(a)} acertou <i>${esc(a.word)}</i> em ${secs(a.ms)}`,
  combo: (a) => `${Icon('fire')} <b>Maior combo:</b> ${who(a)} acertou ${a.value} seguidas`,
  accuracy: (a) => `${Icon('target')} <b>Mais preciso:</b> ${who(a)} com ${a.value}% de acerto`,
  skipper: (a) => `${Icon('fast-forward')} <b>Rei do pulo:</b> ${who(a)} pulou ${plural(a.value, 'palavra', 'palavras')}`,
  streak: (a) => `${Icon('crown')} <b>Em sequência:</b> ${who(a)} venceu ${a.value} seguidas!`,
};

function renderAwards(summary) {
  if (!summary) return ($('awards').innerHTML = '');
  let html = '';
  for (const r of summary.newRecords) {
    html += `<div class="award record">${Icon('confetti')} <b>NOVO RECORDE DA SALA!</b><br />${RECORD_TEXT[r.kind](r)}</div>`;
  }
  for (const a of summary.awards) html += `<div class="award">${AWARD_TEXT[a.kind](a)}</div>`;
  if (summary.prevWinner && summary.winner && summary.prevWinner.name !== summary.winner.name) {
    html += `<div class="award">${Icon('swap')} ${who(summary.winner)} tirou a coroa de ${who(summary.prevWinner)}!</div>`;
  }
  $('awards').innerHTML = html || '<p class="muted">Nada de especial nesta rodada.</p>';
}

function renderHall(el, stats) {
  if (!stats || stats.round === 0) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  const r = stats.records;
  const records = Object.keys(RECORD_TEXT)
    .filter((k) => r[k])
    .map((k) => `<div class="award">${RECORD_TEXT[k](r[k])}</div>`)
    .join('');
  const rows = stats.players
    .map(
      (s, i) => `<tr>
        <td class="pos">${i + 1}</td>
        <td class="nmcell">${Avatar.img(s.avatar)} ${esc(s.name)}</td>
        <td><b>${s.wins}</b></td>
        <td>${s.winStreak ? `${Icon('fire')}${s.winStreak}` : '–'}</td>
        <td>${s.bestWinStreak || '–'}</td>
        <td>${pts(s.bestScore)}</td>
        <td>${s.bestCombo || '–'}</td>
        <td>${s.fastestMs != null ? secs(s.fastestMs) : '–'}</td>
        <td><b>${pts(s.totalPoints)}</b></td>
        <td>${s.totalWords}</td>
        <td>${s.rounds}</td>
      </tr>`,
    )
    .join('');
  const history = stats.history
    .map(
      (h) =>
        `<div class="hist">Rodada ${h.round} <span class="muted">(${h.duration}s)</span> — ${
          h.winner ? `${who(h.winner)} <b>${pts(h.winner.score)} pts</b>` : '<span class="muted">sem vencedor</span>'
        }</div>`,
    )
    .join('');

  el.innerHTML = `
    <div class="hall-grid">
      <div class="panel">
        <h2>${Icon('crown')} Último vencedor</h2>
        ${
          stats.lastWinner
            ? `<div class="last-winner"><div class="lw-av">${Avatar.img(stats.lastWinner.avatar)}</div><div><div class="lw-name">${esc(stats.lastWinner.name)}</div><div class="muted">${pts(stats.lastWinner.score)} pontos · rodada ${stats.lastWinner.round}</div></div></div>`
            : '<p class="muted">Ninguém ainda.</p>'
        }
        <h2 style="margin-top:1.5rem">Recordes da sala</h2>
        ${records || '<p class="muted">Nenhum recorde ainda.</p>'}
      </div>
      <div class="panel">
        <h2>Hall da fama · ${plural(stats.round, 'rodada', 'rodadas')}</h2>
        <div class="table-wrap">
          <table class="stats-table">
            <thead><tr><th></th><th>Jogador</th><th>${Icon('trophy')} Vitórias</th><th>${Icon('fire')} Seq.</th><th>Melhor seq.</th><th>${Icon('star')} Recorde</th><th>Combo</th><th>${Icon('lightning')} Mais rápida</th><th>Pontos</th><th>Palavras</th><th>Partidas</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <h2 style="margin-top:1.5rem">Últimas rodadas</h2>
        ${history}
      </div>
    </div>`;
}

function renderResults(b) {
  const medal = (i) => `${Icon('medal')}<span>${i + 1}º</span>`;
  const top = b.players.slice(0, 3);
  const order = [1, 0, 2].filter((i) => top[i]); // 2º, 1º, 3º
  $('podium').innerHTML = order
    .map(
      (i) => `
      <div class="step p${i + 1}">
        <div class="medal">${medal(i)}</div>
        <div class="podium-av">${Avatar.img(top[i].avatar)}</div>
        <div class="n">${esc(top[i].name)}</div>
        <div class="s">${pts(top[i].score)}</div>
      </div>`,
    )
    .join('');
  $('finalList').innerHTML = leaderRows(b.players);
  $('reviewAgainBtn').classList.toggle('hidden', !b.feed.length);
  renderAwards(b.summary);
  renderHall($('resultsHall'), b.stats);
}

function startTimer(remainingMs) {
  timerEnd = Date.now() + remainingMs;
  clearInterval(timerInterval);
  const tick = () => {
    const s = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
    $('timer').textContent = s;
    $('timer').classList.toggle('low', s <= 10);
    if (s <= 0) clearInterval(timerInterval);
  };
  tick();
  timerInterval = setInterval(tick, 200);
}

function startCountdown() {
  clearInterval(countdownInterval);
  let n = 3;
  const el = $('countdownNum');
  const step = () => {
    el.innerHTML = Tiles.html(n > 0 ? String(n) : 'JÁ!');
    if (n-- <= 0) clearInterval(countdownInterval);
  };
  step();
  countdownInterval = setInterval(step, 1000);
}

socket.on('board', (b) => {
  const prevState = lastBoard?.state;
  lastBoard = b;
  if (b.state !== 'ended') {
    reviewStep = -1;
    clearTimeout(autoTimer);
    autoKey = null;
  }
  if (b.state !== 'lobby') closeOptions();

  if (b.state === 'lobby') {
    show('lobby');
    renderLobby(b);
  } else if (b.state === 'countdown') {
    if (prevState !== 'countdown') {
      $('playerGrid').innerHTML = '';
      startCountdown();
    }
    show('countdown');
  } else if (b.state === 'playing') {
    if (prevState !== 'playing') startTimer(b.remainingMs);
    show('game');
    renderPlayerGrid($('playerGrid'), b.players, { showScore: true });
  } else if (b.state === 'ended') {
    clearInterval(timerInterval);
    if (reviewStep >= 0) {
      renderReview(); // atualização no meio da revisão (ex.: alguém reconectou)
    } else if (!b.revealed) {
      show('ended');
      renderPlayerGrid($('endedGrid'), b.players, { showScore: false });
    } else {
      show('results');
      renderResults(b);
    }
  }
});
