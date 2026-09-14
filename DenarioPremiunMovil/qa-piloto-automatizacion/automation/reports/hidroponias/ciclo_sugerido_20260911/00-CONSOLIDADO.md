# Ciclo «Pedido Sugerido» · HIDROPONIAS · 11/09/2026

**Rama probada:** `SaveSuggestedOrder`, commit `272ef3c0` · **APK** 6.6.21.x · **Playa** Isla Coche
**Empresa** HIDRO_A · **Usuario** V3 · ROGER MUESES (idUser 469)
**Alcance:** ciclo completo en las **tres capas** — móvil, base de datos y web.

**136 casos: 116 PASS · 8 FAIL · 9 N/A · 1 BLOCKED · 2 omitidos**

| Vuelta | Módulo | Casos |
|---|---|---|
| 1 | Devoluciones | 41 |
| 2 | Inventario y sugerido | 47 |
| 3 | Pedidos | 22 |
| 4 | Web | 31 |

---

## Los dos tickets que se venían a validar

### ✅ Ticket 1 — el sugerido ya no cuenta devoluciones no enviadas

**CORREGIDO.** Los cinco escenarios en verde, y con un centinela vivo que lo seguirá
comprobando en cada corrida.

| Caso | Medido | Si el fix fallara |
|---|---|---|
| Guardada no entra | espinaca **0** · alfalfa **0** | 3 y 7 |
| Enviada resta | espinaca **6** · alfalfa **7** | — |
| **Recién enviada** | **entra** | — |
| Calidad no resta | berro **0** | 5 |
| Guardada + enviada | espinaca **6** | 3, 7 o 10 |

**Cómo lo arreglaron, que no es lo que esperábamos:** no filtrando por `st_delivery`,
sino añadiendo **`id_return <> 0`** a `getReturnsByDistribution`. Como el `id_return` lo
asigna la nube, excluye lo que nunca se envió.

**El caso límite que esa implementación abre, medido:** el id se escribe **dentro del
`.then()` del POST**, antes de que el usuario despache el diálogo de envío — a los 687 ms
valía 0, y en la segunda alerta (3,2 s) ya valía 279. La ventana de riesgo transcurre
íntegra dentro del flujo, donde nadie puede estar generando un sugerido. Confirmado de
punta a punta: 75 s después de enviar, un sugerido nuevo contó la devolución.

⚠ **Resquicio no comprobado:** el fix ata «cuenta» a «la nube asignó id», así que **un
envío sin señal que quede en cola sería legítimo y quedaría fuera**. Hoy ese estado no es
alcanzable (colas en 0). **Exige modo avión y conviene probarlo a mano.**

🔴 **Centinela vivo — no borrar:** la devolución `1789159255271.0`, Distribución, con
`046013ESP001BOL ×−3` y `id_return = 0`. Mientras siga así, ningún sugerido debe contarla.
**Si la espinaca sale con 3 en vez de 6, el fix se rompió.**

### 🟡 Ticket 2 — el pedido invisible en la web

**Corregido a medias, y la mitad que falta es la que tiene el dinero.**

**✅ La mitad del dato: corregida.** Experimento controlado con dos sugerencias, una
subida a la nube y otra no:

| Pedido | Origen | ¿Sugerencia en la nube? | `co_operation` |
|---|---|---|---|
| **178** | sugerencia del cliente 104 | **NO** | **`I`** |
| 179 | sugerencia ref 6 | SÍ | `I` |

El 178 cumplía **exactamente** las dos condiciones que en el ciclo del 09/09 producían el
nulo 7 de 7 — nace de un inventario y su sugerencia no está en la nube — y salió con
`'I'`, resolviendo además su `id_client_stock`. Nulos totales: **3 de 181**, todos
históricos.

**🔴 La mitad del listado: sin tocar.** Con rango 2020–2027, sin filtros y sin paginador,
la web muestra **178 filas** contra **181** de la base. Las que faltan son exactamente:

| Pedido | Fecha | Monto |
|---|---|---|
| 166 | 08/09 | 8.118,50 |
| 175 | 09/09 | 1.223,60 |
| 177 | 10/09 | 30,60 |
| | | **9.372,70 USD invisibles** |

Y se confirma el matiz que aportó QA: **escribiendo la referencia en el buscador, los tres
salen** y su detalle abre completo. ⇒ **El arreglo pendiente es solo la consulta del
listado.** El conjunto está cerrado en 3 y no crece, pero **tampoco se recupera solo**.

**Agravante medido:** los pedidos 175 y 177 **tampoco aparecen en el BUSCAR de la app ni
en la base local del equipo**. El filtro que descarta los nulos no vive solo en la web.

---

## La aritmética, en las tres capas

**Tolerancia 0 en las tres, sin una sola divergencia:**

| Cotejo | Comparaciones | Divergencias |
|---|---:|---:|
| Modelo de la app ↔ oráculo calculado del equipo | **135** | 0 |
| Vista previa ↔ lo guardado | 99 | 0 |
| Nube ↔ equipo | 72 | 0 |
| **Web ↔ móvil** | **88** | 0 |

Los seis casos difíciles se ejercitaron a propósito: **igualdad exacta** (berro: actual 4 =
bruto 4 ⇒ 0), **venta negativa** (espinaca −1, alfalfa −19 ⇒ diaria 0), **cambio x cambio
como único aporte**, **producto sin factura ese día**, **stock 0 con rotación** (⇒ 150) y
**aislamiento por cliente** con contraste.

Dato curioso de la tercera capa: **la web es más fiel que la app** — muestra las ventas
negativas sin clampear.

---

## Lo demás que se certificó

- **El S1 del 08/09 está corregido:** respondiendo SÍ, la sugerencia **llega a la nube**,
  con acuse del servidor y colas en 0. Aquel defecto rechazaba todo y **se llevaba el
  inventario por delante**.
- **Un solo pedido por sugerencia:** PASS. Un pedido por `co_client_stock`, sin duplicados.
- **El auto-send no envía sola** la sugerencia que quedó Pendiente por decisión del usuario.
- **Las líneas del pedido** son exactamente los sugeridos > 0, con los ceros excluidos.
- **Un pedido normal** no queda ligado a ninguna sugerencia.

---

## Defectos abiertos

| # | Sev | Qué |
|---|---|---|
| **W1** | **S1** | El listado web no muestra los pedidos con `co_operation` nulo — 9.372,70 USD invisibles. El dato ya no se genera mal; falta la consulta |
| **H-huérfana** | **S2** | Una sugerencia sobrevive al inventario que la generó, **se convierte en pedido y el servidor lo acepta**. Pedido 181: 245,70 USD en la nube apuntando a un inventario inexistente |
| **Form. contaminado** | S3 | 1 de cada 5 veces, pulsar PEDIDO tras enviar abre el formulario con el `coOrder` del anterior y Enviar habilitado. **Disparador sin identificar** |
| **DM-SUG-063** | S3 | Al reabrir una sugerencia consumida, ACEPTAR llega deshabilitado pero la pantalla **no dice por qué** ni menciona el pedido que la consumió |
| **W2** | S3 | El mismo número sale `2,560` en el detalle de la sugerencia y `2.560` en el del pedido — dos pantallas del mismo flujo con formatos opuestos |
| **Alerta truncada** | S3 | «La cantidad a devolver debe estar entre 1 y» — sin el tope, e idéntica para los cuatro rechazos |
| **Guardar sin validar** | S3 | «Guardar» acepta cantidades negativas en devoluciones. **Baja de S2 a S3**: el fix del ticket 1 lo neutraliza para el sugerido |

**La huérfana, en detalle.** La web **no se rompe: lo disfraza.** No pinta una referencia
vacía ni rota — el bloque «Inventario relacionado» **ni se renderiza**, porque lee
`id_client_stock` (NULL) y nunca el `co_client_stock` colgado. El pedido 181 queda
**indistinguible de uno tecleado a mano**. Contraste: 179→`Ref. 275`, 178→`Ref. 276`,
180 y 181→nada.

---

## 🔴 Lo que NO se pudo probar, y por qué

Esta es la lista honesta de la cobertura. **Ninguno de estos se dio por bueno.**

| Qué | Por qué | Quién lo desbloquea |
|---|---|---|
| **DM-SUG-011** — el despacho suma un producto repetido en dos facturas del mismo día | **Cuarta corrida sin escenario.** Barrido sobre las 167 facturas: **0** clientes con un producto repetido en su *última* fecha facturada. Existen 2 casos (03/09 y 17/08) en fechas que la app nunca lee | **Servidor** — QA ya no puede: los datos inyectados por SQL directo no bajan al equipo |
| **Ticket 1 con envío sin señal** | Exige modo avión; el estado «enviado pero sin `id_return`» no es alcanzable hoy | **QA, a mano** |
| **Si el formulario contaminado duplica o pisa** | No se pulsó Enviar a propósito: el riesgo es duplicar un pedido en la nube de un cliente real | **Entorno desechable** |
| **Si otras pantallas web comparten el filtro de nulos** | Inventarios, devoluciones y sugerencias devolvieron todo, pero **ninguna tiene hoy una fila con `co_operation` nulo** — no son prueba | Cuando exista el dato |
| **El SQL del listado web** | Se midió el síntoma, consistente con `<> 'D'`; el `IS DISTINCT FROM` se hereda del diagnóstico anterior, **no se leyó el código** | **Desarrollo** |
| **Cotejo fuerte de montos** | Los 4 pedidos van enteros en USD: sumar el campo correcto o el equivocado da lo mismo | Con **mezcla de monedas** |
| **Precisión de `estimated_daily_units`** | `days_since_last` de 1 y 2 da diarias exactas; no se ejercitó el redondeo | Con un intervalo que produzca decimales |
| **Aislamiento por sucursal** | 17 clientes / 17 direcciones: no hay dos sucursales del mismo cliente | Con dato de otro tenant |
| **El defecto del GPS** | El harness calienta el GPS antes de cada envío, así que la condición no se produce | Corrida específica sin esa acomodación |

---

## Registros creados

| Qué | Referencias |
|---|---|
| Devoluciones | **279** Distribución · **280** Calidad · **281** Distribución · 1 Guardada (centinela) |
| Inventarios | **275** · **276** · **277** · **278** · **279** |
| Sugerencias en la nube | **ref 6** (consumida → pedido 179) · **ref 7** (Pendiente) |
| Sugerencias solo locales | 2 — una de ellas generó el pedido 178 |
| Pedidos | **178** · **179** · **180** · **181** |

Todos verificados en la nube. Colas de pendientes y fallidas en 0 al cierre.

---

## Para la próxima corrida

1. **No borrar el centinela** — la devolución guardada con −3.
2. `automation/sugerido/oraculo-terminos.js` ya lleva la guarda **`id_client_stock <> 0`**,
   que la app aplica y nosotros no teníamos: sin ella el oráculo elige un inventario que la
   app ignora y todo sale corrido.
3. **`qa-web-open.js` tiene dos fallos** anotados en §7 del informe web: toma el **primer**
   bloque `# USUARIO WEB` del archivo de credenciales —que es LA TORTUGA, no Isla Coche— y
   su `BASE` está clavado en `denariocaribe`. El síntoma engaña: la página de login se
   recarga en silencio y parece que el script no hizo submit.
4. **DM-SUG-011 hay que pedirlo al servidor.** Cuatro corridas es suficiente evidencia de
   que no se puede montar desde QA.
