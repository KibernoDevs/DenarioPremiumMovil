'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname,'..','..','..','playwright','node_modules','playwright'));
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const BASE = 'http://denariocaribe.ddns.net:8080/DenarioPremium';

function creds() {
  const c = fs.readFileSync(path.join(ROOT, 'secrets', 'qa-credentials.env'), 'utf8').split('\n');
  const i = c.findIndex(l => /^#\s*USUARIO WEB/i.test(l.trim()));   // PRIMER bloque = LA TORTUGA / CARIBE
  let user = null, pass = null;
  for (let j = i + 1; j < Math.min(i + 10, c.length); j++) {
    const l = c[j].trim();
    if (l.startsWith('#')) break;
    if (l.startsWith('QA_USER=')) user = l.slice(8);
    if (l.startsWith('QA_PASSWORD=')) pass = l.slice(12);
  }
  return { user, pass };
}
(async () => {
  const udd = path.join(process.env.TEMP || '/tmp', 'qa-4k-cobrfiltro-profile');
  const ctx = await chromium.launchPersistentContext(udd, {
    headless: false, channel: 'chrome',
    viewport: { width: 1600, height: 950 },
    args: ['--remote-debugging-port=9455'],
  });
  const pg = ctx.pages()[0] || await ctx.newPage();
  await pg.goto(`${BASE}/pages/login.xhtml`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await pg.waitForTimeout(2500);
  const onLogin = await pg.evaluate(() => location.pathname.toLowerCase().includes('login'));
  if (onLogin) {
    const k = creds();
    const u = await pg.$('input[type="text"]:not([style*="display: none"])');
    const p = await pg.$('input[type="password"]');
    if (!u || !p) { console.log('NO-INPUTS'); }
    else {
      await u.fill(k.user); await p.fill(k.pass);
      const btn = await pg.$('button[type="submit"], input[type="submit"], button');
      if (btn) await btn.click();
      await pg.waitForTimeout(9000);
    }
  }
  const p2 = await pg.evaluate(() => location.pathname);
  console.log('PATH=' + p2);
  console.log('LOGIN_OK=' + (!/login/i.test(p2)));
  console.log('TITLE=' + await pg.title());
  console.log('BODY200=' + (await pg.evaluate(() => document.body.innerText.slice(0,200))).replace(/\n/g,' | '));
  console.log('READY CDP 9455');
  await new Promise(() => {});
})();
