import {
  formatClientForTab,
  resolveClientNameForExport,
} from './client-display.util';

describe('client-display.util', () => {
  it('resolveClientNameForExport: usa naClient cuando existe', () => {
    expect(resolveClientNameForExport('Nombre NA', 'Nombre LB')).toBe('Nombre NA');
  });

  it('CLI-PDF-001: resolveClientNameForExport cae a lbClient si naClient vacío', () => {
    expect(resolveClientNameForExport('', 'Distribuidora QA')).toBe('Distribuidora QA');
    expect(resolveClientNameForExport(null, '  Acme  ')).toBe('Acme');
  });

  it('formatClientForTab: fallback lbClient al armar etiqueta de pestaña', () => {
    expect(formatClientForTab('', 'C001', 'Fallback LB')).toBe('Fallback LB (C001)');
  });
});
