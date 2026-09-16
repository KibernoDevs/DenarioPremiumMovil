'use strict';
// Driver web: conecta al Chrome de _open.js (CDP 9411) y ejecuta un fichero JS
// que exporta async (pg) => any.  Uso: node _w.js <script.js> [args...]
const path = require('path');
const { chromium } = require(path.resolve(__dirname,'..','..','..','playwright','node_modules','playwright'));
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9411', { timeout: 20000 });
  const ctx = b.contexts()[0];
  const pg = ctx.pages().find(p => p.url().includes('DenarioPremium')) || ctx.pages()[0];
  const fn = require(path.resolve(process.cwd(), process.argv[2]));
  const out = await fn(pg, process.argv.slice(3));
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
