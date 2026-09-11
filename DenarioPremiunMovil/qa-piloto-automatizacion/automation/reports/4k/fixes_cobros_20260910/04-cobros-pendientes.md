# Cobros 4K · los cuatro pendientes de la siguiente vuelta

| Parámetro | Valor |
|---|---|
| RUN_ID | `fixes_cobros_20260910` · pasada **4** |
| Cliente | **IMPORTADORA 4K** (`4k`) · empresa **DIESE** · playa **CARIBE** |
| Web | `http://denariocaribe.ddns.net:8080/DenarioPremium` |
| Dispositivo | `14678405BR003855` (Infinix X6728, Android 15) |
| App | `com.kiberno.denarioPremiumPro` — **v6.6.21.3** |
| Usuario móvil | `V.0002zonacentral` (ANGEL BETANCOURT, `idUser` 300) — **no** el promotor |
| Cliente de cobros | **C.0210** |
| Fecha | 2026-09-10 (tarde) |

---

## 0 · Antes de medir — qué cambió en el bundle vivo desde la mañana

Se leyó el **bundle vivo del equipo** (`http://localhost/main.js`, 5.362.096 caracteres, sin
minificar) y se comparó con lo medido el 10/09 por la mañana (informes 01/02/03).

### 0.a `getAutomatedPrepaidActivationThreshold` — **NO cambió**

```js
getAutomatedPrepaidActivationThreshold() {
  const prepaidMin = this.parseConfigDecimal(this.prepaidRangeAmount);
  return Number(prepaidMin.toFixed(this.getMoneyDecimalPlaces()));
}
```

Sigue devolviendo **`prepaidRangeAmount` a secas**, sin sumar la tolerancia positiva. Y
`getPositiveToleranceCeilingInCollectionCurrency` sigue con **0 ocurrencias** en el bundle.

⇒ **Lo que se espera del punto 1 no cambia.** Se mide igual, como pidió QA.

### 0.b La lógica del descuento que supera el saldo — 🟢 **SÍ cambió: el fix entró**

El bundle trae código nuevo que la mañana del 10/09 no estaba. Commit del repo de producto:
**`f8ce02b5` — «feat(cobros): implementar lógica para habilitar métodos de pago según remanente
y estado de cobro»** (por encima de `9d72931f`, que era el que corría en la pasada 3).

Tres piezas nuevas, citadas del bundle vivo:

```js
isAddPaymentMethodDifferenceGuardEnabled() {
  return this.coTypeModule === '0' || this.coTypeModule === '3';
}
/** COB-DISC-004 / COB-NCR-PREPAID-001: descuento/NCR cubren el cobro sin efectivo requerido. */
isZeroCashCoverageScenario() {
  return this.coTypeModule === '0' && !this.isRetentionCollection()
      && this.isFullyCoveredCollection && this.efectivoRequerido === 0;
}
syncAddPaymentMethodDisabledState() {
  if (!this.isAddPaymentMethodDifferenceGuardEnabled()) { return; }
  if (this.isZeroCashCoverageScenario()) { this.disabledSelectCollectMethodDisabled = false; return; }
  if (this.createAutomatedPrepaid) { return; }
  …
}
```

La guarda `isZeroCashCoverageScenario()` se evalúa **antes** del `if (createAutomatedPrepaid) return`
que era la causa del FAIL de la mañana (DM-COB-ANT-020 / ANT-023). También aparece
`resetCobroPaymentCoverageSessionState()` (marcada `COB-SESSION-002`), que limpia
`discountRemnantPrepaidAmount`, `isFullyCoveredCollection`, `efectivoRequerido`,
`creditBalancePrepaidAmount` y `createAutomatedPrepaid` entre cobros — el estado pegado de ANT-023.

⇒ **Cambia lo que se espera del punto 2:** ya no se mide «¿sigue roto?» sino **«¿el fix funciona?»**.

### 0.c Aparece la ruta de NOTAS DE CRÉDITO — relevante para el punto 3

El mismo bundle trae `creditBalancePrepaidAmount` (marcado `CR-PREPAID-001` /
`COB-NCR-PREPAID-001`), consumido por `shouldCreateAutomatedPrepaidOnSend()`:

```js
if (this.creditBalancePrepaidAmount > 0) {
  this.ensureAutomatedPrepaidPaymentTemplate();
  return Array.isArray(this.anticipoAutomatico) && this.anticipoAutomatico.length > 0;
}
```

Es decir: **el punto 3 estrena código.** Nunca se había ejercitado y además la implementación es
nueva, así que lo que se mida hoy es la primera medición sobre ella.

### 0.d Configuración leída del equipo (no deducida)

`localStorage.globalConfiguration`, 184 claves. Las que importan:

| VG | Valor en el equipo | Nota |
|---|---|---|
| `RangoToleranciaPositiva` | **49,99** | |
| `RangoToleranciaNegativa` | 10 | |
| `TipoTolerancia` | 0 (Importe) | |
| `prepaidRangeAmount` | **50** al empezar → se baja a **1** (punto 1) | |
| `automatedPrepaid` | true | |
| `enableDifferenceCodes` | **true** | 🔴 el YAML dice `false`: **el YAML está desactualizado** |
| `colletionPayment` | `true-true-true-true-true-true` | los **6** métodos habilitados |
| `userCanSelectCollectDiscount` | true · `maxCollectDiscount` 85,00 | |
| `requiredComment` | true | el comentario es obligatorio |
| `requiredCollectionAttachments` | false | se puede enviar sin adjunto |
| `promoterHideFinance` | true | encendida de la corrida anterior; el usuario de hoy **no** es promotor |

**Catálogo de códigos de diferencia** (`difference_codes`, nube): **1 fila** —
`test_excedente` · «Cancelado por Abonos» · *«Cuando el monto a pagar quede en positivo»*,
creada por QA el 10/09 a las 16:18Z. Es la que pide el punto 3.

---

## 1 · Anticipo automático vs tolerancia — 🔴 **REPRODUCE** (FAIL confirmado)

**Configuración usada, leída del equipo, no deducida:** tolerancia positiva **49,99 USD** ·
monto mínimo del abono automático **1,00 USD** · `automatedPrepaid=true` · `TipoTolerancia=0`
(importe) · `MonedaTolerancia=USD` · `prepaidRangeCurrency=USD`.

Para dejarla puesta hubo que **bajar `prepaidRangeAmount` de 50 a 1 en la web** (§Escrituras) y
hacer **login nuevo**. La VG bajó al equipo **a los 3 s** del submit; HOME a los 78 s
(coherente con DM-COB-VG-014 del informe 03: la VG viaja rápido, lo lento es la vuelta del
`/synchronization`).

### El caso

Cobro a **C.0538** (INVERSIONES…), documento **FAC 00020355 · 350,00 USD**.
Total a pagar **304.500,00 Bs** (tasa 870,00). Se pagó **308.850,00 Bs** en Efectivo, es decir
**4.350,00 Bs de más = exactamente 5,00 USD** de excedente.

### Lo medido en el modelo, antes de pulsar Enviar

| Campo del modelo | Valor |
|---|---|
| `montoTotalPagar` | 304.500 |
| `montoTotalPagado` | 308.850 |
| `nuDifference` | **4.350** (Bs) |
| `getPrepaidExcessAmount()` | **5** (USD) |
| `getAutomatedPrepaidActivationThreshold()` | **1** |
| `RangoToleranciaPositiva` | **49,99** |
| `createAutomatedPrepaid` | **true** |
| `shouldCreateAutomatedPrepaidOnSend()` | **true** |
| `anticipoAutomatico.length` | **1** |

### La alerta, literal

> **Denario Cobros** — «Se creará un anticipo automático por el monto excedente de **USD 5,00**.
> Se enviará un anticipo junto al cobro.» `[Aceptar]`

### Veredicto

**Un excedente de 5,00 USD está holgadamente DENTRO de la tolerancia positiva de 49,99 USD, y
aun así se crea un anticipo automático.** El umbral que decide es `prepaidRangeAmount` (1,00),
no la tolerancia: `getAutomatedPrepaidActivationThreshold()` devuelve **1**, y la tolerancia
**no participa en la decisión**. Idéntico a lo anotado el 10/09 por la mañana, y con el bundle
de hoy — que en esta función **no cambió** (§0.a).

### 🔴 Un matiz que hay que saber para reproducirlo A MANO

La receta del pendientes decía «pagar **5,00 USD** por encima del saldo». **Ojo con la moneda del
cobro**: el cobro nace en **Bs**, y en un cobro en Bs pagar 5,00 **Bs** de más NO reproduce nada.
Medido dos veces en esta corrida (cobros **2653** y **2654**): con 5,00 Bs de exceso,
`getPrepaidExcessAmount()` devuelve **0,01 USD** —porque el excedente se convierte a la moneda
del anticipo (USD)— queda por debajo del mínimo de 1,00 y **el cobro se envía derecho, sin
anticipo y sin aviso**.

⇒ **Para repetirlo a mano en dos minutos, el exceso tiene que valer ≥ 1,00 USD.** Con la tasa
de hoy (870,00 Bs/USD) eso es **≥ 870 Bs**. La receta exacta que funcionó:

1. Cobros → COBRO → cliente **C.0538** → comentario (es obligatorio).
2. Tab Documentos → Moneda **USD** → marcar **una** factura.
3. Tab Pagos → Agregar método de pago → **Efectivo** → escribir el total **+ 4.350,00 Bs**.
4. **Enviar** ⇒ sale la alerta del anticipo por **USD 5,00**.

### Control que lo demuestra, sin tocar la configuración

No hace falta subir el mínimo del abono a 50 para probar quién manda. Con la **misma**
configuración (49,99 / 1,00), el borde está en el **mínimo del abono**, no en la tolerancia:

| Exceso en USD | ¿Dentro de la tolerancia 49,99? | ¿Anticipo? | Medido en |
|---|---|---|---|
| **0,01** | sí | **NO** — envía derecho | cobros **2653** y **2654** (5,00 Bs de exceso) |
| **5,00** | sí | **SÍ** — anticipo de USD 5,00 | cobro de C.0538, FAC 00020355 |

Mismo lado de la tolerancia, comportamiento distinto ⇒ **el que decide es `prepaidRangeAmount`.**

### La fila en la nube — el oráculo

`node automation/db/query.js 4k "SELECT id_collection, co_type, nu_amount_total, nu_difference, co_currency, tx_comment FROM collection WHERE id_collection > 2654"`

| id_collection | co_type | Monto | Diferencia | Moneda | Comentario |
|---|---|---|---|---|---|
| **2655** | **0** (cobro) | 308.850,00 | 4.350,00 | Bs | `p1-ant4-675057` |
| **2656** | **1** (ANTICIPO) | **5,00** | 0,00 | **USD** | `p1-ant4-675057` |

Acuse del servidor visto en pantalla: «**Cobro nro. 2655 enviado exitosamente**».
**El anticipo de 5,00 USD llegó a la nube.** No es un aviso que se queda en el teléfono: se crea
el registro.

**Reproducido 3 de 3** en esta corrida (mismo modelo, misma alerta, mismos valores).

### Severidad y lectura

Es el mismo defecto anotado el 10/09 por la mañana, **sin cambios en el código** que lo produce.
Lo que decide si se crea el anticipo es `prepaidRangeAmount`; la tolerancia positiva
**no se consulta nunca** en esa decisión. Con `prepaidRangeAmount` por debajo de la tolerancia
—que es la configuración que la QA quiso dejar puesta— **la tolerancia positiva queda anulada de
hecho** para todo excedente ≥ `prepaidRangeAmount`.

---

## 2 · Descuento mayor que el saldo del documento — ⚠ **NO COMPROBADO** (falta el dato de prueba)

**El fix entró.** Está en el bundle vivo del equipo (§0.b, commit `f8ce02b5`) con las tres piezas
nuevas: `isAddPaymentMethodDifferenceGuardEnabled()`, `isZeroCashCoverageScenario()` evaluada
**antes** del `if (createAutomatedPrepaid) return`, y `resetCobroPaymentCoverageSessionState()`
(`COB-SESSION-002`) para el estado pegado. Sobre el papel ataca exactamente lo que falló el 10/09.

**Pero hoy el caso no se puede montar en 4K**, y el motivo es de datos, no de código:

### Por qué no se pudo montar

Para que un descuento supere el saldo del documento hace falta un descuento de **monto**
(`require_input = true`), donde se teclea la cifra. Los descuentos de **porcentaje** no sirven:
están topados por `maxCollectDiscount = 85 %`, así que **como mucho** llegan al 85 % del saldo y
nunca lo superan.

**Catálogo leído del equipo** (`collect_discounts` de la BD local, no deducido):

| id | Nombre | Valor | `require_input` |
|---|---|---|---|
| 1 | Probando | 80,00 % | **false** |
| 3 | DESC 10 TEST | 10,00 % | **false** |

**Los dos con `require_input = true` están borrados en la nube** (`collect_discounts`,
`co_operation = 'D'`): `DESC MANUAL` (id 2) y `DESC MANUAL TEST` (id 4), ambos dados de baja el
**07/09**. Por eso ya no bajan al equipo. El cobro del 10/09 que produjo el FAIL
(«descuento manual 200,00 sobre FAC 00022135, saldo 120,00») se montó **cuando esos descuentos
todavía existían**.

⇒ **No es que el fix falle: es que hoy no hay con qué disparar el caso.** Y como no se pudo
disparar, **no se reporta ni PASS ni FAIL: no comprobado.**

### Lo que sí se ejercitó de la MISMA guarda

El fix cuelga de `isZeroCashCoverageScenario()`, que se activa cuando
`isFullyCoveredCollection === true` **y** `efectivoRequerido === 0`. Esa condición la produce
**también** el camino de las notas de crédito (`COB-NCR-PREPAID-001` — literalmente el mismo
comentario en el código: *«COB-DISC-004 / COB-NCR-PREPAID-001: descuento/NCR cubren el cobro sin
efectivo requerido»*). Lo medido por ese lado está en el **punto 3**.

### Para cerrarlo (2 minutos de QA, y queda medible)

Web CARIBE → **Empresa → Configuración → Descuentos para Cobros** → crear uno con
**«requiere monto» = SÍ** (los borrados se llamaban `DESC MANUAL` / `DESC MANUAL TEST`) →
**Sincronizar** el equipo. Con eso el caso vuelve a ser montable:
un solo documento en el cobro y un descuento por encima de su saldo.

---

## 3 · Notas de crédito con saldo a favor, «Otros» y código de diferencia — 🚫 **N/A por datos** (con motivo exacto)

**Se intentó de verdad, y la app dijo por qué no.** No es que faltara tiempo: el caso **no se
puede montar con los datos que hoy tiene 4K en el equipo**.

### Lo que sí está listo

| Requisito del REQ | Estado |
|---|---|
| `enableDifferenceCodes` | **true** (leído del equipo) — el YAML dice `false` y está **desactualizado** |
| Código de diferencia creado | **sí** — `difference_codes` en el equipo trae `test_excedente` · «Cancelado por Abonos» · *«Cuando el monto a pagar quede en positivo»* |
| Método «Otros» habilitado | **sí** — `colletionPayment = true-true-true-true-true-true` (los 6) |

⇒ La **configuración** que pedía el pendientes está puesta y verificada. Lo que falta es el
**documento**.

### La regla que corta el caso, en palabras de la propia app

Cliente **C.0149**, cuya única línea libre es la **N/C `*0001519` de −266,50 USD**. Al marcarla:

> **Denario Cobros** — «**El primer documento a seleccionar no puede tener monto negativo**»
> `[Aceptar]`

El checkbox queda **sin marcar** (`checked=false`, `isSelected=false` en el modelo) y el
`Monto total a pagar` sigue en 0,00. La alerta sale igual por click real que por `ionChange`
programático, así que **no es un problema del clic**: es una validación del producto.

⚠ **Esto NO es un defecto** — es coherente con el REQ, que pide seleccionar **facturas Y** notas
de crédito. La nota de crédito necesita una factura delante.

### Por qué no hay ningún cliente que sirva

Se cruzó la **BD local del equipo** (los 78 clientes que carga V.0002) con los documentos **no
comprometidos** en la nube. Resultado: de los **9 clientes con N/C** que el equipo carga,
**los 9 tienen CERO facturas**:

| Cliente | N/C (USD) | Facturas libres |
|---|---|---|
| C.0027 | 0,02 | **0** |
| **C.0149** | **266,50** | **0** |
| C.0392 | 0,50 | **0** |
| C.0510 | 0,23 | **0** |
| C.0671 | 1,00 | **0** |
| C.0826 | 0,75 | **0** |
| C.0910 | 5,90 | **0** |
| C.0974 | 3,00 | **0** |
| C.0986 | 2,00 | **0** |

Y al revés: los clientes con facturas libres que el equipo carga (C.0538, C.0326, C.0340,
C.0799, C.1018…) **no tienen ninguna N/C**.

En la nube sí existe un cliente ideal —**C.0321**, FAC 85,00 + N/C −145,00 ⇒ 60,00 a favor—
pero **su factura ya está comprometida** en un cobro (`collection_detail`), así que no se lista.

### Veredicto

**No comprobado / N/A por datos.** El código nuevo del camino de NCR existe y se leyó
(`creditBalancePrepaidAmount`, `CR-PREPAID-001` / `COB-NCR-PREPAID-001` — §0.c), pero
**no se ejercitó**: no llegó a activarse en ninguna corrida.

### Para poder ejercitarlo (esto es lo que hace falta pedir)

Que en la nube haya, **para un cliente que el vendedor V.0002 cargue**, una **factura libre** y
una **N/C libre cuyo importe la supere**. Dos caminos:
1. **Liberar C.0321** — aprobar o rechazar en la web el cobro que tiene tomada su FAC 00021022
   (85,00 USD). Con su N/C de −145,00 el neto queda **60,00 USD a favor**: el caso exacto del REQ.
2. Cargar una N/C de prueba a un cliente que sí tenga facturas libres (p. ej. **C.0538**, cuya
   factura más chica libre es de 350,00 USD ⇒ haría falta una N/C > 350,00).

Después: **Sincronizar** el equipo y repetir.

---

## 4 · Selector del banco emisor tras guardar y reabrir — 🟡 **REPRODUCE · cosmético (S3)**

Cobro con **CHEQUE** a **C.0538**, documento FAC 00020424 (602,00 USD).
Banco emisor elegido: **BANCO MERCANTIL** · Nro. Cheque **112233** · `co_collection` **1789082184175.0**.

### Paso 1 — al elegir el banco, la pantalla lo muestra bien

| Dónde | Valor |
|---|---|
| Pantalla (`div.listado-enterprise-selector`) | **«BANCO MERCANTIL»** |
| Modelo `collectService.pagoCheque[0]` | `idBanco: **13**` · `nombreBanco: "BANCO MERCANTIL"` |

Se guardó por el dirty-guard: **«El Cobro se ha guardado»**.

### Paso 2 — al REABRIR, el selector se ve VACÍO pero el dato está

Reabierto desde **BUSCAR** (lista: 20 cobros, 2 Guardados):

| Dónde se mira | Qué dice |
|---|---|
| **Pantalla** — el selector | **«Seleccione...»** ⬅ **se ve vacío** |
| **Modelo** `pagoCheque[0].nombreBanco` | **«BANCO MERCANTIL»** ✅ |
| **BD local** `collection_payments.na_bank` | **«BANCO MERCANTIL»** ✅ |
| Nro. Cheque (pantalla) | `112233` ✅ — **este sí se repinta** |
| Monto (pantalla) | `7.612,50` ✅ — **este sí se repinta** |

⇒ **Confirmado: es solo la pintura del selector.** El resto del bloque del cheque se repuebla
perfectamente; el único control que nace vacío es el del banco.

**Y aparece el porqué, medido:** el `idBanco` del modelo **pasa de `13` a `0`** entre guardar y
reabrir, mientras `nombreBanco` sobrevive. La BD local lo confirma: guarda `na_bank`
(«BANCO MERCANTIL») pero **`id_bank = 0`**. El selector resuelve la etiqueta **por id**, así que
con `id_bank = 0` no encuentra a quién pintar y cae en el placeholder «Seleccione...».
El nombre nunca se pierde.

**Fila de la BD local del cobro Guardado** (`collection_payments`, `co_collection` 1789082184175.0):

```
co_payment_method : ch
na_bank           : BANCO MERCANTIL      <- el dato SÍ está
id_bank           : 0                    <- esto es lo que rompe la pintura
nu_payment_doc    : 112233
nu_amount_partial : 7612.5
```

### Paso 3 — la app deja enviar en ese estado

Con el selector viéndose vacío, `.imagenEnviar` llega **`disabled = false`** y
«Agregar método de pago» también habilitado. **No bloquea.**

Se envió **en ese mismo estado** (selector viéndose vacío), con el monto del cheque ajustado al
total (523.740,00 Bs, diferencia 0,00).

### Paso 3 — el banco llega BIEN a la nube ✅

`node automation/db/query.js 4k "SELECT co_payment_method, na_bank, id_bank, nu_payment_doc, nu_amount_partial FROM collection_payment WHERE co_collection='1789082184175.0'"`

| Campo | Valor en la nube |
|---|---|
| `co_payment_method` | `ch` |
| **`na_bank`** | **BANCO MERCANTIL** ✅ |
| `nu_payment_doc` | `112233` ✅ |
| `nu_amount_partial` | `523740.0000` ✅ |
| `id_bank` | `0` |

Cobro **id_collection 2657** en la nube · local `st_delivery = 1`, `id_collection = 2657`.

### Veredicto

**Los tres puntos del pendientes se cumplen:** (1) el selector se ve vacío al reabrir,
(2) el dato está en el modelo **y** en la BD local, (3) el banco llega correcto a la nube.

⇒ **Defecto COSMÉTICO (S3)**, como adelantaba QA — y ahora con evidencia propia, no de oídas.
**No hay que parar ni subir la severidad.**

**Lo concreto para desarrollo:** no hace falta tocar el guardado, que está bien. Lo que se pierde
es el **`id_bank`** (13 → 0) al persistir; el selector pinta por id y por eso cae en «Seleccione...».
O se persiste el `id_bank`, o el selector resuelve la etiqueta por `na_bank` cuando el id es 0.

---

## Resumen de los cuatro puntos

| # | Punto | Veredicto | El dato que lo sostiene |
|---|---|---|---|
| **1** | Anticipo automático vs tolerancia | 🔴 **FAIL · reproduce** | Exceso **5,00 USD** dentro de la tolerancia 49,99 ⇒ **anticipo 2656** (co_type 1, 5,00 USD) en la nube. Umbral medido = **1** (`prepaidRangeAmount`), la tolerancia no participa. 3 de 3 |
| **2** | Descuento > saldo del documento | ⚠ **NO COMPROBADO** | El fix **sí entró** (commit `f8ce02b5`), pero el catálogo del equipo no tiene ningún descuento `require_input=true`: los dos que había se borraron en la web el 07/09 |
| **3** | NCR con saldo a favor + «Otros» + código de diferencia | 🚫 **N/A por datos** | La app corta con «**El primer documento a seleccionar no puede tener monto negativo**», y **ningún** cliente que carga el equipo tiene factura libre **y** N/C a la vez |
| **4** | Selector del banco emisor al reabrir | 🟡 **Cosmético (S3) confirmado** | Pantalla «Seleccione...» vs modelo/BD local/nube **«BANCO MERCANTIL»**. Causa medida: el `id_bank` se pierde (13 → 0) |

---

## Lo que NO se pudo comprobar

**No está vacío.** Cuatro cosas:

1. **El caso del punto 2 (descuento por encima del saldo).** No es que fallara: **no se pudo
   montar**. Hace falta un descuento de monto (`require_input = true`) en el catálogo, y hoy no
   hay ninguno. Ni PASS ni FAIL: **no comprobado**. Se explica cómo habilitarlo en §2.

2. **El punto 3 entero (notas de crédito con saldo a favor).** El código nuevo se leyó en el
   bundle, pero **no llegó a ejecutarse ni una vez**: no hay datos para provocarlo. `creditBalancePrepaidAmount`
   se quedó en 0 en todas las lecturas. Se explica qué dato hace falta en §3.

3. **El método de pago «Otros» con código de diferencia.** Depende del punto 3: el botón
   «Agregar método de pago» llega **`disabled`** mientras el cobro no tenga documentos válidos,
   así que no se pudo llegar al selector de origen de diferencia. La VG y el código
   (`test_excedente`) **sí están** en el equipo — lo único que falta es el documento.

4. **El control del punto 1 por el camino del pendientes** (subir el mínimo del abono a 50 y
   repetir). Se sustituyó por un control equivalente **sin tocar la configuración**
   (excesos de 0,01 USD vs 5,00 USD sobre la misma tolerancia), que demuestra lo mismo y deja el
   equipo listo para QA. La versión con cambio de VG **no se ejecutó**.

### Y una cosa que parecía defecto y ERA MI MÉTODO — dicho por delante

Durante dos intentos, el cobro con anticipo **no llegaba ni a la BD local**: parecía que el
anticipo automático abortaba el envío. **No es así.** Medido con `elementFromPoint`:

> el **primer** clic sobre el botón de una `ion-alert` cae en el **`ION-BACKDROP`**
> (`elementFromPoint` devuelve `ION-BACKDROP` en t=0 s y el propio botón en t=2 s).
> Y con **dos alertas apiladas**, el backdrop de la de arriba tapa el botón de la de abajo
> **indefinidamente**.

Con el clic esperando a que el punto sea del botón, el mismo caso **envió a la primera**
(cobro 2655 + anticipo 2656). **No se reporta como defecto de la app.** Costó dos documentos.

---

## Para el script de cobros

Cinco cosas que valen para cualquier corrida, no solo para 4K.

### 1. 🔴 El backdrop tapa el botón de la `ion-alert` — esperar a que el punto sea del botón

Es la más cara de las cinco: **costó dos cobros perdidos** antes de detectarla.

```js
// MAL: clic inmediato — a t=0 s el punto es del ION-BACKDROP, no del botón
await pg.mouse.click(x, y);

// BIEN: esperar a que elementFromPoint devuelva el botón
const suyo = (b) => { const r = b.getBoundingClientRect();
  const t = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
  return !!(t && (b === t || b.contains(t) || t.contains(b))); };
```

- **Tomar SIEMPRE la ÚLTIMA `ion-alert` viva**, no la primera:
  `[...document.querySelectorAll('ion-alert')].filter(a => !a.classList.contains('overlay-hidden') && a.offsetParent !== null).pop()`.
  Con dos apiladas, apuntar a la de abajo deja el clic muerto **para siempre** (el backdrop de la
  de arriba nunca se va).
- **Fallback**: si tras ~8 s el punto sigue sin ser del botón → `b.click()` por DOM sobre la
  alerta de arriba.
- Es hermano del patrón ya graduado de `clickModalButton` (§3 de RUNTIME), pero para **alerts**.

### 2. 🔴 El `value` del `ion-accordion` es una PROPIEDAD, no un atributo

En el Tab Pagos, `a.getAttribute('value')` devuelve **`null`** y `a.value` devuelve **`"cheque0"`**.
La receta actual de `module-selectors/cobros.md` («asignar `grp.value = acc.value`») funciona
**solo si se lee la propiedad**; leyendo el atributo, el panel **no se abre nunca** y se lee como
«el método de pago no tiene campos».

```js
const v = a.value != null ? a.value : a.getAttribute('value');   // ← este orden
grp.value = v; grp.dispatchEvent(new CustomEvent('ionChange', {bubbles:true, detail:{value:v}}));
```

### 3. El `#bankPickerModal` lista 35 bancos: hay que hacer `scrollIntoView` y RE-MEDIR

`BANCO MERCANTIL` cae en **y = 954** con un viewport de **744**. El clic se pierde en silencio
(el modelo queda con `nombreBanco: ""`). `scrollIntoView({block:'center'})` → esperar ~1,2 s →
**volver a medir** → el mismo banco queda en y = 430 y el clic entra a la primera.
Es la misma trampa ya anotada para `app-cobros-list`, pero en el picker de bancos.

### 4. Antes de medir tolerancias/anticipos: **mirar la MONEDA del cobro**

El cobro nace en **Bs** aunque los documentos sean USD. La tolerancia (`MonedaTolerancia`) y el
anticipo (`prepaidRangeCurrency`) están en **USD**, así que el excedente **se convierte** antes de
compararse. Pagar «5,00 de más» en un cobro en Bs son **0,01 USD**, no 5,00: el caso no dispara y
se lee como «no reproduce». **Calcular siempre el exceso en la moneda de la tolerancia**
(hoy: × 870,00). Costó dos cobros (2653 y 2654).

⚠ Y el selector de **Moneda del cobro NO está en el Tab General** de este build: recién abierto,
`app-cobro-general` trae **un solo `ion-select`**, el de Empresa. El de moneda del **Tab Documentos**
(`Bs`/`USD`) filtra la lista de documentos, **no** cambia la moneda del cobro.

### 5. El inventario fiable de documentos libres es el Tab Documentos — y se puede predecir

La nube **sí** permite anticiparlo, aunque `document_sale.co_collection` esté siempre en `NULL`:
lo que compromete un documento es tener fila en **`collection_detail`**.

```sql
SELECT ds.co_client, count(*) FROM document_sale ds
WHERE ds.co_operation NOT IN ('D') AND ds.co_currency = 'USD'
  AND NOT EXISTS (SELECT 1 FROM collection_detail cd
                  WHERE cd.co_document = ds.co_document_sale AND cd.co_operation NOT IN ('D'))
GROUP BY 1;
```

Cruzado con `SELECT DISTINCT co_client FROM document_sales` de la **BD local** (los clientes que
el vendedor carga de verdad) da la lista de clientes utilizables **antes** de abrir la app.
Eso es lo que evitó dar por «agotado» a un cliente que sí tenía documentos.

**Relevo de clientes de cobros en 4K, medido hoy:**

| Cliente | Documentos USD libres al cierre | Nota |
|---|---|---|
| **C.0210** | **0** ⬅ **AGOTADO** | tenía 1 (FAC 00022135, 120,00) y se fue en el cobro 2653 |
| **C.0538** | **3** (FAC 00020795 489,00 · FAC 00020919 2.880,00 · N/D 10000237 72,00) | **el relevo bueno**: era el que más tenía |
| C.0326 · C.0340 · C.0799 · C.1018 | 3 cada uno | sin usar, verificados en BD + carga del equipo |

---

## Registros creados en el sistema

| Ref (`id_collection`) | `co_type` | Cliente | Monto | Estado | Para qué |
|---|---|---|---|---|---|
| **2653** | 0 · cobro | C.0210 | 104.405,00 Bs | Enviado (nube) | Control: exceso 0,01 USD ⇒ **sin** anticipo. Consumió el último documento libre de C.0210 |
| **2654** | 0 · cobro | C.0538 | 65.255,00 Bs | Enviado (nube) | Igual control, repetido |
| **2655** | 0 · cobro | C.0538 | 308.850,00 Bs | Enviado (nube) | **Punto 1**: exceso 5,00 USD dentro de tolerancia |
| **2656** | **1 · ANTICIPO** | C.0538 | **5,00 USD** | Enviado (nube) | **La evidencia del punto 1** |
| **2657** | 0 · cobro | C.0538 | 523.740,00 Bs | Enviado (nube) | **Punto 4**: cheque BANCO MERCANTIL nro. 112233 |

Comentarios únicos para localizarlos: `P1-p1a-681336` · `p1-usd-931672` · `p1-ant4-675057` ·
`P4E-CHQ-192098`.

Nada quedó en Guardado ni en `pending_transactions` (0 al cierre). Los 5 tienen
`st_delivery = 1` en la BD local y fila en la nube.

---

## Cómo queda el equipo

| Qué | Valor al cierre | Verificado en |
|---|---|---|
| **Tolerancia positiva** | **49,99 USD** | equipo + `global_configuration` |
| **Monto mínimo del abono automático** | **1,00** | equipo + `global_configuration` |
| Tolerancia negativa | 10 | equipo + nube |
| `enableDifferenceCodes` | true (no se tocó) | equipo |
| `promoterHideFinance` | true (no se tocó — venía así) | equipo |
| Usuario del equipo | `V.0002zonacentral` · app v6.6.21.3 | localStorage |
| App | en HOME, sin cobros a medias | — |

🔴 **La configuración queda EN 49,99 / 1,00 A PROPÓSITO**, que es la que reproduce el punto 1 en dos
minutos. Anotado en `automation/clientes/_escrituras-de-prueba.md` con cómo deshacerlo.
**No restaurar `prepaidRangeAmount` a 50 sin avisar.**

---

## Corrección al YAML del cliente

`automation/clientes/4k.yaml` tiene **dos valores desactualizados**, comprobados hoy contra el equipo:

| VG | Dice el YAML | Mide el equipo |
|---|---|---|
| `enableDifferenceCodes` | `false` | **`true`** |
| `colletionPayment` | `true-true-true-true-false-true` | **`true-true-true-true-true-true`** (los 6) |

Y `cobros.cliente_test: "C.0029"` / `clientes_con_documentos` deberían pasar a **C.0538**:
C.0210 quedó agotado hoy.

*(No se editó el YAML: queda como recomendación para quien consolide.)*
