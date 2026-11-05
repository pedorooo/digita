// Worker de entrada: arquivos estáticos (dist/), criação de salas e WebSocket de cada sala.
// Cada sala é um Durable Object (src/room.js) identificado pelo código de 4 letras.
import QRCode from 'qrcode';

export { Room } from './room.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem I e O
const CODE_RE = /^[A-Z]{4}$/;

function newCode() {
  const r = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(r, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

const roomStub = (env, code) => env.ROOMS.get(env.ROOMS.idFromName(code));

const post = (stub, path, body) =>
  stub.fetch(`https://room${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

// Retoma a sala do host (mesmo código + token) ou cria uma nova
async function createRoom(request, env) {
  const url = new URL(request.url);
  let body = {};
  try {
    body = await request.json();
  } catch {}

  let code = null;
  let hostToken = null;
  if (CODE_RE.test(body?.code) && typeof body?.hostToken === 'string') {
    const r = await post(roomStub(env, body.code), '/resume', { hostToken: body.hostToken });
    if (r.ok) ({ code, hostToken } = body);
  }
  for (let tries = 0; !code && tries < 20; tries++) {
    const c = newCode();
    const r = await post(roomStub(env, c), '/init', { code: c });
    if (r.ok) {
      code = c;
      ({ hostToken } = await r.json());
    }
  }
  if (!code) return Response.json({ error: 'Não foi possível criar a sala.' }, { status: 503 });

  const joinUrl = `${url.origin}/join/${code}`;
  const svg = await QRCode.toString(joinUrl, { type: 'svg', margin: 1 });
  const qr = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return Response.json({ code, hostToken, joinUrl, qr }, { headers: { 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/rooms') {
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
      return createRoom(request, env);
    }

    const ws = url.pathname.match(/^\/ws\/([A-Z]{4})$/);
    if (ws) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      return roomStub(env, ws[1]).fetch(request);
    }

    // link do QR code: mesma página do jogador (play.js lê o código da URL)
    if (/^\/join\/[A-Za-z]{4}\/?$/.test(url.pathname)) {
      return env.ASSETS.fetch(new Request(new URL('/play', url), request));
    }

    return env.ASSETS.fetch(request);
  },
};
