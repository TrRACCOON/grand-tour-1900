// Spielt viele zufällige Partien durch und prüft, dass die Spiellogik nie hängen bleibt.
// Aufruf: node tools/simulate.mjs [Anzahl]
import { createGame, dispatch, availableActions } from '../src/js/engine.js';
import { QUESTIONS, BUILDINGS } from '../src/data/content.js';
import { CITY_ORDER } from '../src/data/board.js';

// Datenprüfung
let problems = 0;
for (const c of CITY_ORDER) {
  if (QUESTIONS[c].length !== 12) { console.error(`${c}: ${QUESTIONS[c].length} statt 12 Fragen`); problems++; }
  QUESTIONS[c].forEach((q, i) => {
    if (q.w.length !== 3) { console.error(`${c}-${i}: braucht 3 falsche Antworten`); problems++; }
    if (q.b && (!BUILDINGS[q.b] || BUILDINGS[q.b].city !== c)) { console.error(`${c}-${i}: Gebäude ${q.b} fehlt/falsche Stadt`); problems++; }
    if (new Set([q.a, ...q.w]).size !== 4) { console.error(`${c}-${i}: doppelte Antwort`); problems++; }
  });
}

const N = +process.argv[2] || 300;
const pick = a => a[Math.floor(Math.random() * a.length)];
let turnsTotal = 0, maxTurns = 0, stuck = 0;
const eventsSeen = new Set();

for (let g = 0; g < N; g++) {
  const n = 2 + (g % 3);
  const s = createGame(Array.from({ length: n }, (_, i) => `P${i}`));
  let steps = 0;
  while (s.phase !== 'gameOver' && steps < 20000) {
    steps++;
    const pd = s.pending;
    let a;
    switch (s.phase) {
      case 'turn': {
        const av = availableActions(s);
        const opts = Object.keys(av).filter(k => av[k]);
        const k = av.exam && Math.random() < 0.8 ? 'exam' : pick(opts);
        a = { type: { roll: 'ROLL', exam: 'EXAM', ship: 'SHIP', arrive: 'ARRIVE' }[k] };
        break;
      }
      case 'move': a = { type: 'CHOOSE', node: pick(Object.keys(pd.targets)) }; break;
      case 'quiz': a = Math.random() < 0.05 ? { type: 'TIMEOUT' } : { type: 'ANSWER', index: Math.random() < 0.6 ? pd.correct : (pd.correct + 1) % 4 }; if (a.type === 'TIMEOUT') pd.deadline = 0; break;
      case 'quizResult': a = { type: 'CONTINUE' }; break;
      case 'event': eventsSeen.add(pd.event); a = { type: 'CONTINUE' }; break;
      case 'offer': a = { type: Math.random() < 0.5 ? 'EXAM' : 'SKIP_EXAM' }; break;
      case 'chooseOpponent': a = { type: 'CHOOSE_OPPONENT', player: pick(s.players.filter(p => p.id !== pd.player && !p.atSea)).id }; break;
      case 'duel':
        if (pd.winner != null || pd.timedOut) a = { type: 'CONTINUE' };
        else a = { type: 'DUEL_ANSWER', player: pick([pd.a, pd.b].filter(x => !pd.locked.includes(x))), index: Math.floor(Math.random() * 4) };
        break;
      default: throw new Error('Unbekannte Phase ' + s.phase);
    }
    const err = dispatch(s, a, '*');
    if (typeof err === 'string' && !['Zu früh'].includes(err)) throw new Error(`Spiel ${g}, Phase ${s.phase}: ${err} bei ${JSON.stringify(a)}`);
  }
  if (s.phase !== 'gameOver') stuck++;
  turnsTotal += s.turn; maxTurns = Math.max(maxTurns, s.turn);
}
console.log(`${N} Partien: ${stuck} hängen geblieben, Ø ${(turnsTotal / N).toFixed(1)} Runden (max ${maxTurns}), Ereignisse gesehen: ${eventsSeen.size}/12, Datenprobleme: ${problems}`);
if (stuck || problems) process.exit(1);
