'use strict';
const fs=require('fs'),path=require('path');
const { attach, goto, shot, pick } = require('./_drv');
const B='form:j_idt116';
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/facturaciones');
  await pg.waitForTimeout(2000);
  console.log('tipo:', await pick(pg, B+':tipoDocumento', 'Facturas cobradas'));
  await pg.evaluate(()=>{document.getElementById('form:j_idt116:dateB_input').value='01/08/2026';document.getElementById('form:j_idt116:dateF_input').value='31/08/2026';});
  await pg.$eval(`[id="${B}:ajax"]`, e=>e.click());
  await pg.waitForTimeout(9000);
  const r = await pg.evaluate(() => {
    const body=document.body.innerText;
    const total=(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null;
    const t=document.getElementById('form:pedidosDT');
    const rows=t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim())):[];
    const head=t?[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim()):[];
    return {total,head,n:rows.length,sample:rows.slice(0,3),conT:rows.filter(r=>r.join('|').match(/T00[1-6]\b/)).length};
  });
  console.log(JSON.stringify(r,null,1).slice(0,2500));
  fs.writeFileSync(path.join(__dirname,'evidencia','res-FACT-ago.json'),JSON.stringify(r,null,1));
  await shot(pg,'FACT-ago');
  process.exit(0);
})();
