// Vuelca TODAS las filas de la tabla de variables del grupo indicado (incluidas
// las que no llevan <select>), para no perder una variable por mirar solo selects.
async function setGrupo(pg, grupo) {
  const cur = await pg.evaluate(() => {
    const s = document.getElementById('formGlobal:tipoVariable_input');
    return s ? s.options[s.selectedIndex].text : null;
  });
  if (cur === grupo) return cur;
  const box = await pg.evaluate(() => {
    const d = document.getElementById('formGlobal:tipoVariable');
    const r = d.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await pg.mouse.click(box.x, box.y);
  await pg.waitForTimeout(900);
  const it = await pg.evaluate((g) => {
    const p = document.getElementById('formGlobal:tipoVariable_panel');
    const li = [...p.querySelectorAll('li')].find(l => (l.textContent || '').trim() === g);
    if (!li) return null;
    const r = li.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, grupo);
  if (!it) throw new Error('grupo no encontrado: ' + grupo);
  await pg.mouse.click(it.x, it.y);
  await pg.waitForTimeout(7000);
  return grupo;
}
module.exports = async (pg, args) => {
  const g = args[0] || 'Pedidos';
  await setGrupo(pg, g);
  return await pg.evaluate(() => {
    const tbl = document.querySelector('[id^="formGlobal:tablaConf"]');
    const trs = [...document.querySelectorAll('tr[data-ri]')];
    const rows = trs.map(tr => {
      const sel = tr.querySelector('select');
      const inp = tr.querySelector('input:not([type=hidden])');
      return {
        ri: tr.getAttribute('data-ri'),
        widget: sel ? 'select' : (inp ? 'input:' + inp.type : 'ninguno'),
        wid: sel ? sel.id : (inp ? inp.id : null),
        valor: sel ? (sel.options[sel.selectedIndex] || {}).text : (inp ? inp.value : null),
        txt: (tr.innerText || '').replace(/\s+/g, ' ').slice(0, 230),
      };
    });
    return {
      nTr: trs.length,
      hitUnidadPorLista: rows.filter(r => /Lista de Precio|lista de precio|Unidades segun|Unidades según/i.test(r.txt)),
      rows,
    };
  });
};
