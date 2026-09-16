'use strict';
/** Abre un cobro para <cliente> y describe los SELECTORES del Tab Documentos (moneda y tipo). */
const PW = 'C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/playwright/node_modules/playwright';
const { chromium } = require(PW);
const makeHelpers = require('./_helpers.js');

const CLIENTE = process.argv[2] || 'C.0395';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9220', { timeout: 25000 });
  const pg = browser.contexts()[0].pages()[0];
  await pg.bringToFront();
  const H = makeHelpers(pg, { clienteSlug: '4k', requiredComment: true });

  await H.abandonarCobro().catch(() => {});
  await pg.waitForTimeout(700);
  if (!(await H.abrirNuevoCobro())) {
    await H.irAHomeCobros().catch(() => {});
    await pg.waitForTimeout(1500);
    if (!(await H.abrirNuevoCobro())) { console.log('BLOCKED form'); return browser.close(); }
  }
  await H.seleccionarCliente(CLIENTE);
  await H.fillComentario('SONDA-FILTRO');
  for (let i = 0; i < 8; i++) { if (await H.tabsHabilitadas() >= 4) break; await pg.waitForTimeout(700); }
  await H.clickTab('documentos');
  await H.cargarDocumentos();
  await pg.waitForTimeout(1200);

  const info = await pg.evaluate(() => {
    const d = document.querySelector('app-cobro-documents');
    if (!d) return { err: 'sin app-cobro-documents' };
    const sels = [...d.querySelectorAll('ion-select')].map(s => ({
      label: (s.getAttribute('label') || s.getAttribute('placeholder') || (s.previousElementSibling && s.previousElementSibling.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      value: s.value,
      texto: (s.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      opciones: [...s.querySelectorAll('ion-select-option')].map(o => ({ v: o.value, t: (o.textContent || '').trim() })),
    }));
    return { sels, texto: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300) };
  });
  console.log(JSON.stringify(info, null, 2));

  // Segmento «A favor» — donde viven las notas de credito
  const seg = await pg.evaluate(() => {
    const d = document.querySelector('app-cobro-documents');
    if (!d) return null;
    const todos = [...d.querySelectorAll('*')].filter(e => {
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim();
      return /^a\s*favor$/i.test(t) && e.getBoundingClientRect().width > 0;
    });
    if (!todos.length) {
      // diagnostico: quien contiene el texto
      const c = [...d.querySelectorAll('*')].filter(e => /a favor/i.test((e.textContent||'')) && e.children.length <= 3)
        .slice(-6).map(e => e.tagName + '.' + String(e.className).slice(0,40) + ' :: ' + (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,60));
      return { diag: c };
    }
    const b = todos[todos.length - 1];
    const r = b.getBoundingClientRect();
    return { tag: b.tagName, cls: String(b.className).slice(0, 60), x: r.left + r.width / 2, y: r.top + r.height / 2,
             tapa: (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) || {}).tagName };
  });
  console.log('segmento A favor ->', JSON.stringify(seg));
  if (seg && seg.x) {
    await pg.mouse.click(seg.x, seg.y, { delay: 90 });
    await pg.waitForTimeout(2000);
    const filas = await pg.evaluate(() => {
      const d = document.querySelector('app-cobro-documents');
      return [...d.querySelectorAll('ion-row.tabladocumentSalesVenta')]
        .filter(f => f.getBoundingClientRect().width > 0)
        .map(f => (f.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 140));
    });
    console.log('FILAS A FAVOR (' + filas.length + '):');
    filas.forEach(f => console.log('   ' + f));
  }
  await H.abandonarCobro().catch(() => {});
  await browser.close();
})().catch(e => { console.error('ERR', (e && e.stack) || e); process.exit(1); });
