# Digita!

A party typing race in Portuguese. The main screen creates a room and shows a QR code, and players join from their phones.
Everyone gets the **same stack of words**:

- **normal**: type it as shown
- **ao contrário** (reversed): type it the right way round (`asac` → `casa`)
- **emoji**: type what the emoji (1 or 2 of them) means (`🍎` → `maçã`, `🐶 🔥` → `cachorro-quente`)
- **cor da tinta** (ink colour): type the COLOUR the word is painted in, not the word itself (**AZUL** in red → `vermelho`)
- **oposto** (opposite): type the antonym (`quente` → `frio`)
- **número** (number): write the number out in words (`47` → `quarenta e sete`)

Accents, spaces and hyphens are optional. Each mode is worth points (normal 1, ao contrário/emoji/oposto 2, número/cor da tinta 3) and answering in under 1 second gives ×1.25. At the end, the words are reviewed one by one with a live scoreboard; that review screen is the final ranking.

## Running

It runs on Cloudflare Workers. Each room is a Durable Object (`src/room.js`), and the Worker (`src/worker.js`) serves the files from `public/` and creates rooms. `npm run build` generates `dist/` (public files, icon sprite, avatars and fonts). `wrangler` runs it automatically.

```bash
npm install
npm run dev      # local: http://localhost:8787
npm run deploy   # publishes to Cloudflare (run `npx wrangler login` once first)
```

**Test room:** open the main screen with `?teste` (e.g. `http://localhost:8787/?teste`) and 5 automatic players (Ana, Bia, Caio, Duda, Enzo) join the room and play by themselves, each with a different speed and accuracy. `?teste=3` adds only 3. Real phones can join the same room too.

To test on phones over the local network: `npx wrangler dev --ip 0.0.0.0`, then open `http://<your-ip>:8787` on the main screen. The QR code uses the address the main screen was opened with.

## Credits

- Avatars: [DiceBear](https://www.dicebear.com), "Thumbs" style (MIT license), generated at build time as `/avatar/<id>.svg` and colored with the game's palette.
- Icons: [Phosphor Icons](https://phosphoricons.com), Fill style (MIT license), from `@phosphor-icons/core`, served as a sprite at `/icons.svg`.
- Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) (SIL Open Font License), served from `@fontsource/fredoka`.
