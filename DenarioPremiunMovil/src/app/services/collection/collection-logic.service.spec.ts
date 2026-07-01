import { TestBed } from '@angular/core/testing';

import { CollectionService } from './collection-logic.service';
import { CollectionDetail } from 'src/app/modelos/tables/collection';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';

describe('CollectionService', () => {
  let service: CollectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CollectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  function setupToleranceScenario(): jasmine.Spy {
    service.collection = {
      coCurrency: 'USD'
    } as any;
    service.MonedaTolerancia = 'USD';
    service.TipoTolerancia = 0;
    service.existPartialPayment = true;
    service.RangoToleranciaPositiva = 10;
    service.RangoToleranciaNegativa = 10;
    service.montoTotalPagar = 100;
    service.montoTotalPagado = 105;
    return spyOn(service, 'onCollectionValidToSend');
  }

  it('should allow tolerance differences in special alwaysPartialPayment mode', () => {
    const validToSendSpy = setupToleranceScenario();
    service.alwaysPartialPayment = true;
    service.enablePartialPayment = false;

    service.checkTolerancia();

    expect(validToSendSpy).toHaveBeenCalledWith(true);
  });

  it('should require exact amount when alwaysPartialPayment is enabled with partial mode active', () => {
    const validToSendSpy = setupToleranceScenario();
    service.alwaysPartialPayment = true;
    service.enablePartialPayment = true;

    service.checkTolerancia();

    expect(validToSendSpy).toHaveBeenCalledWith(false);
  });

  describe('retention line voucher and date', () => {
    it('normalizeCollectionDetailRetentionLine should preserve voucher and date fields', () => {
      const normalized = service.normalizeCollectionDetailRetentionLine(
        {
          idCollectionDetailRetention: null,
          idCollectionDetail: 0,
          coCollection: 'COB-001',
          coDocument: 'FAC-001',
          idCollectRetention: 1,
          coCollectRetention: 'IVA',
          nuAmountRetention: 50,
          nuAmountRetentionConversion: 50,
          posicion: 1,
          nuVoucherRetention: '1234567890',
          daVoucherRetention: '2025-06-15T00:00:00',
        },
        'COB-001',
        'FAC-001',
        0,
        0,
      );

      expect(normalized.nuVoucherRetention).toBe('1234567890');
      expect(normalized.daVoucherRetention).toBe('2025-06-15T00:00:00');
      expect(normalized.nuAmountRetention).toBe(50);
    });

    it('validateRetentionVoucherValue should enforce size and number format', () => {
      service.sizeRetention = 10;
      service.formatRetention = 'number';

      expect(service.validateRetentionVoucherValue('')).toBeFalse();
      expect(service.validateRetentionVoucherValue('12345')).toBeFalse();
      expect(service.validateRetentionVoucherValue('1234567890')).toBeTrue();
    });

    it('validateRetentionVoucherValue should reject letters in text format', () => {
      service.sizeRetention = 5;
      service.formatRetention = 'text';

      expect(service.validateRetentionVoucherValue('12345')).toBeTrue();
      expect(service.validateRetentionVoucherValue('12a45')).toBeFalse();
    });

    it('validateRetentionVoucherValue should reject letters in alphanumeric format', () => {
      service.sizeRetention = 6;
      service.formatRetention = 'alphanumeric';

      expect(service.validateRetentionVoucherValue('123456')).toBeTrue();
      expect(service.validateRetentionVoucherValue('12AB56')).toBeFalse();
    });

    it('syncLegacyDetailFieldsFromFirstRetentionLine should copy first line with amount', () => {
      const detail = {
        nuVoucherRetention: '',
        daVoucher: '',
      } as CollectionDetail;
      const open = {
        nuVaucherRetention: '',
        daVoucher: '',
      } as DocumentSale;

      service.syncLegacyDetailFieldsFromFirstRetentionLine(
        detail,
        [
          { nuAmountRetention: 0, nuVoucherRetention: 'SKIP', daVoucherRetention: '2025-01-01' },
          { nuAmountRetention: 25, nuVoucherRetention: 'VOUCHER-01', daVoucherRetention: '2025-06-20T12:00:00' },
          { nuAmountRetention: 10, nuVoucherRetention: 'OTHER', daVoucherRetention: '2025-07-01' },
        ],
        open,
      );

      expect(detail.nuVoucherRetention).toBe('VOUCHER-01');
      expect(detail.daVoucher).toBe('2025-06-20');
      expect(open.nuVaucherRetention).toBe('VOUCHER-01');
      expect(open.daVoucher).toBe('2025-06-20');
    });

    it('getCollectionDetailsRetentions should map nu_voucher_retention and da_voucher_retention', async () => {
      const dbServ = {
        executeSql: jasmine.createSpy('executeSql').and.resolveTo({
          rows: {
            length: 1,
            item: (index: number) => ({
              id_collection_detail_retention: 99,
              id_collection_detail: 0,
              id_collect_retention: 2,
              co_collect_retention: 'ISLR',
              nu_amount_retention: 15,
              nu_amount_retention_conversion: 15,
              co_collection: 'COB-100',
              co_document: 'FAC-200',
              posicion: 1,
              nu_voucher_retention: '9876543210',
              da_voucher_retention: '2025-05-10',
            }),
          },
        }),
      };

      const result = await service.getCollectionDetailsRetentions(dbServ as any, 'COB-100');

      expect(result.length).toBe(1);
      expect(result[0].nuVoucherRetention).toBe('9876543210');
      expect(result[0].daVoucherRetention).toBe('2025-05-10');
      expect(result[0].coDocument).toBe('FAC-200');
    });
  });
});
