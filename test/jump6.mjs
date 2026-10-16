import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.keyboard.press('Enter');
await page.waitForTimeout(2600);
async function apex(run, col) {
  await page.evaluate(c => { for (const e of __game.entities) e.alive = false; __game.teleport(c, 12); }, col);
  await page.waitForTimeout(300);
  if (run) { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); }
  const vx = await page.evaluate(() => +__game.player.vx.toFixed(2));
  const res = await page.evaluate(async () => {
    const p = __game.player; const base = p.y + p.h;
    __game.keys.jump = 1; __game.jumpPressed = 1;
    let best = base;
    await new Promise(done => { let n = 0; const t = () => { best = Math.min(best, p.y + p.h);
      if (++n < 140) requestAnimationFrame(t); else done(); }; requestAnimationFrame(t); });
    __game.keys.jump = 0;
    return { rise: +(base - best).toFixed(1), tiles: +((base - best) / 16).toFixed(2) };
  });
  if (run) { await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft'); }
  return `vx=${vx} rise=${res.rise}px = ${res.tiles} tiles`;
}
console.log('standing jump:', await apex(false, 20));
console.log('running jump :', await apex(true, 20));
/* the 4-tall pipe at col 46 from a standstill, and while running */
for (const [start, runMs] of [[42, 0], [40, 700], [39, 1000]]) {
  await page.evaluate(c => { for (const e of __game.entities) e.alive = false; __game.teleport(c, 12); }, start);
  await page.waitForTimeout(250);
  if (runMs) { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(runMs); }
  await page.keyboard.down('Space'); await page.waitForTimeout(600); await page.keyboard.up('Space');
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({ p: __game.player.state, x: Math.round(__game.player.x), feet: Math.round(__game.player.y + __game.player.h) }));
  if (runMs) { await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft'); }
  console.log(`pipe from col ${start} run ${runMs}ms ->`, JSON.stringify(st),
    (st.feet === 144 && st.x >= 730 && st.x <= 800) ? '=> ON THE 4-TALL PIPE ✓' : '');
}
process.exit(0);
