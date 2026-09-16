// Reproduccion A MANO: clics reales sobre cada combo, tecleo real de fechas
const { attach, shot, BASE } = require('./_drv');
const fs=require('fs'), path=require('path');
async function combo(pg, base, label){
  await pg.click(`[id="${base}"]`, {timeout:8000});
  await pg.waitForTimeout(900);
  const panel = `[id="${base}_panel"]`;
  await pg.waitForSelector(panel, {timeout:8000});
  const it = await pg.$$(`${panel} li.ui-selectonemenu-item`);
  for (const li of it){
    const t=(await li.textContent()||'').trim();
    if (t===label || t.includes(label)){ await li.click(); await pg.waitForTimeout(2200); return 'ok:'+t; }
  }
  await pg.keyboard.press('Escape');
  return 'NO-OPT';
}
(async()=>{
 const [tag,desde,hasta,clas,cumpl,uni]=process.argv.slice(2);
 const {pg}=await attach();
 await pg.goto(BASE+'/pages/reporteCumplimientoCuota',{waitUntil:'domcontentloaded',timeout:60000});
 await pg.waitForTimeout(3500);
 const B='formFiltros:j_idt116';
 const steps=[];
 steps.push('clas:'+await combo(pg,B+':clasificacion',clas));
 steps.push('cumpl:'+await combo(pg,B+':cumplimiento',cumpl));
 steps.push('uni:'+await combo(pg,B+':unidad',uni));
 for (const [f,v] of [[':fechaDesde_input',desde],[':fechaHasta_input',hasta]]){
   await pg.click(`[id="${B}${f}"]`); await pg.waitForTimeout(400);
   await pg.keyboard.press('Control+A'); await pg.keyboard.type(v,{delay:60});
   await pg.keyboard.press('Escape'); await pg.waitForTimeout(600);
 }
 await pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
 await pg.waitForTimeout(800);
 const pre=await pg.evaluate(b=>({clas:(document.getElementById(b+':clasificacion_input')||{}).value,cumpl:(document.getElementById(b+':cumplimiento_input')||{}).value,uni:(document.getElementById(b+':unidad_input')||{}).value,d:(document.getElementById(b+':fechaDesde_input')||{}).value,h:(document.getElementById(b+':fechaHasta_input')||{}).value}),B);
 let resp=null,post=null;
 const hr=async r=>{if(r.request().method()==='POST'&&r.url().includes('reporteCumplimientoCuota')){try{resp=await r.text();post=r.request().postData();}catch(e){}}};
 pg.on('response',hr);
 const btn=await pg.$(`[id="${B}:ajax"]`);
 const box=await btn.boundingBox();
 await pg.mouse.click(box.x+box.width/2, box.y+box.height/2);
 await pg.waitForTimeout(12000);
 pg.off('response',hr);
 const m=resp&&resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
 const body=await pg.evaluate(()=>document.body.innerText);
 const rows=await pg.evaluate(()=>{const t=document.getElementById('formTabla:tablaCumplimientoCuota');return t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim().replace(/\s+/g,' '))):null;});
 console.log(JSON.stringify({tag,steps,pre,err:m?m[1]+' / '+m[2]:null,total:(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null,rows},null,1).slice(0,4000));
 fs.writeFileSync(path.join(__dirname,'evidencia','resp-'+tag+'.txt'),(post||'')+'\n\n==RESP==\n'+(resp||''));
 await shot(pg,tag);
 process.exit(0);
})();
