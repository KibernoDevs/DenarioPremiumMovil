import { Client } from '../modelos/tables/client';
import { isClientSuspended } from './client-suspension.policy';

describe('client-suspension.policy', () => {
  it('isClientSuspended true para true / 1 / "1" / "true"', () => {
    expect(isClientSuspended({ inSuspension: true } as Client)).toBeTrue();
    expect(isClientSuspended({ inSuspension: 1 } as unknown as Client)).toBeTrue();
    expect(isClientSuspended({ inSuspension: '1' } as unknown as Client)).toBeTrue();
    expect(isClientSuspended({ inSuspension: 'true' } as unknown as Client)).toBeTrue();
  });

  it('isClientSuspended false para false / 0 / "0" / undefined', () => {
    expect(isClientSuspended({ inSuspension: false } as Client)).toBeFalse();
    expect(isClientSuspended({ inSuspension: 0 } as unknown as Client)).toBeFalse();
    expect(isClientSuspended({ inSuspension: '0' } as unknown as Client)).toBeFalse();
    expect(isClientSuspended(undefined)).toBeFalse();
    expect(isClientSuspended(null)).toBeFalse();
  });
});
