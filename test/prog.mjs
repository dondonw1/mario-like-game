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
await page.waitForTimeout(2600);
const shot = async n => { const d = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png').split(',')[1]); fs.writeFileSync(n + '.png', Buffer.from(d, 'base64')); };
/* finish 1-1 the normal way */
await page.evaluate(() => __game.teleport(196, 11));
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 10; i++) { await page.waitForTimeout(700); const s = await page.evaluate(() => __game.state); if (s === 'clear') break; }
await page.keyboard.up('ArrowRight');
console.log('1-1 cleared:', await page.evaluate(() => __game.state));
await shot('test/prog-clear');
for (let i = 0; i < 14; i++) {
  const s = await page.evaluate(() => ({ st: __game.state, name: __game.level.name, idx: __game.levelIndex }));
  if (s.idx === 1 && s.st === 'card') { console.log('advanced to card:', JSON.stringify(s)); break; }
  await page.waitForTimeout(700);
}
await shot('test/prog-card');
await page.waitForTimeout(2200);
console.log('now playing:', await page.evaluate(() => ({ st: __game.state, name: __game.level.name, music: __game.musicName && __game.musicName() })));
await page.evaluate(() => __game.teleport(196, 11));
await page.waitForTimeout(600);
await shot('test/prog-outdoor');
console.log(errs.length ? errs.join('\n') : 'no errors');
process.exit(0);
