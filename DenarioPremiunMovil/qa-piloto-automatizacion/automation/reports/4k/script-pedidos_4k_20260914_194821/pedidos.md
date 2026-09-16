# PEDIDOS — 4k

- ✅ **DM-PED-001** Tile Pedidos → home del módulo _(botones: PEDIDO, BUSCAR, COPIAR)_
- ✅ **DM-PED-002** Form de pedido con tabs bloqueadas sin cliente _(tabs: General · Pedido(bloq) · Total(bloq) · Adjunto(bloq))_
- ✅ **DM-PED-006** Seleccionar cliente → tabs habilitadas _("EURO REPUESTOS FIOVAL, C.A. (C.0010)" (vía componente, 50 clientes cargados en 0 ronda/s) · tabs libres: 4 · lockSegments: false · hasClient: true)_
- ✅ **DM-PED-REQ-001** REQ · Enviar habilitado al iniciar la transacción _(nace habilitado)_
- ✅ **DM-PED-REQ-002** REQ · Rechaza el envío con obligatorios vacíos y dice qué falta _(C1 ok · C2 ok vía alerta — "Denario Debe agregar al menos un producto al pedido." · Enviar quedó DESHAB)_
- ✅ **DM-PED-VG-001** Mapa de VGs de cabecera (selects del Tab General) _(6 select(s) con cliente (antes: 1) — DIESEL="[object Object]" | USD="USD" | AV. USLAR ENTRE LARA Y GIRARDOT LOCAL NR="[object Object]" | PEDIDO ESTANDAR="[object Object]" | PRECIO 1="[object Object]" | 21 DIAS="[object Object]" · ⚠ YAML multiCurrency=true pero no hay selector de Moneda)_
- ✅ **DM-PED-015** Tab Pedido → catálogo con productos _(variante "drilldown-o-anidado" · categorías: 4 · accordions: 0)_
- ❌ **DM-PED-029** Sin ítems → Guardar/Enviar deshabilitados _(carrito: 0 líneas · Guardar: habil · Enviar: deshab)_
- ❌ **DM-PED-017** Cargar cantidad → la línea entra al carrito _("4400-01202" no apareció en 4 categoría(s): FILTROS 1, INYECCION 3, MISCELANEOS 4, MOTOR 8 · relevo: el árbol no muestra ni productos ni categorías)_
- 🚫 **DM-PED-VG-002** Mapa de VGs de línea (selects del panel de producto) _(no se llegó a expandir ningún producto (ver PED-017))_
- ❌ **DM-PED-024** Tab Total con los importes del pedido _(sin líneas en el carrito (ver PED-017))_
- 🚫 **DM-PED-IVA-001** IVA de línea reflejado en el Tab Total _(no se pudo leer el Tab Total)_
- ⬜ **DM-PED-DSC-001** Descuento por producto aplica y baja el total _(el panel de línea no ofrece "% Descuento" ⇒ userCanSelectProductDiscount=false. La ausencia del selector ES la señal de la VG, no un fallo)_
- ⬜ **DM-PED-DSC-002** Descuento global aplica y baja el total _(el Tab Total no ofrece selector de descuento global ⇒ userCanSelectGlobalDiscount=false. Selects presentes: ninguno)_
- 🚫 **DM-PED-TOT-001** Aritmética del Tab Total (Base − Desc + IVA = Total) _(no se pudieron leer las cifras (base: ?, total: ?))_
- ❌ **DM-PED-026** Borrar línea desde el Tab Total → recalcula _(sin líneas que borrar)_
- ❌ **DM-PED-030** Guardar pedido → alert de confirmación _(alert: "¿Desea guardar el pedido?" · botones: Cancelar/Aceptar · comentario: "Test-PED-703576")_
- 🚫 **DM-PED-REQ-003** REQ · Sin pestaña en rojo falso con el formulario completo (F1) _(el pedido no llegó a completarse: con el carrito vacío una pestaña en rojo es correcta y medirla aquí daría un F1 falso)_
- ❌ **DM-PED-031** Enviar pedido → confirmación y vuelta al home _(el pedido no llegó a guardarse (ver PED-030) · BD-INFO (id_order=2564, st_delivery=null, líneas=1))_
- ✅ **DM-PED-034** BUSCAR → el searchbar filtra en tiempo real _(7 ítems → "ZZZZZZ" → 0 → al vaciar → 7)_
- ✅ **DM-PED-035** Abrir un pedido de la lista → formulario rehidratado _(tabs: General · Pedido · Total · Adjunto · comentario rehidratado: "Test-PED-703576")_
- ⬜ **DM-PED-032** Atrás con cambios → modal Guardar/Salir sin guardar/Cancelar _(no apareció el dirty-guard — el form estaba pristine (salida directa; ver nota del selector: no es FAIL))_
- ✅ **DM-PED-037** Borrar un pedido Guardado desde la lista _(confirmación: "¿Seguro que quieres eliminar este pedido?" · 7 → 6 ítems)_

**Resumen:** PASS:10 · FAIL:6 · BLOCKED:4 · N/A:3
_Tiempo: 131.5s_