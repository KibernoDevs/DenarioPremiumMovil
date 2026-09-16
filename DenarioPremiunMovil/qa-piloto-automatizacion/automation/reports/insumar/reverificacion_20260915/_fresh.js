'use strict';
// Sesion nueva: borra cookies, vuelve a login y repite UNA busqueda de Cumplimiento
const path=require('path'); const fs=require('fs');
const { attach, goto, shot, pick } = require('./_drv');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
function creds(){const c=fs.readFileSync(path.join(ROOT,'secrets','qa-credentials.env'),'utf8').split('\n');
  const i=c.findIndex(l=>/^#\s*USUARIO WEB ISLA COCHE/i.test(l.trim()));let u=null,p=null;
  for(let j=i+1;j<i+10;j++){const l=c[j].trim();if(l.startsWith('#'))break;
    if(l.startsWith('QA_USER='))u=l.slice(8);if(l.startsWith('QA_PASSWORD='))p=l.slice(12);}return{u,p};}
(async () => {
  const { ctx, pg } = await attach();
  await ctx.clearCookies();
  await goto(pg, '/pages/login.xhtml');
  let body='';
  pg.on('response', async r => { try { if(/login/i.test(r.url())&&r.request().method()==='POST') body=(await r.text()).slice(0,3000);}catch(e){} });
  const k=creds();
  await pg.fill('input[type="text"]:not([style*="display: none"])', k.u);
  await pg.fill('input[type="password"]', k.p);
  await pg.click('button[type="submit"], input[type="submit"], button');
  await pg.waitForTimeout(9000);
  const p2 = await pg.evaluate(()=>location.pathname);
  console.log('PATH='+p2);
  if(/login/i.test(p2)){ console.log('GROWL='+(body.match(/summary:"([^"]*)"/)||[])[1]); console.log('BODY='+body.replace(/\s+/g,' ').slice(0,800)); process.exit(1); }
  process.exit(0);
})();
