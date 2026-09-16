module.exports = async (pg, args) => {
  const pat = args[0], n = Number(args[1] || 500), max = Number(args[2] || 6);
  return await pg.evaluate(async ([pat, n, max]) => {
    const src = await (await fetch('http://localhost/main.js')).text();
    const re = new RegExp(pat, 'g');
    const out = []; let m;
    while ((m = re.exec(src)) && out.length < max) {
      out.push(src.slice(Math.max(0, m.index - 120), m.index + n));
      re.lastIndex = m.index + 1;
    }
    return { hits: out.length, out };
  }, [pat, n, max]);
};
