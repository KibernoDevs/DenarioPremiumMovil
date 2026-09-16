'use strict';
/**
 * req-enviar.js — Regresión permanente del REQ «Botón Enviar y campos obligatorios»
 *
 * Se engancha en los 7 módulos transaccionales para que CADA corrida haga regresión
 * del REQ sin ejecutar una vuelta manual aparte.
 *
 * Referencia: guiones-regresion/guion-req-boton-enviar.md
 * 1.ª vuelta: automation/reports/mio_parts/req_boton_enviar_20260831/
 *
 * ── Los DOS criterios de aceptación (acordados con QA) ────────────────────────
 *   C1  No debe dejar enviar con campos obligatorios vacíos.
 *   C2  Si no deja enviar, debe comunicar QUÉ falta.
 *   ⚠ La FORMA de comunicarlo (rojo / mensaje bajo el input / alerta que nombre
 *     el campo) NO es un fallo: es información de cada módulo. Por eso este
 *     archivo REGISTRA el mecanismo pero sólo falla por C1 y C2.
 *
 * ── Los 3 casos ──────────────────────────────────────────────────────────────
 *   DM-{ABREV}-REQ-001  E1 · Enviar habilitado al INICIAR la transacción
 *   DM-{ABREV}-REQ-002  E2 · Al pulsar Enviar en blanco: rechaza (C1) y comunica (C2)
 *   DM-{ABREV}-REQ-003  E5 · Con el formulario COMPLETO no queda ninguna pestaña
 *                            en rojo falso  ← caza F1 (defecto confirmado 31/08)
 *
 * ── Contrato de seguridad ────────────────────────────────────────────────────
 *   🔴 NUNCA envía. Si al pulsar Enviar aparece el diálogo de confirmación, lo
 *      CANCELA — y eso, con el formulario en blanco, es justamente el fallo C1.
 *   🔴 NUNCA lanza. Cualquier error interno sale como verdict BLOCKED para no
 *      tumbar el módulo anfitrión.
 */

const SEL_ENVIAR = 'ion-button.imagenEnviar';

// Mensajes que significan «esto se va a ENVIAR» ⇒ hay que cancelar SIEMPRE.
const RE_CONFIRMA = /(ser[áa] enviad|desea enviar|confirma.*env[íi]|enviar.*transacci[óo]n)/i;

/** Lee el estado completo del formulario en un solo evaluate. */
async function leerEstado(pg) {
  return await pg.evaluate((selEnviar) => {
    // El rojo de error es rgb(230, 12, 12). Se acepta la familia para tolerar
    // variaciones de tema, pero NO grises ni negros (r alto, g y b bajos).
    const esRojo = (c) => {
      const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
      if (!m) return false;
      return +m[1] > 150 && +m[2] < 90 && +m[3] < 90;
    };
    const vis = (el) => el && el.getBoundingClientRect().width > 0;

    const btn = document.querySelector(selEnviar);
    const enviar = !btn ? 'AUSENTE'
      : !vis(btn) ? 'NO-VISIBLE'
      : (btn.disabled === true || btn.getAttribute('disabled') !== null) ? 'DESHAB'
      : 'HABIL';

    // R2 · ¿el clic LLEGARÍA al botón, o hay un overlay encima?
    let ocluido = null;
    if (btn && vis(btn)) {
      const r = btn.getBoundingClientRect();
      const en = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      ocluido = !(en && (en === btn || btn.contains(en) || en.closest(selEnviar)))
        ? (en ? en.tagName.toLowerCase() : 'nada') : null;
    }

    const seg = document.querySelector('ion-segment');
    const activa = seg ? seg.value : null;
    // R3 · una pestaña ACTIVA siempre se ve blanca ⇒ sólo se juzgan las INACTIVAS
    const pestanas = [...document.querySelectorAll('ion-segment-button')]
      .filter(vis)
      .map((s) => ({
        nombre: s.textContent.trim(),
        valor: s.value,
        activa: s.value === activa,
        roja: s.value !== activa && esRojo(getComputedStyle(s).color),
      }));

    // R5 · los módulos marcan de DOS formas distintas; mirar sólo una da falsos negativos
    const marcasInvalid = [...document.querySelectorAll('.ion-invalid')].filter(vis).length;
    const marcasTexto = [...document.querySelectorAll('.campoObligatorio')]
      .filter(vis).map((e) => e.textContent.trim()).filter(Boolean);

    // Alerta visible: leer .alert-title/.alert-message (textContent devuelve "")
    const al = [...document.querySelectorAll('ion-alert')].filter(vis).pop();
    const alerta = al ? {
      titulo: ((al.querySelector('.alert-title') || {}).textContent || '').trim(),
      mensaje: ((al.querySelector('.alert-message') || {}).textContent || '').trim(),
      botones: [...al.querySelectorAll('.alert-button')].filter(vis).map((b) => b.textContent.trim()),
    } : null;

    return { enviar, ocluido, activa, pestanas, marcasInvalid, marcasTexto, alerta };
  }, SEL_ENVIAR);
}

/** Cierra una alerta pulsando la etiqueta indicada (o la primera disponible). */
async function cerrarAlerta(pg, preferidas = ['Cancelar', 'No', 'Aceptar', 'OK']) {
  const c = await pg.evaluate((labs) => {
    const vis = (el) => el && el.getBoundingClientRect().width > 0;
    const al = [...document.querySelectorAll('ion-alert')].filter(vis).pop();
    if (!al) return null;
    const bts = [...al.querySelectorAll('.alert-button')].filter(vis);
    if (!bts.length) return null;
    const t = labs.map((l) => bts.find((b) => b.textContent.trim().toLowerCase() === l.toLowerCase()))
      .find(Boolean) || bts[0];
    const r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: t.textContent.trim() };
  }, preferidas);
  if (!c) return null;
  await pg.mouse.click(c.x, c.y, { delay: 60 });
  await pg.waitForTimeout(900);
  return c.label;
}

/**
 * E1 · ¿Enviar nace HABILITADO al iniciar la transacción?
 *
 * 🔴 R1 · Llamar DESPUÉS de seleccionar el cliente. Medir el formulario en blanco
 *    sin cliente da «nace deshabilitado» y es FALSO: aún no hay transacción.
 *
 * @param {object} opts.naceDeshabilitado  true si en este módulo es CORRECTO que
 *        nazca deshabilitado (Cobros: falta agregar el método de pago). Se
 *        registra como PASS informativo, no como fallo.
 */
async function reqInicio(pg, abrev, opts = {}) {
  const id = `DM-${abrev}-REQ-001`;
  const desc = 'REQ · Enviar habilitado al iniciar la transacción';
  try {
    const e = await leerEstado(pg);
    if (e.enviar === 'AUSENTE' || e.enviar === 'NO-VISIBLE') {
      return { id, descripcion: desc, resultado: 'BLOCKED', nota: `botón Enviar ${e.enviar}` };
    }
    if (e.enviar === 'HABIL') {
      return { id, descripcion: desc, resultado: 'PASS', nota: 'nace habilitado' };
    }
    if (opts.naceDeshabilitado) {
      return {
        id, descripcion: desc, resultado: 'PASS',
        nota: `nace deshabilitado — esperado en este módulo: ${opts.naceDeshabilitado}`,
      };
    }
    return {
      id, descripcion: desc, resultado: 'FAIL',
      nota: 'nace DESHABILITADO con el cliente ya seleccionado (el REQ pide habilitado)',
    };
  } catch (err) {
    return { id, descripcion: desc, resultado: 'BLOCKED', nota: err.message };
  }
}

/**
 * E2 · Pulsar Enviar con los obligatorios VACÍOS.
 *   C1 · no debe llegar a enviar   C2 · debe comunicar qué falta
 *
 * Registra el MECANISMO de aviso (alerta / mensaje bajo el input / borde rojo)
 * sin juzgarlo: los tres son válidos.
 */
async function reqRechazo(pg, abrev, opts = {}) {
  const id = `DM-${abrev}-REQ-002`;
  const desc = 'REQ · Rechaza el envío con obligatorios vacíos y dice qué falta';
  try {
    const antes = await leerEstado(pg);

    if (antes.enviar === 'DESHAB') {
      // Deshabilitado ⇒ C1 se cumple por construcción: no hay forma de enviar.
      const marcas = antes.marcasInvalid + antes.marcasTexto.length;
      if (marcas > 0) {
        return {
          id, descripcion: desc, resultado: 'PASS',
          nota: `C1 ok (deshabilitado) · C2 ok — ${marcas} marca(s): ${antes.marcasTexto.join(' | ') || 'borde rojo'}`,
        };
      }
      // 🔴 SIN MARCAS Y SIN INTERACCIÓN: esto NO es un FAIL.
      //    Hasta el 16/09 se devolvía FAIL aquí, y arrastró a DM-COB-REQ-002
      //    contándose como defecto de producto DESDE EL 07/09. Era falso: el
      //    caso mide el formulario RECIÉN ABIERTO, sin que el usuario haya
      //    tocado nada, y exige que ya haya un aviso en pantalla. C2 pide que
      //    se comunique qué falta CUANDO SE INTENTA ENVIAR, no antes.
      //    En Cobros el botón nace deshabilitado, así que nunca se llega a
      //    pulsar y el mecanismo de aviso no se ejercita. QA lo comprobó A MANO
      //    el 15/09: al añadir un método de pago y dejarlo incompleto, la app
      //    SÍ avisa de que hay un método de pago incompleto.
      //    ⇒ No medible por esta vía. N/A razonada, no FAIL.
      return {
        id, descripcion: desc, resultado: 'N-A',
        nota: 'NO MEDIBLE POR ESTA VÍA: el botón Enviar nace DESHABILITADO y el ' +
              'formulario está sin interacción, así que C2 (comunicar qué falta) ' +
              'no llega a ejercitarse — no hay intento de envío que rechazar. ' +
              'C1 se cumple por construcción. Para medir C2 hay que provocar un ' +
              'estado inválido primero (p. ej. añadir un método de pago y dejarlo ' +
              'incompleto), que es como QA lo verificó a mano el 15/09.',
      };
    }
    if (antes.enviar !== 'HABIL') {
      return { id, descripcion: desc, resultado: 'BLOCKED', nota: `botón Enviar ${antes.enviar}` };
    }
    if (antes.ocluido) {
      // R2 · sin esto, un backdrop se come el clic y parece «pulsé y no pasó nada»
      return { id, descripcion: desc, resultado: 'BLOCKED', nota: `Enviar tapado por <${antes.ocluido}>` };
    }

    const coords = await pg.evaluate((sel) => {
      const b = document.querySelector(sel);
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, SEL_ENVIAR);
    await pg.mouse.click(coords.x, coords.y, { delay: 80 });
    await pg.waitForTimeout(2500);

    const post = await leerEstado(pg);
    const texto = post.alerta ? `${post.alerta.titulo} ${post.alerta.mensaje}`.trim() : '';

    // 🔴 Llegó al diálogo de confirmación con el formulario en blanco ⇒ C1 roto.
    //    Se cancela SIEMPRE: este archivo no envía nada.
    if (texto && RE_CONFIRMA.test(texto)) {
      const cerro = await cerrarAlerta(pg, ['Cancelar', 'No']);
      return {
        id, descripcion: desc, resultado: 'FAIL',
        nota: `C1 ROTO: llegó a confirmación con el formulario en blanco — "${texto.slice(0, 80)}" (cancelado con "${cerro}")`,
      };
    }

    const marcas = post.marcasInvalid + post.marcasTexto.length;
    const avisa = !!texto || marcas > 0;
    const mecanismo = [
      texto ? 'alerta' : null,
      post.marcasTexto.length ? 'mensaje bajo el input' : null,
      post.marcasInvalid ? 'borde rojo' : null,
    ].filter(Boolean).join(' + ') || 'ninguno';

    if (texto) await cerrarAlerta(pg, ['Aceptar', 'OK']);

    if (!avisa) {
      return {
        id, descripcion: desc, resultado: 'FAIL',
        nota: 'C2 ROTO: no envía, pero NO comunica qué falta (sin alerta, sin marca, sin mensaje)',
      };
    }
    return {
      id, descripcion: desc, resultado: 'PASS',
      nota: `C1 ok · C2 ok vía ${mecanismo}${texto ? ` — "${texto.slice(0, 70)}"` : ''}`
        + ` · Enviar quedó ${post.enviar}`,
    };
  } catch (err) {
    return { id, descripcion: desc, resultado: 'BLOCKED', nota: err.message };
  }
}

/**
 * E5 · Con el formulario COMPLETO, ¿queda alguna pestaña en rojo sin causa?
 *
 * Éste es el caso que caza F1 — el defecto confirmado el 31/08: un resolvedor de
 * «primera pestaña con error» cuyo último `return` es incondicional, así que
 * devuelve una pestaña aunque no falte nada.
 *   Devoluciones return-logic.service.ts:454 · Depósitos deposit.service.ts:400
 *   Cobros collection-logic.service.ts:3080  · Inventarios inventarios-logic.service.ts:356
 *
 * Llamar JUSTO ANTES del Enviar del happy path, cuando el módulo ya llenó todo.
 * No pulsa nada: sólo observa.
 *
 * 🔴 R3 · sólo se juzgan las pestañas INACTIVAS (la activa siempre se ve blanca).
 *    Con `rotar:true` se cambia de pestaña para poder juzgar también la que
 *    estaba activa, y se vuelve a la original.
 */
async function reqPestanaRoja(pg, abrev, opts = {}) {
  const id = `DM-${abrev}-REQ-003`;
  const desc = 'REQ · Sin pestaña en rojo falso con el formulario completo (F1)';
  try {
    const e = await leerEstado(pg);
    if (!e.pestanas.length) {
      return { id, descripcion: desc, resultado: 'N/A', nota: 'el módulo no usa pestañas' };
    }

    const rojas = e.pestanas.filter((p) => p.roja).map((p) => p.nombre);

    // Rotar para juzgar también la pestaña que estaba activa.
    if (opts.rotar !== false && e.activa && e.pestanas.length > 1) {
      try {
        const otra = e.pestanas.find((p) => !p.activa);
        if (otra) {
          await clickPestana(pg, otra.valor);
          const e2 = await leerEstado(pg);
          for (const p of e2.pestanas) {
            if (p.roja && !rojas.includes(p.nombre)) rojas.push(p.nombre);
          }
          await clickPestana(pg, e.activa);   // devolver el formulario donde estaba
        }
      } catch (_) { /* la rotación es un extra: nunca debe romper el caso */ }
    }

    if (!rojas.length) {
      return {
        id, descripcion: desc, resultado: 'PASS',
        nota: `${e.pestanas.length} pestaña(s), ninguna en rojo con el formulario completo`,
      };
    }
    return {
      id, descripcion: desc, resultado: 'FAIL',
      nota: `F1: pestaña(s) en ROJO sin campos obligatorios pendientes: ${rojas.join(', ')}`
        + ` · marcas en pantalla: ${e.marcasInvalid} borde + ${e.marcasTexto.length} mensaje`,
    };
  } catch (err) {
    return { id, descripcion: desc, resultado: 'BLOCKED', nota: err.message };
  }
}

async function clickPestana(pg, valor) {
  const c = await pg.evaluate((val) => {
    const s = [...document.querySelectorAll('ion-segment-button')]
      .find((x) => x.value === val && x.getBoundingClientRect().width > 0);
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, valor);
  if (!c) return false;
  await pg.mouse.click(c.x, c.y, { delay: 60 });
  await pg.waitForTimeout(1200);
  return true;
}

/** IDs que aporta este bloque — para que el módulo los marque N/A si no aplica. */
function reqIds(abrev) {
  return [`DM-${abrev}-REQ-001`, `DM-${abrev}-REQ-002`, `DM-${abrev}-REQ-003`];
}

/**
 * Envuelve el `run{Modulo}` para que los 3 casos del REQ aparezcan SIEMPRE en el
 * reporte, aunque el flujo salga antes por un fallo previo.
 *
 * Los módulos tienen entre 3 y 12 puntos de salida (`return { verdicts }`), así
 * que enumerar los IDs del REQ en cada cascada de BLOCKED sería frágil: bastaría
 * añadir un `return` nuevo para que un caso desapareciera del reporte en
 * silencio — y un caso ausente se lee como «no falló», que es justo el escape
 * que estamos intentando cerrar.
 *
 *   module.exports = { runDepositos: conReq('DEP', runDepositos) };
 */
function conReq(abrev, fn) {
  return async function (pg, DATA) {
    const r = await fn(pg, DATA);
    if (!r || !Array.isArray(r.verdicts)) return r;
    const vistos = new Set(r.verdicts.map((x) => x.id));
    for (const id of reqIds(abrev)) {
      if (vistos.has(id)) continue;
      r.verdicts.push({
        id,
        descripcion: 'REQ · Botón Enviar y campos obligatorios',
        resultado: 'BLOCKED',
        nota: 'el flujo del módulo salió antes de llegar a este punto de medición',
        ms: r.msTotal || 0,
      });
    }
    return r;
  };
}

module.exports = {
  reqInicio, reqRechazo, reqPestanaRoja, reqIds, conReq, leerEstado, clickPestana,
};
