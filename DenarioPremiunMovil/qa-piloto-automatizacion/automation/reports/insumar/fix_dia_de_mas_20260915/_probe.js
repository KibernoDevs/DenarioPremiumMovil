const { attach, BASE } = require('./_drv');
(async()=>{
 const {pg}=await attach();
 await pg.goto(BASE+'/pages/reporteCumplimientoCuota',{waitUntil:'domcontentloaded',timeout:60000});
 await pg.waitForTimeout(3500);
 const r = await pg.evaluate(()=>({
   path: location.pathname,
   ids: [...document.querySelectorAll('[id*="ajax"],[id$="_input"],button,input[type=submit]')].map(e=>e.id||('('+e.tagName+':'+(e.textContent||'').trim().slice(0,20)+')')).filter(Boolean).slice(0,60),
   selects: [...document.querySelectorAll('select')].map(s=>s.id),
   body: document.body.innerText.replace(/\n+/g,' | ').slice(0,400)
 }));
 console.log(JSON.stringify(r,null,1));
 process.exit(0);
})();
