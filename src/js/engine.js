// =====================================================================
//  Spiellogik Grand Tour 1900
//  Der Zustand (state) ist ein reines JSON-Objekt. Im Online-Modus läuft
//  die Logik nur beim Gastgeber; die anderen bekommen den Zustand geschickt.
// =====================================================================
import { CITIES, CITY_ORDER, NODES, ADJ, START_CITY, isCity, reachable, nextCities, shortestPath, shipAvailableFrom } from '../data/board.js';
import { BUILDINGS, QUESTIONS, EVENT_QUESTIONS, EVENTS } from '../data/content.js';

export const QUIZ_TIME = 30000;
export const DUEL_TIME = 20000;
export const PLAYER_COLORS = ['#A4502F', '#3E6F86', '#5E7A5A', '#9A7630'];

const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function questionById(qid) {
  const [city, i] = qid.split('-');
  return { city, ...QUESTIONS[city][+i] };
}
export function cityBuildings(city) { return Object.entries(BUILDINGS).filter(([, b]) => b.city === city).map(([id]) => id); }
export function cardImage(card) { return card.b || cityBuildings(card.city)[0]; }

export function createGame(names, { online = false } = {}) {
  const decks = {};
  for (const c of CITY_ORDER) decks[c] = shuffle(QUESTIONS[c].map((_, i) => `${c}-${i}`));
  return {
    online,
    players: names.map((name, i) => ({
      id: i, name, color: PLAYER_COLORS[i], pos: START_CITY, from: null,
      cards: [], blockedCity: null, examined: [], skip: false, atSea: null,
    })),
    current: 0,
    turn: 1,
    phase: 'turn',
    mustRoll: false,
    dice: null,
    decks,
    eventDeck: shuffle(EVENTS.map(e => e.id)),
    shipBlockedBy: null,
    pending: null,
    log: [`Die Grand Tour beginnt in München! ${names[0]} ist am Zug.`],
    winner: null,
    seq: 0,
  };
}

// ---------- Hilfsfunktionen ----------
const P = (s, i = s.current) => s.players[i];
const log = (s, msg) => { s.log.push(msg); if (s.log.length > 60) s.log.shift(); };
export const hasCard = (p, city) => p.cards.some(c => c.city === city);
export const citiesCollected = p => new Set(p.cards.map(c => c.city)).size;

export function canExam(s, p, city = p.pos) {
  return isCity(city) && s.decks[city].length > 0 && p.blockedCity !== city;
}

// Wer darf gerade handeln?
export function actors(s) {
  if (s.phase === 'gameOver') return [];
  const pd = s.pending;
  if (s.phase === 'duel') return pd.winner == null && !pd.timedOut ? [pd.a, pd.b].filter(i => !pd.locked.includes(i)) : [s.current];
  if (s.phase === 'move' && pd?.player != null) return [pd.player];
  if (s.phase === 'quiz' || s.phase === 'quizResult') return [pd.player];
  return [s.current];
}

export function availableActions(s) {
  const p = P(s);
  if (s.phase !== 'turn') return {};
  if (p.atSea) return { arrive: true };
  return {
    roll: true,
    exam: !s.mustRoll && canExam(s, p),
    ship: !s.mustRoll && !!shipAvailableFrom(p.pos) && s.shipBlockedBy == null,
  };
}

// ---------- Ablauf ----------
function nextTurn(s) {
  s.pending = null; s.dice = null; s.mustRoll = false;
  for (let k = 0; k < s.players.length; k++) {
    s.current = (s.current + 1) % s.players.length;
    if (s.current === 0) s.turn++;
    const p = P(s);
    if (s.shipBlockedBy === s.current) { s.shipBlockedBy = null; log(s, 'Der Sturm über der Nordsee hat sich gelegt.'); }
    if (p.skip) { p.skip = false; log(s, `${p.name} setzt wegen des Bahnstreiks aus.`); continue; }
    break;
  }
  s.phase = 'turn';
  log(s, `${P(s).name} ist am Zug.`);
}

function checkWin(s, p) {
  if (citiesCollected(p) === CITY_ORDER.length) {
    s.winner = p.id; s.phase = 'gameOver'; s.pending = null;
    log(s, `${p.name} hat Postkarten aus allen acht Städten – die Grand Tour ist vollendet!`);
    return true;
  }
  return false;
}

function setPos(s, p, node, from) {
  if (isCity(node) && node !== p.blockedCity) p.blockedCity = null;
  p.from = from; p.pos = node;
}

// Ankunft in einer Stadt (für den aktiven Spieler)
function arriveCity(s, p, city) {
  if (!canExam(s, p, city)) {
    if (s.decks[city].length === 0) log(s, `In ${CITIES[city].name} gibt es keine Postkarten mehr.`);
    return nextTurn(s);
  }
  if (!hasCard(p, city)) return startCityQuiz(s, p, city);
  s.phase = 'offer'; s.pending = { player: p.id, city };
}

function startCityQuiz(s, p, city) {
  const qid = s.decks[city].shift();
  const q = questionById(qid);
  const options = shuffle([q.a, ...q.w]);
  if (!p.examined.includes(city)) p.examined.push(city);
  s.phase = 'quiz';
  s.pending = { kind: 'city', player: p.id, city, qid, b: q.b, question: q.q, options, correct: options.indexOf(q.a), info: q.info, deadline: Date.now() + QUIZ_TIME, answer: null };
  log(s, `${p.name} legt in ${CITIES[city].name} die Prüfung ab.`);
}

function startEventQuiz(s, p, kind, extra = {}) {
  let q;
  if (kind === 'material') q = materialQuestion();
  else { const pool = EVENT_QUESTIONS[kind]; q = pool[rnd(pool.length)]; }
  const options = shuffle([q.a, ...q.w]);
  s.phase = 'quiz';
  s.pending = { kind, player: p.id, question: q.q, options, correct: options.indexOf(q.a), info: q.info || '', b: q.b || null, deadline: Date.now() + QUIZ_TIME, answer: null, ...extra };
}

function materialQuestion() {
  const all = Object.entries(BUILDINGS);
  const yes = all.filter(([, b]) => b.m === 'eisenglas');
  const no = all.filter(([, b]) => b.m !== 'eisenglas' && !b.historic);
  const [id, b] = yes[rnd(yes.length)];
  const label = b2 => `${b2.name} (${CITIES[b2.city].name})`;
  return { q: 'Welches dieser Bauwerke zeigt sichtbares Eisen und Glas?', a: label(b), w: shuffle(no).slice(0, 3).map(([, x]) => label(x)), b: id, info: `${b.name} von ${b.architect}.` };
}

function startMove(s, playerId, targets, kind, after = null) {
  const t = {};
  for (const [node, path] of targets) t[node] = path;
  if (!Object.keys(t).length) { log(s, 'Kein Weg möglich.'); return finishAfterMove(s, P(s, playerId), null, kind, after); }
  s.phase = 'move';
  s.pending = { player: playerId, kind, targets: t, after };
}

function landOn(s, p, node, kind, after) {
  if (kind !== 'dice') return finishAfterMove(s, p, node, kind, after);
  if (isCity(node)) return arriveCity(s, p, node);
  if (NODES[node].type === 'event') return drawEvent(s, p);
  const others = s.players.filter(o => o.id !== p.id && o.pos === node && !o.atSea);
  if (others.length) return startDuel(s, p.id, others[0].id, 1);
  nextTurn(s);
}

function finishAfterMove(s, p, node, kind, after) {
  if (node && isCity(node) && p.id === s.current) return arriveCity(s, p, node);
  nextTurn(s);
}

// Automatischer Zug Richtung Ziel (Ereigniskarten)
function moveToward(s, p, target, steps) {
  if (p.atSea || p.pos === target) return;
  const path = shortestPath(p.pos, target);
  let prev = p.pos, node = p.pos;
  for (let i = 0; i < steps && i < path.length; i++) {
    prev = node; node = path[i];
    if (isCity(node)) break;
  }
  setPos(s, p, node, prev);
}

// ---------- Ereignisse ----------
function drawEvent(s, p) {
  if (!s.eventDeck.length) s.eventDeck = shuffle(EVENTS.map(e => e.id));
  const id = s.eventDeck.shift();
  s.eventDeck.push(id);
  s.phase = 'event';
  s.pending = { player: p.id, event: id };
  log(s, `${p.name} zieht die Ereigniskarte „${EVENTS.find(e => e.id === id).title}“.`);
}

function resolveEvent(s, p, id, extra) {
  switch (id) {
    case 'weltausstellung':
      setPos(s, p, 'PA', null);
      return arriveCity(s, p, 'PA');
    case 'secession':
      moveToward(s, p, 'WI', 2);
      return isCity(p.pos) ? arriveCity(s, p, p.pos) : nextTurn(s);
    case 'streik':
      p.skip = true; return nextTurn(s);
    case 'historismus':
      return startEventQuiz(s, p, 'historismus');
    case 'kaffeehaus':
      s.phase = 'turn'; s.pending = null; s.mustRoll = true; return;
    case 'jugend':
      return startEventQuiz(s, p, 'jugend');
    case 'nachtzug': {
      const opts = new Map([...nextCities(p.pos)].filter(([, path]) => path[0] !== p.from || ADJ[p.pos].length === 1));
      return startMove(s, p.id, opts.size ? opts : nextCities(p.pos), 'bonus');
    }
    case 'mathildenhoehe':
      for (const o of s.players) moveToward(s, o, 'DA', 1);
      return isCity(p.pos) ? arriveCity(s, p, p.pos) : nextTurn(s);
    case 'sturm':
      s.shipBlockedBy = p.id; return nextTurn(s);
    case 'maezen': {
      const opts = p.examined.filter(c => s.decks[c].length);
      const pref = opts.filter(c => !hasCard(p, c));
      const pool = pref.length ? pref : opts;
      if (!pool.length) { log(s, `${p.name} wurde noch nirgends geprüft – der Mäzen zieht weiter.`); return nextTurn(s); }
      const city = pool[rnd(pool.length)];
      gainCard(s, p, s.decks[city].shift(), city);
      log(s, `Der Mäzen schenkt ${p.name} eine Postkarte aus ${CITIES[city].name}.`);
      return checkWin(s, p) || nextTurn(s);
    }
    case 'material':
      return startEventQuiz(s, p, 'material', { round: 1, score: 0 });
    case 'duell': {
      if (!s.players.some(o => o.id !== p.id && !o.atSea)) { log(s, 'Niemand ist für ein Duell erreichbar.'); return nextTurn(s); }
      s.phase = 'chooseOpponent'; s.pending = { player: p.id };
      return;
    }
  }
  nextTurn(s);
}

function gainCard(s, p, qid, city) {
  const q = questionById(qid);
  p.cards.push({ qid, city, b: q.b });
  p.blockedCity = city;
}

function loseCard(s, p) {
  if (!p.cards.length) { log(s, `${p.name} hat noch keine Karte zum Abgeben.`); return; }
  // zuerst doppelte Städte abgeben, sonst die zuletzt erhaltene
  const counts = {};
  p.cards.forEach(c => counts[c.city] = (counts[c.city] || 0) + 1);
  let idx = p.cards.findIndex(c => counts[c.city] > 1);
  if (idx < 0) idx = p.cards.length - 1;
  const [card] = p.cards.splice(idx, 1);
  s.decks[card.city].push(card.qid);
  log(s, `${p.name} muss die Postkarte aus ${CITIES[card.city].name} abgeben.`);
}

// ---------- Duell ----------
function startDuel(s, a, b, reward) {
  const ids = Object.keys(BUILDINGS);
  const bid = ids[rnd(ids.length)];
  const right = BUILDINGS[bid].city;
  const options = shuffle([right, ...shuffle(CITY_ORDER.filter(c => c !== right)).slice(0, 3)]);
  s.phase = 'duel';
  s.pending = { a, b, reward, building: bid, options, correct: options.indexOf(right), locked: [], answers: {}, winner: null, timedOut: false, deadline: Date.now() + DUEL_TIME };
  log(s, `Duell! ${P(s, a).name} fordert ${P(s, b).name} heraus.`);
}

// ---------- Aktionen ----------
// actor: Spielerindex oder '*' (lokales Spiel: ein Bildschirm für alle)
export function dispatch(s, action, actor = '*') {
  if (s.phase === 'gameOver') return 'Spiel ist beendet';
  if (actor !== '*' && action.type !== 'DUEL_ANSWER' && !actors(s).includes(actor)) return 'Nicht am Zug';
  const p = P(s);
  const pd = s.pending;
  s.seq++;

  switch (action.type) {
    case 'ROLL': {
      if (s.phase !== 'turn' || p.atSea) return 'Ungültig';
      s.mustRoll = false;
      s.dice = 1 + rnd(6);
      log(s, `${p.name} würfelt eine ${s.dice}.`);
      return startMove(s, p.id, reachable(p.pos, s.dice), 'dice');
    }
    case 'CHOOSE': {
      if (s.phase !== 'move' || !pd.targets[action.node]) return 'Ungültiges Ziel';
      const mover = P(s, pd.player);
      const path = pd.targets[action.node];
      setPos(s, mover, action.node, path.length > 1 ? path[path.length - 2] : mover.pos);
      return landOn(s, mover, action.node, pd.kind, pd.after);
    }
    case 'EXAM': {
      if (s.phase === 'offer') { return startCityQuiz(s, p, pd.city); }
      if (s.phase !== 'turn' || !canExam(s, p)) return 'Ungültig';
      return startCityQuiz(s, p, p.pos);
    }
    case 'SKIP_EXAM': {
      if (s.phase !== 'offer') return 'Ungültig';
      return nextTurn(s);
    }
    case 'SHIP': {
      const dest = shipAvailableFrom(p.pos);
      if (s.phase !== 'turn' || !dest || s.shipBlockedBy != null) return 'Ungültig';
      p.atSea = dest; p.from = p.pos; p.pos = 'SEA';
      log(s, `${p.name} besteigt das Dampfschiff nach ${CITIES[dest].name}.`);
      return nextTurn(s);
    }
    case 'ARRIVE': {
      if (s.phase !== 'turn' || !p.atSea) return 'Ungültig';
      const city = p.atSea; p.atSea = null;
      setPos(s, p, city, null);
      log(s, `${p.name} legt in ${CITIES[city].name} an.`);
      return arriveCity(s, p, city);
    }
    case 'ANSWER':
    case 'TIMEOUT': {
      if (s.phase !== 'quiz') return 'Ungültig';
      if (action.type === 'TIMEOUT' && Date.now() < pd.deadline - 1500) return 'Zu früh';
      pd.answer = action.type === 'TIMEOUT' ? -1 : action.index;
      pd.right = pd.answer === pd.correct;
      s.phase = 'quizResult';
      const qp = P(s, pd.player);
      if (pd.kind === 'city') {
        if (pd.right) { gainCard(s, qp, pd.qid, pd.city); log(s, `Richtig! ${qp.name} erhält eine Postkarte aus ${CITIES[pd.city].name}.`); }
        else { s.decks[pd.city].push(pd.qid); log(s, `Leider falsch – ${qp.name} darf es nächste Runde erneut versuchen.`); }
      } else if (pd.kind === 'material') {
        if (pd.right) pd.score++;
      }
      return;
    }
    case 'CONTINUE': {
      if (s.phase === 'event') return resolveEvent(s, P(s, pd.player), pd.event);
      if (s.phase === 'quizResult') {
        const qp = P(s, pd.player);
        if (pd.kind === 'city') return checkWin(s, qp) || nextTurn(s);
        if (pd.kind === 'historismus') { if (!pd.right) loseCard(s, qp); return nextTurn(s); }
        if (pd.kind === 'jugend') {
          if (pd.right) { log(s, `${qp.name} darf 3 Felder vorziehen.`); return startMove(s, qp.id, reachable(qp.pos, 3), 'bonus'); }
          return nextTurn(s);
        }
        if (pd.kind === 'material') {
          if (pd.round === 1) return startEventQuiz(s, qp, 'material', { round: 2, score: pd.score });
          if (pd.score > 0) { log(s, `${qp.name} darf ${pd.score} Feld(er) vorziehen.`); return startMove(s, qp.id, reachable(qp.pos, pd.score), 'bonus'); }
          return nextTurn(s);
        }
      }
      if (s.phase === 'duel' && (pd.winner != null || pd.timedOut)) {
        if (pd.winner != null) {
          const w = P(s, pd.winner);
          if (w.atSea) return nextTurn(s);
          return startMove(s, w.id, reachable(w.pos, pd.reward), 'bonus');
        }
        return nextTurn(s);
      }
      return 'Ungültig';
    }
    case 'CHOOSE_OPPONENT': {
      if (s.phase !== 'chooseOpponent' || action.player === p.id || !s.players[action.player] || s.players[action.player].atSea) return 'Ungültig';
      return startDuel(s, p.id, action.player, 2);
    }
    case 'DUEL_ANSWER': {
      if (s.phase !== 'duel' || pd.winner != null || pd.timedOut) return 'Ungültig';
      const who = action.player;
      if (who !== pd.a && who !== pd.b) return 'Nicht im Duell';
      if (actor !== '*' && actor !== who) return 'Nicht erlaubt';
      if (pd.locked.includes(who)) return 'Gesperrt';
      pd.answers[who] = action.index;
      if (action.index === pd.correct) {
        pd.winner = who;
        log(s, `${P(s, who).name} gewinnt das Duell (${CITIES[pd.options[pd.correct]].name}) und darf ${pd.reward} Feld(er) vor.`);
      } else {
        pd.locked.push(who);
        if (pd.locked.length === 2) { pd.timedOut = true; log(s, 'Beide lagen falsch – niemand gewinnt das Duell.'); }
      }
      return;
    }
    case 'DUEL_TIMEOUT': {
      if (s.phase !== 'duel' || pd.winner != null || pd.timedOut || Date.now() < pd.deadline - 1500) return 'Ungültig';
      pd.timedOut = true; log(s, 'Die Zeit ist um – niemand gewinnt das Duell.');
      return;
    }
  }
  return 'Unbekannte Aktion';
}
