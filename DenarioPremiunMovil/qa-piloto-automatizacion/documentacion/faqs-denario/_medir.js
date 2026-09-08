'use strict';
/**
 * _medir.js — ¿cuánto se pasa de una página?
 *
 * Uso:  node documentacion/faqs-denario/_medir.js <archivo.html>
 *
 * 🔑 POR QUÉ EXISTE
 * Recortar contenido «a ojo» hasta que quepa cuesta tres o cuatro reconstrucciones
 * del PDF y se termina quitando más de lo necesario. Esto dice EXACTAMENTE cuántos
 * milímetros sobran y qué columna es la que se pasa, así el recorte es quirúrgico.
 *
 * Levanta Chrome headless con depuración remota, abre el archivo y mide.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));

const PW = path.resolve(__dirname, '..', '..', 'automation', 'playwright', 'node_modules');
const { chromium } = require(path.join(PW, 'playwright'));

// A4 menos los márgenes de @page (9 mm por lado) → alto y ancho útiles
const ALTO_UTIL_MM = 297 - 18;
const ANCHO_UTIL_MM = 210 - 18;
const MM_A_PX = 96 / 25.4;   // Chrome imprime a 96 dpi

const archivo = process.argv[2];
if (!archivo || !CHROME) {
  console.log(CHROME ? 'uso: node _medir.js <archivo.html>' : 'ERR: no se encontró Chrome ni Edge');
  process.exit(1);
}

const PUERTO = 9333;

(async () => {
  const perfil = path.join(require('os').tmpdir(), 'qa-medir-perfil');
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    `--window-size=${Math.round(ANCHO_UTIL_MM * MM_A_PX)},${Math.round(ALTO_UTIL_MM * MM_A_PX)}`,
    'about:blank',
  ], { detached: false, stdio: 'ignore' });

  let b;
  try {
    for (let i = 0; i < 30; i++) {
      try { b = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO}`, { timeout: 1000 }); break; }
      catch (_) { await new Promise(r => setTimeout(r, 400)); }
    }
    if (!b) throw new Error('Chrome no levantó la depuración remota');

    const pg = await b.contexts()[0].newPage();
    await pg.setViewportSize({
      width: Math.round(ANCHO_UTIL_MM * MM_A_PX),
      height: Math.round(ALTO_UTIL_MM * MM_A_PX),
    });
    await pg.goto('file:///' + path.resolve(archivo).replace(/\\/g, '/'), { waitUntil: 'load' });
    await pg.waitForTimeout(700);

    const m = await pg.evaluate((mmApx) => {
      const px = (v) => Math.round((v / mmApx) * 10) / 10;
      const cols = [...document.querySelectorAll('.rejilla .col')].map((c, i) => ({
        col: ['izquierda', 'centro', 'derecha'][i] || `col${i}`,
        mm: px(c.getBoundingClientRect().height),
      }));
      return {
        totalMm: px(document.body.scrollHeight),
        rejillaMm: px(document.querySelector('.rejilla')?.getBoundingClientRect().height || 0),
        columnas: cols,
      };
    }, MM_A_PX);

    const sobra = Math.round((m.totalMm - ALTO_UTIL_MM) * 10) / 10;
    console.log(`\n  alto disponible : ${ALTO_UTIL_MM} mm`);
    console.log(`  alto del documento: ${m.totalMm} mm`);
    console.log(sobra > 0
      ? `  🔴 SE PASA POR ${sobra} mm — hay que recortar`
      : `  ✅ cabe, con ${Math.abs(sobra)} mm de margen`);
    console.log(`\n  rejilla: ${m.rejillaMm} mm`);
    m.columnas.forEach(c => console.log(`    ${c.col.padEnd(10)} ${c.mm} mm` +
      (c.mm === Math.max(...m.columnas.map(x => x.mm)) ? '   ← la más alta, es la que manda' : '')));
    console.log('');

    await b.close().catch(() => {});
  } finally {
    try { chrome.kill(); } catch (_) {}
    try { execSync(`taskkill /F /PID ${chrome.pid} /T`, { stdio: 'ignore' }); } catch (_) {}
  }
})();
