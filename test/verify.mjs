/* Verification suite. Run with LIVE=1 to drive the visible desktop Chrome window
   (http://127.0.0.1:9333); otherwise it launches its own headless Chrome. */
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');

const LIVE = !!process.env.LIVE;
let browser, page;
if (LIVE) {
  browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  page = ctx.pages().find(p => p.url().includes('8123'));
  if (!page) { console.log('no game tab found in the desktop browser'); process.exit(1); }
  console.log('driving the visible window:', page.url());
  await page.reload({ waitUntil: 'networkidle' });
} else {
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  page = await browser.newPage({ viewport: { width: 640, height: 560 } });
  await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
}

const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text()); });

const results = [];
const check = (name, cond, detail = '') =>
  results.push((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '   ' + detail : ''));
const wait = async (fn, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await page.waitForTimeout(50); }
  return false;
};
const settle = () => wait(() => { const p = __game.player; return p.state === 'normal' && p.standing; }, 3000);
const noEnemies = () => page.evaluate(() => { for (const e of __game.entities) if (e.enemy) e.alive = false; });
const jump = (hold = 500) => page.evaluate(h => { __game.pressJump(h); }, hold);
const snap = () => page.evaluate(() => { const p = __game.player;
  return { x: Math.round(p.x), y: Math.round(p.y), st: p.state, power: p.power, lives: p.lives }; });

await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(2300);
await noEnemies();

/* ---------- physics ---------- */
let h = await page.evaluate(async () => {
  const p = __game.player; const y0 = p.y; let top = y0;
  __game.pressJump(600);
  for (let i = 0; i < 110; i++) { await new Promise(r => requestAnimationFrame(r)); top = Math.min(top, p.y); }
  return Math.round(y0 - top);
});
check('standing jump reaches 4 tiles, like the original', h >= 60 && h <= 70, h + 'px = ' + (h / 16).toFixed(1) + ' tiles');

await page.keyboard.down('ArrowRight'); await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(1400);
const spd = await page.evaluate(() => +__game.player.vx.toFixed(2));
check('run speed capped at 3.4', spd <= 3.5, 'vx=' + spd);
h = await page.evaluate(async () => {
  const p = __game.player; const y0 = p.y; let top = y0;
  __game.pressJump(600);
  for (let i = 0; i < 110; i++) { await new Promise(r => requestAnimationFrame(r)); top = Math.min(top, p.y); }
  return Math.round(y0 - top);
});
check('running jump reaches 5 tiles, like the original', h >= 74 && h <= 92, h + 'px = ' + (h / 16).toFixed(1) + ' tiles');
await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');

/* the tall pipes: a running jump has to clear the 4-tile-high ones */
await page.evaluate(() => { for (const e of __game.entities) e.alive = false; __game.teleport(41, 12); });
await page.waitForTimeout(400);
const tall = await page.evaluate(async () => {
  const p = __game.player;
  __game.keys.right = 1; __game.keys.run = 1;
  let overTop = false;
  for (let i = 0; i < 130; i++) {
    await new Promise(r => requestAnimationFrame(r));
    if (i === 26) __game.pressJump(600);
    if (p.x + p.w > 736 && p.x < 784 && p.y + p.h <= 144) overTop = true;
  }
  __game.keys.right = 0; __game.keys.run = 0;
  return { overTop, x: Math.round(p.x), alive: p.state !== 'dead' };
});
check('a running jump gets over the high pipes', tall.overTop && tall.alive && tall.x > 784, JSON.stringify(tall));

/* ---------- ? block -> mushroom -> super ---------- */
await noEnemies();
await page.evaluate(() => __game.teleport(21, 11));
await settle(); await jump();
await page.waitForTimeout(900);
const sprout = await page.evaluate(() => __game.entities.filter(e => ['mushroom', 'flower', 'star', '1up'].includes(e.kind)).map(e => e.kind));
check('mushroom sprouts from a ? block', sprout.includes('mushroom'), JSON.stringify(sprout));
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowRight');
const pw = await page.evaluate(async () => {
  const p = __game.player;
  for (let i = 0; i < 150; i++) { await new Promise(r => requestAnimationFrame(r)); if (p.power) break; }
  return p.power;
});
check('mario grows to super', pw >= 1, 'power=' + pw + ' ' + JSON.stringify(await snap()));
await page.screenshot({ path: 'v-super.png' });

/* ---------- brick smash while super ---------- */
await noEnemies();
await page.evaluate(() => { __game.teleport(20, 11); __game.setPower(1); });
await settle(); await jump();
await page.waitForTimeout(500);
const brick = await page.evaluate(() => ({
  rubble: __game.entities.filter(e => e.kind === 'rubble').length,
  tile: __game.level.solid[9][20], block: !!__game.level.blocks[9][20],
  power: __game.player.power, x: Math.round(__game.player.x), y: Math.round(__game.player.y),
}));
check('brick smashes into rubble (super mario)', brick.rubble >= 4, JSON.stringify(brick));

/* ---------- goomba stomp ---------- */
await noEnemies();
await page.evaluate(() => {
  const g = { kind: 'goomba', enemy: true, x: 44 * 16, y: 12 * 16, w: 15, h: 16,
              vx: 0, vy: 0, alive: true, animT: 0, flat: 0 };
  __game.entities.push(g); window.__g = g;
  __game.teleport(44, 8);
});
await page.waitForTimeout(1000);
const stomp = await page.evaluate(() => {
  const g = window.__g;
  return { flat: g ? g.flat : -1, alive: g ? g.alive : null, score: __game.player.score, lives: __game.player.lives };
});
check('stomping a goomba flattens it', stomp.flat > 0 || stomp.alive === false, JSON.stringify(stomp));

/* ---------- koopa shell ---------- */
await noEnemies();
await page.evaluate(() => {
  __game.entities.push({ kind: 'koopa', enemy: true, x: 34 * 16, y: 11 * 16, w: 14, h: 32,
                         vx: 0, vy: 0, alive: true, animT: 0, shell: false, shellIdle: 0 });
  __game.teleport(34, 8);
});
await page.waitForTimeout(1000);
const koopa = await page.evaluate(() => { const k = __game.entities.find(e => e.kind === 'koopa');
  return k ? { shell: k.shell, h: k.h, alive: k.alive } : null; });
check('koopa becomes a shell when stomped', !!koopa && koopa.shell === true, JSON.stringify(koopa));
await page.screenshot({ path: 'v-koopa.png' });

/* ---------- warp pipe -> tunnel -> overworld ---------- */
await noEnemies();
await page.evaluate(() => __game.teleport(58, 8));
await settle();
await page.evaluate(() => { __game.keys.down = 1; });
const inTunnel = await wait(() => __game.level.underground === true, 6000);
await page.evaluate(() => { __game.keys.down = 0; });
await settle();
check('down pipe leads to the underground tunnel', inTunnel, JSON.stringify(await snap()));
await page.screenshot({ path: 'v-tunnel.png' });

await page.keyboard.down('ArrowRight');
const backOut = await wait(() => __game.level.underground === false, 9000);
await page.waitForTimeout(1500);
await page.keyboard.up('ArrowRight');
await noEnemies();
const emerged = await page.evaluate(() => { const p = __game.player;
  return { x: Math.round(p.x), y: Math.round(p.y), st: p.state, standing: p.standing }; });
check('tunnel pipe returns you to the overworld', backOut && Math.abs(emerged.x - 2616) < 60, JSON.stringify(emerged));
await page.screenshot({ path: 'v-return.png' });

/* ---------- hidden 1-up block (running jump) ---------- */
await noEnemies();
await page.evaluate(() => __game.teleport(104, 11));
await settle();
await page.keyboard.down('ArrowRight'); await page.keyboard.down('ShiftLeft');
/* jump trigger runs in-page at 60 fps — a Playwright round-trip is far too coarse */
await page.evaluate(() => new Promise(res => {
  const tick = () => {
    if (__game.player.x > 109 * 16 - 26) { __game.pressJump(600); res(); }
    else requestAnimationFrame(tick);
  };
  tick();
}));
await page.waitForTimeout(1400);
await page.keyboard.up('ArrowRight'); await page.keyboard.up('ShiftLeft');
const oneup = await page.evaluate(() => ({ used: __game.level.hidden.filter(x => x.used).length,
  items: __game.entities.filter(e => e.kind === '1up').map(e => e.kind) }));
check('hidden 1-up block appears when bonked', oneup.used === 1 || oneup.items.length > 0, JSON.stringify(oneup));

/* ---------- flagpole -> castle -> course clear ---------- */
await noEnemies();
await page.evaluate(() => __game.teleport(196, 5));
await page.waitForTimeout(400);
await page.screenshot({ path: 'v-flagpole.png' });
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'v-sliding.png' });
await page.waitForTimeout(4000);
await page.keyboard.up('ArrowRight');
const cleared = await wait(() => __game.state === 'clear', 6000);
await page.screenshot({ path: 'v-clear.png' });
check('flagpole + castle walk-in finishes the level', cleared, JSON.stringify(await snap()));
await wait(() => __game.level.name === '1-2' && __game.state === 'card', 15000);
check('clearing 1-1 advances to the World 1-2 card', (await page.evaluate(() => __game.level.name)) === '1-2');
await page.screenshot({ path: 'v-card12.png' });
await wait(() => __game.state === 'play', 6000);

/* ---------- world 1-2: underground ---------- */
const ug = await page.evaluate(() => ({
  name: __game.level.name,
  ceiling: __game.solidAt(2, 30),
  plants: __game.entities.filter(e => e.kind === 'plant').length,
  spawn: { x: __game.player.x, y: __game.player.y },
}));
check('1-2 is underground with piranha pipes', ug.name === '1-2' && ug.ceiling > 0 && ug.plants === 2, JSON.stringify(ug));
await page.evaluate(() => __game.teleport(124, 12));
await wait(() => __game.entities.some(e => e.kind === 'plant' && e.out > 8), 6000);
const plantOut = await page.evaluate(() => Math.max(...__game.entities.filter(e => e.kind === 'plant').map(e => e.out)));
check('piranha plant rises out of its pipe', plantOut > 8, 'out=' + Math.round(plantOut));
await page.screenshot({ path: 'v-plants.png' });
await page.evaluate(() => __game.teleport(121, 10));
await page.waitForTimeout(300);
await page.keyboard.down('ArrowDown');
const inRoom = await wait(() => __game.level.cols === 18, 4000);   /* the coin room is 18 cols wide */
await page.keyboard.up('ArrowDown');
check('first pipe hides the coin heaven', inRoom, JSON.stringify(await snap()));
await page.screenshot({ path: 'v-coinroom.png' });
await page.keyboard.down('ArrowRight');
const backMain = await wait(() => __game.level.cols === 240 && __game.player.x > 2100, 8000);
await page.keyboard.up('ArrowRight');
check('coin heaven pipe spits you back into 1-2', backMain, JSON.stringify(await snap()));

/* the lift corridor, and the roof walk above the ceiling it unlocks */
await page.evaluate(() => {
  for (const e of __game.entities) if (Math.abs(e.x - 2760) < 200) e.alive = false;
  __game.level.lifts[3].y = 64; __game.level.lifts[3].dir = -1;
  __game.teleport(173, 3);
});
const rode = await wait(() => __game.player.standing &&
  Math.abs((__game.player.y + __game.player.h) - __game.level.lifts[3].y) <= 3, 4000);
await page.keyboard.down('ArrowRight');
const onRoof = await wait(() => (__game.player.y + __game.player.h) === 32 && __game.player.x > 2860, 5000);
await page.keyboard.up('ArrowRight');
check('the 1-2 lift carries you onto the roof walk', rode && onRoof,
  JSON.stringify(await page.evaluate(() => ({ x: Math.round(__game.player.x), feet: Math.round(__game.player.y + __game.player.h) }))));
await page.screenshot({ path: 'v-roof.png' });

await page.evaluate(() => __game.teleport(182, 12));
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(3600);
const outdoor = await page.evaluate(() => ({ x: Math.round(__game.player.x), st: __game.player.state }));
await page.screenshot({ path: 'v-outdoor.png' });
await page.keyboard.up('ArrowRight');
check('1-2 exit pipe reaches the outdoor stretch', outdoor.x >= 3144 && outdoor.x < 3400, JSON.stringify(outdoor));
await page.evaluate(() => __game.teleport(220, 3));
await page.keyboard.down('ArrowRight');
const cleared2 = await wait(() => __game.state === 'clear', 9000);
await page.keyboard.up('ArrowRight');
check('flagpole in 1-2 clears the world', cleared2, JSON.stringify(await snap()));
await wait(() => __game.level.name === '1-3' && __game.state === 'card', 15000);
check('clearing 1-2 advances to the World 1-3 card', (await page.evaluate(() => __game.level.name)) === '1-3');

/* ---------- world 1-3: hills, lifts, cheep cheeps ---------- */
const ath = await page.evaluate(() => ({ name: __game.level.name, lifts: __game.level.lifts.length,
                                         grass: __game.solidAt(12, 19) }));
check('1-3 is the hill course with four lifts', ath.name === '1-3' && ath.lifts === 4 && ath.grass > 0, JSON.stringify(ath));
await wait(() => __game.state === 'play', 6000);
await page.evaluate(() => __game.teleport(56, 4));
const riding = await wait(() => __game.player.standing &&
  Math.abs((__game.player.y + __game.player.h) - __game.level.lifts[0].y) <= 2, 5000);
check('mario rides a moving lift', riding,
  JSON.stringify(await page.evaluate(() => ({ feet: Math.round(__game.player.y + __game.player.h), lift: Math.round(__game.level.lifts[0].y) }))));
await page.screenshot({ path: 'v-lift.png' });
const cheep = await wait(() => __game.entities.some(e => e.kind === 'cheep'), 8000);
check('cheep cheeps leap through the course', cheep,
  JSON.stringify(await page.evaluate(() => __game.entities.filter(e => e.kind === 'cheep').length)));
await page.evaluate(() => __game.teleport(146, 11));
await page.keyboard.down('ArrowRight');
const cleared3 = await wait(() => __game.state === 'clear', 12000);
await page.keyboard.up('ArrowRight');
check('flagpole in 1-3 clears the world', cleared3, JSON.stringify(await snap()));
await wait(() => __game.level.name === '1-4' && __game.state === 'card', 15000);
check('clearing 1-3 advances to the World 1-4 card', (await page.evaluate(() => __game.level.name)) === '1-4');

/* ---------- world 1-4: Bowser's castle ---------- */
const cast = await page.evaluate(() => ({ name: __game.level.name, dark: __game.level.dark,
  lava: __game.level.lava.length, bars: __game.level.firebars.length, pods: __game.level.podoboos.length,
  bowser: !!__game.level.bowser, bridge: !!__game.level.bridge, axe: !!__game.level.axe }));
check('1-4 is the castle: lava, fire bars, podoboos, bridge, axe, bowser',
  cast.name === '1-4' && cast.dark && cast.lava === 4 && cast.bars === 9 && cast.pods === 4 &&
  cast.bowser && cast.bridge && cast.axe, JSON.stringify(cast));
await wait(() => __game.state === 'play', 6000);
await page.evaluate(() => { __game.teleport(124, 11); __game.setPower(2); });
const bx0 = await page.evaluate(() => Math.round(__game.entities.find(e => e.kind === 'bowser').x));
const fired = await wait(() => __game.entities.some(e => e.kind === 'flame'), 6000);
const bx1 = await page.evaluate(() => Math.round(__game.entities.find(e => e.kind === 'bowser').x));
check('bowser paces the bridge and spits fire', bx1 !== bx0 && fired, JSON.stringify({ bx0, bx1, fired }));
await page.screenshot({ path: 'v-bowser.png' });
let hurt = false;
for (let i = 0; i < 5 && !hurt; i++) {
  const b = await page.evaluate(() => { const b = __game.entities.find(e => e.kind === 'bowser');
    return b ? { x: b.x, falling: b.falling } : null; });
  if (!b || b.falling) break;
  await page.evaluate(c => __game.teleport(c, 7), Math.round((b.x + 16) / 16));
  await page.waitForTimeout(450);
  hurt = await page.evaluate(() => (__game.entities.find(e => e.kind === 'bowser') || {}).hp < 5);
}
check('stomping bowser drives him back', hurt,
  JSON.stringify(await page.evaluate(() => (__game.entities.find(e => e.kind === 'bowser') || {}).hp)));
await page.evaluate(() => { __game.teleport(138, 12); });
await page.keyboard.down('ArrowRight');
const axed = await wait(() => __game.level.axe.taken, 8000);
await page.keyboard.up('ArrowRight');
check('the axe is reached past the bridge', axed, JSON.stringify(await snap()));
const cleared4 = await wait(() => __game.state === 'clear', 12000);
check('the bridge collapse clears the world', cleared4, JSON.stringify(await snap()));
const ending = await wait(() => __game.state === 'ending', 15000);
await page.screenshot({ path: 'v-ending.png' });
check('beating 1-4 shows the princess ending', ending, JSON.stringify(await snap()));
await wait(() => __game.state === 'title', 20000);

/* ---------- death ---------- */
await page.keyboard.press('Enter');
await page.waitForTimeout(2300);
const lives0 = await page.evaluate(() => __game.player.lives);
await page.evaluate(n => { window.__l0 = n; }, lives0);
await page.evaluate(() => { __game.player.y = 400; });
await wait(() => __game.player.lives < window.__l0, 5000);
const lives1 = await page.evaluate(() => __game.player.lives);
check('falling in a pit costs a life', lives1 === lives0 - 1, lives0 + ' -> ' + lives1);

console.log(results.join('\n'));
console.log('page errors:', JSON.stringify(errs));
if (LIVE) process.exit(0); else await browser.close();
