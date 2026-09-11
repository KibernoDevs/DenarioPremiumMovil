const L = require('./_lib'); const D = L.D; const fs=require('fs');
const PAGES = [
 ['ind-Vendedores','/pages/pedidosVendedores','form:j_idt115','form:j_idt143'],
 ['ind-Clientes','/pages/pedidosClientes','form:j_idt115',null],
 ['ind-Productos','/pages/indicadoresProductos','form:j_idt115',null],
 ['ind-Pedidos','/pages/indicadoresPedidos','form:j_idt115','form:tablaPedidos'],
];
const out={};
(async () => {
  const { pg } = await D.attach();
  for (const [n,p,F,G] of PAGES) {
    await D.goto(pg,p); await pg.waitForTimeout(3000);
    const has = await pg.evaluate(f=>({d:!!document.getElementById(f+':dateB_input'), c:!!document.getElementById(f+':cumplimiento_label'), cur:!!document.getElementById(f+':idCurrency_label'), ajax:!!document.getElementById(f+':ajax'), ids:[...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>i.startsWith(f+':')&&/date|fecha|anio/i.test(i))}), F);
    await D.pick(pg, F+':cumplimiento', 'Facturado');
    if (has.cur) await D.pick(pg, F+':idCurrency', 'US$');
    if (has.d) await pg.evaluate(([f,a,b])=>{const x=document.getElementById(f+':dateB_input'),y=document.getElementById(f+':dateF_input'); if(x)x.value=a; if(y)y.value=b;}, [F,'01/09/2026','11/09/2026']);
    let resp=null;
    if (has.ajax) resp = await L.clickCapture(pg, F+':ajax', p.split('/').pop().replace('.xhtml',''), 11000);
    else await pg.waitForTimeout(4000);
    const r = await pg.evaluate((g)=>{
      const t = g?document.getElementById(g):null;
      const rows = t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))):[];
      const heads = t?[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')):[];
      const body = document.body.innerText;
      const i = body.indexOf('Filtros');
      return { rows:rows.slice(0,25), heads, frag: body.slice(i, i+1400).replace(/\n+/g,' | ') };
    }, G);
    L.save(n, resp); await D.shot(pg, 'D-'+n);
    out[n]={heads:r.heads, rows:r.rows, frag:r.frag, err:L.parseErr(resp), has};
    console.log(`\n===== ${n} (dates=${has.d} cur=${has.cur}) ERR=${JSON.stringify(L.parseErr(resp))}\n   dateIds=${JSON.stringify(has.ids)}\n   heads=${JSON.stringify(r.heads)}\n   rows=${JSON.stringify(r.rows.slice(0,8))}\n   FRAG=${r.frag.slice(0,900)}`);
  }
  fs.writeFileSync(__dirname+'/_D_med.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
