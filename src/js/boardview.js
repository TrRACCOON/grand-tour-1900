// Zeichnet den Spielplan als SVG (Jugendstil: Pergament, Ornamentrahmen, Medaillons).
import { BOARD_W, BOARD_H, MAP_X, MAP_Y, MAP_W, MAP_H, project } from './projection.js';
import { CITIES, NODES, ROUTE_LIST, SHIP, START_CITY } from '../data/board.js';
import { LAND_PATH } from '../data/europe.js';
import { cityBuildings } from './engine.js';

const NS = 'http://www.w3.org/2000/svg';
const C = { parch: '#F4EEDF', sage: '#5E7A5A', gold: '#9A7630', terra: '#A4502F', petrol: '#3E6F86', ink: '#2B2A26' };

function shipCurve() {
  const a = CITIES[SHIP.from], b = CITIES[SHIP.to];
  const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - 25;
  return { a, b, cx, cy, d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}` };
}
export function seaPosition() {
  const { a, b, cx, cy } = shipCurve();
  const t = 0.5;
  return [(1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x, (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y];
}

// Ornament: Peitschenhieb-Ranke mit Lilie für eine Ecke (oben links, wird gespiegelt)
function corner(tx, ty, sx, sy) {
  return `<g transform="translate(${tx},${ty}) scale(${sx},${sy})">
    <path d="M8,150 C8,70 40,30 110,22 C70,40 48,70 46,120 C44,150 26,160 8,150Z" fill="${C.sage}" opacity=".85"/>
    <path d="M150,8 C70,8 30,40 22,110 C40,70 70,48 120,46 C150,44 160,26 150,8Z" fill="${C.sage}" opacity=".85"/>
    <path d="M14,210 C30,120 60,60 140,40 S230,10 260,14" fill="none" stroke="${C.gold}" stroke-width="3"/>
    <path d="M210,14 C120,30 60,60 40,140 S10,230 14,260" fill="none" stroke="${C.gold}" stroke-width="3"/>
    <g transform="translate(48,48)">
      <circle r="22" fill="${C.parch}" stroke="${C.gold}" stroke-width="3"/>
      <path d="M0,-16 C9,-6 9,6 0,14 C-9,6 -9,-6 0,-16Z" fill="${C.terra}"/>
      <path d="M-16,2 C-6,-4 4,0 12,10 C0,14 -10,10 -16,2Z" fill="${C.terra}" opacity=".8" transform="rotate(-20)"/>
      <path d="M16,2 C6,-4 -4,0 -12,10 C0,14 10,10 16,2Z" fill="${C.terra}" opacity=".8" transform="rotate(20)"/>
      <circle r="3" fill="${C.gold}"/>
    </g>
  </g>`;
}

function edgeWhiplash(horizontal, pos, len) {
  // wellenförmige Peitschenhieb-Linie entlang einer Rahmenkante
  const n = 6, step = len / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const s0 = 250 + i * step * ((len - 500) / len), s1 = s0 + step * ((len - 500) / len);
    const m = (s0 + s1) / 2, amp = i % 2 ? 9 : -9;
    d += horizontal ? `M${s0},${pos} C${m - 20},${pos + amp * 2} ${m + 20},${pos - amp} ${s1},${pos} ` : `M${pos},${s0} C${pos + amp * 2},${m - 20} ${pos - amp},${m + 20} ${pos},${s1} `;
  }
  return `<path d="${d}" fill="none" stroke="${C.gold}" stroke-width="2" opacity=".9"/>`;
}

function cityMedallion(c) {
  const img = cityBuildings(c.id)[0];
  const r = c.id === START_CITY ? 34 : 30;
  const lx = c.label === 'left' ? -r - 12 : c.label === 'right' ? r + 12 : 0;
  const ly = c.label === 'above' ? -r - 16 : c.label === 'below' ? r + 26 : 6;
  const anchor = c.label === 'left' ? 'end' : c.label === 'right' ? 'start' : 'middle';
  const w = c.name.length * 13 + 20;
  const bx = anchor === 'end' ? lx - w + 10 : anchor === 'start' ? lx - 10 : lx - w / 2;
  return `<g class="city" data-node="${c.id}" transform="translate(${c.x},${c.y})">
    <circle r="${r + 7}" fill="${C.ink}" opacity=".25" transform="translate(2,3)"/>
    <circle r="${r + 7}" fill="${C.parch}" stroke="${C.gold}" stroke-width="3"/>
    <clipPath id="clip-${c.id}"><circle r="${r}"/></clipPath>
    <image href="assets/img/${img}.jpg" x="${-r * 1.5}" y="${-r * 1.5}" width="${r * 3}" height="${r * 3}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${c.id})"/>
    <circle r="${r}" fill="none" stroke="${c.id === START_CITY ? C.gold : C.sage}" stroke-width="4"/>
    <rect x="${bx}" y="${ly - 20}" width="${w}" height="28" rx="6" fill="${C.parch}" stroke="${C.gold}" stroke-width="1.2" opacity=".95"/>
    <text x="${lx}" y="${ly}" text-anchor="${anchor}" class="city-name">${c.name}</text>
    ${c.id === START_CITY ? `<text x="${lx}" y="${ly + 22}" text-anchor="middle" class="start-label">START</text>` : ''}
    <circle class="hl" r="${r + 12}" fill="none"/>
  </g>`;
}

export function buildBoard(container) {
  const ship = shipCurve();
  const routes = ROUTE_LIST.map(r => {
    const a = CITIES[r.from], b = CITIES[r.to];
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${C.ink}" stroke-width="7" stroke-linecap="round" opacity=".75"/>
            <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${C.parch}" stroke-width="3" stroke-dasharray="10 7"/>`;
  }).join('');

  const fields = Object.values(NODES).filter(n => n.type !== 'city').map(n => n.type === 'event'
    ? `<g class="field" data-node="${n.id}" transform="translate(${n.x},${n.y})">
         <rect x="-11" y="-11" width="22" height="22" transform="rotate(45)" fill="${C.terra}" stroke="${C.ink}" stroke-width="2"/>
         <text y="5" text-anchor="middle" class="ev-mark">!</text><circle class="hl" r="20" fill="none"/></g>`
    : `<g class="field" data-node="${n.id}" transform="translate(${n.x},${n.y})">
         <circle r="11" fill="#FFFDF6" stroke="${C.ink}" stroke-width="2"/><circle class="hl" r="18" fill="none"/></g>`).join('');

  // Gradnetz als Passer (dezent)
  let grat = '';
  for (let lon = -10; lon <= 28; lon += 5) { const [x1, y1] = project(lon, 58), [x2, y2] = project(lon, 40); grat += `M${x1},${y1}L${x2},${y2}`; }
  for (let lat = 40; lat <= 58; lat += 5) { const [x1, y1] = project(-10, lat), [x2, y2] = project(28, lat); grat += `M${x1},${y1}L${x2},${y2}`; }

  const [sx, sy] = seaPosition();
  const svg = `
  <svg xmlns="${NS}" viewBox="0 0 ${BOARD_W} ${BOARD_H}" class="board-svg">
    <defs>
      <pattern id="waves" width="40" height="16" patternUnits="userSpaceOnUse">
        <path d="M0,8 C10,2 20,2 20,8 S30,14 40,8" fill="none" stroke="#2f5a6e" stroke-width="1.1" opacity=".35"/>
      </pattern>
      <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" result="n"/>
        <feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .07"/></feComponentTransfer>
        <feComposite in2="SourceGraphic" operator="in"/></filter>
      <clipPath id="mapclip"><rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_W}" height="${MAP_H}" rx="18"/></clipPath>
      <radialGradient id="vign" cx="50%" cy="50%" r="70%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#5b4520" stop-opacity=".25"/></radialGradient>
    </defs>
    <rect width="${BOARD_W}" height="${BOARD_H}" fill="#EADFC4"/>
    <rect width="${BOARD_W}" height="${BOARD_H}" filter="url(#paper)" fill="#EADFC4"/>
    <g clip-path="url(#mapclip)">
      <rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_W}" height="${MAP_H}" fill="#7FA3AE"/>
      <rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_W}" height="${MAP_H}" fill="url(#waves)"/>
      <path d="${LAND_PATH}" fill="none" stroke="#B9CFCF" stroke-width="10" stroke-linejoin="round" opacity=".6"/>
      <path d="${LAND_PATH}" fill="#EFE3C2" stroke="${C.ink}" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="${grat}" stroke="${C.gold}" stroke-width=".7" stroke-dasharray="2 6" opacity=".45" fill="none"/>
      <rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_W}" height="${MAP_H}" fill="url(#vign)"/>
    </g>
    <!-- Rahmen -->
    <rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_W}" height="${MAP_H}" rx="18" fill="none" stroke="${C.ink}" stroke-width="3"/>
    <rect x="${MAP_X - 14}" y="${MAP_Y - 14}" width="${MAP_W + 28}" height="${MAP_H + 28}" rx="26" fill="none" stroke="${C.gold}" stroke-width="2"/>
    <rect x="16" y="16" width="${BOARD_W - 32}" height="${BOARD_H - 32}" rx="30" fill="none" stroke="${C.ink}" stroke-width="2.5"/>
    ${edgeWhiplash(true, 31, BOARD_W)}${edgeWhiplash(true, BOARD_H - 31, BOARD_W)}
    ${edgeWhiplash(false, 31, BOARD_H)}${edgeWhiplash(false, BOARD_W - 31, BOARD_H)}
    ${corner(12, 12, 1, 1)}${corner(BOARD_W - 12, 12, -1, 1)}${corner(12, BOARD_H - 12, 1, -1)}${corner(BOARD_W - 12, BOARD_H - 12, -1, -1)}

    <!-- Schiffsroute -->
    <path d="${ship.d}" fill="none" stroke="${C.petrol}" stroke-width="4" stroke-dasharray="12 9" class="ship-route"/>
    <g transform="translate(${sx - 140},${sy + 48})" class="ship-label">
      <rect x="-80" y="-20" width="240" height="40" rx="8" fill="${C.parch}" stroke="${C.gold}"/>
      <text x="40" y="-2" text-anchor="middle" class="ship-title">Schiffsroute Glasgow – Riga</text>
      <text x="40" y="13" text-anchor="middle" class="ship-sub">Abkürzung · kostet einen ganzen Zug</text>
    </g>
    <g id="storm" style="display:none" transform="translate(${sx - 100},${sy + 100})"><text text-anchor="middle" class="storm">⛈ Sturm – gesperrt</text></g>

    ${routes}
    ${fields}
    ${Object.values(CITIES).map(cityMedallion).join('')}

    <!-- Titelkartusche & Legende -->
    <g transform="translate(${BOARD_W - 360},${BOARD_H - 250})">
      <rect width="290" height="96" rx="12" fill="${C.parch}" stroke="${C.gold}" stroke-width="2.5"/>
      <rect x="6" y="6" width="278" height="84" rx="9" fill="none" stroke="${C.gold}" stroke-width="1"/>
      <text x="145" y="50" text-anchor="middle" class="title">Grand Tour 1900</text>
      <text x="145" y="74" text-anchor="middle" class="subtitle">Eine Reise durch den Jugendstil Europas</text>
    </g>
    <g transform="translate(${BOARD_W - 360},${BOARD_H - 142})" class="legend">
      <rect width="290" height="72" rx="10" fill="${C.parch}" opacity=".95" stroke="${C.gold}"/>
      <circle cx="20" cy="22" r="8" fill="${C.sage}"/><text x="34" y="27">Stadt (8)</text>
      <circle cx="150" cy="22" r="8" fill="#FFFDF6" stroke="${C.ink}" stroke-width="2"/><text x="164" y="27">Streckenfeld</text>
      <rect x="13" y="43" width="14" height="14" transform="rotate(45 20 50)" fill="${C.terra}" stroke="${C.ink}"/><text x="34" y="55">Ereignisfeld (9)</text>
      <line x1="140" y1="50" x2="160" y2="50" stroke="${C.petrol}" stroke-width="3" stroke-dasharray="6 4"/><text x="164" y="55">Schiffsroute</text>
    </g>
    <g transform="translate(${MAP_X + 70},${MAP_Y + MAP_H - 70})">
      <circle r="34" fill="${C.parch}" stroke="${C.gold}" stroke-width="2"/>
      <path d="M0,-28 L6,0 L0,28 L-6,0Z" fill="${C.ink}"/><path d="M-28,0 L0,-5 L28,0 L0,5Z" fill="${C.gold}"/>
      <text y="-38" text-anchor="middle" class="compass">N</text>
    </g>
    <g id="tokens"></g>
  </svg>`;
  container.innerHTML = svg;
  return container.querySelector('svg');
}

// Kofferförmige Spielfigur
export function suitcase(color, label) {
  return `<g class="token">
    <ellipse cx="0" cy="13" rx="15" ry="4" fill="#000" opacity=".25"/>
    <path d="M-6,-14 v-5 a3,3 0 0 1 3,-3 h6 a3,3 0 0 1 3,3 v5" fill="none" stroke="${C.ink}" stroke-width="2.5"/>
    <rect x="-15" y="-14" width="30" height="24" rx="4" fill="${color}" stroke="${C.ink}" stroke-width="2"/>
    <rect x="-15" y="-5" width="30" height="3" fill="${C.ink}" opacity=".35"/>
    <rect x="-9" y="-14" width="3" height="24" fill="#E8C979"/><rect x="6" y="-14" width="3" height="24" fill="#E8C979"/>
    <text y="7" text-anchor="middle" class="token-label">${label}</text>
  </g>`;
}

export function renderTokens(svg, state) {
  const g = svg.querySelector('#tokens');
  const groups = {};
  state.players.forEach(p => { (groups[p.pos] ||= []).push(p); });
  let html = '';
  for (const [pos, ps] of Object.entries(groups)) {
    let x, y;
    if (pos === 'SEA') [x, y] = seaPosition(); else ({ x, y } = NODES[pos]);
    ps.forEach((p, i) => {
      const off = (i - (ps.length - 1) / 2) * 26;
      const dy = NODES[pos]?.type === 'city' ? -46 : -22;
      html += `<g transform="translate(${x + off},${y + dy})"><g class="${p.id === state.current ? 'active-token' : ''}">${suitcase(p.color, p.id + 1)}</g></g>`;
    });
  }
  g.innerHTML = html;
  svg.querySelector('#storm').style.display = state.shipBlockedBy != null ? '' : 'none';
}

export function highlightTargets(svg, targets, onPick) {
  svg.querySelectorAll('.target').forEach(el => { el.classList.remove('target'); el.onclick = null; });
  for (const node of targets) {
    const el = svg.querySelector(`[data-node="${node}"]`);
    if (!el) continue;
    el.classList.add('target');
    if (onPick) el.onclick = () => onPick(node);
  }
}
