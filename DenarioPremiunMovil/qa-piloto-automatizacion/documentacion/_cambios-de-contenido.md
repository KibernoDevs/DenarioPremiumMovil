# Registro de cambios de contenido

Las infografías se rehicieron desde cero con la identidad de QA, partiendo del material que
preparó el pasante (`FAQs_Denario`). El **diseño** cambió por completo y eso no se registra aquí.

**Aquí se anota únicamente lo que cambió en el CONTENIDO**: texto que se corrigió, se recortó,
se agregó o se reordenó respecto del original. Así, quien conozca las piezas originales puede
ver qué se tocó y por qué, y discutirlo si no está de acuerdo.

## Dónde está cada cosa

| Carpeta | Qué contiene |
|---|---|
| `documentacion/pdf/` | **lo que se entrega**: las 11 infografías + los 2 manuales de los REQ |
| `documentacion/html/` | las **fuentes**: el HTML de cada pieza, `_estilo.css`, `_medir.js` y las imágenes de los manuales |
| `documentacion/_assets/` | logo e isotipo Denario, compartidos por todo |

⚠ **El generador deja el PDF junto al HTML.** Al rehacer una pieza hay que **moverlo** a
`pdf/` para que la carpeta de entrega quede al día:

```
node automation/reports/_build-pdf.js documentacion/html/05-cobranzas.html
mv documentacion/html/05-cobranzas.pdf documentacion/pdf/
```

**Los dos manuales** (catálogo de bancos y envío de transacciones) se trajeron aquí desde las
carpetas de corrida de sus REQ, porque son material de usuario y no evidencia de pruebas. En
`automation/reports/` quedaron sus informes de testing, que sí son evidencia.

## Reglas que seguimos

1. **Todo cabe en una página.** Cuando el contenido se pasa, **se recorta** — no se achica la
   letra por debajo de lo legible ni se parte en dos páginas.
2. **Se corrige lo que no cuadra.** Si una frase contradice al producto o no viene al caso, se
   arregla y se anota aquí.
3. **Nada se cambia en silencio.** Cualquier retoque de contenido queda en este registro.

---

## 01 · Cómo instalar la app — Android

*Origen: `Como instalar denario android.png` · rehecha el 08/09/2026*

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| **Cierre de la pieza** | «¡Aplicación instalada en Android! Sincronización y registro rápido **del módulo de clientes**» | «Aplicación instalada en Android. Ya puede iniciar sesión, sincronizar y trabajar en campo, incluso sin señal» | El cierre hablaba del módulo de Clientes, que no tiene nada que ver con instalar la app. Detectado por QA |
| **Motivo de los permisos** | «Otorgar todos los accesos de geolocalización y archivos» | Se agregó: «sin ellos no se registran visitas ni se adjuntan documentos» | Un permiso que no se entiende es un permiso que se niega. El texto pedía la acción sin dar la razón |
| **Redacción de un beneficio** | «Compatibilidad nativa optimizada para el modo offline» | «Compatibilidad nativa optimizada para trabajar sin señal» | «Modo offline» es lenguaje técnico; el destinatario es el vendedor en campo |
| **Redacción de dos beneficios** | «Instalación ágil y directa mediante APK sin tiendas» · «Independencia de tiendas para actualizaciones rápidas» | «Instalación ágil y directa, sin depender de la tienda» · «Actualizaciones rápidas, sin esperar aprobaciones» | Las dos decían casi lo mismo. Se separó qué gana cada una |

**No se cambió:** los cuatro pasos, los cuatro errores frecuentes, el aviso de no compartir la
APK y el teléfono de soporte.

**Pendiente de confirmar:** que el teléfono **0414-9321672** siga siendo el canal vigente.

---

## 02 · Cómo instalar la app — iOS / iPhone

*Origen: `Como instalar denario IOS 2.png` · rehecha el 08/09/2026*

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| **Paso 3 estaba incompleto** ⚠ | «…selecciona Firebase y presiona» — la frase terminaba ahí | «…seleccione el perfil de Firebase, presione **Instalar** y confirme» | El texto original quedaba cortado a media instrucción. **Se completó con el paso habitual de iOS; conviene que lo confirme quien redactó la pieza** |
| **Motivo de usar Safari** | «Abrir el correo de Firebase obligatoriamente en Safari» | Se agregó: «otros navegadores bloquean la descarga» | El original daba la razón más abajo, entre los errores. Se subió a la clave, que es donde evita el problema |
| **Redacción de un beneficio** | «Notificaciones inmediatas de actualizaciones en campo» | «Aviso inmediato cuando hay una actualización disponible» | «Notificaciones» se confunde con las del teléfono |
| **Cierre de la pieza** | «Configuración de perfiles y acceso empresarial seguro» | Se mantiene, y se agregó: «Ya puede iniciar sesión y sincronizar» | El cierre describía el proceso, no decía qué puede hacer el usuario a continuación |

**No se cambió:** los cinco pasos, los cuatro errores frecuentes, el aviso sobre el UDID y el
teléfono de soporte.

---

## 03 · Flujo de visita y gestión de ventas

*Origen: `Clientes 1 denario.png` · rehecha el 08/09/2026*

⚠ **El archivo se llamaba «Clientes 1» pero la pieza es de VISITAS**, no del módulo de Clientes.
Se renombró por su contenido.

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| 🔴 **Qué significan el azul y el rojo** | «El saldo se resalta en AZUL si está al día, o en ROJO si presenta **deudas vigentes o vencidas**» | «Azul cuando el cliente **no tiene documentos vencidos**, rojo cuando **sí los tiene**» | **Era incorrecto.** El color sale de contar los documentos con fecha de vencimiento pasada (`countDueDate`). Un cliente **con deuda aún no vencida sale AZUL**. Decir que el rojo cubre las deudas «vigentes» hace pensar que el azul significa «no debe nada», y no es así. Verificado en el código por QA el 08/09 |
| **Saldos en tiempo real** | «Los saldos de clientes se actualizan según sincronización del ERP» | Se agregó: «**no son en tiempo real**» | Es la duda más frecuente y el original la dejaba implícita |
| **Soporte offline** | «Soporte Offline: gestión en ruta con o sin datos activos» | «Trabajo sin señal: la ruta se gestiona con o sin datos activos» | «Offline» es lenguaje técnico |
| **Claves de éxito** | Títulos tipo etiqueta: «GPS Siempre Activo», «Marcaje Obligatorio», «Gestión de No Venta», «Sincronizar al Final» | Se pasaron a instrucción directa: «Marque estando en el local», «Si no hay pedido, registre el motivo» | Una clave de éxito se cumple mejor si dice qué hacer, no cómo se llama |
| **Visibilidad de saldos** | «Identificación instantánea de deudas» | «Se ve al instante quién tiene documentos vencidos» | Coherencia con la corrección del color |

**No se cambió:** los cuatro pasos, el aviso de visitas fuera de zona, los tres pasos de
resolución de GPS y el teléfono de soporte.

---

## 04 · Alta de cliente potencial

*Origen: `Clientes 2 denario.png` · rehecha el 08/09/2026*

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| 🔴 **Pedidos a clientes potenciales** | La infografía: «Solo se pueden crear pedidos a prospectos **después de la aprobación**» · El `.docx`: «**Si la empresa lo permite** pueden hacerlo utilizando un código genérico» | «**Solo se pueden registrar pedidos a un prospecto después de su aprobación**, cuando ya figura como cliente» | **Los dos materiales del pasante se contradecían.** Confirmado con QA: **la infografía tenía razón**. La versión del `.docx` abría una puerta que no existe |
| ⚠ **Dónde ocurre la aprobación** | «El administrador o el supervisor **evalúan los datos desde el panel web**» | «La oficina revisa la solicitud y **la aprueba según su propio proceso**. Al aprobarla, el cliente se da de alta en el sistema administrativo» | La aprobación **sí existe**, pero es un proceso de la empresa: QA no ha visto una pantalla de aprobación dentro de Denario. Se conserva el concepto sin situarlo en una pantalla que no se pudo verificar |
| **«Tiempo real»** | «Sincronizar datos con el ERP **en tiempo real**» · «La información se transmite de forma automática y **en tiempo real**» | «Que la solicitud llegue al ERP **al sincronizar**» · «**Al sincronizar**, la información viaja a la base de datos central» | La información viaja cuando se sincroniza, no en tiempo real. Prometerlo genera reclamos por algo que funciona bien |
| **Claves de éxito** | Etiquetas: «Verificación de Datos», «Notificación Rápida», «Sincronización Inicial» | Instrucciones directas, y se agregó por qué verificar el RIF: «corregirlos después depende de la oficina» | Igual que en la pieza 03: una clave se cumple mejor si dice qué hacer |

**No se cambió:** los cinco pasos del flujo, que el código lo genera el sistema, que el potencial
no tiene saldo ni crédito, los tres pasos de «no aparece el cliente» y el teléfono de soporte.

---

## 05 · Gestión de cobranzas

*Origen: `Cobranzas denario.png` · rehecha el 08/09/2026*

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| **Base del IGTF** | «El sistema calcula y registra el impuesto IGTF correspondiente» | «El IGTF se calcula **sobre el total de la cobranza, no sobre el efectivo**» | Es una confusión frecuente que ya generó reportes de «cobra de más». Verificado por QA |
| **IGTF como beneficio** | «Cálculo y registro del impuesto IGTF en divisas» | «Cálculo del IGTF **cuando su empresa lo tiene habilitado**» | No todos los clientes tienen IGTF activo; prometerlo genera dudas |
| **«100% offline»** | «Operación 100% offline para trabajo continuo» | «Trabajo sin señal: la cobranza se guarda y se envía al recuperar conexión» | El «100%» sugiere que también envía sin conexión, y el envío sí la necesita |
| **«Auditoría en tiempo real»** | «Auditoría en tiempo real desde la plataforma web» | Se retiró | No es en tiempo real: la web la recibe al sincronizar |
| **Se agregó** | — | «Una factura ya incluida en otra cobranza sin aprobar **no se lista**, para evitar el doble cobro» | Es la causa más común de «no me aparece la factura» y no estaba documentada. Verificado por QA |
| **Recorte por espacio** | 5 beneficios, 5 claves y pasos largos | 4 beneficios y pasos más cortos | La pieza se pasaba 14,7 mm de la página |

**No se cambió:** los cinco pasos del flujo, que una cobranza enviada no se modifica, que cada
método se registra por separado, y el teléfono de soporte.

---

## 06 · Gestión de pedidos

*Origen: `Pedidos denario.png` · rehecha el 08/09/2026*

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| **«Stock en tiempo real»** | «Garantiza la visualización exacta de listas de precios vigentes y el stock **en tiempo real**» | «Precios y stock **tal como quedaron en la última sincronización**» | El stock que ve el vendedor es el de la última sincronización. Prometer tiempo real provoca reclamos cuando un producto ya no está |
| **Clave «Servidor Activo»** | «Asegurar que el servidor principal de la empresa esté encendido para la correcta integración al ERP» | Se retiró de las claves de éxito | **No es algo que el vendedor pueda hacer.** Una clave de éxito debe ser accionable por quien la lee |
| **Redacción de las claves** | Etiquetas: «Verificación Rigurosa», «Sincronización Periódica», «Registro en Sitio» | Instrucciones directas | Mismo criterio que en las piezas anteriores |

**No se cambió:** los cinco pasos, que el pedido enviado no se modifica ni elimina, que solo se
copian pedidos enviados activos, las cuatro causas de «no puede crear el pedido» y el soporte.

---

## 07 · Gestión de visitas

*Origen: `Copia de visitas def denario.png` · rehecha el 08/09/2026*

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| ⚠ **El límite de 50 metros** | «Las marcas de GPS **fuera de los 50 metros** del local se alertarán en la web» · «que te encuentres a menos de **50 metros** del cliente» | «Fuera del **perímetro del local**», sin cifra | **No se pudo verificar.** No existe ninguna variable de radio en la configuración de la app, y el aviso ocurre del lado de la web. Poner una cifra fija sería falso si cada empresa la configura distinto. **Confirmar con producto y, si es fija, reponerla** |
| **«Al instante en la app»** | «Cualquier visita asignada desde la web aparecerá **al instante** en la app móvil» | «Aparecen **al sincronizar**» | Las visitas bajan en la sincronización, no al instante |
| **GPS obligatorio** | «Es obligatorio mantener el GPS encendido» | «**Según la configuración de su empresa**, el GPS puede ser obligatorio» | Depende de una variable de configuración (`userMustActivateGPS`), no es universal |

**No se cambió:** los cinco pasos, los cuatro pasos de resolución de GPS, el respaldo con fotos
y PDF, y el teléfono de soporte.

---

## 08 · Gestión de devoluciones

*Origen: `Devoluciones denario .png` · rehecha el 08/09/2026*

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| 🔴 **«Los datos se resguardan encriptados»** | «En modo offline, los datos **se resguardan encriptados** y se envían de forma automática» | «Los datos quedan guardados y se envían solos en cuanto vuelve la señal» | **Se retiró la palabra «encriptados».** Es una afirmación de seguridad que QA **no pudo verificar**, y en documentación de usuario una promesa así no se hace sin comprobarla. **Si está confirmada, se repone** |
| **Factura obligatoria** | «Multifactura flexible… indicando el número de factura por ítem» | Se agregó: «**Según la configuración de su empresa**, puede ser obligatorio indicar la factura para poder devolver» | En varios clientes la factura es la que habilita la devolución. Sin ese aviso, parece un fallo de la app |
| **Motivo de la clave** | «Validación de Facturas: asegurar de escribir correctamente el número de factura para evitar rechazos» | «Escriba bien el número de factura de cada producto: **un número errado provoca el rechazo**» | Misma idea, con la consecuencia por delante |

**No se cambió:** los cinco pasos, que la devolución enviada no se modifica, que los motivos los
administra la oficina, el mapa en la web y el teléfono de soporte.

---

## 09 · Conectividad y sincronización

*Origen: `Denario preguntas conectividad.png` · rehecha el 08/09/2026*

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| 🔴 **El modo avión** | «**El modo offline se activa de forma manual encendiendo el modo avión**» · Paso 2: «Ante pérdida de señal, el vendedor enciende el modo avión para operar localmente» | «**Si se queda sin cobertura, siga trabajando normalmente: no hace falta activar nada.** El modo avión sirve solo como recurso si hay conexión pero el servidor no responde» | **Era confuso y podía costar ventas.** La app funciona sin señal por sí sola; tal como estaba, un vendedor podía creer que sin modo avión no puede trabajar |
| **«Saldos en tiempo real»** | «actualizando los saldos **en tiempo real**» | «los saldos quedan actualizados» tras sincronizar | Coherencia con el resto del material |
| **Control de versión** | «Visualización transparente de la APK oficial desde el inicio de sesión» | «La versión instalada se ve en la pantalla de inicio de sesión» | Se entiende a la primera |
| **Se agregó** | — | «**Nada llega a la oficina hasta que sincroniza**» y la clave «sincronice también al terminar» | Es el punto central de la pieza y estaba implícito |

**No se cambió:** los cinco pasos, las causas de fallo, que cada usuario tiene su rol, y el
teléfono de soporte.

---

## 10 · Gestión desde la plataforma web

*Origen: `Denario web.png` · rehecha el 08/09/2026*

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| **Rótulo de la cabecera** | «Guía de campo» | «**Guía web · Administración**» | Esta pieza es para administradores y supervisores, no para el vendedor en la calle |
| ⚠ **Los 50 metros** | «Se activa automáticamente si la visita supera el límite de **cincuenta metros**» | «cuando la marca del vendedor supera el **perímetro definido** para el local» | Mismo motivo que en la pieza 07: sin verificar |
| **«Planificación inmediata»** | «Envío **en tiempo real** de rutas y visitas» · «se reflejan **de inmediato** en la app móvil» | «llegan a la aplicación **en su siguiente sincronización**» | Las rutas bajan al sincronizar |

**No se cambió:** los cinco pasos, que los administradores solo entran por la web, el mapa con
el punto morado y el pin rojo, los cinco pasos de «servidor caído» y el soporte.

---

## 11 · Preguntas frecuentes · Módulo de clientes

*Origen: `Copia de PREGUNTAS FRECUENTES DENARIO.docx` · pieza **nueva**, creada el 08/09/2026*

El documento de Word no tenía infografía equivalente: las dos piezas llamadas «Clientes»
resultaron ser de **visitas** y de **alta de cliente potencial**. Se le hizo la suya, con formato
de preguntas y respuestas en vez de flujo de pasos.

| Qué se cambió | Antes | Ahora | Por qué |
|---|---|---|---|
| 🔴 **Azul y rojo del saldo** | «Aparecerá en **azul (no debe)** o en **rojo (debe)** el saldo» | «**Rojo:** tiene documentos vencidos · **Azul:** no los tiene», con el aviso «azul **no** quiere decir que no deba nada» | **Era incorrecto, y es el error más peligroso de todo el material.** Un cliente con facturas por vencer se ve AZUL. Tal como estaba, el vendedor podía irse de un local sin cobrar. Verificado en el código por QA |
| 🔴 **Pedidos a clientes potenciales** | «Depende de las políticas de la empresa. **Si la empresa lo permite** pueden hacerlo utilizando un código genérico» | «**No mientras siga siendo potencial.** Solo se le pueden registrar pedidos **después de su aprobación**» | Confirmado con QA. Contradecía a la infografía de alta de cliente potencial, que era la correcta |
| **Saldo en tiempo real** | «El saldo se actualiza según la frecuencia de sincronización con el ERP» | Se antepuso un **«No»** explícito, y qué hacer si no coincide | La pregunta es «¿es en tiempo real?»: conviene responderla de frente |
| **Cuándo llega la solicitud** | «La solicitud llega **inmediatamente** al administrador o supervisores» | «Queda en su teléfono y **viaja a la oficina al sincronizar**» | Igual que en la pieza 04: no llega hasta sincronizar |

**No se cambió:** las tres causas de que un cliente no aparezca, los pasos para limpiar la caché,
los pasos para actualizar la ubicación, que solo se ven los clientes asignados, y el soporte.

---

## Pendientes de confirmar

| # | Qué | Con quién |
|---|---|---|
| 1 | El teléfono **0414-9321672** sigue siendo el canal vigente de soporte | Soporte |
| 2 | El **perímetro de «fuera de rango»** en visitas: ¿son 50 metros fijos o se configura por empresa? | Producto |
| 3 | Si los datos guardados sin conexión **están cifrados** (se retiró la afirmación en la pieza 08) | Desarrollo |
| 4 | El paso 3 de la instalación en **iOS** estaba cortado a media frase; se completó con el paso habitual | Quien redactó la pieza |
| 5 | Dos archivos venían como **«Copia de…»** (visitas y el docx): confirmar que no existan versiones más nuevas | Jefatura |
