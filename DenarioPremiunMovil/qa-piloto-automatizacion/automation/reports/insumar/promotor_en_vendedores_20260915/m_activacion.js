'use strict';
// m_activacion.js <tag> <clasificacionLabel> <cumplLabel> <d1> <d2>
const fs=require('fs'), path=require('path');
const { attach, goto, shot, EV } = require('./_drv');
async function clickPick(pg, base, label){
  await pg.click(`[id="${base}"]`, {timeout:10000}).catch(()=>{});
  await pg.waitForTimeout(1200);
  let li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if(!li) li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:has-text("${label}")`);
  if(!li) return 'NO-ITEM';
  await li.click({timeout:10000}).catch(()=>{});
  await pg.waitForTimeout(3500);
  return 'ok';
}
(async () => {
  const [tag, clas, cumpl, d1, d2] = process.argv.slice(2);
  const B='form:j_idt115';
  const { pg } = await attach();
  await goto(pg, '/pages/reporteActivacionClientes'); await pg.waitForTimeout(4000);
  // LIMPIAR primero — el combo conserva selección entre recargas
  await pg.click(`[id="${B}:botonLimpiar"]`).catch(()=>{}); await pg.waitForTimeout(4000);
  console.log('clas:', await clickPick(pg, B+':clasificacion', clas));
  // la lista del medio (checkboxValor) sólo existe tras elegir Visualización
  const marcados = await pg.evaluate((n)=>{
    const w = PrimeFaces.widgets['widget_form_j_idt115_checkboxValor'];
    if(!w) return 'NO-WIDGET';
    try{ w.renderPanel(); }catch(e){}
    try{ w.checkAll(); }catch(e){}
    return [...document.querySelectorAll('input[name="'+n+'"]')].filter(i=>i.checked).length;
  }, B+':checkboxValor');
  console.log('valores marcados:', marcados);
  // qué ofrece esa lista del medio
  const listaMedio = await pg.evaluate(()=>{
    const p=document.querySelector('.ui-selectcheckboxmenu-panel:not([style*="display: none"])') ||
            document.querySelector('.ui-selectcheckboxmenu-panel');
    if(!p) return null;
    return [...p.querySelectorAll('li.ui-selectcheckboxmenu-item label, li.ui-selectcheckboxmenu-item')]
      .map(e=>e.innerText.trim()).filter(Boolean);
  });
  console.log('LISTA-MEDIO=', JSON.stringify(listaMedio));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(1000);
  console.log('cump:', await clickPick(pg, B+':cumplimiento', cumpl));
  await pg.fill(`[id="${B}:fechaDesde_input"]`, d1).catch(()=>{});
  await pg.fill(`[id="${B}:fechaHasta_input"]`, d2).catch(()=>{});
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
  const pre = await pg.evaluate((b)=>{const g=s=>{const e=document.getElementById(s);return e?e.value:null};
    return {clas:g(b+':clasificacion_input'),cumpl:g(b+':cumplimiento_input'),d:g(b+':fechaDesde_input'),h:g(b+':fechaHasta_input')};}, B);
  console.log('PRE', JSON.stringify(pre));
  await pg.click(`[id="${B}:ajax"]`);
  await pg.waitForTimeout(15000);
  const body = await pg.evaluate(()=>document.body.innerText);
  const tot=(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null;
  const filas = await pg.evaluate(()=>{const t=document.getElementById('form:tablaComparativoPlanCuota');
    return t? [...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))) : null;});
  const cabec = await pg.evaluate(()=>{const t=document.getElementById('form:tablaComparativoPlanCuota');
    return t? [...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')) : null;});
  console.log('TOTAL=', tot);
  console.log('CABEC=', JSON.stringify(cabec));
  console.log('FILAS=', JSON.stringify(filas));
  console.log('P001_EN_RESULTADOS=', /P001|MARIA JOSE PEREZ/i.test(JSON.stringify(filas)));
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'), JSON.stringify({tag,pre,marcados,listaMedio,total:tot,cabec,filas},null,1));
  await shot(pg,tag);
  process.exit(0);
})();
