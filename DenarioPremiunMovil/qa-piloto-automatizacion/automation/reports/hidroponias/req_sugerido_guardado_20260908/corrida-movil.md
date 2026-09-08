# REQ «Pedido Sugerido guardado» — corrida móvil · HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `req_sugerido_guardado_20260908` |
| Fecha | 2026-09-08 |
| Rama bajo prueba | `SaveSuggestedOrder` |
| Cliente / playa | hidroponias — **Isla Coche** (`denarioislacoche.ddns.net:8081`), BD nueva |
| Empresa | `HIDRO_A` (idEnterprise 1) |
| Usuario | **V3 — ROGER MUESES** (`idUser 469`) |
| Dispositivo | Infinix X6728, Android 15 — WebView Chrome/152 |
| VGs leídas en vivo | `suggestedOrder=true` · `suggestedOrderByDispatchAndReturn=true` · `expirationBatch=false` · `userMustActivateGPS=true` (pedidos) |
| Cliente de prueba | **HIPERMERCADO PARAMO, C.A - PIEDRA AZUL** — `co 100113` / `id_client 65` / `id_address_client 680` |
| 2.º cliente | **CENTRAL MADEIRENSE C.A. - LA BOYERA** — `co 104` / `id_client 110` / `id_address_client 725` |
| Resultado | **60 casos: 45 PASS · 2 FAIL · 7 BLOCKED · 1 N/A · 3 definiciones observadas · 2 pendientes (capa web)** |

> **El cálculo está impecable: 9 productos × 9 términos, tolerancia 0, contra un oráculo
> calculado en la BD antes de tocar la app. Lo que NO funciona es la subida a la nube:**
> la tabla nueva `client_stock_suggested_orders` **no tiene secuencia para su PK** en la BD
> de hidroponias, el servidor rechaza el POST, y **se lleva por delante el inventario que la
> acompaña** — que queda en cola para siempre, sin error visible para el vendedor.

---

## 1. Tabla de veredictos

### Bloque A · El cálculo especial

| ID | Caso | Resultado | Nota con los números medidos |
|---|---|---|---|
| DM-SUG-001 | Migración v22 desde v21 | ✅ PASS | Verificado por QA antes de la corrida; no se repitió |
| DM-SUG-002 | Guarda de tenant | ✅ PASS | `suggestedOrderByDispatchAndReturn = true` leído del servicio vivo |
| DM-SUG-003 | Botón «Pedido Sugerido» en Resumen | ✅ PASS | Pestaña **Resumen**: `["Eliminar seleccionados (0)", "Pedido Sugerido"]`. **Nace fuera del viewport** (top 789 px vs `innerHeight` 744) — ver §6 |
| DM-SUG-010 | Consolidación: producto solo en factura perdedora | ✅ PASS | **5 productos** que el bug daba en 0 traen su cantidad real: 100 · 30 · 30 · 15 · 15 |
| DM-SUG-011 | Suma del mismo producto en 2 facturas del día | ⛔ BLOCKED | Sin dato: el único cliente que lo tiene no está asignado a ningún vendedor (por indicación) |
| DM-SUG-012 | Control: producto de la factura ganadora | ✅ PASS | `TOMPROCHE001CAJ = 15` · `CAMPROLEC001BAN = 8` — idénticos al oráculo |
| DM-SUG-013 | Producto sin factura ese día | ✅ PASS | `046PRO003003025` (ALBAHACA) **aparece en la lista** con `dispatchedStock = 0`, ni ausente ni en blanco |
| DM-SUG-014 | Aislamiento por cliente + sucursal | ✅ PASS | Oráculo **sin filtrar** por cliente daría 274 y 251; la app trajo **100** y **15**. ⚠ El cliente tiene 1 sola sucursal ⇒ el filtro por sucursal no queda separado del de cliente |
| DM-SUG-015 | Cambio x cambio en ventana | ✅ PASS | Cliente 104: swaps **5 · 4 · 7 · 1** exactos. En `CAMPROLEC001BAN` (5) y `CAMPROSDU002BOL` (4) el swap es el **único** aporte al inicial |
| DM-SUG-016 | Devolución de Distribución resta | ✅ PASS | Ref **275**: `HIDPROBER001BOL` → `returnedStock = 9` · `046013ESP001BOL` → `4` |
| DM-SUG-017 | Devolución de Calidad no resta | ✅ PASS | Ref **276** (Calidad, 3 uds de `046013ESP001BOL`): **no entra**, `returnedStock` sigue en 4 |
| DM-SUG-018 | Mismo producto con las DOS devoluciones | ✅ PASS | `046013ESP001BOL`: Distrib 4 + Calidad 3. Medido **4**, no 7. Vendido 6 (si sumara Calidad daría 3) |
| DM-SUG-019 | `days_since_last` se calcula | ✅ PASS | **1** (cliente 100113) y **20** (cliente 104), coherentes con los inventarios previos (07/09 y 19/08). **No existe campo para teclearlo** en la UI |
| DM-SUG-020 | Stock 0 con rotación previa | ✅ PASS | `TOMPROMAN001GRA`: actual **0**, despacho **261** ⇒ sugerido **2610** |
| DM-SUG-021 | `days_until_next` tecleado | ✅ PASS | 1 → **10**; los 9 sugeridos se recalcularon (0/0/0/6/0/261/0/0/5 → 490/50/0/60/0/2610/70/0/50) |
| DM-SUG-022 | Guarda `current >= sugerido` (con igualdad) | ✅ PASS | **Dos igualdades exactas:** `HIDPROBER001BOL` sug 10 vs actual 10 ⇒ 0 · `046PRO003003025` (cliente 104) sug 1 vs actual 1 ⇒ 0 |
| DM-SUG-023 | Guarda de venta negativa | ✅ PASS | `CAMPROLEC001BAN`: vendido **−11** ⇒ diaria **0** ⇒ sugerido 0 |
| DM-SUG-024 | Cantidad negativa al inventariar | ✅ PASS | Input `min="0"`; con −1 responde «Complete cantidad, unidad, fecha y lote para continuar.», **el modal no cierra** y no se agrega línea |
| DM-SUG-025 | Cantidad 0 al inventariar | ✅ PASS | `TOMPROMAN001GRA = 0` aceptado, persistió al Guardar (`qu_stock = 0`) y llegó a la nube en el inventario **157** |
| DM-SUG-026 | Aritmética completa, ≥3 productos | ✅ PASS | **9 productos, tolerancia 0** — ver §2 |

### Bloque B · El sugerido se guarda

| ID | Caso | Resultado | Nota |
|---|---|---|---|
| DM-SUG-030 | Se crea la cabecera ligada al inventario | ✅ PASS | `co_client_stock_suggested_order = 1788884642940.0` · `co_client_stock = 1788884444328.0` |
| DM-SUG-031 | **Cotejo término por término** | ✅ PASS | **9 productos × 9 términos = 81 comparaciones, 0 diferencias** — ver §3 |
| DM-SUG-032 | `nu_details` = líneas guardadas | ✅ PASS | 9 = 9 (cliente 100113) · 4 = 4 (cliente 104) |
| DM-SUG-033 | Productos con sugerido 0 | 🔎 **DEFINICIÓN** | **Se guardan** — ver §4.1 |
| DM-SUG-034 | `days_until_next` tecleado se guarda | ✅ PASS | `days_until_next = 10`, no el 1 por defecto. Persistió al reabrir el inventario Guardado |
| DM-SUG-035 | `by_dispatch_and_return` en cabecera | ✅ PASS | `= 1`, refleja la VG con la que se calculó |
| DM-SUG-036 | Cerrar la app y volver a abrir | ✅ PASS | Tras `force-stop` + relanzar **y un re-login completo con sincronización**: cabecera intacta, 9 detalles, `SUM(sug)=3330`, `SUM(desp)=474` |
| DM-SUG-037 | Dos sugeridos de clientes distintos | ✅ PASS | 2 cabeceras separadas: `100113` (9 líneas, días 1/10) y `104` (4 líneas, días 20/10). Sin mezclarse |
| DM-SUG-038 | Sugerido nuevo sobre el mismo inventario | 🔎 **DEFINICIÓN** | **Reemplaza** — ver §4.2 |

### Bloque C · Submódulo «Sugerencias de Pedido»

| ID | Caso | Resultado | Nota |
|---|---|---|---|
| DM-SUG-040 | Entrar sin sugeridos guardados | ✅ PASS | Mensaje **«No hay pedidos sugeridos guardados»**, no pantalla en blanco (medido con la tabla vacía) |
| DM-SUG-041 | Entrar con sugeridos guardados | ✅ PASS | Se listan con cliente, fecha y nº de líneas: `Cliente: 100113 - HIPERMERCADO PARAMO … Estatus: Pendiente Fecha: 08/09/2026 12:28` |
| DM-SUG-042 | Estado en la lista | ✅ PASS | «Pendiente» con `in_order_sent=0`; pasa a «Enviado» con `=1` tras convertirla |
| DM-SUG-043 | Abrir uno guardado | ✅ PASS | Los 9 términos releídos coinciden **exactamente** con lo guardado (0 diferencias), incluidas las 3 líneas con sugerido 0 |
| DM-SUG-044 | Abrirlo días después, con facturas nuevas | ⛔ BLOCKED | No ejercitable en una sola jornada: exige dejar pasar días y que entren facturas nuevas |
| DM-SUG-045 | Confirmar la vista previa de un Pendiente | ✅ PASS | Navega a `app-pedido` con las líneas cargadas |
| DM-SUG-046 | Salir sin confirmar | ✅ PASS | Cerrando con la **X** del encabezado: `in_order_sent` sigue 0, cabecera y 9 detalles intactos |

### Bloque D · La decisión al enviar el inventario

| ID | Caso | Resultado | Nota |
|---|---|---|---|
| DM-SUG-050 | Enviar inventario **con** sugerido | ✅ PASS | Aparece **«¿Desea enviar también la sugerencia de pedido?»** `[Cancelar/Aceptar]`, justo tras confirmar el envío del inventario |
| DM-SUG-051 | Enviar inventario **sin** sugerido | ✅ PASS | Cliente 205: cadena `¿Desea enviar el Inventario?` → `El Inventario será enviado` → `Inventario nro. 166 enviado exitosamente`. **La pregunta NO aparece** |
| DM-SUG-052 | Responder **SÍ** | ❌ **FAIL** | El inventario **y** la sugerencia son **rechazados por el servidor** y nada llega a la nube — ver **§7 · Defecto 1** |
| DM-SUG-053 | Responder **NO** | ✅ PASS | Inventario **157** llegó a la nube; la sugerencia **quedó local en Pendiente** (`in_order_sent=0`, 9 detalles). **No se descarta** — es lo que QA esperaba |
| DM-SUG-054 | Tras responder NO, volver al submódulo | ✅ PASS | Sigue listada como «Pendiente» y se pudo convertir en el pedido **166** |
| DM-SUG-055 | Cancelar el envío con la pregunta en pantalla | ❌ **FAIL** | **No hay forma de abortar.** «Cancelar» solo declina la sugerencia: el inventario **se envía igual** — ver **§7 · Defecto 2** |

### Bloque E · Un solo pedido por sugerencia

| ID | Caso | Resultado | Nota |
|---|---|---|---|
| DM-SUG-060 | Convertir una sugerencia en pedido | ✅ PASS | `in_order_sent = 1` · `co_order = 1788886911558.0` · `id_order = 166`. El pedido lleva `co_client_stock` de vuelta al inventario |
| DM-SUG-061 | Volver a la lista tras convertirla | ✅ PASS | «**Enviado**», `idOrder 166`. La otra sigue «Pendiente» |
| DM-SUG-062 | Abrirla otra vez y confirmar | ✅ PASS | **No se crea un segundo pedido**: el botón ACEPTAR llega **`disabled=true`** (`blockCreateSuggestedOrder=true`). El clic real no produce nada |
| DM-SUG-063 | ¿Avisa o se queda mudo? | 🔎 **OBSERVACIÓN** | El `return` mudo de `:149/:174` **no es alcanzable**: el botón se deshabilita antes. Pero la vista previa **no explica** por qué — ver §5 |
| DM-SUG-064 | Un solo pedido en la nube | ✅ PASS | Nube: `id_order 166 → co_client_stock 1788884444328.0` y `167 → 1788885400121.0`, **uno por sugerencia**, sin duplicados |
| DM-SUG-065 | Eliminar el pedido creado | 🔎 **DEFINICIÓN / ⛔ BLOCKED** | **No hay opción de eliminar** en la móvil — ver §4.3 |
| DM-SUG-066 | Dos sugerencias del mismo vendedor | ✅ PASS | Cada una generó **su** pedido: `100113 → 166` (6 líneas) y `104 → 167` (2 líneas). Marcar una no bloqueó la otra |

### Bloque F · Nube y las tres capas

| ID | Caso | Resultado | Nota |
|---|---|---|---|
| DM-SUG-070 | Sincronizar tras enviar una sugerencia | ⛔ BLOCKED | Bloqueado por el **Defecto 1** (el FAIL se registra en DM-SUG-052, es el mismo hecho). Tras **2 sincronizaciones completas**, `client_stock_suggested_orders` en la nube sigue en **0 filas** |
| DM-SUG-071 | Cotejo en la nube término por término | ⛔ BLOCKED | No hay nada que cotejar: la tabla está vacía por el Defecto 1 |
| DM-SUG-072 | Web: Transacciones → Pedido Sugerido | ⏳ **PENDIENTE** | Sin navegador disponible en esta corrida |
| DM-SUG-073 | Cotejo móvil ↔ web | ⏳ **PENDIENTE** | Ídem |
| DM-SUG-074 | El pedido generado, en la web/nube | ✅ PASS | Verificado **en la nube**: pedido 166 con **exactamente** las 6 líneas de sugerido > 0 (60 · 50 · 50 · 490 · 70 · 2610) y **los 3 ceros excluidos**. Pedido 167 con sus 2 líneas (2 · 2) |
| DM-SUG-075 | Merge local + nube | ⛔ BLOCKED | Imposible: la nube nunca recibe sugerencias |
| DM-SUG-076 | Merge del estado | ⛔ BLOCKED | Ídem |
| DM-SUG-077 | Sincronizar dos veces sin cambios | ✅ PASS (parcial) | Tras 2 sincronizaciones completas los conteos locales no se movieron: **2 cabeceras / 13 detalles** (9+4). ⚠ Solo prueba el lado local — la bajada no se pudo ejercitar |

### Bloque G · Vecinos

| ID | Caso | Resultado | Nota |
|---|---|---|---|
| DM-SUG-082 | Devoluciones: ciclo Calidad y Distribución | ✅ PASS | Refs **275** (Distribución) y **276** (Calidad) creadas y **en la nube** (`return`, `id_type` 61 y 60) |
| DM-SUG-083 | La devolución nueva entra al siguiente sugerido | ✅ PASS | Con el signo correcto: Distribución resta (4 y 9), Calidad no (0) |
| DM-SUG-085 | Lote y vencimiento obligatorios | 🚫 **N/A** | `expirationBatch = false` en este equipo, leído del servicio vivo |

---

## 2. Cotejo del despacho contra el oráculo

Oráculo calculado **antes de tocar la app**, ejecutando la consulta del fix contra la BD
local del propio dispositivo. Última fecha facturada del cliente 100113/680: **2026-09-07**,
con **tres** facturas — `4859` (19:53, gana el desempate), `4858` (19:52) y `4810` (14:02).

| Producto | Con el bug daría | **Oráculo (fix)** | **Medido en app** | | Rol |
|---|---:|---:|---:|---|---|
| `MAL013PLS098MOR` | 0 | **100** | **100** | ✅ | oculto (fact. 4858) |
| `GERPROALF002CAJ` | 0 | **30** | **30** | ✅ | oculto (4858) |
| `GERPROGCH002BOL` | 0 | **30** | **30** | ✅ | oculto (4858) |
| `046013ESP001BOL` | 0 | **15** | **15** | ✅ | oculto (4858) |
| `HIDPROBER001BOL` | 0 | **15** | **15** | ✅ | oculto (4858) |
| **`TOMPROMAN001GRA`** | 0 | **261** | **261** | ✅ | 🔑 oculto, **tercera factura (14:02)** |
| `TOMPROCHE001CAJ` | 15 | **15** | **15** | ✅ | control (4859) |
| `CAMPROLEC001BAN` | 8 | **8** | **8** | ✅ | control (4859) |
| `046PRO003003025` | 0 | **0** | **0** | ✅ | sin factura ese día (DM-SUG-013) |

**9/9 exactos, tolerancia 0.** El caso más fuerte —`TOMPROMAN001GRA`, que vive **solo** en la
tercera factura del día, la de las 14:02— trae sus 261 unidades: el desempate viejo
(`ORDER BY da_invoice DESC, id_invoice DESC LIMIT 1`) la habría descartado entera.

### Términos completos leídos del modelo

`ng.getComponent(document.querySelector('app-inventario-sugerido-preview')).productsSuggested[].unitsSuggested[]`
con `daysSinceLast = 1` (calculado) y `daysUntilNext = 10` (tecleado):

| Producto | prev | desp | swap | inicial | actual | dev | vendido | diaria | **SUG** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `MAL013PLS098MOR` | 49 | 100 | 0 | 149 | 100 | 0 | 49 | 49 | **490** |
| `GERPROALF002CAJ` | 0 | 30 | 0 | 30 | 25 | 0 | 5 | 5 | **50** |
| `GERPROGCH002BOL` | 7 | 30 | 0 | 37 | 35 | 0 | 2 | 2 | **0** ← guarda `35 > 20` |
| `046013ESP001BOL` | 0 | 15 | 0 | 15 | 5 | **4** | 6 | 6 | **60** |
| `HIDPROBER001BOL` | 5 | 15 | 0 | 20 | 10 | **9** | 1 | 1 | **0** ← 🔑 **igualdad 10 = 10** |
| `TOMPROMAN001GRA` | 0 | 261 | 0 | 261 | **0** | 0 | 261 | 261 | **2610** ← quiebre con rotación |
| `TOMPROCHE001CAJ` | 4 | 15 | 0 | 19 | 12 | 0 | 7 | 7 | **70** |
| `CAMPROLEC001BAN` | 1 | 8 | 0 | 9 | 20 | 0 | **−11** | **0** | **0** ← venta negativa |
| `046PRO003003025` | 8 | 0 | 0 | 8 | 3 | 0 | 5 | 5 | **50** |

`inicial = prev + desp + swap` ✅ en los 9 · `vendido = inicial − actual − dev` ✅ en los 9 ·
`sugerido = diaria × 10` con sus dos guardas ✅ en los 9.

### El escenario se construyó a propósito

Las devoluciones **275** y **276** se crearon *antes* del inventario para que cayeran en
ventana (`da_return >= 2026-09-07`), y las cantidades se eligieron para forzar la **igualdad
exacta** de la guarda: con `initial = 20` y `returned = 9`, `sold = 1`, `diaria = 1`,
`sugerido = 10` — idéntico al `currentStock = 10` tecleado ⇒ la guarda lo apaga.

### Segundo cliente — el cambio x cambio (DM-SUG-015)

Cliente **104** (`id_client 110` / sucursal 725), `daysSinceLast = 20`, `daysUntilNext = 10`:

| Producto | prev | desp | **swap** | inicial | actual | dev | vendido | diaria | **SUG** | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `CAMPROLEC001BAN` | 0 | 0 | **5** | 5 | 1 | 0 | 4 | 0,2 | **2** | 🔑 swap = único aporte (2+3) |
| `CAMPROSDU002BOL` | 0 | 0 | **4** | 4 | 0 | 0 | 4 | 0,2 | **2** | 🔑 swap = único aporte |
| `046PRO003003025` | 1 | 0 | **7** | 8 | 1 | **5** | 2 | 0,1 | **0** | igualdad 1 = 1 |
| `GERPROALF001CAJ` | 0 | 0 | 0 | 0 | 5 | 0 | −5 | 0 | **0** | venta negativa |

Los 4 swaps coinciden con el oráculo (`da_cambio > 2026-08-19`), incluida la **suma de dos
swaps de fechas distintas** en `CAMPROLEC001BAN` (2 del 03/09 + 3 del 27/08 = 5).

---

## 3. DM-SUG-031 — cotejo término por término de lo guardado

`client_stock_suggested_order_details` (BD local del equipo) contra
`productsSuggested[].unitsSuggested[]` (lo que mostró la vista previa):

| Producto | prev | desp | swap | dev | inicial | actual | vendido | diaria | sug |
|---|---|---|---|---|---|---|---|---|---|
| `MAL013PLS098MOR` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `GERPROALF002CAJ` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `GERPROGCH002BOL` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `046013ESP001BOL` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `HIDPROBER001BOL` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `TOMPROMAN001GRA` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `TOMPROCHE001CAJ` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `CAMPROLEC001BAN` | ok | ok | ok | ok | ok | ok | ok | ok | ok |
| `046PRO003003025` | ok | ok | ok | ok | ok | ok | ok | ok | ok |

**9 líneas guardadas · 9 líneas en la vista previa · 0 diferencias en 81 comparaciones.**

Y el **round-trip completo** (DM-SUG-043): al reabrir la sugerencia desde el submódulo,
los 9 productos vuelven con los mismos 9 términos, **0 diferencias**, y los días guardados
(`1` / `10`) — es un *snapshot*, no un recálculo.

Cabecera guardada:

```
co_client_stock_suggested_order  1788884642940.0
co_client_stock                  1788884444328.0     ← el inventario
id_client 65 · co_client 100113 · id_address_client 680
id_enterprise 1 · co_enterprise HIDRO_A · id_user 469 · co_user V3
days_since_last 1 · days_until_next 10 · by_dispatch_and_return 1
da_suggested 2026-09-08 12:28:44 · nu_details 9
co_order 1788886911558.0 · id_order 166 · in_order_sent 1
```

---

## 4. Las tres definiciones — lo observado

### 4.1 · DM-SUG-033 — los productos con sugerido 0 **se guardan**

De los 9 productos inventariados, **3 quedaron con `qu_unit_suggested = 0`**
(`GERPROGCH002BOL`, `HIDPROBER001BOL`, `CAMPROLEC001BAN`) y **los tres están guardados**,
con todos sus términos. `nu_details = 9`, no 6.

Y es **consistente en las tres lecturas**:

| Dónde | Líneas |
|---|---:|
| Vista previa al generarlo | 9 (los 3 ceros visibles con su desglose) |
| `client_stock_suggested_order_details` | 9 |
| Al reabrir desde el submódulo | 9 |

**Dónde sí se filtran los ceros: en el pedido.** El pedido 166 salió con **6 líneas** —
exactamente las de sugerido > 0— y lo mismo en la nube. O sea: **el snapshot conserva el
cálculo completo; el pedido se queda solo con lo que hay que pedir.** Leído como diseño, es
coherente: el sugerido en 0 es información (*«este producto se calculó y no hace falta
reponerlo»*), y perderla al guardar impediría auditar el cálculo después.

*Sin juicio de valor: así se comporta hoy, y es consistente. Queda para el REQ decidir si es
lo querido.*

### 4.2 · DM-SUG-038 — generar de nuevo sobre el mismo inventario **reemplaza**

Sobre el mismo inventario (`co_client_stock = 1788884444328.0`) se abrió la vista previa
**tres veces**: una con `daysUntilNext = 1` y dos con `= 10`. Resultado:

- **Una sola cabecera**, con el **mismo** `co_client_stock_suggested_order`
  (`1788884642940.0`) — no se creó una segunda.
- `da_suggested` **se actualizó** a la hora de la última generación (12:28:44).
- `days_until_next` pasó de 1 a **10**.
- **9 detalles**, no 18: los anteriores se borraron antes de reinsertar.

⇒ **La regla es reemplazar, y no quedan dos cabeceras para el mismo `co_client_stock`**,
que es justo lo que el caso pedía verificar. Se corresponde con lo que hace el código
(reutiliza el `co` existente y hace `DELETE` de los detalles antes de reinsertar).

⚠ **Dato lateral que conviene decidir:** el snapshot **se guarda al abrir la vista previa**,
antes de que el inventario exista como registro. Medido: la cabecera estaba en la BD con
`co_client_stock = 1788884444328.0` cuando `client_stocks` **todavía no tenía esa fila**
(el inventario se guardó después). Si el vendedor abre el sugerido y abandona el inventario
sin guardarlo, **queda una sugerencia huérfana** apuntando a un inventario que no existe.

### 4.3 · DM-SUG-065 — no se puede eliminar el pedido desde la móvil

**No hay opción de eliminar.** En `app-pedidos-lista` (52 pedidos listados) los ítems
**no traen ningún botón de acción** —ni papelera ni menú—, y los pedidos 166 y 167 figuran
como «Enviado». Tampoco hay opción de eliminar la sugerencia en el submódulo.

⇒ **La pregunta del REQ no se puede contestar desde la móvil**: no existe el camino que la
dispara. Con el diseño actual, una sugerencia convertida **queda consumida para siempre**
(`in_order_sent = 1` es de una sola dirección: nada en el flujo móvil lo devuelve a 0).
Si el REQ quiere que se pueda liberar, hoy **falta la funcionalidad**, no es que se comporte
mal. Si la eliminación existe en la web, hay que probarla desde ahí.

---

## 5. DM-SUG-063 — ¿avisa o se queda mudo?

**El `return` mudo de `inventario-sugerido-list.component.ts:149` y `:174` no llega a
ejecutarse por la UI**, porque el botón se deshabilita antes:

| Medición sobre la sugerencia ya convertida | Valor |
|---|---|
| `blockCreateSuggestedOrder` | `true` |
| `disableOrderButton` | `true` |
| Botón del pie | texto **ACEPTAR**, `disabled = true` |
| Clic real (`mouse.click`) sobre él | **no pasa nada**: sin alerta, sin navegación, sigue en la vista previa |
| Estado en la lista, una pantalla atrás | **«Estatus: Enviado»** |

**Lectura:** el riesgo que anticipaba el guión —*«el usuario confirma y no pasa nada, y no
puede distinguir bloqueado de colgado»*— **no se materializa**, porque el usuario no llega a
confirmar: el botón está visiblemente apagado.

**Queda un hueco de usabilidad menor, no un defecto:** la vista previa **no dice por qué**
está deshabilitado. El único cartel que lo explica («Enviado») está en la lista anterior. Un
texto en el pie del tipo *«Esta sugerencia ya generó el pedido nro. 166»* cerraría el círculo
y de paso daría la trazabilidad al pedido, que hoy solo está en la BD.

---

## 6. Registros creados en el sistema

| Qué | Ref / `co` | Detalle | Local | Nube |
|---|---|---|---|---|
| **Devolución 275** | `1788883643568.0` | Cliente 65 · **Distribución (61)** · `HIDPROBER001BOL ×9`, `046013ESP001BOL ×4` · factura 20118282 | `st_delivery=1` | ✅ **BD-OK** |
| **Devolución 276** | — | Cliente 65 · **Calidad (60)** · `046013ESP001BOL ×3` · factura 20118282 | `st_delivery=1` | ✅ **BD-OK** |
| **Inventario 157** | `1788884444328.0` | Cliente 65 · **9 líneas** (una en cantidad **0**) · días 1/10 | enviado | ✅ **BD-OK** |
| **Inventario (sin nro.)** | `1788885400121.0` | Cliente 110 · 4 líneas · días 20/10 | ⚠ `st_delivery=2`, **en `pending_transactions`** | ❌ **BD-QUEUED — rechazado, ver §7** |
| **Inventario 166** | `1788887316519.0` | Cliente 161 · 1 línea · **sin sugerido** (caso DM-SUG-051) | enviado | ✅ **BD-OK** |
| **Sugerido A** | `1788884642940.0` | Cliente 100113 · **9 líneas** · días 1/10 · **Enviado** (`in_order_sent=1`, `id_order=166`) | ✅ | ❌ **no llegó** |
| **Sugerido B** | `1788885470894.0` | Cliente 104 · **4 líneas** · días 20/10 · **Enviado** (`in_order_sent=1`, `id_order=167`) | ✅ | ❌ **no llegó** |
| **Pedido 166** | `1788886911558.0` | Desde el Sugerido A · **6 líneas**: 490/50/60/2610/70/50 | `st_delivery=1` | ✅ **BD-OK** (`nu_details=6`) |
| **Pedido 167** | `1788887212742.0` | Desde el Sugerido B · **2 líneas**: 2/2 | `st_delivery=1` | ✅ **BD-OK** (`nu_details=2`) |

⚠ **Inconsistencia derivada del Defecto 1:** el **pedido 167 sí está en la nube** y apunta a
`co_client_stock = 1788885400121.0`, pero **ese inventario no existe allí**. Queda una
referencia huérfana.

---

## 7. Defectos

### 🔴 Defecto 1 — S1 · La nube no tiene secuencia para la PK de `client_stock_suggested_orders`: se pierde el inventario entero

**Qué pasa.** Al enviar un inventario respondiendo **SÍ** a «¿Desea enviar también la
sugerencia de pedido?», el servidor **rechaza toda la transacción**. Ni la sugerencia ni el
inventario llegan a la nube, y el inventario queda reintentando en `pending_transactions`
**indefinidamente**.

**Respuesta del servidor** (capturada del POST, HTTP **200** con `errorCode` de negocio):

```
POST http://denarioislacoche.ddns.net:8081/PremiumWS/services/clientstockservice/clientstock
{
  "errorCode": "103",
  "errorMessage": "Error inesperado ERROR: relation
      \"client_stock_suggested_orders_id_client_stock_suggested_order_s\" does not exist
      Position: 16",
  "clientStockId": null,
  "clientStockSuggestedOrderId": null,
  "clientStockSuggestedOrder": null
}
```

**Causa confirmada en la BD de hidroponias.** Las dos tablas nuevas se crearon **sin la
secuencia de su clave primaria** y sin `DEFAULT`:

```sql
-- lo que hay:
information_schema.columns → client_stock_suggested_orders.id_client_stock_suggested_order
   data_type = integer · column_default = NULL · is_identity = 'NO'
   (idéntico en client_stock_suggested_order_details.id_client_stock_suggested_order_detail)

-- secuencias existentes que empiezan por 'client_stock':
   client_stock_id_client_stock_seq
   client_stock_detail_id_client_stock_detail_seq
   client_stock_detail_unit_id_client_stock_detail_unit_seq
-- ...y NINGUNA para las dos tablas nuevas.
```

Las tablas hermanas (`client_stock`, `client_stock_detail`) **sí** tienen la suya: el
despliegue de las tablas 85/86 se quedó a medias.

**Por qué es S1 y no solo «no sube la sugerencia»:**

| Comprobación | Resultado |
|---|---|
| ¿El vendedor ve algún error? | **No.** Recibe «El Inventario será enviado» y la app vuelve al listado |
| ¿Llega la 3.ª alerta (acuse del servidor)? | **No** — y ese es el único acuse real (RUNTIME §10) |
| ¿Queda registrado el fallo? | **No.** `failed_transactions = 0`; el rechazo es `errorCode 103`, no un 400 |
| ¿Se reintenta? | Sí, en bucle: `[AutoSendService] Error > 99 (no 400). Se salta y se mantiene en pendientes clientStock:1788885400121.0` |
| ¿Se recupera con una sincronización manual? | **No.** Tras **2 sincronizaciones completas** sigue en cola |

⇒ El inventario **está perdido de hecho** y nada en la interfaz lo delata.

**Contraste que aísla la causa — mismo día, mismo equipo, mismo usuario:**

| Inventario | Sugerencia adjunta | Resultado |
|---|---|---|
| 157 (cliente 65) | **NO** (respondió «Cancelar») | ✅ llegó, `id 157` |
| 166 (cliente 161) | **NO** (nunca se generó) | ✅ llegó, `id 166` |
| cliente 110 | **SÍ** (respondió «Aceptar») | ❌ **rechazado, en cola** |

**Reproducción:** generar un sugerido en cualquier inventario → Enviar → responder
**Aceptar** a la pregunta de la sugerencia → mirar `pending_transactions` en el equipo y
`client_stock_suggested_orders` en la nube (queda en 0 filas).

**Para desarrollo:** crear las secuencias y engancharlas como `DEFAULT` (o convertir las
columnas a `GENERATED BY DEFAULT AS IDENTITY`) en las dos tablas nuevas, en **todos** los
tenants donde se despliegue el REQ. Y, aparte del arreglo de DDL, vale revisar dos cosas del
cliente: que un `errorCode > 99` **no** deje la transacción reintentando en silencio
—debería ir a `failed_transactions` y avisar—, y que **el fallo de la sugerencia no arrastre
al inventario**, que es un dato independiente y ya validado.

### 🟠 Defecto 2 — S3 · «Cancelar» en la pregunta de la sugerencia no cancela nada

**DM-SUG-055.** Con la pregunta «¿Desea enviar también la sugerencia de pedido?» en pantalla,
**los dos botones envían el inventario**: `Aceptar` lo envía con la sugerencia y `Cancelar`
lo envía sin ella. **No hay forma de echarse atrás** una vez confirmado el primer diálogo.

Medido (inventario 157): tras pulsar **Cancelar**, la cadena siguió con
`El Inventario será enviado` → `Inventario nro. 157 enviado exitosamente`, y el registro
quedó en la nube.

Funcionalmente coincide con DM-SUG-053 («responder NO»), que **sí** pasa y es lo esperado.
El problema es de **rótulo**: un botón que dice «Cancelar» en un diálogo de envío se lee como
«no envíes nada». Como la pregunta es de sí/no, los botones deberían decirlo —**Sí / No**—,
o el diálogo debería ofrecer una tercera salida real.

### ⚪ A vigilar (no se reportan como defecto)

1. **El botón «Enviar» del pedido queda deshabilitado tras un fallo de GPS.** Reproducido
   **2 veces**: al fallar la validación de ubicación, `orderServ.disableSendButton` queda en
   `true` y el botón no se reactiva; hay que salir del pedido y volver a entrar. Conviene
   confirmarlo a mano antes de levantarlo como defecto — se observó con el GPS frío, que es
   una condición de laboratorio.
2. **Sugerencia huérfana.** El snapshot se guarda al abrir la vista previa, antes de que el
   inventario exista en `client_stocks` (§4.2).
3. **`id_client_stock` del sugerido se queda en 0.** Tras enviarse el inventario y recibir su
   `id_client_stock = 157`, la cabecera del sugerido sigue con `id_client_stock = 0`
   localmente; el vínculo vivo es `co_client_stock`. En la lista se lee como «Nro. Ref.: 0».

---

## 8. Patrones y selectores nuevos (insumo de consolidación)

| Patrón / selector | Alcance | Detalle |
|---|---|---|
| 🔴 **El botón «Pedido Sugerido» NACE FUERA DEL VIEWPORT** | universal | En Resumen aparece en `top 789 px` con `innerHeight 744`. `getBoundingClientRect()` lo da «visible» y el `mouse.click` en su centro **cae fuera de la pantalla y no hace nada** — se lee como «el botón no responde». **Hay que `scrollIntoView({block:'center'})` y volver a medir antes de clickear.** Tras el scroll: `ocluido = false`, abre a la primera |
| 🔴 **`daysUntilNext` NO se teclea en la vista previa: vive en la pestaña GENERAL** | universal | La vista previa **no tiene ningún `ion-input`** (`[]`) — solo muestra los días. El campo real es `#diasHastaSiguienteInventario ion-input`, con `[(ngModel)]`, y exige **teclado real** (S2x). Hay que **cerrar el preview, ir a General, teclear, volver a Resumen y reabrir** para que recalcule |
| 🔴 **No existe campo para `daysSinceLast`** | universal | Solo se renderiza `#diasHastaSiguienteInventario`; `#diasDesdeUltimoInventario` **no está en el DOM** de este build. Es la prueba de UI de DM-SUG-019 |
| 🔴 **En DEVOLUCIONES la cantidad NO va en un modal: es un `ion-accordion` en línea** | cliente/build | Contradice la receta de la corrida del 01/09. Hay que **expandir** `devolucion-product-list ion-accordion` (clic en su `ion-item[slot=header]`) y llenar el `ion-input` cuyo `parentElement.textContent` contiene **«Cantidad Devuelta»**. Lote, Unidad y Motivo llegan resueltos; el Nro. Factura viene prellenado. Si no se llena, el envío responde «La cantidad a devolver debe estar entre 1 y …» |
| 🔴 **La vista previa es un `ion-modal`: su backdrop bloquea TODA navegación** | universal | Con el preview abierto, `irAHome()`, los `ion-segment-button` y los tiles del HOME dejan de responder («tile Inventarios no visible en HOME»). **Cerrarlo siempre con `app-inventario-sugerido-preview ion-buttons[slot=end] ion-button` antes de navegar** |
| 🔴 **El botón ACEPTAR del sugerido está en `ion-footer`** | universal | `app-inventario-sugerido-preview ion-footer ion-button`. Su `disabled` es el oráculo de DM-SUG-062: `true` ⇔ la sugerencia ya se convirtió |
| 🔴 **`cargarCantidad` puede cargar el producto EQUIVOCADO en silencio** | harness | En GERMINADOS pidió `GERPROGCH002BOL` (id 26) y cargó `GERPROALF001CAJ` (id 23), devolviendo `ok:true`. El índice de `nodos()` se desalinea del re-query del DOM. **Verificar SIEMPRE el código del producto cargado contra el modelo después de cerrar el modal** — si no, se mide otro producto y el oráculo «falla» sin motivo |
| 🔴 **PEDIDOS exige GPS y el fix nativo falla bajo techo** | cliente | `userMustActivateGPS = true`. `geolocation.service.ts` pide `{enableHighAccuracy:true, timeout:10000, maximumAge:0}` × 3 intentos: **ignora el last-known** (aquí de 24 días) y falla en interiores → «Debe activar el GPS y obtener la ubicación antes de continuar.». **Receta:** lanzar `navigator.geolocation.watchPosition({enableHighAccuracy:true})` para calentar el proveedor y, justo antes de Enviar, reproducir la línea que la app ya corre en `pedido.component.ts:334` — `geoServ.getCurrentPosition().then(c => orderServ.coordenadas = c)`. Con eso el envío pasa con **coordenadas reales del equipo** (11.0489, −63.8649). *Acomodación de harness, no de datos* |
| ⚠ **La pregunta de la sugerencia es la alerta nº 2 de la cadena** | universal | Orden: `¿Desea enviar el Inventario?` → **`¿Desea enviar también la sugerencia de pedido?`** → `El Inventario será enviado` → `… nro. N enviado exitosamente`. **La 4.ª es el único acuse del servidor** (RUNTIME §10): si no llega, no hubo envío |
| ⚠ **Un `getsync` en segundo plano devuelve la app a HOME y tira el formulario en curso** | universal | Se perdió un inventario con 9 productos ya cargados. **Hacer el ciclo inventario → sugerido → lectura en UNA sola corrida**, sin cortes entre scripts |
| ℹ **Tablas de la nube: nombre en PLURAL** | universal | `client_stock_suggested_orders` / `client_stock_suggested_order_details` (no singular). Los pedidos, en cambio, están en `"order"` (singular, palabra reservada: hay que comillarla) |
| ℹ **Mapa categoría → producto (hidroponias)** | cliente | AJO: `MAL013PLS098MOR` · GERMINADOS: `GERPROALF002CAJ`, `GERPROGCH002BOL`, `GERPROALF001CAJ` · FRESCALES: `046013ESP001BOL`, `046PRO003003025` · BERRO: `HIDPROBER001BOL` · TOMATES: `TOMPROMAN001GRA` · TOMATE CHERRY: `TOMPROCHE001CAJ` · ENSALADAS: `CAMPROLEC001BAN` · MAIZ: `CAMPROSDU002BOL` |

---

## 9. Qué quedó sin probar y por qué

| Caso | Motivo |
|---|---|
| DM-SUG-011 | Sin dato: el único cliente con el mismo producto repetido en dos facturas del día no está asignado a ningún vendedor |
| DM-SUG-044 | Exige dejar pasar días y que entren facturas nuevas entre medio |
| DM-SUG-065 | No existe la opción de eliminar el pedido en la móvil (§4.3) |
| DM-SUG-070 / 071 / 075 / 076 | Bloqueados por el **Defecto 1**: la nube nunca recibe una sugerencia |
| **DM-SUG-072 / 073** | **Capa web pendiente** — no había navegador disponible en esta corrida |

**La capa web queda pendiente entera.** Conviene correrla *después* del arreglo del Defecto 1:
hoy no habría nada que mirar en Transacciones → Pedido Sugerido, porque la tabla de la nube
está vacía.
