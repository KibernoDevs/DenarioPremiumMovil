# Pendientes de QA

Lo que quedó abierto, con el detalle necesario para retomarlo sin reconstruir el contexto.
**Actualizar al cerrar cada punto** — un pendiente resuelto que sigue aquí confunde igual que
uno olvidado.

---

## 1. ✅ Script de COBROS — afinado el 14/09  (`automation/reports/4k/pulido_scripts_20260914/`)

`automation/playwright/modules/cobros.js`

- ✅ **El riesgo de doble envío está CERRADO Y COMPROBADO.** `clickGuardarEnviar()` hace un solo
  disparo con fallback condicionado, y ahora el propio guion lo verifica: `verificarNube()` cuenta
  las filas **por `co_type`** y DM-COB-019 **no da PASS si hay duplicado**. Tres envíos en tres
  vueltas → una fila cada uno (2715, 2721, 2723).
- ✅ **Fase 2 construida.** Los 12 BLOCKED genéricos pasaron a casos reales: 033/034 (moneda),
  014/015 (Tab Total), 046 (pago parcial), 041/042 (retención por documento), 028 (anticipo),
  038 (guardar y salir). 029 es **N/A por VG** (`cobroRetencion=false`), no BLOCKED.
- ✅ **`cobros` YA ESTÁ en `ORDEN_DEFAULT`** de `run.js`, antes de `pedidos`. Dura ~11 min.
- ⚠ **Lo que queda abierto, y por qué no se puede cerrar sin tocar la web:**
  - **DM-COB-050/051/052** (tope de descuento): el catálogo de 4K tiene 10 % y 80 %, y
    `maxCollectDiscount` = **0** en el equipo. Con 10 + 80 no hay forma de pasarse, y ninguno abre
    el input de tasa. Hace falta bajar el tope por WEB o crear un descuento con «Porcentaje
    Manual = SÍ», y sincronizar.
  - **DM-COB-047/039** (tasa por fecha): 4K tiene **una sola tasa distinta** en el histórico.
    Un caso que no puede fallar no es un PASS ⇒ quedan en **N/A**.
- 🔴 **Defecto de producto abierto — ver §4 del informe:** el **anticipo automático no se genera
  si el cobro se envía desde un Guardado reabierto**. Mismo excedente de 50,00 USD: directo crea el
  anticipo (2718/2719), reabierto no (2717 y 2720). El guion lo deja como **`DM-COB-058`, fallando
  a propósito**; mientras falle, el defecto sigue vivo.
- ⚠ **IDs nuevos sin guion:** `DM-COB-048` a `058` existen en el script y **no** en
  `guiones-regresion/guion-cobros.md`. Hay que darlos de alta.

## 2. ✅ Script de PEDIDOS — afinado el 14/09  (`automation/reports/4k/pulido_scripts_20260914/`)

`automation/playwright/modules/pedidos.js`

De **2 PASS / 20 BLOCKED** a **16+ PASS** en 4K. Los cinco pendientes están cerrados:

- ✅ **Parser del Tab Total**: `DM-PED-024` (Base 27 · Total 27) y `DM-PED-TOT-001`
  (**27 − 0 + 0 = 27**, diferencia 0,0000). Ya no captura el 0 de «Total Item».
- ✅ **Paginación dentro de la categoría**: `DM-PED-017` localiza el producto dentro de su
  categoría. ⚠ Antes de pedir el relevo hay que **restaurar el árbol** (General → Pedido):
  recorrer categorías lo deja vacío y el relevo se caía con «el árbol no muestra nada».
- ✅ **Reposición de línea tras `DM-PED-026`**: repone con CUALQUIER producto, no con el del perfil.
- ✅ **Etiquetas de los `ion-select` de VG**: salían los VALORES disfrazados de nombres. La
  etiqueta está en el **`ion-col`** que envuelve al select, no en `label`/`aria-label` (todos
  `null`) ni en el shadowRoot (ahí vive el valor). Ahora: Empresa · Moneda · Sucursal · Tipo
  Pedido · Lista de Precio · Condición de pago.
- ✅ **`DM-PED-029` NO era un defecto de producto: era la expectativa del guion.** Con el carrito
  vacío, Guardar nace **habilitado**, pero al pulsarlo la app responde «**Debe agregar al menos un
  producto al pedido.**» y **no guarda**. La protección existe; simplemente no se implementa
  deshabilitando el botón, sino validando al pulsar — que es el criterio **C2 del REQ del botón
  Enviar** (y por esa vía `DM-PED-REQ-002` da PASS). El caso ahora mide lo que importa: **que no se
  pueda guardar un pedido vacío**, pulsando el botón si hace falta.

**Dos arreglos más que salión de la misma corrida:**

- 🔴 **`setClientfromSelector` no asigna el cliente por sí solo**: encola «Este cliente tiene
  deuda vencida, ¿Desea continuar?» y el cliente solo entra al **Aceptar**. Con una espera fija de
  1,5 s el diálogo a veces no había pintado y el módulo seguía con la alerta viva, cuyo backdrop se
  come todos los clics ⇒ **23 casos a BLOCKED**. Ahora se espera a que salga.
- ✅ **`DM-PED-031` tiene oráculo de nube**: fila en `"order"` por el comentario único, con conteo
  de duplicados. Antes daba PASS con «volvió al home», que no prueba que el pedido saliera del equipo.

🔴 **LO QUE QUEDA ABIERTO — intermitencia en la selección de cliente (causa en el producto).**
En trece vueltas apareció un patrón limpio: **el módulo falla en toda corrida que va DETRÁS de una
que terminó bien** (5 ✗ · 6 ✓ · 7 ✗ · 8 ✓ · 9 ✗ · 10 ✓ · 11 ✗). Síntoma constante:
`setClientfromSelector` rellena el input pero **`hasClient` se queda en false** y las pestañas no se
liberan ⇒ el formulario **hereda algo del pedido anterior ya enviado**.

- Descarté y corrigí dos causas plausibles (el `ION-BACKDROP` comíendose el clic; las `ion-alert`
  muertas que siguen en el DOM haciéndose pasar por vivas). Ninguna la cerró.
- **Mitigación en el guion:** `DM-PED-006` reintenta con **formulario nuevo** y lo **anota en la
  nota** («⚠ hizo falta un SEGUNDO intento»). Vueltas 12 y 13 — la 13 era justo la que debía
  fallar — dieron **18 PASS · 0 FAIL** las dos.
- **Para cerrarlo hace falta mirar el producto**: qué deja en pie `orderService` / `app-pedido` tras
  enviar un pedido. Fuera del alcance de un guion de QA.
- ⚠ Si en una corrida sale `DM-PED-006` FAIL con *«falló también con formulario nuevo»*, **no es el
  dato del perfil**: es esto. Relanzar el módulo suelto basta.

⚠ **Dato del perfil corregido:** el catálogo de `V.0002` tiene **solo 4 categorías** (FILTROS,
INYECCION, MISCELANEOS, MOTOR) y `4400-01202` **no está en ninguna**. El producto que sí funciona es
**`1R1807-4K`** (FILTRO DE ACEITE CATERPILLAR 3116 · 13,50 USD).

## 3. 🔧 Revisar el caso de CLIENTES con otro cliente

`piercar` **ya no está en ninguna playa**, así que su caso pendiente no es alcanzable tal cual.

- **`DM-CLT-031`** — botón de la alerta al eliminar un cliente potencial: quedó sin verificar.
- ⇒ **Elegir otro cliente activo** y correr `--modulo=clientes` contra él.

---

## 4. ⏳ Pendiente · «Monto doc. conversión» sin convertir

`automation/reports/INCIDENCIA-monto-doc-conversion-sin-convertir.md`

`nu_amount_doc_conversion` llega repitiendo el monto en divisa en vez de convertirlo, mientras
`nu_balance_doc_conversion` del mismo renglón **sí** está convertido. Afectaba a **10 de 10** cobros
del 01–02/09; el último renglón correcto era del 24/08. No toca los importes cobrados, pero confunde
la lectura y cualquier reporte que sume esa columna.

**Sigue sin verificar si se corrigió.** Al retomar, correr la consulta del `.md` sobre un cobro
**nuevo** — no basta mirar uno viejo.

> El otro defecto que se devolvió el 02/09 —«Banco Emisor» duplicado y la columna «Cuenta» con el
> nombre del banco— **se resolvió**: verificado el 07/09, la tabla bajó de 14 a 13 columnas y
> «Cuenta» ya no muestra el nombre. De aquello solo queda que la columna se dibuja en Pago Móvil y
> Cheque donde no aplica (cosmético, severidad baja).

---

## 5. 🔁 Regresión completa de los 6 REQ de 4K

**Guión:** `guiones-regresion/guion-req-4k-seis.md` — tiene TODOS los escenarios,
incluidos los que la vuelta parcial no cubrió. Es el documento a seguir.

**Vuelta parcial (03-04/09):** `automation/reports/4k/req_incidencias_20260903/`
→ REQ **1, 2 y 5 PASS**; **3, 4 y 6 en espera**. Ese informe **no es el de cierre**:
sirve de contexto para no repetir el reconocimiento.

Lo que hace falta para destrabar los tres que faltan:

| REQ | Bloqueo |
|---|---|
| **3** zoom | un producto **con imagen** cargada en 4K |
| **4** moneda | identificar el cliente/empresa con **moneda fuerte y sin conversión** |
| **6** estatus depósitos | desarrollo ajustó la BD tras la medición; **volver a medir de cero** |

🔴 Y dentro de los que dieron PASS quedaron huecos que la regresión debe cerrar:
enviar la visita y cotejarla en la nube/web (REQ 1), **reactivar** la actividad y ver
si sus motivos vuelven (REQ 2), y el comportamiento con `htmlClientDescription=false`
más la sanitización de HTML (REQ 5).

---

## 6. 🧪 Incorporar el REQ de Bancos a la regresión — MÓVIL y WEB

El REQ quedó **cerrado como completado** (07/09), pero su validación **no está en los scripts**:
hoy se prueba a mano cada vez. Hay que agregarla para que cada corrida haga regresión sola, igual
que se hizo con el REQ del botón Enviar (`automation/playwright/req-enviar.js`).

**Insumo listo:** `guiones-regresion/guion-req-crud-bancos.md` — tiene los casos, los datos a
preparar y las trampas. Y `automation/reports/4k/req_crud_bancos_20260907/` los valores esperados.

### 6.a · Capa WEB — el CRUD  (`automation/web/modules/`)

| Caso | Qué verifica |
|---|---|
| Listado con columnas Código · Nombre · Estado | la pantalla existe y responde |
| Guardar en blanco → «Campo obligatorio.» | la validación sigue viva |
| Crear → aparece en la lista y en BD con la empresa correcta | el alta |
| Editar → el **código queda bloqueado**, el nombre cambia sin duplicar | la edición |
| Desactivar → confirmación + **borrado lógico** (el registro se conserva) | el borrado lógico |
| Reactivar → vuelve a estar disponible | el toggle completo |
| **Siembra automática:** tras crear, no hay duplicados ni se pisan los preexistentes | el trigger |

### 6.b · Capa MÓVIL — que el catálogo alimente los cobros  (`automation/playwright/modules/cobros.js`)

| Caso | Qué verifica |
|---|---|
| El selector de **Banco Emisor** trae el catálogo en Pago Móvil y Cheque | la fuente correcta |
| En **Transferencia** trae las cuentas del cliente *(solo si `clientBankAccount=true`)* | el caso condicional |
| Un banco creado en la web **aparece tras sincronizar** | la cadena web → móvil |
| Un banco **desactivado desaparece** del selector | el borrado lógico llega al equipo |
| 🔴 **El banco elegido llega a su campo correcto** — ver 6.c | la regresión del defecto |

### 6.c · 🔴 El caso que NO puede faltar

Tras enviar un cobro con **Cheque**, verificar que el banco elegido quede en el campo del **emisor**
y **no** en el del receptor. Es el defecto reportado en
`automation/reports/INCIDENCIA-cheque-banco-emisor-como-receptor.md`, y hoy solo se detecta a mano.

```sql
SELECT co_payment_method, na_bank AS receptor, nu_collection_payment AS emisor
  FROM collection_payment WHERE id_collection = <ref>;
-- Cheque correcto: emisor con el banco, receptor vacío. Hoy ocurre al revés.
```

⚠ **Ojo al construir el caso:** elegir **bancos distintos** para emisor y receptor. Si son el mismo,
un cruce de campos pasa inadvertido — ya ocurrió con el cobro 2619.

---

## Cerrados recientemente

- ✅ **Fix del despacho consolidado (hidroponias)** — validado el 01-02/09 en las 3 capas.
  25 PASS / 0 FAIL. `automation/reports/hidroponias/fix_despacho_consolidado_20260901/`
- ✅ **REQ del botón Enviar** — convertido en regresión permanente (`req-enviar.js`) en los
  7 módulos transaccionales.
- ✅ **REQ · Catálogo de Bancos — COMPLETADO** (07/09, 4K/Caribe, 2.ª vuelta). CRUD certificado,
  siembra automática verificada, y **6 cobros enviados y cotejados en las 3 capas** (Pago Móvil ×2,
  Cheque, Transferencia con cuenta registrada y con cuenta nueva, y un **anticipo**), con montos
  correctos. `automation/reports/4k/req_crud_bancos_20260907/` — informe + **manual de uso**.
  El hallazgo de Cheque **se derivó a tarjeta aparte** (no es de este REQ): la validación en los
  scripts queda como punto 6.
  **No cubierto:** el caso multi-empresa — 4K tiene una sola empresa.
- ✅ **REQ · CRUD de Bancos** — probado el 02/09 en `4k` (Isla Coche), 3 capas. Los 4 criterios
  del CRUD se cumplen; la tarjeta se **devolvió** con 2 defectos → ver punto 4.
  Perfil creado: `automation/clientes/4k.yaml`.
  **Sin cubrir:** el caso **multi-empresa** (4K tiene una sola empresa, `DIESE`) y las
  **cuentas bancarias de cliente** (`clientBankAccount = false`). Para el multi-empresa hace
  falta otro tenant — ver `project_playas_activas_qa`.
- ✅ **Fix · Métodos de pago que no llegaban al detalle del cobro en la WEB** — **no reproduce**
  (02/09, 4K). Verificado en el cobro **2679** (Pago Móvil) y en el **2676**, que trae
  **3 métodos** (efectivo + depósito + transferencia): la web lista los tres.
  ⚠ El cobro **208** de `mio_parts`, que era el caso que la causa de desarrollo no explicaba,
  **no se re-verificó**: quedó en otra playa. Si vuelve a aparecer el síntoma, empezar por ahí.

---

## 7. 🔧 Llevar al script de cobros los 3 casos del aviso de saldo a favor

Añadidos al guion el 15/09 como **DM-COB-070 / 071 / 072**. **Falta implementarlos en
`automation/playwright/modules/cobros.js`.**

| Caso | Qué mide | Estado |
|---|---|---|
| **070** | Factura sola → parcial → marcar la N/C ⇒ **el aviso sale** | PASS medido |
| **071** | Los dos documentos marcados → parcial **después** ⇒ **el aviso NO sale** | 🔴 FAIL — **lo encontró QA a mano, el agente no lo cubrió** |
| **072** | Cobro reabierto desde Guardado ⇒ **ni avisa ni genera el anticipo** | 🔴 FAIL — S2, pierde dinero |

🔑 **Por qué el agente no vio el 071:** probó un solo orden de acciones. El aviso está
enganchado al evento de **marcar/desmarcar** un documento, no a «cambió el saldo a favor»,
así que **cualquier camino que produzca el excedente por otra vía se queda sin aviso**.
⇒ Al implementar estos casos, **ejercitar los dos órdenes**, no uno.

**Control obligatorio en el 072:** el mismo cobro **enviado directo** sí genera su anticipo.
Sin ese control, un FAIL ahí no distingue el defecto de una configuración que no lo permita.

---

## 8. 🔧 `DM-DEV-006` / `DM-DEV-007` — son del GUION, no del producto

**Resuelto el 16/09 por QA, a mano, en la devolución ref 232.** Los campos del Tab
General **aceptan entrada** (Responsable, Precinto, Comentario, Tipo) y la **Fecha se
muestra sin ser editable**, que es justo lo esperado. **Sin incongruencias.**

⇒ Los FAIL del 14/09 eran **del guion**, no regresión. Llevaban dos días sin clasificar
porque era la primera vez que esos casos corrían en 4K y **no había línea base**.

**Qué arreglar en `automation/playwright/modules/devoluciones.js`:** el guion **devuelve
`null` cuando no encuentra el elemento y lo trata como fallo**, así que un selector que no
engancha sale igual que un campo que no existe. Hay que distinguir las dos cosas — si el
elemento no está, es **BLOCKED con el motivo**, no FAIL.

> Es el mismo patrón que ya corregimos en `DM-COB-034`: medir la nada no es medir.

---

## 9. 📌 Traspaso 16/09 — lo que queda abierto al cerrar la sesión

Orden sugerido para retomar. Lo de arriba de la lista es lo que ya tumbó una corrida.

### 9.1 🔴 Blindar `depositos.js` contra el selector de MONEDA (diagnóstico hecho, fix NO aplicado)

En la certificación del 16/09 el módulo se fue en BLOCKED. **No fue un defecto del
producto:** el formulario abrió con la moneda en **Bs**, `seleccionarBanco()` cogió el
primer banco **a ciegas** (`opts[0]`), la tab Cobros salió vacía y el guion abandonó el
módulo — cuando en **US$ sí había cobros depositables** y el resto del script podía correr.

Lo que ya sabíamos y el guion no usaba (`automation/cdp/module-selectors/depositos.md`):

- Las cuentas bancarias **se filtran por MONEDA y por EMPRESA**.
- Cambiar la Moneda **resetea** `selectbanco.value` a `{}` y **vuelve a deshabilitar** las
  tabs Cobros/Total/Adjuntos ⇒ **moneda ANTES que banco, siempre**.
- Una moneda **sin cuentas** es un callejón sin salida: el pool no es «no hay dato», es
  «no hay por dónde». Y **el nombre del banco miente sobre la moneda** — leer `coCurrency`,
  nunca el rótulo (hay una cuenta «VENEZUELA USD$» con `coCurrency:"BS"`).
- Los 3 `ion-select` del form (Empresa · Moneda · Banco) traen `value` **objeto** y
  **ninguno** tiene `formcontrolname` ⇒ la vía programática por string no sirve; abren
  `ion-popover` con 1 click.

**Qué falta hacer, concreto:**

1. Localizar el `ion-select` de Moneda (los tres viven en `app-deposito`; el de Banco es
   `ion-select.selectbanco`, los otros dos no tienen clase propia — identificarlos por
   posición/label, no por texto de la opción).
2. Cuando `marcarPrimerCobro()` devuelva `noCobros: true`, **cambiar a la otra moneda,
   re-elegir banco y reintentar** en vez de retornar.
3. Solo si **las dos monedas** dan vacío, marcar **N/A por dato** (nunca BLOCKED, y nunca
   bajar `depositos.aplica` a `false` por esto — ya nos pasó en latino_cosmetica).
4. Dejar en el veredicto **qué moneda se probó y cuántas cuentas ofrecía cada una**: sin
   eso, un N/A no se distingue de un guion que no supo mirar.

> Regla que esto reinstala: **un cero no es un resultado.** Antes de dar vacío hay que
> haber agotado las dos monedas.

### 9.2 Casos nuevos que faltan por meter al guion **y** al script

- **Guarda de salida de Devoluciones (bug menor, tjt ya redactada).** Sales de la
  devolución con SALIR SIN GUARDAR, caes al menú del módulo, y al intentar salir del
  módulo **vuelve a salir el aviso** GUARDAR Y SALIR / SALIR SIN GUARDAR / CANCELAR.
  No debe aparecer estando ya en el menú. Con GUARDAR Y SALIR aparece «Seleccione un
  cliente para continuar» y **la única salida es SALIR SIN GUARDAR**.
- **`DM-COB-071`** (los dos documentos marcados → parcial después ⇒ el aviso NO sale) —
  ver sección 7. Ya está en el script; falta **volver a medirlo** sobre el build que
  traiga el fix.

### 9.3 Afinar

- **`DM-PRD-007`:** los 6 s de espera **siguen sin alcanzar**. Subirlo y, mejor, esperar
  por condición en vez de por reloj.
- **`happy-path.js`** (web, `--modulo=happy-path`, ~84 s): 8 PASS / 0 FAIL / 1 BLOCKED /
  **5 N/A**. Los 5 N/A son los **cotejos contra base sin cablear**. Falta además la
  descarga de adjuntos y la comprobación de cálculos, que era la mitad del encargo.

### 9.4 Contexto que no está en el código y hace falta para retomar

- **La versión sale con lo de arriba abierto:** nada de esto bloquea la v22. El 9.1 y el
  9.3 son del **guion**, no del producto; el 9.2 es un bug menor ya reportado.
- **La build solo se distingue por el TAMAÑO del bundle** (`http://localhost/main.js`):
  `versionApp` dice `6.6.21.3` en todas. Última medida: **5.446.151**.
- **Cambiar de APK pierde los registros locales** y deja filas huérfanas en sqlite ⇒
  falsos «ocupados» en el pre-vuelo de inventarios.
- **La playa se pasa por `--playa=`**, nunca va en el YAML del cliente.
