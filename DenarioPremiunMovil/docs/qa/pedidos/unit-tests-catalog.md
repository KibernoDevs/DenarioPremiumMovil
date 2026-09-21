# Catálogo unitarios — Pedidos Guardar/Enviar

Archivo: `src/app/pedidos/pedidos.service.spec.ts`

## Guardar (PED-SAVE-001 / PED-SAVE-002)

| Caso | Qué prueba |
|------|------------|
| **PED-SAVE-001** | `updateSaveButtonAvailability`: General OK + dirty → Guardar ON. |
| **PED-SAVE-001** | Baseline limpio sin dirty → Guardar OFF aunque General OK. |
| **PED-SAVE-002** | `markOrderDirty` tras `applyOrderPersistSucceededBaseline` → Guardar ON de nuevo. |

## Enviar (PED-SEND-001)

| Caso | Qué prueba |
|------|------------|
| **PED-SEND-001** | `updateSendButtonAvailability`: General OK → Enviar ON sin productos. |
| **PED-SEND-001** | `hasOrderFieldErrors` true con carrito vacío. |
| **PED-SEND-001** | Sin cliente → `PED_MSJ_ERROR_NO_CLIENT`. |
| **PED-SEND-001** | `validateNuOrder` + `nuPurchase` vacío → error número de orden. |
| **PED-SEND-001** | `requiredCommentOrder` + comentario vacío → error comentario. |
| **PED-SEND-001** | `!pedidoModificable` → read-only, botones OFF. |
| **PED-SEND-001** | `validateWarehouses` + línea sin almacén → error almacén. |
| **PED-SEND-001** | `signatureOrder` sin adjuntos → **no** error (solo UI). |
| **PED-SEND-001** | `userMustActivateGPS` + sin coordenadas → error GPS. |
| **PED-SUG-GPS-001** | Pedido Sugerido copia GPS inventario; sin GPS + flag ON → `getCurrentPosition`. |
