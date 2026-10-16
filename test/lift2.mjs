import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.evaluate(() => __game.startLevel(2, { score: 0, coins: 0, lives: 5, power: 0 }));
await page.waitForTimeout(2400);
await page.evaluate(() => __game.teleport(56, 4));
await page.waitForTimeout(1200);
console.log(await page.evaluate(() => {
  const L = __game.level.lifts[0], p = __game.player;
  const sx = Math.round(L.x - __game.vX + 8), sy = Math.round(L.y - 4 + 4);
  const d = document.getElementById('screen').getContext('2d').getImageData(sx, sy, 8, 8).data;
  const px = [];
  for (let i = 0; i < 16; i++) px.push([d[i*4], d[i*4+1], d[i*4+2]]);
  const out = { liftLevelXY: [Math.round(L.x), Math.round(L.y)], screenXY: [sx, sy], feet: Math.round(p.y+p.h),
           sample: px.slice(0,6), pstate: p.state, standing: p.standing };
}));
process.exit(0);
