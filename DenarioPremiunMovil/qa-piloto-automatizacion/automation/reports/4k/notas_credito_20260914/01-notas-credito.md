# Notas de crédito con saldo a favor del cliente — IMPORTADORA 4K · 14/09/2026

| Parámetro | Valor |
|---|---|
| RUN_ID | `notas_credito_20260914` |
| Cliente / empresa | **4k** · `DIESE` · GRUPO 4K · RIF J401702600 — **empresa única**, guarda verificada antes de leer la BD (`collection.coEnterprise = "DIESE"` en el cobro vivo) |
| Playa | **CARIBE** (la declarada en el encargo). ⚠ No se re-midió el `ws_url` en runtime esta corrida |
| Usuario del equipo | `V.0030` / login `v.0030zgrancaracas` · `idUser` **338** · **JOAN BRICEÑO** (login nuevo hecho al inicio: el equipo venía de V.0002 y estaba en `/login`) |
| App | `com.kiberno.denarioPremiumPro` **6.6.21.3** (APK de `main`) · `db_version` 23 · bundle `main.js` **5.418.785 bytes** |
| Dispositivo | Infinix X6728 · CDP `:9220` |
| Conducción | Node + Playwright de `automation/playwright/node_modules` (`connectOverCDP` vía `drv.js`). **El MCP de Playwright no levanta** |
| Cliente de prueba | **`C.0864` · MULTISERVICIOS DON PEDRO MARRON 0706, C.A** (localizado **por código**, no por nombre) |
| Tasa vigente | 870,00 Bs = 1,00 USD · el cobro **nace en USD** (`collection.coCurrency = "USD"`), no en Bs |
| Comentario testigo | `Test-NC-0864-154057` |
| Resultado | **El escenario SE MONTÓ** con pago parcial · anticipo de **144,00 USD** creado y **en la nube** · pero **el monto a pagar NO queda en −144,00: queda en 0,00** y **los saldos de los dos documentos no se mueven** |

---

## 0 · Configuración leída del EQUIPO antes de medir

`localStorage.globalConfiguration` (187 claves; en este build es un array de pares `[clave, valor]`, no un objeto):

| Clave | Equipo |
|---|---|
| `enablePartialPayment` | **true** ✅ (es la que hace posible el escenario) |
| `alwaysPartialPayment` · `historicPartialPayment` | false · false |
| `enableDifferenceCodes` | **true** (⚠ el YAML del cliente todavía dice `false` — **está desactualizado**) |
| `colletionPayment` | `true-true-true-true-true-true` → los **6** métodos habilitados |
| `requiredComment` | true (`longitudComentario` 200; la UI rotula «Mín. 0 - Máx. 255») |
| `automatedPrepaid` · `cobroPrepago` | true · true |
| `prepaidRangeAmount` · `prepaidCurrency` | **0,01** · USD |
| `RangoToleranciaPositiva` / `Negativa` · `TipoTolerancia` | 49,99 / 10 · 0 (Importe) |
| `requiredCollectionAttachments` | false ⇒ se puede **Enviar** sin adjunto |

Catálogo de códigos de diferencia en la nube: **una** fila, `test_excedente — «Cancelado por Abonos»`, `co_operation='I'`.

---

## 1 · Saldos ANTES (nube, `document_sale`)

De las 27 filas de `C.0864`, **solo dos están activas** (`co_operation='I'`); las otras 25 están borradas (`'D'`).

| `id_document_sale` | Documento | Tipo | `nu_amount_total` | **`nu_balance`** | `co_collection` | `da_update` |
|---|---|---|---|---|---|---|
| 76965 | `00022180` | FAC | 2.552,0000 | **+2.552,0000** | NULL | 2026-08-19T13:20:42.992Z |
| 76791 | `*0001523` | N/C | 244,0000 | **−244,0000** | NULL | 2026-08-19T13:20:42.667Z |

Contraste en el equipo: el selector de clientes muestra `C.0864 · Saldo USD: **2.308,00**` = 2.552 − 244 ✅.
`max(id_collection)` antes de la corrida: **2707**.

---

## 2 · Las 7 respuestas

### 1 · ¿La app **permite** el pago parcial sobre la factura? — ✅ **SÍ**

**El pago parcial no está en el listado: vive dentro del detalle del documento.** Ruta real:

1. Tab **Documentos** → fila `FAC 00022180` → botón lupa (`ion-icon[name="search-sharp"]`) → `ion-modal#eventModal` «**Detalle Del Documento**».
2. Al pie del modal hay **«Pago parcial:»** con un **`ion-toggle`**, que nace **apagado**.
3. Con el toggle **apagado**: `Monto a pagar USD` = `2.552,00` y **`readOnly = true`**.
4. Al **encenderlo** (clic real; `elementFromPoint` devolvió `ION-TOGGLE`): el campo pasa a **`readOnly = false`** y **se resetea a `0,00`**; además **desaparece el botón «ASIGNAR DESCUENTO»** y `Dif. Devolución/Faltante` queda `disabled`. **GUARDAR** sigue deshabilitado mientras el monto sea 0.
5. Se teclearon los dígitos `10000` (el campo es **centavos-acumulativo**) → el `input` nativo **y** el modelo del `ion-input` quedaron en **`100,00`**. GUARDAR pasó a **habilitado**.
6. Tras GUARDAR: `collectService.montoTotalPagar = **100**`, `isPaymentPartial = true`.

**Y quedó escrito así en la nube** (`collection_detail` 2438): `in_payment_partial = **true**`, `nu_amount_paid = **100.0000**`, `nu_amount_doc = 2552.0000`, `nu_balance_doc = **2452.0000**`.

> 🔑 La moneda no fue trampa aquí: **el cobro de 4K nace en USD** y el campo rotula «Monto a pagar **USD**». No hubo que convertir nada.

**De paso, la guarda del primer documento negativo — reproducida en esta corrida:** marcar la N/C `*0001523` como **primer** documento abre `ion-alert` **«Denario Cobros · El primer documento a seleccionar no puede tener monto negativo»** y deja los dos checkboxes en `false`. No crashea. (En el bundle: `//NO PERMITO SELECCIONAR DE PRIMERO UN DOCUMENTO DE TIPO NOTA DE CREDITO`.)

---

### 2 · ¿El monto a pagar queda **negativo** (−144,00)? — ❌ **NO. Queda en 0,00.**

Tras seleccionar la N/C como **segundo** documento (los dos checkboxes en `true`):

**Pantalla — Tab Pagos**

```
Monto total a pagar USD: 0,00      Diferencia USD: 0,00
```

**Pantalla — Tab Total**

```
Monto total a Pagar USD 0,00   Tasa Bs 870,00   Pago USD 0,00   Diferencia USD 0,00
Tipo  Nro. Doc.   Monto Doc.  Monto Pago  Monto Saldo
FAC   00022180     2.552,00     100,00      2.452,00
N/C   *0001523      -244,00    -244,00          0,00
Total Otros: USD 0,00      Total General USD: 0,00
```

**Modelo (`ng.getComponent(app-cobro).collectService`), medido en el mismo instante**

```
montoTotalPagar            = 0          ← no es -144
nuDifference               = 0
creditBalancePrepaidAmount = 144        ← aquí es donde van los 144
createAutomatedPrepaid     = true
```

**Qué está pasando, según el bundle vivo** — es una función deliberada y reciente, no un accidente:

```js
/** Excedente NCR > FACT en moneda del cobro (COB-NCR-PREPAID-001).
 *  Se convierte a moneda de anticipo en `resolveAutomatedPrepaidDocumentAmounts`. */
this.creditBalancePrepaidAmount = 0;
/** Efectivo que deben cubrir métodos de pago (COB-DISC-004).
 *  Puede ser 0 cuando descuento/NCR cubren el total; `montoTotalPagar` sigue mostrando deuda de facturas. */
this.efectivoRequerido = 0;
```

⇒ **La app nunca deja el monto a pagar en negativo: lo recorta a 0 y deriva el excedente a favor del cliente al anticipo automático.** El resultado de negocio (144,00 acreditados) es el que pide el REQ; lo que no coincide es **el número que el encargo dice que hay que leer en pantalla**.

🔴 **Y hay un agujero real, aparte de la discusión de texto: los 144,00 NO aparecen en ninguna parte de la interfaz.** Se recorrieron Pagos y Total antes de enviar, y las alertas del envío: no hay campo, ni línea, ni alerta que los nombre. El único sitio donde el usuario los ve es la **fila «Anticipo · 2709» en la lista de cobros, ya enviado**. Compárese con el camino del *excedente de pago*, que sí avisa antes (**«Se creará un anticipo automático por el monto excedente de USD …»**, medido esta misma mañana).

> ⚠️ **Esto necesita confirmación de producto, no de QA**: si el REQ quiere ver **−144,00** en «Monto a pagar», es un FAIL de la app; si quiere el comportamiento COB-NCR-PREPAID-001 (recorte a 0 + anticipo), lo que falta es **mostrarle al usuario el importe antes de enviar**. En cualquiera de los dos casos el hueco de la pantalla es el mismo.

---

### 3 · ¿Deja **crear el anticipo** con «Otros» + código de diferencia? — ✅ **SÍ**

| Paso | Lo que se vio |
|---|---|
| `AGREGAR MÉTODO DE PAGO` (`ion-button#eventSelect`) | abre `#eventModal` «Seleccione método de cobro...» con los 6 métodos |
| **«Otros»** | 🔑 **venía YA MARCADO** (`checked = true`) sin que el guion lo tocara — el resto en `false` |
| `AGREGAR` | agrega el acordeón **«Otros»** al Tab Pagos |
| Selector de código de diferencia | `ion-select` **sin label**, `interface="alert"`, **una sola opción**: `test_excedente - Cancelado por Abonos`. Se abrió con clic real (`ion-alert` de radios) → radio → **OK**. Quedó `value.coDifferenceCode = "test_excedente"` |
| `Especifique:` | se escribió `Saldo a favor NC 0001523` (24/50 caracteres) |
| `Monto` | **0,00** — coherente con «Monto total a pagar 0,00» |

**Oráculo en la nube** (`collection_payment` 2748, del cobro 2708):

```
co_payment_method   = 'ot'                     ← Otros
nu_amount_partial   = 0.0000
nu_payment_doc      = 'Saldo a favor NC 0001523'
id_difference_code  = 1   ·  co_difference_code = 'test_excedente'
```

⚠️ **No aislado en esta corrida:** no se probó pulsar Enviar **sin** el código para ver si la app bloquea. (La evidencia de que lo exige — «Seleccione un código de diferencia en el método Otros antes de enviar.» — es de la corrida de esta mañana, no de ésta.) En el bundle sí está el rótulo del campo obligatorio: `getDifferenceCodeRequiredFieldLabel()` → `COB_MSJ_ERROR_NO_DIFFERENCE_CODE` / `'Debe seleccionar un código de diferencia.'`.

---

### 4 · ¿**Enviar** queda habilitado? — ✅ **SÍ. El defecto hermano no reproduce.**

Medido en el DOM, no deducido (`ion-button.imagenEnviar`):

| Momento | `disabled` |
|---|---|
| Con los 2 documentos seleccionados y **sin** método de pago | **true** (validación normal del cobro) |
| Tras agregar «Otros» + código de diferencia + «Especifique» | **false** ✅ |

El clic real sobre el botón funcionó **a la primera** (`elementFromPoint` devolvió el propio `ion-button.imagenEnviar`). No hubo botón gris, ni cálculo correcto con envío bloqueado.

---

### 5 · ¿Llega a la nube? — ✅ **SÍ. Dos filas.**

```
id_collection | co_type | co_client | nu_amount_total | nu_amount_final | tx_comment          | st_collection
     2708     |    0    |  C.0864   |     0.0000      |     0.0000      | Test-NC-0864-154057 |      3
     2709     |    1    |  C.0864   |   144.0000      |   144.0000      | Test-NC-0864-154057 |      3
```

`co_currency = USD` · `id_user = **338**` (V.0030) · `da_collection = 2026-09-14T19:39:37Z` ·
`co_collection` = `1789414781538.0` (cobro) y `1789415271750.0` (anticipo).

`transaction_statuses` para las dos: `co_status = **'pap'** — «Por aprobar»` (`na_status_user = SYSTEM`).
La lista de cobros del equipo las muestra como **«Nro Ref: 2709 · Estatus: Enviado · Anticipo»** y **«Nro Ref: 2708 · Estatus: Enviado · Cobros»**.

🔴 **Solo hubo UN acuse en pantalla: «Denario Premium · Cobro nro. 2708 enviado exitosamente».**
**No salió el segundo acuse del anticipo** («Anticipo nro. N enviado exitosamente»), que sí aparece en el camino del anticipo por excedente. El anticipo **llegó igual**. Es una diferencia de aviso, no de datos — pero un QA que valide «por la alerta» concluiría que el anticipo no se creó.

**Referencias a anotar: `2708` (cobro) y `2709` (anticipo).** Quedan registradas en `automation/clientes/_escrituras-de-prueba.md`.

---

### 6 · ¿Por **cuánto** se creó el anticipo? — **144,00 USD exactos**

`244,00 − 100,00 = 144,00`. Sale el número esperado.

| Dónde | Valor |
|---|---|
| Modelo, **antes** de enviar | `getRemnantOrCreditAutomatedPrepaidAmount() = **144**` · `getAutomatedPrepaidSendAmount() = **144**` · `shouldCreateAutomatedPrepaidOnSend() = **true**` · `canSendRemnantOrCreditAutomatedPrepaid() = true` |
| `collection` 2709 | `nu_amount_total = nu_amount_final = **144.0000**` USD |
| `collection_payment` 2749 | `nu_amount_partial = **144.0000**` · conversión **125.280,00 Bs** (144 × 870 ✅) · `co_payment_method = 'ef'` |

🔑 **Contraste que importa para el REQ:** en el camino del *excedente de pago*, medido esta misma mañana, el anticipo sale **recortado por el techo de tolerancia** (exceso de 50,00 → anticipo de **0,01**). **Aquí no: los 144,00 salen enteros.** El bundle lo dice explícitamente — `canSendRemnantOrCreditAutomatedPrepaid()` / `isRemnantOrCreditAutomatedPrepaidScenario()` dejan pasar el remanente de descuento y el de NCR **sin exigir el umbral de exceso ni bloquear por `existPartialPayment`**. Son dos caminos distintos, con dos reglas distintas, y **el de la N/C es el que acredita el importe completo**.

*Detalle menor:* el anticipo se emite con método **`ef` (Efectivo)** aunque la VG `prepaidPaymentMethod` sea `"pa"`. **No es de esta corrida**: los anticipos automáticos anteriores de 4K (2691, 2696, 2698, 2701, 2703, 2705, 2707) salieron todos con `ef`. Se anota, no se reporta como defecto nuevo.

---

### 7 · ¿Se **cierra el ciclo** de los documentos seleccionados? — ❌ **NO, y no queda cerrado con el envío**

**Saldos ANTES y DESPUÉS en la nube (`document_sale`) — idénticos:**

| Documento | `nu_balance` **antes** | `nu_balance` **después** | `co_collection` / `id_collection` | `da_update` |
|---|---|---|---|---|
| `00022180` FAC | +2.552,0000 | **+2.552,0000** | NULL / NULL | **sin cambio** (2026-08-19T13:20:42.992Z) |
| `*0001523` N/C | −244,0000 | **−244,0000** | NULL / NULL | **sin cambio** (2026-08-19T13:20:42.667Z) |

**Lo único que sí registra la aplicación del cobro es `collection_detail` de 2708:**

| `co_document` | tipo | `nu_amount_doc` | `nu_amount_paid` | `nu_balance_doc` | `in_payment_partial` |
|---|---|---|---|---|---|
| `00022180` | FAC | 2.552,00 | **100,00** | **2.452,00** | **true** |
| `*0001523` | N/C | 244,00 | **−244,00** | **−244,00** | false |

**Antes de llamarlo defecto, se comprobaron dos cosas que lo desactivan:**

1. **`document_sale.co_collection` es NULL en las 8.470 filas de la base.** El campo no lo usa este despliegue.
2. **Un cobro ya APROBADO tampoco mueve el saldo.** Se tomó el cobro **2597** (C.0610, 18/08, estado **«Aprobado»**): su `collection_detail` dice `nu_amount_paid = 241.860 Bs` sobre la `FAC 00021703`, y el `nu_balance` de esa factura en `document_sale` **sigue igual** (278,00 USD), con el mismo `da_update` masivo del 19/08 que tienen todos los documentos.

⇒ **El cierre del ciclo no lo hace la app ni el envío: lo hace el ERP del cliente aguas abajo, a partir de `collection_detail`.** Con 2708 y 2709 en **«Por aprobar»**, el ciclo está **abierto**, y eso es lo esperable en este punto. **Lo que NO se comprobó es qué ocurre al aprobarlos** — no se aprobaron: son documentos reales de un cliente real y aprobar no era una acción de esta corrida (§«Lo que NO se pudo comprobar»).

*Un apunte sobre la semántica del payload, ya comprobado que no es regresión:* para la N/C se envía `nu_balance_doc = −244,00` (**el saldo del documento**) mientras la pantalla mostraba `Monto Saldo 0,00` (**el saldo después de aplicarla**). Para la FAC sí se envía el saldo **después** (2.452,00). Se cotejó contra las 3 N/C históricas de la base (cobros 2683, 1087, 804): **todas** llevan `nu_balance_doc` = saldo del documento. Es como ha funcionado siempre; si el ERP necesita el 0,00 para «descontar o eliminar la nota de crédito», ésa es la conversación a tener con producto.

---

## Registros creados en sistema

| Ref (`id_collection`) | `co_type` | Cliente | Detalle | Estado |
|---|---|---|---|---|
| **2708** | 0 · cobro | C.0864 | `FAC 00022180` con **pago parcial 100,00** + `N/C *0001523` (−244,00) · total 0,00 · método **Otros** con código `test_excedente` | Enviado · **«Por aprobar»** en la nube |
| **2709** | **1 · anticipo** | C.0864 | Anticipo automático por el saldo a favor: **144,00 USD** | Enviado · **«Por aprobar»** en la nube |

Anotados en `automation/clientes/_escrituras-de-prueba.md` con cómo revertirlos (anular/rechazar 2708 y 2709 desde la web para que los saldos vuelvan a 2.552,00 y −244,00).
**No se modificó ninguna configuración de la web ni ninguna variable global.** No se ejecutó SQL de escritura.

**Consumo de datos:** `C.0864` queda **agotado** para este REQ — sus dos únicos documentos activos están ahora comprometidos en el cobro 2708 y desaparecen del Tab Documentos hasta que se apruebe o rechace. Para repetir el caso hace falta **preparar otro par FAC + N/C (con la N/C menor que la factura) en la cartera de V.0030**.

---

## Lo que NO se pudo comprobar

| Punto | Motivo |
|---|---|
| **Qué pasa con los saldos al APROBAR 2708/2709** | No se aprobaron. Es un cliente real con documentos reales y aprobar es una acción de la web que no estaba en el encargo. Es **el único camino** que queda para cerrar la pregunta 7 de verdad. |
| **Si Enviar se bloquea SIN el código de diferencia, en este escenario** | No se aisló: se siguió la ruta pedida (Otros + código) de una vez. La evidencia de que lo exige es de la corrida de esta mañana, no de ésta. Se pide reproducirlo a mano en el próximo par de documentos. |
| **Si «Otros» es obligatorio o basta cualquier método** | «Otros» venía pre-marcado y no se probó con Efectivo. No se sabe si el escenario admite otro método. |
| **El importe en Bs del pago parcial** | El cobro nace en USD en 4K, así que la trampa de la moneda no llegó a ejercitarse. Con un tenant cuyo cobro nazca en Bs sigue sin probarse. |
| **Repetir el caso** | Los dos documentos quedaron comprometidos por el cobro 2708. No hay relevo preparado en la cartera de V.0030. |
| **`ws_url` de la playa en runtime** | No se re-midió: no aparece en el bundle ni en `localStorage`, y las entradas XHR no se retienen en `performance`. Se toma **CARIBE** del encargo. |

---

## Trampas nuevas (y confirmación de las conocidas)

| # | Trampa | Detalle |
|---|---|---|
| **T-1** | 🔑 **El pago parcial es un `ion-toggle` DENTRO del detalle del documento, no un campo del listado** | Tab Documentos → lupa de la fila → `#eventModal` «Detalle Del Documento» → toggle **«Pago parcial:»**. Con el toggle apagado, `Monto a pagar USD` es **`readOnly`** y trae el saldo completo; al encenderlo pasa a editable y **se resetea a 0,00**. Un guion que escriba en ese campo sin tocar el toggle **no escribe nada y no falla**. |
| **T-2** | 🔑 **La N/C sale PRIMERO en el Tab Documentos** | El orden es por nro. de documento y `*0001523` va antes que `00022180`. El helper clásico `marcarPrimerDocumento()` (que marca el **primer checkbox**) cae en la nota de crédito y choca de frente con la guarda del documento negativo. **Hay que localizar la fila por tipo/`nu_document`, nunca por posición.** |
| **T-3** | **El método «Otros» ya viene MARCADO** en `#eventModal` cuando el escenario es NCR > FACT | Un guion que «clickee Otros» lo **desmarcaría**. Leer `checked` antes de tocar nada. |
| **T-4** | 🔴 **El anticipo por saldo a favor no anuncia NADA** | Ni alerta previa (a diferencia del anticipo por excedente) ni acuse de envío. La secuencia real del envío fue solo: `El Cobro será enviado` → `Cobro nro. 2708 enviado exitosamente`. **Validar «por la alerta» daría un falso negativo del anticipo.** El oráculo tiene que ser la fila `co_type=1` en la nube. |
| **T-5** | **Con «Pago parcial» encendido desaparece «ASIGNAR DESCUENTO»** y `Dif. Devolución/Faltante` queda `disabled` | Los dos caminos (descuento y parcial) son excluyentes en la misma pantalla. Útil para no reportar «el botón no está». |
| **T-6** | **`automation/db/local-query.js` no sirve hoy en este equipo** | Devuelve `ERR: no such table: collection` — la copia local de la BD del dispositivo está desfasada. No se usó; el oráculo fue la nube. |
| T-7 | *(confirmación)* **El primer clic sobre el botón de una `ion-alert` se pierde** | En el acuse «Cobro nro. 2708 enviado exitosamente» el primer clic cayó en **`ion-backdrop.sc-ion-loading-md`** y hicieron falta **3** intentos. Medido con `elementFromPoint`. |
| T-8 | *(confirmación)* **El selector de cliente no abre al clic** | `#clienteSelectModal.present()` + teclear **`C.0864`** en el buscador + clic en el **`<p>`** del nombre. Buscar por código funcionó a la primera y devolvió 1 solo ítem. |
| T-9 | *(confirmación)* **Campo de monto centavos-acumulativo** | `Monto a pagar USD`: se teclean dígitos sin coma (`10000` → `100,00`). Y tras teclear, `blur()` + espera antes de medir coordenadas del header. |
| T-10 | *(nota de entorno)* **El forward CDP estaba zombi al empezar** | `connectOverCDP` daba `socket hang up` con `:9220` respondiendo a `curl`. Se arregló con los 3 comandos: `adb shell cat /proc/net/unix` → PID `13375` → `adb forward --remove tcp:9220` + `adb forward tcp:9220 localabstract:webview_devtools_remote_13375` → verificar `/json/version`. |

---

## Qué llevar a producto

1. 🔴 **El importe a favor del cliente no se ve nunca antes de enviar.** `creditBalancePrepaidAmount = 144` existe en el modelo desde que se marca la N/C, y ni la pantalla de Pagos, ni la de Total, ni ninguna alerta lo muestran. El camino hermano (anticipo por excedente) **sí** avisa. Falta el mismo aviso aquí.
2. ⚠️ **Decidir el texto del REQ**: «el monto a pagar queda en −144,00» **no** describe lo que hace la app (queda en 0,00 por diseño, COB-NCR-PREPAID-001). O se cambia el REQ, o se cambia la app.
3. ⚠️ **El envío del anticipo no se acusa** aunque sí se envía. Es el mismo hueco de aviso del punto 1, del otro lado del envío.
4. ℹ️ **Confirmar con el ERP** si `nu_balance_doc = −244,00` para la N/C (saldo del documento, no el saldo tras aplicarla) le basta para «descontar o eliminar la nota de crédito», que es el objetivo declarado del REQ. La pantalla muestra `0,00`; el payload manda `−244,00`. Es histórico, no una regresión.
5. ℹ️ **`enableDifferenceCodes` está en `true` en el equipo**, mientras `automation/clientes/4k.yaml` sigue diciendo `false`. Hay que actualizar el perfil.
