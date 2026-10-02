// Screenshot every exported screen at its design size. Usage: node screenshot.mjs <out_dir>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire('/Users/jan/Projects/fitness-platform/web/package.json');
const { chromium } = require('playwright');
const out = process.argv[2];
const screens = JSON.parse(readFileSync(join(out, 'screens.json'), 'utf8'));

const browser = await chromium.launch({ executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' });
const page = await browser.newPage({ deviceScaleFactor: 2 });
let n = 0;
for (const s of screens) {
  await page.setViewportSize({ width: s.w, height: s.h });
  await page.goto(pathToFileURL(join(out, s.html)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, s.png), clip: { x: 0, y: 0, width: s.w, height: s.h } });
  n++;
}
await browser.close();
console.log(`${n} screenshots`);
