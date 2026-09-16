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

// JPEG 1x1 válido (mismo del helper CDP) para inyectar como adjunto sin cámara.
const BASE64_1PX_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH' +
  'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwf/wAARC' +
  'AABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA' +
  'AAAAAAAAAAAAAP/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAA' +
  'AAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';

function localQuery(sql) {
  try {
    return JSON.parse(
      execFileSync('node', [LOCAL_QUERY_PATH, sql], { encoding: 'utf8', timeout: 15000 })
    );
  } catch (_) { return []; }
}

/**
 * Consulta la BD en la NUBE del cliente. Devuelve las filas o null si no se pudo.
 *
 * 🔑 Es el oráculo bueno para el ENVÍO. Guardar es local (SQLite del equipo);
 *    enviar es lo único que POSTea. Contar ítems «Enviado» en la lista de la UI
 *    resultó frágil: el 07/09 dio FAIL tres veces seguidas por leer la lista
 *    antes de que pintara, mientras los cobros SÍ estaban en la nube.
 */
function consultaNube(slug, sql) {
  try {
    return JSON.parse(
      execFileSync('node', [NUBE_QUERY_PATH, slug, sql], { encoding: 'utf8', timeout: 30000 })
    );
  } catch (_) { return null; }
}

/**
 * INVENTARIO DE DOCUMENTOS LIBRES — el pre-vuelo del módulo.
 *
 * 🔑 Por qué desde la BD LOCAL del equipo y no desde la nube. El Tab Documentos
 *    lo pinta la app leyendo SU sqlite, así que ése es el inventario que manda.
 *    La nube miente en las dos direcciones:
 *      · `document_sale.co_collection` sigue en NULL aunque el documento ya esté
 *        comprometido por un cobro «Por aprobar» ⇒ sobra documentos que no están;
 *      · y la nube no sabe qué se bajó a ESTE equipo ⇒ cuenta documentos de
 *        clientes que este vendedor ni siquiera ve.
 *    El 14/09 la nube daba 28 documentos libres para C.1016 y la pantalla decía
 *    «No hay documentos USD». El sqlite del equipo acierta porque es la misma
 *    fuente que lee la pantalla.
 *
 * 🔴 Y el descuento que hay que hacerle: un documento con saldo NO está libre si
 *    ya lo agarró un cobro del equipo (guardado o enviado-por-aprobar). Eso vive
 *    en `collection_details.co_document`. Sin restarlo, el inventario dice 97 y
 *    la pantalla dice 0.
 *
 * Las NOTAS DE CRÉDITO llevan saldo NEGATIVO (es saldo a favor), así que se
 * cuentan aparte: `nu_balance > 0` las dejaría fuera sin querer.
 */
function inventarioDocumentosLibres() {
  const LIBRE = `d.co_document NOT IN (SELECT co_document FROM collection_details WHERE co_document IS NOT NULL)`;
  const porDoc = localQuery(
    `SELECT d.co_client, d.co_document_sale_type tipo, d.co_currency, ` +
    `       round(d.nu_balance, 2) saldo ` +
    `FROM document_sales d WHERE ${LIBRE} AND d.nu_balance <> 0 ` +
    `ORDER BY d.nu_balance DESC`);
  if (!Array.isArray(porDoc)) {
    return { ok: false, motivo: 'no se pudo leer la BD local del equipo', total: null,
             usd: null, bs: null, porCliente: [], clientes: [], notasCredito: [] };
  }
  const cobrables = porDoc.filter(d => Number(d.saldo) > 0);
  const notasCredito = porDoc.filter(d => Number(d.saldo) < 0);
  const esBs = (c) => !/^(usd|us\$)/i.test(String(c || ''));
  const mapa = new Map();
  for (const d of cobrables) {
    const k = d.co_client;
    const e = mapa.get(k) || { cliente: k, n: 0, usd: 0, bs: 0, saldoMax: 0, saldoMin: Infinity };
    e.n++;
    if (esBs(d.co_currency)) e.bs++; else e.usd++;
    e.saldoMax = Math.max(e.saldoMax, Number(d.saldo) || 0);
    e.saldoMin = Math.min(e.saldoMin, Number(d.saldo) || 0);
    mapa.set(k, e);
  }
  // Orden: primero quien más documentos libres tiene y, a igualdad, quien tiene
  // el saldo más alto — los casos de tolerancia y descuento necesitan un
  // documento con saldo holgado, no el de 0,50.
  const porCliente = [...mapa.values()].sort((a, b) => (b.n - a.n) || (b.saldoMax - a.saldoMax));
  return {
    ok: true,
    total: cobrables.length,
    usd: cobrables.filter(d => !esBs(d.co_currency)).length,
    bs:  cobrables.filter(d =>  esBs(d.co_currency)).length,
    porCliente,
    clientes: porCliente.map(e => e.cliente),
    // Clientes cuyos documentos libres TODOS pasan del umbral.
    //
    // 🔑 `saldoMin`, no `saldoMax`: el guion marca el PRIMER documento que
    //    lista la pantalla, y no hay garantía de que sea el grande. Un cliente
    //    con facturas de 886,00 y de 0,50 no sirve para pagar 10,01 de menos si
    //    la que sale primero es la de 0,50 — y el caso moriría con un «no se
    //    pudo pagar» que parece de la app y es de elección de dato.
    clientesConSaldo: (umbral) => porCliente
      .filter(e => e.saldoMin >= umbral).map(e => e.cliente),
    notasCredito,
    // Clientes que tienen A LA VEZ factura libre y nota de crédito: sin esto no
    // se puede probar «parcial + nota de crédito» en un mismo cobro.
    conNotaYFactura: notasCredito
      .map(n => n.co_client)
      .filter(c => mapa.has(c)),
    resumen: `${cobrables.length} documentos libres (USD ${cobrables.filter(d => !esBs(d.co_currency)).length} · ` +
             `Bs ${cobrables.filter(d => esBs(d.co_currency)).length}) en ${porCliente.length} clientes · ` +
             `notas de crédito con saldo a favor: ${notasCredito.length}`,
  };
}

/**
 * Monto ORIGINAL del documento cuyo saldo es `saldo`, para ese cliente.
 *
 * 🔑 Hace falta porque el descuento por porcentaje se calcula sobre el MONTO del
 *    documento y no sobre su saldo, y en pantalla sólo se ve el saldo. Con
 *    facturas sin abonos los dos números coinciden y nadie lo nota; con una
 *    factura abonada (857,00 de monto, 325,00 de saldo) el oráculo que asume
 *    «saldo == monto» da un FAIL que no es de la app.
 */
function montoDocumentoLocal(cliente, saldo) {
  if (!cliente || saldo === null || saldo === undefined) return null;
  const r = localQuery(
    `SELECT round(nu_amount_total, 2) total FROM document_sales ` +
    `WHERE co_client = '${String(cliente).replace(/'/g, "''")}' ` +
    `  AND abs(nu_balance - ${Number(saldo)}) < 0.011 LIMIT 1`);
  return Array.isArray(r) && r.length ? Number(r[0].total) : null;
}

/** Corre cotejo-payload.js con un payload capturado ({url,data}). Devuelve marca o 'BD-N/A'. */
function cotejoPayload(slug, payload) {
  const tmp = path.join(os.tmpdir(), `qa_cob_payload_${Date.now()}.json`);
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
 * modules/cobros.js — FASE 1 · núcleo co_type 0 (cobro normal)
 *
 * Cobertura Fase 1: DM-COB-001/002/004/007/008/009/016/018/022/024/026/020/021 (+ 019 con adjunto).
 * Descuento de cobro: 048 (botón en el detalle) · 049 (bajo el tope) · 050 (suma que excede)
 *   · 051 (borde exacto con tasa escrita). Se ejercitan y se CANCELAN: no alteran el cobro.
 * N/A por VG: 006 (requiredComment), 036/044/045 (IGTF), 037 (25% IVA).
 * FASE 2 (marcados BLOCKED-fase2): 033/034 moneda, 012/040/043 diferencia, 014/015 Total,
 *   028 anticipo (co_type 1), 029/041/042 retención (co_type 2), 046 parcial, 047/039 fecha-tasa, 038.
 *
 * Selectores: automation/cdp/module-selectors/cobros.md (adaptados de MCP a Playwright standalone).
 * Patrón base: modules/depositos.js (banco/pagos/cotejo/dirty-guard).
 *
 * @param {import('playwright').Page} pg
 * @param {{ aplica:boolean, clienteTest:string, clientesConDocumentos:string[],
 *           requiredCollectionAttachments:boolean, requiredComment:boolean, multiCurrency:boolean,
 *           retencion:boolean, cobroRetencion:boolean, cobroPrepago:boolean, userCanSelectIGTF:boolean,
 *           userCanCollectIva:boolean, sizeRetention:number, metodoPago:string,
 *           mockCamaraFunciona:boolean, clienteSlug:string }} DATA
 */
async function runCobros(pg, DATA) {
  const t0 = Date.now();
  const verdicts = [];

  // 🔴 Red de seguridad: si algo revienta sin capturar, run.js sustituía TODOS
  //    los veredictos por un único BLOCKED y la vuelta se perdía entera (pasó el
  //    15/09 con una zona muerta temporal: 7 minutos de conducción y 0 casos
  //    medidos). Publicando la lista, el orquestador conserva lo ya medido.
  global.__qaVerdictsParciales = verdicts;

  function v(id, desc, resultado, nota = '') {
    verdicts.push({ id, descripcion: desc, resultado, nota, ms: Date.now() - t0 });
  }

  // Regresión permanente del REQ «Botón Enviar y campos obligatorios» (../req-enviar.js)
  const reqV = (r) => v(r.id, r.descripcion, r.resultado, r.nota);

  // Orden de ejecución (Fase 1 primero; Fase 2 al final como BLOCKED-fase2)
  // ── IDs NUEVOS del cierre del módulo (15/09) ───────────────────────────────
  // Cinco familias que QA pidió cubrir de verdad. Si alguno no llega a emitirse
  // —porque la cartera se agotó a mitad— cae al fallback del final, que dice
  // «no llegó a ejecutarse» con el inventario delante, NO «pendiente de Fase 2».
  //   000     · pre-vuelo: inventario de documentos libres
  //   034-BS  · la mitad «Bs» de 034, declarada aparte (no cubrible en 4K)
  //   059/060 · tolerancia NEGATIVA, los dos bordes
  //   061/062 · descuento por MONTO · descuento mayor que el saldo (no-regresión)
  //   063/064 · parcial con remanente en la nube · parcial + nota de crédito
  //   065/066/067 · retención: nube por columnas · dígitos del comprobante · +parcial
  //   068     · IVA cobrado, comprobado en la UI
  //   069     · ¿es ejercitable el tope del descuento por porcentaje?
  const NUEVOS = ['DM-COB-000','DM-COB-034-BS',
    'DM-COB-059','DM-COB-060','DM-COB-061','DM-COB-062','DM-COB-063','DM-COB-064',
    'DM-COB-065','DM-COB-066','DM-COB-067','DM-COB-068','DM-COB-069',
    // 15/09 - el aviso de saldo a favor, en los DOS ordenes de acciones
    'DM-COB-070','DM-COB-071'];

  const FASE2 = ['DM-COB-033','DM-COB-034',
    'DM-COB-014','DM-COB-015','DM-COB-028','DM-COB-029','DM-COB-041','DM-COB-042',
    'DM-COB-046','DM-COB-047','DM-COB-039','DM-COB-038'];
  const TODOS = ['DM-COB-001','DM-COB-002','DM-COB-004','DM-COB-006','DM-COB-007',
    'DM-COB-008','DM-COB-009','DM-COB-016','DM-COB-018','DM-COB-019','DM-COB-022',
    'DM-COB-024','DM-COB-026','DM-COB-020','DM-COB-021','DM-COB-036','DM-COB-037',
    'DM-COB-044','DM-COB-045',
    // Descuento de cobro (tope maxCollectDiscount) — construidos el 07/09
    'DM-COB-048','DM-COB-049','DM-COB-050','DM-COB-051','DM-COB-052',
    'DM-COB-053','DM-COB-054','DM-COB-055',
    // Tolerancia positiva y anticipo automatico - IDs NUEVOS creados el 14/09.
    // Todavia no estan en guiones-regresion/guion-cobros.md: hay que darlos de alta.
    'DM-COB-056','DM-COB-057','DM-COB-058',
    ...NUEVOS,
    ...FASE2, ...reqIds('COB')];

  /**
   * Clientes que en ESTA corrida ya se comprobó que no listan documentos.
   *
   * 🔴 Cada cobro ENVIADO se come su documento: queda «Por aprobar» y desaparece
   *    del Tab Documentos. Una corrida completa gasta 5-7 documentos, así que a
   *    mitad de camino el cliente que servía al principio deja de servir. Sin
   *    esto, el 2.º cobro, el de eliminar y los dos de tolerancia se caían todos
   *    con «C.XXXX no tiene documentos disponibles» — cuatro BLOCKED por un dato
   *    caducado, no por la app. Se apunta quién se agotó y no se vuelve a pedir.
   *
   * ⚠ Se declara AQUÍ, no junto a `abrirCobroConDocumento` (que vive en el bloque
   *   de Fase 2, al final): `montarCobro` lo usa antes y un `const` en zona muerta
   *   temporal revienta con «Cannot access before initialization».
   */
  const clientesSinDocs = new Set();

  if (!DATA.aplica) {
    TODOS.forEach(id => v(id, id, 'N/A', 'aplica=false en perfil cobros'));
    return { verdicts, msTotal: Date.now() - t0 };
  }

  try { await installPayloadCapture(pg); } catch (_) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // VARIABLES GLOBALES: MANDA EL EQUIPO, NO EL YAML
  //
  // 🔴 El perfil se desactualiza y decide N/A. El 14/09 el YAML de 4K traía
  //    `maxCollectDiscount: 85` cuando el equipo tenía **0**, `clientBankAccount:
  //    false` cuando el equipo tenía **true** y `validateCollectionDate: true`
  //    cuando el equipo tenía **false**. Marcar N/A —o peor, dar PASS— con un
  //    valor viejo es exactamente el escape que ya costó cuatro defectos:
  //    se validaba PRESENCIA, no CONFORMIDAD con la config vigente.
  //
  //    `localStorage.globalConfiguration` es un array de pares [clave, valor]
  //    con los valores EFECTIVOS que bajó el último login. Se leen de ahí, se
  //    pisan los del YAML y se anota la divergencia en el informe para que
  //    alguien actualice el perfil.
  // ═══════════════════════════════════════════════════════════════════════════
  const vgDrift = [];
  try {
    const vgEq = await pg.evaluate(() => {
      try {
        const raw = JSON.parse(localStorage.globalConfiguration);
        return Array.isArray(raw) ? Object.fromEntries(raw) : raw;
      } catch (_) { return null; }
    });
    if (vgEq && Object.keys(vgEq).length) {
      const asBool = (s) => String(s).trim().toLowerCase() === 'true';
      const asNum  = (s) => { const n = Number(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null; };
      // clave del equipo → campo de DATA · cómo se convierte
      const MAPA = {
        requiredCollectionAttachments: ['requiredCollectionAttachments', asBool],
        requiredComment:               ['requiredComment',               asBool],
        multiCurrency:                 ['multiCurrency',                 asBool],
        multiCurrencyCollection:       ['multiCurrencyCollection',       asBool],
        retencion:                     ['retencion',                     asBool],
        cobroRetencion:                ['cobroRetencion',                asBool],
        cobroPrepago:                  ['cobroPrepago',                  asBool],
        userCanAddRetention:           ['userCanAddRetention',           asBool],
        dynamicRetentions:             ['dynamicRetentions',             asBool],
        userCanSelectIGTF:             ['userCanSelectIGTF',             asBool],
        userCanCollectIva:             ['userCanCollectIva',             asBool],
        userCanSelectCollectDiscount:  ['userCanSelectCollectDiscount',  asBool],
        retentionDocTypeCR:            ['retentionDocTypeCR',            asBool],
        enablePartialPayment:          ['enablePartialPayment',          asBool],
        alwaysPartialPayment:          ['alwaysPartialPayment',          asBool],
        historicoTasa:                 ['historicoTasa',                 asBool],
        canChangeRate:                 ['canChangeRate',                 asBool],
        enabledManualRate:             ['enabledManualRate',             asBool],
        tolerancia0:                   ['tolerancia0',                   asBool],
        automatedPrepaid:              ['automatedPrepaid',              asBool],
        sizeRetention:                 ['sizeRetention',                 asNum],
        maxCollectDiscount:            ['maxCollectDiscount',            asNum],
        RangoToleranciaPositiva:       ['rangoToleranciaPositiva',       asNum],
        RangoToleranciaNegativa:       ['rangoToleranciaNegativa',       asNum],
        prepaidRangeAmount:            ['prepaidRangeAmount',            asNum],
        TipoTolerancia:                ['tipoTolerancia',                asNum],
        MonedaTolerancia:              ['monedaTolerancia',              String],
        prepaidCurrency:               ['prepaidCurrency',               String],
        tagIVA:                        ['tagIVA',                        String],
      };
      for (const [claveVG, [campo, conv]] of Object.entries(MAPA)) {
        if (!(claveVG in vgEq)) continue;
        const nuevo = conv(vgEq[claveVG]);
        if (nuevo === null || nuevo === undefined) continue;
        const viejo = DATA[campo];
        if (viejo !== undefined && String(viejo) !== String(nuevo)) {
          vgDrift.push(`${claveVG}: perfil=${viejo} · equipo=${nuevo}`);
        }
        DATA[campo] = nuevo;
      }
      DATA.vgLeidasDelEquipo = true;
    }
  } catch (_) { /* si no se pueden leer, se sigue con las del YAML */ }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRE-VUELO · INVENTARIO DE DOCUMENTOS LIBRES
  //
  // 🔴 Esto va ANTES de medir nada, y se escribe en el informe. La causa de
  //    fondo de los cinco BLOCKED del 14/09 («no se pudo marcar el documento»)
  //    no era la app: era que el pool se agota — 3 → 2 → 1 → 0 en un solo día,
  //    porque cada cobro ENVIADO compromete su factura. Sin este número delante,
  //    un caso sin materia prima se lee como defecto.
  //
  //    Y sirve para dos cosas más: alimentar el pool de clientes (CANDIDATOS) con
  //    quien de verdad tiene documentos HOY, y decidir por adelantado qué casos
  //    no son ejercitables (Bs, notas de crédito) en vez de descubrirlo a mitad.
  // ═══════════════════════════════════════════════════════════════════════════
  const INV = inventarioDocumentosLibres();
  const invTop = (INV.porCliente || []).slice(0, 8)
    .map(e => `${e.cliente}:${e.n}(máx ${e.saldoMax.toFixed(2)})`).join(' · ');
  v('DM-COB-000', 'Pre-vuelo: inventario de documentos libres en el equipo',
    INV.ok ? 'INFO' : 'BLOCKED',
    INV.ok
      ? `${INV.resumen} · top: ${invTop || '(ninguno)'} · ` +
        `clientes con factura libre Y nota de crédito: ${INV.conNotaYFactura.length ? INV.conNotaYFactura.join('/') : 'ninguno'}`
      : INV.motivo);
  console.log(`      📋 documentos libres: ${INV.ok ? INV.resumen : INV.motivo}`);


  // ═══════════════════════════════════════════════════════════════════════════
  // GUARDA DE CONEXIÓN CDP
  //
  // 🔴 El 15/09 la app se reinició a mitad de la vuelta 3 y el puente CDP murió.
  //    A partir de ahí TODO `page.evaluate` devolvía «Target page, context or
  //    browser has been closed», y el guion siguió encadenando casos: DOCE
  //    quedaron BLOCKED con ese mensaje, como si fueran doce hallazgos. No lo
  //    son: es UNA caída de infraestructura contada doce veces, y encima cuesta
  //    la vuelta entera.
  //
  //    Un BLOCKED tiene que decir por qué. «Se cayó el CDP» y «no había
  //    documentos» son dos cosas distintas y no pueden salir con la misma cara.
  //    En cuanto se detecta, se marca la bandera, se avisa por consola y los
  //    casos que faltan salen con ESE motivo, sin volver a tocar la pantalla.
  // ═══════════════════════════════════════════════════════════════════════════
  const RX_CDP_MUERTO = /Target (page|closed)|has been closed|Session closed|Connection closed|Protocol error|WebSocket/i;
  let cdpCaido = false;
  function chequearCdp(e) {
    if (!cdpCaido && RX_CDP_MUERTO.test(String((e && e.message) || e))) {
      cdpCaido = true;
      console.error('      🔴 CONEXIÓN CDP CAÍDA — se deja de conducir la app. ' +
        'Los casos que falten saldrán BLOCKED diciendo esto, no un veredicto inventado.');
    }
    return cdpCaido;
  }
  /** Se llama al ENTRAR en cada familia: si el CDP ya murió, no se toca la app. */
  function abortarSiCdpCaido() {
    if (cdpCaido) {
      throw new Error('la conexión CDP se cayó antes de llegar a este caso ' +
        '(la app o el puente adb se reiniciaron): el caso NO llegó a medirse. ' +
        'No es un fallo del caso ni falta de datos — hay que reponer el puente y repetir la vuelta');
    }
  }

  const ts       = String(Date.now()).slice(-6);
  const comentTest = `Test-COB-${ts}`;

  // ─── Helpers (adaptados de depositos.js + module-selectors/cobros.md) ─────────

  async function dismissIonLoadings() {
    await pg.evaluate(() => {
      document.querySelectorAll('ion-loading').forEach(el => {
        if (el.offsetParent !== null) try { el.dismiss(); } catch (_) {}
      });
    });
  }

  async function clickBack() {
    // Back de app-cobros-header = img.fechaAtras src=flecha-blanca.png → filtrar por rect, NO por src
    const coords = await pg.evaluate(() => {
      const imgs = [...document.querySelectorAll('img.fechaAtras')];
      const back = imgs.find(img => {
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.x < 100 && r.y < 120;
      });
      if (!back) return null;
      const target = back.closest('a') || back;
      const r = target.getBoundingClientRect();
      // 🔴 Segunda defensa: comprobar qué elemento recibiría el clic en ese punto.
      //    Si es el SALIR del home de la app, no se pulsa. Un script de prueba
      //    nunca debe cerrar la sesión del usuario.
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const enElPunto = document.elementFromPoint(cx, cy);
      const txt = ((enElPunto && enElPunto.innerText) || '').trim();
      if (/^\s*salir\s*$/i.test(txt)) return { peligro: txt };
      return { x: cx, y: cy };
    });
    if (!coords) throw new Error('img.fechaAtras no encontrado');
    if (coords.peligro) throw new Error(`el «atrás» caería sobre «${coords.peligro}» — no se pulsa`);
    await pg.mouse.click(coords.x, coords.y, { delay: 60 });
  }

  async function clickAlertBtn(labels = ['Aceptar', 'OK']) {
    await pg.waitForTimeout(900);
    await dismissIonLoadings();
    await pg.waitForTimeout(300);
    const coords = await pg.evaluate((lbls) => {
      const alerts = [...document.querySelectorAll('ion-alert')].filter(a => {
        const isTraditional = !a.classList.contains('overlay-hidden') && a.offsetParent !== null;
        const hasVisibleBtn = [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!alerts.length) return null;
      const alert = alerts[alerts.length - 1];
      for (const lbl of lbls) {
        const btn = [...alert.querySelectorAll('.alert-button')].find(b =>
          b.textContent.trim().toLowerCase() === lbl.toLowerCase() && b.getBoundingClientRect().width > 0);
        if (btn) { const r = btn.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: lbl }; }
      }
      return null;
    }, labels);
    if (!coords) throw new Error('Alert btn no encontrado: ' + labels.join('/'));
    await pg.mouse.click(coords.x, coords.y);
    await pg.waitForTimeout(600);
    // 🔴 EL PRIMER CLIC SOBRE EL BOTÓN DE UNA ion-alert PUEDE CAER EN EL
    //    ION-BACKDROP. No falla: simplemente no cierra, y el error aparece dos
    //    pasos después disfrazado de «el siguiente clic no hizo nada» (porque el
    //    backdrop sigue tapando la pantalla). Si la alerta SIGUE viva, se
    //    reintenta con coordenadas frescas.
    const sigueViva = await pg.evaluate(() =>
      [...document.querySelectorAll('ion-alert')].some(a =>
        [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0)));
    if (sigueViva) {
      const c2 = await pg.evaluate((lbl) => {
        const a = [...document.querySelectorAll('ion-alert')].filter(x =>
          [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0)).pop();
        if (!a) return null;
        const btn = [...a.querySelectorAll('.alert-button')].find(b =>
          b.textContent.trim().toLowerCase() === String(lbl).toLowerCase() &&
          b.getBoundingClientRect().width > 0);
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        // Verificar OCLUSIÓN, no presencia: si en ese punto responde el backdrop,
        // se pulsa el botón por DOM, que es lo único que lo atraviesa.
        const en = document.elementFromPoint(x, y);
        if (en && /ION-BACKDROP/i.test(en.tagName)) { btn.click(); return { via: 'dom' }; }
        return { x, y, via: 'mouse' };
      }, coords.label);
      if (c2 && c2.via === 'mouse') await pg.mouse.click(c2.x, c2.y);
      await pg.waitForTimeout(600);
    }
    return coords.label;
  }

  // Lee el título/mensaje del alert activo (ion-alert.textContent devuelve "" en este build → usar .alert-title/.alert-message)
  async function readAlert() {
    return pg.evaluate(() => {
      const a = [...document.querySelectorAll('ion-alert')].find(x => {
        const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
        const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!a) return null;
      const t = a.querySelector('.alert-title, .alert-head');
      const m = a.querySelector('.alert-message');
      return [(t && t.textContent.trim()) || '', (m && m.textContent.trim()) || ''].filter(Boolean).join(' · ');
    });
  }

  // dirty-guard: título "Denario Cobros"/message vacío → detectar por BOTONES, salir con "Salir sin guardar"
  async function dismissDirtyGuard() {
    const coords = await pg.evaluate(() => {
      const alerts = [...document.querySelectorAll('ion-alert')].filter(a => {
        const isTraditional = !a.classList.contains('overlay-hidden') && a.offsetParent !== null;
        const hasVisibleBtn = [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!alerts.length) return null;
      const btn = [...alerts[alerts.length - 1].querySelectorAll('.alert-button')].find(b =>
        b.textContent.trim().toLowerCase() === 'salir sin guardar' && b.getBoundingClientRect().width > 0);
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!coords) return false;
    await pg.mouse.click(coords.x, coords.y);
    await pg.waitForTimeout(800);
    return true;
  }

  // Botón home de cobros con Pointer+Mouse (los tiles requieren PointerEvent + click)
  async function clickBotonHome(texto) {
    const coords = await pg.evaluate((t) => {
      const btns = [...document.querySelectorAll('app-cobros ion-button')].filter(
        b => b.textContent.trim() === t && b.getBoundingClientRect().width > 0);
      if (!btns.length) return null;
      const el = btns[0];
      const r = el.getBoundingClientRect();
      // Disparar el handler real vía Pointer+Mouse en el shadow button
      try {
        const inner = el.shadowRoot && el.shadowRoot.querySelector('button');
        (inner || el).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        (inner || el).dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      } catch (_) {}
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, texto);
    if (!coords) throw new Error(`Botón "${texto}" no encontrado en home cobros`);
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
  }

  async function isHomeCobrosVisible() {
    return pg.evaluate(() =>
      [...document.querySelectorAll('app-cobros ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .some(b => b.textContent.trim() === 'COBRO'));
  }

  /**
   * Vuelve al home del módulo Cobros retrocediendo.
   *
   * 🔴 FRENO DE SEGURIDAD (07/09). Antes pulsaba «atrás» hasta 6 veces seguidas
   *    sin mirar dónde estaba. Cuando el flujo descarrilaba —p. ej. porque el
   *    cliente de prueba no cargó— seguía retrocediendo: salía de Cobros,
   *    llegaba al HOME DE LA APP y el siguiente «atrás» caía sobre **SALIR**,
   *    **cerrando la sesión del usuario**. Eso obliga a volver a entrar y
   *    resincronizar, y le arruina la sesión a quien esté usando el equipo.
   *
   *    Un script de prueba NUNCA debe poder cerrar la sesión. Ahora, si detecta
   *    que ya salió del módulo, se detiene y lo dice, en vez de seguir pulsando.
   */
  async function irAHomeCobros(maxAttempts = 6) {
    for (let i = 0; i < maxAttempts; i++) {
      if (await isHomeCobrosVisible()) return;

      // ¿Seguimos dentro del módulo? Si ya estamos en el home de la app, otro
      // «atrás» pega en SALIR.
      const fuera = await pg.evaluate(() => {
        const viva = [...document.querySelectorAll('.ion-page')]
          .filter(p => !p.classList.contains('ion-page-hidden'))
          .map(p => p.tagName.toLowerCase()).pop() || '';
        const ruta = location.hash || location.pathname;
        return { viva, ruta, enHomeApp: viva === 'app-home' || /^\/?home$/.test(ruta.replace('#', '')) };
      });
      if (fuera.enHomeApp) {
        throw new Error(`salí del módulo Cobros (${fuera.viva}) — me detengo para no pulsar SALIR`);
      }

      try { await clickBack(); } catch (_) {}
      await pg.waitForTimeout(900);
      await dismissDirtyGuard();
      await pg.waitForTimeout(400);
    }
    if (!(await isHomeCobrosVisible())) throw new Error('No se pudo llegar a home cobros');
  }

  // ¿estamos en el formulario? (segment-buttons visibles; el contenedor siempre offsetParent!==null)
  async function isFormVisible() {
    return pg.evaluate(() =>
      [...document.querySelectorAll('app-cobros-container ion-segment-button, app-cobro ion-segment-button')]
        .some(s => s.getBoundingClientRect().width > 0));
  }

  // Cambiar de tab: asignar ion-segment.value + ionChange (más fiable que click en segment-button)
  // 🔴 LA PESTAÑA «GENERAL» SE LLAMA "default".
  //    `cobro.component.html:4` → <ion-segment-button value="default">. Las otras
  //    cuatro sí usan su nombre. Durante toda la corrida del 07/09 se pedía
  //    'general': `seg.value` quedaba en un valor que ningún botón tiene, NO se
  //    seleccionaba ninguna pestaña y la vista quedaba EN BLANCO. Por eso la foto
  //    de DM-COB-024 leyó 0 inputs y el cotejo nunca pudo hacerse.
  //
  //    Fallaba en silencio porque la función no devolvía nada y todas las
  //    llamadas van con `.catch(() => {})`. Ahora valida contra los valores que
  //    existen de verdad y devuelve el resultado.
  const ALIAS_TAB = { general: 'default', datos: 'default' };

  async function clickTab(value) {
    const destino = ALIAS_TAB[value] || value;
    const r = await pg.evaluate((val) => {
      const seg = document.querySelector('app-cobros-container ion-segment, app-cobro ion-segment, ion-segment');
      if (!seg) return { ok: false, motivo: 'no hay ion-segment en pantalla' };
      const botones = [...seg.querySelectorAll('ion-segment-button')];
      const valores = botones.map(b => String(b.value ?? b.getAttribute('value') ?? ''));
      if (!valores.includes(val)) {
        return { ok: false, motivo: `la pestaña "${val}" no existe`, valores };
      }
      seg.value = val;
      seg.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: val } }));
      return { ok: true, valores };
    }, destino);
    await pg.waitForTimeout(1000);
    return r;
  }

  // Abrir nuevo cobro: click REAL en el tile (nuevoCobro programático NO re-renderiza tras Guardado)
  async function abrirNuevoCobro() {
    await clickBotonHome('COBRO');
    // Esperar los 5 tabs. ⚠ 18 vueltas × 700 ms = ~12 s: con 8 s se quedó corto
    //   cuando la pantalla anterior aún estaba replegando (DM-COB-026, 14/09).
    for (let i = 0; i < 18; i++) {
      await pg.waitForTimeout(700);
      const tabs = await pg.evaluate(() =>
        [...document.querySelectorAll('ion-segment-button')].filter(s => s.getBoundingClientRect().width > 0).length);
      if (tabs >= 4) return true;
    }
    return false;
  }

  // Qué cliente se clickeó DE VERDAD. El reporte debe decir esto, no lo que
  // pedía el perfil: son cosas distintas y confundirlas ya hizo mentir a un reporte.
  let ultimoClienteClickeado = null;

  // Modal cliente: #clienteSelectModal.present() (click en ion-input NO lo abre)
  async function seleccionarCliente(nombre) {
    await pg.evaluate(() => {
      const m = document.querySelector('#clienteSelectModal');
      if (m && typeof m.present === 'function') m.present();
    });
    await pg.waitForTimeout(2000);

    // ── Filtrar ───────────────────────────────────────────────────────────────
    //
    // 🔴 DOS COSAS QUE HACÍAN FALLAR ESTO EN SILENCIO (medidas el 14/09):
    //
    // 1. **El modal solo carga 50 clientes de golpe** (el vendedor V.0002 tiene
    //    78). Si el filtro no se aplica, los 28 últimos NO ESTÁN EN EL DOM:
    //    C.1018 «no encontrado · 50 listados» no era que faltara el cliente,
    //    era que la lista salió sin filtrar.
    // 2. **El buscador filtra con ENTER, no al teclear** — y si el input todavía
    //    no existe cuando se hace `focus()`, las pulsaciones se pierden y la
    //    lista queda entera. Pasaba de forma intermitente, según lo que tardara
    //    el modal en presentarse.
    //
    // Ahora: se espera al input, se LIMPIA, se teclea, y se COMPRUEBA que el
    // texto quedó dentro; si no, se reintenta. Y si aun así no aparece, se
    // recorre la lista hacia abajo para forzar la carga del resto.
    if (nombre) {
      const clave = nombre.trim();
      const buscar = async () => {
        const listo = await pg.evaluate(() => {
          const modal = document.querySelector('#clienteSelectModal') ||
                        document.querySelector('ion-modal.show-modal');
          const inp = modal && modal.querySelector('input:not([type=hidden])');
          if (!inp) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(inp, '');
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.focus();
          return true;
        });
        if (!listo) return { ok: false, motivo: 'el buscador del modal no está en el DOM' };
        await pg.waitForTimeout(400);
        await pg.keyboard.type(clave, { delay: 45 }).catch(() => {});
        await pg.waitForTimeout(300);
        const escrito = await pg.evaluate(() => {
          const modal = document.querySelector('#clienteSelectModal') ||
                        document.querySelector('ion-modal.show-modal');
          const inp = modal && modal.querySelector('input:not([type=hidden])');
          return inp ? inp.value : null;
        });
        await pg.keyboard.press('Enter').catch(() => {});
        await pg.waitForTimeout(1600);
        return { ok: String(escrito || '').trim() === clave, escrito };
      };

      let r = await buscar();
      if (!r.ok) { await pg.waitForTimeout(900); r = await buscar(); }

      // ¿Quedó en la lista? Si no, puede ser que el filtro no aplicara y el
      // cliente esté más allá de los 50 primeros: se recorre hacia abajo.
      const presente = () => pg.evaluate((cl) => {
        const modal = document.querySelector('#clienteSelectModal') ||
                      document.querySelector('ion-modal.show-modal');
        if (!modal) return { n: 0, hay: false };
        const its = [...modal.querySelectorAll('ion-item')].filter(e => e.getBoundingClientRect().width > 0);
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return { n: its.length, hay: its.some(i => norm(i.innerText).includes(norm(cl))) };
      }, clave);

      let est = await presente();
      for (let i = 0; i < 12 && !est.hay && est.n >= 50; i++) {
        await pg.evaluate(() => {
          const modal = document.querySelector('#clienteSelectModal') ||
                        document.querySelector('ion-modal.show-modal');
          const c = modal && modal.querySelector('ion-content');
          if (c && c.scrollToBottom) c.scrollToBottom(0);
          else if (c) c.scrollTop = c.scrollHeight;
        });
        await pg.waitForTimeout(500);
        est = await presente();
      }
    }

    // Click en el <p> del nombre (NO el centro del item → zona de saldos activa masInfo→BUSCAR)
    //
    // 🔴 ANTES CAÍA EN `ps[0]` SIN AVISAR. La línea era `target = target || ps[0]`:
    //    si el cliente pedido no aparecía, elegía **el primero de la lista** y
    //    seguía como si nada. El reporte imprimía el cliente del PERFIL, no el
    //    que se había clickeado, así que mentía. Se detectó en 4K (02/09): el
    //    perfil pide `C.0507` —un CÓDIGO— y el modal lista NOMBRES, así que no
    //    casaba nunca; se cobraba contra un cliente cualquiera y los casos
    //    siguientes morían con "cliente sin documentos".
    //
    // Ahora: se busca por CÓDIGO o por NOMBRE sobre el texto completo del ítem,
    // y si no está, **falla con nombre y apellido**. Un cliente equivocado en
    // silencio es peor que un FAIL.
    const hallazgo = await pg.evaluate((nom) => {
      const visible = (el) => el.getBoundingClientRect().width > 0;
      const modal = document.querySelector('#clienteSelectModal') ||
                    document.querySelector('ion-modal.show-modal');
      if (!modal) return { err: 'el modal de clientes no está abierto' };

      const items = [...modal.querySelectorAll('ion-item')].filter(visible);
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const clave = norm(nom);

      // El <p> es el punto SEGURO donde clickear; el texto del ion-item es lo
      // que se compara, porque ahí vienen código y nombre juntos.
      const candidatos = items.map(it => ({
        it,
        txt: norm(it.innerText),
        p: [...it.querySelectorAll('p')].filter(visible)[0] || null,
      })).filter(c => c.p);

      if (!candidatos.length) return { err: 'el modal no listó clientes', n: items.length };
      if (!clave) return { err: 'no se indicó cliente_test en el perfil del cliente' };

      // exacto primero, luego por substring (el código suele venir con prefijo)
      const elegido = candidatos.find(c => c.txt === clave)
                   || candidatos.find(c => c.txt.includes(clave));
      if (!elegido) {
        return { err: 'no encontrado', n: candidatos.length,
                 muestra: candidatos.slice(0, 5).map(c => c.txt.slice(0, 60)) };
      }
      elegido.p.scrollIntoView({ block: 'center' });
      const r = elegido.p.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2,
               elegido: elegido.txt.slice(0, 80), n: candidatos.length };
    }, nombre);

    if (hallazgo.err) {
      const extra = hallazgo.muestra
        ? ` · ${hallazgo.n} listados, p.ej.: ${hallazgo.muestra.join(' | ')}`
        : hallazgo.n !== undefined ? ` · ${hallazgo.n} ítems` : '';
      throw new Error(`Cliente "${nombre}" ${hallazgo.err}${extra}`);
    }
    ultimoClienteClickeado = hallazgo.elegido;
    const coords = { x: hallazgo.x, y: hallazgo.y };
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
    await pg.waitForTimeout(2500);
    // Reintento (el 1er click a veces no marca)
    const stillModal = await pg.evaluate(() =>
      !!document.querySelector('ion-modal.show-modal #clienteSelectModal, #clienteSelectModal.show-modal') ||
      [...document.querySelectorAll('#clienteSelectModal')].some(m => m.getBoundingClientRect().width > 0 && m.offsetParent !== null));
    if (stillModal && coords) {
      await pg.mouse.click(coords.x, coords.y + 8, { delay: 80 });
      await pg.waitForTimeout(2000);
    }
  }

  // Llenar Comentario: 2º ion-input.inp-write (1º=Responsable id=currency; 2º=Comentario, nace ion-invalid)
  /**
   * Escribe el campo Comentario del cobro.
   *
   * 🔴 El selector `.inp-write` DEJÓ DE EXISTIR (medido el 07/09: 0 elementos lo
   *    tienen). Con él, la función no encontraba nada y devolvía false — y como
   *    nadie miraba ese false, el módulo seguía adelante con las 5 pestañas
   *    bloqueadas y el fallo aparecía después disfrazado de «tabs no habilitadas».
   *
   *    Ahora se ancla al **label «Comentario:»**, que es estable y describe el
   *    campo, en vez de a una clase de estilo. Se conserva `.inp-write` como
   *    último recurso por si algún build viejo lo usa.
   */
  async function fillComentario(texto) {
    const ok = await pg.evaluate((val) => {
      const vis = (el) => el.getBoundingClientRect().width > 0;
      const etiqueta = (el) => String(el.getAttribute('label') || el.label || '');

      const todos = [...document.querySelectorAll('ion-input, ion-textarea')].filter(vis);
      let target =
        // 1) por su label — el ancla buena
        todos.find(i => /coment/i.test(etiqueta(i)))
        // 2) compatibilidad: builds que aún usen la clase de estilo
        || [...document.querySelectorAll('ion-input.inp-write')].filter(vis)
             .find(i => i.classList.contains('ion-invalid') && !(i.value || '').trim())
        // 3) el que nace inválido y vacío (el obligatorio sin llenar)
        || todos.find(i => i.classList.contains('ng-invalid') && !(i.value || '').trim());
      if (!target) return false;
      const native = target.querySelector('input') || (target.shadowRoot && target.shadowRoot.querySelector('input'));
      if (!native) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(native, val);
      native.dispatchEvent(new Event('input', { bubbles: true }));
      native.dispatchEvent(new Event('change', { bubbles: true }));
      target.dispatchEvent(new CustomEvent('ionInput', { bubbles: true, detail: { value: val } }));
      target.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: val } }));
      native.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }, texto);
    await pg.waitForTimeout(600);
    return ok;
  }

  async function tabsHabilitadas() {
    return pg.evaluate(() =>
      [...document.querySelectorAll('ion-segment-button')]
        .filter(s => s.getBoundingClientRect().width > 0 && !s.disabled && s.getAttribute('disabled') === null).length);
  }

  // Selecciona la moneda documento (1er ion-select del Tab Documentos) = USD por defecto para docs $
  /**
   * 📸 Foto de los campos visibles del cobro — se toma antes de guardar y otra
   *    vez al reabrir, y el cotejo de DM-COB-024 compara las dos.
   *
   * 🔴 Estaba DUPLICADA con dos indentaciones distintas, y al corregir una sola
   *    las fotos dejaron de ser comparables. Ahora hay UNA definición.
   *
   * 🔴 Y leía SOLO el atributo `label`: en la corrida del 07/09 16:02 devolvió
   *    CERO campos, así que 024 no pudo medir nada. No todos los campos del
   *    cobro rotulan así — algunos usan un <ion-label> hermano o el placeholder.
   *    Se prueban las tres vías y se guarda un diagnóstico para no quedar a
   *    ciegas si vuelve a salir vacía.
   */
  async function fotoDelCobro() {
    return pg.evaluate(() => {
      const vis = el => el.getBoundingClientRect().width > 0;
      const valor = (el) => {
        const n = el.querySelector('input, textarea') ||
                  (el.shadowRoot && el.shadowRoot.querySelector('input, textarea'));
        return n ? String(n.value).trim() : '';
      };
      const rotulo = (el) => {
        const attr = String(el.getAttribute('label') || el.label || '').trim();
        if (attr) return attr;
        const item = el.closest('ion-item, ion-col, .item');
        const lab = item && item.querySelector('ion-label');
        const t = lab ? (lab.textContent || '').replace(/\s+/g, ' ').trim() : '';
        if (t) return t;
        return String(el.getAttribute('placeholder') || el.placeholder || '').trim();
      };
      const todos = [...document.querySelectorAll('ion-input, ion-textarea')].filter(vis);
      const campos = {};
      for (const el of todos) {
        const et = rotulo(el);
        if (et) campos[et] = valor(el);
      }
      const txt = (document.body.innerText || '').replace(/\s+/g, ' ');
      const tot = txt.match(/Monto total a pagar[^:]*:\s*([\d.,]+)/i);
      const seg = document.querySelector('ion-segment-button.segment-button-checked')
               || document.querySelector('ion-segment-button[aria-selected="true"]');
      return {
        campos,
        total: tot ? tot[1] : null,
        diag: {
          inputsVisibles: todos.length,
          tabActiva: seg ? (seg.textContent || '').replace(/\s+/g, ' ').trim() : '?',
          muestra: todos.slice(0, 6).map(rotulo).filter(Boolean),
        },
      };
    });
  }

  async function seleccionarMonedaDocumento(pref = 'US') {
    const res = await pg.evaluate((p) => {
      const sel = document.querySelector('app-cobro-documents ion-select');
      if (!sel) return { ok: false, err: 'ion-select moneda no encontrado' };
      const opts = [...sel.querySelectorAll('ion-select-option')];
      const labels = opts.map(o => (o.textContent || '').trim());
      const opt = opts.find(o => (o.textContent || '').toUpperCase().includes(p.toUpperCase())) || opts[0];
      if (!opt) return { ok: false, err: 'sin opciones de moneda', labels };
      sel.value = opt.value;
      sel.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: opt.value } }));
      return { ok: true, elegida: (opt.textContent || '').trim(), labels };
    }, pref);
    await pg.waitForTimeout(1800);
    return res;
  }

  // Cuenta documentos (checkboxes) visibles en el Tab Documentos.
  async function contarDocumentos() {
    return pg.evaluate(() => {
      const docs = document.querySelector('app-cobro-documents');
      if (!docs || docs.offsetParent === null) return 0;
      return [...docs.querySelectorAll('ion-checkbox')].filter(c => c.getBoundingClientRect().width > 0).length;
    });
  }

  // Carga documentos robusta: selecciona Moneda Documento (US$) y reintenta con toggle si no cargan.
  async function cargarDocumentos() {
    let moneda = null, cbs = 0;
    for (let i = 0; i < 5; i++) {
      moneda = await seleccionarMonedaDocumento('US');
      await pg.waitForTimeout(1500);
      cbs = await contarDocumentos();
      if (cbs > 0) break;
      // toggle: elegir otra moneda y volver, fuerza recarga de la lista
      await seleccionarMonedaDocumento('BS');
      await pg.waitForTimeout(1200);
    }
    return { cbs, moneda };
  }

  // Marca el primer documento (checkbox) del Tab Documentos → devuelve {ok, count}
  async function marcarPrimerDocumento() {
    const info = await pg.evaluate(() => {
      const docs = document.querySelector('app-cobro-documents');
      if (!docs || docs.offsetParent === null) return { count: 0 };
      const cbs = [...docs.querySelectorAll('ion-checkbox')].filter(c => c.getBoundingClientRect().width > 0);
      return { count: cbs.length };
    });
    if (info.count === 0) return { ok: false, count: 0 };
    const coords = await pg.evaluate(() => {
      const docs = document.querySelector('app-cobro-documents');
      const cbs = [...docs.querySelectorAll('ion-checkbox')]
        .filter(c => c.getBoundingClientRect().width > 0)
        .sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
      const r = cbs[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
    await pg.waitForTimeout(1200);
    return { ok: true, count: info.count };
  }

  // ── Guardar / Enviar ────────────────────────────────────────────────────────
  //
  // 🔴 ANTES DISPARABA CUATRO VECES. La versión previa hacía, sin condición:
  //       pointerdown + pointerup + inner.click()   (en el DOM)
  //       + pg.mouse.click(x, y)                    (clic real)
  //    Ionic atiende el `inner.click()` Y el clic real ⇒ **dos activaciones del
  //    mismo botón**. En Guardar deja un cobro duplicado; en Enviar, un envío
  //    duplicado. La razón de que estuvieran los dos era que «el header fijo en
  //    y≈32 no siempre recibe el mouse» — cierto, pero eso se resuelve con un
  //    fallback CONDICIONADO, no disparando ambos a ciegas.
  //
  // Ahora: **un solo disparo**, se comprueba si la pantalla reaccionó, y solo si
  // no reaccionó se intenta la vía alterna. Nunca las dos.
  //
  // Devuelve { ok, via, motivo } — ⚠ es un OBJETO: `if (await clickGuardarEnviar())`
  // siempre da verdadero. Evaluar `.ok`.

  /** Huella de la pantalla, para saber si el botón produjo algo. */
  async function huellaPantalla() {
    return pg.evaluate(() => {
      const vis = (el) => el && el.getBoundingClientRect().width > 0 && el.offsetParent !== null;
      const alerts = [...document.querySelectorAll('ion-alert')].filter(a =>
        (!a.classList.contains('overlay-hidden') && a.offsetParent !== null) ||
        [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0));
      return {
        alerts:   alerts.length,
        loadings: [...document.querySelectorAll('ion-loading')].filter(vis).length,
        enCobro:  !!document.querySelector('app-cobro:not(.ion-page-hidden)'),
        url:      location.hash || location.pathname,
      };
    });
  }

  /** ¿Cambió algo respecto de `antes`? Sondea hasta `msMax`. */
  async function esperarReaccion(antes, msMax = 2500) {
    const t0 = Date.now();
    while (Date.now() - t0 < msMax) {
      await pg.waitForTimeout(250);
      const ahora = await huellaPantalla();
      if (ahora.alerts   > antes.alerts)   return { reacciono: true, senal: 'alert' };
      if (ahora.loadings > antes.loadings) return { reacciono: true, senal: 'loading' };
      if (antes.enCobro && !ahora.enCobro) return { reacciono: true, senal: 'navego' };
      if (ahora.url !== antes.url)         return { reacciono: true, senal: 'url' };
    }
    return { reacciono: false };
  }

  async function clickGuardarEnviar(cls) {
    // 🔴 El teclado desplaza el header: si se acaba de escribir, las coordenadas
    //    medidas antes del blur apuntan a otro sitio y el clic «no hace nada».
    await pg.evaluate(() => {
      const a = document.activeElement;
      if (a && typeof a.blur === 'function') a.blur();
    });
    await pg.waitForTimeout(400);

    const btn = await pg.evaluate((sel) => {
      const b = document.querySelector(`ion-button.${sel}`);
      if (!b) return { estado: 'ausente' };
      if (b.disabled) return { estado: 'deshabilitado' };
      const r = b.getBoundingClientRect();
      if (r.width === 0) return { estado: 'invisible' };
      return { estado: 'ok', x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, cls);

    if (btn.estado !== 'ok') return { ok: false, via: null, motivo: `botón ${btn.estado}` };

    const antes = await huellaPantalla();

    // Intento 1 — clic REAL. Es el que reproduce lo que hace la QA a mano.
    await pg.mouse.click(btn.x, btn.y, { delay: 120 });
    let r = await esperarReaccion(antes);
    if (r.reacciono) return { ok: true, via: 'mouse', motivo: r.senal };

    // Intento 2 — solo porque el primero NO produjo nada: el header fijo puede
    // quedar fuera del área que recibe el mouse. Una sola activación más.
    const disparo = await pg.evaluate((sel) => {
      const b = document.querySelector(`ion-button.${sel}`);
      if (!b || b.disabled) return false;
      const inner = b.shadowRoot && b.shadowRoot.querySelector('button');
      try { (inner || b).click(); return true; } catch (_) { return false; }
    }, cls);
    if (!disparo) return { ok: false, via: 'mouse', motivo: 'sin reacción y no se pudo reintentar' };

    r = await esperarReaccion(antes);
    return r.reacciono
      ? { ok: true,  via: 'dom', motivo: r.senal }
      : { ok: false, via: 'ambas', motivo: 'el botón no produjo ninguna reacción' };
  }

  function blockFase2(motivo = 'Fase 2 — pendiente de construir/depurar en device') {
    FASE2.forEach(id => v(id, id, 'BLOCKED', motivo));
  }

  /**
   * ORÁCULO DEL ENVÍO — y del disparo único.
   *
   * 🔴 Por qué CUENTA filas y no se conforma con «apareció»: mientras
   *    `clickGuardarEnviar()` disparaba cuatro veces (pointerdown+pointerup+
   *    click del DOM **y** un mouse.click), un solo Enviar podía crear DOS
   *    cobros en la nube. Con un oráculo que solo pregunta «¿está?», el script
   *    daba PASS y el duplicado pasaba inadvertido — y peor: cualquier otro
   *    resultado quedaba contaminado, porque ya no se puede distinguir «el
   *    producto duplicó» de «yo pulsé dos veces».
   *
   * ⚠ Un envío legítimo puede dejar DOS filas con el mismo comentario: el cobro
   *   (`co_type = 0`) y el ANTICIPO AUTOMÁTICO por excedente (`co_type = 1`).
   *   Se ven así en 4K, p. ej. 2706 (cobro 1.862,00) + 2707 (anticipo 0,01).
   *   Por eso se cuenta POR TIPO: duplicado = más de una fila del MISMO co_type.
   *
   * @param {string} comentario  marca única de la corrida
   * @param {number} [esperas]   reintentos (la sincronización no siempre es instantánea)
   */
  async function verificarNube(comentario, esperas = 5) {
    if (!DATA.clienteSlug) return { ok: false, motivo: 'sin clienteSlug: no se pudo consultar la nube' };
    const leer = () => consultaNube(DATA.clienteSlug,
      `select id_collection, co_collection, co_type, st_collection, nu_amount_total, ` +
      `nu_difference, co_currency, tx_comment from collection where tx_comment = '${comentario}' ` +
      `order by id_collection`);
    let filas = null;
    for (let i = 0; i < esperas; i++) {
      filas = leer();
      if (filas && filas.length) break;
      await pg.waitForTimeout(3000);
    }
    // 🔴 NO cortar en cuanto aparece la primera fila. Un envío con excedente
    //    crea DOS filas (cobro + anticipo) y no siempre llegan juntas: si se
    //    lee justo en medio se concluye «no se generó anticipo» cuando sí se
    //    generó, y eso es reportar un defecto que no existe. Se deja asentar:
    //    se relee hasta que el conteo REPITA, o se agoten los intentos.
    if (filas && filas.length) {
      for (let i = 0; i < 4; i++) {
        await pg.waitForTimeout(4000);
        const otra = leer();
        if (otra && otra.length > filas.length) { filas = otra; continue; }
        if (otra) filas = otra;
        break;
      }
    }
    if (!filas) return { ok: false, motivo: 'la consulta a la nube falló' };
    const cobros    = filas.filter(f => Number(f.co_type) === 0);
    const anticipos = filas.filter(f => Number(f.co_type) === 1);
    // Duplicado = más de una fila del MISMO tipo con la misma marca.
    const duplicado = cobros.length > 1 || anticipos.length > 1;
    return {
      ok: filas.length > 0,
      filas, cobros, anticipos, duplicado,
      resumen: filas.length
        ? filas.map(f => `${f.id_collection}/${f.co_collection} co_type=${f.co_type} ` +
                         `${f.nu_amount_total} ${f.co_currency || ''} st=${f.st_collection}`).join(' · ')
        : `ninguna fila con comentario ${comentario}`,
      aviso: duplicado
        ? ` · 🔴 DUPLICADO: ${cobros.length} cobro(s) y ${anticipos.length} anticipo(s) ` +
          `con la MISMA marca. Si el script disparó una sola vez, es defecto del producto; ` +
          `si no, es el disparo múltiple de clickGuardarEnviar()`
        : '',
    };
  }

  // Lee el "Monto total a pagar" y la Diferencia (texto + color) del Tab Pagos.
  async function leerPagosSticky() {
    return pg.evaluate(() => {
      const root = document.querySelector('app-cobro-pagos') || document.body;
      const txt = root.textContent.replace(/\s+/g, ' ');
      const totalM = txt.match(/Monto total a pagar[^\d-]*([\d.,-]+)/i);
      // Diferencia: span hoja con color en style
      let difColor = null, difVal = null;
      const spans = [...root.querySelectorAll('span, ion-text, p, div')].filter(n => /Diferencia/i.test(n.textContent || ''));
      for (const s of spans) {
        const leaf = [...s.querySelectorAll('*')].filter(x => x.children.length === 0 && /Diferencia/i.test(x.textContent));
        const node = leaf[0] || s;
        const st = (node.getAttribute && node.getAttribute('style')) || '';
        const cs = getComputedStyle(node).color;
        const m = (node.textContent || '').match(/Diferencia[^\d-]*([\d.,-]+)/i);
        if (m) { difVal = m[1]; difColor = (/red/i.test(st) ? 'red' : /blue/i.test(st) ? 'blue' : cs); break; }
      }
      return { total: totalM ? totalM[1] : null, difVal, difColor };
    });
  }

  // Convierte "66.852,91" → "6685291" (dígitos para el input de monto centavos-acumulativo)
  /**
   * "Bs: 1.017.900,00" → 1017900. Formato es-VE: el punto agrupa, la coma decide.
   * Devuelve null si no hay número, para no confundir «no se pudo leer» con 0.
   */
  function montoANumero(txt) {
    if (txt === null || txt === undefined) return null;
    const m = String(txt).match(/-?[\d.,]+/);
    if (!m) return null;
    const n = Number(m[0].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Deja la LISTA de cobros a la vista y devuelve el conteo por estado.
   *
   * 🔴 Antes cada caso repetía «irAHome + BUSCAR + dormir un rato» y leía. Con un
   *    sleep fijo la lista salía VACÍA (0 ítems justo después de contar 20) y eso
   *    tumbó DM-COB-019 tres corridas seguidas. Aquí se espera a que CARGUE y, si
   *    no aparece, se reintenta la navegación entera antes de rendirse.
   */
  async function abrirListaCobros(intentos = 3) {
    for (let n = 0; n < intentos; n++) {
      await dismissIonLoadings().catch(() => {});
      await irAHomeCobros().catch(() => {});
      await clickBotonHome('BUSCAR').catch(() => {});
      for (let i = 0; i < 8; i++) {
        await pg.waitForTimeout(1000);
        const r = await pg.evaluate(() => {
          const lista = document.querySelector('app-cobros-list');
          if (!lista || lista.offsetParent === null) return { lista: false, total: 0, guardados: 0, enviados: 0 };
          const its = [...lista.querySelectorAll('ion-item')].filter(el => el.getBoundingClientRect().width > 0);
          return {
            lista: true,
            total: its.length,
            guardados: its.filter(el => /Guardado/i.test(el.textContent)).length,
            enviados: its.filter(el => /Enviado|Por aprobar/i.test(el.textContent)).length,
          };
        });
        if (r.lista && r.total > 0) return r;
      }
    }
    return { lista: false, total: 0, guardados: 0, enviados: 0 };
  }

  /**
   * Abre un cobro en estado Guardado.
   *
   * 🔑 `marca` = el comentario único del cobro que se acaba de guardar. Sin ella
   *    se abría «el primero de la lista», que puede ser un Guardado VIEJO de otra
   *    corrida — y entonces el caso de persistencia compara contra un cobro que
   *    no es el suyo y da un PASS o un FAIL igual de falsos. Si la marca no se
   *    encuentra se abre el primero, pero el resultado lo dice.
   */
  async function reabrirGuardado(marca = null) {
    const r = await pg.evaluate((m) => {
      const items = [...document.querySelectorAll('app-cobros-list ion-item')]
        .filter(el => el.getBoundingClientRect().width > 0 && /Guardado/i.test(el.textContent));
      if (!items.length) return null;
      const porMarca = m ? items.find(el => (el.textContent || '').includes(m)) : null;
      const el = porMarca || items[0];
      el.scrollIntoView({ block: 'center' });
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2,
               porMarca: !!porMarca, guardados: items.length };
    }, marca);
    if (!r) return false;
    await pg.mouse.click(r.x, r.y, { delay: 120 });
    await pg.waitForTimeout(2500);
    ultimoReabierto = r;
    return (await tabsHabilitadas()) >= 3;
  }
  /** Diagnóstico del último `reabrirGuardado` (si abrió por marca o a ciegas). */
  let ultimoReabierto = null;

  function montoADigitos(txt) {
    if (!txt) return '';
    return String(txt).replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  }

  /**
   * Agrega método Efectivo. Devuelve { ok, monto, error }.
   *
   * @param {string|null} digitosFijos  dígitos del monto SIN separadores (centavos
   *        incluidos: "5000" = 50,00). Si va null se usa el total a pagar, que es
   *        lo que quiere el happy path. Hace falta poder fijarlo para el ANTICIPO
   *        —donde no hay documentos y el total es 0— y para los bordes de
   *        tolerancia, donde el monto tiene que exceder el total a propósito.
   */
  async function agregarPagoEfectivo(digitosFijos = null) {
    // 1. Abrir modal (#eventSelect → setShowEventModal(true))
    const addInfo = await pg.evaluate(() => {
      const btn = document.querySelector('ion-button#eventSelect, ion-button.pagos-add-method-btn');
      if (!btn || btn.disabled || btn.getBoundingClientRect().width === 0) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!addInfo) return { ok: false, error: 'botón Agregar método disabled/ausente' };
    await pg.mouse.click(addInfo.x, addInfo.y, { delay: 100 });
    await pg.waitForTimeout(1500);

    // 2. Check Efectivo en el modal (ionChange sobre el checkbox de la fila "Efectivo")
    const checked = await pg.evaluate(() => {
      const mod = [...document.querySelectorAll('#eventModal')].find(m => m.offsetParent !== null);
      if (!mod) return false;
      const items = [...mod.querySelectorAll('ion-item')];
      const it = items.find(i => /Efectivo/i.test(i.textContent));
      if (!it) return false;
      const cb = it.querySelector('ion-checkbox');
      if (!cb) return false;
      cb.checked = true;
      cb.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { checked: true } }));
      return true;
    });
    if (!checked) return { ok: false, error: 'checkbox Efectivo no encontrado en #eventModal' };
    await pg.waitForTimeout(600);

    // 3. Aceptar (.botonAddVerde → onAceptarTiposPago())
    await pg.evaluate(() => {
      const mod = [...document.querySelectorAll('#eventModal')].find(m => m.offsetParent !== null);
      if (!mod) return;
      const btn = [...mod.querySelectorAll('ion-button.botonAddVerde')].find(b => b.getBoundingClientRect().width > 0);
      if (btn) btn.click();
    });
    await pg.waitForTimeout(1500);

    // 4. Expandir el accordion Efectivo. Setear value en TODOS los accordion-group + click header.
    await pg.evaluate(() => {
      document.querySelectorAll('app-cobro-pagos ion-accordion-group').forEach(grp => {
        const acc = grp.querySelector('ion-accordion');
        const val = acc ? acc.getAttribute('value') : 'efectivo0';
        grp.value = val;
        grp.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: val } }));
      });
      // fallback: click en el header "Efectivo"
      const hdr = [...document.querySelectorAll('app-cobro-pagos ion-accordion ion-item[slot="header"]')]
        .find(h => /Efectivo/i.test(h.textContent));
      if (hdr) hdr.click();
    });
    await pg.waitForTimeout(1200);

    // 5. Leer total → dígitos → llenar Monto (2º ion-input del bloque efectivo; centavos-acumulativo)
    const sticky = await leerPagosSticky();
    const digitos = digitosFijos || montoADigitos(sticky.total);
    if (!digitos) return { ok: false, error: 'no se pudo leer el total a pagar' };

    const focused = await pg.evaluate(() => {
      // El input de Monto tiene inputmode="numeric" (Nro Recibo no). Preferir ese; fallback al 2º ion-input.
      const pagos = document.querySelector('app-cobro-pagos');
      if (!pagos) return { ok: false, diag: 'no app-cobro-pagos' };
      const allInputs = [...pagos.querySelectorAll('ion-input')].filter(i => i.getBoundingClientRect().width > 0);
      let montoIon = allInputs.find(i => {
        const n = i.querySelector('input');
        return n && (n.getAttribute('inputmode') === 'numeric' || /monto/i.test(i.getAttribute('label') || ''));
      });
      if (!montoIon) montoIon = allInputs[1] || allInputs[0];
      const diag = { accs: [...pagos.querySelectorAll('ion-accordion')].map(a => a.getAttribute('value')),
        inputs: allInputs.length };
      if (!montoIon) return { ok: false, diag };
      const native = montoIon.querySelector('input') || (montoIon.shadowRoot && montoIon.shadowRoot.querySelector('input'));
      if (!native) return { ok: false, diag };
      native.focus();
      window.__qaMontoInput = native;
      return { ok: true, diag };
    });
    if (!focused.ok) return { ok: false, error: `input Monto no encontrado (accs:${JSON.stringify(focused.diag && focused.diag.accs)} inputs:${focused.diag && focused.diag.inputs})` };
    // Limpiar y teclear dígitos (onMontoKeyDown arma los centavos)
    for (let i = 0; i < 12; i++) await pg.keyboard.press('Backspace');
    await pg.keyboard.type(digitos, { delay: 40 });
    await pg.evaluate(() => {
      const n = window.__qaMontoInput;
      if (n) { n.dispatchEvent(new Event('blur', { bubbles: true })); }
    });
    await pg.waitForTimeout(1200);
    return { ok: true, monto: digitos, total: sticky.total };
  }

  // Inyecta un adjunto por el PIPELINE REAL de la app (NO fabricando el objeto Foto — eso colgaba
  // el Guardar). Este build usa @capacitor/camera (webpack) + resultType Uri → se mockea el bridge
  // Capacitor.nativePromise para que Camera.getPhoto devuelva un webPath = data URI, y se dispara
  // el tomarImg() real → addPhotoFromCamera hace fetch(dataURI) → Foto bien formada + estado correcto.
  // Requiere estar en Tab Adjuntos (app-adjunto en el DOM) y window.ng disponible.
  async function inyectarAdjunto() {
    await clickTab('adjuntos');
    await pg.waitForTimeout(1000);
    return pg.evaluate(async (b64) => {
      const C = window.Capacitor;
      if (!C || typeof C.nativePromise !== 'function') return { ok: false, err: 'Capacitor.nativePromise no disponible' };
      // Mock del bridge. addPhotoFromCamera tiene 2 ramas: photo.path → Filesystem.readFile (base64),
      // o photo.webPath → fetch(...). El fetch de un data URI lo BLOQUEA el CSP del WebView
      // ("Failed to fetch"), así que usamos la rama path: getPhoto devuelve un path y mockeamos
      // Filesystem.readFile para que devuelva el base64. Sin fetch, Foto bien formada por el pipeline.
      // Guardar el original UNA vez; reinstalar el mock SIEMPRE (la página persiste entre runs → un
      // guard `if (!__qaCamOrig)` dejaría activo un mock viejo y los cambios no tomarían efecto).
      if (!C.__qaCamOrig) C.__qaCamOrig = C.nativePromise;
      window.__qaCamHits = 0;
      window.__qaFsHits = 0;
      C.nativePromise = function (plugin, metodo, opts) {
        if (plugin === 'Camera') {
          if (metodo === 'getPhoto') {
            window.__qaCamHits++;
            const z = (typeof Zone !== 'undefined') ? Zone.current : null;
            return new Promise((resolve) => {
              const d = () => resolve({ path: 'qa_mock.jpg', webPath: 'qa_mock.jpg', format: 'jpeg', saved: false });
              if (z) z.run(d); else d();
            });
          }
          if (metodo === 'checkPermissions' || metodo === 'requestPermissions')
            return Promise.resolve({ camera: 'granted', photos: 'granted' });
          return Promise.resolve({});
        }
        if (plugin === 'Filesystem' && metodo === 'readFile') {
          window.__qaFsHits++;
          return Promise.resolve({ data: b64 });
        }
        return C.__qaCamOrig.call(this, plugin, metodo, opts);
      };
      const el = document.querySelector('app-adjunto');
      if (!el || !window.ng || !window.ng.getComponent) return { ok: false, err: 'app-adjunto/ng no disponible' };
      const comp = window.ng.getComponent(el);
      if (!comp || typeof comp.tomarImg !== 'function') return { ok: false, err: 'comp.tomarImg no disponible' };
      const svc = comp.service;
      // Guard: si quAttach viene 0/NaN (config sin 'quAttach'), checkImgLimit corta tomarImg. Forzar límite.
      const quAntes = svc ? svc.quAttach : undefined;
      if (svc && (!svc.quAttach || svc.quAttach < 1 || isNaN(svc.quAttach))) svc.quAttach = 5;
      const antes = (svc && Array.isArray(svc.fotos)) ? svc.fotos.length : -1;
      try { await comp.tomarImg(); } catch (e) {
        return { ok: false, err: 'tomarImg: ' + (e && e.message), antes, quAntes, camHits: window.__qaCamHits, fsHits: window.__qaFsHits };
      }
      const despues = (svc && Array.isArray(svc.fotos)) ? svc.fotos.length : -1;
      try { window.ng.applyChanges(comp); } catch (_) {}
      return { ok: despues > antes, antes, despues, quAntes, quAttach: svc && svc.quAttach,
        camHits: window.__qaCamHits, fsHits: window.__qaFsHits };
    }, BASE64_1PX_JPEG);
  }

  // ─── N/A por VG (resolver temprano) ───────────────────────────────────────────
  if (!DATA.requiredComment) v('DM-COB-006', 'Comentario obligatorio', 'N/A', 'requiredComment=false');
  if (!DATA.userCanSelectIGTF) {
    ['DM-COB-036','DM-COB-044','DM-COB-045'].forEach(id =>
      v(id, id, 'N/A', 'userCanSelectIGTF=false (IGTF inactivo)'));
  }
  if (!DATA.userCanCollectIva) v('DM-COB-037', 'Cobro 25% IVA', 'N/A', 'userCanCollectIva=false');

  // ─── Navegar al módulo Cobros ─────────────────────────────────────────────────
  try {
    const tileCoords = await pg.evaluate(() => {
      const tile = [...document.querySelectorAll('app-home a[href], app-home ion-card, app-home .tile, app-home a')]
        .filter(t => t.getBoundingClientRect().width > 0)
        .find(t => {
          const p = t.querySelector('p.nombreModulos, p');
          const txt = (p ? p.textContent : t.textContent).trim().toUpperCase();
          return txt.includes('COBRO');
        });
      if (!tile) return null;
      const r = tile.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!tileCoords) throw new Error('Tile Cobros no encontrado en Home');
    await pg.mouse.click(tileCoords.x, tileCoords.y, { delay: 80 });
    await pg.waitForTimeout(2000);
    await pg.waitForSelector('app-cobros', { timeout: 15000 });

    const botones = await pg.evaluate(() =>
      [...document.querySelectorAll('app-cobros ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0).map(b => b.textContent.trim()));
    const ok = botones.includes('COBRO') && botones.includes('BUSCAR');
    v('DM-COB-001', 'Módulo Cobros → home (COBRO + BUSCAR)', ok ? 'PASS' : 'FAIL', `botones: ${botones.join(', ')}`);
  } catch (e) {
    v('DM-COB-001', 'Módulo Cobros → home', 'FAIL', e.message);
    ['DM-COB-002','DM-COB-004','DM-COB-007','DM-COB-008','DM-COB-009','DM-COB-016',
     'DM-COB-018','DM-COB-019','DM-COB-022','DM-COB-024','DM-COB-026','DM-COB-020','DM-COB-021',
     'DM-COB-048','DM-COB-049','DM-COB-050','DM-COB-051','DM-COB-052']
      .forEach(id => v(id, id, 'BLOCKED', 'DM-COB-001 falló'));
    blockFase2('DM-COB-001 falló');
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // ─── DM-COB-002: COBRO → form 5 tabs, Documentos/Pagos/Total/Adjuntos disabled sin cliente ─
  try {
    const abrió = await abrirNuevoCobro();
    if (!abrió) throw new Error('Form no abrió (5 tabs)');
    const info = await pg.evaluate(() => {
      const tabs = [...document.querySelectorAll('ion-segment-button')].filter(s => s.getBoundingClientRect().width > 0);
      const habil = tabs.filter(s => !s.disabled && s.getAttribute('disabled') === null).length;
      return { total: tabs.length, habil, labels: tabs.map(s => s.textContent.trim()) };
    });
    const ok = info.total >= 5 && info.habil <= 1; // solo General activo
    v('DM-COB-002', 'COBRO → form 5 tabs; resto disabled sin cliente', ok ? 'PASS' : 'FAIL',
      `tabs: ${info.total} (${info.labels.join('/')}) · habilitadas: ${info.habil}`);
  } catch (e) {
    v('DM-COB-002', 'COBRO → form 5 tabs', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DM-COB-004 + DM-COB-007 — EL CLIENTE SE DESCUBRE, NO SE ASUME
  //
  // 🔴 El 14/09 la corrida entera se fue a N/A porque `cliente_test` (C.0029) ya
  //    no tenía documentos libres: 007 dijo «cliente sin documentos» y a partir
  //    de ahí 008/009/012/040/043/048-052 salieron N/A en cascada, 019 FAIL y no
  //    se envió nada. Un dato de perfil caducado no puede tumbar 20 casos.
  //
  //    Un documento se «gasta» en cuanto un cobro ENVIADO lo compromete (queda
  //    «Por aprobar» y desaparece del Tab Documentos), así que cualquier lista
  //    fija envejece sola. Ahora se recorre la lista de candidatos y se usa el
  //    PRIMERO que de verdad liste documentos en pantalla — que es el único
  //    inventario fiable: `document_sales.co_collection` en la BD local sigue
  //    en NULL aunque el documento ya esté comprometido.
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔑 El pool NO sale sólo del YAML: se MIDE (INV, pre-vuelo). El perfil
  //    envejece —cada envío se come su factura— y a las tres corridas la lista
  //    fija está agotada. El inventario del equipo, en cambio, dice hoy quién
  //    tiene documentos libres, y los clientes medidos van DELANTE de los del
  //    perfil. Los del YAML quedan de red por si el sqlite no se pudo leer.
  const CANDIDATOS = [...new Set(
    [DATA.clienteTest, ...(INV.clientes || []), ...(DATA.clientesConDocumentos || [])].filter(Boolean))];
  const bitacoraCliente = [];
  let clienteConDocs = null;   // el que sí listó documentos
  let cargaDocs = null;

  // ─── DM-COB-004: Seleccionar cliente → tabs habilitadas ───────────────────────
  let clienteOk = false;
  try {
    await seleccionarCliente(DATA.clienteTest);

    // 🔴 El comentario es la LLAVE del módulo cuando requiredComment=true: sin él
    //    las 5 pestañas siguen bloqueadas y nada más avanza. Antes se llamaba a
    //    fillComentario() ignorando lo que devolvía, así que si el campo no
    //    estaba donde se esperaba el fallo salía 3 pasos después disfrazado de
    //    «tabs no habilitadas». Ahora se comprueba que el texto QUEDÓ ESCRITO.
    let comentarioOk = null;
    if (DATA.requiredComment) {
      await fillComentario(comentTest);
      // Verificar sobre TODOS los inputs visibles, no sobre un selector concreto:
      // basta con que el texto esté escrito en alguno.
      comentarioOk = await pg.evaluate((val) => {
        return [...document.querySelectorAll('ion-input, ion-textarea')]
          .filter(i => i.getBoundingClientRect().width > 0)
          .some(i => {
            const n = i.querySelector('input, textarea') ||
                      (i.shadowRoot && i.shadowRoot.querySelector('input, textarea'));
            return n && String(n.value).trim() === val;
          });
      }, comentTest);
      // Un reintento: si el primer intento no escribió, vale la pena insistir
      // antes de dar por perdido el módulo entero.
      if (!comentarioOk) {
        await pg.waitForTimeout(800);
        await fillComentario(comentTest);
        comentarioOk = await pg.evaluate((val) =>
          [...document.querySelectorAll('ion-input, ion-textarea')]
            .filter(i => i.getBoundingClientRect().width > 0)
            .some(i => {
              const n = i.querySelector('input, textarea') ||
                        (i.shadowRoot && i.shadowRoot.querySelector('input, textarea'));
              return n && String(n.value).trim() === val;
            }), comentTest);
      }
    }

    let habil = 0;
    for (let i = 0; i < 8; i++) { habil = await tabsHabilitadas(); if (habil >= 4) break; await pg.waitForTimeout(700); }
    clienteOk = habil >= 4;
    // Se anota el cliente REALMENTE clickeado, no el que pedía el perfil.
    const notaCom = comentarioOk === null ? '' :
      comentarioOk ? ' · comentario escrito ✓'
                   : ' · 🔴 EL COMENTARIO NO SE ESCRIBIÓ (es lo que bloquea las pestañas)';
    v('DM-COB-004', 'Seleccionar cliente → tabs habilitadas', clienteOk ? 'PASS' : 'FAIL',
      `pedido: "${DATA.clienteTest}" · clickeado: "${ultimoClienteClickeado || '—'}" · tabs habilitadas: ${habil}${notaCom}`);
  } catch (e) {
    v('DM-COB-004', 'Seleccionar cliente → tabs habilitadas', 'FAIL', e.message);
  }

  // ─── REQ Enviar · E1 + E2 — cliente elegido, aún sin documento ni pago ────────
  // 🔴 R1 · después de DM-COB-004: la transacción empieza al elegir el cliente.
  // `naceDeshabilitado` declarado: en Cobros es COHERENTE que Enviar nazca
  // deshabilitado, porque antes hay que agregar un método de pago. Así queda
  // como PASS con motivo y no como una falsa alarma en cada corrida — pero si
  // algún día naciera habilitado, la nota del caso lo dirá.
  reqV(await reqInicio(pg, 'COB', {
    naceDeshabilitado: 'primero hay que agregar un método de pago',
  }));
  reqV(await reqRechazo(pg, 'COB'));

  // ─── DM-COB-007: Tab Documentos → lista + leyenda ─────────────────────────────
  let hayDocs = false;
  try {
    const leerLeyenda = () => pg.evaluate(() => {
      const docs = document.querySelector('app-cobro-documents');
      if (!docs) return { leyenda: false };
      const txt = docs.textContent.toLowerCase();
      return { leyenda: txt.includes('vigente') || txt.includes('vencido') || txt.includes('favor') };
    });

    await clickTab('documentos');
    cargaDocs = await cargarDocumentos();   // robusto: US$ + reintento con toggle
    let info = await leerLeyenda();
    bitacoraCliente.push(`${ultimoClienteClickeado ? DATA.clienteTest : DATA.clienteTest}→${cargaDocs.cbs}`);
    if (cargaDocs.cbs > 0) clienteConDocs = DATA.clienteTest;
    else clientesSinDocs.add(DATA.clienteTest);

    // Rotación: si el cliente del perfil se quedó sin documentos, se prueban los
    // relevos. Cada intento arranca un cobro nuevo (cambiar de cliente a mitad
    // del formulario deja el modelo a medias).
    // ⚠ Tope de 8 relevos: cada intento cuesta ~20 s (salir, abrir cobro nuevo,
    //   elegir cliente, cargar documentos). Sin tope, una cartera agotada podía
    //   dejar el módulo 8 minutos rotando antes de rendirse.
    for (const cand of CANDIDATOS.slice(1, 9)) {
      if (cargaDocs.cbs > 0) break;
      try {
        await clickBack();
        await pg.waitForTimeout(1200);
        await dismissDirtyGuard();
        await pg.waitForTimeout(800);
        await irAHomeCobros();
        if (!(await abrirNuevoCobro())) { bitacoraCliente.push(`${cand}→no abrió el form`); continue; }
        await seleccionarCliente(cand);
        if (DATA.requiredComment) await fillComentario(comentTest);
        let h = 0;
        for (let i = 0; i < 8; i++) { h = await tabsHabilitadas(); if (h >= 4) break; await pg.waitForTimeout(700); }
        if (h < 4) { bitacoraCliente.push(`${cand}→pestañas ${h}/5`); continue; }
        await clickTab('documentos');
        cargaDocs = await cargarDocumentos();
        info = await leerLeyenda();
        bitacoraCliente.push(`${cand}→${cargaDocs.cbs}`);
        if (cargaDocs.cbs > 0) { clienteConDocs = cand; clienteOk = true; }
        else clientesSinDocs.add(cand);   // que los sub-flujos no vuelvan a probarlo
      } catch (e) {
        bitacoraCliente.push(`${cand}→${e.message}`);
      }
    }

    hayDocs = cargaDocs.cbs > 0;
    const recorrido = bitacoraCliente.length > 1 ? ` · recorrido: ${bitacoraCliente.join(' | ')}` : '';
    v('DM-COB-007', 'Tab Documentos → lista + leyenda', hayDocs ? 'PASS' : 'N/A',
      hayDocs
        ? `cliente: ${clienteConDocs} · documentos: ${cargaDocs.cbs} · leyenda: ${info.leyenda}${recorrido}`
        : `ningún candidato listó documentos${recorrido} · ` +
          `monedas del selector: ${JSON.stringify((cargaDocs.moneda && cargaDocs.moneda.labels) || [])} · ` +
          `🔑 el Tab Documentos es el ÚNICO inventario fiable: revisar en la web qué cobros ` +
          `«Por aprobar» están reteniendo los documentos de estos clientes`);
  } catch (e) {
    v('DM-COB-007', 'Tab Documentos', 'FAIL', e.message);
  }
  // A partir de aquí, el cliente vigente del formulario es el que sí tiene
  // documentos. Los flujos que montan cobros nuevos deben usar ÉSTE.
  const CLI_OK = clienteConDocs || DATA.clienteTest;

  // ─── DM-COB-008: Marcar documento → total en sticky de Pagos actualiza ─────────
  try {
    if (!hayDocs) { v('DM-COB-008', 'Marcar documento → total actualiza', 'N/A', 'sin documentos'); }
    else {
      const mark = await marcarPrimerDocumento();
      await clickTab('pagos');
      const total = await pg.evaluate(() => {
        const el = [...document.querySelectorAll('app-cobro-pagos *')]
          .find(n => /Monto total a pagar/i.test(n.textContent || ''));
        return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : null;
      });
      v('DM-COB-008', 'Marcar documento → total en Pagos', mark.ok && total ? 'PASS' : 'FAIL',
        `marcados: ${mark.count} · total: "${total || 'n/a'}"`);
    }
  } catch (e) {
    v('DM-COB-008', 'Marcar documento → total', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DM-COB-048/049/050/051 — DESCUENTO DE COBRO (tope maxCollectDiscount)
  //
  // Dónde vive: DETALLE del documento (lupa 🔍) → botón «Asignar descuento».
  //   · la lupa solo existe si `retentionDocTypeCR = true`
  //   · el botón solo existe si `userCanSelectCollectDiscount = true`
  //   · la lupa está DESHABILITADA mientras el documento no esté tildado
  //     ⇒ por eso este bloque va DESPUÉS de DM-COB-008.
  //
  // 🔑 EL TOPE SE APLICA A LA SUMA, y al excederlo NO SE CLAMPEA: el descuento
  //    que provocó el exceso **se quita de la selección** y sale una alerta
  //    (`setNuCollectDiscount` / `toggleTempSelection` → `notifyCollectDiscountLimitExceeded`).
  //    Quien espere «se queda en el máximo» reporta un falso defecto.
  //
  // 🔴 Todo este bloque cierra con CANCELAR. `cancelCollectDiscounts()` restaura
  //    desde lo persistido, así que el cobro del happy path queda INTACTO: aplicar
  //    un 80 % cambiaría el total y rompería DM-COB-040/012/043 aguas abajo.
  // ═══════════════════════════════════════════════════════════════════════════

  /** Abre el detalle (lupa) del primer documento tildado. */
  async function abrirDetalleDocumento() {
    await clickTab('documentos');
    await pg.waitForTimeout(800);
    const coords = await pg.evaluate(() => {
      const docs = document.querySelector('app-cobro-documents');
      if (!docs) return null;
      const btn = [...docs.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .filter(b => b.querySelector('ion-icon[name="search-sharp"]'))
        .find(b => !b.hasAttribute('disabled') && b.getAttribute('disabled') !== 'true');
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!coords) return false;
    await pg.mouse.click(coords.x, coords.y, { delay: 100 });
    await pg.waitForTimeout(1800);
    // El detalle es un ion-modal (#eventModal, isOpen). Confirmar que abrió.
    return pg.evaluate(() =>
      [...document.querySelectorAll('ion-modal')].some(m =>
        m.getBoundingClientRect().width > 0 && /Asignar descuento|Descuento|Nro Comp Ret/i.test(m.textContent || '')));
  }

  /** Pulsa «Asignar descuento» dentro del detalle. */
  async function abrirModalDescuentos() {
    const coords = await pg.evaluate(() => {
      const btn = [...document.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .find(b => /asignar\s+descuento|^descuentos$/i.test((b.textContent || '').trim()));
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!coords) return false;
    await pg.mouse.click(coords.x, coords.y, { delay: 100 });
    await pg.waitForTimeout(1500);
    return pg.evaluate(() =>
      [...document.querySelectorAll('ion-modal.collectDiscounts')].some(m => m.getBoundingClientRect().width > 0));
  }

  /**
   * Lee el estado del modal de descuentos.
   * Las filas se rotulan «{nu}% - {na}», así que el % sale del propio rótulo.
   */
  async function leerModalDescuentos() {
    return pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(m => m.getBoundingClientRect().width > 0);
      if (!modal) return { abierto: false };
      const filas = [...modal.querySelectorAll('ion-item')]
        .filter(it => it.getBoundingClientRect().width > 0 && it.querySelector('ion-checkbox'))
        .map(it => {
          const cb = it.querySelector('ion-checkbox');
          const txt = (it.querySelector('ion-label')?.textContent || '').replace(/\s+/g, ' ').trim();
          const m = txt.match(/^([\d.,]+)\s*%\s*-\s*(.+)$/);
          return {
            texto: txt,
            pct: m ? Number(String(m[1]).replace(',', '.')) : null,
            nombre: m ? m[2].trim() : txt,
            marcado: cb.checked === true || cb.getAttribute('checked') === 'true',
            deshabilitado: cb.disabled === true || cb.hasAttribute('disabled'),
          };
        });
      const dispTxt = (modal.textContent || '').replace(/\s+/g, ' ');
      const disp = dispTxt.match(/Disponible\s*:?\s*([\d.,]+)\s*%/i);
      const aceptar = [...modal.querySelectorAll('ion-button')]
        .find(b => /aceptar/i.test(b.textContent || ''));
      return {
        abierto: true,
        filas,
        disponible: disp ? Number(String(disp[1]).replace(',', '.')) : null,
        aceptarDeshabilitado: aceptar ? (aceptar.disabled === true || aceptar.hasAttribute('disabled')) : null,
        // Input de tasa: solo se renderiza para los descuentos con require_input=true
        hayInputTasa: !!modal.querySelector('ion-input[type="number"]'),
      };
    });
  }

  /** Tilda/destilda la fila cuyo nombre coincide. Devuelve false si no la halla. */
  async function toggleDescuento(nombre) {
    const coords = await pg.evaluate((nom) => {
      const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(m => m.getBoundingClientRect().width > 0);
      if (!modal) return null;
      const it = [...modal.querySelectorAll('ion-item')]
        .filter(x => x.getBoundingClientRect().width > 0 && x.querySelector('ion-checkbox'))
        .find(x => (x.textContent || '').toLowerCase().includes(String(nom).toLowerCase()));
      if (!it) return null;
      const cb = it.querySelector('ion-checkbox');
      cb.scrollIntoView({ block: 'center' });
      const r = cb.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, nombre);
    if (!coords) return false;
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
    await pg.waitForTimeout(1200);
    return true;
  }

  /**
   * Vuelve el modal de descuentos a cero: Cancelar y reabrir.
   *
   * 🔴 NO destildar casilla por casilla. Ese era el método anterior y se comía
   *    su propia cola: cuando una casilla queda tildada SIN estar aplicada
   *    (el desfase de DM-COB-052), clicarla no la quita — la AGREGA, porque el
   *    modelo no la tenía. Así, al llegar a DM-COB-051 el modelo cargaba un 80 %
   *    fantasma y el aviso decía «Máximo disponible: 5%»: el caso fallaba por
   *    culpa del guion, no de la app.
   *    `cancelCollectDiscounts()` descarta la selección temporal y al reabrir
   *    modelo y pantalla vuelven a coincidir.
   */
  async function reiniciarDescuentos() {
    const c = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(m => m.getBoundingClientRect().width > 0);
      if (!modal) return null;
      const btn = [...modal.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .find(b => /cancelar/i.test((b.textContent || '').trim()));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (c) { await pg.mouse.click(c.x, c.y, { delay: 80 }); await pg.waitForTimeout(1200); }
    return abrirModalDescuentos();
  }

  /**
   * Acepta el modal de descuentos (los APLICA al documento abierto).
   *
   * ⚠ Puede aparecer el aviso de «remanente»: si el descuento sobra respecto al
   *   saldo, la app ofrece llevarlo a un anticipo (`alertDiscountRemnantOpen`).
   *   Con un descuento por debajo del saldo no debería salir; se atiende igual.
   */
  /**
   * Pulsa «Aceptar» en el modal de descuentos y espera a que CIERRE.
   *
   * 🔴 DOS COSAS QUE COSTARON UNA VUELTA ENTERA (15/09):
   *
   * 1. **El teclado mueve el botón.** Este modal tiene un campo libre de
   *    descuento manual. Si se acaba de teclear en él, el teclado virtual está
   *    abierto y el pie del modal —donde vive Aceptar— está en otra `y` que la
   *    medida. El clic cae en el vacío: **no da error y no pasa nada**, y el
   *    fallo aparece tres pasos después como «Guardar ausente» en el detalle.
   *    Por eso: `blur()`, esperar, y medir en la misma evaluación que precede
   *    al clic. Con el descuento por PORCENTAJE nunca se vio porque allí lo
   *    último que se toca es una casilla, no un input.
   *
   * 2. **Aceptar no siempre cierra a la primera, y es CORRECTO.** Si el
   *    descuento supera el saldo, `acceptCollectDiscounts()` deja el modal
   *    abierto y levanta la alerta del remanente (el anticipo que se va a
   *    crear). Hasta que esa alerta no se confirma, el modal sigue ahí. Así que
   *    se espera al cierre sondeando, atendiendo las alertas que aparezcan.
   */
  async function aceptarDescuentos() {
    await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await pg.waitForTimeout(800);
    const c = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(m => m.getBoundingClientRect().width > 0);
      if (!modal) return { err: 'el modal de descuentos no está abierto' };
      const btn = [...modal.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .find(b => /aceptar/i.test((b.textContent || '').trim()));
      if (!btn) return { err: 'botón Aceptar ausente' };
      if (btn.disabled === true || btn.hasAttribute('disabled')) {
        return { err: 'botón Aceptar deshabilitado (disabledCollectDiscountButton)' };
      }
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const en = document.elementFromPoint(x, y);
      // 🔑 Verificar OCLUSIÓN, no presencia: si en ese punto responde otra cosa
      //    (el backdrop, el teclado), el clic real no llega al botón.
      const tapado = !(en && (en === btn || btn.contains(en) || en.closest('ion-button') === btn));
      return { x, y, tapado, en: en ? en.tagName : null };
    });
    if (c.err) return { ok: false, motivo: c.err };

    if (!c.tapado) await pg.mouse.click(c.x, c.y, { delay: 90 });
    else await pg.evaluate(() => {
      const m = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(x => x.getBoundingClientRect().width > 0);
      const b = m && [...m.querySelectorAll('ion-button')]
        .find(x => /aceptar/i.test((x.textContent || '').trim()));
      if (b) ((b.shadowRoot && b.shadowRoot.querySelector('button')) || b).click();
    });

    // Espera al CIERRE, atendiendo alertas (la del remanente incluida).
    let aviso = null, cerrado = false;
    for (let i = 0; i < 8; i++) {
      await pg.waitForTimeout(900);
      const al = await readAlert();
      if (al) { aviso = aviso || al; await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); continue; }
      cerrado = await pg.evaluate(() =>
        ![...document.querySelectorAll('ion-modal.collectDiscounts')]
          .some(m => m.getBoundingClientRect().width > 0));
      if (cerrado) break;
    }
    // Último recurso: el clic real se perdió ⇒ una sola activación por DOM.
    if (!cerrado) {
      await pg.evaluate(() => {
        const m = [...document.querySelectorAll('ion-modal.collectDiscounts')]
          .find(x => x.getBoundingClientRect().width > 0);
        const b = m && [...m.querySelectorAll('ion-button')]
          .filter(x => !x.hasAttribute('disabled'))
          .find(x => /aceptar/i.test((x.textContent || '').trim()));
        if (b) ((b.shadowRoot && b.shadowRoot.querySelector('button')) || b).click();
      });
      for (let i = 0; i < 6; i++) {
        await pg.waitForTimeout(900);
        const al = await readAlert();
        if (al) { aviso = aviso || al; await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); continue; }
        cerrado = await pg.evaluate(() =>
          ![...document.querySelectorAll('ion-modal.collectDiscounts')]
            .some(m => m.getBoundingClientRect().width > 0));
        if (cerrado) break;
      }
    }
    return { ok: cerrado, aviso, tapado: c.tapado,
             motivo: cerrado ? undefined : 'el modal de descuentos no cerró tras pulsar Aceptar' };
  }

  /**
   * Cierra el DETALLE del documento por GUARDAR.
   *
   * 🔴 No da igual el botón. El pie del detalle es
   *      Cancelar → saveDocumentSale(false)   ·   Guardar → saveDocumentSale(true)
   *    (cobro-documents.component.html, pie del #eventModal). Salir por Cancelar
   *    DESCARTA lo que se hizo dentro — que es justo lo que quieren los casos
   *    048-052, y justo lo que NO quiere el flujo que aplica el descuento.
   */
  /**
   * 🔴 DOS TRAMPAS, las dos medidas en 4K el 14/09:
   *
   * 1. **`.botonAddVerde` NO identifica a «Guardar».** En el detalle del
   *    documento hay DOS botones con esa clase: «Asignar descuento» y
   *    «Guardar» — y «Guardar» nace **deshabilitado**. El filtro anterior
   *    («el último .botonAddVerde visible y no deshabilitado») elegía
   *    entonces **«Asignar descuento»**: abría el modal de descuentos en vez
   *    de guardar, y el caso moría tres pasos después sin decir por qué.
   *    Ahora se busca por TEXTO.
   *
   * 2. **El teclado mueve el botón.** Tras teclear en «Monto a pagar», el
   *    Guardar medido estaba en y≈430 y el real en y≈709: el clic caía en el
   *    vacío, no fallaba, y el pago parcial simplemente no se aplicaba. Por eso
   *    va `blur()` + espera ANTES de medir, y las coordenadas se toman en la
   *    misma evaluación que precede al clic.
   */
  async function cerrarDetalleGuardando() {
    await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await pg.waitForTimeout(700);
    const c = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return { err: 'el detalle ya no está abierto' };
      const btn = [...modal.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0 && !b.hasAttribute('disabled'))
        .find(b => /^guardar$/i.test((b.textContent || '').trim()));
      if (!btn) {
        return { err: 'Guardar ausente o deshabilitado',
                 botones: [...modal.querySelectorAll('ion-button')]
                   .map(b => (b.textContent || '').trim() + (b.hasAttribute('disabled') ? '(dis)' : '')) };
      }
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      // Verificar oclusión, no presencia: el clic tiene que llegar al botón.
      const enPunto = document.elementFromPoint(x, y);
      return { x, y, tapado: !(enPunto && (enPunto === btn || btn.contains(enPunto) ||
                                           enPunto.closest('ion-button') === btn)) };
    });
    if (c.err) return { ok: false, motivo: c.err + (c.botones ? ` · botones: ${c.botones.join(' | ')}` : '') };
    await pg.mouse.click(c.x, c.y, { delay: 110 });
    await pg.waitForTimeout(2000);
    const al = await readAlert();
    if (al) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
    const cerrado = await pg.evaluate(() =>
      ![...document.querySelectorAll('ion-modal')].some(m => m.getBoundingClientRect().width > 0));
    return { ok: cerrado, tapado: c.tapado,
             motivo: cerrado ? '' : 'el detalle no se cerró tras pulsar Guardar' };
  }

  /** Cierra el modal de descuentos con Cancelar y luego el detalle del documento. */
  async function cerrarDescuentosSinAplicar() {
    for (const rotulo of [/cancelar/i, /cerrar|cancelar/i]) {
      const c = await pg.evaluate((re) => {
        const rx = new RegExp(re.source, re.flags);
        const modal = [...document.querySelectorAll('ion-modal')]
          .filter(m => m.getBoundingClientRect().width > 0).pop();
        if (!modal) return null;
        const btn = [...modal.querySelectorAll('ion-button')]
          .filter(b => b.getBoundingClientRect().width > 0)
          .find(b => rx.test((b.textContent || '').trim()));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, { source: rotulo.source, flags: rotulo.flags });
      if (c) { await pg.mouse.click(c.x, c.y, { delay: 80 }); await pg.waitForTimeout(1200); }
    }
    await pg.waitForTimeout(600);
  }

  /**
   * ¿El texto leído es EL aviso del tope de descuento?
   *
   * 🔴 No basta con «salió una alerta». `readAlert()` devuelve cualquier ion-alert
   *    activa, y en Cobros hay varias (guarda de salida, usuario diferente…). Si
   *    se toma cualquiera como prueba del rechazo, un aviso ajeno da un PASS
   *    falso. El mensaje real lo arma `notifyCollectDiscountLimitExceeded`:
   *      «Se superó el límite de descuento (85%). Máximo disponible: 5%.»
   *    — y puede venir del tag COB_MSJ_DISCOUNT_EXCEEDS_100 con otra redacción,
   *    por eso se acepta cualquiera que hable de límite/tope + descuento.
   */
  function esAlertaTope(txt) {
    if (!txt) return false;
    return /descuento/i.test(txt) &&
           /l[íi]mite|tope|super[óo]|excede|m[áa]ximo\s+disponible/i.test(txt);
  }

  const DESC_IDS = ['DM-COB-048', 'DM-COB-049', 'DM-COB-050', 'DM-COB-051', 'DM-COB-052'];
  // El bloque del tope descubre cuál descuento del catálogo entra por debajo del
  // límite; el segundo cobro lo reutiliza para aplicarlo de verdad. Se descubre
  // en la UI, no se codifica: los nombres los pone quien los crea en la web.
  let nombreDtoAplicable = null;
  let pctDtoAplicable = null;
  // Catálogo real de descuentos leído en la UI. Se guarda a este nivel porque
  // DM-COB-069 —el caso que dice si el TOPE llega a ser ejercitable— lo necesita
  // mucho más abajo, y deducirlo del YAML sería volver al error de siempre.
  let catalogoDescuentos = null;
  try {
    // 🔴 `maxCollectDiscount = 0` en el equipo (medido el 14/09). `Number(x)||100`
    //    lo convierte en 100 y eso ES una decisión, no un valor: se anota para
    //    que el informe no diga «tope 100%» como si estuviera configurado así.
    const TOPE_VG = Number(DATA.maxCollectDiscount);
    const TOPE = TOPE_VG || 100;
    const notaTope = TOPE_VG ? `tope configurado: ${TOPE_VG}%`
      : `maxCollectDiscount=${DATA.maxCollectDiscount} en el equipo ⇒ el guion asume «sin tope» (100%)`;

    if (!DATA.userCanSelectCollectDiscount) {
      DESC_IDS.forEach(id => v(id, id, 'N/A', 'userCanSelectCollectDiscount=false'));
    } else if (!DATA.retentionDocTypeCR) {
      DESC_IDS.forEach(id => v(id, id, 'N/A',
        'retentionDocTypeCR=false ⇒ no existe la lupa que abre el detalle del documento'));
    } else if (!hayDocs) {
      DESC_IDS.forEach(id => v(id, id, 'N/A', 'sin documentos seleccionados'));
    } else {
      const detalle = await abrirDetalleDocumento();

      // ── DM-COB-048: el botón «Asignar descuento» está en el detalle ──────────
      if (!detalle) {
        v('DM-COB-048', 'Detalle del documento → botón «Asignar descuento»', 'FAIL',
          'no se pudo abrir el detalle (lupa ausente o deshabilitada pese a documento tildado)');
        ['DM-COB-049', 'DM-COB-050', 'DM-COB-051', 'DM-COB-052'].forEach(id =>
          v(id, id, 'BLOCKED', 'DM-COB-048 no abrió el detalle'));
      } else {
        const abierto = await abrirModalDescuentos();
        v('DM-COB-048', 'Detalle del documento → botón «Asignar descuento» abre el modal',
          abierto ? 'PASS' : 'FAIL',
          `userCanSelectCollectDiscount=true · ${notaTope}`);

        if (!abierto) {
          ['DM-COB-049', 'DM-COB-050', 'DM-COB-051', 'DM-COB-052'].forEach(id =>
            v(id, id, 'BLOCKED', 'el modal de descuentos no abrió'));
        } else {
          const inicial = await leerModalDescuentos();
          const cat = inicial.filas || [];
          const fijos = cat.filter(f => f.pct !== null && f.pct > 0);
          catalogoDescuentos = fijos;


          // ── DM-COB-049: un descuento por debajo del tope se acepta ────────────
          const bajoTope = fijos.find(f => f.pct <= TOPE);
          if (!bajoTope) {
            v('DM-COB-049', 'Descuento bajo el tope se acepta', 'BLOCKED',
              `el catálogo no trae ningún descuento ≤ ${TOPE}% · filas: ${cat.map(f => f.texto).join(' | ') || '(vacío)'}`);
          } else {
            nombreDtoAplicable = bajoTope.nombre;
            pctDtoAplicable = bajoTope.pct;
            await toggleDescuento(bajoTope.nombre);
            const tras = await leerModalDescuentos();
            const fila = (tras.filas || []).find(f => f.nombre === bajoTope.nombre);
            const alerta = await readAlert();
            const ok = !!(fila && fila.marcado) && !esAlertaTope(alerta);
            v('DM-COB-049', `Descuento ${bajoTope.pct}% (≤ ${TOPE}%) se acepta`,
              ok ? 'PASS' : 'FAIL',
              `«${bajoTope.nombre}» marcado: ${fila ? fila.marcado : 'fila ausente'} · ` +
              `disponible: ${tras.disponible === null ? '—' : tras.disponible + '%'} · ` +
              `alerta: ${alerta || 'ninguna'}`);
            if (alerta) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
          }

          // ── DM-COB-050: excederse del tope se rechaza (y NO se clampea) ───────
          //
          // 🔑 DOS MANERAS de excederse, y hay que admitir las dos. La segunda
          //    es la que permite probar el tope SIN tocar la BD: basta bajar
          //    `maxCollectDiscount` en la web por debajo del descuento que ya
          //    existe (p. ej. tope 79 contra el «Probando» de 80 %) y sincronizar.
          //      a) por SUMA      — dos descuentos que juntos pasan del tope
          //      b) por SÍ SOLO   — un único descuento cuyo % ya supera el tope
          const usado  = bajoTope ? bajoTope.pct : 0;
          const porSuma = bajoTope
            ? fijos.find(f => f.nombre !== bajoTope.nombre && (usado + f.pct) > TOPE)
            : null;
          const porSiSolo = fijos.find(f => f.pct > TOPE);
          const culpable  = porSuma || porSiSolo;

          if (!culpable) {
            // 🔑 N/A, no BLOCKED. BLOCKED es «no lo probé»; esto es «no se puede
            //    probar con esta configuración»: el catálogo no alcanza el tope ni
            //    sumando todos sus descuentos. Un caso que NO PUEDE FALLAR no es un
            //    PASS, y llamarlo BLOCKED corrida tras corrida sugiere una avería
            //    que no existe. Ver DM-COB-069, que lo declara con los números.
            v('DM-COB-050', `Excederse de ${TOPE}% se rechaza`, 'N/A',
              `NO EJERCITABLE: con este catálogo no hay forma de pasarse del ${TOPE}%: ` +
              `${fijos.map(f => `${f.nombre} ${f.pct}%`).join(' · ') || '(ninguno)'}. ` +
              `Dos salidas, ambas por WEB + sincronizar: (1) bajar maxCollectDiscount ` +
              `(Variables Globales → Cobros) por debajo de ` +
              `${fijos.length ? Math.max(...fijos.map(f => f.pct)) : 0}%, o ` +
              '(2) crear otro descuento en Empresa → Configuración → Descuentos para Cobros');
            v('DM-COB-052', 'Tras el rechazo, la casilla NO queda tildada', 'N/A',
              'NO EJERCITABLE: sin rechazo que provocar (ver DM-COB-050/069) no hay nada que observar');
          } else {
            const via = porSuma
              ? `${usado}% + ${culpable.pct}% = ${usado + culpable.pct}% > ${TOPE}%`
              : `${culpable.pct}% > ${TOPE}% (un solo descuento ya se pasa)`;
            // Si se excede por sí solo, partir de cero: destildar lo que hubiera.
            if (!porSuma) {
              for (const f of (await leerModalDescuentos()).filas || []) {
                if (f.marcado) await toggleDescuento(f.nombre);
              }
            }
            await toggleDescuento(culpable.nombre);
            const alerta = await readAlert();
            const tras   = await leerModalDescuentos();
            const fila   = (tras.filas || []).find(f => f.nombre === culpable.nombre);
            const previo = porSuma
              ? (tras.filas || []).find(f => f.nombre === bajoTope.nombre)
              : null;
            // Rechazo correcto = aviso del tope + el culpable NO queda marcado
            //                    (+ si venía por suma, el anterior sobrevive)
            // 🔑 SON DOS COSAS DISTINTAS, y mezclarlas dio un FAIL confuso:
            //
            //   050 · ¿la app RECHAZA? — lo dicen el aviso del tope y que el
            //         descuento previo siga en pie. Esto funcionó bien.
            //   052 · ¿la casilla refleja el rechazo? — quedó TILDADA aunque el
            //         descuento no se aplicó. Es un hallazgo aparte.
            //
            // El aviso trae su propia prueba de que el modelo NO lo aceptó:
            // «Máximo disponible: X%» se calcula sobre lo YA seleccionado, así
            // que si dice 75 % con tope 85, el modelo tenía 10 %, no 90 %.
            const rechazo = esAlertaTope(alerta) && (!porSuma || !!(previo && previo.marcado));
            v('DM-COB-050', `${via} ⇒ se rechaza`, rechazo ? 'PASS' : 'FAIL',
              `alerta: "${alerta || 'NINGUNA'}"` +
              (porSuma ? ` · «${bajoTope.nombre}» sigue marcado: ${previo ? previo.marcado : 'n/a'}` : ''));

            const casilla = fila ? fila.marcado : null;
            v('DM-COB-052', 'Tras el rechazo, la casilla NO queda tildada',
              casilla === false ? 'PASS' : (casilla === null ? 'BLOCKED' : 'FAIL'),
              casilla === null
                ? `no se pudo releer la fila «${culpable.nombre}»`
                : `«${culpable.nombre}» quedó marcado: ${casilla}. ` +
                  (casilla
                    ? '🔴 El descuento NO se aplicó (lo confirma el propio aviso) pero la casilla ' +
                      'sigue tildada: el vendedor ve puesto un descuento que no está. ' +
                      'La rama que rechaza en toggleTempSelection hace return sin detectChanges(), ' +
                      'al revés que sus dos hermanas, y el binding [checked] no reescribe el DOM. ' +
                      'CONFIRMAR A MANO antes de reportar.'
                    : 'la casilla vuelve sola a su sitio'));
            if (alerta) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
          }

          // ── DM-COB-051: tasa escrita — borde exacto del tope ──────────────────
          // Se arranca de cero: 050 dejó descuentos puestos y casillas desfasadas.
          // 🔴 EL EDITABLE NO SE BUSCA POR NOMBRE. Antes se buscaba /tasa libre/i
          //    —el nombre que yo inventé en un SQL que ni llegó a usarse— y este
          //    caso salió BLOCKED diciendo que no había ninguno, habiendo DOS
          //    («DESC MANUAL»). El nombre lo escribe quien crea el descuento en
          //    la web: no identifica nada. Lo que distingue al editable es su
          //    COMPORTAMIENTO: al marcarlo aparece el input de tasa
          //    (@if requireInput === true). Se prueban primero los de 0 %, que
          //    es como quedan guardados los manuales.
          await reiniciarDescuentos();
          let libre = null;
          const candidatos = [...cat].sort((a, b) => (a.pct === 0 ? 0 : 1) - (b.pct === 0 ? 0 : 1));
          for (const c of candidatos) {
            if (c.pct !== null && c.pct > TOPE) continue;   // dispararía el aviso del tope
            if (!(await toggleDescuento(c.nombre))) continue;
            const st = await leerModalDescuentos();
            const al = await readAlert();
            if (al) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
            if (st.hayInputTasa) { libre = c; break; }
            await reiniciarDescuentos();
          }

          if (!libre) {
            v('DM-COB-051', `Tasa escrita: ${TOPE}% acepta · ${TOPE + 1}% rechaza`, 'N/A',
              `NO EJERCITABLE: ninguno de los ${cat.length} descuento(s) del catálogo abre el input de tasa ` +
              'al marcarlo (require_input=true). Crear uno con «Porcentaje Manual = SÍ» en ' +
              'Empresa → Configuración → Descuentos para Cobros y sincronizar');
          } else {
            // El bucle de detección dejó SOLO el editable marcado. No se destilda
            // nada a mano: con las casillas desfasadas, un clic agrega en vez de quitar.
            await pg.waitForTimeout(600);

            const escribirTasa = async (valor) => {
              await pg.evaluate((val) => {
                const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
                  .find(m => m.getBoundingClientRect().width > 0);
                const inp = modal && modal.querySelector('ion-input[type="number"]');
                if (!inp) return false;
                const native = inp.querySelector('input') ||
                  (inp.shadowRoot && inp.shadowRoot.querySelector('input'));
                if (!native) return false;
                const setter = Object.getOwnPropertyDescriptor(
                  window.HTMLInputElement.prototype, 'value').set;
                setter.call(native, String(val));
                native.dispatchEvent(new Event('input', { bubbles: true }));
                native.dispatchEvent(new Event('change', { bubbles: true }));
                inp.dispatchEvent(new CustomEvent('ionInput', { bubbles: true, detail: { value: String(val) } }));
                inp.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: String(val) } }));
                return true;
              }, valor);
              await pg.waitForTimeout(1300);
            };

            await escribirTasa(TOPE);
            const enTope = await leerModalDescuentos();
            const filaTope = (enTope.filas || []).find(f => f.nombre === libre.nombre);
            const alertaTope = await readAlert();
            if (alertaTope) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});

            await escribirTasa(TOPE + 1);
            const alertaExceso = await readAlert();
            const trasExceso = await leerModalDescuentos();
            const filaExceso = (trasExceso.filas || []).find(f => f.nombre === libre.nombre);
            if (alertaExceso) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});

            // Borde: TOPE se acepta (sin alerta, sigue marcado) · TOPE+1 se rechaza
            // (alerta) y el descuento SE QUITA de la selección.
            const aceptaTope  = !esAlertaTope(alertaTope) && !!(filaTope && filaTope.marcado);
            const rechazaMas  = esAlertaTope(alertaExceso) && !!(filaExceso && !filaExceso.marcado);
            v('DM-COB-051', `Tasa escrita: ${TOPE}% se acepta · ${TOPE + 1}% se rechaza`,
              (aceptaTope && rechazaMas) ? 'PASS' : 'FAIL',
              `${TOPE}% → alerta: "${alertaTope || 'ninguna'}", marcado: ${filaTope ? filaTope.marcado : 'n/a'} · ` +
              `${TOPE + 1}% → alerta: "${alertaExceso || 'NINGUNA'}", marcado: ` +
              `${filaExceso ? filaExceso.marcado : 'n/a'} (debe quedar false: al exceder se QUITA)`);
          }

          await cerrarDescuentosSinAplicar();
        }
      }
      // Volver al formulario: el detalle se cierra con Cancelar/Cerrar.
      await cerrarDescuentosSinAplicar();
    }
  } catch (e) {
    DESC_IDS.forEach(id => {
      if (!verdicts.some(x => x.id === id)) v(id, id, 'FAIL', e.message);
    });
    await cerrarDescuentosSinAplicar().catch(() => {});
  }

  // ─── DM-COB-009: Tab Pagos → click "Agregar método de pago" → modal ───────────
  try {
    await clickTab('pagos');
    // Click REAL en #eventSelect (setShowEventModal(true)). NO usar .present() → forzaba
    // el modal size="cover" a pantalla completa saltando el binding de Angular.
    const addInfo = await pg.evaluate(() => {
      const btn = document.querySelector('ion-button#eventSelect, ion-button.pagos-add-method-btn');
      if (!btn || btn.getBoundingClientRect().width === 0) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: btn.disabled };
    });
    if (!addInfo) {
      v('DM-COB-009', 'Tab Pagos → botón "Agregar método de pago"', 'N/A',
        'botón no visible (requiere documento/monto seleccionado)');
    } else if (addInfo.disabled) {
      v('DM-COB-009', 'Tab Pagos → botón "Agregar método de pago"', 'N/A',
        'botón disabled (isAddPaymentMethodDisabled — falta documento/monto)');
    } else {
      await pg.mouse.click(addInfo.x, addInfo.y, { delay: 100 });
      await pg.waitForTimeout(1800);
      const info = await pg.evaluate(() => {
        const mods = [...document.querySelectorAll('#eventModal')]
          .filter(m => m.offsetParent !== null && /Efectivo|Transferencia|Dep/i.test(m.textContent));
        if (!mods.length) return { open: false };
        const metodos = (mods[0].textContent.match(/Efectivo|Cheque|Transferencia|Dep[oó]sito|Otros|Pago M[oó]vil/gi) || []);
        return { open: true, metodos: [...new Set(metodos)] };
      });
      v('DM-COB-009', 'Tab Pagos → modal métodos de pago', info.open ? 'PASS' : 'FAIL',
        info.open ? `métodos: ${info.metodos.join(', ')}` : 'modal no abrió tras click');
      // Cerrar por el botón Cancelar del modal (setShowEventModal(false)) — mantiene estado Angular
      await pg.evaluate(() => {
        const mod = [...document.querySelectorAll('#eventModal')].find(m => m.offsetParent !== null);
        if (!mod) return;
        const cancel = [...mod.querySelectorAll('ion-button[color="light"]')].find(b => b.getBoundingClientRect().width > 0);
        if (cancel) cancel.click();
      });
      await pg.waitForTimeout(800);
    }
  } catch (e) {
    v('DM-COB-009', 'Tab Pagos → modal métodos', 'FAIL', e.message);
  }

  // ─── DM-COB-040/012/043: Completar pago Efectivo = total → diferencia azul ─────
  let pagoOk = false;
  try {
    if (!hayDocs) {
      ['DM-COB-040', 'DM-COB-012', 'DM-COB-043'].forEach(id => v(id, id, 'N/A', 'sin documento seleccionado'));
    } else {
      await clickTab('pagos');
      const difAntes = await leerPagosSticky();     // sin pago → diferencia roja (negativa)
      const pago = await agregarPagoEfectivo();
      if (!pago.ok) throw new Error(pago.error || 'pago falló');
      const difDespues = await leerPagosSticky();   // pago = total → diferencia azul (0,00)
      const esAzul = /blue|rgb\(0,\s*0,\s*255\)|#00f/i.test(difDespues.difColor || '');
      const esCero = /^-?0([.,]0+)?$/.test((difDespues.difVal || '').trim());
      pagoOk = esAzul || esCero;
      v('DM-COB-040', 'Completar pago Efectivo = total → diferencia azul', pagoOk ? 'PASS' : 'FAIL',
        `monto: ${pago.monto} · antes: ${difAntes.difVal}(${difAntes.difColor}) · después: ${difDespues.difVal}(${difDespues.difColor})`);
      const rojoAntes = /red|rgb\(255,\s*0,\s*0\)/i.test(difAntes.difColor || '');
      v('DM-COB-012', 'Diferencia rojo (insuf.) → azul (cubre)', (rojoAntes && pagoOk) ? 'PASS' : 'FAIL',
        `antes: ${difAntes.difColor} · después: ${difDespues.difColor}`);
      v('DM-COB-043', 'Diferencia se actualiza con el monto', (difAntes.difVal !== difDespues.difVal) ? 'PASS' : 'FAIL',
        `antes: ${difAntes.difVal} · después: ${difDespues.difVal}`);
    }
  } catch (e) {
    ['DM-COB-040', 'DM-COB-012', 'DM-COB-043'].forEach(id => {
      if (!verdicts.find(x => x.id === id)) v(id, id, 'FAIL', e.message);
    });
  }

  // ─── DM-COB-016: Tab Adjuntos → acordeones visibles ───────────────────────────
  // NOTA: la inyección de adjunto (inyectarAdjunto) queda para DM-COB-019 (Fase 2), JUSTO
  // antes de Enviar. Inyectar aquí (antes de Guardar) dispara onAttachmentChanged y rompe el
  // Guardar inmediato — confirmado en corrida 20260826_162210 (018 sin alert + cascada nav).
  try {
    await clickTab('adjuntos');
    const info = await pg.evaluate(() => {
      const adj = document.querySelector('app-adjunto');
      const txt = (adj ? adj.textContent : document.body.textContent).toLowerCase();
      return {
        img: txt.includes('imagen') || txt.includes('foto'),
        arch: txt.includes('archivo') || txt.includes('file'),
        firma: txt.includes('firma'),
      };
    });
    v('DM-COB-016', 'Tab Adjuntos → acordeones visibles', info.img ? 'PASS' : 'FAIL',
      `imágenes: ${info.img} · archivo: ${info.arch} · firma: ${info.firma}`);
  } catch (e) {
    v('DM-COB-016', 'Tab Adjuntos', 'FAIL', e.message);
  }

  // ─── DM-COB-018: Guardar → alert "El Cobro se ha guardado" ─────────────────────
  let guardadoOk = false;
  let antesDeGuardar = null;   // foto del cobro antes de guardar, para cotejar al reabrirlo
  let enviadoOk = false;
  try {
    // 🔴 NO decidir con la foto vieja. `clienteOk` se calculó en DM-COB-004, al
    //    principio del módulo; si en ese instante las pestañas todavía no se
    //    habían habilitado, quedaba en false PARA SIEMPRE — y Guardar y Enviar
    //    se saltaban con «sin cliente válido» aunque el cobro estuviera completo
    //    y listo. Eso fue lo que se vio el 07/09: los casos intermedios pasaban
    //    (5 documentos marcados, diferencia en azul) y aun así no guardaba.
    //
    //    Se vuelve a mirar el estado REAL justo antes de guardar.
    const listoAhora = await pg.evaluate(() => {
      const vis = el => el.getBoundingClientRect().width > 0;
      const tabs = [...document.querySelectorAll('ion-segment-button')].filter(vis);
      const habilitadas = tabs.filter(t => !(t.disabled || t.getAttribute('disabled') !== null)).length;
      const btn = document.querySelector('ion-button.imagenGuardar');
      return {
        habilitadas,
        guardarDisponible: !!btn && vis(btn) && !btn.disabled,
      };
    });
    const puedeGuardar = listoAhora.guardarDisponible && listoAhora.habilitadas >= 4;

    if (!puedeGuardar) {
      v('DM-COB-018', 'Guardar cobro → alert', 'N/A',
        `no está listo para guardar · tabs habilitadas: ${listoAhora.habilitadas} · ` +
        `botón Guardar: ${listoAhora.guardarDisponible ? 'disponible' : 'no disponible'} · ` +
        `(al inicio del módulo: cliente ${clienteOk ? 'ok' : 'no ok'}, documentos ${hayDocs ? 'sí' : 'no'})`);
    } else {
      // ── REQ Enviar · E5 ─────────────────────────────────────────────────────
      // El cobro está completo: documento marcado y pago cuadrado con el total
      // (DM-COB-040/012/043 dejaron la diferencia en azul). Si alguna pestaña
      // sigue en rojo aquí, no corresponde a ningún campo pendiente (F1).
      // Se mide antes de Guardar, que es el punto más avanzado al que llega la
      // Fase 1 del guion: el Enviar de Cobros vive en DM-COB-019 y depende del
      // adjunto obligatorio.
      reqV(await reqPestanaRoja(pg, 'COB', { rotar: true }));

      // 📸 Foto del cobro ANTES de guardar. Es lo que se comparará al reabrirlo
      //    en DM-COB-024: sin esto no se puede afirmar que «no se perdió nada»,
      //    solo que la pantalla abre.
      //
      // 🔴 Los campos (Cliente, Responsable, Comentario) están en la pestaña
      //    GENERAL. Al llegar aquí estamos parados en Pagos o Adjuntos, así que
      //    NO son visibles y la foto salía VACÍA — y una foto vacía hace que el
      //    cotejo compare 0 campos y pase por defecto. Hay que volver a General.
      const tabGen = await clickTab('general').catch(e => ({ ok: false, motivo: e.message }));
      await pg.waitForTimeout(900);
      antesDeGuardar = await fotoDelCobro();
      if (tabGen && !tabGen.ok) {
        antesDeGuardar.diag.tabGeneral = tabGen.motivo +
          (tabGen.valores ? ` · las que hay: ${tabGen.valores.join(', ')}` : '');
      }

      const clic = await clickGuardarEnviar('imagenGuardar');
      await pg.waitForTimeout(1500);
      const alertMsg = await readAlert();
      guardadoOk = !!(alertMsg && /guardad/i.test(alertMsg));
      // La vía por la que respondió el botón se anota siempre: si empieza a
      // resolverse por 'dom' de forma sistemática, es que el clic real dejó de
      // llegar al header y hay que revisar las coordenadas, no seguir tapándolo.
      const viaTxt = clic.ok ? `clic:${clic.via}/${clic.motivo}` : `clic FALLÓ (${clic.motivo})`;
      v('DM-COB-018', 'Guardar cobro → alert confirmación', guardadoOk ? 'PASS' : 'FAIL',
        `${viaTxt} · alert: "${alertMsg || 'ninguno'}"`);
      if (alertMsg) await clickAlertBtn(['Aceptar', 'OK']);
    }
  } catch (e) {
    v('DM-COB-018', 'Guardar cobro', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO DE PERSISTENCIA — el orden importa (definido con QA el 07/09)
  //
  //   guardar → salir → BUSCAR → reabrir → COTEJAR que nada se perdió → ENVIAR
  //
  // 🔴 Antes el orden era: guardar → enviar(BLOCKED) → buscar → reabrir → BORRAR.
  //    Dos errores: el envío se saltaba por un motivo que ya no aplica
  //    (`requiredCollectionAttachments` pasó a false), y el caso de eliminar
  //    borraba el cobro ANTES de que nadie lo enviara. Resultado: el script
  //    guardaba, borraba, y no enviaba nunca.
  //
  //    Eliminar un guardado es un SEGUNDO FLUJO, con su propio cobro. No puede
  //    destruir el que está por enviarse.
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── DM-COB-022: BUSCAR → lista + searchbar ───────────────────────────────────
  try {
    await irAHomeCobros();
    await clickBotonHome('BUSCAR');
    let info = { list: false, items: 0 };
    for (let i = 0; i < 10; i++) {
      await pg.waitForTimeout(1000);
      info = await pg.evaluate(() => {
        const list = document.querySelector('app-cobros-list');
        if (!list || list.offsetParent === null) return { list: false, items: 0 };
        const items = [...list.querySelectorAll('ion-item')].filter(el => el.getBoundingClientRect().width > 0).length;
        const sb = !!list.querySelector('ion-searchbar');
        return { list: true, items, sb };
      });
      if (info.list) break;
    }
    v('DM-COB-022', 'BUSCAR → lista con searchbar', info.list ? 'PASS' : 'FAIL',
      `lista: ${info.list} · ítems: ${info.items} · searchbar: ${info.sb}`);
  } catch (e) {
    v('DM-COB-022', 'BUSCAR → lista', 'FAIL', e.message);
  }

  // ─── DM-COB-024: reabrir el Guardado y COTEJAR que no se perdió nada ──────────
  let reabiertoOk = false;   // el COTEJO de campos salió bien
  // 🔴 Distinto de reabiertoOk: dice solo si el cobro ABRIÓ. Enviar depende de
  //    esto, NO del cotejo. El 07/09 16:02 el cobro abrió perfecto (5 tabs) pero
  //    la foto vino vacía ⇒ 024 BLOCKED ⇒ 019 quedó N/A y NO SE ENVIÓ NADA. El
  //    envío no puede caerse porque la comparación no tuviera insumo.
  let reabrioOk = false;
  try {
    if (!guardadoOk) {
      v('DM-COB-024', 'Reabrir Guardado → los datos persisten', 'N/A', 'no hubo cobro guardado');
    } else {
      // 🔑 Se busca EL cobro de esta corrida por su comentario único. Abrir
      //    «el primero de la lista» podía abrir un Guardado viejo de otra vuelta
      //    y entonces el cotejo compara contra un cobro ajeno.
      const coords = await pg.evaluate((m) => {
        const items = [...document.querySelectorAll('app-cobros-list ion-item')]
          .filter(el => el.getBoundingClientRect().width > 0 && /Guardado/i.test(el.textContent));
        if (!items.length) return null;
        const porMarca = items.find(el => (el.textContent || '').includes(m));
        const el = porMarca || items[0];
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2,
                 porMarca: !!porMarca, guardados: items.length };
      }, comentTest);
      if (!coords) {
        v('DM-COB-024', 'Reabrir Guardado → los datos persisten', 'FAIL',
          'se guardó pero NO aparece en la lista de Guardados');
      } else {
        await pg.mouse.click(coords.x, coords.y, { delay: 120 });
        await pg.waitForTimeout(2500);
        // Mismo motivo que arriba: los campos viven en General.
        await clickTab('general').catch(() => {});
        await pg.waitForTimeout(900);

        // 📸 Segunda foto, en el mismo formato que la de antes de guardar
        const despues = await fotoDelCobro();

        const habil = await tabsHabilitadas();
        // Comparar los campos que TENÍAN valor antes: si alguno se vació o cambió,
        // se perdió un dato al guardar.
        const perdidos = [];
        const recortes = [];
        if (antesDeGuardar) {
          for (const [et, val] of Object.entries(antesDeGuardar.campos)) {
            if (!val) continue;
            const ahora = despues.campos[et];
            if (ahora === val) continue;
            // ══════════════════════════════════════════════════════════════════
            // 🔑 UN RECORTE NO ES UNA PÉRDIDA DE DATO.
            //
            //    El 15/09 este caso dio FAIL con C.0888:
            //      "REPUESTOS Y ACCESORIOS RX7, C.A. (C.0888)"
            //        → "REPUESTOS Y ACCESORIOS RX7, C. (C.0888)"
            //    La app guarda el nombre del cliente RECORTADO A 30 CARACTERES
            //    (`collection.na_client` en la nube llega con 30 aunque la columna
            //    admite 80). Nunca se había visto porque los clientes usados
            //    hasta ahora tenían nombres más cortos; salió al ampliar el pool.
            //
            //    Lo que este caso mide es que **no se pierdan datos** al guardar,
            //    y la IDENTIDAD del cliente no se pierde: el código `(C.0888)`
            //    sigue ahí y el valor nuevo es prefijo del viejo. Así que se
            //    cuenta como RECORTE —se anota, se ve en el informe— y no como
            //    dato perdido. Si lo que cambia es el código, eso sí es pérdida.
            // ══════════════════════════════════════════════════════════════════
            const codViejo = (String(val).match(/\(([A-Z]\.\d+)\)/) || [])[1];
            const codNuevo = (String(ahora || '').match(/\(([A-Z]\.\d+)\)/) || [])[1];
            const sinCod = (t) => String(t || '').replace(/\s*\([A-Z]\.\d+\)\s*$/, '').trim();
            const esRecorte = ahora !== undefined && codViejo && codViejo === codNuevo &&
              sinCod(val).startsWith(sinCod(ahora)) && sinCod(ahora).length >= 25;
            if (esRecorte) {
              recortes.push(`${et}: "${val}" → "${ahora}" (recorte a ${sinCod(ahora).length} caracteres, ` +
                `el código ${codViejo} se conserva)`);
            } else {
              perdidos.push(`${et}: "${val}" → "${ahora === undefined ? '(ausente)' : ahora}"`);
            }
          }
          if (antesDeGuardar.total && antesDeGuardar.total !== despues.total) {
            perdidos.push(`Monto total: "${antesDeGuardar.total}" → "${despues.total}"`);
          }
        }

        // 🔴 Un cotejo que no comparó NADA no es un PASS: es un caso sin medir.
        //    Con la foto vacía el resultado era trivialmente cierto y pasaba
        //    por defecto, que es peor que fallar.
        const conValor = antesDeGuardar
          ? Object.values(antesDeGuardar.campos).filter(x => x).length : 0;
        const nCampos = antesDeGuardar ? Object.keys(antesDeGuardar.campos).length : 0;

        reabrioOk = habil >= 3;
        const avisoMarca = coords.porMarca ? ''
          : ` · ⚠ el comentario ${comentTest} no aparecía en la lista (${coords.guardados} ` +
            `Guardado(s)): se abrió el primero, así que el cotejo puede ser contra OTRO cobro`;
        if (conValor === 0) {
          const dg = (antesDeGuardar && antesDeGuardar.diag) || {};
          v('DM-COB-024', 'Reabrir Guardado → los datos persisten', 'BLOCKED',
            `no hay nada que cotejar: la foto previa quedó vacía (${nCampos} campos leídos, ` +
            `0 con valor). El cobro se reabrió (tabs: ${habil}), pero eso NO prueba persistencia · ` +
            `diagnóstico: ${dg.inputsVisibles ?? '?'} input(s) visibles, pestaña "${dg.tabActiva || '?'}"` + avisoMarca +
            `${dg.tabGeneral ? ' · 🔴 ' + dg.tabGeneral : ''}` +
            `${dg.muestra && dg.muestra.length ? ' · rótulos: ' + dg.muestra.join(' | ') : ' · ninguno con rótulo'}`);
        } else {
          reabiertoOk = habil >= 3 && perdidos.length === 0;
          v('DM-COB-024', 'Reabrir Guardado → los datos persisten',
            reabiertoOk ? 'PASS' : 'FAIL',
            (perdidos.length
              ? `🔴 ${perdidos.length} de ${conValor} dato(s) cambiaron al guardar: ${perdidos.join(' · ')}`
              : `tabs accesibles: ${habil} · ${conValor} campo(s) con valor conservados · total: ${despues.total || '—'}`) +
            (recortes.length
              ? ` · ⚠ ${recortes.length} campo(s) RECORTADOS al guardar (la identidad se conserva, ` +
                `así que no cuentan como dato perdido): ${recortes.join(' · ')}`
              : ''));
        }
      }
    }
  } catch (e) {
    v('DM-COB-024', 'Reabrir Guardado → los datos persisten', 'FAIL', e.message);
  }

  // ─── DM-COB-019: ENVIAR el cobro reabierto ───────────────────────────────────
  try {
    if (!guardadoOk) {
      v('DM-COB-019', 'Enviar cobro', 'N/A', 'no hubo cobro guardado');
    } else if (DATA.requiredCollectionAttachments && DATA.mockCamaraFunciona === false) {
      // Regla de QA: adjunto obligatorio sin mock ⇒ se deja GUARDADO y lo envía QA.
      v('DM-COB-019', 'Enviar cobro', 'SKIP',
        'requiredCollectionAttachments=true + mock_camara_funciona=false → queda Guardado, lo envía QA');
    } else if (!reabrioOk) {
      v('DM-COB-019', 'Enviar cobro', 'N/A', 'el cobro guardado no llegó a abrirse');
    } else {
      const clic = await clickGuardarEnviar('imagenEnviar');
      await pg.waitForTimeout(1800);

      // Confirmación «El Cobro será enviado» → ACEPTAR (aquí sí se envía)
      const dialogo = await readAlert();
      if (dialogo && /ser[áa] enviad|desea enviar/i.test(dialogo)) {
        await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {});
        await pg.waitForTimeout(3000);
      }
      const cierre = await readAlert();
      if (cierre) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
      await pg.waitForTimeout(1500);

      // El oráculo es el ESTATUS en la lista, no la alerta.
      const estados = await abrirListaCobros();
      // 🔴 El oráculo NO puede ser solo «ya no hay guardados»: si la lista se
      //    vaciara o no cargara, eso también daría 0 y pasaría. Hace falta ver
      //    el cobro del OTRO lado: al menos un Enviado / Por aprobar.
      // 🔑 EL ORÁCULO ES LA NUBE, NO LA LISTA.
      //    Contar ítems «Enviado» en la UI dio FAIL tres corridas seguidas
      //    (07/09) porque la lista se leía antes de pintar — mientras los cobros
      //    estaban perfectamente en la nube (Test-COB-204126 y Test-COB-786509,
      //    st_collection=3). El comentario de la corrida es único, así que sirve
      //    de huella para encontrar EL cobro de ESTA corrida.
      const nube = await verificarNube(comentTest);

      const porUI = estados.guardados === 0 && estados.enviados > 0;
      // 🔑 Un envío correcto deja UNA fila de cobro. Si deja dos, no es PASS
      //    aunque «haya llegado»: el oráculo del módulo entero queda roto.
      enviadoOk = (nube.ok && !nube.duplicado) || (!DATA.clienteSlug && porUI);

      const detalle =
        `${clic.ok ? 'clic:' + clic.via : 'clic FALLÓ (' + clic.motivo + ')'} · ` +
        `diálogo: "${dialogo || 'ninguno'}"`;
      const enUI = `UI → guardados: ${estados.guardados} · enviados: ${estados.enviados} · ` +
        `total en lista: ${estados.total}`;

      v('DM-COB-019', 'Enviar cobro → llega a la nube (y UNA sola fila)',
        enviadoOk ? 'PASS' : 'FAIL',
        nube.ok
          ? `${detalle} · ☁ ${nube.filas.length} fila(s) con la marca ${comentTest}: ${nube.resumen}` +
            `${nube.aviso}` +
            (porUI ? '' : ` · ⚠ la UI no lo reflejaba (${enUI}) — revisar solo si se repite`)
          : `${detalle} · ✗ ${nube.motivo || `no aparece en la nube ningún cobro con comentario ${comentTest}`} · ${enUI}`);
    }
  } catch (e) {
    v('DM-COB-019', 'Enviar cobro', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEGUNDO COBRO — cierra DESCUENTOS de punta a punta y destraba DM-COB-026
  //
  // Por qué hace falta uno propio:
  //   · aplicar un descuento cambia el total, y el cobro del happy path ya tiene
  //     su pago cuadrado — tocarlo rompería los casos que vienen detrás;
  //   · eliminar un guardado no puede hacerse sobre el cobro que hay que enviar.
  //
  // Los casos 048-052 certifican el TOPE, pero cancelan el modal: ninguno
  // comprueba que el descuento SE APLIQUE. Eso es lo que se cierra aquí, en las
  // tres capas — pantalla, cobro reabierto y nube.
  //
  // ⚠ Se usa el cliente de RELEVO para no competir por los documentos del
  //   principal: cada cobro ENVIADO compromete el suyo y no vuelve a listarse.
  // ═══════════════════════════════════════════════════════════════════════════

  // RELEVO para los cobros que vienen después del happy path.
  //
  // 🔴 Antes era UN cliente fijo (`CANDIDATOS[1]`). Cuando ése se quedaba sin
  //    documentos —cosa que pasa sola, porque cada envío gasta uno— se caían de
  //    golpe DM-COB-026, 053, 054, 055, 057 y 058. Ahora es la LISTA ENTERA, con
  //    el que ya está en uso al final: quien monta el cobro rota hasta encontrar
  //    uno que de verdad liste documentos.
  const RELEVO = [...CANDIDATOS.filter(c => c !== CLI_OK), CLI_OK];
  const CLI_2 = RELEVO[0] || CLI_OK;   // solo para textos informativos
  const DESC_IDS2 = ['DM-COB-053', 'DM-COB-054', 'DM-COB-055'];

  /**
   * Monta un cobro completo y lo deja GUARDADO.
   * @param {{cliente:string, comentario:string, descuento?:string}} o
   *        descuento = nombre del descuento a aplicar (opcional)
   */
  async function montarCobro(o) {
    const r = { ok: false, motivo: '', totalAntes: null, totalDespues: null, guardado: false };
    // 🔑 `o.cliente` admite una LISTA: se rota hasta dar con uno que liste
    //    documentos. Un cliente fijo envejece en cuanto se le gasta la cartera.
    const base = await abrirCobroConDocumento(o.cliente, o.comentario);
    if (!base.ok) { r.motivo = base.motivo; return r; }
    r.cliente = base.cliente;
    r.totalAntes = base.total;

    if (o.descuento) {
      if (!(await abrirDetalleDocumento())) { r.motivo = 'no abrió el detalle del documento'; return r; }
      if (!(await abrirModalDescuentos())) { r.motivo = 'no abrió el modal de descuentos'; return r; }
      if (!(await toggleDescuento(o.descuento))) { r.motivo = `no está «${o.descuento}» en el catálogo`; return r; }
      const al = await readAlert();
      if (al) { await clickAlertBtn(['Aceptar', 'OK']).catch(() => {}); r.motivo = `aviso al marcar: ${al}`; return r; }
      const ac = await aceptarDescuentos();
      if (!ac.ok) { r.motivo = `no se pudo aceptar el descuento: ${ac.motivo || 'el modal no cerró'}`; return r; }
      await cerrarDetalleGuardando();
      await clickTab('pagos');
      await pg.waitForTimeout(1200);
      r.totalDespues = (await leerPagosSticky()).total;
    }

    const pago = await agregarPagoEfectivo();
    if (!pago.ok) { r.motivo = `no se pudo pagar: ${pago.error}`; return r; }

    const clic = await clickGuardarEnviar('imagenGuardar');
    await pg.waitForTimeout(1600);
    const alertMsg = await readAlert();
    r.guardado = !!(alertMsg && /guardad/i.test(alertMsg));
    if (alertMsg) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
    if (!r.guardado) { r.motivo = `no guardó · clic: ${clic.via || clic.motivo} · alert: "${alertMsg || 'ninguno'}"`; return r; }
    r.ok = true;
    return r;
  }

  // ─── DM-COB-053/054/055: descuento aplicado en las TRES capas ────────────────
  const comentDto = `Test-DTO-${String(Date.now()).slice(-6)}`;
  let cobroDto = null;
  try {
    if (!DATA.userCanSelectCollectDiscount || !DATA.retentionDocTypeCR) {
      DESC_IDS2.forEach(id => v(id, id, 'N/A', 'descuento de cobro no aplica en este cliente'));
    } else if (!nombreDtoAplicable) {
      DESC_IDS2.forEach(id => v(id, id, 'BLOCKED',
        'no se identificó un descuento del catálogo que se pueda aplicar bajo el tope'));
    } else {
      // 🔑 Con saldo holgado a propósito. La vuelta 2 cayó aquí con una factura
      //    de 0,50 de saldo: el 10 % (30,05 sobre un monto de 300,50) se CLAMPEA al
      //    saldo y la rebaja fue 0,50 — imposible de cuadrar contra ningún
      //    porcentaje. Un caso de descuento sobre una factura casi saldada no mide
      //    el descuento, mide el clamp.
      const RELEVO_DTO = INV.ok
        ? [...new Set([...INV.clientesConSaldo(20), ...RELEVO])] : RELEVO;
      cobroDto = await montarCobro({ cliente: RELEVO_DTO, comentario: comentDto, descuento: nombreDtoAplicable });

      // ── Capa 1 · la pantalla: el total baja ───────────────────────────────
      if (!cobroDto.ok && cobroDto.totalDespues === null) {
        DESC_IDS2.forEach(id => v(id, id, 'BLOCKED', `no se pudo montar el 2.º cobro: ${cobroDto.motivo}`));
      } else {
        const nAntes = montoANumero(cobroDto.totalAntes);
        const nDesp  = montoANumero(cobroDto.totalDespues);
        const bajo   = (nAntes !== null && nDesp !== null) ? nAntes - nDesp : null;
        // ══════════════════════════════════════════════════════════════════════
        // 🔑 EL PORCENTAJE NO SE APLICA SOBRE EL SALDO: SE APLICA SOBRE EL MONTO
        //    DEL DOCUMENTO.
        //
        //    Medido el 15/09 con C.0242: factura de **857,00** con saldo
        //    **325,00**. Un 10 % bajó el total en **85,70** — que es el 10 % de
        //    857, no de 325 — y la nube lo confirmó (`nu_collect_discount` 10,00 ·
        //    `nu_amount_collect_discount` 85,70). El guion esperaba 32,50 y daba
        //    FAIL: el equivocado era el ORÁCULO, que asumía saldo == monto
        //    porque hasta entonces sólo se habían usado facturas sin abonos.
        //
        //    Así que la base se LEE del equipo (la misma BD que pinta la lista),
        //    no se supone. Y se deja escrito el porcentaje efectivo sobre el
        //    saldo, que es lo que de verdad paga el cliente y lo único que un
        //    humano necesita para juzgar si la regla de negocio es la deseada.
        // ══════════════════════════════════════════════════════════════════════
        const montoDoc = montoDocumentoLocal(cobroDto.cliente, nAntes);
        const base = montoDoc !== null ? montoDoc : nAntes;
        // Y la rebaja se CLAMPEA al saldo: `applyCollectDiscounts({clampToBalance:true})`.
        // Sobre una factura casi saldada, el pct% del MONTO supera el saldo y la app
        // rebaja como mucho el saldo entero. No es un fallo: es el tope. La vuelta 2
        // cayó justo ahí (monto 300,50 · saldo 0,50 · rebaja 0,50) y el FAIL era del
        // oráculo, que exigía 30,05 sobre una factura donde ya no queda tanto.
        const bruto = (base !== null && pctDtoAplicable !== null)
          ? base * (pctDtoAplicable / 100) : null;
        const esperado = (bruto !== null && nAntes !== null) ? Math.min(bruto, nAntes) : bruto;
        const huboClamp = bruto !== null && nAntes !== null && bruto > nAntes + 0.01;
        // Tolerancia de redondeo: 1 unidad de la moneda del cobro.
        const cuadra = (bajo !== null && esperado !== null) && Math.abs(bajo - esperado) <= 1;
        const pctEfectivo = (bajo !== null && nAntes) ? (bajo / nAntes) * 100 : null;
        v('DM-COB-053', `Aplicar ${pctDtoAplicable}% baja el «Monto total a pagar»`,
          cuadra ? 'PASS' : (bajo === null ? 'BLOCKED' : 'FAIL'),
          `antes: ${cobroDto.totalAntes || '—'} · después: ${cobroDto.totalDespues || '—'} · ` +
          `bajó: ${bajo === null ? '—' : bajo.toFixed(2)} · ` +
          `base del ${pctDtoAplicable}%: ${base === null ? '—' : base.toFixed(2)} ` +
          `(${montoDoc !== null ? 'monto del documento, leído del equipo' : 'saldo en pantalla — no se pudo leer el documento'}) · ` +
          `esperado: ${esperado === null ? '—' : esperado.toFixed(2)}` +
          (huboClamp ? ` · ⚠ el ${pctDtoAplicable}% del monto (${bruto.toFixed(2)}) supera el saldo: ` +
                       `la app lo topa al saldo (clampToBalance)` : '') +
          (montoDoc !== null && nAntes !== null && Math.abs(montoDoc - nAntes) > 0.01
            ? ` · ⚠ la factura tiene abonos previos (monto ${montoDoc.toFixed(2)} vs saldo ${nAntes.toFixed(2)}): ` +
              `el ${pctDtoAplicable}% nominal equivale a un ${pctEfectivo === null ? '—' : pctEfectivo.toFixed(1)}% ` +
              `EFECTIVO sobre lo que se está cobrando`
            : '') +
          (cuadra ? '' : ' · 🔴 la rebaja no corresponde al porcentaje sobre ninguna de las dos bases'));

        // ── Capa 2 · el cobro reabierto conserva el descuento ────────────────
        if (!cobroDto.guardado) {
          v('DM-COB-054', 'El descuento persiste al reabrir', 'BLOCKED',
            `el 2.º cobro no llegó a guardarse: ${cobroDto.motivo}`);
        } else {
          const lista = await abrirListaCobros();
          const abierto = lista.lista ? await reabrirGuardado(comentDto) : false;
          if (!abierto) {
            v('DM-COB-054', 'El descuento persiste al reabrir', 'BLOCKED',
              `no se pudo reabrir el cobro guardado (lista: ${lista.lista}, ítems: ${lista.total})`);
          } else {
            await clickTab('pagos');
            await pg.waitForTimeout(1200);
            const totalReabierto = (await leerPagosSticky()).total;
            const nRe = montoANumero(totalReabierto);
            const igual = (nRe !== null && nDesp !== null) && Math.abs(nRe - nDesp) <= 1;
            v('DM-COB-054', 'El descuento persiste al reabrir el Guardado',
              igual ? 'PASS' : (nRe === null ? 'BLOCKED' : 'FAIL'),
              `al guardar: ${cobroDto.totalDespues || '—'} · al reabrir: ${totalReabierto || '—'}` +
              (igual ? '' : ' · 🔴 el monto cambió: el descuento no sobrevivió al guardado'));

            // ── Capa 3 · la nube ──────────────────────────────────────────────
            const clic = await clickGuardarEnviar('imagenEnviar');
            await pg.waitForTimeout(1800);
            const dlg = await readAlert();
            if (dlg && /ser[áa] enviad|desea enviar/i.test(dlg)) {
              await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {});
              await pg.waitForTimeout(3000);
            }
            const cierre = await readAlert();
            if (cierre) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});

            let nube = null;
            if (DATA.clienteSlug) {
              for (let i = 0; i < 5; i++) {
                const f = consultaNube(DATA.clienteSlug,
                  `select c.co_collection, c.nu_amount_total, c.nu_amount_discount_total, ` +
                  `cd.has_discount, cd.nu_collect_discount, cd.nu_amount_collect_discount, ` +
                  `(select count(*) from collection_detail_discounts d ` +
                  ` where d.id_collection_detail = cd.id_collection_detail) as filas ` +
                  `from collection c join collection_detail cd on cd.id_collection = c.id_collection ` +
                  `where c.tx_comment = '${comentDto}' limit 1`);
                if (f && f.length) { nube = f[0]; break; }
                await pg.waitForTimeout(3000);
              }
            }
            const dtoEnNube = nube && Number(nube.nu_amount_discount_total) > 0;
            const conFilas  = nube && Number(nube.filas) > 0;
            v('DM-COB-055', 'El descuento llega a la nube (monto + detalle)',
              (dtoEnNube && conFilas) ? 'PASS' : (nube ? 'FAIL' : 'BLOCKED'),
              nube
                ? `☁ ${nube.co_collection} · total ${nube.nu_amount_total} · ` +
                  `descuento ${nube.nu_amount_discount_total} · has_discount=${nube.has_discount} · ` +
                  `${nube.nu_collect_discount}% = ${nube.nu_amount_collect_discount} · ` +
                  `filas en collection_detail_discounts: ${nube.filas}` +
                  ((dtoEnNube && conFilas) ? '' : ' · 🔴 el cobro llegó pero el descuento NO')
                : `no aparece en la nube ningún cobro con comentario ${comentDto} · ` +
                  `clic: ${clic.ok ? clic.via : clic.motivo} · diálogo: "${dlg || 'ninguno'}"`);
          }
        }
      }
    }
  } catch (e) {
    DESC_IDS2.forEach(id => { if (!verdicts.some(x => x.id === id)) v(id, id, 'FAIL', e.message); });
  }

  // ─── DM-COB-026: TERCER cobro — guardar y eliminar ───────────────────────────
  // 🔴 Necesita el suyo. Si reutilizara el del flujo anterior lo borraría antes
  //    de enviarlo, que es justo lo que pasaba hasta el 07/09.
  try {
    const c3 = await montarCobro({ cliente: RELEVO, comentario: `Test-DEL-${String(Date.now()).slice(-6)}` });
    if (!c3.guardado) {
      v('DM-COB-026', 'Eliminar Guardado', 'BLOCKED', `no se pudo montar el cobro a eliminar: ${c3.motivo}`);
    } else {
      const lista = await abrirListaCobros();
      const before = lista.guardados;
      const trash = await pg.evaluate(() => {
        const btns = [...document.querySelectorAll('app-cobros-list ion-button')]
          .filter(b => b.getBoundingClientRect().width > 0 &&
            (b.querySelector('ion-icon[name="trash"]') || /danger/.test(b.getAttribute('color') || '')));
        if (!btns.length) return null;
        const r = btns[0].getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!trash) {
        v('DM-COB-026', 'Eliminar Guardado', 'BLOCKED', `Guardados: ${before} · sin botón de eliminar en la lista`);
      } else {
        await pg.mouse.click(trash.x, trash.y, { delay: 80 });
        await clickAlertBtn(['Eliminar', 'Aceptar', 'Sí', 'OK']).catch(() => {});
        await pg.waitForTimeout(2000);
        const after = (await abrirListaCobros()).guardados;
        v('DM-COB-026', 'Eliminar Guardado → desaparece de la lista',
          after < before ? 'PASS' : 'FAIL', `Guardados antes: ${before} · después: ${after}`);
      }
    }
  } catch (e) {
    v('DM-COB-026', 'Eliminar Guardado', 'FAIL', e.message);
  }

  // ─── DM-COB-020/021: dirty-guard al salir de cobro nuevo con cambios ──────────
  try {
    await irAHomeCobros();
    await abrirNuevoCobro();
    await seleccionarCliente(DATA.clienteTest);
    await pg.waitForTimeout(1000);
    await clickBack();
    await pg.waitForTimeout(1500);
    const modal = await readAlert();
    const tieneModal = !!(modal && /salir|guardar/i.test(modal)) || await pg.evaluate(() =>
      [...document.querySelectorAll('ion-alert .alert-button')].some(b => /salir sin guardar/i.test(b.textContent)));
    v('DM-COB-020', 'Atrás con cambios → modal Salir/Guardar', tieneModal ? 'PASS' : 'FAIL', `modal: "${modal || (tieneModal ? 'botones detectados' : 'ninguno')}"`);
    // DM-COB-021: elegir "Salir sin guardar" → no queda Guardado
    const salió = await dismissDirtyGuard();
    const enHome = await isHomeCobrosVisible().catch(() => false);
    v('DM-COB-021', 'Salir sin guardar → no persiste', (salió || enHome) ? 'PASS' : 'FAIL', `salió por modal: ${salió} · home: ${enHome}`);
  } catch (e) {
    v('DM-COB-020', 'Atrás con cambios → modal', 'FAIL', e.message);
    v('DM-COB-021', 'Salir sin guardar', 'FAIL', e.message);
    await irAHomeCobros().catch(() => {});
  }

  // ─── Cotejo BD (si se capturó un payload collectionservice) ───────────────────
  try {
    const payloads = await getCapturedPayloads(pg);
    const pCob = payloads.filter(p => /collectionservice\/collection|collectservice\/collect/i.test(String(p.url)));
    if (pCob.length && DATA.clienteSlug) {
      const marca = cotejoPayload(DATA.clienteSlug, pCob[pCob.length - 1]);
      // 🔴 Iba colgado de DM-COB-018 (Guardar) y eso confundía: GUARDAR ES LOCAL,
      //    no hace ningún POST. El único payload que se captura es el del ENVÍO,
      //    así que la marca del cotejo pertenece a DM-COB-019. Leerla junto a
      //    «Guardar» hacía parecer que el guardado había llegado a la nube.
      const d = verdicts.find(x => x.id === 'DM-COB-019') ||
                verdicts.find(x => x.id === 'DM-COB-018');
      if (d) d.nota += ` · cotejo del payload enviado: ${marca}`;
    }
  } catch (_) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 2 — los casos que hasta el 14/09 salían BLOCKED sin llegar a probarse
  //
  // Antes, `blockFase2()` emitía doce BLOCKED con el mismo texto genérico. Un
  // BLOCKED que no dice qué le falta no es información: es ruido que se arrastra
  // corrida tras corrida. Aquí cada caso se ejecuta de verdad, y cuando no se
  // puede, el motivo es concreto y accionable.
  //
  // ORDEN Y COSTE. Cada sub-flujo monta SU PROPIO cobro y lo deja GUARDADO
  // (local, sin POST) salvo los dos de tolerancia, que tienen que llegar a la
  // nube. Así un fallo no contamina al siguiente, y el cobro del happy path
  // —que sí se envió— no se toca.
  //
  //   F2-A  moneda del cobro (033) ......... cobro propio, se descarta
  //   F2-B  documentos + Total + tasa ...... 034 · 014 · 015 · 047 · 038 · 039
  //   F2-C  pago parcial .................. 046
  //   F2-D  retención por documento ....... 041 · 042
  //   F2-E  anticipo manual ............... 028
  //   F2-F  tolerancia y anticipo automático 056 · 057  (IDs nuevos, ver informe)
  //   029 .................................. N/A por VG (cobroRetencion=false)
  // ═══════════════════════════════════════════════════════════════════════════

  /** ¿Está el caso ya resuelto? (para no pisar un veredicto anterior) */
  const yaTiene = (id) => verdicts.some(x => x.id === id);
  const v2 = (id, desc, res, nota) => { if (!yaTiene(id)) v(id, desc, res, nota); };

  /**
   * Clic dentro de un modal midiendo las coordenadas EN EL ÚLTIMO INSTANTE.
   *
   * 🔴 El teclado del equipo desplaza el contenido del modal: el mismo botón
   *    «Guardar» se midió en y≈430 y estaba en y≈709. El clic no falla — cae en
   *    el vacío y no pasa nada, y el error sale tres pasos más adelante.
   *    Por eso: blur, esperar a que asiente, medir, comprobar oclusión con
   *    `elementFromPoint`, y recién entonces clickear.
   */
  async function clickEnModal(rotuloRe, { requerido = true } = {}) {
    await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await pg.waitForTimeout(650);
    const c = await pg.evaluate((a) => {
      const rx = new RegExp(a.s, a.f);
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return { err: 'no hay modal abierto' };
      const btn = [...modal.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0 && !b.hasAttribute('disabled'))
        .find(b => rx.test((b.textContent || '').trim()));
      if (!btn) return { err: 'botón no hallado/deshabilitado',
        botones: [...modal.querySelectorAll('ion-button')]
          .map(b => (b.textContent || '').trim() + (b.hasAttribute('disabled') ? '(dis)' : '')) };
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const en = document.elementFromPoint(x, y);
      const tapado = !(en && (en === btn || btn.contains(en) || en.closest('ion-button') === btn));
      return { x, y, tapado, en: en ? en.tagName : null };
    }, { s: rotuloRe.source, f: rotuloRe.flags });
    if (c.err) {
      if (requerido) throw new Error(`${c.err}${c.botones ? ` · botones: ${c.botones.join(' | ')}` : ''}`);
      return c;
    }
    await pg.mouse.click(c.x, c.y, { delay: 110 });
    await pg.waitForTimeout(1600);
    return c;
  }

  /**
   * Escribe en el ion-input del modal cuyo rótulo case con `re`.
   * Los campos del detalle son «centavos acumulativos»: se teclean DÍGITOS
   * ("100" ⇒ 1,00). Además de teclear hay que fijar `.value` del ion-input y
   * emitir los eventos de Ionic: solo con el teclado, los campos dependientes
   * (IVA/ISLR) no llegan a aparecer.
   */
  async function escribirEnModal(re, digitos) {
    const r = await pg.evaluate((a) => {
      const rx = new RegExp(a.s, a.f);
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return { ok: false, err: 'no hay modal abierto' };
      const rot = (e) => String(e.getAttribute('label') || e.label || '').trim() ||
        ((e.closest('ion-col, ion-row, ion-item') || {}).innerText || '').replace(/\s+/g, ' ').trim();
      const cands = [...modal.querySelectorAll('ion-input')].filter(i => i.getBoundingClientRect().width > 0);
      const el = cands.find(i => rx.test(rot(i)));
      if (!el) return { ok: false, err: 'campo no hallado', rotulos: cands.map(i => rot(i).slice(0, 35)) };
      const n = el.querySelector('input') || (el.shadowRoot && el.shadowRoot.querySelector('input'));
      if (!n) return { ok: false, err: 'sin input nativo' };
      if (n.disabled || n.readOnly) return { ok: false, err: 'el campo está bloqueado (readOnly/disabled)' };
      n.focus();
      window.__qaModalIn = { el, n };
      return { ok: true, antes: n.value };
    }, { s: re.source, f: re.flags });
    if (!r.ok) return r;
    for (let i = 0; i < 20; i++) await pg.keyboard.press('Backspace');
    await pg.keyboard.type(String(digitos), { delay: 50 });
    await pg.evaluate(() => {
      const q = window.__qaModalIn; if (!q) return;
      const { el, n } = q;
      try { el.value = n.value; } catch (_) {}
      ['input', 'keyup', 'change'].forEach(t => n.dispatchEvent(new Event(t, { bubbles: true })));
      el.dispatchEvent(new CustomEvent('ionInput',  { bubbles: true, detail: { value: n.value } }));
      el.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: n.value } }));
      n.dispatchEvent(new Event('blur', { bubbles: true }));
      el.dispatchEvent(new CustomEvent('ionBlur', { bubbles: true }));
    });
    await pg.waitForTimeout(1100);
    const despues = await pg.evaluate(() => {
      const q = window.__qaModalIn; return q && q.n ? q.n.value : null;
    });
    return { ok: true, antes: r.antes, despues };
  }

  /** Foto de los campos del detalle del documento (rótulo → valor/estado). */
  async function fotoDetalle() {
    return pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return { err: 'el detalle no está abierto', campos: {} };
      const rot = (e) => String(e.getAttribute('label') || e.label || '').trim() ||
        ((e.closest('ion-col, ion-row, ion-item') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50);
      const campos = {};
      for (const i of [...modal.querySelectorAll('ion-input')].filter(x => x.getBoundingClientRect().width > 0)) {
        const n = i.querySelector('input') || (i.shadowRoot && i.shadowRoot.querySelector('input'));
        campos[rot(i)] = { val: n ? n.value : null, ro: !!(n && n.readOnly), dis: !!(n && n.disabled) };
      }
      const lab = [...modal.querySelectorAll('ion-label')].find(l => /pago\s*parcial/i.test(l.textContent || ''));
      const fila = lab && lab.closest('ion-row');
      const tog = (fila && fila.querySelector('ion-toggle')) || modal.querySelector('ion-toggle');
      return {
        campos,
        toggleParcial: tog
          ? { existe: true, encendido: tog.checked === true, deshabilitado: tog.disabled === true }
          : { existe: false },
        botones: [...modal.querySelectorAll('ion-button')]
          .filter(b => b.getBoundingClientRect().width > 0)
          .map(b => ({ t: (b.textContent || '').trim(), dis: b.hasAttribute('disabled') })),
      };
    });
  }

  /**
   * Enciende/apaga el toggle «Pago parcial».
   *
   * ⚠ Dos precisiones que costaron una vuelta:
   *   · el toggle mide 36×14 px y su mitad izquierda es zona de label ⇒ se pega
   *     en el EXTREMO DERECHO;
   *   · el rect se mide JUSTO antes del clic. Un `scrollIntoView` previo sobre
   *     otro campo ya había movido el toggle de y≈594 a y≈322, y el clic caía
   *     en el vacío sin dar error.
   */
  async function togglePagoParcial() {
    await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await pg.waitForTimeout(500);
    const c = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return { err: 'el detalle no está abierto' };
      const lab = [...modal.querySelectorAll('ion-label')].find(l => /pago\s*parcial/i.test(l.textContent || ''));
      const fila = lab && lab.closest('ion-row');
      const tog = (fila && fila.querySelector('ion-toggle')) || modal.querySelector('ion-toggle');
      if (!tog) return { err: 'no existe el toggle «Pago parcial» en el detalle' };
      if (tog.disabled) return { err: 'el toggle «Pago parcial» está deshabilitado' };
      const r = tog.getBoundingClientRect();
      const x = r.left + r.width - 8, y = r.top + r.height / 2;
      const en = document.elementFromPoint(x, y);
      return { x, y, antes: tog.checked === true, en: en ? en.tagName : null };
    });
    if (c.err) return c;
    await pg.mouse.click(c.x, c.y, { delay: 100 });
    await pg.waitForTimeout(1500);
    const despues = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return null;
      const lab = [...modal.querySelectorAll('ion-label')].find(l => /pago\s*parcial/i.test(l.textContent || ''));
      const fila = lab && lab.closest('ion-row');
      const tog = (fila && fila.querySelector('ion-toggle')) || modal.querySelector('ion-toggle');
      return tog ? tog.checked === true : null;
    });
    return { ok: despues !== c.antes, antes: c.antes, despues };
  }

  /** Lee el Tab Total completo. En este build es un GRID, no una <table>. */
  async function leerTabTotal() {
    const r = await clickTab('total');
    await pg.waitForTimeout(1800);
    const dato = await pg.evaluate(() => {
      const t = document.querySelector('app-cobro-total');
      if (!t || t.offsetParent === null) return { err: 'el Tab Total no se hizo visible' };
      const txt = (t.innerText || '').replace(/\s+/g, ' ');
      const num = (re) => { const m = txt.match(re); return m ? m[1] : null; };
      const COLS = ['Tipo', 'Nro. Doc', 'Monto Doc', 'Monto Pago'];
      return {
        txt: txt.slice(0, 600),
        // ⚠ «Pago USD 0,00» y «Monto total a Pagar USD 3,00» empiezan igual:
        //   el \s tras «Pago» es lo que impide que «Pagar» se cuele.
        montoTotal:   num(/Monto total a Pagar\s+\S+\s*:?\s*(-?[\d.,]+)/i),
        pago:         num(/(?:^|\s)Pago\s+\S+\s*:?\s*(-?[\d.,]+)/i),
        diferencia:   num(/Diferencia\s+\S+\s*:?\s*(-?[\d.,]+)/i),
        totalGeneral: num(/Total General\s*\S*\s*:?\s*(-?[\d.,]+)/i),
        acordeones: [...t.querySelectorAll('ion-accordion')]
          .filter(a => a.getBoundingClientRect().width > 0)
          .map(a => (a.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
        columnas: COLS.filter(c => txt.includes(c)),
      };
    });
    if (dato.err && r && !r.ok) dato.err += ` · ${r.motivo}`;
    return dato;
  }

  /** «Atrás» con cambios y salir GUARDANDO (DM-COB-038, no DM-COB-021). */
  async function salirGuardando() {
    await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await pg.waitForTimeout(500);
    await clickBack();
    await pg.waitForTimeout(1800);
    const texto = await readAlert();
    const c = await pg.evaluate(() => {
      const al = [...document.querySelectorAll('ion-alert')].filter(a =>
        [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0)).pop();
      if (!al) return { err: 'no salió el modal de salida' };
      const btns = [...al.querySelectorAll('.alert-button')].filter(b => b.getBoundingClientRect().width > 0);
      // El de GUARDAR, jamás el de «Salir sin guardar».
      const btn = btns.find(b => /guardar/i.test(b.textContent) && !/sin\s+guardar/i.test(b.textContent));
      if (!btn) return { err: 'el modal no ofrece «Guardar y salir»', botones: btns.map(b => b.textContent.trim()) };
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      // 🔴 El primer clic sobre el botón de una ion-alert puede caer en el ION-BACKDROP.
      const en = document.elementFromPoint(x, y);
      return { x, y, label: btn.textContent.trim(),
               backdrop: !!(en && /ION-BACKDROP/i.test(en.tagName)) };
    });
    if (c.err) return { ok: false, motivo: c.err + (c.botones ? ` · ofrece: ${c.botones.join(' | ')}` : ''), texto };
    await pg.mouse.click(c.x, c.y, { delay: 110 });
    await pg.waitForTimeout(2000);
    // Si el primero se lo comió el backdrop, la alerta sigue ahí: se reintenta.
    const sigue = await pg.evaluate(() =>
      [...document.querySelectorAll('ion-alert')].some(a =>
        [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0)));
    if (sigue) { await clickAlertBtn([c.label]).catch(() => {}); await pg.waitForTimeout(1500); }
    const cierre = await readAlert();
    if (cierre) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
    await pg.waitForTimeout(1200);
    const enHome = await isHomeCobrosVisible().catch(() => false);
    return { ok: true, label: c.label, backdrop: c.backdrop, texto, cierre, enHome };
  }

  /** Elimina el primer Guardado de la lista. Devuelve {ok, antes, despues}. */
  async function eliminarPrimerGuardado() {
    const lista = await abrirListaCobros();
    const antes = lista.guardados;
    if (!antes) return { ok: false, motivo: 'no hay ningún cobro Guardado en la lista', antes };
    const trash = await pg.evaluate(() => {
      const btns = [...document.querySelectorAll('app-cobros-list ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0 &&
          (b.querySelector('ion-icon[name="trash"]') || /danger/.test(b.getAttribute('color') || '')));
      if (!btns.length) return null;
      const r = btns[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!trash) return { ok: false, motivo: 'sin botón de eliminar en la lista', antes };
    await pg.mouse.click(trash.x, trash.y, { delay: 80 });
    await clickAlertBtn(['Eliminar', 'Aceptar', 'Sí', 'OK']).catch(() => {});
    await pg.waitForTimeout(2200);
    const despues = (await abrirListaCobros()).guardados;
    return { ok: despues < antes, antes, despues };
  }

  /** Deja el formulario abandonado y vuelve al home del módulo, pase lo que pase. */
  async function abandonarCobro() {
    for (let i = 0; i < 6; i++) {
      if (await isHomeCobrosVisible().catch(() => false)) return true;
      // Un modal abierto bloquea todos los clics: se sale por CANCELAR, nunca
      // con «atrás» (eso lo deja huérfano y tumba la pantalla entera).
      const cerrado = await pg.evaluate(() => {
        const m = [...document.querySelectorAll('ion-modal')].filter(x => x.getBoundingClientRect().width > 0).pop();
        if (!m) return false;
        const b = [...m.querySelectorAll('ion-button')].filter(x => x.getBoundingClientRect().width > 0)
          .find(x => /cancelar|cerrar/i.test((x.textContent || '').trim()));
        if (b) { b.click(); return true; }
        if (m.dismiss) { m.dismiss(); return true; }
        return false;
      });
      if (cerrado) { await pg.waitForTimeout(1300); continue; }
      try { await clickBack(); } catch (_) {}
      await pg.waitForTimeout(1200);
      await dismissDirtyGuard();
      await pg.waitForTimeout(800);
    }
    return isHomeCobrosVisible().catch(() => false);
  }

  /**
   * Arranca un cobro NUEVO, lo deja con el primer documento marcado y devuelve
   * el total a pagar leído del sticky de Pagos.
   *
   * @param {string|string[]} quien  un código, o una LISTA por la que rotar
   *        hasta dar con uno que liste documentos de verdad.
   */
  async function abrirCobroConDocumento(quien, comentario, maxPruebas = 10) {
    const lista = (Array.isArray(quien) ? quien : [quien]).filter(Boolean);
    const intentados = [];
    // ⚠ Tope de intentos REALES (los que tocan la UI). Sin él, una lista larga
    //   con la cartera agotada puede irse a ~15 s × 24 clientes por sub-flujo y
    //   convertir la corrida de cobros en media hora. Los ya conocidos como
    //   vacíos se saltan sin tocar la pantalla, así que no cuentan.
    let pruebas = 0;
    for (const cliente of lista) {
      if (clientesSinDocs.has(cliente)) { intentados.push(`${cliente}→(agotado antes)`); continue; }
      if (pruebas >= maxPruebas) { intentados.push(`…(corte tras ${maxPruebas} intentos reales)`); break; }
      pruebas++;
      await abandonarCobro();
      // 🔴 Un intento no basta. El 14/09, DM-COB-026 murió con «no abrió el
      //    formulario de cobro»: el tile respondió pero las 5 pestañas no
      //    llegaron en 8 s porque la pantalla anterior aún estaba replegándose.
      //    No es que la app no abra: es que se le pidió demasiado pronto.
      let abrio = await abrirNuevoCobro();
      if (!abrio) {
        await irAHomeCobros().catch(() => {});
        await pg.waitForTimeout(1500);
        abrio = await abrirNuevoCobro();
      }
      if (!abrio) { intentados.push(`${cliente}→el formulario no abrió (2 intentos)`); continue; }
      try {
        await seleccionarCliente(cliente);
      } catch (e) {
        intentados.push(`${cliente}→${e.message.slice(0, 60)}`);
        continue;
      }
      if (DATA.requiredComment) await fillComentario(comentario);
      let h = 0;
      for (let i = 0; i < 8; i++) { h = await tabsHabilitadas(); if (h >= 4) break; await pg.waitForTimeout(700); }
      if (h < 4) { intentados.push(`${cliente}→pestañas ${h}/5`); continue; }
      await clickTab('documentos');
      const carga = await cargarDocumentos();
      if (!carga.cbs) { clientesSinDocs.add(cliente); intentados.push(`${cliente}→0 docs`); continue; }
      if (!(await marcarPrimerDocumento()).ok) { intentados.push(`${cliente}→no se marcó`); continue; }
      await clickTab('pagos');
      await pg.waitForTimeout(1200);
      const sticky = await leerPagosSticky();
      return { ok: true, cliente, docs: carga.cbs, total: sticky.total,
               saldo: montoANumero(sticky.total), intentados };
    }
    return { ok: false,
      motivo: `ningún cliente del relevo lista documentos · recorrido: ${intentados.join(' | ') || '(lista vacía)'} · ` +
              `🔑 cada cobro ENVIADO deja su factura «Por aprobar» y la saca del Tab Documentos: ` +
              `rechazar cobros pendientes en la web devuelve documentos al pool` };
  }

  const marcaF2 = (suf) => `Test-${suf}-${String(Date.now()).slice(-6)}`;

  // ───────────────────────────────────────────────────────────────────────────
  // F2-A · DM-COB-033 — selector de moneda del COBRO (Tab General)
  //
  // Cambiar la moneda REINICIA el cobro (la app avisa). Por eso se hace sobre un
  // cobro recién abierto, antes de tocar documentos, y se descarta después: si
  // se hiciera sobre el cobro del happy path lo vaciaría.
  // ───────────────────────────────────────────────────────────────────────────
  const leerMonedaCobro = () => pg.evaluate(() => {
    const gen = document.querySelector('app-cobro-general') || document.querySelector('app-cobro');
    if (!gen) return { err: 'no se ve el Tab General' };
    const esMoneda = (o) => /^(bs|usd|us\$|d[óo]lar|bol[íi]var)/i.test(o);
    const sels = [...gen.querySelectorAll('ion-select')].filter(s => s.getBoundingClientRect().width > 0);
    // Se identifica por sus OPCIONES, no por el orden: el 1.º es Empresa y el
    // 3.º la Tasa, y los dos se mueven según la configuración del cliente.
    const sel = sels.find(s => {
      const op = [...s.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim());
      return op.length >= 2 && op.filter(esMoneda).length >= 2;
    });
    if (!sel) return { err: 'no hay ningún ion-select con dos monedas',
      vistos: sels.map(s => [...s.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim())) };
    return {
      opciones: [...sel.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim()),
      deshabilitado: sel.disabled === true || sel.hasAttribute('disabled') ||
                     String(sel.className || '').includes('select-disabled'),
      elegida: ((sel.shadowRoot && sel.shadowRoot.querySelector('.select-text')) || {}).textContent || null,
    };
  });

  try {
    if (!DATA.multiCurrency || !DATA.multiCurrencyCollection) {
      v2('DM-COB-033', 'Selector de moneda del cobro', 'N/A',
        `multiCurrency=${DATA.multiCurrency} · multiCurrencyCollection=${DATA.multiCurrencyCollection}`);
    } else {
      await abandonarCobro();
      if (!(await abrirNuevoCobro())) throw new Error('no abrió el formulario de cobro');
      await seleccionarCliente(CLI_OK);
      if (DATA.requiredComment) await fillComentario(marcaF2('COB-033'));
      await clickTab('general');
      await pg.waitForTimeout(1000);

      const antes = await leerMonedaCobro();
      if (antes.err) {
        v2('DM-COB-033', 'Selector de moneda del cobro (Tab General)', 'FAIL',
          `${antes.err}${antes.vistos ? ` · selects vistos: ${JSON.stringify(antes.vistos)}` : ''}`);
      } else {
        const otra = antes.opciones.find(o => o.trim() !== String(antes.elegida || '').trim()) || antes.opciones[0];
        await pg.evaluate((destino) => {
          const gen = document.querySelector('app-cobro-general') || document.querySelector('app-cobro');
          const esMoneda = (o) => /^(bs|usd|us\$|d[óo]lar|bol[íi]var)/i.test(o);
          const sel = [...gen.querySelectorAll('ion-select')].filter(s => s.getBoundingClientRect().width > 0)
            .find(s => { const op = [...s.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim());
                         return op.length >= 2 && op.filter(esMoneda).length >= 2; });
          if (!sel) return;
          const opt = [...sel.querySelectorAll('ion-select-option')]
            .find(o => (o.textContent || '').trim() === destino);
          if (!opt) return;
          sel.value = opt.value;
          sel.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: opt.value } }));
        }, otra);
        await pg.waitForTimeout(1800);
        const aviso = await readAlert();
        if (aviso) { await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); await pg.waitForTimeout(1800); }
        const despues = await leerMonedaCobro();
        const cambio = !despues.err && String(despues.elegida || '').trim() !== String(antes.elegida || '').trim();
        v2('DM-COB-033', 'Selector de moneda del cobro: habilitado, 2 monedas y el cambio toma efecto',
          (!antes.deshabilitado && antes.opciones.length >= 2 && cambio) ? 'PASS' : 'FAIL',
          `opciones: ${antes.opciones.join('/')} · habilitado: ${!antes.deshabilitado} · ` +
          `${antes.elegida} → ${despues.elegida} (pedida: ${otra}) · ` +
          `aviso de reinicio: "${aviso || 'ninguno'}"` +
          (cambio ? '' : ' · 🔴 el selector acepta el cambio pero la moneda no cambia'));
      }
      await abandonarCobro();
    }
  } catch (e) {
    v2('DM-COB-033', 'Selector de moneda del cobro', 'FAIL', e.message);
    await abandonarCobro().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // F2-B · DM-COB-034 (moneda documento) · 014/015 (Tab Total) · 047 (tasa) ·
  //        038 (guardar y salir) · 039 (tasa sobre el Guardado)
  // Todo sobre UN cobro que se deja Guardado y al final se elimina.
  // ───────────────────────────────────────────────────────────────────────────
  const IDS_B = ['DM-COB-034', 'DM-COB-014', 'DM-COB-015', 'DM-COB-047', 'DM-COB-038', 'DM-COB-039'];

  /** Lee el selector de TASA del Tab General y cuántos valores distintos ofrece. */
  const leerSelectorTasa = () => pg.evaluate(() => {
    const gen = document.querySelector('app-cobro-general') || document.querySelector('app-cobro');
    if (!gen) return { err: 'no se ve el Tab General' };
    const sel = [...gen.querySelectorAll('ion-select')].filter(s => s.getBoundingClientRect().width > 0)
      .find(s => /tasa/i.test(String(s.getAttribute('label') || s.label || '') +
                  ((s.closest('ion-col, ion-row, ion-item') || {}).innerText || '')));
    if (!sel) return { err: 'no hay selector de tasa en el Tab General' };
    const ops = [...sel.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim());
    return { opciones: ops, distintas: new Set(ops).size,
      elegida: ((sel.shadowRoot && sel.shadowRoot.querySelector('.select-text')) || {}).textContent || null };
  });

  /** Cambia la tasa a la primera opción DISTINTA de la actual. */
  const cambiarTasa = () => pg.evaluate(() => {
    const gen = document.querySelector('app-cobro-general') || document.querySelector('app-cobro');
    const sel = [...gen.querySelectorAll('ion-select')].filter(s => s.getBoundingClientRect().width > 0)
      .find(s => /tasa/i.test(String(s.getAttribute('label') || s.label || '') +
                  ((s.closest('ion-col, ion-row, ion-item') || {}).innerText || '')));
    if (!sel) return { err: 'no hay selector de tasa' };
    const ops = [...sel.querySelectorAll('ion-select-option')];
    const actual = ((sel.shadowRoot && sel.shadowRoot.querySelector('.select-text')) || {}).textContent || '';
    const otra = ops.find(o => (o.textContent || '').trim() !== String(actual).trim());
    if (!otra) return { err: `el histórico ofrece una sola tasa distinta (${ops.map(o => (o.textContent || '').trim()).join('/')})` };
    sel.value = otra.value;
    sel.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: otra.value } }));
    return { de: String(actual).trim(), a: (otra.textContent || '').trim() };
  });

  const totalEnPagos = async () => {
    await clickTab('pagos');
    await pg.waitForTimeout(1400);
    return (await leerPagosSticky()).total;
  };

  try {
    const comentB = marcaF2('COB-B');
    await abandonarCobro();
    if (!(await abrirNuevoCobro())) throw new Error('no abrió el formulario de cobro');
    await seleccionarCliente(CLI_OK);
    if (DATA.requiredComment) await fillComentario(comentB);
    let hB = 0;
    for (let i = 0; i < 8; i++) { hB = await tabsHabilitadas(); if (hB >= 4) break; await pg.waitForTimeout(700); }
    if (hB < 4) throw new Error(`las pestañas no se habilitaron (${hB}/5) con ${CLI_OK}`);

    // ── DM-COB-034 · selector de Moneda documento ────────────────────────────
    await clickTab('documentos');
    await pg.waitForTimeout(1200);
    const selDoc = await pg.evaluate(() => {
      const s = document.querySelector('app-cobro-documents ion-select');
      if (!s) return { err: 'no existe el selector «Moneda Documento»' };
      return {
        opciones: [...s.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim()),
        deshabilitado: s.disabled === true || s.hasAttribute('disabled'),
      };
    });
    if (selDoc.err) {
      v2('DM-COB-034', 'Selector de moneda de documentos', 'FAIL', selDoc.err);
      v2('DM-COB-034-BS', 'Filtrado de documentos por Bs', 'BLOCKED',
        'no se pudo leer el selector de moneda de documentos');
    } else {
      await seleccionarMonedaDocumento('USD'); await pg.waitForTimeout(1600);
      const cUSD = await contarDocumentos();
      await seleccionarMonedaDocumento('BS');  await pg.waitForTimeout(1600);
      const cBS  = await contarDocumentos();
      await seleccionarMonedaDocumento('USD'); await pg.waitForTimeout(1800);
      const monedas = selDoc.opciones.filter(o => /^(bs|usd|us\$)/i.test(o));
      const estructuraOk = monedas.length >= 2 && !selDoc.deshabilitado;

      // ══════════════════════════════════════════════════════════════════════
      // 🔴 PRECONDICIÓN: sin documentos NO SE MIDE. El 14/09 este caso salió
      //    FAIL con «la lista no cambia al cambiar de moneda» teniendo
      //    **0 documentos en USD y 0 en Bs**. Con las dos listas vacías, «no
      //    cambia» es una perogrullada: 0 = 0. Eso no es un hallazgo, es medir
      //    la nada — y un FAIL así ensucia el informe y tapa los de verdad.
      //    Si no hay materia prima que filtrar, el veredicto honesto es BLOCKED
      //    diciendo POR QUÉ, no un FAIL contra la app.
      // ══════════════════════════════════════════════════════════════════════
      if (cUSD === 0 && cBS === 0) {
        v2('DM-COB-034', 'Selector de moneda de documentos filtra la lista', 'BLOCKED',
          `sin documentos libres que filtrar (USD: 0 · Bs: 0) con ${CLI_OK} ⇒ el caso mediría la nada: ` +
          `con las dos listas vacías «la lista no cambia» es 0 = 0, no un defecto · ` +
          `estructura del selector SÍ verificada: opciones ${selDoc.opciones.join('/')} · ` +
          `habilitado: ${!selDoc.deshabilitado} · ` +
          `📋 documentos libres AHORA en el equipo: ${(() => { const a = inventarioDocumentosLibres(); return a.ok ? a.resumen : 'no se pudo leer'; })()} ` +
          `(al arrancar la vuelta: ${INV.ok ? INV.total : '?'}) · ` +
          `🔑 se liberan documentos rechazando/aprobando en la web los cobros «Por aprobar»`);
      } else {
        // Con materia prima, el oráculo es que la lista REACCIONE al cambio.
        const reacciona = cUSD !== cBS;
        v2('DM-COB-034', 'Selector de moneda de documentos filtra la lista',
          (estructuraOk && reacciona) ? 'PASS' : 'FAIL',
          `opciones: ${selDoc.opciones.join('/')} · habilitado: ${!selDoc.deshabilitado} · ` +
          `documentos con USD: ${cUSD} · con Bs: ${cBS}` +
          (estructuraOk ? '' : ' · 🔴 el selector no ofrece las dos monedas o está deshabilitado') +
          (reacciona ? '' : ' · 🔴 la lista no cambia al cambiar de moneda pese a haber documentos'));
      }

      // ══════════════════════════════════════════════════════════════════════
      // DM-COB-034-BS · la mitad «Bs» del caso, declarada aparte
      //
      // 🔑 Se separa porque ANTES se colaba dentro del PASS del 034: el caso
      //    daba PASS con «con Bs: 0» en las cuatro corridas del día, y eso deja
      //    escrito que el filtro Bs pasó cuando nunca llegó a ejercitarse.
      //    Un caso que no puede fallar NO es un PASS. En 4K los 1.960 documentos
      //    del tenant son USD: el filtro Bs no tiene con qué probarse aquí.
      // ══════════════════════════════════════════════════════════════════════
      const bsEnEquipo = INV.ok ? INV.bs : null;
      if (cBS > 0) {
        v2('DM-COB-034-BS', 'Filtrado de documentos por Bs: la lista trae los documentos en Bs',
          'PASS', `documentos listados con Moneda=Bs: ${cBS} · el filtro Bs SÍ se ejercitó`);
      } else {
        v2('DM-COB-034-BS', 'Filtrado de documentos por Bs', 'N/A',
          `NO EJERCITABLE EN 4K: el selector ofrece Bs pero no hay ningún documento en Bs que filtrar · ` +
          `en pantalla con Moneda=Bs: 0 documentos · ` +
          `en el equipo: ${bsEnEquipo === null ? 'no se pudo leer' : `${bsEnEquipo} documentos libres en Bs de ${INV.total}`} · ` +
          `🔑 aunque hubiera documentos USD (los hay), la mitad Bs del caso nunca se ejercita ⇒ ` +
          `se declara aparte para que no se cuele dentro de un PASS. ` +
          `Cubrirlo exige un tenant con cartera en Bs`);
      }
    }

    if (!(await marcarPrimerDocumento()).ok) throw new Error('no se pudo marcar el documento');
    // 🔴 El botón «Agregar método de pago» (#eventSelect) vive en el Tab PAGOS.
    //    Llamar a agregarPagoEfectivo() estando en Documentos devuelve «botón
    //    disabled/ausente» y tumbaba los 5 casos de este bloque de una vez.
    await clickTab('pagos');
    await pg.waitForTimeout(1200);
    const pagoB = await agregarPagoEfectivo();
    if (!pagoB.ok) throw new Error(`no se pudo pagar: ${pagoB.error}`);

    // ── DM-COB-014 / 015 · Tab Total ─────────────────────────────────────────
    const tot = await leerTabTotal();
    if (tot.err) {
      v2('DM-COB-014', 'Tab Total → tabla + acordeones', 'FAIL', tot.err);
      v2('DM-COB-015', 'Tab Total → Total General', 'FAIL', tot.err);
    } else {
      const ok14 = !!tot.montoTotal && !!tot.diferencia &&
                   tot.acordeones.length > 0 && tot.columnas.length >= 3;
      v2('DM-COB-014', 'Tab Total → tabla resumen + acordeones por método',
        ok14 ? 'PASS' : 'FAIL',
        `Monto total a Pagar: ${tot.montoTotal || '—'} · Pago: ${tot.pago || '—'} · ` +
        `Diferencia: ${tot.diferencia || '—'} · columnas: ${tot.columnas.join('/') || 'ninguna'} · ` +
        `acordeones: ${tot.acordeones.join(' | ') || 'ninguno'}`);
      v2('DM-COB-015', 'Tab Total → «Total General» al final',
        tot.totalGeneral !== null ? 'PASS' : 'FAIL',
        tot.totalGeneral !== null
          ? `Total General: ${tot.totalGeneral} · Pago: ${tot.pago || '—'}`
          : `no aparece «Total General» · texto leído: ${tot.txt.slice(-160)}`);
    }

    // ── DM-COB-047 · cambiar la tasa recalcula el «Monto total a pagar» ──────
    //    Rama (B): enabledManualRate=false + historicoTasa + canChangeRate.
    await clickTab('general');
    await pg.waitForTimeout(1000);
    const infoTasa = await leerSelectorTasa();
    if (!DATA.historicoTasa || !DATA.canChangeRate) {
      const motivo = `historicoTasa=${DATA.historicoTasa} · canChangeRate=${DATA.canChangeRate} · ` +
        `enabledManualRate=${DATA.enabledManualRate} ⇒ la tasa no es editable en este cliente`;
      v2('DM-COB-047', 'Persistencia de la tasa por fecha', 'N/A', motivo);
      v2('DM-COB-039', 'Cambiar la tasa de un Guardado', 'N/A', motivo);
    } else if (infoTasa.err || infoTasa.distintas <= 1) {
      // 🔑 Un caso que NO PUEDE fallar no es un PASS.
      const motivo = infoTasa.err ||
        `el histórico solo ofrece UNA tasa distinta (${JSON.stringify(infoTasa.opciones)}): ` +
        `cambiarla no puede cambiar el monto, así que el caso NO ES EJERCITABLE hoy. ` +
        `Para cubrirlo hace falta un tenant con dos tasas dentro de mesesTasa`;
      v2('DM-COB-047', 'Persistencia de la tasa por fecha', 'N/A', motivo);
      v2('DM-COB-039', 'Cambiar la tasa de un Guardado', 'N/A', motivo);
    } else {
      const antesTasa = await totalEnPagos();
      await clickTab('general');
      await pg.waitForTimeout(900);
      const cambio = await cambiarTasa();
      await pg.waitForTimeout(2000);
      const avisoTasa = await readAlert();
      if (avisoTasa) { await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); await pg.waitForTimeout(1500); }
      const despuesTasa = await totalEnPagos();
      v2('DM-COB-047', 'Cambiar la tasa recalcula el «Monto total a pagar»',
        cambio.err ? 'N/A' : (antesTasa !== despuesTasa ? 'PASS' : 'FAIL'),
        cambio.err ? `${cambio.err} ⇒ no ejercitable`
          : `tasa ${cambio.de} → ${cambio.a} · total ${antesTasa} → ${despuesTasa} · ` +
            `aviso: "${avisoTasa || 'ninguno'}"` +
            (antesTasa !== despuesTasa ? '' : ' · 🔴 la tasa cambió y el monto no'));
    }

    // ── DM-COB-038 · «Guardar y salir» desde el modal de salida ──────────────
    const sal = await salirGuardando();
    if (!sal.ok) {
      v2('DM-COB-038', '«Guardar y salir» deja el cobro Guardado', 'FAIL', sal.motivo);
    } else {
      const lista = await abrirListaCobros();
      v2('DM-COB-038', '«Guardar y salir» deja el cobro Guardado en la lista',
        lista.guardados > 0 ? 'PASS' : 'FAIL',
        `botón pulsado: "${sal.label}" · aviso de salida: "${sal.texto || '—'}" · ` +
        `Guardados en la lista: ${lista.guardados} (total ${lista.total})` +
        (sal.backdrop ? ' · ⚠ el punto del botón devolvía ION-BACKDROP: se reintentó' : ''));
    }

    // ── DM-COB-039 · cambiar la tasa de un cobro GUARDADO ────────────────────
    if (!yaTiene('DM-COB-039')) {
      if (!(await reabrirGuardado(comentB))) {
        v2('DM-COB-039', 'Cambiar la tasa de un Guardado', 'BLOCKED',
          'no se pudo reabrir el cobro Guardado');
      } else {
        const antes39 = await totalEnPagos();
        await clickTab('general');
        await pg.waitForTimeout(1000);
        const c39 = await cambiarTasa();
        await pg.waitForTimeout(2000);
        const av39 = await readAlert();
        if (av39) await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {});
        const despues39 = await totalEnPagos();
        v2('DM-COB-039', 'Abrir un Guardado y cambiar la tasa → recalcula',
          c39.err ? 'N/A' : (antes39 !== despues39 ? 'PASS' : 'FAIL'),
          c39.err ? `${c39.err} ⇒ el caso no es ejercitable en este tenant`
            : `tasa ${c39.de} → ${c39.a} · total ${antes39} → ${despues39}` +
              (antes39 !== despues39 ? '' : ' · 🔴 la tasa cambió y el monto no'));
        await abandonarCobro();
      }
    }

    // Limpieza: el cobro de este bloque no tiene que sobrevivir a la corrida.
    await eliminarPrimerGuardado().catch(() => {});
  } catch (e) {
    chequearCdp(e);
    // 🔑 «no se pudo marcar el documento» a secas no informa de nada: fue el
    //    motivo de los cinco BLOCKED del 14/09 y nadie podía saber, leyéndolo,
    //    si era la app o la cartera vacía. Ahora el BLOCKED lleva el inventario
    //    del momento, que es lo que decide entre las dos cosas.
    const motivo = cdpCaido
      ? 'NO SE MIDIÓ: la conexión CDP se cayó durante la vuelta — hay que reponer el puente y repetir'
      : faltaMateria(`F2-B no pudo montarse: ${e.message}`);
    IDS_B.forEach(id => v2(id, id, 'BLOCKED', motivo));
    await abandonarCobro().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // F2-C · DM-COB-046 — PAGO PARCIAL
  //
  // 🔑 El pago parcial NO está en el listado de documentos: es un `ion-toggle`
  //    «Pago parcial:» DENTRO del detalle (lupa → #eventModal). Apagado, «Monto
  //    a pagar» es readOnly con el saldo completo; encendido pasa a editable y
  //    se RESETEA a 0,00.
  // ───────────────────────────────────────────────────────────────────────────
  try {
    if (!DATA.enablePartialPayment) {
      v2('DM-COB-046', 'Persistencia del pago parcial', 'N/A', 'enablePartialPayment=false');
    } else {
      const comentC = marcaF2('COB-046');
      const base = await abrirCobroConDocumento(RELEVO, comentC);
      if (!base.ok) throw new Error(base.motivo);

      if (!(await abrirDetalleDocumento())) {
        throw new Error('no abrió el detalle del documento (la lupa sigue deshabilitada pese al documento tildado)');
      }

      const antes = await fotoDetalle();
      const rotMonto = Object.keys(antes.campos || {}).find(k => /monto a pagar/i.test(k));
      const montoApagado = rotMonto ? antes.campos[rotMonto] : null;

      const tg = await togglePagoParcial();
      if (tg.err) throw new Error(tg.err);
      const trasToggle = await fotoDetalle();
      const montoEncendido = rotMonto ? trasToggle.campos[rotMonto] : null;

      // El contrato del caso: apagado ⇒ readOnly con el saldo · encendido ⇒
      // editable y reseteado a 0,00.
      const contratoOk = !!montoApagado && !!montoEncendido &&
        montoApagado.ro === true && montoEncendido.ro === false &&
        /^0([.,]0+)?$/.test(String(montoEncendido.val || '').replace(/\s/g, ''));

      // Parcial = la mitad del saldo, mínimo 1,00, para que sea claramente < total.
      const saldoNum = montoANumero(montoApagado && montoApagado.val) || 0;
      const parcial = Math.max(1, Math.floor(saldoNum / 2));
      const esc = await escribirEnModal(/monto a pagar/i, String(parcial * 100));
      if (!esc.ok) throw new Error(`no se pudo escribir el parcial: ${esc.err}` +
        (esc.rotulos ? ` · rótulos del modal: ${esc.rotulos.join(' | ')}` : ''));

      const cerr = await cerrarDetalleGuardando();
      if (!cerr.ok) throw new Error(`el detalle no se guardó: ${cerr.motivo}`);

      await clickTab('pagos');
      await pg.waitForTimeout(1600);
      const totalParcial = (await leerPagosSticky()).total;
      const nParcial = montoANumero(totalParcial);
      const llegoAPagos = nParcial !== null && Math.abs(nParcial - parcial) < 0.01;

      // Persistencia: guardar, reabrir y volver a mirar.
      const pago = await agregarPagoEfectivo();
      const clicG = await clickGuardarEnviar('imagenGuardar');
      await pg.waitForTimeout(1600);
      const alG = await readAlert();
      const guardado = !!(alG && /guardad/i.test(alG));
      if (alG) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});

      let totalReabierto = null, persiste = null;
      if (guardado) {
        await abrirListaCobros();
        if (await reabrirGuardado(comentC)) {
          await clickTab('pagos');
          await pg.waitForTimeout(1600);
          totalReabierto = (await leerPagosSticky()).total;
          const nRe = montoANumero(totalReabierto);
          persiste = nRe !== null && Math.abs(nRe - parcial) < 0.01;
          await abandonarCobro();
        }
      }

      const veredicto = (contratoOk && llegoAPagos && persiste === true) ? 'PASS'
        : (persiste === null ? 'BLOCKED' : 'FAIL');
      v2('DM-COB-046', 'Pago parcial: toggle, monto editable y persistencia al reabrir', veredicto,
        `saldo del documento: ${montoApagado ? montoApagado.val : '—'} (readOnly: ${montoApagado && montoApagado.ro}) · ` +
        `al encender: ${montoEncendido ? montoEncendido.val : '—'} (readOnly: ${montoEncendido && montoEncendido.ro}) · ` +
        `parcial tecleado: ${parcial.toFixed(2)} · en Tab Pagos: ${totalParcial || '—'} · ` +
        `al reabrir el Guardado: ${totalReabierto || '(no se pudo reabrir)'}` +
        (pago.ok ? '' : ` · ⚠ no se pudo pagar (${pago.error})`) +
        (contratoOk ? '' : ' · 🔴 el contrato del toggle no se cumple (readOnly / reset a 0,00)') +
        (llegoAPagos ? '' : ' · 🔴 el parcial no llegó al «Monto total a pagar»') +
        (persiste === false ? ' · 🔴 el parcial NO sobrevivió al guardado' : ''));

      await eliminarPrimerGuardado().catch(() => {});
    }
  } catch (e) {
    v2('DM-COB-046', 'Pago parcial', 'BLOCKED', e.message);
    await abandonarCobro().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // F2-D · DM-COB-041 / 042 — RETENCIÓN EN EL DETALLE DEL DOCUMENTO
  //
  // Orden OBLIGATORIO: «Nro. Comp Ret» PRIMERO (exactamente `sizeRetention`
  // dígitos) — eso HACE APARECER «Fecha Comp Ret», «Monto retenido IVA» y
  // «ISLR», que antes ni existen en el DOM. Después los montos. El neto se ve
  // en «Monto a pagar» del detalle y en el sticky del Tab Pagos.
  // ───────────────────────────────────────────────────────────────────────────
  try {
    if (!DATA.retencion || !DATA.userCanAddRetention) {
      ['DM-COB-041', 'DM-COB-042'].forEach(id => v2(id, id, 'N/A',
        `retencion=${DATA.retencion} · userCanAddRetention=${DATA.userCanAddRetention}`));
    } else if (!DATA.retentionDocTypeCR) {
      ['DM-COB-041', 'DM-COB-042'].forEach(id => v2(id, id, 'N/A',
        'retentionDocTypeCR=false ⇒ no existe la lupa que abre el detalle del documento'));
    } else if (DATA.dynamicRetentions) {
      ['DM-COB-041', 'DM-COB-042'].forEach(id => v2(id, id, 'BLOCKED',
        'dynamicRetentions=true ⇒ el detalle usa el selector «Seleccione Retención», ' +
        'un layout distinto del de campos fijos que implementa este guion'));
    } else {
      const comentD = marcaF2('COB-041');
      const base = await abrirCobroConDocumento(RELEVO, comentD);
      if (!base.ok) throw new Error(base.motivo);
      if (!(await abrirDetalleDocumento())) throw new Error('no abrió el detalle del documento');

      const antes = await fotoDetalle();
      const rotMonto = Object.keys(antes.campos || {}).find(k => /monto a pagar/i.test(k));
      const saldoDoc = montoANumero(rotMonto ? antes.campos[rotMonto].val : null);
      const habiaIVA = Object.keys(antes.campos || {}).some(k => /retenido iva/i.test(k));
      if (saldoDoc === null) throw new Error('no se pudo leer el saldo del documento en el detalle');

      // Nro. Comp Ret con EXACTAMENTE sizeRetention dígitos.
      const nDig = Number(DATA.sizeRetention) || 14;
      const nroComp = String(Date.now()).slice(-nDig).padStart(nDig, '1');
      const escNro = await escribirEnModal(/comp\s*ret/i, nroComp);
      if (!escNro.ok) throw new Error(`no se pudo escribir el Nro. Comp Ret: ${escNro.err}` +
        (escNro.rotulos ? ` · rótulos: ${escNro.rotulos.join(' | ')}` : ''));

      const trasNro = await fotoDetalle();
      const camposDespues = Object.keys(trasNro.campos || {});
      const aparecioIVA  = camposDespues.some(k => /retenido iva/i.test(k));
      const aparecioISLR = camposDespues.some(k => /retenido islr/i.test(k));

      // Montos proporcionales al saldo: en 4K hay documentos de 8,75 y un
      // 5,00 + 3,00 fijo dejaría el neto casi en cero.
      const iva  = Math.max(0.01, Math.round(saldoDoc * 0.10 * 100) / 100);
      const islr = Math.max(0.01, Math.round(saldoDoc * 0.05 * 100) / 100);
      const escIVA  = await escribirEnModal(/retenido iva/i,  String(Math.round(iva  * 100)));
      const escISLR = await escribirEnModal(/retenido islr/i, String(Math.round(islr * 100)));

      // Fecha Comp Ret: nace vacía; se fija a hoy por si el Guardar la exigiera.
      await pg.evaluate(() => {
        const m = [...document.querySelectorAll('ion-modal')].filter(x => x.getBoundingClientRect().width > 0).pop();
        if (!m) return;
        const d = [...m.querySelectorAll('ion-datetime')].pop();
        if (!d) return;
        const iso = new Date().toISOString().slice(0, 10) + 'T00:00:00';
        d.value = iso;
        d.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: iso } }));
      });
      await pg.waitForTimeout(1200);

      const trasMontos = await fotoDetalle();
      const netoDetalle = montoANumero(rotMonto ? (trasMontos.campos[rotMonto] || {}).val : null);
      const netoEsperado = Math.round((saldoDoc - iva - islr) * 100) / 100;
      const netoOk = netoDetalle !== null && Math.abs(netoDetalle - netoEsperado) < 0.02;

      const cerr = await cerrarDetalleGuardando();
      if (!cerr.ok) throw new Error(`el detalle no se guardó: ${cerr.motivo}`);

      await clickTab('pagos');
      await pg.waitForTimeout(1600);
      const totalPagos = (await leerPagosSticky()).total;
      const nPagos = montoANumero(totalPagos);
      const llegoAPagos = nPagos !== null && Math.abs(nPagos - netoEsperado) < 0.02;

      const ok41 = (!habiaIVA && aparecioIVA && aparecioISLR) && netoOk && llegoAPagos;
      v2('DM-COB-041', `Retención en el detalle (${nDig} dígitos) → monto neto en Pagos`,
        ok41 ? 'PASS' : 'FAIL',
        `saldo: ${saldoDoc} · Nro Comp Ret (${nDig} díg.): ${nroComp} · ` +
        `IVA/ISLR aparecen tras el comprobante: ${aparecioIVA}/${aparecioISLR} ` +
        `(antes existían: ${habiaIVA}) · retenido ${iva.toFixed(2)} + ${islr.toFixed(2)} · ` +
        `neto en el detalle: ${netoDetalle} (esperado ${netoEsperado.toFixed(2)}) · ` +
        `Monto total a pagar: ${totalPagos || '—'}` +
        (escIVA.ok && escISLR.ok ? '' : ` · ⚠ IVA:${escIVA.err || 'ok'} ISLR:${escISLR.err || 'ok'}`) +
        (netoOk ? '' : ' · 🔴 el detalle no descuenta la retención del monto a pagar') +
        (llegoAPagos ? '' : ' · 🔴 el neto no llegó al Tab Pagos'));

      // ── DM-COB-042 · el neto y el detalle sobreviven al Guardado ───────────
      const pago = await agregarPagoEfectivo();
      const clicG = await clickGuardarEnviar('imagenGuardar');
      await pg.waitForTimeout(1600);
      const alG = await readAlert();
      const guardado = !!(alG && /guardad/i.test(alG));
      if (alG) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});

      if (!guardado) {
        v2('DM-COB-042', 'La retención persiste al reabrir el Guardado', 'BLOCKED',
          `el cobro con retención no llegó a guardarse · clic: ${clicG.via || clicG.motivo} · ` +
          `alert: "${alG || 'ninguno'}"${pago.ok ? '' : ` · pago: ${pago.error}`}`);
      } else {
        await abrirListaCobros();
        if (!(await reabrirGuardado(comentD))) {
          v2('DM-COB-042', 'La retención persiste al reabrir el Guardado', 'BLOCKED',
            'no se pudo reabrir el cobro Guardado');
        } else {
          await clickTab('pagos');
          await pg.waitForTimeout(1600);
          const totalRe = (await leerPagosSticky()).total;
          const nRe = montoANumero(totalRe);
          const montoPersiste = nRe !== null && Math.abs(nRe - netoEsperado) < 0.02;
          // Y el DETALLE: los importes de IVA/ISLR tienen que seguir dentro.
          let detalleRe = null;
          if (await abrirDetalleDocumento()) {
            const f = await fotoDetalle();
            const kIVA  = Object.keys(f.campos || {}).find(k => /retenido iva/i.test(k));
            const kISLR = Object.keys(f.campos || {}).find(k => /retenido islr/i.test(k));
            detalleRe = { iva: kIVA ? f.campos[kIVA].val : null,
                          islr: kISLR ? f.campos[kISLR].val : null };
            await pg.evaluate(() => {
              const m = [...document.querySelectorAll('ion-modal')].filter(x => x.getBoundingClientRect().width > 0).pop();
              if (!m) return;
              const b = [...m.querySelectorAll('ion-button')].filter(x => x.getBoundingClientRect().width > 0)
                .find(x => /cancelar/i.test((x.textContent || '').trim()));
              if (b) b.click(); else if (m.dismiss) m.dismiss();
            });
            await pg.waitForTimeout(1400);
          }
          const detalleOk = !!detalleRe && montoANumero(detalleRe.iva) > 0 && montoANumero(detalleRe.islr) > 0;
          v2('DM-COB-042', 'La retención persiste al reabrir el Guardado (monto y detalle)',
            (montoPersiste && detalleOk) ? 'PASS' : 'FAIL',
            `neto al guardar: ${netoEsperado.toFixed(2)} · al reabrir: ${totalRe || '—'} · ` +
            `IVA/ISLR en el detalle reabierto: ${detalleRe ? `${detalleRe.iva}/${detalleRe.islr}` : 'no se pudo abrir'}` +
            (montoPersiste ? '' : ' · 🔴 el «Monto total a pagar» volvió al bruto: la retención se perdió') +
            (detalleOk ? '' : ' · 🔴 los importes de retención no están en el detalle reabierto'));
          await abandonarCobro();
        }
      }
      await eliminarPrimerGuardado().catch(() => {});
    }
  } catch (e) {
    ['DM-COB-041', 'DM-COB-042'].forEach(id => v2(id, id, 'BLOCKED', e.message));
    await abandonarCobro().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // F2-E · DM-COB-028 — ANTICIPO / PREPAGO (co_type 1)
  // Sin pestaña Documentos: el monto se teclea a mano.
  // ───────────────────────────────────────────────────────────────────────────
  try {
    if (!DATA.cobroPrepago) {
      v2('DM-COB-028', 'Cobro Anticipo/Prepago', 'N/A', 'cobroPrepago=false');
    } else {
      await abandonarCobro();
      const comentE = marcaF2('COB-028');
      await clickBotonHome('ANTICIPO/PREPAGO');
      let tabs = null;
      for (let i = 0; i < 12; i++) {
        await pg.waitForTimeout(700);
        tabs = await pg.evaluate(() =>
          [...document.querySelectorAll('ion-segment-button')]
            .filter(s => s.getBoundingClientRect().width > 0)
            .map(s => ({ v: String(s.value), t: (s.textContent || '').trim() })));
        if (tabs.length >= 3) break;
      }
      if (!tabs || tabs.length < 3) throw new Error('el formulario de Anticipo no abrió');
      const sinDocumentos = !tabs.some(t => /documento/i.test(t.t) || /documento/i.test(t.v));

      await seleccionarCliente(CLI_OK);
      if (DATA.requiredComment) await fillComentario(comentE);
      let hE = 0;
      for (let i = 0; i < 8; i++) { hE = await tabsHabilitadas(); if (hE >= 3) break; await pg.waitForTimeout(700); }

      await clickTab('pagos');
      await pg.waitForTimeout(1200);
      // 🔑 Aquí NO hay total que leer: el anticipo nace en 0. Se fija el monto.
      const pago = await agregarPagoEfectivo('500');   // 5,00
      const sticky = await leerPagosSticky();

      const clicG = await clickGuardarEnviar('imagenGuardar');
      await pg.waitForTimeout(1600);
      const alG = await readAlert();
      const guardado = !!(alG && /guardad/i.test(alG));
      if (alG) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});

      v2('DM-COB-028', 'Anticipo: sin pestaña Documentos y guarda solo con cliente + pago',
        (sinDocumentos && guardado) ? 'PASS' : 'FAIL',
        `pestañas: ${tabs.map(t => t.t).join('/')} · sin Documentos: ${sinDocumentos} · ` +
        `habilitadas tras el cliente: ${hE} · monto tecleado: 5,00 · ` +
        `sticky: ${sticky.total || '—'} · alert al guardar: "${alG || 'ninguno'}" ` +
        `(clic: ${clicG.ok ? clicG.via : clicG.motivo})` +
        (pago.ok ? '' : ` · ⚠ pago: ${pago.error}`) +
        (sinDocumentos ? '' : ' · 🔴 el Anticipo muestra pestaña Documentos y no debería'));

      await eliminarPrimerGuardado().catch(() => {});
    }
  } catch (e) {
    v2('DM-COB-028', 'Cobro Anticipo/Prepago', 'BLOCKED', e.message);
    await abandonarCobro().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DM-COB-029 — cobro tipo RETENCIÓN
  // No es «Fase 2 pendiente»: es N/A por variable global. Hasta el 14/09 salía
  // BLOCKED, que es decir «no lo probé» cuando la respuesta correcta es «no
  // aplica a este cliente».
  // ───────────────────────────────────────────────────────────────────────────
  if (!DATA.cobroRetencion) {
    v2('DM-COB-029', 'Cobro tipo Retención', 'N/A',
      'cobroRetencion=false ⇒ el submódulo «Retención» no existe en el menú de este cliente ' +
      '(la retención POR DOCUMENTO sí se prueba: DM-COB-041/042)');
  } else {
    v2('DM-COB-029', 'Cobro tipo Retención', 'BLOCKED',
      'cobroRetencion=true pero el flujo de co_type 2 no está construido en este guion');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // F2-F · TOLERANCIA POSITIVA Y ANTICIPO AUTOMÁTICO  (DM-COB-056 / 057)
  //
  // 🔑 Configuración de 4K al 14/09, leída del EQUIPO:
  //        RangoToleranciaPositiva = 49,99 USD   ·   prepaidRangeAmount = 0,01
  //    El umbral es la SUMA: `excesoBruto − 49,99 ≥ 0,01` ⟺ `excesoBruto ≥ 50,00`.
  //    Y el anticipo se crea por **exceso − techo de tolerancia**, no por el
  //    exceso entero: pagar 50,00 de más deja un anticipo de 0,01. En la nube se
  //    ve como DOS filas con el mismo comentario: co_type 0 (cobro) y co_type 1
  //    (anticipo) — p. ej. 2706/2707 del 14/09.
  //
  // Estos dos IDs NO están todavía en `guion-cobros.md`: se crean aquí porque el
  // encargo pide cubrir «anticipo automático en USD · tolerancia» y no había
  // ningún caso al que colgarlo. Ver el informe de la corrida.
  // ───────────────────────────────────────────────────────────────────────────
  const IDS_TOL = ['DM-COB-056', 'DM-COB-057', 'DM-COB-058'];

  /**
   * Monta un cobro, paga total+exceso, lo ENVÍA y mira la nube.
   *
   * @param {'directo'|'reabierto'} via  🔴 NO es un detalle: los dos caminos NO
   *        se comportan igual. Enviar directo genera el anticipo automático;
   *        guardar, reabrir y enviar **no lo genera**. Medido en 4K el 14/09 con
   *        el mismo excedente de 50,00 — ver DM-COB-057 vs DM-COB-058.
   */
  async function cobroConExceso(cliente, comentario, exceso, via = 'directo') {
    const base = await abrirCobroConDocumento(cliente, comentario);
    if (!base.ok) return { ok: false, motivo: base.motivo };
    const total = base.saldo;
    if (total === null) return { ok: false, motivo: 'no se pudo leer el «Monto total a pagar»' };
    const pagar = Math.round((total + exceso) * 100);        // en céntimos
    const pago = await agregarPagoEfectivo(String(pagar));
    if (!pago.ok) return { ok: false, motivo: `no se pudo pagar: ${pago.error}` };
    const sticky = await leerPagosSticky();
    if (via === 'reabierto') {
      const cg = await clickGuardarEnviar('imagenGuardar');
      await pg.waitForTimeout(1600);
      const alG = await readAlert();
      if (alG) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
      if (!(alG && /guardad/i.test(alG))) {
        return { ok: false, motivo: `no guardó · clic: ${cg.via || cg.motivo} · alert: "${alG || 'ninguno'}"` };
      }
      await abrirListaCobros();
      if (!(await reabrirGuardado(comentario))) return { ok: false, motivo: 'no se pudo reabrir el Guardado' };
    }
    const ce = await clickGuardarEnviar('imagenEnviar');
    await pg.waitForTimeout(1800);
    const dlg = await readAlert();
    if (dlg) { await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); await pg.waitForTimeout(3000); }
    // Puede encadenar un segundo aviso (el del anticipo generado).
    const cierre = await readAlert();
    if (cierre) { await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); await pg.waitForTimeout(2000); }
    const tercero = await readAlert();
    if (tercero) await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {});
    await pg.waitForTimeout(1500);
    const nube = await verificarNube(comentario);
    await abandonarCobro().catch(() => {});
    return { ok: true, via, total, exceso, pagado: total + exceso, sticky: sticky.total,
             dialogo: dlg, cierre, clicEnviar: ce, nube };
  }

  try {
    const techo  = Number(DATA.rangoToleranciaPositiva);
    const minAnt = Number(DATA.prepaidRangeAmount);
    if (!DATA.tolerancia0 || !DATA.automatedPrepaid ||
        !Number.isFinite(techo) || !Number.isFinite(minAnt)) {
      IDS_TOL.forEach(id => v2(id, id, 'N/A',
        `tolerancia0=${DATA.tolerancia0} · automatedPrepaid=${DATA.automatedPrepaid} · ` +
        `RangoToleranciaPositiva=${DATA.rangoToleranciaPositiva} · prepaidRangeAmount=${DATA.prepaidRangeAmount}`));
    } else if (Number(DATA.tipoTolerancia) !== 0) {
      IDS_TOL.forEach(id => v2(id, id, 'N/A',
        `TipoTolerancia=${DATA.tipoTolerancia} (porcentaje): este guion cubre el modo Importe`));
    } else {
      const umbral = Math.round((techo + minAnt) * 100) / 100;

      // ── DM-COB-056 · exceso JUSTO por debajo del umbral ⇒ envía sin anticipo ─
      const excesoDentro = Math.round((umbral - 0.01) * 100) / 100;
      const r1 = await cobroConExceso(RELEVO, marcaF2('TOL-DENTRO'), excesoDentro);
      if (!r1.ok) {
        v2('DM-COB-056', `Tolerancia positiva: exceso ${excesoDentro.toFixed(2)} se envía sin anticipo`,
          'BLOCKED', r1.motivo);
      } else {
        const sinAnticipo = r1.nube.ok && r1.nube.anticipos.length === 0 && r1.nube.cobros.length === 1;
        v2('DM-COB-056',
          `Tolerancia positiva: exceso ${excesoDentro.toFixed(2)} (umbral ${umbral.toFixed(2)}) se envía SIN anticipo`,
          sinAnticipo ? 'PASS' : (r1.nube.ok ? 'FAIL' : 'BLOCKED'),
          `total ${r1.total} + exceso ${excesoDentro.toFixed(2)} = pagado ${r1.pagado.toFixed(2)} · ` +
          `diálogo: "${r1.dialogo || 'ninguno'}" · ☁ ${r1.nube.resumen}${r1.nube.aviso}` +
          (sinAnticipo ? '' : ' · 🔴 o se generó anticipo por debajo del umbral, o el cobro no llegó a la nube'));
      }

      // ── DM-COB-057 · exceso EN el umbral, ENVIADO DIRECTO ⇒ anticipo ───────
      const esperado = Math.round((umbral - techo) * 100) / 100;   // exceso − techo
      const r2 = await cobroConExceso(RELEVO, marcaF2('TOL-ANTIC'), umbral, 'directo');
      if (!r2.ok) {
        v2('DM-COB-057', `Anticipo automático con exceso ${umbral.toFixed(2)}`, 'BLOCKED', r2.motivo);
      } else {
        const ant = r2.nube.anticipos[0];
        const montoAnt = ant ? Number(ant.nu_amount_total) : null;
        // 🔑 El anticipo vale EXCESO − TECHO DE TOLERANCIA, no el exceso entero.
        const cuadra = montoAnt !== null && Math.abs(montoAnt - esperado) < 0.011;
        v2('DM-COB-057',
          `Anticipo automático (envío DIRECTO): exceso ${umbral.toFixed(2)} ⇒ anticipo por exceso − techo (${esperado.toFixed(2)})`,
          (r2.nube.ok && r2.nube.anticipos.length === 1 && r2.nube.cobros.length === 1 && cuadra)
            ? 'PASS' : (r2.nube.ok ? 'FAIL' : 'BLOCKED'),
          `total ${r2.total} + exceso ${umbral.toFixed(2)} = pagado ${r2.pagado.toFixed(2)} · ` +
          `techo de tolerancia ${techo.toFixed(2)} · abono mínimo ${minAnt} · ` +
          `anticipo esperado ${esperado.toFixed(2)} · obtenido ${montoAnt === null ? 'ninguno' : montoAnt} · ` +
          `diálogo: "${r2.dialogo || 'ninguno'}" · ☁ ${r2.nube.resumen}${r2.nube.aviso}` +
          (r2.nube.anticipos.length === 1 ? '' : ` · 🔴 anticipos creados: ${r2.nube.anticipos.length}`) +
          (cuadra ? '' : ' · 🔴 el anticipo no vale exceso − techo'));
      }

      // ── DM-COB-058 · el MISMO exceso, pero enviando un GUARDADO reabierto ──
      //
      // 🔴 DEFECTO DE PRODUCTO, no del guion. Medido en 4K el 14/09 con un A/B
      //    limpio, mismo tenant, mismo vendedor, mismo excedente de 50,00 USD:
      //      · envío DIRECTO      → cobro 2718 + anticipo 2719 (0,01)  ✅
      //      · guardar→reabrir→enviar → cobro 2717, SIN anticipo       ❌
      //      · guardar→reabrir→enviar → cobro 2720, SIN anticipo       ❌ (repetido)
      //    Y los diálogos difieren: el camino reabierto intercala «Su Cobro será
      //    enviado», que el directo no muestra ⇒ son dos rutas de envío
      //    distintas, y la del Guardado no pasa por el cálculo del anticipo.
      //    Efecto: el excedente cobrado al cliente NO queda como anticipo a su
      //    favor. Este caso queda en el guion como testigo: mientras falle, el
      //    defecto sigue vivo.
      const r3 = await cobroConExceso(RELEVO, marcaF2('TOL-REAB'), umbral, 'reabierto');
      if (!r3.ok) {
        v2('DM-COB-058', `Anticipo automático enviando un Guardado reabierto`, 'BLOCKED', r3.motivo);
      } else {
        const ant3 = r3.nube.anticipos[0];
        const monto3 = ant3 ? Number(ant3.nu_amount_total) : null;
        const cuadra3 = monto3 !== null && Math.abs(monto3 - esperado) < 0.011;
        v2('DM-COB-058',
          `Anticipo automático con el MISMO exceso (${umbral.toFixed(2)}) pero enviando un GUARDADO reabierto`,
          (r3.nube.ok && r3.nube.anticipos.length === 1 && cuadra3) ? 'PASS'
            : (r3.nube.ok ? 'FAIL' : 'BLOCKED'),
          `total ${r3.total} + exceso ${umbral.toFixed(2)} = pagado ${r3.pagado.toFixed(2)} · ` +
          `anticipo esperado ${esperado.toFixed(2)} · obtenido ${monto3 === null ? 'ninguno' : monto3} · ` +
          `diálogo: "${r3.dialogo || 'ninguno'}" · ☁ ${r3.nube.resumen}${r3.nube.aviso}` +
          (cuadra3 ? ''
            : ' · 🔴 DEFECTO DE PRODUCTO (no del guion): el mismo excedente enviado ' +
              'DIRECTO sí crea el anticipo (DM-COB-057) y enviado desde el Guardado ' +
              'reabierto NO. El excedente cobrado se pierde en vez de quedar a favor del cliente'));
      }
    }
  } catch (e) {
    chequearCdp(e);
    IDS_TOL.forEach(id => v2(id, id, 'BLOCKED', e.message));
    await abandonarCobro().catch(() => {});
  }



  // ═══════════════════════════════════════════════════════════════════════════
  // CASOS NUEVOS · las cinco familias que pidió QA
  //
  // Reglas que se aplican a TODOS los de aquí abajo:
  //   · el oráculo es la NUBE, no la pantalla (guardar es local; enviar POSTea);
  //   · si la configuración del equipo o la cartera de 4K no permiten
  //     ejercitarlos, salen N/A o BLOCKED **con la razón medida**, nunca FAIL;
  //   · un caso que no puede fallar NO es un PASS.
  //
  // ⚠ Van al final a propósito: si la cartera se agota, que se queden sin
  //   materia prima los casos NUEVOS y no el núcleo del módulo. Cuando eso pase
  //   lo dirán con el inventario delante, que es justo lo que se está arreglando.
  // ═══════════════════════════════════════════════════════════════════════════

  /** Lee el `collection_detail` del cobro con esa marca. Oráculo de retención,
   *  descuento y pago parcial: son campos de DETALLE, no de cabecera. */
  function detalleNube(comentario) {
    return consultaNube(DATA.clienteSlug,
      `select cd.co_document, cd.in_payment_partial, cd.nu_voucher_retention, ` +
      `cd.nu_amount_retention, cd.nu_amount_retention2, ` +
      `cd.nu_amount_retention_iva, cd.nu_amount_retention_islr, ` +
      `cd.nu_amount_paid, cd.nu_amount_doc, cd.nu_balance_doc, ` +
      `cd.nu_amount_discount, cd.nu_collect_discount, cd.nu_amount_collect_discount ` +
      `from collection_detail cd join collection c on c.id_collection = cd.id_collection ` +
      `where c.tx_comment = '${comentario}' and c.co_type = 0 order by cd.id_collection_detail`);
  }




  /**
   * Detalle del cobro con esa marca en el REGISTRO PERSISTIDO del equipo.
   *
   * 🔑 Por qué no la nube, para los casos de RETENCIÓN. La app exige un adjunto
   *    para enviar cualquier cobro con retención (`issueMissingAttachments` →
   *    NO_ATTACHMENTS_RETENTION, sin VG que lo gobierne). Y un adjunto INYECTADO
   *    no sobrevive al envío: medido el 15/09, los dos únicos cobros del día con
   *    `has_attachments = true` son **los dos únicos que no llegaron a la nube**
   *    — se quedaron en el equipo con `st_collection = 2` e `id_collection = 0`,
   *    mientras los diez sin adjunto salieron con st = 1 e id asignado. La foto
   *    mockeada no existe en disco, así que la subida no puede completarse.
   *
   *    Conclusión operativa (y es la norma de QA): **si la app exige adjunto, el
   *    guion deja el cobro GUARDADO y lo envía una persona a mano.** Forzar el
   *    envío con una foto falsa no probaría el envío: probaría el mock.
   *
   *    Lo que sí se puede medir con rigor es el REGISTRO: `collection_details`
   *    del sqlite del equipo tiene las MISMAS columnas separadas que la nube
   *    (`nu_amount_retention` / `nu_amount_retention2`), y es lo que se
   *    sincronizará tal cual. No es la pantalla: es el dato guardado.
   */
  function detalleLocal(comentario) {
    return localQuery(
      `SELECT c.st_collection, c.id_collection, cd.co_document, cd.in_payment_partial, ` +
      `cd.nu_voucher_retention, round(cd.nu_amount_retention,4) nu_amount_retention, ` +
      `round(cd.nu_amount_retention2,4) nu_amount_retention2, ` +
      `round(cd.nu_amount_paid,4) nu_amount_paid, round(cd.nu_amount_doc,4) nu_amount_doc, ` +
      `round(cd.nu_balance_doc,4) nu_balance_doc ` +
      `FROM collection_details cd JOIN collections c ON c.co_collection = cd.co_collection ` +
      `WHERE c.tx_comment = '${String(comentario).replace(/'/g, "''")}'`);
  }

  /** Guarda el cobro en pantalla y confirma el aviso. Devuelve si quedó Guardado. */
  async function guardarCobro() {
    const clic = await clickGuardarEnviar('imagenGuardar');
    await pg.waitForTimeout(1600);
    const al = await readAlert();
    if (al) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
    await pg.waitForTimeout(1200);
    return { ok: !!(al && /guardad/i.test(al)), alerta: al, clic };
  }

  /** ENVÍA el cobro que está en pantalla y devuelve lo que se vio + la nube. */
  async function enviarYMirarNube(comentario, esperas = 5) {
    const ce = await clickGuardarEnviar('imagenEnviar');
    await pg.waitForTimeout(1800);
    const dlg = await readAlert();
    if (dlg) { await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); await pg.waitForTimeout(3000); }
    const cierre = await readAlert();
    if (cierre) { await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); await pg.waitForTimeout(2000); }
    const tercero = await readAlert();
    if (tercero) await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {});
    await pg.waitForTimeout(1500);
    const nube = await verificarNube(comentario, esperas);
    await abandonarCobro().catch(() => {});
    return { clic: ce, dialogo: dlg, cierre, nube };
  }

  /** Clientes con documentos libres de al menos `min` de saldo; de relevo, el pool entero. */
  const relevoConSaldo = (min) => {
    const holgados = INV.ok ? INV.clientesConSaldo(min) : [];
    return [...new Set([...holgados, ...RELEVO])];
  };

  // 🔑 El inventario se RE-MIDE aquí, no se reutiliza el del arranque. Durante
  //    la vuelta el pool baja solo —cada envío compromete su factura— así que un
  //    BLOCKED que cite el número inicial miente por exceso justo cuando más
  //    importa. Se dice cuántos quedaban al arrancar y cuántos quedan AHORA.
  // ⚠ DECLARACIÓN DE FUNCIÓN, no `const`: la usa el catch de F2-B, que corre
  //    MUCHO antes de esta línea. Como arrow en un `const` reventaba con
  //    «Cannot access 'faltaMateria' before initialization» y se llevaba por
  //    delante la vuelta entera — 60 casos perdidos por una zona muerta temporal.
  function faltaMateria(motivo) {
    const ahora = inventarioDocumentosLibres();
    return `${motivo} · 📋 documentos libres AHORA: ${ahora.ok ? ahora.resumen : 'no se pudo leer'} ` +
    `(al arrancar la vuelta: ${INV.ok ? INV.total : '?'}) · ` +
    `🔑 cada cobro ENVIADO compromete su factura; se liberan rechazando o aprobando en la web ` +
    `los cobros «Por aprobar»`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FAMILIA 1 · TOLERANCIA NEGATIVA  (DM-COB-059 · DM-COB-060)
  //
  // Los bordes POSITIVOS ya estaban cubiertos: 056 (49,99 ⇒ sin anticipo),
  // 057 (50,00 directo ⇒ anticipo por exceso − techo) y 058 (el mismo exceso
  // desde un Guardado reabierto ⇒ defecto de producto D-1).
  // Falta el otro lado del rango: `RangoToleranciaNegativa` = 10,00 USD ⇒
  // pagar hasta 10,00 DE MENOS debe dejar enviar; 10,01 de menos, no.
  //
  // ⚠ Orden deliberado: primero el que NO debe enviarse (060). Si la app hace
  //   lo correcto, ese caso no compromete ninguna factura y deja el documento
  //   disponible para el siguiente.
  // ───────────────────────────────────────────────────────────────────────────
  const IDS_TOLNEG = ['DM-COB-059', 'DM-COB-060'];
  try {
    abortarSiCdpCaido();
    const techoNeg = Number(DATA.rangoToleranciaNegativa);
    if (!DATA.tolerancia0 || !Number.isFinite(techoNeg) || techoNeg <= 0) {
      IDS_TOLNEG.forEach(id => v2(id, id, 'N/A',
        `tolerancia0=${DATA.tolerancia0} · RangoToleranciaNegativa=${DATA.rangoToleranciaNegativa}: ` +
        `sin rango negativo configurado no hay borde que probar`));
    } else if (Number(DATA.tipoTolerancia) !== 0) {
      IDS_TOLNEG.forEach(id => v2(id, id, 'N/A',
        `TipoTolerancia=${DATA.tipoTolerancia} (porcentaje): este guion cubre el modo Importe`));
    } else {
      // Hace falta un documento con saldo holgado: pagar «total − 10,01» sobre
      // una factura de 3,00 daría un importe negativo y el caso mediría otra cosa.
      const RELEVO_NEG = relevoConSaldo(techoNeg + 50);

      // ── DM-COB-060 · FUERA del rango negativo ⇒ NO debe poder enviarse ─────
      const faltaFuera = Math.round((techoNeg + 0.01) * 100) / 100;
      const rF = await cobroConExceso(RELEVO_NEG, marcaF2('TOLNEG-FUERA'), -faltaFuera, 'directo');
      if (!rF.ok) {
        v2('DM-COB-060', `Tolerancia negativa: pagar ${faltaFuera.toFixed(2)} de menos se bloquea`,
          'BLOCKED', faltaMateria(rF.motivo));
      } else {
        // 🔑 El oráculo del bloqueo es la AUSENCIA de fila en la nube, no lo que
        //    diga la pantalla: un diálogo de aviso que igualmente envía sería un
        //    falso PASS. Y «la consulta falló» no es «no llegó»: se distingue.
        const consultaOk = Array.isArray(rF.nube.filas);
        const noLlego = consultaOk && rF.nube.filas.length === 0;
        v2('DM-COB-060',
          `Tolerancia negativa: pagar ${faltaFuera.toFixed(2)} de menos (rango ${techoNeg.toFixed(2)}) NO debe enviarse`,
          !consultaOk ? 'BLOCKED' : (noLlego ? 'PASS' : 'FAIL'),
          `total ${rF.total} · pagado ${rF.pagado.toFixed(2)} (${faltaFuera.toFixed(2)} de menos) · ` +
          `diálogo: "${rF.dialogo || 'ninguno'}" · cierre: "${rF.cierre || 'ninguno'}" · ` +
          `☁ ${rF.nube.resumen}` +
          (!consultaOk ? ' · ⚠ la consulta a la nube falló: no se puede afirmar que no llegó' : '') +
          (noLlego ? ' · la app no dejó enviar: no hay fila en la nube ✅'
                   : ' · 🔴 el cobro LLEGÓ a la nube pagando de menos por encima del rango negativo'));
      }

      // ── DM-COB-059 · DENTRO del rango negativo ⇒ se envía ──────────────────
      const rD = await cobroConExceso(RELEVO_NEG, marcaF2('TOLNEG-DENTRO'), -techoNeg, 'directo');
      if (!rD.ok) {
        v2('DM-COB-059', `Tolerancia negativa: pagar ${techoNeg.toFixed(2)} de menos se envía`,
          'BLOCKED', faltaMateria(rD.motivo));
      } else {
        const cob = rD.nube.cobros[0];
        const dif = cob ? Number(cob.nu_difference) : null;
        // La diferencia queda NEGATIVA: se cobró de menos.
        const difOk = dif !== null && Math.abs(Math.abs(dif) - techoNeg) < 0.02 && dif <= 0;
        const sinAnticipo = rD.nube.anticipos.length === 0;
        v2('DM-COB-059',
          `Tolerancia negativa: pagar ${techoNeg.toFixed(2)} de menos (en el borde) SÍ se envía, sin anticipo`,
          (rD.nube.ok && rD.nube.cobros.length === 1 && difOk && sinAnticipo) ? 'PASS'
            : (rD.nube.ok ? 'FAIL' : 'BLOCKED'),
          `total ${rD.total} · pagado ${rD.pagado.toFixed(2)} · ` +
          `nu_difference esperado ≈ -${techoNeg.toFixed(2)} · obtenido ${dif === null ? 'ninguno' : dif} · ` +
          `diálogo: "${rD.dialogo || 'ninguno'}" · ☁ ${rD.nube.resumen}${rD.nube.aviso}` +
          (difOk ? '' : ' · 🔴 la diferencia en la nube no cuadra con lo pagado de menos') +
          (sinAnticipo ? '' : ' · 🔴 se generó un anticipo pagando de MENOS'));
      }
    }
  } catch (e) {
    chequearCdp(e);
    IDS_TOLNEG.forEach(id => v2(id, id, 'BLOCKED', e.message));
    await abandonarCobro().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FAMILIA 2 · DESCUENTOS POR MONTO  (DM-COB-061 · DM-COB-062)
  //
  // 🔑 Lo que ya había (048-052, 053-055) es descuento por PORCENTAJE, tomado
  //    del catálogo con casillas. Aquí va la otra vía: el campo libre
  //    «Monto descuento» del modal «Asignar descuento», que NO depende del
  //    catálogo y por tanto sigue siendo ejercitable con `maxCollectDiscount`
  //    en 0 — que es justo lo que trae el equipo.
  //
  // ⚠ El descuento MAYOR QUE EL SALDO es un caso de NO-REGRESIÓN: fue defecto
  //   (dejaba «Enviar» y «Agregar método de pago» deshabilitados, así que el
  //   cobro no se podía terminar) y está corregido. Se vigila.
  // ───────────────────────────────────────────────────────────────────────────
  const IDS_DTO_MONTO = ['DM-COB-061', 'DM-COB-062'];

  /** Lee TODOS los campos del modal de descuentos con su rótulo y estado. */
  const leerCamposDescuento = () => pg.evaluate(() => {
    const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
      .find(m => m.getBoundingClientRect().width > 0)
      || [...document.querySelectorAll('ion-modal')].filter(m => m.getBoundingClientRect().width > 0).pop();
    if (!modal) return { err: 'no hay modal de descuentos abierto' };
    const rot = (e) => String(e.getAttribute('label') || e.label || '').trim() ||
      ((e.closest('ion-col, ion-row, ion-item') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const campos = [...modal.querySelectorAll('ion-input')]
      .filter(i => i.getBoundingClientRect().width > 0)
      .map(i => {
        const n = i.querySelector('input') || (i.shadowRoot && i.shadowRoot.querySelector('input'));
        return { rotulo: rot(i), val: n ? n.value : null, ro: !!(n && n.readOnly), dis: !!(n && n.disabled) };
      });
    return { campos, texto: (modal.textContent || '').replace(/\s+/g, ' ').slice(0, 300) };
  });

  /** Estado de los dos botones que el defecto corregido dejaba muertos. */
  const estadoBotonesCobro = () => pg.evaluate(() => {
    const vis = (e) => e && e.getBoundingClientRect().width > 0;
    const dis = (e) => !e ? null : (e.disabled === true || e.hasAttribute('disabled') ||
      e.getAttribute('disabled') === 'true' || e.classList.contains('button-disabled'));
    const addPago = document.querySelector('#eventSelect') ||
      [...document.querySelectorAll('ion-button')].filter(vis)
        .find(b => /agregar\s+m[eé]todo/i.test(b.textContent || ''));
    // 🔑 El mismo selector que usa clickGuardarEnviar(): `ion-button.imagenEnviar`.
    //    Buscar «enviar» por texto engancha cualquier rótulo de la pantalla.
    const enviar = document.querySelector('ion-button.imagenEnviar');
    return {
      addPago: { existe: !!addPago, visible: vis(addPago), deshabilitado: dis(addPago) },
      enviar:  { existe: !!enviar,  visible: vis(enviar),  deshabilitado: dis(enviar) },
    };
  });

  try {
    abortarSiCdpCaido();
    if (!DATA.retentionDocTypeCR) {
      IDS_DTO_MONTO.forEach(id => v2(id, id, 'N/A',
        'retentionDocTypeCR=false ⇒ no existe la lupa que abre el detalle del documento, ' +
        'y el modal «Asignar descuento» vive dentro de ese detalle'));
    } else if (!DATA.userCanSelectCollectDiscount) {
      IDS_DTO_MONTO.forEach(id => v2(id, id, 'N/A',
        'userCanSelectCollectDiscount=false ⇒ el botón «Asignar descuento» no existe'));
    } else {
      // ── DM-COB-061 · descuento por MONTO baja el total y llega a la nube ───
      const comentE = marcaF2('DTO-MONTO');
      const base = await abrirCobroConDocumento(relevoConSaldo(20), comentE);
      if (!base.ok) throw new Error(base.motivo);
      const saldo = base.saldo;
      if (saldo === null) throw new Error('no se pudo leer el «Monto total a pagar»');

      if (!(await abrirDetalleDocumento())) throw new Error('no abrió el detalle del documento');
      if (!(await abrirModalDescuentos())) throw new Error('no abrió el modal «Asignar descuento»');

      const campos = await leerCamposDescuento();
      const campoMonto = (campos.campos || []).find(c => /monto\s*descuento/i.test(c.rotulo));
      if (!campoMonto) {
        // 🔑 No se inventa un FAIL: si el campo no está, se dice QUÉ hay.
        v2('DM-COB-061', 'Descuento por monto («Monto descuento»)', 'N/A',
          `el modal «Asignar descuento» no ofrece un campo «Monto descuento» en esta build · ` +
          `campos leídos: ${(campos.campos || []).map(c => `"${c.rotulo}"${c.ro ? '(ro)' : ''}`).join(' | ') || 'ninguno'} · ` +
          `${campos.err || ''}`);
        v2('DM-COB-062', 'Descuento mayor que el saldo', 'N/A',
          'sin campo «Monto descuento» no se puede pasar del saldo por esta vía');
        await abandonarCobro().catch(() => {});
      } else if (campoMonto.ro || campoMonto.dis) {
        v2('DM-COB-061', 'Descuento por monto («Monto descuento»)', 'N/A',
          `el campo «${campoMonto.rotulo}» existe pero está bloqueado (readOnly:${campoMonto.ro} · disabled:${campoMonto.dis})`);
        v2('DM-COB-062', 'Descuento mayor que el saldo', 'N/A', 'el campo «Monto descuento» está bloqueado');
        await abandonarCobro().catch(() => {});
      } else {
        // Un descuento claramente menor que el saldo y con céntimos distintos,
        // para que no se pueda confundir con ninguna otra cifra del cobro.
        const dto = Math.max(1.11, Math.round(saldo * 0.10 * 100) / 100);
        const escD = await escribirEnModal(/monto\s*descuento/i, String(Math.round(dto * 100)));
        const acep = await aceptarDescuentos();
        const trasDto = await fotoDetalle();
        const rotMonto = Object.keys(trasDto.campos || {}).find(k => /monto a pagar/i.test(k));
        const netoDetalle = montoANumero(rotMonto ? (trasDto.campos[rotMonto] || {}).val : null);
        const netoEsperado = Math.round((saldo - dto) * 100) / 100;

        const cerr = await cerrarDetalleGuardando();
        await clickTab('pagos');
        await pg.waitForTimeout(1600);
        const totalTrasDto = (await leerPagosSticky()).total;
        const nTotal = montoANumero(totalTrasDto);
        const bajoElTotal = nTotal !== null && Math.abs(nTotal - netoEsperado) < 0.02;

        // Oráculo de nube: el descuento tiene que estar en el DETALLE del cobro.
        const pago = await agregarPagoEfectivo();
        let nubeDto = null, detDto = null, envDto = null;
        if (pago.ok) {
          const env = await enviarYMirarNube(comentE);
          envDto = env;
          nubeDto = env.nube;
          detDto = detalleNube(comentE);
        } else {
          await abandonarCobro().catch(() => {});
        }
        const fila = Array.isArray(detDto) && detDto.length ? detDto[0] : null;
        const dtoNube = fila
          ? Math.max(Number(fila.nu_amount_collect_discount) || 0, Number(fila.nu_amount_discount) || 0)
          : null;
        const enNube = dtoNube !== null && Math.abs(dtoNube - dto) < 0.02;

        // 🔴 Igual que en 062: si el descuento no llegó a aplicarse —el modal no
        //    cerró o el detalle no se guardó— el caso no midió el descuento, y
        //    eso es BLOCKED del guion, no un FAIL contra la app.
        const seAplico = acep.ok && cerr.ok;
        v2('DM-COB-061',
          `Descuento por MONTO ${dto.toFixed(2)} baja el total y llega a la nube`,
          !seAplico ? 'BLOCKED'
            : ((bajoElTotal && enNube) ? 'PASS'
              : ((nubeDto === null && !pago.ok) ? 'BLOCKED' : 'FAIL')),
          `saldo del documento: ${saldo.toFixed(2)} · «Monto descuento» tecleado: ${dto.toFixed(2)} ` +
          `(quedó "${escD.despues}") · neto en el detalle: ${netoDetalle} · ` +
          `«Monto total a pagar» tras aplicar: ${totalTrasDto || '—'} (esperado ${netoEsperado.toFixed(2)}) · ` +
          `aceptar el modal: ${acep.ok ? 'ok' : acep.motivo}${acep.aviso ? ` · aviso: "${acep.aviso}"` : ''} · ` +
          `${envDto ? `diálogo al enviar: "${envDto.dialogo || 'ninguno'}" · ` : ''}` +
          `detalle guardado: ${cerr.ok ? 'ok' : cerr.motivo} · ` +
          `☁ cabecera: ${nubeDto === null ? (pago.ok ? 'sin fila' : `no se pudo pagar (${pago.error})`) : nubeDto.resumen} · ` +
          `☁ descuento leído en la nube: ${dtoNube === null ? '—' : dtoNube.toFixed(2)} · ` +
          `☁ collection_detail: ${fila ? `nu_amount_collect_discount=${fila.nu_amount_collect_discount} · nu_amount_discount=${fila.nu_amount_discount}` : 'sin detalle en la nube'}` +
          (!seAplico
            ? ' · 🚫 el descuento NO llegó a aplicarse: el caso no midió nada sobre la app'
            : (bajoElTotal ? '' : ' · 🔴 el descuento por monto no bajó el «Monto total a pagar»') +
              (enNube ? '' : ' · 🔴 el descuento por monto no llegó al collection_detail de la nube')));

        // ── DM-COB-062 · descuento MAYOR que el saldo ⇒ anticipo + botones vivos ─
        const comentF = marcaF2('DTO-EXCEDE');
        const base2 = await abrirCobroConDocumento(relevoConSaldo(5), comentF);
        if (!base2.ok) {
          v2('DM-COB-062', 'Descuento mayor que el saldo ⇒ anticipo y botones habilitados',
            'BLOCKED', faltaMateria(base2.motivo));
        } else {
          const saldo2 = base2.saldo;
          const dto2 = Math.round((saldo2 + 5) * 100) / 100;   // 5,00 por encima del saldo
          if (!(await abrirDetalleDocumento())) throw new Error('no abrió el detalle (062)');
          if (!(await abrirModalDescuentos())) throw new Error('no abrió «Asignar descuento» (062)');
          const escD2 = await escribirEnModal(/monto\s*descuento/i, String(Math.round(dto2 * 100)));
          const acep2 = await aceptarDescuentos();
          const avisoTope = await readAlert();
          if (avisoTope) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
          const cerr2 = await cerrarDetalleGuardando();
          await clickTab('pagos');
          await pg.waitForTimeout(1800);
          const totalExc = (await leerPagosSticky()).total;

          // 🔑 EL oráculo de no-regresión: los dos botones tienen que estar VIVOS.
          //    Con el defecto, el descuento que excedía el saldo los dejaba
          //    deshabilitados y el cobro no se podía terminar.
          // 🔑 EN DOS MOMENTOS, y el orden importa.
          //    ANTES de pagar: «Agregar método de pago» TIENE que estar vivo — si
          //    no, el cobro es un callejón sin salida y eso es el defecto.
          //    «Enviar», en cambio, nace deshabilitado sin métodos de pago EN TODO
          //    cobro (es el C1 del REQ del botón Enviar, que pasa en el resto del
          //    módulo): exigirlo aquí antes de pagar sería medir otra cosa y fue
          //    lo que hizo gritar «REGRESIÓN» en la vuelta 5 sin razón.
          //    DESPUÉS de pagar: entonces sí, Enviar debe estar habilitado.
          const botAntes = await estadoBotonesCobro();
          const pago2 = await agregarPagoEfectivo();
          await pg.waitForTimeout(1200);
          const botDespues = await estadoBotonesCobro();
          const puedeAgregarPago = botAntes.addPago.existe && botAntes.addPago.deshabilitado === false;
          const puedeEnviar = botDespues.enviar.existe && botDespues.enviar.deshabilitado === false;
          const botonesVivos = puedeAgregarPago && puedeEnviar;

          let nubeExc = null, envExc = null;
          if (pago2.ok) { envExc = await enviarYMirarNube(comentF); nubeExc = envExc.nube; }
          else await abandonarCobro().catch(() => {});

          const anticipos = nubeExc ? nubeExc.anticipos.length : null;
          // 🔴 PRECONDICIÓN antes de hablar de regresión: si el descuento no
          //    llegó a APLICARSE (el modal no cerró, el detalle no se guardó),
          //    los botones no están midiendo «descuento por encima del saldo»:
          //    están midiendo un cobro sin descuento. Decir «REGRESIÓN» ahí es
          //    exactamente el error que este encargo viene a quitar del informe.
          const dtoAplicado = acep2.ok && cerr2.ok;
          v2('DM-COB-062',
            `Descuento (${dto2.toFixed(2)}) MAYOR que el saldo (${saldo2.toFixed(2)}): «Enviar» y «Agregar método de pago» siguen habilitados`,
            (!dtoAplicado || !pago2.ok) ? 'BLOCKED' : (botonesVivos ? 'PASS' : 'FAIL'),
            `saldo ${saldo2.toFixed(2)} · descuento ${dto2.toFixed(2)} (quedó "${escD2.despues}") · ` +
            `aceptar: ${acep2.ok ? 'ok' : acep2.motivo}${acep2.aviso ? ` · aviso del remanente: "${acep2.aviso}"` : ''}` +
            `${avisoTope ? ` · aviso extra: "${avisoTope}"` : ''} · ` +
            `${envExc ? `diálogo al enviar: "${envExc.dialogo || 'ninguno'}" · ` : ''}` +
            `detalle: ${cerr2.ok ? 'guardado' : cerr2.motivo} · «Monto total a pagar»: ${totalExc || '—'} · ` +
            `«Agregar método de pago» ANTES de pagar: ${botAntes.addPago.existe ? (botAntes.addPago.deshabilitado ? 'DESHABILITADO' : 'habilitado') : 'ausente'} · ` +
            `«Enviar» DESPUÉS de agregar el pago: ${botDespues.enviar.existe ? (botDespues.enviar.deshabilitado ? 'DESHABILITADO' : 'habilitado') : 'ausente'} · ` +
            `(«Enviar» antes de pagar: ${botAntes.enviar.deshabilitado ? 'deshabilitado — normal, es el C1 del REQ' : 'habilitado'}) · ` +
            `☁ ${nubeExc ? nubeExc.resumen : (pago2.ok ? 'no se envió' : `no se pudo pagar (${pago2.error})`)} · ` +
            `anticipos por el excedente: ${anticipos === null ? 'no medido' : anticipos}` +
            (!dtoAplicado
              ? ' · 🚫 el descuento NO llegó a aplicarse (el modal no cerró o el detalle no se guardó): ' +
                'lo que se ve en los botones NO mide este caso, así que no se puede hablar ni de regresión ni de PASS'
              : !pago2.ok
                ? ` · 🚫 no se pudo agregar el método de pago (${pago2.error}): sin pago no se puede ` +
                  'exigir que «Enviar» esté habilitado, así que el caso queda sin medir'
                : (puedeAgregarPago ? '' : ' · 🔴 REGRESIÓN: «Agregar método de pago» queda DESHABILITADO ' +
                    'con el descuento por encima del saldo, así que el cobro es un callejón sin salida') +
                  (puedeEnviar ? '' : ' · 🔴 «Enviar» sigue deshabilitado incluso CON método de pago agregado')) +
            (nubeExc && nubeExc.ok === false && envExc && /c[oó]digo de diferencia/i.test(String(envExc.dialogo || ''))
              ? ' · ⚠ el ENVÍO no se pudo completar por una regla distinta de este caso: la app pide ' +
                'un «código de diferencia» en el método Otros (enableDifferenceCodes=true). El anticipo ' +
                'por el excedente queda, por tanto, SIN cotejar en la nube — se cotejó en pantalla la ' +
                'oferta literal del anticipo, que sí aparece con el importe exacto del excedente'
              : ''));
        }
      }
    }
  } catch (e) {
    chequearCdp(e);
    IDS_DTO_MONTO.forEach(id => v2(id, id, 'BLOCKED', e.message));
    await abandonarCobro().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FAMILIA 3 · PAGOS PARCIALES  (DM-COB-063 · DM-COB-064)
  //
  // DM-COB-046 ya cubre el CONTRATO del toggle y la persistencia al reabrir un
  // Guardado. Lo que falta es lo que sólo se puede ver en la nube: que un pago
  // parcial deje el documento ABIERTO con su remanente.
  // ───────────────────────────────────────────────────────────────────────────
  try {
    abortarSiCdpCaido();
    if (!DATA.enablePartialPayment) {
      ['DM-COB-063', 'DM-COB-064'].forEach(id => v2(id, id, 'N/A', 'enablePartialPayment=false'));
    } else {
      const comentG = marcaF2('PARC-NUBE');
      const base = await abrirCobroConDocumento(relevoConSaldo(20), comentG);
      if (!base.ok) {
        v2('DM-COB-063', 'Pago parcial: el documento NO se cierra', 'BLOCKED', faltaMateria(base.motivo));
      } else {
        const saldo = base.saldo;
        if (!(await abrirDetalleDocumento())) throw new Error('no abrió el detalle del documento');
        const tg = await togglePagoParcial();
        if (tg.err) throw new Error(tg.err);
        // Parcial con céntimos raros: así la fila de la nube no se puede
        // confundir con el saldo ni con ninguna otra cifra del cobro.
        const parcial = Math.max(1.23, Math.round(saldo * 0.40 * 100) / 100);
        const esc = await escribirEnModal(/monto a pagar/i, String(Math.round(parcial * 100)));
        if (!esc.ok) throw new Error(`no se pudo escribir el parcial: ${esc.err}`);
        const cerr = await cerrarDetalleGuardando();
        if (!cerr.ok) throw new Error(`el detalle no se guardó: ${cerr.motivo}`);
        await clickTab('pagos');
        await pg.waitForTimeout(1600);
        const totalParcial = (await leerPagosSticky()).total;
        const pago = await agregarPagoEfectivo();
        if (!pago.ok) throw new Error(`no se pudo pagar: ${pago.error}`);

        const env = await enviarYMirarNube(comentG);
        const det = detalleNube(comentG);
        const fila = Array.isArray(det) && det.length ? det[0] : null;
        const pagado    = fila ? Number(fila.nu_amount_paid)  : null;
        const montoDoc  = fila ? Number(fila.nu_amount_doc)   : null;
        const remanente = fila ? Number(fila.nu_balance_doc)  : null;
        const marcadoParcial = fila ? (fila.in_payment_partial === true || String(fila.in_payment_partial) === 'true') : null;
        // El contrato: se pagó MENOS que el documento y queda remanente > 0.
        const pagoMenor = pagado !== null && montoDoc !== null && pagado < montoDoc - 0.005;
        const quedaSaldo = remanente !== null && remanente > 0.005;

        v2('DM-COB-063',
          `Pago parcial de ${parcial.toFixed(2)} sobre ${saldo.toFixed(2)}: el documento NO se cierra (queda remanente)`,
          (env.nube.ok && marcadoParcial === true && pagoMenor && quedaSaldo) ? 'PASS'
            : (env.nube.ok ? 'FAIL' : 'BLOCKED'),
          `saldo ${saldo.toFixed(2)} · parcial tecleado ${parcial.toFixed(2)} · ` +
          `«Monto total a pagar» ${totalParcial || '—'} · ` +
          `clic Enviar: ${env.clic.via || env.clic.motivo} · diálogo: "${env.dialogo || 'ninguno'}" · ` +
          `☁ ${env.nube.resumen}${env.nube.aviso} · ` +
          `☁ collection_detail: in_payment_partial=${fila ? fila.in_payment_partial : '—'} · ` +
          `nu_amount_paid=${pagado} · nu_amount_doc=${montoDoc} · nu_balance_doc=${remanente}` +
          (marcadoParcial === true ? '' : ' · 🔴 la nube no marca el detalle como pago parcial') +
          (pagoMenor ? '' : ' · 🔴 en la nube se pagó el documento entero, no el parcial') +
          (quedaSaldo ? '' : ' · 🔴 el documento quedó sin remanente: se cerró con un pago parcial'));
      }

      // ── DM-COB-064 · pago parcial + NOTA DE CRÉDITO ────────────────────────
      //
      // 🔑 Precondición medida, no supuesta: para combinar los dos en un mismo
      //    cobro hace falta un cliente que tenga A LA VEZ una factura libre y
      //    una nota de crédito con saldo a favor.
      const conNC = INV.ok ? INV.conNotaYFactura : [];
      if (!INV.ok) {
        v2('DM-COB-064', 'Pago parcial combinado con nota de crédito', 'BLOCKED',
          'no se pudo leer el inventario del equipo para comprobar si hay notas de crédito aplicables');
      } else if (!conNC.length) {
        const nNC = INV.notasCredito.length;
        v2('DM-COB-064', 'Pago parcial combinado con nota de crédito', 'N/A',
          `NO EJERCITABLE EN 4K: el equipo tiene ${nNC} nota(s) de crédito con saldo a favor ` +
          `(${INV.notasCredito.slice(0, 5).map(n => `${n.co_client} ${n.saldo}`).join(' · ')}) ` +
          `pero NINGUNO de esos clientes tiene una factura libre que cobrar ⇒ no hay forma de ` +
          `meter la nota de crédito y el pago parcial en el mismo cobro. ` +
          `Cubrirlo exige un cliente con factura pendiente Y nota de crédito a la vez`);
      } else {
        const comentH = marcaF2('PARC-NC');
        const base = await abrirCobroConDocumento(conNC, comentH);
        if (!base.ok) {
          v2('DM-COB-064', 'Pago parcial combinado con nota de crédito', 'BLOCKED', faltaMateria(base.motivo));
        } else {
          // Marcar TAMBIÉN la nota de crédito y pagar un parcial de la factura.
          const nc = await pg.evaluate(() => {
            const docs = document.querySelector('app-cobro-documents');
            if (!docs) return { err: 'no se ve el Tab Documentos' };
            const filas = [...docs.querySelectorAll('ion-item, ion-row')]
              .filter(f => f.getBoundingClientRect().width > 0 && f.querySelector('ion-checkbox'));
            const fila = filas.find(f => /N\/C|nota de cr/i.test(f.textContent || ''));
            if (!fila) return { err: 'la lista no ofrece ninguna nota de crédito',
              filas: filas.map(f => (f.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 45)) };
            const cb = fila.querySelector('ion-checkbox');
            cb.scrollIntoView({ block: 'center' });
            const r = cb.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2,
                     texto: (fila.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) };
          });
          if (nc.err) {
            v2('DM-COB-064', 'Pago parcial combinado con nota de crédito', 'BLOCKED',
              `${nc.err}${nc.filas ? ` · filas visibles: ${nc.filas.join(' | ')}` : ''}`);
            await abandonarCobro().catch(() => {});
          } else {
            await pg.mouse.click(nc.x, nc.y, { delay: 100 });
            await pg.waitForTimeout(1600);
            await clickTab('pagos');
            await pg.waitForTimeout(1500);
            const totalConNC = (await leerPagosSticky()).total;
            const pago = await agregarPagoEfectivo();
            let nubeNC = null;
            if (pago.ok) nubeNC = (await enviarYMirarNube(comentH)).nube;
            else await abandonarCobro().catch(() => {});
            v2('DM-COB-064', 'Pago parcial combinado con nota de crédito ⇒ saldo a favor y anticipo por el excedente',
              nubeNC && nubeNC.ok ? (nubeNC.anticipos.length >= 1 ? 'PASS' : 'FAIL') : 'BLOCKED',
              `nota de crédito marcada: "${nc.texto}" · «Monto total a pagar» con la NC: ${totalConNC || '—'} · ` +
              `☁ ${nubeNC ? nubeNC.resumen : `no se envió (${pago.error || 'sin pago'})`}` +
              (nubeNC && nubeNC.ok && !nubeNC.anticipos.length
                ? ' · 🔴 el excedente de la nota de crédito no dejó anticipo a favor del cliente' : ''));
          }
        }
      }
    }

      // ══════════════════════════════════════════════════════════════════════
      // DM-COB-070 / 071 · EL AVISO DE SALDO A FAVOR, EN LOS DOS ORDENES
      //
      // El aviso estuvo enganchado al evento de MARCAR/DESMARCAR un documento y
      // no a «aparecio excedente». Salia marcando la nota la ULTIMA (070) y NO
      // salia cuando el saldo a favor nacia por otra via: los dos documentos
      // marcados y el parcial aplicado DESPUES (071).
      //   · 071 lo encontro QA a mano. El agente no lo vio porque probaba UN
      //     SOLO orden de acciones.
      // 🔑 Hay que ejercitar LOS DOS. Con uno solo, la regresion vuelve a pasar
      //    desapercibida.
      // ══════════════════════════════════════════════════════════════════════

      /** Espera a que asome una ion-alert VISIBLE de saldo a favor y la lee.
       *  Ausente != presente-pero-oculta: las descartadas siguen en el DOM con
       *  display:none, asi que contar elementos no sirve. */
      async function esperarAvisoSaldoFavor(msTope = 6000) {
        const t0 = Date.now();
        while (Date.now() - t0 < msTope) {
          const a = await pg.evaluate(() => {
            const vis = [...document.querySelectorAll('ion-alert')].filter(x => {
              const abierta = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
              const conBoton = [...x.querySelectorAll('.alert-button')]
                .some(b => b.getBoundingClientRect().width > 0);
              return abierta || conBoton;
            });
            for (const al of vis) {
              const t = al.querySelector('.alert-message');
              const msg = ((t && t.textContent) || '').replace(/\s+/g, ' ').trim();
              if (!/saldo a favor/i.test(msg)) continue;
              return {
                mensaje: msg,
                botones: [...al.querySelectorAll('.alert-button')]
                  .filter(b => b.getBoundingClientRect().width > 0)
                  .map(b => b.textContent.trim()),
                sinSustituir: /\{amount\}|\{currency\}/.test(msg),
              };
            }
            return null;
          });
          if (a) return Object.assign({ visible: true, ms: Date.now() - t0 }, a);
          await pg.waitForTimeout(250);
        }
        return { visible: false, ms: msTope };
      }

      /** Debe ser un AVISO: un solo boton y los marcadores sustituidos. */
      function juzgarAviso(id, desc, av, extra) {
        if (!av.visible) {
          v2(id, desc, 'FAIL', 'no aparecio ningun aviso de saldo a favor en ' + av.ms + ' ms · ' + extra);
          return;
        }
        const unBoton = av.botones.length === 1;
        v2(id, desc, (unBoton && !av.sinSustituir) ? 'PASS' : 'FAIL',
          '"' + av.mensaje + '" · botones: ' + (av.botones.join('/') || '—') +
          ' · a los ' + av.ms + ' ms · ' + extra +
          (!unBoton ? ' · debe ser un AVISO (1 boton), no una confirmacion' : '') +
          (av.sinSustituir ? ' · {amount}/{currency} sin sustituir' : ''));
      }

      /** Marca la fila de la nota de credito en el Tab Documentos. */
      async function marcarNotaCredito() {
        const nc = await pg.evaluate(() => {
          const docs = document.querySelector('app-cobro-documents');
          if (!docs) return { err: 'no se ve el Tab Documentos' };
          const filas = [...docs.querySelectorAll('ion-item, ion-row')]
            .filter(f => f.getBoundingClientRect().width > 0 && f.querySelector('ion-checkbox'));
          const fila = filas.find(f => /N\/C|nota de cr/i.test(f.textContent || ''));
          if (!fila) return { err: 'la lista no ofrece ninguna nota de credito' };
          const cb = fila.querySelector('ion-checkbox');
          cb.scrollIntoView({ block: 'center' });
          const r = cb.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2,
                   texto: (fila.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) };
        });
        if (nc.err) return nc;
        await pg.mouse.click(nc.x, nc.y, { delay: 100 });
        await pg.waitForTimeout(1600);
        return nc;
      }

      if (!conNC.length) {
        ['DM-COB-070', 'DM-COB-071'].forEach(id => v2(id,
          'Aviso de saldo a favor por nota de credito', 'N/A',
          'NO EJERCITABLE HOY: ningun cliente del equipo tiene factura libre Y nota de ' +
          'credito a la vez (notas con saldo a favor en el equipo: ' +
          (INV.ok ? INV.notasCredito.length : '?') + '). Se abre rechazando en la web ' +
          'los cobros «Por aprobar» que retienen esos documentos'));
      } else {
        // ── DM-COB-070 · la nota de credito se marca la ULTIMA ────────────────
        const b70 = await abrirCobroConDocumento(conNC, marcaF2('AV070'));
        if (!b70.ok) {
          v2('DM-COB-070', 'Aviso de saldo a favor · orden FACTURA -> NOTA DE CREDITO',
            'BLOCKED', faltaMateria(b70.motivo));
        } else {
          const m70 = await marcarNotaCredito();
          if (m70.err) {
            v2('DM-COB-070', 'Aviso de saldo a favor · orden FACTURA -> NOTA DE CREDITO',
              'BLOCKED', m70.err);
          } else {
            const av70 = await esperarAvisoSaldoFavor();
            juzgarAviso('DM-COB-070', 'Aviso de saldo a favor · orden FACTURA -> NOTA DE CREDITO',
              av70, 'nota marcada: "' + m70.texto + '"');
            if (av70.visible) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
          }
          await abandonarCobro().catch(() => {});
        }

        // ── DM-COB-071 · el excedente nace DESPUES, al aplicar el parcial ─────
        //    Es el orden que fallaba: el saldo a favor no lo produce un marcado.
        const b71 = await abrirCobroConDocumento(conNC, marcaF2('AV071'));
        if (!b71.ok) {
          v2('DM-COB-071', 'Aviso de saldo a favor · orden LOS DOS MARCADOS -> parcial DESPUES',
            'BLOCKED', faltaMateria(b71.motivo));
        } else {
          const m71 = await marcarNotaCredito();
          if (m71.err) {
            v2('DM-COB-071', 'Aviso de saldo a favor · orden LOS DOS MARCADOS -> parcial DESPUES',
              'BLOCKED', m71.err);
          } else {
            // Descartar el aviso del marcado: lo que se mide es el del PARCIAL.
            const previo = await esperarAvisoSaldoFavor(2500);
            if (previo.visible) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
            const det = await abrirDetalleDocumento();
            if (!det || det.err) {
              v2('DM-COB-071', 'Aviso de saldo a favor · orden LOS DOS MARCADOS -> parcial DESPUES',
                'BLOCKED', 'no se pudo abrir el detalle: ' + ((det && det.err) || 'sin lupa'));
            } else {
              const tg = await togglePagoParcial();
              if (tg && tg.err) {
                v2('DM-COB-071', 'Aviso de saldo a favor · orden LOS DOS MARCADOS -> parcial DESPUES',
                  'BLOCKED', tg.err);
              } else {
                const av71 = await esperarAvisoSaldoFavor();
                juzgarAviso('DM-COB-071',
                  'Aviso de saldo a favor · orden LOS DOS MARCADOS -> parcial DESPUES',
                  av71, 'nota: "' + m71.texto + '" · aviso al marcar: ' + (previo.visible ? 'si' : 'no'));
                if (av71.visible) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
              }
            }
          }
          await abandonarCobro().catch(() => {});
        }
      }
  } catch (e) {
    chequearCdp(e);
    ['DM-COB-063', 'DM-COB-064'].forEach(id => v2(id, id, 'BLOCKED', e.message));
    await abandonarCobro().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FAMILIA 4 · RETENCIÓN — nube, dígitos del comprobante y combinación
  //             (DM-COB-065 · DM-COB-066 · DM-COB-067)
  //
  // ⚠ `cobroRetencion = false` ⇒ el SUBMÓDULO «Retención» del menú no existe
  //   (eso es DM-COB-029, N/A). La retención de este cliente se hace DENTRO del
  //   cobro, en el detalle del documento — que es lo que se prueba aquí.
  //
  // 🔑 IVA e ISLR son DOS campos distintos y en la nube caen en DOS columnas
  //    distintas: `nu_amount_retention` (IVA) y `nu_amount_retention2` (ISLR).
  //    041/042 los medían en pantalla; aquí se comprueban por separado en la
  //    nube, con importes DISTINTOS entre sí para que no se puedan confundir.
  // ───────────────────────────────────────────────────────────────────────────
  const IDS_RET = ['DM-COB-065', 'DM-COB-066', 'DM-COB-067'];
  const nDigRet = Number(DATA.sizeRetention) || 14;

  /** Teclea un Nro. Comp Ret de N dígitos y dice qué hizo la app con él. */
  async function probarComprobante(nDigitos) {
    const valor = String(nDigitos === 0 ? '' : '1'.repeat(nDigitos));
    const esc = await escribirEnModal(/comp\s*ret/i, valor);
    await pg.waitForTimeout(1200);
    const foto = await fotoDetalle();
    const claves = Object.keys(foto.campos || {});
    const alerta = await readAlert();
    if (alerta) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
    return {
      tecleado: valor,
      quedo: esc.ok ? String(esc.despues == null ? '' : esc.despues) : null,
      error: esc.ok ? null : esc.err,
      ivaVisible:  claves.some(k => /retenido iva/i.test(k)),
      islrVisible: claves.some(k => /retenido islr/i.test(k)),
      alerta,
    };
  }

  try {
    abortarSiCdpCaido();
    if (!DATA.retencion || !DATA.userCanAddRetention) {
      IDS_RET.forEach(id => v2(id, id, 'N/A',
        `retencion=${DATA.retencion} · userCanAddRetention=${DATA.userCanAddRetention}`));
    } else if (!DATA.retentionDocTypeCR) {
      IDS_RET.forEach(id => v2(id, id, 'N/A',
        'retentionDocTypeCR=false ⇒ no existe la lupa que abre el detalle del documento'));
    } else if (DATA.dynamicRetentions) {
      IDS_RET.forEach(id => v2(id, id, 'N/A',
        'dynamicRetentions=true ⇒ el detalle usa el selector «Seleccione Retención», ' +
        'otro layout distinto del de campos fijos que implementa este guion'));
    } else {
      // ── DM-COB-066 · el comprobante exige EXACTAMENTE sizeRetention dígitos ─
      //
      // No envía nada: monta un cobro, prueba 4 / 5 / 6 dígitos en el mismo
      // detalle y lo abandona. Así no gasta documento.
      const comentJ = marcaF2('RET-DIG');
      const baseJ = await abrirCobroConDocumento(relevoConSaldo(20), comentJ);
      if (!baseJ.ok) {
        v2('DM-COB-066', `El Nro. de comprobante exige exactamente ${nDigRet} dígitos`,
          'BLOCKED', faltaMateria(baseJ.motivo));
        v2('DM-COB-068', 'IVA cobrado dentro del cobro', 'BLOCKED',
          faltaMateria('no se pudo montar el cobro donde mirar los campos de IVA'));
      } else {
        if (!(await abrirDetalleDocumento())) throw new Error('no abrió el detalle del documento (066)');

        const menos = await probarComprobante(nDigRet - 1);   // 4
        const justo = await probarComprobante(nDigRet);       // 5
        const mas   = await probarComprobante(nDigRet + 1);   // 6

        // ══════════════════════════════════════════════════════════════════
        // 🔑 EL ORÁCULO ES LA VALIDACIÓN, NO LA VISIBILIDAD DE LOS CAMPOS.
        //
        //    La primera versión de este caso exigía que con menos dígitos los
        //    campos de IVA/ISLR **no aparecieran**, y dio FAIL. Medido en la
        //    app: los campos aparecen en cuanto se escribe algo en el
        //    comprobante —da igual la longitud— y lo que hace cumplir el
        //    tamaño es una ALERTA al salir del campo:
        //      «El comprobante de retención debe tener una longitud de N caracteres»
        //    Es decir, la app sí exige los 5 dígitos, sólo que por validación y
        //    no ocultando campos. El FAIL era del guion: medía la señal
        //    equivocada. Ahora se mide la que gobierna de verdad.
        // ══════════════════════════════════════════════════════════════════
        const rxLongitud = /longitud|caracter|d[ií]gito/i;
        const avisa = (p) => !!(p.alerta && rxLongitud.test(p.alerta));
        const menosRechaza = avisa(menos);
        const justoAcepta  = !avisa(justo) && justo.ivaVisible && justo.islrVisible;
        const masRechaza   = avisa(mas) ||
          (mas.quedo !== null && String(mas.quedo).replace(/\D/g, '').length <= nDigRet);
        v2('DM-COB-066',
          `El Nro. de comprobante de retención exige exactamente ${nDigRet} dígitos (sizeRetention)`,
          (menosRechaza && justoAcepta && masRechaza) ? 'PASS' : 'FAIL',
          `con ${nDigRet - 1} dígitos ("${menos.tecleado}" → quedó "${menos.quedo}"): ` +
          `${menos.alerta ? `RECHAZA — "${menos.alerta}"` : 'sin aviso'} (IVA/ISLR visibles ${menos.ivaVisible}/${menos.islrVisible}) · ` +
          `con ${nDigRet} ("${justo.tecleado}" → quedó "${justo.quedo}"): ` +
          `${justo.alerta ? `RECHAZA — "${justo.alerta}"` : 'ACEPTA, sin aviso'} (IVA/ISLR ${justo.ivaVisible}/${justo.islrVisible}) · ` +
          `con ${nDigRet + 1} ("${mas.tecleado}" → quedó "${mas.quedo}"): ` +
          `${mas.alerta ? `RECHAZA — "${mas.alerta}"` : 'sin aviso'} (IVA/ISLR ${mas.ivaVisible}/${mas.islrVisible}) · ` +
          `🔑 la app exige el tamaño por VALIDACIÓN al salir del campo, no ocultando los campos de retención` +
          (menosRechaza ? '' : ` · 🔴 con ${nDigRet - 1} dígitos NO avisa: el tamaño no se exige`) +
          (justoAcepta ? '' : ` · 🔴 con los ${nDigRet} dígitos exactos no acepta o no habilita la retención`) +
          (masRechaza ? '' : ` · 🔴 con ${nDigRet + 1} dígitos ni avisa ni trunca: acepta un comprobante inválido`));

        // ── DM-COB-068 · IVA COBRADO (familia 5), medido aquí mismo ──────────
        //
        // 🔑 `userCanCollectIva = false` en el equipo. Pero una VG puede apagar
        //    un campo HOMÓNIMO distinto del que uno cree: en el cobro hay varios
        //    rótulos con «IVA» y sólo uno sería «cobrar IVA». Así que en vez de
        //    dar por supuesto el N/A, se MIRA qué campos con «IVA» existen y se
        //    deja escrito. Lo que sí debe existir es la RETENCIÓN de IVA (que es
        //    otra cosa, y la gobierna `retencion`, no `userCanCollectIva`).
        const ivaUI = await pg.evaluate(() => {
          const rot = (e) => String(e.getAttribute('label') || e.label || '').trim() ||
            ((e.closest('ion-col, ion-row, ion-item') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60);
          const vis = (e) => e.getBoundingClientRect().width > 0;
          const campos = [];
          for (const sel of ['ion-input', 'ion-select', 'ion-checkbox', 'ion-toggle']) {
            for (const e of [...document.querySelectorAll(sel)].filter(vis)) {
              const r = rot(e);
              if (/iva/i.test(r)) campos.push(`${sel}:"${r}"`);
            }
          }
          return campos;
        });
        const soloRetencion = ivaUI.every(c => /reten/i.test(c));
        v2('DM-COB-068', 'IVA cobrado («userCanCollectIva») dentro del cobro',
          !DATA.userCanCollectIva
            ? (soloRetencion ? 'N/A' : 'FAIL')
            : (ivaUI.length ? 'PASS' : 'FAIL'),
          `userCanCollectIva=${DATA.userCanCollectIva} (leído del EQUIPO) · tagIVA="${DATA.tagIVA || 'IVA'}" · ` +
          `campos con «IVA» visibles en el cobro y en el detalle del documento: ` +
          `${ivaUI.length ? ivaUI.join(' | ') : 'ninguno'} · ` +
          (!DATA.userCanCollectIva
            ? (soloRetencion
              ? 'N/A COMPROBADA EN LA UI, no supuesta: con la VG apagada no hay ningún campo para ' +
                'COBRAR IVA; los rótulos con «IVA» que quedan son los de RETENCIÓN de IVA, que es otra ' +
                'cosa y la gobierna `retencion`, no `userCanCollectIva` ⇒ la VG apaga el campo que debe. ' +
                'Cubrir el cobro de IVA exige un tenant con userCanCollectIva=true'
              : '🔴 userCanCollectIva=false pero hay un campo de IVA que NO es de retención: ' +
                'la VG no está apagando lo que debería')
            : 'la VG está encendida'));

        await abandonarCobro().catch(() => {});
      }

      // ── DM-COB-065 · IVA e ISLR, por SEPARADO, en la nube ──────────────────
      const comentK = marcaF2('RET-NUBE');
      const baseK = await abrirCobroConDocumento(relevoConSaldo(20), comentK);
      if (!baseK.ok) {
        v2('DM-COB-065', 'Retención IVA e ISLR verificadas por separado en la nube',
          'BLOCKED', faltaMateria(baseK.motivo));
      } else {
        const saldoK = baseK.saldo;
        if (!(await abrirDetalleDocumento())) throw new Error('no abrió el detalle (065)');
        const nroK = '1'.repeat(nDigRet);
        const escN = await escribirEnModal(/comp\s*ret/i, nroK);
        if (!escN.ok) throw new Error(`no se pudo escribir el Nro. Comp Ret: ${escN.err}`);
        // 🔑 Importes DISTINTOS entre sí y con céntimos propios: si el guion
        //    pusiera el mismo número en los dos, una app que escribiera el IVA
        //    en las dos columnas daría PASS igual. Así no.
        const ivaK  = Math.max(0.11, Math.round(saldoK * 0.10 * 100) / 100);
        const islrK = Math.max(0.07, Math.round(saldoK * 0.03 * 100) / 100);
        const eI = await escribirEnModal(/retenido iva/i,  String(Math.round(ivaK  * 100)));
        const eS = await escribirEnModal(/retenido islr/i, String(Math.round(islrK * 100)));
        await pg.evaluate(() => {
          const m = [...document.querySelectorAll('ion-modal')].filter(x => x.getBoundingClientRect().width > 0).pop();
          if (!m) return;
          const d = [...m.querySelectorAll('ion-datetime')].pop();
          if (!d) return;
          const iso = new Date().toISOString().slice(0, 10) + 'T00:00:00';
          d.value = iso;
          d.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: iso } }));
        });
        await pg.waitForTimeout(1000);
        const cerrK = await cerrarDetalleGuardando();
        if (!cerrK.ok) throw new Error(`el detalle no se guardó: ${cerrK.motivo}`);
        await clickTab('pagos');
        await pg.waitForTimeout(1600);
        const pagoK = await agregarPagoEfectivo();
        if (!pagoK.ok) throw new Error(`no se pudo pagar: ${pagoK.error}`);
        // 🔑 GUARDAR, no enviar: ver detalleLocal(). Enviar exigiría un adjunto
        //    real, y el inyectado no sobrevive a la subida. Se deja Guardado
        //    para que QA lo envíe a mano — y de paso NO se gasta el documento.
        const guaK = await guardarCobro();
        await abandonarCobro().catch(() => {});
        const detK = detalleLocal(comentK);
        const fK = Array.isArray(detK) && detK.length ? detK[0] : null;

        // Las dos columnas, leídas por separado. Se admite el par alternativo
        // (`nu_amount_retention_iva`/`_islr`) porque el esquema trae los dos.
        const nubeIVA  = fK ? Number(fK.nu_amount_retention)  : null;
        const nubeISLR = fK ? Number(fK.nu_amount_retention2) : null;
        const ivaOk  = nubeIVA  !== null && Math.abs(nubeIVA  - ivaK)  < 0.02;
        const islrOk = nubeISLR !== null && Math.abs(nubeISLR - islrK) < 0.02;
        const compOk = fK && String(fK.nu_voucher_retention || '').replace(/\D/g, '') === nroK;

        // 🔑 Los DOS importes se comprueban por SEPARADO y son distintos entre sí:
        //    una app que escribiera el IVA en las dos columnas daría FAIL aquí.
        v2('DM-COB-065',
          `Retención: IVA (${ivaK.toFixed(2)}) e ISLR (${islrK.toFixed(2)}) se guardan en columnas SEPARADAS (nu_amount_retention / nu_amount_retention2)`,
          !guaK.ok ? 'BLOCKED' : ((ivaOk && islrOk && compOk) ? 'PASS' : 'FAIL'),
          `saldo ${saldoK.toFixed(2)} · comprobante ${nroK} · ` +
          `tecleado IVA ${ivaK.toFixed(2)} / ISLR ${islrK.toFixed(2)} (importes DISTINTOS a propósito: ` +
          `si la app escribiera el mismo en las dos columnas, esto falla) · ` +
          `guardado: ${guaK.ok ? 'sí' : `NO — alerta "${guaK.alerta || 'ninguna'}"`} · ` +
          `📄 registro persistido (collection_details del equipo): ` +
          `nu_amount_retention=${fK ? fK.nu_amount_retention : '—'} · ` +
          `nu_amount_retention2=${fK ? fK.nu_amount_retention2 : '—'} · ` +
          `nu_voucher_retention=${fK ? fK.nu_voucher_retention : '—'} · ` +
          `st_collection=${fK ? fK.st_collection : '—'} · ` +
          (eI.ok && eS.ok ? '' : ` · ⚠ escritura IVA:${eI.err || 'ok'} ISLR:${eS.err || 'ok'}`) +
          (ivaOk  ? '' : ' · 🔴 la retención de IVA no quedó en nu_amount_retention') +
          (islrOk ? '' : ' · 🔴 la retención de ISLR no quedó en nu_amount_retention2') +
          (compOk ? '' : ' · 🔴 el nº de comprobante no coincide con lo tecleado') +
          ' · ⚠ LA MITAD «NUBE» DE ESTE CASO QUEDA PENDIENTE Y ES DELIBERADO: la app exige un ' +
          'ADJUNTO para enviar cualquier cobro con retención (NO_ATTACHMENTS_RETENTION, sin VG que ' +
          'lo gobierne) y un adjunto inyectado no sobrevive al envío — los dos únicos cobros del ' +
          '15/09 con has_attachments=true fueron los dos únicos que NO llegaron a la nube. El cobro ' +
          'se deja GUARDADO para que QA lo envíe A MANO con una foto real y se cotejen entonces ' +
          'nu_amount_retention / nu_amount_retention2 en la nube');
      }

      // ── DM-COB-067 · retención Y pago parcial en el MISMO documento ────────
      if (!DATA.enablePartialPayment) {
        v2('DM-COB-067', 'Retención + pago parcial en el mismo documento', 'N/A',
          'enablePartialPayment=false ⇒ no hay pago parcial que combinar');
      } else {
        const comentL = marcaF2('RET-PARC');
        const baseL = await abrirCobroConDocumento(relevoConSaldo(20), comentL);
        if (!baseL.ok) {
          v2('DM-COB-067', 'Retención + pago parcial en el mismo documento', 'BLOCKED',
            faltaMateria(baseL.motivo));
        } else {
          const saldoL = baseL.saldo;
          if (!(await abrirDetalleDocumento())) throw new Error('no abrió el detalle (067)');
          // Primero la retención (el comprobante es lo que HACE APARECER los campos),
          // después el toggle de parcial y el monto: al revés, el reset a 0,00 del
          // toggle borraría lo escrito.
          const nroL = '1'.repeat(nDigRet);
          await escribirEnModal(/comp\s*ret/i, nroL);
          const ivaL  = Math.max(0.13, Math.round(saldoL * 0.08 * 100) / 100);
          const islrL = Math.max(0.09, Math.round(saldoL * 0.02 * 100) / 100);
          const eIL = await escribirEnModal(/retenido iva/i,  String(Math.round(ivaL  * 100)));
          const eSL = await escribirEnModal(/retenido islr/i, String(Math.round(islrL * 100)));
          const tgL = await togglePagoParcial();
          if (tgL.err) throw new Error(tgL.err);
          const parcialL = Math.max(1.37, Math.round(saldoL * 0.30 * 100) / 100);
          const escL = await escribirEnModal(/monto a pagar/i, String(Math.round(parcialL * 100)));
          const fotoL = await fotoDetalle();
          const kIVA  = Object.keys(fotoL.campos || {}).find(k => /retenido iva/i.test(k));
          const kISLR = Object.keys(fotoL.campos || {}).find(k => /retenido islr/i.test(k));
          const sobrevivenEnPantalla =
            montoANumero(kIVA ? fotoL.campos[kIVA].val : null) > 0 &&
            montoANumero(kISLR ? fotoL.campos[kISLR].val : null) > 0;

          const cerrL = await cerrarDetalleGuardando();
          if (!cerrL.ok) throw new Error(`el detalle no se guardó: ${cerrL.motivo}`);
          await clickTab('pagos');
          await pg.waitForTimeout(1600);
          const totalL = (await leerPagosSticky()).total;
          const pagoL = await agregarPagoEfectivo();
          if (!pagoL.ok) throw new Error(`no se pudo pagar: ${pagoL.error}`);
          // Mismo motivo que en 065: con retención la app exige adjunto para
          // enviar, así que se GUARDA y el oráculo es el registro persistido.
          const guaL = await guardarCobro();
          await abandonarCobro().catch(() => {});
          const detL = detalleLocal(comentL);
          const fL = Array.isArray(detL) && detL.length ? detL[0] : null;
          const nIVA  = fL ? Number(fL.nu_amount_retention)  : null;
          const nISLR = fL ? Number(fL.nu_amount_retention2) : null;
          const parcialOk = fL && (fL.in_payment_partial === true || String(fL.in_payment_partial) === 'true');
          const pagoMenorL = fL && Number(fL.nu_amount_paid) < Number(fL.nu_amount_doc) - 0.005;
          const retOk = nIVA !== null && Math.abs(nIVA - ivaL) < 0.02 &&
                        nISLR !== null && Math.abs(nISLR - islrL) < 0.02;

          v2('DM-COB-067',
            `Retención (IVA ${ivaL.toFixed(2)} + ISLR ${islrL.toFixed(2)}) Y pago parcial (${parcialL.toFixed(2)}) conviven en el MISMO documento`,
            !guaL.ok ? 'BLOCKED' : ((parcialOk && retOk && pagoMenorL) ? 'PASS' : 'FAIL'),
            `saldo ${saldoL.toFixed(2)} · comprobante ${nroL} · parcial tecleado ${parcialL.toFixed(2)} ` +
            `(quedó "${escL.despues}") · los importes de retención siguen puestos tras encender el ` +
            `toggle: ${sobrevivenEnPantalla} · «Monto total a pagar»: ${totalL || '—'} · ` +
            `guardado: ${guaL.ok ? 'sí' : `NO — alerta "${guaL.alerta || 'ninguna'}"`} · ` +
            `📄 registro persistido: in_payment_partial=${fL ? fL.in_payment_partial : '—'} · ` +
            `nu_amount_paid=${fL ? fL.nu_amount_paid : '—'} · nu_amount_doc=${fL ? fL.nu_amount_doc : '—'} · ` +
            `nu_balance_doc=${fL ? fL.nu_balance_doc : '—'} · ` +
            `nu_amount_retention=${fL ? fL.nu_amount_retention : '—'} · ` +
            `nu_amount_retention2=${fL ? fL.nu_amount_retention2 : '—'} · ` +
            `nu_voucher_retention=${fL ? fL.nu_voucher_retention : '—'}` +
            (eIL.ok && eSL.ok ? '' : ` · ⚠ escritura IVA:${eIL.err || 'ok'} ISLR:${eSL.err || 'ok'}`) +
            (parcialOk ? '' : ' · 🔴 el registro no marca el detalle como pago parcial') +
            (pagoMenorL ? '' : ' · 🔴 se guardó el documento entero, no el parcial') +
            (retOk ? '' : ' · 🔴 las retenciones no quedaron guardadas junto con el pago parcial') +
            ' · ⚠ igual que 065, la mitad «nube» queda pendiente a propósito: con retención la app ' +
            'exige adjunto para enviar y el inyectado no sobrevive. Se deja GUARDADO para envío manual');
        }
      }
    }
  } catch (e) {
    chequearCdp(e);
    IDS_RET.concat(['DM-COB-068']).forEach(id => v2(id, id, 'BLOCKED', e.message));
    await abandonarCobro().catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // FAMILIA 2 (cierre) · ¿es ejercitable el descuento por PORCENTAJE?
  //
  // ⚠ `maxCollectDiscount = 0` en el EQUIPO (el YAML decía 85). `run.js` hace
  //   `Number(x) || 100`, que convierte ese 0 en 100 — eso es una DECISIÓN del
  //   guion, no un valor configurado. Con el catálogo de 4K (10 % y 80 %) no hay
  //   forma de pasarse de 100 %, así que el caso del TOPE no puede fallar.
  //   Un caso que no puede fallar no es un PASS: queda dicho aquí, con números.
  // ───────────────────────────────────────────────────────────────────────────
  try {
    const topeCrudo = DATA.maxCollectDiscount;
    const topeUsado = Number(topeCrudo) || 100;
    const cat = (catalogoDescuentos || []).map(d => `${d.pct}%`).join(' + ');
    const suma = (catalogoDescuentos || []).reduce((a, d) => a + (Number(d.pct) || 0), 0);
    const ejercitable = !!catalogoDescuentos && suma > topeUsado;
    v2('DM-COB-069', 'Descuento por PORCENTAJE: ¿es ejercitable el tope con esta configuración?',
      ejercitable ? 'PASS' : 'N/A',
      `maxCollectDiscount en el EQUIPO = ${topeCrudo === undefined ? '(no leído)' : topeCrudo} · ` +
      `el guion lo trata como ${topeUsado}% — y NO es una suposición del guion: ` +
      `lo hace la propia app (collection-logic.service.ts: «if (maxCollectDiscount <= 0) ` +
      `maxCollectDiscount = 100»), así que con la VG en 0 el tope EFECTIVO es 100% · ` +
      `catálogo real de 4K leído en la UI: ${cat || '(no se pudo leer)'} ` +
      `(suma máxima alcanzable ${suma}%) · ` +
      (ejercitable
        ? `${suma}% > ${topeUsado}% ⇒ el tope SÍ se puede superar y DM-COB-050/051/052 miden algo`
        : `${suma}% ≤ ${topeUsado}% ⇒ NO HAY FORMA DE SUPERAR EL TOPE: DM-COB-050/051/052 no ` +
          `pueden fallar y por tanto no son un PASS · el descuento por MONTO sí es ejercitable y ` +
          `queda cubierto en DM-COB-061/062 · para cubrir el tope por porcentaje haría falta, POR WEB ` +
          `(prohibido en este encargo): bajar maxCollectDiscount por debajo de ${Math.max(...(catalogoDescuentos || [{pct:0}]).map(d => Number(d.pct) || 0))}, ` +
          `o crear un descuento con «Porcentaje Manual = SÍ»`));
  } catch (e) {
    v2('DM-COB-069', 'Descuento por porcentaje: ejercitabilidad del tope', 'BLOCKED', e.message);
  }

  // ─── Fase 2: marcar pendientes ────────────────────────────────────────────────
  FASE2.forEach(id => {
    if (!verdicts.find(x => x.id === id)) v(id, id, 'BLOCKED', 'Fase 2 — pendiente de construir/depurar en device');
  });

  // ─── Casos nuevos que no llegaron a ejecutarse ────────────────────────────────
  // 🔑 El motivo NO puede ser mudo. Si un caso nuevo se queda fuera es, casi
  //    siempre, porque la cartera de documentos se agotó antes de llegar a él —
  //    y ésa es exactamente la información que hacía falta y no estaba. Se
  //    escribe el inventario del arranque para que se pueda decidir sin volver
  //    a correr nada.
  NUEVOS.forEach(id => {
    if (!verdicts.find(x => x.id === id)) {
      v(id, id, 'BLOCKED', cdpCaido
        ? 'NO SE MIDIÓ: la conexión CDP se cayó durante la vuelta (la app o el puente adb se ' +
          'reiniciaron). No es un fallo del caso ni falta de datos: hay que reponer el puente y repetir'
        : 'el caso no llegó a ejecutarse (el flujo que lo contiene se cortó antes) · ' +
          `📋 documentos libres al arrancar: ${INV.ok ? INV.resumen : 'no se pudo leer el equipo'}`);
    }
  });

  // Volver a HOME de la app
  try { await irAHomeCobros(); await clickBack(); await pg.waitForTimeout(1200); } catch (_) {}

  return { verdicts, msTotal: Date.now() - t0 };
}

module.exports = { runCobros: conReq('COB', runCobros) };
