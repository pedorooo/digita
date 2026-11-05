// Avatares DiceBear (estilo "thumbs", licença MIT), coloridos só com a paleta do jogo.
// Cada avatar tem um par fundo/corpo fixo com bom contraste: 6 pares × 4 rostos = 24 opções.
// Os SVGs são gerados no build (scripts/build.js) e servidos como arquivos estáticos.
export const AVATAR_PAIRS = [
  ['ffffd5', '3b2524'], ['ffffd5', '735044'], ['ffffd5', 'b76b53'],
  ['ffffd5', 'e48362'], ['ff9f72', '3b2524'], ['ff9f72', '735044'],
];
export const AVATARS = Array.from({ length: 24 }, (_, i) => `digita-${i + 1}`);
