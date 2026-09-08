'use strict';
/**
 * oraculo.js — el oráculo del Pedido Sugerido de HIDROPONIAS.
 *
 * Calcula, leyendo la MISMA base de datos que consulta la app (el SQLite del
 * teléfono), qué debe mostrar cada término del sugerido. El script conduce la
 * UI y compara contra esto.
 *
 * 🔑 POR QUÉ SE CALCULA Y NO SE ESCRIBE EN EL YAML
 * Los datos de hidroponias cambian solos: hoy Páramo tiene tres facturas del
 * 07/09, en dos semanas tendrá otras y el producto que hoy vale 261 valdrá otra
 * cosa. Un número escrito a mano en el perfil nace vencido, y un oráculo vencido
 * produce FAILs que no son defectos — o peor, PASSes que no probaron nada.
 * Aquí se descubre el escenario y se calcula el valor esperado en cada corrida.
 *
 * 🔴 Y SE ELIGE EL CLIENTE DESDE EL EQUIPO, NO DESDE LA NUBE.
 * El 08/09 elegimos dos clientes preciosos consultando la nube y ninguno servía:
 * uno era de otro vendedor y el otro no tenía vendedor asignado, así que no
 * bajaban al dispositivo. La app solo ve lo que está en su SQLite.
 *
 * Uso desde el módulo:
 *     const { elegirEscenario, oraculoDespacho, oraculoTerminos } = require('../../sugerido/oraculo');
 *
 * Uso a mano (diagnóstico):
 *     node automation/sugerido/oraculo.js
 *     node automation/sugerido/oraculo.js --cliente 680
 */

const { execFileSync } = require('child_process');
const path = require('path');

const LOCAL_QUERY = path.resolve(__dirname, '..', 'db', 'local-query.js');

function q(sql) {
  try {
    const out = execFileSync('node', [LOCAL_QUERY, sql], {
      encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024,
    });
    const r = JSON.parse(out);
    return Array.isArray(r) ? r : [];
  } catch (e) {
    return { _error: String((e.stdout || e.message || '')).slice(0, 300) };
  }
}

const esError = (r) => !Array.isArray(r);

// ── 1 · ¿Está el equipo listo? ───────────────────────────────────────────────
/**
 * Comprueba lo que el guión da por sentado antes de medir nada:
 * que la migración v22 corrió y que hay facturas con las que trabajar.
 */
function verificarBase() {
  const tablas = q(
    "select name from sqlite_master where type='table' " +
    "and name in ('client_stock_suggested_orders','client_stock_suggested_order_details')"
  );
  if (esError(tablas)) return { ok: false, motivo: `no se pudo leer la BD local: ${tablas._error}` };

  const nombres = tablas.map(t => t.name);
  const faltan = ['client_stock_suggested_orders', 'client_stock_suggested_order_details']
    .filter(n => !nombres.includes(n));
  if (faltan.length) {
    return {
      ok: false,
      motivo: `la migración v22 no corrió: falta(n) ${faltan.join(' y ')}. ` +
              'La APK no es de la rama SaveSuggestedOrder, o no se abrió la app tras instalarla',
    };
  }

  const vol = q('select (select count(*) from invoices) as facturas, ' +
                '(select count(*) from clients) as clientes, ' +
                '(select max(substr(da_invoice,1,10)) from invoices) as ultima');
  if (esError(vol) || !vol.length) return { ok: false, motivo: 'no se pudo medir el volumen local' };

  const v = vol[0];
  if (!v.facturas) {
    return { ok: false, motivo: 'el equipo no tiene facturas: sin ellas el despacho es 0 en todo y nada es medible' };
  }
  return { ok: true, facturas: v.facturas, clientes: v.clientes, ultimaFactura: v.ultima };
}

// ── 2 · Elegir el cliente con el mejor escenario ─────────────────────────────
/**
 * Devuelve los clientes del equipo ordenados por qué tan bien ejercitan el REQ.
 *
 * Lo que hace fuerte a un escenario, en orden:
 *   1. que un mismo producto se repita entre facturas del día  → prueba la SUMA
 *   2. cuántas facturas tiene ese día                          → prueba que sean TODAS
 *   3. que haya AMBOS roles: productos ocultos por el bug Y productos de control
 *   4. cuántos productos ocultaba el bug
 *
 * 🔴 El punto 3 no estaba y produce escenarios engañosos. La primera versión
 *    eligió un cliente con 16 productos ocultos y UN control: prueba de sobra
 *    que el fix rescata cantidades, y casi nada que no haya roto lo que ya
 *    funcionaba. Un escenario sin controles no puede detectar una regresión.
 *
 * ⚠ La consolidación filtra por cliente Y SUCURSAL (`id_client` + `id_address_client`),
 *   así que el escenario se arma por sucursal, no por cliente.
 */
function elegirEscenario() {
  const filas = q(`
    with ult as (
      select id_client, id_address_client, max(substr(da_invoice,1,10)) as f
      from invoices group by 1,2
    ),
    dia as (
      select i.id_client, i.id_address_client, u.f, i.id_invoice, i.da_invoice,
             du.id_product_unit, du.co_product_unit, du.qu_invoice
      from ult u
      join invoices i on i.id_client = u.id_client
                     and i.id_address_client = u.id_address_client
                     and substr(i.da_invoice,1,10) = u.f
      join invoice_details d on d.id_invoice = i.id_invoice
      join invoice_detail_units du on du.id_invoice_detail = d.id_invoice_detail
    ),
    rep as (
      select id_client, id_address_client, id_product_unit,
             count(distinct id_invoice) as veces
      from dia group by 1,2,3
    ),
    gana as (
      select id_client, id_address_client, id_invoice,
             row_number() over (partition by id_client, id_address_client
                                order by da_invoice desc, id_invoice desc) as rn
      from (select distinct id_client, id_address_client, id_invoice, da_invoice from dia)
    ),
    roles as (
      select dia.id_client, dia.id_address_client, dia.id_product_unit,
             max(case when g.rn = 1 then 1 else 0 end) as en_ganadora
      from dia
      left join gana g on g.id_client = dia.id_client
                      and g.id_address_client = dia.id_address_client
                      and g.id_invoice = dia.id_invoice
      group by 1,2,3
    )
    select c.co_client, c.na_client, dia.id_client, dia.id_address_client, dia.f as fecha,
           count(distinct dia.id_invoice) as facturas,
           count(distinct dia.id_product_unit) as productos,
           (select count(*) from rep r
             where r.id_client = dia.id_client
               and r.id_address_client = dia.id_address_client
               and r.veces > 1) as repetidos,
           (select count(*) from roles ro
             where ro.id_client = dia.id_client
               and ro.id_address_client = dia.id_address_client
               and ro.en_ganadora = 0) as ocultos,
           (select count(*) from roles ro
             where ro.id_client = dia.id_client
               and ro.id_address_client = dia.id_address_client
               and ro.en_ganadora = 1) as controles
    from dia
    join clients c on c.id_client = dia.id_client
    group by 1,2,3,4,5
    having facturas >= 2
  `);
  if (esError(filas)) return { _error: filas._error };

  // El orden no se hace en SQL: se prefiere un escenario EQUILIBRADO —al menos un
  // oculto y al menos dos controles— antes que uno con muchos ocultos y ningún
  // control, que no puede detectar una regresión.
  const equilibrado = (e) => (Number(e.ocultos) >= 1 && Number(e.controles) >= 2) ? 1 : 0;
  return filas.sort((a, b) =>
    Number(b.repetidos) - Number(a.repetidos) ||
    equilibrado(b) - equilibrado(a) ||
    Number(b.facturas) - Number(a.facturas) ||
    Number(b.ocultos) - Number(a.ocultos));
}

// ── 3 · El oráculo del DESPACHO ──────────────────────────────────────────────
/**
 * Para un cliente+sucursal, qué debe traer `dispatched_stock` cada producto.
 *
 * Reproduce lo que hace el fix (`getInvoiceDetailUnitsFromLastClientInvoice`):
 * toma TODAS las facturas de la última fecha y SUMA por `id_product_unit`.
 * De paso calcula lo que daría la consulta VIEJA (solo la factura ganadora del
 * desempate `ORDER BY da_invoice DESC, id_invoice DESC`), que es lo que permite
 * distinguir «el fix funciona» de «este producto siempre estuvo bien».
 */
function oraculoDespacho(idClient, idAddressClient) {
  const filas = q(`
    with ult as (
      select max(substr(da_invoice,1,10)) as f from invoices
       where id_client = ${idClient} and id_address_client = ${idAddressClient}
    ),
    fact as (
      select i.id_invoice, i.co_invoice, i.da_invoice
      from invoices i, ult
       where i.id_client = ${idClient} and i.id_address_client = ${idAddressClient}
         and substr(i.da_invoice,1,10) = ult.f
    ),
    ganadora as (
      select id_invoice from fact order by da_invoice desc, id_invoice desc limit 1
    )
    select du.co_product_unit,
           du.id_product_unit,
           sum(du.qu_invoice) as oraculo_fix,
           sum(case when f.id_invoice = (select id_invoice from ganadora)
                    then du.qu_invoice else 0 end) as antes_del_fix,
           count(distinct f.id_invoice) as en_facturas
    from fact f
    join invoice_details d on d.id_invoice = f.id_invoice
    join invoice_detail_units du on du.id_invoice_detail = d.id_invoice_detail
    group by 1,2
    order by oraculo_fix desc
  `);
  if (esError(filas)) return { _error: filas._error };

  return filas.map(r => ({
    coProductUnit: r.co_product_unit,
    idProductUnit: r.id_product_unit,
    oraculo: Number(r.oraculo_fix),
    antesDelFix: Number(r.antes_del_fix),
    enFacturas: Number(r.en_facturas),
    // Etiquetas que hacen legible el reporte y evitan malinterpretar un PASS:
    //   ocultoPorElBug → daba 0 y ahora debe dar su cantidad: es lo que prueba el fix
    //   sumado         → aparece en más de una factura: prueba la SUMA (DM-SUG-011)
    //   control        → estaba bien antes y debe seguir igual (DM-SUG-012)
    rol: Number(r.antes_del_fix) === 0 ? 'ocultoPorElBug'
       : Number(r.en_facturas) > 1     ? 'sumado'
       : 'control',
  }));
}

// ── 4 · El oráculo de la ARITMÉTICA ──────────────────────────────────────────
/**
 * Dado lo que la app dice de un producto, recalcula el modelo y devuelve en qué
 * difiere. Se le pasa el objeto `unitsSuggested[i]` leído del componente.
 *
 *   inicial  = previous + dispatched + swap
 *   vendido  = inicial − actual − devuelto
 *   diaria   = vendido / díasDesde            (si vendido < 0 ⇒ 0)
 *   sugerido = diaria × díasHasta             (si actual >= sugerido ⇒ 0)
 *
 * ⚠ La guarda del stock incluye la IGUALDAD: `actual >= sugerido ⇒ 0`.
 *   Y `sugerido = 0` con díasHasta = 1 NO es un defecto — es la guarda operando.
 */
function oraculoTerminos(u, diasDesde, diasHasta, tolerancia = 0.01) {
  const n = (x) => Number(x ?? 0);
  const prev = n(u.previousStock);
  const desp = n(u.dispatchedStock);
  const swap = n(u.straightSwapStock);
  const act  = n(u.currentStock);
  const dev  = n(u.returnedStock);

  const inicial = prev + desp + swap;
  const vendido = inicial - act - dev;
  const diaria  = vendido < 0 ? 0 : (diasDesde > 0 ? vendido / diasDesde : 0);
  const bruto   = diaria * diasHasta;
  const sugerido = act >= bruto ? 0 : bruto;

  const dif = [];
  const cmp = (etiqueta, esperado, medido) => {
    if (Math.abs(Number(esperado) - n(medido)) > tolerancia) {
      dif.push(`${etiqueta}: esperado ${Number(esperado).toFixed(4)} · medido ${n(medido).toFixed(4)}`);
    }
  };
  cmp('inicial',  inicial,  u.initialStock);
  cmp('vendido',  vendido,  u.soldUnits);
  cmp('diaria',   diaria,   u.estimatedDailyUnits);
  cmp('sugerido', sugerido, u.quUnitSuggested ?? u.qu_unit_suggested ?? u.suggested);

  return {
    ok: dif.length === 0,
    diferencias: dif,
    esperado: { inicial, vendido, diaria, sugerido },
    // Sirve para no reportar un falso hallazgo cuando todo sale en 0:
    sugeridoEnCeroPorGuarda: sugerido === 0 && bruto > 0,
    diariaEnCeroPorVentaNegativa: vendido < 0,
  };
}

// ── 5 · Lo GUARDADO: ¿coincide con lo que se mostró? ─────────────────────────
/**
 * Lee el snapshot persistido para un inventario. Es el cotejo de DM-SUG-031:
 * cada término guardado debe ser idéntico al que mostró la vista previa.
 */
function snapshotGuardado(coClientStock) {
  const cab = q(
    "select co_client_stock_suggested_order, co_client_stock, id_client, co_client, " +
    "id_address_client, days_since_last, days_until_next, by_dispatch_and_return, " +
    "da_suggested, nu_details, co_order, id_order, in_order_sent " +
    `from client_stock_suggested_orders where co_client_stock = '${coClientStock}'`
  );
  if (esError(cab)) return { _error: cab._error };
  if (!cab.length) return null;

  const co = cab[0].co_client_stock_suggested_order;
  const det = q(
    "select co_product, na_product, co_product_unit, posicion, qu_unit_suggested, " +
    "previous_stock, current_stock, dispatched_stock, straight_swap_stock, " +
    "returned_stock, initial_stock, sold_units, estimated_daily_units " +
    `from client_stock_suggested_order_details where co_client_stock_suggested_order = '${co}' ` +
    'order by posicion'
  );
  return { cabecera: cab[0], detalles: esError(det) ? [] : det };
}

module.exports = {
  verificarBase,
  elegirEscenario,
  oraculoDespacho,
  oraculoTerminos,
  snapshotGuardado,
};

// ── Modo diagnóstico: ver la ficha sin correr el script ──────────────────────
if (require.main === module) {
  const base = verificarBase();
  console.log('\n══ BASE DEL EQUIPO ' + '═'.repeat(58));
  if (!base.ok) { console.log(`  🔴 ${base.motivo}\n`); process.exit(1); }
  console.log(`  ${base.clientes} clientes · ${base.facturas} facturas · última: ${base.ultimaFactura}`);
  console.log('  ✅ tablas de sugerido presentes (migración v22)');

  const arg = process.argv.indexOf('--cliente');
  const escenarios = elegirEscenario();
  if (escenarios._error) { console.log(`  🔴 ${escenarios._error}`); process.exit(1); }

  if (!escenarios.length) {
    console.log('\n  🔴 NINGÚN cliente del equipo tiene 2+ facturas en su última fecha.');
    console.log('     Sin eso no se puede probar la consolidación: no es un defecto, es falta de dato.\n');
    process.exit(1);
  }

  console.log('\n══ ESCENARIOS DISPONIBLES EN EL EQUIPO ' + '═'.repeat(38));
  console.log('  (ordenados por lo que ejercitan: repetidos > facturas > productos)\n');
  escenarios.slice(0, 6).forEach((e, i) => {
    const eq = (Number(e.ocultos) >= 1 && Number(e.controles) >= 2);
    console.log(`  ${i === 0 ? '→' : ' '} ${String(e.co_client).padEnd(7)} ${String(e.na_client).slice(0, 32).padEnd(32)}` +
      ` suc ${String(e.id_address_client).padEnd(4)} ${e.fecha}  ${e.facturas} fact  ` +
      `${String(e.ocultos).padStart(2)} ocultos / ${String(e.controles).padStart(2)} control` +
      (eq ? '' : '  ⚠ sin controles suficientes') +
      (e.repetidos > 0 ? `  🔑 ${e.repetidos} repetido(s) ⇒ prueba la SUMA` : ''));
  });

  const elegido = arg > -1
    ? escenarios.find(e => String(e.id_address_client) === process.argv[arg + 1]) || escenarios[0]
    : escenarios[0];

  if (!escenarios.some(e => e.repetidos > 0)) {
    console.log('\n  ⚠ Ningún escenario tiene un producto repetido entre facturas del mismo día.');
    console.log('    DM-SUG-011 (la SUMA) queda BLOCKED por falta de dato — no es un FAIL.');
  }

  const desp = oraculoDespacho(elegido.id_client, elegido.id_address_client);
  if (desp._error) { console.log(`  🔴 ${desp._error}`); process.exit(1); }

  console.log(`\n══ ORÁCULO DEL DESPACHO · ${elegido.co_client} ${elegido.na_client} ` + '═'.repeat(12));
  console.log(`  sucursal ${elegido.id_address_client} · última fecha ${elegido.fecha} · ${elegido.facturas} facturas\n`);
  console.log('  producto                        antes    →  oráculo   rol');
  desp.forEach(d => {
    console.log(`  ${d.coProductUnit.padEnd(30)} ${String(d.antesDelFix).padStart(6)}` +
      `  →  ${String(d.oraculo).padStart(7)}   ${d.rol}`);
  });
  const ocultos = desp.filter(d => d.rol === 'ocultoPorElBug').length;
  const sumados = desp.filter(d => d.rol === 'sumado').length;
  console.log(`\n  ${ocultos} producto(s) que el bug ocultaba · ${sumados} que prueban la suma · ` +
    `${desp.length - ocultos - sumados} de control\n`);
}
