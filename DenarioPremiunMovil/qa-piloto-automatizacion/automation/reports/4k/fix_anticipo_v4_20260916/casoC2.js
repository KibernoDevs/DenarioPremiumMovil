'use strict';
/**
 * Caso C2 - no regresion: descuento MAYOR que el saldo del documento.
 *   node casoC2.js <cliente> <FACTURA> [nombreDescuento]
 *
 * Debe salir una CONFIRMACION de DOS botones (Cancelar / Aceptar) y CANCELAR
 * debe cancelar: ni anticipo, ni descuento aplicado. El cobro se abandona sin
 * enviar, asi que NO consume el documento.
 */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');
const fs = require('fs');
const path = require('path');

const [, , CLIENTE, FACTURA, NOMBRE] = process.argv;
const DESC = NOMBRE || 'Probando';
const MARCA = 'FIX23-C2-' + new Date().toTimeString().slice(0, 8).replace(/:/g, '');
const DATA = { clienteSlug: '4k', requiredComment: true };
const LOG = [];
const say = (...a) => { const s = a.join(' '); LOG.push(s); console.log(s); };
const consola = [];

async function alertaViva(pg) {
  return pg.evaluate(() => {
    const al = [...document.querySelectorAll('ion-alert')]
      .filter(a => !a.classList.contains('overlay-hidden') && a.offsetParent !== null).pop();
    if (!al) return null;
    return {
      txt: (al.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      botones: [...al.querySelectorAll('.alert-button')]
        .filter(b => b.getBoundingClientRect().width > 0).map(b => b.textContent.trim())
    };
  }).catch(() => null);
}

/** Pulsa un boton de la alerta viva verificando OCLUSION (elementFromPoint). */
async function pulsarBotonAlerta(pg, etiqueta) {
  const c = await pg.evaluate((lab) => {
    const al = [...document.querySelectorAll('ion-alert')]
      .filter(a => !a.classList.contains('overlay-hidden') && a.offsetParent !== null).pop();
    if (!al) return { err: 'sin alerta viva' };
    const btn = [...al.querySelectorAll('.alert-button')]
      .filter(b => b.getBoundingClientRect().width > 0)
      .find(b => new RegExp(lab, 'i').test(b.textContent.trim()));
    if (!btn) return { err: 'no esta el boton ' + lab };
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const en = document.elementFromPoint(x, y);
    return { x: x, y: y, label: btn.textContent.trim(),
             backdrop: !!(en && /ION-BACKDROP/i.test(en.tagName)), en: en ? en.tagName : null };
  }, etiqueta);
  if (c.err) return c;
  // El primer clic sobre el boton de una alerta puede caer en el ION-BACKDROP.
  if (c.backdrop) {
    await pg.evaluate((lab) => {
      const al = [...document.querySelectorAll('ion-alert')]
        .filter(a => !a.classList.contains('overlay-hidden') && a.offsetParent !== null).pop();
      const b = al && [...al.querySelectorAll('.alert-button')]
        .find(x => new RegExp(lab, 'i').test(x.textContent.trim()));
      if (b) b.click();
    }, etiqueta);
  } else {
    await pg.mouse.click(c.x, c.y, { delay: 110 });
  }
  await pg.waitForTimeout(1800);
  return c;
}

async function entrarCobros(pg, H) {
  if (await H.isHomeCobrosVisible().catch(() => false)) return true;
  for (let i = 0; i < 6; i++) {
    const enHomeApp = await pg.evaluate(() => {
      const v = [...document.querySelectorAll('.ion-page')].filter(p => !p.classList.contains('ion-page-hidden'))
        .map(p => p.tagName.toLowerCase()).pop() || '';
      return v === 'app-home';
    });
    if (enHomeApp) {
      const c = await pg.evaluate(() => {
        const col = [...document.querySelectorAll('app-home ion-col')]
          .find(e => /^Cobros$/i.test((e.innerText || '').replace(/\s+/g, ' ').trim()));
        if (!col) return null;
        const r = col.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (!c) throw new Error('no encuentro el tile Cobros');
      await pg.mouse.click(c.x, c.y, { delay: 90 });
      await pg.waitForTimeout(2500);
    } else { try { await H.irAHomeCobros(); } catch (_) {} }
    if (await H.isHomeCobrosVisible().catch(() => false)) return true;
    await pg.waitForTimeout(1200);
  }
  return H.isHomeCobrosVisible().catch(() => false);
}

function fin(browser, veredicto, extra) {
  const out = Object.assign({ marca: MARCA, caso: 'C2', cliente: CLIENTE, veredicto, ts: new Date().toISOString() },
    extra, { log: LOG });
  fs.writeFileSync(path.join(__dirname, 'casoC2_' + MARCA + '.json'), JSON.stringify(out, null, 2));
  console.log('\n-> ' + veredicto);
  return browser.close().catch(() => {});
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 25000 });
  const pg = browser.contexts()[0].pages()[0];
  pg.on('console', m => { try { consola.push('[' + m.type() + '] ' + m.text()); } catch (_) {} });
  pg.on('pageerror', e => consola.push('[pageerror] ' + e.message));
  await pg.bringToFront();
  const H = makeHelpers(pg, DATA);

  say('=== CASO C2 - ' + CLIENTE + ' FAC ' + FACTURA + ' - descuento "' + DESC + '" - marca ' + MARCA + ' ===');
  if (!(await entrarCobros(pg, H))) return fin(browser, 'BLOCKED', { motivo: 'no se entro a Cobros' });

  await H.abandonarCobro().catch(() => {});
  if (!(await H.abrirNuevoCobro())) {
    await H.irAHomeCobros().catch(() => {});
    await pg.waitForTimeout(1500);
    if (!(await H.abrirNuevoCobro())) return fin(browser, 'BLOCKED', { motivo: 'no abrio el formulario' });
  }
  try { await H.seleccionarCliente(CLIENTE); }
  catch (e) { return fin(browser, 'BLOCKED', { motivo: 'cliente: ' + e.message }); }
  await H.fillComentario(MARCA);
  for (let i = 0; i < 8; i++) { if ((await H.tabsHabilitadas()) >= 4) break; await pg.waitForTimeout(700); }
  await H.clickTab('documentos');
  await H.cargarDocumentos();

  // marcar la factura por numero
  const m = await pg.evaluate((num) => {
    const d = document.querySelector('app-cobro-documents');
    if (!d) return null;
    const fila = [...d.querySelectorAll('ion-row.tabladocumentSalesVenta')]
      .filter(f => f.getBoundingClientRect().width > 0)
      .find(f => (f.innerText || '').includes(num));
    if (!fila) return null;
    const cb = fila.querySelector('ion-checkbox');
    cb.scrollIntoView({ block: 'center' });
    const r = cb.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, txt: (fila.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140) };
  }, FACTURA);
  if (!m) return fin(browser, 'BLOCKED', { motivo: 'no esta la factura ' + FACTURA + ' en el Tab Documentos' });
  say('  documento: ' + m.txt);
  await pg.mouse.click(m.x, m.y, { delay: 90 });
  await pg.waitForTimeout(1500);

  // detalle -> Asignar descuento
  const det = await H.abrirDetalleDocumento();
  say('  abrir detalle -> ' + JSON.stringify(det));
  const mod = await H.abrirModalDescuentos();
  say('  abrir modal descuentos -> ' + mod);
  if (!mod) return fin(browser, 'BLOCKED', { motivo: 'no abrio el modal de descuentos' });
  const l0 = await H.leerModalDescuentos();
  say('  filas: ' + JSON.stringify(l0.filas) + ' - disponible ' + l0.disponible + '%');

  const tg = await H.toggleDescuento(DESC);
  say('  tildar "' + DESC + '" -> ' + tg);
  await pg.waitForTimeout(1000);
  const l1 = await H.leerModalDescuentos();
  say('  tras tildar: ' + JSON.stringify(l1.filas) + ' - Aceptar deshabilitado: ' + l1.aceptarDeshabilitado);

  // pulsar Aceptar del MODAL (sin dejar que nadie atienda la alerta)
  const c = await pg.evaluate(() => {
    const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
      .find(x => x.getBoundingClientRect().width > 0);
    if (!modal) return { err: 'modal cerrado' };
    const btn = [...modal.querySelectorAll('ion-button')]
      .filter(b => b.getBoundingClientRect().width > 0)
      .find(b => /aceptar/i.test((b.textContent || '').trim()));
    if (!btn) return { err: 'sin boton Aceptar' };
    if (btn.disabled || btn.hasAttribute('disabled')) return { err: 'Aceptar deshabilitado' };
    btn.scrollIntoView({ block: 'center' });
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const en = document.elementFromPoint(x, y);
    const tapado = !(en && (en === btn || btn.contains(en) || (en.closest && en.closest('ion-button') === btn)));
    return { x: x, y: y, tapado: tapado, en: en ? en.tagName : null };
  });
  if (c.err) return fin(browser, 'BLOCKED', { motivo: 'Aceptar del modal: ' + c.err });
  say('  Aceptar del modal: tapado=' + c.tapado + ' (' + c.en + ')');
  if (!c.tapado) await pg.mouse.click(c.x, c.y, { delay: 100 });
  else await pg.evaluate(() => {
    const mm = [...document.querySelectorAll('ion-modal.collectDiscounts')].find(x => x.getBoundingClientRect().width > 0);
    const b = mm && [...mm.querySelectorAll('ion-button')].find(x => /aceptar/i.test((x.textContent || '').trim()));
    if (b) ((b.shadowRoot && b.shadowRoot.querySelector('button')) || b).click();
  });
  await pg.waitForTimeout(2200);

  // ── LA CONFIRMACION ──
  const al = await alertaViva(pg);
  say('  >> CONFIRMACION C2: ' + (al ? al.txt : '(ninguna)'));
  say('  >> BOTONES C2: ' + JSON.stringify(al && al.botones));

  let trasCancelar = null, modalSigue = null, l2 = null;
  if (al && al.botones && al.botones.length === 2) {
    const p = await pulsarBotonAlerta(pg, 'cancelar');
    say('  pulsar CANCELAR -> ' + JSON.stringify(p));
    await pg.waitForTimeout(1500);
    trasCancelar = await alertaViva(pg);
    say('  alerta tras Cancelar: ' + (trasCancelar ? trasCancelar.txt : 'null (se cerro)'));
    modalSigue = await pg.evaluate(() =>
      [...document.querySelectorAll('ion-modal.collectDiscounts')].some(x => x.getBoundingClientRect().width > 0));
    say('  el modal de descuentos sigue abierto: ' + modalSigue);
    l2 = await H.leerModalDescuentos();
    say('  estado del modal tras Cancelar: ' + JSON.stringify(l2.filas));
  }

  // ¿se creo algun anticipo? -> no debe haber NINGUNA fila con esta marca
  const nube = await H.verificarNube(MARCA, 2);
  say('  nube con la marca ' + MARCA + ': ' + nube.resumen);

  // cerrar sin aplicar y abandonar (NO se envia: el documento no se consume)
  await H.cerrarDescuentosSinAplicar().catch(() => {});
  await pg.waitForTimeout(1000);
  await H.abandonarCobro().catch(() => {});

  const dosBotones = !!(al && al.botones && al.botones.length === 2);
  const cancelo = trasCancelar === null;
  const sinAnticipo = !(nube.filas && nube.filas.length);
  const veredicto = (dosBotones && cancelo && sinAnticipo) ? 'PASS' : 'FAIL';
  say('  => ' + veredicto + ' - dos botones: ' + dosBotones + ' - Cancelar cerro: ' + cancelo + ' - sin anticipo: ' + sinAnticipo);

  return fin(browser, veredicto, {
    documento: m.txt, filasAntes: l0.filas, filasTrasTildar: l1.filas,
    confirmacion: al, trasCancelar: trasCancelar, modalSigueAbierto: modalSigue,
    filasTrasCancelar: l2 && l2.filas, nube: { resumen: nube.resumen, filas: nube.filas }
  });
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });
