const D=require('./_drv'); const fs=require('fs'),path=require('path');
const PAGES=['/pages/indicadoresPedidos','/pages/pedidosClientes','/pages/indicadoresProductos','/pages/protected/indicadores/pedidosProductosVentas.xhtml','/pages/protected/indicadores/indicadorCobros.xhtml','/pages/protected/indicadores/indicadorMorosos.xhtml'];
const TRANS=['JOSE MUÑOZ','LEANDRO MUÑOZ','YONI MILANO','SAUL PENOTT','ARMANDO ROSAS','VACANTE'];
(async()=>{const {pg}=await D.attach();
 for(const P of PAGES){
  await D.goto(pg,P); await pg.waitForTimeout(3500);
  const t=await D.txt(pg);
  const name=P.split('/').pop().replace('.xhtml','');
  fs.writeFileSync(path.join(__dirname,'evidencia','ind-'+name+'.txt'), t);
  const hits=TRANS.filter(n=>t.includes(n));
  const ctrl=await pg.evaluate(()=>[...document.querySelectorAll('select')].filter(e=>e.id.includes('form:')).map(e=>e.id+' => '+[...e.options].map(o=>o.text.trim()).slice(0,25).join(' / ')));
  console.log('### '+P+'  TRANSPORTISTAS_EN_TEXTO='+JSON.stringify(hits));
  console.log(ctrl.join('\n'));
  await D.shot(pg,'C-IND-'+name);
 }
 process.exit(0);})();
