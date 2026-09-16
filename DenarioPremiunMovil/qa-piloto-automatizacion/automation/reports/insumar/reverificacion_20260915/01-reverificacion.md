# INSUMAR · Re-verificación independiente de tres hallazgos

| | |
|---|---|
| **Fecha** | 2026-09-15 · ventana de medición **11:05 – 11:50** hora local |
| **Cliente / base** | INSUMAR · empresa única `INSUM_A` · base `insumar` |
| **Web** | `http://denarioelyaque.ddns.net:8080/DenarioPremium` (playa **EL YAQUE**) · usuario `admin`, bloque 2 (`ISLA COCHE / EL YAQUE`) |
| **Capa** | **Solo web + base, solo lectura.** No se tocó el móvil, ni el CDP del teléfono, ni la web de CARIBE. |
| **Escrituras** | **Ninguna**, ni en la web ni en la base. |
| **Informe auditado** | `automation/reports/insumar/tres_modulos_20260915/00-CONSOLIDADO.md` (medido entre las **09:43 y las 09:50** de hoy) |
| **Sesión propia** | Chrome propio en CDP `:9413`, perfil `qa-insumar-reverif-profile`. **No se reutilizó la sesión de la otra corrida.** |

> **Login:** entró **a la primera** con el segundo bloque del archivo de secretos. No hizo falta leer el
> cuerpo del POST: `PATH=/DenarioPremium/pages/main`. `qa-web-open.js` **sigue mal** (toma el primer bloque
> —LA TORTUGA/CARIBE— y tiene el `BASE` clavado en `denariocaribe`): se condujo el navegador con un
> `_open.js` propio en este RUN_DIR. **No se modificó `qa-web-open.js`** (norma de solo lectura).

---

# 0 · ⛔ LO PRIMERO: el módulo Reportes está CAÍDO ahora mismo

**Esto condiciona todo lo que sigue y no estaba en el informe auditado.** Entre las 11:05 y las 11:50 de
hoy, **las tres pantallas de Reportes que tienen datos devuelven error o vacío**, con la **misma base sin
cambios** y en la **misma sesión** en la que Facturaciones e Indicadores funcionan perfectamente.

| Pantalla | 09:43–09:50 (informe auditado) | **11:05–11:50 (esta auditoría)** | Intentos |
|---|---|---|---|
| **Cumplimiento de Cuota** | 3 búsquedas OK (1.220 · 1.171 · 468) | 🔴 **«Error en busqueda de reporte. / Intente nuevamente.»** | **20 de 20** |
| **Plan VS Cuota** | 5 búsquedas OK | 🔴 **mismo error** | **4 de 4** |
| **Activación de Clientes** | `total=1` (Empresa) y `total=7` (Vendedores) | 🟠 sin error, pero **«No se encontraron registros»** · `total=0` | **4 de 4** |
| Facturaciones | OK | ✅ **OK — 8 búsquedas, todas correctas** | 8 de 8 |
| Indicadores › Vendedores | OK | ✅ **OK — 10 búsquedas, todas correctas** | 10 de 10 |
| Indicadores › % Participación | OK | ✅ **OK — 5 búsquedas** | 5 de 5 |

**Lo que se descartó antes de afirmarlo:**

- **No es el método.** Se reprodujo **a mano**, con clics reales sobre cada `selectOneMenu` y
  `Escape` para cerrar el panel (`_human.js`): **mismo error** (`evidencia/HUMANO_CUMPL_ago.png`).
- **No es el atajo por JavaScript.** Se usó **el mismo `medir-cuota.js` de la corrida auditada**, copiado
  sin tocar y apuntado a mi puerto. El `POST` que sale es **byte a byte el mismo** que el suyo salvo el
  `ViewState` (comparados en `evidencia/resp-RV_CUM_ago01_31.txt` contra su
  `tres_modulos_20260915/evidencia/resp-CUMPL_AGO_Todos_Emp_Fact.txt`).
- **No es la sesión.** Se limpiaron cookies y se volvió a entrar (`_fresh.js`): mismo error.
- **No es el filtro ni la unidad.** Falla con `Pedido` y con `Facturado`; con `US$`, con `BS`, con
  `UNIDADES` y sin unidad; con ventana de un mes y de un día; con `Todos` y con un vendedor concreto.
  **Ninguna combinación devolvió nada.**
- **No es el dato.** `invoice` sigue en **46.564 filas** (idéntico a su Q0), `quota_plan_enterprise` en 72
  y `sales_plan_enterprise` en 12, con `da_update` del 15/08. **Nada se movió en la base.**
- **No es el combo `Roles`.** En Cumplimiento de Cuota **no existe ningún combo de rol** (se enumeraron
  todos los `select` de la página: 0 coincidencias con `/rol/i`). No hay filtro que arrastrar ni que
  limpiar. Se dejó constancia en cada medición (`combos-rol-presentes: []`).

⇒ **Es el defecto H1 del 11/09 («Plan vs Cuota lanza Error en busqueda de reporte») que ha vuelto**, y
ahora alcanza también a Cumplimiento de Cuota y deja a Activación de Clientes en blanco. Apareció
**entre las 09:50 y las 11:05 de hoy**, sin que la base cambiara. **Esto es un hallazgo nuevo por
derecho propio y, mientras dure, ninguna de las tres pantallas se puede volver a medir.**

**Consecuencia para esta auditoría:** el Hallazgo 1 y dos tercios del Hallazgo 2 viven en pantallas que
hoy no responden. Lo que sigue distingue con cuidado **lo que vi en pantalla hoy** de **lo que deduje de
la base** de lo que **no pude comprobar**.

---

# 1 · Hallazgo 1 · «Cumplimiento de Cuota se pasa un día en la Fecha Final»

## 🟡 **MATIZADO — la aritmética es exacta y la creo; pero HOY NO SE PUDO REPRODUCIR EN PANTALLA, y el borde izquierdo sigue sin mirar**

### 1.1 · Lo que sí pude medir yo, en pantalla

La pantalla acusada está caída (§0). Lo que sí hice fue **barrer las mismas fechas en las dos pantallas
que sí funcionan** y que el informe usa como controles negativos. **Ninguna de las dos se pasa de día, en
ningún extremo.**

**Transacciones › Facturaciones · Facturas cobradas** (`dateB`=inicio, `dateF`=fin):

| Ventana pedida | **Pantalla** | Base (correcto) | Si tuviera +1 día al final | Δ |
|---|---|---|---|---|
| 01/08 – 31/08 | **1.171** | 1.171 | 1.220 | **0** ✅ |
| 01/08 – 30/08 | **1.118** | 1.118 | 1.171 | **0** ✅ |
| 01/08 – 10/08 | **285** | 285 | 379 | **0** ✅ |
| 01/07 – 31/07 | **5.908** | 5.908 | 5.908 *(no discrimina)* | **0** ✅ |
| 01/07 – 30/07 | **5.865** | 5.865 | 5.908 | **0** ✅ |
| **13/07 – 13/07** | **285** | 285 | 932 | **0** ✅ |
| 01/09 – 10/09 | **444** | 444 | 468 | **0** ✅ |

**Indicadores › Vendedores · Todos · Facturado · US$** (⚠ aquí `dateF`=inicio y `dateB`=fin, al revés;
se verificó leyendo los valores por defecto de la pantalla antes de escribir):

| Ventana pedida | **Pantalla (Σ de las 5 filas)** | Base (correcto) | Si tuviera +1 día | Δ |
|---|---|---|---|---|
| 01/08 – 31/08 | **1.171 · 224.411,08** | 1.171 · 224.411,08 | 1.220 · 232.003,67 | **0,00** ✅ |
| 01/08 – 30/08 | **1.118 · 212.706,05** | 1.118 · 212.706,05 | 1.171 · 224.411,08 | **0,00** ✅ |
| 01/08 – 15/08 | **559 · 109.175,13** | 559 · 109.175,13 | 559 *(no discrimina)* | **0,00** ✅ |
| 01/08 – 10/08 | **285 · 57.733,98** | 285 · 57.733,98 | 379 · 78.699,09 | **0,00** ✅ |
| 01/07 – 31/07 | **5.908 · 1.270.978,81** | 5.908 · 1.270.978,81 | 5.908 *(no discrimina)* | **0,00** ✅ |
| 01/07 – 30/07 | **5.865 · 1.265.182,84** | 5.865 · 1.265.182,84 | 5.908 · 1.270.978,81 | **0,00** ✅ |
| **13/07 – 13/07** | **285 · 155.028,94** | 285 · 155.028,94 | 932 · 302.417,61 | **0,00** ✅ |
| 01/09 – 10/09 | **444 · 75.880,68** | 444 · 75.880,68 | 468 · 80.160,23 | **0,00** ✅ |

**15 ventanas, 15 exactas, en dos pantallas distintas.** El barrido incluye el caso limpio que faltaba:
**un solo día (13/07)**, que separa los tres escenarios de golpe —correcto 285, con un día de más 932, con
el primer día comido 0—. **Ninguna de las dos pantallas se come el primer día ni añade el siguiente.**
Capturas: `evidencia/FAC_*.png` e `evidencia/IND_*.png`.

### 1.2 · Lo que verifiqué en la base — y aquí el informe acierta al céntimo

Construí mi propio oráculo: **el total por día** del corte de vendedores (R2 en `sql/consultas.sql`).
Con él se calcula el valor esperado de cualquier ventana y también el que saldría con cada desfase.

```
vendedores 01/08–31/08 ......  1.171 | 224.411,08
+ solo el 01/09 .............     49 |   7.592,59
= lo que pintó la pantalla ..  1.220 | 232.003,67   ✔ exacto en las DOS columnas
```

**El 01/09 es el único día de toda la base con 49 facturas por 7.592,59.** Que coincidan **a la vez** el
número de facturas y el importe descarta la casualidad. Y la explicación alternativa que se podría pensar
—que estuviera colando las facturas de la EVA MEDINA borrada— **no cuadra**: eso daría
224.411,08 + 30.992,23 = **255.403,31**, no 232.003,67.

El control del informe también cierra por aritmética: pidiéndole 01/08–30/08 devolvió **224.411,08 · 1.171**,
que es agosto **hasta el 31**. Son **dos confirmaciones independientes** del mismo desfase de un día al
final (el 31/08 tiene 53 facturas y el 01/09 tiene 49; en los dos casos el día extra entró).

### 1.3 · Lo que el barrido corrige del informe

🔑 **Dos de las fechas que el encargo pedía probar NO SIRVEN, y conviene saberlo antes de que alguien
las use para «confirmar» o «desmentir» la tarjeta:**

| Ventana | ¿Discrimina un día de más al final? | Por qué |
|---|---|---|
| **01/08 – 15/08** | ❌ **NO** | **el 16/08 no tiene ni una factura** (domingo): con desfase o sin él, 559 · 109.175,13 |
| **01/07 – 31/07** | ❌ **NO** | **el 01/08 tampoco tiene facturas** (sábado): 5.908 · 1.270.978,81 en los dos casos |
| 01/09 – 14/09 | ❌ **NO** | la última factura de la base es del **11/09** |
| 01/08 – 10/08 | ✅ sí | el 11/08 tiene 94 · 20.965,11 |
| 01/07 – 30/07 | ✅ sí | el 31/07 tiene 43 · 5.795,97 |
| 01/09 – 10/09 | ✅ sí | el 11/09 tiene 24 · 4.279,55 |
| **13/07 – 13/07** | ✅ **el mejor** | separa los dos bordes a la vez: 285 vs 932 vs 0 |

**Esto explica por qué el defecto no se vio el 14/09** —y lo explica mejor que el informe, que solo
nombraba septiembre—: **los fines de semana sin facturación esconden el desfase**. En INSUMAR hay
facturas de lunes a viernes; cualquier cierre que termine en viernes lo tapa.

### 1.4 · Lo que NO pude comprobar

- **El desfase en sí, en pantalla, hoy.** La pantalla está caída (§0). **20 intentos, 20 errores**, el último a las **11:50**.
- **Si el desfase es sistemático fuera de agosto.** Las dos confirmaciones que existen (31/08 y 01/09)
  están **en la misma frontera de mes**. Haría falta repetir 01/08–10/08, 01/07–30/07 y 13/07–13/07
  **en Cumplimiento de Cuota** cuando la pantalla vuelva. **Sin eso, «desfase sistemático» tiene dos
  puntos, no siete.**
- 🔑 **El borde izquierdo de Cumplimiento de Cuota: SIGUE SIN MIRAR.** El informe no lo miró y yo
  tampoco pude. Ojo: **sus dos mediciones no dicen nada del borde izquierdo**, porque las dos arrancan el
  **01/08 y los días 01 y 02 de agosto están vacíos**. Un desfase de un día al inicio sería **invisible**
  en las dos. La prueba que hay que hacer es **01/07–31/07** (correcto 5.908; con el primer día comido
  **5.715 · 1.195.421,75**) o, mejor, **13/07–13/07**.
- **Plan vs Cuota y Facturaciones como controles negativos de Cumplimiento.** Facturaciones **sí** lo
  confirmé yo (7 ventanas). **Plan vs Cuota no**: está caída. Lo que el informe dice de Plan vs Cuota
  queda **sin re-verificar**.

### 1.5 · Veredicto

**Estoy de acuerdo con el hallazgo, con dos matices que lo hacen más chico y más grande a la vez.**
Más chico: **no es un desfase medido en siete ventanas, son dos puntos en la misma frontera de mes**, y
hoy no se puede volver a medir. Más grande: **el informe se queda corto al explicar por qué no se vio** —
no es solo que septiembre no tenga días siguientes, es que **los fines de semana lo esconden**, y eso
afecta a cualquier cierre que termine en viernes. **El borde izquierdo sigue siendo un agujero.**

---

# 2 · Hallazgo 2 · «Los importes de la vista por Línea están inflados»

## 🔴 **CONFIRMADO en su causa, y la causa es PEOR de lo que dice el informe** · 🟡 pero el alcance de «tres pantallas» solo pude comprobarlo en una

### 2.1 · La causa, verificada por mí sobre facturas de rol 7

Cogí las cuatro facturas de vendedor con más líneas de septiembre y las abrí una por una (R4):

| Factura | Cabecera (US$) | Tasa `nu_value_local` | Líneas | **Valores distintos en `nu_amount_total`** | Importe de cada línea | Importe ÷ cabecera |
|---|---|---|---|---|---|---|
| `20096641` | 162,01 | 801,18 | 30 | **1** | 129.799,16 | **801,1799** |
| `20096541` | 141,83 | 798,33 | 30 | **1** | 113.227,20 | **798,3304** |
| `20096569` | 83,58 | 798,33 | 30 | **1** | 66.724,45 | **798,3303** |
| `20096768` | 266,84 | 804,81 | 30 | **1** | 214.755,50 | **804,8100** |

**Confirmado al dígito:** todas las líneas de una misma factura traen **el mismo** importe, y ese importe
es **el total de la cabecera multiplicado por la tasa del día**. Una factura de 162 US$ aporta
30 × 129.799,16 = **3.893.974,80** a la columna.

🔑 **Y aquí va lo que el informe no vio:**

1. **`nu_amount_total_conversion` está igual de mal.** También es **único por factura** (`dist_conv = 1`)
   y vale **el total de la cabecera en US$ repetido en cada línea**. El informe lo usa como si fuera la
   cifra sana (1.142.201,63) para sacar «la tasa ≈792». **No lo es:** 1.142.201,63 frente a los
   **80.160,23** reales es **×14,25** — exactamente el promedio ponderado de líneas por factura.
   **Ninguna de las dos columnas de importe de `invoice_detail` sirve.**
2. **No hay ninguna columna de la que sacar el importe correcto de una línea.**
   `nu_price_final` y `qu_total` están **vacías en las 440.059 filas** de la tabla (R5). No es que el
   reporte sume la columna equivocada: **es que la columna buena no existe en el dato**. Eso cambia la
   conversación con desarrollo: no es un `SELECT` mal escrito, es el sincronizador.
3. En el **4 %** de las facturas (273 de 7.370 de septiembre) hay 2-3 valores distintos por factura —
   y tampoco son importes de línea: son ~856× la cabecera, con pinta de totales intermedios.
   **El patrón no falla nunca hacia «importe de línea».**

### 2.2 · La cifra de pantalla, reproducida al céntimo y **con el JOIN ya en rol 7**

🔑 **Este es el dato que separa esta tarjeta de la del filtro de vendedores, y lo confirmo.** Reconstruí
la vista por Línea desde cero, atravesando `product` → `product_structure` (nivel 2 = Proveedor) →
padre (nivel 1 = Línea), **con el JOIN restringido a `salesman_view.co_role = 7`** (R6):

| | Filas de `invoice_detail` | **Facturas distintas** | Σ columna inflada | Σ `_conversion` | Correcto (cabecera) |
|---|---|---|---|---|---|
| **sep 01–14** | 4.719 | **468** | **905.028.443,33** | 1.142.201,63 | **80.160,23** |
| **ago 01–31** | 11.749 | **1.171** | **2.469.301.992,11** | 3.249.076,61 | **224.411,08** |

**Las facturas distintas son 468 y 1.171 — exactamente las del corte de vendedores.** Es decir: **la
pantalla está filtrando bien las filas; cada factura entra una sola vez y solo entran vendedores.** Lo
que está roto es **la columna de importe**. El factor es **×11.290** (sep) y **×11.004** (ago) = tasa
(~800) × líneas por factura (~14).

El desglose me sale en **18 Líneas** —las mismas 18 filas que la pantalla mostró el 15/09— y suman
905.028.443,33 al céntimo: GALLETAS 280.303.497,85 · PASAPALOS 125.071.197,08 · ALIMENTOS 108.994.839,97 ·
… · TORTAS 853.353,68.

### 2.3 · El contraste Empresa vs Línea en las tres pantallas

| Pantalla | Empresa | Línea | Factor | ¿Lo medí hoy? |
|---|---|---|---|---|
| **Plan VS Cuota** | 80.160,23 (sep) | 905.028.443,33 | ×11.290 | ❌ **no — pantalla caída (§0)** |
| **Cumplimiento de Cuota** | 80.160,23 (sep) | 905.028.443,33 | ×11.290 | ❌ **no — pantalla caída (§0)** |
| **Indicadores › % Participación** | — *(no tiene vista Empresa)* | ver abajo | ver abajo | ✅ **sí** |

**De las tres pantallas solo pude medir una.** Las cifras de las otras dos las **reproduje desde la base
al céntimo** (§2.2), que es la mitad fuerte de la prueba, pero **la lectura de pantalla de hoy no existe**.

### 2.4 · % de Participación: inflado sí, «misma familia que K2» **no está probado**

Medido hoy (`Todos · Linea · Facturado · US$ · 01/08–31/08`, series leídas del widget del gráfico,
`evidencia/RV_PART_ago_Linea_v2.png`):

| Línea | **Pantalla** | Facturación real del mes (todos los vendedores) | Factor |
|---|---|---|---|
| GALLETAS | **65.572.743,59** | 224.411,08 | **×292** |
| ALIMENTOS | 38.848.021,98 | | |
| PASAPALOS | 19.494.395,33 | | |
| BEBIDAS | 13.202.526,25 | | |
| CONDIMENTOS | 10.711.839,95 | | |
| … (top 10) | **Σ 168.996.675,76** | **224.411,08** | **×753** |

**Inflado: confirmado, y con número.** Un solo renglón vale 292 veces la facturación del mes entero.

🔑 **Pero el informe lo mete en la misma familia que K2 y eso no lo sostiene el dato.** Probé los
candidatos y **ninguno reproduce la cifra**:

| Hipótesis | GALLETAS agosto | Pantalla | ¿Coincide? |
|---|---|---|---|
| `sum(invoice_detail.nu_amount_total)` rol 7 | 798.361.236,62 | 65.572.743,59 | ❌ ×12,2 |
| ídem sin repetir factura | 155.355.715,44 | 65.572.743,59 | ❌ ×2,37 |
| `sum(nu_price_base)` rol 7 | 37.719.231,85 | 65.572.743,59 | ❌ ×0,58 |
| `sum(nu_amount_total_conversion)` rol 7 | 1.054.610,47 | 65.572.743,59 | ❌ |
| todas las filas (con transportistas) | 10.884.226.876,80 | 65.572.743,59 | ❌ |

⇒ **% de Participación está inflado por otra fórmula.** Puede acabar siendo el mismo origen, pero
**hoy no está demostrado**, y si se cierra K2 arreglando la columna de `invoice_detail`, **% de
Participación puede seguir mal**. **Conviene que vaya como caso aparte dentro de la misma tarjeta.**

**Lo que sí probé de % Participación:** el filtro de vendedor **funciona y parte los datos**
(VIVIANA sola: GALLETAS 20.585.191,11 frente a 65.572.743,59 de Todos), y **no muestra transportistas**.

### 2.5 · Sub-Línea y las demás visualizaciones

- **«Sub-Línea» no existe en INSUMAR, y lo confirma la base, no solo el combo.** La estructura de
  producto tiene **dos niveles: 1 = «Linea», 2 = «Proveedor»** (R7), con **18 líneas y 161 proveedores**.
  El nivel 2 se renombró a «Proveedor» el **31/08/2026**. **Cualquier caso de prueba que nombre
  «Sub-Línea» es inválido para este cliente** — no es que la opción falte en pantalla: **no existe el
  dato**.
- **% Participación › Proveedor: también inflado**, medido hoy: `MONDELEZ VZ, C.A - GALLETAS`
  **50.697.679,76** en un mes de 224.411,08 (`evidencia/RV_PART_ago_Prov.png`).
- **Canales de distribución, País y Estado: NO COMPROBADO.** Solo viven en Plan vs Cuota y Cumplimiento
  de Cuota, que están caídas. **Lo único que puedo decir es una expectativa, no una medición:** País y
  Estado son dimensiones de *cliente* (la estructura de empresa es 1=Pais, 2=Estado) y Canales también,
  así que **podrían salir de la cabecera y estar sanas**; Línea, Proveedor y Productos son dimensiones de
  *producto* y **obligan a pasar por `invoice_detail`**. Hay que medirlo cuando la pantalla vuelva.

### 2.6 · Veredicto

**Estoy de acuerdo, y el hallazgo es MÁS GRANDE de lo que se afirmó en la causa y MÁS PEQUEÑO en el
alcance demostrado.** Más grande: **las dos columnas de importe de `invoice_detail` están mal, no una**,
y **la columna correcta no existe en el dato** (`nu_price_final` y `qu_total` vacías en 440.059 filas).
Más pequeño: **de las tres pantallas afectadas solo se pudo leer una hoy**, y **la de % de Participación
no sale de la misma fórmula** — va inflada, pero por otro sitio.

---

# 3 · Hallazgo 3 · «EVA MEDINA duplicada: 233 facturas invisibles»

## 🔴 **CONFIRMADO, y es BASTANTE MÁS GRANDE de lo que se afirmó**

### 3.1 · La aritmética: exacta

| | Facturas | Monto (US$) |
|---|---|---|
| Rol 7 **vivos** (`salesman_view`), agosto | 1.171 | **224.411,08** |
| Rol 7 **incluyendo el borrado** (`role_user`, sin filtrar `co_operation`) | 1.404 | **255.403,31** |
| **Diferencia** | **233** | **30.992,23** |

**Cuadra al céntimo.** Y lo comprobé por dos caminos que dan lo mismo: `salesman_view` y
`role_user + users.co_operation<>'D'` devuelven ambos 1.171 · 224.411,08 (R1), así que **no es artefacto
del criterio elegido**.

**Y lo vi en pantalla, hoy, en tres sitios distintos** —no solo deducido de la base—:

| Pantalla | Qué pedí | **Resultado en pantalla** | Base |
|---|---|---|---|
| **Indicadores › Vendedores** | Todos · Facturado · US$ · ago | 5 filas · **1.171 · 224.411,08** — **EVA no aparece** | 1.171 · 224.411,08 ✅ |
| **Indicadores › Vendedores** | **EVA MEDINA** · Facturado · ago | **«No existe registro»** | la EVA nueva (id 22) tiene **0** facturas |
| **Facturaciones** | EVA MEDINA · Facturas cobradas · ago | **Total de Resultados: 0** (el combo manda `id=22`) | id 13 tiene **233** |
| **Indicadores › % Participación** | EVA MEDINA · Facturado · ago | **gráficos vacíos** | ídem |

Capturas: `RV_IND_VEND_ago.png`, `RV_IND_EVA_ago.png`, `FAC_ago_EVA.png`, `RV_PART_ago_EVA.png`.

### 3.2 · El relevo del 25/08: confirmado, y por una vía que el informe no usó

`users.da_update` es del 11/09 para **los 24 usuarios** (sello de sincronización), así que no sirve para
fechar nada. **Lo que sí fecha el relevo son los documentos** (R10):

| id_user | co_user | Pedidos | Monto | Primero | Último | ¿En `salesman_view`? |
|---|---|---|---|---|---|---|
| **13** | R003 | **143** | 19.286,24 | **11/08/2026** | **24/08/2026** | ❌ **NO** |
| **22** | R003 | 158 | 22.218,33 | **25/08/2026** | 11/09/2026 | ✅ sí |

**Sin un solo día de solape: el id viejo muere el 24/08 y el nuevo arranca el 25/08.** La última factura
del id 13 también es del **24/08**. **El 25/08/2026 queda confirmado.**

### 3.3 · 🔑 Lo que el informe NO buscó: **no es una usuaria, son TRES id_user**

El encargo pedía mirar si había más casos. **Los hay, y cambian el tamaño de la tarjeta.** Busqué todas
las facturas cuyo `id_user` **no alcanza `salesman_view`** (R9):

| `id_user` | `co_user` | Facturas | Monto (US$) | Rango | ¿Existe en `users`? |
|---|---|---|---|---|---|
| **13** | R003 (EVA MEDINA) | **1.881** | **293.168,86** | 12/02 – 24/08/2026 | sí, con `co_operation='D'` |
| **470** | **R013** (¡el código de VIVIANA!) | **644** | **138.790,15** | 17/04 – 08/07/2026 | ❌ **NO EXISTE** |
| **471** | R006 | **282** | 5.633.764,69 | 23/09/2020 – 08/07/2026 | ❌ **NO EXISTE** |
| | | **2.807** | | | |

**Dos matices honestos sobre esa tabla:**

- De los 5,63 M del id 471, **5.575.500,00 son UNA sola factura de 2020 en BS** — ruido histórico. Su
  aporte real de 2026 es **281 facturas por 58.264,69 US$**.
- **Los id 470 y 471 no tienen facturas en agosto** (su última es del 08/07). **Por eso la aritmética de
  agosto del informe —233 y 30.992,23— sigue siendo exacta.** El agujero de agosto es solo EVA.

**Pero en el año la cosa cambia de escala:**

| | Facturas | Monto 2026 (US$) |
|---|---|---|
| Lo que muestran las pantallas (rol 7 en `salesman_view`) | 8.261 | **1.733.804,89** |
| **Invisible** (id 13 + 470 + 471) | **2.806** | **490.223,70** |
| | | **+28,3 %** |

Y hay un caso que merece su propio renglón: **el id 470 lleva el código `R013`, que es el de VIVIANA
ESCALANTE.** VIVIANA muestra 2.581 facturas por 620.124,82 en 2026; **hay 644 más por 138.790,15 colgando
de un `id_user` fantasma con su mismo código**. Es decir: **la cifra de la vendedora que más factura está
incompleta en un 22 %**, y eso **no tiene nada que ver con una baja de usuario** — es un `id_user` que
**no existe en `users`**, así que no es «un borrado», es una **referencia rota**. **Es un caso distinto y
probablemente otra tarjeta.**

### 3.4 · Pedidos: sí, y mis números son mayores que los del antecedente

| | Pedidos | Monto | Líneas de detalle | Rango |
|---|---|---|---|---|
| Antecedente citado (11/09) | 128 | — | 1.247 | 12 – 24/08 |
| **Medido hoy** | **143** | **19.286,24** | **1.397** | **11 – 24/08** |

**Son 15 pedidos y 150 líneas más de lo que decía el antecedente**, y empiezan un día antes. Los 143
pedidos invisibles son el **23 % de los 620 pedidos que hay en toda la base**. Y **el id 13 es el único
usuario con pedidos fuera de `salesman_view`** (los fantasmas 470 y 471 no tienen pedidos).

### 3.5 · Un dato suelto que salió de paso y conviene mirar

**La EVA nueva (id 22) tiene 158 pedidos desde el 25/08 pero CERO facturas, nunca.** No hay ni una
factura con `co_user='R003'` posterior al 24/08 (R11). Los otros cuatro vendedores sí facturan en ese
período. **O no se le está facturando, o sus facturas no están llegando.** No lo investigué —queda
**anotado, no comprobado**.

### 3.6 · ⚠ La pregunta de criterio (la planteo, no la resuelvo)

**El dato dice esto, y solo esto:**

- Si «vendedores» significa **los que están de alta hoy**, entonces **224.411,08 es correcto** y esto
  **no es un defecto de la pantalla**: es una consecuencia esperable de dar de baja a una vendedora.
- Si «vendedores» significa **todas las facturas hechas por un vendedor en el período**, entonces
  **faltan 233 facturas por 30.992,23** en agosto —y **2.806 por 490.223,70 en el año**— y **el cierre
  de mes de agosto está mal en un 13,8 %**.

**Lo que inclina la balanza —y es un hecho, no una opinión:** las 233 facturas **ocurrieron**, las hizo
una persona que **estaba de alta cuando las hizo**, y hoy **no aparecen en ninguna pantalla**: ni
sumadas a nadie, ni en una fila de «sin vendedor», ni en un total general. **Desaparecen.** Sea cual sea
el criterio que se elija, **una factura cobrada que no aparece en ningún reporte es un agujero de
cuadre**, y el caso del `id_user` 470 (§3.3) demuestra que **puede pasar sin que nadie dé de baja a
nadie**.

**La decisión es del equipo funcional. No la tomo.**

### 3.7 · Veredicto

**Estoy de acuerdo, y el hallazgo es MÁS GRANDE de lo que se afirmó.** La aritmética de agosto es
**exacta** (233 · 30.992,23) y la verifiqué en pantalla en tres sitios. Pero **no es una usuaria: son
tres `id_user`**, dos de ellos **ni siquiera existen en `users`**; el agujero del año es
**2.806 facturas por 490.223,70 US$ (+28,3 %)**, no 233; los pedidos afectados son **143 con 1.397
líneas** (más que los 128/1.247 del antecedente); y **la vendedora que más factura tiene un 22 % de su
año colgando de un `id_user` fantasma**.

---

# 4 · Resumen

| # | Hallazgo | Veredicto | Qué cambia |
|---|---|---|---|
| **1** | Cumplimiento de Cuota se pasa un día en la Fecha Final | 🟡 **MATIZADO** | Aritmética **exacta** contra mi oráculo por día; **2 puntos de confirmación, los dos en la frontera ago/sep**; **no reproducible hoy** (pantalla caída, 14/14 error); **borde izquierdo sigue sin mirar**; **01/08–15/08 y 01/07–31/07 no discriminan** (16/08 y 01/08 sin facturas) |
| **2** | Importes de la vista por Línea inflados | 🔴 **CONFIRMADO** (causa) / 🟡 alcance | Causa verificada factura a factura **con el JOIN ya en rol 7** (468 y 1.171 facturas distintas); **`_conversion` también está mal (×14,25)**; **no existe columna de importe de línea** (`nu_price_final`/`qu_total` vacías en 440.059 filas); **% Participación NO sale de la misma fórmula** — inflado ×753, origen sin identificar; **Canales/País/Estado no comprobados** |
| **3** | EVA MEDINA duplicada: 233 facturas invisibles | 🔴 **CONFIRMADO Y MAYOR** | 233 · 30.992,23 exacto y visto en 3 pantallas; pero son **3 `id_user`, no 1** (dos **no existen en `users`**); año 2026: **2.806 facturas · 490.223,70 US$ (+28,3 %)**; pedidos **143 / 1.397 líneas** (antes 128/1.247); **VIVIANA tiene un 22 % de su año en un id fantasma**; relevo del **25/08 confirmado** por fechas de documento |
| **0** | 🆕 **El módulo Reportes está caído** | 🔴 **NUEVO** | Entre las **09:50 y las 11:05 de hoy**, Cumplimiento de Cuota (20/20) y Plan vs Cuota (4/4) pasaron a dar **«Error en busqueda de reporte.»** y Activación de Clientes (4/4) a devolver 0 filas; seguía igual a las **11:50**. **Base sin cambios**; Facturaciones e Indicadores siguen bien en la misma sesión; reproducido **a mano** y con **sesión nueva**. Es **H1 (11/09) que ha vuelto y se ha extendido** |

## Lo que queda «no comprobado»

- El desfase de un día **en la propia pantalla**, hoy.
- El **borde izquierdo** de Cumplimiento de Cuota (ni el informe ni yo).
- Si el desfase aparece **fuera de la frontera ago/sep**.
- El contraste **Empresa vs Línea en Plan vs Cuota y Cumplimiento de Cuota**, en pantalla, hoy.
- Las visualizaciones **Canales de distribución, País, Estado y Productos**.
- La **fórmula** de % de Participación (5 hipótesis probadas, ninguna cuadra).
- **Por qué** el módulo Reportes cayó entre las 09:50 y las 11:05 (no se leyó `../src/`, fuera de alcance).
- Por qué la **EVA nueva (id 22)** tiene 158 pedidos y **ninguna factura**.
- Qué ve un usuario **que no sea `admin`**.

---

# 5 · Método y evidencia

- **Sesión propia**, Chrome en CDP `:9413`, perfil `qa-insumar-reverif-profile`. **No se tocó el teléfono
  ni su CDP**, ni la web de CARIBE.
- **51 búsquedas medidas** hoy (8 Facturaciones · 10 Indicadores › Vendedores · 5 % Participación ·
  **28 intentos contra el módulo Reportes**: 20 en Cumplimiento de Cuota, 4 en Plan vs Cuota y 4 en
  Activación de Clientes), cada una con captura y con el cuerpo del POST y de la respuesta AJAX en
  `evidencia/`.
- **Guarda de llegada** en cada navegación (reintenta 4 veces y comprueba que hay `form` y que no es un
  404 de Tomcat) y `MSYS_NO_PATHCONV=1` en todas las llamadas, para no confundir un 404 con «la pantalla
  no devuelve nada».
- **Los ceros se comprobaron**: cada `total=0` de esta auditoría va acompañado del estado exacto del
  formulario justo antes de pulsar Buscar (`pre={...}` en cada `res-*.json`) y de la captura.
- **Combo `Roles`:** se enumeraron todos los `select` de cada pantalla antes de cada medición. En
  Cumplimiento de Cuota **no existe ninguno** (`combos-rol-presentes: []`), así que no había filtro que
  arrastrar. En Plan vs Cuota tampoco.
- ⚠ **`dateF`/`dateB`:** verificado leyendo los valores por defecto de cada pantalla antes de escribir.
  **Indicadores y % Participación: `dateF`=inicio, `dateB`=fin. Facturaciones: `dateB`=inicio,
  `dateF`=fin.** Está al revés y es la trampa que más barata sale de comprobar.
- **Consultas:** `sql/consultas.sql`, escritas de cero para esta auditoría (R0–R12). **Todas SELECT.**

## Archivos

| | |
|---|---|
| `sql/consultas.sql` | Las 13 consultas de esta auditoría, con su resultado comentado |
| `evidencia/FAC_*.png` · `res-FAC_*.json` | Barrido de fechas en Facturaciones (7 ventanas + EVA) |
| `evidencia/IND_*.png` · `res-IND_*.json` | Barrido de fechas en Indicadores › Vendedores (8 ventanas) |
| `evidencia/RV_PART_*.png` | % de Participación: Línea, Proveedor, VIVIANA, EVA |
| `evidencia/RV*_CUM_*.png` · `RV*_PLAN_*.png` · `RV_ACTIV*.png` | Los 28 intentos contra el módulo Reportes caído |
| `evidencia/HUMANO_CUMPL_ago.png` | Reproducción **a mano** del error, con clics reales |
| `evidencia/resp-*.txt` | POST enviado + respuesta AJAX completa de cada medición |
| `_open.js` · `_drv.js` · `_fact.js` · `_ind.js` · `_part.js` · `_human.js` · `_fresh.js` | Conducción propia (puerto 9413) |
| `medir-cuota.js` · `_pick2.js` | **Copia sin modificar** del driver de la corrida auditada, para que el error no se pudiera achacar al método |
