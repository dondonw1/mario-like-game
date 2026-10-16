# Super Mario Bros. — HTML5 canvas remake

A single-page, dependency-free remake of **Super Mario Bros. (NES, 1985) World 1-1**,
rendered at the console's native **256 × 240** resolution with the original ripped
graphics and the original sound effects / music.

![1-1](z-run1.png)

## Run it

```sh
cd mario-like-game
python3 -m http.server 8123 --bind 127.0.0.1
# then open http://127.0.0.1:8123/
```

Any static file server works. Opening `index.html` straight from disk also works in
Chrome, but a server avoids the usual `file://` quirks.

## Controls

| Key | Action |
|---|---|
| ← → / A D | walk (hold **Shift** / **X** to run) |
| Space / Z / ↑ / W | jump (hold longer = higher) |
| Shift / X | run; while super, **↓ + Shift** throws fireballs |
| ↓ / S | crouch (super/fire), enter a warp pipe while standing on it |
| Enter | start / pause-resume |
| P | pause |
| M | mute |

Touch buttons appear automatically on coarse-pointer (phone/tablet) screens.

## What's in

* Faithful 1-1 layout: floor gaps, the Q/brick formations, four pipes (one of them a
  warp), the staircase sections, the flagpole and the castle.
* The **underground tunnel** reached from the 4th pipe, with its coin rows and the
  exit pipe that returns you to the overworld at pipe #5.
* Goombas, Koopa Troopas (stomp → shell → kick), mushrooms, fire flowers, stars,
  1-ups (including the hidden block in the second block row), coins, brick rubble,
  score popups, floating score for stomps/flag height.
* Small → Super → Fire Mario, damage shrinks instead of killing, star invincibility,
  crouch, skid, fireballs.
* **Moving lifts** (vertical platforms that carry you) and **cheep cheeps** (fish that
  leap through the air; stompable).
* **Fire bars** (a pivot ball with a chain of spinning spiked balls), **podoboos**
  (lava geysers), **lava** (instant death whatever your size), **Bowser** — five hits
  to drive him back, fire breath of his own — and the **axe + collapsing bridge**.
* **Piranha plants** in 1-2: they rise out of their pipes and back down, and the part
  still inside the pipe stays hidden behind it.
* Flagpole grab → flag slides down → walk into the castle → **COURSE CLEAR** → the
  next world's card. Clearing the last world shows the ending screen.
* Lives, game over, level card, HUD (`MARIO / score / coins / WORLD 1-1 | 1-2 / TIME`).
* Authentic audio: `aboveground_bgm` / `underground_bgm` looping, plus the 14 real
  SFX (jump, coin, stomp, power-up, brick smash, pipe, death, flagpole, clear …).
  Audio objects are created on the first key press, because browsers block autoplay.

## Worlds

| Course | What it is |
|---|---|
| **1-1** | the overworld: Q/brick formations, four pipes (the 4th warps into the
  underground tunnel), the staircase, flagpole and castle |
| **1-2** | the underground course: you drop in through a gap in the ceiling, cross the
  block towers and the brick maze, jump the pits, pass the piranha pipes, drop into the
  **coin heaven** under the first pipe, then the **lift corridor** — four lifts, the
  tall one rising through a hole in the ceiling onto the **roof walk**, a coin-littered
  ledge above the whole level that skips the last stretch — then the exit pipe and the
  outdoor staircase with a flagpole |
| **1-3** | the hill course: grass-topped pillars at seven different heights, the pits
  between them, four **moving lifts** you can ride, **cheep cheeps** leaping in arcs
  from off-screen, and the stepped staircase to the flagpole |
| **1-4** | Bowser's castle: the black halls, **lava pits** that kill on touch, nine
  rotating **fire bars**, **podoboos** hopping out of the lava, the lift, the **bridge**
  over the last pit with **Bowser** pacing it and spitting fire, and the **axe** at the
  far end — take it and the bridge collapses under him |

Clearing 1-4 ends World 1 with the original ending scene (Toad, "THANK YOU MARIO! /
BUT OUR QUEST IS OVER! / RESUCE THE PRINCESS" — the typo is in the original).

## Physics (lifted from the game itself)

The vertical numbers come straight from the Super Mario Bros. disassembly —
`JumpMForceData`, `FallMForceData` and `PlayerYSpdData`, indexed by running speed the
same way the original indexes them. That is what makes the four-tile-high pipes in 1-1
reachable the way they are in the original: a standing jump peaks at exactly the height
of those pipes, a running one clears them with room to spare.

| | value |
|---|---|
| walk / run top speed | 2.0 / 3.4 px per frame |
| jump take-off | 4 px/frame standing, 5 px/frame at full speed (the original's table) |
| gravity | 0.117–0.156 while the jump button is held, 0.375–0.5625 falling (the original's table) |
| fall speed cap | 4 px/frame, exactly as in the original |
| standing jump | 62 px ≈ 3.9 tiles measured (the original: 64 px = 4.0 tiles) |
| running jump | 78 px ≈ 4.9 tiles measured (the original: 80 px = 5.0 tiles) |
| stomp bounce | a fixed −4 px/frame; holding jump makes it climb about 4 tiles, as in the original |


Verified by `test/verify.mjs` — 34 assertions run against the game in a real browser
(jump heights and the tall-pipe clearance, the speed cap, block/brick interactions,
stomps and the Bowser fight, the pipe round-trips, lifts and the roof walk, all four
level transitions, the ending, dying in a pit). Run it with the window open:
`LIVE=1 node test/verify.mjs`.)

```sh
node test/verify.mjs              # headless Chrome
LIVE=1 node test/verify.mjs       # drives the window already open on the desktop
```

## Files

```
index.html            shell, canvas, CSS integer scaling, touch pad
js/game.js            the whole game (assets, audio, input, levels, physics, render)
assets/sprites/       player, playerl, enemy, enemyr, items, tiles, castle, font
assets/sounds/        14 SFX (.wav) + 2 music tracks (.ogg)
assets/ASSETS-LICENSE-MIT.txt
test/                 verify.mjs (assertions), play/probe/visual scripts
```

## Asset provenance and credits

* Sprites and sounds: **[reruns/mario](https://github.com/reruns/mario)** by Garrett
  Johnson (MIT, © 2017) — authentic Super Mario Bros. rips of `player`, `enemy`,
  `items`, `tiles` sheets and the `sounds/` set. The 1-1 tile layout and the sprite
  sheet coordinates used here were extracted from that repo's level data.
* The castle image was colour-keyed out of the level rip
  **"SMB NES World 1-1 ripped by A.J. Nitro — give credit if used"** (shipped as
  `sprites/1-1 reference.png` in the same repo).
* The 8 × 8 HUD font was generated from the system console font
  `/usr/share/consolefonts/Lat15-VGA8.psf.gz` (VGA-style glyphs).
* All Mario art, music and names are © **Nintendo**; this is a fan/learning project,
  not an official release. See `assets/ASSETS-LICENSE-MIT.txt` for the code-asset
  licence.

## Known simplifications

* **World 1 is complete** — 1-1, 1-2, 1-3, 1-4 and the ending scene. What is still
  missing is the 1-2 **warp zone**: the roof walk ends where the three pipes to Worlds
  2, 3 and 4 would be, and those worlds are not built here. Bowser is a faithful-enough
  fight — he paces the bridge, breathes fire and takes five hits — but he has no
  hammer-throwing phase, and 1-4's Lakitu/spiny stretch is not recreated.
* Enemies turn at walls and fall off ledges; no Koopa-paratroopa, hammer brother,
  lakitu, bullet bill and hammer brother.
* The time counter is 400 and simply ends the level when it runs out.
