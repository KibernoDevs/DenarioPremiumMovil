'use strict';
// medir-cuota.js <tag> <page:plan|cumpl> <rdv> <clasificacion> <cumplimiento> <unidad> <desde> <hasta>
// rdv: '-' para no tocar (solo aplica a cumpl)
const fs=require('fs'); const path=require('path');
const { attach, shot, pick, BASE } = require('./_drv');
const EV = path.join(__dirname,'evidencia');

const CFG = {
  plan:  { ruta:'/pages/reportePlanCuota',          B:'form:j_idt115', grid:'form:tablaComparativoPlanCuota', wid:'widget_form_j_idt115_checkboxValor', chkName:'form:j_idt115:checkboxValor', urlpart:'reportePlanCuota' },
  cumpl: { ruta:'/pages/reporteCumplimientoCuota',  B:'form:j_idt116', grid:'form:tablaCumplimientoCuota',   wid:'widget_form_j_idt116_checkboxValor', chkName:'form:j_idt116:checkboxValor', urlpart:'reporteCumplimientoCuota' },
  activ: { ruta:'/pages/reporteActivacionClientes',  B:'form:j_idt115', grid:'form:tablaComparativoPlanCuota', wid:'widget_form_j_idt115_checkboxValor', chkName:'form:j_idt115:checkboxValor', urlpart:'reporteActivacionClientes' },
  rota:  { ruta:'/pages/reporteRotacionInventario',  B:'form:j_idt115', grid:'form:TablaRotacion',            wid:'widget_form_j_idt115_checkboxValor', chkName:'form:j_idt115:checkboxValor', urlpart:'reporteRotacionInventario' },
};

(async () => {
  const [tag, page, rdv, clas, cumpl, uni, desde, hasta] = process.argv.slice(2);
  const C = CFG[page]; const B = C.B;
  const { pg } = await attach();
  await pg.goto(BASE + C.ruta, { waitUntil:'domcontentloaded', timeout:60000 });
  await pg.waitForTimeout(3000);
  try { const c = await pg.$('[id^="j_idt5"][id$=":confirm"]'); if (c && await c.isVisible()) { await c.click(); await pg.waitForTimeout(700); } } catch(e){}

  const steps = [];
  if (rdv && rdv !== '-') steps.push('rdv:' + await pick(pg, B+':codRdv', rdv));
  steps.push('clas:' + await pick(pg, B+':clasificacion', clas));
  await pg.waitForTimeout(1800);
  const nChk = await pg.evaluate(([w,n]) => {
    const wd = PrimeFaces.widgets[w]; if (!wd) return -1;
    try { wd.renderPanel(); } catch(e){}
    try { wd.checkAll(); } catch(e){}
    return [...document.querySelectorAll('input[name="'+n+'"]')].filter(i=>i.checked).length;
  }, [C.wid, C.chkName]);
  steps.push('valores:'+nChk);
  await pg.waitForTimeout(1200);
  steps.push('cumpl:' + await pick(pg, B+':cumplimiento', cumpl));
  if (uni && uni!=='-') steps.push('uni:' + await pick(pg, B+':unidad', uni));
  await pg.evaluate(([b,d,h]) => {
    const a=document.getElementById(b+':fechaDesde_input'); if(a) a.value=d;
    const z=document.getElementById(b+':fechaHasta_input'); if(z) z.value=h;
  }, [B, desde, hasta]);

  const pre = await pg.evaluate(([b,n]) => ({
    rdv: (document.getElementById(b+':codRdv_input')||{}).value,
    clas:(document.getElementById(b+':clasificacion_input')||{}).value,
    cumpl:(document.getElementById(b+':cumplimiento_input')||{}).value,
    uni:(document.getElementById(b+':unidad_input')||{}).value,
    d:(document.getElementById(b+':fechaDesde_input')||{}).value,
    h:(document.getElementById(b+':fechaHasta_input')||{}).value,
    chk:[...document.querySelectorAll('input[name="'+n+'"]')].filter(i=>i.checked).length,
  }), [B, C.chkName]);

  let resp=null, postBody=null;
  const hr = async r => { if (r.request().method()==='POST' && r.url().includes(C.urlpart)) { try{ resp=await r.text(); postBody=r.request().postData(); }catch(e){} } };
  pg.on('response', hr);
  await pg.$eval(`[id="${B}:ajax"]`, e=>e.click());
  await pg.waitForTimeout(11000);
  pg.off('response', hr);

  const m = resp && resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
  const err = m ? m[1]+' / '+m[2] : null;
  const body = await pg.evaluate(()=>document.body.innerText);
  const total = (body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1] || null;
  const filas = await pg.evaluate((g) => {
    const t=document.getElementById(g); if(!t) return null;
    return { head:[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim().replace(/\s+/g,' ')),
             rows:[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim().replace(/\s+/g,' '))) };
  }, C.grid);
  const out={tag,page,pedido:{rdv,clas,cumpl,uni,desde,hasta},steps,pre,err,total,filas};
  fs.writeFileSync(path.join(EV,'resp-'+tag+'.txt'),(postBody||'(sin POST)')+'\n\n===== RESPUESTA =====\n'+(resp||'(sin respuesta)'));
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'),JSON.stringify(out,null,1));
  await shot(pg, tag);
  console.log(JSON.stringify({tag,steps,pre,err,total,head:filas&&filas.head,rows:filas&&filas.rows.slice(0,25)},null,1).slice(0,5000));
  process.exit(0);
})();
