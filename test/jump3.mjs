import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.keyboard.press('Enter');
await page.waitForTimeout(2600);
const out = await page.evaluate(async () => {
  const p = __game.player;
  __game.teleport(20, 12);
  await new Promise(r => setTimeout(r, 400));
  const base = p.y + p.h;
  __game.keys.jump = 1; __game.keys.run = 0;
  const res = [];
  await new Promise(done => {
    let n = 0, best = base, jumpVy = null, jumpFrame = -1;
    const t = () => {
      if (jumpFrame < 0) { __game.pressJumpOnce && __game.pressJumpOnce(); }
      if (p.vy < -1 && jumpVy === null) { jumpVy = p.vy; jumpFrame = n; }
      best = Math.min(best, p.y + p.h);
      if (++n < 120) requestAnimationFrame(t); else done();
    };
    requestAnimationFrame(t);
  });
  __game.keys.jump = 0;
  return { base, rise: +(base - best).toFixed(1), tiles: +((base - best) / 16).toFixed(2), jumpVy: jumpVy && +jumpVy.toFixed(2), jumpFrame };
});
console.log('measured:', JSON.stringify(out));
process.exit(0);
