const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt116';
function num(s){ if(!s) return 0; const m=s.replace(/[^\d.,-]/g,''); return parseFloat(m.replace(/\./g,'').replace(',','.'))||0; }
(async () => {
  const { pg } = await D.attach();
  const total = await pg.evaluate(()=>{const m=document.body.innerText.match(/Total de Resultados:\s*([\d.,]+)/);return m?m[1]:null;});
  console.log('TOTAL-RESULTADOS=' + total);
  // subir a 200 por pagina
  await pg.evaluate(()=>{ const w=Object.values(PrimeFaces.widgets).find(w=>w&&w.id==='form:pedidosDT'); if(w) w.paginator.setRowsPerPage(200); });
  await pg.waitForTimeout(9000);
  let sum=0, n=0, users={}, conSufijo=0;
  for (let p=0;p<20;p++){
    const r = await pg.evaluate(()=>{
      const t=document.getElementById('form:pedidosDT');
      const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' ')));
      const pg2=document.getElementById('form:pedidosDT_paginator_bottom');
      const cur=pg2?(pg2.querySelector('.ui-state-active')||{}).innerText:null;
      return {rows, cur, pagtxt: pg2?pg2.innerText.replace(/\s+/g,' '):''};
    });
    for(const row of r.rows){ n++; sum+=num(row[6]); const u=row[4]; users[u]=(users[u]||0)+1; if(/T\d{3}$/.test(row[2])) conSufijo++; }
    console.log(`pag ${r.cur} filas=${r.rows.length} acum=${n} sum=${sum.toFixed(2)}`);
    // siguiente
    const ok = await pg.evaluate(()=>{ const nx=document.querySelector('#form\:pedidosDT_paginator_bottom .ui-paginator-next'); if(!nx||nx.classList.contains('ui-state-disabled'))return false; nx.click(); return true; });
    if(!ok) break;
    await pg.waitForTimeout(7000);
  }
  console.log('FILAS='+n+' SUMA='+sum.toFixed(2)+' conSufijoT='+conSufijo);
  console.log('POR VENDEDOR='+JSON.stringify(users));
  fs.writeFileSync(__dirname+'/_B_fact.json', JSON.stringify({total,n,sum:sum.toFixed(2),users,conSufijo},null,1));
  process.exit(0);
})();
