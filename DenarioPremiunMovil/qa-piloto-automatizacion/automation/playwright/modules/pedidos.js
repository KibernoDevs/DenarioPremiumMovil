'use strict';

const { execFileSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { installPayloadCapture, getCapturedPayloads } = require('../../cdp/denario-cdp-helpers');
const { reqInicio, reqRechazo, reqPestanaRoja, reqIds, conReq } = require('../req-enviar');

const LOCAL_QUERY_PATH    = path.resolve(__dirname, '../../db/local-query.js');
const NUBE_QUERY_PATH     = path.resolve(__dirname, '../../db/query.js');
const COTEJO_PAYLOAD_PATH = path.resolve(__dirname, '../../db/cotejo-payload.js');

/**
 * Consulta la BD en la NUBE del cliente. Devuelve las filas o null.
 *
 * 🔑 GUARDAR ES LOCAL, ENVIAR ES LO ÚNICO QUE POSTEA. Hasta ahora DM-PED-031
 *    daba PASS con «volvió al home», que es mirar la pantalla, no el resultado:
 *    la app puede volver al home y el pedido no haber salido del equipo. El
 *    oráculo bueno es la FILA EN LA NUBE, encontrada por el comentario único de
 *    la corrida.
 */
function consultaNube(slug, sql) {
  if (!slug) return null;
  try {
    return JSON.parse(
      execFileSync('node', [NUBE_QUERY_PATH, slug, sql], { encoding: 'utf8', timeout: 30000 })
    );
  } catch (_) { return null; }
}

function localQuery(sql) {
  try {
    return JSON.parse(
      execFileSync('node', [LOCAL_QUERY_PATH, sql], { encoding: 'utf8', timeout: 15000 })
    );
  } catch (_) { return []; }
}

function cotejoPayload(slug, payload) {
  const tmp = path.join(os.tmpdir(), `qa_ped_payload_${Date.now()}.json`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(payload));
    const r = JSON.parse(
      execFileSync('node', [COTEJO_PAYLOAD_PATH, slug, tmp], { encoding: 'utf8', timeout: 30000 })
    );
    const mis = ((r.resumen || {}).mismatches || []).slice(0, 2).join('; ');
    return r.marca + (mis ? ` (${mis})` : '');
  } catch (_) { return 'BD-N/A'; }
  finally { try { fs.unlinkSync(tmp); } catch (_) {} }
}

/**
 * Convierte un importe con formato venezolano a número.
 *   "2.737,61 BSD" → 2737.61   ·   "US$ 3,1453" → 3.1453   ·   "0,00" → 0
 * Devuelve null si no hay ningún número reconocible (no 0: un 0 real y un
 * "no se pudo leer" son cosas distintas y confundirlos falsea los cotejos).
 */
function parseMonto(txt) {
  if (txt === null || txt === undefined) return null;
  const m = String(txt).match(/-?\d[\d.]*(?:,\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * modules/pedidos.js — smoke + regresión de PEDIDOS
 *
 * Base: automation/smoke/smoke-pedidos.md (DM-PED-001…037)
 * Selectores y trampas: automation/cdp/module-selectors/pedidos.md
 * REQ «Botón Enviar»: ../req-enviar.js
 *
 * ── Por qué este módulo se lee distinto a los otros ──────────────────────────
 * PEDIDOS es el módulo con MÁS divergencia entre builds y entre clientes. El
 * archivo de selectores registra, entre otras:
 *   · 3 variantes del árbol de productos (anidado / ion-accordion / drill-down)
 *   · el catálogo se filtra por (lista de precios × MONEDA) y puede quedar vacío
 *   · las etiquetas de los alerts cambian de caja DENTRO de la misma corrida
 *   · el nº de selects del panel de línea ES el mapa de VGs (su ausencia informa)
 * ⇒ La estrategia aquí es **detectar en runtime y ramificar**, nunca asumir.
 *
 * ── Descuentos e IVA: se valida CONFORMIDAD, no presencia ────────────────────
 * Los 4 escapes de la v21 pasaron por comprobar que un control EXISTÍA sin
 * comprobar que hacía lo que la configuración dice. Aquí, cuando el cliente
 * tiene descuento por producto / descuento global / IVA, no basta con que el
 * selector aparezca: se aplica y se verifica que **el Tab Total cambie en la
 * magnitud correcta**.
 *
 * @param {import('playwright').Page} pg
 * @param {{ aplica:boolean, clienteSlug:string, clienteTest:string,
 *           productoTest:string, monedaPedido:string, alertaDeudaVencida:boolean,
 *           userCanSelectProductDiscount:boolean, userCanSelectGlobalDiscount:boolean,
 *           userCanSelectIVA:boolean, multiCurrency:boolean }} DATA
 */
async function runPedidos(pg, DATA) {
  const t0 = Date.now();
  const verdicts = [];

  function v(id, desc, resultado, nota = '') {
    verdicts.push({ id, descripcion: desc, resultado, nota, ms: Date.now() - t0 });
  }
  const reqV = (r) => v(r.id, r.descripcion, r.resultado, r.nota);

  const SMOKE = [
    'DM-PED-001','DM-PED-002','DM-PED-006','DM-PED-015','DM-PED-017',
    'DM-PED-024','DM-PED-026','DM-PED-029','DM-PED-030','DM-PED-031',
    'DM-PED-032','DM-PED-034','DM-PED-035','DM-PED-037',
  ];
  // Casos condicionales: dependen de las VG del cliente. NO se dan por N/A desde
  // el YAML — se resuelven leyendo la UI, que es la que manda (ver difranca:
  // el perfil declaraba orderEnterpriseEnabled=false y la UI lo traía en true).
  const COND = [
    'DM-PED-VG-001',   // mapa de VGs de cabecera (7 selects del Tab General)
    'DM-PED-VG-002',   // mapa de VGs de línea (hasta 5 selects del panel)
    'DM-PED-DSC-001',  // descuento POR PRODUCTO aplica y baja el total
    'DM-PED-DSC-002',  // descuento GLOBAL aplica y baja el total
    'DM-PED-IVA-001',  // IVA de línea se refleja en el Tab Total
    'DM-PED-TOT-001',  // aritmética del Tab Total: Base − Desc + IVA = Total
  ];
  const TODOS = [...SMOKE, ...COND, ...reqIds('PED')];

  if (!DATA.aplica) {
    TODOS.forEach(id => v(id, id, 'N/A', 'aplica=false en perfil pedidos'));
    return { verdicts, msTotal: Date.now() - t0 };
  }

  try { await installPayloadCapture(pg); } catch (_) {}

  const ts         = String(Date.now()).slice(-6);
  const comentTest = `Test-PED-${ts}`;

  // ══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════════════

  // ── Visibilidad real ────────────────────────────────────────────────────
  // 🔴 Ionic NO desmonta las páginas: las deja en el DOM con `.ion-page-hidden`.
  //    `document.querySelector('app-pedidos')` devuelve el nodo aunque estemos
  //    dentro del formulario ⇒ comprobar PRESENCIA da "ya estamos en el home"
  //    y el guion se queda esperando algo que nunca va a aparecer.
  //    Se inyecta como texto para poder reusarla dentro de los pg.evaluate.
  const FN_VIS = `(el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 && r.width <= 0) return false;
    const p = el.closest('.ion-page');
    return !p || !p.classList.contains('ion-page-hidden');
  }`;

  /** ¿Está visible de verdad el primer nodo que matchea el selector? */
  async function visible(sel) {
    return await pg.evaluate(([s, fn]) => {
      const vis = eval(fn);
      return vis(document.querySelector(s));
    }, [sel, FN_VIS]);
  }

  async function dismissIonLoadings() {
    await pg.evaluate(() => {
      document.querySelectorAll('ion-loading').forEach(el => {
        if (el.offsetParent !== null) try { el.dismiss(); } catch (_) {}
      });
    });
  }

  /** Lee la alerta visible: título, mensaje y etiquetas de botones. */
  async function alertInfo() {
    return await pg.evaluate(() => {
      const vis = el => el && el.getBoundingClientRect().width > 0;
      // 🔴 UNA ion-alert DESCARTADA SIGUE EN EL DOM (overlay-hidden / display:none).
      //    En una corrida se acumulan 15 o más. El filtro anterior aceptaba
      //    cualquiera «con un botón medible», así que un cadáver podía hacerse
      //    pasar por la alerta viva y se pulsaba un botón fantasma mientras la
      //    de verdad seguía abierta. `offsetParent !== null` es el discriminador:
      //    un elemento con display:none lo tiene a null.
      const al = [...document.querySelectorAll('ion-alert')].filter(a =>
        a.offsetParent !== null &&
        !a.classList.contains('overlay-hidden') &&
        [...a.querySelectorAll('.alert-button')].some(vis)
      ).pop();
      if (!al) return null;
      return {
        titulo:  ((al.querySelector('.alert-title')   || {}).textContent || '').trim(),
        mensaje: ((al.querySelector('.alert-message') || {}).textContent || '').trim(),
        botones: [...al.querySelectorAll('.alert-button')].filter(vis).map(b => b.textContent.trim()),
      };
    });
  }

  /**
   * Pulsa un botón de alerta por igualdad EXACTA en minúsculas.
   * 🔴 Las etiquetas cambiaron de caja DENTRO de la misma corrida en difranca
   *    (ACEPTAR vs Aceptar): comparar contra 'Aceptar' literal devuelve null y
   *    se lee como «el alert no tiene botones».
   * 🔴 Y nunca por `includes`: /desc/i matchea "SIN DESCUENTO".
   */
  async function clickAlertBtn(labels = ['aceptar', 'ok']) {
    await pg.waitForTimeout(700);
    await dismissIonLoadings();
    const coords = await pg.evaluate((lbls) => {
      const vis = el => el && el.getBoundingClientRect().width > 0;
      // Misma regla que en alertInfo(): las alertas muertas siguen en el DOM.
      const al = [...document.querySelectorAll('ion-alert')].filter(a =>
        a.offsetParent !== null &&
        !a.classList.contains('overlay-hidden') &&
        [...a.querySelectorAll('.alert-button')].some(vis)
      ).pop();
      if (!al) return null;
      const bts = [...al.querySelectorAll('.alert-button')].filter(vis);
      for (const l of lbls) {
        const b = bts.find(x => x.textContent.trim().toLowerCase() === l.toLowerCase());
        if (b) { const r = b.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: b.textContent.trim() }; }
      }
      return null;
    }, labels);
    if (!coords) throw new Error(`Alert btn no encontrado: ${labels.join('/')}`);
    await pg.mouse.click(coords.x, coords.y, { delay: 60 });
    await pg.waitForTimeout(900);

    // 🔴 EL PRIMER CLIC SOBRE EL BOTÓN DE UNA ion-alert PUEDE CAER EN EL
    //    ION-BACKDROP. No da error: simplemente la alerta no se cierra — y como
    //    su backdrop tapa la pantalla, TODO lo que venga después parece «pulsé y
    //    no pasó nada». Fue lo que tumbó las vueltas 5 y 7 de PEDIDOS: la
    //    confirmación de deuda vencida se quedaba abierta, el cliente no se
    //    asignaba y caían 20 casos con «sin cliente no hay transacción».
    //    Si la alerta sigue viva, se reintenta — y por DOM, que es lo único que
    //    atraviesa el backdrop.
    for (let intento = 0; intento < 3; intento++) {
      const sigue = await pg.evaluate((lbl) => {
        const vis = el => el && el.getBoundingClientRect().width > 0;
        const al = [...document.querySelectorAll('ion-alert')].filter(a =>
          a.offsetParent !== null &&
          !a.classList.contains('overlay-hidden') &&
          [...a.querySelectorAll('.alert-button')].some(vis)
        ).pop();
        if (!al) return { viva: false };
        const b = [...al.querySelectorAll('.alert-button')].filter(vis)
          .find(x => x.textContent.trim().toLowerCase() === String(lbl).toLowerCase());
        if (!b) return { viva: true, sinBoton: true };
        const r = b.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const en = document.elementFromPoint(x, y);
        const tapado = !!(en && /ION-BACKDROP/i.test(en.tagName));
        // Por DOM siempre: si estaba tapado, es la única vía; y si no, no estorba.
        b.click();
        return { viva: true, tapado };
      }, coords.label);
      if (!sigue.viva) break;
      await pg.waitForTimeout(900);
    }
    return coords.label;
  }

  /** Cierra cualquier alerta que haya quedado abierta. No falla si no hay. */
  async function limpiarAlertas(max = 3) {
    for (let i = 0; i < max; i++) {
      const a = await alertInfo();
      if (!a) return i;
      try { await clickAlertBtn(['ok', 'aceptar', 'cancelar']); } catch (_) { return i; }
    }
    return max;
  }

  /**
   * Click en un botón del home del módulo (PEDIDO / BUSCAR / COPIAR).
   * 🔴 Son `ion-button.colorBorderBuscar`, NO `p.nombreModulos` (esa convención
   *    es de app-home y revienta con `.closest de undefined`).
   * 🔴 Filtrar por height>0, NO por offsetParent: al volver del form los botones
   *    quedan con offsetParent=null un instante.
   */
  async function clickBotonHome(texto) {
    const coords = await pg.evaluate((t) => {
      const bs = [...document.querySelectorAll('app-pedidos ion-button, ion-button')].filter(b =>
        b.getBoundingClientRect().height > 0 &&
        b.textContent.trim().toUpperCase() === t.toUpperCase());
      if (!bs.length) return null;
      const r = bs[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, texto);
    if (!coords) {
      const diag = await pg.evaluate(() => [...document.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().height > 0)
        .map(b => b.textContent.trim().slice(0, 22)).slice(0, 12));
      throw new Error(`Botón "${texto}" no encontrado — visibles: ${JSON.stringify(diag)}`);
    }
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
  }

  /** ¿En qué ruta estamos? Sirve para el reintento del botón PEDIDO. */
  const rutaActual = () => pg.evaluate(() => location.href);

  /**
   * Abre el formulario de pedido.
   * 🔴 El botón PEDIDO puede no navegar al 1er click volviendo de /pedidosLista
   *    (alipascua): verificar la ruta y reintentar UNA vez.
   * 🔴 Con userMustActivateGPS el router.navigate cuelga del getCurrentPosition:
   *    el click parece muerto hasta 30 s. Techo de espera 120 s (RUNTIME §3).
   */
  async function abrirFormPedido() {
    for (let intento = 0; intento < 2; intento++) {
      await clickBotonHome('PEDIDO');
      const limite = Date.now() + (intento === 0 ? 60000 : 60000);
      while (Date.now() < limite) {
        await pg.waitForTimeout(1000);
        const ok = await visible('app-pedido');
        if (ok) { await pg.waitForTimeout(800); return true; }
      }
      const r = await rutaActual();
      if (/\/pedido$/.test(r)) return true;
    }
    return false;
  }

  /** Estado del componente app-pedido sin tocar el DOM (requiere window.ng). */
  async function estadoComponente() {
    return await pg.evaluate(() => {
      try {
        if (!window.ng) return { ng: false };
        const c = window.ng.getComponent(document.querySelector('app-pedido'));
        if (!c) return { ng: true, comp: false };
        return {
          ng: true, comp: true,
          hasClient:    !!c.hasClient,
          lockSegments: c.lockSegments,
          lineas:       c.orderServ && c.orderServ.carrito ? c.orderServ.carrito.length : null,
          listaPrecios: c.listaAnterior ? c.listaAnterior.coList : null,
          moneda:       c.monedaSeleccionada ? c.monedaSeleccionada.coCurrency : null,
        };
      } catch (e) { return { ng: true, error: e.message }; }
    });
  }

  /** Tabs del formulario + estado disabled. */
  async function leerTabs() {
    return await pg.evaluate(() => [...document.querySelectorAll('app-pedido ion-segment-button')]
      .filter(s => s.getBoundingClientRect().width > 0)
      .map(s => ({
        nombre: s.textContent.trim(),
        valor: s.value,
        disabled: s.disabled === true || s.classList.contains('segment-button-disabled'),
      })));
  }

  async function clickTab(nombre) {
    const coords = await pg.evaluate((n) => {
      const s = [...document.querySelectorAll('app-pedido ion-segment-button')]
        .filter(x => x.getBoundingClientRect().width > 0)
        .find(x => x.textContent.trim().toLowerCase().includes(n.toLowerCase()));
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, nombre);
    if (!coords) throw new Error(`Tab "${nombre}" no encontrada`);
    await pg.mouse.click(coords.x, coords.y, { delay: 60 });
    await pg.waitForTimeout(1400);
  }

  /**
   * Selecciona el cliente.
   * Vía 1 (barata): `setClientfromSelector` — funciona en latino_cosmetica y
   *   difranca, NO en globalmp. Se prueba primero y se comprueba el resultado.
   * Vía 2: modal real → paginar con onIonInfinite + ng.applyChanges (sin el
   *   applyChanges el modelo crece pero el DOM se queda en 50 y el ítem devuelve
   *   null: el falso negativo «el cliente no existe») → click al 35 %/35 %.
   */
  async function seleccionarCliente(busqueda) {
    // ── Paso 0: cargar el MODELO hasta tener el cliente ────────────────────
    // 🔴 El selector trae 50 de N y los ordena por DEUDA (`oderByDueDateAndSaldo`),
    //    no alfabéticamente: un cliente sin documentos vencidos se hunde al final
    //    de la cartera. Con 783 clientes, buscar solo en los 50 cargados devuelve
    //    "no está" y se lee como si el dato del perfil fuera malo.
    //    Paginar el modelo ANTES de intentar nada es más barato y más fiable que
    //    paginar el DOM, y deja a `setClientfromSelector` con el cliente a mano.
    const carga = await pg.evaluate(async (q) => {
      const norm = s => String(s || '').toUpperCase();
      const buscar = (arr) => arr.find(x =>
        norm(x.coClient) === norm(q) || norm(x.nuRif) === norm(q) ||
        norm(x.naClient).includes(norm(q)));
      try {
        if (!window.ng) return { ok: false, motivo: 'sin window.ng' };
        const c = window.ng.getComponent(document.querySelector('app-pedido'));
        if (!c) return { ok: false, motivo: 'sin componente app-pedido' };
        const sc = c.selectorCliente;
        if (!sc || !Array.isArray(sc.clientes)) return { ok: false, motivo: 'sin selectorCliente.clientes' };

        let rondas = 0;
        while (!buscar(sc.clientes) && sc.scrollDisable !== true && rondas < 30) {
          const antes = sc.clientes.length;
          await sc.onIonInfinite({ target: { complete() {} } });
          // 🔴 Sin applyChanges el modelo crece pero el DOM se queda: pg.evaluate
          //    corre fuera de NgZone y Angular no detecta el cambio.
          window.ng.applyChanges(sc);
          rondas++;
          if (sc.clientes.length === antes) break;   // la cartera se agotó
        }
        const cli = buscar(sc.clientes);
        return {
          ok: !!cli, rondas, cargados: sc.clientes.length,
          agotada: sc.scrollDisable === true,
          motivo: cli ? null : `no aparece entre los ${sc.clientes.length} cargados tras ${rondas} ronda(s)`,
          muestra: sc.clientes.slice(0, 3).map(x => x.coClient).join(', '),
        };
      } catch (e) { return { ok: false, motivo: e.message }; }
    }, busqueda);
    if (carga.rondas) await pg.waitForTimeout(1200);

    // ── Vía 1: asignación por componente ───────────────────────────────────
    const via1 = await pg.evaluate(async (q) => {
      try {
        if (!window.ng) return { ok: false, motivo: 'sin window.ng' };
        const c = window.ng.getComponent(document.querySelector('app-pedido'));
        if (!c || typeof c.setClientfromSelector !== 'function') return { ok: false, motivo: 'sin setClientfromSelector' };
        const sc = c.selectorCliente;
        if (!sc || !Array.isArray(sc.clientes)) return { ok: false, motivo: 'sin lista de clientes' };
        const norm = s => String(s || '').toUpperCase();
        const cli = sc.clientes.find(x =>
          norm(x.coClient) === norm(q) || norm(x.nuRif) === norm(q) ||
          norm(x.naClient).includes(norm(q)));
        if (!cli) return { ok: false, motivo: `no está en los ${sc.clientes.length} cargados` };
        c.setClientfromSelector(cli);
        window.ng.applyChanges(c);
        return { ok: true, nombre: cli.naClient, total: sc.clientes.length };
      } catch (e) { return { ok: false, motivo: e.message }; }
    }, busqueda);

    if (via1.ok) {
      // 🔴 `setClientfromSelector` NO asigna el cliente por sí solo: encola una
      //    CONFIRMACIÓN — «Este cliente tiene deuda vencida, ¿Desea continuar con el
      //    pedido?» con Cancelar/Aceptar — y el cliente solo se asigna al Aceptar.
      //
      //    Con una espera FIJA de 1,5 s el diálogo a veces no había pintado aún:
      //    `alertInfo()` devolvía null, no se pulsaba nada, y el módulo se iba a la
      //    «Vía 2» con la alerta viva — cuyo backdrop se come todos los clics. El
      //    síntoma era «vía componente: ok pero sin efecto» y **23 casos a BLOCKED**
      //    (4K, 14/09). Medido: el diálogo tarda más de 1,5 s en aparecer.
      //
      //    Ahora se ESPERA a que salga, en vez de suponer cuánto tarda.
      //    🔴 Y EL ORÁCULO DE «YA ESTÁ PUESTO» NO PUEDE SER EL INPUT.
      //    `#clienteSelect` se rellena de forma OPTIMISTA — muestra el nombre
      //    mientras la confirmación sigue pendiente — así que salir del bucle al
      //    verlo lleno dejaba la alerta sin aceptar y el cliente sin asignar:
      //    input = «EURO REPUESTOS FIOVAL, C.A. (C.0010)» pero `hasClient: false`,
      //    `lockSegments: true`, 1 pestaña libre. **20 casos a BLOCKED otra vez.**
      //    El único oráculo bueno es el MODELO: `hasClient`.
      const clienteEnModelo = () => pg.evaluate(() => {
        try {
          const c = window.ng.getComponent(document.querySelector('app-pedido'));
          return !!(c && c.hasClient === true);
        } catch (_) { return false; }
      });
      //    🔴 Y SE ACEPTA **CUALQUIER** DIÁLOGO VIVO, no solo el de deuda vencida.
      //    Filtrar por texto ya falló: mientras `hasClient` sea false, cualquier
      //    diálogo que esté en pantalla está impidiendo la asignación, y su
      //    backdrop bloquea todo lo demás. Se acepta y se APUNTA su texto, para
      //    que el veredicto diga cuál salió en vez de dejarlo a la imaginación.
      //    ⚠ Se pulsa siempre el botón afirmativo, NUNCA Cancelar (descarta el cliente).
      const confirmadas = [];
      for (let i = 0; i < 20; i++) {
        if (await clienteEnModelo()) break;
        const a = await alertInfo();
        if (a) {
          confirmadas.push(`${(a.mensaje || a.titulo).slice(0, 45)} [${a.botones.join('/')}]`);
          const afirmativo = a.botones.find(b => /aceptar|^ok$|^sí$|^si$|continuar/i.test(b));
          if (afirmativo) {
            await clickAlertBtn([afirmativo]).catch(() => {});
          } else {
            // Sin botón afirmativo reconocible: se pulsa el ÚLTIMO por DOM, que en
            // Ionic es el de confirmar. Por DOM, que atraviesa el backdrop.
            await pg.evaluate(() => {
              const vis = el => el && el.getBoundingClientRect().width > 0;
              const al = [...document.querySelectorAll('ion-alert')]
                .filter(x => x.offsetParent !== null && [...x.querySelectorAll('.alert-button')].some(vis)).pop();
              if (!al) return;
              const bts = [...al.querySelectorAll('.alert-button')].filter(vis);
              if (bts.length) bts[bts.length - 1].click();
            });
          }
          await pg.waitForTimeout(1300);
          continue;   // puede encadenar otro aviso
        }
        await pg.waitForTimeout(500);
      }
      // Último recurso: si tras el bucle el modelo sigue sin cliente y queda una
      // alerta abierta, se acepta POR DOM. Es la única vía que atraviesa el
      // backdrop, y sin ella la pantalla queda bloqueada para todo lo demás.
      if (!(await clienteEnModelo())) {
        await pg.evaluate(() => {
          const vis = el => el && el.getBoundingClientRect().width > 0;
          const al = [...document.querySelectorAll('ion-alert')].filter(a =>
            [...a.querySelectorAll('.alert-button')].some(vis)).pop();
          if (!al) return;
          const bts = [...al.querySelectorAll('.alert-button')].filter(vis);
          const b = bts.find(x => /aceptar|^ok$|^sí$|^si$|continuar/i.test(x.textContent.trim()));
          if (b) b.click();
        });
        await pg.waitForTimeout(2000);
      }
      await pg.waitForTimeout(1200);
      const puesto = await pg.evaluate(() => {
        const i = document.querySelector('ion-input#clienteSelect');
        const n = i && (i.querySelector('input') || (i.shadowRoot && i.shadowRoot.querySelector('input')));
        return n ? n.value : '';
      });
      // 🔴 Y el «vale, ya está» tampoco puede ser el input: si la confirmación
      //    no llegó a aceptarse, el input muestra el nombre y el modelo NO tiene
      //    cliente. Se exige `hasClient` antes de dar la vía por buena; si no,
      //    se cae a la Vía 2 (modal real) en vez de seguir como si nada.
      const asignado = await clienteEnModelo();
      if (asignado && puesto && !/seleccione/i.test(puesto)) {
        // El modal puede quedar residual aunque la vía programática funcione
        await pg.evaluate(async () => {
          for (const m of document.querySelectorAll('ion-modal.show-modal')) {
            try { await m.dismiss(null, 'cancel'); } catch (_) {}
          }
        });
        return { via: 'componente', nombre: puesto.trim(), cargados: carga.cargados, rondas: carga.rondas,
                 confirmaciones: confirmadas };
      }
    }

    // ── Vía 2: modal real ──────────────────────────────────────────────────
    const inpCoords = await pg.evaluate(() => {
      const i = document.querySelector('ion-input#clienteSelect');
      if (!i) return null;
      const r = i.getBoundingClientRect();
      return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    });
    if (inpCoords) {
      await pg.mouse.click(inpCoords.x, inpCoords.y, { delay: 80 });
      await pg.waitForTimeout(2200);
    }

    // Paginar hasta que el ítem aparezca o se agote la cartera.
    // 🔴 El techo tiene que dar para la cartera ENTERA: con 783 clientes y
    //    páginas de 50, cuatro rondas cubren 200 y el cliente "no existe".
    //    Si el paso 0 ya cargó el modelo, esto sale al primer intento.
    for (let ronda = 0; ronda < 30; ronda++) {
      const hallado = await pg.evaluate((q) => {
        const norm = s => String(s || '').toUpperCase();
        const items = [...document.querySelectorAll('ion-modal.show-modal ion-item')]
          .filter(i => i.getBoundingClientRect().width > 0);
        const t = items.find(i => norm(i.textContent).includes(norm(q)));
        if (!t) return { n: items.length, ok: false };
        t.scrollIntoView({ block: 'center' });
        return { n: items.length, ok: true };
      }, busqueda);

      if (hallado.ok) {
        await pg.waitForTimeout(500);
        // 🔴 click al 35 % ancho / 35 % alto: el centro puede caer en "Más detalles"
        const c = await pg.evaluate((q) => {
          const norm = s => String(s || '').toUpperCase();
          const t = [...document.querySelectorAll('ion-modal.show-modal ion-item')]
            .filter(i => i.getBoundingClientRect().width > 0)
            .find(i => norm(i.textContent).includes(norm(q)));
          if (!t) return null;
          const r = t.getBoundingClientRect();
          return { x: r.left + r.width * 0.35, y: r.top + r.height * 0.35 };
        }, busqueda);
        if (!c) break;
        await pg.mouse.click(c.x, c.y, { delay: 80 });
        await pg.waitForTimeout(2000);
        break;
      }

      // 🔴 paginar SIN applyChanges deja el DOM en 50 y produce el falso negativo
      const pagino = await pg.evaluate(async () => {
        try {
          const c = window.ng.getComponent(document.querySelector('app-pedido'));
          const sc = c.selectorCliente;
          if (!sc || sc.scrollDisable === true) return false;
          await sc.onIonInfinite({ target: { complete() {} } });
          window.ng.applyChanges(sc);
          return true;
        } catch (_) { return false; }
      });
      if (!pagino) break;
      await pg.waitForTimeout(1400);
    }

    // Alert de deuda vencida (hasta 3 intentos: el 1.er click puede no tomar)
    for (let i = 0; i < 3; i++) {
      const a = await alertInfo();
      if (!a) break;
      if (!/deuda|vencid|continuar/i.test(`${a.titulo} ${a.mensaje}`)) break;
      try { await clickAlertBtn(['aceptar', 'ok']); } catch (_) {}
      await pg.waitForTimeout(1500);
    }
    await pg.evaluate(async () => {
      for (const m of document.querySelectorAll('ion-modal.show-modal')) {
        try { await m.dismiss(null, 'cancel'); } catch (_) {}
      }
    });
    await pg.waitForTimeout(1000);

    const puesto = await pg.evaluate(() => {
      const i = document.querySelector('ion-input#clienteSelect');
      const n = i && (i.querySelector('input') || (i.shadowRoot && i.shadowRoot.querySelector('input')));
      return n ? n.value : '';
    });
    if (!puesto || /seleccione/i.test(puesto)) {
      throw new Error(
        `El cliente "${busqueda}" no quedó seleccionado · ` +
        `modelo: ${carga.cargados} cargado(s) en ${carga.rondas} ronda(s)` +
        `${carga.agotada ? ' (cartera agotada)' : ' (quedaban más por cargar)'}` +
        `${carga.ok ? ', y SÍ estaba en el modelo' : `, ${carga.motivo}`} · ` +
        `vía componente: ${via1.motivo || 'ok pero sin efecto'} · ` +
        `primeros códigos: ${carga.muestra || '—'}`);
    }
    return { via: 'modal', nombre: puesto.trim(), cargados: carga.cargados, rondas: carga.rondas };
  }

  /**
   * Espera a que las tabs habiliten.
   * 🔴 Habilitan 2-4 s DESPUÉS de que lockSegments pase a false: el snapshot
   *    inmediato muestra hasClient=true, lockSegments=false y las tabs todavía
   *    disabled. No marcar FAIL en el primer vistazo.
   * 🔴 Si `#nuPurchase` es required (validateNuOrder), lockSegments NO baja
   *    hasta llenarlo — y eso se lee como «las tabs no habilitan».
   */
  async function esperarTabsHabilitadas(timeoutMs = 25000) {
    const limite = Date.now() + timeoutMs;
    let ultimo = null;
    while (Date.now() < limite) {
      const tabs = await leerTabs();
      const libres = tabs.filter(t => !t.disabled).length;
      ultimo = { tabs, libres };
      if (libres >= 3) return ultimo;
      // ¿nos está frenando el Nro. de orden obligatorio?
      const bloqueo = await pg.evaluate(() => {
        const i = document.querySelector('ion-input#nuPurchase');
        if (!i) return null;
        const n = i.querySelector('input') || (i.shadowRoot && i.shadowRoot.querySelector('input'));
        const req = i.getAttribute('required') !== null || (n && n.required);
        const val = n ? n.value : '';
        return req && !val ? 'nuPurchase' : null;
      });
      if (bloqueo === 'nuPurchase') {
        await fillIonInput('ion-input#nuPurchase', `QA-${ts}`);
        await pg.waitForTimeout(1500);
      }
      await pg.evaluate(() => { try { window.ng.applyChanges(window.ng.getComponent(document.querySelector('app-pedido'))); } catch (_) {} });
      await pg.waitForTimeout(1200);
    }
    return ultimo;
  }

  /** Escribe en un ion-input disparando los eventos que Angular escucha. */
  async function fillIonInput(sel, valor) {
    const ok = await pg.evaluate(([s, val]) => {
      const host = document.querySelector(s);
      if (!host) return false;
      const el = host.querySelector('input') || (host.shadowRoot && host.shadowRoot.querySelector('input'));
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, String(val));
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      host.dispatchEvent(new CustomEvent('ionInput',  { bubbles: true, detail: { value: String(val) } }));
      host.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: String(val) } }));
      host.dispatchEvent(new CustomEvent('ionBlur',   { bubbles: true }));
      return true;
    }, [sel, valor]);
    await pg.waitForTimeout(500);
    return ok;
  }

  /**
   * Detecta cuál de las 3 variantes de árbol trae este build.
   *   'accordion'  → ion-accordion-group presente: productos = ion-accordion
   *   'drilldown'  → sin accordions en el nivel de categoría; el click NAVEGA
   *   'anidado'    → build viejo: el click inyecta ion-item hermanos
   */
  async function detectarArbol() {
    return await pg.evaluate(() => {
      const grupos = document.querySelectorAll('app-pedido ion-accordion-group').length;
      const accs   = document.querySelectorAll('app-pedido ion-accordion').length;
      const cats   = [...document.querySelectorAll('app-pedido ion-item.listaItems')]
        .filter(i => i.getBoundingClientRect().height > 0).length;
      if (grupos > 0 || accs > 0) return { variante: 'accordion', grupos, accs, cats };
      if (cats > 0) return { variante: 'drilldown-o-anidado', grupos, accs, cats };
      return { variante: 'desconocida', grupos, accs, cats };
    });
  }

  // Nodos del árbol. 🔴 El selector NO puede ceñirse a `.listaItems`: esa clase
  // la llevan las CATEGORÍAS, y los productos, según el build, son `ion-accordion`
  // o `ion-item` con otra clase. Se recogen los tres y se clasifican por CONTENIDO
  // (declara "Código:" ⇒ es un producto), que es lo único estable entre builds.
  const SEL_NODOS = 'app-pedido ion-accordion, app-pedido ion-item';

  /** Lista los nodos que HOY se ven en el árbol, con su código si lo declaran. */
  async function nodosArbol() {
    return await pg.evaluate(([fn, sel]) => {
      const vis = eval(fn);
      const nodos = [...document.querySelectorAll(sel)].filter(vis);
      return nodos.map((n, i) => {
        const txt = (n.textContent || '').replace(/\s+/g, ' ').trim();
        // 🔴 El textContent corre pegado: "Código: ACPDT300Precio: 43.681,39".
        //    Capturar HASTA la etiqueta siguiente e incluir el punto, o "1.5LTS"
        //    se trunca a "1". Un lookahead tras el código falla siempre (la "P").
        const m = txt.match(/Código:\s*([A-Za-z0-9.\-]+?)\s*Precio/);
        return {
          i,
          codigo: m ? m[1] : null,
          esProducto: !!m,
          // Una categoría rotula "NOMBRE <n>" y no declara código.
          esCategoria: !m && /\s\d+$/.test(txt) && txt.length < 60,
          txt: txt.slice(0, 80),
          tag: n.tagName.toLowerCase(),
        };
      });
    }, [FN_VIS, SEL_NODOS]);
  }

  /** Escribe en el buscador de productos, si está disponible en este nivel. */
  async function usarBuscador(codigo) {
    const icono = await pg.evaluate((fn) => {
      const vis = eval(fn);
      const i = [...document.querySelectorAll('app-pedido ion-icon[name="search-circle-sharp"]')].filter(vis)[0];
      if (!i) return null;
      const r = i.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, FN_VIS);
    if (icono) { await pg.mouse.click(icono.x, icono.y, { delay: 80 }); await pg.waitForTimeout(1300); }
    const escrito = await pg.evaluate((cod) => {
      const inp = document.querySelector('input.search-input.inputsSearch, input.inputsSearch');
      if (!inp) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, cod);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
      return true;
    }, codigo);
    if (!escrito) return false;
    await pg.keyboard.press('Enter').catch(() => {});
    await pg.waitForTimeout(2200);
    return true;
  }

  /**
   * Carga más productos en el nivel actual.
   * 🔴 Los niveles de producto paginan (`quPageProduct=50`): la categoría "SKY 132"
   *    muestra 50 de 132 y un código que viva en la 2.ª página simplemente "no
   *    existe". Se hace scroll al fondo del ion-content para disparar el infinite
   *    scroll de forma natural — no depende del nombre del componente, que cambia
   *    entre builds (en este no existe `productos-tab-order-product-list`).
   */
  async function paginarNivel() {
    const antes = (await nodosArbol()).length;
    await pg.evaluate((fn) => {
      const vis = eval(fn);
      const cont = [...document.querySelectorAll('app-pedido ion-content')].filter(vis)[0];
      if (cont && typeof cont.scrollToBottom === 'function') { cont.scrollToBottom(300); return; }
      const sc = cont && cont.shadowRoot ? cont.shadowRoot.querySelector('.inner-scroll') : null;
      if (sc) sc.scrollTop = sc.scrollHeight;
      else window.scrollTo(0, document.body.scrollHeight);
    }, FN_VIS);
    await pg.waitForTimeout(2000);
    const desp = (await nodosArbol()).length;
    return desp > antes;
  }

  /** Vuelve un nivel dentro del árbol (de productos a categorías). */
  async function subirNivel() {
    const c = await pg.evaluate((fn) => {
      const vis = eval(fn);
      const i = [...document.querySelectorAll('app-pedido ion-icon[name="arrow-back-outline"]')].filter(vis)[0];
      if (!i) return null;
      const r = i.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, FN_VIS);
    if (c) { await pg.mouse.click(c.x, c.y, { delay: 70 }); await pg.waitForTimeout(1800); return true; }
    // 🔴 Si no hay flecha, re-clicar General → Pedido restaura el árbol colapsado.
    //    Es más fiable que el arrow-back (graduado a CONFIRMADO en difranca).
    try { await clickTab('General'); await clickTab('Pedido'); return true; } catch (_) { return false; }
  }

  /**
   * Localiza un producto en el árbol y devuelve el índice de su nodo.
   *
   * 🔴 Éste es el punto donde el módulo se rompió en la 1.ª corrida. El árbol
   *    tiene TRES variantes y aquí manda la 3.ª (DRILL-DOWN, build v1.0/db19,
   *    la de mio_parts): el click en una categoría NO expande in situ, NAVEGA
   *    DENTRO. Y el buscador NO filtra en el nivel de categorías — sólo dentro.
   *    Buscar arriba y clickear "el primer nodo" acaba abriendo una CATEGORÍA y
   *    diagnosticando "el producto no expuso input", que es un síntoma
   *    tres pasos posterior a la causa.
   *
   * Estrategia: si ya estamos entre productos, buscar aquí. Si estamos entre
   * categorías, entrar en cada una y buscar dentro, saliendo si no está.
   */
  async function localizarProducto(codigo, maxCategorias = 8) {
    // `codigo === null` = "cualquiera sirve": relevo para ejercitar el flujo
    // cuando el producto del perfil no está en el catálogo de este vendedor.
    const buscarAqui = async () => {
      let nodos = await nodosArbol();
      if (!nodos.some(n => n.esProducto)) return null;
      if (codigo === null) return nodos.find(n => n.esProducto);
      const exacto = (ns) => ns.find(n => n.codigo &&
        n.codigo.toUpperCase() === String(codigo).toUpperCase());
      let hit = exacto(nodos);
      if (hit) return hit;
      // Con muchos productos el nivel pagina: el buscador es la vía barata.
      // ⚠ matchea por SUBSTRING ('GU01' devolvió DICGU01 primero) ⇒ después de
      //   buscar hay que volver a exigir igualdad EXACTA del código.
      if (await usarBuscador(codigo)) {
        nodos = await nodosArbol();
        hit = exacto(nodos);
        if (hit) return hit;
      }
      // 🔴 Si el buscador no rinde en este build, hay que PAGINAR: "SKY 132"
      //    muestra 50 de 132 y SKY083 quedaba fuera ⇒ se leía "no existe".
      for (let p = 0; p < 8; p++) {
        if (!(await paginarNivel())) break;
        hit = exacto(await nodosArbol());
        if (hit) return hit;
      }
      return null;
    };

    // ¿Ya estamos en un nivel de productos?
    const directo = await buscarAqui();
    if (directo) return { ok: true, ...directo, ruta: 'nivel actual' };

    // Nivel de categorías: entrar en cada una hasta dar con el producto
    const cats = (await nodosArbol()).filter(n => n.esCategoria);
    if (!cats.length) return { ok: false, motivo: 'el árbol no muestra ni productos ni categorías' };

    const visitadas = [];
    for (const cat of cats.slice(0, maxCategorias)) {
      const c = await pg.evaluate(([fn, sel, i]) => {
        const vis = eval(fn);
        const nodos = [...document.querySelectorAll(sel)].filter(vis);
        const n = nodos[i]; if (!n) return null;
        n.scrollIntoView({ block: 'center' });
        const r = n.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, [FN_VIS, SEL_NODOS, cat.i]);
      if (!c) continue;
      await pg.mouse.click(c.x, c.y, { delay: 85 });
      await pg.waitForTimeout(2500);
      visitadas.push(cat.txt.slice(0, 24));

      const hit = await buscarAqui();
      if (hit) return { ok: true, ...hit, ruta: cat.txt.slice(0, 30) };

      // 🔴 Un 2.º click sobre la misma categoría NO la colapsa: revienta con
      //    "Cannot read properties of undefined". Hay que SUBIR de nivel.
      await subirNivel();
      await pg.waitForTimeout(800);
    }
    return { ok: false,
      motivo: `"${codigo}" no apareció en ${visitadas.length} categoría(s): ${visitadas.join(', ')}` };
  }

  /**
   * Expande un producto y devuelve el id sellado de su input de cantidad.
   * 🔴 Sellado POR DESCARTE — la única receta que sirve en todos los builds:
   *    los ion-accordion no siempre traen `value` y el input no siempre trae
   *    `label`, así que ni la receta por value ni la por label son portables.
   *    El único ion-input[type=number] con height>0 y SIN id sellado es el del
   *    producto recién expandido.
   */
  async function expandirYSellar(indiceNodo, etiqueta) {
    const coords = await pg.evaluate(([fn, sel, i]) => {
      const vis = eval(fn);
      const nodos = [...document.querySelectorAll(sel)].filter(vis);
      const n = nodos[i];
      if (!n) return null;
      n.scrollIntoView({ block: 'center' });
      return true;
    }, [FN_VIS, SEL_NODOS, indiceNodo]);
    if (!coords) return { ok: false, motivo: 'nodo fuera de rango' };
    await pg.waitForTimeout(400);

    // Re-leer el rect DESPUÉS del scroll: un rect viejo es un punto no clickeable
    const c = await pg.evaluate(([fn, sel, i]) => {
      const vis = eval(fn);
      const nodos = [...document.querySelectorAll(sel)].filter(vis);
      const n = nodos[i];
      if (!n) return null;
      const r = n.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight) return null;
      return { x: r.left + r.width / 2, y: r.top + 30 };
    }, [FN_VIS, SEL_NODOS, indiceNodo]);
    if (!c) return { ok: false, motivo: 'el nodo quedó fuera del viewport tras el scroll' };
    await pg.mouse.click(c.x, c.y, { delay: 80 });
    await pg.waitForTimeout(1600);

    // 🔴 stock0=false IMPIDE la expansión y NO dispara alerta: si no aparece
    //    ningún input, mirar el Inventario antes de concluir "el ítem no responde".
    const sellado = await pg.evaluate((tag) => {
      const libres = [...document.querySelectorAll('app-pedido ion-input[type="number"]')]
        .filter(i => i.getBoundingClientRect().height > 0 && !i.id);
      if (!libres.length) return null;
      const el = libres[0];
      el.id = 'qa-cant-' + tag;
      return el.id;
    }, String(etiqueta).replace(/[^A-Za-z0-9]/g, ''));

    if (!sellado) {
      const inv = await pg.evaluate(([fn, sel, i]) => {
        const vis = eval(fn);
        const nodos = [...document.querySelectorAll(sel)].filter(vis);
        const t = nodos[i] ? (nodos[i].textContent || '').replace(/\s+/g, ' ') : '';
        const m = t.match(/Inventario:\s*([\d.,]+)/);
        return m ? m[1] : '(sin etiqueta Inventario)';
      }, [FN_VIS, SEL_NODOS, indiceNodo]);
      return { ok: false, motivo: `el panel no expuso input de cantidad — Inventario: ${inv}` };
    }
    return { ok: true, inputId: '#' + sellado };
  }

  /**
   * Lee los ion-select del panel de línea abierto.
   * 🔴 Su presencia/ausencia ES el mapa de VGs de línea. En kron había 2, en
   *    alipascua 5. La AUSENCIA de "% Descuento" es la señal de
   *    userCanSelectProductDiscount=false — no un fallo del guion.
   * 🔴 Quedan bajo el fold (y≈568-892 con viewport 744): scrollIntoView antes
   *    de intentar clickearlos.
   */
  async function leerPanelLinea() {
    return await pg.evaluate((fn) => {
      const vis = eval(fn);
      const sels = [...document.querySelectorAll('app-pedido ion-select')].filter(vis);
      return sels.map(s => {
        // 🔴 LA ETIQUETA ESTÁ EN EL `ion-col` QUE ENVUELVE AL SELECT.
        //    Medido en 4K el 14/09: `label`, `aria-label` y `placeholder` vienen
        //    todos a null, y el shadowRoot del ion-select contiene el VALOR
        //    seleccionado, no el rótulo. Con la cadena anterior el mapa salía
        //    «DIESEL | USD | AV. USLAR… | PEDIDO ESTANDAR» — valores disfrazados de
        //    nombres — y además disparó un aviso FALSO («no hay selector de
        //    Moneda») cuando el selector de Moneda estaba justo ahí.
        //    El `innerText` del ion-col es solo el rótulo, porque el valor del
        //    select vive dentro de su shadow y no cuenta.
        const col  = s.closest('ion-col');
        const item = s.closest('ion-item');
        const limpia = (t) => String(t || '').replace(/\s+/g, ' ').replace(/:\s*$/, '').trim();
        const sombra = s.shadowRoot
          ? ((s.shadowRoot.querySelector('.select-text') || {}).textContent || '')
          : '';
        const etiqueta =
          limpia(s.getAttribute('label') || s.label || s.getAttribute('aria-label')) ||
          limpia(col && col.innerText) ||
          limpia(item && item.querySelector('ion-label') && item.querySelector('ion-label').textContent) ||
          limpia(s.getAttribute('placeholder'));
        return {
          etiqueta: etiqueta.slice(0, 40) || '(sin etiqueta)',
          // El valor VISIBLE, no el objeto del modelo: `s.value` es un objeto en
          // Moneda y en varios más, y «[object Object]» no informa de nada.
          valor: (limpia(sombra) ||
                  limpia(s.value && s.value.coCurrency ? s.value.coCurrency : '')).slice(0, 30),
          disabled: s.disabled === true || s.hasAttribute('disabled') ||
                    String(s.className || '').includes('select-disabled'),
          opciones: s.querySelectorAll('ion-select-option').length,
        };
      });
    }, FN_VIS);
  }

  /**
   * Lee el Tab Total. Devuelve el texto crudo y las cifras que encuentre por
   * etiqueta — nunca por posición, que varía entre builds.
   */
  /**
   * Lee el Tab Total.
   *
   * 🔴 No se parsea con un regex por cifra sobre el texto entero: así fue como
   *    "Total" acabó capturando el 0 de "Total Item 0" y el caso reportó
   *    Total=0 con Base=17,40 e IVA=2,78 — un descuadre inventado por el guion,
   *    que además arrastró a DM-PED-TOT-001 y a DM-PED-026.
   *    Se trocea por LÍNEAS y se empareja etiqueta→valor; `total` se resuelve
   *    excluyendo explícitamente "Total Base" y "Total Item(s)".
   */
  async function leerTotales() {
    const lineas = await pg.evaluate((fn) => {
      const vis = eval(fn);
      const f = [...document.querySelectorAll('app-pedido')].filter(vis)[0];
      if (!f) return [];
      return (f.innerText || '')
        .replace(/\u00a0/g, ' ')
        .split('\n').map(l => l.trim()).filter(Boolean);
    }, FN_VIS);

    // Empareja "<etiqueta> <importe>" en la misma línea, o la etiqueta en una
    // línea y el importe en la siguiente (maquetación a dos columnas).
    const valorDe = (reEtiqueta, reExcluir) => {
      for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];
        if (!reEtiqueta.test(l)) continue;
        if (reExcluir && reExcluir.test(l)) continue;
        const propio = l.replace(reEtiqueta, ' ').match(/-?[\d.]+(?:,\d+)?/);
        if (propio) return parseMonto(propio[0]);
        const sig = lineas[i + 1];
        if (sig && /^[^A-Za-z]*-?[\d.]+(?:,\d+)?/.test(sig)) return parseMonto(sig);
      }
      return null;
    };

    return {
      // El crudo viaja al veredicto: si algún día vuelve a fallar el parseo,
      // el reporte trae las etiquetas reales y no hay que sondear el device.
      crudo:     lineas.join(' | ').slice(0, 300),
      base:      valorDe(/total\s*base/i),
      iva:       valorDe(/\b(?:iva|impuesto)\b/i),
      descuento: valorDe(/descuento/i),
      items:     valorDe(/total\s*[íi]tems?\b/i),
      total:     valorDe(/\btotal\b/i, /total\s*(?:base|[íi]tems?)|descuento/i),
    };
  }

  /** Nº de líneas del carrito — la fuente fiable (`.contadorProductos` NO cuenta líneas). */
  async function lineasCarrito() {
    const e = await estadoComponente();
    return e && typeof e.lineas === 'number' ? e.lineas : null;
  }

  /**
   * Abre un ion-select por etiqueta y elige una opción por igualdad exacta.
   * 🔴 Dos mecanismos conviven:
   *    · popover con ion-radio-group (descuento POR LÍNEA) — no tiene <button>
   *    · ion-alert con radios (descuento GLOBAL) — opciones y Cancelar/Aceptar
   *      conviven en la MISMA lista de botones ⇒ 2 clicks, y jamás por includes
   *      (/desc/i matchea "SIN DESCUENTO").
   */
  async function elegirEnSelect(etiquetaSelect, predicadoOpcion) {
    const c = await pg.evaluate((lbl) => {
      const sels = [...document.querySelectorAll('app-pedido ion-select')]
        .filter(s => s.getBoundingClientRect().height > 0);
      const s = sels.find(x => {
        const t = (x.label || x.getAttribute('label') ||
          (x.closest('ion-item') ? x.closest('ion-item').textContent : '') || '');
        return t.toLowerCase().includes(lbl.toLowerCase());
      });
      if (!s) return null;
      s.scrollIntoView({ block: 'center' });
      return true;
    }, etiquetaSelect);
    if (!c) return { ok: false, motivo: `select "${etiquetaSelect}" no visible` };
    await pg.waitForTimeout(500);

    const coords = await pg.evaluate((lbl) => {
      const sels = [...document.querySelectorAll('app-pedido ion-select')]
        .filter(s => s.getBoundingClientRect().height > 0);
      const s = sels.find(x => {
        const t = (x.label || x.getAttribute('label') ||
          (x.closest('ion-item') ? x.closest('ion-item').textContent : '') || '');
        return t.toLowerCase().includes(lbl.toLowerCase());
      });
      if (!s) return null;
      const r = s.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, etiquetaSelect);
    if (!coords) return { ok: false, motivo: `select "${etiquetaSelect}" fuera del viewport` };
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
    await pg.waitForTimeout(1600);

    // Opciones: popover (ion-item/ion-radio) o alert (alert-button)
    const opciones = await pg.evaluate(() => {
      const vis = el => el && el.getBoundingClientRect().width > 0;
      const pop = [...document.querySelectorAll('ion-popover')].filter(vis).pop();
      if (pop) {
        return {
          tipo: 'popover',
          textos: [...pop.querySelectorAll('ion-item, ion-radio')].filter(vis)
            .map(i => i.textContent.trim()).filter(Boolean),
        };
      }
      const al = [...document.querySelectorAll('ion-alert')].filter(vis).pop();
      if (al) {
        return {
          tipo: 'alert',
          textos: [...al.querySelectorAll('.alert-radio-label, .alert-button')].filter(vis)
            .map(i => i.textContent.trim()).filter(Boolean),
        };
      }
      return { tipo: 'ninguno', textos: [] };
    });
    if (opciones.tipo === 'ninguno') return { ok: false, motivo: 'el selector no abrió ningún overlay' };

    const elegida = opciones.textos.find(t => predicadoOpcion(t));
    if (!elegida) {
      return { ok: false, motivo: `sin opción aplicable · ${opciones.tipo}: ${opciones.textos.join(' | ')}` };
    }

    const hecho = await pg.evaluate((txt) => {
      const vis = el => el && el.getBoundingClientRect().width > 0;
      const cont = [...document.querySelectorAll('ion-popover')].filter(vis).pop()
                || [...document.querySelectorAll('ion-alert')].filter(vis).pop();
      if (!cont) return null;
      const el = [...cont.querySelectorAll('ion-item, ion-radio, .alert-radio-label, .alert-button')]
        .filter(vis).find(x => x.textContent.trim() === txt);
      if (!el) return null;
      const t = el.closest('button') || el;
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, elegida);
    if (!hecho) return { ok: false, motivo: `no se pudo clickear "${elegida}"` };
    await pg.mouse.click(hecho.x, hecho.y, { delay: 70 });
    await pg.waitForTimeout(1200);

    // En la variante alert hay que confirmar con Aceptar (2.º click)
    if (opciones.tipo === 'alert') {
      try { await clickAlertBtn(['aceptar', 'ok']); } catch (_) {}
      await pg.waitForTimeout(1000);
    }
    return { ok: true, opcion: elegida, tipo: opciones.tipo, todas: opciones.textos };
  }

  async function clickBack() {
    // 🔴 Hay hasta 4 img.fechaAtras y 3 con rect 0×0: tomar «el primero» da (0,0)
    const c = await pg.evaluate(() => {
      const im = [...document.querySelectorAll('img.fechaAtras')]
        .filter(i => i.getBoundingClientRect().width > 0)[0];
      if (!im) return null;
      const t = im.closest('a') || im;
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!c) throw new Error('img.fechaAtras visible no encontrado');
    await pg.mouse.click(c.x, c.y, { delay: 70 });
    await pg.waitForTimeout(1600);
  }

  /**
   * Vuelve al home DEL MÓDULO. Es bidireccional a propósito: retroceder a ciegas
   * se pasa de largo hasta APP-HOME, y desde ahí los botones PEDIDO/BUSCAR ya no
   * existen — el módulo moriría con un error que parece de selector.
   */
  async function irAHomePedidos(max = 5) {
    for (let i = 0; i < max; i++) {
      // 🔴 VISIBILIDAD, no presencia: Ionic deja las páginas en el DOM con
      //    `.ion-page-hidden`. `querySelector('app-pedidos')` devuelve el nodo
      //    aunque estemos dentro del formulario ⇒ esta función creería que ya
      //    llegó y devolvería true sin haberse movido.
      const donde = await pg.evaluate((fn) => {
        const vis = eval(fn);
        const q = s => vis(document.querySelector(s));
        return {
          modulo:  q('app-pedidos'),
          form:    q('app-pedido'),
          lista:   q('app-pedidos-lista'),
          appHome: q('app-home'),
        };
      }, FN_VIS);
      if (donde.modulo && !donde.form && !donde.lista) return true;
      if (donde.appHome && !donde.modulo) {
        // Nos pasamos de largo: volver a ENTRAR en vez de seguir retrocediendo
        const tile = await pg.evaluate(() => {
          const a = [...document.querySelectorAll('app-home a.ion-text-center')].find(x => {
            const p = x.querySelector('p.nombreModulos');
            return p && /^pedidos$/i.test(p.textContent.trim());
          });
          if (!a) return null;
          const r = a.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        if (tile) {
          await pg.mouse.click(tile.x, tile.y, { delay: 80 });
          await pg.waitForSelector('app-pedidos', { state: 'visible', timeout: 120000 }).catch(() => {});
          await pg.waitForTimeout(1200);
          continue;
        }
      }
      try { await clickBack(); } catch (_) {}
      // dirty-guard: salir sin guardar
      const a = await alertInfo();
      if (a && a.botones.some(b => /salir sin guardar/i.test(b))) {
        try { await clickAlertBtn(['salir sin guardar']); } catch (_) {}
      } else if (a) {
        try { await clickAlertBtn(['cancelar', 'ok', 'aceptar']); } catch (_) {}
      }
      await pg.waitForTimeout(1200);
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-001: Tile Pedidos del HOME → home del módulo (PEDIDO/BUSCAR/COPIAR)
  // ══════════════════════════════════════════════════════════════════════════
  // El orquestador deja la app en APP-HOME antes de cada módulo, así que el
  // primer paso es entrar. Los tiles son `a.ion-text-center > p.nombreModulos`
  // — esa convención es de app-home y NO sirve dentro del módulo (ver el
  // comentario de clickBotonHome).
  try {
    const yaDentro = await visible('app-pedidos');
    if (!yaDentro) {
      const tile = await pg.evaluate(() => {
        const a = [...document.querySelectorAll('app-home a.ion-text-center')].find(x => {
          const p = x.querySelector('p.nombreModulos');
          return p && /^pedidos$/i.test(p.textContent.trim());
        });
        if (!a) return null;
        const r = a.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!tile) {
        const disponibles = await pg.evaluate(() =>
          [...document.querySelectorAll('app-home p.nombreModulos')].map(p => p.textContent.trim()));
        throw new Error(`Tile "Pedidos" no encontrado en HOME — módulos visibles: ${disponibles.join(', ') || 'ninguno'}`);
      }
      await pg.mouse.click(tile.x, tile.y, { delay: 80 });
      // 🔴 Con userMustActivateGPS el navigate cuelga del getCurrentPosition:
      //    el click parece muerto hasta 30 s. Techo 120 s (RUNTIME §3).
      await pg.waitForSelector('app-pedidos', { state: 'visible', timeout: 120000 });
      await pg.waitForTimeout(1200);
    }
    const botones = await pg.evaluate(() =>
      [...document.querySelectorAll('app-pedidos ion-button')]
        .filter(b => b.getBoundingClientRect().height > 0)
        .map(b => b.textContent.trim().toUpperCase())
        .filter(t => ['PEDIDO', 'BUSCAR', 'COPIAR'].includes(t)));
    const ok = botones.includes('PEDIDO') && botones.includes('BUSCAR');
    v('DM-PED-001', 'Tile Pedidos → home del módulo', ok ? 'PASS' : 'FAIL',
      `botones: ${botones.join(', ') || 'ninguno'}`);
    if (!ok) {
      TODOS.filter(id => id !== 'DM-PED-001').forEach(id =>
        v(id, id, 'BLOCKED', 'no se alcanzó el home de Pedidos'));
      return { verdicts, msTotal: Date.now() - t0 };
    }
  } catch (e) {
    v('DM-PED-001', 'Home de Pedidos con sus accesos', 'FAIL', e.message);
    TODOS.filter(id => id !== 'DM-PED-001').forEach(id =>
      v(id, id, 'BLOCKED', 'PED-001 falló'));
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-002: PEDIDO → formulario; tabs bloqueadas sin cliente
  // ══════════════════════════════════════════════════════════════════════════
  try {
    const abrio = await abrirFormPedido();
    if (!abrio) throw new Error('app-pedido no apareció (¿guarda de GPS? el navigate cuelga del getCurrentPosition)');
    const tabs = await leerTabs();
    const bloqueadas = tabs.filter(t => t.disabled).length;
    v('DM-PED-002', 'Form de pedido con tabs bloqueadas sin cliente',
      bloqueadas >= 1 ? 'PASS' : 'FAIL',
      `tabs: ${tabs.map(t => `${t.nombre}${t.disabled ? '(bloq)' : ''}`).join(' · ')}`);
  } catch (e) {
    v('DM-PED-002', 'Form de pedido', 'FAIL', e.message);
    TODOS.filter(id => !['DM-PED-001','DM-PED-002'].includes(id)).forEach(id =>
      v(id, id, 'BLOCKED', 'PED-002 falló'));
    await irAHomePedidos();
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-VG-001: mapa de VGs de CABECERA
  // ══════════════════════════════════════════════════════════════════════════
  // 🔴 El Tab General NO muestra sus selects hasta que hay cliente: con
  //    hasClient=false trae 1 select (Empresa) + 1 input (#clienteSelect).
  //    Se mide DESPUÉS de elegir cliente; aquí sólo se deja constancia previa.
  const cabeceraAntes = await leerPanelLinea();

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-006: Seleccionar cliente → tabs habilitadas
  // ══════════════════════════════════════════════════════════════════════════
  //
  // 🔴 REINTENTO CON FORMULARIO NUEVO — la intermitencia medida el 14/09.
  //
  //    En once vueltas seguidas apareció un patrón limpio: **el módulo falla en
  //    toda corrida que va DETRÁS de una corrida que terminó bien**. Una vuelta
  //    sí y una no, desde la 5.ª en adelante (5 ✗, 6 ✓, 7 ✗, 8 ✓, 9 ✗, 10 ✓, 11 ✗).
  //    El síntoma siempre es el mismo: `setClientfromSelector` rellena el input
  //    pero **`hasClient` se queda en false** y las pestañas no se liberan.
  //
  //    Es decir: **el formulario hereda algo del pedido anterior ya enviado**.
  //    Sea del producto o del arrastre de estado del servicio, desde el guion
  //    solo se puede hacer una cosa sensata: **tirar el formulario y abrir uno
  //    limpio**. Un solo reintento con form nuevo convierte 20 BLOCKED en una
  //    corrida completa, y si tampoco así, el veredicto lo dice sin adornos.
  let clienteOk = false;
  try {
    if (!DATA.clienteTest) throw new Error('perfil sin modules.pedidos.cliente_test');
    let sel = await seleccionarCliente(DATA.clienteTest);
    let res = await esperarTabsHabilitadas();
    clienteOk = !!(res && res.libres >= 3);
    let reintento = '';
    if (!clienteOk) {
      // Formulario nuevo: salir del actual, volver al home del módulo y reabrir.
      await irAHomePedidos().catch(() => {});
      await limpiarAlertas(3).catch(() => {});
      await pg.waitForTimeout(1500);
      await abrirFormPedido().catch(() => {});
      await pg.waitForTimeout(2000);
      sel = await seleccionarCliente(DATA.clienteTest);
      res = await esperarTabsHabilitadas();
      clienteOk = !!(res && res.libres >= 3);
      reintento = clienteOk
        ? ' · ⚠ hizo falta un SEGUNDO intento con formulario nuevo (el primero dejó ' +
          'el input con el nombre y el modelo sin cliente)'
        : ' · 🔴 falló también con formulario nuevo';
    }
    const est = await estadoComponente();
    v('DM-PED-006', 'Seleccionar cliente → tabs habilitadas', clienteOk ? 'PASS' : 'FAIL',
      `"${sel.nombre}" (vía ${sel.via}, ${sel.cargados} clientes cargados en ${sel.rondas} ronda/s) · ` +
      `tabs libres: ${res ? res.libres : '?'} · ` +
      `lockSegments: ${est.lockSegments} · hasClient: ${est.hasClient}` +
      ((sel.confirmaciones && sel.confirmaciones.length)
        ? ` · confirmación(es) aceptada(s): ${sel.confirmaciones.join(' | ')}` : '') +
      (est.hasClient ? '' :
        ' · 🔴 el input muestra el nombre pero el MODELO no tiene cliente: casi siempre es ' +
        'que quedó una confirmación sin aceptar (su backdrop bloquea el resto de la pantalla)') +
      reintento);
  } catch (e) {
    v('DM-PED-006', 'Seleccionar cliente → tabs habilitadas', 'FAIL', e.message);
  }

  if (!clienteOk) {
    TODOS.filter(id => !['DM-PED-001','DM-PED-002','DM-PED-006'].includes(id)).forEach(id =>
      v(id, id, 'BLOCKED', 'PED-006 falló: sin cliente no hay transacción'));
    await irAHomePedidos();
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // ── REQ Enviar · E1 + E2 ────────────────────────────────────────────────────
  // 🔴 R1 · aquí y no antes: la transacción empieza al seleccionar el cliente.
  reqV(await reqInicio(pg, 'PED'));
  reqV(await reqRechazo(pg, 'PED'));

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-VG-001 (cont.): los selects de cabecera, ya con cliente
  // ══════════════════════════════════════════════════════════════════════════
  try {
    const cab = await leerPanelLinea();
    const nombres = cab.map(s => `${s.etiqueta}${s.valor ? `="${s.valor}"` : ''}`).join(' | ');
    // El cotejo contra el YAML es INFORMATIVO: manda la UI (difranca demostró
    // que el perfil puede estar desactualizado). Una divergencia se ANOTA.
    const divergencias = [];
    const tiene = (re) => cab.some(s => re.test(s.etiqueta));
    if (DATA.multiCurrency === true  && !tiene(/moneda/i))  divergencias.push('YAML multiCurrency=true pero no hay selector de Moneda');
    if (DATA.multiCurrency === false &&  tiene(/moneda/i))  divergencias.push('YAML multiCurrency=false pero SÍ hay selector de Moneda');
    v('DM-PED-VG-001', 'Mapa de VGs de cabecera (selects del Tab General)', 'PASS',
      `${cab.length} select(s) con cliente (antes: ${cabeceraAntes.length}) — ${nombres || 'ninguno'}` +
      (divergencias.length ? ` · ⚠ ${divergencias.join('; ')}` : ''));
  } catch (e) {
    v('DM-PED-VG-001', 'Mapa de VGs de cabecera', 'BLOCKED', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-015: Tab Pedido → catálogo visible
  // ══════════════════════════════════════════════════════════════════════════
  let arbol = null, catalogoOk = false;
  try {
    await clickTab('Pedido');
    arbol = await detectarArbol();
    catalogoOk = arbol.cats > 0 || arbol.accs > 0;
    if (!catalogoOk) {
      // 🔴 Antes de llamarlo defecto: el Tab Pedido filtra por
      //    (lista de precios activa × MONEDA del pedido) y puede quedar VACÍO.
      const est = await estadoComponente();
      v('DM-PED-015', 'Tab Pedido → catálogo con productos', 'FAIL',
        `0 categorías y 0 accordions · lista activa: ${est.listaPrecios} · moneda: ${est.moneda} — ` +
        `🔴 antes de reportarlo como defecto, cambiar la moneda del pedido y volver a mirar: ` +
        `el catálogo se filtra por (lista × moneda) y esa combinación puede no tener precios`);
    } else {
      v('DM-PED-015', 'Tab Pedido → catálogo con productos', 'PASS',
        `variante "${arbol.variante}" · categorías: ${arbol.cats} · accordions: ${arbol.accs}`);
    }
  } catch (e) {
    v('DM-PED-015', 'Tab Pedido → catálogo', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-029: sin ítems → Guardar/Enviar deshabilitados
  // ══════════════════════════════════════════════════════════════════════════
  //
  // 🔴 LA EXPECTATIVA DEL GUION ESTABA MAL, Y ERA ELLA LA QUE FALLABA.
  //
  //    El guion smoke exigía «Guardar y Enviar DESHABILITADOS», y en mio_parts
  //    daba FAIL dos corridas seguidas porque **Guardar sale habilitado**. Iba
  //    camino de reportarse como defecto de producto. Medido a mano en 4K el
  //    14/09, con cliente puesto y el carrito vacío:
  //
  //        Guardar: HABIL · Enviar: HABIL
  //        pulsar Guardar → «Denario · Debe agregar al menos un producto al
  //                          pedido.»  [OK]   — y NO guarda nada
  //
  //    O sea: **la protección existe**, solo que la app no la implementa
  //    deshabilitando el botón sino **validando al pulsarlo y diciendo qué
  //    falta** — que es, además, justo lo que pide el criterio C2 del REQ del
  //    botón Enviar (y por eso DM-PED-REQ-002 pasa por esta misma vía).
  //
  //    Lo que de verdad no puede pasar es que se GUARDE un pedido vacío. Eso es
  //    lo que mide ahora el caso: si los botones nacen deshabilitados, perfecto;
  //    y si nacen habilitados, se PULSA y se exige que **no guarde y que avise**.
  //    Sólo si llega a guardar un pedido sin líneas hay FAIL.
  try {
    const n = await lineasCarrito();
    const leerBotones = () => pg.evaluate(() => {
      const st = b => !b ? 'ausente' : ((b.disabled === true || b.getAttribute('disabled') !== null) ? 'deshab' : 'habil');
      return { guardar: st(document.querySelector('ion-button.imagenGuardar')),
               enviar:  st(document.querySelector('ion-button.imagenEnviar')) };
    });
    const btns = await leerBotones();

    if (n === null || n > 0) {
      v('DM-PED-029', 'Con el carrito vacío, el pedido no se puede guardar', 'N/A',
        `el carrito ya tiene ${n === null ? '?' : n} línea(s): el caso exige medirlo vacío`);
    } else if (btns.guardar !== 'habil' && btns.enviar !== 'habil') {
      v('DM-PED-029', 'Con el carrito vacío, el pedido no se puede guardar', 'PASS',
        `carrito: 0 líneas · Guardar: ${btns.guardar} · Enviar: ${btns.enviar} ` +
        `(la app lo impide deshabilitando los botones)`);
    } else {
      // Nacen habilitados: hay que comprobar que la app IGUAL lo impide.
      const gc = await pg.evaluate(() => {
        const b = document.querySelector('ion-button.imagenGuardar');
        if (!b || b.disabled) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      });
      let aviso = null, siguioEnForm = null;
      if (gc) {
        await pg.mouse.click(gc.x, gc.y, { delay: 100 });
        await pg.waitForTimeout(2500);
        const al = await alertInfo();
        aviso = al ? `${al.titulo} · ${al.mensaje}`.trim() : null;
        // Si preguntara «¿Desea guardar?» habría que cancelar: no queremos guardarlo.
        if (al && /¿desea guardar|desea guardar/i.test(aviso)) {
          await clickAlertBtn(['cancelar', 'no']).catch(() => {});
          aviso += ' · 🔴 preguntó si guardar un pedido VACÍO (se canceló)';
        } else if (al) {
          await clickAlertBtn(['ok', 'aceptar']).catch(() => {});
        }
        await pg.waitForTimeout(1200);
        siguioEnForm = await visible('app-pedido');
      }
      const explica = !!aviso && /al menos un producto|agregar.*producto|sin productos|vacío/i.test(aviso);
      const guardoVacio = !!aviso && /guardad|exitosamente/i.test(aviso);
      v('DM-PED-029', 'Con el carrito vacío, el pedido no se puede guardar',
        (explica && !guardoVacio) ? 'PASS' : 'FAIL',
        `carrito: 0 líneas · Guardar: ${btns.guardar} · Enviar: ${btns.enviar} · ` +
        `al pulsar Guardar: "${aviso || 'ningún aviso'}" · sigue en el formulario: ${siguioEnForm}` +
        (guardoVacio ? ' · 🔴 GUARDÓ UN PEDIDO SIN LÍNEAS' :
          explica ? ' · ℹ️ los botones nacen habilitados, pero la app valida al pulsar y dice qué falta ' +
                    '— que es el criterio C2 del REQ del botón Enviar, no un defecto'
                  : ' · 🔴 ni deshabilita ni explica qué falta'));
    }
  } catch (e) {
    v('DM-PED-029', 'Con el carrito vacío, el pedido no se puede guardar', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-017: agregar una línea con cantidad
  // ══════════════════════════════════════════════════════════════════════════
  let lineaOk = false, inputCantidad = null, totalesTrasAlta = null;
  try {
    if (!catalogoOk) throw new Error('sin catálogo visible (ver PED-015)');
    if (!DATA.productoTest) throw new Error('perfil sin modules.pedidos.producto_test');

    let hallazgo = await localizarProducto(DATA.productoTest);
    if (!hallazgo.ok) {
      // Relevo: si el producto del perfil no está en el catálogo de ESTE
      // vendedor, cualquier otro sirve para ejercitar el flujo. Se anota en el
      // veredicto: medir con un relevo no es lo mismo que medir con el previsto.
      const primerFallo = hallazgo.motivo;

      // 🔴 RESTAURAR EL ÁRBOL ANTES DE PEDIR EL RELEVO. La búsqueda anterior
      //    entró y salió de varias categorías y puede dejar el nivel VACÍO; el
      //    relevo se encontraba entonces con «el árbol no muestra ni productos
      //    ni categorías» y el módulo se caía con un mensaje que hablaba del
      //    árbol cuando el problema era el producto del perfil (4K, 14/09).
      //    Re-clicar General → Pedido devuelve el árbol colapsado y entero.
      try { await clickTab('General'); await clickTab('Pedido'); } catch (_) {}
      await pg.waitForTimeout(1800);

      hallazgo = await localizarProducto(null, 6);
      if (!hallazgo.ok) throw new Error(`${primerFallo} · relevo: ${hallazgo.motivo}`);
      hallazgo.fallback = primerFallo;
    }

    const sellado = await expandirYSellar(hallazgo.i, hallazgo.codigo || 'x');
    if (!sellado.ok) {
      // Diagnóstico completo: si vuelve a fallar, que el reporte traiga lo que
      // hace falta para arreglarlo sin tener que sondear el dispositivo.
      const foto = await nodosArbol();
      throw new Error(`${sellado.motivo} · nodo "${hallazgo.codigo}" en "${hallazgo.ruta}" · ` +
        `árbol: ${foto.length} nodo(s), ${foto.filter(n => n.esProducto).length} con código · ` +
        `primeros: ${foto.slice(0, 3).map(n => n.txt.slice(0, 30)).join(' | ')}`);
    }
    inputCantidad = sellado.inputId;

    await fillIonInput(inputCantidad, '2');
    await pg.waitForTimeout(1500);

    // 🔴 productMinMul puede AUTO-CORREGIR la cantidad con un alert. El valor
    //    corregido es el que viaja a order_detail_unit.qu_order ⇒ hay que leerlo.
    let autocorreccion = null;
    const a = await alertInfo();
    if (a && /cantidad m[íi]nima|m[úu]ltiplo/i.test(`${a.titulo} ${a.mensaje}`)) {
      autocorreccion = a.mensaje;
      await clickAlertBtn(['ok', 'aceptar']);
      await pg.waitForTimeout(1000);
    } else if (a && /inventario/i.test(`${a.titulo} ${a.mensaje}`)) {
      // alert "sin inventario": su backdrop intercepta TODOS los clicks siguientes
      await clickAlertBtn(['ok', 'aceptar']);
    }

    const cantReal = await pg.evaluate((sel) => {
      const h = document.querySelector(sel);
      const i = h && (h.querySelector('input') || (h.shadowRoot && h.shadowRoot.querySelector('input')));
      return i ? i.value : null;
    }, inputCantidad);

    const n = await lineasCarrito();
    lineaOk = n === null ? true : n > 0;
    v('DM-PED-017', 'Cargar cantidad → la línea entra al carrito', lineaOk ? 'PASS' : 'FAIL',
      `producto "${hallazgo.codigo}" en "${hallazgo.ruta}"` +
      `${hallazgo.fallback ? ` · ⚠ RELEVO — ${hallazgo.fallback}` : ''} · ` +
      `cantidad en pantalla: ${cantReal} · líneas en carrito: ${n === null ? 'sin window.ng' : n}` +
      (autocorreccion ? ` · ⚠ productMinMul autocorrigió: "${autocorreccion}"` : ''));
  } catch (e) {
    v('DM-PED-017', 'Cargar cantidad → la línea entra al carrito', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-VG-002: mapa de VGs de LÍNEA (panel del producto expandido)
  // ══════════════════════════════════════════════════════════════════════════
  let panelLinea = [];
  try {
    if (!lineaOk) {
      v('DM-PED-VG-002', 'Mapa de VGs de línea (selects del panel de producto)', 'BLOCKED',
        'no se llegó a expandir ningún producto (ver PED-017)');
    } else {
      panelLinea = await leerPanelLinea();
      const etiquetas = panelLinea.map(s =>
        `${s.etiqueta}${s.valor ? `="${s.valor}"` : ''}${s.disabled ? '(disabled)' : ''}[${s.opciones}]`
      ).join(' · ');
      // La AUSENCIA es información, no un fallo: así se leen las VGs sin
      // provocar el comportamiento (kron: 2 selects ⇒ descuento y almacén off).
      const hay = (re) => panelLinea.some(s => re.test(s.etiqueta));
      v('DM-PED-VG-002', 'Mapa de VGs de línea (selects del panel de producto)', 'PASS',
        `${panelLinea.length} select(s): ${etiquetas || 'ninguno'} · ` +
        `descuento por producto: ${hay(/descuento/i) ? 'SÍ' : 'no'} · ` +
        `IVA: ${hay(/iva|impuesto/i) ? 'SÍ' : 'no'} · ` +
        `almacén: ${hay(/almac/i) ? 'SÍ' : 'no'} · lista de precio: ${hay(/lista/i) ? 'SÍ' : 'no'}`);
    }
  } catch (e) {
    v('DM-PED-VG-002', 'Mapa de VGs de línea', 'BLOCKED', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-024: Tab Total con cifras
  // ══════════════════════════════════════════════════════════════════════════
  try {
    if (!lineaOk) throw new Error('sin líneas en el carrito (ver PED-017)');
    await clickTab('Total');
    totalesTrasAlta = await leerTotales();
    const ok = totalesTrasAlta.total !== null && totalesTrasAlta.total !== 0;
    v('DM-PED-024', 'Tab Total con los importes del pedido', ok ? 'PASS' : 'FAIL',
      `Base: ${totalesTrasAlta.base} · Descuento: ${totalesTrasAlta.descuento} · ` +
      `IVA: ${totalesTrasAlta.iva} · Total: ${totalesTrasAlta.total}` +
      (ok ? '' : ` · texto leído: «${totalesTrasAlta.crudo}»`));
  } catch (e) {
    v('DM-PED-024', 'Tab Total con los importes del pedido', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-IVA-001: el IVA de la línea se refleja en el Tab Total
  // ══════════════════════════════════════════════════════════════════════════
  try {
    const hayIva = panelLinea.some(s => /iva|impuesto/i.test(s.etiqueta));
    const t = totalesTrasAlta;
    if (!t) {
      v('DM-PED-IVA-001', 'IVA de línea reflejado en el Tab Total', 'BLOCKED',
        'no se pudo leer el Tab Total');
    } else if (!hayIva && (t.iva === null || t.iva === 0)) {
      // Coherente: sin selector de IVA y con IVA 0 no hay nada que validar.
      v('DM-PED-IVA-001', 'IVA de línea reflejado en el Tab Total', 'N/A',
        `el panel de línea no ofrece selector de IVA y el Tab Total marca IVA ${t.iva} ⇒ ` +
        `cliente sin IVA en pedidos (userCanSelectIVA/vatExemptProducts off). Coherente, no hay qué medir`);
    } else if (hayIva && (t.iva === null || t.iva === 0)) {
      // 🔴 Aquí sí hay algo que mirar: la UI ofrece IVA y el total no lo recoge.
      v('DM-PED-IVA-001', 'IVA de línea reflejado en el Tab Total', 'FAIL',
        `el panel de línea SÍ ofrece selector de IVA pero el Tab Total marca IVA ${t.iva} — ` +
        `revisar si el producto está exento (vatExemptProducts) o si el impuesto no se está sumando`);
    } else {
      v('DM-PED-IVA-001', 'IVA de línea reflejado en el Tab Total', 'PASS',
        `IVA ${t.iva} sobre base ${t.base}` +
        (t.base ? ` (${(t.iva / t.base * 100).toFixed(2)} %)` : '') +
        ` · selector de IVA en el panel: ${hayIva ? 'sí' : 'no'}`);
    }
  } catch (e) {
    v('DM-PED-IVA-001', 'IVA de línea reflejado en el Tab Total', 'BLOCKED', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-DSC-001: descuento POR PRODUCTO
  // ══════════════════════════════════════════════════════════════════════════
  // No basta con que el selector exista: se aplica y se comprueba que el Tab
  // Total BAJE. Validar presencia y no conformidad es lo que dejó escapar los
  // 4 defectos de la v21.
  try {
    const selDesc = panelLinea.find(s => /descuento/i.test(s.etiqueta));
    if (!selDesc) {
      v('DM-PED-DSC-001', 'Descuento por producto aplica y baja el total', 'N/A',
        'el panel de línea no ofrece "% Descuento" ⇒ userCanSelectProductDiscount=false. ' +
        'La ausencia del selector ES la señal de la VG, no un fallo');
    } else if (selDesc.disabled) {
      v('DM-PED-DSC-001', 'Descuento por producto aplica y baja el total', 'N/A',
        `el selector "% Descuento" existe pero llega disabled (${selDesc.opciones} opción/es)`);
    } else if (!totalesTrasAlta || totalesTrasAlta.total === null) {
      v('DM-PED-DSC-001', 'Descuento por producto aplica y baja el total', 'BLOCKED',
        'sin lectura previa del Tab Total con la que comparar');
    } else {
      const antes = totalesTrasAlta.total;
      await clickTab('Pedido');
      await pg.waitForTimeout(1200);
      // 🔴 El descuento se REINICIA si el acordeón se colapsa y re-expande, y
      //    cambiar de tab colapsa el árbol ⇒ hay que volver a abrir el producto.
      const reabierto = inputCantidad
        ? await pg.evaluate((sel) => !!document.querySelector(sel) &&
            document.querySelector(sel).getBoundingClientRect().height > 0, inputCantidad)
        : false;
      if (!reabierto) {
        v('DM-PED-DSC-001', 'Descuento por producto aplica y baja el total', 'BLOCKED',
          'el panel del producto se colapsó al cambiar de tab y no se pudo reabrir para aplicar el descuento');
      } else {
        // Elegir cualquier opción que represente un % > 0
        const r = await elegirEnSelect('descuento', (txt) => {
          const n = parseMonto(txt);
          return n !== null && n > 0 && !/^sin/i.test(txt.trim());
        });
        if (!r.ok) {
          v('DM-PED-DSC-001', 'Descuento por producto aplica y baja el total', 'FAIL',
            `no se pudo aplicar el descuento: ${r.motivo}`);
        } else {
          await clickTab('Total');
          const desp = await leerTotales();
          const bajo = desp.total !== null && desp.total < antes - 0.001;
          v('DM-PED-DSC-001', 'Descuento por producto aplica y baja el total',
            bajo ? 'PASS' : 'FAIL',
            `opción "${r.opcion}" (${r.tipo}) · Total ${antes} → ${desp.total} · ` +
            `Descuento en el Tab Total: ${desp.descuento}` +
            (bajo ? '' : ' — 🔴 el descuento se seleccionó pero el total NO bajó'));
          totalesTrasAlta = desp;
        }
      }
    }
  } catch (e) {
    v('DM-PED-DSC-001', 'Descuento por producto aplica y baja el total', 'BLOCKED', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-DSC-002: descuento GLOBAL (Tab Total)
  // ══════════════════════════════════════════════════════════════════════════
  try {
    await clickTab('Total');
    const selsTotal = await leerPanelLinea();
    const selGlobal = selsTotal.find(s => /descuento/i.test(s.etiqueta));
    if (!selGlobal) {
      // La ausencia de selects en el Tab Total ES userCanSelectGlobalDiscount=false
      v('DM-PED-DSC-002', 'Descuento global aplica y baja el total', 'N/A',
        `el Tab Total no ofrece selector de descuento global ⇒ userCanSelectGlobalDiscount=false. ` +
        `Selects presentes: ${selsTotal.map(s => s.etiqueta).join(' | ') || 'ninguno'}`);
    } else if (!totalesTrasAlta || totalesTrasAlta.total === null) {
      v('DM-PED-DSC-002', 'Descuento global aplica y baja el total', 'BLOCKED',
        'sin lectura previa del Tab Total con la que comparar');
    } else {
      const antes = totalesTrasAlta.total;
      // 🔴 Este abre un ion-alert con radios donde opciones y Cancelar/Aceptar
      //    conviven: por eso el predicado descarta "SIN DESCUENTO" y los botones
      //    de acción explícitamente. Un match por /desc/i elegiría el primero.
      const r = await elegirEnSelect('descuento', (txt) => {
        const t = txt.trim();
        if (/^(sin|cancelar|aceptar|ok)\b/i.test(t)) return false;
        return /\d/.test(t);
      });
      if (!r.ok) {
        v('DM-PED-DSC-002', 'Descuento global aplica y baja el total', 'FAIL',
          `no se pudo aplicar el descuento global: ${r.motivo}`);
      } else {
        await pg.waitForTimeout(1200);
        const desp = await leerTotales();
        const bajo = desp.total !== null && desp.total < antes - 0.001;
        v('DM-PED-DSC-002', 'Descuento global aplica y baja el total', bajo ? 'PASS' : 'FAIL',
          `opción "${r.opcion}" (${r.tipo}; ofrecía: ${r.todas.join(' | ')}) · ` +
          `Total ${antes} → ${desp.total}` +
          (bajo ? '' : ' — 🔴 el descuento global se seleccionó pero el total NO bajó'));
        totalesTrasAlta = desp;
      }
    }
  } catch (e) {
    v('DM-PED-DSC-002', 'Descuento global aplica y baja el total', 'BLOCKED', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-TOT-001: aritmética del Tab Total
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠ La app calcula con precisión completa y redondea SOLO al presentar: una
  //   diferencia de un céntimo NO es descuadre (medido en latino_cosmetica).
  //   Se tolera 0,02 por línea del carrito.
  try {
    const t = totalesTrasAlta;
    if (!t || t.total === null || t.base === null) {
      v('DM-PED-TOT-001', 'Aritmética del Tab Total (Base − Desc + IVA = Total)', 'BLOCKED',
        `no se pudieron leer las cifras (base: ${t ? t.base : '?'}, total: ${t ? t.total : '?'})`);
    } else {
      const nLineas = (await lineasCarrito()) || 1;
      const tol = 0.02 * nLineas + 0.01;
      const esperado = t.base - (t.descuento || 0) + (t.iva || 0);
      const dif = Math.abs(esperado - t.total);
      v('DM-PED-TOT-001', 'Aritmética del Tab Total (Base − Desc + IVA = Total)',
        dif <= tol ? 'PASS' : 'FAIL',
        `${t.base} − ${t.descuento || 0} + ${t.iva || 0} = ${esperado.toFixed(4)} vs Total ${t.total} · ` +
        `diferencia ${dif.toFixed(4)} (tolerancia ${tol.toFixed(2)} por redondeo de presentación, ${nLineas} línea/s)`);
    }
  } catch (e) {
    v('DM-PED-TOT-001', 'Aritmética del Tab Total', 'BLOCKED', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-026: trash desde el Tab Total → recalcula
  // ══════════════════════════════════════════════════════════════════════════
  try {
    if (!lineaOk) throw new Error('sin líneas que borrar');
    await clickTab('Total');
    const antes = await leerTotales();
    const nAntes = await lineasCarrito();

    // 🔴 En algunos builds los accordions de producto están ANIDADOS dentro del
    //    de línea y nacen con rect 0×0 ⇒ hay que expandir DOS niveles.
    //    En otros son planos. Se expande todo lo expandible y se busca el trash.
    await pg.evaluate(() => {
      for (const a of document.querySelectorAll('app-pedido ion-accordion')) {
        try { const g = a.closest('ion-accordion-group'); if (g && a.value) g.value = a.value; } catch (_) {}
      }
    });
    await pg.waitForTimeout(1200);

    // 🔴 El trash sale bajo el fold (y≈756-1003 con viewport 744): scrollIntoView
    //    + RE-LEER el rect. Un rect válido no es un punto clickeable.
    const puesto = await pg.evaluate(() => {
      const b = [...document.querySelectorAll('app-pedido ion-button[color="danger"]')]
        .filter(x => x.getBoundingClientRect().height > 0)[0];
      if (!b) return false;
      b.scrollIntoView({ block: 'center' });
      return true;
    });
    if (!puesto) throw new Error('no se encontró el botón de borrado en el Tab Total');
    await pg.waitForTimeout(600);
    const c = await pg.evaluate(() => {
      const b = [...document.querySelectorAll('app-pedido ion-button[color="danger"]')]
        .filter(x => x.getBoundingClientRect().height > 0)[0];
      if (!b) return null;
      const r = b.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!c) throw new Error('el botón de borrado quedó fuera del viewport tras el scroll');
    await pg.mouse.click(c.x, c.y, { delay: 80 });
    await pg.waitForTimeout(1800);
    await limpiarAlertas(1);

    const desp = await leerTotales();
    const nDesp = await lineasCarrito();
    const cambio = (nAntes !== null && nDesp !== null && nDesp < nAntes) ||
                   (antes.total !== null && desp.total !== null && desp.total !== antes.total);
    v('DM-PED-026', 'Borrar línea desde el Tab Total → recalcula', cambio ? 'PASS' : 'FAIL',
      `líneas ${nAntes} → ${nDesp} · Total ${antes.total} → ${desp.total}`);
  } catch (e) {
    v('DM-PED-026', 'Borrar línea desde el Tab Total → recalcula', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-030: Guardar → alert de confirmación
  // ══════════════════════════════════════════════════════════════════════════
  // Tras PED-026 el carrito puede haber quedado vacío: se repone una línea.
  let guardadoOk = false;
  try {
    let n = await lineasCarrito();
    if (n !== null && n === 0) {
      await clickTab('Pedido');
      await pg.waitForTimeout(1200);
      // 🔴 `null` a propósito: CUALQUIER producto vale para reponer. El objetivo
      //    aquí es tener una línea con la que ejercitar Guardar y Enviar, no
      //    repetir el del perfil — insistir con él dejó el pedido sin líneas y
      //    tumbó PED-030, PED-031, PED-032, PED-034 y PED-035 en cadena.
      const h = await localizarProducto(null, 4);
      if (!h.ok) throw new Error('no se pudo reponer la línea: ' + h.motivo);
      const s = await expandirYSellar(h.i, 'rep' + ts);
      if (s.ok) { await fillIonInput(s.inputId, '2'); await pg.waitForTimeout(1200); await limpiarAlertas(1); }
      n = await lineasCarrito();
    }
    if (n !== null && n === 0) throw new Error('el carrito quedó vacío y no se pudo reponer una línea');

    // Comentario para el round-trip. 🔴 #txComment puede quedar bajo el fold y
    //    su posición VARÍA entre aperturas ⇒ escribir por set nativo, y verificar.
    await clickTab('General');
    await pg.waitForTimeout(1000);
    await fillIonInput('ion-input#txComment', comentTest);
    const comentPuesto = await pg.evaluate(() => {
      const h = document.querySelector('ion-input#txComment');
      const i = h && (h.querySelector('input') || (h.shadowRoot && h.shadowRoot.querySelector('input')));
      return i ? i.value : null;
    });

    await pg.evaluate(() => {
      const b = document.querySelector('ion-button.imagenGuardar');
      if (b) b.scrollIntoView({ block: 'center' });
    });
    const gc = await pg.evaluate(() => {
      const b = document.querySelector('ion-button.imagenGuardar');
      if (!b || b.disabled) return null;
      const r = b.getBoundingClientRect();
      return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    });
    if (!gc) throw new Error('botón Guardar ausente o deshabilitado');
    await pg.mouse.click(gc.x, gc.y, { delay: 100 });
    await pg.waitForTimeout(2500);

    // 🔴 EL PRIMER DIÁLOGO ES UNA PREGUNTA, NO EL RESULTADO.
    //    Sale «¿Desea guardar el pedido?» con Cancelar/Aceptar: hasta que no se
    //    acepta, NO se ha guardado nada. El guion lo tomaba por la confirmación
    //    (y además buscaba /guardad/i, que NO casa con «guardar»), así que daba
    //    FAIL con el pedido intacto y arrastraba a PED-031 y REQ-003.
    const secuencia = [];
    let a = await alertInfo();
    if (a && /¿desea guardar|desea guardar/i.test(`${a.titulo} ${a.mensaje}`)) {
      secuencia.push(`pregunta: "${a.mensaje || a.titulo}" [${a.botones.join('/')}]`);
      await clickAlertBtn(['aceptar', 'ok', 'sí', 'si']).catch(() => {});
      await pg.waitForTimeout(2500);
      a = await alertInfo();
    }
    if (a) secuencia.push(`respuesta: "${a.mensaje || a.titulo}" [${a.botones.join('/')}]`);

    // El oráculo del guardado NO es la alerta: es que el pedido exista de verdad.
    // La alerta puede faltar o cambiar de texto entre builds.
    const alertaOk = !!(a && /guardad|guardado con éxito|exitosamente/i.test(`${a.titulo} ${a.mensaje}`));
    if (a) await clickAlertBtn(['ok', 'aceptar']).catch(() => {});
    await pg.waitForTimeout(1500);

    const enLocal = (() => {
      try {
        const f = localQuery("SELECT co_order, id_order, st_delivery FROM orders ORDER BY rowid DESC LIMIT 1");
        return f.length ? f[0] : null;
      } catch (_) { return null; }
    })();

    guardadoOk = alertaOk || !!enLocal;
    v('DM-PED-030', 'Guardar pedido → confirma y el pedido queda guardado',
      guardadoOk ? 'PASS' : 'FAIL',
      `${secuencia.join(' → ') || 'sin diálogos'} · comentario: "${comentPuesto}" · ` +
      `en la BD local: ${enLocal ? `co_order=${enLocal.co_order}, st_delivery=${enLocal.st_delivery}` : 'nada'}`);
  } catch (e) {
    v('DM-PED-030', 'Guardar pedido → alert de confirmación', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REQ Enviar · E5 — el pedido está completo, justo antes de enviarlo
  // ══════════════════════════════════════════════════════════════════════════
  // 🔴 SOLO si el pedido llegó a guardarse. E5 pregunta «¿queda alguna pestaña
  //    en rojo cuando NO falta nada?». Con el carrito vacío sí falta algo —el
  //    producto—, así que la pestaña Pedido en rojo es CORRECTA y reportarla
  //    como F1 es una falsa alarma. Es el mismo error que la QA cazó en la 1.ª
  //    vuelta: medir antes de que la transacción esté realmente completa.
  if (guardadoOk) {
    reqV(await reqPestanaRoja(pg, 'PED', { rotar: true }));
  } else {
    v('DM-PED-REQ-003', 'REQ · Sin pestaña en rojo falso con el formulario completo (F1)',
      'BLOCKED', 'el pedido no llegó a completarse: con el carrito vacío una pestaña en rojo ' +
      'es correcta y medirla aquí daría un F1 falso');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-031: Enviar → secuencia de alerts → home
  // ══════════════════════════════════════════════════════════════════════════
  let nroRef = null;
  try {
    if (!guardadoOk) throw new Error('el pedido no llegó a guardarse (ver PED-030)');
    const ec = await pg.evaluate(() => {
      const b = document.querySelector('ion-button.imagenEnviar');
      if (!b || b.disabled) return null;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    });
    if (!ec) throw new Error('botón Enviar ausente o deshabilitado');
    await pg.mouse.click(ec.x, ec.y, { delay: 100 });

    // 🔴 La secuencia es de 2 O 3 alerts según el build/cliente: no fijar el nº.
    //    Se van cerrando y se captura el nº de referencia si alguna lo trae.
    const etiquetas = [];
    for (let i = 0; i < 4; i++) {
      await pg.waitForTimeout(1600);
      const a = await alertInfo();
      if (!a) break;
      etiquetas.push(`${(a.mensaje || a.titulo).slice(0, 45)} [${a.botones.join('/')}]`);
      const m = `${a.titulo} ${a.mensaje}`.match(/nro\.?\s*(\d+)/i);
      if (m) nroRef = m[1];
      await clickAlertBtn(['aceptar', 'ok']);
    }
    await pg.waitForTimeout(2500);

    const enHome = (await visible('app-pedidos')) && !(await visible('app-pedido'));

    // ☁ EL ORÁCULO ES LA NUBE, no la pantalla. Y se cuentan las filas: si un
    //   solo Enviar deja DOS pedidos con la misma marca, es duplicado y NO es PASS.
    let nube = null;
    if (DATA.clienteSlug) {
      for (let i = 0; i < 5; i++) {
        nube = consultaNube(DATA.clienteSlug,
          `select id_order, co_order, st_order, nu_amount_total, co_currency, co_client ` +
          `from \"order\" where tx_comment = '${comentTest}' order by id_order`);
        if (nube && nube.length) break;
        await pg.waitForTimeout(3000);
      }
    }
    const enNube    = !!(nube && nube.length);
    const duplicado = !!(nube && nube.length > 1);
    const resumenNube = enNube
      ? nube.map(f => `${f.id_order}/${f.co_order} ${f.nu_amount_total} ${f.co_currency || ''} st=${f.st_order}`).join(' · ')
      : null;

    v('DM-PED-031', 'Enviar pedido → llega a la nube (y UNA sola fila)',
      (enNube && !duplicado) ? 'PASS' : (DATA.clienteSlug ? 'FAIL' : (enHome ? 'PASS' : 'FAIL')),
      `${etiquetas.length} alert(s): ${etiquetas.join(' → ')} · Nro.Ref: ${nroRef || 'no anunciado'} · ` +
      `home tras enviar: ${enHome} · ` +
      (DATA.clienteSlug
        ? (enNube
            ? `☁ ${nube.length} fila(s) con la marca ${comentTest}: ${resumenNube}` +
              (duplicado ? ' · 🔴 DUPLICADO: un solo Enviar dejó más de un pedido' : '')
            : `✗ no aparece en la nube ningún pedido con comentario ${comentTest} — ` +
              `volver al home NO prueba que se haya enviado`)
        : 'sin clienteSlug: no se pudo consultar la nube (oráculo degradado a la pantalla)'));
  } catch (e) {
    v('DM-PED-031', 'Enviar pedido → confirmación y vuelta al home', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Cotejo BD — nunca tumba el smoke (RUNTIME §10)
  // ══════════════════════════════════════════════════════════════════════════
  let notaBD = 'BD-N/A';
  try {
    // ⚠ La tabla local es PLURAL: `orders`. Y `st_order=1` sale también en
    //   GUARDADOS: el discriminador fiable es st_delivery (3=guardado/1=enviado)
    //   junto con id_order (0 vs PK del servidor).
    const filas = localQuery(
      "SELECT co_order, id_order, st_delivery, nu_details FROM orders ORDER BY rowid DESC LIMIT 3");
    if (filas.length) {
      const f = filas[0];
      notaBD = f.id_order > 0 && f.st_delivery === 1 ? 'BD-OK'
             : f.id_order === 0 ? 'BD-SAVED' : 'BD-INFO';
      notaBD += ` (id_order=${f.id_order}, st_delivery=${f.st_delivery}, líneas=${f.nu_details})`;
    }
  } catch (_) {}

  try {
    const caps = await getCapturedPayloads(pg).catch(() => []);
    const pOrder = (caps || []).filter(c => /order/i.test(c.url || ''));
    if (pOrder.length) {
      const marca = cotejoPayload(DATA.clienteSlug, pOrder[pOrder.length - 1]);
      notaBD += ` · payload↔nube: ${marca} (${pOrder.length} POST capturado/s)`;
    }
  } catch (_) {}

  /**
   * Deja la LISTA de pedidos a la vista y devuelve cuantos items tiene.
   *
   * 🔴 UN CERO NO ES UN RESULTADO. Antes se pulsaba BUSCAR, se dormian 2,5 s
   *    fijos y se contaba. En la vuelta 3 eso devolvio **0 items** y tumbo
   *    DM-PED-034, 035 y 032 - pero la lista estaba LLENA: el propio pedido
   *    recien enviado (Nro. Ref. 2596) se leia en pantalla. Simplemente aun no
   *    habia pintado. Ahora se ESPERA a que cargue, y si de verdad no carga, el
   *    veredicto lo dice en vez de disfrazarlo de "no hay pedidos".
   */
  async function abrirListaPedidos(intentos = 3) {
    for (let n = 0; n < intentos; n++) {
      await irAHomePedidos().catch(() => {});
      // ⚠ Justo después de ENVIAR, la app está volviendo al home y el primer
      //   BUSCAR se pierde: la vuelta 4 dio «la lista no cargó — en la página:
      //   false» con la pantalla todavía en «PEDIDO BUSCAR COPIAR», y dos casos
      //   después la misma lista tenía 8 ítems. Se deja asentar antes de pulsar.
      await pg.waitForTimeout(1500);
      await clickBotonHome('BUSCAR').catch(() => {});
      for (let i = 0; i < 12; i++) {
        await pg.waitForTimeout(1000);
        const r = await pg.evaluate(() => {
          const pag = document.querySelector('app-pedidos-lista');
          const its = [...document.querySelectorAll('app-pedidos-lista ion-item')]
            .filter(x => x.getBoundingClientRect().height > 0);
          return { enLista: !!pag && !pag.classList.contains('ion-page-hidden'), n: its.length };
        });
        if (r.enLista && r.n > 0) return r;
        // Si a mitad de espera seguimos en el home del módulo, el clic no llegó:
        // no tiene sentido agotar los 12 s mirando la pantalla equivocada.
        if (i === 4 && !r.enLista) break;
      }
    }
    return pg.evaluate(() => {
      const pag = document.querySelector('app-pedidos-lista');
      return { enLista: !!pag && !pag.classList.contains('ion-page-hidden'), n: 0,
               texto: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120) };
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-034 / 035: BUSCAR → searchbar filtra → abrir un Guardado
  // ══════════════════════════════════════════════════════════════════════════
  let abrioGuardado = false;
  try {
    const est = await abrirListaPedidos();
    const antes = est.n;
    if (!antes) {
      v('DM-PED-034', 'BUSCAR -> el searchbar filtra en tiempo real', 'BLOCKED',
        `la lista no cargo ningun pedido en 12 s (en la pagina: ${est.enLista}) - ` +
        `sin items no hay nada que filtrar${est.texto ? ` · pantalla: ${est.texto}` : ''}`);
      throw new Error('__lista_vacia__');
    }

    await pg.evaluate(() => {
      const sb = document.querySelector('app-pedidos-lista ion-searchbar');
      if (!sb) return;
      const i = sb.querySelector('input') || (sb.shadowRoot && sb.shadowRoot.querySelector('input'));
      if (!i) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(i, 'ZZZZZZ');
      i.dispatchEvent(new Event('input', { bubbles: true }));
      sb.dispatchEvent(new CustomEvent('ionInput', { bubbles: true, detail: { value: 'ZZZZZZ' } }));
    });
    await pg.waitForTimeout(1800);
    const filtrado = await pg.evaluate(() =>
      [...document.querySelectorAll('app-pedidos-lista ion-item')]
        .filter(i => i.getBoundingClientRect().height > 0).length);

    // Vaciar para restaurar la lista
    await pg.evaluate(() => {
      const sb = document.querySelector('app-pedidos-lista ion-searchbar');
      if (!sb) return;
      const i = sb.querySelector('input') || (sb.shadowRoot && sb.shadowRoot.querySelector('input'));
      if (!i) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(i, '');
      i.dispatchEvent(new Event('input', { bubbles: true }));
      sb.dispatchEvent(new CustomEvent('ionInput', { bubbles: true, detail: { value: '' } }));
    });
    await pg.waitForTimeout(1800);
    const repoblado = await pg.evaluate(() =>
      [...document.querySelectorAll('app-pedidos-lista ion-item')]
        .filter(i => i.getBoundingClientRect().height > 0).length);

    v('DM-PED-034', 'BUSCAR → el searchbar filtra en tiempo real',
      filtrado < antes ? 'PASS' : 'FAIL',
      `${antes} ítems → "ZZZZZZ" → ${filtrado} → al vaciar → ${repoblado}`);
  } catch (e) {
    if (e.message !== '__lista_vacia__') {
      v('DM-PED-034', 'BUSCAR → el searchbar filtra en tiempo real', 'FAIL', e.message);
    }
  }

  try {
    // Asegurar que la lista esté cargada también aquí: 034 pudo salir por el
    // camino corto y dejar la pantalla a medias.
    await abrirListaPedidos(1);
    // 🔴 Click en la zona izquierda-centro: el botón danger de la derecha es
    //    estrecho (w≈29) y un click bajo cae fuera y navega al form igual.
    const c = await pg.evaluate(() => {
      const items = [...document.querySelectorAll('app-pedidos-lista ion-item')]
        .filter(i => i.getBoundingClientRect().height > 0);
      const guardado = items.find(i => /guardado/i.test(i.textContent)) || items[0];
      if (!guardado) return null;
      guardado.scrollIntoView({ block: 'center' });
      const r = guardado.getBoundingClientRect();
      return { x: r.x + r.width * 0.35, y: r.y + r.height * 0.4 };
    });
    if (!c) throw new Error('sin pedidos en la lista');
    await pg.mouse.click(c.x, c.y, { delay: 80 });

    // 🔴 Reabrir un Guardado tarda >4 s; a los ~9 s está rehidratado. Medir
    //    antes da tabs disabled y #txComment VACÍO ⇒ falso "no persistió".
    let tabs = [], coment = null;
    for (let i = 0; i < 12; i++) {
      await pg.waitForTimeout(1000);
      tabs = await leerTabs();
      coment = await pg.evaluate(() => {
        const h = document.querySelector('ion-input#txComment');
        const n = h && (h.querySelector('input') || (h.shadowRoot && h.shadowRoot.querySelector('input')));
        return n ? n.value : null;
      });
      if (tabs.filter(t => !t.disabled).length >= 3 && coment) break;
    }
    abrioGuardado = tabs.length > 0;
    v('DM-PED-035', 'Abrir un pedido de la lista → formulario rehidratado',
      abrioGuardado ? 'PASS' : 'FAIL',
      `tabs: ${tabs.map(t => `${t.nombre}${t.disabled ? '(bloq)' : ''}`).join(' · ') || 'ninguna'} · ` +
      `comentario rehidratado: "${coment}"`);
  } catch (e) {
    v('DM-PED-035', 'Abrir un pedido de la lista → formulario rehidratado', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-032: atrás con el formulario sucio → modal de 3 opciones
  // ══════════════════════════════════════════════════════════════════════════
  try {
    if (!abrioGuardado) throw new Error('no hay formulario abierto que ensuciar');
    // Reabrir un Guardado con ítems YA deja el form dirty (la rehidratación
    // ensucia): no hace falta editar nada. Es comportamiento defensivo, no FAIL.
    await clickBack();
    await pg.waitForTimeout(1500);
    const a = await alertInfo();
    const tres = !!(a && a.botones.length >= 3);
    v('DM-PED-032', 'Atrás con cambios → modal Guardar/Salir sin guardar/Cancelar',
      tres ? 'PASS' : 'N/A',
      a ? `botones: ${a.botones.join(' / ')}`
        : 'no apareció el dirty-guard — el form estaba pristine (salida directa; ver nota del selector: no es FAIL)');
    if (a) {
      await clickAlertBtn(['salir sin guardar', 'cancelar', 'ok']).catch(() => {});
    }
  } catch (e) {
    v('DM-PED-032', 'Atrás con cambios → dirty-guard', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DM-PED-037: borrar un Guardado desde la lista
  // ══════════════════════════════════════════════════════════════════════════
  try {
    const antes = (await abrirListaPedidos()).n;

    // 🔴 El botón danger es ESTRECHO (w≈29) y va pegado al borde derecho:
    //    hay que usar sus coords exactas, no las del ítem.
    const c = await pg.evaluate(() => {
      const b = [...document.querySelectorAll('app-pedidos-lista ion-button[color="danger"]')]
        .filter(x => x.getBoundingClientRect().height > 0)[0];
      if (!b) return null;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!c) {
      v('DM-PED-037', 'Borrar un pedido Guardado desde la lista', 'N/A',
        `sin botón de borrado en la lista (${antes} ítem/s): sólo los Guardado lo muestran`);
    } else {
      await pg.mouse.click(c.x, c.y, { delay: 80 });
      await pg.waitForTimeout(1500);
      const a = await alertInfo();
      if (a) await clickAlertBtn(['aceptar', 'ok']);
      await pg.waitForTimeout(2200);
      const desp = await pg.evaluate(() =>
        [...document.querySelectorAll('app-pedidos-lista ion-item')]
          .filter(i => i.getBoundingClientRect().height > 0).length);
      v('DM-PED-037', 'Borrar un pedido Guardado desde la lista',
        desp < antes ? 'PASS' : 'FAIL',
        `confirmación: "${a ? (a.mensaje || a.titulo).slice(0, 60) : 'ninguna'}" · ${antes} → ${desp} ítems`);
    }
  } catch (e) {
    v('DM-PED-037', 'Borrar un pedido Guardado desde la lista', 'FAIL', e.message);
  }

  // Anotar el cotejo de BD en el caso de envío, sin inventar un caso nuevo
  const vEnvio = verdicts.find(x => x.id === 'DM-PED-031');
  if (vEnvio) vEnvio.nota += ` · ${notaBD}`;

  await irAHomePedidos();
  return { verdicts, msTotal: Date.now() - t0 };
}

module.exports = { runPedidos: conReq('PED', runPedidos) };
