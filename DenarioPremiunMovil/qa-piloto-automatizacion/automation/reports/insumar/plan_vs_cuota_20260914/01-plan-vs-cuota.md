# Plan vs Cuota · retest del fix · INSUMAR

| | |
|---|---|
| **Fecha** | 2026-09-14 |
| **Cliente / base** | INSUMAR · empresa única `INSUM_A` — INSUMAR DISTRIBUIDORA 715, C.A. · base `insumar` |
| **Capa** | **Solo web + base, solo lectura.** No se tocó el móvil ni el CDP. |
| **Web** | `http://denarioelyaque.ddns.net:8080/DenarioPremium` (playa **EL YAQUE**, respondió a la primera) |
| **Usuario** | `admin`, bloque **2** (`# USUARIO WEB ISLA COCHE (HIDROPONIAS) / EL YAQUE`) de `secrets/qa-credentials.env`. Entró a la primera con la clave nueva del 14/09 12:40. |
| **Método** | Playwright local, Chrome `--remote-debugging-port=9411`, `connectOverCDP`. Scripts en este RUN_DIR. |
| **Escrituras** | **Ninguna.** Ni en la web ni en la base. |
| **Base de comparación** | `automation/reports/insumar/web_reportes_20260911/01-reportes-web.md`, bloques A y B |
| **Ventanas** | `01/08–31/08/2026` y `01/09–14/09/2026` |

> ⚠ **La base se mueve.** Entre el 11/09 y hoy `invoice` pasó de 14.850 a **18.604** filas en agosto.
> Los oráculos se recalcularon hoy; **no se reutilizó ninguna cifra del 11/09**.

---

## El criterio con el que se juzga

Enunciado original del cliente, aportado por QA:

> «En los reportes/indicadores que se filtran por facturación se está visualizando tanto a vendedores
> como transportistas […]. Lo ideal sería que **solo muestre a los vendedores** y no a los
> transportistas mediante algún filtro. Lo mismo en **Transacciones - Facturaciones** […] lo ideal es
> que se muestre **solo una vez, correspondiente a los vendedores**.»

⇒ **Resultado esperado: el corte de vendedores, cada factura una sola vez.**

⚠ **La replicación de cada factura por transportista es conocida y deliberada por parte de INSUMAR.**
En este informe se trata como **contexto del dato**, no como defecto de carga.

---

## Veredicto

# 🟡 Corregida a medias

**Los tres defectos visibles en pantalla están corregidos:** el error de servidor desapareció,
Facturado devuelve registros, y la columna Línea sale con el nombre completo y en orden alfabético.

**Pero el filtro nuevo se montó en un reporte que ya cumplía el criterio, mientras el reporte que lo
incumple sigue sin filtro y sigue inflado.**

| Lo que pedía la tarjeta | Estado |
|---|---|
| Que Plan vs Cuota deje de reventar | ✅ **Corregido** — 0 errores en 15 búsquedas (eran 14/14) |
| Que «Facturado» muestre registros | ✅ **Corregido** |
| Nombre de Línea completo y ordenado | ✅ **Corregido** |
| **Que se muestre solo el corte de vendedores, cada factura una vez** | ⚠️ **Ya se cumplía** en Plan vs Cuota y en Facturaciones **antes** del filtro |
| **Que ese criterio se cumpla en TODOS los reportes de facturación** | ❌ **No** — **Cumplimiento de Cuota** lo incumple y **no recibió el filtro** |
| Que las cifras sean congruentes | ❌ **No** — la vista por Línea difiere de la vista por Empresa en **11.290×** |

---

## 1 · ¿Existe el filtro nuevo? — **Sí**

**Medido en pantalla.**

| | |
|---|---|
| **Dónde** | Reportes → **Plan VS Cuota**, primera fila de filtros, **a la derecha del combo Empresa** y a la izquierda de Visualización |
| **Cómo se llama** | **`Roles`** (es a la vez la etiqueta y el texto del placeholder) |
| **Selector** | `[id="form:j_idt115:idRol_input"]` · widget `widget_form_j_idt115_idRol` |
| **Opciones** | `(vacío) → Roles` · `7 → Vendedor` · `15 → Transportista` |
| **Por defecto** | El **placeholder vacío** (`idRol_input=`), es decir «sin filtrar» |

Es un `selectOneMenu` normal: se opera por clic, no necesita el truco del `selectCheckboxMenu`. Los
valores `7` y `15` son exactamente los `co_role` de `ROLE_SALESMAN` y `ROLE_TRANSPORT`, o sea que el
filtro ataca justo el `role.selector = true` duplicado del antecedente.

**Solo está en Plan vs Cuota.** Cumplimiento de Cuota no lo tiene (ver §6).

### ⚠ Trampa de medición: el combo se queda pegado

**El combo conserva la selección anterior aunque se recargue la página.** En la primera pasada medí
lo que creía que era «sin filtro» y el POST salió con `idRol_input=15`, heredado de la búsqueda
anterior: dio 0 y parecía un defecto que no era.

⇒ **«No tocar el filtro» NO es «sin filtro».** Para medir el estado sin filtrar hay que elegir el
placeholder `Roles` explícitamente. Es muy probable que sea **esto** lo que hizo que las mediciones
manuales de agosto y septiembre parecieran contradictorias.

### Otro cambio, no pedido en la tarjeta

El combo **Visualización** cambió desde el 11/09:

| 11/09 | Hoy |
|---|---|
| Empresa · Canales de distribución · Pais · Estado · Linea · **Sub-Linea** | Empresa · Canales de distribución · Pais · Estado · Linea · **Proveedor** |

`Sub-Linea` ya no existe; en su lugar está `Proveedor` (`Líneas de producto-2-Proveedor`, 119
valores). **No lo reporto como defecto** —no sé si es intencional—, pero **invalida cualquier caso de
prueba que nombre «Sub-Linea»** y deja sin objeto el hallazgo H7 del 11/09.

---

## 2 · 🔑 ¿El servidor sigue lanzando el error? — **No. Desapareció.**

**Medido sobre la respuesta AJAX real del botón Buscar**, con el mismo método del 11/09.

| | 11/09 | **Hoy** |
|---|---|---|
| Búsquedas medidas | 14 | **15** |
| Con `Error en busqueda de reporte.` | **14 de 14** | **0 de 15** |
| Con filas devueltas | 0 de 14 | **15 de 15** |

En las 15 combinaciones la respuesta llega **sin bloque de mensajes de error** y el grid se pinta.
Evidencia cruda (POST + respuesta completa) en `evidencia/resp-*.txt`, una por combinación.

**Este defecto está corregido.** Y era el que tapaba todo lo demás: es lo que permite, por fin, medir
la columna Línea.

---

## 3 · ¿«Facturado» devuelve registros ahora? — **Sí**

`Empresa` · US$ · filtro en **Vendedor**:

| Ventana | Cumplimiento | Filas | Plan (US$) | Valor (US$) |
|---|---|---|---|---|
| **agosto** | **Pedido** | 1 | 580.600 | **35.985,81** |
| **agosto** | **Facturado** | 1 | 580.600 | **224.411,08** |
| **sept (1–14)** | **Pedido** | 1 | 0 | **35.617,36** |
| **sept (1–14)** | **Facturado** | 1 | 0 | **80.160,23** |

**El defecto de la tarjeta («Facturado no muestra registros») ya no reproduce.** No hay asimetría
entre Pedido y Facturado: los dos devuelven filas en las dos ventanas.

### El «Plan = 0» de septiembre **no es un defecto**

Comprobado en la base, no asumido:

```sql
SELECT nu_month, round(initial_value::numeric,2) FROM sales_plan_enterprise ORDER BY nu_month;
```

Meses 1–8: `452.000,00 … 580.600,00`. **Meses 9–12: `0,00`.** Y el mes 8 vale **580.600,00**, que es
**exactamente** el `Plan (US$) 580.600` que pinta la pantalla en agosto. **La pantalla refleja el
dato con fidelidad.**

⇒ **Observación para implementación**, no fallo: de septiembre en adelante INSUMAR no tiene
presupuesto cargado, así que el reporte no tiene contra qué comparar y la columna Diferencia degenera
en «todo lo facturado es diferencia».

---

## 4 · 🔑 ¿Las cifras son congruentes?

### 4.1 · Solo vendedores ⇒ **cuadra al céntimo, en los dos meses**

| Ventana | **Pantalla** | **Oráculo (corte de vendedores)** | **Diferencia** |
|---|---|---|---|
| **agosto** | **224.411,08** | **224.411,08** (1.171 facturas) | **0,00** |
| **sept 1–14** | **80.160,23** | **80.160,23** (468 facturas) | **0,00** |

**Cuadra exacto, y también en número de facturas.** Con el filtro en Vendedor la pantalla muestra
justo el corte de vendedores, **cada factura una sola vez**.

⇒ **Contra el criterio oficial, Plan vs Cuota da el resultado esperado.**

### 4.2 · El comportamiento del filtro es **el mismo en agosto y en septiembre**

Esto es lo que pidió verificarse, porque QA percibió que agosto discriminaba y septiembre no.
**Medido, las tres posiciones del combo, en las dos ventanas:**

| Roles | POST | **Agosto** | **Sept 1–14** |
|---|---|---|---|
| *(placeholder «Roles», elegido a mano)* | `idRol_input=` | **224.411,08** | **80.160,23** |
| **Vendedor** | `idRol_input=7` | **224.411,08** | **80.160,23** |
| **Transportista** | `idRol_input=15` | **0** | **0** |

⇒ **El filtro se comporta idénticamente en los dos meses.** No hay tal diferencia de
comportamiento entre agosto y septiembre:

- En **los dos** meses, «sin filtrar» y «Vendedor» dan **exactamente lo mismo**.
- En **los dos** meses, «Transportista» da **0**.

**Por qué pareció distinto:** casi con seguridad, por la persistencia del combo (§1). Una medición
manual que crea estar «sin filtro» puede estar enviando `15` heredado de la búsqueda anterior y
devolver 0, o al revés. **No es que el filtro discrimine en un mes y no en otro.**

**Y responde la pregunta 2 de la coordinación:** con Transportistas **no da ni 492.459,66 (un
representante) ni 2.954.757,96 (los seis sumados): da 0.**

### 4.3 · Solo transportistas ⇒ **devuelve 0** (y el POST sí lleva el filtro)

| | Agosto | Sept |
|---|---|---|
| **Pantalla** (Roles = Transportista) | **0** | **0** |
| Base, un transportista | 492.459,66 | 192.308,95 |
| Base, los seis sumados | 2.954.757,96 | 1.153.853,70 |

También por Línea: 18 filas, todas en 0.

**¿El filtro se ignora, o se aplica sobre datos que no existen?** Respondido con el POST en la mano:

- **El POST lleva el valor**: `form:j_idt115:idRol_input=15`, capturado del cuerpo real de la
  petición (`evidencia/resp-SEP_Facturado_Transportista.txt`).
- **Y la cifra cambia**: 224.411,08 → **0**.

⇒ **El filtro NO se ignora: el servidor lo recibe y lo honra.** La consulta del reporte simplemente
**nunca ve las facturas de transportista**, así que esa rama no tiene nada que devolver. Pista
medida: con Transportista, `Clientes en Cartera` cae de **1.935 a 0** — el reporte se arma sobre la
cartera de clientes y los transportistas no tienen cartera.
*(Quise confirmarlo contando `client.id_user` y **esa columna no existe** en este esquema: queda
**sin comprobar** el vínculo exacto.)*

**Contra el criterio oficial esto no es un fallo** —nadie pidió poder ver a los transportistas—, pero
sí significa que **de los dos modos del filtro nuevo solo uno hace algo**.

### 4.4 · ¿Vendedores + transportistas = el total sin filtrar?

`224.411,08 + 0 = 224.411,08` **= el total sin filtrar.** Suman.

Pero suman porque **el «sin filtrar» ya era solo vendedores**: el total de Plan vs Cuota **nunca
incluyó a los transportistas**. Por eso el total **no baja** al elegir «Vendedor»: es idéntico.

⇒ **Confirma lo que observó QA** («con o sin el filtro de Vendedores sale lo mismo») y explica por
qué: **en Plan vs Cuota el filtro no tenía nada que arreglar.**

### 4.5 · 🔴 La incongruencia real: **Empresa y Línea no cuadran entre sí**

Mismos filtros exactos (Vendedor · Facturado · US$ · 01/09–14/09):

| Visualización | Facturado (US$) |
|---|---|
| **Empresa** | **80.160,23** |
| **Línea** (suma de las 18 filas) | **905.028.443,33** |
| **Factor** | **11.290×** |

No es un número inventado: sale **exacto** de la otra tabla.

```sql
SELECT round(sum(d.nu_amount_total)::numeric,2), round(sum(d.nu_amount_total_conversion)::numeric,2)
  FROM invoice_detail d JOIN invoice i ON i.id_invoice=d.id_invoice
  JOIN role_user ru ON ru.id_user=i.id_user
 WHERE ru.co_role=7 AND i.da_invoice>='2026-09-01' AND i.da_invoice<'2026-09-15';
-- 905.028.443,33  |  1.142.201,63
```

**`sum(invoice_detail.nu_amount_total)` = 905.028.443,33 = la suma de la columna en pantalla, al
céntimo.**

⇒ **La vista por Empresa lee `invoice.nu_amount_total` y la vista por Línea lee
`invoice_detail.nu_amount_total`, y las dos van rotuladas «US$».**

**Hipótesis (no comprobada):** el detalle está en **bolívares**. La tasa del período va de 798,33 a
832,49 (`invoice.nu_value_local`) y el cociente entre `nu_amount_total` y
`nu_amount_total_conversion` del detalle da ~792. La columna a leer para US$ parece ser
`nu_amount_total_conversion`. **No leí el bean** (`../src/` está fuera de alcance): es inferencia
sobre una medición.

Esto explica también los «montos absurdos» que el 11/09 se anotaron sin verificar en Cumplimiento de
Cuota (534 millones para ALIMENTOS). **Es el mismo problema, y sí es un defecto.**

---

## 5 · ¿Y la columna Línea? — ✅ **Corregida. Y esta vez sí se pudo medir.**

**El supuesto de que no se podría medir resultó falso.** Las 7 tablas de plan siguen vacías, pero
**la vista por Línea devuelve 18 filas** igualmente: `Plan` sale 0 y `Facturado` sale con valor. El 0
del 11/09 era **el error de servidor**, no la falta de plan.

`Linea` · `Facturado` · `US$` · Vendedor · `01/09–14/09/2026` ⇒ **18 filas**:

```
ALIMENTOS · BEBIDAS · CARAMELOS · CEREALES · CHICLES · CHOCOLATES · CHUPETAS · CONDIMENTOS ·
GALLETAS · GOMAS · INFUSIONES · LECHE CONDENSADA · MISCELANEOS · PASAPALOS ·
POSTRES Y GELATINAS · TABACO · TORTAS · TURRONES Y BOCADILLOS
```

| Lo que pedía la incidencia | Medido en pantalla | Estado |
|---|---|---|
| Nombre **sin truncar a 15** | `LECHE CONDENSADA` (16), `POSTRES Y GELATINAS` (19), `TURRONES Y BOCADILLOS` (21) — **completos** | ✅ **PASS** |
| **Orden alfabético** | ascendente, `ALIMENTOS` → `TURRONES Y BOCADILLOS` | ✅ **PASS** |

Los tres nombres que el 11/09 se señalaron como los únicos que podían verse recortados
(`LECHE CONDENSAD`, `POSTRES Y GELAT`, `TURRONES Y BOCA`) **salen enteros**.

⇒ **La hipótesis `short_na_product_structure` queda descartada por medición**: la pantalla ya lee
`na_product_structure`. La lista coincide **exactamente**, en contenido y orden, con la de
Cumplimiento de Cuota que el 11/09 se propuso como referencia. **Se copió la solución, y funcionó.**

⚠ **Lo único que falla en esta vista son los importes** (§4.5): los nombres están bien, las cifras no.

---

## 6 · 🔴 Dónde sigue incumpliéndose el criterio: **Cumplimiento de Cuota**

**Miré los dos reportes**, como pedía el supuesto 1.

| | Plan VS Cuota | **Cumplimiento de Cuota** |
|---|---|---|
| **¿Tiene el filtro `Roles` nuevo?** | ✅ **Sí** | ❌ **No** — no existe el combo |
| Combo de vendedor | no tiene | `codRdv`, **14 usuarios**: 6 vendedores + **los 6 transportistas** + `C001 CATALOGO` + `P001 MARIA JOSE PEREZ` |
| Facturado 01–14/09 | **80.160,23** · 468 facturas | **1.234.013,93** · **7.368 facturas** |
| ¿Cumple «solo vendedores, cada factura una vez»? | ✅ **sí** | ❌ **no** |

**Cumplimiento de Cuota sigue sumando a los transportistas.** Su 1.234.013,93 es, al céntimo,
`1.234.598,91 − 584,98` (todas las filas de `invoice` menos las 2 del admin), y sus 7.368 facturas
son `7.370 − 2`. **Cuenta cada copia de transportista como una factura distinta.** Es exactamente la
inflación que motivó la tarjeta, y es el hallazgo H3 del 11/09 **sin corregir**.

> ### El fix se montó en el reporte que ya cumplía
>
> **Plan vs Cuota y Facturaciones ya daban el corte de vendedores antes del filtro. El reporte que
> incumple el criterio —Cumplimiento de Cuota— es el único que no recibió el filtro.**

### Transacciones → Facturaciones (nombrado explícitamente en el requerimiento) ⇒ ✅ **cumple**

| Ventana | Tipo de documento | Pantalla | Oráculo (vendedores) | Códigos con sufijo `T###` |
|---|---|---|---|---|
| **agosto** | Facturas cobradas | **1.171** | **1.171** | **0** |
| **agosto** | Consolidado | **1.171** | 1.171 | **0** |
| sept 1–14 | Facturas cobradas | **468** | 468 | **0** |

**Muestra cada factura una sola vez y solo las de vendedores.** No está inflado: ni 2,95 M ni 3,2 M.
**Ya cumplía el requerimiento.**

---

## Matriz de combinaciones medidas

**15 búsquedas en Plan VS Cuota · 0 con error de servidor · 15 con filas.**

| # | Ventana | Roles (POST) | Visualización | Cumpl. | Unidad | Filas | Plan | Valor | Error AJAX |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ago | *(vacío)* | Empresa | Pedido | US$ | 1 | 580.600 | 35.985,81 | **no** |
| 2 | ago | *(vacío)* | Empresa | Facturado | US$ | 1 | 580.600 | **224.411,08** | **no** |
| 3 | ago | `7` | Empresa | Facturado | US$ | 1 | 580.600 | **224.411,08** | **no** |
| 4 | ago | `15` | Empresa | Facturado | US$ | 1 | 580.600 | **0** | **no** |
| 5 | ago | `7` | Empresa | Pedido | US$ | 1 | 580.600 | 35.985,81 | **no** |
| 6 | ago | `15` | Empresa | Pedido | US$ | 1 | 580.600 | **0** | **no** |
| 7 | sep | `15` *(heredado — medición inválida, ver §1)* | Empresa | Facturado | US$ | 1 | 0 | 0 | **no** |
| 8 | sep | `7` | Empresa | Facturado | US$ | 1 | 0 | **80.160,23** | **no** |
| 9 | sep | `15` | Empresa | Facturado | US$ | 1 | 0 | **0** | **no** |
| 10 | sep | *(vacío, placeholder elegido a mano)* | Empresa | Facturado | US$ | 1 | 0 | **80.160,23** | **no** |
| 11 | sep | `7` | **Linea** | Facturado | US$ | **18** | 0 | Σ **905.028.443,33** | **no** |
| 12 | sep | `7` | **Proveedor** | Facturado | US$ | **119** | 0 | — | **no** |
| 13 | sep | `7` | Empresa | Pedido | US$ | 1 | 0 | 35.617,36 | **no** |
| 14 | sep | `15` | **Linea** | Facturado | US$ | 18 | 0 | **0** (todas) | **no** |
| 15 | sep | `7` | Empresa | Facturado | **BULTO** | 1 | 0 | 0 *(y «Monto Facturado (BULTO)» = 80.160,23)* | **no** |

*(Las filas 1–2 son las dos únicas mediciones «sin filtro» fiables de agosto: el combo estaba virgen
en esa sesión. A partir de la 4 hay que forzar el placeholder.)*

**Otras pantallas:**

| # | Pantalla | Ventana / filtro | Pantalla | Oráculo | Veredicto |
|---|---|---|---|---|---|
| 16 | **Cumplimiento de Cuota** | sep · Todos · Empresa · Facturado · US$ | **1.234.013,93** · 7.368 | corte vendedores 80.160,23 · 468 | 🔴 **incumple** |
| 17 | **Facturaciones** | ago · Facturas cobradas | **1.171** | 1.171 | ✅ **cumple** |
| 18 | **Facturaciones** | ago · Consolidado | **1.171** | 1.171 | ✅ **cumple** |
| 19 | **Facturaciones** | sep · Facturas cobradas | **468** | 468 | ✅ **cumple** |

Evidencia por combinación: `evidencia/resp-<tag>.txt` (POST + respuesta AJAX cruda),
`evidencia/res-<tag>.json` (filas parseadas), `evidencia/<tag>.png`.

---

## Hallazgos

### K1 · El filtro `Roles` está en el reporte que ya cumplía, y falta en el que no · 🔴 Alto

Plan vs Cuota y Facturaciones **ya daban el corte de vendedores** antes del filtro (224.411,08 /
1.171 en agosto), así que el filtro no cambia nada. **Cumplimiento de Cuota sí suma transportistas**
—1.234.013,93 por 7.368 facturas— **y no tiene el filtro**; su combo `codRdv` sigue ofreciendo los 6
transportistas como si fueran vendedores. **Es H3 del 11/09, sin corregir, y es el único sitio donde
el criterio del cliente se incumple.**
**Evidencia:** `evidencia/res-CUMPL-sep-Todos.json`, `evidencia/CUMPL-dom.png`.

### K2 · La vista por Línea muestra importes de otra tabla y otra escala · 🔴 Alto

Mismos filtros: **Empresa 80.160,23 vs Línea 905.028.443,33 (11.290×)**. El segundo es exactamente
`sum(invoice_detail.nu_amount_total)`. Las dos vistas van rotuladas «US$».
**Causa candidata (inferencia, no lectura de código):** el detalle está en BS y habría que leer
`nu_amount_total_conversion`. Es el mismo problema que el 11/09 se anotó sin verificar en
Cumplimiento de Cuota. **Evidencia:** `evidencia/res-SEP_Linea_Facturado_Vendedor.json`, `sql` Q6.

### K3 · La rama «Transportista» del filtro nuevo siempre devuelve 0 · 🟠 Medio

El POST lleva `idRol_input=15` y el servidor lo honra (la cifra cambia a 0), pero no hay datos que
devolver: `Clientes en Cartera` cae también a 0. **Contra el criterio del cliente no es un fallo**
—no se pidió ver transportistas—, pero **de los dos modos del filtro solo uno hace algo**. Si la
intención era poder separar las dos mitades, no se cumple. **Sin comprobar** el vínculo
reporte↔cartera.

### K4 · `EVA MEDINA` duplicada: 233 facturas de vendedor que no se ven en ningún sitio · 🟠 Medio

`id_user=13` (`co_operation='D'`) tiene sus 233 facturas de agosto por **30.992,23**; `id_user=22`
(`'I'`) es la que aparece en los combos. La diferencia entre el rol 7 completo (255.403,31) y lo que
muestra la pantalla (224.411,08) es **exactamente** esa cantidad. Como el criterio pide mostrar las
facturas de vendedor una vez, **estas 233 faltan**. **Es H4 del 11/09, sin corregir.**

### K5 · El combo `Roles` conserva la selección entre recargas · 🟡 Bajo · **afecta a quien mida a mano**

Tras elegir Transportista, recargar la pantalla deja el combo en `15` y el POST lo envía. Es la
explicación más probable de que agosto y septiembre parecieran comportarse distinto (§4.2).

### K6 · Cambiar la Unidad de Venta no convierte · 🟡 Bajo

Con `BULTO`: `Facturado (BULTO) = 0`, y aparece una columna `Monto Facturado (BULTO) = 80.160,23`,
que es el importe **en US$** rotulado como BULTO.

### K7 · `Sub-Linea` desapareció de Visualización, entró `Proveedor` · 🟡 Bajo · informativo

No sé si es intencional. **Invalida los casos de prueba que nombren «Sub-Linea»** y deja sin objeto
el H7 del 11/09.

---

## Pregunta abierta para implementación (no es defecto del reporte)

**Solo el ~41 % de las facturas tiene fila de vendedor.**

| Ventana | Facturas reales | Con fila de vendedor | % |
|---|---|---|---|
| agosto | 2.866 | **1.171** | **41 %** |
| sept 1–14 | 1.150 | **470** | **41 %** |

El enunciado del cliente dice «se recibe una misma factura **para el vendedor al que le corresponde**
y también para todos los transportistas». **Esa premisa no se cumple en el 59 % de las facturas**:
existen únicamente como copia de transportista. Consecuencia: el corte de vendedores —que es el
resultado correcto según el criterio— **solo alcanza al 41 % de la facturación** (224.411,08 de
492.459,66 reales en agosto).

⇒ **¿Son ventas sin vendedor asignado, o falta el envío de la fila del vendedor?** No es defecto del
reporte, pero condiciona lo que el reporte puede llegar a mostrar.

---

## Lo que NO se pudo comprobar

- **Por qué la rama «Transportista» no tiene datos.** Se midió que `Clientes en Cartera` cae a 0, lo
  que apunta a que el reporte se arma sobre la cartera; **no se confirmó el vínculo**: la columna
  `client.id_user` que se intentó contar **no existe** en este esquema.
- **Si `invoice_detail.nu_amount_total` está en BS.** La razón 11.290× y el cociente ~792 contra
  `nu_amount_total_conversion` lo sugieren, pero **es inferencia sobre medición**, no lectura del
  bean. `../src/` está fuera de alcance por norma de la corrida.
- **El SQL real de los reportes.** Todo lo de causa sigue siendo inferencia.
- **Si `Proveedor` devuelve nombres correctos y ordenados.** Devuelve 119 filas; **no se revisó el
  texto ni el orden** de esa columna, solo el de `Linea`.
- **Por qué las copias de una misma factura no siempre traen el mismo importe** (203,81 de diferencia
  entre dos formas de deduplicar septiembre). Detectado de pasada, no perseguido.
- **Si los defectos vivos son regresión.** La medición del 11/09 estaba tapada por el error de
  servidor, así que no se puede decir si K2 es nuevo.
- **Los demás indicadores que «se filtran por facturación».** El criterio del cliente habla de
  «los reportes/indicadores» en plural; aquí se comprobaron **tres** pantallas (Plan vs Cuota,
  Cumplimiento de Cuota, Facturaciones). El 11/09 se barrieron otras seis y estaban limpias, pero
  **no se re-verificaron hoy**.
- **Qué ve un usuario que no sea `admin`.** Solo se probó con `admin`.
- **Exportar Reporte / botón Columnas.** No se ejecutaron.

---

## Patrones y selectores nuevos

Todo medido hoy, playa EL YAQUE, INSUMAR.

### El filtro nuevo de Plan VS Cuota

| Elemento | Selector | Nota |
|---|---|---|
| **Roles** | `[id="form:j_idt115:idRol_input"]` · widget `widget_form_j_idt115_idRol` | `selectOneMenu`, va por clic. Valores `''` / `7` / `15`. **Conserva el valor entre recargas.** |

`Visualización` ahora vale: `Empresa`, `Canales de distribución`, `Zonas de venta-1-Pais`,
`Zonas de venta-2-Estado`, `Líneas de producto-1-Linea`, **`Líneas de producto-2-Proveedor`**
(ya **no** `Sub-Linea`).

### Cumplimiento de Cuota · `/pages/reporteCumplimientoCuota`

**El prefijo cambió: ahora es `form:j_idt116`, no `j_idt115`.** Grid
`[id="form:tablaCumplimientoCuota"]`, combo de vendedor `[id="form:j_idt116:codRdv_input"]`, y el
`checkboxValor` es `widget_form_j_idt116_checkboxValor`. Su `Visualización` incluye `Productos`, que
Plan vs Cuota no tiene. **No tiene combo `idRol`.**

### Facturaciones · `/pages/facturaciones`

Prefijo `form:j_idt116`. `idSalesmaView_input` lista **7 vendedores, ningún transportista** (aparece
`24 ||| MARIA JOSE PEREZ`, nueva desde el 11/09). Fechas `dateB_input`/`dateF_input`, ya vienen con
el rango del mes en curso.

### Sigue valiendo todo lo del 11/09

El `selectCheckboxMenu` necesita `renderPanel()` antes de `checkAll()`; contar `input:checked`, no
leer la etiqueta; asignar `.value` a los `_input` de fecha funciona; orden **combos → fechas →
Buscar**; y **leer siempre la respuesta AJAX**, no la tabla vacía.

### 🔑 Método nuevo: capturar POST **y** respuesta en la misma pasada

Es lo que permitió distinguir «el filtro se ignora» de «el filtro se aplica y no hay datos»:

```js
let resp = null, postBody = null;
const h = async r => {
  if (r.request().method() === 'POST' && r.url().includes('reportePlanCuota')) {
    try { resp = await r.text(); postBody = r.request().postData(); } catch(e) {}
  }
};
pg.on('response', h);
await pg.$eval('[id="form:j_idt115:ajax"]', e => e.click());
await pg.waitForTimeout(9000);
pg.off('response', h);
```

Con `postBody` se comprueba **qué se envió** (`idRol_input=15`) y con `resp` **qué contestó**. Sin el
POST, un 0 no se puede atribuir.

### Oráculo: nunca contar filas de `invoice` como facturas

```sql
count(DISTINCT regexp_replace(co_invoice,'T[0-9]+$',''))   -- facturas reales
count(*)                                                    -- filas: hasta 7x más
```

La replicación por transportista **es deliberada en INSUMAR**: el corte correcto es el de vendedores.
El rol vive en `role_user`, no en `users`. Y **`co_operation='D'` marca usuarios borrados cuyas
facturas la web no suma** (EVA MEDINA) — hay que decidir a conciencia si entran en el oráculo: el
corte de vendedores «a la manera de la web» son los **5 vivos**, no los 6 del rol 7.
