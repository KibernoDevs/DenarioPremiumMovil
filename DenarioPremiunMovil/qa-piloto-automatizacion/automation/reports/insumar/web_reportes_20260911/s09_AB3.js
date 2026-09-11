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

  // abrir el panel con force y marcar todo item por item
  await pg.$eval(`[id="${F}:checkboxValor"] .ui-selectcheckboxmenu-trigger, [id="${F}:checkboxValor"]`, e=>e.click());
  await pg.waitForTimeout(1500);
  let items = await pg.$$(`[id="${F}:checkboxValor_panel"] li.ui-selectcheckboxmenu-item`);
  console.log('ITEMS=' + items.length);
  for (let i=0;i<items.length;i++){
    const on = await items[i].evaluate(li=>li.classList.contains('ui-selectcheckboxmenu-checked'));
    if(!on){ await items[i].evaluate(li=>li.querySelector('.ui-chkbox-box').click()); await pg.waitForTimeout(400); }
  }
  await pg.$eval(`[id="${F}:checkboxValor_panel"] .ui-selectcheckboxmenu-close`, e=>e.click()).catch(()=>{});
  await pg.waitForTimeout(1200);
  const chk = await pg.evaluate((f)=>{const x=[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)];return x.filter(y=>y.checked).length+'/'+x.length;}, F);
  console.log('CHK=' + chk);

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
