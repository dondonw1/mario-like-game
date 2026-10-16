import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 600, height: 520 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(2400);

console.log(await page.evaluate(() => {
  const out = {};
  out.images = Object.fromEntries(Object.entries(window.__imgs || {}));
  const p = __game.player;
  out.player = { x: p.x, y: p.y, w: p.w, h: p.h, state: p.state, power: p.power, animT: p.animT, facing: p.facing };
  const c = document.getElementById('screen');
  const g = c.getContext('2d');
  out.canvas = { w: c.width, h: c.height, css: c.style.width + 'x' + c.style.height };
  // sample a column of pixels at the player's screen x
  const sx = Math.round(p.x - __game.vX), sy = Math.round(p.y);
  const d = g.getImageData(sx, sy, 16, 16).data;
  const uniq = new Set();
  for (let i = 0; i < d.length; i += 4) uniq.add(d[i] + ',' + d[i+1] + ',' + d[i+2]);
  out.playerAreaColors = [...uniq].slice(0, 8);
  // probe the sprite sheet: is (80,32) non-transparent?
  const off = document.createElement('canvas'); off.width = 16; off.height = 16;
  const oc = off.getContext('2d');
  oc.drawImage(document.querySelector('img') || new Image(), 0, 0);
  const img = new Image();
  out.sheetProbe = 'see below';
  return out;
}));

// probe sheets directly in page context
console.log(await page.evaluate(async () => {
  const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const pl = await load('assets/sprites/player.png');
  const off = document.createElement('canvas'); off.width = 32; off.height = 32;
  const oc = off.getContext('2d');
  oc.drawImage(pl, 80, 32, 16, 16, 0, 0, 16, 16);
  const d = oc.getImageData(0, 0, 16, 16).data;
  let nonEmpty = 0, colors = new Set();
  for (let i = 3; i < d.length; i += 4) if (d[i]) { nonEmpty++; }
  for (let i = 0; i < d.length; i += 16) colors.add(d[i]+','+d[i+1]+','+d[i+2]);
  return { sheetSize: pl.naturalWidth + 'x' + pl.naturalHeight, nonEmpty, sampleColors: [...colors].slice(0, 5) };
}));

await page.screenshot({ path: 'test/dbg-canvas.png' });
await browser.close();
