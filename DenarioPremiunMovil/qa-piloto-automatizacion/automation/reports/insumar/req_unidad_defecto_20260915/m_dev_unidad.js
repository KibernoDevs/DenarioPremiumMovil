// m_dev_unidad.js <codigo> <opcionUnidad> — en DEVOLUCIONES conmuta de verdad el
// select "Unidad" del acordeón del producto dado y comprueba que el cambio prende.
const L = require('./m_lib');
module.exports = async (pg, args) => {
  const cod = args[0], destino = args[1];
  const log = [];
  const leer = () => pg.evaluate((cod) => {
    const acc = [...document.querySelectorAll('ion-accordion')].filter(a => a.getBoundingClientRect().height > 0);
    const mine = acc.find(x => (x.innerText || '').includes(cod));
    if (!mine) return { ok: false, accs: acc.map(a => (a.innerText || '').replace(/\s+/g, ' ').slice(0, 60)) };
    const s = [...mine.querySelectorAll('ion-select')].filter(e => e.getBoundingClientRect().height > 0)[0];
    return {
      ok: true,
      unidad: s ? ((s.shadowRoot ? (s.shadowRoot.querySelector('.select-text') || {}).textContent : '') || '').trim() : null,
      disabled: s ? (s.disabled === true || s.hasAttribute('disabled')) : null,
      opts: s ? [...s.querySelectorAll('ion-select-option')].map(o => o.textContent.trim()) : [],
      txt: (mine.innerText || '').replace(/\s+/g, ' ').slice(0, 260),
    };
  }, cod);

  log.push({ antes: await leer() });
  const box = await pg.evaluate((cod) => {
    const acc = [...document.querySelectorAll('ion-accordion')].filter(a => a.getBoundingClientRect().height > 0);
    const mine = acc.find(x => (x.innerText || '').includes(cod));
    if (!mine) return null;
    const s = [...mine.querySelectorAll('ion-select')].filter(e => e.getBoundingClientRect().height > 0)[0];
    if (!s) return null;
    s.scrollIntoView({ block: 'center' });
    const r = s.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, ocl: top ? top.tagName.toLowerCase() : null };
  }, cod);
  log.push({ box });
  if (!box) return { log, err: 'sin select' };
  await L.sleep(400);
  await pg.mouse.click(box.x, box.y, { delay: 70 });
  await L.sleep(1800);
  const op = await pg.evaluate((t) => {
    const pop = [...document.querySelectorAll('ion-popover, ion-alert, ion-action-sheet')]
      .filter(p => p.offsetParent !== null && !p.classList.contains('overlay-hidden')).pop();
    if (!pop) return { ok: false, why: 'sin popover' };
    const cands = [...pop.querySelectorAll('ion-item, button, .alert-radio-button')];
    const el = cands.find(c => (c.textContent || '').trim() === t) ||
               cands.find(c => (c.textContent || '').includes(t));
    if (!el) return { ok: false, opciones: cands.map(c => c.textContent.trim()) };
    const r = el.getBoundingClientRect();
    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, destino);
  log.push({ opcion: op });
  if (op.ok) { await pg.mouse.click(op.x, op.y, { delay: 70 }); await L.sleep(2500); }
  const a = await L.alerts(pg, ['Aceptar', 'OK']);
  if (a.length) { log.push({ alerta: a }); await L.sleep(1200); }
  return { log, despues: await leer() };
};
