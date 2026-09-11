const D = require('./_drv');
const fs=require('fs'), path=require('path');
const F = 'form:j_idt115';
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(2000);
  // CONTROL 1: no tocar NADA, solo Buscar
  let resp=null; const h=async r=>{if(r.request().method()==='POST'&&r.url().includes('reportePlanCuota')){try{resp=await r.text()}catch(e){}}};
  pg.on('response',h);
  const st0 = await pg.evaluate((f)=>({clas:document.getElementById(f+':clasificacion_input')?.value,cump:document.getElementById(f+':cumplimiento_input')?.value,unid:document.getElementById(f+':unidad_input')?.value,d1:document.getElementById(f+':fechaDesde_input')?.value,d2:document.getElementById(f+':fechaHasta_input')?.value, val:[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)].filter(i=>i.checked).length}), F);
  console.log('CONTROL1_ESTADO=' + JSON.stringify(st0));
  await pg.$eval(`[id="${F}:ajax"]`, e=>e.click());
  await pg.waitForTimeout(8000); pg.off('response',h);
  const m0 = resp? (resp.match(/summary:"([^"]*)"/)||[])[1] : null;
  const t0 = await pg.evaluate(()=>{const m=document.body.innerText.match(/Total de Resultados:\s*(\d+)/);return m?m[1]:null;});
  console.log('CONTROL1 TOTAL=' + t0 + ' ERR=' + m0);
  await D.shot(pg,'B-CONTROL1-defaults');
  if(resp) fs.writeFileSync(path.join(__dirname,'evidencia','resp-control1.txt'), resp.slice(0,20000));

  // CONTROL 2: otro reporte de la misma familia (Cumplimiento de Cuota) para ver si la sesión/permiso va bien
  await D.goto(pg, '/pages/reporteCumplimientoCuota');
  await pg.waitForTimeout(2500);
  const txt = (await D.txt(pg));
  console.log('CUMPLIMIENTO_TXT=' + txt.slice(txt.indexOf('Filtros'), txt.indexOf('Filtros')+700).replace(/\n/g,' | '));
  await D.shot(pg,'B-CONTROL2-cumplimiento');
  process.exit(0);
})();
