'use strict';
const { attach, goto } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/facturaciones');
  await pg.waitForTimeout(2500);
  const o = await pg.evaluate(() => ({
    selects: [...document.querySelectorAll('select')].map(s=>({id:s.id,dis:s.disabled,opts:[...s.options].map(x=>x.value+' ||| '+x.textContent.trim()).slice(0,20)})),
    inputs: [...document.querySelectorAll('input[id*="date"],input[id*="Date"]')].map(i=>({id:i.id,v:i.value})),
    btns: [...document.querySelectorAll('button')].map(b=>b.id+' ||| '+b.textContent.trim()).filter(x=>x.length<80),
  }));
  console.log(JSON.stringify(o,null,1));
  process.exit(0);
})();
