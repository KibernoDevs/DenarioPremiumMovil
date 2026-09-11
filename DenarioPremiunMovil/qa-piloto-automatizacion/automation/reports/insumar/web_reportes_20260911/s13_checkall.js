const D = require('./_drv');
(async () => {
  const { pg } = await D.attach();
  const r = await pg.evaluate(() => {
    const w = PrimeFaces.widgets['widget_form_j_idt115_checkboxValor'];
    try { w.renderPanel && w.renderPanel(); } catch(e) {}
    try { w.checkAll(); } catch(e) { return 'ERR ' + e.message; }
    const x = [...document.querySelectorAll('input[name="form:j_idt115:checkboxValor"]')];
    return x.map(i=>({v:i.value, c:i.checked, lbl:(document.querySelector(`label[for="${CSS.escape(i.id)}"]`)||{}).textContent}));
  });
  console.log(JSON.stringify(r));
  process.exit(0);
})();
