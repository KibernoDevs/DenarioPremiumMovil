const D = require('./_drv');
const F = 'form:j_idt115';
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(1200);
  await D.pick(pg, `${F}:clasificacion`, 'Linea');
  const html = await pg.evaluate((f) => {
    const d = document.getElementById(f + ':checkboxValor');
    const p = document.getElementById(f + ':checkboxValor_panel');
    return { widget: d ? d.outerHTML.slice(0,1500) : null, panel: p ? p.outerHTML.slice(0,2500) : null };
  }, F);
  console.log('WIDGET:\n' + html.widget);
  console.log('\nPANEL:\n' + html.panel);
  process.exit(0);
})();
