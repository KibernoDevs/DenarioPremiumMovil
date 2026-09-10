# CONSOLIDADO · Ciclo de certificación «Pedido Sugerido guardado» — HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `ciclo_sugerido_3capas_20260909` |
| Fecha | 2026-09-09 |
| Rama certificada | **`SaveSuggestedOrder`** (se ignoró `SaveSuggestedOrderEXPRESS`, como pedía el guión) |
| Guión | `guiones-regresion/guion-hidroponias-pedido-sugerido.md` — bloques A a G |
| Cliente / empresa | **hidroponias** · `HIDRO_A` · `idEnterprise 1` · HIDROPONIAS VENEZOLANAS C.A |
| Vendedor | **V3 · ROGER MUESES** · `idUser 469` · login `vendedor3` |
| Playa (descubierta en runtime, no asumida) | **Isla Coche** — móvil `denarioislacoche.ddns.net:8081` · web `…:8080/DenarioPremium` |
| App / BD local | `6.6.21.4` · `db_version 22` · Infinix X6728, Android 15 |
| VG que hace único a este cliente | `suggestedOrderByDispatchAndReturn = **true**` (leída del servicio en vivo, no del `localStorage`) |
| Vueltas | **4** — Devoluciones · Inventarios y Sugerido · Pedidos · Web |
| Capas cubiertas | **móvil + base de datos + web** |

---

## 1. Veredicto global

> ### 🟡 **EL REQ CUMPLE EN SU NÚCLEO. NO SE LIBERA SIN CERRAR DOS DEFECTOS DE SEVERIDAD 1.**

**Lo que el REQ vino a hacer, lo hace, y se probó en las tres capas.** La sugerencia se persiste
con **cada término del cálculo**, sobrevive a un reinicio de la app, sube a la nube íntegra,
se muestra en la web con los 9 términos y genera **un solo pedido**, con las líneas correctas y
los ceros excluidos. **El cotejo término por término dio 0 divergencias con tolerancia 0 en las
tres capas**: 24 mediciones producto×escenario en el equipo (vuelta 2), las mismas contra la nube,
y 112 comparaciones contra la web (vuelta 4). **La aritmética no se movió ni un dígito.**

**Lo que impide firmar:**

| | Defecto | Por qué bloquea |
|---|---|---|
| 🔴 | **D-01 · El cursor de sincronización se quema y el registro se pierde para siempre** | Deja **DM-SUG-011 sin poder medirse**, que es un caso del propio REQ. Y el mecanismo —el cursor avanza aunque el `INSERT` no escriba— significa que **cualquier** registro que falle en silencio queda invisible de forma permanente |
| 🔴 | **D-02 · Un pedido enviado y vivo no aparece en el listado de la web** | 1.223,60 USD invisibles para quien revise la operación del día. Los 2 únicos casos de toda la historia del cliente son de **la ventana de prueba de esta rama** |

Y hay un tercero que, sin bloquear la liberación, **conviene decidir antes**: **D-03**, el sugerido
lee las devoluciones **guardadas** y con una cantidad negativa infla el pedido en silencio (+25 %
medido sobre un producto). Está en el **cálculo**, no en la persistencia que trae la rama, pero
reproduce hoy y se corrige con una línea (`filtrar por st_delivery`).

**Lo que sí se puede afirmar sin reservas:**
- La rama **no rompió nada** de los módulos vecinos: devoluciones, inventarios y pedidos hicieron
  su ciclo completo (crear → guardar → reabrir → enviar → cotejar) y llegaron a la nube.
- **Un solo pedido por sugerencia** está implementado y se comporta — verificado en UI, en el
  equipo, en la nube y por conteo; y **`COPIAR` no es una puerta trasera**.
- La sincronización de las tablas nuevas (85 y 86) **sube, baja y no duplica**.

---

## 2. Totales por vuelta

| # | Vuelta | Casos | PASS | FAIL | BLOCKED | N-A | Informe |
|---|---|---:|---:|---:|---:|---:|---|
| 1 | **Devoluciones** (móvil + BD) | 37 | 34 | 2 | 1 | 0 | `01-devoluciones.md` |
| 2 | **Inventarios y Pedido Sugerido** (móvil + BD) | 66 | 55 | 3 | 4 | 3 | `02-inventarios-y-sugerido.md` |
| 3 | **Pedidos** (móvil + BD) | 52 | 44 | 3 | 1 | 4 | `03-pedidos.md` |
| 4 | **Web** (navegador, sólo lectura) | 37 | 32 | 2 | 0 | 3 | `04-web.md` |
| | **TOTAL** | **192** | **165** | **10** | **6** | **10** | `_results.jsonl` |

*(La vuelta 2 lleva además 1 caso marcado `OBSERVACION` — `DM-SUG-063` —, contado aparte de los 66.
Los 10 FAIL corresponden a **9 defectos distintos**: `DM-DEV-002` y `DM-SUG-000b` son el mismo
defecto medido en dos vueltas.)*

⚠ **Nota de contabilidad:** `DM-SUG-091` («Guardar de devoluciones no valida la cantidad») quedó
como **`FAIL` en `_results.jsonl`** pero el informe de la vuelta 2 lo **degradó a observación** por
decisión de QA del 09/09: la validación existe donde importa (al Enviar), y el daño real ya está
levantado como **D-03**. **Vale como un solo defecto con dos arreglos posibles, no como dos.**

---

## 3. Tabla única de defectos

Ordenada por severidad. «Vuelta» = dónde se midió por última vez; «1→2→3» = se reconfirmó en cada una.

| ID | Sev | Defecto | Vuelta(s) | Caso(s) | Estado | Reproduce hoy |
|---|---|---|---|---|---|---|
| **D-01** | 🔴 **S1** | **El cursor de sincronización avanza por registros que el equipo NO insertó.** El cliente 9999932 LA CORNETERIA quedó invisible **de forma permanente**: el cursor de `versionsTables` se clavó al milisegundo exacto del `da_update` de las filas `client 316` y `address_client 931` y ninguna de las dos entró. Como la sincronización es incremental y estrictamente posterior al cursor, **ninguna futura las volverá a ofrecer**. Volver a estampar `da_update` sólo lo quema otra vez — pasó **dos veces más** en la vuelta 3 | **1 → 2 → 3** | `DM-DEV-002` · `DM-SUG-000b` · `DM-DEV-036` · `DM-SUG-011` | 🔴 **ABIERTO** · bloquea DM-SUG-011 | ✅ sí, 3 veces |
| **D-02** | 🔴 **S1** | **Un pedido enviado y vivo no aparece en el listado de la web.** El **175** (1.223,60 USD) y el **166** (8.118,50 USD) quedaron con `order.co_operation = NULL`, y `/pages/pedidos` filtra `co_operation <> 'D'` — que en SQL descarta los nulos **en silencio**. Probado por conteo: en la ventana 01/09-09/09, `total 44` · `<> 'D' → 42` (lo que muestra la web) · `IS DISTINCT FROM 'D' → 44` · `nulos 2` · `borrados 0`. En **toda** la tabla (176 pedidos desde el 20/07) hay **exactamente 2 nulos** y **los dos son de la ventana de prueba de esta rama** | **4** | `DW-PED-001` | 🔴 **ABIERTO** · **NUEVO** | ✅ sí, hoy |
| **D-03** | 🔴 **S2** | **El sugerido lee las devoluciones GUARDADAS**, no sólo las enviadas (`getReturnsByDistribution` no filtra por estado de envío) — y como «Guardar» no valida la cantidad, una **negativa resta de la resta** y **aumenta** el sugerido. Medido con control dentro: `+30 uds (+25 %)` en `046013ESP001BOL` y `−30` en `GERPROGCH002BOL`. **Nada en pantalla lo delata** | **1 → 2** | `DM-SUG-090` · `DM-SUG-091` · `DM-DEV-017` | 🔴 **ABIERTO** · **NUEVO** | ✅ sí |
| **D-04** | 🔴 **S2** | **Tras un fallo de GPS, «Enviar» queda muerto y no revive**, ni cuando el GPS vuelve a funcionar: `orderServ.disableSendButton` se queda en `true` y hay que salir del pedido y volver a entrar. Era la duda que dejó abierta el 08/09 («se observó 2 veces») — **queda confirmada** | **3** | `DM-PED-031` | 🔴 **ABIERTO** · confirmado | ✅ sí |
| **D-05** | 🟠 **S3** | **INTERMITENTE (1 de 3)** · Un PEDIDO nuevo abierto justo después de enviar uno nacido de sugerencia llegó **con el pedido anterior dentro**: cliente fijado, 3 líneas, y —lo grave— `coOrder` del pedido **ya enviado** y `coClientStock` de la sugerencia **ya consumida**, con Enviar habilitado. **No reprodujo** en los otros dos intentos ni tras un pedido normal. Hipótesis: el reset del `orderServ` vive en `ngOnInit`, que no vuelve a correr al reutilizar la página | **3** | `DM-PED-OBS1` | 🟠 **ABIERTO** · intermitente | ⚠ 1 de 3, hoy |
| **D-06** | 🟠 **S3** | **La vista previa de una sugerencia ya consumida no explica por qué ACEPTAR está gris.** El botón se **deshabilita** (mejor que el `return` mudo que sugería el código), pero los 515 caracteres de la pantalla **no mencionan el pedido 169**. El vendedor no puede distinguir «está bloqueado» de «la app se colgó». Falta una leyenda tipo *«Esta sugerencia ya generó el pedido nro. 169»* | **2 → 3** | `DM-SUG-063` | 🟠 **ABIERTO** · usabilidad | ✅ sí |
| **D-07** | 🟠 **S3** | **La alerta de rechazo del modal de inventario nombra campos que la VG apagó.** Con `expirationBatch = false` (verificado con el campo vacío), el rechazo por cantidad inválida dice *«Complete cantidad, unidad, fecha y lote para continuar»*: el vendedor sale a buscar un lote y una fecha que la configuración no le pide, mientras el problema real queda escondido entre otros tres campos | **2** | `DM-SUG-024` | 🟠 **ABIERTO** | ✅ sí |
| **D-08** | 🟠 **S3** | **La alerta de cantidad de devoluciones no dice cuál es el tope.** El mensaje termina literalmente en *«La cantidad a devolver debe estar entre 1 y»* — la frase se corta | **1** | `DM-DEV-014` | 🟠 **ABIERTO** | ✅ sí |
| **D-09** | 🟠 **S3** | **La pantalla web nueva imprime los números en formato inglés.** `/pages/detalleSugerenciaPedido` muestra **`2,610`** donde `/pages/detallePedido` muestra **`2.610`** para el mismo número, en la misma sesión — y en es-VE la coma es el separador decimal, así que se lee **2,61**. Además los términos van **sin formatear**: `Inv. inicial: 261.0` y `Ventas diarias est.: 0.380952380952381` (el `NUMERIC` crudo, 15 dígitos). **El valor es correcto**; falla la presentación | **4** | `DW-WEB-001` | 🟠 **ABIERTO** · **NUEVO** | ✅ sí, hoy |

### Observaciones que NO son defecto (y por qué)

| Qué | Vuelta | Por qué no se reporta |
|---|---|---|
| Las sugerencias que el usuario decidió no enviar **no suben ni al convertirse en pedido** | 3 → 4 | **Coherente con lo que el usuario pidió.** Confirmado en la web: 175 y 176 salen sin sugerencia. **Pero para el REQ:** hoy el `in_order_sent` que impide el segundo pedido vive **sólo en el equipo**; el servidor no tiene con qué impedirlo si el teléfono se reinstala |
| El vínculo **pedido → sugerencia** no existe en la web (sólo sugerencia → pedido e inventario ↔ pedido) | 4 | Nadie lo especificó. Pero quien parte del pedido **no puede llegar a los términos del cálculo que lo originó**, que es justo la trazabilidad que el REQ vino a aportar |
| `Moneda:` vacío en la cabecera de la sugerencia | 2 → 4 | **No es de la web:** el campo viene vacío desde el origen (la vista previa del equipo también) y la cabecera no persiste moneda |
| La columna `N°` del detalle de inventario dice `1` en todas las filas | 4 | **Histórico, no regresión:** reproduce igual en el inventario **129 del 01/09**, anterior a la rama |
| El `Nro. Factura` por línea de devoluciones es texto libre y no se valida | 1 | 3.ª confirmación (kron, run_vzla, hidroponias). Riesgo de dato, no defecto de esta rama |
| «Venta Sugerida» rotula la **venta**, no una sugerencia · la pantalla **clampa los negativos a 0** | 2 | Decisiones de presentación. ⚠ El clamp esconde justo el caso que dispara la guarda de venta negativa — **y la web sí muestra el `−7`** |
| El bloque `# Cliente: hidroponias` de `qa-credentials.env` dice `vendedor4` | 1 | No es defecto de producto, pero **cualquier corrida que siga el archivo al pie de la letra entra con el vendedor equivocado**. Corregir el archivo |
| `getReturnsByDistribution` no filtra por **sucursal** (la del despacho sí) | 2 | **No se pudo reproducir**: la cartera tiene una dirección por cliente. **Confirmar con desarrollo** antes de darlo por cierto |

---

## 4. Qué quedó sin probar, y por qué — sin maquillar

| Caso | Estado | Motivo |
|---|---|---|
| **DM-SUG-011 · La suma del despacho** (mismo producto repetido en dos facturas del mismo día) | ⛔ **BLOCKED** — y ya venía sin probar del **01/09** | **El motivo es, en sí mismo, el hallazgo.** El único cliente de la base con ese dato (**9999932 LA CORNETERIA**, `CAMPROLEC012BOLUNI` 25+25 el 07/09) **no baja al equipo**, y no baja porque el cursor de sincronización se quemó (**D-01**). Se verificó que **ningún** otro de los 17 clientes tiene el caso. Se intentó **cinco veces** en tres vueltas, con dos sellos de `da_update` puestos por desarrollo, y las dos veces el cursor avanzó al milisegundo exacto **sin insertar la fila**. ⇒ **Para destrabarlo hace falta primero arreglar D-01**, y después reinstalar la app (para que baje la cartera de cero) o estampar los `da_update` **después** del arreglo. Volver a estampar antes sólo quema el cursor otra vez |
| **DM-SUG-001 · Migración v21 → v22 con datos** | ⛔ BLOCKED | Exigía una instalación que **viniera de v21 con datos**; la APK ya estaba puesta y la base se recreó en el login. **Lo que sí se comprobó:** `db_version = 22`, las dos tablas nuevas creadas, y el histórico bajó íntegro (167 facturas · 41 inventarios · 81 devoluciones · 17 clientes). **La migración desde una base poblada sigue sin probarse** |
| **DM-SUG-040 · La lista vacía del submódulo** | ⛔ BLOCKED | La sugerencia nace **al generar la vista previa**, no al ACEPTAR: para cuando se entró al submódulo ya existía una. Se mide al **inicio** de la próxima corrida, antes de tocar nada |
| **DM-SUG-076 · Merge del estado** (enviada en la nube, pendiente en el equipo) | ⛔ BLOCKED | Fabricar el desfase exige **escribir en la nube** y la conexión de QA es de sólo lectura |
| **DM-SUG-014 por SUCURSAL** | 🚫 N-A por dato | 17 clientes / 17 direcciones: no hay dos sucursales del mismo `id_client`. El aislamiento **por cliente** sí se probó |
| **DM-SUG-065 · Eliminar el pedido nacido de una sugerencia** | 🚫 N-A | La móvil no ofrece borrar un pedido **Enviado** (el trash sólo aparece en Guardado, verificado). Sin la acción, la pregunta del REQ no es ejercitable |
| **DM-SUG-085 · Lote y vencimiento obligatorios** | 🚫 N-A | `expirationBatch = **false**` en este tenant. **Contrafactual medido, no asumido**: el `.save-btn` aceptó con el lote vacío en 13 productos y la nube guardó `nu_batch = ''` |
| **DM-PED-006/007/008 · Listas de precio, descuentos por línea y global** | 🚫 N-A explicados | Los controles **no existen o llegan `disabled`** ⇒ las VGs están apagadas. Ausencia de control = VG apagada; **no se marca PASS** |
| **El cotejo fuerte del monto del pedido** (mezcla de monedas) | 🚫 Sin dato | Los 7 pedidos van **enteros en USD**, con IVA 0 y sin descuentos ⇒ `nu_amount_total == nu_amount_final` en los 7. El cotejo por el campo correcto dio PASS, **pero el campo equivocado también lo habría dado**. Es un **PASS débil declarado**, no una certificación. Lo que sí se cruzó entre dos monedas fue la **conversión** (exacta en los 7, tasa 814,69) |
| **Visitas** | Fuera de alcance | Bug conocido en la rama, desarrollo en el fix. Lo excluyó el propio guión |
| **Adjuntos, firma y cámara** | Fuera del REQ | El adjunto **no es obligatorio** en este tenant (`nu_attachments = 0` en los 6 envíos). No se usó mock de cámara |
| **Enviar sobre el formulario contaminado de D-05** | Deliberadamente no probado | Se evitó a propósito para **no arriesgar un duplicado o un pisado del pedido 170** justo antes de la vuelta 4. **Ese es el riesgo real y conviene probarlo en un entorno desechable** |

---

## 5. Las tres capas: qué se certificó y qué no

### 📱 Capa MÓVIL — vueltas 1, 2 y 3

**Certificado:**
- El **cálculo especial** completo contra la BD nueva: consolidación del despacho (6 productos que
  la consulta vieja daba 0 trajeron su cantidad real), control (no se movió lo que ya funcionaba),
  producto sin factura del día (`dispatched = 0`, ni ausente ni en blanco), aislamiento por cliente,
  cambio×cambio **como único aporte**, Distribución resta / Calidad **no** resta, ambas sobre el
  mismo producto, `days_since_last` calculado, stock 0 con rotación, `days_until_next` tecleado y
  recalculado, guarda `current_stock >= sugerido` **con igualdad exacta construida a propósito**, y
  guarda de venta negativa. **Tolerancia 0 en 24 mediciones producto×escenario.**
- **El REQ nuevo:** la sugerencia se guarda **al generar la vista previa**, con cabecera y **cada
  término** del detalle; `nu_details` cuadra; los sugeridos en 0 **se guardan** y se muestran igual
  al reabrir; el `days_until_next` tecleado se guarda; `by_dispatch_and_return` deja la trazabilidad
  de con qué regla se generó; **regenerar reemplaza, no duplica** (3 regeneraciones → 1 cabecera,
  9 detalles, no 27); sobrevive a `force-stop` + relanzar; dos sugeridos de clientes distintos
  conviven sin pisarse.
- **El submódulo:** lista con cliente, Ref, estatus y fecha · Pendiente/Enviado · abrir muestra
  **el snapshot**, no un recálculo (probado cambiando el dato de por medio) · ACEPTAR lanza el
  pedido · salir sin confirmar no consume nada.
- **La decisión al enviar el inventario:** con sugerido **aparece** la pregunta (cadena de 4
  alertas), sin sugerido **no aparece** (3 alertas), «SÍ» la sube, «NO» la deja local y Pendiente
  **y convertible**, y cancelar en la primera alerta **no envía nada**.
- **Un solo pedido por sugerencia:** `in_order_sent = 1` + `co_order`/`id_order` · la lista pasa a
  Enviado · el segundo intento **no crea un segundo pedido** (dos clics reales, verificados con
  `elementFromPoint`) · **`COPIAR` no re-ata la sugerencia** · dos sugerencias del mismo cliente no
  se bloquean entre sí.
- **No-regresión:** los ciclos completos de devoluciones, inventarios y pedidos, incluidos
  round-trip §9, dirty-guard, borrado con cascada, copia de pedido, validaciones de cantidad
  (negativa y 0), catálogo drill-down y reserva de stock en vivo.

**No certificado:** la **migración desde v21 con datos** · la **suma del despacho** (DM-SUG-011) ·
la lista vacía del submódulo · el merge del estado · el aislamiento **por sucursal**.

### 🗄️ Capa BASE DE DATOS — vueltas 1, 2 y 3

**Certificado:**
- **La sugerencia llega a la nube.** `client_stock_suggested_orders` 3 → 5 y
  `client_stock_suggested_order_details` 5 → 17, con cabecera completa (`id_client_stock`,
  `id_user`, `co_user`, `co_enterprise`, `days_since_last`, `days_until_next`,
  `by_dispatch_and_return`, `da_suggested`, `nu_details`) y **sync inmediata**.
- **Cotejo nube ↔ equipo término por término: 0 divergencias** (9 productos + 3 productos × 9
  términos). Única salvedad declarada y descartada: `estimated_daily_units` llega con 15 dígitos
  contra el doble de JS — residuo de 7·10⁻¹⁷, precisión de la columna `NUMERIC`.
- **`BD-FIELD-OK` en todo lo transaccional:** 2 devoluciones, 4 inventarios y 6 pedidos, campo por
  campo, cabecera y líneas.
- **Diff de baseline exacto, cero filas inesperadas:** `client_stock` +4 · `"order"` +7 (los 6 de
  la corrida + el 173 de la QA) · `return` +2 · `client_stock_suggested_orders` +2.
- **Sin duplicados:** `count(*) = count(DISTINCT co_order) = 59` local ·
  `pending_transactions = 0` y `failed_transactions = 0` durante todo el ciclo · sincronizar dos
  veces seguidas no duplica ni pierde · el auto-send **no manda sola** la sugerencia local
  (3 sincronizaciones, la nube siguió en 5 filas).
- **Un solo pedido por sugerencia en la nube:** las 4 sugerencias convertidas → **1 pedido cada una**.

**No certificado:** nada que exija **escribir** en la nube (la conexión de QA es de sólo lectura) ⇒
DM-SUG-076 quedó fuera. Y **D-01** es, en el fondo, un defecto de esta capa: el cursor avanza aunque
el `INSERT OR REPLACE` no escriba nada.

### 🌐 Capa WEB — vuelta 4

**Certificado:**
- **La pantalla nueva existe y funciona:** `Transacciones → Sugerencias de Pedido`
  (`/pages/sugerenciasPedido`), con las **dos** sugerencias de V3 y **ninguna más** al filtrar por
  vendedor. Las ids 1-3 (`id_user 468`) **no se mezclan**, y el filtro usa **`id_user`**, no `co_user`.
- **El cotejo móvil ↔ web término por término: 112 comparaciones, 0 divergencias.** La web expone
  **los 9 términos** más `Qty pedido` y `Diferencia` ⇒ **no muestra menos de lo que guarda: muestra
  más.** Y **la venta negativa sí se ve** (`−7.0`), que el equipo clampa a 0.
- **El pedido 169 con sus 7 líneas exactas** (los 2 ceros excluidos) y el 170 con sus 3, uno a uno.
- **El ciclo entero:** los 4 inventarios con sus líneas —**incluida la de cantidad 0**, que se
  muestra como `0.00 UNIDAD`—, las 2 devoluciones con su **tipo** y cantidades, y **6 de los 7
  pedidos** con líneas y montos exactos.
- **El pedido 171 (normal) no aparece ligado a ninguna sugerencia** — la etiqueta
  `Inventario relacionado` ni se renderiza. Ídem el 172 (copia).
- **Los enlaces cruzados** inventario ↔ pedido y sugerencia → inventario/pedido navegan y funcionan.
- **El oráculo de conversión de moneda**, exacto en los 7 pedidos.

**No certificado:** el **7.º pedido no se lista** (D-02) · el cotejo del monto es un **PASS débil**
por falta de mezcla de monedas · los casos de merge y doble sincronización **no son ejercitables**
desde la web (esta vuelta fue de sólo lectura, y no se creó, editó ni borró nada).

---

## 6. Registros creados en el sistema

### Inventarios — 4

| Ref | `co_client_stock` | Cliente | Líneas | Sugerencia | Nube | Web |
|---|---|---|---:|---|:--:|:--:|
| **266** | `1788982868820.0` | 100113 PARAMO PIEDRA AZUL | **9** *(una en cantidad 0)* | generada y **enviada (SÍ)** → id 4 | ✅ | ✅ |
| **267** | `1788984757459.0` | 100113 PARAMO PIEDRA AZUL | 3 | generada, **NO enviada** | ✅ | ✅ |
| **268** | `1788985478976.0` | 225 EXCELSIOR GAMA SANTA FE | 3 | generada y **enviada (SÍ)** → id 5 | ✅ | ✅ |
| **269** | `1788985654600.0` | 100121 INSIDE MARKET | 1 | **ninguna** (control de DM-SUG-051) | ✅ | ✅ |

### Sugeridos guardados — 6 (2 en la nube)

| Ref | `co_client_stock_suggested_order` | Inv. | Cliente | Líneas | días desde/hasta | Estado final | Pedido | Nube | Web |
|---|---|---|---|---:|---|---|---|:--:|:--:|
| **4** | `1788983216162.0` | 266 | 100113 | **9** | 1 / 10 | **Enviado** | **169** | ✅ | ✅ |
| **5** | `1788985534564.0` | 268 | 225 | 3 | **21** / 10 | **Enviado** | **170** | ✅ | ✅ |
| 0 | `1788984813263.0` | 267 | 100113 | 3 | 1 / 10 | **Enviado** | **175** | ⛔ | ⛔ |
| 0 | `1788986944237.0` | — | 1702 | 1 | — | **Enviado** | **176** | ⛔ | ⛔ |
| 0 | `1788986798067.0` | — | 1702 | 1 | — | Pendiente | — | ⛔ | ⛔ |
| 0 | `1788986913545.0` | — | 1702 | 1 | — | Pendiente | — | ⛔ | ⛔ |

> Las **cuatro** con Ref 0 nunca subieron a la nube — es lo correcto: el usuario respondió «NO».
> Las tres de **1702** ya estaban en el equipo al arrancar la vuelta 3; se anotan porque cambian el
> conteo de la lista. **Ninguna de las 4 es visible en la web**, y para las dos que ya generaron
> pedido (175 y 176) eso deja la validación de «un solo pedido» **sin respaldo en el servidor**.

### Pedidos — 6 de la corrida (+1 de la QA)

| Ref | `co_order` | Cliente | Líneas | Monto | Nace de | Nube | **Listado web** |
|---|---|---|---:|---:|---|:--:|:--:|
| **169** | `1788984970646.0` | 100113 | **7** | 9.694,10 USD | sugerencia **id 4** *(9 → 7, ceros excluidos)* | ✅ | ✅ |
| **170** | `1788988554518.0` | 225 | 3 | 33,03 USD | sugerencia **id 5** | ✅ | ✅ |
| **171** | `1788988858947.0` | 100121 | 2 | 19,65 USD | alta normal — **sin sugerencia** | ✅ | ✅ |
| **172** | `1788989773322.0` | 225 | 3 | 33,03 USD | **copia** del 170 — sin vínculo | ✅ | ✅ |
| **174** | `1788989703933.0` | 100121 | 2 | 19,65 USD | **copia** del 171 | ✅ | ✅ |
| **175** | `1788990415275.0` | 100113 | 3 | **1.223,60 USD** | sugerencia local `…813263.0` | ✅ | ❌ **D-02** |
| **176** | `1788990576635.0` | 1702 | 1 | 18,36 USD | sugerencia local `…944237.0` | ✅ | ✅ |
| *(173)* | *`1788990182469.0`* | *1702* | *1* | *7,40 USD* | *enviado por la QA a mano — no es de la corrida* | ✅ | ✅ |

### Devoluciones — 2

| Ref | `co_return` | Tipo | Cliente | Detalle | Nube | Web |
|---|---|---|---|---|:--:|:--:|
| **277** | `1788980342896.0` | **Distribución (61)** | 100113 | `046013ESP001BOL` ×5 (lote `L0909A`, AA-AGUADO) · `HIDPROBER001BOL` ×3 (VENCIDO) — factura `20118282` | ✅ | ✅ |
| **278** | `1788980946153.0` | **Calidad (60)** | 100113 | `046013ESP001BOL` ×4 (AA-AGUADO) — factura `20118282` | ✅ | ✅ |

### Registros creados y **borrados** durante el ciclo (el equipo quedó limpio)

| Qué | Por qué | Cómo quedó |
|---|---|---|
| Devolución Guardada `1788981106384.0` (Calidad, `TOMPROCHE001CAJ` ×2) | Instrumento de `DM-DEV-032` (borrado con cascada) | **Eliminada** — `returns` 82 → 81, sin detalles huérfanos |
| Devolución Guardada `1788984563412.0` con una línea en **−3** | Instrumento del **D-03** | **Eliminada desde la UI** al cerrar la vuelta 2: `returns` con `st_delivery=3` = 0 y `return_details` con `qu_product < 0` = 0 |
| Pedido borrador del cliente 104 (1 línea) | `DM-PED-029` (salir sin guardar) | **Nunca persistió**: `count(orders)` 54 → 54 |

**Cierre del equipo:** HOME, **0 pedidos Guardados**, 0 en cola, `pending_transactions = 0` y
`failed_transactions = 0`, stub de geolocalización desinstalado y `navigator.geolocation` restaurado
a nativo. **En la web no se creó, editó ni borró nada.**

---

## 7. Lo que hay que hacer antes de la próxima corrida

| # | Quién | Qué |
|---|---|---|
| 1 | Desarrollo | **D-01:** que el cursor de `versionsTables` avance **sólo hasta el `da_update` de la última fila efectivamente escrita**. Es lo único que destraba DM-SUG-011 — y evita que cualquier registro que falle en silencio se pierda para siempre |
| 2 | Desarrollo | **D-02:** que el camino de `clientstocksuggestedorderlink` no deje `order.co_operation` en NULL **y** que los listados de la web usen `co_operation IS DISTINCT FROM 'D'` en vez de `<> 'D'`. ⚠ Revisar si el mismo `<> 'D'` está en cobros, devoluciones, inventarios y depósitos |
| 3 | Desarrollo | **D-03:** filtrar por estado de envío en `getReturnsByDistribution` (excluir `st_delivery = 3`). Una devolución que no salió del teléfono no es un hecho comercial |
| 4 | QA | Corregir el bloque `# Cliente: hidroponias` de `secrets/qa-credentials.env`: dice `vendedor4`, es `vendedor3` |
| 5 | QA | Medir **DM-SUG-040** (lista vacía) al **inicio** de la próxima corrida, antes de abrir ninguna vista previa |
| 6 | QA | Conseguir un pedido con **mezcla de monedas** (o con IVA/descuento ≠ 0) para que el cotejo de `nu_amount_total` deje de ser un PASS débil |
| 7 | Equipo / REQ | Decidir: ¿la sugerencia debería **subir igual** al convertirse en pedido, aunque el usuario dijera que no? Hoy la validación de «un solo pedido por sugerencia» **no está respaldada en el servidor** para esas cuatro |
| 8 | Automatización | Promover los selectores nuevos de la web (§7 de `04-web.md`) a `automation/web/web-selectors/sugerenciasPedido.md` y sumar las dos rutas a `automation/web/playas.yaml`. **Hoy no hay nada documentado de esa pantalla** |

---

*Consolidado de las 4 vueltas del ciclo `ciclo_sugerido_3capas_20260909` · 192 casos · 3 capas.*

---

# Addendum · 10/09/2026 — lo que se aprendió después de cerrar el ciclo

## D-02 · La causa, encontrada

El pedido queda con `co_operation` en **NULL** —y por tanto fuera del listado web— cuando se
cumplen **las dos** condiciones a la vez:

1. el pedido nace de un inventario (`id_client_stock` no nulo), **y**
2. la sugerencia de ese inventario **no está en la nube**.

Cotejo sobre los 7 pedidos de la corrida, **7 de 7**:

| Pedido | Ligado a inventario | Sugerencia en nube | `co_operation` |
|---|---|---|---|
| 166 | sí (157) | **no** | **NULL** |
| 175 | sí (267) | **no** | **NULL** |
| 169 | sí (266) | sí | `I` |
| 170 | sí (268) | sí | `I` |
| 171 · 174 · 176 | no | no | `I` |

**Receta de reproducción** (el flujo es legítimo, no un caso de laboratorio — es DM-SUG-053,
que además PASA):

1. Inventario con sugerencia generada.
2. Enviar el inventario y responder **NO** a «¿Desea enviar también la sugerencia de pedido?».
3. Convertir esa sugerencia en pedido y enviarlo.
4. El pedido llega a la nube con `co_operation = NULL` ⇒ no sale en Transacciones → Pedidos.

**Control:** el mismo flujo respondiendo **SÍ** produce `co_operation = 'I'` y el pedido se lista.

En 176 pedidos desde julio, el estado nulo aparece **exactamente dos veces**, y las dos son de
la ventana de prueba de esta rama.

## D-02 · Matiz aportado por QA (a validar)

**El pedido sí aparece si se busca por su referencia**; lo que no lo enumera es el listado.
Coherente con lo medido: son dos consultas distintas y solo la del listado aplica
`co_operation <> 'D'`, que en SQL descarta los nulos en silencio.

⇒ El arreglo es de la **consulta del listado**, no del dato. Y queda una pregunta abierta para
desarrollo: **qué otras pantallas usan ese mismo filtro** — si despacho, un reporte o una
exportación filtran igual, el pedido no solo no se ve: no se atiende.

## D-01 · Retirado como defecto

La hipótesis de QA explica mejor lo observado: el proceso de sincronización solo entrega
registros con respaldo en el ERP, y el cliente se insertó por SQL directo. La evidencia que
teníamos —el cursor clavado en el sello exacto de la fila— **no distingue** entre «el servidor
la mandó y el equipo no la escribió» y «el servidor nunca la mandó y aun así devolvió esa
marca de agua». Nunca vimos la respuesta del servidor.

**Conclusión de método, que es lo que queda:** los datos de prueba inyectados por SQL directo
**no bajan al equipo**. Un escenario como el de DM-SUG-011 hay que construirlo por el camino
del ERP, o no se puede probar.

## Para la próxima vuelta

| # | Qué | Por qué |
|---|---|---|
| 1 | **Confirmar la receta de D-02** y el matiz de la búsqueda por referencia | Es lo que convierte el hallazgo en algo montable y verificable |
| 2 | **El formulario de pedido contaminado** — pulsar Enviar en entorno desechable | Es el único experimento que quedó sin hacer, y si duplica o pisa sube a S1 |
| 3 | **Re-probar el sugerido con el fix de las devoluciones guardadas** | Ya está comprometido por desarrollo |
| 4 | **DM-SUG-011**, si se consigue el dato por la vía del ERP | Nunca se ha podido medir: ni el 01/09, ni el 08/09, ni el 09/09 |
| 5 | La alerta que pide **lote** con `expirationBatch = false` | Reportada, arreglo diferido por tiempo |
