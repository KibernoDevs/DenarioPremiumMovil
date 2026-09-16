# INSUMAR · ¿Sigue caído el módulo Reportes?

| | |
|---|---|
| **Fecha** | 2026-09-15 · ventana de medición **12:27 – 13:00** hora local |
| **Cliente / base** | INSUMAR · empresa única `INSUM_A` · base `insumar` |
| **Web** | `http://denarioelyaque.ddns.net:8080/DenarioPremium` (playa **EL YAQUE**) · usuario `admin`, **2.º bloque** del archivo de secretos |
| **Capa** | **Solo web + base, solo lectura.** **No se tocó ningún móvil, ni el CDP del teléfono, ni otra playa.** |
| **Escrituras** | **Ninguna**, ni en la web ni en la base. Todo el SQL de `sql/consultas.sql` es `SELECT`. |
| **Sesión** | Chrome propio en CDP `:9414`, perfil `qa-insumar-caidos-profile`. Sesión nueva, no reutilizada. |
| **Antecedentes** | `tres_modulos_20260915/00-CONSOLIDADO.md` (09:43–09:50, **funcionaba**) · `reverificacion_20260915/01-reverificacion.md` (11:05–11:50, **caído**) |

> **Login:** entró a la primera con el 2.º bloque (`PATH=/DenarioPremium/pages/main`). Confirmo el aviso del
> encargo: `qa-web-open.js` sigue tomando el **primer** bloque y tiene el `BASE` clavado en `denariocaribe`;
> **no se modificó** (norma de solo lectura), se condujo con un `_open.js` propio en este RUN_DIR.

---

# ⛔ Respuesta corta

## **SIGUE CAÍDO.** No fue un tropiezo pasajero: lleva ya **~3 horas** y sobrevivió a una sesión nueva.

| Pantalla | 09:43–09:50 | 11:05–11:50 | **12:27–13:00 (hoy, yo)** | Intentos míos |
|---|---|---|---|---|
| **Reportes › Cumplimiento de Cuota** | ✅ OK | 🔴 error | 🔴 **«Error en busqueda de reporte. / Intente nuevamente.»** | **17 de 17** |
| **Reportes › Plan VS Cuota** | ✅ OK | 🔴 error | 🔴 **mismo error** | **4 de 4** |
| **Reportes › Activación de Clientes** | ✅ 1 y 7 filas | 🟠 0 filas | 🟠 **0 filas, sin error** | **3 de 3** |
| Reportes › **Rotación de Inventario** | ✅ sin error | *(no se probó)* | ✅ **sin error** | 1 de 1 |
| Transacciones › Facturaciones | ✅ OK | ✅ OK | ✅ **OK, al céntimo** | 3 de 3 |
| Indicadores › Pedidos | ✅ OK | ✅ OK | ✅ **OK, cifra idéntica** | 2 de 2 |
| Indicadores › % de Participación | ✅ OK | ✅ OK | ✅ **OK, cifras idénticas** | 1 de 1 |

**El alcance NO ha cambiado**: las mismas tres pantallas siguen rotas y las de control siguen sanas, en la
misma sesión y con el mismo navegador.

---

# 1 · Lo que se pidió, punto por punto

### 1.1 · `Cumplimiento de Cuota` · 01/08/2026 – 30/08/2026 · US$ · sin filtro de vendedor

🔴 **FALLA.** No devolvió 224.411,08 / 1.171: devolvió **«Error en busqueda de reporte. / Intente
nuevamente.»** y `Total de Resultados: 0`.

Medido **dos veces por el atajo de JavaScript** (12:28 y 12:51) y **una vez a mano, con clics reales**
sobre cada `selectOneMenu` (12:45, `_human3.js`). Las tres, el mismo error.

```
PRE {"rdv":"Todos","clas":"Empresa","cumpl":"Facturado","uni":"US$ - US$ - CURRENCY",
     "d":"01/08/2026","h":"30/08/2026"}
POST#0 src=form:j_idt116:ajax st=200 len=10935
       growl=["Error en busqueda de reporte.","Intente nuevamente."]
TOTAL= 0     FILAS= [["No se encontraron registros."]]
```

⚠ **Un apunte sobre el valor esperado del encargo.** El encargo dice que `01/08–30/08` «debe dar
224.411,08 en 1.171 facturas». Eso es **la salida defectuosa**, no la correcta: la base dice que
`01/08–30/08` son **1.118 · 212.706,05**, y 1.171 · 224.411,08 es agosto **hasta el 31** (Q6). Como
comprobación de «¿responde la pantalla?» sirve igual, pero **no conviene que ese número entre en la
tarjeta como valor correcto**, porque es justamente el síntoma del otro defecto.

### 1.2 · `Plan vs Cuota` · Empresa · Facturado · US$ · 01/09 – 14/09

🔴 **FALLA.** No devolvió 80.160,23: **mismo error**, `total=0`. Repetido a las 12:28 y 12:53, y también
con `Pedido` y con agosto. **4 de 4.**

### 1.3 · `Activación de Clientes`

🟠 **Responde, pero vacía — y esto es peor que un error, porque parece un dato.** Sin growl de error
(`err=null`), `Total de Resultados: 0`, «No se encontraron registros.». **3 de 3**, con agosto y con
septiembre.

Esta mañana la misma pantalla daba:

| | 09:43 | **12:29–12:53** |
|---|---|---|
| Empresa | **1 fila** · 1.891 clientes · 490 activados · 25,91 % | **0 filas** |
| Vendedores (RDV) | **7 filas** (ALEJANDRA 101, EVA 147, LEANDRO 166…) | **0 filas** |

### 1.4 · Contraste en la misma sesión — **los controles siguen sanos**

| Control | Pedido | **Pantalla (12:53–12:56)** | Base (Q6) | Δ |
|---|---|---|---|---|
| Facturaciones · Facturas cobradas | 01/08–31/08 | **1.171** | 1.171 | **0** ✅ |
| Facturaciones · Facturas cobradas | **13/07–13/07** | **285** | 285 | **0** ✅ |
| Indicadores › Pedidos · Facturado · US$ · 2026 | año 2026 | **1.733.804,89** | — | **idéntico a las 09:43** ✅ |
| Indicadores › % Participación · Línea | 01/08–31/08 | **GALLETAS 65.572.743,59** | — | **idéntico a las 11:39** ✅ |

El caso `13/07–13/07` es el más limpio que hay (correcto 285, con un día de más 932, con el primer día
comido 0) y Facturaciones lo clava. **Las pantallas sanas siguen sanas y siguen siendo exactas.**

### 1.5 · Respuesta AJAX cruda

Capturada en **todos** los intentos, no solo la pantalla. Cada medición deja en `evidencia/`:
`resp-<tag>.txt` (cuerpo del `POST` + `partial-response` completo) y `res-<tag>.json` (estado de los
combos antes de buscar, growl, total y filas). Los del flujo a mano van como `h3-<tag>-post0.txt`.

**Forma de la respuesta rota** — es un **HTTP 200 con una excepción ya capturada**, no un 500 ni un
timeout:

```xml
<partial-response id="j_id1"><changes><update id="form:messages"><![CDATA[
  ...PrimeFaces.cw("Growl","widget_form_messages",{...msgs:[{
     summary:"Error en busqueda de reporte.", detail:"Intente nuevamente.", severity:'error'}]});
]]></update><update id="form:tablaCumplimientoCuota">...Total de Resultados: 0
  <span style="color:green;">Dias Transcurridos: </span>     <!-- VACIO -->
  <span style="color:green;">Dias Habiles: </span>           <!-- VACIO -->
  <span style="color:green;">Porcentaje Recorrido: </span>   <!-- VACIO -->
```

🔑 **Los tres contadores de cabecera vienen vacíos.** En una búsqueda buena llevan número. Se calculan
**antes** de agregar nada, y es el primer sitio donde se nota que el reporte se rompió.

---

# 2 · Acotar: desde cuándo y con qué

## 2.1 · Desde cuándo

**La caída empezó entre las 09:50 y las 11:05 de hoy**, y ese sigue siendo el intervalo más estrecho que
se puede sostener: a las 09:50 la corrida anterior tenía búsquedas buenas y a las 11:05 ya fallaban todas.
**No lo pude estrechar más**, y conviene decir por qué se intentó y no salió:

| Vía intentada para fechar el arranque | Resultado |
|---|---|
| `log_error` de la propia base, últimos 3 días | **0 filas.** El error del reporte **no se registra ahí** |
| Pantalla `Empresa › Errores de aplicación` | Solo registra transacciones de móvil fallidas; la última es del **13/08** |
| `global_configuration_audit` | Último cambio **02/09 21:27**. **Nadie tocó una variable global hoy** |
| `sync_log` de hoy | **0 filas**: no sirve para detectar un rebote del servidor |
| `Last-Modified` de los recursos estáticos | `common.css` → **14/09 16:28 local**. Hay un despliegue de **ayer**, pero los reportes **funcionaban hoy a las 09:43**, así que ese despliegue **no explica la ventana** |

**Lo que sí se puede afirmar:** lleva caído **al menos desde las 11:05**, son ya **~3 h**, y **no se ha
recuperado solo** en tres tandas de medición separadas (11:05-11:50, 12:28-12:53, y la ronda final
12:51-13:00). **No es un tropiezo puntual del servidor: toca tarjeta.**

## 2.2 · Con qué falla — **ejes descartados**

Todos estos ejes se movieron **de uno en uno** sobre `Cumplimiento de Cuota`. **Ninguno cambia nada:**

| Eje | Valores probados | Resultado |
|---|---|---|
| **Cumplimiento** | `Facturado`, `Pedido` | 🔴 los dos |
| **Unidad** | `US$`, `BS`, `UNIDADES` | 🔴 las tres |
| **Visualización** | `Empresa`, `Linea` (con las 18 marcadas), `Canales de distribución`, `Proveedor` | 🔴 las cuatro |
| **Vendedor** | `Todos`, `R013 VIVIANA ESCALANTE` | 🔴 los dos |
| **Rango de fechas** | `01/08–30/08`, `01/08–31/08`, `01/07–31/07`, `13/07–13/07` (un día), `01/01/2025–31/01/2025` | 🔴 los cinco |
| **Rango SIN dato ninguno** | `01/01/2030–31/01/2030` | 🔴 **también falla** |
| **Método** | atajo JS (`selectValue`) y **clics reales** (`_human3.js`) | 🔴 los dos |
| **Sesión** | navegador y perfil nuevos, login nuevo | 🔴 igual |

🔑 **El eje que más acota es el último rango.** Pedirle **un mes de 2030, donde no hay ni una factura ni
una cuota**, **también da error**. Una búsqueda sin datos debería devolver «No se encontraron registros»
limpiamente — como hace hoy Activación. Que reviente igual significa que **la excepción salta antes de
tocar el dato**, en la preparación del reporte. Encaja con los tres contadores de cabecera vacíos (§1.5)
y explica por qué **ninguna** combinación se salva.

## 2.3 · Qué NO es — hipótesis probadas y **descartadas** con medición

Para que nadie las vuelva a recorrer:

- **No es el dato.** `invoice` sigue en **46.564** filas, `quota_plan_enterprise` en **72**,
  `sales_plan_enterprise` en **12** — idénticos a las 09:43 y a las 11:05 (Q1).
- **No es la capa de base.** Las cinco vistas de las que viven estos reportes responden todas sin error:
  `quota_plan_enterprise_view` (6), `quota_plan_enterprise_anio_view` (6),
  `sales_plan_enterprise_anio_view` (1), `quota_plan_segment_view` (0), `salesman_view` (22) (Q4).
- **No es una variable global que alguien cambió.** Último cambio auditado: **02/09** (Q3).
- **No es que los ids JSF se hayan desplazado.** Enumeré los componentes vivos: siguen siendo
  `form:j_idt116:*` en Cumplimiento y `form:j_idt115:*` en Plan, exactamente los que usa el arnés.
- **No es el combo de Empresa.** `idEnterprise` viene relleno y con una sola opción
  (`1 = INSUMAR DISTRIBUIDORA 715, C.A.`).
- **No es el panel de valores del filtro.** Con clics reales, elegir `Linea` **sí** dispara su `POST` y
  **sí** rellena las **18** casillas; aun con las 18 marcadas, la búsqueda falla igual.
- **No es el combo `Roles`.** Confirmo lo del antecedente: en estas pantallas **no existe** tal combo
  (los `select` vivos son `idEnterprise`, `codRdv`, `clasificacion`, `cumplimiento`, `unidad`).
- **No son los feriados.** La tabla `holiday` está vacía —**pero lo ha estado siempre**: su secuencia
  `holiday_id_holiday_seq` tiene `last_value = NULL`, o sea **nunca se insertó ni una fila**. Por tanto
  también estaba vacía a las 09:43, cuando el reporte funcionaba (Q5).

### Dos correcciones a lo que yo mismo creí a mitad de camino

Las dejo escritas porque las dos son trampas fáciles:

1. **«Aparecieron dos columnas nuevas, han desplegado algo».** La tabla rota muestra **11** columnas
   (con `Unidades Devueltas` y `Cantidad Neta`) y la buena mostraba **9**. Parece un cambio de versión —
   **y no lo es**: el volcado del DOM de las **09:41** ya traía esas 11 columnas en el desplegable de
   ordenación. Las 11 son el **estado en blanco** de la tabla; tras una búsqueda buena el backend
   re-renderiza y deja 9. **La diferencia de cabeceras es consecuencia del fallo, no su causa.**
2. **«La página viene vacía, no hay ni combos».** Falso: era **el `MSYS_NO_PATHCONV` de Git Bash**, que
   convirtió el argumento `/pages/reporteCumplimientoCuota` en
   `C:/Program Files/Git/pages/reporteCumplimientoCuota`. Con `MSYS_NO_PATHCONV=1` la página trae sus 8
   `select`. **No afecta a ninguna medición** (las rutas de `medir-cuota.js` van dentro del script).

## 2.4 · Lo que acota el alcance hacia arriba

**No es «el módulo Reportes»: es 3 de sus 4 pantallas.** `Rotación de Inventario` **no lanza el error**
(`err=null`), igual que esta mañana. Es señal débil —devuelve 0 filas hoy y también las devolvía a las
09:43— pero **descarta que el menú entero esté tumbado**.

Y **Activación de Clientes falla distinto**: no da error, **se queda muda**. Para la tarjeta esto importa,
porque un usuario que la abra hoy verá «no hay clientes activados» y **se lo creerá**.

---

# 3 · Los dos hallazgos que quedaron pendientes de medir en pantalla

El encargo pedía volver a medirlos **si Reportes ya funcionaba**. **No funciona**, así que:

### 3.1 · El día de más en la Fecha Final de `Cumplimiento de Cuota` → **NO COMPROBADO**

Sigue sin poder mirarse: las cuatro ventanas que lo discriminan (`01/08–30/08`, `01/08–31/08`,
`01/07–31/07`, `13/07–13/07`) **dieron error** (§2.2). **Van ya 36 intentos fallidos** entre las 11:05 y
las 12:53 sin una sola lectura.

🔑 **Lo que sí dejo resuelto es el borde izquierdo, que es lo que nadie había mirado.** El encargo tiene
razón en que hacía falta un rango que **empiece en un día con facturas**: el 01 y el 02 de agosto están
vacíos, así que **cualquier ventana que arranque el 01/08 es ciega por la izquierda**. Verifiqué contra la
base (Q6) que **el 01/07 sí tiene facturas — 193 por 75.557,06** — y por tanto **`01/07–31/07` sí
discrimina por la izquierda**. La prueba queda **armada y con su oráculo**, lista para ejecutar en cuanto
la pantalla vuelva:

| Ventana a pedir | **Correcto** | Si come el **primer** día | Si añade un día al **final** |
|---|---|---|---|
| **`01/07 – 31/07`** | **5.908 · 1.270.978,81** | **5.715 · 1.195.421,75** | 5.908 · 1.270.978,81 *(ciego: el 01/08 está vacío)* |
| **`13/07 – 13/07`** 🔑 | **285 · 155.028,94** | **0 · 0,00** | **932 · 302.417,61** |
| `01/08 – 31/08` | 1.171 · 224.411,08 | 1.171 · 224.411,08 *(ciego)* | 1.220 · 232.003,67 |
| `01/08 – 30/08` | 1.118 · 212.706,05 | 1.118 · 212.706,05 *(ciego)* | 1.171 · 224.411,08 |

**`13/07–13/07` es el caso que hay que pedir primero**: separa los tres escenarios de un golpe y es el
único que distingue el borde izquierdo del derecho sin ambigüedad. **Facturaciones ya lo pasa hoy con un
285 exacto** (§1.4), así que sirve además de control cruzado.

### 3.2 · La vista por Línea inflada → **MEDIDO A MEDIAS**

| Pantalla | ¿Medida hoy? | Resultado |
|---|---|---|
| `Cumplimiento de Cuota › Linea` | ❌ **NO COMPROBADO** | error, incluso con las **18** líneas marcadas a mano (`H3_CUM_Linea`) |
| `Plan vs Cuota › Linea` | ❌ **NO COMPROBADO** | pantalla caída |
| **`Indicadores › % de Participación › Linea`** | ✅ **SÍ** | 🔴 **inflado, confirmado** |

**`% de Participación` sí se pudo medir** porque vive en Indicadores, que está sano. Leí las series del
widget del gráfico (no del texto) a las **12:46**, con `Todos · Linea · Facturado · US$ · 01/08–31/08`:

| Línea | **Pantalla (12:46)** | Facturación real del mes | Factor |
|---|---|---|---|
| **GALLETAS** | **65.572.743,59** | 224.411,08 | **×292** |
| ALIMENTOS | 38.848.021,98 | | |
| PASAPALOS | 19.494.395,33 | | |
| BEBIDAS | 13.202.526,25 | | |
| CONDIMENTOS | 10.711.839,95 | | |
| CARAMELOS · CEREALES · CHOCOLATES · CHICLES · TABACO | 5.900.111,65 · 5.508.498,31 · 3.733.087,87 · 3.436.593,58 · 2.588.857,25 | | |
| **Σ top 10** | **168.996.675,76** | **224.411,08** | **×753** |

🔑 **Reproduce las cifras de las 11:39 al céntimo**, una a una y también en la suma. Un solo renglón
—GALLETAS— vale **292 veces** la facturación de todo el mes. **El inflado es estable y reproducible, no
un artefacto de una lectura suelta.**

Queda en pie el matiz del antecedente, que **no** he podido cerrar: la cifra de `% de Participación`
**no la reproduce ninguna de las fórmulas candidatas** de `invoice_detail`, así que **puede tener un
origen distinto** al de las otras dos pantallas. Si se arregla la columna de `invoice_detail`,
**hay que volver a medir `% de Participación` por separado**.

---

# 4 · Para la tarjeta

**Sí, levantar tarjeta.** No es un tropiezo: son ~3 h, tres tandas de medición, sesión y navegador nuevos,
y **44 intentos fallidos** entre las tres pantallas.

- **Título sugerido:** *Reportes › Cumplimiento de Cuota y Plan VS Cuota devuelven «Error en busqueda de
  reporte» para cualquier filtro; Activación de Clientes devuelve 0 filas sin avisar.*
- **Empezó** entre las **09:50 y las 11:05** del 15/09/2026. **Sin cambios en la base ni en la
  configuración** en esa ventana.
- **Alcance:** 3 de las 4 pantallas de Reportes. `Rotación de Inventario`, Facturaciones e Indicadores
  (Pedidos, Vendedores, % Participación) **siguen bien**.
- **Reproduce con todo:** cualquier fecha (incluso un mes de 2030 sin dato), `Pedido` y `Facturado`,
  las 3 unidades, las 4 visualizaciones, `Todos` y un vendedor suelto, a mano y por script.
- **Lo más útil para quien lo arregle:** el HTTP es **200 con excepción capturada**, y **`Días
  Transcurridos` / `Días Hábiles` / `Porcentaje Recorrido` vienen vacíos**. El fallo está **antes de
  agregar dato** — por eso también revienta un rango vacío. El *stack trace* **no** queda en `log_error`
  ni en `Errores de aplicación`: **hay que mirar el log del servidor de aplicaciones**, que desde QA no
  se ve.
- **Severidad de `Activación de Clientes`: súbanla.** Las otras dos avisan; **esta miente en silencio.**
- ⚠ **Bloquea** la comprobación en pantalla del hallazgo del día de más y de la vista por Línea en dos de
  las tres pantallas. **Mientras dure, esos dos no se pueden cerrar.**

---

# 5 · Método y evidencia

**Solo lectura de punta a punta.** Cero escrituras en web y cero en base (`sql/consultas.sql`, todo
`SELECT`). **No se tocó ningún dispositivo móvil ni CDP de teléfono**; el único CDP es el del Chrome de
escritorio de esta corrida (`:9414`). No se modificó `qa-web-open.js` ni ningún archivo de producto.

**Qué hay en `evidencia/` (94 archivos):**

| Patrón | Contenido |
|---|---|
| `res-<tag>.json` | estado de los combos antes de buscar, growl, `total`, filas |
| `resp-<tag>.txt` | **cuerpo del POST + `partial-response` crudo** de cada intento |
| `h3-<tag>-post0.txt` | ídem, del flujo conducido **a mano** |
| `<tag>.png` | captura de pantalla de cada intento |
| `panel-post*.txt`, `human2-*` | sondas del panel de valores del filtro |

**Scripts de esta corrida** (todos en el RUN_DIR): `_open.js` (login), `_drv.js` (CDP),
`medir-cuota.js` (Reportes), `_fact.js`, `_indped.js`, `_part.js` (controles), `_human3.js` (flujo a
mano completo), `_ids.js` / `_combos.js` / `_panel.js` / `_human2.js` / `_fresh_head.js` / `_hdrs.js` /
`_errpage.js` / `_dbg.js` (sondas), `lote1..4.sh` (tandas).

**Cronología de las mediciones:** 12:27 login · 12:28 primeros 3 intentos · 12:29–12:44 matriz de ejes ·
12:45 flujo a mano · 12:46 % Participación · 12:48 rango de 2030 · 12:51–12:53 ronda final ·
12:53–12:56 controles.

## Lo que queda «no comprobado»

- **El desfase de un día en `Cumplimiento de Cuota`**, en pantalla: la pantalla no responde.
- **La vista por Línea en `Cumplimiento de Cuota` y en `Plan vs Cuota`**: las dos caídas.
- **La hora exacta en que empezó la caída**: solo se acota a la ventana 09:50–11:05.
- **La causa raíz**: requiere el log del servidor de aplicaciones, que desde QA no se ve.
- **Si afecta a otros clientes/playas**: fuera del alcance de este encargo, no se probó.
