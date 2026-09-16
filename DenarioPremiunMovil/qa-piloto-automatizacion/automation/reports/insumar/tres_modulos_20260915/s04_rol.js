'use strict';
const { attach, BASE } = require('./_drv');
(async () => {
  const { pg } = await attach();
  for (const [tag,ruta] of [['PlanCuota','/pages/reportePlanCuota'],['CumplCuota','/pages/reporteCumplimientoCuota']]) {
    await pg.goto(BASE+ruta,{waitUntil:'domcontentloaded',timeout:60000}); await pg.waitForTimeout(3000);
    const r = await pg.evaluate(() => ({
      idRol_input: !!document.querySelector('[id$=":idRol_input"]'),
      idRolAny: [...document.querySelectorAll('[id*="idRol"]')].map(e=>e.id),
      rolWidget: (()=>{try{return Object.keys(PrimeFaces.widgets).filter(k=>/[Rr]ol/.test(k))}catch(e){return 'ERR'}})(),
      allWidgets: (()=>{try{return Object.keys(PrimeFaces.widgets)}catch(e){return []}})(),
      labelsVisibles: [...document.querySelectorAll('label, .ui-outputlabel, span.ui-selectonemenu-label')].map(e=>e.textContent.trim()).filter(t=>t&&t.length<40).slice(0,40),
    }));
    console.log('=== '+tag);
    console.log('  idRol_input presente: ' + r.idRol_input + '  | elems idRol: ' + JSON.stringify(r.idRolAny));
    console.log('  widgets con Rol: ' + JSON.stringify(r.rolWidget));
    console.log('  widgets: ' + r.allWidgets.join(', '));
    console.log('  labels: ' + r.labelsVisibles.join(' | '));
  }
  process.exit(0);
})();
