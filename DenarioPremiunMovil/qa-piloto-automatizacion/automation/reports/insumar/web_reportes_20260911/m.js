const D = require('./_drv');
const F = 'form:j_idt115';
const a = Object.fromEntries(process.argv.slice(2).map(x => x.replace(/^--/,'').split('=')));
const CLAS=a.clas||'Linea', CUMP=a.cump||'Pedido', UNID=a.unid||'US$';
const D1=a.d1||'01/01/2026', D2=a.d2||'11/09/2026', TAG=a.tag||'X';
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(1500);
  await D.pick(pg, `${F}:clasificacion`, CLAS);
  await D.pick(pg, `${F}:cumplimiento`, CUMP);
  await D.pick(pg, `${F}:unidad`, UNID);
  const cb = await pg.evaluate(() => {
    const w = PrimeFaces.widgets['widget_form_j_idt115_checkboxValor'];
    try { w.renderPanel(); } catch(e) {}
    try { w.checkAll(); } catch(e) {}
    const x = [...document.querySelectorAll('input[name="form:j_idt115:checkboxValor"]')];
    return { n: x.length, on: x.filter(i=>i.checked).length,
             labels: x.map(i=>((document.querySelector(`label[for="${CSS.escape(i.id)}"]`)||{}).textContent||'').trim()) };
  });
  console.log('VALORES=' + cb.on + '/' + cb.n);
  console.log('COMBO_VALOR=' + JSON.stringify(cb.labels));
  await pg.evaluate(([f,x,y])=>{document.getElementById(f+':fechaDesde_input').value=x;document.getElementById(f+':fechaHasta_input').value=y;}, [F,D1,D2]);
  const st = await pg.evaluate((f)=>({clas:document.getElementById(f+':clasificacion_input')?.value,cump:document.getElementById(f+':cumplimiento_input')?.value,unid:document.getElementById(f+':unidad_input')?.value,d1:document.getElementById(f+':fechaDesde_input')?.value,d2:document.getElementById(f+':fechaHasta_input')?.value}), F);
  console.log('ESTADO=' + JSON.stringify(st));
  await pg.$eval(`[id="${F}:ajax"]`, e=>e.click());
  await pg.waitForTimeout(9000);
  await D.shot(pg, TAG);
  const res = await pg.evaluate(() => {
    const t = document.getElementById('form:tablaComparativoPlanCuota');
    const heads = t?[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')):[];
    const rows = t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))):[];
    const m = document.body.innerText.match(/Total de Resultados:\s*(\d+)/);
    return { total:m?m[1]:null, heads, rows };
  });
  console.log('TOTAL=' + res.total); console.log('HEADS=' + JSON.stringify(res.heads)); console.log('NROWS=' + res.rows.length);
  res.rows.forEach((r,i)=>console.log('R'+i+'='+JSON.stringify(r)));
  process.exit(0);
})();
