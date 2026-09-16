# INSUMAR · REQ «Selector de una Unidad por defecto»

| | |
|---|---|
| **Corrida** | `req_unidad_defecto_20260915` · 15/09/2026, 13:10–14:00 (hora del equipo) |
| **Tenant** | `INSUM_A` — INSUMAR DISTRIBUIDORA 715, C.A. (empresa única) · base `insumar` |
| **Playa observada en runtime** | **EL YAQUE** — web `denarioelyaque.ddns.net:8080/DenarioPremium` |
| **Móvil** | `com.kiberno.denarioPremiumPro`, vendedor **`r013` (VIVIANA ESCALANTE, `idUser` 4)** · `window.ng` disponible · CDP `127.0.0.1:9220` |
| **Web** | `admin`, bloque **`# USUARIO WEB ISLA COCHE (HIDROPONIAS) / EL YAQUE`** |
| **Cliente de prueba** | `1976` ABASTOS BRISAS DEL VALLE 95 (saldo 0,00 ⇒ sin alerta de deuda vencida) |
| **Escrituras** | **1 sola**: `userCanChangeUnits` SÍ→NO (13:37) y NO→SÍ (13:43). **Ya restituida.** Anotada en `automation/clientes/_escrituras-de-prueba.md` |
| **Transacciones creadas** | **Ninguna.** Todo se montó para medir y se salió con «Salir sin guardar» (`returns` = 0 filas, 0 `orders` con fecha de hoy) |

---

# Veredicto

## 🔴 El paso 1 no se pudo montar: `unitByPriceList` **no es conmutable** en INSUMAR

`unitByPriceList` tiene **`editable = false`** en `global_configuration`, y la pantalla
`Empresa › Variables de configuración` **solo dibuja las filas `editable = true`** — 38 de 51 en el
grupo Pedidos, y la cuenta cuadra exacta con las 38 filas renderizadas. La pregunta *«¿Desea
seleccionar las Unidades según Lista de Precio?»* **no existe en esa pantalla**. No se intentó por
SQL (escrituras prohibidas).

⇒ **La rama que el REQ quiere probar —`unitByPriceList = NO`— queda sin ejercer.** Hace falta que
desarrollo marque esa variable como editable, o un tenant que ya la tenga en `false`.

## Lo que sí se midió responde las dos preguntas centrales del REQ

| Pregunta del encargo | Respuesta medida |
|---|---|
| ¿Pedidos respeta la unidad **por defecto de cada producto**? | ✅ **Sí.** `0201225` queda en **BULTO**, `010362` queda en **UNIDADES**. **No caen los dos en la misma unidad** ⇒ el módulo **no** está fijando una unidad constante |
| ¿Devoluciones conserva **las dos** unidades con la variable en NO? | ✅ **Sí, y funcionando.** Selector habilitado, dos opciones, y el cambio **prende de verdad** |
| ¿Los precios cuadran con la unidad elegida? | ✅ **Sí.** 1 UND = 16,55 US$ · 1 BTO = **204,90** US$. Cotejado contra `price_list` de la nube |

## 🔴 Pero `userCanChangeUnits = NO` **no entrega lo que el enunciado pide**

El enunciado dice *«en pedido quiere usar una sola unidad»*. Con la variable en **NO**:

1. El selector **«Unidad» sigue dibujado** (gris, con sus dos opciones). No desaparece.
2. 🔴🔴 **Y el vendedor puede seguir cambiando la unidad**, por el selector **«Lista de Precio»**,
   que queda **habilitado**. Ejercido: `010362` pasó de **UNIDADES a BULTO** eligiendo
   *«Precio Empaque - BULTO»*; el selector Unidad siguió el cambio a BULTO, el Inventario se
   reescaló de `14,00` a `1,17` (= 14/12) y **1 unidad pasó a costar 204,90 US$ en vez de 16,55**.

⇒ **Mientras `unitByPriceList` valga SÍ, `userCanChangeUnits = NO` no cierra la puerta: apaga una de
las dos.** La que queda abierta es `userCanChangePriceListProduct` (hoy en SÍ).

---

## Qué hace la build que corre en el equipo

Leído del `http://localhost/main.js` del propio dispositivo (no del repo):

```js
/** Selector de unidad OFF si unitByPriceList o userCanChangeUnits=false. */
get disableUnitSelector() {
  return this.unitByPriceList || !this.userCanChangeUnits;
}
```

```js
unitInfo = JSON.parse(JSON.stringify(unitFiltered));
unit = unitInfo.find(u => u.coUnit == prod.coPrimaryUnit);   // ← la unidad preseleccionada
if (!unit) { unit = unitInfo[0]; console.log('producto ... no tiene unidad primaria valida'); }
if (this.unitByPriceList) { this.applyUnitPriceListFields(item.idProduct, unitInfo); }
```

Tres cosas que esto deja cerradas **sin tener que provocar el comportamiento**:

1. **La unidad preseleccionada es siempre `products.co_primary_unit`**, con `unitInfo[0]` como red de
   seguridad. `userCanChangeUnits` **no filtra** `unitList` — solo apaga el selector ⇒ **una unidad
   «única» por configuración no está implementada: lo que hay es un selector deshabilitado.**
2. Las **dos** VG apuntan al **mismo** `disabled`. Ver el selector gris **no** permite concluir cuál
   de las dos lo apagó (ya avisado el 11/09; se reconfirma).
3. El binding `orderServ.disableUnitSelector` aparece **solo** en las plantillas de
   **`productos-tab-order-product-list`** (el panel de línea de Pedidos). **No aparece ni una vez en
   `devolucion-product-list`.** Estructuralmente, Devoluciones **no puede** verse afectada — y la
   medición del paso 3 lo confirma.

---

# Los cuatro pasos

## 1 · Línea base — **no ejecutable como está escrita**

`unitByPriceList = NO` no se puede poner (arriba). Lo que se midió es la **línea base real del
tenant**: `unitByPriceList = SÍ`, `userCanChangeUnits = SÍ`.

Pedidos, panel del producto expandido (3 `ion-select`: *Lista de Precio · Unidad · Almacén*):

| Producto | `co_primary_unit` (BD) | **Unidad preseleccionada** | Selector Unidad | Selector Lista de Precio |
|---|---|---|---|---|
| **`0201225`** PALITOS DE QUESO PEDRITO | **BTO** | **BULTO** ✅ | `disabled`, opciones `UNIDADES`/`BULTO` | **habilitado**, **1 sola** opción (`Precio Unidad - UNIDADES`) |
| **`010362`** PASSION NOIR | **UND** | **UNIDADES** ✅ | `disabled`, opciones `BULTO`/`UNIDADES` | **habilitado**, 2 opciones |

**No hay selector de unidad propio y utilizable** — está deshabilitado por `unitByPriceList`, tal
como QA comprobó a mano. Quien cambia la unidad hoy es **Lista de Precio**.

Devoluciones, misma configuración:

| Producto | primaria | **Unidad preseleccionada** | Selector |
|---|---|---|---|
| **`0201225`** | BTO | **BULTO** ✅ | **habilitado**, `BULTO`/`UNIDADES` |
| **`0201670`** HONY BRAND (`BTO ×20`) | UND | **UNIDADES** ✅ | **habilitado**, `UNIDADES`/`BULTO` |

⚠ Ya aquí hay una asimetría que conviene mirar: **con la misma configuración, el selector está
apagado en Pedidos y encendido en Devoluciones.** Devoluciones ignora `unitByPriceList`.

## 2 · 🔑 El REQ — `userCanChangeUnits = NO`

Conmutada a las **13:37**; comprobada en la nube (`valor='false'`, `da_update` 17:37:43Z) **y en
`localStorage.globalConfiguration` del equipo tras cerrar sesión y volver a entrar** (una VG global
no baja con «Sincronizar»).

**Qué unidad queda en cada producto:**

| Producto | **Unidad que queda** | Esperado | |
|---|---|---|---|
| **`0201225`** | **BULTO** | BTO (su primaria) | ✅ |
| **`010362`** | **UNIDADES** | UND (su primaria) | ✅ |

**No quedan los dos en la misma unidad** ⇒ **el módulo sí respeta la unidad por defecto de cada
producto.** Ese es el punto central del enunciado y **se cumple**.

Lo que **no** se cumple:

- **«sin selector»** — el `ion-select` Unidad sigue renderizado con sus dos opciones, solo `disabled`.
- **«una sola unidad»** — se ejerció el bypass y **funciona**:

| Acción sobre `010362` con `userCanChangeUnits = NO` | Antes | Después |
|---|---|---|
| Elegir *«Precio Empaque - BULTO»* en **Lista de Precio** | Unidad `UNIDADES` | Unidad **`BULTO`** |
| Inventario del panel | `14,00` | `1,17` (= 14/12) |
| Cargar **1** unidad → Tab Total | (1 UND = 16,55 US$) | **1 BULTO = 204,90 US$** |

El carrito lo confirma: `idUnit 1` (BTO), `idList 3`, `nuPrice 17,0752`, `subtotal 204,9024`,
`totalEnUnidades 12`.

## 3 · 🔑 Devoluciones, con la variable todavía en NO

**Las dos unidades siguen ofreciéndose, y el selector sigue habilitado.**

| Producto | primaria | Unidad preseleccionada | Selector | Opciones |
|---|---|---|---|---|
| **`0201225`** | BTO | **BULTO** | **habilitado** | `BULTO` · `UNIDADES` |
| **`0201670`** | UND | **UNIDADES** | **habilitado** | `UNIDADES` · `BULTO` |

Y no es solo apariencia: se **conmutó de verdad** `0201670` de **UNIDADES → BULTO** y el cambio
prendió (`disabled = false`, valor final `BULTO`).

✅ **La configuración del grupo Pedidos NO se filtra a Devoluciones.** El defecto principal que el
encargo temía **no se produce**. Coincide con la lectura de la build: `disableUnitSelector` no se
referencia en `devolucion-product-list`.

## 4 · Restituir

`userCanChangeUnits` devuelta a **SÍ** a las **13:43**. `unitByPriceList` **nunca se tocó**.

**Sin residuo, comprobado en las tres capas:**

| Capa | `unitByPriceList` | `userCanChangeUnits` |
|---|---|---|
| Web (`Variables de configuración › Pedidos`) | *(no se muestra — `editable = false`)* | **SI** |
| Nube (`global_configuration`) | `true` | **`true`** (`da_update` 17:43:43Z) |
| Equipo (`localStorage.globalConfiguration`, tras re-login) | `true` | **`true`** |

Y re-medido en Pedidos tras volver a entrar: `0201225` → **BULTO**, `010362` → **UNIDADES**, la Lista
de Precio de `010362` de vuelta en *«Precio Unidad - UNIDADES»*, inventarios en `316,00` y `14,00`.
**Idéntico a la línea base.**

---

# Precio y total contra la unidad elegida

Cotejo de tres capas para `010362` (`BTO ×12` / `UND ×1`):

| Caso | Modelo (`orderServ.carrito`) | Tab Total | Oráculo nube (`price_list` × `product_unit.qu_unit`) | |
|---|---|---|---|---|
| 1 **UND** | `idList 1`, `nuPrice 16,5532`, `subtotal 16,5532` | `UNIDADES: 1 — Total Base 16,55 US$` | `16,5532 × 1` | ✅ |
| 1 **BTO** | `idList 3`, `nuPrice 17,0752`, `subtotal 204,9024` | `BULTO: 1 — Total Base 204,90 US$` | **`17,0752 × 12`** | ✅ |
| 1 BTO + 1 UND | `subtotal 221,4556`, `totalEnUnidades 13` | `Total US$ 221,46` | `204,9024 + 16,5532` · `12 + 1` | ✅ |

**Pedir 1 BTO no cuesta lo mismo que 1 UND: 204,90 contra 16,55.** El precio y el total **cuadran con
la unidad elegida**, y las cantidades se conservan **por unidad** (no se re-escalan al conmutar).

Tres observaciones del mismo cotejo, **ninguna levantada como defecto**:

- **`0201225` no discrimina precio por unidad**, y es correcto para su dato: sus **dos** unidades
  tienen `qu_unit = 1` y solo existe precio en la lista `01` (9,0596 US$) ⇒ 1 BTO y 1 UND cuestan
  igual. **Como caso de precio, `0201225` no puede fallar** — el caso bueno es `010362`.
- **La cabecera de `0201225` rotula `Precio Unidad - UND: 9,06 US$` mientras la Unidad seleccionada
  es `BULTO`.** Numéricamente da igual (`qu_unit = 1`), pero el rótulo y la unidad no concuerdan.
  **Podría ser cosa del dato del producto** (le falta precio en la lista `02`, la que mapea a BTO).
  **Pide confirmación a mano** antes de abrir nada.
- En la nube `010362` tiene una **tercera** lista, `03 «Precio Bulto»` (15,92 US$), que **nunca llega
  a la app**: `unit_pricelist` solo mapea `01→UND` y `02→BTO`. Informativo.

---

# K6 · «Cambiar la Unidad de Venta no convierte» — **sigue vivo, y es otro asunto**

**Es otro asunto.** K6 es del **filtro «Unidad de Venta» del reporte web Plan VS Cuota**, no del
selector de unidad del móvil. **Este REQ no lo resuelve ni lo toca.**

**Y sigue vivo.** Misma búsqueda (Visualización `Empresa`, Cumplimiento `Facturado`,
01/08–31/08/2026), cambiando solo la Unidad de Venta:

| Unidad de Venta | Columna «Facturado (X)» | Columna «Monto Facturado (X)» |
|---|---|---|
| `US$` | **224.411,08** | *(la columna no existe)* |
| **`BULTO`** | **`0`** | **224.411,08** |
| **`UNIDADES`** | **`0`** | **224.411,08** |

El recuento en unidades sale **0** y el importe **en US$ se reetiqueta** con el nombre de la unidad,
idéntico en BULTO y en UNIDADES. **No convierte: solo cambia el rótulo.** Reproduce lo del 14/09 con
otra cifra (224.411,08 en vez de 80.160,23) porque la ventana y el corte son otros.

> ⚠ Nota de contexto, no un juicio: se me avisó de que Reportes está caído desde esta mañana
> (21/21 «Error en busqueda de reporte»). **En esta medición, a las ~13:50, Plan VS Cuota respondió
> las 4 búsquedas sin error.** Lo dejo anotado por si sirve para acotar la caída; **no volví a entrar**.

---

# Lo que NO se pudo comprobar

- 🔴 **Toda la rama `unitByPriceList = NO`** — los pasos 1, 2 y 3 tal como están escritos. La variable
  **no es editable desde la web en INSUMAR** (`editable = false`) y las escrituras SQL están
  prohibidas. **Es el bloqueo principal de esta corrida.** Con `unitByPriceList = NO` habría que
  volver a medir: (a) si aparece un selector de unidad **propio y utilizable**, (b) si
  `userCanChangeUnits = NO` entonces sí deja **una sola** unidad, y (c) el precio conducido por el
  selector de unidad y no por el de lista.
- **Si el selector «Unidad» llega a desaparecer** (en vez de quedar gris) en alguna configuración. En
  las dos que se midieron, siempre se renderiza.
- **El envío a la nube.** No se envió ningún pedido ni ninguna devolución: el encargo pedía medir el
  selector, y crear transacciones habría dejado basura. El cotejo de precios se cerró contra
  `price_list` / `product_unit` **de la nube**, no contra un `order_detail_unit` nuevo. **Si hace
  falta la prueba de punta a punta, es una corrida corta.**
- **`010362` en Devoluciones.** Con `validateReturn = true` solo es devolvible lo que está en la
  factura elegida, y **`010362` no aparece en ninguna factura del equipo** (0 filas en
  `invoice_details`). Se sustituyó por **`0201670`** (HONY BRAND, `BTO ×20` / `UND ×1`, primaria
  **UND**), que juega el mismo papel de contraste y está en **la misma factura y el mismo cliente**
  que `0201225`.
- **Productos con 3 o más unidades, o con `qu_unit` fraccionario.** El catálogo de INSUMAR solo expone
  el par BTO/UND.
- **Si la asimetría Pedidos-apagado / Devoluciones-encendido es intencional.** Se midió que ocurre;
  **no se afirma si es el diseño querido**.

---

# Para el perfil y para el script

1. 🔴 **`automation/clientes/insumar.yaml` declara `validateReturn: false` y hoy es falso**:
   `returnLogic.validateReturn === true`. Devoluciones **exige factura** — sin ella las tabs
   PRODUCTOS/ADJUNTOS quedan `disabled` y el guion se cuelga creyendo que falta el cliente. Y el
   catálogo de la devolución **es el de la factura**, no el catálogo completo.
2. 🔴 **En DEVOLUCIONES, `ion-segment-button.disabled` es una PROPIEDAD, no un atributo.**
   `hasAttribute('disabled')` devuelve `false` con la tab bloqueada y se lee «las tabs están
   habilitadas». **Leer `b.disabled === true`.** Costó una medición entera.
3. **El cliente de DEVOLUCIONES hay que elegirlo por CLICK REAL en el ítem del modal**: es lo único
   que dispara `selectorService.ClientChanged → reset() → onReturnGeneralValid(true)`.
   `setClientfromSelector(...)` directo deja `returnValid = false` y las tabs bloqueadas.
   **Contradice la receta de `[latino_cosmetica-20260714]`** para este build.
4. **El modal de cliente no abre al clic: `#clienteSelectModal.present()`** y clic en el `<p>` del
   nombre al 35 % del ancho. Igual para la factura: **`#InvoiceeSelectModal`** (con el typo de doble
   `e` del código fuente).
5. **`devolucion-product-list` NO expone `userCanChangeUnits`, `unitByPriceList` ni
   `disableUnitSelector`** — sus claves son `productStructureService, returnLogic, messageService, db,
   dateServ, showReturnDetail, tags, productList, returnMotives, selectedDate, compareUnitId,
   trackByCoReturnDetail`. **La ausencia es la evidencia**: Devoluciones no lee esas VG.
6. **La pantalla de Variables de configuración solo dibuja las filas `editable = true`.** Si una VG
   «no está», comprobar `editable` en `global_configuration` **antes** de concluir que el grupo es
   otro o que la pantalla falla. En INSUMAR/Pedidos: 38 editables = 38 filas.
7. **Al conmutar una VG, localizar la fila por el TEXTO de la pregunta, nunca por índice**
   (`formGlobal:tablaConf:<i>:j_idt128_input` se mueve). Guardar con `formGlobal:botonGuardar` y
   esperar el growl *«Operación Exitosa»*.
8. ⚠ **`chromium.connectOverCDP(...).close()` MATA el Chrome lanzado por `launchPersistentContext`** —
   no lo desconecta. El patrón que aguanta es **un proceso por tarea** que lanza, hace y cierra
   (`_wrun.js` de este RUN_DIR), en vez de un navegador largo con un driver que se conecta y se va.
9. **El buscador de productos de PEDIDOS mantiene el texto dentro del mismo formulario**; en
   DEVOLUCIONES hay que vaciarlo con `Backspace` leyendo `input.value.length`.
10. **El alert de salida del formulario trae `[Guardar y salir, Salir sin guardar, Cancelar]`.** Un
    `volverAHome` que prefiera «Cancelar» **se queda dentro del formulario para siempre**. Preferir
    **«Salir sin guardar»**.
