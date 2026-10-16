import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);

await page.evaluate(async () => {
  for (const e of __game.entities) if (e.enemy) e.alive = false;
  const g = { kind: 'goomba', enemy: true, x: 46 * 16, y: 12 * 16, w: 15, h: 16,
              vx: 0, vy: 0, alive: true, animT: 0, flat: 0 };
  __game.entities.push(g);
  __game.teleport(46, 8);
  const p = __game.player;
  const log = ['state=' + __game.state + ' h=' + p.h + ' power=' + p.power];
  for (let i = 0; i < 45; i++) {
    await new Promise(r => requestAnimationFrame(r));
    const ov = p.x < g.x + g.w && p.x + p.w > g.x && p.y < g.y + g.h && p.y + p.h > g.y;
    log.push(`f${i} st=${__game.state} py=${p.y.toFixed(1)} yB=${(p.yBefore||-1).toFixed(1)} ` +
             `vyB=${(p.vyBefore||0).toFixed(2)} gy=${g.y.toFixed(1)} gyB=${(g.yBefore||-1).toFixed(1)} ` +
             `ov=${ov} flat=${g.flat} alive=${g.alive} pw=${p.power}`);
  }
  window.__log = log.join('\n');
});
console.log(await page.evaluate(() => window.__log));
process.exit(0);
