'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname,'..','..','..','playwright','node_modules','playwright'));
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const BASE = 'http://denarioelyaque.ddns.net:8080/DenarioPremium';

function creds(blockRe) {
  const c = fs.readFileSync(path.join(ROOT, 'secrets', 'qa-credentials.env'), 'utf8').split('\n');
  const i = c.findIndex(l => blockRe.test(l.trim()));
  if (i < 0) { console.log('BLOQUE-NO-ENCONTRADO'); process.exit(1); }
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
  const udd = path.join(process.env.TEMP || '/tmp', 'qa-insumar-caidos-profile');
  const ctx = await chromium.launchPersistentContext(udd, {
    headless: false, channel: 'chrome',
    viewport: { width: 1600, height: 950 },
    args: ['--remote-debugging-port=9414'],
  });
  const pg = ctx.pages()[0] || await ctx.newPage();

  // Capturar el CUERPO de la respuesta del POST de login (el growl de PrimeFaces viaja ahi)
  let loginBody = '';
  pg.on('response', async (r) => {
    try {
      if (/login/i.test(r.url()) && r.request().method() === 'POST') {
        loginBody = (await r.text()).slice(0, 4000);
      }
    } catch (e) {}
  });

  await pg.goto(`${BASE}/pages/login.xhtml`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await pg.waitForTimeout(2500);
  const onLogin = await pg.evaluate(() => location.pathname.toLowerCase().includes('login'));
  if (onLogin) {
    const k = creds(/^#\s*USUARIO WEB ISLA COCHE/i);
    console.log('USER=' + k.user + ' PASSLEN=' + (k.pass || '').length);
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
  console.log('TITLE=' + await pg.title());
  if (/login/i.test(p2)) {
    const m = loginBody.match(/USUARIO\s+INVALIDO|invalid|error/i);
    console.log('SIGUE-EN-LOGIN. growl-match=' + (m ? m[0] : 'NINGUNO'));
    console.log('BODYRESP=' + loginBody.replace(/\s+/g,' ').slice(0,1200));
  }
  console.log('BODY300=' + (await pg.evaluate(() => document.body.innerText.slice(0,300))).replace(/\n/g,' | '));
  console.log('READY CDP 9414');
  await new Promise(() => {});
})();
