// Lädt frei lizenzierte Fotos der Gebäude von Wikimedia Commons und schreibt
// die Bildnachweise nach src/data/credits.js.
// Aufruf: npm run fetch:images            (nur fehlende Bilder)
//         npm run fetch:images -- volksbad (bestimmte Bilder neu laden)
// Ein bestimmtes Commons-Bild erzwingen: in tools/image-overrides.json
//   { "volksbad": "File:Muellersches Volksbad.jpg" }
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BUILDINGS } from '../src/data/content.js';

const IMG_DIR = new URL('../src/assets/img/', import.meta.url);
const CREDITS = new URL('../src/data/credits.json', import.meta.url);
const OVERRIDES = new URL('./image-overrides.json', import.meta.url);
mkdirSync(IMG_DIR, { recursive: true });

const UA = 'GrandTour1900-Lernspiel/0.1 (Schulprojekt; https://github.com)';
const credits = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, 'utf8')) : {};
const overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, 'utf8')) : {};
const only = process.argv.slice(2);

const strip = s => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const okLicense = l => /^(CC0|CC BY|CC-BY|Public domain|PD|Attribution)/i.test(l || '');

async function api(params) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', origin: '*', ...params });
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const IIPROPS = { prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '900' };

async function candidates(id, b) {
  if (overrides[id]) {
    const j = await api({ action: 'query', titles: overrides[id], ...IIPROPS });
    return Object.values(j.query.pages);
  }
  const j = await api({ action: 'query', generator: 'search', gsrsearch: `${b.commons} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '8', ...IIPROPS });
  return Object.values(j.query?.pages || {}).sort((a, c) => a.index - c.index);
}

for (const [id, b] of Object.entries(BUILDINGS)) {
  const file = new URL(`${id}.jpg`, IMG_DIR);
  if (only.length ? !only.includes(id) : existsSync(file)) continue;
  try {
    const pages = await candidates(id, b);
    const pick = pages.find(p => {
      const ii = p.imageinfo?.[0];
      return ii && /jpeg|png/.test(ii.mime) && okLicense(ii.extmetadata?.LicenseShortName?.value) && (overrides[id] || ii.width >= 500);
    });
    if (!pick) { console.warn(`!! ${id}: kein passendes Bild gefunden`); continue; }
    const ii = pick.imageinfo[0];
    const img = await fetch(ii.thumburl || ii.url, { headers: { 'User-Agent': UA } });
    writeFileSync(file, Buffer.from(await img.arrayBuffer()));
    const m = ii.extmetadata;
    credits[id] = {
      title: pick.title,
      artist: strip(m.Artist?.value) || 'unbekannt',
      license: m.LicenseShortName?.value,
      licenseUrl: m.LicenseUrl?.value || '',
      source: ii.descriptionurl,
    };
    console.log(`ok ${id}: ${pick.title} (${credits[id].license})`);
    await new Promise(r => setTimeout(r, 300));
  } catch (e) {
    console.warn(`!! ${id}: ${e.message}`);
  }
}
writeFileSync(CREDITS, JSON.stringify(credits, null, 2));
writeFileSync(new URL('../src/data/credits.js', import.meta.url),
  `// Automatisch erzeugt von tools/fetch-images.mjs\nexport const CREDITS = ${JSON.stringify(credits, null, 2)};\n`);
