const D = require('./_drv');
const F = 'form:j_idt115';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=').map(s=>s.replace(/^--/,''))).map(([k,v])=>[k,v]));
const CLAS = args.clas || 'Linea';
const CUMP = args.cump || 'Pedido';
const UNID = args.unid || 'US$';
const D1 = args.d1 || '01/01/2026';
const D2 = args.d2 || '11/09/2026';
const TAG = args.tag || 'X';
const ALL = args.all === '1';

(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(1200);
  const lim = await pg.$(`[id="${F}:botonLimpiar"]`);
  if (lim) { await lim.click(); await pg.waitForTimeout(2500); }

  // 1) COMBOS primero
  console.log('clasificacion=' + await D.pick(pg, `${F}:clasificacion`, CLAS));
  console.log('cumplimiento=' + await D.pick(pg, `${F}:cumplimiento`, CUMP));
  console.log('unidad=' + await D.pick(pg, `${F}:unidad`, UNID));

  // 2) checkboxValor
  const cbItems = await pg.evaluate((f) => {
    const p = document.getElementById(f + ':checkboxValor_panel');
    if (!p) return null;
    return [...p.querySelectorAll('li.ui-selectcheckboxmenu-item')].map(li => li.textContent.trim());
  }, F);
  if (ALL) {
    await pg.click(`[id="${F}:checkboxValor"] .ui-selectcheckboxmenu-trigger`).catch(()=>{});
    await pg.waitForTimeout(1200);
    const items = await pg.evaluate((f) => {
      const p = document.getElementById(f + ':checkboxValor_panel');
      if (!p) return null;
      return [...p.querySelectorAll('.ui-selectcheckboxmenu-item, li')].map(li => li.textContent.trim()).filter(Boolean);
    }, F);
    console.log('CB_ITEMS=' + JSON.stringify(items));
    // marcar "toggle all"
    const tog = await pg.$(`[id="${F}:checkboxValor_panel"] .ui-chkbox-box`);
    if (tog) { await tog.click(); await pg.waitForTimeout(1500); }
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
  } else {
    console.log('CB_ITEMS(cerrado)=' + JSON.stringify(cbItems));
  }

  // 3) FECHAS al final
  await pg.evaluate(([f,a,b]) => {
    const e1 = document.getElementById(f+':fechaDesde_input'); e1.value=a;
    const e2 = document.getElementById(f+':fechaHasta_input'); e2.value=b;
  }, [F, D1, D2]);
  await pg.waitForTimeout(400);

  // verificar estado real antes de buscar
  const st = await pg.evaluate((f) => ({
    clas: document.getElementById(f+':clasificacion_input')?.value,
    cump: document.getElementById(f+':cumplimiento_input')?.value,
    unid: document.getElementById(f+':unidad_input')?.value,
    d1: document.getElementById(f+':fechaDesde_input')?.value,
    d2: document.getElementById(f+':fechaHasta_input')?.value,
    cbLabel: document.getElementById(f+':checkboxValor')?.innerText.trim().replace(/\s+/g,' '),
  }), F);
  console.log('ESTADO=' + JSON.stringify(st));

  await pg.click(`[id="${F}:ajax"]`);
  await pg.waitForTimeout(6000);
  await D.shot(pg, TAG);

  const res = await pg.evaluate(() => {
    const t = document.getElementById('form:tablaComparativoPlanCuota');
    const heads = t ? [...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')) : [];
    const rows = t ? [...t.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))) : [];
    const m = document.body.innerText.match(/Total de Resultados:\s*(\d+)/);
    return { total: m ? m[1] : null, heads, rows };
  });
  console.log('TOTAL=' + res.total);
  console.log('HEADS=' + JSON.stringify(res.heads));
  console.log('NROWS=' + res.rows.length);
  res.rows.forEach((r,i)=>console.log('R'+i+'='+JSON.stringify(r)));
  process.exit(0);
})();
