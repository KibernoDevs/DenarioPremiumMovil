'use strict';
// _wrun.js <taskfile.js> [args] — lanza Chrome persistente, garantiza login en
// la web de Denario (bloque USUARIO WEB ISLA COCHE / EL YAQUE), corre la tarea
// y cierra. Todo en un solo proceso: no hay CDP externo que se pueda caer.
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname,'..','..','..','playwright','node_modules','playwright'));
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const BASE = 'http://denarioelyaque.ddns.net:8080/DenarioPremium';

function creds(blockRe) {
  const c = fs.readFileSync(path.join(ROOT, 'secrets', 'qa-credentials.env'), 'utf8').split('\n');
  const i = c.findIndex(l => blockRe.test(l.trim()));
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
  const udd = path.join(process.env.TEMP || '/tmp', 'qa-insumar-web-profile');
  const ctx = await chromium.launchPersistentContext(udd, {
    headless: false, channel: 'chrome',
    viewport: { width: 1600, height: 950 },
  });
  const pg = ctx.pages()[0] || await ctx.newPage();
  try {
    await pg.goto(`${BASE}/pages/variablesConfiguracion`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await pg.waitForTimeout(3000);
    let onLogin = await pg.evaluate(() => location.pathname.toLowerCase().includes('login'));
    if (onLogin) {
      const k = creds(/^#\s*USUARIO WEB ISLA COCHE/i);
      const u = await pg.$('input[type="text"]:not([style*="display: none"])');
      const p = await pg.$('input[type="password"]');
      if (!u || !p) throw new Error('LOGIN: no hay inputs');
      await u.fill(k.user); await p.fill(k.pass);
      const btn = await pg.$('button[type="submit"], input[type="submit"], button');
      await btn.click();
      await pg.waitForTimeout(9000);
      onLogin = await pg.evaluate(() => location.pathname.toLowerCase().includes('login'));
      if (onLogin) throw new Error('LOGIN FALLIDO (recarga silenciosa = USUARIO INVALIDO)');
      await pg.goto(`${BASE}/pages/variablesConfiguracion`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await pg.waitForTimeout(4000);
    }
    const fn = require(path.resolve(process.cwd(), process.argv[2]));
    const out = await fn(pg, process.argv.slice(3), { BASE });
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    await ctx.close().catch(() => {});
  }
})();
