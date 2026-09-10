# Vuelta 3 · PEDIDOS — móvil + BD · HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `ciclo_sugerido_3capas_20260909` |
| Fecha | 2026-09-09 |
| Rama bajo prueba | `SaveSuggestedOrder` |
| Playa (descubierta en runtime, desde el host del POST) | **Isla Coche** — `denarioislacoche.ddns.net:8081` |
| Empresa | `HIDRO_A` · idEnterprise 1 · HIDROPONIAS VENEZOLANAS C.A |
| Usuario | **V3 — ROGER MUESES** · `idUser 469` |
| App / BD local | `6.6.21.4` · `db_version 22` · `window.ng = true` · `sqlitePlugin` disponible |
| Dispositivo | Infinix X6728 · WebView Chrome/152 · 360×744 · socket `webview_devtools_remote_31616` |
| Clientes ejercitados | **225** EXCELSIOR GAMA SANTA FE EXPRESS · **100121** INSIDE MARKET · **100113** PARAMO PIEDRA AZUL · **104** CENTRAL MADEIRENSE · **1702** LA MURALLA |
| Resultado | **52 casos: 44 PASS · 3 FAIL · 1 BLOCKED · 4 N-A** |

> **Las tres respuestas que se pedían:**
> 1. **La sugerencia genera el pedido y queda cerrada.** La id 5 se convirtió en el pedido **170**, con `in_order_sent = 1`, `co_order`/`id_order` apuntando a él, la lista pasando de «Pendiente» a «Enviado», y **un solo pedido por sugerencia en la nube**. Las líneas fueron exactamente las de sugerido > 0.
> 2. **El botón Enviar SÍ queda muerto tras un fallo de GPS — confirmado, es defecto.** `orderServ.disableSendButton` queda en `true` y **no se reactiva ni cuando el GPS vuelve a funcionar**: hay que salir del pedido y volver a entrar. Ver Defecto 1.
> 3. **DM-SUG-011 sigue BLOCKED, y ahora con la prueba de que el dato se pierde en el equipo.** Se sincronizó **dos veces** con los sellos nuevos: el cursor de `versionsTables` avanzó **al milisegundo exacto** del `da_update` de las dos filas (cliente y dirección) y **ninguna de las dos se insertó**. Ver Defecto 2.

---

## 1. Tabla de veredictos

### Paso 0 · Sincronización y guardas

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-PED-000a | Guarda de empresa/vendedor antes de leer BD | ✅ PASS | `localStorage.user` → `idUser 469 · coUser V3 · ROGER MUESES`; selector de Empresa del form = `{idEnterprise:1, coEnterprise:"HIDRO_A", lbEnterprise:"HIDROPONIAS VENEZOLA"}`, `disabled=true`, **sin `formcontrolname`** (8.ª confirmación de esa variante). Coincide con el encargo ⇒ se sigue |
| DM-PED-000b | Sincronizar desde el tile **Sincronizar** del HOME | ✅ PASS | 2 sincronizaciones completas. Alerta `Denario Premium / ¿Desea Sincronizar? [CANCELAR/ACEPTAR]`, sin `ion-loading` visible, ~10 s. Cursores de `versionsTables` avanzaron en las dos |
| DM-SUG-011 | **9999932 LA CORNETERIA en la cartera** | ⛔ **BLOCKED** | **Sigue sin bajar tras los dos sellos nuevos.** BD local: **17 clientes / 17 `address_clients`**, `max(id_address)=852`, sin la fila 931 · UI: mismo conteo. Ver Defecto 2 |

### Bloque A · Ciclo normal y exhaustivo de PEDIDOS

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-PED-001 | Entrar a PEDIDO desde el home del módulo | ✅ PASS | `ion-button.colorBorderBuscar` con textos `[PEDIDO, BUSCAR, COPIAR]`. Navegación en **2,0-4,6 s** con caché de GPS caliente (contra los 30 s de `[run_vzla]` en frío) |
| DM-PED-002 | **Campos obligatorios: sin cliente el form está bloqueado** | ✅ PASS | Form fresco: `hasClient=false`, tabs **Pedido/Total/Adjunto `disabled`**, `.imagenGuardar` y `.imagenEnviar` **`disabled=true`**. Solo `#clienteSelect` visible. Al fijar cliente, las 4 tabs habilitan (≈4-6 s después, no en el snapshot inmediato) |
| DM-PED-003 | Selección de cliente | ✅ PASS | `setClientfromSelector` **sí opera** en este build (confirma `[latino_cosmetica][difranca]`, contradice `[gmp-20260730]`). El `selectorCliente` trae los **17** clientes de la cartera, ordenados por deuda |
| DM-PED-004 | **Alerta de deuda vencida** | ✅ PASS | Cliente **104** (`saldo1 357.665,20 · saldo2 439,02 · countDueDate 3`) dispara `Pedidos / Este cliente tiene deuda vencida, ¿Desea continuar con el pedido? [CANCELAR/ACEPTAR]`; ACEPTAR continúa, no bloquea |
| DM-PED-004b | **Contrafactual de la alerta** | ✅ PASS | Cliente **100121** con `countDueDate 28` pero **saldo negativo** (`saldo1 −317.008,66 · saldo2 −389,12`) **no dispara la alerta** — y eso es correcto. 2.ª confirmación de `[run_vzla-20260818]`: exige `saldo>0` **Y** `countDueDate>0` |
| DM-PED-005 | Mapa de VGs de cabecera (los 5 `ion-select` del Tab General) | ✅ PASS (informativo) | Empresa `disabled` (1 opción) · Moneda `disabled` (2 opciones, USD) · **Sucursal habilitada** (1 opción, auto-asignada) · **Lista de precios `disabled`** (7 opciones, `PRECIOS 03 INDEXADOS`) · **Condición de pago `disabled`** (10 opciones, `CONTADO`). `#tasa` `disabled=false` pero **`readonly=true`** (`814,69`) |
| DM-PED-006 | **Cambio de lista de precios** | 🚫 **N-A explicado** | El `ion-select` de Lista de Precios existe y trae **7 opciones**, pero llega **`disabled=true`** ⇒ `userCanChangePriceList` efectivo = **false**. No es ejercitable por UI; **no se marca PASS** |
| DM-PED-007 | **Descuento por línea** | 🚫 **N-A explicado** | El panel del producto expandido trae **solo 2 `ion-select`**: `Lista de Precio` (disabled) y `Unidad`. **No existen «% Descuento», «IVA» ni «Almacén»** ⇒ `userCanSelectProductDiscount` / `userCanSelectIVA` / `userCanChangeWarehouse` = false. Ausencia de control = VG apagada (regla `[el_palmar][kron]`) |
| DM-PED-008 | **Descuento global** | 🚫 **N-A explicado** | El Tab Total **no tiene ningún `ion-select`** ⇒ `userCanSelectGlobalDiscount = false` |
| DM-PED-009 | Estructura del catálogo | ✅ PASS | **Variante DRILL-DOWN** (4.ª confirmación del build v1.0/db19): `ion-accordion-group = 0` en el nivel de categorías; **13 categorías** `ion-item.listaItems` (AJO 5 · BERRO 3 · BROCOLI 2 · CEBOLLIN 2 · ENSALADAS 8 · FRESCALES 7 · FRUTAS 1 · GERMINADOS 5 · HONGOS 1 · LECHUGAS 3 · MAIZ 2 · TOMATE CHERRY 2 · TOMATES 4) |
| DM-PED-010 | Buscador de productos | ✅ PASS | `ion-icon[name="search-circle-sharp"]` → `input.inputsSearch` («Búsqueda de productos») + `Enter`. Devolvió el `ion-accordion` exacto en 4/4 búsquedas limpias |
| DM-PED-011 | **Cantidad negativa (−3)** | ✅ PASS | El `ion-input[type=number]` **acepta el texto** `-3` (no trae `min`), pero **el producto NO entra al carrito**: `carrito.length = 0`, sin alerta. No se puede crear una línea negativa |
| DM-PED-012 | **Cantidad 0** | ✅ PASS | Con 0 el producto **no entra**; y poniendo 0 sobre una línea ya cargada (5 → 0) **la línea se elimina del carrito**. Ninguna línea con cantidad 0 llega al pedido |
| DM-PED-013 | Cantidad válida | ✅ PASS | 5 → `carrito = [046013461003BAN=5]`, Guardar/Enviar habilitan |
| DM-PED-014 | **Producto sin stock** | ✅ PASS **por configuración** | `GERPROGCH001BOL` (GRANO CHINO 500 GRS., `sum(qu_stock) = 0` en los 6 almacenes) **aparece en el buscador, expande y acepta cantidad 2 sin ninguna alerta**. El ítem **no rotula «Inventario:»** ⇒ tenant con validación de stock apagada (`stock0=true`/`validStock=false`). **No reproduce el `ion-alert#alertNB` de `[dth-2612]` ni el «no expande» de `[alipascua]`** |
| DM-PED-015 | Reserva de inventario en vivo | ✅ PASS (informativo) | `046013461003BAN`: almacén PTER tiene 206 en BD y el carrito reportó `quStock 201` tras cargar 5 ⇒ **descuenta en vivo** (4.ª confirmación) |
| DM-PED-016 | Totales del Tab Total | ✅ PASS | 2 ítems · `Total Base USD 19,65` = 14,25 (2,85×5) + 5,40 (2,70×2) · `Total Pedido USD 19,65` (IVA 0) · `Total BS 16.008,66` con tasa 814,69. Aritmética exacta |
| DM-PED-017 | Comentario del Tab General | ✅ PASS | `ion-input#txComment`, `required=false`, contador **`0/255`** con leyenda `Mín. 0 - Máx. 255 caracteres`. El valor entra al modelo (`order.txComment`) |
| DM-PED-018 | **Guardar** | ✅ PASS · BD-SAVED | 2 alertas: `¡Alerta! / ¿Desea guardar el pedido? [CANCELAR/ACEPTAR]` → `Denario / Pedido Guardado [OK]`. **29,9 s** (Guardar es más pesado que Enviar, confirma `[difranca]`). Fila local `id_order=0`, `st_delivery=3`, `nu_details=2`, `nu_amount_final=19,65` |
| DM-PED-019 | Atrás tras Guardar | ✅ PASS | **Sale directo, SIN dirty-guard** ⇒ Guardar **sí** deja el form pristine. **Contradice `[grupo_fiel-20260817][kron-20260817]` y confirma `[gmp-2611][ins-2622][jerez]`** |
| DM-PED-020 | Lista BUSCAR | ✅ PASS | `app-pedidos-lista` con **54 ítems**; el Guardado sale primero como `Nro. Ref.: 0 … Estatus: Guardado` |
| DM-PED-021 | Buscador de la lista repuebla al vaciar | ✅ PASS | 54 → **3** con `INSIDE` → **54** al vaciar. `PRD-BUSCADOR-NO-REPUEBLA` **no aplica a PEDIDOS** (3.ª confirmación) |
| DM-PED-022 | **Round-trip §9: reabrir el Guardado** | ✅ PASS | Reabierto a los ~10 s: cliente `INSIDE MARKET (100121)`, `#txComment` = `QA v3 pedido normal 09/09` (DOM **y** modelo), **las 2 líneas con sus cantidades exactas** (5 y 2), `coOrder` el guardado, `st_delivery=3`. Cero divergencias |
| DM-PED-023 | **Enviar** | ✅ PASS · **BD-OK** | 3 alertas: `¿Desea Enviar el pedido? [CANCELAR/ACEPTAR]` → `Su Pedido será enviado [OK]` → **`Pedido nro. 171 enviado exitosamente [OK]`**. **38,8 s**. Nube: `id_order=171`, `st_order=1`, `nu_details=2`, `19,65`, comentario íntegro, `coordenada 11.0489146,-63.8652324` |
| DM-PED-024 | Cotejo de líneas en la nube | ✅ PASS | `046013461003BAN` pos 0 · `2,85` · `14,25` · `qu_order 5` — `GERPROGCH001BOL` pos 1 · `2,70` · `5,40` · `qu_order 2`. 2/2 exactas |
| DM-PED-025 | **Un pedido Enviado no se elimina** | ✅ PASS | En `app-pedidos-lista`, el `ion-button[color="danger"]` existe **solo** en el ítem Guardado (1) y **en ninguno** de los 5 Enviados revisados (0) |
| DM-PED-026 | **Un pedido Enviado no se modifica** | ✅ PASS | Su detalle abre en modo lectura: **tabs `General · TOTAL · ADJUNTO`** (falta la de **Pedido**), los 4 `ion-input` con `disabled=true`, `#tasa` readonly, y **no existen `.imagenGuardar` ni `.imagenEnviar`**. Solo hay `.imagenCopiar` |
| DM-PED-027 | **COPIAR un pedido enviado** | ✅ PASS | `COPIAR` abre `/pedidosLista` (los 54) → al elegir el 171 abre su detalle de lectura → **`.imagenCopiar`** → `Denario / Pedido Copiado Exitosamente [OK]` → form nuevo y editable: mismo cliente, **las 2 líneas idénticas**, `coOrder` nuevo `1788989703933.0`, `idOrder=0`. **La copia se persiste al instante como Guardado** (`st_delivery=3`) |
| DM-PED-028 | La copia se puede enviar | ✅ PASS · BD-OK | Enviada como pedido **174** (`st_delivery=1`, 2 líneas, 19,65) |
| DM-PED-029 | **Salir sin guardar** | ✅ PASS | Pedido nuevo (cliente 104 + 1 línea) **nunca guardado** → atrás → `¡Alerta! [GUARDAR Y SALIR / SALIR SIN GUARDAR / CANCELAR]` → *Salir sin guardar*: `count(orders)` **54 → 54** y **cero** filas `st_delivery=3` del cliente 104. No persistió nada |
| DM-PED-030 | Sin duplicados en la BD local | ✅ PASS | `count(*) = 59` y `count(DISTINCT co_order) = 59`. `pending_transactions = 0` y `failed_transactions = 0` en todo el módulo |
| DM-PED-031 | **Enviar tras fallo de GPS** | ❌ **FAIL** | Ver **Defecto 1** |

### Bloques C · D · E — la sugerencia como origen del pedido

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DM-SUG-042 | Estado en la lista antes de convertir | ✅ PASS | `Cliente: 225 … Nro. Ref.: 5 · Estatus: **Pendiente**` |
| DM-SUG-043 | La vista previa muestra lo guardado | ✅ PASS | id 5: `días desde 21 / hasta 10`, 3 productos con sugeridos **4 / 4 / 7** y los 9 términos idénticos a los persistidos en la vuelta 2. Es snapshot |
| DM-SUG-045 | **Confirmar la vista previa lanza el pedido** | ✅ PASS | ACEPTAR (`ion-footer ion-button`, `disabled=false` con `previewReady=true`) → `/pedido` en **2,0 s**, precargado: cliente **225** bloqueado, **3 líneas** con `quAmount` **4 / 7 / 4**, `coClientStock = 1788985478976.0`, `idClientStock = 268`, `coordenada` ya resuelta |
| DM-SUG-060 | **`in_order_sent` + `co_order`/`id_order`** | ✅ PASS · **BD-OK** | Tras Enviar: sugerencia id 5 → `in_order_sent = **1**`, `co_order = 1788988554518.0`, `id_order = **170**` — **local y en la nube** |
| DM-SUG-061 | **La lista pasa a «Enviado»** | ✅ PASS | Re-verificado en la UI: `Nro. Ref.: 5 · Estatus: **Enviado**`, mientras las de 1702 seguían `Pendiente` |
| DM-SUG-062 | **Un solo pedido por sugerencia (UI)** | ✅ PASS | Reabierta la **id 4** (ya convertida): `previewReady=true`, `disableOrderButton=**true**`, `ion-footer ion-button.disabled=**true**`. **Dos clics reales** con `pg.mouse.click` sobre su centro (punto propio verificado con `elementFromPoint`): **no navega, no lanza alerta, no lanza toast**, y `count(orders)` local se quedó en **52** |
| DM-SUG-063 | 🔎 **¿Avisa o se queda mudo?** | ❌ **FAIL** (usabilidad, severidad baja) | El botón se **deshabilita** —señal visible— pero **el texto completo de la vista previa no contiene ninguna explicación**: `Pedido Sugerido / Moneda: / Días desde último Inventario: 1 / Días para siguiente Inventario: 10 / <9 productos> / ACEPTAR` (515 caracteres, cero mención al pedido 169). El vendedor ve un botón gris y no sabe si ya la usó o si algo falla. Falta una leyenda del tipo *«Esta sugerencia ya generó el pedido nro. 169»* |
| DM-SUG-064 | **Un solo pedido por sugerencia (nube)** | ✅ PASS | `SELECT co_client_stock, count(*) FROM "order" GROUP BY co_client_stock` sobre las 4 sugerencias convertidas hoy: **1 pedido cada una** (`…868820.0`→169 · `…478976.0`→170 · `…757459.0`→175 · `…944237.0`→176). Cero duplicados |
| DM-SUG-064b | **La COPIA no re-ata la sugerencia** | ✅ PASS | Se copió el pedido **170** (nacido de la id 5): la copia salió con `coClientStock = **null**` / `idClientStock = **null**` y, ya enviada como pedido **172**, la nube la guardó con `id_client_stock = null`. La sugerencia id 5 sigue apuntando **solo** al 170 ⇒ **COPIAR no es una puerta trasera** para un segundo pedido |
| DM-SUG-066 | Dos sugerencias del mismo cliente | ✅ PASS | 100113 tenía la id 4 (Enviado) y una local Pendiente: marcar la primera **no bloqueó** la segunda, que se convirtió sin problema en el pedido **175** |
| DM-SUG-054 | La sugerencia que quedó local (se respondió NO) se convierte | ✅ PASS | `1788984813263.0` (Ref 0, Pendiente): ACEPTAR habilitado, preview con los sugeridos **150 / 230 / 180** de la vuelta 2, y generó el pedido **175** (`in_order_sent=1`, `id_order=175`) |
| DM-SUG-074 | **Las líneas del pedido = las de sugerido > 0** | ✅ PASS | id 5 → 3 sugeridos, los 3 > 0 ⇒ **3 líneas** con `qu_order` **4 / 7 / 4** = los sugeridos, uno a uno, y **totales exactos** (12,24 + 14,63 + 6,16 = 33,03). **La exclusión de los ceros ya quedó probada en el pedido 169** (9 sugeridos → 7 líneas, los 2 en 0 excluidos) |
| DM-SUG-084 | **El auto-send NO manda sola la sugerencia local** | ✅ PASS | **Tres sincronizaciones completas** (2 desde el tile + 1 re-login entero). Antes y después: la nube sigue con **5 filas** en `client_stock_suggested_orders` y las locales pendientes conservan `id = null`; `pending_transactions = 0`. **`1788984813263.0` no se envió sola** — solo salió cuando el usuario la convirtió a mano |
| DM-SUG-081 | **Un pedido normal no queda ligado a ninguna sugerencia** | ✅ PASS · **BD-OK** | Pedido **171** (100121, alta desde cero): `co_client_stock = null` e `id_client_stock = null` **en local y en la nube**; el hook capturó **un solo POST** `orderservice/order` y **ningún** `clientstockservice/clientstocksuggestedorderlink` (que sí aparece 2 veces al enviar el 170). Ninguna sugerencia quedó apuntando al 171 |

### Casos no ejercitables

| ID | Caso | Resultado | Motivo |
|---|---|---|---|
| DM-SUG-011 | Suma del despacho con el producto repetido en dos facturas del día | ⛔ **BLOCKED** | LA CORNETERIA no baja al equipo — **Defecto 2**. Ningún otro de los 17 clientes tiene el caso (verificado en la vuelta 2) |
| DM-SUG-065 | Eliminar el pedido nacido de una sugerencia | 🚫 N-A | La móvil no ofrece borrar un pedido Enviado (DM-PED-025); sin la acción, la pregunta del REQ no es ejercitable |

---

## 2. Registros creados en el sistema

### Pedidos

| Ref (`id_order`) | `co_order` | Cliente | Líneas | Monto | Nace de | Nube |
|---|---|---|---|---|---|---|
| **170** | `1788988554518.0` | 225 EXCELSIOR GAMA SANTA FE | **3** | **33,03 USD** | **sugerencia id 5** (`co_client_stock 1788985478976.0` · `id_client_stock 268`) | ✅ BD-OK |
| **171** | `1788988858947.0` | 100121 INSIDE MARKET | **2** | **19,65 USD** | alta normal — **sin sugerencia** | ✅ BD-OK |
| **172** | `1788989773322.0` | 225 EXCELSIOR GAMA SANTA FE | **3** | **33,03 USD** | **copia del 170** — `id_client_stock` **null** | ✅ BD-OK |
| **174** | `1788989703933.0` | 100121 INSIDE MARKET | **2** | **19,65 USD** | **copia del 171** — `id_client_stock` **null** | ✅ BD-OK |
| **175** | `1788990415275.0` | 100113 PARAMO PIEDRA AZUL | **3** | **1.223,60 USD** | sugerencia **local** `1788984813263.0` (inv. 267) | ✅ BD-OK |
| **176** | `1788990576635.0` | 1702 LA MURALLA SAN ROMAN | **1** | **18,36 USD** | sugerencia **local** `1788986944237.0` | ✅ BD-OK |

> **No creado por esta corrida:** el pedido **173** (`1788990182469.0`, cliente 1702, 1 línea, 7,40 USD) lo envió **la QA a mano** durante la corrida, al revisar el permiso de ubicación. Se anota para que la vuelta 4 no lo cuente como propio.

Los 6 con `st_order = 1`, `st_delivery = 1`, `id_user 469`, `co_enterprise HIDRO_A`, coordenadas reales del equipo (`11.0489…, −63.865…`).

### Sugerencias consumidas

| `co_client_stock_suggested_order` | Ref | Cliente | Líneas | Estado final | Pedido | En la nube |
|---|---|---|---|---|---|---|
| `1788983216162.0` | **4** | 100113 | 9 | **Enviado** (vuelta 2) | **169** | ✅ sí |
| `1788985534564.0` | **5** | 225 | 3 | **Enviado** ← *convertida en esta vuelta* | **170** | ✅ sí |
| `1788984813263.0` | 0 | 100113 | 3 | **Enviado** ← *convertida en esta vuelta* | **175** | ⛔ **no** (nunca se envió) |
| `1788986944237.0` | 0 | 1702 | 1 | **Enviado** ← *convertida en esta vuelta* | **176** | ⛔ **no** |
| `1788986798067.0` | 0 | 1702 | 1 | **Pendiente** | — | ⛔ no |
| `1788986913545.0` | 0 | 1702 | 1 | **Pendiente** | — | ⛔ no |

> ⚠ Las tres sugerencias de **1702** no las creó esta vuelta: ya estaban en el equipo al arrancar (posteriores al cierre de la vuelta 2). Se anotan porque cambian el conteo de la lista.

### Diff de baseline

| Tabla | Antes | Después | Δ |
|---|---|---|---|
| `"order"` (nube) | 169 | **176** | **+7** = los 6 de la corrida + el 173 de la QA |
| `client_stock_suggested_orders` (nube) | 5 | **5** | **0** — es el oráculo de DM-SUG-084 |
| `orders` (local) | 52 | 59 | +7, `count(DISTINCT co_order)` = 59, **sin duplicados** |
| `pending_transactions` / `failed_transactions` | 0 / 0 | **0 / 0** | nunca se movieron |

**El equipo quedó limpio:** HOME, **0 pedidos Guardados**, 0 en cola, stub de geolocalización desinstalado y `navigator.geolocation` restaurado a nativo.

---

## 3. Defectos

### 🔴 Defecto 1 — S2 · Tras un fallo de GPS, **Enviar queda muerto y no revive**, ni cuando el GPS vuelve

**Queda confirmado.** Era la duda que dejó abierta la corrida del 08/09 («se observó 2 veces»): **sí es defecto**.

**Qué pasa.** Cuando `getCurrentPosition` falla y el pedido no tiene coordenada previa, la app rechaza con
`Denario / Debe activar el GPS y obtener la ubicación antes de continuar. [OK]` — correcto — pero deja
`orderServ.disableSendButton = true` y **nunca lo vuelve a poner en `false`**.

| Momento | `disableSendButton` | `.imagenEnviar.disabled` | `.imagenGuardar.disabled` |
|---|---|---|---|
| Antes de pulsar Enviar | `false` | `false` | `false` |
| Tras el `[OK]` de la alerta de GPS | **`true`** | **`true`** | `false` |
| **Con el proveedor de GPS ya funcionando de nuevo, +3 s, sin salir del pedido** | **`true`** | **`true`** | `false` |
| Tras salir del pedido y **reabrirlo desde BUSCAR** | `false` | `false` | — |

**El daño.** El vendedor que pierde la señal un segundo se queda con el botón gris **para siempre en esa
pantalla**: aunque el GPS enganche enseguida, no hay forma de reintentar el envío. La única salida —salir del
formulario y volver a entrar— **no está indicada en ningún sitio**, y la alerta sugiere justo lo contrario
(«active el GPS», como si bastara). Guardar sigue habilitado, así que el pedido no se pierde, pero **no se envía**.

**Reproducción.** Pedido con cliente y al menos una línea, **sin coordenada previa en memoria**
(`orderServ.coordenadas = null`, que es el estado de un pedido recién abierto con el GPS frío) y el proveedor
de posición devolviendo error → Enviar → `[OK]` en la alerta → el botón Enviar queda deshabilitado y no
se reactiva.

> **Nota de método.** El fallo de GPS se **provocó** sustituyendo `navigator.geolocation.getCurrentPosition`
> por un stub que llama al callback de error (`code 3, Timeout expired`), porque el equipo tenía señal buena
> toda la corrida. **Es una acomodación de harness para forzar la condición, no un dato fabricado**: el modo de
> fallo es exactamente el que la QA vio a mano el 08/09 bajo techo, y lo que se mide —el estado del botón
> después— es comportamiento puro de la app. El stub se desinstaló y se verificó que `getCurrentPosition`
> volvió a ser `[native code]`.

**Arreglo sugerido.** Poner `disableSendButton = false` en el `catch`/rama de error de la validación de
coordenadas, igual que se hace en la rama de éxito. Y, ya que estamos, que la alerta diga qué hacer
(«Active el GPS y vuelva a intentar»), porque hoy el usuario no tiene forma de saber que debe salir y volver.

**Descartado en el camino, y vale anotarlo:** con una coordenada **anterior** en memoria, la app **envía igual
aunque el proveedor de GPS esté fallando** — el pedido **172** salió así, con `coordenada 11.0489754,-63.8650794`
heredada de la pantalla anterior. O sea que la guarda de GPS no vuelve a medir si ya tiene algo; solo bloquea
cuando no tiene **nada**. No se levanta como defecto (la coordenada era del mismo minuto y del mismo sitio),
pero explica por qué el bloqueo aparece de forma tan intermitente en campo.

---

### 🔴 Defecto 2 — S1 · **El cursor de sincronización avanza por registros que el equipo NO insertó** (reconfirmación, ahora en las DOS tablas)

Es el Defecto 1 de la vuelta 2, y esta vuelta lo prueba **dos veces más**, con los sellos nuevos que puso
desarrollo. **DM-SUG-011 sigue sin poder medirse por esto.**

| Sincronización | Tabla | `da_update` en la nube | Cursor `versionsTables` **después** | ¿La fila entró? |
|---|---|---|---|---|
| 1.ª (≈17:0x) | `client` 316 | `2026-09-09T20:44:00.410Z` | **`2026-09-09 16:44:00.410`** | ❌ **no** — `clients` sigue en 17, sin 9999932 |
| 2.ª (≈17:2x) | `address_client` 931 | `2026-09-09T21:10:54.535Z` | **`2026-09-09 17:10:54.535`** | ❌ **no** — `address_clients` sigue en 17, `max(id_address)=852` |

**Lo que esto demuestra.** El cursor quedó clavado **al milisegundo exacto** del `da_update` de cada fila ⇒
**el servidor las ofreció**. Y sin embargo ninguna de las dos está en la base del equipo. Como la
sincronización es incremental y estrictamente posterior al cursor, **ninguna sincronización futura las va a
volver a ofrecer**: el cliente 9999932 queda invisible de forma permanente, y volver a estampar `da_update`
solo sirve para quemar el cursor una vez más — que es exactamente lo que pasó hoy, dos veces.

**Para desarrollo.** El problema **no es el sello**, ya está bien puesto: es que **el cursor se actualiza aunque
el `INSERT OR REPLACE` no haya escrito nada**. Mientras eso no se corrija, cualquier registro que falle en
silencio se pierde para siempre y sin aviso. El cursor debería avanzar **solo hasta el `da_update` de la última
fila efectivamente escrita**.

**Para poder medir DM-SUG-011** hará falta, además del arreglo, o bien reinstalar la app para que baje la
cartera completa de cero, o bien estampar los `da_update` **después** de que el cursor esté corregido.

---

### 🟠 Defecto 3 — S3 · **INTERMITENTE (1 de 3)** · Un PEDIDO nuevo abierto justo después de enviar uno nacido de sugerencia llegó **con el pedido anterior cargado**

**Qué se midió.** Tras enviar el pedido **170** (nacido de la sugerencia id 5), al pulsar `PEDIDO` en el home
del módulo el formulario abrió **con todo el pedido anterior dentro**:

```
cliente:        EXCELSIOR GAMA SUPERMERCADOS, C.A. (225)      ← debería decir "Seleccione Cliente"
hasClient:      true                                          ← debería ser false
carrito:        3 líneas (046013ESP001BOL, CAMPROLEC003BAN, GERPROGCH002BOL)
txComment:      "QA v3 sugerido5 09/09"
coOrder:        1788988554518.0     ← el co_order del pedido 170, YA ENVIADO
coClientStock:  1788985478976.0     ← y sigue atado a la sugerencia id 5
tabs:           General · Pedido · Total · Adjunto  (las 4 habilitadas)
Enviar:         habilitado
```

Lo grave del contenido es el par `coOrder` + `coClientStock`: un formulario "nuevo" que lleva la referencia de
un pedido ya enviado **y** el vínculo con una sugerencia ya consumida.

**Por qué va como defecto pese a ser intermitente.** Ocurrió **en la versión que estamos probando y sobre un
registro creado por esta corrida** —que es la prueba de fuego de RUNTIME §4.b—, y lo que carga es peligroso.
Pero **hay que decir con honestidad que no reprodujo**: se repitió la misma secuencia
(convertir sugerencia → enviar → `PEDIDO`) **dos veces más**, con las sugerencias locales de 100113 (pedido
**175**) y de 1702 (pedido **176**), y en las dos el formulario abrió **limpio**: `Seleccione Cliente`,
`hasClient=false`, carrito vacío, `coOrder` nuevo, `coClientStock=null`, tabs Pedido/Total/Adjunto `disabled`.
También se comprobó el contraste tras un pedido **normal** (el 171): limpio. **1 de 3.**

**Qué sí queda establecido**, y es lo que hace que valga la pena mirarlo:
- salir de ese formulario contaminado con el botón atrás **no dispara el dirty-guard** (la app lo considera
  pristine) y, al volver a entrar, el formulario ya sale limpio ⇒ **el estado se reinicia al re-crear la página**,
  no al enviarla;
- por tanto la hipótesis más probable es que el `orderServ` no se limpia cuando el envío devuelve al listado y
  la página `/pedido` se **reutiliza** sin volver a pasar por su inicialización.

**Qué haría falta para cerrarlo.** Que desarrollo confirme en `pedido.component.ts` / `order.service.ts` si el
reset del `orderServ` está en `ngOnInit` (que no vuelve a correr al reutilizar la página) en vez de en
`ionViewWillEnter`. **No se probó pulsar Enviar sobre el formulario contaminado** a propósito, para no arriesgar
un duplicado o un pisado del pedido 170 en la nube justo antes de la vuelta 4 — pero **ese es el riesgo real** y
conviene que se pruebe en un entorno desechable.

---

### 🟡 Observación — La sugerencia que nunca se envió **no sube a la nube ni siquiera al convertirse en pedido**

Los pedidos **175** y **176** nacieron de sugerencias que se habían quedado **solo en el equipo** (el usuario
respondió «NO» al enviar el inventario). Los dos pedidos llegaron a la nube perfectamente, pero
`client_stock_suggested_orders` **siguió con 5 filas**: las sugerencias de origen no se subieron.

En la nube, el rastro queda así:

| Pedido | `co_client_stock` | `id_client_stock` | ¿Hay fila de sugerencia? |
|---|---|---|---|
| 175 | `1788984757459.0` | **267** | ❌ no |
| 176 | `1788986944237.0` | **null** (su inventario tampoco está) | ❌ no |

**Consecuencias, y son de la vuelta 4:** en la web, esos dos pedidos van a aparecer **sin sugerencia asociada**,
y para el 176 ni siquiera con el inventario de origen. Además, el `in_order_sent` que impide el segundo pedido
vive **solo en el equipo** para estas sugerencias: la validación de «un solo pedido por sugerencia» **no está
respaldada en el servidor** cuando la sugerencia nunca se envió.

No se marca defecto porque **es coherente con lo que el usuario pidió** (dijo que no la enviara), pero conviene
que el REQ defina si al convertirla en pedido debería subir igual, aunque sea para dejar la trazabilidad.

---

## 4. Patrones y selectores nuevos

| Patrón / selector | Alcance | Detalle |
|---|---|---|
| 🔴 **`co_order` se REGENERA al Guardar: el del modelo en memoria queda obsoleto** | universal | El form tenía `orderServ.order.coOrder = 1788988858922.0`; la fila guardada salió con **`1788988858947.0`** (25 ms después). Un `WHERE co_order='<el del modelo>'` devuelve **0 filas** y se lee como «el pedido no se guardó». **Releer `coOrder` del modelo DESPUÉS del alert «Pedido Guardado»**, o buscar por `st_delivery=3` |
| 🔴 **El módulo INVENTARIOS es la puerta a las sugerencias, y su tile de HOME es «Sincronizar» el que fuerza la sync** | cliente/build | `app-home` trae un tile **`Sincronizar`** (`p.nombreModulos`, bajo el fold): `scrollIntoView` + click → alerta `Denario Premium / ¿Desea Sincronizar? [CANCELAR/ACEPTAR]` → sincroniza en ~10 s **sin ningún `ion-loading`**. Es **mucho más barato que un re-login** (10 s contra ~40 s) y sirve igual como disparador de auto-send |
| 🔴 **El POST que ata la sugerencia al pedido es `clientstockservice/clientstocksuggestedorderlink`, y sale DOS veces** | universal | Al enviar un pedido nacido de sugerencia el hook capturó: `…/clientstocksuggestedorderlink` → `…/orderservice/order` → `…/clientstocksuggestedorderlink`. Un pedido **normal** dispara **solo** `orderservice/order`. ⇒ **la presencia de ese endpoint es el oráculo barato de «este pedido viene de una sugerencia»**, sin tocar la BD |
| 🔴 **El detalle de un pedido Enviado se reconoce por la tab que FALTA** | universal | En lectura las tabs son `General · TOTAL · ADJUNTO` — **desaparece la de Pedido** — los `ion-input` llegan `disabled=true` y **`.imagenGuardar`/`.imagenEnviar` no existen en el DOM** (leer su `.disabled` devuelve `undefined`, no `true`). El único botón es **`.imagenCopiar`** en el header |
| 🔴 **`COPIAR` no es un flujo aparte: reusa `/pedidosLista`** | universal | El botón `COPIAR` del home del módulo abre la **misma** lista que `BUSCAR`; la copia se dispara desde **`.imagenCopiar`** dentro del detalle del pedido elegido. Alert `Denario / Pedido Copiado Exitosamente [OK]`, y **la copia se persiste como Guardado en el acto** (`st_delivery=3`), sin pasar por Guardar |
| 🔴 **El buscador de productos NO se limpia con `Backspace` ni con `Ctrl+A`+`Delete`** | harness (universal) | Un `searchText` residual (`046013ACG004BOLAN`) devuelve **0 acordeones** y se lee como «el producto no existe en el catálogo» — se perdió un tramo diagnosticando un no-defecto. **Receta fiable: `comp.searchText=''` + `input.value=''` + `dispatchEvent('input')` antes de teclear**, y **verificar `searchText` después** |
| 🔴 **«Producto sin stock» hay que medirlo con `SUM(qu_stock)` por producto, no con una fila de `stocks`** | universal (BD) | `stocks` tiene **una fila por almacén** (AVE · DEVO · PTER · MAP · TEMP · CORT · PAT). `046013ESP001BOL` sale con `qu_stock=0` en MAP y con **3.733** en PTER. De 145 filas con 0, solo **4 productos** están realmente sin stock. Un `WHERE qu_stock<=0` da falsos positivos y el caso se prueba contra el producto equivocado |
| ✅ **`disableSendButton` es el oráculo del estado de Enviar, y NO se refleja siempre en el DOM del mismo modo** | universal | Cuando la página de pedido está en lectura, `document.querySelector('.imagenEnviar')` es `null` y su `.disabled` da `undefined`. Distinguir **`undefined` (no existe) de `true` (existe y está deshabilitado)** — son dos casos con veredictos opuestos |
| ✅ **Cadena de alertas medida en este build** | cliente/build | Guardar = **2**: `¡Alerta! / ¿Desea guardar el pedido? [CANCELAR/ACEPTAR]` → `Denario / Pedido Guardado [OK]`. Enviar = **3**: `Pedidos / ¿Desea Enviar el pedido? [CANCELAR/ACEPTAR]` → `Denario Pedidos / Su Pedido será enviado [OK]` → **`Denario Premium / Pedido nro. N enviado exitosamente [OK]`** (la 3.ª es el único acuse del servidor). Dirty-guard = `[GUARDAR Y SALIR / SALIR SIN GUARDAR / CANCELAR]`. Deuda vencida = `[CANCELAR/ACEPTAR]`. Copiado = `[OK]`. **Los textos de los botones vienen en MAYÚSCULAS pero el `alert-button` los expone capitalizados** (`Cancelar`/`Aceptar`) ⇒ comparar en minúsculas por igualdad exacta |
| ✅ **Guardar deja el form pristine en este build** | cliente/build | Tras el alert «Pedido Guardado», el atrás sale **directo, sin dirty-guard**. Contradice `[grupo_fiel-20260817][kron-20260817]` y confirma `[gmp-2611][ins-2622][jerez]` ⇒ **es por build, no por servidor: medirlo cada vez** |
| ✅ **Guardar (29,9 s) es más pesado que Enviar (38,8 s incluyendo 3 alerts atendidas a mano)** | universal | Reconfirma `[difranca-20260807]`: el cuello de botella es SQLite, no la red. Presupuestar ≥ 60 s por cada Guardar/Enviar en el techo del módulo |
| ✅ **La reserva de stock se lee en `carrito[].quStock`, y descuenta del almacén activo** | universal | `046013461003BAN` tiene 206 en PTER (BD) y el carrito reportó **201** tras cargar 5. El ítem **no rotula «Inventario:»** en este tenant, así que el DOM no sirve de oráculo: hay que leer el modelo |
| ✅ **Un back de más en `/pedidos` saca la app a `/login`** | harness (universal) | El primer atrás deja `location.href='/pedidos'` mientras `getActiveView` **todavía** devuelve `app-pedido` (estado transitorio); un segundo click "para asegurar" cierra sesión. **Verificar `href` Y vista antes de reintentar un back.** Consuelo: el login vuelve **con usuario y contraseña ya rellenados**, entra solo y `window.__qaPED` sobrevive (no hay recarga de página) |
| ℹ **`orders` local pierde `co_client_stock` cuando el pedido vuelve de la nube** | universal (BD) | Los pedidos creados en el equipo traen `co_client_stock` poblado; tras un re-login que los re-descarga, la fila local queda con `co_client_stock=null` **aunque en la nube sí esté**. **Para el vínculo pedido↔sugerencia, la nube es la fuente**, no la BD local |
| ℹ **`order_detail_unit.qu_suggested` llega en `0,0000` incluso en pedidos nacidos de una sugerencia** | universal (BD) | En el pedido 170 las 3 unidades traen `qu_order` 4/7/4 correctos y `qu_suggested = 0`. El vínculo con la sugerencia va por `order.co_client_stock`, no por ese campo. **No usar `qu_suggested` como oráculo del origen** |
| ℹ **Mapa de códigos usados en esta vuelta** | cliente | `046013461003BAN` BROCOLI BANDEJA (E) 2,85 USD · `GERPROGCH001BOL` GRANO CHINO 500 GRS. 2,70 USD **(stock 0 en los 6 almacenes)** · `046013ESP001BOL` ESPINACA 300 GRS. 3,06 · `CAMPROLEC003BAN` LECHUGA BABY MIX 2,09 · `GERPROGCH002BOL` GRANO CHINO 200 GRS. 1,54 |

---

## 5. Verificación BD

| Registro | Marca | Fila en la nube | Estado local | ¿Lo guardado se envió? |
|---|---|---|---|---|
| Pedido **170** | **BD-OK** | `id_order=170`, `st_order=1`, `nu_details=3`, `33,0300`, `id_client_stock=268`, comentario íntegro, 3 líneas con `qu_order` 4/7/4 | `st_delivery=1`, fuera de cola | **Sí** |
| Pedido **171** | **BD-OK** | `id_order=171`, `nu_details=2`, `19,6500`, `id_client_stock=null`, 2 líneas exactas | `st_delivery=1` | **Sí** — y guardado antes como `st_delivery=3`, así que cubre el ciclo entero |
| Pedido **172** | **BD-OK** | `id_order=172`, 3 líneas, `33,0300`, `id_client_stock=null` | `st_delivery=1` | **Sí** |
| Pedido **174** | **BD-OK** | `id_order=174`, 2 líneas, `19,6500` | `st_delivery=1` | **Sí** |
| Pedido **175** | **BD-OK** | `id_order=175`, 3 líneas, `1.223,6000`, `id_client_stock=267` | `st_delivery=1` | **Sí** |
| Pedido **176** | **BD-OK** | `id_order=176`, 1 línea, `18,3600`, `co_client_stock` presente | `st_delivery=1` | **Sí** |
| Sugerencia id 5 | **BD-OK** | `in_order_sent=1`, `co_order=1788988554518.0`, `id_order=170` | ídem | **Sí** |
| Sugerencias locales `…813263.0` y `…944237.0` | **BD-SAVED** (esperado) | **no existen en la nube** | `in_order_sent=1`, `id_order` 175/176 | **No, y es lo correcto** — el usuario dijo que no se enviaran (Observación 2) |

`pending_transactions = 0` y `failed_transactions = 0` durante todo el módulo. `count(*) = count(DISTINCT co_order) = 59` en la BD local ⇒ **sin duplicados**.

---

## 6. Lo que queda para la vuelta 4 (web)

**En `Transacciones → Pedidos` deben aparecer, todos del vendedor V3 / `id_user 469`:**

| Ref | Cliente | Líneas | Monto | Qué hay que comprobar en la web |
|---|---|---|---|---|
| **169** | 100113 | 7 | 9.694,10 USD | Nace de la sugerencia **id 4**; los 2 sugeridos en 0 **excluidos** (DM-SUG-074) |
| **170** | 225 | 3 | 33,03 USD | Nace de la sugerencia **id 5**; líneas = sugeridos **4 / 7 / 4**, uno a uno |
| **171** | 100121 | 2 | 19,65 USD | **Sin sugerencia** — el control negativo de DM-SUG-081 |
| **172** | 225 | 3 | 33,03 USD | Copia del 170 — debe salir **sin** sugerencia asociada |
| **174** | 100121 | 2 | 19,65 USD | Copia del 171 |
| **175** | 100113 | 3 | 1.223,60 USD | Nace de una sugerencia **que no está en la nube** (Observación 2) |
| **176** | 1702 | 1 | 18,36 USD | Ídem, y su inventario tampoco está |
| *(173)* | *1702* | *1* | *7,40 USD* | *Lo envió la QA a mano, no es de la corrida* |

**En `Transacciones → Pedido Sugerido` deben aparecer exactamente DOS**, y ninguna más:

| Ref | Cliente | Líneas | Estado esperado | Pedido |
|---|---|---|---|---|
| **4** | 100113 PARAMO PIEDRA AZUL | 9 | **Enviado / consumida** | **169** |
| **5** | 225 EXCELSIOR GAMA SANTA FE | 3 | **Enviado / consumida** ← *cambió en esta vuelta, en la 2 estaba Pendiente* | **170** |

> Las otras 3 filas de la nube (ids 1, 2 y 3 — clientes 402, 100063 y 105) son **de otro vendedor** (`id_user 468`) y no deben aparecer en la cartera de V3.

**Los términos producto a producto de las ids 4 y 5** están en el §3 del reporte `02-inventarios-y-sugerido.md` de esta misma corrida, listos para el cotejo móvil ↔ web de DM-SUG-073.
