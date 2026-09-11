const L = require('./_lib'); const D = L.D; const fs=require('fs');
const F='form:j_idt115';
async function limpiaOverlays(pg){ try{await pg.keyboard.press('Escape');}catch(e){} try{await pg.mouse.click(5,5);}catch(e){} await pg.waitForTimeout(400); }
async function corre(pg, name, p, cump, d1, d2){
  await D.goto(pg,p); await pg.waitForTimeout(3000);
  await D.pick(pg, F+':cumplimiento', cump); await limpiaOverlays(pg);
  await D.pick(pg, F+':idCurrency', 'US$'); await limpiaOverlays(pg);
  await pg.evaluate(([f,a,b])=>{const x=document.getElementById(f+':dateB_input'),y=document.getElementById(f+':dateF_input'); if(x)x.value=a; if(y)y.value=b;}, [F,d1,d2]);
  let req=null, resp=null;
  const hr = r => { if(r.method()==='POST') { const d=r.postData(); if(d&&d.includes('dateB')) req=d; } };
  const hs = async r => { if(r.request().method()==='POST'){ try{const t=await r.text(); if(t) resp=t;}catch(e){} } };
  pg.on('request',hr); pg.on('response',hs);
  await pg.$eval(`[id="${F}:ajax"]`, e=>e.click());
  await pg.waitForTimeout(14000);
  pg.off('request',hr); pg.off('response',hs);
  const frag = await pg.evaluate(()=>{const b=document.body.innerText;const i=b.indexOf('Buscar');return b.slice(i,i+900).replace(/\n+/g,' | ');});
  console.log(`\n### ${name} [${cump}] ${d1}..${d2}`);
  console.log('   REQ dateB/dateF => ' + (req? (req.match(/dateB_input=[^&]*/)||[''])[0]+' & '+(req.match(/dateF_input=[^&]*/)||[''])[0] + ' | cumpl=' + ((req.match(/cumplimiento_input=[^&]*/)||[''])[0]) : 'NO-CAPTURADO'));
  console.log('   ERR=' + JSON.stringify(L.parseErr(resp)));
  console.log('   FRAG=' + frag.slice(0,700));
  await D.shot(pg,'F-'+name+'-'+cump);
  return {name,cump,d1,d2,req:req?req.slice(0,3000):null,frag};
}
(async () => {
  const { pg } = await D.attach(); const o=[];
  o.push(await corre(pg,'ind-Vendedores','/pages/pedidosVendedores','Facturado','01/01/2026','11/09/2026'));
  o.push(await corre(pg,'ind-Clientes','/pages/pedidosClientes','Facturado','01/01/2026','11/09/2026'));
  fs.writeFileSync(__dirname+'/_F_ind_ano.json', JSON.stringify(o,null,1));
  process.exit(0);
})();
