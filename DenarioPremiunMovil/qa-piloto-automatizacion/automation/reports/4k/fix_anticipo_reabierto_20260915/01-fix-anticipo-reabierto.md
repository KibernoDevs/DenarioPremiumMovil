# Verificación del fix · anticipo automático en cobro reabierto

# ❌ NO ESTÁ CORREGIDO. El cobro enviado desde un Guardado reabierto SIGUE sin generar el anticipo: 3 de 3 fallos, con 2 controles directos que sí lo generan el mismo día, mismo tenant y mismo vendedor.

**Cliente** IMPORTADORA 4K (`4k`) · empresa **DIESE** · playa **CARIBE**
**Vendedor** `V.0030zgrancaracas` (`id_user` 338) · **Fecha** 2026-09-15, 16:33–16:58
**Build** `main.js` = **5.432.976** caracteres (la anterior: 5.429.097) · `versionApp` 6.6.21.3 (no discrimina)
**Baseline** `max(id_collection)` = 2781 ⇒ todo lo de esta corrida es ≥ 2782
**Oráculo** fila en la nube por marca de comentario única (`FIX22-…`), nunca por rango de id

---

## 1 · El resultado, en una tabla

Cada pareja es reabierto + control con el **mismo excedente**, el **mismo cliente** y minutos de diferencia.

| # | Caso | Camino | Cliente · documento | Pagado | Excedente | Cobro (`co_type=0`) | Anticipo (`co_type=1`) | Veredicto |
|---|------|--------|---------------------|--------|-----------|---------------------|------------------------|-----------|
| 1 | **B-reabierto** | Guardar → salir → reabrir → Enviar | C.0394 · FAC 00020461 (76,00) | 126,00 | 50,00 | **2782** 126,00 | **ninguno** | ❌ **FAIL** |
| 2 | **B-control** | Enviar directo | C.0394 · FAC 00020987 (168,00) | 218,00 | 50,00 | **2785** 218,00 | **2786 · 0,01** | ✅ PASS |
| 3 | **B-repetición** | Guardar → salir → reabrir → Enviar | C.0394 · FAC 00021460 (300,00) | 350,00 | 50,00 | **2787** 350,00 | **ninguno** | ❌ **FAIL** |
| 4 | **B-repetición 2** | Guardar → salir → reabrir → Enviar | C.0394 · FAC 00021880 (468,00) | 518,00 | 50,00 | **2791** 518,00 | **ninguno** | ❌ **FAIL** |
| 5 | **A-control (N/C)** | Enviar directo | C.0321 · FAC 00021022 (85,00) + N/C 00002222 (−145,00) | 0,00 | 60,00 (saldo a favor) | **2789** 0,00 | **2790 · 60,00** | ✅ PASS |
| 6 | **A-reabierto (N/C)** | — | — | — | — | — | — | ⛔ **no ejecutable** (ver §5) |

**3 de 3 reabiertos fallan. 2 de 2 controles pasan.** El anticipo esperado en los casos 1/3/4 era **0,01** (excedente 50,00 − tolerancia positiva 49,99).

Cotejo final en la nube, verbatim:

```
FIX22-BREAB1-163303  2782  co_type=0  126.0000  dif 50.0000  st=3   ← solo el cobro
FIX22-BDIR1-163830   2785  co_type=0  218.0000  dif 50.0000  st=3
FIX22-BDIR1-163830   2786  co_type=1    0.0100  dif  0.0000  st=3   ← anticipo ✅
FIX22-BREAB2-164006  2787  co_type=0  350.0000  dif 50.0000  st=3   ← solo el cobro
FIX22-ADIR4-164709   2789  co_type=0    0.0000  dif  0.0000  st=3
FIX22-ADIR4-164709   2790  co_type=1   60.0000  dif  0.0000  st=3   ← anticipo ✅
FIX22-BREAB3-164937  2791  co_type=0  518.0000  dif 50.0000  st=3   ← solo el cobro
```

### No es sincronización diferida

- La nube se releyó **5 veces a lo largo de 100 s** tras el caso 1 (16:34:55 → 16:36:21): siempre una sola fila.
- La **cola del equipo** al cierre: **0 Guardados, 0 «Por enviar»**. Los tres cobros reabiertos figuran «Enviado» y **sin hermano Anticipo**; los dos controles muestran su Anticipo al lado.
- La consola confirma que el anticipo **no existe ni en el equipo**: la app lo borra (`DELETE FROM collections`) y después `AutoSendService` lo busca y no lo encuentra.

---

## 2 · La consola del WebView — el texto literal

Enganchada por CDP (`page.on('console')` + `page.on('pageerror')`) **antes** de pulsar Enviar.

### 2.1 · Camino REABIERTO (falla) — caso 1, marca `FIX22-BREAB1-163303`

```
[log] Apretó:confirm
[log] COLLECTION INSERT {rows: Object, rowsAffected: 1, insertId: 23}
[log] SE ACTUALIZARON LOS DOCUMENT ST
[log] TERMINE DOCUMENT ST
[log] COLLECTION DETAILS INSERT undefined
[log] collection_detail_discounts INSERT undefined
[log] collection_detail_retentions INSERT undefined
[log] COLLECTION PAYMENTS INSERT undefined
[log] TERMINE
[log] returnLogicService: onReturnValid
[log] MessageAlert
[log] returnLogicService: onReturnValid
[log] returnLogicService: onReturnValid
[log] returnLogicService: onReturnValid
[log] CREE ANTICIPO AUTOMATICO, DEBO CREAR EL PAYMENT
[log] ERROR: anticipoAutomatico vacio al crear payment de anticipo
[error] createAnticipoCollection: fallo payment; eliminando anticipo huérfano 1789504439428.0
[log] null  SE CREO ANTICIPO AUTOMATICO
[log] [AutoSendService] anticipo Por Enviar reencolado 1789504439428.0
[log] {errorCode: 000, errorMessage: Cobro nro. 2782 enviado exitosamente, serviceVersion: 2.0, collectionId: 2782, documentId: 0}
[log] BORRADO EXITOSO  {rows: Object, rowsAffected: 1, insertId: 2}
[log] UPDATE EXITOSO collect 1789504388715.0
[log] TypeError: Cannot read properties of undefined (reading 'toString')
    at http://localhost/main.js:63537:30
[warning] [AutoSendService] Sin datos de cobro en SQLite 1789504439428.0
[log] [AdjuntoService] Enviando adjuntos: 0
```

🔑 **El mensaje NO cambió.** Es el mismo de la build anterior, palabra por palabra. El fallo **no se movió de sitio**.

Repeticiones 3 y 4 (`FIX22-BREAB2-164006`, `FIX22-BREAB3-164937`): idénticas, las tres líneas clave en el mismo orden.

### 2.2 · Camino DIRECTO (funciona) — caso 2, marca `FIX22-BDIR1-163830`

```
[log] [CobrosHeader] anticipo automático al Enviar {shouldCreatePrepaid: true, remnant: 0, creditBalance: 0}
[log] {errorCode: 000, errorMessage: Cobro nro. 2785 enviado exitosamente, collectionId: 2785}
[log] CREE ANTICIPO AUTOMATICO, DEBO CREAR EL PAYMENT
[log] SE CREO COLLECTION PAYMENTS AUTOMATICO POR EL ANTICIPO      ← aquí sí
[log] [CobrosHeader] anticipo encolado vía saveSend 1789504758173.0
[log] {errorCode: 000, errorMessage: Anticipo nro. 2786 enviado exitosamente, collectionId: 2786}
```

**La diferencia entre las dos ramas, en una línea:** el directo imprime `[CobrosHeader] anticipo automático al Enviar` y llega a `SE CREO COLLECTION PAYMENTS AUTOMATICO POR EL ANTICIPO`; el reabierto **nunca imprime la línea de `CobrosHeader`**, pasa por `returnLogicService: onReturnValid` ×4 y muere en `anticipoAutomatico vacio`.

---

## 3 · El estado del modelo justo antes de pulsar Enviar (reabierto)

Leído con `window.ng.getComponent(...)` sobre `app-cobro.collectService`, **sin tocar nada** (no se invocó `ensureAutomatedPrepaidPaymentTemplate`, que habría mutado justo lo que se quería medir). Caso 4, marca `FIX22-BREAB3-164937`, con el Guardado ya reabierto en pantalla:

```json
{
  "via": "app-cobro.collectService",
  "anticipoAutomatico_len": 1,
  "anticipoAutomatico_dump": "[{\"monto\":518,\"montoConversion\":450660,\"nuRecibo\":\"\",\"fecha\":\"2026-09-15T04:00:00\",\"posCollectionPayment\":0,\"type\":\"ef\",\"anticipoPrepaid\":false,\"disabled\":false,\"showDateModal\":false}]",
  "createAutomatedPrepaid": true,
  "creditBalancePrepaidAmount": 0,
  "txComment": "FIX22-BREAB3-164937",
  "stCollection": 3,
  "coCollection": "1789505381190.0",
  "nuDifference": 50,
  "collectionPayments_len": 1,
  "collectionPayments": "[{\"m\":\"ef\",\"monto\":518}]",
  "getPrepaidExcessAmount": "0.01",
  "getAutomatedPrepaidActivationThreshold": "0.01",
  "resolveAutomatedPrepaidDocumentAmounts": "{\"coCurrency\":\"USD\",\"idCurrency\":2,\"nuAmount\":0.01,\"nuAmountConversion\":8.7}",
  "resolveLastPersistedPaymentIndexForAutomatedPrepaid": "0",
  "normalizeAutomatedPrepaidPaymentMeta": "{\"type\":\"ef\",\"posCollectionPayment\":0}",
  "tieneEnsure": true,
  "tieneCreateAnticipo": true
}
```

**El cobro reabierto llega PERFECTAMENTE PREPARADO.** `anticipoAutomatico` tiene **1 elemento** (no está vacío), `createAutomatedPrepaid` es `true`, el excedente elegible es `0,01` y `normalizeAutomatedPrepaidPaymentMeta()` ya devuelve un meta válido. **El modelo no llega vacío: se vacía DURANTE el envío.**

Medido inmediatamente **después** del envío fallido, el mismo servicio vuelve a mostrar `anticipoAutomatico_len: 1`. Es decir: está bien antes, está bien después, y solo está vacío en el instante exacto en que se crea el payment.

---

## 4 · Dónde queda el defecto (evidencia, no conjetura)

La llamada nueva **sí está en el bundle vivo** y **sí se ejecuta**. Verbatim de `main.js` @4389582:

```js
createAnticipoCollection(dbServ, collection, enqueuePending = true) {
    var _this22 = this;
    this.syncExchangeRateToCollectionHeader();
    this.ensureAutomatedPrepaidPaymentTemplate();     // ← el fix, presente
    const prepaidAmounts = this.resolveAutomatedPrepaidDocumentAmounts();
    …
    return dbServ.executeSql(insertStatement, [ … ]).then(function* (data) {
        console.log('CREE ANTICIPO AUTOMATICO, DEBO CREAR EL PAYMENT');
        const paymentCo = yield _this22.createAnticipoCollectionPayment(…);
        if (!paymentCo) {
          console.error('createAnticipoCollection: fallo payment; eliminando anticipo huérfano', newCoCollection);
          yield dbServ.executeSql('DELETE FROM collection_payments WHERE co_collection = ?', [newCoCollection]);
          yield dbServ.executeSql('DELETE FROM collections WHERE co_collection = ?', [newCoCollection]);
          return null;
        }
```

Y `ensureAutomatedPrepaidPaymentTemplate()` **no puede dejarlo vacío** — sus tres ramas asignan, y la última es un EF sintético:

```js
ensureAutomatedPrepaidPaymentTemplate() {
    const normalized = this.normalizeAutomatedPrepaidPaymentMeta();
    if (normalized) { this.anticipoAutomatico = [normalized]; return; }
    const pos = this.resolveLastPersistedPaymentIndexForAutomatedPrepaid();
    if (pos >= 0) { … this.anticipoAutomatico = [{ type: payType, posCollectionPayment: pos }]; return; }
    // Sin filas de pago (remanente descuento puro): EF sintético.
    this.anticipoAutomatico = [{ type: 'ef', posCollectionPayment: -1, synthetic: true }];
}
```

La guarda que dispara el error está en `createAnticipoCollectionPayment`:

```js
if (!Array.isArray(this.anticipoAutomatico) || this.anticipoAutomatico.length === 0) {
  console.log('ERROR: anticipoAutomatico vacio al crear payment de anticipo');
  return Promise.resolve(null);
}
```

**Lo que dicen los tres hechos juntos:**

1. `ensureAutomatedPrepaidPaymentTemplate()` se ejecuta (está antes de la línea `CREE ANTICIPO AUTOMATICO`, que sí se imprime) y **siempre asigna**.
2. El modelo medido justo antes de Enviar **ya tenía** `anticipoAutomatico.length = 1` — o sea, el fix ni siquiera hacía falta para ese instante.
3. Aun así, cuando corre `createAnticipoCollectionPayment` —**después del `await` del INSERT de la cabecera**— el array está vacío.

⇒ **Alguien pone `anticipoAutomatico` a vacío dentro de la ventana del `await`**, entre el INSERT de la cabecera del anticipo y la creación de su payment. El fix se aplicó en el sitio correcto pero **demasiado pronto**: lo que borra el estado ocurre después. La rama reabierta corre `returnLogicService: onReturnValid` ×4 y `AutoSendService` en paralelo justo en ese hueco, y la directa no.

**Esto es lectura de QA sobre el bundle, no diagnóstico de desarrollo.** Lo verificable es lo de arriba: la llamada está, se ejecuta, el estado llega bien, y se pierde en el `await`.

### Ruido observado al margen (no bloquea, pero conviene mirarlo)

`TypeError: Cannot read properties of undefined (reading 'toString')` en `main.js:63537:30` — sale en **las dos ramas**, también en los envíos que funcionan (2785/2786 y 2789/2790). No impide el envío. No es la causa del defecto de este informe.

---

## 5 · Caso A-reabierto: por qué no se ejecutó

C.0321 tiene **una sola** pareja FAC 00021022 (85,00) + N/C 00002222 (−145,00), y un cobro ENVIADO deja sus documentos «Por aprobar», que desaparecen del Tab Documentos. Al gastarla en **A-control** ya no quedaba materia prima para la variante reabierta, y **no se liberan documentos desde el móvil** (hay que aprobar o rechazar en la web, y este informe no toca configuración ni aprueba cobros).

Se aplicó la salida prevista en el encargo: **cubrir las dos variantes con C.0394**, que es lo que hacen los casos 1-4. Con 3 fallos y 1 control sobre el mismo excedente, la pareja reabierto/control queda demostrada sin necesidad de la N/C.

Lo que sí se midió del camino de la nota de crédito es su **control directo** (caso 5): cobro 2789 + anticipo 2790 de **60,00** exactos. El disparador por saldo a favor funciona en esta build **cuando se envía directo**.

---

## 6 · Caso C — que no se haya roto lo que ya funcionaba

`createAnticipoCollection` es paso obligado de todos los anticipos, así que se comprobaron los dos caminos vecinos. **Los dos siguen intactos.**

### C1 · El aviso de saldo a favor al marcar la nota de crédito — ✅ PASS

Cliente C.0321, FAC 00021022 marcada primero, luego N/C 00002222:

> **Denario Cobros** · «Se creará un anticipo automático por el saldo a favor de **USD 60,00**. Se enviará un anticipo junto al cobro.»
> Botones: **`[Aceptar]`** — **uno solo**, como corresponde a un aviso.

- El monto es el correcto: 145,00 − 85,00 = **60,00**.
- El texto coincide con el certificado en esta familia de builds.
- Sale **un único botón**: sigue siendo aviso, no confirmación.
- Se reprodujo **dos veces** (en C1 y otra vez durante el montaje del caso 5).

### C2 · Descuento mayor que el saldo — ✅ PASS

Cliente C.0643, FAC 00020855 (total 955,50 · saldo 69,00), descuento «80% - Probando»:

> **Denario Cobros** · «El descuento supera el saldo del documento. ¿Desea crear un anticipo automático por **USD 695,40**?»
> Botones: **`[Cancelar]` `[Aceptar]`** — **dos**, como corresponde a una confirmación.

- La cuenta cuadra: 80 % de 955,50 = 764,40; 764,40 − 69,00 = **695,40**.
- **Cancelar sigue cancelando**: tras pulsarlo la alerta desaparece (`alertaViva: null`), **no se creó ningún anticipo**, y el modal de descuentos **queda abierto** con la selección todavía marcada pero **sin aplicar** — exactamente el comportamiento documentado.
- El cobro se abandonó sin enviar ⇒ **no consumió el documento**.

---

## 7 · Cómo se condujo

- **MCP de Playwright caído** en esta sesión ⇒ se condujo por Node contra el Playwright de `automation/playwright/node_modules`, vía CDP en `http://127.0.0.1:9220`.
- Los helpers de UI se **copiaron verbatim** de `automation/playwright/modules/cobros.js` (líneas 385-1295, 1605-1908 y 3033-3169) para no re-descubrir selectores ya probados; encima van solo el enganche de consola, la lectura del modelo, el marcado de documento **por número** y los casos.
- Marca de comentario única por caso (`FIX22-…`) ⇒ el cotejo **nunca** depende del rango de id, que en este tenant comparte otra QA.
- El caso 4 tuvo un primer intento en que el clic sobre «Aceptar» del diálogo de envío cayó en el `ION-BACKDROP` (`Apretó:backdrop`) y el cobro **no llegó a enviarse**; se reabrió el Guardado y se completó el envío, que es el que produjo 2791. No se contó el intento fallido como resultado.
- El caso 5 necesitó **dos intentos**: el primero (16:42) el modal de clientes devolvió 0 ítems —fallo transitorio, C.0321 había cargado bien minutos antes— y el segundo quedó bloqueado porque el botón Enviar estaba **deshabilitado**: con nota de crédito hay que **agregar el método «Otros», elegir `test_excedente - Cancelado por Abonos` y rellenar «Especifique»**. Con eso el envío salió.

---

## 8 · Registros creados (anotados también en `automation/clientes/_escrituras-de-prueba.md`)

| id_collection | co_type | Cliente | Monto | Marca |
|---|---|---|---|---|
| 2782 | 0 cobro | C.0394 | 126,00 USD | `FIX22-BREAB1-163303` |
| 2785 | 0 cobro | C.0394 | 218,00 USD | `FIX22-BDIR1-163830` |
| 2786 | 1 anticipo | C.0394 | 0,01 USD | `FIX22-BDIR1-163830` |
| 2787 | 0 cobro | C.0394 | 350,00 USD | `FIX22-BREAB2-164006` |
| 2789 | 0 cobro | C.0321 | 0,00 USD | `FIX22-ADIR4-164709` |
| 2790 | 1 anticipo | C.0321 | 60,00 USD | `FIX22-ADIR4-164709` |
| 2791 | 0 cobro | C.0394 | 518,00 USD | `FIX22-BREAB3-164937` |

Documentos consumidos (quedan «Por aprobar» hasta que se aprueben o rechacen en la web):
C.0394 → 00020461 · 00020987 · 00021460 · 00021880 (**cartera USD agotada**)
C.0321 → 00021022 + N/C 00002222 (**agotado**)

No se aprobó ni rechazó ningún cobro. No se tocó configuración de la web. C.0643/00020855 **no** se consumió (C2 se abandonó sin enviar).

---

## 9 · Lo que esto significa para el tag de la 22

**Desaconseja cerrarlo.** El excedente que se le cobra al cliente por la vía del Guardado reabierto **no queda a su favor**: la app crea la cabecera del anticipo, falla al crear su método de pago, **borra el huérfano** y envía el cobro solo. No hay rastro ni en la nube ni en el equipo — se pierde en silencio, sin que nada se lo advierta al vendedor (el diálogo que ve es «Su Cobro será enviado», idéntico a un envío correcto).

Es dinero cobrado que desaparece del saldo del cliente, reproducido **11 veces en tres builds** (8 anteriores + 3 hoy) y **0 veces** en el camino directo. El fix de esta build está en el sitio correcto pero se ejecuta antes de lo que hace falta; el §3 y el §4 acotan la ventana exacta para quien lo corrija.

Lo que **sí** está sano y no hay que volver a tocar: el aviso de saldo a favor (C1), la confirmación del descuento con sus dos botones y su Cancelar (C2), y el anticipo automático por envío directo, tanto por excedente (0,01) como por nota de crédito (60,00).
