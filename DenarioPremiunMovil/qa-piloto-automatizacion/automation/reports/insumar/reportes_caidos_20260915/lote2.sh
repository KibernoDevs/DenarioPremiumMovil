#!/bin/sh
run() {
  tag="$1"; shift
  out=$(MSYS_NO_PATHCONV=1 node medir-cuota.js "$tag" "$@" 2>&1)
  err=$(echo "$out" | sed -n 's/.*"err": "\([^"]*\)".*/\1/p' | head -1)
  tot=$(echo "$out" | sed -n 's/.*"total": "\([^"]*\)".*/\1/p' | head -1)
  chk=$(echo "$out" | sed -n 's/.*"chk": \([0-9]*\).*/\1/p' | head -1)
  printf '%-26s | chk=%-3s | err=%-45s | total=%s\n' "$tag" "$chk" "${err:-NULL}" "${tot:-?}"
}
run CUM_E2_Linea      cumpl Todos Linea   Facturado 'US$' 01/08/2026 30/08/2026
run CUM_F_Canales     cumpl Todos 'Canales de distribución' Facturado 'US$' 01/08/2026 30/08/2026
run CUM_G_Prov        cumpl Todos Proveedor Facturado 'US$' 01/08/2026 30/08/2026
run CUM_I_1vend       cumpl 'R013 VIVIANA ESCALANTE' Empresa Facturado 'US$' 01/08/2026 30/08/2026
run CUM_J_2025        cumpl Todos Empresa Facturado 'US$' 01/01/2025 31/01/2025
run CUM_K_1dia        cumpl Todos Empresa Facturado 'US$' 13/07/2026 13/07/2026
