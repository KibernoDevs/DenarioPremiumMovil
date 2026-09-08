# Guión de pruebas · Pedido Sugerido — HIDROPONIAS

**Creado:** 2026-09-08
**Rama a probar:** `SaveSuggestedOrder` (ignorar `SaveSuggestedOrderEXPRESS`)
**Cliente:** hidroponias — Isla Coche, BD nueva con data actualizada
**Alcance:** el cálculo especial que ya existía **+** el REQ nuevo de guardar la sugerencia

> **Fuera de alcance esta vuelta:** módulo **Visitas** — la rama tiene un bug conocido y
> desarrollo está en el fix. Se valida **Devoluciones, Inventarios y Pedidos**.

> Corridas previas de las que sale este guión:
> `automation/reports/hidroponias/hidroponias_sugerido_20260811/` — primera medición del cálculo
> `automation/reports/hidroponias/fix_despacho_consolidado_20260901/` — 28 casos `SUG-F-001..028`, todos PASS

---

## Por qué este guión existe

Hidroponias es **el único cliente con el sugerido por despacho y devolución**
(`suggestedOrderByDispatchAndReturn = true`). Nadie más ejercita ese cálculo, así que
cualquier regresión ahí pasa invisible por los scripts normales.

Hasta ahora el sugerido **se calculaba y se perdía**: se veía en pantalla, se convertía en
pedido, y no quedaba rastro. La rama `SaveSuggestedOrder` lo persiste — y no solo el
resultado, sino **cada término del cálculo**. Eso cambia lo que se puede probar: ahora se
puede cotejar lo guardado contra lo que mostró la pantalla, término por término, y en las
tres capas.

---

## Antes de empezar

### 1 · Datos que debe traer la BD nueva

Sin esto hay casos que **no se pueden ejercitar** — le pasó a `SUG-F-005` el 01/09, que
quedó sin probar por falta de dato. Para un mismo **cliente + sucursal**:

| Necesitamos | Para qué caso |
|---|---|
| Última fecha facturada con **≥ 2 facturas** | DM-SUG-010 (consolidación) |
| **Un mismo producto repetido en dos facturas de ese día** | DM-SUG-011 — *el que faltó la vez pasada* |
| Un producto **solo en la factura perdedora** (la que no gana el desempate) | DM-SUG-010 |
| Un producto de **control** en la factura ganadora | DM-SUG-012 |
| Un producto **sin factura ese día** | DM-SUG-013 |
| Devolución de **Calidad** y devolución de **Distribución** | DM-SUG-016 / 017 |
| **Un mismo producto con las dos devoluciones** | DM-SUG-018 |
| Un **cambio x cambio** dentro de la ventana | DM-SUG-015 |
| Un producto con **stock 0 de almacén** | DM-SUG-020 |

⚠ La consolidación filtra por **`id_client` Y `id_address_client`**: es por cliente **y
sucursal**, no por cliente solo. Un producto de otra sucursal del mismo cliente no aporta.

### 2 · Prerequisitos del equipo

- APK compilada de `SaveSuggestedOrder`. La rama sube la base local a **versión 22** y crea
  `client_stock_suggested_orders` y `client_stock_suggested_order_details`.
- **Probar la migración, no solo la instalación limpia:** conviene una instalación que venga
  de v21 con datos, porque la migración corre sola al abrir (DM-SUG-001).
- Confirmar en el equipo `suggestedOrderByDispatchAndReturn = true` antes de nada. Si está en
  false, todo el guión es N/A y no es un hallazgo.
- Login y credenciales de BD de hidroponias (corregidas el 08/09).

### 3 · Trampas conocidas — leer antes de tocar la app

Levantadas en la corrida del 01/09. Ignorarlas hace perder horas leyendo síntomas falsos:

| Trampa | Qué pasa si no se sabe |
|---|---|
| **El botón «Pedido Sugerido» vive en la pestaña RESUMEN**, no en INVENTARIO | Buscarlo en la pestaña de carga devuelve `[]` y se lee como «la VG no rinde» |
| **El árbol de inventario tiene DOS niveles y el buscador solo filtra DENTRO de una categoría** | En el nivel de las 13 categorías escribir no filtra. Y si te quedas dentro de una, todas las búsquedas siguientes devuelven 0 ⇒ «el producto no existe». **Subir con `ion-icon[name=arrow-back-outline]` antes de cada búsqueda** |
| **El modal de cantidad se acepta con el ✓ del encabezado** (`checkmark-outline`), no con un botón «Aceptar» | El modal queda abierto y su backdrop **se come todos los clics siguientes**: el módulo pasa a «no tiene botones» |
| **El código del producto va al FINAL del texto** — `"ESPINACA BOLSA 300GRS. (E)Código: 046013ESP001BOL"` | Un patrón que espere «Precio» detrás nunca coincide |
| **El input de factura en devoluciones es `#invoiceSelect`** (en inglés) | Buscarlo por «factura» devuelve null |
| **Los términos del cálculo NO están en el DOM** | Viven en `ng.getComponent(document.querySelector('app-inventario-sugerido-preview')).productsSuggested[].unitsSuggested[]`. La pantalla solo muestra el resultado |
| **`sugerido = 0` con `daysUntilNext = 1` no es un defecto** | Es la guarda `currentStock >= sugerido ⇒ 0`. Para ver sugeridos > 0 hay que **teclear un `daysUntilNext` mayor** |

### 4 · El modelo del cálculo (oráculo)

Todo caso de aritmética se coteja contra esto:

```
inicial  = previous_stock + dispatched_stock + straight_swap_stock
vendido  = inicial − current_stock − returned_stock
diaria   = vendido / days_since_last
sugerido = diaria × days_until_next        … con dos guardas:
             · si current_stock >= sugerido  ⇒  sugerido = 0   (incluida la igualdad)
             · si vendido < 0                ⇒  diaria = 0
```

Solo restan las devoluciones de **Distribución**; las de **Calidad** no.

---

## Bloque A · El cálculo especial (no-regresión)

Ya certificado el 01/09. Se repite entero contra la BD nueva: **el dato cambió, así que el
resultado hay que volver a medirlo.**

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-SUG-001 | Instalación que venía de v21: abrir la app | La base migra a v22 y quedan creadas las dos tablas nuevas, **sin perder** inventarios ni pedidos previos |
| DM-SUG-002 | Guarda de tenant: confirmar `suggestedOrderByDispatchAndReturn` en el equipo | `true`. Si no, todo el guión es **N/A**, no FAIL |
| DM-SUG-003 | Entrar a Inventario → pestaña **Resumen** | Aparece el botón «Pedido Sugerido» |
| DM-SUG-010 | **Consolidación:** producto que está solo en la factura *perdedora* del último día | Trae su cantidad real en `dispatched_stock`, **no 0**. Antes del fix daba 0 |
| DM-SUG-011 | **Suma:** mismo producto repetido en dos facturas del mismo día | `dispatched_stock` = **la suma** de las dos, no una sola. *(Sin ejercitar el 01/09 por falta de dato)* |
| DM-SUG-012 | **Control:** producto de la factura ganadora | Idéntico a antes del fix — no se movió |
| DM-SUG-013 | Producto **sin factura ese día** | Aparece en la lista con `dispatched_stock = 0`. Ni ausente ni en blanco |
| DM-SUG-014 | Aislamiento: producto facturado a **otro cliente o sucursal** | No aporta nada al término de despacho |
| DM-SUG-015 | **Cambio x cambio** en la ventana | Suma en `straight_swap_stock`; el caso fuerte es cuando es el **único** aporte |
| DM-SUG-016 | Devolución de **Distribución** | **Resta** (`returned_stock` > 0) |
| DM-SUG-017 | Devolución de **Calidad** | **No resta** (`returned_stock` = 0) |
| DM-SUG-018 | Mismo producto con **las dos** devoluciones | Resta **solo** la de Distribución |
| DM-SUG-019 | `days_since_last` | Se **calcula**, no se teclea, y persiste |
| DM-SUG-020 | Producto con **stock 0** y rotación previa | Genera reposición: sugerido > 0 pese a tener 0 |
| DM-SUG-021 | `days_until_next` tecleado | Se respeta y el sugerido se recalcula |
| DM-SUG-022 | Guarda `current_stock >= sugerido` | Sugerido **0**, incluido el caso de igualdad exacta |
| DM-SUG-023 | Guarda de venta negativa | `vendido < 0` ⇒ `diaria = 0`, sin excepción |
| DM-SUG-024 | Cantidad **negativa** al inventariar | Rechazada (`min=0` + alerta) |
| DM-SUG-025 | Cantidad **0** al inventariar | Aceptada, persiste al guardar y reabrir, y llega a la nube |
| DM-SUG-026 | Aritmética completa, ≥ 3 productos | Cada término y el sugerido cuadran con el modelo, **tolerancia 0** |

---

## Bloque B · El sugerido se GUARDA — lo nuevo

El corazón del REQ. La cabecera guarda `days_since_last`, `days_until_next`,
`by_dispatch_and_return`, `da_suggested`, `nu_details`; el detalle guarda **cada término**.

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-SUG-030 | Generar un sugerido y guardarlo | Se crea la cabecera en `client_stock_suggested_orders` con su `co_client_stock` ligado al inventario |
| DM-SUG-031 | **Cotejo término por término** de lo guardado contra lo que mostró la vista previa | `previous_stock`, `dispatched_stock`, `straight_swap_stock`, `returned_stock`, `initial_stock`, `sold_units`, `estimated_daily_units` y `qu_unit_suggested` **idénticos**, producto por producto |
| DM-SUG-032 | `nu_details` de la cabecera | Coincide con la cantidad de líneas guardadas |
| DM-SUG-033 | Los productos con sugerido **0** | Definir con el REQ si se guardan o se excluyen. **Lo importante es que sea consistente** con lo que se muestra al reabrir |
| DM-SUG-034 | `days_until_next` tecleado antes de guardar | Se guarda **el tecleado**, no el 1 por defecto |
| DM-SUG-035 | `by_dispatch_and_return` en la cabecera | Refleja la VG con la que se calculó — es la trazabilidad de **con qué regla** se generó |
| DM-SUG-036 | Cerrar la app y volver a abrir | El sugerido guardado sigue ahí, íntegro |
| DM-SUG-037 | Generar **dos** sugeridos para clientes distintos | Se guardan por separado, sin mezclarse ni pisarse |
| DM-SUG-038 | Generar un sugerido **nuevo sobre el mismo inventario** | Definir: ¿reemplaza el anterior o crea otro? Verificar que **no queden dos cabeceras** para el mismo `co_client_stock` si la regla es reemplazar |

---

## Bloque C · El submódulo «Pedido Sugerido» en la móvil

Ruta: **Inventario → Pedido Sugerido**.

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-SUG-040 | Entrar al submódulo sin sugeridos guardados | Mensaje de lista vacía («No hay pedidos sugeridos guardados»), no una pantalla en blanco |
| DM-SUG-041 | Entrar con sugeridos guardados | Se listan, con cliente, fecha y cantidad de líneas |
| DM-SUG-042 | **Estado en la lista** | «**Pendiente**» si no se convirtió en pedido · «**Enviado**» si ya se convirtió |
| DM-SUG-043 | Abrir uno guardado | La vista previa muestra **los mismos números** con los que se guardó, no un recálculo con datos de hoy |
| DM-SUG-044 | Abrir uno guardado **días después**, con facturas nuevas de por medio | Sigue mostrando lo guardado. Es un **snapshot**, no una consulta en vivo |
| DM-SUG-045 | Confirmar la vista previa de uno **Pendiente** | Se lanza el pedido con esas líneas |
| DM-SUG-046 | Salir sin confirmar | El sugerido sigue Pendiente, sin cambios |

---

## Bloque D · La decisión al enviar el inventario

Al enviar el inventario, si hay sugerido guardado, la app pregunta:
**«¿Desea enviar también la sugerencia de pedido?»**

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-SUG-050 | Enviar un inventario **con** sugerido guardado | Aparece la pregunta |
| DM-SUG-051 | Enviar un inventario **sin** sugerido | **No** aparece la pregunta; el inventario se envía normal |
| DM-SUG-052 | Responder **SÍ** | El inventario se envía y la sugerencia también; queda en la nube |
| DM-SUG-053 | Responder **NO** | El inventario se envía y **la sugerencia queda guardada localmente, en Pendiente**, disponible para usarla después ⚠ *Esto es lo esperado según QA; confirmarlo es parte de la prueba. Si se descarta, es hallazgo* |
| DM-SUG-054 | Tras responder NO, volver al submódulo | La sugerencia sigue ahí y **se puede convertir en pedido** |
| DM-SUG-055 | Cancelar el envío del inventario con la pregunta en pantalla | Ni el inventario ni la sugerencia se envían; nada queda a medias |

---

## Bloque E · Un solo pedido por sugerencia

La validación que pidió QA. **Está implementada** (`isSuggestedOrderSent`, consumida en
`inventario-sugerido-list.component.ts:113/149/174`) — hay que comprobar que se comporta,
y sobre todo **que se entiende**.

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-SUG-060 | Convertir una sugerencia en pedido | La cabecera queda con `in_order_sent = 1` y con `co_order` / `id_order` apuntando al pedido creado |
| DM-SUG-061 | Volver a la lista tras convertirla | Aparece como «**Enviado**», no «Pendiente» |
| DM-SUG-062 | Abrirla otra vez y **confirmar la vista previa** | **No se crea un segundo pedido** |
| DM-SUG-063 | 🔎 **¿Avisa o se queda mudo?** | El código hace `return` **sin mensaje**: el usuario confirma y no pasa nada. Comprobar en pantalla. Si no hay aviso, es un hallazgo de usabilidad — el usuario no puede distinguir «está bloqueado» de «la app se colgó» |
| DM-SUG-064 | Verificar en la nube tras el segundo intento | **Un solo pedido** para esa sugerencia |
| DM-SUG-065 | Eliminar el pedido creado desde una sugerencia (si se puede) | Definir con el REQ si la sugerencia vuelve a **Pendiente** o queda consumida para siempre |
| DM-SUG-066 | Dos sugerencias distintas del mismo cliente | Cada una genera **su** pedido; marcar una no bloquea la otra |

---

## Bloque F · Sincronización y las tres capas

Las tablas nuevas son **85** (`clientStockSuggestedOrders`) y **86**
(`clientStockSuggestedOrderDetails`), y la sincronización **mezcla lo de la nube con lo
local** (`mergeSyncedSuggestedOrdersWithLocal`) — o sea que baja, no solo sube.

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-SUG-070 | Sincronizar tras enviar una sugerencia | Llega a la nube con cabecera y detalle completos |
| DM-SUG-071 | **Cotejo en la nube, término por término** | Los mismos valores que en el equipo. Es el mismo cotejo de DM-SUG-031, una capa más allá |
| DM-SUG-072 | Web: **Transacciones → Pedido Sugerido** | Aparece la sugerencia enviada, con su cliente, fecha y líneas |
| DM-SUG-073 | Cotejo móvil ↔ web | Mismos productos, mismas cantidades sugeridas, mismos términos |
| DM-SUG-074 | El pedido generado, en la web | Sus líneas coinciden con las de la sugerencia (los sugeridos en 0 excluidos) |
| DM-SUG-075 | **Merge:** sincronizar con una sugerencia local pendiente y otra en la nube | Ambas quedan, sin pisarse ni duplicarse |
| DM-SUG-076 | **Merge del estado:** sugerencia marcada como enviada en la nube, pendiente en el equipo | Definir cuál gana; verificar que no reviva una ya consumida |
| DM-SUG-077 | Sincronizar dos veces seguidas sin cambios | No se duplican filas ni se pierden |

---

## Bloque G · No-regresión de los módulos vecinos

La rama toca `pedido.component.ts`, `auto-send.service.ts` y la sincronización, así que hay
que confirmar que lo de siempre sigue igual. **Visitas queda fuera** por el bug conocido.

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-SUG-080 | **Inventarios**: ciclo normal sin tocar el sugerido | Crear, guardar, reabrir, enviar y cotejar en nube — sin cambios respecto de main |
| DM-SUG-081 | **Pedidos**: pedido normal, sin partir de una sugerencia | Funciona igual; no queda ligado a ninguna sugerencia (`co_order` de sugeridos vacío) |
| DM-SUG-082 | **Devoluciones**: ciclo completo, Calidad y Distribución | Se crean y llegan a la nube |
| DM-SUG-083 | La devolución recién creada **entra al siguiente sugerido** | Con el signo correcto: Distribución resta, Calidad no |
| DM-SUG-084 | Envío automático (`auto-send`) con una sugerencia pendiente | No la envía sola si el usuario dijo que no |
| DM-SUG-085 | Lote y fecha de vencimiento en inventarios (`expirationBatch = true`) | Siguen siendo obligatorios |

---

## Registros a dejar anotados

Al cerrar la corrida, la tabla de lo creado en el sistema:

| Qué | Dónde anotarlo |
|---|---|
| Inventarios creados | número + `co_client_stock` |
| Sugeridos guardados | `co_client_stock_suggested_order` + estado |
| Pedidos generados desde sugerencia | referencia + a qué sugerencia corresponde |
| Devoluciones creadas | referencia + tipo (Calidad / Distribución) |

---

## Lo que este guión deja fuera a propósito

- **Visitas** — bug conocido en la rama, en fix.
- El caso de **eliminar** una sugerencia guardada: no vi la opción en el código; si existe en
  la UI, se agrega al bloque C.
- **Fragilidad anotada, no defecto:** la consolidación compara fechas con
  `substr(da_invoice, 1, 10)`, o sea **como texto**. Funciona porque la fecha se guarda en
  formato ISO. Si una sincronización la guardara con otro formato, el despacho volvería a
  quedar incompleto **en silencio**. Vale la pena mirar el formato de `da_invoice` en la BD
  nueva antes de dar por buena la consolidación.
