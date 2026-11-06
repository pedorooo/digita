const socket = Net.socket();
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
let reviewShown = false; // a resposta da palavra atual já foi revelada?
let reviewFinal = false; // terminou: a tela da revisão vira a classificação final

// revisão automática (padrão): mostra a palavra, revela a resposta e passa para a próxima sozinha
const AUTO_WORD_MS = 2200; // tempo com a resposta escondida
const AUTO_ANSWER_MS = 3800; // tempo com a resposta e quem acertou
let autoPlay = true;
let autoTimer = null;
let autoKey = null;

const TYPE_LABEL = { normal: 'normal', reversed: 'ao contrário', emoji: 'emoji', color: 'cor da tinta', opposite: 'oposto', number: 'número' };
const SECTIONS = ['lobby', 'countdown', 'game', 'ended', 'review', 'connecting'];

// sala de teste: abra a tela principal com ?teste (ou ?teste=3) para entrar com jogadores que jogam sozinhos
const TEST_BOTS = new URLSearchParams(location.search).has('teste')
  ? Math.min(5, Math.max(1, Number(new URLSearchParams(location.search).get('teste')) || 5))
  : 0;

function show(id) {
  for (const s of SECTIONS) $(s).classList.toggle('hidden', s !== id);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const secs = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')}s`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// pontos são inteiros (modo + bônus de rapidez); o formatador também aguenta pontuações antigas
const pts = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const who = (p) => `<span class="who">${Avatar.img(p.avatar)} ${esc(p.name)}</span>`;

// ---------- criação / reconexão da sala ----------
// 1) pede a sala ao servidor (retoma a salva nesta aba, se ainda existir; senão cria outra)
// 2) conecta no WebSocket da sala e assume o papel de host
let hostToken = null;
let createRetry = 0;
async function createRoom() {
  const saved = JSON.parse(sessionStorage.getItem('digita-host') || 'null');
  let res;
  try {
    const r = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(saved || {}),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    res = await r.json();
  } catch (err) {
    console.error('não foi possível criar a sala', err);
    setTimeout(createRoom, Math.min(5000, 500 * 2 ** createRetry++));
    return;
  }
  createRetry = 0;
  hostToken = res.hostToken;
  sessionStorage.setItem('digita-host', JSON.stringify({ code: res.code, hostToken: res.hostToken }));
  $('qr').src = res.qr;
  $('code').innerHTML = Tiles.html(res.code);
  $('joinUrl').textContent = res.joinUrl;
  $('headerCodeText').innerHTML = Tiles.html(res.code, { animate: false });
  $('headerCode').classList.remove('hidden');
  if (socket.room !== res.code || !socket.connected) socket.connect(res.code);
}
socket.on('connect', () => {
  socket.emit('host:claim', { hostToken }, (res) => {
    // a sala fechou enquanto estávamos fora: cria outra
    if (res.error) return createRoom();
    // sala de teste: adiciona os jogadores automáticos uma única vez por sala
    const key = `digita-bots-${socket.room}`;
    if (TEST_BOTS && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      socket.emit('host:addBots', { n: TEST_BOTS });
    }
  });
});
createRoom();

// ---------- som ----------
$('muteBtn').onclick = () => Sfx.toggle();
Sfx.onChange((m) => ($('muteBtn').innerHTML = Icon(m ? 'speaker-slash' : 'speaker-high')));

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
  reviewFinal = false;
  reviewStep = 0;
  reviewShown = false;
  autoPlay = true;
  $('reviewBoard').innerHTML = '';
  renderReview(true);
};
$('reviewAgainBtn').onclick = () => {
  reviewFinal = false;
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
    Sfx.play('reveal');
    renderReview(false);
  } else if (reviewStep < lastBoard.feed.length - 1) {
    reviewStep++;
    reviewShown = false;
    Sfx.play('card');
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

// fim da revisão: a própria tela vira a classificação final
function finishReview() {
  clearTimeout(autoTimer);
  autoKey = null;
  if (!reviewFinal) Sfx.play('win');
  reviewFinal = true;
  reviewStep = Math.max(0, (lastBoard?.feed.length || 1) - 1);
  reviewShown = true;
  renderFinal();
  if (!lastBoard?.revealed) socket.emit('host:reveal'); // avisa os celulares
}

function renderFinal() {
  show('review');
  const b = lastBoard;
  const top = b.players[0];
  $('reviewCount').textContent = 'Fim de jogo';
  $('reviewBar').style.width = '100%';
  const card = $('reviewCard');
  card.classList.add('final');
  card.classList.remove('revealed');
  $('reviewFinal').classList.remove('hidden');
  $('reviewFinal').innerHTML =
    top && top.score > 0
      ? `<div class="final-trophy">${Icon('trophy')}</div>
         <div class="final-winner">${Avatar.img(top.avatar)}</div>
         <div class="final-name">${esc(top.name)} venceu!</div>
         <div class="final-score">${pts(top.score)} pontos · ${plural(top.words, 'palavra', 'palavras')}</div>`
      : `<div class="final-trophy">${Icon('smiley-x-eyes')}</div><div class="final-name">Ninguém pontuou</div>`;
  for (const id of ['autoBtn', 'prevBtn', 'nextBtn', 'skipReviewBtn']) $(id).classList.add('hidden');
  $('againBtn').classList.remove('hidden');
  $('reviewAgainBtn').classList.toggle('hidden', !b.feed.length);
  clearTimeout(autoTimer);
  $('autoTrack').classList.add('hidden');
  renderReviewBoard();
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
      Sfx.play('join');
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

// Cartões dos jogadores: avatar, nome e PALAVRAS certas (os pontos só aparecem na revisão).
// Mantém os elementos para animar o "+1".
function renderPlayerGrid(el, players, { showScore }) {
  const seen = new Set();
  // ordem por palavras certas (ordenar por pontos entregaria a pontuação)
  const list = showScore ? [...players].sort((a, b) => b.words - a.words || a.name.localeCompare(b.name)) : players;
  list.forEach((p, i) => {
    seen.add(p.id);
    let card = el.querySelector(`[data-id="${p.id}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = 'player-card';
      card.dataset.id = p.id;
      // sem coroa/🔥 aqui: durante o jogo e antes de revelar eles dariam a impressão de indicar o vencedor
      card.innerHTML = `<div class="av"></div><div class="nm"></div><div class="sc"></div><div class="unit"></div>`;
      el.append(card);
    }
    const av = card.querySelector('.av');
    if (av.dataset.id !== p.avatar) {
      av.dataset.id = p.avatar;
      av.innerHTML = Avatar.img(p.avatar);
    }
    card.querySelector('.nm').textContent = p.name;
    card.classList.toggle('offline', !p.online);
    const sc = card.querySelector('.sc');
    const text = showScore ? String(p.words) : '?';
    card.querySelector('.unit').textContent = showScore ? (p.words === 1 ? 'palavra' : 'palavras') : '';
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

function renderReview(newWord = false) {
  if (reviewFinal) return renderFinal();
  $('reviewCard').classList.remove('final');
  $('reviewFinal').classList.add('hidden');
  $('autoTrack').classList.remove('hidden');
  for (const id of ['autoBtn', 'prevBtn', 'nextBtn', 'skipReviewBtn']) $(id).classList.remove('hidden');
  $('againBtn').classList.add('hidden');
  $('reviewAgainBtn').classList.add('hidden');
  const feed = lastBoard.feed;
  const f = feed[reviewStep];
  show('review');
  $('reviewCount').textContent = `Palavra ${reviewStep + 1} de ${feed.length}`;
  $('reviewBar').style.width = `${((reviewStep + 1) / feed.length) * 100}%`;
  $('reviewTag').textContent = `${TYPE_LABEL[f.type]} · ${plural(f.points, 'ponto', 'pontos')}`;
  $('reviewTag').className = `tag ${f.type}`;
  $('reviewDisplay').innerHTML = Tiles.html(f.display, { variant: f.type === 'color' ? 'dark' : '', animate: newWord });
  fitReviewDisplay();
  $('reviewDisplay').style.color = f.type === 'color' ? f.color : '';
  $('reviewDisplay').className = `review-display ${f.type}`;
  $('reviewAnswer').innerHTML = f.type === 'normal' ? '' : `→ <b>${esc(f.answer)}</b>`;

  let html = '';
  if (f.solved.length) {
    html += `<div class="who-group"><div class="who-title good">${Icon('check-circle')} Acertaram (${f.solved.length})</div>${f.solved
      .map(
        (s, i) =>
          `<div class="who-item ${i === 0 ? 'first' : ''}">${who(s)} <span class="muted">${secs(s.ms)}</span> <span class="pts-chip ${s.bonus ? 'fast' : ''}" title="${s.bonus ? `Rapidez: +${s.bonus}` : ''}">+${pts(s.pts)}${s.bonus ? Icon('lightning') : ''}</span></div>`,
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

// Palavras longas (ex.: 11 letras) diminuem as peças até caberem no cartão
function fitReviewDisplay() {
  const d = $('reviewDisplay');
  const tiles = d.firstElementChild;
  d.style.fontSize = '';
  if (!tiles) return;
  const avail = $('reviewCard').clientWidth - 64;
  const w = tiles.offsetWidth;
  if (w > avail) d.style.fontSize = `${(parseFloat(getComputedStyle(d).fontSize) * avail) / w}px`;
}
window.addEventListener('resize', () => {
  if (!$('review').classList.contains('hidden')) fitReviewDisplay();
});

// Placar que vai somando durante a revisão: conta as palavras já reveladas
function renderReviewBoard() {
  const feed = lastBoard.feed;
  const totals = new Map(lastBoard.players.map((p) => [p.id, reviewFinal ? p.score : 0]));
  const gained = new Map();
  for (let i = 0; !reviewFinal && i <= reviewStep && i < feed.length; i++) {
    if (i === reviewStep && !reviewShown) break;
    for (const s of feed[i].solved) {
      totals.set(s.id, (totals.get(s.id) || 0) + s.pts);
      if (i === reviewStep) gained.set(s.id, s.pts);
    }
  }
  const order = [...lastBoard.players].sort((a, b) => totals.get(b.id) - totals.get(a.id) || a.name.localeCompare(b.name));
  const el = $('reviewBoard');
  // FLIP: guarda onde cada linha estava para animar a troca de posição
  const before = new Map([...el.children].map((r) => [r.dataset.id, { top: r.getBoundingClientRect().top, pos: Number(r.dataset.pos) }]));
  const seen = new Set();
  let bumped = false;
  let overtook = false;
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
    row.dataset.pos = i;
    row.classList.toggle('lead', i === 0 && totals.get(p.id) > 0);
    row.querySelector('.pos').textContent = i + 1;
    const sc = row.querySelector('.sc');
    const value = pts(totals.get(p.id));
    if (sc.textContent !== value) {
      if (sc.textContent !== '') {
        row.classList.remove('bump');
        void row.offsetWidth;
        row.classList.add('bump');
        bumped = true;
      }
      sc.textContent = value;
    }
    const g = gained.get(p.id);
    row.querySelector('.gain').textContent = g ? `+${pts(g)}` : '';
  });
  for (const row of [...el.children]) if (!seen.has(row.dataset.id)) row.remove();

  // anima quem mudou de lugar: desliza da posição antiga para a nova; quem subiu ganha destaque
  for (const row of el.children) {
    const old = before.get(row.dataset.id);
    if (!old) continue;
    const dy = old.top - row.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    row.style.transition = 'none';
    row.style.transform = `translateY(${dy}px)`;
    row.style.zIndex = Number(row.dataset.pos) < old.pos ? 2 : 1;
    void row.offsetWidth;
    row.style.transition = 'transform 650ms cubic-bezier(0.2, 0.9, 0.25, 1.15)';
    row.style.transform = '';
    if (Number(row.dataset.pos) < old.pos) {
      row.classList.remove('up');
      void row.offsetWidth;
      row.classList.add('up');
      overtook = true;
    }
    row.addEventListener('transitionend', () => (row.style.zIndex = ''), { once: true });
  }
  if (overtook) Sfx.play('overtake');
  else if (bumped) Sfx.play('points');
}

function startTimer(remainingMs) {
  timerEnd = Date.now() + remainingMs;
  clearInterval(timerInterval);
  const tick = () => {
    const s = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
    if ($('timer').textContent !== String(s) && s > 0 && s <= 5) Sfx.play('hurry');
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
    Sfx.play(n > 0 ? 'tick' : 'go');
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
    reviewFinal = false;
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
    if (prevState === 'playing') Sfx.play('end');
    clearInterval(timerInterval);
    if (reviewFinal || (b.revealed && reviewStep < 0)) {
      reviewFinal = true;
      renderFinal(); // classificação final (também ao recarregar a página depois do fim)
    } else if (reviewStep >= 0) {
      renderReview(); // atualização no meio da revisão (ex.: alguém reconectou)
    } else {
      show('ended');
      renderPlayerGrid($('endedGrid'), b.players, { showScore: false });
    }
  }
});
