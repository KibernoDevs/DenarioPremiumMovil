const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt115';
async function medir(pg, name, p, cump, d1, d2){
  await D.goto(pg,p); await pg.waitForTimeout(3000);
  await D.pick(pg, F+':cumplimiento', cump);
  await D.pick(pg, F+':idCurrency', 'US$');
  await pg.evaluate(([f,a,b])=>{const x=document.getElementById(f+':dateB_input'),y=document.getElementById(f+':dateF_input'); if(x)x.value=a; if(y)y.value=b;}, [F,d1,d2]);
  const resp = await L.clickCapture(pg, F+':ajax', p.split('/').pop(), 14000);
  const r = await pg.evaluate((f)=>{
    const o={};
    for (const [k,w] of Object.entries(window.PrimeFaces.widgets)) { try{ const c=w&&w.cfg&&w.cfg.config&&w.cfg.config.data; if(c) o[k]={labels:(c.labels||[]).slice(0,10), ds:(c.datasets||[]).map(d=>({l:d.label,d:(d.data||[]).slice(0,10)}))}; }catch(e){} }
    const gi=id=>{const e=document.getElementById(id);return e?e.value:null;};
    const b=document.body.innerText; const i=b.indexOf('Buscar');
    return {charts:o, d1:gi(f+':dateB_input'), d2:gi(f+':dateF_input'), cump:gi(f+':cumplimiento_input'), cur:gi(f+':idCurrency_input'), frag:b.slice(i,i+700).replace(/\n+/g,' | ')};
  }, F);
  await D.shot(pg,'D4-'+name+'-'+cump);
  console.log(`\n##### ${name} [${cump}] ${r.d1}..${r.d2} cump=${r.cump} cur=${r.cur} ERR=${JSON.stringify(L.parseErr(resp))}`);
  for (const [k,v] of Object.entries(r.charts)) if((v.labels&&v.labels.length)||v.ds.some(d=>d.d.length)) console.log('  '+k+' L='+JSON.stringify(v.labels)+' D='+JSON.stringify(v.ds));
  console.log('  FRAG='+r.frag.slice(0,500));
  return r;
}
(async () => {
  const { pg } = await D.attach();
  const o={};
  o.cli_ano = await medir(pg,'ind-Clientes','/pages/pedidosClientes','Facturado','01/01/2026','11/09/2026');
  o.prod_ano = await medir(pg,'ind-Productos','/pages/indicadoresProductos','Facturado','01/01/2026','11/09/2026');
  o.vend_ano = await medir(pg,'ind-Vendedores','/pages/pedidosVendedores','Facturado','01/01/2026','11/09/2026');
  fs.writeFileSync(__dirname+'/_D_ano.json', JSON.stringify(o,null,1));
  process.exit(0);
})();
