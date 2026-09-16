'use strict';
const { attach, goto } = require('./_drv');
(async () => {
  const [ruta] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, ruta); await pg.waitForTimeout(4000);
  const r = await pg.evaluate(() => {
    const o = [];
    document.querySelectorAll('select').forEach(s => {
      if (/reflowDD|config-form/.test(s.id)) return;
      o.push({ id: s.id, val: s.value, sel: (s.selectedOptions[0]||{}).text, n: s.options.length,
               opts: [...s.options].map(x => x.value + '=' + x.text.trim()).slice(0, 12) });
    });
    return o;
  });
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})();
