# Certificación móvil — INSUMAR · 2026-09-11

| Parámetro | Valor |
|-----------|-------|
| RUN_ID | `certificacion_movil_20260911` |
| Cliente | INSUMAR (`INSUM_A` — INSUMAR DISTRIBUIDORA 715, C.A.) |
| Alcance | **Solo móvil + BD.** No se entró a la web (otro agente trabajando ahí) |
| Dispositivo | `14678405BR003855` (Infinix X6728, Android 15) |
| App | `com.kiberno.denarioPremiumPro` — **v6.6.21.3** · `window.ng = true` |
| Playa observada en runtime | `denarioelyaque.ddns.net:8081` (El Yaque) — *no se guarda en el YAML* |
| Base de datos (nube) | `insumar` · usuario lector `user_read` |
| Puntos certificados | **A** «Venta Facturada» con monto real · **B** `nu_base` / `nu_base_total` en 3 capas |
| Resultado | **5 PASS · 0 FAIL · 0 N/A · 0 BLOCKED** |

---

## Paso 0 — Sincronización y guarda de tenant

### Re-login completo (obligatorio)

Se hizo **logout desde HOME (SALIR) → pantalla de login → R003 → sincronización completa**, no un
«Sincronizar» parcial.

| Señal | Observado |
|---|---|
| Salida a `app-login` | ✅ `http://localhost/login` tras SALIR |
| Pantalla de sincronización | ✅ visible, **20 etapas distintas capturadas** |
| Etapas (muestra) | Clientes · Dirección de Clientes · Productos · Listas de Precios · Estructura de Producto · Mínimos y Múltiplos · Detalles de Factura · **Unidades de Detalle de Factura** · **Unidades de Detalle de Pedido** · Cobros · IGTF · Visitas · Tipos de Transacción · Bonificaciones de Producto … |
| Llegada a HOME | ✅ **23 s** después del submit |

### ✅ La sincronización SÍ trajo los datos nuevos

El discriminador que dio la QA era: si tras sincronizar «Venta por Pedido» sigue en **589,85**, no bajó lo
nuevo.

| Señal de datos viejos | Lo que muestra el equipo tras sincronizar |
|---|---|
| `Venta por Pedido = 589,85` | **`Venta por Pedido: 15.664,27 US$`** |

⇒ **No hay que parar.** El equipo quedó sobre la base nueva y se continuó con la corrida.

### Guarda de empresa y usuario (antes de leer la BD)

| Comprobación | Valor | Dónde se leyó |
|---|---|---|
| Empresa | **`INSUM_A`** — `na_enterprise` «INSUMAR DISTRIBUIDORA 715, C.A.» · `lb_enterprise` «INSUMAR DISTRIBUIDOR» | tabla `enterprise` (**una sola fila**) |
| Empresa en el equipo | `userInfo[0].coEnterprise = "INSUM_A"` · acordeón rotulado «INSUMAR DISTRIBUIDOR» | `app-vendedores` |
| Empresa en el pedido | select Empresa `disabled`, 1 opción, `{"coEnterprise":"INSUM_A"}` | `app-pedido` Tab General |
| Usuario R003 | `userInfo[0].idUser = 22` · `coUser = "R003"` | `app-vendedores` |
| Usuario R013 | `userInfo[0].idUser = 4` · `coUser = "R013"` | `app-vendedores` |

**Tenant confirmado: `INSUM_A` en las tres superficies (BD, módulo Vendedores, formulario de Pedido).**

### ⚠ Dos cosas que el equipo debería corregir en el perfil

1. **La base ya no es `insumar_P1`.** `SELECT datname FROM pg_database WHERE datname ILIKE '%insum%'`
   devuelve **una sola base: `insumar`**. El campo `db_name: insumar_P1` de
   `automation/clientes/insumar.yaml` quedó obsoleto con el reemplazo de hoy. El cotejo funcionó porque el
   DSN de `qa-db.env` tiene precedencia sobre el YAML, pero el YAML miente.
2. **`R003` vive dos veces en `users`, y la que manda es la minúscula.**

   | `id_user` | `login_user` | `co_operation` | `da_created` |
   |---|---|---|---|
   | 13 | `R003` | **`D`** (borrado lógico) | 2026-07-15 |
   | **22** | **`r003`** | `I` (activa) | 2026-08-25 |

   Los 104 pedidos de septiembre cuelgan de **`id_user = 22`**. Un oráculo que filtre por `login_user='R003'`
   (mayúsculas) cae sobre la fila borrada y **da 0 pedidos**. Lo mismo con `r013` (id 4), que tampoco existe en
   mayúsculas. **Filtrar por `id_user`, nunca por el login literal.**

---

## A · «Venta Facturada» con un monto real

### Oráculos recalculados en esta corrida

Calculados por mí contra la base nueva antes de mirar la app (septiembre 2026, `co_operation <> 'D'`):

```sql
-- Venta por Pedido
SELECT o.id_user, count(*), sum(o.nu_amount_total)
FROM "order" o
WHERE o.co_operation <> 'D'
  AND o.da_order >= DATE '2026-09-01' AND o.da_order < DATE '2026-10-01'
GROUP BY 1;

-- Venta Facturada
SELECT i.id_user, count(*), sum(i.nu_amount_total)
FROM invoice i
WHERE i.co_operation <> 'D'
  AND i.da_invoice >= DATE '2026-09-01' AND i.da_invoice < DATE '2026-10-01'
GROUP BY 1;
```

| Vendedor | `id_user` | Pedidos (oráculo) | Facturado (oráculo) | Coincide con el encargo |
|---|---|---|---|---|
| `r003` EVA MEDINA | 22 | **15.664,266** (104) | **0** (sin filas) | ✅ |
| `r013` VIVIANA ESCALANTE | 4 | 0 (sin filas) | **27.632,38** (137) | ✅ |
| `R016` LEANDRO REBOLLEDO | 12 | 19.708,8324 (136) | 18.152,99 (127) | ✅ (el facturado) |
| `R007` MIGUEL PARRA | 14 | 0 | 14.979,88 (89) | ✅ |

> El campo del oráculo es **`nu_amount_total`**, no `nu_amount_final`: con `nu_amount_final` el facturado de
> `r013` da 28.085,57 y no cuadra con la app.

### A.1 — R003 (el usuario del equipo)

| Campo en Vendedores | App | Oráculo | Veredicto |
|---|---|---|---|
| `Cuota Mes` | `0 US$` | — (sin cuota cargada) | — |
| **`Venta por Pedido`** | **`15.664,27 US$`** | 15.664,266 → **15.664,27** | ✅ **PASS** |
| **`Venta Facturada`** | **`0 US$`** | 0 (cero filas en `invoice`) | ✅ **PASS** (caso trivial, ya conocido) |

Modelo interno coincidente (`comp.userInfo[0].planesCuotaEmpresa[0]`):
`{ cuotaMes: 0, ventaRealMes: 15664.27, ventaPedidoMes: 15664.27, ventaFacturadaMes: 0 }`

### A.2 — R013 · **el caso que cierra el punto**

**Se logró entrar con R013 usando la misma clave del bloque `# Cliente: insumar`.**

⚠ **Ojo con el primer intento:** el submit devuelve un `ion-alert` que a primera vista parece un rechazo —
*«Está intentando sincronizar con un usuario que es diferente al previamente ingresado, de aceptar la
sincronización todos los datos anteriores serán borrados. ¿Está de acuerdo?»*. **No es un rechazo de
credenciales: es la confirmación de cambio de vendedor.** Al pulsar ACEPTAR el login completó y sincronizó
(HOME en 45 s). Un agente que lea esa alerta como «login fallido» descarta un usuario que sí entra.

| Campo en Vendedores | App | Oráculo | Veredicto |
|---|---|---|---|
| `Cuota Mes` | `0 US$` | — | — |
| `Venta por Pedido` | `0 US$` | 0 (r013 no tiene pedidos en septiembre) | ✅ **PASS** |
| **`Venta Facturada`** | **`27.632,38 US$`** | **27.632,38** (137 facturas) | ✅ **PASS** |

Modelo interno: `{ cuotaMes: 0, ventaRealMes: 0, ventaPedidoMes: 0, ventaFacturadaMes: 27632.38 }`
KPIs del acordeón: Días Hábiles 22 / Transcurridos 9 / Restantes 13 · Cartera 172 · Activados 0 · Nuevos 3.

> ✅ **«Venta Facturada» muestra su monto real, no 0.** El campo funciona con un valor distinto de cero, y el
> monto coincide **al céntimo** con la suma de `invoice.nu_amount_total` del vendedor en el mes.
> **Punto A cerrado.**

---

## B · `nu_base` y `nu_base_total`, con evidencia viva

### Estado de partida en la base nueva

Se confirmó lo que la QA anticipaba: **las filas que probaban la fórmula desaparecieron.**

```
SELECT count(*), count(nu_base) FROM order_detail_unit;
-->  total 5.786  ·  con nu_base  0  ·  con nu_base NULL  5.786
```

Las 5.786 filas preexistentes vienen de la carga ERP y traen `nu_base` y `nu_base_conversion` **nulos**. Por
§4.b del RUNTIME eso es *dato histórico*, no un defecto de la release: la prueba tenía que hacerse con un
registro **nuevo**.

### Productos verificados en la base nueva (antes de usarlos)

Los 5 candidatos **siguen teniendo dos unidades**:

| `co_product` | Producto | UND (`qu_unit`) | BTO (`qu_unit`) |
|---|---|---|---|
| `010362` | PASSION NOIR 56% 12X12UNDSX32G | `010362UND` = 1 | `010362BTO` = 12 |
| `010363` | PASSION NOIR 70% 12X12UNDSX32G | `010363UND` = 1 | `010363BTO` = 12 |
| `010391` | CHOCO LATTE MANI 12X12UNDX32G | `010391UND` = 1 | `010391BTO` = 12 |
| `010392` | CHOCO LATTE CRUJIENTE 12X12UNDX32G | `010392UND` = 1 | `010392BTO` = 12 |
| `010393` | CHOCO LATTE DE LECHE 12X12UNDX32G | `010393UND` = 1 | `010393BTO` = 12 |

### Pedido creado

| Dato | Valor |
|---|---|
| **Nro. Ref (= `id_order`)** | **`620`** |
| `co_order` | **`1789153279724.0`** |
| Comentario marca (oráculo de nube) | **`QA-NUBASE-20260911-A`** |
| Cliente | `1976` — ABASTOS BRISAS DEL VALLE 95 (sin deuda vencida) |
| Vendedor | `R013` / `id_user = 4` · empresa `INSUM_A` |
| Moneda / lista base | `US$` · lista `01` «Precio Unidad» · tasa 785,07 |
| Total | **244,2612 US$** |
| **Acuse del SERVIDOR (3.ª alerta)** | **«Pedido nro. 620 enviado exitosamente»** |
| Estado local | `st_delivery = 1` (enviado) · `id_order = 620` |
| Cola de salida | `pending_transactions` = **0** · `failed_transactions` = **0** |
| Duplicados en nube | `count(*) = 1`, `count(DISTINCT co_order) = 1` |

> Se esperó la **3.ª alerta** (§10 del RUNTIME): las dos primeras son locales y salen iguales aunque el POST
> falle. **Guardar no es enviar — acá hubo acuse de servidor y fila en la nube.**

### 🔎 Evidencia para el ticket — `id_order_detail_unit`

| `id_order_detail_unit` | `id_order_detail` | `co_product_unit` | Unidad |
|---|---|---|---|
| **`5787`** | 5786 | `010362UND` | UND |
| **`5788`** | 5787 | `010392BTO` | BTO |

### Cotejo en las TRES capas

**Línea 1 — UND (`qu_unit = 1`), cantidad 3**

| Capa | `qu_order` | `nu_base` | `nu_base_total` |
|---|---|---|---|
| **Modelo Angular** (`orderServ.carrito`) | `quAmount 3` · `idUnit 4` (UND) | `nuPrice 16,5532` | `subtotal 49,6596` |
| **BD local del equipo** (`order_detail_units`) | `3` | **`16,5532`** | **`49,6596`** |
| **Nube** (`order_detail_unit` id 5787) | `3,0000` | **`16,5532`** | **`49,6596`** |

**Línea 2 — BTO (`qu_unit = 12`), cantidad 2**

| Capa | `qu_order` | `nu_base` | `nu_base_total` |
|---|---|---|---|
| **Modelo Angular** (`orderServ.carrito`) | `quAmount 2` · `idUnit 1` (BTO) | `nuPrice 8,1084` (×12) | `subtotal 194,6016` |
| **BD local del equipo** (`order_detail_units`) | `2` | **`97,3008`** | **`194,6016`** |
| **Nube** (`order_detail_unit` id 5788) | `2,0000` | **`97,3008`** | **`194,6016`** |

### Verificación de las tres condiciones

Aritmética hecha **por la propia base** (no a mano), con join por `id_price_list` de la fila:

| `id_order_detail_unit` | `qu_unit` | `precio` | `nu_base` | `qu_unit × precio` | **Δ base** | `nu_base_total` | `nu_base × qu_order` | **Δ total** |
|---|---|---|---|---|---|---|---|---|
| 5787 `010362UND` | 1 | 16,5532 | 16,5532 | 16,55320000 | **0,00000000** | 49,6596 | 49,65960000 | **0,00000000** |
| 5788 `010392BTO` | 12 | 8,1084 | 97,3008 | 97,30080000 | **0,00000000** | 194,6016 | 194,60160000 | **0,00000000** |

| Condición pedida | Resultado |
|---|---|
| `nu_base` **no llega nulo** | ✅ **PASS** — poblado en local **y** en nube, en las dos líneas |
| `nu_base_total` = `nu_base × qu_order` **con tolerancia 0** | ✅ **PASS** — Δ = `0,00000000` en ambas líneas |
| En BTO, `nu_base` es **doce veces el precio** | ✅ **PASS** — `97,3008 = 12 × 8,1084`, exacto |

Cierre aritmético del pedido: `49,6596 + 194,6016 = 244,2612` = `order.nu_amount_total` en la nube ✅

---

## 🔴 Hallazgo de método para el ticket — cuál es «el precio» de la fórmula

**El `precio` de `nu_base = qu_unit × precio` es el `nu_price` de la lista que quedó aplicada A ESA LÍNEA
(`order_detail_unit.id_price_list`), NO el de la lista por defecto del pedido.**

En INSUMAR cada unidad tiene su propia lista de precios:

| Producto | Lista `01` «Precio Unidad» (→ UND) | Lista `02` «Precio Empaque» (→ BTO) |
|---|---|---|
| `010362` | 16,5532 | 17,0752 |
| `010392` | **7,8648** | **8,1084** |

Si desarrollo coteja el BTO contra el precio de la lista `01` obtiene `12 × 7,8648 = 94,3776 ≠ 97,3008` y
**parecería un defecto que no lo es**. El cotejo correcto es:

```sql
SELECT u.id_order_detail_unit, u.nu_base, pu.qu_unit * pl.nu_price AS esperado
FROM order_detail_unit u
JOIN product_unit pu ON pu.id_product_unit = u.id_product_unit
JOIN price_list   pl ON pl.id_price_list   = u.id_price_list   -- <- la lista DE LA FILA
WHERE u.id_order_detail_unit IN (5787, 5788);
```

**Cómo se elige la unidad en la UI de este build (v6.6.21.3):** el `ion-select` «Unidad» del panel del
producto llega **`disabled`** y no se toca. La unidad la gobierna el `ion-select` **«Lista de Precio»**
(`Precio Unidad - UNIDADES` / `Precio Empaque - BULTO`). Al cambiarlo, el select Unidad conmuta solo
UND↔BTO, el inventario se divide por 12 (23,00 → 1,92) y el badge del ítem pasa a contar unidades base
(2 BTO → «24»).

---

## 🟡 Observación menor — pedir confirmación a mano

`orderServ.totalUnidad` (el agregado «Total por unidad» del formulario) devolvió **las dos entradas
rotuladas con `coProduct: "010362"`**, incluida la del BTO, que en realidad corresponde a `010392`:

```
[{coProductUnit:"010362BTO", coProduct:"010362", quAmount:2},    <- la cantidad es la de 010392
 {coProductUnit:"010362UND", coProduct:"010362", quAmount:3}]
```

**No se propagó a ninguna capa persistida**: tanto la BD local como la nube guardaron `010392BTO` correcto,
y los montos cuadran. Parece una etiqueta interna del agregado por unidad sin efecto sobre el dato.
**Podría ser mi método** (cambié la lista de precios de la línea 2 después de expandirla). **No lo reporto
como defecto**: pido que se mire a mano si la pantalla «Total por unidad» rotula bien el código de producto
cuando hay dos productos con unidades distintas.

---

## Lo que NO se pudo comprobar

| Punto | Motivo |
|---|---|
| **No reproduje el `589,85`** | Al conectarme, el equipo ya mostraba el valor nuevo. Certifico que **después** de sincronizar muestra 15.664,27; **no** puedo certificar de primera mano que antes mostrara 589,85. |
| **Los dos campos poblados a la vez** | Ningún usuario probado tenía pedidos **y** facturas en el mes: R003 solo pedidos, R013 solo facturas. **`R016` sí tiene ambos** (136 pedidos / 19.708,83 y 127 facturas / 18.152,99) y es el caso que probaría que los dos campos conviven sin pisarse. **No se ejecutó** — queda como el siguiente paso natural del punto A. |
| **`nu_base` en un pedido GUARDADO (sin enviar)** | Solo se certificó la ruta Enviar. No se comprobó si el borrador (`order_detail_unit_saved`) también puebla `nu_base`. |
| **`nu_base` en devoluciones / facturas** | Fuera del encargo. `invoice_detail_unit` no se revisó. |
| **Web** | Excluida por indicación expresa (otro agente trabajando ahí). No se abrió. |
| **`nu_base` con descuento o bonificación** | El pedido se hizo sin descuento (`quDiscount 0`) y sin bonificación (`qu_bonified 0`). No se sabe cómo se comporta la fórmula con esos modificadores. |

---

## Casos ejecutados

| ID | Descripción | Resultado | Evidencia |
|----|---|---|---|
| `CERT-SYNC-001` | Re-login completo fuerza bajada de datos nuevos | ✅ PASS | 20 etapas de sync · HOME 23 s · Venta por Pedido 15.664,27 ≠ 589,85 |
| `CERT-VND-A1` | R003: Venta por Pedido vs oráculo SQL | ✅ PASS | app 15.664,27 = BD 15.664,266 (104 pedidos) |
| `CERT-VND-A2` | R003: Venta Facturada = 0 (caso trivial) | ✅ PASS | app 0 = BD sin filas en `invoice` |
| `CERT-VND-A3` | **R013: Venta Facturada con monto real ≠ 0** | ✅ **PASS** | app **27.632,38** = BD 27.632,38 (137 facturas) |
| `CERT-PED-B1` | `nu_base` no nulo en las 3 capas | ✅ PASS | modelo / local / nube poblados · ids 5787, 5788 |
| `CERT-PED-B2` | `nu_base_total = nu_base × qu_order`, tolerancia 0 | ✅ PASS | Δ = 0,00000000 en ambas líneas |
| `CERT-PED-B3` | BTO: `nu_base` = 12 × precio | ✅ PASS | 97,3008 = 12 × 8,1084 exacto |

## Verificación BD

| Registro | Marca | Nube | Local | Guardado → enviado |
|---|---|---|---|---|
| Pedido Ref **620** (`co_order 1789153279724.0`) | **BD-OK** | `id_order 620`, `st_order 1`, 2 líneas, total 244,2612, `tx_comment QA-NUBASE-20260911-A` | `st_delivery 1`, `id_order 620`, fuera de `pending_transactions` | ✅ sí — con acuse explícito del servidor |

## Patrones / selectores nuevos (insumo de consolidación)

| Patrón / selector | Universal o cliente | Detalle |
|---|---|---|
| Alerta de cambio de vendedor en login | universal | «…usuario diferente al previamente ingresado… datos anteriores serán borrados» **NO es rechazo de credenciales**: ACEPTAR completa el login. Un agente que corte ahí descarta un usuario válido |
| Unidad de línea gobernada por «Lista de Precio» | cliente (INSUMAR v6.6.21.3) | el select «Unidad» llega `disabled`; la unidad la fija el select «Lista de Precio» (`Precio Unidad - UNIDADES` / `Precio Empaque - BULTO`) |
| `ion-accordion` de producto sin atributo `value` | universal | `querySelector('ion-accordion[value="X"]')` devuelve `null`; hay que filtrar por **propiedad** `a.value` en JS |
| Árbol de productos = **drill-down** + `ion-accordion` | cliente (v6.6.21.3) | click en `ion-item.listaItems` navega DENTRO; ahí los productos sí son `ion-accordion` con `value = co_product` |
| Botón Enviar = `ion-button.imagenEnviar` | universal | es `ion-button` con clase, **no** un `<img>`; `textContent` vacío ⇒ no localizable por texto |
| Oráculo de `nu_base` | universal | join por **`order_detail_unit.id_price_list`**, no por la lista por defecto del pedido |
| `users` con login duplicado por caja | cliente (insumar) | `R003` (id 13, `co_operation='D'`) vs `r003` (id 22, activa). Filtrar por `id_user` |

---

*Corrida ejecutada con CDP sobre `127.0.0.1:9220`. Solo lecturas en BD (`user_read`). Sin `git commit`,
sin tocar `../src/` ni `../android/`, sin acceso a la web.*
