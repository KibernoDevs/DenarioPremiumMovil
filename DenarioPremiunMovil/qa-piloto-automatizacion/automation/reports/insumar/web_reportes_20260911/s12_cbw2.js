const D = require('./_drv');
(async () => {
  const { pg } = await D.attach();
  const r = await pg.evaluate(() => {
    const w = PrimeFaces.widgets['widget_form_j_idt115_checkboxValor'];
    return { proto: Object.getOwnPropertyNames(Object.getPrototypeOf(w)), wv: w.widgetVar, nInputs: w.inputs.length };
  });
  console.log(JSON.stringify(r));
  await pg.evaluate(() => { const w = PrimeFaces.widgets['widget_form_j_idt115_checkboxValor']; w.show(); });
  await pg.waitForTimeout(2000);
  const r2 = await pg.evaluate(() => {
    const p = document.getElementById('form:j_idt115:checkboxValor_panel');
    return { lis: p? p.querySelectorAll('li.ui-selectcheckboxmenu-item').length : -1, txt: p? p.innerText.replace(/\s+/g,' ').slice(0,300):null };
  });
  console.log(JSON.stringify(r2));
  process.exit(0);
})();
