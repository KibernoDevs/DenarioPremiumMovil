# DEPOSITOS — 4k

- ✅ **DM-DEP-001** Tile Depósitos → home _(botones: DEPÓSITO, BUSCAR)_
- ✅ **DM-DEP-002** Click DEPÓSITO → form _(banco: true; tab Cobros disabled: true)_
- ✅ **DM-DEP-REQ-001** REQ · Enviar habilitado al iniciar la transacción _(nace habilitado)_
- ✅ **DM-DEP-REQ-002** REQ · Rechaza el envío con obligatorios vacíos y dice qué falta _(C1 ok · C2 ok vía alerta — "Denario Depósito Seleccione un banco para continuar." · Enviar quedó DESHAB)_
- ✅ **DM-DEP-004** Seleccionar banco _("PROVINCIAL - *** 0179088" (3 opciones))_
- ✅ **DM-DEP-005** Fecha Doc seleccionada _(fecha: 14/9/2026)_
- ✅ **DM-DEP-006** Nro. Plantilla + cobro → Guardar _(17 cobros; Guardar enabled=true)_
- ✅ **DM-DEP-009** Click Guardar → Guardado _(alert: "Aceptar"; 5 ítems · BD-SAVED(st=3))_
- ✅ **DM-DEP-010** BUSCAR → lista _(5 ítems)_
- ✅ **DM-DEP-014** Click Guardado → form con datos _(Nro.Plantilla: "DEP-QA-466231")_
- ✅ **DM-DEP-REQ-003** REQ · Sin pestaña en rojo falso con el formulario completo (F1) _(4 pestaña(s), ninguna en rojo con el formulario completo)_
- ✅ **DM-DEP-017** Click Enviar → Enviado _(ref: N/A · BD-LOCAL-OK(id=43,st=1) · BD-FIELD-MISMATCH (da_deposit: payload='2026-09-14 20:34:27' vs nube='2026-09-15T00:34:27.000Z'))_
- ✅ **DM-DEP-018** BUSCAR tras enviar → lista _(5 ítems)_
- ✅ **DM-DEP-019** Click Enviado → solo lectura _(sin Guardar/Enviar/trash: true)_
- ✅ **DM-DEP-020** Trash Guardado → desaparece _(ítems con trash tras borrar: 0)_

**Resumen:** PASS:15
_Tiempo: 70.6s_