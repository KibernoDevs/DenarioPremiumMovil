const L = require('./m_lib');
module.exports = async (pg, args) => {
  const cod = args[0] || '1976';
  const log = [];
  // abrir el modal por API para que cargue la cartera
  const ab = await pg.evaluate(() => {
    const m = document.querySelector('#clienteSelectModal');
    if (!m) return { ok: false };
    m.present(); return { ok: true };
  });
  log.push({ ab });
  await L.sleep(2200);
  const lst = await pg.evaluate(() => {
    const g = window.ng.getComponent(document.querySelector('devolucion-general'));
    const cl = (g.selectorCliente && g.selectorCliente.clientes) || [];
    return { n: cl.length, primeros: cl.slice(0, 5).map(c => c.coClient + ' ' + (c.naClient || '').slice(0, 30)) };
  });
  log.push({ lst });
  // seleccionar por el handler real
  const sel = await pg.evaluate((cod) => {
    const g = window.ng.getComponent(document.querySelector('devolucion-general'));
    const cl = (g.selectorCliente && g.selectorCliente.clientes) || [];
    const c = cl.find(x => String(x.coClient) === String(cod)) || cl[0];
    if (!c) return null;
    g.setClientfromSelector(c);
    window.ng.applyChanges(g);
    return { coClient: c.coClient, naClient: c.naClient };
  }, cod);
  log.push({ sel });
  await L.sleep(2200);
  const a = await L.alerts(pg, ['Aceptar', 'OK']);
  if (a.length) { log.push({ alerta: a }); await L.sleep(1500); }
  await pg.evaluate(() => { const m = document.querySelector('ion-modal.show-modal'); if (m && m.dismiss) m.dismiss(null, 'cancel'); });
  await L.sleep(2000);
  // limpiar backdrops huérfanos
  await pg.evaluate(() => { document.querySelectorAll('ion-backdrop').forEach(b => { if (!b.closest('ion-modal.show-modal') && !b.closest('ion-alert:not(.overlay-hidden)')) b.remove(); }); });

  const fin = await pg.evaluate(() => {
    const g = window.ng.getComponent(document.querySelector('devolucion-general'));
    return {
      hasClient: g.hasClient, nombreCliente: g.nombreCliente,
      tabs: [...document.querySelectorAll('app-devoluciones ion-segment-button')].map(b => ({
        t: (b.textContent || '').trim(), dis: b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true',
      })),
      modals: document.querySelectorAll('ion-modal.show-modal').length,
    };
  });
  return { log, fin };
};
