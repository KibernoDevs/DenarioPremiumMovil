#!/bin/sh
run() {
  tag="$1"; shift
  out=$(MSYS_NO_PATHCONV=1 node medir-cuota.js "$tag" "$@" 2>&1)
  err=$(echo "$out" | sed -n 's/.*"err": "\([^"]*\)".*/\1/p' | head -1)
  tot=$(echo "$out" | sed -n 's/.*"total": "\([^"]*\)".*/\1/p' | head -1)
  printf '%-24s | err=%-45s | total=%s\n' "$tag" "${err:-NULL}" "${tot:-?}"
}
run CUM_L_futuro   cumpl Todos Empresa Facturado 'US$' 01/01/2030 31/01/2030
run PLAN_B_Pedido  plan  -     Empresa Pedido    'US$' 01/09/2026 14/09/2026
run PLAN_C_ago     plan  -     Empresa Facturado 'US$' 01/08/2026 31/08/2026
run ACTIV_B_sep    activ -     Empresa Facturado 'US$' 01/09/2026 14/09/2026
