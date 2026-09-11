# Cobros 4K · pendientes para la siguiente vuelta

Anotado el 10/09/2026, para lanzar tras cerrar el REQ del rol Promotor.

## 1 · Punto 2 — anticipo automático y tolerancia · **RE-VALIDAR SIEMPRE**

Decisión de QA: **se vuelve a medir, cambie o no el código.** Y hay que dejarlo
**reproducible a mano**, para que la responsable QA lo vea con sus propios ojos al volver.

### 🔴 Con la configuración de hoy NO se reproduce

Umbral vigente = `prepaidRangeAmount` a secas = **50**, con tolerancia positiva **49,99**.
Un exceso de 5,00 no llega al umbral ⇒ se envía bien y no se ve nada raro. El fallo solo
asoma cuando **la tolerancia es MAYOR que el monto del abono**.

### La configuración que hay que dejar puesta

| Variable | Valor |
|---|---|
| Tolerancia positiva | **49,99** |
| Monto mínimo del abono automático | **1,00** |

Tras cambiarla: **login nuevo** (con «Sincronizar» no baja) y verificar en el equipo.

### El caso, para repetir a mano en dos minutos

1. Cobro a un cliente con una factura abierta.
2. Pagar **5,00 USD por encima** del saldo del documento.
3. Enviar.

**Esperado si la tolerancia mandara:** 5,00 está dentro de 49,99 ⇒ se envía sin anticipo.
**Lo que ocurre hoy:** se crea un **anticipo automático de 5,00**, porque 5,00 ≥ 1,00.

**Control que lo demuestra:** subir el monto mínimo del abono a 50, volver a entrar y
repetir el mismo cobro. Esta vez **no** se crea anticipo. Mismo exceso, misma tolerancia,
comportamiento distinto ⇒ el umbral es el monto del abono y la tolerancia no participa.

### Antes de medir

Comprobar en el **bundle vivo** si `getAutomatedPrepaidActivationThreshold` cambió respecto
de lo de hoy (devolvía `prepaidRangeAmount` sin sumar la tolerancia). **Si cambió, dilo
arriba del informe**: cambia lo que se espera. Si no cambió, medir igual y dejarlo escrito.

### Al cerrar

**Dejar la configuración en 49,99 / 1,00** —la que reproduce— y anotarlo en
`_escrituras-de-prueba.md` diciendo que se deja a propósito para que QA lo repita. No
restaurarla a 50 sin avisar.

Evidencia previa del 10/09: anticipos **2633**, **2635** (1,00 USD) y **2639** (0,01 USD)
en la nube, todos por excesos que estaban dentro de tolerancia.

## 2 · Punto 6 — descuento mayor que el saldo del documento

FAIL del 10/09, **confirmado a mano por QA** y en ajuste por desarrollo: el anticipo se
calcula bien (alerta y modelo dan 80,00) pero **«Enviar» y «Agregar método de pago»
quedan deshabilitados**, el cobro se queda en Guardado, no llega nada a la nube, y el
bloqueo **persiste en los cobros siguientes hasta reiniciar la app**.

Re-probar cuando entre el fix. Receta: un solo documento en el cobro, descuento manual
por encima de su saldo.

## 3 · Punto 7 — notas de crédito con saldo a favor

**Nunca se ha ejercitado.** Seleccionar facturas **y** notas de crédito de modo que el
monto a pagar quede **a favor del cliente**; se espera que se pueda crear un anticipo con
el excedente, usando el método de pago **«Otros»** y un **código de diferencia** (QA ya
activó el método y creó el código: Empresa → Configuración → Códigos de diferencia).

Objetivo del REQ: cerrar el ciclo de los documentos seleccionados para que el cliente
pueda cerrarlos en su sistema y descontar o eliminar las notas de crédito.

## 4 · Selector del banco emisor tras guardar y reabrir *(reportado por QA)*

**Cobro con método de pago CHEQUE** → seleccionar banco emisor → **Guardar** (no enviar)
→ salir → **volver a entrar al cobro**. El selector del banco emisor **se ve vacío**,
como si no se hubiera elegido banco, pero el valor sí está guardado. Y la app **deja
enviar** en ese estado.

**QA ya adelanta que el banco llega bien a la nube ⇒ es cosmético (S3).** Aun así hay
que dejarlo medido, porque «me dijeron que llega bien» no es evidencia:

1. Reproducir que el selector **se ve vacío** al reabrir.
2. Confirmar que el dato **está**, leyéndolo del **modelo de Angular** y de la **BD
   local** — no de la pantalla.
3. Enviarlo en ese estado y **comprobar la fila en la nube**: el banco emisor debe
   llegar correcto.

Si los tres se cumplen: defecto **cosmético**, y basta con una línea en el informe.
Si el 3.º falla, **para y avisa**: dejaría de ser cosmético y cambia la severidad.

⚠ No dedicarle más de 10 minutos. Es reproducir, leer y confirmar.
