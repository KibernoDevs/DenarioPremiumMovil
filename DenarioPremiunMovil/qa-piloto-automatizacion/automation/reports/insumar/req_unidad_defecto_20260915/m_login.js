// m_login.js <usuario> — cierra sesión (si hace falta) y entra con el usuario dado.
// Reconecta CDP tras el logout (el WebView se reinicia) usando adb forward.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const { chromium } = require(path.resolve(ROOT, 'automation', 'playwright', 'node_modules', 'playwright'));

function pass() {
  const c = fs.readFileSync(path.join(ROOT, 'secrets', 'qa-credentials.env'), 'utf8').split('\n');
  const i = c.findIndex(l => /^#\s*Cliente:\s*insumar\s*$/.test(l.trim()));
  for (let j = i + 1; j < i + 8; j++) {
    const l = c[j].trim();
    if (l.startsWith('#')) break;
    if (l.startsWith('QA_PASSWORD=')) return l.slice(12);
  }
  throw new Error('sin clave');
}

function reforward() {
  try {
    const unix = execSync('adb shell cat /proc/net/unix', { timeout: 10000, encoding: 'utf8' });
    const pids = [...unix.matchAll(/webview_devtools_remote_(\d+)/g)].map(m => m[1]);
    if (!pids.length) return null;
    const pid = pids[pids.length - 1];
    try { execSync('adb forward --remove tcp:9220', { timeout: 4000 }); } catch (_) {}
    execSync(`adb forward tcp:9220 localabstract:webview_devtools_remote_${pid}`, { timeout: 4000 });
    return pid;
  } catch (e) { return 'ERR:' + e.message; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function conectar(retries = 8) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const b = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 15000 });
      const pg = b.contexts()[0].pages()[0];
      if (!pg) throw new Error('sin páginas');
      await pg.evaluate(() => true);
      return { b, pg };
    } catch (e) { last = e; reforward(); await sleep(2000); }
  }
  throw new Error('CDP-DOWN: ' + last.message);
}

// Cierra alerts leyendo la etiqueta real (nunca predecirla).
async function alerts(pg, prefer) {
  return await pg.evaluate((prefer) => {
    const out = [];
    const act = [...document.querySelectorAll('ion-alert')]
      .filter(a => !a.classList.contains('overlay-hidden') && a.offsetParent !== null);
    for (const a of act) {
      const btns = [...a.querySelectorAll('button.alert-button')].filter(b => b.getBoundingClientRect().width > 0);
      const labels = btns.map(b => b.textContent.trim());
      const msg = (a.querySelector('.alert-message') || {}).textContent || '';
      let pick = null;
      for (const p of prefer) { pick = btns.find(b => b.textContent.trim() === p); if (pick) break; }
      if (!pick) pick = btns[btns.length - 1];
      out.push({ msg: msg.trim().slice(0, 160), labels, clicked: pick ? pick.textContent.trim() : null });
      if (pick) pick.click();
    }
    return out;
  }, prefer);
}

(async () => {
  const usuario = process.argv[2];
  if (!usuario) throw new Error('uso: node m_login.js <usuario>');
  const clave = pass();
  const log = [];
  let { b, pg } = await conectar();

  const estado = async () => await pg.evaluate(() => ({
    path: location.pathname,
    login: !!document.querySelector('app-login:not(.ion-page-hidden)'),
    home: !!document.querySelector('app-home:not(.ion-page-hidden)'),
    sync: !!document.querySelector('app-synchronization'),
    user: (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').coUser || null; } catch (_) { return null; } })(),
  })).catch(() => null);

  let st = await estado();
  log.push({ paso: 'inicio', st });

  if (st && st.home) {
    // SALIR desde HOME
    const c = await pg.evaluate(() => {
      const el = [...document.querySelectorAll('app-home p, app-home ion-button, app-home a, app-home span')]
        .find(e => (e.textContent || '').trim().toUpperCase() === 'SALIR');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!c) { log.push({ paso: 'salir', err: 'no encontré SALIR' }); }
    else {
      await pg.mouse.click(c.x, c.y);
      await sleep(1200);
      log.push({ paso: 'salir-alert', a: await alerts(pg, ['Aceptar', 'OK', 'SI', 'Sí']) });
      await sleep(4000);
    }
    try { await pg.evaluate(() => true); } catch (_) { await b.close().catch(()=>{}); ({ b, pg } = await conectar()); }
    st = await estado();
    log.push({ paso: 'tras-salir', st });
  }

  // esperar a app-login
  for (let i = 0; i < 20 && !(st && st.login); i++) {
    await sleep(1500);
    try { st = await estado(); } catch (_) { await b.close().catch(()=>{}); ({ b, pg } = await conectar()); st = await estado(); }
  }
  if (!st || !st.login) { console.log(JSON.stringify({ ok: false, log, st }, null, 1)); process.exit(1); }

  // llenar
  const fill = async (idx, val) => {
    const h = (await pg.$$('app-login ion-input'))[idx];
    await h.scrollIntoViewIfNeeded();
    const inp = await h.$('input');
    await inp.click();
    await inp.fill('');
    await inp.type(val, { delay: 45 });
    await pg.evaluate(el => el.blur(), inp);
    await sleep(500);
  };
  await fill(0, usuario);
  await fill(1, clave);
  await sleep(900);

  const sb = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('app-login ion-button')]
      .find(e => e.getAttribute('type') === 'submit' || /acept|inicia/i.test(e.textContent || ''));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, txt: b.textContent.trim() };
  });
  log.push({ paso: 'submit', sb });
  await pg.mouse.click(sb.x, sb.y, { delay: 120 });
  await sleep(2500);

  // alert de "usuario diferente" → Aceptar (borra BD local y re-sincroniza)
  const a1 = await alerts(pg, ['Aceptar', 'OK', 'SI', 'Sí']);
  if (a1.length) { log.push({ paso: 'alert-post-submit', a1 }); await sleep(2500); }

  // esperar HOME (hasta 5 min por sync inicial)
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < 330000) {
    try {
      st = await estado();
      if (st && st.home) { ok = true; break; }
      if (st && st.login) {
        const a2 = await alerts(pg, ['OK', 'Aceptar']);
        if (a2.length) log.push({ paso: 'alert-login', a2 });
      }
    } catch (_) { await b.close().catch(()=>{}); ({ b, pg } = await conectar()); }
    await sleep(3000);
  }
  st = await estado();
  console.log(JSON.stringify({ ok, segundos: Math.round((Date.now() - t0) / 1000), st, log }, null, 1));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
