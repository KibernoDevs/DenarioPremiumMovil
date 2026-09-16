'use strict';
const path = require('path');
const { chromium } = require(path.resolve(__dirname,'..','..','..','playwright','node_modules','playwright'));
const BASE = 'http://denariocaribe.ddns.net:8080/DenarioPremium';
const EV = path.join(__dirname, 'evidencia');
async function attach() {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9455');
  const ctx = b.contexts()[0];
  const pg = ctx.pages()[0];
  return { b, ctx, pg };
}
async function shot(pg, name) { try { await pg.screenshot({ path: path.join(EV, name + '.png'), fullPage: false }); } catch(e){} }
async function goto(pg, p) { await pg.goto(BASE + p, { waitUntil:'domcontentloaded', timeout:90000 }); await pg.waitForTimeout(3000); }
module.exports = { attach, shot, goto, BASE, EV };
