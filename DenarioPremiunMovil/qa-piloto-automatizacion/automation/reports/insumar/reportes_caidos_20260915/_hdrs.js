'use strict';
const { attach, BASE } = require('./_drv');
(async () => {
  const { pg } = await attach();
  const r = await pg.evaluate(async (base) => {
    const out = [];
    const urls = [...document.querySelectorAll('link[href],script[src]')]
      .map(e => e.href || e.src).filter(u => u && u.startsWith('http')).slice(0, 8);
    urls.push(base + '/pages/login.xhtml');
    for (const u of urls) {
      try {
        const res = await fetch(u, { method: 'GET' });
        out.push({ u: u.slice(-70), st: res.status, lm: res.headers.get('last-modified'), srv: res.headers.get('server'), et: res.headers.get('etag') });
      } catch (e) { out.push({ u: u.slice(-70), err: String(e) }); }
    }
    return out;
  }, BASE);
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})();
