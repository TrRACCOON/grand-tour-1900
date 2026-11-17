// Oberfläche & Steuerung: Startmenü, lokales Spiel, Online-Spiel.
import { CITIES, CITY_ORDER, NODES, isCity } from '../data/board.js';
import { BUILDINGS, EVENTS, MERKMALE } from '../data/content.js';
import { CREDITS } from '../data/credits.js';
import { createGame, dispatch, actors, availableActions, citiesCollected, cardImage, hasCard, QUIZ_TIME, DUEL_TIME, PLAYER_COLORS } from './engine.js';
import { buildBoard, renderTokens, highlightTargets, suitcase } from './boardview.js';
import { Host, Client } from './net.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const VERSION = window.app?.version || 'dev';

let mode = null;      // 'local' | 'host' | 'client'
let state = null;
let myId = null;      // eigener Spielerindex (online)
let net = null;
let clockOffset = 0;  // Zeitdifferenz zum Gastgeber
let svg = null;
let diaryOpen = null;

// ---------------- Bildschirme ----------------
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

function menu() {
  net?.close(); net = null; mode = null; state = null; myId = null;
  show('screen-menu');
}

function initMenu() {
  $('#version').textContent = `Version ${VERSION}`;
  $('#btn-local').onclick = () => { renderLocalSetup(); show('screen-local'); };
  $('#btn-host').onclick = () => { $('#host-name').value = loadName(); show('screen-host-name'); };
  $('#btn-join').onclick = () => { $('#join-name').value = loadName(); show('screen-join'); };
  $('#btn-rules').onclick = () => show('screen-rules');
  $('#btn-credits').onclick = () => { renderCredits(); show('screen-credits'); };
  document.querySelectorAll('[data-back]').forEach(b => b.onclick = menu);
  $('#host-go').onclick = startHosting;
  $('#join-go').onclick = startJoining;
  $('#btn-menu').onclick = () => { if (confirm('Spiel wirklich verlassen?')) menu(); };
}

const loadName = () => { try { return localStorage.getItem('gt-name') || ''; } catch { return ''; } };
const saveName = n => { try { localStorage.setItem('gt-name', n); } catch { /* egal */ } };

// ---------------- Lokales Spiel ----------------
let localNames = ['', ''];
function renderLocalSetup() {
  const box = $('#local-players');
  box.innerHTML = localNames.map((n, i) => `
    <div class="name-row">${tokenIcon(i)}
      <input data-i="${i}" maxlength="18" placeholder="Spieler / Team ${i + 1}" value="${esc(n)}">
      ${localNames.length > 2 ? `<button class="icon-btn" data-del="${i}" title="Entfernen">✕</button>` : ''}
    </div>`).join('');
  box.querySelectorAll('input').forEach(inp => inp.oninput = () => { localNames[+inp.dataset.i] = inp.value; });
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { localNames.splice(+b.dataset.del, 1); renderLocalSetup(); });
  $('#local-add').style.display = localNames.length < 4 ? '' : 'none';
  $('#local-add').onclick = () => { localNames.push(''); renderLocalSetup(); };
  $('#local-start').onclick = () => {
    const names = localNames.map((n, i) => n.trim() || `Spieler ${i + 1}`);
    mode = 'local'; myId = null;
    startGame(createGame(names));
  };
}

// ---------------- Online ----------------
function startHosting() {
  const name = $('#host-name').value.trim();
  if (!name) return toast('Bitte gib deinen Namen ein.');
  saveName(name);
  mode = 'host'; myId = 0;
  show('screen-lobby');
  $('#lobby-code').textContent = '…';
  $('#lobby-status').textContent = 'Verbinde mit dem Vermittlungsserver …';
  $('#lobby-start').style.display = '';
  $('#lobby-start').disabled = true;
  net = new Host(name, {
    onReady: code => { $('#lobby-code').textContent = code; $('#lobby-status').textContent = 'Gib den Code an deine Mitspieler weiter.'; },
    onLobby: players => renderLobby(players),
    onError: msg => { toast(msg); $('#lobby-status').textContent = msg; },
    onAction: (action, pid) => {
      if (!state) return 'Spiel läuft noch nicht';
      const err = dispatch(state, action, pid);
      if (typeof err !== 'string') publish();
      return err;
    },
  });
  renderLobby(net.lobby());
  $('#lobby-start').onclick = () => {
    const names = net.players.map(p => p.name);
    net.started = true;
    startGame(createGame(names, { online: true }));
  };
}

function startJoining() {
  const name = $('#join-name').value.trim();
  const code = $('#join-code').value.trim();
  if (!name || code.length < 5) return toast('Bitte Name und 5-stelligen Code eingeben.');
  saveName(name);
  mode = 'client';
  show('screen-lobby');
  $('#lobby-code').textContent = code.toUpperCase();
  $('#lobby-status').textContent = 'Verbinde …';
  $('#lobby-start').style.display = 'none';
  $('#lobby-players').innerHTML = '';
  net = new Client(code, name, {
    onWelcome: id => { myId = id; $('#lobby-status').textContent = 'Verbunden! Warte, bis der Gastgeber das Spiel startet.'; },
    onLobby: players => renderLobby(players),
    onState: s => {
      clockOffset = (s.now || Date.now()) - Date.now();
      const first = !state;
      state = s;
      if (first) startGame(s, true); else render();
    },
    onError: msg => { toast(msg); $('#lobby-status').textContent = msg; },
    onClose: () => { toast('Die Verbindung zum Gastgeber wurde getrennt.'); },
  });
}

function renderLobby(players) {
  $('#lobby-players').innerHTML = players.map((p, i) => `
    <li>${tokenIcon(i)} <span>${esc(p.name)}</span> ${i === 0 ? '<em>Gastgeber</em>' : ''} ${p.online ? '' : '<em>(getrennt)</em>'}</li>`).join('');
  if (mode === 'host') $('#lobby-start').disabled = players.length < 2;
  if (state) render();
}

function publish() {
  state.now = Date.now();
  net?.sendState(state);
  render();
}

// ---------------- Spiel ----------------
function startGame(s, remote = false) {
  state = s;
  show('screen-game');
  if (!svg) svg = buildBoard($('#board'));
  if (mode === 'host' && !remote) publish(); else render();
}

function act(action) {
  if (mode === 'client') return net.send(action);
  const err = dispatch(state, action, mode === 'local' ? '*' : myId);
  if (typeof err === 'string') return toast(err);
  if (mode === 'host') publish(); else render();
}

const canAct = idx => mode === 'local' || idx === myId;
const now = () => Date.now() + clockOffset;
const playerName = i => esc(state.players[i].name);

function locationText(p) {
  if (p.atSea) return `auf See nach ${CITIES[p.atSea].name}`;
  if (isCity(p.pos)) return `in ${CITIES[p.pos].name}`;
  return NODES[p.pos].type === 'event' ? 'auf einem Ereignisfeld' : 'unterwegs auf der Strecke';
}

function render() {
  if (!state || !svg) return;
  renderTokens(svg, state);
  const pd = state.pending;
  if (state.phase === 'move' && canAct(pd.player)) highlightTargets(svg, Object.keys(pd.targets), node => act({ type: 'CHOOSE', node }));
  else highlightTargets(svg, state.phase === 'move' ? Object.keys(pd.targets) : [], null);
  renderSidebar();
  renderModal();
}

function renderSidebar() {
  const s = state, p = s.players[s.current], av = availableActions(s);
  const mine = canAct(s.current);
  let actionsHtml = '';
  if (s.phase === 'turn' && mine) {
    if (av.arrive) actionsHtml += `<button class="btn primary" data-a="ARRIVE">⚓ In ${CITIES[p.atSea].name} anlegen</button>`;
    if (av.roll) actionsHtml += `<button class="btn primary" data-a="ROLL">🎲 Würfeln${s.mustRoll ? ' (Kaffeehaus)' : ''}</button>`;
    if (av.exam) actionsHtml += `<button class="btn" data-a="EXAM">✉ Prüfung in ${CITIES[p.pos].name}</button>`;
    if (av.ship) actionsHtml += `<button class="btn" data-a="SHIP">⛴ Schiff nach ${p.pos === 'GL' ? 'Riga' : 'Glasgow'}</button>`;
  } else if (s.phase === 'move') {
    actionsHtml = canAct(s.pending.player) ? `<p class="hint">Wähle ein leuchtendes Zielfeld auf dem Plan.</p>` : `<p class="hint">${playerName(s.pending.player)} wählt ein Zielfeld …</p>`;
  } else if (s.phase !== 'gameOver' && !mine) {
    actionsHtml = `<p class="hint">${esc(p.name)} ist am Zug …</p>`;
  }
  const dice = s.dice ? `<div class="dice d${s.dice}">${'<i></i>'.repeat(s.dice)}</div>` : '';

  $('#sidebar').innerHTML = `
    <div class="round">Runde ${s.turn}${mode !== 'local' ? ` · Du bist <b>${myId != null ? playerName(myId) : ''}</b>` : ''}</div>
    <section class="turn-card" style="--pc:${p.color}">
      <div class="turn-head">${tokenIcon(p.id)}<div><h2>${esc(p.name)}</h2><small>${locationText(p)}</small></div>${dice}</div>
      <div class="actions">${actionsHtml}</div>
    </section>
    <h3 class="side-title">Reisetagebuch</h3>
    <ul class="players">
      ${s.players.map(pl => `
        <li class="${pl.id === s.current ? 'current' : ''}" data-diary="${pl.id}" title="Reisetagebuch öffnen">
          <div class="pl-head">${tokenIcon(pl.id)}<b>${esc(pl.name)}</b><span class="count">${citiesCollected(pl)}/8</span></div>
          <div class="stamps">${CITY_ORDER.map(c => `<span class="stamp ${hasCard(pl, c) ? 'got' : ''}" title="${CITIES[c].name}">${c}</span>`).join('')}</div>
          ${pl.skip ? '<small class="warn">setzt eine Runde aus</small>' : ''}
        </li>`).join('')}
    </ul>
    <h3 class="side-title">Reisebericht</h3>
    <ol class="log">${s.log.slice(-7).reverse().map(l => `<li>${esc(l)}</li>`).join('')}</ol>`;
  $('#sidebar').querySelectorAll('[data-a]').forEach(b => b.onclick = () => act({ type: b.dataset.a }));
  $('#sidebar').querySelectorAll('[data-diary]').forEach(li => li.onclick = () => { diaryOpen = +li.dataset.diary; renderDiary(); });
}

function tokenIcon(i) {
  return `<svg class="tok" viewBox="-18 -26 36 44">${suitcase(PLAYER_COLORS[i], i + 1)}</svg>`;
}

// ---------------- Karten / Dialoge ----------------
function img(bid, cls = '') {
  if (!bid) return '';
  const b = BUILDINGS[bid];
  return `<figure class="photo ${cls}"><img src="assets/img/${bid}.jpg" alt="${esc(b.name)}"><figcaption>Foto: ${esc(CREDITS[bid]?.artist || 'Wikimedia Commons')} · ${esc(CREDITS[bid]?.license || '')}</figcaption></figure>`;
}

function stamp(city) {
  return `<div class="postage"><span>${CITIES[city]?.name || 'Europa'}</span><b>1900</b></div>`;
}

function timerBar(deadline, total) {
  return `<div class="hourglass"><div class="sand" data-deadline="${deadline}" data-total="${total}"></div><span class="secs"></span></div>`;
}

function renderModal() {
  const s = state, pd = s.pending, m = $('#modal');
  let html = '';
  switch (s.phase) {
    case 'quiz': html = quizCard(pd, false); break;
    case 'quizResult': html = quizCard(pd, true); break;
    case 'event': html = eventCard(pd); break;
    case 'offer': html = `
      <div class="postcard small">${stamp(pd.city)}
        <div class="pc-label">Erneuter Besuch</div><h2>${CITIES[pd.city].name}</h2>
        <p>${playerName(pd.player)} hat schon eine Postkarte aus ${CITIES[pd.city].name}. Eine weitere erspielen? Zusatzkarten schützen, wenn du eine Karte abgeben musst.</p>
        ${canAct(pd.player) ? `<div class="row"><button class="btn primary" data-a="EXAM">Ja, Prüfung ablegen</button><button class="btn" data-a="SKIP_EXAM">Nein, weiter</button></div>` : waitText(pd.player)}
      </div>`; break;
    case 'chooseOpponent': html = `
      <div class="postcard small">${stamp(null)}
        <div class="pc-label">Ornament-Duell</div><h2>Wen forderst du heraus?</h2>
        ${canAct(pd.player) ? `<div class="col">${s.players.filter(o => o.id !== pd.player && !o.atSea).map(o => `<button class="btn" data-opp="${o.id}">${tokenIcon(o.id)} ${esc(o.name)}</button>`).join('')}</div>` : waitText(pd.player)}
      </div>`; break;
    case 'duel': html = duelCard(pd); break;
    case 'gameOver': html = winnerCard(); break;
  }
  const key = s.phase + ':' + s.seq;
  if (m.dataset.key === key) return;
  const samePhase = m.dataset.phase === s.phase;
  m.dataset.key = key;
  m.dataset.phase = s.phase;
  m.innerHTML = html;
  if (samePhase) m.querySelector('.postcard')?.style.setProperty('animation', 'none');
  m.classList.toggle('open', !!html);
  m.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act({ type: b.dataset.a }));
  m.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => act({ type: 'ANSWER', index: +b.dataset.ans }));
  m.querySelectorAll('[data-opp]').forEach(b => b.onclick = () => act({ type: 'CHOOSE_OPPONENT', player: +b.dataset.opp }));
  m.querySelectorAll('[data-duel]').forEach(b => b.onclick = () => act({ type: 'DUEL_ANSWER', player: +b.dataset.who, index: +b.dataset.duel }));
  m.querySelectorAll('[data-newgame]').forEach(b => b.onclick = menu);
}

const waitText = i => `<p class="hint">Warte auf ${playerName(i)} …</p>`;

function quizCard(pd, result) {
  const titles = { city: `Prüfung · ${CITIES[pd.city]?.name}`, historismus: 'Historismus-Kritiker', jugend: 'Die Zeitschrift „Jugend“', material: `Materialprüfung · Frage ${pd.round}/2` };
  const mine = canAct(pd.player) && !result;
  const b = pd.b && pd.kind !== 'material' ? BUILDINGS[pd.b] : null;
  const opts = pd.options.map((o, i) => {
    let cls = '';
    if (result) cls = i === pd.correct ? 'right' : i === pd.answer ? 'wrong' : 'dim';
    return `<button class="opt ${cls}" ${mine ? `data-ans="${i}"` : 'disabled'}><span>${'ABCD'[i]}</span>${esc(o)}</button>`;
  }).join('');
  let footer = '';
  if (result) {
    const verdict = pd.answer === -1 ? 'Die Zeit ist abgelaufen!' : pd.right ? 'Richtig!' : 'Leider falsch.';
    let extra = '';
    if (pd.kind === 'city') extra = pd.right ? `Die Postkarte von ${CITIES[pd.city].name} wandert ins Reisetagebuch.` : 'Nächste Runde: noch einmal versuchen oder weiterreisen.';
    if (pd.kind === 'historismus' && !pd.right) extra = 'Eine Postkarte muss abgegeben werden.';
    if (pd.kind === 'jugend' && pd.right) extra = '3 Felder vor!';
    if (pd.kind === 'material') extra = `Bisher richtig: ${pd.score} von ${pd.round}.`;
    footer = `<div class="verdict ${pd.right ? 'ok' : 'bad'}"><b>${verdict}</b> ${esc(extra)}${pd.info ? `<p>${esc(pd.info)}</p>` : ''}</div>
      ${canAct(pd.player) ? '<button class="btn primary" data-a="CONTINUE">Weiter</button>' : waitText(pd.player)}`;
  } else {
    footer = timerBar(pd.deadline, QUIZ_TIME) + (mine ? '' : waitText(pd.player));
  }
  return `<div class="postcard quiz">
    ${stamp(pd.city || (b && b.city))}
    <div class="pc-grid">
      <div class="pc-left">${b ? img(pd.b) : `<div class="photo placeholder"><span>${pd.kind === 'material' ? '▦' : '✿'}</span></div>`}
        ${b ? `<div class="bmeta"><b>${esc(b.name)}</b><span>${esc(b.architect)} · ${esc(b.year)}</span><span class="merkmal">${MERKMALE[b.m].icon} ${MERKMALE[b.m].name}</span></div>` : ''}
      </div>
      <div class="pc-right">
        <div class="pc-label">${esc(titles[pd.kind])} · ${playerName(pd.player)}</div>
        <h2 class="question">${esc(pd.question)}</h2>
        <div class="opts">${opts}</div>
        ${footer}
      </div>
    </div>
  </div>`;
}

function eventCard(pd) {
  const e = EVENTS.find(x => x.id === pd.event);
  return `<div class="postcard event">
    <div class="pc-label">Ereignis · ${playerName(pd.player)}</div>
    <h2>${esc(e.title)}</h2>${e.sub ? `<div class="sub">${esc(e.sub)}</div>` : ''}
    <svg class="whip" viewBox="0 0 240 30"><path d="M4,20 C50,0 90,2 120,18 S190,32 236,8" fill="none" stroke="#9A7630" stroke-width="2.5"/></svg>
    <p class="flavor">${esc(e.flavor)}</p>
    <div class="effect">${esc(e.text)}</div>
    ${canAct(pd.player) ? '<button class="btn primary" data-a="CONTINUE">Ausführen</button>' : waitText(pd.player)}
  </div>`;
}

function duelCard(pd) {
  const done = pd.winner != null || pd.timedOut;
  const row = who => {
    const me = canAct(who) && !done && !pd.locked.includes(who);
    return `<div class="duel-row" style="--pc:${state.players[who].color}">
      <div class="duel-name">${tokenIcon(who)} ${playerName(who)} ${pd.locked.includes(who) ? '<em>falsch – gesperrt</em>' : ''} ${pd.winner === who ? '<em class="ok">Sieger!</em>' : ''}</div>
      <div class="duel-opts">${pd.options.map((c, i) => {
        let cls = done ? (i === pd.correct ? 'right' : pd.answers[who] === i ? 'wrong' : 'dim') : pd.answers[who] === i ? 'wrong' : '';
        return `<button class="opt ${cls}" ${me ? `data-duel="${i}" data-who="${who}"` : 'disabled'}>${CITIES[c].name}</button>`;
      }).join('')}</div></div>`;
  };
  const visibleRows = mode === 'local' ? [pd.a, pd.b] : [pd.a, pd.b].sort((x, y) => (y === myId) - (x === myId));
  return `<div class="postcard duel">
    <div class="pc-label">Duell · ${pd.reward} Feld${pd.reward > 1 ? 'er' : ''} Bonus</div>
    <h2>In welcher Stadt steht dieses Bauwerk?</h2>
    <div class="duel-grid">${img(pd.building, 'big')}<div>${visibleRows.map(row).join('')}
      ${done ? `<div class="verdict"><b>${esc(BUILDINGS[pd.building].name)}</b> steht in ${CITIES[pd.options[pd.correct]].name}.</div>
        ${canAct(state.current) ? '<button class="btn primary" data-a="CONTINUE">Weiter</button>' : waitText(state.current)}`
        : timerBar(pd.deadline, DUEL_TIME) + (mode === 'local' ? '<p class="hint">Wer zuerst die richtige Stadt anklickt, gewinnt.</p>' : '')}
    </div></div>
  </div>`;
}

function winnerCard() {
  const w = state.players[state.winner];
  return `<div class="postcard winner">
    <div class="pc-label">Die Grand Tour ist vollendet</div>
    <div class="win-token">${tokenIcon(w.id)}</div>
    <h2>${esc(w.name)} gewinnt!</h2>
    <p>Postkarten aus allen acht Jugendstil-Zentren Europas gesammelt.</p>
    <div class="diary-grid">${w.cards.map(postcardThumb).join('')}</div>
    <button class="btn primary" data-newgame>Zurück zum Menü</button>
  </div>`;
}

function postcardThumb(card) {
  const bid = cardImage(card);
  const b = BUILDINGS[bid];
  return `<div class="thumb"><img src="assets/img/${bid}.jpg" alt=""><span class="th-city">${CITIES[card.city].name}</span><span class="th-name">${esc(card.b ? b.name : 'Stadtansicht')}</span></div>`;
}

function renderDiary() {
  const d = $('#diary');
  if (diaryOpen == null) { d.classList.remove('open'); return; }
  const p = state.players[diaryOpen];
  d.innerHTML = `<div class="postcard diary">
    <button class="close" title="Schließen">✕</button>
    <div class="pc-label">Reisetagebuch</div><h2>${tokenIcon(p.id)} ${esc(p.name)}</h2>
    <p>${citiesCollected(p)} von 8 Städten · ${p.cards.length} Postkarte(n)</p>
    <div class="diary-grid">${p.cards.length ? p.cards.map(postcardThumb).join('') : '<p class="hint">Noch keine Postkarten gesammelt.</p>'}</div>
  </div>`;
  d.classList.add('open');
  d.onclick = e => { if (e.target === d || e.target.closest('.close')) { diaryOpen = null; renderDiary(); } };
}

// ---------------- Timer ----------------
setInterval(() => {
  document.querySelectorAll('.sand').forEach(el => {
    const left = Math.max(0, +el.dataset.deadline - now());
    el.style.width = `${(left / +el.dataset.total) * 100}%`;
    el.parentElement.querySelector('.secs').textContent = `${Math.ceil(left / 1000)} s`;
    el.parentElement.classList.toggle('urgent', left < 8000);
  });
  if (!state || mode === 'client') return;
  const pd = state.pending;
  if (state.phase === 'quiz' && Date.now() > pd.deadline) {
    if (typeof dispatch(state, { type: 'TIMEOUT' }, '*') !== 'string') mode === 'host' ? publish() : render();
  }
  if (state.phase === 'duel' && pd.winner == null && !pd.timedOut && Date.now() > pd.deadline) {
    if (typeof dispatch(state, { type: 'DUEL_TIMEOUT' }, '*') !== 'string') mode === 'host' ? publish() : render();
  }
}, 250);

// ---------------- Sonstiges ----------------
function renderCredits() {
  $('#credits-list').innerHTML = Object.entries(BUILDINGS).map(([id, b]) => {
    const c = CREDITS[id];
    if (!c) return '';
    return `<li><b>${esc(b.name)}</b> (${CITIES[b.city].name}) – ${esc(c.artist)}, <a href="${esc(c.source)}" target="_blank">${esc(c.title.replace('File:', ''))}</a>, ${esc(c.license)}</li>`;
  }).join('');
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// Testzugang für Entwickler (Konsole)
window.__gt = { get state() { return state; }, act };

initMenu();
show('screen-menu');
