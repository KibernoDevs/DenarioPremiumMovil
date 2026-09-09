import { TestBed } from '@angular/core/testing';

import { CurrencyService } from './currency.service';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { CurrencyModules } from 'src/app/modelos/tables/currencyModules';

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CurrencyService,
        {
          provide: GlobalConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'parteDecimal') {
                return '2';
              }
              if (key === 'currencyModule') {
                return 'true';
              }
              if (key === 'multiCurrency') {
                return 'true';
              }
              return 'false';
            },
          },
        },
      ],
    });
    service = TestBed.inject(CurrencyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('parseCurrencyModuleFlag', () => {
    it('null/undefined/empty default to true', () => {
      expect(service.parseCurrencyModuleFlag(null)).toBeTrue();
      expect(service.parseCurrencyModuleFlag(undefined)).toBeTrue();
      expect(service.parseCurrencyModuleFlag('')).toBeTrue();
    });

    it('acepta boolean, 0/1 y strings', () => {
      expect(service.parseCurrencyModuleFlag(true)).toBeTrue();
      expect(service.parseCurrencyModuleFlag(false)).toBeFalse();
      expect(service.parseCurrencyModuleFlag(1)).toBeTrue();
      expect(service.parseCurrencyModuleFlag(0)).toBeFalse();
      expect(service.parseCurrencyModuleFlag('true')).toBeTrue();
      expect(service.parseCurrencyModuleFlag('FALSE')).toBeFalse();
      expect(service.parseCurrencyModuleFlag('1')).toBeTrue();
      expect(service.parseCurrencyModuleFlag('0')).toBeFalse();
    });
  });

  describe('getCurrencyModule case-insensitive', () => {
    it('encuentra PED y ped con la misma fila', () => {
      service.currencyModulesMap.set(
        'ped',
        new CurrencyModules(10, 2, false, false, true),
      );

      const byLower = service.getCurrencyModule('ped');
      const byUpper = service.getCurrencyModule('PED');

      expect(byLower.localCurrencyDefault).toBeFalse();
      expect(byLower.showConversion).toBeFalse();
      expect(byUpper.idCurrencyModules).toBe(10);
      expect(byUpper.showConversion).toBeFalse();
    });

    it('devuelve defaults si el módulo no existe', () => {
      const missing = service.getCurrencyModule('xyz');
      expect(missing.idModule).toBe(0);
      expect(missing.localCurrencyDefault).toBeTrue();
      expect(missing.showConversion).toBeTrue();
      expect(missing.currencySelector).toBeTrue();
    });
  });
});
