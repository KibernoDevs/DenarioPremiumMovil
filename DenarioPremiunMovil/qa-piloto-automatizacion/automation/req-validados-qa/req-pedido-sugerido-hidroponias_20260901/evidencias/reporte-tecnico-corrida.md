# Fix «Despacho consolidado por última fecha de facturación» — hidroponias

| Parámetro | Valor |
|---|---|
| RUN_ID | `fix_despacho_consolidado_20260901` |
| Fecha | 2026-09-01 |
| Alcance | Pedido Sugerido → campo **Despacho** (`dispatchedStock`) |
| Rama | `fix/invoices-Hidroponia-20260901` · commit **`076faf27`** |
| Playa | El Caribe |
| Empresa | `HIDRO_A` — HIDROPONIAS VENEZOLANAS C.A |
| Vendedor | **vendedor4** (`V4`, idUser 468) |
| Dispositivo | `14678405BR003855` (Infinix X6728, Android 15) |
| VGs relevantes | `suggestedOrderByDispatchAndReturn=true` · `suggestedOrder=true` · `stock0=true` · `hideStock0=false` · `validStock=false` |
| Resultado | ✅ **Despacho, swaps, quiebre y devoluciones cubiertos en 3 capas** — 26 PASS / 0 FAIL |

---

## 1. Veredicto

**El fix hace lo que el cliente pidió.** El campo Despacho pasó de mostrar únicamente
la última factura a **consolidar todas las facturas de la última fecha facturada**, y los
productos no facturados ese día muestran **0** en lugar de quedar fuera.

| Criterio del encargo | Resultado |
|---|---|
| Consolidar **todas** las facturas de la última fecha | ✅ **PASA** — 4 productos que valían 0 ahora traen su cantidad real |
| No romper lo que ya funcionaba | ✅ **PASA** — los 2 productos de control quedaron idénticos |
| Producto sin factura ese día ⇒ **0**, ni vacío ni omitido | ✅ **PASA** |
| Si el producto está en varias facturas del día, **sumar** | ⚪ **NO EJERCITABLE** — ver §5.1 |
| Cambio x cambio sigue alimentando el sugerido | ✅ **PASA** — 4/4 exactos (§8.b) |
| **Quiebre de inventario (cantidad 0 al inventariar)** | ✅ **PASA** — ver §8.d.2 *(el 1.er intento fue erróneo: §8.c)* |
| Devolución de **Calidad NO resta** del sugerido | ✅ **PASA** — §8.d.1 |
| Devolución de **Distribución SÍ resta** | ✅ **PASA** — §8.d.1 |
| Las cantidades **negativas** se siguen rechazando | ✅ **PASA** — §8.d.3 |
| Agotado **con rotación** genera reposición en el sugerido | ✅ **PASA** — §8.d.2 |

---

## 2. Qué cambió el fix (lectura del código)

`src/app/services/inventarios/inventarios-logic.service.ts`, método
`getInvoiceDetailUnitsFromLastClientInvoice`. Dos cambios:

**a) El criterio de selección de facturas pasa de UNA a TODAS las del día:**

```diff
- "AND inv.id_invoice = (" +
-   "SELECT id_invoice FROM invoices " +
+ "AND substr(inv.da_invoice, 1, 10) = (" +
+   "SELECT substr(da_invoice, 1, 10) FROM invoices " +
     "WHERE id_client = ? AND id_address_client = ? " +
     "ORDER BY da_invoice DESC, id_invoice DESC LIMIT 1" +
   ")"
```

**b) Deduplica por `id_product_unit` SUMANDO las cantidades:**

```diff
- invoiceDetailUnits.push({ … quInvoice: item.qu_invoice … });
+ const existing = byProductUnit.get(idProductUnit);
+ if (existing !== undefined) { existing.quInvoice += item.qu_invoice; }
+ else { byProductUnit.set(idProductUnit, { … }); }
```

⚠ La consulta filtra por **`id_client` Y `id_address_client`**: la consolidación es
por **cliente + sucursal**, no por cliente solo. El oráculo se construyó con ese filtro.

---

## 3. El escenario: por qué este cliente prueba el fix

**Cliente `209` — EXCELSIOR GAMA SUPERMERCADOS (sucursal MACARACUAY)**
`id_client=165` · `id_address_client=780`

Su última fecha facturada, **23/07/2026**, tiene **dos facturas**:

| Factura | Rol bajo el bug |
|---|---|
| `20115667` (id 3828) | **ganaba** el desempate `ORDER BY da_invoice DESC, id_invoice DESC` |
| `20115666` (id 3827) | **se descartaba entera** |

⇒ Los 8 productos que solo estaban en la 20115666 mostraban **Despacho 0**.
Esto no es una hipótesis: quedó **medido y documentado** en nuestra corrida del
11/08 (`hidroponias_sugerido_20260811/movil-sugerido.md`, §4.1), donde
`GERPROGCH002BOL` y `GERPROALF002CAJ` dieron `dispatchedStock = 0`.

**Ese registro previo es la mitad «antes» de esta comparación.**

---

## 4. Medición — 7 productos, tolerancia 0

Se inventariaron 7 productos elegidos a propósito: 4 que el bug ocultaba, 2 de control
en la factura ganadora y 1 sin factura ese día.

El oráculo se calculó ejecutando **la consulta del fix contra la BD local del propio
dispositivo** (la misma que consulta la app), y el «antes» ejecutando la consulta vieja.

| Producto | Categoría | Stock tecleado | **Antes (bug)** | **Oráculo (fix)** | **Medido en app** | |
|---|---|---:|---:|---:|---:|---|
| GERPROALF002CAJ | GERMINADOS | 3 | **0** | 19 | **19** | ✅ |
| 046013ESP001BOL | FRESCALES | 2 | **0** | 13 | **13** | ✅ |
| MAL013PLS098MOR | AJO | 5 | **0** | 20 | **20** | ✅ |
| 046013461003BAN | BROCOLI | 4 | **0** | 7 | **7** | ✅ |
| CAMPROLEC001BAN | ENSALADAS | 1 | 5 | 5 | **5** | ✅ control |
| TOMPROCHE001CAJ | TOMATE CHERRY | 12 | 14 | 14 | **14** | ✅ control |
| 046013ACG002BOL | FRESCALES | 2 | 0 | 0 | **0** | ✅ sin factura ese día |

**Los 4 productos ocultos recuperaron su cantidad exacta. Los 2 de control no se movieron.
El no facturado muestra 0 y aparece en la lista.**

### Términos completos leídos del modelo

Los términos **no están en el DOM**: viven en
`ng.getComponent(document.querySelector('app-inventario-sugerido-preview')).productsSuggested[].unitsSuggested[]`.

| # | Producto | prev | **desp** | swap | inicial | actual | **devuelto** | vendido | diaria | sugerido |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | GERPROALF002CAJ | 3 | **19** | 0 | 22 | 3 | 0 | 19 | 0,9048 | 0 |
| 2 | 046013ESP001BOL | 0 | **13** | 0 | 13 | 2 | 0 | 11 | 0,5238 | 0 |
| 3 | MAL013PLS098MOR | 0 | **20** | 0 | 20 | 5 | 0 | 15 | 0,7143 | 0 |
| 4 | 046013461003BAN | 0 | **7** | 0 | 7 | 4 | 0 | 3 | 0,1429 | 0 |
| 5 | CAMPROLEC001BAN | 1 | **5** | 0 | 6 | 1 | **2** | 3 | 0,1429 | 0 |
| 6 | TOMPROCHE001CAJ | 12 | **14** | 0 | 26 | 12 | 0 | 14 | 0,6667 | 0 |
| 7 | 046013ACG002BOL | 0 | **0** | 0 | 0 | 2 | 0 | −2 | 0 | 0 |

**Lecturas laterales que confirma la tabla:**

- **La devolución de Distribución sigue restando** (#5, `devuelto = 2`): es la Ref 106
  creada en la corrida del 11/08 (CAMPROLEC001BAN ×2, Distribución). El fix no la tocó.
- **La guarda de venta negativa sigue viva** (#7): vendido `−2` ⇒ diaria `0`, sin excepción.
- **`sugerido = 0` en los 7** porque `daysUntilNext` quedó en **1** (no se tecleó) y en
  todos los casos el stock actual supera al sugerido bruto. **No es un hallazgo**: es la
  guarda `currentStock >= sugerido ⇒ 0` operando. Para ver sugeridos > 0 hay que teclear
  un `daysUntilNext` mayor.

---

## 5. Lo que NO se pudo probar, y por qué

### 5.1 ⚪ La SUMA de un producto repetido entre facturas del mismo día

El fix implementa la suma (`existing.quInvoice += item.qu_invoice`), pero **no hay dato
en la base que la ejercite**. Se consultó la BD completa:

> Ningún cliente de hidroponias —ni dentro ni fuera de la cartera del vendedor— tiene
> **el mismo producto en dos facturas de la misma fecha**. Cero casos.

⇒ La rama existe en el código y está bien escrita, pero **su comportamiento no se
observó**. Para cubrirlo hace falta que alguien genere dos facturas del mismo día con
un producto repetido.

### 5.2 ✅ Cambio x cambio — **cubierto con el cliente 105** (ver §8.b)

En el 209 los swaps son del **04/08** y su último inventario del **11/08** (lo dejó
nuestra corrida anterior): quedan fuera de ventana y `swap = 0` en los 7 productos.
**Es correcto, no es defecto** — pero deja el término sin medir.

Se cerró con un **segundo ciclo sobre el cliente `105`**, el único de la cartera cuyo
último inventario (03/08 15:13) es anterior a sus swaps (04/08).

### 5.3 ✅ Quiebre de inventario — validado en §8.d.2 tras la retractación de §8.c

Ver la retractación completa en §8.c. El REQ es teclear **cantidad 0 al inventariar** y que
ese 0 **persista**; aquí se midió agregar a un pedido un producto sin stock de almacén.

### 5.4 ✅ Devolución de Calidad — **cubierta en §8.d.1**

*(Lo que sigue describe el estado ANTES de rehacer el ciclo.)*

#### Redacción original

El contraste Distribución-sí / Calidad-no quedó **medio cubierto**: se confirmó que la
Distribución resta (#5). La Calidad no se ejercitó porque el producto de la Ref 107
(`TOMPROMAN001BAN`) no entró en esta lista de inventario. En el ciclo del 11/08 quedó
confirmado con dos evidencias independientes.

---

## 6. Alcance del fix: qué NO cambió (verificado)

**DEVOLUCIONES no se ve afectado, y está bien así.** Se abrió una devolución para el 209:

- El selector ofrece **las 4 facturas** del cliente (las 2 del 13/07 y las 2 del 23/07)
- Al elegir la `20115667`, lista **exactamente sus 6 productos**

Es correcto: en devoluciones se devuelve contra **una factura concreta**, no contra el
día. La consulta del despacho y la de devoluciones son independientes.

---

## 7. El sugerido genera unidades y llega a pedido enviado

La primera medición dio **sugerido 0 en los 7 productos**. No era un fallo: con
`daysUntilNext = 1` (el valor por defecto, que el formulario trae sin tocar) el sugerido
bruto queda por debajo del stock actual en todos los casos, y la guarda
`currentStock >= sugerido ⇒ 0` los apaga a todos.
*(Captura `01-sugerido-dias1-todos-cero.png`.)*

Se tecleó **`Días para siguiente Inventario = 10`** y el sugerido cobró vida:

| # | Producto | diaria | × 10 | **SUGERIDO** | actual | Qué prueba |
|---|---|---:|---:|---:|---:|---|
| 1 | GERPROALF002CAJ | 0,9048 | 9,048 | **9** | 3 | redondeo hacia abajo |
| 2 | 046013ESP001BOL | 0,5238 | 5,238 | **5** | 2 | redondeo hacia abajo |
| 3 | MAL013PLS098MOR | 0,7143 | 7,143 | **7** | 5 | redondeo hacia abajo |
| 4 | 046013461003BAN | 0,1429 | 1,429 | **0** | 4 | guarda `actual > sugerido` |
| 5 | CAMPROLEC001BAN | 0,1429 | 1,429 → 1 | **0** | **1** | 🔑 **guarda por IGUALDAD** (1 vs 1) |
| 6 | TOMPROCHE001CAJ | 0,6667 | 6,667 → 7 | **0** | 12 | guarda `actual > sugerido` |
| 7 | 046013ACG002BOL | 0 | 0 | **0** | 2 | venta negativa ⇒ diaria 0 |

*(Captura `02-sugerido-dias10-con-unidades.png`.)*

**El sugerido llegó íntegro al pedido**, con las 3 líneas de sugerido > 0 y excluyendo
las de 0 — verificado en el carrito y luego en la nube:

| Producto | Sugerido | `qu_order` en la nube |
|---|---:|---:|
| GERPROALF002CAJ | 9 | **9** ✅ |
| 046013ESP001BOL | 5 | **5** ✅ |
| MAL013PLS098MOR | 7 | **7** ✅ |

---

## 8. Quiebre de inventario — producto con stock 0

**Producto:** `046013HIR01BOL` — HIERBABUENA BOLSA 30GRS (E), **`qu_stock = 0`**
en la tabla local `stocks`. VGs: `stock0=true`, `hideStock0=false`, `validStock=false`.

| Comprobación | Resultado |
|---|---|
| ¿El producto se lista pese a tener inventario 0? | ✅ **Sí**, aparece en FRESCALES |
| ¿El panel del producto **expande**? | ✅ **Sí** — 1 input de cantidad visible |
| ¿Dispara alguna alerta de bloqueo? | ✅ **No**, ninguna |
| ¿Entra al carrito? | ✅ **Sí** — el carrito pasó de 3 a **4 líneas**, `046013HIR01BOL × 3` |

*(Captura `04-quiebre-stock0-en-pedido.png`.)*

⚠ **Contraste con otras playas:** en `alipascua` está documentado que con `stock0=false`
un producto con Inventario 0 **no abre su panel y no avisa** — se lee como «el ítem no
responde». Aquí, con `stock0=true`, abre y se carga sin fricción. **El comportamiento es
el opuesto y correcto en ambos casos.**

⚠ **La línea de stock 0 NO llegó al pedido enviado** (ver §9): el pedido salió con 3
líneas. Queda demostrado que **la app permite agregarlo**, pero **falta ver esa línea
persistida en un pedido enviado**.

---

## 8.b Cambio x cambio — 2.º ciclo, cliente 105

**Cliente `105` — CENTRAL MADEIRENSE (CAFETAL)** · `id_client=111` · `id_address_client=726`
Último inventario **03/08 15:13** · swaps **04/08** ⇒ **dentro de ventana**.
`daysSinceLast = 29` (confirmado por la aritmética: 6 / 29 = 0,2069).

Se inventariaron los 4 productos con swap en ventana, con **cantidad 1** en todos para
forzar sugeridos > 0, y `daysUntilNext = 10`.

| Producto | prev | desp | **swap medido** | **swap oráculo** | inicial | actual | vendido | diaria | **SUG** | |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 046013461003BAN | 1 | 2 | **4** | 4 | 7 | 1 | 6 | 0,2069 | **2** | ✅ |
| CAMPROSDU002BOL | 0 | 5 | **1** | 1 | 6 | 1 | 5 | 0,1724 | **2** | ✅ |
| GERPROGCH002BOL | 3 | **0** | **2** | 2 | 5 | 1 | 4 | 0,1379 | 0 | ✅ 🔑 |
| HIDPROBER001ATA | 0 | **0** | **1** | 1 | **1** | 1 | 0 | 0 | 0 | ✅ 🔑 |

**Los 4 swaps coinciden con el oráculo, tolerancia 0.** Y los dos marcados 🔑 son los más
fuertes: tienen **despacho 0**, así que **el swap es el único término que alimenta el
stock inicial** — en `HIDPROBER001ATA` el inicial es exactamente el swap (1).

Comprobaciones de aritmética que caen de paso:
- `inicial = prev + desp + swap` en los 4 ✅
- `vendido = inicial − actual − devuelto` en los 4 ✅
- **Guarda por igualdad otra vez**: `GERPROGCH002BOL` → 0,1379 × 10 = 1,379 → 1, con
  actual **1** ⇒ sugerido **0** ✅

*(Captura `05-sugerido-105-swaps.png`.)*

**Cerró en pedido enviado:** Inventario **52** + Pedido **52**, con las 2 líneas de
sugerido > 0 (`046013461003BAN` ×2 y `CAMPROSDU002BOL` ×2). Secuencia de 4 alertas:
`¿Desea Enviar el pedido? [Cancelar/Aceptar]` → `Su Pedido será enviado [OK]` →
`Inventario nro. 52 enviado exitosamente [OK]` → `Pedido nro. 52 enviado exitosamente [OK]`.

---

## 8.c 🔴 RETRACTACIÓN — lo que llamamos «quiebre de inventario» NO era el REQ

**Esta sección corrige un error de la corrida. Lo que se probó no es la funcionalidad
que se creyó estar probando.**

### Qué dice realmente el REQ

El REQ «Quiebre de inventario (cantidad 0)», validado el **13/08 en DIFRANCA**
(`req-validados-qa/req-quiebre-inventario_20260813`), es sobre el **módulo de
INVENTARIOS**, y dice, textualmente:

> «Cuando el vendedor levanta el inventario en el punto de venta, necesita poder dejar
> constancia de que un producto **se agotó**. Antes esto no se podía: la aplicación
> **exigía una cantidad de 1 o más** […] **El cambio permite escribir 0 como cantidad
> válida**. De esa forma el producto agotado queda registrado en el inventario, con su
> lote y su fecha.»

Y su eje de prueba era **la persistencia**:

> «La aplicación tenía varios puntos internos donde **las líneas con cantidad cero o menos
> se descartaban** al volver a mostrar el inventario […] Por eso el eje de esta prueba fue
> la persistencia: guardar, salir [y reabrir].»

### Qué se probó aquí, en cambio

Se agregó **a un PEDIDO** un producto cuyo **stock de almacén** era 0. **Es otra cosa.**
Ni siquiera roza el REQ: en esta corrida las cantidades inventariadas fueron
**1, 2, 3, 4, 5 y 12** — **nunca se tecleó un 0**, que es justamente el corazón del
requerimiento.

### Consecuencia

| Afirmación anterior | Estado |
|---|---|
| «Quiebre de inventario ✅ PASS» | ❌ **RETIRADA** — se midió otra funcionalidad |
| «El producto con stock 0 entra al pedido (Pedido 53)» | ✅ el dato es correcto, pero **no prueba este REQ** |
| «No queda demostrado que sea `stock0` quien lo habilita» | irrelevante: la VG en juego no era ésa |

⇒ **El REQ de quiebre queda SIN VALIDAR en hidroponias.** Lo que sí sigue en pie es la
validación de DIFRANCA del 13/08, que lo probó correctamente.

### Cómo se prueba bien (pendiente)

1. Inventariar un producto con **Cantidad = 0**, con su **lote** y su **fecha de vencimiento**.
2. **Guardar**, salir del inventario y **reabrirlo** → el 0 debe seguir ahí, no desaparecer.
3. **Enviar** y verificar en la web que el detalle **muestra la línea en cero** con su
   ubicación, lote y fecha.
4. Comprobar que **las cantidades negativas se siguen rechazando**.
5. 🔑 **El punto que conecta con este informe:** que un producto agotado **con rotación**
   genere la **reposición esperada en el pedido sugerido**.

---

## 8.d ✅ CICLO COMPLETO — devoluciones y quiebre, esta vez con el REQ leído

Tras la retractación de §8.c se rehízo el ciclo **cubriendo los escenarios que faltaban**.
Cliente **209**, `daysSinceLast = 1` (el inventario anterior es de ayer), `daysUntilNext = 10`.

### 8.d.1 — Calidad vs Distribución: el contraste que faltaba

Se crearon **dos devoluciones sobre productos distintos** del mismo cliente y factura, para
poder leer su efecto por separado en el mismo sugerido:

| Devolución | Tipo | Producto | Cant. | `devuelto` medido | Esperado | |
|---|---|---|---:|---:|---|---|
| **108** | **Distribución (61)** | CAMPROSDU002BOL | 2 | **2** | resta | ✅ |
| **109** | **Calidad (60)** | TOMPROMAN001BAN | 3 | **0** | **NO resta** | ✅ |

**Es la prueba limpia:** misma corrida, mismo cliente, mismo formulario. La de Distribución
descuenta sus 2 unidades del cálculo; la de Calidad **no descuenta nada**, y se ve en la
aritmética:

```
CAMPROSDU002BOL   vendido = 15 − 2 − 2 = 11    ← el 2 de la Distribución SÍ entra
TOMPROMAN001BAN   vendido =  5 − 2 − 0 =  3    ← si Calidad restara, sería 0
```

El mecanismo real es `return_category.subtract_suggestion`, verificado en la BD del device:
Calidad → `'false'` · Distribución → `'true'`.

### 8.d.2 — Quiebre de inventario: el REQ, ahora sí

| Paso | Resultado |
|---|---|
| Teclear **Cantidad = 0** al inventariar `CAMPROLEC002BAN` | ✅ **aceptado** |
| **Guardar** → la línea en la BD local | ✅ `qu_stock = 0`, junto a las otras 2 |
| **Salir y reabrir** el inventario Guardado | ✅ el modelo trae **las 3 líneas**, la del 0 incluida |
| **Enviar** → llegada a la nube (Inventario **53**) | ✅ `CAMPROLEC002BAN 0.00` en `client_stock_detail_unit` |
| **Cantidad negativa (−1)** | ✅ **RECHAZADA** — ver 8.d.3 |

🔑 **Y el punto que conecta los dos REQ:** `CAMPROLEC002BAN` está **agotado (actual 0) pero
con rotación (despacho 7)**, y el sugerido le calculó **reposición 70** (7 × 10 días). Es
exactamente el escenario que el REQ de quiebre pedía comprobar: *«un producto agotado con
rotación genera la reposición esperada en el pedido sugerido»*.

### 8.d.3 — Los negativos siguen rechazados

Bajar el mínimo a cero **no abrió la puerta a valores negativos**:

- El input de cantidad declara **`min="0"`** — el piso es 0, no negativo.
- Al intentar aceptar con `−1`, la app responde
  **«Complete cantidad, unidad, fecha y lote para continuar.»**
- **El modal no se cierra** y **no se agrega ninguna línea** (`clientStockDetail` = 0).

*(Capturas `07-sugerido-calidad-vs-distribucion.png` y `08-negativo-rechazado.png`.)*

### 8.d.4 — Registros del ciclo

| Ref | Tipo | Detalle | Nube |
|---|---|---|---|
| **108** | Devolución **Distribución** | Cliente 209 · CAMPROSDU002BOL ×2 · factura 20115667 | ✅ en `return_view` |
| **109** | Devolución **Calidad** | Cliente 209 · TOMPROMAN001BAN ×3 · factura 20115667 | ✅ en `return_view` |
| **53** | Inventario | 3 líneas, **una en cantidad 0** · días 1 / 10 | ✅ **BD-OK**, el 0 incluido |
| **54** | Pedido (desde el sugerido) | 3 líneas — 110 / 70 / 30 | ✅ **BD-OK** |

ℹ **Para el cotejo de devoluciones usar `return_view`**, que trae la vista completa con
cliente, producto y empresa. Es la fuente con la que se verificaron las Refs 108 a 111.

---

## 8.e Control de aislamiento — cada término trae lo de ESE cliente

La consulta del fix filtra por `id_client` **y** `id_address_client`. Para probar que el
aislamiento es real —y no solo estar en el código— se comparó lo medido contra **dos
oráculos**: el acotado al cliente y el que **no filtra por cliente**.

| Término | Producto | Acotado | **Sin filtrar** | Medido | |
|---|---|---:|---:|---:|---|
| **Despacho** (209 / suc. 780) | `GERPROALF002CAJ` | **19** | 214 | **19** | ✅ |
| **Cambio x cambio** (105 / suc. 726) | `046013461003BAN` | **4** | 22 | **4** | ✅ |

La diferencia es demasiado grande para confundirse: **la app trajo el valor acotado**.

**Devoluciones:** la discriminación por tipo está demostrada en productos distintos (§8.d.1) y
sobre un **mismo producto** (§8.g), y el tipo se confirma en la web.

---

## 8.g C11 — Las dos devoluciones sobre el MISMO producto

El contraste de §8.d.1 usó productos distintos, uno por tipo. Faltaba el caso en que **un mismo
producto tiene las dos**. Se montaron ambas sobre `CAMPROLEC001BAN`, en la misma ventana:

| Ref | Tipo | Producto | Cant. |
|---|---|---|---:|
| **110** | **Distribución (61)** | `CAMPROLEC001BAN` | 2 |
| **111** | **Calidad (60)** | `CAMPROLEC001BAN` | 3 |

```
Si sumara ambas   → Devuelto = 5   (y la venta daría −1, imposible)
Solo Distribución → Devuelto = 2

Medido: Devuelto = 2  ✅   venta = 5 − 1 − 2 = 2
```

El campo de pantalla lo nombra literalmente: **«Dev. Distribución: 2»**. La de Calidad está
creada, enviada y en ventana, y **no entra en el cálculo**.
*(Captura `15-mismo-producto-dos-devoluciones.png`.)*

---

## 8.f Verificación en las TRES capas

| Registro | Móvil (BD local) | Nube (BD) | **Web (interfaz)** |
|---|---|---|---|
| Inventario 51 · cliente 209 · 7 productos | ✅ enviado | ✅ 7 líneas | ✅ **Enviado** |
| Inventario 52 · cliente 105 · 4 productos | ✅ | ✅ 4 líneas | ✅ **Enviado** |
| **Inventario 53 · una línea en 0** | ✅ `qu_stock 0` | ✅ `0.0000` | ✅ **`0.00 UNIDAD`** |
| Inventario 54 · cliente 211 · 5 productos | ✅ | ✅ 5 líneas | ✅ **Enviado** |
| Pedidos 51 a 55 | ✅ los 5 | ✅ los 5 | ✅ **los 5, Enviado** |
| **Devoluciones 108 a 111** | ✅ las 4 enviadas | ✅ en `return_view` | ✅ **las 4, con su tipo** |

### Devoluciones en la web

Las cuatro figuran en `/pages/devoluciones` como **Enviado**, y el detalle confirma **el tipo**,
que es el dato que gobierna el cálculo. Sobre el par del caso C11 —mismo producto:

| Ref | Tipo en la web | Producto | N° Factura | Cantidad |
|---|---|---|---:|---:|
| **110** | **Distribución** | `CAMPROLEC001BAN` | 20115667 | 2 |
| **111** | **Calidad** | `CAMPROLEC001BAN` | 20115667 | 3 |

*(Capturas `16-web-devolucion-110-distribucion.png` y `17-web-devolucion-111-calidad.png`.)*

### 🔑 El riesgo web del REQ de quiebre: descartado

El REQ señalaba que la web podía **filtrar las líneas en cero**. **No las filtra.** El detalle
del Inventario 53 en `/pages/detalleInventario` muestra las tres:

```
1  CAMPROSDU002BOL  MAIZ SUPER DULCE BANDEJA    Exhibición: 2.00 UNIDAD
1  CAMPROLEC002BAN  ENSALADA LECHUGA MIXTA      Exhibición: 0.00 UNIDAD   ← el quiebre
1  TOMPROMAN001BAN  TOMATE MANZANO EN BANDEJA   Exhibición: 2.00 UNIDAD
```

Y el **Pedido 55** en `/pages/detallePedido` trae sus 5 líneas con **7 · 6 · 9 · 14 · 10**,
exactamente lo que calculó el sugerido.

⚠ **Acceso:** el inventario de playas daba a **Caribe fuera de servicio** desde el 13/08.
**Hoy responde con normalidad** — actualizar esa nota en `automation/web/playas.yaml`.
Consulta hecha en modo **solo lectura**: únicamente `Consultar` y navegación.

---

## 9. Incidencia de la corrida: la app se reinició al pulsar Enviar

Al pulsar Enviar en el pedido generado desde el sugerido —con la línea de stock 0 ya
agregada— **la app se reinició**: el PID del WebView cambió (11723 → 19611) y la conexión
CDP se cayó.

| Comprobación | Resultado |
|---|---|
| `FATAL` / `AndroidRuntime` en logcat | **Ninguno** |
| Proceso tras el evento | **Vivo**, con PID nuevo; sesión de `vendedor4` intacta |
| Estado que quedó | Inventario **Guardado** (`st_delivery=3`), **sin pedido** |
| Colas | `pending_transactions` 0 · `failed_transactions` 0 — **no quedó basura** |

**No se pudo determinar la causa** y **no se reproduce con evidencia**: sin traza en el
log, no hay base para llamarlo defecto. Se registra como **incidencia observada una vez**.

⚠ Al reiniciarse, **el carrito en memoria se perdió** y con él la línea de stock 0. El
pedido que finalmente se envió se rearmó desde el sugerido con sus 3 líneas.

**El envío lo completó la QA a mano** tras el reinicio, sobre el borrador que había
quedado.

---

## 10. Registros creados en sistema

| Ref | Tipo | Detalle | Local | Nube |
|---|---|---|---|---|
| **51** | Inventario | Cliente 209 / sucursal 780 · 7 productos · días **21 / 10** | `st_delivery=1` | `st_client_stock=1` · `id_order=51` ✅ **BD-OK** |
| **51** | Pedido (desde el sugerido) | Cliente 165 / sucursal 780 · **3 líneas** (9 / 5 / 7) | `st_delivery=1` | `st_order=1` · `nu_details=3` ✅ **BD-OK** |
| **52** | Inventario | Cliente 105 (111) / sucursal 726 · 4 productos · días **29 / 10** | ⚠ `st_delivery=2` | `st_client_stock=1` · det=4 · `id_order=52` ✅ **BD-OK** |
| **52** | Pedido (desde el sugerido) | Cliente 111 / sucursal 726 · **2 líneas** (2 / 2) | `st_delivery=1` | `st_order=1` · `nu_details=2` ✅ **BD-OK** |
| **53** | Pedido (quiebre de stock) | Cliente 111 · **1 línea**: `046013ESP003BOL` ×2, stock **0** | `st_delivery=1` | `st_order=1` ✅ **BD-OK** |

⚠ **A vigilar:** el inventario **52** quedó localmente en `st_delivery = 2` y con una fila
en `pending_transactions`, **pese a que la app anunció «Inventario nro. 52 enviado
exitosamente» y el registro SÍ llegó íntegro a la nube** (`st_client_stock=1`, 4 detalles).
**No hay pérdida de dato**, pero la cola local no se limpió. Conviene mirar si se resuelve
sola en la siguiente sincronización o si puede provocar un reenvío duplicado.
`failed_transactions` **0** en todo momento.

🔑 **El inventario queda ligado al pedido que generó**: `client_stock.id_order = 51`.
Confirma la nota de la corrida del 11/08 de que enviar el pedido del sugerido arrastra
también el inventario.

**No se creó ninguna devolución en esta corrida** (ver §5.4).

---

## 10.b Casos ejecutados

| ID | Caso | Resultado |
|---|---|---|
| SUG-F-001 | Guarda de tenant y VG `suggestedOrderByDispatchAndReturn` | ✅ PASS |
| SUG-F-002 | **Despacho consolida TODAS las facturas de la última fecha** | ✅ **PASS** (4 productos 0 → cantidad real) |
| SUG-F-003 | **No rompe lo que ya funcionaba** (factura ganadora) | ✅ PASS (2 controles idénticos) |
| SUG-F-004 | **Producto sin factura ese día ⇒ 0**, ni vacío ni omitido | ✅ PASS |
| SUG-F-005 | Suma de un producto repetido entre facturas del día | ⚪ **NO EJERCITABLE** — no existe el dato |
| SUG-F-006 | Devolución de **Distribución RESTA** del sugerido | ✅ PASS (`devuelto = 2`) |
| SUG-F-007 | Devolución de **Calidad NO resta** | ⚪ no ejercitada esta vuelta *(confirmada el 11/08)* |
| SUG-F-008 | **Cambio x cambio (`straightSwapStock`) en ventana** | ✅ **PASS** — 4/4 exactos en el cliente 105, 2 de ellos con el swap como ÚNICO aporte |
| SUG-F-009 | `daysSinceLast` calculado, no tecleado | ✅ PASS (21, persistido) |
| SUG-F-010 | `daysUntilNext` tecleado se respeta | ✅ PASS (10, persistido local y nube) |
| SUG-F-011 | **Sugerido > 0 con la aritmética exacta** | ✅ PASS (9 / 5 / 7) |
| SUG-F-012 | Guarda `currentStock >= sugerido ⇒ 0`, **incluida la igualdad** | ✅ PASS (1 vs 1) |
| SUG-F-013 | Guarda de venta negativa ⇒ diaria 0 | ✅ PASS |
| SUG-F-014 | **Sugerido → líneas del pedido** (los 0 excluidos) | ✅ PASS |
| SUG-F-015 | ~~Quiebre de inventario (1.er intento)~~ | ❌ **RETIRADO** — lo medido no era el REQ (§8.c) |
| SUG-F-020 | **Quiebre: cantidad 0 aceptada al inventariar** | ✅ PASS |
| SUG-F-021 | **El 0 PERSISTE al guardar y reabrir** | ✅ PASS |
| SUG-F-022 | **El 0 llega a la nube** (Inventario 53) | ✅ PASS |
| SUG-F-023 | **Cantidad negativa rechazada** (`min=0` + alerta) | ✅ PASS |
| SUG-F-024 | **Devolución de Distribución RESTA** | ✅ PASS (`devuelto = 2`) |
| SUG-F-025 | **Devolución de Calidad NO resta** | ✅ PASS (`devuelto = 0`) |
| SUG-F-026 | **Agotado con rotación → reposición en el sugerido** | ✅ PASS (0 actual, despacho 7 ⇒ sugerido 70) |
| SUG-F-027 | **Ambas devoluciones en el MISMO producto: solo resta Distribución** | ✅ PASS (devuelto 2, no 5) |
| SUG-F-028 | **Verificación en la capa WEB** (inventarios y pedidos) | ✅ PASS |
| SUG-F-016 | Producto con stock 0 de almacén entra a un pedido enviado | ✅ PASS (Pedido 53) — **dato válido, pero ajeno al REQ de quiebre** |
| SUG-F-019 | Sugerido → pedido enviado, 2.º ciclo (cliente 105) | ✅ PASS (Inventario 52 + Pedido 52) |
| SUG-F-017 | Pedido enviado y cotejado en nube | ✅ PASS (Ref 51, BD-OK) |
| SUG-F-018 | Inventario ligado al pedido (`client_stock.id_order`) | ✅ PASS |

**26 PASS · 0 FAIL · 1 RETIRADO (rehecho bien en §8.d) · 1 no ejercitado (sin dato en la base) · 1 incidencia sin causa · 3 puntos a vigilar.**

---

## 11. Patrones nuevos para el guion (levantados en esta corrida)

| Patrón | Detalle |
|---|---|
| 🔴 **El botón «Pedido Sugerido» vive en la pestaña RESUMEN** | No está en INVENTARIO. Buscarlo desde la pestaña de carga devuelve `[]` botones y se lee como «la VG no rinde». |
| 🔴 **El árbol del Tab Inventario tiene DOS niveles y el buscador solo filtra DENTRO de una categoría** | En el nivel superior (13 categorías) escribir no filtra nada. Y si el guion se queda dentro de una categoría, **todas** las búsquedas siguientes se limitan a ella y devuelven 0 ⇒ se lee como «el producto no existe en el catálogo». Hay que **subir con `ion-icon[name=arrow-back-outline]` antes de cada búsqueda**. |
| 🔴 **El modal de cantidad se acepta con el ✓ del encabezado** | `ion-icon[name="checkmark-outline"]`, no un `ion-button` con texto. Buscar «Aceptar» devuelve null, el modal queda abierto y su backdrop **se come todos los clics posteriores**: el módulo pasa a «no tiene botones». |
| **Mapa categoría → productos (hidroponias, 13 categorías)** | AJO 4 · BERRO 3 · BROCOLI 2 · CEBOLLIN 2 · ENSALADAS 8 · FRESCALES 7 · FRUTAS 1 · GERMINADOS 5 · HONGOS 1 · LECHUGAS 3 · MAIZ 2 · TOMATE CHERRY 2 · TOMATES 4. ⚠ **No coincide con `product_structures`** (que agrupa en HV/FRESCALES): la UI pinta otro nivel. |
| **El código del producto va al FINAL del texto del ítem** | `"ESPINACA BOLSA 300GRS. (E)Código: 046013ESP001BOL"`. Un regex que exija «Precio» detrás **no matchea nunca** en inventarios. |
| **El input de factura de devoluciones es `#invoiceSelect`** | En inglés. Buscarlo por «factura» devuelve null. |

---

## 12. Defectos nuevos

**Ninguno.** El fix cumple los tres criterios verificables del encargo y no rompió el
comportamiento previo.

**Punto de atención para desarrollo (no defecto):** la consulta compara fechas con
`substr(da_invoice, 1, 10)`, es decir, como **texto**. Funciona porque `da_invoice` se
almacena en formato ISO (`YYYY-MM-DD…`) en la BD local. Si algún día una sincronización
guardara la fecha con otro formato, la comparación fallaría en silencio y el despacho
volvería a quedar incompleto — sin error visible. **Es una fragilidad, no una falla.**
