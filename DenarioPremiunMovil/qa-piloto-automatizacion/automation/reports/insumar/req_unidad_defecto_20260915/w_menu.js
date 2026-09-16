module.exports = async (pg) => {
  const r = await pg.evaluate(() => {
    const links = [...document.querySelectorAll('a, span.ui-menuitem-text, li')]
      .map(e => (e.innerText||'').trim()).filter(t => t && t.length < 60);
    return { path: location.pathname, menu: [...new Set(links)].slice(0, 60) };
  });
  return r;
};
