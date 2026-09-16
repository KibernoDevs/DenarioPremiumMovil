# LOGIN — 4k

- ⬜ **DM-LOG-008** Segundo usuario en pantalla login _(has_second_user no configurado en perfil)_
- ⬜ **DM-LOG-009** Login como segundo usuario _(depende de DM-LOG-008 → N/A)_
- ⬜ **DM-LOG-017** Login post-reinstalación _(fuera de alcance smoke — requiere reinstalación)_
- ✅ **DM-LOG-002** Enviar vacío → alert campos obligatorios _(alert: "Usuario y/o password no pueden ser vacios")_
- ✅ **DM-LOG-003** Contraseña incorrecta → alert de error _(alert: "Usuario y/o contraseña incorrectos.")_
- ✅ **DM-LOG-004** Checkbox "Recordar Usuario" togglea _(antes: false · después: true · cambió: true)_
- ✅ **DM-LOG-001** Login correcto → entra a app _(credenciales aceptadas)_
- ✅ **DM-LOG-011** Sync screen visible con progress-bar _(progress: true · texto: "Sincronizando - Dirección de Clientes
Por favor espere...")_
- ✅ **DM-LOG-012** HOME visible con módulos _(módulos (10): [Visitas, Inventarios, Pedidos, Devoluciones, Cobros, Depósitos, Vendedores, Productos, Clientes, Sincronizar])_

**Resumen:** N/A:3 · PASS:6
_Tiempo: 46.9s_