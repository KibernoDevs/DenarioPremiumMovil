module.exports = async (pg) => await pg.evaluate(() => {
  const g = window.ng.getComponent(document.querySelector('devolucion-general'));
  const rl = g.returnLogic;
  const out = { keys: Object.keys(rl).slice(0, 80) };
  for (const k of ['validateReturn', 'requeridedNroFactura', 'multiInvoices', 'bloquearFactura',
                   'signatureReturn', 'returnSent', 'generalTabValidForSave', 'sendValidationAttempted']) {
    out[k] = rl[k];
  }
  out.newReturn = rl.newReturn ? Object.fromEntries(Object.entries(rl.newReturn).filter(([k, v]) => typeof v !== 'object').slice(0, 30)) : null;
  out.invoices = (rl.invoices || []).length;
  out.gen = { hasClient: g.hasClient, returnValid: g.returnValid, bloquearFactura: g.bloquearFactura,
              tipos: (g.listaTiposDevs || []).map(t => t.naReturnType || t.na_return_type || JSON.stringify(t).slice(0, 40)) };
  out.invoiceVal = (document.querySelector('#invoiceSelect input') || {}).value;
  return out;
});
