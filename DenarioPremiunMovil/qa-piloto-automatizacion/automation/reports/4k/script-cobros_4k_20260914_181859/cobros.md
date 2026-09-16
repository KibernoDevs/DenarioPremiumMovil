# COBROS — 4k

- ⬜ **DM-COB-036** DM-COB-036 _(userCanSelectIGTF=false (IGTF inactivo))_
- ⬜ **DM-COB-044** DM-COB-044 _(userCanSelectIGTF=false (IGTF inactivo))_
- ⬜ **DM-COB-045** DM-COB-045 _(userCanSelectIGTF=false (IGTF inactivo))_
- ⬜ **DM-COB-037** Cobro 25% IVA _(userCanCollectIva=false)_
- ✅ **DM-COB-001** Módulo Cobros → home (COBRO + BUSCAR) _(botones: COBRO, ANTICIPO/PREPAGO, BUSCAR)_
- ✅ **DM-COB-002** COBRO → form 5 tabs; resto disabled sin cliente _(tabs: 5 (General/Documentos/Pagos/Total/Adjuntos) · habilitadas: 1)_
- ✅ **DM-COB-004** Seleccionar cliente → tabs habilitadas _(pedido: "C.0029" · clickeado: "inversiones super rapido, c.a código: c.0029 saldo usd: 4.008,00 saldo bs: 3.486" · tabs habilitadas: 5 · comentario escrito ✓)_
- ✅ **DM-COB-REQ-001** REQ · Enviar habilitado al iniciar la transacción _(nace deshabilitado — esperado en este módulo: primero hay que agregar un método de pago)_
- ❌ **DM-COB-REQ-002** REQ · Rechaza el envío con obligatorios vacíos y dice qué falta _(C1 ok (deshabilitado) pero C2 NO: no hay marca ni mensaje que indique qué falta)_
- ⬜ **DM-COB-007** Tab Documentos → lista + leyenda _(cliente sin documentos (monedas: ["Moneda","Bs","USD"]))_
- ⬜ **DM-COB-008** Marcar documento → total actualiza _(sin documentos)_
- ⬜ **DM-COB-048** DM-COB-048 _(sin documentos seleccionados)_
- ⬜ **DM-COB-049** DM-COB-049 _(sin documentos seleccionados)_
- ⬜ **DM-COB-050** DM-COB-050 _(sin documentos seleccionados)_
- ⬜ **DM-COB-051** DM-COB-051 _(sin documentos seleccionados)_
- ⬜ **DM-COB-052** DM-COB-052 _(sin documentos seleccionados)_
- ⬜ **DM-COB-009** Tab Pagos → botón "Agregar método de pago" _(botón disabled (isAddPaymentMethodDisabled — falta documento/monto))_
- ⬜ **DM-COB-040** DM-COB-040 _(sin documento seleccionado)_
- ⬜ **DM-COB-012** DM-COB-012 _(sin documento seleccionado)_
- ⬜ **DM-COB-043** DM-COB-043 _(sin documento seleccionado)_
- ✅ **DM-COB-016** Tab Adjuntos → acordeones visibles _(imágenes: true · archivo: true · firma: false)_
- ✅ **DM-COB-REQ-003** REQ · Sin pestaña en rojo falso con el formulario completo (F1) _(5 pestaña(s), ninguna en rojo con el formulario completo)_
- ✅ **DM-COB-018** Guardar cobro → alert confirmación _(clic:mouse/loading · alert: "Denario Cobros · El Cobro se ha guardado")_
- ✅ **DM-COB-022** BUSCAR → lista con searchbar _(lista: true · ítems: 20 · searchbar: true)_
- ✅ **DM-COB-024** Reabrir Guardado → los datos persisten _(tabs accesibles: 5 · 2 campo(s) con valor conservados · total: —)_
- ❌ **DM-COB-019** Enviar cobro → llega a la nube _(clic FALLÓ (botón deshabilitado) · diálogo: "ninguno" · ✗ no aparece en la nube ningún cobro con comentario Test-COB-342403 · UI → guardados: 1 · enviados: 19 · total en lista: 20)_
- 🚫 **DM-COB-053** DM-COB-053 _(no se identificó un descuento del catálogo que se pueda aplicar bajo el tope)_
- 🚫 **DM-COB-054** DM-COB-054 _(no se identificó un descuento del catálogo que se pueda aplicar bajo el tope)_
- 🚫 **DM-COB-055** DM-COB-055 _(no se identificó un descuento del catálogo que se pueda aplicar bajo el tope)_
- 🚫 **DM-COB-026** Eliminar Guardado _(no se pudo montar el cobro a eliminar: C.0010 no tiene documentos disponibles)_
- ✅ **DM-COB-020** Atrás con cambios → modal Salir/Guardar _(modal: "Denario Cobros")_
- ✅ **DM-COB-021** Salir sin guardar → no persiste _(salió por modal: true · home: true)_
- 🚫 **DM-COB-033** DM-COB-033 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-034** DM-COB-034 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-014** DM-COB-014 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-015** DM-COB-015 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-028** DM-COB-028 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-029** DM-COB-029 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-041** DM-COB-041 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-042** DM-COB-042 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-046** DM-COB-046 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-047** DM-COB-047 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-039** DM-COB-039 _(Fase 2 — pendiente de construir/depurar en device)_
- 🚫 **DM-COB-038** DM-COB-038 _(Fase 2 — pendiente de construir/depurar en device)_

**Resumen:** N/A:15 · PASS:11 · FAIL:2 · BLOCKED:16
_Tiempo: 169.1s_