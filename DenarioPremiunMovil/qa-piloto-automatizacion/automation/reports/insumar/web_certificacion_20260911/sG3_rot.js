const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt115'; const GRID='form:TablaRotacion';
async function grid(pg){
  return pg.evaluate((g)=>{
    const t=document.getElementById(g);
    const heads = t?[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')):[];
    const rows = t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))):[];
    const m=document.body.innerText.match(/Total de Resultados:\s*([\d.,]+)/);
    return {total:m?m[1]:null, heads, nrows:rows.length, rows};
  }, GRID);
}
(async()=>{
  const {pg}=await D.attach(); const out={};
  const D1='01/09/2026', D2='11/09/2026';
  for (const vis of ['Productos','Linea','Proveedor']) {
    await D.goto(pg,'/pages/reporteRotacionInventario'); await pg.waitForTimeout(2500);
    await D.pick(pg, F+':clasificacion', vis); await pg.waitForTimeout(2500);
    const co = await pg.evaluate((f)=>{ const w=PrimeFaces.widgets['widget_'+f.replace(/:/g,'_')+'_checkboxValor']; try{w.renderPanel();}catch(e){}
      const p=document.getElementById(f+':checkboxValor_panel');
      const labs=p?[...p.querySelectorAll('li label')].map(l=>l.textContent.trim()):null;
      return {n:document.querySelectorAll(`input[name="${f}:checkboxValor"]`).length, labels:(labs||[]).slice(0,25)}; }, F);
    console.log(`## VIS=${vis} valores n=${co.n} muestra=${JSON.stringify(co.labels.slice(0,15))}`);
    await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(400);
    await D.pick(pg, F+':cumplimiento','Facturado'); await pg.waitForTimeout(1200);
    await D.pick(pg, F+':unidad','UNIDADES'); await pg.waitForTimeout(1500);
    await pg.evaluate((f)=>{ const w=PrimeFaces.widgets['widget_'+f.replace(/:/g,'_')+'_checkboxValor']; try{w.renderPanel();}catch(e){} try{w.checkAll();}catch(e){} }, F);
    await pg.waitForTimeout(900); await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(400);
    await pg.evaluate(([f,a,b])=>{ document.getElementById(f+':fechaDesde_input').value=a; document.getElementById(f+':fechaHasta_input').value=b; },[F,D1,D2]);
    const chk = await pg.evaluate(f=>[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)].filter(i=>i.checked).length, F);
    const resp = await L.clickCapture(pg, F+':ajax', 'reporteRotacionInventario', 14000);
    const e = L.parseErr(resp); let g = await grid(pg);
    // subir filas por pagina si hay paginador
    try { await pg.evaluate((g)=>{ const w=Object.values(PrimeFaces.widgets).find(w=>w&&w.id===g); if(w&&w.paginator) w.paginator.setRowsPerPage(200); }, GRID); await pg.waitForTimeout(4000); g = await grid(pg); } catch(er){}
    console.log('   checked='+chk+' err='+JSON.stringify(e)+' total='+g.total+' nrows='+g.nrows);
    console.log('   HEADS='+JSON.stringify(g.heads));
    g.rows.slice(0,12).forEach(r=>console.log('   ROW '+JSON.stringify(r)));
    out[vis]={valores:co, checked:chk, err:e, grid:g};
    L.save('G3-rot-'+vis, resp); await D.shot(pg,'G3-rot-'+vis);
  }
  fs.writeFileSync(__dirname+'/_G_rot.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
