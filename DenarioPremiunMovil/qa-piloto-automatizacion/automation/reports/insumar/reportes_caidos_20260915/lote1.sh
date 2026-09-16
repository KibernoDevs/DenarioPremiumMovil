#!/bin/sh
run() {
  tag="$1"; shift
  out=$(MSYS_NO_PATHCONV=1 node medir-cuota.js "$tag" "$@" 2>&1)
  err=$(echo "$out" | sed -n 's/.*"err": "\([^"]*\)".*/\1/p' | head -1)
  tot=$(echo "$out" | sed -n 's/.*"total": "\([^"]*\)".*/\1/p' | head -1)
  nul=$(echo "$out" | grep -c '"err": null')
  printf '%-26s | err=%-45s | total=%s\n' "$tag" "${err:-NULL($nul)}" "${tot:-?}"
}
run CUM_B_Pedido      cumpl Todos Empresa Pedido    'US$' 01/08/2026 30/08/2026
run CUM_C_BS          cumpl Todos Empresa Facturado 'BS'  01/08/2026 30/08/2026
run CUM_D_UNID        cumpl Todos Empresa Facturado 'UNIDADES' 01/08/2026 30/08/2026
run CUM_E_Linea       cumpl Todos Linea   Facturado 'US$' 01/08/2026 30/08/2026
