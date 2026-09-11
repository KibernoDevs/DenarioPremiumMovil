const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt115';
const REPS=[['Activacion','/pages/reporteActivacionClientes','form:tablaComparativoPlanCuota','Vendedores','reporteActivacionClientes'],
            ['Rotacion','/pages/reporteRotacionInventario','form:TablaRotacion','Productos','reporteRotacionInventario']];
async function llena(pg, vis, uni){
  await D.pick(pg, F+':clasificacion', vis); await pg.waitForTimeout(2500);
  await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(300);
  await D.pick(pg, F+':cumplimiento','Facturado'); await pg.waitForTimeout(1200);
  if (uni) { await D.pick(pg, F+':unidad','UNIDADES'); await pg.waitForTimeout(1500); }
  await pg.evaluate((f)=>{ const w=PrimeFaces.widgets['widget_'+f.replace(/:/g,'_')+'_checkboxValor']; try{w.renderPanel();}catch(e){} try{w.checkAll();}catch(e){} },F);
  await pg.waitForTimeout(800); await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(300);
  await pg.evaluate((f)=>{ document.getElementById(f+':fechaDesde_input').value='01/09/2026'; document.getElementById(f+':fechaHasta_input').value='11/09/2026'; },F);
}
async function lee(pg,g){ return pg.evaluate((g)=>{const t=document.getElementById(g);
  const rows=t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim())):[];
  const m=document.body.innerText.match(/Total de Resultados:\s*([\d.,]+)/); return {total:m?m[1]:null,nrows:rows.length,r0:rows[0]||null};},g); }
(async()=>{
  const {pg}=await D.attach(); const out={};
  for (const [n,url,grid,vis,part] of REPS) {
    await D.goto(pg,url); await pg.waitForTimeout(2500);
    await llena(pg, vis, n==='Rotacion');
    let resp = await L.clickCapture(pg, F+':ajax', part, 12000);
    const e1=L.parseErr(resp); const g1=await lee(pg,grid);
    console.log(`## ${n} [1 antes de Limpiar] err=${JSON.stringify(e1)} total=${g1.total} r0=${JSON.stringify(g1.r0)}`);
    // pulsar Limpiar
    resp = await L.clickCapture(pg, F+':botonLimpiar', part, 8000);
    const eL=L.parseErr(resp);
    console.log(`   [Limpiar] err=${JSON.stringify(eL)}`);
    // reponer y buscar
    await llena(pg, vis, n==='Rotacion');
    resp = await L.clickCapture(pg, F+':ajax', part, 12000);
    const e2=L.parseErr(resp); const g2=await lee(pg,grid);
    console.log(`## ${n} [2 tras Limpiar] err=${JSON.stringify(e2)} total=${g2.total} r0=${JSON.stringify(g2.r0)}`);
    out[n]={antes:{e:e1,g:g1}, limpiar:eL, despues:{e:e2,g:g2}};
    L.save('G7-'+n+'-tras-limpiar', resp); await D.shot(pg,'G7-'+n+'-tras-limpiar');
  }
  fs.writeFileSync(__dirname+'/_G_limpiar.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
