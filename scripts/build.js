// Gera a pasta dist/ servida pelo Cloudflare (Workers Static Assets):
// public/ + sprite de ícones + SVGs dos avatares + fontes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAvatar } from '@dicebear/core';
import { thumbs } from '@dicebear/collection';
import { AVATARS, AVATAR_PAIRS } from '../src/avatars.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const mod = (...p) => path.join(root, 'node_modules', ...p);

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });

// Fonte Fredoka (SIL OFL), de @fontsource/fredoka
fs.cpSync(mod('@fontsource', 'fredoka', 'files'), path.join(dist, 'fonts'), { recursive: true });

// Ícones Phosphor (estilo Fill, licença MIT) num único sprite SVG: <use href="/icons.svg#nome">
const ICONS = [
  'crown', 'fire', 'medal', 'lightning', 'target', 'fast-forward', 'skip-forward', 'trophy', 'alarm', 'eye', 'star',
  'timer', 'check', 'check-circle', 'x', 'paper-plane-right', 'play', 'caret-left', 'caret-right', 'arrow-clockwise',
  'confetti', 'swap', 'hourglass-medium', 'hand-waving', 'smiley-x-eyes', 'pause',
];
const sprite =
  '<svg xmlns="http://www.w3.org/2000/svg">' +
  ICONS.map((name) => {
    const svg = fs.readFileSync(mod('@phosphor-icons', 'core', 'assets', 'fill', `${name}-fill.svg`), 'utf8');
    return svg.replace(/^<svg[^>]*>/, `<symbol id="${name}" viewBox="0 0 256 256" fill="currentColor">`).replace(/<\/svg>\s*$/, '</symbol>');
  }).join('') +
  '</svg>';
fs.writeFileSync(path.join(dist, 'icons.svg'), sprite);

// Avatares
fs.mkdirSync(path.join(dist, 'avatar'));
AVATARS.forEach((seed, i) => {
  const [bg, body] = AVATAR_PAIRS[i % AVATAR_PAIRS.length];
  const svg = createAvatar(thumbs, {
    seed,
    backgroundColor: [bg],
    shapeColor: [body],
    eyesColor: ['ffffd5'],
    mouthColor: ['ffffd5'],
  }).toString();
  fs.writeFileSync(path.join(dist, 'avatar', `${seed}.svg`), svg);
});
fs.writeFileSync(path.join(dist, 'avatars.json'), JSON.stringify(AVATARS));

// Cache longo para o que não muda entre versões
fs.writeFileSync(
  path.join(dist, '_headers'),
  ['/fonts/*', '  Cache-Control: public, max-age=604800', '/avatar/*', '  Cache-Control: public, max-age=604800', '/icons.svg', '  Cache-Control: public, max-age=86400', ''].join('\n'),
);

console.log(`dist/ pronto: ${ICONS.length} ícones, ${AVATARS.length} avatares`);
