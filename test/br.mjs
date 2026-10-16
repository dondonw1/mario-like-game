import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.evaluate(() => __game.startLevel(3, { score: 0, coins: 0, lives: 5, power: 2 }));
await page.waitForTimeout(2400);
await page.evaluate(() => { __game.teleport(130, 11); __game.setPower(2); });
await page.waitForTimeout(1200);
console.log(JSON.stringify(await page.evaluate(() => {
  const out = { solid12: [125,130,137].map(c => __game.solidAt(12, c)), solid13: [130].map(c => __game.solidAt(13, c)),
                vX: Math.round(__game.vX), bx: Math.round(__game.entities.find(e=>e.kind==='bowser').x),
                px: Math.round(__game.player.x) };
  const g = document.getElementById('screen').getContext('2d');
  const s = __game.vX;
  out.pixels = [[130*16 - s + 8, 12*16 + 8],[130*16 - s + 8, 13*16 + 4],[132*16 - s, 10*16]].map(([x,y]) => {
    const d = g.getImageData(x, y, 1, 1).data; return [x, y, d[0], d[1], d[2]];
  });
  return out;
})));
process.exit(0);
