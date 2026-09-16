'use strict';
const fs=require('fs'); const path=require('path');
const { attach, goto, pick, EV } = require('./_drv');
const B='form:j_idt116';
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/reporteCumplimientoCuota'); await pg.waitForTimeout(4000);
  const caps=[];
  const hr = async r => { if (r.request().method()==='POST') { try{
      const body=await r.text(); const post=r.request().postData()||'';
      const src=(post.match(/javax\.faces\.source=([^&]*)/)||[])[1]||'?';
      caps.push({src:decodeURIComponent(src), st:r.status(), len:body.length,
        growl:(body.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/)||[]).slice(1,3),
        body});
    }catch(e){} } };
  pg.on('response', hr);
  console.log('pick clasificacion=Linea ->', await pick(pg, B+':clasificacion', 'Linea'));
  await pg.waitForTimeout(6000);
  pg.off('response', hr);
  const panel = await pg.evaluate((n)=>{
    const all=[...document.querySelectorAll('input[name="'+n+'"]')];
    const w=PrimeFaces.widgets['widget_form_j_idt116_checkboxValor'];
    let items=null; try{ w.renderPanel(); items=document.querySelectorAll('input[name="'+n+'"]').length; }catch(e){ items='ERR:'+e.message; }
    const box=document.getElementById('form:j_idt116:checkboxValor');
    return { antes:all.length, trasRender:items, widget:!!w,
             panelTxt: box? box.innerText.replace(/\s+/g,' ').slice(0,300):'NO-BOX' };
  }, B+':checkboxValor');
  console.log('PANEL', JSON.stringify(panel,null,1));
  caps.forEach((c,i)=>{ console.log('--- POST#'+i+' src='+c.src+' st='+c.st+' len='+c.len+' growl='+JSON.stringify(c.growl));
    fs.writeFileSync(path.join(EV,'panel-post'+i+'.txt'), c.body); });
  process.exit(0);
})();
