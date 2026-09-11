# Guión de pruebas · Rol PROMOTOR y la información financiera — 4K

**Creado:** 2026-09-10
**Cliente:** `4k` · empresa **DIESE · GRUPO 4K** · playa **CARIBE**
**Usuario de prueba:** `V.0017zonaoccidente` — rol **PROMOTOR**
**Alcance:** la variable nueva **«¿Ocultar información financiera al rol Promotor?»**, en sus **dos estados**

---

## Por qué este guión existe

El promotor no cobra: visita, levanta pedidos y hace inventario. Hasta ahora veía
**Visitas, Inventario, Productos, Clientes y Sincronizar**. La solicitud añade dos cosas:
que **pueda hacer pedidos**, y que **no vea información financiera** — ni cobros, ni
facturas, ni documentos de venta, ni saldos, ni límite de crédito.

La variable nueva gobierna lo segundo:

| Estado | Comportamiento esperado |
|---|---|
| **SÍ** | El promotor no ve cobros, facturas, documentos, saldos ni límite de crédito |
| **NO** | Comportamiento anterior del rol Promotor |

**Hay que validar los dos.** Que lo nuevo funcione sirve de poco si al apagarlo se rompe
lo que llevaba años funcionando.

🔑 **Y el riesgo real no está en lo que se oculta, sino en lo que se cuela.** Tapar el
saldo en la ficha del cliente es lo fácil y lo primero que se hace. Lo que se escapa es
el listado de documentos al armar un pedido, el color del saldo en el listado de
clientes, o una alerta de validación que nombra el límite de crédito.

---

## Antes de empezar

### 1 · Lo primero, y es una pregunta abierta

**¿La variable también habilita el módulo de Pedidos, o son cosas independientes?**
El enunciado mezcla las dos: «puede hacer pedido» y «no ve información financiera».
Puede que Pedidos se habilite por otra vía (permisos del rol) y esta variable solo
oculte lo financiero. **Resolverlo en los primeros minutos**, porque cambia qué se
espera en cada estado. Si son independientes, decirlo explícitamente en el informe.

### 2 · Prerequisitos

- APK compilada **según `COMPILAR-APK.md`**, con la rama y el commit anotados.
- Confirmar que el bundle del equipo trae el soporte de la variable **antes de medir**.
- Login de `V.0017zonaoccidente` (clave común de 4K, bloque `# Cliente: 4k`).
- Acceso web para conmutar la variable.

### 3 · Trampas conocidas, medidas el 10/09

- 🔴 **Una variable global NO baja con «Sincronizar»: solo llega con login nuevo.**
  Medido 3 de 3. Tras conmutarla hay que **cerrar sesión y volver a entrar**, y
  **verificar en el equipo** que el valor cambió antes de medir nada.
- **Guarda de empresa:** confirmar empresa y usuario en la app antes de leer la BD.
- **Mientras se toca la configuración en la web, nadie más entra ahí.** El 10/09 se
  levantó un defecto fantasma por editar la misma pantalla a la vez.

---

## Bloque A · Con la variable APAGADA — no-regresión

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-PRO-001 | Entrar con el promotor y **listar los módulos del menú** | Los de siempre: Clientes, Productos, Visitas, Inventario, Sincronizar — y Pedidos si resultó ser independiente (§1) |
| DM-PRO-002 | Ficha de un cliente | El **saldo se ve**, como antes |
| DM-PRO-003 | Listado de clientes | Se ve el indicador de saldo, con su color |
| DM-PRO-004 | Ciclo de visita completo | Funciona igual que antes |
| DM-PRO-005 | Inventario | Funciona igual que antes |
| DM-PRO-006 | Módulos que **nunca** tuvo: Cobros, Devoluciones, Depósitos | **Ausentes**, también con la variable apagada |

---

## Bloque B · Con la variable ENCENDIDA — lo que debe desaparecer

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-PRO-010 | Menú | **Clientes, Productos, Visitas, Inventario, Pedidos, Sincronizar.** Ni uno más |
| DM-PRO-011 | Ficha del cliente | **Sin saldo** y **sin límite de crédito** |
| DM-PRO-012 | Listado de clientes | **Sin saldo y sin el color** que lo indica ⚠ el color es información financiera: en Denario marca documentos vencidos |
| DM-PRO-013 | Documentos de venta del cliente | **No accesibles** por ninguna ruta |
| DM-PRO-014 | Cobros | Ausente, y **sin puerta trasera** desde la ficha del cliente ni desde la visita |
| DM-PRO-015 | Resumen de la visita | Sin datos financieros |

---

## Bloque C · Pedidos, que es lo nuevo

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-PRO-020 | Crear un pedido de principio a fin y **enviarlo** | Funciona, y **llega a la nube** |
| DM-PRO-021 | 🔎 **El selector de documentos dentro del pedido** | No debe ofrecer facturas ni documentos pendientes. Es el hueco más probable |
| DM-PRO-022 | Pedido que **supera el límite de crédito** del cliente | ⚠ Definir: ¿bloquea sin decir por qué, o deja pasar? **Si avisa nombrando el crédito, está filtrando el dato que se quiere ocultar** |
| DM-PRO-023 | Precios y descuentos del pedido | Se ven — son precio, no información financiera del cliente |
| DM-PRO-024 | El pedido en la web | Llega completo, con su vendedor correcto |

---

## Bloque D · Dónde se cuela el dato

Esto es lo que de verdad hay que cazar. **Un dato oculto en pantalla pero presente en el
modelo sigue siendo un dato entregado al dispositivo.**

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-PRO-030 | 🔑 **¿Los documentos y saldos BAJAN al equipo?** Mirar la BD local tras sincronizar | Definir con el REQ: ¿se ocultan en la UI o **no se sincronizan**? Son garantías distintas. Si bajan, decirlo: el dato está en el teléfono |
| DM-PRO-031 | Leer el **modelo de Angular** de la ficha del cliente | Si el saldo viaja en el modelo aunque no se pinte, es hallazgo |
| DM-PRO-032 | Alertas y mensajes de validación | Que ninguno nombre saldo, crédito, factura ni deuda |
| DM-PRO-033 | Buscador de clientes | Que no permita filtrar u ordenar por saldo |
| DM-PRO-034 | Pantallas secundarias: detalle de visita, histórico, reimpresiones | Sin datos financieros |

---

## Bloque E · La variable en sí

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-PRO-040 | Conmutarla en la web y **sincronizar** | ⚠ Por lo medido el 10/09, **no basta**: hace falta login nuevo. Confirmarlo aquí |
| DM-PRO-041 | Conmutarla y **volver a entrar** | El valor llega al equipo y el comportamiento cambia |
| DM-PRO-042 | Apagarla otra vez | **Se vuelve al comportamiento anterior**, sin residuos |

---

## Bloque F · Que no se lleve a nadie por delante

| ID | Escenario | Resultado esperado |
|---|---|---|
| DM-PRO-050 | Entrar con un **vendedor normal**, con la variable encendida | **Ve todo lo suyo**: cobros, documentos, saldos. La variable es solo para el rol Promotor |
| DM-PRO-051 | Un cobro creado por un vendedor | Sigue llegando a la nube con normalidad |

---

## Registros a dejar anotados

| Qué | Dónde |
|---|---|
| Pedidos creados por el promotor | referencia + `co` + si llegaron a la nube |
| Visitas e inventarios creados | referencia |
| Estado en que queda la variable al cerrar | `_escrituras-de-prueba.md` |

---

## Lo que este guión deja fuera a propósito

- El **rendimiento** de la sincronización con y sin los documentos.
- Los **permisos del rol en la web**: aquí se valida la app móvil.
- Cualquier otro rol que no sea Promotor y el vendedor de control del bloque F.
