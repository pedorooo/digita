// Desenha um texto como peças de letras (uma peça por letra / emoji).
(function () {
  const isEmoji = /\p{Extended_Pictographic}/u;
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('pt', { granularity: 'grapheme' }) : null;

  function split(text) {
    return segmenter ? [...segmenter.segment(text)].map((s) => s.segment) : Array.from(text);
  }

  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // variant: '' (peça clara) | 'dark' (peça escura, usada na "cor da tinta" para a cor aparecer bem)
  function html(text, { variant = '', animate = true } = {}) {
    let i = 0;
    const parts = split(String(text)).map((ch) => {
      if (/\s/.test(ch)) return '<span class="tile-gap"></span>';
      const cls = isEmoji.test(ch) ? 'tile emoji' : 'tile';
      return `<span class="${cls}" style="--i:${i++}"><span>${esc(ch)}</span></span>`;
    });
    return `<span class="tiles ${variant} ${animate ? 'animate' : ''}">${parts.join('')}</span>`;
  }

  window.Tiles = { html, split };

  // <h1 class="logo" data-tiles="DIGITA!"> vira peças automaticamente
  function fillStatic() {
    for (const el of document.querySelectorAll('[data-tiles]')) el.innerHTML = html(el.dataset.tiles);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fillStatic);
  else fillStatic();
})();
