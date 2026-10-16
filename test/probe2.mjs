import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(2300);

/* --- goomba stomp, frame by frame --- */
await page.evaluate(() => {
  for (const e of __game.entities) if (e.enemy) e.alive = false;
  __game.entities.push({ kind: 'goomba', enemy: true, x: 46 * 16, y: 12 * 16, w: 15, h: 16,
                         vx: 0, vy: 0, alive: true, animT: 0, flat: 0 });
  __game.teleport(46, 8);
});
await page.evaluate(async () => {
  const p = __game.player;
  const g = __game.entities.find(e => e.kind === 'goomba');
  const log = [];
  for (let i = 0; i < 40; i++) {
    await new Promise(r => requestAnimationFrame(r));
    log.push(`f${i} py=${p.y.toFixed(1)} pb=${(p.y + p.h).toFixed(1)} vyB=${(p.vyBefore||0).toFixed(2)} ` +
             `gy=${g.y.toFixed(1)} flat=${g.flat} alive=${g.alive} pw=${p.power} h=${p.h}`);
  }
  window.__log = log.join('\n');
});
console.log(await page.evaluate(() => window.__log));

/* --- hidden 1-up block, frame by frame --- */
await page.evaluate(() => { for (const e of __game.entities) if (e.enemy) e.alive = false; __game.teleport(104, 11); });
await page.waitForTimeout(300);
await page.keyboard.down('ArrowRight'); await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(900);
await page.evaluate(() => __game.pressJump(600));
await page.evaluate(async () => {
  const p = __game.player;
  const log = [];
  for (let i = 0; i < 45; i++) {
    await new Promise(r => requestAnimationFrame(r));
    log.push(`f${i} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vy=${p.vy.toFixed(2)} vyB=${(p.vyBefore||0).toFixed(2)} pw=${p.power} h=${p.h}`);
  }
  window.__log2 = log.join('\n');
});
await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
console.log(await page.evaluate(() => window.__log2));
console.log('hidden:', await page.evaluate(() => JSON.stringify(__game.level.hidden)));
process.exit(0);
