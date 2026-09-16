# INSUMAR · Filtro «solo vendedores» · vuelta completa por los tres módulos

| | |
|---|---|
| **Fecha** | 2026-09-15 |
| **Cliente / base** | INSUMAR · empresa única `INSUM_A` — INSUMAR DISTRIBUIDORA 715, C.A. · base `insumar` |
| **Capa** | **Solo web + base, solo lectura.** No se tocó el móvil, ni el CDP, ni la web de CARIBE. |
| **Web** | `http://denarioelyaque.ddns.net:8080/DenarioPremium` (playa **EL YAQUE**) |
| **Usuario** | `admin`, bloque **2** (`# USUARIO WEB ISLA COCHE (HIDROPONIAS) / EL YAQUE`). **Entró a la primera**: la clave de El Yaque **no** cambió. |
| **Escrituras** | **Ninguna.** Ni en la web ni en la base. |
| **Cobertura** | **Los 3 módulos completos: 4 pantallas de Reportes + 7 de Indicadores + Facturaciones.** 31 búsquedas medidas sobre la respuesta AJAX real. |
| **Ventanas** | `01/08–31/08/2026` y `01/09–14/09/2026` (+ controles a `30/08`) |
| **Antecedentes** | `plan_vs_cuota_20260914/01-plan-vs-cuota.md` · `web_reportes_20260911/01-reportes-web.md` |

> ⚠ **La base se sigue moviendo.** `invoice` pasó de 35.440 filas (11/09) a **46.564** hoy. Las ventanas de
> agosto y septiembre **no** cambiaron, y **los oráculos del encargo se verificaron uno a uno antes de medir**
> (Q1/Q2): coinciden al céntimo. No se recalculó nada «por las bravas».

---

# VEREDICTO POR MÓDULO

| Módulo | ¿Cumple el criterio del cliente? | |
|---|---|---|
| **1 · Reportes** (4 pantallas) | **SÍ** | Ninguna muestra transportistas; ninguna cuenta la factura más de una vez |
| **2 · Indicadores** (7 pantallas) | **SÍ** | Idem; el que salía vacío (H5) **ahora devuelve el corte exacto** |
| **3 · Transacciones › Facturaciones** | **SÍ** | 1.171 / 468 al registro, 0 códigos con sufijo `T###` |

## 🟢 La tarjeta «INSUMAR - Mejora en Reportes - Filtro para ver solo vendedores» **se puede cerrar**

**El defecto que la motivó está corregido, y está corregido en el sitio donde de verdad fallaba.**
El 14/09 el veredicto fue «corregida a medias» porque **Cumplimiento de Cuota** —el único reporte que
incumplía— no había recibido el filtro y devolvía **1.234.013,93 en 7.368 facturas**, contando cada copia
de transportista. **Hoy devuelve el corte de vendedores exacto.** Esa era la pieza que faltaba.

> ⚠ **Pero hay que abrir tarjetas nuevas antes de darlo por terminado.** Se cierra **el criterio de la
> tarjeta**, no las pantallas: quedan vivos **dos defectos de importe/fecha que no son de transportistas**
> y que hacen que dos de esas pantallas sigan dando cifras que nadie puede usar (N1 y K2, abajo).

---

# 1 · El inventario: qué hay en cada módulo y qué se dio por bueno

Sacado del menú real, no de suposiciones (`menu-grupos.json`).

## Módulo **Reportes** — 4 reportes

| # | Reporte | Ruta | ¿Aplica a facturación? | Qué se midió | Veredicto |
|---|---|---|---|---|---|
| 1 | **Plan VS Cuota** | `/pages/reportePlanCuota` | **Sí** | Empresa · Facturado · US$ · ago + sep + control 30/08; y vista por Línea | ✅ **cumple** |
| 2 | **Cumplimiento de Cuota** | `/pages/reporteCumplimientoCuota` | **Sí** 🔑 | Empresa · Facturado · US$ · Todos · ago + sep + control 30/08; y vista por Línea | ✅ **cumple** (era el que fallaba) |
| 3 | **Activación de Clientes** | `/pages/reporteActivacionClientes` | **Sí** (tiene vista por Vendedores) | Visualización = **RDV/Vendedores** · Facturado · ago; y Empresa | ✅ **cumple** |
| 4 | **Rotación de Inventario** | `/pages/reporteRotacionInventario` | **No** — es inventario (SELL IN / SELL OUT / rotación), no facturación por vendedor | Línea · Facturado · UNIDADES · ago | ⚪ **N/A · mirado y documentado** |

**Rotación de Inventario devolvió 0 filas, y no es defecto:** la respuesta AJAX llega **sin error** de
servidor y la tabla `client_stock` está **vacía (0 filas)**, igual que `client_stock_detail`. Sin inventario
capturado no hay rotación que calcular. **Falta de dato, no fallo de pantalla.** Tampoco tiene ninguna
dimensión de vendedor, así que el criterio del cliente no le aplica.

## Módulo **Indicadores** — 7 pantallas *(nunca se habían medido en bloque)*

El menú muestra 9 entradas, pero **dos son solo cabeceras de grupo** (`Cobros` y `Productos`, con `href="#"`).
**Pantallas reales: 7.**

| # | Indicador | Ruta | ¿Aplica a facturación? | Qué se midió | Veredicto |
|---|---|---|---|---|---|
| 1 | **Pedidos** | `/pages/indicadoresPedidos` | **Sí** | Año 2026 · Facturado · US$ | ✅ **cumple — cuadra al céntimo** |
| 2 | **Vendedores** | `/pages/pedidosVendedores` | **Sí** 🔑 | Todos · Facturado · US$ · ago + sep; control con Pedido | ✅ **cumple — cuadra vendedor por vendedor** |
| 3 | **Clientes** | `/pages/pedidosClientes` | **Sí** | Facturado · US$ · ago | ✅ **cumple** (escala correcta) |
| 4 | **% de Participación** | `/pages/indicadoresProductos` | **Sí** | Todos · Linea · Facturado · US$ · ago | 🟡 **sin transportistas, pero importes inflados** |
| 5 | **Ventas Diarias** | `/pages/protected/indicadores/pedidosProductosVentas.xhtml` | **Sí** | Combo de vendedor + Rango de Fechas | 🟡 **combo OK · datos NO medidos** (ver «no comprobado») |
| 6 | **Cobranzas** | `/pages/protected/indicadores/indicadorCobros.xhtml` | **No** — son cobros, no facturas | Combo de vendedor · US$ · ago | ⚪ **N/A · mirado**, combo limpio |
| 7 | **Morosidad** | `/pages/protected/indicadores/indicadorMorosos.xhtml` | **No** — cuentas por cobrar / vencimiento | Cuentas por cobrar · US$ | ⚪ **N/A · mirado**, no tiene combo de vendedor |

## Módulo **Transacciones** — la pantalla nombrada en el requerimiento

Transacciones tiene 7 pantallas (Pedidos, **Facturaciones**, Cobros, Devoluciones, Depósitos, Clientes
Potenciales, Inventarios). **El requerimiento nombra Facturaciones**, y es la que se midió a fondo, en sus
**tres tipos de documento**.

| Tipo de documento | Qué se midió | Veredicto |
|---|---|---|
| **Facturas cobradas** | ago + sep + control 30/08 + control por vendedor | ✅ **cumple** |
| **Consolidado** | ago | ✅ **cumple** |
| **Pendientes por cobrar** | ago | ⚪ **no es facturación replicada** (ver abajo) |

---

# 2 · La tabla de contraste: pantalla vs base

**Regla de lectura:** «Pantalla» = lo que se leyó en el grid / en la respuesta AJAX. «Base» = la consulta
de `sql/consultas.sql`. La columna **Δ** es la diferencia.

## 2.1 · Lo que el criterio del cliente pide: **corte de vendedores, cada factura una vez**

| # | Pantalla | Ventana | **Pantalla** | **Base (corte vendedores)** | **Δ** | |
|---|---|---|---|---|---|---|
| 1 | **Plan VS Cuota** · Empresa · Facturado · US$ | ago | **224.411,08** | 224.411,08 | **0,00** | ✅ |
| 2 | **Plan VS Cuota** | sep 1–14 | **80.160,23** | 80.160,23 | **0,00** | ✅ |
| 3 | **Plan VS Cuota** *(control 01–30/08)* | ago 1–30 | **212.706,05** | 212.706,05 | **0,00** | ✅ |
| 4 | **Cumplimiento de Cuota** · Todos · Empresa · Facturado | sep 1–14 | **80.160,23** · 468 | 80.160,23 · 468 | **0,00** | ✅ |
| 5 | **Cumplimiento de Cuota** | ago | **232.003,67** · 1.220 | 224.411,08 · 1.171 | **+7.592,59 · +49** | ⚠ **es la fecha, no el rol** → §3 |
| 6 | **Cumplimiento de Cuota** *(control 01–30/08)* | ago 1–30 | **224.411,08** · 1.171 | 224.411,08 · 1.171 *(de 01–31/08)* | **0,00** | ⚠ confirma el desfase |
| 7 | **Indicadores › Pedidos** · Facturado · US$ | año 2026 | **1.733.804,89** · 8.261 | 1.733.804,89 · 8.261 | **0,00** | ✅ |
| 8 | **Indicadores › Vendedores** · Facturado · US$ | ago | **224.411,08** · 1.171 *(suma de las 5 filas)* | 224.411,08 · 1.171 | **0,00** | ✅ |
| 9 | **Indicadores › Vendedores** | sep 1–14 | **80.160,23** · 468 | 80.160,23 · 468 | **0,00** | ✅ |
| 10 | **Facturaciones** · Facturas cobradas | ago | **1.171** | 1.171 | **0** | ✅ |
| 11 | **Facturaciones** · Consolidado | ago | **1.171** | 1.171 | **0** | ✅ |
| 12 | **Facturaciones** · Facturas cobradas | sep 1–14 | **468** | 468 | **0** | ✅ |
| 13 | **Facturaciones** *(control 01–30/08)* | ago 1–30 | **1.118** | 1.118 | **0** | ✅ |
| 14 | **Facturaciones** *(control VIVIANA)* | ago | **379** | 379 | **0** | ✅ |

**Ninguna pantalla se acerca a los números inflados.** Para que se vea la distancia: si alguna contara las
copias, agosto daría **2.954.757,96** (los seis transportistas) o **3.211.252,08** (todas las filas). Ninguna
lo hace. El más alto que se midió fue 232.003,67 — y ése es el corte de vendedores **con un día de más**.

## 2.2 · Desglose por vendedor — el contraste más fino que se pudo hacer

**Indicadores › Vendedores · Facturado · US$ · 01/08–31/08.** Cinco filas, ningún transportista:

| Vendedor | **Pantalla (cant / monto)** | **Base** | Δ |
|---|---|---|---|
| VIVIANA ESCALANTE | **379 · 90.638,43** | 379 · 90.638,43 | 0 |
| ALEJANDRA RODRIGUEZ | **141 · 37.284,37** | 141 · 37.284,37 | 0 |
| MIGUEL PARRA | **219 · 36.699,51** | 219 · 36.699,51 | 0 |
| LEANDRO REBOLLEDO | **251 · 35.549,11** | 251 · 35.549,11 | 0 |
| YENNI ALVAREZ | **181 · 24.239,66** | 181 · 24.239,66 | 0 |
| **Σ** | **1.171 · 224.411,08** | 1.171 · 224.411,08 | **0,00** |

Y lo mismo en septiembre (137/27.632,38 · 127/18.152,99 · 89/14.979,88 · 73/10.824,71 · 42/8.570,27 ⇒
468 · 80.160,23). **Cuadra registro a registro, no solo en el total.**

**Indicadores › Pedidos · año 2026** da las mismas 5 filas (2.581/620.124,82 · 2.093/306.845,1 ·
1.345/294.045,08 · 935/290.655,32 · 1.307/222.134,57) ⇒ **8.261 · 1.733.804,89**, idéntico al oráculo del
año. Si sumara todas las filas daría **8.331.946,28** (5,6× más). **No lo hace.**

## 2.3 · Los combos de vendedor: **ya no ofrecen transportistas en ninguna pantalla**

Éste era el síntoma visible del 11/09 (H3). Se revisaron **los seis combos** que existen:

| Pantalla | Combo | Contenido hoy | 11/09 | |
|---|---|---|---|---|
| **Cumplimiento de Cuota** | `codRdv` | **Todos + 7** | **13: 6 vendedores + 6 transportistas + C001 CATALOGO** | ✅ **corregido** |
| Facturaciones | `idSalesmaView` | 7 | 6, sin transportistas | ✅ |
| Indicadores › Cobranzas | `idSalesmaView` | 7 | 6 | ✅ |
| Indicadores › % Participación | `vendedor` | Todos + 7 | 6 | ✅ |
| Indicadores › Ventas Diarias | `idSalesmaView` | Todos + 7 | 6 | ✅ |
| Indicadores › Vendedores | `vendedor` | Todos + 7 | 6 | ✅ |

Los 7 son: `R015` ALEJANDRA · `R003` EVA MEDINA · `R016` LEANDRO · **`P001` MARIA JOSE PEREZ** · `R007` MIGUEL ·
`R013` VIVIANA · `R009` YENNI. **Ningún `T00x`. Y `C001 CATALOGO INSUMAR` desapareció.**

### 🔑 Cómo se hizo el arreglo — y cómo **no** se hizo

**No se apagó `role.selector`.** En la base sigue valiendo `true` para `ROLE_TRANSPORT` (Q6), que era la
causa candidata que se anotó el 11/09. Y el criterio nuevo **tampoco es** `selector`:

- **`P001` MARIA JOSE PEREZ** tiene `selector = false` (rol 9, *Promotor*) y **sí aparece** en los combos.
- **`C001` CATALOGO** tiene `selector = false` (rol 16) y **ya no aparece**.

⇒ El filtro nuevo parece ser una **lista explícita de roles**, no el flag. Es una observación para
desarrollo: **si mañana INSUMAR crea otro rol, no hay forma de predecir desde la base si va a salir o no.**
No leí el bean (`../src/` fuera de alcance), así que esto es **inferencia sobre medición**.

---

# 3 · 🔴 N1 · HALLAZGO NUEVO: Cumplimiento de Cuota se pasa **un día** en la Fecha Final

**Alto. No es de transportistas. No existía como hallazgo.** Es lo único que separa a esa pantalla de
cuadrar al céntimo, y **se puede confundir con el defecto viejo** si alguien vuelve a medirlo a ojo.

| Se le pide | **Devuelve** | Debería devolver | Lo que en realidad consultó |
|---|---|---|---|
| `01/08 – 31/08` | **232.003,67 · 1.220** | 224.411,08 · 1.171 | `>= 01/08` y `< 02/09` ⇒ **agosto + el 1 de septiembre** |
| `01/08 – 30/08` | **224.411,08 · 1.171** | 212.706,05 · 1.118 | `>= 01/08` y `< 01/09` ⇒ **agosto entero** |

**La prueba es aritmética exacta**, no aproximada (Q3):

```
vendedores 01/08–31/08 ...... 1.171 | 224.411,08
+ solo el 01/09 .............     49 |   7.592,59
= lo que pinta la pantalla .. 1.220 | 232.003,67   ✔ al céntimo
```

**El control lo cierra:** pidiéndole `01/08–30/08` devuelve **exactamente** el total de agosto completo.

**Por qué importa y por qué no se vio antes:**

- **Sólo se nota si el día siguiente al «hasta» tiene facturas.** En septiembre no se nota (la última
  factura de la base es del **11/09**, así que pedir `01/09–14/09` no arrastra nada) — y **ésa fue la
  ventana que se midió el 14/09**. Por eso pasó.
- **Plan vs Cuota NO lo tiene** (control 01–30/08 ⇒ 212.706,05, correcto).
- **Facturaciones NO lo tiene** (control 01–30/08 ⇒ 1.118, correcto).
- ⇒ **Es específico de Cumplimiento de Cuota.** Cualquier cierre de mes hecho con esa pantalla mete el
  primer día del mes siguiente.

**Reproducción a mano (3 pasos):** Reportes → Cumplimiento de Cuota → Empresa · Facturado · US$ · Todos ·
`01/08/2026`–`30/08/2026` → Buscar. Sale **224.411,08**, que es el total de agosto **hasta el 31**.

---

# 4 · Lo nuevo frente a lo ya conocido

## 4.1 · NUEVO en esta vuelta

| ID | Hallazgo | Sev |
|---|---|---|
| **N1** | **Cumplimiento de Cuota incluye un día de más en Fecha Final** (§3). Medido con control. | 🔴 Alto |
| **N2** | **El combo `Roles` de Plan vs Cuota DESAPARECIÓ.** El 14/09 estaba (`form:j_idt115:idRol`, valores 7/15). Hoy **no existe el elemento, ni el widget, ni viaja en el POST** — verificado en los cuerpos de las 31 peticiones. Como Plan vs Cuota ya cumplía sin él, **no rompe nada**; pero **se montó un filtro y luego se quitó**, y conviene saber si fue a propósito. | 🟡 Informativo |
| **N3** | **El arreglo no es `role.selector`** (§2.3): el flag sigue en `true` para transportistas; `P001` (selector=false) sale y `C001` (selector=false) no. Criterio no predecible desde la base. | 🟡 Observación |
| **N4** | **Indicadores › % Participación muestra importes inflados.** «Top 10 Total Facturado por Línea» da **65.572.743,59 / 38.848.021,98 / …** en un mes cuya facturación real de vendedores es **224.411,08**. Sin transportistas en la serie (0 ocurrencias de `T00x`), o sea **misma familia que K2: la columna, no el rol**. Nunca se había medido. | 🔴 Alto |
| **N5** | **Rotación de Inventario no puede dar nada: `client_stock` está vacía (0 filas).** No es defecto de pantalla. | ⚪ Dato |
| **N6** | **Ventas Diarias no tiene botón Buscar.** No hay ningún control accionable en el formulario (sólo los 6 botones del tema). Consulta sola al cambiar filtros; su `form:productView` sí pinta datos (top de productos por unidades). **No se pudo dirigir una medición con ventana propia.** | 🟡 Método |
| **N7** | **`document_sale` no tiene `id_user` en ninguna fila** ⇒ «Pendientes por cobrar» **no se puede cortar por vendedor**. Tampoco lo necesita: **no tiene replicación por transportista** (2.890 filas = 2.890 documentos distintos). | 🟡 Observación |

## 4.2 · Lo ya conocido — cómo quedó

| ID previo | Qué era | Estado hoy |
|---|---|---|
| **K1** (14/09) · *El filtro está en el reporte que ya cumplía, y falta en el que no* | Cumplimiento de Cuota sumaba transportistas: 1.234.013,93 / 7.368 | ✅ **CORREGIDO.** Hoy da el corte de vendedores exacto |
| **H3** (11/09) · *Cumplimiento de Cuota ofrece transportistas en el combo* | 13 usuarios, con los 6 `T00x` y `C001` | ✅ **CORREGIDO.** Todos + 7, ninguno transportista |
| **H5** (11/09) · *Indicadores › Vendedores con Facturado sale vacío* | «No existe registro» | ✅ **CORREGIDO.** Cuadra vendedor por vendedor (§2.2) |
| **H1** (11/09) · *Plan vs Cuota lanza «Error en busqueda de reporte.»* | 14 de 14 búsquedas | ✅ **SIGUE CORREGIDO. 0 de 31** búsquedas con error en esta corrida |
| **K2** (14/09) · *La vista por Línea muestra importes de otra tabla* | Empresa 80.160,23 vs Línea 905.028.443,33 (×11.290) | 🔴 **SIGUE, y es más ancho de lo que se creía** → §5 |
| **K4 / H4** · *EVA MEDINA duplicada; sus 233 facturas no se ven* | `id_user=13` (`co_operation='D'`) vs `id_user=22` (`'I'`) | 🔴 **SIGUE SIN CORREGIR.** Verificado en base (Q7) y en pantalla: Activación de Clientes la lista con 147 clientes y **0 activados** |
| **K3** · *La rama «Transportista» del filtro devuelve 0* | — | ⚪ **Sin objeto:** el combo `Roles` ya no existe (N2) |
| **K5** · *El combo `Roles` conserva la selección entre recargas* | Trampa de medición | ⚪ **Sin objeto** (N2). **Ya no hace falta «limpiar el filtro entre mediciones»**: no hay filtro que limpiar |
| **K7** · *`Sub-Linea` fuera de Visualización, entró `Proveedor`* | — | ✅ **Confirmado, sigue así.** Los casos que nombren «Sub-Linea» siguen inválidos |
| *Plan = 0 de septiembre en adelante* | `sales_plan_enterprise` meses 9–12 en cero | ✅ **Confirmado, no es defecto.** Sigue igual (Q5) |
| *7 de 9 tablas de presupuesto vacías* | Se pidió recontar | ✅ **Recontado: siguen exactamente igual** (Q5). `quota_plan_enterprise` 72 · `sales_plan_enterprise` 12 · **las otras siete en 0.** **No se abrió ninguna medición nueva por Línea/Sub-Línea** |
| **K6** · *Unidad BULTO no convierte* | — | ⚪ **No re-medido** (fuera del criterio de esta vuelta) |

---

# 5 · 🔴 K2 sigue vivo, y toca tres pantallas — pero **no es el defecto de la tarjeta**

Conviene separarlo con claridad, porque **es lo que más ruido mete si alguien mira las pantallas sin
contexto y cree que la tarjeta no se arregló.**

| Pantalla | Vista | **Pantalla** | Equivalente correcto (Empresa) | Factor |
|---|---|---|---|---|
| **Plan VS Cuota** | Línea · sep | **905.028.443,33** | 80.160,23 | **×11.290** |
| **Plan VS Cuota** | Línea · ago | **2.469.301.992,11** | 224.411,08 | **×11.004** |
| **Cumplimiento de Cuota** | Línea · sep | **905.028.443,33** | 80.160,23 | **×11.290** |
| **Indicadores › % Participación** | Top 10 Línea · ago | **65.572.743,59** (la mayor) | — | ~×1.000 |

**Las tres cifras de Línea salen, al céntimo, de `sum(invoice_detail.nu_amount_total)`** (Q4).

🔑 **Y aquí está lo importante para la tarjeta:** esa suma de `invoice_detail` está calculada en la consulta
**con el JOIN restringido al rol 7** — es decir, **la pantalla YA está filtrando bien las filas: sólo
vendedores, cada factura una vez.** Lo que está mal es **la columna de importe**, que trae el total de la
factura **en bolívares y repetido en cada línea**. El cociente contra `nu_amount_total_conversion`
(905.028.443,33 vs 1.142.201,63) da ~792, que es la tasa del período.

⇒ **K2 no viola el criterio del cliente.** Es un defecto **distinto, vivo y grave**, que merece su propia
tarjeta. **Sigue sin leerse el bean**, así que la causa exacta sigue siendo inferencia.

---

# 6 · Lo que NO se pudo comprobar

- **Los importes de Indicadores › Ventas Diarias.** La pantalla **no tiene botón Buscar** (N6): no se pudo
  disparar una consulta con una ventana elegida. **Su combo de vendedor sí se verificó** (Todos + los 7,
  ningún transportista) y su `form:productView` pinta datos, pero **la cifra no se contrastó**. Queda
  **«no comprobado»** en lo numérico. **Pido comprobación a mano.**
- **Los importes exactos de Indicadores › Clientes y › % Participación.** Son **gráficos**, no grillas: los
  valores se sacaron de las series de la respuesta AJAX, no de texto en pantalla. En Clientes la escala
  **cuadra** (top-10 canales suman 222.072,84 contra 224.411,08 del mes ⇒ sin inflar). En % Participación
  **no cuadra** (N4). **Ninguna de las dos se pudo cotejar fila a fila.**
- **La composición exacta de los importes de % Participación.** Se estableció que están inflados ~3 órdenes
  de magnitud; **no se logró reproducir la cifra exacta** desde `invoice_detail` (el join por Línea nivel 1
  no coincidió). **Es defecto por magnitud, no por fórmula identificada.**
- **El oráculo de «Pendientes por cobrar».** La pantalla da **168** en agosto y `document_sale` tiene 2.890
  filas; **no se estableció la regla** (saldo vivo, cruce con cobros…). **No es inflación** —muestra menos,
  no más— y esa tabla **no tiene replicación**, así que **queda fuera del criterio**. Sin verificar.
- **Por qué el arreglo incluye a `P001` (Promotor) y excluye a `C001` (Catálogo).** Medido el hecho,
  **no leído el criterio**: `../src/` está fuera de alcance por norma de la corrida.
- **El SQL real de los beans.** Todo lo de causa (N1, K2, el criterio de roles) es **inferencia sobre
  medición**.
- **Si N1 (el día de más) es regresión o venía de antes.** El 14/09 la ventana medida no lo destapaba.
  **No se puede decir si es nuevo.**
- **Las 4 pantallas de Reportes con las demás combinaciones** (Canales, País, Estado, Proveedor, Productos)
  y **las unidades distintas de US$**. Se midió la dimensión que el criterio exige (Empresa y Vendedor) más
  Línea por ser el punto caliente conocido.
- **Qué ve un usuario que no sea `admin`.** Sólo se probó con `admin`.
- **Exportar Reporte / Ver Gráfico / botón Columnas.** No se ejecutaron (descargan archivo; corrida de
  solo lectura).
- **Las otras 6 pantallas de Transacciones** (Pedidos, Cobros, Devoluciones, Depósitos, Clientes
  Potenciales, Inventarios). El requerimiento nombra **Facturaciones** y ahí se concentró la medición.

---

# 7 · Consultas usadas y su resultado

Completas y comentadas en **`sql/consultas.sql`**. Las que sostienen el veredicto:

| Q | Para qué | Resultado |
|---|---|---|
| **Q1** | Oráculo oficial `invoice × salesman_view` por rol, agosto | rol 7 **1.171 / 224.411,08** · rol 15 **17.196 / 2.954.757,96** · admin 4 / 1.090,81 |
| **Q2** | Desglose por vendedor, agosto | VIVIANA 379/90.638,43 · ALEJANDRA 141/37.284,37 · MIGUEL 219/36.699,51 · LEANDRO 251/35.549,11 · YENNI 181/24.239,66 |
| **Q3** 🔑 | Aísla el off-by-one de Cumplimiento | `01/08–31/08` **1.171/224.411,08** · `+1 día` **1.220/232.003,67** · `01/08–30/08` **1.118/212.706,05** · solo 01/09 **49/7.592,59** |
| **Q4** | Origen del importe inflado por Línea | `sum(invoice_detail.nu_amount_total)` = **905.028.443,33** (sep) y **2.469.301.992,11** (ago); `_conversion` = 1.142.201,63 / 3.249.076,61 |
| **Q5** | Recuento de las 9 tablas de presupuesto | **7 siguen vacías**; `quota_plan_enterprise` 72 · `sales_plan_enterprise` 12 |
| **Q6** | Roles y flag `selector` | `ROLE_TRANSPORT` **sigue con `selector = true`**; `P001` rol 9 selector=false; `C001` rol 16 selector=false |
| **Q7** | EVA MEDINA duplicada | `id_user=13` (`'D'`) **233 / 30.992,23**; `id_user=22` (`'I'`) sin facturas |
| **Q8** | `document_sale` | 2.890 filas · **0 con sufijo `T00x`** · 2.890 documentos distintos · `id_user` NULL en todas |
| **Q9** | Año 2026 | rol 7 vivos **8.261 / 1.733.804,89** · todas las filas 46.441 / 8.331.946,28 |
| **Q10** | Septiembre por vendedor | 137/27.632,38 · 127/18.152,99 · 89/14.979,88 · 73/10.824,71 · 42/8.570,27 |

---

# 8 · Método, y dos trampas que costaron mediciones

**31 búsquedas**, cada una capturando **el POST enviado y la respuesta AJAX completa**
(`evidencia/resp-<tag>.txt`), las filas parseadas (`evidencia/res-<tag>.json`) y captura de pantalla
(`evidencia/<tag>.png`). **0 con «Error en busqueda de reporte.»**

### ⚠ Trampa 1 · En los Indicadores, `dateF` es el INICIO y `dateB` el FIN

**Al revés que en Facturaciones**, donde `dateB`=inicio y `dateF`=fin. Con el orden equivocado la pantalla
devuelve **«No existe registro»** sin ningún error — exactamente igual que un defecto.
**Por eso la primera medición de Indicadores › Vendedores pareció confirmar H5 y era mentira.** Se detectó
porque el control con `Pedido` **también** salió vacío, cuando el 11/09 daba filas. Se comprueba mirando los
valores por defecto que trae cada pantalla al abrirla.

### ⚠ Trampa 2 · Git Bash destroza las rutas que empiezan por `/`

Pasar `/pages/pedidosVendedores` como argumento lo convierte en
`C:/Program Files/Git/pages/pedidosVendedores`, y la pantalla responde **404 de Tomcat**. Si el script no
comprueba que llegó, eso se reporta como «el indicador no devuelve nada». **Se arregló con
`MSYS_NO_PATHCONV=1`** y con una **guarda de llegada** que reintenta hasta 4 veces y aborta con
`LLEGADA_FALLIDA` en vez de devolver un 0 silencioso.

### ⚠ Trampa 3 · Buscar «T001 / ARMANDO / VACANTE» en el texto da falsos positivos

En Cobranzas saltó la alarma de «menciona transportista». **Era falso:** los nombres aparecían en el combo
de **clientes** (1.973 entradas) — los transportistas están **también dados de alta como clientes**
(`LEANDRO MUNOZ`, `YONI MILANO`, `SAUL PENOTT` son clientes). **Hay que mirar el combo de vendedor, no el
texto de la página.**

### Otros patrones útiles

- **`selectOneMenu` sin clic:** el clic sobre el ítem del panel falla con *element is not visible* cuando el
  valor ya estaba puesto o el panel cae fuera de pantalla. Lo robusto es `_pick2.js`: fijar el `<select>`
  oculto `..._input` (que es lo que viaja en el POST) y llamar a `widget.selectValue()`.
- **El `checkboxValor` puede ir vacío:** en Cumplimiento de Cuota el POST salió **sin** `checkboxValor` y el
  reporte igualmente devolvió la fila de empresa. No asumir que hay que marcarlo.
- Sigue valiendo todo lo del 11/09: `renderPanel()` antes de `checkAll()`, contar `input:checked` y no leer
  la etiqueta, asignar `.value` a los `_input` de fecha, orden **combos → fechas → Buscar**, y **leer la
  respuesta AJAX, nunca la tabla vacía**.

### Selectores nuevos / cambiados

| Pantalla | Dato |
|---|---|
| **Plan VS Cuota** | **`form:j_idt115:idRol` YA NO EXISTE** (estaba el 14/09) |
| **Cumplimiento de Cuota** | `form:j_idt116:codRdv` → Todos + 7 vendedores. Grid `form:tablaCumplimientoCuota` |
| **Activación de Clientes** | `form:j_idt115`, grid `form:tablaComparativoPlanCuota`. `clasificacion` incluye **`RDV` = «Vendedores»** |
| **Rotación de Inventario** | `form:j_idt115`, grid **`form:TablaRotacion`**. `unidad` **sin US$ ni BS** (sólo BULTO/DISPLAY/KG/UNIDADES) |
| **Indicadores › Vendedores** | grid **cambia de id según el modo**: `form:j_idt143` con Pedido, **`form:j_idt151` con Facturado**. No fijar el id a ciegas |
| **Ventas Diarias** | `form:j_idt116`, **sin botón Buscar**; los datos salen en `form:productView` |
| **Indicadores** | Todos usan `form:j_idt115` salvo los de `/protected/indicadores/*.xhtml`, que usan `form:j_idt116` |

---

# 9 · Qué llevar a la reunión

1. **La tarjeta se cierra.** El criterio del cliente —«sólo vendedores, cada factura una vez»— **se cumple
   en los tres módulos**, y se cumple **en Cumplimiento de Cuota**, que era el que lo incumplía.
2. **Abrir tarjeta nueva por N1** (Cumplimiento de Cuota incluye un día de más). Es el hallazgo más
   accionable de esta vuelta y **falsea cualquier cierre de mes**.
3. **Abrir/retomar tarjeta por K2 + N4** (importes de `invoice_detail` en BS rotulados US$). Afecta a
   **Plan vs Cuota por Línea, Cumplimiento de Cuota por Línea y % Participación**. **No** es el defecto de
   esta tarjeta, pero deja tres vistas inservibles.
4. **K4 (EVA MEDINA duplicada) sigue abierto** desde el 11/09: 233 facturas de agosto por 30.992,23 que no
   se ven en ninguna pantalla.
5. **Preguntar a desarrollo por N2**: se añadió el combo `Roles` a Plan vs Cuota el 14/09 y **hoy ya no
   está**. Como esa pantalla ya cumplía, no rompe nada — pero conviene confirmar que fue intencional.
6. **Para implementación, no son fallos:** el Plan en 0 de septiembre en adelante, las 7 tablas de
   presupuesto vacías (Línea/Sub-Línea siguen sin plan) y `client_stock` vacía (Rotación de Inventario no
   puede calcular nada).
