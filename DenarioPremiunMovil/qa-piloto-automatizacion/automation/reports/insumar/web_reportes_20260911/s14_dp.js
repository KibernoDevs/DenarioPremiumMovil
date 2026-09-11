const D = require('./_drv');
(async () => {
  const { pg } = await D.attach();
  const r = await pg.evaluate(() => {
    const w = PrimeFaces.widgets['widget_form_j_idt115_fechaDesde'];
    if (!w) return 'no';
    return { proto: Object.getOwnPropertyNames(Object.getPrototypeOf(w)).filter(x=>/date|value|input|Date|Value/i.test(x)), keys: Object.keys(w).slice(0,25) };
  });
  console.log(JSON.stringify(r,null,1));
  process.exit(0);
})();
