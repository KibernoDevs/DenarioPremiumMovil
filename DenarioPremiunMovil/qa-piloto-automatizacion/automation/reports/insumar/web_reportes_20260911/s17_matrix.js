const D = require('./_drv');
const fs = require('fs'); const path = require('path');
const F = 'form:j_idt115';
const CASES = [
  ['Empresa','Pedido','US$','01/08/2026','31/08/2026'],
  ['Empresa','Facturado','US$','01/08/2026','31/08/2026'],
  ['Linea','Pedido','US$','01/08/2026','31/08/2026'],
  ['Linea','Facturado','US$','01/08/2026','31/08/2026'],
  ['Linea','Pedido','BULTO','01/08/2026','31/08/2026'],
  ['Linea','Facturado','BULTO','01/08/2026','31/08/2026'],
  ['Sub-Linea','Pedido','US$','01/08/2026','31/08/2026'],
  ['Sub-Linea','Facturado','US$','01/08/2026','31/08/2026'],
];
(async () => {
  const { pg } = await D.attach();
  const out = [];
  for (const [clas,cump,unid,d1,d2] of CASES) {
    await D.goto(pg, '/pages/reportePlanCuota');
    await pg.waitForTimeout(1200);
    await D.pick(pg, `${F}:clasificacion`, clas);
    await D.pick(pg, `${F}:cumplimiento`, cump);
    await D.pick(pg, `${F}:unidad`, unid);
    await pg.evaluate(() => { const w=PrimeFaces.widgets['widget_form_j_idt115_checkboxValor']; try{w.renderPanel()}catch(e){} try{w.checkAll()}catch(e){} });
    await pg.waitForTimeout(400);
    await pg.evaluate(([f,x,y])=>{document.getElementById(f+':fechaDesde_input').value=x;document.getElementById(f+':fechaHasta_input').value=y;}, [F,d1,d2]);
    let resp = null;
    const h = async (res) => { if (res.request().method()==='POST' && res.url().includes('reportePlanCuota')) { try { resp = await res.text(); } catch(e){} } };
    pg.on('response', h);
    await pg.$eval(`[id="${F}:ajax"]`, e=>e.click());
    await pg.waitForTimeout(8000);
    pg.off('response', h);
    const r = await pg.evaluate(() => {
      const t = document.getElementById('form:tablaComparativoPlanCuota');
      const rows = t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))):[];
      const heads = t?[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')):[];
      const m = document.body.innerText.match(/Total de Resultados:\s*(\d+)/);
      return { total:m?m[1]:null, rows, heads };
    });
    const err = resp ? (resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/) || []) : [];
    const tag = `${clas}_${cump}_${unid}`.replace(/[^A-Za-z0-9_-]/g,'');
    await D.shot(pg, 'AB-' + tag);
    out.push({ clas, cump, unid, d1, d2, total: r.total, nrows: r.rows.length, heads: r.heads, rows: r.rows.slice(0,30), err: err[1]||null, errdet: err[2]||null });
    console.log(`${clas} | ${cump} | ${unid} => TOTAL=${r.total} ERR=${err[1]||'-'} rows0=${JSON.stringify(r.rows[0]||[])}`);
    if (resp) fs.writeFileSync(path.join(__dirname,'evidencia', 'resp-'+tag+'.txt'), resp.slice(0,20000));
  }
  fs.writeFileSync(path.join(__dirname,'_ab_matrix.json'), JSON.stringify(out,null,1));
  process.exit(0);
})();
