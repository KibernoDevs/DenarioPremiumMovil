const L = require('./m_lib');
module.exports = async (pg) => {
  const log = [];
  if (!(await L.estado(pg)).home) await L.volverAHome(pg);
  log.push({ abrir: await L.abrirModulo(pg, 'Devoluciones'), e1: await L.estado(pg) });
  // botón DEVOLUCIÓN (secuencia acumulada según module-selectors)
  const r = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('ion-button')]
      .filter(e => e.getBoundingClientRect().height > 0)
      .find(e => /DEVOLUCI/i.test((e.textContent || '').trim()));
    if (!b) return null;
    const x = b.getBoundingClientRect();
    return { x: x.left + x.width / 2, y: x.top + x.height / 2, txt: b.textContent.trim() };
  });
  log.push({ btn: r });
  if (r) {
    await pg.mouse.click(r.x, r.y, { delay: 70 });
    await L.sleep(1200);
    await pg.keyboard.press('Enter').catch(() => {});
    await L.sleep(2500);
  }
  const st = await L.estado(pg);
  const snap = await pg.evaluate(() => {
    const el = document.querySelector('devolucion-general');
    let g = null;
    try {
      const c = el ? window.ng.getComponent(el) : null;
      if (c) g = { keys: Object.keys(c).slice(0, 50), hasClient: c.hasClient, cliente: !!c.cliente };
    } catch (e) { g = { err: String(e).slice(0, 100) }; }
    return {
      general: g,
      clienteVal: (document.querySelector('#clienteSelect input') || {}).value,
      selects: [...document.querySelectorAll('ion-select')].filter(s => s.getBoundingClientRect().height > 0)
        .map(s => ({ sel: (s.shadowRoot ? (s.shadowRoot.querySelector('.select-text') || {}).textContent : null), n: s.querySelectorAll('ion-select-option').length })),
      txt: (document.querySelector('app-devoluciones') || {}).innerText.replace(/\s+/g, ' ').slice(0, 400),
    };
  });
  return { log, st, snap };
};
