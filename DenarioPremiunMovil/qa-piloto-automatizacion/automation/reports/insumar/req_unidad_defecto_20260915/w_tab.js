// Cambia el selectOneMenu "Tipo de variables" al grupo pedido por argv y vuelca las filas.
const ESC = (id) => '#' + id.replace(/:/g, '\\:');
module.exports = async (pg, args) => {
  const grupo = args[0] || 'Pedidos';
  const cur = await pg.evaluate(() => {
    const s = document.getElementById('formGlobal:tipoVariable_input');
    return s ? s.options[s.selectedIndex].text : null;
  });
  if (cur !== grupo) {
    const box = await pg.evaluate(() => {
      const d = document.getElementById('formGlobal:tipoVariable');
      const r = d.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    });
    await pg.mouse.click(box.x, box.y);
    await pg.waitForTimeout(900);
    const ok = await pg.evaluate((g) => {
      const p = document.getElementById('formGlobal:tipoVariable_panel');
      if (!p) return { ok: false, why: 'sin panel' };
      const items = [...p.querySelectorAll('li')];
      const it = items.find(li => (li.textContent||'').trim() === g);
      if (!it) return { ok: false, items: items.map(i=>i.textContent.trim()) };
      const r = it.getBoundingClientRect();
      return { ok: true, x: r.left + r.width/2, y: r.top + r.height/2 };
    }, grupo);
    if (!ok.ok) return { error: 'no item', ...ok };
    await pg.mouse.click(ok.x, ok.y);
    await pg.waitForTimeout(7000);
  }
  return await pg.evaluate(() => {
    const now = document.getElementById('formGlobal:tipoVariable_input');
    const out = [];
    document.querySelectorAll('select[id^="formGlobal:tablaConf:"]').forEach(sel => {
      const tr = sel.closest('tr');
      const m = sel.id.match(/tablaConf:(\d+):/);
      out.push({
        row: m ? Number(m[1]) : null,
        selId: sel.id,
        valor: sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : null,
        pregunta: tr ? (tr.innerText||'').replace(/\s+/g,' ').slice(0, 200) : null,
      });
    });
    return { grupo: now ? now.options[now.selectedIndex].text : null, filas: out };
  });
};
