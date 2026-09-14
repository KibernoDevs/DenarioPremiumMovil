# Vuelta 2 · INVENTARIO Y SUGERIDO — ciclo «Pedido Sugerido» · HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `ciclo_sugerido_20260911` |
| Fecha | 2026-09-11 |
| Rama bajo prueba | **`SaveSuggestedOrder`** — commit `272ef3c0` · `versionApp 6.6.21.4` |
| Base local | **`db_version = 23`** · `client_stock_suggested_orders` y `client_stock_suggested_order_details` presentes |
| Playa (descubierta en runtime) | **Isla Coche** |
| Empresa | **`HIDRO_A`** · `idEnterprise 1` — `ion-select` deshabilitado con objeto (7.ª confirmación de la variante) |
| Usuario | **V3 · ROGER MUESES** · `idUser 469` — leído de `localStorage.user` |
| Dispositivo | Infinix X6728 (`14678405BR003855`) · Android 15 · WebView Chrome/152 · 360×744 |
| VGs leídas en vivo | `suggestedOrderByDispatchAndReturn=true` · `suggestedOrder=true` · `expirationBatch=**false**` · `userMustActivateGPS=true` · `enterpriseEnabled=false` · `signatureStock=true` · `requireClientStock=true` |
| Resultado | **47 casos: 40 PASS · 0 FAIL · 4 N/A · 1 BLOCKED · 2 no comprobados** — 1 hallazgo caracterizado, 4 observaciones nuevas, 1 defecto histórico **CORREGIDO** |

> **Tres titulares.**
> 1. 🔑 **ESPINACA dio `returned_stock = 6`. El fix del ticket 1 está INTACTO** — la devolución
>    Guardada de **−3** sigue viva (`id_return = 0`) y **no entró** al cálculo.
> 2. 🔑 **La aritmética cuadró con tolerancia 0 en los 4 inventarios medidos: 135 cotejos
>    término-a-término contra un oráculo calculado desde la BD del propio equipo, 0 diferencias.**
>    Se ejercitaron los seis casos difíciles que pedía el encargo, **incluida la igualdad exacta**.
> 3. 🔑 **El defecto S1 del 08/09 —responder SÍ hacía que el servidor rechazara todo y el
>    inventario se perdiera en cola— está CORREGIDO.** Inventario **277** y sugerencia **id 7**
>    llegaron juntos a la nube, con `pending_transactions = 0` y acuse del servidor en pantalla.

---

## 0. Corrección importante al modelo del cálculo

🔴 **El inventario anterior sólo cuenta si el servidor ya lo confirmó.** Leído del **bundle vivo**
(`fetch('http://localhost/main.js')`, 5.466.551 caracteres), el `WHERE` de `getPreviousClientStock`
en esta build es:

```sql
SELECT * FROM client_stocks
 WHERE id_client = ? AND id_address_client = ? AND co_client_stock < ?
   AND id_client_stock <> 0                      -- <=== NO está en el src de la rama QA
 ORDER BY da_client_stock DESC LIMIT 1
```

Es **el mismo patrón que el `id_return <> 0`** del fix de devoluciones: la build sólo cuenta lo que
tiene PK del servidor. El bundle trae **exactamente cuatro** guardas de esa familia:
`id_client_stock <> 0` (1) · `id_return <> 0` (1) · `id_collection <> 0` (4) · `id_transaction <> 0` (1).

**Por qué importa para leer este informe:** el primer oráculo de la corrida dio `previous_stock = 2`
para ESPINACA y la app mostró **0**. No era un defecto: el inventario anterior de esa sucursal era
uno **Guardado** (`id_client_stock = 0`) y la app lo salta, tomando el último **enviado**
(`co 1789046667898.0`, id 274, del 10/09, donde ESPINACA estaba en 0). **Con la guarda incorporada
al oráculo, el cotejo cierra en 0 diferencias.** El oráculo espejo de esta vuelta está en
`automation/sugerido/oraculo-terminos.js` **sin** esa guarda ⇒ **hay que agregársela** o volverá a
producir FAILs que no son defectos (ver §7).

Consecuencia operativa, no defecto: **dos inventarios Guardados seguidos del mismo cliente no se
encadenan** — el segundo sigue tomando como «anterior» el último enviado.

---

## A · La aritmética, término por término (tolerancia 0)

Cuatro inventarios nuevos, cada uno con su escenario. El oráculo se **calcula** en cada corrida
desde el SQLite del teléfono (espejo exacto de `calcularTotalesSugerenciaPedido`, con `Math.round`
y las dos guardas evaluadas sobre el valor **ya redondeado**).

### A.1 · INV-A — `100113 HIPERMERCADO PARAMO - PIEDRA AZUL` (`id_client 65` / `suc 680`)

`co_client_stock` **`1789161963788.0`** · `days_since_last = 1` (calculado) · `days_until_next = 10` (tecleado)
Inventario anterior efectivo: `1789046667898.0` (id **274**, 10/09) · ventana de devoluciones `da_return >= 2026-09-10`

| producto | prev | desp | swap | **dev** | actual | inicial | vendido | diaria | **sugerido** | bruto | qué ejercita |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `046013ESP001BOL` ESPINACA | 0 | 15 | 0 | **6** 🔑 | 10 | 15 | −1 | 0,0000 | **0** | 0 | **centinela del fix** + venta negativa |
| `GERPROALF002CAJ` ALFALFA | 0 | 30 | 0 | **9** | 40 | 30 | −19 | 0,0000 | **0** | 0 | venta negativa fuerte |
| `HIDPROBER001BOL` BERRO | 0 | 15 | 0 | **0** | 0 | 15 | 15 | 15,0000 | **150** | 150 | stock 0 con rotación · Calidad **no** resta |
| `TOMPROMAN001GRA` TOMATE GRANEL | 0 | **261** | 0 | 0 | 5 | 261 | 256 | 256,0000 | **2560** | 2560 | consolidación (antes del fix daba **0**) |
| `TOMPROCHE001CAJ` CHERRY | 0 | 15 | 0 | 0 | 3 | 15 | 12 | 12,0000 | **120** | 120 | control (igual que antes del fix) |
| `CAMPROCEB002ATA` CEBOLLIN | 0 | **0** | 0 | 0 | 0 | 0 | 0 | 0,0000 | **0** | 0 | sin factura ese día · aislamiento por cliente |

**6/6 cuadran · 54 comparaciones · 0 diferencias.**

🔑 **El centinela.** `046013ESP001BOL` llega a la ventana con **tres** devoluciones a la vez:
Ref **279** Distribución **enviada** ×6 · Ref **280** Calidad **enviada** ×4 · la **Guardada** de
vuelta 1 (`co 1789159255271.0`, `id_return = 0`) ×**−3**. El término midió **6**.
Los tres desenlaces incorrectos posibles eran distinguibles y **ninguno ocurrió**:
**3** (si contara la Guardada) · **10** (si contara Calidad) · **7** (si contara ambas).
Verificado además en la BD local: la Guardada de −3 **sigue viva** (`id_return = 0`, `st_delivery = 3`,
`qu_product = −3`) al cierre de esta vuelta. **No se borró.**

🔴 **Aislamiento por cliente, medido con contraste:** `CAMPROCEB002ATA` tiene **20 unidades** en la
última factura de `104 CENTRAL MADEIRENSE` y midió **0** en el sugerido de `100113`. No es un cero
por ausencia de dato: es un cero por filtro.

### A.2 · INV-B — `104 CENTRAL MADEIRENSE - LA BOYERA` (`id_client 110` / `suc 725`)

`co_client_stock` **`1789163189104.0`** · `days_since_last = **23**` (calculado desde el inventario
enviado del 19/08) · `days_until_next = 10` · ventana de cambios `da_cambio > 2026-08-19T04:00:00`

| producto | prev | desp | **swap** | dev | actual | inicial | vendido | diaria | **sugerido** | bruto | qué ejercita |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `CAMPROSDU002BOL` MAIZ | 0 | **0** | **4** | 0 | 0 | 4 | 4 | 0,1739 | **2** | 2 | 🔑 **cambio x cambio como ÚNICO aporte** |
| `HIDPROBER001BOL` BERRO | 2 | 12 | 0 | 0 | **4** | 14 | 10 | 0,4348 | **0** | **4** | 🔑 **IGUALDAD EXACTA** (`actual = sugerido ⇒ 0`) |
| `046PRO003003025` ALBAHACA | 1 | 0 | **7** | **5** | 0 | 8 | 3 | 0,1304 | **1** | 1 | prev + swap + devolución de Distribución |
| `CAMPROLEC001BAN` ENSALADA | 0 | **0** | **5** | 0 | 0 | 5 | 5 | 0,2174 | **2** | 2 | 🔑 cambio x cambio como único aporte (2.º) |
| `GERPROGCH002BOL` GRANO CHINO | 4 | 8 | **5** | 0 | 3 | 17 | 14 | 0,6087 | **6** | 6 | los tres aportes juntos |

**5/5 cuadran · 45 comparaciones · 0 diferencias.**

🔑 **La igualdad exacta, montada a propósito.** Con `days_since_last = 23` la diaria es fraccionaria
y el `Math.round` da juego: `sold 10 / 23 × 10 = 4,3478 → round = **4**`, y el stock actual se cargó
en **4**. `4 >= 4` ⇒ sugerido **0**, *con `bruto > 0` y `vendido > 0`*: es la guarda operando, no un
cero por falta de venta. Es el caso que la guía marca «incluida la igualdad exacta» y que no se
había podido armar con `days_since_last = 1` (ahí el bruto es siempre múltiplo de 10 y nunca coincide
con el stock elegible).

**`previous_stock` no nulo** (2, 1, 4): confirma por contraste la guarda del §0 — aquí el inventario
anterior **sí** tiene PK del servidor (`id 92`, del 19/08).

### A.3 · INV-C y INV-D — dos clientes más, para el bloque D

| Inventario | Cliente | `co_client_stock` | dsl | dh | Productos (prev·desp·swap·dev·actual ⇒ sugerido) | cotejo |
|---|---|---|---|---|---|---|
| **INV-C** | `100121 INSIDE MARKET` (71/686) | `1789163532826.0` | 2 | 10 | `HIDPROBER001BOL` 7·25·0·0·1 ⇒ **155** · `GERPROALF002CAJ` 0·30·0·0·2 ⇒ **140** | 2/2 · 18 comp. · 0 dif |
| **INV-D** | `1702 AUTOMERCADO LA MURALLA` (156/771) | `1789163694517.0` | 2 | 10 | `TOMPROCHE001CAJ` 0·15·0·0·1 ⇒ **70** · `FRUPRO005001025` 0·25·0·0·2 ⇒ **115** | 2/2 · 18 comp. · 0 dif |

### A.4 · Total del cotejo

| Cotejo | Comparaciones | Diferencias |
|---|---|---|
| Vista previa ↔ oráculo (INV-A + INV-B) | **99** | **0** |
| Snapshot guardado ↔ oráculo (los 4 inventarios) | **135** | **0** |
| Nube ↔ equipo (sugerencias 6 y 7) | **72** | **0** |

**Tolerancia 0 en los tres niveles.** La diaria se guarda con precisión completa
(`0.17391304347826086`, `0.43478260869565216`) — no hay truncamiento al persistir.

---

## A.5 · 🔑 DM-SUG-011 — la SUMA: **⛔ BLOCKED por falta de dato, con el motivo medido**

El caso pide que el despacho **sume** un mismo producto que aparece en **dos facturas del mismo día**.
Se hizo un **barrido global sobre las 167 facturas del equipo**, no una muestra:

```sql
-- productos repetidos entre facturas de la ÚLTIMA fecha facturada de cada cliente+sucursal
with ult as (select id_client,id_address_client,max(substr(da_invoice,1,10)) f from invoices group by 1,2)
select i.id_client, i.id_address_client, du.id_product_unit, count(distinct i.id_invoice) veces
  from ult u join invoices i on … join invoice_details d … join invoice_detail_units du …
 group by 1,2,3 having veces > 1;
--  ⇒ []   (cero filas, los 17 clientes)
```

**Ningún cliente+sucursal del equipo tiene un producto repetido en su última fecha facturada.**

⚠ **Y sin embargo el escenario existe en la BD — en fechas que la app nunca lee.** Repitiendo el
barrido sobre **cualquier** día aparecen exactamente dos casos:

| cliente / sucursal | fecha con el repetido | producto | su **última** fecha facturada |
|---|---|---|---|
| `id_client 82` / `697` (100144 PARAMO MANZANARES) | **2026-09-03** | `id_product_unit 40` en 2 facturas | 2026-09-07 |
| `id_client 156` / `771` (1702 LA MURALLA) | **2026-08-17** | `id_product_unit 29` en 2 facturas | 2026-09-07 |

La consulta del producto (`getInvoiceDetailUnitsFromLastClientInvoice`) filtra por
`substr(da_invoice,1,10) = (última fecha)`, así que **estos dos casos son inalcanzables por UI**.

**No se perdió tiempo intentando inyectarlos** (el encargo lo prohibía explícitamente y el intento
del 08/09 ya demostró que los datos inyectados por SQL directo no bajan al dispositivo).

**Para desbloquearlo hace falta que el servidor facture dos veces el mismo producto al mismo
cliente+sucursal en su fecha más reciente**, y que esa factura baje al equipo. Es 4.ª corrida
consecutiva sin poder ejercitarlo (01/09, 08/09, 09/09, 11/09).

> **Lo que sí está verificado del mecanismo de suma:** el código del bundle agrega por
> `id_product_unit` con `existing.quInvoice += item.qu_invoice` sobre **todas** las facturas del día,
> y la consolidación multi-factura **sí** se ejercitó (INV-A, cliente con **3 facturas** el 07/09:
> 9 productos que el bug ocultaba recuperaron su cantidad). Lo que falta es el caso del **mismo
> product_unit repetido**, que es el único que distingue «suma» de «toma la primera».

---

## B · La persistencia (el REQ nuevo)

### B.1 · Cabecera y detalle

| `co_client_stock` | `co_client_stock_suggested_order` | `nu_details` | líneas reales | `days_since_last` | `days_until_next` | `by_dispatch_and_return` | `in_order_sent` |
|---|---|---|---|---|---|---|---|
| `1789161963788.0` (INV-A) | **`1789162387211.0`** | 6 | **6** ✅ | 1 | **10** ✅ | **1** ✅ | 0 |
| `1789163189104.0` (INV-B) | **`1789163276184.0`** | 5 | **5** ✅ | 23 | **10** ✅ | **1** ✅ | 0 |
| `1789163532826.0` (INV-C) | **`1789163579449.0`** | 2 | **2** ✅ | 2 | **10** ✅ | **1** ✅ | 0 |
| `1789163694517.0` (INV-D) | **`1789163741436.0`** | 2 | **2** ✅ | 2 | **10** ✅ | **1** ✅ | 0 |

- **DM-SUG-034** — se guarda el `days_until_next` **tecleado (10)**, no el 1 por defecto: 4 de 4.
- **DM-SUG-032** — `nu_details` coincide con las líneas guardadas: 4 de 4.
- **DM-SUG-033** — **los productos con sugerido 0 SÍ se guardan** (3 de 6 en INV-A, 1 de 5 en INV-B)
  y **se muestran al reabrir**, con sus términos. Es consistente entre pantalla, BD local y nube.

### B.2 · Regenerar **reemplaza**, no duplica · DM-SUG-038 ✅

Con el inventario en curso se abrió la vista previa, se cerró y se volvió a abrir:

| | antes | después |
|---|---|---|
| cabeceras para ese `co_client_stock` | 1 (`1789162387211.0`) | **1 — la misma** |
| `da_suggested` | `17:33:07` | **`17:38:25`** (actualizado) |
| líneas de detalle | 6 | **6** |

Confirmado en el bundle: `saveSuggestedOrderSnapshot` reutiliza el `co` existente y hace
`DELETE FROM client_stock_suggested_order_details WHERE co_client_stock_suggested_order = ?`
antes de reinsertar. **Reemplazo limpio, cero duplicados.**

### B.3 · Reabrir devuelve el **snapshot**, no un recálculo · DM-SUG-043 ✅

La prueba más fuerte la da la **sugerencia huérfana** de vuelta 1 (`1789160290226.0`): muestra
`previousStock 0 · dispatchedStock 30 · returnedStock 9 · sugerido 126` con `días 1/7`. Un recálculo
de hoy **no podría dar eso** (el `days_until_next` de hoy es 10 y el inventario anterior cambió).
Lo mismo con la sugerencia de INV-D reabierta desde el submódulo: **18 de 18 valores idénticos** a la
fila de `client_stock_suggested_order_details`.

### B.4 · Sobrevive a cerrar y abrir la app · DM-SUG-036 ✅

`adb shell am force-stop` → relanzar → la app abre en **`/login`** → re-login como **`vendedor3`**
(**el mismo usuario V3/469**, así que la BD local **no** se borra) → sincronización completa.

| | antes del cierre | después |
|---|---|---|
| cabeceras de sugerido (local) | **9** | **9** ✅ |
| líneas de detalle (local) | **34** | **34** ✅ |
| términos de la sugerencia 6 | 54 valores | **54 idénticos** ✅ |
| `pending_transactions` / `failed_transactions` | 0 / 0 | **0 / 0** |
| centinela (devolución Guardada ×−3) | `id_return 0` | **`id_return 0`, viva** ✅ |

**DM-SUG-075 (merge) ✅** — la sincronización bajó de la nube las sugerencias **6** y **7** y las
**fusionó** con las 7 locales sin duplicar ni pisar: siguen siendo **9 cabeceras / 34 líneas**, y las
que nunca subieron (1702, 104, y las tres de vuelta 1) siguen ahí con `id_client_stock_suggested_order = null`.

---

## D · La decisión al enviar el inventario

**La cadena completa, medida con un grabador de alertas a 120 ms** (no reconstruida a posteriori):

```
CON sugerencia guardada — 4 alertas
  [1790 ms] ¿Desea enviar el Inventario?                    [Cancelar/Aceptar]
  [2985 ms] ¿Desea enviar también la sugerencia de pedido?  [Cancelar/Aceptar]   ← la pregunta
  [5265 ms] El Inventario será enviado                      [OK]
  [6705 ms] Inventario nro. 277 enviado exitosamente        [OK]   ← único acuse del SERVIDOR

SIN sugerencia — 3 alertas (la nº 2 desaparece)
  [1822 ms] ¿Desea enviar el Inventario?                    [Cancelar/Aceptar]
  [4110 ms] El Inventario será enviado                      [OK]
  [5595 ms] Inventario nro. 279 enviado exitosamente        [OK]
```

| ID | Caso | Resultado | Evidencia |
|---|---|---|---|
| DM-SUG-050 | Enviar **con** sugerido ⇒ aparece la pregunta | ✅ PASS | 3 de 3 envíos con sugerencia (INV-A, C, D) |
| DM-SUG-051 | Enviar **sin** sugerido ⇒ **no** aparece | ✅ PASS | INV-E (`203`, sin abrir la vista previa): cadena de **3** alertas, `client_stock_suggested_orders` vacío para ese `co` |
| DM-SUG-052 | Responder **SÍ** | ✅ **PASS** 🔑 | INV-C: inventario **277** *y* sugerencia **id 7** en la nube · `pending=0` · `failed=0` · 4.ª alerta con correlativo |
| DM-SUG-053 | Responder **NO** | ✅ PASS | INV-D: inventario **278** en la nube · la sugerencia **queda local** (`id_client_stock_suggested_order = null`), en **Pendiente** · el contador de la nube no se movió (7 → 7) |
| DM-SUG-054 | Tras el NO, volver al submódulo | ✅ PASS | la sugerencia sigue listada, abre con su snapshot (18/18 valores) y **ACEPTAR habilitado** ⇒ convertible; al pulsarlo genera el pedido `1789164223064.0` con `TOMPROCHE001CAJ = 70` y `FRUPRO005001025 = 115` |
| DM-SUG-055 | Cancelar el envío | ✅ PASS | `Cancelar` en la alerta 1 (INV-E): `id_client_stock = 0`, `st_delivery = 3`, nube sin cambios (`173/278` antes y después), colas en 0 |

### 🔑 El defecto que más caro salía está **CORREGIDO**

El 08/09, responder **SÍ** producía `errorCode 103 · relation "client_stock_suggested_orders_id_..._s"
does not exist`, el servidor **rechazaba la transacción entera** y el inventario quedaba reintentando
en `pending_transactions` **sin que el vendedor viera nada**.

**Hoy, comprobado explícitamente y de punta a punta:**

| Comprobación | Resultado |
|---|---|
| ¿Llega la 4.ª alerta (acuse del servidor)? | ✅ *«Inventario nro. **277** enviado exitosamente»* |
| ¿La sugerencia obtiene PK del servidor? | ✅ `id_client_stock_suggested_order = **7**` estampado en la BD local |
| ¿Está en la nube con su detalle? | ✅ cabecera + **2** líneas, `nu_details = 2` |
| `pending_transactions` / `failed_transactions` | ✅ **0 / 0** durante todo el envío |
| ¿El inventario llegó? | ✅ `id_client_stock 277`, `st_client_stock = 1` |

Lo mismo con INV-A (inventario **275** + sugerencia **id 6**, 6 líneas).
La secuencia de la PK **existe** en la BD de hidroponias: hay filas con `id` 1…7.

---

## Tabla de veredictos

| ID | Caso | Resultado | Evidencia (1 línea) |
|---|---|---|---|
| DM-SUG-001 | Migración desde v21 | 🚫 N/A | La APK ya estaba instalada; base en `db_version 23` con las dos tablas creadas. El camino de migración no es observable sin reinstalar desde v21 |
| DM-SUG-002 | `suggestedOrderByDispatchAndReturn` | ✅ PASS | `true` leída de `localStorage.globalConfiguration` y del servicio en vivo (`inventariosLogicService.suggestedOrderByDispatchAndReturn = true`) |
| DM-SUG-003 | Resumen → botón «PEDIDO SUGERIDO» | ✅ PASS | presente en los 4 inventarios; `top` 600 / 537 / 348 con `innerHeight 744` — **dentro** del viewport (ver §7) |
| DM-SUG-010 | Consolidación de todas las facturas del día | ✅ PASS | INV-A (3 facturas el 07/09): `TOMPROMAN001GRA` **0 → 261**, `HIDPROBER001BOL` **0 → 15**, `GERPROALF002CAJ` **0 → 30**, `046013ESP001BOL` **0 → 15** |
| DM-SUG-011 | **Suma del mismo producto en 2 facturas del día** | ⛔ **BLOCKED** | Falta de dato, medido con barrido global: **0 clientes+sucursal** con producto repetido en su última fecha. Ver §A.5 |
| DM-SUG-012 | Control: producto de la factura ganadora | ✅ PASS | `TOMPROCHE001CAJ` = **15**, idéntico al valor pre-fix |
| DM-SUG-013 | Producto sin factura ese día | ✅ PASS | `CAMPROCEB002ATA` aparece en la lista con `dispatched_stock = 0` (ni ausente ni en blanco) |
| DM-SUG-014 | Aislamiento por **cliente** | ✅ PASS | `CAMPROCEB002ATA`: 20 unidades en la última factura de `104`, **0** en el sugerido de `100113` |
| DM-SUG-014b | Aislamiento por **sucursal** | 🚫 N/A | Sin dato: **17 clientes / 17 direcciones**, una por cliente (`select id_client, count(*) from address_clients group by 1 having n>1` ⇒ `[]`) |
| DM-SUG-015 | Cambio x cambio | ✅ PASS | INV-B: **único aporte** en `CAMPROSDU002BOL` (4) y `CAMPROLEC001BAN` (5); sumado a prev+desp en `GERPROGCH002BOL` (5) |
| DM-SUG-016 | Devolución de Distribución **resta** | ✅ PASS | ESPINACA 6 · ALFALFA 9 · ALBAHACA 5 (`id_return 237`, cliente 110) |
| DM-SUG-017 | Devolución de Calidad **no resta** | ✅ PASS | `HIDPROBER001BOL`: Ref 280 (Calidad, enviada, ×5) ⇒ `returned_stock = **0**` |
| DM-SUG-018 | Mismo producto con las dos | ✅ PASS | ESPINACA = **6** (no 10). Ver el centinela en §A.1 |
| DM-SUG-019 | `days_since_last` se calcula | ✅ PASS | 3 valores distintos medidos (**1**, **2**, **23**) y `#diasDesdeUltimoInventario` **no existe** en el DOM |
| DM-SUG-020 | Stock 0 con rotación previa | ✅ PASS | `HIDPROBER001BOL` con actual 0 ⇒ sugerido **150** |
| DM-SUG-021 | `days_until_next` tecleado | ✅ PASS | 1 → **10** en los 4 inventarios, reflejado en el modelo y recalculado |
| DM-SUG-022 | Guarda `actual >= sugerido ⇒ 0`, **con igualdad exacta** | ✅ PASS | INV-B `HIDPROBER001BOL`: `actual 4`, `bruto 4` ⇒ **0**, con `vendido = 10 > 0` |
| DM-SUG-023 | Venta negativa ⇒ diaria 0 | ✅ PASS | ESPINACA `vendido −1` y ALFALFA `vendido −19` ⇒ `estimated_daily_units = 0` en pantalla, BD local y nube |
| DM-SUG-024 | Cantidad negativa al inventariar | ✅ PASS | `input[min="0"]`: teclear `-5` deja el campo **vacío**; Aceptar rechaza con *«Complete cantidad, unidad, fecha y lote para continuar.»* y **el negativo nunca entra al modelo** |
| DM-SUG-025 | Cantidad **0** | ✅ PASS | BERRO y CEBOLLIN en 0: aceptados, persisten al Guardar, se releen al reabrir y **llegan a la nube** (inventario 275) |
| DM-SUG-026 | Aritmética completa ≥3 productos, tolerancia 0 | ✅ PASS | **135 comparaciones** en 4 inventarios, **0 diferencias** |
| DM-SUG-030 | La sugerencia se guarda ligada al inventario | ✅ PASS | 4 cabeceras con su `co_client_stock` correcto |
| DM-SUG-031 | Cotejo término a término guardado ↔ mostrado | ✅ PASS | **99 comparaciones directas** (INV-A 54 + INV-B 45), 0 diferencias; precisión completa de la diaria |
| DM-SUG-032 | `nu_details` | ✅ PASS | 6/6 · 5/5 · 2/2 · 2/2 |
| DM-SUG-033 | Productos con sugerido 0 | ✅ PASS (consistente) | **Se guardan y se muestran**; 3 de 6 en INV-A, 1 de 5 en INV-B; igual en nube |
| DM-SUG-034 | `days_until_next` guardado = tecleado | ✅ PASS | **10** en las 4 cabeceras |
| DM-SUG-035 | `by_dispatch_and_return` | ✅ PASS | **1** en las 4 |
| DM-SUG-036 | Cerrar y abrir la app | ✅ PASS | `force-stop` + relanzar + re-login V3: **9 cabeceras / 34 líneas** intactas, términos idénticos |
| DM-SUG-037 | Dos sugeridos de clientes distintos | ✅ PASS | 4 clientes (100113, 104, 100121, 1702), cada uno con su cabecera; sin mezcla |
| DM-SUG-038 | Regenerar sobre el mismo inventario | ✅ PASS | **Reemplaza**: mismo `co`, `da_suggested` actualizado, 1 sola cabecera, 6 líneas |
| DM-SUG-040 | Submódulo sin sugeridos guardados | 🚫 N/A | La lista nunca estuvo vacía (5 sugerencias heredadas al empezar) |
| DM-SUG-041 | Lista con sugeridos guardados | ✅ PASS · 🟡 obs. | Muestra cliente, `Nro. Ref.`, estatus y fecha. **No muestra la cantidad de líneas** que pide el guión — ver Obs. 2 |
| DM-SUG-042 | Estado Pendiente / Enviado | ✅ PASS | 9 de 9 coinciden con `in_order_sent` (7 Pendiente / 2 Enviado) |
| DM-SUG-043 | Abrir uno guardado ⇒ snapshot | ✅ PASS | La huérfana muestra `1/7 días` y `prev 0 / ret 9 / sug 126`, imposible de recalcular hoy |
| DM-SUG-044 | Abrirlo días después | ⏭ no comprobado | Exige dejar pasar días con facturas nuevas de por medio |
| DM-SUG-050 | Aparece la pregunta | ✅ PASS | 3 de 3 · cadena de **4** alertas |
| DM-SUG-051 | No aparece sin sugerencia | ✅ PASS | INV-E · cadena de **3** alertas |
| DM-SUG-052 | Responder **SÍ** | ✅ **PASS** | Inventario **277** + sugerencia **id 7** en la nube · colas en 0 |
| DM-SUG-053 | Responder **NO** | ✅ PASS | Inventario **278** en la nube · sugerencia sólo local, **Pendiente** |
| DM-SUG-054 | Tras el NO, sigue y se puede convertir | ✅ PASS | ACEPTAR habilitado; genera pedido `1789164223064.0` con 70 y 115 |
| DM-SUG-055 | Cancelar el envío | ✅ PASS | Nada se envía; `st_delivery` sigue en 3 |
| DM-SUG-070 | Sincronizar tras enviar | ✅ PASS | Sugerencias **6** y **7** con cabecera y detalle completos |
| DM-SUG-071 | Cotejo en la nube término a término | ✅ PASS | **72 comparaciones**, 0 diferencias |
| DM-SUG-075 | Merge local ↔ nube | ✅ PASS | 9 cabeceras / 34 líneas tras la sync; ni duplicados ni pérdidas |
| DM-SUG-077 | Sincronizar **dos veces** seguidas | ⏭ no comprobado | Sólo se observó **una** sincronización (la del re-login) |
| DM-SUG-080 | Ciclo normal de inventarios | ✅ PASS | 5 inventarios creados, guardados, reabiertos, enviados y cotejados contra la nube |
| DM-SUG-085 | Lote y vencimiento obligatorios | 🚫 N/A | `expirationBatch = **false**` en este tenant: `input[placeholder="Ingrese lote"].required = false` y el ✓ aceptó con el lote vacío en los **17** productos cargados. El caso no puede fallar con esta configuración |

---

## Registros creados en el sistema

> **Insumo directo de la vuelta 3.**

### Inventarios

| # | `co_client_stock` | Cliente | Productos (cantidad) | Estado local | Nube |
|---|---|---|---|---|---|
| **275** | `1789161963788.0` | `100113` PARAMO PIEDRA AZUL | ESPINACA 10 · ALFALFA 40 · BERRO 0 · TOM.GRANEL 5 · CHERRY 3 · CEBOLLIN 0 | `st_delivery=1` | ✅ **BD-OK** `st_client_stock=1` |
| **276** | `1789163189104.0` | `104` C. MADEIRENSE LA BOYERA | MAIZ 0 · BERRO 4 · ALBAHACA 0 · ENSALADA 0 · GRANO CHINO 3 | `st_delivery=1` | ✅ **BD-OK** |
| **277** | `1789163532826.0` | `100121` INSIDE MARKET | BERRO 1 · ALFALFA 2 | `st_delivery=1` | ✅ **BD-OK** |
| **278** | `1789163694517.0` | `1702` LA MURALLA | CHERRY 1 · ARANDANOS 2 | `st_delivery=1` | ✅ **BD-OK** |
| **279** | `1789163842066.0` | `203` EXCELSIOR GAMA TAHONA | BERRO 1 | `st_delivery=1` | ✅ **BD-OK** |

Baseline-diff de la nube: `client_stock` **169 → 174** · `max(id_client_stock)` **274 → 279** ⇒ **+5 exactas**.

### Sugerencias

| `co_client_stock_suggested_order` | Ligada a | Cliente | Líneas | `in_order_sent` | Nube |
|---|---|---|---|---|---|
| **`1789162387211.0`** | inv. 275 | `100113` | 6 | 0 · **Pendiente** | ✅ **id 6** (respondió **SÍ**) |
| `1789163276184.0` | inv. 276 | `104` | 5 | 0 · **Pendiente** | ⛔ **sólo local** (la pregunta quedó sin respuesta explícita — ver Obs. 4) |
| **`1789163579449.0`** | inv. 277 | `100121` | 2 | 0 · **Pendiente** | ✅ **id 7** (respondió **SÍ**) |
| `1789163741436.0` | inv. 278 | `1702` | 2 | 0 · **Pendiente** | ⛔ **sólo local, a propósito** (respondió **NO** · DM-SUG-053) |

Baseline-diff de la nube: `client_stock_suggested_orders` **5 → 7** · detalles **17 → 25** (+8 = 6+2) ⇒ **exacto**.

### Pedidos

**Ninguno.** Las dos conversiones ejercitadas (la huérfana de vuelta 1 y la sugerencia de `1702`)
se abandonaron con *«Salir sin guardar»*: `orders` sigue en **58** filas y las cuatro sugerencias de
esta vuelta siguen en `in_order_sent = 0`. **Quedan las cuatro disponibles para la vuelta 3.**

### Lo que quedó vivo y NO hay que tocar

| Registro | Por qué |
|---|---|
| `co_return 1789159255271.0` — devolución Guardada, `id_return = 0`, `046013ESP001BOL` ×**−3** | 🔴 **El centinela del fix.** Sigue vivo al cierre de esta vuelta |
| `co_client_stock_suggested_order 1789160290226.0` — sugerencia **huérfana** de vuelta 1 | Evidencia del hallazgo C, ahora caracterizado. Sigue Pendiente y convertible |

---

## Hallazgos

### 🟠 Hallazgo C (de vuelta 1) — **CARACTERIZADO** · S3 · La sugerencia huérfana **sí** se puede convertir en pedido

**Lo que se midió, punta a punta.** La sugerencia `1789160290226.0` apunta a
`co_client_stock 1789160266062.0`, un inventario que **no existe**
(`SELECT count(*) FROM client_stocks WHERE co_client_stock = '1789160266062.0'` ⇒ **0**).

| Pregunta del encargo | Respuesta medida |
|---|---|
| ¿Se ve en la lista? | **Sí**, `Nro. Ref.: 0 · Estatus: Pendiente · 11/09/2026 16:58` — **indistinguible** de las legítimas |
| ¿Se abre? | **Sí**, con su snapshot completo (`prev 0 · desp 30 · ret 9 · vendido 18 · sugerido 126`) |
| ¿El botón ACEPTAR está habilitado? | **Sí** — `disableOrderButton = false`, `previewReady = true` |
| **¿Se puede convertir en pedido?** | **SÍ.** Pulsar ACEPTAR navega a `/pedido` y arma un pedido **completo y válido**: `co_order 1789161699927.0`, cliente `100113`, línea `GERPROALF002CAJ` con `quOrder = 126`, precio 1,95, total 245,70 |
| ¿El pedido arrastra el vínculo roto? | **Sí** — el pedido nace con `coClientStock = "1789160266062.0"`, **el inventario inexistente**. Si se enviara, la nube recibiría un pedido apuntando a un `co_client_stock` que nunca existió allí |
| ¿Avisa algo? | **No.** Ni alerta, ni etiqueta, ni diferencia visual en ningún punto del recorrido |

**El pedido NO se guardó** (se salió con «Salir sin guardar»), así que la huérfana sigue Pendiente
y la nube quedó limpia.

**Severidad.** Se mantiene en **S3**: el daño es un pedido con una referencia colgada, no una
pérdida de dinero ni de datos. Pero **la reproducción es trivial** y la deja cualquier vendedor que
mire el sugerido y luego se arrepienta del inventario.

**Reproducción (3 pasos):** Inventario nuevo → cargar un producto → RESUMEN → **PEDIDO SUGERIDO** →
cerrar la vista previa → **Salir sin guardar** → *Inventario → SUGERENCIAS DE PEDIDO* → la sugerencia
está ahí y ACEPTAR funciona.

**Para desarrollo, dos salidas posibles** (decidir con el REQ): (a) persistir la sugerencia sólo
cuando el inventario se guarda, o (b) borrar en cascada la sugerencia cuando se descarta el
inventario que la generó.

### 🟡 Observación 1 — La lista de sugerencias pierde el orden cronológico tras sincronizar

Al cierre de la corrida, el submódulo lista:

```
0: 100121 …  Nro. Ref.: 7  17:52     ← sincronizada
1: 100113 …  Nro. Ref.: 6  17:38     ← sincronizada
2: 1702   …  Nro. Ref.: 0  17:55     ← sólo local  ⟵ la MÁS NUEVA, tercera
3: 104    …  Nro. Ref.: 0  17:47
```

**Causa medida:** el orden es por `da_suggested` **como texto**, y la sincronización reescribe esa
columna en formato ISO con zona (`2026-09-11T21:52:59.000+00:00`) mientras las locales conservan
`2026-09-11 17:55:41`. Como `' ' (0x20) < 'T' (0x54)`, **toda fila sincronizada se ordena por encima
de cualquier fila local del mismo día**, sin importar la hora.

Es la **misma fragilidad de formato de fecha** que el guión anota para `substr(da_invoice,1,10)`,
pero aquí **sí reproduce hoy y se ve en pantalla**. Es cosmética (no altera ningún cálculo), pero
confunde: la sugerencia recién hecha no encabeza la lista.

### 🟡 Observación 2 — La lista no dice cuántas líneas tiene cada sugerencia

El guión espera «se listan, con cliente, fecha y **cantidad de líneas**». La UI muestra cliente,
`Nro. Ref.`, estatus y fecha; **no** el número de líneas, que sí está en `nu_details`. Además, con
tres sugerencias del **mismo cliente y el mismo día** (caso real de esta corrida) lo único que las
distingue es la hora. No es un fallo funcional; es una carencia de la lista.

### 🟡 Observación 3 — «Pendiente» no distingue *«no convertida»* de *«no sincronizada»*

`Estatus` refleja `in_order_sent` (convertida o no). Si la sugerencia llegó o no a la nube se lee
sólo en `Nro. Ref.` (0 = no sincronizada). Un vendedor que respondió **NO** a la pregunta ve
exactamente lo mismo que uno que respondió **SÍ**, salvo por un `0` en un campo llamado «Ref.».

### ⚪ Observación 4 — Dos detalles menores, ya conocidos o sin impacto

1. **`id_currency` / `co_currency` llegan `NULL`** en las 4 cabeceras guardadas, aunque la vista
   previa tiene la moneda resuelta (`USD`, `idCurrency 2`). Las columnas existen y no se llenan. No
   afecta ningún término ni el pedido generado (que sí toma la moneda), pero rompe la trazabilidad
   «con qué moneda se calculó».
2. **La alerta de rechazo del modal de cantidad sigue nombrando «unidad, fecha y lote»** con
   `expirationBatch = false`, que es cuando ninguno de los tres es obligatorio. Es la reconfirmación
   del Defecto 4 del 08/09 — **no usar el texto de esa alerta como oráculo de la VG**.
3. **El envío de INV-B (`104`) quedó con la sugerencia sin subir sin que se respondiera la pregunta
   a propósito.** El grabador de alertas demostró que la pregunta **sí apareció** (2349 ms) y estuvo
   2,3 s en pantalla; el guion de automatización se cayó en medio por un error de lectura de BD y
   nadie la respondió, y la alerta se cerró sola. **No se reporta como defecto**: es un artefacto del
   método, y el comportamiento resultante (no adjuntar la sugerencia) coincide con el «NO». Se anota
   porque, si al cerrarse sola equivale a «NO», conviene que desarrollo confirme que es lo deseado.

### ⚠ Posible defecto — **pide confirmación a mano**, podría ser el método

**Convertir dos sugerencias seguidas sin volver a HOME abrió el pedido de la PRIMERA.**

Secuencia exacta: se convirtió la huérfana (pedido `1789161699927.0`, cliente `100113`,
`GERPROALF002CAJ 126`) → se salió con el botón atrás (**sin** diálogo de confirmación) → se abrió
**otra** sugerencia (cliente `1702`) → ACEPTAR → la pantalla de pedido mostró, durante 12 s de
sondeo, **el pedido viejo**: `coOrder 1789161699927.0`, cliente `100113`, `coClientStock 1789160266062.0`.

Repetido **volviendo antes a HOME**, la conversión fue correcta a la primera
(`coOrder 1789164223064.0`, cliente `1702`, sus 2 líneas). ⇒ **Muy probablemente sea la página
`app-pedido` cacheada en la pila del router de Ionic**, y no un defecto de la app; el vendedor real
también saldría por el botón atrás, así que no es imposible que reproduzca.

**Lo que hay que probar a mano:** convertir una sugerencia, salir con la flecha, convertir otra
sugerencia **distinta** sin pasar por HOME, y mirar qué cliente y qué líneas muestra el pedido.

---

## Lo que NO se pudo comprobar

| Caso | Motivo |
|---|---|
| **DM-SUG-011 — la suma del mismo producto en dos facturas del día** | ⛔ **Falta de dato, medido, no supuesto:** barrido global sobre las 167 facturas ⇒ **0** clientes+sucursal con un producto repetido en su **última** fecha facturada. Existen 2 casos en fechas anteriores (`82/697` el 03/09 y `156/771` el 17/08) pero la app sólo lee la última fecha. **4.ª corrida consecutiva sin poder ejercitarlo.** Se desbloquea desde el servidor: facturar dos veces el mismo producto al mismo cliente+sucursal en su fecha más reciente |
| **DM-SUG-001 — migración desde v21 con datos** | 🚫 La APK ya estaba instalada y la base ya está en `db_version 23`. Exige una instalación que venga de v21 con datos |
| **DM-SUG-014 por SUCURSAL** | 🚫 Sin dato: 17 clientes, 17 direcciones, **una por cliente**. El aislamiento por **cliente** sí quedó probado con contraste |
| **DM-SUG-044 — abrir un guardado días después** | ⏭ Exige dejar pasar días con facturas nuevas de por medio |
| **DM-SUG-077 — dos sincronizaciones seguidas** | ⏭ Sólo se observó **una** (la del re-login). No se forzó una segunda |
| **DM-SUG-085 — lote y vencimiento obligatorios** | 🚫 N/A por configuración: `expirationBatch = false`. Un caso que **no puede fallar** con esta VG |
| **Envío de la sugerencia sin señal** (queda en cola y luego sincroniza) | ⏭ Exige modo avión, fuera de lo reproducible por UI. Hoy `pending_transactions = 0` todo el tiempo |
| **Capa web (Transacciones → Pedido Sugerido)** | ⏭ Vuelta 4. Ya hay material: sugerencias **id 6** (6 líneas) e **id 7** (2 líneas) |
| **Bloque E (un solo pedido por sugerencia) y bloque C.45/46** | ⏭ Vuelta 3 (pedidos). Se dejaron **4 sugerencias Pendientes** sin consumir a propósito |

---

## Patrones y selectores nuevos

| Patrón / selector | Alcance | Detalle |
|---|---|---|
| 🔴🔴 **El `previous_stock` sólo cuenta inventarios CONFIRMADOS por el servidor** | universal (oráculo) | La build añade `AND id_client_stock <> 0` al `WHERE` de `getPreviousClientStock` — **no está en el `src` de la rama QA**. Un inventario Guardado no es «el anterior» de nada. **Sin esto el oráculo da FAILs que no son defectos** (nos pasó: esperaba 2, la app daba 0, y la app tenía razón). El bundle trae 4 guardas de esa familia: `id_client_stock`, `id_return`, `id_collection` (×4), `id_transaction`. ⇒ **agregar la guarda a `automation/sugerido/oraculo-terminos.js`** |
| 🔴🔴 **Verificar el clic en una alerta por el TEXTO del mensaje, nunca por la etiqueta del botón** | universal (harness) | La cadena de envío encadena alertas en **<500 ms** y las dos primeras tienen **los mismos botones** (`Cancelar/Aceptar`). El patrón «¿sigue existiendo el botón que pulsé?» **no distingue** «no se fue» de «llegó la siguiente», y el bucle **contesta la alerta siguiente sin saberlo** — así se perdió la pregunta de la sugerencia en el primer envío. **Receta: guardar el mensaje antes de pulsar y dar por bueno el clic sólo cuando el mensaje CAMBIA o la alerta desaparece** |
| 🔴 **Grabador de alertas a 120 ms: la única forma de saber qué apareció de verdad** | universal (harness) | `setInterval` en la página que registra `(ms, mensaje >> botones)` de la `ion-alert` activa. Es lo que probó que la pregunta de la sugerencia **sí** salía cuando el guion reportaba que no. **Obligatorio en cualquier cadena de más de 2 alertas** |
| 🔴 **Con el modal de clientes abierto, clickear `#clienteSelect` selecciona el ítem que esté bajo esas coordenadas** | universal | Un intento fallido dejó el `ion-modal#clienteSelectModal` abierto; el siguiente clic sobre `#clienteSelect` cayó sobre el primer cliente de la lista y **seleccionó el cliente equivocado en silencio**. **Receta: `dismiss()` de todo `ion-modal` visible antes de abrir un selector**, y verificar `coClient` contra el esperado antes de seguir |
| 🔴 **La vista previa reabierta esconde los 9 términos en un `ion-accordion` COLAPSADO** | universal | `innerText` devuelve sólo `«Pedido Sugerido · Moneda: · Días… · <código> - <nombre> · ACEPTAR»` y se lee como «no muestra los números». Están en el `innerHTML` (`Sugerido UNIDAD: 126`, `Inv. Inicial 30`, `Inv. Anterior 0`, `Despacho 30`, `Cambio por cambio 0`). **Cotejar por `ng.getComponent(...).productsSuggested`, no por texto visible** |
| 🔴 **En el modal de cantidad: clic SIMPLE + teclear. El triple-clic falla ~1 de cada 3** | universal | `mouse.click(..., {clickCount: 3})` deja el `input[placeholder="Ingrese cantidad"]` sin foco y el valor queda vacío; el ✓ responde *«Complete cantidad, unidad, fecha y lote»* y se lee como «el modal no acepta». **Receta: 1 clic → `Backspace` ×6 → `keyboard.type` → `blur()` → medir el ✓** |
| 🔴 **Tras `am force-stop`, el `adb forward` de CDP apunta a un socket muerto** | universal (infra) | El nombre del socket cambia (`webview_devtools_remote_7814` → `..._12771`). **Receta en 3 pasos: `adb forward --remove tcp:9220` → leer `/proc/net/unix` para el socket vivo → `adb forward tcp:9220 localabstract:<socket>`.** Sin esto, `:9220` responde vacío y se lee como «la app no levantó» |
| 🔴 **El botón de login es «ACEPTAR»** (no ENTRAR/INICIAR/INGRESAR) | cliente/build | Los buscadores por esas tres palabras devuelven `[]`. Y el campo de contraseña **no siempre engancha al primer clic**: verificar `input.value.length` antes de pulsar |
| ⚠ **El botón «PEDIDO SUGERIDO» NACIÓ DENTRO del viewport en los 4 inventarios** | cliente/build | `top` 600 / 537 / 348 con `innerHeight 744`. Contradice el `top 789` del 08/09 y confirma la nota de vuelta 1: **depende de cuántos productos tenga el Resumen**. El `scrollIntoView({block:'center'})` + re-medir sigue siendo obligatorio porque es gratis y cubre los dos casos |
| ⚠ **Los `.md` de selectores con regex escapados mueren en el heredoc de bash** | harness | `\\s` dentro de un heredoc queda como `\s` en el archivo y el *template literal* de JS lo convierte en `s`: `/pedido\s+sugerido/i` se volvió `/pedidos+sugerido/i` y el botón «no existía». **Receta: en los selectores que se pasan como string, cero regex** — `toUpperCase().indexOf('PEDIDO SUGERIDO') > -1`, `String.fromCharCode(10)` para los saltos de línea |
| ℹ **El texto del ítem de producto usa `\n\n` como separador, no espacios** | cliente | `"HIPERMERCADO PARAMO, C.A - PIEDRA AZUL\n\nCódigo: 100113\n\nSaldo BS: …"`. Un `indexOf('Código: ' + cod + ' ')` no matchea nunca. Normalizar los saltos antes de comparar |
| ℹ **La lista de sugerencias ordena por `da_suggested` como TEXTO** | universal | Y la sincronización cambia el formato de esa columna ⇒ el orden cronológico se rompe (Obs. 1) |
| ℹ **`getSuggestedOrderSnapshotByClientStock` es el que decide si sale la pregunta** | universal (diagnóstico) | `proceedAfterSendConfirm()`: si `!suggestedOrder` (VG) ⇒ no pregunta; si no hay snapshot para ese `co_client_stock` ⇒ no pregunta; si lo hay ⇒ `alertMessageOpenSendSuggested = true`. El POST adjunta la sugerencia sólo si `shouldAttachSuggestedOrderOnStockSend(co)` — que es lo que fija la respuesta a la pregunta |
| ℹ **Mapa categoría → producto (hidroponias), ampliado** | cliente | 13 categorías. Añadidos a los ya conocidos: **MAIZ** → `CAMPROSDU002BOL` · **CEBOLLIN** → `CAMPROCEB002ATA` · **FRUTAS** → `FRUPRO005001025` · **FRESCALES** → `046013ESP001BOL`, `046013ESP003BOL` (150 GRS, **adyacente y trampa**), `046PRO003003025`, `046013ACG002BOL`, `046013ACG004BOL`, `046013HIR01BOL`, `HIDPRORUC001BOL` |
| ℹ **Guarda de GPS con caché caliente: el formulario abre en 1-2 s** | cliente | Los 5 inventarios abrieron en 1-2 s. El techo de 120 s del RUNTIME sigue siendo necesario **sólo en frío** |

---

## Verificación BD

| Registro | Marca | Fila en la nube | Estado local | ¿Lo guardado se envió? |
|---|---|---|---|---|
| Inventario **275** | **BD-OK** | `id 275`, `st_client_stock 1`, `id_user 469` | `st_delivery=1`, `id_client_stock=275` | ✅ sí |
| Inventario **276** | **BD-OK** | `id 276` | `st_delivery=1` | ✅ sí |
| Inventario **277** | **BD-OK** | `id 277` | `st_delivery=1` | ✅ sí |
| Inventario **278** | **BD-OK** | `id 278` | `st_delivery=1` | ✅ sí |
| Inventario **279** | **BD-OK** | `id 279` | `st_delivery=1` | ✅ sí |
| Sugerencia `1789162387211.0` | **BD-OK · BD-FIELD-OK** | `id 6`, 6 líneas, **54 campos idénticos** | `id_client_stock_suggested_order=6` | ✅ sí (respondió SÍ) |
| Sugerencia `1789163579449.0` | **BD-OK · BD-FIELD-OK** | `id 7`, 2 líneas, **18 campos idénticos** | `id_client_stock_suggested_order=7` | ✅ sí (respondió SÍ) |
| Sugerencia `1789163741436.0` | **BD-SAVED** | — | `id…=null`, `in_order_sent=0` | ✅ correcto: se respondió **NO** |
| Sugerencia `1789163276184.0` | **BD-SAVED** | — | `id…=null` | ⚠ la pregunta se cerró sola (Obs. 4.3) |

Baseline-diff: `client_stock` **169 → 174** (+5 exactas) · `client_stock_suggested_orders` **5 → 7**
(+2 exactas) · detalles **17 → 25** (+8 = 6+2).
`pending_transactions = 0` y `failed_transactions = 0` **en todo momento**, incluidas las lecturas
tomadas *entre* alerta y alerta de cada envío.

---

*Vuelta 2 de 4 · siguiente: pedidos (4 sugerencias Pendientes sin consumir, ver «Registros creados»).*
