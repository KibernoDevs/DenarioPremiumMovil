# Validación de fixes · Aviso de saldo a favor y anticipo del cobro reabierto
## IMPORTADORA 4K · APK nueva · 15/09/2026

| Parámetro | Valor |
|---|---|
| RUN_ID | `fixes_cobros_20260915` |
| Cliente / empresa | **4k** · `DIESE` · GRUPO 4K — empresa única. Guarda verificada en cada cobro vivo: `collection.coEnterprise = "DIESE"` |
| Playa | **CARIBE** (la declarada en el encargo; el `ws_url` no se re-midió en runtime) |
| Usuario del equipo | **`V.0030`** · `idUser` **338** · **JOAN BRICEÑO** — leído de `localStorage.user`, no supuesto |
| App | `com.kiberno.denarioPremiumPro` · `versionApp` **6.6.21.3** · `db_version` 23 |
| Bundle | `main.js` **5.429.097** caracteres (el anterior: 5.425.844) |
| Dispositivo | Infinix X6728 · Android 15 · CDP `:9220` · Chrome/152.0.7977.87 |
| Conducción | Node + Playwright de `automation/playwright/node_modules` (`connectOverCDP` vía `drv.js`). **El MCP de Playwright no levanta** |
| Corte de referencias | `max(id_collection)` = **2771** antes de empezar ⇒ todo lo creado aquí es ≥ 2772 |

> ⚠️ **`versionApp` NO cambió** entre la build anterior y ésta: las dos dicen `6.6.21.3`. Lo único
> que distingue una de otra es el **tamaño del bundle** (5.429.097 vs 5.425.844). Si alguien valida
> «por la versión», va a creer que está probando la build vieja. **El sello de esta corrida es el
> bundle, no la versión.**

---

# VEREDICTO

## 🟢 TARJETA 1 · El aviso de saldo a favor — **CORREGIDA, incluido el orden invertido**

> **El caso que fallaba (1-B) pasa.** Marcados los DOS documentos y aplicado **después** el pago
> parcial de 100,00, el aviso **sale**: *«Se creará un anticipo automático por el saldo a favor de
> **USD 144,00**. Se enviará un anticipo junto al cobro.»*, **un solo botón ACEPTAR**, a los **2,9 s**
> del gesto. Los cuatro subcasos —1-A, 1-B, 1-C, 1-D— pasan.
>
> **El número que lo prueba: `USD 144,00` en los dos órdenes**, y `USD 60,00` en el segundo cobro.

## 🔴 TARJETA 2 · El cobro reabierto pierde el anticipo — **SIGUE, en los dos caminos**

> **Tres reproducciones, dos controles al lado, todo en la misma sesión.** Un cobro enviado desde un
> **Guardado reabierto** no genera su anticipo; el **mismo escenario enviado directo, sí**.
>
> **Los números que lo prueban:**
>
> | | Cobro | Anticipo esperado | Anticipo real | ¿Reabierto? |
> |---|---|---|---|---|
> | **Control N/C** | **2773** · C.0864 · 0,00 | 144,00 | ✅ **2774 · 144,00** | No |
> | **2-A** N/C | **2775** · C.0321 · 0,00 | **60,00** | 🔴 **ninguno** | **Sí** |
> | **2-B** excedente | **2777** · C.0394 · 226,00 | **100,01** | 🔴 **ninguno** | **Sí** |
> | **Control excedente** | **2779** · C.0394 · 750,00 | 100,01 | ✅ **2780 · 100,01** | No |
> | **2-C** excedente (repetición) | **2781** · C.0394 · 318,00 | **100,01** | 🔴 **ninguno** | **Sí** |
>
> 🔑 **Y esta vez hay diagnóstico medido, no deducido** — la consola de la app lo dice sola (§4).
> **El arreglo del 14/09 ya no es el que falta**: los flags `createAutomatedPrepaid` y
> `anticipoAutomatico` **sí** se reponen al reabrir. Lo que revienta es **un paso más adelante**,
> al crear el *payment* del anticipo. Ver §4: es un arreglo distinto del que se pidió ayer.

---

## 0 · Configuración leída del EQUIPO antes de medir

`localStorage.globalConfiguration` (187 claves; en este build es un **array de pares**, no un objeto):

| Clave | Equipo | Por qué importa aquí |
|---|---|---|
| `automatedPrepaid` · `cobroPrepago` | **true** · true | Sin `automatedPrepaid` la guarda corta y no hay aviso |
| `prepaidRangeAmount` · `prepaidCurrency` | **0,01** · USD | La moneda del aviso sale de aquí |
| `RangoToleranciaPositiva` / `Negativa` | **49,99** / 10 · `TipoTolerancia` **0** · `tolerancia0` true | ⇒ **umbral efectivo 50,00 exacto**; y el anticipo por excedente sale **exceso − 49,99** |
| `enablePartialPayment` · `alwaysPartialPayment` | **true** · false | Hace posible 1-A y 1-B |
| `enableDifferenceCodes` | **true** | Habilita el selector de origen del método «Otros» |
| `requiredComment` · `longitudComentario` | true · 200 (la UI rotula «Máx. 255») | El comentario es el testigo del oráculo |
| `requiredCollectionAttachments` | **false** | Se puede **Enviar** sin adjunto |
| `userCanSelectCollectDiscount` · `maxCollectDiscount` | true · **0** | Caso 1-D. El tope 0 **no bloqueó** el 80 % |
| `colletionPayment` | `true-true-true-true-true-true` | Los 6 métodos habilitados |
| `userCanSelectIGTF` | false | El IGTF no aparece en el cobro |

**Coincide con el perfil `automation/clientes/4k.yaml`. No se tocó ninguna variable global ni nada
de la web.**

### El fix, contrastado contra lo que traía el encargo

**✅ El aviso — el encargo decía «SÍ está». Confirmado, y además hay más de lo que se leyó.**
Junto al handler que ya se había visto, el servicio trae el despachador y su reintento:

```js
tryDispatchCreditBalancePrepaidInformUi() { this.dispatchCreditBalancePrepaidInformUi(); }
dispatchCreditBalancePrepaidInformUi() {
  if (this.coTypeModule !== '0' || this.recentOpenCollect) return;      // ← sigue excluyendo el reabierto
  if (!this.shouldShowCreditBalancePrepaidInformMessage()) return;
  for (const handler of this.creditBalancePrepaidInformHandlers) { … }
}
```

Y se invoca desde **dos sitios nuevos**: el `ngOnInit` de `cobro-documents` (tras registrar el
handler) y el final de la recarga de documentos. Eso es lo que hace que el aviso ya **no dependa
solo del evento de marcar/desmarcar** — que era la causa exacta del defecto. **Medido en pantalla
en §1.2.**

**⚠️ El anticipo — el encargo decía «NO se ve». Matiz importante: `handleOpenCollect()` sigue
apagando los flags, pero ahora hay maquinaria nueva que los repone.**

```js
handleOpenCollect() { … this.collectService.createAutomatedPrepaid = false;
                      this.collectService.anticipoAutomatico = []; … }   // ← sigue igual, sí
```

…pero el bundle nuevo añade `captureAutomatedPrepaidSendSnapshot()` /
`applyAutomatedPrepaidSendSnapshot()` y `refreshAutomatedPrepaidBeforeSend()` (marcados
`COB-PREPAID-006`), y además, al terminar de recalcular los pagos:

```js
if (_this3.recentOpenCollect) { _this3.recentOpenCollect = false;
                                _this3.dispatchCreditBalancePrepaidInformUi(); }
```

⇒ **Ni «corregido» ni «roto» por lectura.** Se midió, y el resultado es **mixto**: los flags **sí**
se reponen (§3.2) y el envío **sí** decide crear el anticipo — pero el anticipo **no llega**. El
porqué, en §4.

---

## 1 · TARJETA 1 — El aviso de saldo a favor

Escenario de los casos 1-A y 1-B: **`C.0864` MULTISERVICIOS DON PEDRO MARRO**, con los dos
documentos libres confirmados **en el propio Tab Documentos** (no en la BD):

```
N/C  *0001523  USD  35 d   -244,00 USD   Saldo   -244,00 USD
FAC  00022180  USD   8 d  2.552,00 USD   Saldo  2.552,00 USD
```

*(Confirmada la trampa T-2 de la corrida anterior: en `C.0864` **la N/C ordena ANTES que la
factura**. Las filas se localizaron por número de documento, nunca por posición.)*

### 1.1 · Caso 1-A — marcar factura → parcial 100,00 → marcar la N/C

| Paso | Qué hizo la app | Aviso |
|---|---|---|
| Marcar `FAC 00022180` | `montoTotalPagar` 0 → **2.552,00** | — (correcto) |
| Detalle → **Pago parcial** ON → «Monto a pagar» **100,00** → GUARDAR | `montoTotalPagar` → **100,00** | **ninguno** — correcto: aún no hay saldo a favor. *Medido como ausencia real: 24 muestras de 250 ms, 0 alertas visibles* |
| Marcar `N/C *0001523` | `creditBalancePrepaidAmount` 0 → **144** · `createAutomatedPrepaid` → **true** | ✅ **sale a los 2,46 s** |

**Texto literal, copiado del DOM:**

```
Denario Cobros

Se creará un anticipo automático por el saldo a favor de USD 144,00.
Se enviará un anticipo junto al cobro.

                                                          [ ACEPTAR ]
```

- **`{currency}` y `{amount}` sustituidos**: «USD» y «144,00». No queda ningún marcador literal.
- **UN solo botón** (`btns: ["Aceptar"]`) ⇒ es un **AVISO**, no una confirmación. Es lo que pidió QA.
- Aritmética: 100,00 (parcial) − 244,00 (N/C) = **−144,00** ⇒ saldo a favor **144,00**. ✅

### 1.2 · 🔑 Caso 1-B — marcar los DOS y aplicar el parcial DESPUÉS · **el caso que fallaba**

Cobro nuevo, mismo cliente, **orden invertido**:

| Paso | `montoTotalPagar` | `should…InformMessage()` | Aviso |
|---|---|---|---|
| Marcar `FAC 00022180` | **2.552,00** | false | — |
| Marcar `N/C *0001523` | **2.308,00** | false | **ninguno** — ✅ correcto: 2.552 − 244 sigue siendo deuda, no hay saldo a favor. *Ausencia medida: **15 muestras en 6,0 s, 0 alertas visibles**, con 16 `ion-alert` en el DOM, todas ocultas* |
| Detalle de la FAC → **Pago parcial** ON → **100,00** → GUARDAR | **0,00** · `creditBalancePrepaidAmount` **144** | **true** | 🔑 ✅ **SALE — a los 2,96 s del clic en GUARDAR** |

**El mismo texto, palabra por palabra, y el mismo botón único:**

```
Denario Cobros
Se creará un anticipo automático por el saldo a favor de USD 144,00.
Se enviará un anticipo junto al cobro.
                                                          [ ACEPTAR ]
```

> ### ✅ Esto cierra el defecto en su punto exacto
> El reporte decía: *«si se marcaban los dos documentos y después se aplicaba el pago parcial, no
> salía nada — porque solo se invocaba en el evento de marcar/desmarcar»*. **Hoy sale**, y sale
> **en el mismo gesto que crea el saldo a favor** (al guardar el detalle con el parcial), no al
> enviar. El momento es el útil.

### 1.3 · Caso 1-C — que siga saliendo cada vez

**1-C.1 · Desmarcar y remarcar la N/C, en el mismo cobro:**

| Paso | Modelo | Aviso |
|---|---|---|
| **Desmarcar** `*0001523` | `creditBalancePrepaid` 144 → **0** · `should` → false · `montoTotalPagar` → **100,00** (el parcial persiste) | **ninguno** — correcto |
| **Remarcar** `*0001523` | `creditBalancePrepaid` → **144** · `should` → true | ✅ **vuelve a salir a los 2,45 s**, con el mismo texto y un botón |

**1-C.2 · Segundo cobro, sin reiniciar la app, con `C.0321` (excedente 60,00):**

```
FAC  00021022  USD  89 d  1.484,00 USD   Saldo    85,00 USD
N/C  00002222  USD  50 d   -145,00 USD   Saldo  -145,00 USD
```

Marcada la factura (`montoTotalPagar` → 85,00, sin aviso) y después la N/C:

```
Se creará un anticipo automático por el saldo a favor de USD 60,00.
Se enviará un anticipo junto al cobro.                    [ ACEPTAR ]
```

✅ **Sale con SU monto — 60,00, no 144,00 del anterior.** 145,00 − 85,00 = 60,00. No hay arrastre
del cobro previo. Y en el mismo cobro **volvió a salir una tercera vez** al recalcularse los montos
tras completar el método de pago: el `markCreditBalancePrepaidInformMessageShown()` convertido en
*noop* se comporta como promete.

### 1.4 · Caso 1-D — el camino del descuento no se rompió

**`C.0643` FRENOS DE AIRE HERMANOS BETANCOURT**, `FAC 00020855` (total **955,50** · saldo **69,00**),
detalle → ASIGNAR DESCUENTO → **«80 % - Probando»** → ACEPTAR:

```
Denario Cobros

El descuento supera el saldo del documento.
¿Desea crear un anticipo automático por USD 695,40?

                                        [ CANCELAR ]   [ ACEPTAR ]
```

- ✅ **DOS botones** — sigue siendo una **confirmación**, no un aviso. Aparece a los **0,33 s**.
- ✅ **El importe cuadra**: 955,50 × 0,80 = 764,40 − 69,00 = **695,40**. *(El descuento se calcula
  sobre el **total** del documento, no sobre el saldo.)*
- ✅ **CANCELAR sigue cancelando**, y se comprobó por el modelo, no por la pantalla:

| | antes de CANCELAR | después |
|---|---|---|
| `discountRemnantPrepaidAmount` | 0 | **0** |
| `createAutomatedPrepaid` | false | **false** |
| `anticipoAutomatico` | 0 entradas | **0 entradas** |
| `montoTotalPagar` | 69,00 | **69,00** |
| «Monto descuento» en el detalle | — | **0,00** |

La alerta se cierra y **el modal de Descuentos queda abierto**, que es el comportamiento correcto:
el usuario vuelve a la selección para cambiarla. **No se creó ningún anticipo ni se aplicó el
descuento.** El cobro se abandonó con **SALIR SIN GUARDAR** — no dejó registro.

> 📌 **Dato nuevo que no estaba en el perfil:** el catálogo de descuentos de 4K ya tiene **DOS**
> filas, no una: `10% - DESC 10 TEST` y `80% - Probando`. El `4k.yaml` dice «UNA sola fila». Conviene
> actualizarlo — con dos descuentos, el tope `maxCollectDiscount` ya es ejercitable por UI.

---

## 2 · Los dos caminos, ANTES de tocar «Guardar» — que es donde todo funciona

Para que el contraste de la Tarjeta 2 sea limpio hay que dejar escrito que **los dos mecanismos
operan perfectamente mientras el cobro no pasa por Guardado**:

| Camino | Escenario | Aviso en pantalla | Modelo antes de Enviar | Nube |
|---|---|---|---|---|
| **N/C > FAC** | `C.0864` · parcial 100,00 + N/C −244,00 | «…saldo a favor de **USD 144,00**» | `createAutomatedPrepaid` true · `anticipoAutomatico` 1 (`{ef, synthetic}`) | ✅ **2773 + 2774 (144,00)** |
| **Excedente por tolerancia** | `C.0394` · `FAC 00020903` saldo 600,00, pagado **750,00** | «…por el monto excedente de **USD 100,01**» | `createAutomatedPrepaid` true · `anticipoAutomatico` 1 (`{ef, pos 0}`) | ✅ **2779 + 2780 (100,01)** |

🔑 **El 100,01 confirma la regla del techo de tolerancia**, que el perfil ya anotaba: el exceso de
**150,00** produce un anticipo de **150,00 − 49,99 = 100,01**, no de 150,00. El umbral para que
haya anticipo sigue siendo **50,00 exacto** (`RangoToleranciaPositiva` + `prepaidRangeAmount`).

> ⚠️ **Y el envío directo AHORA SÍ acusa el anticipo.** Salió *«Anticipo nro. 2774 enviado
> exitosamente»* y *«Anticipo nro. 2780 enviado exitosamente»*, cada uno tras su cobro. **Esto
> contradice la trampa T-6 del 14/09** («el anticipo no se acusa al enviar»): en esta build sí se
> acusa. Aun así el oráculo sigue siendo la fila en la nube — ver la trampa T-11 más abajo, que
> esta corrida volvió a reproducir.

---

## 3 · 🔴 TARJETA 2 — El cobro reabierto

### 3.1 · ¿Sale el aviso al reabrir? — **NO**, en los dos caminos

Medido como **ausencia real**, separando *presente* de *visible*:

| | 2-A (`C.0321`, N/C) | 2-B (`C.0394`, excedente) | 2-C (`C.0394`, repetición) |
|---|---|---|---|
| Muestreo tras reabrir | **29,4 s** · 60 muestras | **29,3 s** · 60 muestras | **29,4 s** · 60 muestras |
| Alertas **visibles** en cualquier muestra | **0** | **0** | **0** |
| `ion-alert` en el DOM | 16 — **todas** `overlay-hidden` | 17 — **todas** ocultas | 17 — **todas** ocultas |
| `ion-toast` / `ion-loading` / `ion-popover` visibles | **0 / 0 / 0** | 0 / 0 / 0 | 0 / 0 / 0 |
| Grabador de alertas (observador + barrido 250 ms) | **cero** entradas en la fase de reapertura | cero | cero |

**Los cobros reabiertos eran los correctos** — verificado por `collection.txComment` leído del
modelo vivo (`QA-2A-0321-144200`, `QA-2B-REAB-0394-150500`, `QA-2C-REAB-0394-153900`), con sus
documentos marcados y sus importes intactos.

**Por qué sigue sin salir, leído del bundle:** `dispatchCreditBalancePrepaidInformUi()` arranca con
`if (… || this.recentOpenCollect) return;`, y el único sitio que lo llama con `recentOpenCollect`
ya en `false` es el recálculo de pagos — que al reabrir no vuelve a disparar el aviso porque el
usuario no toca nada. *(Esto es lectura de código, no medición: se ofrece como pista, no como
hallazgo.)*

### 3.2 · 🔑 Lo que SÍ cambió: los flags ya se reponen

Ésta es la diferencia con la corrida del 14/09, y cambia el arreglo que hay que pedir. **Medido en
el modelo vivo, en el instante anterior a pulsar Enviar, en un cobro reabierto:**

| | 2-A (N/C) | 2-B (excedente) | 2-C (excedente) |
|---|---|---|---|
| `recentOpenCollect` | false | false | false |
| `createAutomatedPrepaid` | **true** | **true** | **true** |
| `creditBalancePrepaidAmount` | **60** | — | — |
| `anticipoAutomatico` | **1** entrada `{type:'ot', pos:0}` | **1** entrada `{type:'ef', pos:0}` | **1** entrada `{type:'ef', pos:0}` |
| `stDelivery` | 3 (Guardado) | 3 | 3 |

⇒ **El apagado de `handleOpenCollect()` ya no es el problema.** La maquinaria nueva
(`COB-PREPAID-006`) repone los flags correctamente. El cobro llega a Enviar **armado**.

### 3.3 · 🔴 Y aun así el anticipo no llega — tres veces

| Ref | Cliente | Camino | Importe del cobro | Anticipo esperado | **Anticipo en la nube** |
|---|---|---|---|---|---|
| **2775** | C.0321 | N/C > FAC | 0,00 | **60,00** | 🔴 **ninguna fila `co_type = 1`** |
| **2777** | C.0394 | excedente | 226,00 | **100,01** | 🔴 **ninguna** |
| **2781** | C.0394 | excedente | 318,00 | **100,01** | 🔴 **ninguna** |

```sql
SELECT id_collection, co_type, co_client, nu_amount_total, tx_comment
  FROM collection WHERE tx_comment LIKE 'QA-%' ORDER BY id_collection;
-- 2773 co_type=0  C.0864    0.0000  QA-1A-0864-142900
-- 2774 co_type=1  C.0864  144.0000  QA-1A-0864-142900   ← control directo ✅
-- 2775 co_type=0  C.0321    0.0000  QA-2A-0321-144200   ← reabierto · y NADA más
-- 2777 co_type=0  C.0394  226.0000  QA-2B-REAB-0394-150500  ← reabierto · y NADA más
-- 2779 co_type=0  C.0394  750.0000  QA-2B-DIR-0394-151800
-- 2780 co_type=1  C.0394  100.0100  QA-2B-DIR-0394-151800   ← control directo ✅
-- 2781 co_type=0  C.0394  318.0000  QA-2C-REAB-0394-153900  ← reabierto · y NADA más
```

**No es sincronización diferida.** El 2775 se reconsultó **cinco veces a lo largo de ~100 s** y el
2777 **cuatro veces a lo largo de ~75 s**: el conteo nunca se movió. Y **la lista de cobros del
propio equipo tampoco muestra ningún «Anticipo»** para esos cobros — sí lo muestra para 2774 y
2780. No hay un anticipo «Por enviar» esperando: sencillamente no existe.

**🔑 Los controles que lo aíslan.** En la **misma sesión**, el **mismo vendedor**, los **mismos
clientes** y el **mismo mecanismo**, pero **sin pasar por Guardado**, los dos caminos sí generaron
su anticipo (2774 y 2780). ⇒ **La única variable que cambia es haber reabierto desde Guardado.**

---

## 4 · 🔑 Por qué falla — dicho por la propia app

En la tercera reproducción se envió con la **consola del WebView capturada**. Esto es lo que
imprimió la app al enviar el cobro reabierto **2781**:

```
LOG   :: CREE ANTICIPO AUTOMATICO, DEBO CREAR EL PAYMENT
LOG   :: ERROR: anticipoAutomatico vacio al crear payment de anticipo
ERROR :: createAnticipoCollection: fallo payment; eliminando anticipo huérfano 1789502959848.0
LOG   :: null  SE CREO ANTICIPO AUTOMATICO
LOG   :: [AutoSendService] anticipo Por Enviar reencolado 1789502959848.0
LOG   :: TypeError: Cannot read properties of undefined (reading 'toString') at main.js:63463
LOG   :: {errorCode: 000, errorMessage: Cobro nro. 2781 enviado exitosamente, collectionId: 2781}
```

**Leído en orden, la secuencia es inequívoca:**

1. ✅ **La decisión de crear el anticipo SÍ se toma.** `refreshAutomatedPrepaidBeforeSend()` devolvió
   `true` y la app entró a crearlo. **Eso es el fix nuevo funcionando.**
2. ✅ **La cabecera del anticipo se crea** (`co_collection` local `1789502959848.0`).
3. 🔴 **Al crear su *payment*, `anticipoAutomatico` está VACÍO.** Es la primera guarda de
   `createAnticipoCollectionPayment()`:
   ```js
   if (!Array.isArray(this.anticipoAutomatico) || this.anticipoAutomatico.length === 0) {
     console.log('ERROR: anticipoAutomatico vacio al crear payment de anticipo');
     return Promise.resolve(null);
   }
   ```
   …y estaba **con 1 entrada** dos segundos antes, medida en el modelo (§3.2). Se vacía **durante**
   el propio envío.
4. 🔴 **La app borra el anticipo huérfano** que acababa de crear y devuelve `null`.
5. El cobro se envía igual, **sin su anticipo y sin avisar al usuario de nada**.

> ### Lo que hay que llevar a producto — y es distinto de lo que se pidió ayer
>
> El 14/09 se pidió *«reponer `createAutomatedPrepaid` y `anticipoAutomatico` al reabrir»*. **Eso ya
> está hecho y funciona.** Lo que falta ahora es **garantizar la plantilla de pago del anticipo
> inmediatamente antes de crearlo**, en la rama por la que pasa el cobro reabierto.
>
> El bundle ya tiene la función que lo haría —`ensureAutomatedPrepaidPaymentTemplate()`— y la rama
> del **envío directo** la llama justo antes de `createAnticipoCollection()`. **La rama por la que
> cae el reabierto llama a `createAnticipoCollection()` sin ese paso previo.**
>
> 📌 **Pista adicional, medida:** el cobro reabierto y el directo **no muestran el mismo diálogo**.
> El directo termina en *«Cobro nro. N enviado exitosamente»* + *«Anticipo nro. M enviado
> exitosamente»*; el reabierto pasa por *«**Su Cobro será enviado**»*. Son **dos ramas de envío
> distintas**, y sólo una de las dos prepara la plantilla del pago. Eso es lo que conviene que
> desarrollo mire primero.
>
> ⚠️ **Y un efecto colateral que conviene revisar:** tras borrar el anticipo huérfano, el
> `AutoSendService` lo **reencola** (`anticipo Por Enviar reencolado 1789502959848.0`) — está
> reintentando enviar algo que ya se borró. Aparece también un
> `TypeError: Cannot read properties of undefined (reading 'toString')` repetido tres veces. **No se
> midió qué consecuencia tiene**; se deja anotado porque salió en la misma traza.

---

## 5 · Registros creados en sistema

| Ref | `co_type` | Cliente | Detalle | Comentario (marca) |
|---|---|---|---|---|
| **2773** | 0 · cobro | C.0864 | `FAC 00022180` **parcial 100,00** + `N/C *0001523` (−244,00) · Otros + `test_excedente` · **envío directo** | `QA-1A-0864-142900` |
| **2774** | **1 · anticipo** | C.0864 | **144,00 USD** ✅ *(el control del camino N/C)* | `QA-1A-0864-142900` |
| **2775** | 0 · cobro | C.0321 | `FAC 00021022` (85,00) + `N/C 00002222` (−145,00) · **reabierto desde Guardado** | `QA-2A-0321-144200` |
| — | — | — | 🔴 **su anticipo de 60,00 NO existe** — el defecto | — |
| **2777** | 0 · cobro | C.0394 | `FAC 00020461` (saldo 76,00) · Efectivo **226,00** · **reabierto** | `QA-2B-REAB-0394-150500` |
| — | — | — | 🔴 **su anticipo de 100,01 NO existe** | — |
| **2779** | 0 · cobro | C.0394 | `FAC 00020903` (saldo 600,00) · Efectivo **750,00** · **envío directo** | `QA-2B-DIR-0394-151800` |
| **2780** | **1 · anticipo** | C.0394 | **100,01 USD** ✅ *(el control del camino del excedente)* | `QA-2B-DIR-0394-151800` |
| **2781** | 0 · cobro | C.0394 | `FAC 00020987` (saldo 168,00) · Efectivo **318,00** · **reabierto** | `QA-2C-REAB-0394-153900` |
| — | — | — | 🔴 **su anticipo de 100,01 NO existe** — 3.ª reproducción | — |

**Sin duplicados:** contando por `co_type`, cada envío dejó **una sola fila**. Los cobros 2776 y
2778 (`C.0616`, `C.0608`, comentario `am`) y el 2772 (`C.0405`, «QA inspeccion NCR`») **NO son de
esta corrida** — hay otra persona trabajando en el mismo tenant.

**Dos cobros se montaron y NO se guardaron:** el de 1-B (`C.0864`) y el de 1-D (`C.0643`), los dos
abandonados con **SALIR SIN GUARDAR** tras copiar sus alertas. No dejaron registro.

**El equipo quedó limpio:** `0` cobros en estado **Guardado** al cerrar.

**Documentos consumidos** (quedan «Por aprobar» y desaparecen del Tab Documentos):
`C.0864` → `00022180` + `*0001523` · `C.0321` → `00021022` + `00002222` ·
`C.0394` → `00020461`, `00020903`, `00020987`.
**Quedan libres:** `C.0394` → `00021460` y `00021880` · `C.0643` → sus 3 facturas · `C.0616` → su
pareja entera (no se llegó a usar).

**Cómo revertir:** rechazar desde la web **2773, 2774, 2775, 2777, 2779, 2780 y 2781**. Eso devuelve
los siete documentos al Tab Documentos.

Anotado en `automation/clientes/_escrituras-de-prueba.md`.

**No se ejecutó SQL de escritura. No se aprobó ni rechazó ningún cobro. No se tocó ninguna
configuración de la web ni ninguna variable global.**

---

## 6 · Lo que NO se pudo comprobar

| Punto | Motivo |
|---|---|
| **El aviso con una etiqueta personalizada del cliente** | `COB_MSG_NCR_CREDIT_PREPAID` **no existe** en el catálogo de 4K. Lo validado es el **texto de fábrica del bundle**. Un tenant que la personalice necesita su propia pasada |
| **El escenario `C.0616`** (FAC 0,11 + N/C −1,00 ⇒ 0,89) | No hizo falta: los tres casos de la Tarjeta 2 ya reprodujeron con margen. **Su pareja queda libre** para quien quiera comprobar el borde por debajo del umbral |
| **Si el defecto del reabierto afecta también a un cobro reabierto desde ENVIADO** | Solo se midió el reabierto desde **Guardado**, que es lo que pedía el encargo |
| **Qué hace el `AutoSendService` con el anticipo huérfano reencolado** | Salió en la traza de consola pero **no se siguió**. Puede ser inocuo o puede dejar basura en la cola local |
| **El `TypeError … reading 'toString'` de `main.js:63463`** | Aparece tres veces durante el envío del reabierto. **No se midió su efecto**; podría ser independiente del defecto |
| **La rama «Aceptar» del caso 1-D** | Se comprobó que **CANCELAR cancela**, que es lo que pedía el encargo. **Aceptar el anticipo por descuento no se ejercitó** |
| **El caso con el cobro naciendo en Bs** | El cobro de 4K nace en **USD**; la trampa de conversión no llegó a ejercitarse. Ningún cliente del vendedor lista documentos en Bs |
| **`ws_url` de la playa en runtime** | No aparece en el bundle ni en `localStorage`. Se toma **CARIBE** del encargo |

### Si algo de esto fuera mi método y no la app

**La Tarjeta 2 es la que más merece una comprobación a mano**, porque es el hallazgo grave. Pediría
reproducir exactamente esto:

> Cobro a un cliente, pagar por encima del saldo superando los 50,00 → ver el aviso del excedente →
> **Guardar** → salir → reabrir → **Enviar** → **¿aparece la fila «Anticipo» en la lista de cobros?**

Dicho esto, **el resultado no depende de cómo conduje yo la pantalla**, por tres razones:
1. **El oráculo es la fila `co_type = 1` en la nube**, no lo que se vea en pantalla.
2. **Los dos controles**, montados con el mismo guion, la misma sesión y el mismo método pero sin
   reabrir, **sí produjeron su anticipo**. Si fuera artefacto de mi conducción, habrían fallado también.
3. **La propia app dice por consola que falló** («anticipo vacio al crear payment», «eliminando
   anticipo huérfano»). Eso no lo escribe mi guion.

**Donde sí conviene una segunda mirada a mano es en 1-B**, pero por el motivo contrario: es el caso
que **PASA**, y un PASS conseguido con ventaja es peor que un FAIL. Lo que hice fue encender el
toggle de pago parcial y teclear 100,00 con eventos de Ionic; a mano el gesto es idéntico y el aviso
debería salir igual. **Merece un vistazo de QA para dar por cerrado el REQ.**

---

## 7 · Trampas (confirmadas y nuevas)

| # | Trampa | Detalle |
|---|---|---|
| **T-1** | *(confirmada)* **«Otros» viene YA MARCADO** en el modal de métodos cuando el escenario es N/C > FAC | Leído `checked` **antes** de tocar nada, en los dos cobros: `Otros = true`, el resto `false`. Un guion que «clickee Otros» **lo desmarca**. En un cobro normal (sin N/C) **no viene marcado ninguno** |
| **T-2** | *(confirmada)* **La N/C ordena ANTES que la factura** en `C.0864` pero **NO** en `C.0321` | El orden **no es estable entre clientes**. Localizar la fila por `nu_document`, nunca por posición |
| **T-3** | *(confirmada)* **El pago parcial es un `ion-toggle` DENTRO del detalle** | Lupa → modal. Apagado, «Monto a pagar» es `readOnly` con el saldo; al encenderlo pasa a editable y **se resetea a 0,00**. Además «Dif. Devolución/Faltante» pasa a `disabled` |
| **T-5** | *(confirmada)* Campos de monto **centavos-acumulativos** | `10000` → `100,00`. Tras teclear, `blur()` + espera antes de medir coordenadas |
| **T-6** | 🔑 **CADUCADA — el anticipo AHORA SÍ se acusa al enviar** | Esta build dice *«Anticipo nro. 2774 enviado exitosamente»*. La regla del 14/09 («validar por la alerta da falso negativo») ya no aplica **en el camino directo**. Aun así, el oráculo sigue siendo la nube — ver T-11 |
| **T-7** | *(confirmada)* **El «Comentario» no tiene `ion-item` ni `label`** | El ancla que funciona: el `ion-input` con **`maxlength="255"`** |
| **T-8** | *(confirmada)* **La tabla de Documentos NO es `<table>`/`<tr>`** | Fila = **`ion-row.tabladocumentSalesVenta`**, celda = `ion-col` |
| **T-11** | 🔑 **CONFIRMADA y peligrosa — el DOM de las `ion-alert` se REUTILIZA** | Reprodujo **tres veces**: durante el envío del 2775 el grabador registró *«Anticipo nro. **2774** enviado»* (el del cobro ANTERIOR) y *«Cobro nro. **2775**»* con los botones de otra alerta. **Si se hubiera creído esa alerta, se habría dado por generado un anticipo que no existe.** El número de referencia hay que leerlo **de la nube**, jamás del histórico de nodos |
| **T-14** | 🔑 **NUEVA — el acordeón de «Efectivo» nace con `value = null`** | `grp.value = acc.getAttribute('value')` **no lo expande** (asigna `null`) y los campos «Monto» y «Nro. Recibo» **no existen en el DOM**: el guion escribe en el vacío y el pago queda en 0,00 sin dar error. Hay que **pulsar la cabecera del acordeón**. El de «Otros» sí trae `value="otros"` — por eso el fallo parece intermitente |
| **T-15** | 🔑 **NUEVA — `versionApp` NO distingue las dos builds** | Las dos dicen `6.6.21.3`. Lo único que cambia es el tamaño de `main.js`. **Sellar la corrida por el bundle, no por la versión** |
| **T-16** | 🔑 **NUEVA — el YAML lista clientes de OTRO vendedor** | `cobros.clientes_con_documentos` del `4k.yaml` (`C.0538`, `C.1018`, …) se midió con otro usuario. Con **`V.0030` ninguno de ellos existe**: el modal devuelve *«No hay clientes disponibles»*. Este vendedor carga **46 clientes** y son otros. Un guion que rote por esa lista se queda sin cliente **sin entender por qué** |
| **T-17** | 🔑 **NUEVA — hay OTRA persona escribiendo en el mismo tenant** | Aparecieron 2772, 2776 y 2778 en medio de la corrida, de clientes que no toqué. **Filtrar SIEMPRE por la marca del comentario**, nunca por rango de `id_collection` |

---

## 8 · Qué llevar a producto

1. ✅ **La Tarjeta 1 se puede cerrar.** El aviso sale en los dos órdenes —incluido el invertido, que
   era el que fallaba—, con el importe y la moneda correctos, con **un solo botón**, **cada vez**, y
   **sin arrastrar** el monto del cobro anterior. El camino del descuento no se rompió: sigue siendo
   una confirmación de dos botones y **Cancelar sigue cancelando**.
2. 🔴 **La Tarjeta 2 sigue viva, y afecta a los DOS caminos** — saldo a favor por N/C **y** excedente
   por tolerancia. Tres reproducciones (2775, 2777, 2781) con dos controles limpios al lado (2774,
   2780). **El cliente se queda sin sus 60,00 / 100,01 acreditados y nadie le avisa.**
3. 🔑 **El arreglo que falta NO es el que se pidió ayer.** Reponer los flags al reabrir **ya está
   hecho y funciona**. Lo que revienta es **un paso después**: al crear el *payment* del anticipo,
   `anticipoAutomatico` está vacío, la app borra el anticipo huérfano y sigue. La rama del envío
   directo llama a `ensureAutomatedPrepaidPaymentTemplate()` antes de crear el anticipo; **la rama
   por la que cae el cobro reabierto, no.**
4. ⚠️ **Revisar el reencolado del anticipo borrado** y el `TypeError … reading 'toString'` de
   `main.js:63463`, los dos en la misma traza. No se midió su efecto.
5. ⚠️ **4K no tiene la etiqueta `COB_MSG_NCR_CREDIT_PREPAID`**: lo validado es el texto de fábrica.
   Si se personaliza, **volver a validarla** — solo `{currency}` y `{amount}` se sustituyen.
6. 📌 **Actualizar `4k.yaml`**: los clientes de cobros son de otro vendedor (T-16) y el catálogo de
   descuentos ya tiene **dos** filas, no una.
