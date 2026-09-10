# Vuelta 2 · INVENTARIOS Y PEDIDO SUGERIDO — móvil + BD · HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `ciclo_sugerido_3capas_20260909` |
| Fecha | 2026-09-09 |
| Rama bajo prueba | `SaveSuggestedOrder` |
| Playa (descubierta en runtime) | **Isla Coche** — `denarioislacoche.ddns.net:8081` |
| Empresa | `HIDRO_A` · idEnterprise 1 · HIDROPONIAS VENEZOLANAS C.A |
| Usuario | **V3 — ROGER MUESES** · `idUser 469` · login `vendedor3` |
| App / BD local | `6.6.21.4` · `db_version 22` · `window.ng = true` |
| Dispositivo | Infinix X6728, Android 15 · WebView Chrome/152 · 360×744 |
| VGs leídas en vivo (servicio, no localStorage) | `suggestedOrderByDispatchAndReturn = **true**` · `expirationBatch = **false**` · `userMustActivateGPS = true` |
| Clientes ejercitados | **100113** PARAMO PIEDRA AZUL (`id_client 65` / `id_address_client 680`) · **225** EXCELSIOR GAMA SANTA FE EXPRESS (`185`/`800`) · **100121** INSIDE MARKET (`71`/`686`) |
| Resultado | **66 casos: 55 PASS · 3 FAIL · 4 BLOCKED · 3 N-A · 1 observación** |

> **Las tres respuestas que se pedían:**
> 1. **La aritmética cuadró con tolerancia 0** — 24 mediciones producto×escenario, 9 términos cada una, cero divergencias contra el oráculo calculado desde la BD del propio equipo.
> 2. **La sugerencia SÍ llega a la nube.** El Defecto 1 del 08/09 está corregido: dos sugerencias enviadas (`id 4` y `id 5`), con cabecera y detalle completos, y el cotejo término por término nube↔equipo dio **0 divergencias**. DM-SUG-070 y 071 quedan **PASS**.
> 3. **Un defecto nuevo, de impacto:** el sugerido **lee las devoluciones GUARDADAS**, no sólo las enviadas — y como «Guardar» no valida la cantidad (Hallazgo 2 de la vuelta 1), una cantidad negativa **infla el sugerido en silencio**. Medido: +30 unidades (+25 %) sobre un solo producto.

---

## 1. Tabla de veredictos

### Paso 0 · Sincronización y guardas

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-000a | Re-login completo forzando sincronización | ✅ PASS | Salir → `/login` → alta como `vendedor3`. HOME en **19,3 s**. `lastUpdate` avanzó a `2026-09-09 15:32:49`. ⚠ El bloque `# Cliente: hidroponias` de `qa-credentials.env` **sigue diciendo `vendedor4`**; la clave sí es la del bloque |
| DM-SUG-000b | **9999932 LA CORNETERIA en la cartera** | ❌ **FAIL** | **Sigue sin bajar**, con el `da_update` ya estampado. BD local: **17 clientes**, `address_clients` sin la fila 931. UI: `#clienteSelectModal` con **17 ítems**, ninguno 9999932. **Y el cursor quedó quemado** — ver Defecto 1 |
| DM-SUG-000c | Guarda de tenant antes de leer BD | ✅ PASS | `localStorage.user` → `idUser 469 · V3 · ROGER MUESES`; selector de empresa del form = `{idEnterprise:1, coEnterprise:"HIDRO_A", lbEnterprise:"HIDROPONIAS VENEZOLA", coCurrencyDefault:"USD"}`, `disabled=true`, `ng-valid`, **sin `formcontrolname`** (7.ª confirmación de esa variante). Coincide con el encargo ⇒ se sigue |

### Bloque A · El cálculo especial (no-regresión)

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-001 | Migración v21 → v22 al abrir | ⛔ BLOCKED | No se pudo partir de una instalación v21 con datos: la APK ya estaba instalada y la base se recreó en el login del 09/09. **Lo que sí se comprobó:** `db_version = 22`, las dos tablas nuevas existen, y el histórico bajó íntegro (167 facturas · 41 inventarios · 81 devoluciones · 17 clientes) |
| DM-SUG-002 | `suggestedOrderByDispatchAndReturn` en el equipo | ✅ PASS | `true`, leído del `inventariosLogicService` en vivo (no del `localStorage`) |
| DM-SUG-003 | Botón «Pedido Sugerido» en la pestaña Resumen | ✅ PASS | `ion-button.botonAddAmarillo`, `disabled=false`. **Nace en `y = 807` con `innerHeight 744`** y `ocluido=true`; tras `scrollIntoView({block:'center'})` queda en `y = 693`, `ocluido=false` y abre a la primera |
| DM-SUG-010 | **Consolidación** del despacho | ✅ PASS | **6 productos que la consulta vieja daba 0** trajeron su cantidad real: `TOMPROMAN001GRA` **261** · `MAL013PLS098MOR` **100** · `GERPROALF002CAJ` **30** · `GERPROGCH002BOL` **30** · `046013ESP001BOL` **15** · `HIDPROBER001BOL` **15**. Las 3 facturas del 07/09 de 100113/680 entran; antes sólo la ganadora del desempate |
| DM-SUG-011 | **Suma:** mismo producto en dos facturas del día | ⛔ **BLOCKED** | El único cliente de la base con ese caso (9999932, `CAMPROLEC012BOLUNI` 25+25 el 07/09) **no está en la cartera del equipo** (DM-SUG-000b / Defecto 1). Se verificó que **ningún** otro de los 17 clientes tiene un producto repetido entre facturas del mismo día (`oraculo.js` → *«Ningún escenario tiene un producto repetido»*) ⇒ es falta de dato, no un FAIL |
| DM-SUG-012 | **Control:** producto de la factura ganadora | ✅ PASS | `CAMPROLEC001BAN` **8** y `TOMPROCHE001CAJ` **15** — idénticos a lo que daba la consulta vieja. El fix no movió lo que ya funcionaba |
| DM-SUG-013 | Producto **sin factura ese día** | ✅ PASS | `046PRO003003025` aparece en la lista con `dispatched_stock = **0**` (ni ausente ni en blanco), y su `previous_stock = 3` sí entra |
| DM-SUG-014 | Aislamiento por cliente / por sucursal | ✅ PASS (cliente) · 🚫 N-A (sucursal) | `046PRO003003025` se facturó el **07/09 a 8 clientes distintos, 70 unidades**, y aportó **0** al despacho de 100113. Además las devoluciones de 100113 (`id_client 65`) no aparecen en el sugerido de 225 (`185`), y viceversa. **Sucursal: N-A por dato** — la cartera es 1 dirección por cliente (17 clientes / 17 `address_clients`), no hay dos sucursales del mismo `id_client` |
| DM-SUG-015 | **Cambio x cambio**, con el swap como ÚNICO aporte | ✅ PASS | Cliente **225**: `GERPROGCH002BOL` con `previous 0 · dispatched 0 · straight_swap **10**` ⇒ `initial 10`. Es el caso fuerte que pedía el guión. En 100113 el término llegó **0** en los 9 productos (no hay cambios en su ventana), lo que además certifica que no se filtra de otros clientes |
| DM-SUG-016 | Devolución de **Distribución** resta | ✅ PASS | `046013ESP001BOL` `returned_stock = **9**` (Ref 275 ×4 + Ref 277 ×5) · `HIDPROBER001BOL` = **12** (275 ×9 + 277 ×3) |
| DM-SUG-017 | Devolución de **Calidad** NO resta | ✅ PASS | Las **7** unidades de Calidad sobre espinaca (Ref 276 ×3 + Ref 278 ×4) **no** se restaron: 9, no 16. **2.º contrafactual en otro cliente:** en 225, `CAMPROLEC003BAN` tiene una devolución de Calidad de 1 en ventana y su `returned_stock` llegó **0** |
| DM-SUG-018 | Mismo producto con **las dos** devoluciones | ✅ PASS | `046013ESP001BOL`: Distribución 4+5 = **9** restan · Calidad 3+4 = 7 **no** restan. `return_category.subtract_suggestion` = `false` (Calidad) / `true` (Distribución), verificado en la base del equipo |
| DM-SUG-019 | `days_since_last` se calcula y persiste | ✅ PASS | **1** (100113, inventario previo de ayer) y **21** (225, previo del 19/08) — calculados solos y guardados en las 3 capas. **No existe `#diasDesdeUltimoInventario` en el DOM**: sólo se renderiza el de «hasta el siguiente» |
| DM-SUG-020 | Producto con **stock 0** y rotación previa | ✅ PASS | `TOMPROMAN001GRA`: `previous 0 · dispatched 261 · current **0**` ⇒ vendido 261 ⇒ **sugerido 2610**. Repone pese a tener 0 |
| DM-SUG-021 | `days_until_next` tecleado y recálculo | ✅ PASS | Tecleado **10 → 5 → 10**. Con 5, **todos** los sugeridos quedaron exactamente a la mitad (2610→1305 · 500→250 · 150→75 · 620→310 · 220→110 · 20→10) y `CAMPROLEC001BAN` pasó a **0** al caer su bruto (15) por debajo del stock actual (25) |
| DM-SUG-022 | Guarda `current_stock >= sugerido`, **con igualdad exacta** | ✅ PASS | Escenario construido a propósito: `046013ESP001BOL` con `initial 20 − actual 10 − devuelto 9 = vendido 1` ⇒ diaria 1 ⇒ **bruto 10 = actual 10** ⇒ **sugerido 0**. La igualdad exacta dispara la guarda |
| DM-SUG-023 | Guarda de venta negativa | ✅ PASS | `HIDPROBER001BOL`: `initial 25 − actual 20 − devuelto 12 = **−7**` ⇒ `estimated_daily_units = **0**` ⇒ sugerido 0 |
| DM-SUG-024 | Cantidad **negativa** al inventariar | ✅ PASS | `-3` → alerta `Inventario` / *«Complete cantidad, unidad, fecha y lote para continuar.»* `[OK]`, **el modal queda abierto** y el `input` reporta `validity.rangeUnderflow = true`. El `input[placeholder="Ingrese cantidad"]` trae `min="0"` (oráculo de build v21) |
| DM-SUG-025 | Cantidad **0** al inventariar | ✅ PASS | Aceptada (`quStock: 0`, el modal cierra) · persiste al Guardar (`client_stocks_details_units.qu_stock = 0`) · **y llega a la nube** (`client_stock_detail_unit.qu_stock = 0.0000`, inventario 266) |
| DM-SUG-026 | Aritmética completa, ≥ 3 productos, tolerancia 0 | ✅ PASS | **24 mediciones producto×escenario × 9 términos, 0 divergencias.** Ver §3 |

### Bloque B · El sugerido se guarda

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-030 | Generar un sugerido y guardarlo | ✅ PASS | 🔑 **Se guarda al GENERAR la vista previa, no al pulsar ACEPTAR.** Cabecera `co_client_stock_suggested_order = 1788983216162.0` ligada a `co_client_stock = 1788982868820.0`, creada 3 s después de abrir el preview |
| DM-SUG-031 | **Cotejo término por término** guardado ↔ pantalla | ✅ PASS | 9 productos × 8 términos + sugerido = **0 divergencias**, y el `posicion` respeta el orden de la pantalla (0-8) |
| DM-SUG-032 | `nu_details` de la cabecera | ✅ PASS | **9 / 3 / 3** = número exacto de líneas guardadas en las tres sugerencias |
| DM-SUG-033 | Productos con sugerido **0** | ✅ PASS (informativo) | **Se guardan.** Los 2 en 0 (`HIDPROBER001BOL`, `046013ESP001BOL`) están en la tabla con `qu_unit_suggested = 0` y sus 8 términos completos, y se muestran igual al reabrir ⇒ **consistente**. En el **pedido** sí se excluyen (DM-SUG-074) |
| DM-SUG-034 | `days_until_next` tecleado antes de guardar | ✅ PASS | Se guardó **10**, no el 1 por defecto. Con la regeneración a 5, la cabecera pasó a 5; al volver a 10, a 10 |
| DM-SUG-035 | `by_dispatch_and_return` en la cabecera | ✅ PASS | `1` en las tres sugerencias, local y en la nube — trazabilidad de con qué regla se generó |
| DM-SUG-036 | Cerrar la app y volver a abrir | ✅ PASS | `adb am force-stop` + relanzar: la sugerencia sobrevive íntegra (1 cabecera / 9 detalles) y **además volvió con su PK del servidor** (`id_client_stock_suggested_order = 4`), o sea que el merge de bajada funcionó. ⚠ El force-stop deja la app en `/login`: hay que volver a entrar |
| DM-SUG-037 | Dos sugeridos para clientes distintos | ✅ PASS | 100113 (`id 4`, 9 líneas, `days_since_last 1`) y 225 (`id 5`, 3 líneas, `days_since_last 21`) conviven sin mezclarse ni pisarse, local y en la nube |
| DM-SUG-038 | Regenerar sobre el **mismo** inventario | ✅ PASS | **Reemplaza, no duplica.** 3 regeneraciones (10 → 5 → 10) sobre `co_client_stock 1788982868820.0`: siempre **1 sola cabecera**, mismo `co_client_stock_suggested_order`, `da_suggested` y `days_until_next` actualizados, y **9 detalles** (no 27) |

### Bloque C · El submódulo «Pedido Sugerido»

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-040 | Entrar sin sugeridos guardados | ⛔ BLOCKED | No se pudo observar el estado vacío: la sugerencia nace **al generar la vista previa**, y para cuando se entró al submódulo ya había una. La vuelta 1 no dejó ninguna, pero tampoco se entró al submódulo antes de generar. Se repite al inicio de la próxima corrida, antes de tocar nada |
| DM-SUG-041 | Entrar con sugeridos guardados | ✅ PASS con observación | Se listan: `Cliente: 100113 - HIPERMERCADO PARAMO, C.A - PIEDRA AZUL · Nro. Ref.: 4 · Estatus: Pendiente · Fecha: 09/09/2026 15:54`. ⚠ **No muestra la cantidad de líneas** que pedía el guión. ⚠ El `Nro. Ref.` es el `id_client_stock_suggested_order` del servidor: una sugerencia aún no sincronizada se lista como **Ref. 0** |
| DM-SUG-042 | Estado en la lista | ✅ PASS | **Pendiente** antes de convertir, **Enviado** después. Verificado el cambio en vivo sobre la Ref 4 |
| DM-SUG-043 | Abrir una guardada muestra lo guardado | ✅ PASS | Los 9 productos con sus 9 términos, idénticos a lo persistido |
| DM-SUG-044 | Es un **snapshot**, no una consulta en vivo | ✅ PASS (variante) | No se pudo dejar pasar días, pero se hizo el equivalente fuerte: **se cambió el dato de por medio** (una devolución nueva) y se reabrió. La Ref 4 siguió mostrando `046013ESP001BOL dev = **9**` y `GERPROGCH002BOL dev = **0**`, mientras un cálculo nuevo con la misma base da **6** y **6**. Es snapshot |
| DM-SUG-045 | Confirmar la vista previa de una Pendiente | ✅ PASS | ACEPTAR abre el formulario de **Pedido** en `/pedido`, precargado con `quOrder = quSuggested` en los 7 productos con sugerido > 0 |
| DM-SUG-046 | Salir sin confirmar | ✅ PASS | Cerrada con el botón del encabezado: la sugerencia sigue **Pendiente** (`in_order_sent = 0`, `co_order = null`) |

### Bloque D · La decisión al enviar el inventario

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-050 | Enviar un inventario **con** sugerido guardado | ✅ PASS | Cadena de **4 alertas**: `¿Desea enviar el Inventario?` `[Cancelar/Aceptar]` → **`¿Desea enviar también la sugerencia de pedido?`** `[Cancelar/Aceptar]` → `El Inventario será enviado` `[OK]` → `Inventario nro. **266** enviado exitosamente` `[OK]` |
| DM-SUG-051 | Enviar un inventario **sin** sugerido | ✅ PASS | Inventario 269 (cliente 100121, sin abrir la vista previa): **3 alertas, la pregunta no aparece**, y el inventario se envía normal |
| DM-SUG-052 | Responder **SÍ** | ✅ PASS · **BD-OK** | Inventario **266** y sugerencia **id 4** en la nube. Repetido con el inventario **268** / sugerencia **id 5** |
| DM-SUG-053 | Responder **NO** | ✅ PASS | Inventario **267** enviado (`st_delivery = 1`, en la nube) y la sugerencia `1788984813263.0` **quedó local y Pendiente**: `id_client_stock_suggested_order = null`, ausente de la nube tras dos sincronizaciones. Es lo que QA esperaba |
| DM-SUG-054 | Tras responder NO, volver al submódulo | ✅ PASS | Sigue listada como Pendiente y su **ACEPTAR está habilitado** (`disableOrderButton = false`) ⇒ se puede convertir en pedido. Se reabre mostrando su snapshot (dev 6/6/12, sug 150/230/180) |
| DM-SUG-055 | Cancelar el envío con la pregunta en pantalla | ✅ PASS | Cancelar en la 1.ª alerta: **nada se envía**. El inventario siguió `st_delivery = 3`, `id_client_stock = 0`, `pending_transactions = 0`. Nada quedó a medias |

### Bloque E · Un solo pedido por sugerencia

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-060 | Convertir una sugerencia en pedido | ✅ PASS | Sugerencia **id 4** → `in_order_sent = **1**`, `co_order = 1788984970646.0`, `id_order = **169**` — **local y en la nube** (`da_update` de la fila de la nube se movió al segundo del envío) |
| DM-SUG-061 | Volver a la lista tras convertirla | ✅ PASS | `Nro. Ref.: 4 · Estatus: **Enviado**`, mientras la otra sigue `Pendiente` |
| DM-SUG-062 | Abrirla otra vez y confirmar | ✅ PASS | **ACEPTAR llega `disabled = true`** y el click no hace nada (no navega a `/pedido`). **No se crea un segundo pedido** |
| DM-SUG-063 | 🔎 ¿Avisa o se queda mudo? | 🟡 **Observación** | **Mejor de lo que sugería el código:** no es un `return` silencioso, el botón se **deshabilita**, que es una señal visible. Pero **no hay ningún texto que explique por qué**: el vendedor ve un botón gris y no sabe si es porque ya la usó o porque algo falla. Vale una leyenda del tipo *«Esta sugerencia ya generó el pedido nro. 169»* |
| DM-SUG-064 | Verificar en la nube tras el 2.º intento | ✅ PASS | `SELECT count(*) FROM "order" WHERE co_order='1788984970646.0'` → **1**. Y sólo **1** pedido nuevo en toda la corrida (`id_order > 168`) |
| DM-SUG-065 | Eliminar el pedido creado desde una sugerencia | 🚫 N-A | La móvil no ofrece borrar un pedido **Enviado** (el trash sólo aparece en Guardado). Sin la acción, la pregunta del REQ no es ejercitable desde la app |
| DM-SUG-066 | Dos sugerencias del mismo cliente | ✅ PASS | Marcar la Ref 4 como Enviado **no bloqueó** la otra de 100113: siguió Pendiente y convertible |

### Bloque F · Sincronización y las tres capas

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-070 | **La sugerencia llega a la nube** | ✅ **PASS** · BD-OK | 🔑 **El defecto del 08/09 está corregido.** `client_stock_suggested_orders` pasó de 3 a **5** filas y `client_stock_suggested_order_details` de 5 a **17** (+9 y +3). Cabecera completa: `id_client_stock` 266/268, `id_user 469`, `co_user V3`, `co_enterprise HIDRO_A`, `days_since_last`, `days_until_next`, `by_dispatch_and_return`, `da_suggested`, `nu_details`. `pending_transactions = 0`, sync **inmediata** |
| DM-SUG-071 | **Cotejo en la nube, término por término** | ✅ PASS | 9 productos (inv. 266) + 3 (inv. 268) × 9 términos = **0 divergencias** contra el equipo. Ver §3. Única salvedad, no es divergencia: `estimated_daily_units` llega con 15 dígitos (`0.380952380952381`) contra el doble de JS (`0.38095238095238093`) — es la precisión de la columna `NUMERIC`, un residuo de 7·10⁻¹⁷ |
| DM-SUG-072 / 073 | Capa web | ⏭ fuera de alcance | Corresponde a la vuelta 4. **Ya hay material:** 2 sugerencias enviadas y 1 pedido |
| DM-SUG-074 | El pedido generado, en la web/nube | ✅ PASS | Pedido **169** en la nube con `nu_details = **7**`: los 2 productos con sugerido 0 **quedaron excluidos** (en el modelo local viajaban como líneas sin unidades). `nu_amount_total = nu_amount_final = 9.694,10 USD`, `st_order = 1`, `id_user 469` |
| DM-SUG-075 | **Merge:** una local pendiente y otras en la nube | ✅ PASS | Tras 2 sincronizaciones conviven las 3 locales: la pendiente (`id = null`), la id 4 y la id 5. Ninguna se pisó ni se perdió. Las 3 sugerencias de la nube que son de **otro vendedor** (`id_user 468`) **no bajaron** — correcto |
| DM-SUG-076 | **Merge del estado:** enviada en nube, pendiente en el equipo | ⛔ BLOCKED | No se puede fabricar ese desfase desde la app (haría falta escribir en la nube, y la conexión de QA es de sólo lectura) |
| DM-SUG-077 | Sincronizar dos veces sin cambios | ✅ PASS | 19,4 s y 15,2 s. Antes y después: **3 cabeceras / 15 detalles** locales, `count(distinct cabecera)` en detalles = 3. No duplica ni pierde |

### Bloque G · No-regresión de los módulos vecinos · y la parte A del encargo

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-080 | **Inventarios: ciclo completo** (crear, guardar, reabrir, enviar, cotejar) | ✅ PASS · BD-OK | 4 inventarios creados, guardados y enviados; los 4 en la nube con `st_client_stock = 1`. Round-trip §9 perfecto: reabierto desde BUSCAR conserva cliente, comentario, `días = 10` y **las 9 capturas** (incluido el 0) |
| DM-SUG-080b | Campos obligatorios en inventarios | ✅ PASS | Sin cliente, las tabs Inventario/Resumen/Adjuntos llegan `disabled = true`; al fijarlo, las 4 pasan a `false`. La cantidad inválida se rechaza en el modal con alerta. `ion-input#responsable` (comentario) llega `required = false` ⇒ `requiredComment` no aplica |
| DM-SUG-081 | Pedidos: un pedido normal no queda ligado a una sugerencia | 🚫 N-A | Corresponde a la **vuelta 3**. Se deja el dato: hoy sólo existe 1 pedido nuevo (169) y sí está ligado, por diseño |
| DM-SUG-082 | Devoluciones: ciclo completo | ✅ PASS | Cubierto por la vuelta 1 (Refs 277 y 278, ambas BD-OK). En esta vuelta se creó además una **Guardada** para la verificación C, y se **borró** al terminar |
| DM-SUG-083 | La devolución recién creada entra al siguiente sugerido con el signo correcto | ✅ PASS | Las Refs 277 (Distribución) y 278 (Calidad) de ayer entraron: 277 restó, 278 no |
| DM-SUG-085 | Lote y vencimiento obligatorios (`expirationBatch = true`) | 🚫 N-A | La VG está en **`false`** en este equipo, leída del servicio. **Contrafactual medido, no asumido:** `input[placeholder="Ingrese lote"].required = false`, el `.save-btn` aceptó con el lote **vacío** en los 13 productos cargados, y la nube guardó `nu_batch = ''` con `da_expiration` = HOY. No es FAIL |

### Verificación C · ¿El sugerido lee las devoluciones GUARDADAS?

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-090 | **El sugerido lee devoluciones guardadas (no enviadas)** | ❌ **FAIL** | **Sí las lee.** Ver Defecto 2 |
| DM-SUG-091 | **«Guardar» de devoluciones no valida la cantidad** — reconfirmación | ⚪ **OBSERVACIÓN** (no se reporta) | `-3` entró a `return_details.qu_product` sin alerta, pero **`Enviar` sí lo rechaza**: no puede salir del teléfono. Decisión de QA 09/09 — el defecto real es que el sugerido lea lo guardado (Defecto 2) |

---

## 2. Registros creados en el sistema

### Inventarios

| Ref (`id_client_stock`) | `co_client_stock` | Cliente | Líneas | Sugerencia | Nube |
|---|---|---|---|---|---|
| **266** | `1788982868820.0` | 100113 PARAMO PIEDRA AZUL | **9** | generada y **enviada (SÍ)** | ✅ BD-OK |
| **267** | `1788984757459.0` | 100113 PARAMO PIEDRA AZUL | 3 | generada, **NO enviada** | ✅ BD-OK |
| **268** | `1788985478976.0` | 225 EXCELSIOR GAMA SANTA FE EXPRESS | 3 | generada y **enviada (SÍ)** | ✅ BD-OK |
| **269** | `1788985654600.0` | 100121 INSIDE MARKET CIGARRAL | 1 | **ninguna** (control de DM-SUG-051) | ✅ BD-OK |

Los 4 con `st_client_stock = 1`, `id_user 469`, `co_enterprise HIDRO_A`, comentario `QA vuelta2 sugerido 09/09 A` (el 269 sin comentario).

### Sugeridos

| Ref (`id_client_stock_suggested_order`) | `co_client_stock_suggested_order` | Inventario | Cliente | Líneas | `días desde/hasta` | Estado | Nube |
|---|---|---|---|---|---|---|---|
| **4** | `1788983216162.0` | 266 | 100113 | **9** | 1 / 10 | **Enviado** → pedido 169 | ✅ sí |
| — (**Ref 0** en la lista) | `1788984813263.0` | 267 | 100113 | 3 | 1 / 10 | **Pendiente** | ⛔ **no** (se respondió NO — correcto) |
| **5** | `1788985534564.0` | 268 | 225 | 3 | **21** / 10 | **Pendiente** | ✅ sí |

### Pedidos

| Ref (`id_order`) | `co_order` | Cliente | Líneas | Monto | Nace de |
|---|---|---|---|---|---|
| **169** | `1788984970646.0` | 100113 | **7** (los 2 sugeridos en 0 excluidos) | **9.694,10 USD** | sugerencia **id 4** |

### Devoluciones

| `co_return` | Tipo | Estado final | Detalle |
|---|---|---|---|
| `1788984563412.0` | Distribución (61) | **creada Guardada y BORRADA al cerrar** | `GERPROGCH002BOL` ×6 y `046013ESP001BOL` ×**−3**, factura 20118282. Era el instrumento del Defecto 2. **Se eliminó desde la UI** para no contaminar la vuelta 3: `returns` con `st_delivery=3` = 0 y `return_details` con `qu_product < 0` = 0 |

**Diff de baseline en la nube:** `client_stock` 160 → **162** en el 1.er corte y **164** al cierre (+4, exactamente los 266-269) · `client_stock_suggested_orders` 3 → **5** (+2) · `client_stock_suggested_order_details` 5 → **17** (+12 = 9 + 3) · `"order"` 168 → **169** (+1). **Cero filas inesperadas.** `pending_transactions = 0` y `failed_transactions = 0` en todo el módulo.

---

## 3. Cotejo término por término (producto × 9 términos)

Oráculo **calculado** en cada corte desde la BD SQLite del propio equipo con
`automation/sugerido/oraculo-terminos.js` (espejo exacto de `calcularTotalesSugerenciaPedido`).
**Tolerancia 0.** `ini = prev + desp + swap` · `vend = ini − act − dev` · `diar = vend / díasDesde`
(0 si `vend < 0`) · `sug = round(diar × díasHasta)`, y **0 si `act >= sug`**.

### Inventario 266 · cliente 100113 · `díasDesde 1` · `díasHasta 10` — pantalla ↔ local ↔ nube

| Producto | prev | desp | swap | **dev** | act | ini | vend | diaria | **sugerido** | Qué caso prueba |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `TOMPROMAN001GRA` | 0 | **261** | 0 | 0 | **0** | 261 | 261 | 261 | **2610** | consolidación (antes daba 0) · stock 0 con rotación · cantidad 0 |
| `MAL013PLS098MOR` | 100 | **100** | 0 | 0 | 150 | 200 | 50 | 50 | **500** | consolidación |
| `HIDPROBER001BOL` | 10 | **15** | 0 | **12** | 20 | 25 | **−7** | **0** | **0** | consolidación · Distribución 9+3 · **venta negativa** |
| `CAMPROLEC001BAN` | 20 | 8 | 0 | 0 | 25 | 28 | 3 | 3 | **30** | **control** (no se movió) |
| `046013ESP001BOL` | 5 | **15** | 0 | **9** | 10 | 20 | 1 | 1 | **0** | Distribución 4+5 · Calidad 3+4 **ignorada** · **igualdad exacta** (bruto 10 = actual 10) |
| `046PRO003003025` | 3 | **0** | 0 | 0 | 1 | 3 | 2 | 2 | **20** | **sin factura ese día** · **aislamiento por cliente** (70 uds a 8 clientes) |
| `GERPROALF002CAJ` | 25 | **30** | 0 | 0 | 40 | 55 | 15 | 15 | **150** | consolidación |
| `GERPROGCH002BOL` | 35 | **30** | 0 | 0 | 3 | 65 | 62 | 62 | **620** | consolidación |
| `TOMPROCHE001CAJ` | 12 | 15 | 0 | 0 | 5 | 27 | 22 | 22 | **220** | **control** |

**9/9 idénticos en las tres capas.** El mismo escenario recalculado con `díasHasta = 5` dio 9/9 otra vez (todos a la mitad exacta, y `CAMPROLEC001BAN` cayendo a 0 por la guarda) — **18 mediciones limpias sobre este inventario**.

### Inventario 268 · cliente 225 · `díasDesde **21**` · `díasHasta 10` — pantalla ↔ local ↔ nube

| Producto | prev | desp | **swap** | dev | act | ini | vend | diaria | **sugerido** | Qué caso prueba |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `GERPROGCH002BOL` | 0 | 0 | **10** | 0 | 2 | 10 | 8 | 0,380952… | **4** | **cambio x cambio como ÚNICO aporte** · redondeo (3,8095 → 4) |
| `046013ESP001BOL` | 4 | 0 | **7** | **2** | 1 | 11 | 8 | 0,380952… | **4** | swap + Distribución · redondeo |
| `CAMPROLEC003BAN` | 9 | 0 | **8** | **0** | 2 | 17 | 15 | 0,714285… | **7** | swap · **Calidad de 1 en ventana que NO resta** · redondeo (7,1429 → 7) |

**3/3 idénticos en las tres capas.**

### Inventario 267 · cliente 100113 — el corte que destapó el Defecto 2

| Producto | prev | desp | swap | **dev medido** | dev si **sólo enviadas** | act | vend | **sugerido** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `046013ESP001BOL` | 10 | 15 | 0 | **6** | 9 | 4 | 15 | **150** *(debería 120)* |
| `GERPROGCH002BOL` | 3 | 30 | 0 | **6** | **0** | 4 | 23 | **230** *(debería 260)* |
| `HIDPROBER001BOL` | 20 | 15 | 0 | **12** | 12 | 5 | 18 | **180** (control, no cambió) |

---

## 4. Defectos

### 🔴 Defecto 1 — S1 · LA CORNETERIA sigue sin bajar, **y ahora el cursor de sincronización está quemado**

**Qué pasa.** Desarrollo estampó `address_client.da_update` de la fila **931** a las
`2026-09-09T19:22:09.126Z`, como pedía la vuelta 1. El equipo sincronizó **después**
(login a las 19:29, HOME a las 19:32) y el cliente **sigue sin aparecer**.

**Lo nuevo, y es lo grave.** El equipo **sí recibió ese registro** y avanzó su cursor:

```
versionsTables · addressClientTable.last_update = 2026-09-09 15:22:09.126   (= 19:22:09.126Z)
address_client 931 en la nube ·        da_update = 2026-09-09T19:22:09.126Z
```

El cursor quedó clavado **al milisegundo** en el `da_update` de la fila 931 — o sea que el
servidor la ofreció — **y sin embargo la fila no está en `address_clients`**: la tabla local
tiene **17 filas**, `max(id_address) = 852`. Como la sincronización es incremental por
`da_update` y el cursor **ya pasó ese instante**, **ninguna sincronización futura va a volver a
ofrecer ese registro**. El cliente queda invisible de forma permanente.

**Y falta la mitad del dato.** `client.da_update` de 9999932 sigue en
`2026-09-08T19:08:01.483Z`, que es **exactamente** el cursor `clientTable` del equipo
(`2026-09-08 15:08:01.483`). Con el filtro incremental, esa fila **nunca se envía**: aunque la
dirección hubiera entrado, el cliente padre no existe en el equipo.

| Comprobación | Resultado |
|---|---|
| Cartera en BD local | **17** clientes / **17** `address_clients`, sin 9999932 |
| Cartera en la UI | `#clienteSelectModal` con **17** ítems, sin 9999932 ni «CORNETERIA» |
| Cursor `addressClientTable` | **`2026-09-09 15:22:09.126`** = `da_update` de la fila 931 |
| Cursor `clientTable` | `2026-09-08 15:08:01.483` = `client.da_update` de 9999932 |
| Asignación en la nube | `user_address_clients` id 40 · `id_user 469` · `co_user V3` · `co_operation 'I'` · activa |

**Para desarrollo.** (a) Al asignar un cliente a un vendedor hay que estampar **`client.da_update`
además de `address_client.da_update`**, y con una fecha **posterior** al corte que el equipo ya
tiene. (b) Más de fondo: **el cursor no debe avanzar por registros que no se insertaron** —
hoy un fallo silencioso en el `INSERT OR REPLACE` (o un filtro del lado servidor que no coincide
con el `last_update` que devuelve) deja el dato perdido para siempre, sin ningún aviso.

**Salida inmediata para la vuelta 3.** Volver a estampar `da_update` de `address_client` 931
**y** de `client` 316 con `now()`, y sincronizar. DM-SUG-011 queda listo para medirse.

**Impacto en esta corrida:** DM-SUG-011 ⛔ BLOCKED (es el único caso que se pierde).

---

### 🔴 Defecto 2 — S2 · El sugerido lee las devoluciones **GUARDADAS**, y con una cantidad negativa infla el pedido en silencio

**Qué pasa.** `getReturnsByDistribution` filtra por tipo de devolución, cliente, empresa y fecha,
pero **no por estado de envío**: entran las devoluciones `st_delivery = 3` (Guardadas, que nunca
salieron del teléfono) igual que las enviadas. Combinado con el Hallazgo 2 de la vuelta 1
—«Guardar» no valida la cantidad— una cantidad **negativa** guardada **resta de la resta**, es
decir **aumenta** el sugerido.

**El experimento, con un control dentro.** Se guardó (**sin enviar**) una devolución de
**Distribución** para 100113 con dos líneas y se generó un sugerido nuevo:

| Producto | Devoluciones **enviadas** en ventana | Línea de la **guardada** | `returned_stock` **medido** | Lectura |
|---|---:|---:|---:|---|
| `GERPROGCH002BOL` | **0** | **+6** | **6** | el 6 sale **entero** de la guardada ⇒ prueba directa |
| `046013ESP001BOL` | 9 (Ref 275 ×4 + Ref 277 ×5) | **−3** | **6** | 9 − 3 ⇒ la negativa **redujo la resta** |
| `HIDPROBER001BOL` | 12 | — | **12** | **control**: no se movió |

La app midió `dev_todas` (**6, 6, 12**) y nunca `dev_solo_enviadas` (**9, 0, 12**).

**El daño, cuantificado.** Sobre `046013ESP001BOL`, con `prev 10 · desp 15 · act 4` y
`díasDesde 1 · díasHasta 10`:

```
correcto (sólo enviadas):  vendido = 25 − 4 − 9 = 12   ⇒  sugerido 120
medido   (con la guardada): vendido = 25 − 4 − 6 = 15   ⇒  sugerido 150
                                                            ⇒  +30 uds  (+25 %)
```

Y sobre `GERPROGCH002BOL` el error va en el otro sentido: `230` en vez de `260` (−30).
**Nada en pantalla lo delata**: el desglose muestra «Dev. Distribución 6», que se lee como un
dato legítimo.

**Por qué importa.** Un borrador que el vendedor dejó a medias —o con un tipeo— corrige el pedido
sugerido de ese cliente hasta que lo envíe o lo borre. Y la contención del Hallazgo 2 («el
registro no llega a la nube mientras no se envíe») **no cubre este camino**: el cálculo es local.

**Reproducción.** Devolución nueva → cliente + factura → un producto con cantidad `-3` →
**Guardar** → Aceptar. Inventario nuevo del mismo cliente con ese producto → Resumen → Pedido
Sugerido → mirar `returned_stock`.

**Dos arreglos, y hacen falta los dos.**
1. **`getReturnsByDistribution` debe filtrar por estado de envío** (o al menos excluir
   `st_delivery = 3`): una devolución que no salió del teléfono no es un hecho comercial.
2. *(Opcional, defensa en profundidad)* que «Guardar» valide la cantidad igual que «Enviar». **No es requisito**: con el filtro por `st_delivery`, lo guardado deja de influir.

---

### ⚪ «Guardar» de devoluciones no valida la cantidad — *no se reporta como defecto*

Reproducido literalmente: con `Cantidad Devuelta = -3` la app pidió confirmación
`[Cancelar/Aceptar]`, respondió *«¡Su Devolución se ha guardado!»* `[OK]` y dejó
`return_details.qu_product = -3` (`co_return 1788984563412.0`). **`Enviar` sí lo rechaza.**

**Decisión de QA (09/09): no es un defecto propio.** La validación existe donde importa —al
enviar—, así que **no puede salir del teléfono una devolución con cantidad incorrecta**. Lo
que hace daño no es guardar un número malo, sino que **el sugerido lea lo guardado**, y eso
ya está levantado como Defecto 2.

Dicho de otro modo: es **un solo defecto con dos arreglos posibles**. Filtrar por
`st_delivery` en la consulta del sugerido lo cierra del todo; validar también al Guardar lo
cerraría igual. El primero es el correcto —una devolución que no salió del teléfono no es un
hecho comercial— y el segundo es defensa en profundidad, no un requisito.

---

### 🟠 Defecto 4 — S3 · La alerta de rechazo del modal de inventario nombra campos que la VG apagó

Con `expirationBatch = **false**` —lote y vencimiento no son obligatorios, verificado con el
campo vacío— el rechazo por cantidad inválida dice:

```
Inventario
Complete cantidad, unidad, fecha y lote para continuar.   [OK]
```

El vendedor sale a buscar un lote y una fecha que **la configuración no le pide**, mientras el
problema real (la cantidad) queda escondido entre otros tres campos. El mensaje debería nombrar
sólo lo que falta, y en este tenant sólo falta la cantidad.

---

### 🟡 Observaciones (no se reportan como defecto)

1. **«Venta Sugerida» rotula la VENTA, no una sugerencia.** El desglose de la vista previa muestra
   `Venta Sugerida 15` para `sold_units = 15`, mientras el sugerido real va arriba como
   `Sugerido UNIDAD: 150`. Dos cosas distintas con nombres que se confunden.
2. **La pantalla clampa los negativos a 0.** `formatNumber` fuerza a 0 todo valor negativo, así que
   una venta de **−7** se muestra como **0**. El modelo y la base sí guardan el −7. Es una decisión
   de presentación, pero esconde justo el caso que dispara la guarda de venta negativa.
3. **La lista del submódulo no muestra la cantidad de líneas** que pedía DM-SUG-041 (sí cliente,
   Ref, estatus y fecha), y usa el `id` del servidor como `Nro. Ref.`, de modo que una sugerencia
   aún no sincronizada se lista como **Ref. 0** — la misma convención que los inventarios.
4. **A vigilar — la consulta de devoluciones no filtra por sucursal.** `getReturnsByDistribution`
   acota por `id_client` + `id_enterprise`, mientras la del despacho acota por `id_client` **+
   `id_address_client`**. Con un cliente de dos sucursales, las devoluciones de una restarían en
   el sugerido de la otra. **No se pudo reproducir**: la cartera del equipo tiene una sola
   dirección por cliente. Y el `src/` del árbol de trabajo es la rama de QA, no `SaveSuggestedOrder`,
   así que **conviene confirmarlo con desarrollo** antes de darlo por cierto.
5. **`automation/sugerido/oraculo.js` no redondea y produciría FAILs que no son defectos.** La app
   hace `Math.round(diaria × díasHasta)` **y evalúa la guarda del stock sobre el valor ya
   redondeado**. Con el cliente 225 (diarias 0,3809 y 0,7143) el oráculo sin redondeo habría
   marcado 3 divergencias inexistentes. Se agregó `automation/sugerido/oraculo-terminos.js`, que
   sí redondea y calcula los 9 términos; **conviene alinear `oraculo.js` o reemplazar su uso**.

---

## 5. Patrones y selectores nuevos

| Patrón / selector | Alcance | Detalle |
|---|---|---|
| 🔴 **La barra de pestañas se va FUERA DEL VIEWPORT POR ARRIBA tras hacer scroll en Resumen** | universal | Es el reflejo exacto de la trampa del botón «Pedido Sugerido». Para alcanzarlo hay que bajar, y con eso el `ion-segment` queda en **`y = −20`**: el click al vacío no cambia de pestaña **y el helper devuelve `true`** porque el elemento existe. **Receta: `ion-content.scrollToTop()` + `scrollIntoView` del `ion-segment`, RE-MEDIR, exigir `rect.top > 0 && rect.bottom < innerHeight`, y confirmar con `classList.contains('segment-button-checked')`** — sin esa confirmación se sigue trabajando sobre la pestaña equivocada |
| 🔴 **`disableOrderButton` se lee ANTES de tiempo y miente** | universal | Recién abierta la vista previa, el ACEPTAR reporta `disabled = true` aunque haya 7 sugeridos > 0: `disableOrderButton` se calcula en `ngOnInit` y la detección de cambios aún no corrió. A los ~2,5 s (y con `previewReady = true`) llega `false`. **Esperar `previewReady` antes de juzgar el botón**, o se levanta un falso «el ACEPTAR nunca habilita» |
| 🔴 **La vista previa SÍ muestra los 9 términos en pantalla — la trampa del guión quedó obsoleta** | universal | Por producto: `Sugerido UNIDAD: 150` · `Inv. Inicial 25 · Inv. Anterior 10 · Despacho 15 · Cambio por cambio 0` · `Venta Sugerida 15 · Inv. Inicial 25 · Inv. Actual 4 · Dev. Distribución 6` · `Ventas Diarias Estimadas: 15,00`. Son dos bloques, cada uno encabezado por su resultado (el «Inv. Inicial» repetido es el operando del segundo, no un duplicado). **Aun así hay que leer el componente para cotejar**: la pantalla formatea (`15,00`) y **clampa los negativos a 0** |
| 🔴 **La sugerencia se guarda al GENERAR la vista previa, no al ACEPTAR** | universal | La fila de `client_stock_suggested_orders` aparece a los ~3 s de abrir el preview, **antes de que exista el `client_stocks`** del inventario (que se escribe recién al Guardar). Cada regeneración **actualiza la misma fila**. ⇒ para ver la lista vacía de DM-SUG-040 hay que entrar al submódulo **antes** de abrir ninguna vista previa |
| 🔴 **El modelo del pedido NO vive en `orderServ.newOrder` en este build** | universal | `app-pedido` → `ng.getComponent(...)` → **`orderServ.order`**. Un `Object.values(c).find(v => 'newOrder' in v)` falla de forma intermitente. **Receta estable: barrer los servicios del componente buscando el que tenga `Array.isArray(v.orderDetails)`, un nivel y dos niveles adentro** |
| 🔴 **El módulo INVENTARIOS tiene un TERCER botón: «SUGERENCIAS DE PEDIDO»** | cliente/build | Home del módulo = `["INVENTARIO", "BUSCAR", "SUGERENCIAS DE PEDIDO"]`. Es la ruta del Bloque C, y también nace bajo el fold: `scrollIntoView` + re-medir |
| 🔴 **El buscador de productos del Tab Inventario SÍ filtra on-keyup en este build** | cliente/build | `TOMATES` (4 ítems) + teclear `TOMPROMAN001GRA` → **1** ítem **sin tocar la lupa**. **Contradice `[run_vzla-20260818]`** («exige la lupa») y reconfirma `[kron-20260817]`. En cambio el **modal de clientes NO filtra on-keyup**: 17 antes y 17 después de teclear, y sólo la lupa `search-circle-sharp` lo baja a 1 (**9.ª confirmación**). ⇒ tres buscadores, tres comportamientos, medir por control |
| 🔴 **`expirationBatch = false`: 2.º contrafactual, ahora en Isla Coche** | universal | `input[placeholder="Ingrese lote"].required = false`, el `.save-btn` aceptó con el lote **vacío** en **13 productos**, y la nube guardó `nu_batch = ''` + `da_expiration` = HOY. Confirma `[run_vzla-20260818]` en otra playa. ⚠ **Pero la alerta de rechazo sigue nombrando lote y fecha** (Defecto 4): **no usar el texto de la alerta como oráculo de la VG** |
| ✅ **Envío de inventario CON sugerencia = 4 alertas; la pregunta es la nº 2** | universal | `¿Desea enviar el Inventario?` `[Cancelar/Aceptar]` → **`¿Desea enviar también la sugerencia de pedido?`** `[Cancelar/Aceptar]` → `El Inventario será enviado` `[OK]` → `Inventario nro. N enviado exitosamente` `[OK]`. **Sin sugerencia son 3** (la nº 2 desaparece) ⇒ contar alertas es el oráculo barato de DM-SUG-050/051. La **última** sigue siendo el único acuse del servidor |
| ✅ **Cancelar en la alerta nº 1 no envía nada** | universal | Ni el inventario ni la sugerencia. Verificado por BD: `st_delivery` siguió en 3, `id_client_stock = 0`, `pending_transactions = 0` |
| ✅ **`force-stop` + relanzar deja la app en `/login`** | universal | La prueba de persistencia entre reinicios exige **volver a iniciar sesión**. La BD local sobrevive intacta (no se borra: el borrado sólo ocurre al entrar con **otro** usuario) y la sugerencia volvió **con su PK del servidor**, prueba de que el merge de bajada funciona |
| ✅ **El pedido nacido de una sugerencia lleva las 9 líneas en local pero 7 en la nube** | universal | Los productos con sugerido 0 viajan como `orderDetails` **con `orderDetailUnit: []`**; el servidor los descarta y guarda `nu_details = 7`. ⚠ **`nuAmountTotal` del modelo en memoria llega en 0** aunque el pedido se envíe con 9.694,10 — **no usar el total del componente como oráculo**, usar la fila de la nube |
| ✅ **`Nro. Ref.` del submódulo = `id_client_stock_suggested_order` del servidor** | universal | Una sugerencia no sincronizada se lista como **Ref. 0**, igual que los inventarios Guardados. No es un error de la lista |
| ⚠ **`address_clients` local tiene PK `id_address`, no `id_address_client`** | universal (BD) | Un `JOIN ... ON ac.id_address_client = ...` aborta con `no such column`. El `id_address_client` de la nube es el `id_address` local |
| ⚠ **`client_stock` de la NUBE no tiene `nu_details`** | universal (BD) | La local `client_stocks` sí. Un `SELECT nu_details` sobre la nube aborta la consulta entera (hermano del `na_product` de `[grupo_fiel-20260817]`) |
| ⚠ **El cursor de sincronización vive en `versionsTables`** | universal (diagnóstico) | Columnas `name_table` / `last_update` (no `na_table`). **Es la herramienta que distingue «el servidor no lo mandó» de «lo mandó y no se guardó»**: si el cursor avanzó hasta el `da_update` del registro y el registro no está, el dato se perdió y no vuelve. Es lo que destapó el Defecto 1 |
| ℹ **Mapa categoría → producto (hidroponias), ampliado** | cliente | 13 categorías: AJO(5) BERRO(3) BROCOLI(2) CEBOLLIN(2) ENSALADAS(8) FRESCALES(7) FRUTAS(1) GERMINADOS(5) HONGOS(1) LECHUGAS(3) MAIZ(2) TOMATE CHERRY(2) TOMATES(4). AJO→`MAL013PLS098MOR` · BERRO→`HIDPROBER001BOL` · ENSALADAS→`CAMPROLEC001BAN`, `CAMPROLEC003BAN` · FRESCALES→`046013ESP001BOL`, `046PRO003003025` · GERMINADOS→`GERPROALF002CAJ`, `GERPROGCH002BOL` · TOMATE CHERRY→`TOMPROCHE001CAJ` · TOMATES→`TOMPROMAN001GRA` |
| ℹ **Guarda de GPS: con caché caliente el módulo entra en segundos** | cliente | Home del módulo 1,0 s · formulario 2,2-7,3 s, contra los 69,5 s de devoluciones con caché fría de la vuelta 1. Para PEDIDOS sigue haciendo falta la receta: `watchPosition({enableHighAccuracy:true})` para calentar y luego `geoServ.getCurrentPosition().then(c => orderServ.coordenadas = c)` — devolvió `11.0489854, −63.8650085` y el envío pasó a la primera |

---

## 6. Qué quedó sin probar y por qué

| Caso | Motivo |
|---|---|
| **DM-SUG-011** (la suma) | ⛔ El cliente 9999932 sigue sin bajar — **Defecto 1**. Ningún otro cliente de la cartera tiene el caso. Se destraba estampando `client.da_update` **y** `address_client.da_update` con `now()` |
| **DM-SUG-001** (migración desde v21) | ⛔ Exige una instalación que venga de v21 **con datos**; acá la APK ya estaba puesta y la base se recreó |
| **DM-SUG-040** (lista vacía) | ⛔ La sugerencia nace al generar la vista previa; para cuando se entró al submódulo ya existía. **Se mide al inicio de la próxima corrida, antes de tocar nada** |
| **DM-SUG-076** (merge del estado) | ⛔ Haría falta escribir en la nube para fabricar el desfase; la conexión de QA es de sólo lectura |
| **DM-SUG-014 por SUCURSAL** | 🚫 Sin dato: 17 clientes, 17 direcciones, una por cliente |
| **DM-SUG-065** (eliminar el pedido) | 🚫 La móvil no ofrece borrar un pedido Enviado |
| **DM-SUG-072 / 073** | ⏭ Capa **web**, vuelta 4. Ya hay material: sugerencias **id 4** y **id 5**, y el pedido **169** |
| **DM-SUG-081** | ⏭ Pedido normal sin partir de sugerencia: vuelta 3 |
| Adjuntos / firma en inventarios | Fuera del REQ; no es obligatorio (`nu_attachments = 0` en los 4 envíos) |

---

## 7. Lo que queda listo para las vueltas 3 y 4

- **Vuelta 3 (pedidos):** existe el pedido **169** (`co_order 1788984970646.0`, 7 líneas, 9.694,10 USD)
  nacido de la sugerencia **id 4**, y la sugerencia **id 5** (cliente 225) sigue **Pendiente** y
  convertible — sirve para DM-SUG-066/081 sin fabricar nada. Queda además una sugerencia **sólo
  local** (`1788984813263.0`) para probar que el auto-send no la manda sola.
- **Vuelta 4 (web):** en `Transacciones → Pedido Sugerido` deben aparecer **id 4** (Enviado, con
  pedido 169) e **id 5** (Pendiente), con 9 y 3 líneas y los términos de las tablas del §3.
- **El equipo quedó limpio:** la devolución de prueba con el `-3` se borró desde la UI
  (`returns` con `st_delivery = 3` → 0, `return_details` con `qu_product < 0` → 0).
