# Escrituras de prueba pendientes de deshacer

Datos y configuraciones que **nosotros** cambiamos en la BD o en la web de un cliente para
poder probar algo, y que **siguen puestos**.

**Por qué existe este archivo:** una VG que dejamos cambiada no se nota. La próxima corrida
mide contra una configuración que nadie recuerda haber tocado, y el resultado parece un
defecto del producto. Es la forma más cara de perder una tarde.

**Cómo se usa**
- Se anota **en el momento** de hacer la escritura, no al final del día.
- Cuando se deshace, **se borra la fila**. No se tacha ni se marca «listo»: este archivo
  vacío significa «no debemos nada», y esa es toda su utilidad.
- Si una escritura se vuelve permanente porque al cliente le sirve, también se borra de
  aquí y se anota como valor en su `.yaml`.

---

## IMPORTADORA 4K

| Desde | Qué cambiamos | Para qué | Cómo se deshace |
|---|---|---|---|
| 07/09 | **`clientBankAccount`** pasó de `false` a **`true`** | ver si llegaba la lista de Banco Emisor en Transferencia | Variables Globales → Cobros, volverla a `false` |
| 07/09 | **3 cuentas** insertadas en `client_bank_account` | probar el selector de cuenta del cliente | `DELETE` de las 3 filas de prueba |
| 07/09 | **3 descuentos** creados: `DESC 10 TEST` (10 % fijo), `DESC MANUAL`, `DESC MANUAL TEST` | probar el tope `maxCollectDiscount` | Empresa → Configuración → Descuentos para Cobros. ⚠ **No borrar «Probando» (80 %)**: ese es del cliente |
| 08/09 | **`RangoToleranciaPositiva`** pasó de `10` a **`49,99`** | probar decimales en la tolerancia | volverla a `10`, o dejarla si sirve al cliente |
| 02-04/09 | **Bancos creados** durante el REQ de CRUD, entre ellos `QA NUEVO BANCO` | certificar el CRUD | Datos Maestros → Bancos, deshabilitarlos |

⚠ Mientras la tolerancia esté en 49,99 y el mínimo de abono en 50, **la zona gris va de
49,99 a 99,99**. Cualquier caso de tolerancia o anticipo que se arme ahí tiene que usar esos
tramos.

---

## HIDROPONIAS

*(sin deuda)*

Preparado y **todavía sin ejecutar**: `automation/db/sql/hidroponias-asignar-corneteria-a-v3.sql`
asigna el cliente La Corneteria al vendedor V3 para poder probar DM-SUG-011. Cuando se
ejecute, se anota aquí.
