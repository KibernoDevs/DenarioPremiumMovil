// w_set.js <fragmentoDePregunta> <SI|NO> [--dry]
// Cambia UNA variable del grupo Pedidos localizándola por el TEXTO de su pregunta
// (nunca por índice de fila) y guarda. Devuelve antes/después.
const L = { sleep: ms => new Promise(r => setTimeout(r, ms)) };

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
  await L.sleep(900);
  const it = await pg.evaluate((g) => {
    const p = document.getElementById('formGlobal:tipoVariable_panel');
    const li = [...p.querySelectorAll('li')].find(l => (l.textContent || '').trim() === g);
    if (!li) return null;
    const r = li.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, grupo);
  if (!it) throw new Error('grupo no encontrado');
  await pg.mouse.click(it.x, it.y);
  await L.sleep(7000);
  return grupo;
}

const leer = (pg, frag) => pg.evaluate((frag) => {
  const sels = [...document.querySelectorAll('select[id^="formGlobal:tablaConf:"]')];
  const hit = sels.filter(s => {
    const tr = s.closest('tr');
    return tr && (tr.innerText || '').replace(/\s+/g, ' ').includes(frag);
  });
  return hit.map(s => ({
    selId: s.id,
    valor: s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : null,
    pregunta: (s.closest('tr').innerText || '').replace(/\s+/g, ' ').slice(0, 140),
  }));
}, frag);

module.exports = async (pg, args) => {
  const frag = args[0], destino = args[1], dry = args.includes('--dry');
  await setGrupo(pg, 'Pedidos');
  const antes = await leer(pg, frag);
  if (antes.length !== 1) return { error: 'la pregunta no identifica UNA sola fila', antes };
  if (dry) return { antes, dry: true };
  if (antes[0].valor === destino) return { antes, nota: 'ya estaba en ' + destino, sinCambio: true };

  const widgetId = antes[0].selId.replace(/_input$/, '');
  const box = await pg.evaluate((id) => {
    const d = document.getElementById(id);
    d.scrollIntoView({ block: 'center' });
    const r = d.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, widgetId);
  await pg.mouse.click(box.x, box.y);
  await L.sleep(900);
  const op = await pg.evaluate(([id, d]) => {
    const p = document.getElementById(id + '_panel');
    if (!p) return { ok: false, why: 'sin panel' };
    const li = [...p.querySelectorAll('li')].find(l => (l.textContent || '').trim() === d);
    if (!li) return { ok: false, opciones: [...p.querySelectorAll('li')].map(l => l.textContent.trim()) };
    const r = li.getBoundingClientRect();
    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [widgetId, destino]);
  if (!op.ok) return { antes, error: 'opción no encontrada', op };
  await pg.mouse.click(op.x, op.y);
  await L.sleep(2500);
  const trasSelect = await leer(pg, frag);

  // GUARDAR
  const g = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('button, .ui-button')]
      .filter(e => e.getBoundingClientRect().width > 0)
      .find(e => /guardar/i.test((e.innerText || e.textContent || '').trim()));
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: b.id, txt: (b.innerText || '').trim() };
  });
  if (!g) return { antes, trasSelect, error: 'sin botón Guardar' };
  await L.sleep(400);
  await pg.mouse.click(g.x, g.y);
  await L.sleep(7000);
  const msg = await pg.evaluate(() => {
    const m = document.querySelector('.ui-messages, .ui-growl, .ui-message');
    return m ? (m.innerText || '').replace(/\s+/g, ' ').slice(0, 200) : null;
  });
  const despues = await leer(pg, frag);
  return { antes, trasSelect, guardar: g, msg, despues };
};
