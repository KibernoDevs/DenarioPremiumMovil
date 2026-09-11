const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt116';
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/facturaciones'); await pg.waitForTimeout(2500);
  await D.pick(pg, F+':tipoDocumento', 'Consolidado');
  await D.pick(pg, F+':idCurrency', 'US$');
  await pg.evaluate(([f,a,b])=>{document.getElementById(f+':dateB_input').value=a;document.getElementById(f+':dateF_input').value=b;}, [F,'01/09/2026','11/09/2026']);
  const resp = await L.clickCapture(pg, F+':ajax', 'facturaciones', 12000);
  L.save('B-fact-consolidado', resp);
  const r = await pg.evaluate(() => {
    const t=document.getElementById('form:pedidosDT');
    const heads=[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' '));
    const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' ')));
    const m=document.body.innerText.match(/Total de Resultados:\s*([\d.,]+)/);
    const pag=document.getElementById('form:pedidosDT_paginator_bottom');
    return { total:m?m[1]:null, heads, n:rows.length, r0:rows[0], r1:rows[1], pag: pag?pag.innerText.replace(/\s+/g,' '):null };
  });
  console.log(JSON.stringify(r,null,1));
  console.log('ERR=' + JSON.stringify(L.parseErr(resp)));
  await D.shot(pg,'B-fact-consolidado');
  process.exit(0);
})();
