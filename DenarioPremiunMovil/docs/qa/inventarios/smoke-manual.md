# Inventarios — Smoke manual (dispositivo)

Checklist corta. No automatizar todavía.

1. **INV-SAVE-001:** Nuevo inventario → seleccionar cliente con sucursal → Guardar y Enviar visibles/activos (General OK).
2. **INV-SAVE-001:** Pulsar Guardar sin productos → modal de error (`INV_MSJ_ERROR_TYPESTOCKS`); no abre confirmación.
3. **INV-SAVE-001:** Completar al menos un producto (cantidad, unidad, fecha; lote si `expirationBatch`) → Guardar → confirmación → éxito.
4. **INV-SAVE-002:** Tras guardar → Guardar OFF → editar comentario o fila de producto → Guardar ON → guardar de nuevo → OFF.
5. **INV-SAVE-002:** Reabrir inventario guardado → Guardar OFF hasta primer cambio de usuario.
6. **INV-SEND-001:** General OK → Enviar ON aunque falten productos por completar → pulsar Enviar → modal de error; fila incompleta resaltada en Actividades.
7. **INV-SEND-001:** Inventario completo → Enviar → confirmación → cola/envío según conexión.
8. **Firma (`signatureStock`):** solo muestra el panel; no exige adjuntos al Guardar/Enviar (sin `requiredStockAttachments`).
9. **GPS (`userMustActivateGPS`):** sin coordenada → modal al Enviar.
10. **INV-GPS-001:** con GPS ya obtenida, cambiar cliente (con y sin toma) → Enviar no pide GPS de nuevo.
