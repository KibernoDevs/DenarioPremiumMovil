# Smoke manual — Pedidos Guardar/Enviar

1. **PED-SAVE-001:** Nuevo pedido → seleccionar cliente + sucursal → Guardar y Enviar visibles/activos (sin productos aún).
2. **PED-SAVE-001:** Pulsar Guardar/Enviar sin productos → modal de error; no abre confirmación.
3. **PED-SAVE-001:** Añadir producto → Guardar → confirmación `PED_MSJ_SAVE_QUESTION` → éxito → Guardar OFF.
4. **PED-SAVE-002:** Tras guardar → Guardar OFF → editar línea o comentario → Guardar ON → guardar de nuevo → OFF.
5. **PED-SAVE-002:** Reabrir pedido guardado → Guardar OFF hasta primer cambio; Enviar ON si General OK.
6. **PED-SEND-001:** General OK → Enviar ON aunque falten productos → pulsar Enviar → modal + hint en pestaña Pedido.
7. **validateNuOrder=true** sin `#` → pestañas bloqueadas; Enviar OFF; hint en número de orden tras intento.
8. **requiredCommentOrder=true** → comentario obligatorio solo en editable; pedido enviado vacío sigue abriendo (**PED-COMMENT-001**).
9. **userMustActivateGPS** → modal al Enviar sin GPS si está activo. `signatureOrder` solo muestra firma (no exige adjuntos).
10. Enviar completo → confirmación `PED_PREGUNTA_GUARDADO` → éxito tras persistir + AutoSend.
11. **userCanChangeUnits:** ausente/`true` → selector de unidad editable (salvo `unitByPriceList=true`). `false` → selector disabled; unidad actual se muestra.
