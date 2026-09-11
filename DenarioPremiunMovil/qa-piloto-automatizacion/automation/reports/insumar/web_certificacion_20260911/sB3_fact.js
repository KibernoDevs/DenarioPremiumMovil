const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt116';
async function optsOpen(pg, base) {
  try { await pg.click(`[id="${base}_label"]`, {timeout:5000}); } catch(e) {}
  await pg.waitForTimeout(900);
  const o = await pg.evaluate(b => { const p=document.getElementById(b+'_panel'); return p?[...p.querySelectorAll('li.ui-selectonemenu-item')].map(li=>li.textContent.trim()):null; }, base);
  try { await pg.keyboard.press('Escape'); } catch(e){}
  await pg.waitForTimeout(400); return o;
}
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/facturaciones'); await pg.waitForTimeout(2500);
  console.log('VENDEDORES => ' + JSON.stringify(await optsOpen(pg, F+':idSalesmaView')));
  console.log('TIPODOC    => ' + JSON.stringify(await optsOpen(pg, F+':tipoDocumento')));
  console.log('MONEDA     => ' + JSON.stringify(await optsOpen(pg, F+':idCurrency')));
  process.exit(0);
})();
