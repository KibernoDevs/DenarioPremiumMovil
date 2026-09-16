const { attach } = require('./_drv');
(async()=>{ const {pg}=await attach();
 for (const id of ['j_idt51:confirm','j_idt50:confirm']) {
   const b=await pg.$(`[id="${id}"]`);
   if(b){ const vis=await b.isVisible().catch(()=>false); if(vis){ await b.click().catch(()=>{}); console.log('OK pulsado '+id);} }
 }
 await pg.waitForTimeout(1500);
 console.log('URL='+pg.url());
 console.log('LOGIN?='+/login/i.test(pg.url()));
 process.exit(0);})();
