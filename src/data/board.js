// Spielplan-Daten: Städte, Strecken, Felder (laut Grafik-Briefing: 43 Felder, davon 9 Ereignisfelder).
import { project } from '../js/projection.js';

export const START_CITY = 'MU';

export const CITIES = {
  GL: { id: 'GL', name: 'Glasgow', lon: -4.25, lat: 55.86, style: 'Glasgow Style', country: 'Schottland', note: 'Geradlinig und streng, Vorbild für die Wiener Secession', label: 'left' },
  RI: { id: 'RI', name: 'Riga', lon: 24.11, lat: 56.95, style: 'Jūgendstils', country: 'Lettland', note: 'Etwa ein Drittel der Innenstadtbauten im Jugendstil', label: 'right' },
  BR: { id: 'BR', name: 'Brüssel', lon: 4.35, lat: 50.85, style: 'Art Nouveau', country: 'Belgien', note: 'Geburtsort des Art Nouveau in der Architektur', label: 'left' },
  DA: { id: 'DA', name: 'Darmstadt', lon: 8.65, lat: 49.87, style: 'Künstlerkolonie Mathildenhöhe', country: 'Deutschland', note: 'UNESCO-Welterbe seit 2021', label: 'below' },
  PA: { id: 'PA', name: 'Paris', lon: 2.35, lat: 48.86, style: 'Art Nouveau', country: 'Frankreich', note: 'Die Weltausstellung 1900 machte den Stil international bekannt', label: 'left' },
  MU: { id: 'MU', name: 'München', lon: 11.58, lat: 48.14, style: 'Münchner Jugendstil', country: 'Deutschland', note: 'Startstadt · Namensgeber durch die Zeitschrift „Jugend“ (ab 1896)', label: 'below' },
  WI: { id: 'WI', name: 'Wien', lon: 16.37, lat: 48.21, style: 'Wiener Secession', country: 'Österreich', note: 'Strenger, geometrischer Zweig des Jugendstils', label: 'below' },
  BA: { id: 'BA', name: 'Barcelona', lon: 2.17, lat: 41.39, style: 'Modernisme', country: 'Spanien', note: 'Katalanische Variante des Jugendstils', label: 'below' },
};
export const CITY_ORDER = ['MU', 'WI', 'BR', 'PA', 'BA', 'GL', 'DA', 'RI'];

// [von, nach, Anzahl Felder, Positionen der Ereignisfelder (1-basiert ab "von")]
const ROUTES = [
  ['GL', 'BR', 6, [3]],
  ['BR', 'PA', 2, []],
  ['BR', 'DA', 2, []],
  ['PA', 'BA', 6, [2, 5]],
  ['BA', 'MU', 7, [2, 5]],
  ['DA', 'MU', 2, []],
  ['DA', 'RI', 9, [3, 7]],
  ['MU', 'WI', 2, []],
  ['WI', 'RI', 7, [3, 5]],
];
export const SHIP = { from: 'GL', to: 'RI' };

// Knoten: Städte und Streckenfelder
export const NODES = {};
export const ADJ = {};
export const ROUTE_LIST = [];

for (const c of Object.values(CITIES)) {
  const [x, y] = project(c.lon, c.lat);
  c.x = x; c.y = y;
  NODES[c.id] = { id: c.id, type: 'city', x, y };
  ADJ[c.id] = [];
}

function link(a, b) { ADJ[a].push(b); ADJ[b].push(a); }

ROUTES.forEach(([a, b, n, events], ri) => {
  const A = NODES[a], B = NODES[b];
  const ids = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const id = `${a}${b}${i}`;
    NODES[id] = { id, type: events.includes(i) ? 'event' : 'field', x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, route: ri };
    ADJ[id] = [];
    ids.push(id);
  }
  const chain = [a, ...ids, b];
  for (let i = 0; i < chain.length - 1; i++) link(chain[i], chain[i + 1]);
  ROUTE_LIST.push({ from: a, to: b, fields: ids });
});

export function isCity(id) { return !!CITIES[id]; }

// Kürzester Weg (BFS) – liefert Knotenliste ohne Start
export function shortestPath(from, to) {
  const prev = { [from]: null };
  const q = [from];
  while (q.length) {
    const n = q.shift();
    if (n === to) break;
    for (const m of ADJ[n]) if (!(m in prev)) { prev[m] = n; q.push(m); }
  }
  if (!(to in prev)) return [];
  const path = [];
  for (let n = to; n !== from; n = prev[n]) path.unshift(n);
  return path;
}

// Alle Zielknoten bei genau `steps` Schritten ohne Umkehren; an Städten muss angehalten werden.
// cameFrom: Knoten, von dem der Spieler zuletzt kam (Umkehr im selben Zug verboten).
// Liefert Map ziel -> Pfad
export function reachable(start, steps, { stopAtCities = true, citiesOnly = false } = {}) {
  const result = new Map();
  function walk(node, prev, left, path) {
    if (path.length && isCity(node) && stopAtCities) { if (!result.has(node)) result.set(node, path); return; }
    if (left === 0) { if (!citiesOnly && !result.has(node)) result.set(node, path); return; }
    for (const m of ADJ[node]) {
      if (m === prev) continue;
      walk(m, node, left - 1, [...path, m]);
    }
  }
  walk(start, null, steps, []);
  return result;
}

// Bis zur nächsten Stadt (Nachtzug)
export function nextCities(start) {
  const result = new Map();
  for (const first of ADJ[start]) {
    let prev = start, node = first; const path = [first];
    while (!isCity(node)) {
      const nxt = ADJ[node].find(m => m !== prev);
      prev = node; node = nxt; path.push(node);
    }
    if (!result.has(node)) result.set(node, path);
  }
  return result;
}

export function shipAvailableFrom(city) {
  return city === SHIP.from ? SHIP.to : city === SHIP.to ? SHIP.from : null;
}
