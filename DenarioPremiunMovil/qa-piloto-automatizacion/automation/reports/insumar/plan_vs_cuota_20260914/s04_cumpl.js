'use strict';
const fs=require('fs'),path=require('path');
const { attach, goto, shot } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/reporteCumplimientoCuota');
  await pg.waitForTimeout(2500);
  const o = await pg.evaluate(() => ({
    selects: [...document.querySelectorAll('select')].filter(s=>s.id.includes('j_idt')).map(s=>({id:s.id,dis:s.disabled,opts:[...s.options].map(x=>x.value+' ||| '+x.textContent.trim())})),
    labels: [...document.querySelectorAll('label,span.ui-outputlabel')].map(l=>l.textContent.trim()).filter(t=>t&&t.length<40),
  }));
  console.log(JSON.stringify(o,null,1).slice(0,4000));
  await shot(pg,'CUMPL-dom');
  process.exit(0);
})();
