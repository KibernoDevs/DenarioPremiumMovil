'use strict';
// A mano, con captura de TODOS los POST (incluido el de cambiar Visualizacion)
const fs=require('fs'); const path=require('path');
const { attach, goto, shot, EV } = require('./_drv');
const B='form:j_idt116';
async function clickPick(pg, base, label){
  await pg.click(`[id="${base}"]`, {timeout:8000}).catch(()=>{});
  await pg.waitForTimeout(1200);
  const li = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if(!li) return 'NO-ITEM';
  await li.click({timeout:8000}).catch(()=>{});
  await pg.waitForTimeout(3000);
  return 'clic';
}
(async () => {
  const clas = process.argv[2] || 'Empresa';
  const { pg } = await attach();
  await goto(pg, '/pages/reporteCumplimientoCuota'); await pg.waitForTimeout(4000);
  const caps=[];
  pg.on('response', async r=>{ if(r.request().method()==='POST'){ try{
    const b=await r.text(); const p=r.request().postData()||'';
    caps.push({src:decodeURIComponent((p.match(/javax\.faces\.source=([^&]*)/)||[])[1]||'?'), st:r.status(), len:b.length,
      growl:(b.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/)||[]).slice(1,3), b});
  }catch(e){} } });
  console.log('rdv:', await clickPick(pg, B+':codRdv', 'Todos'));
  console.log('clas:', await clickPick(pg, B+':clasificacion', clas));
  const st = await pg.evaluate((n)=>({ chks: document.querySelectorAll('input[name="'+n+'"]').length,
      txt:(document.getElementById('form:j_idt116:checkboxValor')||{innerText:'NO-BOX'}).innerText.replace(/\s+/g,' ').slice(0,200)}), B+':checkboxValor');
  console.log('PANEL-VALOR tras elegir '+clas+':', JSON.stringify(st));
  caps.forEach((c,i)=>{ console.log('POST#'+i+' src='+c.src+' st='+c.st+' len='+c.len+' growl='+JSON.stringify(c.growl));
    fs.writeFileSync(path.join(EV,'human2-'+clas.replace(/\W/g,'')+'-post'+i+'.txt'), c.b); });
  await shot(pg,'HUMANO2_'+clas.replace(/\W/g,''));
  process.exit(0);
})();
