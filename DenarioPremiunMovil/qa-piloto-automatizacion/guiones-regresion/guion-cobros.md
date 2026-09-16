# Guion de regresión — Denario Premium móvil (Android)

## Módulo: Cobros

---

### Alcance y exclusiones

Este guion cubre el módulo de cobros de Denario Premium móvil en **Android**: pantalla de inicio (home) con botones de tipo de cobro, formulario de cobro (pestañas General / Documentos / Pagos / Total / Adjuntos), lista de cobros con búsqueda y gestión, guardar y enviar, y tipos de cobro condicionales por VG (Anticipo/Prepago, Retención, IGTF, Cobro 25% IVA).

Constituye un **catálogo completo** de flujos observables en UI. En una corrida real se estima ejecutar ~**70 %**; el resto quedará **N/A por configuración**, no FAIL. La ausencia de botones condicionales (Anticipo, Retención, IGTF, Cobro 25% IVA) cuando la VG no está activa **no es un fallo** — marcar como N/A.

**40 casos Manual-UI** en la tabla (`DM-COB-001`–`040`). Si una VG o dato de catálogo no aplica en la cuenta QA, marcar **N/A** (no FAIL).

**Fuente de verdad (textos UI y tags):** `../denario-movil-para-claude.xml` (módulos `COB`, `ADJ`, `CLI`, `DEN`) y código en `../../src/app/cobros/`.

**Ubicación (GPS):** si `userMustActivateGPS = true`, la app lee coordenadas del **dispositivo Android**. Sin ubicación, **COBRO** / tipos condicionales pueden no abrir el formulario — **N/A** por entorno, no FAIL. Activar ubicación y permiso a Denario antes de **002** y envío (**019**).

**Criterio de aplicabilidad:**
- **`Aplicación: Siempre`** — ejecutable con cualquier cuenta QA estándar con acceso al módulo.
- **`Aplicación: Condicional (VG: <clave>)`** — solo cuando esa configuración esté activa para la empresa probada; si no aplica, marcar **N/A**.

**Incluye:** acceso, botones por VG, formulario con 5 tabs, selector de cliente, documentos a cobrar, métodos de pago (Efectivo, Transferencia, Cheque, Depósito como **método de pago**, Pago Móvil, Otros), indicador de diferencia, totales, guardar/enviar, lista con búsqueda/eliminar/leer-solo, variantes por tipo (Anticipo, Retención, IGTF, Cobro 25% IVA), multimoneda, adjuntos (imagen, archivo y firma según VG), modal «Guardar y salir» / «Salir sin guardar» en cobro **nuevo** con cambios (**DM-COB-020**–**021**, **038**), y cambio de tasa en cobro **Guardado** reabierto (**DM-COB-039**).

**Excluye:** modo avión ni respuestas HTTP forzadas; manipulación de localStorage/ADB; verificación de cálculos matemáticos exactos (solo visibilidad de etiquetas y recálculo observable en UI); flujo "copiar cobro" si no hay botón visible en la UI actual (supuesto 6). La **visualización de adjuntos en la web** no se prueba en la app móvil, pero se documenta como verificación post-envío en corrida integral (supuesto 12).

**Orden recomendado con Depósitos:** para alimentar `guion-depositos`, ejecutar al menos un cobro **enviado** (**DM-COB-019**) antes del módulo Depósitos; no todos los métodos de pago generan cobros elegibles para depósito bancario (supuesto 11).

---

### Mapa rápido (código + `denario-movil-para-claude.xml`)

| Elemento | Detalle |
|---|---|
| Ruta Angular | `cobros` |
| Componente raíz | `src/app/cobros/cobros.component.ts/html` — carga cabecera + contenedor |
| Contenedor/home | `src/app/cobros/cobros-container/cobros-container.component.ts/html` — botones de tipo de cobro + navegación interna |
| Cabecera | `src/app/cobros/cobros-header/cobros-header.component.ts/html` — botón atrás, guardar, enviar, alertas |
| Formulario (tabs) | `src/app/cobros/cobros-container/cobro/cobro.component.ts/html` — 5 tabs con switch |
| Tab General | `src/app/cobros/cobros-container/cobro-general/cobro-general.component.ts/html` |
| Tab Documentos | `src/app/cobros/cobros-container/cobro-documents/cobro-documents.component.html` |
| Tab Pagos | `src/app/cobros/cobros-container/cobro-pagos/cobro-pagos.component.html` |
| Tab Total | `src/app/cobros/cobros-container/cobro-total/cobro-total.component.html` |
| Lista cobros | `src/app/cobros/cobros-container/cobro-list/cobros-list/cobros-list.component.ts/html` |
| Servicio central | `src/app/services/collection/collection-logic.service.ts` — estado, VG, carrito de pagos, totales |

**Tipos de cobro y efecto en tabs:**

| Tipo | Código | Botón home | Tab Documentos | Tab Pagos | VG requerida |
|---|---|---|---|---|---|
| Cobro normal | 0 | `COB_MODULE_NUEVO_COBRO` = "COBRO" | Visible | Visible | Ninguna (siempre activo) |
| Anticipo/Prepago | 1 | `COB_MODULE_ANTICIPO_PREPAGO` = "ANTICIPO/PREPAGO" | **Oculto** (`hideDocuments=true`) | Visible | `cobroPrepago = true` |
| Retención | 2 | `COB_MODULE_RETENTION` = "RETENCIÓN" | Visible | **Oculto** (`hidePayments=true`) | `cobroRetencion = true` |
| IGTF | 3 | `COB_MODULE_IGTF` = "IGTF" | Visible (+ selector IGTF) | Visible | `userCanSelectIGTF = true` |
| Cobro 25% IVA | 4 | `COB_MODULE_COBRO25` = "COBRO 25% IVA" | Visible | Visible | `userCanCollectIva = true` |

**Estados del cobro observables:**

| Código | Texto en lista | Editable | Botón eliminar |
|---|---|---|---|
| 0 (NEW) | Nuevo | Sí | No |
| 1 (SENT) | Enviado | No (solo lectura) | No |
| 2 (TO_SEND) | Por Enviar | No (solo lectura) | No |
| 3 (SAVED) | Guardado | Sí | Sí |

**Condición de habilitación de pestañas Documentos / Pagos / Total / Adjuntos:**
Las pestañas distintas de "General" permanecen bloqueadas (`collectValidTabsLocal = false`) hasta que se selecciona un cliente. Al seleccionarlo, el servicio emite `validCollection → true` y las pestañas se habilitan.

**Variables globales (VG) relevantes:**

| Clave | Efecto observable |
|---|---|
| `globalConfig.get("cobroPrepago")` | Muestra botón "ANTICIPO/PREPAGO" en home |
| `globalConfig.get("cobroRetencion")` | Muestra botón "RETENCIÓN" en home |
| `globalConfig.get("userCanSelectIGTF")` | Muestra botón "IGTF" en home + selector IGTF en Tab Documentos + filas IGTF en Total |
| `globalConfig.get("userCanCollectIva")` | Muestra botón "COBRO 25% IVA" en home |
| `globalConfig.get("enterpriseEnabled")` | Habilita el selector de empresa en Tab General |
| `globalConfig.get("requiredComment")` | Hace el campo Comentario obligatorio (etiqueta roja si vacío) |
| `globalConfig.get("multiCurrency")` + `showConversion` | Selector de moneda en Tab General; selector de moneda de documentos en Tab Documentos; filas de conversión en Total |
| `globalConfig.get("signatureCollection")` | Activa acordeón de firma en Tab Adjuntos (`app-adjunto`) |
| `globalConfig.get("userCanUploadFiles")` | Activa acordeón de archivo en Tab Adjuntos |
| `globalConfig.get("userMustActivateGPS")` | Requiere GPS para abrir nuevo cobro; si no hay coords, la acción no navega |
| `globalConfig.get("userCanAddRetention")` | Permite agregar retenciones a cobros de tipo Retención ya enviados (desde Tab Total) |
| `globalConfig.get("userCanSelectCollectDiscount")` | Muestra columna "Descuento" en la tabla del Tab Total |
| `globalConfig.get("validateCollectionDate")` | Deshabilita selector de fecha en los métodos de pago |
| `globalConfig.get("enabledManualRate")` | Input numérico de tasa (`COB_TASA`) editable; al cambiar recalcula montos (`onManualRateBlur`) |
| `globalConfig.get("historicoTasa")` | Selector de tasa y/o fecha de tasa (`COB_FECHA_TASA`) cuando no hay tasa manual |
| `globalConfig.get("canChangeRate")` | Habilita cambio de fecha/selector de tasa histórica (si `false`, controles deshabilitados) |
| `globalConfig.get("requiredCollectionAttachments")` | Obliga agregar al menos un adjunto (**foto o archivo**) antes de poder **ENVIAR** el cobro. **Default implícito `true`** cuando la clave no está configurada en la empresa — prácticamente siempre activo salvo que la empresa lo deshabilite con `"false"`. **La firma no cuenta** (`tieneFirma()` es independiente; `hasItems()` solo evalúa `fotos.length > 0 \|\| files.length > 0`). Si activa y no hay adjuntos, el envío muestra la alerta `COB_RET_MSJ_COLLECTION_NO_ATTACHMENTS` y regresa sin enviar. **Impacto en automatización CDP:** los botones de galería/cámara/subir archivo requieren APIs nativas Android no accesibles vía CDP — usar inyección directa en `AdjuntoService` (ver DM-COB-016). |

**Tags clave del módulo:**

| Tag | Valor por defecto |
|---|---|
| `COB_PESTANA_GENERAL` | General |
| `COB_PESTANA_DOCUMENTOS` | Documentos |
| `COB_PESTANA_PAGOS` | Pagos |
| `COB_PESTANA_TOTAL` | Total |
| `COB_PESTANA_ADJUNTOS` | Adjuntos |
| `COB_MONTO_TOTAL` | Monto total a pagar |
| `COB_DIFERENCIA` | Diferencia |
| `COB_EFECTIVO` | Efectivo |
| `COB_PAGO_MOVIL` | Pago Móvil |
| `COB_CHEQUE` | Cheque |
| `COB_DEPOSITO` | Depósito |
| `COB_TRANSFERENCIA` | Transferencia |
| `COB_OTROS` | Otros |
| `COB_TASA` | Tasa |
| `COB_FECHA_TASA` | Fecha Tasa |
| `COB_COB_CHANGE_DATERATE` | Alerta al cambiar fecha de tasa con documentos cargados |
| `COB_COB_CHANGE_CURRENCY` | Alerta al cambiar moneda del cobro |
| `CLI_SIN_RESULTADOS` (CLI) | No hay clientes disponibles (selector) |
| `DENARIO_BOTON_SALIR_GUARDAR` / `DENARIO_BOTON_SALIR` (DEN) | «Guardar y salir» / «Salir sin guardar» (modal salir cobro nuevo) |
| `ADJ_ACORDEON_IMAGENES` / `ADJ_ACORDEON_ARCHIVO` / `ADJ_ACORDEON_FIRMA` (ADJ) | Acordeones Tab Adjuntos |

---

### Criterio Manual-UI

Cada fila es ejecutable en Android sin ADB ni inspección de red. Textos esperados desde tags en `denario-movil-para-claude.xml`. La columna **Soporte (XML / código)** enlaza tag + fuente en el repo.

### Casos de prueba

| ID | Escenario | Precondiciones | Pasos | Datos / ejemplo | Resultado esperado | Fallo observable (PASS/FAIL) | Severidad | Soporte (XML / código) |
|---|---|---|---|---|---|---|---|---|
| DM-COB-001 | Home del módulo cobros → botones según VG; siempre visibles COBRO y BUSCAR | Sesión iniciada. App en Home. **Aplicación: Siempre** | 1. Acceder al módulo Cobros desde Home. 2. Observar los botones del home. | N/A | Siempre visibles: botón "COBRO" y botón "BUSCAR". Si VG activa: "ANTICIPO/PREPAGO" (cobroPrepago), "RETENCIÓN" (cobroRetencion), "IGTF" (userCanSelectIGTF), "COBRO 25% IVA" (userCanCollectIva). Cabecera muestra el título del módulo y botón atrás. | FAIL: Pantalla en blanco; el botón "COBRO" o "BUSCAR" ausente; app colapsa. | S1 — impide toda operación del módulo | `src/app/cobros/cobros-container/cobros-container.component.html:3-60` |
| DM-COB-002 | Nuevo cobro → formulario abre con 5 tabs; Documentos/Pagos/Total/Adjuntos deshabilitados | Home cobros activo. **Aplicación: Siempre** | 1. Pulsar el botón "COBRO". 2. Observar las pestañas del formulario. | N/A | Overlay de carga breve. Formulario carga con 5 tabs: General (activa), Documentos, Pagos, Total, Adjuntos. Las 4 pestañas distintas de General están deshabilitadas. El campo "Cliente" está vacío. Botones guardar y enviar visibles en cabecera (deshabilitados inicialmente). | FAIL: Tabs accesibles sin cliente; formulario en blanco; overlay no desaparece; app colapsa. | S1 | `src/app/cobros/cobros-container/cobro/cobro.component.html:3-32`, `cobro.component.ts:30-59` |
| DM-COB-003 | Tocar pestaña deshabilitada sin cliente → indica campo requerido | Formulario de cobro nuevo sin cliente. **Aplicación: Siempre** | 1. Sin cliente seleccionado, intentar tocar la pestaña "Documentos" (deshabilitada). | N/A | Las pestañas no cambian (siguen bloqueadas). El campo "Cliente" en Tab General muestra un indicador visual de error o permanece con borde de advertencia. | FAIL: Las tabs se habilitan sin cliente; app colapsa al tocar tab deshabilitada. | S2 | `src/app/cobros/cobros-container/cobro/cobro.component.html:10-11` (condición `[disabled]="!collectValidTabsLocal"`) |
| DM-COB-004 | Seleccionar cliente en el selector modal → campo relleno y pestañas habilitadas | Formulario de cobro nuevo abierto. **Aplicación: Siempre** | 1. Tocar el campo "Cliente" para abrir el modal selector. 2. Seleccionar un cliente de la lista. 3. Observar el Tab General y el estado de las pestañas. | Cualquier cliente existente en la app | El modal se cierra. El campo "Cliente" muestra el nombre del cliente. Las 4 pestañas (Documentos, Pagos, Total, Adjuntos) se habilitan. El resto de campos del Tab General (empresa, moneda, fecha, responsable, comentario) son visibles y editables. | FAIL: Campo cliente no se rellena; pestañas siguen deshabilitadas; modal no se cierra; app colapsa. | S1 | `src/app/cobros/cobros-container/cobro-general/cobro-general.component.ts:113-121`, `cobro.component.ts:48-58` (`validCollection`) |
| DM-COB-005 | Búsqueda de cliente en el selector modal → resultados filtrados; sin resultados muestra aviso | Selector de clientes abierto. **Aplicación: Siempre** | 1. Ingresar texto parcial del nombre de un cliente y pulsar buscar o Enter. 2. Ingresar texto sin coincidencias (ej. `"ZZZZZZZ"`). | Texto 1: nombre parcial; Texto 2: `"ZZZZZZZ"` | Búsqueda 1: lista filtrada con clientes que coinciden. Búsqueda 2: mensaje «No hay clientes disponibles» (`CLI_SIN_RESULTADOS`). | FAIL: Lista no filtra; botón de búsqueda no responde; app colapsa. | S2 | XML: `CLI_SIN_RESULTADOS` · `cliente-selector.component.html` |
| DM-COB-006 | Campo "Comentario" obligatorio marcado en rojo al estar vacío [VG requiredComment] | Formulario con cliente seleccionado. VG `requiredComment = true`. **Aplicación: Condicional (VG: `globalConfig.get("requiredComment") = true`)** | 1. Con cliente seleccionado, dejar el campo "Comentario" vacío. 2. Intentar guardar o navegar a otra pestaña. 3. Observar el campo. | Sin comentario | El campo "Comentario" muestra un borde de error y una etiqueta roja "campo obligatorio" debajo. | FAIL: No aparece indicación de error con campo vacío y VG activa; se permite guardar con comentario vacío. | S2 | `src/app/cobros/cobros-container/cobro-general/cobro-general.component.html:172-177` |
| DM-COB-007 | Tab Documentos → lista de documentos del cliente con indicadores de color vigente/vencido/a favor | Cliente seleccionado. Tab Documentos habilitada. Cliente con documentos de venta sincronizados. Cobro **normal**, IGTF o Cobro 25% (no Anticipo). **Aplicación: Siempre** (*N/A si la corrida es solo Anticipo — ver **DM-COB-028***) | 1. Pulsar la pestaña "Documentos". 2. Observar la lista y la leyenda. | N/A | Se muestra la leyenda de colores (azul = vigente, rojo = vencido, negro = a favor) con botones de información (ⓘ). La lista muestra documentos del cliente con sus montos. Si no hay documentos, aparece el mensaje correspondiente (sin documentos en catálogo → **N/A** por datos, no FAIL). | FAIL: Tab Documentos vacía teniendo documentos sincronizados; leyenda ausente; app colapsa. | S1 | `src/app/cobros/cobros-container/cobro-documents/cobro-documents.component.html:54-72` |
| DM-COB-008 | Seleccionar documento(s) en Tab Documentos → monto total a pagar actualizado en Tab Pagos | Tab Documentos abierta con documentos visibles. Cobro con Tab Pagos visible. **Aplicación: Siempre** (*N/A en Anticipo sin documentos — **DM-COB-028**; N/A en Retención sin Tab Pagos — **DM-COB-029***) | 1. Seleccionar uno o más documentos de la lista. 2. Ir al Tab Pagos. 3. Observar el monto total a pagar visible en la cabecera sticky de Pagos. | N/A | El monto total a pagar en el sticky de Tab Pagos refleja la suma de los documentos seleccionados. La diferencia muestra el saldo pendiente (en azul si >= 0, rojo si negativo). | FAIL: El monto total no cambia al seleccionar documentos; diferencia no aparece; app colapsa. | S1 | `src/app/cobros/cobros-container/cobro-pagos/cobro-pagos.component.html:1-18` (sticky con monto + diferencia) |
| DM-COB-009 | Tab Pagos → abrir modal "Agregar método de pago" → métodos habilitados para el cliente | Tab Pagos activa. **Aplicación: Siempre** (*N/A en cobro tipo Retención — **DM-COB-029***) | 1. En Tab Pagos, pulsar el botón "Agregar método de pago". 2. Observar el modal. | N/A | Se abre un modal con checkboxes de métodos de pago **habilitados para el cliente** (pueden ser todos o solo uno, ej. solo «Depósito»). Opciones posibles en catálogo: Efectivo, Pago Móvil, Cheque, Depósito, Transferencia, Otros. Botones "Cancelar" y "Agregar" visibles. Si el cliente solo tiene Depósito, **no es FAIL** que los demás no aparezcan. | FAIL: Modal no abre; ningún método disponible teniendo el cliente métodos en backend; app colapsa. | S1 | `src/app/cobros/cobros-container/cobro-pagos/cobro-pagos.component.html:38-73` |
| DM-COB-010 | Seleccionar método Efectivo → acordeón visible con campos monto, nro recibo, fecha | Modal de métodos abierto. **Aplicación: Siempre** (*N/A en Retención — **DM-COB-029***) | 1. En el modal, marcar el checkbox "Efectivo". 2. Pulsar "Agregar". 3. Observar Tab Pagos. | N/A | El modal se cierra. Aparece un acordeón para "Efectivo" con los campos: Nro. de Recibo, Monto (numérico, obligatorio marcado si vacío), Fecha (con selector de calendario). El acordeón tiene botón de eliminar (basura). | FAIL: Acordeón no aparece; campos de efectivo ausentes; botón eliminar ausente; app colapsa. | S1 | `src/app/cobros/cobros-container/cobro-pagos/cobro-pagos.component.html:80-150` |
| DM-COB-011 | Seleccionar método Transferencia → acordeón con campos banco, referencia, fecha, monto | Modal de métodos abierto. **Aplicación: Siempre** (*N/A en Retención — **DM-COB-029***) | 1. Marcar "Transferencia" en el modal. 2. Pulsar "Agregar". 3. Observar el acordeón generado en Tab Pagos. | N/A | Aparece acordeón "Transferencia" con: Banco Receptor (selector), Nro. de Referencia, Monto (numérico), Fecha (calendario). Botón eliminar visible. | FAIL: Acordeón ausente; campos de transferencia incompletos; banco receptor vacío sin opciones. | S2 | `src/app/cobros/cobros-container/cobro-pagos/cobro-pagos.component.html` (sección transferencia) |
| DM-COB-040 | Seleccionar método **Depósito** → banco, nº depósito y monto igual al total a pagar | Tras **DM-COB-008** (documentos seleccionados y monto total visible en sticky de Pagos). Cliente con método Depósito habilitado (puede ser la **única** opción en el modal). **Aplicación: Siempre** (*N/A en Retención — **DM-COB-029***) | 1. En Tab Pagos, pulsar "Agregar método de pago". 2. Marcar **Depósito** (único disponible o entre los habilitados). Pulsar "Agregar". 3. En el acordeón Depósito: seleccionar **banco** en el selector (`COB_BANCO_RECEPTOR`). 4. Ingresar **número de depósito** en el campo correspondiente (`COB_NRO_DEPOSITO`). 5. Ingresar **monto** **igual** al «Monto total a pagar» del sticky (cabecera de Pagos). 6. Observar indicador «Diferencia». | Nro. depósito: `TEST-DEP-040`; monto = total del sticky | Acordeón Depósito visible. Banco seleccionado. Nro. depósito en campo. Monto coincide con el total a pagar. «Diferencia» en **azul** (sin saldo pendiente). Botones guardar/enviar **habilitados** (junto con documentos). | FAIL: No aparece Depósito siendo el método del cliente; selector de banco vacío; monto distinto y diferencia en rojo; guardar/enviar siguen deshabilitados con datos aparentemente completos. | S1 | `src/app/cobros/cobros-container/cobro-pagos/cobro-pagos.component.html:439-523` (`pagoDeposito`, `selectBankAccount`) |
| DM-COB-012 | Indicador "Diferencia" cambia de color: azul cuando pago cubre total; rojo cuando es insuficiente | Tab Pagos con documentos seleccionados y monto total > 0. Método de pago agregado (**DM-COB-040** Depósito o **DM-COB-010** Efectivo). **Aplicación: Siempre** (*N/A en Retención — **DM-COB-029**; en Anticipo usar monto en Pagos sin documentos — **DM-COB-028***) | 1. Ingresar un monto del método de pago **MENOR** al total a pagar. 2. Observar el indicador "Diferencia" en el sticky. 3. Ingresar un monto **IGUAL** al total. 4. Observar de nuevo. | Monto menor y monto igual al total | Paso 2: etiqueta "Diferencia" y su valor aparecen en **rojo** (pago insuficiente). Paso 4: etiqueta y valor cambian a **azul** (pago suficiente o con exceso). | FAIL: El color no cambia; diferencia siempre en un solo color independientemente del monto; diferencia no se actualiza. | S2 | `src/app/cobros/cobros-container/cobro-pagos/cobro-pagos.component.html:12-16` (ngStyle color) |
| DM-COB-013 | Eliminar método de pago desde el acordeón en Tab Pagos → acordeón desaparece | Tab Pagos con al menos un método de pago configurado. **Aplicación: Siempre** (*N/A en Retención — **DM-COB-029***) | 1. En Tab Pagos, localizar un acordeón de método de pago. 2. Pulsar el botón basura (eliminar) del acordeón. | N/A | El acordeón del método de pago desaparece. El monto total pagado se recalcula. | FAIL: El acordeón persiste tras eliminar; el total no se actualiza; app colapsa. | S2 | `src/app/cobros/cobros-container/cobro-pagos/cobro-pagos.component.html:140-142` (botón basura) |
| DM-COB-014 | Tab Total → tabla resumen de documentos y acordeones por método de pago | Tab Total activa. Documentos seleccionados y al menos un método de pago configurado. **Aplicación: Siempre** | 1. Pulsar la pestaña "Total". 2. Observar la tabla y los acordeones. | N/A | Visible: "Monto total a Pagar [moneda]: X", "Pago [moneda]: X", "Diferencia [moneda]: X" (en azul o rojo). Tabla con columnas: Tipo, Nro. Doc., Monto Doc., Desviación/Faltante, Monto Pago. Acordeones expandibles por método (Efectivo, Transferencia, etc.) con subtotales. | FAIL: Tab Total en blanco; tabla ausente; acordeones de métodos no expandibles; diferencia faltante. | S2 | `src/app/cobros/cobros-container/cobro-total/cobro-total.component.html:9-112` |
| DM-COB-015 | Tab Total → total general visible al final | Tab Total con datos. **Aplicación: Siempre** | 1. Desplazarse hasta el final del Tab Total. 2. Observar el campo de Total General. | N/A | Aparece la línea "Total General [moneda]: X" con el monto consolidado de todos los métodos de pago. | FAIL: Total General ausente; valor incorrecto o vacío. | S2 | `src/app/cobros/cobros-container/cobro-total/cobro-total.component.html:527-532` |
| DM-COB-016 | Tab Adjuntos → agregar foto vía mock de Capacitor Camera (pre-requisito obligatorio de DM-COB-019 cuando `requiredCollectionAttachments=true`) | Formulario con cliente seleccionado, documentos seleccionados y método de pago configurado (post **DM-COB-040**). Cobro editable (nuevo o Guardado). **Aplicación: Siempre** cuando VG `requiredCollectionAttachments=true` (default implícito). | **1.** Ir a Tab Adjuntos (`COB_PESTANA_ADJUNTOS`). **2.** Verificar acordeones visibles: Imágenes (`ADJ_ACORDEON_IMAGENES`), Archivo (si `userCanUploadFiles`), Firma (si `signatureCollection`). **3. Mockear `Camera.getPhoto` antes de clickear el botón de cámara** (funciona en builds de producción y desarrollo — `window.Capacitor` siempre disponible): `await pg.evaluate((b64) => { window.Capacitor.Plugins.Camera.getPhoto = async () => ({ base64String: b64, format: 'jpeg', saved: false }); return 'OK'; }, BASE64_1PX_JPEG)`. **4.** Obtener coordenadas de `ADJ_TOMAR_FOTO` y ejecutar `pg.mouse.click(coords.x, coords.y)`. **5.** Esperar ~800 ms (`pg.waitForTimeout(800)`). **6.** Verificar que el carrusel de imágenes aparece en el acordeón. **Alternativa si `ADJ_TOMAR_FOTO` no está visible** (`service.showCamera=false`): usar mock doble de `Camera.pickImages` + `Filesystem.readFile` sobre `ADJ_BUSCAR_FOTO` — ver helper `mockCameraAdjunto` en `automation/cdp/denario-cdp-helpers.js`. La firma **no cuenta** para `hasItems()`. | `BASE64_1PX_JPEG`: constante exportada en `automation/cdp/denario-cdp-helpers.js`; Comentario: `Test-COB-016` | Acordeón Imágenes muestra carrusel con la foto. `adjuntoService.hasItems()` = `true`. Al guardar (**DM-COB-018**) y reabrir Guardado, el adjunto persiste. **El cobro puede enviarse en DM-COB-019 sin alerta de adjunto faltante.** | FAIL: `window.Capacitor.Plugins.Camera` no disponible (no es app Capacitor); `ADJ_TOMAR_FOTO` y `ADJ_BUSCAR_FOTO` ambos ausentes; carrusel no aparece tras el click; alerta `COB_RET_MSJ_COLLECTION_NO_ATTACHMENTS` al enviar. | S1 | `adjunto.component.ts:235-265` (`tomarImg` — usa `Camera.getPhoto` con `Base64`), `adjunto.service.ts:138-140` (`hasItems`), `cobros-header.component.ts:306-311` (validación envío) · VG `requiredCollectionAttachments` |
| DM-COB-017 | Botones guardar/enviar deshabilitados sin datos suficientes | Formulario de cobro nuevo sin documentos ni pagos. **Aplicación: Siempre** | 1. Con cliente seleccionado pero sin documentos ni pagos, observar el estado de los botones en cabecera. | N/A | Los botones guardar y enviar están deshabilitados (no responden al toque). | FAIL: Botones habilitados con cobro sin datos; se guarda un cobro vacío. | S2 | `src/app/cobros/cobros-header/cobros-header.component.html:24-32` (`[disabled]` conditions) |
| DM-COB-018 | Guardar cobro con datos completos → mensaje de confirmación + aparece en lista como "Guardado" | Formulario con datos mínimos del tipo: **normal/IGTF/Cobro25**: cliente + documentos + pago; **Anticipo**: cliente + pago sin documentos; **Retención**: cliente + documento(s) sin pagos. Botón guardar habilitado. **Aplicación: Siempre** | 1. Pulsar guardar en cabecera. 2. Observar mensaje. 3. Ir a BUSCAR y verificar lista. 4. Reabrir el cobro Guardado y confirmar datos (y adjuntos si se usó **DM-COB-016**). | Comentario: `Test-COB-018` | Mensaje de confirmación. El formulario **permanece abierto** hasta que el tester navega atrás o a BUSCAR (no auto-navega al home). En lista: estatus "Guardado", cliente y tipo correctos. | FAIL: Sin mensaje; no aparece en lista; estatus incorrecto; datos perdidos al reabrir; app colapsa. | S1 | `cobros-header.component.ts` (`sendOrSave(false)`) |
| DM-COB-019 | Enviar cobro → modal de confirmación → cobro queda como "Por Enviar" o "Enviado" | Formulario con datos completos. Botón enviar habilitado. **Aplicación: Siempre** cuando `requiredCollectionAttachments=false` (adjunto no requerido) o cuando hay adjunto real ya agregado. **⏭ SKIP cuando `requiredCollectionAttachments=true` + APK producción** (campo `cobros_envio_manual=true` en perfil playa) — agregar adjunto vía CDP no es viable; el cobro queda "Guardado" para envío manual posterior por el QA. | 1. Pulsar el botón enviar en la cabecera. 2. Observar el modal de confirmación de envío. 3. Pulsar "Aceptar". 4. Verificar que no aparece segunda alerta de adjunto faltante. 5. Verificar en la lista de cobros. | N/A | Aparece modal de confirmación. Al aceptar: overlay de carga, app regresa al home del módulo. En la lista: estatus **"Por Enviar"** o **"Enviado"**. Sin segunda alerta tras ACEPTAR. **APK producción:** cobro queda "Guardado" — documentar en tabla de registros como "Pendiente envío manual". | FAIL (corrida manual/APK dev): modal no aparece; segunda alerta `COB_RET_MSJ_COLLECTION_NO_ATTACHMENTS` tras ACEPTAR — cobro no enviado. SKIP (APK producción sin adjunto): comportamiento esperado, no es FAIL. | S1 | `cobros-header.component.ts:292-331` (`sendOrSave`) |
| DM-COB-020 | Salir de cobro **nuevo** con cambios → modal con «Guardar y salir» / «Salir sin guardar» / Cancelar | Cobro **nuevo** no guardado: cliente seleccionado y al menos un cambio (documento, pago o comentario). `stDelivery` distinto de Guardado/Enviado/Por Enviar. **Aplicación: Siempre** | 1. Sin guardar desde cabecera, pulsar atrás. 2. Observar el modal de salida. | Comentario de prueba opcional | Modal con tres opciones: **`DENARIO_BOTON_SALIR_GUARDAR`** («Guardar y salir»), **`DENARIO_BOTON_SALIR`** («Salir sin guardar») y Cancelar. *Sin cliente seleccionado puede salir sin modal — no FAIL.* | FAIL: Cobro nuevo con cliente y cambios y atrás sale sin modal; falta alguna opción; app colapsa. | S2 | XML: `DENARIO_BOTON_SALIR_GUARDAR`, `DENARIO_BOTON_SALIR` · `cobros-header.component.ts:216-217`, `buttonsSalvar` |
| DM-COB-021 | «Salir sin guardar» desde modal (cobro nuevo) → no queda en lista | Continuación de **DM-COB-020** (modal visible). Cobro era **nuevo**. **Aplicación: Siempre** | 1. Pulsar **`DENARIO_BOTON_SALIR`** («Salir sin guardar»), **no** «Guardar y salir» (**DM-COB-038**). 2. Ir a BUSCAR. | — | Home del módulo cobros. El borrador **no** aparece en lista. | FAIL: El cobro aparece como Guardado sin haber elegido guardar; navega a pantalla incorrecta. | S2 | XML: `DENARIO_BOTON_SALIR` · `cobros-header.component.ts:108-119` (`role` `exit`) |
| DM-COB-022 | Buscar cobro → lista de cobros con searchbar en tiempo real | Home cobros. Al menos un cobro guardado/enviado. **Aplicación: Siempre** | 1. Pulsar "BUSCAR". 2. Observar la lista. 3. Ingresar texto en la barra de búsqueda (nombre de cliente o código). | Texto: nombre parcial de cliente | Lista visible con: cliente, nro. ref (si existe), estatus, fecha y tipo de cobro. Al escribir, la lista filtra en tiempo real. El botón de eliminar aparece SOLO para cobros con estatus "Guardado". Ícono de información (ⓘ) visible junto a cobros con comentario. | FAIL: Lista vacía teniendo cobros; búsqueda no filtra; botón eliminar en cobros enviados; app colapsa. | S1 | `src/app/cobros/cobros-container/cobro-list/cobros-list/cobros-list.component.html:1-64` |
| DM-COB-023 | Ícono de comentario en lista → muestra el comentario del cobro | Lista de cobros con al menos un cobro que tenga comentario registrado. **Aplicación: Siempre** | 1. Localizar un cobro con el ícono de información (ⓘ) junto al estatus. 2. Pulsar el ícono. | N/A | Aparece una alerta/popover con el texto del comentario del cobro. | FAIL: Ícono ausente teniendo comentario; alerta sin texto; app colapsa al pulsar el ícono. | S3 | `src/app/cobros/cobros-container/cobro-list/cobros-list/cobros-list.component.html:35-39` |
| DM-COB-024 | Abrir cobro "Guardado" desde lista → formulario editable con botones activos | Lista con al menos un cobro "Guardado". **Aplicación: Siempre** | 1. Tocar un cobro con estatus "Guardado". 2. Observar el formulario. | N/A | El formulario carga con los datos previos (cliente, documentos, pagos). Las pestañas son accesibles. Botones guardar y enviar visibles y operables en la cabecera. | FAIL: Formulario en blanco; modo solo lectura; botones ausentes; app colapsa. | S2 | `src/app/cobros/cobros-container/cobro-list/cobros-list/cobros-list.component.ts` (`onCollectSelect`) |
| DM-COB-025 | Abrir cobro "Por Enviar" o "Enviado" desde lista → solo lectura sin botones guardar/enviar | Lista con al menos un cobro "Por Enviar" o "Enviado". **Aplicación: Siempre** | 1. Tocar un cobro con estatus "Por Enviar" o "Enviado". 2. Observar el formulario. | N/A | El formulario muestra los datos del cobro. Los campos son de solo lectura (responsable, comentario, moneda no editables). Los botones guardar y enviar NO aparecen en la cabecera (solo ícono decorativo). | FAIL: Botones guardar/enviar visibles para cobros enviados; campos editables; app colapsa. | S2 | `src/app/cobros/cobros-header/cobros-header.component.html:22-32` (condición `showHeaderButtons`) |
| DM-COB-026 | Eliminar cobro "Guardado" desde la lista → modal de confirmación y desaparece | Lista con al menos un cobro "Guardado". **Aplicación: Siempre** | 1. Localizar un cobro con estatus "Guardado" (botón basura rojo visible). 2. Pulsar el botón de eliminar. 3. Pulsar "Eliminar" en el modal de confirmación. | N/A | Aparece modal de confirmación. Al confirmar, el cobro desaparece de la lista. El botón de eliminar solo es visible para cobros "Guardado". | FAIL: No aparece modal; cobro persiste; botón eliminar visible para cobros enviados; app colapsa. | S2 | `src/app/cobros/cobros-container/cobro-list/cobros-list/cobros-list.component.html:50-54`, `cobros-list.component.ts:55-68` |
| DM-COB-027 | Botón atrás desde cobro o lista → regresa al home del módulo cobros | Formulario de cobro o lista de cobros activos. **Aplicación: Siempre** | 1. Desde el formulario de cobro (sin cambios, o tras la advertencia), pulsar el botón atrás en cabecera. 2. Observar la navegación. | N/A | App navega al home del módulo cobros. Siempre visibles: "COBRO" y "BUSCAR"; botones extra según VG (Anticipo, Retención, IGTF, Cobro 25% IVA). | FAIL: Navega a Home principal en lugar del home cobros; app permanece en el formulario; botón no responde. | S2 | `src/app/cobros/cobros-container/cobros-container.component.ts:56-82` (`backRoute`) |
| DM-COB-028 | Cobro Anticipo/Prepago → sin Documentos; flujo Pagos + guardar [VG cobroPrepago] | VG `cobroPrepago = true`. **Aplicación: Condicional (VG: `globalConfig.get("cobroPrepago") = true`)** | 1. Pulsar "ANTICIPO/PREPAGO". 2. Seleccionar cliente. 3. Confirmar que no existe pestaña Documentos. 4. En Tab Pagos agregar Efectivo con monto > 0 (sin seleccionar documentos). 5. Guardar (**DM-COB-018**). | Comentario: `Test-COB-028` | Título "Anticipo". Pestañas: General, Pagos, Total, Adjuntos (sin Documentos). Guardar habilitado con solo cliente + pago; en lista aparece como Guardado tipo anticipo. Casos **007–008** y selección de documentos → **N/A** en esta corrida. | FAIL: Documentos visible; no permite guardar solo con pagos; guardar deshabilitado con pago válido; app colapsa. | S2 | `cobros-container.component.ts:135-149`, `hideDocuments=true` |
| DM-COB-029 | Cobro tipo Retención → sin Pagos; documentos + Total + guardar [VG cobroRetencion] | VG `cobroRetencion = true`. Cliente con documentos. **Aplicación: Condicional (VG: `globalConfig.get("cobroRetencion") = true`)** | 1. Pulsar "RETENCIÓN". 2. Seleccionar cliente y documento(s) en Tab Documentos. 3. Ir a Tab Total y verificar acordeones de retención. 4. Guardar (**DM-COB-018**). | Comentario: `Test-COB-029` | Título "Retención". **Sin** pestaña Pagos. Total muestra IVA/ISLR retenido y monto total retenido. Guardar habilitado sin métodos de pago. Casos **009–013** → **N/A** en esta corrida. | FAIL: Pagos visible; no guarda con documentos; Total sin datos de retención; app colapsa. | S2 | `cobros-container.component.ts:150-164`, `cobro-total.component.html:538-707` |
| DM-COB-030 | Selector IGTF visible en Tab Documentos para cobro tipo IGTF [VG userCanSelectIGTF] | Home cobros. VG `userCanSelectIGTF = true`. **Aplicación: Condicional (VG: `globalConfig.get("userCanSelectIGTF") = true`)** | 1. Pulsar el botón "IGTF". 2. Seleccionar un cliente. 3. Ir al Tab Documentos. | N/A | En Tab Documentos, aparece un selector de tasa IGTF (con porcentaje). Si la moneda seleccionada es "dura", el selector es operable. También aparece un toggle para indicar si el IGTF se paga por separado. | FAIL: Selector IGTF ausente en cobro tipo IGTF; toggle ausente; app colapsa. | S2 | `src/app/cobros/cobros-container/cobro-documents/cobro-documents.component.html:26-52` |
| DM-COB-031 | Descuento seleccionable por documento en Tab Total [VG userCanSelectCollectDiscount] | Cobro con documentos seleccionados. VG `userCanSelectCollectDiscount = true`. **Aplicación: Condicional (VG: `globalConfig.get("userCanSelectCollectDiscount") = true`)** | 1. Ir al Tab Total con documentos seleccionados. 2. Observar la tabla de documentos. | N/A | La tabla de documentos en Tab Total incluye una columna "Descuento" visible con valores por cada documento. | FAIL: Columna "Descuento" ausente con VG activa; app colapsa al cargar Tab Total. | S3 | `src/app/cobros/cobros-container/cobro-total/cobro-total.component.html:134-138` |
| DM-COB-032 | Agregar retención a cobro "Enviado" de tipo Retención [VG userCanAddRetention] | Lista con cobro tipo Retención en estatus "Enviado". VG `userCanAddRetention = true`. **Aplicación: Condicional (VG: `globalConfig.get("userCanAddRetention") = true`)** | 1. Abrir un cobro "Enviado" de tipo Retención. 2. Ir al Tab Total. 3. Observar si hay un botón para agregar retención. 4. Pulsarlo. | N/A | El botón "Agregar retención" es visible en Tab Total para cobros de tipo Retención enviados. Al pulsarlo, se abre un modal con campos: Nro. Doc., Nro. Comprobante, IVA Retención, ISLR Retención, Monto Total (solo lectura calculado). Botones Cancelar y Guardar. | FAIL: Botón ausente con VG activa y cobro enviado; modal no abre; campos del modal vacíos; app colapsa. | S3 | `src/app/cobros/cobros-container/cobro-total/cobro-total.component.html:541-545, 605-706` |
| DM-COB-033 | Selector de moneda del cobro en Tab General [VG multiCurrency] | Formulario de cobro nuevo. VG `multiCurrency = true` y conversión activa. **Aplicación: Condicional (VG: `globalConfig.get("multiCurrency") = true`)** | 1. Tras seleccionar cliente, observar el selector de moneda en Tab General. 2. Cambiar entre las monedas disponibles (ej. BS y USD, según catálogo). | Monedas del catálogo QA | El selector está habilitado y muestra al menos dos monedas. Al cambiar, el campo se actualiza y pueden aparecer filas de tasa/conversión en General o Total. | FAIL: Selector ausente o bloqueado con VG activa; sin opciones; app colapsa al cambiar. | S2 | `cobro-general.component.html:37-43`, `collection-logic.service.ts` (`multiCurrency`) |
| DM-COB-034 | Selector de moneda de documentos en Tab Documentos (BS / USD) [VG multiCurrency] | Cliente con documentos en más de una moneda (o filtro por moneda). VG `multiCurrency = true`. Cobro con Tab Documentos visible. **Aplicación: Condicional (VG: `globalConfig.get("multiCurrency") = true`)** | 1. Ir a Tab Documentos. 2. Localizar el selector "Moneda documento" (o etiqueta equivalente). 3. Cambiar entre opciones (ej. BS y USD). 4. Observar la lista de documentos. | Monedas: las que muestre `currencyListDocument` | El selector es visible bajo multimoneda. Al cambiar moneda, la lista de documentos se recarga o filtra según la moneda elegida. | FAIL: Selector ausente con VG activa; cambio de moneda no afecta documentos; app colapsa. | S2 | `cobro-documents.component.html:8-21` (`currencySelectedDocument`) |
| DM-COB-035 | Cambio de moneda del cobro con documentos o pagos ya cargados → alerta de confirmación | Cobro con cliente, al menos un documento seleccionado o un pago registrado. VG multimoneda. **Aplicación: Condicional (VG: `globalConfig.get("multiCurrency") = true`)** | 1. En Tab General, cambiar la moneda del cobro a otra distinta de la actual. 2. Observar si aparece una alerta/modal. 3. Cancelar y verificar que la moneda no cambió; repetir y confirmar si la UI lo permite. | N/A | Aparece alerta (`alertMessageChangeCurrency`) advirtiendo el impacto del cambio de moneda, con opciones de confirmar o cancelar según botones del alert. | FAIL: Cambia moneda y borra datos sin advertencia; alerta sin texto; app colapsa. | S2 | `cobro-general.component.ts:932-958` (`onChangeCurrencyMsj`), `cobro-general.component.html:210-212` |
| DM-COB-036 | Cobro tipo IGTF → selector en Documentos + guardar flujo mínimo [VG userCanSelectIGTF] | VG `userCanSelectIGTF = true`. Cliente con documentos IGTF. **Aplicación: Condicional (VG: `globalConfig.get("userCanSelectIGTF") = true`)** | 1. Pulsar "IGTF". 2. Seleccionar cliente. 3. En Tab Documentos elegir tasa IGTF y al menos un documento (si hay). 4. Completar pago en Tab Pagos si aplica. 5. Guardar con comentario `Test-COB-036`. | Comentario: `Test-COB-036` | Título IGTF. Selector de tasa visible en Documentos. Cobro guardable y visible en lista como Guardado. Casos **007–008** aplican con documentos IGTF. | FAIL: No abre flujo IGTF; selector ausente; no guarda con datos mínimos; app colapsa. | S2 | `cobros-container.component.ts:165-178`, `cobro-documents.component.html:26-52` |
| DM-COB-044 | Persistencia IGTF — **default conservado al reabrir**: cobro $ con IGTF por defecto → guardar → reabrir muestra la misma tasa | Cobro tipo IGTF en moneda dura ($). VG `userCanSelectIGTF = true`. Sin tocar el selector IGTF (queda el default del sistema). **Las tasas IGTF y el default los configura cada cliente desde la web → varían por cuenta; descubrir en UI, no asumir. Encadena DM-COB-036. Aplicación: Condicional (VG: `globalConfig.get("userCanSelectIGTF") = true`)** | 1. Pulsar "IGTF" → seleccionar cliente → moneda dura ($). 2. Tab Documentos: seleccionar 1 documento; **descubrir** el default leyendo el selector de tasa IGTF y **no** modificarlo (sea cual sea su valor). 3. **Anotar** la tasa IGTF mostrada y la línea IGTF del Tab Total. 4. Completar pago y guardar (`Test-COB-044`). 5. Salir → BUSCAR → reabrir el cobro Guardado. 6. Releer el selector IGTF y la línea IGTF del Tab Total. | Comentario: `Test-COB-044`; tasa default = la que muestre el selector (observar, no asumir; registrar en `modules.cobros.igtf_tasa_default`) | Al reabrir, el selector IGTF muestra **la misma tasa por defecto que se guardó** (el valor que sea) y la línea IGTF del Tab Total es coherente con esa tasa. | FAIL: Al reabrir la tasa IGTF cambió sola (ej. 3%→0%); selector y línea IGTF del Total no coinciden; el monto IGTF se recalcula con una tasa distinta a la guardada. | S1 | `src/app/cobros/cobros-container/cobro-documents/cobro-documents.component` (selector IGTF, `igtfRate`); `collection-logic.service.ts` (reinicio estado IGTF al abrir cobro guardado) · oráculo RUNTIME §9 |
| DM-COB-045 | Persistencia IGTF — **cambio del usuario conservado al reabrir**: cobro $ con IGTF cambiado de default a alterna → guardar → reabrir conserva el valor elegido (bug activo) | Cobro tipo IGTF en moneda dura ($). VG `userCanSelectIGTF = true`. Al menos **2 tasas** IGTF disponibles (default + alterna). **Encadena DM-COB-036. Aplicación: Condicional (VG activa y ≥ 2 tasas; N/A si solo hay 1 tasa)** | 1. Pulsar "IGTF" → seleccionar cliente → moneda dura ($). 2. Tab Documentos: seleccionar 1 documento; leer el default y **cambiar** el selector de tasa IGTF a **cualquier otra opción** disponible (alterna). 3. **Anotar** la tasa elegida y la línea IGTF del Tab Total. 4. Completar pago y guardar (`Test-COB-045`). 5. Salir → BUSCAR → reabrir el cobro Guardado. 6. Releer el selector IGTF y la línea IGTF del Tab Total. | Comentario: `Test-COB-045`; cambiar el default por otra opción del selector (las tasas varían por cliente; registrar ambas en `modules.cobros.igtf_tasa_default/alterna`) | **Esperado PASS (con fix):** el selector IGTF al reabrir muestra **la tasa elegida por el usuario** (ej. 0%) y la línea IGTF del Total es coherente (IGTF 0). **FAIL conocido (sin fix a la fecha, `igtf_persistencia_bug2_fixed=false`):** al reabrir el selector revierte al **default** (ej. 3%) ignorando el cambio guardado. | FAIL (bug activo): al reabrir la tasa vuelve al default en vez de la elegida — documentar como FAIL hasta confirmar fix. PASS si el valor elegido persiste. | S1 | `src/app/cobros/cobros-container/cobro-documents/cobro-documents.component` (selector IGTF, `igtfRate`, `separateIgtf`); `collection-logic.service.ts` (persistencia/reinicio tasa IGTF al recargar cobro guardado) · oráculo RUNTIME §9 |
| DM-COB-046 | Persistencia pago parcial — **Monto total a pagar (Pagos) conservado al reabrir**: cobro normal, factura con pago parcial → guardar → reabrir mantiene el monto parcial | Cobro **normal** con un cliente que tenga **factura pendiente** (ver `modules.cobros.clientes_con_documentos`; si ninguno hoy, recorrer la lista del modal hasta hallar uno). **Aplicación: Siempre** (N/A solo si ningún cliente tiene documentos). | 1. Cobro nuevo → seleccionar un cliente con documentos. 2. Tab Documentos: seleccionar 1 factura. 3. Tab Pagos: **anotar** "Monto total a pagar" (= total de la factura). 4. Volver a Tab Documentos → abrir el **detalle** de esa factura. 5. Tildar **"pago parcial"** e ingresar un monto parcial (< total). Aceptar. 6. Tab Pagos: verificar que "Monto total a pagar" = el parcial. 7. Completar método de pago con ese monto y **Guardar** (`Test-COB-046`). 8. Salir → BUSCAR → reabrir el cobro Guardado. 9. Tab Pagos: releer "Monto total a pagar". | Comentario: `Test-COB-046`; monto parcial < saldo de la factura | Al reabrir, "Monto total a pagar" en Pagos = **el monto parcial guardado** (idéntico al paso 6), no el total completo de la factura. | FAIL: al reabrir el "Monto total a pagar" vuelve al **total completo** de la factura ignorando el pago parcial guardado; el detalle no conserva el flag/monto parcial. | S1 | `src/app/cobros/cobros-container/cobro-documents/cobro-documents.component` (detalle documento, pago parcial); `collection-logic.service.ts` (reinicio del monto a cobrar al recargar cobro guardado) · oráculo RUNTIME §9 |
| DM-COB-047 | Persistencia tasa por fecha — **recálculo del Monto total a pagar al cambiar Fecha tasa, conservado al reabrir** | Cobro **normal** con cliente con **factura pendiente**. VG `multiCurrency` activa y `canChangeRate`/`historicoTasa` (Fecha tasa editable, `modules.cobros.fecha_tasa_editable=true`). **Aplicación: Condicional** (N/A si la Fecha tasa no es editable o sin documentos). | 1. Cobro nuevo → seleccionar cliente con documentos → seleccionar 1 factura. 2. Tab Pagos: **anotar** "Monto total a pagar". 3. Tab General: cambiar **Fecha tasa** a una fecha **anterior** a la mostrada por defecto. 4. Confirmar el **aviso de recálculo** del monto. 5. Tab Pagos: verificar que el "Monto total a pagar" **cambió** (recalculado con la tasa vigente en esa fecha). 6. Completar pago y **Guardar** (`Test-COB-047`). 7. Salir → BUSCAR → reabrir el cobro Guardado. 8. Tab Pagos: releer "Monto total a pagar". | Comentario: `Test-COB-047`; Fecha tasa anterior a la default | Tras cambiar la Fecha tasa, "Monto total a pagar" se recalcula; al reabrir el cobro Guardado **mantiene el monto recalculado** (no vuelve al de la tasa por defecto). | FAIL: el monto no se recalcula al cambiar la Fecha tasa; o al reabrir vuelve al monto de la tasa por defecto ignorando la fecha guardada. | S1 | XML: `COB_FECHA_TASA`, `COB_COB_CHANGE_DATERATE` · `cobro-general.component.ts` (`onChangeDateRate`); `collection-logic.service.ts` (recálculo/persistencia por fecha tasa) · oráculo RUNTIME §9 |
| DM-COB-037 | Cobro tipo "COBRO 25% IVA" → formulario estándar con docs y pagos [VG userCanCollectIva] | VG `userCanCollectIva = true`. Cliente con documentos y pagos habilitados. **Aplicación: Condicional (VG: `globalConfig.get("userCanCollectIva") = true`)** | 1. Pulsar "COBRO 25% IVA". 2. Seleccionar cliente. 3. Confirmar tabs General, Documentos, Pagos, Total, Adjuntos visibles. 4. Seleccionar documento(s), agregar Efectivo con monto, guardar. | Comentario: `Test-COB-037` | Formulario con título Cobro 25% IVA. Misma estructura que cobro normal (`cobro25=true` en servicio). Guardar exitoso; en lista el tipo refleja cobro 25%. | FAIL: Botón ausente con VG; tabs incorrectas; no guarda; app colapsa. | S2 | `cobros-container.component.ts:180-191` (`coTypeModule = "4"`, `cobro25=true`) |
| DM-COB-038 | «Guardar y salir» desde modal de salida → cobro Guardado en lista | Continuación de **DM-COB-020** (modal visible). Cobro **nuevo** con datos mínimos (cliente + documentos + pago, o anticipo/retención según tipo); **no** guardado antes desde cabecera. **Aplicación: Siempre** | 1. Pulsar atrás (**DM-COB-020**). 2. Elegir **`DENARIO_BOTON_SALIR_GUARDAR`** (no «Salir sin guardar»). 3. Observar mensaje y navegación. 4. BUSCAR → localizar cobro. 5. Abrir y confirmar cliente, documentos/pagos y comentario. | Comentario: `Test-COB-038` | Mensaje de guardado; app en **home cobros**. Lista: **Guardado** con datos capturados. Distinto de **021** (descartar) y **018** (guardar sin salir). | FAIL: No en lista; datos incompletos; no guarda; app colapsa. | S1 | XML: `DENARIO_BOTON_SALIR_GUARDAR` · `cobros-header.component.ts:78-104` (`saveCollection`) |
| DM-COB-041 | Retención en detalle de documento de cobro normal → comprobante válido + fecha + IVA + ISLR → monto neto en Pagos [VG retencion] | Cobro normal. VG `retencion = true`. Cliente con factura en rojo (`modules.cobros.documento_retencion`) y saldo conocido (ej. 51 $). **Aplicación: Condicional (VG: `vgs.retencion = true`)** | 1. Cobro nuevo → seleccionar cliente. 2. Llenar Comentario (`Test-COB-041`) si `requiredComment=true`. 3. Tab Documentos → seleccionar **1 factura en rojo**. 4. Abrir detalle del documento (ícono o tap). 5. En el detalle, leer el mensaje «Debe tener N caracteres» (N = `vgs.sizeRetention`). 6. Ingresar número de comprobante con exactamente N caracteres. 7. Al aceptar comprobante válido, se habilita el selector de fecha de retención → seleccionar fecha. 8. Ingresar monto IVA retención (ej. `monto_retencion_iva`) + monto ISLR retención (ej. `monto_retencion_islr`). 9. Guardar detalle. 10. Ir al Tab Pagos y observar el «Monto total a pagar». | Comprobante: N caracteres según `vgs.sizeRetention`; IVA: `modules.cobros.monto_retencion_iva`; ISLR: `modules.cobros.monto_retencion_islr`; moneda: `modules.cobros.moneda_cobro` | Al guardar el detalle, Tab Pagos muestra monto **neto** = saldo del documento − (IVA retención + ISLR) (ej. 51 − 10 − 1 = 40 $). La diferencia refleja el neto. | FAIL: Tab Pagos muestra el monto bruto (51 $) sin descontar retenciones; el campo de comprobante no valida longitud; la fecha no se habilita al ingresar comprobante válido; app colapsa. | S1 | `src/app/cobros/cobros-container/cobro-documents/cobro-documents.component` (`detalle documento`, `retencion`); `collection-logic.service.ts` (`sizeRetention`, `formatRetention`, `retencion`) |
| DM-COB-042 | Persistencia de retención en cobro Guardado → al reabrir, monto neto y detalle se conservan (bug activo) | Continuación de **DM-COB-041** completado (monto neto visible en Tab Pagos). **Aplicación: Condicional (VG: `vgs.retencion = true`, encadena DM-COB-041)** | 1. En Tab Pagos, completar el método de pago con monto = monto neto (ej. 40 $). 2. Guardar cobro desde cabecera (**DM-COB-018**). 3. Salir del formulario. 4. En BUSCAR, localizar el cobro Guardado. 5. Reabrir el cobro Guardado. 6. Ir al Tab Pagos y observar «Monto total a pagar». 7. Ir al Tab Documentos → abrir detalle → observar IVA + ISLR. | — | **Esperado PASS:** Tab Pagos sigue mostrando el monto **neto** (ej. 40 $); detalle del documento muestra los montos de retención guardados (IVA = `monto_retencion_iva`, ISLR = `monto_retencion_islr`). **FAIL conocido:** el «Monto total a pagar» al reabrir vuelve al bruto (ej. 51 $) aunque el detalle tenga retenciones; esto indica que la lógica de reinicio no aplica las retenciones al recargar. Documentar resultado real y continuar corrida. | FAIL conocido (bug activo): monto en Pagos vuelve al bruto al reabrir (reportar como FAIL hasta fix confirmado). PASS si el neto persiste (indica fix aplicado). | S1 | `src/app/services/collection/collection-logic.service.ts` (reinicio estado retención al abrir cobro guardado) |
| DM-COB-043 | Pago parcial vs pago completo: indicador Diferencia cambia de rojo a azul en flujo real con documentos | Tab Pagos con documento(s) seleccionado(s) y método de pago activo. **Extiende DM-COB-012.** **Aplicación: Siempre** | 1. En Tab Pagos (con documentos cargados), ingresar un **monto menor** al total a pagar. 2. Observar el indicador «Diferencia» y su color. 3. Ingresar el **monto exacto** igual al total a pagar. 4. Observar el cambio de color. | Monto menor al total; monto igual al total | Paso 2: «Diferencia» en **rojo** (pago parcial). Paso 4: «Diferencia» en **azul** (pago completo). El comportamiento aplica con documentos reales en el flujo completo del cobro. | FAIL: El color no cambia; la diferencia no se recalcula al escribir el monto; rojo/azul invertido. | S2 | `src/app/cobros/cobros-container/cobro-pagos/cobro-pagos.component.html:12-16` (ngStyle color diferencia) |
| DM-COB-039 | Abrir cobro **Guardado** y cambiar tasa → recálculo visible; guardar y persistir nueva tasa | Cobro **Guardado** (`stDelivery=3`) con `multiCurrency` + `showConversion`, documentos y pago registrados. **Aplicación: Condicional** — **(A)** VG `enabledManualRate = true`: input `COB_TASA` editable; **(B)** `historicoTasa = true`, `enabledManualRate = false` y `canChangeRate = true`: `COB_FECHA_TASA` / selector `COB_TASA`. Si ninguna rama aplica → **N/A**. | 1. BUSCAR → abrir Guardado (**DM-COB-024**). 2. Tab General: anotar tasa y monto en Pagos (sticky) o Total. 3. **(A)** Cambiar valor en `COB_TASA` y salir del campo (blur). **(B)** Cambiar fecha de tasa o opción del selector; si alerta `COB_COB_CHANGE_DATERATE` → confirmar. 4. Pagos/Total: verificar montos distintos al paso 2. 5. Guardar (**DM-COB-018**) con `Test-COB-039`. 6. Reabrir y confirmar tasa guardada. | Comentario: `Test-COB-039`; tasa distinta a la original (respetar mínimo en tasa manual) | Montos se actualizan tras cambiar tasa. Guardado OK. Reapertura muestra la nueva tasa. *`COB_RAZON_CAMBIO_TASA` solo si el build expone `changeRate` — observación opcional.* | FAIL: Con VG de la rama la tasa no cambia o no recalcula; guardar no persiste tasa; app colapsa. | S1 | XML: `COB_TASA`, `COB_FECHA_TASA`, `COB_COB_CHANGE_DATERATE` · `cobro-general.component.html` (63–141), `.ts` (`onManualRateBlur`, `onChangeDateRate`) · VG `enabledManualRate`, `historicoTasa`, `canChangeRate` |
| DM-COB-070 | 🔑 **El aviso de saldo a favor depende del ORDEN de las acciones** — nota de crédito marcada al final | Cliente con **factura y nota de crédito** vivas donde el monto quede a favor del cliente. `automatedPrepaid = true`. **Aplicación: Condicional** — si no hay cliente con las dos, **N/A razonada**. | 1. Marcar **primero la FACTURA sola** (la app corta si el primer documento es negativo). 2. Si hace falta, aplicar **pago parcial** en el detalle. 3. **Marcar la nota de crédito.** | Comentario: `Test-COB-070` | Al marcar la nota aparece el aviso **«Se creará un anticipo automático por el saldo a favor de {currency} {amount}»**, con **un solo botón (ACEPTAR)** y el monto sustituido. Vuelve a salir si se desmarca y se remarca. | FAIL: no aparece; sale con Cancelar; muestra `{amount}` o `{currency}` sin sustituir; el monto no corresponde. | S3 | `maybeShowCreditBalancePrepaidInform()` · tag `COB_MSG_NCR_CREDIT_PREPAID` (si falta en el tenant se usa el texto de fábrica) |
| DM-COB-071 | 🔴 **El mismo caso con el orden invertido** — los dos documentos marcados y el pago parcial DESPUÉS | Igual que **DM-COB-070**. **Aplicación: Condicional** (misma precondición) | 1. Marcar **la factura y la nota de crédito** primero. 2. **Después** abrir el detalle de la factura y aplicar el **pago parcial** que deja el monto a favor del cliente. | Comentario: `Test-COB-071` | El aviso **debe aparecer igual que en DM-COB-070**: el excedente existe, lo produzca la acción que lo produzca. | 🔴 **FAIL CONOCIDO (15/09, verificado a mano por QA):** no aparece ningún aviso. `maybeShowCreditBalancePrepaidInform()` solo se invoca al **marcar/desmarcar** un documento, no cuando cambia el saldo a favor. **El anticipo sí se genera** ⇒ falta solo el aviso. | S3 | mismo invocador que 070 |
| DM-COB-072 | 🔴 **Cobro reabierto desde Guardado con saldo a favor o excedente** | Cobro **Guardado** con excedente por tolerancia **o** con saldo a favor por nota de crédito. **Aplicación: Siempre** | 1. Crear el cobro con excedente. 2. **Guardar y salir.** 3. **Reabrir.** 4. Observar si aparece el aviso. 5. **Enviar** y comprobar en la nube. | Comentario: `Test-COB-072` | Debe avisar del excedente al reabrir **y** generar el anticipo al enviar. | 🔴 **FAIL CONOCIDO:** ni avisa ni genera. **Dos causas independientes:** el aviso no se invoca al cargar, y `handleOpenCollect()` hace `createAutomatedPrepaid = false` + vacía `anticipoAutomatico`. Control obligatorio al lado: el mismo cobro **enviado directo** sí genera su anticipo. | **S2** — el excedente pagado se pierde sin aviso | `handleOpenCollect()` · comprobado que **NO** es la guarda `recentOpenCollect` (vale `false` y `shouldShow…()` devuelve `true`) |

---

```gherkin
# DM-COB-004 / DM-COB-008 / DM-COB-040 — Happy path cobro normal (Depósito)
Dado que estoy en el formulario de un nuevo cobro
Cuando selecciono un cliente en el modal selector
Entonces el campo cliente se rellena y las pestañas Documentos, Pagos, Total y Adjuntos se habilitan
Cuando voy al Tab Documentos y selecciono uno o más documentos
  Y voy al Tab Pagos y agrego Depósito con banco, número de depósito y monto igual al total a pagar
Entonces el indicador "Diferencia" cambia a color azul
```

```gherkin
# DM-COB-004 / DM-COB-008 / DM-COB-010 — Happy path cobro normal (Efectivo)
Dado que el cliente tiene Efectivo habilitado en el modal de métodos
Cuando agrego Efectivo con monto igual al total a pagar
Entonces el indicador "Diferencia" cambia a color azul
```

```gherkin
# DM-COB-018 / DM-COB-019 — Guardar y enviar cobro
Dado que el formulario tiene los datos mínimos del tipo de cobro (documentos+pago o solo pago en Anticipo)
  Y el botón guardar está habilitado
Cuando pulso guardar
Entonces aparece mensaje de confirmación
  Y el formulario permanece abierto hasta que navego a BUSCAR o atrás
Cuando verifico en la lista
Entonces el cobro aparece como "Guardado"
Cuando pulso enviar y acepto la confirmación
Entonces aparece aviso de envío y la app regresa al home del módulo cobros
  Y en la lista el cobro aparece como "Por Enviar" o "Enviado"
```

```gherkin
# DM-COB-028 — Anticipo sin tab Documentos
Dado que la VG cobroPrepago está activa y estoy en el home de cobros
Cuando pulso "ANTICIPO/PREPAGO" y selecciono un cliente
Entonces el formulario no muestra la pestaña "Documentos"
  Y puedo registrar un pago en Tab Pagos y guardar el cobro
```

```gherkin
# DM-COB-020 / DM-COB-021 / DM-COB-038 — Salir del cobro nuevo
Dado que tengo un cobro nuevo con cliente y cambios sin guardar desde cabecera
Cuando pulso atrás en la cabecera
Entonces aparece un modal con "Guardar y salir", "Salir sin guardar" y "Cancelar"
Cuando elijo "Salir sin guardar"
Entonces vuelvo al home de cobros y el cobro no está en la lista
# Caso aparte DM-COB-038:
Cuando en otro cobro nuevo completo elijo "Guardar y salir"
Entonces vuelvo al home de cobros
  Y en BUSCAR el cobro aparece como "Guardado" con los datos ingresados
```

```gherkin
# DM-COB-039 — Cambiar tasa en cobro Guardado
Dado que tengo un cobro Guardado multimoneda con documentos y pagos
  Y la VG permite editar tasa (manual o histórica según cuenta)
Cuando abro el cobro desde BUSCAR y cambio la tasa en Tab General
Entonces los montos en Pagos o Total se actualizan
Cuando guardo y reabro el cobro
Entonces la tasa mostrada coincide con la editada
```

```gherkin
# DM-COB-041 / DM-COB-042 — Retención en detalle de documento (VG retencion=true)
Dado que tengo un cobro normal con cliente seleccionado
  Y en Tab Documentos hay una factura en rojo con saldo conocido (ej. 51 $)
  Y la VG retencion está activa para este cliente
Cuando abro el detalle de esa factura
  Y ingreso el número de comprobante con la longitud indicada por UI (N caracteres según vgs.sizeRetention)
Entonces la fecha de retención se habilita
Cuando selecciono fecha y completo montos IVA + ISLR (ej. 10 + 1)
  Y guardo el detalle
Entonces Tab Pagos muestra el monto neto = saldo − (IVA + ISLR) (ej. 40 $)
# DM-COB-042 — Persistencia al reabrir
Cuando completo el pago con el monto neto y guardo el cobro
  Y salgo y busco el cobro Guardado en BUSCAR
  Y lo reabro
Entonces Tab Pagos sigue mostrando el monto neto (PASS si fix aplicado)
  Y el detalle del documento conserva los montos de retención
# FAIL conocido: al reabrir el total puede volver al bruto — documentar y continuar corrida
```

```gherkin
# DM-COB-016 — Adjuntos en cobro (inyección CDP)
Dado que tengo un cobro editable con cliente, documentos y pago configurados
  Y la VG requiredCollectionAttachments está activa (default true)
  Y los botones de cámara/galería/archivo requieren API nativa Android (no accesible vía CDP)
  Y la firma no cuenta para hasItems() en la validación de envío
Cuando inyecto un objeto Foto válido directamente en adjuntoService.fotos vía ng.getComponent
Entonces adjuntoService.hasItems() retorna true
  Y el cobro puede ser guardado (DM-COB-018) y enviado (DM-COB-019) sin alerta de adjunto faltante
Cuando guardo el cobro y lo reabro desde la lista
Entonces fotos.length > 0 en el servicio al reabrir
```

```gherkin
# DM-COB-044 / DM-COB-045 — Persistencia de la tasa IGTF al reabrir (round-trip, RUNTIME §9)
# Las tasas IGTF y el default los configura cada cliente en web → descubrir en UI, no asumir %
Dado que creo un cobro en moneda dura ($) de tipo IGTF con un documento
# DM-COB-044 — el default debe sobrevivir
Cuando leo y dejo la tasa IGTF por defecto (la que sea), guardo el cobro y lo reabro desde BUSCAR
Entonces el selector IGTF y la línea IGTF del Tab Total siguen mostrando esa misma tasa por defecto
# FAIL si al reabrir la tasa cambió sola (regresión de persistencia)
# DM-COB-045 — el cambio del usuario debe sobrevivir
Cuando cambio la tasa por defecto a otra opción del selector, guardo el cobro y lo reabro desde BUSCAR
Entonces el selector IGTF y la línea IGTF del Tab Total muestran la tasa elegida (no el default)
# FAIL conocido: al reabrir revierte al default ignorando el cambio — bug sin fix a la fecha
```

```gherkin
# DM-COB-046 — Persistencia del pago parcial (Monto total a pagar) al reabrir (round-trip, RUNTIME §9)
Dado que creo un cobro normal con un cliente que tiene una factura pendiente
  Y selecciono la factura (Tab Pagos muestra el total completo como "Monto total a pagar")
Cuando abro el detalle de la factura, tildo "pago parcial" e ingreso un monto parcial menor al total
Entonces Tab Pagos muestra el monto parcial como "Monto total a pagar"
Cuando guardo el cobro y lo reabro desde BUSCAR
Entonces "Monto total a pagar" sigue siendo el monto parcial (no vuelve al total completo)
```

```gherkin
# DM-COB-047 — Recálculo y persistencia del Monto total a pagar por Fecha tasa (round-trip, RUNTIME §9)
Dado que creo un cobro normal con un cliente que tiene una factura pendiente
  Y selecciono la factura (Tab Pagos muestra el "Monto total a pagar")
Cuando en Tab General cambio la Fecha tasa a una fecha anterior y confirmo el aviso de recálculo
Entonces el "Monto total a pagar" en Pagos cambia (recalculado con la tasa de esa fecha)
Cuando guardo el cobro y lo reabro desde BUSCAR
Entonces "Monto total a pagar" mantiene el monto recalculado (no vuelve al de la tasa por defecto)
```

---

### Regresión mínima (smoke rápido — ~34 casos)

Lista de IDs imprescindibles para validar el módulo cobros antes de cerrar un release (**no sustituye la ejecución de la tabla completa**; para una corrida general se recomienda ejecutar todos los casos que no sean N/A por VG):

**Bloque base (happy path + validaciones):**
1. **DM-COB-001** — Home cobros, botones visibles
2. **DM-COB-002** — Nuevo cobro, formulario con tabs bloqueadas
3. **DM-COB-004** — Seleccionar cliente, tabs habilitadas
4. **DM-COB-006** — Comentario obligatorio (si `requiredComment=true`)
5. **DM-COB-007** — Tab Documentos cargada con lista e indicadores
6. **DM-COB-008** — Seleccionar documentos, monto actualizado en Pagos
7. **DM-COB-015** — Total General visible al final del Tab Total
8. **DM-COB-033** — Selector moneda cobro (si `multiCurrency=true`)
9. **DM-COB-034** — Selector moneda documentos (si `multiCurrency=true`)

**Bloque profundo (retenciones en documento):**
10. **DM-COB-041** — Retención en detalle de documento: comprobante + fecha + IVA/ISLR → monto neto en Pagos (si `vgs.retencion=true`)
11. **DM-COB-042** — Persistencia retención al reabrir cobro Guardado (encadena 041)

**Bloque pago:**
12. **DM-COB-009** — Modal de métodos de pago (solo los habilitados por cliente)
13. **DM-COB-040** — Método **Depósito**: seleccionar banco, nº depósito, monto = total a pagar (**obligatorio en smoke** si el cliente QA solo tiene Depósito; sustituye **010** en esa corrida)
14. **DM-COB-012** — Indicador diferencia (azul/rojo)
15. **DM-COB-043** — Pago parcial vs completo: diferencia roja → azul en flujo real con documentos
16. **DM-COB-014** — Tab Total con tabla y acordeones
17. **DM-COB-016** — **Adjuntos: inyección CDP** (`adjuntoService.fotos.length > 0`) — **OBLIGATORIO antes de DM-COB-018/019** cuando VG `requiredCollectionAttachments=true` (default activo).
18. **DM-COB-018** — Guardar cobro
19. **DM-COB-019** — Enviar cobro (⏭ SKIP si `requiredCollectionAttachments=true` sin adjunto CDP)

**Bloque lista y navegación:**
20. **DM-COB-022** — Buscar cobro → lista visible
21. **DM-COB-024** — Abrir cobro Guardado → editable; verificar montos y retenciones
22. **DM-COB-026** — Eliminar cobro Guardado
23. **DM-COB-020** — Salir con cambios → modal 3 opciones
24. **DM-COB-021** — Salir sin guardar (cobro nuevo)
25. **DM-COB-038** — Guardar y salir → Guardado en lista

**Bloque tipos VG:**
26. **DM-COB-029** — Cobro tipo **Retención** (VG `cobroRetencion`) — sin Tab Pagos; documentos + Total + guardar. SKIP envío si `requiredCollectionAttachments=true`.
27. **DM-COB-028** — Anticipo/Prepago (N/A si `cobroPrepago=false`)
28. **DM-COB-036** — IGTF (N/A si `userCanSelectIGTF=false`)
29. **DM-COB-044** — Persistencia IGTF **default** al reabrir (encadena 036; N/A si `userCanSelectIGTF=false`)
30. **DM-COB-045** — Persistencia IGTF **modificado** al reabrir (encadena 036; N/A si 1 sola tasa; FAIL conocido sin fix)
31. **DM-COB-046** — Persistencia **pago parcial**: Monto total a pagar conservado al reabrir (req. cliente con documentos)
32. **DM-COB-047** — Recálculo + persistencia por **Fecha tasa** (req. cliente con documentos; `fecha_tasa_editable`)
33. **DM-COB-037** — Cobro 25% IVA (N/A si `userCanCollectIva=false`)
34. **DM-COB-039** — Cambiar tasa en cobro Guardado (rama A manual o B Fecha tasa; N/A solo si ninguna aplica)

**Nota smoke — método de pago:** en cuentas QA donde el cliente solo admite **Depósito** (ej. Yaque), ejecutar **040** y **no** marcar FAIL por ausencia de Efectivo. **DM-COB-010** (Efectivo) permanece en el catálogo completo para clientes con ese método habilitado.

**Orden mínimo happy path cobro normal (smoke):** `004` → `007` → `008` → `040` → `012` → `016` (**obligatorio** — inyectar adjunto CDP antes de guardar/enviar) → `018` → `019`.

**Tipos condicionales incluidos en este smoke** (VGs confirmadas activas en cuenta Yaque — primera corrida DM-COB-001): `029` (Retención), `036` (IGTF), `037` (Cobro 25% IVA). `028` (Anticipo/Prepago) → **N/A**, botón ausente en Yaque (`cobroPrepago` inactiva).

Si la corrida incluye otros tipos condicionales no activos en Yaque, agregar al smoke:
- **DM-COB-028** (Anticipo) si VG `cobroPrepago` activa
- **DM-COB-033** / **DM-COB-034** si VG `multiCurrency` adicional (tasa histórica)

### Corrida general recomendada

Además del smoke, ejecutar en la misma sesión (marcando N/A donde no aplique VG o datos):

1. Núcleo cobro normal: **001 → 004 → 007–008 → 040 → 012 → 014–016 → 018 → 019 → 022 → 024 → 039 → 026** (usar **010** en lugar de **040** solo si el cliente tiene Efectivo)
2. Salida con cambios: **020 → 021** (salir sin guardar) y **020 → 038** («Guardar y salir»; cobro nuevo distinto al de 021, antes de guardar desde cabecera)
3. Tipos VG: **028**, **029**, **036**, **037** según botones visibles en home
4. Multimoneda y tasa: **033 → 034 → 035 → 039** si `multiCurrency` (039 según rama A/B de VG tasa)
5. Cierre integral: cobro enviado (**019**) y luego módulo Depósitos (`guion-depositos`)

---

### Supuestos y lagunas — Cobertura fuera de este guion

1. **GPS requerido (`userMustActivateGPS`)**: cuando esta VG está activa, al pulsar "COBRO" u otros botones de tipo, la app verifica coordenadas GPS antes de navegar al formulario. Sin GPS disponible, el botón no navega. Por depender de permiso del SO, se excluye del guion. En corridas normales el GPS está disponible y el flujo es transparente.

2. **Pago Móvil — campos adicionales**: el acordeón de Pago Móvil requiere: selector de código de teléfono, número de 7 dígitos, banco emisor, banco receptor, nro. de referencia, tipo y número de documento del titular, monto y fecha. Esta complejidad no tiene un caso de tabla dedicado; cubierto genéricamente en DM-COB-011 (Transferencia). Verificar campos de Pago Móvil en corridas con este método habilitado.

3. **Cheque — campos adicionales**: el acordeón de Cheque requiere banco emisor, Nro. de cheque, fecha, fecha valor y monto. Cubierto genéricamente; sin caso de tabla propio para no duplicar estructura de DM-COB-011.

4. **Otros — campo "Especifique"**: el método "Otros" incluye un campo de texto libre "Especifique" y monto. Sin caso propio; seguir la misma verificación que Efectivo/Transferencia.

4b. **Depósito (método de pago)**: cubierto por **DM-COB-040** en smoke y catálogo. Campos: selector de banco (`COB_BANCO_RECEPTOR`), número de depósito (`COB_NRO_DEPOSITO`), monto (`COB_MONTO`), fecha. No confundir con el módulo **Depósitos** bancarios del vendedor (supuesto 11).

5. **Tasa de cambio en cobro Guardado**: cubierto por **DM-COB-039**. Rama **(A)** `enabledManualRate`: input `COB_TASA` y recálculo en blur. Rama **(B)** `historicoTasa` + `canChangeRate`: fecha/selector; alerta `COB_COB_CHANGE_DATERATE` si hay documentos. El selector histórico se deshabilita si `canChangeRate=false`. Cobros Por Enviar/Enviados muestran tasa en solo lectura (`nuValueLocal`). Campo `COB_RAZON_CAMBIO_TASA` depende de flag `changeRate` en componente (puede no mostrarse en todas las builds).

6. **"Copiar cobro"**: no se encontró botón de "copiar cobro" en la UI del home cobros ni en el código de cobros-container.component.html analizado. Si existe en una versión posterior o en alguna pantalla no analizada, agregar como caso en revisión futura.

7. **Cobro tipo IGTF — toggle "pago separado"**: en Tab Documentos del cobro IGTF, el toggle `separateIgtf` controla si el IGTF aparece como pago adicional separado o incluido en el total. Este comportamiento afecta la presentación en Tab Total (columna IGTF). Verificar en corridas cuando VG `userCanSelectIGTF` esté activa; no incluido como caso de tabla propio.

8. **`validateCollectionDate = true`**: cuando activa, los selectores de fecha en los métodos de pago están deshabilitados. No incluido en tabla; observar en corridas si las fechas son editables o fijas.

9. **Infinite scroll en lista de cobros**: la lista usa paginación client-side (PAGE_SIZE=20). Para empresas con muchos cobros, el scroll carga más registros. Verificar manualmente en corridas con volumen alto de cobros.

10. **Cobro "Guardado" editable vs no editable**: según el código, los cobros con `st_delivery=3` (SAVED) abren en modo editable y los con `st_delivery=1` (SENT) o `st_delivery=2` (TO_SEND) en modo solo lectura. El cobro `st_delivery=0` (NEW) es un estado intermedio no guardado; no aparece en la lista habitualmente. Confirmar con el equipo si un cobro NEW puede quedar persistido.

11. **Método de pago «Depósito» vs módulo Depósitos**: en Tab Pagos, «Depósito» (`co_payment_method = de`) registra que el **cliente** pagó vía depósito bancario. El **módulo Depósitos** agrupa cobros **ya enviados** que el vendedor depositó en el banco. El SQL de cobros elegibles excluye ciertos pagos (`de`, `tr`, `ot` parciales) — si no hay cobros en Depósitos tras **DM-COB-019**, revisar método de pago usado en el cobro de prueba.

12. **Adjuntos y validación en web**: **DM-COB-016** valida captura y persistencia en móvil. Tras **DM-COB-019** (envío), en corrida integral verificar en la web que el mismo cobro (referencia/comentario `Test-COB-016`) muestra imagen, archivo y firma correctamente. Fallo solo en web se reporta aparte del guion móvil.

13. **Modal al salir en cobro nuevo (`DM-COB-020` / `021` / `038`)**: en cobro **nuevo** con cliente y cambios, cuando `stDelivery` no es Guardado/Enviado/Por Enviar (`cobros-header.component.ts:216-217`). Textos XML: `DENARIO_BOTON_SALIR_GUARDAR` / `DENARIO_BOTON_SALIR`. Probar **020 → 021** y **020 → 038** en cobros **distintos**, **antes** de guardar desde cabecera. Cobro **Guardado** reabierto: atrás suele salir **sin** modal (no confundir con **039**, que edita tasa y guarda desde cabecera).

14. **`requiredCollectionAttachments` y automatización CDP (`DM-COB-016` / `DM-COB-019`)**: esta VG tiene **default implícito `true`** cuando no está configurada (`collection-logic.service.ts:391`). Bloquea el envío si `adjuntoService.hasItems()` retorna `false`. `hasItems()` evalúa solo `fotos.length > 0 || files.length > 0` — la firma es independiente y **no desbloquea el envío**. La técnica correcta para corridas CDP es **mockear `window.Capacitor.Plugins.Camera.getPhoto`** antes de clickear `ADJ_TOMAR_FOTO` (botón de cámara). `tomarImg()` solicita `resultType: Base64`, por lo que el mock retorna el base64 directamente sin necesidad de leer el filesystem del dispositivo. Esto funciona en **builds de producción y desarrollo** porque `window.Capacitor` siempre está disponible. Si `ADJ_TOMAR_FOTO` no está visible, usar el mock doble de galería (`Camera.pickImages` + `Filesystem.readFile`). Técnica completa en el helper `mockCameraAdjunto` (`automation/cdp/denario-cdp-helpers.js`). **Si DM-COB-019 reporta alerta `COB_RET_MSJ_COLLECTION_NO_ATTACHMENTS` tras ACEPTAR → FAIL, no "VG esperada" ni PASS parcial.** Significa que DM-COB-016 no completó el mock correctamente.
