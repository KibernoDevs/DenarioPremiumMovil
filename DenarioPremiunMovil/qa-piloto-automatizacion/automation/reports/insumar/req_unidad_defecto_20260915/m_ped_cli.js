const L = require('./m_lib');
module.exports = async (pg, args) => {
  const log = [];
  // 1. Abrir el modal de clientes por su API (el clic no lo abre)
  const abrir = await pg.evaluate(() => {
    const m = document.querySelector('#clienteSelectModal') ||
              [...document.querySelectorAll('ion-modal')].find(x => /cliente/i.test(x.id || ''));
    if (!m) return { ok: false, ids: [...document.querySelectorAll('ion-modal')].map(x => x.id) };
    m.present();
    return { ok: true, id: m.id };
  });
  log.push({ abrir });
  await L.sleep(2200);

  const lista = await pg.evaluate(() => {
    const m = document.querySelector('ion-modal.show-modal');
    if (!m) return { ok: false };
    const items = [...m.querySelectorAll('ion-item')];
    return {
      ok: true,
      n: items.length,
      primeros: items.slice(0, 12).map(i => (i.innerText || '').replace(/\s+/g, ' ').slice(0, 120)),
      searchbar: m.querySelectorAll('ion-searchbar').length,
    };
  });
  log.push({ lista });
  if (!lista.ok) return { log, err: 'modal no abrió' };

  // 2. Elegir: el que pide el arg (substring) o, por defecto, el 1.º sin saldo
  const target = args[0] || null;
  const pick = await pg.evaluate((t) => {
    const m = document.querySelector('ion-modal.show-modal');
    const items = [...m.querySelectorAll('ion-item')];
    const txt = i => (i.innerText || '').replace(/\s+/g, ' ');
    let el = null;
    if (t) el = items.find(i => txt(i).toUpperCase().includes(t.toUpperCase()));
    if (!el) el = items.find(i => /Saldo[^:]*:\s*0,00/.test(txt(i)));
    if (!el) el = items[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const p = el.querySelector('p') || el;
    const r = p.getBoundingClientRect();
    return { txt: txt(el).slice(0, 140), x: r.left + r.width * 0.35, y: r.top + r.height / 2 };
  }, target);
  log.push({ pick });
  if (!pick) return { log, err: 'sin ítem' };
  await L.sleep(500);
  await pg.mouse.click(pick.x, pick.y, { delay: 70 });
  await L.sleep(2000);

  // 3. Alerta de deuda vencida u otras (hasta 3 rondas)
  for (let i = 0; i < 3; i++) {
    const a = await L.alerts(pg, ['Aceptar', 'OK', 'SI', 'Sí']);
    if (a.length) log.push({ alerta: a });
    await L.sleep(1500);
  }
  // 4. Modal residual
  await pg.evaluate(() => { const m = document.querySelector('ion-modal.show-modal'); if (m && m.dismiss) m.dismiss(null, 'cancel'); });
  await L.sleep(2500);

  const fin = await pg.evaluate(() => {
    const c = window.ng.getComponent(document.querySelector('app-pedido'));
    return {
      cliente: (document.querySelector('#clienteSelect input') || {}).value,
      hasClient: c.hasClient, lockSegments: c.lockSegments,
      modals: document.querySelectorAll('ion-modal.show-modal').length,
      tabs: [...document.querySelectorAll('app-pedido ion-segment-button')].map(b => ({
        t: (b.textContent || '').trim(), dis: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
      })),
    };
  });
  return { log, fin };
};
