'use strict';
// medir.js <etiqueta> <rol> <clasificacion> <cumplimiento> <unidad> <desde> <hasta>
// rol: '' | Vendedor | Transportista
const fs = require('fs'); const path = require('path');
const { attach, goto, shot, pick } = require('./_drv');
const EV = path.join(__dirname, 'evidencia');
const B = 'form:j_idt115';

(async () => {
  const [tag, rol, clas, cumpl, uni, desde, hasta] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(2000);
  // cerrar diálogo de expiración si está
  try { const c = await pg.$('[id="j_idt50:confirm"]'); if (c && await c.isVisible()) { await c.click(); await pg.waitForTimeout(800); } } catch(e){}

  const steps = [];
  // 1) ROL (si se pide)
  if (rol) { steps.push('rol:' + await pick(pg, B + ':idRol', rol)); }
  // 2) CLASIFICACION
  steps.push('clas:' + await pick(pg, B + ':clasificacion', clas));
  await pg.waitForTimeout(1500);
  // 3) VALORES: checkAll vía widget (renderPanel primero)
  const nChk = await pg.evaluate(() => {
    const w = PrimeFaces.widgets['widget_form_j_idt115_checkboxValor'];
    if (!w) return -1;
    try { w.renderPanel(); } catch(e) {}
    try { w.checkAll(); } catch(e) {}
    return [...document.querySelectorAll('input[name="form:j_idt115:checkboxValor"]')].filter(i=>i.checked).length;
  });
  steps.push('valores_checked:' + nChk);
  await pg.waitForTimeout(1200);
  // 4) CUMPLIMIENTO y UNIDAD
  steps.push('cumpl:' + await pick(pg, B + ':cumplimiento', cumpl));
  steps.push('uni:' + await pick(pg, B + ':unidad', uni));
  // 5) FECHAS (al final: los combos las repintan)
  await pg.evaluate(([d,h]) => {
    document.getElementById('form:j_idt115:fechaDesde_input').value = d;
    document.getElementById('form:j_idt115:fechaHasta_input').value = h;
  }, [desde, hasta]);

  // estado real de lo que se va a enviar
  const pre = await pg.evaluate(() => ({
    rol: document.getElementById('form:j_idt115:idRol_input')?.value,
    clas: document.getElementById('form:j_idt115:clasificacion_input')?.value,
    cumpl: document.getElementById('form:j_idt115:cumplimiento_input')?.value,
    uni: document.getElementById('form:j_idt115:unidad_input')?.value,
    d: document.getElementById('form:j_idt115:fechaDesde_input')?.value,
    h: document.getElementById('form:j_idt115:fechaHasta_input')?.value,
    chk: [...document.querySelectorAll('input[name="form:j_idt115:checkboxValor"]')].filter(i=>i.checked).length,
  }));

  // 6) BUSCAR capturando POST + respuesta
  let resp = null, postBody = null;
  const hr = async r => { if (r.request().method()==='POST' && r.url().includes('reportePlanCuota')) { try { resp = await r.text(); postBody = r.request().postData(); } catch(e){} } };
  pg.on('response', hr);
  await pg.$eval(`[id="${B}:ajax"]`, e => e.click());
  await pg.waitForTimeout(9000);
  pg.off('response', hr);

  const m = resp && resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
  const err = m ? m[1] + ' / ' + m[2] : null;
  const body = await pg.evaluate(() => document.body.innerText);
  const total = (body.match(/Total de Resultados:\s*([\d.,]+)/) || [])[1] || null;
  // filas del grid
  const filas = await pg.evaluate(() => {
    const t = document.getElementById('form:tablaComparativoPlanCuota');
    if (!t) return null;
    const head = [...t.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    const rows = [...t.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td=>td.textContent.trim()));
    return { head, rows };
  });

  const out = { tag, pedido: { rol, clas, cumpl, uni, desde, hasta }, steps, pre, err, total, filas };
  fs.writeFileSync(path.join(EV, 'resp-' + tag + '.txt'), (postBody||'(sin POST)') + '\n\n===== RESPUESTA =====\n' + (resp||'(sin respuesta)'));
  fs.writeFileSync(path.join(EV, 'res-' + tag + '.json'), JSON.stringify(out, null, 1));
  await shot(pg, tag);
  console.log(JSON.stringify(out, null, 1).slice(0, 4000));
  process.exit(0);
})();
