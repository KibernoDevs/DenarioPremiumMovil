const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt115';
async function medir(pg, name, p, cump){
  await D.goto(pg,p); await pg.waitForTimeout(3000);
  await D.pick(pg, F+':cumplimiento', cump);
  await D.pick(pg, F+':idCurrency', 'US$');
  await pg.evaluate(([f,a,b])=>{const x=document.getElementById(f+':dateB_input'),y=document.getElementById(f+':dateF_input'); if(x)x.value=a; if(y)y.value=b;}, [F,'01/09/2026','11/09/2026']);
  const resp = await L.clickCapture(pg, F+':ajax', p.split('/').pop(), 12000);
  const ch = await pg.evaluate(()=>{
    const o={};
    for (const [k,w] of Object.entries(window.PrimeFaces.widgets)) {
      try{
        const c = w && w.cfg && w.cfg.config && w.cfg.config.data;
        if (c) o[k] = { labels: c.labels, ds: (c.datasets||[]).map(d=>({label:d.label, data:d.data})) };
      }catch(e){}
    }
    return o;
  });
  await D.shot(pg,'D2-'+name+'-'+cump);
  console.log('\n##### '+name+' ['+cump+'] ERR='+JSON.stringify(L.parseErr(resp)));
  for (const [k,v] of Object.entries(ch)) console.log('  '+k+' labels='+JSON.stringify((v.labels||[]).slice(0,12))+' data='+JSON.stringify(v.ds.map(d=>({l:d.label,d:(d.data||[]).slice(0,12)}))));
  return ch;
}
(async () => {
  const { pg } = await D.attach();
  const o={};
  o.clientes = await medir(pg,'ind-Clientes','/pages/pedidosClientes','Facturado');
  o.productos = await medir(pg,'ind-Productos','/pages/indicadoresProductos','Facturado');
  o.vendedoresPedido = await medir(pg,'ind-Vendedores','/pages/pedidosVendedores','Pedido');
  fs.writeFileSync(__dirname+'/_D_charts.json', JSON.stringify(o,null,1));
  process.exit(0);
})();
