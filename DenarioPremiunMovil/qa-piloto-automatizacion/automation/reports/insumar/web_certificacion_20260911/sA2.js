const L = require('./_lib'); const D = L.D; const F = L.F;
const G = 'form:tablaComparativoPlanCuota';
const FIL = { clas:'Empresa', cump:'Facturado', unid:'US$', d1:'01/09/2026', d2:'11/09/2026', checkAll:true };
const out = [];
async function paso(pg, tag, nota) {
  const resp = await L.clickCapture(pg, `${F}:ajax`, 'reportePlanCuota');
  const e = await L.estado(pg, G); const p = L.parseErr(resp);
  L.save(tag, resp); await D.shot(pg, tag);
  out.push({ tag, nota, total:e.total, nrows:e.nrows, err:p.err, det:p.det, row0:e.rows[0]||null, filtros:e.filtros, checked:e.checked });
  console.log(`[${tag}] ${nota}\n   total=${e.total} chk=${e.checked} ERR=${p.err||'-'} row0=${JSON.stringify(e.rows[0]||[])}`);
}
(async () => {
  const { ctx, pg } = await D.attach();
  // C) volver a entrar por el menu
  await D.goto(pg, '/pages/main'); await pg.waitForTimeout(1500);
  const href = await pg.evaluate(() => { const a=[...document.querySelectorAll('a')].find(a=>/plan\s*vs\s*cuota|planCuota/i.test(a.textContent+' '+(a.getAttribute('href')||''))); return a?a.getAttribute('href'):null; });
  console.log('HREF-MENU=' + href);
  if (href) { await pg.goto(new URL(href, pg.url()).href, {waitUntil:'domcontentloaded'}); await pg.waitForTimeout(2500); }
  await L.setFilters(pg, FIL);
  await paso(pg, 'A6-por-menu', 'tras salir a main y volver a entrar por el menu');
  // D) cerrar sesion de verdad: limpiar cookies + login
  await ctx.clearCookies();
  const fs=require('fs'); const path=require('path');
  const ROOT = path.resolve(__dirname,'..','..','..','..');
  const c = fs.readFileSync(path.join(ROOT,'secrets','qa-credentials.env'),'utf8').split('\n');
  const i = c.findIndex(l=>/^#\s*USUARIO WEB ISLA COCHE/i.test(l.trim()));
  let U=null,P=null; for(let j=i+1;j<i+8;j++){const l=(c[j]||'').trim(); if(l.startsWith('#'))break; if(l.startsWith('QA_USER='))U=l.slice(8); if(l.startsWith('QA_PASSWORD='))P=l.slice(12);}
  await D.goto(pg, '/pages/login.xhtml'); await pg.waitForTimeout(2000);
  const u = await pg.$('input[type="text"]:not([style*="display: none"])'); const p2 = await pg.$('input[type="password"]');
  await u.fill(U); await p2.fill(P);
  await (await pg.$('button[type="submit"], input[type="submit"], button')).click();
  await pg.waitForTimeout(9000);
  console.log('RELOGIN-PATH=' + await pg.evaluate(()=>location.pathname));
  await D.goto(pg, '/pages/reportePlanCuota'); await pg.waitForTimeout(2500);
  await L.setFilters(pg, FIL);
  await paso(pg, 'A7-sesion-nueva', 'tras cerrar sesion (cookies borradas) y volver a entrar');
  // E) control: segunda busqueda SIN pulsar Limpiar
  await paso(pg, 'A8-2a-sin-limpiar', 'CONTROL: 2a busqueda seguida, sin pulsar Limpiar');
  await paso(pg, 'A9-3a-sin-limpiar', 'CONTROL: 3a busqueda seguida, sin pulsar Limpiar');
  fs.writeFileSync(__dirname+'/_A_secuencia2.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
