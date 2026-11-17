// Erzeugt build/icon.png (512×512) aus einer SVG-Grafik. Aufruf: npx electron tools/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="16" y="16" width="480" height="480" rx="96" fill="#5E7A5A"/>
  <rect x="40" y="40" width="432" height="432" rx="76" fill="none" stroke="#E8C979" stroke-width="10"/>
  <path d="M190,170 v-36 a20,20 0 0 1 20,-20 h92 a20,20 0 0 1 20,20 v36" fill="none" stroke="#2B2A26" stroke-width="22"/>
  <rect x="106" y="166" width="300" height="220" rx="30" fill="#A4502F" stroke="#2B2A26" stroke-width="14"/>
  <rect x="160" y="166" width="26" height="220" fill="#E8C979"/><rect x="326" y="166" width="26" height="220" fill="#E8C979"/>
  <path d="M120,300 C180,250 230,330 290,280 S380,250 396,270" fill="none" stroke="#F4EEDF" stroke-width="10" stroke-linecap="round"/>
  <text x="256" y="452" text-anchor="middle" font-family="Georgia, serif" font-size="64" font-weight="bold" fill="#F4EEDF">1900</text>
</svg>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, useContentSize: true });
  await win.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="512" height="512" ')}</body>`));
  await new Promise(r => setTimeout(r, 300));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), img.resize({ width: 512, height: 512 }).toPNG());
  app.quit();
});
