// Efeitos sonoros sintetizados com Web Audio (sem arquivos de áudio).
// Uso: Sfx.play('correct'). O navegador só libera o som depois de um toque/clique/tecla,
// então o primeiro gesto do usuário "destrava" o áudio sozinho.
(function () {
  const MUTE_KEY = 'digita-mute';
  let ctx = null;
  let master = null;
  let muted = localStorage.getItem(MUTE_KEY) === '1';
  const listeners = [];

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // destrava o áudio no primeiro gesto
  const unlock = () => audio();
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });

  // nota simples com envelope (ataque rápido, queda exponencial)
  function tone(freq, { at = 0, dur = 0.15, type = 'sine', vol = 0.25, slide = null } = {}) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // "vush": ruído passando por um filtro que varre a frequência
  function whoosh({ at = 0, dur = 0.25, from = 1800, to = 300, vol = 0.15 } = {}) {
    const t = ctx.currentTime + at;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    // contagem 3-2-1 e "Já!"
    tick: () => tone(880, { type: 'square', dur: 0.07, vol: 0.12 }),
    go: () => {
      tone(660, { type: 'triangle', dur: 0.18, vol: 0.25 });
      tone(990, { type: 'triangle', at: 0.09, dur: 0.3, vol: 0.25 });
    },
    // últimos segundos da rodada
    hurry: () => tone(660, { type: 'square', dur: 0.05, vol: 0.09 }),
    // tempo esgotado
    end: () => {
      tone(220, { type: 'square', dur: 0.55, vol: 0.14 });
      tone(165, { type: 'square', dur: 0.55, vol: 0.12 });
    },
    // celular: acertou / errou / pulou
    correct: () => {
      tone(660, { type: 'triangle', dur: 0.1, vol: 0.25 });
      tone(990, { type: 'triangle', at: 0.07, dur: 0.16, vol: 0.25 });
    },
    fast: () => [1320, 1760, 2093].forEach((f, i) => tone(f, { at: 0.14 + i * 0.05, dur: 0.08, vol: 0.12 })),
    wrong: () => tone(170, { type: 'sawtooth', dur: 0.22, vol: 0.14, slide: 110 }),
    skip: () => whoosh({ dur: 0.22, from: 1600, to: 350, vol: 0.18 }),
    // lobby: alguém entrou
    join: () => tone(520, { dur: 0.13, vol: 0.22, slide: 920 }),
    // revisão
    card: () => whoosh({ dur: 0.16, from: 900, to: 2400, vol: 0.06 }),
    reveal: () => {
      tone(784, { type: 'triangle', dur: 0.25, vol: 0.18 });
      tone(1175, { type: 'triangle', at: 0.05, dur: 0.35, vol: 0.14 });
    },
    points: () => tone(1046, { dur: 0.08, vol: 0.1 }),
    overtake: () => tone(440, { dur: 0.28, vol: 0.18, slide: 1320 }),
    // vencedor
    win: () => {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.11, dur: 0.18, vol: 0.22 }));
      [523, 659, 784].forEach((f) => tone(f * 2, { type: 'triangle', at: 0.46, dur: 0.8, vol: 0.12 }));
    },
  };

  window.Sfx = {
    play(name) {
      if (muted || !SOUNDS[name]) return;
      if (!audio() || ctx.state !== 'running') return;
      try {
        SOUNDS[name]();
      } catch {}
    },
    get muted() {
      return muted;
    },
    setMuted(v) {
      muted = !!v;
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      listeners.forEach((fn) => fn(muted));
    },
    toggle() {
      this.setMuted(!muted);
      if (!muted) this.play('points');
    },
    onChange(fn) {
      listeners.push(fn);
      fn(muted);
    },
  };
})();
