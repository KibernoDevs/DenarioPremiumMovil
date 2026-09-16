# Cierre de la tarjeta · anticipo automático en cobro reabierto (build 5.446.151)

# ✅ SÍ, SE CIERRA. En la APK nueva el cobro enviado desde un Guardado reabierto **vuelve a generar su anticipo automático**: **3 de 3 reabiertos**, más el control directo, sin un solo fallo y sin las dos líneas de error del defecto.

**Cliente** IMPORTADORA 4K (`4k`) · empresa **DIESE** · playa **CARIBE**
**Vendedor** `V.0030zgrancaracas` (`id_user` 338) · **Fecha** 2026-09-16, 10:00–10:26
**Build** `main.js` = **5.446.151** caracteres — confirmada antes de empezar, no supuesta.
`versionApp` dice 6.6.21.3 en todas las builds, así que **no discrimina**; el tamaño del bundle sí.
**Baseline** `max(id_collection)` = **2821** al arrancar (el encargo decía 2818: la otra QA creó 2819-2821).
**Oráculo** fila en la nube cotejada **por marca de comentario** `CIE24-…`, nunca por rango de id.

---

## 1 · El resultado, en una tabla

| # | Caso | Camino | Cliente · documento | Pagado | Excedente | Cobro (`co_type=0`) | Anticipo (`co_type=1`) | Veredicto |
|---|------|--------|---------------------|--------|-----------|---------------------|------------------------|-----------|
| A1 | **Reabierto 1** | Guardar → salir → reabrir → Enviar | C.0627 · FAC 00020287 (250,00) | 300,00 | 50,00 | **2822** 300,00 | **2823 · 0,01** | ✅ **PASS** |
| A2 | **Reabierto 2** | Guardar → salir → reabrir → Enviar | C.0627 · N/D 10000201 (6,25) | 56,25 | 50,00 | **2824** 56,25 | **2825 · 0,01** | ✅ **PASS** |
| A3 | **Reabierto 3** | Guardar → salir → reabrir → Enviar | C.0627 · FAC 00020331 (327,00) | 377,00 | 50,00 | **2826** 377,00 | **2827 · 0,01** | ✅ **PASS** |
| B | **Control directo** | Enviar **directo**, sin guardar | C.0627 · N/D 10000205 (8,18) | 58,18 | 50,00 | **2828** 58,18 | **2829 · 0,01** | ✅ **PASS** |
| C | N/C reabierto | — | — | — | — | — | — | ⚪ **N/A · sin materia prima** |
| E1 | Aviso de saldo a favor (N/C) | — | — | — | — | — | — | ⚪ **N/A · sin materia prima** |
| E2 | Descuento > saldo · **Cancelar** | C.0643 · FAC 00020855 (saldo 69,00) | — | — | ninguna fila creada | ninguna | ✅ **PASS** |

**3 de 3 reabiertos generaron su anticipo. 1 de 1 control directo también.**
El anticipo esperado es **0,01** en los cuatro (excedente 50,00 − tolerancia positiva 49,99). **Los cuatro cuadran al céntimo.**

Cotejo final en la nube, verbatim:

```
CIE24-AREAB1-100033  2822  co_type=0  300.0000  dif 50.0000  st=3  C.0627
CIE24-AREAB1-100033  2823  co_type=1    0.0100  dif  0.0000  st=3  C.0627   ← anticipo ✅
CIE24-AREAB2-100215  2824  co_type=0   56.2500  dif 50.0000  st=3  C.0627
CIE24-AREAB2-100215  2825  co_type=1    0.0100  dif  0.0000  st=3  C.0627   ← anticipo ✅
CIE24-AREAB3-100344  2826  co_type=0  377.0000  dif 50.0000  st=3  C.0627
CIE24-AREAB3-100344  2827  co_type=1    0.0100  dif  0.0000  st=3  C.0627   ← anticipo ✅
CIE24-BCTRL-100518   2828  co_type=0   58.1800  dif 50.0000  st=3  C.0627
CIE24-BCTRL-100518   2829  co_type=1    0.0100  dif  0.0000  st=3  C.0627   ← anticipo ✅
```

**Sin duplicados:** cada marca dejó exactamente un cobro y un anticipo.
**No hizo falta el repoll:** las ocho filas estaban en la nube en la primera lectura, el anticipo incluido.
No quedó ningún anticipo «Por enviar» en la cola del equipo (0 Guardados al cerrar).

---

## 2 · 🔑 La alerta nueva — qué es, cuándo sale y cuántos botones tiene

**Sí, hay una alerta nueva, y no sale donde se esperaba.** No aparece al pulsar Enviar: aparece
**en la pestaña Pagos**, en cuanto se completa el método de pago que produce el excedente.

> **Denario Cobros**
> «**Se creará un anticipo automático por el monto excedente de USD 0,01. Se enviará un anticipo junto al cobro.**»
> Botones: **`["Aceptar"]` — uno solo.** Es un aviso, no una confirmación: no se puede cancelar nada desde ahí.

- Salió **en los cuatro casos**, reabiertos y directo, con **texto idéntico** y **un único botón**.
- El monto que anuncia es el del anticipo (**0,01**), no el excedente bruto (50,00): ya trae descontado
  el techo de tolerancia positiva. Coincide con lo que después se crea en la nube.
- Sale **una sola vez por cobro**: al reabrir el Guardado **no vuelve a salir**.

### 2.1 · Lo que la sustituye en el reabierto: un **banner persistente**

En el cobro reabierto no hay alerta, pero **sí queda el mismo mensaje fijo en pantalla**, bajo las
pestañas, con el título **«Anticipo automático»**:

> «Se creará un anticipo automático por el monto excedente de USD 0,01. Se enviará un anticipo junto al cobro.»

Se capturó **verbatim en los tres reabiertos**, en los tres momentos medidos (recién reabierto, asentado
y justo antes de pulsar Enviar). Es la pieza que da continuidad al aviso: **el vendedor que reabre un
Guardado sigue viendo que ese cobro va a generar un anticipo.** Además, en el acordeón del método de
pago aparece la leyenda **«Este pago creó el anticipo automático»**.

### 2.2 · En el Enviar no hay alerta nueva

Al pulsar Enviar solo salen las dos de siempre, sin cambios:

| Momento | Título | Texto | Botones |
|---|---|---|---|
| Al pulsar Enviar | Denario Cobros | «El Cobro será enviado» | **2** — `["Cancelar","Aceptar"]` |
| Tras el envío | Denario Premium | «Cobro nro. **2822** enviado exitosamente» | **1** — `["OK"]` |
| Al pulsar Guardar | Denario Cobros | «El Cobro se ha guardado» | **1** — `["Aceptar"]` |

**Se distinguió *ausente* de *presente pero oculta*:** en cada momento se volcaron **todas** las
`ion-alert` del DOM (16-18 por pantalla) con su `display` real y el ancho de sus botones. Las 15-17
restantes son descartadas de pasos anteriores que siguen en el DOM con `display:none`. Contar
`ion-alert` no mide nada; lo medido es la visibilidad.

---

## 3 · La consola del WebView — las dos líneas del defecto ya no están

Enganchada por CDP (`page.on('console')` + `page.on('pageerror')`) **antes** de pulsar Enviar.

Rama **REABIERTA** (caso A1, marca `CIE24-AREAB1-100033`):

```
[log] COLLECTION INSERT {rows: Object, rowsAffected: 1, insertId: 52}
[log] COLLECTION DETAILS INSERT undefined
[log] COLLECTION PAYMENTS INSERT undefined
[log] [CobrosHeader] anticipo automático al Enviar {shouldCreatePrepaid: true, remnant: 0, creditBalance: 0}
[log] {errorCode: 000, errorMessage: Cobro nro. 2822 enviado exitosamente, collectionId: 2822}
[log] CREE ANTICIPO AUTOMATICO, DEBO CREAR EL PAYMENT
[log] SE CREO COLLECTION PAYMENTS AUTOMATICO POR EL ANTICIPO
[log] [CobrosHeader] anticipo encolado en pending_transactions 1789567302086.0
[log] {errorCode: 000, errorMessage: Anticipo nro. 2823 enviado exitosamente, collectionId: 2823}
```

- **No aparece** `ERROR: anticipoAutomatico vacio al crear payment de anticipo`.
- **No aparece** `createAnticipoCollection: fallo payment; eliminando anticipo huérfano`.
- Sí aparece `SE CREO COLLECTION PAYMENTS AUTOMATICO POR EL ANTICIPO` — **en los tres reabiertos**.
- Y la línea `[CobrosHeader] anticipo automático al Enviar`, que en las builds rotas **solo** salía en el
  envío directo, **también sale en el reabierto**. Las dos ramas hacen lo mismo.

El control directo (2828/2829) imprime exactamente la misma secuencia.

**Estado del modelo justo antes de Enviar en el reabierto** (leído con `window.ng.getComponent`, **sin**
invocar `ensureAutomatedPrepaidPaymentTemplate()`, que habría mutado lo medido):

```json
{ "anticipoAutomatico_len": 1, "createAutomatedPrepaid": true,
  "creditBalancePrepaidAmount": 0, "getPrepaidExcessAmount": "0.01", "tieneEnsure": true }
```

---

## 4 · Que no se haya roto lo ya cerrado

### E2 · Descuento mayor que el saldo — ✅ PASS

Cliente **C.0643**, FAC **00020855** (total 955,50 · saldo 69,00), descuento «80% - Probando»:

> **Denario Cobros** · «El descuento supera el saldo del documento. ¿Desea crear un anticipo automático por **USD 695,40**?»
> Botones: **`["Cancelar","Aceptar"]` — dos**, como corresponde a una confirmación.

- La cuenta cuadra: 80 % de 955,50 = 764,40; 764,40 − 69,00 = **695,40**.
- **Cancelar sigue cancelando:** la alerta se cerró, **no se creó ningún anticipo** (0 filas en la nube con
  la marca `CIE24-C2-102302`), el modal de descuentos **quedó abierto** con la selección marcada pero
  **sin aplicar**, y el cobro se abandonó sin enviar ⇒ **no consumió el documento**.
- Se verificó **oclusión, no presencia**: `elementFromPoint` sobre Aceptar del modal devolvió `ION-BUTTON`
  y sobre Cancelar de la alerta devolvió `SPAN`. Ningún clic cayó en el `ION-BACKDROP`.

### E1 · El aviso de saldo a favor al marcar la nota de crédito — ⚪ **NO SE PUDO EJERCITAR HOY**

Requiere una pareja factura + nota de crédito libre, y **hoy no hay ninguna en la cartera de `V.0030`**
(detalle en §5). **No se reporta ni PASS ni FAIL:** no se midió. Lo único que se puede decir sin
ejercitarlo es que el constructor del mensaje sigue en el bundle como aviso de un solo botón
(`buildCreditBalancePrepaidInformMessage`, comentado «solo Aceptar») — **eso es lectura de código, no
una comprobación en pantalla**, y no sustituye al caso.

---

## 5 · Caso C (N/C reabierto) — N/A por falta de materia prima

**No hay ninguna pareja factura + nota de crédito libre en la cartera del vendedor `V.0030`.**
Se recorrió el **Tab Documentos** —que es el único inventario fiable— de siete clientes, elegidos
cruzando «lo que el equipo carga» con «notas de crédito con saldo y sin cobro» en la BD:

| Cliente | Lo que LISTA la pantalla |
|---|---|
| C.0398 | 30 filas · FAC y N/D · **ninguna N/C** (sus 5 N/C de BD no llegan) |
| C.0395 | 4 filas · todas FAC · ninguna N/C |
| C.0419 | 3 filas · FAC y N/D · ninguna N/C |
| C.0864 | 1 fila · FAC 00022180 · ninguna N/C |
| C.0816 | 1 fila · FAC 00021416 · ninguna N/C |
| C.1073 | 1 fila · FAC 00022209 · ninguna N/C |
| C.0321 | **0 filas** · «No hay documentos» |
| C.0626 | **0 filas** · «No hay documentos» |

La cartera de `V.0030` son **46 clientes** (listados en `cartera_V0030.txt`, leídos del propio modal del
equipo). Ojo: la lista `clientes_con_documentos` del YAML de 4K es de **V.0002**, otro vendedor —
C.0149, C.0052 y compañía **no existen para este usuario** (el modal devuelve 0 ítems).

**La BD miente para esto, una vez más:** da 38 N/C «libres» en esta cartera y la pantalla no lista
ninguna. Las que usó la corrida de las 08:41 (C.0321 · 00002222 y C.0864 · `*0001523`) se consumieron
en aquella pasada y `co_collection` sigue en NULL.

⇒ **Se dice y no se bloquea.** El camino de la nota de crédito quedó cubierto hace tres horas en la
build anterior (2815/2816 y 2817/2818), pero **eso es la build 5.438.699, no ésta**, y aquí solo se
reporta lo verificado en esta corrida.

---

## 6 · Descarte de las explicaciones alternativas

- **No es que el camino no se ejercite.** Los tres reabiertos pasaron de verdad por Guardar → alerta
  «El Cobro se ha guardado» → salir del formulario → lista de cobros → **reabrir por su marca de
  comentario** (`reabrirGuardado(MARCA)`, nunca «el primero de la lista») → Enviar.
- **No es sincronización diferida a la inversa.** El anticipo estaba en la nube en la primera lectura en
  los cuatro casos; el repoll de ~100 s que el guion trae preparado no llegó a dispararse.
- **No es que el excedente no existiera.** La pantalla mostró «Diferencia **50,00**» en azul antes de
  guardar en los cuatro, y `nu_difference` en la nube es 50,0000 en los cuatro cobros.
- **No es dato viejo ni de la otra QA.** Las ocho filas se cotejaron **por marca de comentario**
  `CIE24-…`, generada con la hora del arranque de cada caso.
- **No es la build anterior.** El bundle vivo mide **5.446.151** caracteres, medido al empezar.

---

## 7 · Cómo se condujo

- **MCP de Playwright caído** ⇒ se condujo por Node contra el Playwright de
  `automation/playwright/node_modules`, vía CDP en `http://127.0.0.1:9220`.
- Helpers reutilizados **verbatim** de la corrida `fix_anticipo_v4_20260916` (`_helpers.js`), que a su vez
  los extrajo de `automation/playwright/modules/cobros.js`. Encima va lo nuevo de esta corrida:
  `_alertas.js` (volcado de **todas** las `ion-alert` con visibilidad real + banner + sonda del servicio)
  y `caso2.js`, que captura en **diez momentos** de cada caso.
- **Nunca se navegó por URL**: al módulo Cobros se entra por clic en el tile del home.
- Guiones de esta corrida, en el RUN_DIR: `caso2.js` · `_alertas.js` · `casoB.js` · `casoC2.js` ·
  `cartera.js` · `filtrodocs.js` · `cola.js` · `borrar-guardado.js` · `_preflight-build.js`.

### Anotación de guion (no es defecto del producto)

El intento de montar el caso C con **C.0398** dejó un cobro en estado **Guardado**: la nota de crédito no
estaba en la lista, el método «Otros» quedó con monto 0 y el Enviar respondió «Hay un método de pago
incompleto». **El cobro nunca salió** (0 filas en la nube con su marca) y **se eliminó del equipo** al
cerrar. La cola quedó en **0 Guardados**.

---

## 8 · Registros creados (anotados también en `automation/clientes/_escrituras-de-prueba.md`)

| id_collection | co_type | Cliente | Monto | Marca |
|---|---|---|---|---|
| 2822 | 0 cobro | C.0627 | 300,00 USD | `CIE24-AREAB1-100033` |
| 2823 | **1 anticipo** | C.0627 | 0,01 USD | `CIE24-AREAB1-100033` |
| 2824 | 0 cobro | C.0627 | 56,25 USD | `CIE24-AREAB2-100215` |
| 2825 | **1 anticipo** | C.0627 | 0,01 USD | `CIE24-AREAB2-100215` |
| 2826 | 0 cobro | C.0627 | 377,00 USD | `CIE24-AREAB3-100344` |
| 2827 | **1 anticipo** | C.0627 | 0,01 USD | `CIE24-AREAB3-100344` |
| 2828 | 0 cobro | C.0627 | 58,18 USD | `CIE24-BCTRL-100518` |
| 2829 | **1 anticipo** | C.0627 | 0,01 USD | `CIE24-BCTRL-100518` |

Documentos consumidos (quedan «Por aprobar» hasta que se aprueben o rechacen en la web):
**C.0627** → `00020287` · `10000201` · `00020331` · `10000205`.
**C.0643 / `00020855` NO se consumió**: el caso E2 se abandonó sin enviar.

No se aprobó ni rechazó ningún cobro. **No se tocó configuración de la web ni ninguna variable global.**
No se ejecutó SQL de escritura. El equipo quedó con **0 cobros en estado Guardado**.

---

## 9 · Lo que esto significa para la versión

**Nada de lo medido hoy desaconseja sacarla.** El defecto que bloqueaba la tarjeta —el excedente que se
le cobraba al cliente y desaparecía en silencio— **no se reproduce en la build 5.446.151**: tres
reabiertos consecutivos, su control directo al lado, las líneas de error ausentes de la consola y el
dinero con su fila `co_type = 1` en la nube. Sumado a la verificación de las 08:41 sobre la build
anterior, son **ocho reabiertos correctos en dos builds** frente a las 14 reproducciones del defecto.

La mejora que traía esta APK **existe y es visible**: un aviso de un solo botón en Pagos cuando nace el
excedente, y un banner persistente que lo recuerda en el cobro reabierto. Antes, el vendedor que reabría
un Guardado no tenía forma de saber que ese cobro iba a generar un anticipo.

El camino vecino que el fix podía haber roto y **sí se pudo medir** —la confirmación de dos botones del
descuento que supera el saldo, con su **Cancelar** funcionando— sigue intacto.

### Lo único que queda abierto

**El aviso de saldo a favor por nota de crédito (E1) y el caso C no se ejercitaron en esta build**, por
falta de materia prima en la cartera del vendedor, no por un fallo. Si se quiere cerrarlos también sobre
5.446.151 antes de publicar, basta con **aprobar o rechazar en la web los cobros que retienen las notas de
crédito de C.0321 y C.0864** y repetir `casoB.js` — son diez minutos. Sin eso, el riesgo residual es el de
un camino que quedó correcto hace tres horas en la build inmediatamente anterior.

### Alcance de lo que aquí se afirma

Esto cubre **el anticipo automático en Cobros**, en **4K / DIESE / CARIBE**, con el vendedor
`V.0030zgrancaracas` y la configuración de este tenant (tolerancia positiva 49,99 · abono mínimo 0,01 ⇒
umbral 50,00 exacto). **No se midió ningún otro módulo**, ni retención (`co_type = 2`), ni multi-empresa
(4K es de empresa única). **Solo se reporta lo verificado en esta corrida.**
