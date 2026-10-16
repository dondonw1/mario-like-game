import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: 'z-title.png' });
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
const shot = async (n) => {
  const d = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png').split(',')[1]);
  fs.writeFileSync(n + '.png', Buffer.from(d, 'base64'));
  console.log(n, JSON.stringify(await page.evaluate(() => { const p = __game.player;
    return { x: Math.round(p.x), vX: Math.round(__game.vX), st: __game.state, ents: __game.entities.length }; })));
};
/* run right through the level, jumping now and then */
await page.keyboard.down('ArrowRight'); await page.keyboard.down('ShiftLeft');
for (let i = 0; i < 4; i++) {
  await page.evaluate(() => __game.pressJump(400));
  await page.waitForTimeout(900);
  await shot('z-run' + i);
}
await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
/* super mario + fire flower look */
await page.evaluate(() => { __game.teleport(21, 11); __game.setPower(2); });
await page.waitForTimeout(400);
await shot('z-fire');
process.exit(0);
