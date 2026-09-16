'use strict';
const { attach, goto, shot } = require('./_drv');
(async () => {
  const [ruta, tag] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, ruta);
  await pg.waitForTimeout(3000);
  const t = await pg.evaluate(()=>document.body.innerText.replace(/\n{2,}/g,'\n'));
  console.log(t.slice(0, 6000));
  await shot(pg, tag);
  process.exit(0);
})();
