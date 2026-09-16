const { chromium } = require('C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 20000 });
  const pg = b.contexts()[0].pages()[0];
  const r = await pg.evaluate(async () => {
    const res = await fetch('/main.js');
    const t = await res.text();
    const out = { len: t.length, path: location.pathname };
    // marcadores del fix nuevo
    out.tieneNormalize   = t.includes('normalizeAutomatedPrepaidPaymentMeta');
    out.tieneEnsure      = t.includes('ensureAutomatedPrepaidPaymentTemplate');
    out.tieneComentario  = t.includes('Exceso de pago usa objetos UI en anticipoAutomatico');
    out.tieneSintetico   = /synthetic\s*:\s*!?0|synthetic\s*:\s*true/.test(t);
    out.tieneFallbackCP  = t.includes('CollectionPayment') ;
    // versionApp
    const m = t.match(/versionApp\s*[=:]\s*['"]([\d.]+)['"]/);
    out.versionApp = m ? m[1] : null;
    return out;
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
