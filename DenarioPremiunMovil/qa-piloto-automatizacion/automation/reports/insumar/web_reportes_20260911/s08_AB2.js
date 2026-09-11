const D = require('./_drv');
const F = 'form:j_idt115';
const a = Object.fromEntries(process.argv.slice(2).map(x => x.replace(/^--/,'').split('=')));
const CLAS=a.clas||'Empresa', CUMP=a.cump||'Pedido', UNID=a.unid||'US$';
const D1=a.d1||'01/01/2026', D2=a.d2||'11/09/2026', TAG=a.tag||'X';
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(1500);
  console.log('clas=' + await D.pick(pg, `${F}:clasificacion`, CLAS));
  console.log('cump=' + await D.pick(pg, `${F}:cumplimiento`, CUMP));
  console.log('unid=' + await D.pick(pg, `${F}:unidad`, UNID));

  // marcar los valores no marcados haciendo click en cada item del panel
  await pg.click(`[id="${F}:checkboxValor"]`); await pg.waitForTimeout(1500);
  let n = await pg.evaluate((f)=>{
    const p=document.getElementById(f+':checkboxValor_panel');
    return p?[...p.querySelectorAll('li.ui-selectcheckboxmenu-item')].map(li=>({txt:li.textContent.trim(),on:li.classList.contains('ui-selectcheckboxmenu-checked')})):[];
  }, F);
  console.log('PANEL_ANTES=' + JSON.stringify(n));
  for (let i=0;i<n.length;i++){
    if(!n[i].on){
      const li = (await pg.$$(`[id="${F}:checkboxValor_panel"] li.ui-selectcheckboxmenu-item`))[i];
      if(li){ await li.click(); await pg.waitForTimeout(500); }
    }
  }
  const close = await pg.$(`[id="${F}:checkboxValor_panel"] .ui-selectcheckboxmenu-close`);
  if (close) { await close.click(); await pg.waitForTimeout(1200); }
  const chk = await pg.evaluate((f)=>{const x=[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)];return x.filter(y=>y.checked).length+'/'+x.length;}, F);
  console.log('CHK=' + chk);

  // FECHAS: escribir de verdad
  for (const [id,val] of [[`${F}:fechaDesde_input`,D1],[`${F}:fechaHasta_input`,D2]]) {
    await pg.click(`[id="${id}"]`); await pg.waitForTimeout(300);
    await pg.fill(`[id="${id}"]`, ''); await pg.waitForTimeout(200);
    await pg.type(`[id="${id}"]`, val, { delay: 40 });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  }
  await pg.evaluate(()=>document.activeElement && document.activeElement.blur());
  await pg.waitForTimeout(600);
  const st = await pg.evaluate((f)=>({clas:document.getElementById(f+':clasificacion_input')?.value,cump:document.getElementById(f+':cumplimiento_input')?.value,unid:document.getElementById(f+':unidad_input')?.value,d1:document.getElementById(f+':fechaDesde_input')?.value,d2:document.getElementById(f+':fechaHasta_input')?.value}), F);
  console.log('ESTADO=' + JSON.stringify(st));
  await pg.click(`[id="${F}:ajax"]`); await pg.waitForTimeout(8000);
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
