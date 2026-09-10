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
