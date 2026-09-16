const L = require('./m_lib');
module.exports = async (pg) => {
  const ok = await L.volverAHome(pg, 45000);
  return { ok, st: await L.estado(pg) };
};
