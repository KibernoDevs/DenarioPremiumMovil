# CLIENTES — 4k

- ✅ **DM-CLT-001** Navegar a Clientes desde Home _(3 botones visibles)_
- ✅ **DM-CLT-002** Click CLIENTES → lista de clientes _(50 clientes)_
- ✅ **DM-CLT-003** Buscar "A" en lista _(50 resultados)_
- ✅ **DM-CLT-009** Click en cliente → detalle _(detalle visible)_
- ✅ **DM-CLT-013** Tab "Doc. de Venta" _(12 filas en tabla)_
- ✅ **DM-CLT-017** Volver a lista desde detalle
- ✅ **DM-CLT-016** Volver a home clientes desde lista
- ✅ **DM-CLT-019** CLIENTE POTENCIAL → formulario con botones disabled _(9 inputs; Guardar disabled=false, Enviar disabled=false)_
- ✅ **DM-CLT-REQ-001** REQ · Enviar habilitado al iniciar la transacción _(nace habilitado)_
- ✅ **DM-CLT-REQ-002** REQ · Rechaza el envío con obligatorios vacíos y dice qué falta _(C1 ok · C2 ok vía alerta + borde rojo — "Denario Clientes Nombre obligatorio." · Enviar quedó HABIL)_
- ✅ **DM-CLT-021** Llenar campos → botones Guardar/Enviar habilitados _(Guardar enabled=true, Enviar enabled=true; idEmpresa: none (disabled (1 empresa auto-asignada)))_
- ✅ **DM-CLT-024** Click Guardar → cliente potencial guardado _(alert btn: "Aceptar"; "Test-CLT-SMOKE-096837" visible en BUSCAR · BD-SAVED(st=0))_
- ✅ **DM-CLT-REQ-003** REQ · Sin pestaña en rojo falso con el formulario completo (F1) _(2 pestaña(s), ninguna en rojo con el formulario completo)_
- ✅ **DM-CLT-026** Re-abrir Guardado → Enviar → 3 alertas → Enviado _(ref potencial: 98; en home clientes: 3 botones · BD-LOCAL-OK(id=98,st=2) · BD-N/A)_
- ✅ **DM-CLT-031** Borrar cliente Guardado → desaparece de lista _("Test-CLT-DEL-096837" eliminado OK)_

**Resumen:** PASS:15
_Tiempo: 94.9s_