run(){ echo "########## $1"; node medir-cuota.js "$@" 2>&1 | tail -60; }
run PLAN_SEP_Linea_Fact   plan  -     Linea Facturado US$ 01/09/2026 14/09/2026
run PLAN_AGO_Linea_Fact   plan  -     Linea Facturado US$ 01/08/2026 31/08/2026
run CUMPL_SEP_Linea_Fact  cumpl Todos Linea Facturado US$ 01/09/2026 14/09/2026
