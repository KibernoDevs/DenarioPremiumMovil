# REQs validados por QA

Documentación de ciclos de prueba de requerimientos (reportes PDF + evidencias + scripts de generación).

## Convención de carpetas

```text
req-validados-qa/
  req-{slug-corto}_{YYYYMMDD}/
    Reporte_QA_*.pdf
    generar_reporte*.py | generar_reporte.html   ← la fuente con la que se armó el PDF
    evidencias/   (si aplica)
    LEEME-SUPERADO.md   ← solo si el ciclo dejó de estar vigente
```

**Si un REQ se vuelve a validar porque cambió**, no se borra ni se pisa el ciclo anterior:
se crea una carpeta nueva con su fecha, y **en la vieja se deja un `LEEME-SUPERADO.md`**
que apunte a la vigente y explique qué cambió. Un reporte antiguo sin ese aviso se lee como
si fuera la especificación actual — que es justo el ruido que hay que evitar.

| Carpeta | REQ | Fecha | Vigencia |
|---|---|---|---|
| `req-cantidades-bonificadas_20260720` | Cantidades bonificadas en pedidos (Nutrina) | 2026-07-20 | vigente |
| `req-exportar-catalogo_20260722` | Exportar catálogo / lista de precios (Productos) | 2026-07-22 | vigente |
| `req-conciliacion_banc-20260707` | Conciliación bancaria | 2026-07-07 | vigente |
| `req-pedido-sugerido-hidroponias_20260811` | Pedido sugerido con fórmula propia (Hidroponias) | 2026-08-11 | ⚠ **SUPERADO** — el REQ cambió · ver `_20260901` |
| `req-quiebre-inventario_20260813` | Quiebre de inventario: cantidad 0 (validado en Difranca) | 2026-08-13 | vigente · ver matiz en `_20260901` |
| **`req-pedido-sugerido-hidroponias_20260901`** | **Pedido sugerido — Despacho consolidado por última fecha de facturación (Hidroponias)** | **2026-09-01** | ✅ **VIGENTE** |
| **`req-crud-bancos_20260902`** | **CRUD de Bancos en la web + alimentación del móvil (probado en 4K / Isla Coche)** | **2026-09-02** | ↩ **DEVUELTO A DESARROLLO** — el CRUD cumple, pero se devuelven **2 errores**: (1) la web presenta mal el banco emisor (columna duplicada + «Cuenta» que no aplica); (2) «Monto doc. conversión» sin convertir. Faltan además el caso **multi-empresa** y las **cuentas bancarias de cliente** |
| **`req-boton-enviar_20260904`** | **Botón Enviar y campos obligatorios — 7 módulos (validado en 4K / Caribe)** | **2026-09-04** | ✅ **VIGENTE** — los 2 criterios se cumplen en los 7 módulos y la falsa alarma de la pestaña roja quedó corregida. 📘 El entregable es un **manual para el vendedor**, no un informe de QA |
| **`req-crud-bancos_20260907`** | **Catálogo de Bancos — 2.ª vuelta (4K / Caribe)** | **2026-09-07** | ↩ **DEVUELTO A DESARROLLO** — CRUD certificado y 6 cobros verificados en las 3 capas (incluye anticipo), pero **queda 1 defecto**: en **Cheque** el banco emisor se guarda como receptor. **Habrá 3.ª vuelta con el fix.** 📘 El **manual de uso** ya está listo y no depende de ese fix |

### ⚠ Pedido sugerido de Hidroponias: cuál de los dos vale

Hay **dos** ciclos del mismo REQ porque **el requerimiento cambió**. El que manda es el de
**septiembre**; el de agosto quedó como histórico del comportamiento anterior.

| | `_20260811` (agosto) | `_20260901` (septiembre) |
|---|---|---|
| Qué validó | La **fórmula** del sugerido, término por término | El **cambio de regla del Despacho** |
| Regla del Despacho | Solo la **última factura** (desempate por `id_invoice`) | **Todas las facturas de la última fecha facturada** |
| Estado | ⚠ describe el comportamiento **ya reemplazado** | ✅ **el vigente** |

**No es que el reporte de agosto estuviera mal:** documentó correctamente cómo se comportaba
la app entonces, y de hecho **su medición es la mitad «antes»** de la comparación de
septiembre (dejó registrado que dos productos daban `dispatchedStock = 0` por vivir en la
factura que se descartaba). Sirve como histórico, **no como especificación vigente**.

### Nota sobre el quiebre de inventario

⚠ **El ciclo de septiembre NO validó este REQ.** Una primera versión de esta nota decía que
sí; era incorrecta y queda retirada.

El REQ de `_20260813` es **poder escribir cantidad 0 al INVENTARIAR** un producto agotado
—con su lote y su fecha— y que **ese 0 persista** al guardar, reabrir y enviar. Lo que se
midió en septiembre fue otra cosa: **agregar a un PEDIDO** un producto sin stock de almacén.
En aquella corrida las cantidades inventariadas fueron 1, 2, 3, 4, 5 y 12 — **nunca se
tecleó un 0**.

⇒ **La referencia válida de este REQ sigue siendo únicamente `req-quiebre-inventario_20260813`
(Difranca).** El quiebre **no está validado en Hidroponias**.

## Cómo agregar un REQ nuevo

1. Crear carpeta: `req-{nombre}_{YYYYMMDD}`
2. Guardar el PDF final del ciclo
3. Opcional: script `generar_reporte.py` y evidencias usadas
4. Actualizar esta tabla

Los reportes smoke de automatización CDP siguen en:

`DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion/automation/reports/`
