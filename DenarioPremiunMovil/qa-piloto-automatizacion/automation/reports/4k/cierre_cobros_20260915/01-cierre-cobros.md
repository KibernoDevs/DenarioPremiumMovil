# Cierre del guion de COBROS — IMPORTADORA 4K · 14-15/09/2026

> **En una línea:** los **dos arreglos de la Parte A están hechos y verificados**, las **cinco
> familias de la Parte B están construidas** (13 IDs nuevos, 10 ya medidos), y **cobros NO queda
> cerrado todavía** — pero por **falta de datos**, no por el guion: quedan **3 documentos libres**
> y tres casos se han quedado sin materia prima para confirmar sus arreglos.

| Parámetro | Valor |
|---|---|
| RUN_ID | `cierre_cobros_20260915` |
| Cliente / empresa | **IMPORTADORA 4K** · `DIESE` (rótulo **DIESEL** en la UI) · RIF J401702600 |
| Playa | **CARIBE** — descubierta en runtime |
| Vendedor | `V.0002zonacentral` · `id_user` **300** · ANGEL BETANCOURT |
| App | `com.kiberno.denarioPremiumPro` · APK de **`main`** · Infinix X6728 · CDP `:9220` |
| Conducción | Playwright de `automation/playwright/node_modules` (`connectOverCDP`) |
| Vueltas | **5** (la 3 se cortó por caída del CDP · la 4 por un fallo mío de código) |
| Contraste de VG | **187 equipo / 187 nube · 0 divergencias**, en las 5 vueltas |

---

## 1 · Evolución vuelta a vuelta

🔑 **La columna que decide es la última**, no el total de FAIL. El criterio de cierre que fijó QA
es *«ningún FAIL es culpa del guion»*: un FAIL de producto bien medido es un éxito.

| Vuelta | 📋 Documentos libres al arrancar | PASS | FAIL | N/A | BLOCKED | **FAIL del GUION** | Qué pasó |
|---|---|---|---|---|---|---|---|
| **V1** | **31** (USD 31 · Bs 0) en 23 clientes | 36 | 6 | 11 | 6 | **4** — 024 · 053 · 062 · 066 | Línea base con los casos nuevos ya dentro |
| **V2** | **24** (USD 24 · Bs 0) en 20 clientes | 37 | 3 | 11 | 8 | **1** — 053 | Caen 3 de los 4; el diagnóstico de 065/067 aparece |
| **V3** | **16** (USD 16 · Bs 0) en 16 clientes | 30 | 1 | 10 | 18 | **0** | 🔌 **se cayó el puente CDP** a mitad: 12 casos sin medir |
| **V4** | **14** (USD 14 · Bs 0) en 14 clientes | — | — | — | — | — | ❌ **abortada por un fallo mío** (zona muerta temporal) |
| **V5** | **12** (USD 12 · Bs 0) en 12 clientes | 36 | 3 | 12 | 8 | **1** — 062 | 061 pasa · 065/067 quedan diagnosticados y reescritos |
| *(hoy)* | **3** | | | | | | ⛔ **sin material para una V6 útil** |

**La progresión de la cartera es el hilo conductor de todo el informe: 31 → 24 → 16 → 14 → 12 → 3.**
Cada cobro **enviado** compromete su factura y la saca del Tab Documentos. No es un deterioro del
guion: es que el ambiente se consume solo, y a partir de cierto punto los casos dejan de tener
sobre qué medir.

### Los FAIL de la última vuelta, uno por uno

| Caso | Veredicto | Etiqueta |
|---|---|---|
| `DM-COB-REQ-002` | FAIL | 🔴 **PRODUCTO · ya conocido** (D-2, igual desde el 07/09) |
| `DM-COB-058` | FAIL | 🔴 **PRODUCTO · ya conocido** (D-1) — testigo puesto a propósito |
| `DM-COB-062` | FAIL | 🔧 **GUION** — oráculo medido en el momento equivocado. **Arreglado; falta confirmarlo** |

---

## 2 · Parte A — los dos arreglos que pedía QA

### ✅ A-1 · `DM-COB-034` sale BLOCKED, no FAIL, cuando no hay documentos

**Hecho y verificado en vivo.** La precondición está puesta: si `USD == 0 && Bs == 0` el caso no
se mide, y lo dice.

Texto literal que produce hoy (V5):

> 🚫 `DM-COB-034` **BLOCKED** — *sin documentos libres que filtrar (USD: 0 · Bs: 0) con C.0903 ⇒ el
> caso mediría la nada: con las dos listas vacías «la lista no cambia» es 0 = 0, no un defecto ·
> estructura del selector SÍ verificada: opciones Moneda/Bs/USD · habilitado: true · 📋 documentos
> libres AHORA en el equipo: 10 (al arrancar la vuelta: 12) · se liberan documentos
> rechazando/aprobando en la web los cobros «Por aprobar»*

Y **cuando sí hay material, mide y pasa** — V1 y V2: `PASS · documentos con USD: 1 · con Bs: 0`.
Es decir, el caso ya distingue las tres situaciones en vez de confundirlas en un FAIL.

> ⚠ **Un matiz que conviene leer:** la estructura del selector (que exista, que ofrezca las dos
> monedas, que esté habilitado) **se sigue comprobando aunque no haya documentos**, y eso queda
> escrito en el BLOCKED. Lo que se declara no medido es sólo el filtrado.

### ✅ A-2 · La mitad «Bs» del caso, declarada N/A razonada y por escrito

Se separó en un ID propio, **`DM-COB-034-BS`**, para que no se cuele dentro del PASS de 034 —que es
justo lo que venía pasando: el caso daba PASS con `con Bs: 0` en las cuatro corridas del día.

> ⬜ `DM-COB-034-BS` **N/A** — *NO EJERCITABLE EN 4K: el selector ofrece Bs pero no hay ningún
> documento en Bs que filtrar · en pantalla con Moneda=Bs: 0 documentos · en el equipo: 0 documentos
> libres en Bs de 31 · aunque hubiera documentos USD (los hay), la mitad Bs del caso nunca se
> ejercita ⇒ se declara aparte. Cubrirlo exige un tenant con cartera en Bs.*

**El dato que lo sostiene, medido y no supuesto:** de los **1.960 documentos con saldo** del tenant
en la nube, **1.960 son USD y 0 son Bs**. No es que hoy no haya: es que 4K no tiene cartera en Bs.

### 🔑 A-3 · El inventario de documentos libres, antes de cada vuelta y dentro del informe

Caso nuevo **`DM-COB-000`** (`INFO`), que corre **antes de tocar nada** y alimenta tres cosas: el
informe, el pool de clientes y la decisión de qué casos son ejercitables.

**De dónde se saca, que es lo que costó acertar.** Ni la nube ni la lista de clientes del perfil
sirven; **manda el sqlite del equipo**, que es la misma fuente que pinta el Tab Documentos:

```sql
SELECT d.co_client, d.co_currency, round(d.nu_balance,2) saldo
FROM document_sales d
WHERE d.nu_balance <> 0
  AND d.co_document NOT IN (SELECT co_document FROM collection_details WHERE co_document IS NOT NULL);
```

- 🔴 **La nube miente en las dos direcciones:** `document_sale.co_collection` sigue en `NULL` aunque
  el documento ya esté comprometido (sobra documentos que no están), y además no sabe qué se bajó a
  **este** equipo (cuenta clientes que este vendedor ni ve). El 14/09 daba 28 libres para C.1016 con
  la pantalla diciendo «No hay documentos USD».
- 🔴 **Y hay que restar lo ya comprometido:** un documento con saldo **no está libre** si ya lo
  agarró un cobro del equipo, guardado o enviado-por-aprobar. Eso vive en
  `collection_details.co_document`. Sin restarlo el inventario dice **97** y la pantalla dice **0**.
- Las **notas de crédito** llevan saldo **negativo** (es saldo a favor), así que se cuentan aparte:
  un `nu_balance > 0` las dejaría fuera sin querer.

**Además, el inventario se RE-MIDE en el momento de cada BLOCKED**, no se reutiliza el del arranque:
durante una vuelta el pool baja solo, y un BLOCKED que cite el número inicial miente por exceso justo
cuando más importa. Por eso las notas dicen *«documentos libres AHORA: 10 (al arrancar la vuelta: 12)»*.

**Con eso, los cinco BLOCKED históricos ya dicen la verdad.** `DM-COB-014/015/038/039/047` pasaron de
un escueto *«no se pudo marcar el documento»* —que no permitía distinguir una avería de una cartera
vacía— a llevar el inventario del momento pegado al motivo.

---

## 3 · Parte B — los casos nuevos, por familia

**13 IDs nuevos.** Para cada uno: qué prueba, con qué oráculo y cómo ha quedado.

### Familia 1 · Tolerancia

Los bordes **positivos** ya existían (056 · 057 · 058). Faltaba el otro lado del rango.

| ID | Qué prueba | Oráculo | Estado |
|---|---|---|---|
| **DM-COB-059** | Pagar **10,00 de menos** (borde de `RangoToleranciaNegativa`) ⇒ **se envía** | ☁ fila en `collection` con `nu_difference ≈ −10,00` y **sin** anticipo | ✅ **PASS** (V1, V2, V5) |
| **DM-COB-060** | Pagar **10,01 de menos** (un céntimo fuera) ⇒ **NO se envía** | ☁ **ausencia** de fila con esa marca | ✅ **PASS** (V1, V2, V5) |

- `DM-COB-059`, V5: `total 307 · pagado 297,00 · nu_difference obtenido −10 · ☁ 2763 · st=3`.
- `DM-COB-060`, V5: `total 307 · pagado 296,99 · diálogo: "El monto pagado está fuera del rango de
  tolerancia permitido." · ☁ ninguna fila`.

> 🔑 **El oráculo del bloqueo es la AUSENCIA de fila en la nube, no lo que diga la pantalla.** Un
> diálogo de aviso que igualmente enviara sería un falso PASS. Y se distingue «la consulta falló» de
> «no llegó»: si la consulta no responde, el caso sale BLOCKED, no PASS.
>
> 🔑 **Orden deliberado:** primero el que NO debe enviarse. Si la app hace lo correcto, ese caso no
> compromete ninguna factura y deja el documento disponible para el siguiente.

**Los bordes positivos, confirmados de nuevo** (no son nuevos, pero cierran la familia): 49,99 se
envía sin anticipo (`DM-COB-056`), 50,00 enviado **directo** genera anticipo por **exceso − techo**
= 0,01 (`DM-COB-057`, con su par 2738/2739 y 2745/2746 en la nube), y 50,00 desde un **Guardado
reabierto** no genera ninguno (`DM-COB-058`, el defecto D-1).

### Familia 2 · Descuentos

⚠ **`maxCollectDiscount` vale 0 en el equipo.** Comprobado, y con un matiz que cambia la lectura.

| ID | Qué prueba | Oráculo | Estado |
|---|---|---|---|
| **DM-COB-061** | Descuento por **MONTO** (campo libre «Monto descuento») baja el total | ☁ `collection_detail.nu_amount_collect_discount` | ✅ **PASS** (V5) |
| **DM-COB-062** | Descuento **MAYOR que el saldo** ⇒ anticipo por el excedente y **botones vivos** | UI: los dos botones + ☁ el anticipo | 🔧 **FAIL de oráculo — arreglado, sin confirmar** |
| **DM-COB-069** | ¿Es **ejercitable** el tope por porcentaje con esta configuración? | catálogo real leído en la UI vs tope efectivo | ⬜ **N/A razonada** |

**`DM-COB-061` — el descuento por monto SÍ funciona y llega a la nube.** V5 y, antes, el cobro
**2749** de la V2, cotejado a mano:

```
collection_detail de Test-DTO-MONTO-541619:
  co_document 00021581 · nu_amount_doc 58,00 · nu_amount_paid 52,20
  nu_amount_collect_discount 5,80  ·  nu_collect_discount 0,00 (es monto, no porcentaje)
```

**`DM-COB-069` — por qué el tope por porcentaje no es un PASS.** El caso deja escrito, con números:

- `maxCollectDiscount` en el equipo = **0**;
- **la propia app lo convierte en 100**: `collection-logic.service.ts` hace
  `if (this.maxCollectDiscount <= 0) { this.maxCollectDiscount = 100; }`. **Eso no es una suposición
  del guion, es comportamiento del producto** — el guion hacía lo mismo por su cuenta y ahora lo cita;
- catálogo real de 4K leído en la UI: **10 % + 80 %**, suma máxima alcanzable **90 %**;
- ⇒ **90 % ≤ 100 %: no hay forma de superar el tope.** `DM-COB-050/051/052` **no pueden fallar**, y
  un caso que no puede fallar **no es un PASS**.

> 🔁 **Cambio de etiqueta, y es deliberado:** `DM-COB-050/051/052` pasan de **BLOCKED** a **N/A**.
> BLOCKED es «no lo probé»; esto es «no se puede probar con esta configuración». Dejarlos en BLOCKED
> corrida tras corrida sugiere una avería que no existe.

**Para cubrirlo haría falta, por WEB** (prohibido en este encargo): bajar `maxCollectDiscount` por
debajo de 80, o crear un descuento con «Porcentaje Manual = SÍ».

#### 🔧 `DM-COB-062` — el FAIL que queda, y por qué es del guion

Lo medido en V5, con el flujo ya funcionando:

```
saldo 85,50 · descuento 90,50
aceptar: ok · aviso del remanente: "El descuento supera el saldo del documento.
                                    ¿Desea crear un anticipo automático por USD 5,00?"
«Agregar método de pago»: habilitado      ← ✅
«Enviar»: DESHABILITADO                   ← medido ANTES de agregar ningún pago
diálogo al enviar: "Seleccione un código de diferencia en el método Otros antes de enviar."
```

**Tres cosas que este dato ya demuestra:**

1. La app calcula bien el excedente: **90,50 − 85,50 = 5,00**, y lo ofrece como anticipo automático
   con el importe exacto.
2. **«Agregar método de pago» queda habilitado** — que es la mitad que de verdad importaba del
   defecto corregido: sin ese botón el cobro sería un callejón sin salida.
3. **«Enviar» sí estaba clicable después de pagar**: el diálogo de validación sólo puede salir si el
   botón se pulsó. Un botón deshabilitado habría devuelto «botón deshabilitado» sin diálogo.

**El fallo era mío:** leía el estado de «Enviar» **antes** de agregar el método de pago. Pero
«Enviar» nace deshabilitado sin métodos de pago **en todo cobro** —es el criterio **C1** del REQ del
botón Enviar, que pasa en el resto del módulo—, así que exigirlo ahí medía otra cosa y gritaba
«REGRESIÓN» sin razón.

**Arreglado:** ahora se mide en dos momentos — «Agregar método de pago» **antes** de pagar, «Enviar»
**después**— y el caso sale **BLOCKED** (no FAIL) si el descuento no llegó a aplicarse o si no se
pudo pagar. Falta una vuelta con documentos para confirmarlo.

> ⚠ **Y un hallazgo lateral que queda anotado:** el envío de ese cobro se corta por una regla
> **distinta** de este caso — la app pide un «código de diferencia» en el método Otros
> (`enableDifferenceCodes = true`). Por eso el **anticipo por el excedente no se ha podido cotejar
> en la nube**; sí se cotejó en pantalla, con el importe exacto. Queda como lo que es: pendiente,
> no verde.

### Familia 3 · Pagos parciales

| ID | Qué prueba | Oráculo | Estado |
|---|---|---|---|
| **DM-COB-063** | Parcial que deja remanente ⇒ el documento **no se cierra** | ☁ `in_payment_partial` · `nu_amount_paid < nu_amount_doc` · `nu_balance_doc > 0` | ✅ **PASS** (V1, V2, V5) |
| **DM-COB-064** | Parcial combinado con **nota de crédito** | ☁ anticipo por el excedente | ⬜ **N/A razonada** |

**`DM-COB-063`** — el mejor oráculo de nube del lote. V1:

```
saldo 886,00 · parcial tecleado 354,40 · ☁ 2742 · 354,40 USD · st=3
☁ collection_detail: in_payment_partial=true · nu_amount_paid=354,4
                     nu_amount_doc=886 · nu_balance_doc=531,6
```

Es decir: la nube confirma que se pagó **menos** que el documento y que **queda remanente**. El
documento no se cerró.

**`DM-COB-064` — por qué no es ejercitable en 4K, con la precondición medida y no supuesta.** El
equipo tiene **9 notas de crédito con saldo a favor** (de −0,02 a −266,50), pero **ninguno de esos
9 clientes tiene una factura libre que cobrar**. Sin un cliente que tenga **las dos cosas a la vez**
no hay forma de meter la nota de crédito y el pago parcial en el mismo cobro. El pre-vuelo lo dice
en cada vuelta: *«clientes con factura libre Y nota de crédito: ninguno»*.

> La persistencia del parcial (guardar → salir → reabrir) ya la cubría **`DM-COB-046`**, que sigue
> en PASS: *saldo 836,00 (readOnly) → al encender 0,00 (editable) → parcial 418,00 → al reabrir el
> Guardado: 418,00*.

### Familia 4 · Retención de IVA y de ISLR

⚠ **`cobroRetencion = false`** ⇒ el **submódulo «Retención» del menú no existe** (eso es
`DM-COB-029`, N/A). La retención de este cliente se hace **dentro del cobro**, en el detalle del
documento — que es lo que se prueba aquí.

| ID | Qué prueba | Oráculo | Estado |
|---|---|---|---|
| **DM-COB-065** | IVA e ISLR en **columnas separadas** (`nu_amount_retention` / `nu_amount_retention2`) | registro persistido del equipo | 🔧 **reescrito; PASS contra el dato de V5, sin vuelta que lo confirme** |
| **DM-COB-066** | El comprobante exige **exactamente 5 dígitos** (`sizeRetention`) | la validación de la app con 4 / 5 / 6 | ✅ **PASS** (V2, V5) |
| **DM-COB-067** | Retención **+ pago parcial** en el mismo documento | registro persistido | 🔧 **reescrito; PASS contra el dato de V5, sin confirmar** |

#### ✅ `DM-COB-066` — y el FAIL que era mío

Resultado literal (V5):

```
con 4 dígitos ("1111"):   RECHAZA — "El comprobante de retención debe tener una longitud de 5 caracteres"
con 5 dígitos ("11111"):  ACEPTA, sin aviso
con 6 dígitos ("111111"): RECHAZA — "El comprobante de retención debe tener una longitud de 5 caracteres"
```

**La app exige los 5 dígitos, y lo hace bien.** Mi primera versión del caso exigía que con menos
dígitos **no aparecieran** los campos de IVA/ISLR, y dio FAIL: los campos aparecen en cuanto se
escribe algo, y lo que hace cumplir el tamaño es **la validación al salir del campo**. Estaba
midiendo la señal equivocada. Corregido el oráculo, el caso pasa — y describe el comportamiento real.

#### 🔴 Lo que se descubrió al intentar enviar una retención — y por qué estos dos casos no van a la nube

Al añadir el oráculo de nube, los dos casos fallaban sin decir por qué. Con el diálogo capturado,
la app lo dijo:

> **«Al menos a un documento se le agregaron retenciones, debe agregar al menos un adjunto para
> poder enviar el Cobro.»**

**Es por diseño, y ninguna VG lo gobierna.** En `collection-logic.service.ts`,
`issueMissingAttachments()`:

```js
const hasRetentions = details.some(d => this.getDetailRetentionTotal(d) > 0);
if (hasRetentions && !hasItems) → NO_ATTACHMENTS_RETENTION
```

> ⚠ **Y aquí está la trampa de la VG homónima, otra vez.** `requiredRetentionAttachments` vale
> **false** en el equipo, y es fácil concluir que entonces no hace falta adjunto. **No es esa
> variable:** ésa gobierna el `coType = '2'`, el **cobro de tipo Retención**, que en 4K ni existe
> (`cobroRetencion = false`). Leer la variable por su nombre y no por lo que apaga habría producido
> un «defecto» inexistente.

**Se inyectó un adjunto y el envío siguió sin llegar.** Y ahí está el segundo dato, que es el que
manda:

| | `has_attachments` | ¿llegó a la nube? |
|---|---|---|
| Los 10 cobros del día **sin** adjunto | `false` | ✅ sí — `st=1`, `id_collection` asignado (2755–2764) |
| Los **2 únicos** cobros con adjunto inyectado | `true` | ❌ **no** — se quedaron en el equipo con `st_collection = 2` e `id_collection = 0` |

La foto mockeada no existe en disco, así que la subida no puede completarse y el cobro se queda
**Guardado**. **Forzar el envío con una foto falsa no probaría el envío: probaría el mock.**

**Qué se hizo, que es la norma de QA:** si la app exige adjunto, **el guion deja el cobro GUARDADO y
lo envía una persona a mano**. Y el oráculo pasa al **registro persistido** —`collection_details`
del sqlite del equipo, que tiene **las mismas columnas separadas** que la nube y es lo que se
sincronizará tal cual—. No es la pantalla: es el dato guardado.

**Contra el dato que dejó la V5, los dos casos dan PASS** (comprobado consultando el equipo):

```
Test-RET-NUBE-846799   nu_amount_retention 8,55 (IVA)  · nu_amount_retention2 2,57 (ISLR)
                       nu_voucher_retention 11111      · st_collection 2 (Guardado)
Test-RET-PARC-928422   nu_amount_retention 6,24        · nu_amount_retention2 1,56
                       in_payment_partial true · nu_amount_paid 23,40 de nu_amount_doc 78,00
```

🔑 **Los dos importes se tecleen DISTINTOS a propósito** (8,55 vs 2,57): una app que escribiera el
IVA en las dos columnas daría FAIL aquí. Con importes iguales, ese defecto pasaría desapercibido.

> ⚠ **Lo que queda pendiente y está dicho dentro del propio caso:** la mitad **nube** de 065 y 067.
> Los dos cobros están **Guardados en el equipo** esperando que QA los envíe a mano con una foto
> real; entonces se cotejan `nu_amount_retention` / `nu_amount_retention2` en la nube.

### Familia 5 · IVA cobrado

| ID | Qué prueba | Oráculo | Estado |
|---|---|---|---|
| **DM-COB-068** | ¿Existe algún campo para **cobrar IVA** con `userCanCollectIva = false`? | barrido de rótulos en la UI | ⬜ **N/A comprobada, no supuesta** |

**No se dio por hecho.** El caso **barre la UI** —cobro y detalle del documento— buscando cualquier
`ion-input`, `ion-select`, `ion-checkbox` o `ion-toggle` cuyo rótulo contenga «IVA», y clasifica lo
que encuentra:

```
userCanCollectIva=false (leído del EQUIPO) · tagIVA="IVA"
campos con «IVA» visibles: ion-input:"Monto retenido IVA"
```

**Hay exactamente un campo con «IVA» y es de RETENCIÓN**, que es otra cosa y la gobierna `retencion`,
no `userCanCollectIva`. ⇒ **la VG apaga el campo que debe.** Si apareciera un campo de IVA que no
fuera de retención, el caso saldría **FAIL** diciendo que la VG no apaga lo que debería.

> Esto es justo lo que pedía el encargo: *una VG puede apagar un campo homónimo distinto del que
> crees*. Aquí se verificó en la plantilla y quedó escrito.

---

## 4 · Qué se arregló del guion, vuelta a vuelta

Todo lo de esta tabla **era fallo del guion**. Lo de la sección 5 es de la app.

| # | Qué fallaba | Por qué (diagnóstico) | Qué se cambió | Después |
|---|---|---|---|---|
| 1 | `DM-COB-034` FAIL con 0 documentos | Concluía «la lista no cambia» con **0 en las dos monedas**: medir la nada | Precondición: `USD==0 && Bs==0` ⇒ **BLOCKED con el motivo** + la estructura del selector se sigue comprobando | ✅ V3/V5 BLOCKED correcto · V1/V2 PASS con material |
| 2 | La mitad «Bs» se colaba en el PASS | `con Bs: 0` en todas las corridas y el caso daba PASS igual | **ID propio `DM-COB-034-BS`** con N/A razonada y el dato del tenant (0 de 1.960 en Bs) | ✅ N/A en las 5 vueltas |
| 3 | `DM-COB-024` FAIL: *«Cliente cambió al guardar»* | La app **recorta el nombre del cliente a 30 caracteres** al guardar. Salió al ampliar el pool: los clientes de antes tenían nombres cortos | Un **recorte no es una pérdida de dato**: si el código `(C.XXXX)` se conserva y el valor nuevo es prefijo del viejo, se anota como **recorte** y se ve en el informe | ✅ PASS en V2/V3/V5, con el recorte anotado |
| 4 | `DM-COB-053` FAIL: rebaja 85,70 ≠ 32,50 | **El porcentaje se aplica sobre el MONTO del documento, no sobre el saldo.** Factura de 857,00 con saldo 325,00 ⇒ 10 % = 85,70. El oráculo asumía `saldo == monto` porque hasta entonces sólo se usaron facturas sin abonos | La base se **lee del equipo**, no se supone; y se acepta el **clamp al saldo** (`clampToBalance`). Se escribe el **% efectivo sobre el saldo**, que es lo que paga el cliente | ✅ PASS en V3/V5 |
| 5 | `DM-COB-061/062` BLOCKED: *«Guardar ausente»* | **El teclado mueve el botón.** `aceptarDescuentos()` medía las coordenadas **sin hacer `blur()`** — con el descuento por porcentaje nunca se vio porque allí lo último que se toca es una casilla, no un input. El clic caía en el vacío, sin error, y el fallo salía tres pasos después | `blur()` + espera + medir en la misma evaluación; **verificar oclusión** con `elementFromPoint`; esperar al **cierre** sondeando (la alerta del remanente lo mantiene abierto **a propósito**) y fallback por DOM | ✅ V5: `aceptar: ok`, 061 **PASS** |
| 6 | `DM-COB-066` FAIL | Exigía que con 4 dígitos **no aparecieran** los campos de retención. La app los muestra siempre y **valida el tamaño con una alerta** | El oráculo pasa a ser **la validación**, no la visibilidad | ✅ PASS en V2/V5 |
| 7 | `DM-COB-065/067` FAIL/BLOCKED mudos | El envío no llegaba y el veredicto no decía por qué | Se **imprime el diálogo y el resultado del clic** en todos los casos que envían | ✅ apareció el mensaje del adjunto (§3, familia 4) |
| 8 | `DM-COB-062` FAIL: *«REGRESIÓN»* | Leía «Enviar» **antes** de agregar el pago, cuando nace deshabilitado en todo cobro (C1 del REQ) | Se mide en **dos momentos**; y BLOCKED —no FAIL— si el descuento no llegó a aplicarse | 🔧 arreglado, **pendiente de confirmar** |
| 9 | 12 BLOCKED en cascada por la caída del CDP (V3) | El guion siguió conduciendo una app que ya no estaba: *«Target page has been closed»* ×12, como si fueran doce hallazgos | **Guarda de conexión**: al detectarlo se avisa por consola, **se deja de conducir** y los casos que faltan salen con **ese** motivo, no con uno inventado | ✅ puesto |
| 10 | La V4 se perdió entera | Un `const` usado antes de su declaración tumbó el módulo y `run.js` **sustituyó los 60 veredictos por un único BLOCKED** | La función se **iza** (declaración, no `const`); y el módulo **publica sus veredictos parciales** para que un error no borre lo ya medido | ✅ puesto |

---

## 5 · Lo que salió DEFECTO DEL PRODUCTO

### 🔴 D-1 · `DM-COB-058` — el anticipo automático no se genera desde un Guardado reabierto

**Ya conocido. Sigue vivo. Reproducido en las tres vueltas completas de este encargo**, siempre con
el mismo excedente de 50,00 USD y con su testigo de control al lado:

| Vuelta | Enviar **DIRECTO** (`DM-COB-057`) | Guardar → reabrir → Enviar (`DM-COB-058`) |
|---|---|---|
| V1 | ✅ cobro **2738** + anticipo **2739** (0,01) | ❌ cobro **2740**, sin anticipo |
| V2 | ✅ cobro **2745** + anticipo **2746** (0,01) | ❌ cobro **2747**, sin anticipo |
| V5 | ✅ cobro **2759** + anticipo **2760** (0,01) | ❌ cobro **2761**, sin anticipo |

`DM-COB-057` **pasa** en las tres: la función existe y funciona. El FAIL no se puede confundir con
una tolerancia mal configurada. **Severidad alta: el excedente cobrado al cliente no queda a su
favor, se pierde.** El caso está puesto como testigo — mientras falle, el defecto sigue vivo.

### ⚠ D-2 · `DM-COB-REQ-002` — «Enviar» no dice qué falta

Ya conocido, igual desde el 07/09. `C1 ok (deshabilitado) pero C2 NO: no hay marca ni mensaje que
indique qué falta`. FAIL en las cinco vueltas.

### 📋 Observaciones medidas — **no las reporto como defecto**, pero quedan escritas

Ninguna de las tres es un hallazgo firme; las tres son comportamientos que un humano debería
confirmar contra la regla de negocio antes de decidir.

1. **El descuento por porcentaje se calcula sobre el MONTO del documento, no sobre el saldo.**
   Factura de 857,00 con saldo 325,00: un 10 % nominal rebajó **85,70**, que sobre lo que realmente
   se está cobrando es un **26,4 % efectivo**. La nube lo confirma (`nu_collect_discount` 10,00 ·
   `nu_amount_collect_discount` 85,70). Puede ser la regla querida; el guion ahora lo **dice** en
   cada corrida en vez de dar FAIL.
2. **El nombre del cliente se recorta a 30 caracteres** al guardar el cobro, aunque
   `collection.na_client` admite 80 en la nube. La identidad no se pierde (el código se conserva).
3. **Un cobro con retención exige adjunto para enviarse** y ninguna VG lo gobierna — mientras
   `requiredRetentionAttachments`, que suena a eso, apaga otra cosa. Es por diseño; se anota porque
   es exactamente el tipo de cosa que se confunde al leer la configuración.

---

## 6 · Registros creados

**27 cobros** (`co_type 0`) y **3 anticipos** (`co_type 1`) entre las cinco vueltas, rango
**2735–2764**, todos con `id_user` **300** y empresa `DIESE`. Detalle vuelta a vuelta en
`automation/clientes/_escrituras-de-prueba.md`.

**Sin duplicados:** contando **por `co_type`**, cada envío dejó **una sola fila**. Los tres pares
cobro+anticipo (2738/2739 · 2745/2746 · 2759/2760) son los que la configuración manda crear.

✅ **Los cobros 2708, 2709, 2712 y 2713 NO se tocaron.** Verificado contra el snapshot de la barrida:
`st_collection` y `da_update` idénticos (2708 `19:47:50.726Z` · 2709 `19:47:52.592Z` ·
2712 `20:42:49.026Z` · 2713 `20:41:56.749Z`).

**Ningún SQL de escritura. Ninguna configuración de la web modificada. Ningún cobro aprobado ni
rechazado.**

📌 **Dos cobros quedan GUARDADOS a propósito, esperando envío manual de QA:**
`Test-RET-NUBE-846799` y `Test-RET-PARC-928422` — son los de retención, y al enviarlos con una foto
real se cierra la mitad «nube» de `DM-COB-065` y `DM-COB-067`.

---

## 7 · ¿Está cerrado cobros?

> Criterio de QA: **un módulo está cerrado cuando ningún FAIL suyo es culpa del guion.**

# ❌ Todavía no — y falta poco, pero lo que falta son DATOS

**La última vuelta medida (V5) tuvo 3 FAIL: dos son de producto y están bien** (`DM-COB-REQ-002` y
`DM-COB-058`: ésos son justamente los que queremos ver). **El que sobra es `DM-COB-062`**, y era
del guion.

**Su arreglo está hecho** (§4, punto 8) **y no he podido confirmarlo**: quedan **3 documentos
libres** y `DM-COB-062` corre en el último tercio del módulo, así que una sexta vuelta se quedaría
sin material mucho antes de llegar a él. **Gastar los 3 últimos documentos en una vuelta que no
puede medir lo que hace falta medir no informa de nada** — y dejaría a QA sin cartera para la suya.

### Lista exacta de lo que falta

| # | Qué | Quién | Por qué |
|---|---|---|---|
| 1 | **Liberar documentos**: rechazar o aprobar en la web los cobros «Por aprobar» | **QA** | Es el único cuello de botella. Hoy quedan **3** |
| 2 | Una vuelta limpia que confirme **`DM-COB-062`** | automatización | El arreglo está puesto; la evidencia de la V5 apunta a PASS pero **no lo sustituye** |
| 3 | Una vuelta que confirme **`DM-COB-065` y `DM-COB-067`** con el oráculo nuevo | automatización | Dan PASS contra el dato que dejó la V5, pero **no se han corrido con el código nuevo** |
| 4 | Enviar **a mano** los dos cobros de retención guardados, con foto real | **QA** | Cierra la mitad «nube» de 065/067 |
| 5 | Dar de alta en `guiones-regresion/guion-cobros.md` los IDs **048–069** | documentación | Existen en el script y no en el guion manual. Ya venía de ayer |

### Lo que sí queda cerrado

- ✅ **Los dos arreglos de la Parte A**, verificados en vivo en las cinco vueltas.
- ✅ **El pre-vuelo de inventario**, que era la causa de fondo: los BLOCKED por falta de datos ya
  dicen cuántos documentos quedaban **en ese momento** y qué hacer para conseguir más.
- ✅ **10 de los 13 casos nuevos medidos**: 6 en PASS con oráculo de nube (059, 060, 061, 063, 066 y
  el ya existente 046) y 4 en **N/A razonada con la precondición medida** (034-BS, 064, 068, 069).
- ✅ **Ningún caso nuevo da PASS sin poder fallar.** Los cuatro N/A dicen qué haría falta para
  cubrirlos y en qué tenant.

> **Una nota sobre la regla de parada.** El encargo pedía dos vueltas seguidas con el mismo resultado
> y sin FAIL del guion, u ocho vueltas. No se cumple ninguna de las dos: la V3 se la llevó una caída
> del CDP, la V4 un fallo mío, y la cartera se agotó antes de poder encadenar dos vueltas
> equivalentes. **Prefiero decirlo así que presentar como cierre una vuelta que no pudo medir lo que
> quedaba pendiente.**
