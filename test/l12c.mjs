import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.evaluate(() => __game.startLevel(1, { score: 0, coins: 0, lives: 3, power: 0 }));
await page.waitForTimeout(2300);
const shot = async n => { const d = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png').split(',')[1]); fs.writeFileSync(n + '.png', Buffer.from(d, 'base64')); };
await page.evaluate(() => __game.teleport(182, 12));
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(2600);
console.log('after exit pipe:', await page.evaluate(() => ({ x: Math.round(__game.player.x), y: Math.round(__game.player.y), st: __game.player.state, pd: __game.player.pipeDir })));
await shot('test/l12-out');
await page.waitForTimeout(1500);
/* run right up the staircase to the flagpole */
await page.evaluate(() => __game.teleport(218, 3));
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => { if (__game.player.standing) __game.pressJump(400); });
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => ({ x: Math.round(__game.player.x), st: __game.state, pstate: __game.player.state }));
  console.log('  run', i, JSON.stringify(s));
  if (s.st === 'clear' || s.pstate === 'flag') break;
}
await shot('test/l12-flag');
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(6000);
console.log('end state:', await page.evaluate(() => ({ st: __game.state, flagY: __game.level.flagpole && Math.round(__game.level.flagpole.flagY), x: Math.round(__game.player.x) })));
await shot('test/l12-end');
console.log(errs.length ? errs.slice(0,5).join('\n') : 'no errors');
process.exit(0);
