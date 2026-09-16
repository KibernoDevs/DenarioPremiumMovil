'use strict';
// m_ind.js <tag> <ruta> <B> <picks:JSON> <dateF_inicio> <dateB_fin>
const fs=require('fs'), path=require('path');
const { attach, goto, shot, EV } = require('./_drv');
async function clickPick(pg, base, label){
  await pg.click(`[id="${base}"]`, {timeout:10000}).catch(()=>{});
  await pg.waitForTimeout(1200);
  let li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if(!li) li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:has-text("${label}")`);
  if(!li) return 'NO-ITEM';
  await li.click({timeout:10000}).catch(()=>{});
  await pg.waitForTimeout(3000);
  return 'ok';
}
(async () => {
  const [tag, ruta, B, picksJson, dIni, dFin] = process.argv.slice(2);
  const picks = JSON.parse(picksJson);
  const { pg } = await attach();
  await goto(pg, ruta); await pg.waitForTimeout(4000);
  const caps=[];
  pg.on('response', async r=>{ if(r.request().method()==='POST'){ try{ caps.push(await r.text()); }catch(e){} }});
  for (const [sub,label] of picks) console.log(sub+':', await clickPick(pg, B+':'+sub, label));
  if (dIni) await pg.fill(`[id="${B}:dateF_input"]`, dIni).catch(e=>console.log('dateF NO'));
  if (dFin) await pg.fill(`[id="${B}:dateB_input"]`, dFin).catch(e=>console.log('dateB NO'));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(800);
  const pre = await pg.evaluate((a)=>{const [b,subs]=a; const g=s=>{const e=document.getElementById(s);return e?e.value:null};
    const o={dateF:g(b+':dateF_input'),dateB:g(b+':dateB_input')};
    subs.forEach(s=>o[s]=g(b+':'+s+'_input')); return o;}, [B, picks.map(p=>p[0])]);
  console.log('PRE', JSON.stringify(pre));
  caps.length=0;
  // despejar overlays (el datepicker tapa el boton Buscar) y VERIFICAR oclusion
  let clic='NO';
  for (let i=0;i<5 && clic!=='OK';i++){
    await pg.mouse.click(60, 700).catch(()=>{});   // clic real en zona neutra
    await pg.waitForTimeout(1200);
    const occ = await pg.evaluate((b)=>{
      const el=document.getElementById(b+':ajax'); if(!el) return 'NO-BTN';
      const r=el.getBoundingClientRect(); const t=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
      return (t===el||el.contains(t)) ? 'LIBRE' : (t?(t.tagName+'.'+t.className).slice(0,60):'null');
    }, B);
    console.log('oclusion intento'+i+': '+occ);
    if (occ!=='LIBRE' && occ!=='NO-BTN') continue;
    try { await pg.click(`[id="${B}:ajax"]`, {timeout:8000}); clic='OK'; }
    catch(e){ console.log('clic Buscar FALLO: '+String(e.message).slice(0,80)); await pg.waitForTimeout(1500); }
  }
  console.log('CLIC_BUSCAR='+clic);
  if (clic!=='OK') { console.log('BUSCAR_NO_PULSADO — no se concluye nada de esta pantalla'); }
  await pg.waitForTimeout(15000);
  const body = await pg.evaluate(()=>document.body.innerText);
  const resp = caps.join('\n---\n');
  fs.writeFileSync(path.join(EV,'resp-'+tag+'.txt'), resp);
  // series de los gráficos / grids
  const grids = await pg.evaluate(()=>{
    const o=[];
    document.querySelectorAll('table.ui-datatable-data, div.ui-datatable table').forEach(t=>{
      const id=(t.closest('[id]')||{}).id||'?';
      const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' ')));
      if(rows.length) o.push({id, rows});
    });
    return o;
  });
  console.log('BODY_HAS_P001=', /MARIA JOSE|P001/i.test(body));
  console.log('RESP_HAS_P001=', /MARIA JOSE|P001/i.test(resp));
  console.log('NOREG=', /No existe registro/i.test(body));
  console.log('GRIDS=', JSON.stringify(grids).slice(0,2500));
  // etiquetas de series en la respuesta ajax (gráficos jqplot)
  const labs = [...resp.matchAll(/"?label"?\s*:\s*"([^"]{2,60})"/g)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i);
  console.log('SERIES=', JSON.stringify(labs).slice(0,1200));
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'), JSON.stringify({tag,pre,grids,labs,noreg:/No existe registro/i.test(body)},null,1));
  await shot(pg,tag);
  process.exit(0);
})();
