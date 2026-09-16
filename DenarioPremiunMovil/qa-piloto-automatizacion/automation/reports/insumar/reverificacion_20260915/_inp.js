'use strict';
const { attach, goto } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, process.argv[2]);
  const d = await pg.evaluate(()=>({
    inputs: [...document.querySelectorAll('input')].filter(i=>i.id&&!/_focus|_filter|config-form/.test(i.id)).map(i=>i.id+' ['+i.type+'] = '+i.value),
    buttons: [...document.querySelectorAll('button,a.ui-button')].filter(b=>b.id).map(b=>b.id+' :: '+(b.innerText||b.title||'').trim().slice(0,25)),
    grids: [...document.querySelectorAll('div.ui-datatable')].map(t=>t.id)
  }));
  console.log(JSON.stringify(d,null,1));
  process.exit(0);
})();
