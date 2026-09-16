// w_k6b.js — misma búsqueda de Plan VS Cuota con tres Unidades de Venta:
// (sin unidad) · US$ · BULTO · UNIDADES, para ver si la cifra CONVIERTE.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://denarioelyaque.ddns.net:8080/DenarioPremium';

async function opciones(pg, id) {
  return await pg.evaluate((id) => {
    const s = document.getElementById(id + '_input');
    return s ? [...s.options].map(o => ({ v: o.value, t: o.text })) : null;
  }, id);
}

// PrimeFaces: escribir en el <select> nativo + change dispara el ajax del widget
async function setSelect(pg, id, valueExact) {
  const box = await pg.evaluate((id) => {
    const d = document.getElementById(id);
    if (!d) return null;
    d.scrollIntoView({ block: 'center' });
    const r = d.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, id);
  await pg.mouse.click(box.x, box.y);
  await sleep(1000);
  const op = await pg.evaluate(([id, v]) => {
    const p = document.getElementById(id + '_panel');
    if (!p) return { ok: false, why: 'sin panel' };
    const s = document.getElementById(id + '_input');
    const idx = [...s.options].findIndex(o => o.value === v);
    const lis = [...p.querySelectorAll('li.ui-selectonemenu-item')];
    const li = lis[idx];
    if (!li) return { ok: false, idx, lis: lis.map(l => l.textContent.trim()) };
    li.scrollIntoView({ block: 'center' });
    const r = li.getBoundingClientRect();
    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2, txt: li.textContent.trim() };
  }, [id, valueExact]);
  if (!op.ok) return op;
  await pg.mouse.click(op.x, op.y);
  await sleep(3500);
  const val = await pg.evaluate((id) => {
    const s = document.getElementById(id + '_input');
    return { value: s.value, text: s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : null };
  }, id);
  return { ok: true, val };
}

async function setFecha(pg, id, valor) {
  await pg.evaluate(([id, v]) => {
    const i = document.getElementById(id);
    i.value = v;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, valor]);
  await sleep(600);
}

async function buscar(pg) {
  const b = await pg.evaluate(() => {
    const e = document.getElementById('form:j_idt115:ajax');
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await pg.mouse.click(b.x, b.y);
  await sleep(12000);
}

function grid(pg) {
  return pg.evaluate(() => {
    const t = document.getElementById('form:tablaComparativoPlanCuota');
    const total = (document.body.innerText.match(/Total de Resultados:\s*([\d.]+)/) || [])[1] || null;
    if (!t) return { total, headers: [], filas: [] };
    return {
      total,
      headers: [...t.querySelectorAll('thead th')].map(th => (th.innerText || '').replace(/\s+/g, ' ').trim()),
      filas: [...t.querySelectorAll('tbody tr')].slice(0, 3)
        .map(tr => [...tr.querySelectorAll('td')].map(td => (td.innerText || '').replace(/\s+/g, ' ').trim())),
    };
  });
}

module.exports = async (pg) => {
  await pg.goto(`${BASE}/pages/reportePlanCuota`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(6000);
  const out = { opcionesUnidad: await opciones(pg, 'form:j_idt115:unidad'), corridas: {} };
  out.clasif = await setSelect(pg, 'form:j_idt115:clasificacion', 'Empresa');
  const cumpl = await opciones(pg, 'form:j_idt115:cumplimiento');
  out.opcionesCumpl = cumpl;
  const fact = (cumpl || []).find(o => /Facturado/i.test(o.t));
  out.cumpl = fact ? await setSelect(pg, 'form:j_idt115:cumplimiento', fact.v) : null;
  await setFecha(pg, 'form:j_idt115:fechaDesde_input', '01/08/2026');
  await setFecha(pg, 'form:j_idt115:fechaHasta_input', '31/08/2026');

  for (const o of (out.opcionesUnidad || [])) {
    if (!/^(|US\$ - US\$ - CURRENCY|BTO - BULTO - UNIT|UND - UNIDADES - UNIT)$/.test(o.v)) continue;
    const r = await setSelect(pg, 'form:j_idt115:unidad', o.v);
    await buscar(pg);
    out.corridas[o.t || '(placeholder)'] = { set: r.val || r, ...(await grid(pg)) };
  }
  return out;
};
