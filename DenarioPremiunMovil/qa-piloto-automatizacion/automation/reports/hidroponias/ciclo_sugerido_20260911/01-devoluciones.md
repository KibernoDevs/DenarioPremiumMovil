# Vuelta 1 · DEVOLUCIONES — ciclo «Pedido Sugerido» · HIDROPONIAS

| Parámetro | Valor |
|---|---|
| RUN_ID | `ciclo_sugerido_20260911` |
| Fecha | 2026-09-11 |
| Rama bajo prueba | **`SaveSuggestedOrder`** — commit `272ef3c0` (11/09) |
| Playa (descubierta en runtime) | **Isla Coche** |
| Empresa | **`HIDRO_A`** · `idEnterprise 1` · HIDROPONIAS VENEZOLA — leída del `ion-select` del formulario |
| Usuario | **V3 · ROGER MUESES** · `idUser 469` — leído de `localStorage.user` |
| Dispositivo | Infinix X6728 · Android 15 · WebView Chrome/152 · 360×744 |
| VGs leídas en vivo | `suggestedOrderByDispatchAndReturn=true` · `validateReturn=true` · `requeridedNroFactura=true` · `signatureReturn=true` · `userCanUploadFiles=true` · `expirationBatch=false` · `enterpriseEnabled=false` · `userMustActivateGPS=true` |
| Resultado | **30 casos: 28 PASS · 0 FAIL · 2 Observación** — más **1 hallazgo nuevo** y **2 reconfirmados** |

> **Titular:** la APK **sí trae el fix** (`id_return <> 0`), y los **cinco casos del punto A pasan**,
> incluido el **caso límite**: una devolución recién enviada **sí** entra al sugerido, porque el
> `id_return` se estampa en la BD local **antes de que el usuario recupere el control**.

---

## 0. Comprobación de la build (Paso 0)

Leído del **bundle vivo** (`fetch('http://localhost/main.js')`, 5.466.551 caracteres), no del repo.

**`getReturnsByDistribution` — SQL completo, tal cual está en la build:**

```sql
select * from return_details rd where co_return in
  (SELECT r.co_return from returns r where r.id_type in
     (select rt.id_type from return_types rt where rt.id_return_category in
        (select rc.id_return_category from return_category rc
          where rc.subtract_suggestion = 'true') )
   and r.id_client = <idClient>
   and r.id_enterprise = <idEnterprise>
   and r.id_return <> 0                       -- <=== EL FIX, PRESENTE
   and r.da_return >= '<dateLastInventory[0:10]>')
  and rd.id_product IN (...) and rd.co_measure_unit IN (...)
```

| Comprobación | Resultado |
|---|---|
| `id_return <> 0` en el `WHERE` de `getReturnsByDistribution` | ✅ **PRESENTE** — 1 sola ocurrencia en todo el bundle, y está exactamente ahí |
| `suggestedOrderByDispatchAndReturn` en el bundle | presente (offset 2.448.948) |
| Guarda de tenant | ✅ `HIDRO_A` (idEnterprise 1) + `V3 / idUser 469` confirmados **en la app** antes de leer la BD |

**Dos precisiones sobre el fix que conviene que desarrollo confirme** (no son defectos; son
lecturas del código vivo que cambian cómo se interpreta el resto):

1. **El nombre engaña.** `getReturnsByDistribution` **no filtra por «Distribución»**: filtra por
   `return_category.subtract_suggestion = 'true'`. En este equipo eso mapea así —
   `Calidad (60) → categoría 1 → subtract_suggestion='false'` · `Distribución (61) → categoría 2 → 'true'` —
   con lo que el comportamiento observado es el correcto, pero **está gobernado por un flag de
   catálogo, no por el tipo**. Si alguien marcara Calidad como `subtract_suggestion='true'`,
   Calidad empezaría a restar sin tocar una línea de código.
2. **La ventana no es «desde la última factura»** sino **desde el inventario anterior**:
   `dateLastInventory = pastDaysISO(daysSinceLast)`. En esta corrida `daysSinceLast = 1` ⇒ la
   ventana fue `da_return >= '2026-09-10'`.

> ⚠ **Esta build va 7 commits por detrás de `main`** y no trae el fix del rol Promotor ni los
> últimos de cobros y depósitos. **Nada de lo de aquí revalida esos módulos.**

---

## A · Fix 1 — el sugerido ya no cuenta devoluciones no enviadas

### Cómo se montó la medición

La ventana del sugerido (`da_return >= 2026-09-10`) estaba **vacía** al empezar: cero
devoluciones de 100113 en ese rango. Partimos de `returned_stock = 0` real, no supuesto —
así cualquier número distinto de cero es atribuible a lo que creó esta corrida.

Se crearon cuatro devoluciones sobre **100113 · HIPERMERCADO PARAMO - PIEDRA AZUL**
(`id_client 65`, factura `20118282`) y se midió el modelo
`ng.getComponent(document.querySelector('app-inventario-sugerido-preview')).productsSuggested[].unitsSuggested[]`
en **tres pasadas**, cada una con un inventario nuevo del mismo cliente y `daysUntilNext = 7`.

| Devolución | Tipo | Estado | Líneas |
|---|---|---|---|
| **D1** `co 1789158897547.0` | Distribución (61) | Guardada → **Enviada (Ref 279)** | `046013ESP001BOL` ×6 · `GERPROALF002CAJ` ×7 |
| **D2** `co 1789159797846.0` | **Calidad (60)** | **Enviada (Ref 280)** | `HIDPROBER001BOL` ×5 · `046013ESP001BOL` ×4 |
| **D3** `co 1789159255271.0` | Distribución (61) | **Guardada, nunca enviada** (`id_return = 0`) | `046013ESP001BOL` ×**−3** |
| **D4** `co 1789160160696.0` | Distribución (61) | **Enviada (Ref 281)** | `GERPROALF002CAJ` ×2 |

### Caso 1 — Devolución de Distribución GUARDADA y no enviada ⇒ NO entra · ✅ **PASS**

**Es el caso del ticket**, y se montó en su forma más severa: con D1 (×6, ×7) y D3 (×**−3**)
guardadas y sin enviar (`id_return = 0`, `st_delivery = 3`), se generó el sugerido.

| Producto | `returnedStock` medido | Lo que daría **sin** el fix |
|---|---|---|
| `046013ESP001BOL` | **0** ✅ | 6 + (−3) = **3** |
| `GERPROALF002CAJ` | **0** ✅ | **7** |
| `HIDPROBER001BOL` | **0** ✅ | 0 |

Y la aritmética completa de la pasada 1 cuadra con el modelo del guión, **tolerancia 0**:

| Producto | prev | disp | swap | **ret** | ini | cur | sold | daily | sug |
|---|---|---|---|---|---|---|---|---|---|
| `046013ESP001BOL` | 0 | 15 | 0 | **0** | 15 | 2 | 13 | 13 | **91** |
| `GERPROALF002CAJ` | 0 | 30 | 0 | **0** | 30 | 3 | 27 | 27 | **189** |
| `HIDPROBER001BOL` | 0 | 15 | 0 | **0** | 15 | 1 | 14 | 14 | **98** |

*(15 − 2 = 13 · 13 × 7 = 91 ✓ · 30 − 3 = 27 · 27 × 7 = 189 ✓ · 15 − 1 = 14 · 14 × 7 = 98 ✓)*

Estos mismos valores quedaron **persistidos** en
`client_stock_suggested_order_details` (`co_client_stock_suggested_order 1789159595357.0`)
con `returned_stock = 0` en las tres líneas — o sea que el 0 no fue sólo de pantalla.

> **La cantidad negativa de D3 es lo que da filo al caso:** «Guardar» no valida negativos
> (ver Hallazgo A), así que de haber entrado al cálculo habría **inflado** el sugerido, que es
> exactamente el síntoma del +25 % del ticket. No entró.

### Caso 2 — Devolución de Distribución ENVIADA ⇒ sí entra y resta · ✅ **PASS**

Tras enviar D1 (Ref 279), la pasada 2 midió:

| Producto | `returnedStock` | De dónde sale |
|---|---|---|
| `046013ESP001BOL` | **6** ✅ | sólo D1 (enviada) |
| `GERPROALF002CAJ` | **7** ✅ | sólo D1 (enviada) |

Aritmética de la pasada 2, también con tolerancia 0:

| Producto | prev | disp | swap | **ret** | ini | cur | sold | daily | sug |
|---|---|---|---|---|---|---|---|---|---|
| `046013ESP001BOL` | 0 | 15 | 0 | **6** | 15 | 2 | **7** | 7 | **49** |
| `GERPROALF002CAJ` | 0 | 30 | 0 | **7** | 30 | 3 | **20** | 20 | **140** |
| `HIDPROBER001BOL` | 0 | 15 | 0 | **0** | 15 | 1 | 14 | 14 | **98** |

*(15 − 2 − 6 = 7 ✓ · 30 − 3 − 7 = 20 ✓ · 15 − 1 − 0 = 14 ✓)*

### Caso 3 🔑 — El caso límite: devolución RECIÉN enviada · ✅ **PASS, no muerde**

La pregunta era si el `id_return` tarda en volver de la nube y deja fuera una devolución
legítima. **Se midió por dos vías independientes.**

**(a) Cuándo aparece el `id_return` en la BD local.** Durante el envío de D1 se consultó la
BD local del equipo **en cada eslabón de la cadena de alertas**, sin soltar el diálogo:

| Momento | ms desde el clic en Enviar | `id_return` local | `st_delivery` |
|---|---|---|---|
| Alerta 1 — *«¿Desea enviar la devolución?»* | 687 | **0** | 3 |
| Alerta 2 — *«¡Su Devolución será enviada!»* | 3.249 | **279** ✅ | **1** |
| Alerta 3 — *«Devolución nro. 279 enviada exitosamente»* | 5.808 | **279** | 1 |

> **El `id_return` ya está estampado en la alerta 2**, es decir **antes de que el usuario
> termine de despachar el diálogo de envío**. La app lo escribe dentro del `.then()` del POST,
> no en una sincronización posterior. La ventana de riesgo dura ~2,5 s y transcurre **íntegra
> dentro del flujo de envío**, donde el vendedor no puede estar generando un sugerido.

**(b) Prueba de punta a punta.** Se envió **D4** (Distribución, `GERPROALF002CAJ` ×2 → Ref 281)
y **acto seguido** se generó un sugerido nuevo:

| | Valor |
|---|---|
| Tiempo entre el envío y la generación del sugerido | **74,7 s** (lo que tarda navegar y cargar el inventario — no se esperó nada) |
| `returnedStock` de `GERPROALF002CAJ` | **9** = 7 (D1) + **2 (D4, recién enviada)** ✅ |
| Aritmética | ini 30 − cur 3 − ret 9 = sold **18** · 18 × 7 = **126** ✓ |

**Conclusión:** la devolución recién enviada **entra al cálculo**. El sugerido **no** sale de más.

> **El único resquicio que queda —y no se pudo ejercitar— es el envío sin señal.** El fix ata
> «cuenta para el sugerido» a «la nube ya asignó id». Si un envío quedara en
> `pending_transactions`, la devolución sería legítima y quedaría fuera hasta que sincronice.
> En este equipo **ese estado no existe hoy**: `pending_transactions = 0`, `failed_transactions = 0`,
> y en las **84 devoluciones** de la BD local **no hay ni una** con `st_delivery = 1` y `id_return = 0`
> (81 bajadas de la nube con `id > 0`, 3 enviadas hoy con `id > 0`, 1 guardada con `id = 0`).
> Forzarlo exige modo avión, que está fuera de lo reproducible por UI. **Ver §6.**

### Caso 4 — Devolución de Calidad ⇒ no resta, ni guardada ni enviada · ✅ **PASS**

D2 (Calidad, Ref 280, **enviada**) incluye `HIDPROBER001BOL` ×5 y `046013ESP001BOL` ×4.

| Producto | `returnedStock` | Lectura |
|---|---|---|
| `HIDPROBER001BOL` | **0** ✅ | su única devolución en la ventana es la de Calidad ×5 — **no restó** |
| `046013ESP001BOL` | **6** (no 10) ✅ | los ×4 de Calidad **no se sumaron** a los ×6 de Distribución |

`HIDPROBER001BOL` es el caso limpio: una devolución de Calidad **enviada** de 5 unidades, y el
término quedó en 0. La parte «ni guardada» quedó cubierta de forma indirecta por el caso 1
(ninguna guardada entra, sea del tipo que sea) — ver §6.

### Caso 5 — Mismo producto con una guardada y una enviada ⇒ resta sólo la enviada · ✅ **PASS**

`046013ESP001BOL` llega a la ventana con **tres** devoluciones a la vez:

| Devolución | Tipo | Estado | Cantidad | ¿Debe restar? |
|---|---|---|---|---|
| D1 (Ref 279) | Distribución | Enviada | 6 | **sí** |
| D3 | Distribución | **Guardada** | **−3** | no |
| D2 (Ref 280) | Calidad | Enviada | 4 | no |

**`returnedStock` medido = 6** ✅ — exactamente la enviada de Distribución.
Los tres desenlaces incorrectos posibles eran distinguibles y ninguno ocurrió: **3** (si contara
la guardada), **10** (si contara Calidad) y **7** (si contara ambas).

**Confirmación independiente en la BD local.** Se reprodujo el `WHERE` exacto de la build
(con `id_return <> 0`) contra la BD del equipo y devuelve justo lo que mostró el modelo:

```
id_return 279 · tipo 61 · 046013ESP001BOL · 6
id_return 279 · tipo 61 · GERPROALF002CAJ · 7
id_return 281 · tipo 61 · GERPROALF002CAJ · 2
```
⇒ ESPINACA **6** · ALFALFA **9**. Modelo y BD coinciden, **tolerancia 0**.

---

## B · Ciclo de devoluciones — tabla de veredictos

| ID | Caso | Resultado | Evidencia medida |
|---|---|---|---|
| DEV-001 | Guarda de build: `id_return <> 0` en el bundle vivo | ✅ PASS | 1 ocurrencia, dentro del `WHERE` de `getReturnsByDistribution` |
| DEV-002 | Guarda de tenant: `HIDRO_A` + `V3` | ✅ PASS | select de empresa = `{idEnterprise:1, coEnterprise:"HIDRO_A"}` · `localStorage.user` = `idUser 469 / coUser "V3" / naUser "ROGER MUESES"` |
| DEV-003 | HOME → DEVOLUCIONES | ✅ PASS | lista en **1,1 s** |
| DEV-004 | Formulario nuevo (guarda de GPS) | ✅ PASS | **1,4-2,6 s** con caché de GPS caliente (el ciclo anterior midió 69,5 s en frío) |
| DEV-005 | Tabs Productos/Adjuntos bloqueadas sin cliente ni factura | ✅ PASS | `[General(false), Productos(true), Adjuntos(true)]` |
| DEV-006 | Selector de empresa con una sola empresa | ✅ PASS | `disabled=true`, objeto completo, sin `formcontrolname` — 6.ª confirmación de la variante |
| DEV-007 | Selección de cliente | ✅ PASS | **17 clientes**; `#clienteSelectModal`; acertó 4 de 4 con `scrollIntoView` + re-medir + `mouse.click` |
| DEV-008 | `validateReturn=true`: la factura desbloquea las tabs | ✅ PASS | con cliente solo → siguen `disabled`; al fijar factura → las 3 pasan a `false` |
| DEV-009 | Selector de factura `#invoiceSelect` | ✅ PASS | `ion-modal#InvoiceeSelectModal` (doble «e»), **17 facturas**, formato `Nro Factura: 20118282 · Fecha: 07/09/2026` |
| DEV-010 | Catálogo de tipos | ✅ PASS | 2 activos: `60 Calidad` (default) · `61 Distribución` |
| DEV-011 | Tipo de devolución abre `ion-popover` (1 click) | ✅ PASS | `["Calidad","Distribución"]`, `value` 60 → 61 a la primera, 3 de 3 |
| DEV-012 | `AGREGAR PRODUCTO` lista los productos **de la factura** | ✅ PASS | **8 ítems** = `invoice_detail` de la `20118282`, con `Nro Factura` prellenado por línea |
| DEV-013 | Cantidad en acordeón, escribiendo **colapsado** | ✅ PASS | `ion-input` por su `.label` → el valor llega a `productList[].quProduct`, 8 de 8 líneas, sin expandir |
| DEV-014 | Guardar (Distribución) | ✅ PASS | `[Cancelar/**Aceptar**]` → *«¡Su Devolución se ha guardado!»* `[OK]` · local `id_return=0`, `st_delivery=3` |
| DEV-015 | Round-trip §9: Guardar → salir → BUSCAR → reabrir | ✅ PASS | **9/9 valores idénticos**: cliente, factura `20118282`, responsable, precinto `P0911D1`, comentario, empresa `HIDRO_A`, tipo `61`, y las 2 líneas (`046013ESP001BOL` 6 · `GERPROALF002CAJ` 7) con su `coDocument` y motivo |
| DEV-016 | Enviar Distribución (D1) | ✅ PASS · **BD-OK** | 3 alertas, la 3.ª con correlativo: *«Devolución nro. **279** enviada exitosamente»* |
| DEV-017 | Enviar Calidad (D2) | ✅ PASS · **BD-OK** | *«Devolución nro. **280** enviada exitosamente»* |
| DEV-018 | Enviar Distribución (D4) | ✅ PASS · **BD-OK** | *«Devolución nro. **281** enviada exitosamente»* |
| DEV-019 | Sync a nube: ¿inmediata o diferida? | ✅ PASS | **INMEDIATA** — fila en la nube en la 1.ª consulta; `pending_transactions=0`, `failed_transactions=0` |
| DEV-020 | Diff de baseline en la nube | ✅ PASS | `count 251 → **254**`, `max(id_return) 278 → **281**` ⇒ **exactamente +3**, todas `id_user=469`, `id_client=65`, `st_return=1`. Cero filas inesperadas |
| DEV-021 | Cotejo campo-a-campo nube ↔ local (§10.b) | ✅ PASS · **BD-FIELD-OK** ×3 | `cotejo-bd.js` sobre las 3 enviadas: **79 campos comparados, 0 mismatches** |
| DEV-022 | La Guardada **no** llega a la nube | ✅ PASS | D3 (`co 1789159255271.0`) sigue sólo en local; no está entre las filas nuevas de la nube |
| DEV-023 | Validación al Enviar: cantidad **mayor** que la facturada (20 > 15) | ✅ PASS | rechaza con `[Aceptar]`, no envía |
| DEV-024 | Validación al Enviar: cantidad **0** | ✅ PASS | mismo rechazo |
| DEV-025 | Validación al Enviar: cantidad **negativa** (−4) | ✅ PASS | mismo rechazo. El `ion-input` **no tiene atributo `min`** y llega `ng-invalid=false` con −4: la guarda vive sólo en el handler de Enviar |
| DEV-026 | Validación al Enviar: cantidad **vacía** | ✅ PASS | mismo rechazo; aquí sí `ng-invalid=true` |
| DEV-027 | Dirty-guard al salir de un form sin guardar | ✅ PASS | `[Guardar y salir / **Salir sin guardar** / Cancelar]` ×2 (devoluciones e inventarios); no quedó borrador |
| DEV-028 | Devoluciones **dentro de la ventana** del sugerido | ✅ PASS | ver §4 |
| DEV-029 | Mensaje de la alerta de cantidad | 🟡 **Observación** | truncado — ver Hallazgo B |
| DEV-030 | «Guardar» no valida la cantidad | 🟡 **Observación** | reconfirmado — ver Hallazgo A |

---

## 2. Registros creados en el sistema

> **Esto es el insumo de la vuelta siguiente.** Las cantidades de abajo son las que dictan
> el `returned_stock` esperado.

| Ref (`id_return`) | `co_return` | Tipo | Cliente | Factura | Productos y cantidades | Estado local | ¿Llegó a la nube? |
|---|---|---|---|---|---|---|---|
| **279** | `1789158897547.0` | **Distribución (61)** | 100113 (`id_client 65`) | `20118282` | `046013ESP001BOL` ×**6** · `GERPROALF002CAJ` ×**7** | `st_delivery=1` | ✅ **BD-OK** · `st_return=1` · 2 detalles · BD-FIELD-OK |
| **280** | `1789159797846.0` | **Calidad (60)** | 100113 | `20118282` | `HIDPROBER001BOL` ×**5** · `046013ESP001BOL` ×**4** | `st_delivery=1` | ✅ **BD-OK** · `st_return=1` · 2 detalles · BD-FIELD-OK |
| **281** | `1789160160696.0` | **Distribución (61)** | 100113 | `20118282` | `GERPROALF002CAJ` ×**2** | `st_delivery=1` | ✅ **BD-OK** · `st_return=1` · 1 detalle · BD-FIELD-OK |
| **— (`id_return 0`)** | `1789159255271.0` | **Distribución (61)** | 100113 | `20118282` | `046013ESP001BOL` ×**−3** | `st_delivery=3` **Guardada** | ⛔ **No** — a propósito |

**Cabecera común:** responsable `QA V1 11/09` · precintos `P0911D1/D2/D3/D4` ·
comentarios `QA ciclo sugerido 11/09 - …` · `co_enterprise HIDRO_A` · `id_user 469` ·
`nu_attachments 0` · motivo `67` en todas las líneas · unidad `UNI` · `da_return 2026-09-11`.

> 🔴 **D3 se deja viva a propósito.** Es la devolución Guardada con cantidad **−3** que prueba el
> fix de forma continua: **mientras siga con `id_return = 0`, ningún sugerido debe contarla.**
> Si en una vuelta futura `046013ESP001BOL` aparece con `returned_stock = 3` en vez de 6, el fix
> se rompió. **No borrarla sin avisar.**

### 2.b · Inventarios y sugeridos creados de paso (instrumento de medición)

No eran el objeto de esta vuelta; se crearon para poder leer `returnedStock`. Se anotan porque
la vuelta 2 se los va a encontrar.

| `co_client_stock` | Estado | Productos (cantidad actual) | Sugerido generado |
|---|---|---|---|
| `1789159374765.0` | Guardado (`st_delivery=3`) | ESPINACA 2 · ALFALFA 3 · BERRO 1 | `1789159595357.0` · 3 líneas · **pasada 1** (ret 0/0/0) |
| `1789159997844.0` | Guardado (`st_delivery=3`) | ESPINACA 2 · ALFALFA 3 · BERRO 1 | `1789160048412.0` · 3 líneas · **pasada 2** (ret 6/7/0) |
| `1789160266062.0` | ⚠ **DESCARTADO** («Salir sin guardar») | ALFALFA 3 | `1789160290226.0` · 1 línea · **pasada 3** (ret 9) — **huérfano, ver Hallazgo C** |

Los tres sugeridos quedaron `in_order_sent = 0` (**Pendiente**) y `days_until_next = 7`.

---

## 3. Oráculo para la vuelta siguiente

Ventana efectiva medida: **`da_return >= 2026-09-10`** (= `pastDaysISO(daysSinceLast=1)`).
Todas las devoluciones de esta corrida son del **2026-09-11**, así que entran las cuatro.

| Producto | `returned_stock` esperado | Composición |
|---|---|---|
| `046013ESP001BOL` (ESPINACA 300GRS, id 6) | **6** | Ref 279 ×6. **No** suman: Ref 280 ×4 (Calidad) ni D3 ×−3 (Guardada) |
| `GERPROALF002CAJ` (ALFALFA CAJA 100GRS, id 24) | **9** | Ref 279 ×7 + Ref 281 ×2 |
| `HIDPROBER001BOL` (BERRO 100GRS, id 29) | **0** | sólo Ref 280 ×5, que es **Calidad** |

**Despacho de la factura `20118282` (07/09)** — el otro término, ya verificado dos veces:
`046013ESP001BOL` **15** · `GERPROALF002CAJ` **30** · `HIDPROBER001BOL` **15**.

⚠ **Ojo con la ventana si la vuelta 2 corre otro día.** La ventana la fija el **inventario
anterior**, no la factura. Mientras el inventario previo sea del 10 o del 11/09, las cuatro
devoluciones entran. Si se generara un inventario con un `daysSinceLast` que empuje la ventana
más allá del 11/09, **dejarían de contar** y el oráculo de arriba cambia.

---

## 4. Devoluciones dentro de la ventana — verificado por las dos definiciones

| Definición | Fecha de corte | ¿Entran las 4 devoluciones del 11/09? |
|---|---|---|
| La del encargo — `da_return >= última fecha facturada del cliente` | **2026-09-07** (última factura de `id_client 65 / id_address_client 680`) | ✅ sí |
| La que aplica el código — `da_return >= fecha del inventario anterior` | **2026-09-10** | ✅ sí |

**Nota de fragilidad (la del guión, comprobada):** la consolidación compara fechas con
`substr(da_invoice, 1, 10)`, o sea **como texto**. En la BD nueva el formato es
`2026-09-07T19:53:00.000+00:00` — ISO, así que el `substr` funciona. **Sigue siendo frágil**:
otro formato rompería el despacho en silencio, pero **hoy no reproduce**.

---

## 5. Hallazgos

### 🟠 Hallazgo A — S3 · «Guardar» sigue sin validar la cantidad (reconfirmado del 09/09)

Con `Cantidad Devuelta = −3`, **Guardar** no valida nada: pide confirmación, responde
*«¡Su Devolución se ha guardado!»* y deja en la BD local
`return_details.qu_product = −3` (`co_return 1789159255271.0`). **Enviar** sí lo rechaza.

**Ya no es un riesgo para el sugerido** — es precisamente lo que el fix de esta build neutraliza,
y esta corrida lo demuestra (caso 1). Queda como **defecto de validación por derecho propio**:
permite un dato local inconsistente y depende de que nadie lea las Guardadas. Por eso **baja de
S2 a S3**, pero sigue abierto.

**Reproducción:** devolución nueva → cliente + factura + producto → `Cantidad Devuelta = −3` →
**Guardar** → Aceptar → mirar `return_details`.

### 🟠 Hallazgo B — S3 · La alerta de cantidad no dice el tope y no distingue los casos (reconfirmado)

Los **cuatro** rechazos de cantidad devuelven, literalmente y completo (leído del `innerHTML`
del `.alert-message`, no de un recorte):

```
La cantidad a devolver debe estar entre 1 y
```

Falta el límite superior, y es **el mismo texto** para «te pasaste» (20 > 15), «pusiste 0»,
«pusiste −4» y «lo dejaste vacío». Medido con `046013ESP001BOL`, facturado **15** en la
`20118282`: debería decir «entre 1 y 15».

### 🟡 Hallazgo C — S3 · Un sugerido sobrevive al inventario que lo generó (NUEVO)

**Qué pasa.** Abrir la vista previa del Pedido Sugerido **persiste la sugerencia en el acto**.
Si después se sale del inventario con **«Salir sin guardar»**, el inventario no se guarda pero
**la sugerencia queda**, apuntando a un `co_client_stock` que no existe.

**Lo medido.**

| Comprobación | Resultado |
|---|---|
| Sugerencia creada | `co_client_stock_suggested_order 1789160290226.0` → `co_client_stock 1789160266062.0` |
| ¿Existe ese inventario? | **`SELECT count(*) FROM client_stocks WHERE co_client_stock='1789160266062.0'` → 0** |
| Huérfanos en toda la BD local | **exactamente 1** — este. Ninguno de los otros 3 sugeridos guardados lo está |
| ¿Se ve en la UI? | **Sí.** En *Inventario → SUGERENCIAS DE PEDIDO* aparece como `Nro. Ref.: 0 · Estatus: **Pendiente** · 11/09/2026 16:58`, indistinguible de las legítimas |

**Por qué importa.** El vendedor ve una sugerencia pendiente de un inventario que él descartó, y
puede convertirla en pedido. Es reproducible y lo creó esta corrida (no es dato histórico).

**Reproducción:** Inventario nuevo → cliente → cargar un producto → RESUMEN → **Pedido Sugerido**
→ cerrar la vista previa → **Salir sin guardar** → entrar a *SUGERENCIAS DE PEDIDO*.

> Pertenece de lleno a la vuelta de **inventarios y sugerido**; se levanta aquí porque apareció
> al montar el instrumento de medición. **Conviene decidir con el REQ** si la sugerencia debe
> persistirse al abrir la vista previa o sólo al guardar el inventario.

### ⚪ A vigilar (no se reportan como defecto)

1. **`subtract_suggestion` es un flag de catálogo, no el tipo de devolución.** Hoy mapea bien
   (Calidad `false` / Distribución `true`), pero el comportamiento de «Calidad no resta» depende
   de un dato, no del código. Merece quedar escrito en el REQ.
2. **El cliente `9999932` LA CORNETERIA sigue sin bajar al equipo.** La cartera sigue en
   **17 clientes** y no está. Es el Hallazgo 1 del ciclo del 09/09 (sincronización del lado
   servidor: la asignación no estampó `address_client.da_update`) y **no se ha corregido**.
   No bloqueó esta vuelta porque todo se hizo sobre 100113.
3. **El bloque `# Cliente: hidroponias` de `qa-credentials.env` sigue diciendo `vendedor4`**
   mientras la sesión activa es **V3**. No es defecto de producto, pero cualquier corrida que
   siga el archivo al pie entra con el vendedor equivocado.

---

## 6. Lo que NO se pudo comprobar

| Caso | Motivo |
|---|---|
| **Devolución enviada que queda en cola por falta de señal** (`pending_transactions`), y si el sugerido la excluye | **No comprobado.** Es el único resquicio teórico del fix: ata «cuenta» a «la nube asignó id». Hoy el estado no es alcanzable — cola y fallidas en 0, y ninguna de las 84 devoluciones locales tiene `st_delivery=1` con `id_return=0`. Forzarlo exige **modo avión**, fuera de lo reproducible por UI y fuera del encargo. **Recomendación: que la QA lo pruebe a mano** — enviar una devolución en modo avión y generar el sugerido antes de restaurar la señal |
| **Caso 4 en su variante «Calidad GUARDADA»** | Cubierto sólo de forma **indirecta**: el caso 1 prueba que ninguna Guardada entra, sea del tipo que sea, pero **no se creó una Calidad guardada específica**. Si se quiere el caso literal del encargo, falta esa devolución |
| Devolución sobre **9999932 LA CORNETERIA** | El cliente no está en la cartera del equipo (punto 2 de «A vigilar») |
| **Adjuntar foto / firma** a la devolución | La cámara nativa cuelga CDP y el encargo prohíbe el mock. El adjunto **no es obligatorio** (`nu_attachments = 0` en los 3 envíos), así que no bloqueó nada |
| **Borrado** de una devolución Guardada (trash) | Se dejó sin ejercitar **a propósito**: el único Guardado es **D3**, que es la evidencia viva del fix (§2). Ya quedó certificado el 09/09 con cascada a `return_details` |

---

## 7. Patrones y selectores nuevos

| Patrón / selector | Alcance | Detalle |
|---|---|---|
| 🔴 **El `id_return` local se estampa DENTRO del flujo de envío, no en la sync** | universal (oráculo) | Medido a 687 ms / 3.249 ms / 5.808 ms de la cadena de 3 alertas: ya vale `279` en la **alerta 2**. ⇒ **`id_return > 0` en la BD local es un oráculo de «llegó al servidor» tan válido como la 3.ª alerta, y está disponible antes.** Útil para cualquier módulo que cotice contra `pending_transactions` |
| 🔴 **`AGREGAR PRODUCTO` cierra el picker tras cada alta: hay que reabrirlo por línea** | cliente/build | Tras agregar un producto, `productos-tab-return-product-list` queda **vacío** (`[]`) y el siguiente intento falla con «no está el código» — se lee como «el producto no existe». **Receta: reabrir el picker antes de CADA línea**, esperando a que liste (`items > 0`) antes de buscar |
| 🔴 **El picker de devoluciones NO es un `ion-modal`: se renderiza en línea** | cliente/build | Contradice la receta del ciclo anterior. `AGREGAR PRODUCTO` monta `productos-tab-return-product-list` **dentro de `app-devolucion`**; buscar un `ion-modal` activo devuelve `sin modal` y se lee como «el botón no abrió». Los clientes y las facturas **sí** son `ion-modal` (`#clienteSelectModal`, `#InvoiceeSelectModal`) |
| ✅ **Escribir colapsado funciona; reconfirmado en 8 líneas** | universal | `ion-input` por su propiedad `.label` (`'Cantidad Devuelta'`, `'Responsable:'`, `'No. Precinto:'`, `'Comentario:'`) + setter nativo + `input`/`change`/`ionInput`/`ionChange`. **Nunca hizo falta expandir el acordeón** para escribir. El índice del `.label` mapea 1:1 con el orden de las líneas |
| 🔴 **Guardar y Enviar son `ion-button.imagenGuardar` / `.imagenEnviar`, sin texto** | universal | No tienen `innerText`: buscarlos por texto devuelve `[]`. Están en el encabezado (y ≈32). Mismo par en DEVOLUCIONES e INVENTARIOS |
| ✅ **Reparto de alertas del módulo, completo** | universal | Guardar `[Cancelar/**Aceptar**]` → `[OK]` · Enviar `[Cancelar/**Aceptar**]` → `[OK]` → `[OK]` con correlativo · Dirty-guard `[Guardar y salir / **Salir sin guardar** / Cancelar]` · Rechazo de cantidad `[Aceptar]`. **Las ~20 alertas se resolvieron sin un solo reintento** con igualdad exacta case-insensitive + filtro `width>0`; **el backdrop no se comió ningún primer clic** en esta corrida |
| 🔴 **El modal de cantidad de INVENTARIOS exige teclado real y se acepta con el ✓ del encabezado** | universal | `ion-modal` sin `id` estable (`ion-overlay-NN`). Llenar con `pg.keyboard.type` (S2x) + `blur()` **antes** de medir el ✓ (`ion-icon[name="checkmark-outline"]` → `closest('ion-button')`, ≈321,86). Verificar que el modal cerró antes de seguir: si queda abierto, su backdrop se come todos los clics |
| ⚠ **El botón «Pedido Sugerido» NO nació fuera del viewport en esta corrida** | cliente/build | Apareció en `top 411` con `innerHeight 744` — **dentro**. Contradice la nota del 08/09 (`top 789`). Depende de cuántos productos tenga el Resumen. **El `scrollIntoView({block:'center'})` previo sigue siendo obligatorio** porque es gratis y cubre los dos casos |
| ⚠ **Dos ESPINACAS en FRESCALES: el trap del producto equivocado es real** | cliente | `046013ESP003BOL` (150 GRS) y `046013ESP001BOL` (300 GRS) son adyacentes. Con `/Código:\s*([A-Za-z0-9.\-]+)\s*$/` + **igualdad exacta** acertó 5 de 5. **Verificar siempre el código contra el modelo tras cerrar el modal** |
| ℹ **El preview persiste la sugerencia al abrirse** | universal | `client_stock_suggested_orders` gana una fila **en cuanto se abre la vista previa**, sin guardar el inventario. Consecuencia directa: reabrir un inventario ya previsualizado muestra el **snapshot**, no un recálculo ⇒ **para medir de nuevo hay que crear un inventario NUEVO** |
| ℹ **`window.ng` + `inventariosLogicService` es la fuente del modelo de inventarios** | universal | `ng.getComponent(document.querySelector('app-inventario'))` **no** expone `newClientStock`: hay que bajar a `.inventariosLogicService.newClientStock`. En devoluciones, en cambio, el hijo `devolucion-product-list` sí expone `productList` directo |
| ℹ **Playwright por Node reemplaza al MCP sin pérdida** | harness | El MCP de Playwright no levantó en esta sesión. `automation/playwright/node_modules` ya trae Playwright: los guiones corrieron con `connect.js` + `chromium.connectOverCDP('http://127.0.0.1:9220')` desde Bash. **Ventaja colateral:** se pudo consultar la BD local (`execFileSync`) **en medio** del flujo de UI, que es lo que permitió medir el caso límite |

---

## 8. Verificación BD

| Registro | Marca | Fila en la nube | Estado local | ¿Lo guardado se envió? |
|---|---|---|---|---|
| Ref **279** | **BD-OK** · BD-FIELD-OK | `id_return 279`, `st_return 1`, `id_user 469`, 2 detalles | `st_delivery=1`, `id_return=279`, fuera de cola | ✅ sí |
| Ref **280** | **BD-OK** · BD-FIELD-OK | `id_return 280`, `st_return 1`, 2 detalles | `st_delivery=1`, `id_return=280` | ✅ sí |
| Ref **281** | **BD-OK** · BD-FIELD-OK | `id_return 281`, `st_return 1`, 1 detalle | `st_delivery=1`, `id_return=281` | ✅ sí |
| D3 `1789159255271.0` | **BD-SAVED** | — | `st_delivery=3`, `id_return=0` | ✅ correcto: nunca se intentó enviar |

Baseline-diff: `count 251 → 254` · `max(id_return) 278 → 281` ⇒ **+3 exactas, cero sorpresas**.
`pending_transactions = 0` · `failed_transactions = 0` durante toda la vuelta.

---

*Vuelta 1 de 4 · siguiente: inventarios y sugerido.*
