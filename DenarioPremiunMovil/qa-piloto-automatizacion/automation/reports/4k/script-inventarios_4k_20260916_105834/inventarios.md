# INVENTARIOS — 4k

- ✅ **DM-INV-001** Tile Inventarios → home _(botones: INVENTARIO, BUSCAR)_
- ✅ **DM-INV-002** Click INVENTARIO → form _(tabs: [General, Inventario, Resumen, Adjuntos]; Inventario disabled: true)_
- ✅ **DM-INV-004** Seleccionar cliente _("CASA DE REPUESTOS ISUZU MARICHCódigo: C.0398 Saldo Bs: 12.76" · tabs habilitadas)_
- ✅ **DM-INV-REQ-001** REQ · Enviar habilitado al iniciar la transacción _(nace habilitado)_
- ✅ **DM-INV-REQ-002** REQ · Rechaza el envío con obligatorios vacíos y dice qué falta _(C1 ok · C2 ok vía alerta — "Denario Inventario Debe seleccionar al menos un producto para el inven" · Enviar quedó DESHAB)_
- ✅ **DM-INV-008** Tab Inventario → lista productos _(4 ítems visibles)_
- ✅ **DM-INV-010** Click producto → modal captura _(modal abierto (intento 2))_
- ✅ **DM-INV-011** Llenar campos modal _(cantidad: 5; expirationBatch: true; lote: LOTE-QA-0488)_
- ✅ **DM-INV-012** Aceptar modal → producto marcado
- ✅ **DM-INV-016** Tab Resumen → productos capturados _(1 ítems (app-inventario ion-row))_
- ⬜ **DM-INV-017** Pedido Sugerido visible _(suggestedOrderByDispatchAndReturn=false)_
- ⬜ **DM-INV-020** Días para siguiente inventario _(suggestedOrderByDispatchAndReturn=false)_
- ✅ **DM-INV-021** Click Guardar → Guardado _(alerts: "Aceptar"/"OK" · BD-SAVED(st=3))_
- ✅ **DM-INV-REQ-003** REQ · Sin pestaña en rojo falso con el formulario completo (F1) _(4 pestaña(s), ninguna en rojo con el formulario completo)_
- ✅ **DM-INV-022** Click Enviar → Enviado _(ref: N/A · BD-LOCAL-OK(id=104,st=1) · BD-FIELD-OK)_
- ✅ **DM-INV-023** BUSCAR → lista _(1 ítems)_
- ✅ **DM-INV-025** Searchbar filtra _("C.0398" → 1 resultado(s))_
- ✅ **DM-INV-026** Click Guardado → form abre _((defecto conocido: puede abrir en tab General))_
- ✅ **DM-INV-028** Trash Guardado → desaparece _(alert: "OK" · form visible: false)_

**Resumen:** PASS:17 · N/A:2
_Tiempo: 122.1s_