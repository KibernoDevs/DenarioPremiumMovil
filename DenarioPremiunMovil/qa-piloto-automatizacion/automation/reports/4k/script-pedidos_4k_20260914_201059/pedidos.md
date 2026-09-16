# PEDIDOS — 4k

- ✅ **DM-PED-001** Tile Pedidos → home del módulo _(botones: PEDIDO, BUSCAR, COPIAR)_
- ✅ **DM-PED-002** Form de pedido con tabs bloqueadas sin cliente _(tabs: General · Pedido(bloq) · Total(bloq) · Adjunto(bloq))_
- ✅ **DM-PED-006** Seleccionar cliente → tabs habilitadas _("EURO REPUESTOS FIOVAL, C.A. (C.0010)" (vía componente, 50 clientes cargados en 0 ronda/s) · tabs libres: 4 · lockSegments: false · hasClient: true · confirmación(es) aceptada(s): Este cliente tiene deuda vencida, ¿Desea)_
- ✅ **DM-PED-REQ-001** REQ · Enviar habilitado al iniciar la transacción _(nace habilitado)_
- ✅ **DM-PED-REQ-002** REQ · Rechaza el envío con obligatorios vacíos y dice qué falta _(C1 ok · C2 ok vía alerta — "Denario Debe agregar al menos un producto al pedido." · Enviar quedó DESHAB)_
- ✅ **DM-PED-VG-001** Mapa de VGs de cabecera (selects del Tab General) _(6 select(s) con cliente (antes: 1) — Empresa="DIESEL" | Moneda="USD" | Sucursal="AV. USLAR ENTRE LARA Y GIRARDO" | Tipo Pedido="PEDIDO ESTANDAR" | Lista de Precio="PRECIO 1" | Condición de pago="21 DIAS")_
- ✅ **DM-PED-015** Tab Pedido → catálogo con productos _(variante "drilldown-o-anidado" · categorías: 4 · accordions: 0)_
- ✅ **DM-PED-029** Con el carrito vacío, el pedido no se puede guardar _(carrito: 0 líneas · Guardar: habil · Enviar: deshab · al pulsar Guardar: "Denario · Debe agregar al menos un producto al pedido." · sigue en el formulario: true · ℹ️ los botones nacen habilitados, pero la app valida al pulsar y dice qué falta — que es el criterio C2 del REQ del botón Enviar, no un defecto)_
- ✅ **DM-PED-017** Cargar cantidad → la línea entra al carrito _(producto "1R1807-4K" en "FILTROS 1" · cantidad en pantalla: 2 · líneas en carrito: 1)_
- ✅ **DM-PED-VG-002** Mapa de VGs de línea (selects del panel de producto) _(3 select(s): (sin etiqueta)="PRECIO 1"(disabled)[1] · (sin etiqueta)="UNIDAD"[1] · (sin etiqueta)="PUNTO 1"[5] · descuento por producto: no · IVA: no · almacén: no · lista de precio: no)_
- ✅ **DM-PED-024** Tab Total con los importes del pedido _(Base: 27 · Descuento: null · IVA: null · Total: 27)_
- ⬜ **DM-PED-IVA-001** IVA de línea reflejado en el Tab Total _(el panel de línea no ofrece selector de IVA y el Tab Total marca IVA null ⇒ cliente sin IVA en pedidos (userCanSelectIVA/vatExemptProducts off). Coherente, no hay qué medir)_
- ⬜ **DM-PED-DSC-001** Descuento por producto aplica y baja el total _(el panel de línea no ofrece "% Descuento" ⇒ userCanSelectProductDiscount=false. La ausencia del selector ES la señal de la VG, no un fallo)_
- ⬜ **DM-PED-DSC-002** Descuento global aplica y baja el total _(el Tab Total no ofrece selector de descuento global ⇒ userCanSelectGlobalDiscount=false. Selects presentes: ninguno)_
- ✅ **DM-PED-TOT-001** Aritmética del Tab Total (Base − Desc + IVA = Total) _(27 − 0 + 0 = 27.0000 vs Total 27 · diferencia 0.0000 (tolerancia 0.03 por redondeo de presentación, 1 línea/s))_
- ✅ **DM-PED-026** Borrar línea desde el Tab Total → recalcula _(líneas 1 → 0 · Total 27 → 0)_
- ✅ **DM-PED-030** Guardar pedido → confirma y el pedido queda guardado _(pregunta: "¿Desea guardar el pedido?" [Cancelar/Aceptar] → respuesta: "Pedido Guardado" [OK] · comentario: "Test-PED-061277" · en la BD local: co_order=1789431070750.0, st_delivery=3)_
- ✅ **DM-PED-REQ-003** REQ · Sin pestaña en rojo falso con el formulario completo (F1) _(4 pestaña(s), ninguna en rojo con el formulario completo)_
- ✅ **DM-PED-031** Enviar pedido → llega a la nube (y UNA sola fila) _(2 alert(s): ¿Desea Enviar el pedido? [Cancelar/Aceptar] → Su Pedido será enviado [OK] · Nro.Ref: no anunciado · home tras enviar: true · ☁ 1 fila(s) con la marca Test-PED-061277: 2599/1789431070750.0 27.0000 USD st=1 · BD-OK (id_order=2599, st_delivery=1, líneas=1) · payload↔nube: BD-FIELD-MISMATCH (da_order: payload='2026-09-14 20:12:17' vs nube='2026-09-15T00:12:17.000Z') (4 POST capturado/s))_
- ✅ **DM-PED-034** BUSCAR → el searchbar filtra en tiempo real _(10 ítems → "ZZZZZZ" → 0 → al vaciar → 10)_
- ✅ **DM-PED-035** Abrir un pedido de la lista → formulario rehidratado _(tabs: General · Total · Adjunto · comentario rehidratado: "Test-PED-061277")_
- ⬜ **DM-PED-032** Atrás con cambios → modal Guardar/Salir sin guardar/Cancelar _(no apareció el dirty-guard — el form estaba pristine (salida directa; ver nota del selector: no es FAIL))_
- ⬜ **DM-PED-037** Borrar un pedido Guardado desde la lista _(sin botón de borrado en la lista (10 ítem/s): sólo los Guardado lo muestran)_

**Resumen:** PASS:18 · N/A:5
_Tiempo: 125.5s_