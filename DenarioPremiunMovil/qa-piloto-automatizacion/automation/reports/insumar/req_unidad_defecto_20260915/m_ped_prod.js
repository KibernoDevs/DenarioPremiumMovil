// m_ped_prod.js <codigo> — en el Tab Pedido, busca el producto por código, expande
// su panel y devuelve el MAPA COMPLETO de selects de línea + el modelo vivo.
const L = require('./m_lib');

module.exports = async (pg, args) => {
  const cod = args[0];
  const log = [];

  // 1. Tab Pedido
  const tab = await L.clickRect(pg, () => {
    const b = [...document.querySelectorAll('app-pedido ion-segment-button')]
      .find(e => (e.textContent || '').trim().toLowerCase() === 'pedido');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  log.push({ tab });
  await L.sleep(2500);

  // 2. Abrir el buscador de productos (ícono, no ion-searchbar)
  const lupa = await L.clickRect(pg, () => {
    const i = [...document.querySelectorAll('ion-icon[name="search-circle-sharp"], ion-icon[name*="search"]')]
      .filter(e => e.getBoundingClientRect().width > 0)[0];
    if (!i) return null;
    const r = i.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  log.push({ lupa });
  await L.sleep(1500);

  // 3. Teclear el código + Enter, blur y esperar (el teclado mueve todo)
  const inp = await pg.$('input.search-input.inputsSearch, input.inputsSearch, input[placeholder*="squeda"]');
  if (!inp) return { log, err: 'sin input de búsqueda' };
  await inp.click();
  await inp.fill('');
  await inp.type(cod, { delay: 60 });
  await pg.keyboard.press('Enter');
  await pg.evaluate(el => el.blur(), inp);
  await L.sleep(2600);

  // 4. Listar los candidatos y quedarse con el del código EXACTO
  const cands = await pg.evaluate(() => {
    const acc = [...document.querySelectorAll('ion-accordion')].filter(a => a.getBoundingClientRect().height > 0);
    return acc.map((a, i) => ({ i, txt: (a.innerText || '').replace(/\s+/g, ' ').slice(0, 170) }));
  });
  log.push({ cands });

  const sel = await pg.evaluate((cod) => {
    const acc = [...document.querySelectorAll('ion-accordion')].filter(a => a.getBoundingClientRect().height > 0);
    const rx = /C[oó]digo:\s*([A-Za-z0-9-]+?)\s*(?:Precio|Inventario|$)/;
    let idx = -1;
    acc.forEach((a, i) => {
      const t = (a.innerText || '').replace(/\s+/g, ' ');
      const m = t.match(rx);
      if (m && m[1] === cod && idx < 0) idx = i;
    });
    if (idx < 0) return null;
    const a = acc[idx];
    const h = a.querySelector('ion-item') || a;
    h.scrollIntoView({ block: 'center' });
    return { idx, txt: (a.innerText || '').replace(/\s+/g, ' ').slice(0, 200) };
  }, cod);
  log.push({ sel });
  if (!sel) return { log, err: 'código no encontrado en la lista' };
  await L.sleep(700);

  // 5. Expandir: re-leer el rect y clickear el header
  const exp = await pg.evaluate((idx) => {
    const acc = [...document.querySelectorAll('ion-accordion')].filter(a => a.getBoundingClientRect().height > 0);
    const a = acc[idx];
    const h = a.querySelector('ion-item') || a;
    const r = h.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + Math.min(30, r.height / 2);
    const top = document.elementFromPoint(x, y);
    return { x, y, ocl: top ? top.tagName.toLowerCase() + '.' + String(top.className).slice(0, 40) : null };
  }, sel.idx);
  log.push({ exp });
  await pg.mouse.click(exp.x, exp.y, { delay: 70 });
  await L.sleep(2600);

  const alertas = await L.alerts(pg, ['OK', 'Aceptar']);
  if (alertas.length) { log.push({ alertas }); await L.sleep(1200); }

  // 6. Leer los selects del panel + el modelo vivo
  const medida = await pg.evaluate((cod) => {
    const ng = window.ng;
    const comp = ng.getComponent(document.querySelector('productos-tab-order-product-list'));
    const os = ng.getComponent(document.querySelector('app-pedido')).orderServ;
    const prod = (comp.productList || []).find(p => p.coProduct === cod) || null;

    // selects visibles del panel
    const selects = [...document.querySelectorAll('ion-select')]
      .filter(s => s.getBoundingClientRect().height > 0)
      .map(s => ({
        label: (s.getAttribute('label') || s.getAttribute('placeholder') ||
                ((s.closest('ion-item') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 40)),
        placeholder: s.getAttribute('placeholder'),
        disabled: s.disabled === true || s.hasAttribute('disabled') || s.getAttribute('aria-disabled') === 'true',
        seleccionado: (s.shadowRoot ? (s.shadowRoot.querySelector('.select-text') || {}).textContent : null)
                      || (s.innerText || '').trim().slice(0, 40),
        opciones: [...s.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim()),
      }));

    const inputs = [...document.querySelectorAll('ion-input')]
      .filter(i => i.getBoundingClientRect().height > 0)
      .map(i => ({ label: i.getAttribute('label'), type: i.getAttribute('type'), value: i.value }));

    return {
      vgs: {
        unitByPriceList: os.unitByPriceList,
        userCanChangeUnits: os.userCanChangeUnits,
        disableUnitSelector: os.disableUnitSelector,
      },
      producto: prod ? {
        coProduct: prod.coProduct, naProduct: prod.naProduct,
        coPrimaryUnit: prod.coPrimaryUnit,
        idUnit: prod.idUnit, idList: prod.idList,
        nuPrice: prod.nuPrice, quAmount: prod.quAmount,
        unitList: (prod.unitList || []).map(u => ({ idUnit: u.idUnit, coUnit: u.coUnit, naUnit: u.naUnit, quUnit: u.quUnit, quAmount: u.quAmount, nuPrice: u.nuPrice })),
        priceList: (prod.priceList || prod.listaPrecios || []).map(p => ({ idList: p.idList, coList: p.coList, naList: p.naList, nuPrice: p.nuPrice })),
      } : null,
      selects, inputs,
      panelTxt: (() => {
        const a = [...document.querySelectorAll('ion-accordion')].find(x => (x.innerText || '').includes(cod));
        return a ? (a.innerText || '').replace(/\s+/g, ' ').slice(0, 400) : null;
      })(),
    };
  }, cod);

  return { log, medida };
};
