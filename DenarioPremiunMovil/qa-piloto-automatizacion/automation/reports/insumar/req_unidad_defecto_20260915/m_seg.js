module.exports = async (pg) => await pg.evaluate(() => {
  const segs = [...document.querySelectorAll('ion-segment')].map(s => ({
    value: s.value, disabled: s.disabled, cls: String(s.className).slice(0, 60),
    parent: s.parentElement ? s.parentElement.tagName.toLowerCase() : null,
    btns: [...s.querySelectorAll('ion-segment-button')].map(b => ({
      v: b.getAttribute('value'), t: (b.textContent || '').trim(),
      dis: b.disabled === true || b.hasAttribute('disabled'),
      aria: b.getAttribute('aria-disabled'),
      cls: String(b.className).slice(0, 70),
    })),
  }));
  let wrap = null;
  try {
    const c = window.ng.getComponent(document.querySelector('app-devoluciones'));
    wrap = { keys: Object.keys(c).slice(0, 40), segment: c.segment, showNewReturn: c.showNewReturn, viewOnly: c.viewOnly };
  } catch (e) { wrap = { err: String(e).slice(0, 100) }; }
  let gen = null;
  try {
    const g = window.ng.getComponent(document.querySelector('devolucion-general'));
    gen = { segment: g.segment, hasClient: g.hasClient, returnValid: g.returnValid, bloquearFactura: g.bloquearFactura, cliente: !!g.cliente };
  } catch (e) { gen = { err: String(e).slice(0, 100) }; }
  return { segs, wrap, gen };
});
