'use strict';
const { attach, goto } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/main');
  const d = await pg.evaluate(() => [...document.querySelectorAll('a[href]')].map(a=>a.innerText.trim()+' => '+a.getAttribute('href')).filter(x=>/pages|xhtml/.test(x)));
  console.log(d.join('\n'));
  process.exit(0);
})();
