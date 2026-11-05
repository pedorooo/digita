# Digita!

A party typing race in Portuguese. The main screen creates a room and shows a QR code, and players join from their phones.
Everyone gets the **same stack of words**:

- **normal**: type it as shown
- **ao contrário** (reversed): type it the right way round (`asac` → `casa`)
- **emoji**: type what the emoji (1 or 2 of them) means (`🍎` → `maçã`, `🐶 🔥` → `cachorro-quente`)
- **cor da tinta** (ink colour): type the COLOUR the word is painted in, not the word itself (**AZUL** in red → `vermelho`)
- **oposto** (opposite): type the antonym (`quente` → `frio`)
- **número** (number): write the number out in words (`47` → `quarenta e sete`)

Accents, spaces and hyphens are optional. Whoever gets the most words right before time runs out wins.

## Running

```bash
npm install
npm start
```

Open `http://localhost:3000` on the main screen (TV or projector). Phones need to be on the **same Wi-Fi network** to scan the QR code.

- If the QR shows the wrong IP, or you're behind a proxy or tunnel: `PUBLIC_URL=http://192.168.0.10:3000 npm start`
- Different port: `PORT=8080 npm start`
- If phones can't connect, open port 3000 in the firewall (e.g. `sudo ufw allow 3000`).

## Credits

- Avatars: [DiceBear](https://www.dicebear.com), "Thumbs" style (MIT license), generated locally by the server at `/avatar/<id>.svg` and colored with the game's palette.
- Icons: [Phosphor Icons](https://phosphoricons.com), Fill style (MIT license), from `@phosphor-icons/core`, served as a sprite at `/icons.svg`.
- Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) (SIL Open Font License), served from `@fontsource/fredoka`.
