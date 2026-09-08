# SUGERIDO — hidroponias

- ✅ **DM-SUG-002** VG suggestedOrderByDispatchAndReturn activa _(leída del equipo)_
- ✅ **DM-SUG-001** Migración v22 → tablas del sugerido creadas _(17 clientes · 167 facturas · última: 2026-09-07)_
- 🚫 **DM-SUG-011** Despacho SUMA un producto repetido entre facturas del mismo día _(ningún cliente del equipo tiene un producto en 2+ facturas de su última fecha. Escenario elegido: 100113 con 3 facturas y 0 repetidos. Se desbloquea asignando a este vendedor un cliente que sí lo tenga (ver automation/db/sql/hidroponias-asignar-corneteria-a-v3.sql))_
- ✅ **DM-SUG-003** Escenario elegido desde el equipo _(100113 HIPERMERCADO PARAMO, C.A (suc 680) · 2026-09-07 · 3 facturas · 9 producto(s) que el bug ocultaba · 5 de control)_
- 🚫 **DM-SUG-019** days_since_last se calcula, no se teclea _(no se llegó a la pestaña General de un inventario en curso)_
- 🚫 **DM-SUG-021** days_until_next tecleado (10) se respeta _(sin campo)_
- 🚫 **DM-SUG-003b** Resumen → «Pedido Sugerido» abre la vista previa _(no abrió — ¿hay un inventario en curso con productos cargados?)_
- 🚫 **DM-SUG-010** DM-SUG-010 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-012** DM-SUG-012 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-013** DM-SUG-013 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-022** DM-SUG-022 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-023** DM-SUG-023 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-026** DM-SUG-026 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-030** DM-SUG-030 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-031** DM-SUG-031 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-032** DM-SUG-032 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-034** DM-SUG-034 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-035** DM-SUG-035 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-036** DM-SUG-036 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-040** DM-SUG-040 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-041** DM-SUG-041 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-042** DM-SUG-042 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-043** DM-SUG-043 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-050** DM-SUG-050 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-052** DM-SUG-052 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-053** DM-SUG-053 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-060** DM-SUG-060 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-061** DM-SUG-061 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-062** DM-SUG-062 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-063** DM-SUG-063 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-070** DM-SUG-070 _(no se pudo abrir la vista previa del sugerido)_
- 🚫 **DM-SUG-071** DM-SUG-071 _(no se pudo abrir la vista previa del sugerido)_

**Resumen:** PASS:3 · BLOCKED:29
_Tiempo: 5.3s_