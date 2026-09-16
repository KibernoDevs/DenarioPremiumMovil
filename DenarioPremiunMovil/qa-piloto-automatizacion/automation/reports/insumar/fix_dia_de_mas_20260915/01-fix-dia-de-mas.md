# ✅ SÍ — el «día de más» de `Cumplimiento de Cuota` **está corregido**

> Medido **en la propia pantalla acusada**, hoy **15/09/2026 entre las 16:11 y las 16:22** hora local.
> `13/07 – 13/07` devuelve **285 · 155.028,94 US$** — el valor de «corregido». Los dos bordes entran
> exactamente una vez. **Pero el módulo NO está limpio: la vista por Línea sigue inflada ×11.290 y
> `Activación de Clientes` sigue devolviendo 0 filas en silencio.** Ver §4 antes de cerrar el tag.

| | |
|---|---|
| **Fecha / ventana** | 2026-09-15 · **15:42 – 16:28** hora local |
| **Cliente / base** | INSUMAR · empresa única `INSUM_A` · base `insumar` |
| **Web** | `http://denarioelyaque.ddns.net:8080/DenarioPremium` (playa **EL YAQUE**) · usuario `admin`, **bloque 2** del archivo de secretos (`ISLA COCHE / EL YAQUE`) |
| **Capa** | **Solo web + base, solo lectura.** No se tocó el móvil, ni el CDP del teléfono (`:9220`), ni la web de CARIBE. |
| **Escrituras** | **Ninguna**, ni en la web ni en la base. Todas las consultas son `SELECT`. |
| **Sesión propia** | Chrome propio en CDP **`:9415`**, perfil `qa-insumar-fixdia-profile`. **No se reutilizó ninguna sesión ajena.** |
| **Mediciones** | **54 búsquedas** con captura y con el POST + la respuesta AJAX cruda guardados (`evidencia/`) |

> **Login:** entró **a la primera** con el segundo bloque (`PATH=/DenarioPremium/pages/main`, `TITLE=Inicio`).
> `qa-web-open.js` **sigue mal** (primer bloque + `BASE` clavado en `denariocaribe`): se condujo con un
> `_open.js` propio en este RUN_DIR, con el `BASE` de EL YAQUE. **No se modificó `qa-web-open.js`** (norma de solo lectura).

---

# 0 · El módulo Reportes **SÍ responde** — pero hay un despliegue nuevo por medio

**Comprobado a las 16:11 y otra vez a las 16:22.** `Cumplimiento de Cuota` y `Plan vs Cuota` devuelven
resultados sin error. `Activación de Clientes` responde sin error pero **sigue dando 0 filas**.

🔑 **Hay un build nuevo desplegado entre las 11:50 y las 15:42 de hoy.** Los identificadores de la pantalla
cambiaron: el formulario pasó de `form:*` a **`formFiltros:*` + `formTabla:*`**, y apareció un **combo
`Empresa` nuevo** (deshabilitado, valor fijo `1`, un solo tenant). `Activación de Clientes` **no** se tocó:
sigue con los ids viejos (`form:j_idt115`). Es decir, **el despliegue fue parcial**.

| Pantalla | 09:43–09:50 | 11:05–11:50 | **15:42–15:59 (yo)** | **16:05–16:28 (yo)** |
|---|---|---|---|---|
| **Cumplimiento de Cuota** | OK | 🔴 error 20/20 | 🔴 error **9 de 9** | ✅ **OK — 20 de 20** |
| **Plan vs Cuota** | OK | 🔴 error 4/4 | ✅ **OK — 6 de 6** | ✅ OK |
| **Activación de Clientes** | `total=1` / `total=7` | 🟠 `total=0` | 🟠 **`total=0`, 2 de 2** | 🟠 **`total=0`, 3 de 3** |

## ⚠ Honestidad sobre mis 9 errores de las 15:42–15:59

**No los presento como una caída del servidor.** Encontré una explicación de método que los cubre y **la
digo aunque me deje en evidencia**: en el build nuevo, elegir en los combos **por JavaScript**
(`widget.selectValue()`, que es lo que hacen `medir-cuota.js` y `_pick2.js` de las corridas anteriores)
**ya no dispara el `valueChange` que viaja al servidor**. Se ve al ojo: tras elegir `Linea` por JS la lista
de **Valores queda vacía** (`items=0`), y **con clics reales se puebla con 18** (`items=18`). El bean del
servidor nunca recibe la clasificación, y al pulsar Buscar revienta con *«Error en busqueda de reporte.»*

- Con **clics reales**, desde las 16:05, **20 búsquedas seguidas sin un solo error**, incluida una **después
  de pulsar `Limpiar`** (`FX_LIMPIAR_sinRdv`).
- **Lo que no puedo descartar:** que entre las 15:42 y las 15:59 hubiera *además* un problema real de
  servidor. Mi reproducción «a mano» de las **15:47** (`FX_HUMANO_jul13`) también falló, pero arrastraba el
  bean contaminado por los intentos por JS previos. **Queda como no concluyente.**
- **Lo que sí sostengo:** la caída de las 11:05–11:50 que reportó la re-verificación **ya no se reproduce**.

📌 **Nota para las próximas corridas:** `medir-cuota.js` / `_pick2.js` **han quedado obsoletos** contra este
build. Hay que conducir estas pantallas **con clics reales** (`_humanplan.js` de este RUN_DIR).

---

# 1 · 🔑 El fix del día de más — **CORREGIDO**, en los dos bordes

## 1.1 · La prueba decisiva, tal como la pedía el encargo

`Cumplimiento de Cuota` · **Todos** · Empresa · Facturado · **US$** · sin filtro de vendedor:

| Búsqueda | **Pantalla (16:11)** | Corregido | Se come el 1er día | Añade un día |
|---|---|---|---|---|
| **`13/07 – 13/07`** | **285 · 155.028,94** | **285** ✅ | 0 | 932 |

**Medido dos veces por caminos distintos, con el mismo resultado al céntimo:**
`FX_CUM_EMP_TODOS_jul13` (combo de vendedor puesto a `Todos` a mano) y `FX_LIMPIAR_sinRdv` (tras pulsar
**Limpiar**, sin tocar el vendedor).

## 1.2 · Los dos rangos de confirmación, y dos más

| Búsqueda | **Pantalla** | Correcto | Defectuoso (añade un día) | Δ |
|---|---|---|---|---|
| `01/08 – 31/08` | **1.171 · 224.411,08** | 1.171 · 224.411,08 | 1.220 · 232.003,67 | **0,00** ✅ |
| `01/08 – 30/08` | **1.118 · 212.706,05** | 1.118 · 212.706,05 | 1.171 · 224.411,08 | **0,00** ✅ |
| `01/07 – 31/07` | **5.908 · 1.270.978,81** | 5.908 · 1.270.978,81 | — *(si comiera el 1er día: 5.715 · 1.195.421,75)* | **0,00** ✅ |
| `01/09 – 14/09` | **468 · 80.160,23** | 468 · 80.160,23 | — *(no discrimina)* | **0,00** ✅ |

⚠ **El 224.411,08 salió con `31/08`, no con `30/08`.** Es exactamente la lectura que distingue la salida
sana de la defectuosa, y salió por el lado sano. Con `30/08` la pantalla baja a **212.706,05**, que es
agosto sin el día 31 — justo lo que esta mañana **no** hacía.

## 1.3 · El borde izquierdo — **verificado por primera vez, y entra bien**

Nunca se había mirado. Ahora hay dos pruebas independientes:

- **`13/07 – 13/07` devuelve 285, no 0.** Si se comiera el primer día, la ventana quedaría vacía.
- **`01/07 – 31/07` devuelve 5.908 · 1.270.978,81**, no 5.715 · 1.195.421,75. El **01/07 (193 facturas ·
  75.557,06)** entra entero.

## 1.4 · El ancla que no depende de ninguna fórmula: **un día vacío**

La prueba más limpia de todas, y la que cierra el caso sin discutir importes:

| Búsqueda | **Pantalla** | Si añadiera un día habría devuelto |
|---|---|---|
| **`12/07 – 12/07`** *(domingo, **cero** facturas en la base)* | **0 · 0,00** ✅ | los datos del **13/07**: 285 · 155.028,94 |
| `11/07 – 11/07` *(sábado, cero facturas)* | **0 · 0,00** ✅ | — |

## 1.5 · Cierre aritmético: la ventana es **aditiva y exacta**

Medido día a día en la propia pantalla, sin tocar la base:

```
13/07 solo ...... 131.910,50 · 190      (con el filtro R013 puesto, ver §6)
14/07 solo ......  15.514,20 · 140
13/07 – 14/07 ... 147.424,70 · 330      = 131.910,50 + 15.514,20   ✔ al céntimo, y 190+140 = 330 ✔

01/08 – 30/08 ...  85.356,97 · 358
31/08 solo ......   5.281,46 ·  21
01/08 – 31/08 ...  90.638,43 · 379      = 85.356,97 + 5.281,46     ✔ al céntimo, y 358+21 = 379 ✔
01/09 solo ......     942,24 ·  10      -> NO entra en 01/08–31/08 (si entrara: 91.580,67 · 389)
```

**Cada día entra exactamente una vez, y el día siguiente al final del rango no entra.** El desfase se ha ido.

## 1.6 · Veredicto del paso 1

🟢 **CORREGIDO.** **9 ventanas medidas en la pantalla acusada, 9 exactas**, cubriendo los dos bordes, un
día suelto, dos días vacíos, dos fronteras de mes y el cierre aditivo. **`Plan vs Cuota`, que ya estaba
sano, sigue sano**: 5 ventanas más, todas exactas (`13/07–13/07` = 155.028,94 · `01/08–31/08` = 224.411,08 ·
`01/08–30/08` = 212.706,05 · `01/07–31/07` = 1.270.978,81 · `01/09–14/09` = 80.160,23).

---

# 2 · La vista por **Línea** sigue inflada — **NO corregida**

**Medido hoy en pantalla, en las dos pantallas que faltaban**, con `Todos` · Facturado · US$ · `01/09–14/09`:

| Pantalla | **Empresa** | **Línea (Σ de las 18 filas)** | Factor | ¿Medido hoy? |
|---|---|---|---|---|
| **Cumplimiento de Cuota** | **80.160,23** | **905.028.443,33** | **×11.290** | ✅ **sí** (`FX_CUM_LIN_T_sep01_14`) |
| **Plan vs Cuota** | **80.160,23** | **905.028.443,33** | **×11.290** | ✅ **sí** (`FX_PLAN_H_Linea_sep2`) |
| Indicadores › % Participación | — | ya confirmado el 15/09 a las 11:39 (×753) | — | no re-medido |

**Las dos pantallas dan el mismo número al céntimo**, y ese número es **exactamente** el que la
re-verificación de las 11:50 había reconstruido desde la base (`sum(invoice_detail.nu_amount_total)` con el
JOIN en rol 7). **Las dos rotulan la columna «US$».**

Desglose de las 18 Líneas (idéntico en las dos pantallas):
GALLETAS **280.303.497,85** · PASAPALOS 125.071.197,08 · ALIMENTOS 108.994.839,97 · CARAMELOS 100.810.214,50 ·
BEBIDAS 73.097.466,54 · CONDIMENTOS 52.018.435,40 · CEREALES 37.168.870,36 · CHICLES 28.695.927,31 ·
CHOCOLATES 25.061.672,13 · TABACO 17.453.700,71 · TURRONES Y BOCADILLOS 11.008.814,65 · MISCELANEOS 10.345.024,24 ·
GOMAS 9.124.448,86 · POSTRES Y GELATINAS 8.127.930,28 · CHUPETAS 7.528.614,11 · LECHE CONDENSADA 6.941.115,37 ·
INFUSIONES 2.423.320,29 · **TORTAS 853.353,68**.

🔑 **Un solo renglón (GALLETAS) vale 3.496 veces la facturación real de la quincena.** Y **la fecha sí está
bien también en esta vista**: `13/07` y `14/07` dan valores distintos y `13/07–14/07` es la suma exacta de
los dos (2.369.136.593,10 + 180.769.612,50 = 2.549.906.205,60), y `12/07` da 0. **El fix arregló la fecha,
no la columna.**

**Otras visualizaciones que hoy sí respondieron** (`01/09–14/09`): `Canales de distribución` → 32 filas ·
`Proveedor` → 119 filas · `Productos` → no llegó a cargar la lista de Valores. **Su exactitud queda NO
COMPROBADA** — no decidía el tag y se priorizó el paso 1.

---

# 3 · `Activación de Clientes` — **sigue en 0, en silencio. NO corregida**

**5 búsquedas, 5 veces `Total de Resultados: 0`**, sin ningún mensaje de error, a las 15:52 y a las 16:25.

| Búsqueda | Hoy 09:43 | **Hoy 15:52 y 16:25** |
|---|---|---|
| Empresa · Facturado · ago | `total=1` | **`total=0`** · «No se encontraron registros.» |
| Vendedores · Facturado · ago | `total=7` | **`total=0`** |
| Empresa · Facturado · sep 1–14 | — | **`total=0`** |

**El cero está comprobado, no supuesto:** consta el estado exacto del formulario justo antes de pulsar
Buscar (`pre={clas:"Empresa", cumpl:"Facturado", d:"01/08/2026", h:"31/08/2026"}`), la cabecera propia de
la pantalla leída del DOM (`Clientes · Clientes Activados · Clientes Inactivos · % Activación · Clientes
Nuevos · Clientes Nuevos Activados · % Act Nuevos`) y el cuerpo del POST y de la respuesta AJAX.
**Se llegó a la pantalla y la pantalla contestó vacío.**

Y **esta pantalla no recibió el build nuevo** (sigue en `form:j_idt115`), lo que encaja con que su síntoma
no haya cambiado nada desde la mañana.

---

# 4 · 🔴 Lo que desde esta medición **desaconseja cerrar el tag de la 22**

| # | Qué | Gravedad |
|---|---|---|
| **A** | **La vista por Línea sigue inflada ×11.290 en las dos pantallas de Reportes**, rotulada «US$». Cualquiera que abra `Cumplimiento de Cuota` o `Plan vs Cuota` por Línea ve **905 millones** donde hay **80 mil**. Medido hoy en pantalla, no deducido. | 🔴 **Alto** |
| **B** | **`Activación de Clientes` devuelve 0 filas sin decir nada.** Un reporte que esta mañana daba datos y ahora sale vacío **sin error** es lo peor que puede pasarle a un cierre: no se nota. Y esa pantalla **se quedó fuera del despliegue**. | 🔴 **Alto** |
| **C** | **El despliegue de hoy es parcial y llegó tardísimo** — entre las 11:50 y las 15:42, el mismo día del tag. `Cumplimiento` y `Plan` tienen ids nuevos; `Activación` no. Y el módulo estuvo caído entre las 09:50 y, al menos, las 11:50. Si se taggea hoy, se taggea un build que **nadie ha recorrido entero**. | 🟠 **Medio-alto** |
| **D** | **El combo de vendedor conserva la selección entre recargas** (`codRdv=R013` se me quedó pegado de una medición a la siguiente, sin recargar el filtro). Ya estaba anotado para el combo `Roles`; **es más general de lo que se creía** y hace que un usuario vea cifras filtradas creyendo que son el total. `Limpiar` **sí** lo devuelve a `Todos`. | 🟠 **Medio** |

**Mi lectura, en una frase:** el fix que se iba a validar **está bien hecho y se puede dar por cerrado**,
pero **no arregla el módulo**, y **A** y **B** son defectos de cuadre visibles a simple vista en la misma
release. **Yo no cerraría la 22 hoy sin una decisión explícita sobre A y B.**

---

# 5 · Lo que **NO** quedó comprobado

- **La exactitud de `Canales de distribución`, `Proveedor` y `Productos`** — responden, pero no se
  contrastaron sus importes contra la base.
- **Si el importe por Línea también está mal en `BS` o en `UNIDADES`** — solo se midió en `US$`.
- **La causa del error de las 15:42–15:59** (§0). Hay una explicación de método que lo cubre, pero **no se
  descartó del todo** un problema de servidor simultáneo.
- **Por qué `Activación de Clientes` da 0** — no se leyó `../src/`, fuera de alcance.
- **Indicadores › % de Participación** no se re-midió hoy (ya estaba confirmado el 15/09 a las 11:39).
- **Nada del móvil.** No se tocó el teléfono ni su CDP.

---

# 6 · Método y evidencia

- **54 búsquedas**, cada una con captura `.png`, el **cuerpo del POST** y la **respuesta AJAX cruda**
  (`evidencia/resp-*.txt`) y el resultado parseado (`evidencia/res-*.json`).
- **Conducción con clics reales** (`_humanplan.js`, `_limpiar.js`): cada combo se abre y se pulsa su opción;
  las fechas se **teclean** y se hace `blur()` antes de medir; el botón Buscar se pulsa por **coordenadas**
  (`pg.mouse.click` sobre su `boundingBox`), no con `.click()` por JavaScript.
- ⚠ **Combo de vendedor:** a partir de `FX_CUM_EMP_TODOS_jul13` se **fija explícitamente a `Todos` en cada
  medición**, y queda registrado en el `pre` de cada `res-*.json`. Las medidas anteriores a esa (las
  `FX_CUM_EMP_*` sin `_T_` y las `FX_CUM_H_Linea_*`) **llevan `R013` pegado** y por eso solo se usan para el
  contraste aditivo de §1.5, **nunca para importes absolutos**. **Lo digo porque me pasó a mí.**
- **`fechaDesde` = inicio y `fechaHasta` = fin** en las dos pantallas de Reportes; verificado leyendo los
  valores por defecto de la pantalla (`01/09/2026` → `15/09/2026`) antes de escribir nada.
- **Los ceros están comprobados:** cada `total=0` va con el estado del formulario, la cabecera de la tabla
  leída del DOM y la captura.
- **Consultas:** `sql/consultas.sql` (F1–F4), escritas de cero hoy. **Todas `SELECT`.**

## Archivos

| | |
|---|---|
| `sql/consultas.sql` | Las 4 consultas de oráculo de esta corrida |
| `evidencia/FX_CUM_EMP_T_*.json/.png` | 🔑 **Las mediciones que deciden**: Cumplimiento · Empresa · **Todos** |
| `evidencia/FX_CUM_EMP_TODOS_jul13.*` · `FX_LIMPIAR_sinRdv.*` | Las dos lecturas independientes del `13/07–13/07` = **285 · 155.028,94** |
| `evidencia/FX_CUM_LIN_T_sep01_14.*` · `FX_PLAN_H_Linea_sep2.*` | Vista por Línea inflada ×11.290 en las dos pantallas |
| `evidencia/FX_ACTIV*.json/.png` | Las 5 búsquedas de Activación de Clientes en 0 |
| `evidencia/FX_CUM_*_EmpFactUSD.*` · `FX_HUMANO_jul13.*` · `FX_CUM_VIRGEN.*` | Los 9 intentos con error de las 15:42–15:59 |
| `_open.js` | Login propio (bloque 2, `BASE` de EL YAQUE, CDP `:9415`) |
| `_humanplan.js` · `_limpiar.js` | **Conducción con clics reales** — los que funcionan contra el build nuevo |
| `medir2.js` · `_probe*.js` · `_valores.js` | Descubrimiento de ids del build nuevo y driver por JS (**obsoleto**, ver §0) |
