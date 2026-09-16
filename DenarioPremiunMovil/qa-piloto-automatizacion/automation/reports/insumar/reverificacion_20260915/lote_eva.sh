MSYS_NO_PATHCONV=1 node _part.js RV_PART_ago_EVA Linea "EVA MEDINA" Facturado 'US$' 01/08/2026 31/08/2026 2>&1 | python -c "
import sys,json; d=json.loads(sys.stdin.read())
for c in d['charts']['o']:
    if c['datasets'] and c['datasets'][0].get('label')=='US\$':
        print('PART EVA ago |', list(zip(c['labels'],c['datasets'][0]['data']))[:5])
print('PART EVA pre:', d['pre'])
"
MSYS_NO_PATHCONV=1 node _part.js RV_PART_ago_VIV Linea "VIVIANA ESCALANTE" Facturado 'US$' 01/08/2026 31/08/2026 2>&1 | python -c "
import sys,json; d=json.loads(sys.stdin.read())
for c in d['charts']['o']:
    if c['datasets'] and c['datasets'][0].get('label')=='US\$':
        print('PART VIVIANA ago |', list(zip(c['labels'],c['datasets'][0]['data']))[:5])
"
MSYS_NO_PATHCONV=1 node _ind.js RV_IND_EVA_ago /pages/pedidosVendedores "form:j_idt115" "EVA MEDINA" Facturado 'US\$' 01/08/2026 31/08/2026 2>&1 | python -c "
import sys,json; d=json.loads(sys.stdin.read())
g=d['grids'][0] if d['grids'] else None
print('IND VEND EVA ago | err=',d['err'],'| filas=',(len(g['rows']) if g else 0),'|',(g['rows'][:3] if g else None))
"
MSYS_NO_PATHCONV=1 node _fact.js FAC_ago_EVA "Facturas cobradas" "EVA MEDINA" 01/08/2026 31/08/2026 2>&1 | grep -E '"total"|"vend"|"err"'
