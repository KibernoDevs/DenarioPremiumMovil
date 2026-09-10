# Fixes de Cobros — Tolerancia y anticipo automático · IMPORTADORA 4K

| Parámetro | Valor |
|-----------|-------|
| RUN_ID | `fixes_cobros_20260910` |
| Cliente | **4k** · empresa **DIESE · GRUPO 4K** (empresa única) · base `4k` |
| Playa | **CARIBE** — `http://denariocaribe.ddns.net:8081/PremiumWS/services/` · **verificada en runtime** leyendo `window.__env.WsUrl` en el WebView, no deducida del YAML ni de `claves.env` |
| Web | `http://denariocaribe.ddns.net:8080/DenarioPremium` (bloque `# USUARIO WEB … CARIBE`) |
| Dispositivo | Infinix X6728 · `14678405BR003855` · `com.kiberno.denarioPremiumPro` **v6.6.21.3** · db 23 · `window.ng = true` |
| Vendedor | `V.0002` — ANGEL BETANCOURT (`idUser` 300) |
| Fecha | 2026-09-10 |
| Resultado | **2 FAIL · 1 FAIL(menor) · 7 PASS · 1 N/A** |

---

## 0. Resumen ejecutivo

1. **Fix 1 NO está en la build que se probó.** El umbral del anticipo automático **no** suma la
   tolerancia: es `prepaidRangeAmount` a secas. Está leído **del propio bundle del equipo**, no del
   repositorio (§7, F-01).
2. Como consecuencia, **la tolerancia no se evalúa antes que el anticipo**: son dos reglas
   independientes y, cuando se solapan, **gana el anticipo**. Con `prepaidRangeAmount = 1` y
   tolerancia `10,50`, una diferencia de **+1,00 USD — que está DENTRO de la tolerancia — generó un
   anticipo** (Ref 2633, verificado en la nube) (§7, F-02).
3. **Fix 2 está a medias.** `RangoToleranciaPositiva` y `RangoToleranciaNegativa` **sí** aceptan
   decimales y se configuran desde la web de punta a punta. **`prepaidRangeAmount` NO**: es un
   spinner **entero** con `min = 1`; **no admite `0` ni `0,01`, y lo rechaza en silencio** (§7, F-03).
4. **La zona gris SÍ se puede cerrar a cero — pero al revés de lo que dice el encargo.** No se cierra
   bajando `prepaidRangeAmount` (que es lo que el fix pedía), sino **subiendo la tolerancia a
   `prepaidRangeAmount − 0,01`**. Con `49,99 / 50` no queda ningún importe que bloquee por exceso (§5).
5. **Hallazgo de infraestructura:** una VG cambiada en la web **no llega al equipo con «Sincronizar»**
   del HOME. Solo baja con un **login nuevo** (§4, F-04).

---

## 1. Configuración de partida y final — leídas del EQUIPO

Fuente: `node automation/playwright/leer-vg-dispositivo.js cobros`
(lee `localStorage.globalConfiguration` del WebView). **No** se usó `global_configuration` de la
BD: ahí `valor='true'` significa «la variable existe», no su valor.

### 1.a Partida (antes de tocar nada) y final (al cierre)

| VG | **Partida** (equipo, 12:20) | **Final** (equipo, tras re-login 13:12) | Nota |
|---|---|---|---|
| `tolerancia0` | `true` | `true` | sin cambio |
| `TipoTolerancia` | `0` (Importe) | `0` | sin cambio |
| `RangoToleranciaPositiva` | **`49.99`** | **`49.99`** | ⚠ el YAML decía `10`: **estaba desactualizado**; el `49,99` viene de la escritura del 08/09 |
| `RangoToleranciaNegativa` | **`10`** | **`10`** | ⚠ el YAML decía `10` ✔ |
| `MonedaTolerancia` | `USD` | `USD` | |
| `automatedPrepaid` | `true` | `true` | |
| `prepaidRangeAmount` | **`50`** | **`50`** | |
| `prepaidRangeCurrency` | `USD` | `USD` | |
| `prepaidCurrency` | `USD` | `USD` | |
| `prepaidPaymentMethod` | `pa` | `pa` | |
| `cobroPrepago` | `true` | `true` | tile ANTICIPO/PREPAGO visible en el menú |
| `requiredCollectionAttachments` | **`false`** | `false` | ✅ confirmado leyéndolo: los cobros **se envían sin adjunto** (5/5 enviados sin adjunto) |
| `requiredComment` | `true` | `true` | sin comentario las 4 pestañas siguen bloqueadas |
| `userCanSelectIGTF` | **`false`** | `false` | ✅ confirmado ⇒ IGTF **N/A**, no FAIL |
| `enablePartialPayment` | `true` | `true` | no se usó (el parcial desactiva el anticipo: `existPartialPayment` corta `resolveAutomatedPrepaid`) |
| `multiCurrencyCollection` | `true` | `true` | permitió llevar el cobro a **USD** y medir 1:1 contra la tolerancia |

> ⚠ **Dos divergencias del YAML corregidas por esta corrida:** `RangoToleranciaPositiva` (YAML `10`
> ⇒ equipo `49.99`) y el comentario del YAML que describe el umbral del anticipo como `10 + 50 = 60`.
> Ninguno de los dos se sostiene contra el equipo.

### 1.b Configuraciones intermedias usadas para medir (todas deshechas)

| # | `RangoToleranciaPositiva` | `RangoToleranciaNegativa` | `prepaidRangeAmount` | Para qué |
|---|---|---|---|---|
| **A** (partida y final) | 49,99 | 10,00 | 50 | medir con la config real del cliente |
| **B** | **10,50** | **0,01** | 50 | hacer **visible** la banda que bloquea + probar decimales de punta a punta |
| **C** | 10,50 | 0,01 | **1** | probar el mínimo que admite el campo y medir el solapamiento |

Las tres escrituras quedaron **anotadas en el momento** en `automation/clientes/_escrituras-de-prueba.md`
y **deshechas al cierre**; la nota final de ese archivo quedó actualizada con la configuración vigente.

---

## 2. ¿Qué campos aceptan decimales? — Variables Globales → Cobros

Ruta: `/pages/variablesConfiguracion` → selector `#formGlobal:tipoVariable_input` = `C` (Cobros)
→ tabla `#formGlobal:tablaConf` → botón `#formGlobal:botonGuardar`.

Los tres campos son **spinners de PrimeFaces**, pero **no son el mismo componente**, y ahí está todo:

| VG | Componente | `precision` | `step` | `min` | `max` |
|---|---|---|---|---|---|
| `RangoToleranciaPositiva` | `formGlobal:tablaConf:6:**j_idt137**` | **2** | 0,01 | 0 | 100.000 |
| `RangoToleranciaNegativa` | `formGlobal:tablaConf:7:**j_idt137**` | **2** | 0,01 | 0 | 100.000 |
| `prepaidRangeAmount` | `formGlobal:tablaConf:10:**j_idt136**` | **0** | 1 | **1** | 10.000 |

### Lo que se tecleó en cada campo y qué pasó

| Campo | Se tecleó | En el campo al teclear | Tras `blur` | ¿Avisa? | Veredicto |
|---|---|---|---|---|---|
| `RangoToleranciaPositiva` | `10,50` | `10,50` | **`10,50`** | — | ✅ **acepta decimales** |
| `RangoToleranciaPositiva` | `49,99` | `49,99` | **`49,99`** | — | ✅ acepta decimales |
| `RangoToleranciaNegativa` | `0,01` | `0,01` | **`0,01`** | — | ✅ **acepta decimales, incluso 2 órdenes por debajo de 1** |
| `RangoToleranciaNegativa` | `10,00` | `10,00` | **`10,00`** | — | ✅ |
| **`prepaidRangeAmount`** | **`0,01`** | **`001`** ← la coma **nunca entra** | **`1`** | ❌ **no** | ❌ **rechaza el decimal EN SILENCIO** |
| **`prepaidRangeAmount`** | **`0`** | `0` | **`1`** | ❌ **no** | ❌ **rechaza el 0 EN SILENCIO** (clamp a `min=1`) |
| `prepaidRangeAmount` | `1` | `1` | `1` | — | ✅ es el **mínimo** que admite |
| `prepaidRangeAmount` | `50` | `50` | `50` | — | ✅ |

**Cómo es el rechazo**, con precisión, porque importa para el reporte a desarrollo:

- **La coma se filtra en el `keypress`**: nunca llega al campo. El usuario que teclea `0,01` ve `001`
  mientras escribe — no ve un error, ve **otro número**.
- **Al salir del campo, el spinner hace clamp a `min` sin decir nada**: `0` → `1`, `001` → `1`.
  No hay `ui-message-error`, no hay growl, no hay borde rojo. Se comprobó consultando
  `.ui-message-error, .ui-messages-error, .ui-growl-message` justo después del blur: **vacío**.
- El Guardar acepta lo que quedó y responde *"Configuración guardada exitosamente"*, así que el
  administrador se va convencido de haber guardado `0,01` cuando guardó `1`.

> 🔑 **Este es el hallazgo que anticipaba el encargo:** el campo **no admite 0 ni 0,01**, así que
> **la banda no se puede cerrar bajando `prepaidRangeAmount`**. Lo mínimo que se puede poner es `1`.

**Del lado del móvil el parser sí está listo para decimales** — `parseConfigDecimal` existe en el
bundle del equipo y normaliza coma y punto (`"1,5"` y `"1.5"` → `1.5`). El cuello de botella es
**exclusivamente el widget de la web**.

---

## 3. La tabla de los tres tramos — bordes exactos medidos

**Montaje común de todas las mediciones** (para que los importes sean 1:1 con la configuración):
cobro en **USD** (`multiCurrencyCollection=true`), y `MonedaTolerancia` = `prepaidRangeCurrency` =
`USD` ⇒ **sin conversión de por medio**. `TipoTolerancia = 0` (Importe).

Cada fila se midió escribiendo el monto en el pago **Efectivo** y leyendo, en el mismo instante:
la **Diferencia** de la UI, `collectService.lastValidToSend`, `lastSendIssues[]`,
`createAutomatedPrepaid` y `anticipoAutomatico.length`.

### 3.a Config **A** — tolerancia +49,99 / −10,00 · anticipo desde 50 (partida **y final**)

Documento: C.0060 · FAC **00022034** · saldo **550,00 USD**.

| Pago | Exceso | Diferencia UI | `validToSend` | `issues` | `prepaid` | Qué hace la app | Tramo |
|---|---|---|---|---|---|---|---|
| 550,00 | 0,00 | `0,00` azul | `true` | — | `false` | **Enviar directo** | 1 |
| 599,98 | **+49,98** | `49,98` azul | `true` | — | `false` | **Enviar directo** | 1 |
| **599,99** | **+49,99** | `49,99` azul | `true` | — | `false` | **Enviar directo** ← borde superior exacto de la tolerancia, **inclusivo** | 1 |
| **600,00** | **+50,00** | `50,00` azul | `true` | — | **`true`** | **ANTICIPO AUTOMÁTICO** (alerta + 1 anticipo) ← borde inferior exacto | 3 |
| 600,01 | +50,01 | `50,01` azul | `true` | — | `true` | anticipo | 3 |
| 649,98 | +99,98 | `99,98` azul | `true` | — | `true` | anticipo | 3 |
| **649,99** | **+99,99** | `99,99` azul | `true` | — | `true` | anticipo — **el umbral «suma» (49,99+50 = 99,99) no marca ninguna frontera** | 3 |
| 650,00 | +100,00 | `100,00` azul | `true` | — | `true` | anticipo | 3 |
| 540,01 | −9,99 | `-9,99` rojo | `true` | — | `false` | Enviar directo | 1 |
| **540,00** | **−10,00** | `-10,00` rojo | `true` | — | `false` | Enviar directo ← borde negativo exacto, **inclusivo** | 1 |
| **539,99** | **−10,01** | `-10,01` rojo | **`false`** | **`TOLERANCIA`** | `false` | **BLOQUEA** | 2 (negativo) |

**Tramo 2 por exceso: NO EXISTE con esta configuración.** El intervalo que bloquearía es
(49,99 ; 50,00) — abierto y de **ancho cero a dos decimales**.

### 3.b Config **B** — tolerancia +10,50 / −0,01 · anticipo desde 50 → **los tres tramos visibles**

Documento: C.0029 · FAC **00016791** · saldo **1.027,00 USD**.
Umbral esperado **por la regla confirmada con desarrollo**: `10,50 + 50 = 60,50`.

| Pago | Exceso | `validToSend` | `issues` | `prepaid` | Qué hace la app | **Lo esperado por el fix** |
|---|---|---|---|---|---|---|
| 1.027,00 | 0,00 | `true` | — | `false` | Enviar directo | ✅ igual |
| **1.037,50** | **+10,50** | `true` | — | `false` | **Enviar directo** ← borde superior de la tolerancia | ✅ igual |
| **1.037,51** | **+10,51** | **`false`** | **`TOLERANCIA`** | `false` | **BLOQUEA** ← borde inferior de la banda | ✅ igual |
| **1.076,99** | **+49,99** | **`false`** | **`TOLERANCIA`** | `false` | **BLOQUEA** ← borde superior real de la banda | ✅ igual (aún < 60,50) |
| **1.077,00** | **+50,00** | `true` | — | **`true`** | **ANTICIPO AUTOMÁTICO** | ❌ **debía seguir bloqueando** hasta 60,49 |
| 1.086,50 | +59,50 | `true` | — | `true` | anticipo | ❌ debía bloquear |
| **1.026,99** | **−0,01** | `true` | — | `false` | Enviar directo ← borde negativo **decimal** | ✅ |
| **1.026,98** | **−0,02** | **`false`** | **`TOLERANCIA`** | `false` | **BLOQUEA** | ✅ |

**Banda que bloquea medida: `10,51 … 49,99` = 39,49 de ancho = `prepaidRangeAmount − RangoToleranciaPositiva`.**
La regla confirmada predice `10,51 … 60,49` = 50,00 de ancho = `prepaidRangeAmount`. **No coincide.**

### 3.c Config **C** — tolerancia +10,50 / −0,01 · anticipo desde **1** (el mínimo del campo)

Documento: C.0029 · FAC **00016792** · saldo **944,00 USD**.
Umbral esperado por el fix: `10,50 + 1 = 11,50`.

| Pago | Exceso | `validToSend` | `issues` | `prepaid` | Qué hace la app | **Lo esperado por el fix** |
|---|---|---|---|---|---|---|
| 944,00 | 0,00 | `true` | — | `false` | Enviar directo | ✅ |
| **944,99** | **+0,99** | `true` | — | `false` | Enviar directo, **sin anticipo** | ✅ |
| **945,00** | **+1,00** | `true` | — | **`true`** | **ANTICIPO** — *y la diferencia está DENTRO de la tolerancia (10,50)* | ❌ debía enviarse **sin** anticipo |
| 954,50 | **+10,50** | `true` | — | `true` | **ANTICIPO** en el borde mismo de la tolerancia | ❌ debía enviarse sin anticipo |
| 954,51 | +10,51 | `true` | — | `true` | anticipo | ❌ debía **bloquear** (< 11,50) |
| **955,49** | **+11,49** | `true` | — | `true` | anticipo | ❌ debía **bloquear** (< 11,50) |
| 955,50 | +11,50 | `true` | — | `true` | anticipo | ✅ (coincide por casualidad: ya venía en anticipo desde 1,00) |

**Banda que bloquea: 0,00 — no existe ningún importe que bloquee por exceso.** Pero el precio es el
**solapamiento**: de `+1,00` a `+10,50` la diferencia está dentro de tolerancia **y** se parte en un
anticipo. **La tolerancia positiva queda muerta por encima de `prepaidRangeAmount`.**

### 3.d El orden de validación, comprobado explícitamente

El encargo pide comprobar «que la tolerancia se evalúe primero y el anticipo después». **No es así.**
Dos evidencias independientes:

1. **Por comportamiento (config C, §3.c).** Si la tolerancia se evaluara primero, un exceso de
   `+1,00` con tolerancia `10,50` cerraría el caso ahí: dentro de tolerancia ⇒ Enviar directo, sin
   anticipo. **Lo que hace la app es crear el anticipo.** Se envió de verdad y quedó en la nube:
   cobro **Ref 2632** (945,00) + anticipo **Ref 2633** (1,00 USD).
2. **Por el código del propio bundle del equipo** (leído con `String(fn)` sobre el servicio vivo, no
   del repositorio):

```js
getAutomatedPrepaidActivationThreshold() {
    const prepaidMin = this.parseConfigDecimal(this.prepaidRangeAmount);
    return Number(prepaidMin.toFixed(this.getMoneyDecimalPlaces()));
}
```

   No hay techo de tolerancia por ningún lado. Y `getPositiveToleranceCeilingInCollectionCurrency`
   —la función que el fix introduce— **no existe en el prototipo del servicio de la build instalada**
   (se listaron las 355 propiedades del prototipo: no está).
   Llamado en vivo con la config de partida: `getAutomatedPrepaidActivationThreshold()` → **`50`**
   (no `99,99`).

   La decisión, además, se toma en `resolveAutomatedPrepaid`, que corre **independiente** de la
   tolerancia: `if (automatedPrepaid && coType==='0' && !existPartialPayment && excess >= umbral)
   createAutomatedPrepaid = true`. La tolerancia solo entra **después**, en el gate de Enviar
   (`applySendIssuesGate`), para **perdonar** el issue `TOLERANCIA` cuando el anticipo ya se creó.
   Es decir: **el anticipo se decide primero y la tolerancia se subordina a él**, exactamente al revés
   del fix.

---

## 4. Verificación de que la configuración llega al equipo

| Intento | Qué se hizo | ¿Llegó la VG al equipo? |
|---|---|---|
| 1 | Guardar en la web → **«Sincronizar» del HOME** → Aceptar → **90 s** de sondeo | ❌ **NO.** `RangoToleranciaPositiva` siguió en `49.99`; `lastUpdate` no se movió (`2026-09-10 12:21:01.608`); ningún `ion-loading`; ninguna alerta de fin |
| 2 | Repetido, con hook de red instalado y **90 s** más de sondeo | ❌ **NO.** Mismo resultado |
| 3 | **SALIR → login de nuevo** (`V.0002zonacentral`) | ✅ **SÍ, y de inmediato**: a los 3 s del submit `globalConfiguration` ya traía `10.5 / 0.01 / 50`, **antes** de que terminara la sincronización de tablas |

Se repitió el ciclo **3 veces** (configs B, C y la final) con idéntico resultado: **solo el login
baja las Variables Globales**. Coherente con el código: el único punto que escribe
`globalConfiguration` es `globalConfig.setVars(...)`, y el único que le pasa valores es la respuesta
del **login** (`variablesConfiguracion` / `variablesConfiguracionCliente`). El servicio de
sincronización **relee lo que ya está en `localStorage` y lo reinserta en el SQLite local** — nunca
lo descarga.

---

## 5. ¿Se pudo cerrar la zona gris? Sí, pero no por donde el fix decía

La banda que bloquea vale, **en esta build**, `prepaidRangeAmount − RangoToleranciaPositiva`:

| Config | tol+ | anticipo desde | Banda que bloquea | Ancho |
|---|---|---|---|---|
| B | 10,50 | 50 | 10,51 … 49,99 | **39,49** |
| C | 10,50 | **1** (mínimo del campo) | — | **0,00**, pero con **solapamiento** 1,00 … 10,50 |
| **A (final)** | **49,99** | **50** | (49,99 ; 50,00) | **0,00**, **sin solapamiento** |

- **Bajar `prepaidRangeAmount` no sirve** para cerrarla limpiamente: el campo no baja de `1`, y en
  cuanto queda por debajo de la tolerancia **no cierra la banda, la invierte** — el anticipo se come
  la tolerancia (config C).
- **Lo que sí la cierra sin efectos colaterales es subir la tolerancia a `prepaidRangeAmount − 0,01`.**
  Es exactamente la configuración `49,99 / 50` con la que la corrida empezó y terminó: entre 49,99
  (último valor que envía directo) y 50,00 (primer valor que genera anticipo) **no cabe ningún
  importe a dos decimales**.
- Y como `prepaidRangeAmount` es **entero**, el único modo de conseguir ancho cero es que la
  tolerancia sea **decimal** — o sea, **depende del pedazo del Fix 2 que sí está hecho**.
- ⚠ **Si el fix del umbral (F-01) se corrige**, esta receta deja de valer: con `umbral = tol + prepaidMin`
  la banda pasa a medir `prepaidMin` **siempre**, y el mínimo alcanzable sería **1,00** (con
  `prepaidRangeAmount = 1`), nunca cero. **Cerrarla del todo exigiría que el campo admita `0`.**

---

## 6. Tabla de veredictos

| ID | Caso | Resultado | Números medidos |
|---|---|---|---|
| **DM-COB-TOL-001** | Tramo 1 — diferencia **dentro** de tolerancia ⇒ Enviar directo | ✅ **PASS** | +49,98 y **+49,99** (config A) · **+10,50** (config B) · −9,99 y **−10,00** (A) · **−0,01** (B) → `validToSend=true`, `issues=[]`, sin anticipo |
| **DM-COB-TOL-002** | Borde: **primer** importe fuera de tolerancia ⇒ bloquea | ✅ **PASS** | **+10,51** (B) y **−10,01** (A) / **−0,02** (B) → `issues=['TOLERANCIA']`, `validToSend=false`; al pulsar Enviar: *«El monto pagado está fuera del rango de tolerancia permitido.»* |
| **DM-COB-TOL-003** | Los bordes de tolerancia son **inclusivos** (`≤`) | ✅ **PASS** | `+49,99` con tol `49,99` envía; `+10,50` con tol `10,50` envía; `−10,00` con tol `10,00` envía |
| **DM-COB-TOL-004** | La tolerancia **acepta decimales** de punta a punta (web → equipo → comportamiento) | ✅ **PASS** | web `10,50`/`0,01` → equipo `10.5`/`0.01` → borde real en `+10,50` y `−0,01` |
| **DM-COB-ANT-001** | Tramo 3 — anticipo automático por excedente ⇒ Enviar + anticipo | ✅ **PASS** | +50,00 (A) → **Ref 2629 + anticipo Ref 2630 (50,00 USD)**; +1,00 (C) → **Ref 2632 + anticipo Ref 2633 (1,00 USD)**. Ambos en la nube, `co_original_collection` apuntando al cobro padre |
| **DM-COB-ANT-002** | **Umbral del anticipo = `RangoToleranciaPositiva + prepaidRangeAmount`** | ❌ **FAIL** | umbral efectivo = **50** = `prepaidRangeAmount`. Config A: anticipo en **+50,00**, no en +99,99. Config B: anticipo en **+50,00**, no en +60,50. Config C: anticipo en **+1,00**, no en +11,50. `getAutomatedPrepaidActivationThreshold()` en vivo → **50** |
| **DM-COB-ANT-003** | **El anticipo se valida DESPUÉS de la tolerancia** | ❌ **FAIL** | Config C: **+1,00** está dentro de tolerancia (10,50) y **aun así crea anticipo** (Ref 2633). El techo de tolerancia no participa del umbral y `resolveAutomatedPrepaid` corre sin consultarlo |
| **DM-COB-TOL-005** | Tramo 2 — banda entre tolerancia y umbral, con su ancho esperado | ❌ **FAIL** (mismo defecto que ANT-002) | banda real `10,51…49,99` (**39,49**); esperada `10,51…60,49` (**50,00**) |
| **DM-COB-VG-001** | `prepaidRangeAmount` **configurable con decimales** desde la web | ❌ **FAIL** | spinner entero: `precision=0`, `step=1`, `min=1`. `0,01` → **`1`**; `0` → **`1`**; **sin aviso** |
| **DM-COB-VG-002** | La VG guardada en la web **llega al equipo** | ❌ **FAIL** (menor / infra) | «Sincronizar» del HOME × 2, 90 s cada uno: la VG **no baja**. Solo baja con **login nuevo** (3/3) |
| **DM-COB-ANT-004** | Mensaje del anticipo automático informa el **monto** | ❌ **FAIL menor** | la alerta dice literalmente *«Anticipo automático creado con»* — frase cortada, sin importe |
| **DM-COB-IGTF-001** | IGTF en el cobro | 🚫 **N/A** | `userCanSelectIGTF=false` leído del equipo ⇒ el IGTF no se muestra en 4K. **No es FAIL** |

---

## 7. Defectos, con reproducción

### 🔴 F-01 · El umbral del anticipo automático NO suma la tolerancia positiva (DM-COB-ANT-002 / TOL-005)

**Severidad:** alta — es el fix que se venía a certificar, y no está en la build entregada.

**Qué debería pasar:** `umbral = RangoToleranciaPositiva + prepaidRangeAmount`.
**Qué pasa:** `umbral = prepaidRangeAmount`.

**Reproducción (2 min, config de partida del cliente):**
1. Variables Globales → Cobros: `RangoToleranciaPositiva = 49,99`, `prepaidRangeAmount = 50`.
   Guardar y **volver a entrar a la app** (ver F-04).
2. Cobros → COBRO → cliente `C.0060` → moneda del cobro **USD** → comentario.
3. Tab Documentos → marcar una factura de saldo **550,00 USD**.
4. Tab Pagos → Efectivo → monto **600,00** (exceso **+50,00**).
5. **Se observa:** alerta *«Anticipo automático creado con»* y el cobro queda listo para enviar.
   **Se esperaba:** que bloqueara, porque 50,00 < 99,99 (= 49,99 + 50).
6. Enviar → el cobro y su anticipo llegan a la nube.

**Evidencia dura, del bundle instalado** (no del repositorio):

```js
// window.ng.getComponent(document.querySelector('app-cobro')).collectService
getAutomatedPrepaidActivationThreshold() {
    const prepaidMin = this.parseConfigDecimal(this.prepaidRangeAmount);
    return Number(prepaidMin.toFixed(this.getMoneyDecimalPlaces()));
}
```

- Llamada en vivo con `RangoToleranciaPositiva=49.99` y `prepaidRangeAmount=50` → devuelve **`50`**.
- `getPositiveToleranceCeilingInCollectionCurrency` **no existe** en el prototipo del servicio
  (355 propiedades listadas).
- La build del equipo **no es la del repositorio local**: tiene `getRoundedPaymentDelta` y
  `getMoneyDecimalPlaces`, que no están en `feature/qa-guiones-regresion`, y le falta la función del
  fix, que sí está (commit `26dc93c0`, 04/09). **Conviene que desarrollo confirme de qué rama salió
  la APK 6.6.21.3 instalada** antes de dar el fix por entregado o por perdido.
- Registro creado que lo prueba: **Ref 2629** (cobro 600,00 USD) + **Ref 2630** (anticipo 50,00 USD).

---

### 🔴 F-02 · El anticipo se evalúa ANTES que la tolerancia y la anula (DM-COB-ANT-003)

**Severidad:** alta — es la mitad funcional del mismo fix, y en configuraciones razonables cambia lo
que el vendedor ve.

**Qué debería pasar:** una diferencia dentro de tolerancia se envía como cobro normal; el anticipo
solo entra para lo que **excede** la tolerancia.
**Qué pasa:** en cuanto el exceso llega a `prepaidRangeAmount`, se crea el anticipo **aunque la
diferencia esté cómodamente dentro de la tolerancia**.

**Reproducción:**
1. Variables Globales → Cobros: `RangoToleranciaPositiva = 10,50` y `prepaidRangeAmount = 1`.
   Guardar y **volver a entrar a la app**.
2. Cobros → COBRO → cliente `C.0029` → moneda **USD** → comentario.
3. Marcar la factura **00016792** (saldo **944,00 USD**).
4. Pagos → Efectivo → **944,99** (exceso +0,99): **no** hay anticipo. Correcto.
5. Cambiar a **945,00** (exceso **+1,00**): aparece *«Anticipo automático creado con»* y
   `createAutomatedPrepaid = true`. **Ese +1,00 está dentro de la tolerancia de 10,50.**
6. Subir a **954,50** (exceso **+10,50**, el borde exacto de la tolerancia): sigue creando anticipo.
7. Enviar → nube: cobro **Ref 2632** (945,00) y anticipo **Ref 2633** de **1,00 USD**.

**Consecuencia práctica:** con la config del cliente (tol 49,99 / anticipo 50) el solapamiento es de
un solo céntimo y no se nota. **Basta con que alguien baje `prepaidRangeAmount` por debajo de la
tolerancia** — que es justo lo que el Fix 2 propone hacer — para que **todo redondeo menor se
convierta en un anticipo** y la tolerancia deje de existir.

---

### 🔴 F-03 · `prepaidRangeAmount` no acepta decimales ni 0, y lo rechaza en silencio (DM-COB-VG-001)

**Severidad:** media-alta — bloquea la segunda mitad del Fix 2.

**Reproducción:**
1. Web → Empresa → Variables Globales → selector **Cobros**.
2. Fila *«Indique El monto mínimo excedido en el cobro para generar el abono automático»*
   (`formGlobal:tablaConf:10:j_idt136_input`).
3. Seleccionar todo, `Supr`, teclear **`0,01`**.
   → mientras se teclea el campo muestra **`001`**: **la coma no entra**.
4. Salir del campo (Tab o clic afuera) → el campo muestra **`1`**. **Sin ningún mensaje.**
5. Repetir con **`0`** → al salir queda **`1`**. **Sin ningún mensaje.**
6. Guardar → *«Configuración guardada exitosamente»*. Se guardó **1**, no lo que se escribió.

**Causa:** el spinner de esa fila está declarado con `precision: 0`, `step: 1`, `min: 1`, mientras que
los dos campos de tolerancia (`j_idt137`) usan `precision: 2`, `step: 0.01`, `min: 0`.
**Es el mismo cambio que se aplicó a la tolerancia y no se aplicó a este campo.**

**Lo que hay que arreglar:** darle a `prepaidRangeAmount` el mismo spinner decimal
(`precision 2`, `step 0,01`) y, además, **bajar el `min` a `0`** — sin `0` la banda no puede
cerrarse del todo si además se corrige F-01. El móvil ya está preparado: `parseConfigDecimal` acepta
coma y punto.

---

### 🟠 F-04 · Una VG guardada en la web no llega al equipo con «Sincronizar»; hace falta volver a entrar (DM-COB-VG-002)

**Severidad:** media — no rompe datos, pero hace que el vendedor opere con reglas viejas **sin
enterarse**, y hace perder tiempo a QA en cada tanda.

**Reproducción:**
1. Web → Variables Globales → Cobros: cambiar `RangoToleranciaPositiva` a `10,50` → Guardar
   (*«Configuración guardada exitosamente»*; recargando la página, el valor persiste).
2. En el equipo: HOME → **Sincronizar** → Aceptar. Esperar.
3. **Se observa:** la sincronización no muestra progreso propio, `lastUpdate` **no cambia** y
   `localStorage.globalConfiguration` sigue con `49.99` a los **90 s**. Repetido dos veces.
4. HOME → **SALIR** → entrar con el mismo usuario.
5. **A los 3 segundos del login**, antes incluso de que empiecen a bajar las tablas,
   `globalConfiguration` ya trae `10.5`.

**Coherente con el código:** el único que escribe `globalConfiguration` es `globalConfig.setVars()`,
y el único que le pasa valores es la respuesta del **login**. El servicio de sincronización lee
`localStorage` y lo reinserta en el SQLite local: **nunca descarga configuración**.

**Sugerencia de producto:** o el sync trae las VG, o la app avisa al vendedor de que hay
configuración nueva. Hoy no hace ninguna de las dos.

**Consecuencia para QA (importante para las tandas siguientes):** después de tocar una VG,
**re-loguear siempre** (~80 s) y **releer del equipo** antes de medir. Sincronizar no alcanza.

---

### 🟡 F-05 · La alerta del anticipo automático no dice el monto (DM-COB-ANT-004)

**Severidad:** baja — cosmético, pero deja una frase cortada delante del vendedor.

**Qué se ve:** al superar el umbral, un `ion-alert` con título `Denario Cobros` y mensaje
**«Anticipo automático creado con»** — y nada más. La frase termina en «con».

**Causa (confirmada, es dato del tenant):** el mensaje sale de
`buildAutomatedPrepaidMessage()`, que hace `template.replace('{amount}', amountLabel)`.
El tag de 4K **no tiene el marcador**:

```sql
SELECT co_application_tag, tag FROM application_tags
 WHERE co_application_tag = 'COB_MSG_AUTOMATED_PREPAID';
-- → 'Anticipo automático creado con'
```

El texto por defecto del código sí lo trae (*«…por el monto excedente de {amount}. Se enviará un
anticipo junto al cobro.»*), pero el tag del cliente lo pisa. **Se corrige en `application_tags`, no
en la app.** Reproduce en el 100 % de los casos que crean anticipo (7/7 medidos).

> ℹ️ `COB_ERROR_TOLERANCIA` **no existe** en `application_tags` de 4K, así que el bloqueo por
> tolerancia usa el texto por defecto del código —*«El monto pagado está fuera del rango de
> tolerancia permitido.»*— que es correcto y claro. No es defecto.

---

## 8. Registros creados en el sistema

Todos con `co_currency = USD`, cliente del vendedor `V.0002`, **enviados** (no quedó ninguno en
Guardado) y **verificados en la nube** con
`node automation/db/query.js 4k "SELECT … FROM collection WHERE id_collection > <baseline>"`.
Baseline al inicio: `max(id_collection) = 2628` · 2.502 filas.

| Ref (`id_collection`) | `co_collection` | `co_type` | Cliente | Monto total | Monto final | Comentario | Vínculo | Nube |
|---|---|---|---|---|---|---|---|---|
| **2629** | `1789058063979.0` | 0 · Cobro | C.0060 | **600,00** | 550,00 | `Test-TOL-071918` | — | ✅ **BD-OK** |
| **2630** | `1789058570107.0` | **1 · Anticipo** | C.0060 | **50,00** | 50,00 | `Test-TOL-071918` | `co_original_collection = 1789058063979.0` → **2629** | ✅ **BD-OK** |
| **2631** | `1789059643513.0` | 0 · Cobro | C.0029 | **1.037,50** | 1.027,00 | `Test-TOL-B1` | — (tramo 1: exceso +10,50 dentro de tolerancia, **sin** anticipo) | ✅ **BD-OK** |
| **2632** | `1789059946831.0` | 0 · Cobro | C.0029 | **945,00** | 944,00 | `Test-TOL-C1` | — | ✅ **BD-OK** |
| **2633** | `1789060047902.0` | **1 · Anticipo** | C.0029 | **1,00** | 1,00 | `Test-TOL-C1` | `co_original_collection = 1789059946831.0` → **2632** | ✅ **BD-OK** |

**Estado local coherente** (`automation/db/local-query.js`): los 5 con `st_delivery = 1` e
`id_collection > 0`; `pending_transactions` = **0**; `failed_transactions` sin filas nuevas.

**Documentos consumidos** (quedan comprometidos mientras los cobros estén «Por aprobar»):

| Cliente | Documento | Saldo | Se fue en |
|---|---|---|---|
| C.0060 | FAC 00022034 | 550,00 USD | Ref 2629 |
| C.0029 | FAC 00016791 | 1.027,00 USD | Ref 2631 |
| C.0029 | FAC 00016792 | 944,00 USD | Ref 2632 |

⚠ **C.0060 quedó sin documentos USD libres.** De C.0029 sobra **FAC 00016794 (533,00 USD)**.
Relevos con documentos USD libres, contados en la BD **local del equipo** (que es la que manda):
**C.0010** (11 docs · 2.512 USD) y **C.0538** (9 docs · 4.754 USD, con saldos chicos de 8 a 72 USD,
útiles para bordes pequeños).

---

## 9. Patrones y selectores nuevos

| Patrón / selector | Universal o cliente | Detalle |
|---|---|---|
| 🔑 **La playa se lee en runtime del WebView: `window.__env.WsUrl`** | **universal** | `ServicesService.getWsUrl()` la toma de ahí. Una sola línea de `pg.evaluate` reemplaza deducirla de `claves.env` (que es la config de BUILD, no la de la APK instalada) o del host de los payloads. Confirmó CARIBE sin tocar la UI ni esperar un POST |
| 🔴 **El estado real del gate de Cobros se lee del servicio, no del DOM** | **universal** | `window.ng.getComponent(document.querySelector('app-cobro'))` → `.collectService` (si no está en esa clave, buscar la propiedad que tenga `RangoToleranciaPositiva`). Expone `montoTotalPagar`, `montoTotalPagado`, `lastValidToSend`, `lastSendIssues[].code`, `createAutomatedPrepaid`, `anticipoAutomatico[]` y las VG ya parseadas. Permite barrer 7 importes en un solo cobro sin enviar nada |
| 🔴 **`ion-button.imagenEnviar` NUNCA se deshabilita: el bloqueo se ve al PULSARLO** | **universal** | En 11 mediciones con `lastValidToSend=false` el botón siguió `disabled=false` y `width>0`. **Leer el `disabled` del botón como oráculo de «se puede enviar» da un falso PASS.** El oráculo bueno es `lastSendIssues` (o pulsar y leer el `ion-alert`) |
| 🔑 **Para auditar un fix, leer el CÓDIGO DEL EQUIPO, no el del repositorio** | **universal** | `String(svc.getAutomatedPrepaidActivationThreshold)` devuelve el cuerpo real de la build instalada; `Object.getOwnPropertyNames(Object.getPrototypeOf(svc))` dice qué funciones existen. Fue lo que resolvió F-01 en un minuto: la APK no tenía la función del fix, y el repo local está **por detrás** de la APK |
| 🔴 **Las Variables Globales solo bajan con LOGIN; «Sincronizar» del HOME no las trae** | **universal** (F-04) | Tras guardar en la web hay que re-loguear (~80 s). El oráculo de que llegó es `localStorage.globalConfiguration` |
| **Los `ion-select` del Tab General solo existen DESPUÉS de elegir cliente** | **universal** | `app-cobro-general ion-select` devuelve `[]` en el form recién abierto. Orden obligatorio: **cliente → moneda → comentario → documentos** |
| 🔑 **Poner el cobro en la MONEDA de la tolerancia elimina la conversión** | **universal** | Con `MonedaTolerancia = prepaidRangeCurrency = USD`, llevar el cobro a USD (2.º `ion-select` de `app-cobro-general`) hace que los bordes se midan 1:1. En Bs entran `convertToleranceRangeToCollectionCurrency` y la tasa, y el borde deja de ser exacto. En un cobro **fresco y sin documentos** el cambio de moneda **no dispara** la alerta de reinicio |
| **Los bordes de tolerancia de esta build son INCLUSIVOS (`delta <= limite`)** | **universal** | `computeIsWithinTolerancia` del equipo usa `getRoundedPaymentDelta()` + `<=` en los dos sentidos. Medido: `+49,99` con tope `49,99` **envía**. ⚠ El repositorio local tiene `<` (estricto) en el lado positivo: **otra prueba de que el repo no es la build** |
| **Web · Variables Globales: la fila se identifica por el widget, y el widget delata la precisión** | **cliente / universal-web** | `/pages/variablesConfiguracion` → `#formGlobal:tipoVariable_input = 'C'` → tabla `#formGlobal:tablaConf` → guardar con `#formGlobal:botonGuardar`. **`PrimeFaces.widgets[...].cfg`** da `precision`/`step`/`min`/`max` de cada spinner **sin teclear nada**: `j_idt137` = decimal (precision 2), `j_idt136` = entero (precision 0). Es el diagnóstico más barato de «¿acepta decimales?» |
| ⚠ **El spinner entero se come la coma en el `keypress` y hace clamp a `min` en el `blur`, sin avisar** | **universal-web** | Teclear `0,01` deja `001`, y al salir queda `1`. **Para probar «qué acepta un campo» hay que teclear de verdad** (`pressSequentially`) y leer el valor **antes y después del blur**: un `fill()` se salta el filtro y da un falso «lo aceptó» |
| **`app-home`: SALIR es un `ion-button`, Sincronizar es un `<p>` dentro de un `<a>`** | **universal** | Buscar SALIR solo entre `p`/`ion-label`/`a` **no lo encuentra**. Filtro que funciona: `app-home ion-button, app-home p, app-home ion-label, app-home a` + texto exacto `/^salir$/i` |
| **Documentos: la BD local NO dice cuáles están libres** | **cliente** | `document_sales` del equipo trae `co_collection = null` en los 5 documentos de C.0060, pero el Tab Documentos solo listaba 1: **los otros están comprometidos por cobros «Por aprobar»**. El único inventario fiable de documentos disponibles es **el propio Tab Documentos** |

---

## 10. Para el script de cobros

> Objetivo: que esto se valide desde `automation/playwright/modules/cobros.js` en cada versión, sin
> agente. Todo lo de abajo está probado en esta corrida contra la build 6.6.21.3.

### 10.1 Selectores exactos

**Estables (usar estos):**

| Qué | Selector / ruta | Nota |
|---|---|---|
| Playa en runtime | `window.__env.WsUrl` | pre-vuelo; no depende de la UI |
| VG efectivas | `localStorage.globalConfiguration` (Map serializado: `[[clave,valor],…]`) | ya lo hace `leer-vg-dispositivo.js` |
| Servicio de cobros | `window.ng.getComponent(document.querySelector('app-cobro')).collectService` | **fallback estable**: si esa clave no está, recorrer `Object.keys(comp)` y quedarse con el objeto que tenga `'RangoToleranciaPositiva' in v`. Ya implementado así en `estadoCobro()` |
| Tiles del menú Cobros | `app-cobros ion-button` + `textContent.trim() === 'COBRO' \| 'ANTICIPO/PREPAGO' \| 'BUSCAR'` | requieren `PointerEvent(down/up)` sobre el `shadowRoot button` **y** `mouse.click` en el centro |
| Modal de cliente | `#clienteSelectModal` (`.present()`) | filtra **solo con Enter** tras teclear |
| Fila del cliente en el modal | el `<p>` del nombre dentro del `ion-item` cuyo `innerText` contiene el código | **clic en el `<p>`**, nunca en el centro del `ion-item` (cae en la zona de saldos) |
| Comentario | `ion-input`/`ion-textarea` visible cuyo atributo `label` matchea `/coment/i` | ✅ ancla estable |
| Pestañas | `ion-segment.value = <valor>` + `ionChange`. Valores: **`default`** (General), `documentos`, `pagos`, `total`, `adjuntos` | 🔴 General es `default`, no `general` |
| Checkbox de documento | `app-cobro-documents ion-checkbox` **con `closest('ion-row').innerText` conteniendo el `nu_document`** | ✅ ancla por número de factura |
| Agregar método de pago | `ion-button#eventSelect` (alias `ion-button.pagos-add-method-btn`) | 🔴 **nunca** `#eventModal.present()`: mata el WebView |
| Efectivo en el modal | dentro del `#eventModal` visible, `ion-item` cuyo texto matchea `/Efectivo/i` → su `ion-checkbox` (`checked=true` + `ionChange`) | |
| Aceptar del modal | `#eventModal ion-button.botonAddVerde` (`.click()` directo) | |
| Guardar / Enviar | `ion-button.imagenGuardar` · `ion-button.imagenEnviar` | ⚠ ver 10.4 |
| Atrás | `img.fechaAtras` filtrando **`rect.width>0 && rect.x<100 && rect.y<120`**, clic en `closest('a')` | verificar con `elementFromPoint` que no cae sobre `SALIR` |
| Dirty-guard | `ion-alert` con botones `[Guardar y salir · Salir sin guardar · Cancelar]`, **`message` vacío** | detectar **por botones**, y comparar por **igualdad exacta** |
| SALIR del HOME | `app-home ion-button` con texto exacto `Salir` | **es `ion-button`**, no `<p>` |
| Sincronizar del HOME | `app-home p` con texto exacto `Sincronizar` → clic en su `closest('a')` | |
| Web · tipo de variable | `#formGlobal:tipoVariable_input` = `'C'` + `change` | |
| Web · guardar VG | `#formGlobal:botonGuardar` | |

**Frágiles — usados por falta de ancla mejor, hay que reemplazarlos:**

| Qué | Cómo se resolvió | Por qué es frágil / qué haría falta |
|---|---|---|
| **Moneda del cobro** | **`app-cobro-general ion-select` visibles → índice `[1]`** (`[0]` = Empresa) | Es una **posición**. No tiene `label` ni `formcontrolname` legible. Ancla mejor: el `ion-select` cuyas `ion-select-option` tengan `value.coCurrency`; o pedirle a desarrollo un `id` |
| **Monto del pago** | dentro de `app-cobro-pagos`, el `ion-input` cuyo `<input>` tenga `inputmode="numeric"`; **fallback: índice `[1]`** (`[0]` = Nro. Recibo) | El `inputmode` funcionó 100 % en esta corrida y **debería ser el criterio principal**; el índice `[1]` solo como red |
| **Fila de VG en la web** | `formGlobal:tablaConf:**6**:j_idt137_input` (tol+), `:7:` (tol−), `:10:j_idt136_input` (anticipo) | El número de fila y el `j_idt` **cambian si se agrega o reordena una variable**. Ancla correcta: buscar la fila por el **texto de su descripción** (`/monto máximo de tolerancia positiva/i`, `/monto máximo de tolerancia negativa/i`, `/monto mínimo excedido/i`) — que es lo que ya hace el `PUENTE` de `automation/web/pre-vuelo-cobros.js`. **Reusar ese mapa, no los ids** |

### 10.2 Secuencia mínima para llegar al caso

**Pre-vuelo (una vez por corrida):**
1. `adb forward` a `:9220` (re-mapear si la app se reinició: el socket lleva el PID).
2. Leer `window.__env.WsUrl` → playa. Cotejar contra la esperada; si no coincide, **abortar**.
3. Leer `localStorage.globalConfiguration` → `tolerancia0`, `TipoTolerancia`, `RangoToleranciaPositiva`,
   `RangoToleranciaNegativa`, `MonedaTolerancia`, `automatedPrepaid`, `prepaidRangeAmount`,
   `prepaidRangeCurrency`. **Calcular los bordes con estos valores, nunca con los del YAML.**
4. Si `tolerancia0 === false` o `automatedPrepaid === false` → **N/A**, no FAIL.
5. Si `TipoTolerancia === 1` (porcentaje) → los bordes son `base × % / 100`; el script debe
   contemplarlo o marcar N/A. **Esta corrida solo cubrió `TipoTolerancia = 0` (Importe).**

**Montaje del cobro (12 pasos, sin rodeos):**
1. HOME → tile **Cobros**.
2. `irAHomeCobros()` (back + dirty-guard hasta ver el tile `COBRO`).
3. Clic en **COBRO**; esperar a que haya **≥ 4** `ion-segment-button` visibles (hasta ~10 s).
4. `#clienteSelectModal.present()` → `focus()` en el `input` (**no** clic: lo cierra) → teclear el
   código → **Enter** → clic en el `<p>` del nombre. Reintentar una vez con `y+8` si el modal sigue.
5. **Moneda del cobro → la misma que `MonedaTolerancia`** (2.º `ion-select` de `app-cobro-general`;
   asignar `.value` = el `value` **objeto** de la `ion-select-option`, + `ionChange`).
   Si el cobro es fresco y sin documentos, **no** sale la alerta de reinicio.
6. Comentario (si `requiredComment`): el `ion-input` con `label` `/coment/i`; setter nativo + `input`
   + `ionInput` + `ionChange` + `blur`. **Sin esto las 4 pestañas siguen bloqueadas.**
7. Tab **`documentos`**.
8. Leer la lista y elegir el documento por `nu_document`; **anotar su saldo** = `montoTotalPagar`.
9. Clic real en su `ion-checkbox`.
10. Tab **`pagos`**.
11. `#eventSelect` → marcar **Efectivo** → `.botonAddVerde` → expandir el acordeón
    (`ion-accordion-group.value = <value del ion-accordion>` + `ionChange`).
12. Escribir el monto (ver 10.4) y **leer el estado del servicio**.

**Barrido de los tres tramos (un solo cobro sirve para todos los bordes):**
con `P = montoTotalPagar`, `T+ = RangoToleranciaPositiva`, `T− = RangoToleranciaNegativa`,
`M = prepaidRangeAmount`, escribir sucesivamente y leer tras cada uno:

| # | Monto | Exceso | Esperado (regla del fix) |
|---|---|---|---|
| 1 | `P` | 0 | envía, sin anticipo |
| 2 | `P + T+` | `T+` | envía, sin anticipo (borde inclusivo) |
| 3 | `P + T+ + 0,01` | `T+ + 0,01` | **bloquea** (`TOLERANCIA`) |
| 4 | `P + T+ + M − 0,01` | | **bloquea** |
| 5 | `P + T+ + M` | | **anticipo** + envía |
| 6 | `P − T−` | `−T−` | envía |
| 7 | `P − T− − 0,01` | | **bloquea** |

El caso 5 es el **discriminante de F-01**: si el anticipo aparece antes (en `P + M`), el umbral no
está sumando la tolerancia. Conviene añadir un caso **`P + M`** explícito y afirmar
`createAutomatedPrepaid === false` mientras `M < T+ + M`.
El **discriminante de F-02** es: con `M < T+`, escribir `P + M` y afirmar
`createAutomatedPrepaid === false` (hoy da `true`).

### 10.3 Oráculo de cada caso

| Caso | Se compara | Contra qué |
|---|---|---|
| Umbral efectivo del anticipo | `svc.getAutomatedPrepaidActivationThreshold()` (llamada directa) | `RangoToleranciaPositiva + prepaidRangeAmount` leídos de `localStorage.globalConfiguration` |
| Tramo 1 (dentro de tolerancia) | `svc.lastValidToSend === true` **y** `svc.lastSendIssues.length === 0` **y** `svc.createAutomatedPrepaid === false` | — |
| Tramo 2 (bloquea) | `svc.lastValidToSend === false` **y** `svc.lastSendIssues.map(i=>i.code)` contiene `'TOLERANCIA'` | — |
| Tramo 3 (anticipo) | `svc.createAutomatedPrepaid === true` **y** `svc.anticipoAutomatico.length === 1` **y** `svc.lastValidToSend === true` | — |
| Mensaje de bloqueo | pulsar `ion-button.imagenEnviar` → `.alert-message` del `ion-alert` activo | `"El monto pagado está fuera del rango de tolerancia permitido."` |
| Exceso calculado | `svc.montoTotalPagado − svc.montoTotalPagar` | el exceso que se pretendía escribir (tolerancia `< 0,005`) |
| Diferencia en pantalla | `span` hoja con `/Diferencia/` dentro de `app-cobro-pagos` → texto + `style` (`red`/`blue`) | el exceso, con formato es-VE |
| Anticipo llegó a la nube | `node automation/db/query.js 4k "SELECT id_collection, co_type, nu_amount_total, co_original_collection FROM collection WHERE id_collection > <baseline> ORDER BY id_collection"` | debe haber **2 filas**: `co_type=0` con `nu_amount_total = pago` y `co_type=1` con `nu_amount_total = exceso` y `co_original_collection = co_collection del padre` |
| Envío realmente salió | `node automation/db/local-query.js "SELECT id_collection, st_delivery FROM collections WHERE co_collection='<co>'"` | `st_delivery = 1` **e** `id_collection > 0`; y `SELECT count(*) FROM pending_transactions` = 0 |
| VG llegó al equipo | `localStorage.globalConfiguration` | el valor guardado en la web |
| Decimales en la web | `PrimeFaces.widgets[<widgetVar>].cfg.precision / step / min` | `precision ≥ 2`, `step ≤ 0,01`, `min = 0` |
| Texto del anticipo | `.alert-message` del `ion-alert` | debe **contener el monto**; si el tag `COB_MSG_AUTOMATED_PREPAID` no trae `{amount}`, es F-05 |

**Baseline obligatorio antes de crear nada:**
`SELECT max(id_collection) AS maxid, count(*) FROM collection` (nube) y
`SELECT co_client, nu_document, nu_balance FROM document_sales WHERE co_currency='<moneda>' AND nu_balance>0` (local).

### 10.4 Qué NO se puede automatizar (o cuesta caro) y por qué

- **El campo Monto exige teclado real y es acumulativo en centavos.** No sirve `fill()` ni
  `inputmode`-setter: hay que `focus()` por JS, **`Backspace` ×14**, y `keyboard.type('<dígitos>')`
  **sin coma** (599,98 → `"59998"`). 🔴 **Teclear la coma rompe la acumulación.** Después,
  `blur()` + `Event('blur')` o el total no recalcula.
- **`ion-button.imagenEnviar` nunca aparece deshabilitado**, así que el script **no puede** usar el
  `disabled` como oráculo: tiene que leer `lastSendIssues` o pulsar y leer la alerta.
- **Cambiar una VG cuesta ~80 s de re-login** (F-04) y no hay atajo desde el equipo. Un script que
  barra varias configuraciones debe **agrupar todos los casos de cada configuración** y hacer un solo
  re-login por config, no uno por caso.
- **Los documentos se consumen.** Un cobro enviado deja su factura «Por aprobar» y **desaparece del
  Tab Documentos** hasta que alguien la apruebe o la rechace en la web. La BD local **no** lo refleja
  (`co_collection` sigue en `null`). ⇒ el script **no puede** elegir el documento desde la BD: tiene
  que leer el Tab Documentos, y debe **fallar con un mensaje claro** («cliente sin documentos libres»)
  en vez de seguir con otro. Con ~2 envíos por corrida, un cliente de 5 facturas dura 2-3 corridas.
- **La tasa (870 BS/USD) y el catálogo de descuentos cambian solos.** Por eso conviene hacer el caso
  **en la moneda de la tolerancia** y no depender de la conversión.
- **Pago parcial deshabilita el anticipo** (`existPartialPayment` corta `resolveAutomatedPrepaid`).
  No mezclar los dos casos en el mismo cobro.
- **Nada de esto aplica al cobro tipo Anticipo (`co_type=1`) ni a Retención (`co_type=2`)**: el gate
  arranca con `if (coTypeModule !== '0') return false`. Marcar N/A explícito.
- **La build instalada puede no ser la del repositorio.** El script debería **afirmar la versión**
  (`localStorage.versionApp`) y, para fixes de lógica, comprobar por `String(fn)` que la función
  esperada existe, en vez de deducirlo del `git log`.

### 10.5 Datos de partida que el caso necesita

| Qué | Valor usado | Hay que dejarlo preparado |
|---|---|---|
| Vendedor | `V.0002zonacentral` / `123456` (bloque `# Cliente: 4k`) | — |
| Cliente con documentos USD libres | **C.0029** (queda FAC 00016794, 533,00 USD) · relevos **C.0010** (11 docs) y **C.0538** (9 docs, saldos de 8 a 72 USD) | ⚠ **C.0060 quedó sin documentos USD libres** |
| Moneda del cobro | **USD** (= `MonedaTolerancia`) | requiere `multiCurrencyCollection = true` ✔ |
| Configuración | `tolerancia0=true` · `TipoTolerancia=0` · `automatedPrepaid=true` · `cobroPrepago=true` · `requiredCollectionAttachments=false` | ✔ todo puesto. **Si se pone `requiredCollectionAttachments=true`, el caso deja de poder enviarse** y hay que dejar en Guardado |
| Comentario | obligatorio (`requiredComment=true`); usar un texto **único por corrida** | es el oráculo para encontrar la fila en la nube |
| Tolerancia / anticipo | tol+ **49,99** · tol− **10,00** · anticipo **50** | ⚠ con estos valores **el tramo 2 por exceso NO existe**. Para ejercitarlo hay que bajar tol+ (p. ej. `10,50`) **y volver a loguear** |
| BD | `automation/db/query.js 4k` (nube, solo lectura) y `automation/db/local-query.js` (SQLite del equipo) | ✔ ambos operativos |

---

## 11. Nota de método

Todas las mediciones de comportamiento se hicieron **sobre el dispositivo**, con la configuración
leída **del equipo**. El repositorio local (`feature/qa-guiones-regresion`) **no coincide con la APK
instalada** —le faltan `getRoundedPaymentDelta` y `getMoneyDecimalPlaces`, y le sobra la función del
fix— así que el código del repo se usó solo para **formular hipótesis**, y cada una se cerró leyendo
el bundle vivo. Esa distinción es la que evitó reportar el fix como presente.
