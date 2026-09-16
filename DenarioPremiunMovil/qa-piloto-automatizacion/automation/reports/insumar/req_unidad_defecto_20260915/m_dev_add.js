// m_dev_add.js <codigo> — AGREGAR PRODUCTO → localizar el producto (lista de la
// factura) → agregar → expandir su acordeón → leer el selector de Unidad.
const L = require('./m_lib');
module.exports = async (pg, args) => {
  const cod = args[0];
  const log = [];
  const ag = await L.clickRect(pg, () => {
    const b = [...document.querySelectorAll('ion-button, button')]
      .filter(e => e.getBoundingClientRect().height > 0)
      .find(e => /AGREGAR\s+PRODUCTO/i.test((e.textContent || '').trim()));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  log.push({ agregar: ag });
  await L.sleep(3000);

  const vista = await pg.evaluate(() => ({
    txt: ((document.querySelector('app-devoluciones') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 500),
    inputs: [...document.querySelectorAll('input')].filter(i => i.getBoundingClientRect().height > 0)
      .map(i => ({ cls: String(i.className).slice(0, 50), ph: i.placeholder })),
    items: [...document.querySelectorAll('ion-item, ion-accordion')]
      .filter(e => e.getBoundingClientRect().height > 0 && /C[oó]digo:/.test(e.innerText || ''))
      .map(e => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 110)).slice(0, 30),
  }));
  log.push({ vista });

  const pick = await pg.evaluate((cod) => {
    const els = [...document.querySelectorAll('ion-item, ion-accordion')]
      .filter(e => e.getBoundingClientRect().height > 0 && /C[oó]digo:/.test(e.innerText || ''));
    const rx = /C[oó]digo:\s*([A-Za-z0-9.\-]+?)\s*(?:Precio|Existencia|Inventario|Stock|Cantidad|$)/;
    const el = els.find(e => { const m = (e.innerText || '').replace(/\s+/g, ' ').match(rx); return m && m[1] === cod; });
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(26, r.height / 2), txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 120) };
  }, cod);
  log.push({ pick });
  if (!pick) return { log, err: 'código no hallado en la lista de la factura' };
  await L.sleep(600);
  await pg.mouse.click(pick.x, pick.y, { delay: 70 });
  await L.sleep(3000);
  const a = await L.alerts(pg, ['OK', 'Aceptar']);
  if (a.length) { log.push({ alerta: a }); await L.sleep(1200); }

  // expandir el acordeón de la línea
  const exp = await pg.evaluate((cod) => {
    const acc = [...document.querySelectorAll('ion-accordion')].filter(a => a.getBoundingClientRect().height > 0);
    const a = acc.find(x => (x.innerText || '').includes(cod)) || acc[acc.length - 1];
    if (!a) return null;
    const h = a.querySelector('ion-item') || a;
    h.scrollIntoView({ block: 'center' });
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(26, r.height / 2), n: acc.length, txt: (a.innerText || '').replace(/\s+/g, ' ').slice(0, 120) };
  }, cod);
  log.push({ exp });
  if (exp) { await L.sleep(500); await pg.mouse.click(exp.x, exp.y, { delay: 70 }); await L.sleep(2800); }

  const medida = await pg.evaluate((cod) => {
    const acc = [...document.querySelectorAll('ion-accordion')].filter(a => a.getBoundingClientRect().height > 0);
    const mine = acc.find(x => (x.innerText || '').includes(cod));
    const scope = mine || document;
    const selects = [...scope.querySelectorAll('ion-select')]
      .filter(s => s.getBoundingClientRect().height > 0)
      .map(s => ({
        ctx: ((s.closest('ion-item') || s.parentElement || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 45),
        disabled: s.disabled === true || s.hasAttribute('disabled') || s.getAttribute('aria-disabled') === 'true',
        seleccionado: (s.shadowRoot ? (s.shadowRoot.querySelector('.select-text') || {}).textContent : null) || (s.innerText || '').trim().slice(0, 40),
        opciones: [...s.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim()),
      }));
    let rl = null;
    try {
      const g = window.ng.getComponent(document.querySelector('devolucion-general'));
      rl = { unitsByProduct: g.returnLogic.unitsByProduct, validateReturn: g.returnLogic.validateReturn };
    } catch (e) { rl = { err: String(e).slice(0, 80) }; }
    let pl = null;
    try {
      const c = window.ng.getComponent(document.querySelector('devolucion-product-list'));
      pl = { userCanChangeUnits: c.userCanChangeUnits, unitByPriceList: c.unitByPriceList,
             disableUnitSelector: c.disableUnitSelector, keys: Object.keys(c).slice(0, 45) };
    } catch (e) { pl = { err: String(e).slice(0, 80) }; }
    return { selects, rl, prodList: pl, accTxt: (mine ? mine.innerText : '').replace(/\s+/g, ' ').slice(0, 400) };
  }, cod);
  return { log, medida };
};
