const D = require('./_drv');
const F = 'form:j_idt115';
(async () => {
  const { pg } = await D.attach();
  const w = await pg.evaluate(() => {
    const out = [];
    for (const k in (window.PrimeFaces?.widgets||{})) {
      const w = PrimeFaces.widgets[k];
      out.push(k + ' :: ' + (w.id||'') + ' :: ' + (w.constructor?.name||''));
    }
    return out;
  });
  console.log(w.join('\n'));
  process.exit(0);
})();
