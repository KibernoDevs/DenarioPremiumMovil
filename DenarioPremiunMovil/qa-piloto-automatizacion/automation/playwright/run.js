'use strict';
// Orquestador Playwright Standalone — Denario Premium Móvil QA
// Uso:
//   node automation/playwright/run.js run-vzla
//   node automation/playwright/run.js --cliente=run-vzla
//   node automation/playwright/run.js --cliente=run-vzla --modulo=login

const path = require('path');
const fs   = require('fs');
const yaml = require('js-yaml');
const { chromium } = require('playwright');
const { conectar, volverAHome } = require('./connect');
const { contrastarVGs } = require('./contraste-vgs');

// ── Parsear args ──────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2);
let QA_CLIENTE = null, QA_MODULO = null;
for (const a of rawArgs) {
  if (a.startsWith('--cliente=')) QA_CLIENTE = a.split('=')[1];
  else if (a.startsWith('--modulo=')) QA_MODULO  = a.split('=')[1];
  else if (!QA_CLIENTE && !a.startsWith('--')) QA_CLIENTE = a;
}
if (!QA_CLIENTE) {
  console.error('Uso: node automation/playwright/run.js <QA_CLIENTE> [--modulo=<modulo>]');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..', '..');

// ── Leer perfil YAML ──────────────────────────────────────────────────────────
const yamlPath = path.join(ROOT, 'automation', 'clientes', `${QA_CLIENTE}.yaml`);
let perfil;
try {
  perfil = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
} catch (e) {
  console.error(`ERR: no se pudo leer ${yamlPath}: ${e.message}`);
  process.exit(1);
}

// ── Módulos disponibles ───────────────────────────────────────────────────────
const MODULOS = {
  login:       require('./modules/login').runLogin,
  clientes:    require('./modules/clientes').runClientes,
  pedidos:     require('./modules/pedidos').runPedidos,
  cobros:      require('./modules/cobros').runCobros,   // Fase 1 (co_type 0)
  devoluciones: require('./modules/devoluciones').runDevoluciones,
  inventarios: require('./modules/inventarios').runInventarios,
  depositos:   require('./modules/depositos').runDepositos,
  visitas:     require('./modules/visitas').runVisitas,
  productos:   require('./modules/productos').runProductos,
  vendedores:  require('./modules/vendedores').runVendedores,
  // ── Módulo ESPECIAL, no entra en la corrida completa ──────────────────────
  // Solo aplica a clientes con `suggestedOrderByDispatchAndReturn = true` (hoy,
  // solo hidroponias). Se pide a mano:
  //     node automation/playwright/run.js hidroponias --modulo=sugerido
  // Va DESPUÉS de los normales: el sugerido nace de un inventario y termina en
  // un pedido, así que si el piso está roto este módulo falla sin decir por qué.
  sugerido:    require('./modules/sugerido').runSugerido,
};


// `pedidos` va al final: es el módulo que más escribe y el que más tarda.
// `cobros` sigue fuera del orden por defecto — se corre con --modulo=cobros.
const ORDEN_DEFAULT = ['login','clientes','inventarios','depositos','visitas','productos','vendedores','devoluciones','pedidos'];

// ── Construir DATA para cada módulo desde el perfil YAML ──────────────────────
function dataParaModulo(modulo) {
  const vgs     = perfil.vgs     || {};
  const modules = perfil.modules || {};
  const mod     = modules[modulo] || {};
  switch (modulo) {
    case 'login':
      return {};
    case 'clientes':
      return {
        aplica:          mod.aplica !== false,
        clienteBusqueda: mod.cliente_busqueda || 'A',
        clienteDetalle:  mod.cliente_detalle  || '',
      };
    case 'depositos':
      return { aplica: mod.aplica !== false };
    case 'inventarios':
      return {
        aplica:          true,
        clienteTest:     mod.cliente_test || '',
        expirationBatch: vgs.expirationBatch === true,
        suggestedOrder:  vgs.suggestedOrderByDispatchAndReturn === true,
      };
    case 'visitas':
      return {
        aplica:             true,
        clienteTest:        mod.cliente_test || '',
        // Relevo: cliente alternativo verificado en BD con sucursal asignada.
        // Si el principal no habilita las tabs, se reintenta con éste. [prc-20260831]
        clienteTestAlt:     mod.cliente_test_alt || '',
        signatureVisit:     vgs.signatureVisit === true,
        userCanUploadFiles: vgs.userCanUploadFiles === true,
        smokenaEstructural: mod.smoke_na_estructural || [],
      };
    case 'productos':
      return {
        tipoUnico:              mod.tipo_unico === true,
        textoBusqueda:          mod.texto_busqueda || 'A',
        estructuraTest:         mod.estructura_test || mod.tipo_estructura_default || '',
        userCanChangePriceList: vgs.userCanChangePriceList !== false,
      };
    case 'vendedores':
      return {
        aplica:     mod.aplica !== false,
        esVendedor: vgs.esVendedor !== false,
      };
    case 'cobros':
      return {
        aplica:                        mod.aplica !== false,
        clienteTest:                   mod.cliente_test || '',
        clientesConDocumentos:         mod.clientes_con_documentos || [],
        requiredCollectionAttachments: vgs.requiredCollectionAttachments === true,
        requiredComment:               vgs.requiredComment === true,
        multiCurrency:                 vgs.multiCurrency === true,
        retencion:                     vgs.retencion === true,
        cobroRetencion:                vgs.cobroRetencion === true,
        cobroPrepago:                  vgs.cobroPrepago === true,
        userCanSelectIGTF:             vgs.userCanSelectIGTF === true,
        userCanCollectIva:             vgs.userCanCollectIva === true,
        sizeRetention:                 Number(vgs.sizeRetention) || 14,
        // Descuento de cobro: la VG habilita el botón, el tope se aplica sobre la
        // SUMA de los porcentajes seleccionados (no sobre cada descuento).
        userCanSelectCollectDiscount:  vgs.userCanSelectCollectDiscount === true,
        maxCollectDiscount:            Number(vgs.maxCollectDiscount) || 100,
        // Sin esta VG no existe la lupa que abre el DETALLE del documento, y sin
        // el detalle no hay descuento, ni Nro Comp Ret, ni Dif. Devolución.
        retentionDocTypeCR:            vgs.retentionDocTypeCR === true,
        metodoPago:                    mod.metodo_pago || 'efectivo',
        mockCamaraFunciona:            mod.mock_camara_funciona,   // undefined = probar el mock
      };
    case 'sugerido':
      return {
        aplica: mod.aplica !== false,
        // 🔑 El oráculo se calcula en runtime desde la BD del equipo; aquí NO
        //    van números de negocio. Solo lo que gobierna si el módulo aplica.
        suggestedOrderByDispatchAndReturn: vgs.suggestedOrderByDispatchAndReturn === true,
        // Días hasta la próxima visita. Con 1, la guarda `stock >= sugerido`
        // deja TODOS los sugeridos en 0 y parece que no calcula: no es un
        // hallazgo, es la guarda. Se teclea 10 para que salgan mayores que 0.
        diasHasta: Number(mod.dias_hasta_proxima) || 10,
      };
    case 'pedidos':
      return {
        aplica:       mod.aplica !== false,
        clienteTest:  mod.cliente_test  || '',
        productoTest: mod.producto_test || '',
        // 🔴 El Tab Pedido filtra por (lista de precios activa × MONEDA). Si el
        //    perfil declara una moneda, es porque con la otra el catálogo sale
        //    VACÍO — no es una preferencia, es un prerequisito. (el_palmar)
        monedaPedido:        mod.moneda_pedido || '',
        estructuraProducto:  mod.estructura_producto || '',
        alertaDeudaVencida:  mod.alerta_deuda_vencida === true,
        // Se pasan como CONTRASTE contra lo que se lea en la UI, no como verdad:
        // difranca demostró que el YAML puede estar desactualizado y que manda
        // el select. Una divergencia se anota en DM-PED-VG-001/002.
        multiCurrency:               vgs.multiCurrency === true,
        userCanSelectProductDiscount: vgs.userCanSelectProductDiscount === true,
        userCanSelectGlobalDiscount:  vgs.userCanSelectGlobalDiscount === true,
        userCanSelectIVA:             vgs.userCanSelectIVA === true,
        userMustActivateGPS:          vgs.userMustActivateGPS === true,
      };
    case 'devoluciones':
      return {
        aplica:             mod.aplica !== false,
        clienteTest:        mod.cliente_test || '',
        // Relevo: cliente alternativo con facturas activas verificadas en BD.
        // En TIPO B (validateReturn=true) el cliente SIN facturas deja el módulo
        // inejecutable, así que hace falta un suplente. [prc-20260831]
        clienteTestAlt:     mod.cliente_test_alt || '',
        productoTest:       mod.producto_test || '',
        // factura_test presente en el perfil ⇒ el cliente exige nro. de factura por
        // producto (requeridedNroFactura). Si falta, DEV-018 (Enviar) queda N/A.
        facturaTest:        mod.factura_test || '',
        validateReturn:     vgs.validateReturn === true,
        signatureReturn:    vgs.signatureReturn === true,
        userCanUploadFiles: vgs.userCanUploadFiles === true,
        userMustActivateGPS: vgs.userMustActivateGPS === true,
      };
    default:
      return {};
  }
}

// ── Crear carpeta de reporte ──────────────────────────────────────────────────
// 🔴 Va DENTRO de la carpeta del cliente, igual que las corridas manuales
//    (ver `automation/reports/README.md`). Antes caía suelta en la raíz de
//    `reports/` y se acumularon 82 carpetas mezcladas con los informes reales.
//      reports/{cliente}/script_{cliente}_{fecha}_{hora}/          ← corrida completa
//      reports/{cliente}/script-cobros_{cliente}_{fecha}_{hora}/   ← un solo módulo
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const fecha = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
const hora  = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const TIPO_RUN = QA_MODULO ? `script-${QA_MODULO}` : 'script';
const RUN_DIR = path.join(ROOT, 'automation', 'reports', QA_CLIENTE,
                          `${TIPO_RUN}_${QA_CLIENTE}_${fecha}_${hora}`);
fs.mkdirSync(RUN_DIR, { recursive: true });

const RESULTS_FILE = path.join(RUN_DIR, '_results.jsonl');

function appendResult(modulo, v) {
  fs.appendFileSync(RESULTS_FILE, JSON.stringify({ modulo, ...v, runner: 'playwright-standalone' }) + '\n');
}

function buildMd(modulo, verdicts, msTotal) {
  const iconMap = { PASS: '✅', FAIL: '❌', SKIP: '⏭️', 'N/A': '⬜', BLOCKED: '🚫' };
  const lines = [`# ${modulo.toUpperCase()} — ${QA_CLIENTE}`, ''];
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

// ── Determinar módulos a correr ───────────────────────────────────────────────
const modulosFiltro = QA_MODULO
  ? [QA_MODULO]
  : ORDEN_DEFAULT.filter(m => MODULOS[m] !== null);

const invalidos = modulosFiltro.filter(m => !MODULOS[m]);
if (invalidos.length) {
  console.error(`ERR: módulo(s) no implementado(s): ${invalidos.join(', ')}`);
  console.error(`Disponibles: ${Object.keys(MODULOS).filter(m => MODULOS[m]).join(', ')}`);
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  QA Playwright Standalone · ${QA_CLIENTE.padEnd(17)}║`);
  console.log(`║  Módulos: ${modulosFiltro.join(', ').padEnd(35)}║`);
  console.log(`╚══════════════════════════════════════════════╝`);
  console.log(`RUN DIR: ${RUN_DIR}\n`);

  let pg;
  try {
    pg = await conectar();
    console.log('✓ CDP conectado\n');
  } catch (e) {
    console.error(`ERR: no se pudo conectar al CDP: ${e.message}`);
    console.error('Verificar: adb forward tcp:9220 localabstract:webview_devtools_remote_<PID>');
    process.exit(1);
  }

  // ── Contraste NUBE ↔ EQUIPO, antes de medir nada ──────────────────────────
  // 🔑 Si la web dice una cosa y el equipo otra, TODOS los casos que dependan de
  //    esa variable van a medir contra el valor viejo. Enterarse aquí cuesta
  //    cinco segundos; enterarse tres pasos después costó dos corridas el 07/09
  //    y estuvo a punto de convertir un aviso correcto en un defecto reportado.
  let contraste = null;
  try {
    contraste = await contrastarVGs(pg, QA_CLIENTE);
    contraste.lineas.forEach(l => console.log('  ' + l));
    console.log('');
    const md = [
      `# Contraste de variables globales · ${QA_CLIENTE}`,
      '',
      '**NUBE** = `global_configuration` (lo configurado en la web)',
      '**EQUIPO** = `localStorage.globalConfiguration` (lo que la app usa de verdad)',
      '',
      ...contraste.lineas,
      '',
    ];
    fs.writeFileSync(path.join(RUN_DIR, '_vgs-contraste.md'), md.join('\n'));
  } catch (e) {
    console.warn(`  WARN contraste de VGs: ${e.message}\n`);
  }

  const totalStart = Date.now();
  const allVerdicts = [];

  for (let i = 0; i < modulosFiltro.length; i++) {
    const modulo = modulosFiltro[i];
    console.log(`[${i+1}/${modulosFiltro.length}] ${modulo}...`);

    // Asegurar HOME antes de cada módulo, excepto login (gestiona su propio estado)
    if (modulo !== 'login') {
      try { await volverAHome(pg); } catch (e) {
        console.warn(`    WARN volverAHome: ${e.message}`);
      }
    }

    const data = { ...dataParaModulo(modulo), clienteSlug: QA_CLIENTE };
    const t0 = Date.now();
    let verdicts, msTotal;

    try {
      const result = await MODULOS[modulo](pg, data);
      ({ verdicts, msTotal } = result);
      if (result.newPg) pg = result.newPg;
    } catch (e) {
      console.error(`    ERR no capturado en ${modulo}: ${e.message}`);
      verdicts = [{ id: modulo, descripcion: 'Error general', resultado: 'BLOCKED', nota: e.message, ms: Date.now() - t0 }];
      msTotal  = Date.now() - t0;
    }

    for (const v of verdicts) appendResult(modulo, v);
    fs.writeFileSync(path.join(RUN_DIR, `${modulo}.md`), buildMd(modulo, verdicts, msTotal));
    allVerdicts.push(...verdicts);

    const counts = verdicts.reduce((a, v) => { a[v.resultado] = (a[v.resultado]||0)+1; return a; }, {});
    console.log(`      ${verdicts.length} casos · ${(msTotal/1000).toFixed(1)}s · ${Object.entries(counts).map(([k,n])=>`${k}:${n}`).join(' ')}\n`);
  }

  // ── Resumen final ─────────────────────────────────────────────────────────
  const totalCounts = allVerdicts.reduce((a, v) => { a[v.resultado] = (a[v.resultado]||0)+1; return a; }, {});
  const totalMs = Date.now() - totalStart;
  console.log('═══════════════════════════════════════════');
  console.log(`RESUMEN · ${QA_CLIENTE} · ${(totalMs/60000).toFixed(1)} min`);
  console.log(`  PASS:${totalCounts.PASS||0}  FAIL:${totalCounts.FAIL||0}  SKIP:${totalCounts.SKIP||0}  N/A:${totalCounts['N/A']||0}  BLOCKED:${totalCounts.BLOCKED||0}  total:${allVerdicts.length}`);
  console.log(`  Reporte: ${RUN_DIR}`);
  console.log('═══════════════════════════════════════════\n');
  // La conexión CDP (WebSocket al dispositivo) mantiene el event loop vivo indefinidamente.
  // process.exit(0) permite que && y ; en la terminal encadenen el siguiente comando.
  process.exit(0);
})().catch(e => { console.error('ERR FATAL:', e.message); process.exit(1); });
