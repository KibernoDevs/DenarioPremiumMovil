const D = require('./_drv');
const F = 'form:j_idt115';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/,'').split('=')));
const CLAS = args.clas || 'Linea', CUMP = args.cump || 'Pedido', UNID = args.unid || 'US$';
const D1 = args.d1 || '01/01/2026', D2 = args.d2 || '11/09/2026', TAG = args.tag || 'X';

(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(1500);

  // COMBOS primero (repintan las fechas)
  console.log('clas=' + await D.pick(pg, `${F}:clasificacion`, CLAS));
  console.log('cump=' + await D.pick(pg, `${F}:cumplimiento`, CUMP));
  console.log('unid=' + await D.pick(pg, `${F}:unidad`, UNID));

  // asegurar TODOS los valores marcados
  let cb = await pg.evaluate((f)=>{
    const n = [...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)];
    return { total:n.length, checked:n.filter(x=>x.checked).length, labels:n.map(x=>document.querySelector(`label[for="${CSS.escape(x.id)}"]`)?.textContent.trim()) };
  }, F);
  console.log('CHK_ANTES=' + cb.checked + '/' + cb.total);
  if (cb.checked !== cb.total) {
    await pg.click(`[id="${F}:checkboxValor"]`); await pg.waitForTimeout(1200);
    const tog = await pg.$(`[id="${F}:checkboxValor_panel"] .ui-selectcheckboxmenu-header .ui-chkbox-box`);
    if (tog) { await tog.click(); await pg.waitForTimeout(1200);
      const st = await pg.evaluate((f)=>[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)].filter(x=>x.checked).length, F);
      if (st === 0) { await tog.click(); await pg.waitForTimeout(1200); } }
    const close = await pg.$(`[id="${F}:checkboxValor_panel"] .ui-selectcheckboxmenu-close`);
    if (close) { await close.click(); await pg.waitForTimeout(1000); }
    cb = await pg.evaluate((f)=>{const n=[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)];return {total:n.length,checked:n.filter(x=>x.checked).length};}, F);
    console.log('CHK_DESPUES=' + cb.checked + '/' + cb.total);
  }
  console.log('OPCIONES_COMBO_VALOR=' + JSON.stringify(cb.labels || []));

  // FECHAS al final
  await pg.evaluate(([f,a,b])=>{document.getElementById(f+':fechaDesde_input').value=a;document.getElementById(f+':fechaHasta_input').value=b;}, [F,D1,D2]);
  const st = await pg.evaluate((f)=>({clas:document.getElementById(f+':clasificacion_input')?.value,cump:document.getElementById(f+':cumplimiento_input')?.value,unid:document.getElementById(f+':unidad_input')?.value,d1:document.getElementById(f+':fechaDesde_input')?.value,d2:document.getElementById(f+':fechaHasta_input')?.value}), F);
  console.log('ESTADO=' + JSON.stringify(st));

  await pg.click(`[id="${F}:ajax"]`); await pg.waitForTimeout(7000);
  await D.shot(pg, TAG);
  const res = await pg.evaluate(() => {
    const t = document.getElementById('form:tablaComparativoPlanCuota');
    const heads = t ? [...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')) : [];
    const rows = t ? [...t.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))) : [];
    const m = document.body.innerText.match(/Total de Resultados:\s*(\d+)/);
    return { total: m?m[1]:null, heads, rows };
  });
  console.log('TOTAL=' + res.total); console.log('HEADS=' + JSON.stringify(res.heads)); console.log('NROWS=' + res.rows.length);
  res.rows.forEach((r,i)=>console.log('R'+i+'='+JSON.stringify(r)));
  process.exit(0);
})();
