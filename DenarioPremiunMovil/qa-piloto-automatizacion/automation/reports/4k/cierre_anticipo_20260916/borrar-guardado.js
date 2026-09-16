'use strict';
/** Intenta eliminar el cobro en estado Guardado del cliente indicado (limpieza del equipo). */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');
const CLIENTE = process.argv[2] || 'C.0398';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 25000 });
  const pg = browser.contexts()[0].pages()[0];
  await pg.bringToFront();
  const H = makeHelpers(pg, { clienteSlug: '4k', requiredComment: true });
  await H.abandonarCobro().catch(() => {});
  await pg.waitForTimeout(700);
  await H.abrirListaCobros().catch(() => {});
  await pg.waitForTimeout(1200);

  const c = await pg.evaluate((cli) => {
    const root = document.querySelector('app-cobros') || document.body;
    const item = [...root.querySelectorAll('ion-item, ion-card, ion-row')]
      .filter(e => e.getBoundingClientRect().width > 0)
      .find(e => (e.innerText || '').includes(cli) && /Guardado/i.test(e.innerText || ''));
    if (!item) return { err: 'no encuentro el item Guardado de ' + cli };
    const btns = [...item.querySelectorAll('ion-button, ion-icon, img')]
      .filter(b => b.getBoundingClientRect().width > 0)
      .map(b => ({ tag: b.tagName, name: b.getAttribute('name') || b.getAttribute('src') || '', cls: String(b.className).slice(0, 50) }));
    const del = [...item.querySelectorAll('ion-button, ion-icon, img')]
      .filter(b => b.getBoundingClientRect().width > 0)
      .find(b => /trash|delete|borrar|elimin|basura/i.test((b.getAttribute('name') || '') + (b.getAttribute('src') || '') + String(b.className)));
    if (!del) return { err: 'sin boton de borrado', btns };
    const r = del.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, btns };
  }, CLIENTE);
  console.log(JSON.stringify(c).slice(0, 900));
  if (c && c.x) {
    await pg.mouse.click(c.x, c.y, { delay: 90 });
    await pg.waitForTimeout(1500);
    const al = await H.readAlert();
    console.log('alerta:', al);
    if (al) { await H.clickAlertBtn(['Aceptar', 'Si', 'OK', 'Eliminar']).catch(() => {}); await pg.waitForTimeout(2000); }
    const l = await H.abrirListaCobros().catch(() => ({}));
    console.log('lista tras borrar:', JSON.stringify({ total: l.total, guardados: l.guardados }));
  }
  await browser.close();
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });
