const socket = Net.socket();
const $ = (id) => document.getElementById(id);

// se o servidor reiniciou com código novo, recarrega a página para não ficar com a versão antiga
let buildId = null;
socket.on('build', (id) => {
  if (buildId && buildId !== id) location.reload();
  buildId = id;
});

const TYPE_LABEL = { normal: 'normal', reversed: 'ao contrário', emoji: 'emoji', color: 'cor da tinta', opposite: 'oposto', number: 'número' };

// pontos podem ter decimais (bônus de rapidez ×1,25)
const pts = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// cartõezinhos com vitórias / sequência / recorde
function statsHtml(st) {
  if (!st || !st.rounds) return '';
  return `<div><b>${st.wins}</b><span>${Icon('trophy')} vitórias</span></div>
    <div><b>${st.winStreak ? Icon('fire') + st.winStreak : '0'}</b><span>sequência</span></div>
    <div><b>${pts(st.bestScore)}</b><span>${Icon('star')} recorde</span></div>`;
}
const STORE = 'digita-player';

let current = null; // { index, display, type }
let myId = null;
let timerEnd = null;
let timerInterval = null;
let joined = false;
let myAvatar = null;

const urlCode = (location.pathname.match(/\/join\/([A-Za-z]{4})/) || [])[1];
const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
if (urlCode) $('codeInput').value = urlCode.toUpperCase();
if (saved?.name) $('nameInput').value = saved.name;
(urlCode ? $('nameInput') : $('codeInput')).focus();

// seletor de avatar
fetch('/avatars.json')
  .then((r) => r.json())
  .then((list) => {
    myAvatar = list.includes(saved?.avatar) ? saved.avatar : list[Math.floor(Math.random() * list.length)];
    const picker = $('avatarPicker');
    picker.innerHTML = list
      .map((a) => `<button type="button" data-av="${a}" class="${a === myAvatar ? 'active' : ''}" aria-label="Avatar">${Avatar.img(a)}</button>`)
      .join('');
    picker.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      myAvatar = b.dataset.av;
      for (const x of picker.children) x.classList.toggle('active', x === b);
    });
  });

function show(id) {
  for (const s of ['joinScreen', 'waitScreen', 'countScreen', 'gameScreen', 'endScreen', 'closedScreen']) {
    $(s).classList.toggle('hidden', s !== id);
  }
  document.body.classList.toggle('in-game', id === 'gameScreen');
  fitViewport();
}

// ---------- fazer o jogo caber acima do teclado ----------
// O visualViewport é a área realmente visível (sem o teclado). A tela do jogo usa exatamente essa área.
function fitViewport() {
  const vv = window.visualViewport;
  const root = document.documentElement.style;
  if (vv) {
    root.setProperty('--app-h', `${vv.height}px`);
    root.setProperty('--app-top', `${vv.offsetTop}px`);
  }
  if (document.body.classList.contains('in-game')) {
    window.scrollTo(0, 0);
    requestAnimationFrame(fitWord);
  }
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', fitViewport);
  visualViewport.addEventListener('scroll', fitViewport);
}
window.addEventListener('resize', fitViewport);

// Ajusta o tamanho da palavra para o maior que couber no cartão
function fitWord() {
  const card = $('card');
  const el = $('word');
  if (!el.textContent || card.clientHeight === 0) return;
  const maxW = card.clientWidth - 24;
  const maxH = card.clientHeight - 36; // espaço para a dica embaixo
  let lo = 18;
  let hi = Math.max(lo, Math.min(160, maxH));
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    el.style.fontSize = `${mid}px`;
    if (el.scrollWidth <= maxW && el.scrollHeight <= maxH) lo = mid;
    else hi = mid;
  }
  el.style.fontSize = `${lo}px`;
}

// cada sala tem o próprio WebSocket: conecta no da sala pedida e entra quando abrir
let pendingJoin = null;
function join(code, name, playerId, avatar = myAvatar) {
  pendingJoin = { code, name, avatar, playerId };
  if (socket.room === code && socket.connected) sendJoin();
  else socket.connect(code); // o 'connect' chama sendJoin()
}

function sendJoin() {
  socket.emit('player:join', pendingJoin, (res) => {
    if (res.error) {
      joined = false;
      pendingJoin = null;
      socket.disconnect();
      show('joinScreen');
      $('joinError').textContent = res.error;
    }
  });
}

$('joinScreen').addEventListener('submit', (e) => {
  e.preventDefault();
  $('joinError').textContent = '';
  const code = $('codeInput').value.trim().toUpperCase();
  const name = $('nameInput').value.trim();
  if (code.length !== 4) return ($('joinError').textContent = 'O código tem 4 letras.');
  if (!name) return ($('joinError').textContent = 'Digite seu nome.');
  const sameRoom = saved && saved.code === code ? saved.playerId : undefined;
  join(code, name, sameRoom);
});

// reconexão automática (refresh da página ou queda de rede)
socket.on('connect', () => {
  const s = JSON.parse(localStorage.getItem(STORE) || 'null');
  // já dentro da sala: volta com a identidade salva (mesmo playerId, mantém a pontuação)
  if (joined && s && s.code === socket.room) pendingJoin = { code: s.code, name: s.name, avatar: s.avatar, playerId: s.playerId };
  if (pendingJoin) sendJoin();
});
if (saved && urlCode && saved.code === urlCode.toUpperCase()) join(saved.code, saved.name, saved.playerId, saved.avatar);

socket.on('joined', ({ code, playerId, name, avatar, state, stats, isLastWinner }) => {
  const html = statsHtml(stats);
  $('myStats').innerHTML = html;
  $('myStats').classList.toggle('hidden', !html);
  joined = true;
  myId = playerId;
  myAvatar = avatar;
  localStorage.setItem(STORE, JSON.stringify({ code, playerId, name, avatar }));
  $('meName').textContent = name;
  $('meAvatar').innerHTML = (isLastWinner ? Icon('crown', 'crown') : '') + Avatar.img(avatar);
  $('endAvatar').innerHTML = Avatar.img(avatar);
  if (state === 'lobby') show('waitScreen');
});

socket.on('lobby', () => show('waitScreen'));

socket.on('countdown', ({ remainingMs }) => {
  show('countScreen');
  let n = Math.ceil(remainingMs / 1000);
  const el = $('countNum');
  const step = () => {
    el.innerHTML = Tiles.html(n > 0 ? String(n) : 'JÁ!');
    if (navigator.vibrate) navigator.vibrate(40);
    n--;
  };
  step();
  const iv = setInterval(() => (n < 0 ? clearInterval(iv) : step()), 1000);
});

socket.on('round:start', ({ remainingMs }) => {
  show('gameScreen');
  timerEnd = Date.now() + remainingMs;
  clearInterval(timerInterval);
  const tick = () => {
    const s = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
    $('time').textContent = s;
    $('timeBox').classList.toggle('low', s <= 10);
  };
  tick();
  timerInterval = setInterval(tick, 200);
  $('answer').value = '';
  $('answer').focus();
});

socket.on('word', (w) => {
  current = w;
  $('score').textContent = pts(w.score);
  $('word').innerHTML = Tiles.html(w.display, { variant: w.type === 'color' ? 'dark' : '' });
  $('word').style.color = w.type === 'color' ? w.color : ''; // cor da tinta
  $('wordTag').textContent = TYPE_LABEL[w.type];
  $('wordTag').className = `tag ${w.type}`;
  $('card').classList.toggle('emoji', w.type === 'emoji');
  $('answer').value = '';
  $('answer').focus();
  fitWord();
});

function flash(cls, hint) {
  const card = $('card');
  card.classList.remove('right', 'skip');
  void card.offsetWidth;
  card.classList.add(cls);
  $('hint').innerHTML = hint;
  setTimeout(() => card.classList.remove(cls), 350);
}

socket.on('answer:right', ({ answer, pts: p, fast }) =>
  flash('right', `${Icon('check-circle')} ${esc(answer)} · <b>+${pts(p)}</b>${fast ? ` ${Icon('lightning')} rápido!` : ''}`),
);
socket.on('answer:skipped', ({ answer }) => flash('skip', `era: ${esc(answer)}`));
socket.on('answer:wrong', () => {
  const input = $('answer');
  input.classList.remove('shake');
  void input.offsetWidth;
  input.classList.add('shake');
  if (navigator.vibrate) navigator.vibrate(120);
  input.value = ''; // no celular, select() abre o menu de copiar/colar por cima da palavra
});
$('answer').addEventListener('animationend', () => $('answer').classList.remove('shake'));

function submit() {
  const text = $('answer').value.trim();
  if (!text || !current) return;
  socket.emit('player:answer', { text, index: current.index });
  $('answer').focus();
}
$('answerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submit();
});
// tocar nos botões não pode tirar o foco do campo (senão o teclado fecha e abre a cada palavra)
for (const id of ['sendBtn', 'skipBtn']) {
  $(id).addEventListener('pointerdown', (e) => e.preventDefault());
  $(id).addEventListener('mousedown', (e) => e.preventDefault());
}
$('skipBtn').addEventListener('click', () => {
  if (current) socket.emit('player:skip', { index: current.index });
  $('answer').focus();
});

// fim do tempo: mostra só a própria pontuação e espera o host revelar
socket.on('round:end', ({ score, words = 0 }) => {
  clearInterval(timerInterval);
  current = null;
  $('answer').blur();
  $('endScore').textContent = `${pts(score)} ponto${score === 1 ? '' : 's'}`;
  $('endWords').textContent = `${words} palavra${words === 1 ? '' : 's'} certa${words === 1 ? '' : 's'}`;
  $('endWaiting').classList.remove('hidden');
  $('endResult').classList.add('hidden');
  show('endScreen');
});

socket.on('round:results', ({ ranking, me, awards, newRecords }) => {
  const pos = ranking.findIndex((p) => p.id === myId);
  $('endPos').innerHTML = pos < 0 ? '—' : pos < 3 ? `${Icon('medal', `m${pos + 1}`)}<span>${pos + 1}º</span>` : `${pos + 1}º`;
  $('endWinner').innerHTML =
    pos === 0 ? `Você venceu! ${Icon('confetti')}` : ranking[0] ? `Vencedor: ${Avatar.img(ranking[0].avatar)} ${esc(ranking[0].name)} (${pts(ranking[0].score)} pts)` : '';
  const mine = (x) => ranking[pos] && x.name === ranking[pos].name;
  const LABEL = {
    bestScore: `${Icon('trophy')} Novo recorde da sala: mais pontos!`,
    fastest: `${Icon('lightning')} Novo recorde da sala: palavra mais rápida!`,
    bestCombo: `${Icon('fire')} Novo recorde da sala: maior combo!`,
    bestWinStreak: `${Icon('crown')} Novo recorde da sala: vitórias seguidas!`,
  };
  const AWARD = {
    fastest: `${Icon('lightning')} Mais rápido da rodada`,
    combo: (a) => `${Icon('fire')} Maior combo (${a.value})`,
    accuracy: (a) => `${Icon('target')} Mais preciso (${a.value}%)`,
    skipper: `${Icon('fast-forward')} Rei do pulo`,
  };
  let hl = '';
  for (const r of newRecords || []) if (mine(r)) hl += `<div class="highlight">${LABEL[r.kind]}</div>`;
  if (me?.newBest) hl += `<div class="highlight">${Icon('star')} Novo recorde pessoal! (antes: ${pts(me.prevBest)})</div>`;
  if (pos === 0 && me?.winStreak >= 2) hl += `<div class="highlight">${Icon('fire')} ${me.winStreak} vitórias seguidas!</div>`;
  for (const a of awards || []) {
    const t = AWARD[a.kind];
    if (t && mine(a)) hl += `<div class="highlight">${typeof t === 'function' ? t(a) : t}</div>`;
  }
  $('endHighlights').innerHTML = hl;
  $('endStats').innerHTML = me ? statsHtml({ rounds: me.rounds, wins: me.wins, winStreak: me.winStreak, bestScore: me.bestScore }) : '';
  $('endWaiting').classList.add('hidden');
  $('endResult').classList.remove('hidden');
  if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
});

socket.on('room:closed', () => {
  joined = false;
  pendingJoin = null;
  socket.disconnect();
  localStorage.removeItem(STORE);
  $('closedMsg').textContent = 'A sala foi fechada.';
  show('closedScreen');
});
socket.on('kicked', () => {
  joined = false;
  pendingJoin = null;
  socket.disconnect();
  localStorage.removeItem(STORE);
  $('closedMsg').textContent = 'Você foi removido da sala.';
  show('closedScreen');
});
