import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright-core');
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('8123'));
const res = await page.evaluate(() => {
  const c = document.getElementById('screen'), x = c.getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const target = [[177,52,37],[227,157,37],[106,107,4]];
  let minx=999,miny=999,maxx=-1,maxy=-1,n=0;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const px = p % c.width, py = (p / c.width) | 0;
    if (target.some(t => Math.abs(d[i]-t[0]) < 6 && Math.abs(d[i+1]-t[1]) < 6 && Math.abs(d[i+2]-t[2]) < 6)) {
      n++; if (px<minx)minx=px; if (px>maxx)maxx=px; if (py<miny)miny=py; if (py>maxy)maxy=py;
    }
  }
  const pl = __game.player;
  return { n, box: [minx,miny,maxx,maxy], px: Math.round(pl.x - __game.vX), py: Math.round(pl.y), st: pl.state, sheet: pl.power };
});
console.log(JSON.stringify(res));
process.exit(0);
