'use strict';
// _drv.js — helper: conecta por CDP a la sesión abierta por _open.js
const path = require('path');
const { chromium } = require(path.resolve(__dirname,'..','..','..','playwright','node_modules','playwright'));
const BASE = 'http://denarioelyaque.ddns.net:8080/DenarioPremium';
const EV = path.join(__dirname, 'evidencia');

async function attach() {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9411');
  const ctx = b.contexts()[0];
  const pg = ctx.pages()[0];
  return { b, ctx, pg };
}
async function shot(pg, name) { try { await pg.screenshot({ path: path.join(EV, name + '.png'), fullPage: false }); } catch(e){} }
async function goto(pg, p) { await pg.goto(BASE + p, { waitUntil:'domcontentloaded', timeout:60000 }); await pg.waitForTimeout(2500); }
function txt(pg) { return pg.evaluate(() => document.body.innerText); }
// selectOneMenu de PrimeFaces
async function pick(pg, base, label) {
  await pg.click(`[id="${base}_label"]`); await pg.waitForTimeout(800);
  const el = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if (!el) return false;
  await el.click(); await pg.waitForTimeout(1800);
  return true;
}
async function opts(pg, base) {
  return pg.evaluate((b) => {
    const p = document.getElementById(b + '_panel');
    if (!p) return null;
    return [...p.querySelectorAll('li.ui-selectonemenu-item')].map(li => li.textContent.trim());
  }, base);
}
module.exports = { attach, shot, goto, txt, pick, opts, BASE, EV };
