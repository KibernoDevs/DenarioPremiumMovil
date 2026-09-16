run(){ echo "########## $1"; node medir-fact.js "$@" 2>&1 | tail -40; }
run FACT_AGO_Cobradas   "Facturas cobradas"   01/08/2026 31/08/2026 -
run FACT_AGO_Consol     "Consolidado"         01/08/2026 31/08/2026 -
run FACT_AGO_Pend       "Pendientes por cobrar" 01/08/2026 31/08/2026 -
run FACT_SEP_Cobradas   "Facturas cobradas"   01/09/2026 14/09/2026 -
run FACT_AGO_Cobr_30    "Facturas cobradas"   01/08/2026 30/08/2026 -
run FACT_AGO_Viviana    "Facturas cobradas"   01/08/2026 31/08/2026 "VIVIANA ESCALANTE"
