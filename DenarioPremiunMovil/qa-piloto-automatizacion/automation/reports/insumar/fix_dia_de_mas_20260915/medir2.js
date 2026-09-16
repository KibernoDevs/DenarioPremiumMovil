'use strict';
// medir2.js <tag> <ruta> <rdv> <clasificacion> <cumplimiento> <unidad> <desde> <hasta>
// Auto-descubre los ids del formulario (el build de la tarde renombro form -> formFiltros/formTabla)
const fs=require('fs'); const path=require('path');
const { attach, shot, pick, BASE } = require('./_drv');
const EV = path.join(__dirname,'evidencia');

(async () => {
  const [tag, ruta, rdv, clas, cumpl, uni, desde, hasta] = process.argv.slice(2);
  const { pg } = await attach();
  await pg.goto(BASE + ruta, { waitUntil:'domcontentloaded', timeout:60000 });
  await pg.waitForTimeout(3500);
  try { const c = await pg.$('[id^="j_idt"][id$=":confirm"]'); if (c && await c.isVisible()) { await c.click(); await pg.waitForTimeout(700); } } catch(e){}

  // descubrimiento
  const D = await pg.evaluate(() => {
    const s = [...document.querySelectorAll('select')].map(x=>x.id);
    const clasSel = s.find(i=>/:clasificacion_input$/.test(i)) || s.find(i=>/:cumplimiento_input$/.test(i));
    const B = clasSel ? clasSel.replace(/:(clasificacion|cumplimiento)_input$/,'') : null;
    const tabla = [...document.querySelectorAll('div[id*="tabla"],div[id*="Tabla"]')].map(x=>x.id)
                   .filter(i=>!/_/.test(i.split(':').pop()))[0] || null;
    const rolSel = s.filter(i=>/rol/i.test(i));
    return { B, tabla, selects: s, rolSel };
  });
  const B = D.B;
  if (!B) { console.log(JSON.stringify({tag, ERROR:'NO-BASE', D})); process.exit(1); }
  const WID = 'widget_' + B.replace(/[:.]/g,'_') + '_checkboxValor';
  const CHK = B + ':checkboxValor';

  const steps = [];
  if (rdv && rdv !== '-') steps.push('rdv:' + await pick(pg, B+':codRdv', rdv));
  steps.push('clas:' + await pick(pg, B+':clasificacion', clas));
  await pg.waitForTimeout(1800);
  const nChk = await pg.evaluate(([w,n]) => {
    const wd = PrimeFaces.widgets[w]; if (!wd) return -1;
    try { wd.renderPanel(); } catch(e){}
    try { wd.checkAll(); } catch(e){}
    return [...document.querySelectorAll('input[name="'+n+'"]')].filter(i=>i.checked).length;
  }, [WID, CHK]);
  steps.push('valores:'+nChk);
  await pg.waitForTimeout(1200);
  steps.push('cumpl:' + await pick(pg, B+':cumplimiento', cumpl));
  if (uni && uni!=='-') steps.push('uni:' + await pick(pg, B+':unidad', uni));
  await pg.evaluate(([b,d,h]) => {
    const a=document.getElementById(b+':fechaDesde_input'); if(a) a.value=d;
    const z=document.getElementById(b+':fechaHasta_input'); if(z) z.value=h;
  }, [B, desde, hasta]);

  const pre = await pg.evaluate(([b,n]) => ({
    emp:(document.getElementById(b+':idEnterprise_input')||{}).value,
    rdv: (document.getElementById(b+':codRdv_input')||{}).value,
    clas:(document.getElementById(b+':clasificacion_input')||{}).value,
    cumpl:(document.getElementById(b+':cumplimiento_input')||{}).value,
    uni:(document.getElementById(b+':unidad_input')||{}).value,
    d:(document.getElementById(b+':fechaDesde_input')||{}).value,
    h:(document.getElementById(b+':fechaHasta_input')||{}).value,
    chk:[...document.querySelectorAll('input[name="'+n+'"]')].filter(i=>i.checked).length,
  }), [B, CHK]);

  let resp=null, postBody=null;
  const urlpart = ruta.split('/').pop();
  const hr = async r => { if (r.request().method()==='POST' && r.url().includes(urlpart)) { try{ resp=await r.text(); postBody=r.request().postData(); }catch(e){} } };
  pg.on('response', hr);
  await pg.$eval(`[id="${B}:ajax"]`, e=>e.click());
  await pg.waitForTimeout(12000);
  pg.off('response', hr);

  const m = resp && resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
  const err = m ? m[1]+' / '+m[2] : null;
  const body = await pg.evaluate(()=>document.body.innerText);
  const total = (body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1] || null;
  const filas = await pg.evaluate((g) => {
    const t=g&&document.getElementById(g); if(!t) return null;
    return { head:[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim().replace(/\s+/g,' ')),
             rows:[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim().replace(/\s+/g,' '))) };
  }, D.tabla);
  const out={tag,ruta,B,tabla:D.tabla,rolSel:D.rolSel,pedido:{rdv,clas,cumpl,uni,desde,hasta},steps,pre,err,total,filas};
  fs.writeFileSync(path.join(EV,'resp-'+tag+'.txt'),(postBody||'(sin POST)')+'\n\n===== RESPUESTA =====\n'+(resp||'(sin respuesta)'));
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'),JSON.stringify(out,null,1));
  await shot(pg, tag);
  console.log(JSON.stringify({tag,B,tabla:D.tabla,rolSel:D.rolSel,steps,pre,err,total,head:filas&&filas.head,rows:filas&&filas.rows.slice(0,30)},null,1).slice(0,6000));
  process.exit(0);
})();
