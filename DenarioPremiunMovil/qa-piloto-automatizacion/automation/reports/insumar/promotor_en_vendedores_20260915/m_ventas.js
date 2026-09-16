'use strict';
// m_ventas.js <tag> <vendedorLabel> — Ventas Diarias no tiene boton Buscar: el cambio de combo dispara la consulta
const fs=require('fs'), path=require('path');
const { attach, goto, shot, EV } = require('./_drv');
(async () => {
  const [tag, vend] = process.argv.slice(2);
  const B='form:j_idt116';
  const { pg } = await attach();
  await goto(pg, '/pages/protected/indicadores/pedidosProductosVentas.xhtml'); await pg.waitForTimeout(5000);
  const caps=[];
  pg.on('response', async r=>{ if(r.request().method()==='POST'){ try{ caps.push(await r.text()); }catch(e){} }});
  const antes = await pg.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  await pg.click(`[id="${B}:idSalesmaView"]`, {timeout:10000}).catch(e=>console.log('no abre combo'));
  await pg.waitForTimeout(1200);
  let li = await pg.$(`[id="${B}:idSalesmaView_panel"] li.ui-selectonemenu-item:has-text("${vend}")`);
  console.log('item encontrado:', !!li);
  if (li) { await li.click({timeout:10000}).catch(()=>{}); }
  await pg.waitForTimeout(12000);
  const pre = await pg.evaluate((b)=>{const g=s=>{const e=document.getElementById(s);return e?e.value:null};
    return {vend:g(b+':idSalesmaView_input'), vista:g(b+':tipoVista_input')};}, B);
  console.log('PRE', JSON.stringify(pre));
  console.log('POSTs disparados:', caps.length);
  const despues = await pg.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  const grids = await pg.evaluate(()=>{ const o=[];
    document.querySelectorAll('table').forEach(t=>{ const id=(t.closest('[id]')||{}).id||'?';
      const rows=[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' ')));
      if(rows.length && rows.some(r=>r.length)) o.push({id, n:rows.length, rows:rows.slice(0,8)}); });
    return o; });
  console.log('CAMBIO_PANTALLA=', antes!==despues);
  console.log('GRIDS=', JSON.stringify(grids).slice(0,1800));
  const resp=caps.join('\n---\n');
  fs.writeFileSync(path.join(EV,'resp-'+tag+'.txt'), resp);
  console.log('SERIES_DATA=', JSON.stringify([...resp.matchAll(/"data":\[[^\]]*\]/g)].map(m=>m[0]).slice(0,4)));
  fs.writeFileSync(path.join(EV,'res-'+tag+'.json'), JSON.stringify({tag,pre,grids,cambio:antes!==despues},null,1));
  await shot(pg,tag);
  process.exit(0);
})();
