# Vuelta 4 · WEB — cierre de las tres capas · HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `ciclo_sugerido_3capas_20260909` |
| Fecha | 2026-09-09 |
| Rama bajo prueba | `SaveSuggestedOrder` |
| Playa (verificada en runtime, por `host`) | **Isla Coche** — web `denarioislacoche.ddns.net:8080/DenarioPremium` |
| Empresa leída en la web | `HIDROPONIAS VENEZOLANAS C.A` · `idEnterprise 1` (selector `form:j_idt116:idEnterprise_input` = **1**) |
| Vendedor de la corrida | **ROGER MUESES** · `idUser 469` (el `<select>` de vendedor usa **`id_user`** como `value`) |
| Usuario web | bloque `# USUARIO WEB ISLA COCHE (HIDROPONIAS)` de `secrets/qa-credentials.env` — entró a la primera |
| Modo | **READ-ONLY**. No se creó, editó ni borró nada. Los únicos controles tocados: `Buscar`, `Consultar`, los filtros del panel y los enlaces cruzados `Ref.: N` |
| Resultado | **37 casos: 32 PASS · 2 FAIL · 0 BLOCKED · 3 N-A** |

> **Las tres respuestas que se pedían:**
> 1. **El cotejo término por término cuadró, tolerancia 0.** 12 productos × 9 términos + 2 cabeceras × 2 términos = **112 comparaciones web ↔ nube ↔ equipo, 0 divergencias.** Y la web **no muestra menos** de lo que guarda: muestra **los 9 términos completos más dos columnas que el equipo no tiene** (`Qty pedido` y `Diferencia`).
> 2. **Un defecto nuevo, de severidad 1, que sólo se podía ver en esta capa:** el pedido **175** —1.223,60 USD, enviado, vivo en la nube— **no aparece en el listado de `/pages/pedidos`**. Su fila quedó con `co_operation = NULL` y el listado filtra `co_operation <> 'D'`, que en SQL descarta los nulos en silencio. Son **2 pedidos de 176 en toda la historia del cliente**, y **los dos** son de la ventana de prueba de esta rama.
> 3. **Los pedidos 175 y 176 se ven, en efecto, sin sugerencia asociada** — confirmado en la web, tal como anticipó la vuelta 3. Queda como pregunta para el REQ.

---

## 1. Tabla de veredictos

### Bloque F del guión — el corazón del encargo

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DW-SUG-000 | Guarda de playa + empresa + vendedor antes de leer nada | ✅ PASS | `host = denarioislacoche.ddns.net:8080` (Isla Coche, coincide con el `:8081` de los payloads del móvil) · empresa del filtro = `HIDROPONIAS VENEZOLANAS C.A` / value `1` · el vendedor existe como opción `469 · ROGER MUESES`. Coincide con el encargo ⇒ se sigue |
| **DM-SUG-072** | **Transacciones → Pedido Sugerido: aparecen las dos** | ✅ **PASS** | Ruta real **`/pages/sugerenciasPedido`** (el menú la llama **«Sugerencias de Pedido»**, no «Pedido Sugerido»). Filtrando por vendedor `ROGER MUESES`: **exactamente 2 filas**, `Ref 5` y `Ref 4`, con **cliente, fecha y cantidad de líneas** — los tres datos que pedía el guión |
| DM-SUG-072b | Las ids 1-3 (vendedor `id_user 468`) no se mezclan | ✅ PASS | Sin filtro salen las 5; con `Vendedor = ROGER MUESES` bajan a **2** y desaparecen las de `KEVIN WILCHES` (Refs 1, 2, 3 — clientes 402, 100063, 105). **El filtro es por `id_user`**: el `<select>` trae `value="468"` / `value="469"`, que son los `id_user`, no los `co_user` |
| **DM-SUG-073** | **Cotejo móvil ↔ web, término por término** | ✅ **PASS** | **112 comparaciones, 0 divergencias.** Ver §3. La web expone los **9 términos** en `/pages/detalleSugerenciaPedido` (tabla `form:compareDT`) y los 2 de cabecera. **No falta ninguno** |
| DM-SUG-073b | ¿La web muestra **menos** términos de los que guarda? | ✅ PASS (informativo) | **No: muestra más.** A los 9 términos les suma `Qty pedido` y `Diferencia` — una comparación sugerido↔pedido que en el equipo no existe. También rotula el **Algoritmo** (`Despacho y devolucion` = `by_dispatch_and_return`) y enlaza al inventario y al pedido |
| **DM-SUG-074** | **Pedido 169 = las 7 líneas de sugerido > 0** | ✅ **PASS** | 7 líneas exactas, en el orden de la web: `046PRO003003025` 20 · `CAMPROLEC001BAN` 30 · `GERPROALF002CAJ` 150 · `GERPROGCH002BOL` 620 · `MAL013PLS098MOR` 500 · `TOMPROCHE001CAJ` 220 · `TOMPROMAN001GRA` 2.610. **Los 2 sugeridos en 0 (`HIDPROBER001BOL`, `046013ESP001BOL`) no están.** Suma = **9.694,10 USD** |
| DM-SUG-074b | Pedido 170 = las 3 líneas de la sugerencia id 5 | ✅ PASS | `046013ESP001BOL` 4 · `CAMPROLEC003BAN` 7 · `GERPROGCH002BOL` 4 — uno a uno los sugeridos. Subtotales 12,24 + 14,63 + 6,16 = **33,03 USD** |
| DM-SUG-074c | Los ceros, en la vista de la **sugerencia** | ✅ PASS | En `form:compareDT` los 2 productos con sugerido 0 **sí se listan**, con `Qty sugerida 0` / `Qty pedido 0` / `Diferencia 0` y sus 8 términos completos. Es **consistente** con el equipo (DM-SUG-033): se guardan y se muestran en la sugerencia, se excluyen del pedido |

### Bloque B del encargo — el ciclo completo en la web

| ID | Caso | Resultado | Nota (valores medidos) |
|---|---|---|---|
| DW-INV-001 | Los **4 inventarios** en `/pages/inventarios` | ✅ PASS | **266, 267, 268 y 269**, los cuatro `Estatus Enviado`, vendedor `ROGER MUESES`. También están los 263-265 del otro vendedor |
| DW-INV-002 | Inventario **266**: 9 líneas | ✅ PASS | 9 filas, los 9 productos del §3 de la vuelta 2, con `Exhibición` = el `qu_stock` de la nube |
| DW-INV-003 | **La línea en cantidad 0 se muestra** | ✅ **PASS** | `TOMPROMAN001GRA` → **`0.00 UNIDAD`**. Ni se oculta ni sale en blanco. Cierra DM-SUG-025 en la tercera capa |
| DW-INV-004 | Inventario **267**: 3 líneas | ✅ PASS | `046013ESP001BOL` 4,00 · `GERPROGCH002BOL` 4,00 · `HIDPROBER001BOL` 5,00. Comentario `QA vuelta2 sugerido 09/09 A` |
| DW-INV-005 | Inventario **268**: 3 líneas | ✅ PASS | `GERPROGCH002BOL` 2,00 · `046013ESP001BOL` 1,00 · `CAMPROLEC003BAN` 2,00 |
| DW-INV-006 | Inventario **269**: 1 línea, sin sugerencia | ✅ PASS | `HIDPROBER001BOL` 7,00, comentario vacío y **sin `Ver Pedido Relacionado`** — el control de DM-SUG-051 se ve también acá |
| DW-INV-007 | Enlace cruzado inventario → pedido | ✅ PASS | 266 → `Ref.: 169` · 267 → `Ref.: 175` · 268 → `Ref.: 170`. Los tres botones navegan al detalle del pedido correcto (probado sobre el 175) |
| DW-DEV-001 | Las **2 devoluciones** en `/pages/devoluciones` | ✅ PASS | **277** y **278**, ambas `Enviado`, cliente `HIPERMERCADO PARAMO, C.A - PIEDRA AZUL`, vendedor `ROGER MUESES` |
| DW-DEV-002 | Devolución **277** = Distribución, con sus cantidades | ✅ PASS | `Tipo de devolución: **Distribución**` · `046013ESP001BOL` ×**5** lote `L0909A` motivo `AA-AGUADO` · `HIDPROBER001BOL` ×**3** motivo `VENCIDO` · factura `20118282` · responsable `QA VUELTA1` · precinto `P0909A` |
| DW-DEV-003 | Devolución **278** = Calidad, con su cantidad | ✅ PASS | `Tipo de devolución: **Calidad**` · `046013ESP001BOL` ×**4** motivo `AA-AGUADO` · factura `20118282` · precinto `P0909B` |
| DW-DEV-004 | El **tipo** sólo se ve en el detalle | 🚫 **N-A explicado** | El listado de devoluciones **no tiene columna de tipo** (`Detalle · # Ref · Estatus · Fecha Devoluciòn · Vendedor · Cliente`). No es defecto —nunca la tuvo— pero **obliga a abrir cada fila** para separar Calidad de Distribución. Se anota como limitación del oráculo, no como FAIL |
| DW-PED-001 | Los **7 pedidos** de la corrida en la web | ❌ **FAIL** | **6 de 7 en el listado; falta el 175.** Ver **Defecto W1** |
| DW-PED-002 | Pedido **169**: 7 líneas / 9.694,10 USD | ✅ PASS | Detalle: 7 filas, `Monto Base Pedido 9.694,10 USD`, `Monto Total Pedido 9.694,10 USD`, `Inventario relacionado Ref.: 266` |
| DW-PED-003 | Pedido **170**: 3 líneas / 33,03 USD | ✅ PASS | 4/7/4 unidades, `Inventario relacionado Ref.: 268` |
| DW-PED-004 | Pedido **171** (normal): **sin** sugerencia ni inventario | ✅ **PASS** | 2 líneas (`046013461003BAN` 5 · `GERPROGCH001BOL` 2), 19,65 USD, comentario `QA v3 pedido normal 09/09` íntegro y **la etiqueta `Inventario relacionado` ni siquiera se renderiza**: no hay botón `Ref.: N` en la cabecera. Es el control negativo de DM-SUG-081, confirmado en la web |
| DW-PED-005 | Pedido **172** (copia del 170): sin sugerencia | ✅ PASS | 3 líneas idénticas al 170, 33,03 USD, y **sin `Inventario relacionado`** ⇒ **`COPIAR` no arrastra el vínculo**. Confirma DM-SUG-064b en la tercera capa |
| DW-PED-006 | Pedido **174** (copia del 171) | ✅ PASS | En el listado: 2 items, 19,65 USD, `Enviado` |
| DW-PED-007 | Pedido **175**: 3 líneas / 1.223,60 USD | ✅ PASS *(alcanzado por otra vía)* | 150/230/180 unidades, subtotales 459,00 + 354,20 + 410,40 = **1.223,60 USD**, `Inventario relacionado Ref.: 267`. **Se llegó desde el inventario 267 y con el filtro `# Ref`, no desde el listado** (Defecto W1) |
| DW-PED-008 | Pedido **176**: 1 línea / 18,36 USD | ✅ PASS | `046013ESP001BOL` ×6 a 3,06 = 18,36 USD, **sin `Inventario relacionado`** — su inventario tampoco subió |
| DW-PED-009 | El pedido **173** (de la QA) no se cuenta como propio | ✅ PASS (informativo) | Aparece en el listado: 1 item, 7,40 USD, cliente 1702, `id_user 469`. Se anota y **no** se levanta como anomalía |
| **DW-PED-010** | **175 y 176 se ven sin sugerencia asociada** | ✅ **PASS** *(confirmación pedida en el punto C.1)* | Ni el detalle del 175 ni el del 176 mencionan sugerencia alguna, y no hay fila para ellos en `/pages/sugerenciasPedido`. **Es lo esperado** —el usuario dijo «NO»— pero queda la pregunta de trazabilidad para el REQ. Ver **Observación W3** |
| DW-PED-011 | Cotejo de montos por el criterio correcto | ⚠️ **PASS débil — declarado** | Se sumó **`nu_amount_total` de las líneas** (no `nu_amount_final`) y cuadró con el `Monto Total Pedido` de la web en los 7 pedidos. **Pero el cotejo no prueba gran cosa acá:** los 7 van **enteros en USD**, con IVA 0 y sin descuentos, de modo que `nu_amount_total == nu_amount_final` en los 7 y **cotejar contra el campo equivocado también habría dado PASS**. Ver §4 |
| DW-PED-012 | Oráculo de conversión de moneda | ✅ PASS | `Monto × Tasa == Monto conv.` exacto en los 7: 9.694,10 × 814,69 = **7.897.686,33 BS** · 33,03 → 26.909,21 · 19,65 → 16.008,66 · 1.223,60 → 996.854,68 · 18,36 → 14.957,71 · 7,40 → 6.028,71. Es el único cruce **entre dos monedas** disponible en esta corrida |
| DW-PED-013 | ¿El listado esconde por `salesman_view`? | 🚫 **N-A — descartado con la consulta** | **No es ese el mecanismo.** Punto D del encargo, verificado y descartado: el vendedor 469 está **activo** y sus otros 6 pedidos del mismo día sí se listan; el filtro de vendedor de la web usa `id_user` (no `co_user`) y trae a ROGER MUESES como opción válida. La causa real es `co_operation IS NULL` (Defecto W1), probada por conteo |
| DW-WEB-001 | Formato numérico de la pantalla nueva | ❌ **FAIL** (S3) | `/pages/detalleSugerenciaPedido` imprime **`2,610`** donde `/pages/detallePedido` imprime **`2.610`** para el mismo número. Ver **Defecto W2** |
| DW-WEB-002 | Casos de escritura del bloque F | 🚫 **N-A por diseño de la vuelta** | DM-SUG-075/076/077 (merge y doble sincronización) **no son ejercitables desde la web**: exigen tocar el equipo, y esta vuelta es de sólo lectura. Quedaron medidos en la vuelta 2 |

---

## 2. Registros verificados en la web

| Qué | Ref | Dónde se ve | Estado en la web |
|---|---|---|---|
| Sugerencia | **4** | `/pages/sugerenciasPedido` + detalle | 9 líneas · `Pedido 169` · `Pedido enviado: Si` ✅ |
| Sugerencia | **5** | ídem | 3 líneas · `Pedido 170` · `Pedido enviado: Si` ✅ |
| Inventario | **266 · 267 · 268 · 269** | `/pages/inventarios` | los 4 `Enviado`, con 9 / 3 / 3 / 1 líneas ✅ |
| Devolución | **277** Distribución · **278** Calidad | `/pages/devoluciones` | las 2 `Enviado`, con sus cantidades ✅ |
| Pedido | **169 · 170 · 171 · 172 · 174 · 176** | `/pages/pedidos` | los 6 en el listado, con líneas y montos exactos ✅ |
| Pedido | **175** | ❌ **no en el listado**; sí por `# Ref` y desde el inventario 267 | **Defecto W1** |
| Pedido | *(173)* | `/pages/pedidos` | de la QA, no de la corrida — anotado, no reportado |

---

## 3. Cotejo término por término · **móvil ↔ nube ↔ web**

Los 9 términos por producto, más `días desde` / `días hasta` de la cabecera. Oráculo: las tablas
del §3 de `02-inventarios-y-sugerido.md` (equipo) y `client_stock_suggested_order_details` (nube).
**Tolerancia 0.**

**Mapeo columna de la web → campo del modelo** *(material nuevo, no estaba documentado)*:

| Columna de `form:compareDT` | Campo persistido |
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
| `Qty pedido` / `Diferencia` | *(sólo web — derivados del pedido generado)* |

### Sugerencia **Ref 4** · inventario 266 · cliente 100113 · cabecera web `días desde 1 / hasta 10` ✅

| Producto | prev | desp | swap | dev | ini | act | vend | diaria | **sugerido** | web = nube = equipo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| `TOMPROMAN001GRA` | 0 | 261 | 0 | 0 | 261 | 0 | 261 | 261 | **2.610** | ✅ 9/9 |
| `MAL013PLS098MOR` | 100 | 100 | 0 | 0 | 200 | 150 | 50 | 50 | **500** | ✅ 9/9 |
| `HIDPROBER001BOL` | 10 | 15 | 0 | 12 | 25 | 20 | **−7** | 0 | **0** | ✅ 9/9 |
| `CAMPROLEC001BAN` | 20 | 8 | 0 | 0 | 28 | 25 | 3 | 3 | **30** | ✅ 9/9 |
| `046013ESP001BOL` | 5 | 15 | 0 | 9 | 20 | 10 | 1 | 1 | **0** | ✅ 9/9 |
| `046PRO003003025` | 3 | 0 | 0 | 0 | 3 | 1 | 2 | 2 | **20** | ✅ 9/9 |
| `GERPROALF002CAJ` | 25 | 30 | 0 | 0 | 55 | 40 | 15 | 15 | **150** | ✅ 9/9 |
| `GERPROGCH002BOL` | 35 | 30 | 0 | 0 | 65 | 3 | 62 | 62 | **620** | ✅ 9/9 |
| `TOMPROCHE001CAJ` | 12 | 15 | 0 | 0 | 27 | 5 | 22 | 22 | **220** | ✅ 9/9 |

🔑 **La venta negativa SÍ se muestra en la web.** `HIDPROBER001BOL` sale con `Venta **-7.0**`.
El equipo la **clampa a 0** por `formatNumber` (Observación 2 de la vuelta 2) ⇒ **la web es más
fiel al dato que la propia app**, y es el único lugar donde el vendedor puede ver por qué el
sugerido de ese producto dio 0.

### Sugerencia **Ref 5** · inventario 268 · cliente 225 · cabecera web `días desde 21 / hasta 10` ✅

| Producto | prev | desp | swap | dev | ini | act | vend | diaria | **sugerido** | web = nube = equipo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:--:|
| `GERPROGCH002BOL` | 0 | 0 | **10** | 0 | 10 | 2 | 8 | 0,380952380952381 | **4** | ✅ 9/9 |
| `046013ESP001BOL` | 4 | 0 | **7** | 2 | 11 | 1 | 8 | 0,380952380952381 | **4** | ✅ 9/9 |
| `CAMPROLEC003BAN` | 9 | 0 | **8** | 0 | 17 | 2 | 15 | 0,714285714285714 | **7** | ✅ 9/9 |

**La `estimated_daily_units` llega a la web con los 15 dígitos de la columna `NUMERIC`** —
literalmente `0.380952380952381` en pantalla. Coincide **al dígito** con la nube y con el
equipo (que guarda el doble de JS `0.38095238095238093`, diferencia de 7·10⁻¹⁷ que ya se
declaró en la vuelta 2 como precisión de columna, no divergencia). **No es un mismatch; sí es
un problema de presentación** (Defecto W2).

### Cabeceras

| Campo | Ref 4 · equipo/nube | Ref 4 · web | Ref 5 · equipo/nube | Ref 5 · web |
|---|---|---|---|---|
| `days_since_last` | 1 | **1** ✅ | 21 | **21** ✅ |
| `days_until_next` | 10 | **10** ✅ | 10 | **10** ✅ |
| `co_..._suggested_order` | `1788983216162.0` | **idéntico** ✅ | `1788985534564.0` | **idéntico** ✅ |
| `by_dispatch_and_return` | 1 | `Algoritmo: Despacho y devolucion` ✅ | 1 | ídem ✅ |
| `nu_details` | 9 | `Lineas: 9` ✅ | 3 | `Lineas: 3` ✅ |
| `da_suggested` | `19:54:32Z` | `09/09/2026 15:54:32` ✅ (UTC−4) | `20:25:34Z` | `09/09/2026 16:25:34` ✅ |
| `id_client_stock` | 266 | `Inventario: Ref.: 266` ✅ | 268 | `Ref.: 268` ✅ |
| `id_order` | 169 | `Pedido: Ref.: 169` ✅ | 170 | `Ref.: 170` ✅ |

**Total: 12 productos × 9 términos + 2 cabeceras × 2 términos = 112 comparaciones · 0 divergencias.**

---

## 4. Sobre el cotejo de montos — lo que **no** prueba

El encargo pide cotejar el total del pedido sumando **`nu_amount_total`** (que lleva IVA) y no
`nu_amount_final`. Se hizo así, y cuadró. **Pero hay que decir que en esta corrida ese cotejo
es débil, y por qué:**

| Pedido | Σ `nu_amount_total` de las líneas | `nu_amount_total` cabecera | `nu_amount_final` | Monedas | IVA |
|---|---:|---:|---:|---|---:|
| 169 | 9.694,10 | 9.694,10 | **9.694,10** | sólo USD | 0 |
| 170 | 33,03 | 33,03 | **33,03** | sólo USD | 0 |
| 171 | 19,65 | 19,65 | **19,65** | sólo USD | 0 |
| 172 | 33,03 | 33,03 | **33,03** | sólo USD | 0 |
| 174 | 19,65 | 19,65 | **19,65** | sólo USD | 0 |
| 175 | 1.223,60 | 1.223,60 | **1.223,60** | sólo USD | 0 |
| 176 | 18,36 | 18,36 | **18,36** | sólo USD | 0 |

Los 7 pedidos van **enteros en una sola moneda**, con `nu_amount_tax = 0` en todas las líneas y
sin descuentos ⇒ **`nu_amount_total == nu_amount_final` en los 7**. Cotejar contra el campo
equivocado habría dado el mismo PASS. **El caso fuerte —mezcla de monedas— no está en esta
corrida y no se puede fabricar desde la web**, así que:

- el veredicto de DW-PED-011 es **PASS débil, declarado**, no un PASS fuerte;
- lo que **sí** se ejercitó de verdad entre dos monedas es la **conversión** (DW-PED-012):
  `Monto × Tasa == Monto conv.`, exacta en los 7 con tasa `814,69 BS = 1 USD`;
- para cerrar el oráculo del monto haría falta un pedido con al menos **dos monedas** o con
  IVA/descuento distinto de 0. **Queda pendiente y anotado**, no dado por bueno.

---

## 5. Defectos

### 🔴 Defecto W1 — S1 · Un pedido enviado y vivo **no aparece en el listado de Pedidos**: la fila quedó con `co_operation = NULL` y el filtro la descarta en silencio

**Qué pasa.** En `Transacciones → Pedidos`, con el rango por defecto (01/09 → 09/09) y sin
ningún filtro, el listado devuelve **42 filas** y **el pedido 175 no está**. Tampoco el **166**.
Los dos existen, están `Enviado`, tienen líneas, monto y coordenadas, y el resto del sistema los
ve: **desde el inventario 267 el botón «Ver Pedido Relacionado → Ref.: 175» abre su detalle sin
problema**, y escribiendo `175` en el filtro `# Ref` la fila aparece.

**La prueba, por conteo.** Sobre la misma ventana que muestra la web:

```sql
SELECT count(*) total,
       count(*) FILTER (WHERE co_operation <> 'D')             AS neq_d,
       count(*) FILTER (WHERE co_operation IS DISTINCT FROM 'D') AS distinct_d,
       count(*) FILTER (WHERE co_operation IS NULL)            AS nulos
FROM "order"
WHERE id_enterprise = 1 AND da_order >= '2026-09-01' AND da_order < '2026-09-10';
```

| total | `<> 'D'` | `IS DISTINCT FROM 'D'` | nulos |
|---:|---:|---:|---:|
| **44** | **42** ← *lo que muestra la web* | 44 | **2** |

Y en la ventana no hay **ni un** registro borrado (`co_operation = 'D'` → 0), así que los 2 que
faltan son exactamente los 2 nulos. **El listado filtra `co_operation <> 'D'`, y en SQL
`NULL <> 'D'` no es verdadero: la fila se cae sin error y sin aviso.**

**No es un problema histórico — es de esta rama.** En **toda** la tabla `"order"` del cliente
(176 pedidos, desde el 20/07/2026) hay **exactamente 2** filas con `co_operation IS NULL`:

| Pedido | Fecha | Vendedor | Monto | `id_client_stock` | Su sugerencia, ¿está en la nube? |
|---|---|---|---:|---|---|
| **166** | 08/09 17:02 | 469 ROGER MUESES | 8.118,50 USD | 157 | ❌ no |
| **175** | 09/09 17:47 | 469 ROGER MUESES | **1.223,60 USD** | 267 | ❌ no |

Las dos caen dentro de la ventana de prueba de `SaveSuggestedOrder` y **las dos comparten el
mismo patrón**: son pedidos nacidos de una **sugerencia que nunca subió a la nube**, pero cuyo
**inventario sí está** en la nube. El contraste cierra el cuadro:

| Pedido | Sugerencia en la nube | Inventario en la nube | `co_operation` | ¿Se lista? |
|---|---|---|---|---|
| 169 | ✅ id 4 | ✅ 266 | `I` | ✅ |
| 170 | ✅ id 5 | ✅ 268 | `I` | ✅ |
| 171 · 172 · 174 | — (sin sugerencia) | — | `I` | ✅ |
| **175** | ❌ | ✅ 267 | **NULL** | ❌ |
| **176** | ❌ | ❌ (`id_client_stock` null) | `I` | ✅ |
| **166** | ❌ | ✅ 157 | **NULL** | ❌ |

⇒ **la combinación «hay inventario para enlazar pero no hay sugerencia» deja el pedido con
`co_operation` sin escribir.** Es coherente con el endpoint que la vuelta 3 identificó
(`clientstockservice/clientstocksuggestedorderlink`, que sale **dos veces** al enviar un pedido
nacido de sugerencia): la escritura del vínculo toca la fila del pedido y la deja sin la marca.

**Por qué importa.** Un pedido de 1.223,60 USD que el vendedor envió correctamente **es
invisible** para quien revise la operación del día en la web. No hay error, no hay aviso, y el
total del listado tampoco lo delata. Sólo aparece si alguien ya sabe su número de referencia — es
decir, si ya sabe que existe. Afecta a un vendedor **activo** y a registros **creados hoy**.

**Reproducción.**
1. En el equipo, generar un sugerido y **enviar el inventario respondiendo «NO»** a *«¿Desea
   enviar también la sugerencia de pedido?»* (el inventario sube, la sugerencia no).
2. Ir a **Inventario → Sugerencias de Pedido**, abrir esa sugerencia y **ACEPTAR** para
   convertirla en pedido; enviarlo.
3. En la web, `Transacciones → Pedidos` con el rango del día: **el pedido no está en la lista**.
4. Escribir su `# Ref` en el filtro y `Buscar`: **ahora sí aparece**. Y desde
   `Transacciones → Inventarios` → ese inventario → `Ver Pedido Relacionado`, también.

**Dos arreglos, y conviene hacer los dos.**
1. **El de fondo (servidor / rama):** que el camino de
   `clientstocksuggestedorderlink` **no deje `order.co_operation` en NULL**. Es el que evita que
   el dato nazca mal.
2. **El de blindaje (web):** que el listado use `co_operation IS DISTINCT FROM 'D'` (o
   `COALESCE(co_operation,'I') <> 'D'`) en vez de `<> 'D'`. Con eso **ningún** registro vuelve a
   desaparecer por un nulo, venga de donde venga. ⚠ Y conviene revisar si el mismo `<> 'D'` está
   en los listados de cobros, devoluciones, inventarios y depósitos: la trampa es la misma.

**Contra qué se descartó la otra hipótesis.** El encargo pedía verificar primero el filtro por
vendedor (`salesman_view`, antecedente de `grupo_fiel`). **No es eso:** el vendedor 469 está
activo, aparece como opción del filtro, y sus otros **seis** pedidos del mismo día sí se listan.
El `<select>` de vendedor de la web usa `value="469"` = **`id_user`** (no `co_user`), o sea que el
join correcto ya está aplicado en esta pantalla.

---

### 🔴 Defecto W2 — S3 · La pantalla nueva imprime los números **en formato inglés**, contra el es-VE del resto de la web

**Qué pasa.** `/pages/detalleSugerenciaPedido` es la única pantalla del sistema que no respeta la
convención venezolana. En la **misma sesión** y para el **mismo número**:

| Dónde | Producto | Cómo se ve |
|---|---|---|
| `/pages/detalleSugerenciaPedido` → `Qty sugerida` | `TOMPROMAN001GRA` | **`2,610`** |
| `/pages/detallePedido` → `Unidades pedidas` | el mismo producto, mismo pedido | **`2.610 UNIDAD`** |
| `/pages/pedidos` → `Monto Total` | pedido 169 | `9.694,10 USD` |

En es-VE la coma es el **separador decimal**: un vendedor que lee `2,610` entiende **2,61
unidades**, no dos mil seiscientas diez. En un pedido de 6.525,00 USD sobre ese renglón, el
malentendido no es cosmético.

**Y los términos van sin formatear en absoluto:**

```
Inv. inicial: 261.0        ← punto decimal inglés y decimal vacío
Ventas diarias est.: 0.380952380952381    ← 15 dígitos, el NUMERIC crudo
```

El valor es **correcto** (cuadra al dígito con la nube, §3): lo que falla es la presentación.
`Ventas diarias est.` debería mostrarse con 2 ó 4 decimales, y todas las columnas con el mismo
formato es-VE que usa el resto de la aplicación.

**Reproducción.** `Transacciones → Sugerencias de Pedido` → `Consultar` sobre la Ref 4 → mirar
las columnas `Qty sugerida`, `Inv. inicial` y `Ventas diarias est.` Comparar con el
`Consultar` del pedido 169.

---

## 6. Observaciones (no se reportan como defecto)

**W3 · El vínculo pedido ↔ sugerencia es de una sola vía.** El detalle de la **sugerencia** trae
`Pedido: Ref.: 169` y el del **inventario** trae `Ver Pedido Relacionado`, pero el detalle del
**pedido** sólo muestra `Inventario relacionado` — **nunca la sugerencia de la que nació**.
Quien parte del pedido no tiene forma de llegar a los términos del cálculo que lo originó, que es
justo la trazabilidad que el REQ vino a aportar. Un `Sugerencia relacionada: Ref.: 4` en la
cabecera del pedido cerraría el círculo. *(Se anota como mejora, no como defecto: nadie lo
especificó.)*

**W4 · Confirmado el punto C.1 del encargo — 175 y 176 se ven sin sugerencia.** Es coherente con
lo que el usuario pidió (respondió «NO» al enviar el inventario) y **no se levanta como defecto**.
Pero en la web el efecto es más fuerte de lo que anticipaba la vuelta 3: el 175 **ni siquiera se
lista** (Defecto W1) y el 176 aparece sin inventario **ni** sugerencia, o sea sin ningún rastro de
su origen. **Para el REQ:** ¿debería la sugerencia subir igual en el momento de convertirse en
pedido, aunque el usuario haya dicho que no la enviara con el inventario? Hoy, la validación de
«un solo pedido por sugerencia» para estas dos vive **sólo en el equipo**; el servidor no tiene con
qué impedir un segundo pedido si el teléfono se reinstala.

**W5 · `Moneda:` llega vacía en la cabecera de la sugerencia.** Coincide con lo que muestra la
vista previa del equipo (`Pedido Sugerido / Moneda: / Días desde…`, medido en DM-SUG-063), así que
**no es un defecto de la web**: el campo viene vacío desde el origen. La cabecera de
`client_stock_suggested_orders` no persiste moneda. Vale confirmarlo con el REQ: o se llena, o se
quita la etiqueta.

**W6 · La columna `N°` del detalle de inventario dice `1` en todas las filas.** Verificado en el
inventario **266** (9 filas, todas `N° 1`). **No es regresión de esta rama:** reproduce igual en el
inventario **129 del 01/09**, anterior a la corrida (8 filas, todas `1`). Va como observación sobre
comportamiento **histórico**, con la fecha del caso más viejo comprobado. El detalle de **pedido**
sí numera bien (1..7).

**W7 · El listado de devoluciones no expone el tipo.** Para separar Calidad de Distribución hay que
abrir cada fila. Siempre fue así; se anota porque **encarece el oráculo** de cualquier automatización
sobre ese módulo.

---

## 7. Patrones y selectores nuevos de la web

> Hasta hoy `automation/web/web-selectors/` **no tenía nada** de esta pantalla — el módulo
> «Sugerencias de Pedido» no existía cuando se levantó el reconocimiento F0. Todo lo de abajo
> es material nuevo. **Sugerencia: promoverlo a `automation/web/web-selectors/sugerenciasPedido.md`
> y sumar las dos rutas a `automation/web/playas.yaml`.**

| Patrón / selector | Alcance | Detalle |
|---|---|---|
| 🔴 **La ruta nueva es `/pages/sugerenciasPedido`, y el menú la llama «Sugerencias de Pedido»** | universal | El guión (y el móvil) dicen **«Pedido Sugerido»**; la web dice **«Sugerencias de Pedido»**, bajo `Transacciones`, **última entrada** del submenú. Buscar por el nombre del guión no encuentra nada. Detalle: **`/pages/detalleSugerenciaPedido`**. Las dos aceptan navegación directa por URL con sesión activa |
| 🔴 **La cabecera de los detalles tiene DOS estructuras distintas y `leerCabecera()` sólo lee una** | universal (harness) | En `detalleSugerenciaPedido` la etiqueta es un `<span class="font-bold">` dentro de un `<div>` propio, y **el valor es el `<div>` HERMANO SIGUIENTE**. `__qaW.leerCabecera()` (que busca el valor como texto del **mismo padre**) devuelve **todos los campos en blanco** y se lee como «la web no muestra la cabecera». **Receta que sí funciona en las dos:** `document.querySelectorAll('span.font-bold')` → si el texto termina en `:` → valor = `el.parentElement.nextElementSibling.textContent`. **Probar los dos lectores y quedarse con el que devuelva valores** |
| 🔴 **`form:compareDT` — la tabla de términos, y el mapa columna → campo** | universal | 13 columnas: `Producto · Unidad · Qty sugerida · Qty pedido · Diferencia · Inv. inicial · Inv. anterior · Despacho · Cambio x cambio · Venta · Inv. actual · Dev. distribucion · Ventas diarias est.` Los **9 términos completos** están ahí (mapa en §3), más 2 derivados que el equipo no tiene. **Es el único `.ui-datatable` de la página**, así que ancla por id sin ambigüedad |
| 🔴 **`form:sugerenciasDT` — el listado, con `Lineas` que el móvil NO muestra** | universal | Columnas `Detalle · # Ref · Fecha · Vendedor · Cliente · Lineas · Pedido · Pedido enviado`. **La web sí muestra la cantidad de líneas**, que era justo la carencia levantada en DM-SUG-041 de la vuelta 2 ⇒ el dato existe, es la lista del **equipo** la que no lo pinta. `Pedido` trae `—` cuando la sugerencia está pendiente |
| 🔴 **Los filtros del panel son ESTADO DE SESIÓN y sobreviven a un `browser_navigate` completo** | universal (harness) | Se filtró por vendedor en `/pages/sugerenciasPedido`, se navegó a la URL desde cero y **el filtro seguía puesto**. Peor: un `# Ref = 171` dejado en `/pages/pedidos` hizo que un `Consultar` sobre la **fila 0** abriera el **171** cuando se buscaba el 176. **Regla: limpiar el filtro (o volver a fijarlo) ANTES de cada búsqueda, y verificar siempre el `No. de Ref.` DEL DETALLE antes de dar por bueno lo leído** — el índice de fila no identifica el registro |
| 🔴 **El `<select>` de Vendedor usa `id_user` como `value`** | universal | `form:j_idt116:idSalesmaView_input` → opciones `""` / `"468"` KEVIN WILCHES / `"469"` ROGER MUESES. **Son los `id_user`, no los `co_user`** (`V3`/`V4`) ⇒ el join correcto ya está en esta pantalla. Es el dato que descarta la hipótesis `salesman_view` sin abrir la BD |
| 🔴 **PrimeFaces `selectOneMenu`: setear el `<select>` a mano NO alcanza — usar el widget** | universal (harness) | `PrimeFaces.widgets['widget_form_j_idt116_idSalesmaView'].selectValue('469')` sincroniza el `_input`, la etiqueta visible y el estado interno de una sola vez. Los widgets se enumeran con `for (const k in PrimeFaces.widgets)` y su nombre es el id con `:` → `_`. Para el `inputText` (`n_ref`) basta `value` + `dispatchEvent('change')` |
| 🔴 **`form:pedidosDT` lo comparten pedidos, inventarios y devoluciones — y también sus DETALLES** | universal (refuerza WEB-RUNTIME §3.b) | El id es el mismo en `/pages/pedidos`, `/pages/inventarios`, `/pages/devoluciones`, `/pages/detallePedido` y `/pages/detalleInventario`. **En `/pages/detalleDevolucion` cambia a `form:j_idt170`** (auto-generado). ⇒ **anclar por columnas**: `['Cod. producto','Cantidad','Motivo']` para el detalle de devolución, `['Qty sugerida','Ventas diarias est.']` para el de sugerencia |
| 🔴 **Los enlaces cruzados son BUTTONS con id auto-generado; el texto es `Ref.: N`** | universal | Inventario → pedido: `Ver Pedido Relacionado` + `<button>Ref.: 169</button>` (`form:j_idt150`). Pedido → inventario: `Inventario relacionado` + `<button>Ref.: 266</button>` (`form:j_idt199`). Sugerencia → los dos. **Nunca escribir el `j_idt*` en un guión**: anclar por el texto `Ref.: <n>`. Los tres navegan y funcionan |
| ✅ **La ausencia del botón `Ref.: N` es el oráculo de «este pedido no viene de una sugerencia»** | universal | En el 171 (normal), el 172 (copia) y el 176 la **etiqueta `Inventario relacionado` ni se renderiza**. Es un oráculo barato y visible, sin tocar la BD — el equivalente web del endpoint `clientstocksuggestedorderlink` de la vuelta 3 |
| ✅ **Hook de fin de ajax: `XMLHttpRequest.prototype.open` + `loadend`, nunca una espera fija** | universal (harness) | `jQuery(document).ajaxComplete` **no dispara** en estas páginas (ya anotado para Caribe). Envolver `open` e incrementar un contador en `loadend` da la señal exacta; se verificó que un `Buscar` = **1** ajax |
| ⚠ **`co_operation` no es sólo `'D'` o `'I'`: puede venir NULL, y los listados lo descartan** | universal (BD + web) | Ver Defecto W1. **Al medir un baseline contra lo que muestra la web, `WHERE co_operation <> 'D'` reproduce el listado pero NO cuenta los nulos.** Para medir el dato real: `IS DISTINCT FROM 'D'`. La diferencia entre los dos conteos es exactamente lo que la web está escondiendo |
| ⚠ **El detalle de inventario carga la cantidad en `Exhibición`, y `Depósito` viene `-`** | cliente/build | Con un solo punto de captura, `Depósito: -` es lo normal, no un dato perdido. El `0.00 UNIDAD` de una captura en cero **sí se muestra** |
| ℹ **La sugerencia se rotula con la hora local UTC−4** | universal | `da_suggested = 2026-09-09T19:54:32Z` → web `09/09/2026 15:54:32`. Cotejar **por día** y tratar el desfase de 4 h como nota, no como mismatch (WEB-RUNTIME §6) |
| ℹ **Rango de fechas por defecto = mes en curso (`01/09` → `09/09`)** | universal | En `/pages/pedidos` y `/pages/sugerenciasPedido`. **`/pages/inventarios` y `/pages/devoluciones` NO lo acotan** (devolvieron Refs 129-270 y 231-278). No asumir el mismo comportamiento en las cuatro pantallas |

---

## 8. Qué quedó sin probar en esta vuelta y por qué

| Caso | Motivo |
|---|---|
| **DM-SUG-011** (la suma del despacho) | ⛔ Sigue **BLOCKED** desde la vuelta 1. El cliente 9999932 no baja al equipo y el cursor de sincronización quedó quemado (Defecto de vueltas 1-3). **No se destraba desde la web**: es un defecto de sincronización del lado del equipo |
| **DM-SUG-075 / 076 / 077** (merge y doble sync) | 🚫 **N-A en esta capa**: exigen operar el dispositivo. Medidos en la vuelta 2 (075 y 077 PASS, 076 BLOCKED por ser sólo lectura la conexión de QA) |
| **El cotejo fuerte del monto** (mezcla de monedas) | 🚫 Sin dato: los 7 pedidos van enteros en USD, con IVA 0 y sin descuentos. Ver §4. **No se puede fabricar desde la web** (es de escritura) |
| **La sugerencia local `1788986798067.0` / `1788986913545.0`** (1702, Pendientes) | 🚫 N-A: nunca subieron a la nube ⇒ la web no puede mostrarlas. Es lo correcto, no un `WEB-MISSING` |
| **Un pedido nacido de sugerencia BORRADO** (DM-SUG-065) | 🚫 N-A: la web es de sólo lectura en esta vuelta y la móvil no ofrece borrar un pedido Enviado |
| **Adjuntos de los registros** | Fuera del REQ. Los botones `Ver adjuntos` / `Descargar adjuntos` existen en los tres detalles pero **no se pulsaron**: los 4 inventarios y las 2 devoluciones se enviaron con `nu_attachments = 0` |
