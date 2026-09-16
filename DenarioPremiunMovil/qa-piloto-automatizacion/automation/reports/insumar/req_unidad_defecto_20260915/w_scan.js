// Recorre TODOS los grupos de "Tipo de variables" y devuelve las filas que
// mencionan unidad / lista de precio, con su fila, selId y valor actual.
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
  return await pg.evaluate(() => {
    const s = document.getElementById('formGlobal:tipoVariable_input');
    return s ? s.options[s.selectedIndex].text : null;
  });
}

function dump(pg) {
  return pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('select[id^="formGlobal:tablaConf:"]').forEach(sel => {
      const tr = sel.closest('tr');
      const m = sel.id.match(/tablaConf:(\d+):/);
      out.push({
        row: m ? Number(m[1]) : null,
        selId: sel.id,
        valor: sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : null,
        pregunta: tr ? (tr.innerText || '').replace(/\s+/g, ' ').slice(0, 220) : null,
      });
    });
    const pag = document.querySelector('.ui-paginator');
    return { filas: out, paginator: pag ? (pag.innerText || '').replace(/\s+/g, ' ').slice(0, 150) : null };
  });
}

module.exports = async (pg) => {
  const grupos = await pg.evaluate(() => {
    const s = document.getElementById('formGlobal:tipoVariable_input');
    return [...s.options].map(o => o.text);
  });
  const res = {};
  for (const g of grupos) {
    const ok = await setGrupo(pg, g);
    const d = await dump(pg);
    res[g] = {
      confirmado: ok,
      total: d.filas.length,
      paginator: d.paginator,
      unidad: d.filas.filter(f => /unidad|Unidad|Lista de Precio|lista de precio/.test(f.pregunta || '')),
    };
  }
  return { grupos, res };
};
