'use strict';
/** Lista los clientes que el EQUIPO carga para el vendedor en sesión (modal de Cobros). */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 25000 });
  const pg = browser.contexts()[0].pages()[0];
  await pg.bringToFront();
  const H = makeHelpers(pg, { clienteSlug: '4k', requiredComment: true });

  await H.abandonarCobro().catch(() => {});
  await pg.waitForTimeout(800);
  if (!(await H.abrirNuevoCobro())) {
    await H.irAHomeCobros().catch(() => {});
    await pg.waitForTimeout(1500);
    if (!(await H.abrirNuevoCobro())) { console.log('BLOCKED: no abrio el formulario'); return browser.close(); }
  }
  await pg.evaluate(() => {
    const m = document.querySelector('#clienteSelectModal');
    if (m && typeof m.present === 'function') m.present();
  });
  await pg.waitForTimeout(2500);

  const leer = () => pg.evaluate(() => {
    const modal = document.querySelector('#clienteSelectModal') || document.querySelector('ion-modal.show-modal');
    if (!modal) return [];
    return [...modal.querySelectorAll('ion-item, ion-row')]
      .map(e => (e.innerText || '').replace(/\s+/g, ' ').trim())
      .filter(t => /C\.\d{4}/.test(t));
  });

  let vistos = new Set();
  for (let i = 0; i < 40; i++) {
    (await leer()).forEach(t => vistos.add(t));
    const fin = await pg.evaluate(() => {
      const modal = document.querySelector('#clienteSelectModal') || document.querySelector('ion-modal.show-modal');
      if (!modal) return true;
      const sc = modal.querySelector('ion-content');
      if (!sc) return true;
      const el = sc.shadowRoot && sc.shadowRoot.querySelector('.inner-scroll');
      const t = el || sc;
      const antes = t.scrollTop;
      t.scrollTop = antes + 1200;
      return t.scrollTop === antes;
    });
    await pg.waitForTimeout(700);
    if (fin) { (await leer()).forEach(t => vistos.add(t)); break; }
  }
  const lista = [...vistos].sort();
  console.log('TOTAL ' + lista.length);
  lista.forEach(t => console.log(t));
  fs.writeFileSync(path.join(__dirname, 'cartera_V0030.txt'), lista.join('\n'));
  await H.abandonarCobro().catch(() => {});
  await browser.close();
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });
