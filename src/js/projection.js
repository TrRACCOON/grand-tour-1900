// Vereinfachte Plattkarte mit Bezugsbreite 49° N (siehe Grafik-Briefing).
// Spielplan-Koordinaten: 1414 x 1000 (Seitenverhältnis A2 quer).
export const BOARD_W = 1414;
export const BOARD_H = 1000;

// Kartenfenster innerhalb des Ornamentrahmens
export const MAP_X = 60;
export const MAP_Y = 60;
export const MAP_W = BOARD_W - 120;
export const MAP_H = BOARD_H - 120;

export const PROJ = { lonMin: -10, lonMax: 28, latMin: 40, latMax: 58 };
const K = Math.cos((49 * Math.PI) / 180);
const spanX = (PROJ.lonMax - PROJ.lonMin) * K;
const spanY = PROJ.latMax - PROJ.latMin;
// gleichmässiger Massstab, Karte im Fenster zentriert
const SCALE = Math.min(MAP_W / spanX, MAP_H / spanY);
const OFF_X = MAP_X + (MAP_W - spanX * SCALE) / 2;
const OFF_Y = MAP_Y + (MAP_H - spanY * SCALE) / 2;

export function project(lon, lat) {
  return [OFF_X + (lon - PROJ.lonMin) * K * SCALE, OFF_Y + (PROJ.latMax - lat) * SCALE];
}
