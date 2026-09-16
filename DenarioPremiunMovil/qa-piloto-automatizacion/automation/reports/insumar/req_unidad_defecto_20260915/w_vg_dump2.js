module.exports = async (pg) => {
  return await pg.evaluate(() => {
    const out = {};
    // ¿cómo se materializa "Tipo de variables: General/Pedidos/Cobros"?
    const cand = [...document.querySelectorAll('select, .ui-selectonemenu, .ui-selectonebutton, .ui-selectbooleanbutton, [role="radiogroup"], .ui-selectoneradio')]
      .slice(0,20).map(e => ({ tag: e.tagName, id: e.id, cls: String(e.className).slice(0,90), txt: (e.innerText||'').replace(/\s+/g,' ').slice(0,90) }));
    out.cand = cand;
    // formulario: todos los inputs con name
    out.forms = [...document.querySelectorAll('form')].map(f => ({ id: f.id, action: f.getAttribute('action') }));
    // botones
    out.btns = [...document.querySelectorAll('button, .ui-button')].slice(0,25).map(b => ({ id: b.id, txt:(b.innerText||'').trim().slice(0,40) }));
    return out;
  });
};
