import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
await page.waitForTimeout(2500);
await page.evaluate(() => { for (const e of __game.entities) if (e.enemy) e.alive = false; __game.teleport(192, 11); });
await page.waitForTimeout(300);
await page.keyboard.down('ArrowRight');
await page.evaluate(() => new Promise(res => {
  const tick = () => { if (__game.player.x > 196 * 16 - 34) { __game.pressJump(600); res(); } else requestAnimationFrame(tick); };
  tick();
}));
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(450);
  const s = await page.evaluate(() => { const p = __game.player;
    return { st: __game.state, pstate: p.state, x: Math.round(p.x), y: Math.round(p.y), flagY: __game.level.flagpole && Math.round(__game.level.flagpole.flagY) }; });
  console.log(i, JSON.stringify(s));
  await page.screenshot({ path: 'test/f' + i + '.png' });
}
await page.keyboard.up('ArrowRight');
process.exit(0);
