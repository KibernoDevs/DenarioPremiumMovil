module.exports = async (pg) => {
  return await pg.evaluate(async () => {
    const src = await (await fetch('http://localhost/main.js')).text();
    const re = /disableUnitSelector/g; const out = []; let m;
    while ((m = re.exec(src))) {
      // buscar hacia atrás el selector del componente más cercano
      const before = src.slice(Math.max(0, m.index - 400000), m.index);
      const sels = [...before.matchAll(/selectors:\s*\[\[\s*"([a-z0-9-]+)"/g)];
      const decls = [...before.matchAll(/class\s+([A-Za-z0-9_$]+)\s*\{/g)];
      out.push({
        idx: m.index,
        lastSelector: sels.length ? sels[sels.length-1][1] : null,
        lastClass: decls.length ? decls[decls.length-1][1] : null,
      });
    }
    return out;
  });
};
