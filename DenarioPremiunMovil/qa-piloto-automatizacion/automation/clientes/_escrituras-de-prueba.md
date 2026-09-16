# Escrituras de prueba pendientes de deshacer

Datos y configuraciones que **nosotros** cambiamos en la BD o en la web de un cliente para
poder probar algo, y que **siguen puestos**.

**Por qué existe este archivo:** una VG que dejamos cambiada no se nota. La próxima corrida
mide contra una configuración que nadie recuerda haber tocado, y el resultado parece un
defecto del producto. Es la forma más cara de perder una tarde.

**Cómo se usa**
- Se anota **en el momento** de hacer la escritura, no al final del día.
- Cuando se deshace, **se borra la fila**. No se tacha ni se marca «listo»: este archivo
  vacío significa «no debemos nada», y esa es toda su utilidad.
- Si una escritura se vuelve permanente porque al cliente le sirve, también se borra de
  aquí y se anota como valor en su `.yaml`.

---

## IMPORTADORA 4K

| Desde | Qué cambiamos | Para qué | Cómo se deshace |
|---|---|---|---|
| 07/09 | **`clientBankAccount`** pasó de `false` a **`true`** | ver si llegaba la lista de Banco Emisor en Transferencia | Variables Globales → Cobros, volverla a `false` |
| 07/09 | **3 cuentas** insertadas en `client_bank_account` | probar el selector de cuenta del cliente | `DELETE` de las 3 filas de prueba |
| 07/09 | **3 descuentos** creados: `DESC 10 TEST` (10 % fijo), `DESC MANUAL`, `DESC MANUAL TEST` | probar el tope `maxCollectDiscount` | Empresa → Configuración → Descuentos para Cobros. ⚠ **No borrar «Probando» (80 %)**: ese es del cliente |
| 08/09 | **`RangoToleranciaPositiva`** pasó de `10` a **`49,99`** | probar decimales en la tolerancia | volverla a `10`, o dejarla si sirve al cliente. ⚠ **Antes de bajarla, leer la nota de abajo**: con esta build, 49,99 es justo el valor que deja la banda que bloquea en CERO |
| 02-04/09 | **Bancos creados** durante el REQ de CRUD, entre ellos `QA NUEVO BANCO` | certificar el CRUD | Datos Maestros → Bancos, deshabilitarlos |

🔴 **Tolerancia y anticipo — estado al cierre del 10/09 (corrida `fixes_cobros_20260910`).**
Durante esa corrida se movieron `RangoToleranciaPositiva` (a `10,50`), `RangoToleranciaNegativa`
(a `0,01`) y `prepaidRangeAmount` (a `1`) para medir los tramos. **Las tres quedaron DESHECHAS**;
la configuración final, leída del EQUIPO tras re-loguear, es:

| VG | Valor final |
|---|---|
| `RangoToleranciaPositiva` | **49,99** |
| `RangoToleranciaNegativa` | **10,00** |
| `prepaidRangeAmount` | **50** |
| `MonedaTolerancia` / `prepaidRangeCurrency` / `prepaidCurrency` | **USD** · `TipoTolerancia` **0 (Importe)** |

⚠ **La zona gris NO va de 49,99 a 99,99** — esa nota (del 08/09) partía de suponer que el umbral
del anticipo es `tolerancia + prepaidRangeAmount`. **Medido en el equipo, el umbral es
`prepaidRangeAmount` a secas.** Con 49,99 / 50 la banda que bloquea es el intervalo abierto
(49,99 ; 50,00): **de ancho cero a dos decimales**. Los tramos reales son:
`≤ 49,99` → Enviar directo · `≥ 50,00` → anticipo automático · **nada bloquea por exceso**.
⇒ **Si se baja `RangoToleranciaPositiva` a 10 se ABRE una banda de 39,99** (10,01 … 49,99) en la
que el cobro no se puede enviar. Detalle y evidencia en
`automation/reports/4k/fixes_cobros_20260910/01-tolerancia-y-anticipo.md`.

---

🔴 **2.ª pasada del 10/09 (`fixes_cobros_20260910`, informe `02-tolerancia-y-anticipo-main.md`).**

⚠ **Corrección de la nota de arriba:** al abrir esta pasada, `prepaidRangeAmount` valía **`1`**,
no `50`, tanto en la WEB como en el EQUIPO. **El deshacer de la 1.ª pasada no llegó a guardarse.**
Configuración realmente encontrada: `RangoToleranciaPositiva 49,99` · `RangoToleranciaNegativa 10,00`
· `prepaidRangeAmount 1,00`.

Escrituras de esta pasada (Variables Globales → Cobros, `#formGlobal:botonGuardar`):

| Hora | Qué cambiamos | Para qué | Cómo se deshace |
|---|---|---|---|
| 14:15 | `RangoToleranciaPositiva` **49,99 → 10,00** y `prepaidRangeAmount` **1,00 → 50,00** | configuración 1 del experimento: tolerancia POR DEBAJO del mínimo de anticipo (queda hueco) | Variables Globales → Cobros, volver a 49,99 / 50,00 |
| 15:05 | `RangoToleranciaPositiva` **10,00 → 49,99** | configuración 2: tolerancia = mínimo − 0,01 (sin hueco) | volver a 49,99 (ya está) |
| 15:23 | `prepaidRangeAmount` **50,00 → 0,01** | configuración 3: solapamiento TOTAL — comprobar qué manda cuando el mínimo de anticipo cae por debajo de toda la tolerancia | Variables Globales → Cobros, volver a **50,00** |
| 15:28 | `prepaidRangeAmount` **0,01 → 50,00** y confirmación de `RangoToleranciaPositiva 49,99` / `RangoToleranciaNegativa 10,00` | **deshacer**: dejar la configuración final | — ya deshecho |

⚠ **La web ya NO acepta escrituras por `el.value` ni por teclado sintético**: el spinner de
PrimeFaces restaura su valor interno. Para cambiar estas VG hay que usar el widget
(`PrimeFaces.widgets['widget_formGlobal_tablaConf_<fila>_j_idt137'].setValue(n)` + `input.trigger('change')`)
o teclear de verdad. Un intento a medias deja el valor interno corrupto (se vio `10.004999`).

**Configuración final dejada al cerrar** — verificada por PARTIDA DOBLE:
`global_configuration` (BD) **y** `localStorage.globalConfiguration` (equipo, login de las 14:43).
🔴 **La WEB no sirve de testigo**: ver el aviso de abajo.

| VG | BD | EQUIPO |
|---|---|---|
| `RangoToleranciaPositiva` | **49.99** | **49.99** |
| `RangoToleranciaNegativa` | **10** | **10** |
| `prepaidRangeAmount` | **50** | **50** |
| `MonedaTolerancia` / `prepaidRangeCurrency` / `prepaidCurrency` | USD | USD |
| `TipoTolerancia` / `tolerancia0` / `automatedPrepaid` | 0 / true / true | ídem |

Es la configuración que el encargo daba como «de partida» y la que deja la banda que bloquea
por exceso en ancho cero.

---

🔴🔴 **AVISO IMPORTANTE PARA QUIEN TOQUE ESTAS VG DESPUÉS (defecto D-03)**

**Abrir `/pages/variablesConfiguracion` y elegir el tipo «Cobros» puede REVERTIR una variable
sola, sin pulsar Guardar.** Medido hoy: a las 18:40:47 UTC, un segundo después de abrir la
pantalla, la auditoría registró `prepaidRangeAmount: 50 → 0.01` — el valor viejo que la pantalla
estaba mostrando (el render va atrasado). Pasó **dos veces**. Además, **un solo clic en Guardar
deja dos escrituras** en la auditoría.

**Consecuencias prácticas:**
1. **Nunca dar por buena la pantalla.** Comprobar siempre con
   `node automation/db/query.js 4k "SELECT clave, valor FROM global_configuration WHERE clave IN ('RangoToleranciaPositiva','RangoToleranciaNegativa','prepaidRangeAmount')"`.
2. **Tras guardar, salir de la pantalla y no volver a entrar** antes de medir.
3. Para auditar qué se escribió y cuándo:
   `SELECT id_audit, na_variable, old_value, new_value, da_update FROM global_configuration_audit ORDER BY id_audit DESC LIMIT 20`.
4. Si el equipo y la BD no coinciden, **manda la BD** y hace falta un **login nuevo** en el equipo
   (~11 s hasta que baja la VG, ~60 s hasta volver a HOME).

Detalle y cronología en `automation/reports/4k/fixes_cobros_20260910/02-tolerancia-y-anticipo-main.md`, §9 D-03.

---

## HIDROPONIAS

| Desde | Qué cambiamos | Para qué | Cómo se deshace |
|---|---|---|---|
| 09/09 | **1 fila en `user_address_clients`** (`id_user_address_clients 40`): el cliente **INVERSIONES 250 LA CORNETERIA** (`id_address_client 931` / `co 9999932`) quedó asignado al vendedor **V3 · ROGER MUESES** (`id_user 469`) | Es el **único** cliente de la base con un mismo producto en dos facturas del mismo día (`CAMPROLEC012BOLUNI` ×25 en la 20118201 y ×25 en la 20118244, del 07/09). Sin vendedor asignado no bajaba a ningún equipo y DM-SUG-011 quedaba sin probar | `DELETE FROM user_address_clients WHERE id_address_client = 931 AND id_user = 469;` — está al final de `automation/db/sql/hidroponias-asignar-corneteria-a-v3.sql` |

| 09/09 | **`address_client.da_update` de la fila 931** reescrito a `2026-09-09T19:22:09.126Z` | forzar que la sincronización incremental bajara el cliente al equipo de V3 | se pisa solo la próxima vez que se edite el cliente; no hace falta deshacerlo |

⚠ Ejecutado por desarrollo el 09/09 a petición de QA (la conexión de QA es de solo lectura).
Tras el `INSERT` hay que **sincronizar el dispositivo** para que bajen el cliente y sus
facturas. Si se deja puesto, ese vendedor sigue viendo un cliente que no es suyo.

🔴 **El estampado del 09/09 NO alcanzó, y además quemó el cursor** (vuelta 2, Defecto 1). El
equipo avanzó `versionsTables.addressClientTable.last_update` **exactamente** a
`2026-09-09 15:22:09.126` —el `da_update` de la fila 931— y aun así la fila **no quedó** en
`address_clients` (17 filas, `max(id_address) = 852`). Como la sincronización es incremental,
ese registro **ya no se vuelve a ofrecer**. Falta además `client.da_update` de `9999932`, que
sigue en `2026-09-08T19:08:01.483Z` = **el cursor `clientTable` que el equipo ya tiene**, así
que la fila del cliente padre nunca se envía.
**Para destrabar DM-SUG-011:** estampar `da_update` con `now()` en **`address_client` 931 Y en
`client` 316**, y volver a sincronizar.

---

🔴 **3.ª pasada del 10/09 (`fixes_cobros_20260910`, informe `03-fixes-cobros.md`) — IMPORTADORA 4K.**

**No se tocó ninguna VG ni ninguna pantalla de la web en esta pasada.** Solo se crearon registros
en el equipo con el cliente **C.0210 · INVERSIONES RUISAN, C.A.**:

| Cuándo | Qué quedó | Estado | Cómo se deshace |
|---|---|---|---|
| 10/09 | Cobro **`co_collection 1789067734443.0`** — FAC 00022135 (120,00 USD) con **descuento manual 200,00** | **Guardado en el equipo** (`st_delivery=3`, `id_collection=0`), **NO llegó a la nube** | Es la evidencia del FAIL del punto 3 (Enviar deshabilitado). Borrarlo desde BUSCAR → papelera cuando desarrollo lo haya visto |

⚠ Ese cobro Guardado **compromete la factura 00022135** de C.0210 en el Tab Documentos hasta que se borre.
Documentos USD de C.0210 al abrir la pasada: `00022131` 871,00 · `00022132` 640,00 · `00022133` 440,00 · `00022135` 120,00.

**Cobros ENVIADOS a la nube en esta misma pasada** (documentos de C.0210 consumidos):

| Ref (`id_collection`) | Qué es | Documento consumido |
|---|---|---|
| **2643** | Cobro con los 6 métodos de pago, 931,00 USD | `FAC 00022131` (871,00 USD) |
| **2644** | Anticipo automático por el excedente de 60,00 USD (generado por el 2643) | — |
| **2645** | Cobro con Cheque 640,00 USD, Banco Emisor **BANCO MERCANTIL** | `FAC 00022132` (640,00 USD) |

⇒ **A C.0210 le queda UN solo documento USD libre: `00022133` (440,00 USD)**, más el `00022135`
que libera el borrado del cobro Guardado de arriba. Avisar antes de planificar otra corrida con
este cliente.

ℹ️ También se **reinició la app y se volvió a loguear** (para bajar el tag `COB_MSG_AUTOMATED_PREPAID`
corregido y para limpiar el estado pegado del punto 3). No es una escritura: no hay nada que deshacer.

---

🔴 **REQ rol PROMOTOR — IMPORTADORA 4K, 10/09 (corrida `req_rol_promotor_20260910`).**

Pantalla tocada: **web CARIBE → Empresa → Variables Globales → Empresa** (`/pages/variablesConfiguracion`),
fila `data-ri="77"`, control `formGlobal:tablaConf:77:j_idt128_input`.

| Cuándo | Qué cambiamos | Para qué | Cómo se deshace |
|---|---|---|---|
| 10/09 ~17:55 | **`promoterHideFinance`: SI (`true`) → NO (`false`)** | medir el Bloque A (no-regresión con la variable APAGADA) y el Bloque E (que «Sincronizar» no la baja y el login nuevo sí) | volver a poner **SI** en la misma fila 77 de esa pantalla |

⚠ **Estado en que se encontró: `true` (SI)**, puesta por `admin` el 07/09 (audit id 240).
**Estado en que hay que dejarla al cerrar: se indica al final de esta entrada.**

Auditoría: `SELECT id_audit,na_variable,old_value,new_value,da_update FROM global_configuration_audit WHERE na_variable='promoterHideFinance' ORDER BY id_audit DESC`.

ℹ️ Registro creado en el equipo durante la corrida (no es config, no hay que deshacerlo):
**pedido `id_order 2593`** (`co_order 1789076633777.0`), cliente C.0017, 40,50 USD, vendedor V.0017 — Enviado y en la nube.

**Cierre de la entrada del REQ rol PROMOTOR (10/09).** Movimientos reales sobre la fila 77:

| Hora (UTC) | Cambio | audit |
|---|---|---|
| 21:53:45 | `promoterHideFinance` **true -> false** | id 278 |
| 22:01:19 | `promoterHideFinance` **false -> true** | id 279 |

**ESTADO FINAL: `true` (SI) — igual que como se encontró.**

Se dejó ENCENDIDA a propósito, no apagada: la puso `admin` el 07/09 (audit id 240) para este REQ, así
que apagarla sería cambiarle la configuración al tenant, no restaurarla. Si QA quiere dejarla apagada:
web CARIBE -> Empresa -> Variables Globales -> Empresa -> fila "¿Ocultar información financiera al rol
Promotor?" -> NO -> **Guardar** (sin pulsar Guardar NO persiste: la etiqueta cambia y la BD no).
Recordar que **no baja al equipo hasta el próximo login**, nunca con "Sincronizar".

⚠ El equipo quedó con sesión de `V.0002zonacentral` y su propia BD local (la del promotor se borró al
cambiar de usuario, con el aviso de la app). No hay nada que deshacer ahí.

---

## 4K · CARIBE · Cobros — pendientes de la siguiente vuelta (10/09, tarde)

Corrida `automation/reports/4k/fixes_cobros_20260910/` · informe `04-cobros-pendientes.md`.

### Escritura 1 — `prepaidRangeAmount` 50 → 1 (SE DEJA PUESTA A PROPÓSITO)

| Dato | Valor |
|---|---|
| Ruta web | CARIBE → `/pages/variablesConfiguracion` → tipo **Cobros** → fila «Indique El monto mínimo excedido en el cobro para generar el abono automático» |
| Estado en que se encontró | **50** (`da_update` 2026-09-10 18:42:18Z) |
| Estado en que se deja | **1** (= 1,00) — `da_update` 2026-09-10 22:26:13Z |
| Acuse de la web | growl «Operación Exitosa · Configuración guardada exitosamente» |
| Verificación | `node automation/db/query.js 4k "SELECT clave,valor,da_update FROM global_configuration WHERE clave='prepaidRangeAmount'"` → `1` |

🔴 **NO restaurar a 50 sin avisar.** Se deja en **1,00** junto con la tolerancia positiva en **49,99**
porque ésa es la única combinación con la que el caso «anticipo automático que se come la tolerancia»
**se reproduce a mano en dos minutos** (ver el punto 1 del informe 04). Es material de prueba para que
la responsable QA lo vea con sus propios ojos.

**Cómo deshacerlo** (cuando QA ya lo haya visto): misma ruta, teclear `50` en esa fila y pulsar
**Guardar**. Sin pulsar Guardar no persiste. **No baja al equipo con «Sincronizar»: hace falta un
login nuevo.**

**`RangoToleranciaPositiva` (49,99) y `RangoToleranciaNegativa` (10) NO se tocaron** en esta vuelta
— `da_update` sigue en 2026-09-10 18:36:56Z para ambas.

ℹ️ De paso: abrir `/pages/variablesConfiguracion` y elegir el tipo «Cobros` **sin pulsar Guardar**
**no** revirtió ningún valor esta vez (D-03 del informe 02 **no reprodujo**): los tres `da_update`
quedaron intactos hasta que se pulsó Guardar de verdad.

### Cierre de la entrada — estado en que queda 4K (10/09, ~23:15Z)

**Verificado en los dos lados** (`global_configuration` de la nube y `localStorage` del equipo):

| VG | Valor al cierre | ¿Se tocó hoy? |
|---|---|---|
| `prepaidRangeAmount` | **1** (= 1,00) | **SÍ** — era 50 · **se deja a propósito** |
| `RangoToleranciaPositiva` | 49,99 | no |
| `RangoToleranciaNegativa` | 10 | no |
| `enableDifferenceCodes` | true | no |
| `promoterHideFinance` | true | no — venía así de la corrida del rol Promotor |

**Es la única escritura de configuración de esta vuelta.** Con 49,99 / 1,00 el caso del anticipo
automático que se come la tolerancia **se reproduce a mano en dos minutos** (receta en el punto 1
del informe `04-cobros-pendientes.md`).

⚠ **Al reproducirlo a mano, ojo con la moneda:** el cobro nace en **Bs** y la tolerancia está en
**USD**. Pagar «5,00 de más» en un cobro en Bs son **0,01 USD** y no dispara nada. Con la tasa de
hoy (870,00) hay que pagar **≥ 870 Bs de más**; con **4.350,00 Bs de más** salen los 5,00 USD del
ejemplo.

ℹ️ **Registros creados en el equipo durante la corrida** (no son configuración, no hay que
deshacerlos): cobros **2653** (C.0210), **2654**, **2655**, **2657** y el **anticipo automático
2656** (5,00 USD), todos de C.0538 salvo el primero. Los 5 están enviados y en la nube.

ℹ️ **Consumo de documentos:** **C.0210 quedó AGOTADO** (su último documento USD libre se fue en el
cobro 2653). El relevo para cobros en 4K es **C.0538**, que al cierre conserva 3 documentos USD
libres.

⚠ **No se creó ningún descuento de cobro ni código de diferencia**: el punto 2 quedó *no
comprobado* justamente por eso (hoy no hay ningún descuento con «requiere monto» en el catálogo —
los dos que existían se borraron en la web el 07/09). Si QA quiere cerrarlo, hay que **crear uno**
en Empresa → Configuración → Descuentos para Cobros y **sincronizar**; esa sí sería una escritura
nueva que habría que anotar aquí.

---

### 14/09 · Corrida `notas_credito_20260914` (4K · V.0030 · C.0864)

ℹ️ **Registros creados en la nube** (transacciones, no configuración — no hay VG que deshacer):

| Ref | Tipo | Cliente | Monto | Comentario |
|---|---|---|---|---|
| **2708** | `co_type=0` cobro | C.0864 MULTISERVICIOS DON PEDRO MARRON | 0,00 USD | `Test-NC-0864-154057` |
| **2709** | `co_type=1` **anticipo** | C.0864 | **144,00 USD** | `Test-NC-0864-154057` |

Documentos involucrados: **FAC `00022180`** (saldo 2.552,00, pago parcial de 100,00) y
**N/C `*0001523`** (−244,00, aplicada entera).

**Cómo se deshace:** son documentos de un cliente REAL. Si hay que revertirlos, se anulan/rechazan
los cobros **2708 y 2709** desde la web (Cobros → por aprobar) para que los saldos de `00022180` y
`*0001523` vuelvan a 2.552,00 y −244,00. **No se tocó ninguna variable global ni la configuración
de la web en esta corrida.**

---

### 14/09 · Corrida `notas_credito_20260914` — repetición (4K · V.0030 · **C.0321**)

ℹ️ **Registros creados en la nube** (transacciones, no configuración — no hay VG que deshacer):

| Ref | Tipo | Cliente | Monto | Comentario |
|---|---|---|---|---|
| **2712** | `co_type=0` cobro | C.0321 ELIFAZ PART S, C.A. | 0,00 USD | `Test-NC-0321-rep2-162958` |
| **2713** | `co_type=1` **anticipo** | C.0321 | **60,00 USD** | `Test-NC-0321-rep2-162958` |

Documentos involucrados: **FAC `00021022`** (saldo 85,00, **SIN pago parcial**) y
**N/C `00002222`** (−145,00, aplicada entera). Método **Otros** con código `test_excedente`.

**Cómo se deshace:** son documentos de un cliente REAL. Se revierten **rechazando los cobros 2712 y
2713 desde la web** (Cobros → por aprobar), que devuelve `00021022` y `00002222` a disponibles con
sus saldos de +85,00 y −145,00. **No se aprobó ni rechazó nada desde el agente** — eso lo hace QA.
**No se tocó ninguna variable global ni la configuración de la web. No se ejecutó SQL de escritura.**

⚠ **Estado en que queda C.0321:** sus dos únicos documentos activos vuelven a quedar comprometidos
por el cobro 2712. Para repetir otra vez el caso hay que **rechazar 2712/2713 primero** (igual que se
hizo con 2710/2711), o preparar otro par FAC + N/C en la cartera de V.0030.

---

### 14/09 · Corrida `req_rol_promotor_20260914` (4K · DIESE/GRUPO 4K · playa CARIBE)

⚠️ **VARIABLE GLOBAL CONMUTADA** — `promoterHideFinance` (`global_configuration.clave`,
fila web `formGlobal:tablaConf:77`, `id_variable` 83 / audit `na_variable=promoterHideFinance`).

🔴 **Estado EN QUE SE ENCONTRÓ: `false` (NO)** — *no* `true` como decía el encargo.
Lo dejó así **`admin admin` el 11/09 a las 12:58:39Z** (audit **id 281**, `true`→`false`),
un día después de la corrida del 10/09. Nadie lo tocó entre el 11/09 y el inicio de esta corrida
(último audit del tenant: id 301, `enabledManualRate`, 14/09 17:16:52Z — variable ajena).

**Conmutaciones de esta corrida** (todas desde la web, fila localizada por TEXTO «Ocultar
información financiera», nunca por índice; se verifica en BD tras cada Guardar):

| # | Hora (UTC) | Cambio | Motivo | audit id |
|---|---|---|---|---|
| 1 | _(pendiente)_ | `false` → `true` | medir bloque B (VG encendida) | |
| 2 | _(pendiente)_ | `true` → `false` | re-medir FAIL 1 (menú) y FAIL 2 (crédito/cursor) | |
| 3 | _(pendiente)_ | `false` → `true` | DM-PRO-042 en sentido inverso + bloque F | |
| 4 | _(pendiente)_ | `true` → `false` | **restaurar el estado en que se encontró** | |

**Cómo se revierte:** web → Empresa → Variables Globales → fila «¿Ocultar información financiera al
rol Promotor?» → poner **NO** → **Guardar** (el `growl` no es oráculo: verificar con
`SELECT valor FROM global_configuration WHERE clave='promoterHideFinance'`).
⚠ El cambio **no baja al equipo con «Sincronizar»**: solo con **login nuevo**.

**No se aprobó ni rechazó ningún cobro** (2708, 2709, 2712, 2713 siguen esperando decisión de QA).
**No se ejecutó SQL de escritura.**

**Registro creado (transacción, no configuración):**

| Ref | Tipo | Cliente | Monto | Comentario | Estado |
|---|---|---|---|---|---|
| **2595** | pedido | C.0017 CUMMINS DIESEL PARTS | 40,50 USD / 35.235,00 Bs | `QA-PRO-4K-171941` | **Enviado**, en la nube (`st_order 1`, `id_user 301`/`V.0017`) |

Producto `1R1807-4K` FILTRO DE ACEITE CATERPILLAR 3116 · 3 UNIDAD · 13,50 USD.
**Cómo se deshace:** es un pedido de un cliente real; si molesta, se anula/rechaza desde la web
(Pedidos → por aprobar). No bloquea documentos ni saldos.

| **101** | inventario | C.0017 CUMMINS DIESEL PARTS | `1R1807-4K` · 5 UNIDAD · lote `QA0914` (Exhibición) | — | **Enviado**, en la nube (`id_user 301`) |

**Cómo se deshace:** inventario de un cliente real; no compromete documentos ni saldos. Si molesta,
se anula desde la web.

**Conmutaciones REALIZADAS** (audit verificado en BD tras cada Guardar; no apareció ningún
`id_audit` ajeno entre medias — el último previo del tenant era el 301, `enabledManualRate`):

| # | audit | Hora (UTC) | Cambio | Para qué |
|---|---|---|---|---|
| 1 | **302** | 2026-09-14 20:56:40Z | `false` → `true` | medir bloque B con la VG encendida |
| 2 | **303** | 2026-09-14 21:24:56Z | `true` → `false` | re-medir FAIL 1 (menú) y FAIL 2 (crédito) |
| 3 | **304** | 2026-09-14 21:34:29Z | `false` → `true` | DM-PRO-042 en sentido inverso + bloque F |
| 4 | _(al cierre)_ | | `true` → **`false`** | **restaurar el estado en que se encontró** |

| **2714** | **anticipo** (`co_type=1`) | C.0010 EURO REPUESTOS FIOVAL | 5,00 USD (Efectivo) | `QA-PRO-F-180118` | **Enviado**, en la nube (`id_user 300` = V.0002, vendedor de control) |

Creado para cerrar **DM-PRO-051** (que un cobro de un vendedor normal sigue llegando a la nube con la
VG encendida). **Cómo se deshace:** rechazar el cobro **2714** desde la web (Cobros → por aprobar).
No compromete ninguna factura: es un anticipo, no aplica documentos.
⚠ **No se aprobó ni rechazó nada**: 2708, 2709, 2712 y 2713 siguen intactos esperando a QA.

✅ **CIERRE — la variable quedó en `false` (NO), audit 305, 2026-09-14 22:05:35Z**, que es
**el estado exacto en que se encontró** al empezar (lo había dejado así `admin` el 11/09, audit 281).

🔴 **Ojo, discrepancia con el encargo:** la instrucción decía «déjala en `true`, que es como la
encontraste». **No era `true`: estaba en `false`.** Se aplicó el principio («dejarla como se encontró»)
y no el valor literal, porque poner `true` habría sido **cambiarle la configuración al tenant**, no
restaurarla. Si QA prefiere que quede en `true`, es un minuto en la fila 77 de Variables Globales
— y recordar que **no baja al equipo hasta el próximo login**.

Ningún `id_audit` ajeno apareció durante la corrida: el tenant pasó de 301 a 305 y las cuatro
conmutaciones intermedias (302-305) son todas de esta corrida.

---

## 2026-09-14 · `pulido_scripts_20260914` — 4K / DIESE / CARIBE · V.0002 (idUser 300)

Corrida de **pulido de los scripts de cobros y pedidos** (no de búsqueda de defectos).
4K es ambiente de prueba: QA levantó la restricción de volumen a media tarea.

**No se aprobó ni rechazó ningún cobro.** 2708, 2709, 2712 y 2713 siguen intactos
esperando decisión de QA. **No se ejecutó SQL de escritura.** **No se tocó la
configuración de la web** (ninguna variable global, ningún catálogo).

### Cobros ENVIADOS a la nube (los únicos registros que salen del equipo)

| id_collection | co_type | Cliente | Monto | Exceso | Comentario | Por qué |
|---|---|---|---|---|---|---|
| **2715** | 0 cobro | C.0538 | 8,75 USD | 0 | `Test-COB-620364` | DM-COB-019 · **prueba del disparo único: 1 fila, no 2** |
| **2716** | 0 cobro | C.1018 | 1.048,99 USD | 49,99 | `Test-TOL-DENTRO-997017` | DM-COB-056 · tolerancia positiva, sin anticipo |
| **2717** | 0 cobro | C.1018 | 747,00 USD | 50,00 | `Test-TOL-ANTIC-054517` | DM-COB-057 · **no generó anticipo** (ver defecto) |
| **2718** | 0 cobro | C.0340 | 368,00 USD | 50,00 | `QA-ANT-directo-533241` | sonda A/B · envío DIRECTO |
| **2719** | 1 anticipo | C.0340 | **0,01 USD** | — | `QA-ANT-directo-533241` | anticipo automático que SÍ se creó |
| **2720** | 0 cobro | C.0830 | 234,50 USD | 50,00 | `QA-ANT-reabierto-628718` | sonda A/B · Guardado reabierto → **sin anticipo** |

**Cómo se deshace:** son cobros de clientes reales en ambiente de prueba. Si molestan,
se **rechazan** desde la web (Cobros → por aprobar), lo que además **libera sus
documentos** para volver a usarlos. No hay que tocar la BD.

⚠ **Cada cobro enviado deja su factura «Por aprobar» y la saca del Tab Documentos.**
Tras esta corrida, C.0538 / C.1018 / C.0340 / C.0830 tienen menos documentos libres.
El pool vigente está en `automation/clientes/4k.yaml` → `modules.cobros.clientes_con_documentos`.

### Cobros GUARDADOS (locales, nunca salieron del equipo)

Los sub-flujos de Fase 2 (moneda, Tab Total, pago parcial, retención, anticipo manual)
guardan en la SQLite del equipo y **eliminan el guardado al terminar**. No llegan a la nube.
Si alguno quedara en la lista por un fallo a mitad de camino, se borra con la papelera
de Cobros → BUSCAR.

### Ampliación de la corrida — cobros (vueltas 2, 3 y 4) y sondas del anticipo

| id_collection | co_type | Cliente | Monto | Exceso | Comentario | Caso |
|---|---|---|---|---|---|---|
| **2721** | 0 | C.0538 | 489,00 USD | 0 | `Test-COB-822593` | DM-COB-019 (v3) — 1 fila |
| **2722** | 0 | C.1018 | 341,99 USD | 49,99 | `Test-TOL-DENTRO-335425` | DM-COB-056 (v3) |
| **2723** | 0 | C.0538 | 2.880,00 USD | 0 | `Test-COB-644673` | DM-COB-019 (v4) — 1 fila |
| **2724** | 0 | (relevo) | 453,60 USD | 0 | `Test-DTO-752031` | DM-COB-055 — descuento 10 % |
| **2725** | 0 | (relevo) | 349,99 USD | 49,99 | `Test-TOL-DENTRO-193855` | DM-COB-056 (v4) |
| **2726** | 0 | (relevo) | 306,00 USD | 50,00 | `Test-TOL-ANTIC-243302` | DM-COB-057 — envío DIRECTO |
| **2727** | **1 anticipo** | — | **0,01 USD** | — | `Test-TOL-ANTIC-243302` | anticipo automático ✅ |
| **2728** | 0 | (relevo) | 384,00 USD | 50,00 | `Test-TOL-REAB-…` | DM-COB-058 — **sin anticipo** (defecto D-1) |

**Cómo se deshace:** rechazando los cobros desde la web (Cobros → por aprobar), lo que además
**libera sus documentos**. Ningún SQL de escritura, ninguna variable global tocada.

### Pedidos

Las corridas de pedidos del 14/09 **no llegaron a enviar ningún pedido**: se cayeron antes, en el
selector de cliente (vuelta 1) y en el alta de la línea (vuelta 2). El único pedido de QA del día
sigue siendo el **2595**, de la corrida anterior (`req_rol_promotor_20260914`).

**Pedidos enviados durante el pulido** (cierre): **2596** · **2597** · **2598** · **2599** · **2600** · **2601** · **2602**,
todos de `C.0010` EURO REPUESTOS FIOVAL, 27,00 USD, producto `1R1807-4K` × 2, con comentarios
`Test-PED-######`. Enviados a la nube (`st_order 1`, `id_user` 300).
**Cómo se deshace:** se anulan/rechazan desde la web (Pedidos → por aprobar). No comprometen
documentos ni saldos.

---

## 2026-09-14 · `barrida_v22_20260914` — 4K / DIESE / CARIBE · V.0002 (idUser 300)

Barrida completa de los 10 módulos previa al tag de la **v22**, más dos relanzamientos aislados
(`devoluciones`, `clientes`). Informe: `automation/reports/4k/barrida_v22_20260914/00-CONSOLIDADO.md`.

> **No se tocó ninguna variable global ni la configuración de la web, y no se ejecutó ningún SQL
> de escritura.** Los cobros **2708, 2709, 2712 y 2713** quedaron intactos: se comprobó con
> snapshot antes y después que su `st_collection` y su `da_update` no cambiaron.

### Registros ENVIADOS a la nube

| Tabla | id | Qué es | Marca |
|---|---|---|---|
| `collection` | **2729** | cobro 72,00 USD · C.0538 | `Test-COB-691253` |
| `collection` | **2730** | cobro 1.707,75 USD · C.0461 (con descuento) | `Test-DTO-786520` |
| `collection` | **2731** | cobro 283,99 USD · C.0558 · dif 49,99 (dentro de tolerancia) | `Test-TOL-DENTRO-329824` |
| `collection` | **2732** | cobro 2.295,00 USD · C.0541 · dif 50,00 | `Test-TOL-ANTIC-377563` |
| `collection` | **2733** | **anticipo** 0,01 USD (`co_type=1`) — par legítimo del 2732 | `Test-TOL-ANTIC-377563` |
| `collection` | **2734** | cobro 630,00 USD · C.1007 · dif 50,00 **sin anticipo** (defecto D-1) | `Test-TOL-REAB-476638` |
| `potential_client` | **97** | cliente potencial | `Test-CLT-SMOKE-301255` |
| `potential_client` | **98** | cliente potencial (relanzamiento) | `Test-CLT-SMOKE-096837` |
| `deposit` | **43** | depósito 270.000,00 · `st=3` | — |
| `visit` | **36778** | visita · `st_visit=2` | — |
| `return` | **230** | devolución enviada · `st=1` (relanzamiento) | — |
| `order` | **2603** | pedido 27,00 USD · `st_order=1` | `Test-PED-584621` |

**Cómo se deshace:** rechazar/anular desde la web (Cobros → por aprobar · Pedidos → por aprobar).
Ningún SQL de escritura, ninguna VG tocada.

🔴 **Importante para la próxima corrida — el pool de documentos libres quedó AGOTADO.**
`DM-COB-034` salió FAIL con `documentos con USD: 0 · con Bs: 0`, y 5 casos más
(`DM-COB-014/015/038/039/047`) quedaron BLOCKED por lo mismo. La progresión del día fue
**3 → 2 → 1 → 0**: cada cobro enviado compromete su factura y la saca del Tab Documentos.
**Rechazar los cobros «Por aprobar» libera sus documentos** y es lo único que hace falta para
que cobros vuelva a medirse entero. (Recordatorio: `document_sale.co_collection` sigue en NULL
aunque el documento esté comprometido — la BD no sirve para inventariar esto; manda el Tab
Documentos.)

⚠ **Hueco de perfil, pendiente de rellenar (no es una escritura, es un dato que falta):**
en `automation/clientes/4k.yaml`, `modules.devoluciones.factura_test` y `producto_test` valen la
**cadena literal `"TBD"`**, no `null`, así que el guion las toma por buenas. Facturas reales de
C.0028 para ponerlas: `00022037` (71,00) · `00021993` (saldo 366) · `00021887` · `00021839`.

---

## Cierre del guion de COBROS — 15/09/2026 · `cierre_cobros_20260915`

Cliente **4k** · empresa `DIESE` · playa **CARIBE** · vendedor `V.0002zonacentral` (`id_user` **300**)
· APK de `main`. **Ningún SQL de escritura. Ninguna configuración de la web tocada.**

✅ **Los cobros 2708, 2709, 2712 y 2713 NO se tocaron.** Verificado contra el snapshot de la
barrida: `st_collection` y `da_update` idénticos (2708 `19:47:50.726Z` st=3 · 2709
`19:47:52.592Z` st=3 · 2712 `20:42:49.026Z` st=2 · 2713 `20:41:56.749Z` st=2).

### Vuelta 1 (`script-cobros_4k_20260914_214638`)

| Tabla | id | Detalle | Marca |
|---|---|---|---|
| `collection` | **2735** | cobro 54,00 USD (happy path) | `Test-COB-801477` |
| `collection` | **2736** | cobro 239,30 USD · con descuento 10 % | `Test-DTO-944794` |
| `collection` | **2737** | cobro 885,99 USD · dif **49,99** (dentro de tolerancia) | `Test-TOL-DENTRO-344012` |
| `collection` | **2738** | cobro 65,50 USD · dif **50,00** (envío directo) | `Test-TOL-ANTIC-391807` |
| `collection` | **2739** | **anticipo** 0,01 USD (`co_type=1`) — par legítimo del 2738 | `Test-TOL-ANTIC-391807` |
| `collection` | **2740** | cobro 785,00 USD · dif 50,00 **sin anticipo** (defecto D-1) | `Test-TOL-REAB-490766` |
| `collection` | **2741** | cobro 283,00 USD · dif **−10,00** (tolerancia negativa, borde) | `Test-TOLNEG-DENTRO-612462` |
| `collection` | **2742** | cobro 354,40 USD · **pago parcial** de una factura de 886,00 | `Test-PARC-NUBE-736884` |

### Vuelta 2 (`script-cobros_4k_20260914_221655`)

| Tabla | id | Detalle | Marca |
|---|---|---|---|
| `collection` | **2743** | cobro 699,50 USD (happy path) | `Test-COB-617959` |
| `collection` | **2744** | cobro 384,49 USD · dif 49,99 | `Test-TOL-DENTRO-182105` |
| `collection` | **2745** | cobro 350,00 USD · dif 50,00 (directo) | `Test-TOL-ANTIC-230030` |
| `collection` | **2746** | **anticipo** 0,01 USD — par legítimo del 2745 | `Test-TOL-ANTIC-230030` |
| `collection` | **2747** | cobro 364,00 USD · dif 50,00 **sin anticipo** (defecto D-1) | `Test-TOL-REAB-328578` |
| `collection` | **2748** | cobro 297,00 USD · dif −10,00 | `Test-TOLNEG-DENTRO-495876` |
| `collection` | **2749** | cobro 52,20 USD · **descuento por MONTO** 5,80 sobre factura de 58,00 | `Test-DTO-MONTO-541619` |
| `collection` | **2750** | cobro 60,00 USD · pago parcial de una factura de 150,00 | `Test-PARC-NUBE-604149` |

**Sin duplicados:** contando **por `co_type`**, cada envío dejó una sola fila. Los dos únicos
pares cobro+anticipo (2738/2739 y 2745/2746) son los que la configuración manda crear.

### Vueltas 3 y 4

Detalle en `automation/reports/4k/cierre_cobros_20260915/01-cierre-cobros.md` §Registros.
La vuelta 3 se cortó a mitad por una caída del puente CDP (la app se reinició), no por la app.

### Inventario de documentos libres — la cuenta del día

**31 → 24 → 16 → …**. Cada cobro enviado compromete su factura y la saca del Tab Documentos.
Se mide con la BD **local del equipo**, que es la que pinta la pantalla:

```sql
SELECT count(*) FROM document_sales d
WHERE d.nu_balance > 0
  AND d.co_document NOT IN (SELECT co_document FROM collection_details WHERE co_document IS NOT NULL);
```

🔴 **La nube NO sirve para esto** (`document_sale.co_collection` sigue en NULL aunque el documento
esté comprometido, y además no sabe qué se bajó a este equipo). **Rechazar los cobros «Por aprobar»
desde la web libera sus documentos** y es lo único que hace falta para que cobros se mida entero.

---

## 2026-09-15 · 4K · Aviso de saldo a favor al cobrar con N/C (`alerta_ncr_20260915`)

Vendedor **`V.0030zgrancaracas`** (`id_user` 338, JOAN BRICEÑO) · empresa `DIESE` · playa CARIBE.
Corte de referencias: `max(id_collection)` **2765** antes de empezar.

| Tabla | id | `co_type` | Cliente | Detalle | Marca / comentario |
|---|---|---|---|---|---|
| `collection` | **2766** | 0 · cobro | C.0321 | `FAC 00021022` (85,00) + `N/C 00002222` (−145,00) · total 0,00 · método **Otros** + `test_excedente` · **cobro REABIERTO desde Guardado** | `Test-NCR-A-0321-105309` |
| `collection` | **2767** | 0 · cobro | C.0864 | `FAC 00022180` con **pago parcial 100,00** + `N/C *0001523` (−244,00) · total 0,00 · método **Otros** + `test_excedente` | `Test-NCR-B-0864-110413` |
| `collection` | **2768** | **1 · anticipo** | C.0864 | Anticipo automático por el saldo a favor: **144,00 USD** (método `ef`) | `Test-NCR-B-0864-110413` |

🔴 **2766 NO tiene anticipo, y debería tenerlo.** Es el hallazgo de la corrida: el cobro se
reabrió desde Guardado y el anticipo de **60,00 USD** no se generó, pese a que el modelo traía
`createAutomatedPrepaid = true` y `creditBalancePrepaidAmount = 60` en el instante del envío.
Confirma que **`DM-COB-058` sigue vivo**. El par 2767/2768, montado en la misma sesión y con el
mismo mecanismo pero **sin reabrir**, sí generó su anticipo: es el control que lo aísla.

**Sin duplicados:** contando por `co_type`, cada envío dejó una sola fila.

**Un cuarto cobro se montó y NO se guardó** (caso D, contraste del descuento): cliente **C.0643**,
`FAC 00020855`, descuento «80 % - Probando». Se salió con **SALIR SIN GUARDAR** tras copiar la
alerta, así que **no dejó registro** en la nube ni en el equipo.

### Cómo revertir

Rechazar desde la web **2766**, **2767** y **2768**. Eso libera de nuevo los cuatro documentos
(`00021022` · `00002222` · `00022180` · `*0001523`), que es como estaban al empezar esta corrida
—los liberó el rechazo de 2708-2713—. Los saldos de `document_sale` no hay que tocarlos: no se
mueven con el envío (los mueve el ERP aguas abajo).

**No se ejecutó SQL de escritura. No se aprobó ni rechazó ningún cobro. No se tocó ninguna
configuración de la web ni ninguna variable global.**

---

## 2026-09-15 · INSUMAR (`INSUM_A`, El Yaque) — REQ «Selector de una Unidad por defecto» (`req_unidad_defecto_20260915`)

**Las VG quedaron como estaban. No hay ninguna conmutación pendiente de deshacer.**
Para el histórico: `userCanChangeUnits` (grupo Pedidos) se puso en **`NO` a las 13:37** y se
**devolvió a `SI` a las 13:43** — comprobado en la nube (`da_update` 17:43:43Z) y en el equipo tras
volver a entrar. `unitByPriceList` **no se tocó** (sigue en `true`; ver la nota de abajo).

| Desde | Qué cambiamos | Para qué | Cómo se deshace |
|---|---|---|---|
| 15/09 13:17 | **Sesión del móvil**: el vendedor pasó de `R003` a **`r013`** (VIVIANA ESCALANTE) | es el vendedor que pedía el encargo | No hace falta deshacerlo, pero **cambiar de usuario borra la BD local** y fuerza una sincronización completa (~15-60 s). Si la próxima corrida espera los datos de `R003`, tendrá que volver a entrar con ese usuario y pagar otra sync |

**No se creó ningún pedido ni ninguna devolución.** Todas las líneas se montaron solo para medir y se
salió con **«Salir sin guardar»**. Comprobado al cerrar: `returns` = 0 filas y 0 `orders` con fecha de hoy.

🔴 **`unitByPriceList` no es conmutable desde la web en INSUMAR**: tiene **`editable = false`** en
`global_configuration`, y la pantalla de Variables de configuración solo dibuja las filas
`editable = true` (38 de 51 en el grupo Pedidos). Para poder probar la rama que pide el REQ hace falta
que desarrollo la marque editable. No se intentó por SQL (escrituras prohibidas).

---

## 2026-09-15 · IMPORTADORA 4K (`4k`, DIESE, playa CARIBE) — Validación de fixes de Cobros (`fixes_cobros_20260915`)

Vendedor **`V.0030`** · `idUser` 338 · JOAN BRICEÑO. App `6.6.21.3`, bundle `main.js` **5.429.097**
caracteres (⚠ la versión NO distingue esta build de la anterior; el bundle sí).
Corte: `max(id_collection)` = **2771** al empezar.

| Tabla | Ref | `co_type` | Cliente | Qué se creó | Comentario (marca) |
|---|---|---|---|---|---|
| `collection` | **2773** | 0 · cobro | C.0864 | `FAC 00022180` con **parcial 100,00** + `N/C *0001523` (−244,00) · total 0,00 · **Otros** + `test_excedente` · envío **directo** | `QA-1A-0864-142900` |
| `collection` | **2774** | **1 · anticipo** | C.0864 | Saldo a favor: **144,00 USD** | `QA-1A-0864-142900` |
| `collection` | **2775** | 0 · cobro | C.0321 | `FAC 00021022` (85,00) + `N/C 00002222` (−145,00) · **reabierto desde Guardado** | `QA-2A-0321-144200` |
| `collection` | **2777** | 0 · cobro | C.0394 | `FAC 00020461` (saldo 76,00) · Efectivo **226,00** · **reabierto** | `QA-2B-REAB-0394-150500` |
| `collection` | **2779** | 0 · cobro | C.0394 | `FAC 00020903` (saldo 600,00) · Efectivo **750,00** · envío **directo** | `QA-2B-DIR-0394-151800` |
| `collection` | **2780** | **1 · anticipo** | C.0394 | Excedente: **100,01 USD** (150,00 − 49,99 de tolerancia) | `QA-2B-DIR-0394-151800` |
| `collection` | **2781** | 0 · cobro | C.0394 | `FAC 00020987` (saldo 168,00) · Efectivo **318,00** · **reabierto** | `QA-2C-REAB-0394-153900` |

🔴 **2775, 2777 y 2781 NO tienen anticipo, y deberían tenerlo** (60,00 · 100,01 · 100,01). Es el
hallazgo de la corrida: los tres se enviaron desde un **Guardado reabierto**. Los controles montados
en la misma sesión y con el mismo mecanismo pero **sin reabrir** —2773/2774 y 2779/2780— sí lo
generaron. Afecta a los **dos** caminos (saldo a favor por N/C y excedente por tolerancia).
La propia consola de la app lo explica: *«ERROR: anticipoAutomatico vacio al crear payment de
anticipo»* → *«eliminando anticipo huérfano»*.

**Sin duplicados:** contando por `co_type`, cada envío dejó una sola fila.

⚠️ **Los cobros 2772 (`C.0405`), 2776 (`C.0616`) y 2778 (`C.0608`) NO son de esta corrida** — hay
otra persona trabajando en el mismo tenant. Al cotejar, filtrar por la marca del comentario, nunca
por rango de `id_collection`.

**Dos cobros se montaron y NO se guardaron**: el del orden invertido (`C.0864`) y el del contraste
del descuento (`C.0643`, `FAC 00020855`, descuento «80 % - Probando», se pulsó **CANCELAR**). Los dos
se abandonaron con **SALIR SIN GUARDAR** y **no dejaron registro**.

**El equipo quedó limpio: 0 cobros en estado Guardado al cerrar.**

### Cómo revertir

Rechazar desde la web **2773, 2774, 2775, 2777, 2779, 2780 y 2781**. Eso devuelve al Tab Documentos
los siete documentos consumidos: `00022180` · `*0001523` (C.0864) · `00021022` · `00002222` (C.0321)
· `00020461` · `00020903` · `00020987` (C.0394). Los saldos de `document_sale` no hay que tocarlos:
no se mueven con el envío.

**Quedan libres para la próxima corrida:** `C.0394` → `00021460` y `00021880` · `C.0643` → sus 3
facturas · `C.0616` → su pareja `00018156` + `*0001303` (no se llegó a usar).

**No se ejecutó SQL de escritura. No se aprobó ni rechazó ningún cobro. No se tocó ninguna
configuración de la web ni ninguna variable global.**

---

## 2026-09-15 · 4K · Verificación del fix del anticipo en cobro reabierto (APK nueva)

**RUN_DIR:** `automation/reports/4k/fix_anticipo_reabierto_20260915/`
**Vendedor:** `V.0030zgrancaracas` (`id_user` 338) · empresa DIESE · playa CARIBE
**Build:** `main.js` = **5.432.976** caracteres (la anterior 5.429.097) · `versionApp` 6.6.21.3
**Baseline:** `max(id_collection)` = **2781** al arrancar.

| Tabla | id | co_type | Cliente | Qué se montó | Marca del comentario |
|---|---|---|---|---|---|
| `collection` | **2782** | 0 · cobro | C.0394 | `FAC 00020461` (saldo 76,00) · Efectivo **126,00** · **reabierto** | `FIX22-BREAB1-163303` |
| `collection` | **2785** | 0 · cobro | C.0394 | `FAC 00020987` (saldo 168,00) · Efectivo **218,00** · envío **directo** | `FIX22-BDIR1-163830` |
| `collection` | **2786** | **1 · anticipo** | C.0394 | Excedente: **0,01 USD** (50,00 − 49,99 de tolerancia) | `FIX22-BDIR1-163830` |
| `collection` | **2787** | 0 · cobro | C.0394 | `FAC 00021460` (saldo 300,00) · Efectivo **350,00** · **reabierto** | `FIX22-BREAB2-164006` |
| `collection` | **2789** | 0 · cobro | C.0321 | `FAC 00021022` (85,00) + `N/C 00002222` (−145,00) · total 0,00 · **Otros** + `test_excedente` · envío **directo** | `FIX22-ADIR4-164709` |
| `collection` | **2790** | **1 · anticipo** | C.0321 | Saldo a favor: **60,00 USD** | `FIX22-ADIR4-164709` |
| `collection` | **2791** | 0 · cobro | C.0394 | `FAC 00021880` (saldo 468,00) · Efectivo **518,00** · **reabierto** | `FIX22-BREAB3-164937` |

🔴 **2782, 2787 y 2791 NO tienen anticipo, y los tres deberían tener uno de 0,01.** Es el hallazgo:
**el fix NO corrigió el defecto** — 3 de 3 envíos desde un Guardado reabierto siguen sin generar el
anticipo, mientras los **dos** controles montados la misma tarde y sin reabrir (2785/2786 por
excedente y 2789/2790 por nota de crédito) sí lo generaron. La consola repite palabra por palabra el
mensaje de la build anterior: *«ERROR: anticipoAutomatico vacio al crear payment de anticipo»* →
*«createAnticipoCollection: fallo payment; eliminando anticipo huérfano»*.

**Sin duplicados:** contando por `co_type`, cada envío dejó una sola fila.

⚠️ Al cotejar, filtrar **siempre por la marca del comentario** (`FIX22-…`), nunca por rango de
`id_collection`: hay otra persona trabajando en el mismo tenant (2783, 2784 y 2788 no son de esta
corrida).

**Dos cobros se montaron y NO se enviaron ni se guardaron:** el de C.0321 del caso C1 (inspección del
aviso de saldo a favor) y el de C.0643 `FAC 00020855` del caso C2 (descuento «80 % - Probando», se
pulsó **CANCELAR** en la confirmación del remanente). Los dos se abandonaron y **no dejaron registro**.

**El equipo quedó limpio: 0 cobros en estado Guardado y 0 «Por enviar» al cerrar.**

### Cómo revertir

Rechazar desde la web **2782, 2785, 2786, 2787, 2789, 2790 y 2791**. Eso devuelve al Tab Documentos
los seis documentos consumidos: `00020461` · `00020987` · `00021460` · `00021880` (C.0394) ·
`00021022` + `00002222` (C.0321). Los saldos de `document_sale` no hay que tocarlos: no se mueven
con el envío.

**Cartera tras esta corrida:** `C.0394` **agotada** (sus 4 facturas USD se consumieron) · `C.0321`
**agotada** (su única pareja FAC + N/C) · `C.0643` conserva sus 3 facturas, incluida `00020855`
(total 955,50 · saldo 69,00), que es la que dispara el aviso de «descuento supera el saldo».

**No se ejecutó SQL de escritura. No se aprobó ni rechazó ningún cobro. No se tocó ninguna
configuración de la web ni ninguna variable global.**

---

## 2026-09-16 · 4K · Verificación del fix del anticipo en cobro reabierto — APK nueva (`fix_anticipo_v4_20260916`)

**4K / DIESE / playa CARIBE** · vendedor `V.0030zgrancaracas` (`id_user` 338) · 08:27–08:43
**Build** `main.js` = **5.438.699** caracteres (la anterior 5.432.976) · `versionApp` 6.6.21.3 no discrimina
**Baseline** `max(id_collection)` = **2806** ⇒ todo lo de esta corrida es ≥ 2807

✅ **EL FIX FUNCIONA.** 5 de 5 cobros enviados desde un Guardado reabierto generaron su anticipo
automático (en la build anterior fueron 0 de 3, y 14 reproducciones en 4 builds antes de eso).

| Tabla | id | co_type | Cliente | Qué se montó | Marca |
|---|---|---|---|---|---|
| `collection` | **2807** | 0 · cobro | C.0627 | `FAC 00020146` (saldo 303,56) · Efectivo **353,56** · **reabierto** | `FIX23-AREAB1-082712` |
| `collection` | **2808** | **1 · anticipo** | C.0627 | Excedente: **0,01 USD** (50,00 − 49,99 de tolerancia) | `FIX23-AREAB1-082712` |
| `collection` | **2809** | 0 · cobro | C.0627 | `N/D 10000191` (saldo 16,40) · Efectivo **66,40** · envío **directo** | `FIX23-ACTRL1-083009` |
| `collection` | **2810** | **1 · anticipo** | C.0627 | Excedente: **0,01 USD** | `FIX23-ACTRL1-083009` |
| `collection` | **2811** | 0 · cobro | C.0627 | `FAC 00020266` (saldo 500,00) · Efectivo **550,00** · **reabierto** | `FIX23-AREAB2-083214` |
| `collection` | **2812** | **1 · anticipo** | C.0627 | Excedente: **0,01 USD** | `FIX23-AREAB2-083214` |
| `collection` | **2813** | 0 · cobro | C.0627 | `N/D 10000198` (saldo 12,50) · Efectivo **62,50** · **reabierto** | `FIX23-AREAB3-083330` |
| `collection` | **2814** | **1 · anticipo** | C.0627 | Excedente: **0,01 USD** | `FIX23-AREAB3-083330` |
| `collection` | **2815** | 0 · cobro | C.0321 | `FAC 00021022` (85,00) + `N/C 00002222` (−145,00) · total 0,00 · **Otros** + `test_excedente` · **reabierto** | `FIX23-B0321-REAB-083647` |
| `collection` | **2816** | **1 · anticipo** | C.0321 | Saldo a favor: **60,00 USD** | `FIX23-B0321-REAB-083647` |
| `collection` | **2817** | 0 · cobro | C.0864 | `FAC 00022180` con **parcial 100,00** + `N/C *0001523` (−244,00) · total 0,00 · **Otros** + `test_excedente` · **reabierto** | `FIX23-B0864-REAB-084137` |
| `collection` | **2818** | **1 · anticipo** | C.0864 | Saldo a favor: **144,00 USD** (244,00 − 100,00 de parcial) | `FIX23-B0864-REAB-084137` |

**Los seis cobros tienen su anticipo y los seis montos cuadran al céntimo.** Es lo contrario de la
corrida del 15/09, donde 2782, 2787 y 2791 se quedaron sin él. La consola ya **no** imprime
*«ERROR: anticipoAutomatico vacio al crear payment de anticipo»* ni *«eliminando anticipo huérfano»*
en ninguno de los cinco reabiertos: ahora sale *«SE CREO COLLECTION PAYMENTS AUTOMATICO POR EL ANTICIPO»*.

**Sin duplicados:** contando por `co_type`, cada envío dejó una sola fila de cada tipo.

⚠️ Al cotejar, filtrar **siempre por la marca del comentario** (`FIX23-…`), nunca por rango de
`id_collection`: hay otra persona trabajando en el mismo tenant.

**Un cobro se montó y NO se envió ni se guardó:** el de C.0643 `FAC 00020855` del caso C2 (descuento
«80 % - Probando», se pulsó **CANCELAR** en la confirmación del remanente de 695,40). Se abandonó y
**no dejó registro** — se comprobó que no hay ninguna fila con la marca `FIX23-C2-083931`.

**El equipo quedó limpio: 0 cobros en estado Guardado al cerrar.**

### Cómo revertir

Rechazar desde la web **2807 a 2818** (los doce). Eso devuelve al Tab Documentos los ocho documentos
consumidos: `00020146` · `10000191` · `00020266` · `10000198` (C.0627) · `00021022` + `00002222`
(C.0321) · `00022180` + `*0001523` (C.0864). Los saldos de `document_sale` no hay que tocarlos: no se
mueven con el envío.

**Cartera tras esta corrida:** `C.0627` sigue siendo el pozo del tenant (~68 documentos libres de los
72 que tenía) · `C.0321` **agotada** otra vez (su única pareja FAC + N/C) · `C.0864` **agotada** ·
`C.0643` conserva sus 3 facturas, incluida `00020855` (total 955,50 · saldo 69,00), que es la que
dispara el aviso de «descuento supera el saldo».

📌 **Dato útil para la próxima:** los cobros **2773** y **2789**, rechazados por QA (`st_collection = 2`
en la nube), **sí liberaron** sus documentos y se vieron en el Tab Documentos del equipo sin necesidad
de resincronizar. La BD local del equipo sigue teniendo las filas viejas en `collection_details`, así
que **el inventario local por `co_document NOT IN (collection_details)` da un falso "ocupado"** para
documentos liberados por rechazo: hay que **mirar la pantalla**, no solo el sqlite.

**No se ejecutó SQL de escritura. No se aprobó ni rechazó ningún cobro. No se tocó ninguna
configuración de la web ni ninguna variable global.**

---

## 🔴 Corrida `cierre_anticipo_20260916` — 4K · build **5.446.151** (10:00–10:26)

Cierre de la tarjeta «cobro reabierto no genera el anticipo automático» sobre la **APK nueva**
(`main.js` = 5.446.151 caracteres; `versionApp` 6.6.21.3 **no** discrimina builds).
Vendedor `V.0030zgrancaracas` (`id_user` 338) · empresa DIESE · playa CARIBE.
Informe: `automation/reports/4k/cierre_anticipo_20260916/01-cierre-anticipo.md`.

| Tabla | id | `co_type` | Cliente | Qué es | Marca del comentario |
|---|---|---|---|---|---|
| `collection` | **2822** | 0 · cobro | C.0627 | `FAC 00020287` (250,00) pagado 300,00 · **reabierto** | `CIE24-AREAB1-100033` |
| `collection` | **2823** | **1 · anticipo** | C.0627 | Excedente: **0,01 USD** | `CIE24-AREAB1-100033` |
| `collection` | **2824** | 0 · cobro | C.0627 | `N/D 10000201` (6,25) pagado 56,25 · **reabierto** | `CIE24-AREAB2-100215` |
| `collection` | **2825** | **1 · anticipo** | C.0627 | Excedente: **0,01 USD** | `CIE24-AREAB2-100215` |
| `collection` | **2826** | 0 · cobro | C.0627 | `FAC 00020331` (327,00) pagado 377,00 · **reabierto** | `CIE24-AREAB3-100344` |
| `collection` | **2827** | **1 · anticipo** | C.0627 | Excedente: **0,01 USD** | `CIE24-AREAB3-100344` |
| `collection` | **2828** | 0 · cobro | C.0627 | `N/D 10000205` (8,18) pagado 58,18 · **envío directo** (control) | `CIE24-BCTRL-100518` |
| `collection` | **2829** | **1 · anticipo** | C.0627 | Excedente: **0,01 USD** | `CIE24-BCTRL-100518` |

**3 de 3 reabiertos generaron su anticipo, más el control directo. Sin duplicados.**

**Dos cobros se montaron y NO dejaron registro en la nube:**
- C.0643 `FAC 00020855` — caso del descuento «80 % - Probando»: se pulsó **CANCELAR** en la
  confirmación del remanente de 695,40. Se abandonó; 0 filas con la marca `CIE24-C2-102302`.
- C.0398 `FAC 00020672` — intento fallido de montar el caso de nota de crédito (la N/C no la lista la
  pantalla). Quedó en **Guardado** y **se eliminó del equipo** al cerrar. 0 filas en la nube.

**El equipo quedó limpio: 0 cobros en estado Guardado al cerrar.**

### Cómo revertir

Rechazar desde la web **2822 a 2829** (los ocho). Eso devuelve al Tab Documentos los cuatro documentos
consumidos de C.0627: `00020287` · `10000201` · `00020331` · `10000205`.

### Materia prima — estado al cierre

🔴 **No queda NINGUNA pareja factura + nota de crédito libre en la cartera de `V.0030`.** Se recorrió el
Tab Documentos de C.0398 · C.0395 · C.0419 · C.0864 · C.0816 · C.1073 · C.0321 · C.0626 y **ninguno
lista N/C**. La BD da 38 N/C «libres» en esa cartera: **miente** (las de C.0321 y C.0864 se consumieron
en la corrida de las 08:41 y `co_collection` sigue en NULL). Para volver a probar el camino de la nota de
crédito hay que **aprobar o rechazar en la web** los cobros que retienen `00002222` (C.0321) y
`*0001523` (C.0864).

⚠️ **La lista `clientes_con_documentos` del YAML de 4K es del vendedor `V.0002`, no de `V.0030`.**
C.0149, C.0052 y compañía **no existen** para `V.0030`: el modal de clientes devuelve 0 ítems. La cartera
real de `V.0030` son **46 clientes**, volcada en
`automation/reports/4k/cierre_anticipo_20260916/cartera_V0030.txt`.

📌 **Dato de navegación:** el Tab Documentos tiene, además del selector de moneda, una leyenda
**Vigente / Vencido / A favor** (`button.legend-item.legend-button`). Se probó pulsar «A favor» y **no
filtró** la lista — es leyenda de color, no filtro. Las N/C, cuando existen, salen en la lista normal.

**No se ejecutó SQL de escritura. No se aprobó ni rechazó ningún cobro. No se tocó ninguna
configuración de la web ni ninguna variable global.**
