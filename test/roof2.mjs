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
await page.evaluate(() => __game.startLevel(1, { score: 0, coins: 0, lives: 5, power: 0 }));
await page.waitForTimeout(2600);
await page.evaluate(() => __game.teleport(172, 12));
for (let i = 0; i < 10; i++) {
  console.log(await page.evaluate(() => {
    const p = __game.player, L = __game.level.lifts[3];
    return `st=${__game.state} p=(${Math.round(p.x)},${Math.round(p.y)}) vy=${p.vy.toFixed(1)} stnd=${p.standing?1:0} lives=${p.lives} lift=${Math.round(L.y)} d=${L.dir} solid13_172=${__game.solidAt(13,172)} solid12_172=${__game.solidAt(12,172)}`;
  }));
  await page.waitForTimeout(300);
}
process.exit(0);
