# Vuelta 1 · DEVOLUCIONES — ciclo «Pedido Sugerido guardado» · HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `ciclo_sugerido_3capas_20260909` |
| Fecha | 2026-09-09 |
| Rama bajo prueba | `SaveSuggestedOrder` |
| Playa (descubierta en runtime) | **Isla Coche** — `denarioislacoche.ddns.net:8081` (leída del host del POST, no asumida) |
| Empresa | `HIDRO_A` · idEnterprise 1 · HIDROPONIAS VENEZOLANAS C.A |
| Usuario | **V3 — ROGER MUESES** · `idUser 469` · login `vendedor3` |
| App / BD local | `6.6.21.4` · `db_version 22` · `window.ng = true` · `sqlitePlugin` disponible |
| Dispositivo | Infinix X6728, Android 15 · WebView Chrome/152 · 360×744 |
| Cliente ejercitado | **HIPERMERCADO PARAMO, C.A - PIEDRA AZUL** — `co 100113` / `id_client 65` / `id_address_client 680` |
| Cliente NO disponible | **INVERSIONES 250 LA CORNETERIA** — `co 9999932` / `id_address_client 931` → **no bajó al equipo** (§ Hallazgo 1) |
| VGs leídas en vivo (`returnLogic` + `globalConfiguration`) | `validateReturn=true` · `requeridedNroFactura=true` · `bloquearFactura=false` · `validateClient=false` · `signatureReturn=true` · `userCanUploadFiles=true` · `expirationBatch=false` · `enterpriseEnabled=false` · `userMustActivateGPS=true` · `suggestedOrderByDispatchAndReturn=true` |
| Resultado | **37 casos: 34 PASS · 2 FAIL · 1 BLOCKED** — dos de los PASS van con reserva (DM-DEV-014 y DM-DEV-035, detallados abajo) |

> **Lo que sí quedó listo para la vuelta 2:** dos devoluciones enviadas y confirmadas en la nube
> sobre 100113, una de **Distribución** y una de **Calidad**, compartiendo el producto
> `046013ESP001BOL` (el caso fuerte DM-SUG-018), ambas con `da_return` de HOY y por tanto
> dentro de la ventana del sugerido.
> **Lo que bloquea la mitad del plan:** el cliente nuevo **LA CORNETERIA no baja al equipo**
> aunque en la nube ya está asignado a V3 — es un problema de la **sincronización del lado
> servidor**, no del teléfono (§ Hallazgo 1).

---

## 1. Tabla de veredictos

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-DEV-001 | Paso 0 · Cerrar sesión y volver a entrar forzando sincronización | ✅ PASS | Salir → `/login` → alta como `vendedor3`. El alert *«Está intentando sincronizar con un usuario diferente… todos los datos anteriores serán borrados»* `[Cancelar/**Aceptar**]` confirma el **borrado completo de la BD local**. Sync a HOME en **30,2 s**. ⚠ **El bloque `# Cliente: hidroponias` de `qa-credentials.env` está desactualizado: dice `vendedor4`** (= V4 KEVIN WILCHES, `idUser 468`), no `vendedor3`. La contraseña sí es la del bloque |
| DM-DEV-002 | Paso 0 · El cliente 9999932 LA CORNETERIA aparece en la cartera | ❌ **FAIL** | **No bajó.** Cartera del equipo = **17 clientes**, ninguno 9999932 — verificado en la BD local (`address_clients`, `clients`) **y en la UI** (`#clienteSelectModal` con 17 ítems). Se probó **3 veces**: login con borrado de BD (14:49:33), *Sincronizar* manual (14:57), 2.º login (14:55:10). Ver § Hallazgo 1 |
| DM-DEV-003 | Paso 1 · Guarda de tenant: empresa HIDRO_A + usuario V3 | ✅ PASS | `localStorage.user` → `idUser 469 · coUser "V3" · naUser "ROGER MUESES"`; selector de empresa del form = `{idEnterprise:1, coEnterprise:"HIDRO_A", lbEnterprise:"HIDROPONIAS VENEZOLA", coCurrencyDefault:"USD"}`. Coincide con el encargo ⇒ se sigue |
| DM-DEV-004 | Navegar HOME → DEVOLUCIONES (guarda de GPS) | ✅ PASS | Lista del módulo en **3,1 s**; el **formulario** tardó **69,5 s la 1.ª vez** (caché de GPS fría) y **12,6 / 15,5 s** después. Ratifica el techo ≥ 120 s de RUNTIME §3 |
| DM-DEV-005 | Form nuevo: tabs Productos/Adjuntos deshabilitadas sin cliente | ✅ PASS | `segs = [General(false), Productos(**true**), Adjuntos(**true**)]` |
| DM-DEV-006 | Selector de empresa con UNA empresa | ✅ PASS | 5.ª confirmación de la variante «sin `formcontrolname` + `disabled=true` + **objeto** completo». No hay que tocarlo |
| DM-DEV-007 | Catálogo de tipos de devolución | ✅ PASS | `returnLogic.returnTypes` = **2 activos**: `60 Calidad` (default) y `61 Distribución`. Coincide 1:1 con la nube (`return_type` con `co_operation<>'D'`); los 8 tipos borrados no bajan |
| DM-DEV-008 | Catálogo de motivos | ✅ PASS | **34 motivos** en el modelo, ids 60-95 (dominio hidroponías: «AA-AGUADO», «ALFALFA - PRESENCIA DE TALLO MARRON», «VENCIDO»…) |
| DM-DEV-009 | Selección de cliente por click real en `#clienteSelectModal` | ✅ PASS | `scrollIntoView` → 1 s → re-leer rect → `mouse.click`. Acertó **3 de 3**; sin alert en form fresco; **no hizo falta `setClientfromSelector`**. La lista no paginó (17 clientes) |
| DM-DEV-010 | `validateReturn=true`: sin factura las tabs siguen bloqueadas | ✅ PASS | Tras fijar cliente las tabs **siguen** `disabled`; al fijar factura pasan las 3 a `false` |
| DM-DEV-011 | Selector de factura | ✅ PASS | `ion-input#invoiceSelect` → `ion-modal#InvoiceeSelectModal` (⚠ doble «e»). **17 facturas** del cliente, formato `Nro Factura: 20118282 · Fecha: 07/09/2026` |
| DM-DEV-012 | `AGREGAR PRODUCTO` con `validateReturn=true` | ✅ PASS | Lista **directamente los 8 productos de la factura** elegida (no familias). Coincide exacto con `invoice_detail` de `20118282` en la nube |
| DM-DEV-013 | Selector de Motivo por línea | ✅ PASS | Abre **`ion-alert` de 36 botones** (34 motivos + `Cancel` / `OK` **en inglés**) y necesita **2 clicks**. Contrasta con Tipo de devolución del mismo form, que abre **`ion-popover`** y se resuelve con 1 |
| DM-DEV-014 | Validación: cantidad **mayor** que la facturada (20 > 15) | ⚠️ PASS con reserva | Rechaza: *«La cantidad a devolver debe estar entre 1 y»* `[Aceptar]`. **El tope no aparece en el mensaje** — leído del `innerHTML` del `.alert-message`, la frase termina en «y». Ver § Hallazgo 3 |
| DM-DEV-015 | Validación: cantidad **0** | ✅ PASS | Misma alerta, envío bloqueado |
| DM-DEV-016 | Validación: cantidad **negativa** (-3) al Enviar | ✅ PASS | Misma alerta, envío bloqueado. El `ion-input` **no tiene atributo `min`** y llega `ng-invalid=false` con `-3`: la guarda vive sólo en el handler de Enviar |
| DM-DEV-017 | **Guardar con cantidad negativa** | ❌ **FAIL** | `Guardar` **no valida nada**: `[Cancelar/Aceptar]` → *«¡Su Devolución se ha guardado!»* y quedó en la BD local `return_details.qu_product = **-3**` (`co_return 1788980342896.0`). Ver § Hallazgo 2 |
| DM-DEV-018 | Campos obligatorios: cantidad vacía en una de dos líneas | ✅ PASS | *«La cantidad a devolver debe estar entre 1 y»* |
| DM-DEV-019 | Campos obligatorios: Nro Factura vacío en una línea | ✅ PASS | *«Complete cantidad y documento en todos los productos.»* |
| DM-DEV-020 | Factura **inexistente** en el campo por línea | ✅ PASS (comportamiento conocido) | `NOEXISTE-ZZZ999` pasó la validación (`ng-invalid=false`) y llegó a la confirmación de envío. **3.ª confirmación** de que `requeridedNroFactura` obliga pero **no valida** — riesgo de dato, no defecto. ⚠ Novedad: ocurre **también con `validateReturn=true`**, donde la cantidad *sí* se valida contra la factura de cabecera |
| DM-DEV-021 | Round-trip §9: Guardar → salir → BUSCAR → reabrir | ✅ PASS | **11/11 valores idénticos**: cliente, factura `20118282`, responsable `QA VUELTA1`, precinto `P0909A`, comentario, tipo `61`, y las 2 líneas (`046013ESP001BOL` 5 / lote `L0909A` / motivo 67 · `HIDPROBER001BOL` 3 / motivo 95) |
| DM-DEV-022 | Guardar es idempotente por `co_return` | ✅ PASS | 3 pulsaciones de Guardar sobre el mismo form → `count(*) = count(DISTINCT co_return) = 80`. Actualiza, no inserta |
| DM-DEV-023 | Enviar devolución de **Distribución** | ✅ PASS · **BD-OK** | 3 alertas; la 3.ª trae el correlativo: *«Devolución nro. **277** enviada exitosamente»*. Respuesta del servidor capturada: `{errorCode:"000", returnId:277, httpStatus:200}` |
| DM-DEV-024 | Enviar devolución de **Calidad** | ✅ PASS · **BD-OK** | *«Devolución nro. **278** enviada exitosamente»*, `returnId:278` |
| DM-DEV-025 | **DM-SUG-018** · mismo producto con las dos devoluciones | ✅ PASS | `046013ESP001BOL` queda con **Distribución ×5 (Ref 277)** y **Calidad ×4 (Ref 278)**, mismo cliente, misma factura, mismo día |
| DM-DEV-026 | Cotejo campo-a-campo en la nube | ✅ PASS · **BD-FIELD-OK** | Cabecera y líneas cuadran 1:1 (ver §2). `nu_amount`/`co_currency` llegan `null` — es lo esperado en este módulo, no mismatch |
| DM-DEV-027 | Diff de baseline en la nube | ✅ PASS | Baseline `count=249 / max(id_return)=276` → tras la corrida **exactamente +2** (277, 278), ambas con `id_user=469`. Cero filas inesperadas |
| DM-DEV-028 | Sync a nube: ¿inmediata o diferida? | ✅ PASS | **INMEDIATA**: la fila estaba en la nube en la 1.ª consulta tras el 3.er alert. `pending_transactions=0`, `failed_transactions=0` |
| DM-DEV-029 | Salir sin guardar de un form **nuevo** | ✅ PASS | Dirty-guard `[Guardar y salir / **Salir sin guardar** / Cancelar]` → `returns` se mantuvo en **81**; el borrador no dejó fila |
| DM-DEV-030 | Salir de un form **recién guardado** | ✅ PASS | **No** dispara dirty-guard (form limpio) — correcto |
| DM-DEV-031 | Trash sólo en Estatus «Guardado» | ✅ PASS | Con un Guardado y varios Enviados en pantalla: trash presente sólo en el Guardado |
| DM-DEV-032 | Borrado con confirmación + cascada | ✅ PASS | `[Cancelar/**Eliminar**]`, sin alert de éxito posterior. `returns`=0 **y** `return_details`=0 para `1788981106384.0`; total 82 → 81, sin detalles huérfanos |
| DM-DEV-033 | Tab ADJUNTOS con `signatureReturn` + `userCanUploadFiles` | ✅ PASS | 3 acordeones: `images` (BUSCAR FOTO / TOMAR FOTO), `file` (Subir Archivo), `sign` (Firma). **El adjunto NO es obligatorio**: los dos envíos pasaron con `nu_attachments=0`. No se tocó TOMAR FOTO (cámara nativa cuelga CDP) |
| DM-DEV-034 | Alcanzabilidad de los controles de la lista (RUNTIME §5.b) | ✅ PASS | `elementFromPoint` sobre el centro de los ítems y del trash devuelve el propio elemento (`ocluido=false`). **No hay FAB flotante** en este módulo |
| DM-DEV-035 | Buscador de la lista BUSCAR | 🟡 Observación | Filtra **sólo por nombre de cliente**: `PARAMO` → 19 de 81. **No** filtra por `Nro. Ref` (`277`→0), `Estatus` (`Enviado`→0) ni `Fecha` (`09/09/2026`→0), que son los otros tres campos que la lista muestra. **Repuebla al vaciar** (81) ⇒ `PRD-BUSCADOR-NO-REPUEBLA` NO aplica acá |
| DM-DEV-036 | Ciclo completo sobre **9999932 LA CORNETERIA** | ⛔ **BLOCKED** | El cliente no está en la cartera del equipo (DM-DEV-002). Imposible crear su devolución. **Motivo: dato/sincronización, no automatización** |
| DM-DEV-037 | Devoluciones dentro de la ventana del sugerido | ✅ PASS | Última factura de 100113 = **2026-09-07**; las dos devoluciones tienen `da_return = 2026-09-09` ⇒ `da_return >= última fecha facturada`. Confirmado en la nube |

---

## 2. Registros creados en el sistema

| Ref (`id_return`) | `co_return` | Tipo | Cliente | Líneas | Estado local | Nube |
|---|---|---|---|---|---|---|
| **277** | `1788980342896.0` | **Distribución (61)** | 100113 HIPERMERCADO PARAMO - PIEDRA AZUL | `046013ESP001BOL` ×**5** (lote `L0909A`, motivo 67) · `HIDPROBER001BOL` ×**3** (motivo 95) — factura `20118282` | `st_delivery=1` | ✅ **BD-OK** (`st_return=1`, 2 `return_detail`) |
| **278** | `1788980946153.0` | **Calidad (60)** | 100113 HIPERMERCADO PARAMO - PIEDRA AZUL | `046013ESP001BOL` ×**4** (motivo 67) — factura `20118282` | `st_delivery=1` | ✅ **BD-OK** (`st_return=1`, 1 `return_detail`) |
| — (borrada) | `1788981106384.0` | Calidad (60) | 100113 | `TOMPROCHE001CAJ` ×2 — factura `20118283` | Guardado → **eliminado** | ⛔ nunca se envió (caso DM-DEV-032) |

**Cabecera común de 277/278:** responsable `QA VUELTA1` · precinto `P0909A` / `P0909B` ·
comentario `QA ciclo sugerido 3capas 09/09 - DISTRIBUCION` / `- CALIDAD` · `co_enterprise HIDRO_A` ·
`id_user 469` · `nu_attachments 0`.

### 2.b · Cuadro completo de la ventana del sugerido para 100113
*(última factura del cliente: **2026-09-07** ⇒ entran todas las devoluciones con `da_return >= 2026-09-07`)*

| Ref | Tipo | Fecha | Producto | Cantidad |
|---|---|---|---|---|
| 275 | Distribución (61) | 08/09 | `046013ESP001BOL` | 4 |
| 275 | Distribución (61) | 08/09 | `HIDPROBER001BOL` | 9 |
| 276 | Calidad (60) | 08/09 | `046013ESP001BOL` | 3 |
| **277** | **Distribución (61)** | **09/09** | `046013ESP001BOL` | **5** |
| **277** | **Distribución (61)** | **09/09** | `HIDPROBER001BOL` | **3** |
| **278** | **Calidad (60)** | **09/09** | `046013ESP001BOL` | **4** |

⇒ **Oráculo esperado para la vuelta 2** (sólo resta Distribución):
`returned_stock` **`046013ESP001BOL` = 4 + 5 = 9** · **`HIDPROBER001BOL` = 9 + 3 = 12**.
Las de Calidad (3 + 4 = 7 de espinaca) **no deben restar**.
⚠ **Las Ref 275/276 del 08/09 también están dentro de la ventana** — no calcular el oráculo
únicamente con lo creado hoy.

---

## 3. Hallazgos

### 🔴 Hallazgo 1 — S1 · El cliente recién asignado a un vendedor NO baja al equipo

**Qué pasa.** Desarrollo asignó **INVERSIONES 250 LA CORNETERIA** (`co 9999932`,
`id_address_client 931`) al vendedor **V3**. En la nube la asignación existe y está activa;
en el equipo el cliente **no aparece**, ni con una sincronización completa que borra la BD local.

**Lo medido.**

| Comprobación | Resultado |
|---|---|
| Asignación en la nube | `user_address_clients` id **40** → `id_address_client 931` · `id_user 469` · `co_user 'V3'` · `id_enterprise 1` · `co_operation 'I'` · `da_update **2026-09-09 18:41:52.580Z**` |
| Cliente y dirección en la nube | `client` id 316 (`co_client 9999932`, enterprise 1 HIDRO_A, `in_suspension=false`, `only_web=false`) y `address_client` 931 — ambos activos |
| Cartera en el equipo | **17 clientes**, sin 9999932 — en `address_clients`, en `clients` y en el `#clienteSelectModal` del módulo |
| Intento 1 | Login con **borrado completo de BD local** — terminó 14:49:33 local (**18:49 UTC, posterior a la asignación**) → 17 clientes |
| Intento 2 | *Sincronizar* manual desde HOME → `lastUpdate` no se movió, 17 clientes |
| Intento 3 | 2.º logout/login → 17 clientes |

**Causa probable, con la evidencia que la sostiene.** La sincronización de clientes es
**incremental por `da_update`**: el equipo pide
`{"addressClientTableLastUpdate":"2026-09-07 16:05:57.186","page":0}` y
`{"clientTableLastUpdate":"2026-09-08 15:08:01.483","page":0}` (capturado del POST a
`syncservice/getsync`), y el servidor devuelve **vacío**.
La asignación **sólo estampó `user_address_clients`**: `address_client.da_update` de la fila 931
sigue en **`2026-08-03T14:25:42Z`**, muy anterior al corte que el equipo ya tiene
(`max(da_update)` de `address_client` en la nube = `2026-09-07T20:05:57.186Z`).

El discriminador es limpio: **para los otros 13 clientes de V3, `address_client.da_update`
coincide al milisegundo con el `da_update` de su fila de `user_address_clients`**
(p. ej. `100144` → ambos `2026-08-24T15:30:36.262Z`). Sólo el 9999932 rompe el patrón ⇒ el
procedimiento que creó la fila 40 **no tocó `address_client`**, y la sincronización delta no
tiene por qué enviarla.

**Por qué es grave.** El vendedor no ve al cliente y **no hay ningún aviso**: para él ese cliente
simplemente no existe. Y **borrar caché o reinstalar no lo arregla** — ya se probó con borrado
completo de la BD local.

**Para desarrollo.** Al asignar un cliente a un vendedor hay que **estampar también
`address_client.da_update` (y `client.da_update`)**, o hacer que el servicio de sincronización
considere el `da_update` de `user_address_clients` al armar la cartera. Como salida inmediata
para poder correr la vuelta 2: tocar el `da_update` de `address_client` id 931 y volver a
sincronizar.

### 🔴 Hallazgo 2 — S2 · «Guardar» no valida la cantidad: se guarda una devolución con cantidad negativa

**Qué pasa.** `Enviar` valida la cantidad (rechaza 0, negativos y valores por encima de lo
facturado). **`Guardar` no valida nada.** Con `Cantidad Devuelta = -3` la app pidió
confirmación, respondió *«¡Su Devolución se ha guardado!»* y dejó en la BD local:

```
returns.co_return         = 1788980342896.0   (cliente 100113, tipo 61 Distribución, st_delivery=3)
return_details.qu_product = -3                (046013ESP001BOL, doc 20118282)
```

**Por qué importa en ESTE REQ.** El sugerido calcula `returned_stock` a partir de las
devoluciones del cliente dentro de la ventana. Si esa lectura toma también las **Guardadas**
(no sólo las enviadas), una cantidad negativa **sumaría en vez de restar** y el sugerido saldría
inflado sin que nada lo delate. **Verificarlo explícitamente en la vuelta 2**: guardar una
devolución con cantidad negativa y ver si entra al cálculo.

**Contención actual.** El registro no llega a la nube mientras no se envíe, y al enviarlo la
validación lo frena. El riesgo es el local que alimenta el cálculo.

**Reproducción.** Devolución nueva → cliente + factura + un producto → `Cantidad Devuelta = -3`
→ **Guardar** → Aceptar. Mirar `return_details` en el equipo.

### 🟠 Hallazgo 3 — S3 · La alerta de cantidad no dice cuál es el tope

El rechazo por cantidad muestra, literalmente y completo (leído del `innerHTML` del
`.alert-message`, no de un recorte):

```
La cantidad a devolver debe estar entre 1 y
```

Falta el límite superior. El vendedor sabe que se pasó pero **no cuánto puede devolver**, y
tiene que ir a buscar la factura. La misma frase sale para los tres casos (mayor que lo
facturado, 0 y negativo), así que tampoco distingue *«te pasaste»* de *«pusiste 0»*.
Medido con `046013ESP001BOL`, facturado **15** en la `20118282`: el mensaje debería decir
«entre 1 y 15».

### ⚪ A vigilar (no se reportan como defecto)

1. **El Nro. Factura por línea es texto libre y no se valida** — `NOEXISTE-ZZZ999` pasa y viaja
   como `coDocument`. 3.ª confirmación (kron, run_vzla y ahora hidroponias); acá con la novedad
   de que ocurre **incluso con `validateReturn=true`**, donde la cantidad sí se contrasta contra
   la factura de cabecera. Riesgo de dato.
2. **El buscador de la lista sólo filtra por nombre de cliente** (DM-DEV-035). Coincide con lo
   observado en run_vzla; no es regresión de esta rama.
3. **El bloque de credenciales `# Cliente: hidroponias` está desactualizado** (`vendedor4` en vez
   de `vendedor3`). No es defecto de producto, pero cualquier corrida que siga el archivo al pie
   de la letra entra con el vendedor equivocado y **no ve la cartera de V3**.

---

## 4. Patrones y selectores nuevos

| Patrón / selector | Alcance | Detalle |
|---|---|---|
| 🔴 **Los campos del acordeón de DEVOLUCIONES SÍ se llenan COLAPSADO** | universal (refina la nota del 08/09) | Buscar `ion-input` por su **propiedad `.label`** (`'Lote'`, `'Nro Factura'`, `'Cantidad Devuelta'`) y escribir con el setter nativo + `input`/`change`/`ionChange`: el valor llega al modelo (`devolucion-product-list.productList[].quProduct`) **sin expandir el acordeón**. La nota del 08/09 («hay que expandir») **sólo aplica a los CONTROLES que necesitan click** — `ion-select` (Unidad, Motivo) y el botón de Fecha, cuyo `getBoundingClientRect()` es **0×0 mientras el acordeón está colapsado**. Regla: *escribir → colapsado sirve; clickear → hay que expandir con `ion-item[slot="header"]`* |
| 🔴 **`devolucion-product-list.productList` SÍ es fuente confiable acá** | cliente/build | Contrasta con `[run_vzla-20260818]`, donde `returnLogic.itemReturns` llegaba vacío. En este build el componente **hijo** `devolucion-product-list` expone `productList` con `coProduct`/`quProduct`/`coDocument`/`idMotive`/`nuLote` correctos. **Ir siempre al hijo, no a `returnLogic`** |
| ⚠ **El código del producto va al FINAL del texto del `ion-item`** | cliente | `"ESPINACA BOLSA 300GRS. (E)Código: 046013ESP001BOL"`. Un patrón que espere «Precio» detrás **nunca coincide**. Receta que funcionó 4 de 4: `/Código:\s*([A-Za-z0-9.\-]+)\s*$/` + **igualdad exacta** del grupo capturado |
| 🔴 **Los dos overlays conviven en el MISMO formulario — reconfirmado** | universal | **Tipo de devolución** (cabecera, 2 opciones) → `ion-popover` con `ion-item`, **1 click**. **Motivo** (acordeón, 34 opciones) → `ion-alert` de **36 botones** (34 + `Cancel`/`OK` **en inglés**), **2 clicks**: opción → `OK`. Probar popover primero; si devuelve `[]`, leer el alert activo |
| ⚠ **`Guardar` de DEVOLUCIONES pide confirmación (2 alertas), a diferencia de otras playas** | cliente/build | `[Cancelar/**Aceptar**]` → *«¡Su Devolución se ha guardado!»* `[OK]`. Un agente que sólo espere el «se ha guardado» se come la confirmación y **cancela sin querer** |
| ✅ **Envío = 3 alertas y la 3.ª trae el correlativo** | universal | `¿Desea enviar la devolución?` `[Cancelar/**Aceptar**]` → `¡Su Devolución será enviada!` `[OK]` → `Devolución nro. **N** enviada exitosamente` `[OK]`. **Ref UI = `id_return` = `returnId` de la respuesta del servidor** (cotejado con el payload capturado). Reparto completo: Guardado `[Cancelar/Aceptar]`+`[OK]` · Borrado `[Cancelar/**Eliminar**]` · Dirty-guard `[Guardar y salir / **Salir sin guardar** / Cancelar]` · Motivo `[…/Cancel/**OK**]`. Los 20+ alerts del módulo se resolvieron **sin un solo reintento** con igualdad exacta case-insensitive y filtro `width>0` |
| 🔴 **Hook de payload con respuesta: el acuse del servidor se lee sin tocar la BD** | universal | Envolver `Capacitor.nativePromise` y **encadenar también el `.then()`** guarda la respuesta: `{errorCode:"000", errorMessage:"Devolución nro. 277 enviada exitosamente", returnId:277, coTransaction:"…", httpStatus:200}`. Es el oráculo más barato de «llegó al servidor» y **la playa se descubre del `options.url`** sin depender de `localStorage` |
| ⚠ **La cartera del equipo NO es sólo `user_address_clients`** | universal (diagnóstico) | El equipo trae **17** clientes y la tabla de asignación de la nube tiene **14** para V3; 4 (`203`,`403`,`407`,`412`) no están en ella y 1 asignado (`9999932`) no baja. Al diagnosticar una cartera, **contrastar las dos listas** en vez de asumir que la tabla de asignación manda |
| ⚠ **`AGREGAR PRODUCTO` con `validateReturn=true` lista los productos DE LA FACTURA** | universal (3.ª confirmación) | 8 productos = exactamente `invoice_detail` de la `20118282`. Ahorra navegar las familias, y el `Nro Factura` de cada línea llega **prellenado** con la factura de cabecera |
| ℹ **La lista BUSCAR OCULTA los botones DEVOLUCIÓN/BUSCAR** | universal (7.ª confirmación) | Back al home del módulo antes de crear otra. `clickBack` (`img.fechaAtras` → `closest('a')` + `mouse.click`, filtrando `width>0`, coords ≈32,47) funciona en form, lista y home; **no hizo falta `ionBackButton`** |
| ℹ **Techo de GPS medido en este equipo** | cliente | Form de devoluciones: **69,5 s** con caché fría, **12,6-15,5 s** con caché caliente. La **lista** del módulo entra en 3,1 s (no atraviesa la guarda). Sondear en bucle con `page.waitForTimeout` — `waitForFunction` corta a 30 s |
| ℹ **Mapa factura → productos (100113, hidroponias)** | cliente | `20118282` (07/09): `046013461003BAN`×8 · `046013ESP001BOL`×15 · `CAMPROSDU002BOL`×10 · `GERPROALF002CAJ`×30 · `GERPROGCH002BOL`×30 · `HIDPROBER001BOL`×15 · `MAL013PLS098MOR`×100 · `POT013PLS004031`×10. `20118283` (07/09): `CAMPROLEC001BAN` · `CAMPROLEC002BAN` · `FRUPRO005001025` · `TOMPROCHE001CAJ` · `TOMPROMAN001BAN` |
| ℹ **Esquema nube ≠ local en DEVOLUCIONES** | universal | Nube `return` usa **`tx_description`** (local `tx_comment`) y `return_detail` tiene PK `co_detail`. Local en **plural** (`returns`, `return_details`). `nu_amount`/`co_currency` llegan `null` — **no es mismatch**, el módulo no maneja montos |

---

## 5. Qué quedó sin probar y por qué

| Caso | Motivo |
|---|---|
| Devolución sobre **9999932 LA CORNETERIA** (Distribución, Calidad y ambas sobre un mismo producto) | ⛔ El cliente no está en la cartera del equipo — Hallazgo 1. Se necesita que desarrollo estampe `address_client.da_update` de la fila 931 y una sincronización más |
| Adjuntar **foto** a la devolución | La cámara nativa cuelga CDP y el encargo prohíbe el mock. El adjunto **no es obligatorio**, así que no bloquea el envío |
| **Firma** en el Tab Adjuntos | El acordeón existe (`sign`), pero el canvas llega 0×0 con el acordeón cerrado y la firma **no cuenta como adjunto** (`nu_attachments=0` en los dos envíos) — no aporta al REQ |
| Efecto de una devolución **Guardada** (no enviada) sobre el sugerido | Pertenece a la vuelta 2; queda anotado como comprobación obligatoria por el Hallazgo 2 |
