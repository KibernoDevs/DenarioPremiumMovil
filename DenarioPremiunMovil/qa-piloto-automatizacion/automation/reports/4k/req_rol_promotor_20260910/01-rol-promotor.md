# REQ · Rol PROMOTOR y la información financiera — IMPORTADORA 4K

| Parámetro | Valor |
|---|---|
| RUN_DIR | `automation/reports/4k/req_rol_promotor_20260910/` |
| Fecha | 2026-09-10 (17:35 – 18:05 local, UTC-4) |
| Cliente | `4k` · empresa **DIESE / GRUPO 4K** (`enterprises` local: 1 fila, rif J401702600) |
| Playa | **CARIBE** — `denariocaribe.ddns.net:8081`, **confirmada desde el host del POST del pedido**, no asumida |
| Dispositivo | Infinix X6728 · `14678405BR003855` · `com.kiberno.denarioPremiumPro` |
| Usuario probado | `V.0017zonaoccidente` → `idUser 301` · `coUser V.0017` · **ARMANDO SUAREZ** · `promotor: true` |
| Usuario de control | `V.0002zonacentral` → `idUser 300` · `coUser V.0002` · **ANGEL BETANCOURT** · `promotor: false` |
| Variable | `promoterHideFinance` (`global_configuration` id_config **253**) |
| Resultado | **17 PASS · 2 FAIL · 1 N/A · 6 no comprobados** |

> Todo lo de abajo se midió **en esta corrida**. Nada heredado.
> El equipo arrancó **sin BD** (`run-as … ls databases/` → *No such file or directory*), así que el primer
> login del promotor fue un **baseline limpio**: lo que hay en la BD local es exactamente lo que bajó.

---

## Paso 0 · la build trae el soporte ✅

`fetch('http://localhost/main.js')` desde el WebView (5.362.096 chars):

- `promoterHideFinance` aparece **6 veces**.
- Existe `./src/app/guards/promoter-hide-finance.guard.ts`, que exporta `isPromoterHideFinanceActive` y
  `promoterHideFinanceGuard`.
- La condición es la doble esperada:
  ```js
  return promotor && (config.get('promoterHideFinance') || '').toLowerCase() === 'true';
  ```
  con `promotor` leído de `JSON.parse(localStorage.getItem('user')).promotor`.
- `ClientLogicService.isFinanceHiddenForUser` usa ese helper; `canShowConversion()` devuelve `false` si está activo.
- 🔑 `SynchronizationComponent` declara
  `TABLAS_FINANZAS_PROMOTOR = [2, 6, 20, 56, 57, 58, 65, 68, 76, 83]` con el comentario
  *«Omitidas por WS si promoterHideFinance: Bank, docs, invoices, cobros, depósitos»*, y lo aplica en
  **tres** puntos (filtro de `tableKeyOrder` ×2 y `shouldSyncTable() → return false`).

⇒ La APK es la correcta. Se puede medir.

**Guarda de empresa/usuario, verificada en el equipo antes de leer la BD:** `enterprises` = 1 fila
`co_enterprise DIESE` / `na_enterprise GRUPO 4K`; `user.coUser = V.0017`; `user.promotor = true`;
`localStorage.globalConfiguration` contiene `["promoterHideFinance","true"]`.

---

## 🔑 La pregunta abierta del §1, respondida

**Pedidos y «ocultar lo financiero» son INDEPENDIENTES.**

| Módulo | VG **ENCENDIDA** | VG **APAGADA** |
|---|:--:|:--:|
| Visitas · Inventarios · Productos · Clientes · Sincronizar | ✔ | ✔ |
| **Pedidos** | **✔** | **✔** |
| Cobros · Devoluciones · Depósitos · Vendedores | ✘ | ✔ |

**Pedidos aparece en los dos estados** ⇒ la variable **no habilita Pedidos**; eso viene por otra vía
(rol/permisos). Lo único que hace la variable con el menú es **restar** los cuatro módulos financieros.

⚠ Esto **corrige la premisa** con la que se lanzó la corrida («la variable gobierna el menú, Pedidos
incluido»). El filtro `home.page.ts:242` a los índices `0,1,2,7,8,10` describe **el menú resultante
cuando la variable está activa**, no que la variable encienda Pedidos.

---

## 🔑 ¿Los documentos y saldos BAJAN al equipo? — **NO**

Es la pregunta que más importaba, y la respuesta es la garantía **fuerte**: no es que se oculten en la
UI, es que **no se sincronizan**. Contraste sobre el **mismo equipo y el mismo usuario**, cambiando solo
la variable y volviendo a entrar:

| tabla local (SQLite `denarioPremium`) | VG ENCENDIDA | VG APAGADA |
|---|:--:|:--:|
| `document_sales` | **0** | **195** |
| `invoices` | **0** | **312** |
| `collections` | **0** | **24** |
| `banks` | **0** | **33** |
| `bank_accounts` | **0** | **7** |
| `collect_discounts` | **0** | **2** |
| `collect_retentions` | 0 | 0 |
| `deposits` | 0 | 0 *(este vendedor no tiene)* |
| — controles — | | |
| `clients` | 83 | 83 |
| `products` | 1432 | — |
| `stocks` | 4425 | — |
| `orders` | 32 | — |

Y los **cursores de sincronización** lo confirman (`versionsTables.last_update`):

| tabla | VG ENCENDIDA | VG APAGADA |
|---|---|---|
| `bankTable` | `1970-01-01 00:00:00.000` | `2026-09-04 19:17:19.027` |
| `documentSaleTable` | `1970-01-01 00:00:00.000` | `2026-08-19 09:20:43.248` |
| `invoiceTable` | `1970-01-01 00:00:00.000` | `2026-08-19 09:21:16.481` |
| `collectionTable` | `1970-01-01 00:00:00.000` | `2026-09-10 16:56:15.377` |
| `depositTable` | `1970-01-01 00:00:00.000` | `2026-09-10 16:02:33.449` |
| `clientTable` (control) | `2026-09-10 15:17:09.113` | igual |

**`1970-01-01` = nunca se sincronizó.** El dato **no está en el teléfono**.

Refuerzo independiente: en la sync completa desde HOME se capturaron las **49** peticiones `getsync`
(todas `status 200`) y la lista **no incluye** `documentSaleTable`, `invoiceTable`, `collectionTable`,
`depositTable` ni `bankTable`.

### Y el límite de crédito viene **anulado en origen**

| co_client | `nu_credit_limit` NUBE | equipo · promotor VG ON | equipo · vendedor normal VG ON |
|---|---:|---:|---:|
| C.0017 CUMMINS DIESEL PARTS | 1.000 | **0** | — |
| C.0024 REPUESTOS FIAT LARA | 1.500 | **0** | — |
| C.0057 MULTISERVICIOS LAR | 2.500 | **0** | — |
| C.0125 AUTO PARTES MUNDIAL | 8.000 | **0** | — |
| C.0150 AUTOCAMIONES DAILYFORD | 12.000 | **0** | — |
| C.0010 EURO REPUESTOS FIOVAL | 9.000 | — | **9.000** |
| **Resumen** | 1110 clientes · **905 con crédito > 0** · máx 23.000 | 83 clientes · **0 con crédito** · máx 0 | 78 clientes · **77 con crédito** · máx 15.000 |

El vendedor normal, **con la variable encendida**, sí recibe los límites reales. Mismo build, mismo
equipo, misma sesión: lo único que cambia es el rol. ⇒ **el WS anula `nu_credit_limit` para el promotor.**

---

## Bloque A · variable APAGADA (no-regresión)

Login nuevo de `V.0017zonaoccidente` con `promoterHideFinance = false` verificado en el equipo.

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-001 | ✅ PASS | Menú: Visitas · Inventarios · Pedidos · Devoluciones · Cobros · Depósitos · Vendedores · Productos · Clientes · Sincronizar. Los «de siempre» están todos, y Pedidos también |
| DM-PRO-002 | ✅ PASS | Ficha C.0017: `Saldo USD: 3.129,00` · `Saldo Bs: 2.722.230,00` · `Crédito USD: 0,00` · `Crédito Disp. USD: -3.129,00`; aparece el segmento **`Doc. de Venta`** con la leyenda «Documento vigente / Documento vencido» |
| DM-PRO-003 | ✅ PASS | Listado: `Saldo USD: 3.129,00` con `style="color: red;"` → `rgb(255,0,0)` en morosos y `rgb(0,0,255)` (azul) en saldo 0. Modelo: 30/50 con `saldo1 > 0`, `countDueDate` = 2,1,10,6,0,3 |
| DM-PRO-004 | ⬜ no comprobado | Ciclo de visita completo — no alcanzó el tiempo |
| DM-PRO-005 | ⬜ no comprobado | Inventario — no alcanzó el tiempo |
| DM-PRO-006 | ❌ **FAIL** | ver abajo |

### ❌ FAIL 1 — DM-PRO-006 · con la variable apagada, el promotor VE Cobros, Devoluciones y Depósitos

**Esperado por el guión:** módulos que el promotor **nunca** tuvo ⇒ ausentes **también** con la variable apagada.
**Medido:** presentes, y además **Vendedores**.

**Reproducción mínima**
1. Web → Empresa → Variables Globales → Empresa → fila «¿Ocultar información financiera al rol Promotor?» → **NO** → **Guardar**.
2. En el equipo: Salir → entrar con `V.0017zonaoccidente` (rol Promotor).
3. Leer los rótulos del menú de HOME.

**Evidencia** — `app-home p.nombreModulos` visibles:
`["Visitas","Inventarios","Pedidos","Devoluciones","Cobros","Depósitos","Vendedores","Productos","Clientes","","Sincronizar",""]`
(con la variable encendida, el mismo selector devuelve exactamente 6 rótulos).

**Por qué importa:** implica que **lo único** que le esconde lo financiero al rol Promotor es esta
variable. No hay una restricción de menú propia del rol por debajo. Si alguien apaga la variable
—o la crea en `false` en un tenant nuevo— el promotor queda con el menú completo de un vendedor,
Cobros incluido.

⚠ **Lo que este FAIL NO prueba:** no sé si «el promotor veía solo 5 módulos» era cierto en alguna
versión anterior. Solo mido esta build. Si el comportamiento previo ya era éste, entonces no es una
regresión sino que **el guión parte de una premisa equivocada** — y habría que corregir el guión, no el
código. **Conviene confirmarlo a mano con desarrollo antes de abrir defecto.**

*(Detalle menor: el menú devuelve 12 entradas, 2 de ellas con texto vacío, en los dos estados. Cosmético; no lo levanto como defecto.)*

---

## Bloque B · variable ENCENDIDA (lo que debe desaparecer)

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-010 | ✅ PASS | Menú = exactamente **Visitas · Inventarios · Pedidos · Productos · Clientes · Sincronizar** (6). Texto completo de `app-home`: «VisitasInventariosPedidosProductosClientesSincronizarSalir…». Ni Cobros, ni Devoluciones, ni Depósitos, ni Vendedores |
| DM-PRO-011 | ✅ PASS | Ficha C.0017: Empresa · Nombre · Lista de Precio · RIF · Contacto · Email · Teléfono · Condición de Pago · Dirección · Descripción 1/2 · Coordenada. **Sin Saldo, sin Crédito, sin Crédito Disp.** |
| DM-PRO-012 | ✅ PASS | Ítem del listado = `<p>{nombre}</p><p>Código: …</p>` y un `<!---->` donde iría el saldo (`*ngIf` en false). Los 16 nodos de texto de los 8 primeros ítems dan `color: rgb(102,102,102)` **idéntico**. **Sin saldo y sin color** |
| DM-PRO-013 | ✅ PASS | La ficha trae **un solo** `ion-segment-button`: `Detalle` (value `default`). El segmento **`Doc. de Venta` no existe**. Con la variable apagada, la misma ficha sí lo trae ⇒ el contraste es la variable |
| DM-PRO-014 | ✅ PASS *(parcial)* | Cobros ausente del menú. Sin puerta trasera desde la ficha ni desde el pedido (ver Bloque C). **La ruta «desde la visita» no se probó** |
| DM-PRO-015 | ⬜ no comprobado | Resumen de la visita — no alcanzó el tiempo |

**Barrido léxico** sobre `document.body.innerText` en el módulo Clientes con la variable encendida
(listado y ficha): **0 coincidencias** de
saldo / Saldo / crédito / Crédito / credito / factura / Factura / deuda / Deuda / vencid / Vencid /
cobro / Cobro / documento / Documento.

---

## Bloque C · Pedidos

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-020 | ✅ PASS | Pedido creado y **enviado**; llegó a la nube. Detalle abajo |
| DM-PRO-021 | ✅ PASS | El formulario tiene 4 pestañas —**General · Pedido · Total · Adjunto**— y **ninguna** ofrece facturas ni documentos pendientes. No existe selector de documentos dentro del pedido |
| DM-PRO-022 | ✅ PASS *(con reserva)* | **Deja pasar y no nombra el crédito.** En el bundle, `setClientfromSelector(cliente, skipDebtValidation, …)` condiciona la validación de deuda a `!skipDebtValidation && !this.clientLogic.isFinanceHiddenForUser && …` ⇒ con la VG activa **no corre**. Medido: al elegir C.0017 **no salió ninguna alerta**, y el pedido de 40,50 USD se envió sin bloqueo ni mención de crédito/deuda. ⚠ **Reserva:** en el equipo `nu_credit_limit` llega en 0, así que «superar el límite» es trivialmente cierto; **no es un caso fuerte** |
| DM-PRO-023 | ✅ PASS | Precios visibles: `Precio: 13,50 USD`, `Precio Lista USD 13,50 / Bs 11.745,00`, `Total Pedido USD 40,50 / Bs 35.235,00`, `Tasa: 870,00 Bs = 1,00 USD`. Correcto: es precio, no financiero del cliente |
| — descuentos | 🚫 N/A | `userCanSelectProductDiscount=false` y `userCanSelectGlobalDiscount=false` en este tenant ⇒ no hay descuentos que mostrar |
| DM-PRO-024 | ✅ PASS | Llega completo y con el vendedor correcto |

### El pedido, de punta a punta

| Dato | Valor |
|---|---|
| `co_order` | `1789076633777.0` |
| **Ref (`id_order`)** | **2593** (baseline `max(id_order)` = 2592) |
| Cliente | C.0017 CUMMINS DIESEL PARTS, C.A. |
| Producto | `1R1807-4K` FILTRO DE ACEITE CATERPILLAR 3116 · 3 UNIDAD · 13,50 USD |
| Total | 40,50 USD / 35.235,00 Bs |

- **Local:** `orders` id 2593, **`st_delivery = 1`** (enviado) · `pending_transactions` **0** · `failed_transactions` **0**.
- **Nube (oráculo):** `order` id 2593 · `co_order 1789076633777.0` · `co_client C.0017` ·
  **`id_user 301` / `co_user 'V.0017'`** · `nu_amount_total 40.5000` · `nu_amount_final 40.5000` ·
  `st_order 1` · `co_enterprise DIESE` · `da_order 2026-09-10T21:47:27Z`.
- **Nube, línea:** `order_detail 17794` · `co_product 1R1807-4K` · `nu_price_base 13.5000` ·
  `nu_amount_total 40.5000` · `nu_amount_total_conversion 35235.0000` · `co_enterprise DIESE`.

⇒ **BD-OK.**

**Puerta trasera revisada:** el botón **«Información de Cliente»** del tab General (el candidato más
obvio) abre un modal con Empresa · Cliente · Código · Lista de Precio · RIF · Contacto · E-Mail ·
Teléfono · Condición de pago · Dirección. **Sin saldo, sin crédito, sin documentos** (barrido léxico: 0
coincidencias).

---

## Bloque D · dónde se cuela el dato

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-030 | ✅ PASS | **No bajan.** Ver la sección destacada de arriba: 0 filas en las 6 tablas financieras y cursores en `1970-01-01`, contra 195/312/24/33/7 con la variable apagada |
| DM-PRO-031 | ✅ PASS | Ver abajo |
| DM-PRO-032 | ✅ PASS *(parcial)* | Ninguna alerta de las recorridas nombró saldo, crédito, factura ni deuda. Las vistas: «¿Desea Sincronizar?», «¿Desea guardar el pedido?», «Guardar y salir / Salir sin guardar», «Está intentando sincronizar con un usuario diferente…». Además, la alerta de deuda vencida **está apagada por código** con la VG activa (DM-PRO-022). ⚠ No se recorrió el juego completo de alertas de Visitas ni Inventarios |
| DM-PRO-033 | ✅ PASS | El listado de clientes solo expone el icono `search-circle-sharp` (busca por nombre/código): **cero `ion-select` y cero `ion-button` visibles** ⇒ no hay control de orden ni filtro por saldo |
| DM-PRO-034 | ⬜ no comprobado | Detalle de visita, histórico y reimpresiones — no alcanzó el tiempo |

### DM-PRO-031 · el modelo de Angular (`window.ng = true`)

`ng.getComponent(document.querySelector('app-client-list'))` → `ClientListComponent`.

- `comp.clientLogic.isFinanceHiddenForUser` = **`true`**
- `comp.clientLogic.canShowConversion()` = **`false`**
- `comp.clientLogic.clients` (50) y `comp.service.clientes` (50) **sí traen las claves**
  `saldo1, saldo1Conver, saldo2, saldo2Conver, nuCreditLimit, daDocument, daDueDate, countDueDate, colorRow`
  — es la forma del DTO, y aparece igual en los dos estados.
- **Los valores, sobre los 50:**

| Campo | VG ENCENDIDA | VG APAGADA |
|---|---|---|
| `saldo1 > 0` | **0 clientes** | 30 clientes |
| `saldo2 > 0` | **0 clientes** | 30 clientes |
| `nuCreditLimit > 0` | **0 clientes** | 0 *(residuo — ver FAIL 2)* |
| `colorRow` (valores distintos) | `[""]` | `[""]` |
| `countDueDate` (valores distintos) | `["0"]` | `["2","1","10","6","0","3"]` |
| `daDueDate` (valores distintos) | `["null"]` | — |

⇒ **El saldo NO viaja en el modelo.** Las claves existen porque son parte del DTO, pero llegan en
`0`/`null`/`""`. No es un dato pintado en blanco: no está.

*(El color del listado no sale de `colorRow` —que está vacío en los dos estados— sino de un `ngStyle`
calculado sobre el saldo. Con saldo 0, no hay color.)*

### ⚠ Observación abierta — la app **pidió** `documentSale` una vez

Al entrar al módulo Pedidos (sync incremental de módulo, distinta de la del `SynchronizationComponent`)
se capturó un `getsync` con `{"documentSaleTableLastUpdate":"1970-01-01 00:00:00.000","page":0}`.
**La petición se emite.** Tras ella, `document_sales` siguió en 0 filas y el cursor siguió en `1970-01-01`.

**No comprobado:** si el servidor respondió vacío o respondió con filas que la app descartó. No capturé
el **body de la respuesta** de esa llamada, y al reintentar (volver a entrar a Pedidos) la sync
incremental **no se volvió a disparar**, así que no pude reproducirla.
El resultado observable es el mismo (0 filas), pero **la garantía no es la misma**: si el WS estuviera
devolviendo los documentos, el dato viajaría por la red y estaría en memoria del dispositivo aunque no
se persista. **Queda pendiente de cerrar** — es barato: hook de respuesta + primer ingreso a un módulo
tras un login nuevo.

---

## Bloque E · la variable en sí

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-040 | ✅ PASS | **Confirmado: «Sincronizar» NO basta.** Ver abajo |
| DM-PRO-041 | ✅ PASS | Salir + login `V.0017zonaoccidente` ⇒ `localStorage.globalConfiguration` pasó a `["promoterHideFinance","false"]` y el menú cambió a los 10 módulos en la misma sesión |
| DM-PRO-042 | ❌ **FAIL parcial** | ver abajo |

### DM-PRO-040 — medición
1. Nube conmutada a `false` (audit **id 278**, `2026-09-10T21:53:45Z`).
2. Equipo: HOME → **Sincronizar** → alerta «¿Desea Sincronizar?» `[Cancelar, Aceptar]` → Aceptar.
3. La sync recorrió **49 tablas**, todas `status 200`, y terminó normal.
4. **Después:** `localStorage.globalConfiguration` seguía con `["promoterHideFinance","true"]`
   y el menú seguía con los mismos **6** módulos.

⇒ Reconfirmado. Tras conmutar la variable hay que **cerrar sesión y volver a entrar**, y **verificar el
valor en el equipo** antes de medir nada.

### ❌ FAIL 2 — DM-PRO-042 · al apagarla queda un residuo: el límite de crédito no vuelve

**Esperado:** apagarla devuelve el comportamiento anterior **sin residuos**.
**Medido:** vuelven los saldos, los documentos y el segmento «Doc. de Venta», pero **el límite de
crédito se queda en 0**.

**Reproducción mínima**
1. Con `promoterHideFinance = true`, login del promotor. (Sus 83 clientes bajan con `nu_credit_limit = 0`.)
2. Apagar la variable en la web y **Guardar**.
3. Salir y volver a entrar con el mismo promotor.
4. Abrir la ficha de C.0017.

**Evidencia**
- BD local, los 83 clientes: `count = 83`, `con_credito = 0`, `max(nu_credit_limit) = 0` — **igual que antes de apagarla**.
- Ficha C.0017: `Saldo USD: 3.129,00` (volvió) pero **`Crédito USD: 0,00`** y `Crédito Disp. USD: -3.129,00`.
- Nube: C.0017 tiene `nu_credit_limit = 1.000,0000`.
- **Causa (barata de ver, no hace falta código):** `versionsTables.clientTable.last_update` **no
  retrocede** al apagar la variable (siguió en `2026-09-10 15:17:09.113`). Como la sincronización es
  incremental, las filas de cliente **no se vuelven a pedir**, y quedan las que bajaron anuladas.
  Los documentos sí vuelven porque su cursor **sí** estaba en `1970-01-01` y por tanto se piden enteros.

**Severidad:** media. No expone datos —al revés, los esconde de más— pero deja al promotor (ya
convertido en vendedor normal) trabajando con **crédito 0 y crédito disponible negativo** en todos sus
clientes, hasta que algo fuerce una resincronización completa de `client`.

**Contraprueba de que es residuo y no un dato plano del tenant:** el vendedor de control, en el mismo
equipo y con la variable **encendida**, bajó **77 de 78** clientes con crédito > 0 (máx 15.000).

---

## Bloque F · que no se lleve a nadie por delante

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-050 | ✅ PASS | ver abajo |
| DM-PRO-051 | ⬜ no comprobado | No se creó ningún cobro con el vendedor — no alcanzó el tiempo |

Con `promoterHideFinance = **true**` en la nube (audit **id 279**, `2026-09-10T22:01:19Z`) y verificado
en el equipo (`["promoterHideFinance","true"]`), login de `V.0002zonacentral` (`promotor: false`):

- **Menú completo:** Visitas · Inventarios · Pedidos · **Devoluciones** · **Cobros** · **Depósitos** · **Vendedores** · Productos · Clientes · Sincronizar.
- `clientLogic.isFinanceHiddenForUser` = **`false`** (la doble condición del guard funciona: la variable
  está en `true` pero `user.promotor` es `false`).
- **Listado:** `EURO REPUESTOS FIOVAL, C.A. / Código: C.0010 / Saldo USD: 2.512,00 / Saldo Bs: 2.185.440,00`; 28 de 50 con saldo.
- **Ficha C.0010:** segmentos `Detalle` + **`Doc. de Venta`**; `Saldo USD: 2.512,00` · **`Crédito USD: 9.000,00`** · `Crédito Disp. USD: 6.488,00` · `Crédito Bs: 7.830.000,00` · `Crédito Disp. Bs: 5.644.560,00`.
- **BD local:** `document_sales 106` · `invoices 271` · `collections 50` · `deposits 3` · `banks 33` · `bank_accounts 7`; **77/78 clientes con crédito**, máx 15.000.

⇒ **La variable es solo para el rol Promotor.** El vendedor no se ve afectado.

---

## Lo que NO se pudo comprobar

**No está vacío.** Estos seis casos quedaron fuera, todos por tiempo, ninguno por bloqueo técnico:

| ID | Qué falta | Por qué |
|---|---|---|
| DM-PRO-004 | Ciclo de visita completo con la variable apagada | tiempo |
| DM-PRO-005 | Inventario con la variable apagada | tiempo |
| DM-PRO-015 | Resumen de la visita con la variable encendida | tiempo |
| DM-PRO-034 | Detalle de visita, histórico y reimpresiones | tiempo |
| DM-PRO-051 | Un cobro creado por el vendedor de control llega a la nube | tiempo |
| — | **Si el WS responde vacío o responde con datos que la app descarta** en el `getsync` de `documentSale` | no capturé el body de la respuesta y la llamada no se volvió a disparar |

Y dos precisiones sobre lo que **sí** se midió pero no cierra del todo:

- **DM-PRO-013 / DM-PRO-014:** verifiqué que no hay ruta **por UI** a los documentos (no existe el
  segmento, ni botón, ni selector en el pedido). **No probé la navegación directa por URL** contra
  `promoterHideFinanceGuard` — no es una ruta alcanzable por el vendedor y `pg.goto()` está prohibido en
  este WebView. Que el guard exista lo leí en el bundle; que **funcione** no lo medí.
- **DM-PRO-022:** el caso «supera el límite de crédito» es débil, porque con la variable encendida el
  límite siempre llega en 0. Lo doy por PASS en lo que importa (no filtra el dato), no como prueba de la
  lógica de crédito.

### Y una cosa que casi reporto mal

En mitad de la corrida anoté que el límite de crédito llegaba anulado y lo atribuí a la variable. Al
apagarla **seguía en 0**, lo que parecía desmentirlo. La respuesta real necesitó un tercer dato (el
vendedor de control): **sí lo anula la variable**, y el 0 que persiste al apagarla es el **residuo** del
FAIL 2. Lo dejo escrito porque el camino corto —medir dos estados y concluir— habría dado un veredicto
equivocado en las dos direcciones.

---

## Para el script

### Selectores estables (verificados en esta corrida)

| Qué | Selector / técnica |
|---|---|
| Login | `app-login ion-input[placeholder="Usuario"]` / `[placeholder="Contraseña"]` (sin `name`) + `app-login ion-button[type="submit"]` con `pg.mouse.click(..., {delay:130})` |
| Estado de la VG en el equipo | `localStorage.getItem('globalConfiguration')` y buscar `["promoterHideFinance","<valor>"]` — **es la lectura barata y fiable**, no hace falta tocar la BD |
| Rol | `JSON.parse(localStorage.getItem('user')).promotor` |
| Menú de HOME | `app-home p.nombreModulos` filtrando `offsetParent !== null` → `.textContent.trim()` |
| Entrar a un módulo | ese mismo `<p>` → `.closest('a')` → `pg.mouse.click` al centro del rect |
| Landing Clientes / Pedidos | el tile es un nodo hoja con texto exacto `CLIENTES` / `PEDIDO`; subir con `.closest('a')` y si no `.closest('ion-col')` |
| Listado de clientes | `app-client-list ion-item` |
| Saldo en el listado | los `<p>` con `style="color: red;"` dentro del `ion-item`; **con la variable activa el nodo no existe** (queda un `<!---->`) |
| Segmentos de la ficha | `ion-segment-button` → `getAttribute('value')`: `default` siempre, **`docVentas` solo con la variable apagada** |
| Bandera en vivo | `ng.getComponent(document.querySelector('app-client-list')).clientLogic.isFinanceHiddenForUser` |
| Seleccionar cliente en el pedido | `ng.getComponent(document.querySelector('app-pedido')).setClientfromSelector(cliente)` + `ng.applyChanges(comp)` — **no** clickear el modal |
| Modal «Información de Cliente» | `comp.modalInfoCliente(true)` / `(false)` — es un flag, no abre solo |
| Guardar / Enviar | `app-pedido ion-button.imagenGuardar` / `.imagenEnviar` (icon-only, `y ≈ 32`) |
| Alertas | `ion-alert:not(.overlay-hidden)` + `offsetParent!==null`, quedarse con **el último**; recorrer los botones por **igualdad exacta** case-insensitive sobre `['Aceptar','OK','Si','Sí']` |
| BD local | `window.sqlitePlugin.openDatabase({name:'denarioPremium', location:'default'})` — **`automation/db/local-query.js` NO sirve** en este build (no hay `databases/` accesible por `run-as`) |

### Secuencia mínima que reproduce el REQ entero

```
0. Pre-vuelo CDP: adb shell cat /proc/net/unix | grep webview_devtools_remote
                  adb forward --remove tcp:9220; adb forward tcp:9220 localabstract:<socket>
                  curl -s http://127.0.0.1:9220/json/version
1. Bundle vivo: fetch('http://localhost/main.js') -> exigir 'promoterHideFinance'. Si no está, PARAR.
2. Web -> /pages/variablesConfiguracion -> fila 77 -> poner SI -> **Guardar** -> verificar en BD.
3. Equipo: login promotor -> leer la VG de localStorage -> exigir 'true'.
4. Medir: menú (6) · listado (sin saldo, todo rgb(102,102,102)) · ficha (1 segmento) ·
   BD local (6 tablas financieras en 0, cursores en 1970) · modelo (saldo1/saldo2/countDueDate en 0).
5. Pedido end-to-end -> Enviar -> esperar la 3.ª alerta o st_delivery=1 -> cotejar en la nube por id_order.
6. Web -> poner NO -> Guardar -> Sincronizar en el equipo -> exigir que la VG SIGA en 'true'  <- DM-PRO-040
7. Salir -> login promotor -> exigir VG 'false' -> repetir el punto 4 y exigir lo contrario en todo.
8. Web -> poner SI -> Guardar -> login del vendedor normal -> exigir menú completo + saldos + crédito real.
```

### Oráculos

| Qué | Cómo |
|---|---|
| «¿bajan los documentos?» | `SELECT count(*) FROM document_sales / invoices / collections / banks / bank_accounts` en la SQLite local, **más** `SELECT name_table, last_update FROM versionsTables` — `1970-01-01` es la firma de «nunca se sincronizó» y es más robusta que el `count` (que también da 0 si el cliente no tiene datos) |
| «¿el crédito llega anulado?» | cruzar `clients.nu_credit_limit` (local) contra `client.nu_credit_limit` (nube) **para los mismos `co_client`**. Nunca mirar solo el local: 0 también sería un dato válido del tenant |
| «¿el pedido llegó?» | `node automation/db/query.js 4k "SELECT id_order, co_order, co_client, co_user, nu_amount_total, st_order FROM \"order\" WHERE id_order > <baseline>"` — la Ref de la UI es `id_order` |
| «¿qué tablas pide la sync?» | envolver `Capacitor.nativePromise` y quedarse con las URL `/getsync`; la clave `*TableLastUpdate` del request identifica la tabla |
| «¿la variable llegó?» | `localStorage.globalConfiguration`, no la UI |

### Lo que NO es automatizable (o no conviene)

- **Conmutar la variable en la web** es automatizable pero **frágil y peligroso**: es configuración
  compartida del tenant. Además el `dispatchEvent('change')` sobre el `<select>` oculto **no persiste**:
  cambia la etiqueta a NO y la BD sigue igual. **Hay que pulsar `formGlobal:botonGuardar` y verificar en
  la BD**; el `growl` «Configuración guardada exitosamente» no alcanza como oráculo. Y el id de la fila
  (`tablaConf:77`) es **posicional**: si se agrega una variable, se corre. Localizar siempre por el
  texto «Ocultar información financiera», nunca por el índice.
- **La ventana de exclusividad.** Mientras se toca esa pantalla nadie más puede entrar. En esta corrida
  el audit mostró que `admin` había tocado `multiCurrencyOrder` / `multiCurrencyCollection` a las
  20:11-20:15Z, ~1h20 antes de empezar. No fue concurrente, pero un script desatendido no puede saberlo:
  **leer `global_configuration_audit` antes y después** y abortar si aparece un `id_audit` ajeno.
- **La sync incremental de módulo** (la que pidió `documentSale`) **no se dispara a voluntad**: no se
  reprodujo al reentrar. No se puede convertir en un caso determinista sin conocer su condición de disparo.
- **El ciclo completo de visita e inventario** conviene dejarlo en el smoke por módulo, no en este REQ.
- Los tiempos: login + sync completa ≈ **80-120 s**. Sondear a mano en bucle con `page.waitForTimeout`;
  **`pg.waitForFunction` corta a 30 s** aunque se le pase un `timeout` mayor.

---

## Estado en que queda todo

| Qué | Estado |
|---|---|
| **`promoterHideFinance` en la nube** | **`true` (SI)** — *como se encontró*. Audit: 278 (true→false, 21:53Z) y **279 (false→true, 22:01Z)** |
| Equipo | sesión abierta de **`V.0002zonacentral`** (vendedor normal); la BD local es la suya (la del promotor se borró al cambiar de usuario, con el aviso de la app) |
| Registro creado | pedido **`id_order 2593`** — Enviado y en la nube. No hace falta deshacerlo |

🔴 **Sobre dejarla apagada.** La instrucción era dejarla apagada salvo decir lo contrario, y **digo lo
contrario**: la encontré en **`true`**, puesta por `admin` el **07/09** (audit id 240) justamente para
este REQ. Apagarla no sería restaurar el sistema sino **cambiarle la configuración al tenant**. La dejé
**como estaba**. Si QA prefiere que quede apagada, es un cambio de un minuto en la fila 77 y hay que
recordar que **no baja al equipo hasta el próximo login**.
