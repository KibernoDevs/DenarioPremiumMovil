const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt115'; const GRID='form:tablaComparativoPlanCuota';
async function soloUno(pg, etiqueta){
  return pg.evaluate(([f,lab])=>{
    const w=PrimeFaces.widgets['widget_'+f.replace(/:/g,'_')+'_checkboxValor'];
    try{w.renderPanel();}catch(e){}
    try{w.uncheckAll();}catch(e){}
    const p=document.getElementById(f+':checkboxValor_panel');
    const items=[...p.querySelectorAll('li')];
    let hit=null;
    for (const li of items){ const l=li.querySelector('label'); if(l && l.textContent.trim().replace(/\s+/g,' ')===lab){ const box=li.querySelector('.ui-chkbox-box'); if(box){box.click(); hit=lab;} } }
    return {hit, checked:[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)].filter(i=>i.checked).length};
  },[F,etiqueta]);
}
(async()=>{
  const {pg}=await D.attach(); const out={};
  for (const who of ['JOSE MUÑOZ','VIVIANA ESCALANTE']) {
    await D.goto(pg,'/pages/reporteActivacionClientes'); await pg.waitForTimeout(2500);
    await D.pick(pg, F+':clasificacion','Vendedores'); await pg.waitForTimeout(2500);
    await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(300);
    await D.pick(pg, F+':cumplimiento','Facturado'); await pg.waitForTimeout(1200);
    const s = await soloUno(pg, who); await pg.waitForTimeout(600);
    await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(300);
    await pg.evaluate((f)=>{ document.getElementById(f+':fechaDesde_input').value='01/09/2026'; document.getElementById(f+':fechaHasta_input').value='11/09/2026'; },F);
    const resp = await L.clickCapture(pg, F+':ajax','reporteActivacionClientes',10000);
    const e=L.parseErr(resp);
    const g = await pg.evaluate((g)=>{ const t=document.getElementById(g);
      const rows=t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim())):[];
      const m=document.body.innerText.match(/Total de Resultados:\s*([\d.,]+)/); return {total:m?m[1]:null,rows}; },GRID);
    console.log(`## SOLO ${who}: sel=${JSON.stringify(s)} err=${JSON.stringify(e)} total=${g.total} rows=${JSON.stringify(g.rows)}`);
    out[who]={sel:s,err:e,grid:g}; L.save('G5-'+who.replace(/\s/g,'_'),resp); await D.shot(pg,'G5-act-solo-'+who.replace(/\s/g,'_'));
  }
  fs.writeFileSync(__dirname+'/_G_act_solo.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
