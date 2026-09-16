'use strict';
const { attach, goto, shot } = require('./_drv');
(async () => {
  const [ruta, tag] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, ruta);
  await pg.waitForTimeout(3500);
  const g = await pg.evaluate(()=>{
    const o=[];
    document.querySelectorAll('div.ui-datatable').forEach(t=>{
      o.push({id:t.id, head:[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim()),
        rows:[...t.querySelectorAll('tbody tr')].slice(0,15).map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' ').slice(0,200)))});
    });
    return o;
  });
  console.log(JSON.stringify(g,null,1).slice(0,8000));
  await shot(pg, tag);
  process.exit(0);
})();
