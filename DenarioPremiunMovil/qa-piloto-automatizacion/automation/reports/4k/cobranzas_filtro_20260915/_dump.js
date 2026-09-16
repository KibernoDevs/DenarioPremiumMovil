'use strict';
// _dump.js <ruta> [tag] — inventario de inputs/selects/botones de la pantalla
const fs=require('fs'), path=require('path');
const { attach, goto, shot, EV } = require('./_drv');
(async()=>{
  const [ruta, tag] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, ruta); await pg.waitForTimeout(4000);
  const r = await pg.evaluate(()=>{
    const o={path:location.pathname, forms:[], selects:[], inputs:[], botones:[]};
    document.querySelectorAll('form').forEach(f=>o.forms.push(f.id));
    document.querySelectorAll('select').forEach(s=>{
      o.selects.push({id:s.id, val:s.value, n:s.options.length,
        opts:[...s.options].slice(0,60).map(op=>op.value+'='+op.text.trim())});
    });
    document.querySelectorAll('input').forEach(i=>{ if(i.type==='hidden') return;
      o.inputs.push(i.id+' ['+i.type+'] val='+i.value); });
    document.querySelectorAll('button,a.ui-button,span.ui-button,div.ui-button').forEach(b=>{
      if(!b.id) return; const rc=b.getBoundingClientRect();
      o.botones.push(b.id+' :: "'+(b.innerText||'').trim().replace(/\s+/g,' ').slice(0,30)+'" @'+Math.round(rc.x)+','+Math.round(rc.y)+' vis='+(rc.width>0&&rc.height>0));
    });
    return o;
  });
  fs.writeFileSync(path.join(EV, (tag||'dump')+'.json'), JSON.stringify(r,null,1));
  console.log('PATH='+r.path);
  console.log('FORMS='+JSON.stringify(r.forms));
  console.log('SELECTS:'); r.selects.forEach(s=>console.log('  '+s.id+' (n='+s.n+') val='+JSON.stringify(s.val)+' -> '+JSON.stringify(s.opts).slice(0,900)));
  console.log('INPUTS:'); r.inputs.forEach(i=>console.log('  '+i));
  console.log('BOTONES:'); r.botones.filter(b=>/ajax|buscar|limpiar|boton/i.test(b)).forEach(b=>console.log('  '+b));
  await shot(pg, (tag||'dump'));
  process.exit(0);
})();
