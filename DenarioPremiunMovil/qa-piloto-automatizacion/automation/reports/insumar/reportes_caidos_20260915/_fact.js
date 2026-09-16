'use strict';
// _fact.js <tag> <tipoDoc> <vendedor|-> <desde> <hasta>   (Facturaciones: dateB=inicio, dateF=fin)
const fs=require('fs'); const path=require('path');
const { attach, goto, shot, pick, EV } = require('./_drv');
const B='form:j_idt116';
(async () => {
  const [tag, tipo, vend, d1, d2] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, '/pages/facturaciones');
  const steps=[];
  steps.push('tipo:'+await pick(pg, B+':tipoDocumento', tipo));
  if (vend && vend!=='-') steps.push('vend:'+await pick(pg, B+':idSalesmaView', vend));
  await pg.evaluate(([b,a,z])=>{const x=document.getElementById(b+':dateB_input');if(x)x.value=a;
    const y=document.getElementById(b+':dateF_input');if(y)y.value=z;},[B,d1,d2]);
  const pre=await pg.evaluate(b=>{const g=s=>{const e=document.getElementById(s);return e?e.value:null;};
    return{tipo:g(b+':tipoDocumento_input'),vend:g(b+':idSalesmaView_input'),inicio:g(b+':dateB_input'),fin:g(b+':dateF_input')};},B);
  let resp=null,post=null;
  const hr=async r=>{if(r.request().method()==='POST'){try{resp=await r.text();post=r.request().postData();}catch(e){}}};
  pg.on('response',hr);
  await pg.$eval(`[id="${B}:ajax"]`,e=>e.click());
  await pg.waitForTimeout(12000);
  pg.off('response',hr);
  const m=resp&&resp.match(/summary:"([^"]*)"/);
  const body=await pg.evaluate(()=>document.body.innerText);
  const tot=(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null;
  const first=await pg.evaluate(()=>{const t=document.getElementById('form:pedidosDT');if(!t)return null;
    return{head:[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')).slice(0,12),
      rows:[...t.querySelectorAll('tbody tr')].slice(0,3).map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' ')).slice(0,8)),
      pag:(t.querySelector('.ui-paginator-current')||{innerText:''}).innerText.trim()};});
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'),JSON.stringify({tag,pre,steps,err:m?m[1]:null,total:tot,first},null,1));
  await shot(pg,tag);
  console.log(JSON.stringify({tag,pre,err:m?m[1]:null,total:tot,pag:first&&first.pag},null,1));
  process.exit(0);
})();
