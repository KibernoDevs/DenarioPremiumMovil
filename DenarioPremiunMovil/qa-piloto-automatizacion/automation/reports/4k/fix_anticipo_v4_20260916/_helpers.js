// GENERADO: helpers copiados VERBATIM de automation/playwright/modules/cobros.js
// Rangos: 385-1295, 1606-1908, 3032-3170. No editar a mano.
'use strict';
module.exports = function makeHelpers(pg, DATA) {
  const clientesSinDocs = new Set();
  const { execFileSync } = require('child_process');
  const NUBE_QUERY_PATH = require('path').resolve('C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/reports/4k/fix_anticipo_v4_20260916/../../../db/query.js');
  function consultaNube(slug, sql) {
    try { return JSON.parse(execFileSync('node', [NUBE_QUERY_PATH, slug, sql], { encoding: 'utf8', timeout: 30000 })); }
    catch (_) { return null; }
  }

  async function dismissIonLoadings() {
    await pg.evaluate(() => {
      document.querySelectorAll('ion-loading').forEach(el => {
        if (el.offsetParent !== null) try { el.dismiss(); } catch (_) {}
      });
    });
  }

  async function clickBack() {
    // Back de app-cobros-header = img.fechaAtras src=flecha-blanca.png → filtrar por rect, NO por src
    const coords = await pg.evaluate(() => {
      const imgs = [...document.querySelectorAll('img.fechaAtras')];
      const back = imgs.find(img => {
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.x < 100 && r.y < 120;
      });
      if (!back) return null;
      const target = back.closest('a') || back;
      const r = target.getBoundingClientRect();
      // 🔴 Segunda defensa: comprobar qué elemento recibiría el clic en ese punto.
      //    Si es el SALIR del home de la app, no se pulsa. Un script de prueba
      //    nunca debe cerrar la sesión del usuario.
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const enElPunto = document.elementFromPoint(cx, cy);
      const txt = ((enElPunto && enElPunto.innerText) || '').trim();
      if (/^\s*salir\s*$/i.test(txt)) return { peligro: txt };
      return { x: cx, y: cy };
    });
    if (!coords) throw new Error('img.fechaAtras no encontrado');
    if (coords.peligro) throw new Error(`el «atrás» caería sobre «${coords.peligro}» — no se pulsa`);
    await pg.mouse.click(coords.x, coords.y, { delay: 60 });
  }

  async function clickAlertBtn(labels = ['Aceptar', 'OK']) {
    await pg.waitForTimeout(900);
    await dismissIonLoadings();
    await pg.waitForTimeout(300);
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
          b.textContent.trim().toLowerCase() === lbl.toLowerCase() && b.getBoundingClientRect().width > 0);
        if (btn) { const r = btn.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: lbl }; }
      }
      return null;
    }, labels);
    if (!coords) throw new Error('Alert btn no encontrado: ' + labels.join('/'));
    await pg.mouse.click(coords.x, coords.y);
    await pg.waitForTimeout(600);
    // 🔴 EL PRIMER CLIC SOBRE EL BOTÓN DE UNA ion-alert PUEDE CAER EN EL
    //    ION-BACKDROP. No falla: simplemente no cierra, y el error aparece dos
    //    pasos después disfrazado de «el siguiente clic no hizo nada» (porque el
    //    backdrop sigue tapando la pantalla). Si la alerta SIGUE viva, se
    //    reintenta con coordenadas frescas.
    const sigueViva = await pg.evaluate(() =>
      [...document.querySelectorAll('ion-alert')].some(a =>
        [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0)));
    if (sigueViva) {
      const c2 = await pg.evaluate((lbl) => {
        const a = [...document.querySelectorAll('ion-alert')].filter(x =>
          [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0)).pop();
        if (!a) return null;
        const btn = [...a.querySelectorAll('.alert-button')].find(b =>
          b.textContent.trim().toLowerCase() === String(lbl).toLowerCase() &&
          b.getBoundingClientRect().width > 0);
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        // Verificar OCLUSIÓN, no presencia: si en ese punto responde el backdrop,
        // se pulsa el botón por DOM, que es lo único que lo atraviesa.
        const en = document.elementFromPoint(x, y);
        if (en && /ION-BACKDROP/i.test(en.tagName)) { btn.click(); return { via: 'dom' }; }
        return { x, y, via: 'mouse' };
      }, coords.label);
      if (c2 && c2.via === 'mouse') await pg.mouse.click(c2.x, c2.y);
      await pg.waitForTimeout(600);
    }
    return coords.label;
  }

  // Lee el título/mensaje del alert activo (ion-alert.textContent devuelve "" en este build → usar .alert-title/.alert-message)
  async function readAlert() {
    return pg.evaluate(() => {
      const a = [...document.querySelectorAll('ion-alert')].find(x => {
        const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
        const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!a) return null;
      const t = a.querySelector('.alert-title, .alert-head');
      const m = a.querySelector('.alert-message');
      return [(t && t.textContent.trim()) || '', (m && m.textContent.trim()) || ''].filter(Boolean).join(' · ');
    });
  }

  // dirty-guard: título "Denario Cobros"/message vacío → detectar por BOTONES, salir con "Salir sin guardar"
  async function dismissDirtyGuard() {
    const coords = await pg.evaluate(() => {
      const alerts = [...document.querySelectorAll('ion-alert')].filter(a => {
        const isTraditional = !a.classList.contains('overlay-hidden') && a.offsetParent !== null;
        const hasVisibleBtn = [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!alerts.length) return null;
      const btn = [...alerts[alerts.length - 1].querySelectorAll('.alert-button')].find(b =>
        b.textContent.trim().toLowerCase() === 'salir sin guardar' && b.getBoundingClientRect().width > 0);
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!coords) return false;
    await pg.mouse.click(coords.x, coords.y);
    await pg.waitForTimeout(800);
    return true;
  }

  // Botón home de cobros con Pointer+Mouse (los tiles requieren PointerEvent + click)
  async function clickBotonHome(texto) {
    const coords = await pg.evaluate((t) => {
      const btns = [...document.querySelectorAll('app-cobros ion-button')].filter(
        b => b.textContent.trim() === t && b.getBoundingClientRect().width > 0);
      if (!btns.length) return null;
      const el = btns[0];
      const r = el.getBoundingClientRect();
      // Disparar el handler real vía Pointer+Mouse en el shadow button
      try {
        const inner = el.shadowRoot && el.shadowRoot.querySelector('button');
        (inner || el).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        (inner || el).dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      } catch (_) {}
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, texto);
    if (!coords) throw new Error(`Botón "${texto}" no encontrado en home cobros`);
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
  }

  async function isHomeCobrosVisible() {
    return pg.evaluate(() =>
      [...document.querySelectorAll('app-cobros ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .some(b => b.textContent.trim() === 'COBRO'));
  }

  /**
   * Vuelve al home del módulo Cobros retrocediendo.
   *
   * 🔴 FRENO DE SEGURIDAD (07/09). Antes pulsaba «atrás» hasta 6 veces seguidas
   *    sin mirar dónde estaba. Cuando el flujo descarrilaba —p. ej. porque el
   *    cliente de prueba no cargó— seguía retrocediendo: salía de Cobros,
   *    llegaba al HOME DE LA APP y el siguiente «atrás» caía sobre **SALIR**,
   *    **cerrando la sesión del usuario**. Eso obliga a volver a entrar y
   *    resincronizar, y le arruina la sesión a quien esté usando el equipo.
   *
   *    Un script de prueba NUNCA debe poder cerrar la sesión. Ahora, si detecta
   *    que ya salió del módulo, se detiene y lo dice, en vez de seguir pulsando.
   */
  async function irAHomeCobros(maxAttempts = 6) {
    for (let i = 0; i < maxAttempts; i++) {
      if (await isHomeCobrosVisible()) return;

      // ¿Seguimos dentro del módulo? Si ya estamos en el home de la app, otro
      // «atrás» pega en SALIR.
      const fuera = await pg.evaluate(() => {
        const viva = [...document.querySelectorAll('.ion-page')]
          .filter(p => !p.classList.contains('ion-page-hidden'))
          .map(p => p.tagName.toLowerCase()).pop() || '';
        const ruta = location.hash || location.pathname;
        return { viva, ruta, enHomeApp: viva === 'app-home' || /^\/?home$/.test(ruta.replace('#', '')) };
      });
      if (fuera.enHomeApp) {
        throw new Error(`salí del módulo Cobros (${fuera.viva}) — me detengo para no pulsar SALIR`);
      }

      try { await clickBack(); } catch (_) {}
      await pg.waitForTimeout(900);
      await dismissDirtyGuard();
      await pg.waitForTimeout(400);
    }
    if (!(await isHomeCobrosVisible())) throw new Error('No se pudo llegar a home cobros');
  }

  // ¿estamos en el formulario? (segment-buttons visibles; el contenedor siempre offsetParent!==null)
  async function isFormVisible() {
    return pg.evaluate(() =>
      [...document.querySelectorAll('app-cobros-container ion-segment-button, app-cobro ion-segment-button')]
        .some(s => s.getBoundingClientRect().width > 0));
  }

  // Cambiar de tab: asignar ion-segment.value + ionChange (más fiable que click en segment-button)
  // 🔴 LA PESTAÑA «GENERAL» SE LLAMA "default".
  //    `cobro.component.html:4` → <ion-segment-button value="default">. Las otras
  //    cuatro sí usan su nombre. Durante toda la corrida del 07/09 se pedía
  //    'general': `seg.value` quedaba en un valor que ningún botón tiene, NO se
  //    seleccionaba ninguna pestaña y la vista quedaba EN BLANCO. Por eso la foto
  //    de DM-COB-024 leyó 0 inputs y el cotejo nunca pudo hacerse.
  //
  //    Fallaba en silencio porque la función no devolvía nada y todas las
  //    llamadas van con `.catch(() => {})`. Ahora valida contra los valores que
  //    existen de verdad y devuelve el resultado.
  const ALIAS_TAB = { general: 'default', datos: 'default' };

  async function clickTab(value) {
    const destino = ALIAS_TAB[value] || value;
    const r = await pg.evaluate((val) => {
      const seg = document.querySelector('app-cobros-container ion-segment, app-cobro ion-segment, ion-segment');
      if (!seg) return { ok: false, motivo: 'no hay ion-segment en pantalla' };
      const botones = [...seg.querySelectorAll('ion-segment-button')];
      const valores = botones.map(b => String(b.value ?? b.getAttribute('value') ?? ''));
      if (!valores.includes(val)) {
        return { ok: false, motivo: `la pestaña "${val}" no existe`, valores };
      }
      seg.value = val;
      seg.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: val } }));
      return { ok: true, valores };
    }, destino);
    await pg.waitForTimeout(1000);
    return r;
  }

  // Abrir nuevo cobro: click REAL en el tile (nuevoCobro programático NO re-renderiza tras Guardado)
  async function abrirNuevoCobro() {
    await clickBotonHome('COBRO');
    // Esperar los 5 tabs. ⚠ 18 vueltas × 700 ms = ~12 s: con 8 s se quedó corto
    //   cuando la pantalla anterior aún estaba replegando (DM-COB-026, 14/09).
    for (let i = 0; i < 18; i++) {
      await pg.waitForTimeout(700);
      const tabs = await pg.evaluate(() =>
        [...document.querySelectorAll('ion-segment-button')].filter(s => s.getBoundingClientRect().width > 0).length);
      if (tabs >= 4) return true;
    }
    return false;
  }

  // Qué cliente se clickeó DE VERDAD. El reporte debe decir esto, no lo que
  // pedía el perfil: son cosas distintas y confundirlas ya hizo mentir a un reporte.
  let ultimoClienteClickeado = null;

  // Modal cliente: #clienteSelectModal.present() (click en ion-input NO lo abre)
  async function seleccionarCliente(nombre) {
    await pg.evaluate(() => {
      const m = document.querySelector('#clienteSelectModal');
      if (m && typeof m.present === 'function') m.present();
    });
    await pg.waitForTimeout(2000);

    // ── Filtrar ───────────────────────────────────────────────────────────────
    //
    // 🔴 DOS COSAS QUE HACÍAN FALLAR ESTO EN SILENCIO (medidas el 14/09):
    //
    // 1. **El modal solo carga 50 clientes de golpe** (el vendedor V.0002 tiene
    //    78). Si el filtro no se aplica, los 28 últimos NO ESTÁN EN EL DOM:
    //    C.1018 «no encontrado · 50 listados» no era que faltara el cliente,
    //    era que la lista salió sin filtrar.
    // 2. **El buscador filtra con ENTER, no al teclear** — y si el input todavía
    //    no existe cuando se hace `focus()`, las pulsaciones se pierden y la
    //    lista queda entera. Pasaba de forma intermitente, según lo que tardara
    //    el modal en presentarse.
    //
    // Ahora: se espera al input, se LIMPIA, se teclea, y se COMPRUEBA que el
    // texto quedó dentro; si no, se reintenta. Y si aun así no aparece, se
    // recorre la lista hacia abajo para forzar la carga del resto.
    if (nombre) {
      const clave = nombre.trim();
      const buscar = async () => {
        const listo = await pg.evaluate(() => {
          const modal = document.querySelector('#clienteSelectModal') ||
                        document.querySelector('ion-modal.show-modal');
          const inp = modal && modal.querySelector('input:not([type=hidden])');
          if (!inp) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(inp, '');
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.focus();
          return true;
        });
        if (!listo) return { ok: false, motivo: 'el buscador del modal no está en el DOM' };
        await pg.waitForTimeout(400);
        await pg.keyboard.type(clave, { delay: 45 }).catch(() => {});
        await pg.waitForTimeout(300);
        const escrito = await pg.evaluate(() => {
          const modal = document.querySelector('#clienteSelectModal') ||
                        document.querySelector('ion-modal.show-modal');
          const inp = modal && modal.querySelector('input:not([type=hidden])');
          return inp ? inp.value : null;
        });
        await pg.keyboard.press('Enter').catch(() => {});
        await pg.waitForTimeout(1600);
        return { ok: String(escrito || '').trim() === clave, escrito };
      };

      let r = await buscar();
      if (!r.ok) { await pg.waitForTimeout(900); r = await buscar(); }

      // ¿Quedó en la lista? Si no, puede ser que el filtro no aplicara y el
      // cliente esté más allá de los 50 primeros: se recorre hacia abajo.
      const presente = () => pg.evaluate((cl) => {
        const modal = document.querySelector('#clienteSelectModal') ||
                      document.querySelector('ion-modal.show-modal');
        if (!modal) return { n: 0, hay: false };
        const its = [...modal.querySelectorAll('ion-item')].filter(e => e.getBoundingClientRect().width > 0);
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return { n: its.length, hay: its.some(i => norm(i.innerText).includes(norm(cl))) };
      }, clave);

      let est = await presente();
      for (let i = 0; i < 12 && !est.hay && est.n >= 50; i++) {
        await pg.evaluate(() => {
          const modal = document.querySelector('#clienteSelectModal') ||
                        document.querySelector('ion-modal.show-modal');
          const c = modal && modal.querySelector('ion-content');
          if (c && c.scrollToBottom) c.scrollToBottom(0);
          else if (c) c.scrollTop = c.scrollHeight;
        });
        await pg.waitForTimeout(500);
        est = await presente();
      }
    }

    // Click en el <p> del nombre (NO el centro del item → zona de saldos activa masInfo→BUSCAR)
    //
    // 🔴 ANTES CAÍA EN `ps[0]` SIN AVISAR. La línea era `target = target || ps[0]`:
    //    si el cliente pedido no aparecía, elegía **el primero de la lista** y
    //    seguía como si nada. El reporte imprimía el cliente del PERFIL, no el
    //    que se había clickeado, así que mentía. Se detectó en 4K (02/09): el
    //    perfil pide `C.0507` —un CÓDIGO— y el modal lista NOMBRES, así que no
    //    casaba nunca; se cobraba contra un cliente cualquiera y los casos
    //    siguientes morían con "cliente sin documentos".
    //
    // Ahora: se busca por CÓDIGO o por NOMBRE sobre el texto completo del ítem,
    // y si no está, **falla con nombre y apellido**. Un cliente equivocado en
    // silencio es peor que un FAIL.
    const hallazgo = await pg.evaluate((nom) => {
      const visible = (el) => el.getBoundingClientRect().width > 0;
      const modal = document.querySelector('#clienteSelectModal') ||
                    document.querySelector('ion-modal.show-modal');
      if (!modal) return { err: 'el modal de clientes no está abierto' };

      const items = [...modal.querySelectorAll('ion-item')].filter(visible);
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const clave = norm(nom);

      // El <p> es el punto SEGURO donde clickear; el texto del ion-item es lo
      // que se compara, porque ahí vienen código y nombre juntos.
      const candidatos = items.map(it => ({
        it,
        txt: norm(it.innerText),
        p: [...it.querySelectorAll('p')].filter(visible)[0] || null,
      })).filter(c => c.p);

      if (!candidatos.length) return { err: 'el modal no listó clientes', n: items.length };
      if (!clave) return { err: 'no se indicó cliente_test en el perfil del cliente' };

      // exacto primero, luego por substring (el código suele venir con prefijo)
      const elegido = candidatos.find(c => c.txt === clave)
                   || candidatos.find(c => c.txt.includes(clave));
      if (!elegido) {
        return { err: 'no encontrado', n: candidatos.length,
                 muestra: candidatos.slice(0, 5).map(c => c.txt.slice(0, 60)) };
      }
      elegido.p.scrollIntoView({ block: 'center' });
      const r = elegido.p.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2,
               elegido: elegido.txt.slice(0, 80), n: candidatos.length };
    }, nombre);

    if (hallazgo.err) {
      const extra = hallazgo.muestra
        ? ` · ${hallazgo.n} listados, p.ej.: ${hallazgo.muestra.join(' | ')}`
        : hallazgo.n !== undefined ? ` · ${hallazgo.n} ítems` : '';
      throw new Error(`Cliente "${nombre}" ${hallazgo.err}${extra}`);
    }
    ultimoClienteClickeado = hallazgo.elegido;
    const coords = { x: hallazgo.x, y: hallazgo.y };
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
    await pg.waitForTimeout(2500);
    // Reintento (el 1er click a veces no marca)
    const stillModal = await pg.evaluate(() =>
      !!document.querySelector('ion-modal.show-modal #clienteSelectModal, #clienteSelectModal.show-modal') ||
      [...document.querySelectorAll('#clienteSelectModal')].some(m => m.getBoundingClientRect().width > 0 && m.offsetParent !== null));
    if (stillModal && coords) {
      await pg.mouse.click(coords.x, coords.y + 8, { delay: 80 });
      await pg.waitForTimeout(2000);
    }
  }

  // Llenar Comentario: 2º ion-input.inp-write (1º=Responsable id=currency; 2º=Comentario, nace ion-invalid)
  /**
   * Escribe el campo Comentario del cobro.
   *
   * 🔴 El selector `.inp-write` DEJÓ DE EXISTIR (medido el 07/09: 0 elementos lo
   *    tienen). Con él, la función no encontraba nada y devolvía false — y como
   *    nadie miraba ese false, el módulo seguía adelante con las 5 pestañas
   *    bloqueadas y el fallo aparecía después disfrazado de «tabs no habilitadas».
   *
   *    Ahora se ancla al **label «Comentario:»**, que es estable y describe el
   *    campo, en vez de a una clase de estilo. Se conserva `.inp-write` como
   *    último recurso por si algún build viejo lo usa.
   */
  async function fillComentario(texto) {
    const ok = await pg.evaluate((val) => {
      const vis = (el) => el.getBoundingClientRect().width > 0;
      const etiqueta = (el) => String(el.getAttribute('label') || el.label || '');

      const todos = [...document.querySelectorAll('ion-input, ion-textarea')].filter(vis);
      let target =
        // 1) por su label — el ancla buena
        todos.find(i => /coment/i.test(etiqueta(i)))
        // 2) compatibilidad: builds que aún usen la clase de estilo
        || [...document.querySelectorAll('ion-input.inp-write')].filter(vis)
             .find(i => i.classList.contains('ion-invalid') && !(i.value || '').trim())
        // 3) el que nace inválido y vacío (el obligatorio sin llenar)
        || todos.find(i => i.classList.contains('ng-invalid') && !(i.value || '').trim());
      if (!target) return false;
      const native = target.querySelector('input') || (target.shadowRoot && target.shadowRoot.querySelector('input'));
      if (!native) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(native, val);
      native.dispatchEvent(new Event('input', { bubbles: true }));
      native.dispatchEvent(new Event('change', { bubbles: true }));
      target.dispatchEvent(new CustomEvent('ionInput', { bubbles: true, detail: { value: val } }));
      target.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: val } }));
      native.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }, texto);
    await pg.waitForTimeout(600);
    return ok;
  }

  async function tabsHabilitadas() {
    return pg.evaluate(() =>
      [...document.querySelectorAll('ion-segment-button')]
        .filter(s => s.getBoundingClientRect().width > 0 && !s.disabled && s.getAttribute('disabled') === null).length);
  }

  // Selecciona la moneda documento (1er ion-select del Tab Documentos) = USD por defecto para docs $
  /**
   * 📸 Foto de los campos visibles del cobro — se toma antes de guardar y otra
   *    vez al reabrir, y el cotejo de DM-COB-024 compara las dos.
   *
   * 🔴 Estaba DUPLICADA con dos indentaciones distintas, y al corregir una sola
   *    las fotos dejaron de ser comparables. Ahora hay UNA definición.
   *
   * 🔴 Y leía SOLO el atributo `label`: en la corrida del 07/09 16:02 devolvió
   *    CERO campos, así que 024 no pudo medir nada. No todos los campos del
   *    cobro rotulan así — algunos usan un <ion-label> hermano o el placeholder.
   *    Se prueban las tres vías y se guarda un diagnóstico para no quedar a
   *    ciegas si vuelve a salir vacía.
   */
  async function fotoDelCobro() {
    return pg.evaluate(() => {
      const vis = el => el.getBoundingClientRect().width > 0;
      const valor = (el) => {
        const n = el.querySelector('input, textarea') ||
                  (el.shadowRoot && el.shadowRoot.querySelector('input, textarea'));
        return n ? String(n.value).trim() : '';
      };
      const rotulo = (el) => {
        const attr = String(el.getAttribute('label') || el.label || '').trim();
        if (attr) return attr;
        const item = el.closest('ion-item, ion-col, .item');
        const lab = item && item.querySelector('ion-label');
        const t = lab ? (lab.textContent || '').replace(/\s+/g, ' ').trim() : '';
        if (t) return t;
        return String(el.getAttribute('placeholder') || el.placeholder || '').trim();
      };
      const todos = [...document.querySelectorAll('ion-input, ion-textarea')].filter(vis);
      const campos = {};
      for (const el of todos) {
        const et = rotulo(el);
        if (et) campos[et] = valor(el);
      }
      const txt = (document.body.innerText || '').replace(/\s+/g, ' ');
      const tot = txt.match(/Monto total a pagar[^:]*:\s*([\d.,]+)/i);
      const seg = document.querySelector('ion-segment-button.segment-button-checked')
               || document.querySelector('ion-segment-button[aria-selected="true"]');
      return {
        campos,
        total: tot ? tot[1] : null,
        diag: {
          inputsVisibles: todos.length,
          tabActiva: seg ? (seg.textContent || '').replace(/\s+/g, ' ').trim() : '?',
          muestra: todos.slice(0, 6).map(rotulo).filter(Boolean),
        },
      };
    });
  }

  async function seleccionarMonedaDocumento(pref = 'US') {
    const res = await pg.evaluate((p) => {
      const sel = document.querySelector('app-cobro-documents ion-select');
      if (!sel) return { ok: false, err: 'ion-select moneda no encontrado' };
      const opts = [...sel.querySelectorAll('ion-select-option')];
      const labels = opts.map(o => (o.textContent || '').trim());
      const opt = opts.find(o => (o.textContent || '').toUpperCase().includes(p.toUpperCase())) || opts[0];
      if (!opt) return { ok: false, err: 'sin opciones de moneda', labels };
      sel.value = opt.value;
      sel.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: opt.value } }));
      return { ok: true, elegida: (opt.textContent || '').trim(), labels };
    }, pref);
    await pg.waitForTimeout(1800);
    return res;
  }

  // Cuenta documentos (checkboxes) visibles en el Tab Documentos.
  async function contarDocumentos() {
    return pg.evaluate(() => {
      const docs = document.querySelector('app-cobro-documents');
      if (!docs || docs.offsetParent === null) return 0;
      return [...docs.querySelectorAll('ion-checkbox')].filter(c => c.getBoundingClientRect().width > 0).length;
    });
  }

  // Carga documentos robusta: selecciona Moneda Documento (US$) y reintenta con toggle si no cargan.
  async function cargarDocumentos() {
    let moneda = null, cbs = 0;
    for (let i = 0; i < 5; i++) {
      moneda = await seleccionarMonedaDocumento('US');
      await pg.waitForTimeout(1500);
      cbs = await contarDocumentos();
      if (cbs > 0) break;
      // toggle: elegir otra moneda y volver, fuerza recarga de la lista
      await seleccionarMonedaDocumento('BS');
      await pg.waitForTimeout(1200);
    }
    return { cbs, moneda };
  }

  // Marca el primer documento (checkbox) del Tab Documentos → devuelve {ok, count}
  async function marcarPrimerDocumento() {
    const info = await pg.evaluate(() => {
      const docs = document.querySelector('app-cobro-documents');
      if (!docs || docs.offsetParent === null) return { count: 0 };
      const cbs = [...docs.querySelectorAll('ion-checkbox')].filter(c => c.getBoundingClientRect().width > 0);
      return { count: cbs.length };
    });
    if (info.count === 0) return { ok: false, count: 0 };
    const coords = await pg.evaluate(() => {
      const docs = document.querySelector('app-cobro-documents');
      const cbs = [...docs.querySelectorAll('ion-checkbox')]
        .filter(c => c.getBoundingClientRect().width > 0)
        .sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
      const r = cbs[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
    await pg.waitForTimeout(1200);
    return { ok: true, count: info.count };
  }

  // ── Guardar / Enviar ────────────────────────────────────────────────────────
  //
  // 🔴 ANTES DISPARABA CUATRO VECES. La versión previa hacía, sin condición:
  //       pointerdown + pointerup + inner.click()   (en el DOM)
  //       + pg.mouse.click(x, y)                    (clic real)
  //    Ionic atiende el `inner.click()` Y el clic real ⇒ **dos activaciones del
  //    mismo botón**. En Guardar deja un cobro duplicado; en Enviar, un envío
  //    duplicado. La razón de que estuvieran los dos era que «el header fijo en
  //    y≈32 no siempre recibe el mouse» — cierto, pero eso se resuelve con un
  //    fallback CONDICIONADO, no disparando ambos a ciegas.
  //
  // Ahora: **un solo disparo**, se comprueba si la pantalla reaccionó, y solo si
  // no reaccionó se intenta la vía alterna. Nunca las dos.
  //
  // Devuelve { ok, via, motivo } — ⚠ es un OBJETO: `if (await clickGuardarEnviar())`
  // siempre da verdadero. Evaluar `.ok`.

  /** Huella de la pantalla, para saber si el botón produjo algo. */
  async function huellaPantalla() {
    return pg.evaluate(() => {
      const vis = (el) => el && el.getBoundingClientRect().width > 0 && el.offsetParent !== null;
      const alerts = [...document.querySelectorAll('ion-alert')].filter(a =>
        (!a.classList.contains('overlay-hidden') && a.offsetParent !== null) ||
        [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0));
      return {
        alerts:   alerts.length,
        loadings: [...document.querySelectorAll('ion-loading')].filter(vis).length,
        enCobro:  !!document.querySelector('app-cobro:not(.ion-page-hidden)'),
        url:      location.hash || location.pathname,
      };
    });
  }

  /** ¿Cambió algo respecto de `antes`? Sondea hasta `msMax`. */
  async function esperarReaccion(antes, msMax = 2500) {
    const t0 = Date.now();
    while (Date.now() - t0 < msMax) {
      await pg.waitForTimeout(250);
      const ahora = await huellaPantalla();
      if (ahora.alerts   > antes.alerts)   return { reacciono: true, senal: 'alert' };
      if (ahora.loadings > antes.loadings) return { reacciono: true, senal: 'loading' };
      if (antes.enCobro && !ahora.enCobro) return { reacciono: true, senal: 'navego' };
      if (ahora.url !== antes.url)         return { reacciono: true, senal: 'url' };
    }
    return { reacciono: false };
  }

  async function clickGuardarEnviar(cls) {
    // 🔴 El teclado desplaza el header: si se acaba de escribir, las coordenadas
    //    medidas antes del blur apuntan a otro sitio y el clic «no hace nada».
    await pg.evaluate(() => {
      const a = document.activeElement;
      if (a && typeof a.blur === 'function') a.blur();
    });
    await pg.waitForTimeout(400);

    const btn = await pg.evaluate((sel) => {
      const b = document.querySelector(`ion-button.${sel}`);
      if (!b) return { estado: 'ausente' };
      if (b.disabled) return { estado: 'deshabilitado' };
      const r = b.getBoundingClientRect();
      if (r.width === 0) return { estado: 'invisible' };
      return { estado: 'ok', x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, cls);

    if (btn.estado !== 'ok') return { ok: false, via: null, motivo: `botón ${btn.estado}` };

    const antes = await huellaPantalla();

    // Intento 1 — clic REAL. Es el que reproduce lo que hace la QA a mano.
    await pg.mouse.click(btn.x, btn.y, { delay: 120 });
    let r = await esperarReaccion(antes);
    if (r.reacciono) return { ok: true, via: 'mouse', motivo: r.senal };

    // Intento 2 — solo porque el primero NO produjo nada: el header fijo puede
    // quedar fuera del área que recibe el mouse. Una sola activación más.
    const disparo = await pg.evaluate((sel) => {
      const b = document.querySelector(`ion-button.${sel}`);
      if (!b || b.disabled) return false;
      const inner = b.shadowRoot && b.shadowRoot.querySelector('button');
      try { (inner || b).click(); return true; } catch (_) { return false; }
    }, cls);
    if (!disparo) return { ok: false, via: 'mouse', motivo: 'sin reacción y no se pudo reintentar' };

    r = await esperarReaccion(antes);
    return r.reacciono
      ? { ok: true,  via: 'dom', motivo: r.senal }
      : { ok: false, via: 'ambas', motivo: 'el botón no produjo ninguna reacción' };
  }

  function blockFase2(motivo = 'Fase 2 — pendiente de construir/depurar en device') {
    FASE2.forEach(id => v(id, id, 'BLOCKED', motivo));
  }

  /**
   * ORÁCULO DEL ENVÍO — y del disparo único.
   *
   * 🔴 Por qué CUENTA filas y no se conforma con «apareció»: mientras
   *    `clickGuardarEnviar()` disparaba cuatro veces (pointerdown+pointerup+
   *    click del DOM **y** un mouse.click), un solo Enviar podía crear DOS
   *    cobros en la nube. Con un oráculo que solo pregunta «¿está?», el script
   *    daba PASS y el duplicado pasaba inadvertido — y peor: cualquier otro
   *    resultado quedaba contaminado, porque ya no se puede distinguir «el
   *    producto duplicó» de «yo pulsé dos veces».
   *
   * ⚠ Un envío legítimo puede dejar DOS filas con el mismo comentario: el cobro
   *   (`co_type = 0`) y el ANTICIPO AUTOMÁTICO por excedente (`co_type = 1`).
   *   Se ven así en 4K, p. ej. 2706 (cobro 1.862,00) + 2707 (anticipo 0,01).
   *   Por eso se cuenta POR TIPO: duplicado = más de una fila del MISMO co_type.
   *
   * @param {string} comentario  marca única de la corrida
   * @param {number} [esperas]   reintentos (la sincronización no siempre es instantánea)
   */
  async function verificarNube(comentario, esperas = 5) {
    if (!DATA.clienteSlug) return { ok: false, motivo: 'sin clienteSlug: no se pudo consultar la nube' };
    const leer = () => consultaNube(DATA.clienteSlug,
      `select id_collection, co_collection, co_type, st_collection, nu_amount_total, ` +
      `nu_difference, co_currency, tx_comment from collection where tx_comment = '${comentario}' ` +
      `order by id_collection`);
    let filas = null;
    for (let i = 0; i < esperas; i++) {
      filas = leer();
      if (filas && filas.length) break;
      await pg.waitForTimeout(3000);
    }
    // 🔴 NO cortar en cuanto aparece la primera fila. Un envío con excedente
    //    crea DOS filas (cobro + anticipo) y no siempre llegan juntas: si se
    //    lee justo en medio se concluye «no se generó anticipo» cuando sí se
    //    generó, y eso es reportar un defecto que no existe. Se deja asentar:
    //    se relee hasta que el conteo REPITA, o se agoten los intentos.
    if (filas && filas.length) {
      for (let i = 0; i < 4; i++) {
        await pg.waitForTimeout(4000);
        const otra = leer();
        if (otra && otra.length > filas.length) { filas = otra; continue; }
        if (otra) filas = otra;
        break;
      }
    }
    if (!filas) return { ok: false, motivo: 'la consulta a la nube falló' };
    const cobros    = filas.filter(f => Number(f.co_type) === 0);
    const anticipos = filas.filter(f => Number(f.co_type) === 1);
    // Duplicado = más de una fila del MISMO tipo con la misma marca.
    const duplicado = cobros.length > 1 || anticipos.length > 1;
    return {
      ok: filas.length > 0,
      filas, cobros, anticipos, duplicado,
      resumen: filas.length
        ? filas.map(f => `${f.id_collection}/${f.co_collection} co_type=${f.co_type} ` +
                         `${f.nu_amount_total} ${f.co_currency || ''} st=${f.st_collection}`).join(' · ')
        : `ninguna fila con comentario ${comentario}`,
      aviso: duplicado
        ? ` · 🔴 DUPLICADO: ${cobros.length} cobro(s) y ${anticipos.length} anticipo(s) ` +
          `con la MISMA marca. Si el script disparó una sola vez, es defecto del producto; ` +
          `si no, es el disparo múltiple de clickGuardarEnviar()`
        : '',
    };
  }

  // Lee el "Monto total a pagar" y la Diferencia (texto + color) del Tab Pagos.
  async function leerPagosSticky() {
    return pg.evaluate(() => {
      const root = document.querySelector('app-cobro-pagos') || document.body;
      const txt = root.textContent.replace(/\s+/g, ' ');
      const totalM = txt.match(/Monto total a pagar[^\d-]*([\d.,-]+)/i);
      // Diferencia: span hoja con color en style
      let difColor = null, difVal = null;
      const spans = [...root.querySelectorAll('span, ion-text, p, div')].filter(n => /Diferencia/i.test(n.textContent || ''));
      for (const s of spans) {
        const leaf = [...s.querySelectorAll('*')].filter(x => x.children.length === 0 && /Diferencia/i.test(x.textContent));
        const node = leaf[0] || s;
        const st = (node.getAttribute && node.getAttribute('style')) || '';
        const cs = getComputedStyle(node).color;
        const m = (node.textContent || '').match(/Diferencia[^\d-]*([\d.,-]+)/i);
        if (m) { difVal = m[1]; difColor = (/red/i.test(st) ? 'red' : /blue/i.test(st) ? 'blue' : cs); break; }
      }
      return { total: totalM ? totalM[1] : null, difVal, difColor };
    });
  }

  // Convierte "66.852,91" → "6685291" (dígitos para el input de monto centavos-acumulativo)
  /**
   * "Bs: 1.017.900,00" → 1017900. Formato es-VE: el punto agrupa, la coma decide.
   * Devuelve null si no hay número, para no confundir «no se pudo leer» con 0.
   */
  function montoANumero(txt) {
    if (txt === null || txt === undefined) return null;
    const m = String(txt).match(/-?[\d.,]+/);
    if (!m) return null;
    const n = Number(m[0].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Deja la LISTA de cobros a la vista y devuelve el conteo por estado.
   *
   * 🔴 Antes cada caso repetía «irAHome + BUSCAR + dormir un rato» y leía. Con un
   *    sleep fijo la lista salía VACÍA (0 ítems justo después de contar 20) y eso
   *    tumbó DM-COB-019 tres corridas seguidas. Aquí se espera a que CARGUE y, si
   *    no aparece, se reintenta la navegación entera antes de rendirse.
   */
  async function abrirListaCobros(intentos = 3) {
    for (let n = 0; n < intentos; n++) {
      await dismissIonLoadings().catch(() => {});
      await irAHomeCobros().catch(() => {});
      await clickBotonHome('BUSCAR').catch(() => {});
      for (let i = 0; i < 8; i++) {
        await pg.waitForTimeout(1000);
        const r = await pg.evaluate(() => {
          const lista = document.querySelector('app-cobros-list');
          if (!lista || lista.offsetParent === null) return { lista: false, total: 0, guardados: 0, enviados: 0 };
          const its = [...lista.querySelectorAll('ion-item')].filter(el => el.getBoundingClientRect().width > 0);
          return {
            lista: true,
            total: its.length,
            guardados: its.filter(el => /Guardado/i.test(el.textContent)).length,
            enviados: its.filter(el => /Enviado|Por aprobar/i.test(el.textContent)).length,
          };
        });
        if (r.lista && r.total > 0) return r;
      }
    }
    return { lista: false, total: 0, guardados: 0, enviados: 0 };
  }

  /**
   * Abre un cobro en estado Guardado.
   *
   * 🔑 `marca` = el comentario único del cobro que se acaba de guardar. Sin ella
   *    se abría «el primero de la lista», que puede ser un Guardado VIEJO de otra
   *    corrida — y entonces el caso de persistencia compara contra un cobro que
   *    no es el suyo y da un PASS o un FAIL igual de falsos. Si la marca no se
   *    encuentra se abre el primero, pero el resultado lo dice.
   */
  async function reabrirGuardado(marca = null) {
    const r = await pg.evaluate((m) => {
      const items = [...document.querySelectorAll('app-cobros-list ion-item')]
        .filter(el => el.getBoundingClientRect().width > 0 && /Guardado/i.test(el.textContent));
      if (!items.length) return null;
      const porMarca = m ? items.find(el => (el.textContent || '').includes(m)) : null;
      const el = porMarca || items[0];
      el.scrollIntoView({ block: 'center' });
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2,
               porMarca: !!porMarca, guardados: items.length };
    }, marca);
    if (!r) return false;
    await pg.mouse.click(r.x, r.y, { delay: 120 });
    await pg.waitForTimeout(2500);
    ultimoReabierto = r;
    return (await tabsHabilitadas()) >= 3;
  }
  /** Diagnóstico del último `reabrirGuardado` (si abrió por marca o a ciegas). */
  let ultimoReabierto = null;

  function montoADigitos(txt) {
    if (!txt) return '';
    return String(txt).replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  }

  /**
   * Agrega método Efectivo. Devuelve { ok, monto, error }.
   *
   * @param {string|null} digitosFijos  dígitos del monto SIN separadores (centavos
   *        incluidos: "5000" = 50,00). Si va null se usa el total a pagar, que es
   *        lo que quiere el happy path. Hace falta poder fijarlo para el ANTICIPO
   *        —donde no hay documentos y el total es 0— y para los bordes de
   *        tolerancia, donde el monto tiene que exceder el total a propósito.
   */
  async function agregarPagoEfectivo(digitosFijos = null) {
    // 1. Abrir modal (#eventSelect → setShowEventModal(true))
    const addInfo = await pg.evaluate(() => {
      const btn = document.querySelector('ion-button#eventSelect, ion-button.pagos-add-method-btn');
      if (!btn || btn.disabled || btn.getBoundingClientRect().width === 0) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!addInfo) return { ok: false, error: 'botón Agregar método disabled/ausente' };
    await pg.mouse.click(addInfo.x, addInfo.y, { delay: 100 });
    await pg.waitForTimeout(1500);

    // 2. Check Efectivo en el modal (ionChange sobre el checkbox de la fila "Efectivo")
    const checked = await pg.evaluate(() => {
      const mod = [...document.querySelectorAll('#eventModal')].find(m => m.offsetParent !== null);
      if (!mod) return false;
      const items = [...mod.querySelectorAll('ion-item')];
      const it = items.find(i => /Efectivo/i.test(i.textContent));
      if (!it) return false;
      const cb = it.querySelector('ion-checkbox');
      if (!cb) return false;
      cb.checked = true;
      cb.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { checked: true } }));
      return true;
    });
    if (!checked) return { ok: false, error: 'checkbox Efectivo no encontrado en #eventModal' };
    await pg.waitForTimeout(600);

    // 3. Aceptar (.botonAddVerde → onAceptarTiposPago())
    await pg.evaluate(() => {
      const mod = [...document.querySelectorAll('#eventModal')].find(m => m.offsetParent !== null);
      if (!mod) return;
      const btn = [...mod.querySelectorAll('ion-button.botonAddVerde')].find(b => b.getBoundingClientRect().width > 0);
      if (btn) btn.click();
    });
    await pg.waitForTimeout(1500);

    // 4. Expandir el accordion Efectivo. Setear value en TODOS los accordion-group + click header.
    await pg.evaluate(() => {
      document.querySelectorAll('app-cobro-pagos ion-accordion-group').forEach(grp => {
        const acc = grp.querySelector('ion-accordion');
        const val = acc ? acc.getAttribute('value') : 'efectivo0';
        grp.value = val;
        grp.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: val } }));
      });
      // fallback: click en el header "Efectivo"
      const hdr = [...document.querySelectorAll('app-cobro-pagos ion-accordion ion-item[slot="header"]')]
        .find(h => /Efectivo/i.test(h.textContent));
      if (hdr) hdr.click();
    });
    await pg.waitForTimeout(1200);

    // 5. Leer total → dígitos → llenar Monto (2º ion-input del bloque efectivo; centavos-acumulativo)
    const sticky = await leerPagosSticky();
    const digitos = digitosFijos || montoADigitos(sticky.total);
    if (!digitos) return { ok: false, error: 'no se pudo leer el total a pagar' };

    const focused = await pg.evaluate(() => {
      // El input de Monto tiene inputmode="numeric" (Nro Recibo no). Preferir ese; fallback al 2º ion-input.
      const pagos = document.querySelector('app-cobro-pagos');
      if (!pagos) return { ok: false, diag: 'no app-cobro-pagos' };
      const allInputs = [...pagos.querySelectorAll('ion-input')].filter(i => i.getBoundingClientRect().width > 0);
      let montoIon = allInputs.find(i => {
        const n = i.querySelector('input');
        return n && (n.getAttribute('inputmode') === 'numeric' || /monto/i.test(i.getAttribute('label') || ''));
      });
      if (!montoIon) montoIon = allInputs[1] || allInputs[0];
      const diag = { accs: [...pagos.querySelectorAll('ion-accordion')].map(a => a.getAttribute('value')),
        inputs: allInputs.length };
      if (!montoIon) return { ok: false, diag };
      const native = montoIon.querySelector('input') || (montoIon.shadowRoot && montoIon.shadowRoot.querySelector('input'));
      if (!native) return { ok: false, diag };
      native.focus();
      window.__qaMontoInput = native;
      return { ok: true, diag };
    });
    if (!focused.ok) return { ok: false, error: `input Monto no encontrado (accs:${JSON.stringify(focused.diag && focused.diag.accs)} inputs:${focused.diag && focused.diag.inputs})` };
    // Limpiar y teclear dígitos (onMontoKeyDown arma los centavos)
    for (let i = 0; i < 12; i++) await pg.keyboard.press('Backspace');
    await pg.keyboard.type(digitos, { delay: 40 });
    await pg.evaluate(() => {
      const n = window.__qaMontoInput;
      if (n) { n.dispatchEvent(new Event('blur', { bubbles: true })); }
    });
    await pg.waitForTimeout(1200);
    return { ok: true, monto: digitos, total: sticky.total };
  }
  async function abrirDetalleDocumento() {
    await clickTab('documentos');
    await pg.waitForTimeout(800);
    const coords = await pg.evaluate(() => {
      const docs = document.querySelector('app-cobro-documents');
      if (!docs) return null;
      const btn = [...docs.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .filter(b => b.querySelector('ion-icon[name="search-sharp"]'))
        .find(b => !b.hasAttribute('disabled') && b.getAttribute('disabled') !== 'true');
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!coords) return false;
    await pg.mouse.click(coords.x, coords.y, { delay: 100 });
    await pg.waitForTimeout(1800);
    // El detalle es un ion-modal (#eventModal, isOpen). Confirmar que abrió.
    return pg.evaluate(() =>
      [...document.querySelectorAll('ion-modal')].some(m =>
        m.getBoundingClientRect().width > 0 && /Asignar descuento|Descuento|Nro Comp Ret/i.test(m.textContent || '')));
  }

  /** Pulsa «Asignar descuento» dentro del detalle. */
  async function abrirModalDescuentos() {
    const coords = await pg.evaluate(() => {
      const btn = [...document.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .find(b => /asignar\s+descuento|^descuentos$/i.test((b.textContent || '').trim()));
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!coords) return false;
    await pg.mouse.click(coords.x, coords.y, { delay: 100 });
    await pg.waitForTimeout(1500);
    return pg.evaluate(() =>
      [...document.querySelectorAll('ion-modal.collectDiscounts')].some(m => m.getBoundingClientRect().width > 0));
  }

  /**
   * Lee el estado del modal de descuentos.
   * Las filas se rotulan «{nu}% - {na}», así que el % sale del propio rótulo.
   */
  async function leerModalDescuentos() {
    return pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(m => m.getBoundingClientRect().width > 0);
      if (!modal) return { abierto: false };
      const filas = [...modal.querySelectorAll('ion-item')]
        .filter(it => it.getBoundingClientRect().width > 0 && it.querySelector('ion-checkbox'))
        .map(it => {
          const cb = it.querySelector('ion-checkbox');
          const txt = (it.querySelector('ion-label')?.textContent || '').replace(/\s+/g, ' ').trim();
          const m = txt.match(/^([\d.,]+)\s*%\s*-\s*(.+)$/);
          return {
            texto: txt,
            pct: m ? Number(String(m[1]).replace(',', '.')) : null,
            nombre: m ? m[2].trim() : txt,
            marcado: cb.checked === true || cb.getAttribute('checked') === 'true',
            deshabilitado: cb.disabled === true || cb.hasAttribute('disabled'),
          };
        });
      const dispTxt = (modal.textContent || '').replace(/\s+/g, ' ');
      const disp = dispTxt.match(/Disponible\s*:?\s*([\d.,]+)\s*%/i);
      const aceptar = [...modal.querySelectorAll('ion-button')]
        .find(b => /aceptar/i.test(b.textContent || ''));
      return {
        abierto: true,
        filas,
        disponible: disp ? Number(String(disp[1]).replace(',', '.')) : null,
        aceptarDeshabilitado: aceptar ? (aceptar.disabled === true || aceptar.hasAttribute('disabled')) : null,
        // Input de tasa: solo se renderiza para los descuentos con require_input=true
        hayInputTasa: !!modal.querySelector('ion-input[type="number"]'),
      };
    });
  }

  /** Tilda/destilda la fila cuyo nombre coincide. Devuelve false si no la halla. */
  async function toggleDescuento(nombre) {
    const coords = await pg.evaluate((nom) => {
      const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(m => m.getBoundingClientRect().width > 0);
      if (!modal) return null;
      const it = [...modal.querySelectorAll('ion-item')]
        .filter(x => x.getBoundingClientRect().width > 0 && x.querySelector('ion-checkbox'))
        .find(x => (x.textContent || '').toLowerCase().includes(String(nom).toLowerCase()));
      if (!it) return null;
      const cb = it.querySelector('ion-checkbox');
      cb.scrollIntoView({ block: 'center' });
      const r = cb.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, nombre);
    if (!coords) return false;
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
    await pg.waitForTimeout(1200);
    return true;
  }

  /**
   * Vuelve el modal de descuentos a cero: Cancelar y reabrir.
   *
   * 🔴 NO destildar casilla por casilla. Ese era el método anterior y se comía
   *    su propia cola: cuando una casilla queda tildada SIN estar aplicada
   *    (el desfase de DM-COB-052), clicarla no la quita — la AGREGA, porque el
   *    modelo no la tenía. Así, al llegar a DM-COB-051 el modelo cargaba un 80 %
   *    fantasma y el aviso decía «Máximo disponible: 5%»: el caso fallaba por
   *    culpa del guion, no de la app.
   *    `cancelCollectDiscounts()` descarta la selección temporal y al reabrir
   *    modelo y pantalla vuelven a coincidir.
   */
  async function reiniciarDescuentos() {
    const c = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(m => m.getBoundingClientRect().width > 0);
      if (!modal) return null;
      const btn = [...modal.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .find(b => /cancelar/i.test((b.textContent || '').trim()));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (c) { await pg.mouse.click(c.x, c.y, { delay: 80 }); await pg.waitForTimeout(1200); }
    return abrirModalDescuentos();
  }

  /**
   * Acepta el modal de descuentos (los APLICA al documento abierto).
   *
   * ⚠ Puede aparecer el aviso de «remanente»: si el descuento sobra respecto al
   *   saldo, la app ofrece llevarlo a un anticipo (`alertDiscountRemnantOpen`).
   *   Con un descuento por debajo del saldo no debería salir; se atiende igual.
   */
  /**
   * Pulsa «Aceptar» en el modal de descuentos y espera a que CIERRE.
   *
   * 🔴 DOS COSAS QUE COSTARON UNA VUELTA ENTERA (15/09):
   *
   * 1. **El teclado mueve el botón.** Este modal tiene un campo libre de
   *    descuento manual. Si se acaba de teclear en él, el teclado virtual está
   *    abierto y el pie del modal —donde vive Aceptar— está en otra `y` que la
   *    medida. El clic cae en el vacío: **no da error y no pasa nada**, y el
   *    fallo aparece tres pasos después como «Guardar ausente» en el detalle.
   *    Por eso: `blur()`, esperar, y medir en la misma evaluación que precede
   *    al clic. Con el descuento por PORCENTAJE nunca se vio porque allí lo
   *    último que se toca es una casilla, no un input.
   *
   * 2. **Aceptar no siempre cierra a la primera, y es CORRECTO.** Si el
   *    descuento supera el saldo, `acceptCollectDiscounts()` deja el modal
   *    abierto y levanta la alerta del remanente (el anticipo que se va a
   *    crear). Hasta que esa alerta no se confirma, el modal sigue ahí. Así que
   *    se espera al cierre sondeando, atendiendo las alertas que aparezcan.
   */
  async function aceptarDescuentos() {
    await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await pg.waitForTimeout(800);
    const c = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(m => m.getBoundingClientRect().width > 0);
      if (!modal) return { err: 'el modal de descuentos no está abierto' };
      const btn = [...modal.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .find(b => /aceptar/i.test((b.textContent || '').trim()));
      if (!btn) return { err: 'botón Aceptar ausente' };
      if (btn.disabled === true || btn.hasAttribute('disabled')) {
        return { err: 'botón Aceptar deshabilitado (disabledCollectDiscountButton)' };
      }
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const en = document.elementFromPoint(x, y);
      // 🔑 Verificar OCLUSIÓN, no presencia: si en ese punto responde otra cosa
      //    (el backdrop, el teclado), el clic real no llega al botón.
      const tapado = !(en && (en === btn || btn.contains(en) || en.closest('ion-button') === btn));
      return { x, y, tapado, en: en ? en.tagName : null };
    });
    if (c.err) return { ok: false, motivo: c.err };

    if (!c.tapado) await pg.mouse.click(c.x, c.y, { delay: 90 });
    else await pg.evaluate(() => {
      const m = [...document.querySelectorAll('ion-modal.collectDiscounts')]
        .find(x => x.getBoundingClientRect().width > 0);
      const b = m && [...m.querySelectorAll('ion-button')]
        .find(x => /aceptar/i.test((x.textContent || '').trim()));
      if (b) ((b.shadowRoot && b.shadowRoot.querySelector('button')) || b).click();
    });

    // Espera al CIERRE, atendiendo alertas (la del remanente incluida).
    let aviso = null, cerrado = false;
    for (let i = 0; i < 8; i++) {
      await pg.waitForTimeout(900);
      const al = await readAlert();
      if (al) { aviso = aviso || al; await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); continue; }
      cerrado = await pg.evaluate(() =>
        ![...document.querySelectorAll('ion-modal.collectDiscounts')]
          .some(m => m.getBoundingClientRect().width > 0));
      if (cerrado) break;
    }
    // Último recurso: el clic real se perdió ⇒ una sola activación por DOM.
    if (!cerrado) {
      await pg.evaluate(() => {
        const m = [...document.querySelectorAll('ion-modal.collectDiscounts')]
          .find(x => x.getBoundingClientRect().width > 0);
        const b = m && [...m.querySelectorAll('ion-button')]
          .filter(x => !x.hasAttribute('disabled'))
          .find(x => /aceptar/i.test((x.textContent || '').trim()));
        if (b) ((b.shadowRoot && b.shadowRoot.querySelector('button')) || b).click();
      });
      for (let i = 0; i < 6; i++) {
        await pg.waitForTimeout(900);
        const al = await readAlert();
        if (al) { aviso = aviso || al; await clickAlertBtn(['Aceptar', 'OK', 'Sí']).catch(() => {}); continue; }
        cerrado = await pg.evaluate(() =>
          ![...document.querySelectorAll('ion-modal.collectDiscounts')]
            .some(m => m.getBoundingClientRect().width > 0));
        if (cerrado) break;
      }
    }
    return { ok: cerrado, aviso, tapado: c.tapado,
             motivo: cerrado ? undefined : 'el modal de descuentos no cerró tras pulsar Aceptar' };
  }

  /**
   * Cierra el DETALLE del documento por GUARDAR.
   *
   * 🔴 No da igual el botón. El pie del detalle es
   *      Cancelar → saveDocumentSale(false)   ·   Guardar → saveDocumentSale(true)
   *    (cobro-documents.component.html, pie del #eventModal). Salir por Cancelar
   *    DESCARTA lo que se hizo dentro — que es justo lo que quieren los casos
   *    048-052, y justo lo que NO quiere el flujo que aplica el descuento.
   */
  /**
   * 🔴 DOS TRAMPAS, las dos medidas en 4K el 14/09:
   *
   * 1. **`.botonAddVerde` NO identifica a «Guardar».** En el detalle del
   *    documento hay DOS botones con esa clase: «Asignar descuento» y
   *    «Guardar» — y «Guardar» nace **deshabilitado**. El filtro anterior
   *    («el último .botonAddVerde visible y no deshabilitado») elegía
   *    entonces **«Asignar descuento»**: abría el modal de descuentos en vez
   *    de guardar, y el caso moría tres pasos después sin decir por qué.
   *    Ahora se busca por TEXTO.
   *
   * 2. **El teclado mueve el botón.** Tras teclear en «Monto a pagar», el
   *    Guardar medido estaba en y≈430 y el real en y≈709: el clic caía en el
   *    vacío, no fallaba, y el pago parcial simplemente no se aplicaba. Por eso
   *    va `blur()` + espera ANTES de medir, y las coordenadas se toman en la
   *    misma evaluación que precede al clic.
   */
  async function cerrarDetalleGuardando() {
    await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await pg.waitForTimeout(700);
    const c = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return { err: 'el detalle ya no está abierto' };
      const btn = [...modal.querySelectorAll('ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0 && !b.hasAttribute('disabled'))
        .find(b => /^guardar$/i.test((b.textContent || '').trim()));
      if (!btn) {
        return { err: 'Guardar ausente o deshabilitado',
                 botones: [...modal.querySelectorAll('ion-button')]
                   .map(b => (b.textContent || '').trim() + (b.hasAttribute('disabled') ? '(dis)' : '')) };
      }
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      // Verificar oclusión, no presencia: el clic tiene que llegar al botón.
      const enPunto = document.elementFromPoint(x, y);
      return { x, y, tapado: !(enPunto && (enPunto === btn || btn.contains(enPunto) ||
                                           enPunto.closest('ion-button') === btn)) };
    });
    if (c.err) return { ok: false, motivo: c.err + (c.botones ? ` · botones: ${c.botones.join(' | ')}` : '') };
    await pg.mouse.click(c.x, c.y, { delay: 110 });
    await pg.waitForTimeout(2000);
    const al = await readAlert();
    if (al) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
    const cerrado = await pg.evaluate(() =>
      ![...document.querySelectorAll('ion-modal')].some(m => m.getBoundingClientRect().width > 0));
    return { ok: cerrado, tapado: c.tapado,
             motivo: cerrado ? '' : 'el detalle no se cerró tras pulsar Guardar' };
  }

  /** Cierra el modal de descuentos con Cancelar y luego el detalle del documento. */
  async function cerrarDescuentosSinAplicar() {
    for (const rotulo of [/cancelar/i, /cerrar|cancelar/i]) {
      const c = await pg.evaluate((re) => {
        const rx = new RegExp(re.source, re.flags);
        const modal = [...document.querySelectorAll('ion-modal')]
          .filter(m => m.getBoundingClientRect().width > 0).pop();
        if (!modal) return null;
        const btn = [...modal.querySelectorAll('ion-button')]
          .filter(b => b.getBoundingClientRect().width > 0)
          .find(b => rx.test((b.textContent || '').trim()));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, { source: rotulo.source, flags: rotulo.flags });
      if (c) { await pg.mouse.click(c.x, c.y, { delay: 80 }); await pg.waitForTimeout(1200); }
    }
    await pg.waitForTimeout(600);
  }
  /** «Atrás» con cambios y salir GUARDANDO (DM-COB-038, no DM-COB-021). */
  async function salirGuardando() {
    await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await pg.waitForTimeout(500);
    await clickBack();
    await pg.waitForTimeout(1800);
    const texto = await readAlert();
    const c = await pg.evaluate(() => {
      const al = [...document.querySelectorAll('ion-alert')].filter(a =>
        [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0)).pop();
      if (!al) return { err: 'no salió el modal de salida' };
      const btns = [...al.querySelectorAll('.alert-button')].filter(b => b.getBoundingClientRect().width > 0);
      // El de GUARDAR, jamás el de «Salir sin guardar».
      const btn = btns.find(b => /guardar/i.test(b.textContent) && !/sin\s+guardar/i.test(b.textContent));
      if (!btn) return { err: 'el modal no ofrece «Guardar y salir»', botones: btns.map(b => b.textContent.trim()) };
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      // 🔴 El primer clic sobre el botón de una ion-alert puede caer en el ION-BACKDROP.
      const en = document.elementFromPoint(x, y);
      return { x, y, label: btn.textContent.trim(),
               backdrop: !!(en && /ION-BACKDROP/i.test(en.tagName)) };
    });
    if (c.err) return { ok: false, motivo: c.err + (c.botones ? ` · ofrece: ${c.botones.join(' | ')}` : ''), texto };
    await pg.mouse.click(c.x, c.y, { delay: 110 });
    await pg.waitForTimeout(2000);
    // Si el primero se lo comió el backdrop, la alerta sigue ahí: se reintenta.
    const sigue = await pg.evaluate(() =>
      [...document.querySelectorAll('ion-alert')].some(a =>
        [...a.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0)));
    if (sigue) { await clickAlertBtn([c.label]).catch(() => {}); await pg.waitForTimeout(1500); }
    const cierre = await readAlert();
    if (cierre) await clickAlertBtn(['Aceptar', 'OK']).catch(() => {});
    await pg.waitForTimeout(1200);
    const enHome = await isHomeCobrosVisible().catch(() => false);
    return { ok: true, label: c.label, backdrop: c.backdrop, texto, cierre, enHome };
  }

  /** Elimina el primer Guardado de la lista. Devuelve {ok, antes, despues}. */
  async function eliminarPrimerGuardado() {
    const lista = await abrirListaCobros();
    const antes = lista.guardados;
    if (!antes) return { ok: false, motivo: 'no hay ningún cobro Guardado en la lista', antes };
    const trash = await pg.evaluate(() => {
      const btns = [...document.querySelectorAll('app-cobros-list ion-button')]
        .filter(b => b.getBoundingClientRect().width > 0 &&
          (b.querySelector('ion-icon[name="trash"]') || /danger/.test(b.getAttribute('color') || '')));
      if (!btns.length) return null;
      const r = btns[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (!trash) return { ok: false, motivo: 'sin botón de eliminar en la lista', antes };
    await pg.mouse.click(trash.x, trash.y, { delay: 80 });
    await clickAlertBtn(['Eliminar', 'Aceptar', 'Sí', 'OK']).catch(() => {});
    await pg.waitForTimeout(2200);
    const despues = (await abrirListaCobros()).guardados;
    return { ok: despues < antes, antes, despues };
  }

  /** Deja el formulario abandonado y vuelve al home del módulo, pase lo que pase. */
  async function abandonarCobro() {
    for (let i = 0; i < 6; i++) {
      if (await isHomeCobrosVisible().catch(() => false)) return true;
      // Un modal abierto bloquea todos los clics: se sale por CANCELAR, nunca
      // con «atrás» (eso lo deja huérfano y tumba la pantalla entera).
      const cerrado = await pg.evaluate(() => {
        const m = [...document.querySelectorAll('ion-modal')].filter(x => x.getBoundingClientRect().width > 0).pop();
        if (!m) return false;
        const b = [...m.querySelectorAll('ion-button')].filter(x => x.getBoundingClientRect().width > 0)
          .find(x => /cancelar|cerrar/i.test((x.textContent || '').trim()));
        if (b) { b.click(); return true; }
        if (m.dismiss) { m.dismiss(); return true; }
        return false;
      });
      if (cerrado) { await pg.waitForTimeout(1300); continue; }
      try { await clickBack(); } catch (_) {}
      await pg.waitForTimeout(1200);
      await dismissDirtyGuard();
      await pg.waitForTimeout(800);
    }
    return isHomeCobrosVisible().catch(() => false);
  }

  /**
   * Arranca un cobro NUEVO, lo deja con el primer documento marcado y devuelve
   * el total a pagar leído del sticky de Pagos.
   *
   * @param {string|string[]} quien  un código, o una LISTA por la que rotar
   *        hasta dar con uno que liste documentos de verdad.
   */
  async function abrirCobroConDocumento(quien, comentario, maxPruebas = 10) {
    const lista = (Array.isArray(quien) ? quien : [quien]).filter(Boolean);
    const intentados = [];
    // ⚠ Tope de intentos REALES (los que tocan la UI). Sin él, una lista larga
    //   con la cartera agotada puede irse a ~15 s × 24 clientes por sub-flujo y
    //   convertir la corrida de cobros en media hora. Los ya conocidos como
    //   vacíos se saltan sin tocar la pantalla, así que no cuentan.
    let pruebas = 0;
    for (const cliente of lista) {
      if (clientesSinDocs.has(cliente)) { intentados.push(`${cliente}→(agotado antes)`); continue; }
      if (pruebas >= maxPruebas) { intentados.push(`…(corte tras ${maxPruebas} intentos reales)`); break; }
      pruebas++;
      await abandonarCobro();
      // 🔴 Un intento no basta. El 14/09, DM-COB-026 murió con «no abrió el
      //    formulario de cobro»: el tile respondió pero las 5 pestañas no
      //    llegaron en 8 s porque la pantalla anterior aún estaba replegándose.
      //    No es que la app no abra: es que se le pidió demasiado pronto.
      let abrio = await abrirNuevoCobro();
      if (!abrio) {
        await irAHomeCobros().catch(() => {});
        await pg.waitForTimeout(1500);
        abrio = await abrirNuevoCobro();
      }
      if (!abrio) { intentados.push(`${cliente}→el formulario no abrió (2 intentos)`); continue; }
      try {
        await seleccionarCliente(cliente);
      } catch (e) {
        intentados.push(`${cliente}→${e.message.slice(0, 60)}`);
        continue;
      }
      if (DATA.requiredComment) await fillComentario(comentario);
      let h = 0;
      for (let i = 0; i < 8; i++) { h = await tabsHabilitadas(); if (h >= 4) break; await pg.waitForTimeout(700); }
      if (h < 4) { intentados.push(`${cliente}→pestañas ${h}/5`); continue; }
      await clickTab('documentos');
      const carga = await cargarDocumentos();
      if (!carga.cbs) { clientesSinDocs.add(cliente); intentados.push(`${cliente}→0 docs`); continue; }
      if (!(await marcarPrimerDocumento()).ok) { intentados.push(`${cliente}→no se marcó`); continue; }
      await clickTab('pagos');
      await pg.waitForTimeout(1200);
      const sticky = await leerPagosSticky();
      return { ok: true, cliente, docs: carga.cbs, total: sticky.total,
               saldo: montoANumero(sticky.total), intentados };
    }
    return { ok: false,
      motivo: `ningún cliente del relevo lista documentos · recorrido: ${intentados.join(' | ') || '(lista vacía)'} · ` +
              `🔑 cada cobro ENVIADO deja su factura «Por aprobar» y la saca del Tab Documentos: ` +
              `rechazar cobros pendientes en la web devuelve documentos al pool` };
  }

  async function escribirEnModal(re, digitos) {
    const r = await pg.evaluate((a) => {
      const rx = new RegExp(a.s, a.f);
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return { ok: false, err: 'no hay modal abierto' };
      const rot = (e) => String(e.getAttribute('label') || e.label || '').trim() ||
        ((e.closest('ion-col, ion-row, ion-item') || {}).innerText || '').replace(/\s+/g, ' ').trim();
      const cands = [...modal.querySelectorAll('ion-input')].filter(i => i.getBoundingClientRect().width > 0);
      const el = cands.find(i => rx.test(rot(i)));
      if (!el) return { ok: false, err: 'campo no hallado', rotulos: cands.map(i => rot(i).slice(0, 35)) };
      const n = el.querySelector('input') || (el.shadowRoot && el.shadowRoot.querySelector('input'));
      if (!n) return { ok: false, err: 'sin input nativo' };
      if (n.disabled || n.readOnly) return { ok: false, err: 'el campo está bloqueado (readOnly/disabled)' };
      n.focus();
      window.__qaModalIn = { el, n };
      return { ok: true, antes: n.value };
    }, { s: re.source, f: re.flags });
    if (!r.ok) return r;
    for (let i = 0; i < 20; i++) await pg.keyboard.press('Backspace');
    await pg.keyboard.type(String(digitos), { delay: 50 });
    await pg.evaluate(() => {
      const q = window.__qaModalIn; if (!q) return;
      const { el, n } = q;
      try { el.value = n.value; } catch (_) {}
      ['input', 'keyup', 'change'].forEach(t => n.dispatchEvent(new Event(t, { bubbles: true })));
      el.dispatchEvent(new CustomEvent('ionInput',  { bubbles: true, detail: { value: n.value } }));
      el.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: n.value } }));
      n.dispatchEvent(new Event('blur', { bubbles: true }));
      el.dispatchEvent(new CustomEvent('ionBlur', { bubbles: true }));
    });
    await pg.waitForTimeout(1100);
    const despues = await pg.evaluate(() => {
      const q = window.__qaModalIn; return q && q.n ? q.n.value : null;
    });
    return { ok: true, antes: r.antes, despues };
  }

  /** Foto de los campos del detalle del documento (rótulo → valor/estado). */
  async function fotoDetalle() {
    return pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return { err: 'el detalle no está abierto', campos: {} };
      const rot = (e) => String(e.getAttribute('label') || e.label || '').trim() ||
        ((e.closest('ion-col, ion-row, ion-item') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50);
      const campos = {};
      for (const i of [...modal.querySelectorAll('ion-input')].filter(x => x.getBoundingClientRect().width > 0)) {
        const n = i.querySelector('input') || (i.shadowRoot && i.shadowRoot.querySelector('input'));
        campos[rot(i)] = { val: n ? n.value : null, ro: !!(n && n.readOnly), dis: !!(n && n.disabled) };
      }
      const lab = [...modal.querySelectorAll('ion-label')].find(l => /pago\s*parcial/i.test(l.textContent || ''));
      const fila = lab && lab.closest('ion-row');
      const tog = (fila && fila.querySelector('ion-toggle')) || modal.querySelector('ion-toggle');
      return {
        campos,
        toggleParcial: tog
          ? { existe: true, encendido: tog.checked === true, deshabilitado: tog.disabled === true }
          : { existe: false },
        botones: [...modal.querySelectorAll('ion-button')]
          .filter(b => b.getBoundingClientRect().width > 0)
          .map(b => ({ t: (b.textContent || '').trim(), dis: b.hasAttribute('disabled') })),
      };
    });
  }

  /**
   * Enciende/apaga el toggle «Pago parcial».
   *
   * ⚠ Dos precisiones que costaron una vuelta:
   *   · el toggle mide 36×14 px y su mitad izquierda es zona de label ⇒ se pega
   *     en el EXTREMO DERECHO;
   *   · el rect se mide JUSTO antes del clic. Un `scrollIntoView` previo sobre
   *     otro campo ya había movido el toggle de y≈594 a y≈322, y el clic caía
   *     en el vacío sin dar error.
   */
  async function togglePagoParcial() {
    await pg.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await pg.waitForTimeout(500);
    const c = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return { err: 'el detalle no está abierto' };
      const lab = [...modal.querySelectorAll('ion-label')].find(l => /pago\s*parcial/i.test(l.textContent || ''));
      const fila = lab && lab.closest('ion-row');
      const tog = (fila && fila.querySelector('ion-toggle')) || modal.querySelector('ion-toggle');
      if (!tog) return { err: 'no existe el toggle «Pago parcial» en el detalle' };
      if (tog.disabled) return { err: 'el toggle «Pago parcial» está deshabilitado' };
      const r = tog.getBoundingClientRect();
      const x = r.left + r.width - 8, y = r.top + r.height / 2;
      const en = document.elementFromPoint(x, y);
      return { x, y, antes: tog.checked === true, en: en ? en.tagName : null };
    });
    if (c.err) return c;
    await pg.mouse.click(c.x, c.y, { delay: 100 });
    await pg.waitForTimeout(1500);
    const despues = await pg.evaluate(() => {
      const modal = [...document.querySelectorAll('ion-modal')]
        .filter(m => m.getBoundingClientRect().width > 0).pop();
      if (!modal) return null;
      const lab = [...modal.querySelectorAll('ion-label')].find(l => /pago\s*parcial/i.test(l.textContent || ''));
      const fila = lab && lab.closest('ion-row');
      const tog = (fila && fila.querySelector('ion-toggle')) || modal.querySelector('ion-toggle');
      return tog ? tog.checked === true : null;
    });
    return { ok: despues !== c.antes, antes: c.antes, despues };
  }


  return { escribirEnModal, fotoDetalle, togglePagoParcial, dismissIonLoadings, clickBack, clickAlertBtn, readAlert, dismissDirtyGuard,
    clickBotonHome, isHomeCobrosVisible, irAHomeCobros, isFormVisible, clickTab,
    abrirNuevoCobro, seleccionarCliente, fillComentario, tabsHabilitadas, fotoDelCobro,
    seleccionarMonedaDocumento, contarDocumentos, cargarDocumentos, marcarPrimerDocumento,
    huellaPantalla, esperarReaccion, clickGuardarEnviar, leerPagosSticky, montoANumero, verificarNube,
    abrirListaCobros, reabrirGuardado, agregarPagoEfectivo,
    abrirDetalleDocumento, abrirModalDescuentos, leerModalDescuentos, toggleDescuento,
    reiniciarDescuentos, aceptarDescuentos, cerrarDetalleGuardando, cerrarDescuentosSinAplicar,
    salirGuardando, eliminarPrimerGuardado, abandonarCobro, abrirCobroConDocumento,
    clientesSinDocs };
};
