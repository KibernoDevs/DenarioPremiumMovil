// m_ped_lista.js <textoOpcionLista> — con el panel del producto expandido,
// conmuta el select "Lista de Precio" y vuelve a leer el select "Unidad".
// Responde la pregunta que importa: con userCanChangeUnits=NO, ¿el vendedor
// puede AUN ASI cambiar la unidad por la vía de la lista de precios?
const L = require('./m_lib');
module.exports = async (pg, args) => {
  const opt = args[0];
  const log = [];
  const leer = () => pg.evaluate(() => ({
    selects: [...document.querySelectorAll('ion-select')].filter(s => s.getBoundingClientRect().height > 0)
      .map(s => ({
        disabled: s.disabled === true || s.hasAttribute('disabled') || s.getAttribute('aria-disabled') === 'true',
        sel: ((s.shadowRoot ? (s.shadowRoot.querySelector('.select-text') || {}).textContent : null) || '').trim(),
        opts: [...s.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim()),
      })),
    panel: (() => { const a = [...document.querySelectorAll('ion-accordion')].filter(x => x.getBoundingClientRect().height > 0)[0];
                    return a ? (a.innerText || '').replace(/\s+/g, ' ').slice(0, 300) : null; })(),
    vgs: (() => { const os = window.ng.getComponent(document.querySelector('app-pedido')).orderServ;
                  return { unitByPriceList: os.unitByPriceList, userCanChangeUnits: os.userCanChangeUnits, disableUnitSelector: os.disableUnitSelector }; })(),
  }));
  log.push({ antes: await leer() });

  const box = await pg.evaluate(() => {
    const s = [...document.querySelectorAll('ion-select')].filter(e => e.getBoundingClientRect().height > 0)[0];
    if (!s) return null;
    s.scrollIntoView({ block: 'center' });
    const r = s.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!box) return { log, err: 'sin select de lista' };
  await L.sleep(400);
  const box2 = await pg.evaluate(() => {
    const s = [...document.querySelectorAll('ion-select')].filter(e => e.getBoundingClientRect().height > 0)[0];
    const r = s.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await pg.mouse.click(box2.x, box2.y, { delay: 70 });
  await L.sleep(1800);
  const op = await pg.evaluate((t) => {
    const pop = [...document.querySelectorAll('ion-popover, ion-alert, ion-action-sheet')]
      .filter(p => p.offsetParent !== null && !p.classList.contains('overlay-hidden')).pop();
    if (!pop) return { ok: false, why: 'sin popover' };
    const cands = [...pop.querySelectorAll('ion-item, button, .alert-radio-button')];
    const el = cands.find(c => (c.textContent || '').replace(/\s+/g, ' ').includes(t));
    if (!el) return { ok: false, opciones: cands.map(c => (c.textContent || '').trim()) };
    const r = el.getBoundingClientRect();
    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2, txt: (el.textContent || '').trim() };
  }, opt);
  log.push({ opcion: op });
  if (op.ok) { await pg.mouse.click(op.x, op.y, { delay: 70 }); await L.sleep(2500); }
  const a = await L.alerts(pg, ['Aceptar', 'OK']);
  if (a.length) { log.push({ alerta: a }); await L.sleep(1500); }
  return { log, despues: await leer() };
};
