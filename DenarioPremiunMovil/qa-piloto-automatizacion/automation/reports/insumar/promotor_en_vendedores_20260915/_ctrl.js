const { attach, goto } = require('./_drv');
(async()=>{ const [ruta]=process.argv.slice(2); const {pg}=await attach();
 await goto(pg,ruta); await pg.waitForTimeout(4000);
 const r = await pg.evaluate(()=>{
   const o={inputs:[],clickables:[]};
   document.querySelectorAll('input').forEach(i=>{ if(i.type==='hidden')return;
     o.inputs.push(i.id+' ['+i.type+'] val='+i.value); });
   document.querySelectorAll('button,a,span.ui-button,div.ui-button').forEach(b=>{
     const t=(b.innerText||'').trim().replace(/\s+/g,' ');
     if(!b.id) return;
     const rc=b.getBoundingClientRect();
     o.clickables.push(b.id+' :: "'+t.slice(0,30)+'" vis='+(rc.width>0&&rc.height>0)+' @'+Math.round(rc.x)+','+Math.round(rc.y));
   });
   return o;});
 console.log('INPUTS:\n'+r.inputs.join('\n'));
 console.log('\nCLICKABLES:\n'+r.clickables.filter(c=>/ajax|Buscar|boton|detalle/i.test(c)).join('\n'));
 process.exit(0);})();
