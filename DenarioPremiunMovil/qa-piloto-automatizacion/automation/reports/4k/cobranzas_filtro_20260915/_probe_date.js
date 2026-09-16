const { attach } = require('./_drv');
(async()=>{ const {pg}=await attach();
 const r = await pg.evaluate(()=>{
   const out={};
   out.porName = [...document.querySelectorAll('[name="form:j_idt115:dateB_input"]')].map(e=>({tag:e.tagName,id:e.id,type:e.type,val:e.value}));
   out.porId   = [...document.querySelectorAll('[id="form:j_idt115:dateB_input"]')].map(e=>({tag:e.tagName,name:e.name,type:e.type,val:e.value}));
   out.dateBAll= [...document.querySelectorAll('[id^="form:j_idt115:dateB"],[name^="form:j_idt115:dateB"]')].map(e=>({tag:e.tagName,id:e.id,name:e.name,type:e.type,val:e.value,cls:(e.className||'').slice(0,40)}));
   out.dateFAll= [...document.querySelectorAll('[id^="form:j_idt115:dateF"],[name^="form:j_idt115:dateF"]')].map(e=>({tag:e.tagName,id:e.id,name:e.name,type:e.type,val:e.value}));
   try{ const w=window.PF && PF('widget_form_j_idt115_dateB'); out.widgetVal = w? String(w.getDate()) : 'sin-widget'; }catch(e){ out.widgetVal='ERR '+e.message; }
   try{ const w=window.PF && PF('widget_form_j_idt115_dateF'); out.widgetValF = w? String(w.getDate()) : 'sin-widget'; }catch(e){ out.widgetValF='ERR '+e.message; }
   return out; });
 console.log(JSON.stringify(r,null,1)); process.exit(0); })();
