'use strict';
/**
 * cobertura.js — con esta configuración, ¿qué se puede probar DE VERDAD?
 *
 * Corre en el pre-vuelo, junto al contraste de VGs, y responde una pregunta que
 * hasta ahora se contestaba tarde y a mano: de los casos del guión, ¿cuáles son
 * ejercitables con la configuración que tiene hoy este cliente, cuáles no, y qué
 * habría que tocar para desbloquearlos.
 *
 * 🔑 POR QUÉ EXISTE — el PASS falso
 * Un caso que **no puede fallar** con la configuración actual y no falla, se
 * reporta en verde y no ha probado nada. Es peor que un rojo: un rojo se
 * investiga, un verde falso se archiva.
 *
 *   · 4K, septiembre 2026: `maxCollectDiscount` en 85 % y el catálogo de
 *     descuentos con UNA sola fila del 80 %. El tope es inalcanzable por UI,
 *     así que «no deja pasar del tope» pasaba sin ejercitarse nunca.
 *   · La familia K## de escapes de la v21 nació de lo mismo: se validaba
 *     PRESENCIA («el campo está») en vez de CONFORMIDAD con la configuración.
 *
 * 🔴 N/A POR DISEÑO ≠ NO ALCANZABLE. Son cosas distintas y el informe las tiene
 *    que distinguir:
 *      ⚪ N/A por diseño  — el cliente no tiene esa funcionalidad (IGTF apagado).
 *                          No es deuda: no aplica y nunca aplicará aquí.
 *      🚫 No alcanzable   — la funcionalidad existe, pero los valores actuales
 *                          impiden construir el caso. Es DEUDA DE COBERTURA,
 *                          y se salda cambiando algo.
 *
 * 🔑 LA LÍNEA QUE IMPORTA ES «se abre».
 *    Avisar de que falta cobertura sirve de poco; decir qué hay que cambiar para
 *    conseguirla convierte el aviso en una tarea de dos minutos antes de correr.
 *
 * ⚠ LOS VALORES LOS MANDA EL EQUIPO, NO LA BD NI EL YAML.
 *   `global_configuration` es un catálogo (valor='true' significa «la variable
 *   existe»), no el valor efectivo. Quien llame a esto pasa las VGs ya leídas del
 *   dispositivo — el YAML se vence, y es justo lo que se vencía el 07/09.
 *
 * ── ESTADO ──────────────────────────────────────────────────────────────────
 * ESQUELETO, 10/09/2026. La mecánica está completa; los requisitos de cada caso
 * se afinan con lo que descubran las tandas de validación de cobros
 * (`automation/reports/4k/fixes_cobros_20260910/`). Cada informe cierra con una
 * sección «Para el script de cobros»: de ahí salen los `necesita` reales.
 */

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Los valores llegan como texto («85», «49,99»); aquí se comparan como números. */
const num = (v) => {
  if (v === undefined || v === null || v === '') return NaN;
  return Number(String(v).replace(',', '.'));
};

const activa = (v) => v === true || v === 'true';

// ── La tabla ────────────────────────────────────────────────────────────────
/**
 * Cada caso declara:
 *   id / caso   qué se prueba
 *   necesita    la condición, en lenguaje humano — sale en el informe
 *   naSi        (ctx) => true  ⇒ ⚪ N/A por diseño, con `naMotivo`
 *   evaluar     (ctx) => true  ⇒ ✅ ejercitable
 *   hoy         (ctx) => texto con los valores reales, para que se vea el porqué
 *   seAbre      qué hay que cambiar para desbloquearlo
 *
 * `ctx` = { vgs, catalogo } — `vgs` leídas del equipo; `catalogo` son los datos
 * del cliente que condicionan un caso (descuentos, códigos de diferencia…).
 */
const REQUISITOS = {
  cobros: [
    {
      id: 'COB-DESC-TOPE',
      caso: 'El tope de descuento de cobro rechaza lo que lo supera',
      necesita: 'que la suma de descuentos del catálogo pueda superar maxCollectDiscount',
      naSi: (c) => !activa(c.vgs.userCanSelectCollectDiscount),
      naMotivo: 'userCanSelectCollectDiscount=false ⇒ no hay botón «Asignar descuento»',
      evaluar: (c) => num(c.catalogo.sumaMaxDescuentos) > num(c.vgs.maxCollectDiscount),
      hoy: (c) => `catálogo suma hasta ${c.catalogo.sumaMaxDescuentos}% · tope ${c.vgs.maxCollectDiscount}%`,
      seAbre: 'bajar maxCollectDiscount por debajo de lo que suma el catálogo, o crear más descuentos en Empresa → Configuración → Descuentos para Cobros (y SINCRONIZAR)',
    },
    {
      id: 'COB-TOL-DENTRO',
      caso: 'Diferencia dentro de tolerancia ⇒ se envía',
      necesita: 'tolerancia positiva mayor que 0',
      naSi: (c) => !activa(c.vgs.tolerancia0),
      naMotivo: 'tolerancia0=false ⇒ el cobro tiene que cerrar en 0 exacto',
      evaluar: (c) => num(c.vgs.RangoToleranciaPositiva) > 0,
      hoy: (c) => `RangoToleranciaPositiva = ${c.vgs.RangoToleranciaPositiva} ${c.vgs.MonedaTolerancia || ''}`,
      seAbre: 'poner una tolerancia positiva mayor que 0 en Variables Globales → Cobros',
    },
    {
      id: 'COB-TOL-BANDA',
      // 🔑 umbral del anticipo = tolerancia positiva + mínimo de anticipo (NO el mínimo solo)
      caso: 'Banda que excede tolerancia y no alcanza el anticipo ⇒ bloquea',
      necesita: 'una banda medible entre la tolerancia y el umbral del anticipo',
      naSi: (c) => !activa(c.vgs.automatedPrepaid),
      naMotivo: 'automatedPrepaid=false ⇒ no hay anticipo automático y la banda no existe',
      evaluar: (c) => num(c.vgs.prepaidRangeAmount) >= 1,
      hoy: (c) => `banda de ${c.vgs.prepaidRangeAmount} (de ${c.vgs.RangoToleranciaPositiva} a ${num(c.vgs.RangoToleranciaPositiva) + num(c.vgs.prepaidRangeAmount)})`,
      seAbre: 'subir prepaidRangeAmount a 1 o más para que la banda sea medible. ⚠ Si se está probando el fix que la reduce al mínimo, esta falta de cobertura es la ESPERADA: anotarla, no arreglarla',
    },
    {
      id: 'COB-ANT-AUTO',
      caso: 'Excedente por encima del umbral ⇒ anticipo automático',
      necesita: 'anticipo automático activo y submódulo de anticipo disponible',
      naSi: (c) => !activa(c.vgs.cobroPrepago),
      naMotivo: 'cobroPrepago=false ⇒ el submódulo «Anticipo» no está en el menú',
      evaluar: (c) => activa(c.vgs.automatedPrepaid),
      hoy: (c) => `automatedPrepaid=${c.vgs.automatedPrepaid} · umbral = ${num(c.vgs.RangoToleranciaPositiva) + num(c.vgs.prepaidRangeAmount)} ${c.vgs.prepaidRangeCurrency || ''}`,
      seAbre: 'activar automatedPrepaid en Variables Globales → Cobros',
    },
    {
      id: 'COB-ANT-DESC',
      caso: 'Descuento mayor que el saldo del documento ⇒ anticipo por el excedente',
      necesita: 'descuentos de cobro activos y anticipo disponible',
      naSi: (c) => !activa(c.vgs.userCanSelectCollectDiscount) || !activa(c.vgs.cobroPrepago),
      naMotivo: 'hace falta el descuento de cobro Y el anticipo; falta al menos uno',
      evaluar: (c) => num(c.catalogo.maxDescuentoUnitario) > 0,
      hoy: (c) => `mayor descuento del catálogo: ${c.catalogo.maxDescuentoUnitario}%`,
      seAbre: 'crear un descuento alto para que supere el saldo de un documento pequeño',
    },
    {
      id: 'COB-NC-OTROS',
      caso: 'Facturas + notas de crédito con saldo a favor ⇒ anticipo con «Otros» y código de diferencia',
      necesita: 'método de pago «Otros» habilitado y al menos un código de diferencia creado',
      naSi: (c) => !activa(c.vgs.enableDifferenceCodes),
      naMotivo: 'enableDifferenceCodes=false ⇒ no hay selector de códigos de diferencia',
      evaluar: (c) => c.catalogo.tieneMetodoOtros === true && num(c.catalogo.codigosDiferencia) > 0,
      hoy: (c) => `método «Otros»: ${c.catalogo.tieneMetodoOtros ? 'sí' : 'no'} · códigos de diferencia: ${c.catalogo.codigosDiferencia}`,
      seAbre: 'habilitar el método «Otros» y crear un código en Empresa → Configuración → Códigos de diferencia (y SINCRONIZAR)',
    },
    {
      id: 'COB-IGTF',
      caso: 'IGTF sobre el total a pagar',
      necesita: 'IGTF visible en el cobro',
      naSi: (c) => !activa(c.vgs.userCanSelectIGTF),
      naMotivo: 'userCanSelectIGTF=false ⇒ el IGTF no se muestra en este cliente',
      evaluar: () => true,
      hoy: (c) => `userCanSelectIGTF=${c.vgs.userCanSelectIGTF}`,
      seAbre: 'activar userCanSelectIGTF',
    },
    {
      id: 'COB-ADJUNTO',
      caso: 'Adjunto obligatorio para enviar el cobro',
      necesita: 'requiredCollectionAttachments activo',
      naSi: (c) => !activa(c.vgs.requiredCollectionAttachments),
      naMotivo: 'requiredCollectionAttachments=false ⇒ el cobro se envía sin adjunto',
      evaluar: () => true,
      hoy: (c) => `requiredCollectionAttachments=${c.vgs.requiredCollectionAttachments}`,
      seAbre: 'activarlo. ⚠ Con esto encendido el envío exige adjunto: el script deja el cobro en Guardado y lo envía QA a mano',
    },
    {
      id: 'COB-RETENCION',
      caso: 'Retención dentro del cobro, con el largo exacto del comprobante',
      necesita: 'retención activa y sizeRetention definido',
      naSi: (c) => !activa(c.vgs.retencion),
      naMotivo: 'retencion=false ⇒ no hay campo de retención en el cobro',
      evaluar: (c) => num(c.vgs.sizeRetention) > 0,
      hoy: (c) => `retencion=${c.vgs.retencion} · sizeRetention=${c.vgs.sizeRetention}`,
      seAbre: 'definir sizeRetention (dígitos EXACTOS que exige el comprobante)',
    },
    {
      id: 'COB-MULTIMONEDA',
      caso: 'Cobro con mezcla de monedas',
      necesita: 'multimoneda activa en cobros y al menos dos monedas disponibles',
      naSi: (c) => !activa(c.vgs.multiCurrencyCollection),
      naMotivo: 'multiCurrencyCollection=false ⇒ una sola moneda',
      evaluar: (c) => num(c.catalogo.monedas) >= 2,
      hoy: (c) => `monedas disponibles: ${c.catalogo.monedas}`,
      seAbre: 'habilitar una segunda moneda. ⚠ Sin mezcla de monedas el cotejo de montos NO prueba nada: da igual sumar el campo correcto que el equivocado',
    },
    {
      id: 'COB-CUENTA-CLIENTE',
      caso: 'Selector de cuenta bancaria del cliente',
      necesita: 'clientBankAccount activo y cuentas cargadas para el cliente',
      naSi: (c) => !activa(c.vgs.clientBankAccount),
      naMotivo: 'clientBankAccount=false ⇒ no se ofrece cuenta del cliente',
      evaluar: (c) => num(c.catalogo.cuentasCliente) > 0,
      hoy: (c) => `cuentas del cliente: ${c.catalogo.cuentasCliente}`,
      seAbre: 'cargar al menos una cuenta bancaria al cliente de prueba',
    },
  ],
};

// ── Evaluación ──────────────────────────────────────────────────────────────

/**
 * @param {string} modulo   'cobros'
 * @param {{vgs:object, catalogo:object}} ctx  VGs leídas DEL EQUIPO + datos del cliente
 */
function evaluarCobertura(modulo, ctx) {
  const casos = REQUISITOS[modulo] || [];
  const c = { vgs: (ctx && ctx.vgs) || {}, catalogo: (ctx && ctx.catalogo) || {} };

  const ejercitables = [], noAlcanzables = [], naPorDiseno = [];

  for (const caso of casos) {
    // ⚠ Un dato que falta NO es un caso ejercitable: cae en «no alcanzable» con
    //   su motivo. Dar por bueno lo que no se midió es el error que esto evita.
    let veredicto;
    try {
      if (caso.naSi && caso.naSi(c)) veredicto = 'na';
      else veredicto = caso.evaluar(c) ? 'ok' : 'no';
    } catch (_) {
      veredicto = 'no';
    }
    const detalle = (() => { try { return caso.hoy(c); } catch (_) { return 'sin datos'; } })();

    if (veredicto === 'na')      naPorDiseno.push({ ...caso, detalle });
    else if (veredicto === 'ok') ejercitables.push({ ...caso, detalle });
    else                         noAlcanzables.push({ ...caso, detalle });
  }

  const lineas = [];
  lineas.push(`COBERTURA · ${modulo}`);
  lineas.push(`  ✅ ejercitables ............ ${ejercitables.length}`);
  lineas.push(`  🚫 no alcanzables .......... ${noAlcanzables.length}`);
  for (const n of noAlcanzables) {
    lineas.push(`       ${n.id}  ${n.caso}`);
    lineas.push(`         necesita: ${n.necesita}`);
    lineas.push(`         hoy:      ${n.detalle}`);
    lineas.push(`         se abre:  ${n.seAbre}`);
  }
  lineas.push(`  ⚪ N/A por diseño .......... ${naPorDiseno.length}`);
  for (const n of naPorDiseno) lineas.push(`       ${n.id}  ${n.naMotivo}`);

  const resumen = `${ejercitables.length} ejercitables · ${noAlcanzables.length} no alcanzables · ${naPorDiseno.length} N/A`;
  return { ejercitables, noAlcanzables, naPorDiseno, lineas, resumen };
}

/** Markdown para dejar junto al informe de la corrida. */
function coberturaMarkdown(modulo, cliente, r) {
  const md = [
    `# Cobertura · ${modulo} · ${cliente}`, '',
    `**${r.resumen}**`, '',
    '> Un caso **no alcanzable** no es un N/A: la funcionalidad existe y son los',
    '> valores de hoy los que impiden construir el caso. Es deuda de cobertura, y',
    '> la columna «se abre» dice cómo saldarla.', '',
    '| Estado | Caso | Hoy | Se abre cambiando |', '|---|---|---|---|',
  ];
  for (const n of r.noAlcanzables) md.push(`| 🚫 | **${n.caso}** | ${n.detalle} | ${n.seAbre} |`);
  for (const n of r.naPorDiseno)   md.push(`| ⚪ | ${n.caso} | ${n.naMotivo} | — |`);
  for (const n of r.ejercitables)  md.push(`| ✅ | ${n.caso} | ${n.detalle} | — |`);
  md.push('');
  return md.join('\n');
}

module.exports = { evaluarCobertura, coberturaMarkdown, REQUISITOS };
