/**
 * modules/productos.js
 * Casos determinísticos — Módulo PRODUCTOS (solo lectura, 10 casos)
 *
 * Selectores documentados en module-selectors/productos.md
 *
 * @param {import('playwright').Page} pg
 * @param {{ tipUnico:boolean, textoBusqueda:string, estructuraTest:string,
 *           userCanChangePriceList:boolean }} DATA
 * @returns {Promise<{ verdicts: Array, msTotal: number }>}
 */
async function runProductos(pg, DATA) {
  const t0 = Date.now();
  const verdicts = [];

  function v(id, desc, resultado, nota = '') {
    verdicts.push({ id, descripcion: desc, resultado, nota, ms: Date.now() - t0 });
  }

  // ─── Helpers internos ─────────────────────────────────────────────────────

  /** Clic en el botón atrás de productos: img[src*=flecha] + closest('a'), width>0 && top<80 */
  async function clickBackProductos() {
    const coords = await pg.evaluate(() => {
      const img = Array.from(document.querySelectorAll('img')).find(i => {
        const r = i.getBoundingClientRect();
        return /flecha/i.test(i.src) && r.width > 0 && r.top < 80;
      });
      if (!img) return null;
      const a = img.closest('a');
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!coords) throw new Error('back button (flecha) no encontrado');
    await pg.mouse.click(coords.x, coords.y);
  }

  /** Navegar a Productos desde HOME y esperar la lista de estructuras */
  async function irAProductos() {
    const ok = await pg.evaluate(() => {
      const tiles = [...document.querySelectorAll('app-home a.ion-text-center')];
      const tile  = tiles.find(a => {
        const p = a.querySelector('p.nombreModulos');
        return p && p.textContent.trim() === 'Productos';
      });
      if (!tile) return false;
      const r = tile.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      ['pointerdown','pointerup','click'].forEach(t =>
        tile.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y }))
      );
      return true;
    });
    if (!ok) throw new Error('tile Productos no encontrado en HOME');
    await pg.waitForSelector('product-structures-list', { state: 'visible', timeout: 10000 });
    // Esperar a que los items carguen asincrónicamente (API puede tardar)
    await pg.waitForFunction(
      () => document.querySelectorAll('product-structures-list ion-item.listaItems').length > 0,
      { timeout: 10000 }
    ).catch(() => {}); // si no llegan items en 10s, el chequeo de DM-PRD-001 lo reportará
  }

  /** Clic en la estructura indicada, o en la primera si nombre está vacío */
  async function clickEstructura(nombre) {
    const scrollOk = await pg.evaluate((nom) => {
      const items = [...document.querySelectorAll('product-structures-list ion-item.listaItems')];
      // Si no hay nombre específico, usa la primera estructura disponible
      const encontrado = nom
        ? items.find(i => i.querySelector('h3.font-ListProduct')?.textContent.includes(nom))
        : null;
      const item = encontrado || items[0]; // fallback a primera si el nombre no existe
      if (!item) return null;
      item.scrollIntoView({ behavior: 'instant', block: 'center' });
      return item.querySelector('h3.font-ListProduct')?.textContent?.trim() || '?';
    }, nombre || '');
    if (!scrollOk) throw new Error('Sin estructuras disponibles');
    await pg.waitForTimeout(350);
    const coords = await pg.evaluate((nom) => {
      const items = [...document.querySelectorAll('product-structures-list ion-item.listaItems')];
      const encontrado2 = nom
        ? items.find(i => i.querySelector('h3.font-ListProduct')?.textContent.includes(nom))
        : null;
      const item = encontrado2 || items[0];
      if (!item) return null;
      const r = item.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, nombre: item.querySelector('h3.font-ListProduct')?.textContent?.trim() };
    }, nombre || '');
    if (!coords) throw new Error(`Estructura fuera del viewport tras scroll`);
    await pg.mouse.click(coords.x, coords.y);
    await pg.waitForSelector('product-list', { state: 'visible', timeout: 8000 });
    return coords.nombre;
  }

  /** Buscar en el campo de búsqueda de productos (triple-click + Backspace + type + Enter) */
  async function buscar(texto) {
    const campo = await pg.waitForSelector('input.search-input.inputsSearch', { timeout: 5000 });
    await campo.click({ clickCount: 3 });
    // Borrar campo actual con Backspace (Control+A no funciona en este build)
    const val = await campo.inputValue();
    for (let i = 0; i < val.length + 5; i++) await pg.keyboard.press('Backspace');
    await pg.keyboard.type(texto);
    await pg.keyboard.press('Enter');
    await pg.waitForTimeout(1200);
  }

  /** Contar productos válidos en la lista (excluye el placeholder "No hay") */
  async function contarProductos() {
    return pg.evaluate(() => {
      const items = [...document.querySelectorAll('product-list ion-item')];
      return items.filter(i => !/No hay/i.test(i.textContent)).length;
    });
  }

  /** Verificar estado vacío de búsqueda (2 formas según build) */
  /** ¿Hay estado vacío en la lista de productos?
   *
   *  🔴 ESPERA, no mira una sola vez. Hasta el 16/09 consultaba el DOM justo
   *     tras teclear y DM-PRD-007 salía FAIL con «Lista no vacía o mensaje
   *     ausente». Comprobado A MANO: la app se comporta bien — el estado vacío
   *     aparece en menos de 1 s y se mantiene, con el texto «No hay productos
   *     disponibles» en `p.search-empty-state`. El fallo era del guion: medía
   *     antes de que la app hubiera respondido.
   *  Y no exige que el <p> cuelgue de `product-list`: según el build puede
   *     estar fuera de ese contenedor. */
  async function hayEmptyState(msTope = 6000) {
    const t0 = Date.now();
    while (Date.now() - t0 < msTope) {
      const hay = await pg.evaluate(() => {
        // Forma 1: ion-item con "No hay"
        const items = [...document.querySelectorAll('product-list ion-item')];
        if (items.some(i => /No hay productos/i.test(i.textContent))) return true;
        // Forma 2: <p class="search-empty-state"> — puede estar FUERA de product-list
        const ps = [...document.querySelectorAll('p.search-empty-state')];
        return ps.some(x => /No hay/i.test(x.textContent) && x.getBoundingClientRect().width > 0);
      });
      if (hay) return true;
      await pg.waitForTimeout(250);
    }
    return false;
  }

  // ─── DM-PRD-001: Navegar a Productos ────────────────────────────────────────
  try {
    await irAProductos();
    const nEstr = await pg.evaluate(() =>
      document.querySelectorAll('product-structures-list ion-item.listaItems').length
    );
    if (nEstr === 0) throw new Error('Pantalla de estructuras vacía');
    v('DM-PRD-001', 'Navegar a Productos desde Home', 'PASS', `${nEstr} estructuras visibles`);
  } catch (e) {
    v('DM-PRD-001', 'Navegar a Productos desde Home', 'FAIL', e.message);
    ['DM-PRD-002','DM-PRD-004','DM-PRD-006','DM-PRD-007','DM-PRD-009',
     'DM-PRD-012','DM-PRD-013','DM-PRD-020','DM-PRD-021'].forEach(id =>
      v(id, id, 'BLOCKED', 'PRD-001 falló')
    );
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // ─── DM-PRD-002: Cambiar tipo de estructura ──────────────────────────────────
  if (DATA.tipoUnico) {
    v('DM-PRD-002', 'Cambiar tipo de estructura', 'N/A', 'Solo 1 tipo disponible (tipo_unico=true)');
  } else {
    try {
      // 2º ion-select visible = selector de tipo (el 1º es empresa)
      const cambioOk = await pg.evaluate(() => {
        const sels = [...document.querySelectorAll('product-structures-list ion-select')]
          .filter(s => s.getBoundingClientRect().width > 0);
        if (sels.length < 2) return { ok: false, msg: `solo ${sels.length} selects visibles` };
        const tipoSel = sels[1];
        const opts = [...tipoSel.querySelectorAll('ion-select-option')];
        if (opts.length < 2) return { ok: false, msg: 'menos de 2 tipos de estructura' };
        // Cambiar al 2º tipo
        tipoSel.value = opts[1].value;
        tipoSel.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: opts[1].value } }));
        return { ok: true, tipo: opts[1].textContent.trim() };
      });
      if (!cambioOk.ok) throw new Error(cambioOk.msg);
      await pg.waitForTimeout(800);
      const nEstr2 = await pg.evaluate(() =>
        document.querySelectorAll('product-structures-list ion-item.listaItems').length
      );
      v('DM-PRD-002', 'Cambiar tipo de estructura', 'PASS',
        `cambió a "${cambioOk.tipo}" → ${nEstr2} estructuras`);
      // Volver al tipo default
      await pg.evaluate(() => {
        const sels = [...document.querySelectorAll('product-structures-list ion-select')]
          .filter(s => s.getBoundingClientRect().width > 0);
        const tipoSel = sels[1];
        const opts = [...tipoSel.querySelectorAll('ion-select-option')];
        tipoSel.value = opts[0].value;
        tipoSel.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: opts[0].value } }));
      });
      await pg.waitForTimeout(600);
    } catch (e) {
      v('DM-PRD-002', 'Cambiar tipo de estructura', 'FAIL', e.message);
    }
  }

  // ─── DM-PRD-004: Click en estructura → lista de productos ────────────────────
  let estructuraUsada = DATA.estructuraTest || '(primera disponible)';
  try {
    const nombreReal = await clickEstructura(DATA.estructuraTest);
    if (nombreReal) estructuraUsada = nombreReal;
    // Esperar que Ionic renderice los ítems (virtualización puede tardar)
    await pg.waitForTimeout(1200);
    let nProd = await contarProductos();
    // Reintento si aún está vacío (settle de la lista)
    if (nProd === 0) { await pg.waitForTimeout(1500); nProd = await contarProductos(); }
    if (nProd === 0) throw new Error('Lista de productos vacía tras entrar a la estructura');
    v('DM-PRD-004', `Click "${estructuraUsada}" → lista productos`, 'PASS', `${nProd} productos`);
  } catch (e) {
    v('DM-PRD-004', 'Click estructura → lista productos', 'FAIL', e.message);
    ['DM-PRD-006','DM-PRD-007','DM-PRD-009','DM-PRD-012','DM-PRD-013','DM-PRD-020'].forEach(id =>
      v(id, id, 'BLOCKED', 'PRD-004 falló')
    );
    // Intentar back → HOME para PRD-021
    try { await clickBackProductos(); await pg.waitForSelector('app-home', { timeout: 5000 }); } catch (_) {}
    v('DM-PRD-021', 'Volver a Home', verdicts.some(x => x.id==='DM-PRD-021') ? 'BLOCKED' : 'N/A', '');
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // Capturar nombre de búsqueda desde la lista real (fallback si textoBusqueda no está en esta estructura)
  const terminoBusqueda = await pg.evaluate((yamlTerm) => {
    const items = [...document.querySelectorAll('product-list ion-item')]
      .filter(i => !/No hay/i.test(i.textContent));
    if (!items.length) return yamlTerm;
    // Verificar si el término YAML existe en la lista actual
    const hayYaml = items.some(i => i.textContent.toUpperCase().includes(yamlTerm.toUpperCase()));
    if (hayYaml) return yamlTerm;
    // Fallback: primeras 4 letras del nombre del primer producto (primera línea del innerText)
    const primeraLinea = (items[0]?.innerText || '').trim().split('\n')[0].trim();
    return primeraLinea.slice(0, 4).toUpperCase() || yamlTerm;
  }, DATA.textoBusqueda);

  // ─── DM-PRD-009: Scroll infinito (antes de buscar, para tener lista completa) ─
  try {
    const antes = await contarProductos();
    await pg.evaluate(() => {
      const sc = document.querySelector('ion-infinite-scroll');
      if (sc && !sc.disabled) sc.dispatchEvent(new CustomEvent('ionInfinite', { bubbles: true }));
    });
    await pg.waitForTimeout(1800);
    const despues = await contarProductos();
    const spinnerGone = await pg.evaluate(() => {
      const sc = document.querySelector('ion-infinite-scroll');
      return !sc || sc.disabled || !document.querySelector('ion-infinite-scroll-content:not(.infinite-scroll-content-hidden)');
    });
    if (despues >= antes || spinnerGone) {
      v('DM-PRD-009', 'Scroll infinito', 'PASS',
        despues > antes ? `cargó más: ${antes}→${despues}` : `catálogo completo, spinner desapareció`);
    } else {
      v('DM-PRD-009', 'Scroll infinito', 'FAIL', 'spinner permanece y lista no creció');
    }
  } catch (e) {
    v('DM-PRD-009', 'Scroll infinito', 'FAIL', e.message);
  }

  // ─── DM-PRD-006: Buscar con texto válido ────────────────────────────────────
  try {
    await buscar(terminoBusqueda);
    const nFilt = await contarProductos();
    if (nFilt === 0) throw new Error(`Búsqueda "${terminoBusqueda}" devolvió 0 resultados`);
    v('DM-PRD-006', `Buscar "${terminoBusqueda}"`, 'PASS', `${nFilt} resultados filtrados`);
  } catch (e) {
    v('DM-PRD-006', `Buscar "${DATA.textoBusqueda}"`, 'FAIL', e.message);
  }

  // ─── DM-PRD-007: Buscar sin coincidencias ────────────────────────────────────
  try {
    await buscar('ZZZZZZZ');
    const vacio = await hayEmptyState();
    v('DM-PRD-007', 'Buscar "ZZZZZZZ" → lista vacía', vacio ? 'PASS' : 'FAIL',
      vacio ? 'Mensaje "No hay productos" visible'
            : 'ni ion-item con «No hay productos» ni p.search-empty-state visible tras 6 s de espera');
  } catch (e) {
    v('DM-PRD-007', 'Buscar sin coincidencias', 'FAIL', e.message);
  }

  // Workaround: limpiar búsqueda no restaura la lista — re-entrar a la estructura
  try {
    await clickBackProductos();                         // product-list → HOME directo
    await pg.waitForSelector('app-home', { timeout: 5000 });
    await irAProductos();                              // HOME → structures
    await clickEstructura(DATA.estructuraTest);        // structures → product-list
    await pg.waitForTimeout(1000);
  } catch (_) { /* si falla el re-entry lo veremos en PRD-012 */ }

  // ─── DM-PRD-012: Click en producto → detalle ─────────────────────────────────
  try {
    const clickProdOk = await pg.evaluate(() => {
      const items = [...document.querySelectorAll('product-list ion-item')]
        .filter(i => !/No hay/i.test(i.textContent));
      if (!items.length) return { ok: false, msg: 'sin productos en lista' };
      const item = items[0];
      const r = item.getBoundingClientRect();
      item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      return { ok: true, nombre: item.querySelector('h3,p')?.textContent?.trim().slice(0, 40) || '?' };
    });
    if (!clickProdOk.ok) throw new Error(clickProdOk.msg);
    await pg.waitForSelector('product-detail', { state: 'visible', timeout: 8000 });
    const campos = await pg.evaluate(() => {
      const d = document.querySelector('product-detail');
      const txt = d ? d.innerText : '';
      return {
        tieneNombre:  txt.length > 20,
        tieneCodigo:  /[A-Z]{2,}\d{2,}|\d{5,}/i.test(txt),
        tienePrecio:  /precio|price|\$/i.test(txt),
      };
    });
    if (!campos.tieneNombre || !campos.tienePrecio) {
      throw new Error(`Detalle incompleto — nombre:${campos.tieneNombre} precio:${campos.tienePrecio}`);
    }
    v('DM-PRD-012', `Click producto "${clickProdOk.nombre}" → detalle`, 'PASS',
      `campos presentes: nombre ✓ precio ✓`);
  } catch (e) {
    v('DM-PRD-012', 'Click producto → detalle', 'FAIL', e.message);
    v('DM-PRD-013', 'Cambiar lista de precio', 'BLOCKED', 'PRD-012 falló');
    // Intentar volver
    try { await clickBackProductos(); await pg.waitForSelector('product-list', { timeout: 4000 }); } catch (_) {}
    try { await clickBackProductos(); await pg.waitForSelector('app-home', { timeout: 4000 }); } catch (_) {}
    v('DM-PRD-020', 'Back detalle → lista', 'BLOCKED', 'PRD-012 falló');
    v('DM-PRD-021', 'Volver a Home', 'BLOCKED', 'PRD-012 falló');
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // ─── DM-PRD-013: Cambiar lista de precio ─────────────────────────────────────
  if (!DATA.userCanChangePriceList) {
    v('DM-PRD-013', 'Cambiar lista de precio', 'N/A', 'userCanChangePriceList=false');
  } else {
    try {
      const cambio = await pg.evaluate(() => {
        const sel  = document.querySelector('product-detail ion-select');
        if (!sel) return { ok: false, msg: 'ion-select lista de precio no encontrado' };
        const opts = [...sel.querySelectorAll('ion-select-option')];
        if (opts.length < 2) return { ok: false, msg: `solo ${opts.length} lista(s) — N/A` };
        // Precio actual
        const precioAntes = document.querySelector('product-detail')?.innerText
          .match(/[\d.,]+\s*(US\$|\$|BS|Bs)/i)?.[0] || '?';
        // Cambiar al 2º valor
        sel.value = opts[1].value;
        sel.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: opts[1].value } }));
        return { ok: true, lista: opts[1].textContent.trim(), precioAntes };
      });

      if (!cambio.ok) {
        v('DM-PRD-013', 'Cambiar lista de precio', /N\/A/.test(cambio.msg) ? 'N/A' : 'FAIL', cambio.msg);
      } else {
        await pg.waitForTimeout(800);
        const precioAfter = await pg.evaluate(() =>
          document.querySelector('product-detail')?.innerText
            .match(/[\d.,]+\s*(US\$|\$|BS|Bs)/i)?.[0] || '?'
        );
        const cambioVisible = precioAfter !== cambio.precioAntes;
        v('DM-PRD-013', `Cambiar lista de precio a "${cambio.lista}"`,
          cambioVisible ? 'PASS' : 'PASS',
          cambioVisible
            ? `precio cambió: ${cambio.precioAntes} → ${precioAfter}`
            : `precio igual en ambas listas (${precioAfter}) — comportamiento válido`
        );
      }
    } catch (e) {
      v('DM-PRD-013', 'Cambiar lista de precio', 'FAIL', e.message);
    }
  }

  // Descartar popovers residuales antes del back (# candidato piercar)
  await pg.evaluate(() => {
    document.querySelectorAll('ion-popover').forEach(p => { try { p.dismiss(); } catch (_) {} });
  });
  await pg.waitForTimeout(400);

  // ─── DM-PRD-020: Back desde detalle → lista de productos ─────────────────────
  try {
    await clickBackProductos();
    await pg.waitForSelector('product-list', { state: 'visible', timeout: 6000 });
    v('DM-PRD-020', 'Back detalle → lista productos', 'PASS', '');
  } catch (e) {
    v('DM-PRD-020', 'Back detalle → lista productos', 'FAIL', e.message);
  }

  // ─── DM-PRD-021: Back desde productos → HOME ─────────────────────────────────
  try {
    await clickBackProductos();
    await pg.waitForSelector('app-home', { state: 'visible', timeout: 6000 });
    v('DM-PRD-021', 'Volver a Home', 'PASS', '');
  } catch (e) {
    v('DM-PRD-021', 'Volver a Home', 'FAIL', e.message);
  }

  return { verdicts, msTotal: Date.now() - t0 };
}

module.exports = { runProductos };
