# Vuelta 3 · PEDIDOS — ciclo «Pedido Sugerido» · HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `ciclo_sugerido_20260911` · vuelta 3 (pedidos) |
| Cliente / empresa | `hidroponias` · **HIDRO_A** |
| Usuario | **V3 · ROGER MUESES** (`id_user 469`) |
| Playa | Isla Coche |
| APK | `com.kiberno.denarioPremiumPro` **6.6.21.4** · rama `SaveSuggestedOrder` · commit `272ef3c0` |
| Dispositivo | Infinix X6728 · Android 15 · CDP `:9220` |
| Conducción | Node + Playwright de `automation/playwright/node_modules` (`connectOverCDP`). El MCP de Playwright no levanta |
| Ventana | 11/09/2026 18:20 – 19:05 (hora del equipo) |
| Resultado | **16 PASS · 2 FAIL · 3 N/A · 0 BLOCKED** + 1 hallazgo S2 |

---

## A · Ticket 2 — el pedido invisible en la web y el `co_operation` nulo

### El experimento, servido por la vuelta 2

Las cuatro sugerencias Pendientes que dejó la vuelta 2 permiten el contraste exacto que pide el
ticket: **mismo flujo, misma build, mismo vendedor**, y la única variable es si la sugerencia de la
que nace el pedido **está o no en la nube**.

| # | Sugerencia (`co`) | Cliente | Inventario | ¿En la nube? | Pedido generado | `id_client_stock` en nube | **`co_operation`** | Veredicto |
|---|---|---|---|---|---|---|---|---|
| 1 | `1789163276184.0` | `104` C. MADEIRENSE LA BOYERA | 276 | ❌ **NO** (sólo local) | **178** · `co_order 1789165671911.0` | **276** (resuelto) | **`I`** | ✅ **el defecto NO reproduce** |
| 2 | `1789162387211.0` | `100113` PARAMO PIEDRA AZUL | 275 | ✅ **SÍ — ref 6** | **179** · `co_order 1789166201998.0` | **275** (resuelto) | **`I`** | ✅ control, como se esperaba |
| 3 | *(sin sugerencia)* pedido normal | `403` PLAZA S GALERIAS | — | — | **180** · `co_order 1789166261259.0` | `NULL` (no aplica) | **`I`** | ✅ no queda ligado a nada |
| 4 | `1789160290226.0` **huérfana** | `100113` | ⚠ inexistente | ❌ NO | **181** · `co_order 1789166637527.0` | **`NULL`** (no resoluble) | **`I`** | ⚠ aceptado con referencia colgada — ver §C.1 |

**Consulta de cierre (nube):**

```sql
SELECT count(*) FILTER (WHERE co_operation IS NULL) AS nulos, count(*) AS total FROM "order";
-- antes de la vuelta 3: nulos = 3 · total = 177
-- después:              nulos = 3 · total = 181
```

Los **3** nulos siguen siendo `id_order` **166 · 175 · 177**, todos **anteriores** a esta vuelta
(09/09 y 10/09). **Ninguno de los 4 pedidos creados hoy quedó en nulo.**

### 🟢 Veredicto: **el ticket 2 está CORREGIDO**

- La condición que en el ciclo anterior era suficiente para el nulo —*nacer de un inventario* **y**
  *que la sugerencia no esté en la nube*, patrón 7 de 7— **ya no lo produce**: el caso 1 cumple las
  dos condiciones exactamente y salió con **`co_operation = 'I'`**.
- El caso 2 (control) confirma que el camino con sugerencia sincronizada **también** sale `'I'`.
- Además, el servidor **resolvió bien `id_client_stock`** en los dos (276 y 275) a partir de
  `co_client_stock`.
- **Reserva honesta:** esto prueba que *el nulo no se produce por este camino en esta build*. La
  segunda mitad del ticket —que el listado web use `IS DISTINCT FROM 'D'` en vez de `<> 'D'`— **no se
  verificó en esta vuelta**; los 3 pedidos nulos históricos siguen ahí y seguirán invisibles. Eso lo
  coteja la **vuelta 4** en la web.

### 🔎 Hallazgo lateral que refuerza la severidad histórica del ticket 2

Los dos pedidos nulos de la ventana de prueba (**175** y **177**) **tampoco aparecen en el listado
BUSCAR de la propia app**, y **no existen en la BD local del equipo**: `SELECT … FROM orders WHERE
id_order IN (166,174,175,176,177)` devuelve **sólo 174 y 176**. Los 4 creados hoy (178-181, todos
`'I'`) sí están en la lista de la app y en la BD local.

⇒ El filtro que descarta los nulos **no está sólo en la pantalla web**: también en lo que el equipo
vuelve a bajar. Un pedido con `co_operation` nulo **desaparece de las dos capas**. Es material directo
para la pregunta abierta del ciclo anterior: *«qué otras pantallas usan ese mismo filtro»*.

---

## B · Bloques C, D y E del guión

### B.1 · El submódulo «Sugerencias de Pedido» (bloque C)

Ruta: **HOME → Inventarios → SUGERENCIAS DE PEDIDO** (`app-inventario-sugerido-list`).

| ID | Caso | Resultado | Evidencia |
|---|---|---|---|
| DM-SUG-040 | Lista vacía | 🚫 **N/A** | hay 9 sugerencias vivas; no se puede vaciar sin borrar datos del cliente |
| DM-SUG-041 | Lista con cliente, fecha **y nº de líneas** | ❌ **FAIL (parcial)** | lista **cliente · Nro. Ref. · Estatus · fecha**. **No muestra el número de líneas**, que sí está en `nu_details`. Reconfirma la Obs. 2 de la vuelta 2 |
| DM-SUG-042 | Estatus Pendiente / Enviado | ✅ **PASS** | las 3 consumidas pasan a «Enviado»; las no consumidas siguen «Pendiente» |
| DM-SUG-043 | Abrir un guardado muestra **los mismos números** | ✅ **PASS** | ver §B.2 — 50 de 50 valores idénticos |
| DM-SUG-045 | Confirmar la vista previa de un Pendiente lanza el pedido | ✅ **PASS** | 3 de 3 conversiones (104 · ref 6 · huérfana) |
| DM-SUG-046 | **Salir sin confirmar** deja la sugerencia intacta | ✅ **PASS** | ver §B.3 |
| DM-SUG-065 | Eliminar una sugerencia | 🚫 **N/A** | la lista **no ofrece borrado**: `ion-item-sliding = 0`, `ion-item-option = 0`, sin botones de acción |

**Orden de la lista.** Se reconfirma la Observación 1 de la vuelta 2: las sincronizadas (ref 6 y 7,
17:38 y 17:52) se ordenan **por encima** de las locales más nuevas (1702 a las 17:55), porque
`da_suggested` se ordena como texto y la sync reescribe esa columna en formato ISO
(`2026-09-11T21:52:59.000+00:00`) frente al local `2026-09-11 17:55:41`. Cosmético, pero sigue vivo.

### B.2 · DM-SUG-043 · Es un *snapshot*, no un recálculo — cotejo a tolerancia 0

Sugerencia `1789163276184.0` (cliente `104`, 5 líneas). Se compararon **los 10 términos de cada
línea** entre lo leído en la vista previa
(`ng.getComponent(app-inventario-sugerido-preview).productsSuggested`) y lo guardado en
`client_stock_suggested_order_details` de la BD local:

| Producto | sugerido | prev | actual | despacho | camb×camb | devuelto | inicial | vendido | diario |
|---|---|---|---|---|---|---|---|---|---|
| CAMPROSDU002BOL | 2 | 0 | 0 | 0 | 4 | 0 | 4 | 4 | 0,173913… |
| HIDPROBER001BOL | 0 | 2 | 4 | 12 | 0 | 0 | 14 | 10 | 0,434782… |
| 046PRO003003025 | 1 | 1 | 0 | 0 | 7 | 5 | 8 | 3 | 0,130434… |
| CAMPROLEC001BAN | 2 | 0 | 0 | 0 | 5 | 0 | 5 | 5 | 0,217391… |
| GERPROGCH002BOL | 6 | 4 | 3 | 8 | 5 | 0 | 17 | 14 | 0,608695… |

**50 de 50 coinciden exactamente**, decimales incluidos. La cabecera también:
`days_since_last = 23` / `days_until_next = 10` en pantalla y en BD. Ídem para la huérfana
(`days_since_last = 1` / `days_until_next = 7` en las dos capas) ⇒ **los días también son snapshot, no
recálculo**.

### B.3 · DM-SUG-046 · Salir sin confirmar

Se abrió la sugerencia `1789163276184.0`, se cerró con la ✕ del `ion-modal` y se releyó:

- sigue listada, **«Pendiente»**;
- `in_order_sent = 0`, `co_order = NULL`, 5 líneas intactas en la BD local;
- ningún pedido creado (`order` en la nube seguía en 177).

✅ **PASS.**

### B.4 · Un solo pedido por sugerencia (bloque E)

| ID | Caso | Resultado | Evidencia |
|---|---|---|---|
| DM-SUG-060 | Convertir deja `in_order_sent = 1` + `co_order`/`id_order` | ✅ **PASS** | `1789163276184.0` → `in_order_sent 1`, `co_order 1789165671911.0`, `id_order 178`. Ídem ref 6 → 179 y huérfana → 181 |
| DM-SUG-061 | Vuelve a la lista como **«Enviado»** | ✅ **PASS** | las 3 consumidas cambiaron de «Pendiente» a «Enviado» |
| DM-SUG-062 | Reabrir y confirmar **no** crea un segundo pedido | ✅ **PASS** | ver abajo |
| DM-SUG-063 | ¿La pantalla **explica** por qué está bloqueada? | ❌ **FAIL (usabilidad · S3)** | ver abajo |
| DM-SUG-064 | Un solo pedido por sugerencia, en la nube | ✅ **PASS** | `SELECT co_client_stock, count(*) … GROUP BY 1` ⇒ **1 pedido por cada `co_client_stock`**, sin excepción |
| DM-SUG-066 | Dos sugerencias distintas del **mismo cliente** | ✅ **PASS** | `100113` generó **dos** pedidos independientes (179 desde ref 6 y 181 desde la huérfana); marcar una no bloqueó la otra |

**DM-SUG-062 — el oráculo, medido en el `ion-footer`.** Al reabrir una sugerencia ya convertida:

```
disabled = true · disableOrderButton = true · blockCreateSuggestedOrder = true
clase: "botonAddAmarillo … button-disabled …"
```

Se **pulsó igual** el ACEPTAR con `pg.mouse.click` sobre sus coordenadas reales (no `.click()` por JS,
que atravesaría el bloqueo y daría un falso PASS): la app **no navega**, no abre pedido, no lanza
alerta, y el modal se queda donde estaba. Medido en **dos** sugerencias distintas (la de `104` y la
huérfana). **Cero pedidos duplicados en la nube.**

**DM-SUG-063 — sigue mudo.** El texto completo del modal reabierto es:

```
Pedido Sugerido · Moneda: · Días desde último Inventario: 23 · Días para siguiente Inventario: 10
CAMPROSDU002BOL - MAIZ SUPER DULCE BANDEJA
HIDPROBER001BOL - BERRO DE 100 GRS.
046PRO003003025 - ALBAHACA BOLSA 30GRS. (E)
CAMPROLEC001BAN - ENSALADA LECHUGA MIXTA C/CHERRY 150g
GERPROGCH002BOL - GRANO CHINO BOLSA DE 200 GRS.
ACEPTAR
```

**Ni una palabra** sobre que ya se convirtió, ni el número del pedido que la consumió (`178`/`181`,
que la app **sí tiene** guardado en `id_order`). La única señal es el botón en gris — y está **dentro**
del modal, mientras que el «Enviado» está **fuera**, en la lista. El vendedor que abre desde la lista
sin mirar el estatus pulsa ACEPTAR y no pasa nada, sin poder distinguir «está bloqueado» de «la app se
colgó». **Es el mismo hallazgo de usabilidad del ciclo anterior, sin cambios.** Severidad **S3**; el
arreglo es una línea de texto.

### B.5 · Las líneas del pedido = los sugeridos > 0, ceros excluidos

| Pedido | Sugerencia | Líneas en la sugerencia | Con sugerido > 0 | Líneas en la nube | Cantidades en la nube |
|---|---|---|---|---|---|
| **178** | `1789163276184.0` | 5 | **4** (excluye `HIDPROBER001BOL` = 0) | **4** ✅ | `CAMPROSDU002BOL 2` · `046PRO003003025 1` · `CAMPROLEC001BAN 2` · `GERPROGCH002BOL 6` |
| **179** | `1789162387211.0` (ref 6) | 6 | **3** (excluye 3 ceros) | **3** ✅ | `HIDPROBER001BOL 150` · `TOMPROMAN001GRA 2560` · `TOMPROCHE001CAJ 120` |
| **181** | `1789160290226.0` | 1 | **1** | **1** ✅ | `GERPROALF002CAJ 126` |

✅ **PASS** · las cantidades coinciden **1:1** con `qu_unit_suggested`. Total cuadrado:
178 = 1,66 + 5,84 + 10,46 + 9,72 = **27,68 USD**.

> ℹ **Matiz de implementación, sin impacto.** En memoria, justo tras convertir, `order.orderDetails`
> trae **todas** las líneas de la sugerencia (incluidas las de sugerido 0) y `nuDetails` dice `5`; las
> de sugerido 0 llegan con **`orderDetailUnit: []`**. El filtrado ocurre al guardar: la BD local y la
> nube quedan con `nu_details = 4`. **No es defecto** — se anota porque leer `nuDetails` del
> componente como oráculo da un FAIL falso.

### B.6 · El auto-send no envía sola una sugerencia Pendiente (DM-SUG-084)

Al cierre se lanzó una **sincronización completa** desde HOME (HOME → Sincronizar → ACEPTAR, ~10,5 s)
con **cuatro** sugerencias Pendientes vivas, incluida `1789163741436.0` — la del cliente `1702`, que
es exactamente la que en la vuelta 2 **quedó Pendiente porque el usuario respondió NO**.

| | antes de la sync | después |
|---|---|---|
| `client_stock_suggested_orders` (nube) | 7 | **7** |
| `client_stock_suggested_order_details` (nube) | 25 | **25** |
| `order` (nube) | 181 | **181** |
| cabeceras locales | 9 | **9** |
| `pending_transactions` / `failed_transactions` | 0 / 0 | **0 / 0** |

✅ **DM-SUG-084 PASS** — el auto-send **no** subió ninguna sugerencia Pendiente.
✅ **DM-SUG-077 (parcial) PASS** — la sincronización no duplicó ni perdió filas.

> 🔴 **Dato para la vuelta 4.** Convertir una sugerencia en pedido **no la sube a la nube**. Los
> pedidos **178** y **181** existen en la nube apuntando a sugerencias que **no tienen fila allí**.

### B.7 · Un pedido normal no queda ligado a ninguna sugerencia (DM-SUG-081)

Pedido **180** armado desde cero (PEDIDO → cliente `403` AUTOMERCADOS PLAZA S - GALERIAS →
ENSALADAS → `CAMPROLEC003BAN` × 3 → Enviar):

```
id_order 180 · co_order 1789166261259.0 · co_client 403 · co_operation 'I'
id_client_stock = NULL · co_client_stock = NULL · nu_details 1 · total 6,27 USD  (2,09 × 3 ✓)
SELECT … FROM client_stock_suggested_orders WHERE co_order = '1789166261226.0'  ⇒  0 filas
```

✅ **PASS.**

---

## C · Dos cosas abiertas de vueltas anteriores

### C.1 · 🟠 La sugerencia huérfana — **la respuesta que faltaba: el servidor la acepta**

La vuelta 2 dejó caracterizado que la sugerencia `1789160290226.0` (ligada a
`co_client_stock 1789160266062.0`, un inventario que **no existe**) se convierte en pedido sin aviso.
La pregunta de esta vuelta era **qué pasa si ese pedido se envía**.

**Se envió. Y el servidor lo aceptó.**

```
Alerta del servidor: «Denario Premium — Pedido nro. 181 enviado exitosamente»

id_order 181 · co_order 1789166637527.0 · co_client 100113 · co_operation 'I'
co_client_stock = '1789160266062.0'        ← la referencia rota, viajó tal cual
id_client_stock = NULL                     ← el servidor NO pudo resolverla
nu_details 1 · GERPROALF002CAJ × 126 · total 245,70 USD
SELECT count(*) FROM client_stock WHERE co_client_stock = '1789160266062.0'  ⇒  0
```

**Las tres respuestas concretas:**

1. **¿Lo acepta el servidor?** **Sí**, sin queja, con acuse explícito de envío exitoso.
2. **¿Con qué `co_operation`?** **`'I'`** ⇒ el pedido **sí va a listarse** en la web (a diferencia de
   los nulos históricos). El daño no es invisibilidad: es una referencia colgada **visible**.
3. **¿Queda una referencia huérfana en la nube?** **Sí.** Contraste directo dentro de la misma
   corrida: los pedidos 178 y 179 nacieron de inventarios reales y el servidor **resolvió**
   `id_client_stock` (276 y 275); el 181 nació del inventario fantasma y quedó con `co_client_stock`
   poblado pero **`id_client_stock = NULL`**.

**Severidad: sube de S3 a S2.** La vuelta 2 lo dejó en S3 porque el pedido nunca salió del equipo.
Ahora está probado que **sale, se acepta y persiste**: la nube de un cliente real queda con un pedido
de 245,70 USD colgado de un inventario inexistente, y **`id_client_stock = NULL` es el único síntoma
detectable desde la nube**. La reproducción sigue siendo trivial (inventario nuevo → un producto →
RESUMEN → PEDIDO SUGERIDO → cerrar la vista previa → **Salir sin guardar** → *Inventario →
SUGERENCIAS DE PEDIDO* → ACEPTAR → Enviar).

⚠ **Nota de alcance.** Esto **no** contradice el arreglo del ticket 2: el `id_client_stock = NULL` es
consecuencia de que el inventario no existe, no del bug del `co_operation`. Son dos cosas distintas y
el `co_operation` salió bien.

### C.2 · 🔴 El formulario contaminado — **REPRODUCIDO**, con el estado medido

**Reprodujo 1 de 5 intentos** en esta corrida (el ciclo anterior reportó 1 de 3). **No se pulsó
Enviar**, por instrucción.

**La reproducción (intento 1 de 5).** Tras enviar el pedido **178** y quedar en `/pedidos`, se pulsó
**PEDIDO**. La app navegó a `/pedido` en **1,02 s** y el formulario abrió así:

| Campo | Valor que mostró | Lo que debería mostrar un pedido nuevo |
|---|---|---|
| `order.coOrder` | **`1789165671911.0`** — el `co_order` del pedido **ya enviado** | un `co` nuevo |
| `order.coClient` | **`104`** · `#clienteSelect` = *«CENTRAL MADEIRENSE C.A. (104)»* | vacío |
| `order.coClientStock` | **`1789163189104.0`** — el inventario del pedido enviado | `null` |
| `order.orderDetails` | **5 líneas**, las mismas del pedido enviado (`nuDetails = 5`) | 0 |
| «Fecha Pedido» | **11/9/2026, 6:27 P. M.** — la hora del pedido enviado, no la actual | la hora actual |
| `orderServ.coordenadas` | **`11.0490179,-63.8650077`** — la del envío anterior | vacía |
| `order.idOrder` / `stDelivery` | `0` / `0` ⇒ **se presenta como pedido NUEVO** | `0` / `0` |
| Botón **GUARDAR** | deshabilitado | deshabilitado |
| Botón **ENVIAR** | 🔴 **HABILITADO** (`disableSendButton = false`) | deshabilitado |

Es decir: **un formulario que dice ser nuevo, con el contenido íntegro de un pedido ya enviado y el
botón Enviar activo.** Un vendedor que lo dé por bueno y pulse Enviar reenvía el pedido del cliente
anterior. Se salió con la flecha atrás —**sin diálogo de confirmación**, porque `changesMade = false`—
y se comprobó que la nube seguía en 178 pedidos.

**Lo que NO se puede afirmar:** si el reenvío **duplicaría** el pedido o **pisaría** el 178. Hay un
indicio a favor de «duplicaría»: en el pedido normal (180) el `coOrder` que mostraba el formulario
(`…261226.0`) **no** es el que llegó a la nube (`…261259.0`), o sea que la app regenera el `co` al
guardar. Pero es un indicio, no una medición. **Esto hay que cerrarlo a mano o en un entorno
desechable, no contra la nube de HIDROPONIAS.**

**Intentos negativos y la hipótesis que se descartó.** Los intentos 2 a 5 dieron formulario limpio
(`coOrder` nuevo, sin cliente, 0 líneas, **Enviar deshabilitado**):

| # | Contexto | Resultado |
|---|---|---|
| 1 | tras enviar 178; la 2ª alerta («Su Pedido será enviado») quedó **sin contestar ~4 min** | 🔴 **CONTAMINADO** |
| 2 | tras enviar 179; las 3 alertas contestadas seguidas (~2 s) | ✅ limpio |
| 3 | tras enviar 180; ídem | ✅ limpio |
| 4 | tras enviar 181; la 2ª alerta **demorada 70 s a propósito** para replicar el intento 1 | ✅ limpio |
| 5 | tras abrir el pedido 181 desde BUSCAR (sólo lectura) y volver | ✅ limpio |

⇒ **La hipótesis «se contamina si se tarda en cerrar la alerta de envío» queda refutada** (intento 4).
**No se identificó el disparador.** Queda como **intermitente, ~1 de 5**, con el estado descrito
arriba, que es lo reproducible y accionable para desarrollo.

---

## Tabla de veredictos

| ID | Caso | Resultado | Evidencia / señal |
|---|---|---|---|
| **TICKET-2 / caso 1** | Pedido desde sugerencia **no sincronizada** | ✅ **PASS** | pedido **178** · `co_operation = 'I'` · `id_client_stock 276` |
| **TICKET-2 / caso 2** | Pedido desde sugerencia **sincronizada** (ref 6) | ✅ **PASS** | pedido **179** · `co_operation = 'I'` · `id_client_stock 275` |
| **TICKET-2 / conteo** | Nulos totales en `order` | ✅ **PASS** | **3 de 181**, los mismos 3 de antes (166/175/177), ninguno de hoy |
| DM-SUG-040 | Submódulo sin sugeridos guardados | 🚫 **N/A** | 9 sugerencias vivas; no se puede vaciar |
| DM-SUG-041 | Lista con cliente, fecha y **nº de líneas** | ❌ **FAIL** | no muestra el nº de líneas (`nu_details` existe) |
| DM-SUG-042 | Estatus Pendiente / Enviado | ✅ **PASS** | las 3 consumidas viran a «Enviado» |
| DM-SUG-043 | Abrir un guardado = snapshot | ✅ **PASS** | 50/50 valores + cabecera de días |
| DM-SUG-045 | Confirmar la vista previa lanza el pedido | ✅ **PASS** | 3 de 3 conversiones |
| DM-SUG-046 | Salir sin confirmar deja intacta la sugerencia | ✅ **PASS** | `in_order_sent 0`, 5 líneas, 0 pedidos nuevos |
| DM-SUG-060 | `in_order_sent = 1` + `co_order`/`id_order` | ✅ **PASS** | 3 de 3 |
| DM-SUG-061 | Vuelve como «Enviado» | ✅ **PASS** | verificado en la lista |
| DM-SUG-062 | Reabrir y confirmar no crea 2º pedido | ✅ **PASS** | ACEPTAR `disabled=true`; clic real sin efecto; nube 1 pedido por sugerencia |
| DM-SUG-063 | ¿Explica por qué está bloqueado? | ❌ **FAIL (usabilidad · S3)** | cero texto en el modal; sólo el gris del botón |
| DM-SUG-064 | Un solo pedido por sugerencia en la nube | ✅ **PASS** | `GROUP BY co_client_stock` ⇒ 1 en todos |
| DM-SUG-065 | Eliminar una sugerencia | 🚫 **N/A** | la UI no ofrece borrado |
| DM-SUG-066 | Dos sugerencias del mismo cliente | ✅ **PASS** | `100113` → pedidos 179 y 181, independientes |
| DM-SUG-074 | Líneas del pedido = sugeridos > 0 | ✅ **PASS** | 4/5, 3/6 y 1/1 · cantidades 1:1 |
| DM-SUG-077 | Sincronizar sin duplicar ni perder | ✅ **PASS** (parcial) | 7/25 nube y 9 locales, antes y después |
| DM-SUG-081 | Pedido normal no ligado a sugerencia | ✅ **PASS** | pedido **180** · `co_client_stock NULL` · 0 filas ligadas |
| DM-SUG-084 | Auto-send no envía sola una Pendiente | ✅ **PASS** | tras sync completa, nube sigue en 7 cabeceras / 25 detalles |
| **HUÉRFANA** | ¿El servidor acepta el pedido huérfano? | ⚠ **HALLAZGO S2** | **sí** · pedido **181** · `co_operation 'I'` · `id_client_stock NULL` |
| **FORM-CONTAMINADO** | ¿Reproduce? | ❌ **FAIL · 1 de 5** | `coOrder`/cliente/5 líneas del pedido ya enviado + **Enviar habilitado** |

**16 PASS · 2 FAIL · 3 N/A · 0 BLOCKED**, más el hallazgo S2 de la huérfana y el FAIL del formulario
contaminado contados en sus filas.

---

## Registros creados en el sistema

> **Insumo directo de la vuelta 4 — estos son los que hay que cotejar en la web.**

### Pedidos (los 4 llegaron a la nube · `st_delivery = 1` · `pending/failed = 0`)

| Nro. Ref. (`id_order`) | `co_order` | Cliente | Origen | `co_client_stock` | `id_client_stock` (nube) | `co_operation` | Líneas | Total USD | Qué mirar en la web |
|---|---|---|---|---|---|---|---|---|---|
| **178** | `1789165671911.0` | `104` C. MADEIRENSE LA BOYERA | sugerencia `1789163276184.0` — **NO está en la nube** | `1789163189104.0` | **276** | **`I`** | 4 | **27,68** | 🔑 **el caso clave del ticket 2: debe LISTARSE** |
| **179** | `1789166201998.0` | `100113` PARAMO PIEDRA AZUL | sugerencia `1789162387211.0` = **ref 6** | `1789161963788.0` | **275** | **`I`** | 3 | **7.184,80** | control · su sugerencia **sí** está en la web (ref 6, ahora `in_order_sent 1`) |
| **180** | `1789166261259.0` | `403` PLAZA S GALERIAS | **pedido normal**, sin sugerencia | `NULL` | `NULL` | **`I`** | 1 | **6,27** | no debe aparecer ligado a ninguna sugerencia |
| **181** | `1789166637527.0` | `100113` PARAMO PIEDRA AZUL | sugerencia **huérfana** `1789160290226.0` | `1789160266062.0` ⚠ **inexistente** | **`NULL`** | **`I`** | 1 | **245,70** | ⚠ **referencia colgada en la nube** — ver qué hace la web al abrirlo |

Baseline-diff de la nube: `order` **177 → 181** · `max(id_order)` **177 → 181** ⇒ **+4 exactas**, sin
duplicados.

### Sugerencias consumidas en esta vuelta

| `co_client_stock_suggested_order` | Ref. en nube | Cliente | Pasó a | `in_order_sent` | Fila en la nube |
|---|---|---|---|---|---|
| `1789163276184.0` | — (sólo local) | `104` | pedido **178** | 1 | **no tiene** |
| `1789162387211.0` | **6** | `100113` | pedido **179** | 1 | sí — `co_operation 'U'`, con `co_order`/`id_order 179` |
| `1789160290226.0` | — (sólo local, **huérfana**) | `100113` | pedido **181** | 1 | **no tiene** |

### Lo que quedó vivo y NO hay que tocar

| Registro | Estado | Por qué |
|---|---|---|
| `co_return 1789159255271.0` — devolución Guardada, `id_return = 0` | intacta | 🔴 **el centinela del fix** — sigue viva al cierre de la vuelta 3 |
| Sugerencia `1789163579449.0` = **ref 7**, cliente `100121`, 2 líneas | **Pendiente**, en la nube | material de la vuelta 4 para el cotejo web de sugerencias |
| Sugerencia `1789163741436.0`, cliente `1702`, 2 líneas | **Pendiente**, sólo local | la del **NO** de DM-SUG-053; prueba viva de que el auto-send no la sube |
| Sugerencias `1789159595357.0` y `1789160048412.0`, cliente `100113` | **Pendiente**, sólo local | sobrantes de la vuelta 1 |

---

## Lo que NO se pudo comprobar

| Caso | Motivo |
|---|---|
| **¿El formulario contaminado duplica o pisa el pedido en la nube?** | ⛔ **Por instrucción, no se pulsó Enviar** sobre el formulario contaminado: el riesgo era duplicar o pisar un pedido real del cliente. **Hay que cerrarlo a mano o en un entorno desechable** |
| **El disparador del formulario contaminado** | Reprodujo 1 de 5 y la única hipótesis con forma (demorar la 2ª alerta) **se probó y falló**. Sin patrón identificado |
| **La otra mitad del ticket 2 — el filtro `<> 'D'` del listado web** | ⏭ **Vuelta 4.** Esta vuelta sólo prueba que ya **no se generan** nulos nuevos; los 3 históricos (166 · 175 · 177) siguen ahí y seguirán invisibles |
| **DM-SUG-040 — lista vacía** | 🚫 N/A: hay 9 sugerencias vivas y vaciarlas implicaría borrar datos del cliente |
| **DM-SUG-044 — abrir un guardado días después** | ⏭ exige dejar pasar días con facturas nuevas de por medio |
| **DM-SUG-065 — qué pasa con la sugerencia si se borra el pedido** | 🚫 la UI no ofrece borrar ni la sugerencia ni el pedido enviado |
| **DM-SUG-076 — merge del estado nube↔local (cuál gana)** | ⏭ no se forzó la divergencia (marcar en la nube y dejar Pendiente en el equipo) |
| **DM-SUG-077 completo — dos sincronizaciones seguidas** | ✅ parcial: se corrió **una** sync completa sobre datos ya sincronizados, sin duplicados ni pérdidas. No se encadenaron dos |
| **Envío sin señal (cola + reintento)** | ⏭ exige modo avión, fuera de lo reproducible por UI. `pending_transactions = 0` toda la corrida |
| **Que 175/177 falten también en la web** | ⏭ vuelta 4. Aquí sólo se midió que faltan en la lista de la app y en la BD local del equipo |

---

## Acomodaciones de harness (no son datos, no son defectos)

| Acomodación | Por qué hizo falta |
|---|---|
| 🔧 **GPS calentado con `navigator.geolocation.watchPosition({enableHighAccuracy:true})`** + inyección de `geoServ.getCurrentPosition().then(c => orderServ.coordenadas = c)` **justo antes de cada Enviar** | `userMustActivateGPS = true` y el proveedor nativo falla bajo techo. **Es acomodación del banco de pruebas, no un dato de la app.** Se usó en los **4** envíos; las coordenadas que viajaron son las reales del equipo (`11,0490 / −63,8650`). Con el proveedor caliente, el Enviar nunca se bloqueó ⇒ **el defecto conocido «tras un fallo de GPS el botón Enviar no revive» NO se ejercitó en esta vuelta** |
| 🔧 Lectura de alertas por **`innerText`**, no `textContent` | En esta build `ion-alert.textContent` devuelve **cadena vacía** mientras `innerText` trae el mensaje. Con `textContent` el bucle de alertas «no ve» ninguna y contesta a ciegas — así se perdió el mensaje de la 1ª alerta del pedido 178 |
| 🔧 Cada script de Node cierra con `process.exit(0)` | `connectOverCDP` deja el proceso vivo indefinidamente: sin el `exit`, cada paso se cuelga hasta el techo del shell |

**Ninguna de estas tocó datos ni cambió el comportamiento medido.**

---

## Patrones y selectores nuevos

| Patrón / selector | Alcance | Detalle |
|---|---|---|
| 🔴🔴 **`ion-alert.textContent` es `''` en esta build; usar `innerText`** | universal (harness) | Rompe el patrón graduado «verificar el clic por el CAMBIO del mensaje»: si el mensaje siempre se lee `''`, nunca cambia y el bucle da por fallado un clic que funcionó, o contesta la alerta siguiente sin saberlo. **Receta: `(alert.innerText||'').replace(/\s+/g,' ')`**, y la 3ª alerta (`«Pedido nro. N enviado exitosamente»`) como único acuse del servidor |
| 🔴 **El «un solo pedido por sugerencia» se lee en 3 banderas, no en una** | universal (oráculo) | `app-inventario-sugerido-preview ion-footer ion-button`.`disabled` + `disableOrderButton` + **`blockCreateSuggestedOrder`** del componente. Las tres viran a `true` a la vez. `previewReady` sigue en `true` ⇒ **no sirve como oráculo** |
| 🔴 **Tras convertir, `order.orderDetails` trae TAMBIÉN las líneas de sugerido 0, con `orderDetailUnit: []`** | universal (oráculo) | `nuDetails` en memoria dice 5 y la BD local + la nube guardan 4. **Contar `orderDetails` del componente da un FAIL falso**: contar los que tienen `orderDetailUnit.length > 0`, o cotejar contra `nu_details` de la BD |
| 🔴 **`orderServ.desdeSugerencia` / `coClientStockAEnviar` / `idClientStockAEnviar` quedan VACÍOS tras convertir** | universal (diagnóstico) | `false` / `''` / `0` en las **3** conversiones, aunque `order.coClientStock` sí venga poblado y el vínculo `in_order_sent`/`co_order` sí se escriba al guardar. **No usarlos como oráculo de «vengo de una sugerencia»**: el único campo fiable es `order.coClientStock` |
| 🔴 **El `coOrder` que muestra el formulario NO es siempre el que llega a la nube** | universal | Pedido 180: formulario `1789166261226.0`, nube `1789166261259.0` (33 ms de diferencia) — la app regenera el `co` al guardar cuando el pedido se armó desde cero. En los convertidos desde sugerencia **sí** coincide. **Correlacionar siempre por `id_order` (Nro. Ref.), nunca por el `co` leído en pantalla** |
| 🔴 **Un pedido con `co_operation` NULL desaparece también de la app** | universal (severidad) | 175 y 177 no están en `app-pedidos-lista` **ni en la tabla `orders` de la BD local del equipo**, mientras 174/176/178-181 sí. El filtro que oculta los nulos no vive sólo en la web |
| ⚠ **Input de cantidad del pedido: `pg.focus('#'+id)` + `keyboard.type`, y leer el valor 2 s después** | cliente/build | `document.elementFromPoint` sobre el centro del `input[placeholder="Ingrese Cantidad:"]` devuelve **`null`** (no otro elemento: `null`), así que `mouse.click` sobre sus coordenadas **no da foco** y lo tecleado cae en `BODY`. Y el `value` **tarda ~2 s** en reflejarse: leerlo antes devuelve `"0"` y se lee como «no aceptó el valor» cuando ya lo había aceptado. El `ion-input` es `clearOnEdit=true` |
| ⚠ **Hay un `input[placeholder="Ingrese Cantidad:"]` por producto de la categoría, todos en el DOM** | cliente/build | 8 en ENSALADAS; sólo el del producto expandido tiene `width > 0`. Filtrar por `getBoundingClientRect().width > 0` **y** verificar el `Código:` del contenedor antes de teclear |
| ⚠ **Una categoría puede estar vacía para un cliente concreto** | cliente | `HONGOS 1` con el cliente `403` abre en *«No hay productos disponibles»*: el contador del acordeón **no** refleja lo disponible para ese cliente. Volver con `app-pedido ion-button.back-button` (el de dentro del tab, distinto de `img.fechaAtras`) |
| ℹ **Toolbar del pedido: `ion-button.imagenGuardar` y `ion-button.imagenEnviar`** | universal | Sin texto — se identifican **sólo por la clase**. En un pedido recién convertido desde sugerencia, GUARDAR nace **deshabilitado** y ENVIAR **habilitado** (`changesMade = false`) |
| ℹ **Salir de un pedido convertido con la flecha NO pide confirmación** | universal | Con `changesMade = false` la app sale directo, sin el diálogo «Salir sin guardar». Un bucle que espere esa alerta se cuelga |
| ℹ **La lista de sugerencias no tiene borrado** | universal | `ion-item-sliding = 0`, `ion-item-option = 0`, sin botones de acción. Sí tiene buscador |
| ℹ **Guarda de GPS con caché caliente: `/inventarios` y `/pedido` abren en ~1 s** | cliente | Los 5 ingresos de esta vuelta llegaron en 1,0-1,1 s. El techo de 120 s del RUNTIME sigue haciendo falta **sólo en frío** |
| ℹ **`id_currency` / `co_currency` siguen llegando NULL en la cabecera de la sugerencia** | cliente/build | Reconfirmado en `1789160290226.0`. Reconfirma la Obs. 4.1 de la vuelta 2: no afecta ningún término ni el pedido generado, pero rompe la trazabilidad de la moneda |

---

## Verificación BD

| Registro | Marca | Fila en la nube | Estado local | ¿Lo guardado se envió? |
|---|---|---|---|---|
| Pedido **178** | ✅ **BD-OK** | `id_order 178` · `'I'` · `id_client_stock 276` · 4 líneas · 27,68 | `st_delivery = 1`, `id_order = 178`, fuera de cola | **Sí** — acuse del servidor *«Pedido nro. 178 enviado exitosamente»* |
| Pedido **179** | ✅ **BD-OK** | `id_order 179` · `'I'` · `id_client_stock 275` · 3 líneas · 7.184,80 | `st_delivery = 1` | **Sí** — acuse nro. 179 |
| Pedido **180** | ✅ **BD-OK** | `id_order 180` · `'I'` · sin inventario · 1 línea · 6,27 | `st_delivery = 1` | **Sí** — acuse nro. 180 |
| Pedido **181** (huérfano) | ⚠ **BD-INFO** | `id_order 181` · `'I'` · **`id_client_stock NULL`** con `co_client_stock` poblado · 1 línea · 245,70 | `st_delivery = 1` | **Sí** — acuse nro. 181. **Llegó, pero con la referencia colgada** |
| Sugerencia ref **6** | ✅ **BD-OK** | `in_order_sent 1` · `co_order 1789166201998.0` · `id_order 179` · `co_operation 'U'` | ídem | **Sí** — el vínculo viajó a la nube |
| Sugerencias `1789163276184.0` y `1789160290226.0` | ℹ **BD-SAVED (esperado)** | **no existen en la nube** | `in_order_sent 1` + `co_order`/`id_order` | **No, y es lo correcto**: convertir no sube la sugerencia. Anotado como dato para la web |
| Cola | ✅ | — | `pending_transactions = 0` · `failed_transactions = 0` toda la corrida | nada atascado |

Baseline-diff: `order` **177 → 181** (+4, sin duplicados) · `client_stock_suggested_orders` **7 → 7** ·
`client_stock_suggested_order_details` **25 → 25** · nulos de `co_operation` **3 → 3**.

---

## Para la vuelta 4 (web)

1. **El cotejo del ticket 2:** que los pedidos **178, 179, 180 y 181** aparezcan en
   *Transacciones → Pedidos*. El **178** es el caso clave — nació de una sugerencia que no está en la
   nube, que es el escenario exacto que antes producía el nulo.
2. **Que 166, 175 y 177 sigan sin aparecer** — y si es así, dejar escrito que el arreglo del listado
   (`IS DISTINCT FROM 'D'`) **no entró**, aunque el del dato sí.
3. **Sugerencias en la web** (*Transacciones → Pedido Sugerido*): **ref 6** debe verse ya consumida
   (`in_order_sent 1`, apuntando al pedido 179) y **ref 7** Pendiente con sus 2 líneas.
4. **El pedido 181**: mirar qué hace la web con un pedido cuyo `co_client_stock` no existe.
5. **Los pedidos 178 y 181** no tienen sugerencia consultable en la nube: ver si la web lo acusa de
   alguna forma o si simplemente no lo muestra.
