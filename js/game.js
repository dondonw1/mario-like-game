/* Super Mario Bros. style platformer — HTML5 canvas, 256x240 NES resolution.
 * Art & audio: ripped SMB assets (see README.md). Engine: written from scratch here.
 */
'use strict';

/* ------------------------------------------------------------------ *
 * 0. Constants
 * ------------------------------------------------------------------ */
const W = 256, H = 240, T = 16, ROWS = 15;
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const SOLID = { GROUND: 1, HARD: 2, BRICK: 3, QBLOCK: 4, USED: 5,
                UGROUND: 6, UHARD: 7, PIPE_TL: 8, PIPE_TR: 9,
                GRTOP_L: 20, GRTOP_M: 21, GRTOP_R: 22,
                CBLOCK: 23, BRIDGE: 24,
                PIPE_ML: 10, PIPE_MR: 11, HPIPE: 12 };
const SOLID_CODES = new Set(Object.values(SOLID));

/* physics (units: pixels / frame @60Hz) */
/* Vertical physics taken straight from the SMB disassembly (JumpMForceData,
   FallMForceData, PlayerYSpdData): a standing jump peaks at exactly 4 tiles, a
   full-speed one at 5 tiles, holding the button keeps the weak ascent gravity,
   letting go cuts the jump short, and the fall is capped at 4 px/frame as in the
   original.  The index follows the running speed, exactly like the original's. */
const JUMP_TBL = [
  { v: 4, hold: 32 / 256, fall: 112 / 256 },
  { v: 4, hold: 32 / 256, fall: 112 / 256 },
  { v: 4, hold: 30 / 256, fall: 96 / 256 },
  { v: 5, hold: 40 / 256, fall: 144 / 256 },
  { v: 5, hold: 40 / 256, fall: 144 / 256 },
];
const jumpIndex = vx => Math.max(0, Math.min(4, Math.floor(Math.abs(vx) * 1.5)));
const GRAV_HOLD = 32 / 256, GRAV_FALL = 112 / 256, MAX_FALL = 4.0;
const WALK_MAX = 2.0, RUN_MAX = 3.4;
const ACC = 0.055, RUN_ACC = 0.10, SKID = 0.28, FRICTION = 0.085;

/* ------------------------------------------------------------------ *
 * 1. Assets
 * ------------------------------------------------------------------ */
const IMG = {};
const IMAGES = {
  tiles:   'assets/sprites/tiles.png',
  player:  'assets/sprites/player.png',
  playerl: 'assets/sprites/playerl.png',
  enemy:   'assets/sprites/enemy.png',
  enemyr:  'assets/sprites/enemyr.png',
  items:   'assets/sprites/items.png',
  castle:  'assets/sprites/castle.png',
  font:    'assets/sprites/font.png',
};

const SND = {};
const SOUNDS = {
  jumpSmall: 'jump-small.wav', jumpSuper: 'jump-super.wav', coin: 'coin.wav',
  powerup: 'powerup.wav', sprout: 'itemAppear.wav', stomp: 'stomp.wav',
  kick: 'kick.wav', bump: 'bump.wav', breakBlock: 'breakblock.wav',
  pipe: 'pipe.wav', death: 'mariodie.wav', flagpole: 'flagpole.wav',
  clear: 'stage_clear.wav', fireball: 'fireball.wav',
};
const MUSIC = {
  overworld: 'assets/sounds/aboveground_bgm.ogg',
  underground: 'assets/sounds/underground_bgm.ogg',
};

let muted = false;
let audioReady = false;
function initAudio() {
  if (audioReady) return;
  audioReady = true;
  for (const [k, f] of Object.entries(SOUNDS)) {
    const a = new Audio('assets/sounds/' + f);
    a.preload = 'auto'; a.volume = 0.35; SND[k] = a;
  }
  for (const [k, src] of Object.entries(MUSIC)) {
    const a = new Audio(src);
    a.preload = 'auto'; a.loop = true; a.volume = 0.25; SND['music_' + k] = a;
  }
}
function sfx(name) {
  const a = SND[name];
  if (!a || muted) return;
  try { a.currentTime = 0; a.play().catch(() => {}); } catch (e) {}
}
function playMusic(name) {
  const a = SND['music_' + name];
  if (!a) return;
  if (muted) return;
  try { a.play().catch(() => {}); } catch (e) {}
}
function stopMusic() {
  for (const k of ['music_overworld', 'music_underground']) {
    const a = SND[k]; if (a) { a.pause(); a.currentTime = 0; }
  }
}
function pauseMusic() { for (const k of ['music_overworld','music_underground']) { const a = SND[k]; if (a) a.pause(); } }
function resumeMusic() { if (!muted && musicTrack) playMusic(musicTrack); }
let musicTrack = null;
function setMusic(name) {
  stopMusic(); musicTrack = name;
  if (name) playMusic(name);
}

/* ------------------------------------------------------------------ *
 * 2. Input
 * ------------------------------------------------------------------ */
const keys = { left: 0, right: 0, down: 0, jump: 0, run: 0 };
let jumpPressed = false, startPressed = false;
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyK: 'jump',
  ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run', KeyJ: 'run',
  Enter: 'start', NumpadEnter: 'start',
};
addEventListener('keydown', e => {
  initAudio();
  const k = KEYMAP[e.code];
  if (!k) {
    if (e.code === 'KeyM') { muted = !muted; if (muted) pauseMusic(); else resumeMusic(); }
    if (e.code === 'KeyP' && state === 'play') { paused = !paused; if (paused) pauseMusic(); else resumeMusic(); }
    return;
  }
  if (k === 'start') startPressed = true;
  else if (k === 'jump') { if (!keys.jump) jumpPressed = true; keys.jump = 1; }
  else keys[k] = 1;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k && k !== 'start' && k !== 'jump') keys[k] = 0; if (k === 'jump') keys.jump = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; if (state === 'play') { paused = true; pauseMusic(); } });

/* touch buttons */
for (const b of document.querySelectorAll('#pad button')) {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); initAudio();
    if (k === 'jump') { if (!keys.jump) jumpPressed = true; keys.jump = 1; }
    else keys[k] = 1; };
  const off = e => { e.preventDefault(); if (k !== 'jump') keys[k] = 0; else keys.jump = 0; };
  b.addEventListener('touchstart', on); b.addEventListener('touchend', off);
  b.addEventListener('touchcancel', off); b.addEventListener('mousedown', on);
  b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
}
canvas.addEventListener('pointerdown', () => { initAudio(); startPressed = true; });

/* ------------------------------------------------------------------ *
 * 3. Drawing helpers
 * ------------------------------------------------------------------ */
function blit(sheet, sx, sy, sw, sh, dx, dy) {
  ctx.drawImage(IMG[sheet], sx, sy, sw, sh, Math.round(dx), Math.round(dy), sw, sh);
}
function blitFlip(sheet, sx, sy, sw, sh, dx, dy) {
  ctx.save();
  ctx.translate(Math.round(dx) + sw, Math.round(dy));
  ctx.scale(-1, 1);
  ctx.drawImage(IMG[sheet], sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.restore();
}
/* frame strip animation: frames laid out horizontally in the sheet */
function blitAnim(sheet, sx, sy, sw, sh, frames, fps, t, dx, dy, flip) {
  const i = frames[Math.floor(t * fps) % frames.length];
  const src = sx + i * sw;
  if (flip) blitFlip(sheet, src, sy, sw, sh, dx, dy);
  else blit(sheet, src, sy, sw, sh, dx, dy);
}

const FONT_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ -x!?.\u00a9'/:*+";
function text(str, x, y, color) {
  ctx.fillStyle = color || '#fcfcfc';
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const i = FONT_CHARS.indexOf(ch);
    if (i >= 0) ctx.drawImage(IMG.font, i * 8, 0, 8, 8, Math.round(cx), Math.round(y), 8, 8);
    cx += 8;
  }
  return cx;
}
function textCentered(str, y, color) { text(str, (W - String(str).length * 8) / 2, y, color); }

/* ------------------------------------------------------------------ *
 * 4. Level construction
 * ------------------------------------------------------------------ */
let level = null;

function makeLevel(opts) {
  const g = {
    lifts: [], lava: [], firebars: [], podoboos: [], bridge: null, axe: null, bowser: null,
    dark: false, collapsing: 0, boss: false,
    name: opts.name, cols: opts.cols, underground: !!opts.underground,
    solid: [], blocks: [], scenery: [], enemies: [], items: [], pipes: [],
    flagpole: null, castle: null, spawn: opts.spawn, hidden: [],
  };
  for (let r = 0; r < ROWS; r++) {
    g.solid.push(new Array(opts.cols).fill(0));
    g.blocks.push(new Array(opts.cols).fill(null));
  }
  return g;
}
function setTile(r, c, code) {
  if (r < 0 || r >= ROWS || c < 0 || c >= level.cols) return;
  level.solid[r][c] = code;
}
function solidAt(r, c) {
  if (r < 0) return 0;                 // open sky above
  if (r >= ROWS) return 0;            // below the map = pit
  if (c < 0 || c >= level.cols) return SOLID.HARD;
  return level.solid[r][c];
}
function isSolid(r, c) { return SOLID_CODES.has(solidAt(r, c)); }

/* --- builders (coordinates taken from the SMB 1-1 map) --- */
function putFloor(c0, c1) {
  for (let c = c0; c <= c1; c++) {
    setTile(13, c, level.underground ? SOLID.UGROUND : SOLID.GROUND);
    setTile(14, c, level.underground ? SOLID.UGROUND : SOLID.GROUND);
  }
}
function putWall(c, baseRow, h) {
  for (let r = baseRow - h; r < baseRow; r++)
    setTile(r, c, level.underground ? SOLID.UHARD : SOLID.HARD);
}
function putBrick(r, c, item) {
  setTile(r, c, SOLID.BRICK);
  level.blocks[r][c] = { type: 'brick', item: item || null, used: false, bounce: 0, broken: false };
}
function putQ(r, c, item) {
  setTile(r, c, SOLID.QBLOCK);
  level.blocks[r][c] = { type: 'q', item: item || 'coin', used: false, bounce: 0 };
}
function putHidden(r, c, item) {
  level.hidden.push({ r, c, item: item || '1up', used: false, bounce: 0 });
}
function putPipe(c, baseRow, h) {
  for (let r = baseRow - h; r < baseRow; r++) {
    const top = (r === baseRow - h);
    setTile(r, c, top ? SOLID.PIPE_TL : SOLID.PIPE_ML);
    setTile(r, c + 1, top ? SOLID.PIPE_TR : SOLID.PIPE_MR);
  }
}
function putHPipe(c, r) {   /* 3 wide x 2 tall, mouth facing left (you walk right into it) */
  for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 3; dc++) setTile(r + dr, c + dc, SOLID.HPIPE);
  level.pipes.push({ x: c * T, y: r * T, w: 0, h: 2 * T, dir: 'right' });
}
function putPillar(c0, c1, topRow) {
  for (let c = c0; c <= c1; c++) {
    setTile(topRow, c, c === c0 ? SOLID.GRTOP_L : (c === c1 ? SOLID.GRTOP_R : SOLID.GRTOP_M));
    for (let r = topRow + 1; r <= 14; r++) setTile(r, c, SOLID.GROUND);
  }
}
function putCastle(c0, c1, r0, r1) {
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) setTile(r, c, SOLID.CBLOCK);
}
function putLava(c0, c1, r0, r1) { level.lava.push({ x: c0 * T, y: r0 * T, w: (c1 - c0 + 1) * T, h: (r1 - r0 + 1) * T }); }
function cutLava(c0, c1, r0, r1) {
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) setTile(r, c, 0);
  putLava(c0, c1, r0, r1);
}
function putFireBar(c, r, len) { level.firebars.push({ x: c * T + 8, y: r * T + 8, len, a: 0 }); }
function putPodoboo(c, r) { level.podoboos.push({ x: c * T, baseY: r * T, y: r * T, vy: 0, timer: Math.random() * 120 | 0 }); }
function putLift(c, r, lo, hi) {
  level.lifts.push({ x: c * T, y: r * T, w: 3 * T, h: 8, lo: lo * T, hi: hi * T, dir: 1, speed: 0.5 });
}
function putProp(sheet, sx, sy, sw, sh, px, py) {
  level.scenery.push({ sheet, sx, sy, sw, sh, x: px, y: py });
}
const HILL = [[128,128],[144,128],[160,128],[128,144],[144,144],[160,144]];
function putBigHill(c, r) {
  const p = (i, dc, dr) => putProp('tiles', HILL[i][0], HILL[i][1], 16, 16, (c + dc) * T, (r + dr) * T);
  p(0,0,0); p(3,1,0); p(0,1,-1); p(4,2,0); p(3,2,-1); p(1,2,-2); p(5,3,0); p(2,3,-1); p(2,4,0);
}
function putSmallHill(c, r) {
  const p = (i, dc, dr) => putProp('tiles', HILL[i][0], HILL[i][1], 16, 16, (c + dc) * T, (r + dr) * T);
  p(0,0,0); p(3,1,0); p(1,1,-1); p(2,2,0);
}
function putBush(c, r, n) {
  const B = [[176,144],[192,144],[208,144]];
  if (n === 1) { putProp('tiles', 176, 144, 48, 16, c * T, r * T); return; }
  for (let i = 0; i < n; i++) {
    const idx = i === 0 ? 0 : (i === n - 1 ? 2 : 1);
    putProp('tiles', B[idx][0], B[idx][1], 16, 16, (c + i) * T, r * T);
  }
}
function putCloud(c, r, n) {
  if (n === 1) { putProp('tiles', 0, 320, 48, 32, c * T, r * T); return; }
  const cols = n === 2 ? 4 : 5;
  for (let i = 0; i < cols; i++) {
    const sx = i === 0 ? 0 : (i === cols - 1 ? 32 : 16);
    putProp('tiles', sx, 320, 16, 32, (c + i) * T, r * T);
  }
}
function putFlagpole(c) {
  setTile(12, c, SOLID.HARD);
  for (let r = 3; r <= 11; r++) putProp('tiles', 256, 144, 16, 16, c * T, r * T);
  putProp('tiles', 256, 128, 16, 16, c * T, 2 * T);
  level.flagpole = { x: c * T, flagY: 49, hit: false, col: c };
}

/* ---------------- World 1-1 ---------------- */
function buildOverworld() {
  level = makeLevel({ name: '1-1', cols: 216, spawn: { x: 3 * T, y: 12 * T } });
  for (const [a, b] of [[0,69],[71,86],[89,153],[155,212]]) putFloor(a, b);

  for (const c of [7,19,56,67,87,103,152,163,200]) putCloud(c, 3, 1);
  for (const c of [36,132,180]) putCloud(c, 2, 2);
  for (const c of [27,75,123,171]) putCloud(c, 3, 3);
  for (const c of [0,48,96,144,192]) putBigHill(c, 12);
  for (const c of [16,64,111,160]) putSmallHill(c, 12);
  for (const c of [23,71,118,167]) putBush(c, 12, 1);
  for (const c of [41,89,137]) putBush(c, 12, 2);
  for (const c of [11,59,106]) putBush(c, 12, 3);

  putQ(9, 16, 'coin');
  putBrick(9, 20); putQ(9, 21, 'mushroom'); putBrick(9, 22);
  putQ(5, 22, 'coin'); putQ(9, 23, 'coin'); putBrick(9, 24);
  putPipe(28, 13, 2); putPipe(38, 13, 3); putPipe(46, 13, 4);
  level.pipes.push({ x: 57 * T, y: 9 * T, w: 2 * T, h: 4 * T, dir: 'down', to: 'tunnel' });
  putPipe(57, 13, 4);

  putBrick(9, 77); putQ(9, 78, 'mushroom'); putBrick(9, 79);
  for (let c = 80; c <= 87; c++) putBrick(5, c);
  for (let c = 91; c <= 93; c++) putBrick(5, c);
  putQ(5, 94, 'coin'); putBrick(9, 94);
  putBrick(9, 100, 'star'); putBrick(9, 101);
  putQ(9, 105, 'coin'); putQ(9, 108, 'coin'); putQ(5, 108, 'mushroom'); putQ(9, 111, 'coin');
  putHidden(9, 109, '1up');   /* sits in the block row, in the gap between two Q blocks */
  putBrick(9, 117);
  for (let c = 120; c <= 123; c++) putBrick(5, c);
  putBrick(5, 128); putQ(5, 129, 'coin'); putBrick(9, 129);
  putQ(5, 130, 'coin'); putBrick(9, 130); putBrick(5, 131);

  for (const [c, h] of [[134,1],[135,2],[136,3],[137,4],[140,4],[141,3],[142,2],[143,1]]) putWall(c, 13, h);
  for (const [c, h] of [[148,1],[149,2],[150,3],[151,4],[152,4],[155,4],[156,3],[157,2],[158,1]]) putWall(c, 13, h);
  putPipe(163, 13, 2);
  putBrick(9, 168); putBrick(9, 169); putQ(9, 170, 'coin'); putBrick(9, 171);
  putPipe(179, 13, 2);
  for (const [c, h] of [[181,1],[182,2],[183,3],[184,4],[185,5],[186,6],[187,7],[188,8],[189,8]]) putWall(c, 13, h);
  putFlagpole(198);
  level.castle = { x: 202 * T, y: 7 * T };
  level.exitX = 204 * T;

  for (const [c, r] of [[22,12],[40,12],[50,12],[51,12],[82,4],[84,4],[100,12],[102,12],
                        [114,12],[115,12],[122,12],[123,12],[125,12],[126,12],[170,12],[172,12]])
    level.enemies.push({ kind: 'goomba', c, r });
  level.enemies.push({ kind: 'koopa', c: 35, r: 11 });
}

/* ---------------- Warp-zone tunnel ---------------- */
function buildTunnel() {
  level = makeLevel({ name: '1-1', cols: 17, underground: true, spawn: { x: 11 * T, y: 12 * T } });
  putFloor(0, 16);
  putWall(0, 13, 11);
  for (let c = 4; c <= 10; c++) { putWall(c, 13, 3); putWall(c, 3, 1); }
  const coins = [[5,5],[6,5],[7,5],[8,5],[9,5],
                 [4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],
                 [4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9]];
  for (const [c, r] of coins) level.items.push({ kind: 'coin', x: c * T, y: r * T });
  putHPipe(12, 11);
  putPipe(15, 13, 3);
  level.returnTo = { build: buildOverworld, x: 163 * T + 8, y: 12 * T,
                     pp: { x: 163 * T, y: 11 * T, w: 2 * T, h: 2 * T } };
}


/* ---------------- World 1-2 (underground) ---------------- */
function buildCoinRoom() {
  level = makeLevel({ name: '1-2', cols: 18, underground: true, spawn: { x: 3 * T, y: 4 * T } });
  putFloor(0, 17);
  putWall(0, 13, 9);
  for (let c = 0; c <= 17; c++) setTile(2, c, SOLID.UHARD);
  const rows = [[4,5,6,7,8,9,10,11],[5,6,7,8,9,10,11],[4,5,6,7,8,9,10,11]];
  rows.forEach((cs, i) => cs.forEach(c => level.items.push({ kind: 'coin', x: c * T, y: (4 + i * 3) * T })));
  for (let c = 13; c <= 16; c++) putBrick(9, c, c === 13 ? 'coin' : null);
  putHPipe(14, 11);
  level.returnTo = { build: buildUnderground, x: 134 * T + 8, y: 12 * T,
                     pp: { x: 134 * T, y: 11 * T, w: 2 * T, h: 2 * T } };
}
function buildUnderground() {
  level = makeLevel({ name: '1-2', cols: 240, underground: true, spawn: { x: 2 * T, y: 0 } });
  for (const [a, b] of [[0,65],[68,95],[99,142],[145,156],[159,239]]) putFloor(a, b);
  putWall(0, 13, 11);
  /* the ceiling: solid except the entry drop and the roof-walk gaps */
  for (const [a, b] of [[20,45],[49,77],[81,109],[113,149],[151,170],[174,190]])
    for (let c = a; c <= b; c++) setTile(2, c, SOLID.UHARD);
  level.lightFrom = 191;

  /* the lift corridor: the lifts sit where the original map puts them, and the
     tall one at 171 rises through the gap in the ceiling onto the roof walk */
  for (const [c, r, lo, hi] of [[156,10,7,12],[162,9,6,12],[166,5,3,12],[171,5,1,12]])
    putLift(c, r, lo, hi);
  for (const [c, r] of [[156,6],[162,5],[166,2],[171,2]])
    level.items.push({ kind: 'coin', x: c * T, y: r * T });
  for (let c = 176; c <= 188; c++) level.items.push({ kind: 'coin', x: c * T, y: T });

  putBrick(9, 26, 'mushroom');
  for (let c = 27; c <= 30; c++) putQ(9, c, 'coin');
  for (const [c, h] of [[33,1],[35,2],[37,3],[39,4],[41,3],[43,2]]) putWall(c, 13, h);

  /* brick passage with the star at its right end */
  for (let c = 50; c <= 56; c++) putBrick(8, c);
  for (let c = 50; c <= 53; c++) putBrick(9, c);
  for (let c = 58; c <= 63; c++) { putBrick(8, c); putBrick(9, c); }
  level.blocks[8][63].item = 'star';
  for (const c of [51,52,53,54,55]) level.items.push({ kind: 'coin', x: c * T, y: 6 * T });
  for (const c of [59,60,61]) level.items.push({ kind: 'coin', x: c * T, y: 7 * T });

  /* the wide maze of hanging and rising brick columns */
  for (const [c, h] of [[68,3],[72,5],[76,3],[84,4],[88,2]])
    for (let r = 3; r <= 3 + h; r++) putBrick(r, c);
  for (const [c, h] of [[70,2],[74,3],[80,2],[86,3],[90,2]]) putWall(c, 13, h);
  for (const c of [78,79,80,81]) level.items.push({ kind: 'coin', x: c * T, y: 8 * T });

  /* the floating brick island */
  for (let c = 100; c <= 106; c++) putBrick(8, c);
  for (const c of [101,102,103,104,105]) level.items.push({ kind: 'coin', x: c * T, y: 7 * T });

  /* three piranha pipes; the first hides the bonus-room pipe */
  for (const [c, h] of [[126,3],[131,3]]) {
    putPipe(c, 13, h);
    level.enemies.push({ kind: 'plant', x: c * T + 8, pipeTop: (13 - h) * T });
  }
  putPipe(121, 13, 2);                /* enterable: the coin heaven below */
  level.pipes.push({ x: 121 * T, y: 11 * T, w: 2 * T, h: 2 * T, dir: 'down', to: 'coinroom' });
  putPipe(134, 13, 2);                    /* you come back out of this one */

  /* lifts section: a shelf with a power-up, then the pits */
  for (let c = 146; c <= 152; c++) putBrick(7, c);
  level.blocks[7][152].item = 'mushroom';
  for (const c of [148,149,150]) level.items.push({ kind: 'coin', x: c * T, y: 6 * T });

  /* the exit pipe, walked into from the left */
  putHPipe(185, 11);
  level.pipes[level.pipes.length - 1].to = 'same';
  level.sameExit = { x: 196 * T + 8, y: 12 * T, pp: { x: 196 * T, y: 11 * T, w: 2 * T, h: 2 * T } };

  /* the outdoor stretch: pipe, staircase, hill, flagpole, castle */
  putPipe(196, 13, 2);
  for (let i = 0; i < 9; i++) putWall(200 + i, 13, i + 1);
  /* the last stretch is outdoors: overworld tiles, not underground ones */
  for (let c = 191; c < level.cols; c++) {
    for (const r of [13, 14]) if (level.solid[r][c] === SOLID.UGROUND) level.solid[r][c] = SOLID.GROUND;
    for (let r = 0; r < 13; r++) if (level.solid[r][c] === SOLID.UHARD) level.solid[r][c] = SOLID.HARD;
  }
  putBigHill(213, 13);
  putFlagpole(226);
  level.castle = { x: 230 * T, y: 7 * T };
  for (const c of [194,219]) putCloud(c, 3, 1);
  putCloud(205, 2, 2);

  for (const c of [32,44,70,76,82,88,148,155,166,172]) level.enemies.push({ kind: 'goomba', c, r: 12 });
  for (const c of [52,84,90,105,170]) level.enemies.push({ kind: 'koopa', c, r: 11 });
}

/* ---------------- World 1-3 (hill / platform course) ---------------- */
function buildAthletic() {
  level = makeLevel({ name: '1-3', cols: 168, spawn: { x: 3 * T, y: 12 * T } });
  putFloor(0, 15);
  /* every grass-topped pillar, read off the level map */
  for (const [a, b, r] of [[18,21,12],[24,25,9],[26,30,5],[31,31,9],[32,34,12],[35,39,8],
                           [40,46,4],[50,53,13],[60,63,5],[65,69,13],[70,72,9],[76,81,6],
                           [98,101,11],[104,111,7],[113,115,13],[116,119,9],[122,125,9]])
    putPillar(a, b, r);
  putFloor(129, 167);

  putBrick(10, 59, 'mushroom');
  for (const [c, r] of [[27,4],[28,4],[29,4],[30,4],[33,11],[37,2],[38,2],[50,6],[51,6],
                        [60,4],[61,4],[62,4],[63,4],[74,4],[85,5],[86,5],[93,4],[94,4],
                        [97,4],[98,4],[110,6],[113,12],[114,12],[115,12],[114,5],[120,5],
                        [121,5],[133,12]])
    level.items.push({ kind: 'coin', x: c * T, y: r * T });

  for (const [c, r, lo, hi] of [[55,6,3,9],[86,8,5,11],[94,9,6,12],[131,6,3,9]]) putLift(c, r, lo, hi);

  /* the ending staircase, flagpole and castle */
  for (const [a, b, h] of [[138,139,4],[140,141,6],[142,143,7],[144,145,8]])
    for (let c = a; c <= b; c++) putWall(c, 13, h);
  putFlagpole(152);
  level.castle = { x: 156 * T, y: 7 * T };
  for (const c of [8,22,48,66,90,108,127,148]) putCloud(c, 3, 1);
  for (const c of [34,78,118]) putCloud(c, 2, 2);

  for (const [c, r] of [[42,3],[44,3],[61,4],[78,5],[79,5],[117,8],[118,8]])
    level.enemies.push({ kind: 'goomba', c, r });
  for (const [c, r] of [[27,4],[62,4],[107,6],[140,12]]) level.enemies.push({ kind: 'koopa', c, r });
  level.cheeps = true;
}

/* ---------------- World 1-4 (Bowser's castle) ---------------- */
function buildCastle() {
  level = makeLevel({ name: '1-4', cols: 160, spawn: { x: 2 * T, y: 12 * T } });
  level.dark = true;
  level.boss = true;

  putCastle(0, 159, 2, 2);                       /* the ceiling */
  for (const [a, b] of [[0,21],[35,71],[105,111],[124,128],[147,148]]) putCastle(a, b, 3, 4);
  putCastle(0, 159, 13, 14);                     /* the floor */
  putCastle(0, 4, 7, 12);                        /* the wall you start behind */
  putCastle(29, 31, 10, 12);
  putCastle(112, 115, 10, 12);
  putCastle(119, 123, 10, 12);
  putCastle(147, 149, 9, 12);
  putCastle(152, 159, 3, 4);

  cutLava(13, 14, 12, 14);
  cutLava(26, 28, 13, 14);
  cutLava(32, 34, 13, 14);
  cutLava(125, 137, 13, 14);                     /* under the bridge */

  for (const [c, r, len] of [[24,3,3],[35,5,3],[51,9,3],[62,9,4],[67,9,3],
                             [86,3,4],[94,3,3],[104,9,3],[112,9,3]]) putFireBar(c, r, len);
  for (const [c, r] of [[13,12],[27,13],[33,13],[130,13]]) putPodoboo(c, r);
  putLift(138, 6, 3, 9);

  /* the bridge, the axe and Bowser */
  level.bridge = { c0: 125, c1: 137, row: 12 };
  for (let c = 125; c <= 137; c++) setTile(12, c, SOLID.BRIDGE);
  level.axe = { x: 140 * T, y: 12 * T, taken: false };
  level.bowser = { c: 132, r: 10 };

  for (const [c, r] of [[57,9],[79,9],[99,9]]) level.enemies.push({ kind: 'goomba', c, r });
  for (const [c, r] of [[45,9],[120,9]]) level.enemies.push({ kind: 'koopa', c, r });
}

const LEVELS = [{ name: '1-1', build: buildOverworld }, { name: '1-2', build: buildUnderground },
                { name: '1-3', build: buildAthletic }, { name: '1-4', build: buildCastle }];
let levelIndex = 0;

/* ------------------------------------------------------------------ *
 * 5. Entities
 * ------------------------------------------------------------------ */
let entities = [];
let player = null;

function collideX(e, onHit) {
  if (!e.vx) return;
  const dir = e.vx > 0 ? 1 : -1;
  e.x += e.vx;
  const top = Math.floor(e.y / T), bot = Math.floor((e.y + e.h - 1) / T);
  const col = dir > 0 ? Math.floor((e.x + e.w) / T) : Math.floor(e.x / T);
  for (let r = top; r <= bot; r++) {
    if (isSolid(r, col)) {
      e.x = dir > 0 ? col * T - e.w : (col + 1) * T;
      e.vx = 0;
      if (onHit) onHit('x', r, col);
      return true;
    }
  }
  return false;
}
function collideY(e, onHit) {
  const dir = e.vy > 0 ? 1 : (e.vy < 0 ? -1 : 1);
  if (e.vy) e.y += e.vy;
  const left = Math.floor(e.x / T), right = Math.floor((e.x + e.w - 1) / T);
  /* the leading edge is the row/col just outside the box, so an entity resting
     exactly on a tile boundary still registers as standing (no flicker) */
  const row = dir > 0 ? Math.floor((e.y + e.h) / T) : Math.floor(e.y / T);
  if (!e.vy) {
    for (let c = left; c <= right; c++) {
      if (isSolid(row, c)) { e.y = row * T - e.h; e.standing = true; return true; }
    }
    return false;
  }
  let hitCol = -1;
  for (let c = left; c <= right; c++) if (isSolid(row, c)) { hitCol = c; break; }
  if (hitCol < 0) return false;
  if (dir > 0) { e.y = row * T - e.h; e.vy = 0; e.standing = true; if (onHit) onHit('floor', row, hitCol); }
  else {
    /* pick the solid tile nearest the entity centre so head-bumps feel right */
    let best = hitCol, bestD = 1e9;
    for (let c = left; c <= right; c++) {
      if (!isSolid(row, c)) continue;
      const d = Math.abs(c * T + 8 - (e.x + e.w / 2));
      if (d < bestD) { bestD = d; best = c; }
    }
    e.y = (row + 1) * T; e.vy = 0; e.bumped = { r: row, c: best };
    if (onHit) onHit('ceil', row, best);
  }
  return true;
}

/* --------------------------- player --------------------------- */
function makePlayer(x, y) {
  return {
    kind: 'player', x, y, w: 12, h: 16, vx: 0, vy: 0,
    power: 0, crouch: false, facing: 1, standing: false,
    animT: 0, state: 'normal', timer: 0, inv: 0, star: 0,
    jumpHoldG: GRAV_HOLD, jumpFallG: GRAV_FALL, fireCooldown: 0, lives: 3, coins: 0, score: 0,
    pipeDir: null, pipeGoal: 0, flagSlide: false, walkOff: false,
    grow: null,
  };
}
function spriteTop(p) { return p.y + p.h - (p.power ? 32 : 16); }
function playerSheet(p) { return p.facing < 0 ? 'playerl' : 'player'; }

/* player sprite rows: 0 = super, 32 = small, 96 = fire; invincibility rows 144/192/240 (+32 for small) */
function playerRow(p) {
  if (p.star > 0) {
    const idx = p.star > 60 ? Math.floor(p.star / 2) % 3 : Math.floor(p.star / 8) % 3;
    const base = [144, 192, 240][idx];
    return p.power === 0 ? base + 32 : base;
  }
  return p.power === 0 ? 32 : (p.power === 1 ? 0 : 96);
}
function drawPlayer(p) {
  const sheet = playerSheet(p);
  let row = playerRow(p);
  let x = 80, frames = null, fps = 0, sw = 16, sh = p.power ? 32 : 16;

  if (p.state === 'dead') { x = 176; row = 32; sh = 16; }
  else if (p.grow) {
    const g = p.grow.seq[p.grow.i];
    x = g.x; row = g.y; sw = g.sw; sh = g.sh;
  }
  else if (p.state === 'flag') {
    if (p.flagSlide) { x = 192; }
    else { x = 96; frames = [0, 1, 2]; fps = 10; }
  }
  else if (p.vy < 0 || (!p.standing && p.state === 'normal')) { x = 160; }
  else if (p.crouch && p.power) { x = 176; sh = 16; }
  else if (Math.abs(p.vx) > 0.05) {
    const skid = (p.vx > 0 && p.facing < 0) || (p.vx < 0 && p.facing > 0);
    if (skid) x = 144;
    else { x = 96; frames = [0, 1, 2]; fps = 4 + Math.abs(p.vx) * 4; }
  }
  const dy = p.y + p.h - sh;
  blitAnim(sheet, x, row, sw, sh, frames || [0], fps, p.animT, p.x - 2, dy, false);
}

function updatePlayer(p) {
  if (p.state === 'dead') {
    p.timer -= 1;
    if (p.timer <= 0) { p.vy += 0.4; p.y += p.vy; if (p.y > H + 40) respawnOrGameOver(); }
    p.animT += 1 / 60;
    return;
  }
  if (p.state === 'pipe') { updatePipeState(p); return; }
  if (p.state === 'flag') { updateFlagState(p); return; }
  if (p.grow) {                      /* frozen during grow/shrink animation */
    p.grow.t -= 1;
    if (p.grow.t <= 0) {
      p.grow.i += 1;
      if (p.grow.i >= p.grow.seq.length) p.grow = null;
      else p.grow.t = p.grow.dur[p.grow.i];
    }
    p.animT += 1 / 60;
    return;
  }

  /* horizontal control */
  const running = keys.run;
  const maxSp = running ? RUN_MAX : WALK_MAX;
  const acc = running ? RUN_ACC : ACC;
  if (keys.left && !keys.right) {
    if (p.vx > 0 && p.standing) p.vx -= SKID; else p.vx -= acc;
    if (p.standing) p.facing = -1;
  } else if (keys.right && !keys.left) {
    if (p.vx < 0 && p.standing) p.vx += SKID; else p.vx += acc;
    if (p.standing) p.facing = 1;
  } else if (p.standing) {
    if (Math.abs(p.vx) < FRICTION) p.vx = 0; else p.vx -= Math.sign(p.vx) * FRICTION;
  }
  /* over-speed (e.g. just released the run button) bleeds off, it never runs away */
  if (p.vx > maxSp) p.vx = Math.max(maxSp, p.vx - 0.15);
  if (p.vx < -maxSp) p.vx = Math.min(-maxSp, p.vx + 0.15);

  /* crouch (super only) */
  if (p.power > 0) {
    const wantCrouch = !!keys.down && p.standing;
    if (wantCrouch && !p.crouch) { p.y += 16; p.h = 16; p.crouch = true; }
    else if (!wantCrouch && p.crouch) {
      const ny = p.y - 16;
      if (!overlapsSolid(p.x, ny, p.w, 32)) { p.y = ny; p.h = 32; p.crouch = false; }
    }
  } else { p.h = 16; p.crouch = false; }
  if (p.crouch) p.vx *= 0.9;

  /* jump */
  if (jumpPressed && p.standing && !p.crouch) {
    const jt = JUMP_TBL[jumpIndex(p.vx)];
    p.vy = -jt.v; p.jumpHoldG = jt.hold; p.jumpFallG = jt.fall;
    p.standing = false;
    sfx(p.power === 0 ? 'jumpSmall' : 'jumpSuper');
  }
  jumpPressed = false;

  /* fireballs */
  if (p.fireCooldown > 0) p.fireCooldown -= 1;
  if (keys.run && p.power === 2 && p.fireCooldown === 0 &&
      entities.filter(e => e.kind === 'fireball').length < 2) {
    entities.push(makeFireball(p.x + (p.facing > 0 ? p.w : 0), p.y + 8, p.facing));
    p.fireCooldown = 12; sfx('fireball'); p.shootT = 6;
  }

  /* gravity */
  p.vy += (p.vy < 0 && keys.jump) ? p.jumpHoldG : p.jumpFallG;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  p.standing = false;
  collideX(p);
  const prevY = p.y;
  p.vyBefore = p.vy;          /* stomps must be judged on the pre-collision velocity */
  p.yBefore = prevY;          /* ...and on where the feet were before this frame's move */
  p.bumped = null;
  collideY(p);
  /* lifts: land on the bar, then the next frame's lift move carries you along */
  for (const L of level.lifts) {
    if (p.x + p.w <= L.x || p.x >= L.x + L.w) continue;
    const feet = p.y + p.h;
    if (p.vy >= 0 && p.yBefore + p.h <= L.y + 6 && feet >= L.y - 2 && feet <= L.y + 12) {
      p.y = L.y - p.h; p.vy = 0; p.standing = true;
    }
  }
  if (p.bumped) hitBlock(p.bumped.r, p.bumped.c, p);
  /* invisible bonus blocks (the 1-up) only show up when you bonk them */
  for (const hb of level.hidden) {
    if (hb.used) continue;
    const bx = hb.c * T, by = hb.r * T;
    /* generous by design: the block is invisible, so a near miss should still count */
    if (p.vyBefore < 0 && p.x + p.w > bx - 8 && p.x < bx + T + 8 &&
        p.y <= by + T + 6 && p.y + p.h > by) {
      p.y = by + T; p.vy = 0; hitBlock(hb.r, hb.c, p);
    }
  }

  /* keep inside the camera window */
  if (p.x < vX + 1) { p.x = vX + 1; if (p.vx < 0) p.vx = 0; }
  if (p.x + p.w > level.cols * T - 1) p.x = level.cols * T - 1 - p.w;

  /* pipes you can enter */
  if (keys.down && p.standing) {
    for (const pp of level.pipes) {
      if (pp.dir === 'down' && p.x + p.w > pp.x + 2 && p.x < pp.x + pp.w - 2 &&
          Math.abs((p.y + p.h) - pp.y) < 2) {
        enterPipe(p, 'down', pp, pp.to); return;
      }
    }
  }
  if (keys.right && p.standing) {
    for (const pp of level.pipes) {
      if (pp.dir === 'right' && p.y + p.h > pp.y && p.y < pp.y + pp.h &&
          Math.abs((p.x + p.w) - pp.x) < 4) { enterPipe(p, 'right', pp, pp.to || 'overworld'); return; }
    }
  }

  /* pit death */
  if (p.y > H + 8) killPlayer(true);

  if (p.inv > 0) p.inv -= 1;
  if (p.star > 0) p.star -= 1;
  p.animT += 1 / 60;
}
function isSolidEnemyAt() { return entities.some(e => e.enemy && e.alive); }
function killEnemyByStar() {
  for (const e of entities) if (e.enemy && e.alive) { e.flip = true; e.alive = 'flip'; e.vy = -4; addScore(200); }
}
function overlapsSolid(x, y, w, h) {
  const r0 = Math.floor(y / T), r1 = Math.floor((y + h - 1) / T);
  const c0 = Math.floor(x / T), c1 = Math.floor((x + w - 1) / T);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (isSolid(r, c)) return true;
  return false;
}

/* --------------------------- pipes --------------------------- */
function enterPipe(p, dir, pp, target) {
  p.state = 'pipe'; p.pipeDir = dir; p.pipeDist = 0; p.pipeTotal = 34;
  p.pipePP = pp; p.pipeTarget = target || null;
  p.vx = 0; p.vy = 0;
  if (p.power > 0) { p.power = 0; p.h = 16; p.y += 16; }   /* pipes shrink you, as in the original */
  p.crouch = false;
  sfx('pipe'); pauseMusic();
}
function carryPlayer(p) {
  return { score: p.score, coins: p.coins, lives: p.lives, power: p.power,
           star: p.star, inv: p.inv, timeLeft: timeLeft };
}
function updateHazards() {
  for (const fb of level.firebars) fb.a += 0.05;
  for (const pb of level.podoboos) {
    pb.timer -= 1;
    if (pb.timer <= 0 && pb.y >= pb.baseY) { pb.vy = -6.4; pb.timer = 140 + (Math.random() * 70 | 0); }
    if (pb.vy < 0 || pb.y < pb.baseY) {
      pb.vy += 0.17; pb.y += pb.vy;
      if (pb.y > pb.baseY) { pb.y = pb.baseY; pb.vy = 0; }
    }
  }
}
function hazardCollisions() {
  const p = player;
  if (p.state !== 'normal' || p.star > 0) return;
  for (const L of level.lava) {
    if (p.x + p.w > L.x && p.x < L.x + L.w && p.y + p.h > L.y + 6) { killPlayer(false); return; }
  }
  for (const fb of level.firebars) {
    if (fb.x < vX - 90 || fb.x > vX + W + 90) continue;
    for (let i = 1; i <= fb.len; i++) {
      const bx = fb.x + Math.cos(fb.a) * i * 16, by = fb.y + Math.sin(fb.a) * i * 16;
      if (p.x < bx + 7 && p.x + p.w > bx - 7 && p.y < by + 7 && p.y + p.h > by - 7) { hurtPlayer(); return; }
    }
  }
  for (const pb of level.podoboos) {
    if (pb.y <= pb.baseY - 2 && p.x < pb.x + 14 && p.x + p.w > pb.x + 2 &&
        p.y < pb.y + 14 && p.y + p.h > pb.y + 2) { hurtPlayer(); return; }
  }
}
function checkAxe() {
  const ax = level.axe;
  if (!ax || ax.taken || player.state !== 'normal') return;
  if (player.x + player.w > ax.x && player.x < ax.x + T &&
      player.y + player.h > ax.y && player.y < ax.y + T) {
    ax.taken = true;
    level.collapsing = 130;
    sfx('death');
    for (const e of entities) if (e.kind === 'bowser' && e.alive === true) { e.falling = true; e.vy = -3; e.vx = 0; }
  }
}
function updateCollapse() {
  if (!level.collapsing) return;
  level.collapsing -= 1;
  const br = level.bridge;
  if (br && !br.gone && level.collapsing < 110) {
    const step = Math.floor((110 - level.collapsing) / 7);
    for (let i = 0; i <= step && br.c0 + i <= br.c1; i++) setTile(br.row, br.c0 + i, 0);
    if (br.c0 + step > br.c1) br.gone = true;
  }
  if (level.collapsing <= 0) { level.collapsing = 0; finishLevel(); }
}
function updateLifts() {
  for (const L of level.lifts) {
    L.y += L.speed * L.dir;
    if (L.y <= L.lo) { L.y = L.lo; L.dir = 1; }
    else if (L.y >= L.hi) { L.y = L.hi; L.dir = -1; }
  }
}
function drawLava() {
  for (const L of level.lava) {
    ctx.fillStyle = '#b53120';
    ctx.fillRect(L.x, L.y + 4, L.w, L.h - 4);
    /* the jagged crust: white teeth over an orange line, as in the original */
    ctx.fillStyle = '#ea9e22'; ctx.fillRect(L.x, L.y + 3, L.w, 2);
    ctx.fillStyle = '#fcfcfc';
    for (let x = 0; x < L.w; x += 8) {
      const up = (x / 8) % 2 ? 0 : 2;
      ctx.fillRect(L.x + x, L.y + up, 4, 4);
      ctx.fillRect(L.x + x + 4, L.y + 2 + up, 3, 2);
    }
  }
  /* the bridge's red underside, while the bridge is still there */
  const br = level.bridge;
  if (br && !br.gone) {
    ctx.fillStyle = '#8b2a20';
    ctx.fillRect(br.c0 * T, (br.row + 1) * T, (br.c1 - br.c0 + 1) * T, 10);
  }
}
function drawFireBars() {
  const f = (frame >> 3) % 2;
  for (const fb of level.firebars) {
    blit('enemy', 448, 80, 16, 16, fb.x - 8, fb.y - 8);
    for (let i = 1; i <= fb.len; i++) {
      const bx = fb.x + Math.cos(fb.a) * i * 16, by = fb.y + Math.sin(fb.a) * i * 16;
      blit('enemy', 448 + f * 16, 80, 16, 16, bx - 8, by - 8);
    }
  }
}
function drawPodoboos() {
  for (const pb of level.podoboos) blit('enemy', 576, 80, 16, 16, pb.x, pb.y);
}
function drawLifts() {
  for (const L of level.lifts) {
    blit('tiles', 384, 192, 16, 16, L.x, L.y - 4);
    blit('tiles', 400, 192, 16, 16, L.x + 16, L.y - 4);
    blit('tiles', 384, 192, 16, 16, L.x + 32, L.y - 4);
  }
}
function updatePipeState(p) {
  p.animT += 1 / 60;
  const step = 0.5;
  if (p.pipeDir === 'down') {
    p.y += step; p.pipeDist += step;
    if (p.pipeDist >= p.pipeTotal) {
      if (p.pipeTarget === 'tunnel' || p.pipeTarget === 'coinroom') {
        setMusic('underground');
        const carry = carryPlayer(p);
        if (p.pipeTarget === 'tunnel') buildTunnel(); else buildCoinRoom();
        resetLevelEntities(carry);
        player.state = 'normal'; player.standing = true;
      } else { p.state = 'normal'; }
    }
  } else if (p.pipeDir === 'right') {
    p.x += step; p.pipeDist += step;
    if (p.pipeDist >= p.pipeTotal) {
      if (p.pipeTarget === 'same') {
        const d = level.sameExit;
        p.x = d.x; p.y = d.y; p.state = 'pipe'; p.pipeDir = 'up';
        p.pipeDist = 0; p.pipeTotal = 32; p.pipePP = d.pp;
        vX = Math.max(0, Math.min(level.cols * T - W, p.x - 144));
      } else if (level.returnTo) {
        const ret = level.returnTo;
        setMusic(ret.build === buildUnderground || ret.build === buildTunnel ? 'underground' : 'overworld');
        const carry = carryPlayer(p);
        ret.build(); resetLevelEntities(carry);
        player.x = ret.x; player.y = 12 * T;
        player.state = 'pipe'; player.pipeDir = 'up';
        player.pipeDist = 0; player.pipeTotal = 32;
        player.pipePP = ret.pp;
      } else {
        finishLevel();
      }
    }
  } else if (p.pipeDir === 'up') {
    p.y -= step; p.pipeDist += step;
    if (p.pipeDist >= p.pipeTotal) { p.state = 'normal'; p.standing = true; }
  }
}

/* --------------------------- flag / level end --------------------------- */
function touchFlag(p) {
  const fp = level.flagpole;
  const h = p.y + p.h;
  let pts = 50;
  if (h < 64) pts = 2000; else if (h < 96) pts = 800; else if (h < 128) pts = 400; else if (h < 160) pts = 200;
  addScore(pts);
  fp.hit = true;
  p.state = 'flag'; p.flagSlide = true; p.vx = 0; p.vy = 0;
  p.x = fp.x - 6;
  sfx('flagpole'); pauseMusic();
  setTimeout(() => { if (!muted) { const a = SND.clear; if (a) a.play().catch(()=>{}); } }, 2200);
}
function updateFlagState(p) {
  p.animT += 1 / 60;
  const fp = level.flagpole;
  if (p.flagSlide) {
    p.y += 1.5;
    if (p.y + p.h >= 12 * T) { p.y = 12 * T - p.h; p.flagSlide = false; p.walkOff = 60; }
  } else {
    p.facing = 1; p.vx = 1.6; p.x += p.vx;
    p.walkOff -= 1;
    /* he steps off the pole base and drops onto the ground as he walks */
    p.vy = Math.min(MAX_FALL, p.vy + GRAV_FALL);
    collideY(p);
    /* walk until he reaches the castle door — a fixed timer left him stranded short of it */
    const doorX = level.castle.x + 3 * T;
    if (!p.enteredCastle && (p.x + p.w >= doorX + 6 || p.walkOff <= 0)) {
      p.enteredCastle = true;
      p.x = doorX - p.w + 8;
      p.state = 'pipe'; p.pipeDir = 'right'; p.pipeDist = 0; p.pipeTotal = 30;
      p.pipeTarget = 'castle';
      p.pipePP = { x: doorX, y: 10 * T, w: 2 * T, h: 3 * T };
    }
  }
}

/* --------------------------- enemies --------------------------- */
function makeGoomba(x, y) {
  return { kind: 'goomba', enemy: true, x, y, w: 15, h: 16, vx: -0.5, vy: 0,
           alive: true, animT: Math.random(), flat: 0, flip: false };
}
function makeKoopa(x, y) {
  return { kind: 'koopa', enemy: true, x, y, w: 14, h: 32, vx: -0.5, vy: 0,
           alive: true, animT: Math.random(), shell: false, shellIdle: 0, flip: false };
}
function makeBowser(x, y) {
  return { kind: 'bowser', enemy: true, x, y, w: 32, h: 32, vx: -0.55, vy: 0, alive: true,
           animT: 0, hp: 5, flash: 0, fireT: 100, falling: false, facing: -1 };
}
function makeFlame(x, y, dir) {
  return { kind: 'flame', enemy: true, x, y, w: 16, h: 8, vx: 2.4 * dir, vy: 0, alive: true, animT: 0 };
}
function makeCheep(x, y) {
  return { kind: 'cheep', enemy: true, x, y, w: 16, h: 16, animT: 0, alive: true,
           vx: -(1.1 + Math.random() * 1.1), vy: -(6.4 + Math.random() * 2.2), timer: 0 };
}
function makePlant(x, pipeTop) {
  return { kind: 'plant', enemy: true, x, y: pipeTop, w: 16, h: 32, vx: 0, vy: 0,
           alive: true, animT: 0, pipeTop, out: 0, dir: 1, hold: 40 };
}
function updateEnemy(e) {
  if (!e.alive) return;
  if (e.kind === 'bowser') {
    e.animT += 1 / 60;
    if (e.flash > 0) e.flash -= 1;
    if (e.falling) { e.vy = Math.min(8, e.vy + 0.4); e.y += e.vy; if (e.y > H + 40) e.alive = false; return; }
    const br = level.bridge;
    e.x += e.vx;
    if (br && e.x < br.c0 * T) { e.x = br.c0 * T; e.vx = Math.abs(e.vx); }
    if (br && e.x + e.w > (br.c1 + 1) * T) { e.x = (br.c1 + 1) * T - e.w; e.vx = -Math.abs(e.vx); }
    e.facing = e.vx < 0 ? -1 : 1;
    /* he hops toward Mario every so often and spits a flame */
    e.fireT -= 1;
    if (e.fireT <= 0) {
      e.fireT = 110 - e.hp * 8;
      const dir = player.x < e.x ? -1 : 1;
      entities.push(makeFlame(e.x + (dir < 0 ? -8 : e.w), e.y + 12, dir));
      sfx('fireball');
    }
    return;
  }
  if (e.kind === 'flame') {
    e.animT += 1 / 60;
    e.x += e.vx;
    if (e.x < vX - 32 || e.x > vX + W + 32) e.alive = false;
    return;
  }
  if (e.kind === 'cheep') {
    e.animT += 1 / 60;
    e.vy = Math.min(6, e.vy + 0.24);
    e.x += e.vx; e.y += e.vy;
    if (e.y > H + 32 || e.x < vX - 64) e.alive = false;
    return;
  }
  if (e.kind === 'plant') {
    e.animT += 1 / 60;
    if (e.hold > 0) e.hold -= 1;
    else {
      e.out += e.dir * 0.5;
      if (e.out >= 32) { e.out = 32; e.dir = -1; e.hold = 40; }
      else if (e.out <= 0) { e.out = 0; e.dir = 1; e.hold = 40; }
    }
    e.y = e.pipeTop - e.out;
    return;
  }
  if (e.alive === 'flip') {
    e.vy += 0.35; e.y += e.vy; e.x += e.vx;
    if (e.y > H + 40) e.alive = false;
    return;
  }
  if (e.flat > 0) { e.flat -= 1; if (e.flat === 0) e.alive = false; return; }
  if (e.kind === 'koopa' && e.shell && e.vx === 0) {
    e.shellIdle -= 1;
    if (e.shellIdle <= 0) { e.shell = false; e.h = 32; e.y -= 16; e.vx = -0.5; }
  }
  e.vy += 0.32; if (e.vy > 7) e.vy = 7;
  e.standing = false;
  const hitWall = collideX(e, () => { e.vx = -e.vx; });
  collideY(e);
  if (e.y > H + 32) { e.alive = false; return; }
  e.animT += 1 / 60;
}
function drawEnemy(e) {
  if (e.kind === 'cheep') {
    blitAnim('enemy', 480, 80, 16, 16, [0, 1], 6, e.animT, e.x, e.y);
    return;
  }
  if (e.kind === 'bowser') {
    if (e.flash > 0 && (frame >> 1) % 2) return;
    const f = Math.floor(e.animT * 6) % 2;
    blit('enemy', 720 + f * 32, 0, 32, 32, e.x, e.y);
    return;
  }
  if (e.kind === 'flame') {
    blit('enemy', 448, 80, 16, 16, e.x, e.y - 4);
    return;
  }
  if (e.kind === 'plant') {
    /* the part still inside the pipe must stay hidden behind it */
    ctx.save();
    ctx.beginPath(); ctx.rect(e.x - 4, -64, 24, e.pipeTop + 64); ctx.clip();
    blitAnim('enemy', 192, 0, 16, 32, [0, 1], 4, e.animT, e.x, e.y);
    ctx.restore();
    return;
  }
  const flipSheet = e.vx > 0 ? 'enemyr' : 'enemy';
  const sheet = 'enemy';
  if (e.kind === 'goomba') {
    if (e.alive === 'flip') { blitFlip('enemy', 0, 16, 16, 16, e.x, e.y); return; }
    if (e.flat > 0) { blit('enemy', 32, 16, 16, 16, e.x, e.y); return; }
    blitAnim(sheet, 0, 16, 16, 16, [0, 1], 6, e.animT, e.x, e.y, e.vx > 0);
  } else {
    if (e.alive === 'flip') { blitFlip('enemy', 96, 0, 16, 32, e.x - 1, e.y); return; }
    if (e.shell) {
      const sx = (e.vx !== 0 && e.shellIdle > 120) ? 176 : 160;
      blit('enemy', sx, 16, 16, 16, e.x - 1, e.y);
      return;
    }
    blitAnim(sheet, 96, 0, 16, 32, [0, 1], 4, e.animT, e.x - 1, e.y, e.vx > 0);
  }
}

/* --------------------------- items --------------------------- */
function makeItem(kind, x, y) {
  const it = { kind, x, y, w: 15, h: 15, vx: 0, vy: 0, animT: 0, sprout: 0, alive: true };
  if (kind === 'mushroom' || kind === '1up') { it.vx = 1.2; it.sprout = 16; }
  if (kind === 'star') { it.vx = 1.6; it.sprout = 16; }
  if (kind === 'flower') { it.sprout = 16; }
  return it;
}
function updateItem(it) {
  it.animT += 1 / 60;
  if (it.kind === 'coin') return;                 /* static level coin */
  if (it.kind === 'popcoin') {                    /* coin bursting out of a block */
    it.y -= 3.2; it.t -= 1; if (it.t <= 0) it.alive = false;
    return;
  }
  if (it.kind === 'rubble') {
    it.vy += 0.35; it.x += it.vx; it.y += it.vy;
    if (it.y > H + 20) it.alive = false;
    return;
  }
  if (it.sprout > 0) { it.y -= 1; it.sprout -= 1; if (it.sprout === 0 && it.kind !== 'flower') it.vy = 0; return; }
  if (it.kind === 'flower') return;
  it.vy += 0.3; if (it.vy > 6) it.vy = 6;
  it.standing = false;
  collideX(it, () => { it.vx = -it.vx; });
  collideY(it, (axis, r, c) => { if (it.kind === 'star' && axis === 'floor') it.vy = -4.2; });
  if (it.y > H + 20) it.alive = false;
}
function drawItem(it) {
  if (it.kind === 'coin') { blitAnim('items', 0, 96, 16, 16, [0, 1, 2, 3], 6, it.animT, it.x, it.y); return; }
  if (it.kind === 'popcoin') { blitAnim('items', 0, 112, 16, 16, [0, 1, 2, 3], 14, it.animT, it.x, it.y); return; }
  if (it.kind === 'rubble') { blitAnim('items', 64, 0, 8, 8, [0, 1], 6, it.animT, it.x, it.y); return; }
  if (it.kind === 'mushroom') blit('items', 0, 0, 16, 16, it.x, it.y);
  else if (it.kind === '1up') blit('items', 16, 0, 16, 16, it.x, it.y);
  else if (it.kind === 'flower') blitAnim('items', 0, 32, 16, 16, [0, 1, 2, 3], 12, it.animT, it.x, it.y);
  else if (it.kind === 'star') blitAnim('items', 0, 48, 16, 16, [0, 1, 2, 3], 12, it.animT, it.x, it.y);
}

function makeFireball(x, y, dir) {
  return { kind: 'fireball', x, y, w: 8, h: 8, vx: dir * 4, vy: 1, animT: 0, alive: true };
}
function updateFireball(f) {
  f.animT += 1 / 60;
  f.vy += 0.28; if (f.vy > 5) f.vy = 5;
  collideX(f, () => { f.alive = false; });
  collideY(f, (axis) => { if (axis === 'floor') f.vy = -3.4; });
  if (f.y > H + 20 || f.x < vX - 16 || f.x > vX + W + 16) f.alive = false;
}
function drawFireball(f) {
  blitAnim('items', 96, 144, 8, 8, [0, 1, 2, 3], 12, f.animT, f.x, f.y);
}

/* ------------------------------------------------------------------ *
 * 6. Blocks
 * ------------------------------------------------------------------ */
function blockAt(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= level.cols) return null;
  let b = level.blocks[r][c];
  if (!b) b = level.hidden.find(h => h.r === r && h.c === c && !h.used);
  return b || null;
}
function hitBlock(r, c, p) {
  const b = blockAt(r, c);
  if (!b) { sfx('bump'); return; }
  if (b.used) { sfx('bump'); b.bounce = 6; return; }
  const code = solidAt(r, c);
  const isHidden = !code;
  const super_ = p.power > 0;

  if (b.type === 'brick' && b.item === null && super_) {          /* smash */
    level.solid[r][c] = 0; level.blocks[r][c] = null;
    sfx('breakBlock'); addScore(50);
    for (const [dx, dy] of [[-2, -3], [2, -3], [-2, 1], [2, 1]]) {
      entities.push({ kind: 'rubble', x: c * T + 4 + (dx < 0 ? 0 : 8), y: r * T + 4 + (dy < 0 ? 0 : 8),
                      w: 8, h: 8, vx: dx, vy: dy, animT: 0, alive: true });
    }
    bumpEnemiesOnTop(r, c);
    return;
  }
  b.bounce = 8;
  if (isHidden) level.hiddenUsed = (level.hiddenUsed || new Set());
  const spawnItem = b.item;
  if (spawnItem === 'coin') {
    addScore(200); addCoin(); sfx('coin');
    entities.push({ kind: 'popcoin', x: c * T, y: r * T - 16, w: 0, h: 0, t: 12, animT: 0, alive: true });
  } else if (spawnItem === 'mushroom') {
    if (p.power === 0) { entities.push(makeItem('mushroom', c * T, r * T)); sfx('sprout'); }
    else { entities.push(makeItem('flower', c * T, r * T)); sfx('sprout'); }
  } else if (spawnItem === 'star') { entities.push(makeItem('star', c * T, r * T)); sfx('sprout'); }
  else if (spawnItem === '1up') {
    entities.push(makeItem('1up', c * T, r * T)); sfx('sprout');
  }
  if (b.type === 'brick') { level.solid[r][c] = SOLID.USED; b.used = true; }
  else if (b.type === 'q') { level.solid[r][c] = SOLID.USED; b.used = true; }
  else if (isHidden) {
    b.used = true; level.solid[r][c] = SOLID.USED;
  }
  sfx('bump');
  bumpEnemiesOnTop(r, c);
}
function bumpEnemiesOnTop(r, c) {
  for (const e of entities) {
    if (!e.enemy || !e.alive || e.alive === 'flip') continue;
    if (e.y + e.h === r * T && e.x + e.w > c * T && e.x < (c + 1) * T) {
      e.vy = -4; e.standing = false;
      if (e.kind === 'koopa' && !e.shell) { e.shell = true; e.h = 16; e.y += 16; e.shellIdle = 300; }
      flipKill(e, 100);
    }
  }
}
function hurtBowser(e, pts) {
  e.hp -= 1; e.flash = 40; addScore(pts); sfx('stomp');
  if (e.hp <= 0) { e.falling = true; e.vy = -3; e.vx = 0; }
  else { const sp = Math.abs(e.vx) + 0.15; e.vx = e.facing > 0 ? sp : -sp; }
}
function flipKill(e, pts) {
  e.alive = 'flip'; e.vx = 0; e.vy = -4; e.flip = true;
  addScore(pts);
}

/* ------------------------------------------------------------------ *
 * 7. Collisions between the player and everything else
 * ------------------------------------------------------------------ */
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function addScore(n) {
  player.score += n;
  if (player.score >= 1000 && !player.scoreWarned) player.scoreWarned = true;
}
function addCoin() {
  player.coins += 1;
  if (player.coins >= 100) { player.coins -= 100; player.lives += 1; }
}
function addLife() { player.lives += 1; }

function playerCollisions() {
  const p = player;
  if (p.state !== 'normal' && p.state !== 'pipe') return;

  for (const e of entities) {
    if (!e.enemy || !e.alive || e.alive === 'flip' || e.flat > 0) continue;
    if (e.x > vX + W + 32 || e.x + e.w < vX - 32) continue;
    if (!overlaps(p, e)) continue;

    if (p.star > 0) { flipKill(e, 200); continue; }
    if (e.kind === 'plant') { hurtPlayer(); continue; }

    /* The feet must have crossed this enemy's top plane while falling. Judged on
       the pre-move position: tile collision can snap Mario level with a ground
       enemy in the very same frame, which would otherwise read as a side hit. */
    const stomping = p.vyBefore > 0.5 && (p.yBefore + p.h) <= e.y + 4;
    if (e.kind === 'goomba') {
      if (stomping) {
        e.flat = 24; e.vx = 0; addScore(100); sfx('stomp');
        p.y = e.y - p.h; p.vy = -4;
      } else hurtPlayer();
    } else if (e.kind === 'bowser') {
      if (stomping) { hurtBowser(e, 500); p.y = e.y - p.h; p.vy = -4; }
      else hurtPlayer();
    } else if (e.kind === 'flame') {
      hurtPlayer(); e.alive = false;
    } else if (e.kind === 'cheep') {
      if (stomping) {
        e.alive = false; addScore(200); sfx('stomp');
        p.vy = -4;
      } else hurtPlayer();
    } else if (e.kind === 'koopa') {
      if (!e.shell) {
        if (stomping) {
          e.shell = true; e.h = 16; e.y += 16; e.vx = 0; e.shellIdle = 320;
          addScore(100); sfx('stomp');
          p.y = e.y - p.h; p.vy = -4;
        } else hurtPlayer();
      } else {
        if (stomping) {
          if (e.vx === 0) { e.shellIdle = 320; addScore(100); sfx('stomp'); }
          else { e.vx = 0; e.shellIdle = 320; addScore(400); sfx('kick'); }
          p.y = e.y - p.h; p.vy = -4;
        } else {
          if (e.vx === 0) { e.vx = p.x + p.w / 2 < e.x + e.w / 2 ? 3.2 : -3.2; e.shellIdle = 400; addScore(400); sfx('kick'); }
          else hurtPlayer();
        }
      }
    }
  }

  for (const it of entities) {
    if (it.kind === 'coin') {
      if (overlaps(p, it)) {
        it.alive = false; addCoin(); addScore(200); sfx('coin');
      }
      continue;
    }
    if (!['mushroom', '1up', 'flower', 'star'].includes(it.kind)) continue;
    if (!it.alive || it.sprout > 0) continue;
    if (!overlaps(p, it)) continue;
    it.alive = false;
    if (it.kind === 'mushroom') { addScore(1000); growPlayer(1); }
    else if (it.kind === '1up') { addLife(); sfx('powerup'); popup('1UP'); }
    else if (it.kind === 'flower') { addScore(1000); growPlayer(2); }
    else if (it.kind === 'star') { addScore(1000); p.star = 720; popup('INVINCIBLE'); }
  }

  for (const f of entities) {
    if (f.kind !== 'fireball' || !f.alive) continue;
    for (const e of entities) {
      if (!e.enemy || !e.alive || e.alive === 'flip') continue;
      if (overlaps(f, e)) {
        f.alive = false;
        if (e.kind === 'bowser') hurtBowser(e, 200); else flipKill(e, 200);
      }
    }
  }

  /* flagpole */
  const fp = level.flagpole;
  if (fp && !fp.hit && p.x + p.w >= fp.x && p.x < fp.x + 16) touchFlag(p);
}
function hurtPlayer() {
  const p = player;
  if (p.inv > 0 || p.star > 0 || p.state !== 'normal') return;
  if (p.power === 0) { killPlayer(false); return; }
  p.power -= 1; p.inv = 120; sfx('pipe');
  shrinkPlayer();
}
const FLASH_SMALL_SUPER = [{ x: 80, y: 32, sw: 16, sh: 16 }, { x: 80, y: 0, sw: 16, sh: 32 },
  { x: 80, y: 32, sw: 16, sh: 16 }, { x: 80, y: 0, sw: 16, sh: 32 },
  { x: 80, y: 32, sw: 16, sh: 16 }, { x: 80, y: 0, sw: 16, sh: 32 }];
const FLASH_SUPER_SMALL = FLASH_SMALL_SUPER.slice().reverse();
const FLASH_SUPER_FIRE  = [{ x: 80, y: 0, sw: 16, sh: 32 }, { x: 80, y: 96, sw: 16, sh: 32 },
  { x: 80, y: 0, sw: 16, sh: 32 }, { x: 80, y: 96, sw: 16, sh: 32 },
  { x: 80, y: 0, sw: 16, sh: 32 }, { x: 80, y: 96, sw: 16, sh: 32 }];
function flash(p, seq) { p.grow = { seq, dur: seq.map(() => 5), i: 0, t: 5 }; }
function growPlayer(to) {
  const p = player;
  if (to === 1 && p.power === 0) {
    p.power = 1; p.h = 32; p.y -= 16;
    if (overlapsSolid(p.x, p.y, p.w, p.h)) { p.y += 16; p.h = 16; p.power = 0; return; }
    sfx('powerup'); flash(p, FLASH_SMALL_SUPER);
  } else if (to === 2 && p.power < 2) {
    p.power = 2; sfx('powerup'); flash(p, FLASH_SUPER_FIRE);
  }
}
function shrinkPlayer() {
  const p = player;
  p.h = 16; p.y += 16; p.crouch = false;
  flash(p, FLASH_SUPER_SMALL);
}
function popup(label) { popups.push({ label, x: player.x, y: player.y - 8, t: 60 }); }
let popups = [];

/* ------------------------------------------------------------------ *
 * 8. Game state
 * ------------------------------------------------------------------ */
let state = 'title';         // title | card | play | dying | clear | gameover
let paused = false;
let vX = 0;
let frame = 0, timeLeft = 400, timeAcc = 0;
let cardTimer = 0, clearTimer = 0, bonusTotal = 0;

function resetLevelEntities(carry) {
  entities = [];
  popups = [];
  for (const e of level.enemies) {
    if (e.kind === 'goomba') entities.push(makeGoomba(e.c * T, e.r * T));
    else if (e.kind === 'koopa') entities.push(makeKoopa(e.c * T, e.r * T));
    else if (e.kind === 'plant') entities.push(makePlant(e.x, e.pipeTop));
  }
  if (level.bowser) {
    entities.push(makeBowser(level.bowser.c * T, level.bowser.r * T));
  }
  for (const it of level.items) entities.push({ kind: 'coin', x: it.x, y: it.y, w: 16, h: 16, animT: 0, alive: true });
  const sp = level.spawn;
  player = makePlayer(sp.x, sp.y);
  if (carry) {
    player.score = carry.score; player.coins = carry.coins; player.lives = carry.lives;
    player.power = carry.power || 0; player.star = carry.star || 0; player.inv = carry.inv || 0;
    timeLeft = carry.timeLeft == null ? 400 : carry.timeLeft;
  } else { player.score = 0; player.coins = 0; player.lives = 3; timeLeft = 400; }
  if (player.power) { player.h = 32; player.y = sp.y - 16; }
  timeAcc = 0;
  vX = carry ? Math.max(0, Math.min(level.cols * T - W, player.x - 144)) : 0;
}
function startLevel(which, carry) {
  if (which === 'tunnel') buildTunnel();
  else if (which === 'coinroom') buildCoinRoom();
  else if (which === 'overworld') LEVELS[levelIndex].build();
  else if (which === 'next') { levelIndex = Math.min(levelIndex + 1, LEVELS.length - 1); LEVELS[levelIndex].build(); }
  else { levelIndex = typeof which === 'number' ? which : 0; LEVELS[levelIndex].build(); }
  resetLevelEntities(carry || null);
  state = 'card'; cardTimer = 130;
}
function beginPlay() {
  state = 'play';
  setMusic(level.underground ? 'underground' : 'overworld');
}
function killPlayer(fell) {
  if (player.state === 'dead') return;
  player.state = 'dead'; player.timer = 30; player.vy = fell ? 0 : -5.2;
  player.h = 16; player.power = 0; player.star = 0;
  stopMusic(); setMusic(null);
  sfx('death');
  player.lives -= 1;
}
function respawnOrGameOver() {
  if (player.lives <= 0) { state = 'gameover'; clearTimer = 200; }
  else {
    setMusic(null);
    startLevel('overworld', { score: player.score, coins: player.coins, lives: player.lives, power: 0 });
  }
}
function finishLevel() {
  lastWasBoss = !!level.boss;
  state = 'clear'; clearTimer = 320; bonusTotal = 0;
  stopMusic(); setMusic(null);
}

/* ------------------------------------------------------------------ *
 * 9. Update loop
 * ------------------------------------------------------------------ */
function update() {
  frame++;
  if (state === 'title') { updateTitle(); return; }
  if (state === 'card') { cardTimer -= 1; if (cardTimer <= 0) beginPlay(); return; }
  if (state === 'gameover') { clearTimer -= 1; if (clearTimer <= 0) state = 'title'; return; }
  if (state === 'ending') { clearTimer -= 1; if (clearTimer <= 0) state = 'title'; return; }
  if (state === 'clear') {
    clearTimer -= 1;
    if (clearTimer > 40 && timeLeft > 0 && clearTimer % 2 === 0) { timeLeft -= 1; bonusTotal += 50; player.score += 50; }
    if (clearTimer <= 0) {
      if (levelIndex + 1 < LEVELS.length) {
        startLevel('next', { score: player.score, coins: player.coins, lives: player.lives, power: player.power });
      } else { state = 'ending'; clearTimer = 700; setMusic(null); }
    }
    return;
  }
  if (paused) return;

  /* timer */
  timeAcc += 1;
  if (timeAcc >= 24) { timeAcc = 0; timeLeft -= 1; if (timeLeft <= 0) { timeLeft = 0; killPlayer(false); } }

  updatePlayer(player);
  vX = Math.max(vX, player.x - 144);
  const maxX = level.cols * T - W;
  if (vX > maxX) vX = maxX;
  if (vX < 0) vX = 0;

  updateHazards();
  hazardCollisions();
  checkAxe();
  updateCollapse();

  if (level.cheeps && frame % 90 === 0 && Math.random() < 0.8 && entities.length < 40) {
    entities.push(makeCheep(vX + W - 8 - Math.random() * 48, H + 16));
  }
  updateLifts();

  for (const e of entities) {
    if (e.enemy) {
      /* enemies wake up as they come on screen */
      /* the boss stays awake well before he is on screen */
      const wake = e.kind === 'bowser' ? 520 : 16;
      if (e.alive && e.x - vX < W + wake && e.x - vX > -64) updateEnemy(e);
    } else if (['mushroom', '1up', 'flower', 'star', 'coin', 'popcoin', 'rubble'].includes(e.kind)) {
      updateItem(e);
    } else if (e.kind === 'fireball') updateFireball(e);
  }
  playerCollisions();

  /* the flag keeps travelling down through the whole walk-to-castle sequence */
  const fp = level.flagpole;
  if (fp && fp.hit && fp.flagY < 170) fp.flagY = Math.min(170, fp.flagY + 1.5);

  for (const b of level.blocks.flat()) if (b && b.bounce > 0) b.bounce -= 1;
  for (const h of level.hidden) if (h.bounce > 0) h.bounce -= 1;

  entities = entities.filter(e => e.alive !== false && !(e.x - vX < -160 && e.kind !== 'rubble'));
  popups = popups.filter(pp => (pp.t -= 1) > 0);

}

/* ------------------------------------------------------------------ *
 * 10. Rendering
 * ------------------------------------------------------------------ */
const TILE_SRC = {
  [SOLID.GROUND]:  ['tiles', 0, 0],   [SOLID.HARD]:   ['tiles', 0, 16],
  [SOLID.BRICK]:   ['tiles', 16, 0],  [SOLID.QBLOCK]: ['tiles', 384, 0],
  [SOLID.USED]:    ['tiles', 48, 0],  [SOLID.UGROUND]:['tiles', 0, 32],
  [SOLID.UHARD]:   ['tiles', 32, 32], [SOLID.PIPE_TL]:['tiles', 0, 128],
  [SOLID.GRTOP_L]: ['tiles', 272, 128], [SOLID.GRTOP_M]:['tiles', 288, 128],
  [SOLID.GRTOP_R]: ['tiles', 304, 128],
  [SOLID.CBLOCK]:  ['tiles', 0, 64],   [SOLID.BRIDGE]: ['tiles', 0, 64],
  [SOLID.PIPE_TR]: ['tiles', 16, 128],[SOLID.PIPE_ML]:['tiles', 0, 144],
  [SOLID.PIPE_MR]: ['tiles', 16, 144],
};
function blockOffset(b) {
  if (!b || b.bounce <= 0) return 0;
  const t = b.bounce;                    /* 8 -> 1 */
  return -Math.round(Math.sin((t / 8) * Math.PI) * 8);
}
function drawTile(r, c, code) {
  const b = level.blocks[r][c];
  const hidden = level.hidden.find(h => h.r === r && h.c === c && h.used);
  let dy = 0;
  if (b && b.bounce > 0) dy = blockOffset(b);
  if (hidden && hidden.bounce > 0) dy = blockOffset(hidden);
  if (code === SOLID.QBLOCK) {
    const seq = [0, 0, 0, 0, 1, 2, 1];
    const f = seq[Math.floor(frame / 8) % seq.length];
    blit('tiles', 384 + f * 16, 0, 16, 16, c * T - vX, r * T + dy);
    return;
  }
  const src = TILE_SRC[code];
  if (!src) return;
  blit(src[0], src[1], src[2], 16, 16, c * T - vX, r * T + dy);
}
function renderWorld() {
  ctx.fillStyle = (level.underground || level.dark) ? '#000000' : '#5c94fc';
  ctx.fillRect(0, 0, W, H);
  /* 1-2 turns outdoor for its last stretch: paint the sky back over that part */
  if (level.lightFrom != null) {
    const x0 = Math.max(0, level.lightFrom * T - vX);
    if (x0 < W) { ctx.fillStyle = '#5c94fc'; ctx.fillRect(x0, 0, W - x0, H); }
  }

  const c0 = Math.floor(vX / T), c1 = c0 + Math.ceil(W / T) + 1;

  for (const s of level.scenery) {
    if (s.x - vX > W || s.x + s.sw < vX) continue;
    blit(s.sheet, s.sx, s.sy, s.sw, s.sh, s.x - vX, s.y);
  }
  if (level.castle && level.castle.x - vX < W + 80) {
    blit('castle', 0, 0, 80, 96, level.castle.x - vX, level.castle.y);
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = c0; c <= c1; c++) {
      const code = level.solid[r][c];
      if (code === SOLID.HPIPE) continue;
      if (code) drawTile(r, c, code);
    }
  }
  /* horizontal pipes (mouth facing right) */
  for (const pp of level.pipes) {
    if (pp.dir !== 'right') continue;
    if (pp.x - vX > W + 48 || pp.x + 48 < vX) continue;
    const bx = pp.x - vX, by = pp.y;
    blit('tiles', 32, 128, 16, 16, bx, by);            /* rim / mouth */
    blit('tiles', 32, 144, 16, 16, bx, by + 16);
    blit('tiles', 48, 128, 16, 16, bx + 16, by);
    blit('tiles', 48, 144, 16, 16, bx + 16, by + 16);
    blit('tiles', 64, 128, 16, 16, bx + 32, by);
    blit('tiles', 64, 144, 16, 16, bx + 32, by + 16);
  }
  /* Everything from here on is positioned in level space: one camera shift for
     the flag, entities and Mario, so no individual draw call has to remember it. */
  ctx.save();
  ctx.translate(-Math.round(vX), 0);

  const fp = level.flagpole;
  if (fp && fp.x - vX > -32 && fp.x - vX < W + 32) blit('items', 128, 32, 16, 16, fp.x - 8, fp.flagY);

  for (const it of entities) if (['coin'].includes(it.kind)) drawItem(it);
  drawLava();
  drawLifts();
  drawFireBars();
  drawPodoboos();
  if (level.axe && !level.axe.taken) blit('items', 64, 16, 16, 16, level.axe.x, level.axe.y);
  for (const e of entities) if (e.enemy && e.alive !== false && e.x - vX < W + 32 && e.x - vX > -32) drawEnemy(e);
  for (const it of entities) if (['mushroom', '1up', 'flower', 'star', 'popcoin', 'rubble'].includes(it.kind)) drawItem(it);
  for (const f of entities) if (f.kind === 'fireball') drawFireball(f);

  /* player (clipped while inside a pipe) */
  if (player) {
    const flicker = player.inv > 0 && player.state !== 'dead' && Math.floor(frame / 3) % 2;
    if (!flicker) {
      if (player.state === 'pipe' && player.pipePP) {
        const pp = player.pipePP;
        ctx.save();
        ctx.beginPath(); ctx.rect(Math.round(pp.x), pp.y, pp.w, pp.h); ctx.clip();
        drawPlayer(player);
        ctx.restore();
      } else drawPlayer(player);
    }
  }
  for (const pp of popups) text(pp.label, pp.x, pp.y - (60 - pp.t), '#fcfcfc');
  ctx.restore();
}

function drawHUD() {
  text('MARIO', 24, 8);
  text(String(player.score).padStart(6, '0'), 24, 16);
  blitAnim('items', 0, 112, 16, 16, [0, 1, 2, 3], 8, frame / 60, 88, 10);
  text('x' + String(player.coins).padStart(2, '0'), 104, 16);
  text('WORLD', 136, 8);
  text(level.name, 144, 16);
  text('TIME', 192, 8);
  text(String(timeLeft).padStart(3, '0'), 192, 16);
}

/* ---------------- title / cards ---------------- */
let titleT = 0;
function updateTitle() {
  titleT += 1;
  if (startPressed) {
    startPressed = false;
    startLevel(0, null);
  }
}
function renderTitle() {
  ctx.fillStyle = '#5c94fc'; ctx.fillRect(0, 0, W, H);
  for (let c = 0; c < 16; c++) {
    blit('tiles', 0, 0, 16, 16, c * 16, 208);
    blit('tiles', 0, 0, 16, 16, c * 16, 224);
  }
  putPropTemp();
  textCentered('SUPER', 40, '#fc0000');
  textCentered('MARIO BROS.', 56, '#fc0000');
  textCentered('HTML5 FAN REMAKE', 80, '#fcfcfc');
  if (Math.floor(titleT / 32) % 2) textCentered('PRESS ENTER / TAP', 120, '#fcfcfc');
  textCentered('\u00a91985 NINTENDO', 140, '#fcfcfc');
  textCentered('ARROWS MOVE  SPACE JUMP', 168, '#fcfcfc');
  textCentered('SHIFT RUN + FIRE', 180, '#fcfcfc');
  /* little decoration: mario + goomba walking in place */
  blitAnim('player', 80, 32, 16, 16, [0], 0, 0, 40, 192);
  blitAnim('enemy', 0, 16, 16, 16, [0, 1], 6, titleT / 60, 180, 192);
}
let tempProps = [];
function putPropTemp() {
  blit('tiles', 0, 320, 16, 32, 24, 48);
  blit('tiles', 16, 320, 16, 32, 40, 48);
  blit('tiles', 32, 320, 16, 32, 56, 48);
  blit('tiles', 0, 320, 16, 32, 176, 64);
  blit('tiles', 16, 320, 16, 32, 192, 64);
  blit('tiles', 32, 320, 16, 32, 208, 64);
}
function renderCard() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  textCentered('WORLD ' + level.name, 96);
  blitAnim('player', 80, 32, 16, 16, [0], 0, 0, 100, 128);
  text('x ' + player.lives, 136, 136);
}
function renderClear() {
  renderWorld();
  drawHUD();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 96, W, 48);
  textCentered('COURSE CLEAR!', 108);
  textCentered('TIME BONUS ' + bonusTotal, 124);
}
function renderGameOver() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  textCentered('GAME OVER', 112);
}

/* ------------------------------------------------------------------ *
 * 11. Main loop
 * ------------------------------------------------------------------ */
let lastWasBoss = false;
function renderEnding() {
  if (lastWasBoss) { renderPrincessEnding(); return; }
  ctx.fillStyle = '#5c94fc'; ctx.fillRect(0, 0, W, H);
  for (const c of [4, 60, 120, 180]) putCloudTemp(c, 3);
  ctx.fillStyle = '#000'; ctx.fillRect(24, 40, W - 48, 136);
  textCentered('THANK YOU MARIO!', 56, '#fcfcfc');
  textCentered('BUT OUR QUEST IS OVER!', 76, '#fcfcfc');
  textCentered('WORLDS 1-3 AND 1-4 ARE', 108, '#fcfcfc');
  textCentered('STILL UNDER CONSTRUCTION', 124, '#fcfcfc');
  textCentered('PRESS ENTER', 156, '#fcfcfc');
  blitAnim('player', 80, 96, 16, 32, [0], 0, 0, 40, 176);
  blitAnim('enemy', 0, 16, 16, 16, [0, 1], 6, frame / 60, 190, 192);
  for (let c = 0; c < W / T; c++) { blit('tiles', 0, 0, 16, 16, c * T, 13 * T); blit('tiles', 0, 0, 16, 16, c * T, 14 * T); }
}
function putCloudTemp(c, r) { blit('tiles', 0, 320, 48, 32, c, r * T); }
function renderPrincessEnding() {
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5c5c5c';
  for (let c = 0; c < W / T; c++) { blit('tiles', 0, 64, 16, 16, c * T, 13 * T); blit('tiles', 0, 64, 16, 16, c * T, 14 * T); }
  for (let c = 0; c < W / T; c++) blit('tiles', 0, 64, 16, 16, c * T, 1 * T);
  blit('enemy', 416, 48, 16, 16, 104, 176);          /* Toad */
  blitAnim('player', 80, 96, 16, 32, [0], 0, 0, 128, 176);
  textCentered('THANK YOU MARIO!', 40, '#fcfcfc');
  textCentered('BUT OUR QUEST IS OVER!', 56, '#fcfcfc');
  textCentered('RESUCE THE PRINCESS', 84, '#fcfcfc');
  textCentered('THANK YOU MARIO!', 116, '#fcfcfc');
  textCentered('BUT OUR PRINCESS IS IN', 132, '#fcfcfc');
  textCentered('ANOTHER CASTLE!', 144, '#fcfcfc');
  textCentered('PRESS ENTER', 196, '#fcfcfc');
}
function render() {
  if (state === 'title') renderTitle();
  else if (state === 'card') renderCard();
  else if (state === 'gameover') renderGameOver();
  else if (state === 'clear') renderClear();
  else if (state === 'ending') renderEnding();
  else { renderWorld(); drawHUD(); }
  if (paused && state === 'play') {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 96, W, 32);
    textCentered('PAUSED', 108);
  }
}

let acc = 0, last = performance.now();
function loop(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= 1 / 60) { update(); acc -= 1 / 60; }
  render();
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------------ *
 * 12. Boot
 * ------------------------------------------------------------------ */
function fitCanvas() {
  const scale = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
  canvas.style.width = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
}
addEventListener('resize', fitCanvas);
fitCanvas();

const pending = Object.entries(IMAGES);
let loaded = 0;
for (const [k, src] of pending) {
  const img = new Image();
  img.onload = () => { IMG[k] = img; if (++loaded === pending.length) go(); };
  img.onerror = () => { console.error('failed to load', src); IMG[k] = img; if (++loaded === pending.length) go(); };
  img.src = src;
}
let started = false;
function go() {
  if (started) return; started = true;
  buildOverworld();
  resetLevelEntities(false);
  window.__game = { get state() { return state; }, get player() { return player; }, get vX() { return vX; },
                    get level() { return level; }, get entities() { return entities; },
                    keys, pressStart: () => { startPressed = true; }, startLevel,
                    teleport: (c, r) => { player.x = c * 16; player.y = (r + 1) * 16 - player.h;
                      player.vx = 0; player.vy = 0;
                      vX = Math.max(0, Math.min(level.cols * 16 - 256, player.x - 144)); },
                    setPower: n => { const b = player.y + player.h;
                      player.power = n; player.h = n ? 32 : 16; player.y = b - player.h; },
                    pressJump: (hold = 300) => { jumpPressed = true; keys.jump = 1;
                      setTimeout(() => { keys.jump = 0; }, hold); },
                    muted: () => muted, solidAt,
                    get levelIndex() { return levelIndex; },
                    gotoLevel: i => startLevel(i, { score: player.score, coins: player.coins,
                                                    lives: player.lives, power: player.power }) };
  requestAnimationFrame(loop);
}
