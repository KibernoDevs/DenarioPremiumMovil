'use strict';
// medir-fact.js <tag> <tipoDocumento> <desde> <hasta> [vendedorLabel]
const fs=require('fs'),path=require('path');
const { attach, shot, pick, BASE } = require('./_drv');
const B='form:j_idt116'; const EV=path.join(__dirname,'evidencia');
(async () => {
  const [tag,tipo,desde,hasta,vend] = process.argv.slice(2);
  const { pg } = await attach();
  await pg.goto(BASE+'/pages/facturaciones',{waitUntil:'domcontentloaded',timeout:60000});
  await pg.waitForTimeout(3000);
  try { const c=await pg.$('[id^="j_idt5"][id$=":confirm"]'); if(c&&await c.isVisible()){await c.click();await pg.waitForTimeout(700);} } catch(e){}
  const steps=[];
  steps.push('tipo:'+await pick(pg,B+':tipoDocumento',tipo));
  if (vend && vend!=='-') steps.push('vend:'+await pick(pg,B+':idSalesmaView',vend));
  await pg.evaluate(([b,d,h])=>{const a=document.getElementById(b+':dateB_input');if(a)a.value=d;const z=document.getElementById(b+':dateF_input');if(z)z.value=h;},[B,desde,hasta]);
  const pre = await pg.evaluate((b)=>({tipo:(document.getElementById(b+':tipoDocumento_input')||{}).value,vend:(document.getElementById(b+':idSalesmaView_input')||{}).value,d:(document.getElementById(b+':dateB_input')||{}).value,h:(document.getElementById(b+':dateF_input')||{}).value}),B);
  let resp=null,postBody=null;
  const hr=async r=>{if(r.request().method()==='POST'&&r.url().includes('facturacion')){try{resp=await r.text();postBody=r.request().postData();}catch(e){}}};
  pg.on('response',hr);
  await pg.$eval(`[id="${B}:ajax"]`,e=>e.click());
  await pg.waitForTimeout(12000);
  pg.off('response',hr);
  const m=resp&&resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
  const err=m?m[1]+' / '+m[2]:null;
  // subir filas por pagina a 200 y recorrer paginas sumando
  const agg = await pg.evaluate(() => {
    const body=document.body.innerText;
    const total=(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null;
    const t=document.getElementById('form:pedidosDT');
    const head=t?[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim().replace(/\s+/g,' ')):[];
    const rows=t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim().replace(/\s+/g,' '))):[];
    return {total,head,nPag:rows.length,sample:rows.slice(0,3),
            conT:rows.filter(r=>/T0*[0-9]+\b/.test(r.join('|'))&&/\d{6,}T\d+/.test(r.join('|'))).length,
            codigosT:rows.map(r=>r.join('|')).filter(s=>/\d{6,}T\d+/.test(s)).slice(0,5)};
  });
  const out={tag,pedido:{tipo,desde,hasta,vend},steps,pre,err,...agg};
  fs.writeFileSync(path.join(EV,'resp-'+tag+'.txt'),(postBody||'(sin POST)')+'\n\n===== RESPUESTA =====\n'+(resp||'(sin respuesta)'));
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'),JSON.stringify(out,null,1));
  await shot(pg,tag);
  console.log(JSON.stringify(out,null,1).slice(0,2500));
  process.exit(0);
})();
