'use strict';
/**
 * Caso B - anticipo por NOTA DE CREDITO (saldo a favor).
 *   node casoB.js <cliente> <FACTURA> <NOTA> reab|dir|explorar [parcial]
 *
 * Orden obligatorio: se marca PRIMERO la factura (la app corta si el primer
 * documento seleccionado tiene monto negativo) y DESPUES la nota de credito.
 * Al marcar la nota debe salir el aviso de saldo a favor -> eso es el caso C1.
 */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');
const fs = require('fs');
const path = require('path');

const [, , CLIENTE, FACTURA, NOTA, MODOARG, PARCIAL] = process.argv;
const MODO = (MODOARG || 'explorar').toLowerCase();
const MARCA = 'FIX23-B' + (CLIENTE || '').replace(/\D/g, '') + '-' + MODO.toUpperCase().slice(0, 4) + '-' +
  new Date().toTimeString().slice(0, 8).replace(/:/g, '');

const DATA = { clienteSlug: '4k', requiredComment: true };
const LOG = [];
const say = (...a) => { const s = a.join(' '); LOG.push(s); console.log(s); };
const consola = [];
const desde = (i) => consola.slice(i);

// ── Dump de la tabla de Documentos (ion-row.tabladocumentSalesVenta, no <table>) ──
async function dumpDocs(pg) {
  return pg.evaluate(() => {
    const d = document.querySelector('app-cobro-documents');
    if (!d || d.offsetParent === null) return { visible: false, filas: [] };
    const filas = [...d.querySelectorAll('ion-row.tabladocumentSalesVenta')]
      .filter(f => f.getBoundingClientRect().width > 0)
      .map((f, i) => {
        const cb = f.querySelector('ion-checkbox');
        return {
          i: i,
          txt: (f.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 150),
          marcado: !!(cb && (cb.checked === true || cb.getAttribute('aria-checked') === 'true'))
        };
      });
    return { visible: true, filas: filas, texto: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400) };
  }).catch(e => ({ visible: false, err: e.message, filas: [] }));
}

/** Marca el documento cuya fila contiene `numero`. Devuelve el aviso que salga. */
async function marcarDocumento(pg, H, numero) {
  const c = await pg.evaluate((num) => {
    const d = document.querySelector('app-cobro-documents');
    if (!d) return null;
    const fila = [...d.querySelectorAll('ion-row.tabladocumentSalesVenta')]
      .filter(f => f.getBoundingClientRect().width > 0)
      .find(f => (f.innerText || '').includes(num));
    if (!fila) return null;
    const cb = fila.querySelector('ion-checkbox');
    if (!cb) return null;
    cb.scrollIntoView({ block: 'center' });
    const r = cb.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const en = document.elementFromPoint(x, y);
    return { x: x, y: y, tapa: en ? en.tagName : null };
  }, numero);
  if (!c) return { ok: false, motivo: 'no encuentro la fila de ' + numero };
  await pg.mouse.click(c.x, c.y, { delay: 90 });
  await pg.waitForTimeout(1800);
  const aviso = await H.readAlert();
  let botones = null;
  if (aviso) {
    botones = await pg.evaluate(() => {
      const al = [...document.querySelectorAll('ion-alert')]
        .filter(a => !a.classList.contains('overlay-hidden') && a.offsetParent !== null).pop();
      if (!al) return null;
      return [...al.querySelectorAll('.alert-button')]
        .filter(b => b.getBoundingClientRect().width > 0).map(b => b.textContent.trim());
    });
  }
  return { ok: true, tapa: c.tapa, aviso: aviso, botones: botones };
}

/** Metodo «Otros»: hay que elegir en el selector Y rellenar «Especifique». */
async function agregarOtros(pg, H, digitos) {
  const add = await pg.evaluate(() => {
    const b = document.querySelector('ion-button#eventSelect, ion-button.pagos-add-method-btn');
    if (!b || b.disabled || b.getBoundingClientRect().width === 0) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!add) return { ok: false, error: 'boton Agregar metodo ausente/disabled' };
  await pg.mouse.click(add.x, add.y, { delay: 100 });
  await pg.waitForTimeout(1500);
  const ok = await pg.evaluate(() => {
    const mod = [...document.querySelectorAll('#eventModal')].find(m => m.offsetParent !== null);
    if (!mod) return false;
    const it = [...mod.querySelectorAll('ion-item')].find(i => /Otros/i.test(i.textContent));
    if (!it) return false;
    const cb = it.querySelector('ion-checkbox');
    if (!cb) return false;
    cb.checked = true;
    cb.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { checked: true } }));
    return true;
  });
  if (!ok) return { ok: false, error: 'no hay metodo «Otros» en #eventModal' };
  await pg.waitForTimeout(700);
  await pg.evaluate(() => {
    const mod = [...document.querySelectorAll('#eventModal')].find(m => m.offsetParent !== null);
    const b = mod && [...mod.querySelectorAll('ion-button.botonAddVerde')].find(x => x.getBoundingClientRect().width > 0);
    if (b) b.click();
  });
  await pg.waitForTimeout(1800);
  // expandir acordeones
  await pg.evaluate(() => {
    document.querySelectorAll('app-cobro-pagos ion-accordion-group').forEach(g => {
      const a = g.querySelector('ion-accordion');
      const v = a ? a.getAttribute('value') : null;
      if (v) { g.value = v; g.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: v } })); }
    });
  });
  await pg.waitForTimeout(1200);
  // seleccionar el tipo «test_excedente» en el ion-select y rellenar «Especifique»
  const sel = await pg.evaluate(() => {
    const p = document.querySelector('app-cobro-pagos');
    if (!p) return { ok: false, err: 'sin app-cobro-pagos' };
    const selects = [...p.querySelectorAll('ion-select')].filter(s => s.getBoundingClientRect().width > 0);
    const out = { selects: selects.length, opciones: [], elegido: null };
    for (const s of selects) {
      const ops = [...s.querySelectorAll('ion-select-option')].map(o => (o.textContent || '').trim());
      out.opciones.push(ops);
      const idx = ops.findIndex(o => /test_excedente|excedente/i.test(o));
      if (idx >= 0) {
        const val = [...s.querySelectorAll('ion-select-option')][idx].value;
        s.value = val;
        s.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: val } }));
        out.elegido = ops[idx];
        break;
      }
    }
    return out;
  });
  await pg.waitForTimeout(1200);
  // «Especifique» + Monto
  const campos = await pg.evaluate((dig) => {
    const p = document.querySelector('app-cobro-pagos');
    if (!p) return { ok: false };
    const ins = [...p.querySelectorAll('ion-input')].filter(i => i.getBoundingClientRect().width > 0);
    const info = ins.map(i => ({ label: String(i.getAttribute('label') || i.label || ''),
      ph: String(i.getAttribute('placeholder') || ''),
      im: (i.querySelector('input') || {}).inputMode || '' }));
    const esp = ins.find(i => /especifi/i.test(String(i.getAttribute('label') || i.label || '') + String(i.getAttribute('placeholder') || '')));
    if (esp) {
      const n = esp.querySelector('input');
      if (n) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(n, 'QA excedente');
        n.dispatchEvent(new Event('input', { bubbles: true }));
        n.dispatchEvent(new Event('change', { bubbles: true }));
        esp.value = 'QA excedente';
        esp.dispatchEvent(new CustomEvent('ionInput', { bubbles: true, detail: { value: 'QA excedente' } }));
        esp.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: 'QA excedente' } }));
      }
    }
    const monto = ins.find(i => { const n = i.querySelector('input'); return n && n.getAttribute('inputmode') === 'numeric'; });
    if (monto) { const n = monto.querySelector('input'); if (n) { n.focus(); window.__qaMontoInput = n; } }
    return { ok: !!monto, especifique: !!esp, inputs: info };
  }, digitos);
  if (campos.ok) {
    for (let i = 0; i < 12; i++) await pg.keyboard.press('Backspace');
    await pg.keyboard.type(digitos, { delay: 40 });
    await pg.evaluate(() => { const n = window.__qaMontoInput; if (n) n.dispatchEvent(new Event('blur', { bubbles: true })); });
    await pg.waitForTimeout(1200);
  }
  return { ok: true, sel: sel, campos: campos };
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
  const out = Object.assign({ marca: MARCA, cliente: CLIENTE, modo: MODO, veredicto, ts: new Date().toISOString() },
    extra, { log: LOG });
  fs.writeFileSync(path.join(__dirname, 'casoB_' + MARCA + '.json'), JSON.stringify(out, null, 2));
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

  say('=== CASO B - ' + CLIENTE + ' FAC ' + FACTURA + ' + N/C ' + NOTA + ' - modo ' + MODO + ' - marca ' + MARCA + ' ===');
  if (!(await entrarCobros(pg, H))) return fin(browser, 'BLOCKED', { motivo: 'no se entro al modulo Cobros' });

  await H.abandonarCobro().catch(() => {});
  if (!(await H.abrirNuevoCobro())) {
    await H.irAHomeCobros().catch(() => {});
    await pg.waitForTimeout(1500);
    if (!(await H.abrirNuevoCobro())) return fin(browser, 'BLOCKED', { motivo: 'no abrio el formulario' });
  }
  try { await H.seleccionarCliente(CLIENTE); }
  catch (e) { return fin(browser, 'BLOCKED', { motivo: 'cliente: ' + e.message }); }
  await H.fillComentario(MARCA);
  let h = 0;
  for (let i = 0; i < 8; i++) { h = await H.tabsHabilitadas(); if (h >= 4) break; await pg.waitForTimeout(700); }
  say('  pestanas habilitadas: ' + h);
  await H.clickTab('documentos');
  const carga = await H.cargarDocumentos();
  const docs = await dumpDocs(pg);
  say('  Tab Documentos: ' + (docs.visible ? docs.filas.length + ' filas' : 'NO visible') + ' (cbs ' + carga.cbs + ')');
  docs.filas.forEach(f => say('    [' + f.i + '] ' + (f.marcado ? 'X' : ' ') + ' ' + f.txt));
  if (!docs.filas.length) say('  TEXTO: ' + (docs.texto || '-'));

  const tieneFac = docs.filas.some(f => f.txt.includes(FACTURA));
  const tieneNc = docs.filas.some(f => f.txt.includes(NOTA));
  say('  factura ' + FACTURA + ' presente: ' + tieneFac + ' - nota ' + NOTA + ' presente: ' + tieneNc);

  if (MODO === 'explorar' || !tieneFac) {
    await H.abandonarCobro().catch(() => {});
    return fin(browser, (tieneFac && tieneNc) ? 'DISPONIBLE' : 'NO-DISPONIBLE',
      { docs: docs, tieneFac: tieneFac, tieneNc: tieneNc });
  }

  // 1 - PRIMERO la factura
  const m1 = await marcarDocumento(pg, H, FACTURA);
  say('  marcar FACTURA ' + FACTURA + ' -> ' + JSON.stringify(m1));
  if (m1.aviso) await H.clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
  await pg.waitForTimeout(1000);

  // 1b - si hay parcial: toggle «Pago parcial» en el DETALLE de la factura y
  //      se escribe el monto. Se hace ANTES de marcar la nota para que el
  //      excedente que anuncie el aviso ya cuente con el parcial.
  if (PARCIAL) {
    if (!(await H.abrirDetalleDocumento())) return fin(browser, 'BLOCKED', { motivo: 'no abrio el detalle de la factura' });
    const f0 = await H.fotoDetalle();
    const rot = Object.keys(f0.campos || {}).find(k => /monto a pagar/i.test(k));
    say('  detalle: "' + rot + '" = ' + JSON.stringify(rot && f0.campos[rot]));
    const tg = await H.togglePagoParcial();
    say('  toggle Pago parcial -> ' + JSON.stringify(tg));
    if (tg.err) return fin(browser, 'BLOCKED', { motivo: tg.err });
    const esc = await H.escribirEnModal(/monto a pagar/i, String(Math.round(Number(PARCIAL) * 100)));
    say('  escribir parcial ' + PARCIAL + ' -> ' + JSON.stringify(esc));
    if (!esc.ok) return fin(browser, 'BLOCKED', { motivo: 'no se pudo escribir el parcial: ' + esc.err });
    const f1 = await H.fotoDetalle();
    say('  detalle tras el parcial: ' + JSON.stringify(rot && f1.campos[rot]));
    const cerr = await H.cerrarDetalleGuardando();
    say('  cerrar detalle guardando -> ' + JSON.stringify(cerr));
    if (!cerr.ok) return fin(browser, 'BLOCKED', { motivo: 'el detalle no se guardo: ' + cerr.motivo });
    await H.clickTab('documentos');
    await pg.waitForTimeout(1200);
  }

  // 2 - DESPUES la nota de credito -> aqui sale el aviso de saldo a favor (C1)
  const m2 = await marcarDocumento(pg, H, NOTA);
  say('  marcar NOTA ' + NOTA + ' -> tapa ' + m2.tapa);
  say('  >> AVISO C1: ' + (m2.aviso || '(ninguno)'));
  say('  >> BOTONES C1: ' + JSON.stringify(m2.botones));
  if (m2.aviso) { await H.clickAlertBtn(['Aceptar', 'OK']).catch(() => {}); await pg.waitForTimeout(1200); }

  const docs2 = await dumpDocs(pg);
  docs2.filas.forEach(f => say('    [' + f.i + '] ' + (f.marcado ? 'X' : ' ') + ' ' + f.txt));

  // 3 - Pagos
  await H.clickTab('pagos');
  await pg.waitForTimeout(1500);
  const sticky0 = await H.leerPagosSticky();
  say('  sticky: total ' + sticky0.total + ' - Diferencia ' + sticky0.difVal + ' (' + sticky0.difColor + ')');

  // El monto del metodo «Otros» va a 0: con la nota de credito cubriendo el
  // documento, el «Monto total a pagar» ya es 0 y el excedente sale de la nota.
  // El parcial NO se cobra aqui: se fijo en el detalle del documento.
  const pago = await agregarOtros(pg, H, '0');
  say('  metodo Otros' + (PARCIAL ? ' (con parcial ' + PARCIAL + ' en el documento)' : '') +
      ' -> ' + JSON.stringify(pago && pago.sel));
  say('  campos: ' + JSON.stringify(pago && pago.campos && { ok: pago.campos.ok, especifique: pago.campos.especifique }));
  const sticky1 = await H.leerPagosSticky();
  say('  sticky tras pago: total ' + sticky1.total + ' - Diferencia ' + sticky1.difVal);

  // 4 - camino
  if (MODO === 'reab') {
    const cg = await H.clickGuardarEnviar('imagenGuardar');
    say('  clic GUARDAR -> ' + (cg.ok ? 'ok (' + cg.via + ')' : 'sin reaccion: ' + cg.motivo));
    await pg.waitForTimeout(1800);
    const alG = await H.readAlert();
    say('  alerta tras Guardar: ' + (alG || '-'));
    if (alG) { await H.clickAlertBtn(['Aceptar', 'OK']).catch(() => {}); await pg.waitForTimeout(1600); }
    if (!(alG && /guardad/i.test(alG))) return fin(browser, 'BLOCKED', { motivo: 'no confirmo el guardado: ' + alG, docs: docs });
    await H.abandonarCobro().catch(() => {});
    await pg.waitForTimeout(1200);
    const lista = await H.abrirListaCobros();
    say('  lista: ' + lista.total + ' items - ' + lista.guardados + ' Guardados');
    const re = await H.reabrirGuardado(MARCA);
    say('  REABRIR por marca -> ' + re);
    if (!re) return fin(browser, 'BLOCKED', { motivo: 'no se reabrio el Guardado' });
    await pg.waitForTimeout(1500);
  }

  const idx = consola.length;
  const ce = await H.clickGuardarEnviar('imagenEnviar');
  say('  clic ENVIAR -> ' + (ce.ok ? 'ok (' + ce.via + ')' : 'sin reaccion: ' + ce.motivo));
  await pg.waitForTimeout(1800);
  if (!ce.ok) {
    const vivo = await H.readAlert();
    if (!vivo) return fin(browser, 'BLOCKED', { motivo: 'Enviar: ' + ce.motivo, consolaEnvio: desde(idx) });
    say('  (el clic si habia salido)');
  }
  for (let i = 0; i < 3; i++) {
    const a = await H.readAlert();
    if (!a) break;
    say('  dialogo ' + (i + 1) + ': ' + a);
    await H.clickAlertBtn(['Aceptar', 'OK', 'Si']).catch(() => {});
    await pg.waitForTimeout(2800);
  }
  await pg.waitForTimeout(1500);

  let nube = await H.verificarNube(MARCA, 6);
  say('  nube: ' + nube.resumen + (nube.aviso || ''));
  if (!nube.anticipos || !nube.anticipos.length) {
    say('  ... sin anticipo: repoll ~100 s');
    for (let i = 0; i < 10; i++) {
      await pg.waitForTimeout(10000);
      const otra = await H.verificarNube(MARCA, 1);
      if (otra && otra.filas) nube = otra;
      say('    +' + ((i + 1) * 10) + 's -> ' + nube.resumen);
      if (nube.anticipos && nube.anticipos.length) break;
    }
  }
  const hay = !!(nube.anticipos && nube.anticipos.length);
  const veredicto = hay ? 'PASS' : 'FAIL';
  say('  => ' + veredicto + ' - anticipo ' + (hay ? 'GENERADO' : 'AUSENTE'));
  const rx = /ANTICIPO|anticipoAutomatico|payment|PAYMENT|hu.rfano|CobrosHeader|repaid|errorMessage|COLLECTION|AutoSend/;
  const clave = desde(idx).filter(l => rx.test(l));
  clave.forEach(l => say('  ' + l));

  await H.abandonarCobro().catch(() => {});
  return fin(browser, veredicto, {
    docs: docs, avisoC1: m2.aviso, botonesC1: m2.botones,
    stickyAntes: sticky0, stickyDespues: sticky1,
    nube: { resumen: nube.resumen, filas: nube.filas },
    consolaEnvio: desde(idx), consolaClave: clave
  });
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });
