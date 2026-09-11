const L = require('./_lib'); const D = L.D; const F = L.F;
const G = 'form:tablaComparativoPlanCuota';
const FIL = { clas:'Empresa', cump:'Facturado', unid:'US$', d1:'01/09/2026', d2:'11/09/2026', checkAll:true };
const out = [];
async function paso(pg, tag, nota) {
  const resp = await L.clickCapture(pg, `${F}:ajax`, 'reportePlanCuota');
  const e = await L.estado(pg, G);
  const p = L.parseErr(resp);
  L.save(tag, resp);
  await D.shot(pg, tag);
  const rec = { tag, nota, total:e.total, nrows:e.nrows, checked:e.checked, filtros:e.filtros, err:p.err, det:p.det, row0:e.rows[0]||null, heads:e.heads };
  out.push(rec);
  console.log(`[${tag}] ${nota}\n   total=${e.total} nrows=${e.nrows} chk=${e.checked} ERR=${p.err||'-'} ${p.det||''}\n   filtros=${JSON.stringify(e.filtros)}\n   row0=${JSON.stringify(e.rows[0]||[])}`);
  return rec;
}
(async () => {
  const { pg } = await D.attach();
  // 1) entrada limpia
  await D.goto(pg, '/pages/main'); await pg.waitForTimeout(1200);
  await D.goto(pg, '/pages/reportePlanCuota'); await pg.waitForTimeout(2000);
  await L.setFilters(pg, FIL);
  await paso(pg, 'A1-fresh', '1a busqueda tras entrada limpia');
  // 2) Limpiar + mismos filtros
  const rl = await L.clickCapture(pg, `${F}:botonLimpiar`, 'reportePlanCuota', 6000);
  L.save('A2-limpiar-click', rl);
  const pe = L.parseErr(rl);
  const st = await L.estado(pg, G);
  console.log(`[A2-limpiar] ERR=${pe.err||'-'} chk=${st.checked} filtros=${JSON.stringify(st.filtros)} total=${st.total}`);
  await D.shot(pg,'A2-tras-limpiar');
  await L.setFilters(pg, FIL);
  await paso(pg, 'A3-tras-limpiar', '2a busqueda: mismos filtros DESPUES de Limpiar');
  // 3) buscar otra vez sin tocar nada
  await paso(pg, 'A4-repite', '3a busqueda: Buscar de nuevo sin tocar filtros');
  // 4) recarga de pagina (F5)
  await pg.reload({ waitUntil:'domcontentloaded' }); await pg.waitForTimeout(3000);
  await L.setFilters(pg, FIL);
  await paso(pg, 'A5-tras-reload', '4a: tras recargar la pagina (F5), mismos filtros');
  require('fs').writeFileSync(__dirname+'/_A_secuencia.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
