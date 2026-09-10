# Tolerancia y anticipo automático · 2.ª pasada contra `main` · IMPORTADORA 4K

| Parámetro | Valor |
|-----------|-------|
| RUN_ID | `fixes_cobros_20260910` · informe **02** (la 1.ª pasada es `01-tolerancia-y-anticipo.md`) |
| Cliente | **4k** · empresa **DIESE · GRUPO 4K** (empresa única) · base `4k` |
| Playa | **CARIBE** — `http://denariocaribe.ddns.net:8081/PremiumWS/services/` · leída en runtime de `window.__env.WsUrl` |
| Web | `http://denariocaribe.ddns.net:8080/DenarioPremium` |
| Dispositivo | Infinix X6728 · `com.kiberno.denarioPremiumPro` **v6.6.21.3** · db **23** · `window.ng = true` |
| Vendedor | `V.0002` — ANGEL BETANCOURT (`idUser` 300) · empresa de las 6 filas creadas: **DIESE** ✔ |
| Fecha | 2026-09-10 |
| Resultado | **build = `main` ✔** · 4 configuraciones medidas con bordes exactos · **3 defectos** (1 de ellos serio, D-03) · **1 decisión de producto pendiente** · 2 fixes confirmados |

---

## 0. Resumen ejecutivo

1. **El bundle del equipo ES `main`.** `getAutomatedPrepaidActivationThreshold()` devuelve
   `prepaidRangeAmount` a secas, igual que `origin/main`, y el bundle trae además
   `hasConfirmedDiscountRemnantPrepaid` — la función del commit **más nuevo** de main
   (`9d72931f`, hoy 11:16). **Se puede medir.** (§1)

2. **Cuando tolerancia y anticipo se solapan, MANDA EL ANTICIPO.** Y no por un descuido de orden:
   `main` **suprime explícitamente** el bloqueo por tolerancia positiva en cuanto hay anticipo
   (`if (this.createAutomatedPrepaid && delta > 0) … return null`, más
   `isOnlyToleranciaExcessForPrepaid` en el gate). El hallazgo de la 1.ª pasada (Ref 2633)
   **se confirma**: un exceso DENTRO de tolerancia genera un anticipo real. (§3, §5)

3. **La regla efectiva del lado positivo es una sola línea:**
   > el techo de tolerancia positiva **solo gobierna los excesos por debajo de `prepaidRangeAmount`**.
   > A partir de `prepaidRangeAmount` el cobro **siempre** se envía, con anticipo, mire lo que mire la tolerancia.

   De ahí salen las cuatro configuraciones medidas, sin sorpresas y con bordes exactos. (§3)

4. **Bajar el mínimo del anticipo NO cierra la zona gris: la sustituye por un solapamiento total.**
   Con `prepaidRangeAmount = 0,01` el **único** importe que se envía directo es la diferencia
   exacta de 0,00: **un céntimo de exceso ya genera un anticipo**, y hay una fila en la nube que lo
   prueba (**Ref 2639, 0,01 USD**). La receta del fix original («baja el mínimo y se acaba la zona
   gris») solo tenía sentido con la lógica de la SUMA, que fue revertida. (§3.d, §5)

5. **Los decimales de la web YA ESTÁN desplegados** — y el fix es real: `prepaidRangeAmount` pasó de
   spinner entero (`precision 0`, `min 1`) a decimal (`precision 2`, `step 0,01`, `min 0`). Acepta
   `0,01` y `0`, y **lo que se guarda llega íntegro al equipo** (`0,01` → `"0.01"`). **Pero el
   rechazo silencioso NO se corrigió**: cambió de forma, no de naturaleza. En particular
   **`0.01` escrito con PUNTO se guarda como `1,00`** — un error de ×100 sin un solo aviso. (§4, D-01)

6. **Una VG cambiada en la web llega al equipo con login nuevo en ~11 s**, no en ~80 s.
   Medido 5/5. Lo caro no es la bajada: es que la app tarda **~50 s más** en volver de
   `/synchronization` a HOME. (§6)

7. 🔴 **Hallazgo no buscado, y el más serio de la corrida: la pantalla de Variables Globales
   muestra valores atrasados y los reescribe sola.** Abrir la pantalla y elegir el tipo «Cobros»
   —**sin pulsar Guardar**— revirtió `prepaidRangeAmount` de `50` a `0,01` un segundo después
   (auditoría id 273). Y un solo clic en Guardar deja **dos** escrituras en la auditoría.
   Salió a la luz porque la BD dejó de coincidir con la web. (D-03)

---

## 1. La comprobación de build — contra qué se está midiendo

> Esto es lo que invalidó la 1.ª pasada, así que va primero y con las dos fuentes enfrentadas.

### 1.a Qué dice `main`

`git log origin/main -- src/app/services/collection/` (los 6 commits más recientes):

| Commit | Fecha | Qué hace |
|---|---|---|
| `9d72931f` | **10/09 11:16** | remanentes de descuento con opción de anticipo |
| `c0e971fd` | 09/09 11:04 | pagos parciales no heredan estado del documento anterior |
| **`72177ec6`** | **09/09 10:07** | **umbral = solo `prepaidRangeAmount`** ← revierte la suma |
| `b3d4bb43` | 09/09 09:41 | tolerancia absoluta con redondeo y comparaciones inclusivas |
| `d27ad6bc` | 09/09 09:23 | límites máximos de descuento |
| `26dc93c0` | 04/09 14:39 | *(el que SÍ sumaba tolerancia + prepaid — **revertido** por `72177ec6`)* |

`72177ec6` borra `getPositiveToleranceCeilingInCollectionCurrency()` y deja:

```ts
// Umbral mínimo de exceso para activar anticipo automático = prepaidRangeAmount
// (monto mínimo excedido configurado; no se suma a tolerancia positiva).
private getAutomatedPrepaidActivationThreshold(): number {
  const prepaidMin = this.parseConfigDecimal(this.prepaidRangeAmount);
  return Number(prepaidMin.toFixed(this.getMoneyDecimalPlaces()));
}
```

⚠ **Ojo con el detalle que la 1.ª pasada no miró:** main tiene **dos commits POSTERIORES** a
`72177ec6`. No basta con comprobar `72177ec6`; hay que comprobar la punta.

### 1.b Qué dice el bundle vivo del equipo

Leído por CDP con `fetch('http://localhost/main.js')` (5.360.482 bytes, **sin minificar**, con los
comentarios intactos — es un build de desarrollo, y eso es lo que permite el cotejo literal):

```js
getAutomatedPrepaidActivationThreshold() {
  const prepaidMin = this.parseConfigDecimal(this.prepaidRangeAmount);
  return Number(prepaidMin.toFixed(this.getMoneyDecimalPlaces()));
}
```

| Comprobación | Bundle del equipo | `origin/main` | ¿Coincide? |
|---|---|---|---|
| `getAutomatedPrepaidActivationThreshold` | `prepaidRangeAmount` a secas | ídem | ✅ |
| `getPositiveToleranceCeilingInCollectionCurrency` | **0 ocurrencias** | no existe | ✅ |
| `computeIsWithinTolerancia` | `<=` en ambos sentidos | ídem, literal | ✅ |
| `hasConfirmedDiscountRemnantPrepaid` | **7 ocurrencias** | 7, sale de `9d72931f` (hoy) | ✅ |
| `parseConfigDecimal` | normaliza coma y punto | ídem | ✅ |

✅ **VEREDICTO: el bundle instalado es `origin/main` a la punta** (a o después de `9d72931f`;
el HEAD real, `4875df0f`, solo toca `BUGS.md` y reglas, no código). **Se puede medir.**

🔑 **Y de paso queda el oráculo barato para la próxima vez**, que no depende del `git log`:
el bundle viene sin minificar, así que `String(svc.getAutomatedPrepaidActivationThreshold)`
—o un `fetch` de `main.js` y un `indexOf`— devuelve **el código que está corriendo**.

### 1.c Confirmación en vivo, no solo en el texto

Con `prepaidRangeAmount = 1` y `RangoToleranciaPositiva = 49,99` en el equipo,
`svc.getAutomatedPrepaidActivationThreshold()` llamado directamente devolvió **`1`**
(no `50,99`, que sería la suma). Con `prepaidRangeAmount = 50` devolvió **`50`**; con `0,01`,
**`0.01`**. El umbral es el mínimo configurado, y nada más.

---

## 2. Configuración de partida — leída del EQUIPO

> Los valores efectivos los manda el equipo (`localStorage.globalConfiguration`), no la BD ni el YAML.

🔴 **La partida NO era la que decía el encargo.** El encargo daba `prepaidRangeAmount = 50`;
el equipo **y la web** decían **`1`**. **El deshacer de la 1.ª pasada nunca llegó a guardarse.**

| VG | Encargo decía | **Equipo, de verdad (14:05)** | **Final dejado (14:43)** |
|---|---|---|---|
| `tolerancia0` | true | `true` | `true` |
| `TipoTolerancia` | 0 | `0` (Importe) | `0` |
| `RangoToleranciaPositiva` | 49.99 | `49.99` ✔ | **`49.99`** |
| `RangoToleranciaNegativa` | 10 | `10` ✔ | **`10`** |
| **`prepaidRangeAmount`** | **50** | **`1`** ❌ | **`50`** |
| `MonedaTolerancia` · `prepaidRangeCurrency` · `prepaidCurrency` | USD | `USD` | `USD` |
| `automatedPrepaid` · `cobroPrepago` | true | `true` | `true` |
| `requiredCollectionAttachments` | false | `false` — los cobros se envían sin adjunto (3/3) | `false` |
| `requiredComment` | true | `true` | `true` |
| `userCanSelectIGTF` | false | `false` ⇒ IGTF **N/A**, no FAIL | `false` |
| `colletionPayment` | — | `true-true-true-true-true-true` (6 métodos; era `…-false-true`) | ídem |

Todas las escrituras quedaron anotadas **en el momento** en
`automation/clientes/_escrituras-de-prueba.md`, sección IMPORTADORA 4K, con cómo se deshacen, y la
configuración final anotada al cerrar.

### 2.a Estado en el que queda la configuración — verificado por partida doble

Por D-03 (§9) **no basta con mirar la web**: la pantalla puede mostrar un valor que no es el vigente.
El cierre se verificó en las **dos** fuentes que sí mandan:

| VG | `global_configuration.valor` (BD) | `localStorage.globalConfiguration` (EQUIPO) |
|---|---|---|
| `RangoToleranciaPositiva` | **`49.99`** | **`49.99`** |
| `RangoToleranciaNegativa` | **`10`** | **`10`** |
| `prepaidRangeAmount` | **`50`** | **`50`** |
| `MonedaTolerancia` · `prepaidRangeCurrency` · `prepaidCurrency` | `USD` · `USD` · `USD` | ídem |
| `TipoTolerancia` · `tolerancia0` · `automatedPrepaid` | `0` · `true` · `true` | ídem |

✅ **Coinciden.** Última auditoría de escritura: id **274** (`prepaidRangeAmount 0.01 → 50`).
Último login del equipo que las bajó: **14:43:27**.
⚠ **No volver a abrir `/pages/variablesConfiguracion` sin comprobar la BD después**: por D-03,
abrirla puede revertir `prepaidRangeAmount` otra vez.

---

## 3. Las configuraciones, con los bordes exactos

> Las **tres** que pedía el encargo, más una **cuarta** (§3.d) con el mínimo del anticipo en `0,01`,
> que es la que desmonta la receta del fix original.

**Método.** Un solo cobro por configuración; se teclea el monto y se lee el **servicio**, no el DOM:
`computeIsWithinTolerancia()`, `getPrepaidExcessAmount()`, `getAutomatedPrepaidActivationThreshold()`
y `shouldCreateAutomatedPrepaidOnSend()` son las mismas funciones que usa Enviar. Los envíos reales
son la confirmación, no la medición. Cobro siempre en **USD** = `MonedaTolerancia` ⇒ los bordes se
miden **1:1**, sin conversión de por medio.

### 3.a Configuración 1 — tolerancia POR DEBAJO del mínimo (`tol+ 10,00` · `ant 50,00`) → **hay hueco**

Cliente C.0538, `N/D`→`FAC 00020300`, saldo **265,45 USD**.

| Monto | Δ | `within` | `excess` | `thr` | `should` | `validToSend` | `issues` | Qué pasa |
|---|---|---|---|---|---|---|---|---|
| 265,45 | 0 | true | 0 | 50 | false | true | `[]` | envía directo |
| 275,45 | **+10,00** | true | 10,00 | 50 | false | true | `[]` | ✅ **último que envía directo** |
| 275,46 | **+10,01** | false | 10,01 | 50 | false | **false** | **`['TOLERANCIA']`** | 🔴 **primero que BLOQUEA** |
| 315,44 | **+49,99** | false | 49,99 | 50 | false | false | `['TOLERANCIA']` | 🔴 **último que bloquea** |
| 315,45 | **+50,00** | **false** | 50,00 | 50 | **true** | **true** | `[]` | ✅ **primero que hace ANTICIPO** |
| 255,45 | −10,00 | true | — | — | false | true | `[]` | envía directo |
| 255,44 | −10,01 | false | — | — | false | false | `['TOLERANCIA']` | bloquea |

> **Hueco medido: `+10,01` … `+49,99`** — ancho **39,99** = `prepaidRangeAmount − tol+ − 0,01`.
> Confirmado a mano: al pulsar Enviar con `+10,01` sale
> *«El monto pagado está fuera del rango de tolerancia permitido.»*
> Confirmado en la nube: con `+50,00` → **Ref 2636 + anticipo 2637 (50,00 USD)**.

### 3.b Configuración 2 — tolerancia = mínimo − 0,01 (`tol+ 49,99` · `ant 50,00`) → **sin hueco**

Cliente C.0538, `N/D 10000202`, saldo **11,80 USD**.

| Monto | Δ | `within` | `excess` | `thr` | `should` | Qué pasa |
|---|---|---|---|---|---|---|
| 11,80 | 0 | true | 0 | 50 | false | envía directo |
| 61,78 | +49,98 | true | 49,98 | 50 | false | envía directo |
| 61,79 | **+49,99** | true | 49,99 | 50 | false | ✅ **último que envía directo** |
| 61,80 | **+50,00** | false | 50,00 | 50 | **true** | ✅ **primero que hace ANTICIPO** |
| 1,80 | −10,00 | true | — | — | false | envía directo |
| 1,79 | −10,01 | false | — | — | false | bloquea `TOLERANCIA` |

> **Banda que bloquea por exceso: NINGUNA.** `+49,99` y `+50,00` son **contiguos**: lo último que
> envía directo y lo primero que hace anticipo se tocan. Es la única de las tres en la que la
> tolerancia positiva hace de verdad su trabajo y no queda ningún importe muerto.

### 3.c Configuración 3 — tolerancia POR ENCIMA del mínimo (`tol+ 49,99` · `ant 1,00`) → **se solapan**

Cliente C.0029, `FAC 00016794`, saldo **533,00 USD**.

| Monto | Δ | `within` | `excess` | `thr` | `should` | `validToSend` | Qué pasa |
|---|---|---|---|---|---|---|---|
| 533,00 | 0 | true | 0 | 1 | false | true | envía directo |
| 533,99 | **+0,99** | true | 0,99 | 1 | false | true | ✅ **último que envía directo** |
| 534,00 | **+1,00** | **true** | 1,00 | 1 | **true** | true | 🔴 **primero que hace ANTICIPO — y está DENTRO de tolerancia** |
| 582,99 | +49,99 | true | 49,99 | 1 | true | true | anticipo (dentro de tolerancia) |
| 583,00 | **+50,00** | **false** | 50,00 | 1 | true | **true**, `issues: []` | 🔴 **fuera de tolerancia y AUN ASÍ envía**, con anticipo |
| 523,00 | −10,00 | true | — | — | false | true | envía directo |
| 522,99 | −10,01 | false | — | — | false | false | bloquea `TOLERANCIA` |

> **Bordes: el mayor exceso que se envía directo es `+0,99`; el menor que genera anticipo es `+1,00`.**
> El borde **no está en la tolerancia (49,99): está en `prepaidRangeAmount` (1,00)**.
> **Banda que bloquea por exceso: NINGUNA** — y no porque no haga falta, sino porque
> **el anticipo se la come entera**: los 48,99 que van de `+1,00` a `+49,99` estaban dentro de
> tolerancia y ahora son anticipos.
>
> ✅ **Confirmado en la nube: Ref 2634 (534,00 USD, dif 1,00) + anticipo Ref 2635 (1,00 USD)**,
> `co_original_collection` apuntando al cobro padre. **Es exactamente lo que la 1.ª pasada vio en
> Ref 2633: se reproduce en esta build.**

### 3.d Configuración 3 llevada al extremo — `tol+ 49,99` · `ant 0,01` → **solapamiento TOTAL**

> Añadida a petición del coordinador, ahora que la web admite decimales. Es la que desmonta la
> receta del fix original.

Cliente C.0538, `N/D 10000202`, saldo **11,80 USD**. `threshold` leído en vivo = **`0.01`**.

| Monto | Δ | `within` | `excess` | `should` | Qué pasa |
|---|---|---|---|---|---|
| 11,80 | **0,00** | true | 0 | false | ✅ **el ÚNICO caso que envía directo** |
| 11,81 | **+0,01** | **true** | 0,01 | **true** | 🔴 **un céntimo ya genera ANTICIPO** |
| 11,82 | +0,02 | true | 0,02 | true | anticipo |
| 21,80 | +10,00 | true | 10,00 | true | anticipo |
| 61,79 | +49,99 | true | 49,99 | true | anticipo |
| 61,80 | +50,00 | false | 50,00 | true | anticipo (y envía igual, fuera de tolerancia) |
| 1,80 | −10,00 | true | — | false | envía directo |
| 1,79 | −10,01 | false | — | false | bloquea `TOLERANCIA` |

> ✅ **Confirmado en la nube: Ref 2638 (11,81 USD, dif 0,01) + anticipo Ref 2639 de 0,01 USD.**
> **Un anticipo de un céntimo es un documento real en la base de datos del cliente.**
>
> 🔑 **Con `prepaidRangeAmount = 0,01` la tolerancia positiva queda completamente desactivada:**
> el 100 % de la banda `0,01 … 49,99` —que el administrador configuró como «diferencias que se
> aceptan y se envían»— pasa a generar documentos de anticipo. No se cerró una zona gris:
> se cambió «no puedo enviar» por «envío, pero te dejo un documento por cada céntimo».

### 3.e Las cuatro, de un vistazo

Con `T+` = tolerancia positiva y `M` = `prepaidRangeAmount`, el lado positivo es siempre:

| Exceso | Qué manda | Resultado |
|---|---|---|
| `0 … min(T+, M−0,01)` | tolerancia | **envía directo** |
| `T+ + 0,01 … M − 0,01` (solo existe si **T+ < M**) | tolerancia | **BLOQUEA** ← el hueco |
| `≥ M` | **anticipo** (la tolerancia ni se consulta) | **envía + anticipo** |

| Configuración | Relación | Último directo | Banda que bloquea | Primero con anticipo |
|---|---|---|---|---|
| **1** · tol 10,00 · ant 50,00 | `T+ < M` | **+10,00** | **+10,01 … +49,99** (39,99) | **+50,00** |
| **2** · tol 49,99 · ant 50,00 | `T+ = M − 0,01` | **+49,99** | **ninguna** (contigua) | **+50,00** |
| **3** · tol 49,99 · ant 1,00 | `T+ > M` | **+0,99** | **ninguna** (solapada) | **+1,00** |
| **3-extremo** · tol 49,99 · ant 0,01 | `T+ ≫ M` | **+0,00** | **ninguna** (solapada del todo) | **+0,01** |

**El lado negativo es ajeno a todo esto**: en las cuatro configuraciones el borde estuvo en
`−10,00` (envía) / `−10,01` (bloquea `TOLERANCIA`). El anticipo no lo toca — `getPrepaidExcessAmount()`
devuelve 0 cuando el excedente es ≤ 0.

**Bordes inclusivos confirmados** (`delta <= limite`): `+10,00` con tope 10,00 envía; `+49,99` con
tope 49,99 envía; `−10,00` con tope 10,00 envía. Coincide con `computeIsWithinTolerancia` de main.

---

## 4. Decimales en la web — el fix SÍ está desplegado

Ruta: `/pages/variablesConfiguracion` → `#formGlobal:tipoVariable_input = 'C'` → `#formGlobal:tablaConf`
→ `#formGlobal:botonGuardar`.

### 4.a El widget cambió

| VG | 1.ª pasada | **Hoy** | Veredicto |
|---|---|---|---|
| `RangoToleranciaPositiva` | `j_idt137` · prec **2** · step 0,01 · min 0 | igual | sin cambio |
| `RangoToleranciaNegativa` | `j_idt137` · prec **2** · step 0,01 · min 0 | igual | sin cambio |
| **`prepaidRangeAmount`** | **`j_idt136`** · prec **0** · step **1** · **min 1** | **`j_idt137`** · prec **2** · step **0,01** · **min 0** · max 10.000 | ✅ **CAMBIÓ: ahora es decimal** |

### 4.b Qué admite de verdad, tecleado carácter a carácter

> **Nivel de evidencia, dicho por delante.** El barrido tecleado solo resultó **reproducible en
> `prepaidRangeAmount`** (tras un clic real en el campo). En las dos tolerancias el mismo barrido
> **no se pudo reproducir hoy**: el spinner descartó la entrada sintética y restauró el valor
> guardado en los 8 intentos. **No lo doy por medido y no lo reporto como resultado.** Lo que sí
> está medido de las tres es el `cfg` del widget y el viaje de ida y vuelta de un decimal real
> (§4.a y §4.c). Para cerrar el hueco haría falta **teclear a mano**, que es una prueba de dos
> minutos para la QA.

**`prepaidRangeAmount` — medido, con clic real previo:**

| Se teclea | Pasa el filtro | En el campo | **Tras blur** | Interno | ¿Avisa? | Veredicto |
|---|---|---|---|---|---|---|
| `0,01` | `0,01` | `0,01` | **`0,01`** | 0.01 | — | ✅ **acepta decimales** (antes → `1`) |
| `0` | `0` | `0` | **`0,00`** | 0 | — | ✅ **acepta el 0** (antes → `1`) |
| `0,50` | `0,50` | `0,50` | **`0,50`** | 0.5 | — | ✅ |
| **`0.01`** (punto) | `0.01` | `0.01` | **`1,00`** ❌ | 1 | ❌ **no** | 🔴 **×100 en silencio** (el punto es separador de MILES) |
| `-1` | `-1` | `-1` | **`0,00`** | 0 | ❌ no | clamp mudo a `min` |
| `0,001` | `0,001` | `0,001` | **`0,00`** | **0.001** ❌ | ❌ no | muestra `0,00` pero el interno queda `0.001`: **desincronizado** |
| `99999` | `99999` | `99999` | **`10.000,00`** | 10000 | ❌ no | clamp mudo a `max` |

**Se comprobó explícitamente** que tras cada blur no hay `.ui-message-error`, `.ui-messages-error`,
`.ui-growl-message` ni `.ui-state-error`: **vacío en los cuatro casos de rechazo**. Y el Guardar
responde *«Configuración guardada exitosamente»* con el valor ya alterado.

**Las dos tolerancias — lo que sí se puede afirmar:**

| Campo | `precision` / `step` / `min` / `max` | Separadores | Decimal guardado y verificado hoy |
|---|---|---|---|
| `RangoToleranciaPositiva` | 2 / 0,01 / **0** / 100.000 | dec `,` · miles `.` | **`49,99`** → BD `49.99` → equipo `"49.99"` ✔ |
| `RangoToleranciaNegativa` | 2 / 0,01 / **0** / 100.000 | dec `,` · miles `.` | **`10,00`** → BD `10` → equipo `"10"` ✔ |
| `prepaidRangeAmount` | 2 / 0,01 / **0** / 10.000 | dec `,` · miles `.` | **`0,01`** → BD `0.01` → equipo `"0.01"` ✔ |

**Los tres son hoy el mismo componente** (`j_idt137`, misma configuración salvo el `max`), así que
el comportamiento del punto como separador de miles —y el rechazo mudo— **es el mismo código** en
los tres. La 1.ª pasada ya había guardado `10,50` y `0,01` en las dos tolerancias de punta a punta.
⇒ **las tres admiten 2 decimales y el 0**; lo que falta por confirmar a mano es solo si las
tolerancias avisan al corregir la entrada, y no hay ninguna razón para pensar que sí.

### 4.c ¿Llega al equipo lo que guarda la web?

**Sí, íntegro.** Comprobado de punta a punta, con la BD como testigo intermedio:

| Guardado en la web | En `global_configuration.valor` | Llega al equipo como | Lo usa el móvil como |
|---|---|---|---|
| `10,00` / `50,00` | `10` / `50` | `"10"` / `"50"` | 10 / 50 |
| `49,99` | `49.99` | `"49.99"` | 49.99 |
| **`0,01`** | **`0.01`** | **`"0.01"`** | **0.01** ✔ `threshold` en vivo = `0.01` |

La coma se normaliza a punto en el almacenamiento y en el transporte, y `parseConfigDecimal` del
móvil acepta las dos formas. **El decimal no se pierde en ningún tramo.**

🔑 **Y de paso, un oráculo que la 1.ª pasada daba por imposible:**
**`global_configuration.valor` SÍ trae los valores reales** de estas variables (`49.99`, `10`, `50`,
`USD`, `0`), no un catálogo con `valor='true'`. Coincidió con el equipo en las 6 lecturas de hoy.
⇒ **Se puede usar como oráculo barato**, sin abrir la web ni re-loguear. Y
**`global_configuration_audit`** (`na_variable`, `old_value`, `new_value`, `da_update`) da el
historial exacto de quién cambió qué y cuándo — es lo que permitió detectar D-03.

---

## 5. ¿Quién manda cuando se solapan? — el mecanismo, en el código de main

No es un orden de validación mal puesto: **está escrito a propósito, en dos sitios**.

**1) Al construir el issue de tolerancia** (`collection-logic.service.ts`, ~línea 3886):

```ts
const delta = Number(this.montoTotalPagado) - Number(this.montoTotalPagar);
if (this.createAutomatedPrepaid && delta > 0) {
  // Exceso con anticipo automático: no bloquear por tolerancia positiva.
  if (this.isWithinToleranciaOrExactOrPartialRules() || delta > 0) {
    return null;               // ← no se emite TOLERANCIA, pase lo que pase
  }
}
```

⚠ La condición interna `(… || delta > 0)` es **siempre verdadera** dentro de ese `if`, porque el
`if` externo ya exige `delta > 0`. El primer término es código muerto: **basta con que haya
anticipo y exceso para que la tolerancia positiva no se evalúe**.

**2) Y como segundo cinturón, en el gate** (~línea 3062):

```ts
public isOnlyToleranciaExcessForPrepaid(issues) {
  return issues.length === 1
    && issues[0].code === 'TOLERANCIA'
    && this.createAutomatedPrepaid
    && (Number(this.montoTotalPagado) - Number(this.montoTotalPagar)) > 0;
}
```

Y `createAutomatedPrepaid` se pone a `true` en cuanto `prepaidExcess >= threshold`, es decir
**en cuanto el exceso llega a `prepaidRangeAmount`**. De ahí la regla de §3.e, y de ahí que en la
configuración 3 no quede ninguna banda que bloquee.

> 🔑 **Lo que hay que llevarle a desarrollo no es «no funciona».** Es esto:
> **`26dc93c0` (04/09) hacía que mandara la TOLERANCIA** —sumaba el techo al umbral, así que el
> anticipo solo entraba *después* de agotar la tolerancia y los dos tramos encajaban sin solaparse—
> **y `72177ec6` (09/09) lo revirtió, con lo que ahora manda el ANTICIPO** y la tolerancia positiva
> queda subordinada. Las dos son coherentes consigo mismas. **¿Cuál es la querida?**
> De la respuesta depende si `prepaidRangeAmount < RangoToleranciaPositiva` es una configuración
> legítima o una que la web debería impedir.

---

## 6. Cuánto tarda una VG en llegar al equipo

Confirmado que **«Sincronizar» del HOME no las baja**: solo bajan con **login nuevo**.
Pero el número de la 1.ª pasada (~80 s) hay que corregirlo:

| Medición | Salir → login | Submit → VG en `localStorage` | **Total** | App de vuelta en HOME |
|---|---|---|---|---|
| 1 (tol 10 · ant 50) | 6 s | ~3 s | **12 s** | +48 s |
| 2 (tol 49,99) | 6 s | ~3 s | **12 s** | +56 s |
| 3 (ant 0,01) | 5 s | ~3 s | **11 s** | +56 s |
| 4 (restaurar) | 5 s | ~3 s | **11 s** | — |

> **La VG está en el equipo a los ~11-12 s del submit** (oráculo: `localStorage.globalConfiguration`).
> Lo que cuesta ~50 s más es que la app termine `/synchronization` y vuelva a HOME. Para presupuestar:
> **~70 s por cambio de configuración**, no 80, y el grueso es la sincronización, no la bajada.

---

## 7. Tabla de veredictos

| # | Caso | Config | Esperado | Medido | Veredicto |
|---|---|---|---|---|---|
| 1 | Build = `main` | — | `thr` = `prepaidRangeAmount` | `thr` = 1 / 50 / 0.01 según VG; sin `getPositiveToleranceCeiling…` | ✅ **PASS** |
| 2 | Hueco cuando `T+ < M` | 1 | banda `10,01…49,99` | **`10,01…49,99`** (39,99) | ✅ **PASS** |
| 3 | Sin hueco cuando `T+ = M−0,01` | 2 | `49,99` y `50,00` contiguos | contiguos, banda vacía | ✅ **PASS** |
| 4 | Solapamiento: ¿quién manda? | 3 | *(pregunta abierta)* | **manda el ANTICIPO**: `+1,00` dentro de tolerancia → Ref 2635 | ⚠ **DECISIÓN DE PRODUCTO** (§5, P-01) |
| 5 | Borde exacto del solapamiento | 3 | — | directo hasta **`+0,99`** · anticipo desde **`+1,00`** | ✅ medido |
| 6 | Solapamiento total | 3-ext | — | directo **solo** en `0,00` · anticipo desde **`+0,01`** → Ref 2639 | ⚠ **P-01** |
| 7 | Exceso fuera de tolerancia con anticipo | 1, 2, 3 | ¿bloquea? | **NO**: `within=false` pero `validToSend=true`, `issues=[]` | ⚠ **P-01** |
| 8 | Bordes inclusivos (`<=`) | 1, 2 | `+10,00` y `+49,99` envían | envían | ✅ **PASS** |
| 9 | Lado negativo intacto | todas | `−10,00` envía · `−10,01` bloquea | ídem, 4/4 configuraciones | ✅ **PASS** |
| 10 | `prepaidRangeAmount` admite decimales | web | acepta `0,01` | acepta `0,01`, `0`, `0,50` | ✅ **PASS** (fix confirmado) |
| 11 | Decimal llega íntegro al equipo | web→móvil | `0,01` → `0.01` | `0,01` → `"0.01"`, `thr` = 0.01 | ✅ **PASS** |
| 12 | Rechazo con aviso | web | avisa al rechazar | **4 rechazos, 0 avisos**; `0.01` → `1,00` | ❌ **FAIL** (D-01) |
| 13 | Mensaje del anticipo lleva el monto | móvil | *«…creado con 1,00 USD»* | *«Anticipo automático creado con»* — sin monto, 3/3 | ❌ **FAIL** (D-02) |
| 14 | VG baja con login | móvil | baja | 5/5, ~11-12 s | ✅ **PASS** |
| 14b | La web no reescribe sola lo guardado | web | abrir la pantalla no escribe | **escribió 2 veces sin Guardar** (audit 273, 274) | ❌ **FAIL** (D-03) |
| 14c | Un clic en Guardar = una escritura | web | 1 escritura | **2 escrituras** (audit 271 y 272, 3 s) | ❌ **FAIL** (D-03) |
| 15 | IGTF | — | — | `userCanSelectIGTF=false` leído del equipo | **N/A** |
| 16 | Tolerancia porcentual (`TipoTolerancia=1`) | — | — | no ejercitada: el cliente está en Importe | **N/A** |

> **Nota de método:** los casos 2 y 3 podrían parecer «PASS trivial», pero no lo son: **pueden
> fallar** y de hecho el 2 falla si se cambia `prepaidRangeAmount`. En cambio el caso 7 **no puede
> dar otro resultado con esta configuración** — por eso no va como PASS ni como FAIL, sino como
> decisión de producto.

---

## 8. Registros creados en el sistema

Baseline antes de empezar: `max(id_collection) = 2633`, 2507 filas.
Todos con empresa **DIESE** y `id_user` **300** (V.0002) ✔ — guarda de empresa verificada.

| Ref | `co_collection` | Tipo | Cliente | Monto | `nu_difference` | `co_original_collection` | Comentario | ¿Nube? |
|---|---|---|---|---|---|---|---|---|
| **2634** | `1789063692047.0` | **0** cobro | C.0029 | **534,00 USD** | **1,00** | — | `T2-SOLAPE-A` | ✅ |
| **2635** | `1789063771456.0` | **1** anticipo | C.0029 | **1,00 USD** | 0,00 | `1789063692047.0` | `T2-SOLAPE-A` | ✅ |
| **2636** | `1789064155955.0` | **0** cobro | C.0538 | **315,45 USD** | **50,00** | — | `T2-HUECO-A` | ✅ |
| **2637** | `1789064258015.0` | **1** anticipo | C.0538 | **50,00 USD** | 0,00 | `1789064155955.0` | `T2-HUECO-A` | ✅ |
| **2638** | `1789064808286.0` | **0** cobro | C.0538 | **11,81 USD** | **0,01** | — | `T2-SOLAPE-TOTAL` | ✅ |
| **2639** | `1789064881513.0` | **1** anticipo | C.0538 | **0,01 USD** | 0,00 | `1789064808286.0` | `T2-SOLAPE-TOTAL` | ✅ |

**3 cobros + 3 anticipos, los 6 en la nube.** Oráculo: `node automation/db/query.js 4k "SELECT … FROM collection WHERE id_collection > 2633"`.

**Documentos consumidos** (quedan «Por aprobar» y desaparecen del Tab Documentos):

| Cliente | Documento | Estado |
|---|---|---|
| **C.0029** | `FAC 00016794` (533,00 USD) | ⚠ **consumido — C.0029 se queda SIN documentos USD libres** |
| **C.0538** | `FAC 00020300` (saldo 265,45) · `N/D 10000202` (11,80) | consumidos |
| **C.0538** | quedan **6**: `FAC 00020315` (75) · `FAC 00020355` (350) · `N/D 10000206` (8,75) · `FAC 00020424` (602) · `FAC 00020795` (489) · `FAC 00020919` (2.880) · `N/D 10000237` (72) | ✅ **es el cliente de relevo bueno** |
| **C.0010** | — | ⚠ **0 documentos USD libres** (tiene documentos, pero no en USD) |

---

## 9. Defectos, con reproducción

### D-01 · La web sigue rechazando valores en silencio, y `0.01` con punto se guarda como `1,00` — **DEFECTO**

**Gravedad: alta.** No es cosmético: cambia el valor guardado en un factor de **100** sin decir nada,
y `prepaidRangeAmount` es justo el número del que depende todo lo demás.

**Reproducción**
1. Web → Empresa → Variables de configuración → tipo **Cobros**.
2. En *«Indique El monto mínimo excedido en el cobro para generar el abono automático»*, borrar y
   teclear **`0.01`** (con **punto**, que es lo que teclea cualquiera acostumbrado al teclado numérico).
3. Salir del campo (Tab).
4. **Observado:** el campo queda en **`1,00`**. Sin borde rojo, sin `ui-message-error`, sin growl.
5. Guardar → *«Configuración guardada exitosamente»*.
6. **Resultado:** el administrador cree haber puesto 1 céntimo y puso **1 dólar**, ×100.

**Variantes del mismo defecto, todas mudas:** `-1` → `0,00` · `99999` → `10.000,00` ·
`0,001` → muestra `0,00` pero el widget guarda internamente `0.001`.

**Lo que sí está bien y conviene decirlo:** con **coma**, `0,01` y `0` se aceptan y llegan al equipo
íntegros. El fix de los decimales **funciona**; lo que falta es **avisar cuando se corrige la entrada**.

**Sugerencia:** aceptar el punto como separador decimal (el móvil ya lo hace, `parseConfigDecimal`
normaliza ambos), o mostrar un mensaje cuando el valor tecleado se altera.

---

### D-02 · El aviso del anticipo no dice el monto — **DEFECTO (menor)**

**Reproducción:** cualquier envío que genere anticipo (3/3 en esta corrida).
**Observado:** `ion-alert` con *«Anticipo automático creado con»* — la frase termina ahí.
**Esperado:** *«Anticipo automático creado con 1,00 USD»*.
**Causa:** el bundle construye el texto con `template.replace('{amount}', amountLabel)`; el tag
`COB_MSG_AUTOMATED_PREPAID` de 4K **no trae el marcador `{amount}`**, así que el reemplazo no hace
nada. Es **dato del cliente**, no código: se arregla en los tags de 4K.
*(Ya reportado en la 1.ª pasada; sigue igual.)*

---

### D-03 · La pantalla de Variables Globales muestra valores viejos **y los vuelve a escribir sola** — **DEFECTO**

**Gravedad: alta.** No hace falta pulsar Guardar: **basta con abrir la pantalla** para que una
configuración guardada se revierta sola. Descubierto porque la BD y el equipo dejaron de coincidir
con lo que mostraba la web, y confirmado con la tabla de auditoría.

**Reproducción (medida, con marcas de tiempo reales)**

| Hora (UTC) | Qué se hizo | `global_configuration.valor` | Auditoría |
|---|---|---|---|
| 18:38:50 | Guardar con `prepaidRangeAmount = 50,00` | **50** | id 271: `0.01 → 50` |
| 18:38:53 | *(nada — 3 s después)* | 50 | **id 272: `0.01 → 50` otra vez** ← **un clic, dos escrituras** |
| 18:39:10 | login del equipo | — | el equipo baja **50** ✔ |
| 18:40:46 | **abrir `/pages/variablesConfiguracion` y elegir el tipo «Cobros». NO se pulsa Guardar** | — | — |
| 18:40:47 | *(1 segundo después)* | **0.01** ❌ | **id 273: `50 → 0.01`** |

- La pantalla **renderizó `0,01`** cuando en la BD había `50`: **el render va atrasado**.
- Y un segundo después **escribió ese valor viejo en la BD**, sin Guardar, sin aviso y sin
  confirmación. La configuración buena quedó destruida.
- Se repitió: a las 18:42:18 la misma secuencia volvió a escribir (id 274) **antes** del clic en
  Guardar de las 18:42:24.

**Impacto para el cliente:** un administrador que solo *entra a mirar* la configuración de Cobros
puede **revertir en silencio** un cambio hecho minutos antes —por él o por otro— y además ve en
pantalla un valor que no es el vigente. Con dos personas o dos pestañas, es una pérdida de
configuración silenciosa.

⚠ **Honestidad sobre el método:** el selector de tipo de variable se accionó **por script**
(`value='C'` + `Event('change')`), que es el mismo ajax que dispara la selección a mano, pero
**no lo confirmé con un clic humano**. Antes de escalarlo a desarrollo conviene que la QA lo
reproduzca **a mano en 2 minutos**: guardar un valor, salir, volver a entrar a la pantalla,
elegir «Cobros» y volver a consultar la BD. Si se confirma, es un defecto serio y barato de arreglar.

**Oráculo para reproducirlo:** `global_configuration_audit` (`na_variable`, `old_value`,
`new_value`, `da_update`) registra cada escritura, incluidas las que nadie pidió.

---

### P-01 · La tolerancia positiva queda subordinada al anticipo — **DECISIÓN DE PRODUCTO, no defecto**

**No lo reporto como defecto** porque el código lo hace **a propósito**, con comentario explícito
(*«Exceso con anticipo automático: no bloquear por tolerancia positiva»*) y con doble red (§5).
Lo que falta no es un fix: es **decidir cuál de las dos semánticas se quiere**.

**Qué se observa hoy (todo verificado en la nube):**
- Un exceso **dentro** de tolerancia genera anticipo si llega a `prepaidRangeAmount` (Ref 2635, +1,00 con tolerancia 49,99).
- Un exceso **fuera** de tolerancia **se envía igual** si llega a `prepaidRangeAmount` (`within=false`, `issues=[]`, +50,00 con tolerancia 49,99).
- Con `prepaidRangeAmount = 0,01` la tolerancia positiva **no gobierna ningún importe** (Ref 2639, anticipo de un céntimo).

**La pregunta para desarrollo/producto:**
> `26dc93c0` hacía mandar a la tolerancia; `72177ec6` la revirtió y ahora manda el anticipo.
> **¿Cuál es la querida?**
> - Si manda la **tolerancia** (semántica de `26dc93c0`): el umbral vuelve a ser `T+ + M`, los dos
>   tramos encajan sin solaparse y `prepaidRangeAmount` significa «cuánto MÁS ALLÁ de lo tolerado».
> - Si manda el **anticipo** (semántica de hoy): entonces `prepaidRangeAmount < RangoToleranciaPositiva`
>   es una configuración que **desactiva la tolerancia positiva**, y la web debería **impedirla o avisar**,
>   porque hoy se puede guardar sin una sola advertencia.

**Efecto colateral que conviene mirar en la decisión:** con la semántica de hoy, **no hay ninguna
configuración que a la vez (a) tolere diferencias pequeñas sin generar papeles y (b) bloquee las
grandes**. O se bloquea un hueco (config 1), o no se bloquea nada (configs 2 y 3).

**Dato menor de camino:** `isWithinToleranciaOrExactOrPartialRules() || delta > 0` dentro de un `if`
que ya exige `delta > 0` deja el primer término como **código muerto**. Si la intención era otra
—por ejemplo, no suprimir el bloqueo cuando el exceso *no* está dentro de tolerancia— **la condición
está mal escrita** y ahí sí habría un defecto real. Merece una mirada de quien lo escribió.

---

### Corregido respecto de la 1.ª pasada

| 1.ª pasada decía | Hoy |
|---|---|
| «Fix 1 NO está en la build» → **FAIL** | ❌ **Mal encuadrado.** La build **era** main y main ya había revertido la suma. El umbral = `prepaidRangeAmount` **es lo correcto según main**. No es un FAIL: es la conducta especificada. |
| «`prepaidRangeAmount` es entero, min 1, rechaza `0,01` y `0`» → **FAIL** | ✅ **Corregido en la web**: prec 2, step 0,01, min 0. Acepta ambos. *(Queda D-01, que es otra cosa.)* |
| «banda que bloquea 10,51…49,99, esperada 10,51…60,49» → **FAIL** | ❌ La banda esperada partía del umbral con suma, que main no tiene. La banda medida es la correcta para main. |
| «configuración final: `prepaidRangeAmount = 50`» | ❌ **No se guardó**: estaba en `1` al abrir esta pasada, en la web y en el equipo. |
| «la VG tarda ~80 s en bajar» | ⚠ **~11-12 s**; los ~50 s restantes son la sincronización posterior. |
| «`ion-button.imagenEnviar` NUNCA se deshabilita» | ⚠ **Matiz**: tras pulsarlo con un issue bloqueante **sí** queda `disabled=true`. Sigue sin servir como oráculo *antes* de pulsar, pero la frase «nunca» es falsa. |

---

## 10. Para el script de cobros

> Objetivo: que esto corra desde `automation/playwright/modules/cobros.js` sin agente.
> Todo lo de abajo está probado hoy contra la build 6.6.21.3 / `main`.

### 10.1 Selectores estables

| Qué | Selector | Nota |
|---|---|---|
| Playa | `window.__env.WsUrl` | pre-vuelo, sin UI |
| VG efectivas | `localStorage.globalConfiguration` (Map serializado) | **la fuente**, no el YAML ni la BD |
| Versión | `localStorage.versionApp` · `db_version` | afirmarlas en el reporte |
| **Código vivo** | `fetch('http://localhost/main.js')` + `indexOf('<nombre de la función>')` | 🔑 el bundle viene **sin minificar**: se puede cotejar el cuerpo literal contra `git show origin/main:…`. Es el pre-vuelo que evita medir contra la build equivocada |
| Servicio de cobros | `window.ng.getComponent(document.querySelector('app-cobro')).collectService` | fallback: recorrer `Object.keys(comp)` y quedarse con el que tenga `'RangoToleranciaPositiva' in v` |
| Tile Cobros (HOME) | `app-home` → `p.nombreModulos` con texto `Cobros` → clic en `closest('a')` | |
| Tile COBRO | `app-cobros ion-button` con `textContent.trim() === 'COBRO'` | **requiere PointerEvents sobre el `<button>` del shadowRoot** (ver 10.4) |
| Modal cliente | `#clienteSelectModal` → `.present()` | filtra **solo con Enter** |
| Fila del cliente | el `<p>` del `ion-item` cuyo `innerText` contiene el código | clic en el `<p>`, no en el centro del item |
| Empresa / Moneda | `app-cobro-general ion-select` visibles → `[0]` empresa, `[1]` moneda | asignar el `value` **objeto** de la `ion-select-option` + `ionChange` |
| Comentario | `app-cobro-general ion-input` con `ng-reflect-label` `/coment/i` | ✅ **ancla mejor que el índice** — usar esta |
| Pestañas | `ion-segment.value` + `ionChange`. Valores: **`default`**, `documentos`, `pagos`, `total`, `adjuntos` | General es `default` |
| Checkbox de documento | `app-cobro-documents ion-checkbox` con `closest('ion-row').innerText` conteniendo el `nu_document` | |
| Agregar método de pago | `ion-button#eventSelect` | **nunca** `#eventModal.present()` |
| Monto | dentro de `app-cobro-pagos`, el `ion-input` cuyo `<input>` tiene **`inputmode="numeric"`** | ✅ 100 % fiable hoy; `[0]` es «Nro. Recibo» |
| Guardar / Enviar | `ion-button.imagenGuardar` · `ion-button.imagenEnviar` | ver 10.4 |
| Dirty-guard | `ion-alert` con botones `[Guardar y salir · Salir sin guardar · Cancelar]` | detectar **por botones** |
| SALIR del HOME | `app-home ion-button` con texto exacto `Salir` | es `ion-button`, no `<p>` |
| Web · fila de VG | 🔴 **buscar por la DESCRIPCIÓN**, no por el índice: `/monto máximo de tolerancia positiva/i`, `/monto máximo de tolerancia negativa/i`, `/monto mínimo excedido/i` | el `j_idt` **ya cambió** (`j_idt136` → `j_idt137` al desplegarse el fix). Reusar el mapa `PUENTE` de `automation/web/pre-vuelo-cobros.js` |
| Web · escribir una VG | `PrimeFaces.widgets['widget_formGlobal_tablaConf_<fila>_j_idt137'].setValue(n)` + `.input.trigger('change')` | 🔴 ver 10.4 |
| Web · guardar | `#formGlobal:botonGuardar` → esperar *«Configuración guardada exitosamente»* | 🔴 **el growl NO prueba nada**: verificar en la BD (D-03) |
| **VG vigentes (barato)** | `SELECT clave, valor FROM global_configuration WHERE clave IN (…)` | 🔑 **trae los valores REALES**, coincidió con el equipo 6/6. Oráculo sin abrir la web ni re-loguear |
| **Quién cambió qué** | `SELECT na_variable, old_value, new_value, da_update FROM global_configuration_audit ORDER BY id_audit DESC` | 🔑 registra **toda** escritura, incluidas las que nadie pidió. Es lo que destapó D-03 |

### 10.2 Secuencia mínima

**Pre-vuelo (una vez por corrida):**
1. `adb forward` a `:9220` (re-mapear si la app se reinició).
2. `window.__env.WsUrl` → playa. Si no es la esperada, **abortar**.
3. `localStorage.globalConfiguration` → `tolerancia0`, `TipoTolerancia`, `RangoToleranciaPositiva`,
   `RangoToleranciaNegativa`, `MonedaTolerancia`, `automatedPrepaid`, `prepaidRangeAmount`,
   `prepaidRangeCurrency`. **Calcular los bordes con estos valores.**
4. Comprobar el **código vivo** (`main.js`) contra la función esperada. Si no coincide con la rama
   que se dice estar probando → **abortar y decirlo**, no medir.
5. `tolerancia0 === false` o `automatedPrepaid === false` → **N/A**. `TipoTolerancia === 1` → los
   bordes son `base × % / 100`; hoy **no cubierto**, marcar N/A.
6. Verificar la **empresa** de las filas que se van a crear (`co_enterprise`), no solo el host.

**Montaje del cobro (12 pasos):**
1. HOME → tile **Cobros** → tile **COBRO**; esperar **≥ 4** `ion-segment-button` visibles.
2. `#clienteSelectModal.present()` → `focus()` en el input (**no** clic) → teclear el código → **Enter** → clic en el `<p>`.
3. **Moneda = `MonedaTolerancia`** (2.º `ion-select`). En un cobro fresco y sin documentos no salta la alerta de reinicio.
4. Comentario (único por corrida: es el oráculo en la nube).
5. Tab `documentos` → elegir por `nu_document` → **anotar el saldo** = `montoTotalPagar`.
6. Tab `pagos` → `#eventSelect` → **Efectivo** → `Agregar` → expandir el acordeón.
7. Teclear el monto (ver 10.4) y **leer el servicio**.

**Barrido — un solo cobro sirve para todos los bordes de una configuración.**
Con `P = montoTotalPagar`, `T+`, `T−`, `M = prepaidRangeAmount`:

| # | Monto | Aserción |
|---|---|---|
| 1 | `P` | `within=true`, `should=false` |
| 2 | `P + min(T+, M−0,01)` | `within=true`, `should=false` ← **último directo** |
| 3 | `P + T+ + 0,01` | si `T+ < M`: `issues=['TOLERANCIA']` · si `T+ ≥ M`: `should=true` |
| 4 | `P + M − 0,01` | si `T+ < M`: bloquea · si no: directo |
| 5 | `P + M` | **`should=true`, `createAutomatedPrepaid=true`, `anticipoAutomatico.length===1`** ← **primero con anticipo** |
| 6 | `P − T−` | `within=true` |
| 7 | `P − T− − 0,01` | `issues=['TOLERANCIA']` |

🔑 **El discriminante de la semántica** (§5) es el caso 5 con `M < T+`: hoy da `should=true`
(manda el anticipo). Si algún día vuelve la lógica de la suma, dará `false` hasta `T+ + M`.
**Aserción que conviene dejar escrita en el script**, porque es exactamente lo que hay que vigilar.

### 10.3 Oráculo de cada caso

| Caso | Se lee | Contra qué |
|---|---|---|
| Umbral efectivo | `svc.getAutomatedPrepaidActivationThreshold()` | `prepaidRangeAmount` de `localStorage` (**no** la suma) |
| Directo | `within===true` ∧ `should===false` ∧ `validToSend===true` ∧ `issues.length===0` | — |
| Bloquea | `validToSend===false` ∧ `issues` contiene `'TOLERANCIA'` | — |
| Anticipo | `should===true` ∧ `createAutomatedPrepaid===true` ∧ `anticipoAutomatico.length===1` | — |
| Mensaje de bloqueo | pulsar `imagenEnviar` → `.alert-message` | *«El monto pagado está fuera del rango de tolerancia permitido.»* |
| **Llegó a la nube** | `SELECT id_collection, co_type, nu_amount_total, nu_difference, co_original_collection, co_enterprise FROM collection WHERE id_collection > <baseline>` | **2 filas**: `co_type=0` con `nu_difference` = el exceso, y `co_type=1` con `nu_amount_total` = el exceso y `co_original_collection` = el `co_collection` del padre |
| VG llegó al equipo | `localStorage.globalConfiguration` | el valor guardado en la web |
| Decimales en la web | `PrimeFaces.widgets[<var>].cfg.precision/step/min` **y** teclear de verdad | `precision ≥ 2`, `min = 0`; y que **tras el blur** el valor sea el tecleado |

**Baseline obligatorio:** `SELECT max(id_collection) FROM collection` **antes** de crear nada.

### 10.4 Qué NO es automatizable (o cuesta caro) y por qué

- 🔴 **Desconectar la sesión CDP destruye los `ion-modal` abiertos.** Un `browser.close()` —o
  simplemente terminar el proceso mientras hay un modal— deja el `#eventModal` en el DOM **pero
  vacío**. ⇒ **Todo el montaje de un cobro tiene que ocurrir en UN solo proceso.** Fue lo que más
  tiempo costó descubrir hoy.
- 🔴 **Hay TRES elementos con `id="eventModal"` en el DOM** (quedan instancias muertas de cobros
  anteriores). `document.querySelector('#eventModal')` devuelve **la primera, que está vacía**.
  Hay que hacer `querySelectorAll` y quedarse con la que **no** tenga `overlay-hidden` / tenga
  `ion-item`s. Mismo cuidado con cualquier `id` de modal.
- **Los `ion-button` de Ionic no responden a `mouse.click` de forma fiable.** Lo que funciona 100 %
  es despachar `pointerdown/mousedown/pointerup/mouseup/click` sobre el `<button>` del `shadowRoot`.
  Conviene intentar los dos, alternando, con reintentos.
- **El campo Monto exige teclado real y es acumulativo en centavos.** `focus()` por JS,
  **`Backspace` ×16**, `keyboard.type('<dígitos>')` **sin coma** (`599,98` → `"59998"`), y después
  `blur()` + `Event('blur')` o el total no recalcula.
- 🔴 **La web NO se deja escribir por `el.value` ni por teclado sintético**: el spinner de PrimeFaces
  restaura su valor interno. Peor: un intento a medias lo deja **corrupto** (se observó `10.004999`
  tras teclear sobre un valor sin seleccionarlo). Para **configurar** hay que usar
  `widget.setValue(n)`; para **probar qué admite el campo** hay que teclear de verdad y leer
  **antes y después del blur**. Son dos cosas distintas y el script necesita las dos.
- **`imagenEnviar` no sirve como oráculo antes de pulsarlo** (no aparece deshabilitado aunque el
  cobro no sea enviable). Leer `lastSendIssues`, o pulsar y leer la alerta.
- **Los documentos se consumen.** Un cobro enviado deja la factura «Por aprobar» y **desaparece del
  Tab Documentos**; la BD local no lo refleja. ⇒ el script **debe** leer el Tab Documentos y **fallar
  con un mensaje claro** («cliente sin documentos libres»), nunca elegir otro por su cuenta.
  Hoy: **C.0029 y C.0010 sin documentos USD libres · C.0538 con 6**.
- **Cambiar una VG cuesta ~70 s** (11 s la bajada + ~55 s de sincronización). Un barrido de varias
  configuraciones debe **agrupar todos los casos de cada una** y hacer **un solo re-login por
  configuración**.
- **Tras el re-login hay que ESPERAR a HOME**, no solo a que las VG estén en `localStorage`: la app
  sigue en `/synchronization` y cualquier clic se pierde. Oráculo: `app-home` sin `ion-page-hidden`.
- **Pago parcial desactiva el anticipo** (`existPartialPayment` corta el gate). No mezclar.
- **Nada de esto aplica a `co_type=1` (Anticipo) ni `co_type=2` (Retención)**: el gate arranca con
  `if (coTypeModule !== '0') return false`. **N/A explícito.**
- **`TipoTolerancia = 1` (porcentaje) no está cubierto** por ninguna de las dos pasadas.
- 🔴 **La pantalla de Variables Globales no es fiable ni para leer ni para dejar algo guardado**
  (D-03): muestra valores atrasados y reescribe sola. Un script que toque VG **tiene que**
  (a) escribir, (b) **verificar en `global_configuration`**, y (c) **no volver a abrir la pantalla**
  antes de medir. Y al cerrar, comprobar BD **y** equipo, no la web.

### 10.5 Datos de partida

| Qué | Valor | Nota |
|---|---|---|
| Vendedor | `V.0002zonacentral` / `123456` (bloque `# Cliente: 4k`) | `idUser` 300 |
| Web | `admin` / `123456` (bloque `# USUARIO WEB … CARIBE`) | |
| Cliente con documentos USD | **C.0538** (6 libres, de 8,75 a 2.880 USD) | ⚠ **C.0029 y C.0010 agotados en USD** |
| Moneda del cobro | **USD** (= `MonedaTolerancia`) ⇒ bordes 1:1 | requiere `multiCurrencyCollection` ✔ |
| Configuración | `tolerancia0` ✔ · `TipoTolerancia 0` ✔ · `automatedPrepaid` ✔ · `requiredCollectionAttachments false` ✔ | si se pone el adjunto obligatorio, dejar en Guardado |
| Comentario | obligatorio · **único por corrida** | es el oráculo en la nube |
| Config final dejada | tol+ **49,99** · tol− **10,00** · anticipo **50,00** · USD · Importe | ✅ verificada en **BD y equipo** (la web no sirve de testigo, D-03) |

---

## 11. Nota de método

- Los bordes se midieron leyendo **las funciones del servicio que usa Enviar**, no el DOM ni el
  estado del botón. Un barrido de 7 importes en un solo cobro cubre una configuración entera sin
  crear un solo registro; los envíos reales están solo donde hacía falta **probar que el documento
  existe en la nube**.
- Las cuatro configuraciones se midieron **con la VG verificada en el equipo antes de medir**, nunca
  dando por buena la escritura de la web.
- La comprobación de build se hizo contra el **bundle vivo** y contra `origin/main`, no contra el
  working tree (la rama de QA va por detrás).
- Lo que **no** se cubrió y conviene decir: `TipoTolerancia = 1` (porcentaje), tolerancia en moneda
  distinta a la del cobro (entra la conversión y el borde deja de ser exacto), y el comportamiento
  con `prepaidRangeCurrency ≠ coCurrency`.
