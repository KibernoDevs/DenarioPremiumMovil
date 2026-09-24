import {
  parseOrderExcelRows,
  resolveImportedUnitIndex,
  type OrderExcelColumnConfig,
} from './order-excel-import.parser';

describe('parseOrderExcelRows', () => {
  const config: OrderExcelColumnConfig = {
    productColumn: 'CODIGO',
    quantityColumn: 'PEDIDO',
    unitColumn: 'PRES',
  };

  const sampleRows = (): unknown[][] => {
    const rows: unknown[][] = [];
    for (let i = 0; i < 10; i++) {
      rows.push(['CLIENTE:', 'CARLOS JEREZ']);
    }
    rows.push(['CODIGO', 'DESCRIPCION', 'PRES', 'ACTUAL', 'REF. USD', 'PEDIDO', 'TOTAL']);
    rows.push(['A01', 'Bombillo', 'BULTO', '10.00', '8.00', 2, '16.00']);
    rows.push(['A02', 'Kit', 'KIT', '5.00', '4.00', '', '0']);
    rows.push(['A03', 'Pieza', '', '1.00', '1.00', 3, '3.00']);
    rows.push(['A01', 'Bombillo', 'BULTO', '10.00', '8.00', 1, '8.00']);
    rows.push(['A04', 'Par', 'PAR', '2.00', '2.00', 4, '8.00']);
    return rows;
  };

  it('encuentra encabezado en fila 11 y no toma precio', () => {
    const result = parseOrderExcelRows(sampleRows(), config);
    expect(result.error).toBeUndefined();
    const a01 = result.lines.find(l => l.coProduct === 'A01');
    expect(a01?.quantity).toBe(3);
    expect(a01?.unit).toBe('BULTO');
    expect(JSON.stringify(result.lines)).not.toContain('10.00');
    expect(JSON.stringify(result.lines)).not.toContain('REF');
  });

  it('omite cantidad vacía o 0 y deja unidad vacía como null', () => {
    const result = parseOrderExcelRows(sampleRows(), config);
    expect(result.lines.some(l => l.coProduct === 'A02')).toBeFalse();
    const a03 = result.lines.find(l => l.coProduct === 'A03');
    expect(a03?.quantity).toBe(3);
    expect(a03?.unit).toBeNull();
  });

  it('suma duplicados de mismo código y unidad', () => {
    const result = parseOrderExcelRows(sampleRows(), config);
    expect(result.lines.find(l => l.coProduct === 'A01')?.quantity).toBe(3);
    expect(result.lines.find(l => l.coProduct === 'A04')?.quantity).toBe(4);
  });

  it('falla si no hay columna de código', () => {
    const result = parseOrderExcelRows([['FOO', 'BAR']], config);
    expect(result.error).toContain('código');
    expect(result.lines.length).toBe(0);
  });
});

describe('resolveImportedUnitIndex', () => {
  const units = [
    { coUnit: 'UND', naUnit: 'Unidad' },
    { coUnit: 'BULTO', naUnit: 'Bulto' },
  ];

  it('unidad vacía usa defecto', () => {
    expect(resolveImportedUnitIndex(units, null, false)).toBe(-1);
    expect(resolveImportedUnitIndex(units, '', false)).toBe(-1);
  });

  it('unidad desconocida se omite', () => {
    expect(resolveImportedUnitIndex(units, 'PAQ.', false)).toBeNull();
  });

  it('coincide por coUnit o naUnit', () => {
    expect(resolveImportedUnitIndex(units, 'bulto', false)).toBe(1);
    expect(resolveImportedUnitIndex(units, 'UNIDAD', false)).toBe(0);
  });

  it('ignora unidad del Excel si unitByPriceList', () => {
    expect(resolveImportedUnitIndex(units, 'PAQ.', true)).toBe(-1);
  });
});
