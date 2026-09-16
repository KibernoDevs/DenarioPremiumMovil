export MSYS_NO_PATHCONV=1
ind(){ echo "########## $1"; node medir-ind.js "$@" 2>&1 | tail -70; }
ind IND_Participacion_AGO /pages/indicadoresProductos form:j_idt115 '{"vendedor":"Todos","clasificacion":"Linea","cumplimiento":"Facturado","idCurrency":"US$"}' 01/08/2026 31/08/2026 -
ind IND_Cobranzas_AGO  /pages/protected/indicadores/indicadorCobros.xhtml form:j_idt115 '{"idCurrency":"US$"}' 01/08/2026 31/08/2026 -
ind IND_Morosidad_CxC  /pages/protected/indicadores/indicadorMorosos.xhtml form:j_idt115 '{"idCurrency":"US$","idTipoDocs":"Cuentas por cobrar"}' - - -
ind IND_VentasDia_AGO  /pages/protected/indicadores/pedidosProductosVentas.xhtml form:j_idt116 '{"tipoVista":"Rango de Fechas"}' 01/08/2026 31/08/2026 -
