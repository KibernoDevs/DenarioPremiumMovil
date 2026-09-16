# LOGIN — 4k

- ⬜ **DM-LOG-008** Segundo usuario en pantalla login _(has_second_user no configurado en perfil)_
- ⬜ **DM-LOG-009** Login como segundo usuario _(depende de DM-LOG-008 → N/A)_
- ⬜ **DM-LOG-017** Login post-reinstalación _(fuera de alcance smoke — requiere reinstalación)_
- ✅ **DM-LOG-002** Enviar vacío → alert campos obligatorios _(alert: "Usuario y/o password no pueden ser vacios")_
- ❌ **DM-LOG-003** Contraseña incorrecta → alert de error _(alert: "Está intentando sincronizar con un usuario que es diferente al previamente ingresado, de aceptar la sincronización todos los datos anteriores serán borrados. ¿Está de acuerdo?")_
- ✅ **DM-LOG-004** Checkbox "Recordar Usuario" togglea _(antes: false · después: true · cambió: true)_
- ❌ **DM-LOG-001** Login correcto → entra a app _(no salió de login tras submit)_
- 🚫 **DM-LOG-011** DM-LOG-011 _(DM-LOG-001 falló — no se pudo entrar)_
- 🚫 **DM-LOG-012** DM-LOG-012 _(DM-LOG-001 falló — no se pudo entrar)_

**Resumen:** N/A:3 · PASS:2 · FAIL:2 · BLOCKED:2
_Tiempo: 16.6s_