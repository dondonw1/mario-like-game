import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 600, height: 520 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text()); });
const st = () => page.evaluate(() => {
  const p = __game.player;
  return { state: __game.state, lvl: __game.level.name, x: Math.round(p.x), y: Math.round(p.y),
           power: p.power, h: p.h, lives: p.lives, coins: p.coins, score: p.score,
           ents: __game.entities.length };
});

await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
await page.waitForTimeout(2300);
console.log('start      ', JSON.stringify(await st()));

/* --- jump height (standing, held) --- */
let h = await page.evaluate(async () => {
  const p = __game.player; const y0 = p.y; let top = y0;
  __game.pressJump(400);
  for (let i = 0; i < 90; i++) { await new Promise(r => requestAnimationFrame(r)); top = Math.min(top, p.y); }
  return Math.round(y0 - top);
});
console.log('standing jump height px =', h, '=', (h / 16).toFixed(2), 'tiles');

/* --- running jump height --- */
await page.keyboard.down('ArrowRight'); await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(1500);
h = await page.evaluate(async () => {
  const p = __game.player; const y0 = p.y; let top = y0; const sp = Math.abs(p.vx);
  __game.pressJump(400);
  for (let i = 0; i < 90; i++) { await new Promise(r => requestAnimationFrame(r)); top = Math.min(top, p.y); }
  return Math.round(y0 - top) + '|' + sp.toFixed(2);
});
console.log('running jump height px =', h, '=', (h / 16).toFixed(2), 'tiles, speed', await page.evaluate(() => +__game.player.vx.toFixed(2)));
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('ArrowRight');

/* --- mushroom: bonk the ? block at 21,9 --- */
await page.evaluate(() => { __game.teleport(19, 11); });
await page.waitForTimeout(200);
await page.keyboard.press('Space');
await page.waitForTimeout(1200);
await page.screenshot({ path: 'test/t-mushroom.png' });
console.log('after block', JSON.stringify(await st()));
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight');
await page.waitForTimeout(600);
console.log('after grab ', JSON.stringify(await st()));
await page.screenshot({ path: 'test/t-super.png' });

/* --- brick smash as super mario --- */
await page.evaluate(() => { __game.teleport(20, 11); __game.setPower(1); __game.player.h = 32; __game.player.y -= 16; });
await page.waitForTimeout(150);
await page.keyboard.press('Space');
await page.waitForTimeout(700);
console.log('after brick', JSON.stringify(await st()));
await page.screenshot({ path: 'test/t-brick.png' });

/* --- warp pipe into the tunnel --- */
await page.evaluate(() => { __game.teleport(58, 8); __game.keys.down = 1; });
await page.waitForTimeout(1200);
console.log('in pipe    ', JSON.stringify(await st()), await page.evaluate(() => JSON.stringify({dir:__game.player.pipeDir, dist:__game.player.pipeDist})));
await page.waitForTimeout(1500);
await page.evaluate(() => { __game.keys.down = 0; });
console.log('in tunnel  ', JSON.stringify(await st()));
await page.screenshot({ path: 'test/t-tunnel.png' });
await page.evaluate(() => { __game.keys.down = 0; });

/* --- walk right into the tunnel exit pipe --- */
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(1500);
console.log('mid pipe   ', JSON.stringify(await st()), await page.evaluate(() => JSON.stringify({dir:__game.player.pipeDir, dist:__game.player.pipeDist, tgt:__game.player.pipeTarget})));
await page.waitForTimeout(3500);
await page.keyboard.up('ArrowRight');
console.log('back out   ', JSON.stringify(await st()));
await page.screenshot({ path: 'test/t-return.png' });

/* --- flagpole + castle --- */
await page.evaluate(() => { __game.teleport(196, 6); });
await page.waitForTimeout(200);
await page.screenshot({ path: 'test/t-flagpole.png' });
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(7000);
await page.keyboard.up('ArrowRight');
console.log('flag/end   ', JSON.stringify(await st()));
await page.screenshot({ path: 'test/t-clear.png' });
await page.waitForTimeout(4000);
console.log('after clear', JSON.stringify(await st()));

/* --- death + game over --- */
await page.evaluate(() => { __game.startLevel('overworld', null); });
await page.waitForTimeout(2300);
await page.evaluate(() => { __game.player.y = 400; });
await page.waitForTimeout(2500);
console.log('after pit  ', JSON.stringify(await st()));

console.log('ERRORS:', JSON.stringify(errs));
await browser.close();
