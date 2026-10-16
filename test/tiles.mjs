import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.keyboard.press('Enter');
await page.waitForTimeout(2600);
console.log(await page.evaluate(() => {
  let s = '';
  for (let r = 8; r <= 14; r++) { let row = `r${r}: `; for (let c = 36; c <= 48; c++) row += String(__game.solidAt(r, c) % 10); s += row + '\n'; }
  return s;
}));
process.exit(0);
