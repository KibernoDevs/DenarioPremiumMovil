// m_dev_prod.js <codigo> — Tab PRODUCTOS → AGREGAR PRODUCTO → buscar por código →
// agregar → expandir el acordeón → leer el selector de Unidad.
const L = require('./m_lib');

module.exports = async (pg, args) => {
  const cod = args[0];
  const log = [];

  // Tab PRODUCTOS
  await L.clickRect(pg, () => {
    const b = [...document.querySelectorAll('app-devoluciones ion-segment-button')]
      .find(e => (e.textContent || '').trim().toLowerCase() === 'productos');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await L.sleep(2200);

  // AGREGAR PRODUCTO
  const ag = await L.clickRect(pg, () => {
    const b = [...document.querySelectorAll('ion-button, button')]
      .filter(e => e.getBoundingClientRect().height > 0)
      .find(e => /AGREGAR\s+PRODUCTO/i.test((e.textContent || '').trim()));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  log.push({ agregar: ag });
  await L.sleep(2400);

  // lupa
  const lupa = await L.clickRect(pg, () => {
    const i = [...document.querySelectorAll('ion-icon[name="search-circle-sharp"], ion-icon[name*="search"]')]
      .filter(e => e.getBoundingClientRect().width > 0)[0];
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  log.push({ lupa });
  await L.sleep(1500);

  const inp = await pg.$('input.search-input.inputsSearch, input.inputsSearch, input[placeholder*="squeda"]');
  if (!inp) return { log, err: 'sin buscador', txt: await pg.evaluate(() => (document.querySelector('app-devoluciones')||{}).innerText.replace(/\s+/g,' ').slice(0,500)) };
  // vaciar con Backspace (el buscador persiste dentro del mismo form)
  await inp.click();
  for (let i = 0; i < 40; i++) {
    const len = await pg.evaluate(el => (el.value || '').length, inp);
    if (!len) break;
    await pg.keyboard.press('Backspace');
  }
  await inp.type(cod, { delay: 60 });
  await pg.keyboard.press('Enter');
  await pg.evaluate(el => el.blur(), inp);
  await L.sleep(2600);

  const cands = await pg.evaluate(() => [...document.querySelectorAll('ion-item, ion-accordion')]
    .filter(e => e.getBoundingClientRect().height > 0 && /C[oó]digo:/.test(e.innerText || ''))
    .map((e, i) => ({ i, tag: e.tagName.toLowerCase(), txt: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 150) })));
  log.push({ cands });

  const pick = await pg.evaluate((cod) => {
    const els = [...document.querySelectorAll('ion-item, ion-accordion')]
      .filter(e => e.getBoundingClientRect().height > 0 && /C[oó]digo:/.test(e.innerText || ''));
    const rx = /C[oó]digo:\s*([A-Za-z0-9.\-]+?)\s*(?:Precio|Existencia|Inventario|Stock|$)/;
    const el = els.find(e => { const m = (e.innerText || '').replace(/\s+/g, ' ').match(rx); return m && m[1] === cod; });
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(28, r.height / 2), txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 150) };
  }, cod);
  log.push({ pick });
  if (!pick) return { log, err: 'código no hallado' };
  await L.sleep(600);
  await pg.mouse.click(pick.x, pick.y, { delay: 70 });
  await L.sleep(2800);
  const a = await L.alerts(pg, ['OK', 'Aceptar']);
  if (a.length) { log.push({ alerta: a }); await L.sleep(1200); }

  // expandir el acordeón de la línea recién agregada
  const exp = await pg.evaluate((cod) => {
    const acc = [...document.querySelectorAll('ion-accordion')].filter(a => a.getBoundingClientRect().height > 0);
    const a = acc.find(x => (x.innerText || '').includes(cod)) || acc[acc.length - 1];
    if (!a) return null;
    const h = a.querySelector('ion-item') || a;
    h.scrollIntoView({ block: 'center' });
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(28, r.height / 2), txt: (a.innerText || '').replace(/\s+/g, ' ').slice(0, 160) };
  }, cod);
  log.push({ exp });
  if (exp) { await L.sleep(500); await pg.mouse.click(exp.x, exp.y, { delay: 70 }); await L.sleep(2600); }

  const medida = await pg.evaluate((cod) => {
    const selects = [...document.querySelectorAll('ion-select')]
      .filter(s => s.getBoundingClientRect().height > 0)
      .map(s => ({
        ctx: ((s.closest('ion-item') || s.parentElement || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 50),
        disabled: s.disabled === true || s.hasAttribute('disabled') || s.getAttribute('aria-disabled') === 'true',
        seleccionado: (s.shadowRoot ? (s.shadowRoot.querySelector('.select-text') || {}).textContent : null) || (s.innerText || '').trim().slice(0, 40),
        opciones: [...s.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim()),
      }));
    let rl = null;
    try {
      const g = window.ng.getComponent(document.querySelector('devolucion-general'));
      rl = { bloquearFactura: g.returnLogic && g.returnLogic.bloquearFactura };
    } catch (_) {}
    let pl = null;
    try {
      const c = window.ng.getComponent(document.querySelector('devolucion-product-list'));
      pl = { keys: Object.keys(c).slice(0, 40),
             userCanChangeUnits: c.userCanChangeUnits, unitByPriceList: c.unitByPriceList,
             disableUnitSelector: c.disableUnitSelector };
    } catch (e) { pl = { err: String(e).slice(0, 90) }; }
    const acc = [...document.querySelectorAll('ion-accordion')].filter(a => a.getBoundingClientRect().height > 0);
    return {
      selects, returnLogic: rl, prodList: pl,
      accTxt: acc.map(a => (a.innerText || '').replace(/\s+/g, ' ').slice(0, 300)),
    };
  }, cod);

  return { log, medida };
};
