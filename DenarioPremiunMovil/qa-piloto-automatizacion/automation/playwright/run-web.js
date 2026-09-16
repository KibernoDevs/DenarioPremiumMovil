'use strict';
// run-web.js — Orquestador web standalone Denario Premium
//
// Uso:
//   node automation/playwright/run-web.js run-vzla
//   node automation/playwright/run-web.js run-vzla --modulo=visitas
//   node automation/playwright/run-web.js run-vzla --run-dir=automation/reports/run-vzla/script_run-vzla_20260819_090803

const path = require('path');
const fs   = require('fs');
const yaml = require('js-yaml');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');

// ── Parsear args ──────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
let QA_CLIENTE = null, QA_MODULO = null, RUN_DIR_MOVIL = null;
for (const a of rawArgs) {
  if      (a.startsWith('--cliente='))  QA_CLIENTE    = a.split('=')[1];
  else if (a.startsWith('--modulo='))   QA_MODULO     = a.split('=')[1];
  else if (a.startsWith('--run-dir='))  RUN_DIR_MOVIL = a.split('=').slice(1).join('=');
  else if (!QA_CLIENTE && !a.startsWith('--')) QA_CLIENTE = a;
}
if (!QA_CLIENTE) {
  console.error('Uso: node automation/playwright/run-web.js <QA_CLIENTE> [--modulo=<mod>] [--run-dir=<path>]');
  process.exit(1);
}

// ── Leer perfil YAML ──────────────────────────────────────────────────────────
const yamlPath = path.join(ROOT, 'automation', 'clientes', `${QA_CLIENTE}.yaml`);
let perfil;
try {
  perfil = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
} catch (e) {
  console.error(`ERR: no se pudo leer ${yamlPath}: ${e.message}`);
  process.exit(1);
}

// ── Detectar playa desde ws_url ───────────────────────────────────────────────
const WS_URL = perfil.ws_url || '';
const PLAYAS_MAP = {
  'denariolatortuga':  'la_tortuga',
  'denarioislacoche':  'isla_coche',
  'denarioelyaque':    'el_yaque',
  'denariocaribe':     'caribe',
};
let playa = null;

// LA PLAYA SE PASA POR PARAMETRO, NO SE GUARDA EN EL PERFIL.
//   La ws_url es de la PLAYA, no del cliente: un mismo cliente se muda de
//   servidor (4K paso de Isla Coche a Caribe el 04/09; hidroponias hizo el
//   camino inverso). Por eso la norma es no guardarla en el YAML y descubrirla
//   en runtime. Hasta el 16/09 este runner la EXIGIA y abortaba con
//   «no se pudo detectar la playa desde ws_url:» (vacio), lo que hacia
//   imposible lanzarlo cumpliendo la norma.
//       --playa=caribe   ·   QA_PLAYA=caribe   ·   o ws_url si existiera
const playaArg = (rawArgs.find((a) => a.startsWith('--playa=')) || '').split('=')[1];
const playaPedida = (playaArg || process.env.QA_PLAYA || '').trim().toLowerCase();

if (playaPedida) {
  const validas = Object.values(PLAYAS_MAP);
  if (!validas.includes(playaPedida)) {
    console.error(`ERR: playa desconocida: "${playaPedida}"`);
    console.error(`Playas conocidas: ${validas.join(', ')}`);
    process.exit(1);
  }
  playa = playaPedida;
} else {
  for (const [k, v] of Object.entries(PLAYAS_MAP)) {
    if (WS_URL.toLowerCase().includes(k)) { playa = v; break; }
  }
}
if (!playa) {
  console.error('ERR: no se sabe contra que playa correr.');
  console.error('  Pasala:  --playa=caribe   (o QA_PLAYA=caribe)');
  console.error(`  Playas conocidas: ${Object.values(PLAYAS_MAP).join(', ')}`);
  console.error('  La playa NO se guarda en el perfil del cliente: es rotativa.');
  process.exit(1);
}
console.log(`  Playa: ${playa}${playaPedida ? ' (por parametro)' : ' (deducida de ws_url)'}`);

// ── Leer URL base desde playas.yaml ──────────────────────────────────────────
const playasYamlPath = path.join(ROOT, 'automation', 'web', 'playas.yaml');
let playasConfig;
try {
  playasConfig = yaml.load(fs.readFileSync(playasYamlPath, 'utf8'));
} catch (e) {
  console.error(`ERR: no se pudo leer playas.yaml: ${e.message}`);
  process.exit(1);
}
const baseUrl = playasConfig.playas[playa] && playasConfig.playas[playa].base;
if (!baseUrl) {
  console.error(`ERR: playa "${playa}" no tiene URL en playas.yaml`);
  process.exit(1);
}

// ── Leer credenciales web ─────────────────────────────────────────────────────
function fetchWebCreds(playaSlug) {
  const credsPath = path.join(ROOT, 'secrets', 'qa-credentials.env');
  if (!fs.existsSync(credsPath)) return null;
  const content = fs.readFileSync(credsPath, 'utf8');

  // SE BUSCA LA PLAYA MENCIONADA EN LA CABECERA, no una cabecera exacta.
  //   Hasta el 16/09 se comparaba contra una lista fija de cabeceras literales.
  //   El 14/09 QA reorganizo los bloques —CARIBE paso del bloque de Isla Coche
  //   al de La Tortuga— y el runner dejo de encontrar las credenciales aunque
  //   estuvieran ahi. Una cabecera puede listar VARIAS playas
  //   («# USUARIO WEB LA TORTUGA / CARIBE») y eso cambia cada vez que alguien
  //   mueve un cliente de servidor.
  //   Es la misma familia de fallo que `qa-web-open.js`, que coge siempre el
  //   PRIMER bloque `# USUARIO WEB` sea cual sea la playa.
  const NOMBRE_EN_CABECERA = {
    la_tortuga: 'la tortuga',
    isla_coche: 'isla coche',
    el_yaque:   'el yaque',
    caribe:     'caribe',
  };
  const aguja = NOMBRE_EN_CABECERA[playaSlug];
  if (!aguja) return null;

  const lines = content.split('\n');
  const candidatos = [];
  lines.forEach((l, i) => {
    const t = l.trim().toLowerCase();
    if (t.startsWith('#') && t.includes('usuario web') && t.includes(aguja)) candidatos.push(i);
  });

  for (const idx of candidatos) {
    let user = null, pass = null;
    for (let i = idx + 1; i < Math.min(idx + 10, lines.length); i++) {
      const l = lines[i].trim();
      if (l.startsWith('#') && l.includes('USUARIO WEB')) break;
      if (l.startsWith('QA_USER='))     user = l.split('=').slice(1).join('=');
      if (l.startsWith('QA_PASSWORD=')) pass = l.split('=').slice(1).join('=');
      if (user && pass) return { user, pass };
    }
  }
  return null;
}

const creds = fetchWebCreds(playa);
if (!creds) {
  console.error(`ERR: no se encontraron credenciales web para playa "${playa}" en secrets/qa-credentials.env`);
  console.error(`Agregar bloque: # USUARIO WEB ${playa.toUpperCase().replace('_', ' ')}`);
  process.exit(1);
}

// ── Manifiesto desde corrida móvil ────────────────────────────────────────────
const { buildManifest, detectarUltimoRun } = require('../web/manifest');
let resultsJsonl = null;
if (RUN_DIR_MOVIL) {
  const p = path.isAbsolute(RUN_DIR_MOVIL)
    ? path.join(RUN_DIR_MOVIL, '_results.jsonl')
    : path.join(ROOT, RUN_DIR_MOVIL, '_results.jsonl');
  if (fs.existsSync(p)) resultsJsonl = p;
  else console.warn(`WARN: --run-dir no encontrado: ${p}`);
} else {
  resultsJsonl = detectarUltimoRun(ROOT, QA_CLIENTE);
  if (resultsJsonl) console.log(`  Manifiesto: ${resultsJsonl}`);
  else console.log('  Manifiesto: ninguno (C## serán N/A)');
}
const manifest = buildManifest(resultsJsonl);

// ── Módulos disponibles ───────────────────────────────────────────────────────
const MODULOS_WEB = {
  visitas:              require('../web/modules/visitas').runVisitasWeb,
  cobros:               require('../web/modules/cobros').runCobrosWeb,
  pedidos:              require('../web/modules/pedidos').runPedidosWeb,
  depositos:            require('../web/modules/depositos').runDepositosWeb,
  devoluciones:         require('../web/modules/devoluciones').runDevolucionesWeb,
  inventarios:          require('../web/modules/inventarios').runInventariosWeb,
  'clientes-potenciales': require('../web/modules/clientes-potenciales').runClientesPotencialesWeb,
  // 16/09 · pulso rapido: listado + lupa + detalle, con oraculo de base.
  //   NO entra en ORDEN_DEFAULT a proposito: se lanza con --modulo=happy-path
  //   cuando hace falta saber en minutos si la web sigue en pie.
  'happy-path':         require('../web/modules/happy-path').runHappyPathWeb,
};

const ORDEN_DEFAULT = ['visitas', 'cobros', 'pedidos', 'depositos', 'devoluciones', 'inventarios', 'clientes-potenciales'];

const modulosFiltro = QA_MODULO ? [QA_MODULO] : ORDEN_DEFAULT;
const invalidos = modulosFiltro.filter((m) => !MODULOS_WEB[m]);
if (invalidos.length) {
  console.error(`ERR: módulo(s) no implementado(s): ${invalidos.join(', ')}`);
  console.error(`Disponibles: ${Object.keys(MODULOS_WEB).join(', ')}`);
  process.exit(1);
}

// ── Carpeta de reporte ────────────────────────────────────────────────────────
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const fecha = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
const hora  = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
// 🔴 Dentro de la carpeta del cliente, igual que el runner móvil y que las
//    corridas manuales — ver `automation/reports/README.md`.
const RUN_DIR = path.join(ROOT, 'automation', 'reports', QA_CLIENTE,
                          `script-web_${QA_CLIENTE}_${fecha}_${hora}`);
fs.mkdirSync(RUN_DIR, { recursive: true });

const RESULTS_FILE = path.join(RUN_DIR, '_web-results.jsonl');

function appendResult(modulo, v) {
  fs.appendFileSync(RESULTS_FILE, JSON.stringify({ modulo, ...v, runner: 'playwright-web' }) + '\n');
}

function buildMd(modulo, verdicts, msTotal) {
  const iconMap = { PASS: '✅', FAIL: '❌', SKIP: '⏭️', 'N/A': '⬜', BLOCKED: '🚫' };
  const lines = [`# WEB ${modulo.toUpperCase()} — ${QA_CLIENTE}`, ''];
  for (const v of verdicts) {
    const icon = iconMap[v.resultado] || '❓';
    const nota = v.nota ? ` _(${v.nota})_` : '';
    lines.push(`- ${icon} **${v.id}** ${v.descripcion || ''}${nota}`);
  }
  const counts = verdicts.reduce((a, v) => { a[v.resultado] = (a[v.resultado]||0)+1; return a; }, {});
  lines.push('', `**Resumen:** ${Object.entries(counts).map(([k,n])=>`${k}:${n}`).join(' · ')}`);
  lines.push(`_Tiempo: ${(msTotal/1000).toFixed(1)}s_`);
  return lines.join('\n');
}

// ── Login web ─────────────────────────────────────────────────────────────────
async function loginWeb(pg) {
  await pg.goto(`${baseUrl}/pages/login.xhtml`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await pg.evaluate(() => window.location.pathname); // asegurar carga
  const loginPage = await pg.evaluate(() => location.pathname.includes('login'));
  if (!loginPage) return; // ya logueado

  await pg.fill('input[id*="usuario"], input[name*="usuario"], input[type="text"]:first-of-type', creds.user);
  await pg.fill('input[id*="clave"], input[name*="clave"], input[type="password"]', creds.pass);
  await pg.click('button[id*="ingresar"], button[type="submit"], input[type="submit"]');
  await pg.waitForURL((url) => !url.pathname.includes('login'), { timeout: 15000 });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  QA Web Standalone · ${QA_CLIENTE.padEnd(23)}║`);
  console.log(`║  Playa: ${playa.padEnd(37)}║`);
  console.log(`║  Módulos: ${modulosFiltro.join(', ').padEnd(35)}║`);
  console.log(`╚══════════════════════════════════════════════╝`);
  console.log(`  URL: ${baseUrl}`);
  console.log(`  RUN DIR: ${RUN_DIR}\n`);

  // USA EL CHROME DEL SISTEMA (channel: 'chrome'), no el de Playwright.
  //   Los modulos del MOVIL se enganchan al telefono por connectOverCDP y no
  //   necesitan navegador, asi que nadie habia descargado los binarios de
  //   Playwright: al lanzar la web fallaba con «Executable doesn't exist at
  //   ...ms-playwright/chromium-1234». En vez de descargar ~150 MB se usa el
  //   Chrome ya instalado: arranca antes y no anade dependencias.
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: false, slowMo: 50 });
  } catch (errChrome) {
    console.warn('  Chrome del sistema no disponible; probando el de Playwright');
    browser = await chromium.launch({ headless: false, slowMo: 50 });
  }
  const context = await browser.newContext();
  const pg = await context.newPage();

  try {
    // Login
    console.log('  Iniciando sesión web...');
    await loginWeb(pg);
    const pathname = await pg.evaluate(() => location.pathname);
    if (pathname.includes('login')) {
      console.error('  ERR: Login fallido — USUARIO INVALIDO o credenciales incorrectas');
      console.error(`  Playa: ${playa} · Usuario: ${creds.user}`);
      await browser.close();
      process.exit(1);
    }
    console.log(`  ✓ Login OK (${pathname})\n`);

    const totalStart = Date.now();
    const allVerdicts = [];

    for (let i = 0; i < modulosFiltro.length; i++) {
      const modulo = modulosFiltro[i];
      console.log(`[${i+1}/${modulosFiltro.length}] web:${modulo}...`);

      const data = { baseUrl, playa, manifest, perfil, clienteSlug: QA_CLIENTE };
      let verdicts, msTotal;

      try {
        const result = await MODULOS_WEB[modulo](pg, data);
        ({ verdicts, msTotal } = result);
      } catch (e) {
        console.error(`    ERR no capturado en web:${modulo}: ${e.message}`);
        verdicts = [{ id: `DW-${modulo.toUpperCase().slice(0,3)}-ERR`, descripcion: 'Error general', resultado: 'BLOCKED', nota: e.message }];
        msTotal  = 0;
      }

      for (const v of verdicts) appendResult(modulo, v);
      fs.writeFileSync(path.join(RUN_DIR, `web-${modulo}.md`), buildMd(modulo, verdicts, msTotal || 0));
      allVerdicts.push(...verdicts);

      const counts = verdicts.reduce((a, v) => { a[v.resultado] = (a[v.resultado]||0)+1; return a; }, {});
      console.log(`      ${verdicts.length} casos · ${((msTotal||0)/1000).toFixed(1)}s · ${Object.entries(counts).map(([k,n])=>`${k}:${n}`).join(' ')}\n`);
    }

    // ── Resumen ───────────────────────────────────────────────────────────────
    const totalCounts = allVerdicts.reduce((a, v) => { a[v.resultado] = (a[v.resultado]||0)+1; return a; }, {});
    const totalMs = Date.now() - totalStart;
    console.log('═══════════════════════════════════════════');
    console.log(`RESUMEN WEB · ${QA_CLIENTE} · ${(totalMs/60000).toFixed(1)} min`);
    console.log(`  PASS:${totalCounts.PASS||0}  FAIL:${totalCounts.FAIL||0}  N/A:${totalCounts['N/A']||0}  BLOCKED:${totalCounts.BLOCKED||0}  total:${allVerdicts.length}`);
    console.log(`  Reporte: ${RUN_DIR}`);
    console.log('═══════════════════════════════════════════\n');

  } finally {
    await browser.close();
  }
})().catch(e => { console.error('ERR FATAL:', e.message); process.exit(1); });
