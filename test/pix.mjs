import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
await page.evaluate(() => { window.__probe = () => {
  const c = document.getElementById('screen'), x = c.getContext('2d');
  const p = __game.player, sx = Math.round(p.x - __game.vX), sy = Math.round(p.y);
  const d = x.getImageData(Math.max(0, sx - 2), Math.max(0, sy - 2), p.w + 4, p.h + 4).data;
  const hist = {};
  for (let i = 0; i < d.length; i += 4) {
    const k = d[i] + ',' + d[i+1] + ',' + d[i+2];
    hist[k] = (hist[k] || 0) + 1;
  }
  return { st: p.state, slide: p.flagSlide, sx, sy, top: Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,6) };
}; });
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(600);
  console.log(JSON.stringify(await page.evaluate(() => window.__probe())));
}
process.exit(0);
