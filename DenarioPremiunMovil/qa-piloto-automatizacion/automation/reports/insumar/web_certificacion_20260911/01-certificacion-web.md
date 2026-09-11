# Certificación web · INSUMAR · transportistas en los reportes

| | |
|---|---|
| **Fecha de la corrida** | 2026-09-11 (tarde) |
| **Cliente / base** | INSUMAR · empresa única `INSUM_A` — INSUMAR DISTRIBUIDORA 715, C.A. · base `insumar` |
| **⚠ Base** | **La base se reemplazó hoy a mediodía.** Todo lo de abajo se midió **después** del reemplazo. Nada se reutiliza de la corrida `web_reportes_20260911` salvo los selectores. |
| **Capa** | **Solo web.** No se tocó el dispositivo ni el CDP del móvil. |
| **Web** | `http://denarioelyaque.ddns.net:8080/DenarioPremium` (playa EL YAQUE, descubierta en runtime) |
| **Usuario** | `admin` |
| **Método** | Playwright local (`automation/playwright/node_modules/playwright`), Chrome con `--remote-debugging-port=9411`, `chromium.connectOverCDP`. Scripts `s*.js` de este RUN_DIR. |
| **Escrituras** | **Ninguna.** Corrida de lectura: entrar, filtrar, mirar, contrastar contra la base. |
| **Oráculo** | `node automation/db/query.js insumar "<SQL>"` — consultas completas en `sql/consultas.sql`. **Recalculado al inicio y al final de la corrida; no se movió.** |
| **Ventana** | `01/09/2026 – 11/09/2026` en todo, salvo donde la pantalla no admite rango (se indica). |

---

## Los oráculos, recalculados en esta corrida

```sql
SELECT count(*), round(sum(nu_amount_total)::numeric,2)
  FROM invoice WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11';
```

| Qué se cuenta | Filas | Monto (US$) |
|---|---:|---:|
| **Todo lo que hay en `invoice`** | 7.370 | **1.234.598,91** |
| ↳ menos el admin `A001` (2 filas / 584,98) | 7.368 | **1.234.013,93** |
| **Solo vendedores** (código sin sufijo `T###`) | 470 | **80.745,21** |
| ↳ solo vendedores, sin el admin `A001` | 468 | **80.160,23** |
| Solo las copias de transportista | 6.900 | 1.153.853,70 |
| **Cada uno** de `T001`…`T006`, idéntico al céntimo | 1.150 | **192.308,95** |

Clientes distintos en la ventana: **833** contando todas las copias · **341** solo vendedores.

**Criterio de rol** (`sql/consultas.sql` Q4): de los 13 roles, **`role.selector = true` solo en `ROLE_SALESMAN` (7) y `ROLE_TRANSPORT` (15)**. Sigue igual en la base nueva.

---

## 🔑 La tabla central: módulo × monto mostrado × oráculo × ¿ofrece transportistas?

Ventana `01/09–11/09/2026`, Cumplimiento = **Facturado**, Unidad = **US$**.

| Módulo | Monto que muestra | vs oráculo correcto (80.160,23) | vs oráculo con copias (1.234.598,91) | ¿El combo ofrece `T001`–`T006`? | ¿Devuelve datos al elegir un transportista? | Veredicto |
|---|---:|---|---|---|---|---|
| **Transacciones → Facturaciones** | **81.935,96** · 468 filas | ✅ cuadra (ver nota) | ✖ 15× por debajo | **No** — 6 vendedores + `P001` promotor | N/A: no se puede elegir | ✅ **CORREGIDO** |
| **Indicadores → Vendedores** | *(vacío)* | — | — | **No** | N/A | ✅ combo OK · ⚠ monto **no medible** |
| **Indicadores → Clientes** | *(gráficos vacíos)* | — | — | no tiene combo | N/A | ⚠ monto **no medible** |
| **Indicadores → % de Participación** | *(gráficos vacíos)* | — | — | **No** | N/A | ✅ combo OK · ⚠ monto **no medible** |
| **Indicadores → Ventas Diarias** | *(no medido)* | — | — | **No** | N/A | ✅ combo OK |
| **Indicadores → Cobranzas** | *(no medido)* | — | — | **No** | N/A | ✅ combo OK |
| **Indicadores → Pedidos** *(filtra por AÑO, no por rango)* | 1.733.804,89 (año 2026) | ⚠ no cuadra con ningún oráculo | ✖ no es escala de copias | **No** | N/A | ⚠ sin transportistas · monto **no certificado** |
| 🔴 **Reportes → Plan VS Cuota** | **1.234.013,93** · 1.935 uds · 833 clientes | ✖ **×15,4** | ✅ **idéntico** (menos el admin) | no tiene combo de vendedor | N/A | 🔴 **NO CORREGIDO** |
| 🔴 **Reportes → Cumplimiento de Cuota** | **1.234.013,93** · **7.368** facturas · 1.826 cartera | ✖ **×15,4** | ✅ **idéntico** (menos el admin) | 🔴 **Sí, los 6** (+ `C001` Catálogo y `P001` Promotor) | 🔴 **Sí**: `T001` → **192.308,95** / 1.150 | 🔴 **NO CORREGIDO** |

**La hipótesis de QA se confirma: dos de tres corregidos, Reportes no.**

---

## B.1 · Transacciones → Facturaciones — ✅ CORREGIDO

`/pages/facturaciones` · Tipo `Consolidado` · `US$` · `01/09/2026`–`11/09/2026`.

| Dato | Pantalla | BD |
|---|---:|---:|
| Total de Resultados | **468** | **468** (sin sufijo `T###` y `co_user <> 'A001'`) |
| Códigos con sufijo `T###` en el grid | **0** | 6.900 en la ventana |
| Suma de la columna «Monto facturado» | **81.935,96** | 80.160,23 (`nu_amount_total`) · 82.144,45 (`nu_amount_final`) |

**Desglose por vendedor — cuadra al registro, uno a uno:**

| Vendedor | Pantalla | BD (`co_user`) |
|---|---:|---:|
| VIVIANA ESCALANTE | 137 | 137 (`R013`) |
| LEANDRO REBOLLEDO | 127 | 127 (`R016`) |
| MIGUEL PARRA | 89 | 89 (`R007`) |
| YENNI ALVAREZ | 73 | 73 (`R009`) |
| ALEJANDRA RODRIGUEZ | 42 | 42 (`R015`) |

**Combo de vendedores:** `Vendedor | ALEJANDRA RODRIGUEZ | EVA MEDINA | LEANDRO REBOLLEDO | MARIA JOSE PEREZ | MIGUEL PARRA | VIVIANA ESCALANTE | YENNI ALVAREZ`. **Ningún transportista.**

⚠ **Nota honesta sobre el monto:** el número de filas y el desglose por vendedor cuadran **exactos**; la **suma de la columna** (81.935,96) cae **entre** los dos campos de monto de la tabla y no coincide con ninguno al céntimo (−208,49 respecto de `nu_amount_final`). **No investigué qué campo pinta la columna.** Lo que se certifica es lo medido: la pantalla lista **468 filas, todas de vendedor, cero copias**, y está **15 veces por debajo** del total inflado.

Evidencia: `evidencia/B-fact-consolidado.png`, `_B_fact.json`.

---

## B.2 · Indicadores — ✅ el combo está corregido · ⚠ el monto no se pudo medir

**Ninguna de las siete pantallas de Indicadores ofrece transportistas.** Recon completo en `_D_recon.json`:

| Pantalla | Combo de vendedor | Contenido del combo |
|---|---|---|
| `/pages/pedidosVendedores` | `form:j_idt115:vendedor` | Todos + los 6 vendedores + `MARIA JOSE PEREZ` |
| `/pages/indicadoresProductos` | `form:j_idt115:vendedor` | idéntico |
| `…/indicadorCobros.xhtml` | `form:j_idt115:idSalesmaView` | idéntico |
| `…/pedidosProductosVentas.xhtml` | `form:j_idt116:idSalesmaView` | los 6 vendedores + `P001`, con prefijo `R0xx -` |
| `/pages/indicadoresPedidos` · `/pages/pedidosClientes` · `…/indicadorMorosos.xhtml` | **no tienen** | — |

⚠ **Por qué el monto quedó sin certificar.** Las tres pantallas de Indicadores que filtran por rango de fechas **no devuelven nada** en la ventana:

| Pantalla | Facturado, 01/09–11/09 | Facturado, 01/01–11/09 | Pedido, 01/09–11/09 |
|---|---|---|---|
| Indicadores → Vendedores | «No existe registro» | «No existe registro» | «No existe registro» |
| Indicadores → Clientes | gráficos vacíos | gráficos vacíos | — |
| Indicadores → % de Participación | gráficos vacíos | — | — |

**No es mi método:** capturé el cuerpo del POST y las fechas viajan bien
(`dateB_input=01%2F01%2F2026 & dateF_input=11%2F09%2F2026`, `cumplimiento_input=Facturado`), y la respuesta AJAX **no trae error** — el servidor contesta «vacío», no «excepción». Con 468 facturas de vendedor en la ventana hay de sobra qué mostrar. **Esto es un defecto aparte** (ya visto en la corrida de la mañana, ahora confirmado contra la base nueva). Mientras siga así, **de estas pantallas no se puede sacar un monto que contrastar**.

La única de Indicadores que sí muestra facturación es **Indicadores → Pedidos**, y **solo filtra por año** (no admite rango): año 2026 → **Monto Total Facturado 1.733.804,89 US$**, con un desglose de **solo 5 vendedores, ningún `T00x`**. Ese número **no cuadra con ningún oráculo de `invoice`** (2026: vendedores 1.285.545,14 · con copias 8.331.946,28), así que **no lo certifico**; lo que sí se ve es que **no está en la escala de las copias**.

Evidencia: `evidencia/E-ind-*.png`, `evidencia/F-ind-*.png`, `_D_recon.json`, `_E_ind.json`, `_F_ind_ano.json`.

---

## B.3 · Reportes → Plan VS Cuota — 🔴 NO CORREGIDO

**Reproducción mínima**

1. Entrar **limpio** (sesión recién iniciada) a Reportes → **Plan VS Cuota**.
2. Visualización `Empresa` · Cumplimiento `Facturado` · Unidad `US$` · Fecha Inicio `01/09/2026` · Fecha Final `11/09/2026`.
3. **Buscar**.

**Obtenido — 1 fila:**

| Descripción | Cuota | Facturado | Brecha | Cantidad | Clientes | % Cumpl. | % Activación |
|---|---:|---:|---:|---:|---:|---:|---:|
| INSUMAR DISTRIBUIDORA 715, C.A. | 0 | **1.234.013,93** | 1.234.013,93 | 1.935 | **833** | 43,05 % | 65,68 % |

**Esperado:** ≈ **80.160,23** (las 468 facturas reales de los vendedores).

**La aritmética no deja dudas:** `1.234.598,91 − 584,98 (el admin A001) = 1.234.013,93`, **exacto**. El reporte suma **las 6.900 copias de transportista** y lo único que excluye es al usuario administrador. Lo mismo con los clientes: **833** son los clientes de todas las copias; solo vendedores son **341**.

**Factor de inflado: ×15,4.**

Evidencia: `evidencia/A1-fresh.png`, `evidencia/A7-sesion-nueva.png`, `_A_secuencia.json`.

---

## B.4 · Reportes → Cumplimiento de Cuota — 🔴 NO CORREGIDO (y es el peor)

`/pages/reporteCumplimientoCuota` · `Empresa` · `Facturado` · `US$` · Vendedor `Todos` · `01/09`–`11/09/2026`:

| Descripción | Cuota | **Monto Facturado** | Brecha | **Cantidad Facturado** | Cartera | % Cumpl. | % Activación |
|---|---:|---:|---:|---:|---:|---:|---:|
| INSUMAR DISTRIBUIDORA 715, C.A. | 0 | **1.234.013,93** | 1.234.013,93 | **7.368** | 1.826 | 100 % | 45,62 % |

`7.368` es **literalmente el número de filas de `invoice` menos las 2 del admin** (7.370 − 2). No hay ambigüedad posible: cuenta cada copia como una factura.

### El combo de vendedores ofrece a los seis transportistas

15 entradas:

```
Todos | R013 VIVIANA ESCALANTE | T001 JOSE MUÑOZ | T002 LEANDRO MUÑOZ | T003 YONI MILANO |
T004 SAUL PENOTT | T005 ARMANDO ROSAS | R015 ALEJANDRA RODRIGUEZ | R007 MIGUEL PARRA |
R016 LEANDRO REBOLLEDO | R009 YENNI ALVAREZ | T006 VACANTE VACANTE | R003 EVA MEDINA |
C001 CATALOGO INSUMAR | P001 MARIA JOSE PEREZ
```

### Y al elegir uno, calcula con las copias

| Vendedor elegido | Monto Facturado en pantalla | Cantidad | Oráculo BD | ¿Cuadra? |
|---|---:|---:|---:|---|
| 🔴 **T001 JOSE MUÑOZ** *(transportista)* | **192.308,95** | **1.150** | 192.308,95 / 1.150 | **sí, al céntimo** — le atribuye las 1.150 copias |
| ✅ R013 VIVIANA ESCALANTE *(control, vendedora real)* | 27.632,38 | 137 | 27.632,38 / 137 | sí — aquí el cálculo es correcto |
| C001 CATALOGO INSUMAR | 0 | 0 | — | el combo también ofrece el usuario Catálogo |

⇒ Un transportista es **seleccionable como vendedor** y el reporte **le calcula cumplimiento de cuota** con facturas que no son suyas.

Evidencia: `evidencia/C1-cumpl-todos.png`, `evidencia/C4-cumpl-T001.png`, `evidencia/C5-cumpl-R013.png`, `evidencia/C6-cumpl-C001.png`, `_C_cumpl.json`, `_C_vend.json`.

### ⚠ Un matiz para quien haga el fix

`role.selector = true` en `ROLE_SALESMAN` y `ROLE_TRANSPORT` explica **por qué entran los transportistas**, pero **no explica todo el combo**: también aparecen `C001` (`ROLE_CATALOG`, `selector = false`) y `P001` (`ROLE_PROMOTER`, `selector = false`). Es decir, **ese combo no está filtrando por `role.selector`**, sino por algo más laxo (parece «todos menos admin/supervisor/gerente»). Y las pantallas ya corregidas (Facturaciones, Indicadores) listan los 6 vendedores **+ `P001`**, o sea que **tampoco** usan `role.selector` estricto. **No leí el bean** — esto es inferencia sobre medición, pero conviene mirarlo antes de asumir que basta con apagar `selector` en `ROLE_TRANSPORT`.

---

## A · La secuencia exacta del error tras «Limpiar»

*(Medido íntegro antes del cambio de prioridades. Se deja documentado porque está cerrado; la validación del fix queda para más adelante, como decidió QA.)*

QA tenía razón y la corrida de la mañana se equivocó por probar siempre después de limpiar.

### Reproducción exacta

1. **Cerrar sesión y volver a entrar** (hace falta: es lo único que reinicia el estado).
2. Reportes → **Plan VS Cuota** · `Empresa` · `Facturado` · `US$` · `01/09/2026`–`11/09/2026` · **Buscar**
   ⇒ ✅ **1 fila**, sin error.
3. Pulsar **Limpiar** (el clic en sí **no** da error).
4. Reponer los mismos filtros · **Buscar**
   ⇒ 🔴 **«Error en busqueda de reporte. Intente nuevamente.»** · `Total de Resultados: 0` · «No se encontraron registros.»

### Qué se comprobó alrededor

| Prueba | Resultado |
|---|---|
| Repetir **Buscar** 2ª y 3ª vez **sin** pulsar Limpiar | ✅ sigue dando 1 fila — **repetir la búsqueda no rompe nada** |
| Buscar otra vez tras el fallo | 🔴 falla |
| **Recargar la página (F5)** y repetir | 🔴 **sigue fallando** |
| Salir a Inicio y **volver a entrar por el menú** | 🔴 **sigue fallando** |
| **Cerrar sesión y volver a entrar** | ✅ **vuelve a funcionar** — es la única recuperación |
| Con Cumplimiento = **Pedido** (en vez de Facturado) | 🔴 falla igual — **no es exclusivo de Facturado** |
| Sesión nueva, **Limpiar antes de la primera búsqueda**, luego filtros y Buscar | 🔴 **falla** — no hace falta haber buscado antes |
| **Cumplimiento de Cuota**: buscar → Limpiar → reponer filtros → buscar | ✅ **no se rompe** — el hermano aguanta |
| **Facturaciones** en la misma sesión ya rota | ✅ funciona (468 filas) — el estado roto es **del bean de ese reporte**, no de la sesión entera |

**Resumen en una línea:** *pulsar «Limpiar» una sola vez deja el reporte Plan VS Cuota inservible para el resto de la sesión, con cualquier filtro; no se recupera ni recargando ni reentrando por el menú, solo cerrando sesión.*

**La respuesta AJAX es lo que distingue el caso**, y está guardada en cada intento:
- Búsqueda buena → la respuesta trae el `<update>` del grid, **sin** `summary`.
- Tras Limpiar → `summary:"Error en busqueda de reporte."` · `detail:"Intente nuevamente."` · severidad error.

Evidencia: `evidencia/resp-A*.txt` (una por intento), `evidencia/A*.png`, `_A_secuencia.json`, `_A_secuencia2.json`, `_A_secuencia3.json`.

---

## Hallazgos

### H1 · Reportes → Plan VS Cuota suma las copias de transportista · 🔴 Alto
Muestra **1.234.013,93** donde la venta real de los vendedores es **80.160,23** (**×15,4**), y **833 clientes** donde son **341**. El número coincide **al céntimo** con «todas las filas de `invoice` menos el admin». **Evidencia:** `evidencia/A1-fresh.png`, `sql/consultas.sql` Q1.

### H2 · Reportes → Cumplimiento de Cuota suma las copias y además ofrece a los transportistas como vendedores · 🔴 Alto
**1.234.013,93** y **7.368 facturas** (= filas de `invoice` − admin). El combo Vendedor lista `T001`–`T006`; eligiendo `T001` devuelve **192.308,95 / 1.150**, exactamente sus copias. **Evidencia:** `evidencia/C1-cumpl-todos.png`, `evidencia/C4-cumpl-T001.png`.

### H3 · Plan VS Cuota queda inservible en toda la sesión tras pulsar «Limpiar» · 🔴 Alto
Secuencia exacta arriba. Solo se recupera cerrando sesión. Afecta a Pedido y a Facturado. El reporte hermano no lo sufre. **Evidencia:** `evidencia/resp-A3-tras-limpiar.txt`.

### H4 · Indicadores → Vendedores / Clientes / % Participación no devuelven nada en ningún rango · 🟠 Medio
Ni con Facturado ni con Pedido, ni en 01/09–11/09 ni en 01/01–11/09, habiendo 468 facturas de vendedor. La respuesta AJAX **no trae error**: el servidor contesta vacío. Bloquea la certificación del monto de esas tres pantallas. **Evidencia:** `evidencia/F-ind-Vendedores-Facturado.png`, `_F_ind_ano.json`.

### H5 · El combo de Cumplimiento de Cuota también ofrece el usuario Catálogo y el Promotor · 🟡 Bajo
`C001 CATALOGO INSUMAR` y `P001 MARIA JOSE PEREZ` aparecen como vendedores elegibles, y ambos tienen `role.selector = false`. Indica que ese combo **no** se arma con `role.selector`. **Evidencia:** `evidencia/C6-cumpl-C001.png`, `sql/consultas.sql` Q4.

### H6 · `R003 EVA MEDINA` sigue duplicada en `users` · 🟡 Bajo · **arrastrado, no verificable hoy**
`id_user = 13` (`co_operation = D`) y `id_user = 22` (`I`), ambos con `co_user = R003`. **En la base nueva `R003` no tiene ni una factura en septiembre**, así que el síntoma de la mañana (el combo la ofrece y el grid nunca devuelve nada suyo) **no se pudo volver a medir**. Queda solo el dato de la tabla. **Evidencia:** `sql/consultas.sql` Q5.

---

## Lo que NO se pudo comprobar

- **El monto de Indicadores → Vendedores, → Clientes y → % de Participación.** Las tres salen vacías en todos los rangos probados (H4). El combo **sí** está certificado (no ofrece transportistas); **el monto no**. Conviene que QA lo mire **a mano** para descartar del todo que sea mi método, aunque el POST bien formado y la ausencia de error AJAX apuntan a la pantalla.
- **De dónde sale el 1.733.804,89 de Indicadores → Pedidos.** No cuadra con `invoice` (ni `nu_amount_total` ni `nu_amount_final`, ni por año ni en total), ni con la tabla `order`. **No es escala de transportistas**, y su desglose no trae ningún `T00x`, pero **el número en sí queda sin certificar**.
- **Por qué la suma de la columna «Monto facturado» de Facturaciones (81.935,96) no coincide al céntimo con ningún campo de `invoice`.** Las filas y el desglose por vendedor sí cuadran exactos; el delta de 208,49 frente a `nu_amount_final` no se investigó.
- **El SQL real de los beans.** Todo lo de causa (`role.selector`, el criterio del combo) es **inferencia sobre medición**: `../src/` está fuera del alcance de esta corrida.
- **Qué excepción lanza Plan VS Cuota tras Limpiar.** Llega como mensaje de usuario; el stack está en el log de Tomcat.
- **Indicadores → Ventas Diarias y → Cobranzas: solo se certificó el combo.** No se midieron montos en esas dos.
- **Qué ve un usuario que no sea `admin`.** Solo se probó con `admin`.
- **El origen de las copias en `invoice`.** Es diseño del cliente (el ERP envía cada factura a cada usuario) y queda fuera: aquí solo se certifica que **las pantallas muestren solo vendedores**.
- **Si los defectos de Reportes son regresión.** No hay medición previa contra esta base.

---

## Patrones y selectores nuevos

Todo medido en esta corrida, contra la base nueva. Complementa —y en dos puntos corrige— lo documentado en `web_reportes_20260911/01-reportes-web.md`.

### 🔑 «Limpiar» envenena el bean: hay que **cerrar sesión** para volver a medir

Es el patrón de método más caro de esta corrida. En Plan VS Cuota, **una sola pulsación de Limpiar deja el reporte devolviendo error el resto de la sesión**, y **ni `page.reload()` ni volver a navegar a la URL lo arreglan**. Cualquier matriz de mediciones que use Limpiar entre casos produce **falsos FAIL en cascada** — es exactamente lo que le pasó a la corrida de la mañana.

Helper de sesión nueva (en `_lib.js`), obligatorio entre casos de esa pantalla:

```js
async function nuevaSesion(ctx, pg) {
  await ctx.clearCookies();          // <- lo que de verdad reinicia el bean
  await D.goto(pg, '/pages/login.xhtml');
  // ... rellenar y enviar el formulario
}
```

### Leer el error del servidor **y** el cuerpo del POST

`clickCapture` (en `_lib.js`) captura la respuesta AJAX; para distinguir «no hay datos» de «mi filtro no llegó» hace falta además el **request**:

```js
const hr = r => { if (r.method()==='POST') { const d=r.postData(); if (d && d.includes('dateB')) req = d; } };
pg.on('request', hr);
// ...
req.match(/dateB_input=[^&]*/)   // -> dateB_input=01%2F09%2F2026
```

Esto es lo que permitió afirmar que el vacío de Indicadores **no** es del método: las fechas y el cumplimiento viajan correctos y la respuesta **no** trae `summary`.

### Los `selectOneMenu` necesitan limpiar overlays antes del clic

`D.pick()` falla con `element is not visible` cuando queda abierto el panel de otro combo o un datepicker de la pantalla anterior. El guard que lo resuelve:

```js
async function limpiaOverlays(pg){ await pg.keyboard.press('Escape'); await pg.mouse.click(5,5); await pg.waitForTimeout(400); }
```

…y hacer `scrollIntoView({block:'center'})` del `_label` antes de clicar.

### Leer las opciones de un combo: hay que **abrirlo** primero

El `_panel` se renderiza de forma perezosa: leerlo sin abrir el combo devuelve `[]` y parece «no hay opciones». Abrir (clic en `_label`), esperar ~900 ms, leer los `li.ui-selectonemenu-item`, y cerrar con `Escape`.

### Paginar y sumar un grid de PrimeFaces

```js
// subir a 200 por página
await pg.evaluate(()=>{ const w=Object.values(PrimeFaces.widgets).find(w=>w&&w.id==='form:pedidosDT'); w.paginator.setRowsPerPage(200); });
// siguiente página  (getElementById, NO querySelector: los ':' de JSF rompen el selector CSS)
await pg.evaluate(()=>{ const pb=document.getElementById('form:pedidosDT_paginator_bottom');
  const nx=pb.querySelector('.ui-paginator-next'); if(!nx||nx.classList.contains('ui-state-disabled'))return false; nx.click(); return true; });
```

⚠ Un `document.querySelector` con el id escapado (`#form\:pedidosDT...`) **lanza `SyntaxError`** dentro de `page.evaluate`: el escape se pierde al serializar la función. Usar siempre `getElementById`.

### Cambios de la pantalla respecto de la corrida de la mañana (base nueva)

| | Antes | Ahora |
|---|---|---|
| Plan VS Cuota · combo **Visualización** | `Empresa` / `Canales de distribución` / `Pais` / `Estado` / `Linea` / **`Sub-Linea`** | `Empresa` / `Canales de distribución` / `Pais` / `Estado` / `Linea` / **`Proveedor`** (ya no hay Sub-Linea) |
| Cumplimiento de Cuota · combo **Vendedor** | 13 entradas | **15** (se suma `P001 MARIA JOSE PEREZ`) |
| Plan VS Cuota · **con datos** | 0 filas siempre | **1 fila** en la 1ª búsqueda de cada sesión |

### Sin cambios (siguen valiendo)

- Prefijos JSF: `form:j_idt115` en Plan VS Cuota, Cumplimiento de Cuota e Indicadores de `/pages/*`; `form:j_idt116` en Facturaciones y en los Indicadores de `/pages/protected/indicadores/*.xhtml`.
- Grids: `form:tablaComparativoPlanCuota` · `form:tablaCumplimientoCuota` · `form:pedidosDT` · `form:tablaPedidos`.
- El `selectCheckboxMenu` de valores necesita `w.renderPanel()` **antes** de `w.checkAll()`, y la etiqueta miente: contar `input:checked`.
- Asignar `.value` a `fechaDesde_input` / `dateB_input` por JS **sí** viaja en el POST (verificado de nuevo, esta vez leyendo el cuerpo del request).
- El combo **Empresa** está `disabled` (una sola empresa) y no viaja en el POST.
- `require('playwright')` desde un RUN_DIR: resolver
  `path.resolve(__dirname,'..','..','..','playwright','node_modules','playwright')`.
- Bloque de credenciales de EL YAQUE: `# USUARIO WEB ISLA COCHE (HIDROPONIAS) / CARIBE / EL YAQUE`.

### Modelo de datos

- `invoice.co_invoice` **no** es el número de factura: es `<número><co_user del transportista>`. Separar con el patrón `T` + 3 dígitos al final.
- El rol vive en `role_user`, no en `users`. `role.selector = true` solo en `ROLE_SALESMAN` (7) y `ROLE_TRANSPORT` (15) — pero **los combos de la web no se arman solo con ese flag** (ver H5).
- `A001` (admin ADRIANA) tiene facturas propias: **2 filas / 584,98** en la ventana. Es la diferencia entre `1.234.598,91` y el `1.234.013,93` que pintan los reportes — **incluirlo o no cambia el contraste**, hay que decidirlo explícitamente en cada oráculo.
