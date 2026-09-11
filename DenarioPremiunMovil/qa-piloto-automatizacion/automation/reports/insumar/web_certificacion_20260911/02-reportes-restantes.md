# Certificación web · INSUMAR · los dos submódulos de Reportes que faltaban

| | |
|---|---|
| **Fecha de la corrida** | 2026-09-11 (tarde, continuación) |
| **Por qué existe este informe** | La corrida `01-certificacion-web.md` midió **2 de los 4** submódulos de Reportes. QA lo detectó: la solicitud habla del **módulo de Reportes entero**. Aquí van los dos que faltaban. |
| **Alcance** | **Reportes → Activación de Clientes** (`/pages/reporteActivacionClientes`) y **Reportes → Rotación de Inventario** (`/pages/reporteRotacionInventario`). |
| **Capa** | **Solo web.** No se tocó el dispositivo. |
| **Web / usuario** | `http://denarioelyaque.ddns.net:8080/DenarioPremium` · `admin` · empresa única `INSUM_A` |
| **Método** | Playwright local por CDP (`:9411`), misma sesión y mismos selectores del informe 01. Scripts `sG*.js` de este RUN_DIR. |
| **Escrituras** | **Ninguna.** Lectura: navegar, filtrar, leer el grid y contrastar contra la base. |
| **Ventana** | `01/09/2026 – 11/09/2026`, Cumplimiento **Facturado** (salvo donde se indica otra cosa). |

---

## Resumen en una tabla

| Submódulo | ¿Dimensión de vendedor? | ¿Ofrece `T001`–`T006`? | ¿Devuelve datos al elegir uno? | ¿Cuenta las copias? | Veredicto |
|---|---|---|---|---|---|
| 🔴 **Activación de Clientes** | **Sí** — `Visualización = Vendedores` | 🔴 **Sí, los 6** (+ `C001` y `P001`) | 🔴 **Sí**: `T001` solo → **796 clientes activados** | 🔴 **Sí** — Empresa muestra **833** activados donde son **330** | 🔴 **NO CORREGIDO** |
| ⚪ **Rotación de Inventario** | **No** — mide productos | N/A: no hay combo de vendedor | N/A | **no comprobado**: el reporte sale vacío en todo lo probado | ⚪ **NO APLICA** (dimensión) · ⚠ **no comprobado** (monto) |

**El módulo de Reportes queda así: 3 de 4 submódulos cuentan las copias de transportista** (Plan VS Cuota, Cumplimiento de Cuota, Activación de Clientes) **y el cuarto no tiene dimensión de vendedor.**

---

## R1 · Reportes → Activación de Clientes — 🔴 NO CORREGIDO

### Qué hay en la pantalla

`/pages/reporteActivacionClientes` · prefijo JSF `form:j_idt115` · grid `form:tablaComparativoPlanCuota` (reusa el id de Plan VS Cuota).

| Filtro | Contenido |
|---|---|
| **Empresa** | `INSUMAR DISTRIBUIDORA 715, C.A.` — `disabled`, una sola empresa |
| 🔑 **Visualización** (`clasificacion`) | `Empresa` · `Canales de distribución` · **`Vendedores`** · `Pais` · `Estado` · `Linea` · `Proveedor` |
| **Valores** (`checkboxValor`) | multiselección; su contenido **depende de Visualización** |
| **Cumplimiento** | `Pedido` · `Facturado` |
| **Fecha Inicio / Fecha Final** | rango libre |
| Botones | `Buscar` · `Limpiar` · `Ver Gráfico` · `Descargar Gráfico` |

**Columnas del grid:** `Vendedor` (o `Empresa`) · `Clientes` · `Clientes Activados` · `Clientes Inactivos` · `% Activación` · `Clientes Nuevos` · `Clientes Nuevos Activados` · `% Act Nuevos`.

⇒ **Sí tiene dimensión de vendedor.** No es un combo «Vendedor» como el de Cumplimiento de Cuota: es la opción **`Vendedores`** del combo *Visualización*, que convierte el reporte en un desglose **por vendedor**, y entonces la lista de *Valores* se rellena con los usuarios.

### 🔴 La lista de Valores con `Visualización = Vendedores` trae a los seis transportistas

**14 entradas**, y los `value` reales del `input` son los códigos de usuario:

```
VIVIANA ESCALANTE (R013) | JOSE MUÑOZ (T001) | LEANDRO MUÑOZ (T002) | YONI MILANO (T003) |
SAUL PENOTT (T004) | ARMANDO ROSAS (T005) | ALEJANDRA RODRIGUEZ (R015) | MIGUEL PARRA (R007) |
LEANDRO REBOLLEDO (R016) | YENNI ALVAREZ (R009) | VACANTE VACANTE (T006) | EVA MEDINA (R003) |
CATALOGO INSUMAR (C001) | MARIA JOSE PEREZ (P001)
```

Es **la misma lista de 14 del combo Vendedor de Cumplimiento de Cuota** (las 15 de allí menos `Todos`): los 6 vendedores reales, **los 6 transportistas**, el usuario Catálogo `C001` y el promotor `P001`.

### 🔴 Y al elegir un transportista, devuelve datos

Marcando **solo `JOSE MUÑOZ` (T001)** — verificado en el cuerpo del POST: `checkboxValor=T001` — el reporte devuelve **1 fila**:

| Vendedor | Clientes | Clientes Activados | Clientes Inactivos | % Activación | Nuevos | Nuevos Activados |
|---|---:|---:|---:|---:|---:|---:|
| 🔴 JOSE MUÑOZ *(transportista)* | **1.745** | **796** | 949 | **45,61 %** | 0 | 37 |

Evidencia: `evidencia/G6-act-solo-JOSE_MUÑOZ.png`, `_G_act_solo.json`.

### 🔴 Los conteos son exactamente los de «con todas las copias»

**Visualización `Empresa`**, `Facturado`, `01/09–11/09/2026` — **1 fila**:

| Empresa | Clientes | **Clientes Activados** | Clientes Inactivos | **% Activación** | Nuevos | Nuevos Act. | % Act Nuevos |
|---|---:|---:|---:|---:|---:|---:|---:|
| INSUMAR DISTRIBUIDORA 715, C.A. | 1.935 | **833** | 1.102 | **43,04 %** | 37 | 37 | 100 % |

| | Pantalla | Oráculo **correcto** (solo vendedores) | Oráculo **con copias** |
|---|---:|---:|---:|
| Clientes activados | **833** | **330** (341 contando los nuevos) | **833** ✅ idéntico |
| % Activación | **43,04 %** | **17,05 %** (330 / 1.935) | 43,05 % |

**`833` es, al cliente, el número de clientes distintos que aparecen en `invoice` sumando las 6 copias de transportista.** Contando solo las facturas de vendedor son **341** (330 si se descuentan los 37 clientes nuevos, que el reporte cuenta en columna aparte).

**Factor de inflado: ×2,5.**

### El desglose por vendedor cuadra fila a fila con el oráculo — y ahí se ve el reparto

`Visualización = Vendedores`, todos los valores marcados, `Facturado`, `01/09–11/09/2026` — **14 filas**:

| Fila en pantalla | Clientes | Activados | Oráculo BD (`co_user`, clientes distintos con factura, menos los nuevos) | ¿Cuadra? |
|---|---:|---:|---:|---|
| VIVIANA ESCALANTE | 172 | 94 | `R013` → 97 − 3 nuevos = **94** | ✅ |
| 🔴 **JOSE MUÑOZ** | 1.745 | **796** | `T001` → 833 − 37 = **796** | 🔴 al cliente: **toda la empresa** |
| 🔴 **LEANDRO MUÑOZ** | 1.826 | **796** | `T002` → **796** | 🔴 |
| 🔴 **YONI MILANO** | 1.826 | **796** | `T003` → **796** | 🔴 |
| 🔴 **SAUL PENOTT** | 1.826 | **796** | `T004` → **796** | 🔴 |
| 🔴 **ARMANDO ROSAS** | 1.826 | **796** | `T005` → **796** | 🔴 |
| 🔴 **VACANTE VACANTE** | 1.826 | **796** | `T006` → **796** | 🔴 |
| ALEJANDRA RODRIGUEZ | 105 | 34 | `R015` → 35 − 1 = **34** | ✅ |
| MIGUEL PARRA | 136 | 65 | `R007` → 66 − 1 = **65** | ✅ |
| LEANDRO REBOLLEDO | 172 | 81 | `R016` → 85 − 4 = **81** | ✅ |
| YENNI ALVAREZ | 104 | 55 | `R009` → 56 − 1 = **55** | ✅ |
| EVA MEDINA | 150 | 0 | `R003` → sin facturas en la ventana | ✅ |
| CATALOGO INSUMAR | 0 | 0 | `C001` → sin facturas | ✅ |
| MARIA JOSE PEREZ | 0 | 0 | `P001` → sin facturas | ✅ |

**Las 14 filas cuadran al cliente con la base.** El cálculo no está roto: lo que está mal es **a quién incluye**. Los seis transportistas aparecen con **796 clientes activados cada uno** — el 100 % de la cartera activada de la empresa, seis veces.

⚠ **Dos causas, no una.** El conteo de activación sale de `invoice` (y ahí están las copias), pero la columna **`Clientes`** (la cartera) sale de **`client_template_user`**, donde **cada transportista tiene asignados 1.863 clientes** (T001: 1.745) frente a los 105–176 de un vendedor real. Es decir: el transportista está inflado **por las dos vías**. Que la cartera sea así es dato del ERP; lo que aquí se certifica es que **el reporte los lista y los cuenta**.

Evidencia: `evidencia/G2-act-Empresa.png`, `evidencia/G2-act-Vendedores.png`, `_G_act.json`.

### ✅ «Limpiar» **no** rompe este reporte

Probado en esta corrida: `Buscar` (14 filas) → `Limpiar` → reponer los mismos filtros → `Buscar` ⇒ **14 filas otra vez, sin error**. El defecto H3 del informe 01 **no se reproduce aquí**; sigue siendo exclusivo de Plan VS Cuota.

Evidencia: `evidencia/G7-Activacion-tras-limpiar.png`, `_G_limpiar.json`.

---

## R2 · Reportes → Rotación de Inventario — ⚪ NO APLICA (sin vendedor) · ⚠ monto NO COMPROBADO

### Qué hay en la pantalla

`/pages/reporteRotacionInventario` · prefijo `form:j_idt115` · grid `form:TablaRotacion`.

| Filtro | Contenido |
|---|---|
| **Empresa** | `INSUMAR DISTRIBUIDORA 715, C.A.` — `disabled` |
| **Visualización** (`clasificacion`) | `Productos` · `Linea` · `Proveedor` — **no hay `Vendedores`** |
| **Valores** (`checkboxValor`) | los **2.065 productos** |
| **Cumplimiento** | `Pedido` · `Facturado` |
| **Unidad de Venta** | `BULTO` · `DISPLAY` · `KILOGRAMOS` · `UNIDADES` |
| **Fecha Inicio / Fecha Final** | rango libre |
| Botones | `Buscar` · `Limpiar` · `Ver Gráfico` |

**Columnas del grid:** `Nombre` · `SELL IN` · `SELL OUT` · `Plan VS Cumplimiento` · `Inventario Inicial` · `Inventario Final` · `Rotaciòn Inventario` *(sic, con tilde invertida en la cabecera)* · `Rotación VS SELL OUT` · `SELL POINTS`.

### ⇒ No tiene dimensión de vendedor. Y esto es lo que vi para decirlo

- **No hay combo de vendedor.** Los `selectOneMenu` de la pantalla son exactamente cuatro: `idEnterprise` (deshabilitado), `clasificacion`, `cumplimiento` y `unidad`. Ninguno más — dump completo en `_G_recon.json`.
- **El combo `Visualización` no ofrece `Vendedores`**: solo `Productos`, `Linea` y `Proveedor`. (En Activación de Clientes ese mismo combo **sí** lo ofrece — de ahí que allí sí aplique.)
- **La lista de Valores son productos** en las tres visualizaciones (2.065 entradas, `BOMBONES SERENATA DE AMOR…`, `CHOCO CORNET AVELLANA 4X24U`, …).
- **Ninguna columna del grid es de vendedor.** El eje es el producto y las métricas son de inventario y de unidades.

**Por tanto: el caso «que el reporte no cuente a los transportistas» no aplica a este submódulo — no hay dónde elegirlos ni por dónde desglosarlos.** Los puntos 2 y 3 de la solicitud quedan **N/A por construcción**, no por falta de medición.

### ⚠ Lo que **no** se pudo certificar: si las cantidades incluyen las copias

El reporte **devuelve vacío en todas las combinaciones probadas** — `Total de Resultados: 0`, «No se encontraron registros.»:

| Caso | Visualización | Cumplimiento | Unidad | Rango | Resultado |
|---|---|---|---|---|---|
| 1 | Productos (2.065 marcados) | Facturado | UNIDADES | 01/09–11/09/2026 | 0 filas |
| 2 | Linea | Facturado | UNIDADES | 01/09–11/09/2026 | 0 filas |
| 3 | Proveedor | Facturado | UNIDADES | 01/09–11/09/2026 | 0 filas |
| 4 | Productos | Facturado | **BULTO** | 01/09–11/09/2026 | 0 filas |
| 5 | Productos | Facturado | *(sin unidad)* | 01/01–11/09/2026 | 0 filas |
| 6 | Productos | **Pedido** | UNIDADES | 01/01–11/09/2026 | 0 filas |
| 7 | Productos | Facturado | UNIDADES | **01/01/2025–11/09/2026** | 0 filas |

**No es mi método, y esta vez tengo el cuerpo del POST:** los filtros viajan correctos
(`fechaDesde_input=01%2F01%2F2025`, `fechaHasta_input=11%2F09%2F2026`, `cumplimiento_input=Facturado`, `unidad_input=4`, 2.065 `checkboxValor` marcados) y **la respuesta AJAX no trae `summary` ni `detail`**: el servidor contesta «vacío», no «excepción».

**Y la base explica el vacío:** el reporte se alimenta del inventario **en el cliente**, y esas tablas están a cero:

```sql
SELECT (SELECT count(*) FROM client_stock) cs,          -- 0
       (SELECT count(*) FROM client_stock_detail) csd,  -- 0
       (SELECT count(*) FROM stock) st,                 -- 1141
       (SELECT count(*) FROM stock_history) sh;         -- 62902
```

`client_stock` y `client_stock_detail` **no tienen ni una fila** en esta base. Sin inventario inicial/final en el cliente no hay rotación que calcular, así que el vacío es **coherente con los datos**, no necesariamente un defecto de la web.

**Veredicto honesto:** ⚪ **el caso de transportistas NO APLICA** (verificado: no hay dimensión de vendedor) · ⚠ **si SELL IN / SELL OUT contarían las copias, NO SE COMPROBÓ** — el reporte no devuelve una sola fila que contrastar. **Queda pendiente para una base con `client_stock` cargado.**

### `Limpiar`: sin error, pero la prueba no es concluyente

`Buscar` → `Limpiar` → reponer filtros → `Buscar`: **no aparece ningún mensaje de error** en la respuesta AJAX (a diferencia de Plan VS Cuota, que devuelve `summary:"Error en busqueda de reporte."`). Pero como el reporte **devuelve 0 filas también antes de Limpiar**, no puedo distinguir «aguanta» de «ya estaba vacío». Lo que sí se certifica: **tras Limpiar no aparece el error de Plan VS Cuota**.

Evidencia: `evidencia/G1-rot.png`, `evidencia/G3-rot-*.png`, `evidencia/G7-Rotacion-tras-limpiar.png`, `_G_rot.json`, `_G_rot2.json`, `_G_limpiar.json`.

---

## Las consultas del oráculo

Todas de solo lectura, ejecutadas en **esta** corrida con
`node automation/db/query.js insumar "<SQL>"`.

### Q7 · Oráculo de **Activación de Clientes** (clientes activados, con y sin copias)

```sql
SELECT
  (SELECT count(DISTINCT co_client) FROM invoice
     WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11')                        AS todo,
  (SELECT count(DISTINCT co_client) FROM invoice
     WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
       AND co_invoice !~ 'T[0-9]{3}$')                                                    AS solo_vendedores,
  (SELECT count(DISTINCT co_client) FROM invoice
     WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
       AND co_invoice !~ 'T[0-9]{3}$' AND co_user <> 'A001')                              AS solo_vend_sin_admin,
  (SELECT count(*) FROM client)                                                           AS clientes_total;
-- 833 | 341 | 339 | 1972
```

### Q8 · El mismo oráculo con la convención del reporte (los «nuevos» van en columna aparte)

El reporte descuenta de `Clientes Activados` los clientes **creados dentro de la ventana** y los lleva a `Clientes Nuevos Activados`. Con ese ajuste el cuadre es exacto:

```sql
SELECT
  (SELECT count(*) FROM client
     WHERE da_created::date BETWEEN '2026-09-01' AND '2026-09-11')                         AS nuevos,         -- 37
  (SELECT count(DISTINCT i.co_client) FROM invoice i JOIN client c ON c.co_client = i.co_client
     WHERE i.da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
       AND c.da_created::date NOT BETWEEN '2026-09-01' AND '2026-09-11')                   AS act_con_copias, -- 796
  (SELECT count(DISTINCT i.co_client) FROM invoice i JOIN client c ON c.co_client = i.co_client
     WHERE i.da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
       AND i.co_invoice !~ 'T[0-9]{3}$'
       AND c.da_created::date NOT BETWEEN '2026-09-01' AND '2026-09-11')                   AS act_correcto;   -- 330
```

`796` es **exactamente** lo que el reporte pone en cada fila de transportista. `330` es lo que debería mostrar la fila de Empresa.

### Q9 · Clientes distintos por usuario (el desglose fila a fila)

```sql
SELECT co_user, count(*) AS filas, count(DISTINCT co_client) AS clientes
  FROM invoice WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
 GROUP BY co_user ORDER BY co_user;
-- A001 2/2 · R007 89/66 · R009 73/56 · R013 137/97 · R015 42/35 · R016 127/85
-- T001..T006  1150/833 cada uno   <-- los 833 clientes de toda la empresa, seis veces
```

### Q10 · La cartera (columna `Clientes`) sale de `client_template_user`

```sql
SELECT co_user, count(DISTINCT co_client) AS cartera
  FROM client_template_user GROUP BY co_user ORDER BY co_user;
-- R003 152 · R007 137 · R009 105 · R013 175 · R015 106 · R016 176
-- T001 1745 · T002..T006 1863 cada uno
```

Restando los 37 nuevos coincide al cliente con la columna `Clientes` de pantalla
(T002: 1.863 − 37 = **1.826** ✓ · R013: 175 − 3 = **172** ✓ · R016: 176 − 4 = **172** ✓).

### Q11 · Oráculo de **Rotación de Inventario** (calculado, pero sin nada contra qué contrastar)

Por si el reporte llega a devolver filas en otra base, el oráculo de las cantidades facturadas
(`invoice_detail_unit.qu_invoice`, que es donde viven las cantidades; `invoice_detail.qu_total` está **a `NULL`** en esta base):

```sql
WITH w AS (
  SELECT d.id_invoice_detail, (i.co_invoice ~ 'T[0-9]{3}$') AS es_copia
    FROM invoice_detail d JOIN invoice i ON i.id_invoice = d.id_invoice
   WHERE i.da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11')
SELECT
  (SELECT round(sum(u.qu_invoice)::numeric,2) FROM invoice_detail_unit u
     JOIN w ON w.id_invoice_detail = u.id_invoice_detail)                        AS unid_todo,        -- 223086,00
  (SELECT round(sum(u.qu_invoice)::numeric,2) FROM invoice_detail_unit u
     JOIN w ON w.id_invoice_detail = u.id_invoice_detail WHERE NOT w.es_copia)   AS unid_sin_copias,  --  14796,00
  (SELECT count(*) FROM w)                                                       AS lineas_todo,      --  71796
  (SELECT count(*) FROM w WHERE NOT es_copia)                                    AS lineas_sin_copias;--   4734
```

**Factor de inflado que habría si contase las copias: ×15,08.** No se pudo verificar porque el reporte sale vacío.

### Q12 · Por qué sale vacío Rotación

```sql
SELECT (SELECT count(*) FROM client_stock)        AS client_stock,        -- 0
       (SELECT count(*) FROM client_stock_detail) AS client_stock_detail, -- 0
       (SELECT count(*) FROM stock)               AS stock,               -- 1141
       (SELECT count(*) FROM stock_history)       AS stock_history;       -- 62902
```

---

## Hallazgos nuevos

### H7 · Reportes → Activación de Clientes cuenta las copias de transportista y los ofrece como vendedores · 🔴 Alto

**Dos síntomas, un solo defecto.**

1. **Vista `Empresa`**: muestra **833 clientes activados** (43,04 % de activación) donde los clientes realmente facturados por vendedores son **330** (17,05 %). `833` es, al cliente, el número de clientes distintos de `invoice` **contando las 6 copias**. Inflado **×2,5**.
2. **Vista `Vendedores`**: la lista de valores ofrece **`T001`–`T006`** (más `C001` y `P001`), y al marcar solo `T001` el reporte devuelve **1.745 clientes / 796 activados / 45,61 %** — es decir, le atribuye **la cartera activada de toda la empresa** a un transportista. Lo mismo para los otros cinco (1.826 / 796 cada uno).

**Es el mismo defecto que H1 y H2 del informe 01**, en el tercer submódulo de Reportes. Los módulos ya corregidos (Facturaciones, Indicadores) **no** listan transportistas; los tres reportes de este módulo sí.

**Reproducción:** Reportes → Activación de Clientes · Visualización `Vendedores` · Cumplimiento `Facturado` · `01/09/2026`–`11/09/2026` · marcar todos los valores · Buscar.
**Evidencia:** `evidencia/G2-act-Vendedores.png`, `evidencia/G6-act-solo-JOSE_MUÑOZ.png`, Q7–Q10.

### H8 · La fila `Empresa` de Activación de Clientes no usa la misma convención que las filas de vendedor · 🟡 Bajo

Las filas de vendedor descuentan los clientes nuevos de `Clientes Activados` (T00x: 833 − 37 = **796**). La fila `Empresa` muestra **833** *y además* **37** en `Clientes Nuevos Activados`: los 37 se cuentan **dos veces**. Es un detalle menor frente a H7 —ambos números son igualmente «con copias»— pero conviene mirarlo al tocar el reporte.
**Evidencia:** `evidencia/G2-act-Empresa.png` vs `evidencia/G2-act-Vendedores.png`, Q8.

### H9 · Reportes → Rotación de Inventario no devuelve ninguna fila en ninguna combinación · 🟠 Medio · **probablemente dato, no código**

7 combinaciones de Visualización × Cumplimiento × Unidad × rango (hasta `01/01/2025–11/09/2026`), todas a **0 filas** y **sin error en la respuesta AJAX**. `client_stock` y `client_stock_detail` están **vacías** en esta base, y sin inventario en el cliente no hay rotación posible — así que **lo más probable es que sea falta de dato, no defecto de la pantalla**. Se reporta para que QA decida: **si INSUMAR debería tener inventario en cliente, el problema está aguas arriba (sincronización); si no lo usa, el submódulo simplemente no tiene contenido.**
**Evidencia:** `_G_rot2.json`, Q12.

---

## Lo que NO se pudo comprobar

- **Si SELL IN / SELL OUT / Rotación de Inventario contarían las copias de transportista.** El reporte no devuelve una sola fila (H9). El oráculo está calculado y listo (Q11): si contase las copias mostraría **×15,08**. **Pendiente de una base con `client_stock` cargado.**
- **Si `Limpiar` rompe Rotación de Inventario.** No aparece el error de Plan VS Cuota, pero como el reporte ya devolvía 0 filas antes de pulsarlo, la prueba **no es concluyente**.
- **Las vistas `Canales de distribución` / `Pais` / `Estado` / `Linea` / `Proveedor` de Activación de Clientes.** Solo se midieron `Empresa` y `Vendedores`, que son las que responden a la solicitud. Si alguna de esas agrupa por otra vía, no se miró.
- **Cumplimiento = `Pedido` en Activación de Clientes.** Todo lo de R1 se midió con `Facturado`.
- **Qué ve un usuario que no sea `admin`.**
- **El SQL real del bean.** `../src/` está fuera del alcance. Que la cartera salga de `client_template_user` es **inferencia sobre medición** (cuadra al cliente en las 14 filas), no lectura de código.

---

## Patrones y selectores nuevos

### El reporte de Activación **reusa el id de grid de Plan VS Cuota**

`form:tablaComparativoPlanCuota` es el grid **tanto** de Plan VS Cuota **como** de Activación de Clientes. Rotación usa uno propio: `form:TablaRotacion`. Si se navega entre reportes sin recargar es fácil leer el grid equivocado — **hacer siempre `D.goto()` antes de medir**.

### 🔑 Marcar **un solo** valor del `selectCheckboxMenu`: hay que usar clics reales

`w.uncheckAll()` seguido de un `.click()` por JS sobre el `.ui-chkbox-box` **no deja nada marcado** (`checked: 0`) y el reporte lo interpreta como «todos», devolviendo las 14 filas — **falso PASS silencioso**. Lo que sí funciona: abrir el panel con un clic **real** de Playwright sobre el widget y clicar el ítem con un `elementHandle`:

```js
await pg.click(`[id="${F}:checkboxValor"]`);            // clic REAL, abre el panel
const li = await pg.$(`[id="${F}:checkboxValor_panel"] li:has(label:text-is("${who}")) .ui-chkbox-box`);
await li.click();                                       // clic REAL sobre el item
```

…y **verificar siempre en el cuerpo del POST** que viajó lo que se creía:

```js
(req.match(/checkboxValor=[^&]*/g))   // -> ["checkboxValor=T001"]
```

Sin esa verificación, mi primer intento (`sG5_act1.js`) habría reportado «al elegir T001 salen 14 filas» — que es exactamente lo contrario de lo que pasa.

⚠ **El `value` del checkbox es el código de usuario** (`T001`, `R013`…), aunque la etiqueta sea el nombre. Es la forma más limpia de mapear nombre → código sin depender del combo de otra pantalla.

### `checkAll()` deja la selección **pegada** entre casos

En `sG6` el segundo caso arrastró el `T001` del primero (`marcados: ["R013","T001"]`) pese a volver a navegar a la página. **Contar `input:checked` antes de cada Buscar** y no fiarse de que `D.goto()` reinicie el widget.

### La lista de Valores **no se recarga** al cambiar `Visualización` si se lee demasiado pronto

En Rotación, leer el panel tras 2,5 s devolvía los mismos 2.065 productos para `Productos`, `Linea` y `Proveedor`. Ahí daba igual (el reporte salía vacío de todos modos), pero en general hay que **esperar el AJAX de `clasificacion`** (~3 s) antes de leer o de llamar a `checkAll()`.

### Distinguir «vacío» de «roto»: leer el `summary` de la respuesta

Es lo que permitió cerrar H9 sin acusar a la pantalla: `L.parseErr(resp)` devuelve `{err:null, det:null}` cuando el servidor contesta vacío **sin excepción**, frente al `summary:"Error en busqueda de reporte."` de Plan VS Cuota tras Limpiar. **Vacío con `err:null` + filtros correctos en el POST ⇒ mirar la BD antes de reportar defecto.**

### Modelo de datos (añade a lo del informe 01)

- **`invoice_detail.qu_total` está a `NULL`** en esta base. Las cantidades viven en **`invoice_detail_unit.qu_invoice`**, unidas por `id_invoice_detail`; la unidad se resuelve por `product_unit.co_unit` (`UND` 337.590 líneas · `BTO` 102.268).
- **La cartera de cada usuario es `client_template_user`** (`co_user` → `co_client`). `user_address_clients` **no** sirve para esto: tiene apenas 1–87 filas por usuario.
- **`client.da_created`** es lo que separa «cliente nuevo» de «cliente de cartera» en Activación de Clientes: 37 clientes creados en la ventana.
- **`client_stock` / `client_stock_detail` están vacías** — cualquier reporte de inventario en el cliente saldrá a cero.
