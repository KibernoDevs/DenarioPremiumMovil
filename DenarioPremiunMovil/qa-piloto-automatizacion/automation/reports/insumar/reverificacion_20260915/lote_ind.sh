set -e
for r in "IND_ago01_31 01/08/2026 31/08/2026" "IND_ago01_30 01/08/2026 30/08/2026" "IND_ago01_10 01/08/2026 10/08/2026" "IND_jul01_31 01/07/2026 31/07/2026" "IND_jul01_30 01/07/2026 30/07/2026" "IND_jul13_13 13/07/2026 13/07/2026" "IND_sep01_10 01/09/2026 10/09/2026" "IND_ago01_15 01/08/2026 15/08/2026"; do
  set -- $r
  MSYS_NO_PATHCONV=1 node _ind.js "$1" /pages/pedidosVendedores "form:j_idt115" Todos Facturado 'US$' "$2" "$3" 2>&1 | python -c "
import sys,json
d=json.loads(sys.stdin.read())
g=d['grids'][0] if d['grids'] else None
n=0;m=0.0
if g:
  for r in g['rows']:
    n+=int(r[1].replace('.',''))
    m+=float(r[2].replace(' US\$','').replace('.','').replace(',','.'))
print(d['tag'],'| dF=',d['pre']['dF'],'dB=',d['pre']['dB'],'| err=',d['err'],'| filas=',len(g['rows']) if g else 0,'| N=',n,'| \$=',round(m,2))
"
done
