import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');

const URL = 'http://127.0.0.1:8123/index.html';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: 'test/shot-title.png' });

await page.keyboard.press('Enter');           // start
await page.waitForTimeout(2400);              // WORLD 1-1 card
await page.screenshot({ path: 'test/shot-start.png' });
console.log('after start:', await page.evaluate(() => JSON.stringify({ state: __game.state, p: { x: __game.player.x, y: __game.player.y, power: __game.player.power } })));

// walk right a while, jumping occasionally
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(700);
  await page.keyboard.down('Space');
  await page.waitForTimeout(220);
  await page.keyboard.up('Space');
}
await page.screenshot({ path: 'test/shot-run.png' });
console.log('after run:', await page.evaluate(() => JSON.stringify({ state: __game.state, vX: Math.round(__game.vX), p: { x: Math.round(__game.player.x), y: Math.round(__game.player.y), vx: +__game.player.vx.toFixed(2), vy: +__game.player.vy.toFixed(2), power: __game.player.power, h: __game.player.h }, score: __game.player.score })));

// measure jump height
const jump = await page.evaluate(async () => {
  const p = __game.player;
  const y0 = p.y;
  __game.keys.jump = 1;
  let best = y0;
  for (let i = 0; i < 90; i++) {
    await new Promise(r => requestAnimationFrame(r));
    best = Math.min(best, p.y);
  }
  __game.keys.jump = 0;
  return { y0, best, height: y0 - best };
});
console.log('jump:', JSON.stringify(jump));
await page.keyboard.up('ArrowRight');
await page.screenshot({ path: 'test/shot-jump.png' });

// teleport near the flagpole to test the end sequence
await page.evaluate(() => { const p = __game.player; p.x = 190 * 16; p.y = 11 * 16; __game.vX = p.x - 100; });
await page.waitForTimeout(300);
await page.screenshot({ path: 'test/shot-castle.png' });
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(3500);
await page.screenshot({ path: 'test/shot-flag.png' });
console.log('end:', await page.evaluate(() => JSON.stringify({ state: __game.state, p: { x: Math.round(__game.player.x), y: Math.round(__game.player.y), state: __game.player.state }, score: __game.player.score })));

console.log('ERRORS:', JSON.stringify(errors, null, 1));
await browser.close();
