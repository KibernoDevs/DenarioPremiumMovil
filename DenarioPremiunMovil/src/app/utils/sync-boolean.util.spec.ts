import { parseSyncBoolean } from './sync-boolean.util';

describe('parseSyncBoolean', () => {
  it('null/undefined/empty usa default', () => {
    expect(parseSyncBoolean(null, true)).toBeTrue();
    expect(parseSyncBoolean(undefined, false)).toBeFalse();
    expect(parseSyncBoolean('', true)).toBeTrue();
  });

  it('acepta boolean, number y strings true/false/1/0', () => {
    expect(parseSyncBoolean(true)).toBeTrue();
    expect(parseSyncBoolean(false)).toBeFalse();
    expect(parseSyncBoolean(1)).toBeTrue();
    expect(parseSyncBoolean(0)).toBeFalse();
    expect(parseSyncBoolean('true')).toBeTrue();
    expect(parseSyncBoolean('FALSE')).toBeFalse();
    expect(parseSyncBoolean('1')).toBeTrue();
    expect(parseSyncBoolean('0')).toBeFalse();
  });

  it('VIS-INC-001: active=false string no se trata como activo', () => {
    expect(parseSyncBoolean('false', true)).toBeFalse();
  });

  it('VIS-INC-001: requiredComment=true string se trata como obligatorio', () => {
    expect(parseSyncBoolean('true', false)).toBeTrue();
  });
});
