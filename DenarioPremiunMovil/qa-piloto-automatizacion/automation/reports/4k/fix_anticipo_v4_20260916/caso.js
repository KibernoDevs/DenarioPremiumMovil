'use strict';
/**
 * Un caso de anticipo por excedente de tolerancia.
 *   node caso.js reab|dir <sufijoMarca> <cliente[,cliente2,...]> [excedente=50]
 *
 * reab = Guardar -> salir -> reabrir -> Enviar    dir = Enviar directo
 * Oraculo: fila en la nube por marca de comentario (co_type 0 cobro / 1 anticipo).
 */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');
const fs = require('fs');
const path = require('path');

const [, , tipoArg, sufijo, clientesArg, excArg] = process.argv;
const TIPO = (tipoArg || 'reab').toLowerCase();
const EXC = Number(excArg || 50);
const CLIENTES = (clientesArg || 'C.0627').split(',').map(s => s.trim()).filter(Boolean);
const MARCA = 'FIX23-' + (sufijo || TIPO).toUpperCase() + '-' +
  new Date().toTimeString().slice(0, 8).replace(/:/g, '');

const DATA = { clienteSlug: '4k', requiredComment: true };
const LOG = [];
const say = (...a) => { const s = a.join(' '); LOG.push(s); console.log(s); };

// consola del WebView: enganchada ANTES de tocar nada
const consola = [];
function engancha(pg) {
  pg.on('console', m => { try { consola.push('[' + m.type() + '] ' + m.text()); } catch (_) {} });
  pg.on('pageerror', e => consola.push('[pageerror] ' + e.message));
}
const desde = (i) => consola.slice(i);

// Lee el modelo SIN mutarlo (no se invoca ensure...(), que cambiaria lo medido).
async function sondaModelo(pg) {
  return pg.evaluate(() => {
    try {
      const el = document.querySelector('app-cobro');
      if (!el || !window.ng) return { err: 'sin app-cobro/ng' };
      const c = window.ng.getComponent(el);
      const s = c && (c.collectService || c.collectionService);
      if (!s) return { err: 'sin collectService' };
      const j = (x) => { try { return JSON.stringify(x); } catch (_) { return String(x); } };
      return {
        anticipoAutomatico_len: Array.isArray(s.anticipoAutomatico) ? s.anticipoAutomatico.length : -1,
        anticipoAutomatico_dump: j(s.anticipoAutomatico),
        createAutomatedPrepaid: s.createAutomatedPrepaid,
        creditBalancePrepaidAmount: s.creditBalancePrepaidAmount,
        txComment: s.txComment,
        stCollection: s.stCollection,
        coCollection: s.coCollection,
        nuDifference: s.nuDifference,
        collectionPayments_len: Array.isArray(s.collectionPayments) ? s.collectionPayments.length : -1,
        getPrepaidExcessAmount: typeof s.getPrepaidExcessAmount === 'function' ? String(s.getPrepaidExcessAmount()) : null,
        normalizeMeta: typeof s.normalizeAutomatedPrepaidPaymentMeta === 'function' ? j(s.normalizeAutomatedPrepaidPaymentMeta()) : null,
        tieneEnsure: typeof s.ensureAutomatedPrepaidPaymentTemplate === 'function'
      };
    } catch (e) { return { err: e.message }; }
  }).catch(e => ({ err: e.message }));
}

// Texto de la fila del documento tildado (para citarlo en el informe).
async function docMarcado(pg) {
  return pg.evaluate(() => {
    const d = document.querySelector('app-cobro-documents');
    if (!d) return null;
    const filas = [...d.querySelectorAll('ion-row.tabladocumentSalesVenta')];
    for (const f of filas) {
      const cb = f.querySelector('ion-checkbox');
      if (cb && (cb.checked === true || cb.getAttribute('aria-checked') === 'true')) {
        return (f.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      }
    }
    return filas[0] ? (filas[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140) : null;
  }).catch(() => null);
}

/**
 * Entra al modulo Cobros desde el home de la app.
 * Nunca navega por URL (page.goto rompe el router de Ionic): clic en el tile.
 */
async function entrarCobros(pg, H) {
  if (await H.isHomeCobrosVisible().catch(() => false)) return true;
  for (let i = 0; i < 6; i++) {
    const enHomeApp = await pg.evaluate(() => {
      const viva = [...document.querySelectorAll('.ion-page')]
        .filter(p => !p.classList.contains('ion-page-hidden'))
        .map(p => p.tagName.toLowerCase()).pop() || '';
      return viva === 'app-home';
    });
    if (enHomeApp) {
      const c = await pg.evaluate(() => {
        const col = [...document.querySelectorAll('app-home ion-col')]
          .find(e => /^Cobros$/i.test((e.innerText || '').replace(/\s+/g, ' ').trim()));
        if (!col) return null;
        const r = col.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!c) throw new Error('no encuentro el tile Cobros en el home de la app');
      await pg.mouse.click(c.x, c.y, { delay: 90 });
      await pg.waitForTimeout(2500);
    } else {
      // dentro del modulo pero en otra pantalla
      try { await H.irAHomeCobros(); } catch (_) {}
    }
    if (await H.isHomeCobrosVisible().catch(() => false)) return true;
    await pg.waitForTimeout(1200);
  }
  return H.isHomeCobrosVisible().catch(() => false);
}

async function colaEquipo(pg, H) {
  try {
    const l = await H.abrirListaCobros();
    return { total: l.total, guardados: l.guardados, enviados: l.enviados };
  } catch (_) { return null; }
}

function fin(browser, veredicto, extra) {
  const out = Object.assign({ marca: MARCA, tipo: TIPO, veredicto, ts: new Date().toISOString() }, extra, { log: LOG });
  const f = path.join(__dirname, 'caso_' + MARCA + '.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  console.log('\n-> ' + veredicto + ' - ' + f);
  return browser.close().catch(() => {});
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 25000 });
  const pg = browser.contexts()[0].pages()[0];
  engancha(pg);
  await pg.bringToFront();
  const H = makeHelpers(pg, DATA);

  say('\n=== CASO ' + TIPO.toUpperCase() + ' - marca ' + MARCA + ' - excedente ' + EXC + ' ===');

  // 0 - entrar al modulo Cobros
  const dentro = await entrarCobros(pg, H);
  if (!dentro) { say('BLOQUEADO: no se pudo entrar al modulo Cobros'); return fin(browser, 'BLOCKED', { motivo: 'no se entro al modulo Cobros' }); }

  // 1 - montar el cobro con un documento
  const ab = await H.abrirCobroConDocumento(CLIENTES, MARCA);
  if (!ab.ok) { say('BLOQUEADO al montar: ' + ab.motivo); return fin(browser, 'BLOCKED', { motivo: ab.motivo }); }
  const doc = await docMarcado(pg);
  say('  cliente ' + ab.cliente + ' - docs ' + ab.docs + ' - total a pagar ' + ab.total + ' (=' + ab.saldo + ')');
  say('  documento: ' + doc);

  // 2 - pagar saldo + excedente
  const pagar = Math.round((ab.saldo + EXC) * 100) / 100;
  const digitos = String(Math.round(pagar * 100));
  const pago = await H.agregarPagoEfectivo(digitos);
  if (!pago.ok) { say('BLOQUEADO en pago: ' + pago.error); return fin(browser, 'BLOCKED', { motivo: pago.error }); }
  const sticky = await H.leerPagosSticky();
  say('  pagado ' + pagar + ' - Diferencia en pantalla: ' + sticky.difVal + ' (' + sticky.difColor + ')');

  // 3 - camino
  if (TIPO === 'reab') {
    // GUARDAR con el boton del header (el paso literal "Guarda"). La guarda de
    // salida no sirve aqui: el back del header no siempre la levanta y las
    // ion-alert viejas siguen en el DOM ocultas, asi que no se pueden contar.
    const cg = await H.clickGuardarEnviar('imagenGuardar');
    say('  clic GUARDAR -> ' + (cg.ok ? 'ok (' + cg.via + ')' : 'FALLO ' + cg.motivo));
    if (!cg.ok) return fin(browser, 'BLOCKED', { motivo: 'Guardar: ' + cg.motivo });
    await pg.waitForTimeout(1800);
    const alG = await H.readAlert();
    say('  alerta tras Guardar: ' + (alG || '-'));
    if (alG) { await H.clickAlertBtn(['Aceptar', 'OK']).catch(() => {}); await pg.waitForTimeout(1600); }
    if (!(alG && /guardad/i.test(alG))) return fin(browser, 'BLOCKED', { motivo: 'no confirmo el guardado: ' + alG });
    await H.abandonarCobro().catch(() => {});
    await pg.waitForTimeout(1200);
    const lista = await H.abrirListaCobros();
    say('  lista: ' + lista.total + ' items - ' + lista.guardados + ' Guardados');
    const re = await H.reabrirGuardado(MARCA);
    say('  REABRIR Guardado por marca -> ' + re);
    if (!re) return fin(browser, 'BLOCKED', { motivo: 'no se pudo reabrir el Guardado' });
    await pg.waitForTimeout(1200);
  }

  // 4 - sonda del modelo JUSTO antes de Enviar
  const antes = await sondaModelo(pg);
  say('  modelo antes de Enviar: ' + JSON.stringify(antes));

  // 5 - ENVIAR (la consola ya esta enganchada desde el arranque)
  const idx = consola.length;
  const ce = await H.clickGuardarEnviar('imagenEnviar');
  say('  clic Enviar -> ' + (ce.ok ? 'ok (' + ce.via + ')' : 'sin reaccion detectada: ' + ce.motivo));
  await pg.waitForTimeout(1800);
  // huellaPantalla() no mira las ion-alert, asi que un envio que SI salio puede
  // dar "sin reaccion". Antes de declararlo bloqueado se mira si hay dialogo vivo.
  if (!ce.ok) {
    const vivo = await H.readAlert();
    if (!vivo) return fin(browser, 'BLOCKED', { motivo: 'Enviar: ' + ce.motivo, consola: desde(idx) });
    say('  (el clic si habia salido: dialogo vivo)');
  }
  for (let i = 0; i < 3; i++) {
    const a = await H.readAlert();
    if (!a) break;
    say('  dialogo ' + (i + 1) + ': ' + a);
    await H.clickAlertBtn(['Aceptar', 'OK', 'Si']).catch(() => {});
    await pg.waitForTimeout(2600);
  }
  await pg.waitForTimeout(1500);
  const despues = await sondaModelo(pg);

  // 6 - ORACULO: la nube, por marca
  let nube = await H.verificarNube(MARCA, 6);
  say('  nube: ' + nube.resumen + (nube.aviso || ''));
  // Descarte de sincronizacion diferida: se relee ~100 s mas si falta el anticipo
  if (!nube.anticipos || !nube.anticipos.length) {
    say('  ... sin anticipo: repoll ~100 s para descartar sincronizacion diferida');
    for (let i = 0; i < 10; i++) {
      await pg.waitForTimeout(10000);
      const otra = await H.verificarNube(MARCA, 1);
      if (otra && otra.filas) nube = otra;
      say('    +' + ((i + 1) * 10) + 's -> ' + nube.resumen);
      if (nube.anticipos && nube.anticipos.length) break;
    }
  }
  const cola = await colaEquipo(pg, H);
  say('  cola del equipo: ' + JSON.stringify(cola));

  const hayAnticipo = !!(nube.anticipos && nube.anticipos.length);
  const veredicto = hayAnticipo ? 'PASS' : 'FAIL';
  say('  => ' + veredicto + ' - anticipo ' + (hayAnticipo ? 'GENERADO' : 'AUSENTE'));

  const rx = /ANTICIPO|anticipoAutomatico|payment|PAYMENT|hu.rfano|CobrosHeader|repaid|errorMessage|COLLECTION|AutoSend/;
  const clave = desde(idx).filter(l => rx.test(l));
  if (!hayAnticipo) { say('\n  -- consola del envio (lineas clave) --'); clave.forEach(l => say('  ' + l)); }

  await H.abandonarCobro().catch(() => {});
  return fin(browser, veredicto, {
    marca: MARCA, tipo: TIPO, cliente: ab.cliente, doc: doc, total: ab.total, pagado: pagar,
    excedente: EXC, difPantalla: sticky.difVal, modeloAntes: antes, modeloDespues: despues,
    nube: { resumen: nube.resumen, filas: nube.filas }, cola: cola,
    consolaEnvio: desde(idx), consolaClave: clave
  });
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });
