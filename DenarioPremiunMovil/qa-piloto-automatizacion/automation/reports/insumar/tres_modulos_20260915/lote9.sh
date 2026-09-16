export MSYS_NO_PATHCONV=1
ind(){ echo "########## $1"; node medir-ind.js "$@" 2>&1 | tail -50; }
ind IND_Vend_AGO_Fact_v2 /pages/pedidosVendedores form:j_idt115 '{"vendedor":"Todos","cumplimiento":"Facturado","idCurrency":"US$"}' 01/08/2026 31/08/2026 -
ind IND_Vend_AGO_Ped_v2  /pages/pedidosVendedores form:j_idt115 '{"vendedor":"Todos","cumplimiento":"Pedido","idCurrency":"US$"}' 01/08/2026 31/08/2026 -
ind IND_Vend_SEP_Fact_v2 /pages/pedidosVendedores form:j_idt115 '{"vendedor":"Todos","cumplimiento":"Facturado","idCurrency":"US$"}' 01/09/2026 14/09/2026 -
ind IND_Clientes_AGO_v2  /pages/pedidosClientes form:j_idt115 '{"cumplimiento":"Facturado","idCurrency":"US$"}' 01/08/2026 31/08/2026 -
ind IND_Particip_AGO_v2  /pages/indicadoresProductos form:j_idt115 '{"vendedor":"Todos","clasificacion":"Linea","cumplimiento":"Facturado","idCurrency":"US$"}' 01/08/2026 31/08/2026 -
