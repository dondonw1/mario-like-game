import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
const errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.evaluate(() => __game.startLevel(2, { score: 0, coins: 0, lives: 5, power: 0 }));
await page.waitForTimeout(2400);
const shot = async n => { const d = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png').split(',')[1]); fs.writeFileSync(n + '.png', Buffer.from(d, 'base64')); };
/* ride the first lift (spans cols 55..57, travels rows 3..9) */
await page.evaluate(() => __game.teleport(56, 8));
let rode = false;
for (let i = 0; i < 24; i++) {
  const v = await page.evaluate(() => ({ py: Math.round(__game.player.y + __game.player.h), ly: Math.round(__game.level.lifts[0].y), st: __game.player.standing, state: __game.player.state }));
  if (v.st && Math.abs(v.py - v.ly) <= 2) { rode = true; console.log('riding lift at', JSON.stringify(v)); break; }
  await page.waitForTimeout(250);
}
console.log('rode lift:', rode);
await shot('test/l13-ride');
/* flagpole run */
await page.evaluate(() => __game.teleport(146, 11));
await page.keyboard.down('ArrowRight');
const cleared = await (async () => { for (let i = 0; i < 20; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => __game.state) === 'clear') return true; } return false; })();
await page.keyboard.up('ArrowRight');
console.log('1-3 cleared:', cleared, await page.evaluate(() => ({ flagY: Math.round(__game.level.flagpole.flagY), x: Math.round(__game.player.x) })));
await shot('test/l13-clear');
console.log(errs.length ? errs.slice(0,5).join('\n') : 'no errors');
process.exit(0);
