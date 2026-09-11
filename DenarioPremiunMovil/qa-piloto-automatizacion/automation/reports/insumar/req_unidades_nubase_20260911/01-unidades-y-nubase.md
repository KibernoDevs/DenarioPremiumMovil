# INSUMAR · `nu_base` / `nu_base_total` y selector de unidades

- **Corrida:** `req_unidades_nubase_20260911` · 11/09/2026, 12:40–13:05 (hora del equipo)
- **Tenant:** `INSUM_A` · INSUMAR DISTRIBUIDORA 715, C.A. (RIF J405405333) — **única** empresa en `enterprises`
- **Usuario:** `R003` · EVA MEDINA (`idUser` 22)
- **App:** `com.kiberno.denarioPremiumPro` v **6.6.21.3** · `db_version` 23 · `window.ng` disponible
- **Playa observada en runtime:** `http://denarioelyaque.ddns.net:8081/PremiumWS` (EL YAQUE) — descubierta en el POST del envío; no se guarda en el perfil
- **Alcance:** solo móvil + BD. **No se entró a la web.** **No se conmutó ninguna VG.**

**Veredicto: A = PASS (5/5 filas, tolerancia 0). B = PASS en lo que sí es medible, con un caso N/A por configuración.** 0 FAIL.

---

## Paso 0 · Variables globales leídas DEL EQUIPO

`node automation/playwright/leer-vg-dispositivo.js unit` — 6 de 183 claves:

| Clave | Valor en el equipo | Esperado por el REQ | |
|---|---|---|---|
| `userCanChangeUnits` | **`true`** | `true` | ✅ coincide |
| `unitByPriceList` | **`true`** | `false` | 🔴 **NO coincide** |
| `quUnitDecimals` | `true` | — | |
| `totalUnit` | `true` | — | |
| `codeTotalProductUnit` | `UND` | — | |
| `showTotalProductUnit` | `false` | — | |

Confirmado también en el componente vivo: `orderServ.unitByPriceList === true`, `orderServ.userCanChangeUnits === true`.

> ⚠ **`unitByPriceList` está en `true`, no en `false`.** Tal como advertía el encargo, **el selector de unidades queda deshabilitado por esa otra vía** y el punto B no puede probar `userCanChangeUnits`. Ver §B.
>
> ⚠ El perfil `automation/clientes/insumar.yaml` es de junio y **no trae ninguna de estas 6 claves**; además su `db_name: insumar_P1` está stale (ver §Base viva).

---

## A · `nu_base` y `nu_base_total` en `order_detail_unit`

### Fórmula acordada, verificada en el build que corre en el equipo

Extraída de `http://localhost/main.js` del propio dispositivo (no del repo):

```js
/** Base por 1 unidad de empaque: quUnit × precio (sin × quAmount). */
computeUnitBase(item, unit) {
  return (Number(unit.quUnit) || 0) * this.resolveUnitNuPriceForLineTotal(item, unit);
}
/** Total base de una unidad con la misma fórmula de `productSummary`. */
computeUnitBaseTotal(item, unit) {
  if (Number(unit.quAmount) <= 0) return 0;
  const billableQty = Number(unit.quAmount) || 0;
  return this.computeUnitBase(item, unit) * billableQty;
}
```

**No hay ninguna división por la cantidad** en el camino — que era el origen de las diferencias que reportó el consultor.

### Pedidos creados

| Ref (`id_order`) | `co_order` | Cliente | Total US$ | Enviado |
|---|---|---|---|---|
| **297** | `1789145111810.0` | ANIBAL JOSE RENGIFO JAIME (3551) | 244,2612 | ✅ |
| **298** | `1789145660961.0` | ANIBAL JOSE RENGIFO JAIME (3551) | 345,5872 | ✅ |

### Cotejo en las TRES capas · 5 filas de `order_detail_unit`

Precios de referencia (`price_lists` del equipo): lista `01` "Precio Unidad" ↔ **UND** (`qu_unit` = 1) · lista `02` "Precio Empaque" ↔ **BTO** (`qu_unit` = 12).

| Ref | `co_product_unit` | `qu_unit` | precio lista | `qu_order` | campo | modelo Angular | payload | SQLite local | **NUBE** | esperado |
|---|---|---|---|---|---|---|---|---|---|---|
| 297 | `010362UND` | 1 | 16,5532 | 3 | `nu_base` | 16,5532 | 16,5532 | 16,5532 | **16,5532** | 1 × 16,5532 ✅ |
| 297 | `010362UND` | 1 | 16,5532 | 3 | `nu_base_total` | 49,6596 | 49,6596 | 49,6596 | **49,6596** | 16,5532 × 3 ✅ |
| 297 | `010391BTO` | **12** | 8,1084 | 2 | `nu_base` | 97,3008 | 97,3008 | 97,3008 | **97,3008** | **12 × 8,1084** ✅ |
| 297 | `010391BTO` | **12** | 8,1084 | 2 | `nu_base_total` | 194,6016 | 194,6016 | 194,6016 | **194,6016** | 97,3008 × 2 ✅ |
| 298 | `010363UND` | 1 | 16,5532 | **7** | `nu_base` | 16,5532 | 16,5532 | 16,5532 | **16,5532** | 1 × 16,5532 ✅ |
| 298 | `010363UND` | 1 | 16,5532 | **7** | `nu_base_total` | 115,8724 | 115,8724 | 115,8724 | **115,8724** | 16,5532 × 7 ✅ |
| 298 | `010393BTO` | **12** | 8,5376 | 2 | `nu_base` | 102,4512 | 102,4512 | 102,4512 | **102,4512** | **12 × 8,5376** ✅ |
| 298 | `010393BTO` | **12** | 8,5376 | 2 | `nu_base_total` | 204,9024 | 204,9024 | 204,9024 | **204,9024** | 102,4512 × 2 ✅ |
| 298 | `010393UND` | 1 | 8,2708 | 3 | `nu_base` | 8,2708 | 8,2708 | 8,2708 | **8,2708** | 1 × 8,2708 ✅ |
| 298 | `010393UND` | 1 | 8,2708 | 3 | `nu_base_total` | 24,812399…97 | 24,812399…97 | 24,812399…97 | **24,8124** | 8,2708 × 3 ✅ |

**5/5 filas cuadran con tolerancia 0.**

Las capas son, textualmente:

- **Modelo Angular** — `ng.getComponent(document.querySelector('app-pedido')).orderServ.carrito`, leído antes de enviar (`subtotal` de la línea y `unitList[].quAmount` / `quUnit`).
- **Payload** — hook `Capacitor.nativePromise` sobre `CapacitorHttp.post`; **1 solo POST por pedido** a `.../orderservice/order`, campos `nuBase` / `nuBaseTotal`.
- **BD local** — `order_detail_units` del SQLite del equipo (`local-query.js`).
- **Nube** — `order_detail_unit` de la base `insumar` (`query.js`).

### Sobre los decimales (punto 3 del encargo)

El único caso duro es `010393UND`: `8,2708 × 3`. En JS IEEE-754 eso da `24.812399999999997`, y ese float viaja tal cual por el payload y se guarda así en el SQLite local. La nube lo persiste en `numeric(29,4)` como **`24.8124`**, que es el producto decimal exacto.

**No hay arrastre de error**: `nu_base_total` = `nu_base` × `qu_order` a 4 decimales en las 5 filas. La línea que multiplica es `computeUnitBase(...) * billableQty`; **no se divide por la cantidad en ningún punto** del camino.

### El null del 28/08 NO se repite

Filas de `order_detail_unit` en la nube, por día del pedido:

| día | filas | filas con `nu_base` |
|---|---|---|
| **2026-09-11** (esta corrida) | 5 | **5** |
| 2026-08-28 | 4 | 0 |
| 2026-08-25 | 185 | 0 |
| 2026-08-24 | 247 | 0 |
| 2026-08-21 | 327 | 0 |

El corte es limpio: lo anterior al fix llegó con `nu_base` null; lo de hoy llega poblado. **El hallazgo que se temía (que siguiera llegando null) NO ocurre.**

### Higiene de la corrida

`pending_transactions` = 0 · `failed_transactions` = 0 · 0 pedidos locales con `st_delivery` ≠ 1 · sin `co_order` duplicados en la nube · `nu_details` = 2 en el 298. Sync **inmediata**, sin cola diferida.

---

## B · Selector de unidades con `userCanChangeUnits = true`

### 🔴 El caso, tal como está escrito, NO es ejecutable en esta configuración

En los 4 productos que se abrieron, el panel expandido trae 3 `ion-select`:

| # | Select | Opciones | `disabled` |
|---|---|---|---|
| 1 | **Lista de Precio** | `Precio Unidad - UNIDADES` / `Precio Empaque - BULTO` | **`false`** (habilitado) |
| 2 | **Unidad** | `UNIDADES` / `BULTO` | **`true`** (deshabilitado) |
| 3 | Almacén | `ALMACEN 01` / … | `true` |

El motivo está en el build que corre en el equipo (`main.js`):

```js
/** Selector de unidad OFF si unitByPriceList o userCanChangeUnits=false. */
get disableUnitSelector() {
  return this.unitByPriceList || !this.userCanChangeUnits;
}
```

Con `unitByPriceList = true`, **el selector "Unidad" se apaga aunque `userCanChangeUnits` valga `true`**. Es el comportamiento diseñado, **no un defecto** — pero significa que **este caso no prueba `userCanChangeUnits`**: la variable no es observable en INSUMAR mientras `unitByPriceList` siga en `true`. Queda **N/A por configuración**, no PASS.

### Lo que sí se midió, y sí pasa

**El vendedor sí puede cambiar la unidad de cada producto** — por el select **Lista de Precio**, cuyas opciones están rotuladas con la unidad (`Precio Unidad - UNIDADES` / `Precio Empaque - BULTO`). Esa es la vía que habilita `unitByPriceList`.

1. **Se puede cambiar de UND a BTO** ✅ — `010391`: al elegir "Precio Empaque - BULTO", el select "Unidad" pasa de `UNIDADES` a `BULTO`.

2. **El precio y los totales se recalculan de forma coherente** ✅
   - Precio mostrado: `7,86 US$` (UND) → `97,30 US$` (BTO) = 12 × 8,1084.
   - Inventario: `11,00` (UND) → `0,92` (BTO) = 11 / 12.
   - **Caso fuerte, sobre una línea ya cargada** (`010393`): 3 UND cargadas (subtotal 24,8124) → se conmuta a BULTO → se cargan 2 BTO. Resultado: `subtotal` **229,7148** = 2 × 102,4512 + 3 × 8,2708; `totalEnUnidades` **27** = 2×12 + 3. El Tab Total lo desglosa: *"BULTO: 2 - Total Base: 204,90 US$"* y *"UNIDADES: 3 - Total Base: 24,81 US$"*, Total US$ 229,71.
   - **Al conmutar la unidad, las cantidades ya cargadas se conservan por unidad**: no se pierden ni se re-escalan. `unitList` mantiene `UND:3` y `BTO:2` en paralelo.

3. **El pedido se envía con la unidad elegida y llega así a la nube** ✅
   - Ref 297 → `order_detail_unit.co_product_unit = '010391BTO'`, `co_price_list = '02010391'`.
   - Ref 298 → una misma `order_detail` (`010393`) persiste como **dos filas**: `010393BTO` (`02010393`) y `010393UND` (`01010393`), cada una con su `qu_order`, `nu_base` y `nu_base_total` correctos.

### 🔴 NO se conmutó la variable

`userCanChangeUnits = false` queda **pendiente para otra corrida**, cuando la web esté libre, tal como se instruyó.

**Y hay que hacerla con `unitByPriceList = false`**, porque con `unitByPriceList = true` el selector está apagado en las dos ramas y la prueba no distingue nada: sería un caso que no puede fallar.

---

## 🔑 Qué base es la viva

**La base viva es `insumar`.** Respuesta cerrada, con evidencia directa:

1. `current_database()` resuelve a **`insumar`**.
2. Es **la única** que matchea: `SELECT datname FROM pg_database WHERE datname ILIKE '%insum%'` → una sola fila, `insumar`. **`insumar_P1`, el `db_name` que declara `automation/clientes/insumar.yaml`, NO EXISTE.** El YAML está stale en ese campo (probablemente de cuando el cliente estaba en otra playa); `query.js` acierta por la vía del DSN.
3. **Los dos pedidos de esta corrida aparecen ahí a los pocos segundos de enviarlos**: `id_order` 297 (`da_created` 16:52:20 UTC) y 298 (16:57:44 UTC), con `st_order = 1`, su `order_detail` y sus `order_detail_unit`.
4. `client.da_update` máximo = **2026-09-11 13:32 UTC** — los clientes efectivamente se actualizaron hoy en esta misma base.

**El hueco de pedidos desde el 28/08 no es un problema de ruteo: es falta de actividad.** La base recibe pedidos hoy, en el momento en que se envían. Los cotejos futuros de `insumar` pueden apoyarse en `insumar` con confianza.

> **Acción para el equipo (QA no toca secrets):** corregir `db_name` en `automation/clientes/insumar.yaml` (`insumar_P1` → `insumar`) y revisar el `QA_DB_URL` del bloque `# Cliente: insumar` de `secrets/qa-db.env` por si arrastra la base vieja.

---

## Lo que NO se pudo comprobar

- **`userCanChangeUnits = false`** — la otra mitad de la no-regresión. No se conmutó la VG por instrucción explícita (la web está ocupada). **Pendiente**, con la salvedad de que hay que bajar también `unitByPriceList` para que la prueba discrimine.
- **El selector "Unidad" habilitado** — no es observable en INSUMAR con `unitByPriceList = true`. Para probarlo hace falta un tenant con `unitByPriceList = false`, o bajar la VG en éste.
- **`nu_base_conversion` / `nu_base_total_conversion`** — viajan en el payload (p. ej. 12995,420724 y 38986,262172 para la línea UND del 297) y están en las tres capas, pero **no se cotejaron contra la tasa** porque el encargo no lo pedía. No se afirma nada sobre ellos.
- **Productos con `qu_unit` distinto de 1 y 12** — el catálogo de INSUMAR solo expone esas dos unidades con precio (`unit_pricelist` tiene exactamente 2 filas: BTO↔lista 02, UND↔lista 01). No hay caso de 3 unidades ni de `qu_unit` fraccionario.
- **Bonificación (`qu_bonified` / `nu_amount_bonus`)** — viajaron en 0 en las 5 filas; no se probó su interacción con `nu_base_total`. El comentario del build (`// REQ-01: base = Compra (quAmount); bonificado no se resta`) sugiere que ahí hay un caso que merece corrida propia.
- **`010392`** — el producto del escenario ideal **no es pedible**: `stocks.qu_stock = 0` y la app lo oculta ("No hay productos disponibles"). Se sustituyó por `010363` y `010393`, ambos con el mismo par UND(1)/BTO(12).

### ⚠ Observación que NO se levanta como defecto

Al pedir en **BTO**, el rótulo "Inventario" del panel del producto baja `qu_order / 12` en vez de `qu_order`: en `010391` pasó de `0,92` a `0,75` al cargar **2 BTO** (bajó 0,1667 = 2/12).

Es **solo display del panel**: no toca `nu_base`, ni los totales, ni lo que llega a la nube (verificado en las tres capas). **Podría ser mi método** — leí el rótulo entre dos renders. **Pide confirmación a mano** antes de abrir nada: cargar 2 BTO de un producto con stock conocido y mirar el rótulo Inventario.

---

## Para el script

Patrones de esta corrida que conviene volcar a `module-selectors/pedidos.md`:

1. **`insumar` monta el árbol de productos como `ion-accordion`** (`product-structure-title accordionPedidos`), variante El Yaque. El buscador `ion-icon[name="search-circle-sharp"]` → `input.search-input.inputsSearch` → código + `Enter` es la vía barata al SKU (5/5 sin fallo). ⚠ **matchea por substring**: `010393` devolvió también `0103931`…`0103934`; el acordeón correcto es el **primero**, pero hay que verificar el `Código:` antes de sellar.

2. **🔴 El panel expandido de INSUMAR tiene 3 selects, no 5** — `Lista de Precio` · `Unidad` · `Almacén`. Faltan `IVA` y `% Descuento` ⇒ `userCanSelectIVA = false` y `userCanSelectProductDiscount = false` sin provocar el comportamiento. **El mapa de 5 selects de `[alipascua-20260804]` no se cumple acá: contar selects, no asumir índices.**

3. **🔴 Con `unitByPriceList = true`, quien cambia la unidad es el select `Lista de Precio`, no el de `Unidad`.** Un guion que busque el select "Unidad" para conmutar UND↔BTO lo va a encontrar `disabled` y va a reportar un FAIL falso. Regla: **leer `unitByPriceList` ANTES de elegir por cuál select conmutar.**

4. **Un `disabled` puede venir de dos VGs distintas.** `disableUnitSelector = unitByPriceList || !userCanChangeUnits` ⇒ ver el select apagado **no** permite concluir `userCanChangeUnits = false`. Leer `disabled` sigue siendo el mapa de VGs de línea, pero **hay que cruzarlo con la config**, no interpretarlo solo. (Familia K##: se validaba presencia, no conformidad.)

5. **El modelo vivo se lee entero sin tocar la UI**: `ng.getComponent(document.querySelector('app-pedido')).orderServ.carrito` da `quAmount`, `nuPrice`, `idUnit`, `idList`, `subtotal`, `totalEnUnidades` y el `unitList[]` con `quUnit`/`quAmount` por unidad. **Es la 3.ª capa del cotejo y sale gratis.** `orderServ` también expone `unitByPriceList` y `userCanChangeUnits` ya resueltos a boolean.

6. **`window.ng` está disponible en esta build (6.6.21.3 / El Yaque)** ⇒ se puede leer cualquier componente. También se puede `fetch('http://localhost/main.js')` **desde la propia página** y grepear el build que realmente corre: así se confirmaron `computeUnitBase` y `disableUnitSelector` sin abrir `../src/`. Vale como evidencia de "qué hace la versión que tengo delante".

7. **Una `order_detail` puede tener 2 `order_detail_unit`** (mismo producto en UND y en BTO). El cotejo tiene que casar por **`co_order_detail_unit`**, no por `co_product_unit` ni por `co_order_detail`. Confirma `[grupo_fiel-2026-08-17]`.

8. **Cantidades conservadas por unidad**: conmutar la lista/unidad **no** mueve la cantidad ya cargada a la unidad nueva — queda en la vieja, y `item.quAmount` pasa a 0 hasta que se teclea la cantidad de la unidad nueva. Un guion que conmute y lea `quAmount` sin teclear va a leer 0 y concluir "se perdió la cantidad". **Leer `unitList[]`, no `quAmount`.**

9. **`hideStock0` está activo**: un producto con `stocks.qu_stock = 0` no aparece en la búsqueda ("No hay productos disponibles"). **Verificar stock en la BD local antes de elegir el SKU del escenario**, o el guion se cuelga buscando un producto que la app oculta.

10. **Cliente sin deuda** (`Saldo US$: 0,00`, p. ej. ANIBAL JOSE RENGIFO JAIME / 3551) evita el modal "Este cliente tiene deuda vencida" y ahorra un paso frágil. Alta del pedido: HOME → `p.nombreModulos`[Pedidos] → `ion-button.colorBorderBuscar`[PEDIDO] → `#clienteSelect` → buscar → `ion-item` del cliente.

11. **Ref UI = `id_order`**: la alerta final dice *"Pedido nro. 297 enviado exitosamente"* y coincide con `id_order` en local y en nube. Reconfirma el patrón.

12. **Oráculo de `nu_base` sin mirar la nube**: `price_lists` ⋈ `lists` ⋈ `product_units` del SQLite local da el precio y el `qu_unit` esperados **antes** de armar el pedido ⇒ se puede predecir `nu_base` y `nu_base_total` y comparar, en vez de leer la nube y "ver si tiene sentido".
