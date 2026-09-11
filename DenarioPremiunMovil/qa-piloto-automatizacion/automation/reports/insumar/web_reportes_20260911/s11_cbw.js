const D = require('./_drv');
const F = 'form:j_idt115';
(async () => {
  const { pg } = await D.attach();
  const r = await pg.evaluate(() => {
    const w = PrimeFaces.widgets['widget_form_j_idt115_checkboxValor'];
    if (!w) return 'no widget';
    return { keys: Object.keys(w).slice(0,40), proto: Object.getOwnPropertyNames(Object.getPrototypeOf(w)).slice(0,60), nInputs: w.inputs?w.inputs.length:null, nItems: w.items?w.items.length:null, panelHtml: w.panel? w.panel[0].innerHTML.slice(0,600):null };
  });
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})();
