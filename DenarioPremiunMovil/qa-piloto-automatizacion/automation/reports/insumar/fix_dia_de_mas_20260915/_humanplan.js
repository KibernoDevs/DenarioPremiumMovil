// Plan vs Cuota / Cumplimiento A MANO, con Valores por clics reales
const { attach, shot, BASE } = require('./_drv');
const fs=require('fs'), path=require('path');
async function combo(pg, base, label){
  await pg.click(`[id="${base}"]`, {timeout:8000}); await pg.waitForTimeout(900);
  const panel=`[id="${base}_panel"]`; await pg.waitForSelector(panel,{timeout:8000});
  for (const li of await pg.$$(`${panel} li.ui-selectonemenu-item`)){
    const t=(await li.textContent()||'').trim();
    if (t===label||t.includes(label)){ await li.click(); await pg.waitForTimeout(3000); return 'ok:'+t; }
  }
  await pg.keyboard.press('Escape'); return 'NO-OPT';
}
(async()=>{
 const [tag,ruta,clas,cumpl,uni,desde,hasta,rdv]=process.argv.slice(2);
 const {pg}=await attach();
 await pg.goto(BASE+ruta,{waitUntil:'domcontentloaded',timeout:60000}); await pg.waitForTimeout(3500);
 const B=await pg.evaluate(()=>{const s=[...document.querySelectorAll('select')].map(x=>x.id).find(i=>/:cumplimiento_input$/.test(i));return s?s.replace(/:cumplimiento_input$/,''):null;});
 const steps=[];
 if(rdv&&rdv!=='-'){ try{ steps.push('rdv:'+await combo(pg,B+':codRdv',rdv)); }catch(e){ steps.push('rdv:ERR'); } }
 steps.push('clas:'+await combo(pg,B+':clasificacion',clas));
 // Valores: abrir por clic real y marcar todo
 let val='n/a';
 try{
   await pg.click(`[id="${B}:checkboxValor"]`,{timeout:6000}); await pg.waitForTimeout(2500);
   const pan=`[id="${B}:checkboxValor_panel"]`;
   const items=await pg.$$(`${pan} li.ui-selectcheckboxmenu-item`);
   const tog=await pg.$(`${pan} .ui-chkbox-box`);
   if (tog){ await tog.click(); await pg.waitForTimeout(1500); }
   val='items='+items.length+' chk='+await pg.evaluate(b=>[...document.querySelectorAll('input[name="'+b+':checkboxValor"]')].filter(i=>i.checked).length,B);
   await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
 }catch(e){ val='ERR:'+e.message.slice(0,60); }
 steps.push('valores:'+val);
 steps.push('cumpl:'+await combo(pg,B+':cumplimiento',cumpl));
 steps.push('uni:'+await combo(pg,B+':unidad',uni));
 for (const [f,v] of [[':fechaDesde_input',desde],[':fechaHasta_input',hasta]]){
   await pg.click(`[id="${B}${f}"]`); await pg.waitForTimeout(400);
   await pg.keyboard.press('Control+A'); await pg.keyboard.type(v,{delay:50});
   await pg.keyboard.press('Escape'); await pg.waitForTimeout(600);
 }
 await pg.evaluate(()=>document.activeElement&&document.activeElement.blur()); await pg.waitForTimeout(800);
 const pre=await pg.evaluate(b=>({rdv:(document.getElementById(b+':codRdv_input')||{}).value,clas:(document.getElementById(b+':clasificacion_input')||{}).value,cumpl:(document.getElementById(b+':cumplimiento_input')||{}).value,uni:(document.getElementById(b+':unidad_input')||{}).value,d:(document.getElementById(b+':fechaDesde_input')||{}).value,h:(document.getElementById(b+':fechaHasta_input')||{}).value,chk:[...document.querySelectorAll('input[name="'+b+':checkboxValor"]')].filter(i=>i.checked).length}),B);
 let resp=null,post=null; const up=ruta.split('/').pop();
 const hr=async r=>{if(r.request().method()==='POST'&&r.url().includes(up)){try{resp=await r.text();post=r.request().postData();}catch(e){}}};
 pg.on('response',hr);
 const btn=await pg.$(`[id="${B}:ajax"]`); const box=await btn.boundingBox();
 await pg.mouse.click(box.x+box.width/2, box.y+box.height/2);
 await pg.waitForTimeout(13000); pg.off('response',hr);
 const m=resp&&resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
 const body=await pg.evaluate(()=>document.body.innerText);
 const rows=await pg.evaluate(()=>{const t=[...document.querySelectorAll('div[id^="formTabla:tabla"]')][0];return t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim().replace(/\s+/g,' '))):null;});
 fs.writeFileSync(path.join(__dirname,'evidencia','res-'+process.argv[2]+'.json'),JSON.stringify({tag,B,steps,pre,err:m?m[1]+' / '+m[2]:null,total:(body.match(/Total de Resultados:s*([d.,]+)/)||[])[1]||null,rows},null,1));
 console.log(JSON.stringify({tag,B,steps,pre,err:m?m[1]+' / '+m[2]:null,total:(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null,nrows:rows&&rows.length,rows:rows},null,1));
 fs.writeFileSync(path.join(__dirname,'evidencia','resp-'+tag+'.txt'),(post||'')+'\n\n==RESP==\n'+(resp||''));
 await shot(pg,tag);
 process.exit(0);
})();
