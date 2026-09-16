'use strict';
const { attach, goto } = require('./_drv');
(async () => {
  const { pg } = await attach();
  for (const [name, ruta, grid] of [
    ['cumpl','/pages/reporteCumplimientoCuota','form:tablaCumplimientoCuota'],
    ['plan','/pages/reportePlanCuota','form:tablaComparativoPlanCuota'],
    ['activ','/pages/reporteActivacionClientes','form:tablaComparativoPlanCuota'],
    ['rota','/pages/reporteRotacionInventario','form:TablaRotacion'],
  ]) {
    await goto(pg, ruta);
    const r = await pg.evaluate((g) => {
      const t = document.getElementById(g);
      const heads = t ? [...t.querySelectorAll('thead th')].map(x=>x.textContent.trim().replace(/\s+/g,' ')) : null;
      // todas las tablas por si el id cambio
      const all = [...document.querySelectorAll('div.ui-datatable')].map(d=>d.id);
      return { heads, tablas: all };
    }, grid);
    console.log(name, JSON.stringify(r));
  }
  process.exit(0);
})();
