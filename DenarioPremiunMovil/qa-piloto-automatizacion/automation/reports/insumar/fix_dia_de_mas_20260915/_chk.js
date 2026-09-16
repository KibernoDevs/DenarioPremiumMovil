const { attach, BASE } = require('./_drv');
const pick = require('./_pick2');
(async()=>{
 const {pg}=await attach();
 await pg.goto(BASE+'/pages/reporteCumplimientoCuota',{waitUntil:'domcontentloaded',timeout:60000});
 await pg.waitForTimeout(3500);
 const B='formFiltros:j_idt116';
 console.log('clas:',await pick(pg,B+':clasificacion','Empresa'));
 await pg.waitForTimeout(2000);
 const r = await pg.evaluate((b)=>{
   const w = PrimeFaces.widgets['widget_'+b.replace(/[:.]/g,'_')+'_checkboxValor'];
   const out = { hasW: !!w, wKeys: w?Object.keys(w).slice(0,40):[], proto: w?Object.getOwnPropertyNames(Object.getPrototypeOf(w)).slice(0,40):[] };
   out.el = w && w.jq ? w.jq.attr('id') : null;
   // dump todo el DOM relacionado
   const cont = document.getElementById(b+':checkboxValor');
   out.contHTML = cont ? cont.outerHTML.slice(0,1500) : null;
   out.inputsByName = [...document.querySelectorAll('input[name^="'+b+':checkboxValor"]')].map(i=>i.name+'='+i.value+':'+i.checked);
   out.allChk = [...document.querySelectorAll('input[type=checkbox]')].map(i=>(i.id||'')+'|'+(i.name||'')+'|'+i.value+'|'+i.checked).slice(0,30);
   return out;
 }, B);
 console.log(JSON.stringify(r,null,1).slice(0,4000));
 process.exit(0);
})();
