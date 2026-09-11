const L = require('./_lib'); const D = L.D; const fs=require('fs');
function num(s){ if(!s) return 0; return parseFloat(String(s).replace(/[^\d.,-]/g,'').replace(/\./g,'').replace(',','.'))||0; }
(async () => {
  const { pg } = await D.attach();
  let sum=0,n=0,users={},conSufijo=0;
  for(let p=0;p<20;p++){
    const r = await pg.evaluate(()=>{
      const t=document.getElementById('form:pedidosDT');
      const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' ')));
      const pb=document.getElementById('form:pedidosDT_paginator_bottom');
      const act=pb?pb.querySelector('.ui-state-active'):null;
      return {rows, cur:act?act.innerText:null};
    });
    for(const row of r.rows){ n++; sum+=num(row[6]); users[row[4]]=(users[row[4]]||0)+1; if(/T\d{3}$/.test(row[2])) conSufijo++; }
    console.log(`pag ${r.cur} filas=${r.rows.length} acum=${n} sum=${sum.toFixed(2)}`);
    const ok = await pg.evaluate(()=>{ const pb=document.getElementById('form:pedidosDT_paginator_bottom'); const nx=pb?pb.querySelector('.ui-paginator-next'):null; if(!nx||nx.classList.contains('ui-state-disabled'))return false; nx.click(); return true; });
    if(!ok){ console.log('fin paginacion'); break; }
    await pg.waitForTimeout(7000);
  }
  console.log('FILAS='+n+' SUMA='+sum.toFixed(2)+' conSufijoT='+conSufijo);
  console.log('POR VENDEDOR='+JSON.stringify(users));
  fs.writeFileSync(__dirname+'/_B_fact.json', JSON.stringify({n,sum:sum.toFixed(2),users,conSufijo},null,1));
  process.exit(0);
})();
