'use strict';
/**
 * Caso A/B de anticipo por excedente de tolerancia, CON captura de alertas (caso D).
 *   node caso2.js reab|dir <sufijoMarca> <cliente[,cliente2,...]> [excedente=50]
 */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');
const makeAlertas = require('./_alertas.js');
const fs = require('fs');
const path = require('path');

const [, , tipoArg, sufijo, clientesArg, excArg] = process.argv;
const TIPO = (tipoArg || 'reab').toLowerCase();
const EXC = Number(excArg || 50);
const CLIENTES = (clientesArg || 'C.0627').split(',').map(s => s.trim()).filter(Boolean);
const MARCA = 'CIE24-' + (sufijo || TIPO).toUpperCase() + '-' +
  new Date().toTimeString().slice(0, 8).replace(/:/g, '');

const DATA = { clienteSlug: '4k', requiredComment: true };
const LOG = [];
const say = (...a) => { const s = a.join(' '); LOG.push(s); console.log(s); };

const consola = [];
function engancha(pg) {
  pg.on('console', m => { try { consola.push('[' + m.type() + '] ' + m.text()); } catch (_) {} });
  pg.on('pageerror', e => consola.push('[pageerror] ' + e.message));
}
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
        stCollection: s.stCollection, coCollection: s.coCollection, nuDifference: s.nuDifference,
        getPrepaidExcessAmount: typeof s.getPrepaidExcessAmount === 'function' ? String(s.getPrepaidExcessAmount()) : null,
        tieneEnsure: typeof s.ensureAutomatedPrepaidPaymentTemplate === 'function'
      };
    } catch (e) { return { err: e.message }; }
  }).catch(e => ({ err: e.message }));
}

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
      try { await H.irAHomeCobros(); } catch (_) {}
    }
    if (await H.isHomeCobrosVisible().catch(() => false)) return true;
    await pg.waitForTimeout(1200);
  }
  return H.isHomeCobrosVisible().catch(() => false);
}

async function colaEquipo(pg, H) {
  try { const l = await H.abrirListaCobros(); return { total: l.total, guardados: l.guardados, enviados: l.enviados }; }
  catch (_) { return null; }
}

const CAPTURAS = [];
function fin(browser, veredicto, extra) {
  const out = Object.assign({ marca: MARCA, tipo: TIPO, veredicto, ts: new Date().toISOString() },
    extra, { capturas: CAPTURAS, log: LOG });
  const f = path.join(__dirname, 'caso2_' + MARCA + '.json');
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
  const A = makeAlertas(pg);

  async function captura(momento) {
    const al = await A.dumpAlertas(momento);
    const bn = await A.dumpBanner(momento);
    const sd = await A.sondaAvisos();
    CAPTURAS.push({ momento, alertas: al, banner: bn, sonda: sd });
    const vis = al.visibles.map(v => '<<' + [v.titulo, v.mensaje].filter(Boolean).join(' - ') + '>> btns=' + JSON.stringify(v.botonesVisibles));
    say('  [D] ' + momento + ': alertas DOM=' + al.total + ' visibles=' + al.visibles.length +
        (vis.length ? ' -> ' + vis.join(' | ') : '') +
        ' | banner=' + (bn.presente ? '<<' + bn.mensaje + '>>' : 'no') +
        ' | sonda shouldInform=' + sd.shouldInform + ' shouldBanner=' + sd.shouldBanner);
    return al;
  }

  say('\n=== CASO2 ' + TIPO.toUpperCase() + ' - marca ' + MARCA + ' - excedente ' + EXC + ' ===');

  const dentro = await entrarCobros(pg, H);
  if (!dentro) { say('BLOQUEADO: no se pudo entrar al modulo Cobros'); return fin(browser, 'BLOCKED', { motivo: 'no se entro al modulo Cobros' }); }

  const ab = await H.abrirCobroConDocumento(CLIENTES, MARCA);
  if (!ab.ok) { say('BLOQUEADO al montar: ' + ab.motivo); return fin(browser, 'BLOCKED', { motivo: ab.motivo }); }
  const doc = await docMarcado(pg);
  say('  cliente ' + ab.cliente + ' - docs ' + ab.docs + ' - total a pagar ' + ab.total + ' (=' + ab.saldo + ')');
  say('  documento: ' + doc);
  await captura('01-documento-marcado');

  const pagar = Math.round((ab.saldo + EXC) * 100) / 100;
  const digitos = String(Math.round(pagar * 100));
  const pago = await H.agregarPagoEfectivo(digitos);
  if (!pago.ok) { say('BLOQUEADO en pago: ' + pago.error); return fin(browser, 'BLOCKED', { motivo: pago.error }); }
  await pg.waitForTimeout(1500);
  const alPago = await captura('02-tras-teclear-excedente');
  if (alPago.visibles.length) {
    await H.clickAlertBtn(['Aceptar', 'OK']).catch(e => say('  (no se pudo cerrar el aviso: ' + e.message + ')'));
    await pg.waitForTimeout(900);
    await captura('03-tras-cerrar-aviso');
  }
  const sticky = await H.leerPagosSticky();
  say('  pagado ' + pagar + ' - Diferencia en pantalla: ' + sticky.difVal + ' (' + sticky.difColor + ')');

  if (TIPO === 'reab') {
    const cg = await H.clickGuardarEnviar('imagenGuardar');
    say('  clic GUARDAR -> ' + (cg.ok ? 'ok (' + cg.via + ')' : 'FALLO ' + cg.motivo));
    if (!cg.ok) return fin(browser, 'BLOCKED', { motivo: 'Guardar: ' + cg.motivo });
    await pg.waitForTimeout(1800);
    await captura('04-tras-Guardar');
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
    await pg.waitForTimeout(2000);
    await captura('05-recien-reabierto');
    await pg.waitForTimeout(3500);
    await captura('06-reabierto-asentado');
  }

  const antes = await sondaModelo(pg);
  say('  modelo antes de Enviar: ' + JSON.stringify(antes).slice(0, 500));
  await captura('07-justo-antes-de-Enviar');

  const idx = consola.length;
  const ce = await H.clickGuardarEnviar('imagenEnviar');
  say('  clic Enviar -> ' + (ce.ok ? 'ok (' + ce.via + ')' : 'sin reaccion detectada: ' + ce.motivo));
  await pg.waitForTimeout(1800);
  await captura('08-tras-pulsar-Enviar');
  if (!ce.ok) {
    const vivo = await H.readAlert();
    if (!vivo) return fin(browser, 'BLOCKED', { motivo: 'Enviar: ' + ce.motivo, consola: desde(idx) });
    say('  (el clic si habia salido: dialogo vivo)');
  }
  for (let i = 0; i < 4; i++) {
    const a = await H.readAlert();
    if (!a) break;
    say('  dialogo ' + (i + 1) + ': ' + a);
    await captura('09-dialogo-envio-' + (i + 1));
    await H.clickAlertBtn(['Aceptar', 'OK', 'Si']).catch(() => {});
    await pg.waitForTimeout(2600);
  }
  await pg.waitForTimeout(1500);
  await captura('10-tras-envio');

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
  const cola = await colaEquipo(pg, H);
  say('  cola del equipo: ' + JSON.stringify(cola));

  const hayAnticipo = !!(nube.anticipos && nube.anticipos.length);
  const veredicto = hayAnticipo ? 'PASS' : 'FAIL';
  say('  => ' + veredicto + ' - anticipo ' + (hayAnticipo ? 'GENERADO' : 'AUSENTE'));

  const rx = /ANTICIPO|anticipoAutomatico|payment|PAYMENT|hu.rfano|CobrosHeader|repaid|errorMessage|COLLECTION|AutoSend/;
  const clave = desde(idx).filter(l => rx.test(l));
  say('\n  -- consola del envio (lineas clave) --');
  clave.forEach(l => say('  ' + l));

  await H.abandonarCobro().catch(() => {});
  return fin(browser, veredicto, {
    cliente: ab.cliente, doc: doc, total: ab.total, pagado: pagar, excedente: EXC,
    difPantalla: sticky.difVal, modeloAntes: antes,
    nube: { resumen: nube.resumen, filas: nube.filas }, cola: cola,
    consolaEnvio: desde(idx), consolaClave: clave
  });
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });
