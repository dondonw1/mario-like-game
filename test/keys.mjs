import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
console.log('url:', page.url());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.keyboard.press('Enter');
await page.waitForTimeout(2600);
console.log('state:', await page.evaluate(() => __game.state));
await page.evaluate(() => __game.teleport(40, 12));
await page.waitForTimeout(300);
console.log('after tp:', await page.evaluate(() => ({ x: Math.round(__game.player.x), feet: Math.round(__game.player.y + __game.player.h), st: __game.state, time: __game.level ? undefined : undefined })));
await page.keyboard.down('ArrowRight');
await page.keyboard.down('ShiftLeft');
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(400);
  console.log(await page.evaluate(() => `keys=${JSON.stringify(__game.keys)} vx=${__game.player.vx.toFixed(2)} x=${Math.round(__game.player.x)} feet=${Math.round(__game.player.y+__game.player.h)} st=${__game.state}`));
}
await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
process.exit(0);
