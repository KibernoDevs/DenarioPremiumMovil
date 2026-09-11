const L = require('./_lib'); const D = L.D;
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg,'/pages/main'); await pg.waitForTimeout(2500);
  const r = await pg.evaluate(()=>[...document.querySelectorAll('#menuform a, a')].map(a=>(a.textContent.trim().replace(/\s+/g,' '))+' ::: '+(a.getAttribute('href')||'')).filter(x=>/pages\//.test(x)));
  console.log(r.join('\n'));
  process.exit(0);
})();
