const L = require('./_lib'); const D = L.D;
(async () => {
  const { pg } = await D.attach();
  console.log('PATH0=' + await pg.evaluate(()=>location.pathname));
  await D.goto(pg,'/pages/main'); await pg.waitForTimeout(3000);
  console.log('PATH=' + await pg.evaluate(()=>location.pathname));
  const r = await pg.evaluate(()=>[...document.querySelectorAll('a')].map(a=>(a.textContent.trim().replace(/\s+/g,' '))+' ::: '+(a.getAttribute('href')||'')+' ::: '+(a.getAttribute('onclick')||'').slice(0,80)).filter(x=>/pages\/|Reporte|Activaci|Rotaci|Inventario/i.test(x)));
  console.log(r.join('\n'));
  process.exit(0);
})();
