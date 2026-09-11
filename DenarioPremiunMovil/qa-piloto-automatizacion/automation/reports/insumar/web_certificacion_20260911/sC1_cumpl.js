const L = require('./_lib'); const D = L.D; const F = L.F; const fs=require('fs');
const G='form:tablaCumplimientoCuota'; const P='/pages/reporteCumplimientoCuota';
const out=[];
async function buscar(pg, tag, nota){
  const resp = await L.clickCapture(pg, `${F}:ajax`, 'reporteCumplimientoCuota');
  const e = await L.estado(pg, G); const p = L.parseErr(resp);
  L.save(tag, resp); await D.shot(pg, tag);
  out.push({tag,nota,total:e.total,nrows:e.nrows,err:p.err,det:p.det,heads:e.heads,rows:e.rows,filtros:e.filtros,checked:e.checked});
  console.log(`[${tag}] ${nota}\n  total=${e.total} nrows=${e.nrows} chk=${e.checked} ERR=${p.err||'-'}\n  heads=${JSON.stringify(e.heads)}\n  rows=${JSON.stringify(e.rows.slice(0,4))}`);
}
(async () => {
  const { ctx, pg } = await D.attach();
  console.log('SESION=' + await L.nuevaSesion(ctx,pg));
  const FIL={clas:'Empresa',cump:'Facturado',unid:'US$',d1:'01/09/2026',d2:'11/09/2026',checkAll:true};
  await D.goto(pg,P); await pg.waitForTimeout(2500);
  await D.pick(pg, `${F}:codRdv`, 'Todos');
  await L.setFilters(pg, FIL);
  await buscar(pg,'C1-cumpl-todos','Cumplimiento de Cuota · Empresa/Facturado/US$ · Vendedor=Todos · 01-11/09');
  // Limpiar en este reporte
  const rl = await L.clickCapture(pg, `${F}:botonLimpiar`, 'reporteCumplimientoCuota', 6000); L.save('C2-limpiar',rl);
  console.log('  (Limpiar) ERR=' + JSON.stringify(L.parseErr(rl)));
  await D.pick(pg, `${F}:codRdv`, 'Todos');
  await L.setFilters(pg, FIL);
  await buscar(pg,'C3-cumpl-tras-limpiar','Cumplimiento de Cuota: MISMOS filtros tras pulsar Limpiar');
  fs.writeFileSync(__dirname+'/_C_cumpl.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
