const L = require('./m_lib');
module.exports = async (pg, args) => {
  const nombre = (args[0] || '').toLowerCase();
  const raiz = args[1] || 'app-devoluciones';
  const r = await pg.evaluate(([n, raiz]) => {
    const bs = [...document.querySelectorAll(raiz + ' ion-segment-button')];
    const b = bs.find(e => (e.textContent || '').trim().toLowerCase() === n);
    if (!b) return { ok: false, tabs: bs.map(e => (e.textContent || '').trim()) };
    b.scrollIntoView({ block: 'center' });
    const x = b.getBoundingClientRect();
    const cx = x.left + x.width / 2, cy = x.top + x.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return { ok: true, x: cx, y: cy, ocl: top ? top.tagName.toLowerCase() : null };
  }, [nombre, raiz]);
  if (!r.ok) return r;
  await pg.mouse.click(r.x, r.y, { delay: 70 });
  await L.sleep(2600);
  const d = await pg.evaluate((raiz) => ({
    txt: ((document.querySelector(raiz) || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 500),
    botones: [...document.querySelectorAll('ion-button, button')]
      .filter(b => b.getBoundingClientRect().height > 0)
      .map(b => (b.textContent || '').trim().slice(0, 30)).filter(Boolean).slice(0, 15),
  }), raiz);
  return { click: r, ...d };
};
