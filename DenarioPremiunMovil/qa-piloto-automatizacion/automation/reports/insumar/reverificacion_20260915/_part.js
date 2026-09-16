'use strict';
// _part.js <tag> <clasificacion:Linea|Proveedor> <vendedor|-> <cumplimiento> <moneda> <dateF=ini> <dateB=fin>
const fs=require('fs'); const path=require('path');
const { attach, goto, shot, pick, EV } = require('./_drv');
const B='form:j_idt115';
(async () => {
  const [tag, clas, vend, cumpl, cur, dF, dB] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, '/pages/indicadoresProductos');
  const steps=[];
  if(vend&&vend!=='-') steps.push('vend:'+await pick(pg,B+':vendedor',vend));
  steps.push('clas:'+await pick(pg,B+':clasificacion',clas));
  steps.push('cumpl:'+await pick(pg,B+':cumplimiento',cumpl));
  steps.push('cur:'+await pick(pg,B+':idCurrency',cur));
  await pg.evaluate(([b,a,z])=>{const f=document.getElementById(b+':dateF_input');if(f)f.value=a;
    const g=document.getElementById(b+':dateB_input');if(g)g.value=z;},[B,dF,dB]);
  const pre=await pg.evaluate(b=>{const g=s=>{const e=document.getElementById(s);return e?e.value:null;};
    return{vend:g(b+':vendedor_input'),clas:g(b+':clasificacion_input'),cumpl:g(b+':cumplimiento_input'),cur:g(b+':idCurrency_input'),dF:g(b+':dateF_input'),dB:g(b+':dateB_input')};},B);
  let resp=null, armado=false;
  const hr=async r=>{if(armado&&r.request().method()==='POST'){try{const t=await r.text(); if(!resp) resp=t;}catch(e){}}};
  pg.on('response',hr);
  armado=true;
  await pg.$eval(`[id="${B}:ajax"]`,e=>e.click());
  await pg.waitForTimeout(13000);
  pg.off('response',hr);
  // series del grafico: leerlas del widget vivo, no del texto
  const charts = await pg.evaluate(()=>{
    const o=[];
    if(window.PrimeFaces&&PrimeFaces.widgets) for(const k of Object.keys(PrimeFaces.widgets)){
      const w=PrimeFaces.widgets[k];
      const c = w && (w.cfg||{});
      const data = c.data || (c.config&&c.config.data) || (w.chart&&w.chart.data);
      if(data&&(data.datasets||data.labels)){
        o.push({w:k, labels:(data.labels||[]).slice(0,25),
          datasets:(data.datasets||[]).map(ds=>({label:ds.label,data:(ds.data||[]).slice(0,25)}))});
      }
    }
    // canvas sueltos
    const cv=[...document.querySelectorAll('canvas')].map(c=>c.id||c.parentElement.id);
    return {o, cv, widgets: window.PrimeFaces?Object.keys(PrimeFaces.widgets).filter(k=>/chart|grafic|view/i.test(k)):[]};
  });
  const body=await pg.evaluate(()=>document.body.innerText.replace(/\n{2,}/g,'\n'));
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'),JSON.stringify({tag,pre,steps,charts,body:body.slice(0,4000)},null,1));
  if(resp) fs.writeFileSync(path.join(EV,'resp-'+tag+'.txt'),resp.slice(0,400000));
  await shot(pg,tag);
  console.log(JSON.stringify({tag,pre,steps,charts},null,1).slice(0,6000));
  process.exit(0);
})();
