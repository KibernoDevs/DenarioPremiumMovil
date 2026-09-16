'use strict';
// _drv.js — conecta por CDP a la sesion propia de esta re-verificacion (puerto 9415)
const path = require('path');
const { chromium } = require(path.resolve(__dirname,'..','..','..','playwright','node_modules','playwright'));
const BASE = 'http://denarioelyaque.ddns.net:8080/DenarioPremium';
const EV = path.join(__dirname, 'evidencia');
async function attach() {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9415');
  const ctx = b.contexts()[0];
  const pg = ctx.pages()[0];
  return { b, ctx, pg };
}
async function shot(pg, name) { try { await pg.screenshot({ path: path.join(EV, name + '.png'), fullPage: false }); } catch(e){} }
async function goto(pg, p) { await pg.goto(BASE + p, { waitUntil:'domcontentloaded', timeout:60000 }); await pg.waitForTimeout(2500); }
function txt(pg) { return pg.evaluate(() => document.body.innerText); }
async function pick(pg, base, label) {
  const r = await pg.evaluate(([b, lab]) => {
    const sel = document.getElementById(b + '_input');
    if (!sel) return 'NO-SELECT';
    const o = [...sel.options].find(x => x.text.trim() === lab) || [...sel.options].find(x => x.text.trim().includes(lab));
    if (!o) return 'NO-OPTION:' + [...sel.options].map(x => x.text.trim()).join('/');
    const wname = 'widget_' + b.replace(/[:.]/g, '_');
    const w = (window.PrimeFaces && PrimeFaces.widgets[wname]) || null;
    if (w && typeof w.selectValue === 'function') { try { w.selectValue(o.value); return true; } catch (e) {} }
    sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, [base, label]);
  await pg.waitForTimeout(1800);
  return r;
}
async function opts(pg, base) {
  return pg.evaluate((b) => {
    const s = document.getElementById(b + '_input');
    return s ? [...s.options].map(o => o.value + '=' + o.text.trim()) : null;
  }, base);
}
module.exports = { attach, shot, goto, txt, pick, opts, BASE, EV };
