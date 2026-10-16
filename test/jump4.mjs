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
/* real key events, held like a player would */
for (const runMs of [900, 1200, 1500]) {
  for (const jumpAt of [0, 200, 400]) {
    await page.evaluate(() => { __game.teleport(40, 12); });
    await page.waitForTimeout(250);
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(runMs);
    await page.keyboard.down('Space');
    const vx = await page.evaluate(() => +__game.player.vx.toFixed(2));
    await page.waitForTimeout(500);
    await page.keyboard.up('Space');
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ st: __game.state, x: Math.round(__game.player.x),
      feet: Math.round(__game.player.y + __game.player.h), standing: __game.player.standing }));
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
    const onPipe = st.feet === 144 && st.x > 720 && st.x < 800;
    console.log(`run ${runMs}ms vx=${vx} ->`, JSON.stringify(st), onPipe ? '=> ON PIPE ✓' : '');
    await page.waitForTimeout(300);
  }
}
process.exit(0);
