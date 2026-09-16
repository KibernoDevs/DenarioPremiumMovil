'use strict';
// medir-ind.js <tag> <ruta> <prefijo> <jsonCombos> [desde] [hasta] [gridId]
// jsonCombos: {"cumplimiento":"Facturado","idCurrency":"US$","vendedor":"Todos"}
const fs=require('fs'),path=require('path');
const { attach, shot, BASE } = require('./_drv');
const pick = require('./_pick2');
const EV=path.join(__dirname,'evidencia');
(async () => {
  const [tag,ruta,B,combosJson,desde,hasta,gridId] = process.argv.slice(2);
  const combos = JSON.parse(combosJson||'{}');
  const { pg } = await attach();
  // GUARDA DE LLEGADA: estas rutas a veces devuelven 404 de Tomcat o quedan a medio pintar.
  // Sin esto, un 0 no se puede atribuir (¿no hay datos, o no llegué a la pantalla?).
  let llegada = 'NO';
  for (let intento = 1; intento <= 4; intento++) {
    await pg.goto(BASE+ruta,{waitUntil:'domcontentloaded',timeout:60000});
    await pg.waitForTimeout(4000);
    const ok = await pg.evaluate((b) => {
      if (/HTTP Status 404|not found/i.test(document.body.innerText.slice(0,400))) return '404';
      const primerCombo = document.querySelector('[id^="'+b+':"].ui-selectonemenu, [id^="'+b+':"][id$="_input"]');
      return primerCombo ? 'OK' : 'SIN-COMBOS';
    }, B);
    llegada = intento + ':' + ok;
    if (ok === 'OK') break;
    await pg.waitForTimeout(2500);
  }
  if (!/OK$/.test(llegada)) { console.log(JSON.stringify({tag, ruta, LLEGADA_FALLIDA: llegada})); process.exit(2); }
  try { const c=await pg.$('[id^="j_idt5"][id$=":confirm"]'); if(c&&await c.isVisible()){await c.click();await pg.waitForTimeout(700);} } catch(e){}
  const steps=[];
  for (const [k,v] of Object.entries(combos)) {
    steps.push(k+':'+await pick(pg, B+':'+k, v));
  }
  if (desde && desde!=='-') await pg.evaluate(([b,d,h])=>{
    // OJO: en los INDICADORES dateF es el INICIO y dateB el FIN (al reves que en Facturaciones,
    // donde dateB=inicio y dateF=fin). Confirmado por los valores por defecto que trae cada pantalla.
    const ini=document.getElementById(b+':dateF_input'); const fin=document.getElementById(b+':dateB_input');
    if(ini) ini.value=d; if(fin) fin.value=h;
    [ini,fin].forEach(e=>{ if(e) e.dispatchEvent(new Event('change',{bubbles:true})); });
  },[B,desde,hasta]);
  const pre = await pg.evaluate((b)=>{
    const g=id=>{const e=document.getElementById(b+':'+id)||document.getElementById(b+':'+id.replace(/_input$/,'')); return e?e.value:undefined;};
    const o={}; ['cumplimiento','idCurrency','vendedor','idSalesmaView','clasificacion','anio1','visualizacion','tipoVista','idTipoDocs','idTipo'].forEach(k=>{const v=g(k+'_input'); if(v!==undefined)o[k]=v;});
    o.dateB=g('dateB_input'); o.dateF=g('dateF_input'); return o;
  },B);
  let resp=null,postBody=null;
  const hr=async r=>{if(r.request().method()==='POST'){try{const t=await r.text(); if(t&&t.length>200){resp=t;postBody=r.request().postData();}}catch(e){}}};
  pg.on('response',hr);
  const clicked = await pg.evaluate((b)=>{const e=document.getElementById(b+':ajax'); if(e){e.click();return true;} return false;},B);
  await pg.waitForTimeout(12000);
  pg.off('response',hr);
  const m=resp&&resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
  const err=m?m[1]+' / '+m[2]:null;
  const r = await pg.evaluate((g)=>{
    const body=document.body.innerText;
    const i=body.indexOf('Request Payment');
    const util=(i>0?body.slice(i+15):body).replace(/\n{2,}/g,'\n').trim().slice(0,2500);
    let grid=null;
    if(g&&g!=='-'){const t=document.getElementById(g); if(t) grid={head:[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim().replace(/\s+/g,' ')),rows:[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim().replace(/\s+/g,' ')))};}
    // cualquier tabla visible
    const tablas=[...document.querySelectorAll('div.ui-datatable, table.ui-datatable')].map(t=>({
      id:t.id,
      n:t.querySelectorAll('tbody tr').length,
      head:[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim().replace(/\s+/g,' ')),
      rows:[...t.querySelectorAll('tbody tr')].slice(0,25).map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim().replace(/\s+/g,' ')))
    }));
    const total=(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null;
    const conT=/T00[1-6]|JOSE MU|LEANDRO MU|YONI MILANO|SAUL PENOTT|ARMANDO|VACANTE/.test(body);
    return {util,grid,tablas,total,menciona_transportista:conT};
  },gridId||'-');
  const out={tag,ruta,llegada,clicked,steps,pre,err,...r};
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'),JSON.stringify(out,null,1));
  if(resp) fs.writeFileSync(path.join(EV,'resp-'+tag+'.txt'),(postBody||'')+'\n\n=====\n'+resp.slice(0,200000));
  await shot(pg,tag);
  console.log(JSON.stringify(out,null,1).slice(0,4500));
  process.exit(0);
})();
