const L = require('./_lib'); const D = L.D;
async function optsOpen(pg, base) {
  try { await pg.click(`[id="${base}_label"]`, {timeout:5000}); } catch(e) {
    try { await pg.evaluate(b=>{const w=PrimeFaces.widgets['widget_'+b.replace(/:/g,'_')]; w.show&&w.show();}, base); } catch(e2){}
  }
  await pg.waitForTimeout(900);
  const o = await pg.evaluate(b => { const p=document.getElementById(b+'_panel'); return p?[...p.querySelectorAll('li.ui-selectonemenu-item')].map(li=>li.textContent.trim()):null; }, base);
  try { await pg.keyboard.press('Escape'); } catch(e){}
  await pg.waitForTimeout(400);
  return o;
}
(async () => {
  const { pg } = await D.attach();
  const PAGES = [
    ['CumplimientoCuota','/pages/reporteCumplimientoCuota',['form:j_idt115:codRdv']],
    ['PlanCuota','/pages/reportePlanCuota',['form:j_idt115:clasificacion','form:j_idt115:cumplimiento','form:j_idt115:unidad']],
  ];
  for (const [n,p,bases] of PAGES) {
    await D.goto(pg, p); await pg.waitForTimeout(2500);
    for (const b of bases) console.log(n+' | '+b+' => '+JSON.stringify(await optsOpen(pg,b)));
  }
  process.exit(0);
})();
