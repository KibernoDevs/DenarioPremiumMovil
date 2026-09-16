'use strict';
// Reproduccion "a mano": clics reales sobre los selectOneMenu, sin JS de atajo.
const { attach, goto, shot } = require('./_drv');
const B='form:j_idt116';
async function clickPick(pg, base, label){
  await pg.click(`[id="${base}"]`, {timeout:8000}).catch(()=>{});
  await pg.waitForTimeout(900);
  const li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if(!li) return 'NO-ITEM';
  await li.click({timeout:8000}).catch(()=>{});
  await pg.waitForTimeout(2200);
  return 'clic';
}
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/reporteCumplimientoCuota');
  console.log('emp:', await clickPick(pg, B+':idEnterprise', 'INSUMAR DISTRIBUIDORA 715, C.A.'));
  console.log('rdv:', await clickPick(pg, B+':codRdv', 'Todos'));
  console.log('clas:', await clickPick(pg, B+':clasificacion', 'Empresa'));
  console.log('cump:', await clickPick(pg, B+':cumplimiento', 'Facturado'));
  console.log('uni:', await clickPick(pg, B+':unidad', 'US$'));
  await pg.fill(`[id="${B}:fechaDesde_input"]`, '01/08/2026').catch(()=>{});
  await pg.fill(`[id="${B}:fechaHasta_input"]`, '31/08/2026').catch(()=>{});
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(800);
  let resp=null; pg.on('response', async r=>{if(r.request().method()==='POST'){try{resp=await r.text();}catch(e){}}});
  await pg.click(`[id="${B}:ajax"]`);
  await pg.waitForTimeout(12000);
  const m=resp&&resp.match(/summary:"([^"]*)"/);
  const body=await pg.evaluate(()=>document.body.innerText);
  console.log('ERR=', m?m[1]:null, '| TOTAL=', (body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]);
  await shot(pg, 'HUMANO_CUMPL_ago');
  process.exit(0);
})();
