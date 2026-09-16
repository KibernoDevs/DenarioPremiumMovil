# DEVOLUCIONES — 4k

- ✅ **DM-DEV-001** Tile Devoluciones → home con 2 botones _(botones: DEVOLUCIÓN, BUSCAR)_
- ✅ **DM-DEV-002** DEVOLUCIÓN → form / tabs disabled _(tabs: ["General","Productos","Adjuntos"] · Productos disabled: true · Adjuntos disabled: true)_
- ✅ **DM-DEV-003** Tab disabled sin cliente → no cambia _(segment antes: default · después: default)_
- ✅ **DM-DEV-017** Botones guardar/enviar disabled sin cliente _(guardar visible: true disabled: true · enviar visible: true disabled: true)_
- ✅ **DM-DEV-005** Búsqueda ZZZZZZZ en selector → sin resultados _(msg: "No hay clientes disponibles")_
- ✅ **DM-DEV-004** validateReturn: la FACTURA habilita las tabs (no el cliente) _(cliente "INVERSIONES MOSTEIRO, C.A.Código: C.0028 Saldo Bs: 380.190,0" → PRODUCTOS deshabilitada (correcto); factura "Nro Factura: CJA-00020600 Fecha: 23/04/2026" (12 disponibles) → PRODUCTOS habilitada)_
- ✅ **DM-DEV-DATA-001** Cliente de prueba con facturas devolvibles _("INVERSIONES MOSTEIRO, C.A." dejó el módulo ejecutable al primer intento)_
- ✅ **DM-DEV-008** VG validateReturn: campo Factura visible tras cliente _(invoiceSelect visible: true)_
- ✅ **DM-DEV-009** Selector de facturas lista las facturas del cliente _(12 factura(s) en InvoiceeSelectModal · elegida: "Nro Factura: CJA-00020600 Fecha: 23/04/2026" ⚠ la del perfil no apareció; se tomó la primera)_
- ✅ **DM-DEV-010** Factura elegida queda en el campo y habilita PRODUCTOS _(campo Factura: "CJA-00020600" · elegida en el modal: "Nro Factura: CJA-00020600 Fecha: 23/04/2026")_
- ✅ **DM-DEV-REQ-001** REQ · Enviar habilitado al iniciar la transacción _(nace habilitado)_
- ✅ **DM-DEV-REQ-002** REQ · Rechaza el envío con obligatorios vacíos y dice qué falta _(C1 ok · C2 ok vía alerta — "Denario Devolución Debe agregar al menos un producto a la devolución." · Enviar quedó DESHAB)_
- ❌ **DM-DEV-006** Campos editables Tab General (Responsable/Comentario) _(responsable: "null")_
- ❌ **DM-DEV-007** Fecha devolución solo lectura (button disabled) _(fechaDevButton disabled: null)_
- ✅ **DM-DEV-011** Tab Productos → botón Agregar Producto visible _(botonAddAmarillo visible: true)_
- ✅ **DM-DEV-012** Seleccionar estructura → lista de productos _(estructura: "(sin estructura — productos de la factura)")_
- ✅ **DM-DEV-013** Seleccionar producto → acordeón Cantidad/Unidad/Motivo _(producto: "ESTOPERA TRASERA CIGUENAL FORD CARGO 172")_
- ✅ **DM-DEV-014** Ingresar cantidad (dentro del máximo declarado) → queda en el campo _(máximo declarado por la pantalla: NINGUNO (no se declara tope; se pidió 1) · cantidad LEÍDA del campo: "1" · unidad: true · motivo: true)_
- ✅ **DM-DEV-015** Tab Adjuntos → acordeones visibles _(imágenes: true · archivo: true · firma: true · acordeones visibles: 3)_
- ✅ **DM-DEV-016** Guardar devolución → mensaje confirmación _(alert: "¿Desea guardar la devolución?")_
- ✅ **DM-DEV-019** Guardar + BUSCAR → aparece Guardado en lista _(ítems: 3 · Guardado: 1)_
- ✅ **DM-DEV-022** Abrir Guardado → form editable con tabs accesibles _(tabs accesibles: 3)_
- ✅ **DM-DEV-REQ-003** REQ · Sin pestaña en rojo falso con el formulario completo (F1) _(3 pestaña(s), ninguna en rojo con el formulario completo)_
- ✅ **DM-DEV-018** Enviar devolución → modal confirmación → home módulo _(confirm: "¿Desea enviar la devolución?" · envioMsg: "¡Su Devolución será enviada!" · home: true · BD-FIELD-MISMATCH (da_return: payload='2026-09-14 20:57:41' vs nube='2026-09-15T00:57:41.000Z'))_
- ✅ **DM-DEV-VAL-001** Cantidad mayor a la facturada → la app bloquea el envío _(intentado 3 sobre un máximo de 1 · la app respondió: "Cantidad inválida para la unidad seleccionada.")_
- ✅ **DM-DEV-021** BUSCAR → lista con searchbar _(searchbar: true · ítems: 5)_
- ✅ **DM-DEV-023** Abrir Enviado → solo lectura, sin botones guardar/enviar _(saveHidden: true · sendHidden: true · clienteDisabled: true)_
- ✅ **DM-DEV-024** Eliminar Guardado → modal + desaparece de lista _(antes: 2 Guardado · después: 1 · btn: "Eliminar")_
- ✅ **DM-DEV-025** Atrás desde lista → home módulo _(home visible: true)_
- ✅ **DM-DEV-020** Atrás sin guardar → modal Salir/Guardar → "Salir sin guardar" → home _(modal: true · salió por modal: true · home: true)_

**Resumen:** PASS:28 · FAIL:2
_Tiempo: 194.5s_