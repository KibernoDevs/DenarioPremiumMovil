'use strict';
const { attach, goto } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/reporteCumplimientoCuota');
  const v = await pg.evaluate(()=>({
    res: [...document.querySelectorAll('link[href],script[src]')].map(e=>e.href||e.src).filter(u=>/\.(css|js)/.test(u)).slice(0,12),
    footer: (document.querySelector('footer')||{innerText:''}).innerText.trim().slice(0,200),
    ver: (document.body.innerHTML.match(/[Vv]ersi[oó]n[^<]{0,40}/g)||[]).slice(0,5)
  }));
  console.log(JSON.stringify(v,null,1));
  process.exit(0);
})();
