# INSUMAR · ¿Los PROMOTORES se cuelan como vendedores en los reportes?

| | |
|---|---|
| **Fecha** | 2026-09-15 |
| **Cliente / base** | INSUMAR · empresa única `INSUM_A` — INSUMAR DISTRIBUIDORA 715, C.A. · base `insumar` |
| **Capa** | **Solo web + base, solo lectura.** No se tocó el móvil, ni CDP de dispositivo, ni se escribió nada |
| **Web** | `http://denarioelyaque.ddns.net:8080/DenarioPremium` · usuario `admin` (bloque 2, *ISLA COCHE / EL YAQUE*) |
| **Cobertura** | **12 pantallas: 4 de Reportes + 7 de Indicadores + Facturaciones.** Las 12 abiertas y medidas |
| **Escrituras** | **Ninguna**, ni en la web ni en la base |
| **Antecedente** | `tres_modulos_20260915/00-CONSOLIDADO.md` (§2.3, combos del 11/09 y del 15/09 por la mañana) |

---

# LA RESPUESTA, EN TRES FRASES

1. **No es de una pantalla: el promotor está en las SIETE listas de vendedores que existen en el producto.**
   `P001 MARIA JOSE PEREZ` (rol 9, `selector = false`) aparece en **todos** los desplegables de vendedor de
   los tres módulos, y además **como una fila más** en Activación de Clientes.
2. **El criterio que usa el producto hoy es, exactamente, `co_role IN (7, 9)`** — vendedor **y promotor**.
   No es `role.selector`, y **no coincide** con «vendedor». Es una lista de roles fija.
3. **El corte certificado de 1.171 facturas · 224.411,08 NO queda tocado.** `P001` **no tiene ni una factura
   en toda la base**, así que el defecto **ensucia el listado pero no mueve ninguna cifra**.

---

# 1 · LA TABLA · pantalla × ¿está en el combo? × ¿sale en resultados?

**Leyenda:** ✔ = sí, visto en pantalla · ✘ = no, visto en pantalla · **N/A** = la pantalla no tiene esa
dimensión (no es que saliera vacía: es que no existe).

## Módulo **Reportes**

| # | Pantalla | Control de vendedor | **¿P001 en el combo?** | **¿P001 en resultados?** | ¿`C001` CATALOGO? | Evidencia |
|---|---|---|---|---|---|---|
| 1 | **Activación de Clientes** 🔴 | Lista del medio `checkboxValor`, con *Visualización = Vendedores* | **✔ SÍ** — 7 ítems, uno es MARIA JOSE PEREZ | **✔ SÍ — fila propia, todo a 0** | ✘ no | `act_vend_pedido` · `act_vend_fact` · `act_vend_fact_ago` |
| 2 | **Cumplimiento de Cuota** 🔴 | Combo `codRdv` | **✔ SÍ** — `P001 MARIA JOSE PEREZ` | **N/A** — su *Visualización* no tiene opción «Vendedores»; las filas son Empresa/Canal/Producto/Línea/Proveedor | ✘ no | `combos-cumplimiento` · `cumpl_p001` |
| 3 | **Plan VS Cuota** | **No tiene** | **N/A — no hay combo de vendedor** | **N/A** — tampoco hay *Visualización = Vendedores* | — | `combos-plancuota` · `plan_emp_ago` |
| 4 | **Rotación de Inventario** | **No tiene** | **N/A — no hay combo de vendedor** | **N/A** — *Visualización* solo Productos/Línea/Proveedor | — | `combos-rotacion` · `rot_linea` |

## Módulo **Indicadores**

| # | Pantalla | Control de vendedor | **¿P001 en el combo?** | **¿P001 en resultados?** | Evidencia |
|---|---|---|---|---|---|
| 5 | **Pedidos** | **No tiene** | **N/A — no hay combo** | **✘ NO** — el grid `tablaFacturados` lista vendedores y solo salen los **5 con facturas** | `combos-ind_pedidos` · `ind_ped` |
| 6 | **Vendedores** 🔴 | Combo `vendedor` | **✔ SÍ** — `MARIA JOSE PEREZ` | **✘ NO** — con *Todos* salen 5 filas, ninguna es P001. Eligiéndolo: **«No existe registro»** | `combos-ind_vendedores` · `ind_vend_todos_ago` · `ind_vend_p001` |
| 7 | **Clientes** | **No tiene** | **N/A — no hay combo** | **N/A** — es un gráfico por canal de cliente, sin dimensión de vendedor | `combos-ind_clientes` · `ind_cli` |
| 8 | **% de Participación** 🔴 | Combo `vendedor` | **✔ SÍ** — `MARIA JOSE PEREZ` | **N/A** — el gráfico es por Línea/Proveedor. Eligiéndolo, **las series quedan vacías** (`"data":[]`) | `combos-ind_particip` · `part_todos` · `part_p001` |
| 9 | **Ventas Diarias** 🔴 | Combo `idSalesmaView` | **✔ SÍ** — `P001 - MARIA JOSE PEREZ` | **⚠ NO COMPROBADO** — §6 | `combos-ind_ventasdiarias` · `vd_p001` · `vd_viviana` |
| 10 | **Cobranzas** 🔴 | Combo `idSalesmaView` | **✔ SÍ** — `24 = MARIA JOSE PEREZ` | **N/A** — es un gráfico Facturado/Cobrado sin filas de vendedor. ⚠ además **el filtro de vendedor no se aplica** (§5) | `combos-ind_cobranzas` · `cobr_p001` · `cobr_todos` · `cobr_viviana` |
| 11 | **Morosidad** | **No tiene** | **N/A — no hay combo** | **N/A** — vencimiento / cuentas por cobrar, sin dimensión de vendedor | `combos-ind_morosidad` · `ind_mor` |

## Módulo **Transacciones**

| # | Pantalla | Control de vendedor | **¿P001 en el combo?** | **¿P001 en resultados?** | Evidencia |
|---|---|---|---|---|---|
| 12 | **Facturaciones** 🔴 | Combo `idSalesmaView` | **✔ SÍ** — `24 = MARIA JOSE PEREZ` | **✘ NO** — con vendedor vacío salen las filas de agosto, ninguna suya. Eligiéndolo: **«No se encontraron registros.»** | `combos-facturaciones` · `fact_p001` · `fact_todos` |

### Recuento

| | |
|---|---|
| Pantallas **con** control de vendedor | **7** — y **las 7 ofrecen a P001** |
| Pantallas **sin** control de vendedor | **5** (Plan vs Cuota, Rotación, Ind. Pedidos, Ind. Clientes, Morosidad) |
| Pantallas donde P001 **sale como fila de resultados** | **1 — Activación de Clientes** |
| Pantallas donde `C001 CATALOGO` aparece | **0** |
| Pantallas donde aparece algún transportista `T00x` | **0** |

---

# 2 · 🔑 EL PATRÓN: no es una pantalla ni un componente, es **el criterio de quién es vendedor**

## 2.1 · La prueba de que es un criterio y no un componente: **son TRES implementaciones distintas y las tres fallan**

Los siete controles **no comparten componente**. Se distinguen a simple vista por **el valor que llevan**:

| Familia | Valor que viaja al servidor | Pantallas | ¿P001? |
|---|---|---|---|
| **A · por código de usuario** | `R015`, `R003`, **`P001`** … | Cumplimiento de Cuota (`codRdv`) · Ind. Vendedores (`vendedor`) · % Participación (`vendedor`) · Ventas Diarias (`idSalesmaView`) | **✔ las 4** |
| **B · por id numérico** | `15`, `22`, **`24`** … | Facturaciones (`idSalesmaView`) · Cobranzas (`idSalesmaView`) | **✔ las 2** |
| **C · lista de casillas** | checkbox de `checkboxValor` | Activación de Clientes | **✔** |

**Tres familias, tres ids distintos, y el promotor en las tres.** Si fuera un componente compartido bastaría
tocar uno. **La tarjeta no es de pantalla ni de componente: es de la consulta que define «vendedor», y esa
consulta está repetida en al menos tres sitios.**

## 2.2 · Cuál es el criterio exacto, medido

Censo de `salesman_view` contra `role` (Q4). Los combos ofrecen **exactamente 7 usuarios**:

| `co_role` | Rol | `selector` | Usuarios en la base | **¿Sale en los combos?** |
|---|---|---|---|---|
| 1 | ROLE_ADMIN | false | 5 (`..`, `A001`, `AD02`, `AD03`, `AD04`) | ✘ |
| 3 | ROLE_COLLECTION | false | 1 (`AN01`) | ✘ |
| 6 | ROLE_SUPERVISOR | false | 2 (`FC01`, `S001`) | ✘ |
| **7** | **ROLE_SALESMAN** | **true** | **6** (`R003 R007 R009 R013 R015 R016`) | **✔ los 6** |
| **9** | **ROLE_PROMOTER** | **false** | **1** (`P001`) | **✔ 🔴 el defecto** |
| 15 | ROLE_TRANSPORT | **true** | 6 (`T001`…`T006`) | ✘ |
| 16 | ROLE_CATALOG | false | 1 (`C001`) | ✘ |

⇒ **6 + 1 = los 7 que se ven.** El criterio efectivo es **`co_role IN (7, 9)`**.

**Y eso explica la inconsistencia que traía el encargo:** `P001` y `C001` tienen los dos `selector = false`,
pero uno sale y el otro no **porque el flag no pinta nada**. Lo que decide es una **lista de roles fija** que
incluye al promotor. *(Inferencia sobre medición: no se leyó el bean — `../src/` fuera de alcance.)*

## 2.3 · 🔴 Sí coincide con el fix de transportistas — **y el promotor lo TRAJO ese fix**

Contrastando con la medición del **11/09** (recogida en `tres_modulos_20260915/00-CONSOLIDADO.md` §2.3):

| Pantalla | Combo | **11/09 (antes del fix)** | **Hoy 15/09** | Lectura |
|---|---|---|---|---|
| **Cumplimiento de Cuota** | `codRdv` | **13**: 6 vendedores + 6 transportistas + `C001` | **Todos + 7** *(con P001)* | quitó 7 intrusos, **metió 1 nuevo** |
| Ind. Vendedores | `vendedor` | **6** *(solo vendedores — estaba bien)* | **Todos + 7** *(con P001)* | 🔴 **estaba sano y se ensució** |
| % de Participación | `vendedor` | **6** *(estaba bien)* | **Todos + 7** *(con P001)* | 🔴 **estaba sano y se ensució** |
| Ventas Diarias | `idSalesmaView` | **6** *(estaba bien)* | **Todos + 7** *(con P001)* | 🔴 **estaba sano y se ensució** |
| Facturaciones | `idSalesmaView` | **6** *(estaba bien)* | **7** *(con P001)* | 🔴 **estaba sano y se ensució** |
| Cobranzas | `idSalesmaView` | **6** *(estaba bien)* | **7** *(con P001)* | 🔴 **estaba sano y se ensució** |

> ⚠ **La columna «11/09» es de una medición previa, no de hoy.** Hoy solo se midió la columna «15/09».

**La conclusión que importa para la reunión:** el arreglo del filtro de transportistas **no se limitó a la
pantalla rota**. Se aplicó a las seis, y **las cinco que ya estaban correctas ganaron al promotor**.
Es el patrón clásico de **regresión por arreglo global**: una sola pantalla incumplía, se cambió el criterio
para todas, y el criterio nuevo es más ancho de lo que debía.

**Activación de Clientes queda fuera de este contraste:** su lista de vendedores es de casillas, no un combo,
y **no se midió el 11/09**. **No se puede decir si ahí P001 es nuevo o venía de antes.**

## 2.4 · La otra mitad del patrón: **de dónde sale cada lista**

Es lo que separa a Activación de Clientes de todas las demás, y es lo que decide **dónde se ve de verdad**:

| Origen de las filas | Pantallas | ¿Sale P001? |
|---|---|---|
| **Del maestro de usuarios** (la lista de quién es vendedor) | **Activación de Clientes** | **✔ SÍ — fila con 0 en las 8 columnas** |
| **De las transacciones** (los vendedores que de hecho facturaron) | Ind. Pedidos · Ind. Vendedores · Facturaciones | **✘ NO** — quien no factura, no aparece |

**Ésa es la razón por la que QA lo vio en Activación de Clientes y en ninguna otra.** No es que las demás
estén bien: es que **las demás dibujan sus filas a partir de las facturas, y P001 no tiene ninguna**. El día
que el promotor emita una factura —o que alguien le asigne clientes— **saldrá en todas**.

---

# 3 · LO QUE SE VIO EN PANTALLA, con cifras

## 3.1 · 🔴 Activación de Clientes — el caso reproducido

**Reportes → Activación de Clientes → *Visualización* = `Vendedores` → marcar los 7 valores →
*Pedido* → `01/09/2026`–`15/09/2026` → Buscar.** `Total de Resultados: 7`

| Vendedor | Clientes | Activados | Inactivos | % Activación | Nuevos | Nuevos Act. | % Act Nuevos |
|---|---|---|---|---|---|---|---|
| ALEJANDRA RODRIGUEZ | 105 | 0 | 105 | 0 % | 1 | 0 | 0 % |
| EVA MEDINA | 150 | 77 | 73 | 51,33 % | 1 | 0 | 0 % |
| LEANDRO REBOLLEDO | 172 | 84 | 88 | 48,83 % | 4 | 0 | 0 % |
| 🔴 **MARIA JOSE PEREZ** | **0** | **0** | **0** | **0 %** | **0** | **0** | **0 %** |
| MIGUEL PARRA | 136 | 0 | 136 | 0 % | 1 | 0 | 0 % |
| VIVIANA ESCALANTE | 172 | 1 | 171 | 0,58 % | 3 | 0 | 0 % |
| YENNI ALVAREZ | 104 | 0 | 104 | 0 % | 1 | 0 | 0 % |

**Se repitió con `Facturado` y con la ventana de agosto: sale igual, siempre 7 filas y siempre la de
MARIA JOSE PEREZ a cero.**

| Corrida | Ventana | Modo | Filas | ¿P001? |
|---|---|---|---|---|
| `act_vend_pedido` | 01/09–15/09 | Pedido | **7** | ✔ todo a 0 |
| `act_vend_fact` | 01/09–15/09 | Facturado | **7** | ✔ todo a 0 |
| `act_vend_fact_ago` | 01/08–31/08 | Facturado | **7** | ✔ todo a 0 |

**No es un cero de «me faltó rellenar»:** las otras seis filas traen datos con esos mismos filtros, y la
lista del medio se marcó entera (**7 valores marcados**, contando `input:checked`, no la etiqueta del
widget). **Y el cero de P001 es estructural**, no coyuntural: en base **no tiene ni un cliente asignado**
(Q5).

## 3.2 · Las que ofrecen al promotor pero no lo pintan — **con control, para que el vacío valga**

Un vacío solo significa algo si la misma pantalla, con los mismos filtros, devuelve datos sin el promotor.
**Se hizo el control en todas:**

| Pantalla | Filtro | Resultado | Control con los mismos filtros | Lectura |
|---|---|---|---|---|
| **Ind. Vendedores** · Facturado · US$ · ago | `vendedor = MARIA JOSE PEREZ` | **«No existe registro»** | `vendedor = Todos` ⇒ **5 filas, 1.171 / 224.411,08** | opción muerta |
| **Ind. Vendedores** · **Pedido** · US$ · ago | `vendedor = MARIA JOSE PEREZ` | **«No existe registro»** | *(idem)* | opción muerta en los dos modos |
| **Facturaciones** · Facturas cobradas · ago | `idSalesmaView = 24` | **«No se encontraron registros.»** | sin vendedor ⇒ **filas de agosto** (VIVIANA, YENNI, ALEJANDRA, LEANDRO…) | opción muerta |
| **% Participación** · Línea · Facturado · ago | `vendedor = MARIA JOSE PEREZ` | series **`"data":[]`** | `Todos` ⇒ `"data":[15072.0, 4883.0, …]` | opción muerta |
| **Cumplimiento de Cuota** · Empresa · Facturado · US$ · ago | `codRdv = P001` | 1 fila: **INSUMAR … 0 · 0 · 0 · 0 · 100% · 0** | — | ⚠ devuelve **«100 % Cumplimiento»** sobre cuota 0 |

> ⚠ **De propina:** Cumplimiento de Cuota, filtrado por el promotor, rotula **«100 %»** una fila de ceros
> sobre cuota cero. Es cosmético mientras el promotor no tenga datos, pero **un 100 % en verde es lo que
> menos ayuda** a quien mire el reporte por encima.

## 3.3 · Las que ni siquiera tienen la dimensión

| Pantalla | Comprobado en pantalla |
|---|---|
| **Plan VS Cuota** | *Visualización* = Empresa · Canales · País · Estado · Línea · Proveedor. **No hay «Vendedores» ni combo.** Búsqueda Empresa/Facturado/US$/agosto ⇒ 1 fila: **224.411,08** |
| **Rotación de Inventario** | *Visualización* = Productos · Línea · Proveedor. **No hay vendedor.** Línea/Facturado/UNIDADES/agosto, **18 valores marcados** ⇒ **0 resultados** *(`client_stock` vacía; defecto conocido, ajeno a este encargo)* |
| **Ind. Pedidos** | **Sin combo de vendedor**, pero **sí lista vendedores en el grid**: las 5 con facturas. **P001 no está.** |
| **Ind. Clientes** | Gráfico por canal de cliente. Sin dimensión de vendedor. `MARIA JOSE` no aparece en la página |
| **Morosidad** | Vencimiento / cuentas por cobrar. Sin dimensión de vendedor. `MARIA JOSE` no aparece en la página |

---

# 4 · LA SEGUNDA PREGUNTA: ¿el corte certificado de 1.171 · 224.411,08 queda tocado?

## 🟢 NO. Queda intacto. Y se comprobó por los dos lados.

### Por la base (Q1, la consulta del encargo, tal cual)

```
co_role  facturas       monto
   1            4      1.090,81
   7        1.171    224.411,08    <- el corte certificado
  15       17.196  2.954.757,96
```

**El rol 9 no aparece en el resultado.** No es que sume poco: **no tiene ni una factura en agosto.**

### Y no es cosa de agosto (Q2)

`P001 MARIA JOSE PEREZ` → **0 facturas en toda la base**, `primera = NULL`, `última = NULL`, **0,00**.
Comparado con sus compañeros de combo, que van de 955 a 2.581 facturas. **El promotor nunca ha facturado.**

### Por pantalla, el mismo día y la misma ventana

| Pantalla | Ventana | Lo que pintó | Oráculo | Δ |
|---|---|---|---|---|
| **Indicadores › Vendedores** · Facturado · US$ | 01/08–31/08 | VIVIANA 379/90.638,43 · ALEJANDRA 141/37.284,37 · MIGUEL 219/36.699,51 · LEANDRO 251/35.549,11 · YENNI 181/24.239,66 ⇒ **Σ 1.171 / 224.411,08** | 1.171 / 224.411,08 | **0,00** |
| **Plan VS Cuota** · Empresa · Facturado · US$ | 01/08–31/08 | **224.411,08** | 224.411,08 | **0,00** |

**Cinco filas, no seis.** El promotor **no está** en el desglose que compone el total certificado.

## Lo que esto cambia en la severidad

| | |
|---|---|
| **¿Distorsiona alguna cifra hoy?** | **No.** Ni un céntimo, en ninguna de las 12 pantallas |
| **¿Qué hace entonces?** | **Ensucia el listado**: ofrece una opción muerta en 7 desplegables y **pinta una fila fantasma** en Activación de Clientes |
| **Severidad propuesta** | 🟡 **Media** — cosmético / de confianza **hoy**, no de importes |
| **🔴 Por qué no es «Baja»** | Es **una bomba de relojería aritmética**: el filtro es `co_role IN (7,9)`, así que **el día que el promotor emita una factura o se le asignen clientes, sus importes entran en el corte de «vendedores» sin que nadie toque nada**, y entonces sí mueve las cifras. Hoy no se ve **porque no hay dato, no porque el filtro esté bien** |
| **Y ya tiene coste visible** | La fila a 0 de MARIA JOSE PEREZ **baja el % de activación medio** que lee el usuario y **mete un «100 % Cumplimiento»** falso en Cumplimiento de Cuota |

---

# 5 · HALLAZGO COLATERAL (fuera del encargo, pero se cruzó)

## 🔴 Indicadores › Cobranzas: **el filtro de vendedor no hace nada**

Tres búsquedas, mismos rango y moneda (01/08–31/08 · US$), cambiando solo el vendedor:

| Corrida | `idSalesmaView` | Serie devuelta |
|---|---|---|
| `cobr_todos` | *(vacío = todos)* | `"data":[60781.97, 14850.39, 438.96]` |
| `cobr_p001` | `24` MARIA JOSE PEREZ | `"data":[60781.97, 14850.39, 438.96]` |
| `cobr_viviana` | `4` VIVIANA ESCALANTE | `"data":[60781.97, 14850.39, 438.96]` |

**Idénticas.** El `PRE` confirma que el valor **sí quedó puesto** (`idSalesmaView: 24` / `4`), así que no es
que no se seleccionara: **es que el servidor lo ignora.**

⚠ **No se cierra el diagnóstico:** los tres gráficos traen **series de 12 valores** con pinta de meses del
año, así que **es posible que Cobranzas ignore también el rango de fechas** y esté pintando siempre el año.
**No se aisló.** Merece su propia comprobación. *(Observación de hoy, no medida a fondo.)*

---

# 6 · LO QUE NO SE PUDO COMPROBAR

- **Los resultados de Indicadores › Ventas Diarias.** La pantalla **no tiene botón Buscar** (ya anotado como
  N6 el 15/09 por la mañana). Se condujo el combo con clic real y **el cambio sí dispara 2 POST**, pero
  **no se logró que pintara ningún grid de datos, ni con P001 ni con VIVIANA (control)**. Como el control
  **tampoco** devuelve nada, **no se puede distinguir «P001 no tiene datos» de «no supe dispararla»**.
  ⇒ **NO COMPROBADO. Se pide verificación a mano.** *(Su combo sí está comprobado: ofrece a P001.)*
- **Si en Activación de Clientes el promotor es nuevo o venía de antes del fix.** Su lista de vendedores es
  de casillas, no un combo, y **no se midió el 11/09**. No hay contra qué comparar.
- **El SQL real de los beans.** Que el criterio sea `co_role IN (7,9)` es **inferencia sobre medición**
  (7 usuarios ofrecidos = 6 de rol 7 + 1 de rol 9, y ninguno de los roles 1/3/6/15/16). **`../src/` está
  fuera de alcance por norma de la corrida.**
- **Si Cobranzas ignora también las fechas** (§5). Visto el indicio, no aislado.
- **Otros roles.** INSUMAR **no tiene** usuarios de los roles 2, 4, 5, 8, 10 ni 12 en `salesman_view`,
  así que **no se puede saber por medición** si esos también entrarían. Solo se puede afirmar de los
  siete roles que sí existen aquí (tabla §2.2).
- **Qué ve un usuario que no sea `admin`.** Solo se probó con `admin`.
- **Las otras 6 pantallas de Transacciones** (Pedidos, Cobros, Devoluciones, Depósitos, Clientes
  Potenciales, Inventarios). El encargo acota a Facturaciones.
- **Exportar / Ver Gráfico / Descargar.** No se ejecutaron: descargan archivo y la corrida es de solo lectura.

---

# 7 · MÉTODO, Y TRES TRAMPAS QUE COSTARON MEDICIONES

**12 pantallas abiertas · 22 búsquedas medidas · 0 escrituras.** Cada medición guarda captura PNG,
`res-<tag>.json` con los filtros realmente puestos (`PRE`) y las filas leídas, y en Indicadores el cuerpo
AJAX completo (`resp-<tag>.txt`).

### ⚠ Trampa 1 · 🔑 **El datepicker tapa el botón Buscar** — y el clic simplemente no pasa

En Indicadores › Vendedores el `click` sobre `form:j_idt115:ajax` **agotó el timeout cuatro veces seguidas**,
aunque el botón estaba **visible y habilitado**. `elementFromPoint` sobre su centro devolvía
**`SPAN.ui-datepicker-month`**: el panel del calendario, abierto tras rellenar las fechas, estaba **encima**.

- **`Escape` no lo cierra.** Lo que funciona es un **clic real en zona neutra** (`pg.mouse.click(60,700)`).
- **Y hay que VERIFICAR, no suponer:** el bucle comprueba `elementFromPoint === botón` **antes** de pulsar.
- **Por qué importa:** la primera corrida devolvió las cifras del **año** (2.581 / 620.124,82) en lugar de
  las de **agosto** — el grid traía el resultado de la carga inicial. **Sin la guarda, eso se reporta como
  «el indicador da mal el mes», y es mentira: el Buscar nunca se pulsó.**

### ⚠ Trampa 2 · El despliegue de hoy partió las pantallas en dos familias de ids

Confirmado: **Cumplimiento de Cuota y Plan vs Cuota** ya usan **`formFiltros:*` / `formTabla:*`**;
**Activación de Clientes y Rotación de Inventario conservan `form:*`**. Los scripts de la mañana
(`medir-cuota.js`, `_pick2.js`) **no valen** contra las dos primeras. Todo esto se midió **conduciendo la
interfaz con clics reales** sobre el ítem del panel, nunca fijando el `<select>` por JS.

| Pantalla | Formularios | Base de los filtros | Grid |
|---|---|---|---|
| Cumplimiento de Cuota | `formFiltros`, `formTabla` | `formFiltros:j_idt116` | `formTabla:tablaCumplimientoCuota` |
| Plan VS Cuota | `formFiltros`, `formTabla` | `formFiltros:j_idt115` | `formTabla:tablaComparativoPlanCuota` |
| **Activación de Clientes** | **`form`** *(sin desplegar)* | `form:j_idt115` | `form:tablaComparativoPlanCuota` |
| **Rotación de Inventario** | **`form`** *(sin desplegar)* | `form:j_idt115` | `form:TablaRotacion` |
| Indicadores y Facturaciones | `form` | `form:j_idt115` *(o `j_idt116` en `/protected/indicadores/*.xhtml` y en Facturaciones)* | varía |

### ⚠ Trampa 3 · Un cero solo vale si el control devuelve datos

Se aplicó **sin excepción**: cada «no aparece» de §3.2 lleva al lado una búsqueda con los **mismos filtros y
la misma ventana** que **sí** trae filas. Y en las pantallas con lista del medio se contó
**`input:checked`** (7 en Activación, 18 en Rotación), no la etiqueta del widget.

### Otros apuntes

- **`Limpiar` antes de cada medición.** El combo de vendedor conserva la selección entre recargas; todas las
  corridas de Reportes empiezan pulsando `botonLimpiar`.
- **En Indicadores `dateF` es el inicio y `dateB` el fin** — confirmado leyendo los valores por defecto de
  Ind. Vendedores al abrirla (`dateF = 01/01/2026`, `dateB = 15/09/2026`). **En Facturaciones es al revés.**
- **`RESP_HAS_P001` da `true` casi siempre y NO significa nada**: la respuesta AJAX re-renderiza el combo, y
  el combo lleva a P001. **Hay que mirar las filas del grid, no el texto de la respuesta.**
- **Ojo con buscar «MARIA JOSE» en la página:** el combo de **clientes** (1.973 entradas) tiene a
  `MARIA JOSEFINA LORONO`, `MARIA JOSE PACHANO`… **Se comparó siempre contra `P001` y contra la fila del
  grid**, nunca contra el texto suelto de la página.
- En el volcado de la lista del medio de Activación cada nombre sale **dos veces**: es artefacto del
  selector usado (casilla + etiqueta), **no un duplicado de la pantalla**. Los ítems reales son **7**,
  contados con `input:checked`.
- `MSYS_NO_PATHCONV=1` para que Git Bash no convierta las rutas `/pages/...` en `C:/Program Files/Git/...`.

---

# 8 · QUÉ LLEVAR A LA REUNIÓN

1. **La tarjeta es de criterio, no de pantalla.** `P001 MARIA JOSE PEREZ` (rol 9, **promotora**) está en
   **las 7 listas de vendedores del producto**, repartidas en **tres implementaciones distintas**. Arreglar
   solo Activación de Clientes deja las otras seis.
2. **El criterio a corregir es `co_role IN (7, 9)` → `co_role = 7`.** Y conviene preguntar a desarrollo
   **si el 9 se metió a propósito**: el flag `role.selector` —que daría 7 y 15— **no se está usando**.
3. **🔴 Es una regresión del fix de transportistas.** Cinco de esas seis pantallas **estaban limpias el
   11/09** (6 vendedores exactos) y **hoy tienen 7**. Se arregló una pantalla rota cambiando el criterio de
   todas, y el criterio nuevo es más ancho. *(Contraste con la medición del 11/09.)*
4. **La certificación de ayer NO se toca.** `1.171 · 224.411,08` es rol 7 puro; el promotor **no tiene ni
   una factura en toda la base**. Se comprobó por SQL **y** en dos pantallas.
5. **Severidad 🟡 Media, no Baja.** Hoy no mueve cifras **porque el promotor no tiene datos**, no porque el
   filtro esté bien. En cuanto facture o se le asignen clientes, **entra solo en el corte de «vendedores»**.
6. **Comprobar a mano Indicadores › Ventas Diarias** (§6): su combo ofrece a P001, pero **no se pudo medir
   qué devuelve** — la pantalla no tiene botón Buscar, y ni siquiera el control con un vendedor real pintó
   datos.
7. **Abrir aparte 🔴 Cobranzas ignora el filtro de vendedor** (§5): tres vendedores distintos, misma serie.
   Y **revisar si ignora también las fechas**.

---

# 9 · CONSULTAS USADAS

Completas y comentadas en **`sql/consultas.sql`**.

| Q | Para qué | Resultado |
|---|---|---|
| **Q1** 🔑 | La del encargo: facturas de agosto por rol | **rol 9 ausente**; rol 7 = **1.171 / 224.411,08** *(intacto)* |
| **Q2** | ¿P001 tiene facturas en alguna fecha? | **0 facturas, nunca.** `primera`/`última` = NULL |
| **Q3** | El flag `selector` | 7 y 15 en `true`; **9 y 16 en `false`** — el flag no explica lo que se ve |
| **Q4** 🔑 | Censo de `salesman_view` por rol | 6 de rol 7 + 1 de rol 9 = **los 7 de los combos** ⇒ criterio `co_role IN (7,9)` |
| **Q5** | Clientes asignados a P001 | **0** en `client_template_user` ⇒ su fila a cero es estructural |

---

# 10 · EVIDENCIA

`evidencia/` — **12 capturas de combos** (`combos-<pantalla>.png` + `.json` con **todas** las opciones),
**22 capturas de búsqueda** y sus `res-<tag>.json` con los filtros realmente enviados, más los cuerpos AJAX
(`resp-<tag>.txt`) de las pantallas de gráfico.

**Las tres que sostienen el informe:**

| Fichero | Qué prueba |
|---|---|
| `act_vend_pedido.png` · `res-act_vend_pedido.json` | **Las 7 filas de Activación de Clientes, con MARIA JOSE PEREZ a cero** |
| `combos-*.json` (los 7 con vendedor) | **P001 ofrecido en las tres familias de control**, y **ningún** `T00x` ni `C001` |
| `res-ind_vend_todos_ago.json` | **Las 5 filas que suman 1.171 / 224.411,08 — sin el promotor** |

**Scripts de la corrida** (todos de solo lectura): `_open.js` (sesión + login) · `_drv.js` (CDP :9412) ·
`_dump.js` (inventario de combos) · `m_activacion.js` · `m_cumpl.js` · `m_plan.js` · `m_rot.js` ·
`m_ind.js` (Indicadores + Facturaciones, con la guarda de oclusión) · `m_ventas.js` · `_occ.js` (el que
destapó la Trampa 1).
