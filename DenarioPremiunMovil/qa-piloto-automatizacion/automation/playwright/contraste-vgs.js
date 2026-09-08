'use strict';
/**
 * contraste-vgs.js — ¿lo que está configurado en la web es lo que usa el equipo?
 *
 * Corre al inicio de CADA corrida y compara dos fuentes:
 *
 *   NUBE   `global_configuration`                  ← lo que el administrador configuró
 *   EQUIPO `localStorage.globalConfiguration`      ← lo que la app está usando de verdad
 *
 * 🔑 POR QUÉ EXISTE
 * Es la familia de fallos que más caro nos ha salido, y siempre aparece tarde y
 * disfrazada de otra cosa:
 *   · 07/09 — el perfil traía tolerancias 9/15/10 y el equipo tenía 10/10/50.
 *             Los casos se habrían construido contra números inventados.
 *   · 08/09 — QA cambió la tolerancia positiva a 49,99 en la web y probó de una.
 *             El equipo seguía en 10 porque faltaba sincronizar, así que el aviso
 *             que salió era correcto y estuvimos a punto de reportarlo como defecto.
 *
 * En los dos casos el dato estaba disponible desde el primer segundo. Solo había
 * que mirarlo.
 *
 * 🔴 NO se contrasta contra el YAML. El perfil es lo que se vence — es lo que se
 *    vencía en los dos casos de arriba. La referencia es la NUBE, que es la
 *    verdad de lo configurado.
 *
 * 🔑 MANDA `global_configuration`, NO el override del cliente.
 *    Existe también `global_configuration_client` y discrepa en varias claves.
 *    Verificado el 08/09 contra el equipo de hidroponias:
 *        enterpriseEnabled  global=false · override=true  · equipo=false  → global
 *        multiCurrency      global=true  · override=false · equipo=true   → global
 *    Si algún día un cliente contradice esto, se revisa aquí y no en cada módulo.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const QUERY = path.resolve(__dirname, '..', 'db', 'query.js');

/** Las que gobiernan casos y donde una divergencia cambia el resultado esperado. */
const CRITICAS = new Set([
  'RangoToleranciaPositiva', 'RangoToleranciaNegativa', 'MonedaTolerancia',
  'TipoTolerancia', 'tolerancia0', 'prepaidRangeAmount', 'automatedPrepaid',
  'maxCollectDiscount', 'userCanSelectCollectDiscount',
  'requiredComment', 'requiredCollectionAttachments', 'colletionPayment',
  'retencion', 'cobroRetencion', 'sizeRetention', 'retentionDocTypeCR',
  'userCanSelectIGTF', 'userCanCollectIva', 'multiCurrency',
  'suggestedOrderByDispatchAndReturn', 'expirationBatch', 'enterpriseEnabled',
  'validateReturn', 'enablePartialPayment', 'clientBankAccount',
]);

/**
 * Compara dos valores como los compararía una persona.
 *
 * 🔴 Sin esto el contraste es inservible: la nube guarda `85.00` y el equipo
 *    `85`, y saldrían decenas de divergencias falsas que enseñan a ignorar el
 *    aviso — que es peor que no tenerlo.
 */
function mismoValor(a, b) {
  const na = String(a ?? '').trim();
  const nb = String(b ?? '').trim();
  if (na.toLowerCase() === nb.toLowerCase()) return true;
  const fa = Number(na.replace(',', '.'));
  const fb = Number(nb.replace(',', '.'));
  if (Number.isFinite(fa) && Number.isFinite(fb)) return Math.abs(fa - fb) < 1e-9;
  return false;
}

async function leerEquipo(pg) {
  return pg.evaluate(() => {
    const raw = localStorage.getItem('globalConfiguration');
    if (!raw) return null;
    let v; try { v = JSON.parse(raw); } catch (_) { return null; }
    if (!Array.isArray(v)) return null;
    return Object.fromEntries(v.filter(p => Array.isArray(p) && p.length === 2));
  });
}

function leerNube(slug) {
  try {
    const filas = JSON.parse(execFileSync('node',
      [QUERY, slug, 'select clave, valor from global_configuration'],
      { encoding: 'utf8', timeout: 40000, maxBuffer: 8 * 1024 * 1024 }));
    if (!Array.isArray(filas)) return null;
    return Object.fromEntries(filas.map(f => [f.clave, f.valor]));
  } catch (_) { return null; }
}

/**
 * Devuelve { ok, lineas[], divergencias[] } — nunca lanza.
 * Si no se puede contrastar, lo dice y la corrida sigue: esto es diagnóstico,
 * no un portón.
 */
async function contrastarVGs(pg, slug) {
  const equipo = await leerEquipo(pg).catch(() => null);
  if (!equipo) {
    return { ok: false, lineas: ['⚠ no se pudo leer globalConfiguration del equipo'], divergencias: [] };
  }
  const nube = leerNube(slug);
  if (!nube) {
    return {
      ok: false,
      lineas: [`⚠ no se pudo leer la nube de "${slug}" — sin contraste. ` +
               `Verificar credenciales de BD. VGs en el equipo: ${Object.keys(equipo).length}`],
      divergencias: [],
    };
  }

  const divergencias = [];
  const soloEnNube = [];
  for (const [clave, valNube] of Object.entries(nube)) {
    if (!(clave in equipo)) {
      if (CRITICAS.has(clave)) soloEnNube.push({ clave, nube: valNube });
      continue;
    }
    if (!mismoValor(valNube, equipo[clave])) {
      divergencias.push({ clave, nube: valNube, equipo: equipo[clave], critica: CRITICAS.has(clave) });
    }
  }
  divergencias.sort((a, b) => (b.critica - a.critica) || a.clave.localeCompare(b.clave));

  const lineas = [`VGs · ${Object.keys(equipo).length} en el equipo · ${Object.keys(nube).length} en la nube`];
  if (!divergencias.length && !soloEnNube.length) {
    lineas.push('✓ la configuración del equipo coincide con la de la web');
  } else {
    const criticas = divergencias.filter(d => d.critica);
    if (criticas.length) {
      lineas.push(`🔴 ${criticas.length} variable(s) configurada(s) en la web que el equipo NO tiene igual:`);
      criticas.forEach(d => lineas.push(`     ${d.clave.padEnd(34)} nube ${String(d.nube).padEnd(12)} → equipo ${d.equipo}`));
      lineas.push('   ⚠ Falta SINCRONIZAR el dispositivo, o el cambio no llegó. Los casos que');
      lineas.push('     dependan de estas variables van a medir contra el valor viejo.');
    }
    const otras = divergencias.filter(d => !d.critica);
    if (otras.length) lineas.push(`   (${otras.length} divergencia(s) más en variables que no gobiernan casos)`);
    if (soloEnNube.length) {
      lineas.push(`⚠ ${soloEnNube.length} variable(s) críticas están en la nube y NO en el equipo:`);
      soloEnNube.forEach(d => lineas.push(`     ${d.clave.padEnd(34)} nube ${d.nube}`));
    }
  }

  return { ok: true, lineas, divergencias, soloEnNube, totalEquipo: Object.keys(equipo).length };
}

module.exports = { contrastarVGs };
