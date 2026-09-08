# Visitas — Smoke manual (dispositivo)

Checklist corta. No automatizar todavía.

1. **VIS-SAVE-001:** Nueva visita → seleccionar cliente + sucursal → Guardar y Enviar visibles/activos (sin actividades aún).
2. **VIS-SAVE-001:** Visita sync (`fromWeb`): sin iniciar → pestañas bloqueadas; Enviar OFF.
3. **VIS-SAVE-001:** Pulsar Guardar sin actividades → confirmación de guardar (borrador OK); no exige actividades.
4. **VIS-SAVE-001:** Guardar y salir sin actividades → permite guardar borrador (solo General).
5. **VIS-SAVE-001:** Añadir actividad → Guardar → confirmación `VIS_MSJ_SAVE_QUESTION` → éxito → Guardar OFF.
6. **VIS-SAVE-002:** Tras guardar → Guardar OFF → editar línea o comentario → Guardar ON → guardar de nuevo → OFF.
7. **VIS-SAVE-002 / VIS-REOPEN-001:** Reabrir visita guardada → Guardar OFF hasta primer cambio; Enviar ON si General OK (aunque `da_initial` vacío o `da_real` leftover en SAVED).
8. **VIS-SEND-001:** General OK → Enviar ON aunque falten actividades → pulsar Enviar → alerta local + hint/salto a Actividades; Enviar OFF.
9. **VIS-SEND-001:** Tras fallo de Enviar → agregar actividad → Enviar se reactiva sin Guardar.
10. **Firma (`signatureVisit`):** solo muestra el panel; no exige adjuntos. Firma dibujada solo si actividad transportista con `required_signature`.
11. **Transportista + actividad con firma:** sin firma → alerta al Enviar (no al Guardar).
12. **GPS (`userMustActivateGPS`):** sin coordenada → alerta al Enviar (no al Guardar).
13. **Peso adjuntos:** límite excedido → Guardar y Enviar OFF.
