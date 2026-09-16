rep(){ echo "########## $1"; node medir-cuota.js "$@" 2>&1 | tail -45; }
ind(){ echo "########## $1"; node medir-ind.js "$@" 2>&1 | tail -60; }
rep ACTIV_AGO_RDV_Fact   activ - Vendedores Facturado - 01/08/2026 31/08/2026
rep ACTIV_AGO_Emp_Fact   activ - Empresa    Facturado - 01/08/2026 31/08/2026
rep ROTA_AGO_Linea_Fact  rota  - Linea      Facturado UNIDADES 01/08/2026 31/08/2026
ind IND_Vendedores_AGO_Fact /pages/pedidosVendedores form:j_idt115 '{"vendedor":"Todos","cumplimiento":"Facturado","idCurrency":"US$"}' 01/08/2026 31/08/2026 form:j_idt143
ind IND_Vendedores_SEP_Fact /pages/pedidosVendedores form:j_idt115 '{"vendedor":"Todos","cumplimiento":"Facturado","idCurrency":"US$"}' 01/09/2026 14/09/2026 form:j_idt143
ind IND_Pedidos_2026_Fact   /pages/indicadoresPedidos form:j_idt115 '{"visualizacion":"Un solo año","anio1":"2026","cumplimiento":"Facturado","idCurrency":"US$"}' - - form:tablaPedidos
ind IND_Participacion_AGO   /pages/indicadoresProductos form:j_idt115 '{"vendedor":"Todos","clasificacion":"Linea","cumplimiento":"Facturado","idCurrency":"US$"}' 01/08/2026 31/08/2026 -
ind IND_Clientes_AGO_Fact   /pages/pedidosClientes form:j_idt115 '{"cumplimiento":"Facturado","idCurrency":"US$"}' 01/08/2026 31/08/2026 -
