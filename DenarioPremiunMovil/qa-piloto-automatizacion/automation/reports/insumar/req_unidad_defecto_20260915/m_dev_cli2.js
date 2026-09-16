// Selección de cliente en DEVOLUCIONES por CLICK REAL en el ítem del modal:
// es lo único que dispara selectorService.ClientChanged → reset() →
// onReturnGeneralValid(true) → habilita las tabs. setClientfromSelector directo
// deja returnValid=false y las tabs disabled.
const L = require('./m_lib');
module.exports = async (pg, args) => {
  const cod = args[0] || '1976';
  const log = [];
  const ab = await pg.evaluate(() => {
    const m = document.querySelector('#clienteSelectModal');
    if (!m) return { ok: false };
    m.present(); return { ok: true };
  });
  log.push({ ab });
  await pg.waitForFunction(() => {
    const m = document.querySelector('#clienteSelectModal.show-modal');
    return !!(m && m.querySelectorAll('ion-item').length > 0);
  }, { timeout: 15000 }).catch(e => log.push({ esperaModal: 'timeout' }));
  await L.sleep(1200);

  const pick = await pg.evaluate((cod) => {
    const m = document.querySelector('#clienteSelectModal.show-modal');
    if (!m) return null;
    const items = [...m.querySelectorAll('ion-item')];
    const el = items.find(i => (i.innerText || '').includes('Código: ' + cod)) || items[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const p = el.querySelector('p') || el;
    const r = p.getBoundingClientRect();
    const x = r.left + r.width * 0.35, y = r.top + r.height * 0.5;
    const top = document.elementFromPoint(x, y);
    return { x, y, ocl: top ? top.tagName.toLowerCase() : null, txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 100) };
  }, cod);
  log.push({ pick });
  if (!pick) return { log, err: 'sin ítem' };
  await L.sleep(500);
  await pg.mouse.click(pick.x, pick.y, { delay: 70 });
  await L.sleep(2500);
  for (let i = 0; i < 3; i++) {
    const a = await L.alerts(pg, ['Aceptar', 'OK']);
    if (a.length) log.push({ alerta: a });
    await L.sleep(1200);
  }
  await pg.evaluate(() => { const m = document.querySelector('ion-modal.show-modal'); if (m && m.dismiss) m.dismiss(null, 'cancel'); });
  await L.sleep(2000);
  await pg.evaluate(() => { document.querySelectorAll('ion-backdrop').forEach(b => { if (!b.closest('ion-modal.show-modal') && !b.closest('ion-alert:not(.overlay-hidden)')) b.remove(); }); });

  const fin = await pg.evaluate(() => {
    const g = window.ng.getComponent(document.querySelector('devolucion-general'));
    return {
      hasClient: g.hasClient, nombreCliente: g.nombreCliente, returnValid: g.returnValid,
      tabs: [...document.querySelectorAll('app-devoluciones ion-segment-button')]
        .map(b => ({ t: (b.textContent || '').trim(), dis: b.disabled === true })),
      modals: document.querySelectorAll('ion-modal.show-modal').length,
    };
  });
  return { log, fin };
};
