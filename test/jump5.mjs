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
const clear = () => page.evaluate(() => { for (const e of __game.entities) e.alive = false; });
async function trial(start, runMs, holdMs) {
  await page.evaluate(c => { __game.teleport(c, 12); __game.setPower(0); }, start);
  await clear();
  await page.waitForTimeout(200);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(runMs);
  const vx = await page.evaluate(() => +__game.player.vx.toFixed(2));
  await page.keyboard.down('Space');
  await page.waitForTimeout(holdMs);
  await page.keyboard.up('Space');
  await page.waitForTimeout(350);
  const st = await page.evaluate(() => ({ pstate: __game.player.state, x: Math.round(__game.player.x),
    feet: Math.round(__game.player.y + __game.player.h), standing: __game.player.standing }));
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
  const on4 = st.feet === 144 && st.x >= 736 && st.x <= 784;
  const on3 = st.feet === 160 && st.x >= 608 && st.x <= 656;
  console.log(`col ${start} run ${runMs}ms (vx ${vx}) jump hold ${holdMs}ms ->`,
    JSON.stringify(st), on4 ? '=> ON THE 4-TALL PIPE ✓' : on3 ? '=> ON THE 3-TALL PIPE ✓' : '');
  await page.waitForTimeout(250);
}
for (const start of [40, 41, 42]) await trial(start, 1100, 400);
await trial(40, 1100, 120);   /* a short, weak tap */
await trial(40, 500, 400);    /* a slow walk-jump */
process.exit(0);
