const L = require('./_lib'); const D = L.D; const F = L.F; const fs=require('fs');
const G='form:tablaCumplimientoCuota'; const P='/pages/reporteCumplimientoCuota';
const out=[];
async function caso(pg, vend, tag){
  await D.goto(pg,P); await pg.waitForTimeout(2500);
  const ok = await D.pick(pg, `${F}:codRdv`, vend);
  await L.setFilters(pg, {clas:'Empresa',cump:'Facturado',unid:'US$',d1:'01/09/2026',d2:'11/09/2026',checkAll:true});
  const resp = await L.clickCapture(pg, `${F}:ajax`, 'reporteCumplimientoCuota');
  const e = await L.estado(pg, G); const p=L.parseErr(resp);
  L.save(tag,resp); await D.shot(pg,tag);
  out.push({tag,vend,pickOk:ok,total:e.total,err:p.err,rows:e.rows,filtros:e.filtros});
  console.log(`[${tag}] vend="${vend}" pick=${ok} total=${e.total} ERR=${p.err||'-'} rows=${JSON.stringify(e.rows.slice(0,3))}`);
}
(async () => {
  const { pg } = await D.attach();
  await caso(pg,'T001 JOSE MUÑOZ','C4-cumpl-T001');
  await caso(pg,'R013 VIVIANA ESCALANTE','C5-cumpl-R013');
  await caso(pg,'C001 CATALOGO  INSUMAR','C6-cumpl-C001');
  fs.writeFileSync(__dirname+'/_C_vend.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
