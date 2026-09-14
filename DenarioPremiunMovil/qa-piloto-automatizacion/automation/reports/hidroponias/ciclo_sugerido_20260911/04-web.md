# Vuelta 4 · WEB — cierre de las tres capas · HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `ciclo_sugerido_20260911` |
| Fecha de la corrida | 2026-09-11 |
| Playa (descubierta y verificada en runtime, por `host`) | **Isla Coche** — web `denarioislacoche.ddns.net:8080/DenarioPremium` (el backend móvil del ciclo es el `:8081` del mismo host ⇒ misma playa) |
| Empresa leída en la web | `HIDROPONIAS VENEZOLANAS C.A` — el `<select>` de empresa trae `HIDRO_A` en `/pages/pedidos` y `1` en `/pages/sugerenciasPedido` (ver §7) |
| Vendedor de la corrida | **ROGER MUESES** · `idUser 469` — existe como opción `469` del filtro de vendedor |
| Usuario web | bloque `# USUARIO WEB ISLA COCHE (HIDROPONIAS)` de `secrets/qa-credentials.env` |
| Herramienta | **Playwright local** (`automation/playwright/node_modules/playwright`), Chrome persistente con CDP en `:9334`. Los MCP `playwright` y `filesystem` no conectaron |
| Modo | **READ-ONLY**. No se creó, editó ni borró nada. Controles tocados: `Buscar`, `Consultar`, los campos del panel de filtros y los enlaces cruzados `Ref.: N` |
| Evidencia | `evidencia-web/*.png` (5 capturas) |
| Resultado | **31 casos: 25 PASS · 3 FAIL · 0 BLOCKED · 3 N-A** |

> ### Las cuatro respuestas que se pedían
>
> 1. **El cotejo término por término cuadró, tolerancia 0.** 8 productos × 9 términos + 2 cabeceras × 8 términos = **88 comparaciones web ↔ nube ↔ equipo, 0 divergencias.**
> 2. **El ticket 2 sigue abierto por su mitad del listado, y ahora está medido con precisión.** Los **4 pedidos nuevos (178, 179, 180, 181) aparecen** — incluido el 178, que es el caso crítico. Los **3 nulos históricos (166, 175, 177) siguen invisibles**: el listado devuelve **178 filas** sobre **181** de la base, y las 3 que faltan son **exactamente** esas. **La consulta del listado NO se tocó.**
> 3. **Confirmado lo que reportó QA:** los tres salen **por búsqueda directa de referencia** y no salen en el listado ⇒ **el arreglo pendiente es sólo de la consulta del listado**, no del dato ni de la pantalla de detalle.
> 4. **El pedido huérfano (181) no se rompe: se disfraza.** La web **no muestra referencia vacía ni rota — no muestra nada**: el bloque `Inventario relacionado` ni se renderiza, y el 181 queda pintado exactamente igual que un pedido normal. La trazabilidad se pierde en silencio.

---

## 1. Tabla de veredictos

### A · Ticket 2, la mitad del listado — lo más importante del encargo

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DW-PED-020 | **¿Aparecen 178, 179, 180 y 181 en Transacciones → Pedidos?** | ✅ **PASS** | **Los cuatro**, en las 4 primeras filas del listado por defecto (rango `01/09/2026`–`11/09/2026`), `Estatus Enviado`, vendedor `ROGER MUESES`. 🔑 **El 178 es el caso clave**: nació de una sugerencia que **no está en la nube**, el escenario exacto que antes producía el nulo, y **se lista con normalidad** |
| **DW-PED-021** | **¿166, 175 y 177 siguen invisibles?** | ❌ **FAIL** | **Sí, siguen invisibles.** Con rango amplio (`01/01/2020`–`31/12/2027`), sin filtro de vendedor, cliente, moneda ni estatus, y con la paginación fijada a 200 (**sin paginador**, todo en una página): el listado trae **178 filas**, refs **1 … 181** salvo **166, 175, 177**. Ver **Defecto W1** |
| **DW-PED-022** | **Conteo web vs. base** | ❌ **FAIL** (misma causa) | Web **178** · base **181** (`SELECT count(*) FROM "order"`) ⇒ **diferencia exactamente 3**, y las 3 son las que tienen `co_operation IS NULL`. **El conteo y la identidad coinciden: no es muestreo ni casualidad de rango** |
| **DW-PED-023** | **¿Salen si se buscan por su referencia?** | ✅ **PASS** *(confirma el reporte de QA)* | **Los tres salen.** Con el **mismo** rango amplio y los **mismos** filtros, poniendo `# Ref`: `175` → 1 fila (1.223,60 USD), `177` → 1 fila (30,60 USD), `166` → 1 fila (8.118,50 USD). ⇒ **La ruta de búsqueda por referencia y la del listado no comparten la condición.** El arreglo pendiente es **sólo** de la consulta del listado |
| DW-PED-024 | ¿El detalle de un pedido nulo se abre bien? | ✅ PASS | Alcanzados por `# Ref`, los 3 abren `/pages/detallePedido` con su cabecera, líneas y montos completos. **El dato está sano; lo que está roto es cómo se lo busca** |

### B · Bloque F del guión — el sugerido en la web

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DW-SUG-100 | Guarda de playa + empresa + vendedor antes de leer nada | ✅ PASS | `host = denarioislacoche.ddns.net:8080` · empresa `HIDROPONIAS VENEZOLANAS C.A` · el vendedor de la corrida existe como opción `469 · ROGER MUESES`. Coincide con el encargo ⇒ se sigue |
| **DM-SUG-072** | **Transacciones → «Sugerencias de Pedido»: aparecen ref 6 y ref 7** | ✅ **PASS** | Las dos, con **cliente, fecha, nº de líneas y estado**. Ref **7**: `11/09/2026 17:52:59` · `INSIDE MARKET, SUPERMERCADO RIO, C.A` · `Lineas 2` · `Pedido —` · `Pedido enviado **No**`. Ref **6**: `11/09/2026 17:38:25` · `HIPERMERCADO PARAMO, C.A` · `Lineas 6` · `Pedido **179**` · `Pedido enviado **Si**`. **La 6 consumida, la 7 Pendiente — exactamente como se esperaba** |
| DM-SUG-072b | El listado trae **sólo** las 7 de la nube | ✅ PASS | 7 filas = las 7 filas de `client_stock_suggested_orders`. Refs 1-3 son de `KEVIN WILCHES` (`id_user 468`) y 4-7 de ROGER MUESES |
| **DM-SUG-073** | **Cotejo término por término · móvil ↔ nube ↔ web** | ✅ **PASS** | **88 comparaciones, 0 divergencias, tolerancia 0.** Ver §3 |
| DM-SUG-073b | ¿La web muestra **menos** términos de los que guarda? | ✅ PASS (informativo) | **No: muestra más.** Los 9 términos completos en `form:compareDT`, más `Qty pedido` y `Diferencia` (derivados del pedido, que el equipo no tiene), más el `Algoritmo`, el `Lineas` y los enlaces al inventario y al pedido |
| **DM-SUG-074** | **Las líneas del 179 = los sugeridos > 0 de la ref 6, ceros excluidos** | ✅ **PASS** | En `form:compareDT` de la ref 6, las **3** filas con `Qty sugerida > 0` traen `Qty pedido` **igual** y `Diferencia 0`: `HIDPROBER001BOL` 150 · `TOMPROMAN001GRA` 2.560 · `TOMPROCHE001CAJ` 120. Las **3** filas en 0 traen `Qty pedido 0`. El detalle del **179** tiene **exactamente esas 3 líneas**, 342,00 + 442,80 + 6.400,00 = **7.184,80 USD** ✓ |
| DM-SUG-074c | Los ceros **sí se listan** en la vista de la sugerencia | ✅ PASS | Las 3 filas de sugerido 0 de la ref 6 (`046013ESP001BOL`, `GERPROALF002CAJ`, `CAMPROCEB002ATA`) aparecen con sus 9 términos completos. Consistente con el equipo: se guardan y se muestran en la sugerencia, se excluyen del pedido |
| DW-SUG-101 | Una sugerencia Pendiente rotula su falta de pedido con texto propio | ✅ PASS | Ref 7: cabecera `Pedido: **Sin pedido enviado**` (no un `Ref.:` vacío, no un guion). En el **listado** la misma condición sale como `Pedido —` / `Pedido enviado No`. **Dos rótulos distintos para el mismo estado**, ambos correctos |
| **DW-SUG-102** | **Las 2 sugerencias que nunca subieron NO aparecen** | ✅ **PASS** *(confirmado y anotado)* | `1789163276184.0` (cliente `104`, origen del pedido **178**) y `1789163741436.0` (cliente `1702`, la del **NO** de DM-SUG-053) **no tienen fila** en `/pages/sugerenciasPedido`, ni la huérfana `1789160290226.0`. **Es lo correcto** — la web sólo puede mostrar lo que está en la nube. **Queda para el REQ** decidir si por trazabilidad deberían subir. Ver **Observación W3** |
| DW-SUG-103 | El pedido **178** sí aparece, sin sugerencia consultable | ✅ PASS | El 178 está en el listado y su detalle abre completo. **Matiz importante: `detallePedido` no enlaza a la sugerencia en NINGÚN pedido** — tampoco en el 179, que sí la tiene. Ver **Observación W4** |
| ❌ DW-WEB-001 | Formato numérico de `detalleSugerenciaPedido` | ❌ **FAIL** (S3) · **reproduce** | **El defecto W2 de la vuelta anterior sigue vivo, con el contraste más limpio posible: el mismo número, 2560, sale `2,560` en `/pages/detalleSugerenciaPedido` y `2.560` en `/pages/detallePedido`.** Ver **Defecto W2** |

### C · El resto del ciclo en la web

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DW-DEV-010 | Las **3 devoluciones** en `/pages/devoluciones` | ✅ PASS | **279, 280, 281**, las tres `Enviado`, cliente `HIPERMERCADO PARAMO, C.A - PIEDRA AZUL`, vendedor `ROGER MUESES`, con la hora local UTC−4 correcta (16:34:57 / 16:49:57 / 16:56:00) |
| DW-DEV-011 | **279** = Distribución · `046013ESP001BOL` ×6 · `GERPROALF002CAJ` ×7 | ✅ PASS | `Tipo de devolución: **Distribución**` · responsable `QA V1 11/09` · precinto `P0911D1` · `GERPROALF002CAJ` **7** · `046013ESP001BOL` **6** · factura `20118282` · motivo `AA-AGUADO` |
| DW-DEV-012 | **280** = Calidad · `HIDPROBER001BOL` ×5 · `046013ESP001BOL` ×4 | ✅ PASS | `Tipo de devolución: **Calidad**` · precinto `P0911D2` · `046013ESP001BOL` **4** · `HIDPROBER001BOL` **5** |
| DW-DEV-013 | **281** = Distribución · `GERPROALF002CAJ` ×2 | ✅ PASS | `Tipo de devolución: **Distribución**` · precinto `P0911D4` · `GERPROALF002CAJ` **2** |
| DW-DEV-014 | La devolución **Guardada** (el centinela) no aparece | ✅ PASS (esperado) | `co_return 1789159255271.0`, `id_return = 0`: no subió, y el listado no la inventa. Refs consecutivas 277-281 sin huecos |
| DW-INV-010 | Los **5 inventarios** en `/pages/inventarios` | ✅ PASS | **275, 276, 277, 278, 279**, los cinco `Enviado`, vendedor `ROGER MUESES`, clientes `100113` / `104` / `100121` / `1702` / `203` ✓ |
| DW-INV-011 | Inventario **275**: 6 líneas | ✅ PASS | `046013ESP001BOL` 10,00 · `GERPROALF002CAJ` 40,00 · `HIDPROBER001BOL` **0.00** · `TOMPROMAN001GRA` 5,00 · `TOMPROCHE001CAJ` 3,00 · `CAMPROCEB002ATA` **0.00** — **las dos líneas en cero se muestran**, no se ocultan |
| DW-INV-012 | Inventarios **276 / 277 / 278 / 279** | ✅ PASS | 276: 5 líneas (MAIZ 0 · BERRO 4 · ALBAHACA 0 · ENSALADA 0 · GRANO CHINO 3) · 277: 2 (BERRO 1 · ALFALFA 2) · 278: 2 (CHERRY 1 · ARANDANOS 2) · 279: 1 (BERRO 1). **Uno a uno con `client_stock_detail_unit.qu_stock`** |
| DW-INV-013 | Enlace cruzado inventario → pedido | ✅ PASS | **275 → `Ref.: 179`** y **276 → `Ref.: 178`**. En **277, 278 y 279** la etiqueta `Ver Pedido Relacionado` se renderiza **sin botón** — correcto: sus sugerencias no se convirtieron. Cotejado contra `client_stock.id_order` (179 · 178 · NULL · NULL · NULL) ✓ |
| **DW-INV-014** | 🔑 **El inventario 276 enlaza al 178 aunque su sugerencia nunca subió** | ✅ **PASS** (hallazgo) | La cadena **inventario ↔ pedido** sobrevive intacta cuando la sugerencia se queda en local: el servidor resolvió `id_client_stock = 276` desde el `co_client_stock`. **Lo único que se pierde es el eslabón de la sugerencia** |
| **DW-PED-025** | **Cómo presenta la web el pedido 181 (sugerencia huérfana)** | ⚠️ **Observación W5 — no FAIL** | **Se lista con normalidad** (245,70 USD, 1 ítem, `Enviado`) y su detalle abre completo con la línea `GERPROALF002CAJ` ×126. **Pero la etiqueta `Inventario relacionado` ni se renderiza y no hay botón `Ref.:` alguno**: ni vacío, ni roto, ni con error. La web lee `id_client_stock` (que es `NULL`) y no el `co_client_stock` colgado (`1789160266062.0`). **Queda indistinguible de un pedido normal.** Contraste medido en la misma corrida: 179 → `Ref.: 275`, 178 → `Ref.: 276`, 180 (normal) → nada, **181 → nada** |
| DW-PED-026 | Montos y conversión de los 4 pedidos nuevos | ✅ PASS | `Monto Total` de la web = suma de `order_detail.nu_amount_total` en los 4: **27,68** · **7.184,80** · **6,27** · **245,70** USD. Conversión exacta a tasa `814,69 BS = 1 USD`: 22.550,62 · 5.853.384,71 · 5.108,11 · 200.169,33 BS |
| DW-PED-027 | Cotejo fuerte del monto (mezcla de monedas) | 🚫 **N-A — sin dato** | Los 4 pedidos van **enteros en USD**, con IVA 0 y sin descuentos ⇒ `nu_amount_total == nu_amount_final` en los 4 y **cotejar contra el campo equivocado también habría dado PASS**. Misma limitación declarada en la vuelta anterior; **no se puede fabricar desde la web**, que es de sólo lectura |
| DW-PED-028 | Casos de escritura del bloque F (DM-SUG-075/076/077) | 🚫 **N-A por diseño de la vuelta** | Exigen operar el dispositivo. Medidos en la vuelta 2 |
| DW-SUG-104 | DM-SUG-011 (la suma del despacho) | 🚫 **N-A en esta capa** | Sigue **BLOCKED** desde la vuelta 1 por falta de dato (dos facturas del mismo producto el mismo día). **No se destraba desde la web** |

---

## 2. Registros verificados en la web

| Tipo | Refs cotejadas | Vistos en la web | Detalle abierto |
|---|---|---|---|
| Devoluciones | 279 · 280 · 281 | **3 / 3** | **3 / 3**, con tipo y cantidades |
| Inventarios | 275 · 276 · 277 · 278 · 279 | **5 / 5** | **5 / 5**, con todas sus líneas |
| Sugerencias en la nube | 6 · 7 | **2 / 2** | **2 / 2**, con los 9 términos |
| Pedidos nuevos | 178 · 179 · 180 · 181 | **4 / 4** | **4 / 4** |
| Pedidos con `co_operation` nulo | 166 · 175 · 177 | **0 / 3 en el listado** · **3 / 3 por `# Ref`** | **3 / 3** |
| Sugerencias sólo locales | `…3276184.0` · `…3741436.0` · `…0290226.0` | **0 / 3** (correcto) | — |
| Devolución Guardada (centinela) | `…9255271.0` | **0 / 1** (correcto) | — |

---

## 3. Cotejo término por término · **móvil ↔ nube ↔ web**

Oráculo: §A de `02-inventario-y-sugerido.md` (equipo) y `client_stock_suggested_order_details` (nube).
**Tolerancia 0.** Mapa columna de la web → campo persistido (confirmado otra vez en esta corrida):

| Columna de `form:compareDT` | Campo |
|---|---|
| `Qty sugerida` | `qu_unit_suggested` |
| `Inv. anterior` | `previous_stock` |
| `Despacho` | `dispatched_stock` |
| `Cambio x cambio` | `straight_swap_stock` |
| `Dev. distribucion` | `returned_stock` |
| `Inv. inicial` | `initial_stock` |
| `Inv. actual` | `current_stock` |
| `Venta` | `sold_units` |
| `Ventas diarias est.` | `estimated_daily_units` |
| `Qty pedido` / `Diferencia` | *(sólo web — derivados del pedido)* |

### Sugerencia **ref 6** · inventario 275 · cliente `100113` · `días desde 1 / hasta 10` ✅

| Producto | prev | desp | swap | dev | ini | act | vend | diaria | **sugerido** | web = nube = equipo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| `046013ESP001BOL` | 0 | 15 | 0 | **6** 🔑 | 15 | 10 | **−1** | 0 | **0** | ✅ 9/9 |
| `GERPROALF002CAJ` | 0 | 30 | 0 | **9** | 30 | 40 | **−19** | 0 | **0** | ✅ 9/9 |
| `HIDPROBER001BOL` | 0 | 15 | 0 | 0 | 15 | 0 | 15 | 15 | **150** | ✅ 9/9 |
| `TOMPROMAN001GRA` | 0 | **261** | 0 | 0 | 261 | 5 | 256 | 256 | **2.560** | ✅ 9/9 |
| `TOMPROCHE001CAJ` | 0 | 15 | 0 | 0 | 15 | 3 | 12 | 12 | **120** | ✅ 9/9 |
| `CAMPROCEB002ATA` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** | ✅ 9/9 |

🔑 **El centinela del fix se ve en la web.** `046013ESP001BOL` llega con `Dev. distribucion **6.0**` — el valor correcto. Los tres desenlaces incorrectos (3, 10, 7) eran distinguibles y **ninguno se pintó**. La web **confirma en la tercera capa** que sólo entró la devolución de Distribución enviada (ref 279 ×6), y no la de Calidad (280 ×4) ni la Guardada (×−3).

🔑 **Las dos ventas negativas se muestran tal cual:** `Venta **-1.0**` y `Venta **-19.0**`. El equipo las clampa a 0 al pintarlas (Observación 2 de la vuelta 2) ⇒ **la web sigue siendo más fiel al dato que la propia app**, y es el único lugar donde el vendedor puede ver por qué ese sugerido dio 0.

### Sugerencia **ref 7** · inventario 277 · cliente `100121` · `días desde 2 / hasta 10` ✅

| Producto | prev | desp | swap | dev | ini | act | vend | diaria | **sugerido** | web = nube = equipo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| `HIDPROBER001BOL` | **7** | 25 | 0 | 0 | 32 | 1 | 31 | **15,5** | **155** | ✅ 9/9 |
| `GERPROALF002CAJ` | 0 | 30 | 0 | 0 | 30 | 2 | 28 | 14 | **140** | ✅ 9/9 |

La aritmética se cierra en pantalla: `7 + 25 = 32` · `32 − 1 = 31` · `31 / 2 = 15,5` · `15,5 × 10 = 155`.
**`previous_stock = 7` no nulo** confirma por contraste que el inventario anterior de este cliente sí tiene PK del servidor.

### Cabeceras

| Campo | ref 6 · equipo/nube | ref 6 · web | ref 7 · equipo/nube | ref 7 · web |
|---|---|---|---|---|
| `co_..._suggested_order` | `1789162387211.0` | **idéntico** ✅ | `1789163579449.0` | **idéntico** ✅ |
| `days_since_last` | 1 | **1** ✅ | 2 | **2** ✅ |
| `days_until_next` | 10 | **10** ✅ | 10 | **10** ✅ |
| `by_dispatch_and_return` | 1 | `Algoritmo: Despacho y devolucion` ✅ | 1 | ídem ✅ |
| `nu_details` | 6 | `Lineas: 6` ✅ | 2 | `Lineas: 2` ✅ |
| `da_suggested` | `2026-09-11T21:38:25Z` | `11/09/2026 17:38:25` ✅ (UTC−4) | `21:52:59Z` | `11/09/2026 17:52:59` ✅ |
| `id_client_stock` | 275 | `Inventario: Ref.: 275` ✅ | 277 | `Inventario: Ref.: 277` ✅ |
| `id_order` | 179 | `Pedido: Ref.: 179` ✅ | `NULL` | `Pedido: Sin pedido enviado` ✅ |

**Total: 8 productos × 9 términos + 2 cabeceras × 8 términos = 88 comparaciones · 0 divergencias.**

---

## 4. El veredicto del listado de pedidos, con el conteo

**La medición, en tres pasos que se pueden repetir a mano:**

1. `/pages/pedidos`, rango **`01/01/2020`–`31/12/2027`**, sin vendedor, sin cliente, sin moneda, sin estatus, `# Ref` vacío, paginación en 200 (**el paginador no aparece: todo cabe en una página**) → **Buscar**.
   **Resultado: 178 filas.** Refs `1 … 181` **menos** `166`, `175`, `177`.
2. En la base: `SELECT count(*) FROM "order"` → **181**. Y
   `SELECT count(*) FILTER (WHERE co_operation IS NULL) FROM "order"` → **3**, que son `166`, `175`, `177`.
3. **`181 − 178 = 3`**, y el conjunto que falta **es el mismo conjunto** de los nulos. No es coincidencia de rango ni de paginación.

**Contraprueba (el punto 4 del encargo):** con **los mismos filtros y el mismo rango**, escribiendo la referencia en `# Ref`:

| `# Ref` | Filas | Lo que devuelve |
|---|---|---|
| `175` | **1** | 175 · 09/09/2026 17:47:35 · PARAMO · 3 ítems · **1.223,60 USD** |
| `177` | **1** | 177 · 10/09/2026 09:04:02 · PARAMO · 1 ítem · **30,60 USD** |
| `166` | **1** | 166 · 08/09/2026 13:02:05 · PARAMO · 6 ítems · **8.118,50 USD** |

⇒ **La búsqueda por referencia y el listado no aplican la misma condición.** El dato está sano, el detalle abre bien, la búsqueda los encuentra — **lo único roto es la consulta del listado**.

**Del lado del dato, en cambio, el ticket 2 está corregido y esta capa lo confirma:** el pedido **178**, que cumple exactamente las dos condiciones que antes producían el nulo (nacer de un inventario **y** que la sugerencia no esté en la nube), **sale en el listado sin ayuda de ningún filtro**.

> ⚠ **Alcance honesto de lo que se probó.** Se midió el **síntoma** (qué filas devuelve el listado y qué filas devuelve la búsqueda por referencia), **no la consulta SQL**. Que la causa sea `co_operation <> 'D'` descartando los nulos en silencio es la explicación que ya traía el ciclo anterior y que el conteo de esta vuelta es **consistente** con ella — pero el `<> 'D'` **no se leyó en el código en esta corrida**. Para el arreglo: `IS DISTINCT FROM 'D'`.

---

## 5. Defectos

### 🔴 Defecto W1 — S1 · **La mitad del listado del ticket 2 no entró: 3 pedidos vivos siguen sin aparecer en `/pages/pedidos`**

| | |
|---|---|
| **Severidad** | **S1** — pedidos enviados, con monto, invisibles para quien opera la web |
| **Estado** | **Abierto.** Reportado en la vuelta 4 del ciclo anterior (Defecto W1 del 09/09) · **reproduce el 11/09 sin cambios** |
| **Pantalla** | `Transacciones → Pedidos` (`/pages/pedidos`), tabla `form:pedidosDT` |

**Reproducción mínima (2 pasos, sin BD):**

1. `/pages/pedidos` → rango `01/09/2026`–`11/09/2026` → **Buscar**.
   Las primeras filas salen **181, 180, 179, 178, 176, 174 …** — **no hay 177**.
2. Sin tocar nada más, escribir `177` en `# Ref` → **Buscar**.
   Sale **1 fila: el 177, `Enviado`, 30,60 USD**.

**Evidencia en pantalla:** `evidencia-web/05-listado-pedidos-hueco-177.png` (la secuencia `178 → 176`).

**Evidencia en la base:**

```sql
SELECT count(*) FILTER (WHERE co_operation IS NULL) AS nulos, count(*) AS total FROM "order";
-- nulos = 3 · total = 181
SELECT id_order, co_operation, nu_amount_total, da_order
  FROM "order" WHERE co_operation IS NULL ORDER BY id_order;
-- 166 | NULL | 8118.50 | 2026-09-08
-- 175 | NULL | 1223.60 | 2026-09-09
-- 177 | NULL |   30.60 | 2026-09-10
```

**Impacto:** 3 pedidos por **9.372,70 USD** en total, enviados y vivos, que **sólo se alcanzan si alguien ya sabe su número de referencia**. Como el dato ya no se produce (ticket 2, primera mitad, corregido), el conjunto está **cerrado en 3** y no crece — pero **no se recupera solo**: mientras el listado siga como está, esos 3 quedan perdidos para cualquiera que no tenga la referencia a mano.

**Refuerzo de severidad medido en la vuelta 3:** los nulos **tampoco están en la BD local del equipo** ni en el BUSCAR de la app ⇒ el filtro que los descarta **no es exclusivo de esta pantalla**.

**Arreglo:** cambiar `co_operation <> 'D'` por `co_operation IS DISTINCT FROM 'D'` en la consulta del listado (y revisar qué otras pantallas comparten esa condición).

---

### 🔴 Defecto W2 — S3 · **`detalleSugerenciaPedido` imprime los números en formato inglés** — *reproduce*

| | |
|---|---|
| **Severidad** | **S3** — cosmético, pero induce a error de lectura en cantidades grandes |
| **Estado** | **Abierto.** Reportado el 09/09 (Defecto W2) · **reproduce el 11/09 sin cambios** |

**El contraste más limpio posible — el mismo número, en la misma corrida, en dos pantallas:**

| Valor | `/pages/detalleSugerenciaPedido` (sugerencia 6) | `/pages/detallePedido` (pedido 179) |
|---|---|---|
| 2560 | `Qty sugerida` **`2,560`** | `Unidades pedidas` **`2.560 UNIDAD`** |

Y los términos enteros salen con punto decimal: `Inv. inicial **15.0**`, `Despacho **261.0**`, `Venta **-19.0**`, `Ventas diarias est. **15.5**`.
En es-VE, **`2,560` se lee «dos coma cincuenta y seis»**. En una columna de cantidades sugeridas, eso es un error de lectura al alcance de la mano.

> ⚠ **Matiz honesto que acota el defecto.** El rótulo original decía «contra el es-VE **del resto de la web**», y eso es **demasiado amplio**: `/pages/detalleInventario` también pinta las cantidades en inglés (`10.00 UNIDAD`, `0.00 UNIDAD`). Lo que sí es exacto, y basta para el defecto, es que **las columnas monetarias de toda la web usan es-VE** (`245,70 USD`, `200.169,33 BS`) y **`detallePedido` pinta la misma cantidad 2560 como `2.560` mientras `detalleSugerenciaPedido` la pinta `2,560`**. **Dos pantallas del mismo flujo, formatos opuestos para el mismo número.**

---

### ⚠️ Observación W5 — S3/S4 · **El pedido de la sugerencia huérfana: la web no se rompe, lo disfraza de pedido normal**

**Qué se midió.** El pedido **181** nació de una sugerencia huérfana: en la nube quedó con `co_operation = 'I'` ✓, `co_client_stock = 1789160266062.0` (**un inventario que no existe**) y `id_client_stock = **NULL**` (el servidor no pudo resolverlo).

**Qué hace la web con eso:**

| | Pedido **179** (sugerencia sana) | Pedido **178** (sugerencia sólo local) | Pedido **180** (normal) | Pedido **181** (**huérfano**) |
|---|---|---|---|---|
| Aparece en el listado | ✅ | ✅ | ✅ | ✅ |
| Etiqueta `Inventario relacionado` | ✅ se renderiza | ✅ se renderiza | ❌ no se renderiza | ❌ **no se renderiza** |
| Botón `Ref.: N` | `Ref.: 275` | `Ref.: 276` | — | **— (ninguno)** |
| Líneas y montos | 3 · 7.184,80 | 4 · 27,68 | 1 · 6,27 | 1 · **245,70** ✓ |

**⇒ La web NO muestra una referencia de inventario vacía, ni rota, ni un error: no muestra nada.** El bloque entero desaparece. La pantalla se apoya en `id_client_stock` (que es `NULL`) y **nunca mira el `co_client_stock` colgado**, así que el 181 queda **visualmente idéntico a un pedido armado desde cero** (el 180).

**Evidencia:** `evidencia-web/03-detalle-pedido-181-huerfano.png` — la cabecera va de `Sucursal: PIEDRA AZUL` directo a los botones de adjuntos, sin bloque de inventario. Contraste: `evidencia-web/04-detalle-pedido-179-contraste.png`.

**Lectura para el REQ.** Es **defendible como comportamiento** (no se pinta basura) y por eso se anota como **observación y no como FAIL**: el fallo de fondo es que el móvil aceptó convertir una sugerencia huérfana (hallazgo C de la vuelta 2, caracterizado en la vuelta 3), no que la web lo pinte mal. **Pero conviene decidirlo explícitamente**: hoy, un pedido de 245,70 USD que vino de un sugerido es indistinguible de uno tecleado a mano, y **nadie desde la web puede saber que existió un problema**.

---

## 6. Observaciones (no se reportan como defecto)

**W3 · Las sugerencias que no suben dejan un pedido sin origen consultable.**
Los pedidos **178** y **181** existen en la nube apuntando a sugerencias que **no tienen fila allí**. La web hace lo único que puede: no las inventa. **Confirmado y anotado, como pedía el encargo** — queda para el REQ decidir si por trazabilidad la conversión debería **arrastrar la sugerencia a la nube**. El argumento a favor lo da esta misma corrida: para el **178** la cadena *inventario → pedido* **sí** sobrevive (`276 → Ref.: 178`), de modo que **el único eslabón que se pierde es justo el que explica de dónde salieron las cantidades**.

**W4 · Desde un pedido nunca se puede llegar a su sugerencia — ni siquiera cuando la tiene.**
`detallePedido` enlaza **sólo al inventario**. El **179**, que tiene la sugerencia ref 6 perfectamente sana en la nube, tampoco muestra un `Sugerencia relacionada`. La navegación es **unidireccional**: `sugerencia → {inventario, pedido}` e `inventario → pedido`, nunca al revés. ⇒ **La ausencia de enlace en el detalle de un pedido NO sirve como oráculo de «este pedido no vino de una sugerencia»**; para eso hay que ir a `/pages/sugerenciasPedido` y mirar la columna `Pedido`.

**W5b · «Pendiente» se rotula distinto en el listado y en el detalle.**
Ref 7: en el listado `Pedido —` + `Pedido enviado No`; en el detalle `Pedido: Sin pedido enviado`. Los dos son correctos y legibles; se anota sólo porque un guión que busque un texto exacto fallará en una de las dos pantallas.

**W6 · `Depósito: -` en los 5 inventarios.**
Con un solo punto de captura por producto es lo normal, no un dato perdido (ya anotado en la vuelta anterior). Las cantidades van todas en `Exhibición`.

**W7 · La precisión de 15 dígitos de `estimated_daily_units` no se manifestó esta vuelta.**
Las diarias de las refs 6 y 7 son exactas (0, 15, 256, 12, **15.5**, 14) porque `days_since_last` es 1 y 2. El problema de presentación levantado el 09/09 (`0.380952380952381` en pantalla) **sigue sin arreglar ni empeorar** — simplemente **no hubo dato que lo disparara**. No se puede dar por cerrado.

---

## 7. Patrones y selectores nuevos de la web

| Patrón / selector | Alcance | Detalle |
|---|---|---|
| 🔴 **`qa-web-open.js` entra con las credenciales de LA TORTUGA, no las del cliente** | universal (harness) — **nuevo, y costó dos intentos** | Su `creds()` toma el **primer** bloque `# USUARIO WEB` de `secrets/qa-credentials.env`, y ese bloque es **`# USUARIO WEB LA TORTUGA`** (`admin` / 6 caracteres). El de Isla Coche es el **segundo**. El síntoma **no es un error**: la página de login se recarga en silencio y **Chrome autorrellena `admin`/`123456`** encima, así que parece que el script «no hizo submit». **Receta:** anclar el bloque por el **nombre de la playa** (`startsWith('# USUARIO WEB ISLA COCHE')`) y **verificar `password.length`** antes de hacer clic — nunca el valor, sólo el largo. Vale la pena arreglar `qa-web-open.js` para que reciba la playa por parámetro |
| 🔴 **El `BASE` de `qa-web-open.js` está clavado en `denariocaribe`** | universal (harness) | `const BASE = 'http://denariocaribe.ddns.net:8080/DenarioPremium'`. Para Isla Coche hay que sobreescribirlo. Se confirma la regla de memoria: **la playa se descubre en runtime y no se guarda en el YAML**; se anota sólo en el reporte |
| 🔴 **La pantalla de login usa ids autogenerados `j_idt12` / `j_idt14` / `j_idt16`** | universal | usuario / contraseña / `Ingresar`. **No hay `name` ni `placeholder` estables.** El selector genérico `input[type="text"]:not([style*="display: none"])` funciona, pero conviene verificar el id antes |
| 🔴 **Los filtros del panel son ESTADO DE SESIÓN y sobreviven a un `goto` completo — MEDIDO otra vez** | universal (harness) | Se dejó `# Ref = 181` y el rango `01/01/2024`–`31/12/2026` en `/pages/pedidos`, se navegó a la URL **desde cero** y al volver **los tres seguían puestos**, con el listado ya reducido a **1 fila**. **Regla: antes de cada medición, fijar explícitamente TODOS los campos que importan — incluido vaciar `# Ref` — y releer sus `value` después del `Buscar`** |
| 🔴 **Para contar el universo de una pantalla hay que ampliar el rango a mano** | universal | `/pages/pedidos` y `/pages/sugerenciasPedido` arrancan acotados al **mes en curso**. Un conteo tomado con el rango por defecto **no es el universo**. Con `01/01/2020`–`31/12/2027` y 200 filas por página, los 178 pedidos entran sin paginador ⇒ `tbody tr` es el conteo real |
| 🔴 **Los `<select>` de este build usan códigos distintos por pantalla para la MISMA empresa** | universal (trampa de oráculo) | `form:j_idt116:idEnterprise_input` vale **`HIDRO_A`** en `/pages/pedidos` / `/pages/inventarios` / `/pages/devoluciones` y **`1`** en `/pages/sugerenciasPedido`. Uno es el `co_enterprise` y el otro el `id_enterprise`. **Nunca comparar el `value` del combo entre pantallas: comparar la etiqueta visible** (`HIDROPONIAS VENEZOLANAS C.A`) |
| 🔴 **`form:pedidosDT` es el id de CUATRO listados distintos y de sus detalles** | universal (refuerza WEB-RUNTIME §3.b) | `/pages/pedidos`, `/pages/inventarios`, `/pages/devoluciones` y los detalles `/pages/detallePedido` y `/pages/detalleInventario`. **En `/pages/detalleDevolucion` cambia a `form:j_idt170`** (autogenerado) y en `/pages/detalleSugerenciaPedido` a **`form:compareDT`**. ⇒ **anclar por columnas**, nunca por id: `['Cod. producto','Motivo','Cantidad']` para devolución, `['Qty sugerida','Ventas diarias est.']` para sugerencia, `['Depósito','Exhibición']` para inventario |
| 🔴 **`thead th` devuelve las columnas DUPLICADAS** | universal (harness) | PrimeFaces renderiza una cabecera «reflow» oculta para móvil, así que `querySelectorAll('thead th')` trae **13 + 13 = 26** nombres en `form:compareDT`. **Cortar por la mitad o deduplicar antes de mapear columna → índice**, o el mapa se desalinea |
| 🔴 **Cada `<td>` incluye el texto de su cabecera al leer `textContent`** | universal (harness) | La celda del ref sale como `"# Ref181"`, no `"181"`. Es el `<span class="ui-column-title">` del reflow. **Receta: `td.textContent.replace(<nombre de la columna>, '')`**, o leer `td.querySelector('.ui-cell-data')` |
| 🔴 **Lector de cabecera de detalle: `span.font-bold` → `parentElement.nextElementSibling`** | universal (harness) | Funciona en `detallePedido`, `detalleInventario`, `detalleDevolucion` y `detalleSugerenciaPedido` — las cuatro. **Pero en el panel de TOTALES de `detallePedido` el heurístico se desplaza una posición** (la clave `N` recoge el texto de la etiqueta `N+1`): ahí los valores hay que leerlos del texto completo (`Monto Total Pedido: 245,70  USD`). **Usar el lector para la cabecera, no para los totales** |
| 🔴 **Un caso límite del mismo lector: cuando NO hay valor, hereda la etiqueta siguiente** | universal (trampa de oráculo) | En el inventario **277** (sin pedido asociado) la cabecera sale como `"Ver Pedido Relacionado": "Comentario:"` — porque el hermano siguiente es la etiqueta de al lado. **Leer «hay etiqueta» NO es leer «hay valor».** El oráculo fiable es la **lista de botones cuyo texto empieza por `Ref.:`**: `[]` = no hay enlace, `['Ref.: 179']` = lo hay |
| ✅ **La ausencia del bloque `Inventario relacionado` es el oráculo de «pedido sin inventario resuelto»** | universal | Y **no** de «pedido sin sugerencia» — ver Observación W4. Medido en los 4 pedidos de esta vuelta: 179 → `Ref.: 275`, 178 → `Ref.: 276`, 180 → nada, 181 → nada |
| ✅ **`Buscar` = exactamente 1 ajax; hook con `XMLHttpRequest.prototype.open` + `loadend`** | universal (harness) | `jQuery(document).ajaxComplete` **no dispara** en estas páginas. Envolver `open` e incrementar un contador en `loadend` da la señal exacta; esperar `n > n0` y luego ~1,2 s de asentado. Se verificó en los ~15 `Buscar` de esta corrida |
| ✅ **`PrimeFaces.widgets[...]` para combos; `value` + `change` basta para los `inputText` y para los `p:calendar`** | universal (harness) | Los `_input` de fecha (`dateB_input` / `dateF_input`) **aceptan el valor puesto a mano y lo postean**: se verificó releyendo el `value` después del `Buscar` (`01/01/2020` / `31/12/2027` intactos y el listado ampliado). No hizo falta abrir el datepicker |
| ⚠ **En Git Bash, un argumento que empieza por `/` se convierte en ruta de Windows** | universal (harness) | `node drv.js mod.js /pages/inventarios` llegó al script como `C:/Program Files/Git/pages/inventarios` y la navegación fue a una URL inventada **sin error visible** (tabla vacía, que se lee como «la pantalla no cargó»). **Pasar el argumento sin la barra inicial y componer la ruta dentro del script**, o `MSYS_NO_PATHCONV=1` |
| ℹ **Sugerencias: `form:sugerenciasDT` con `Detalle · # Ref · Fecha · Vendedor · Cliente · Lineas · Pedido · Pedido enviado`** | universal | `Pedido` trae `—` y `Pedido enviado` trae `No` cuando está Pendiente; el nº del pedido y `Si` cuando se consumió. **La web sí muestra la cantidad de líneas**, que es la carencia levantada en DM-SUG-041 del equipo |
| ℹ **Todo se rotula en hora local UTC−4** | universal | `da_suggested 2026-09-11T21:38:25Z` → `11/09/2026 17:38:25`. Cotejar por instante aplicando −4 h, no por igualdad de cadena |
| ℹ **`/pages/detalleDevolucion` no muestra el tipo en el listado, sólo en el detalle** | universal | El listado es `Detalle · # Ref · Estatus · Fecha Devoluciòn · Vendedor · Cliente`. Para separar Calidad de Distribución **hay que abrir cada fila**. Limitación del oráculo, no defecto |

---

## 8. Lo que NO se pudo comprobar

| Caso | Motivo |
|---|---|
| **Que la consulta del listado sea literalmente `co_operation <> 'D'`** | ⚠ **No comprobado.** Se midió el **síntoma** (178 vs 181, y los 3 que salen por `# Ref`), que es **consistente** con esa causa, pero **el SQL no se leyó** en esta corrida. El arreglo propuesto (`IS DISTINCT FROM 'D'`) se hereda del diagnóstico del ciclo anterior |
| **Qué otras pantallas comparten el filtro** | ⚠ **No comprobado.** Sólo se midió `/pages/pedidos`. `/pages/inventarios`, `/pages/devoluciones` y `/pages/sugerenciasPedido` devolvieron **todo lo que hay en la nube** en esta ventana, pero **ninguna de esas tres tiene hoy una fila con `co_operation` nulo**, así que **no son una prueba**: el filtro podría estar ahí y no haberse podido disparar |
| **DM-SUG-011** (la suma del despacho de dos facturas del mismo día) | ⛔ **BLOCKED** desde la vuelta 1 por falta de dato. **No se destraba desde la web** |
| **DM-SUG-075 / 076 / 077** (merge y doble sync) | 🚫 **N-A en esta capa**: exigen operar el dispositivo. Medidos en la vuelta 2 |
| **El cotejo fuerte del monto** (mezcla de monedas) | 🚫 **Sin dato**: los 4 pedidos van enteros en USD, IVA 0, sin descuentos ⇒ el cotejo pasa aunque se use el campo equivocado. **No se puede fabricar desde la web** (sería escritura) |
| **Las 2 sugerencias sólo locales y la devolución Guardada** | 🚫 **N-A por definición**: nunca subieron ⇒ la web no puede mostrarlas. Su ausencia es lo **correcto**, no un `WEB-MISSING`. Se verificó que la web tampoco las inventa |
| **La precisión de 15 dígitos de `estimated_daily_units`** (defecto de presentación del 09/09) | ⚠ **Sin dato esta vuelta**: `days_since_last` de 1 y 2 da diarias exactas. **No se puede dar por cerrado** |
| **Adjuntos** | Fuera del REQ. Los botones `Ver adjuntos` / `Descargar adjuntos` existen en los detalles pero **no se pulsaron**: los 5 inventarios y las 3 devoluciones se enviaron con `nu_attachments = 0` |
| **Que el 181 «debería» mostrar algo del inventario colgado** | ⚠ **Es criterio, no medición.** Se reporta **qué hace** la web (no renderiza el bloque) y se deja la decisión al REQ. No se levanta como FAIL |

---

## 9. Para el cierre del ciclo

1. **Ticket 2 · mitad del dato: CERRADO** (vuelta 3, confirmado desde la web: el 178 se lista).
2. **Ticket 2 · mitad del listado: ABIERTO, S1.** 3 pedidos por 9.372,70 USD invisibles. Conjunto cerrado en 3, no crece, pero **no se recupera solo**. `IS DISTINCT FROM 'D'`.
3. **Defecto W2 (formato inglés en `detalleSugerenciaPedido`): ABIERTO, S3**, reproduce con el contraste `2,560` vs `2.560`.
4. **Para el REQ, dos decisiones de trazabilidad, no de código:**
   **(a)** ¿la conversión de una sugerencia debería **subirla a la nube** para que el pedido tenga origen consultable? (Obs. W3);
   **(b)** ¿el pedido nacido de una sugerencia huérfana debería **acusarse de algún modo** en la web, o está bien que sea indistinguible de uno normal? (Obs. W5).
