'use strict';
const { attach, goto, opts } = require('./_drv');
(async () => {
  const [ruta, B] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, ruta);
  for (const c of ['clasificacion','cumplimiento','unidad','codRdv']) {
    const o = await opts(pg, B + ':' + c);
    console.log(c + ' => ' + (o ? o.join(' | ') : 'NO-EXISTE'));
  }
  process.exit(0);
})();
