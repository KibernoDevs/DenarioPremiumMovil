const D = require('./_drv');
const F = 'form:j_idt115';
(async () => {
  const { pg } = await D.attach();
  const h = await pg.evaluate((f) => {
    const e = document.getElementById(f+':fechaDesde_input');
    return e ? e.parentElement.outerHTML.slice(0,1200) : 'no';
  }, F);
  console.log(h);
  process.exit(0);
})();
