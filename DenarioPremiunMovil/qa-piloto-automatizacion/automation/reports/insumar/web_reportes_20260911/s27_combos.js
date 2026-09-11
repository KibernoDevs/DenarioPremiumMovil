const D=require('./_drv');
const T=['/pages/reporteCumplimientoCuota|form:j_idt115:codRdv','/pages/facturaciones|form:j_idt116:idSalesmaView','/pages/pedidosVendedores|form:j_idt115:vendedor','/pages/indicadoresProductos|form:j_idt115:vendedor','/pages/reporteActivacionClientes|form:j_idt115:codRdv','/pages/reporteRotacionInventario|form:j_idt115:codRdv'];
(async()=>{const {pg}=await D.attach();
 for(const e of T){const [p,id]=e.split('|');
  await D.goto(pg,p); await pg.waitForTimeout(2800);
  const o=await pg.evaluate((i)=>{const s=document.getElementById(i+'_input');return s?[...s.options].map(x=>x.text.trim()):null;},id);
  console.log(p+'  ['+id+'] => '+JSON.stringify(o));
  await D.shot(pg,'C-COMBO-'+p.split('/').pop());
 }
 process.exit(0);})();
