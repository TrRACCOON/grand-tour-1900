// Online-Modus über PeerJS (direkte Verbindung zwischen den Rechnern).
// Der Gastgeber führt die Spiellogik aus und verschickt den Zustand an alle.
/* global Peer */
const PREFIX = 'grandtour1900-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

export class Host {
  constructor(name, { onLobby, onAction, onError, onReady }) {
    this.players = [{ name, conn: null, online: true }];
    this.cb = { onLobby, onAction, onError, onReady };
    this.started = false;
    this.open(0);
  }
  open(tries) {
    this.code = newCode();
    this.peer = new Peer(PREFIX + this.code);
    this.peer.on('open', () => this.cb.onReady(this.code));
    this.peer.on('error', e => {
      if (e.type === 'unavailable-id' && tries < 3) { this.peer.destroy(); return this.open(tries + 1); }
      this.cb.onError(netError(e));
    });
    this.peer.on('connection', conn => this.accept(conn));
  }
  accept(conn) {
    conn.on('data', msg => {
      if (msg.t === 'hello') {
        // Wiederverbinden mit gleichem Namen erlaubt
        let id = this.players.findIndex(p => p.name === msg.name && !p.online);
        if (id < 0) {
          if (this.started) return conn.send({ t: 'error', msg: 'Das Spiel hat schon begonnen.' });
          if (this.players.length >= 4) return conn.send({ t: 'error', msg: 'Das Spiel ist voll (4 Spieler).' });
          if (this.players.some(p => p.name === msg.name)) return conn.send({ t: 'error', msg: 'Dieser Name ist schon vergeben.' });
          id = this.players.push({ name: msg.name }) - 1;
        }
        Object.assign(this.players[id], { conn, online: true });
        conn.playerId = id;
        conn.send({ t: 'welcome', id });
        this.cb.onLobby(this.lobby());
        this.broadcast({ t: 'lobby', players: this.lobby() });
        if (this.started && this.lastState) conn.send({ t: 'state', state: this.lastState });
      } else if (msg.t === 'action' && conn.playerId != null) {
        const err = this.cb.onAction(msg.action, conn.playerId);
        if (typeof err === 'string') conn.send({ t: 'error', msg: err });
      }
    });
    conn.on('close', () => {
      if (conn.playerId == null) return;
      const p = this.players[conn.playerId];
      if (p.conn === conn) { p.online = false; if (!this.started) this.players.splice(conn.playerId, 1); this.reindex(); }
      this.cb.onLobby(this.lobby());
      this.broadcast({ t: 'lobby', players: this.lobby() });
    });
  }
  reindex() { if (!this.started) this.players.forEach((p, i) => { if (p.conn) { p.conn.playerId = i; p.conn.send({ t: 'welcome', id: i }); } }); }
  lobby() { return this.players.map(p => ({ name: p.name, online: p.online !== false })); }
  broadcast(msg) { for (const p of this.players) if (p.conn?.open) p.conn.send(msg); }
  sendState(state) { this.lastState = state; this.broadcast({ t: 'state', state }); }
  close() { this.peer?.destroy(); }
}

export class Client {
  constructor(code, name, { onWelcome, onLobby, onState, onError, onClose }) {
    this.peer = new Peer();
    this.peer.on('error', e => onError(netError(e)));
    this.peer.on('open', () => {
      this.conn = this.peer.connect(PREFIX + code.trim().toUpperCase(), { reliable: true });
      this.conn.on('open', () => this.conn.send({ t: 'hello', name }));
      this.conn.on('data', msg => {
        if (msg.t === 'welcome') { this.id = msg.id; onWelcome(msg.id); }
        else if (msg.t === 'lobby') onLobby(msg.players);
        else if (msg.t === 'state') onState(msg.state);
        else if (msg.t === 'error') onError(msg.msg);
      });
      this.conn.on('close', () => onClose());
    });
  }
  send(action) { this.conn?.send({ t: 'action', action }); }
  close() { this.peer?.destroy(); }
}

function netError(e) {
  const map = {
    'peer-unavailable': 'Kein Spiel mit diesem Code gefunden.',
    network: 'Keine Verbindung zum Vermittlungsserver. Bist du online?',
    'server-error': 'Der Vermittlungsserver ist gerade nicht erreichbar.',
    'browser-incompatible': 'Online-Modus wird nicht unterstützt.',
  };
  return map[e.type] || `Verbindungsfehler: ${e.message || e.type}`;
}
