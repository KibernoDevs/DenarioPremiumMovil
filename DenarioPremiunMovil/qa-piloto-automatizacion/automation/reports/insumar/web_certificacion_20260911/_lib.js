'use strict';
const D = require('./_drv');
const fs = require('fs'); const path = require('path');
const F = 'form:j_idt115';
const EV = path.join(__dirname, 'evidencia');

// captura la respuesta AJAX de un click y devuelve texto crudo
async function clickCapture(pg, sel, urlPart, ms) {
  let resp = null;
  const h = async (res) => {
    if (res.request().method() === 'POST' && res.url().includes(urlPart)) {
      try { const t = await res.text(); if (t) resp = t; } catch (e) {}
    }
  };
  pg.on('response', h);
  await pg.$eval(`[id="${sel}"]`, e => e.click());
  await pg.waitForTimeout(ms || 9000);
  pg.off('response', h);
  return resp;
}

function parseErr(resp) {
  if (!resp) return { err: null, det: null };
  const m = resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
  return { err: m ? m[1] : null, det: m ? m[2] : null };
}

async function setFilters(pg, o, prefix) {
  const f = prefix || F;
  if (o.clas) await D.pick(pg, `${f}:clasificacion`, o.clas);
  if (o.cump) await D.pick(pg, `${f}:cumplimiento`, o.cump);
  if (o.unid) await D.pick(pg, `${f}:unidad`, o.unid);
  if (o.vend !== undefined && o.vend !== null) await D.pick(pg, `${f}:codRdv`, o.vend);
  if (o.checkAll) {
    await pg.evaluate((w) => { const x = PrimeFaces.widgets[w]; try { x.renderPanel(); } catch (e) {} try { x.checkAll(); } catch (e) {} },
      'widget_' + f.replace(/:/g, '_') + '_checkboxValor');
    await pg.waitForTimeout(500);
  }
  if (o.d1) await pg.evaluate(([f, x, y]) => {
    document.getElementById(f + ':fechaDesde_input').value = x;
    document.getElementById(f + ':fechaHasta_input').value = y;
  }, [f, o.d1, o.d2]);
}

async function estado(pg, gridId, prefix) {
  const f = prefix || F;
  return pg.evaluate(([g, f]) => {
    const t = document.getElementById(g);
    const rows = t ? [...t.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim().replace(/\s+/g, ' '))) : [];
    const heads = t ? [...t.querySelectorAll('thead th')].map(th => th.innerText.trim().replace(/\s+/g, ' ')) : [];
    const m = document.body.innerText.match(/Total de Resultados:\s*([\d.,]+)/);
    const gi = (id) => { const e = document.getElementById(id); return e ? (e.value !== undefined ? e.value : e.textContent) : null; };
    const chk = [...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)].filter(i => i.checked).length;
    const chkT = document.querySelectorAll(`input[name="${f}:checkboxValor"]`).length;
    return {
      total: m ? m[1] : null, nrows: rows.length, heads, rows: rows.slice(0, 40),
      filtros: { clas: gi(f + ':clasificacion_input'), cump: gi(f + ':cumplimiento_input'), unid: gi(f + ':unidad_input'), vend: gi(f + ':codRdv_input'), d1: gi(f + ':fechaDesde_input'), d2: gi(f + ':fechaHasta_input') },
      checked: chk + '/' + chkT,
      msg: (document.getElementById('form:messages') || {}).innerText || ''
    };
  }, [gridId, f]);
}

function save(name, resp) { if (resp) fs.writeFileSync(path.join(EV, 'resp-' + name + '.txt'), resp.slice(0, 30000)); }
function jl(o) { fs.appendFileSync(path.join(__dirname, '_results.jsonl'), JSON.stringify(o) + '\n'); }
module.exports = { D, F, EV, clickCapture, parseErr, setFilters, estado, save, jl };

// --- sesion nueva: borra cookies y vuelve a entrar ---
async function nuevaSesion(ctx, pg) {
  await ctx.clearCookies();
  const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
  const c = fs.readFileSync(path.join(ROOT, 'secrets', 'qa-credentials.env'), 'utf8').split('\n');
  const i = c.findIndex(l => /^#\s*USUARIO WEB ISLA COCHE/i.test(l.trim()));
  let U = null, P = null;
  for (let j = i + 1; j < i + 8; j++) { const l = (c[j] || '').trim(); if (l.startsWith('#')) break; if (l.startsWith('QA_USER=')) U = l.slice(8); if (l.startsWith('QA_PASSWORD=')) P = l.slice(12); }
  await D.goto(pg, '/pages/login.xhtml'); await pg.waitForTimeout(2000);
  const u = await pg.$('input[type="text"]:not([style*="display: none"])'); const p = await pg.$('input[type="password"]');
  await u.fill(U); await p.fill(P);
  await (await pg.$('button[type="submit"], input[type="submit"], button')).click();
  await pg.waitForTimeout(9000);
  return pg.evaluate(() => location.pathname);
}
module.exports.nuevaSesion = nuevaSesion;
