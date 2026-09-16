# Aviso de saldo a favor al cobrar con notas de crédito — IMPORTADORA 4K
## Validación del fix · 15/09/2026

| Parámetro | Valor |
|---|---|
| RUN_ID | `alerta_ncr_20260915` |
| Cliente / empresa | **4k** · `DIESE` · GRUPO 4K — empresa única. Guarda verificada en el cobro vivo: `collection.coEnterprise = "DIESE"` |
| Playa | **CARIBE** (la declarada en el encargo; no se re-midió el `ws_url` en runtime) |
| Usuario del equipo | **`V.0030zgrancaracas`** · `idUser` **338** · **JOAN BRICEÑO** — leído de `localStorage.user`, no supuesto |
| App | `com.kiberno.denarioPremiumPro` **6.6.21.3** · `db_version` 23 · bundle `main.js` **5.425.844 caracteres** |
| Dispositivo | Infinix X6728 · CDP `:9220` · Chrome/152.0.7977.87 |
| Conducción | Node + Playwright de `automation/playwright/node_modules` (`connectOverCDP` vía `drv.js`). **El MCP de Playwright no levanta** |
| Corte de referencias | `max(id_collection)` = **2765** antes de empezar ⇒ todo lo creado aquí es ≥ 2766 |

---

## Veredicto

> ### ✅ **El fix cumple lo que pidió QA — en el camino que QA describió.**
>
> El aviso **sale**, dice **el importe y la moneda correctos**, aparece **en el momento útil**
> (al marcar la nota de crédito, no al enviar), es **un AVISO de un solo botón** y **vuelve a
> salir cada vez**. Los cuatro requisitos, medidos.
>
> ### 🔴 **Pero hay un camino en el que no sale — y en ese mismo camino tampoco se genera el anticipo.**
>
> En un cobro **reabierto desde Guardado** el usuario no recibe ningún aviso **y además el
> anticipo no llega a la nube**. Es el agujero por partida doble que el encargo anticipaba:
> **`DM-COB-058` sigue vivo**, y ahora con un control que lo aísla.

| Caso | Qué se preguntaba | Resultado |
|---|---|---|
| **A** | ¿Sale el aviso, con el monto, y es aviso o confirmación? | ✅ **PASA** — sale al marcar la N/C · «USD 60,00» · **1 botón** |
| **B** | ¿Sale **cada vez**, no una vez por sesión? | ✅ **PASA** — 2.º cobro sin reiniciar: sale con **144,00** |
| **C** | ¿Sale en un cobro **reabierto**? ¿Se genera el anticipo? | 🔴 **NO sale · NO se genera** — `DM-COB-058` vivo |
| **D** | Contraste con el descuento que ya avisaba | ✅ **Contraste limpio** — confirmación de 2 botones, y con razón |

⚠️ **Sobre la etiqueta, como pedía el encargo:** `COB_MSG_NCR_CREDIT_PREPAID` **no existe** en el
catálogo de 4K (873 etiquetas activas, 13 módulos — se consultó `application_tags`). **Lo que se
validó es el texto de fábrica del bundle, no una redacción del cliente.** Si 4K personaliza esa
etiqueta más adelante, el texto cambia y **hay que volver a mirarlo**.

---

## 0 · Configuración leída del EQUIPO antes de medir

`localStorage.globalConfiguration` (187 claves; en este build es un array de pares, no un objeto):

| Clave | Equipo | Por qué importa aquí |
|---|---|---|
| `automatedPrepaid` · `cobroPrepago` | **true** · true | Sin `automatedPrepaid` la guarda corta y no hay aviso |
| `prepaidRangeAmount` · `prepaidCurrency` | 0,01 · **USD** | La moneda del aviso sale de aquí |
| `RangoToleranciaPositiva` / `Negativa` | 49,99 / 10 · `TipoTolerancia` 0 | 🔑 **No aplican a este camino** (ver §5) |
| `enablePartialPayment` | **true** | Hace posible el caso B |
| `enableDifferenceCodes` | **true** | Habilita el selector del método «Otros» |
| `requiredComment` · `longitudComentario` | true · 200 (la UI rotula «Máx. 255») | El comentario es el testigo del oráculo |
| `requiredCollectionAttachments` | false | Se puede **Enviar** sin adjunto |
| `userCanSelectCollectDiscount` · `maxCollectDiscount` | true · **0** | Caso D. El tope 0 **no bloqueó** el 80 % |
| `colletionPayment` | `true-true-true-true-true-true` | Los 6 métodos habilitados |

### El fix, leído del bundle vivo

```js
/** Aviso NCR > FACT en Documentos: cada vez que hay saldo a favor (no una sola vez por sesión). */
shouldShowCreditBalancePrepaidInformMessage() {
  if (this.recentOpenCollect || !this.automatedPrepaid || this.coTypeModule !== '0') return false;
  if (this.creditBalancePrepaidAmount <= 0 || this.hasConfirmedDiscountRemnantPrepaid()) return false;
  return true;
}
/** @deprecated Ya no se suprime el aviso NCR; se mantiene por compatibilidad de llamadas. */
markCreditBalancePrepaidInformMessageShown() { /* noop — COB-NCR-PREPAID-002 */ }

/** Aviso informativo (solo Aceptar): anticipo por NCR que supera saldo a pagar. */
buildCreditBalancePrepaidInformMessage() { … }
```

🔑 **Tres cosas que el código promete y que había que comprobar en pantalla:**
1. «**cada vez**, no una sola vez por sesión» — respaldado por el `markCreditBalance…Shown()`
   convertido en **noop**. ⇒ caso B.
2. «**Aviso informativo (solo Aceptar)**» — pero la plantilla lo pinta con
   `("buttons", ctx.alertButtons)`, y `alertButtons` es un **array compartido**. En este
   componente vale `[ /* {role:'cancel'}, */ {role:'confirm'} ]` — **la entrada de Cancelar
   está comentada**, así que debería salir con un botón. **Comentado ≠ medido**: se midió.
3. La guarda **excluye `recentOpenCollect`** ⇒ caso C.

---

## 1 · Caso A — El aviso aparece, y dice el monto

**Montaje.** Cobro nuevo a **`C.0321` ELIFAZ PART S, C.A.** El selector de clientes ya mostraba
el saldo neto del cliente en **−60,00 USD**, que es el excedente esperado antes de tocar nada.

Tab Documentos, moneda USD — los dos documentos, libres:

```
FAC  00021022  USD  89 días   1.484,00 USD   Saldo     85,00 USD
N/C  00002222  USD  50 días    -145,00 USD   Saldo   -145,00 USD
```

Se marcó **primero la FACTURA** (`montoTotalPagar` pasó a 85,00) y **después la nota de crédito**.

### ¿Aparece? ✅ SÍ — y en el momento útil

**Al marcar la N/C**, medido con muestreo cada 250 ms: la alerta ya estaba **visible en la
primera muestra (≤ 250 ms)**. No hay que salir del detalle ni pulsar Enviar.

> 🔑 **Esto corrige el defecto reportado en su punto exacto.** El 14/09 el hallazgo fue que los
> 144,00 «no aparecen en ninguna parte de la interfaz» y que el usuario se enteraba al enviar.
> Ahora el aviso sale **en el mismo gesto que crea el saldo a favor**.

### El texto literal

```
Denario Cobros

Se creará un anticipo automático por el saldo a favor de USD 60,00.
Se enviará un anticipo junto al cobro.

                                                          [ ACEPTAR ]
```

| Comprobación | Resultado |
|---|---|
| ¿Dice el importe? | ✅ **60,00** — exacto (145,00 − 85,00) |
| ¿Dice la moneda? | ✅ **USD** |
| ¿Salen `{currency}` / `{amount}` literales? | ✅ **NO. D-02 no reproduce** |
| Cabecera | «Denario Cobros» |

**Por qué D-02 no puede reproducir aquí, y qué protege de verdad** — el formateador:

```js
formatAutomatedPrepaidMessageTemplate(template, amount) {
  const currency = this.resolveConfiguredPrepaidCurrency() || …;
  const formattedAmount = this.currencyService.formatNumber(amount);
  if (template.includes('{currency}'))
    return template.replace(/\{currency\}/g, currency).replace(/\{amount\}/g, formattedAmount);
  const amountLabel = `${currency} ${formattedAmount}`.trim();
  return template.replace(/\{amount\}/g, amountLabel);   // ← plantilla sin {currency}
}
```

⇒ Tiene **las dos ramas cubiertas**: si la plantilla trae `{currency}` sustituye ambos, y si
**no** lo trae antepone la moneda al importe igualmente. Esto importa **más de lo que parece
para 4K**: la etiqueta que 4K **sí** tiene personalizada (`COB_MSG_AUTOMATED_PREPAID`, la del
otro camino) lleva **`{amount}` pero no `{currency}`**, y aun así saldría bien. **El riesgo real
no es el marcador huérfano, sino una etiqueta futura escrita con otro nombre de marcador**
(`{monto}`, `{moneda}`…): eso sí saldría literal y ninguna rama lo cubre.

### 🔑 ¿Aviso o confirmación? — **AVISO**, que es lo que QA pidió

```
nBtns = 1     ·     btns = [{ txt: "Aceptar", role: "confirm" }]
```

**Un solo botón, «Aceptar».** No hay Cancelar. ✅ **Coincide con lo que pidió QA**: aquí no hay
nada que decidir, el anticipo se genera igual, y la interfaz no finge lo contrario.

*(La pregunta del encargo «si trae Cancelar, di qué pasa al pulsarlo» queda sin objeto: no lo trae.)*

### El modelo, en el mismo instante

```
creditBalancePrepaidAmount = 60      montoTotalPagar      = 0
createAutomatedPrepaid     = true    anticipoAutomatico   = 1
shouldShowCreditBalancePrepaidInformMessage() = true
```

---

## 2 · Caso B — Sale **cada vez**, no una sola vez por sesión

Se comprobó **dos veces, en dos niveles distintos**:

### B.1 · Dentro del mismo cobro

Se **desmarcó** la N/C (`creditBalancePrepaidAmount` volvió a 0, sin aviso — correcto) y se
**volvió a marcar**: **el aviso salió otra vez**, con el mismo texto y el mismo botón único.

### B.2 · Segundo cobro, sin reiniciar la app — el caso que pedía el encargo

Cobro nuevo a **`C.0864` MULTISERVICIOS DON PEDRO MARRON**, en la **misma sesión**, sin cerrar
ni reiniciar nada. `FAC 00022180` con **pago parcial de 100,00** + `N/C *0001523` (−244,00).

```
Denario Cobros

Se creará un anticipo automático por el saldo a favor de USD 144,00.
Se enviará un anticipo junto al cobro.

                                                          [ ACEPTAR ]
```

| Comprobación | Resultado |
|---|---|
| ¿Vuelve a salir sin reiniciar? | ✅ **SÍ** |
| ¿Dice **144,00** y no el 60,00 anterior? | ✅ **144,00** (244,00 − 100,00). **No hay monto pegado** del caso anterior |
| ¿Sigue siendo 1 botón? | ✅ «Aceptar» |

✅ **El comentario del código se cumple.** El aviso no se suprime tras la primera vez.

---

## 3 · 🔴 Caso C — El cobro reabierto desde Guardado

**Montaje.** El **mismo cobro del caso A** (`C.0321`, saldo a favor de 60,00, ya con su aviso
visto y aceptado) se **GUARDÓ** («El Cobro se ha guardado»), se **salió** al home de Cobros, y se
**reabrió** desde BUSCAR → *«Cliente: C.0321 · Estatus: Guardado»*.

### 3.1 · ¿Sale el aviso? — **NO**

**Y «no sale» aquí está medido como ausencia real, no como descuido.** La trampa era
precisamente ésta: las `ion-alert` descartadas **siguen en el DOM**. Se separó *presente* de
*visible* comprobando `overlay-hidden`, `display`, `visibility` y `getBoundingClientRect()`:

| Medición | Resultado |
|---|---|
| Muestreo tras reabrir | **~20 s** (12 muestras de 0,5 s + 16 más), en todas: **0 alertas visibles** |
| `ion-alert` en el DOM | 17 — **todas ocultas**, ninguna visible |
| Grabador de alertas (observador + barrido cada 250 ms) | **cero** entradas en la fase `C-REABRIR` |
| `ion-toast` / `ion-loading` / `ion-popover` visibles | ninguno — tampoco se avisó por otra vía |

**El cobro reabierto era el correcto**: comentario `Test-NCR-A-0321-105309`, 2 documentos, los
dos checkboxes seguían marcados.

### 3.2 · 🔑 La causa **no** es la guarda `recentOpenCollect` — y esto cambia el arreglo

El encargo apuntaba a `recentOpenCollect` como la razón. **Medido en el cobro reabierto:**

```
recentOpenCollect = false        ← ya se había limpiado
creditBalancePrepaidAmount = 60
shouldShowCreditBalancePrepaidInformMessage() = true   ← ¡la guarda DICE QUE SÍ!
alertCreditBalancePrepaidOpen = false                  ← pero nadie la abrió
```

⇒ **La guarda autoriza el aviso y el aviso no sale igual.** El motivo está en quién la llama:

```js
// El ÚNICO invocador, dentro del manejador de selección de documento:
void cs.calculatePayment('', 0).then(() => { this.maybeShowCreditBalancePrepaidInform(); … });
```

`maybeShowCreditBalancePrepaidInform()` **solo se invoca al marcar o desmarcar un documento**.
Al reabrir un cobro guardado **no se marca nada** —los documentos ya vienen marcados—, así que
**nunca se llama**. `recentOpenCollect` ni siquiera llega a intervenir.

> ⚠️ **Por qué conviene decirlo así:** si el arreglo se plantea como «quitar `recentOpenCollect`
> de la guarda», **no arreglaría nada**: la guarda ya devuelve `true`. Lo que falta es **llamar
> al aviso también al terminar de cargar un cobro reabierto**.

### 3.3 · 🔴 Y el anticipo **tampoco se genera** — `DM-COB-058` sigue vivo

Se completó el cobro (método **Otros** + `test_excedente` + «Especifique») y se **envió**.

**Justo antes de pulsar Enviar, el modelo decía que sí lo iba a crear:**

```
createAutomatedPrepaid = true     creditBalancePrepaidAmount = 60     anticipoAutomatico = 1
```

**Lo que llegó a la nube:**

```
id_collection | co_type | co_client | nu_amount_total | tx_comment
     2766     |    0    |  C.0321   |     0.0000      | Test-NCR-A-0321-105309
                    ↑ y nada más: NO hay fila co_type = 1
```

```sql
SELECT co_type, count(*) FROM collection WHERE tx_comment = 'Test-NCR-A-0321-105309' GROUP BY co_type;
-- co_type 0 → 1 fila.   co_type 1 → NINGUNA.
```

Se reconsultó ~15 min después por si la sincronización fuera diferida: **el anticipo nunca llegó**.

**🔑 El control que lo aísla.** En la **misma sesión**, el **mismo vendedor**, el **mismo
mecanismo** y el **mismo método de pago**, pero **sin reabrir**, el caso B sí generó su anticipo:

| | Cobro | Anticipo | ¿Reabierto? |
|---|---|---|---|
| **Caso C** (`C.0321`) | 2766 · 0,00 | 🔴 **ninguno** (faltan 60,00) | **Sí, desde Guardado** |
| **Caso B** (`C.0864`) | 2767 · 0,00 | ✅ **2768 · 144,00 USD** | No |

⇒ La única variable que cambia es **haber pasado por Guardado**. El mecanismo está en el bundle:

```js
handleOpenCollect() {
  this.collectService.recentOpenCollect    = true;
  this.collectService.createAutomatedPrepaid = false;   // ← apaga el anticipo
  this.collectService.anticipoAutomatico     = [];      // ← y vacía su lista
  …
}
```

Al reabrir se **apaga y se vacía**. Que después el modelo volviera a mostrar `true` / `1` es un
recálculo posterior **que ya no repone lo que se envía**: el payload sale sin anticipo.

### 3.4 · Lo que hay que preguntar a producto

> **¿Es intencional que un cobro reabierto desde Guardado no avise del saldo a favor?**
>
> Si la respuesta es «sí, para no repetir un aviso que el usuario ya vio», **sigue sin cuadrar
> con lo que se midió**: en el mismo camino **tampoco se crea el anticipo**, así que el usuario
> se queda sin el aviso *y* sin los 60,00 acreditados. Callar un aviso es discutible; perder el
> anticipo no.
>
> **Es el mismo agujero por partida doble: ni avisa ni genera.**

---

## 4 · Caso D — Contraste con el camino que ya avisaba

**Montaje.** Cliente **`C.0643` FRENOS DE AIRE HERMANOS BETANCOURT**, `FAC 00020855`
(total 955,50 · **saldo 69,00**), detalle → **ASIGNAR DESCUENTO** → «80 % - Probando» → ACEPTAR.

*(Se eligió un documento con el total muy por encima del saldo: el descuento se calcula sobre el
**total** del documento, no sobre el saldo — 955,50 × 0,80 = 764,40 ⇒ remanente 764,40 − 69,00 =
**695,40**, que es justo lo que dice la alerta.)*

### El texto literal

```
Denario Cobros

El descuento supera el saldo del documento.
¿Desea crear un anticipo automático por USD 695,40?

                                        [ CANCELAR ]   [ ACEPTAR ]
```

### La comparación, lado a lado

| | **Aviso N/C** (el fix) | **Alerta del descuento** (la que ya existía) |
|---|---|---|
| Cabecera | Denario Cobros | Denario Cobros |
| Redacción | **afirmativa**: «Se creará…» | **interrogativa**: «¿Desea crear…?» |
| Botones | **1** — `Aceptar` (`confirm`) | **2** — `Cancelar` (`cancel`) + `Aceptar` (`confirm`) |
| Formato del importe | `USD 60,00` | `USD 695,40` — **idéntico** |
| Naturaleza | **Aviso** | **Confirmación** |
| ¿Correcto? | ✅ nada que decidir | ✅ sí hay qué decidir |
| Etiqueta | `COB_MSG_NCR_CREDIT_PREPAID` | `COB_MSG_DISCOUNT_REMNANT_PREPAID` |
| ¿En `application_tags` de 4K? | ❌ no | ❌ no — **las dos son texto de fábrica** |

**Qué hace CANCELAR aquí — medido, no supuesto:** cierra la alerta, **no aplica el descuento**
(`montoTotalPagar` siguió en **69,00**), **no arma anticipo** (`discountRemnantPrepaidAmount = 0`,
`createAutomatedPrepaid = false`) y **devuelve al modal de Descuentos** con el 80 % aún marcado,
para que el usuario cambie de idea. ⇒ **El Cancelar del descuento cancela de verdad.**

> 🔑 **La conclusión del contraste no es «deberían ser iguales».** Es que **la diferencia está
> bien puesta**: donde hay una decisión (aplicar o no el descuento) hay dos botones y una
> pregunta; donde no la hay (el saldo a favor de la N/C se acredita igual) hay un botón y una
> afirmación. **El fix acertó el registro.**

*Nota de configuración:* `maxCollectDiscount` vale **0** en el equipo y **no impidió** aplicar un
descuento del 80 %. El tope 0 se comporta como «sin tope», no como «ningún descuento».

---

## 5 · Dos cosas que conviene no confundir

**1 · Este camino NO pasa por el techo de tolerancia.** En el camino del *excedente de pago*, un
exceso de 50,00 acaba en un anticipo de **0,01** porque se descuenta `RangoToleranciaPositiva`
(49,99). **Aquí no**: el caso B acreditó **144,00 enteros** y el caso A esperaba **60,00
enteros**. Son dos reglas distintas; no hay que leer una con la tabla de la otra.

**2 · El anticipo sigue emitiéndose con método `ef` (Efectivo)** aunque `prepaidPaymentMethod`
valga `"pa"` (`collection_payment` de 2768: `co_payment_method = 'ef'`). **No es de esta
corrida** — los anticipos automáticos previos de 4K salieron todos con `ef`. Se anota, no se
reporta como defecto nuevo.

---

## Registros creados en sistema

| Ref | `co_type` | Cliente | Detalle | Estado |
|---|---|---|---|---|
| **2766** | 0 · cobro | C.0321 | `FAC 00021022` (85,00) + `N/C 00002222` (−145,00) · **reabierto desde Guardado** · Otros + `test_excedente` | Enviado · «Por aprobar» |
| — | — | — | 🔴 **su anticipo de 60,00 NO existe** — el defecto | — |
| **2767** | 0 · cobro | C.0864 | `FAC 00022180` **parcial 100,00** + `N/C *0001523` (−244,00) · Otros + `test_excedente` | Enviado · «Por aprobar» |
| **2768** | **1 · anticipo** | C.0864 | **144,00 USD** (método `ef`) | Enviado · «Por aprobar» |

**Detalle aplicado** (`collection_detail`), coherente en los dos cobros:

```
2766 · 00021022  doc 1.484,00  pagado    85,00  saldo    85,00  parcial=false
2766 · 00002222  doc   145,00  pagado  -145,00  saldo  -145,00  parcial=false
2767 · 00022180  doc 2.552,00  pagado   100,00  saldo 2.452,00  parcial=TRUE
2767 · *0001523  doc   244,00  pagado  -244,00  saldo  -244,00  parcial=false
```

**Un cuarto cobro se montó y NO se guardó**: el del caso D (`C.0643`), abandonado con **SALIR SIN
GUARDAR** tras copiar la alerta. No dejó registro.

Anotado en `automation/clientes/_escrituras-de-prueba.md`, con cómo revertirlo (rechazar 2766,
2767 y 2768 desde la web devuelve los cuatro documentos al Tab Documentos).

**No se ejecutó SQL de escritura. No se aprobó ni rechazó ningún cobro. No se tocó ninguna
configuración de la web ni ninguna variable global.**

---

## Lo que NO se pudo comprobar

| Punto | Motivo |
|---|---|
| **El aviso con una etiqueta personalizada del cliente** | `COB_MSG_NCR_CREDIT_PREPAID` no existe en 4K. Solo se validó **el texto de fábrica**. Un tenant que la personalice necesita su propia pasada |
| **Qué pasa al pulsar «Cancelar» en el aviso de la N/C** | **No hay Cancelar** — que es justo lo que pedía QA |
| **Si el aviso sale al reabrir un cobro ya ENVIADO** (no Guardado) | Solo se midió el reabierto desde **Guardado**, que es el que pedía el encargo |
| **Si el anticipo se pierde también al reabrir por otras vías** | Solo se probó Guardado → reabrir → enviar |
| **El caso con el cobro naciendo en Bs** | El cobro de 4K nace en **USD**; la trampa de conversión no llegó a ejercitarse |
| **Si «Otros» es obligatorio o valdría otro método** | «Otros» **venía pre-marcado** en los dos cobros y no se probó con Efectivo |
| **`ws_url` de la playa en runtime** | No aparece en el bundle ni en `localStorage`. Se toma **CARIBE** del encargo |

### Si algo de esto fuera mi método y no la app

**El caso C es el que más merece una comprobación a mano**, porque es el hallazgo grave. Lo que
pediría reproducir a mano es exactamente esto:

> Cobro a un cliente con N/C mayor que el saldo → ver el aviso → **Guardar** → salir → reabrir →
> ¿sale el aviso? → completar con Otros + código → Enviar → **¿aparece la fila «Anticipo» en la
> lista de cobros?**

Dicho esto, **el resultado no depende de cómo conduje yo la pantalla**: el oráculo es la fila
`co_type = 1` en la nube, y el control del caso B —montado con el mismo guion, la misma sesión y
el mismo método— **sí la produjo**. Si fuera un artefacto de mi conducción, B habría fallado
también.

---

## Trampas (confirmadas y nuevas)

| # | Trampa | Detalle |
|---|---|---|
| **T-1** | *(confirmación)* **«Otros» viene YA MARCADO** en el modal de métodos cuando el escenario es NCR > FACT | Se leyó `checked` **antes** de tocar nada, en los dos cobros: `Otros = true`, el resto `false`. Un guion que «clickee Otros» **lo desmarca** |
| **T-2** | *(confirmación)* **La N/C ordena ANTES que la factura** en `C.0864` (`*0001523` antes de `00022180`), pero **NO** en `C.0321` (`00021022` antes de `00002222`) | 🔑 **El orden no es estable entre clientes.** Localizar la fila por `nu_document`, nunca por posición |
| **T-3** | *(confirmación)* **El pago parcial es un `ion-toggle` DENTRO del detalle** | Lupa → `#eventModal`. Apagado, «Monto a pagar» es `readOnly` con el saldo; al encenderlo pasa a editable y **se resetea a 0,00** |
| **T-4** | *(confirmación)* **Con «Pago parcial» encendido DESAPARECE «ASIGNAR DESCUENTO»** | Los caminos B y D son **excluyentes en la misma pantalla** |
| **T-5** | *(confirmación)* Campo de monto **centavos-acumulativo** | `10000` → `100,00`. Tras teclear, `blur()` + espera antes de medir coordenadas |
| **T-6** | *(confirmación)* **El anticipo no se acusa al enviar** | Solo salió «Cobro nro. 2767 enviado exitosamente». El anticipo **2768 llegó igual**. Validar «por la alerta» da **falso negativo** |
| **T-7** | 🔑 **NUEVA — El «Comentario» no tiene `ion-item` ni `label` en este build** | `modules/cobros.js` lo busca por `closest('ion-item')` y **no lo encuentra, devolviendo `false` en silencio**. El ancla que sí funciona: el `ion-input` con **`maxlength="255"`**, o el rótulo «Comentario:» en un DIV ancestro |
| **T-8** | 🔑 **NUEVA — La tabla de Documentos NO es `<table>`/`<tr>`** | Es una rejilla Ionic: fila = **`ion-row.tabladocumentSalesVenta`**, celda = `ion-col`. `closest('tr')` devuelve `null` y **deja el texto vacío sin fallar** — un inventario que parece correcto y está en blanco |
| **T-9** | 🔑 **NUEVA — Los tiles del HOME son `<a class="ion-text-center">`, no `ion-button`** | Buscar `app-home ion-button` solo encuentra **«Salir»**. Un guion que itere ion-buttons del home puede acabar pulsando justo el que cierra la sesión |
| **T-10** | 🔑 **NUEVA — `window.ng.getComponent(null)` LANZA excepción** | Durante la transición de pantalla el componente desaparece un instante y la sonda **mata el guion a media medición**. Envolver siempre en `try/catch` y comprobar el elemento antes |
| **T-11** | 🔑 **NUEVA — El DOM de las `ion-alert` se REUTILIZA** | El grabador registró «Cobro nro. **2766** enviado» durante el envío del caso B (que fue el **2767**): Ionic recicló el nodo y el texto viejo quedó un instante. **El número de referencia hay que leerlo en vivo**, no del histórico de nodos |
| **T-12** | ⚠ **Durante el envío apareció**: «Está intentando sincronizar con un usuario que es diferente al previamente ingresado… todos los datos anteriores serán borrados» | Se verificó después: **la sesión siguió intacta** (`idUser` 338, 17 claves en `localStorage`, la lista de cobros completa). **No borró nada**, pero la redacción asusta y aparece sin que se haya cambiado de usuario |
| **T-13** | *(no reprodujo)* El primer clic sobre el botón de una `ion-alert` cae en el `ION-BACKDROP` | **Esta corrida no falló ni una vez**: los 6 clics sobre alertas acertaron a la primera (`elementFromPoint` devolvió `SPAN.alert-button-inner`). Se siguió verificando igual |

---

## Qué llevar a producto

1. 🔴 **El cobro reabierto desde Guardado no avisa Y no genera el anticipo.** Es el punto 1 y es
   grave: el cliente se queda sin los 60,00 acreditados. Contraste limpio en la misma sesión
   (2766 sin anticipo · 2768 con él). **`DM-COB-058` sigue vivo.**
2. 🔑 **El arreglo del aviso no está donde parece.** La guarda `shouldShowCreditBalancePrepaidInformMessage()`
   ya devuelve **`true`** en el cobro reabierto; lo que falta es **llamar a
   `maybeShowCreditBalancePrepaidInform()` al terminar de cargar un cobro reabierto**, porque hoy
   solo se invoca al marcar/desmarcar un documento. Quitar `recentOpenCollect` de la guarda **no
   arreglaría nada**.
3. ✅ **Lo que pidió QA está cumplido en el camino normal** — aviso de un botón, importe y moneda
   correctos, en el momento de marcar la N/C, y **cada vez**. Se puede cerrar esa parte del REQ.
4. ⚠️ **4K no tiene la etiqueta `COB_MSG_NCR_CREDIT_PREPAID`**: lo validado es el texto de
   fábrica. Si se decide personalizarla, **volver a validarla** — y cuidado con inventar nombres
   de marcador: solo `{currency}` y `{amount}` se sustituyen; cualquier otro saldría literal.
5. ℹ️ **El anticipo automático se emite con método `ef`** aunque `prepaidPaymentMethod` sea `"pa"`.
   Histórico en 4K, no una regresión — pero sigue sin cuadrar con la configuración.
