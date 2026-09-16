'use strict';
// _ind.js <tag> <ruta> <pfx> <vendedor|-> <cumplimiento> <moneda> <dateF=inicio> <dateB=fin>
const fs=require('fs'); const path=require('path');
const { attach, goto, shot, pick, EV } = require('./_drv');
(async () => {
  const [tag, ruta, B, vend, cumpl, cur, dF, dB] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, ruta);
  const steps=[];
  const has = async id => pg.evaluate(i=>!!document.getElementById(i+'_input'), id);
  if (vend && vend!=='-' && await has(B+':vendedor')) steps.push('vend:'+await pick(pg, B+':vendedor', vend));
  if (vend && vend!=='-' && await has(B+':idSalesmaView')) steps.push('sv:'+await pick(pg, B+':idSalesmaView', vend));
  if (cumpl && cumpl!=='-' && await has(B+':cumplimiento')) steps.push('cumpl:'+await pick(pg, B+':cumplimiento', cumpl));
  if (cur && cur!=='-' && await has(B+':idCurrency')) steps.push('cur:'+await pick(pg, B+':idCurrency', cur));
  await pg.evaluate(([b,a,z]) => {
    const f=document.getElementById(b+':dateF_input'); if(f) f.value=a;
    const g=document.getElementById(b+':dateB_input'); if(g) g.value=z;
  }, [B, dF, dB]);
  const pre = await pg.evaluate((b)=>{const g=s=>{const e=document.getElementById(s);return e?e.value:null;};
    return {vend:g(b+':vendedor_input')||g(b+':idSalesmaView_input'),cumpl:g(b+':cumplimiento_input'),cur:g(b+':idCurrency_input'),dF:g(b+':dateF_input'),dB:g(b+':dateB_input')};}, B);
  let resp=null, post=null;
  const hr = async r => { if (r.request().method()==='POST') { try{ resp=await r.text(); post=r.request().postData(); }catch(e){} } };
  pg.on('response', hr);
  await pg.$eval(`[id="${B}:ajax"]`, e=>e.click());
  await pg.waitForTimeout(11000);
  pg.off('response', hr);
  const m = resp && resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
  const grids = await pg.evaluate(() => {
    const o=[];
    document.querySelectorAll('div.ui-datatable').forEach(t=>{
      const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' ')));
      if(rows.length) o.push({id:t.id, head:[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim().replace(/\s+/g,' ')), rows:rows.slice(0,30)});
    });
    return o;
  });
  const body = await pg.evaluate(()=>document.body.innerText);
  fs.writeFileSync(path.join(EV,'resp-'+tag+'.txt'),(post||'')+'\n\n=== RESP ===\n'+(resp||''));
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'),JSON.stringify({tag,pre,steps,err:m?m[1]+' / '+m[2]:null,grids},null,1));
  await shot(pg, tag);
  console.log(JSON.stringify({tag,steps,pre,err:m?m[1]:null,grids},null,1).slice(0,4000));
  process.exit(0);
})();
