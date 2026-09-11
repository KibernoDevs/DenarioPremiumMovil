const D = require('./_drv');
const F = 'form:j_idt115';
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate((f) => {
    const sel = document.getElementById(f+':idEnterprise_input');
    const div = document.getElementById(f+':idEnterprise');
    return { disabled: sel?sel.disabled:null, name: sel?sel.name:null, value: sel?sel.value:null,
             opts: sel?[...sel.options].map(o=>o.value+' => '+o.text):null,
             cls: div?div.className:null, outer: div?div.outerHTML.slice(0,400):null };
  }, F);
  console.log(JSON.stringify(r,null,1));
  process.exit(0);
})();
