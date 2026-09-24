export interface OrderExcelColumnConfig {
  productColumn: string;
  quantityColumn: string;
  unitColumn: string;
}

export interface OrderExcelImportLine {
  coProduct: string;
  quantity: number;
  unit: string | null;
}

export interface OrderExcelParseResult {
  error?: string;
  lines: OrderExcelImportLine[];
}

export const ORDER_EXCEL_HEADER_SCAN_ROWS = 40;

export function normalizeExcelHeader(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function parseOrderExcelQuantity(raw: unknown): number | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  let text = String(raw).trim();
  if (!text) {
    return null;
  }
  text = text.replace(/ /g, '');
  if (text.includes(',') && text.includes('.')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(',', '.');
  }
  const qty = Number(text);
  return Number.isFinite(qty) ? qty : null;
}

export function parseOrderExcelRows(
  rows: unknown[][],
  config: OrderExcelColumnConfig,
): OrderExcelParseResult {
  const productHeader = normalizeExcelHeader(config.productColumn);
  const quantityHeader = normalizeExcelHeader(config.quantityColumn);
  const unitHeader = normalizeExcelHeader(config.unitColumn);
  if (!productHeader || !quantityHeader) {
    return { error: 'Configure el nombre de las columnas de código y cantidad.', lines: [] };
  }
  if (!rows?.length) {
    return { error: 'El archivo está vacío.', lines: [] };
  }

  let headerRow = -1;
  let productIdx = -1;
  const scanLimit = Math.min(ORDER_EXCEL_HEADER_SCAN_ROWS, rows.length);
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (productHeader === normalizeExcelHeader(cellText(row[c]))) {
        headerRow = r;
        productIdx = c;
        break;
      }
    }
    if (headerRow >= 0) {
      break;
    }
  }
  if (headerRow < 0) {
    return { error: `No se encontró la columna de código "${config.productColumn}".`, lines: [] };
  }

  const header = rows[headerRow] ?? [];
  const quantityIdx = findHeaderIndex(header, quantityHeader);
  if (quantityIdx < 0) {
    return { error: `No se encontró la columna de cantidad "${config.quantityColumn}".`, lines: [] };
  }
  const unitIdx = unitHeader ? findHeaderIndex(header, unitHeader) : -1;

  const aggregated = new Map<string, OrderExcelImportLine>();
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const coProduct = cellText(row[productIdx]).trim();
    if (!coProduct) {
      continue;
    }
    const quantity = parseOrderExcelQuantity(row[quantityIdx]);
    if (quantity == null || quantity <= 0) {
      continue;
    }
    const unitRaw = unitIdx < 0 ? '' : cellText(row[unitIdx]).trim();
    const unit = unitRaw || null;
    const key = `${normalizeExcelHeader(coProduct)}||${unit ? normalizeExcelHeader(unit) : ''}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      aggregated.set(key, { coProduct, quantity, unit });
    }
  }
  return { lines: [...aggregated.values()] };
}

export function resolveImportedUnitIndex(
  units: { coUnit?: string; naUnit?: string }[],
  excelUnit: string | null,
  ignoreExcelUnit: boolean,
): number | null {
  if (!units.length) {
    return null;
  }
  if (ignoreExcelUnit || !excelUnit?.trim()) {
    return -1;
  }
  const target = normalizeExcelHeader(excelUnit);
  const idx = units.findIndex(u =>
    normalizeExcelHeader(u.coUnit) === target || normalizeExcelHeader(u.naUnit) === target,
  );
  return idx < 0 ? null : idx;
}

function findHeaderIndex(header: unknown[], expected: string): number {
  return header.findIndex(cell => expected === normalizeExcelHeader(cellText(cell)));
}

function cellText(value: unknown): string {
  if (value == null) {
    return '';
  }
  return String(value);
}
