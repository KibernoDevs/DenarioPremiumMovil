# Aviso de saldo a favor al cobrar con N/C — IMPORTADORA 4K
## Plan de los 4 casos + baseline de la nube

> ✅ **SUPERADO — la corrida SÍ se ejecutó después.** Los resultados están en
> **`01-alerta-ncr.md`**, que es el entregable. Este documento se conserva por el **baseline**
> (el corte `max(id_collection) = 2765` y los saldos de los cuatro documentos antes de tocar
> nada), que es lo que permite demostrar qué creó la prueba.
>
> 🔴 **Dos partes del plan quedaron corregidas por el coordinador y NO se siguieron:**
> 1. **§4.1 proponía `V.0017zonaoccidente` para el caso C. Es incorrecto:** V.0017 es el
>    **PROMOTOR** (rol 9) y **no ve el módulo Cobros**. C.1015 y C.0822 no son alcanzables por
>    esa vía.
> 2. **No hizo falta un tercer cliente:** los casos **A y C salen del MISMO cobro** de `C.0321`
>    — se monta, se observa el aviso (A), se guarda, se reabre y se vuelve a observar (C).
>
> El resto del plan —orden, oráculos, trampas— se siguió tal cual, y las consultas de la §5 son
> las que se usaron.

| Parámetro | Valor |
|---|---|
| RUN_ID | `alerta_ncr_20260915` |
| Fecha | 2026-09-15 |
| Cliente / empresa | **4k** · `DIESE` · GRUPO 4K · RIF J401702600 — empresa única |
| Playa declarada | **CARIBE** (no re-medida en runtime: el equipo no se tocó) |
| Vendedor de los dos clientes de prueba | **`V.0030zgrancaracas`** · JOAN BRICEÑO · `id_user` **338** |
| CDP | `http://127.0.0.1:9220` — respondía (`Chrome/152.0.7977.87`, `com.kiberno.denarioPremiumPro`) |
| Estado | 🔴 **PARADA POR EL COORDINADOR.** QA entró al teléfono a mano con el mismo usuario. Ningún caso se ejecutó. |

---

## 0 · ⛔ Por qué no hay medición de la app

El coordinador ordenó parar **antes de conducir nada**. Lo único que llegó a tocar el
dispositivo fue **una lectura del DOM** (`node drv.js s_alert.js`), que no hace clic, no
teclea y no navega.

**El equipo quedó exactamente como estaba: en la pantalla de LOGIN (`app-login` visible),
sin sesión iniciada.** No había ningún cobro empezado, ni guardado, ni a medias. QA no se
va a encontrar nada montado por esta corrida.

> Las `ion-alert` que se leyeron en esa sonda son **cadáveres del DOM** (`overlay-hidden`),
> todas «Usuario y/o contraseña incorrectos» de sesiones anteriores. No son de esta corrida.

Todo lo que sigue se midió **solo por consulta a la base**, sin tocar el teléfono.

---

## 1 · Baseline de la nube — ANTES de cualquier cobro

### 1.1 · Contador de referencias

```
max(id_collection) = 2765        ·  total de filas en `collection` = 2639
```

⇒ **Toda referencia creada por esta prueba será ≥ 2766.** Es el corte limpio para separar
lo nuestro de lo que había.

### 1.2 · Los cuatro documentos de prueba (`document_sale`, `co_operation='I'`)

| Cliente | `id_document_sale` | Documento | Tipo | Moneda | `nu_amount_total` | **`nu_balance`** | `co_collection` | `da_update` |
|---|---|---|---|---|---|---|---|---|
| **C.0321** | 74634 | `00021022` | **FAC** | USD | 1.484,0000 | **+85,0000** | NULL | 2026-08-19T13:20:42.793Z |
| **C.0321** | 76259 | `00002222` | **N/C** | USD | 145,0000 | **−145,0000** | NULL | 2026-08-19T13:20:42.667Z |
| **C.0864** | 76965 | `00022180` | **FAC** | USD | 2.552,0000 | **+2.552,0000** | NULL | 2026-08-19T13:20:42.992Z |
| **C.0864** | 76791 | `*0001523` | **N/C** | USD | 244,0000 | **−244,0000** | NULL | 2026-08-19T13:20:42.667Z |

🔑 **Ojo con la factura de C.0321: su `nu_amount_total` es 1.484,00, no 85,00.** Los 85,00
del encargo son el **saldo** (`nu_balance`), que es lo que cobra la app. La aritmética del
caso A sale del saldo: **145,00 − 85,00 = 60,00 de excedente.** ✅

⚠ Recordatorio de la corrida del 14/09: **`document_sale` no es el inventario de documentos
libres.** `co_collection` está en NULL en toda la base aunque el documento esté comprometido.
El único inventario fiable es el propio **Tab Documentos** de la app.

### 1.3 · ✅ Los cuatro documentos SÍ están libres — y se puede demostrar

Los cuatro fueron consumidos ayer y **todos los cobros que los retenían están RECHAZADOS**
(`statuses`: `co_status='0002'` = **«Rechazado»**), lo que los devuelve al Tab Documentos:

| Ref | Cliente | Tipo | Importe | Documentos que retenía | Rechazado por | Cuándo |
|---|---|---|---|---|---|---|
| 2708 | C.0864 | cobro | 0,00 | `00022180` (parcial 100,00) + `*0001523` | admin admin | **2026-09-15 13:37** |
| 2709 | C.0864 | **anticipo** | **144,00** | — | admin admin | **2026-09-15 13:46** |
| 2710 | C.0321 | cobro | 0,00 | `00021022` + `00002222` | admin admin | 2026-09-14 20:22 |
| 2711 | C.0321 | **anticipo** | **60,00** | — | admin admin | 2026-09-14 20:21 |
| 2712 | C.0321 | cobro | 0,00 | `00021022` + `00002222` | admin admin | 2026-09-14 20:42 |
| 2713 | C.0321 | **anticipo** | **60,00** | — | admin admin | 2026-09-14 20:41 |

⇒ La afirmación del encargo («ya verificados como libres») **queda respaldada por la base**:
la liberación de C.0864 es de **hoy a las 13:37/13:46 UTC**. Aun así, **confirmar en el Tab
Documentos antes de medir** — es la regla de la casa y la base ya mintió en este punto.

📌 **Dato regalado por el baseline:** el excedente de **60,00** de C.0321 **ya se produjo dos
veces ayer** (anticipos 2711 y 2713, ambos por 60,0000 USD exactos). El importe que el aviso
del caso A debe nombrar está confirmado de antemano.

---

## 2 · 🔑 La etiqueta del texto — medido en la base, no en el teléfono

```sql
SELECT co_application_tag, tag FROM application_tags
 WHERE co_application_tag LIKE '%PREPAID%' ...
```

| Etiqueta | ¿Existe en 4K? | Texto del catálogo |
|---|---|---|
| `COB_MSG_NCR_CREDIT_PREPAID` | ❌ **NO** (873 etiquetas activas, 13 módulos; no está) | — |
| `COB_MSG_AUTOMATED_PREPAID` | ✅ sí | «Se creará un anticipo automático por el monto excedente de **{amount}**. Se enviará un anticipo junto al cobro.» |

**Confirmado el punto 1 del encargo:** el aviso de N/C saldrá con el **texto de fábrica del
bundle**, no con una redacción del cliente. Hay que decirlo en el informe.

🔑 **Y hay un matiz que el encargo no anticipa, y que cambia lo que se debe comprobar:**
el texto que 4K **sí** tiene personalizado (`COB_MSG_AUTOMATED_PREPAID`, el del camino del
excedente) lleva **`{amount}` pero NO `{currency}`**. La plantilla por defecto del bundle para
la N/C lleva **los dos**. ⇒ Los dos caminos **no comparten marcadores**, así que en el caso A
hay que verificar la sustitución de **`{currency}` Y `{amount}`**, y en el contraste del
excedente solo la de `{amount}`. Es justo el terreno donde vivía **D-02**.

📌 La alerta del **descuento que supera el saldo** («El descuento supera el saldo del
documento. ¿Desea crear un anticipo automático por USD 44,00?») **tampoco está en
`application_tags`** ⇒ también es texto de fábrica del bundle. Los dos lados del contraste
del caso D son, entonces, redacción de producto: la comparación es limpia.

---

## 3 · Plan de los cuatro casos

### Orden de ejecución y por qué

**D → A → B → C.** El caso **D** (descuento) va **primero** y sobre un cliente de relevo,
no sobre C.0321 ni C.0864: es el único que no depende de la pareja FAC+N/C, y ejecutarlo
antes deja la alerta de referencia copiada **antes** de gastar los documentos escasos. **A**
y **B** consumen cada uno su pareja. **C** va al final porque necesita una tercera pareja
con saldo a favor, que **hoy no existe** (ver §4).

### A · El aviso aparece y dice el monto — `C.0321`

1. Login `V.0030zgrancaracas` (el equipo está en `/login`; el vendedor de C.0321 es el 338).
2. Cobro nuevo → `#clienteSelectModal.present()` → buscar **por código** `C.0321` → clic en el `<p>`.
3. Tab Documentos → marcar **primero `FAC 00021022`** (localizar por `nu_document`, **nunca por
   posición**: la N/C `00002222` ordena antes y dispara la guarda del documento negativo).
4. Marcar después `N/C 00002222`.
5. **Observar y fechar el aviso en los tres momentos:** al marcar la N/C · al salir del detalle ·
   al pulsar Enviar.
6. Copiar el texto **literal** y la lista de botones (`[...a.querySelectorAll('button')]`).
7. Método **Otros** + código `test_excedente` + «Especifique» (sin esto no se puede enviar).
8. Enviar. Oráculo: cobro `co_type=0` + anticipo `co_type=1` por **60,00**.

**Lo que decide el caso** — tres lecturas, no una:

| Pregunta | Cómo se mide | Criterio |
|---|---|---|
| ¿Sale? | `ion-alert` **sin** `overlay-hidden` | presente ≠ visible |
| ¿Dice 60,00 y la moneda? | texto literal | ❌ si aparece `{amount}` o `{currency}` sin sustituir (**D-02**) |
| ¿Aviso o confirmación? | **nº de botones** | 1 botón (Aceptar/OK) = aviso ✅ · 2 botones (Cancelar+Aceptar) = confirmación ❌ **es lo que QA pidió que NO fuera** |

Si trae **Cancelar**, hay que pulsarlo y contar qué pasa: ¿deselecciona la N/C? ¿deja el cobro
intacto? ¿sigue generando el anticipo igual? Un «Cancelar» que no cancela nada es defecto por
sí solo.

### B · Que salga **cada vez** — `C.0864`, **sin reiniciar la app**

Segundo cobro con saldo a favor **en la misma sesión**, inmediatamente después de A.
`FAC 00022180` con **pago parcial 100,00** (toggle dentro de la lupa → `#eventModal`; al
encenderlo «Monto a pagar» se resetea a 0,00 y el campo es **centavos-acumulativo**: teclear
`10000`) + `N/C *0001523` ⇒ excedente **144,00**.

**Criterio:** el aviso vuelve a salir **y dice 144,00** (no 60,00 —un monto pegado del caso
anterior sería un defecto distinto y peor). Si no sale, el comentario del código («cada vez…,
no una sola vez por sesión») **no se cumple** y es FAIL directo del fix.

### C · 🔑 El cobro reabierto desde Guardado

La guarda `shouldShowCreditBalancePrepaidInformMessage()` **excluye `recentOpenCollect`**, así
que el aviso **no debería salir**. Montar: cobro con saldo a favor → **GUARDAR** → salir →
reabrir desde la lista → observar.

**Dos lecturas, no una** — y la segunda es la que importa de verdad:

1. **¿Sale el aviso?** Para poder afirmar «no salió» hay que distinguir **ausente** de
   **presente pero oculta**: contar `ion-alert` **sin** `overlay-hidden`, no contar `ion-alert`.
2. **¿Se genera el anticipo en ese envío?** Es el cruce con **`DM-COB-058`**. Si tampoco se
   genera, **es el mismo agujero por partida doble: ni avisa ni genera**, y eso es lo que hay
   que escalar. Oráculo: fila `co_type=1` en la nube, no la pantalla.

Si no sale, **no cerrarlo como PASS ni como FAIL: preguntar a producto si es intencional.**

### D · Contraste con el camino que ya avisaba

Descuento **mayor que el saldo** en el detalle del documento («ASIGNAR DESCUENTO»).
Copiar la alerta **literal** y sus botones, para comparar tono, formato y comportamiento
frente al aviso del caso A.

**Catálogo de descuentos de 4K (`collect_discounts`, medido):**

| id | Nombre | % | `require_input` |
|---|---|---|---|
| 1 | Probando | **80,00** | false |
| 3 | DESC 10 TEST | **10,00** | false |

⚠ **`maxCollectDiscount` = 0 en el equipo** (el YAML lo advierte). Qué hace la app con un tope
de 0 **hay que leerlo en la UI**, no deducirlo: puede bloquear los dos descuentos y dejar el
caso D sin camino. **Plan B si eso pasa:** el 80 % sobre un documento cuyo `nu_amount_total`
sea muy superior a su `nu_balance` produce descuento > saldo de sobra.

🔑 **Aquí sí es correcto que sea confirmación** (Cancelar = no aplicar el descuento). El
contraste no es «los dos deberían ser iguales», sino **«el de la N/C no tiene nada que decidir
y por eso debe ser aviso»**.

### Trampas que ya están pagadas (de corridas anteriores, no re-medidas hoy)

| # | Trampa | Efecto si se ignora |
|---|---|---|
| T-1 | El **primer clic** sobre el botón de una `ion-alert` cae en el `ION-BACKDROP` | En el acuse del 14/09 hicieron falta **3** intentos. Verificar con `elementFromPoint` |
| T-2 | Las `ion-alert` descartadas **siguen en el DOM** con `overlay-hidden` | Contar elementos NO es medir. **Crítico aquí: el objeto de la prueba ES una alerta** |
| T-3 | La **N/C ordena antes** que la factura en el Tab Documentos | `marcarPrimerDocumento()` cae en la N/C y choca con la guarda del negativo |
| T-4 | El método **«Otros» ya viene MARCADO** en el escenario NCR > FACT | Un guion que «clickee Otros» lo **desmarca**. Leer `checked` antes de tocar |
| T-5 | El **anticipo por saldo a favor no se acusa** al enviar (sí el cobro) | Validar «por la alerta» da **falso negativo** del anticipo. Oráculo = fila en la nube |
| T-6 | «Pago parcial» encendido **oculta «ASIGNAR DESCUENTO»** | Los caminos A/B y D son **excluyentes en la misma pantalla** ⇒ D no se puede montar sobre un documento con parcial |
| T-7 | El selector de cliente **no abre al clic** | `#clienteSelectModal.present()` + buscar **por código** + clic en el `<p>` |
| T-8 | Campo de monto **centavos-acumulativo**; tras teclear, `blur()` + esperar | Medir coordenadas con el teclado abierto mueve el botón |
| T-9 | Nunca `history.back()` con modal abierto; nunca `page.goto` | Rompe el router de Ionic |

---

## 4 · 🔴 Riesgo de datos que hay que resolver ANTES de retomar

**Solo hay DOS parejas FAC+N/C y los casos A, B y C necesitan TRES.**

| Caso | Pareja | Estado |
|---|---|---|
| A | C.0321 (60,00) | ✅ disponible |
| B | C.0864 (144,00) | ✅ disponible |
| C | — | ⚠ **resuelto en §4.1, con una condición** |

Un cobro **enviado** retira sus documentos del Tab Documentos hasta que se apruebe o rechace,
así que A y B **agotan** las dos parejas de las que habla el encargo. Salidas descartadas:

1. ❌ **Montar C primero con la pareja de C.0321** (guardar → salir → reabrir) y enviarlo
   después, para que el mismo envío sirva de caso A. **Contamina A**: el cobro ya sería un
   «reabierto» y `recentOpenCollect` podría tapar justo el aviso que A tiene que medir.
2. ❌ **Rechazar por web** el cobro de A o de B para reciclar la pareja. **Rechazar no está en
   el encargo**, y el informe `liberar_documentos_20260915` quedó bloqueado precisamente por
   esto.

✅ **La salida viable se encontró por consulta y está en §4.1: hay tres parejas más, libres.**

### 4.1 · ✅ Resuelto por consulta: **sí hay relevo para el caso C**

Se barrió la base entera buscando parejas utilizables. **Solo hay DOS parejas donde la N/C
supera por sí sola el saldo de la factura** — y las dos ya están asignadas a A y B:

| Cliente | Factura | Saldo | Nota | Saldo N/C | Excedente directo |
|---|---|---|---|---|---|
| **C.0321** | `00021022` | 85,00 | `00002222` | −145,00 | **60,00** ← caso A |
| C.0616 | `00018156` | **0,11** | `*0001303` | −1,00 | 0,89 |

C.0616 sirve en teoría, pero con un excedente de **0,89 USD** y una factura de 0,11: importes
tan pequeños que **no distinguen un número bien sustituido de uno redondeado a cero**. Mal
testigo para una prueba cuyo objeto es leer una cifra en un texto.

🔑 **La salida buena es la misma que usó B: el PAGO PARCIAL.** Con un parcial cualquiera por
debajo del importe de la N/C, **cualquier** pareja FAC+N/C produce saldo a favor. Con ese
criterio la base da **nueve** clientes con ambas cosas, y estos tres están **totalmente
libres** (cero filas en `collection_detail`, verificado):

| Cliente | Factura (saldo) | Nota | Parcial sugerido | **Excedente** | Vendedor (`user_address_clients`) |
|---|---|---|---|---|---|
| **C.1015** ⭐ | `00022123` · 406,00 | `*0001518` · −20,00 | **1,00** | **19,00** | `V.0017` · id_user **301** |
| **C.1073** | `00022209` · 173,00 | `*0001526` · −12,01 | 2,01 | 10,00 | 🔴 **sin fila** (ver aviso) |
| C.0822 | `00022130` · 335,00 | `*0001503` · −5,00 | 1,00 | 4,00 | `V.0017` · id_user **301** |

⛔ **Descartado: C.0402.** Tiene 5 facturas, pero su única N/C (`*0001498`) está **comprometida
por el cobro 2683**, que sigue en `st_collection=3` (sin rechazar).

🔴 **El coste de esta salida: C.1015 y C.0822 son de `V.0017zonaoccidente` (id_user 301), no de
V.0030.** El caso C exigiría **cerrar sesión y volver a entrar con otro vendedor** (~80 s de
login). Eso **no invalida el caso** —`recentOpenCollect` es estado de pantalla, no del
vendedor— pero **rompe la continuidad de sesión que el caso B necesita**, así que **C tiene que
ir el último**, después de A y B. Es exactamente el orden ya previsto.

> ⚠ **Dos avisos sobre `user_address_clients`, que es de donde sale la columna «Vendedor»:**
> 1. **No es un mapa completo.** `C.0321` y `C.1073` **no tienen fila** en esa tabla y sin
>    embargo C.0321 es demostrablemente de V.0030 (los cobros 2710–2713 de ayer salieron con
>    `id_user=338`). ⇒ La ausencia de fila **no prueba** que el cliente no cargue. **El listado
>    de la app sigue siendo el único inventario fiable**, igual que pasa con los documentos.
> 2. **Su columna `na_user` está desfasada.** Para `id_user=338` dice «ERNESTO HERNANDEZ»,
>    pero `users` dice **JOAN BRICEÑO / `V.0030zgrancaracas`** ✅ (que es lo que afirma el
>    encargo). Es una copia denormalizada vieja: **no usarla para identificar al vendedor.**

👉 **Lo que queda pendiente del coordinador** ya no es «hay o no hay datos» —los hay—, sino
**si se autoriza entrar con un segundo vendedor (`V.0017zonaoccidente`) para el caso C**, o si
se prefiere preparar una tercera pareja dentro de la cartera de V.0030.

---

## 5 · Consultas de oráculo, listas para pegar

Sustituir `<COMENTARIO>` por el comentario testigo del cobro (p. ej. `Test-NCR-A-0321-HHMMSS`).
El comentario es **obligatorio** en 4K (`requiredComment=true`), así que sirve de testigo gratis.

```bash
cd "C:/Users/Personal/OneDrive/Documentos/kiberno/DenarioPremium/DenarioPremiunMovil/qa-piloto-automatizacion"
```

**(a) Cobro + anticipo por comentario testigo — el oráculo principal**
```bash
node automation/db/query.js 4k "SELECT id_collection, co_type, co_client, st_collection, \
nu_amount_total, nu_amount_final, co_currency, tx_comment, id_user, da_collection \
FROM collection WHERE tx_comment = '<COMENTARIO>' ORDER BY id_collection"
```
> ✅ **PASS del caso A** = **dos** filas: `co_type=0` y `co_type=1` con `nu_amount_total = 60.0000`.
> Caso B: `144.0000`. `id_user` debe ser **338**.

**(b) Corte por contador — lo creado por esta corrida, sin depender del comentario**
```bash
node automation/db/query.js 4k "SELECT id_collection, co_type, co_client, st_collection, \
nu_amount_total, tx_comment, id_user, da_collection \
FROM collection WHERE id_collection > 2765 ORDER BY id_collection"
```

**(c) Recuento por tipo — responde «¿se generó el anticipo?» de un vistazo (caso C)**
```bash
node automation/db/query.js 4k "SELECT co_type, count(*) AS filas, sum(nu_amount_total) AS suma \
FROM collection WHERE tx_comment = '<COMENTARIO>' GROUP BY co_type ORDER BY co_type"
```
> 🔑 En el **caso C**, `co_type=1` con **0 filas** confirma que **`DM-COB-058` sigue vivo**.

**(d) Detalle de los documentos aplicados**
```bash
node automation/db/query.js 4k "SELECT cd.id_collection, cd.co_document, cd.nu_amount_doc, \
cd.nu_amount_paid, cd.nu_balance_doc, cd.in_payment_partial \
FROM collection_detail cd JOIN collection c ON c.id_collection = cd.id_collection \
WHERE c.tx_comment = '<COMENTARIO>' ORDER BY cd.id_collection, cd.co_document"
```

**(e) Método de pago y código de diferencia (la trampa de «Otros»)**
```bash
node automation/db/query.js 4k "SELECT cp.id_collection, cp.co_payment_method, cp.nu_amount_partial, \
cp.nu_payment_doc, cp.co_difference_code \
FROM collection_payment cp JOIN collection c ON c.id_collection = cp.id_collection \
WHERE c.tx_comment = '<COMENTARIO>' ORDER BY cp.id_collection"
```

**(f) Estado en la nube — «Por aprobar» tras enviar**
```bash
node automation/db/query.js 4k "SELECT ts.id_transaction, ts.co_status, s.na_status, \
ts.na_status_user, ts.da_transaction_statuses \
FROM transaction_statuses ts LEFT JOIN statuses s ON s.co_status = ts.co_status \
AND s.co_transaction_type = ts.co_transaction_type \
WHERE ts.co_transaction_type = 'cob' AND ts.id_transaction > 2765 \
ORDER BY ts.id_transaction, ts.da_transaction_statuses"
```
> Catálogo medido: `pap`=Por aprobar · `env`=Enviado · `0001`=Aprobado · `0002`=**Rechazado** · `0003`=Pendiente

**(g) Re-contraste de los cuatro documentos (antes/después)**
```bash
node automation/db/query.js 4k "SELECT co_client, nu_document, co_document_sale_type, \
nu_amount_total, nu_balance, co_collection, da_update FROM document_sale \
WHERE co_client IN ('C.0321','C.0864') AND co_operation='I' ORDER BY co_client, nu_document"
```
> ⚠ Se espera que **NO cambie**: el 14/09 quedó comprobado que el cierre del ciclo lo hace el
> ERP aguas abajo, no el envío. Sirve de control negativo, **no de oráculo**.

---

## 6 · Qué NO se hizo

| Punto | Motivo |
|---|---|
| Los cuatro casos A/B/C/D | **Parada del coordinador.** El equipo lo tomó QA a mano |
| Verificar el fix en el bundle vivo | Requiere `fetch` de `main.js` **en el dispositivo**. Se toma como dado del encargo (`main.js`, 5.425.844 caracteres) y se re-medirá al retomar |
| `ws_url` de la playa en runtime | No se tocó el equipo. Se toma **CARIBE** del encargo |
| Anotar en `_escrituras-de-prueba.md` | **No hubo escrituras que anotar.** El archivo no se tocó |

**No se ejecutó SQL de escritura. No se aprobó ni rechazó ningún cobro. No se tocó ninguna
configuración de la web ni ninguna variable global.**
