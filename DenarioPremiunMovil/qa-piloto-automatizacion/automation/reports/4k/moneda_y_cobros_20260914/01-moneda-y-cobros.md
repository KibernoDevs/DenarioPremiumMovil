# Moneda por módulo + 3 fixes de Cobros — IMPORTADORA 4K · 14/09/2026

| Parámetro | Valor |
|---|---|
| RUN_ID | `moneda_y_cobros_20260914` |
| Cliente / empresa | **4k** · `DIESE` (rótulo **DIESEL** en la UI) · GRUPO 4K · RIF J401702600 |
| Playa | **CARIBE** — `http://denariocaribe.ddns.net:8080/DenarioPremium` |
| Usuario del equipo | `V.0002` / login `v.0002zonacentral` · idUser 300 · ANGEL BETANCOURT |
| App | `com.kiberno.denarioPremiumPro` — **6.6.21.3** · bundle `main.js` **5.414.961 bytes, sin minificar** |
| Dispositivo | Infinix X6728 (`14678405BR003855`) · CDP `:9220` |
| Conducción | Node + Playwright de `automation/playwright/node_modules` (`connectOverCDP`). **El MCP de Playwright no levanta.** |
| Tasa vigente | **870,00 Bs = 1,00 USD** (`Fecha Tasa 18/8/2026`) |
| Resultado | **B1 PASS · B2 PASS · B3 BLOCKED por dato** · moneda: 5 módulos OK, **3 no cuadran**, 1 con nota |

---

## 0 · Comprobación de build — 🔴 EL CHEQUEO LITERAL DA UN FALSO NEGATIVO

**Léase esto antes que nada.** La instrucción era: *«si el bundle sigue devolviendo `prepaidRangeAmount` a secas,
el fix no entró»*. **Aplicada al pie de la letra, esa regla habría hecho reportar un FAIL que no existe.**

### Lo que devuelve la función, textual del bundle vivo (`fetch('http://localhost/main.js')`)

```js
/**
 * Umbral mínimo de excese para activar anticipo = prepaidRangeAmount
 * aplicado sobre el excedente posterior a tolerancia positiva (COB-PREPAID-005).
 * Redondeo a decimales de moneda (COB-TOL-DEC-002).
 */
getAutomatedPrepaidActivationThreshold() {
  const prepaidMin = this.parseConfigDecimal(this.prepaidRangeAmount);
  return Number(prepaidMin.toFixed(this.getMoneyDecimalPlaces()));
}
```

⇒ **Sigue devolviendo `prepaidRangeAmount` a secas** (medido en vivo: `= 0.01`).
Y `getPositiveToleranceCeilingInCollectionCurrency` tiene **0 ocurrencias** en el bundle.

### Pero la suma SÍ volvió — por otra vía

El techo de tolerancia se descuenta **antes**, en una función nueva que en la medición del 10/09 no existía:

```js
resolvePrepaidEligibleExcessInCollectionCurrency(rawExcess) {
  if (normalizedRaw <= 0) return 0;
  if (!this.tolerancia0 || this.TipoTolerancia != 0 || this.existPartialPayment) return normalizedRaw;
  const positiveLimit = this.convertToleranceRangeToCollectionCurrency(this.RangoToleranciaPositiva);
  const beyondTolerance = normalizedRaw - positiveLimit;      // ⇐ AQUÍ está la suma, con signo cambiado
  const eligible = Math.max(0, beyondTolerance);
  return this.cleanFormattedNumber(this.currencyService.formatNumber(eligible));
}

/** Excedente para anticipo automático (misma moneda que prepaidRangeAmount).
 *  Tras tolerancia positiva; umbral de activación = `prepaidRangeAmount` sobre ese remanente. */
getPrepaidExcessAmount() {
  const rawExcess = this.syncPrepaidDifferenceAmounts();
  const eligible  = this.resolvePrepaidEligibleExcessInCollectionCurrency(rawExcess);
  ...
}
```

Y el consumidor compara el excedente **ya neto** contra el umbral:

```js
shouldCreateAutomatedPrepaidOnSend() {
  ...
  const prepaidExcess = this.getPrepaidExcessAmount();
  if (prepaidExcess < this.getAutomatedPrepaidActivationThreshold()) return false;
  ...
}
```

**Es algebraicamente la suma:** `excesoBruto − 49,99 ≥ 0,01` ⟺ `excesoBruto ≥ 50,00`.

### ✅ VEREDICTO: **el fix del umbral SÍ entró.**

No se refactorizó el nombre de la función; se movió la resta al cálculo del excedente. El oráculo barato
que hay que usar a partir de ahora **no es** el cuerpo de `getAutomatedPrepaidActivationThreshold`, sino
la existencia de **`resolvePrepaidEligibleExcessInCollectionCurrency`** (y su `normalizedRaw - positiveLimit`).
Confirmado además **en vivo**, con el cobro abierto (§B1).

### Re-login obligatorio — hecho antes de medir nada

| Paso | Evidencia |
|---|---|
| Config de moneda cambiada en la web | `currency_modules` en la nube: `da_update` **2026-09-14 15:02:21 / 15:03:29** (módulos 1, 2, 4 y 5) |
| Cierre de sesión + login nuevo | `SALIR` en HOME → `/login` → credenciales del bloque `# Cliente: 4k` → `/synchronization` → HOME |
| Sesión nueva | `localStorage.lastUpdate` pasó de `2026-09-14 11:19:37.177` a **`2026-09-14 11:38:30.922`** (hora del equipo, UTC−4) |
| Nube vs equipo tras el login | `currency_modules`: **9/9 filas idénticas**. Sin diferencias. |

### Guarda de tenant — verificada antes de leer la BD

`enterpriseList` = **1 empresa**: `{coEnterprise:"DIESE", lbEnterprise:"DIESEL", naEnterprise:"GRUPO 4K", nuRif:"J401702600", coCurrencyDefault:"USD"}`
· `localStorage.coUser` = **V.0002** · `idUser` = 300. Coincide con el YAML del cliente. **Se puede leer la BD.**

### Configuración de tolerancia/anticipo leída del EQUIPO tras el re-login

`localStorage.globalConfiguration` (187 claves) — y reconfirmada dentro del cobro vivo (`collectService`):

| Clave | Equipo | Coincide con la web |
|---|---|---|
| `prepaidRangeAmount` | **0.01** | ✅ (auditoría nube: `1 → 0.01` el 11/09 14:07:57) |
| `RangoToleranciaPositiva` | **49.99** | ✅ |
| `RangoToleranciaNegativa` | **10** | ✅ |
| `TipoTolerancia` | **0** (Importe) | ✅ |
| `MonedaTolerancia` · `prepaidRangeCurrency` · `prepaidCurrency` | **USD** | ✅ |
| `tolerancia0` · `automatedPrepaid` | **true** | ✅ |

⇒ **El ×100 de D-01 no ocurrió esta vez.** El equipo trae 0,01, igual que la web.
**Umbral = 49,99 + 0,01 = 50,00 exacto, sin zona gris.**

---

## A · Moneda por módulo

### A.0 · Herramienta `moneda-por-modulo.js` — usada, y con dos defectos propios

`node automation/playwright/moneda-por-modulo.js 4k` imprime bien las tres tablas y **confirma que nube y
equipo coinciden**, pero:

1. 🔴 **Nunca consigue leer las variables globales.** `leer-vg-dispositivo.js` **no tiene `module.exports`**,
   así que el `require('./leer-vg-dispositivo')` del script no obtiene `leerVGs` y las tres filas del
   contraste salen como `(no leída)`. Ése es exactamente el hueco que pedía el encargo.
2. 🔴 **Ese `require` además ejecuta el CLI del otro script como efecto colateral**: se conecta al CDP,
   consume `process.argv[2]` (por eso imprime `Sin coincidencias para: 4k`) y **llama a `browser.close()`
   sobre la conexión CDP**, que es un anti-patrón documentado en `RUNTIME §3` (repliega la WebView).
   En esta corrida la app sobrevivió porque estaba en HOME; **ejecutarlo con un cobro abierto es peligroso**.

*Arreglo mínimo sugerido (no aplicado, no se tocó el script):* exportar `leerVGs()` en
`leer-vg-dispositivo.js` con guarda `if (require.main === module)` alrededor del IIFE, y **no cerrar el
browser** (`drv.js` ya documenta por qué).

### A.1 · Configuración vigente (NUBE = EQUIPO, ya re-logueado)

```
  Módulo         | Moneda por defecto | Conversiones | Selector
  ---------------+--------------------+--------------+---------
  Visitas        | Local (Bs)         | SÍ           | n/a
  Inventarios    | Local (Bs)         | SÍ           | n/a
  Pedidos        | Fuerte (USD)       | SÍ           | NO
  Devoluciones   | Local (Bs)         | SÍ           | n/a
  Cobros         | Fuerte (USD)       | SÍ           | SÍ
  Depósitos      | Local (Bs)         | SÍ           | SÍ
  Vendedores     | Local (Bs)         | SÍ           | n/a
  Productos      | Fuerte (USD)       | SÍ           | n/a
  Clientes       | Fuerte (USD)       | SÍ           | n/a
```

✅ Coincide fila por fila con la tabla del encargo.

### A.2 · Las tres variables globales del equipo — **la pieza que faltaba**

Leídas de `localStorage.globalConfiguration` del equipo **después** del re-login:

| Variable global | Valor en el EQUIPO | Módulo dice | ¿Coinciden? |
|---|---|---|---|
| `multiCurrencyOrder` (Pedidos) | **false** | NO | ✅ sí |
| `multiCurrencyCollection` (Cobros) | **true** | SÍ | ✅ sí |
| `multiCurrencyDeposit` (Depósitos) | **true** | SÍ | ✅ sí |

Contexto de apoyo (`global_configuration_audit` de la nube): `multiCurrencyOrder` pasó a **false** el
10/09 20:11:58 y `multiCurrencyCollection` volvió a **true** el 10/09 20:15:04. El override viejo de
`global_configuration_client` (2023) dice `multiCurrencyOrder = true`, pero **manda el equipo**.

Otras claves de moneda del equipo, por si sirven de contraste:
`multiCurrency=true` · `currencyModule=true` · `conversionCalculator=true` · `conversionByPriceList=false`
· `historicoTasa=true` · `currencyBank=false` · `paymentCurrency=false` · `paymentCurrencyDefault=USD`
· `showTransactionCurrency=false` · `mesesTasa=6`.

### A.3 · Tabla módulo × lo que debe verse × lo que se vio

| Módulo | Debe verse | Lo que se vio (evidencia literal de pantalla) | Veredicto |
|---|---|---|---|
| **Visitas** | Bs primero **+** USD | Selector de clientes: `Saldo Bs: 2.185.440,00` · `Saldo USD: 2.512,00`. Modelo: `selectionCoModule='vis'`, módulo 1, `localCurrencyDefault=true`, `showConversion=true` | ✅ **PASS** |
| **Inventarios** | Bs primero **+** USD | Selector de clientes: `Saldo Bs: 2.185.440,00` · `Saldo USD: 2.512,00`. Modelo: `selectionCoModule='inv'`, módulo 2 | ✅ **PASS** |
| **Devoluciones** | Bs primero **+** USD | Selector de clientes: `Saldo Bs` → `Saldo USD` ✅, módulo 4. **El formulario de devolución no muestra ningún importe** (ni el selector de productos, ni el acordeón: solo Lote / Nro Factura / Cantidad Devuelta / Unidad / Motivo) | ✅ **PASS** con nota |
| **Pedidos** | USD primero **+** Bs · selector **ausente o deshabilitado** | Selector de clientes: `Saldo USD: 2.512,00` → `Saldo Bs: 2.185.440,00` ✅ · `Moneda:` = `ion-select` **`select-disabled`**, `value=USD`, y un tap real **no abre el popover** ✅ · Tab TOTAL: `Total Base USD: 27,00` **y** `Total Base Bs: 23.490,00`, `Tasa: 870,00 Bs = 1,00 USD` ✅ · 🔴 **Lista de productos: solo `Precio: 13,50 USD`** | ⚠️ **PARCIAL** — ver H-1 |
| **Cobros** | USD primero **+** Bs · selector **visible y habilitado** | Selector de clientes: `Saldo USD` → `Saldo Bs` ✅ · `Moneda:` habilitado, abre popover `Bs / USD`, default **USD** ✅ · 🔴 **Todos los importes en UNA sola moneda:** Tab Documentos `950,00 USD / 82,00 USD / 394,00 USD`; Tab Pagos `Monto total a pagar USD: 82,00`, `Diferencia USD: -82,00`; Tab TOTAL `Monto total a Pagar USD 82,00 · Pago USD 87,00 · Diferencia USD 5,00 · Total General USD: 87,00`. **Cero conversión a Bs en toda la pantalla** | ❌ **FAIL** — ver H-2 |
| **Depósitos** | Bs primero **+** USD · selector **visible y habilitado** | `Moneda:` habilitado, **abre popover `Bs / USD`**, default **Bs** ✅ · 🔴 Tab COBROS: `428040`, `270000`, `523740` (Bs, **sin separadores, sin decimales y sin rótulo de moneda**) · Tab TOTAL: `Monto total depositado: 428040 Bs` — **un solo importe, sin conversión a USD** | ❌ **FAIL** — ver H-3 |
| **Vendedores** | Bs primero **+** USD | 🔴 `Plan por Dolar` · `Cuota Mes: 0 USD` · `Venta por Pedido: 381 USD` · `Venta Facturada: 0 USD`. **Solo USD, un único importe** | ❌ **FAIL** — ver H-4 |
| **Productos** | USD primero **+** Bs | `Precio: 13,50 USD` **y** `Precio: 11.745,00 Bs` (13,50 × 870 = 11.745 ✅) | ✅ **PASS** |
| **Clientes** | USD primero **+** Bs | `Saldo USD: 2.512,00` **y** `Saldo Bs: 2.185.440,00` | ✅ **PASS** |

> 🔑 El selector se comprobó **solo** en Pedidos, Cobros y Depósitos. En los otros seis no existe control de
> moneda en pantalla; el `SÍ`/`NO` ahí es inerte y **no se reporta como hallazgo**.

### A.4 · El conflicto módulo ↔ variable global — **qué gana en la pantalla**

**Con la configuración de hoy las tres parejas COINCIDEN**, así que el conflicto *declarado* no es
ejercitable sin tocar la web (y no se tocó). **Pero el conflicto real apareció de otra forma, medido, y
responde la pregunta abierta del REQ:**

| Módulo | Módulo (`currency_modules`) | VG | Lo que el SERVICIO de la app tiene guardado | Lo que se ve | **Quién manda** |
|---|---|---|---|---|---|
| **Depósitos** | selector **SÍ** | `multiCurrencyDeposit=true` | `depositService.currencyModule = {currencySelector:true}` ⇒ `disabledCurrency=false` | selector habilitado, abre | **el MÓDULO** (llega bien) |
| **Pedidos** | selector **NO** | `multiCurrencyOrder=false` | `orderServ.currencyModule={currencySelector:false}` ⇒ `disableCurrency=**true**` · `orderServ.multiCurrencyOrder=false` | selector presente pero **deshabilitado** | los dos dicen NO ⇒ **no separable hoy** |
| **Cobros** | selector **SÍ** | `multiCurrencyCollection=true` | 🔴 `collectService.currencySelector=**false**` · `collectService.disabledCurrency=**true**` · `collectService.showConversion=**false**` | selector **presente y FUNCIONAL** | **la VARIABLE GLOBAL** |

**La prueba de que en Cobros manda la VG**, medida en el mismo instante y en el mismo cobro abierto:

```
currencyService.currencyModulesMap.get('cob') → {idModule:5, localCurrencyDefault:false,
                                                showConversion:TRUE, currencySelector:TRUE}
collectService.currencySelector   → FALSE        ← nunca recibió el valor del módulo
collectService.disabledCurrency   → TRUE         ← debería deshabilitar el selector…
collectService.showConversion     → FALSE        ← …y ocultar la conversión
collectService.multiCurrencyCollection → TRUE
PANTALLA: el ion-select de Moneda está habilitado (propDisabled=false, attrDisabled=null,
          shadowRoot button.disabled=false) y un tap real abre el ion-popover con «Bs USD».
```

Y en el bundle la plantilla del cobro condiciona la **existencia** del bloque de moneda por la VG, no por
el módulo:

```js
ɵɵconditional(ctx.collectService.multiCurrency && ctx.collectService.multiCurrencyCollection ? 1 : -1);
ɵɵconditional(ctx_r2.collectService.multiCurrencyCollection ? 1 : -1);
```

> **Para llevar a producto:** hoy, en **Cobros**, la pantalla de *Empresa › Configuración › Módulos*
> **no gobierna nada**: el selector aparece porque `multiCurrencyCollection` está en SÍ, y las conversiones
> no aparecen aunque el módulo diga SÍ. En **Depósitos** sí manda el módulo. Es decir, **la regla no es
> uniforme entre módulos**, que es peor que cualquiera de las dos respuestas posibles.

---

## B · Los tres fixes de cobros

Configuración vigente medida en el equipo: tolerancia **+49,99 / −10** · abono mínimo **0,01** · **USD** ·
Tipo **Importe** ⇒ **umbral 50,00 exacto**. Todos los cobros nacieron en **USD** (no en Bs: `collection.coCurrency = "USD"`,
porque `localCurrencyDefault` del módulo 5 es `false`), así que el excedente se tecleó directamente en la
moneda del umbral y la trampa de la conversión no llegó a aplicar.

### B1 · El anticipo se valida DESPUÉS de la tolerancia — ✅ **PASS en los tres bordes**

| Caso | Documento | Pagado | Exceso | Modelo en vivo | Alerta | Nube | Veredicto |
|---|---|---|---|---|---|---|---|
| **5,00** | `FAC 00020783` · C.0326 · 82,00 | 87,00 | **5,00** | `delta=5` · `getPrepaidExcessAmount()=**0**` · `dentroTolerancia=true` · `shouldCreate=**false**` · `anticipoAutomatico=[]` | sin alerta de anticipo | **2686** `co_type=0`, dif 5,00. **NO hay fila `co_type=1`** | ✅ **se envió sin anticipo** |
| **49,99** | `FAC 00020954` · C.0326 · 394,00 | 443,99 | **49,99** | `delta=49.99` · excedente **0** · `dentroTolerancia=true` · `shouldCreate=false` | sin alerta | **2687** `co_type=0`, dif 49,99. Sin anticipo | ✅ **borde inclusivo, no genera** |
| **50,00** | `FAC 00020705` · C.0326 · 758,00 | 808,00 | **50,00** | `delta=50` · excedente **0,01** · `shouldCreate=**true**` · `sendAmount=0.01` · `anticipoAutomatico` 1 ítem | «Se creará un anticipo automático por el monto excedente de **USD 0,01**. Se enviará un anticipo junto al cobro.» | **2688** `co_type=0` (dif 50,00) **+ 2689 `co_type=1` por 0,01 USD** | ✅ **genera anticipo** |

**🔴 Respuesta directa a la pregunta del encargo: con exceso de 5,00 NO se generó anticipo.**
La regresión del 10/09 (anticipo de 5,00 por la lógica revertida) **no reproduce**. Acuse del servidor
*«Cobro nro. 2686 enviado exitosamente»*, sin el segundo acuse de anticipo, y una sola fila en la nube.

**Punto que hay que llevar a producto (no es FAIL, es una decisión de diseño):**
con exceso de **50,00** el anticipo se crea por **0,01**, no por 50,00 — porque el importe del anticipo es
`excesoBruto − techoDeTolerancia` (`resolveAutomatedPrepaidDocumentAmounts` usa el excedente *elegible*).
Los **49,99 restantes quedan como `nu_difference` del cobro y no se acreditan al cliente en ningún lado**.
Con una tolerancia de 49,99 eso significa que **casi todo excedente hasta ~100 USD se pierde salvo unos
céntimos**. Conviene confirmar si es lo buscado.

### B2 · Descuento mayor que el saldo ⇒ anticipo por el excedente — ✅ **PASS, y el bloqueo desapareció**

Cliente **C.0189 REPUESTOS J.H.R.** · `FAC 00021450` · saldo **44,00 USD** · descuento manual **100,00**.

Secuencia y evidencia:

1. Tab Documentos → lupa (`ion-icon[name="search-sharp"]`) → `#eventModal` «Detalle Del Documento».
2. **ASIGNAR DESCUENTO** → modal «Descuentos» (se localiza por `BORRAR TODO`) → 1.er `ion-input`
   = **«Monto descuento»** → `100,00`.
3. ACEPTAR ⇒ alerta **«El descuento supera el saldo del documento. ¿Desea crear un anticipo automático
   por USD 56,00?»** — aritmética correcta: 100,00 − 44,00 = **56,00**.
4. Tras aceptar: `Total Descuento = 100,00` · `Monto a pagar USD = 0,00` ·
   `discountRemnantPrepaidAmount = **56**` · `getAutomatedPrepaidSendAmount() = **56**` ·
   `hasConfirmedDiscountRemnantPrepaid = true` · GUARDAR del modal **se habilitó**.

**Lo que fallaba y hoy NO falla** (medido en el DOM, no deducido):

| Control | 10/09 (defecto) | **Hoy** |
|---|---|---|
| **AGREGAR MÉTODO DE PAGO** | deshabilitado | ✅ `propDisabled=false`, `shadowRoot button.disabled=false`, **funciona** (se agregó un método) |
| **Enviar** | deshabilitado | Deshabilitado **solo mientras el cobro no tiene ningún método de pago** (validación normal). Al agregar el método pasó a `propDisabled=false` ✅ |
| Estado del cobro | se quedaba en Guardado, no llegaba nada a la nube | ✅ **enviado**, dos filas en la nube |
| Contaminación de los cobros siguientes | persistía hasta reiniciar la app | ✅ **limpio sin reiniciar**: cobro nuevo inmediatamente después ⇒ `createAutomatedPrepaid=false`, `discountRemnantPrepaidAmount=0`, `hasConfirmedDiscountRemnantPrepaid=false` |

**Oráculo en la nube:**

```
2690 co_type=0  C.0189  total=0,00   nu_amount_discount_total=100,00
     collection_detail: co_document 00021450 · nu_balance_doc 44,00 · nu_amount_collect_discount 100,00
2691 co_type=1  C.0189  total=56,00  ← el anticipo por el excedente
```

Acuses del servidor: *«Cobro nro. 2690 enviado exitosamente»* + *«Anticipo nro. 2691 enviado exitosamente»*.

*Nota de método:* el método de pago que quedó cargado fue **Otros** (el clic cayó una fila más abajo de
«Efectivo»). No invalida el caso —el cobro se envió y el anticipo se creó— y de paso dejó comprobado que
con `enableDifferenceCodes=true` la app **exige el código de diferencia**: al pulsar Enviar salió
**«Seleccione un código de diferencia en el método Otros antes de enviar.»**, y con
`test_excedente - Cancelado por Abonos` seleccionado el envío pasó. Ese es justamente el mecanismo que
pedía B3.

### B3 · Notas de crédito con saldo a favor — ⛔ **BLOCKED por dato, no por la app**

**El cliente indicado, `C.0326`, ya no tiene los documentos del encargo.** Verificado en las tres capas:

| Documento | Estado en la NUBE | En el EQUIPO | En la UI (Tab Documentos) |
|---|---|---|---|
| `FAC 00018585` — 36,50 | `co_operation='D'` desde **2026-03-31** | no está | no aparece |
| `N/C 00002179` — −1.167,00 | `co_operation='D'` desde **2026-07-03** | no está | no aparece |

Lo que C.0326 sí tiene hoy son **3 facturas y ninguna nota de crédito**: `00020783` 82,00 · `00020954`
394,00 · `00020705` 758,00 = **1.234,00 USD**, que es exactamente el `Saldo USD: 1.234,00` que muestra la
lista de clientes. El Tab Documentos confirma las mismas 3 filas y ninguna «A favor»
(la leyenda *«Saldo a favor: El cliente tiene crédito disponible»* está, pero sin filas).

**Y no hay relevo en la cartera de V.0002.** Cruzando los 78 clientes que carga el equipo contra los
documentos activos de la nube: **ningún cliente de este vendedor tiene a la vez una factura y una nota de
crédito**. Los 9 que tienen N/C (`C.0027` −0,02 · `C.0149` −266,50 · `C.0392` −0,50 · `C.0510` −0,23 ·
`C.0671` −1,00 · `C.0826` −0,75 · `C.0910` −5,90 · `C.0974` −3,00 · `C.0986` −2,00) **no tienen ninguna
factura**, así que no se puede montar «factura primero, luego la N/C».

**Lo que sí se pudo medir del camino, y funciona:**

1. **La N/C se lista y es seleccionable.** Con `C.0149`, Tab Documentos muestra
   `N/C *0001519 USD -266,50 USD ... Saldo -266,50 USD`.
2. **La guarda del primer documento negativo existe y avisa bien** (no crashea, contra lo que temía el
   encargo): al marcarla como primer documento sale
   **«El primer documento a seleccionar no puede tener monto negativo»** y no deja continuar.
3. **El método «Otros» + código de diferencia está operativo** (ver B2): la app bloquea el envío hasta
   elegirlo y el catálogo trae `test_excedente — Cancelado por Abonos`.
4. **El mecanismo de «anticipo por el excedente a favor» está implementado** en el bundle vivo por una
   vía distinta de la del descuento: `creditBalancePrepaidAmount` +
   `canSendRemnantOrCreditAutomatedPrepaid()` + `getRemnantOrCreditAutomatedPrepaidAmount()`, y
   `shouldCreateAutomatedPrepaidOnSend()` lo deja pasar **sin exigir el umbral de exceso**
   (*«Remanente de descuento / NCR > FACT: no bloquear por existPartialPayment ni umbral de exceso»*).

⇒ **Para cerrar B3 hace falta preparar el dato:** una factura pequeña + una N/C mayor, **en un cliente de
la cartera de V.0002**. Con C.0321 (FAC 85,00 · N/C −145,00) o C.0616 (FAC 0,11 · N/C −1,00) saldría solo,
pero **ninguno de los dos llega al equipo**. No se tocó nada para forzarlo.

---

## Registros creados en sistema

| Ref (`id_collection`) | `co_type` | Cliente | Detalle | Estado |
|---|---|---|---|---|
| **2686** | 0 · cobro | C.0326 | `FAC 00020783` 82,00 · pagado 87,00 · dif **5,00** | Enviado · `st_delivery=1` · **BD-OK** |
| **2687** | 0 · cobro | C.0326 | `FAC 00020954` 394,00 · pagado 443,99 · dif **49,99** | Enviado · **BD-OK** |
| **2688** | 0 · cobro | C.0326 | `FAC 00020705` 758,00 · pagado 808,00 · dif **50,00** | Enviado · **BD-OK** |
| **2689** | **1 · anticipo** | C.0326 | Anticipo automático por el excedente elegible: **0,01 USD** | Enviado · **BD-OK** |
| **2690** | 0 · cobro | C.0189 | `FAC 00021450` saldo 44,00 · descuento manual **100,00** · total 0,00 | Enviado · **BD-OK** |
| **2691** | **1 · anticipo** | C.0189 | Anticipo por el excedente del descuento: **56,00 USD** | Enviado · **BD-OK** |

`pending_transactions` = **0** y los seis con `id_collection > 0` y `st_delivery = 1` en la BD local
⇒ **todo lo que se guardó se envió.** No quedó ningún registro en Guardado.
**No se modificó ninguna configuración de la web** ⇒ nada que anotar en `_escrituras-de-prueba.md`.

---

## Hallazgos

### H-1 · Pedidos: el precio del producto se muestra en una sola moneda aunque «Conversiones» esté en SÍ — ⚠️ S3

- **Config:** módulo 3 (Pedidos) `show_conversion = true`, nube y equipo.
- **Pantalla:** la fila del producto en el Tab PEDIDO muestra **`Precio: 13,50 USD`** y nada más.
- **Modelo (lo que prueba que no es falta de dato):** el ítem del carrito trae
  `nuPrice: 13.5`, **`oppositeNuPrice: 11745`**, `coCurrency: "USD"`, **`oppositeCoCurrency: "Bs"`**;
  y `orderServ.currencyModule.showConversion === true` y `comp.showConversion === true`.
- **Contraste que lo afila:** el **mismo producto** (`1R1807-4K`) en el módulo **Productos** sí muestra los
  dos precios (`13,50 USD` + `11.745,00 Bs`), con la misma configuración de conversiones.
- **Atenuante:** el Tab **TOTAL** de Pedidos sí muestra las dos monedas y la tasa. El incumplimiento es
  solo en la lista/acordeón de productos.
- **Sospecha a confirmar por desarrollo:** puede estar gobernado por `conversionByPriceList` (que en 4K
  está en **false**) y no por `show_conversion`. Si es así, no es defecto sino **dos variables que dicen
  lo mismo por vías distintas**, y hay que documentarlo en el REQ.

### H-2 · 🔴 Cobros: la configuración del módulo NO llega a `collectService` — S2

El defecto más importante de la corrida, y el que responde la pregunta abierta del REQ.

- **Config:** módulo 5 (Cobros) `show_conversion = **true**`, `currency_selector = **true**` (nube = equipo
  = lo que devuelve `currencyService.getCurrencyModule('cob')` **en vivo**).
- **Lo que tiene guardado el servicio:** `collectService.showConversion = **false**`,
  `collectService.currencySelector = **false**`, `collectService.disabledCurrency = **true**`.
- **Consecuencia visible 1 (incumplimiento):** con «Conversiones» en SÍ, **ninguna** pantalla del cobro
  muestra la conversión. Literal, con la tasa 870 disponible y `haveRate=true`:
  `Monto total a pagar USD: 82,00` · `Diferencia USD: -82,00` · `Monto total a Pagar USD 82,00` ·
  `Pago USD 87,00` · `Total General USD: 87,00`. Ni un solo importe en Bs.
- **Consecuencia visible 2 (incoherencia):** aunque el servicio dice `disabledCurrency = true`, el
  selector de Moneda está **habilitado y funciona** (abre el popover `Bs / USD`), porque la plantilla
  condiciona por `collectService.multiCurrencyCollection` (la VG, en `true`), no por el módulo.
- **Reproducción mínima:** abrir un cobro cualquiera y leer
  `ng.getComponent(document.querySelector('app-cobros')).collectService` → `showConversion` /
  `currencySelector`, y compararlos con `…collectService.currencyService.getCurrencyModule('cob')`.
  Reproducido **dos veces**, en cobros distintos y con clientes distintos.
- **Pista para desarrollo:** el bloque que los asigna vive en el `getConfig()` de `collectService`, dentro
  de `if (this.parseConfigBoolean('currencyModule')) { … }`. El mapa `currencyModulesMap` **sí** está bien
  poblado (9 entradas correctas) en el momento de la medición, así que lo que falla es **cuándo** se lee,
  no **qué** se lee: parece ejecutarse antes de que el mapa esté cargado y no volver a recalcularse.

### H-3 · Depósitos: sin conversión y con los importes sin formato — ⚠️ S3

- **Config:** módulo 6 `show_conversion = true`, `local_currency_default = true`.
- **Bien:** el selector de Moneda está **visible, habilitado, abre `Bs / USD`** y arranca en **Bs** ✅.
- **Mal:** los importes salen **solo en Bs**, sin la conversión a USD:
  Tab COBROS `428040` / `270000` / `523740`; Tab TOTAL `Monto total depositado: 428040 Bs`.
- **Agravante cosmético, aparte del REQ:** esos números salen **sin separador de miles y sin decimales**
  (`428040` en lugar de `428.040,00`), y las columnas «Monto Depósito» / «Monto Cobro» **no llevan rótulo
  de moneda**. Es el único módulo de los nueve donde el formato de número se rompe.

### H-4 · Vendedores: el módulo no consume su configuración de moneda — ⚠️ S3 (o N/A por diseño)

- **Config:** módulo 7 `local_currency_default = true` (Bs), `show_conversion = true`.
- **Pantalla:** `Plan por Dolar` · `Cuota Mes: 0 USD` · `Venta por Pedido: 381 USD` ·
  `Venta Facturada: 0 USD`. **Moneda fuerte y un único importe** — lo contrario de lo configurado en las
  dos columnas.
- **Causa medida en el bundle:** el literal **`'ven'` tiene 0 ocurrencias** en `main.js`; el módulo
  **nunca llama a `getCurrencyModule('ven')`**. Su fila de `currency_modules` es decorativa.
- **Cautela:** el rótulo «Plan por Dolar» sugiere que la moneda ahí la fija el **tipo de plan del
  vendedor**, no el módulo. **Si es así, la fila de Vendedores no debería ser editable en
  *Módulos*** — que es el hallazgo de verdad. Requiere confirmación de producto.

### H-5 · «ASIGNAR DESCUENTO» puede quedar tapado por el campo «Monto a pagar USD» — ⚠️ S4, **pedir confirmación a mano**

Detectado con `elementFromPoint` (no con `getBoundingClientRect`), en el `#eventModal` «Detalle Del
Documento» de C.0189 / `FAC 00021450`:

```
botón ASIGNAR DESCUENTO  rect x28  y640  304×27
input «Monto a pagar USD» rect x39  y622  282×56     ← encima
elementFromPoint en el CENTRO y en los 4 bordes del botón → input.native-input  (los 5 puntos)
```

Con el botón en esa posición **el tap no llega nunca**: mi primer clic real no hizo nada y hubo que
recurrir a `shadowRoot.querySelector('button').click()`. Al re-medir, el botón aparece unas veces en
`y=562` (alcanzable, `elementFromPoint` devuelve el propio `ion-button.botonAddVerde`) y otras en `y=640`
(tapado), **sin que cambie el `scrollTop` del `ion-content`** — parece un reflujo del layout, quizá al
aparecer/desaparecer el aviso *«Debe tener 5 caracteres.»* del campo Nro. Comp Ret.

⚠️ **Puede ser efecto de mi método** (llamé a `scrollToPoint` sobre el `ion-content` del modal para medir).
**Pido reproducción a mano**: abrir el detalle de un documento y tocar «ASIGNAR DESCUENTO» **sin
desplazar** el modal. Si con el dedo responde a la primera, esto se cae y no es hallazgo.

### H-6 · Confirmaciones de trampas ya conocidas (no son hallazgos nuevos, son evidencia de método)

- **El primer clic sobre el botón de una `ion-alert` se pierde.** Medido tres veces con `elementFromPoint`:
  en la alerta del anticipo automático los dos primeros clics devolvieron `ion-alert.sc-ion-alert-md-h` y
  `ion-backdrop.sc-ion-alert-md`, y solo el tercero cayó en `span.alert-button-inner`. En dos envíos, el
  `OK` del acuse quedó bajo `ion-backdrop.sc-ion-loading-md`. **Sin reintento, el envío se habría dado por
  fallido.**
- **Aceptar la alerta del anticipo consume el clic de Enviar**: tras confirmarla hay que **volver a pulsar
  Enviar**. La primera pasada dejó el cobro sin enviar y sin ningún aviso.
- **El popover de la leyenda «A favor» tapa los checkboxes del Tab Documentos** mientras está abierto
  (`elementFromPoint` sobre los 3 checkboxes → `ion-popover`). Se cierra tocando fuera. Solo se anota como
  trampa de automatización.

---

## Lo que NO se pudo comprobar

| Punto | Motivo |
|---|---|
| **B3 completo** (factura + N/C con saldo a favor ⇒ anticipo por «Otros» + código de diferencia) | **Dato inexistente.** La N/C −1.167,00 y la FAC 36,50 de C.0326 están borradas (`co_operation='D'`) desde el 03/07 y el 31/03. Ningún otro cliente de la cartera de V.0002 tiene factura y N/C a la vez. Hace falta prepararlo en la web. |
| **El conflicto declarado del REQ** (módulo NO + VG SÍ, o al revés) | Las tres parejas coinciden hoy y **no se cambió la configuración**. Lo que sí se midió es el conflicto *efectivo* de Cobros (H-2), que es más grave. |
| **Pedidos: aislar si manda el módulo o `multiCurrencyOrder`** | Los dos están en NO. Para separarlos habría que poner uno de los dos en SÍ, y eso es tocar la web. |
| **Importes propios de Inventarios** | Solo se midió el selector de clientes (módulo 2, correcto). No se llegó a cargar un inventario con producto; el formulario de inventario trabaja con cantidades, no con importes. |
| **Visitas / Devoluciones: importes propios** | En Devoluciones se recorrió el formulario completo (cliente → factura `CJA-00021066` → productos) y **no muestra ningún importe**. En Visitas no se abrió más allá del selector. |
| **El caso multi-empresa** | 4K tiene **una sola empresa** (DIESE). No cubrible con este tenant. |

---

## Patrones / selectores nuevos

| Patrón / selector | Universal o cliente | Detalle |
|---|---|---|
| **Oráculo de build del umbral de anticipo** | universal | **No** mirar el cuerpo de `getAutomatedPrepaidActivationThreshold` (sigue devolviendo `prepaidRangeAmount` a secas tanto con el fix como sin él). El discriminador es **`resolvePrepaidEligibleExcessInCollectionCurrency`** y su `normalizedRaw - positiveLimit`: si existe, la tolerancia se descuenta antes y el umbral efectivo es la suma. |
| **Lectura en vivo de la matriz de moneda** | universal | `ng.getComponent(app-cobros).collectService.currencyService.currencyModulesMap` es un `Map` con las 9 filas (`'vis'…'cli'`). Cotejarlo contra los flags del servicio de cada módulo (`collectService.showConversion`, `orderServ.disableCurrency`, `depositService.disabledCurrency`) **detecta H-2 en 10 segundos, sin recorrer pantallas**. |
| **Módulos que NO consumen su fila de `currency_modules`** | universal | `'ven'` **0 ocurrencias** en `main.js`. `'vis'` (4), `'inv'` (3) y `'dev'` (1) aparecen **solo** en `selectorCliente.setup(..., 'xxx')` ⇒ en esos tres la configuración solo afecta al **Saldo del selector de clientes**, no al formulario. Sirve para no buscar importes donde no los hay. |
| **`leer-vg-dispositivo.js` no exporta y cierra el browser** | universal (herramienta) | `require()`-arlo ejecuta su IIFE: consume `process.argv[2]`, conecta al CDP y llama a `browser.close()`. Por eso `moneda-por-modulo.js` nunca lee las VGs. **No requerirlo con un formulario abierto.** |
| **Modal «Descuentos»: localizar por `BORRAR TODO`** | universal | Confirmado (2.ª corrida). El 1.er `ion-input` del modal es **«Monto descuento»**. Dígitos sin coma, centavos acumulativos (`10000` → `100,00`). |
| **`ion-modal#eventModal` duplicado** | universal | `document.querySelector('ion-modal#eventModal')` puede devolver una instancia **vieja y `overlay-hidden`**, con 0 hijos: el modal se ve en pantalla y el script "no encuentra nada". Filtrar **siempre** con `[...document.querySelectorAll('ion-modal#eventModal')].filter(x => !x.classList.contains('overlay-hidden')).pop()`. |
| **Tab Documentos: el inventario fiable de documentos libres** | universal | `collectService.coDocumentToUpdate` (array de `nu_document`) es la lista de documentos **comprometidos** por cobros aún no aprobados. Un `SELECT` en la nube filtrando por `collection_detail` **no basta** (C.0010 salía con 11 libres y la UI decía «No hay documentos USD»; sus 11 estaban en ese array). |
| **`Moneda Documento` abre `ion-alert` de radios, no popover** | cliente/universal | En el Tab Documentos el selector de moneda del documento abre un **`ion-alert`** (`button.alert-radio` + `CANCEL`/`OK`): 2 clics. El selector de Moneda de la cabecera, en cambio, abre **`ion-popover`**: 1 clic. Confirma la regla «la variante la fija el control, no el módulo». |
| **Alertas encadenadas del envío con anticipo** | universal | Secuencia real: `El Cobro será enviado` → `Cobro nro. N enviado exitosamente` → `Anticipo nro. N+1 enviado exitosamente`. **La alerta del anticipo automático se dispara ANTES, al perder el foco del campo Monto, y se come el clic de Enviar.** |
| **Cobro de 4K nace en USD** | cliente | `collection.coCurrency = "USD"` (módulo 5 con `localCurrencyDefault=false`) ⇒ el excedente se teclea **directamente en USD** y no hay que convertir contra `MonedaTolerancia`. Deroga la nota «el cobro nace en Bs» para este tenant. |
| **Clientes con documentos libres al 14/09** | cliente | C.0326 (agotado por esta corrida) · C.0189 (queda `N/D 10000272` 3,00) · C.0058 · C.0062 · C.0194 · C.0242 · C.0267 · C.0282 · C.0340 · C.0353 · C.0367 (`00019650` 15,50) · C.0461 · C.0506 · C.0538. **C.0010 quedó agotado** (sus 11 documentos están comprometidos). |
| **Guarda del primer documento negativo** | universal | Marcar una N/C como **primer** documento del cobro devuelve **«El primer documento a seleccionar no puede tener monto negativo»**. No crashea (contra lo que advertía el encargo). |
