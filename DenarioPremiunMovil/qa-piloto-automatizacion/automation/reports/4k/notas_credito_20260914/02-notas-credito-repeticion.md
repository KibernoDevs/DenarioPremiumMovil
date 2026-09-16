# Repetición del caso N/C > FAC sin pago parcial — IMPORTADORA 4K · C.0321 · 14/09/2026

> **Objetivo único:** saber si el defecto observado en el cobro **2710** (la línea de la nota de
> crédito escrita con `nu_amount_paid = 0,00`) es **determinista** o fue un **tropiezo aislado**.
> Se repitió el caso **exacto**, con los mismos dos documentos y sin pago parcial.

| Parámetro | Valor |
|---|---|
| RUN_ID | `notas_credito_20260914` (2ª entrada) |
| Cliente / empresa | **4k** · `DIESE` · GRUPO 4K — **guarda verificada antes de leer la BD**: `collection.coEnterprise = "DIESE"`, `idUser = 338` en el cobro vivo |
| Playa | **CARIBE** (la declarada en el encargo; no se re-midió en runtime) |
| Usuario móvil | `V.0030` · JOAN BRICEÑO · `id_user` **338** |
| App | APK de `main` · CDP `:9220` · Infinix X6728 |
| Conducción | Node + Playwright de `automation/playwright/node_modules` (`connectOverCDP` vía `drv.js`). **El MCP de Playwright no levanta** |
| Cliente de prueba | **`C.0321` · ELIFAZ PART S, C.A.** |
| Tasa | 870,00 Bs = 1,00 USD · cobro en **USD** |
| Comentario testigo | **`Test-NC-0321-rep2-162958`** |

---

## Veredicto

# ✅ NO REPRODUCE

La línea de la **nota de crédito** quedó registrada en la nube con **`nu_amount_paid = −145,0000`**,
que es el valor correcto. **Lo del cobro 2710 fue un tropiezo aislado, no un defecto determinista.**

---

## 1 · Punto de partida (nube, antes de la corrida)

Documentos de `C.0321` **liberados** por el rechazo de QA (2710/2711 quedaron en `st_collection = 2`):

| `id_document_sale` | Documento | Tipo | `nu_amount_total` | **`nu_balance`** |
|---|---|---|---|---|
| 74634 | `00021022` | FAC | 1.484,0000 | **+85,0000** |
| 76259 | `00002222` | N/C | 145,0000 | **−145,0000** |

`max(id_collection)` antes de enviar: **2711**.

---

## 2 · Cómo se montó (sin pago parcial)

| Paso | Lo medido |
|---|---|
| Comentario | `Test-NC-0321-rep2-162958` escrito en GENERAL; `collection.txComment` confirmado en el modelo |
| Selección de la **FACTURA** `00021022` | Fila localizada **por texto** (`FAC` + `00021022`), no por posición. Clic real, `elementFromPoint` → `ION-CHECKBOX` ✅. **No se abrió el detalle del documento: el toggle «Pago parcial» quedó apagado.** Tras el clic: `isPaymentPartial = false`, `montoTotalPagar = 85`, detalle `{FAC, pp:false, apaid:85}` |
| Selección de la **N/C** `00002222` | Clic real, `elementFromPoint` → `ION-CHECKBOX` ✅. **Sin alerta**: la guarda del documento negativo no salta porque la factura fue primera |
| Estado tras los 2 documentos | `montoTotalPagar = **0**` · `efectivoRequerido = 0` · `creditBalancePrepaidAmount = **60**` · `createAutomatedPrepaid = true` · `isFullyCoveredCollection = true` |
| Método de pago | `AGREGAR MÉTODO DE PAGO` → **«Otros» venía YA MARCADO y los otros cinco `disabled`** — no se tocó, solo `AGREGAR` |
| Código de diferencia | `ion-select` (`interface="alert"`) → única opción `test_excedente - Cancelado por Abonos` → radio → **OK**. Quedó `{idDifferenceCode:1, coDifferenceCode:"test_excedente"}` |
| Especifique | `Saldo a favor NC 00002222` (25/50) |
| Monto del método | **0,00** (coherente con «Monto total a pagar 0,00») |

**Pantalla — Tab Total, justo antes de enviar:**

```
Monto total a Pagar USD 0,00   Tasa Bs 870,00   Pago USD 0,00   Diferencia USD 0,00
Tipo  Nro. Doc.   Monto Doc.  Monto Pago  Monto Saldo
FAC   00021022        85,00       85,00        0,00
N/C   00002222      -145,00     -145,00        0,00
Total Otros: USD 0,00      Total General USD: 0,00
```

✅ Como en la corrida anterior, **el monto a pagar se recorta a 0,00** y el excedente de **60,00** se
deriva al anticipo automático. Es el comportamiento COB-NCR-PREPAID-001 ya documentado en el
informe 01; **no es lo que se estaba midiendo aquí**.

---

## 3 · 🔑 La respuesta — `collection_detail` del cobro **2712**

```sql
SELECT id_collection, co_document, co_type_doc, in_payment_partial,
       nu_amount_doc, nu_amount_paid
FROM   collection_detail
WHERE  id_collection = 2712
ORDER  BY co_type_doc DESC;
```

| `id_collection` | `co_document` | `co_type_doc` | `in_payment_partial` | `nu_amount_doc` | **`nu_amount_paid`** | `nu_balance_doc` |
|---|---|---|---|---|---|---|
| 2712 | `00002222` | **N/C** | **false** | 145,0000 | **−145,0000** ✅ | −145,0000 |
| 2712 | `00021022` | **FAC** | **false** | 1.484,0000 | **85,0000** ✅ | 85,0000 |

**Las dos líneas con `in_payment_partial = false`**, como pedía el encargo.

### Contraste con el intento anterior (cobro **2710**, rechazado por QA)

| Cobro | Línea N/C `00002222` | Línea FAC `00021022` | `in_payment_partial` | Anticipo |
|---|---|---|---|---|
| **2710** (intento 1) | `nu_amount_paid = **0,0000**` ❌ | `85,0000` | false / false | 2711 · 60,00 |
| **2712** (repetición) | `nu_amount_paid = **−145,0000**` ✅ | `85,0000` | false / false | 2713 · 60,00 |

**El payload es idéntico en todo lo demás** — mismo método `ot`, mismo `co_difference_code`
`test_excedente`, mismo `id_difference_code` 1, mismo monto de anticipo (60,00), mismos dos
documentos, mismo usuario 338. La **única** celda que difiere entre los dos cobros es el
`nu_amount_paid` de la nota de crédito.

⇒ **El defecto NO es determinista.** En 6 de 6 cobros de 4K con nota de crédito (los 4 previos,
el 2708 del informe 01 y ahora el 2712) la línea llevó su monto en negativo; el **2710** es el
único caso en que salió 0,00.

> ⚠️ **Lo que esto NO cierra:** que no reproduzca al repetirlo no vuelve inexistente lo de 2710 —
> la fila con 0,00 está escrita en la nube y se puede leer. Queda como **intermitente sin causa
> identificada**. No se encontró ninguna diferencia de entrada entre los dos intentos que lo
> explique; hará falta el rastro de la app (o un lote de repeticiones) para atrapar el disparador.

---

## 4 · El resto de los contrastes pedidos

| Dato | Esperado | **Medido** | |
|---|---|---|---|
| `nu_amount_paid` de la **factura** | 85,00 | **85,0000** | ✅ |
| `in_payment_partial` de las **dos** líneas | `false` / `false` | **false / false** | ✅ |
| Monto del **anticipo** | 60,00 | **60,0000 USD** | ✅ |
| Cuadre detalle ↔ anticipo | 85 − 145 = −60 → anticipo 60 | **cuadra** | ✅ |

**Cabeceras en la nube (`collection`):**

```
id_collection | co_type | co_client | co_enterprise | nu_amount_total | nu_amount_final | tx_comment               | st_collection
     2712     |    0    |  C.0321   |     DIESE     |     0.0000      |     0.0000      | Test-NC-0321-rep2-162958 |      3
     2713     |    1    |  C.0321   |     DIESE     |    60.0000      |    60.0000      | Test-NC-0321-rep2-162958 |      3
```

`co_currency = USD` · `id_user = **338**` · `da_collection = 2026-09-14T20:23:37Z` ·
`co_collection` = `1789417418497.0` (cobro) y `1789418020394.0` (anticipo).
`transaction_statuses`: las dos en **`pap` — «Por aprobar»** (`na_status_user = SYSTEM`).

**`collection_payment`:**

| `id_collection` | método | `nu_amount_partial` | `nu_payment_doc` | `co_difference_code` |
|---|---|---|---|---|
| 2712 | `ot` (Otros) | 0,0000 | `Saldo a favor NC 00002222` | `test_excedente` (id 1) |
| 2713 | `ef` (Efectivo) | **60,0000** | — | — |

*(El anticipo vuelve a emitirse con `ef` pese a que la VG `prepaidPaymentMethod` sea `"pa"`. Ya
anotado en el informe 01 como histórico de 4K, no como defecto nuevo.)*

**Saldos en `document_sale` tras el envío: sin cambio** (`+85,0000` y `−145,0000`, `da_update`
intacto del 19/08). Es lo esperable con el cobro en «Por aprobar» — el cierre del ciclo lo hace el
ERP aguas abajo, como quedó establecido en el §7 del informe 01.

---

## 5 · Referencias creadas

| Ref (`id_collection`) | `co_type` | Cliente | Contenido | Estado |
|---|---|---|---|---|
| **2712** | 0 · cobro | C.0321 | `FAC 00021022` (85,00, **sin** pago parcial) + `N/C 00002222` (−145,00) · total 0,00 · método **Otros** con `test_excedente` | Enviado · **«Por aprobar»** |
| **2713** | **1 · anticipo** | C.0321 | Anticipo automático por el saldo a favor: **60,00 USD** | Enviado · **«Por aprobar»** |

Anotadas en `automation/clientes/_escrituras-de-prueba.md` con cómo revertirlas.
**No se aprobó ni se rechazó nada. No se tocó la configuración de la web. No se ejecutó SQL de escritura.**

---

## 6 · Observación de paso (no se buscaba, se vio)

🟢 **Esta vez SÍ salió el acuse del anticipo.** La secuencia completa del envío fue:

```
«El Cobro será enviado»  →  «Cobro nro. 2712 enviado exitosamente»  →  «Anticipo nro. 2713 enviado exitosamente»
```

Contrasta con **T-4 del informe 01**, donde el anticipo por saldo a favor del cobro 2708 llegó a la
nube **sin ningún acuse**. Es el mismo camino de negocio con dos comportamientos de aviso
distintos, así que **T-4 también parece intermitente** y no un hueco fijo de la pantalla. Se anota
para que no se reporte como defecto firme sin volver a medirlo.

*(Se mantiene en pie lo que sí se confirmó las dos veces: los 60,00 del saldo a favor **no se ven
en ninguna parte antes de enviar** — ni en Pagos, ni en Total, ni en alerta previa.)*

---

## 7 · Trampas: qué volvió a pasar

| # | Trampa | En esta corrida |
|---|---|---|
| T-7 | **El primer clic sobre el botón de una `ion-alert` se pierde** | **Confirmada otra vez.** El primer `OK` de «Cobro nro. 2712 enviado exitosamente» cayó en `ION-BACKDROP.sc-ion-loading-md`; hizo falta un segundo clic. Medido con `elementFromPoint`, no deducido |
| T-3 | **«Otros» ya viene MARCADO** | **Confirmada, y más fuerte de lo descrito:** los otros cinco métodos están **`disabled`**. Un guion que «clickee Otros» lo desmarcaría y se quedaría sin método |
| T-2 | **Orden de las filas** | Aquí la **FAC va primero** — **es al revés que con `C.0864`**. Razón de más para localizar la fila por tipo y número, nunca por posición |
| T-1 | **El pago parcial vive en el detalle del documento** | Se usó a la inversa: **no se abrió el modal**, y por eso el toggle quedó apagado y `in_payment_partial` salió `false` en las dos líneas. Confirmado en la nube |
| — | *(entorno)* **El equipo no estaba en HOME** | Se encontró un cobro **a medio empezar** para `C.0321` (`coCollection 1789417418497.0`, `idCollection null`, `stCollection 0`, comentario `"v"`, **sin documentos ni pagos**), resto de la sesión anterior. Se verificó que estaba limpio (`collectionDetails` y `collectionPayments` vacíos, empresa `DIESE`, usuario 338) y **se reutilizó** en vez de arriesgar el selector de clientes. Es el `co_collection` con que quedó escrito el 2712 |
