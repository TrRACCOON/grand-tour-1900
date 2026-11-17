// Erzeugt src/data/europe.js: Landflächen (Natural Earth 1:50m) als SVG-Pfad
// in vereinfachter Plattkarte (Bezugsbreite 49° N), Ausschnitt 10° W – 28° O, 40° N – 58° N.
// Aufruf: npm run build:map
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { PROJ, project } from '../src/js/projection.js';

const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-50m.json', import.meta.url)));
const land = feature(topo, topo.objects.land);

const PAD = 3; // Grad Puffer ausserhalb des Ausschnitts
function inView([lon, lat]) {
  return lon > PROJ.lonMin - PAD && lon < PROJ.lonMax + PAD && lat > PROJ.latMin - PAD && lat < PROJ.latMax + PAD;
}

let d = '';
const polys = land.features.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
for (const poly of polys) {
  for (const ring of poly) {
    if (!ring.some(inView)) continue;
    // Ringe auf den sichtbaren Bereich (+Puffer) zuschneiden, damit der Pfad klein bleibt
    const pts = ring.map(([lon, lat]) => [
      Math.max(PROJ.lonMin - PAD, Math.min(PROJ.lonMax + PAD, lon)),
      Math.max(PROJ.latMin - PAD, Math.min(PROJ.latMax + PAD, lat)),
    ]);
    let last = null;
    let seg = '';
    for (const p of pts) {
      const [x, y] = project(p[0], p[1]);
      const key = `${x.toFixed(1)},${y.toFixed(1)}`;
      if (key === last) continue;
      seg += (seg ? 'L' : 'M') + key;
      last = key;
    }
    if (seg.split('L').length > 3) d += seg + 'Z';
  }
}

writeFileSync(new URL('../src/data/europe.js', import.meta.url),
  `// Automatisch erzeugt von tools/build-map.mjs – nicht von Hand bearbeiten.\n` +
  `// Küstenbasis: Natural Earth (gemeinfrei), via world-atlas.\n` +
  `export const LAND_PATH = ${JSON.stringify(d)};\n`);
console.log('europe.js geschrieben,', d.length, 'Zeichen');
