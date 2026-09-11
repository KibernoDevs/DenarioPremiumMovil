const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt115'; const GRID='form:tablaComparativoPlanCuota';
(async()=>{
  const {pg}=await D.attach(); const out={};
  for (const who of ['JOSE MUÑOZ','VIVIANA ESCALANTE']) {
    await D.goto(pg,'/pages/reporteActivacionClientes'); await pg.waitForTimeout(2500);
    await D.pick(pg, F+':clasificacion','Vendedores'); await pg.waitForTimeout(2500);
    await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(300);
    await D.pick(pg, F+':cumplimiento','Facturado'); await pg.waitForTimeout(1200);
    // abrir el panel con clic real sobre el trigger
    await pg.click(`[id="${F}:checkboxValor"] .ui-selectcheckboxmenu-trigger, [id="${F}:checkboxValor"]`, {timeout:8000}).catch(e=>console.log('open-fail '+e.message.slice(0,50)));
    await pg.waitForTimeout(1200);
    const panelVis = await pg.evaluate(f=>{const p=document.getElementById(f+':checkboxValor_panel'); return p? (p.offsetParent!==null) : null;},F);
    // clic real en el label del item
    const li = await pg.$(`[id="${F}:checkboxValor_panel"] li:has(label:text-is("${who}")) .ui-chkbox-box`);
    if (li) { await li.click(); } else { console.log('   NO-ITEM '+who); }
    await pg.waitForTimeout(800);
    const chk = await pg.evaluate(f=>{const ins=[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)]; return {n:ins.length, marcados:ins.filter(i=>i.checked).map(i=>i.value)};},F);
    await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(300);
    await pg.evaluate((f)=>{ document.getElementById(f+':fechaDesde_input').value='01/09/2026'; document.getElementById(f+':fechaHasta_input').value='11/09/2026'; },F);
    let req=null; const hr=r=>{ if(r.method()==='POST'){const d=r.postData(); if(d&&d.includes('checkboxValor')) req=d;} }; pg.on('request',hr);
    const resp = await L.clickCapture(pg, F+':ajax','reporteActivacionClientes',10000); pg.off('request',hr);
    const e=L.parseErr(resp);
    const g = await pg.evaluate((g)=>{ const t=document.getElementById(g);
      const rows=t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim())):[];
      const m=document.body.innerText.match(/Total de Resultados:\s*([\d.,]+)/); return {total:m?m[1]:null,rows}; },GRID);
    console.log(`## SOLO ${who}: panelVis=${panelVis} chk=${JSON.stringify(chk)} err=${JSON.stringify(e)} total=${g.total}`);
    g.rows.forEach(r=>console.log('   ROW '+JSON.stringify(r)));
    console.log('   REQ checkbox='+JSON.stringify((req||'').match(/checkboxValor=[^&]*/g)));
    out[who]={chk,err:e,grid:g}; await D.shot(pg,'G6-act-solo-'+who.replace(/\s/g,'_'));
  }
  fs.writeFileSync(__dirname+'/_G_act_solo.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
