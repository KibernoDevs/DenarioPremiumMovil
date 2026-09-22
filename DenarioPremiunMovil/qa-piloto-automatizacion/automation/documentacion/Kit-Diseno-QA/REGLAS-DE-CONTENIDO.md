# Reglas de contenido, y de dónde salieron

Las reglas del `PROMPT-MAESTRO.md` no son preferencias de estilo. Cada una nació de un
error concreto que apareció al revisar el material contra el producto, en septiembre de
2026. Este documento explica el porqué de cada una, para que puedas defenderlas —o
discutirlas con criterio.

El registro completo de qué se cambió en cada pieza está en
`documentacion/_cambios-de-contenido.md`.

---

## 1 · «Tiempo real» casi nunca es cierto

Denario funciona sin señal y **envía cuando sincroniza**. Un pedido, una cobranza o un
cliente nuevo se quedan en el teléfono hasta ese momento.

| Decía | Quedó |
|---|---|
| «Stock **en tiempo real**» | «Precios y stock **tal como quedaron en la última sincronización**» |
| «La solicitud llega **inmediatamente** al administrador» | «Queda en su teléfono y **viaja a la oficina al sincronizar**» |
| «Las visitas asignadas aparecen **al instante** en la app» | «Aparecen **al sincronizar**» |

**Por qué importa:** el producto hace bien su trabajo, pero si el material promete
instantaneidad, cada demora normal se convierte en un reclamo. Prometer de menos y
cumplir es mejor negocio que al revés.

## 2 · El lector no es técnico

«Offline», «modo offline», «notificaciones push», «integración con el ERP». Nada de eso
significa algo para un vendedor dentro de un local.

| Decía | Quedó |
|---|---|
| «Compatibilidad nativa optimizada para el **modo offline**» | «…optimizada para **trabajar sin señal**» |
| «**Soporte Offline**: gestión en ruta con o sin datos activos» | «**Trabajo sin señal**: la ruta se gestiona con o sin datos activos» |
| «Visualización transparente de la APK oficial» | «La versión instalada **se ve en la pantalla de inicio de sesión**» |

## 3 · Una instrucción sin motivo no se cumple

| Decía | Quedó |
|---|---|
| «Otorgar todos los accesos de geolocalización y archivos» | «…**sin ellos no se registran visitas ni se adjuntan documentos**» |
| «Abrir el correo obligatoriamente en Safari» | «…**otros navegadores bloquean la descarga**» |
| «Escriba correctamente el número de factura para evitar rechazos» | «Escriba bien el número de factura de cada producto: **un número errado provoca el rechazo**» |

**Por qué importa:** un permiso que no se entiende es un permiso que se niega, y después
la app «no funciona».

## 4 · Las claves de éxito son instrucciones, y accionables

Las etiquetas tipo título —«GPS Siempre Activo», «Verificación Rigurosa»,
«Sincronización Periódica»— se ven bien y no cambian la conducta de nadie. Se pasaron a
instrucciones directas: «Marque estando en el local», «Si no hay pedido, registre el
motivo», «Sincronice también al terminar».

Y se **eliminó** una que no era accionable: *«asegurar que el servidor principal de la
empresa esté encendido»*. Un vendedor no puede hacer nada con eso.

## 5 · Lo que depende de la configuración, se dice

Muchas funciones se activan por empresa. Si el material las da por universales, el
vendedor cuya empresa no las tiene cree que la app está fallando.

| Función | Cómo se dice |
|---|---|
| IGTF | «Cálculo del IGTF **cuando su empresa lo tiene habilitado**» |
| GPS obligatorio | «**Según la configuración de su empresa**, el GPS puede ser obligatorio» |
| Factura en devoluciones | «**Según la configuración de su empresa**, puede ser obligatorio indicar la factura» |

## 6 · No se afirma lo que no está verificado

Esta es la regla más importante, y la que más incomoda.

- 🔴 **«Los datos se resguardan encriptados».** Se retiró. Es una promesa de seguridad que
  nadie pudo confirmar. Si desarrollo la confirma, se repone.
- ⚠ **«Fuera de los 50 metros del local».** Se cambió por «fuera del **perímetro del
  local**», sin cifra: no se encontró ninguna variable de radio y el aviso ocurre del lado
  de la web. Si resulta que son 50 fijos, se repone la cifra.
- ⚠ **Un paso de la instalación en iOS estaba cortado a media frase.** Se completó con el
  paso habitual, y quedó anotado como pendiente de confirmar con quien lo redactó.

**Cómo se trabaja con esto:** no se borra la idea, se escribe en general y se marca
`[VERIFICAR: ...]`. Publicar una afirmación falsa cuesta mucho más que preguntar.

## 7 · El error más caro: describir mal lo que el usuario ve

El material original decía que el saldo aparece **azul si el cliente está al día** y
**rojo si tiene deudas vigentes o vencidas**. Al revisarlo contra el código, el color sale
únicamente de contar los documentos **ya vencidos**.

Es decir: **un cliente con facturas por vencer se ve azul.** Tal como estaba escrito, un
vendedor podía leer «azul = no debe nada» e irse del local sin cobrar.

Quedó así: «**Rojo:** tiene documentos vencidos · **Azul:** no los tiene», con el aviso
explícito de que azul **no** significa que no deba nada.

**La lección:** cuando la pieza describe **lo que el usuario ve en pantalla** —un color,
un estado, un botón que aparece o no—, esa afirmación hay que verificarla con QA. Es donde
un error pasa desapercibido y hace daño real.

## 8 · Cuando dos fuentes se contradicen, se resuelve antes de publicar

En el material había una infografía que decía que a un cliente potencial solo se le puede
pedir **después de aprobado**, y un documento de Word que decía que **si la empresa lo
permite** se puede pedir con un código genérico. Las dos no podían ser ciertas.

Se confirmó con QA: la infografía tenía razón. **La contradicción no se promedia ni se
publica «por si acaso»** — se resuelve preguntando.

---

## Lo que sigue pendiente de confirmar

Estos puntos quedaron marcados en el material y aún no tienen respuesta:

| # | Qué | Con quién |
|---|---|---|
| 1 | Que el teléfono **0414-9321672** siga siendo el canal de soporte | Soporte |
| 2 | El perímetro de «fuera de rango» en visitas: ¿50 metros fijos o configurable? | Producto |
| 3 | Si los datos guardados sin conexión están cifrados | Desarrollo |
| 4 | El paso 3 de la instalación en iOS, que venía cortado | Quien redactó la pieza |
| 5 | Dos archivos venían como «Copia de…»: confirmar que no haya versiones más nuevas | Jefatura |
