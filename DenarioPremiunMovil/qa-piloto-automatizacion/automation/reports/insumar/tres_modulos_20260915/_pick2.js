'use strict';
// pickJS — elegir en un selectOneMenu de PrimeFaces SIN clic:
// fija el <select> oculto (que es lo que viaja en el POST) y avisa al widget.
// Evita el "element is not visible" cuando el panel queda fuera de pantalla
// o cuando el valor ya estaba seleccionado y el panel no se abre.
module.exports = async function pickJS(pg, base, label) {
  const r = await pg.evaluate(([b, lab]) => {
    const sel = document.getElementById(b + '_input');
    if (!sel) return 'NO-SELECT';
    const o = [...sel.options].find(x => x.text.trim() === lab)
           || [...sel.options].find(x => x.text.trim().includes(lab));
    if (!o) return 'NO-OPTION:' + [...sel.options].map(x => x.text.trim()).join('/');
    const wname = 'widget_' + b.replace(/[:.]/g, '_');
    const w = (window.PrimeFaces && PrimeFaces.widgets[wname]) || null;
    if (w && typeof w.selectValue === 'function') { try { w.selectValue(o.value); return 'widget=' + o.value; } catch (e) {} }
    sel.value = o.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return 'change=' + o.value;
  }, [base, label]);
  await pg.waitForTimeout(1800);
  return r;
};
