'use strict';
/**
 * Continua un cobro YA MONTADO en pantalla:  GUARDAR -> salir -> reabrir -> ENVIAR
 *   node continuar.js <marca>
 * Se usa cuando el montaje ya se hizo y no conviene gastar otro documento.
 */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');
const fs = require('fs');
const path = require('path');

const MARCA = process.argv[2];
if (!MARCA) { console.error('falta la marca'); process.exit(1); }
const DATA = { clienteSlug: '4k', requiredComment: true };
const LOG = [];
const say = (...a) => { const s = a.join(' '); LOG.push(s); console.log(s); };
const consola = [];
const desde = (i) => consola.slice(i);

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
        txComment: s.txComment, stCollection: s.stCollection, coCollection: s.coCollection,
        nuDifference: s.nuDifference,
        collectionPayments_len: Array.isArray(s.collectionPayments) ? s.collectionPayments.length : -1,
        getPrepaidExcessAmount: typeof s.getPrepaidExcessAmount === 'function' ? String(s.getPrepaidExcessAmount()) : null,
        normalizeMeta: typeof s.normalizeAutomatedPrepaidPaymentMeta === 'function' ? j(s.normalizeAutomatedPrepaidPaymentMeta()) : null
      };
    } catch (e) { return { err: e.message }; }
  }).catch(e => ({ err: e.message }));
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 25000 });
  const pg = browser.contexts()[0].pages()[0];
  pg.on('console', m => { try { consola.push('[' + m.type() + '] ' + m.text()); } catch (_) {} });
  pg.on('pageerror', e => consola.push('[pageerror] ' + e.message));
  await pg.bringToFront();
  const H = makeHelpers(pg, DATA);

  say('=== CONTINUAR (reabierto) - marca ' + MARCA + ' ===');
  const st0 = await sondaModelo(pg);
  say('  modelo en pantalla: ' + JSON.stringify(st0));

  // 1 - GUARDAR con el boton del header (el paso literal "Guarda")
  const cg = await H.clickGuardarEnviar('imagenGuardar');
  say('  clic GUARDAR -> ' + (cg.ok ? 'ok (' + cg.via + ')' : 'FALLO ' + cg.motivo));
  await pg.waitForTimeout(1800);
  let alG = await H.readAlert();
  say('  alerta tras Guardar: ' + (alG || '-'));
  if (alG) { await H.clickAlertBtn(['Aceptar', 'OK']).catch(() => {}); await pg.waitForTimeout(1600); }

  // 2 - SALIR del formulario y abrir la lista
  await H.abandonarCobro().catch(() => {});
  await pg.waitForTimeout(1200);
  const lista = await H.abrirListaCobros();
  say('  lista: ' + lista.total + ' items - ' + lista.guardados + ' Guardados - ' + lista.enviados + ' Enviados');

  // 3 - REABRIR el Guardado por su marca
  const re = await H.reabrirGuardado(MARCA);
  say('  REABRIR por marca -> ' + re);
  if (!re) { say('BLOQUEADO: no se reabrio'); return fin(browser, 'BLOCKED', { motivo: 'no se reabrio el Guardado' }); }
  await pg.waitForTimeout(1500);

  const antes = await sondaModelo(pg);
  say('  modelo REABIERTO antes de Enviar: ' + JSON.stringify(antes));
  const sticky = await H.leerPagosSticky();
  say('  sticky reabierto: total ' + sticky.total + ' - Diferencia ' + sticky.difVal + ' (' + sticky.difColor + ')');

  // 4 - ENVIAR
  const idx = consola.length;
  const ce = await H.clickGuardarEnviar('imagenEnviar');
  say('  clic ENVIAR -> ' + (ce.ok ? 'ok (' + ce.via + ')' : 'FALLO ' + ce.motivo));
  if (!ce.ok) return fin(browser, 'BLOCKED', { motivo: 'Enviar: ' + ce.motivo, consolaEnvio: desde(idx) });
  await pg.waitForTimeout(1800);
  for (let i = 0; i < 3; i++) {
    const a = await H.readAlert();
    if (!a) break;
    say('  dialogo ' + (i + 1) + ': ' + a);
    await H.clickAlertBtn(['Aceptar', 'OK', 'Si']).catch(() => {});
    await pg.waitForTimeout(2600);
  }
  await pg.waitForTimeout(1500);
  const despues = await sondaModelo(pg);

  // 5 - ORACULO
  let nube = await H.verificarNube(MARCA, 6);
  say('  nube: ' + nube.resumen + (nube.aviso || ''));
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
  let cola = null;
  try { const l = await H.abrirListaCobros(); cola = { total: l.total, guardados: l.guardados, enviados: l.enviados }; } catch (_) {}
  say('  cola del equipo: ' + JSON.stringify(cola));

  const hay = !!(nube.anticipos && nube.anticipos.length);
  const veredicto = hay ? 'PASS' : 'FAIL';
  say('  => ' + veredicto + ' - anticipo ' + (hay ? 'GENERADO' : 'AUSENTE'));
  const rx = /ANTICIPO|anticipoAutomatico|payment|PAYMENT|hu.rfano|CobrosHeader|repaid|errorMessage|COLLECTION|AutoSend/;
  const clave = desde(idx).filter(l => rx.test(l));
  if (!hay) { say('\n  -- consola del envio (lineas clave) --'); clave.forEach(l => say('  ' + l)); }

  return fin(browser, veredicto, {
    marca: MARCA, tipo: 'reab', modeloAntes: antes, modeloDespues: despues,
    sticky: sticky, nube: { resumen: nube.resumen, filas: nube.filas }, cola: cola,
    consolaEnvio: desde(idx), consolaClave: clave
  });
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });

function fin(browser, veredicto, extra) {
  const out = Object.assign({ marca: MARCA, veredicto, ts: new Date().toISOString() }, extra, { log: LOG });
  const f = path.join(__dirname, 'caso_' + MARCA + '.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  console.log('\n-> ' + veredicto + ' - ' + f);
  return browser.close().catch(() => {});
}
