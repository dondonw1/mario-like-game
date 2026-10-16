import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 640, height: 560 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(2300);
await page.evaluate(() => { for (const e of __game.entities) if (e.enemy) e.alive = false; });

const snap = () => page.evaluate(() => {
  const p = __game.player;
  return { t: Date.now() % 100000, x: Math.round(p.x), y: Math.round(p.y), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2),
           st: p.state, dir: p.pipeDir, dist: p.pipeDist, tgt: p.pipeTarget, standing: p.standing,
           keys: JSON.stringify(__game.keys), lvl: __game.level.name, und: !!__game.level.underground };
});

console.log('--- movement probe (hold right+run for 2s) ---');
await page.keyboard.down('ArrowRight'); await page.keyboard.down('ShiftLeft');
for (let i = 0; i < 6; i++) { await page.waitForTimeout(350); console.log(JSON.stringify(await snap())); }
await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');

console.log('--- pipe probe (teleport onto pipe 57, hold down) ---');
await page.evaluate(() => { __game.teleport(58, 8); });
await page.waitForTimeout(300);
console.log('before down:', JSON.stringify(await snap()));
await page.evaluate(() => { __game.keys.down = 1; });
for (let i = 0; i < 8; i++) { await page.waitForTimeout(400); console.log(JSON.stringify(await snap())); }
await page.evaluate(() => { __game.keys.down = 0; });
await browser.close();
