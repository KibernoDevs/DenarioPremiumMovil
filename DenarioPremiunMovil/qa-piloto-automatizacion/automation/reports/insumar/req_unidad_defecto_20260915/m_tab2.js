const L = require('./m_lib');
module.exports = async (pg, args) => {
  const nombre = (args[0] || '').toLowerCase();
  const raiz = args[1] || 'app-devoluciones';
  const r = await pg.evaluate(([n, raiz]) => {
    const bs = [...document.querySelectorAll(raiz + ' ion-segment-button')];
    const b = bs.find(e => (e.textContent || '').trim().toLowerCase() === n);
    if (!b) return { ok: false, tabs: bs.map(e => (e.textContent || '').trim()) };
    const x = b.getBoundingClientRect();
    return { ok: true, x: x.left + x.width / 2, y: x.top + x.height / 2, val: b.getAttribute('value') };
  }, [nombre, raiz]);
  if (!r.ok) return r;
  // gesto compuesto: move → down → pausa → up (ion-segment usa gesture, no click)
  await pg.mouse.move(r.x, r.y);
  await L.sleep(120);
  await pg.mouse.down();
  await L.sleep(160);
  await pg.mouse.up();
  await L.sleep(2600);
  const d = await pg.evaluate((raiz) => ({
    seg: (() => { const s = document.querySelector(raiz + ' ion-segment'); return s ? s.value : null; })(),
    txt: ((document.querySelector(raiz) || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 500),
    botones: [...document.querySelectorAll('ion-button, button')]
      .filter(b => b.getBoundingClientRect().height > 0)
      .map(b => (b.textContent || '').trim().slice(0, 30)).filter(Boolean).slice(0, 15),
  }), raiz);
  return { click: r, ...d };
};
