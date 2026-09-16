# 4K · ¿Cobranzas ignora el filtro de vendedor, también aquí?

# 🔴 SÍ, SE REPLICA EN 4K — pero sólo en el GRÁFICO DE BARRAS, no en toda la pantalla: las 4 tarjetas KPI **sí** filtran, y cuadran al céntimo.

| | |
|---|---|
| **Fecha** | 2026-09-15 |
| **Cliente / base** | IMPORTADORA 4K · empresa única `DIESE` — GRUPO 4K · base `4k` |
| **Playa** | **CARIBE** — `http://denariocaribe.ddns.net:8080/DenarioPremium` · usuario `admin` |
| **Pantalla** | `Indicadores › Cobranzas` → `/pages/protected/indicadores/indicadorCobros.xhtml` |
| **Capa** | **Solo web + base, solo lectura.** No se tocó móvil, ni CDP de dispositivo, ni El Yaque. **0 escrituras** |
| **Mediciones** | **11 búsquedas** (4 vendedores + Todos + 6 controles), cada una con su cuerpo AJAX crudo |
| **Antecedente** | INSUMAR · `reports/insumar/promotor_en_vendedores_20260915/01-promotor-en-vendedores.md` §5 |

---

# LA RESPUESTA, EN CUATRO FRASES

1. **El gráfico «Cobros por métodos de pago por rango de fecha» devuelve la MISMA serie con
   `Todos`, con `V.0030` (36 cobros) y con `V.0019` (1 cobro).** Idéntica al céntimo. **El defecto
   de INSUMAR se replica en otro tenant y otra playa ⇒ es del producto, no de la instalación de El Yaque.**
2. **Y no ignora sólo al vendedor: ignora también el Cliente y el Tipo de Cobro.** Sólo obedece
   a **Moneda** y **Fechas**. *(Controlado: cambiando moneda o fechas la serie sí cambia.)*
3. 🔑 **No es que el gráfico no filtre por vendedor: es que filtra por TODOS los vendedores a la vez.**
   Su universo cuadra **al céntimo, en las tres barras**, con los **11 usuarios que ofrece su propio
   combo** — ni uno más (deja fuera a la supervisora `V.0016`, que no está en el combo). La consulta
   sabe acotar a «los vendedores»; lo que pierde es **cuál** se eligió.
4. 🟢 **Las 4 tarjetas KPI de arriba SÍ hacen caso** al vendedor, al cliente y al tipo, y **cuadran al
   céntimo contra la base en las 11 mediciones**. Por eso la pantalla es especialmente traicionera:
   **la tarjeta dice 7.574,76 y el gráfico de al lado dice 243.117,74, con el mismo filtro puesto.**

---

# 1 · LAS TRES MEDICIONES, LADO A LADO

Mismos filtros en las tres. **Sólo cambia el vendedor.** Rango `01/08/2026 – 31/08/2026`, moneda `US$`,
empresa `GRUPO 4K`, sin cliente, sin tipo, sin status.

| | **① Todos** | **② `V.0030` JOAN BRICEÑO** | **③ `V.0019` KEY ROBINSON** |
|---|---|---|---|
| `idSalesmaView` **que viajó en el POST** | *(vacío)* | **`338`** | **`339`** |
| `dateF_input` / `dateB_input` enviados | `01/08/2026` / `31/08/2026` | igual | igual |
| Cobros reales del vendedor en agosto *(base)* | 200 | **36** | **1** |
| **🔴 Gráfico · Transferencia(tr)** | **234.160,48** | **234.160,48** | **234.160,48** |
| **🔴 Gráfico · Deposito(de)** | **6.465,26** | **6.465,26** | **6.465,26** |
| **🔴 Gráfico · Efectivo(ef)** | **2.492,00** | **2.492,00** | **2.492,00** |
| **🔴 Σ gráfico** | **243.117,74** | **243.117,74** | **243.117,74** |
| 🟢 Tarjeta «Total Cobrado por Fecha (filtro)» | 202.231,96 | **7.574,76** | **250,00** |
| 🟢 Tarjeta «Total Cobrado Mes» | 202.231,96 | 7.574,76 | 250,00 |
| 🟢 Tarjeta «Total Cobrado Año» | 526.504,39 | 46.838,43 | 797,00 |
| Gráfico «Facturación y Cobranzas por mes» | 12 meses, idéntico | idéntico | idéntico |
| Evidencia | `cobr_todos.*` | `cobr_v0030.*` | `cobr_v0019.*` |

**Las tres series del gráfico son idénticas dígito a dígito.** Y **no es que el vendedor no se
seleccionara**: el cuerpo crudo del POST (`evidencia/req-cobr_v0030.txt`, `req-cobr_v0019.txt`) lleva
`form:j_idt115:idSalesmaView_input=338` y `=339`. **El valor llega al servidor y el servidor lo tira.**

## Cuarto vendedor, por si acaso

`V.0002` ANGEL BETANCOURT (35 cobros) — `idSalesmaView=300`: **gráfico otra vez `234160.48 / 6465.26 /
2492.00`**, tarjeta `179.450,70`. *(`cobr_v0002.*`)*

> ⚠ **`V.0017` ARMANDO SUAREZ queda fuera del análisis**, como pedía el encargo: su rol 9 es
> contaminación de pruebas. Sí se le nombra en §3 porque **está dentro del total que pinta el gráfico**,
> pero **no se usa como vendedor de referencia** ni se concluye nada de su caso.

---

# 2 · LOS CONTROLES · «un cero no es un resultado», y una serie repetida tampoco

Una serie idéntica sólo significa algo si la misma pantalla, con el mismo `Buscar`, **sí cambia cuando
cambia otra cosa**. Se comprobó:

| Control | Qué se cambió | Serie del gráfico | Tarjeta «filtro» | Lectura |
|---|---|---|---|---|
| **A** | Moneda `US$` → **`Bs`** | `201.412.039,20 / 5.540.793,20 / 2.114.200,00` | `34.600.365,20 Bs` | 🟢 **cambia** ⇒ el `Buscar` sí re-consulta |
| **B** | Fecha inicio `01/08` → **`01/07`** | `359.872,84 / 22.039,42 / 15.944,71` | `275.162,35` | 🟢 **cambia** ⇒ las fechas **sí** se aplican |
| **C** | Repetir `V.0030` en otra corrida | `234.160,48 / 6.465,26 / 2.492,00` | `7.574,76` | determinista, no es un tropiezo |
| **D** | Cliente = **MSDIESEL 2022** (7 cobros) | **sin cambio** | `0,00` | 🔴 el gráfico **ignora también el cliente** |
| **F** | Tipo Cobro = **Anticipo/Prepago** | **sin cambio** | `187.230,46` | 🔴 el gráfico **ignora también el tipo** |

⇒ **El gráfico sólo obedece a Moneda y Fechas. Vendedor, Cliente y Tipo de Cobro los descarta.**
⇒ **Las tarjetas obedecen a los cinco.**

> 🟢 **De paso queda contestada la duda que INSUMAR dejó abierta** («¿ignora también el rango de
> fechas?»): **no.** El control B mueve la serie al mover la fecha de inicio. Lo que sí es anual **por
> diseño** es el segundo gráfico, «Facturación y Cobranzas por mes», que rotula los 12 meses y avisa
> al pie: *«Los datos se muestran como porcentajes de la facturación total de cada mes»*.

---

# 3 · 🔑 QUÉ SUMA EL GRÁFICO, EXACTAMENTE — cuadrado contra la base

No se quedó en «da lo mismo siempre». **Se identificó qué conjunto está sumando**, y cuadra al céntimo.

## 3.1 · El universo es «los 11 del combo», todos a la vez

| Forma de pago | **Pantalla** | **Base** · `id_user IN (los 11 del combo)` *(Q3)* | Δ |
|---|---|---|---|
| Transferencia(tr) | **234.160,48** | **234.160,48** | **0,00** |
| Deposito(de) | **6.465,26** | **6.465,26** | **0,00** |
| Efectivo(ef) | **2.492,00** | **2.492,00** | **0,00** |

**Tres barras, tres coincidencias exactas.** Y **no es «todos los usuarios»**: si se quita la
restricción, sobran `+450,00` en efectivo y `+2.402,90` en transferencia *(Q4)* — que son, exactamente,
los 13 cobros de **`V.0016` JENNY RIVERO**, rol 6 (supervisora), **la única con cobros en agosto que
NO aparece en el combo de vendedor**.

> **Por qué importa para la tarjeta de desarrollo:** la consulta **sí sabe** acotar al conjunto de
> vendedores — es decir, el `WHERE` del vendedor existe y se construye. Lo que se pierde por el camino
> es **el id elegido**: se está filtrando por *la lista* en vez de por *la selección*. Es un defecto de
> una línea, no un filtro ausente. *(Inferencia sobre medición: `../src/` fuera de alcance.)*

## 3.2 · Lo que el gráfico DEBERÍA pintar

| | **`V.0030`** *(Q5)* | **`V.0019`** *(Q6)* |
|---|---|---|
| Transferencia(tr) | 12.979,46 | — |
| Deposito(de) | 4.050,76 | **250,00** |
| Efectivo(ef) | 600,00 | — |
| **Σ correcto** | **17.630,22 US$** | **250,00 US$** |
| **Σ que pinta** | **243.117,74 US$** | **243.117,74 US$** |
| **Error** | **×13,8 — sobra 225.487,52** | **×972,5 — sobra 242.867,74** |

`V.0019` debería enseñar **una sola barra**. Enseña las tres, con el cobro de toda la empresa.

---

# 4 · LA SEGUNDA PREGUNTA DEL ENCARGO · ¿el total de `V.0030` cuadra con sus 36 cobros?

Hay que contestarla **en dos mitades, porque la pantalla da dos cifras distintas** para el mismo filtro.

### 🔴 El gráfico: **no cuadra, y no por redondeo** — enseña 243.117,74 cuando le corresponden 17.630,22.
Es la consecuencia directa del §3, no un hallazgo aparte.

### 🟢 La tarjeta: **cuadra al céntimo contra la base** — `7.574,76` = `7.574,76` *(Q7)*.
**Pero son 8 de sus 36 cobros, no los 36.** El desglose *(Q11)*:

| `V.0030` en agosto | Cobros | Importe |
|---|---|---|
| Emitidos **en USD** | **8** | **7.574,76 US$** ← lo que enseña la tarjeta |
| Emitidos **en Bs** | 28 | ≡ 4.158,62 US$ *(por su propia conversión)* |
| **Total** | **36** | **≡ 11.733,38 US$** |

⇒ **Con `Moneda = US$`, la tarjeta cuenta sólo los cobros EMITIDOS en dólares, no el equivalente en
dólares de todo lo cobrado.** Puede ser el criterio querido —«cobros en divisa»— pero conviene decidirlo,
**porque el gráfico de la misma pantalla usa el criterio contrario**: sus tres barras **sí** incluyen los
cobros en Bs convertidos *(por eso cuadran con `nu_amount_partial_conversion`, Q3)*.

> 🟡 **Hallazgo aparte, separado del filtro de vendedor:**
> **en una misma pantalla y con un mismo `Moneda = US$`, la tarjeta y el gráfico aplican dos definiciones
> distintas de «en dólares».** Tarjeta = sólo cobros nativos USD (202.231,96). Gráfico = todo convertido a
> USD (243.117,74). **Los dos son defendibles por separado; juntos, uno de los dos está mal.**
> Ninguno de los dos discrepa de la base: **la base confirma los dos números.** Lo que falla es la coherencia.

### Las tarjetas, verificadas contra la base en todas las mediciones

| Medición | Tarjeta pantalla | Base | Δ |
|---|---|---|---|
| Todos · Mes/filtro | `202.231,96` | 202.231,96 *(Q7)* | **0,00** |
| `V.0030` · Mes/filtro | `7.574,76` | 7.574,76 | **0,00** |
| `V.0019` · Mes/filtro | `250,00` | 250,00 | **0,00** |
| `V.0002` · Mes/filtro | `179.450,70` | 179.450,70 | **0,00** |
| Todos · Año | `526.504,39` | 526.504,39 *(Q8)* | **0,00** |
| `V.0030` · Año | `46.838,43` | 46.838,43 | **0,00** |
| `V.0019` · Año | `797,00` | 797,00 | **0,00** |
| Tipo = Anticipo · filtro | `187.230,46` | 187.230,46 *(Q9)* | **0,00** |
| Cliente MSDIESEL · filtro / Año | `0,00` / `11.990,00` | 0,00 (sus 7 cobros de agosto son en Bs) / 11.990,00 *(Q10)* | **0,00** |

**Nueve comprobaciones, nueve exactas.** El `0,00` de MSDIESEL **no es una pantalla vacía sin rellenar**:
su tarjeta de «Año» trae 11.990,00 con el mismo filtro puesto, y la base explica el cero.

---

# 5 · QUÉ CAMBIA ESTO RESPECTO A LA TARJETA DE INSUMAR

| | |
|---|---|
| **¿Se replica en otro tenant y otra playa?** | **SÍ.** 4K · playa CARIBE · base distinta · datos distintos · 11 vendedores en vez de 7 |
| **¿De quién es la tarjeta?** | **Del producto.** No es de la instalación de El Yaque |
| **Alcance real, mayor que el reportado** | No es «el filtro de vendedor»: son **tres filtros** — vendedor, cliente y tipo de cobro |
| **Alcance real, menor que el reportado** | **No es la pantalla entera.** Las 4 tarjetas KPI funcionan y cuadran. El defecto vive en **el gráfico `form:j_idt181`** |
| **Por qué INSUMAR no vio la mitad buena** | Su medición leyó las series `"data":[…]` del cuerpo AJAX — que es **justo el componente roto**. Las tarjetas van en el HTML de la misma respuesta y no se miraron |
| **Severidad propuesta** | 🔴 **Alta.** A diferencia del promotor, **esto sí mueve cifras hoy**: ×13,8 con un vendedor normal, ×972 con uno pequeño. Y no avisa: pinta un gráfico con pinta de correcto |
| **Lo que lo hace peor** | La pantalla **se autocontradice a la vista**: la tarjeta dice 7.574,76 y el gráfico de debajo, 243.117,74. Quien mire el gráfico se lleva el dato de la empresa creyendo que es el del vendedor |

---

# 6 · LO QUE NO SE COMPROBÓ

- **El SQL real del bean.** Que el universo sea «los 11 del combo» es **inferencia sobre una coincidencia
  exacta en las tres barras**, no lectura de código: `../src/` está fuera del alcance de la corrida.
- **Los filtros `Depositado` y `Status`.** No se midieron. Sólo se probaron Vendedor, Cliente, Tipo,
  Moneda y Fechas.
- **El botón «Detalle de Transacciones».** No se pulsó (abre otra vista / descarga; corrida de solo lectura).
- **Si el gráfico anual «Facturación y Cobranzas por mes» debería filtrar.** Es idéntico en las 11
  mediciones, pero **su propio pie dice que es porcentaje mensual sobre el año**, así que no se puede
  afirmar que esté mal. **No comprobado.**
- ⚠ **Con `Moneda = Bs`, ese gráfico anual sale con los 12 meses a `0.0`** en Facturado y en Cobrado
  (`ctrl_todos_bs`). **Observación de hoy, no aislada** — merece comprobación aparte.
- **Qué ve un usuario que no sea `admin`.** Sólo se probó con `admin`.
- **Si en 4K esto es regresión o venía de antes.** No hay medición previa de esta pantalla en 4K contra
  la que contrastar.
- **El resto de indicadores de 4K.** El encargo acota a Cobranzas.

---

# 7 · MÉTODO Y TRAMPAS

**11 búsquedas · 0 escrituras · solo `SELECT`.** Cada medición guarda captura PNG, `res-<tag>.json`
(filtros realmente puestos antes y después), **`req-<tag>.txt` con el cuerpo crudo del POST** y
**`resp-<tag>.txt` con la respuesta AJAX completa**.

### 🔑 La guarda que sostiene todo el informe: verificar lo ENVIADO, no lo tecleado

Cada medición imprime `ENVIADO_AL_SERVIDOR`, decodificado del cuerpo del POST. Sin eso, «las tres dan
igual» no vale nada, porque no se sabría si el vendedor llegó a viajar. **Las tres mediciones principales
llevan `idSalesmaView` = vacío / `338` / `339` y las fechas `01/08/2026`–`31/08/2026` verificadas en el
propio POST.**

### ⚠ Trampa 1 · El datepicker tapa «Buscar» — comprobada, no supuesta

Antes de cada `Buscar` se hace clic real en zona neutra y **se verifica con `elementFromPoint` que el
botón no está tapado**; sólo entonces se pulsa. Se registra el resultado (`oclusion intento0: LIBRE`).
En esta pantalla el botón quedó libre al primer intento en las 11 corridas, **pero la guarda estaba puesta**.

### 🔴 Trampa 2 · `Fecha Final` se revierte en silencio — **y el DOM miente**

En el control de julio, el campo **mostraba `31/07/2026`** (leído con `getElementById(...).value`) y
**lo que viajó en el POST fue `31/08/2026`**. Se detectó **sólo** porque se decodifica el cuerpo del POST.

- **Qué se hizo:** rehacer el control moviendo **la fecha de inicio**, que sí viaja fiel — de ahí que el
  control B sea `01/07→31/08` y no `01/07→31/07`. **Se reporta el rango que realmente se aplicó, no el que
  se tecleó.**
- **Por qué importa:** leer el campo en pantalla **no basta** para dar por bueno un rango en esta pantalla.

### ⚠ Trampa 3 · El combo conserva la selección entre recargas — confirmada en 4K

Se midió: tras recargar la pantalla, el combo volvió con **`338`** de la corrida anterior
(`VEND_TRAS_RECARGA="338"`), y el de cliente con `628`. Esta pantalla **no tiene botón «Limpiar»**, así que
cada medición **selecciona explícitamente** su vendedor —incluido el placeholder `Vendedor` para «Todos»—
y lo verifica en `PRE` antes de buscar.

### Otros apuntes

- **No se buscaron nombres en el texto de la página.** Todo se leyó del `<select>` y del cuerpo del POST.
  *(El combo de clientes de 4K tiene 713 entradas y habría dado falsos positivos.)*
- **El gráfico se leyó de la respuesta AJAX**, no del canvas: `PrimeFaces.cw("BarChart","widget_form_j_idt181",…)`
  con `labels:["Transferencia(tr)","Deposito(de)","Efectivo(ef)"]`.
- **Las tarjetas KPI aparecieron al revisar la captura**, no en el volcado automático: el extractor inicial
  sólo miraba series y grids. Se añadió `_tarjetas.js` y se re-extrajeron de los `resp-*.txt` ya guardados.
  ⇒ **leer siempre la captura, no sólo lo que el script decidió mirar.**
- `MSYS_NO_PATHCONV=1` para que Git Bash no convierta las rutas `/pages/...`.

---

# 8 · EVIDENCIA

`evidencia/` — 11 capturas PNG, 11 `req-*.txt` (POST crudo), 11 `resp-*.txt` (AJAX crudo), 11 `res-*.json`
(filtros puestos/enviados + series), `tarjetas.json` (las 4 tarjetas de las 11 mediciones) y
`dump-cobranzas.json` (inventario de la pantalla: combos, ids y opciones).

| Fichero | Qué prueba |
|---|---|
| `tarjetas.json` 🔑 | **La foto completa: gráfico idéntico en las 11, tarjetas distintas en cada una** |
| `req-cobr_v0030.txt` · `req-cobr_v0019.txt` 🔑 | **`idSalesmaView=338` y `=339` sí viajaron al servidor** |
| `resp-cobr_todos.txt` · `resp-cobr_v0030.txt` · `resp-cobr_v0019.txt` | Las tres series idénticas, en el AJAX crudo |
| `ctrl_todos_bs.*` · `ctrl_todos_jul2.*` | **Los controles que prueban que el `Buscar` sí re-consulta** |
| `ctrl_cliente.*` · `ctrl_tipo_limpio.*` | El gráfico ignora también cliente y tipo; las tarjetas no |
| `cobr_v0030.png` | La pantalla contradiciéndose: tarjeta `7.574,76` sobre un gráfico de `243.117,74` |

**Scripts de la corrida** (todos de solo lectura): `_open.js` (sesión + login) · `_drv.js` (CDP :9455) ·
`_dump.js` (inventario de pantalla) · `_menu.js` (localizar la ruta) · `m_cobr.js` (medición, con la
guarda de oclusión y la verificación de lo enviado) · `_tarjetas.js` (extracción de las tarjetas KPI) ·
`_probe_date.js` (el que destapó la Trampa 2).
**Consultas:** `sql/consultas.sql` (Q1–Q11, todas `SELECT`).
