module.exports = async (pg) => {
  return await pg.evaluate(async () => {
    const src = await (await fetch('http://localhost/main.js')).text();
    const re = /unitList/g; const out = []; let m;
    while ((m = re.exec(src))) {
      const after = src.slice(m.index, m.index + 250000);
      const sel = after.match(/selectors:\s*\[\[\s*"([a-z0-9-]+)"/);
      out.push({ idx: m.index, next: sel ? sel[1] : null, ctx: src.slice(m.index-160, m.index+120).replace(/\s+/g,' ') });
    }
    // agrupar por componente
    const by = {};
    for (const o of out) { (by[o.next] = by[o.next] || []).push(o); }
    return Object.fromEntries(Object.entries(by).map(([k,v]) => [k, {n: v.length, sample: v.slice(0,3).map(x=>x.ctx)}]));
  });
};
