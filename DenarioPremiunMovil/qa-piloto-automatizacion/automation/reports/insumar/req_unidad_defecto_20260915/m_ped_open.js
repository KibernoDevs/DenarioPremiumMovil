const L = require('./m_lib');
module.exports = async (pg) => {
  const log = [];
  log.push({ e0: await L.estado(pg) });
  if (!(await L.estado(pg)).home) await L.volverAHome(pg);
  log.push({ abrir: await L.abrirModulo(pg, 'Pedidos'), e1: await L.estado(pg) });
  log.push({ boton: await L.botonModulo(pg, 'PEDIDO'), e2: await L.estado(pg) });
  await L.sleep(2500);
  const snap = await pg.evaluate(() => {
    const ng = window.ng;
    const el = document.querySelector('app-pedido');
    let comp = null, orderServ = null;
    try {
      const c = ng && el ? ng.getComponent(el) : null;
      if (c) {
        comp = { keys: Object.keys(c).slice(0, 60), lockSegments: c.lockSegments, hasClient: c.hasClient };
        const os = c.orderServ;
        if (os) orderServ = {
          unitByPriceList: os.unitByPriceList,
          userCanChangeUnits: os.userCanChangeUnits,
          disableUnitSelector: os.disableUnitSelector,
          userCanChangePriceList: os.userCanChangePriceList,
          userCanChangePriceListProduct: os.userCanChangePriceListProduct,
          hideStock0: os.hideStock0,
          carrito: (os.carrito || []).length,
        };
      }
    } catch (e) { comp = { err: String(e).slice(0, 120) }; }
    return {
      modals: document.querySelectorAll('ion-modal.show-modal').length,
      modalItems: document.querySelectorAll('ion-modal.show-modal ion-item').length,
      clienteSelect: (document.querySelector('#clienteSelect input') || {}).value,
      comp, orderServ,
      txt: (document.querySelector('app-pedido') ? document.querySelector('app-pedido').innerText : '').replace(/\s+/g, ' ').slice(0, 400),
    };
  });
  return { log, snap };
};
