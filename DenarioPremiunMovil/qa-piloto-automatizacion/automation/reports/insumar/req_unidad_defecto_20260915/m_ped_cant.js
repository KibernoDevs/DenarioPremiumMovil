// m_ped_cant.js <codigo> <cantidad> [listaTexto]
// Con el panel del producto YA expandido: (opcional) cambia la Lista de Precio,
// teclea la cantidad y devuelve carrito + Tab Total.
const L = require('./m_lib');

module.exports = async (pg, args) => {
  const cod = args[0], cant = args[1], lista = args[2] || null;
  const log = [];

  if (lista) {
    // abrir el select "Lista de Precio" (el 1.º visible) y elegir por texto
    const r = await pg.evaluate(() => {
      const s = [...document.querySelectorAll('ion-select')].filter(e => e.getBoundingClientRect().height > 0)[0];
      if (!s) return null;
      s.scrollIntoView({ block: 'center' });
      const b = s.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    log.push({ abrirLista: r });
    if (r) {
      await L.sleep(400);
      const r2 = await pg.evaluate(() => {
        const s = [...document.querySelectorAll('ion-select')].filter(e => e.getBoundingClientRect().height > 0)[0];
        const b = s.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      });
      await pg.mouse.click(r2.x, r2.y, { delay: 70 });
      await L.sleep(1800);
      const op = await pg.evaluate((t) => {
        const pop = [...document.querySelectorAll('ion-popover, ion-alert, ion-action-sheet')]
          .filter(p => p.offsetParent !== null && !p.classList.contains('overlay-hidden')).pop();
        if (!pop) return { ok: false, why: 'sin popover' };
        const cands = [...pop.querySelectorAll('ion-item, button, .alert-radio-button')];
        const el = cands.find(c => (c.textContent || '').replace(/\s+/g, ' ').trim().includes(t));
        if (!el) return { ok: false, opciones: cands.map(c => (c.textContent || '').trim()) };
        const b = el.getBoundingClientRect();
        return { ok: true, x: b.left + b.width / 2, y: b.top + b.height / 2, txt: (el.textContent || '').trim() };
      }, lista);
      log.push({ opcion: op });
      if (op.ok) { await pg.mouse.click(op.x, op.y, { delay: 70 }); await L.sleep(2200); }
      // algunos popovers de select exigen confirmar
      const a = await L.alerts(pg, ['Aceptar', 'OK']);
      if (a.length) log.push({ alertaSel: a });
      await L.sleep(1500);
    }
  }

  // cantidad: el único ion-input[type=number] visible sin sellar
  const puso = await pg.evaluate((c) => {
    const ins = [...document.querySelectorAll('ion-input')]
      .filter(i => i.getBoundingClientRect().height > 0 && i.getAttribute('type') === 'number');
    if (!ins.length) return { ok: false };
    const el = ins[0];
    el.id = el.id || 'qa-cant';
    el.scrollIntoView({ block: 'center' });
    const b = el.getBoundingClientRect();
    return { ok: true, id: el.id, x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, cant);
  log.push({ puso });
  if (!puso.ok) return { log, err: 'sin input cantidad' };
  await L.sleep(500);
  const inp = await pg.$('#' + puso.id + ' input');
  await inp.click();
  await inp.fill('');
  await inp.type(String(cant), { delay: 70 });
  await pg.evaluate(el => el.blur(), inp);
  await L.sleep(2600);
  const a2 = await L.alerts(pg, ['OK', 'Aceptar']);
  if (a2.length) { log.push({ alertaCant: a2 }); await L.sleep(1200); }

  const carrito = await pg.evaluate(() => {
    const os = window.ng.getComponent(document.querySelector('app-pedido')).orderServ;
    return (os.carrito || []).map(i => ({
      coProduct: i.coProduct, naProduct: (i.naProduct || '').slice(0, 40),
      idUnit: i.idUnit, idList: i.idList, nuPrice: i.nuPrice,
      quAmount: i.quAmount, subtotal: i.subtotal, totalEnUnidades: i.totalEnUnidades,
      unitList: (i.unitList || []).map(u => ({ coUnit: u.coUnit, quUnit: u.quUnit, quAmount: u.quAmount, nuPrice: u.nuPrice, idUnit: u.idUnit })),
    }));
  });

  // Tab Total
  const tot = await L.clickRect(pg, () => {
    const b = [...document.querySelectorAll('app-pedido ion-segment-button')]
      .find(e => (e.textContent || '').trim().toLowerCase() === 'total');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await L.sleep(2500);
  const totalTxt = await pg.evaluate(() =>
    (document.querySelector('app-pedido') || {}).innerText.replace(/\s+/g, ' ').slice(0, 900));

  return { log, carrito, totalTxt };
};
