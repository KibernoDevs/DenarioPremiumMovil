/**
 * Normaliza flags que llegan del sync/SQLite como boolean, 0/1 o 'true'/'false'.
 * Misma semántica que CurrencyService.parseCurrencyModuleFlag.
 */
export function parseSyncBoolean(value: unknown, defaultWhenNull = false): boolean {
  if (value === null || value === undefined || value === '') {
    return defaultWhenNull;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return defaultWhenNull;
}
