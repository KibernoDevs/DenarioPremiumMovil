const L = require('./_lib'); const D = L.D; const F = L.F; const fs=require('fs');
const G = 'form:tablaComparativoPlanCuota';
const out = [];
async function paso(pg, tag, nota) {
  const resp = await L.clickCapture(pg, `${F}:ajax`, 'reportePlanCuota');
  const e = await L.estado(pg, G); const p = L.parseErr(resp);
  L.save(tag, resp); await D.shot(pg, tag);
  out.push({ tag, nota, total:e.total, err:p.err, det:p.det, row0:e.rows[0]||null, filtros:e.filtros, checked:e.checked });
  console.log(`[${tag}] ${nota}\n   total=${e.total} chk=${e.checked} ERR=${p.err||'-'} row0=${JSON.stringify(e.rows[0]||[])}`);
}
async function limpiar(pg, tag) {
  const r = await L.clickCapture(pg, `${F}:botonLimpiar`, 'reportePlanCuota', 6000);
  L.save(tag, r); const p = L.parseErr(r);
  console.log(`   (Limpiar ${tag}) ERR=${p.err||'-'}`);
}
(async () => {
  const { ctx, pg } = await D.attach();
  const PED = { clas:'Empresa', cump:'Pedido', unid:'US$', d1:'01/09/2026', d2:'11/09/2026', checkAll:true };
  // A10: sesion sana (viene de sA2) -> Limpiar -> filtros PEDIDO -> Buscar
  await D.goto(pg,'/pages/reportePlanCuota'); await pg.waitForTimeout(2000);
  await L.setFilters(pg, PED);
  await paso(pg,'A10-pedido-1a','CONTROL Pedido: 1a busqueda en sesion viva (ya hubo Buscar antes en esta sesion)');
  await limpiar(pg,'A11-limpiar');
  await L.setFilters(pg, PED);
  await paso(pg,'A12-pedido-tras-limpiar','Pedido tras Limpiar');
  // A13: sesion NUEVA -> Limpiar ANTES de cualquier busqueda -> filtros -> Buscar
  console.log('RELOGIN=' + await L.nuevaSesion(ctx,pg));
  await D.goto(pg,'/pages/reportePlanCuota'); await pg.waitForTimeout(2500);
  await limpiar(pg,'A13-limpiar-primero');
  await L.setFilters(pg, PED);
  await paso(pg,'A14-limpiar-antes-de-buscar','Sesion nueva: Limpiar ANTES de la 1a busqueda, luego filtros y Buscar');
  fs.writeFileSync(__dirname+'/_A_secuencia3.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
