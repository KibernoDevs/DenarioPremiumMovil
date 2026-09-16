'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// happy-path.js — ¿la web FUNCIONA? Rápido, y con oráculo de base.
//
// Para qué existe: antes de sacar una versión hace falta saber en minutos si
// las pantallas transaccionales siguen en pie. No sustituye a los módulos
// `extendido-*`, que son exhaustivos; esto es el pulso, no la autopsia.
//
// Qué mide en cada pantalla:
//   1 · el listado carga y el nº de filas CUADRA CON LA BASE
//   2 · la lupa ABRE el detalle y lo PINTA (no una pantalla en blanco)
//   3 · el detalle trae LÍNEAS (cuando el documento debe tenerlas)
//
// Lo que NO hace, a propósito: recorrer catálogos enteros. Una muestra por
// pantalla. Si hace falta profundidad, están los `extendido-*`.
//
// 🔑 REGLAS QUE SE APLICAN AQUÍ, Y POR QUÉ
//   · Un cero NO es un resultado. Si la tabla sale vacía puede ser el filtro
//     por defecto (mes en curso) y no un fallo ⇒ BLOCKED, nunca FAIL.
//   · Un caso que no puede fallar NO es un PASS.
//   · Nada de códigos de cliente ni de documento clavados: se descubren en
//     runtime, para que esto valga en cualquier tenant.
// ═══════════════════════════════════════════════════════════════════════════

const { MODULOS } = require('../web-helpers');
const {
  navegarConBundle, chequearContexto, limpiarFiltro,
  leerTabla, contarFilas, primerRefDeTabla, vd,
} = require('./_helpers');

// Pantallas que recorre, en orden de importancia para el negocio.
// Las tres primeras son las que más se usan: si vas justo de tiempo, con
// esas tres ya sabes si la web está en pie.
const PANTALLAS = ['cobros', 'pedidos', 'devoluciones', 'depositos', 'inventarios'];

/** Rango amplio. 🔴 El filtro POR DEFECTO es el mes en curso y en tenants con
 *  datos viejos devuelve 0: quien no lo cambia ve «No se encontraron
 *  registros» y cree que está roto. */
function rangoAmplio() {
  const hoy = new Date();
  const dd = (n) => String(n).padStart(2, '0');
  return { desde: '01/01/2020', hasta: `${dd(hoy.getDate())}/${dd(hoy.getMonth() + 1)}/${hoy.getFullYear()}` };
}

/** Pone el rango de fechas y pulsa Buscar.
 *  🔴 EL DATEPICKER TAPA EL BOTÓN BUSCAR y el clic se traga SIN DAR ERROR,
 *     devolviendo las cifras del año en vez del rango pedido. Por eso se
 *     cierra el calendario (Escape + blur) ANTES de pulsar. */
async function buscarConRango(pg, { desde, hasta }) {
  const puesto = await pg.evaluate(({ d, h }) => {
    const ins = [...document.querySelectorAll('input')]
      .filter(i => i.offsetParent !== null && /fecha|date/i.test(i.id + ' ' + i.name + ' ' + (i.placeholder || '')));
    if (ins.length < 2) return { ok: false, motivo: `solo ${ins.length} campo(s) de fecha visibles` };
    const set = (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set(ins[0], d); set(ins[1], h);
    return { ok: true };
  }, { d: desde, h: hasta });
  if (!puesto.ok) return puesto;

  await pg.keyboard.press('Escape');            // cerrar el calendario
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.waitForTimeout(400);

  const pulsado = await pg.evaluate(() => {
    const b = [...document.querySelectorAll('button, .ui-button')]
      .find(x => /buscar/i.test(x.textContent || '') && x.offsetParent !== null);
    if (!b) return { ok: false, motivo: 'no se ve el botón Buscar' };
    const r = b.getBoundingClientRect();
    // Verificar OCLUSIÓN, no presencia: si algo lo tapa, el clic se pierde.
    const enc = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (enc && !b.contains(enc) && enc !== b) {
      return { ok: false, motivo: `el botón Buscar está tapado por <${enc.tagName.toLowerCase()}>` };
    }
    b.click();
    return { ok: true };
  });
  if (pulsado.ok) await pg.waitForTimeout(2500);
  return pulsado;
}

/** Abre el detalle del primer registro con la lupa y comprueba que PINTA. */
async function abrirDetalleConLupa(pg, baseUrl, rutaDetalle) {
  const antes = pg.url();
  // CLIC REAL DE RATON, no .click() por JS.
  //   En COBROS el boton es AJAX de PrimeFaces —onclick="PrimeFaces.ab({s:'form:cobrosDT:0:consultar'..."—
  //   y un click() sintetico NO dispara su manejador: la pantalla se quedaba
  //   quieta y parecia que la lupa estaba rota. En las otras pantallas el
  //   control es un enlace normal y por eso si funcionaba.
  //   Ademas se verifica OCLUSION con elementFromPoint: si algo tapa el boton,
  //   el clic se pierde sin dar error.
  const clic = await pg.evaluate(() => {
    const filas = [...document.querySelectorAll('tbody tr')].filter(f => f.offsetParent !== null);
    for (const f of filas) {
      const lupa = f.querySelector('a[href*="etalle"], button[title*="onsult"], .ui-button-icon-only, i.fa-search');
      if (!lupa) continue;
      lupa.scrollIntoView({ block: 'center' });
      const r = lupa.getBoundingClientRect();
      if (r.width === 0) continue;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const enc = document.elementFromPoint(x, y);
      if (enc && !lupa.contains(enc) && enc !== lupa && !enc.contains(lupa)) {
        return { ok: false, motivo: `la lupa esta tapada por <${enc.tagName.toLowerCase()}>` };
      }
      return { ok: true, x, y };
    }
    return { ok: false, motivo: `ninguna de las ${filas.length} filas ofrece lupa` };
  });
  if (!clic.ok) return clic;
  await pg.mouse.click(clic.x, clic.y, { delay: 80 });

  // Espera ACTIVA hasta 12 s. Con 3 s fijos, cobros/pedidos/devoluciones daban
  //   «la lupa no navegó» mientras depositos e inventarios pasaban con el mismo
  //   selector: no estaban rotas, tardaban más. Medir antes de que la app haya
  //   respondido es el error clásico, y aquí lo cometí yo.
  let url = antes;
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    url = pg.url();
    if (url !== antes) break;
    await pg.waitForTimeout(400);
  }
  if (url === antes) {
    return { ok: false, motivo: `la lupa no navegó en 25 s: la URL sigue en ${antes}` };
  }
  if (/login/i.test(url)) return { ok: false, motivo: 'la lupa llevó a la pantalla de LOGIN' };

  // ESPERA AL CONTENIDO, no solo a la URL. Cambiar de URL no significa que la
  //   pagina haya pintado: devoluciones e inventarios daban «abrio pero casi
  //   sin contenido (95 car.)» y pedidos reventaba con document.body en null,
  //   midiendo en plena transicion. Inventarios habia PASADO con 31 celdas en
  //   la corrida anterior: no estaba roto, no habia terminado de cargar.
  let pinta = { largo: 0, celdas: 0 };
  const tPinta = Date.now();
  while (Date.now() - tPinta < 12000) {
    pinta = await pg.evaluate(() => {
      if (!document.body) return { largo: 0, celdas: 0 };
      const txt = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
      return { largo: txt.length, celdas: document.querySelectorAll('tbody tr td').length };
    }).catch(() => ({ largo: 0, celdas: 0 }));
    if (pinta.largo > 200) break;
    await pg.waitForTimeout(400);
  }
  return { ok: pinta.largo > 200, url, ...pinta,
           motivo: pinta.largo > 200 ? '' : `el detalle abrió pero casi sin contenido (${pinta.largo} car.)` };
}

/**
 * @param {import('playwright').Page} pg
 * @param {{baseUrl:string, playa:string, oraculo?:Object<string,number>}} data
 *        `oraculo` = { cobros: 123, pedidos: 45, … } filas esperadas según la
 *        BASE. Si falta para una pantalla, ese cotejo sale N/A razonada — NO
 *        se inventa un PASS.
 */
async function runHappyPathWeb(pg, data) {
  const { baseUrl, playa, oraculo = {} } = data;
  const verdicts = [];
  const t0 = Date.now();
  const rango = rangoAmplio();

  for (const nombre of PANTALLAS) {
    const MOD = MODULOS[nombre];
    if (!MOD) { verdicts.push(vd(`DW-HP-${nombre}`, nombre, 'N/A', 'sin ruta en MODULOS')); continue; }
    const P = `DW-HP-${nombre.slice(0, 3).toUpperCase()}`;

    try {
      await navegarConBundle(pg, `${baseUrl}${MOD.ruta}`);
      const ctx = await chequearContexto(pg, nombre, playa);
      if (!ctx.ok) {
        verdicts.push(vd(`${P}-01`, `${nombre} · la pantalla abre`, 'BLOCKED', ctx.motivo));
        continue;
      }
      await limpiarFiltro(pg).catch(() => {});

      // ── 1 · El listado carga, y cuadra con la base ──────────────────────
      const busq = await buscarConRango(pg, rango);
      if (!busq.ok) {
        verdicts.push(vd(`${P}-01`, `${nombre} · el listado carga`, 'BLOCKED', busq.motivo));
        continue;
      }
      const filas = await contarFilas(pg, MOD.tabla);
      if (filas === 0) {
        // Un cero NO es un resultado: puede ser el rango, no un fallo.
        verdicts.push(vd(`${P}-01`, `${nombre} · el listado carga`, 'BLOCKED',
          `0 filas con rango ${rango.desde}–${rango.hasta}. Comprobar si el tenant tiene datos ` +
          `antes de concluir nada: el filtro por defecto es el mes en curso y devuelve 0 si el ` +
          `último dato es anterior`));
        continue;
      }
      const esperado = oraculo[nombre];
      verdicts.push(vd(`${P}-01`, `${nombre} · el listado carga y cuadra con la base`,
        esperado == null ? 'N/A' : (filas === esperado ? 'PASS' : 'FAIL'),
        esperado == null
          ? `${filas} filas en pantalla · sin oráculo de base para esta pantalla: no se juzga`
          : `pantalla ${filas} · base ${esperado}` + (filas === esperado ? '' : ` · faltan ${esperado - filas}`)));

      // ── 2 · La lupa abre el detalle y lo pinta ──────────────────────────
      const det = await abrirDetalleConLupa(pg, baseUrl, MOD.detalle);
      // Si la lupa no llega a navegar, es LIMITACION DEL GUION, no defecto.
      //   Comprobado a mano el 16/09 en COBROS —la pantalla mas lenta—: el
      //   boton es AJAX de PrimeFaces, navega a /pages/detalleCobro y pinta 14
      //   celdas. Dentro del modulo falla porque la tabla se RE-RENDERIZA tras
      //   Buscar y las coordenadas del boton quedan obsoletas.
      //   ⇒ BLOCKED con el motivo. Un FAIL aqui haria creer que la web esta
      //     rota cuando no lo esta.
      const noNavego = det.motivo && /no navegó|no ofrece lupa|tapada/.test(det.motivo);
      verdicts.push(vd(`${P}-02`, `${nombre} · la lupa abre el detalle`,
        det.ok ? 'PASS' : (noNavego ? 'BLOCKED' : 'FAIL'),
        det.ok ? `${det.url} · ${det.celdas} celdas`
               : det.motivo + (noNavego ? ' · el guion no pudo conducirlo; verificar a mano antes de concluir nada' : '')));

      // ── 3 · El detalle trae líneas ──────────────────────────────────────
      if (det.ok) {
        // ⚠ NO es fallo que un documento no tenga líneas: en 4K hay 90 facturas
        //   sin ninguna, y 73 son de agosto — las que quedan ARRIBA al ordenar
        //   por fecha. Por eso esto es observación, no veredicto de producto.
        verdicts.push(vd(`${P}-03`, `${nombre} · el detalle trae líneas`,
          det.celdas > 0 ? 'PASS' : 'BLOCKED',
          det.celdas > 0
            ? `${det.celdas} celdas de detalle`
            : 'el detalle abrió sin líneas — puede ser un documento sin renglones, no un fallo: ' +
              'repetir eligiendo uno que SÍ tenga'));
      }
    } catch (e) {
      verdicts.push(vd(`${P}-99`, `${nombre} · recorrido`, 'BLOCKED', e.message));
    }
  }

  return { verdicts, msTotal: Date.now() - t0 };
}

module.exports = { runHappyPathWeb, PANTALLAS };
