# Reportes e Indicadores · INSUMAR (web)

| | |
|---|---|
| **Fecha de la corrida** | 2026-09-11 |
| **Cliente / base** | INSUMAR · empresa única `INSUM_A` — INSUMAR DISTRIBUIDORA 715, C.A. · base `insumar` |
| **Capa** | **Solo web.** No se tocó el dispositivo ni el CDP del móvil. |
| **Web** | `http://denarioelyaque.ddns.net:8080/DenarioPremium` (playa **EL YAQUE**, descubierta en runtime) |
| **Usuario** | `admin`, del bloque `# USUARIO WEB ISLA COCHE (HIDROPONIAS) / CARIBE / EL YAQUE` de `secrets/qa-credentials.env`. **Entró a la primera**: la clave del archivo sigue siendo válida. |
| **Método** | Playwright local (`automation/playwright/node_modules/playwright`), Chrome con `--remote-debugging-port=9411`, `chromium.connectOverCDP`. Scripts en este RUN_DIR (`_open.js`, `_drv.js`, `m.js`, `c.js`, `f.js`, `i.js`, `s*.js`). |
| **Escrituras** | **Ninguna.** Corrida de lectura: entrar, filtrar, mirar, contrastar contra la base. |
| **Oráculo** | `node automation/db/query.js insumar "<SQL>"` — consultas completas en `sql/consultas.sql`. |
| **Ventana de contraste** | `01/08/2026 – 31/08/2026` en casi todo. Es donde están los datos: `invoice` llega hasta 2026-08-25 y los 296 pedidos de `"order"` caen entre 2026-08-11 y 2026-08-28. |

---

## A · «Plan vs Cuota» — columna Línea y orden alfabético

### Veredicto: **BLOCKED — no se pudo medir** (lo tapa el defecto B)

No hay nada que mirar en la columna Línea: **el reporte no devuelve ni una fila**, ni con Pedido ni
con Facturado, ni en US$ ni en BULTO, ni por Línea ni por Sub-Línea. Con 0 filas no puedo decir qué
texto muestra la columna ni en qué orden salen los registros. Ver el bloque B.

Medido: 14 combinaciones de filtro, todas con `Total de Resultados: 0`.
Evidencia: `evidencia/AB-Linea_Pedido_US.png`, `evidencia/AB-Linea_Facturado_US.png`,
`evidencia/AB-Sub-Linea_Pedido_US.png`.

### Lo que sí se pudo medir, y apunta directo a la causa del nombre recortado

**En la base hay dos nombres por cada Línea/Sub-Línea, y el corto está truncado a 15 caracteres.**

```sql
SELECT co_product_structure, na_product_structure, short_na_product_structure,
       length(na_product_structure) AS len_full, length(short_na_product_structure) AS len_short
  FROM product_structure
 WHERE na_product_structure <> short_na_product_structure;
```

| Tipo | `na_product_structure` (completo) | `short_na_product_structure` (el que se ve recortado) | largo |
|---|---|---|---|
| Linea | `LECHE CONDENSADA` | `LECHE CONDENSAD` | 16 → 15 |
| Linea | `POSTRES Y GELATINAS` | `POSTRES Y GELAT` | 19 → 15 |
| Linea | `TURRONES Y BOCADILLOS` | `TURRONES Y BOCA` | 21 → 15 |
| Sub-Linea | `RELLENA Y CUBIERTA` | `RELLENA Y CUBIE` | 18 → 15 |
| Sub-Linea | `RELLENOS LIQUIDO` | `RELLENOS LIQUID` | 16 → 15 |

Son **3 de 18 Líneas** y **2 de 42 Sub-Líneas**. En las otras 55 los dos campos coinciden, así que el
síntoma «aparece recortado» solo se nota en esas cinco. Si la columna del reporte lee
`short_na_product_structure`, el recorte se explica entero y el arreglo es leer
`na_product_structure`.

⚠ **Esto es una hipótesis, no una medición de la pantalla.** No pude ver qué campo usa el reporte
porque no devuelve filas. **Hace falta confirmarlo a mano** cuando el reporte vuelva a responder:
filtrar por Línea y ver si la columna dice `LECHE CONDENSAD` (→ es `short_na`) o `LECHE CONDENSADA`.

### Contraste útil: el reporte hermano sí lo hace bien

**Reportes → Cumplimiento de Cuota**, misma familia, misma clasificación `Linea`, mismo combo de
valores, mismo rango de fechas:

| | |
|---|---|
| Filas devueltas | **18** (las 18 Líneas) |
| Nombre en la columna Descripción | **completo**: `LECHE CONDENSADA`, `POSTRES Y GELATINAS`, `TURRONES Y BOCADILLOS` |
| Orden | **alfabético ascendente**, de `ALIMENTOS` a `TURRONES Y BOCADILLOS` |

```
ALIMENTOS | BEBIDAS | CARAMELOS | CEREALES | CHICLES | CHOCOLATES | CHUPETAS | CONDIMENTOS |
GALLETAS | GOMAS | INFUSIONES | LECHE CONDENSADA | MISCELANEOS | PASAPALOS |
POSTRES Y GELATINAS | TABACO | TORTAS | TURRONES Y BOCADILLOS
```

Evidencia: `evidencia/A-10-cumpl-linea-pedido.png`.

⇒ Lo que se pide para Plan vs Cuota (nombre completo + orden alfabético) **ya está resuelto en
Cumplimiento de Cuota**. Es el lugar natural donde copiar la solución.

Dato de método, por si sirve: el **combo de valores** de Plan vs Cuota (el `Seleccione...` que se
llena al elegir la clasificación) sí trae los **nombres completos** — lista `LECHE CONDENSADA`,
`POSTRES Y GELATINAS`, `TURRONES Y BOCADILLOS`. O sea, el problema del recorte no está en el
catálogo que alimenta el filtro, está en la columna del grid.

---

## B · «Plan vs Cuota» — el filtro Facturado no devuelve nada

### Veredicto: **FAIL confirmado — y es peor de lo reportado**

**Facturado devuelve 0.** Confirmado. Pero **Pedido también devuelve 0**: el contraste
«Pedido sí, Facturado no» **no reproduce hoy**. La pantalla no devuelve nada con ninguna
combinación de filtros.

#### Reproducción mínima (3 pasos)

1. Reportes → **Plan VS Cuota**.
2. Visualización = `Linea` · Cumplimiento = `Facturado` · Unidad de Venta = `US$` · Fecha Inicio
   `01/08/2026` · Fecha Final `31/08/2026` (los 18 valores de Línea quedan marcados solos).
3. **Buscar**.

**Esperado:** las Líneas con su Plan, su Facturado y la diferencia.
**Obtenido:** `Total de Resultados: 0` · «No se encontraron registros.»

#### La matriz completa que se midió

| Visualización | Cumplimiento | Unidad | Rango | Resultado |
|---|---|---|---|---|
| Empresa | Pedido | US$ | 01/08–31/08/2026 | **0** |
| Empresa | Facturado | US$ | 01/08–31/08/2026 | **0** |
| Linea | Pedido | US$ | 01/08–31/08/2026 | **0** |
| Linea | Facturado | US$ | 01/08–31/08/2026 | **0** |
| Linea | Pedido | BULTO | 01/08–31/08/2026 | **0** |
| Linea | Facturado | BULTO | 01/08–31/08/2026 | **0** |
| Sub-Linea | Pedido | US$ | 01/08–31/08/2026 | **0** |
| Sub-Linea | Facturado | US$ | 01/08–31/08/2026 | **0** |
| Canales de distribución | Pedido | US$ | 01/08–31/08/2026 | **0** |
| Pais | Pedido | US$ | 01/08–31/08/2026 | **0** |
| Estado | Pedido | US$ | 01/08–31/08/2026 | **0** |
| Empresa | Pedido | UNIDADES | 01/08–31/08/2026 | **0** |
| Empresa | Pedido | US$ | 01/01/2020–11/09/2026 | **0** |
| *(Limpiar y Buscar sin tocar nada)* | Pedido | — | — | **0** |

#### La causa medida: **el servidor está lanzando un error, no está devolviendo «vacío»**

No es que la consulta no encuentre datos. Es que **revienta**. La respuesta AJAX del botón Buscar
trae, en las **14 de 14** combinaciones:

```
summary:"Error en busqueda de reporte."  detail:"Intente nuevamente."  severity:'error'
```

Y el POST que sale del navegador está bien formado — los filtros llegan:

```
form:j_idt115:clasificacion_input=Empresa
form:j_idt115:checkboxValor=INSUM_A
form:j_idt115:cumplimiento_input=Pedido
form:j_idt115:unidad_input=US$ - US$ - CURRENCY
form:j_idt115:fechaDesde_input=01/08/2026
form:j_idt115:fechaHasta_input=31/08/2026
```

Evidencia: `evidencia/resp-Empresa_Pedido_US.txt` y los demás `resp-*.txt` del directorio de
evidencia, capturados de la respuesta HTTP real.

*(Nota: `idEnterprise` no viaja en el POST porque el combo Empresa está `disabled` — INSUMAR tiene una
sola empresa y la web la fija del lado del servidor. Es normal, no es parte del defecto.)*

#### ¿No hay datos de facturación para esa cuota, o la consulta no los encuentra?

**Los datos de facturación están.** Agosto 2026 tiene 2.283 facturas reales por 386.243,04 US$, y la
propia web las muestra en Transacciones → Facturaciones (915 filas de vendedor, ver bloque C). El
problema no es la facturación.

**Lo que falta es el Plan y la Cuota por dimensión.** De las nueve tablas de presupuesto, **siete
están completamente vacías**:

| Tabla | Filas |
|---|---|
| `quota_plan_enterprise` | **72** |
| `sales_plan_enterprise` | **12** |
| `quota_plan_product` | 0 |
| `quota_plan_product_structure` | 0 |
| `quota_plan_segment` | 0 |
| `sales_plan_enterprise_structure` | 0 |
| `sales_plan_product` | 0 |
| `sales_plan_product_structure` | 0 |
| `sales_plan_segment` | 0 |

Es decir: INSUMAR cargó el **Plan** solo a nivel empresa (12 meses de 2026, presupuesto `id_budget=10`,
6.000.000 US$) y la **Cuota** solo por vendedor a nivel empresa (`id_budget=7`, 3.500.000 US$, 72 filas
= 6 usuarios × 12 meses). **No hay ni una fila de plan o cuota por Línea, por Sub-Línea, por producto
ni por segmento.**

Eso explica de sobra el 0 en `Linea` y `Sub-Linea`. **No explica el 0 en `Empresa`**, que sí tiene
plan y cuota cargados — y ahí el reporte también revienta con el mismo error. Así que hay al menos
una segunda cosa rota además del dato faltante.

⚠ **Alcance honesto:** «la consulta lanza excepción» está **medido** (el texto del error viene en la
respuesta del servidor). **Qué excepción es, no lo sé**: no leí el bean, y la pantalla
Empresa → Configuración → **Errores de aplicación** solo guarda errores del móvil (42 registros,
módulos Visitas/Inventarios/Pedidos/…), no del servidor web. Quien tenga acceso al log de Tomcat lo
resuelve en un minuto.

⚠ **Y una advertencia sobre lo reportado:** la incidencia dice que **Pedido sí muestra registros**.
Hoy no: Pedido devuelve 0 igual que Facturado. Puede ser que la pantalla se haya roto del todo entre
el reporte de QA y hoy, o que el caso original se probara con otros filtros. **Vale la pena que QA
lo reintente a mano y diga si alguna vez ve filas**, porque cambia el diagnóstico: «falla solo
Facturado» y «falla todo» no se arreglan igual.

---

## C · Transportistas duplicando facturas

### 🔑 Lo primero: **cómo se distingue un transportista de un vendedor en la base**

Esto no estaba documentado en el repo. Queda documentado.

**Se distingue por el ROL, y el rol NO está en la tabla `users`.** `users` no tiene columna `id_role`;
la relación vive en la tabla puente **`role_user`**:

```sql
SELECT u.id_user, ud.co_user, u.login_user,
       u.name_user || ' ' || u.lastname_user AS nombre,
       r.na_role, r.editable_na_role, r.selector
  FROM users u
  LEFT JOIN users_data ud ON ud.id_user = u.id_user
  LEFT JOIN role_user  ru ON ru.id_user = u.id_user
  LEFT JOIN role       r  ON r.co_role  = ru.co_role
 ORDER BY u.id_user;
```

| | Vendedor | Transportista |
|---|---|---|
| `role.co_role` | **7** | **15** |
| `role.na_role` | `ROLE_SALESMAN` | **`ROLE_TRANSPORT`** |
| `role.editable_na_role` | `Vendedor` | **`Transportista`** |
| `role.selector` | `true` | **`true`** ← *aquí está el problema* |

**`role.selector` es la marca de «este rol se puede elegir como vendedor», y en INSUMAR la tienen
LOS DOS.** De los 13 roles de la tabla, solo `ROLE_SALESMAN` y `ROLE_TRANSPORT` la tienen en `true`.
⇒ **Cualquier consulta que arme la lista de vendedores con `role.selector = true` va a incluir a los
transportistas.** Ése es el criterio que hay que cambiar, o bien apagar `selector` en
`ROLE_TRANSPORT`.

**Quiénes son, en INSUMAR hoy:**

| `co_user` | login | Nombre | Rol |
|---|---|---|---|
| `R013` | r013 | VIVIANA ESCALANTE | Vendedor |
| `R003` | r003 / R003 | EVA MEDINA | Vendedor *(está **dos veces** en `users`: id 13 con `co_operation='D'` e id 22 con `'I'` — ver hallazgo H4)* |
| `R007` | R007 | MIGUEL PARRA | Vendedor |
| `R009` | R009 | YENNI ALVAREZ | Vendedor |
| `R015` | R015 | ALEJANDRA RODRIGUEZ | Vendedor |
| `R016` | R016 | LEANDRO REBOLLEDO | Vendedor |
| **`T001`** | t001 | JOSE MUÑOZ | **Transportista** |
| **`T002`** | t002 | LEANDRO MUÑOZ | **Transportista** |
| **`T003`** | t003 | YONI MILANO | **Transportista** |
| **`T004`** | t004 | SAUL PENOTT | **Transportista** |
| **`T005`** | t005 | ARMANDO ROSAS | **Transportista** |
| **`T006`** | t006 | VACANTE VACANTE | **Transportista** |

Regla práctica para leer datos de INSUMAR: **`co_user` que empieza por `T` = transportista**. Pero el
prefijo es convención del cliente, no es el criterio: **el criterio es `role_user → role.na_role`.**

---

### C.1 · La duplicación en la base: **FAIL, confirmado y cuantificado**

La misma factura está **físicamente repetida** en la tabla `invoice`, una fila por transportista, con
el código del transportista pegado al final:

```sql
SELECT co_invoice, co_user, nu_amount_total, da_invoice::date, co_client
  FROM invoice
 WHERE regexp_replace(co_invoice,'T[0-9]{3}$','') = '20095815';
```

| `co_invoice` | `co_user` | Monto | Fecha | Cliente |
|---|---|---|---|---|
| `20095815` | **R009** (vendedor) | 43,24 | 2026-08-25 | 1327 |
| `20095815T001` | T001 | 43,24 | 2026-08-25 | 1327 |
| `20095815T002` | T002 | 43,24 | 2026-08-25 | 1327 |
| `20095815T003` | T003 | 43,24 | 2026-08-25 | 1327 |
| `20095815T004` | T004 | 43,24 | 2026-08-25 | 1327 |
| `20095815T005` | T005 | 43,24 | 2026-08-25 | 1327 |
| `20095815T006` | T006 | 43,24 | 2026-08-25 | 1327 |

**7 filas para 1 factura.** Mismo cliente, mismo monto, misma fecha. Coincide exactamente con lo
reportado: *«la misma factura se recibe para el vendedor que corresponde y para todos los
transportistas creados»*.

**Cuántas veces aparece cada factura:**

| Copias | Facturas | Qué son |
|---|---|---|
| 1 | 3.345 | solo la del vendedor (sin copias de transporte) |
| 6 | 2.401 | **solo las 6 de transportista** — la del vendedor no existe |
| 7 | 2.527 | vendedor + los 6 transportistas |

**Cuánto se infla el total:**

| | Tabla completa | Agosto 2026 |
|---|---|---|
| Filas en `invoice` | **35.440** | **14.850** |
| Facturas reales | **8.273** | **2.283** |
| Factor de inflado (filas) | **4,28×** | **6,50×** |
| Monto sumando todas las filas | **45.465.124,18** | **2.525.894,63** |
| Monto de las filas sin sufijo (vendedor) | **6.734.040,40** | **208.436,39** |

En agosto, **cada uno** de los 6 transportistas carga **las 2.283 facturas del mes, por 386.243,04 US$
cada uno**:

| `co_user` | Filas ago-2026 | Monto ago-2026 | Con sufijo `T###` |
|---|---|---|---|
| T001 … T006 | **2.283 c/u** | **386.243,04 c/u** | 2.283 c/u |
| R013 VIVIANA | 289 | 69.504,47 | 0 |
| R003 EVA | 233 | 30.992,23 | 0 |
| R016 LEANDRO | 195 | 27.595,11 | 0 |
| R007 MIGUEL | 177 | 28.512,03 | 0 |
| R009 YENNI | 142 | 18.564,59 | 0 |
| R015 ALEJANDRA | 112 | 32.177,15 | 0 |
| A001 ADRIANA (admin) | 4 | 1.090,81 | 0 |

⇒ Cualquier pantalla que sume `invoice` sin excluir a los transportistas **multiplica el mes por 6,5**
(2.525.894,63 en vez de 386.243,04).

> **Importante para quien decida el arreglo:** esto **no es un defecto de render de la web**. Las
> copias **están grabadas en la base**. Filtrar la pantalla por rol tapa el síntoma; la duplicación
> del dato sigue ahí, y es del proceso que carga las facturas (integrador / sincronización), no de la
> web. **No investigué qué proceso las escribe** — eso es de desarrollo.

---

### C.2 · En pantalla: **el síntoma NO reproduce donde se reportó, y SÍ reproduce en otro sitio**

Se probaron las pantallas nombradas en la incidencia, y una más que apareció por el camino.

| Pantalla | ¿El combo de vendedor ofrece transportistas? | Veredicto |
|---|---|---|
| **Transacciones → Facturaciones** (`/pages/facturaciones`) | **No** — solo los 6 vendedores | **NO reproduce** |
| **Indicadores → Vendedores** (`/pages/pedidosVendedores`) | **No** — solo los 6 | **NO reproduce** |
| **Indicadores → Productos → % Participación** (`/pages/indicadoresProductos`) | **No** — solo los 6 | **NO reproduce** |
| **Indicadores → Ventas Diarias** (`pedidosProductosVentas.xhtml`) | **No** — solo los 6 (con prefijo `R0xx -`) | **NO reproduce** |
| **Indicadores → Cobros → Cobranzas** (`indicadorCobros.xhtml`) | **No** — solo los 6 | **NO reproduce** |
| **Indicadores → Pedidos**, **→ Clientes**, **→ Morosidad** | no tienen combo de vendedor; ningún `T00x` en el contenido | **NO reproduce** |
| **Reportes → Cumplimiento de Cuota** (`/pages/reporteCumplimientoCuota`) | **SÍ — los 6 transportistas y además `C001 CATALOGO INSUMAR`** | 🔴 **FAIL** |

**Transacciones → Facturaciones, agosto 2026, tipo «Facturas cobradas»:**

| Dato | Pantalla | BD |
|---|---|---|
| Total de Resultados | **915** | 1.148 filas de vendedor (1.152 con el admin A001) |
| Códigos con sufijo `T###` | **0** | 13.698 en el mes |
| Vendedores que aparecen | los 6 | — |

Control que valida el método: filtrando **Vendedor = VIVIANA ESCALANTE** la pantalla devuelve **289**
y la BD tiene **289** para `R013`. Cuadra al registro.
Evidencia: `evidencia/C-03-fact-cobradas-agosto.png`, `evidencia/C-08-fact-viviana.png`.

⇒ **En Facturaciones el filtrado por rol ya está bien hecho.** Las copias de los transportistas están
en la base pero la pantalla no las lista.

**Donde sí se cae — Reportes → Cumplimiento de Cuota.** El combo **Vendedor** lista **13 usuarios**:

```
Todos | R013 VIVIANA ESCALANTE | T001 JOSE MUÑOZ | T002 LEANDRO MUÑOZ | T003 YONI MILANO |
T004 SAUL PENOTT | T005 ARMANDO ROSAS | R015 ALEJANDRA RODRIGUEZ | R007 MIGUEL PARRA |
R016 LEANDRO REBOLLEDO | R009 YENNI ALVAREZ | T006 VACANTE VACANTE | R003 EVA MEDINA |
C001 CATALOGO INSUMAR
```

Eligiendo **T001 JOSE MUÑOZ** el reporte **devuelve 18 filas con datos**, no se queja. Es decir: un
transportista se puede seleccionar como si fuera vendedor y el reporte le calcula cumplimiento.
Evidencia: `evidencia/C-COMBO-reporteCumplimientoCuota.png`, `evidencia/C-06-cumpl-fact-T001.png`.

⚠ Los **montos** que devuelve ese reporte al elegir un usuario concreto son absurdos (`ALIMENTOS`
pasa de 6.774,52 con «Todos» a 534.646.551,90 con T001, y 102.940.775,30 con la vendedora R013).
**No lo reporto como defecto**: puede ser un problema de moneda/unidad del propio reporte y **no lo
verifiqué**. Lo dejo anotado para que se mire aparte.

---

### C.3 · Indicadores → Vendedores con Cumplimiento = Facturado no devuelve nada · 🔴

No es lo que se reportó, pero apareció al probarlo y es del mismo módulo.

| Filtro | Resultado |
|---|---|
| Cumplimiento = **Pedido**, US$, 01/08–31/08/2026 | ✅ 3 filas (LEANDRO REBOLLEDO 123 / 17.082,85 · ALEJANDRA RODRIGUEZ 12 / 2.966,44 · EVA MEDINA 11 / 1.423,58) |
| Cumplimiento = **Facturado**, US$, 01/08–31/08/2026 | ❌ **«No existe registro»** |
| Cumplimiento = **Facturado**, US$, 01/01–11/09/2026 | ❌ **«No existe registro»** |

La BD tiene 915 facturas de vendedor en agosto, así que hay de sobra qué mostrar. El «Total de
Clientes» del encabezado sí cambia entre Pedido (829) y Facturado (815), o sea que la pantalla
reacciona al filtro — es el grid el que sale vacío.
Evidencia: `evidencia/C-04-ind-vendedores-facturado.png`, `evidencia/C-05-ind-vend-fact-ano.png`.

---

## Hallazgos

### H1 · Plan VS Cuota lanza error de servidor en toda búsqueda · 🔴 Alto

14 de 14 combinaciones responden `Error en busqueda de reporte. / Intente nuevamente.` y pintan
«No se encontraron registros.». Incluye la pantalla recién limpiada, sin tocar filtros. Tapa por
completo la incidencia A y hace que B sea más grave de lo reportado (Pedido tampoco anda).
**Evidencia:** `evidencia/resp-*.txt`, `evidencia/AB-*.png`, `evidencia/B-CONTROL1-defaults.png`.

### H2 · No hay Plan ni Cuota cargados por Línea/Sub-Línea/producto/segmento · 🟠 Medio · **es el dato, no la pantalla**

Siete de las nueve tablas de presupuesto están vacías. Aunque se arregle H1, el reporte por Línea no
tendrá plan que comparar hasta que INSUMAR cargue el presupuesto a ese nivel.
**Evidencia:** `sql/consultas.sql` Q8.

### H3 · Cumplimiento de Cuota ofrece transportistas (y el catálogo) como vendedores · 🔴 Alto

Combo de 13 usuarios: 6 vendedores + 6 transportistas + `C001 CATALOGO INSUMAR`. Seleccionar `T001`
devuelve datos. Las otras 6 pantallas equivalentes listan solo los 6 vendedores, así que el criterio
correcto ya existe en el producto y aquí no se aplicó.
**Causa candidata:** el filtro usa `role.selector = true`, que en INSUMAR también es `true` para
`ROLE_TRANSPORT`. **No leí el SQL del bean** — es inferencia sobre una medición.
**Evidencia:** `evidencia/C-COMBO-reporteCumplimientoCuota.png`.

### H4 · `EVA MEDINA` existe dos veces en `users` y sus 233 facturas no se ven · 🟠 Medio

`users` tiene `id_user=13` (`co_operation='D'`, borrado lógico) e `id_user=22` (`'I'`, vivo), los dos
con `co_user='R003'`. Sus facturas cuelgan del **13**; el combo de Facturaciones envía el **22**.

| Filtro en Facturaciones (ago-2026, Facturas cobradas) | Pantalla | BD |
|---|---|---|
| Vendedor = **EVA MEDINA** | **0** ❌ | **233** |
| Vendedor = VIVIANA ESCALANTE *(control)* | 289 ✅ | 289 |
| sin filtro de vendedor | 915 | 1.148 (915 + 233 de EVA) |

Es decir: el combo la ofrece y el grid nunca puede devolver nada suyo, y sus 233 facturas faltan del
listado sin filtro. El `915 = 289+195+177+142+112` cuadra al registro.
**Evidencia:** `evidencia/C-07-fact-evamedina.png`, `evidencia/C-08-fact-viviana.png`.

### H5 · Indicadores → Vendedores, Cumplimiento = Facturado, sale vacío · 🟠 Medio

Con Pedido devuelve filas; con Facturado, «No existe registro» en los dos rangos probados, habiendo
915 facturas de vendedor en la ventana. **Evidencia:** `evidencia/C-05-ind-vend-fact-ano.png`.

### H6 · `invoice` guarda 4,28 copias por factura · 🔴 Alto · **es el dato, no la pantalla**

35.440 filas para 8.273 facturas. Una copia por transportista, con el `co_user` pegado al código
(`20095815T001`). El arreglo de fondo no va en la web sino en el proceso que escribe las facturas.
**Evidencia:** `sql/consultas.sql` Q3–Q6.

### H7 · Cabecera de columna recortada en Plan VS Cuota · 🟡 Bajo

Con Visualización = `Sub-Linea` la primera columna del grid se titula **`Sub`**, no `Sub-Linea`
(con `Linea` sí dice `Linea`). Medido sobre el `<th>` del `thead`, con el grid vacío.
**Evidencia:** `evidencia/AB-Sub-Linea_Pedido_US.png`.

---

## Lo que NO se pudo comprobar

- **Qué texto muestra realmente la columna Línea de Plan vs Cuota, y en qué orden.** Es el corazón
  de la incidencia A y quedó sin medir: el reporte no devuelve filas. La hipótesis
  `short_na_product_structure` **necesita confirmación a mano** cuando la pantalla vuelva a responder.
- **Si «Pedido sí muestra registros» alguna vez fue cierto en esta versión.** Hoy devuelve 0 igual
  que Facturado. **Pedir a QA que lo reintente a mano** y diga si ve filas: cambia el diagnóstico.
- **Qué excepción lanza el reporte.** El error llega como mensaje de usuario
  (`Error en busqueda de reporte.`); el stack está en el log de Tomcat, fuera del alcance de esta
  corrida. La pantalla «Errores de aplicación» de la web **no sirve**: solo guarda errores del móvil.
- **El SQL real de los beans.** Todo lo de causa (`role.selector`, `short_na_product_structure`, el
  cruce por vendedor) es **inferencia sobre medición**, no lectura de código: `../src/` está fuera de
  alcance por norma de la corrida.
- **Si los defectos son nuevos o vienen de antes.** No hay medición previa de estas pantallas en el
  repo. No puedo decir si es regresión de la 6.6.21.3.
- **Los montos disparatados de Cumplimiento de Cuota al filtrar por un usuario** (534 millones para
  ALIMENTOS con T001). Lo vi, no lo verifiqué, no lo reporto como defecto.
- **Por qué `invoice` recibe las copias.** Se midió que están; no se investigó qué proceso las
  escribe (integrador, sincronización o carga inicial).
- **Qué ve un usuario que no sea `admin`.** Solo se probó con `admin`. No se comprobó si un vendedor
  o un transportista, entrando a la web, ven algo distinto.
- **Multi-empresa.** INSUMAR tiene una sola empresa (`INSUM_A`) y el combo está `disabled`; no se
  puede probar si el filtro de empresa cambia algo.
- **Exportar Reporte.** No se ejecutó: descarga un archivo y la corrida era de solo lectura.
- **El botón «Columnas»** (`form:pedidosDT:togglerInvoices`) de Facturaciones: no se abrió. Podría
  haber columnas ocultas.

---

## Patrones y selectores nuevos de la web

De estas pantallas no había nada documentado en el repo. Todo lo de abajo está **medido en esta
corrida** (playa EL YAQUE, 11/09/2026, cliente INSUMAR).

### Arranque de sesión

`automation/playwright/qa-web-open.js` sirve de plantilla, **con dos correcciones**:

1. **`require('playwright')` falla** si el script no vive bajo `automation/playwright/`. Desde un
   RUN_DIR hay que resolver la ruta:
   ```js
   const { chromium } = require(path.resolve(__dirname,'..','..','..','playwright','node_modules','playwright'));
   ```
2. El bloque de credenciales de EL YAQUE es `# USUARIO WEB ISLA COCHE (HIDROPONIAS) / CARIBE / EL YAQUE`,
   no el primero del archivo (el primero es LA TORTUGA y tiene otra clave).

Login en `/pages/login.xhtml`; los ids de los inputs son generados por JSF y cambian entre builds:
usar `input[type="text"]:not([style*="display: none"])` y `input[type="password"]`. Tras entrar se cae
en `/pages/main`, que trae contenido de plantilla en inglés (Rain Clothing, Chicago USA…): es el demo
del tema, **no** datos del cliente.

**El mapa completo del menú se saca de una sola pasada** (más fiable que adivinar rutas):
```js
[...document.querySelectorAll('a')].map(a => a.textContent.trim() + ' ::: ' + a.getAttribute('href'))
```

Rutas útiles descubiertas así:
`/pages/reportePlanCuota` · `/pages/reporteCumplimientoCuota` · `/pages/reporteActivacionClientes` ·
`/pages/reporteRotacionInventario` · `/pages/facturaciones` · `/pages/documentos` ·
`/pages/indicadoresPedidos` · `/pages/pedidosVendedores` · `/pages/pedidosClientes` ·
`/pages/indicadoresProductos` · `/pages/protected/indicadores/indicadorCobros.xhtml` ·
`/pages/protected/indicadores/indicadorMorosos.xhtml` ·
`/pages/protected/indicadores/pedidosProductosVentas.xhtml` · `/pages/presupuestoVenta` ·
`/pages/presupuestoCuota` · `/pages/estructuraProducto`.

### Plan VS Cuota · `/pages/reportePlanCuota`

| Elemento | Selector | Nota |
|---|---|---|
| Empresa | `[id="form:j_idt115:idEnterprise_input"]` | **`disabled`** con una sola empresa ⇒ **no viaja en el POST** |
| Visualización | `[id="form:j_idt115:clasificacion"]` | `Visualización` / `Empresa` / `Canales de distribución` / `Pais` / `Estado` / `Linea` / `Sub-Linea` |
| Valores (multi-check) | `[id="form:j_idt115:checkboxValor"]` | `selectCheckboxMenu`, **se repuebla al cambiar la Visualización** |
| Cumplimiento | `[id="form:j_idt115:cumplimiento"]` | `Pedido` / `Facturado` |
| Unidad de Venta | `[id="form:j_idt115:unidad"]` | `BULTO` / `DISPLAY` / `KILOGRAMOS` / `UNIDADES` / `BS` / `US$` |
| Fechas | `[id="form:j_idt115:fechaDesde_input"]` / `fechaHasta_input` | `dd/mm/aaaa`; por defecto el mes en curso |
| Buscar / Limpiar | `[id="form:j_idt115:ajax"]` / `botonLimpiar` | |
| Grid | `[id="form:tablaComparativoPlanCuota"]` | |
| Total | `document.body.innerText.match(/Total de Resultados:\s*(\d+)/)` | |

El valor interno del combo **no es la etiqueta**: `clasificacion_input` vale
`Líneas de producto-1-Linea`, `Zonas de venta-2-Estado`, `Empresa`; `unidad_input` vale
`US$ - US$ - CURRENCY`, `BTO - BULTO - UNIT`. **Verificar siempre contra el `<select>`, no contra el
texto visible.**

Cumplimiento de Cuota (`/pages/reporteCumplimientoCuota`) usa **los mismos ids** más
`[id="form:j_idt115:codRdv"]` (Vendedor) y el grid `[id="form:tablaCumplimientoCuota"]`.

### 🔑 El `selectCheckboxMenu` de PrimeFaces no se puede clickear: hay que usar el widget

Es la trampa que costó cuatro mediciones falsas. **El panel se renderiza de forma perezosa
(`isDynamicLoaded`)**: hasta que no se abre una vez, `..._panel` no existe y cualquier
`page.click()` sobre los `li` falla o encuentra 0 items. Y un `click()` sobre el propio widget lo
intercepta un `div.col-12` del layout.

Lo que funciona, sin tocar el DOM a mano:

```js
await pg.evaluate(() => {
  const w = PrimeFaces.widgets['widget_form_j_idt115_checkboxValor'];
  try { w.renderPanel(); } catch(e) {}   // <- IMPRESCINDIBLE: sin esto checkAll() no hace nada
  w.checkAll();
});
// verificar contra los checkbox reales, que es lo que se envía:
[...document.querySelectorAll('input[name="form:j_idt115:checkboxValor"]')].filter(i => i.checked).length
```

⚠ **La etiqueta miente:** el widget puede decir `Seleccione...` con los 18 valores marcados. **No usar
el texto del combo como oráculo** — contar los `input:checked`.
⚠ **`Limpiar` desmarca todos los valores.** Si se presiona Limpiar y luego Buscar, sale 0 por
filtro vacío, no por defecto de la pantalla.

Los nombres de widget se descubren con:
```js
Object.keys(window.PrimeFaces.widgets)   // -> widget_form_j_idt115_checkboxValor, etc.
```

### Los `selectOneMenu` sí van por clic

```js
async function pick(pg, base, label) {            // base = id sin sufijo
  await pg.click(`[id="${base}_label"]`);
  await pg.waitForTimeout(800);
  const el = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if (!el) return false;                           // nunca dar por hecho que el ítem estaba
  await el.click();
  await pg.waitForTimeout(1800);                   // el AJAX repinta el panel de filtros
  return true;
}
```

### Las fechas: `.value = '01/08/2026'` **sí** se envía

El `p-datepicker` de esta build es un `<span>` con un `<input id="..._input">` dentro, y **ese input
es lo que viaja en el POST**. Asignarle `.value` por JS funciona — verificado capturando el cuerpo
del POST. No hace falta pelearse con el calendario, y conviene evitarlo: abrirlo deja un overlay que
intercepta el clic de Buscar.

**Sigue valiendo el orden: combos → fechas → Buscar.** Elegir en un combo dispara AJAX y repinta las
fechas con el mes en curso.

### 🔑 Leer el error del servidor, no la tabla vacía

**Esto es lo que convirtió «no hay datos» en «la consulta revienta».** Estas pantallas pintan
«No se encontraron registros.» tanto cuando no hay datos como cuando el bean lanza excepción. La
diferencia está en la respuesta AJAX:

```js
let resp = null;
const h = async r => {
  if (r.request().method() === 'POST' && r.url().includes('reportePlanCuota')) {
    try { resp = await r.text(); } catch(e) {}
  }
};
pg.on('response', h);
await pg.$eval('[id="form:j_idt115:ajax"]', e => e.click());
await pg.waitForTimeout(8000);
pg.off('response', h);
const err = resp && (resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/) || [])[1];
```

**Hacer esto en TODA medición que dé 0.** Un 0 con error y un 0 sin error son defectos distintos.

### Facturaciones · `/pages/facturaciones`

Prefijo `form:j_idt116` (≠ `j_idt115` del resto). Mismos selectores que ya estaban documentados para
IMPORTADORA 4K (`idSalesmaView` sin la `n`, `tipoDocumento`, `dateB_input`/`dateF_input`,
grid `form:pedidosDT`, `Consultar` navega a `/pages/detalleFacturacion`), **con una diferencia de
datos importante en INSUMAR**: el tipo `Consolidado` y el tipo `Facturas cobradas` devuelven **el
mismo total (915)**; lo que cambia es la columna Tipo y si el código lleva el prefijo `FACT`
(`FACT20095921` en Consolidado vs `20095921` en Facturas cobradas). No asumir que Consolidado = suma
de los otros dos.

### Indicadores

Todos los de `/pages/indicadores*` y `/pages/pedidos*` usan el prefijo `form:j_idt115`, con
`cumplimiento` (`Pedido`/`Facturado`), `idCurrency` (`BS`/`US$`/`BULTO`/`DISPLAY`/`KILOGRAMOS`/`UNIDADES`)
y `dateB_input`/`dateF_input`. Los de `/pages/protected/indicadores/*.xhtml` usan `form:j_idt116`.

⚠ **`page.goto()` directo a `/pages/pedidosVendedores` puede devolver 404 de Tomcat.** Lo que funciona
es tomar el `href` del `<a>` del menú en `/pages/main` y navegar a él. El vacío de estas pantallas
dice **«No existe registro»**, no «No se encontraron registros.».

⚠ **Hay un diálogo de expiración de sesión** (`j_idt50:timeoutDialog`, botón `j_idt50:confirm` = Ok)
que aparece tras ~20 min de inactividad y roba el foco. En corridas largas conviene cerrarlo o
refrescar antes de cada medición.

### Modelo de datos útil para futuras corridas

- **El rol de un usuario está en `role_user`, no en `users`.** `users` no tiene `id_role`. La cadena
  es `users.id_user → role_user.id_user → role_user.co_role → role.co_role`.
- **`role.selector`** = «este rol se puede elegir como vendedor». En INSUMAR es `true` para
  `ROLE_SALESMAN` (7) y **`ROLE_TRANSPORT` (15)**. Es la clave para predecir qué usuarios va a listar
  cada pantalla.
- `role.editable_na_role` trae el nombre en español (`Vendedor`, `Transportista`, `Catalogo`).
- **`co_operation`**: `I` = viva, `U` = actualizada (también viva), `D` = borrada lógicamente. **Filtrar
  solo por `='I'` deja fuera filas válidas** — en INSUMAR la mayoría de los usuarios activos tienen
  `'U'`. Costó una medición: un primer conteo de roles dio 2 vendedores cuando en realidad son 6.
- **`product_structure` tiene DOS nombres**: `na_product_structure` (completo) y
  `short_na_product_structure` (truncado a 15 caracteres). `type_product_structure` define los niveles
  (`001` = Linea, 18 filas · `002` = Sub-Linea, 42 filas).
- **Presupuestos**: `budget` (cabecera, con `type` = `BUDGET_SALES_PLAN` / `BUDGET_QUOTA_PLAN`, `year`,
  `co_plan`, `tipo_unidad`) + nueve tablas de detalle (`sales_plan_*` / `quota_plan_*` por
  `enterprise`, `enterprise_structure`, `product`, `product_structure`, `segment`), todas con
  `nu_month` 1–12. Los presupuestos borrados quedan con `co_operation='D'` en `budget`.
- **`invoice.co_invoice` NO es el número de factura en INSUMAR**: es `<número><co_user del
  transportista>`. El número real se saca con `regexp_replace(co_invoice,'T[0-9]{3}$','')`. **Contar
  filas de `invoice` como si fueran facturas infla el resultado 4,28×.**
- La tabla de devoluciones aquí se llama **`return`** (singular).
