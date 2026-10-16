import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.keyboard.press('Enter');
await page.waitForTimeout(2600);
await page.evaluate(() => { for (const e of __game.entities) e.alive = false; __game.teleport(41, 12); });
await page.waitForTimeout(400);
await page.evaluate(async () => {
  const p = __game.player;
  __game.keys.right = 1; __game.keys.run = 1;
  let shot = false;
  for (let i = 0; i < 130; i++) {
    await new Promise(r => requestAnimationFrame(r));
    if (i === 26) __game.pressJump(600);
    if (!shot && p.x + p.w > 736 && p.x < 784 && p.y + p.h <= 144) {
      shot = true;
      window.__SHOT = document.getElementById('screen').toDataURL('image/png');
    }
  }
  __game.keys.right = 0; __game.keys.run = 0;
  return shot;
});
const d = await page.evaluate(() => window.__SHOT);
if (d) fs.writeFileSync('final-pipe.png', Buffer.from(d.split(',')[1], 'base64'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
console.log('shot:', !!d, 'state:', await page.evaluate(() => __game.state));
process.exit(0);
