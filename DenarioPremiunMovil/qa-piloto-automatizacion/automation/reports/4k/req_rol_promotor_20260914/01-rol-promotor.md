# REQ · Rol PROMOTOR — validación del fix — IMPORTADORA 4K

| Parámetro | Valor |
|---|---|
| RUN_DIR | `automation/reports/4k/req_rol_promotor_20260914/` |
| Fecha | 2026-09-14 (16:50 – 18:10 local, UTC-4) |
| Cliente | `4k` · empresa **DIESE / GRUPO 4K** (`co_enterprise DIESE`, RIF J401702600) |
| Playa | **CARIBE** — web `denariocaribe.ddns.net:8080/DenarioPremium` (descubierta en runtime) |
| Dispositivo | Infinix X6728 · `14678405BR003855` · `com.kiberno.denarioPremiumPro` · **app 6.6.21.3** |
| Promotor | `V.0017zonaoccidente` → `id_user 301` · `co_user V.0017` · ARMANDO SUAREZ · **`co_role 9`** · `promotor: true` |
| Vendedor de control | `V.0002zonacentral` → `id_user 300` · `co_user V.0002` · ANGEL BETANCOURT · **`co_role 7`** · `promotor: false` |
| Variable | `promoterHideFinance` (`global_configuration.clave`, fila web `formGlobal:tablaConf:77`) |
| Línea base | `req_rol_promotor_20260910` — 17 PASS · 2 FAIL · 1 N/A · 6 no comprobados |
| Resultado | **26 PASS · 2 FAIL · 3 N/A · 1 BLOCKED** |

> Todo lo de abajo se midió **en esta corrida**. Nada heredado de la del 10/09.

---

# 🔑 VEREDICTO DE LOS DOS FAIL

## ❌→⚠️ FAIL 1 · DM-PRO-006 — **corregido en lo que QA nombró, pero el fix se llevó Pedidos por delante**

**Lo que QA pidió:** que con la variable **apagada** el promotor **no** vea Cobros, Devoluciones ni Depósitos.

**Medido hoy, con `promoterHideFinance = false` y login nuevo verificado en el equipo:**

```
Visitas · Inventarios · Productos · Clientes · Sincronizar
```

(lectura literal de `app-home p.nombreModulos` visibles → 5 rótulos; texto de `app-home`:
«Visitas · Inventarios · Productos · Clientes · Sincronizar · SALIR · Copyright © 2025…»)

| Módulo | 10/09 (VG off) | **Hoy (VG off)** | ¿Lo pidió QA? |
|---|:--:|:--:|---|
| **Cobros** | presente ❌ | **AUSENTE ✅** | sí |
| **Devoluciones** | presente ❌ | **AUSENTE ✅** | sí |
| **Depósitos** | presente ❌ | **AUSENTE ✅** | sí |
| Vendedores | presente | **AUSENTE ✅** | no (medido y reportado, como se pidió) |
| **Pedidos** | **presente ✅** | **AUSENTE ❌** | **no — esto es nuevo y está mal** |

⇒ **Los tres módulos que QA nombró están corregidos.** Pero el fix **también quitó Pedidos**, y
**Pedidos es independiente de la variable** — hecho ya establecido y explícitamente fuera de discusión.

### La causa exacta, leída del bundle vivo

Constructor de `HomePage` (`ng.getComponent(document.querySelector('app-home')).constructor`):

```js
if (this.isPromotor) {
  const promotorModuleIds = this.hideFinancePromotor ? [0, 1, 2, 7, 8, 10] : [0, 1, 7, 8, 10];
  this.modulosPromotor = this.modulos.filter(m => promotorModuleIds.includes(m.id));
  ...
}
```

y el mapa de ids, leído del mismo componente:

| id | 0 | 1 | **2** | 3 | 4 | 5 | 6 | 7 | 8 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| módulo | Visitas | Inventarios | **Pedidos** `/pedidos` | Devoluciones | Cobros | Depósitos | Vendedores | Productos | Clientes | Sincronizar |

**El id 2 (Pedidos) solo está en la rama `hideFinancePromotor === true`.** Es decir: la variable que
debía *ocultar lo financiero* es hoy la que **enciende Pedidos**. Apagarla le quita al promotor
justamente la capacidad que el REQ vino a darle.

**Contraste A/B en el mismo equipo, mismo build, mismo usuario, cambiando solo la variable:**

| `hideFinancePromotor` | menú | nº |
|---|---|:--:|
| `true` | Visitas · Inventarios · **Pedidos** · Productos · Clientes · Sincronizar | 6 |
| `false` | Visitas · Inventarios · Productos · Clientes · Sincronizar | **5** |

**Reproducción mínima**
1. Web → Variables Globales → «¿Ocultar información financiera al rol Promotor?» → **NO** → **Guardar**.
2. Equipo: Salir → entrar con `V.0017zonaoccidente`.
3. Leer los rótulos del menú de HOME. → **Pedidos no está.**

**Severidad: media-alta.** No expone datos, pero deja al promotor sin Pedidos en cuanto alguien apaga
la variable — o en un tenant nuevo donde nazca en `false`. **Arreglo aparente:** incluir el id 2 en las
dos ramas (`[0,1,2,7,8,10]` en ambos casos), que es lo coherente con «Pedidos es independiente».

---

## ✅ FAIL 2 · DM-PRO-042 — **CORREGIDO. El límite de crédito vuelve.**

**Medido:** al apagar la variable y volver a entrar, el crédito **sí** vuelve.

| Oráculo | 10/09 (el FAIL) | **Hoy (VG off, login nuevo)** | Nube |
|---|---:|---:|---:|
| `clients` con `nu_credit_limit > 0` (de 83) | **0** | **80** | — |
| `max(nu_credit_limit)` local | **0** | **12.000** | — |
| C.0017 | **0** | **1.000** | 1.000 |
| C.0024 | 0 | **1.500** | 1.500 |
| C.0057 | 0 | **2.500** | 2.500 |
| C.0125 | 0 | **8.000** | 8.000 |
| C.0150 | 0 | **12.000** | 12.000 |
| modelo Angular `nuCreditLimit > 0` (de 50) | **0** | **48** | — |

**Ficha de C.0017 con la variable apagada:**
`Saldo USD: 3.129,00` · **`Crédito USD: 1.000,00`** · `Crédito Disp. USD: -2.129,00` ·
`Crédito Bs: 870.000,00` · `Crédito Disp. Bs: -1.852.230,00` · segmentos `Detalle` + **`Doc. de Venta`**.

⚠ **Precisión sobre «Crédito Disp. debe dejar de ser negativo»:** sigue negativo, y **debe** serlo.
El cliente debe 3.129 contra una línea de 1.000 ⇒ disponible = **−2.129,00**. Lo que prueba el fix es
que **cambió de −3.129,00 a −2.129,00**: antes restaba sobre un crédito 0, ahora sobre el crédito real.
La aritmética es correcta; el negativo es un hecho del negocio, no un residuo.

### 🔑 El oráculo del cursor no sirve *a posteriori* — hay que decirlo

La hipótesis de trabajo era «mirar si `versionsTables.clientTable.last_update` **retrocede**».
**No se puede observar así**, y conviene que quede escrito para no perder tiempo la próxima vez:

- **Antes de apagar:** `clientTable.last_update = 2026-09-11 14:52:34.946`
- **Después de apagar + login nuevo:** `clientTable.last_update = 2026-09-11 14:52:34.946` ← **el mismo**

Parece que no hizo nada. Pero el crédito **sí** volvió. El mecanismo real, leído del bundle:

1. En el login, se compara la config **antes** y **después** de `setVars`:
   ```js
   if (prevHideFinance && !newHideFinance) {
     localStorage.setItem('resyncClientsAfterFinanceUnlock', 'true');
   }
   ```
2. `SynchronizationComponent.sincronice()` llama `loginLogic.resetClientsSyncCursorAfterFinanceUnlock()`,
   que consume el flag y ejecuta `databaseService.resetTableSyncCursor(3)` (`id_table 3` = clients):
   ```js
   /** Retrocede cursor incremental sin borrar filas locales. */
   resetTableSyncCursor(idTable) {
     const epoch = '1970-01-01 00:00:00.000';
     return this.database.executeSql('UPDATE versionsTables SET last_update = ? WHERE id_table = ?', [epoch, idTable])
   ```
3. El cursor se pone en 1970, la sync **se trae la tabla entera** (con el crédito real) y al terminar
   **vuelve a avanzar el cursor** hasta el máximo de la tabla.

Y ese máximo es exactamente el valor observado: en la nube
`SELECT max(da_update) FROM client` → **`2026-09-11T18:52:34.946Z`** = `2026-09-11 14:52:34.946` local (UTC-4).
⇒ El cursor **no se quedó atrás: está al día**. Coincide con el valor previo porque **ningún cliente
se modificó desde el 11/09**.

⇒ **El oráculo bueno de este fix es el crédito (`count(*) FILTER (WHERE nu_credit_limit > 0)`), no el cursor.**

🔴 **Condición indispensable para reproducirlo:** el fix se dispara en la **transición** `true → false`,
comparando lo que el equipo **ya tenía** contra lo que baja en el login. Si el equipo llega con
`promoterHideFinance` ya en `false` (residuo de otra sesión), **`prevHideFinance` es `false`, el flag
no se pone y el crédito no vuelve** — y se leería como «el fix no funciona». Hay que **encenderla,
entrar, y recién entonces apagarla**.

---

# 🔴 HALLAZGO NUEVO — al VOLVER a encenderla, lo financiero NO se va del equipo

Es el hallazgo más serio del día, y es la dirección **protectora** de la variable.

**Medido:** variable de vuelta en `true`, **login nuevo**, mismo promotor, verificado
`localStorage.globalConfiguration = ["promoterHideFinance","true"]` y `isFinanceHiddenForUser = true`.

| Tabla local (SQLite `denarioPremium`) | 10/09 con VG ON | **Hoy con VG ON** (tras haber pasado por OFF) |
|---|:--:|:--:|
| `document_sales` | 0 | **195** |
| `invoices` | 0 | **306** |
| `collections` | 0 | **8** |
| `banks` | 0 | **33** |
| `bank_accounts` | 0 | **7** |
| `clients` con crédito > 0 | 0 | **80 de 83** (máx 12.000) |

Y los cursores **tampoco vuelven a `1970`**: `documentSaleTable 2026-08-19`, `invoiceTable 2026-08-19`,
`bankTable 2026-09-04`, `collectionTable 2026-09-14`, `depositTable 2026-09-14`.

**La pantalla sí lo tapa** — barrido léxico 0 sobre saldo/crédito/factura/deuda/vencid/cobro/documento,
color uniforme `rgb(102,102,102)` en los 100 `<p>` del listado, ficha con **un solo** segmento `Detalle`.
**Pero el modelo de Angular trae el dato:**

| `ClientListComponent.clientLogic.clients` (50) | 10/09 VG ON | **Hoy VG ON** |
|---|:--:|:--:|
| `saldo1 > 0` | 0 | **30 clientes** |
| `saldo2 > 0` | 0 | **30 clientes** |
| `nuCreditLimit > 0` | 0 | **48 clientes** |
| `countDueDate` valores distintos | `["0"]` | **`["2","1","10","6","0","3","8","14"]`** |
| `daDueDate` | `["null"]` | **fechas reales** (2026-07-03, 2026-08-27, 2026-09-03, …) |

⇒ **DM-PRO-030 y DM-PRO-031 FALLAN en este escenario.** Es exactamente lo que el guión pone como
criterio: *«Un dato oculto en pantalla pero presente en el modelo sigue siendo un dato entregado al
dispositivo.»* El saldo, el crédito y los documentos **están en el teléfono** y solo los tapa un `*ngIf`.

**Causa:** el fix resetea el cursor al **apagar** (para volver a pedir), pero **no purga nada al
encender**. El propio comentario del código lo dice: *«id_table=3 (clients). **Solo cursor; sin DELETE**.»*
No existe la operación simétrica.

**Por qué el 10/09 dio PASS:** aquel equipo arrancó **sin BD** y nunca tuvo la variable apagada, así que
las tablas financieras jamás se poblaron. La garantía «el dato no está en el teléfono» **solo se sostiene
en un equipo que nunca haya trabajado con la variable apagada.**

**Reproducción mínima**
1. VG en `true` → login del promotor. (Tablas financieras en 0.)
2. VG a `false` → **login nuevo**. (Bajan 195 documentos, 306 facturas, 33 bancos, el crédito.)
3. VG a `true` otra vez → **login nuevo**.
4. Leer la SQLite local y el modelo. → **Todo sigue ahí.**

**Severidad: alta**, porque es el objetivo mismo del REQ. Un promotor al que se le apagó la variable
un rato conserva la cartera financiera completa en el dispositivo de forma indefinida.

*(⚠ Sí se limpia al **cambiar de usuario**: la app avisa «…todos los datos anteriores serán borrados»
y efectivamente rehace la BD. Lo que no limpia es conmutar la variable con el **mismo** usuario.)*

---

# Los 6 huecos del 10/09, cerrados

| ID | Qué faltaba | Resultado |
|---|---|---|
| DM-PRO-004 | Ciclo de visita completo | 🚫 **N/A por datos del tenant** — ver abajo |
| DM-PRO-005 | Inventario | ✅ **PASS** — inventario **101** enviado y en la nube |
| DM-PRO-015 | Resumen de la visita, sin datos financieros | ✅ **PASS parcial** — el formulario no trae nada financiero; el resumen final no es alcanzable (mismo motivo que 004) |
| DM-PRO-034 | Detalle de visita, histórico, reimpresiones | ✅ **PASS** — reimpresión medida de punta a punta; histórico N/A por datos |
| DM-PRO-051 | Un cobro del vendedor de control llega a la nube | ✅ **PASS** — anticipo **2714** en la nube |
| — | Si el WS responde vacío en el `getsync` de `documentSale` | ⬜ no comprobado (no se volvió a disparar) |

### DM-PRO-004 / DM-PRO-015 · el promotor **no puede completar una visita en este tenant**

No es defecto de la app, pero **bloquea el flujo principal del rol** y conviene que el dueño del
producto lo sepa.

- Al pulsar **Enviar** sin actividades: `¡Alerta! · «Debe agregar al menos una actividad a la visita.» · ACEPTAR`
  ⇒ la actividad es **obligatoria**.
- Pero el desplegable **«Seleccione Actividad» abre vacío**: el `ion-select` despliega un
  `ion-radio-group` **sin una sola opción**.
- **No es un cero falso.** Está medido en los tres niveles:

| | promotor V.0017 (rol 9) | vendedor V.0002 (rol 7) |
|---|:--:|:--:|
| `incidence_types` en el equipo | **0** | **50** |
| `incidence_motives` en el equipo | **0** | **163** |

  y en la nube: `SELECT co_role, count(*) FROM incidence_type_role GROUP BY co_role` →
  **una sola fila: `co_role 7 → 50`**. **El rol 9 no tiene ningún tipo de actividad asignado.**

⇒ Es una **laguna de configuración del tenant**, reproducida en el mismo equipo y build cambiando solo
el usuario. **Pide confirmación a mano / con producto:** ¿se espera que el rol Promotor tenga tipos de
actividad asignados? Si sí, hay que darlos de alta en `incidence_type_role`; hasta entonces el promotor
no puede cerrar ninguna visita.

- **Histórico de visitas (`RUTA DE HOY`):** «No hay resultados», y **es correcto**:
  `SELECT count(*) FROM visit WHERE id_user=301 AND da_visit::date = '2026-09-14'` → **0**
  (las cercanas son 10/09 con 10, 16/09 con 15, 17/09 con 10). La pantalla no ofrece filtro de fecha,
  así que no hay ruta a una visita histórica. **N/A por datos, verificado contra la nube.**

### DM-PRO-034 · reimpresiones — medido, no solo inspeccionado

El botón **GENERAR PDF** del tab Adjunto del pedido es la ruta de reimpresión. Se capturó el
**contenido real** que va al PDF interceptando `pdfCreator.generateSummaryPdfDoc(data)` y anulando
`openPdf`/`savePdf` (para no abrir el visor nativo, que cuelga CDP, ni escribir archivos):

```json
{"title":"Resumen pedido",
 "enterpriseHeader":{"name":"GRUPO 4K","rif":"J401702600","address":"CALLE 37 ENTRE CARRERAS 21 Y 22…"},
 "meta":[{"Pedido":"2593"},{"Cliente":"CUMMINS DIESEL PARTS, C.A."},{"Fecha":"10/9/2026, 5:47 p. m."},
         {"Moneda":"USD"},{"Items":"1"}],
 "columns":["Código","Producto","Cantidad","Unidad","Precio Base","IVA %","Importe Total"],
 "rows":[["1R1807-4K","FILTRO DE ACEITE CATERPILLAR 3116","3,00","UNIDAD","13,50","","40,50"]],
 "summaryTotalsRow":{"detailLines":["Base: 40,50 USD","Total: 40,50 USD"]},
 "fileName":"cotizacion_2593_2026-09-10.pdf"}
```

**Barrido léxico sobre el payload: 0** en saldo/crédito/factura/deuda/vencido/cobro/documento.
(Las dos coincidencias que aparecían al leer el código fuente eran **falsos positivos**: la palabra
«facturable» dentro de un comentario `// REQ-01: …`, y `Document` como parte de la ruta webpack
`…_Documentos_kiberno_…`, que es el nombre de la carpeta del desarrollador.)
Los originales se restauraron al terminar.

---

# Recorrido del guión

## Bloque A · variable APAGADA (no-regresión)

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-001 | ❌ **FAIL** | Menú = `Visitas · Inventarios · Productos · Clientes · Sincronizar`. **Falta Pedidos** (ver FAIL 1) |
| DM-PRO-002 | ✅ PASS | Ficha C.0017: `Saldo USD 3.129,00` · `Saldo Bs 2.722.230,00` · **`Crédito USD 1.000,00`** · segmento `Doc. de Venta` presente |
| DM-PRO-003 | ✅ PASS | Listado con saldo y color: `rgb(255,0,0)` ×70 y `rgb(0,0,255)` ×30 sobre los `<p>`; leyenda «Documento vigente / Documento vencido». Modelo: `saldo1>0` en 30/50, `countDueDate` con valores reales |
| DM-PRO-004 | 🚫 N/A | Sin tipos de actividad para el rol 9 (ver arriba) |
| DM-PRO-005 | ✅ PASS | Medido con la VG encendida; inventario **101** en la nube |
| DM-PRO-006 | ⚠️ **PARCIAL** | **Cobros, Devoluciones y Depósitos AUSENTES ✅** (lo que pidió QA) · Vendedores ausente · **pero Pedidos también ausente ❌** |

## Bloque B · variable ENCENDIDA

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-010 | ✅ PASS | Menú = exactamente **6**: `Visitas · Inventarios · Pedidos · Productos · Clientes · Sincronizar`. *(Mejora frente al 10/09: ya no devuelve 12 entradas con 2 vacías — ahora son 6 limpias.)* |
| DM-PRO-011 | ✅ PASS | Ficha C.0017: Empresa · Nombre · Lista de Precio · RIF · Contacto · Email · Teléfono · Condición de Pago · Dirección · Descripción 1/2 · Coordenada. **Sin Saldo ni Crédito.** Barrido léxico: 0 |
| DM-PRO-012 | ✅ PASS | Ítem = `<p>nombre</p><p>Código: …</p>` y un `<!---->` donde iría el saldo. **Un solo color** en los 100 `<p>`: `rgb(102,102,102)`. **Sin saldo y sin color** |
| DM-PRO-013 | ✅ PASS | La ficha trae **un solo** `ion-segment-button` (`value="default"`, «Detalle»). `docVentas` no existe |
| DM-PRO-014 | ✅ PASS | **Cerrada también la ruta «desde la visita»**, que el 10/09 quedó sin probar: el botón **«Más Detalles»** del selector de cliente dentro de la visita abre la ficha **con un único segmento `Detalle`** y barrido léxico 0. Y desde el pedido, el modal **«Información de Cliente»** (`eventModal3`) da Empresa · Cliente · Código · Lista de Precio · RIF · Contacto · E-Mail · Teléfono · Condición de pago · Dirección — **sin saldo, sin crédito, sin documentos** |
| DM-PRO-015 | ✅ PASS parcial | Formulario de visita = `GENERAL · ACTIVIDADES · ADJUNTOS`, barrido léxico **0**. El resumen de cierre no es alcanzable (N/A por datos) |

## Bloque C · Pedidos

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-020 | ✅ PASS | Pedido **2595** creado y **enviado**; **BD-OK** en la nube |
| DM-PRO-021 | ✅ PASS | El formulario tiene **4 pestañas — General · Pedido · Total · Adjunto** — y **ninguna** ofrece facturas ni documentos. La pestaña «Pedido» es el **catálogo de productos** (Favoritos · Destacados · Carrito · FILTROS 1 · INYECCION 3 · MISCELANEOS 4 · MOTOR 8), no un selector de documentos. **Confirmado el PASS del 10/09** |
| DM-PRO-022 | ✅ PASS *(con la misma reserva)* | **Deja pasar y no nombra el crédito.** Al elegir C.0017 no salió ninguna alerta; el pedido de 40,50 USD se envió sin bloqueo. Las **únicas** alertas del envío fueron «¿Desea Enviar el pedido?», «Su Pedido será enviado» y «Pedido nro. 2595 enviado exitosamente». ⚠ **Reserva:** con la VG activa el crédito llega en 0, así que «superar el límite» es trivialmente cierto — sigue sin ser un caso fuerte |
| DM-PRO-023 | ✅ PASS | `Precio: 13,50 USD` · `Total Base USD 40,50 / Bs 35.235,00` · `Total Pedido USD 40,50` · `Tasa: 870,00 Bs = 1,00 USD`. Es precio, no financiero del cliente |
| DM-PRO-024 | ✅ PASS | Llega completo y con el vendedor correcto (ver tabla de registros) |

## Bloque D · dónde se cuela el dato

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-030 | ⚠️ **PASS con la VG on «de fábrica» / FALLA tras pasar por off** | Equipo que nunca tuvo la VG apagada: 0 filas en las 6 tablas y cursores en `1970` ✅. Equipo que sí: **195 / 306 / 8 / 33 / 7 filas** ❌ (ver hallazgo nuevo) |
| DM-PRO-031 | ⚠️ **igual** | Modelo limpio (`saldo1>0`=0, `countDueDate`=`["0"]`) en el primer caso; **`saldo1>0`=30, `nuCreditLimit>0`=48, fechas reales** en el segundo |
| DM-PRO-032 | ✅ PASS | Ninguna alerta recorrida nombra saldo, crédito, factura ni deuda. Recogidas del DOM: «¿Desea Sincronizar?», «¿Desea guardar la visita?», «¿Desea enviar la visita?», «Guardar y salir / Salir sin guardar / Cancelar», «Debe agregar al menos una actividad a la visita», «¿Desea Enviar el pedido?», «Su Pedido será enviado», «Pedido nro. 2595 enviado exitosamente», «¿Desea enviar el Inventario?», «Inventario nro. 101 enviado exitosamente», «Está intentando sincronizar con un usuario diferente…» |
| DM-PRO-033 | ✅ PASS | El listado de clientes expone **0 `ion-select` y 0 `ion-button`** visibles ⇒ no hay orden ni filtro por saldo |
| DM-PRO-034 | ✅ PASS | Reimpresión medida (arriba). Detalle del pedido 2593: `General` (sin datos financieros del cliente) · `Total` (importes del pedido) · `Adjunto`. Listado de pedidos: solo `Nro. Ref. · Cliente · Estatus · Fecha`, **sin importes** |

## Bloque E · la variable en sí

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-040 | ✅ PASS **(5.ª confirmación)** | Nube en `false`; en el equipo HOME → **Sincronizar** → «¿Desea Sincronizar?» → Aceptar → sync completa. **Después:** `localStorage.globalConfiguration` **seguía** en `["promoterHideFinance","true"]` y el menú seguía con los mismos 6 módulos. **Sincronizar NO basta** |
| DM-PRO-041 | ✅ PASS | Salir + login ⇒ el valor cambia en el equipo y el comportamiento cambia en la misma sesión. Verificado en las **4** conmutaciones |
| DM-PRO-042 | ⚠️ **mitad y mitad** | **Apagarla:** el crédito vuelve ✅ (FAIL 2 corregido). **Encenderla:** deja residuo financiero en el equipo ❌ (hallazgo nuevo) |

## Bloque F · que no se lleve a nadie por delante

| ID | Resultado | Evidencia |
|---|---|---|
| DM-PRO-050 | ✅ PASS | Con `promoterHideFinance = true` y `promotor: false`, `V.0002zonacentral` ve el **menú completo**: `Visitas · Inventarios · Pedidos · Devoluciones · Cobros · Depósitos · Vendedores · Productos · Clientes · Sincronizar`. BD local: `document_sales 106` · `invoices 265` · `collections 73` · `banks 33` · **77 de 78 clientes con crédito**, máx 15.000. **La variable no le afecta** |
| DM-PRO-051 | ✅ PASS | **Anticipo 2714** creado y enviado por el vendedor de control → **BD-OK** en la nube (`id_user 300`) |

---

# Registros creados

| Ref | Tipo | Usuario | Cliente | Monto | Comentario | Oráculo en la nube |
|---|---|---|---|---|---|---|
| **2595** | pedido | V.0017 (promotor) | C.0017 | 40,50 USD / 35.235,00 Bs | `QA-PRO-4K-171941` | `order` id 2595 · `co_order 1789420641411.0` · `id_user 301` · `co_user V.0017` · `nu_amount_total 40.5000` · `st_order 1` · `co_enterprise DIESE` · `da_order 2026-09-14T21:20:12Z` ✅ |
| **101** | inventario | V.0017 (promotor) | C.0017 | `1R1807-4K` · 5 UNIDAD · lote `QA0914` | — | `client_stock` id 101 · `co_client C.0017` · `id_user 301` · `da_client_stock 2026-09-14T21:21:28Z` ✅ |
| **2714** | anticipo (`co_type 1`) | V.0002 (control) | C.0010 | 5,00 USD (Efectivo) | `QA-PRO-F-180118` | `collection` id 2714 · `co_collection 1789423268222.0` · `id_user 300` · `nu_amount_total 5.0000` · `st_collection 3` · `co_enterprise DIESE` · `da_collection 2026-09-14T22:01:06Z` ✅ |

**Conmutaciones de la variable** (audit del tenant, todas de esta corrida):

| # | audit | Hora UTC | Cambio |
|---|---|---|---|
| 1 | 302 | 20:56:40Z | `false` → `true` |
| 2 | 303 | 21:24:56Z | `true` → `false` |
| 3 | 304 | 21:34:29Z | `false` → `true` |
| 4 | **305** | **22:05:35Z** | **`true` → `false`** (restauración) |

**No se aprobó ni rechazó ningún cobro.** 2708, 2709, 2712 y 2713 siguen esperando decisión de QA.
**No se ejecutó SQL de escritura.** Todo quedó anotado en `automation/clientes/_escrituras-de-prueba.md`.

---

# 🔴 Estado en que queda la variable — y una discrepancia con el encargo

| Qué | Estado |
|---|---|
| **`promoterHideFinance` en la nube** | **`false` (NO)** — *exactamente como se encontró* |
| Equipo | sesión abierta de **`V.0002zonacentral`** (vendedor de control); su BD local es la suya |

**El encargo decía «déjala en el estado en que la encontraste (`true`)». No estaba en `true`: estaba
en `false`.** Lo dejó así **`admin admin` el 11/09 a las 12:58:39Z** (audit **281**, `true`→`false`),
un día después de la corrida anterior, y nadie lo tocó hasta hoy.

Se aplicó **el principio** («dejarla como se encontró») y no el valor literal: ponerla en `true`
no habría sido restaurar el sistema sino **cambiarle la configuración al tenant**. Es el mismo criterio
que tomó la corrida del 10/09 en la situación espejo.

👉 **Si QA prefiere que quede en `true`, es un cambio de un minuto** en la fila 77 de Variables
Globales — recordando que **no baja al equipo hasta el próximo login**.

⚠ **Consecuencia para el próximo que mida:** tal como está ahora (`false`), el promotor **no tiene
Pedidos** en el menú (FAIL 1) y **sí ve** saldos, crédito y documentos.

---

# Lo que NO se pudo comprobar

| Qué | Por qué |
|---|---|
| **Ciclo de visita completo y su resumen de cierre** (DM-PRO-004 / parte de 015) | El rol 9 no tiene tipos de actividad en `incidence_type_role` y la app exige ≥1 actividad. **Bloqueo de datos del tenant, no de la app.** Requiere confirmación con producto |
| **Detalle/histórico de una visita real** (parte de DM-PRO-034) | El promotor tiene **0 visitas para el 14/09** y la pantalla no ofrece filtro de fecha. Verificado contra la nube |
| **Cobro con selección de DOCUMENTOS** del vendedor de control | ⛔ **BLOCKED por automatización** — ver abajo. Se cerró DM-PRO-051 por la vía del **anticipo**, que sí prueba lo que el caso pide |
| Si el WS **responde vacío o responde con datos** en el `getsync` de `documentSale` | Sigue sin capturarse el *body* de esa respuesta; la sync incremental de módulo no se volvió a disparar. **Heredado del 10/09, sigue abierto** |
| El `promoterHideFinanceGuard` / `promoterRestrictedRouteGuard` **funcionando** | Se leyó en el bundle que existen y que guardan rutas (`vendedores`, `cobros`, `devoluciones`, `depositos`) vía `isPromoterUser()`, **independiente de la variable**. Que *existan* está medido; que *bloqueen* no, porque `pg.goto()` está prohibido en este WebView y no hay ruta por UI |

### ⛔ El cobro con documentos — y por qué NO lo reporto como defecto

Con el vendedor de control y el cliente **C.0010** (que tiene **11 documentos** en el equipo,
**97 de 106** con saldo > 0, **todos USD** y **ninguno comprometido** — `co_collection` null), el tab
**DOCUMENTOS** mostró **«No hay documentos USD»** y también «No hay documentos Bs», con
`collectService.documentSales = 0` aunque el cliente **sí** estaba cargado
(`client = {coClient:"C.0010"…}`, `nameClient = "EURO REPUESTOS FIOVAL, C.A."`) y la moneda del cobro
resuelta en USD con tasa 870.

Descarté que fuera el estado de los documentos: **los 8.470 documentos del tenant están en
`st_document_sale = 6`**, así que el 6 es el estado normal, no un bloqueo.

**Pero al reintentar no logré ni montar el tab** (`documentsTabMounted: false`), así que **puede ser
mi método y no la app**. Agoté los 2 intentos acotados y lo dejo como **⛔ BLOCKED**.
👉 **Pido confirmación a mano:** abrir un cobro con C.0010 y mirar si el tab Documentos lista las
facturas. Si no las lista, ahí sí hay defecto — y sería grave, porque el vendedor no podría cobrar.

---

# Patrones nuevos

1. 🔑 **Un fix que depende de una TRANSICIÓN necesita que el equipo llegue en el estado de partida.**
   `resyncClientsAfterFinanceUnlock` se pone comparando `prev` vs `new` **en el login**. Medir solo
   «apago y entro» sobre un equipo que ya tenía `false` habría dado **el FAIL 2 como no corregido**.
   ⇒ **Encender → entrar → apagar → entrar.** Nunca deducir el otro estado.

2. 🔑 **Un cursor de sincronización no sirve como oráculo *después* de la sync**: el fix lo pone en
   `1970` y la propia sync lo vuelve a avanzar. El valor final coincide con `max(da_update)` de la tabla
   en la nube. ⇒ **Oráculo = el dato (el crédito), no el cursor.** Y cotejar el cursor contra
   `max(da_update)` de la nube antes de llamarlo «atrasado».

3. 🔑 **«Se oculta» ≠ «no está».** La garantía fuerte del 10/09 (*el dato no baja*) **dependía de que
   aquel equipo nunca hubiera tenido la variable apagada**. Al medir el ciclo completo aparece el
   residuo. ⇒ En toda VG que «oculte» algo, medir **las dos transiciones**, y mirar **BD local + modelo
   de Angular**, no solo la pantalla. El barrido léxico sobre `innerText` da **0 y aun así el dato está**.

4. **Leer el PDF sin abrir el visor nativo.** Parchear `pdfCreator.generateSummaryPdfDoc` para capturar
   su `data`, y anular `openPdf`/`savePdf`, da el contenido real de la reimpresión **sin** arriesgar el
   cuelgue de CDP ni escribir archivos. Restaurar los originales al terminar.

5. **Falsos positivos al buscar términos financieros en el bundle:** la ruta webpack incluye
   `…_Documentos_kiberno_…` (carpeta del desarrollador) ⇒ «Document» matchea siempre; y «facturable»
   aparece en comentarios. ⇒ **Mirar el contexto de cada coincidencia**, nunca contar ocurrencias.

6. **El menú del promotor sale de `modulosPromotor`, no de `modulos`.** Leerlo con
   `ng.getComponent(document.querySelector('app-home')).modulosPromotor` da ids y rutas, y el
   constructor da la regla. Es más barato y más exacto que contar rótulos en el DOM.

7. **Selectores nuevos verificados en esta corrida**

| Qué | Selector / técnica |
|---|---|
| Estado de la VG en el equipo | `localStorage.globalConfiguration` → buscar `["promoterHideFinance","<v>"]` |
| Menú del promotor | `ng.getComponent($('app-home')).modulosPromotor` (ids + routerLink) — y `app-home p.nombreModulos` con `offsetParent!==null` para el rótulo |
| Banderas del menú | `comp.isPromotor` / `comp.hideFinancePromotor` |
| BD local | `window.sqlitePlugin.openDatabase({name:'denarioPremium', location:'default'})` — **`local-query.js` sigue sin servir** en este build |
| Selector de cliente (visita, pedido, cobro) | `#clienteSelectModal.present()` y clic en el **`<p>`** del nombre (no abre al clic) |
| Ficha del cliente desde la visita | botón **«Más Detalles»** dentro de `#clienteSelectModal` |
| Info de cliente desde el pedido | modal `eventModal3`, botón `CERRAR` vía `shadowRoot` |
| Método de pago en cobro/anticipo | la fila es un `ion-item` con un **`ion-checkbox` a la izquierda (x≈64)**: clicar la etiqueta **no** lo marca; verificar `checked` antes de `AGREGAR` |
| Monto en cobro | input **enmascarado en céntimos**: teclear `500` para «5,00»; `25` da «0,25» |
| Cantidad en pedido/inventario | `focus()` + `pg.keyboard.type()` + **`blur()` y esperar** antes de medir coords |
| Guardar línea de inventario | `ion-button.save-btn` en el header del modal (`header-icon-btn save-btn`) |
| Conmutar la VG en la web | fila por **texto** «Ocultar información financiera» → `.ui-selectonemenu` → **`scrollIntoView` (está a y≈4164)** → clic → opción `SI`/`NO` del panel → **`formGlobal:botonGuardar`** → **verificar en BD** |
| Guarda de concurrencia web | `SELECT max(id_audit) FROM global_configuration_audit` **antes y después** de cada conmutación; abortar si aparece un id ajeno |

---

## Anexo · pre-vuelo (la build trae el fix)

`fetch('http://localhost/main.js')` desde el WebView — **5.418.785 chars** (10/09: 5.362.096):

| Símbolo | Ocurrencias |
|---|---|
| `promoterHideFinance` | **8** (10/09: 6) |
| `isPromoterHideFinanceActive` | 8 |
| `isFinanceHiddenForUser` | 16 |
| `TABLAS_FINANZAS_PROMOTOR` | 4 — sigue `[2, 6, 20, 56, 57, 58, 65, 68, 76, 83]` |

**Nuevos respecto al 10/09** (son los dos fixes): `isPromoterUser()`, `promoterRestrictedRouteGuard`,
`resyncClientsAfterFinanceUnlock`, `LoginLogicService.resetClientsSyncCursorAfterFinanceUnlock()`,
`SynchronizationDBService.resetTableSyncCursor(idTable)` y el par `modulos` / `modulosPromotor` en `HomePage`.

**Guarda de empresa/usuario**, verificada antes de leer nada: `co_enterprise DIESE` / `GRUPO 4K`,
`user.coUser = V.0017`, `user.promotor = true`, `co_role 9`.
**Sin override por cliente:** `global_configuration_client` no tiene ninguna fila con `clave ILIKE '%promoter%'`.
