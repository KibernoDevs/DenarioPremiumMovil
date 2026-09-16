set -e
run(){ echo "########## $1"; node medir-cuota.js "$@" 2>&1 | tail -40; }
run PLAN_AGO_Emp_Fact      plan  -      Empresa Facturado US$ 01/08/2026 31/08/2026
run PLAN_AGO_Emp_Fact_30   plan  -      Empresa Facturado US$ 01/08/2026 30/08/2026
run PLAN_SEP_Emp_Fact      plan  -      Empresa Facturado US$ 01/09/2026 14/09/2026
run CUMPL_SEP_Todos_Emp    cumpl Todos  Empresa Facturado US$ 01/09/2026 14/09/2026
