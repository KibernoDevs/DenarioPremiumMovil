#!/bin/sh
run() {
  tag="$1"; shift
  out=$(MSYS_NO_PATHCONV=1 node medir-cuota.js "$tag" "$@" 2>&1)
  err=$(echo "$out" | sed -n 's/.*"err": "\([^"]*\)".*/\1/p' | head -1)
  tot=$(echo "$out" | sed -n 's/.*"total": "\([^"]*\)".*/\1/p' | head -1)
  printf '%s %-22s | err=%-45s | total=%s\n' "$(date +%H:%M:%S)" "$tag" "${err:-NULL}" "${tot:-?}"
}
run F_CUM_ago01_30  cumpl Todos Empresa Facturado 'US$' 01/08/2026 30/08/2026
run F_CUM_ago01_31  cumpl Todos Empresa Facturado 'US$' 01/08/2026 31/08/2026
run F_CUM_jul01_31  cumpl Todos Empresa Facturado 'US$' 01/07/2026 31/07/2026
run F_CUM_jul13     cumpl Todos Empresa Facturado 'US$' 13/07/2026 13/07/2026
run F_PLAN_sep      plan  -     Empresa Facturado 'US$' 01/09/2026 14/09/2026
run F_ACTIV         activ -     Empresa Facturado 'US$' 01/08/2026 31/08/2026
