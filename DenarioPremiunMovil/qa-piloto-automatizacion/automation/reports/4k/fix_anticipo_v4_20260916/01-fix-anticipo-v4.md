# Verificación del fix · anticipo automático en cobro reabierto (build 5.438.699)

# ✅ SÍ, ESTÁ CORREGIDO. El cobro enviado desde un Guardado reabierto **ya genera el anticipo automático**: 5 reabiertos de 5, en las dos vías del defecto (excedente por tolerancia y nota de crédito), con su control directo al lado y cero fallos.

**Cliente** IMPORTADORA 4K (`4k`) · empresa **DIESE** · playa **CARIBE**
**Vendedor** `V.0030zgrancaracas` (`id_user` 338) · **Fecha** 2026-09-16, 08:27–08:43
**Build** `main.js` = **5.438.699** caracteres (la anterior: 5.432.976) · `versionApp` 6.6.21.3 (no discrimina)
**Baseline** `max(id_collection)` = 2806 ⇒ todo lo de esta corrida es ≥ 2807
**Oráculo** fila en la nube por marca de comentario única (`FIX23-…`), nunca por rango de id

> **La build se confirmó antes de empezar**, no se dio por supuesta: el bundle vivo mide 5.438.699
> caracteres y contiene `normalizeAutomatedPrepaidPaymentMeta` y el fallback sintético. Es la APK
> nueva. (`versionApp` dice 6.6.21.3 en todas, así que no sirve para distinguirlas.)

---

## 1 · El resultado, en una tabla

Cada pareja es **reabierto + control** con el mismo excedente, el mismo cliente y minutos de diferencia.
El reabierto va **siempre primero**.

| # | Caso | Camino | Cliente · documento | Pagado | Excedente | Cobro (`co_type=0`) | Anticipo (`co_type=1`) | Veredicto |
|---|------|--------|---------------------|--------|-----------|---------------------|------------------------|-----------|
| 1 | **A-reabierto** | Guardar → salir → reabrir → Enviar | C.0627 · FAC 00020146 (saldo 303,56) | 353,56 | 50,00 | **2807** 353,56 | **2808 · 0,01** | ✅ **PASS** |
| 2 | **A-control** | Enviar **directo** | C.0627 · N/D 10000191 (16,40) | 66,40 | 50,00 | **2809** 66,40 | **2810 · 0,01** | ✅ PASS |
| 3 | **A-repetición 2** | Guardar → salir → reabrir → Enviar | C.0627 · FAC 00020266 (500,00) | 550,00 | 50,00 | **2811** 550,00 | **2812 · 0,01** | ✅ **PASS** |
| 4 | **A-repetición 3** | Guardar → salir → reabrir → Enviar | C.0627 · N/D 10000198 (12,50) | 62,50 | 50,00 | **2813** 62,50 | **2814 · 0,01** | ✅ **PASS** |
| 5 | **B-reabierto (N/C)** | Guardar → salir → reabrir → Enviar | C.0321 · FAC 00021022 (85,00) + N/C 00002222 (−145,00) | 0,00 | 60,00 | **2815** 0,00 | **2816 · 60,00** | ✅ **PASS** |
| 6 | **B-reabierto (N/C + parcial)** | Guardar → salir → reabrir → Enviar | C.0864 · FAC 00022180 **parcial 100,00** + N/C \*0001523 (−244,00) | 0,00 | 144,00 | **2817** 0,00 | **2818 · 144,00** | ✅ **PASS** |

**5 de 5 reabiertos generan el anticipo. 1 de 1 control también.** En la build anterior eran **0 de 3**.
Contando en el histórico: **14 reproducciones en 4 builds** y hoy **ninguna**.

El anticipo esperado en los casos 1-4 es **0,01** (excedente 50,00 − tolerancia positiva 49,99);
en el 5, **60,00** (145,00 − 85,00); en el 6, **144,00** (244,00 − 100,00 de parcial). **Los seis cuadran al céntimo.**

Cotejo final en la nube, verbatim:

```
FIX23-AREAB1-082712       2807  co_type=0  353.5600  dif 50.0000  st=3
FIX23-AREAB1-082712       2808  co_type=1    0.0100  dif  0.0000  st=3   ← anticipo ✅
FIX23-ACTRL1-083009       2809  co_type=0   66.4000  dif 50.0000  st=3
FIX23-ACTRL1-083009       2810  co_type=1    0.0100  dif  0.0000  st=3   ← anticipo ✅
FIX23-AREAB2-083214       2811  co_type=0  550.0000  dif 50.0000  st=3
FIX23-AREAB2-083214       2812  co_type=1    0.0100  dif  0.0000  st=3   ← anticipo ✅
FIX23-AREAB3-083330       2813  co_type=0   62.5000  dif 50.0000  st=3
FIX23-AREAB3-083330       2814  co_type=1    0.0100  dif  0.0000  st=3   ← anticipo ✅
FIX23-B0321-REAB-083647   2815  co_type=0    0.0000  dif  0.0000  st=3
FIX23-B0321-REAB-083647   2816  co_type=1   60.0000  dif  0.0000  st=3   ← anticipo ✅
FIX23-B0864-REAB-084137   2817  co_type=0    0.0000  dif  0.0000  st=3
FIX23-B0864-REAB-084137   2818  co_type=1  144.0000  dif  0.0000  st=3   ← anticipo ✅
```

**Sin duplicados:** contando por `co_type`, cada envío dejó exactamente un cobro y un anticipo.
**No hizo falta el repoll de sincronización diferida:** los doce registros estaban en la nube en la
primera lectura, el anticipo incluido.

---

## 2 · La consola del WebView — qué cambió

Enganchada por CDP (`page.on('console')` + `page.on('pageerror')`) **antes** de pulsar Enviar, igual que
en la corrida que documentó el defecto.

### 2.1 · El camino REABIERTO, ahora (caso 5, marca `FIX23-B0321-REAB-083647`)

```
[log] COLLECTION INSERT {rows: Object, rowsAffected: 1, insertId: 50}
[log] COLLECTION DETAILS INSERT undefined
[log] COLLECTION PAYMENTS INSERT undefined
[log] [CobrosHeader] anticipo automático al Enviar {shouldCreatePrepaid: true, remnant: 0, creditBalance: 60}
[log] {errorCode: 000, errorMessage: Cobro nro. 2815 enviado exitosamente, collectionId: 2815}
[log] CREE ANTICIPO AUTOMATICO, DEBO CREAR EL PAYMENT
[log] SE CREO COLLECTION PAYMENTS AUTOMATICO POR EL ANTICIPO          ← aquí ya SÍ
[log] [CobrosHeader] anticipo encolado en pending_transactions 1789562267789.0
[log] {errorCode: 000, errorMessage: Anticipo nro. 2816 enviado exitosamente, collectionId: 2816}
```

🔑 **Las dos líneas del defecto han desaparecido de la rama reabierta.** Ya no sale
`ERROR: anticipoAutomatico vacio al crear payment de anticipo` ni
`createAnticipoCollection: fallo payment; eliminando anticipo huérfano` — **en ninguno de los cinco
reabiertos**. Donde antes se borraba el huérfano, ahora se imprime
`SE CREO COLLECTION PAYMENTS AUTOMATICO POR EL ANTICIPO` y el anticipo se encola y se envía.

Y el discriminante que separaba las dos ramas en la build anterior **ya no las separa**: la línea
`[CobrosHeader] anticipo automático al Enviar`, que **solo** aparecía en el envío directo, **ahora
también aparece en el reabierto**. Las dos ramas hacen lo mismo.

### 2.2 · El camino DIRECTO (caso 2, marca `FIX23-ACTRL1-083009`)

```
[log] [CobrosHeader] anticipo automático al Enviar {shouldCreatePrepaid: true, remnant: 0, creditBalance: 0}
[log] {errorCode: 000, errorMessage: Cobro nro. 2809 enviado exitosamente, collectionId: 2809}
[log] CREE ANTICIPO AUTOMATICO, DEBO CREAR EL PAYMENT
[log] SE CREO COLLECTION PAYMENTS AUTOMATICO POR EL ANTICIPO
[log] {errorCode: 000, errorMessage: Anticipo nro. 2810 enviado exitosamente, collectionId: 2810}
```

Idéntico al reabierto. **El control sigue sano y confirma que la configuración es la correcta.**

---

## 3 · El estado del modelo justo antes de pulsar Enviar (reabierto)

Leído con `window.ng.getComponent(...)` sobre `app-cobro.collectService`, **sin invocar**
`ensureAutomatedPrepaidPaymentTemplate()` (habría mutado justo lo que se quería medir). Caso 4,
con el Guardado ya reabierto en pantalla:

```json
{
  "anticipoAutomatico_len": 1,
  "anticipoAutomatico_dump": "[{\"monto\":62.5,\"montoConversion\":54375,\"nuRecibo\":\"\",\"fecha\":\"2026-09-16 04:00:00\",\"posCollectionPayment\":0,\"type\":\"ef\",\"anticipoPrepaid\":false,\"disabled\":false,\"showDateModal\":false}]",
  "createAutomatedPrepaid": true,
  "creditBalancePrepaidAmount": 0,
  "getPrepaidExcessAmount": "0.01",
  "normalizeMeta": "{\"type\":\"ef\",\"posCollectionPayment\":0}",
  "tieneEnsure": true
}
```

El modelo llega igual de bien preparado que en la build rota (`length = 1`, `createAutomatedPrepaid`
`true`, excedente elegible `0,01`). **La diferencia no está aquí: está en que ahora el array
sobrevive la ventana del `await` y `createAnticipoCollectionPayment` sí encuentra con qué trabajar.**

---

## 4 · Caso C — que no se haya roto lo que ya funcionaba

`createAnticipoCollection` es paso obligado de todos los anticipos. Los tres caminos vecinos siguen intactos.

### C1 · El aviso de saldo a favor al marcar la nota de crédito — ✅ PASS (dos veces, con montos distintos)

Marcando **primero la factura** y después la nota:

**C.0321** (FAC 00021022 85,00 + N/C 00002222 −145,00):
> **Denario Cobros** · «Se creará un anticipo automático por el saldo a favor de **USD 60,00**. Se enviará un anticipo junto al cobro.»
> Botones: **`["Aceptar"]`** — **uno solo**, como corresponde a un aviso.

**C.0864** (FAC 00022180 con parcial de 100,00 + N/C \*0001523 −244,00):
> **Denario Cobros** · «Se creará un anticipo automático por el saldo a favor de **USD 144,00**. Se enviará un anticipo junto al cobro.»
> Botones: **`["Aceptar"]`** — **uno solo**.

- Los dos montos son los correctos: 145,00 − 85,00 = **60,00**; 244,00 − 100,00 = **144,00**.
- El segundo caso demuestra además que **el aviso recalcula bien con un pago parcial de por medio**:
  no anuncia 244,00 (el saldo entero de la nota), sino los 144,00 que de verdad sobran.
- Sale **un único botón** en los dos: sigue siendo aviso, no confirmación.

### C2 · Descuento mayor que el saldo — ✅ PASS

Cliente C.0643, FAC 00020855 (total 955,50 · saldo 69,00), descuento «80% - Probando»:

> **Denario Cobros** · «El descuento supera el saldo del documento. ¿Desea crear un anticipo automático por **USD 695,40**?»
> Botones: **`["Cancelar", "Aceptar"]`** — **dos**, como corresponde a una confirmación.

- La cuenta cuadra: 80 % de 955,50 = 764,40; 764,40 − 69,00 = **695,40**.
- **Cancelar sigue cancelando**: tras pulsarlo la alerta desaparece (no queda ninguna viva), **no se creó
  ningún anticipo** (0 filas en la nube con la marca `FIX23-C2-083931`) y el modal de descuentos
  **queda abierto** con la selección todavía marcada pero **sin aplicar**.
- Se verificó **oclusión, no presencia**: `elementFromPoint` sobre el botón Aceptar del modal devolvió
  `ION-BUTTON` (no el backdrop), y sobre Cancelar de la alerta devolvió `SPAN`. Los clics llegaron de verdad.
- El cobro se abandonó sin enviar ⇒ **no consumió el documento**.

### C3 · El anticipo por excedente en envío directo — ✅ PASS

Lo cubre **A-control** (caso 2): cobro 2809 + anticipo 2810 de 0,01. Sigue generándose.

---

## 5 · Descarte de las explicaciones alternativas

Para que un PASS signifique algo, había que descartar que el anticipo apareciera por otra vía:

- **No es que ya no se ejercite el camino.** Los cinco reabiertos pasaron de verdad por
  Guardar → alerta «El Cobro se ha guardado» → salir del formulario → lista de cobros → **reabrir por
  su marca de comentario** (`reabrirGuardado(MARCA)`, nunca «el primero de la lista») → Enviar.
- **No es sincronización diferida a la inversa.** El anticipo estaba en la nube en la primera lectura
  en los seis casos; no hizo falta el repoll de 100 s que el guion trae preparado para el FAIL.
- **No es que el excedente no llegara a existir.** En los cuatro casos de tolerancia la pantalla mostró
  «Diferencia 50,00» en azul antes de guardar, y `nu_difference` en la nube es 50,0000 en los cuatro cobros.
- **No es dato viejo.** Los doce registros son de esta corrida, cotejados **por marca de comentario**
  (`FIX23-…`), nunca por rango de `id_collection` — hay otra QA trabajando en el mismo tenant.

---

## 6 · Cómo se condujo

- **MCP de Playwright caído** en esta sesión ⇒ se condujo por Node contra el Playwright de
  `automation/playwright/node_modules`, vía CDP en `http://127.0.0.1:9220`.
- Los helpers de UI se **extrajeron verbatim** de `automation/playwright/modules/cobros.js`
  (rangos 385-1295, 1606-1908, 2898-3005 y 3032-3170) a `_helpers.js`, para no re-descubrir selectores
  ya probados. Encima van solo el enganche de consola, la sonda del modelo, el marcado de documento
  **por número** y los casos.
- Marca de comentario única por caso ⇒ el cotejo **nunca** depende del rango de id.
- **Nunca se navegó por URL**: al módulo Cobros se entra por clic en el tile del home.

### Dos tropiezos del guion que conviene anotar (no son defectos del producto)

1. **`salirGuardando()` no levantó la guarda de salida** en el primer intento: el back del header
   (`img.fechaAtras`, en x≈10 y≈10) no siempre la dispara. Se cambió al botón **GUARDAR** del header
   (`ion-button.imagenGuardar`), que además es el paso literal del encargo («Guarda → sal → reabre»).
   ⚠ Al diagnosticarlo se confirmó la trampa conocida: **el DOM tenía la alerta «Guardar y salir /
   Salir sin guardar / Cancelar» presente pero con `display:none`** — de corridas anteriores. Contar
   `ion-alert` no mide nada; hay que filtrar por visibilidad.
2. **`clickGuardarEnviar()` reportó «el botón no produjo ninguna reacción» en un envío que SÍ salió**
   (caso 2): `huellaPantalla()` no mira las `ion-alert`, así que no vio el diálogo de confirmación que
   ya estaba en pantalla. Se endureció el guion para que, antes de declarar BLOCKED, compruebe si hay
   un diálogo vivo. **El envío era correcto**; el cobro 2809 se completó y dio PASS.

---

## 7 · Registros creados (anotados también en `automation/clientes/_escrituras-de-prueba.md`)

| id_collection | co_type | Cliente | Monto | Marca |
|---|---|---|---|---|
| 2807 | 0 cobro | C.0627 | 353,56 USD | `FIX23-AREAB1-082712` |
| 2808 | **1 anticipo** | C.0627 | 0,01 USD | `FIX23-AREAB1-082712` |
| 2809 | 0 cobro | C.0627 | 66,40 USD | `FIX23-ACTRL1-083009` |
| 2810 | **1 anticipo** | C.0627 | 0,01 USD | `FIX23-ACTRL1-083009` |
| 2811 | 0 cobro | C.0627 | 550,00 USD | `FIX23-AREAB2-083214` |
| 2812 | **1 anticipo** | C.0627 | 0,01 USD | `FIX23-AREAB2-083214` |
| 2813 | 0 cobro | C.0627 | 62,50 USD | `FIX23-AREAB3-083330` |
| 2814 | **1 anticipo** | C.0627 | 0,01 USD | `FIX23-AREAB3-083330` |
| 2815 | 0 cobro | C.0321 | 0,00 USD | `FIX23-B0321-REAB-083647` |
| 2816 | **1 anticipo** | C.0321 | 60,00 USD | `FIX23-B0321-REAB-083647` |
| 2817 | 0 cobro | C.0864 | 0,00 USD | `FIX23-B0864-REAB-084137` |
| 2818 | **1 anticipo** | C.0864 | 144,00 USD | `FIX23-B0864-REAB-084137` |

Documentos consumidos (quedan «Por aprobar» hasta que se aprueben o rechacen en la web):
C.0627 → `00020146` · `10000191` · `00020266` · `10000198` (le quedan ~68 documentos libres)
C.0321 → `00021022` + `N/C 00002222` (**agotado otra vez**)
C.0864 → `00022180` + `N/C *0001523` (**agotado**)

**C.0643 / `00020855` NO se consumió**: el caso C2 se abandonó sin enviar.

**El equipo quedó limpio: 0 cobros en estado Guardado al cerrar.**

No se aprobó ni rechazó ningún cobro. No se tocó configuración de la web ni ninguna variable global.
No se ejecutó SQL de escritura.

---

## 8 · Lo que esto significa para la versión

**Desde esta medición, nada desaconseja sacarla.** El defecto que bloqueaba el tag —el excedente que
se le cobraba al cliente y desaparecía en silencio— **ya no se reproduce**, y no por un camino de
suerte: se probó **cinco veces**, en las **dos vías** que lo disparaban (excedente por tolerancia y
saldo a favor por nota de crédito, esta última con y sin pago parcial), y las líneas de error
características han desaparecido de la consola. El dinero queda a favor del cliente, con su fila
`co_type = 1` en la nube.

Los tres caminos vecinos que el fix podía haber roto siguen intactos: el aviso de saldo a favor con su
único botón y su monto bien calculado (incluso con parcial), la confirmación de dos botones del
descuento que supera el saldo con su **Cancelar** funcionando, y el anticipo por envío directo.

### Lo único que queda anotado al margen

El `TypeError: Cannot read properties of undefined (reading 'toString')` en `main.js` que la corrida
anterior vio en **las dos ramas**, también en los envíos correctos, **no volvió a aparecer** en los
envíos de hoy. No se investigó más allá de eso porque no era el objeto de esta verificación.

### Alcance de lo que aquí se afirma

Esto cubre **el anticipo automático en Cobros**, en **4K / DIESE / CARIBE**, con el vendedor
`V.0030zgrancaracas` y la configuración de este tenant (tolerancia positiva 49,99 · abono mínimo 0,01
⇒ umbral 50,00 exacto). **No se midió ningún otro módulo**, ni retención (`co_type = 2`), ni
multi-empresa (4K es de empresa única). Solo se reporta lo verificado en esta corrida.
