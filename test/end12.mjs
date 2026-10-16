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
await page.evaluate(() => __game.startLevel(1, { score: 1234, coins: 7, lives: 3, power: 2 }));
await page.waitForTimeout(2300);
const shot = async n => { const d = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png').split(',')[1]); fs.writeFileSync(n + '.png', Buffer.from(d, 'base64')); };
await shot('test/l12-outdoor');
await page.evaluate(() => __game.teleport(220, 3));
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 8; i++) { await page.waitForTimeout(700); const s = await page.evaluate(() => __game.state); if (s === 'clear') break; }
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(1500);
await shot('test/l12-clear');
for (let i = 0; i < 12; i++) { const s = await page.evaluate(() => __game.state); if (s === 'ending') break; await page.waitForTimeout(800); }
console.log('state:', await page.evaluate(() => __game.state), 'score:', await page.evaluate(() => __game.player.score));
await shot('test/l12-ending');
console.log(errs.length ? errs.join('\n') : 'no errors');
process.exit(0);
