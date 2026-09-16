'use strict';
const { attach, goto } = require('./_drv');
(async () => {
  const [ruta] = process.argv.slice(2);
  const { b, ctx } = await attach();
  console.log('PAGINAS=' + ctx.pages().length + ' :: ' + ctx.pages().map(p=>p.url().slice(-45)).join(' || '));
  const pg = ctx.pages()[0];
  await goto(pg, ruta); await pg.waitForTimeout(5000);
  const r = await pg.evaluate(() => ({
    url: location.pathname,
    nSel: document.querySelectorAll('select').length,
    sels: [...document.querySelectorAll('select')].map(s => s.id || '(sin-id)'),
    fechas: [...document.querySelectorAll('input')].map(i => i.id).filter(x => x && /fecha|date/i.test(x)),
    ajax: [...document.querySelectorAll('[id$=":ajax"]')].map(e=>e.id),
  }));
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})();
