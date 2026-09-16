'use strict';
/**
 * Acepta los dialogos pendientes de un envio que ya se disparo y coteja la nube.
 *   node rescatar.js <marca>
 */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');
const fs = require('fs');
const path = require('path');

const MARCA = process.argv[2];
if (!MARCA) { console.error('falta la marca'); process.exit(1); }
const DATA = { clienteSlug: '4k', requiredComment: true };
const LOG = [];
const say = (...a) => { const s = a.join(' '); LOG.push(s); console.log(s); };
const consola = [];

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 25000 });
  const pg = browser.contexts()[0].pages()[0];
  pg.on('console', m => { try { consola.push('[' + m.type() + '] ' + m.text()); } catch (_) {} });
  pg.on('pageerror', e => consola.push('[pageerror] ' + e.message));
  await pg.bringToFront();
  const H = makeHelpers(pg, DATA);

  say('=== RESCATAR - marca ' + MARCA + ' ===');
  for (let i = 0; i < 4; i++) {
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
  let cola = null;
  try { const l = await H.abrirListaCobros(); cola = { total: l.total, guardados: l.guardados, enviados: l.enviados }; } catch (_) {}
  say('  cola del equipo: ' + JSON.stringify(cola));

  const hay = !!(nube.anticipos && nube.anticipos.length);
  const veredicto = hay ? 'PASS' : 'FAIL';
  say('  => ' + veredicto + ' - anticipo ' + (hay ? 'GENERADO' : 'AUSENTE'));
  const rx = /ANTICIPO|anticipoAutomatico|payment|PAYMENT|hu.rfano|CobrosHeader|repaid|errorMessage|COLLECTION|AutoSend/;
  const clave = consola.filter(l => rx.test(l));
  clave.forEach(l => say('  ' + l));

  await H.abandonarCobro().catch(() => {});
  const out = { marca: MARCA, veredicto, ts: new Date().toISOString(),
    nube: { resumen: nube.resumen, filas: nube.filas }, cola: cola,
    consolaEnvio: consola, consolaClave: clave, log: LOG };
  fs.writeFileSync(path.join(__dirname, 'caso_' + MARCA + '.json'), JSON.stringify(out, null, 2));
  console.log('\n-> ' + veredicto);
  await browser.close().catch(() => {});
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });
