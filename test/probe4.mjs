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
await page.evaluate(() => { for (const e of __game.entities) if (e.enemy) e.alive = false; __game.teleport(104, 11); });
await page.waitForTimeout(300);
await page.keyboard.down('ArrowRight'); await page.keyboard.down('ShiftLeft');
await page.evaluate(() => new Promise(res => {
  const tick = () => { if (__game.player.x > 109 * 16 - 44) { __game.pressJump(600); res(); } else requestAnimationFrame(tick); };
  tick();
}));
await page.evaluate(async () => {
  const p = __game.player, T = 16, bx = 109 * T, by = 7 * T, log = [];
  for (let i = 0; i < 40; i++) {
    await new Promise(r => requestAnimationFrame(r));
    const c1 = p.vyBefore < 0, c2 = p.x + p.w > bx - 8, c3 = p.x < bx + T + 8,
          c4 = p.y <= by + T + 6, c5 = p.y + p.h > by;
    log.push(`f${i} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vyB=${(p.vyBefore||0).toFixed(2)} ` +
             `[${+c1}${+c2}${+c3}${+c4}${+c5}] used=${__game.level.hidden[0].used}`);
    if (__game.level.hidden[0].used) break;
  }
  window.__log = log.join('\n');
});
await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
console.log(await page.evaluate(() => window.__log));
process.exit(0);
