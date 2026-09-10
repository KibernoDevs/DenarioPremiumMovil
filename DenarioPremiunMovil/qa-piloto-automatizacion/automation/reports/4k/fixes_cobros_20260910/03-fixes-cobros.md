# Fixes de Cobros — IMPORTADORA 4K · verificación 10/09/2026

| Parámetro | Valor |
|---|---|
| RUN_ID | `fixes_cobros_20260910` · informe **03** |
| Cliente / empresa | **4k** · DIESE (`DIESEL` en el selector) |
| Playa | CARIBE · `http://denariocaribe.ddns.net:8080/DenarioPremium` |
| Build | `main` (dada por verificada; no se re-comprobó) |
| Cliente de cobros | **C.0210 · INVERSIONES RUISAN, C.A.** (`idClient` 211) |
| Config vigente | tolerancia +49,99 / −10 · `prepaidRangeAmount` 50 · tope descuento 85 % · USD · Tipo Importe |
| Alcance | 4 puntos de fix. **No se tocó la configuración de la web.** |

**Documentos USD libres de C.0210 al abrir** (Tab Documentos, oráculo real): 4 facturas —
`00022131` 871,00 · `00022132` 640,00 · `00022133` 440,00 · `00022135` 120,00 = **2.071,00 USD**
(coincide con el «Saldo USD» del selector de clientes).

---

## Punto 1 · Calculadora flotante — ✅ PASS

**Veredicto: PASS.** La calculadora abre, opera y cierra; el arrastre **sí se logró por CDP** (1.er intento);
y el botón flotante **no tapa** ningún control del cobro en su posición por defecto.

### 1.a Abre / opera / cierra — PASS

Estructura (nueva, no estaba en `module-selectors/cobros.md`):

```
app-calculator
├── ion-fab.global-calc-fab.app-draggable-fab   ← botón flotante, z-index 9999, 56×56
│   ├── ion-fab-button > ion-icon[name=chevron-up-outline]   ← abre la lista
│   └── ion-fab-list > ion-fab-button.calculator-btn         ← abre la calculadora
└── ion-card.floating-calculator                ← la calculadora (340×729), solo si showCalculator
```

**Dato medido** (leído del modelo, `ng.getComponent(document.querySelector('app-calculator'))`):

| Entrada | `baseUSD` | `descuentoUSD` | `totalIVAUSD` | `totalUSD` | `totalTasaBCV` |
|---|---|---|---|---|---|
| Base 100,00 · IVA 16 % · tasa BCV 1 | 100 | 0 | **16** | **116** | **116** |
| + Descuento 10,00 % | 100 | **10** | 16 | **106** | 106 |

La UI mostró exactamente esos valores (`ion-input.value`: `100,00 · 10,00 · 1 · 16,00 · 10 · 16,00 · 106,00 · 106,00`).
**Cerrar:** click real en `CERRAR` (`ion-button.botonAddLila` del card) ⇒ `showCalculator=false` y
`ion-card.floating-calculator` **desaparece del DOM**. Ciclo abrir→operar→cerrar completo, sin residuos.

### 1.b Arrastre — PASS (**sí es automatizable**, corrige la expectativa del pedido)

`mouse.move(centro)` → `mouse.down()` → **10 pasos** de `mouse.move` (60 ms c/u) → `mouse.up()`.
**Resultado al 1.er intento:** el FAB pasó de `left:286px; top:0px` a `left:32px; top:112px`
(rect `x` 286→**32**, `y` 344→**112**). El movimiento es **reversible** (se devolvió a 286,344 con el
arrastre inverso) y la directiva escribe `style.left/top`, no `transform`.

> ⚠ **Efecto colateral útil para el script:** como la directiva `appdraggablefab` captura el gesto,
> un `mouse.down`+`mouse.up` sobre el FAB **no lo activa** (`ion-fab.activated` sigue `false`).
> Para abrirlo hay que usar `btn.shadowRoot.querySelector('button').click()`. Lo mismo para
> `ion-fab-button.calculator-btn`. Esto **no es un defecto**: con el dedo, un tap sí abre (QA lo probó).

### 1.c Oclusión — PASS, verificada con `elementFromPoint` (no con `getBoundingClientRect`)

FAB en su posición por defecto: `x 286 · y 344 · 56×56` (viewport 360×744).
Para cada control se tomó el **centro** y se resolvió `document.elementFromPoint(cx, cy)`:

| Control | Punto | `elementFromPoint` | ¿tapado por el FAB? |
|---|---|---|---|
| checkbox doc 0 (00022131) | 81,245 | `ION-CHECKBOX` | no |
| checkbox doc 1 (00022132) | 81,296 | `ION-CHECKBOX` | no |
| checkbox doc 2 (00022133) | 81,347 | `ION-CHECKBOX` | no |
| checkbox doc 3 (00022135) | 81,398 | `ION-CHECKBOX` | no |
| `.imagenGuardar` | 267,32 | `ION-BUTTON.imagenGuardar` | no |
| `.imagenEnviar` | 326,32 | `ION-COL` (su contenedor) | no |
| tabs `default/documentos/pagos/total` | y=90 | `ION-SEGMENT-BUTTON` | no |

**Control positivo (para descartar un falso PASS):** se arrastró el FAB **encima** del checkbox 0 y
`elementFromPoint` pasó a devolver `ION-ICON` **del FAB** (`porFab=true`); al arrastrarlo de vuelta,
volvió a devolver `ION-CHECKBOX`. ⇒ el método sí detecta la oclusión, así que el «no tapado» de arriba
es una medición, no una omisión.

**Sub-caso paginación de documentos — 🚫 N/A por dato:** C.0210 tiene **4 documentos**, la tabla no
pagina y **no existe control de paginación en el DOM**. El defecto histórico (`RUNTIME §5`, el FAB
tapando la paginación) **no es ejercitable con este cliente**; lo que sí queda demostrado es que el
arrastre da la salida al usuario si el FAB cae encima de algo.

**Observación (no es hallazgo, fuera del alcance del punto):** en la calculadora el IVA se calcula sobre
la **base bruta**, no sobre la base menos descuento — con base 100 y 10 % de descuento el IVA sigue
siendo 16,00 y el total 106,00 (si el IVA fuera sobre 90 daría 14,40 y 104,40). Queda anotado por si
la QA quiere definir el criterio; no se levantó como defecto porque el orden de aplicación puede ser
intencional.

---

## Punto 2 · Checkbox vs. modelo al rechazar un descuento que supera el tope — ✅ PASS

**Veredicto: PASS.** El caso **sí es ejercitable** y **la UI y el modelo nunca discreparon**, en los
6 estados medidos y en las **dos direcciones** del rechazo.

### 2.a El catálogo sí permite pasarse de 85 % (contra lo que dice el YAML)

`collectService.collectDiscounts` en el equipo trae **dos** descuentos, no uno:

| `idCollectDiscount` | % | Nombre | `requireInput` |
|---|---|---|---|
| 3 | **10** | DESC 10 TEST | false |
| 1 | **80** | Probando | false |

**10 + 80 = 90 > 85** ⇒ el rechazo es alcanzable por UI sin tocar la web.
(En la nube, `collect_discounts` tiene 4 filas pero dos están en `co_operation='D'`: `DESC MANUAL` y
`DESC MANUAL TEST`. La nota del YAML «el catálogo trae UNA sola fila» quedó **desactualizada** desde el 07/09.)

### 2.b El oráculo correcto del modelo

- **`collectService.tempSelectedCollectDiscounts`** — la selección **en curso** dentro del modal.
- `comp.isCollectDiscountSelected(**id**)` — ⚠ recibe el **id**, no el objeto. Pasarle el objeto
  devuelve `false` siempre y produce un **falso «desincronizado»**. (Se cayó en esa trampa en la 1.ª medición.)
- `comp.getRemainingCollectDiscountPercent()` — % que aún cabe.

### 2.c Medición · seleccionar hasta pasarse

Modal «Descuentos» (`ion-modal` sin id fijo; se localiza por `innerText` que contiene `Descuentos`),
2 `ion-checkbox`: `[0]` = 10 %, `[1]` = 80 %.

| Paso | checkbox 10 % | checkbox 80 % | `tempSelected…` | `isCollectDiscountSelected` | restante | Alerta |
|---|---|---|---|---|---|---|
| inicial | ☐ | ☐ | `[]` | 10:no · 80:no | 85 % | — |
| clic 80 % | ☐ | **☑** | `[1:80]` | 10:no · **80:sí** | 5 % | — |
| clic 10 % (90 > 85) | **☐ (revertido)** | ☑ | `[1:80]` | 10:**no** · 80:sí | 5 % | «Se superó el límite de descuento (85%). **Máximo disponible: 5%.**» |
| tras «Aceptar» | ☐ | ☑ | `[1:80]` | 10:no · 80:sí | 5 % | — |

⇒ **El checkbox rechazado NO queda marcado.** UI y modelo coinciden **antes y después** de cerrar la alerta.

### 2.d Deseleccionar y volver a seleccionar — PASS

| Paso | 10 % | 80 % | `tempSelected…` | restante | Alerta |
|---|---|---|---|---|---|
| deselecciono 80 % | ☐ | ☐ | `[]` | **85 %** (se devuelve el cupo) | — |
| selecciono 10 % (cabe) | **☑** | ☐ | `[3:10]` | **75 %** | — |
| selecciono 80 % (10+80=90>85) | ☑ | **☐ (revertido)** | `[3:10]` | 75 % | «… **Máximo disponible: 75%.**» |
| tras «Aceptar» | ☑ | ☐ | `[3:10]` | 75 % | — |

El mensaje **recalcula el máximo disponible** según lo ya seleccionado (5 % vs 75 %), y el rechazo
revierte el checkbox **en las dos direcciones** (rechazar el 10 % con el 80 % puesto, y al revés).
El método responsable es `revertCollectDiscountCheckboxSelection()` en `app-cobro-documents`.

---

## Punto 3 · Descuento mayor que el saldo ⇒ anticipo por el excedente — ❌ FAIL

**Veredicto: FAIL.** La app **calcula** bien el excedente y **avisa** bien (con el monto), pero después
**deja el cobro sin salida: «Enviar» queda deshabilitado y «Agregar método de pago» también**, así que
el anticipo automático de **80,00 USD nunca llega a la nube**. El cobro solo se puede **Guardar**.

### 3.a Reproducción mínima (5 pasos)

1. Cobro nuevo · cliente **C.0210** · moneda **USD** · comentario cualquiera.
2. Tab Documentos → marcar **un solo** documento: `FAC 00022135`, **saldo 120,00 USD**.
3. Lupa → «Detalle Del Documento» → **ASIGNAR DESCUENTO**.
4. En el modal «Descuentos», campo **«Monto descuento» = 200,00** (descuento manual, `id = -1`).
   No hace falta marcar ningún checkbox del catálogo.
5. **ACEPTAR**.

### 3.b Lo que sí funciona

- Alerta (title `Denario Cobros`): **«El descuento supera el saldo del documento. ¿Desea crear un
  anticipo automático por USD 80,00?»** · botones `[Cancelar · Aceptar]`.
  **El monto aparece y es el correcto** (200,00 − 120,00 = 80,00).
- Tras Aceptar: `collectService.discountRemnantPrepaidAmount = **80**` ·
  `createAutomatedPrepaid = true` · `prepaidRangeAmount = 50` (80 ≥ 50, o sea corresponde anticipo).
- Detalle del documento: `Descuentos Seleccionados = "Descuento manual: 200,00"` ·
  `Total Descuento = 200,00` · `Monto a pagar USD = 0,00`.
- Tab Total: `FAC 00022135 · Monto Doc. 120,00 · Desc. 200,00 · Monto Pago 0,00` · `Diferencia USD 0,00`.

### 3.c El defecto — el cobro no se puede enviar

Estado leído del modelo con el cobro ya armado (`ng.getComponent(app-cobros-header).collectService`):

| Señal | Valor |
|---|---|
| `discountRemnantPrepaidAmount` | **80** |
| `isFullyCoveredCollection` | **true** |
| `disableSendButton` | **true** ⇐ el defecto |
| `.imagenEnviar` `disabled` | **true** |
| «AGREGAR MÉTODO DE PAGO» `disabled` | **true** (`disabledSelectCollectMethodDisabled = true`) |
| `.imagenGuardar` `disabled` | false (sí deja guardar) |

Se probó además **pasar por los 5 tabs** (General → Documentos → Pagos → Total) para forzar la
revalidación: `disableSendButton` **no cambia**. Y con «Agregar método de pago» deshabilitado
tampoco hay forma de darle un pago al cobro para desatascarlo. **No hay salida por UI.**

### 3.d Oráculo — la nube (guardar no es enviar)

Cobro guardado: **`co_collection = 1789067734443.0`**

| Capa | Consulta | Resultado |
|---|---|---|
| **Local** | `SELECT … FROM collections ORDER BY rowid DESC LIMIT 4` | `id_collection **0**` · `st_delivery **3**` · `st_collection 3` · `co_type 0` · `nu_amount_final 120` · **`nu_amount_discount_total 200`** |
| **Local** | `SELECT count(*) FROM pending_transactions` | **0** — ni siquiera se encoló |
| **Nube** | `SELECT … FROM collection WHERE id_collection > 2639` (baseline `max(id_collection)=2639`) | **`[]`** — cero filas nuevas |

⇒ marca **`BD-SAVED`**, y en este caso **es FAIL**: el usuario no puede enviarlo aunque quiera.
**No existe ninguna fila `co_type = 1` (anticipo) ni en local ni en la nube.** El anticipo por
excedente se calcula, se anuncia y se pierde.

**Severidad sugerida: alta.** El descuento queda aplicado (200,00 sobre un documento de 120,00) y el
saldo a favor del cliente —80,00 USD— nunca se registra.

### 3.e Texto del tag `COB_MSG_AUTOMATED_PREPAID` — ⚠ corregido en la nube, **no** en el equipo

La alerta del punto 3.b **no** usa ese tag (es un mensaje propio del remanente de descuento y **sí**
trae el monto). El tag que pidió verificar la QA está así:

| Capa | `co_application_tag` | `tag` | `da_update` |
|---|---|---|---|
| **Nube** (`application_tags`) | `COB_MSG_AUTOMATED_PREPAID` | «Se creará un anticipo automático por el monto excedente de **{amount}**. Se enviará un anticipo junto al cobro.» | **2026-09-10 19:02:05** |
| **Equipo** (SQLite local) | `COB_MSG_AUTOMATED_PREPAID` | «**Anticipo automático creado con**» (sin `{amount}`) | — |

⇒ **la corrección está bien hecha pero todavía no bajó al equipo.** Coherente con lo ya medido en la
2.ª pasada (`DM-COB-ANT-013`, defecto D-02): lo que veía el vendedor era el texto viejo. Confirmación
tras re-login en §3.f.

*(Nota: `COB_LABEL_ANTICIPO_AUTOMATICO` = «Este pago creó el anticipo automático», también del 08/09.)*

### 3.f Confirmación tras re-login — el tag corregido **sí** llega y **sí** sustituye `{amount}`

Se reinició la app y se volvió a loguear con el usuario del cliente. Tras la sincronización el equipo ya
trae el texto nuevo, y la alerta del anticipo automático por **excedente de pago** (medida en el cobro del
punto 4, Ref 2643, diferencia +60,00 USD) salió así:

> **«Se creará un anticipo automático por el monto excedente de USD 60,00. Se enviará un anticipo junto al cobro.»**

⇒ **El monto aparece; no sale `{amount}` literal.** El defecto D-02 de la 2.ª pasada queda **cerrado**:
lo único que faltaba era que la corrección bajara al equipo, y **solo baja con un login nuevo**
(«Sincronizar» del HOME no la trae).

### 3.g 🔴 Efecto colateral del punto 3 — el estado se queda pegado y contamina los cobros siguientes

Descubierto al intentar montar el cobro del punto 4. Después del cobro con remanente de descuento:

| Momento | `createAutomatedPrepaid` | `discountRemnantPrepaidAmount` | «AGREGAR MÉTODO DE PAGO» |
|---|---|---|---|
| Cobro nuevo, mismo módulo, tras salir sin guardar | **true** | **80** | **deshabilitado** |
| Cobro nuevo tras volver a **HOME** y reentrar | false, y **true** otra vez al marcar el documento | **80** (sigue pegado) | **deshabilitado** |
| Cobro nuevo tras **reiniciar la app** | **false** | **0** | habilitado ✅ |

El motivo está a la vista en el bundle: `collectService.syncAddPaymentMethodDisabledState()` arranca con

```js
if (this.createAutomatedPrepaid) { return; }   // ⇐ nunca recalcula: deja el botón como estaba
```

⇒ **mientras el vendedor no reinicie la app, ningún cobro posterior le deja agregar métodos de pago.**
Es la consecuencia más cara del punto 3 y conviene arreglar las dos cosas juntas.

---

## Punto 4 · Banco Emisor guardado en el campo de Banco Receptor — ✅ PASS (el fix está bien)

**Veredicto: PASS.** Con **los 6 métodos que ofrece la UI** cargados en un mismo cobro, **ninguno** guarda
el Banco Emisor en el campo del Banco Receptor. En particular **cheque —el caso que fallaba— está
correcto**: el banco elegido sale bajo «Banco Emisor» y «Banco receptor» queda vacío.

### 4.a Métodos que ofrece la UI (leídos de la pantalla, no deducidos)

Modal «Seleccione método de cobro...»: **Efectivo · Cheque · Depósito · Transferencia · Otros · Pago Móvil** — **6**.

⚠ El modal es de **selección única**: hay que abrir «AGREGAR MÉTODO DE PAGO» **una vez por método**
(marcar los 6 de una sola vez deja solo el último). El YAML dice `colletionPayment: "true-true-true-true-false-true"`
(5 activos); el equipo devuelve los seis `tipoPago*` en **true**. **Manda la UI.**

Campos de banco por método (medidos en el acordeón):

| Método | Banco Emisor | Banco Receptor |
|---|---|---|
| Efectivo · Otros | — | — |
| **Cheque** | **sí** | — |
| **Depósito** | — | **sí** |
| Transferencia · Pago Móvil | sí | sí |

El picker de **Banco Emisor** trae el catálogo general (**35** bancos); el de **Banco Receptor**, las
**cuentas de la empresa** (5 opciones, todas `ZELLE - 898111376149`). En Transferencia el Emisor solo
ofrece cuentas del cliente (`clientBankAccount=true`) → hubo que usar **Nueva Cuenta**.

### 4.b Cobro de prueba **Ref 2643** (6 métodos) — enviado, `BD-OK`

Cargado: Efectivo 160,00 · Pago Móvil 121,00 · Cheque 200,00 · Depósito 150,00 · Transferencia 200,00 ·
Otros 100,00 = **931,00** sobre un documento de **871,00** (`FAC 00022131`) ⇒ excedente 60,00.
Acuse del servidor: **«Cobro nro. 2643 enviado exitosamente»** + **«Anticipo nro. 2644 enviado exitosamente»**.

**Detalle en la WEB** (`/pages/detalleCobro`, Ref 2643), copiado tal cual de la tabla «Tipos de Pago»:

| Nº | Forma de pago | **Banco Emisor** | Cuenta | **Banco receptor** | Numero de Cuenta | ¿Coincide con lo cargado? |
|---|---|---|---|---|---|---|
| 1 | Pago Movil | **BINANCE** | | **ZELLE** | 898111376149 | ✅ cada uno en su columna |
| 2 | Efectivo | | | | | ✅ sin bancos |
| 3 | **Cheque** | **ZELLE** | | *(vacío)* | | ✅ **el emisor NO cayó en receptor** |
| 4 | Depósito | *(vacío)* | **898111376149** | **ZELLE** | *(vacío)* | banco ✅ · **cuenta ⚠ ver 4.d** |
| 5 | Transferencia | Nueva cuenta | TRF-CTA-999 | **ZELLE** | 898111376149 | ✅ |
| 6 | Otros | | | | | ✅ sin bancos |

### 4.c Segunda medición del cheque con un banco **inequívoco** — **Ref 2645**

En 2643 el emisor del cheque (ZELLE) coincidía por casualidad con el nombre de la cuenta receptora de la
empresa, así que esa prueba no discriminaba. Se repitió con **BANCO MERCANTIL**, que la empresa **no**
tiene como cuenta receptora:

- Cobro **Ref 2645** · `FAC 00022132` 640,00 USD · Cheque 640,00 · Banco Emisor **BANCO MERCANTIL** ·
  Nro. Cheque `CHQ-MERC-002`. Acuse: **«Cobro nro. 2645 enviado exitosamente»**.
- **Web:** `1 | Cheque | BANCO MERCANTIL | (Cuenta vacía) | (Banco receptor VACÍO) | (Nº cuenta vacío)`
- **BD** (`collection_payment` de `id_collection = 2645`):
  `id_bank 0 · na_bank "BANCO MERCANTIL" · co_client_bank_account "BANCO MERCANTIL" · nu_client_bank_account "" · nu_bank_account ""`

⇒ **El Banco Emisor del cheque no aparece en el Banco Receptor, ni en la web ni en la BD.** El fix cumple.

*Detalle de esquema, importante para no volver a equivocarse:* para `ch` la web mapea `na_bank` a la
columna **«Banco Emisor»** y deja «Banco receptor» vacía; para `de`/`tr`/`pm` mapea `na_bank` a **«Banco
receptor»**. **El mapeo es por método**, así que `na_bank` por sí sola no dice si es emisor o receptor:
**no juzgar este caso solo por el nombre de la columna de la BD.**

### 4.d ⚠ Hallazgo colateral (menor, **no es el defecto probado y no es regresión**)

En **Depósito**, el **número de la cuenta receptora** se guarda en `nu_client_bank_account` (la columna de
la cuenta **del cliente**) y `nu_bank_account` (la de la empresa) queda vacía. En la web se ve como
`898111376149` bajo la columna **«Cuenta»** (la del emisor) en vez de **«Numero de Cuenta»** (la del receptor).

Prueba de que **no lo introdujo este fix** — conteo sobre toda la tabla `collection_payment`:

| método | filas | con `id_bank>0` | con `na_bank` | con `nu_bank_account` | con `nu_client_bank_account` |
|---|---|---|---|---|---|
| ch | 9 | **0** | 9 | 0 | 0 |
| **de** | **161** | 161 | 161 | **0** | **161** |
| pm | 9 | 9 | 9 | 9 | 9 |
| tr | 2.021 | 2.021 | 2.021 | 1.095 | 931 |

**161 de 161** depósitos históricos tienen el mismo patrón ⇒ es cómo Depósito guardó siempre la cuenta,
no algo de hoy. Queda como **observación** para desarrollo, severidad baja: el banco receptor sí sale
bien; lo único cruzado es el número de cuenta.

*(Nota de esquema: los 9 cheques de la base, del 03/09 al 10/09, traen `id_bank = 0` — el cheque nunca
resuelve el banco emisor a su `id`, solo guarda el nombre. No afecta a lo que se ve, pero cualquier
`JOIN` por `id_bank` va a perder los cheques.)*

---

## Para el script de cobros

### Selectores estables (nuevos o refinados en esta pasada)

| Qué | Selector / técnica | Nota |
|---|---|---|
| **Calculadora — botón flotante** | `ion-fab.global-calc-fab.app-draggable-fab` (`appdraggablefab="global-calc-fab"`, z-index 9999, 56×56) | vive en `app-calculator`, fuera del form del cobro |
| **Calculadora — abrir** | `fab > ion-fab-button` → **`.shadowRoot.querySelector('button').click()`**; después igual sobre `ion-fab-button.calculator-btn` | 🔴 `pg.mouse.click` **no** activa el FAB: la directiva de arrastre se come el gesto |
| **Calculadora — panel** | `ion-card.floating-calculator` (existe solo si `showCalculator`); cerrar con click real en `CERRAR` (`ion-button.botonAddLila`) | al cerrar **desaparece del DOM** |
| **Calculadora — arrastrar** | `mouse.move(centro)` → `down()` → **≥8 `mouse.move`** → `up()`; escribe `style.left/top` | funcionó al 1.er intento |
| **Oclusión** | `document.elementFromPoint(cx,cy)` sobre el **centro** del control, más un control positivo arrastrando el FAB encima | `getBoundingClientRect` sola no sirve; `.click()` por JS atraviesa |
| **Descuentos del documento** | Tab Documentos → checkbox → lupa (`ion-icon[name="search-sharp"]`) → `#eventModal` → botón «Asignar descuento» → modal **sin id fijo**: localizarlo por `innerText` que contenga **`BORRAR TODO`** | 🔴 **no** filtrar por `/Descuentos/`: el modal de detalle también lo contiene una vez hay descuento asignado |
| **Descuento manual** | 1.er `ion-input` del modal («Monto descuento»); `MANUAL_COLLECT_DISCOUNT_ID = -1` | dígitos sin coma (`20000` = 200,00) |
| **Modelo de descuentos** | `collectService.collectDiscounts` (catálogo) · **`collectService.tempSelectedCollectDiscounts`** (selección en curso) · `comp.getRemainingCollectDiscountPercent()` | ⚠ `comp.isCollectDiscountSelected(**id**)` recibe el **id**, no el objeto |
| **Métodos de pago** | «AGREGAR MÉTODO DE PAGO» = `ion-button.botonAddVerde.pagos-add-method-btn` (inactivo ⇒ clase `--inactive`) → `#eventModal` de **selección única** | repetir una vez por método |
| **Acordeones de pago** | `grp.value = [todos los .value]` + `ionChange`; values `efectivo0` / `cheque0` / `deposito0` / `transferencia0` / `pagoMovil0` / **`otros`** (este **sin sufijo numérico**) | |
| **Bank picker** | el trigger es un `div.listado-enterprise-selector` con texto `Seleccione...` dentro del bloque del rótulo → abre **`#bankPickerModal`**; el título del modal dice **`Banco Emisor`** o **`Banco Receptor`** | `scrollIntoView` + **re-medir** el rect antes de clickear |
| **Montos** | `input.focus()` + Backspace×N + **dígito a dígito** (`keyboard.type(ch)` con ~90 ms) + `blur` + `ionBlur` | centavos acumulativos, **sin coma** |
| **Salir del form** | `img.fechaAtras` filtrando `width>0 && x<100` → alert `[Guardar y salir · Salir sin guardar · Cancelar]` | igualdad exacta case-insensitive |

### Secuencia mínima para dejar un cobro enviado

```
1. HOME → tile «Cobros» → tile «COBRO»   ← click REAL; comp.nuevoCobro(0) NO renderiza el form
2. #clienteSelectModal.present() → input.focus() → type(codigo) → Enter → click en el <p> del nombre
3. Moneda: 2.o ion-select de app-cobro-general, asignar el OBJETO de la option + ionChange
4. Comentario: el ion-input cuyo <input> tiene required===true   (requiredComment=true)
5. Tab Documentos (ion-segment.value + ionChange) → checkbox de la factura
6. Tab Pagos → AGREGAR METODO DE PAGO (una vez por metodo) → bancos → montos
7. Enviar: .imagenEnviar → shadowRoot button.click()
8. Recorrer alertas: «El Cobro sera enviado» [Aceptar] → «Cobro nro. N enviado exitosamente» [OK]
```

### Oráculo

- **Envío:** la **3.ª alerta** («Cobro nro. N enviado exitosamente») es el único acuse del servidor; con
  anticipo automático sale además «Anticipo nro. N+1 enviado exitosamente».
- **Nube:** `SELECT … FROM collection WHERE id_collection > <baseline>` y
  `collection_payment WHERE id_collection = <Ref>`. El **Nro. Ref de la UI = `id_collection`**.
- **Guardado sin enviar:** local `collections.id_collection = 0` y `st_delivery = 3`, con
  `pending_transactions` vacía ⇒ **`BD-SAVED`**.
- **Bancos:** `id_bank` / `na_bank` frente a `co_client_bank_account` / `nu_client_bank_account` /
  `nu_bank_account`, **contrastados contra el detalle web**, que es quien decide qué columna es «Emisor»
  y cuál «Receptor» **por método**.
- **Tags de mensajes:** `application_tags` en la nube frente a la tabla homónima del SQLite del equipo;
  si difieren, **falta un login nuevo**.

### Qué NO es automatizable / qué cuesta caro

| Cosa | Estado |
|---|---|
| Arrastrar el FAB de la calculadora | ✅ **sí es automatizable** (mouse down/move/up) — corrige la expectativa previa |
| Abrir el FAB con `mouse.click` | ❌ no dispara — usar `shadowRoot button.click()` |
| Marcar varios métodos de pago de una vez | ❌ el modal es de selección única |
| Bajar una VG o un tag corregido | ❌ solo con **login nuevo** (~60 s); «Sincronizar» del HOME no los trae |
| Limpiar `createAutomatedPrepaid` / `discountRemnantPrepaidAmount` | ❌ solo **reiniciando la app** (`am force-stop` + relanzar + re-`adb forward` al nuevo webview PID) |
| Campo «Número de referencia» de Pago Móvil | acepta **solo dígitos** — `PMREF001` queda en `001` |
| Método **Otros** | exige elegir **código de diferencia** antes de Enviar, o el envío se rechaza con alerta |
| Leer credenciales sin exponerlas en el código | `page.goto('file:///…qa-credentials.env')` + `document.body.innerText` en la página del MCP (en `browser_run_code_unsafe` no hay `require` ni `fs`) |

## Resumen

| Punto | Veredicto |
|---|---|
| 1 · Calculadora flotante (abre/opera/cierra · arrastre · oclusión) | ✅ **PASS** |
| 2 · Checkbox vs modelo al rechazar un descuento que supera el 85 % | ✅ **PASS** |
| 3 · Descuento > saldo ⇒ anticipo por el excedente | ❌ **FAIL** (el tag `COB_MSG_AUTOMATED_PREPAID` sí quedó corregido) |
| 4 · Banco Emisor en el campo de Banco Receptor | ✅ **PASS** (1 observación menor en Depósito) |

## Registros creados en sistema

| Ref | Detalle | Estado |
|---|---|---|
| `co_collection 1789067734443.0` | FAC 00022135 (120,00 USD) con descuento manual 200,00 | **Guardado en el equipo**, no llegó a la nube (evidencia del FAIL del punto 3) |
| **2643** | 6 métodos de pago, 931,00 USD sobre FAC 00022131 | Enviado · `BD-OK` |
| **2644** | Anticipo automático por el excedente de 60,00 USD | Enviado · `BD-OK` |
| **2645** | Cheque 640,00 USD sobre FAC 00022132, Banco Emisor BANCO MERCANTIL | Enviado · `BD-OK` |
