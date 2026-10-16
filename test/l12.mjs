import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await page.evaluate(() => __game.startLevel(1, { score: 0, coins: 0, lives: 3, power: 0 }));
await page.waitForTimeout(2300);           /* card -> play */
const shot = async n => {
  const d = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png').split(',')[1]);
  fs.writeFileSync(n + '.png', Buffer.from(d, 'base64'));
};
console.log('start:', await page.evaluate(() => ({ st: __game.state, name: __game.level.name, x: Math.round(__game.player.x), y: Math.round(__game.player.y), vy: +__game.player.vy.toFixed(2), standing: __game.player.standing })));
await shot('test/l12-start');
/* walk right across the level */
await page.keyboard.down('ArrowRight'); await page.keyboard.down('ShiftLeft');
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(1000);
  await page.evaluate(() => { if (__game.player.standing && Math.random() < 1) __game.pressJump(300); });
  await shot('test/l12-run' + i);
}
await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
console.log('after run:', await page.evaluate(() => ({ x: Math.round(__game.player.x), y: Math.round(__game.player.y), st: __game.player.state, lives: __game.player.lives, power: __game.player.power, plants: __game.entities.filter(e => e.kind === 'plant').length })));
console.log(errs.length ? errs.slice(0, 8).join('\n') : 'no errors');
process.exit(0);
