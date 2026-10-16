import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const shot = async (n) => {
  const d = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png').split(',')[1]);
  fs.writeFileSync('test/' + n + '.png', Buffer.from(d, 'base64'));
};
await shot('final-title');
await page.keyboard.press('Enter');
await page.waitForTimeout(2600);
/* fire mario throws a fireball with down+run */
await page.evaluate(() => { __game.teleport(30, 11); __game.setPower(2); });
await page.waitForTimeout(400);
await page.evaluate(() => { __game.keys.down = 1; __game.keys.run = 1; });
await page.waitForTimeout(200);
await page.evaluate(() => { __game.keys.down = 0; __game.keys.run = 0; });
await page.waitForTimeout(300);
console.log('fireballs:', await page.evaluate(() => __game.entities.filter(e => e.kind === 'fireball').length));
await shot('final-fire');
/* leave the game at the title for the user */
await page.evaluate(() => { __game.startLevel(); });
await page.waitForTimeout(600);
process.exit(0);
