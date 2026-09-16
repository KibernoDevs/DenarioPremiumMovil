// w_k6.js — retest de K6 «Cambiar la Unidad de Venta no convierte» en el reporte
// web Plan VS Cuota. Corre la MISMA búsqueda con Unidad de Venta = US$ y = BULTO
// y compara la rejilla.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://denarioelyaque.ddns.net:8080/DenarioPremium';

async function setSelect(pg, id, matchTxt) {
  // PrimeFaces selectOneMenu: click en el div, click en el li del panel
  const box = await pg.evaluate((id) => {
    const d = document.getElementById(id);
    if (!d) return null;
    d.scrollIntoView({ block: 'center' });
    const r = d.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  if (!box) return { ok: false, why: 'sin widget ' + id };
  await pg.mouse.click(box.x, box.y);
  await sleep(900);
  const op = await pg.evaluate(([id, t]) => {
    const p = document.getElementById(id + '_panel');
    if (!p) return { ok: false, why: 'sin panel' };
    const lis = [...p.querySelectorAll('li')];
    const li = lis.find(l => (l.textContent || '').trim() === t) || lis.find(l => (l.textContent || '').includes(t));
    if (!li) return { ok: false, opciones: lis.map(l => l.textContent.trim()) };
    const r = li.getBoundingClientRect();
    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [id, matchTxt]);
  if (!op.ok) return op;
  await pg.mouse.click(op.x, op.y);
  await sleep(3500);
  const val = await pg.evaluate((id) => {
    const s = document.getElementById(id + '_input');
    return s ? { value: s.value, text: s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : null } : null;
  }, id);
  return { ok: true, val };
}

async function setFecha(pg, id, valor) {
  await pg.evaluate(([id, v]) => {
    const i = document.getElementById(id);
    if (!i) return;
    i.value = v;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, valor]);
  await sleep(600);
}

async function buscar(pg) {
  const b = await pg.evaluate(() => {
    const e = document.getElementById('form:j_idt115:ajax');
    if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!b) return { ok: false };
  await pg.mouse.click(b.x, b.y);
  await sleep(11000);
  return { ok: true };
}

function grid(pg) {
  return pg.evaluate(() => {
    const t = document.getElementById('form:tablaComparativoPlanCuota');
    const total = (document.body.innerText.match(/Total de Resultados:\s*([\d.]+)/) || [])[1] || null;
    if (!t) return { total, headers: [], filas: [] };
    const headers = [...t.querySelectorAll('thead th')].map(th => (th.innerText || '').replace(/\s+/g, ' ').trim());
    const filas = [...t.querySelectorAll('tbody tr')].slice(0, 6)
      .map(tr => [...tr.querySelectorAll('td')].map(td => (td.innerText || '').replace(/\s+/g, ' ').trim()));
    return { total, headers, filas };
  });
}

module.exports = async (pg) => {
  await pg.goto(`${BASE}/pages/reportePlanCuota`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(6000);
  const out = { pasos: [] };
  out.pasos.push({ clasificacion: await setSelect(pg, 'form:j_idt115:clasificacion', 'Empresa') });
  out.pasos.push({ cumplimiento: await setSelect(pg, 'form:j_idt115:cumplimiento', 'Facturado') });
  await setFecha(pg, 'form:j_idt115:fechaDesde_input', '01/08/2026');
  await setFecha(pg, 'form:j_idt115:fechaHasta_input', '31/08/2026');

  out.US = {};
  out.pasos.push({ unidadUSD: await setSelect(pg, 'form:j_idt115:unidad', 'US$') });
  await buscar(pg);
  out.US = await grid(pg);

  out.BULTO = {};
  out.pasos.push({ unidadBULTO: await setSelect(pg, 'form:j_idt115:unidad', 'BULTO') });
  await buscar(pg);
  out.BULTO = await grid(pg);

  return out;
};
