import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123')) ||
  (await browser.contexts()[0].newPage());
await page.goto('http://127.0.0.1:8123/index.html');
await page.waitForTimeout(800);
await page.keyboard.press('Enter');
await page.waitForTimeout(2600);
/* measure apex: stand still, then run + jump */
async function apex(run, col) {
  await page.evaluate(c => __game.teleport(c, 12), col);
  await page.waitForTimeout(300);
  if (run) { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1400); }
  const res = await page.evaluate(async (run) => {
    const p = __game.player, ground = p.y + p.h;
    __game.pressJump(run ? 40 : 12);
    let best = ground, peakVX = 0;
    await new Promise(done => { let n = 0; const tick = () => { best = Math.min(best, p.y + p.h); peakVX = Math.max(peakVX, Math.abs(p.vx));
      if (++n < 90) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
    return { rise: ground - best, peakVX: +peakVX.toFixed(2) };
  }, run);
  if (run) { await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft'); }
  return res;
}
console.log('standing:', await apex(false, 20));
console.log('running :', await apex(true, 20));
/* can a running jump land on top of the 4-tile pipe at col 46 (top row 9)? */
for (const start of [38, 39, 40, 41, 42]) {
  await page.evaluate(c => { __game.teleport(c, 12); }, start);
  await page.waitForTimeout(200);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1500);
  await page.evaluate(() => __game.pressJump(40));
  await page.waitForTimeout(900);
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
  const st = await page.evaluate(() => ({ x: Math.round(__game.player.x), feet: Math.round(__game.player.y + __game.player.h), standing: __game.player.standing }));
  console.log(`start col ${start}:`, JSON.stringify(st), st.feet === 9 * 16 ? 'ON PIPE' : 'ground');
}
process.exit(0);
