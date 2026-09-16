'use strict';
const fs=require('fs'),path=require('path');
const { attach, goto, shot, pick } = require('./_drv');
const B='form:j_idt116';
(async () => {
  const [tag, vend] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, '/pages/reporteCumplimientoCuota');
  await pg.waitForTimeout(2000);
  const st=[];
  st.push('vend:'+await pick(pg,B+':codRdv',vend));
  st.push('clas:'+await pick(pg,B+':clasificacion','Empresa'));
  await pg.waitForTimeout(1200);
  const n=await pg.evaluate(()=>{const w=PrimeFaces.widgets['widget_form_j_idt116_checkboxValor'];if(!w)return -1;try{w.renderPanel()}catch(e){};try{w.checkAll()}catch(e){};return [...document.querySelectorAll('input[name="form:j_idt116:checkboxValor"]')].filter(i=>i.checked).length;});
  st.push('chk:'+n);
  st.push('cumpl:'+await pick(pg,B+':cumplimiento','Facturado'));
  st.push('uni:'+await pick(pg,B+':unidad','US$'));
  await pg.evaluate(()=>{const a=document.getElementById('form:j_idt116:fechaDesde_input'),b=document.getElementById('form:j_idt116:fechaHasta_input');if(a)a.value='01/09/2026';if(b)b.value='14/09/2026';});
  let resp=null,post=null;
  const h=async r=>{if(r.request().method()==='POST'&&r.url().includes('reporteCumplimientoCuota')){try{resp=await r.text();post=r.request().postData()}catch(e){}}};
  pg.on('response',h);
  await pg.$eval(`[id="${B}:ajax"]`,e=>e.click());
  await pg.waitForTimeout(9000); pg.off('response',h);
  const m=resp&&resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
  const r=await pg.evaluate(()=>{
    const body=document.body.innerText;
    const total=(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null;
    const t=document.getElementById('form:tablaCumplimientoCuota');
    return {total,head:t?[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim()):null,
      rows:t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim())):null};
  });
  const out={tag,vend,st,err:m?m[1]:null,...r};
  fs.writeFileSync(path.join(__dirname,'evidencia','resp-'+tag+'.txt'),(post||'')+'\n\n=== RESP ===\n'+(resp||''));
  fs.writeFileSync(path.join(__dirname,'evidencia','res-'+tag+'.json'),JSON.stringify(out,null,1));
  console.log(JSON.stringify(out,null,1).slice(0,2200));
  await shot(pg,tag);
  process.exit(0);
})();
