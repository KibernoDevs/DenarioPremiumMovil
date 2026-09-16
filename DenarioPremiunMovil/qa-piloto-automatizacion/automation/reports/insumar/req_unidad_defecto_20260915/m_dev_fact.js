// m_dev_fact.js <coInvoice> — abre #InvoiceeSelectModal (typo del código fuente)
// y selecciona la factura por click real.
const L = require('./m_lib');
module.exports = async (pg, args) => {
  const co = args[0];
  const log = [];
  const ab = await pg.evaluate(() => {
    const m = document.querySelector('#InvoiceeSelectModal') ||
              [...document.querySelectorAll('ion-modal')].find(x => /invoice/i.test(x.id || ''));
    if (!m) return { ok: false, ids: [...document.querySelectorAll('ion-modal')].map(x => x.id) };
    m.present();
    return { ok: true, id: m.id };
  });
  log.push({ ab });
  await L.sleep(2500);
  const lst = await pg.evaluate(() => {
    const m = document.querySelector('ion-modal.show-modal');
    if (!m) return { ok: false };
    return { ok: true, items: [...m.querySelectorAll('ion-item')].map(i => (i.innerText || '').replace(/\s+/g, ' ').slice(0, 90)) };
  });
  log.push({ lst });
  if (!lst.ok) return { log, err: 'modal factura no abrió' };
  const pick = await pg.evaluate((co) => {
    const m = document.querySelector('ion-modal.show-modal');
    const items = [...m.querySelectorAll('ion-item')];
    const el = items.find(i => (i.innerText || '').includes(co)) || items[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const p = el.querySelector('p') || el;
    const r = p.getBoundingClientRect();
    return { x: r.left + r.width * 0.35, y: r.top + r.height / 2, txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 90) };
  }, co);
  log.push({ pick });
  if (!pick) return { log, err: 'sin factura' };
  await L.sleep(500);
  await pg.mouse.click(pick.x, pick.y, { delay: 70 });
  await L.sleep(3000);
  const a = await L.alerts(pg, ['Aceptar', 'OK']);
  if (a.length) { log.push({ alerta: a }); await L.sleep(1500); }
  await pg.evaluate(() => { const m = document.querySelector('ion-modal.show-modal'); if (m && m.dismiss) m.dismiss(null, 'cancel'); });
  await L.sleep(2200);
  await pg.evaluate(() => { document.querySelectorAll('ion-backdrop').forEach(b => { if (!b.closest('ion-modal.show-modal') && !b.closest('ion-alert:not(.overlay-hidden)')) b.remove(); }); });

  const fin = await pg.evaluate(() => {
    const g = window.ng.getComponent(document.querySelector('devolucion-general'));
    return {
      invoiceVal: (document.querySelector('#invoiceSelect input') || {}).value,
      returnValid: g.returnValid,
      productosFactura: (g.returnLogic.productList || []).length,
      validateProductList: (g.returnLogic.validateReturnProductList || []).length,
      tabs: [...document.querySelectorAll('app-devoluciones ion-segment-button')]
        .map(b => ({ t: (b.textContent || '').trim(), dis: b.disabled === true })),
    };
  });
  return { log, fin };
};
