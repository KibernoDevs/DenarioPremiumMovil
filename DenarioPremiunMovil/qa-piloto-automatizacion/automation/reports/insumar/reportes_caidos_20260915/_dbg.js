'use strict';
const { attach, goto, shot } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/reporteCumplimientoCuota');
  await pg.waitForTimeout(4000);
  const r = await pg.evaluate(() => ({
    url: location.href,
    htmlLen: document.documentElement.outerHTML.length,
    nSel: document.querySelectorAll('select').length,
    nInp: document.querySelectorAll('input').length,
    nForm: document.querySelectorAll('form').length,
    dialogs: [...document.querySelectorAll('.ui-dialog,.ui-confirm-dialog')].filter(d=>d.offsetParent!==null).map(d=>d.id+'::'+d.innerText.slice(0,120)),
    txt: document.body.innerText.replace(/\s+/g,' ').slice(0, 900),
  }));
  console.log(JSON.stringify(r, null, 1));
  await shot(pg, 'DBG_cumpl');
  process.exit(0);
})();
