'use strict';
const { attach, BASE } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await pg.goto(BASE+'/pages/pedidosVendedores',{waitUntil:'domcontentloaded',timeout:60000});
  await pg.waitForTimeout(4000);
  const r = await pg.evaluate(() => ({
    selects: [...document.querySelectorAll('select')].map(s=>({id:s.id,name:s.name,cls:s.className,n:s.options.length})),
    som: [...document.querySelectorAll('.ui-selectonemenu')].map(d=>({id:d.id,cls:d.className})),
    labels: [...document.querySelectorAll('[id$="_label"]')].map(e=>e.id),
    inputs: [...document.querySelectorAll('input[id^="form:"]')].map(e=>e.id).slice(0,30),
    botones: [...document.querySelectorAll('button[id^="form:"],a[id^="form:"]')].map(e=>e.id+'|'+e.textContent.trim().slice(0,20)),
  }));
  console.log(JSON.stringify(r,null,1).slice(0,3500));
  process.exit(0);
})();
