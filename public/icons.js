// Ícones Phosphor (Fill) do sprite /icons.svg; herdam a cor do texto (currentColor)
window.Icon = (name, cls = '') =>
  `<svg class="ph ${cls}" aria-hidden="true" focusable="false"><use href="/icons.svg#${name}"></use></svg>`;
