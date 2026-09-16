// Tras elegir clasificacion, cuantos "Valores" se cargan en el checkbox multiple
const { attach, BASE } = require('./_drv');
const pick = require('./_pick2');
(async()=>{
 const [ruta, clas]=process.argv.slice(2);
 const {pg}=await attach();
 await pg.goto(BASE+ruta,{waitUntil:'domcontentloaded',timeout:60000});
 await pg.waitForTimeout(3500);
 const B=await pg.evaluate(()=>{const s=[...document.querySelectorAll('select')].map(x=>x.id).find(i=>/:cumplimiento_input$/.test(i));return s?s.replace(/:cumplimiento_input$/,''):null;});
 console.log('B='+B,'clas:'+await pick(pg,B+':clasificacion',clas));
 await pg.waitForTimeout(4000);
 const r=await pg.evaluate(b=>{
   const w=PrimeFaces.widgets['widget_'+b.replace(/[:.]/g,'_')+'_checkboxValor'];
   let n=-1; try{ w.renderPanel(); }catch(e){}
   const opts=[...document.querySelectorAll('[id="'+b+':checkboxValor"] select option')].map(o=>o.text.trim());
   try{ w.checkAll(); }catch(e){}
   n=[...document.querySelectorAll('input[name="'+b+':checkboxValor"]')].filter(i=>i.checked).length;
   const panelItems=[...document.querySelectorAll('[id="'+b+':checkboxValor_panel"] li')].length;
   return {opts:opts.slice(0,25), nOpts:opts.length, checked:n, panelItems, label:(document.getElementById(b+':checkboxValor_label')||{}).textContent};
 },B);
 console.log(JSON.stringify(r,null,1).slice(0,2000));
 process.exit(0);
})();
