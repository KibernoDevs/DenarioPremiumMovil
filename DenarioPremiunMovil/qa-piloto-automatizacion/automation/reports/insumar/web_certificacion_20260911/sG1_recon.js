const L = require('./_lib'); const D = L.D; const fs=require('fs');
const PAGES = [['act','/pages/reporteActivacionClientes'],['rot','/pages/reporteRotacionInventario']];
async function optsOpen(pg, base) {
  try { await pg.evaluate(b=>{const e=document.getElementById(b+'_label'); if(e) e.scrollIntoView({block:'center'});}, base); } catch(e){}
  try { await pg.click(`[id="${base}_label"]`, {timeout:5000}); } catch(e) { return 'CLICK-FAIL:'+e.message.slice(0,40); }
  await pg.waitForTimeout(1000);
  const o = await pg.evaluate(b => { const p=document.getElementById(b+'_panel'); return p?[...p.querySelectorAll('li.ui-selectonemenu-item')].map(li=>li.textContent.trim()):null; }, base);
  try { await pg.keyboard.press('Escape'); await pg.mouse.click(5,5);} catch(e){}
  await pg.waitForTimeout(400); return o;
}
(async () => {
  const { pg } = await D.attach(); const res={};
  for (const [n,p] of PAGES) {
    await D.goto(pg, p); await pg.waitForTimeout(3000);
    const path = await pg.evaluate(()=>location.pathname);
    const info = await pg.evaluate(()=>({
      labels: [...document.querySelectorAll('label, .ui-outputlabel')].map(e=>e.textContent.trim().replace(/\s+/g,' ')).filter(t=>t&&t.length<40),
      selects: [...document.querySelectorAll('[id$="_label"]')].map(e=>e.id.replace(/_label$/,'')),
      inputsHidden: [...document.querySelectorAll('input[type=hidden][id]')].map(e=>e.id).filter(i=>/^form:/.test(i)).slice(0,40),
      dateInputs: [...document.querySelectorAll('input[id$="_input"]')].map(e=>e.id).filter(i=>/fecha|date/i.test(i)),
      buttons: [...document.querySelectorAll('button,input[type=submit],a.ui-button')].map(e=>({id:e.id,t:e.innerText.trim().replace(/\s+/g,' ')})).filter(b=>b.t),
      tables: [...document.querySelectorAll('table[id], div.ui-datatable[id]')].map(e=>e.id).filter(Boolean),
      checkmenus: [...document.querySelectorAll('[id$="checkboxValor"],[id*="checkbox"]')].map(e=>e.id).slice(0,20),
      bodytxt: document.body.innerText.replace(/\s+/g,' ').slice(0,1400)
    }));
    const combos={};
    for (const s of info.selects) { combos[s] = await optsOpen(pg, s); }
    res[n]={path, info, combos};
    console.log('===== '+n+'  '+path);
    console.log('LABELS: '+JSON.stringify(info.labels));
    console.log('SELECTS: '+JSON.stringify(info.selects));
    console.log('DATES: '+JSON.stringify(info.dateInputs));
    console.log('BTNS: '+JSON.stringify(info.buttons));
    console.log('TABLES: '+JSON.stringify(info.tables));
    console.log('CHK: '+JSON.stringify(info.checkmenus));
    for (const k in combos) console.log('  COMBO '+k+' -> '+JSON.stringify(combos[k]));
    console.log('BODY: '+info.bodytxt);
    await D.shot(pg,'G1-'+n);
  }
  fs.writeFileSync(__dirname+'/_G_recon.json', JSON.stringify(res,null,1));
  process.exit(0);
})();
