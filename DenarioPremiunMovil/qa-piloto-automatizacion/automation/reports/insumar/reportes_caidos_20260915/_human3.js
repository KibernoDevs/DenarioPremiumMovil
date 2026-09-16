'use strict';
// Flujo COMPLETO a mano sobre Cumplimiento de Cuota, con captura de todos los POST.
const fs=require('fs'); const path=require('path');
const { attach, goto, shot, EV } = require('./_drv');
const B='form:j_idt116';
async function clickPick(pg, base, label){
  await pg.click(`[id="${base}"]`, {timeout:8000}).catch(()=>{});
  await pg.waitForTimeout(1200);
  let li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if(!li) li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:has-text("${label}")`);
  if(!li) return 'NO-ITEM';
  await li.click({timeout:8000}).catch(()=>{});
  await pg.waitForTimeout(3000);
  return 'ok';
}
(async () => {
  const [tag, clas, cumpl, uni, d1, d2] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, '/pages/reporteCumplimientoCuota'); await pg.waitForTimeout(4000);
  const caps=[];
  pg.on('response', async r=>{ if(r.request().method()==='POST'){ try{
    const b=await r.text(); const p=r.request().postData()||'';
    caps.push({src:decodeURIComponent((p.match(/javax\.faces\.source=([^&]*)/)||[])[1]||'?'), st:r.status(), len:b.length,
      growl:(b.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/)||[]).slice(1,3), b, p});
  }catch(e){} } });
  console.log('rdv :', await clickPick(pg, B+':codRdv', 'Todos'));
  console.log('clas:', await clickPick(pg, B+':clasificacion', clas));
  // marcar TODOS los valores del panel, con clics reales sobre el widget
  const marcados = await pg.evaluate((n)=>{
    const w=PrimeFaces.widgets['widget_form_j_idt116_checkboxValor'];
    try{ w.renderPanel(); }catch(e){}
    try{ w.checkAll(); }catch(e){}
    return [...document.querySelectorAll('input[name="'+n+'"]')].filter(i=>i.checked).length;
  }, B+':checkboxValor');
  console.log('valores marcados:', marcados);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
  console.log('cump:', await clickPick(pg, B+':cumplimiento', cumpl));
  console.log('uni :', await clickPick(pg, B+':unidad', uni));
  await pg.fill(`[id="${B}:fechaDesde_input"]`, d1).catch(()=>{});
  await pg.fill(`[id="${B}:fechaHasta_input"]`, d2).catch(()=>{});
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
  const pre = await pg.evaluate((b)=>{const g=s=>{const e=document.getElementById(s);return e?e.value:null};
    return {rdv:g(b+':codRdv_input'),clas:g(b+':clasificacion_input'),cumpl:g(b+':cumplimiento_input'),
            uni:g(b+':unidad_input'),d:g(b+':fechaDesde_input'),h:g(b+':fechaHasta_input')};}, B);
  console.log('PRE', JSON.stringify(pre));
  caps.length=0;
  await pg.click(`[id="${B}:ajax"]`);
  await pg.waitForTimeout(14000);
  const body = await pg.evaluate(()=>document.body.innerText);
  const tot=(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null;
  const filas = await pg.evaluate(()=>{const t=document.getElementById('form:tablaCumplimientoCuota');
    return t? [...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))) : null;});
  caps.forEach((c,i)=>{ console.log('POST#'+i+' src='+c.src+' st='+c.st+' len='+c.len+' growl='+JSON.stringify(c.growl));
    fs.writeFileSync(path.join(EV,'h3-'+tag+'-post'+i+'.txt'), (c.p||'')+'\n\n=== RESP ===\n'+c.b); });
  console.log('TOTAL=', tot);
  console.log('FILAS=', JSON.stringify(filas).slice(0,1500));
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'), JSON.stringify({tag,pre,marcados,total:tot,filas},null,1));
  await shot(pg,tag);
  process.exit(0);
})();
