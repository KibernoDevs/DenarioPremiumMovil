'use strict';
const { attach, goto, shot } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(2500);
  const info = await pg.evaluate(() => {
    const out = { url: location.pathname, labels: [], selects: [], widgets: [], radios: [] };
    // etiquetas visibles del panel de filtros
    document.querySelectorAll('label, span.ui-outputlabel, h5, legend').forEach(l => {
      const t = (l.textContent||'').trim();
      if (t && t.length < 60) out.labels.push(t);
    });
    // todos los select (JSF los deja ocultos junto al widget)
    document.querySelectorAll('select').forEach(s => {
      out.selects.push({ id: s.id, name: s.name, disabled: s.disabled,
        opts: [...s.options].map(o => o.value + ' ||| ' + o.textContent.trim()) });
    });
    out.widgets = Object.keys(window.PrimeFaces ? window.PrimeFaces.widgets : {});
    document.querySelectorAll('input[type=radio],input[type=checkbox]').forEach(i => {
      out.radios.push({ type: i.type, id: i.id, name: i.name, value: i.value, checked: i.checked });
    });
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await shot(pg, '01-plancuota-inicial');
  process.exit(0);
})();
