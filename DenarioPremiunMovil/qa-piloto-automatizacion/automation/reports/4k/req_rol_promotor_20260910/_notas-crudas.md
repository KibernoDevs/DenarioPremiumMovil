# Notas crudas (insumo del informe) — no es el entregable

## Paso 0 · build
- bundle vivo `http://localhost/main.js` (5.362.096 chars): `promoterHideFinance` presente, 6 ocurrencias.
- Módulo `./src/app/guards/promoter-hide-finance.guard.ts` exporta `isPromoterHideFinanceActive` + `promoterHideFinanceGuard`.
- `isPromoterHideFinanceActive(config)` = `user.promotor` (de localStorage `user`) && `config.get('promoterHideFinance').toLowerCase()==='true'`.
- `ClientLogicService.isFinanceHiddenForUser` usa el mismo helper; `canShowConversion()` devuelve false si está activo.
- `SynchronizationComponent`: `TABLAS_FINANZAS_PROMOTOR = [2,6,20,56,57,58,65,68,76,83]`, comentario
  "Omitidas por WS si promoterHideFinance: Bank, docs, invoices, cobros, depósitos".
  Se aplica en 3 puntos: filtro de `tableKeyOrder` (x2) y `shouldSyncTable()` → `return false`.

## Estado de la variable al arrancar
- Nube `global_configuration` id_config 253 `promoterHideFinance` = **'true'** (da_update 2026-09-07T17:38:46Z).
- Audit id 240: admin la puso false→true el 07/09. No hubo cambios posteriores.
- ⚠ Audit 275-277: admin tocó multiCurrencyOrder/multiCurrencyCollection HOY 10/09 20:11-20:15Z (16:11-16:15 local),
  ~1h20 antes de esta corrida. No es concurrente, pero hubo otra persona en la pantalla hoy.

## Guarda de empresa/usuario (verificada en el equipo)
- localStorage `user`: idUser 301 · coUser **V.0017** · naUser "ARMANDO  SUAREZ" · **promotor: true** · catalogo false · transportista false.
- `enterprises` local: 1 fila — co_enterprise **DIESE**, na_enterprise **GRUPO 4K**, lb DIESEL, rif J401702600. ✅ tenant correcto.
- localStorage `globalConfiguration` contiene `["promoterHideFinance","true"]` ⇒ la VG llegó al equipo.

## Estado del equipo al arrancar
- App SIN datos previos: `run-as ... ls databases/` → No such file or directory; localStorage solo connectionType/versionApp/connected.
  ⇒ el primer login del promotor es un baseline LIMPIO para medir qué baja.

## DM-PRO-030 · qué bajó al equipo tras el login+sync (VG ENCENDIDA)
Conteos en la SQLite local (`window.sqlitePlugin`, base `denarioPremium`):
| tabla local | filas |
|---|---|
| document_sales | **0** |
| invoices | **0** |
| invoice_details | **0** |
| invoice_detail_units | **0** |
| collections | **0** |
| collection_details | **0** |
| collection_payments | **0** |
| deposits | **0** |
| deposit_collects | **0** |
| banks | **0** |
| bank_accounts | **0** |
| client_bank_accounts | **0** |
| collect_retentions | **0** |
| collect_discounts | **0** |
| — controles — | |
| clients | 83 |
| address_clients | 83 |
| products | 1432 |
| stocks | 4425 |
| price_lists | 1432 |
| orders | 32 |
| warehouses | 5 |
| enterprises | 1 |
| global_configuration | 184 |

- `versionsTables`: `bankTable.last_update = 1970-01-01 00:00:00.000` ⇒ **nunca se sincronizó**.
  (`clientTable` sí: 2026-09-10 15:17:09; `addressClientTable`: 2026-09-08 13:10:57)

### Límite de crédito — el contraste que lo prueba
| co_client | nu_credit_limit NUBE | nu_credit_limit EQUIPO |
|---|---|---|
| C.0017 CUMMINS DIESEL PARTS | 1000.0000 | **0** |
| C.0024 REPUESTOS FIAT LARA | 1500.0000 | **0** |
| C.0057 MULTISERVICIOS LAR | 2500.0000 | **0** |
| C.0125 AUTO PARTES MUNDIAL | 8000.0000 | **0** |
| C.0150 AUTOCAMIONES DAILYFORD | 12000.0000 | **0** |
| C.0155 INV. REPUESTOS DOBLE V | 500.0000 | **0** |
Nube global: 1110 clientes, 905 con crédito > 0, máx 23.000 ⇒ el 0 del equipo NO es un dato plano del tenant.
⇒ el límite de crédito se **anula en origen (WS)**, no se oculta en la UI.
(De paso, este cotejo confirma que la BD que lee `query.js 4k` ES el mismo tenant que sirve la playa: nombres y códigos coinciden.)

## Menú con la VG ENCENDIDA (DM-PRO-010)
`app-home p.nombreModulos` visibles = ["Visitas","Inventarios","Pedidos","Productos","Clientes","Sincronizar"] (6).
Texto completo de app-home: "VisitasInventariosPedidosProductosClientesSincronizarSalir…" ⇒ sin Cobros, Devoluciones, Depósitos, Vendedores.

## Bloque B · UI de CLIENTES con la VG ENCENDIDA
- **Listado** (`app-client-list`, 50 ítems cargados de 83): cada `ion-item` trae SOLO
  `<p>{na_client}</p><p>Código: {co_client}</p>` + chevron. Antes del primer `<p>` hay un
  `<!---->` (el `*ngIf` del saldo, en false). **Sin saldo.**
- **Color:** los 16 nodos de texto de los primeros 8 ítems dan `getComputedStyle(...).color`
  = `rgb(102,102,102)` **todos iguales**; ninguna clase de color. **Sin indicador de color.**
- **Ficha** (`app-client-detail`, C.0017): Empresa DIESEL · Nombre · Lista de Precio PRECIO 1 ·
  RIF · Contacto · Email · Teléfono · Condición de Pago 21 DIAS · Dirección · Descripción 1/2 ·
  Coordenada. **Ni Saldo, ni Límite de crédito, ni Crédito disponible.**
- **Segmentos de la ficha:** uno solo, `Detalle` (value="default"). **No existe la pestaña
  Documentos de venta.**
- **Buscador:** solo icono `search-circle-sharp` (busca por nombre/código). **Cero `ion-select`
  y cero `ion-button` visibles** en el listado ⇒ no hay control de orden/filtro por saldo.
- **Barrido léxico:** `document.body.innerText` NO contiene ninguna de
  saldo/Saldo/crédito/Crédito/credito/factura/Factura/deuda/Deuda/vencid/Vencid/cobro/Cobro/
  documento/Documento. Lista → 0 coincidencias.

## DM-PRO-031 · modelo de Angular (`window.ng` = true)
`ng.getComponent(app-client-list)` → `ClientListComponent`.
- `comp.clientLogic.isFinanceHiddenForUser` = **true**
- `comp.clientLogic.canShowConversion()` = **false**
- `comp.clientLogic.clients` (50) y `comp.service.clientes` (50) SÍ traen las CLAVES
  `saldo1, saldo1Conver, saldo2, saldo2Conver, nuCreditLimit, daDocument, daDueDate,
   countDueDate, colorRow` — es la forma del DTO.
- **Los VALORES, sobre los 50:** `saldo1>0` → **0 clientes** · `saldo2>0` → **0** ·
  `nuCreditLimit>0` → **0** · `colorRow` valores distintos = `[""]` ·
  `countDueDate` distintos = `["0"]` · `daDueDate` distintos = `["null"]`.
⇒ el saldo **no viaja en el modelo**: las claves existen (DTO) pero llegan en 0/null/"".

## Bloque C · Pedidos (VG ENCENDIDA)
- Menú Pedidos accesible; landing con 3 tiles: **PEDIDO · BUSCAR · COPIAR**.
- Formulario `app-pedido`: 4 pestañas **General · Pedido · Total · Adjunto**. **No hay pestaña
  de Documentos** ni ningún selector de facturas/documentos pendientes en ninguna de las 4.
- General: Empresa DIESEL · Cliente · **Información de Cliente** (botón) · Moneda Bs/USD ·
  Tasa 870,00 · Sucursal FISCAL (autollenada) · Tipo Pedido · Lista de Precio PRECIO 1 ·
  Nº Orden · Fecha Pedido/Despacho · Responsable · Comentario · Condición de pago · Por Aprobar.
- **Modal «Información de Cliente»** (el candidato más obvio a puerta trasera): Empresa · Cliente ·
  Código · Lista de Precio · RIF · Contacto · E-Mail · Teléfono · Condición de pago · Dirección.
  **Sin saldo, sin crédito, sin documentos.** Barrido léxico sobre el modal → 0 coincidencias.
- **DM-PRO-023:** los precios SÍ se ven — "Precio: 13,50 USD", "Precio Lista USD 13,50 / Bs 11.745,00",
  "Total Pedido USD 40,50 / Bs 35.235,00". Correcto: es precio, no financiero del cliente.
- **DM-PRO-022:** en el bundle, `setClientfromSelector(cliente, skipDebtValidation, ...)` condiciona la
  validación de deuda a `!skipDebtValidation && !this.clientLogic.isFinanceHiddenForUser && ...`
  ⇒ con la VG activa **la validación de deuda no corre**. Medido: al elegir C.0017 **no salió
  ninguna alerta**, y el pedido de 40,50 USD (contra `nu_credit_limit` local = 0) **pasó sin
  bloqueo y sin mencionar crédito ni deuda**. ⇒ *deja pasar, sin filtrar el dato*.

### Pedido creado y ENVIADO
| Dato | Valor |
|---|---|
| `co_order` | `1789076633777.0` |
| `id_order` (Ref) | **2593** (baseline max era 2592) |
| Cliente | C.0017 CUMMINS DIESEL PARTS, C.A. |
| Producto | `1R1807-4K` FILTRO DE ACEITE CATERPILLAR 3116 · 3 UNIDAD · 13,50 USD |
| Total | 40,50 USD / 35.235,00 Bs (tasa 870,00) |

- **Local:** `orders` id 2593, `st_delivery = 1` (enviado) · `pending_transactions` 0 · `failed_transactions` 0.
- **Nube (oráculo):** `order` id 2593 · `co_order 1789076633777.0` · `co_client C.0017` ·
  **`id_user 301` / `co_user 'V.0017'`** (el promotor, vendedor correcto) · `nu_amount_total 40.5000` ·
  `nu_amount_final 40.5000` · `st_order 1` · `co_enterprise DIESE` · `da_order 2026-09-10T21:47:27Z`.
- **Nube, línea:** `order_detail` 17794 · `co_product 1R1807-4K` · `nu_price_base 13.5000` ·
  `nu_amount_total 40.5000` · `nu_amount_total_conversion 35235.0000` · `co_enterprise DIESE`.
⇒ **BD-OK.** Llega completo y con el vendedor correcto.

### Playa confirmada empíricamente
El POST del pedido salió a `http://denariocaribe.ddns.net:8081/PremiumWS/services/orderservice/order`
⇒ playa **CARIBE**, no asumida. Y el pedido aparece en la base que lee `query.js 4k` ⇒ esa BD
sirve a esta playa (además del cotejo de nombres/códigos de cliente).

## Observación D-030b · la app SÍ pide documentSale, pero no baja nada
Entre los `getsync` capturados aparece uno con `{"documentSaleTableLastUpdate":"1970-01-01 00:00:00.000","page":0}`.
Es decir: **la petición se emite**. Sin embargo, tras ella:
- `document_sales` sigue en **0 filas**;
- `versionsTables.documentSaleTable.last_update` sigue en **1970-01-01 00:00:00.000** (no avanzó).
Igual para invoiceTable / collectionTable / depositTable / bankTable: todas en 1970.
⚠ **No comprobado en esta corrida:** si el servidor responde vacío o responde con filas que la app
descarta. No capturé la RESPUESTA, solo la petición. El resultado observable (0 filas, cursor sin
avanzar) es el mismo en ambos casos, pero la garantía NO es la misma. Pendiente de capturar el body
de la respuesta para cerrarlo.

## Bloque E · la variable en sí

### DM-PRO-040 · «Sincronizar» NO baja la variable — 4.ª medición
1. Nube conmutada a `false` (audit **id 278**, 2026-09-10T21:53:45Z; `global_configuration.valor='false'`).
2. En el equipo, HOME → **Sincronizar** → alerta «¿Desea Sincronizar?» [Cancelar, Aceptar] → Aceptar.
3. La sync recorrió **49 tablas** y terminó normal.
4. **Tras la sync:** `localStorage.globalConfiguration` seguía con `["promoterHideFinance","true"]`
   y el menú seguía con los mismos **6** módulos. ⇒ **CONFIRMADO: sincronizar no basta.**

🔑 **Detalle valioso de esa sync (respuestas capturadas, 49/49 `status 200`):** las tablas pedidas fueron
addressClient · client · distributionChannel · documentSaleType · enterprise · incidenceMotive ·
incidenceType · priceList · product · returnMotive · returnType · list · stock · discount ·
paymentCondition · productUnit · visit · ivaList · warehouse · globalDiscount · clientBankAccount ·
productMinMulFav · userInformation · currencyEnterprise · currencyRelation · conversionType ·
typeProductStructure · productStructure · unit · orderType · userProductFav · clientAvgProduct ·
igtfList · status · transactionType · order · return · clientStock · transactionStatus · orderDetail ·
orderDetailUnit · orderDetailDiscount · conversion · module · currencyModule · differenceCode ·
typeDocument · codePhoneNumber · bonus.
**NO aparecen `documentSaleTable`, `invoiceTable`, `collectionTable`, `depositTable` ni `bankTable`.**
⇒ el filtro `TABLAS_FINANZAS_PROMOTOR` del `SynchronizationComponent` se aplica de verdad.

### DM-PRO-041 · con login nuevo sí llega
Salir → login `V.0017zonaoccidente` → HOME.
- `localStorage.globalConfiguration` → `["promoterHideFinance","false"]` ✅
- `user.promotor` sigue `true`, `coUser V.0017`.

## Bloque A · con la variable APAGADA (login nuevo, mismo usuario, mismo equipo)

### 🔴 DM-PRO-001 / DM-PRO-006 · el menú
Menú medido: **Visitas · Inventarios · Pedidos · Devoluciones · Cobros · Depósitos · Vendedores ·
Productos · Clientes · Sincronizar** (10 rótulos + 2 entradas de texto vacío).
⇒ **Cobros, Devoluciones y Depósitos SÍ aparecen** con la variable apagada.
El guión (DM-PRO-006) esperaba que estuvieran **ausentes en los dos estados**. **No es así.**

### 🔑 Respuesta a la pregunta abierta del §1
| Módulo | VG ENCENDIDA | VG APAGADA |
|---|---|---|
| Visitas · Inventarios · Productos · Clientes · Sincronizar | ✔ | ✔ |
| **Pedidos** | **✔** | **✔** |
| Cobros · Devoluciones · Depósitos · Vendedores | ✘ | **✔** |
⇒ **Pedidos está en LOS DOS estados** ⇒ la variable **NO habilita Pedidos**; eso viene por otra vía
(rol/permisos). La variable **solo QUITA** módulos. Son cosas **independientes**.
⚠ Esto corrige la premisa con la que se me lanzó la corrida («la variable gobierna el menú, Pedidos
incluido»): gobierna el menú, sí, pero **restando**; Pedidos ya estaba.

### DM-PRO-002 / DM-PRO-003 · el contraste que valida el Bloque B
Mismo equipo, mismo usuario, misma pantalla; lo único que cambió es la variable.
| Señal | VG ENCENDIDA | VG APAGADA |
|---|---|---|
| Listado, texto del ítem | `CUMMINS DIESEL PARTS, C.A. / Código: C.0017` | `… / Saldo USD: 3.129,00 / Saldo Bs: 2.722.230,00` |
| Color del saldo | no hay nodo de saldo; todo `rgb(102,102,102)` | **`style="color: red;"` → `rgb(255,0,0)`** en morosos y **`rgb(0,0,255)`** (azul) en saldo 0 |
| `clientLogic.isFinanceHiddenForUser` | `true` | `false` |
| `clients[].saldo1 > 0` (de 50) | **0** | **30** |
| `clients[].countDueDate` distintos | `["0"]` | `["2","1","10","6","0","3"]` |
| Segmentos de la ficha | `Detalle` | `Detalle` + **`Doc. de Venta`** (con leyenda «Documento vigente / Documento vencido») |
| Ficha, bloque financiero | ausente | `Saldo USD: 3.129,00` · `Saldo Bs: 2.722.230,00` · `Crédito USD: 0,00` · `Crédito Disp. USD: -3.129,00` · `Crédito Bs` · `Crédito Disp. Bs` |
⇒ DM-PRO-002 ✅ · DM-PRO-003 ✅ · y queda probado que lo del Bloque B es la variable, no falta de datos.

### 🔑 DM-PRO-030 · el contraste definitivo en la BD local
Mismo equipo, mismo usuario; solo cambió la variable y se volvió a entrar.
| tabla local | VG ENCENDIDA | VG APAGADA |
|---|---|---|
| `document_sales` | **0** | **195** |
| `invoices` | **0** | **312** |
| `collections` | **0** | **24** |
| `banks` | **0** | **33** |
| `bank_accounts` | **0** | **7** |
| `collect_discounts` | **0** | **2** |
| `deposits` | 0 | 0 (el vendedor no tiene) |
| `clients` (control) | 83 | 83 |
| `versionsTables.documentSaleTable` | `1970-01-01` | `2026-08-19 09:20:43` |
| `versionsTables.bankTable` | `1970-01-01` | `2026-09-04 19:17:19` |
| `versionsTables.invoiceTable` | `1970-01-01` | `2026-08-19 09:21:16` |
⇒ **RESPUESTA: los documentos y saldos NO bajan al equipo con la variable encendida.**
La garantía es de **sincronización**, no solo de UI. El dato no está en el teléfono.

### ⚠ CORRECCIÓN a mi propia lectura anterior sobre el límite de crédito
En el Bloque B anoté que `nu_credit_limit` llegaba en 0 mientras la nube tiene valores reales, y lo
atribuí a la variable. **Con la variable APAGADA sigue en 0 en los 83 clientes** (y la ficha muestra
`Crédito USD: 0,00`). Como el cursor `clientTable` **no retrocedió**, las filas de cliente **no se
volvieron a descargar**, así que no puedo separar «el WS anula el crédito al promotor» de «el crédito
no baja nunca en este build/usuario». **NO COMPROBADO** — se decide en el Bloque F, con un usuario
distinto cuyas filas sí bajan de cero.
