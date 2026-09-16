'use strict';
/** Estado de la cola del equipo: cobros Guardados / Por enviar. */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 25000 });
  const pg = browser.contexts()[0].pages()[0];
  await pg.bringToFront();
  const H = makeHelpers(pg, { clienteSlug: '4k', requiredComment: true });
  await H.abandonarCobro().catch(() => {});
  await pg.waitForTimeout(800);
  const l = await H.abrirListaCobros().catch(e => ({ err: e.message }));
  console.log('lista:', JSON.stringify({ total: l.total, guardados: l.guardados, enviados: l.enviados, err: l.err }));
  const filas = await pg.evaluate(() => {
    const root = document.querySelector('app-cobros') || document.body;
    return [...root.querySelectorAll('ion-item, ion-card, ion-row')]
      .map(e => (e.innerText || '').replace(/\s+/g, ' ').trim())
      .filter(t => /guardad|por enviar|rechaz/i.test(t))
      .slice(0, 25);
  });
  filas.forEach(f => console.log('  ' + f.slice(0, 180)));
  await browser.close();
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });
