# Barrida completa previa al tag v22 — IMPORTADORA 4K · 14/09/2026

> **En una línea:** 188 casos, **5 FAIL**, **ningún crash**, y **ninguno de los FAIL es un
> defecto nuevo de la versión**. Los dos defectos de producto que quedan vivos ya se conocían;
> el resto es guion o falta de datos. **Recomendación: se puede sacar el tag** — con una
> salvedad escrita al final.

| Parámetro | Valor |
|---|---|
| RUN_ID | `barrida_v22_20260914` |
| Corrida completa | `automation/reports/4k/script_4k_20260914_203043` (20:30:43 → 20:56) |
| Relanzamientos | `script-devoluciones_4k_20260914_205632` · `script-clientes_4k_20260914_210134` |
| Cliente / empresa | **IMPORTADORA 4K** · `DIESE` (rótulo **DIESEL** en la UI) · GRUPO 4K · RIF J401702600 |
| Playa | **CARIBE** (servidor CONTABO) — descubierta en runtime |
| Vendedor | `V.0002zonacentral` · `id_user` **300** · ANGEL BETANCOURT |
| App | `com.kiberno.denarioPremiumPro` · APK de **`main`** · Infinix X6728 · CDP `:9220` |
| Build bajo prueba | `main` @ **11b464e8** (incluye `3c8cfbf9`, fix de anticipos automáticos por exceso) |
| Duración | corrida completa **24,3 min** + relanzamientos **4,8 min** |

**Salud de la configuración:** `187 VG en el equipo · 187 en la nube`, **0 divergencias en las
variables que gobiernan casos**. En los dos relanzamientos el contraste dio
«✓ la configuración del equipo coincide con la de la web». Las expectativas de esta corrida
están medidas contra la configuración real del equipo, no contra el perfil.

**Validez del oráculo de nube:** comprobada **en vivo** — el cliente potencial que envió esta
misma corrida apareció en la base que consulta `query.js` (`potential_client` id **97**,
`00:32:22Z`). La mudanza de 4K a CARIBE no rompe el cotejo.

---

## 1 · LOS FAIL, por gravedad

### 🔴 F-1 · `DM-COB-058` — el anticipo automático NO se genera si el cobro se envía desde un Guardado reabierto
**Etiqueta: PRODUCTO · YA CONOCIDO (D-1) · sigue vivo · severidad ALTA — el excedente cobrado se pierde**

Reproducción mínima (A/B del mismo día, mismo vendedor, **mismo excedente de 50,00 USD**):

| Camino | Cobro | `nu_difference` | Anticipo |
|---|---|---|---|
| **Enviar DIRECTO** (`DM-COB-057`) | **2732** · 2.295,00 USD · C.0541 | 50,00 | ✅ **2733 · 0,01 USD** |
| **Guardar → reabrir → Enviar** (`DM-COB-058`) | **2734** · 630,00 USD · C.1007 | 50,00 | ❌ **ninguno** |

Texto literal del diálogo del camino que falla: **«Denario Cobros · El Cobro será enviado»**.
Nota del caso: `total 580 + exceso 50.00 = pagado 630.00 · anticipo esperado 0.01 · obtenido ninguno`.

`DM-COB-057` es el testigo de control y **pasó**: la función existe y funciona. El FAIL no se
puede confundir con una tolerancia mal configurada. **Es el mismo defecto documentado el 14/09
por la mañana** (cobros 2717–2720) y **no se ha movido**.

### ⚠ F-2 · `DM-COB-REQ-002` — «Enviar» no dice qué falta
**Etiqueta: PRODUCTO · YA CONOCIDO (D-2) · severidad media**

Nota literal: `C1 ok (deshabilitado) pero C2 NO: no hay marca ni mensaje que indique qué falta`.
Ya fallaba igual el 07/09. Es el criterio **C2** del REQ del botón Enviar, pendiente en el producto.

> Contraste útil para desarrollo: **el mismo REQ SÍ pasa en otros módulos**. En clientes,
> `DM-CLT-REQ-002` da PASS —«C2 ok vía alerta + borde rojo — *"Denario Clientes Nombre obligatorio."*»—
> y en devoluciones `DM-DEV-REQ-002` también —«*"Denario Devolución Debe agregar al menos un
> producto a la devolución."*»—. El hueco es **sólo de cobros**, no del patrón general.

### ❓ F-3 y F-4 · `DM-DEV-006` y `DM-DEV-007` — dos campos del Tab General de Devoluciones no aparecen
**Etiqueta: NO DISTINGUIBLE con lo medido — hace falta comprobarlo A MANO**

Salieron en el **relanzamiento aislado** de devoluciones (el módulo no llegó a abrirse en la
corrida completa; ver F-6).

- `DM-DEV-006` «Campos editables Tab General (Responsable/Comentario)» → nota: `responsable: "null"`
- `DM-DEV-007` «Fecha devolución solo lectura» → nota: `fechaDevButton disabled: null`

**Por qué no lo etiqueto todavía.** En los dos casos el guion devuelve `null` **cuando no
encuentra el elemento** (`if (!inp) return null` / `if (!btn || width===0) return null`) y luego
trata ese `null` como «la app se comporta mal». Es decir: el `null` significa **«no localicé el
campo»**, no «el campo está mal».

Lo que sí está medido:

- Los dos selectores **son válidos en la app**: `#responsable` y `#fechaDevButton` dan PASS
  repetidamente en **piercar** (x15) y **mio_parts** (x2).
- En **4K no están**. Y **es la primera vez que estos dos casos llegan a ejecutarse en 4K**
  (antes el módulo nunca pasaba de `DM-DEV-001`), así que **no hay línea base anterior**:
  no hay evidencia de que esto sea una regresión de la v22.
- El resto del módulo funciona **de punta a punta**: se creó, guardó, **envió** (`return` **230**
  en la nube), se validó el tope de cantidad («*Cantidad inválida para la unidad seleccionada.*»)
  y se eliminó un guardado. 28 de 30 casos en PASS.
- En **hidroponias** el mismo `DM-DEV-006` devuelve otra cosa distinta («sin formcontrolname,
  disabled=true, value = objeto empresa»), lo que sugiere que **ese bloque del formulario
  cambia según el tenant**.

**Lo que hay que hacer:** abrir Devoluciones → DEVOLUCIÓN → elegir cliente y factura → Tab General
**a mano** y mirar si «Responsable» y la fecha existen en 4K. Si existen ⇒ es SCRIPT (selector).
Si no existen y deberían ⇒ es PRODUCTO. Si no aplican a este tenant ⇒ DATO/CONFIG.

### 🟡 F-5 · `DM-COB-034` — «el selector de moneda no filtra la lista»
**Etiqueta: DATO / CONFIG — NO es un defecto. El caso no se pudo ejercitar.**

Nota literal: `opciones: Moneda/Bs/USD · habilitado: true · documentos con USD: 0 · con Bs: 0 · 🔴 la lista no cambia al cambiar de moneda`.

**Con 0 documentos en las dos monedas, «la lista no cambia» es una obviedad, no un hallazgo.**
La progresión del mismo caso a lo largo del día lo deja claro — el pool de documentos libres se
agota porque **cada cobro enviado compromete su factura**:

| Corrida | documentos USD | Resultado |
|---|---|---|
| `script-cobros_…_185655` | 3 | PASS |
| `script-cobros_…_191659` | 2 | PASS |
| `script-cobros_…_193042` | 1 | PASS |
| **`barrida_v22` (ésta)** | **0** | **FAIL** |

Y además: **`con Bs: 0` en las cuatro corridas**. 4K **no tiene ningún documento en Bs**, así que
la mitad «Bs» de este caso **nunca se ha podido probar**. Un caso que no puede fallar no es un
PASS — y tampoco un FAIL.

La misma causa raíz arrastra **5 BLOCKED** (`DM-COB-014/015/038/039/047`,
«F2-B no pudo montarse: no se pudo marcar el documento»).

### 🔧 F-6 · `DM-DEV-001` — Devoluciones no abrió en la corrida completa (29 casos perdidos)
**Etiqueta: SCRIPT — confirmado por relanzamiento**

En la corrida completa: `page.waitForSelector: Timeout 15000ms exceeded — waiting for locator('devoluciones-container')`,
y 28 casos en cascada a BLOCKED.

**Relanzado aislado, el módulo abre y pasa: `DM-DEV-001` PASS («botones: DEVOLUCIÓN, BUSCAR»),
28 PASS · 2 FAIL · 0 BLOCKED.** Es un problema de **estado entre módulos** (devoluciones va
detrás de `vendedores`), no del módulo ni de la app.

Descartado por medición, no por suposición: el selector es válido en otros tenants; 4K tiene
catálogo completo (18 `return_type`, 44 `return_motive`, 59 devoluciones); y **el propio vendedor
300 tiene 4 devoluciones, la última del 08/09** ⇒ el módulo abre a mano. Tampoco es regresión de
la v22: ya falló igual el **04/09** con otra build.

### 🔧 F-7 · `DM-CLT-026` — «Re-abrir Guardado → Enviar»
**Etiqueta: SCRIPT — confirmado por relanzamiento**

En la corrida completa: `Alert button no encontrado: Aceptar/OK`, y se llevó `DM-CLT-031` a BLOCKED.

**El envío sí funcionó**: `potential_client` **97** (`Test-CLT-SMOKE-301255`, `st=1`, `id_user` 300,
`00:32:22Z`) está en la nube. **Relanzado aislado: 15/15 PASS**, `DM-CLT-026` con
`ref potencial: 98 · BD-LOCAL-OK(id=98,st=2)`.

Es un bucle rígido de **exactamente 3 alertas** con espera fija de 900 ms: si una alerta tarda o
llega de más, el caso cae. Además el `catch` hace `return` y **se come el caso siguiente**.

---

## 2 · Tabla por módulo

### Corrida completa (la que mide de verdad, en orden real)

| # | Módulo | PASS | FAIL | N/A | BLOCKED | Total | Tiempo |
|---|---|---|---|---|---|---|---|
| 1 | login | 6 | 0 | 3 | 0 | 9 | 55,2 s |
| 2 | clientes | 13 | **1** | 0 | 1 | 15 | 44,8 s |
| 3 | inventarios | 17 | 0 | 2 | 0 | 19 | 115,1 s |
| 4 | depositos | 15 | 0 | 0 | 0 | 15 | 70,6 s |
| 5 | visitas | 18 | 0 | 0 | 0 | 18 | 119,9 s |
| 6 | productos | 9 | 0 | 1 | 0 | 10 | 12,5 s |
| 7 | vendedores | 3 | 0 | 0 | 0 | 3 | 1,8 s |
| 8 | devoluciones | 0 | **1** | 0 | **28** | 29 | 17,2 s |
| 9 | cobros | 31 | **3** | 5 | 8 | 47 | 893,4 s |
| 10 | pedidos | 18 | 0 | 5 | 0 | 23 | 125,7 s |
| | **TOTAL** | **130** | **5** | **16** | **37** | **188** | **24,3 min** |

### Estado efectivo tras los dos relanzamientos

| Módulo | PASS | FAIL | N/A | BLOCKED | Nota |
|---|---|---|---|---|---|
| clientes | **15** | **0** | 0 | 0 | relanzado — limpio |
| devoluciones | **28** | **2** | 0 | 0 | relanzado — abre y envía; quedan F-3/F-4 |
| *(resto igual)* | | | | | |
| **TOTAL efectivo** | **160** | **5** | **16** | **8** | 189 casos |

**Módulos que quedaron limpios (0 FAIL, 0 BLOCKED):** login, inventarios, depositos, visitas,
productos, vendedores, pedidos — y **clientes** tras el relanzamiento.

---

## 3 · Lo NUEVO frente a lo YA CONOCIDO

### Ya conocido — sigue vivo, con su referencia

| Ref | Qué | Estado hoy |
|---|---|---|
| **D-1** `DM-COB-058` | El anticipo automático no se genera desde un Guardado reabierto | 🔴 **sigue vivo**, reproducido con A/B limpio (2732+2733 vs 2734) |
| **D-2** `DM-COB-REQ-002` | «Enviar» no dice qué falta (C2 del REQ) | 🔴 **sigue vivo**, idéntico al 07/09 |
| **Conocido nº 2** (carrera de pedidos) | El formulario hereda estado del pedido enviado | 🟢 **NO se manifestó** — ver §4 |

### Nuevo en esta corrida

**Ningún defecto de producto nuevo.** Lo que apareció por primera vez y su clasificación:

| Qué | Etiqueta | Por qué no es un hallazgo de la versión |
|---|---|---|
| `DM-COB-034` FAIL | **DATO/CONFIG** | pool de documentos agotado (3→2→1→0 en el día); y 4K no tiene documentos en Bs |
| `DM-DEV-001` FAIL + 28 BLOCKED | **SCRIPT** | pasa al relanzar aislado; ya fallaba igual el 04/09 con otra build |
| `DM-CLT-026` FAIL | **SCRIPT** | el envío llegó a la nube (id 97) y pasa al relanzar (id 98) |
| `DM-DEV-006` / `DM-DEV-007` FAIL | **por determinar** | primera vez que se ejecutan en 4K; sin línea base ⇒ **no hay evidencia de regresión** |

---

## 4 · Estabilidad

| Indicador | Resultado |
|---|---|
| **Crashes de la app** | **0** — ninguno, en los 10 módulos ni en los 2 relanzamientos |
| **Reintentos de formulario nuevo en pedidos** | **NO se disparó ninguno** |
| **Módulos relanzados** | **2** — `devoluciones` (obligado) y `clientes` (para clasificar F-7) |
| **Corrida interrumpida** | no; ningún módulo tumbó la barrida |
| **Contraste de VG** | 187/187, 0 divergencias críticas, en las 3 corridas |

**Sobre el reintento de pedidos — dato que QA pidió ver explícitamente.** El guion tiene una
muleta («SEGUNDO intento con formulario nuevo») para mitigar que el formulario herede estado.
**En esta corrida NO se activó.** `DM-PED-006` resolvió el cliente **al primer intento**:

```
"EURO REPUESTOS FIOVAL, C.A. (C.0010)" (vía modal, 50 clientes cargados en 0 ronda/s)
tabs libres: 4 · lockSegments: false · hasClient: true
```

Y eso ocurrió **con pedidos corriendo detrás de un cobros que terminó enviando** (6 cobros).
Es el escenario en el que la carrera solía aparecer, y **no apareció**: 18 PASS · 0 FAIL, con
oráculo de nube (`DM-PED-031`: `☁ 1 fila con la marca Test-PED-584621 → 2603 · 27,00 USD · st=1`).
**Un PASS sin muleta.** No es prueba de que la carrera esté muerta, pero es la primera vuelta
limpia sin que el reintento intervenga.

---

## 5 · Lo que NO se pudo comprobar

| Qué | Por qué |
|---|---|
| **Filtrado de documentos por moneda** (`DM-COB-034`) | 0 documentos libres en USD **y** 4K no tiene ninguno en Bs. Se libera **aprobando o rechazando** los cobros «Por aprobar» desde la web |
| **5 casos de cobros** `DM-COB-014/015/038/039/047` | misma causa: sin documento libre que marcar |
| **Tope de descuento de cobro** `DM-COB-050/051/052` | el catálogo de 4K sólo tiene 2 descuentos (10 % y 80 %): **no hay forma de pasarse de 100 %**, y ninguno abre el input de tasa. Salida por WEB (prohibido en este encargo) |
| **Tasa por fecha** (histórico) | el histórico de 4K ofrece una sola tasa distinta (`870,00 Bs` / `870,00 Bs`) |
| **IGTF** (`DM-COB-036/044/045`) | `userCanSelectIGTF=false` — no se muestra en 4K |
| **IVA en cobros** (`DM-COB-037`) | `userCanCollectIva=false` |
| **Submódulo Retención** (`DM-COB-029`) | `cobroRetencion=false` |
| **Pedido sugerido** (`DM-INV-017/020`) | `suggestedOrderByDispatchAndReturn=false` |
| **Cambio de lista de precio** (`DM-PRD-013`) | `userCanChangePriceList=false` |
| **IVA y descuentos en pedidos** (`DM-PED-IVA-001`, `DSC-001/002`) | `userCanSelectIVA`, `userCanSelectProductDiscount`, `userCanSelectGlobalDiscount` = false. **La ausencia del selector ES la señal** |
| **Segundo usuario / reinstalación** (`DM-LOG-008/009/017`) | `has_second_user` no está en el perfil; 017 exige reinstalar |
| **Caso multi-empresa** | 4K tiene **una sola empresa** (`DIESE`). No cubrible con este tenant |
| **Devoluciones dentro de la corrida completa** | sólo se pudo medir **relanzado aparte**; en el orden real el módulo no abre (F-6) |

⚠ **Hueco de perfil detectado (no llegó a estorbar):** `devoluciones.factura_test` y
`producto_test` valen la **cadena literal `"TBD"`**, no `null`. El guion las trata como dato
válido (`mod.factura_test || ''` ⇒ `"TBD"` es truthy) y buscaría una factura inexistente. En el
relanzamiento no molestó porque el guion **cae a la primera factura del cliente**
(`⚠ la del perfil no apareció; se tomó la primera`). Conviene poner una real: C.0028 tiene
`00022037` (71,00) · `00021993` (saldo 366) · `00021887` · `00021839`.

---

## 6 · Registros creados

Todos con `id_user` **300**, empresa `DIESE`. **Ninguna variable global tocada, ninguna
configuración de la web modificada, ningún SQL de escritura.**

| Tabla | id | Detalle | Marca |
|---|---|---|---|
| `collection` | **2729** | cobro 72,00 USD · C.0538 | `Test-COB-691253` |
| `collection` | **2730** | cobro 1.707,75 USD · C.0461 · con descuento | `Test-DTO-786520` |
| `collection` | **2731** | cobro 283,99 USD · C.0558 · dif 49,99 (dentro de tolerancia) | `Test-TOL-DENTRO-329824` |
| `collection` | **2732** | cobro 2.295,00 USD · C.0541 · dif 50,00 | `Test-TOL-ANTIC-377563` |
| `collection` | **2733** | **anticipo** 0,01 USD (`co_type=1`) — legítimo, par del 2732 | `Test-TOL-ANTIC-377563` |
| `collection` | **2734** | cobro 630,00 USD · C.1007 · dif 50,00 **sin anticipo** (defecto D-1) | `Test-TOL-REAB-476638` |
| `potential_client` | **97** | cliente potencial (corrida completa) | `Test-CLT-SMOKE-301255` |
| `potential_client` | **98** | cliente potencial (relanzamiento) | `Test-CLT-SMOKE-096837` |
| `deposit` | **43** | depósito 270.000,00 · `st=3` | — |
| `visit` | **36778** | visita · `st_visit=2` | — |
| `return` | **230** | devolución enviada · `st=1` (relanzamiento) | — |
| `order` | **2603** | pedido 27,00 USD · `st_order=1` | `Test-PED-584621` |

**Sin duplicados:** contando **por `co_type`**, cada envío dejó **una sola fila**; el único par
cobro+anticipo es el legítimo 2732/2733.

✅ **Los cobros 2708, 2709, 2712 y 2713 NO se tocaron.** Verificado con snapshot antes y después:
su `st_collection` y su `da_update` son idénticos (`2708` 19:47:50.726Z · `2709` 19:47:52.592Z ·
`2712` 20:42:49.026Z · `2713` 20:41:56.749Z).

⚠ **Cómo se deshace todo:** rechazando/anulando los cobros y el pedido desde la web
(Cobros → por aprobar · Pedidos → por aprobar). Rechazar los cobros **además libera sus
documentos**, que es justo lo que hace falta para volver a probar `DM-COB-034`.

---

## 7 · ¿Están cerrados cobros y pedidos?

> Criterio: un módulo está **cerrado** cuando **ningún FAIL suyo es culpa del guion**.

### PEDIDOS — ✅ **SÍ, cerrado**

18 PASS · 0 FAIL · 5 N/A, las cinco justificadas por VG apagadas. Oráculo de nube verificado
(fila 2603). **El reintento no se disparó**, así que el PASS se consiguió **sin muleta**.
Nada que arreglar en el guion para dar el módulo por bueno.

*Único detalle cosmético, no bloqueante:* el cotejo de payload marca
`BD-FIELD-MISMATCH (da_order: payload='2026-09-14 20:54:20' vs nube='2026-09-15T00:54:20.000Z')`.
Es **el mismo instante** en husos distintos (UTC−4): **falso positivo del comparador**, no un
dato mal guardado. El caso pasa igualmente.

### COBROS — ❌ **NO, todavía no**

De sus 3 FAIL, **2 son de producto y están bien** (F-1 y F-2: ésos son justamente los que
queremos ver). **El que sobra es `DM-COB-034`**, que sale FAIL por falta de datos.

**Lista exacta de lo que falta arreglar en el guion de cobros:**

1. **`DM-COB-034` debe salir BLOCKED, no FAIL, cuando no hay documentos.** Hoy el oráculo
   concluye «la lista no cambia al cambiar de moneda» con **0 documentos en ambas monedas**, que
   es medir la nada. Precondición: si `USD == 0 && Bs == 0` ⇒ BLOCKED diciendo «sin documentos
   libres que filtrar».
2. **Declarar que la mitad «Bs» del caso no es cubrible en 4K.** `con Bs: 0` en las 4 corridas
   del día ⇒ aunque hubiera documentos USD, el filtro Bs nunca se ejercita. Debe quedar escrito
   como N/A razonada, no colarse dentro de un PASS.
3. **Sostener el pool de documentos libres.** Los 5 BLOCKED `DM-COB-014/015/038/039/047`
   («no se pudo marcar el documento») son la misma causa. No es código: hay que **aprobar o
   rechazar en la web** los cobros «Por aprobar» antes de la siguiente vuelta, o el módulo se
   degradará corrida a corrida.

**Fuera de cobros y pedidos, pero en la misma lista de pulido** (por si se quiere otra vuelta):

4. **`clientes / DM-CLT-026`** — sustituir el bucle de **exactamente 3 alertas** con espera fija
   de 900 ms por una espera a cada alerta concreta; y **no hacer `return` en el `catch`**, que se
   llevó `DM-CLT-031` por delante.
5. **`devoluciones / DM-DEV-001`** — garantizar HOME real antes de entrar (el módulo sólo falla
   cuando va detrás de `vendedores`; aislado abre siempre).
6. **`devoluciones / DM-DEV-006` y `007`** — **`null` significa «no encontré el elemento», y eso
   no puede ser un FAIL.** Hay que distinguir «campo ausente» de «campo mal», o seguiremos sin
   saber si F-3/F-4 son producto.
7. **Comparador de payload** — normalizar a UTC antes de comparar fechas; hoy marca
   `BD-FIELD-MISMATCH` en `da_order` y `da_return` por el huso, en dos módulos distintos.

---

## 8 · Recomendación sobre el tag

# ✅ Se puede sacar el tag de la v22

**Lo que lo sostiene:**

1. **Ningún defecto de producto nuevo.** 188 casos + 45 de relanzamiento, y los dos únicos
   defectos de producto vivos (`DM-COB-058`, `DM-COB-REQ-002`) **ya estaban documentados antes
   de esta corrida**. Los otros tres FAIL son guion o falta de datos, cada uno con prueba:
   los dos que se relanzaron **pasaron**, y el tercero es un pool de documentos agotado.
2. **Cero crashes** en 10 módulos y 2 relanzamientos, ~29 min de conducción continua.
3. **Las siete rutas de escritura llegan a la nube y se verificaron una por una**: cobro,
   anticipo, cliente potencial, depósito, visita, devolución y pedido. **Guardar no es enviar**,
   y aquí está comprobado el enviar, con la fila en la base.
4. **El fix de anticipos de la build funciona**: `DM-COB-057` genera el anticipo esperado
   (2732 → 2733 · 0,01) exactamente en el umbral de 50,00.
5. **La carrera de pedidos no se manifestó** y el reintento **no hizo falta**.
6. **La configuración del equipo coincide con la de la web** (187/187, 0 divergencias críticas),
   así que las expectativas no están medidas contra un perfil caduco.

**La salvedad — y es una sola:**

> **`DM-COB-058` sale con el tag.** No es nuevo, pero **no es cosmético**: cuando el cliente paga
> de más y el cobro se envía desde un Guardado reabierto, **el excedente no queda a su favor —
> se pierde**. Sacar el tag es defendible porque el defecto ya existía y el camino directo
> funciona, pero **debe salir anunciado**, no de tapadillo, y con prioridad para la siguiente.

**Dos cosas que conviene hacer antes de dar el tag por bueno del todo** (ninguna bloquea):

- **Comprobar a mano** el Tab General de Devoluciones en 4K (F-3/F-4). Es el único punto del
  informe donde no puedo afirmar si hay defecto o no, y prefiero decirlo a etiquetarlo a la ligera.
- **Liberar documentos** en la web (aprobar/rechazar los cobros «Por aprobar»). Sin eso, la
  próxima barrida medirá todavía menos cobros que ésta.

**Lo que NO sostiene esta recomendación:** el módulo de **devoluciones no se ejercita dentro de
la corrida completa** — sólo aislado. Y hay **12 escenarios que este tenant no puede cubrir**
(§5), entre ellos el **multi-empresa**. Para lo que 4K sí puede medir, la versión se comporta.
