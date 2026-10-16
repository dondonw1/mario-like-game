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
const prep = c => page.evaluate(cc => { for (const e of __game.entities) e.alive = false; __game.teleport(cc, 12); }, c);
async function apex(run) {
  await prep(20);
  if (run) { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); }
  const vx = await page.evaluate(() => +__game.player.vx.toFixed(2));
  const watch = page.evaluate(async () => {
    const p = __game.player; const base = p.y + p.h; let best = base;
    await new Promise(done => { let n = 0; const t = () => { best = Math.min(best, p.y + p.h);
      if (++n < 130) requestAnimationFrame(t); else done(); }; requestAnimationFrame(t); });
    return +(base - best).toFixed(1);
  });
  await page.keyboard.down('Space'); await page.waitForTimeout(700); await page.keyboard.up('Space');
  const rise = await watch;
  if (run) { await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft'); await page.waitForTimeout(400); }
  return `vx=${vx} rise=${rise}px = ${(rise / 16).toFixed(2)} tiles`;
}
console.log('standing jump:', await apex(false));
console.log('running jump :', await apex(true));
for (const [start, run] of [[44, false], [41, true], [43, true]]) {
  await prep(start);
  if (run) await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(run ? 800 : 150);
  await page.keyboard.down('Space'); await page.waitForTimeout(700); await page.keyboard.up('Space');
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({ p: __game.player.state, x: Math.round(__game.player.x), feet: Math.round(__game.player.y + __game.player.h) }));
  await page.keyboard.up('ArrowRight'); if (run) await page.keyboard.up('ShiftLeft');
  console.log(`4-tall pipe from col ${start} ${run ? 'run' : 'walk'} ->`, JSON.stringify(st),
    (st.feet === 144 && st.x >= 720 && st.x <= 800) ? '=> LANDED ON THE HIGH PIPE ✓' : '');
  await page.waitForTimeout(300);
}
process.exit(0);
