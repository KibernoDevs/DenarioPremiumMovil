const D=require('./_drv'); const F='form:j_idt116';
(async()=>{const {pg}=await D.attach(); await D.goto(pg,'/pages/facturaciones'); await pg.waitForTimeout(2000);
 for(const c of ['tipoDocumento','idCurrency','idSalesmaView']){
  await pg.click(`[id="${F}:${c}_label"]`); await pg.waitForTimeout(900);
  console.log(c+' => '+JSON.stringify(await D.opts(pg,`${F}:${c}`)));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);}
 process.exit(0);})();
