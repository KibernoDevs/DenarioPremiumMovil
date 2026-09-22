# ⚠ Este ciclo quedó SUPERADO — el REQ cambió

**El reporte vigente del pedido sugerido de Hidroponias es:**

`req-pedido-sugerido-hidroponias_20260901/Reporte_QA_REQ_Pedido_Sugerido_Despacho_Consolidado.pdf`

---

## Qué cambió

| | Este ciclo (11/08/2026) | El vigente (01/09/2026) |
|---|---|---|
| Regla del campo **Despacho** | Tomaba **una sola factura**: la que ganaba el desempate `ORDER BY da_invoice DESC, id_invoice DESC LIMIT 1` | Toma **todas las facturas de la última fecha facturada** (cliente + sucursal), sumando las cantidades |
| Fix que lo introdujo | — | `fix/invoices-Hidroponia-20260901` · commit `076faf27` |

## Este reporte NO está equivocado

Documentó correctamente cómo se comportaba la app **en agosto**, y su medición sigue
teniendo valor: en su §4.1 quedó registrado que `GERPROGCH002BOL` y `GERPROALF002CAJ`
daban `dispatchedStock = 0` **por vivir en la factura que el desempate descartaba**.

**Esa medición es la mitad «antes»** de la comparación de septiembre. Sin ella no
podríamos afirmar que el fix cambió algo.

## Cómo usarlo

- ✅ **Como histórico** del comportamiento anterior y como línea base del «antes».
- ✅ **Como referencia de la fórmula** del sugerido (previo, despacho, swap, devuelto,
  venta diaria, redondeo, guardas): esa parte **no cambió** y sigue vigente.
- ❌ **NO** como especificación del comportamiento actual del campo Despacho.
