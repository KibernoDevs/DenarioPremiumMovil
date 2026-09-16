module.exports = async (pg) => {
  return await pg.evaluate(async () => {
    const src = await (await fetch('http://localhost/main.js')).text();
    const re = /disableUnitSelector/g; const out = []; let m;
    while ((m = re.exec(src))) {
      const after = src.slice(m.index, m.index + 200000);
      const sel = after.match(/selectors:\s*\[\[\s*"([a-z0-9-]+)"/);
      const tf  = after.match(/type:\s*([A-Za-z0-9_$]+),\s*selectors/);
      out.push({ idx: m.index, nextSelector: sel ? sel[1] : null, nextType: tf ? tf[1] : null });
    }
    return out;
  });
};
