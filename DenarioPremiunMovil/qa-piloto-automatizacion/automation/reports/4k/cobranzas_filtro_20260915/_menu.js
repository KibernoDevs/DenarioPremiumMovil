const fs=require('fs'), path=require('path');
const { attach, EV } = require('./_drv');
(async()=>{ const {pg}=await attach();
 const r = await pg.evaluate(()=>{
   const o=[];
   document.querySelectorAll('a[href]').forEach(a=>{
     const h=a.getAttribute('href')||''; const t=(a.innerText||'').trim().replace(/\s+/g,' ');
     if(h && h!=='#') o.push(t+' -> '+h);
   });
   // menús PrimeFaces con onclick
   document.querySelectorAll('[onclick]').forEach(e=>{
     const oc=e.getAttribute('onclick')||''; const m=oc.match(/['"]([^'"]*\.xhtml)['"]/);
     if(m) o.push(((e.innerText||'').trim().replace(/\s+/g,' '))+' => '+m[1]);
   });
   return [...new Set(o)];
 });
 fs.writeFileSync(path.join(EV,'menu.json'), JSON.stringify(r,null,1));
 console.log(r.filter(x=>/indica|cobr|report|transac/i.test(x)).join('\n'));
 console.log('--- TOTAL '+r.length);
 process.exit(0);})();
