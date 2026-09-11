const L = require('./_lib'); const D = L.D; const fs=require('fs');
const PAGES = [
 ['ind-Pedidos','/pages/indicadoresPedidos'],
 ['ind-Vendedores','/pages/pedidosVendedores'],
 ['ind-Clientes','/pages/pedidosClientes'],
 ['ind-Productos','/pages/indicadoresProductos'],
 ['ind-VentasDiarias','/pages/protected/indicadores/pedidosProductosVentas.xhtml'],
 ['ind-Cobranzas','/pages/protected/indicadores/indicadorCobros.xhtml'],
 ['ind-Morosidad','/pages/protected/indicadores/indicadorMorosos.xhtml'],
];
async function optsOpen(pg, base) {
  try { await pg.click(`[id="${base}_label"]`, {timeout:4000}); } catch(e) {}
  await pg.waitForTimeout(800);
  const o = await pg.evaluate(b => { const p=document.getElementById(b+'_panel'); return p?[...p.querySelectorAll('li.ui-selectonemenu-item')].map(li=>li.textContent.trim()):null; }, base);
  try { await pg.keyboard.press('Escape'); } catch(e){}
  await pg.waitForTimeout(300); return o;
}
(async () => {
  const { pg } = await D.attach();
  const res={};
  for (const [n,p] of PAGES) {
    try {
      await D.goto(pg, p); await pg.waitForTimeout(2800);
      const ids = await pg.evaluate(()=>[...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>/^form:/.test(i)&&/_label$/.test(i)&&!/pedidosDT|tabla/.test(i)));
      const grids = await pg.evaluate(()=>[...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>/^form:/.test(i)&&/(DT|tabla|Table)/i.test(i)&&!/:/.test(i.replace(/^form:/,''))));
      const path = await pg.evaluate(()=>location.pathname);
      const combos = ids.map(i=>i.replace(/_label$/,''));
      const vend = combos.find(c=>/Salesma|codRdv|vendedor/i.test(c));
      let ov = vend ? await optsOpen(pg, vend) : null;
      res[n]={path, combos, grids, vendCombo:vend||null, vendOpts:ov};
      console.log(`== ${n} (${path})\n   combos=${JSON.stringify(combos)}\n   grids=${JSON.stringify(grids)}\n   VEND=${vend||'-'} opts=${JSON.stringify(ov)}`);
    } catch(e){ console.log('== '+n+' ERROR '+e.message); }
  }
  fs.writeFileSync(__dirname+'/_D_recon.json', JSON.stringify(res,null,1));
  process.exit(0);
})();
