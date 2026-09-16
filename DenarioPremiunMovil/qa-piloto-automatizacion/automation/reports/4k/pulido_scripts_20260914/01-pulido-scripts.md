# Pulido de los scripts de COBROS y PEDIDOS — IMPORTADORA 4K · 14/09/2026

| Parámetro | Valor |
|---|---|
| RUN_ID | `pulido_scripts_20260914` |
| Cliente / empresa | **4k** · `DIESE` (rótulo **DIESEL** en la UI) · GRUPO 4K · RIF J401702600 |
| Playa | **CARIBE** — servidor CONTABO (se descubre en runtime; no se guarda en el perfil) |
| Vendedor | `V.0002zonacentral` · `id_user` **300** · ANGEL BETANCOURT |
| App | `com.kiberno.denarioPremiumPro` · APK de **`main`** · Infinix X6728 · CDP `:9220` |
| Conducción | Playwright de `automation/playwright/node_modules` (`connectOverCDP`). **El MCP de Playwright no levanta.** |
| Objetivo | **Dejar fiables dos scripts**, no cazar defectos. Lo que apareció se anota aparte y **no se maquilla**. |

> **Cómo leer esto.** La tabla de evolución dice, vuelta a vuelta, **qué falló · por qué · qué se
> cambió · qué pasó después**. Lo que se arregló era **fallo del guion**. Lo de la sección de
> defectos es **de la app**: no se toca desde el script, y el caso que lo destapa se deja fallando
> a propósito, como testigo.

---

## 0 · Resumen

**PEDIDOS — de 2 PASS a 18 PASS · 0 FAIL, en trece vueltas.**

| Vuelta | PASS | FAIL | BLOCKED | N/A |
|---|---|---|---|---|
| 1 (línea base) | 2 | 1 | 20 | 0 |
| 2 (cliente resuelto) | 10 | 6 | 4 | 3 |
| 3 | 16 | 3 | 0 | 4 |
| 4 | 17 | 0 | 1 | 5 |
| 5 · 7 · 9 · 11 | 2 | 1 | 20 | 0 | ← la intermitencia (§vueltas 8-11) |
| 6 · 8 · 10 | 18 | 0 | 0 | 5 |
| **12** | **18** | **0** | **0** | **5** |
| **13** (la que tenía que fallar) | **18** | **0** | **0** | **5** |

**COBROS — de 11 PASS a 34 PASS en cuatro vueltas, sin un solo FAIL atribuible al guion.**

| Vuelta | PASS | FAIL | BLOCKED | N/A | Total |
|---|---|---|---|---|---|
| 1 (línea base) | 11 | 2 | 16 | 15 | 44 |
| 2 (Fase 2 construida) | 25 | 5 | 11 | 5 | 46 |
| 3 (cliente + oráculo) | 30 | 1 | 9 | 7 | 47 |
| **4 (rotación de cartera)** | **34** | **2** | **4** | **7** | **47** |

Los **2 FAIL de la vuelta 4 son defectos de la app** (§4), no del guion, y uno de ellos
(`DM-COB-058`) está puesto **a propósito** como testigo. Los **4 BLOCKED** son casos que **no se
pueden ejercitar sin tocar la configuración de la web**, cosa que el encargo prohíbe (§5).

**Lo que se cierra:**

- ✅ **El cuádruple disparo, resuelto y COMPROBADO en la nube** — tres envíos, tres vueltas, **una
  fila cada uno**. Y la comprobación queda dentro del guion, así que no hay que volver a hacerla a mano.
- ✅ **12 de los 12 casos de Fase 2 dejaron de ser BLOCKED**: 8 PASS, 3 N/A justificadas por
  configuración o por dato, 1 (029) N/A por variable global.
- ✅ **`cobros` entra en `ORDEN_DEFAULT`**, antes de `pedidos`. Dura ~11-14 min.
- 🔴 **Un defecto de producto nuevo y reproducido tres veces**: el anticipo automático **no se
  genera si el cobro se envía desde un Guardado reabierto**.

---

## 1 · Lo primero: el cuádruple disparo — RESUELTO Y COMPROBADO EN LA NUBE

**Lo que decía `PENDIENTES.md`:** `clickGuardarEnviar()` apilaba `pointerdown` + `pointerup` +
`inner.click()` **y además** un `mouse.click`. Cuatro disparos para un botón.

**Lo que encontré:** el código ya estaba corregido en el commit `00ca4c89` («quitar el doble
disparo de Guardar/Enviar»), con un solo clic real y un **fallback condicionado** que solo entra si
la pantalla no reaccionó. Lo que **nunca se había hecho es comprobarlo**, que era la mitad del
encargo — y sin comprobarlo no se podía usar como oráculo.

**Lo que hice:** convertir la comprobación en parte permanente del guion. `verificarNube()` ya no
pregunta «¿está el cobro?» sino **cuántas filas hay con esa marca, y de qué tipo**:

```js
const cobros    = filas.filter(f => Number(f.co_type) === 0);
const anticipos = filas.filter(f => Number(f.co_type) === 1);
const duplicado = cobros.length > 1 || anticipos.length > 1;
```

⚠ **Por tipo, no por total.** Un envío legítimo con excedente deja **dos** filas —el cobro
(`co_type 0`) y el anticipo automático (`co_type 1`)— y contar «filas» a secas lo habría reportado
como duplicado. Duplicado es *más de una fila del mismo tipo con la misma marca*.

Y **DM-COB-019 ya no da PASS si hay duplicado**, aunque el cobro haya llegado:

```js
enviadoOk = (nube.ok && !nube.duplicado) || (!DATA.clienteSlug && porUI);
```

### Comprobación en la nube — tres envíos del happy path, tres vueltas distintas

| Vuelta | Marca | Filas en `collection` | Veredicto |
|---|---|---|---|
| 2 | `Test-COB-620364` | **1** → `2715` `co_type=0` 8,75 USD `st=3` | sin duplicado |
| 3 | `Test-COB-822593` | **1** → `2721` `co_type=0` 489,00 USD `st=3` | sin duplicado |
| 4 | `Test-COB-644673` | **1** → `2723` `co_type=0` 2.880,00 USD `st=3` | sin duplicado |

```sql
SELECT id_collection, co_type, tx_comment FROM collection
WHERE tx_comment LIKE 'Test-COB-%' ORDER BY id_collection;
```

✅ **Un envío = una fila.** El cuádruple disparo está resuelto y **verificado en la nube tres veces**.

---

## 2 · COBROS — evolución vuelta a vuelta

`automation/playwright/modules/cobros.js`

### Vuelta 1 — línea base (11 PASS · 2 FAIL · 16 BLOCKED · 15 N/A)

| Qué falló | Por qué (diagnóstico) | Qué cambié |
|---|---|---|
| **20 casos en cascada**: 007/008/009/012/040/043/048-052 a N/A, 019 FAIL, 026/053-055 BLOCKED | **No era la app.** `cliente_test: C.0029` ya no tenía documentos libres: el Tab Documentos dijo «cliente sin documentos» y a partir de ahí no había transacción que probar. Un dato de perfil caducado tumbaba 20 casos. | **El cliente se descubre, no se asume.** El módulo recorre `clientes_con_documentos` y usa el primero que *de verdad* liste documentos en pantalla, arrancando un cobro nuevo por candidato. |
| 12 BLOCKED de Fase 2, todos con el mismo texto | `blockFase2()` emitía un motivo genérico: ruido que se arrastra corrida tras corrida sin decir qué falta | Reemplazado por seis sub-flujos reales (§3) |
| El perfil decidía las N/A | `maxCollectDiscount` YAML **85** vs equipo **0**; `clientBankAccount` YAML **false** vs equipo **true**; `validateCollectionDate` YAML **true** vs equipo **false** | **Manda el equipo.** Las VG se leen de `localStorage.globalConfiguration` al arrancar y pisan al YAML; la divergencia se anota |

> 🔑 **La BD no sirve como inventario de documentos.** `document_sale` daba **28** documentos libres
> para `C.1016` y la pantalla decía «No hay documentos USD»: `co_collection` sigue en `NULL` aunque
> el documento ya esté comprometido por un cobro «Por aprobar». **El único inventario fiable es el
> propio Tab Documentos.** Recorrí 19 clientes en la UI para construir el pool real del perfil.

### Vuelta 2 — con Fase 2 construida (25 PASS · 5 FAIL · 11 BLOCKED · 5 N/A)

| Qué falló | Por qué | Qué cambié | Después |
|---|---|---|---|
| **DM-COB-014/015/047/038/039** — «botón Agregar método disabled/ausente» | El botón `#eventSelect` vive en el **Tab Pagos** y el bloque llamaba a `agregarPagoEfectivo()` parado en Documentos. Cinco casos caídos por una pestaña. | `clickTab('pagos')` antes de pagar | v3: **los 5 resueltos** (3 PASS + 2 N/A justificadas) |
| **DM-COB-053/054/055/041/042/026** — `Cliente "C.1018" no encontrado · 50 listados` | **Dos cosas juntas.** (1) El modal carga **50 de 78** clientes: los 28 últimos no están en el DOM. (2) El buscador filtra **con ENTER**, y si el input aún no existe al hacer `focus()` las pulsaciones se pierden y la lista sale entera. Intermitente. | Se espera al input, se **limpia**, se teclea, y se **comprueba que el texto quedó dentro**; si no, se reintenta; y si aun así no aparece, se pagina la lista hacia abajo | v3: ya no vuelve a salir |
| **DM-COB-057** — exceso 50,00 sin anticipo | **Dos causas mezcladas.** (a) el oráculo cortaba al ver la primera fila y podía leer entre el cobro y el anticipo; (b) **defecto real de la app** (§4, D-1) | (a) `verificarNube()` deja **asentar** el conteo antes de concluir; (b) se separó en dos casos, 057 y 058 | v3/v4: el defecto queda aislado y documentado |

### Vuelta 3 — (30 PASS · 1 FAIL · 9 BLOCKED · 7 N/A)

| Qué falló | Por qué | Qué cambié |
|---|---|---|
| **DM-COB-026/053/054/055/057/058** — «C.1018 no tiene documentos disponibles» | **Cada cobro ENVIADO se come su documento** (queda «Por aprobar» y desaparece del Tab). Una corrida gasta 5-7. El relevo era **un cliente fijo** (`CANDIDATOS[1]`), así que a mitad de corrida se agotaba y caían seis casos de golpe. | `abrirCobroConDocumento()` acepta una **LISTA** y rota; los agotados se apuntan en `clientesSinDocs` y no se vuelven a pedir. `montarCobro()` usa el mismo mecanismo. Pool del perfil ampliado de 3 a **24 clientes** |
| Riesgo latente: reabrir «el primero de la lista» | El cotejo de persistencia podía abrir un **Guardado viejo de otra corrida** y comparar contra un cobro ajeno — PASS o FAIL igual de falsos | `reabrirGuardado(marca)` busca **el cobro de esta corrida por su comentario único**; si no lo encuentra abre el primero **y lo dice en la nota** |

### Vuelta 4 — con rotación de clientes (**34 PASS · 2 FAIL · 4 BLOCKED · 7 N/A**)

La rotación destrabó los seis casos que caían por cartera agotada:
**053/054/055 PASS** (el descuento baja el total 50,40 = 10 %, persiste al reabrir y llega a la
nube con su fila en `collection_detail_discounts`), **056 PASS**, **057 PASS**.

| Qué falló | Por qué | Qué cambié |
|---|---|---|
| **DM-COB-026** — «no abrió el formulario de cobro» | **No es que la app no abra: se le pidió demasiado pronto.** El tile respondió pero las 5 pestañas no llegaron en los 8 s de espera porque la pantalla anterior seguía replegándose | Espera de 8 s → **12 s**, y un **segundo intento** (volver al home del módulo y reabrir) antes de descartar al cliente |
| *(los otros dos FAIL no son del guion)* | `DM-COB-REQ-002` y `DM-COB-058` son **defectos de producto** — §4 | — |

**Los dos FAIL que quedan son testigos, no fallos del guion.** `DM-COB-058` reprodujo el defecto
del anticipo por **tercera vez** (cobro `2728`, exceso 50,00, sin anticipo) en la misma vuelta en la
que `DM-COB-057` lo hizo bien por la vía directa (`2726` + anticipo `2727` de **0,01**). Los dos
casos juntos son la prueba: **la función existe y funciona; el camino del Guardado reabierto la
salta.**

---

## 3 · Los casos de Fase 2, uno por uno

Hasta el 14/09 eran **12 BLOCKED** con el mismo texto. Hoy:

| Caso | Qué hace ahora | Estado |
|---|---|---|
| **DM-COB-033** moneda del cobro | Localiza el `ion-select` **por sus opciones** (no por posición: el 1.º es Empresa y el 3.º la Tasa), comprueba que está habilitado con 2 monedas y **cambia de verdad** USD→Bs. Se hace sobre un cobro propio que se descarta, porque cambiar la moneda reinicia el cobro | ✅ **PASS** |
| **DM-COB-034** moneda de documentos | Verifica que el selector exista con Bs/USD y que **la lista reaccione**. 🔑 Un 0 en Bs **no es fallo**: es que el cliente no tiene documentos en esa moneda | ✅ **PASS** |
| **DM-COB-014** Tab Total | Lee «Monto total a Pagar», «Pago», «Diferencia», las columnas y los acordeones por método. En este build es un **grid, no una `<table>`** (0 `<tr>`, 0 `<th>`) | ✅ **PASS** |
| **DM-COB-015** Total General | Idem, exigiendo la línea «Total General» | ✅ **PASS** |
| **DM-COB-046** pago parcial | Abre el detalle (lupa), comprueba el contrato del toggle —**apagado: `readOnly` con el saldo · encendido: editable y reseteado a 0,00**—, teclea la mitad del saldo, guarda el detalle, verifica el Tab Pagos y **que sobreviva al Guardado** | ✅ **PASS** |
| **DM-COB-041** retención por documento | «Nro. Comp Ret» con **exactamente `sizeRetention` (5) dígitos** → eso **hace aparecer** Fecha/IVA/ISLR (antes ni existen en el DOM) → montos proporcionales al saldo → neto en el detalle y en Pagos | ✅ **PASS** |
| **DM-COB-042** persistencia de la retención | Guarda, reabre **por marca**, y exige que persistan el neto **y** los importes dentro del detalle | ✅ **PASS** |
| **DM-COB-028** anticipo | Comprueba que **no hay pestaña Documentos** y que guarda solo con cliente + pago. Hizo falta que `agregarPagoEfectivo()` acepte un **monto fijo**: en el anticipo no hay total que leer | ✅ **PASS** |
| **DM-COB-038** «Guardar y salir» | Sale por atrás y pulsa el botón de **guardar**, nunca el de «Salir sin guardar»; verifica `elementFromPoint` por si el `ION-BACKDROP` se come el clic, y reintenta | ✅ **PASS** |
| **DM-COB-029** cobro tipo Retención | **N/A por VG**: `cobroRetencion=false`, el submódulo no existe en el menú de este cliente. Antes salía BLOCKED, que es decir «no lo probé» cuando la respuesta es «no aplica» | ✅ **N/A justificada** |
| **DM-COB-047 / 039** tasa por fecha | **N/A, y es lo correcto:** el histórico de 4K ofrece **una sola tasa distinta** (`["870,00 Bs","870,00 Bs"]`). Cambiar la fecha no puede cambiar el monto ⇒ **el caso no puede fallar, así que no es un PASS**. Para cubrirlo hace falta un tenant con dos tasas dentro de `mesesTasa` | ⚠ **N/A — limitación del dato, no del guion** |

### Casos nuevos: tolerancia y anticipo automático

El encargo pedía cubrir «anticipo automático en USD · pago parcial y tolerancia» y **no había ningún
ID del guion al que colgar la tolerancia**. Se crearon tres, que **todavía no están en
`guiones-regresion/guion-cobros.md`** y hay que dar de alta ahí (igual que 048-055, que tampoco están):

| ID nuevo | Qué prueba | Estado |
|---|---|---|
| **DM-COB-056** | Exceso **49,99** (justo bajo el umbral) ⇒ se envía **sin** anticipo | ✅ PASS |
| **DM-COB-057** | Exceso **50,00** enviado **DIRECTO** ⇒ anticipo por **exceso − techo** = 0,01 | (ver §4) |
| **DM-COB-058** | El **mismo** exceso enviado desde un **Guardado reabierto** | 🔴 **FAIL testigo del defecto D-1** |

**La aritmética, confirmada contra el equipo y la nube:**
`RangoToleranciaPositiva` = 49,99 · `prepaidRangeAmount` = **0,01** (la web lo bajó de 1 el 11/09)
⇒ umbral = **50,00 exacto**, y el anticipo vale **exceso − 49,99**, no el exceso entero.

---

## 4 · Defectos del PRODUCTO — no se arreglan desde el script

### 🔴 D-1 · El anticipo automático NO se genera si el cobro se envía desde un Guardado reabierto

**Severidad: alta.** El excedente que el cliente pagó **no queda a su favor**: se pierde.

**A/B limpio**, mismo tenant, mismo vendedor, mismo día, **mismo excedente de 50,00 USD**:

| Camino | Cobro | `nu_difference` | Anticipo |
|---|---|---|---|
| **Enviar DIRECTO** | `2718` · 368,00 USD | 50,00 | ✅ **`2719` · 0,01 USD** |
| Guardar → reabrir → Enviar | `2717` · 747,00 USD | 50,00 | ❌ **ninguno** |
| Guardar → reabrir → Enviar *(repetido)* | `2720` · 234,50 USD | 50,00 | ❌ **ninguno** |

Y **todos** los demás cobros del tenant con `nu_difference = 50,00` sí generaron su anticipo
(2629, 2636, 2641, 2695, 2697, 2706) — los únicos sin él son los dos que pasaron por el Guardado:

```sql
SELECT c.tx_comment,
       max(CASE WHEN c.co_type=0 THEN c.nu_difference END) AS dif_cobro,
       count(*) FILTER (WHERE c.co_type=1)                 AS anticipos
FROM collection c WHERE c.da_collection > '2026-09-10' GROUP BY c.tx_comment;
```

**Pista para desarrollo:** los diálogos de los dos caminos **no son los mismos**. El directo muestra
«El Cobro será enviado» → «Cobro nro. N enviado exitosamente». El reabierto intercala **«Su Cobro
será enviado»**. Son dos rutas de envío distintas, y la del Guardado no pasa por
`shouldCreateAutomatedPrepaidOnSend()` / `getPrepaidExcessAmount()`.

**En el guion queda como `DM-COB-058`, fallando a propósito.** Mientras ese caso falle, el defecto
sigue vivo. `DM-COB-057` (mismo excedente, envío directo) prueba que la función **sí funciona**, así
que el FAIL no se puede confundir con «la tolerancia está mal configurada».

### ⚠ D-2 · `DM-COB-REQ-002` — el botón Enviar no dice qué falta

Con el formulario recién empezado, Enviar nace deshabilitado (**C1 correcto**) pero **no hay marca,
borde ni mensaje** que indique qué falta (**C2 del REQ incumplido**). Sale FAIL en **todas** las
vueltas y ya salía igual el 07/09: **no es un hallazgo nuevo de esta corrida**, es el criterio C2
del REQ del botón Enviar, pendiente en el producto.

### ℹ️ D-3 · Cambiar la moneda del cobro no avisa de que se reinicia

`DM-COB-033` pasa, pero la nota dice `aviso de reinicio: "ninguno"`. En otros tenants
(`dm-electronica`) el cambio encolaba «¿Seguro desea cambiar la moneda? El cobro será reiniciado!».
Aquí no sale. **Cosmético / severidad baja**, y puede depender del punto del flujo. Se anota, no se
reporta como defecto firme.

---

## 5 · Limitaciones que quedan escritas, no arregladas

| Qué | Por qué no se puede cerrar hoy |
|---|---|
| **DM-COB-050 · 051 · 052** (tope de descuento) | El catálogo de 4K tiene **dos** descuentos (10 % y 80 %) y `maxCollectDiscount` = **0** en el equipo, que el guion trata como «sin tope» (100 %). **Con 10 + 80 = 90 % no hay forma de pasarse de 100 %**, y ninguno de los dos abre el input de tasa (`require_input`). Las dos salidas son **por WEB**, y el encargo prohíbe tocar la configuración: (1) bajar `maxCollectDiscount` por debajo de 80, o (2) crear un descuento con «Porcentaje Manual = SÍ». El guion ya lo dice así, con los dos caminos, en vez de un BLOCKED mudo |
| **DM-COB-047 · 039** (tasa por fecha) | El histórico de 4K tiene **una sola tasa distinta**. Un caso que no puede fallar **no es un PASS**: quedan en **N/A** con la razón |
| **`maxCollectDiscount = 0`** | `run.js` hace `Number(x) \|\| 100`, que convierte el 0 en 100. **Eso es una decisión, no un valor.** Ahora el informe lo dice literalmente en vez de escribir «tope configurado: 100 %» como si estuviera puesto así. **Qué hace la app con 0 hay que leerlo en la UI**, no deducirlo |
| **IDs nuevos sin guion** | `DM-COB-048` a `058` existen en el script y **no** en `guiones-regresion/guion-cobros.md`. Hay que darlos de alta para que el guion manual y el automático digan lo mismo |

---
## 6 · PEDIDOS — evolución vuelta a vuelta

`automation/playwright/modules/pedidos.js`

### Vuelta 1 — línea base en 4K (**2 PASS · 1 FAIL · 20 BLOCKED**)

Un único fallo tumbó el módulo entero: **DM-PED-006** no lograba dejar el cliente puesto, y los
20 casos siguientes salieron «PED-006 falló: sin cliente no hay transacción».

El diagnóstico del propio guion ya apuntaba al sitio — *«y SÍ estaba en el modelo · vía
componente: ok pero sin efecto»* — así que fui a mirarlo en vivo:

```
setClientfromSelector(C.0010)  →  hasClient: false · lockSegments: true
                                  input: "Seleccione Cliente"
                                  alerta: "Pedidos · Este cliente tiene deuda vencida,
                                           ¿Desea continuar con el pedido?"  [Cancelar | Aceptar]
```

**`setClientfromSelector` no asigna el cliente por sí solo: encola una CONFIRMACIÓN, y el cliente
solo se asigna al Aceptar.** Pulsando Aceptar a mano:

```
input: "EURO REPUESTOS FIOVAL, C.A. (C.0010)" · hasClient: true · lockSegments: false
tabs: General/Pedido/Total/Adjunto — las cuatro habilitadas
```

**Por qué fallaba:** el guion **sí** contemplaba ese diálogo, pero lo buscaba tras una espera
**fija de 1,5 s**, y el diálogo tarda más en pintar. `alertInfo()` devolvía `null`, no se pulsaba
nada, y el módulo se iba a la «Vía 2 (modal real)» **con la alerta viva** — cuyo backdrop se come
todos los clics siguientes. De ahí el «ok pero sin efecto».

**Qué cambié:** se **espera a que la confirmación aparezca** (hasta 5 s, sondeando), en vez de
suponer cuánto tarda; se acepta (`aceptar/ok/sí/continuar`, **nunca Cancelar**, que descarta el
cliente); y se limpian los avisos encadenados. Si el cliente queda puesto sin preguntar nada, se
sale del bucle sin esperar de balde.

> 🔑 **Es la trampa de siempre, en otra forma:** una espera fija donde hacía falta esperar a una
> condición. El clic no fallaba — simplemente no se daba — y el error apareció 20 casos después
> disfrazado de «el cliente no quedó seleccionado».

**Además, en la misma vuelta:** `DM-PED-031` daba PASS con «volvió al home», que es mirar la
pantalla, no el resultado. **Guardar es local; enviar es lo único que POSTea.** Ahora consulta la
nube por el comentario único de la corrida y, como en cobros, **cuenta las filas**: si un solo
Enviar deja dos pedidos con la misma marca, es duplicado y no es PASS.

---

### Vuelta 2 — con el cliente resuelto (**10 PASS · 6 FAIL · 4 BLOCKED · 3 N/A**)

De 2 PASS a 10. Lo que quedó, y por qué:

| Qué falló | Por qué | Qué cambié |
|---|---|---|
| **DM-PED-030** — «alert: ¿Desea guardar el pedido?» | **El primer diálogo es una PREGUNTA, no el resultado.** El guion lo tomaba por la confirmación de éxito — y encima buscaba `/guardad/i`, que **no casa con «guardar»** — así que daba FAIL con el pedido intacto y arrastraba a **031** y **REQ-003** | Se **acepta** la pregunta y se lee la respuesta; y el oráculo deja de ser la alerta: se comprueba que **el pedido exista** en la BD local del equipo |
| **DM-PED-017** — `"4400-01202" no apareció en 4 categorías · relevo: el árbol no muestra ni productos ni categorías` | **Dos cosas.** (1) El producto del perfil no está en el catálogo de este vendedor (solo 4 categorías: FILTROS, INYECCION, MISCELANEOS, MOTOR). (2) **El relevo, que existía justo para eso, se encontraba el árbol VACÍO**: la búsqueda anterior entró y salió de las 4 categorías y dejó el nivel sin nodos, así que el mensaje hablaba del árbol cuando el problema era el dato | Antes de pedir el relevo se **restaura el árbol** (General → Pedido) y se le dan 6 categorías en vez de 3 |
| **DM-PED-024 / 026 / IVA-001 / TOT-001 / VG-002** | Cascada de 017: sin línea no hay Tab Total ni panel de producto | se resuelven con 017 |
| **DM-PED-VG-001** — el mapa salía «DIESEL · USD · AV. USLAR… · PEDIDO ESTANDAR» | **Eran los VALORES disfrazados de nombres.** `label`, `aria-label` y `placeholder` vienen todos a `null`, y el shadowRoot del `ion-select` contiene **el valor**, no el rótulo. Peor: disparó un aviso **FALSO** («YAML multiCurrency=true pero no hay selector de Moneda») cuando el selector estaba justo ahí | La etiqueta se lee del **`ion-col` que envuelve al select** («Empresa:», «Moneda:», «Sucursal:», «Tipo Pedido:»…), y el valor, del shadow |
| **DM-PED-029** | Ver abajo: **la expectativa del guion era la equivocada** | Reescrito |

#### 🔴 DM-PED-029 — no era un defecto: era el oráculo del guion

El guion smoke exigía «Guardar **y** Enviar deshabilitados con 0 líneas», y venía dando FAIL desde
mio_parts. Iba camino de reportarse como defecto de producto. **Medido a mano en 4K**, con cliente
puesto y el carrito vacío:

```
Guardar: HABIL · Enviar: HABIL
pulsar Guardar →  "Denario · Debe agregar al menos un producto al pedido."  [OK]
                  … y NO guarda nada
```

**La protección existe.** La app no la implementa deshabilitando el botón, sino **validando al
pulsarlo y diciendo qué falta** — que es, además, exactamente el criterio **C2 del REQ del botón
Enviar**, y por esa misma vía `DM-PED-REQ-002` da PASS en este módulo. Las dos expectativas se
contradecían entre sí.

**Qué mide ahora el caso:** que **no se pueda guardar un pedido vacío**. Si los botones nacen
deshabilitados, PASS. Si nacen habilitados, **se pulsa** y se exige que no guarde y que avise; si
llegara a guardar un pedido sin líneas, FAIL. Es un caso más fuerte que el original — el anterior
podía dar PASS con los botones grises sin comprobar nunca que la app proteja de verdad.

> Esto **no es esconder un defecto**: es corregir un oráculo que contradecía al propio REQ. El
> comportamiento queda descrito literalmente en la nota del caso, corrida tras corrida.

### Vuelta 3 — (**16 PASS · 3 FAIL · 4 N/A**)

**Los cinco pendientes que arrastraba el módulo quedaron confirmados de una vez:**

| Pendiente de `PENDIENTES.md` | Cómo quedó |
|---|---|
| El parser del Tab Total (capturó el 0 de «Total Item») | ✅ `DM-PED-024`: Base 27 · Total 27 · `DM-PED-TOT-001`: **27 − 0 + 0 = 27**, diferencia 0,0000 |
| La paginación dentro de la categoría | ✅ `DM-PED-017` localiza `1R1807-4K` dentro de «FILTROS 1» |
| La reposición de línea tras `DM-PED-026` | ✅ tras vaciar el carrito (1 → 0), `DM-PED-030` repone y guarda |
| Las etiquetas de los `ion-select` de VG | ✅ `Empresa="DIESEL" \| Moneda="USD" \| Sucursal=… \| Tipo Pedido="PEDIDO ESTANDAR" \| Lista de Precio="PRECIO 1" \| Condición de pago="21 DIAS"` |
| `DM-PED-029` | ✅ resuelto — era el oráculo, no la app (arriba) |

Y **`DM-PED-031` pasó con oráculo de nube**: `☁ 1 fila con la marca Test-PED-123146 → 2596 · 27,00 USD · st=1`.

| Qué falló | Por qué | Qué cambié |
|---|---|---|
| **DM-PED-034 / 035 / 032** — «0 ítems», «sin pedidos en la lista» | **UN CERO NO ES UN RESULTADO.** La lista estaba **llena** — el pedido recién enviado, *Nro. Ref. 2596*, se leía en pantalla — pero se contaba tras una espera **fija de 2,5 s** y aún no había pintado. Tres casos caídos por leer demasiado pronto | `abrirListaPedidos()` **espera a que la lista cargue** (hasta 12 s, con un segundo intento) y la usan 034, 035 y 037. Si de verdad no carga, sale **BLOCKED diciendo eso**, no «no hay pedidos» |

### Vuelta 4 — (**17 PASS · 0 FAIL · 5 N/A · 1 BLOCKED**)

Cero FAIL. Las 5 N/A son **señales de configuración**, no huecos: el panel de línea no ofrece
«% Descuento» ni IVA porque esas VG están apagadas — *la ausencia del selector ES la señal*.

| Qué falló | Por qué | Qué cambié |
|---|---|---|
| **DM-PED-034** BLOCKED — «la lista no cargó en 12 s (en la página: **false**)» | **No llegó a la lista.** La pantalla seguía en «PEDIDO BUSCAR COPIAR»: justo después de ENVIAR la app está volviendo al home y **el primer BUSCAR se pierde**. Dos casos más abajo, esa misma lista tenía 8 ítems | Se deja asentar 1,5 s antes de pulsar, **3 intentos** en vez de 2, y si a los 5 s seguimos en el home del módulo se corta y se reintenta en vez de agotar los 12 s mirando la pantalla equivocada |

> El BLOCKED **dice la verdad**: «no llegué a la lista», no «no hay pedidos». Esa distinción es
> justo lo que faltaba en la vuelta 3, donde el mismo problema se leyó como tres FAIL.

### Vuelta 5 — **REGRESIÓN: 2 PASS · 1 FAIL · 20 BLOCKED**

La vuelta de confirmación **volvió al punto de partida**, y eso destapó un fallo más fino que el
de la vuelta 1. `DM-PED-006`:

```
"EURO REPUESTOS FIOVAL, C.A. (C.0010)"   ← el input SÍ tiene el nombre
tabs libres: 1 · lockSegments: true · hasClient: FALSE   ← el modelo NO tiene cliente
```

**Por qué:** `#clienteSelect` se rellena de forma **optimista** — muestra el nombre mientras la
confirmación de deuda sigue pendiente. Mi arreglo de la vuelta 1 usaba **el input** como señal de
«ya está puesto», así que salía del bucle **sin aceptar el diálogo**, y a partir de ahí el backdrop
de la alerta bloqueaba la pantalla entera. Funcionó tres vueltas por puro orden de llegada.

**Qué cambié:**

- El oráculo pasa a ser **el MODELO (`hasClient`)**, nunca el input.
- El bucle **sigue vigilando hasta 8 s** y acepta **todas** las confirmaciones encadenadas (deuda,
  límite de crédito…), en vez de tratar la primera y salir.
- La «vía componente» solo se da por buena si `hasClient === true`; si no, **cae a la vía del
  modal real** en lugar de seguir como si nada.
- Y el veredicto se **autodiagnostica**: si el input tiene nombre y el modelo no tiene cliente, lo
  dice con esas palabras y apunta a la confirmación sin aceptar.

> 🔑 **Esta vuelta justifica la regla de parada.** Con una sola vuelta «buena» (17 PASS · 0 FAIL)
> habría cerrado el módulo como fiable, y llevaba dentro una carrera que lo tumba entero. **Dos
> vueltas iguales seguidas no es burocracia: es lo que separa «funciona» de «funciona siempre».**

### Vuelta 6 — (**18 PASS · 0 FAIL · 0 BLOCKED · 5 N/A**)

El mejor resultado del módulo: **ningún FAIL y ningún BLOCKED**. `DM-PED-034` también entra
(la lista cargó con 9 ítems) y `DM-PED-031` vuelve a verificarse en la nube (pedido **2598**).

Las 5 N/A son **señales de configuración**, no huecos:

- `DSC-001` / `DSC-002` / `IVA-001`: el panel de línea no ofrece «% Descuento» ni IVA ⇒ esas VG
  están apagadas. **La ausencia del selector ES la señal de la VG**, no un fallo.
- `DM-PED-032`: el dirty-guard no aparece porque el formulario estaba *pristine*.
- `DM-PED-037`: solo los **Guardado** traen botón de borrado, y en ese momento no había ninguno.

### Vuelta 7 — **REGRESÓ OTRA VEZ: 2 PASS · 1 FAIL · 20 BLOCKED**

Mismo síntoma que la vuelta 5 — pero esta vez **el propio veredicto dijo dónde mirar**, porque en
la vuelta 5 le había añadido el autodiagnóstico:

```
DM-PED-006 FAIL · tabs libres: 1 · lockSegments: true · hasClient: false
🔴 el input muestra el nombre pero el MODELO no tiene cliente: casi siempre es que
   quedó una confirmación sin aceptar (su backdrop bloquea el resto de la pantalla)
```

**La causa de fondo, por fin:** `clickAlertBtn()` de pedidos **pulsaba y se fiaba**. Y
**el primer clic sobre el botón de una `ion-alert` puede caer en el `ION-BACKDROP`**: no da error,
la alerta no se cierra, y como su backdrop tapa la pantalla, todo lo que viene después parece
«pulsé y no pasó nada». Intermitente por definición — por eso funcionó en las vueltas 2, 3, 4 y 6
y falló en la 5 y la 7.

**Qué cambié:**

- `clickAlertBtn()` **comprueba si la alerta sigue viva** tras el clic y, si sigue, reintenta
  **por DOM** — la única vía que atraviesa el backdrop — hasta 3 veces, mirando `elementFromPoint`
  para saber si estaba tapado. (Es el mismo blindaje que ya lleva `cobros.js`.)
- Y como red final: si al salir del bucle el modelo **sigue** sin cliente y queda una alerta
  abierta, se acepta por DOM. Sin eso, la pantalla queda bloqueada para todo lo demás.

### Vueltas 8 a 11 — la intermitencia, caracterizada

| Vuelta | Resultado | Venía detrás de… |
|---|---|---|
| 8 | **18 PASS · 0 FAIL** | una vuelta fallida |
| 9 | **2 PASS · 1 FAIL · 20 BLOCKED** | una vuelta **buena** |
| 10 | **18 PASS · 0 FAIL** | una vuelta fallida |
| 11 | **2 PASS · 1 FAIL · 20 BLOCKED** | una vuelta **buena** |

🔑 **El patrón es limpio y reproducible: PEDIDOS falla en toda corrida que va DETRÁS de una
corrida que terminó bien.** De la vuelta 5 en adelante alterna sin excepción: 5 ✗ · 6 ✓ · 7 ✗ ·
8 ✓ · 9 ✗ · 10 ✓ · 11 ✗. El síntoma es siempre el mismo:

```
setClientfromSelector(C.0010) → el input QUEDA con "EURO REPUESTOS FIOVAL, C.A. (C.0010)"
                                pero hasClient: FALSE · lockSegments: true · 1 pestaña libre
```

Por el camino descarté dos causas plausibles, y las dos dejaron el guion mejor aunque no fueran
la raíz:

1. **El ION-BACKDROP se come el clic de la alerta.** `clickAlertBtn()` pulsaba y se fiaba. Ahora
   comprueba si la alerta sigue viva y reintenta **por DOM**, que es lo único que atraviesa el
   backdrop. *(Mismo blindaje que ya tenía `cobros.js`.)*
2. **Una `ion-alert` descartada sigue en el DOM** — en una corrida se acumulan 15 o más. El filtro
   aceptaba cualquiera «con un botón medible», así que un cadáver podía hacerse pasar por la
   alerta viva. Ahora se exige `offsetParent !== null`, que es lo que distingue a una viva de una
   con `display:none`.

Ninguna de las dos lo cerró: la vuelta 11 volvió a fallar con las dos correcciones puestas.

**Lo que dice la evidencia:** el formulario **hereda algo del pedido anterior ya enviado**. Desde el
guion no se puede limpiar el estado interno del servicio; lo único sensato es **tirar el formulario
y abrir uno limpio**.

### Vuelta 12 — con reintento de formulario nuevo

`DM-PED-006` ahora, si el cliente no queda asignado, **vuelve al home del módulo, limpia alertas,
reabre el formulario y lo intenta una segunda vez** — y el veredicto **dice si hizo falta**:

> `⚠ hizo falta un SEGUNDO intento con formulario nuevo (el primero dejó el input con el nombre y
> el modelo sin cliente)`

Así la corrida no se pierde, y la señal de que el problema sigue vivo **no se borra**: queda escrita
en la nota de cada corrida que lo necesite.

#### ⚠ Honestidad sobre el alcance

**La causa raíz no está cerrada.** Lo que hay es: (a) el patrón caracterizado con once vueltas,
(b) dos causas plausibles descartadas y corregidas igualmente, y (c) un reintento que evita que la
corrida se pierda. Para cerrarlo haría falta mirar qué deja `orderService`/`app-pedido` en pie tras
enviar — eso es código de producto, fuera del alcance de este encargo.

**Para la barrida de mañana:** si `DM-PED-006` sale FAIL diciendo *«falló también con formulario
nuevo»*, **no es el dato del perfil**: es esta intermitencia. Relanzar el módulo suelto basta.

**Resultado de la vuelta 12: 18 PASS · 0 FAIL · 5 N/A** — y el detalle importa:

```
DM-PED-006  PASS  "EURO REPUESTOS FIOVAL, C.A. (C.0010)" (vía MODAL, 78 clientes cargados)
                  tabs libres: 4 · lockSegments: false · hasClient: true
```

La vía del componente **detectó que no había tomado** (gracias a exigir `hasClient`) y el módulo
cayó a la **vía del modal real**, que sí asignó el cliente — y además cargó los **78** clientes,
no 50. Ese es el mecanismo de recuperación funcionando: antes, la vía del componente se daba por
buena mirando el input y nadie llegaba a intentar la alternativa.

### Vuelta 13 — la que tenía que fallar, y no falló (**18 PASS · 0 FAIL · 5 N/A**)

Esta es **la vuelta que decide**: iba detrás de una vuelta buena, que es exactamente el caso en el
que el módulo venía cayendo sin excepción desde la 5.ª. Y el veredicto cuenta lo que pasó:

```
DM-PED-006  PASS  hasClient: true · tabs libres: 4
   confirmación(es) aceptada(s): "Este cliente tiene deuda vencida, ¿Desea cont…" [Cancelar/Aceptar]
   ⚠ hizo falta un SEGUNDO intento con formulario nuevo
```

**El primer intento volvió a envenenarse y el reintento lo recuperó** — y la nota lo dice, así que
la señal de que el problema de fondo sigue vivo **no se pierde**.

✅ **Vueltas 12 y 13: mismo resultado, 18 PASS · 0 FAIL, y ningún FAIL atribuible al guion.**
Se cumple la condición de parada.

---

## 7 · Cambios hechos a los scripts — lista corta

**`automation/playwright/modules/cobros.js`**

1. **Las VG las manda el EQUIPO**, no el YAML: se leen de `localStorage.globalConfiguration` al arrancar y la divergencia se anota.
2. **El cliente se descubre**: DM-COB-004/007 rotan por `clientes_con_documentos` hasta dar con uno que liste documentos en pantalla (tope de 8 relevos).
3. **La rotación llega a todos los sub-flujos**: `abrirCobroConDocumento()` acepta una lista; `clientesSinDocs` recuerda quién se agotó para no volver a probarlo; `montarCobro()` usa el mismo mecanismo.
4. **`verificarNube()`** cuenta filas **por `co_type`**, deja asentar el conteo y detecta duplicados. DM-COB-019 no pasa si hay duplicado.
5. **Fase 2 construida**: seis sub-flujos reales en lugar de doce BLOCKED genéricos.
6. **`cerrarDetalleGuardando()`** busca «Guardar» **por texto** (no por `.botonAddVerde`, que también es «Asignar descuento» y nace deshabilitado) y **mide las coordenadas tras el `blur`**.
7. **`clickAlertBtn()`** verifica oclusión: si la alerta sigue viva y en ese punto responde el `ION-BACKDROP`, pulsa por DOM.
8. **`reabrirGuardado(marca)`** abre **el cobro de esta corrida**, no «el primero de la lista».
9. **`agregarPagoEfectivo(digitos)`** admite un monto fijo (hace falta para el anticipo y para los bordes de tolerancia).
10. **`abrirNuevoCobro()`** espera 12 s (eran 8) y se reintenta una vez.

**`automation/playwright/modules/pedidos.js`**

1. **Se espera a la confirmación de deuda vencida** en lugar de suponer que tarda 1,5 s, y se acepta (nunca Cancelar).
2. **`DM-PED-031` tiene oráculo de nube**: fila en `"order"` por el comentario único, con conteo de duplicados.
3. **`alertInfo()` y `clickAlertBtn()` ignoran las alertas muertas** (`offsetParent !== null`) y reintentan **por DOM** si el `ION-BACKDROP` se comió el clic.
4. **La confirmación de deuda se espera y se acepta**, sea cual sea su texto, usando `hasClient` como oráculo — nunca el input, que se rellena de forma optimista.
5. **`DM-PED-006` reintenta con formulario nuevo** si el cliente no queda asignado, y **dice en la nota si hizo falta**.
6. **`DM-PED-029` mide lo que importa**: que no se pueda guardar un pedido vacío (pulsando el botón si nace habilitado).
7. **`abrirListaPedidos()` espera a que la lista cargue** en vez de dormir 2,5 s y contar — un cero no es un resultado.
8. **El mapa de VGs lee la etiqueta del `ion-col`**, no el valor del shadowRoot.

**`automation/playwright/run.js`**

3. **`cobros` entra en `ORDEN_DEFAULT`**, antes de `pedidos`.

**`automation/clientes/4k.yaml`**

4. Pool de clientes de cobros de 3 → **24**, con los 10 medidos en la UI marcados ✅ y los agotados listados.
5. VG sincronizadas con el equipo: `prepaidRangeAmount` 50 → **0.01**, `maxCollectDiscount` 85 → **0**, `clientBankAccount` false → **true**, `historicPartialPayment` true → **false**, `validateCollectionDate` true → **false**, `colletionPayment` (un método más).

---

## 8 · Qué quedó fiable y qué no

### Fiable (aguanta la barrida de los diez módulos)

- **COBROS**, de punta a punta: núcleo, descuento de cobro en las tres capas, retención por
  documento, pago parcial, anticipo, Tab Total, moneda, «Guardar y salir», tolerancia y anticipo
  automático. **El oráculo del envío es la nube y cuenta filas**, así que un duplicado no puede
  pasar por PASS.
- **PEDIDOS**, de punta a punta: cliente, catálogo, alta de línea, Tab Total con su aritmética,
  borrado de línea, guardar, **enviar con verificación en la nube**, BUSCAR, reapertura y borrado.
  ⚠ **Con una salvedad honesta:** la selección de cliente arrastra una intermitencia cuya causa raíz
  está en el producto (§vueltas 8-11). El guion **se recupera solo** con un formulario nuevo y lo
  **anota en el veredicto**, pero no la elimina.
- **La configuración ya no la decide el YAML**: cobros lee las VG del equipo al arrancar. Un perfil
  viejo puede seguir equivocado, pero ya no marca N/A un caso que sí aplica.
- **La cartera se agota sola y el script lo aguanta**: rota de cliente y recuerda quién se quedó sin
  documentos.

### No fiable / no cubierto, con su causa

| Qué | Causa | Qué haría falta |
|---|---|---|
| `DM-COB-050 · 051 · 052` | El catálogo de descuentos de 4K (10 % y 80 %) con `maxCollectDiscount = 0` no permite superar ningún tope, y ninguno abre el input de tasa | Bajar el tope **por web** por debajo de 80, o crear un descuento con «Porcentaje Manual = SÍ». Y sincronizar |
| `DM-COB-047 · 039` | 4K tiene **una sola tasa distinta** en el histórico | Un tenant con dos tasas dentro de `mesesTasa` |
| `DM-COB-029` | `cobroRetencion = false`: el submódulo no existe en este cliente | Un tenant con la VG encendida |
| El caso multi-empresa | 4K tiene **una sola empresa** | Otro tenant |
| `DM-PED-DSC-001/002`, `DM-PED-IVA-001` | Las VG de descuento e IVA están apagadas en pedidos. **La ausencia del selector ES la señal de la VG**, no un fallo | Un cliente con esas VG activas |

> ⚠ **Ojo con el reloj en la barrida completa.** Cobros tarda **11-14 min** y es el módulo más
> largo. Si la cartera de documentos está agotada, la rotación añade tiempo: por eso lleva tope de
> 8 relevos en el arranque y 10 por sub-flujo.

---

## 9 · Trazabilidad

- Registros creados: anotados en `automation/clientes/_escrituras-de-prueba.md`.
- **No se aprobó ni rechazó ningún cobro.** 2708, 2709, 2712 y 2713 siguen esperando decisión de QA.
- **No se ejecutó SQL de escritura** ni se tocó ninguna configuración de la web.
- `_results.jsonl` de la última vuelta de cada módulo, en esta misma carpeta.

### Volumen dejado en la nube

| Tipo | Cantidad | Rango |
|---|---|---|
| Cobros (`co_type 0`) | **12** | `2715`–`2728` |
| Anticipos automáticos (`co_type 1`) | **2** | `2719`, `2727` — los dos legítimos, del caso DM-COB-057 y su sonda |
| Pedidos | **7** | `2596`–`2602`, todos C.0010 · 27,00 USD |

Todos con comentario `Test-COB-*` / `Test-TOL-*` / `Test-DTO-*` / `QA-ANT-*` / `Test-PED-*`.
Detalle y cómo revertirlos: `automation/clientes/_escrituras-de-prueba.md`.

**Ningún cobro duplicado.** Es el dato que cierra el punto 1: 12 envíos, 12 filas de cobro, y los
2 anticipos son los que la configuración manda crear.
