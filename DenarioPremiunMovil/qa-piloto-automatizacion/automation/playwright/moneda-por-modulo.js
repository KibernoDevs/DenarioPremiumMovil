'use strict';
/**
 * moneda-por-modulo.js — los cuatro componentes de la moneda, en las tres capas.
 *
 * El REQ «Moneda por módulo» no es una funcionalidad: son **cuatro ajustes que se
 * gobiernan desde dos pantallas distintas**, y basta con que discrepen para que la app
 * haga algo que nadie configuró. Esto lo comprueba en cada versión sin tener que
 * recorrer la matriz a mano.
 *
 *   1. Moneda por defecto      ┐ Empresa › Configuración › Módulos
 *   2. Mostrar conversiones    │ (tabla `currency_modules`, una fila por módulo)
 *   3. Selector de monedas     ┘
 *   4. La variable global      → Empresa › Variables Globales › Cobros / Pedidos
 *                                (`multiCurrencyCollection` / `multiCurrencyOrder`)
 *
 * 🔴 EL PUNTO 4 ES EL QUE MUERDE. En Cobros y Pedidos el selector no depende solo del
 *    módulo: hay una variable global que dice lo mismo por otra vía. **Las dos tienen
 *    que coincidir.** Si el módulo dice NO y la variable dice SÍ, lo más probable es que
 *    el selector aparezca igual — y nadie entiende por qué, porque la pantalla que se
 *    revisó decía que no.
 *
 * 🔑 LAS TRES CAPAS, Y POR QUÉ NINGUNA SOBRA
 *      NUBE     `currency_modules` en la base del cliente  → lo que configuró el consultor
 *      EQUIPO   `currency_modules` en el SQLite del teléfono → lo que la app usa de verdad
 *      PANTALLA lo que el vendedor ve                        → lo único que le importa al usuario
 *
 *    ⚠ Entre la nube y el equipo hay una trampa medida: **un cambio de moneda por módulo
 *      NO baja con «Sincronizar». Hace falta cerrar sesión y volver a entrar.** Si se mide
 *      sin re-loguear, se está midiendo la configuración vieja y el informe miente.
 *      (Confirmado por QA el 11/09/2026 y recogido en el manual de novedades de 4K.)
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *   node automation/playwright/moneda-por-modulo.js <cliente>
 *
 * Imprime las tres tablas: la configuración por capa, los conflictos, y **qué debe
 * mostrar cada módulo** para que quien conduzca la app sepa qué está buscando.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const QUERY = path.resolve(__dirname, '..', 'db', 'query.js');
const LOCAL = path.resolve(__dirname, '..', 'db', 'local-query.js');

// ── Los módulos, con el código que usa la app ───────────────────────────────
// El id sale de `modules`; el código corto es el que recibe `getCurrencyModule(co)`
// en `currency.service.ts`. Si mañana aparece un módulo nuevo, se agrega aquí.
// 🔑 `selector: true` solo en los tres módulos donde el vendedor ELIGE la moneda de una
//    transacción. En el resto el selector **no entra en la lógica**: ahí la moneda es la
//    del módulo y punto. Un SÍ en esos otros **no habilita nada y da lo mismo**: es un
//    ajuste inerte, no un problema. Se muestra para que quien revise la configuración no
//    lo interprete como que ahí debería aparecer un selector. (QA, 14/09/2026.)
const MODULOS = [
  { id: 1, nombre: 'Visitas',      co: 'vis', selector: false },
  { id: 2, nombre: 'Inventarios',  co: 'inv', selector: false },
  { id: 3, nombre: 'Pedidos',      co: 'ped', selector: true, vg: 'multiCurrencyOrder' },
  { id: 4, nombre: 'Devoluciones', co: 'dev', selector: false },
  { id: 5, nombre: 'Cobros',       co: 'cob', selector: true, vg: 'multiCurrencyCollection' },
  { id: 6, nombre: 'Depósitos',    co: 'dep', selector: true, vg: 'multiCurrencyDeposit' },
  { id: 7, nombre: 'Vendedores',   co: 'ven', selector: false },
  { id: 8, nombre: 'Productos',    co: 'pro', selector: false },
  { id: 9, nombre: 'Clientes',     co: 'cli', selector: false },
];

const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';
const si = (v) => (bool(v) ? 'SÍ' : 'NO');

// ── Lectura de cada capa ────────────────────────────────────────────────────

/** NUBE: lo que configuró el consultor en Empresa › Configuración › Módulos. */
function leerNube(cliente) {
  const sql = 'SELECT m.id_module, m.na_module, cm.local_currency_default, ' +
    'cm.show_conversion, cm.currency_selector ' +
    'FROM modules m LEFT JOIN currency_modules cm ON cm.id_module = m.id_module ' +
    'ORDER BY m.id_module';
  const out = execFileSync('node', [QUERY, cliente, sql], { encoding: 'utf8', timeout: 120000 });
  if (out.startsWith('ERR:')) throw new Error(out.trim());
  return JSON.parse(out);
}

/**
 * EQUIPO: la misma tabla, pero en el SQLite del teléfono.
 * 🔴 Si esto no coincide con la nube, **lo más probable NO es un defecto**: es que falta
 *    re-loguear. Compruébalo antes de reportar nada.
 */
function leerEquipo() {
  const sql = 'select id_module, local_currency_default, show_conversion, currency_selector ' +
    'from currency_modules order by id_module';
  const out = execFileSync('node', [LOCAL, sql], { encoding: 'utf8', timeout: 120000 });
  if (out.startsWith('ERR:')) throw new Error(out.trim());
  return JSON.parse(out);
}

// ── La matriz: qué debe mostrar cada módulo ─────────────────────────────────
/**
 * Traduce los tres ajustes a lo que el vendedor tiene que ver. Es la parte que
 * convierte «la configuración dice X» en «la pantalla debe mostrar Y», que es lo
 * único que se puede comprobar de verdad.
 */
function queDebeMostrar(cfg, modulo) {
  const local = bool(cfg.local_currency_default);
  const conv = bool(cfg.show_conversion);
  const sel = bool(cfg.currency_selector);

  const principal = local ? 'moneda LOCAL (Bs)' : 'moneda FUERTE (USD)';
  const montos = conv
    ? `${principal} **y** su conversión — los dos importes visibles`
    : `SOLO ${principal} — no debe aparecer la otra`;

  // El selector solo existe donde el vendedor elige la moneda de la transacción.
  let selector;
  if (modulo && modulo.selector !== true) {
    selector = sel
      ? 'N/A — configurado en SÍ, pero sin efecto: este módulo no tiene selector'
      : 'N/A — el selector no aplica a este módulo';
  } else {
    selector = sel
      ? 'selector de moneda **visible y habilitado**'
      : 'selector de moneda **ausente o deshabilitado**';
  }

  return { montos, selector };
}

// ── Los contrastes ──────────────────────────────────────────────────────────

/** Nube contra equipo. Una diferencia aquí suele ser «falta re-loguear», no un defecto. */
function contrastarCapas(nube, equipo) {
  const porId = new Map(equipo.map((e) => [Number(e.id_module), e]));
  const dif = [];
  for (const n of nube) {
    const e = porId.get(Number(n.id_module));
    const mod = MODULOS.find((m) => m.id === Number(n.id_module));
    const nombre = (mod && mod.nombre) || n.na_module || `módulo ${n.id_module}`;
    if (!e) { dif.push({ nombre, campo: '(la fila entera)', nube: 'existe', equipo: 'NO está' }); continue; }
    for (const campo of ['local_currency_default', 'show_conversion', 'currency_selector']) {
      if (bool(n[campo]) !== bool(e[campo])) {
        dif.push({ nombre, campo, nube: si(n[campo]), equipo: si(e[campo]) });
      }
    }
  }
  return dif;
}

/**
 * 🔴 El conflicto que da nombre a este script.
 * En Cobros, Pedidos y Depósitos el selector se gobierna DOS VECES: desde el módulo y
 * desde una variable global. Si discrepan, gana la variable en la práctica — y el
 * resultado es un selector que aparece donde la pantalla de Módulos dice que no.
 */
function conflictoSelector(equipo, vgs) {
  const porId = new Map(equipo.map((e) => [Number(e.id_module), e]));
  const out = [];
  for (const m of MODULOS.filter((x) => x.vg)) {
    const e = porId.get(m.id);
    if (!e) continue;
    const delModulo = bool(e.currency_selector);
    const bruto = vgs ? vgs[m.vg] : undefined;
    if (bruto === undefined) {
      out.push({ modulo: m.nombre, vg: m.vg, modulo_dice: si(delModulo), vg_dice: '(no leída)', coinciden: null });
      continue;
    }
    const deLaVG = bool(bruto);
    out.push({
      modulo: m.nombre, vg: m.vg,
      modulo_dice: si(delModulo), vg_dice: si(deLaVG),
      coinciden: delModulo === deLaVG,
    });
  }
  return out;
}

// ── Informe ─────────────────────────────────────────────────────────────────

function informe(cliente, { nube, equipo, vgs }) {
  const L = [];
  const porId = new Map((equipo || []).map((e) => [Number(e.id_module), e]));

  L.push(`MONEDA POR MÓDULO · ${cliente}`);
  L.push('');
  L.push('  Módulo         | Moneda por defecto | Conversiones | Selector');
  L.push('  ---------------+--------------------+--------------+---------');
  for (const n of nube) {
    const m = MODULOS.find((x) => x.id === Number(n.id_module));
    const nombre = ((m && m.nombre) || n.na_module || '').padEnd(14);
    const moneda = (bool(n.local_currency_default) ? 'Local (Bs)' : 'Fuerte (USD)').padEnd(18);
    const aplica = m && m.selector === true;
    const selTxt = aplica ? si(n.currency_selector)
      : (bool(n.currency_selector) ? 'SÍ (inerte)' : 'n/a');
    L.push(`  ${nombre} | ${moneda} | ${si(n.show_conversion).padEnd(12)} | ${selTxt}`);
  }
  L.push('');

  // Contraste de capas
  const dif = equipo ? contrastarCapas(nube, equipo) : null;
  if (!equipo) {
    L.push('  ⚠ No se pudo leer el equipo: solo se muestra la configuración de la nube.');
  } else if (!dif.length) {
    L.push('  ✅ La configuración del equipo coincide con la de la web.');
  } else {
    L.push(`  🔴 ${dif.length} diferencia(s) entre la nube y el equipo:`);
    for (const d of dif) {
      L.push(`       ${d.nombre} · ${d.campo}: web dice ${d.nube}, equipo dice ${d.equipo}`);
    }
    L.push('       ⚠ Antes de reportarlo: un cambio de moneda por módulo NO baja con');
    L.push('         «Sincronizar» — hace falta cerrar sesión y volver a entrar.');
  }
  L.push('');

  // Conflictos módulo ↔ variable global
  const conf = conflictoSelector(equipo || [], vgs);
  if (conf.length) {
    L.push('  El selector se gobierna desde DOS sitios — tienen que coincidir:');
    for (const c of conf) {
      const estado = c.coinciden === null ? '?' : (c.coinciden ? '✅' : '🔴 DISCREPAN');
      L.push(`     ${estado}  ${c.modulo.padEnd(12)} módulo: ${c.modulo_dice}  ·  ${c.vg}: ${c.vg_dice}`);
    }
    if (conf.some((c) => c.coinciden === false)) {
      L.push('     ⚠ Cuando discrepan, en la práctica manda la variable global: el selector');
      L.push('       aparece aunque la pantalla de Módulos diga que no. Es el caso que hay');
      L.push('       que llevar a producto para decidir cuál debe prevalecer.');
    }
  }
  L.push('');

  // Qué debe mostrar cada módulo — el guion para quien conduzca la app
  L.push('  QUÉ DEBE VERSE EN CADA MÓDULO (según el equipo, que es lo que la app usa):');
  for (const m of MODULOS) {
    const e = porId.get(m.id);
    if (!e) continue;
    const q = queDebeMostrar(e, m);
    L.push(`     ${m.nombre}`);
    L.push(`        montos:   ${q.montos}`);
    L.push(`        selector: ${q.selector}`);
  }

  return L.join('\n');
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const cliente = process.argv[2];
  if (!cliente) {
    console.log('uso: node automation/playwright/moneda-por-modulo.js <cliente>');
    process.exit(1);
  }
  let nube, equipo = null, vgs = null;
  try {
    nube = leerNube(cliente);
  } catch (e) {
    console.log('ERR leyendo la nube: ' + e.message);
    process.exit(1);
  }
  try { equipo = leerEquipo(); } catch (_) { /* el equipo puede no estar conectado */ }
  try {
    const { leerVGs } = require('./leer-vg-dispositivo');
    if (typeof leerVGs === 'function') vgs = leerVGs();
  } catch (_) { /* se informa como «no leída» */ }

  console.log('');
  console.log(informe(cliente, { nube, equipo, vgs }));
  console.log('');
}

module.exports = { MODULOS, leerNube, leerEquipo, contrastarCapas, conflictoSelector, queDebeMostrar, informe };
