const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt115'; const GRID='form:tablaComparativoPlanCuota';
async function chkOpts(pg){
  return pg.evaluate((f)=>{
    const w = PrimeFaces.widgets['widget_'+f.replace(/:/g,'_')+'_checkboxValor'];
    try{ w.renderPanel(); }catch(e){}
    const p = document.getElementById(f+':checkboxValor_panel');
    const labs = p ? [...p.querySelectorAll('li.ui-selectcheckboxmenu-item label, li label')].map(l=>l.textContent.trim()) : null;
    const ins = document.querySelectorAll(`input[name="${f}:checkboxValor"]`);
    return {labels: labs, n: ins.length, vals: [...ins].map(i=>i.value)};
  }, F);
}
async function grid(pg){
  return pg.evaluate((g)=>{
    const t=document.getElementById(g);
    const heads = t?[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')):[];
    const rows = t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))):[];
    const m=document.body.innerText.match(/Total de Resultados:\s*([\d.,]+)/);
    return {total:m?m[1]:null, heads, nrows:rows.length, rows:rows.slice(0,60)};
  }, g=GRID);
}
(async()=>{
  const {pg}=await D.attach(); const out={};
  const D1='01/09/2026', D2='11/09/2026';
  for (const vis of ['Empresa','Vendedores']) {
    await D.goto(pg,'/pages/reporteActivacionClientes'); await pg.waitForTimeout(2500);
    await D.pick(pg, F+':clasificacion', vis); await pg.waitForTimeout(2000);
    const co = await chkOpts(pg);
    console.log(`## VIS=${vis}  checkboxValor n=${co.n} labels=${JSON.stringify(co.labels)}`);
    await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(400);
    await D.pick(pg, F+':cumplimiento', 'Facturado'); await pg.waitForTimeout(1200);
    await pg.evaluate((f)=>{ const w=PrimeFaces.widgets['widget_'+f.replace(/:/g,'_')+'_checkboxValor']; try{w.renderPanel();}catch(e){} try{w.checkAll();}catch(e){} }, F);
    await pg.waitForTimeout(800);
    await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(400);
    await pg.evaluate(([f,a,b])=>{ document.getElementById(f+':fechaDesde_input').value=a; document.getElementById(f+':fechaHasta_input').value=b; },[F,D1,D2]);
    const chk = await pg.evaluate(f=>[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)].filter(i=>i.checked).length, F);
    const resp = await L.clickCapture(pg, F+':ajax', 'reporteActivacionClientes', 9000);
    const e = await L.parseErr(resp); const g = await grid(pg);
    console.log('   checked='+chk+'  err='+JSON.stringify(e)+'  total='+g.total);
    console.log('   HEADS='+JSON.stringify(g.heads));
    g.rows.forEach(r=>console.log('   ROW '+JSON.stringify(r)));
    out[vis]={checkOpts:co, checked:chk, err:e, grid:g};
    L.save('G2-act-'+vis, resp);
    await D.shot(pg,'G2-act-'+vis);
  }
  fs.writeFileSync(__dirname+'/_G_act.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
