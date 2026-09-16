const { attach, BASE } = require('./_drv');
(async()=>{
 const {pg}=await attach();
 await pg.goto(BASE+'/pages/reporteCumplimientoCuota',{waitUntil:'domcontentloaded',timeout:60000});
 await pg.waitForTimeout(3500);
 const B='formFiltros:j_idt116';
 const r = await pg.evaluate((b)=>{
   const s=document.getElementById(b+':idEnterprise_input');
   const cont=document.getElementById(b+':idEnterprise');
   return { selDisabled: s?s.disabled:null, selValue: s?s.value:null, selName: s?s.name:null,
            contClass: cont?cont.className:null,
            html: cont?cont.outerHTML.slice(0,900):null };
 }, B);
 console.log(JSON.stringify(r,null,1));
 process.exit(0);
})();
