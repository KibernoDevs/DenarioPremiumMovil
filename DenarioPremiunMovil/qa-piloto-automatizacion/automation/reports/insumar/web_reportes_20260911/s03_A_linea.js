const D = require('./_drv');
const F = 'form:j_idt115';
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(1500);

  // limpiar filtros de sesión primero
  const lim = await pg.$(`[id="${F}:botonLimpiar"]`);
  if (lim) { await lim.click(); await pg.waitForTimeout(2500); }

  for (const c of ['clasificacion','cumplimiento','unidad']) {
    await pg.click(`[id="${F}:${c}_label"]`); await pg.waitForTimeout(600);
    console.log('OPCIONES ' + c + ' => ' + JSON.stringify(await D.opts(pg, `${F}:${c}`)));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  }
  // checkbox valor
  const cbTxt = await pg.evaluate((f) => {
    const d = document.getElementById(f + ':checkboxValor');
    return d ? d.innerText.trim().replace(/\s+/g,' ') : null;
  }, F);
  console.log('CHECKBOXVALOR label => ' + cbTxt);
  process.exit(0);
})();
