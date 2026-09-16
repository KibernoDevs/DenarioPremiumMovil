# WEB HAPPY-PATH — 4k

- ⬜ **DW-HP-COB-01** cobros · el listado carga y cuadra con la base _(50 filas en pantalla · sin oráculo de base para esta pantalla: no se juzga)_
- ❌ **DW-HP-COB-02** cobros · la lupa abre el detalle _(la lupa no navegó en 12 s: la URL sigue en http://denariocaribe.ddns.net:8080/DenarioPremium/pages/cobros)_
- ⬜ **DW-HP-PED-01** pedidos · el listado carga y cuadra con la base _(17 filas en pantalla · sin oráculo de base para esta pantalla: no se juzga)_
- 🚫 **DW-HP-PED-99** pedidos · recorrido _(page.evaluate: TypeError: Cannot read properties of null (reading 'innerText')
    at eval (eval at evaluate (:311:30), <anonymous>:2:32)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44))_
- ⬜ **DW-HP-DEV-01** devoluciones · el listado carga y cuadra con la base _(5 filas en pantalla · sin oráculo de base para esta pantalla: no se juzga)_
- ❌ **DW-HP-DEV-02** devoluciones · la lupa abre el detalle _(el detalle abrió pero casi sin contenido (95 car.))_
- ⬜ **DW-HP-DEP-01** depositos · el listado carga y cuadra con la base _(41 filas en pantalla · sin oráculo de base para esta pantalla: no se juzga)_
- ✅ **DW-HP-DEP-02** depositos · la lupa abre el detalle _(http://denariocaribe.ddns.net:8080/DenarioPremium/pages/detalleDeposito · 3 celdas)_
- ✅ **DW-HP-DEP-03** depositos · el detalle trae líneas _(3 celdas de detalle)_
- ⬜ **DW-HP-INV-01** inventarios · el listado carga y cuadra con la base _(6 filas en pantalla · sin oráculo de base para esta pantalla: no se juzga)_
- ❌ **DW-HP-INV-02** inventarios · la lupa abre el detalle _(el detalle abrió pero casi sin contenido (94 car.))_

**Resumen:** N/A:5 · FAIL:3 · BLOCKED:1 · PASS:2
_Tiempo: 84.7s_