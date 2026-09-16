'use strict';

const { execFileSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { installPayloadCapture, getCapturedPayloads } = require('../../cdp/denario-cdp-helpers');
const { reqInicio, reqRechazo, reqPestanaRoja, reqIds, conReq } = require('../req-enviar');

const COTEJO_PAYLOAD_PATH = path.resolve(__dirname, '../../db/cotejo-payload.js');

/** Corre cotejo-payload.js con un payload capturado ({url,data}). Devuelve marca o 'BD-N/A'. */
function cotejoPayload(slug, payload) {
  const tmp = path.join(os.tmpdir(), `qa_dev_payload_${Date.now()}.json`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(payload));
    const r = JSON.parse(
      execFileSync('node', [COTEJO_PAYLOAD_PATH, slug, tmp], { encoding: 'utf8', timeout: 30000 })
    );
    const mismatches = ((r.resumen || {}).mismatches || []).slice(0, 2).join('; ');
    return r.marca + (mismatches ? ` (${mismatches})` : '');
  } catch (_) { return 'BD-N/A'; }
  finally { try { fs.unlinkSync(tmp); } catch (_) {} }
}

/**
 * modules/devoluciones.js — 25 casos smoke
 * @param {import('playwright').Page} pg
 * @param {{ aplica:boolean, clienteTest:string, productoTest:string, facturaTest:string,
 *           validateReturn:boolean, signatureReturn:boolean, userCanUploadFiles:boolean,
 *           clienteSlug:string }} DATA
 */
async function runDevoluciones(pg, DATA) {
  const t0 = Date.now();
  const verdicts = [];

  function v(id, desc, resultado, nota = '') {
    verdicts.push({ id, descripcion: desc, resultado, nota, ms: Date.now() - t0 });
  }

  // Regresión permanente del REQ «Botón Enviar y campos obligatorios» (../req-enviar.js)
  const reqV = (r) => v(r.id, r.descripcion, r.resultado, r.nota);

  const TODOS = [
    'DM-DEV-001','DM-DEV-002','DM-DEV-003','DM-DEV-004','DM-DEV-005',
    'DM-DEV-006','DM-DEV-007','DM-DEV-008','DM-DEV-009','DM-DEV-010',
    'DM-DEV-011','DM-DEV-012','DM-DEV-013','DM-DEV-014','DM-DEV-015',
    'DM-DEV-016','DM-DEV-017','DM-DEV-018','DM-DEV-019','DM-DEV-020',
    'DM-DEV-021','DM-DEV-022','DM-DEV-023','DM-DEV-024','DM-DEV-025',
    // Cobertura añadida 2026-08-31: la app debe RECHAZAR cantidades mayores a lo
    // facturado. Faltaba, y su ausencia dejó pasar un envío inválido del guion.
    'DM-DEV-VAL-001',
    ...reqIds('DEV'),
  ];

  if (!DATA.aplica) {
    TODOS.forEach(id => v(id, id, 'N/A', 'aplica=false en perfil devoluciones'));
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // Captura de payloads para cotejo BD (return↔nube en DEV-018) — nunca tumba el smoke
  try { await installPayloadCapture(pg); } catch (_) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  // 🔴 CASCADA DE CANDIDATOS. Un solo selector no basta:
  //    · hay DOS `img.fechaAtras` en el header (x≈10 y x≈302); sólo el de la
  //      izquierda es el atrás — de ahí el filtro por posición.
  //    · en algunas pantallas el control es `ion-back-button` o un `ion-button`
  //      del slot start.
  //    Se prueban en orden y se informa CUÁL se usó, para poder depurar. [prc-20260831]
  async function clickBack() {
    const cand = await pg.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const coords = (el, via) => {
        const t = el.closest('a') || el;          // el <a> es el que lleva el routerLink
        const r = t.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, via };
      };
      // 1 · el atrás canónico: arriba a la izquierda
      const izq = [...document.querySelectorAll('img.fechaAtras')].filter(vis)
        .find(i => { const r = i.getBoundingClientRect(); return r.x < 120 && r.y < 120; });
      if (izq) return coords(izq, 'img.fechaAtras (izquierda)');
      // 2 · cualquier fechaAtras visible
      const cualquiera = [...document.querySelectorAll('img.fechaAtras')].filter(vis)[0];
      if (cualquiera) return coords(cualquiera, 'img.fechaAtras (sin filtro)');
      // 3 · back-button de Ionic
      const bb = [...document.querySelectorAll('ion-back-button')].filter(vis)[0];
      if (bb) return coords(bb, 'ion-back-button');
      // 4 · primer botón del slot start del header
      const start = [...document.querySelectorAll('ion-buttons[slot="start"] ion-button')].filter(vis)[0];
      if (start) return coords(start, 'ion-buttons[slot=start]');
      return null;
    });
    if (!cand) throw new Error('Ningún control de "atrás" visible (img.fechaAtras / ion-back-button / slot start)');
    await pg.mouse.click(cand.x, cand.y, { delay: 60 });
    return cand.via;
  }

  async function clickAlertBtn(labels = ['Aceptar', 'OK']) {
    await pg.waitForTimeout(900);
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
          b.textContent.trim().toLowerCase() === lbl.toLowerCase() && b.getBoundingClientRect().width > 0
        );
        if (btn) { const r = btn.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: lbl }; }
      }
      // fallback: any visible button
      const anyBtn = [...alert.querySelectorAll('.alert-button')].find(b => b.getBoundingClientRect().width > 0);
      if (anyBtn) { const r = anyBtn.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: anyBtn.textContent.trim() }; }
      return null;
    }, labels);
    if (!coords) throw new Error('Alert btn no encontrado: ' + labels.join('/'));
    await pg.mouse.click(coords.x, coords.y);
    await pg.waitForTimeout(600);
    return coords.label;
  }

  async function dismissResidualAlerts() {
    const coordsList = await pg.evaluate(() => {
      function alertVisible(a) {
        const isTraditional = !a.classList.contains('overlay-hidden') && a.offsetParent !== null;
        const hasVisibleBtn = [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      }
      return [...document.querySelectorAll('ion-alert')]
        .filter(alertVisible)
        .map(a => {
          const btns = [...a.querySelectorAll('.alert-button')].filter(b => b.getBoundingClientRect().width > 0);
          const salir = btns.find(b => {
            const t = b.textContent.trim().toLowerCase();
            return t.includes('salir') && !t.includes('guardar');
          }) || btns.find(b => {
            const t = b.textContent.trim().toLowerCase();
            return t.includes('descartar') || t.includes('continuar');
          }) || btns.find(b => {
            const t = b.textContent.trim().toLowerCase();
            return !t.includes('cancel') && !t.includes('quedar') && !t.includes('volver') && !t.includes('guardar');
          });
          const btn = salir || btns[0];
          if (!btn) return null;
          const r = btn.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }).filter(Boolean);
    });
    for (const c of coordsList) {
      await pg.mouse.click(c.x, c.y, { delay: 60 });
      await pg.waitForTimeout(400);
    }
    await pg.waitForTimeout(300);
  }

  // 🔴 Comprobar sobre la PÁGINA VISIBLE, no sobre el documento: Ionic conserva las
  //    páginas anteriores en el DOM, así que `devoluciones-container` sigue existiendo
  //    aunque estemos dentro del formulario o de la lista. Buscar en todo el documento
  //    da "ya estamos en home" cuando no lo estamos. [prc-20260831]
  async function isHomeDevVisible() {
    return pg.evaluate(() => {
      const page = document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)');
      const cont = (page || document).querySelector('devoluciones-container');
      if (!cont) return false;
      const texts = [...cont.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .map(b => b.textContent.trim());
      return texts.some(t => /DEVOLUCI[ÓO]N|Return/i.test(t)) &&
             texts.some(t => /BUSCAR|Find/i.test(t));
    });
  }

  // ¿Estamos en el HOME DE LA APP (los tiles de módulos)?
  async function isAppHomeVisible() {
    return pg.evaluate(() => {
      const page = document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)') || document.body;
      return [...page.querySelectorAll('p.nombreModulos')].some(p => p.textContent.trim());
    });
  }

  // Entra al módulo desde el home de la app pulsando su tile.
  async function entrarAlModuloDev() {
    const tile = await pg.evaluate(() => {
      const page = document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)') || document.body;
      const t = [...page.querySelectorAll('a.ion-text-center')].find(a => {
        const p = a.querySelector('p.nombreModulos');
        return p && /Devoluci/i.test(p.textContent);
      });
      if (!t) return null;
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!tile) return false;
    await pg.mouse.click(tile.x, tile.y, { delay: 80 });
    await pg.waitForTimeout(2500);
    return true;
  }

  // 🔴 NAVEGA EN LAS DOS DIRECCIONES. Retroceder a ciegas se PASA DE LARGO: un
  //    "atrás" de más deja la app en el HOME DE LA APP, donde ya no hay control de
  //    atrás que pulsar, y los intentos restantes giran en vacío. Medido: 10 vías
  //    "sin control de atrás" con la app parada en APP-HOME. Si nos pasamos, se
  //    vuelve a ENTRAR al módulo por su tile. [prc-20260831]
  async function irAHomeDev(maxAttempts = 10) {
    const traza = [];
    for (let i = 0; i < maxAttempts; i++) {
      if (await isHomeDevVisible()) return;

      await limpiarOverlaysDev();
      await dismissResidualAlerts();

      // ¿Nos pasamos? Entonces no hay que retroceder más: hay que entrar.
      if (await isAppHomeVisible()) {
        const ok = await entrarAlModuloDev();
        traza.push(ok ? 'reentrar por el tile (nos pasamos al home de la app)' : 'tile Devoluciones no encontrado');
        if (await isHomeDevVisible()) return;
        continue;
      }

      try {
        const via = await clickBack();
        traza.push(via);
      } catch (e) {
        traza.push(`sin control de atrás (${e.message.slice(0, 40)})`);
      }
      await pg.waitForTimeout(1200);
      await dismissResidualAlerts();
      await pg.waitForTimeout(600);
    }
    if (!(await isHomeDevVisible())) {
      // Diagnóstico: sin esto el error dice "no se pudo" y no dónde quedó.
      const donde = await pg.evaluate(() => {
        const p = document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden)') || document.body;
        return {
          pagina: p.tagName,
          texto: (p.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
          modales: [...document.querySelectorAll('ion-modal')].filter(m => m.offsetParent !== null).length,
          alertas: [...document.querySelectorAll('ion-alert')].filter(a => a.getBoundingClientRect().width > 0).length,
        };
      });
      throw new Error(`No se pudo llegar a home devoluciones tras ${maxAttempts} intentos ` +
                      `[vías: ${traza.join(' → ')}] — quedó en ${JSON.stringify(donde)}`);
    }
  }

  async function clickBotonDev(texto) {
    const coords = await pg.evaluate((t) => {
      const btns = [...document.querySelectorAll('devoluciones-container ion-button')]
        .filter(b => b.textContent.trim().includes(t) && b.getBoundingClientRect().width > 0);
      if (!btns.length) return null;
      const r = btns[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, texto);
    if (!coords) throw new Error(`Botón "${texto}" no encontrado en home devoluciones`);
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
  }

  // Selecciona cliente: mismo patrón que inventarios (ion-input#clienteSelect → modal → buscar → click)
  // ────────────────────────────────────────────────────────────────────────────
  // Overlays que se quedan pegados y BLOQUEAN los clicks siguientes:
  //   · `ion-loading` con backdrop no-tappable al reabrir el formulario
  //   · acuses de UN botón ("...se ha guardado" + OK) que tapan la pantalla
  // Los de VARIOS botones son decisiones: no se tocan aquí. [prc-20260831]
  // ────────────────────────────────────────────────────────────────────────────
  async function limpiarOverlaysDev() {
    await pg.evaluate(async () => {
      for (const l of document.querySelectorAll('ion-loading')) { try { await l.dismiss(); } catch (_) {} }
      for (const bd of document.querySelectorAll('ion-backdrop')) {
        const padre = bd.closest('ion-alert, ion-modal, ion-popover, ion-loading, ion-action-sheet');
        if (!padre) { try { bd.remove(); } catch (_) {} }
      }
    });
    // 🔴🔴 NO DESCARTAR POR NÚMERO DE BOTONES — LEER EL MENSAJE.
    //
    //    Una alerta de UN SOLO BOTÓN puede ser un ACUSE ("La visita se ha guardado")
    //    …o un RECHAZO ("La cantidad a devolver debe estar entre 1 y 1"), que también
    //    trae sólo [OK] porque no te deja hacer otra cosa que aceptarlo.
    //
    //    La regla anterior ("1 botón ⇒ acuse ⇒ descartar") SILENCIÓ una validación:
    //    el guion envió una devolución de 3 unidades sobre una factura de 1, algo que
    //    a mano la app IMPIDE. El caso dio PASS sobre un registro imposible (id_return
    //    8 en piercar) — probó con ventaja, no como un usuario. [prc-20260831]
    //
    //    ⇒ LISTA BLANCA: sólo se descarta lo que se reconoce como acuse. Cualquier
    //      otro mensaje se DEJA EN PANTALLA para que el caso lo vea y falle.
    const ACUSES = /(se ha guardado|se ha eliminado|guardad|eliminad|enviad|exitosa|correctamente)/i;
    for (let i = 0; i < 4; i++) {
      const acuse = await pg.evaluate((patron) => {
        const vis = el => el.getBoundingClientRect().width > 0;
        const al = [...document.querySelectorAll('ion-alert')].filter(vis)[0];
        if (!al) return null;
        const btns = [...al.querySelectorAll('.alert-button')].filter(vis);
        if (btns.length !== 1) return null;
        if (!/^(ok|aceptar|entendido|cerrar)$/i.test(btns[0].textContent.trim())) return null;
        const msg = ((al.querySelector('.alert-message') || {}).textContent || '') + ' ' +
                    ((al.querySelector('.alert-title') || {}).textContent || '');
        if (!new RegExp(patron, 'i').test(msg)) return null;   // no reconocido ⇒ NO tocar
        const r = btns[0].getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, ACUSES.source);
      if (!acuse) break;
      await pg.mouse.click(acuse.x, acuse.y, { delay: 60 });
      await pg.waitForTimeout(800);
    }
  }

  // Rehace el formulario. Un formulario atascado con un cliente inservible NO se
  // recupera cambiando de cliente: hay que volver y abrirlo de nuevo. [prc-20260831]
  async function reabrirFormularioDev() {
    await limpiarOverlaysDev();
    try { await irAHomeDev(); } catch (_) { return false; }
    await limpiarOverlaysDev();
    await pg.waitForTimeout(800);
    try { await abrirFormDevolucion(); } catch (_) { return false; }
    await pg.waitForTimeout(1500);
    await limpiarOverlaysDev();
    return await pg.evaluate(() => !!document.querySelector('ion-input#clienteSelect'));
  }

  async function seleccionarCliente(nombre) {
    const selCoords = await pg.evaluate(() => {
      const inp = document.querySelector('ion-input#clienteSelect');
      if (!inp) return null;
      const r = inp.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!selCoords) throw new Error('ion-input#clienteSelect no encontrado');
    await pg.mouse.click(selCoords.x, selCoords.y, { delay: 80 });
    await pg.waitForTimeout(2000);

    let searchCoords = null;
    for (let i = 0; i < 26; i++) {
      await pg.waitForTimeout(500);
      searchCoords = await pg.evaluate(() => {
        for (const c of document.querySelectorAll('ion-modal, ion-popover')) {
          const inp = c.querySelector('input[type="search"], input[type="text"], input:not([type="hidden"])');
          if (inp && inp.getBoundingClientRect().width > 0) {
            const r = inp.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
        }
        return null;
      });
      if (searchCoords) break;
      if (i === 10) {
        const reCoords = await pg.evaluate(() => {
          const inp = document.querySelector('ion-input#clienteSelect');
          if (!inp) return null;
          const r = inp.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        if (reCoords) {
          await pg.mouse.click(reCoords.x, reCoords.y, { delay: 80 });
          await pg.waitForTimeout(2000);
        }
      }
    }
    if (!searchCoords) throw new Error('Modal cliente no abrió');

    await pg.mouse.click(searchCoords.x, searchCoords.y, { delay: 50, clickCount: 3 });
    await pg.keyboard.type(nombre ? nombre.slice(0, 8) : 'A', { delay: 30 });
    await pg.keyboard.press('Enter');
    await pg.waitForTimeout(2000);

    const termBusq = nombre ? nombre.slice(0, 8).toLowerCase() : '';
    const resultado = await pg.evaluate((term) => {
      const containers = [...document.querySelectorAll('ion-modal, ion-popover, ion-alert')]
        .filter(c => {
          const isTraditional = !c.classList.contains('overlay-hidden') && c.offsetParent !== null;
          const hasVisibleContent = [...c.querySelectorAll('p, ion-label, ion-item')].some(el => el.getBoundingClientRect().width > 0);
          return isTraditional || hasVisibleContent;
        });
      for (const c of containers) {
        const candidatos = [...c.querySelectorAll('p, ion-label, ion-item')]
          .filter(el => el.getBoundingClientRect().width > 0 && el.textContent.trim().length > 2);
        if (!candidatos.length) continue;
        const exacto = term ? candidatos.find(el => el.textContent.toLowerCase().includes(term)) : null;
        const target = exacto || candidatos[0];
        const r = target.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, nombre: target.textContent.trim().slice(0, 60) };
      }
      return null;
    }, termBusq);

    if (!resultado) throw new Error('Sin resultados en selector de clientes');
    await pg.mouse.click(resultado.x, resultado.y, { delay: 80 });
    await pg.waitForTimeout(1500);
    return resultado.nombre;
  }

  // Abre búsqueda con ZZZZZZZ, verifica mensaje de sin resultados, luego cierra modal
  async function buscarClienteZZZ() {
    const selCoords = await pg.evaluate(() => {
      const inp = document.querySelector('ion-input#clienteSelect');
      if (!inp) return null;
      const r = inp.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!selCoords) return { ok: false, nota: 'ion-input#clienteSelect no encontrado' };
    await pg.mouse.click(selCoords.x, selCoords.y, { delay: 80 });
    await pg.waitForTimeout(2000);

    let searchCoords = null;
    for (let i = 0; i < 16; i++) {
      await pg.waitForTimeout(500);
      searchCoords = await pg.evaluate(() => {
        for (const c of document.querySelectorAll('ion-modal, ion-popover')) {
          const inp = c.querySelector('input[type="search"], input[type="text"], input:not([type="hidden"])');
          if (inp && inp.getBoundingClientRect().width > 0) {
            const r = inp.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }
        }
        return null;
      });
      if (searchCoords) break;
    }
    if (!searchCoords) return { ok: false, nota: 'Modal cliente no abrió para busqueda ZZZZZZZ' };

    await pg.mouse.click(searchCoords.x, searchCoords.y, { delay: 50, clickCount: 3 });
    await pg.keyboard.type('ZZZZZZZ', { delay: 30 });
    await pg.keyboard.press('Enter');
    await pg.waitForTimeout(2000);

    const sinResultados = await pg.evaluate(() => {
      const empties = [...document.querySelectorAll('ion-modal, ion-popover')]
        .flatMap(c => [...c.querySelectorAll('p, ion-label')])
        .filter(el => {
          const t = el.textContent.trim().toLowerCase();
          const r = el.getBoundingClientRect();
          return r.width > 0 && (t.includes('no hay') || t.includes('sin resultado') || t.includes('disponible') || t.includes('empty') || t.includes('encontr'));
        });
      return empties.length > 0 ? empties[0].textContent.trim() : null;
    });

    // Cerrar modal con ESC o click en backdrop
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(800);
    // Si aún está abierto, click fuera
    const stillOpen = await pg.evaluate(() =>
      [...document.querySelectorAll('ion-modal, ion-popover')].some(c => {
        const inp = c.querySelector('input');
        return inp && inp.getBoundingClientRect().width > 0;
      })
    );
    if (stillOpen) {
      await pg.mouse.click(10, 10, { delay: 60 });
      await pg.waitForTimeout(800);
    }

    return { ok: true, msg: sinResultados || 'sin resultados (no visible)' };
  }

  // 🔴 Las pestañas se habilitan de forma ASÍNCRONA (en TIPO B, sólo tras elegir la
  //    factura). Fallar al primer vistazo confunde "aún no está lista" con "no existe",
  //    y el mensaje no dice cuál de las dos. Se sondea y, si no llega, se informa del
  //    estado REAL de todas las pestañas. [prc-20260831]
  async function clickTab(texto, segundos = 6) {
    let coords = null;
    for (let i = 0; i < segundos * 2; i++) {
      coords = await pg.evaluate((t) => {
        const tab = [...document.querySelectorAll('ion-segment-button')].find(
          s => s.textContent.trim().includes(t) && !s.disabled && s.getBoundingClientRect().width > 0
        );
        if (!tab) return null;
        const r = tab.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, texto);
      if (coords) break;
      await pg.waitForTimeout(500);
    }
    if (!coords) {
      const estado = await pg.evaluate(() =>
        [...document.querySelectorAll('ion-segment-button')]
          .filter(s => s.getBoundingClientRect().width > 0)
          .map(s => `${s.textContent.trim()}${(s.disabled || s.getAttribute('disabled') !== null) ? ' (disabled)' : ''}`)
      );
      throw new Error(`Tab "${texto}" no utilizable tras ${segundos}s — pestañas presentes: ` +
                      `[${estado.join(' · ')}]`);
    }
    await pg.mouse.click(coords.x, coords.y, { delay: 60 });
    await pg.waitForTimeout(1200);
  }

  async function fillIonInput(selector, value) {
    await pg.evaluate(([sel, val]) => {
      const ionEl = document.querySelector(sel);
      if (!ionEl) return;
      const inp = ionEl.querySelector('input') ||
                  (ionEl.shadowRoot && ionEl.shadowRoot.querySelector('input')) || ionEl;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(inp, val);
      inp.dispatchEvent(new Event('input',  { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      ionEl.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: val } }));
      ionEl.dispatchEvent(new CustomEvent('ionInput',  { bubbles: true, detail: { value: val } }));
    }, [selector, value]);
    await pg.waitForTimeout(300);
  }

  async function clickSave() {
    const coords = await pg.evaluate(() => {
      const btn = document.querySelector('ion-button.imagenGuardar');
      if (!btn || btn.disabled) return null;
      const r = btn.getBoundingClientRect();
      return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    });
    if (!coords) throw new Error('Botón guardar (.imagenGuardar) no disponible');
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
  }

  // 🔴 El botón puede tardar en habilitarse (el estado del formulario se recalcula al
  //    salir del campo cantidad). Se sondea, y si no llega se informa del MOTIVO real
  //    —ausente / deshabilitado / sin ancho— y del estado del formulario, en vez de
  //    un genérico "no disponible" que no dice nada. [prc-20260831]
  async function clickSend(segundos = 8) {
    let coords = null;
    for (let i = 0; i < segundos * 2; i++) {
      coords = await pg.evaluate(() => {
        const btn = document.querySelector('ion-button.imagenEnviar');
        if (!btn || btn.disabled || btn.getAttribute('disabled') !== null) return null;
        const r = btn.getBoundingClientRect();
        return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      });
      if (coords) break;
      await pg.waitForTimeout(500);
    }
    if (!coords) {
      const diag = await pg.evaluate(() => {
        const btn = document.querySelector('ion-button.imagenEnviar');
        const cant = (() => {
          const div = document.querySelector('devolucion-product-list [id="inputQuProduct"]');
          const ii = div && div.querySelector('ion-input');
          const i = ii && (ii.querySelector('input') || (ii.shadowRoot && ii.shadowRoot.querySelector('input')));
          return i ? i.value : null;
        })();
        return {
          motivo: !btn ? 'el botón NO EXISTE'
                : (btn.disabled || btn.getAttribute('disabled') !== null) ? 'el botón está DESHABILITADO'
                : 'el botón tiene ancho 0 (fuera de vista o no renderizado)',
          segmento: (document.querySelector('ion-segment') || {}).value,
          productosEnCarrito: document.querySelectorAll('devolucion-product-list ion-accordion').length,
          cantidadEnCampo: cant,
          guardarDisponible: (() => { const g = document.querySelector('ion-button.imagenGuardar');
            return g ? !(g.disabled || g.getAttribute('disabled') !== null) : null; })(),
        };
      });
      throw new Error(`No se pudo pulsar Enviar tras ${segundos}s — ${JSON.stringify(diag)}`);
    }
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
  }

  // Abre una nueva devolución manejando posible GPS alert
  async function abrirFormDevolucion() {
    await clickBotonDev('DEVOLUCIÓN');
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      await pg.waitForTimeout(1200);
      // Si hay alert de GPS u otro, aceptar
      const gpsAlert = await pg.evaluate(() => {
        const alerts = [...document.querySelectorAll('ion-alert')].filter(a => {
          const isTraditional = !a.classList.contains('overlay-hidden') && a.offsetParent !== null;
          const hasVisibleBtn = [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
          return isTraditional || hasVisibleBtn;
        });
        return alerts.length > 0;
      });
      if (gpsAlert) {
        try { await clickAlertBtn(['Aceptar', 'OK', 'Continuar']); } catch (_) {}
        await pg.waitForTimeout(800);
        // Re-click por si el GPS alert consumió el primer click
        try { await clickBotonDev('DEVOLUCIÓN'); } catch (_) {}
        continue;
      }
      // Verificar si está en form (tabs visibles)
      const tabsVisible = await pg.evaluate(() =>
        [...document.querySelectorAll('ion-segment-button')].filter(
          s => s.getBoundingClientRect().width > 0
        ).length >= 2
      );
      if (tabsVisible) { await pg.waitForTimeout(1000); return true; }
    }
    // Si no abrió, puede ser GPS requerido sin coords
    return false;
  }

  // Agrega un producto al carrito de devolución
  // Retorna { ok, estructura, producto } o { ok: false, error }
  async function agregarProducto(productoTest, opciones = {}) {
    // Botón "Agregar Producto" en Tab Productos
    const addBtn = await pg.evaluate(() => {
      const btn = document.querySelector('ion-button.botonAddAmarillo');
      if (!btn || btn.getBoundingClientRect().width === 0) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!addBtn) return { ok: false, error: 'Botón Agregar Producto no encontrado' };
    await pg.mouse.click(addBtn.x, addBtn.y, { delay: 80 });
    await pg.waitForTimeout(2000);

    // ── DOS CAMINOS AL PRODUCTO, según el sabor de devolución ─────────────────
    //
    //   TIPO A (validateReturn=false): catálogo → ESTRUCTURA → productos.
    //   TIPO B (validateReturn=true):  los productos de LA FACTURA salen directos,
    //                                  sin paso de estructura.
    //
    // 🔴 Los DOS componentes existen SIEMPRE en el DOM; lo que cambia es cuál tiene
    //    ítems. Comprobar presencia da falso: `productos-tab-structure-list` existe
    //    con 0 ítems en tipo B, y el guion moría con "Lista de estructuras no
    //    apareció" cuando los productos ya estaban en pantalla. Se espera a que
    //    CUALQUIERA de las dos listas tenga contenido y se ramifica. [prc-20260831]
    const contar = () => pg.evaluate(() => {
      const vis = s => [...document.querySelectorAll(s + ' ion-item')]
        .filter(el => el.getBoundingClientRect().width > 0);
      const est = vis('productos-tab-structure-list');
      const pro = vis('productos-tab-return-product-list');
      const coords = el => { const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent.trim().slice(0, 40) }; };
      return { estructuras: est.map(coords), productos: pro.length };
    });

    let vista = { estructuras: [], productos: 0 };
    for (let i = 0; i < 14; i++) {
      vista = await contar();
      if (vista.estructuras.length || vista.productos) break;
      await pg.waitForTimeout(600);
    }
    if (!vista.estructuras.length && !vista.productos) {
      return { ok: false, error: 'Ni estructuras ni productos aparecieron tras "Agregar Producto" ' +
                                 '(¿el cliente/factura no tiene productos devolvibles?)' };
    }

    // En TIPO B no hay estructura: se deja constancia para el veredicto.
    let estructura = { text: '(sin estructura — productos de la factura)' };
    if (vista.estructuras.length) {
      // TIPO A: hay que entrar por la estructura
      estructura = vista.estructuras[0];
      await pg.mouse.click(estructura.x, estructura.y, { delay: 80 });
      await pg.waitForTimeout(2000);
    }
    // TIPO B: no se toca nada; los productos de la factura ya están listados.

    // Esperar lista de productos (productos-tab-return-product-list ion-item)
    let productos = null;
    for (let i = 0; i < 10; i++) {
      productos = await pg.evaluate((pTest) => {
        const items = [...document.querySelectorAll('productos-tab-return-product-list ion-item')]
          .filter(el => el.getBoundingClientRect().width > 0);
        const exacto = pTest ? items.find(el => el.textContent.toLowerCase().includes(pTest.toLowerCase().slice(0, 8))) : null;
        const target = exacto || items[0];
        if (!target) return null;
        const r = target.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: target.textContent.trim().slice(0, 40) };
      }, productoTest);
      if (productos) break;
      await pg.waitForTimeout(600);
    }
    if (!productos) return { ok: false, error: 'Lista de productos no apareció' };

    await pg.mouse.click(productos.x, productos.y, { delay: 80 });
    await pg.waitForTimeout(2500);

    // El producto fue agregado al acordeón en devolucion-product-list
    // Verificar que el acordeón aparece
    const acordeon = await pg.evaluate(() => {
      const acc = [...document.querySelectorAll('devolucion-product-list ion-accordion')]
        .filter(a => a.getBoundingClientRect().width > 0);
      return acc.length > 0 ? acc.length : 0;
    });
    if (!acordeon) {
      // Puede que ya estaba expandido o no se agregó
      return { ok: false, error: 'Acordeón de producto no apareció en devolucion-product-list' };
    }

    // Expandir primer acordeón (click en ion-item slot="header")
    const headerCoords = await pg.evaluate(() => {
      const header = document.querySelector('devolucion-product-list ion-item[slot="header"]');
      if (!header || header.getBoundingClientRect().width === 0) return null;
      const r = header.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (headerCoords) {
      await pg.mouse.click(headerCoords.x, headerCoords.y, { delay: 60 });
      await pg.waitForTimeout(1200);
    }

    // ── CANTIDAD DEVUELTA ─────────────────────────────────────────────────────
    // 🔴 ES EL ÚNICO CAMPO QUE HABILITA EL BOTÓN ENVIAR (confirmado por QA en el
    //    device: se envía una devolución sólo con la cantidad). Si no entra, el
    //    guion llega hasta el final y muere con "botón enviar no disponible".
    //
    // 🔴 Se escribía asignando el `value` por código y NADIE COMPROBABA el resultado:
    //    `agregarProducto` devolvía `cantidad: 3` **escrito a mano**, así que
    //    DM-DEV-014 comparaba 3 con 3 y daba PASS siempre — con el campo vacío.
    //    Ahora se teclea con foco (RUNTIME §S2v) y se RELEE del DOM. [prc-20260831]
    // 🔴 LA CANTIDAD NO PUEDE SER UN NÚMERO FIJO. El máximo devolvible sale de la
    //    FACTURA y cambia por producto ("La cantidad a devolver debe estar entre 1 y 1").
    //    Poner un 3 a ciegas produce envíos que la app IMPIDE a mano — el guion pasaba
    //    por encima de una validación y ensuciaba los datos. Se lee el tope de la
    //    pantalla (atributo max del input o el texto del aviso) y se usa ése.
    //    [prc-20260831]
    const MAXIMO_LEIDO = await pg.evaluate(() => {
      const div = document.querySelector('devolucion-product-list [id="inputQuProduct"]');
      const ii = div && div.querySelector('ion-input');
      // a) el propio input suele declarar su máximo
      const maxAttr = ii && (ii.getAttribute('max') || (ii.querySelector('input') || {}).max);
      if (maxAttr && !isNaN(parseFloat(maxAttr)) && parseFloat(maxAttr) > 0) {
        return String(Math.floor(parseFloat(maxAttr)));
      }
      // b) si no, el texto de ayuda junto al campo: "... entre 1 y N"
      const texto = (div ? div.textContent : document.body.textContent) || '';
      const m = texto.match(/entre\s+\d+\s+y\s+(\d+)/i);
      if (m) return m[1];
      // 🔴 NO HAY TOPE DECLARADO. Se devuelve null para que quede CLARO que no se
      //    leyó ninguno: usar un '1' silencioso hacía que el guion se inventara un
      //    máximo y luego lo diera por medido. [prc-20260831]
      return null;
    });
    // Sin tope declarado se pide 1 —la cantidad mínima, nunca de más—, pero el
    // veredicto dirá que el máximo no se pudo leer, no que valía 1.
    const MAXIMO = MAXIMO_LEIDO === null ? '1' : MAXIMO_LEIDO;
    // `excederMaximo` sólo lo usa el caso que comprueba que la app RECHAZA de más.
    const CANT = opciones.excederMaximo
      ? String(parseInt(MAXIMO, 10) + 2)
      : MAXIMO;
    const marcar = await pg.evaluate(() => {
      const div = document.querySelector('devolucion-product-list [id="inputQuProduct"]');
      if (!div) return null;
      const ionInput = div.querySelector('ion-input');
      if (!ionInput) return null;
      const inp = ionInput.querySelector('input') || (ionInput.shadowRoot && ionInput.shadowRoot.querySelector('input'));
      if (!inp) return null;
      inp.id = inp.id || 'qa-cantidad-devolucion';
      return inp.id;
    });
    const leerCantidad = () => pg.evaluate(() => {
      const div = document.querySelector('devolucion-product-list [id="inputQuProduct"]');
      const ionInput = div && div.querySelector('ion-input');
      const inp = ionInput && (ionInput.querySelector('input') ||
                  (ionInput.shadowRoot && ionInput.shadowRoot.querySelector('input')));
      return inp ? String(inp.value || '').trim() : null;
    });

    let cantidadEnCampo = null;
    if (marcar) {
      await pg.focus(`#${marcar}`);
      await pg.evaluate((id) => { const i = document.getElementById(id); if (i) i.select && i.select(); }, marcar);
      await pg.keyboard.press('Control+A');
      await pg.keyboard.type(CANT, { delay: 60 });
      await pg.waitForTimeout(700);
      cantidadEnCampo = await leerCantidad();
    }
    // Reserva: si el foco no bastó, click triple + teclado
    if (cantidadEnCampo !== CANT) {
      const c = await pg.evaluate(() => {
        const div = document.querySelector('devolucion-product-list [id="inputQuProduct"]');
        const ionInput = div && div.querySelector('ion-input');
        if (!ionInput) return null;
        const r = ionInput.getBoundingClientRect();
        return r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      });
      if (c) {
        await pg.mouse.click(c.x, c.y, { delay: 60, clickCount: 3 });
        await pg.keyboard.type(CANT, { delay: 60 });
        await pg.waitForTimeout(700);
        cantidadEnCampo = await leerCantidad();
      }
    }
    // Cerrar el teclado: comprime la maquetación y desplaza los botones del header
    await pg.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    await pg.waitForTimeout(900);

    // 🔴 NO ASIGNAR `sel.value` A MANO. El RUNTIME lo advierte: la asignación
    //    programática **falla en silencio cuando el value es un OBJETO**, y aquí lo es
    //    (el motivo llega como `{idType, idMotive, naMotive}`). El código anterior
    //    devolvía `true` por haber disparado el evento, no por haber seleccionado:
    //    Unidad y Motivo quedaban VACÍOS, el botón Enviar seguía `disabled` y NUNCA
    //    se envió una devolución. Hay que abrir el overlay y pulsar la opción, y
    //    después COMPROBAR que el select se quedó con valor. [prc-20260831]
    //
    //    ⚠ El overlay lo fija el CONTROL, no el módulo: un ion-select puede abrir un
    //      ion-popover (1 clic) o un ion-alert de radios (2 clics: opción → Aceptar).
    //      Se contemplan los dos.
    async function elegirEnSelectProducto(nth) {
      const abrir = await pg.evaluate((n) => {
        const sels = [...document.querySelectorAll('devolucion-product-list ion-select')]
          .filter(s => s.getBoundingClientRect().width > 0);
        if (!sels[n]) return null;
        const r = sels[n].getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, nth);
      if (!abrir) return false;
      await pg.mouse.click(abrir.x, abrir.y, { delay: 80 });
      await pg.waitForTimeout(1200);

      // a) popover con ion-item  ·  b) alert con radios + botón de acción
      const opcion = await pg.evaluate(() => {
        const vis = el => el.getBoundingClientRect().width > 0;
        const pop = [...document.querySelectorAll('ion-popover')].filter(p => !p.classList.contains('overlay-hidden'))[0];
        if (pop) {
          const it = [...pop.querySelectorAll('ion-item')].filter(vis);
          if (it.length) { const r = it[0].getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, tipo: 'popover' }; }
        }
        const al = [...document.querySelectorAll('ion-alert')].filter(a => vis(a))[0];
        if (al) {
          const radios = [...al.querySelectorAll('.alert-radio-button')].filter(vis);
          if (radios.length) { const r = radios[0].getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, tipo: 'alert' }; }
        }
        return null;
      });
      if (!opcion) return false;
      await pg.mouse.click(opcion.x, opcion.y, { delay: 80 });
      await pg.waitForTimeout(600);

      // En el alert de radios hace falta un 2.º clic en la acción (Aceptar/OK)
      if (opcion.tipo === 'alert') {
        const aceptar = await pg.evaluate(() => {
          const vis = el => el.getBoundingClientRect().width > 0;
          const al = [...document.querySelectorAll('ion-alert')].filter(a => vis(a))[0];
          if (!al) return null;
          const btn = [...al.querySelectorAll('.alert-button')].filter(vis)
            .find(b => /^(aceptar|ok)$/i.test(b.textContent.trim()));
          if (!btn) return null;
          const r = btn.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        if (aceptar) { await pg.mouse.click(aceptar.x, aceptar.y, { delay: 80 }); }
      }
      await pg.waitForTimeout(900);

      // ORÁCULO: el select debe haber quedado CON valor
      return await pg.evaluate((n) => {
        const sels = [...document.querySelectorAll('devolucion-product-list ion-select')]
          .filter(s => s.getBoundingClientRect().width > 0);
        const s = sels[n];
        return !!(s && s.value !== null && s.value !== undefined && s.value !== '');
      }, nth);
    }

    const unidadOk = await elegirEnSelectProducto(0);   // Unidad
    const motivoOk = await elegirEnSelectProducto(1);   // Motivo de devolución
    await pg.waitForTimeout(800);

    // Documento (coDocument) — requerido por producto cuando requeridedNroFactura=true.
    // Se llena con factura_test del perfil; editable porque validateReturn=false.
    let docOk = false;
    if (DATA.facturaTest) {
      docOk = await pg.evaluate((factura) => {
        const div = document.querySelector('devolucion-product-list [id="inputDocument"]');
        if (!div) return false;
        const ionInput = div.querySelector('ion-input');
        if (!ionInput) return false;
        const inp = ionInput.querySelector('input') || (ionInput.shadowRoot && ionInput.shadowRoot.querySelector('input'));
        if (!inp) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(inp, factura);
        inp.dispatchEvent(new Event('input',  { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        ionInput.dispatchEvent(new CustomEvent('ionInput',  { bubbles: true, detail: { value: factura } }));
        ionInput.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: factura } }));
        inp.dispatchEvent(new Event('blur',   { bubbles: true }));
        return true;
      }, DATA.facturaTest);
      await pg.waitForTimeout(600);
    }

    // `cantidad` sale de RELEER el campo — antes iba el literal 3 y el veredicto
    // se comparaba consigo mismo. [prc-20260831]
    return { ok: true, estructura: estructura.text, producto: productos.text,
             cantidad: cantidadEnCampo, cantidadPedida: CANT, maximoReal: MAXIMO,
             maximoLeido: MAXIMO_LEIDO, unidadOk, motivoOk, docOk };
  }

  // ─── Navegar a módulo Devoluciones ──────────────────────────────────────────
  try {
    const tileCoords = await pg.evaluate(() => {
      const tile = [...document.querySelectorAll('app-home a.ion-text-center, app-home a[href], app-home ion-card, app-home .tile')]
        .filter(t => t.getBoundingClientRect().width > 0)
        .find(t => {
          const p = t.querySelector('p.nombreModulos, p');
          const text = (p ? p.textContent : t.textContent).trim().toUpperCase();
          return text.includes('DEVOLUCIÓN') || text.includes('DEVOLUCION') || text.includes('RETURN');
        });
      if (!tile) return null;
      const r = tile.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!tileCoords) throw new Error('Tile Devoluciones no encontrado en Home');
    await pg.mouse.click(tileCoords.x, tileCoords.y, { delay: 80 });
    await pg.waitForTimeout(2000);
    await pg.waitForSelector('devoluciones-container', { timeout: 15000 });

    const botones = await pg.evaluate(() => {
      const btns = [...document.querySelectorAll('devoluciones-container ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .map(b => b.textContent.trim());
      return btns;
    });
    const ok = botones.some(t => t.includes('DEVOLUCIÓN') || t.includes('DEVOLUCION')) &&
               botones.some(t => t.includes('BUSCAR'));
    v('DM-DEV-001', 'Tile Devoluciones → home con 2 botones', ok ? 'PASS' : 'FAIL',
      `botones: ${botones.join(', ')}`);
  } catch (e) {
    v('DM-DEV-001', 'Tile Devoluciones → home con 2 botones', 'FAIL', e.message);
    TODOS.slice(1).forEach(id => v(id, id, 'BLOCKED', 'DEV-001 falló'));
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // ─── DEV-002: Click DEVOLUCIÓN → form con 3 tabs; Productos/Adjuntos disabled ──
  let formAbierto = false;
  try {
    formAbierto = await abrirFormDevolucion();
    if (!formAbierto) {
      v('DM-DEV-002', 'DEVOLUCIÓN → form / tabs disabled', 'N/A', 'Form no abrió (posible GPS requerido sin coords activas)');
      ['DM-DEV-003','DM-DEV-004','DM-DEV-005','DM-DEV-006','DM-DEV-007',
       'DM-DEV-011','DM-DEV-012','DM-DEV-013','DM-DEV-014','DM-DEV-015',
       'DM-DEV-016','DM-DEV-017','DM-DEV-018','DM-DEV-019','DM-DEV-020',
       'DM-DEV-021','DM-DEV-022','DM-DEV-023','DM-DEV-024','DM-DEV-025',
      ].forEach(id => v(id, id, 'BLOCKED', 'DEV-002 N/A GPS'));
      ['DM-DEV-008','DM-DEV-009','DM-DEV-010'].forEach(id =>
        v(id, id, 'N/A', DATA.validateReturn ? 'ver flujo validateReturn' : 'validateReturn=false')
      );
      return { verdicts, msTotal: Date.now() - t0 };
    }

    const tabInfo = await pg.evaluate(() => {
      const tabs = [...document.querySelectorAll('ion-segment-button')]
        .filter(s => s.getBoundingClientRect().width > 0)
        .map(s => ({ text: s.textContent.trim(), disabled: s.disabled || s.getAttribute('disabled') !== null }));
      return tabs;
    });
    const nombres = tabInfo.map(t => t.text);
    const productosDisabled = tabInfo.find(t => t.text.includes('Producto'))?.disabled;
    const adjuntosDisabled  = tabInfo.find(t => t.text.includes('Adjunto') || t.text.includes('Attach'))?.disabled;
    const ok = tabInfo.length >= 3 && productosDisabled && adjuntosDisabled;
    v('DM-DEV-002', 'DEVOLUCIÓN → form / tabs disabled', ok ? 'PASS' : 'FAIL',
      `tabs: ${JSON.stringify(nombres)} · Productos disabled: ${productosDisabled} · Adjuntos disabled: ${adjuntosDisabled}`);
  } catch (e) {
    v('DM-DEV-002', 'DEVOLUCIÓN → form / tabs disabled', 'FAIL', e.message);
  }

  // ─── DEV-003: Tocar tab disabled (Productos) → sigue en General ─────────────
  try {
    const segmentAntes = await pg.evaluate(() => {
      const seg = document.querySelector('ion-segment');
      return seg ? (seg.value || seg.getAttribute('ng-reflect-value')) : null;
    });
    // Intentar click en tab Productos (disabled)
    const tabCoords = await pg.evaluate(() => {
      const tab = [...document.querySelectorAll('ion-segment-button')]
        .find(s => s.textContent.trim().includes('Producto') && s.getBoundingClientRect().width > 0);
      if (!tab) return null;
      const r = tab.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (tabCoords) await pg.mouse.click(tabCoords.x, tabCoords.y, { delay: 60 });
    await pg.waitForTimeout(600);
    const segmentDespues = await pg.evaluate(() => {
      const seg = document.querySelector('ion-segment');
      return seg ? (seg.value || seg.getAttribute('ng-reflect-value')) : null;
    });
    const ok = segmentDespues === segmentAntes || segmentDespues === 'default' || segmentDespues === null;
    v('DM-DEV-003', 'Tab disabled sin cliente → no cambia', ok ? 'PASS' : 'FAIL',
      `segment antes: ${segmentAntes} · después: ${segmentDespues}`);
  } catch (e) {
    v('DM-DEV-003', 'Tab disabled sin cliente → no cambia', 'FAIL', e.message);
  }

  // ─── DEV-017: Botones guardar/enviar disabled sin cliente ────────────────────
  try {
    const btnsState = await pg.evaluate(() => {
      const save = document.querySelector('ion-button.imagenGuardar');
      const send = document.querySelector('ion-button.imagenEnviar');
      return {
        saveVisible: !!(save && save.getBoundingClientRect().width > 0),
        saveDisabled: !!(save && (save.disabled || save.getAttribute('disabled') !== null)),
        sendVisible: !!(send && send.getBoundingClientRect().width > 0),
        sendDisabled: !!(send && (send.disabled || send.getAttribute('disabled') !== null)),
      };
    });
    // Sin cliente: guardar y enviar deben estar disabled
    const ok = btnsState.saveDisabled && btnsState.sendDisabled;
    v('DM-DEV-017', 'Botones guardar/enviar disabled sin cliente', ok ? 'PASS' : 'FAIL',
      `guardar visible: ${btnsState.saveVisible} disabled: ${btnsState.saveDisabled} · enviar visible: ${btnsState.sendVisible} disabled: ${btnsState.sendDisabled}`);
  } catch (e) {
    v('DM-DEV-017', 'Botones guardar/enviar disabled sin cliente', 'FAIL', e.message);
  }

  // ─── DEV-005: Búsqueda ZZZZZZZ → sin resultados (dentro de selector cliente) ─
  try {
    const res005 = await buscarClienteZZZ();
    v('DM-DEV-005', 'Búsqueda ZZZZZZZ en selector → sin resultados', res005.ok ? 'PASS' : 'FAIL',
      res005.ok ? `msg: "${res005.msg}"` : res005.nota || 'no se pudo verificar');
  } catch (e) {
    v('DM-DEV-005', 'Búsqueda ZZZZZZZ en selector → sin resultados', 'FAIL', e.message);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DEV-004 — DOS SABORES, según `validateReturn`:
  //
  //   TIPO A (false): cliente → PRODUCTOS habilitada.
  //   TIPO B (true):  cliente → PRODUCTOS SIGUE DESHABILITADA (correcto)
  //                   y es la FACTURA la que las habilita.
  //
  // 🔴 Medir el criterio de A sobre un cliente B da FAIL y tumba 16 casos por
  //    cascada, cuando la app se está comportando bien. Verificado en device
  //    2026-08-31: RAFAEL PIT STOP → tras cliente PRODUCTOS disabled=true;
  //    tras elegir la factura 10056 → disabled=false. [prc-20260831]
  // ════════════════════════════════════════════════════════════════════════════
  const leerTabProductos = () => pg.evaluate(() => {
    const tabs = [...document.querySelectorAll('ion-segment-button')]
      .filter(s => s.getBoundingClientRect().width > 0);
    const productos = tabs.find(s => s.textContent.includes('Producto'));
    return !!(productos && !productos.disabled && productos.getAttribute('disabled') === null);
  });
  const esperarTabProductos = async (segundos = 6) => {
    for (let i = 0; i < segundos * 2; i++) {
      if (await leerTabProductos()) return true;
      await pg.waitForTimeout(500);
    }
    return false;
  };

  // Selecciona una factura del InvoiceeSelectModal (ojo: doble 'e' en el id).
  // `preferida` = nro. de factura del perfil; si no aparece, toma la primera.
  async function seleccionarFactura(preferida) {
    const campo = await pg.evaluate(() => {
      const el = document.querySelector('ion-input#invoiceSelect');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!campo) throw new Error('Campo Factura (#invoiceSelect) no visible tras elegir cliente');
    await pg.mouse.click(campo.x, campo.y, { delay: 80 });

    // Poll: el modal de facturas tarda en poblarse
    let elegida = null;
    for (let i = 0; i < 16; i++) {
      await pg.waitForTimeout(500);
      elegida = await pg.evaluate((pref) => {
        const m = [...document.querySelectorAll('ion-modal, ion-popover')].find(x => x.offsetParent !== null);
        if (!m) return null;
        const items = [...m.querySelectorAll('ion-item')].filter(i => i.getBoundingClientRect().width > 0);
        if (!items.length) return null;
        const exacta = pref ? items.find(i => i.textContent.includes(String(pref))) : null;
        const t = exacta || items[0];
        const r = t.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2,
                 txt: t.innerText.replace(/\s+/g, ' ').trim().slice(0, 50),
                 total: items.length, eraLaPreferida: !!exacta };
      }, preferida);
      if (elegida) break;
    }
    if (!elegida) throw new Error('El selector de facturas no mostró ninguna factura');
    await pg.mouse.click(elegida.x, elegida.y, { delay: 80 });
    await pg.waitForTimeout(2000);
    return elegida;
  }

  let clienteNombre = '';
  let clienteSeleccionado = false;
  let facturaElegida = null;
  const clientesProbados = [];

  try {
    // Candidatos: el del perfil y su relevo (ambos verificados en BD)
    const candidatos = [
      { nombre: DATA.clienteTest,    origen: 'cliente_test' },
      { nombre: DATA.clienteTestAlt, origen: 'cliente_test_alt' },
    ].filter(c => c.nombre && String(c.nombre).trim());

    for (const cand of candidatos) {
      if (clientesProbados.length) {
        // Rehacer el formulario antes de reintentar con otro cliente
        if (!(await reabrirFormularioDev())) break;
      }
      let nombre;
      try { nombre = await seleccionarCliente(cand.nombre); }
      catch (e) { clientesProbados.push({ nombre: cand.nombre, origen: cand.origen, fallo: 'no apareció en el selector' }); continue; }

      if (!DATA.validateReturn) {
        // ── TIPO A: el cliente debe habilitar PRODUCTOS ──────────────────────
        if (await esperarTabProductos()) { clienteNombre = nombre; clienteSeleccionado = true; break; }
        clientesProbados.push({ nombre, origen: cand.origen, fallo: 'PRODUCTOS no habilitó tras el cliente' });
      } else {
        // ── TIPO B: PRODUCTOS debe seguir deshabilitada; habilita la FACTURA ──
        const antes = await leerTabProductos();
        try {
          facturaElegida = await seleccionarFactura(DATA.facturaTest);
        } catch (e) {
          clientesProbados.push({ nombre, origen: cand.origen, fallo: e.message });
          continue;
        }
        if (await esperarTabProductos()) {
          clienteNombre = nombre; clienteSeleccionado = true;
          v('DM-DEV-004', 'validateReturn: la FACTURA habilita las tabs (no el cliente)', 'PASS',
            `cliente "${nombre}" → PRODUCTOS ${antes ? 'ya habilitada ⚠' : 'deshabilitada (correcto)'}; ` +
            `factura "${facturaElegida.txt}" (${facturaElegida.total} disponibles) → PRODUCTOS habilitada`);
          break;
        }
        clientesProbados.push({ nombre, origen: cand.origen, fallo: 'PRODUCTOS no habilitó ni con factura elegida' });
      }
    }

    if (!clienteSeleccionado) {
      throw new Error(`Ningún cliente dejó el formulario utilizable: ` +
        clientesProbados.map(p => `"${p.nombre}" (${p.origen}: ${p.fallo})`).join(' · '));
    }

    // En TIPO A el veredicto se emite aquí (en B ya se emitió arriba)
    if (!DATA.validateReturn) {
      v('DM-DEV-004', 'Seleccionar cliente → tabs habilitadas', 'PASS',
        `cliente: "${clienteNombre}" · Productos habilitada: true`);
    }

    // 🔴 HALLAZGO DE DATOS: si hizo falta el relevo, se REPORTA y se sigue.
    if (clientesProbados.length) {
      v('DM-DEV-DATA-001', 'Cliente de prueba con facturas devolvibles', 'FAIL',
        `🔴 DATO A REVISAR POR IMPLEMENTACIÓN — ${clientesProbados.length} cliente(s) no dejan ` +
        `ejecutable el módulo: ${clientesProbados.map(p => `"${String(p.nombre).split('Código')[0].trim()}" (${p.fallo})`).join(', ')}. ` +
        `El guion NO se detuvo: continuó con "${String(clienteNombre).split('Código')[0].trim()}".`);
    } else {
      v('DM-DEV-DATA-001', 'Cliente de prueba con facturas devolvibles', 'PASS',
        `"${String(clienteNombre).split('Código')[0].trim()}" dejó el módulo ejecutable al primer intento`);
    }
  } catch (e) {
    v('DM-DEV-004', 'Seleccionar cliente → tabs habilitadas', 'FAIL', e.message);
  }

  // ─── DEV-008/009/010: Condicional validateReturn ────────────────────────────
  if (!DATA.validateReturn) {
    ['DM-DEV-008','DM-DEV-009','DM-DEV-010'].forEach(id =>
      v(id, id, 'N/A', 'validateReturn=false en perfil')
    );
  } else {
    // validateReturn=true: verificar campo Factura visible
    try {
      const facturaVisible = await pg.evaluate(() => {
        const inp = document.querySelector('ion-input#invoiceSelect');
        return !!(inp && inp.getBoundingClientRect().width > 0);
      });
      v('DM-DEV-008', 'VG validateReturn: campo Factura visible tras cliente', facturaVisible ? 'PASS' : 'FAIL',
        `invoiceSelect visible: ${facturaVisible}`);
    } catch (e) {
      v('DM-DEV-008', 'VG validateReturn: campo Factura visible tras cliente', 'FAIL', e.message);
    }

    // DEV-009/010 — ya no son N/A: DEV-004 seleccionó la factura de verdad y de ahí
    // salen ambos veredictos. Antes se marcaban "requiere datos específicos" y se
    // perdía toda la cobertura del flujo TIPO B. [prc-20260831]
    if (facturaElegida) {
      v('DM-DEV-009', 'Selector de facturas lista las facturas del cliente', 'PASS',
        `${facturaElegida.total} factura(s) en InvoiceeSelectModal · elegida: "${facturaElegida.txt}"` +
        (facturaElegida.eraLaPreferida ? ' (la del perfil)' : ' ⚠ la del perfil no apareció; se tomó la primera'));

      const enCampo = await pg.evaluate(() => {
        const inp = document.querySelector('ion-input#invoiceSelect');
        if (!inp) return null;
        const i = inp.querySelector('input') || (inp.shadowRoot && inp.shadowRoot.querySelector('input'));
        return i ? i.value : (inp.value || null);
      });
      const cuadra = !!(enCampo && facturaElegida.txt.includes(String(enCampo).trim()));
      v('DM-DEV-010', 'Factura elegida queda en el campo y habilita PRODUCTOS', cuadra ? 'PASS' : 'FAIL',
        `campo Factura: "${enCampo}" · elegida en el modal: "${facturaElegida.txt}"`);
    } else {
      ['DM-DEV-009','DM-DEV-010'].forEach(id =>
        v(id, id, 'FAIL', '🔴 No se pudo elegir factura: el cliente de prueba no tiene facturas devolvibles')
      );
    }
  }

  if (!clienteSeleccionado) {
    ['DM-DEV-006','DM-DEV-007','DM-DEV-011','DM-DEV-012','DM-DEV-013','DM-DEV-014',
     'DM-DEV-015','DM-DEV-016','DM-DEV-018','DM-DEV-019','DM-DEV-020',
     'DM-DEV-021','DM-DEV-022','DM-DEV-023','DM-DEV-024','DM-DEV-025',
    ].forEach(id => v(id, id, 'BLOCKED', 'DEV-004 falló'));
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // ─── REQ Enviar · E1 + E2 ────────────────────────────────────────────────────
  // 🔴 R1 · aquí, y no antes: el cliente YA está seleccionado, que es donde
  //    empieza la transacción. Medirlo antes daría «nace deshabilitado» y sería
  //    falso — eso ya lo cubre DEV-017, que es otro caso distinto.
  reqV(await reqInicio(pg, 'DEV'));
  reqV(await reqRechazo(pg, 'DEV'));

  // ─── DEV-006: Campos editables del Tab General ───────────────────────────────
  try {
    const ts = Date.now();
    await fillIonInput('ion-input#responsable', `Test-DEV-006`);
    await fillIonInput('ion-input#comentario',  `Test-DEV-016 comentario ${ts}`);
    // 🔴 AUSENTE != PRESENTE-PERO-VACIO. Hasta el 16/09 esto devolvia FAIL en
    //    los dos casos, y DM-DEV-006 estuvo desde el 14/09 sin poder
    //    clasificarse: un selector que no engancha salia igual que un campo que
    //    no acepta entrada. QA lo verifico A MANO en la devolucion ref 232 —
    //    los campos aceptan entrada — asi que el FAIL era del guion.
    //    Ahora se distingue: sin elemento ⇒ BLOCKED con el motivo.
    const rsp = await pg.evaluate(() => {
      const inp = document.querySelector('ion-input#responsable');
      if (!inp) return { existe: false, motivo: 'ion-input#responsable no esta en el DOM' };
      if (inp.getBoundingClientRect().width === 0) {
        return { existe: false, motivo: 'ion-input#responsable existe pero no es visible' };
      }
      const i = inp.querySelector('input') || (inp.shadowRoot && inp.shadowRoot.querySelector('input'));
      if (!i) return { existe: false, motivo: 'el ion-input no expone su <input> interno' };
      return { existe: true, valor: i.value };
    });
    if (!rsp.existe) {
      v('DM-DEV-006', 'Campos editables Tab General (Responsable/Comentario)', 'BLOCKED',
        `no se pudo medir: ${rsp.motivo}`);
    } else {
      const ok = !!(rsp.valor && rsp.valor.includes('Test-DEV-006'));
      v('DM-DEV-006', 'Campos editables Tab General (Responsable/Comentario)', ok ? 'PASS' : 'FAIL',
        `responsable: "${rsp.valor}"` + (ok ? '' : ' · el campo esta presente y visible pero no conservo lo tecleado'));
    }
  } catch (e) {
    v('DM-DEV-006', 'Campos editables Tab General', 'FAIL', e.message);
  }

  // ─── DEV-007: Fecha solo lectura (button disabled) ──────────────────────────
  try {
    // Mismo arreglo que DM-DEV-006: el boton ausente no es un fallo del
    //    producto, es que no se pudo medir.
    const fch = await pg.evaluate(() => {
      const btn = document.querySelector('ion-button#fechaDevButton');
      if (!btn) return { existe: false, motivo: 'ion-button#fechaDevButton no esta en el DOM' };
      if (btn.getBoundingClientRect().width === 0) {
        return { existe: false, motivo: 'el boton de fecha existe pero no es visible' };
      }
      return { existe: true, disabled: btn.disabled || btn.getAttribute('disabled') !== null };
    });
    if (!fch.existe) {
      v('DM-DEV-007', 'Fecha devolución solo lectura (button disabled)', 'BLOCKED',
        `no se pudo medir: ${fch.motivo}`);
    } else {
      v('DM-DEV-007', 'Fecha devolución solo lectura (button disabled)', fch.disabled ? 'PASS' : 'FAIL',
        `fechaDevButton disabled: ${fch.disabled}` +
        (fch.disabled ? '' : ' · el boton esta visible y HABILITADO: la fecha se puede editar'));
    }
  } catch (e) {
    v('DM-DEV-007', 'Fecha devolución solo lectura', 'FAIL', e.message);
  }

  // ─── DEV-011: Tab Productos → botón Agregar Producto visible ─────────────────
  try {
    await clickTab('Producto');
    await pg.waitForTimeout(1000);
    const addBtnVisible = await pg.evaluate(() => {
      const btn = document.querySelector('ion-button.botonAddAmarillo');
      return !!(btn && btn.getBoundingClientRect().width > 0);
    });
    v('DM-DEV-011', 'Tab Productos → botón Agregar Producto visible', addBtnVisible ? 'PASS' : 'FAIL',
      `botonAddAmarillo visible: ${addBtnVisible}`);
  } catch (e) {
    v('DM-DEV-011', 'Tab Productos → botón Agregar Producto visible', 'FAIL', e.message);
    ['DM-DEV-012','DM-DEV-013','DM-DEV-014'].forEach(id => v(id, id, 'BLOCKED', 'DEV-011 falló'));
  }

  // ─── DEV-012 / DEV-013 / DEV-014: Agregar producto ──────────────────────────
  let productoAgregado = false;
  if (verdicts.find(x => x.id === 'DM-DEV-011')?.resultado === 'PASS') {
    try {
      const prod = await agregarProducto(DATA.productoTest);
      if (!prod.ok) throw new Error(prod.error);

      v('DM-DEV-012', 'Seleccionar estructura → lista de productos', 'PASS',
        `estructura: "${prod.estructura}"`);
      v('DM-DEV-013', 'Seleccionar producto → acordeón Cantidad/Unidad/Motivo', 'PASS',
        `producto: "${prod.producto}"`);
      // La cantidad es lo que habilita ENVIAR: si no quedó en el campo, es FAIL.
      v('DM-DEV-014', 'Ingresar cantidad (dentro del máximo declarado) → queda en el campo',
        (prod.cantidad && prod.cantidad === prod.cantidadPedida) ? 'PASS' : 'FAIL',
        `máximo declarado por la pantalla: ` +
        `${prod.maximoLeido === null ? 'NINGUNO (no se declara tope; se pidió 1)' : prod.maximoLeido} ` +
        `· cantidad LEÍDA del campo: "${prod.cantidad === null ? 'campo ausente' : prod.cantidad}" ` +
        `· unidad: ${prod.unidadOk} · motivo: ${prod.motivoOk}`);
      productoAgregado = true;
    } catch (e) {
      ['DM-DEV-012','DM-DEV-013','DM-DEV-014'].forEach(id => v(id, id, 'FAIL', e.message));
    }
  }

  // ─── DEV-015: Tab Adjuntos → acordeones visibles ────────────────────────────
  try {
    await clickTab('Adjunto');
    await pg.waitForTimeout(1500);
    // 🔴 DOS TRAMPAS AQUÍ:
    //  1. ACENTOS: el acordeón se llama "Imágenes" y se buscaba `includes('imagen')`
    //     — con la tilde NO casa. Sólo pasaba de rebote porque el texto además dice
    //     "FOTO". Se normalizan los diacríticos antes de comparar.
    //  2. TIEMPO: 1,5 s fijos no bastan para que el tab pinte sus acordeones; medido
    //     a mano hacían falta ~3 s. Se sondea hasta 8 s en vez de esperar a ciegas.
    //  [prc-20260831]
    let adjInfo = { imgAc: false, arcAc: false, firAc: false, total: 0 };
    for (let i = 0; i < 16; i++) {
      adjInfo = await pg.evaluate(() => {
        const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const visibles = [...document.querySelectorAll('ion-accordion')]
          .filter(a => a.getBoundingClientRect().width > 0)
          .map(a => sinTildes(a.textContent));
        const hay = (...claves) => visibles.some(t => claves.some(k => t.includes(k)));
        return {
          imgAc: !!document.querySelector('app-adjunto') && hay('imagen', 'foto', 'image'),
          arcAc: hay('archivo', 'file'),
          firAc: hay('firma', 'signature'),
          total: visibles.length,
        };
      });
      if (adjInfo.imgAc) break;
      await pg.waitForTimeout(500);
    }
    const ok = adjInfo.imgAc;
    v('DM-DEV-015', 'Tab Adjuntos → acordeones visibles', ok ? 'PASS' : 'FAIL',
      `imágenes: ${adjInfo.imgAc} · archivo: ${adjInfo.arcAc} · firma: ${adjInfo.firAc} · ` +
      `acordeones visibles: ${adjInfo.total}`);
  } catch (e) {
    v('DM-DEV-015', 'Tab Adjuntos → acordeones visibles', 'FAIL', e.message);
  }

  if (!productoAgregado) {
    ['DM-DEV-016','DM-DEV-018','DM-DEV-019','DM-DEV-020',
     'DM-DEV-021','DM-DEV-022','DM-DEV-023','DM-DEV-024','DM-DEV-025',
    ].forEach(id => v(id, id, 'BLOCKED', 'DEV-014 falló — sin producto en carrito'));
    return { verdicts, msTotal: Date.now() - t0 };
  }

  // ─── DEV-016: Guardar → mensaje confirmación ─────────────────────────────────
  try {
    // Volver a Tab General para que el form esté válido (comentario ya fue puesto)
    await clickTab('General');
    await pg.waitForTimeout(600);
    await clickSave();
    await pg.waitForTimeout(1500);
    const alertMsg = await pg.evaluate(() => {
      const a = [...document.querySelectorAll('ion-alert')].find(x => {
        const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
        const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!a) return null;
      const msg = a.querySelector('.alert-message') || a.querySelector('.alert-title');
      return msg ? msg.textContent.trim() : a.textContent.trim().slice(0, 120);
    });
    // El caso valida que aparezca el modal de confirmación de guardado. El app pregunta
    // "¿Desea guardar la devolución?" (confirm) y/o "Guardado" (éxito) — ambos son válidos.
    const ok = !!(alertMsg && /desea guardar|guardar la devoluci|guardad|saved/i.test(alertMsg));
    v('DM-DEV-016', 'Guardar devolución → mensaje confirmación', ok ? 'PASS' : 'FAIL',
      `alert: "${alertMsg || 'ninguno'}"`);
    if (alertMsg) await clickAlertBtn(['Aceptar', 'Sí', 'Si', 'OK']);
  } catch (e) {
    v('DM-DEV-016', 'Guardar devolución → mensaje confirmación', 'FAIL', e.message);
  }

  // ─── DEV-019: Ir a BUSCAR → devolución aparece como Guardado ─────────────────
  try {
    await irAHomeDev();
    await clickBotonDev('BUSCAR');
    await pg.waitForTimeout(2000);
    const listaInfo = await pg.evaluate(() => {
      const items = [...document.querySelectorAll('devolucion-list ion-item')]
        .filter(el => el.getBoundingClientRect().width > 0);
      const guardados = items.filter(el => el.textContent.includes('Guardado') || el.textContent.includes('Saved'));
      return { total: items.length, guardados: guardados.length };
    });
    const ok = listaInfo.guardados > 0;
    v('DM-DEV-019', 'Guardar + BUSCAR → aparece Guardado en lista', ok ? 'PASS' : 'FAIL',
      `ítems: ${listaInfo.total} · Guardado: ${listaInfo.guardados}`);
  } catch (e) {
    v('DM-DEV-019', 'Guardar + BUSCAR → aparece Guardado en lista', 'FAIL', e.message);
  }

  // ─── DEV-022: Abrir Guardado → form editable ─────────────────────────────────
  try {
    // Click en un ítem de la lista con estatus Guardado
    const guardadoCoords = await pg.evaluate(() => {
      const items = [...document.querySelectorAll('devolucion-list ion-label')]
        .filter(el => el.getBoundingClientRect().width > 0 &&
          (el.textContent.includes('Guardado') || el.textContent.includes('Saved')));
      if (!items.length) return null;
      const r = items[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!guardadoCoords) throw new Error('No hay ítems Guardado en lista');
    await pg.mouse.click(guardadoCoords.x, guardadoCoords.y, { delay: 80 });
    await pg.waitForTimeout(2000);

    const tabsAccesibles = await pg.evaluate(() => {
      const tabs = [...document.querySelectorAll('ion-segment-button')]
        .filter(s => s.getBoundingClientRect().width > 0);
      return tabs.filter(s => !s.disabled && s.getAttribute('disabled') === null).length;
    });
    const ok = tabsAccesibles >= 3;
    v('DM-DEV-022', 'Abrir Guardado → form editable con tabs accesibles', ok ? 'PASS' : 'FAIL',
      `tabs accesibles: ${tabsAccesibles}`);
    // Volver a lista
    await clickBack();
    await pg.waitForTimeout(1200);
  } catch (e) {
    v('DM-DEV-022', 'Abrir Guardado → form editable', 'FAIL', e.message);
    await irAHomeDev().catch(() => {});
    await clickBotonDev('BUSCAR').catch(() => {});
    await pg.waitForTimeout(1500);
  }

  // ─── DEV-018: Nueva devolución → Enviar ──────────────────────────────────────
  // Requiere nro. de factura por producto (requeridedNroFactura). Sin factura_test en
  // el perfil no se puede completar el envío ⇒ N/A (el cliente no exige factura).
  if (!DATA.facturaTest) {
    v('DM-DEV-018', 'Enviar devolución → modal confirmación → home módulo', 'N/A',
      'perfil sin factura_test (cliente no exige nro. de factura)');
  } else try {
    await irAHomeDev();
    const formOk = await abrirFormDevolucion();
    if (!formOk) throw new Error('Form no abrió para envío');
    await seleccionarCliente(DATA.clienteTest);
    await pg.waitForTimeout(1000);

    // 🔴 EN TIPO B FALTA LA FACTURA. Este bloque esperaba a que el CLIENTE habilitase
    //    la pestaña Productos — el comportamiento de TIPO A. Con validateReturn=true
    //    eso no pasa nunca: es la FACTURA la que las habilita, así que el envío moría
    //    aquí y NUNCA se llegaba a enviar una devolución. Mismo fallo que había en
    //    DEV-004, repetido en el flujo de envío. [prc-20260831]
    let facturaEnvio = null;
    if (DATA.validateReturn) {
      facturaEnvio = await seleccionarFactura(DATA.facturaTest);
    }

    // Asegurarse tabs habilitadas
    let tabsOk = false;
    for (let i = 0; i < 8; i++) {
      tabsOk = await pg.evaluate(() => {
        const p = [...document.querySelectorAll('ion-segment-button')].find(s => s.textContent.includes('Producto'));
        return !!(p && !p.disabled && p.getAttribute('disabled') === null);
      });
      if (tabsOk) break;
      await pg.waitForTimeout(700);
    }
    if (!tabsOk) {
      throw new Error('PRODUCTOS no habilitó' +
        (DATA.validateReturn
          ? ` ni tras elegir la factura "${facturaEnvio ? facturaEnvio.txt : '(ninguna)'}"`
          : ' tras elegir el cliente'));
    }
    await clickTab('Producto');
    await pg.waitForTimeout(800);
    const prod = await agregarProducto(DATA.productoTest);
    if (!prod.ok) throw new Error('No se pudo agregar producto para envío: ' + prod.error);
    await pg.waitForTimeout(600);

    // ── REQ Enviar · E5 ───────────────────────────────────────────────────────
    // Se mide AQUÍ, desde la pestaña Producto y ANTES de volver a General, porque
    // así es exactamente como se manifiesta F1: el formulario ya está completo
    // (cliente + factura + producto con cantidad) y GENERAL está INACTIVA, que es
    // la única forma de verle el color (regla R3).
    // `rotar:false` a propósito: cambiar de pestaña aquí deshabilitaría Enviar y
    // rompería el envío que viene justo después.
    reqV(await reqPestanaRoja(pg, 'DEV', { rotar: false }));

    // 🔴 VOLVER A GENERAL ANTES DE ENVIAR. El botón Enviar se habilita al teclear la
    //    cantidad, pero **se vuelve a deshabilitar al perder el foco el campo** y
    //    sigue deshabilitado si se colapsa el acordeón. Sólo queda disponible de
    //    forma estable al regresar a la pestaña GENERAL. Medido en device:
    //      cantidad tecleada (foco dentro) → disabled:false
    //      tras blur                       → disabled:TRUE
    //      tras colapsar acordeón          → disabled:true
    //      tras volver a GENERAL           → disabled:false
    //    Sin este paso el guion nunca llegaba a enviar. [prc-20260831]
    await clickTab('General');
    await pg.waitForTimeout(1200);

    await clickSend();
    await pg.waitForTimeout(1500);
    // Modal confirmación "¿Desea enviar?"
    const confirmMsg = await pg.evaluate(() => {
      const a = [...document.querySelectorAll('ion-alert')].find(x => {
        const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
        const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!a) return null;
      const msg = a.querySelector('.alert-message') || a.querySelector('.alert-title');
      return msg ? msg.textContent.trim() : a.textContent.trim().slice(0, 120);
    });
    const hasConfirm = !!(confirmMsg && (confirmMsg.includes('enviar') || confirmMsg.includes('send') || confirmMsg.includes('Desea')));
    if (hasConfirm) await clickAlertBtn(['Aceptar', 'Sí', 'Si', 'OK']);
    await pg.waitForTimeout(2000);
    // Mensaje enviada
    const envioMsg = await pg.evaluate(() => {
      const a = [...document.querySelectorAll('ion-alert')].find(x => {
        const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
        const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!a) return null;
      const msg = a.querySelector('.alert-message') || a.querySelector('.alert-title');
      return msg ? msg.textContent.trim() : null;
    });
    if (envioMsg) await clickAlertBtn(['Aceptar', 'OK']);
    await pg.waitForTimeout(1500);
    const enHome = await isHomeDevVisible().catch(() => false);
    const ok = hasConfirm && enHome;

    // ── Verificación BD: payload return ↔ nube (motor calibrado return+return_detail) ──
    let bdNota = 'BD-N/A(sin-payload)';
    try {
      await pg.waitForTimeout(1200); // dar tiempo al POST returnservice/return
      const payloads = await getCapturedPayloads(pg);
      const pRet = payloads.filter(p => /returnservice\/return/i.test(String(p.url)));
      if (pRet.length && DATA.clienteSlug) {
        bdNota = cotejoPayload(DATA.clienteSlug, pRet[pRet.length - 1]);
      }
    } catch (_) {}

    v('DM-DEV-018', 'Enviar devolución → modal confirmación → home módulo', ok ? 'PASS' : 'FAIL',
      `confirm: "${confirmMsg}" · envioMsg: "${envioMsg}" · home: ${enHome} · ${bdNota}`);
  } catch (e) {
    v('DM-DEV-018', 'Enviar devolución → modal confirmación', 'FAIL', e.message);
    await irAHomeDev().catch(() => {});
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DEV-VAL-001 — La app DEBE impedir devolver más de lo facturado
  //
  // Cobertura nueva. Nació de un fallo del propio guion: al descartar toda alerta
  // de un botón, silenciaba el aviso "La cantidad a devolver debe estar entre 1 y 1"
  // y enviaba una devolución de 3 unidades sobre una factura de 1 — algo que a mano
  // la app IMPIDE. Se comprobaba que el envío ocurre, nunca que la validación exista.
  //
  // 🔴 SEGURIDAD DEL CASO: si la app NO bloquease, aparecería la confirmación de
  //    envío. En ese caso se CANCELA — jamás se confirma — para no crear un registro
  //    inválido. Un caso de QA no debe ensuciar los datos que otros van a medir.
  //    [prc-20260831]
  // ════════════════════════════════════════════════════════════════════════════
  // 🔴 SÓLO APLICA EN TIPO B (validateReturn=true). Ahí la FACTURA fija cuánto se
  //    puede devolver y existe un tope real que contrastar.
  //    Con validateReturn=false NO hay tope: `agregarProducto` cae a su valor por
  //    defecto ('1') y el caso acabaría comparando contra un número que el propio
  //    guion se inventó — exactamente el vicio que este caso nació para cazar.
  //    Detectado por el agente en mio_parts (validateReturn=false). [prc-20260831]
  if (!DATA.validateReturn) {
    v('DM-DEV-VAL-001', 'Cantidad mayor a la facturada → la app bloquea el envío', 'N/A',
      'validateReturn=false: la devolución NO se valida contra factura, así que no hay ' +
      'máximo declarado que exceder. El caso sólo es medible en clientes TIPO B.');
  } else if (!DATA.facturaTest) {
    v('DM-DEV-VAL-001', 'Cantidad mayor a la facturada → la app bloquea el envío', 'N/A',
      'perfil sin factura_test: no hay tope contra el que validar');
  } else try {
    // Tras el envío de DEV-018 la app re-sincroniza: el formulario puede tardar en
    // admitir una nueva apertura. Limpiar overlays y reintentar. [prc-20260831]
    let abierto = false;
    for (let intento = 0; intento < 3 && !abierto; intento++) {
      await limpiarOverlaysDev();
      await irAHomeDev().catch(() => {});
      await pg.waitForTimeout(1200);
      abierto = await abrirFormDevolucion().catch(() => false);
      if (!abierto) await pg.waitForTimeout(2000);
    }
    if (!abierto) throw new Error('El formulario no abrió tras 3 intentos (la app seguía ocupada tras el envío)');
    await seleccionarCliente(DATA.clienteTest);
    await pg.waitForTimeout(1000);
    if (DATA.validateReturn) await seleccionarFactura(DATA.facturaTest);
    await clickTab('Producto');
    await pg.waitForTimeout(800);

    // Agregar el producto con una cantidad DELIBERADAMENTE excesiva
    const prodMal = await agregarProducto(DATA.productoTest, { excederMaximo: true });
    if (!prodMal.ok) throw new Error('No se pudo montar el escenario: ' + prodMal.error);

    // 🔴 ANTES DE ENVIAR: ¿la cantidad excesiva SIGUE en el campo?
    //    Hasta el 16/09 este caso no lo comprobaba y daba FAIL en falso. QA
    //    verifico A MANO que la app SI bloquea devolver mas de lo facturado:
    //    lo que hace es RECORTAR la cantidad al maximo (3 -> 1), y eso ES
    //    bloquear. Al no releer el campo, el guion creia haber colado el 3 y
    //    luego leia el "¿Desea enviar?" —legitimo, porque la cantidad ya era
    //    valida— como que la validacion no existia.
    const cantReal = await pg.evaluate(() => {
      const vis = (el) => el.getBoundingClientRect().width > 0;
      for (const el of [...document.querySelectorAll('ion-input, input')].filter(vis)) {
        const i = el.tagName === 'INPUT' ? el
          : (el.querySelector('input') || (el.shadowRoot && el.shadowRoot.querySelector('input')));
        if (!i || i.value === '') continue;
        const fila = el.closest('ion-row') || el.parentElement;
        const ctx = ((el.id || '') + ' ' + (el.getAttribute('name') || '') + ' ' +
                     ((fila && fila.innerText) || '')).toLowerCase();
        if (/cantidad|devolver/.test(ctx)) return i.value;
      }
      return null;
    });
    const qPedida = Number(prodMal.cantidadPedida);
    const qMax    = Number(prodMal.maximoReal);
    const qQuedo  = cantReal == null ? NaN : Number(String(cantReal).replace(',', '.'));
    const recorto = Number.isFinite(qQuedo) && Number.isFinite(qMax) && qQuedo <= qMax;

    await clickTab('General');
    await pg.waitForTimeout(1200);

    // Intentar enviar y LEER lo que responde la app
    let respuesta = { bloqueo: null, confirmacion: null };
    // Si la app ya recorto la cantidad, el tope se respeto: eso es el bloqueo.
    if (recorto) respuesta.bloqueo = `la app RECORTO la cantidad de ${qPedida} a ${qQuedo} (maximo ${qMax})`;
    try {
      if (!recorto) await clickSend(6);
      await pg.waitForTimeout(1800);
      respuesta = await pg.evaluate(() => {
        const vis = el => el.getBoundingClientRect().width > 0;
        const al = [...document.querySelectorAll('ion-alert')].filter(vis)[0];
        if (!al) return { bloqueo: null, confirmacion: null };
        const msg = ((al.querySelector('.alert-message') || {}).textContent || '').trim();
        const esRechazo = /debe estar entre|no puede|debe ser|inv[áa]lid|mayor|excede/i.test(msg);
        return { bloqueo: esRechazo ? msg : null, confirmacion: esRechazo ? null : msg };
      });
    } catch (e) {
      // Que el botón Enviar ni se habilite también es una forma válida de bloquear
      respuesta.bloqueo = `el botón Enviar no llegó a habilitarse (${e.message.slice(0, 60)})`;
    }

    if (respuesta.bloqueo) {
      v('DM-DEV-VAL-001', 'Cantidad mayor a la facturada → la app bloquea el envío', 'PASS',
        `intentado ${prodMal.cantidadPedida} sobre un máximo de ${prodMal.maximoReal} · ` +
        `la app respondió: "${respuesta.bloqueo}"`);
      // Cerrar el aviso de rechazo (aquí SÍ se descarta: ya cumplió su papel)
      await clickAlertBtn(['OK', 'Aceptar']).catch(() => {});
    } else {
      v('DM-DEV-VAL-001', 'Cantidad mayor a la facturada → la app bloquea el envío', 'FAIL',
        `🔴 NO bloqueó: se intentó devolver ${prodMal.cantidadPedida} de un máximo de ` +
        `${prodMal.maximoReal} y la app ofreció "${respuesta.confirmacion || 'enviar sin avisar'}". ` +
        `El envío se CANCELÓ para no crear un registro inválido.`);
      // 🔴 CANCELAR, nunca confirmar
      await pg.evaluate(() => {
        const vis = el => el.getBoundingClientRect().width > 0;
        const al = [...document.querySelectorAll('ion-alert')].filter(vis)[0];
        if (!al) return;
        const btn = [...al.querySelectorAll('.alert-button')].filter(vis)
          .find(b => /cancel|no$/i.test(b.textContent.trim()));
        if (btn) btn.click();
      });
    }
    await pg.waitForTimeout(1200);
    await irAHomeDev().catch(() => {});
  } catch (e) {
    v('DM-DEV-VAL-001', 'Cantidad mayor a la facturada → la app bloquea el envío', 'FAIL', e.message);
    await irAHomeDev().catch(() => {});
  }

  // ─── DEV-021: BUSCAR → lista con searchbar y filtro ─────────────────────────
  try {
    // Tras el envío de DEV-018 la lista re-sincroniza y el primer clic en BUSCAR puede
    // caer durante el overlay de sync (la lista no monta). Re-navegar entre reintentos:
    // irAHomeDev + BUSCAR, y solo entonces poll del componente (searchbar).
    let listaInfo = { searchbar: false, items: 0 };
    for (let intento = 0; intento < 6; intento++) {
      await irAHomeDev().catch(() => {});
      await clickBotonDev('BUSCAR').catch(() => {});
      for (let i = 0; i < 4; i++) {
        await pg.waitForTimeout(1000);
        listaInfo = await pg.evaluate(() => {
          const searchbar = !!document.querySelector('devolucion-list ion-searchbar, devolucion-list .lupamorada');
          const items = [...document.querySelectorAll('devolucion-list ion-item')]
            .filter(el => el.getBoundingClientRect().width > 0).length;
          return { searchbar, items };
        });
        if (listaInfo.searchbar) break;
      }
      if (listaInfo.searchbar) break;
    }
    const ok = listaInfo.searchbar;
    v('DM-DEV-021', 'BUSCAR → lista con searchbar', ok ? 'PASS' : 'FAIL',
      `searchbar: ${listaInfo.searchbar} · ítems: ${listaInfo.items}`);
  } catch (e) {
    v('DM-DEV-021', 'BUSCAR → lista con searchbar', 'FAIL', e.message);
  }

  // ─── DEV-023: Abrir Enviado/PorEnviar → solo lectura ────────────────────────
  try {
    // El ítem enviado en DEV-018 puede tardar en reflejarse tras el sync; reintentar,
    // re-entrando a BUSCAR entre intentos para forzar refresco de la lista.
    let enviadoCoords = null;
    for (let i = 0; i < 6; i++) {
      enviadoCoords = await pg.evaluate(() => {
        const items = [...document.querySelectorAll('devolucion-list ion-label')]
          .filter(el => {
            const t = el.textContent;
            const r = el.getBoundingClientRect();
            return r.width > 0 && (t.includes('Enviado') || t.includes('Por Enviar') || t.includes('Por enviar') || t.includes('Sended') || t.includes('To be'));
          });
        if (!items.length) return null;
        const r = items[0].getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      if (enviadoCoords) break;
      // Refrescar lista: volver a home módulo y re-abrir BUSCAR
      await irAHomeDev().catch(() => {});
      await clickBotonDev('BUSCAR').catch(() => {});
      await pg.waitForTimeout(1800);
    }
    // 🔴 Sin devoluciones enviadas NO se puede juzgar el modo solo-lectura: no es un
    //    defecto, es una condición de datos. Marcarlo FAIL confunde un hueco de
    //    cobertura con un fallo del producto. Se emite N/A CON MOTIVO y se sale
    //    limpio. [prc-20260831]
    if (!enviadoCoords) {
      const cuantos = await pg.evaluate(() => {
        const items = [...document.querySelectorAll('ion-item, ion-card')]
          .filter(i => i.getBoundingClientRect().width > 0);
        return { enLista: items.length,
                 estados: [...new Set(items.map(i => (i.textContent.match(/Estatus:\s*(\w+)/) || [])[1]).filter(Boolean))] };
      });
      v('DM-DEV-023', 'Abrir Enviado → solo lectura', 'N/A',
        `sin devoluciones Enviado/Por Enviar que abrir — ${cuantos.enLista} ítem(s) en lista, ` +
        `estados presentes: ${cuantos.estados.length ? cuantos.estados.join(', ') : 'ninguno'}. ` +
        `Requiere que DEV-018 (Enviar) complete antes.`);
      // ⚠ NO usar `return` aquí: estamos en el cuerpo del módulo, no en un helper —
      //   saldría de TODO y se perderían DEV-024 y DEV-025. [prc-20260831]
    } else {
      await pg.mouse.click(enviadoCoords.x, enviadoCoords.y, { delay: 80 });
      await pg.waitForTimeout(2000);

      const readonlyInfo = await pg.evaluate(() => {
        const clienteInp = document.querySelector('ion-input#clienteSelect');
        const clienteDisabled = clienteInp ?
          (clienteInp.disabled || clienteInp.getAttribute('disabled') !== null) : null;
        const saveBtn = document.querySelector('ion-button.imagenGuardar');
        const saveBtnHidden = !saveBtn || saveBtn.getBoundingClientRect().width === 0;
        const sendBtn = document.querySelector('ion-button.imagenEnviar');
        const sendBtnHidden = !sendBtn || sendBtn.getBoundingClientRect().width === 0;
        return { clienteDisabled, saveBtnHidden, sendBtnHidden };
      });
      const ok = readonlyInfo.saveBtnHidden && readonlyInfo.sendBtnHidden;
      v('DM-DEV-023', 'Abrir Enviado → solo lectura, sin botones guardar/enviar', ok ? 'PASS' : 'FAIL',
        `saveHidden: ${readonlyInfo.saveBtnHidden} · sendHidden: ${readonlyInfo.sendBtnHidden} · clienteDisabled: ${readonlyInfo.clienteDisabled}`);
      await clickBack();
      await pg.waitForTimeout(1200);
    }
  } catch (e) {
    v('DM-DEV-023', 'Abrir Enviado → solo lectura', 'FAIL', e.message);
    await irAHomeDev().catch(() => {});
    await clickBotonDev('BUSCAR').catch(() => {});
    await pg.waitForTimeout(1500);
  }

  // ─── DEV-024: Eliminar Guardado → modal + desaparece ─────────────────────────
  try {
    // Anclar: garantizar que estamos en la lista BUSCAR (no depender del back del caso
    // anterior). El botón trash solo se renderiza para ítems Guardado (stDelivery===3).
    await irAHomeDev();
    await clickBotonDev('BUSCAR');
    await pg.waitForTimeout(2000);
    const guardadosBefore = await pg.evaluate(() =>
      [...document.querySelectorAll('devolucion-list ion-item')]
        .filter(el => el.getBoundingClientRect().width > 0 &&
          (el.textContent.includes('Guardado') || el.textContent.includes('Saved'))).length
    );
    // Click botón trash del primer Guardado
    const trashCoords = await pg.evaluate(() => {
      const trashBtns = [...document.querySelectorAll('devolucion-list ion-button[color="danger"]')]
        .filter(b => b.getBoundingClientRect().width > 0);
      if (!trashBtns.length) return null;
      const r = trashBtns[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!trashCoords) throw new Error('Botón eliminar no encontrado (solo aparece para Guardado)');
    await pg.mouse.click(trashCoords.x, trashCoords.y, { delay: 80 });
    await pg.waitForTimeout(1500);
    // Modal confirmación eliminar
    const deleteBtn = await clickAlertBtn(['Eliminar', 'OK', 'Aceptar', 'Sí']).catch(() => null);
    await pg.waitForTimeout(1500);
    const guardadosAfter = await pg.evaluate(() =>
      [...document.querySelectorAll('devolucion-list ion-item')]
        .filter(el => el.getBoundingClientRect().width > 0 &&
          (el.textContent.includes('Guardado') || el.textContent.includes('Saved'))).length
    );
    const ok = guardadosAfter < guardadosBefore;
    v('DM-DEV-024', 'Eliminar Guardado → modal + desaparece de lista', ok ? 'PASS' : 'FAIL',
      `antes: ${guardadosBefore} Guardado · después: ${guardadosAfter} · btn: "${deleteBtn}"`);
  } catch (e) {
    v('DM-DEV-024', 'Eliminar Guardado → modal + desaparece', 'FAIL', e.message);
  }

  // ─── DEV-025: Atrás desde lista → home módulo ────────────────────────────────
  try {
    await clickBack();
    await pg.waitForTimeout(1500);
    const enHome = await isHomeDevVisible();
    v('DM-DEV-025', 'Atrás desde lista → home módulo', enHome ? 'PASS' : 'FAIL',
      `home visible: ${enHome}`);
  } catch (e) {
    v('DM-DEV-025', 'Atrás desde lista → home módulo', 'FAIL', e.message);
    await irAHomeDev().catch(() => {});
  }

  // ─── DEV-020: Atrás sin guardar → sale (vía "Salir sin guardar") y no persiste ─
  // Conducta VIGENTE del app (return-logic.service.ts:188 shouldPromptReturnExitSaveOrDiscard):
  // toda devolución NUEVA con trabajo sin guardar (returnPersistedBaseline=false) SÍ abre el
  // modal Guardar/Salir. El guión DM-DEV-020 documenta la conducta vieja ("sale sin modal") y
  // quedó obsoleto — actualizar. Aquí validamos: aparece modal → "Salir sin guardar" → home.
  try {
    await irAHomeDev();
    const formOk = await abrirFormDevolucion();
    if (!formOk) throw new Error('Form no abrió para DEV-020');
    await seleccionarCliente(DATA.clienteTest);
    await pg.waitForTimeout(1200);
    let tabsOk = false;
    for (let i = 0; i < 8; i++) {
      tabsOk = await pg.evaluate(() => {
        const p = [...document.querySelectorAll('ion-segment-button')].find(s => s.textContent.includes('Producto'));
        return !!(p && !p.disabled && p.getAttribute('disabled') === null);
      });
      if (tabsOk) break;
      await pg.waitForTimeout(700);
    }
    if (tabsOk) {
      await clickTab('Producto');
      await pg.waitForTimeout(600);
      await agregarProducto(DATA.productoTest);
    }
    // Contar guardados en lista antes de salir
    const itemsAntes = await pg.evaluate(async () => {
      // No vamos a BUSCAR — solo contamos en memoria (no podemos)
      return null;
    });
    // Pulsar atrás SIN guardar
    await clickBack();
    await pg.waitForTimeout(1500);
    // Conducta vigente: con trabajo sin guardar, atrás abre modal Guardar/Salir.
    const modalVisible = await pg.evaluate(() => {
      const alerts = [...document.querySelectorAll('ion-alert')].filter(a => {
        const isTraditional = !a.classList.contains('overlay-hidden') && a.offsetParent !== null;
        const hasVisibleBtn = [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      return alerts.length > 0;
    });
    // Elegir "Salir sin guardar" → debe descartar el borrador y volver al home módulo.
    let salioPorModal = false;
    if (modalVisible) {
      const btn = await clickAlertBtn(['Salir sin guardar', 'Salir', 'Descartar', 'OK']).catch(() => null);
      salioPorModal = !!btn;
      await pg.waitForTimeout(1200);
    }
    const enHome = await isHomeDevVisible().catch(() => false);
    // PASS = apareció el modal (dirty-tracking correcto) y "Salir sin guardar" llevó al home.
    const ok = modalVisible && salioPorModal && enHome;
    v('DM-DEV-020', 'Atrás sin guardar → modal Salir/Guardar → "Salir sin guardar" → home',
      ok ? 'PASS' : 'FAIL',
      `modal: ${modalVisible} · salió por modal: ${salioPorModal} · home: ${enHome}`);
  } catch (e) {
    v('DM-DEV-020', 'Atrás sin guardar → modal Salir/Guardar → home', 'FAIL', e.message);
    await irAHomeDev().catch(() => {});
  }

  // ─── Volver a HOME de la app ─────────────────────────────────────────────────
  try {
    await irAHomeDev();
    await clickBack();
    await pg.waitForTimeout(1500);
  } catch (_) {}

  return { verdicts, msTotal: Date.now() - t0 };
}

module.exports = { runDevoluciones: conReq('DEV', runDevoluciones) };
