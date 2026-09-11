const L = require('./_lib'); const D = L.D; const fs=require('fs');
async function limpiaOverlays(pg){ try{await pg.keyboard.press('Escape');}catch(e){} try{await pg.mouse.click(5,5);}catch(e){} await pg.waitForTimeout(400); }
async function pickSafe(pg, base, label){
  await limpiaOverlays(pg);
  try { await pg.evaluate(b=>{const e=document.getElementById(b+'_label'); if(e)e.scrollIntoView({block:'center'});}, base); } catch(e){}
  await pg.waitForTimeout(300);
  try { await pg.click(`[id="${base}_label"]`, {timeout:6000}); }
  catch(e){ try { await pg.evaluate(b=>{const w=PrimeFaces.widgets['widget_'+b.replace(/:/g,'_')]; w&&w.show&&w.show();}, base); } catch(e2){ return 'NOPANEL'; } }
  await pg.waitForTimeout(900);
  const el = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if(!el) { await limpiaOverlays(pg); return 'NOITEM'; }
  await el.click(); await pg.waitForTimeout(2200); return 'OK';
}
async function medir(pg, name, p, F, cump, d1, d2, vend){
  await D.goto(pg,p); await pg.waitForTimeout(3000);
  const r1 = await pickSafe(pg, F+':cumplimiento', cump);
  const r2 = await pickSafe(pg, F+':idCurrency', 'US$');
  let r3='-'; if(vend) r3 = await pickSafe(pg, F+':vendedor', vend);
  await pg.evaluate(([f,a,b])=>{const x=document.getElementById(f+':dateB_input'),y=document.getElementById(f+':dateF_input'); if(x)x.value=a; if(y)y.value=b;}, [F,d1,d2]);
  await limpiaOverlays(pg);
  const resp = await L.clickCapture(pg, F+':ajax', p.split('/').pop().replace('.xhtml',''), 14000);
  const r = await pg.evaluate((f)=>{
    const ch={};
    for (const [k,w] of Object.entries(window.PrimeFaces.widgets)) { try{ const c=w&&w.cfg&&w.cfg.config&&w.cfg.config.data; if(c&&((c.labels&&c.labels.length)||(c.datasets||[]).some(d=>(d.data||[]).length))) ch[k]={labels:(c.labels||[]).slice(0,12), ds:(c.datasets||[]).map(d=>({l:d.label,d:(d.data||[]).slice(0,12)}))}; }catch(e){} }
    const gi=id=>{const e=document.getElementById(id);return e?e.value:null;};
    const b=document.body.innerText; const i=b.indexOf('Buscar');
    return {ch, d1:gi(f+':dateB_input'), d2:gi(f+':dateF_input'), cump:gi(f+':cumplimiento_input'), cur:gi(f+':idCurrency_input'), vend:gi(f+':vendedor_input'), frag:b.slice(i,i+1200).replace(/\n+/g,' | ')};
  }, F);
  await D.shot(pg,'E-'+name+'-'+cump+(vend?'-'+vend.slice(0,6):''));
  console.log(`\n##### ${name} [${cump}] ${r.d1}..${r.d2} cur=${r.cur} vend=${r.vend} picks=${r1}/${r2}/${r3} ERR=${JSON.stringify(L.parseErr(resp))}`);
  for (const [k,v] of Object.entries(r.ch)) console.log('   CHART '+k+' L='+JSON.stringify(v.labels)+' D='+JSON.stringify(v.ds));
  console.log('   FRAG='+r.frag.slice(0,850));
  return {name,cump,d1:r.d1,d2:r.d2,vend:r.vend,charts:r.ch,frag:r.frag,err:L.parseErr(resp)};
}
(async () => {
  const { pg } = await D.attach();
  const o=[];
  const W=['01/09/2026','11/09/2026'];
  o.push(await medir(pg,'ind-Vendedores','/pages/pedidosVendedores','form:j_idt115','Facturado',...W));
  o.push(await medir(pg,'ind-Vendedores','/pages/pedidosVendedores','form:j_idt115','Pedido',...W));
  o.push(await medir(pg,'ind-Clientes','/pages/pedidosClientes','form:j_idt115','Facturado',...W));
  o.push(await medir(pg,'ind-Productos','/pages/indicadoresProductos','form:j_idt115','Facturado',...W));
  fs.writeFileSync(__dirname+'/_E_ind.json', JSON.stringify(o,null,1));
  process.exit(0);
})();
