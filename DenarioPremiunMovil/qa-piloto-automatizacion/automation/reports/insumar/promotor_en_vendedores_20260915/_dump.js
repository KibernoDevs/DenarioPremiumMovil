'use strict';
// _dump.js <tag> <ruta> — inventario de combos de UNA pantalla, sin tocar nada.
const fs=require('fs'), path=require('path');
const { attach, goto, shot, EV } = require('./_drv');
(async () => {
  const [tag, ruta] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, ruta);
  await pg.waitForTimeout(4500);
  const llegada = await pg.evaluate(()=>location.pathname);
  if (!llegada.includes(ruta.split('/').pop())) { console.log('LLEGADA_FALLIDA path='+llegada); process.exit(2); }
  const r = await pg.evaluate(() => {
    const out = { selects: [], botones: [], forms: [], titulo: document.title,
                  head: (document.body.innerText||'').slice(0,300).replace(/\s+/g,' ') };
    document.querySelectorAll('form').forEach(f => out.forms.push(f.id));
    document.querySelectorAll('select').forEach(s => {
      if (/reflowDD|config-form/.test(s.id)) return;
      out.selects.push({ id: s.id, val: s.value,
        sel: (s.selectedOptions[0]||{}).text,
        n: s.options.length,
        opts: [...s.options].map(x => x.value + '=' + x.text.trim()) });
    });
    document.querySelectorAll('button,input[type=submit],a.ui-button').forEach(b => {
      const t=(b.innerText||b.value||'').trim().replace(/\s+/g,' ');
      if (t) out.botones.push((b.id||'-')+' :: '+t);
    });
    // checkboxes múltiples (selectCheckboxMenu / selectManyCheckbox)
    out.chk = [...document.querySelectorAll('input[type=checkbox]')].map(c=>c.name).filter((v,i,a)=>a.indexOf(v)===i);
    return out;
  });
  fs.writeFileSync(path.join(EV,'combos-'+tag+'.json'), JSON.stringify(r,null,1));
  console.log('PATH='+llegada);
  console.log('FORMS='+JSON.stringify(r.forms));
  r.selects.forEach(s => {
    const prom = s.opts.filter(o=>/MARIA JOSE|P001/i.test(o));
    const cat  = s.opts.filter(o=>/CATALOGO|C001/i.test(o));
    const tra  = s.opts.filter(o=>/\bT00\d\b/i.test(o));
    console.log(`SEL ${s.id} n=${s.n} sel="${s.sel}" P001=${prom.length?JSON.stringify(prom):'-'} C001=${cat.length?JSON.stringify(cat):'-'} T00x=${tra.length}`);
    if (s.n<=20) console.log('    opts: '+s.opts.join(' | '));
  });
  console.log('BOTONES='+JSON.stringify(r.botones));
  await shot(pg,'combos-'+tag);
  process.exit(0);
})();
