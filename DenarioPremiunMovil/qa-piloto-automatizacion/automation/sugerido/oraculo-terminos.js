'use strict';
/**
 * oraculo-terminos.js — el oráculo COMPLETO del Pedido Sugerido, término por término.
 *
 * Espejo exacto de `calcularTotalesSugerenciaPedido()` de `inventarios-logic.service.ts`,
 * leyendo la MISMA base SQLite del teléfono que consulta la app.
 *
 * Complementa a `oraculo.js` (que sólo cubre el despacho y una comprobación por producto):
 * aquí se calculan los NUEVE términos para una lista de productos y un `currentStock` dado,
 * que es lo que exige el cotejo de tolerancia 0 del REQ.
 *
 * DIFERENCIA CRÍTICA CON oraculo.js: la app hace
 *        quUnitSuggested = Math.round(estimatedDailyUnits * daysUntilNext)
 *    y la guarda `currentStock >= sugerido` se evalúa SOBRE EL VALOR YA REDONDEADO.
 *    oraculo.js no redondea, así que con diarias fraccionarias produce FAILs que no
 *    son defectos. Este módulo redondea igual que el producto y devuelve ambos valores.
 *
 * Uso:
 *   node automation/sugerido/oraculo-terminos.js <idClient> <idAddressClient> <diasHasta> <id:cant:codigo,...>
 */
const { execFileSync } = require('child_process');
const path = require('path');
const LOCAL_QUERY = path.resolve(__dirname, '..', 'db', 'local-query.js');

function q(sql) {
  const out = execFileSync('node', [LOCAL_QUERY, sql], { encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 });
  if (out.startsWith('ERR:')) throw new Error(out.trim());
  return JSON.parse(out);
}

/** La fecha del inventario anterior manda: fija la ventana de devoluciones y de cambios. */
function contexto(idClient, idAddressClient, hoy = new Date()) {
  const prev = q('select co_client_stock, da_client_stock from client_stocks where id_client=' + idClient +
    ' and id_address_client=' + idAddressClient + ' order by da_client_stock desc limit 1');
  if (!prev.length) return { previo: null, daysSinceLast: 1, dateLastInventory: null };
  const da = prev[0].da_client_stock;
  const d0 = new Date(da.slice(0, 10) + 'T00:00:00Z');
  const d1 = new Date(hoy.toISOString().slice(0, 10) + 'T00:00:00Z');
  let dias = Math.round((d1 - d0) / 86400000);
  if (dias <= 0) dias = 1;
  const win = new Date(d1 - dias * 86400000).toISOString().slice(0, 10);
  return { previo: prev[0].co_client_stock, daPrevio: da, daysSinceLast: dias, dateLastInventory: win };
}

/**
 * @param {object[]} productos  [{idProduct, coProduct, currentStock}]
 * @returns {object[]} los 9 términos por producto, más el detalle de por qué actuó cada guarda
 */
function terminos(idClient, idAddressClient, daysUntilNext, productos, hoy = new Date()) {
  const ctx = contexto(idClient, idAddressClient, hoy);
  const inList = productos.map(p => p.idProduct).join(',');

  // previous_stock — del inventario anterior (suma de ubicaciones)
  const prevRows = ctx.previo ? q(
    'select d.id_product, u.id_product_unit, u.co_product_unit, sum(u.qu_stock) as q ' +
    'from client_stocks_details d join client_stocks_details_units u ' +
    'on u.co_client_stock_detail = d.co_client_stock_detail ' +
    "where d.co_client_stock='" + ctx.previo + "' and d.id_product in (" + inList + ') group by 1,2,3') : [];

  // dispatched_stock — TODAS las facturas de la última fecha del cliente+sucursal, sumadas
  const despRows = q(
    'select du.id_product_unit, sum(du.qu_invoice) as q ' +
    'from invoices i join invoice_details d on d.id_invoice=i.id_invoice ' +
    'join invoice_detail_units du on du.id_invoice_detail=d.id_invoice_detail ' +
    'where i.id_client=' + idClient + ' and i.id_address_client=' + idAddressClient +
    ' and substr(i.da_invoice,1,10) = (select substr(da_invoice,1,10) from invoices ' +
    'where id_client=' + idClient + ' and id_address_client=' + idAddressClient +
    ' order by da_invoice desc, id_invoice desc limit 1) group by 1');

  // straight_swap_stock — filtra por cliente Y SUCURSAL, ventana "> dateLastInventory"
  const swapRows = ctx.dateLastInventory ? q(
    'select id_product, id_product_unit, sum(qu_swap) as q from straight_swap ' +
    'where id_product in (' + inList + ') and id_enterprise=1 and id_client=' + idClient +
    ' and id_address_client=' + idAddressClient + " and da_cambio > '" + ctx.dateLastInventory + "' group by 1,2") : [];

  // returned_stock — SOLO categorías con subtract_suggestion='true' (Distribución).
  // OJO: la consulta del producto NO filtra por sucursal: sólo id_client + id_enterprise.
  const devRows = ctx.dateLastInventory ? q(
    'select rd.id_product, sum(rd.qu_product) as q from return_details rd ' +
    'where rd.co_return in (select r.co_return from returns r ' +
    'where r.id_type in (select rt.id_type from return_types rt ' +
    'where rt.id_return_category in (select rc.id_return_category from return_category rc ' +
    "where rc.subtract_suggestion='true')) " +
    'and r.id_client=' + idClient + ' and r.id_enterprise=1' +
    " and r.da_return >= '" + ctx.dateLastInventory + "') " +
    'and rd.id_product in (' + inList + ') group by 1') : [];

  const byIdProd = (rows) => Object.fromEntries(rows.map(r => [r.id_product, Number(r.q)]));
  const prevMap = byIdProd(prevRows), swapMap = byIdProd(swapRows), devMap = byIdProd(devRows);
  const unitOf = Object.fromEntries(prevRows.map(r => [r.id_product, r.id_product_unit]));
  const despMap = Object.fromEntries(despRows.map(r => [r.id_product_unit, Number(r.q)]));

  return productos.map(p => {
    const idPU = p.idProductUnit || unitOf[p.idProduct] || p.idProduct;
    const previousStock = prevMap[p.idProduct] || 0;
    const dispatchedStock = despMap[idPU] || 0;
    const straightSwapStock = swapMap[p.idProduct] || 0;
    const returnedStock = devMap[p.idProduct] || 0;
    const currentStock = Number(p.currentStock);
    const initialStock = previousStock + dispatchedStock + straightSwapStock;
    const soldUnits = initialStock - currentStock - returnedStock;
    let estimatedDailyUnits = soldUnits / ctx.daysSinceLast;
    if (estimatedDailyUnits < 0) estimatedDailyUnits = 0;      // guarda de venta negativa
    let quUnitSuggested = Math.round(estimatedDailyUnits * daysUntilNext);
    if (quUnitSuggested < 0) quUnitSuggested = 0;
    const bruto = quUnitSuggested;
    if (currentStock >= quUnitSuggested) quUnitSuggested = 0;   // guarda del stock (incluye la igualdad)
    return {
      coProduct: p.coProduct, idProduct: p.idProduct, idProductUnit: idPU,
      previousStock, dispatchedStock, straightSwapStock, returnedStock, currentStock,
      initialStock, soldUnits, estimatedDailyUnits, quUnitSuggested,
      _bruto: bruto,
      _guardaStock: currentStock >= bruto,
      _guardaVentaNegativa: soldUnits < 0,
      _igualdadExacta: currentStock === bruto && bruto > 0,
    };
  });
}

module.exports = { contexto, terminos };

if (require.main === module) {
  const [ic, iac, du, lista] = process.argv.slice(2);
  const productos = (lista || '').split(',').filter(Boolean).map(s => {
    const [idProduct, currentStock, coProduct] = s.split(':');
    return { idProduct: Number(idProduct), currentStock: Number(currentStock), coProduct: coProduct || '' };
  });
  const ctx = contexto(Number(ic), Number(iac));
  console.log(JSON.stringify({ ctx, terminos: terminos(Number(ic), Number(iac), Number(du), productos) }, null, 1));
}
