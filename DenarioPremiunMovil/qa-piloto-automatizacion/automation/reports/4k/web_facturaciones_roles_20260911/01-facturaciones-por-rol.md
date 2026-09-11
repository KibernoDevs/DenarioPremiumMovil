# Facturaciones por rol · IMPORTADORA 4K (web)

| | |
|---|---|
| **Fecha de la corrida** | 2026-09-11 |
| **Cliente / base** | IMPORTADORA 4K · `4k` · empresa única `DIESE` (GRUPO 4K) |
| **Capa** | **Solo web.** No se tocó el dispositivo ni el CDP del móvil. |
| **Web** | `http://denariocaribe.ddns.net:8080/DenarioPremium` (playa CARIBE) |
| **Pantalla** | Transacciones → Facturaciones (`/pages/facturaciones`), detalle en `/pages/detalleFacturacion` |
| **Roles probados** | `ADMIN` (ROLE_ADMIN) y `cobranza4k` (ROLE_COLLECTION, gerente de cobranza) |
| **Clave** | La del bloque `# USUARIO WEB ISLA COCHE (HIDROPONIAS) / CARIBE` de `secrets/qa-credentials.env`. Entró a la primera en los dos usuarios. |
| **Método** | Playwright local (`automation/playwright/node_modules/playwright`), Chrome con `--remote-debugging-port`, dos sesiones simultáneas (9401 ADMIN / 9402 GERENTE). Scripts en el scratchpad. |
| **Escrituras** | Ninguna. Corrida de lectura: entrar, filtrar, mirar, comparar. |
| **Rango de filtro usado** | `01/01/2020 – 11/09/2026` en todas las mediciones comparables (cubre el 100 % de los datos: `document_sale` va de 2022-11-16 a 2026-08-19; `invoice` de 2025-11-03 a 2026-08-19) |

> ⚠ El filtro **por defecto** de la pantalla es el mes en curso (`01/09/2026 – 11/09/2026`) y en 4K
> devuelve **0 resultados**, porque el último dato cargado es de **agosto**. Quien abra la pantalla
> y no cambie las fechas ve "No se encontraron registros" **en los dos roles**. Es esperable, no
> es el defecto reportado, pero explica por qué el síntoma se puede confundir.

---

## Punto 1 · ¿El administrador ya ve las facturaciones? (el fix)

**Veredicto: PASS — el fix funciona.** El administrador entra a la pantalla, el listado carga y
el detalle abre.

| Dato medido | Valor |
|---|---|
| `ADMIN` llega a `/pages/facturaciones` | Sí, sin error ni redirección |
| Listado con rango completo, Consolidado | **3.693 registros** ("Total de Resultados: 3693") |
| Columnas que recibe | Detalle · Tipo · Código facturación · Fecha facturación · Vendedor · Cliente · Monto facturado · Saldo pendiente · Vencimiento · Monto conv. · Tasa conv. · Adjuntos |
| Columna **Vendedor** | **Poblada en el 100 % de las filas visibles** (0 vacías en las 50 de la primera página) |
| Detalle (`Consultar`) | **Abre** y navega a `/pages/detalleFacturacion` |

Evidencia: `evidencia/ADMIN-01-postlogin.png`, `ADMIN-03-buscar.png`, `ADMIN-12-inv-todos.png`,
`ADMIN-09-detalle-ok.png`.

**Detalle completo, medido sobre `CJA-D0001623`** (elegida en BD *porque tiene líneas*):
cabecera completa (Código, Fecha, **Vendedor: EDWIN HERRERA**, Empresa, Cliente + RIF, Responsable,
Fecha de despacho, Condición de pago, Sucursal, Monto total 595,00 USD) y **las 6 líneas de producto**
con código, producto, almacén, lista de precio y unidades. → `evidencia/ADMIN-09-detalle-ok.png`.

⚠ **Aviso de método para quien repita esto a mano:** si se abre el detalle de la **primera fila**
del listado (orden por fecha desc), la tabla de productos sale vacía. **No es un defecto del fix**:
son facturas que no tienen líneas en la base. Medido: **90 de 4.474 facturas no tienen ninguna fila
en `invoice_detail`, y 73 de esas 90 son de 2026-08** — justo las que quedan arriba del listado.
Ver `evidencia/ADMIN-07-detalle-invoice.png` (`CJA-C0000104`, 0 líneas en BD y 0 en pantalla: la
pantalla es fiel al dato).

---

## Punto 2 · ¿Qué ve el gerente?

**Veredicto: listado PASS · detalle PASS.** El gerente ve **exactamente lo mismo** que el
administrador: mismo total, mismas columnas, mismo detalle.

| Dato medido | GERENTE (`cobranza4k`) |
|---|---|
| Listado Consolidado, rango completo | **3.693** (idéntico a ADMIN) |
| Listado "Facturas cobradas" | **3.693** |
| Columna Vendedor | poblada, 0 vacías en la página |
| Detalle de `CJA-D0001623` | abre, cabecera completa y **las 6 líneas**, byte por byte igual al de ADMIN |

Evidencia: `evidencia/GERENTE-13-Consolidado.png`, `GERENTE-13-Facturas_cobradas.png`,
`GERENTE-09-detalle-ok.png`.

> Lo que **hoy** no se reproduce es "al gerente se le ven las facturaciones pero no el detalle":
> con una factura que tiene líneas, el detalle del gerente sale entero. Lo que sí sigue roto para
> los dos roles es otra cosa — el punto 3.

---

## Punto 3 · Los dos roles lado a lado, misma pantalla y mismos filtros

Todas las celdas con el mismo rango `01/01/2020 – 11/09/2026`, sin filtro de vendedor ni de cliente,
empresa GRUPO 4K.

| Qué se mira | ADMIN (ROLE_ADMIN) | GERENTE (ROLE_COLLECTION) | BD dice |
|---|---|---|---|
| Entra a Transacciones → Facturaciones | Sí | Sí | — |
| Tipo **Consolidado** (TODOS) | **3.693** | **3.693** | 4.474 facturas + 8.470 documentos |
| Tipo **Facturas cobradas** (INVOICE) | **3.693** | **3.693** | 4.474 |
| Tipo **Pendientes por cobrar** (DOCUMENT_SALE) | **0** ❌ | **0** ❌ | **8.470** (2.044 vivos) |
| Columnas del grid | las 12, idénticas | las 12, idénticas | — |
| Columna **Vendedor** en lo que se ve | poblada (0 vacías) | poblada (0 vacías) | `invoice.id_user` 4.474/4.474 |
| Columna **Vendedor** en los pendientes | no evaluable: no hay filas | no evaluable: no hay filas | `document_sale.id_user` **0/8.470** |
| Detalle de una factura con líneas | completo | completo | 6 líneas |
| Detalle de una factura sin líneas | tabla vacía | no medido | 0 líneas (fiel) |
| Vendedores que ofrece el combo | 11 | 11 (los mismos) | — |

**Conclusión del lado a lado: los dos roles ven exactamente lo mismo. No hay ninguna diferencia
por rol en esta pantalla.** El defecto que queda es común a ambos y no depende de quién entre.

---

## Punto 4 · ¿Permisos del rol, consulta de la pantalla, o datos que no están?

**Respuesta: la consulta de la pantalla.** No es permisos y no es que falten los datos.

Los tres se descartan por medición, no por opinión:

**No es permisos.** ADMIN y GERENTE, con roles distintos (ROLE_ADMIN vs ROLE_COLLECTION), obtienen
el **mismo número exacto** en las tres variantes del filtro: 3.693 / 3.693 / 0. Un problema de
permisos daría números distintos entre roles.

**No es que falten los datos.** Los 8.470 documentos existen y **la propia web los muestra** en otra
pantalla. En **Datos Maestros → Documentos de Venta** (`/pages/documentos`), misma base, mismo rango
de fechas, misma empresa:

| Pantalla | ADMIN | GERENTE |
|---|---|---|
| Facturaciones → "Pendientes por cobrar" | **0** | **0** |
| Datos Maestros → Documentos de Venta | **8.470** | **8.470** |

Evidencia: `evidencia/ADMIN-14-documentos-venta.png`, `GERENTE-15-docventa-vend.png`.

**Es la consulta, y se puede señalar el mecanismo exacto: el cruce por vendedor.**
La misma pantalla de Documentos de Venta, sobre la misma tabla y el mismo rango, cambia de 8.470 a 0
con solo elegir un vendedor en el filtro:

| Documentos de Venta, rango completo | Resultado |
|---|---|
| sin filtro de vendedor | **8.470** |
| con Vendedor = `V.0012 - EDWIN HERRERA` | **0** |

Evidencia: `evidencia/ADMIN-15-docventa-vend.png`.

Cualquier consulta que ate `document_sale` al vendedor devuelve cero, porque **`document_sale.id_user`
está vacío en las 8.470 filas**. Facturaciones tiene columna Vendedor y filtro de Vendedor, es decir
**siempre** ata por vendedor ⇒ sus "Pendientes por cobrar" son **siempre** 0.

**El mismo mecanismo se ve del lado de las facturas, y ahí se puede medir con precisión.** El listado
muestra 3.693 de 4.474 facturas. Las 781 que faltan son exactamente las de vendedores cuyo rol no es
"seleccionable":

```
na_role           selector   facturas
ROLE_SALESMAN      true        3693   <- justo lo que muestra la pantalla
ROLE_PROMOTER      false        588
ROLE_SUPERVISOR    false        193
                              -----
                               4474   (588 + 193 = 781 = 4474 - 3693)
```

⇒ La pantalla no lista facturaciones: lista **facturaciones que cuelgan de un vendedor con rol
seleccionable**. Con `document_sale.id_user` en NULL, el 100 % de los pendientes se cae de esa red.

> **Alcance honesto de esta afirmación:** el cruce 3.693 = ROLE_SALESMAN es una **medición exacta**
> (coincide al registro). Que la consulta de "Pendientes por cobrar" use *ese mismo* cruce es una
> **inferencia** — fuerte, porque el experimento de Documentos de Venta reproduce el 8.470→0 con solo
> añadir el vendedor, pero no leí el SQL del bean. Quien tenga el código lo confirma en un minuto.

### Defecto lateral, del mismo mecanismo

El combo **Vendedor** de Facturaciones ofrece **ARMANDO SUAREZ** (`id_user` 301, ROLE_PROMOTER), pero
el grid nunca devuelve sus facturas:

| Filtro | Pantalla | BD |
|---|---|---|
| Vendedor = ARMANDO SUAREZ (301, ROLE_PROMOTER) | **0** ❌ | **588** facturas |
| Vendedor = EDWIN HERRERA (304, ROLE_SALESMAN) | **847** ✅ | **847** facturas |
| sin vendedor | 3.693 | 4.474 |

El control con EDWIN HERRERA da 847 = 847 **al registro**, así que el método está validado: cuando
hay datos que mostrar, esta medición los muestra. Evidencia: `evidencia/ADMIN-12-inv-ARMANDO_SUAREZ.png`
y `ADMIN-12-inv-EDWIN_HERRERA.png`.

El combo de Facturaciones y el de Documentos de Venta **no coinciden**: el primero lista 11 vendedores
(los 10 con ROLE_SALESMAN + ARMANDO SUAREZ, promotor), el segundo lista 10 (solo los ROLE_SALESMAN).
Es decir, Facturaciones ofrece un vendedor que su propio grid no puede devolver.

---

## Punto 5 · Lo del detalle: ¿es por no estar atadas a una factura?

**Veredicto: la explicación de desarrollo no se sostiene, en sus dos mitades.**

### 5a · Cuántas están atadas y cuántas no

Atadura medida por `invoice.co_invoice = 'CJA-' || document_sale.nu_document` (el único vínculo que
existe: **no hay ninguna FK de `document_sale` a `invoice`**; `document_sale` no tiene `id_invoice`).

| Universo | Total | Con factura | Sin factura |
|---|---|---|---|
| Todos los `document_sale` | 8.470 | **4.326** (51,1 %) | **4.144** (48,9 %) |
| Solo los vivos (`co_operation='I'`) | 2.044 | **1.260** | **784** |

### 5b · ¿El detalle falla SOLO en las no atadas?

**No. No falla en ninguna de las dos — y no falla por eso.**

No se puede fallar en el detalle de un pendiente desde Facturaciones **porque no hay ni una sola fila
de pendiente que abrir**: el listado devuelve 0 en los dos roles. El detalle no llega a fallar; la
pantalla nunca llega a ofrecerlo.

Y donde sí se puede abrir el detalle de un documento — Datos Maestros → Documentos de Venta →
`Consultar`, que va a `/pages/detalleDocumento` — **funciona, atado o no atado, en los dos roles**:

| Documento | ¿Atado a factura? | Detalle ADMIN | Detalle GERENTE |
|---|---|---|---|
| `C0000104` (FACTURA, 70 USD) | **Sí** (`CJA-C0000104`) | abre completo | no medido |
| `40000105` (NOTA DE DEBITO, 1,75 USD) | **No** | **abre completo** | **abre completo** |

El detalle del no atado muestra Código, Cliente, Tipo, Fecha documento, Fecha vencimiento, Monto base,
Descuento, Impuestos, Monto total y Saldo. Evidencia: `evidencia/ADMIN-16-docdet-con-factura.png`,
`ADMIN-17-docdet-sin-factura.png`, `GERENTE-17-docdet-sin-factura.png`.

⇒ **"No están atadas a una factura" no es la causa.** Un documento sin factura abre su detalle sin
problema. Lo que falta no es la factura: es el **vendedor**.

### 5c · La segunda mitad: "`document_sale` no tiene campo vendedor"

**Inexacto, y confirmado con consulta propia en esta corrida.** El campo existe; lo que pasa es que
nunca se llena.

```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='document_sale' AND column_name='id_user';
-- -> id_user | integer        <- la columna EXISTE (es la última de la tabla)

SELECT count(*) AS filas, count(id_user) AS con_vendedor FROM document_sale;
-- -> 8470 | 0

SELECT count(*) AS filas, count(id_user) AS con_vendedor FROM invoice;
-- -> 4474 | 4474
```

| Tabla | Filas | Con `id_user` (vendedor) | % |
|---|---|---|---|
| `document_sale` | **8.470** | **0** | **0 %** |
| `invoice` | **4.474** | **4.474** | **100 %** |

**No es "no hay campo": es "el campo está y no se está llenando".** Y el vacío es total — no hay ni
una sola fila con vendedor, ni entre los 2.044 documentos vivos ni entre los 6.426 borrados
lógicamente (`co_operation='D'`).

Descartes, para que no quede duda de que lo único que falta es el vendedor: en `document_sale` están
pobladas al 100 % `id_client`, `id_currency`, `id_enterprise` y `id_document_sale_type`; el estatus es
único (`st_document_sale=6` en las 8.470); la empresa es única (`DIESE` en las 8.470); y las fechas
caen enteras dentro del rango consultado. La **única** FK vacía es `id_user`.

---

## Tabla resumen · rol × qué ve

| | **ADMIN** (ROLE_ADMIN) | **GERENTE** (`cobranza4k`, ROLE_COLLECTION) |
|---|---|---|
| Menú Transacciones → Facturaciones | ✅ visible y accesible | ✅ visible y accesible |
| Listado, filtro por defecto (mes en curso) | 0 (no hay datos de septiembre) | 0 (no hay datos de septiembre) |
| Listado **Consolidado** (rango completo) | ✅ 3.693 | ✅ 3.693 |
| Listado **Facturas cobradas** | ✅ 3.693 | ✅ 3.693 |
| Listado **Pendientes por cobrar** | ❌ **0** de 8.470 | ❌ **0** de 8.470 |
| Columnas del grid | las 12 | las 12, idénticas |
| Columna **Vendedor** en facturas | ✅ poblada | ✅ poblada |
| Columna **Vendedor** en pendientes | ❌ sin filas que mirar | ❌ sin filas que mirar |
| **Detalle** de factura con líneas | ✅ cabecera + 6 líneas | ✅ cabecera + 6 líneas |
| **Detalle** de factura sin líneas en BD | ⚠ tabla vacía (fiel al dato) | no medido |
| **Detalle** de documento (Datos Maestros) | ✅ atado y no atado | ✅ no atado |
| Combo Vendedor | 11 nombres | 11 nombres, los mismos |
| Filtro Vendedor = promotor (301) | ❌ 0 de 588 | no medido |
| Filtro Vendedor = vendedor (304) | ✅ 847 de 847 | no medido |

**No hay ni una diferencia por rol.** El fix del administrador cerró la asimetría que se reportó.

---

## Hallazgos

### H1 · Facturaciones · "Pendientes por cobrar" devuelve 0 de 8.470 · 🔴 Alto

**Reproducción mínima (2 pasos, cualquiera de los dos roles):**
1. Transacciones → Facturaciones. Fecha Inicio `01/01/2020`, Fecha Final `11/09/2026`.
2. Consolidado → **Pendientes por cobrar** → **Buscar**.

**Esperado:** las 8.470 filas de `document_sale` (o al menos las 2.044 vivas / 1.960 con saldo > 0).
**Obtenido:** `Total de Resultados: 0` · "No se encontraron registros."

**Oráculo:** `SELECT count(*) FROM document_sale` → **8.470**; y la propia web las muestra en
Datos Maestros → Documentos de Venta → **8.470** con esos mismos filtros.
**Causa medida:** `document_sale.id_user` vacío en 8.470/8.470, y la consulta ata por vendedor
(demostrado: en Documentos de Venta, añadir el filtro de vendedor pasa el mismo listado de 8.470 a 0).
**Evidencia:** `ADMIN-04-pendientes.png`, `GERENTE-13-Pendientes_por_cobrar.png`,
`ADMIN-14-documentos-venta.png`, `ADMIN-15-docventa-vend.png`.
**No es** un problema de permisos (los dos roles dan el mismo 0) ni de datos ausentes (están y se ven
en otra pantalla).

### H2 · Facturaciones · faltan 781 facturas por el rol del vendedor · 🟠 Medio

El listado muestra **3.693** de **4.474** facturas. Las 781 ausentes son las de `ROLE_PROMOTER` (588)
y `ROLE_SUPERVISOR` (193) — los roles con `role.selector = false`. Cuadra al registro.
**Evidencia:** `ADMIN-12-inv-todos.png` + Q3 de `sql/consultas.sql`.

### H3 · Facturaciones · el combo ofrece un vendedor cuyo grid nunca devuelve nada · 🟠 Medio

Vendedor = **ARMANDO SUAREZ** (301, ROLE_PROMOTER) → 0 resultados; BD tiene 588 facturas suyas.
Control con EDWIN HERRERA (304, ROLE_SALESMAN) → 847 = 847 en BD.
El combo de Documentos de Venta, en cambio, no lo ofrece (lista 10, no 11). Los dos combos deberían
usar el mismo criterio, o el grid aceptar lo que el combo ofrece.
**Evidencia:** `ADMIN-12-inv-ARMANDO_SUAREZ.png`, `ADMIN-12-inv-EDWIN_HERRERA.png`.

### H4 · Detalle de facturación · el "Subtotal" de cada línea repite el total de la factura · 🟡 Bajo · **es el dato, no la pantalla**

En `CJA-D0001623` las 6 líneas muestran `Subtotal: 595,00 USD`, que es el **total de la factura**, no
el subtotal de la línea (línea 1: 6 UNIDAD × 10,00 USD = 60,00).
**Comprobado en BD:** `invoice_detail.nu_amount_total = 595.0000` en las 6 filas. La pantalla está
renderizando fielmente un dato mal cargado por el integrador. **El arreglo no va en la web.**
**Evidencia:** `ADMIN-09-detalle-ok.png` + Q8 de `sql/consultas.sql`.

### H5 · Detalle de facturación · mojibake en "Responsable" · 🟡 Bajo

`Responsable: JOAN BRICE?O` (rombo) mientras que en la misma pantalla `Vendedor: JOAN BRICEÑO` sale
bien. Dos campos de la misma página con codificación distinta. Se ve también en el combo Cliente del
filtro (`CORPORACI?N INDUSTRIAL J & M`, `CAST, COMA?IA ANONIMA`).
**Evidencia:** `ADMIN-07-detalle-invoice.png`.
⚠ Puede ser dato mal grabado en origen y no render: **no lo comprobé en BD**. Si importa, se confirma
leyendo `invoice.na_responsible` y `client.na_client`.

---

## Lo que NO se pudo comprobar

- **El SQL real de la pantalla.** La causa (la consulta ata por vendedor) está demostrada por
  comportamiento — el experimento 8.470 → 0 al añadir el filtro de vendedor sobre la misma tabla — y
  por el cuadre exacto 3.693 = ROLE_SALESMAN. Pero **no leí el bean ni su consulta**: esta corrida es
  solo web + BD, y el repo de producto (`../src/`) está fuera de alcance por norma de la corrida.
- **Si el defecto es nuevo o viejo.** No hay medición previa de esta pantalla en el repo, así que no
  puedo decir si "Pendientes por cobrar = 0" es una regresión de esta release o si viene de antes.
- **Por qué `document_sale.id_user` no se llena.** Se midió que está vacío; no se investigó qué
  proceso debería llenarlo (integrador, sincronización del móvil, o carga inicial). Eso es de desarrollo.
- **Qué vería un vendedor (ROLE_SALESMAN) entrando a la web.** Solo se probaron los dos roles pedidos.
  Es el tercer caso interesante, porque es el único rol que sí tiene vendedor propio.
- **El detalle de una factura sin líneas en el rol GERENTE.** Se midió solo en ADMIN.
- **El origen del mojibake de H5** (dato vs. render): no consultado en BD.
- **Columnas ocultas.** El botón "Columnas" (`form:pedidosDT:togglerInvoices`) permite mostrar/ocultar
  columnas; no se abrió. Podría haber alguna columna extra por rol que no se vio.
- **`Exportar Reporte`** (`form:pedidosDT:j_idt161`): no se ejecutó, porque descarga un archivo y la
  corrida era de solo lectura sobre la pantalla.
- **Multi-empresa:** 4K tiene una sola empresa (`DIESE`), así que no se puede probar si el filtro de
  empresa cambia algo por rol.

---

## Patrones y selectores nuevos de la web

De estas pantallas no había nada documentado en el repo. Todo lo de abajo está medido en esta corrida
(playa CARIBE, 11/09/2026).

### Arranque de sesión web

`automation/playwright/qa-web-open.js` ya trae el patrón bueno y funcionó tal cual: Chrome con
`--remote-debugging-port`, `launchPersistentContext`, login inyectando las credenciales directo al
input. Para comparar roles conviene **una sesión por rol en puertos distintos** (9401 / 9402) y un
`userDataDir` distinto por rol — con el mismo perfil, la segunda sesión pisa la cookie de la primera.

- Login: `/pages/login.xhtml`. Los inputs son **ids generados por JSF** (`j_idt12` usuario,
  `j_idt14` clave): **cambian entre builds, no anclarse a ellos.** Usar
  `input[type="text"]:not([style*="display: none"])` y `input[type="password"]`.
- Tras el login se cae en `/pages/main`, que trae contenido de plantilla en inglés (Rain Clothing,
  Chicago USA, Products 12K…). Es el demo del tema, no datos del cliente: **ignorarlo**.

### Facturaciones · `/pages/facturaciones`

| Elemento | Selector | Nota |
|---|---|---|
| Empresa | `[id="form:j_idt116:idEnterprise_input"]` | en 4K una sola opción, `DIESE` |
| Código facturación | `[id="form:j_idt116:n_ref"]` | texto libre; espera el código **con prefijo** (`CJA-D0001623`) |
| Vendedor | `[id="form:j_idt116:idSalesmaView_input"]` | ⚠ el id dice `SalesmaView` (sin la `n`) |
| Cliente | `[id="form:j_idt116:clientSOM_input"]` | |
| Fecha Inicio / Final | `[id="form:j_idt116:dateB_input"]` / `dateF_input` | formato `dd/mm/aaaa`; por defecto, el mes en curso |
| Moneda | `[id="form:j_idt116:idCurrency_input"]` | `1`=Bs · `2`=USD |
| **Consolidado** (tipo de documento) | `[id="form:j_idt116:tipoDocumento_input"]` | `TODOS` / `INVOICE` / `DOCUMENT_SALE` |
| Buscar | `[id="form:j_idt116:ajax"]` | botón |
| Limpiar | `[id="form:j_idt116:botonLimpiar"]` | |
| Grid | `[id="form:pedidosDT"]` | `.ui-datatable`; página de 50 |
| Detalle de la fila *n* | `[id="form:pedidosDT:<n>:consultar"]` | **es un `<button>`, no un `<a>`** |
| Columnas | `[id="form:pedidosDT:togglerInvoices"]` | |
| Exportar Reporte | `[id="form:pedidosDT:j_idt161"]` | `a.ui-commandlink` |
| Total de filas | `document.body.innerText.match(/Total de Resultados:\s*\d+/)` | el `.ui-paginator-current` viene **vacío**: no sirve de oráculo |

El rótulo **"Consolidado"** del filtro no es un modo agregado: es el valor por defecto del selector de
**tipo de documento** (`TODOS`). Sus tres opciones son el eje de esta pantalla:
`TODOS` = Consolidado · `INVOICE` = Facturas cobradas (tabla `invoice`) ·
`DOCUMENT_SALE` = Pendientes por cobrar (tabla `document_sale`).

**Detalle:** `Consultar` **navega a otra página** (`/pages/detalleFacturacion`), no abre un diálogo.
No buscar `.ui-dialog`. Para volver, `pg.goto()` a `/pages/facturaciones`.

### Documentos de Venta · `/pages/documentos` (la pantalla de contraste)

| Elemento | Selector |
|---|---|
| Empresa | `[id="form:j_idt115:idEnterprise_input"]` |
| Vendedor | `[id="form:j_idt115:idSalesman_input"]` |
| Cliente | `[id="form:j_idt115:cliente_input"]` |
| Código documento | `[id="form:j_idt115:codDoc"]` — **sin prefijo** (`C0000104`, no `CJA-C0000104`) |
| Fechas | `[id="form:j_idt115:dateB_input"]` / `dateF_input` |
| Buscar | `[id="form:j_idt115:ajax"]` |
| Grid | `[id="form:tablaDoc"]` |
| Detalle fila *n* | `[id="form:tablaDoc:<n>:consultar"]` → navega a `/pages/detalleDocumento` |
| Vacío | `"No existe registro"` (⚠ **distinto** de Facturaciones, que dice `"No se encontraron registros."`) |

Es la pantalla de contraste natural para cualquier duda sobre `document_sale`: muestra la misma tabla
**sin** columna Vendedor, y por eso sí devuelve las 8.470 filas.

### 🔑 Tres trampas de método, todas costaron una medición falsa en esta corrida

1. **Los filtros son de sesión y sobreviven a `goto()`.** Los beans son de sesión: `n_ref`, el
   vendedor y el tipo **siguen puestos** aunque se recargue la página o se navegue al detalle y se
   vuelva. Dos mediciones mías salieron 0 por un `n_ref` y un vendedor que habían quedado de la
   medición anterior. **Antes de cada medición, fijar explícitamente los filtros: los que se usan y
   los que se quieren vacíos.**
2. **Elegir en un `selectOneMenu` dispara AJAX y repinta el panel, que reescribe las fechas con el
   valor del bean (el mes en curso).** ⇒ **El orden importa: primero los combos, después las fechas,
   al final Buscar.** Al revés, se busca sobre septiembre y sale 0.
3. **El texto de los ítems del combo no es el mismo en las dos pantallas.** En Facturaciones es
   `EDWIN HERRERA`; en Documentos de Venta es `V.0012 - EDWIN HERRERA`. Un `:text-is()` copiado de una
   pantalla a la otra falla en silencio y la medición sale sin filtro. **Listar las opciones antes de
   elegir.**

Patrón que funcionó para los `selectOneMenu` de PrimeFaces (clic en el label, clic en el ítem del
panel, esperar el AJAX):

```js
async function pick(base, label) {                 // base = id sin sufijo, p.ej. 'form:j_idt116:tipoDocumento'
  await pg.click(`[id="${base}_label"]`);          // abre el panel
  await pg.waitForTimeout(800);
  const el = await pg.$(`[id="${base}_panel"] li.ui-selectonemenu-item:text-is("${label}")`);
  if (!el) { console.log('NO-ITEM ' + label); return false; }   // <- nunca dar por hecho que estaba
  await el.click();
  await pg.waitForTimeout(1600);                   // el AJAX repinta el panel de filtros
  return true;
}
// Verificar SIEMPRE contra el <select> real, que es lo que se envía:
// document.getElementById(base + '_input').value
```

⚠ **Escapar los ids de JSF.** Llevan `:`, que en CSS es un selector de pseudoclase. Usar
`[id="form:pedidosDT"]` (atributo) en vez de `#form\:pedidosDT` — el escape con backslash se pierde
con facilidad al pasar el script por heredocs de shell y el error que sale
(`... is not a valid selector`) no dice que el problema sea ése.

### Modelo de datos útil para futuras corridas de esta pantalla

- **No existe FK de `document_sale` a `invoice`.** El único vínculo es por código:
  `invoice.co_invoice = 'CJA-' || document_sale.nu_document`. El prefijo `CJA-` es el único que hay en
  las 4.474 facturas de 4K; en otro tenant habrá que mirarlo.
- `document_sale` **no tiene** columna `co_user`; el vendedor es solo `id_user` (integer). `invoice`
  tiene las dos (`co_user` + `id_user`), pobladas al 100 %.
- `role.selector` (boolean) es la marca de "rol seleccionable como vendedor". En 4K solo la tienen
  `ROLE_SALESMAN` y `ROLE_TRANSPORT`. **Es la clave para predecir qué va a listar la pantalla**, y el
  cuadre 3.693 lo confirma.
- `document_sale.co_operation`: `I` = viva (2.044), `D` = borrada lógicamente (6.426). La pantalla de
  Documentos de Venta **muestra las 8.470, borradas incluidas** — ojo al usarla de oráculo.
