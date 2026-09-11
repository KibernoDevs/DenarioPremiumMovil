const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt115'; const GRID='form:TablaRotacion';
const CASOS=[
 ['Facturado-BULTO-sep',   'Facturado','BULTO','01/09/2026','11/09/2026'],
 ['Facturado-sinUnidad-anio','Facturado',null,'01/01/2026','11/09/2026'],
 ['Pedido-UNIDADES-anio',  'Pedido','UNIDADES','01/01/2026','11/09/2026'],
 ['Facturado-UNIDADES-2025a2026','Facturado','UNIDADES','01/01/2025','11/09/2026'],
];
(async()=>{
  const {pg}=await D.attach(); const out={};
  for (const [n,cump,uni,d1,d2] of CASOS) {
    await D.goto(pg,'/pages/reporteRotacionInventario'); await pg.waitForTimeout(2500);
    await D.pick(pg, F+':clasificacion','Productos'); await pg.waitForTimeout(3000);
    await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(300);
    await D.pick(pg, F+':cumplimiento',cump); await pg.waitForTimeout(1200);
    if (uni) { await D.pick(pg, F+':unidad',uni); await pg.waitForTimeout(1500); }
    await pg.evaluate((f)=>{ const w=PrimeFaces.widgets['widget_'+f.replace(/:/g,'_')+'_checkboxValor']; try{w.renderPanel();}catch(e){} try{w.checkAll();}catch(e){} }, F);
    await pg.waitForTimeout(900); await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(300);
    await pg.evaluate(([f,a,b])=>{ document.getElementById(f+':fechaDesde_input').value=a; document.getElementById(f+':fechaHasta_input').value=b; },[F,d1,d2]);
    let req=null; const hr=r=>{ if(r.method()==='POST'){const d=r.postData(); if(d&&d.includes('fechaDesde')) req=d;} }; pg.on('request',hr);
    const resp = await L.clickCapture(pg, F+':ajax','reporteRotacionInventario',16000);
    pg.off('request',hr);
    const e=L.parseErr(resp);
    const g = await pg.evaluate((g)=>{ const t=document.getElementById(g);
      const rows=t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim())):[];
      const m=document.body.innerText.match(/Total de Resultados:\s*([\d.,]+)/);
      return {total:m?m[1]:null,nrows:rows.length,rows:rows.slice(0,8)}; }, GRID);
    const chk = await pg.evaluate(f=>[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)].filter(i=>i.checked).length, F);
    console.log(`## ${n}: checked=${chk} err=${JSON.stringify(e)} total=${g.total} nrows=${g.nrows} rows=${JSON.stringify(g.rows.slice(0,3))}`);
    console.log('   REQ fechas: '+((req||'').match(/fechaDesde_input=[^&]*/)||['-'])[0]+' '+((req||'').match(/fechaHasta_input=[^&]*/)||['-'])[0]+' cump='+((req||'').match(/cumplimiento_input=[^&]*/)||['-'])[0]+' uni='+((req||'').match(/unidad_input=[^&]*/)||['-'])[0]);
    out[n]={chk,err:e,grid:g,req:(req||'').slice(0,600)};
    L.save('G4-'+n,resp);
  }
  fs.writeFileSync(__dirname+'/_G_rot2.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
