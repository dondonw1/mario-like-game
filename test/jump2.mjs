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
const S = () => page.evaluate(() => __game.state);
async function ensure() { for (let i = 0; i < 20; i++) { if (await S() === 'play') return true; await page.waitForTimeout(500); } return false; }
async function apex(run, col) {
  await ensure();
  await page.evaluate(c => __game.teleport(c, 12), col);
  await page.waitForTimeout(250);
  let pre = '';
  if (run) { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1600);
    pre = await page.evaluate(() => `vx=${__game.player.vx.toFixed(2)} `); }
  const res = await page.evaluate(async (hold) => {
    const p = __game.player; const ground = p.y + p.h;
    __game.pressJump(hold);
    let best = ground, peak = 0;
    await new Promise(done => { let n = 0; const t = () => { best = Math.min(best, p.y + p.h); peak = Math.max(peak, Math.abs(p.vx));
      if (++n < 100) requestAnimationFrame(t); else done(); }; requestAnimationFrame(t); });
    return { rise: +(ground - best).toFixed(1), tiles: +((ground - best) / 16).toFixed(2), vx: +peak.toFixed(2) };
  }, run ? 45 : 20);
  if (run) { await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft'); await page.waitForTimeout(400); }
  return pre + JSON.stringify(res);
}
console.log('standing jump:', await apex(false, 20));
console.log('running jump :', await apex(true, 20));
/* clear the 4-tall pipe at col 46 (top row 9, y=144) from flat ground */
for (const start of [41, 42, 43]) {
  await ensure();
  await page.evaluate(c => __game.teleport(c, 12), start);
  await page.waitForTimeout(200);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1300);
  await page.evaluate(() => __game.pressJump(45));
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => ({ st: __game.state, x: Math.round(__game.player.x), feet: Math.round(__game.player.y + __game.player.h), standing: __game.player.standing }));
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
  console.log(`pipe test from col ${start}:`, JSON.stringify(st), st.feet === 144 ? '=> LANDED ON PIPE' : '');
}
process.exit(0);
