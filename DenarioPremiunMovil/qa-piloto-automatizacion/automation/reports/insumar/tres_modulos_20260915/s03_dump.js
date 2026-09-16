'use strict';
const fs=require('fs'); const path=require('path');
const { attach, BASE } = require('./_drv');

const PAGES = [
  ['REP-PlanCuota',      '/pages/reportePlanCuota'],
  ['REP-CumplCuota',     '/pages/reporteCumplimientoCuota'],
  ['REP-ActivClientes',  '/pages/reporteActivacionClientes'],
  ['REP-RotacionInv',    '/pages/reporteRotacionInventario'],
  ['IND-Pedidos',        '/pages/indicadoresPedidos'],
  ['IND-Cobranzas',      '/pages/protected/indicadores/indicadorCobros.xhtml'],
  ['IND-Morosidad',      '/pages/protected/indicadores/indicadorMorosos.xhtml'],
  ['IND-Participacion',  '/pages/indicadoresProductos'],
  ['IND-VentasDiarias',  '/pages/protected/indicadores/pedidosProductosVentas.xhtml'],
  ['IND-Clientes',       '/pages/pedidosClientes'],
  ['IND-Vendedores',     '/pages/pedidosVendedores'],
  ['TRX-Facturaciones',  '/pages/facturaciones'],
];

(async () => {
  const { pg } = await attach();
  const out = [];
  for (const [tag, ruta] of PAGES) {
    let rec = { tag, ruta };
    try {
      await pg.goto(BASE + ruta, { waitUntil:'domcontentloaded', timeout:60000 });
      await pg.waitForTimeout(3000);
      // cerrar dialogo de expiracion
      try { const c = await pg.$('[id="j_idt50:confirm"]'); if (c && await c.isVisible()) { await c.click(); await pg.waitForTimeout(700); } } catch(e){}
      rec.url = await pg.evaluate(()=>location.pathname);
      rec.h404 = await pg.evaluate(()=>/HTTP Status 404|not found/i.test(document.body.innerText.slice(0,500)));
      rec.dom = await pg.evaluate(() => {
        const r = { combos: [], fechas: [], botones: [], grids: [], widgets: [] };
        // selectOneMenu: hidden input + panel
        document.querySelectorAll('div.ui-selectonemenu').forEach(d => {
          const inp = d.querySelector('input[id$="_input"], select[id$="_input"]');
          const id = d.id || (inp && inp.id.replace(/_input$/,''));
          let opts = [];
          const sel = d.querySelector('select');
          if (sel) opts = [...sel.options].map(o => o.value + ' ||| ' + o.text.trim());
          else opts = [...d.querySelectorAll('li.ui-selectonemenu-item')].map(li=>li.textContent.trim());
          r.combos.push({ id, n: opts.length, opts: opts.slice(0,30) });
        });
        document.querySelectorAll('select').forEach(s => {
          if (r.combos.some(c=>s.id.startsWith(c.id))) return;
          r.combos.push({ id: s.id, n: s.options.length, opts: [...s.options].map(o=>o.value+' ||| '+o.text.trim()).slice(0,30) });
        });
        document.querySelectorAll('input[id$="_input"]').forEach(i => {
          if (/fecha|date/i.test(i.id)) r.fechas.push({ id: i.id, val: i.value });
        });
        document.querySelectorAll('button, a.ui-button, input[type=submit]').forEach(b => {
          const t=(b.textContent||b.value||'').trim().replace(/\s+/g,' ');
          if (b.id) r.botones.push(b.id + ' ||| ' + t);
        });
        document.querySelectorAll('div.ui-datatable, table.ui-datatable').forEach(t => r.grids.push(t.id));
        try { r.widgets = Object.keys(window.PrimeFaces.widgets).filter(k=>/checkbox|Rol|Rdv|Salesma|clasific/i.test(k)); } catch(e){}
        r.texto = document.body.innerText.slice(0,600).replace(/\n+/g,' | ');
        return r;
      });
    } catch (e) { rec.error = e.message.slice(0,200); }
    out.push(rec);
    console.log('=== ' + tag + ' (' + rec.url + ')' + (rec.h404?' [404]':'') + (rec.error?' ERR:'+rec.error:''));
    if (rec.dom) {
      rec.dom.combos.forEach(c => console.log('   COMBO ' + c.id + ' n=' + c.n + ' :: ' + c.opts.slice(0,16).join(' / ')));
      console.log('   FECHAS ' + rec.dom.fechas.map(f=>f.id+'='+f.val).join(' , '));
      console.log('   GRIDS ' + rec.dom.grids.join(' , '));
      console.log('   WIDGETS ' + rec.dom.widgets.join(' , '));
    }
  }
  fs.writeFileSync('dom-dump.json', JSON.stringify(out,null,1));
  process.exit(0);
})();
