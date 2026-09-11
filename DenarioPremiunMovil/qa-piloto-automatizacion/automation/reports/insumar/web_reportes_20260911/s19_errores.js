const D = require('./_drv');
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/protected/administracion/erroresAplicacion/erroresAplicacion.xhtml');
  await pg.waitForTimeout(3500);
  await D.shot(pg,'B-09-errores-aplicacion');
  const t = await D.txt(pg);
  const i = t.indexOf('Filtros');
  console.log(t.slice(i>0?i:0, (i>0?i:0)+3000));
  process.exit(0);
})();
