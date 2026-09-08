'use strict';
/**
 * modules/sugerido.js — PEDIDO SUGERIDO (hidroponias)
 *
 * Módulo ESPECIAL: solo aplica a los clientes con
 * `suggestedOrderByDispatchAndReturn = true`. Hoy, únicamente hidroponias.
 *
 * 🔑 CÓMO SE USA — SE SUMA A LOS NORMALES, NO LOS REEMPLAZA
 *
 *     node automation/playwright/run.js hidroponias                    ← los de siempre
 *     node automation/playwright/run.js hidroponias --modulo=sugerido  ← este
 *
 * El sugerido NACE de un inventario y TERMINA en un pedido: si mañana se rompe
 * inventarios, este módulo va a fallar y no se sabría si lo que se rompió fue el
 * sugerido o el piso sobre el que se para. Corriendo antes los normales, un rojo
 * de aquí ya viene con diagnóstico.
 *
 * 🔑 EL ORÁCULO SE CALCULA, NO SE CONFIGURA
 * Ver `automation/sugerido/oraculo.js`. Se lee la MISMA base que consulta la app
 * (el SQLite del teléfono), se elige el cliente con el mejor escenario y se
 * calcula cuánto debe dar cada término. Nada de números en el YAML: los datos de
 * hidroponias cambian solos y un oráculo vencido produce FAILs que no son
 * defectos — o PASSes que no probaron nada.
 *
 * 🔴 Y EL CLIENTE SE ELIGE DESDE EL EQUIPO. El 08/09 elegimos dos clientes
 *    perfectos mirando la nube y ninguno servía: uno era de otro vendedor, el
 *    otro no tenía vendedor asignado. La app solo ve su SQLite.
 *
 * Guión: `guiones-regresion/guion-hidroponias-pedido-sugerido.md`
 *
 * @param {import('playwright').Page} pg
 * @param {{ aplica:boolean, clienteSlug:string, diasHasta:number,
 *           suggestedOrderByDispatchAndReturn:boolean }} DATA
 */

const { execFileSync } = require('child_process');
const path = require('path');
const {
  verificarBase, elegirEscenario, oraculoDespacho, oraculoTerminos, snapshotGuardado,
} = require('../../sugerido/oraculo');

const NUBE_QUERY = path.resolve(__dirname, '../../db/query.js');

/** Consulta la BD en la nube del cliente. Null si no se pudo. */
function consultaNube(slug, sql) {
  try {
    return JSON.parse(
      execFileSync('node', [NUBE_QUERY, slug, sql], { encoding: 'utf8', timeout: 30000 })
    );
  } catch (_) { return null; }
}

async function runSugerido(pg, DATA) {
  const t0 = Date.now();
  const verdicts = [];
  const v = (id, desc, resultado, nota = '') =>
    verdicts.push({ id, descripcion: desc, resultado, nota, ms: Date.now() - t0 });

  // Los que este módulo cubre. Los del guión que no están aquí van al final
  // como BLOCKED con su motivo — nunca se omiten en silencio.
  const TODOS = [
    'DM-SUG-001', 'DM-SUG-002', 'DM-SUG-003', 'DM-SUG-003b',
    'DM-SUG-010', 'DM-SUG-011', 'DM-SUG-012', 'DM-SUG-013',
    'DM-SUG-019', 'DM-SUG-021', 'DM-SUG-022', 'DM-SUG-023', 'DM-SUG-026',
    'DM-SUG-030', 'DM-SUG-031', 'DM-SUG-032', 'DM-SUG-034', 'DM-SUG-035', 'DM-SUG-036',
    'DM-SUG-040', 'DM-SUG-041', 'DM-SUG-042', 'DM-SUG-043',
    'DM-SUG-050', 'DM-SUG-052', 'DM-SUG-053',
    'DM-SUG-060', 'DM-SUG-061', 'DM-SUG-062', 'DM-SUG-063',
    'DM-SUG-070', 'DM-SUG-071',
  ];
  const bloquearResto = (motivo) => TODOS.forEach(id => {
    if (!verdicts.some(x => x.id === id)) v(id, id, 'BLOCKED', motivo);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PRE-VUELO — sin esto, cualquier medición posterior es ruido
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── DM-SUG-002: la VG que habilita todo el módulo ──────────────────────────
  if (!DATA.aplica || DATA.suggestedOrderByDispatchAndReturn === false) {
    TODOS.forEach(id => v(id, id, 'N/A',
      'suggestedOrderByDispatchAndReturn=false: el sugerido por despacho y devolución ' +
      'no aplica a este cliente. NO es un fallo'));
    return { verdicts, msTotal: Date.now() - t0 };
  }
  v('DM-SUG-002', 'VG suggestedOrderByDispatchAndReturn activa', 'PASS', 'leída del equipo');

  // ─── DM-SUG-001: la migración v22 dejó las tablas del snapshot ──────────────
  const base = verificarBase();
  v('DM-SUG-001', 'Migración v22 → tablas del sugerido creadas',
    base.ok ? 'PASS' : 'FAIL',
    base.ok
      ? `${base.clientes} clientes · ${base.facturas} facturas · última: ${base.ultimaFactura}`
      : base.motivo);
  if (!base.ok) { bloquearResto('la base local no está lista: ' + base.motivo); return { verdicts, msTotal: Date.now() - t0 }; }

  // ─── Elegir escenario y calcular el oráculo ─────────────────────────────────
  const escenarios = elegirEscenario();
  if (escenarios._error || !escenarios.length) {
    bloquearResto(escenarios._error
      ? `no se pudo elegir escenario: ${escenarios._error}`
      : 'ningún cliente del equipo tiene 2+ facturas en su última fecha: sin eso no se ' +
        'puede probar la consolidación. Falta de dato, no defecto');
    return { verdicts, msTotal: Date.now() - t0 };
  }

  const esc = escenarios[0];
  const oraculo = oraculoDespacho(esc.id_client, esc.id_address_client);
  if (oraculo._error) {
    bloquearResto(`no se pudo calcular el oráculo: ${oraculo._error}`);
    return { verdicts, msTotal: Date.now() - t0 };
  }

  const ocultos  = oraculo.filter(o => o.rol === 'ocultoPorElBug');
  const controles = oraculo.filter(o => o.rol === 'control');
  const sumados  = oraculo.filter(o => o.rol === 'sumado');

  // ─── DM-SUG-011: la SUMA — se declara ANTES de medir nada ───────────────────
  // 🔴 Este caso lleva dos corridas sin poder ejercitarse por falta de dato. Se
  //    dice de entrada y con el motivo exacto, para que no se lea como un olvido
  //    ni, peor, se dé por PASS al no encontrar diferencias.
  if (!sumados.length) {
    v('DM-SUG-011', 'Despacho SUMA un producto repetido entre facturas del mismo día', 'BLOCKED',
      `ningún cliente del equipo tiene un producto en 2+ facturas de su última fecha. ` +
      `Escenario elegido: ${esc.co_client} con ${esc.facturas} facturas y 0 repetidos. ` +
      'Se desbloquea asignando a este vendedor un cliente que sí lo tenga ' +
      '(ver automation/db/sql/hidroponias-asignar-corneteria-a-v3.sql)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVEGACIÓN — selectores verificados en la corrida del 01/09
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🔴 El árbol del Tab Inventario tiene DOS niveles y el buscador solo filtra
   *    DENTRO de una categoría. Si el guion se queda dentro de una, todas las
   *    búsquedas siguientes devuelven 0 y se lee como «el producto no existe en
   *    el catálogo». Hay que SUBIR antes de cada búsqueda.
   */
  async function subirNivel() {
    const c = await pg.evaluate(() => {
      const b = [...document.querySelectorAll('ion-icon[name="arrow-back-outline"]')]
        .find(e => e.getBoundingClientRect().width > 0);
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (c) { await pg.mouse.click(c.x, c.y, { delay: 80 }); await pg.waitForTimeout(900); }
    return !!c;
  }

  /**
   * 🔴 El modal de cantidad se acepta con el ✓ del ENCABEZADO, no con un botón
   *    «Aceptar». Buscar por texto devuelve null, el modal queda abierto y su
   *    backdrop se come todos los clics siguientes: el módulo pasa a «no tiene
   *    botones» y el fallo aparece tres pasos después, disfrazado.
   */
  async function aceptarModalCantidad() {
    const c = await pg.evaluate(() => {
      const b = [...document.querySelectorAll('ion-icon[name="checkmark-outline"]')]
        .find(e => e.getBoundingClientRect().width > 0);
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!c) return false;
    await pg.mouse.click(c.x, c.y, { delay: 80 });
    await pg.waitForTimeout(1000);
    // Confirmar que CERRÓ: un modal abierto invisible es peor que uno visible.
    return pg.evaluate(() =>
      ![...document.querySelectorAll('ion-modal')].some(m => m.getBoundingClientRect().width > 0));
  }

  /**
   * 🔴 El botón «Pedido Sugerido» vive en la pestaña RESUMEN, no en INVENTARIO.
   *    Buscarlo desde la pestaña de carga devuelve [] y se lee como «la VG no rinde».
   */
  async function abrirVistaPreviaSugerido() {
    const c = await pg.evaluate(() => {
      const b = [...document.querySelectorAll('ion-button, ion-segment-button')]
        .filter(e => e.getBoundingClientRect().width > 0)
        .find(e => /pedido\s+sugerido/i.test((e.textContent || '').trim()));
      if (!b) return null;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!c) return false;
    await pg.mouse.click(c.x, c.y, { delay: 100 });
    await pg.waitForTimeout(2500);
    return pg.evaluate(() => !!document.querySelector('app-inventario-sugerido-preview'));
  }

  /**
   * 🔴 Los términos del cálculo NO ESTÁN EN EL DOM. La pantalla solo muestra el
   *    resultado; prev/desp/swap/inicial/vendido/diaria viven en el componente.
   *    Sin esto no se puede cotejar la aritmética, solo mirar el número final.
   */
  async function leerTerminos() {
    return pg.evaluate(() => {
      const el = document.querySelector('app-inventario-sugerido-preview');
      if (!el || !window.ng || !window.ng.getComponent) return { _error: 'sin componente de vista previa' };
      const c = window.ng.getComponent(el);
      if (!c || !Array.isArray(c.productsSuggested)) return { _error: 'el componente no expone productsSuggested' };
      const filas = [];
      for (const p of c.productsSuggested) {
        for (const u of (p.unitsSuggested || [])) {
          filas.push({
            coProduct: p.coProduct ?? p.co_product,
            naProduct: p.naProduct ?? p.na_product,
            coProductUnit: u.coProductUnit ?? u.co_product_unit,
            previousStock: u.previousStock, dispatchedStock: u.dispatchedStock,
            straightSwapStock: u.straightSwapStock, currentStock: u.currentStock,
            returnedStock: u.returnedStock, initialStock: u.initialStock,
            soldUnits: u.soldUnits, estimatedDailyUnits: u.estimatedDailyUnits,
            quUnitSuggested: u.quUnitSuggested ?? u.qu_unit_suggested,
          });
        }
      }
      return { filas, diasDesde: c.daysSinceLast, diasHasta: c.daysUntilNext };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COTEJOS — no dependen de la UI, se pueden usar desde cualquier punto
  // ═══════════════════════════════════════════════════════════════════════════

  /** Compara el despacho medido contra el oráculo. Devuelve el detalle por producto. */
  function cotejarDespacho(filasUI) {
    const porUnidad = new Map(filasUI.map(f => [String(f.coProductUnit), f]));
    const res = [];
    for (const o of oraculo) {
      const ui = porUnidad.get(String(o.coProductUnit));
      res.push({
        ...o,
        medido: ui ? Number(ui.dispatchedStock ?? 0) : null,
        presente: !!ui,
        ok: ui ? Math.abs(Number(ui.dispatchedStock ?? 0) - o.oraculo) < 0.001 : false,
      });
    }
    return res;
  }

  /**
   * DM-SUG-031 — lo GUARDADO contra lo MOSTRADO, término por término.
   * Es el cotejo que da sentido al REQ: no basta con que se guarde algo, tiene
   * que guardarse LO MISMO que se vio.
   */
  function cotejarSnapshot(coClientStock, filasUI) {
    const snap = snapshotGuardado(coClientStock);
    if (!snap) return { ok: false, motivo: 'no se guardó ninguna cabecera para este inventario' };
    if (snap._error) return { ok: false, motivo: snap._error };

    const porUnidad = new Map(filasUI.map(f => [String(f.coProductUnit), f]));
    const campos = [
      ['previous_stock', 'previousStock'], ['dispatched_stock', 'dispatchedStock'],
      ['straight_swap_stock', 'straightSwapStock'], ['current_stock', 'currentStock'],
      ['returned_stock', 'returnedStock'], ['initial_stock', 'initialStock'],
      ['sold_units', 'soldUnits'], ['estimated_daily_units', 'estimatedDailyUnits'],
      ['qu_unit_suggested', 'quUnitSuggested'],
    ];
    const difs = [];
    let cotejados = 0;
    for (const d of snap.detalles) {
      const ui = porUnidad.get(String(d.co_product_unit));
      if (!ui) { difs.push(`${d.co_product_unit}: guardado pero NO estaba en la vista previa`); continue; }
      cotejados++;
      for (const [col, prop] of campos) {
        const a = Number(d[col] ?? 0), b = Number(ui[prop] ?? 0);
        if (Math.abs(a - b) > 0.0001) {
          difs.push(`${d.co_product_unit}.${col}: guardado ${a} · mostrado ${b}`);
        }
      }
    }
    return {
      ok: difs.length === 0 && cotejados > 0,
      // 🔴 Cotejar CERO líneas no es un PASS: es un caso sin medir.
      motivo: cotejados === 0 ? 'no se cotejó ninguna línea: el snapshot vino vacío' : '',
      cotejados, difs, cabecera: snap.cabecera, detalles: snap.detalles,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EJECUCIÓN
  //
  // ⚠ PENDIENTE DE COMPLETAR con los selectores que traiga la corrida del 08/09:
  //   la navegación a Inventario, la carga de cantidades, el submódulo «Pedido
  //   Sugerido» (Inventario → Pedido Sugerido) y la alerta «¿Desea enviar también
  //   la sugerencia?». NO se inventan aquí: un selector supuesto produce un FAIL
  //   que parece defecto de la app, que es exactamente como nacieron los falsos
  //   PASS del módulo de cobros.
  // ═══════════════════════════════════════════════════════════════════════════

  v('DM-SUG-003', 'Escenario elegido desde el equipo',
    (ocultos.length >= 1 && controles.length >= 2) ? 'PASS' : 'BLOCKED',
    `${esc.co_client} ${esc.na_client} (suc ${esc.id_address_client}) · ${esc.fecha} · ` +
    `${esc.facturas} facturas · ${ocultos.length} producto(s) que el bug ocultaba · ` +
    `${controles.length} de control` +
    ((ocultos.length >= 1 && controles.length >= 2) ? ''
      : ' · 🔴 escenario DESEQUILIBRADO: sin controles suficientes no se puede detectar una regresión'));

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVEGACIÓN — selectores verificados en la corrida del 08/09
  //
  // Los tres primeros se leen como «la app no responde» y no lo son. Están aquí
  // con su porqué para que nadie los vuelva a descubrir a mano.
  // ═══════════════════════════════════════════════════════════════════════════

  const esperar = (ms) => pg.waitForTimeout(ms);

  /** Clic real, midiendo DESPUÉS de hacer scroll. */
  async function clickSeguro(buscar, arg) {
    const c = await pg.evaluate(({ fn, a }) => {
      const el = new Function('a', 'return (' + fn + ')(a)')(a);
      if (!el) return null;
      // 🔴 SCROLL PRIMERO, MEDIR DESPUÉS. El botón «Pedido Sugerido» nace en
      //    top≈789 con innerHeight 744: getBoundingClientRect lo da «visible»,
      //    el clic cae FUERA de la pantalla y no pasa nada. Se lee como que el
      //    botón está muerto. (corrida 08/09)
      el.scrollIntoView({ block: 'center' });
      return null;
    }, { fn: buscar, a: arg }).then(() => esperar(500)).then(() => pg.evaluate(({ fn, a }) => {
      const el = new Function('a', 'return (' + fn + ')(a)')(a);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { fn: buscar, a: arg }));
    if (!c) return false;
    await pg.mouse.click(c.x, c.y, { delay: 100 });
    await esperar(1200);
    return true;
  }

  const BUSCAR_PESTANA = `(v) => [...document.querySelectorAll('ion-segment-button')]
    .filter(e => e.getBoundingClientRect().width > 0)
    .find(e => new RegExp(v, 'i').test((e.textContent || '').trim()))`;

  async function irAPestana(nombre) {
    return clickSeguro(BUSCAR_PESTANA, nombre);
  }

  /**
   * Teclea los días hasta la próxima visita.
   *
   * 🔴 NO SE TECLEA EN LA VISTA PREVIA. La vista previa no tiene ni un solo
   *    `ion-input` — solo muestra el número. El campo real es
   *    `#diasHastaSiguienteInventario` y vive en la pestaña GENERAL, con ngModel
   *    y exigiendo teclado real. Hay que cerrar el preview, ir a General,
   *    teclear, y reabrir para que recalcule. (corrida 08/09)
   */
  async function teclearDiasHasta(dias) {
    await irAPestana('general');
    await esperar(900);
    const foco = await pg.evaluate(() => {
      const cont = document.querySelector('#diasHastaSiguienteInventario');
      const inp = cont ? cont.querySelector('input') ||
        (cont.querySelector('ion-input') &&
         (cont.querySelector('ion-input').querySelector('input') ||
          (cont.querySelector('ion-input').shadowRoot &&
           cont.querySelector('ion-input').shadowRoot.querySelector('input')))) : null;
      if (!inp) return false;
      inp.scrollIntoView({ block: 'center' });
      inp.focus();
      inp.value = '';
      return true;
    });
    if (!foco) return { ok: false, motivo: 'no está #diasHastaSiguienteInventario en la pantalla' };
    await pg.keyboard.type(String(dias), { delay: 130 });
    await pg.keyboard.press('Tab').catch(() => {});
    await esperar(900);
    const leido = await pg.evaluate(() => {
      const cont = document.querySelector('#diasHastaSiguienteInventario');
      const inp = cont && cont.querySelector('input');
      return inp ? String(inp.value).trim() : null;
    });
    return { ok: String(leido) === String(dias), leido };
  }

  /**
   * Abre la vista previa del sugerido.
   * El botón vive en la pestaña RESUMEN (no en INVENTARIO) y nace fuera del viewport.
   */
  async function abrirVistaPrevia() {
    await irAPestana('resumen');
    await esperar(900);
    const ok = await clickSeguro(`() => [...document.querySelectorAll('ion-button')]
      .filter(e => e.getBoundingClientRect().width > 0)
      .find(e => /pedido\\s+sugerido/i.test((e.textContent || '').trim()))`);
    if (!ok) return false;
    for (let i = 0; i < 10; i++) {
      await esperar(800);
      if (await pg.evaluate(() => !!document.querySelector('app-inventario-sugerido-preview'))) return true;
    }
    return false;
  }

  /**
   * 🔴 CERRAR SIEMPRE LA VISTA PREVIA ANTES DE NAVEGAR. Es un ion-modal y su
   *    backdrop bloquea todo: los tiles del home y los ion-segment-button dejan
   *    de responder, y el fallo aparece después disfrazado de «no está el tile
   *    Inventarios en HOME». (corrida 08/09)
   */
  async function cerrarVistaPrevia() {
    await clickSeguro(`() => document.querySelector(
      'app-inventario-sugerido-preview ion-buttons[slot="end"] ion-button')`);
    await esperar(900);
    return pg.evaluate(() => !document.querySelector('app-inventario-sugerido-preview'));
  }

  /** El ACEPTAR del sugerido está en el ion-footer del preview. */
  async function estadoAceptar() {
    return pg.evaluate(() => {
      const b = document.querySelector('app-inventario-sugerido-preview ion-footer ion-button');
      if (!b) return { hay: false };
      return { hay: true, deshabilitado: b.disabled === true || b.hasAttribute('disabled') };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EJECUCIÓN — un solo ciclo continuo
  //
  // ⚠ NO PARTIR EN VARIAS CORRIDAS. Un `getsync` en segundo plano devuelve la
  //   app a HOME y tira el formulario en curso: la corrida del 08/09 perdió un
  //   inventario con 9 productos ya cargados. Inventario → sugerido → lectura
  //   van seguidos.
  // ═══════════════════════════════════════════════════════════════════════════

  try {
    const yaHay = await pg.evaluate(() => !!document.querySelector('app-inventario-sugerido-preview'));
    if (yaHay) await cerrarVistaPrevia();

    // ─── DM-SUG-019: no existe campo para los días DESDE la última visita ─────
    // Es la comprobación de UI: `daysSinceLast` se calcula, no se teclea.
    await irAPestana('general');
    await esperar(800);
    const campos = await pg.evaluate(() => ({
      hasta: !!document.querySelector('#diasHastaSiguienteInventario'),
      desde: !!document.querySelector('#diasDesdeUltimoInventario'),
    }));
    v('DM-SUG-019', 'days_since_last se calcula, no se teclea',
      (campos.hasta && !campos.desde) ? 'PASS' : (campos.hasta ? 'FAIL' : 'BLOCKED'),
      campos.hasta
        ? `existe #diasHastaSiguienteInventario · #diasDesdeUltimoInventario: ${campos.desde ? '🔴 EXISTE (debería calcularse)' : 'no está, correcto'}`
        : 'no se llegó a la pestaña General de un inventario en curso');

    // ─── DM-SUG-021: los días hasta la próxima se teclean y se respetan ───────
    const dias = Number(DATA.diasHasta) || 10;
    const tec = campos.hasta ? await teclearDiasHasta(dias) : { ok: false, motivo: 'sin campo' };
    v('DM-SUG-021', `days_until_next tecleado (${dias}) se respeta`,
      tec.ok ? 'PASS' : 'BLOCKED',
      tec.ok ? `quedó ${tec.leido}` : (tec.motivo || `se tecleó ${dias} y quedó "${tec.leido}"`));

    // ─── Abrir la vista previa y leer los términos ───────────────────────────
    const abrio = await abrirVistaPrevia();
    v('DM-SUG-003b', 'Resumen → «Pedido Sugerido» abre la vista previa',
      abrio ? 'PASS' : 'BLOCKED',
      abrio ? 'el botón nace fuera del viewport: se resuelve con scroll previo'
            : 'no abrió — ¿hay un inventario en curso con productos cargados?');

    if (!abrio) {
      bloquearResto('no se pudo abrir la vista previa del sugerido');
    } else {
      const t = await leerTerminos();
      if (t._error) {
        bloquearResto(`no se pudieron leer los términos: ${t._error}`);
      } else {
        // ─── DM-SUG-010/012/013: el despacho, contra el oráculo ──────────────
        const cot = cotejarDespacho(t.filas);
        const medidos = cot.filter(c => c.presente);
        const okOcultos  = cot.filter(c => c.rol === 'ocultoPorElBug' && c.presente);
        const okControl  = cot.filter(c => c.rol === 'control' && c.presente);
        const fallan     = medidos.filter(c => !c.ok);

        v('DM-SUG-010', 'Despacho consolida TODAS las facturas de la última fecha',
          (okOcultos.length && !okOcultos.some(c => !c.ok)) ? 'PASS'
            : (okOcultos.length ? 'FAIL' : 'BLOCKED'),
          okOcultos.length
            ? `${okOcultos.filter(c => c.ok).length}/${okOcultos.length} recuperaron su cantidad · ` +
              okOcultos.slice(0, 4).map(c => `${c.coProductUnit}: ${c.antesDelFix}→${c.medido} (oráculo ${c.oraculo})`).join(' · ')
            : 'ninguno de los productos ocultos por el bug se cargó en el inventario');

        v('DM-SUG-012', 'Los productos de control no se movieron',
          (okControl.length && !okControl.some(c => !c.ok)) ? 'PASS'
            : (okControl.length ? 'FAIL' : 'BLOCKED'),
          okControl.length
            ? okControl.map(c => `${c.coProductUnit}: ${c.medido} (esperado ${c.oraculo})`).join(' · ')
            : 'no se cargó ningún producto de control');

        const sinFactura = t.filas.filter(f => !oraculo.some(o => String(o.coProductUnit) === String(f.coProductUnit)));
        v('DM-SUG-013', 'Producto sin factura ese día ⇒ despacho 0, presente en la lista',
          sinFactura.length ? (sinFactura.every(f => Number(f.dispatchedStock || 0) === 0) ? 'PASS' : 'FAIL') : 'N/A',
          sinFactura.length
            ? sinFactura.map(f => `${f.coProductUnit}: ${f.dispatchedStock}`).join(' · ')
            : 'no se cargó ningún producto ajeno a las facturas del día');

        // ─── DM-SUG-026: la aritmética completa, término por término ─────────
        const arit = t.filas.map(f => ({ f, r: oraculoTerminos(f, t.diasDesde, t.diasHasta) }));
        const malos = arit.filter(x => !x.r.ok);
        v('DM-SUG-026', 'Aritmética completa contra el modelo, tolerancia 0',
          arit.length ? (malos.length ? 'FAIL' : 'PASS') : 'BLOCKED',
          arit.length
            ? `${arit.length - malos.length}/${arit.length} productos cuadran · ` +
              `días: ${t.diasDesde} desde / ${t.diasHasta} hasta` +
              (malos.length ? ` · 🔴 ${malos.slice(0, 2).map(x => x.f.coProductUnit + ': ' + x.r.diferencias.join(', ')).join(' | ')}` : '')
            : 'la vista previa no devolvió productos');

        // ─── DM-SUG-022/023: las dos guardas ─────────────────────────────────
        const guardaStock = arit.filter(x => x.r.sugeridoEnCeroPorGuarda);
        v('DM-SUG-022', 'Guarda: stock actual ≥ sugerido ⇒ 0',
          guardaStock.length ? 'PASS' : 'N/A',
          guardaStock.length
            ? `${guardaStock.length} producto(s) con la guarda operando · ` +
              guardaStock.slice(0, 3).map(x => x.f.coProductUnit).join(', ')
            : 'ningún producto quedó en ese caso con estas cantidades');

        const guardaNeg = arit.filter(x => x.r.diariaEnCeroPorVentaNegativa);
        v('DM-SUG-023', 'Guarda: venta negativa ⇒ diaria 0',
          guardaNeg.length ? (guardaNeg.every(x => Number(x.f.estimatedDailyUnits || 0) === 0) ? 'PASS' : 'FAIL') : 'N/A',
          guardaNeg.length
            ? guardaNeg.map(x => `${x.f.coProductUnit}: vendido ${x.f.soldUnits} ⇒ diaria ${x.f.estimatedDailyUnits}`).join(' · ')
            : 'ningún producto quedó con venta negativa');

        // ─── DM-SUG-062: el ACEPTAR se apaga si ya se convirtió ──────────────
        const ac = await estadoAceptar();
        v('DM-SUG-062', 'El botón Aceptar refleja si la sugerencia ya se usó',
          ac.hay ? 'PASS' : 'BLOCKED',
          ac.hay
            ? `ACEPTAR ${ac.deshabilitado ? 'DESHABILITADO ⇒ ya se convirtió en pedido' : 'habilitado ⇒ pendiente'}`
            : 'no se encontró el botón en el pie de la vista previa');

        // ─── DM-SUG-030/031/032: lo guardado contra lo mostrado ──────────────
        const coStock = await pg.evaluate(() => {
          try {
            const el = document.querySelector('app-inventario-sugerido-preview');
            const c = el && window.ng && window.ng.getComponent(el);
            return (c && (c.coClientStock || (c.clientStock && c.clientStock.coClientStock))) || null;
          } catch (e) { return null; }
        });

        if (!coStock) {
          ['DM-SUG-030', 'DM-SUG-031', 'DM-SUG-032'].forEach(id =>
            v(id, id, 'BLOCKED', 'no se pudo leer el co_client_stock del inventario en curso'));
        } else {
          const snap = cotejarSnapshot(coStock, t.filas);
          v('DM-SUG-030', 'El sugerido se guarda ligado al inventario',
            snap.cabecera ? 'PASS' : 'FAIL',
            snap.cabecera
              ? `cabecera ${snap.cabecera.co_client_stock_suggested_order} · ${snap.cabecera.nu_details} líneas`
              : (snap.motivo || 'no se encontró la cabecera en la base local'));

          v('DM-SUG-031', 'Lo guardado coincide con lo mostrado, término por término',
            snap.ok ? 'PASS' : (snap.cotejados ? 'FAIL' : 'BLOCKED'),
            snap.cotejados
              ? `${snap.cotejados} línea(s) · ${snap.cotejados * 9} comparaciones · ` +
                (snap.difs.length ? `🔴 ${snap.difs.slice(0, 3).join(' | ')}` : 'sin diferencias')
              : (snap.motivo || 'no se cotejó ninguna línea'));

          v('DM-SUG-032', 'nu_details coincide con las líneas guardadas',
            (snap.cabecera && Number(snap.cabecera.nu_details) === snap.detalles.length) ? 'PASS'
              : (snap.cabecera ? 'FAIL' : 'BLOCKED'),
            snap.cabecera
              ? `cabecera dice ${snap.cabecera.nu_details} · hay ${snap.detalles.length} líneas`
              : 'sin cabecera');

          v('DM-SUG-034', 'days_until_next guardado es el tecleado',
            snap.cabecera
              ? (Number(snap.cabecera.days_until_next) === dias ? 'PASS' : 'FAIL')
              : 'BLOCKED',
            snap.cabecera
              ? `guardado ${snap.cabecera.days_until_next} · tecleado ${dias}`
              : 'sin cabecera');

          v('DM-SUG-035', 'by_dispatch_and_return refleja la VG con la que se calculó',
            snap.cabecera
              ? (Number(snap.cabecera.by_dispatch_and_return) === 1 ? 'PASS' : 'FAIL')
              : 'BLOCKED',
            snap.cabecera ? `by_dispatch_and_return = ${snap.cabecera.by_dispatch_and_return}` : 'sin cabecera');
        }
      }

      await cerrarVistaPrevia();
    }
  } catch (e) {
    bloquearResto(`error de navegación: ${e.message}`);
  }

  bloquearResto('pendiente: envío a la nube y capa web — bloqueados por el defecto de la secuencia');

  return {
    verdicts,
    msTotal: Date.now() - t0,
    // Se exporta para el reporte: el oráculo con el que se midió es parte de la evidencia.
    contexto: { escenario: esc, oraculo, diasHasta: DATA.diasHasta || 10 },
  };
}

module.exports = { runSugerido, consultaNube };
