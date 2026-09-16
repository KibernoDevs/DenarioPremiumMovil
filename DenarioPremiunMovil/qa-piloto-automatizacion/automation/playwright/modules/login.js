'use strict';

const { execSync } = require('child_process');
const { fetchCreds } = require('../../cdp/denario-cdp-helpers');
const { conectar } = require('../connect');

/**
 * Re-forward ADB al PID activo del WebView y reconecta CDP.
 * No espera — asume que el WebView ya está vivo.
 * Usar cuando la conexión puede ser zombi (ADB forward a PID obsoleto).
 */
async function refreshCDP() {
  try {
    const unix = execSync('adb shell cat /proc/net/unix', { timeout: 8000, encoding: 'utf8' });
    const pids = [...unix.matchAll(/webview_devtools_remote_(\d+)/g)].map(m => m[1]);
    if (pids.length) {
      const pid = pids[pids.length - 1];
      try { execSync('adb forward --remove tcp:9220', { timeout: 3000 }); } catch (_) {}
      execSync(`adb forward tcp:9220 localabstract:webview_devtools_remote_${pid}`, { timeout: 3000 });
      await new Promise(r => setTimeout(r, 400));
    }
  } catch (_) {}
  return await conectar();
}

/**
 * Reconecta CDP tras un logout que mata el WebView.
 * 1. Espera reinicio del WebView (~3.5s)
 * 2. Intenta conectar con el forward actual (si solo hubo reload)
 * 3. Si falla, re-forward ADB al nuevo PID y reintenta
 */
async function reconectarCDP() {
  // Esperar reinicio del WebView tras logout
  await new Promise(r => setTimeout(r, 3500));
  // Siempre re-forward al nuevo PID (--remove es seguro: el WebView anterior ya murió)
  try {
    const unix = execSync('adb shell cat /proc/net/unix', { timeout: 8000, encoding: 'utf8' });
    const pids = [...unix.matchAll(/webview_devtools_remote_(\d+)/g)].map(m => m[1]);
    if (pids.length) {
      const pid = pids[pids.length - 1];
      try { execSync('adb forward --remove tcp:9220', { timeout: 3000 }); } catch (_) {}
      execSync(`adb forward tcp:9220 localabstract:webview_devtools_remote_${pid}`, { timeout: 3000 });
      await new Promise(r => setTimeout(r, 600));
    }
  } catch (_) {}
  return await conectar({ retries: 3 });
}

/**
 * modules/login.js — 9 casos smoke
 * Precondición: app en HOME (ya logueado). El módulo hace logout, ejecuta los casos
 * y termina en HOME (credenciales correctas → login completado al final).
 * Devuelve { verdicts, msTotal, newPg } — newPg es el page CDP activo al final
 * (puede ser distinto al pg original si el WebView se reinició tras el logout).
 */
async function runLogin(pg, DATA) {
  const t0 = Date.now();
  const verdicts = [];

  function v(id, desc, resultado, nota = '') {
    verdicts.push({ id, descripcion: desc, resultado, nota, ms: Date.now() - t0 });
  }

  // N/A estructurales
  v('DM-LOG-008', 'Segundo usuario en pantalla login', 'N/A', 'has_second_user no configurado en perfil');
  v('DM-LOG-009', 'Login como segundo usuario', 'N/A', 'depende de DM-LOG-008 → N/A');
  v('DM-LOG-017', 'Login post-reinstalación', 'N/A', 'fuera de alcance smoke — requiere reinstalación');

  // Validar que la conexión CDP sea usable antes de proceder
  // (no hacer adb forward --remove aquí — mataría la sesión activa del WebView)
  try {
    await pg.evaluate(() => true);
  } catch (_) {
    // Conexión zombi: reconectar re-forwardeando ADB SIN remover el forward activo
    try {
      const unix = execSync('adb shell cat /proc/net/unix', { timeout: 8000, encoding: 'utf8' });
      const pids = [...unix.matchAll(/webview_devtools_remote_(\d+)/g)].map(m => m[1]);
      if (pids.length) {
        const pid = pids[pids.length - 1];
        execSync(`adb forward tcp:9220 localabstract:webview_devtools_remote_${pid}`, { timeout: 3000 });
        await new Promise(r => setTimeout(r, 400));
      }
      pg = await conectar();
    } catch (e2) {
      ['DM-LOG-002','DM-LOG-003','DM-LOG-004','DM-LOG-001','DM-LOG-011','DM-LOG-012'].forEach(id =>
        v(id, id, 'BLOCKED', 'CDP no disponible al inicio: ' + e2.message));
      return { verdicts, msTotal: Date.now() - t0, newPg: pg };
    }
  }

  // ─── Helpers (cierran sobre `pg` — si pg se reasigna, usan el nuevo) ─────────

  async function getAlert() {
    await pg.waitForTimeout(1200);
    return pg.evaluate(() => {
      const a = [...document.querySelectorAll('ion-alert')].find(x => {
        const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
        const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!a) return null;
      const msg = a.querySelector('.alert-message') || a.querySelector('.alert-title');
      return msg ? msg.textContent.trim() : (a.textContent.trim().slice(0, 120));
    });
  }

  async function dismissAlert() {
    const coords = await pg.evaluate(() => {
      const a = [...document.querySelectorAll('ion-alert')].find(x => {
        const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
        const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!a) return null;
      const btn = [...a.querySelectorAll('.alert-button')].find(b => b.getBoundingClientRect().width > 0);
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (coords) await pg.mouse.click(coords.x, coords.y);
    await pg.waitForTimeout(500);
  }

  // ─── Alerta de CAMBIO DE USUARIO ────────────────────────────────────────────
  // Al teclear un usuario distinto al último que entró, la app avisa ANTES de
  // validar nada contra el servidor:
  //   «Está intentando sincronizar con un usuario que es diferente al previamente
  //    ingresado, de aceptar la sincronización todos los datos anteriores serán
  //    borrados. ¿Está de acuerdo?»            [Cancelar] [Aceptar]
  //
  // 🔴 16/09 — esta alerta tumbó la barrida completa (158 BLOCKED). Dos causas,
  //    las DOS de guion, ninguna del producto:
  //      1. DM-LOG-001 buscaba la alerta SIN ESPERAR: `clickSubmit()` y acto
  //         seguido el `evaluate`. La alerta tarda ~1 s en pintarse ⇒ devolvía
  //         null, no se pulsaba nada y la app se quedaba en /login para siempre.
  //      2. El primer clic sobre el botón puede caer en el ION-BACKDROP.
  //    Se despacha con espera + verificación por `elementFromPoint`.
  const RE_CAMBIO_USUARIO = /diferente al previamente|ser[áa]n borrados|est[áa] de acuerdo/i;

  /** Lee la alerta visible → { texto, botones[] } · null si no hay. */
  function leerAlerta() {
    return pg.evaluate(() => {
      const a = [...document.querySelectorAll('ion-alert')].find(x => {
        const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
        const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!a) return null;
      const msg = a.querySelector('.alert-message') || a.querySelector('.alert-title');
      return {
        texto: msg ? msg.textContent.trim() : a.textContent.trim().slice(0, 200),
        botones: [...a.querySelectorAll('.alert-button')]
          .filter(b => b.getBoundingClientRect().width > 0)
          .map(b => b.textContent.trim()),
      };
    }).catch(() => null);
  }

  /** Espera hasta `ms` a que aparezca una alerta. Devuelve la alerta o null. */
  async function esperarAlerta(ms = 8000) {
    const fin = Date.now() + ms;
    for (;;) {
      const a = await leerAlerta();
      if (a) return a;
      if (Date.now() >= fin) return null;
      await pg.waitForTimeout(300).catch(() => {});
    }
  }

  /**
   * Pulsa el botón de la alerta cuya etiqueta case con `preferidas` (en orden).
   * Comprueba con `elementFromPoint` que el punto no lo tape el ION-BACKDROP y,
   * si lo tapa, reintenta desplazado dentro del propio botón.
   * El éxito se mide por que la alerta DESAPAREZCA, no por haber hecho clic.
   * @returns {Promise<string|null>} etiqueta pulsada, o null si no se pudo.
   */
  async function pulsarBotonAlerta(preferidas) {
    for (let intento = 0; intento < 3; intento++) {
      const obj = await pg.evaluate((prefs) => {
        const a = [...document.querySelectorAll('ion-alert')].find(x => {
          const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
          const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
          return isTraditional || hasVisibleBtn;
        });
        if (!a) return null;
        const btns = [...a.querySelectorAll('.alert-button')].filter(b => b.getBoundingClientRect().width > 0);
        if (!btns.length) return null;
        let btn = null;
        for (const p of prefs) {
          btn = btns.find(b => b.textContent.trim().toLowerCase() === p) ||
                btns.find(b => b.textContent.trim().toLowerCase().includes(p));
          if (btn) break;
        }
        if (!btn) return null;
        const r   = btn.getBoundingClientRect();
        const x   = r.left + r.width / 2;
        const y   = r.top  + r.height / 2;
        const top = document.elementFromPoint(x, y);
        return {
          x, y, alto: r.height,
          label: btn.textContent.trim(),
          // Tapado = lo que hay en el punto no es el botón ni está dentro de él
          tapado: !!(top && top !== btn && !btn.contains(top)),
          tapadoPor: top ? top.tagName : null,
        };
      }, preferidas).catch(() => null);

      if (!obj) return null;
      const dy = obj.tapado ? -Math.max(4, Math.round(obj.alto / 4)) : 0;
      await pg.mouse.click(obj.x, obj.y + dy).catch(() => {});
      await pg.waitForTimeout(700).catch(() => {});
      if (!(await leerAlerta())) return obj.label;   // se cerró ⇒ el clic entró de verdad
    }
    return null;
  }

  /**
   * Si la alerta que hay en pantalla es la de CAMBIO DE USUARIO, la despacha
   * ACEPTANDO: la app borra la base local y resincroniza con el vendedor tecleado.
   * @returns {Promise<{hubo:boolean, aceptada?:boolean, label?:string, texto?:string, botones?:string[], otra?:object}>}
   */
  async function despacharCambioUsuario(ms = 8000) {
    const a = await esperarAlerta(ms);
    if (!a) return { hubo: false };
    if (!RE_CAMBIO_USUARIO.test(a.texto)) return { hubo: false, otra: a };
    const label = await pulsarBotonAlerta(['aceptar', 'sí', 'si', 'continuar', 'ok']);
    return { hubo: true, aceptada: !!label, label, texto: a.texto, botones: a.botones };
  }

  /** Llena el nth ion-input visible con native value setter (patrón fillIonInput) */
  async function fillField(nth, value) {
    await pg.evaluate(([n, val]) => {
      const inputs = [...document.querySelectorAll('ion-input')]
        .filter(i => i.getBoundingClientRect().width > 0);
      const ionEl = inputs[n];
      if (!ionEl) return;
      const inp = ionEl.querySelector('input') ||
                  (ionEl.shadowRoot && ionEl.shadowRoot.querySelector('input')) ||
                  ionEl;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(inp, val);
      inp.dispatchEvent(new Event('input',  { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      ionEl.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: val } }));
      ionEl.dispatchEvent(new CustomEvent('ionInput',  { bubbles: true, detail: { value: val } }));
    }, [nth, value]);
  }

  async function clearAllFields() {
    await pg.evaluate(() => {
      document.querySelectorAll('ion-input').forEach(ion => {
        const inp = ion.querySelector('input') || (ion.shadowRoot && ion.shadowRoot.querySelector('input'));
        if (!inp) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(inp, '');
        inp.dispatchEvent(new Event('input',  { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        ion.dispatchEvent(new CustomEvent('ionChange', { bubbles: true, detail: { value: '' } }));
        ion.dispatchEvent(new CustomEvent('ionInput',  { bubbles: true, detail: { value: '' } }));
      });
    });
    await pg.waitForTimeout(300);
  }

  async function clickSubmit() {
    const found = await pg.evaluate(() => {
      // Acotar búsqueda a app-login para no tocar ion-back-button del toolbar
      const scope = document.querySelector('app-login') || document.body;
      const btns = [...scope.querySelectorAll('ion-button, button')]
        .filter(b => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      const loginBtn = btns.find(b => {
        const t = b.textContent.trim().toUpperCase();
        return t.includes('ENTRAR') || t.includes('INICIAR') || t.includes('INGRESAR') ||
               t.includes('LOGIN')  || t.includes('ACCEDER') || t.includes('ACCESAR') ||
               t.includes('CONECTAR') || t.includes('ACEPTAR');
      }) || btns[btns.length - 1];
      if (!loginBtn) return false;
      loginBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    });
    if (!found) throw new Error('Botón submit no encontrado en form login');
  }

  function isAtLogin() {
    return pg.evaluate(() => {
      const loginEl = document.querySelector('app-login');
      const homeEl  = document.querySelector('app-home');
      // Caso claro: componente login visible
      if (loginEl && !loginEl.classList.contains('ion-page-hidden')) return true;
      // Caso claro: home visible → no estamos en login
      if (homeEl && !homeEl.classList.contains('ion-page-hidden')) return false;
      // Estado ambiguo (ion-page-hidden en transición Ionic): verificar por inputs de credenciales
      const visibles = [...document.querySelectorAll('ion-input')]
        .filter(i => i.getBoundingClientRect().width > 0);
      return visibles.length >= 2;
    });
  }

  function isAtHome() {
    return pg.evaluate(() => {
      const el = document.querySelector('app-home');
      return !!(el && !el.classList.contains('ion-page-hidden'));
    });
  }

  // ─── Bootstrap: si la app está en login, iniciar sesión para llegar a HOME ──────
  // El módulo presupone HOME como punto de partida. Si llegamos en login (estado
  // degradado de corridas anteriores), hay que hacer login primero.

  if (await isAtLogin().catch(() => false)) {
    // El ADB forward puede apuntar al WebView anterior (muerto por logout previo).
    // Re-forward al PID activo SIN --remove (para no desconectar al WebView vivo)
    // y reconectar CDP antes de interactuar con el formulario.
    try {
      const unix = execSync('adb shell cat /proc/net/unix', { timeout: 8000, encoding: 'utf8' });
      const pids = [...unix.matchAll(/webview_devtools_remote_(\d+)/g)].map(m => m[1]);
      if (pids.length) {
        const pid = pids[pids.length - 1];
        execSync(`adb forward tcp:9220 localabstract:webview_devtools_remote_${pid}`, { timeout: 3000 });
        await new Promise(r => setTimeout(r, 400));
        pg = await conectar();
      }
    } catch (_) {}

    let bc;
    try { bc = await fetchCreds(DATA.clienteSlug); } catch (_) {}
    if (bc) {
      await clearAllFields().catch(() => {});
      await fillField(0, bc.user).catch(() => {});
      await fillField(1, bc.pass).catch(() => {});
      await clickSubmit().catch(() => {});
      // Confirmar alert si aparece (sesión activa en otro dispositivo, etc.)
      await pg.waitForTimeout(1000).catch(() => {});
      await dismissAlert().catch(() => {});
      // Esperar HOME con sync (máx 70 s)
      for (let i = 0; i < 70; i++) {
        if (await isAtHome().catch(() => false)) break;
        await pg.waitForTimeout(1000).catch(() => {});
      }
      // Si el WebView se reinició durante la sync, reconectar
      try { await pg.evaluate(() => true); } catch (_) {
        try { pg = await reconectarCDP(); } catch (_2) {}
      }
    }
    if (!await isAtHome().catch(() => false)) {
      ['DM-LOG-002','DM-LOG-003','DM-LOG-004','DM-LOG-001','DM-LOG-011','DM-LOG-012'].forEach(id =>
        v(id, id, 'BLOCKED', 'Bootstrap login falló — no se pudo llegar a HOME para iniciar el módulo'));
      return { verdicts, msTotal: Date.now() - t0, newPg: pg };
    }
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  let loginScreen = await isAtLogin();

  if (!loginScreen) {
    let logoutClicked = false;

    /** Dispatch click programático sobre un elemento (no usa pg.mouse.click) */
    function dispatchClick(el) {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    // Estrategia 1: buscar "Cerrar sesión" directamente visible en HOME
    try {
      const found = await pg.evaluate(() => {
        const el = [...document.querySelectorAll('ion-button, button, ion-item, a, span, p')].find(e => {
          const t = e.textContent.trim().toLowerCase();
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.top >= 0 && r.top <= window.innerHeight
            && (t === 'cerrar sesión' || t === 'cerrar sesion' || t === 'logout' || t === 'salir');
        });
        if (!el) return false;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
      });
      if (found) {
        logoutClicked = true;
        try { await pg.waitForTimeout(1500); } catch (_) {}
      }
    } catch (_) {}

    if (!logoutClicked) {
      // Estrategia 2: tile SINCRONIZAR (app-home a.ion-text-center) → screen sync → logout
      try {
        const syncClicked = await pg.evaluate(() => {
          // Buscar tile por p.nombreModulos o por textContent
          const tile = [...document.querySelectorAll('app-home a.ion-text-center, app-home a[href], app-home ion-card, app-home .tile')]
            .filter(t => t.getBoundingClientRect().width > 0)
            .find(t => {
              const p = t.querySelector('p.nombreModulos, p');
              const text = (p ? p.textContent : t.textContent).trim().toUpperCase();
              return text.includes('SINCRONIZAR') || text.includes('SINCRONIZACION') || text.includes('SYNC');
            });
          if (!tile) return false;
          tile.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return true;
        });

        if (syncClicked) {
          await pg.waitForTimeout(1800);

          const logoutFound = await pg.evaluate(() => {
            const el = [...document.querySelectorAll('ion-button, button, ion-item, a, ion-list-header')].find(e => {
              const t = e.textContent.trim().toLowerCase();
              const r = e.getBoundingClientRect();
              return r.width > 0 && (t.includes('cerrar') || t.includes('logout') || t.includes('salir') || t.includes('desconectar'));
            });
            if (!el) return false;
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return true;
          });

          if (logoutFound) {
            logoutClicked = true;
            try { await pg.waitForTimeout(1500); } catch (_) {}
          }
        }
      } catch (_) {}
    }

    if (!logoutClicked) {
      // Estrategia 3: botón de menú en header → buscar logout en popup/menu resultante
      try {
        const headerClicked = await pg.evaluate(() => {
          const btns = [...document.querySelectorAll('ion-header ion-button, ion-toolbar ion-button, ion-toolbar button')]
            .filter(b => b.getBoundingClientRect().width > 0);
          if (!btns.length) return false;
          // El más a la derecha suele ser el menú de usuario
          btns.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
          btns[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return true;
        });
        if (headerClicked) {
          await pg.waitForTimeout(800);
          const menuFound = await pg.evaluate(() => {
            const el = [...document.querySelectorAll('ion-button, button, ion-item, a')].find(e => {
              const t = e.textContent.trim().toLowerCase();
              const r = e.getBoundingClientRect();
              return r.width > 0 && (t.includes('cerrar') || t.includes('logout') || t.includes('salir') || t.includes('desconectar'));
            });
            if (!el) return false;
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return true;
          });
          if (menuFound) {
            logoutClicked = true;
            try { await pg.waitForTimeout(1500); } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // Post-logout: el WebView puede haberse reiniciado → CDP muerto
    let cdpMuerto = false;
    try {
      await dismissAlert().catch(() => {});
      await pg.waitForTimeout(800);
      loginScreen = await isAtLogin();
    } catch (e) {
      cdpMuerto = true;
    }

    if (cdpMuerto || (logoutClicked && !loginScreen)) {
      // Reconectar CDP: logout reinicia el WebView
      try {
        pg = await reconectarCDP();
        loginScreen = await isAtLogin().catch(() => false);
      } catch (e) {
        ['DM-LOG-002','DM-LOG-003','DM-LOG-004','DM-LOG-001','DM-LOG-011','DM-LOG-012'].forEach(id =>
          v(id, id, 'BLOCKED', 'Reconexión CDP falló tras logout: ' + e.message));
        return { verdicts, msTotal: Date.now() - t0, newPg: pg };
      }
    }

    if (!loginScreen) {
      // Debug: volcar elementos interactivos visibles para diagnosticar dónde estamos
      const domSnapshot = await pg.evaluate(() => {
        const btns = [...document.querySelectorAll('ion-button, button, ion-item, a')]
          .filter(e => e.getBoundingClientRect().width > 0)
          .slice(0, 15)
          .map(e => e.textContent.trim().slice(0, 40) + ' [' + e.tagName.toLowerCase() + ']');
        const views = [...document.querySelectorAll('[class*="ion-page"]:not(.ion-page-hidden)')]
          .map(e => e.tagName.toLowerCase() + (e.id ? '#'+e.id : '') + '.' + [...e.classList].join('.'));
        return { btns, views: views.slice(0, 8) };
      }).catch(() => ({ btns: [], views: [] }));
      const bloq = `logout no encontrado — vistas: ${domSnapshot.views.join('|')} — btns: ${domSnapshot.btns.join(' / ')}`;
      ['DM-LOG-002','DM-LOG-003','DM-LOG-004','DM-LOG-001','DM-LOG-011','DM-LOG-012'].forEach(id =>
        v(id, id, 'BLOCKED', bloq));
      return { verdicts, msTotal: Date.now() - t0, newPg: pg };
    }
  }

  // ─── Cargar credenciales ─────────────────────────────────────────────────────

  let creds;
  try {
    creds = await fetchCreds(DATA.clienteSlug);
  } catch (e) {
    ['DM-LOG-002','DM-LOG-003','DM-LOG-004','DM-LOG-001','DM-LOG-011','DM-LOG-012'].forEach(id =>
      v(id, id, 'BLOCKED', 'fetchCreds falló: ' + e.message));
    return { verdicts, msTotal: Date.now() - t0, newPg: pg };
  }
  const badPass = creds.badPass || 'wrongpass_qa_test_123';

  // ══════════════════════════════════════════════════════════════════════════════
  // DM-LOG-002: Enviar sin llenar campos → alert "no pueden ser vacios"
  // ══════════════════════════════════════════════════════════════════════════════
  try {
    await clearAllFields();
    await clickSubmit();
    const alert = await getAlert();
    const ok = !!(alert && (alert.toLowerCase().includes('vac') || alert.toLowerCase().includes('empty') || alert.toLowerCase().includes('requer')));
    v('DM-LOG-002', 'Enviar vacío → alert campos obligatorios', ok ? 'PASS' : 'FAIL',
      `alert: "${alert || 'ninguno'}"`);
    await dismissAlert();
  } catch (e) {
    v('DM-LOG-002', 'Enviar vacío → alert campos obligatorios', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DM-LOG-003: Contraseña incorrecta → alert "contraseña incorrectos"
  // Requiere llamada de red → polling hasta 10s
  // ══════════════════════════════════════════════════════════════════════════════
  try {
    await clearAllFields();
    await fillField(0, creds.user);
    await fillField(1, badPass);
    await clickSubmit();
    let alert003 = null;
    for (let i = 0; i < 14 && !alert003; i++) {
      await pg.waitForTimeout(700);
      alert003 = await pg.evaluate(() => {
        const a = [...document.querySelectorAll('ion-alert')].find(x => {
          const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
          const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
          return isTraditional || hasVisibleBtn;
        });
        if (!a) return null;
        const msg = a.querySelector('.alert-message') || a.querySelector('.alert-title');
        return msg ? msg.textContent.trim() : (a.textContent.trim().slice(0, 120));
      });
    }
    // 🔑 La app antepone la alerta de CAMBIO DE USUARIO a la validación de
    //    credenciales: si el usuario tecleado no es el último que entró, lo que
    //    sale NO es el aviso de contraseña incorrecta. El caso entonces no mide
    //    lo que dice medir ⇒ BLOCKED CON MOTIVO, nunca FAIL (16/09: esto se
    //    reportó como FAIL falso). Se descarta con CANCELAR para no borrar la
    //    base local en mitad de un caso negativo.
    if (alert003 && RE_CAMBIO_USUARIO.test(alert003)) {
      v('DM-LOG-003', 'Contraseña incorrecta → alert de error', 'BLOCKED',
        'la app antepone la alerta de CAMBIO DE USUARIO (el usuario del archivo de ' +
        'credenciales no es el último que entró en el equipo) — el caso no llega a ' +
        `validar la contraseña. alert: "${alert003.slice(0, 120)}"`);
      await pulsarBotonAlerta(['cancelar', 'no']);
    } else {
      const ok = !!(alert003 && (
        alert003.toLowerCase().includes('incorrecta') ||
        alert003.toLowerCase().includes('incorrectos') ||
        alert003.toLowerCase().includes('invalid') ||
        alert003.toLowerCase().includes('error') ||
        alert003.toLowerCase().includes('contraseña') ||
        alert003.toLowerCase().includes('credencial')
      ));
      v('DM-LOG-003', 'Contraseña incorrecta → alert de error', ok ? 'PASS' : 'FAIL',
        `alert: "${alert003 || 'ninguno'}"`);
      await dismissAlert();
    }
  } catch (e) {
    v('DM-LOG-003', 'Contraseña incorrecta → alert de error', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DM-LOG-004: Checkbox "Recordar Usuario" — togglea con PointerEvent
  // ══════════════════════════════════════════════════════════════════════════════
  try {
    const antes = await pg.evaluate(() => {
      const cb = document.querySelector('ion-checkbox');
      return cb ? cb.checked : null;
    });
    if (antes === null) throw new Error('ion-checkbox no encontrado en pantalla login');

    // PointerEvent sequence — pg.mouse.click no activa el toggle en Ionic 6
    const toggled = await pg.evaluate(() => {
      const cb = document.querySelector('ion-checkbox');
      if (!cb) return false;
      const r = cb.getBoundingClientRect();
      if (r.width === 0) return false;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      ['pointerdown', 'pointerup', 'click'].forEach(type =>
        cb.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy }))
      );
      return true;
    });
    await pg.waitForTimeout(400);

    const despues = await pg.evaluate(() => {
      const cb = document.querySelector('ion-checkbox');
      return cb ? cb.checked : null;
    });

    const cambio = (antes !== despues);
    v('DM-LOG-004', 'Checkbox "Recordar Usuario" togglea', cambio ? 'PASS' : 'FAIL',
      `antes: ${antes} · después: ${despues} · cambió: ${cambio}`);

    // Restaurar estado original
    if (cambio) {
      await pg.evaluate(() => {
        const cb = document.querySelector('ion-checkbox');
        if (!cb) return;
        const r = cb.getBoundingClientRect();
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        ['pointerdown','pointerup','click'].forEach(t =>
          cb.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: cx, clientY: cy }))
        );
      });
      await pg.waitForTimeout(300);
    }
  } catch (e) {
    v('DM-LOG-004', 'Checkbox "Recordar Usuario" togglea', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DM-LOG-001: Login correcto → entra a la app
  // ══════════════════════════════════════════════════════════════════════════════
  let loginOk = false;
  let notaCambioUsuario = '';
  try {
    await clearAllFields();
    await fillField(0, creds.user);
    await fillField(1, creds.pass);
    await clickSubmit();

    // 1) Alerta de CAMBIO DE USUARIO → se ACEPTA (borra lo local y resincroniza
    //    con el vendedor tecleado). Esperada y autorizada cuando el usuario del
    //    archivo de credenciales no es el que tiene el equipo.
    //    ⚠ Antes esto se buscaba SIN esperar y por eso la corrida moría en /login.
    const cambio = await despacharCambioUsuario(8000);
    if (cambio.hubo) {
      notaCambioUsuario = cambio.aceptada
        ? `alerta de cambio de usuario ACEPTADA (botón "${cambio.label}"; opciones: ${(cambio.botones||[]).join(' / ')}) — la app borra lo local y resincroniza`
        : `alerta de cambio de usuario PRESENTE pero no se pudo pulsar (opciones: ${(cambio.botones||[]).join(' / ')})`;
      console.log('    ' + notaCambioUsuario);
    }

    // 2) Cualquier otra alerta de confirmación (ej. "Sesión activa en otro dispositivo")
    const sessionAlertCoords = await pg.evaluate(() => {
      const a = [...document.querySelectorAll('ion-alert')].find(x => {
        const isTraditional = !x.classList.contains('overlay-hidden') && x.offsetParent !== null;
        const hasVisibleBtn = [...x.querySelectorAll('.alert-button')].some(b => b.getBoundingClientRect().width > 0);
        return isTraditional || hasVisibleBtn;
      });
      if (!a) return null;
      const btns = [...a.querySelectorAll('.alert-button')].filter(b => b.getBoundingClientRect().width > 0);
      const confirm = btns.find(b => ['aceptar','ok','sí','si','continuar'].some(t => b.textContent.toLowerCase().includes(t)));
      const btn = confirm || btns[btns.length - 1];
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (sessionAlertCoords) await pg.mouse.click(sessionAlertCoords.x, sessionAlertCoords.y);
    await pg.waitForTimeout(500);

    // Esperar sync screen o home (max 180s — tras ACEPTAR un cambio de usuario la
    // app borra la base y resincroniza de cero, que tarda mucho más que un login normal)
    for (let i = 0; i < 180; i++) {
      const state = await pg.evaluate(() => ({
        sync:  !!(document.querySelector('app-synchronization') && !document.querySelector('app-synchronization').classList.contains('ion-page-hidden')),
        home:  !!(document.querySelector('app-home') && !document.querySelector('app-home').classList.contains('ion-page-hidden')),
        login: !!(document.querySelector('app-login') && !document.querySelector('app-login').classList.contains('ion-page-hidden')),
      }));
      if (state.sync || state.home) { loginOk = true; break; }
      // Permitir al menos 8s antes de concluir que el submit no funcionó
      if (i >= 8 && state.login && !state.sync && !state.home) break;
      await pg.waitForTimeout(1000);
    }

    v('DM-LOG-001', 'Login correcto → entra a app', loginOk ? 'PASS' : 'FAIL',
      (loginOk ? 'credenciales aceptadas' : 'no salió de login tras submit') +
      (notaCambioUsuario ? ' · ' + notaCambioUsuario : ''));
  } catch (e) {
    v('DM-LOG-001', 'Login correcto → entra a app', 'FAIL', e.message);
  }

  if (!loginOk) {
    ['DM-LOG-011','DM-LOG-012'].forEach(id =>
      v(id, id, 'BLOCKED', 'DM-LOG-001 falló — no se pudo entrar'));
    return { verdicts, msTotal: Date.now() - t0, newPg: pg };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DM-LOG-011: Pantalla de sincronización visible con progress-bar
  // ══════════════════════════════════════════════════════════════════════════════
  try {
    const syncInfo = await pg.evaluate(() => {
      const sync = document.querySelector('app-synchronization');
      if (!sync || sync.classList.contains('ion-page-hidden')) return null;
      const progress = sync.querySelector('ion-progress-bar, ion-spinner, .progress-bar, [role="progressbar"]');
      return { hasProgress: !!progress, text: (sync.innerText || '').slice(0, 80) };
    });

    if (!syncInfo) {
      v('DM-LOG-011', 'Sync screen visible con progress-bar', 'PASS',
        'app-synchronization transitó a HOME antes de captura (sync rápida)');
    } else {
      v('DM-LOG-011', 'Sync screen visible con progress-bar', syncInfo.hasProgress ? 'PASS' : 'FAIL',
        `progress: ${syncInfo.hasProgress} · texto: "${syncInfo.text}"`);
    }

    // Esperar a HOME (max 60s)
    for (let i = 0; i < 60; i++) {
      if (await isAtHome()) break;
      await pg.waitForTimeout(1000);
    }
  } catch (e) {
    v('DM-LOG-011', 'Sync screen visible con progress-bar', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DM-LOG-012: HOME visible con módulos esperados
  // ══════════════════════════════════════════════════════════════════════════════
  try {
    const homeOk = await isAtHome();
    if (!homeOk) throw new Error('app-home no visible tras sync');

    const modulosHome = await pg.evaluate(() => {
      const tiles = [...document.querySelectorAll('app-home a.ion-text-center, app-home .tile')]
        .filter(t => t.getBoundingClientRect().width > 0)
        .map(t => {
          const p = t.querySelector('p.nombreModulos, p, span');
          return p ? p.textContent.trim() : t.textContent.trim();
        })
        .filter(Boolean);
      return tiles;
    });

    const encontrados = modulosHome.length;
    const ok = encontrados >= 5;
    v('DM-LOG-012', 'HOME visible con módulos', ok ? 'PASS' : 'FAIL',
      `módulos (${encontrados}): [${modulosHome.join(', ')}]`);
  } catch (e) {
    v('DM-LOG-012', 'HOME visible con módulos', 'FAIL', e.message);
  }

  return { verdicts, msTotal: Date.now() - t0, newPg: pg };
}

module.exports = { runLogin };
