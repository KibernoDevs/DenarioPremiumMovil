const { attach } = require('./_drv');
(async()=>{ const {pg}=await attach();
 console.log('URL='+pg.url());
 console.log('BODY='+(await pg.evaluate(()=>document.body.innerText)).slice(0,400).replace(/\s+/g,' '));
 process.exit(0);})();
