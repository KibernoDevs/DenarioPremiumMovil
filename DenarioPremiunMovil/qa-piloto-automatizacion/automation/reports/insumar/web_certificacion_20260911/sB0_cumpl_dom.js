const L = require('./_lib'); const D = L.D;
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reporteCumplimientoCuota'); await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => ({
    url: location.pathname,
    ids: [...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>/^form:/.test(i) && !/_panel$/.test(i)),
    wid: Object.keys(window.PrimeFaces.widgets).filter(w=>/^widget_form/.test(w))
  }));
  console.log(JSON.stringify(r.ids));
  console.log(JSON.stringify(r.wid));
  // opciones del combo vendedor
  for (const b of ['form:j_idt115:codRdv','form:j_idt115:clasificacion','form:j_idt115:cumplimiento','form:j_idt115:unidad']) {
    const o = await D.opts(pg, b);
    console.log(b + ' => ' + JSON.stringify(o));
  }
  process.exit(0);
})();
