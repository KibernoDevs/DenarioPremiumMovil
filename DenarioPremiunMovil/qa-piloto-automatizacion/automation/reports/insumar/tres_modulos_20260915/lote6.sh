export MSYS_NO_PATHCONV=1
ind(){ echo "########## $1"; node medir-ind.js "$@" 2>&1 | tail -55; }
ind IND_Cobranzas_AGO  /pages/protected/indicadores/indicadorCobros.xhtml form:j_idt115 '{"idCurrency":"US$"}' 01/08/2026 31/08/2026 -
ind IND_Morosidad_CxC  /pages/protected/indicadores/indicadorMorosos.xhtml form:j_idt115 '{"idCurrency":"US$","idTipoDocs":"Cuentas por cobrar"}' - - -
ind IND_VentasDia_AGO  /pages/protected/indicadores/pedidosProductosVentas.xhtml form:j_idt116 '{"idSalesmaView":"Vendedor","tipoVista":"Rango de Fechas"}' 01/08/2026 31/08/2026 -
