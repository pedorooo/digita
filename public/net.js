// Conexão WebSocket com uma sala (Durable Object em /ws/<CÓDIGO>).
// API parecida com a do Socket.IO: socket.on(evento, fn) e socket.emit(evento, dados, ack).
// Reconecta sozinho (com espera crescente) e dispara 'connect' a cada conexão aberta.
// Mensagens emitidas sem conexão são descartadas; quem precisa reenviar algo faz isso no 'connect'.
window.Net = {
  socket() {
    const handlers = {};
    const acks = new Map();
    let ws = null;
    let room = null;
    let stopped = true;
    let retry = 0;
    let retryTimer = null;
    let nextAck = 1;
    const fire = (e, d) => (handlers[e] || []).forEach((fn) => fn(d));

    function open() {
      clearTimeout(retryTimer);
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const w = new WebSocket(`${proto}//${location.host}/ws/${room}`);
      ws = w;
      let ping = null;
      w.onopen = () => {
        retry = 0;
        // mantém a conexão viva enquanto ninguém faz nada (lobby, revisão…)
        ping = setInterval(() => w.readyState === 1 && w.send('{"e":"ping"}'), 25000);
        fire('connect');
      };
      w.onmessage = (ev) => {
        let m;
        try {
          m = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (m.ack) {
          const fn = acks.get(m.ack);
          acks.delete(m.ack);
          if (fn) fn(m.d);
        } else fire(m.e, m.d);
      };
      w.onclose = (ev) => {
        clearInterval(ping);
        if (ws !== w) return; // conexão antiga, já substituída
        ws = null;
        acks.clear();
        fire('disconnect', ev.code);
        // códigos >= 4000 vêm do servidor: sala fechada, aba substituída… não adianta tentar de novo
        if (stopped || ev.code >= 4000) return;
        retryTimer = setTimeout(open, Math.min(5000, 400 * 2 ** retry++));
      };
    }

    return {
      get room() {
        return room;
      },
      get connected() {
        return !!ws && ws.readyState === 1;
      },
      on(e, fn) {
        (handlers[e] ||= []).push(fn);
      },
      emit(e, d, ack) {
        if (!ws || ws.readyState !== 1) return false;
        const m = { e, d };
        if (ack) {
          m.ack = nextAck++;
          acks.set(m.ack, ack);
        }
        ws.send(JSON.stringify(m));
        return true;
      },
      connect(code) {
        this.disconnect();
        room = code;
        stopped = false;
        retry = 0;
        open();
      },
      disconnect() {
        stopped = true;
        clearTimeout(retryTimer);
        const w = ws;
        ws = null;
        acks.clear();
        if (w) w.close();
      },
    };
  },
};
