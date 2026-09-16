# Los 6 REQ de 4K · revisión de escritorio — 14/09/2026

**Qué es esto:** una pasada **solo de base de datos**, sin tocar el equipo ni la web,
hecha mientras corría la validación de moneda y cobros. Sirve para llegar a la corrida
sabiendo **qué se puede cerrar, qué hay que devolver y qué sigue bloqueado**, y para no
gastar tiempo del equipo en averiguar cosas que la BD ya contesta.

**Alcance honesto:** nada de lo de abajo es un PASS. Un PASS exige ver la pantalla.
Lo que hay aquí es **el estado del dato** y qué cambió respecto del 04/09.

| Cliente | `4k` · empresa **DIESE** (`id_enterprise = 1`) · playa **CARIBE** |
|---|---|
| Acceso | `user_read@savia`, solo lectura |
| Base de comparación | `guiones-regresion/guion-req-4k-seis.md` (04/09) |

---

## Resumen: qué se mueve

| # | REQ | Estado el 04/09 | Hoy | Qué cambia |
|---|---|---|---|---|
| 1 | Comentario obligatorio | PASS parcial | **sin novedad** | Faltan los mismos huecos: envío y web |
| 2 | Desactivar actividades | PASS parcial | 🟡 **hay una inconsistencia real que mirar** | Una actividad desactivada con su motivo activo |
| 3 | Zoom de imágenes | ⏸ bloqueado, 0 productos con imagen | 🟡 **medio desbloqueado** | Ya hay 5, pero **ninguna sirve para juzgar el zoom** |
| 4 | Moneda por defecto | ⏸ bloqueado | 🔴 **sigue bloqueado, y hoy no se destrabó** | Los 9 módulos tienen conversión **encendida** |
| 5 | HTML en descripciones | PASS parcial | 🟢 **desbloqueado del todo** | El dato de sanitización ya está sembrado |
| 6 | Estatus en depósitos | ⏸ a re-medir | 🟢 **el ① corregido · el ② se cierra** | El ② era configuración mal puesta (ya arreglada el 14/09) y diseño. Queda **un solo caso** por ver en pantalla |

---

## REQ 6 · Estatus en depósitos — lo más sustancioso

El 04/09 se reportaron **dos fallos encadenados**. Hoy la BD dice que **uno se arregló y
el otro no**, y conviene separarlos en el ticket porque tienen dueños distintos.

### ✅ Fallo ① — CORREGIDO: la web ya toca la fila del depósito

Era el bloqueante: la web creaba la fila en `transaction_statuses` pero dejaba
`deposit.st_deposit` y `deposit.da_update` intactos, así que el móvil no tenía **por dónde
enterarse**. Hoy ya no:

| Depósito | Estatus asignado | Asignado a las | `da_update` del depósito | `st_deposit` |
|---|---|---|---|---|
| 38 | Recaudado | 21:41:14,103 | **21:41:13,952** | **1** |
| 39 | Recaudado | 21:43:45,468 | **21:43:45,290** | **1** |
| 40 | Validación | 21:49:02,353 | **21:49:02,202** | **1** |
| 41 | Validación | 21:52:21,227 | **21:52:21,109** | **1** |

El `da_update` se refresca **150 ms antes** de la fila de estatus: es la misma transacción.
Contrastar con la evidencia del 04/09, donde el `da_update` iba **7 horas atrasado**.

⇒ **Esto se puede dar por corregido en la capa del dato.** Falta el último tramo: sincronizar
el móvil y ver el estatus nuevo en pantalla (R6-14). **Eso es de la corrida, no de aquí.**

### ✅ Fallo ② — era configuración, y queda cerrado

`st_deposit` no guarda **qué** estatus tiene el depósito: guarda su `status_action`. Sobre ese
hecho se apoyaba el fallo ② reportado el 04/09 («Pendiente no se distingue de Por Aprobar»).

**El 14/09 QA corrigió la configuración de los dos módulos**, y con eso Cobros y Depósitos
quedan **estructuralmente idénticos** — que es exactamente lo que el REQ pedía replicar:

| `status_action` | **Cobros** | **Depósitos** | ¿Editable? |
|---|---|---|---|
| **1** | Aprobado (`0001`) | Recaudado (`t02`) | sí |
| **2** | Rechazado (`0002`) | **Validación** (`t01`) ← corregido el 14/09 | sí |
| **3** | Pendiente (`0003`) | Pendiente (`t03`) | sí |
| 3 | Por Aprobar (`pap`) | Por Aprobar (`pap`) | no |
| 3 | Enviado (`env`) | Enviado (`env`) | no |

#### Por qué compartir la acción 3 NO es un defecto

Lo explicó QA, y el dato lo confirma: **`status_action` no es la identidad del estatus, es la
decisión que se tomó** — 1 positiva, 2 negativa, **3 «todavía nadie decidió»**.

**Por Aprobar** es el valor por defecto con el que nace un depósito al enviarse; solo cuando
alguien lo procesa en la web pasa a uno de los **tres** estatus del catálogo. Así que
«Por Aprobar», «Enviado» y «Pendiente» significan lo mismo para el vendedor, y que el equipo
no note el paso de uno a otro **es el comportamiento correcto: no se decidió nada**.

**El argumento que lo cierra:** Cobros se comporta **exactamente igual**, y Cobros es el
módulo de referencia que el REQ pedía replicar. Si allá es aceptable, acá también.

⇒ **El ticket del 04/09 —depósito ref 23, de «Por Aprobar» a «Pendiente» sin cambio en el
móvil— se CIERRA, no se devuelve.** Y las dos observaciones que este informe había levantado
al respecto (Validación ≡ Recaudado, y Pendiente ≡ Por Aprobar) **quedan retiradas**: la
primera era configuración y ya se arregló; la segunda es diseño.

#### Lo único que queda por medir de REQ 6

**Asignar Validación (acción 2) y Recaudado (acción 1) y comprobar que SÍ llegan al equipo.**
Esos sí son decisiones, y por tanto sí deben verse. Es el **R6-15** del guión, que ya advertía
«empezar por aquí porque separa las dos causas» — y visto lo de arriba, es que **era la única
causa que quedaba**.

Con el fallo ① corregido en la capa del dato, esto es un solo caso de pantalla.

### Residuo a limpiar

`id_status 18` (`t3`, «Pendiente») está en `co_operation = 'D'` — borrado lógico, duplicado
del 19 (`t03`). No molesta, pero **explica por qué hay dos «Pendiente»** si alguien consulta
la tabla en crudo y se lleva un susto.

---

## REQ 3 · Zoom de imágenes — medio desbloqueado, y la mitad que falta es la que importa

El 04/09 había **0** productos con imagen. Hoy hay **5 de 1.619**. Pero al mirarlas:

| Producto | Qué es realmente |
|---|---|
| `4405-0050` · `-0051` · `-0052` · `-0053` | **El mismo SVG**, idéntico en los cuatro — un icono genérico de 100×100 |
| `1R1807-4K` | Un PNG **de 1×1 píxel**, transparente |

**Lo que esto permite y lo que no:**

- ✅ Se puede probar **el mecanismo**: que el tap abra el zoom, que responda al gesto, que
  cierre sin dejar la pantalla bloqueada, que funcione igual desde Pedidos (R3-01 a R3-06).
- 🔴 **No se puede juzgar la calidad del zoom.** Un SVG es vectorial: **amplía perfecto
  siempre**, aunque el zoom no esté haciendo nada. Daría **PASS aunque estuviera roto**.
- 🔴 **R3-07** (imagen muy grande / muy pequeña sin deformar) no tiene con qué. El PNG de
  1×1 es el extremo inferior y está bien como caso borde, pero falta el superior.

⇒ **Lo que hay que pedir: una foto real de producto, JPG o PNG grande** (un par de miles de
píxeles). Con eso R3 se cierra entero. Sin eso se puede correr, pero **hay que escribir en el
informe que el PASS del zoom es débil**, porque el caso de prueba no puede fallar.

---

## REQ 4 · Moneda por defecto — sigue bloqueado, y hoy NO se destrabó

El REQ es un defecto con una precondición muy concreta: **moneda fuerte y SIN conversión**.
Estado de los nueve módulos hoy en `currency_modules`:

| Módulo | Moneda por defecto | **Conversión** | Selector |
|---|---|---|---|
| 1 Visitas · 2 Inventarios · 4 Devoluciones · 6 Depósitos · 7 Vendedores | Local (Bs) | **SÍ** | solo Depósitos |
| 3 Pedidos · 5 Cobros · 8 Productos · 9 Clientes | Fuerte (USD) | **SÍ** | solo Cobros |

🔴 **`show_conversion = true` en los nueve, sin una sola excepción.**

⇒ La configuración que se puso hoy cambia la moneda por defecto y los selectores, pero
**no apaga la conversión en ningún sitio**, que es justamente la condición del defecto.
**REQ 4 no se puede medir con esta configuración**, y conviene decirlo antes de que la
corrida de moneda se confunda con él: **son dos cosas distintas**.

Para destrabarlo hace falta **dejar un módulo con moneda fuerte y conversión en NO** — el
candidato natural es **Clientes o Pedidos**, que son donde el defecto se reportó. Es un
cambio de un clic, pero **hay que decidirlo**, porque toca la configuración del tenant.

**Dato para desarrollo, que preguntó «si hay una sola moneda, ¿por qué salen dos?»:** hoy no
hay ningún módulo con una sola moneda. La pregunta sigue sin poder contestarse.

---

## REQ 5 · HTML en descripciones — desbloqueado del todo

Los casos que faltaban (R5-04, R5-07, R5-08) **ya tienen el dato sembrado**. El cliente
**`C.1009` · COMERCIALIZADORA KABA 2020** trae, en un solo campo, todo lo que hace falta:

| Qué trae | Qué caso cubre |
|---|---|
| `<b>` **sin cerrar** que arrastra el resto | **R5-07** — que no descuadre la pantalla |
| `<script>alert("x")</script>` | 🔴 **R5-08** — la sanitización. El de más riesgo |
| `<span style="color:red">` | Estilo inline: ¿se respeta o se limpia? |
| `&amp;`, `&nbsp;`, `&lt;b&gt;` | Entidades: deben verse como texto, no como etiqueta |
| `<ul><li>` y `<a href="…">` | Etiquetas de bloque y enlace — **¿el enlace es pulsable?** |
| Acentos y emoji 🚚✅ | Codificación |
| `tx_description_2` con **saltos reales**, sin HTML | **R5-06** — control |

Y hay controles limpios para contrastar: `C.0010` (HTML simple y correcto), `C.0307` (HTML
largo y bien formado, 10 productos), `C.0958` (`<p></p>` vacío y un campo de solo espacios —
**buen caso para R5-05**, que no deje un hueco).

⇒ **REQ 5 se puede cerrar en la próxima corrida**, sin preparar nada. Solo falta conmutar
`htmlClientDescription` a `false` y volver a entrar, para R5-04.

---

## REQ 2 · Desactivar actividades — una inconsistencia concreta que mirar

La cascada **funciona** en los casos de QA: `QAACTR2` y `QAACTIVIDADPRUEBA0309` están
desactivadas y **sus motivos también** (0 activos de 2). Igual `FueraRutas`.

🟡 **Pero hay una excepción:**

| Actividad | `active` | Motivos | Motivos activos |
|---|---|---|---|
| `VISITASINACCION` (id 88) | **false** | 1 | **1** ← activo |

Una actividad desactivada cuyo motivo sigue activo. Puede ser residuo anterior al REQ, o
puede ser que la cascada no corriera esa vez. **Se resuelve en un minuto** en la corrida:
si al reactivarla el motivo se queda como está, es residuo; si el listado de la web la
muestra inconsistente, es hallazgo.

Y es además **el caso ideal para R2-12**, el hueco más importante que quedó: al reactivar,
¿vuelven los motivos? Con `QAACTR2` (desactivada, 0 motivos activos, y uno de ellos con
`required_comment`) se puede comprobar de paso **R2-05**: que la exigencia de comentario
**se conservó** al desactivar. La BD dice que **sí se conservó** — el motivo con
`required_comment` sigue ahí con la actividad apagada. Eso ya es medio caso cerrado.

---

## REQ 1 · Comentario obligatorio — sin novedad

El dato sigue puesto (`ACTQA1`, activa, 2 motivos activos, **1 con `required_comment`**), o
sea que el escenario **y su control** siguen montados y no hay que volver a crearlos.

Los huecos son los mismos del 04/09 y **todos exigen equipo**: R1-09/R1-10 (cambiar de motivo
sin cerrar el modal), R1-11 (el límite de 120), y R1-12 a R1-14 (persistencia, **envío** y
cotejo en la web). Nada de eso se contesta desde la BD.

---

## Qué se puede cerrar, qué se devuelve y qué se pide

### Se puede cerrar en la próxima corrida, sin preparar nada

- **REQ 5** — el dato está completo, incluida la sanitización.
- **REQ 2** — solo falta reactivar y mirar; R2-05 ya se sostiene desde la BD.
- **REQ 1** — el escenario sigue montado; es correr, enviar y cotejar.

### Se cierra, no se devuelve

- **REQ 6 · el ticket del 04/09** (Por Aprobar → Pendiente sin cambio en el móvil).
  Era **configuración mal puesta** en un caso y **diseño** en el otro. Los dos módulos
  quedaron alineados el 14/09 y Cobros —el módulo de referencia— se comporta igual.
  **Nada que devolver a desarrollo por este REQ.**

### Nada pendiente de desarrollo en esta revisión

Los dos hallazgos que este informe llegó a levantar sobre REQ 6 **se retiraron**, uno por
configuración y otro por diseño. Ver la sección del REQ 6 para el detalle de por qué.

### Hace falta pedir algo antes de poder medir

| REQ | Qué se pide | A quién |
|---|---|---|
| **3** | Una **imagen real de producto**, raster y grande. Las 5 que hay son 4 SVG idénticos y un PNG de 1×1 | Implementación / datos |
| **4** | Dejar **un módulo con moneda fuerte y conversión en NO**. Hoy los 9 la tienen en SÍ | Decisión de QA — toca la config del tenant |

### Lo que NO contesta esta revisión

Todo lo que exige pantalla: que el móvil **muestre** el estatus nuevo del depósito (R6-14),
que el zoom **abra**, que el HTML **se pinte** sin ejecutar el script, que el motivo exija
el comentario. La BD dice qué dato hay; **no dice qué se ve**.

---

## Consultas usadas

Todas de solo lectura sobre `4k`, `id_enterprise = 1`.

```sql
-- REQ 6 · el catálogo de estatus de depósitos y sus acciones
SELECT id_status, co_status, na_status, status_action,
       editable, required_comment, co_operation
FROM   statuses
WHERE  id_enterprise = 1 AND co_transaction_type = 'dep'
ORDER  BY status_action, id_status;
-- Cambiar 'dep' por 'cob' para el contraste con Cobros.
-- Dos filas con el mismo status_action = dos estatus que el equipo no puede distinguir.

-- REQ 6 · ¿la web toca la fila del depósito al asignar estatus?
SELECT ts.id_transaction_statuses AS id, s.na_status, s.status_action,
       ts.id_transaction AS id_dep, ts.na_status_user,
       ts.da_transaction_statuses AS asignado,
       d.st_deposit, d.da_update
FROM   transaction_statuses ts
JOIN   statuses s ON s.id_status = ts.id_status
LEFT   JOIN deposit d ON d.id_deposit = ts.id_transaction
WHERE  ts.co_transaction_type = 'dep'
ORDER  BY ts.id_transaction_statuses DESC LIMIT 12;

-- REQ 3 · cuántos productos tienen imagen, y cuál es
SELECT count(*) AS total,
       count(*) FILTER (WHERE image IS NOT NULL AND image <> '') AS con_imagen
FROM   product WHERE id_enterprise = 1;

SELECT co_product, na_product, left(image, 60) AS cabecera
FROM   product
WHERE  id_enterprise = 1 AND image IS NOT NULL AND image <> '';

-- REQ 4 · la configuración de moneda por módulo
SELECT id_module, local_currency_default, show_conversion,
       currency_selector, co_operation, da_update
FROM   currency_modules ORDER BY id_module;

-- REQ 5 · clientes con HTML sembrado
SELECT id_client, co_client, na_client, tx_description_1, tx_description_2
FROM   client
WHERE  id_enterprise = 1
  AND  (tx_description_1 ILIKE '%<%' OR tx_description_2 ILIKE '%<%');

-- REQ 1 y 2 · actividades, motivos y la cascada
SELECT t.id_type, t.na_type, t.active AS act, t.required_event,
       count(m.*) AS motivos,
       count(*) FILTER (WHERE m.active)           AS mot_act,
       count(*) FILTER (WHERE m.required_comment) AS mot_coment
FROM   incidence_type t
LEFT   JOIN incidence_motive m ON m.id_type = t.id_type
GROUP  BY 1,2,3,4
ORDER  BY t.id_type DESC;
```
