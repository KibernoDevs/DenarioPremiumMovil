'use strict';
// Helpers de navegación móvil para la corrida req_unidad_defecto.
// Todo por coords reales (mouse.click) tras verificar oclusión — nunca .click() por JS
// y nunca page.goto (rompe el router de Ionic).
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function estado(pg) {
  return await pg.evaluate(() => {
    const vis = t => { const e = document.querySelector(t); return !!(e && !e.classList.contains('ion-page-hidden')); };
    return {
      path: location.pathname,
      home: vis('app-home'), login: vis('app-login'),
      pedidos: vis('app-pedidos'), pedido: vis('app-pedido'),
      devoluciones: vis('app-devoluciones'), devolucion: vis('app-devolucion'),
      modals: document.querySelectorAll('ion-modal.show-modal').length,
      alerts: [...document.querySelectorAll('ion-alert')]
        .filter(a => !a.classList.contains('overlay-hidden') && a.offsetParent !== null).length,
    };
  });
}

// Cierra los ion-alert ACTIVOS leyendo la etiqueta real. Devuelve lo que vio.
async function alerts(pg, prefer = ['Aceptar', 'OK', 'SI', 'Sí']) {
  return await pg.evaluate((prefer) => {
    const out = [];
    const act = [...document.querySelectorAll('ion-alert')]
      .filter(a => !a.classList.contains('overlay-hidden') && a.offsetParent !== null);
    for (const a of act) {
      const btns = [...a.querySelectorAll('button.alert-button')].filter(b => b.getBoundingClientRect().width > 0);
      const labels = btns.map(b => b.textContent.trim());
      let pick = null;
      for (const p of prefer) { pick = btns.find(b => b.textContent.trim() === p); if (pick) break; }
      if (!pick) pick = btns[btns.length - 1];
      out.push({
        msg: ((a.querySelector('.alert-message') || {}).textContent || '').trim().slice(0, 180),
        labels, clicked: pick ? pick.textContent.trim() : null,
      });
      if (pick) pick.click();
    }
    return out;
  }, prefer);
}

// Click real al centro de un elemento localizado en la página, con re-lectura del rect.
async function clickRect(pg, getter, arg) {
  const r = await pg.evaluate(getter, arg);
  if (!r) return null;
  await pg.mouse.click(r.x, r.y, { delay: 60 });
  return r;
}

async function volverAHome(pg, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const st = await estado(pg);
    if (st.home) return true;
    if (st.alerts) { await alerts(pg, ['Salir sin guardar', 'No guardar', 'Descartar', 'Aceptar', 'OK']); await sleep(800); continue; }
    if (st.modals) {
      await pg.evaluate(() => { const m = document.querySelector('ion-modal.show-modal'); if (m && m.dismiss) m.dismiss(null, 'cancel'); });
      await sleep(900); continue;
    }
    const r = await pg.evaluate(() => {
      const imgs = [...document.querySelectorAll('img.fechaAtras, img[src*="flecha"]')]
        .filter(i => { const b = i.getBoundingClientRect(); return b.width > 0 && b.x < 140 && b.y < 140; });
      const el = imgs[0] && (imgs[0].closest('a') || imgs[0]);
      if (el) { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
      const bb = document.querySelector('ion-back-button');
      if (bb && bb.getBoundingClientRect().width > 0) { const b = bb.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
      return null;
    });
    if (r) await pg.mouse.click(r.x, r.y, { delay: 60 });
    await sleep(1100);
  }
  return false;
}

// HOME → módulo por el texto del tile (p.nombreModulos).
async function abrirModulo(pg, nombre) {
  const r = await clickRect(pg, (n) => {
    const p = [...document.querySelectorAll('app-home p.nombreModulos, app-home p')]
      .find(e => (e.textContent || '').trim().toLowerCase() === n.toLowerCase());
    if (!p) return null;
    const t = p.closest('a') || p;
    const b = t.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, nombre);
  await sleep(2500);
  return r;
}

// Dentro de app-pedidos / app-devoluciones: botón PEDIDO / DEVOLUCION por texto.
async function botonModulo(pg, texto) {
  const r = await clickRect(pg, (t) => {
    const b = [...document.querySelectorAll('ion-button.colorBorderBuscar, ion-button')]
      .filter(e => e.getBoundingClientRect().height > 0)
      .find(e => (e.textContent || '').trim().toUpperCase() === t.toUpperCase());
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, texto);
  await sleep(3000);
  return r;
}

module.exports = { sleep, estado, alerts, clickRect, volverAHome, abrirModulo, botonModulo };
