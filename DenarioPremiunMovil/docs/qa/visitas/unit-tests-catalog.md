# Visitas — Catálogo de tests unitarios

**Spec principal:** `src/app/visitas/visitas.service.spec.ts`

**Correr:**

```bash
cd DenarioPremiunMovil
npx ng test --include=src/app/visitas/visitas.service.spec.ts --no-watch --browsers=ChromeHeadless
```

**Smoke dispositivo:** [smoke-manual.md](./smoke-manual.md)

Los unitarios validan **lógica de botones Guardar/Enviar** y validación al click. Overlay, SQLite real, GPS y flujo Home→módulo quedan en smoke manual.

---

## 1. Guardar / baseline (`visitas.service`)

| ID / caso | Qué hace |
|-----------|----------|
| **VIS-SAVE-001** | `updateSaveButtonAvailability`: General OK + sin baseline → Guardar ON. |
| **VIS-SAVE-001** | Baseline limpio sin dirty → Guardar OFF aunque General OK. |
| **VIS-SAVE-001** | `hasVisitSaveErrors` false sin actividades si General OK (borrador). |
| **VIS-SAVE-001** | Sin cliente → `hasVisitSaveErrors` + mensaje General. |
| **VIS-SAVE-002** | `markVisitDirty` tras `applyVisitPersistSucceededBaseline` → Guardar ON de nuevo. |
| — | `markVisitOpenedFromPersistedCopy` (reapertura) → Guardar OFF hasta dirty (smoke manual). |

## 2. Enviar / validación al click

| ID / caso | Qué hace |
|-----------|----------|
| **VIS-SEND-001** | `updateSendButtonAvailability`: General OK → Enviar ON sin eventos. |
| **VIS-SEND-001** | `hasVisitFieldErrors` true con lista de eventos vacía + foco `actividades`. |
| **VIS-SEND-001** | Tras `sendBlockedByFields`, `notifyVisitEdited` reactiva Enviar. |
| **VIS-SEND-001** | Sin cliente → `VIS_MSJ_ERROR_NO_CLIENT`. |
| **VIS-SEND-001** | `fromWeb` + `initialLock` → `VIS_MSJ_ERROR_NOT_STARTED`. |
| **VIS-SEND-001** | `required_event` + motivo vacío → evento incompleto. |
| **VIS-SEND-001** | `stVisit` TO_SEND o VISITED / viewOnly → read-only, botones OFF. |
| **VIS-REOPEN-001** | SAVED + `daReal` leftover → no read-only; Enviar ON / Guardar OFF. |
| **VIS-REOPEN-001** | Pause dirty en hidratación: `notifyVisitEdited` no marca dirty. |
| **VIS-SEND-001** | `signatureVisit` sin adjuntos → **no** error (solo UI). |

## Fuera de unitarios (manual / N/A)

- Hints visuales en `visita.component` tras `sendValidationAttempted`.
- Confirmación Guardar (`VIS_MSJ_SAVE_QUESTION`) y Enviar (`VIS_MENSAJE_ENVIAR`) en header inline.
- Cola AutoSend y persistencia SQLite (`saveVisit` / `saveIncidences`).
