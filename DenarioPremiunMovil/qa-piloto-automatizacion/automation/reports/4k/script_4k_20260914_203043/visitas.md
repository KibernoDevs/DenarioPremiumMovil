# VISITAS — 4k

- ✅ **DM-VIS-001** Click módulo Visitas → home _(botones: NUEVA VISITA, RUTA DE HOY, Ver mejor ruta · mejorRuta: true)_
- ✅ **DM-VIS-004** RUTA DE HOY → lista + searchbar _(searchbar: true · ítems: 4 (puede ser 0 = OK))_
- ✅ **DM-VIS-006** Trash visita Guardada → desaparece _(sin visitas Guardadas previas en lista)_
- ✅ **DM-VIS-003** NUEVA VISITA → form / tabs disabled _(tabs: [GENERAL, ACTIVIDADES, ADJUNTOS] · ACTIVIDADES disabled: true · ADJUNTOS disabled: true)_
- ✅ **DM-VIS-DATA-001** Cliente de prueba con sucursal utilizable _("EURO REPUESTOS FIOVAL, C.A." habilitó el formulario al primer intento)_
- ✅ **DM-VIS-010** Seleccionar cliente → tabs habilitadas _("EURO REPUESTOS FIOVAL, C.A.Código: C.0010 Saldo Bs: 2.185.44" · ACTIVIDADES: true · ADJUNTOS: true · sucursal: false)_
- ✅ **DM-VIS-REQ-001** REQ · Enviar habilitado al iniciar la transacción _(nace habilitado)_
- ✅ **DM-VIS-REQ-002** REQ · Rechaza el envío con obligatorios vacíos y dice qué falta _(C1 ok · C2 ok vía alerta — "¡Alerta! Debe agregar al menos una actividad a la visita." · Enviar quedó DESHAB)_
- ✅ **DM-VIS-014** AÑADIR ACTIVIDAD/EVENTO → modal _(select: true · input: true · btns: [CANCELAR, Agregar])_
- ✅ **DM-VIS-015** Agregar actividad → evento con su comentario _(comentario "Test-VIS-015-2562" LEÍDO en la fila del evento · eventos: 1)_
- ✅ **DM-VIS-019** Click Guardar → Guardado _(alert: "Aceptar" · form abierto: true · BD-SAVED(st=0))_
- ✅ **DM-VIS-023** Click Guardado → form editable _(tabs: [GENERAL, ACTIVIDADES, ADJUNTOS] · guardar: false · enviar: true)_
- ✅ **DM-VIS-031** Tab Actividades → eventos en Guardado _(eventos en lista: 1)_
- ✅ **DM-VIS-032** Tab Adjuntos → acordeones _(imágenes: true · archivo(true): true · firma(false): false)_
- ✅ **DM-VIS-REQ-003** REQ · Sin pestaña en rojo falso con el formulario completo (F1) _(3 pestaña(s), ninguna en rojo con el formulario completo)_
- ✅ **DM-VIS-020** Click Enviar → Enviado _(alerts: [Aceptar,OK,OK] · home: true · BD-OK(id=36778,st=2,visited=true) · BD-N/A)_
- ✅ **DM-VIS-021** Back con cambios → modal 3 opciones _(opciones: [Guardar y salir, Salir sin guardar, Cancelar])_
- ✅ **DM-VIS-022** "Salir sin guardar" → visita no guardada _(salida: "Salir sin guardar" · ítems antes: 1 · después: 5)_

**Resumen:** PASS:18
_Tiempo: 119.9s_