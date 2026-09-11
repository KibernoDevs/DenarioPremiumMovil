const D = require('./_drv');
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reporteCumplimientoCuota');
  await pg.waitForTimeout(2500);
  const c = await pg.evaluate(() => [...document.querySelectorAll('select,input[type=text],button,.ui-selectonemenu,.ui-selectcheckboxmenu,.ui-datatable')].map(e=>e.tagName.toLowerCase()+' | '+(e.id||'-')+' | '+(e.className||'').toString().slice(0,45)));
  console.log(c.filter(x=>x.includes('form:')).join('\n'));
  process.exit(0);
})();
