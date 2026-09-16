'use strict';
// m_cobr.js <tag> <labelVendedor|__TODOS__> [dIni] [dFin] [moneda]
const fs=require('fs'), path=require('path');
const { attach, goto, shot, EV } = require('./_drv');
const RUTA='/pages/protected/indicadores/indicadorCobros.xhtml';
const B='form:j_idt115';

async function pick(pg, base, label){
  await pg.click(`[id="${base}"]`, {timeout:12000}).catch(e=>console.log('  abrir panel FALLO'));
  await pg.waitForTimeout(1200);
  let li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if(!li) li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:has-text("${label}")`);
  if(!li){ await pg.keyboard.press('Escape'); return 'NO-ITEM'; }
  await li.click({timeout:12000}).catch(()=>{});
  await pg.waitForTimeout(2500);
  return 'ok';
}
const val = (pg,id)=>pg.evaluate(i=>{const e=document.getElementById(i);return e?e.value:null}, id);

(async () => {
  const [tag, vend, dIni='01/08/2026', dFin='31/08/2026', moneda='USD', cliente='', extras='[]'] = process.argv.slice(2);
  const { pg } = await attach();

  // ── LIMPIAR: recarga completa de la pantalla (no hay boton Limpiar aqui) ──
  await goto(pg, RUTA); await pg.waitForTimeout(4500);
  const vendTrasRecarga = await val(pg, B+':idSalesmaView_input');
  console.log('VEND_TRAS_RECARGA=' + JSON.stringify(vendTrasRecarga));

  // ── vendedor ──
  console.log('vendedor:', await pick(pg, B+':idSalesmaView', vend==='__TODOS__' ? 'Vendedor' : vend));
  // ── moneda ──
  console.log('moneda:', await pick(pg, B+':idCurrency', moneda));
  // ── cliente (opcional) ──
  if (cliente) console.log('cliente:', await pick(pg, B+':clientSOM', cliente));
  for (const [sub,lab] of JSON.parse(extras)) console.log(sub+':', await pick(pg, B+':'+sub, lab));
  // ── fechas: poner, CERRAR el calendario y RE-VERIFICAR (el campo revierte en silencio) ──
  for (let i=0;i<5;i++){
    await pg.fill(`[id="${B}:dateF_input"]`, dIni).catch(()=>console.log('dateF NO'));
    await pg.waitForTimeout(400);
    await pg.mouse.click(60, 780).catch(()=>{});      // cerrar datepicker de dateF
    await pg.waitForTimeout(600);
    await pg.fill(`[id="${B}:dateB_input"]`, dFin).catch(()=>console.log('dateB NO'));
    await pg.waitForTimeout(400);
    await pg.mouse.click(60, 780).catch(()=>{});      // cerrar datepicker de dateB
    await pg.waitForTimeout(900);
    const v = await pg.evaluate((b)=>{const g=s=>{const e=document.getElementById(s);return e?e.value:null};
      return [g(b+':dateF_input'), g(b+':dateB_input')];}, B);
    console.log('fechas intento'+i+': '+JSON.stringify(v));
    if (v[0]===dIni && v[1]===dFin) break;
  }

  const pre = await pg.evaluate((b)=>{ const g=s=>{const e=document.getElementById(s);return e?e.value:null};
    const lab=s=>{const e=document.getElementById(s);return e?e.innerText.trim():null};
    return { dateF:g(b+':dateF_input'), dateB:g(b+':dateB_input'),
             idSalesmaView:g(b+':idSalesmaView_input'), vendLabel:lab(b+':idSalesmaView_label'),
             idCurrency:g(b+':idCurrency_input'), curLabel:lab(b+':idCurrency_label'),
             idEnterprise:g(b+':idEnterprise_input'), idTipo:g(b+':idTipo_input'),
             cliente:g(b+':clientSOM_input'), idDep:g(b+':idDep_input'), orderStatus:g(b+':orderStatus_input') }; }, B);
  console.log('PRE', JSON.stringify(pre));

  // ── capturar AJAX (peticion + respuesta) SOLO del Buscar ──
  const caps=[], reqs=[];
  pg.on('request', r=>{ if(r.method()==='POST'){ try{ const d=r.postData(); if(d) reqs.push(d); }catch(e){} }});
  pg.on('response', async r=>{ if(r.request().method()==='POST'){ try{ caps.push(await r.text()); }catch(e){} }});
  await pg.waitForTimeout(500); caps.length=0; reqs.length=0;

  // ── cerrar datepicker y VERIFICAR que Buscar no esta tapado ──
  let clic='NO', occLog=[];
  for (let i=0;i<6 && clic!=='OK';i++){
    await pg.mouse.click(60, 780).catch(()=>{});
    await pg.waitForTimeout(1200);
    const occ = await pg.evaluate((b)=>{
      const el=document.getElementById(b+':ajax'); if(!el) return 'NO-BTN';
      const r=el.getBoundingClientRect(); const t=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
      return (t===el||el.contains(t)) ? 'LIBRE' : (t?(t.tagName+'.'+t.className).slice(0,70):'null');
    }, B);
    occLog.push('intento'+i+':'+occ); console.log('oclusion '+occLog[occLog.length-1]);
    if (occ!=='LIBRE') continue;
    try { await pg.click(`[id="${B}:ajax"]`, {timeout:9000}); clic='OK'; }
    catch(e){ console.log('clic Buscar FALLO: '+String(e.message).slice(0,90)); await pg.waitForTimeout(1500); }
  }
  console.log('CLIC_BUSCAR='+clic);
  if (clic!=='OK'){ console.log('🔴 BUSCAR_NO_PULSADO — no se concluye nada de esta medicion'); }
  await pg.waitForTimeout(16000);

  // ── POST: verificar que el rango aplicado es el pedido ──
  const post = await pg.evaluate((b)=>{ const g=s=>{const e=document.getElementById(s);return e?e.value:null};
    const lab=s=>{const e=document.getElementById(s);return e?e.innerText.trim():null};
    return { dateF:g(b+':dateF_input'), dateB:g(b+':dateB_input'),
             idSalesmaView:g(b+':idSalesmaView_input'), vendLabel:lab(b+':idSalesmaView_label'),
             idCurrency:g(b+':idCurrency_input') }; }, B);
  console.log('POST', JSON.stringify(post));

  const resp = caps.join('\n---RESP---\n');
  const req  = reqs.join('\n---REQ---\n');
  fs.writeFileSync(path.join(EV,'resp-'+tag+'.txt'), resp);
  fs.writeFileSync(path.join(EV,'req-'+tag+'.txt'), req);

  // lo que VIAJO al servidor
  const enviados={};
  for (const k of ['idSalesmaView','idCurrency','dateF_input','dateB_input','idEnterprise','idTipo','orderStatus']){
    const m=[...req.matchAll(new RegExp('form%3Aj_idt115%3A'+k+'(?:_input)?=([^&]*)','g'))].map(x=>decodeURIComponent(x[1]));
    if(m.length) enviados[k]=[...new Set(m)];
  }
  console.log('ENVIADO_AL_SERVIDOR=', JSON.stringify(enviados));

  // series de los graficos
  const series = [...resp.matchAll(/"data"\s*:\s*(\[[^\]]*\])/g)].map(m=>m[1]);
  const labels = [...resp.matchAll(/"label"\s*:\s*"([^"]{1,60})"/g)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i);
  const ticks  = [...resp.matchAll(/"ticks"\s*:\s*(\[[^\]]*\])/g)].map(m=>m[1]);
  console.log('SERIES='+JSON.stringify(series));
  console.log('LABELS='+JSON.stringify(labels));
  console.log('TICKS='+JSON.stringify(ticks).slice(0,600));

  const grids = await pg.evaluate(()=>{ const o=[];
    document.querySelectorAll('table.ui-datatable-data, div.ui-datatable table').forEach(t=>{
      const id=(t.closest('[id]')||{}).id||'?';
      const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' ')));
      if(rows.length) o.push({id, rows}); });
    return o; });
  const body = await pg.evaluate(()=>document.body.innerText);
  console.log('GRIDS='+JSON.stringify(grids).slice(0,2000));
  console.log('NOREG='+/No existe registro|No se encontraron registros/i.test(body));
  console.log('RESP_BYTES='+resp.length);

  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'),
    JSON.stringify({tag, vendedorPedido:vend, clicBuscar:clic, oclusion:occLog, pre, post, enviados, series, labels, ticks, grids,
                    noreg:/No existe registro|No se encontraron registros/i.test(body)},null,1));
  await shot(pg, tag);
  process.exit(0);
})();
