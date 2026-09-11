import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { CollectionService } from './collection-logic.service';
import { CollectionDetail } from 'src/app/modelos/tables/collection';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';

describe('CollectionService', () => {
  let service: CollectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
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

    it('validateRetentionVoucherValue should enforce nuVoucherLength from collect_retentions', () => {
      service.collectRetentions = [{
        idCollectRetention: 1,
        coCollectRetention: 'IVA',
        naCollectRetention: 'Retencion IVA',
        idEnterprise: 1,
        requireInput: true,
        nuVoucherLength: 10,
      } as any];

      expect(service.validateRetentionVoucherValue('', 1)).toBeFalse();
      expect(service.validateRetentionVoucherValue('12345', 1)).toBeFalse();
      expect(service.validateRetentionVoucherValue('1234567890', 1)).toBeTrue();
    });

    it('validateRetentionVoucherValue should allow empty voucher when requireInput is false', () => {
      service.collectRetentions = [{
        idCollectRetention: 2,
        coCollectRetention: 'ISLR',
        naCollectRetention: 'Retencion ISLR',
        idEnterprise: 1,
        requireInput: false,
        nuVoucherLength: 0,
      } as any];

      expect(service.validateRetentionVoucherValue('', 2)).toBeTrue();
      expect(service.validateRetentionVoucherValue('ABC', 2)).toBeTrue();
    });

    it('validateRetentionVoucherValue should enforce configured length even when optional', () => {
      service.collectRetentions = [{
        idCollectRetention: 3,
        coCollectRetention: 'IVA2',
        naCollectRetention: 'Retencion IVA 2',
        idEnterprise: 1,
        requireInput: false,
        nuVoucherLength: 6,
      } as any];

      expect(service.validateRetentionVoucherValue('', 3)).toBeTrue();
      expect(service.validateRetentionVoucherValue('123456', 3)).toBeTrue();
      expect(service.validateRetentionVoucherValue('12345', 3)).toBeFalse();
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

  /**
   * Bloque P0 — montos Documentos/Pagos (guion DM-COB-008 / 046 + fix paginación COB-DOCS-001).
   * Unitario: no reemplaza el smoke Manual-UI; protege la lógica de CollectionService.
   */
  describe('COB docs amounts (DM-COB-008 / pagination / DM-COB-046)', () => {
    function makeDetail(partial: Partial<CollectionDetail>): CollectionDetail {
      return {
        idDocument: 1,
        coDocument: 'FAC-1',
        inPaymentPartial: false,
        nuAmountPaid: 0,
        nuAmountPaidConversion: 0,
        nuBalanceDoc: 0,
        nuBalanceDocConversion: 0,
        nuBalanceDocOriginal: 0,
        nuAmountDoc: 0,
        nuAmountDiscount: 0,
        nuAmountCollectDiscount: 0,
        nuAmountRetention: 0,
        nuAmountRetention2: 0,
        nuAmountIgtf: 0,
        isSave: true,
        ...partial,
      } as CollectionDetail;
    }

    function stubPaymentSideEffects(): void {
      const svc = service as any;
      spyOn(service, 'convertirMonto').and.callFake((amount: number) => Number(amount) || 0);
      spyOn(svc.currencyService, 'formatNumber').and.callFake((n: number) => String(n ?? 0));
      spyOn(service, 'cleanFormattedNumber').and.callFake((value: string | number) => Number(value) || 0);
      spyOn(svc, 'shouldApplyIgtfToCollection').and.returnValue(false);
      spyOn(svc, 'shouldCalculateEmbeddedIgtf').and.returnValue(false);
      spyOn(svc, 'isRetentionCollection').and.returnValue(false);
      spyOn(svc, 'resolveAutomatedPrepaid').and.stub();
      spyOn(service, 'syncAddPaymentMethodDisabledState').and.stub();
      spyOn(svc, 'syncCollectionDetailsIgtfAmounts').and.stub();
      spyOn(svc, 'syncCollectionIgtfFields').and.stub();
      spyOn(svc, 'applyCollectionIgtfAmountFields').and.stub();
    }

    function setupEditableCollection(details: CollectionDetail[]): void {
      stubPaymentSideEffects();
      service.coTypeModule = '0';
      service.isOpen = false;
      service.isChangePaymentPartialPersistence = false;
      service.isRateChangeInProgress = false;
      service.montoTotalPagado = 0;
      service.documentSales = [] as DocumentSale[];
      service.documentSalesBackup = [] as DocumentSale[];
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_NEW,
        stCollection: service.COLLECT_STATUS_NEW,
        collectionDetails: details,
        collectionPayments: [],
        nuAmountIgtf: 0,
      } as any;
    }

    it('DM-COB-008: two full documents sum into montoTotalPagar', async () => {
      setupEditableCollection([
        makeDetail({
          idDocument: 10,
          coDocument: 'FAC-10',
          nuBalanceDoc: 100,
          nuBalanceDocOriginal: 100,
          nuAmountPaid: 100,
          nuAmountPaidConversion: 100,
        }),
        makeDetail({
          idDocument: 20,
          coDocument: 'FAC-20',
          nuBalanceDoc: 250,
          nuBalanceDocOriginal: 250,
          nuAmountPaid: 250,
          nuAmountPaidConversion: 250,
        }),
      ]);

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(350);
    });

    it('COB-DOC-NEG-001: negative balance document subtracts from montoTotalPagar', async () => {
      setupEditableCollection([
        makeDetail({
          idDocument: 10,
          coDocument: 'FAC-10',
          nuBalanceDoc: 1000,
          nuBalanceDocOriginal: 1000,
          nuAmountPaid: 1000,
          nuAmountPaidConversion: 1000,
        }),
        makeDetail({
          idDocument: 20,
          coDocument: 'NC-20',
          nuBalanceDoc: -200,
          nuBalanceDocOriginal: -200,
          nuAmountPaid: -200,
          nuAmountPaidConversion: -200,
        }),
      ]);

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(800);
    });

    it('COB-DISC-004: descuento > saldo → monto a pagar 0 y efectivoRequerido 0', async () => {
      setupEditableCollection([
        makeDetail({
          idDocument: 10,
          coDocument: 'FAC-100',
          nuBalanceDoc: 100,
          nuBalanceDocOriginal: 100,
          nuAmountCollectDiscount: 150,
          nuAmountPaid: 100,
          nuAmountPaidConversion: 100,
        }),
      ]);
      service.automatedPrepaid = true;
      service.discountRemnantPrepaidByDocument.set('FAC-100', 50);
      service.discountRemnantPrepaidAmount = 50;

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(0);
      expect(service.efectivoRequerido).toBe(0);
      expect(service.isFullyCoveredCollection).toBeTrue();
      expect(service.collection.nuDifference).toBe(0);
    });

    it('COB-DISC-004d: remanente en mapa antes de calculatePayment habilita agregar método', async () => {
      const svc = service as any;
      spyOn(service, 'convertirMonto').and.callFake((amount: number) => Number(amount) || 0);
      spyOn(svc.currencyService, 'formatNumber').and.callFake((n: number) => String(n ?? 0));
      spyOn(service, 'cleanFormattedNumber').and.callFake((value: string | number) => Number(value) || 0);
      spyOn(svc, 'shouldApplyIgtfToCollection').and.returnValue(false);
      spyOn(svc, 'shouldCalculateEmbeddedIgtf').and.returnValue(false);
      spyOn(svc, 'isRetentionCollection').and.returnValue(false);
      spyOn(service, 'validateToSend').and.resolveTo();
      spyOn(svc, 'syncCollectionDetailsIgtfAmounts').and.stub();
      spyOn(svc, 'syncCollectionIgtfFields').and.stub();
      spyOn(svc, 'applyCollectionIgtfAmountFields').and.stub();
      spyOn(svc, 'markCollectionDirty').and.stub();

      service.coTypeModule = '0';
      service.isOpen = false;
      service.isChangePaymentPartialPersistence = false;
      service.isRateChangeInProgress = false;
      service.montoTotalPagado = 0;
      service.documentSales = [] as DocumentSale[];
      service.documentSalesBackup = [] as DocumentSale[];
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_NEW,
        stCollection: service.COLLECT_STATUS_NEW,
        collectionDetails: [
          makeDetail({
            idDocument: 10,
            coDocument: 'FAC-100',
            nuBalanceDoc: 100,
            nuBalanceDocOriginal: 100,
            nuAmountCollectDiscount: 150,
            nuAmountPaid: 0,
            nuAmountPaidConversion: 0,
          }),
        ],
        collectionPayments: [],
        nuAmountIgtf: 0,
      } as any;
      service.automatedPrepaid = true;
      service.setDiscountRemnantPrepaidForDocument('FAC-100', 50);

      await service.calculatePayment('', 0, true, true);

      expect(service.isFullyCoveredCollection).toBeTrue();
      expect(service.efectivoRequerido).toBe(0);
      service.createAutomatedPrepaid = true;
      service.syncAddPaymentMethodDisabledState();
      expect(service.isAddPaymentMethodDisabled()).toBeFalse();
    });

    it('COB-NCR-PREPAID-001: NCR excede FACT → monto a pagar 0, anticipo 500, efectivo 0', async () => {
      setupEditableCollection([
        makeDetail({
          idDocument: 10,
          coDocument: 'FAC-10',
          coTypeDoc: 'FACT',
          nuBalanceDoc: 1000,
          nuBalanceDocOriginal: 1000,
          nuAmountPaid: 1000,
          nuAmountPaidConversion: 1000,
        }),
        makeDetail({
          idDocument: 20,
          coDocument: 'NCR-20',
          coTypeDoc: 'NCR',
          nuBalanceDoc: -1500,
          nuBalanceDocOriginal: -1500,
          nuAmountPaid: -1500,
          nuAmountPaidConversion: -1500,
        }),
      ]);
      service.automatedPrepaid = true;

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(0);
      expect(service.creditBalancePrepaidAmount).toBe(500);
      expect(service.efectivoRequerido).toBe(0);
      expect(service.isFullyCoveredCollection).toBeTrue();
    });

    it('COB-DISC-004e: descuento = saldo neto 0 → monto a pagar 0 y cobro cubierto', async () => {
      setupEditableCollection([
        makeDetail({
          idDocument: 10,
          coDocument: 'FAC-100',
          nuBalanceDoc: 100,
          nuBalanceDocOriginal: 100,
          nuAmountCollectDiscount: 100,
          nuAmountPaid: 100,
          nuAmountPaidConversion: 100,
        }),
      ]);
      service.automatedPrepaid = true;

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(0);
      expect(service.efectivoRequerido).toBe(0);
      expect(service.isFullyCoveredCollection).toBeTrue();
    });

    it('COB-NCR-PREPAID-002: regresión COB-DOC-NEG-001 neto positivo sin gross override', async () => {
      setupEditableCollection([
        makeDetail({
          idDocument: 10,
          coDocument: 'FAC-10',
          nuBalanceDoc: 1000,
          nuBalanceDocOriginal: 1000,
          nuAmountPaid: 1000,
          nuAmountPaidConversion: 1000,
        }),
        makeDetail({
          idDocument: 20,
          coDocument: 'NCR-20',
          coTypeDoc: 'NCR',
          nuBalanceDoc: -200,
          nuBalanceDocOriginal: -200,
          nuAmountPaid: -200,
          nuAmountPaidConversion: -200,
        }),
      ]);
      service.automatedPrepaid = true;

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(800);
      expect(service.creditBalancePrepaidAmount).toBe(0);
      expect(service.isFullyCoveredCollection).toBeFalse();
    });

    it('COB-DOCS-001: partials from all details even if documentSales has only current page', async () => {
      setupEditableCollection([
        makeDetail({
          idDocument: 1,
          coDocument: 'FAC-P1',
          inPaymentPartial: true,
          nuAmountPaid: 100,
          nuAmountPaidConversion: 100,
          nuBalanceDoc: 500,
        }),
        makeDetail({
          idDocument: 2,
          coDocument: 'FAC-P2',
          inPaymentPartial: true,
          nuAmountPaid: 50,
          nuAmountPaidConversion: 50,
          nuBalanceDoc: 500,
        }),
      ]);

      // Simula página 2: solo el segundo documento está en documentSales.
      service.documentSales = [{
        idDocument: 2,
        coDocument: 'FAC-P2',
        isSelected: true,
        isSave: true,
        inPaymentPartial: true,
        nuAmountPaid: 50,
        positionCollecDetails: 1,
      } as DocumentSale];
      service.documentSalesBackup = [{
        idDocument: 2,
        nuBalance: 500,
        nuAmountPaid: 50,
      } as DocumentSale];

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(150);
      expect(service.montoTotalPagar).not.toBe(50);
    });

    it('DM-COB-046: partial payment amount is used instead of full balance', async () => {
      setupEditableCollection([
        makeDetail({
          idDocument: 99,
          coDocument: 'FAC-99',
          inPaymentPartial: true,
          nuAmountPaid: 40,
          nuAmountPaidConversion: 40,
          nuBalanceDoc: 100,
          nuBalanceDocOriginal: 100,
        }),
      ]);

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(40);
      expect(service.montoTotalPagar).not.toBe(100);
    });

    it('DM-COB-041: document retentions reduce montoTotalPagar (gross - IVA - ISLR)', async () => {
      setupEditableCollection([
        makeDetail({
          idDocument: 51,
          coDocument: 'FAC-51',
          nuBalanceDoc: 51,
          nuBalanceDocOriginal: 51,
          nuAmountPaid: 51,
          nuAmountPaidConversion: 51,
          nuAmountRetention: 10,
          nuAmountRetention2: 1,
          isSave: true,
        }),
      ]);

      expect(service.getDetailRetentionTotal(service.collection.collectionDetails[0])).toBe(11);

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(40);
      expect(service.montoTotalPagar).not.toBe(51);
    });
  });

  describe('COB module type flags (DM-COB-028 / 029 / 037)', () => {
    /** Espejo del switch de cobros-container.goToNuevoCobro (contrato de tabs). */
    function applyHomeModuleType(type: 0 | 1 | 2 | 3 | 4): void {
      service.cobro25 = false;
      service.isAnticipo = false;
      service.isRetention = false;
      service.hideDocuments = false;
      service.hidePayments = false;
      service.coTypeModule = String(type);

      if (type === 1) {
        service.isAnticipo = true;
        service.hideDocuments = true;
        service.hidePayments = false;
      } else if (type === 2) {
        service.isRetention = true;
        service.hideDocuments = false;
        service.hidePayments = true;
      } else if (type === 4) {
        service.cobro25 = true;
      }
    }

    it('DM-COB-028: Anticipo hides Documents and keeps Payments', () => {
      applyHomeModuleType(1);
      expect(service.coTypeModule).toBe('1');
      expect(service.hideDocuments).toBeTrue();
      expect(service.hidePayments).toBeFalse();
      expect(service.isAnticipo).toBeTrue();
    });

    it('DM-COB-029: Retención keeps Documents and hides Payments', () => {
      applyHomeModuleType(2);
      expect(service.coTypeModule).toBe('2');
      expect(service.hideDocuments).toBeFalse();
      expect(service.hidePayments).toBeTrue();
      expect(service.isRetention).toBeTrue();
    });

    it('DM-COB-037: Cobro 25% keeps both tabs and sets cobro25', () => {
      applyHomeModuleType(4);
      expect(service.coTypeModule).toBe('4');
      expect(service.cobro25).toBeTrue();
      expect(service.hideDocuments).toBeFalse();
      expect(service.hidePayments).toBeFalse();
    });

    it('DM-COB-029: retention module totals use retention sum not document balance', async () => {
      const svc = service as any;
      spyOn(service, 'convertirMonto').and.callFake((amount: number) => Number(amount) || 0);
      spyOn(svc.currencyService, 'formatNumber').and.callFake((n: number) => String(n ?? 0));
      spyOn(service, 'cleanFormattedNumber').and.callFake((value: string | number) => Number(value) || 0);
      spyOn(svc, 'shouldApplyIgtfToCollection').and.returnValue(false);
      spyOn(svc, 'shouldCalculateEmbeddedIgtf').and.returnValue(false);
      spyOn(svc, 'syncCollectionDetailsRetentionConversions').and.stub();
      spyOn(svc, 'resolveAutomatedPrepaid').and.stub();
      spyOn(service, 'syncAddPaymentMethodDisabledState').and.stub();
      spyOn(svc, 'syncCollectionDetailsIgtfAmounts').and.stub();
      spyOn(svc, 'syncCollectionIgtfFields').and.stub();
      spyOn(svc, 'applyCollectionIgtfAmountFields').and.stub();

      service.coTypeModule = '2';
      service.isOpen = false;
      service.documentSales = [];
      service.documentSalesBackup = [];
      service.collection = {
        coType: '2',
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_NEW,
        stCollection: service.COLLECT_STATUS_NEW,
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-R',
          nuBalanceDoc: 51,
          nuAmountPaid: 51,
          nuAmountRetention: 10,
          nuAmountRetention2: 1,
          nuAmountDiscount: 0,
          nuAmountCollectDiscount: 0,
          isSave: true,
          inPaymentPartial: false,
        } as CollectionDetail],
        collectionPayments: [],
        nuAmountIgtf: 0,
      } as any;

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(11);
      expect(service.collection.nuDifference).toBe(0);
    });
  });

  describe('COB payment methods completeness (DM-COB-010 / 040 / TR)', () => {
    beforeEach(() => {
      service.tipoPagoEfectivo = false;
      service.tipoPagoCheque = false;
      service.tipoPagoDeposito = false;
      service.tipoPagoTransferencia = false;
      service.tipoPagoPagoMovil = false;
      service.tipoPagoOtros = false;
      service.pagoEfectivo = [];
      service.pagoCheque = [];
      service.pagoDeposito = [];
      service.pagoTransferencia = [];
      service.pagoMovil = [];
      service.clientBankAccount = false;
    });

    it('DM-COB-010: efectivo is complete with positive amount only', () => {
      service.tipoPagoEfectivo = true;
      service.pagoEfectivo = [{ monto: 100 } as any];
      expect(service.isIndexedPaymentMethodComplete('ef', 0)).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeFalse();

      service.pagoEfectivo = [{ monto: 0 } as any];
      expect(service.hasIncompletePaymentMethods()).toBeTrue();
    });

    it('blocks empty collectionPayment without payment method', () => {
      service.collection = {
        collectionPayments: [
          { coPaymentMethod: 'pm', coType: 'pm', nuAmountPartial: 10, idBank: 9 } as any,
          { coPaymentMethod: '', coType: '', nuAmountPartial: 0, idBank: 0 } as any,
        ],
      } as any;

      expect(service.hasEmptyCollectionPayments()).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeTrue();
      expect(service.getNonEmptyCollectionPayments(service.collection.collectionPayments).length).toBe(1);
      expect(service.blockSaveAndSendForInvalidPayments()).toBeTrue();
      let saveEnabled: boolean | undefined;
      service.collectValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.generalTabValidForSave = true;
      service.collectionPersistedBaseline = true;
      service.collectionDirtySincePersist = false;
      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeFalse();
      service.markCollectionDirty();
      expect(saveEnabled).toBeTrue();
    });

    it('allows save/send when all collectionPayments have method', () => {
      service.collection = {
        collectionPayments: [
          {
            coPaymentMethod: 'pm',
            coType: 'pm',
            nuAmountPartial: 10,
            idBank: 9,
            daValue: '2026-08-04',
            naBank: 'Banco QA',
            nuPaymentDoc: 'REF-PM-1',
            nuBankAccount: '0102-001',
            nuDocument: 'V12345678',
            nuPhoneNumber: '1234567',
          } as any,
        ],
      } as any;
      service.tipoPagoPagoMovil = false;
      service.hidePayments = false;
      service.pagoMovil = [];

      expect(service.hasEmptyCollectionPayments()).toBeFalse();
      expect(service.hasIncompletePaymentMethods()).toBeFalse();
    });

    it('DM-COB-040: deposito requires bank, account, number, date and amount', () => {
      service.tipoPagoDeposito = true;
      service.pagoDeposito = [{
        monto: 350,
        fecha: '2026-08-04',
        nombreBanco: 'Banco QA',
        numeroCuenta: '0102-001',
        numeroDeposito: 'TEST-DEP-040',
      } as any];
      expect(service.isIndexedPaymentMethodComplete('de', 0)).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeFalse();

      service.pagoDeposito[0].numeroDeposito = '';
      expect(service.hasIncompletePaymentMethods()).toBeTrue();
    });

    it('COB-TR-001: transferencia complete without clientBankAccount', () => {
      service.tipoPagoTransferencia = true;
      service.clientBankAccount = false;
      service.pagoTransferencia = [{
        monto: 100,
        fecha: '2026-08-04',
        nombreBanco: 'Banco Receptor',
        numeroCuenta: '0102-999',
        numeroTransferencia: 'REF-001',
        showNuevaCuenta: false,
        numeroCuentaCliente: '',
        nuevaCuenta: '',
      } as any];

      expect(service.isIndexedPaymentMethodComplete('tr', 0)).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeFalse();
    });

    it('COB-TR-001: transferencia with clientBankAccount requires existing client account', () => {
      service.tipoPagoTransferencia = true;
      service.clientBankAccount = true;
      service.pagoTransferencia = [{
        monto: 100,
        fecha: '2026-08-04',
        nombreBanco: 'Banco Receptor',
        numeroCuenta: '0102-999',
        numeroTransferencia: 'REF-001',
        showNuevaCuenta: false,
        numeroCuentaCliente: '',
        nuevaCuenta: '',
      } as any];

      expect(service.isIndexedPaymentMethodComplete('tr', 0)).toBeFalse();
      expect(service.hasIncompletePaymentMethods()).toBeTrue();

      service.pagoTransferencia[0].numeroCuentaCliente = '0102-CLIENTE';
      expect(service.isIndexedPaymentMethodComplete('tr', 0)).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeFalse();
    });

    it('COB-TR-001: transferencia nueva cuenta requires nuevaCuenta text', () => {
      service.tipoPagoTransferencia = true;
      service.clientBankAccount = true;
      service.pagoTransferencia = [{
        monto: 100,
        fecha: '2026-08-04',
        nombreBanco: 'Banco Receptor',
        numeroCuenta: '0102-999',
        numeroTransferencia: 'REF-001',
        showNuevaCuenta: true,
        numeroCuentaCliente: 'Nueva Cuenta',
        nuevaCuenta: '',
      } as any];

      expect(service.isIndexedPaymentMethodComplete('tr', 0)).toBeFalse();

      service.pagoTransferencia[0].nuevaCuenta = '0123-456789';
      expect(service.isIndexedPaymentMethodComplete('tr', 0)).toBeTrue();
    });

    it('DM-COB-011: cheque requires amount, dates, bank and cheque number', () => {
      service.tipoPagoCheque = true;
      service.pagoCheque = [{
        monto: 250,
        fecha: '2026-08-04',
        fechaValor: '2026-08-10',
        nombreBanco: 'Banco Cheque',
        numeroCheque: 'CHQ-001',
      } as any];
      expect(service.isIndexedPaymentMethodComplete('ch', 0)).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeFalse();

      service.pagoCheque[0].numeroCheque = '';
      expect(service.hasIncompletePaymentMethods()).toBeTrue();
    });

    it('DM-COB-039: pago movil requires amount, date, banks, document, phone and reference', () => {
      service.tipoPagoPagoMovil = true;
      service.pagoMovil = [{
        monto: 80,
        fecha: '2026-08-04',
        codigoTelefono: '0414',
        numeroTelefono: '1234567',
        nombreBancoEmisor: 'Banco Emisor',
        nombreBancoDestino: 'Banco Destino',
        numeroDocumento: '12345678',
        numeroReferencia: 'PM-REF-001',
      } as any];
      expect(service.isIndexedPaymentMethodComplete('pm', 0)).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeFalse();

      service.pagoMovil[0].numeroReferencia = '';
      expect(service.hasIncompletePaymentMethods()).toBeTrue();

      service.pagoMovil[0].numeroReferencia = 'PM-REF-001';
      service.pagoMovil[0].numeroTelefono = '';
      expect(service.hasIncompletePaymentMethods()).toBeTrue();
      expect(service.getIndexedPaymentFieldErrors('pm', 0)).toContain('numeroTelefono');
    });
  });

  describe('COB tolerancia / diferencia (DM-COB-012 / 043)', () => {
    function setupToleranceBase(): jasmine.Spy {
      service.collection = { coCurrency: 'USD' } as any;
      service.MonedaTolerancia = 'USD';
      service.TipoTolerancia = 0;
      service.parteDecimal = 2;
      service.RangoToleranciaPositiva = 10;
      service.RangoToleranciaNegativa = 100000;
      service.alwaysPartialPayment = false;
      service.enablePartialPayment = true;
      service.existPartialPayment = false;
      service.montoTotalPagar = 100;
      return spyOn(service, 'onCollectionValidToSend');
    }

    it('DM-COB-012: underpayment within negative tolerance enables send', () => {
      const spy = setupToleranceBase();
      service.montoTotalPagado = 0.1;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('DM-COB-012: underpayment beyond negative tolerance disables send', () => {
      const spy = setupToleranceBase();
      service.RangoToleranciaNegativa = 5;
      service.montoTotalPagado = 90;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(false);
    });

    it('DM-COB-043: exact payment enables send', () => {
      const spy = setupToleranceBase();
      service.montoTotalPagado = 100;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('DM-COB-012: zero paid disables send', () => {
      const spy = setupToleranceBase();
      service.montoTotalPagado = 0;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(false);
    });

    it('DM-COB-012: overpayment within positive absolute tolerance enables send', () => {
      const spy = setupToleranceBase();
      // amount = 5 <= RangoToleranciaPositiva(10) → Enviar ON
      service.montoTotalPagado = 105;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('DM-COB-012: overpayment at positive absolute tolerance ceiling enables send', () => {
      const spy = setupToleranceBase();
      // amount = 10 <= 10 → Enviar ON (comparador inclusivo, COB-TOL-DEC-002)
      service.montoTotalPagado = 110;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('DM-COB-012: overpayment beyond positive absolute tolerance disables send', () => {
      const spy = setupToleranceBase();
      service.montoTotalPagado = 110.01;
      service.parteDecimal = 2;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  describe('COB-TOL-DEC-001 decimales en tolerancia / anticipo config', () => {
    it('parseConfigDecimal acepta punto, coma y rechaza inválidos', () => {
      const parse = (service as any).parseConfigDecimal.bind(service);
      expect(parse('0.5')).toBe(0.5);
      expect(parse('1,5')).toBe(1.5);
      expect(parse(2.25)).toBe(2.25);
      expect(parse('')).toBe(0);
      expect(parse('abc')).toBe(0);
      expect(parse(-1)).toBe(0);
    });

    it('tolerancia absoluta con rangos 0.5 valida dentro/fuera', () => {
      service.collection = { coCurrency: 'USD' } as any;
      service.MonedaTolerancia = 'USD';
      service.TipoTolerancia = 0;
      service.parteDecimal = 2;
      service.RangoToleranciaPositiva = 0.5;
      service.RangoToleranciaNegativa = 0.5;
      service.alwaysPartialPayment = false;
      service.enablePartialPayment = true;
      service.existPartialPayment = false;
      service.montoTotalPagar = 100;
      const spy = spyOn(service, 'onCollectionValidToSend');

      service.montoTotalPagado = 100.4;
      service.checkTolerancia();
      expect(spy).toHaveBeenCalledWith(true);

      spy.calls.reset();
      service.montoTotalPagado = 100.5;
      service.checkTolerancia();
      // amount = 0.5 <= 0.5 → ON (inclusivo)
      expect(spy).toHaveBeenCalledWith(true);

      spy.calls.reset();
      service.montoTotalPagado = 100.51;
      service.checkTolerancia();
      expect(spy).toHaveBeenCalledWith(false);

      spy.calls.reset();
      service.montoTotalPagado = 99.5;
      service.checkTolerancia();
      expect(spy).toHaveBeenCalledWith(true);

      spy.calls.reset();
      service.montoTotalPagado = 99.4;
      service.checkTolerancia();
      expect(spy).toHaveBeenCalledWith(false);
    });

    it('initLogicService carga prepaid/rangos decimales desde globalConfig (coma)', () => {
      const cfg = (service as any).globalConfig;
      spyOn(cfg, 'get').and.callFake((key: string) => {
        if (key === 'prepaidRangeAmount') {
          return '0,5';
        }
        if (key === 'RangoToleranciaPositiva') {
          return '1.25';
        }
        if (key === 'RangoToleranciaNegativa') {
          return '0,75';
        }
        if (key === 'parteDecimal') {
          return '2';
        }
        if (key === 'TipoTolerancia' || key === 'RangoTolerancia' || key === 'sizeRetention') {
          return '0';
        }
        if (key === 'currencyModule') {
          return 'false';
        }
        return 'false';
      });

      service.initLogicService();

      expect(service.prepaidRangeAmount).toBe(0.5);
      expect(service.RangoToleranciaPositiva).toBe(1.25);
      expect(service.RangoToleranciaNegativa).toBe(0.75);
    });
  });

  describe('COB-TOL-DEC-002 redondeo e inclusividad en tolerancia absoluta', () => {
    function setupQaToleranceCase(): jasmine.Spy {
      service.collection = { coCurrency: 'USD' } as any;
      service.MonedaTolerancia = 'USD';
      service.TipoTolerancia = 0;
      service.parteDecimal = 2;
      service.RangoToleranciaPositiva = 49.99;
      service.RangoToleranciaNegativa = 100000;
      service.alwaysPartialPayment = false;
      service.enablePartialPayment = true;
      service.existPartialPayment = false;
      service.montoTotalPagar = 672;
      return spyOn(service, 'onCollectionValidToSend');
    }

    it('acepta diferencia exactamente en el tope 49.99 (caso QA 721.99 - 672)', () => {
      const spy = setupQaToleranceCase();
      service.montoTotalPagado = 721.99;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(true);
      expect((service as any).getRoundedPaymentDelta()).toBe(49.99);
    });

    it('redondea delta flotante 49.99000000000001 antes de comparar', () => {
      const spy = setupQaToleranceCase();
      // Fuerza valores que en IEEE-754 producen residuo > 49.99 sin redondeo
      service.montoTotalPagar = 672;
      service.montoTotalPagado = 672 + 49.99000000000001;

      service.checkTolerancia();

      expect((service as any).getRoundedPaymentDelta()).toBe(49.99);
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('rechaza exceso por encima del tope tras redondeo', () => {
      const spy = setupQaToleranceCase();
      service.montoTotalPagado = 722;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  describe('COB tolerancia porcentual (TipoTolerancia != 0)', () => {
    function setupPercentToleranceBase(): jasmine.Spy {
      service.collection = { coCurrency: 'USD' } as any;
      service.MonedaTolerancia = 'USD';
      service.TipoTolerancia = 1;
      service.parteDecimal = 2;
      // 5% positivo / 10% negativo sobre monto a pagar
      service.RangoToleranciaPositiva = 5;
      service.RangoToleranciaNegativa = 10;
      service.alwaysPartialPayment = false;
      service.enablePartialPayment = true;
      service.existPartialPayment = false;
      service.montoTotalPagar = 100;
      return spyOn(service, 'onCollectionValidToSend');
    }

    it('DM-COB-012-%: overpayment within positive percent enables send', () => {
      const spy = setupPercentToleranceBase();
      // allowedPositive = 100 * 5% = 5; delta 5 <= 5 → ON
      service.montoTotalPagado = 105;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('DM-COB-012-%: overpayment beyond positive percent disables send', () => {
      const spy = setupPercentToleranceBase();
      // delta 6 > 5 → OFF
      service.montoTotalPagado = 106;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(false);
    });

    it('DM-COB-012-%: underpayment within negative percent enables send', () => {
      const spy = setupPercentToleranceBase();
      // allowedNegative = 100 * 10% = 10; |delta| 10 <= 10 → ON
      service.montoTotalPagado = 90;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('DM-COB-012-%: underpayment beyond negative percent disables send', () => {
      const spy = setupPercentToleranceBase();
      // |delta| 11 > 10 → OFF
      service.montoTotalPagado = 89;

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(false);
    });

    it('DM-COB-012: tolerancia0=false requires exact amount (validateToSend)', async () => {
      service.tolerancia0 = false;
      service.alwaysPartialPayment = false;
      service.enablePartialPayment = true;
      service.existPartialPayment = false;
      service.coTypeModule = '0';
      service.montoTotalPagar = 100;
      service.montoTotalPagado = 95;
      service.collection = {
        coType: '0',
        coCurrency: 'USD',
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-1',
          isSave: true,
          inPaymentPartial: false,
        }],
        collectionPayments: [{ coType: 'ef', coPaymentMethod: 'ef', nuAmountPartial: 95 }],
      } as any;
      service.documentSales = [{
        idDocument: 1,
        coDocument: 'FAC-1',
        isSelected: true,
        isSave: true,
        positionCollecDetails: 0,
      } as DocumentSale];

      spyOn(service, 'hasIncompletePaymentMethods').and.returnValue(false);
      spyOn(service, 'validateReferencePayment').and.resolveTo(true);
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
      };
      spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
      const spy = spyOn(service, 'onCollectionValidToSend');

      await service.validateToSend();

      expect(spy).toHaveBeenCalledWith(false);
    });

    it('DM-COB-012: cross-currency absolute tolerance uses converted positive range', () => {
      service.collection = { coCurrency: 'USD', nuValueLocal: 40 } as any;
      service.MonedaTolerancia = 'VES';
      service.MonedaToleranciaIsLocal = true;
      service.localCurrency = { coCurrency: 'VES', localCurrency: 'true' } as any;
      service.hardCurrency = { coCurrency: 'USD', hardCurrency: 'true' } as any;
      service.currencyLocal = false;
      service.TipoTolerancia = 0;
      service.RangoToleranciaPositiva = 400; // VES → 400/40 = 10 USD
      service.RangoToleranciaNegativa = 100;
      service.alwaysPartialPayment = false;
      service.enablePartialPayment = true;
      service.existPartialPayment = false;
      service.montoTotalPagar = 100;
      service.montoTotalPagado = 105;
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
        isLocalCurrency: (co: string) => co === 'VES',
      };
      spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
      const spy = spyOn(service, 'onCollectionValidToSend');

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('COB-TOL-001: underpayment in local currency vs hard MonedaTolerancia converts range × rate', () => {
      // Caso real: cobro BS, tolerancia $ 100000, faltante ~4382 BS (toggle parcial OFF).
      service.collection = { coCurrency: 'BS', nuValueLocal: 795 } as any;
      service.MonedaTolerancia = 'USD';
      service.MonedaToleranciaIsLocal = false;
      service.MonedaToleranciaIsHard = true;
      service.localCurrency = { coCurrency: 'BS', localCurrency: 'true' } as any;
      service.hardCurrency = { coCurrency: 'USD', hardCurrency: 'true' } as any;
      service.currencyLocal = true;
      service.TipoTolerancia = 0;
      service.RangoToleranciaPositiva = 100000;
      service.RangoToleranciaNegativa = 100000;
      service.alwaysPartialPayment = false;
      service.enablePartialPayment = true;
      service.existPartialPayment = false;
      service.allPaymentPartial = false;
      service.montoTotalPagar = 5382.08;
      service.montoTotalPagado = 1000; // faltante 4382.08 BS << 100000*795
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
        isLocalCurrency: (co: string) => co === 'BS',
      };
      spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
      const spy = spyOn(service, 'onCollectionValidToSend');

      service.checkTolerancia();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('COB-TOL-001: issueAmountOrTolerancia no usa mensaje de pago parcial', async () => {
      service.tolerancia0 = true;
      service.TipoTolerancia = 0;
      service.collection = {
        coType: '0',
        coCurrency: 'BS',
        nuValueLocal: 795,
        collectionDetails: [{ inPaymentPartial: false, isSave: true, idDocument: 1, coDocument: 'F1' }],
        collectionPayments: [{ coType: 'de', coPaymentMethod: 'de', nuAmountPartial: 1000 }],
      } as any;
      service.MonedaTolerancia = 'USD';
      service.localCurrency = { coCurrency: 'BS', localCurrency: 'true' } as any;
      service.hardCurrency = { coCurrency: 'USD', hardCurrency: 'true' } as any;
      service.currencyLocal = true;
      service.RangoToleranciaNegativa = 100000;
      service.RangoToleranciaPositiva = 100000;
      service.alwaysPartialPayment = false;
      service.enablePartialPayment = true;
      service.hidePayments = false;
      service.createAutomatedPrepaid = false;
      service.montoTotalPagar = 5382.08;
      service.montoTotalPagado = 1000;
      service.collectionTags.set('COB_ERROR_PARTIAL_PAY', 'Todos los documentos estan marcados como pago parcial');
      service.collectionTags.set('COB_ERROR_TOLERANCIA', 'Fuera de tolerancia');
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
        isLocalCurrency: (co: string) => co === 'BS',
      };
      spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
      spyOn(service as any, 'hasAddedPaymentMethodForSendUx').and.returnValue(true);

      const issue = (service as any).issueAmountOrTolerancia();
      expect(issue).toBeNull();
    });
  });

  describe('COB hardening P0/P1 (send gates / money)', () => {
    beforeEach(() => {
      service.tipoPagoEfectivo = false;
      service.tipoPagoCheque = false;
      service.tipoPagoDeposito = false;
      service.tipoPagoTransferencia = false;
      service.tipoPagoPagoMovil = false;
      service.tipoPagoOtros = false;
      service.pagoEfectivo = [];
      service.pagoDeposito = [];
      service.pagoOtros = [];
    });

    it('P0: multi-method incomplete when deposito missing fields even if efectivo ok', () => {
      service.tipoPagoEfectivo = true;
      service.tipoPagoDeposito = true;
      service.pagoEfectivo = [{ monto: 50 } as any];
      service.pagoDeposito = [{
        monto: 50,
        fecha: '2026-08-04',
        nombreBanco: 'Banco',
        numeroCuenta: '0102',
        numeroDeposito: '',
      } as any];

      expect(service.hasIncompletePaymentMethods()).toBeTrue();
    });

    it('COB-DOCS-001: applyExistingSelection restores partial flag and paid amount', () => {
      spyOn(service, 'convertirMonto').and.callFake((amount: number) => Number(amount) || 0);
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_NEW,
        stCollection: service.COLLECT_STATUS_NEW,
        isSave: 0,
        collectionDetails: [{
          idDocument: 7,
          coDocument: 'FAC-7',
          inPaymentPartial: true,
          nuAmountPaid: 40,
          isSave: true,
          daVoucher: '',
          nuAmountRetention: 0,
          nuAmountRetention2: 0,
          nuValueLocal: 1,
          nuVoucherRetention: 0,
        }],
      } as any;
      service.documentSales = [{
        idDocument: 7,
        coDocument: 'FAC-7',
        nuBalance: 100,
        isSelected: false,
        inPaymentPartial: false,
        nuAmountPaid: 0,
        isSave: false,
      } as DocumentSale];
      service.documentSalesBackup = [{ ...service.documentSales[0] } as DocumentSale];

      (service as any).applyExistingSelection(0, service.documentSales[0], service.documentSalesBackup[0]);

      expect(service.documentSales[0].isSelected).toBeTrue();
      expect(service.documentSales[0].inPaymentPartial).toBeTrue();
      expect(service.documentSales[0].nuAmountPaid).toBe(40);
      expect(service.documentSales[0].positionCollecDetails).toBe(0);
      // UI: nuBalanceDoc = bruto del documento; remaining solo al enviar (COB-TOTAL-002).
      expect(service.collection.collectionDetails[0].nuBalanceDoc).toBe(100);
      expect(service.collection.collectionDetails[0].nuBalanceDocOriginal).toBe(100);
    });

    it('applyRemainingBalanceDocAfterPartialPayment sets remaining balance from original minus paid', () => {
      const detail = {
        inPaymentPartial: true,
        nuAmountPaid: 100,
        nuAmountPaidConversion: 100,
        nuBalanceDocOriginal: 500,
        nuBalanceDocOriginalConversion: 500,
        nuBalanceDoc: 500,
        nuBalanceDocConversion: 500,
      } as CollectionDetail;

      service.applyRemainingBalanceDocAfterPartialPayment(detail);

      expect(detail.nuBalanceDoc).toBe(400);
      expect(detail.nuBalanceDocConversion).toBe(400);
      expect(detail.nuBalanceDocOriginal).toBe(500);
    });

    it('restoreGrossBalanceDocForDisplay restores nuBalanceDoc from original', () => {
      const detail = {
        nuBalanceDoc: 400,
        nuBalanceDocConversion: 400,
        nuBalanceDocOriginal: 500,
        nuBalanceDocOriginalConversion: 500,
      } as CollectionDetail;

      service.restoreGrossBalanceDocForDisplay(detail);

      expect(detail.nuBalanceDoc).toBe(500);
      expect(detail.nuBalanceDocConversion).toBe(500);
    });

    it('copyDocumentSaleOpenToSalesAndDetails keeps gross nuBalanceDoc after partial save', () => {
      spyOn(service, 'convertirMonto').and.callFake((amount: number) => Number(amount) || 0);
      spyOn(service, 'shouldApplyIgtfToCollection').and.returnValue(false);
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-1',
          nuBalanceDoc: 500,
          nuBalanceDocConversion: 500,
          nuBalanceDocOriginal: 500,
          nuBalanceDocOriginalConversion: 500,
          nuAmountPaid: 0,
          nuAmountDiscount: 0,
          nuAmountCollectDiscount: 0,
          nuAmountRetention: 0,
          nuAmountRetention2: 0,
          nuValueLocal: 1,
          coOriginal: 'USD',
          isSave: false,
          inPaymentPartial: false,
          daVoucher: '',
          nuVoucherRetention: '',
        }],
      } as any;
      service.documentSaleOpen = {
        positionCollecDetails: 0,
        daVoucher: '2026-08-24',
        nuAmountRetention: 0,
        nuAmountRetention2: 0,
        nuVaucherRetention: '',
        nuValueLocal: 1,
        coCurrency: 'USD',
      } as any;
      service.indexDocumentSaleOpen = 0;
      service.documentSales = [{
        idDocument: 1,
        coDocument: 'FAC-1',
        nuBalance: 500,
        isSave: false,
        inPaymentPartial: false,
        nuAmountPaid: 0,
        nuAmountRetention: 0,
        nuAmountRetention2: 0,
        positionCollecDetails: 0,
      } as DocumentSale];
      service.documentSalesBackup = [{ ...service.documentSales[0], nuBalance: 500 } as DocumentSale];
      service.isPaymentPartial = true;
      service.amountPaid = 100;

      service.copyDocumentSaleOpenToSalesAndDetails();

      expect(service.collection.collectionDetails[0].nuBalanceDoc).toBe(500);
      expect(service.collection.collectionDetails[0].nuBalanceDocOriginal).toBe(500);
      expect(service.collection.collectionDetails[0].nuAmountPaid).toBe(100);
    });

    it('prepareCollectionDetailsForSend sends remaining nuBalanceDoc on partial payment', async () => {
      spyOn(service, 'getCollectionDetails').and.resolveTo([{
        coDocument: 'FAC-1',
        inPaymentPartial: true,
        nuAmountPaid: 100,
        nuAmountPaidConversion: 100,
        nuBalanceDoc: 400,
        nuBalanceDocConversion: 400,
        nuBalanceDocOriginal: 500,
        nuBalanceDocOriginalConversion: 500,
      } as CollectionDetail]);
      spyOn(service, 'getCollectionDetailsRetentions').and.resolveTo([]);
      spyOn(service, 'getCollectionDetailsDiscounts').and.resolveTo([]);

      const details = await service.prepareCollectionDetailsForSend({} as any, 'COB-1');

      expect(details[0].nuBalanceDoc).toBe(400);
      expect(details[0].nuBalanceDocConversion).toBe(400);
      expect(details[0].nuBalanceDocOriginal).toBe(500);
    });

    it('prepareCollectionDetailsForSend sends original nuBalanceDoc on full payment', async () => {
      spyOn(service, 'getCollectionDetails').and.resolveTo([{
        coDocument: 'FAC-2',
        inPaymentPartial: false,
        nuAmountPaid: 500,
        nuBalanceDoc: 500,
        nuBalanceDocConversion: 500,
        nuBalanceDocOriginal: 500,
        nuBalanceDocOriginalConversion: 500,
      } as CollectionDetail]);
      spyOn(service, 'getCollectionDetailsRetentions').and.resolveTo([]);
      spyOn(service, 'getCollectionDetailsDiscounts').and.resolveTo([]);

      const details = await service.prepareCollectionDetailsForSend({} as any, 'COB-2');

      expect(details[0].nuBalanceDoc).toBe(500);
      expect(details[0].nuBalanceDocConversion).toBe(500);
    });

    it('prepareCollectionDetailsForSend recomputes partial nuBalanceDoc from original minus paid', async () => {
      spyOn(service, 'getCollectionDetails').and.resolveTo([{
        coDocument: 'FAC-3',
        inPaymentPartial: true,
        nuAmountPaid: 100,
        nuAmountPaidConversion: 100,
        nuBalanceDoc: 500,
        nuBalanceDocConversion: 500,
        nuBalanceDocOriginal: 500,
        nuBalanceDocOriginalConversion: 500,
      } as CollectionDetail]);
      spyOn(service, 'getCollectionDetailsRetentions').and.resolveTo([]);

      const details = await service.prepareCollectionDetailsForSend({} as any, 'COB-3');

      expect(details[0].nuBalanceDoc).toBe(400);
      expect(details[0].nuBalanceDocConversion).toBe(400);
    });

    it('DM-COB-042: Otros is complete with positive amount and name', () => {
      service.tipoPagoOtros = true;
      service.enableDifferenceCodes = false;
      service.pagoOtros = [{
        monto: 25,
        nombre: 'Ajuste QA',
        differenceCode: { idDifferenceCode: null, coDifferenceCode: null },
      } as any];
      expect(service.isIndexedPaymentMethodComplete('ot', 0)).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeFalse();

      service.pagoOtros[0].nombre = '';
      expect(service.hasIncompletePaymentMethods()).toBeTrue();
    });

    it('COB-DIFF-001: enableDifferenceCodes exige código en Otros', () => {
      service.tipoPagoOtros = true;
      service.enableDifferenceCodes = true;
      service.pagoOtros = [{
        monto: 25,
        nombre: 'Ajuste QA',
        differenceCode: { idDifferenceCode: null, coDifferenceCode: null },
      } as any];
      service.collectionTags.set('COB_MSJ_ERROR_NO_DIFFERENCE_CODE', 'Seleccione código diferencia');

      expect(service.isIndexedPaymentMethodComplete('ot', 0)).toBeFalse();
      expect(service.hasMissingOtrosDifferenceCodes()).toBeTrue();
      expect(service.hasSendFieldErrors()).toBeTrue();
      expect(service.getCollectionSendValidationMessage()).toContain('código diferencia');
      expect(service.getIndexedPaymentFieldErrors('ot', 0)).toContain('differenceCode');
      expect(service.resolveSendValidationFocusTab()).toBe('pagos');

      service.pagoOtros[0].differenceCode = {
        idDifferenceCode: 7,
        coDifferenceCode: 'DIFF-7',
      };
      expect(service.isIndexedPaymentMethodComplete('ot', 0)).toBeTrue();
      expect(service.hasMissingOtrosDifferenceCodes()).toBeFalse();
    });

    it('COB-SEND-GENERAL-001: comentario obligatorio solo si requiredComment y vacío', () => {
      service.requiredComment = false;
      service.collection = { txComment: 'Ttt' } as any;
      expect(service.hasRequiredCommentFieldError()).toBeFalse();

      service.requiredComment = true;
      service.collection = { txComment: 'Ttt' } as any;
      expect(service.hasRequiredCommentFieldError()).toBeFalse();

      service.collection = { txComment: '' } as any;
      expect(service.hasRequiredCommentFieldError()).toBeTrue();

      service.syncCommentValidityFromCollection();
      expect(service.validComment).toBeFalse();

      service.requiredComment = false;
      service.syncCommentValidityFromCollection();
      expect(service.validComment).toBeTrue();
    });

    it('COB-SEND-GENERAL-001: tasa manual y motivo de cambio solo si config activa', () => {
      service.enabledManualRate = false;
      service.collection = { nuValueLocal: 0 } as any;
      expect(service.hasManualRateFieldError()).toBeFalse();

      service.enabledManualRate = true;
      expect(service.hasManualRateFieldError()).toBeTrue();

      service.requiresTxConversionReason = false;
      service.collection = { txConversion: '' } as any;
      expect(service.hasTxConversionFieldError()).toBeFalse();

      service.requiresTxConversionReason = true;
      expect(service.hasTxConversionFieldError()).toBeTrue();

      service.collection = { txConversion: 'Cambio de tasa' } as any;
      expect(service.hasTxConversionFieldError()).toBeFalse();
    });

    it('COB-SEND-ALL-001: colector fail-fast devuelve solo el primer issue', async () => {
      service.hideDocuments = false;
      service.hidePayments = false;
      service.requiredComment = true;
      service.validComment = false;
      service.enableDifferenceCodes = true;
      service.requiredCollectionAttachments = true;
      service.tipoPagoOtros = true;
      service.tolerancia0 = false;
      service.montoTotalPagar = 100;
      service.montoTotalPagado = 25;
      service.createAutomatedPrepaid = false;
      spyOn(service.adjuntoService, 'hasItems').and.returnValue(false);
      service.collectionTags.set('COB_MSJ_ERROR_NO_COMMENT', 'Falta comentario');
      service.collectionTags.set('COB_MSJ_ERROR_NO_DIFFERENCE_CODE', 'Falta código diferencia');
      service.collectionTags.set('COB_ERROR_PARTIAL_PAY', 'Fuera de tolerancia');
      service.collectionTags.set('COB_RET_MSJ_COLLECTION_NO_ATTACHMENTS', 'Faltan adjuntos');

      service.pagoOtros = [{
        monto: 25,
        nombre: 'Ajuste QA',
        differenceCode: { idDifferenceCode: null, coDifferenceCode: null },
      } as any];
      service.collection = {
        coType: '0',
        coCurrency: 'USD',
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-1',
          isSave: true,
          nuAmountPaid: 100,
          inPaymentPartial: false,
        }],
        collectionPayments: [{
          coType: 'ot',
          coPaymentMethod: 'ot',
          nuAmountPartial: 25,
          nuPaymentDoc: 'Ajuste QA',
          idDifferenceCode: null,
          coDifferenceCode: '',
        }],
      } as any;
      service.documentSales = [{
        idDocument: 1,
        coDocument: 'FAC-1',
        isSelected: true,
        isSave: true,
        positionCollecDetails: 0,
      } as DocumentSale];

      const attachmentsSpy = spyOn(service as any, 'issueMissingAttachments').and.callThrough();
      const refsSpy = spyOn(service as any, 'issueInvalidPaymentReferences').and.callThrough();

      const issues = await service.collectCollectionSendIssues();

      expect(issues.length).toBe(1);
      expect(issues[0].code).toBe('NO_DIFFERENCE_CODE');
      expect(issues[0].message).toBe('Falta código diferencia');
      expect(service.getCollectionSendValidationMessage()).toBe(issues[0].message);
      expect(service.resolveSendValidationFocusTab()).toBe(issues[0].tab);
      expect(attachmentsSpy).not.toHaveBeenCalled();
      expect(refsSpy).not.toHaveBeenCalled();
    });

    it('COB-SEND-ALL-001: createAutomatedPrepaid no oculta issues de campos', () => {
      service.createAutomatedPrepaid = true;
      service.requiredComment = true;
      service.validComment = false;
      service.collection = { coType: '0', collectionPayments: [], collectionDetails: [] } as any;

      service.onCollectionValidToSend(false);

      expect(service.lastValidToSend).toBeFalse();
    });

    it('COB-SEND-ATTACH-001: prepaid no fuerza Enviar ON si faltan adjuntos', async () => {
      service.hideDocuments = false;
      service.hidePayments = false;
      service.requiredComment = false;
      service.requiredCollectionAttachments = true;
      service.createAutomatedPrepaid = true;
      spyOn(service.adjuntoService, 'hasItems').and.returnValue(false);
      service.collectionTags.set('COB_RET_MSJ_COLLECTION_NO_ATTACHMENTS', 'Faltan adjuntos');
      service.collection = {
        coType: '0',
        coCurrency: 'USD',
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-1',
          isSave: true,
          nuAmountPaid: 100,
          inPaymentPartial: false,
        }],
        collectionPayments: [{
          coType: 'ef',
          coPaymentMethod: 'ef',
          nuAmountPartial: 150,
        }],
      } as any;
      service.documentSales = [{
        idDocument: 1,
        coDocument: 'FAC-1',
        isSelected: true,
        isSave: true,
        positionCollecDetails: 0,
      } as DocumentSale];
      service.pagoEfectivo = [{ monto: 150 } as any];
      service.montoTotalPagar = 100;
      service.montoTotalPagado = 150;
      service.tolerancia0 = true;
      service.TipoTolerancia = 0;
      service.RangoToleranciaPositiva = 100000;
      service.MonedaTolerancia = 'USD';
      spyOn(service as any, 'validateReferencePaymentForCollect').and.resolveTo(true);
      spyOn(service as any, 'hasValidDocumentSalesForSend').and.returnValue(true);
      spyOn(service as any, 'hasIncompletePaymentMethods').and.returnValue(false);
      spyOn(service as any, 'hasEmptyCollectionPayments').and.returnValue(false);
      spyOn(service as any, 'hasIncompletePersistedPaymentAmounts').and.returnValue(false);
      spyOn(service as any, 'hasIncompleteDocumentAmountToPay').and.returnValue(false);

      await service.validateToSend();

      expect(service.lastValidToSend).toBeFalse();
      expect(service.lastSendIssues.some(i => i.code === 'NO_ATTACHMENTS')).toBeTrue();
      expect(service.canProceedSendAfterValidation()).toBeFalse();
    });

    it('COB-SEND-ATTACH-001: prepaid con exceso y adjuntos OK permite Enviar', async () => {
      service.hideDocuments = false;
      service.hidePayments = false;
      service.requiredComment = false;
      service.requiredCollectionAttachments = true;
      service.createAutomatedPrepaid = true;
      spyOn(service.adjuntoService, 'hasItems').and.returnValue(true);
      service.collection = {
        coType: '0',
        coCurrency: 'USD',
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-1',
          isSave: true,
          nuAmountPaid: 100,
          inPaymentPartial: false,
        }],
        collectionPayments: [{
          coType: 'ef',
          coPaymentMethod: 'ef',
          nuAmountPartial: 150,
        }],
      } as any;
      service.documentSales = [{
        idDocument: 1,
        coDocument: 'FAC-1',
        isSelected: true,
        isSave: true,
        positionCollecDetails: 0,
      } as DocumentSale];
      service.pagoEfectivo = [{ monto: 150 } as any];
      service.montoTotalPagar = 100;
      service.montoTotalPagado = 150;
      service.tolerancia0 = false;
      spyOn(service as any, 'validateReferencePaymentForCollect').and.resolveTo(true);
      spyOn(service as any, 'hasValidDocumentSalesForSend').and.returnValue(true);
      spyOn(service as any, 'hasIncompletePaymentMethods').and.returnValue(false);
      spyOn(service as any, 'hasEmptyCollectionPayments').and.returnValue(false);
      spyOn(service as any, 'hasIncompletePersistedPaymentAmounts').and.returnValue(false);
      spyOn(service as any, 'hasIncompleteDocumentAmountToPay').and.returnValue(false);
      spyOn(service as any, 'isWithinToleranciaOrExactOrPartialRules').and.returnValue(false);

      const blocking = await service.evaluateSendReadiness();

      expect(blocking.length).toBe(0);
      expect(service.lastValidToSend).toBeTrue();
      expect(service.canProceedSendAfterValidation()).toBeTrue();
    });

    it('COB-SEND-ATTACH-002: notifyCollectionEdited desbloquea Enviar tras adjunto aunque dirty tracking esté pausado', () => {
      service.hideDocuments = false;
      service.hidePayments = true;
      service.sendBlockedByFields = true;
      service.disableSendButton = true;
      service.pauseCollectionDirtyTracking();
      service.collection = {
        coType: '0',
        collectionDetails: [{ idDocument: 1, coDocument: 'FAC-1' }],
        collectionPayments: [],
      } as any;
      const validateSpy = spyOn(service, 'validateToSend').and.resolveTo();

      service.notifyCollectionEdited();

      expect(service.sendBlockedByFields).toBeFalse();
      expect(service.disableSendButton).toBeFalse();
      expect(validateSpy).toHaveBeenCalled();
    });

    it('COB-PREPAID-003: collectCollectionSendIssues no pisa mensaje global con adjuntos', async () => {
      service.hideDocuments = false;
      service.hidePayments = false;
      service.requiredComment = false;
      service.requiredCollectionAttachments = true;
      service.createAutomatedPrepaid = true;
      spyOn(service.adjuntoService, 'hasItems').and.returnValue(false);
      service.collectionTags.set('COB_RET_MSJ_COLLECTION_NO_ATTACHMENTS', 'Faltan adjuntos');
      service.mensaje = 'Aviso anticipo automático';
      service.collection = {
        coType: '0',
        coCurrency: 'USD',
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-1',
          isSave: true,
          nuAmountPaid: 100,
          inPaymentPartial: false,
        }],
        collectionPayments: [{
          coType: 'ef',
          coPaymentMethod: 'ef',
          nuAmountPartial: 100,
        }],
      } as any;
      service.documentSales = [{
        idDocument: 1,
        coDocument: 'FAC-1',
        isSelected: true,
        isSave: true,
        positionCollecDetails: 0,
      } as DocumentSale];
      service.montoTotalPagar = 100;
      service.montoTotalPagado = 150;
      service.tolerancia0 = true;
      service.TipoTolerancia = 0;
      service.RangoToleranciaPositiva = 100000;
      service.MonedaTolerancia = 'USD';

      const issues = await service.collectCollectionSendIssues();

      expect(issues.some(i => i.code === 'NO_ATTACHMENTS')).toBeTrue();
      expect(service.mensaje).toBe('Aviso anticipo automático');
      expect(service.getCollectionSendValidationMessage()).toContain('Faltan adjuntos');
    });

    it('COB-PREPAID-003: validateToSend sin sendValidationAttempted no cierra alert informativo', async () => {
      service.sendValidationAttempted = false;
      service.alertMessageOpen = true;
      service.mensaje = 'Aviso anticipo automático';
      service.collection = { coType: '0', collectionDetails: [], collectionPayments: [] } as any;
      spyOn(service, 'collectCollectionSendIssues').and.resolveTo([]);

      await service.validateToSend();

      expect(service.alertMessageOpen).toBeTrue();
      expect(service.mensaje).toBe('Aviso anticipo automático');
    });

    it('P1: enableDifferenceCodes blocks send when Otros lacks difference code', async () => {
      service.enableDifferenceCodes = true;
      service.tolerancia0 = false;
      service.alwaysPartialPayment = false;
      service.enablePartialPayment = true;
      service.existPartialPayment = false;
      service.montoTotalPagar = 25;
      service.montoTotalPagado = 25;
      service.collection = {
        coType: '0',
        coCurrency: 'USD',
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-1',
          isSave: true,
          inPaymentPartial: false,
        }],
        collectionPayments: [{
          coType: 'ot',
          coPaymentMethod: 'ot',
          nuAmountPartial: 25,
          idDifferenceCode: null,
          coDifferenceCode: '',
        }],
      } as any;
      service.documentSales = [{
        idDocument: 1,
        coDocument: 'FAC-1',
        isSelected: true,
        isSave: true,
        positionCollecDetails: 0,
      } as DocumentSale];
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
      };
      spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
      spyOn(service, 'hasIncompletePaymentMethods').and.returnValue(false);
      spyOn(service, 'validateReferencePayment').and.resolveTo(true);
      const spy = spyOn(service, 'onCollectionValidToSend');

      await service.validateToSend();

      expect(spy).toHaveBeenCalledWith(false);
    });

    it('P1: IGTF embedded increases montoTotalPagar', async () => {
      const svc = service as any;
      spyOn(service, 'convertirMonto').and.callFake((amount: number) => Number(amount) || 0);
      spyOn(svc.currencyService, 'formatNumber').and.callFake((n: number) => String(n ?? 0));
      spyOn(service, 'cleanFormattedNumber').and.callFake((value: string | number) => Number(value) || 0);
      spyOn(svc, 'resolveAutomatedPrepaid').and.stub();
      spyOn(service, 'syncAddPaymentMethodDisabledState').and.stub();
      spyOn(svc, 'syncCollectionDetailsIgtfAmounts').and.stub();
      spyOn(svc, 'syncCollectionIgtfFields').and.stub();
      spyOn(svc, 'applyCollectionIgtfAmountFields').and.stub();

      service.userCanSelectIGTF = true;
      service.multiCurrency = false;
      service.separateIgtf = false;
      service.coTypeModule = '0';
      service.isOpen = false;
      service.isChangePaymentPartialPersistence = false;
      service.isRateChangeInProgress = false;
      service.montoTotalPagado = 0;
      service.igtfSelected = { price: 3 } as any;
      service.documentSales = [] as DocumentSale[];
      service.documentSalesBackup = [] as DocumentSale[];
      service.collection = {
        coType: '0',
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_NEW,
        stCollection: service.COLLECT_STATUS_NEW,
        collectionDetails: [{
          idDocument: 10,
          coDocument: 'FAC-10',
          inPaymentPartial: false,
          nuAmountPaid: 100,
          nuAmountPaidConversion: 100,
          nuBalanceDoc: 100,
          nuBalanceDocOriginal: 100,
          nuAmountDoc: 100,
          nuAmountDiscount: 0,
          nuAmountCollectDiscount: 0,
          nuAmountRetention: 0,
          nuAmountRetention2: 0,
          nuAmountIgtf: 0,
          isSave: true,
        }],
        collectionPayments: [],
        nuAmountIgtf: 0,
      } as any;

      await service.calculatePayment('', 0, true, true);

      expect(service.montoIgtf).toBe(3);
      expect(service.montoTotalPagar).toBe(103);
    });

    it('P1: shouldCreateAutomatedPrepaidOnSend requires excess >= activation threshold', () => {
      service.automatedPrepaid = true;
      service.coTypeModule = '0';
      service.existPartialPayment = false;
      service.createAutomatedPrepaid = true;
      service.anticipoAutomatico = [{ type: 'ef' } as any];
      service.prepaidRangeAmount = 10;
      service.tolerancia0 = false;
      spyOn(service as any, 'getPrepaidExcessAmount').and.returnValue(50);

      expect(service.shouldCreateAutomatedPrepaidOnSend()).toBeTrue();

      (service as any).getPrepaidExcessAmount.and.returnValue(10);
      expect(service.shouldCreateAutomatedPrepaidOnSend()).toBeTrue();

      (service as any).getPrepaidExcessAmount.and.returnValue(5);
      expect(service.shouldCreateAutomatedPrepaidOnSend()).toBeFalse();
    });

    describe('COB-PREPAID-001 / COB-PREPAID-005 automated prepaid vs tolerancia', () => {
      function setupUsdPrepaidScenario(excess: number, opts?: {
        prepaidRangeAmount?: number;
        rangoPositiva?: number;
        tolerancia0?: boolean;
      }): void {
        service.automatedPrepaid = true;
        service.coTypeModule = '0';
        service.existPartialPayment = false;
        service.prepaidRangeAmount = opts?.prepaidRangeAmount ?? 1;
        service.prepaidRangeCurrency = 'USD';
        service.parteDecimal = 2;
        service.tolerancia0 = opts?.tolerancia0 ?? true;
        service.TipoTolerancia = 0;
        service.RangoToleranciaPositiva = opts?.rangoPositiva ?? 100000;
        service.MonedaTolerancia = 'USD';
        service.collection = { coCurrency: 'USD' } as any;
        spyOn(service as any, 'syncPrepaidDifferenceAmounts').and.returnValue(excess);
        spyOn(service as any, 'syncExchangeRateToCollectionHeader').and.stub();
        spyOn(service as any, 'checkTiposPago').and.stub();
        spyOn(service as any, 'setAutomatedPrepaid').and.callFake(() => {
          service.anticipoAutomatico = [{ type: 'ef' }];
        });
        spyOn(service, 'validateToSend').and.stub();
        spyOn(service as any, 'syncAddPaymentMethodDisabledState').and.stub();
      }

      it('USD: excedente tras tol+ con prepaidRangeAmount=1 crea anticipo', () => {
        setupUsdPrepaidScenario(11.54, { prepaidRangeAmount: 1, rangoPositiva: 10 });

        const prepaidExcess = (service as any).getPrepaidExcessAmount();
        expect(prepaidExcess).toBeCloseTo(1.54, 2);

        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeTrue();
      });

      it('USD: exceso dentro de tol+ alto no crea anticipo', () => {
        setupUsdPrepaidScenario(1.54, { prepaidRangeAmount: 1, rangoPositiva: 100000 });

        expect((service as any).getPrepaidExcessAmount()).toBe(0);
        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeFalse();
      });

      it('COB-PREPAID-005: umbral = prepaidRangeAmount sobre excedente tras tol+', () => {
        setupUsdPrepaidScenario(14, { prepaidRangeAmount: 50, rangoPositiva: 10 });
        expect((service as any).getAutomatedPrepaidActivationThreshold()).toBe(50);
        expect((service as any).resolvePrepaidEligibleExcessInCollectionCurrency(14)).toBe(4);

        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeFalse();

        (service as any).syncPrepaidDifferenceAmounts.and.returnValue(60);
        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeTrue();
      });

      it('COB-PREPAID-005: tolerancia0 false → umbral sigue siendo solo prepaidRangeAmount', () => {
        setupUsdPrepaidScenario(1, {
          prepaidRangeAmount: 1,
          rangoPositiva: 100000,
          tolerancia0: false,
        });

        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeTrue();
      });

      it('umbral exacto: excedente tras tol+ = prepaidRangeAmount crea anticipo', () => {
        setupUsdPrepaidScenario(60, { prepaidRangeAmount: 50, rangoPositiva: 10 });

        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeTrue();
      });

      it('bajo umbral: exceso 0.5 con mínimo 1 no crea anticipo', () => {
        setupUsdPrepaidScenario(0.5, { prepaidRangeAmount: 1, rangoPositiva: 0 });

        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeFalse();
      });

      it('COB-TOL-DEC-001: prepaidRangeAmount 0.5 → exceso 0.5 crea anticipo', () => {
        setupUsdPrepaidScenario(0.5, { prepaidRangeAmount: 0.5, rangoPositiva: 0 });

        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeTrue();
      });

      it('COB-TOL-DEC-001: prepaid 0.5; excedente tras tol+ 0.4 no crea; 0.5 sí', () => {
        setupUsdPrepaidScenario(0.9, { prepaidRangeAmount: 0.5, rangoPositiva: 0.5 });
        expect((service as any).getAutomatedPrepaidActivationThreshold()).toBe(0.5);

        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeFalse();

        (service as any).syncPrepaidDifferenceAmounts.and.returnValue(1);
        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeTrue();
      });

      it('COB-PREPAID-005: tol+ 49.99 + prepaid 50; excedente bruto 100 crea anticipo (caso QA)', () => {
        service.parteDecimal = 2;
        setupUsdPrepaidScenario(100, { prepaidRangeAmount: 50, rangoPositiva: 49.99 });

        expect((service as any).getAutomatedPrepaidActivationThreshold()).toBe(50);
        expect((service as any).resolvePrepaidEligibleExcessInCollectionCurrency(100)).toBe(50.01);

        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeTrue();
      });

      it('COB-PREPAID-005: tol+ 10, prepaid 1; pagos 105/110 sin anticipo, 111 anticipo 1', () => {
        service.automatedPrepaid = true;
        service.coTypeModule = '0';
        service.existPartialPayment = false;
        service.prepaidRangeAmount = 1;
        service.prepaidRangeCurrency = 'USD';
        service.parteDecimal = 2;
        service.tolerancia0 = true;
        service.TipoTolerancia = 0;
        service.RangoToleranciaPositiva = 10;
        service.MonedaTolerancia = 'USD';
        service.montoTotalPagar = 100;
        service.collection = { coCurrency: 'USD', collectionPayments: [{ coType: 'ef', nuAmount: 105 }] } as any;
        spyOn(service as any, 'syncMontosPagadosFromPayments').and.callFake(() => {
          service.montoTotalPagado = Number(service.montoTotalPagado) || 0;
        });
        spyOn(service as any, 'syncExchangeRateToCollectionHeader').and.stub();
        spyOn(service as any, 'checkTiposPago').and.stub();
        spyOn(service as any, 'setAutomatedPrepaid').and.callFake(() => {
          service.anticipoAutomatico = [{ type: 'ef' }];
        });
        spyOn(service, 'validateToSend').and.stub();
        spyOn(service as any, 'syncAddPaymentMethodDisabledState').and.stub();
        spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
        spyOn((service as any).currencyService, 'formatNumber').and.callFake((n: number) => String(n ?? 0));

        const assertScenario = (paid: number, expectPrepaid: boolean, expectedEligible?: number) => {
          service.montoTotalPagado = paid;
          service.createAutomatedPrepaid = false;
          service.anticipoAutomatico = [];
          (service as any).resolveAutomatedPrepaid('ef', 0);
          expect(service.createAutomatedPrepaid).toBe(expectPrepaid);
          if (expectedEligible != null) {
            const raw = paid - 100;
            expect((service as any).resolvePrepaidEligibleExcessInCollectionCurrency(raw)).toBe(expectedEligible);
          }
          expect((service as any).computeIsWithinTolerancia()).toBeTrue();
        };

        assertScenario(105, false, 0);
        assertScenario(110, false, 0);
        assertScenario(111, true, 1);
      });

      it('COB-PREPAID-005: tol+ 10, prepaid 5; 114 sin anticipo, 115 anticipo 5', () => {
        service.automatedPrepaid = true;
        service.coTypeModule = '0';
        service.existPartialPayment = false;
        service.prepaidRangeAmount = 5;
        service.prepaidRangeCurrency = 'USD';
        service.parteDecimal = 2;
        service.tolerancia0 = true;
        service.TipoTolerancia = 0;
        service.RangoToleranciaPositiva = 10;
        service.MonedaTolerancia = 'USD';
        service.montoTotalPagar = 100;
        service.collection = { coCurrency: 'USD', collectionPayments: [{ coType: 'ef', nuAmount: 115 }] } as any;
        spyOn(service as any, 'syncMontosPagadosFromPayments').and.stub();
        spyOn(service as any, 'syncExchangeRateToCollectionHeader').and.stub();
        spyOn(service as any, 'checkTiposPago').and.stub();
        spyOn(service as any, 'setAutomatedPrepaid').and.callFake(() => {
          service.anticipoAutomatico = [{ type: 'ef' }];
        });
        spyOn(service, 'validateToSend').and.stub();
        spyOn(service as any, 'syncAddPaymentMethodDisabledState').and.stub();
        spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
        spyOn((service as any).currencyService, 'formatNumber').and.callFake((n: number) => String(n ?? 0));

        service.montoTotalPagado = 114;
        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeFalse();
        expect((service as any).computeIsWithinTolerancia()).toBeFalse();

        service.montoTotalPagado = 115;
        service.createAutomatedPrepaid = false;
        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeTrue();
        expect((service as any).resolvePrepaidEligibleExcessInCollectionCurrency(15)).toBe(5);
        expect((service as any).computeIsWithinTolerancia()).toBeTrue();
      });

      it('COB-TOL-DEC-002: prepaid 0.01 redondeado; excedente tras tol+ 0.01 crea; 0.004 no', () => {
        service.parteDecimal = 2;
        setupUsdPrepaidScenario(0.004, { prepaidRangeAmount: 0.01, rangoPositiva: 0 });

        expect((service as any).getAutomatedPrepaidActivationThreshold()).toBe(0.01);

        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeFalse();

        (service as any).syncPrepaidDifferenceAmounts.and.returnValue(0.01);
        (service as any).resolveAutomatedPrepaid('ef', 0);
        expect(service.createAutomatedPrepaid).toBeTrue();
      });

      it('COB-PREPAID-003: buildAutomatedPrepaidMessage usa prepaidCurrency y monto formateado', () => {
        service.collectionTags = new Map([
          ['COB_MSG_AUTOMATED_PREPAID', 'Se creará un anticipo automático por el monto excedente de {amount}. Se enviará un anticipo junto al cobro.'],
        ]);
        service.prepaidCurrency = '$';
        service.collection = { coCurrency: 'USD', nuDifference: 0, nuDifferenceConversion: 0 } as any;
        service.multiCurrency = true;
        service.currencySelected = { localCurrency: 'true' } as any;
        service.currencyConversion = { coCurrency: 'Bs' } as any;
        service.discountRemnantPrepaidAmount = 0;
        spyOn(service as any, 'syncPrepaidDifferenceAmounts').and.returnValue(150.5);
        spyOn(service as any, 'syncExchangeRateToCollectionHeader').and.stub();
        spyOn(service, 'getEffectiveExchangeRate').and.returnValue(36);
        spyOn(service, 'convertirMonto').and.returnValue(150.5);
        spyOn(service, 'getAutomatedPrepaidExcessAmount').and.returnValue(150.5);
        spyOn((service as any).currencyService, 'formatNumber').and.returnValue('150.50');

        expect(service.buildAutomatedPrepaidMessage()).toBe(
          'Se creará un anticipo automático por el monto excedente de $ 150.50. Se enviará un anticipo junto al cobro.',
        );
      });

      it('COB-DISC-003: remanente se suma al monto de anticipo en prepaidCurrency', () => {
        service.prepaidCurrency = 'USD';
        service.collection = { coCurrency: 'USD', nuDifference: 0, nuDifferenceConversion: 0 } as any;
        service.discountRemnantPrepaidAmount = 50;
        spyOn(service as any, 'syncPrepaidDifferenceAmounts').and.returnValue(10);
        spyOn(service as any, 'syncExchangeRateToCollectionHeader').and.stub();

        const amounts = service.resolveAutomatedPrepaidDocumentAmounts();
        expect(amounts.coCurrency).toBe('USD');
        expect(amounts.nuAmount).toBe(60);
      });

      it('COB-DISC-003: shouldCreateAutomatedPrepaidOnSend true solo con remanente confirmado y automatedPrepaid ON', () => {
        service.coTypeModule = '0';
        service.existPartialPayment = false;
        service.automatedPrepaid = true;
        service.createAutomatedPrepaid = false;
        service.discountRemnantPrepaidAmount = 50;
        service.anticipoAutomatico = [];
        spyOn(service, 'ensureAutomatedPrepaidPaymentTemplate').and.callFake(() => {
          service.anticipoAutomatico = [{ type: 'ef', posCollectionPayment: -1, synthetic: true }];
        });

        expect(service.shouldCreateAutomatedPrepaidOnSend()).toBeTrue();
        expect(service.ensureAutomatedPrepaidPaymentTemplate).toHaveBeenCalled();
      });

      it('COB-PREPAID-006: remanente de descuento no se bloquea por existPartialPayment al Enviar', () => {
        service.coTypeModule = '0';
        service.automatedPrepaid = true;
        service.existPartialPayment = true;
        service.discountRemnantPrepaidAmount = 50;
        service.collection = { coCurrency: 'USD', nuDifference: 0, nuDifferenceConversion: 0 } as any;
        service.anticipoAutomatico = [];
        spyOn(service, 'ensureAutomatedPrepaidPaymentTemplate').and.callFake(() => {
          service.anticipoAutomatico = [{ type: 'ef', posCollectionPayment: -1, synthetic: true }];
        });

        expect(service.shouldCreateAutomatedPrepaidOnSend()).toBeTrue();
      });

      it('COB-PREPAID-006: forceRecalc con stDelivery TO_SEND recalcula creditBalancePrepaidAmount (NCR)', async () => {
        service.coTypeModule = '0';
        service.automatedPrepaid = true;
        service.collection = {
          coCurrency: 'USD',
          stDelivery: service.COLLECT_STATUS_TO_SEND,
          stCollection: service.COLLECT_STATUS_TO_SEND,
          nuAmountTotal: 0,
          nuAmountTotalConversion: 0,
          collectionDetails: [
            {
              idDocument: 10,
              coDocument: 'FAC-10',
              nuBalanceDoc: 1000,
              nuBalanceDocOriginal: 1000,
              nuAmountPaid: 1000,
              nuAmountPaidConversion: 1000,
            },
            {
              idDocument: 20,
              coDocument: 'NCR-20',
              nuBalanceDoc: -1500,
              nuBalanceDocOriginal: -1500,
              nuAmountPaid: -1500,
              nuAmountPaidConversion: -1500,
            },
          ],
          collectionPayments: [],
        } as any;

        await service.calculatePayment('', 0, true, true);

        expect(service.creditBalancePrepaidAmount).toBe(500);
      });

      it('COB-PREPAID-006: refreshAutomatedPrepaidBeforeSend con TO_SEND detecta NCR para anticipo', async () => {
        service.coTypeModule = '0';
        service.automatedPrepaid = true;
        service.localCurrency = { coCurrency: 'USD' } as any;
        service.collection = {
          coCurrency: 'USD',
          stDelivery: service.COLLECT_STATUS_TO_SEND,
          stCollection: service.COLLECT_STATUS_TO_SEND,
          nuAmountTotal: 0,
          collectionDetails: [
            {
              idDocument: 10,
              coDocument: 'FAC-10',
              nuBalanceDoc: 1000,
              nuBalanceDocOriginal: 1000,
              nuAmountPaid: 1000,
            },
            {
              idDocument: 20,
              coDocument: 'NCR-20',
              nuBalanceDoc: -1500,
              nuBalanceDocOriginal: -1500,
              nuAmountPaid: -1500,
            },
          ],
          collectionPayments: [{
            coType: 'ot',
            coPaymentMethod: 'ot',
            nuAmountPartial: 0,
          }],
        } as any;
        service.pagoOtros = [{ monto: 0, nombre: 'cierre' } as any];

        const shouldCreate = await service.refreshAutomatedPrepaidBeforeSend();

        expect(service.creditBalancePrepaidAmount).toBe(500);
        expect(shouldCreate).toBeTrue();
      });

      it('COB-PREPAID-006: NCR > FACT habilita anticipo automático al Enviar', async () => {
        service.coTypeModule = '0';
        service.automatedPrepaid = true;
        service.existPartialPayment = false;
        service.collection = {
          coCurrency: 'USD',
          nuDifference: 0,
          collectionDetails: [
            {
              idDocument: 10,
              coDocument: 'FAC-10',
              coTypeDoc: 'FACT',
              nuBalanceDoc: 1000,
              nuBalanceDocOriginal: 1000,
              nuAmountPaid: 1000,
              nuAmountPaidConversion: 1000,
            },
            {
              idDocument: 20,
              coDocument: 'NCR-20',
              coTypeDoc: 'NCR',
              nuBalanceDoc: -1500,
              nuBalanceDocOriginal: -1500,
              nuAmountPaid: -1500,
              nuAmountPaidConversion: -1500,
            },
          ],
          collectionPayments: [{
            coType: 'ot',
            coPaymentMethod: 'ot',
            nuAmountPartial: 0,
            nuPaymentDoc: 'cierre',
          }],
        } as any;
        service.pagoOtros = [{ monto: 0, nombre: 'cierre' } as any];

        await service.calculatePayment('', 0, true, true);
        expect(service.creditBalancePrepaidAmount).toBe(500);

        service.anticipoAutomatico = [];
        spyOn(service, 'ensureAutomatedPrepaidPaymentTemplate').and.callFake(() => {
          service.anticipoAutomatico = [{ type: 'ot', posCollectionPayment: 0 }];
        });

        expect(service.shouldCreateAutomatedPrepaidOnSend()).toBeTrue();
      });

      it('COB-PREPAID-006: remanente en mapa habilita refresh aunque amount aún no esté sincronizado', async () => {
        service.coTypeModule = '0';
        service.automatedPrepaid = true;
        service.discountRemnantPrepaidAmount = 0;
        service.setDiscountRemnantPrepaidForDocument('FAC-100', 50);
        service.discountRemnantPrepaidAmount = 0;
        service.collection = {
          coCurrency: 'USD',
          nuDifference: 0,
          collectionDetails: [],
        } as any;
        service.anticipoAutomatico = [];
        spyOn(service, 'calcularMontos').and.callFake(async (_type, _index, forceRecalc) => {
          expect(forceRecalc).toBeTrue();
          service.discountRemnantPrepaidAmount = 50;
          return true;
        });

        const shouldCreate = await service.refreshAutomatedPrepaidBeforeSend();

        expect(shouldCreate).toBeTrue();
        expect(service.anticipoAutomatico.length).toBeGreaterThan(0);
      });

      it('COB-PREPAID-006: refreshAutomatedPrepaidBeforeSend conserva remanente tras recalcular', async () => {
        service.coTypeModule = '0';
        service.automatedPrepaid = true;
        service.collection = {
          coType: '0',
          coCurrency: 'USD',
          nuDifference: 0,
          nuDifferenceConversion: 0,
          collectionDetails: [{
            idDocument: 10,
            coDocument: 'FAC-100',
            nuAmountCollectDiscount: 150,
            nuAmountPaid: 100,
          }],
          collectionPayments: [{ coType: 'ot', coPaymentMethod: 'ot', nuAmountPartial: 0 }],
        } as any;
        service.documentSales = [{
          idDocument: 10,
          coDocument: 'FAC-100',
          isSelected: true,
          positionCollecDetails: 0,
        } as DocumentSale];
        service.pagoOtros = [{ monto: 0, nombre: 'x' } as any];
        service.setDiscountRemnantPrepaidForDocument('FAC-100', 50);
        spyOn(service, 'calcularMontos').and.callFake(async () => {
          service.isFullyCoveredCollection = true;
          service.efectivoRequerido = 0;
          return true;
        });

        const shouldCreate = await service.refreshAutomatedPrepaidBeforeSend();

        expect(shouldCreate).toBeTrue();
        expect(service.discountRemnantPrepaidAmount).toBe(50);
        expect(service.anticipoAutomatico.length).toBeGreaterThan(0);
      });

      it('COB-DISC-004b: shouldCreateAutomatedPrepaidOnSend false con remanente si automatedPrepaid OFF', () => {
        service.coTypeModule = '0';
        service.existPartialPayment = false;
        service.automatedPrepaid = false;
        service.discountRemnantPrepaidAmount = 50;
        service.anticipoAutomatico = [{ type: 'ef', posCollectionPayment: -1, synthetic: true }];

        expect(service.shouldCreateAutomatedPrepaidOnSend()).toBeFalse();
      });

      it('COB-DISC-003: convertCollectionAmountToPrepaidCurrency respeta prepaidCurrency', () => {
        service.prepaidCurrency = 'Bs';
        service.collection = { coCurrency: 'USD' } as any;
        service.multiCurrency = true;
        spyOn(service, 'getEffectiveExchangeRate').and.returnValue(36);
        spyOn(service, 'convertirMonto').and.returnValue(1800);

        expect(service.convertCollectionAmountToPrepaidCurrency(50)).toBe(1800);
      });

      it('COB-PREPAID-003: createAnticipoCollection persiste moneda prepaidCurrency', async () => {
        service.prepaidCurrency = 'Bs';
        service.currencyList = [{ coCurrency: 'Bs', idCurrency: 99 }] as any;
        service.anticipoAutomatico = [{ type: 'ef', posCollectionPayment: 0 }];
        service.collection = { coCurrency: 'USD', nuDifference: 25, nuDifferenceConversion: 900 } as any;
        spyOn(service, 'syncExchangeRateToCollectionHeader').and.returnValue(36);
        spyOn(service, 'resolveAutomatedPrepaidDocumentAmounts').and.returnValue({
          coCurrency: 'Bs',
          idCurrency: 99,
          nuAmount: 900,
          nuAmountConversion: 25,
        });
        spyOn(service, 'createAnticipoCollectionPayment').and.resolveTo('ANT-1');
        spyOn((service as any).dateServ, 'generateCO').and.returnValue('ANT-NEW');

        const collection = {
          coCollection: 'COB-1',
          idClient: 1,
          coClient: 'C1',
          lbClient: 'Cliente',
          stCollection: 2,
          stDelivery: 2,
          daCollection: '2026-01-01',
          daRate: '2026-01-01',
          naResponsible: 'Vendedor',
          idEnterprise: 1,
          coEnterprise: 'E1',
          idCurrency: 1,
          coCurrency: 'USD',
          txComment: '',
          coordenada: '',
          nuValueLocal: 36,
          txConversion: '',
          nuAmountDiscountTotal: 0,
          nuAmountDiscountTotalConversion: 0,
          nuIgtf: 0,
          hasIGTF: false,
          collectionPayments: [{}],
        } as any;
        const db = {
          executeSql: jasmine.createSpy('executeSql').and.resolveTo({}),
        } as any;

        await service.createAnticipoCollection(db, collection, false);

        const params = db.executeSql.calls.mostRecent().args[1] as unknown[];
        expect(params[13]).toBe(99);
        expect(params[14]).toBe('Bs');
        expect(service.createAnticipoCollectionPayment).toHaveBeenCalledWith(
          db,
          collection,
          jasmine.any(String),
          900,
          25,
          false,
        );
      });
    });

    describe('COB-PREPAID-002 createAnticipo enqueuePending + batch', () => {
      function buildSourceCollection(): any {
        return {
          nuDifference: 25,
          collectionPayments: [{
            idCollectionDetail: 1,
            coPaymentMethod: 'ef',
            idBank: 0,
            nuPaymentDoc: '',
            naBank: '',
            coClientBankAccount: '',
            nuClientBankAccount: '',
            daValue: '2026-01-01',
            daCollectionPayment: '2026-01-01',
            nuCollectionPayment: 1,
            idDifferenceCode: 0,
            coDifferenceCode: '',
            nuBankAccount: '',
            idTypeDocument: 0,
            nuDocument: '',
            idCodePhoneNumber: 0,
            nuPhoneNumber: '',
          }],
        };
      }

      it('enqueuePending=false no emite saveSend y retorna coCollection', async () => {
        service.anticipoAutomatico = [{ type: 'ef', posCollectionPayment: 0 }];
        const collection = buildSourceCollection();
        const db = { executeSql: jasmine.createSpy('executeSql').and.resolveTo({}) } as any;
        spyOn(service, 'saveSendCollection');

        const result = await service.createAnticipoCollectionPayment(
          db,
          collection,
          'ANT-NEW-1',
          25,
          25,
          false,
        );

        expect(result).toBe('ANT-NEW-1');
        expect(service.saveSendCollection).not.toHaveBeenCalled();
      });

      it('enqueuePending default true emite saveSend', async () => {
        service.anticipoAutomatico = [{ type: 'ef', posCollectionPayment: 0 }];
        const collection = buildSourceCollection();
        const db = { executeSql: jasmine.createSpy('executeSql').and.resolveTo({}) } as any;
        spyOn(service, 'saveSendCollection');

        const result = await service.createAnticipoCollectionPayment(
          db,
          collection,
          'ANT-NEW-2',
          25,
          25,
        );

        expect(result).toBe('ANT-NEW-2');
        expect(service.saveSendCollection).toHaveBeenCalledWith('ANT-NEW-2');
      });

      it('COB-PREPAID-006: sin payment fuente usa EF sintético y persiste anticipo', async () => {
        service.anticipoAutomatico = [{ type: 'ot', posCollectionPayment: 99 }];
        const collection = buildSourceCollection();
        collection.collectionPayments = [];
        const db = { executeSql: jasmine.createSpy('executeSql').and.resolveTo({}) } as any;

        const result = await service.createAnticipoCollectionPayment(
          db,
          collection,
          'ANT-SYN-1',
          50,
          50,
          false,
        );

        expect(result).toBe('ANT-SYN-1');
        expect(db.executeSql).toHaveBeenCalled();
      });

      it('buildCollectPendingBatch ordena cobro → anticipo', () => {
        const onlyCobro = service.buildCollectPendingBatch('COB-1');
        expect(onlyCobro.length).toBe(1);
        expect(onlyCobro[0].coTransaction).toBe('COB-1');
        expect(onlyCobro[0].type).toBe('collect');

        const withAnticipo = service.buildCollectPendingBatch('COB-1', 'ANT-1');
        expect(withAnticipo.map((t) => t.coTransaction)).toEqual(['COB-1', 'ANT-1']);
        expect(withAnticipo.every((t) => t.type === 'collect')).toBeTrue();
      });

      it('buildSyntheticAnticipoCollectionPayment expone EF mínimo para AutoSend', () => {
        const payment = service.buildSyntheticAnticipoCollectionPayment(
          { coCollection: 'ANT-1' } as any,
          75,
          75,
        );
        expect(payment.coPaymentMethod).toBe('ef');
        expect(payment.coType).toBe('ef');
        expect(payment.nuAmountPartial).toBe(75);
      });

      it('COB-PREPAID-006: ensureAutomatedPrepaidPaymentTemplate usa Otros monto 0 (NCR)', () => {
        service.collection = {
          collectionPayments: [{
            coType: 'ot',
            coPaymentMethod: 'ot',
            nuAmountPartial: 0,
            nuPaymentDoc: 'cierre',
          }],
        } as any;
        service.anticipoAutomatico = [];
        service.ensureAutomatedPrepaidPaymentTemplate();
        expect(service.anticipoAutomatico[0].type).toBe('ot');
        expect(service.anticipoAutomatico[0].posCollectionPayment).toBe(0);
      });

      it('COB-PREPAID-006: sanitizePrepaidCollectionPayloadForSend limpia Otros e idCollectionDetail', () => {
        const collection = {
          coType: 1,
          coCollection: 'ANT-1',
          nuAmountTotal: 50,
          nuAmountTotalConversion: 50,
          nuAmountDiscountTotal: 150,
          collectionDetails: [{ coDocument: 'X' }],
          collectionPayments: [{
            coType: 'ot',
            coPaymentMethod: 'ot',
            idCollectionDetail: 99,
            idDifferenceCode: 7,
            coDifferenceCode: 'DIF',
            nuAmountPartial: 50,
            nuAmountPartialConversion: 50,
          }],
        } as any;
        service.sanitizePrepaidCollectionPayloadForSend(collection);
        expect(collection.coType).toBe('1');
        expect(collection.collectionDetails.length).toBe(0);
        expect(collection.nuAmountDiscountTotal).toBe(0);
        expect(collection.collectionPayments[0].coPaymentMethod).toBe('ef');
        expect(collection.collectionPayments[0].idCollectionDetail).toBe(0);
        expect(collection.collectionPayments[0].idDifferenceCode).toBe(0);
      });

      it('COB-DATE-002: sanitizePrepaidCollectionPayloadForSend normaliza daValue sin T', () => {
        const collection = {
          coType: 1,
          coCollection: 'ANT-DATE',
          nuAmountTotal: 1,
          nuAmountTotalConversion: 1,
          collectionDetails: [],
          collectionPayments: [{
            coType: 'ef',
            coPaymentMethod: 'ef',
            daValue: '2026-09-11T04:00:00',
            daCollectionPayment: '2026-09-11T04:00:00',
            nuAmountPartial: 1,
            nuAmountPartialConversion: 1,
          }],
        } as any;
        service.sanitizePrepaidCollectionPayloadForSend(collection);
        expect(collection.collectionPayments[0].daValue).toBe('2026-09-11 04:00:00');
        expect(collection.collectionPayments[0].daCollectionPayment).toBe('2026-09-11 04:00:00');
      });

      it('COB-DATE-002: buildSyntheticAnticipoCollectionPayment usa formato WS en fechas', () => {
        const payment = service.buildSyntheticAnticipoCollectionPayment(
          { coCollection: 'ANT-SYN' } as any,
          1,
          1,
        );
        expect(payment.daValue).not.toContain('T');
        expect(payment.daCollectionPayment).not.toContain('T');
        expect(payment.daValue).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        expect(payment.daCollectionPayment).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      });

      it('COB-PREPAID-006: comentario obligatorio en anticipo remanente/NCR aunque requiredComment OFF', () => {
        service.coTypeModule = '0';
        service.automatedPrepaid = true;
        service.requiredComment = false;
        service.createAutomatedPrepaid = true;
        service.discountRemnantPrepaidAmount = 50;
        service.collection = { coType: '0', txComment: '  ' } as any;

        expect(service.isCommentRequiredForSend()).toBeTrue();
        expect(service.hasRequiredCommentFieldError()).toBeTrue();

        service.collection.txComment = 'Anticipo por descuento';
        expect(service.hasRequiredCommentFieldError()).toBeFalse();
      });

      it('COB-PREPAID-006: isRemnantOrCreditOtrosMontoLocked con fila Otros', () => {
        service.coTypeModule = '0';
        service.automatedPrepaid = true;
        service.createAutomatedPrepaid = true;
        service.creditBalancePrepaidAmount = 10;
        service.pagoOtros = [{ monto: 0 } as any];

        expect(service.isRemnantOrCreditOtrosMontoLocked()).toBeTrue();
        service.pagoOtros = [];
        expect(service.isRemnantOrCreditOtrosMontoLocked()).toBeFalse();
      });
    });

    it('P1: isRetentionInvalid when sum exceeds balance or both zero', () => {
      expect(service.isRetentionInvalid(10, 1, 5)).toBeTrue();
      expect(service.isRetentionInvalid(0, 0, 100)).toBeTrue();
      expect(service.isRetentionInvalid(10, 1, 20)).toBeFalse();
    });

    it('P1: syncAddPaymentMethodDisabledState blocks add when difference >= 0', () => {
      service.coTypeModule = '0';
      service.createAutomatedPrepaid = false;
      service.isFullyCoveredCollection = false;
      service.efectivoRequerido = 100;
      service.disabledSelectCollectMethodDisabled = false;
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
      };
      spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
      service.collection = {
        collectionDetails: [{ idDocument: 1 }],
        nuDifference: 0,
      } as any;

      service.syncAddPaymentMethodDisabledState();

      expect(service.isAddPaymentMethodDisabled()).toBeTrue();

      service.collection.nuDifference = -15;
      service.syncAddPaymentMethodDisabledState();
      expect(service.isAddPaymentMethodDisabled()).toBeFalse();
    });

    it('COB-DISC-004c: botón agregar ON aunque createAutomatedPrepaid=true en cobro cubierto', () => {
      service.coTypeModule = '0';
      service.createAutomatedPrepaid = true;
      service.isFullyCoveredCollection = true;
      service.efectivoRequerido = 0;
      service.disabledSelectCollectMethodDisabled = true;
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
      };
      service.collection = {
        coType: '0',
        collectionDetails: [{ idDocument: 1 }],
        nuDifference: 0,
      } as any;

      service.syncAddPaymentMethodDisabledState();

      expect(service.isAddPaymentMethodDisabled()).toBeFalse();
    });

    it('regresión: createAutomatedPrepaid por exceso no habilita add-method', () => {
      service.coTypeModule = '0';
      service.createAutomatedPrepaid = true;
      service.isFullyCoveredCollection = false;
      service.efectivoRequerido = 50;
      service.disabledSelectCollectMethodDisabled = true;
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
      };
      spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
      service.collection = {
        coType: '0',
        collectionDetails: [{ idDocument: 1 }],
        nuDifference: 10,
      } as any;

      service.syncAddPaymentMethodDisabledState();

      expect(service.isAddPaymentMethodDisabled()).toBeTrue();
    });

    it('COB-DISC-004f: cobro cubierto con descuento no exige DOCUMENTS_NOT_READY al Enviar', async () => {
      service.coTypeModule = '0';
      service.isFullyCoveredCollection = true;
      service.efectivoRequerido = 0;
      service.automatedPrepaid = true;
      service.discountRemnantPrepaidByDocument.set('FAC-100', 50);
      service.discountRemnantPrepaidAmount = 50;
      service.isOpen = false;
      service.collection = {
        coType: '0',
        stDelivery: service.COLLECT_STATUS_NEW,
        stCollection: service.COLLECT_STATUS_NEW,
        isSave: 0,
        collectionDetails: [{
          idDocument: 10,
          coDocument: 'FAC-100',
          nuAmountCollectDiscount: 150,
          nuAmountPaid: 100,
          hasDiscount: true,
          collectionDetailDiscounts: [{ idCollectDiscount: 1 }],
        }],
        collectionPayments: [{ coType: 'ot', coPaymentMethod: 'ot', nuAmountPartial: 0, nuReference: 'x' }],
      } as any;
      service.documentSales = [{
        idDocument: 10,
        coDocument: 'FAC-100',
        isSelected: true,
        isSave: false,
        positionCollecDetails: 0,
      } as DocumentSale];
      service.pagoOtros = [{ monto: 0, nombre: 'x' } as any];
      spyOn(service as any, 'syncPendingInputsBeforeSendValidation').and.stub();
      spyOn(service as any, 'issueInvalidPaymentReferences').and.returnValue(Promise.resolve(null));

      const issues = await service.collectCollectionSendIssues();

      expect(issues.some(i => i.code === 'DOCUMENTS_NOT_READY')).toBeFalse();
      expect(issues.some(i => i.code === 'NO_DOCUMENTS')).toBeFalse();
    });

    it('P1: hasValidDocumentSalesForSend requires selected ready document', () => {
      service.isOpen = false;
      service.collection = {
        stDelivery: service.COLLECT_STATUS_NEW,
        stCollection: service.COLLECT_STATUS_NEW,
        isSave: 0,
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-1',
          isSave: true,
          nuAmountCollectDiscount: 0,
        }],
      } as any;
      service.documentSales = [] as DocumentSale[];

      expect((service as any).hasValidDocumentSalesForSend()).toBeFalse();

      service.documentSales = [{
        idDocument: 1,
        coDocument: 'FAC-1',
        isSelected: true,
        isSave: true,
        positionCollecDetails: 0,
      } as DocumentSale];

      expect((service as any).hasValidDocumentSalesForSend()).toBeTrue();
    });
  });

  describe('COB hardening wave 2', () => {
    function stubMoneyFormatters(): void {
      const svc = service as any;
      spyOn(service, 'convertirMonto').and.callFake((amount: number) => Number(amount) || 0);
      spyOn(svc.currencyService, 'formatNumber').and.callFake((n: number) => String(n ?? 0));
      spyOn(service, 'cleanFormattedNumber').and.callFake((value: string | number) => Number(value) || 0);
    }

    it('COB-DOCS-001: addSelectedDocumentsSalesFromMemory reinjects off-page selected docs', async () => {
      stubMoneyFormatters();
      const pageDoc = {
        idDocument: 1,
        coDocument: 'FAC-1',
        nuBalance: 200,
        isSelected: true,
        inPaymentPartial: false,
        isSave: true,
      } as DocumentSale;

      service.mapDocumentsSales = new Map<number, DocumentSale>([[1, pageDoc]]);
      service.documentSales = [pageDoc];
      service.documentSalesBackup = [{ ...pageDoc } as DocumentSale];
      service.documentSalesPageIds = new Set<number>([1]);
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_NEW,
        stCollection: service.COLLECT_STATUS_NEW,
        isSave: 0,
        collectionDetails: [
          {
            idDocument: 1,
            coDocument: 'FAC-1',
            inPaymentPartial: false,
            nuAmountPaid: 200,
            isSave: true,
            daVoucher: '',
            nuAmountRetention: 0,
            nuAmountRetention2: 0,
            nuValueLocal: 1,
            nuVoucherRetention: 0,
          },
          {
            idDocument: 2,
            coDocument: 'FAC-2',
            inPaymentPartial: true,
            nuAmountPaid: 40,
            isSave: true,
            daVoucher: '',
            nuAmountRetention: 0,
            nuAmountRetention2: 0,
            nuValueLocal: 1,
            nuVoucherRetention: 0,
          },
        ],
      } as any;

      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.resolveTo({
          rows: {
            length: 1,
            item: () => ({
              id_document: 2,
              id_client: 1,
              co_client: 'C1',
              id_document_sale_type: 1,
              co_document_sale_type: 'FAC',
              da_document: '2026-08-01',
              da_due_date: '2026-08-15',
              nu_amount_base: 100,
              nu_amount_discount: 0,
              nu_amount_tax: 0,
              nu_amount_total: 100,
              nu_amount_paid: 0,
              nu_balance: 100,
              co_currency: 'USD',
              id_currency: 1,
              nu_document: '2',
              tx_comment: '',
              co_document: 'FAC-2',
              co_collection: '',
              nu_value_local: 1,
              st_document_sale: 0,
              co_enterprise: 'E1',
              id_enterprise: 1,
              naType: 'FAC',
            }),
          },
        }),
      };

      await (service as any).addSelectedDocumentsSalesFromMemory(dbMock, false);

      expect(dbMock.executeSql).toHaveBeenCalled();
      expect(service.documentSales.length).toBe(2);
      expect(service.documentSales[1].idDocument).toBe(2);
      expect(service.documentSales[1].isSelected).toBeTrue();
      expect(service.documentSales[1].inPaymentPartial).toBeTrue();
      expect(service.documentSales[1].nuAmountPaid).toBe(40);
      expect(service.documentSalesPageIds.has(2)).toBeFalse();
    });

    it('P1: separateIgtf keeps montoTotalPagar as net (IGTF not embedded)', async () => {
      const svc = service as any;
      stubMoneyFormatters();
      spyOn(svc, 'resolveAutomatedPrepaid').and.stub();
      spyOn(service, 'syncAddPaymentMethodDisabledState').and.stub();
      spyOn(svc, 'syncCollectionDetailsIgtfAmounts').and.stub();
      spyOn(svc, 'syncCollectionIgtfFields').and.stub();
      spyOn(svc, 'applyCollectionIgtfAmountFields').and.stub();

      service.userCanSelectIGTF = true;
      service.multiCurrency = false;
      service.separateIgtf = true;
      service.coTypeModule = '0';
      service.isOpen = false;
      service.isChangePaymentPartialPersistence = false;
      service.isRateChangeInProgress = false;
      service.montoTotalPagado = 0;
      service.igtfSelected = { price: 3 } as any;
      service.documentSales = [] as DocumentSale[];
      service.documentSalesBackup = [] as DocumentSale[];
      service.collection = {
        coType: '0',
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_NEW,
        stCollection: service.COLLECT_STATUS_NEW,
        collectionDetails: [{
          idDocument: 10,
          coDocument: 'FAC-10',
          inPaymentPartial: false,
          nuAmountPaid: 100,
          nuAmountPaidConversion: 100,
          nuBalanceDoc: 100,
          nuBalanceDocOriginal: 100,
          nuAmountDoc: 100,
          nuAmountDiscount: 0,
          nuAmountCollectDiscount: 0,
          nuAmountRetention: 0,
          nuAmountRetention2: 0,
          nuAmountIgtf: 0,
          isSave: true,
        }],
        collectionPayments: [],
        nuAmountIgtf: 0,
      } as any;

      await service.calculatePayment('', 0, true, true);

      expect(service.montoIgtf).toBe(3);
      expect(service.montoTotalPagar).toBe(100);
      expect(service.montoTotalPagar).not.toBe(103);
    });

    it('P1: validateReferencePayment rejects non-cash without reference', async () => {
      const spy = spyOn(service, 'onCollectionValidToSend');
      service.collection = {
        collectionPayments: [{
          coType: 'tr',
          coPaymentMethod: 'tr',
          nuAmountPartial: 50,
          nuPaymentDoc: '',
          nuCollectionPayment: '',
          nuClientBankAccount: '',
        }],
      } as any;

      await expectAsync(service.validateReferencePayment()).toBeResolvedTo(false);
      expect(spy).toHaveBeenCalledWith(false);
    });

    it('P1: validateReferencePayment allows cash without reference and valid amount', async () => {
      service.collection = {
        collectionPayments: [{
          coType: 'ef',
          coPaymentMethod: 'ef',
          nuAmountPartial: 50,
          nuPaymentDoc: '',
        }],
      } as any;

      await expectAsync(service.validateReferencePayment()).toBeResolvedTo(true);
    });

    it('P1: validateReferencePayment rejects zero partial amount', async () => {
      const spy = spyOn(service, 'onCollectionValidToSend');
      service.collection = {
        collectionPayments: [{
          coType: 'ef',
          coPaymentMethod: 'ef',
          nuAmountPartial: 0,
        }],
      } as any;

      await expectAsync(service.validateReferencePayment()).toBeResolvedTo(false);
      expect(spy).toHaveBeenCalledWith(false);
    });

    it('DM-COB-028: anticipo validateToSend enables when payment partial amount > 0', async () => {
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
      };
      spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
      spyOn(service, 'hasIncompletePaymentMethods').and.returnValue(false);
      const spy = spyOn(service, 'onCollectionValidToSend');

      service.montoTotalPagar = 0;
      service.montoTotalPagado = 80;
      service.collection = {
        coType: '1',
        collectionDetails: [],
        collectionPayments: [{
          coType: 'ef',
          coPaymentMethod: 'ef',
          nuAmountPartial: 80,
        }],
      } as any;

      await service.validateToSend();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('DM-COB-028: anticipo validateToSend disables when payments lack partial amount', async () => {
      (service as any).currencyService = {
        formatNumber: (n: number) => String(n ?? 0),
      };
      spyOn(service, 'cleanFormattedNumber').and.callFake((v: string | number) => Number(v) || 0);
      spyOn(service, 'hasIncompletePaymentMethods').and.returnValue(false);
      const spy = spyOn(service, 'onCollectionValidToSend');

      service.collection = {
        coType: '1',
        collectionDetails: [],
        collectionPayments: [{
          coType: 'ef',
          coPaymentMethod: 'ef',
          nuAmountPartial: 0,
        }],
      } as any;

      await service.validateToSend();

      expect(spy).toHaveBeenCalledWith(false);
    });
  });

  describe('COB-RET-001 multi-document retention completeness', () => {
    function legacyCompleteDetail(overrides: Partial<CollectionDetail> = {}): CollectionDetail {
      return {
        coDocument: 'FAC-A',
        nuAmountRetention: 10,
        nuAmountRetention2: 0,
        nuVoucherRetention: '1234567890',
        daVoucher: '2026-08-05',
        ...overrides,
      } as CollectionDetail;
    }

    beforeEach(() => {
      service.dynamicRetentions = false;
      service.sizeRetention = 0;
      service.collectRetentions = [];
    });

    it('COB-RET-001: validateToSend OFF when one selected doc has zero retention', async () => {
      const spy = spyOn(service, 'onCollectionValidToSend');
      service.collection = {
        coType: '2',
        collectionDetails: [
          legacyCompleteDetail({ coDocument: 'FAC-A' }),
          legacyCompleteDetail({
            coDocument: 'FAC-B',
            nuAmountRetention: 0,
            nuAmountRetention2: 0,
            nuVoucherRetention: '',
            daVoucher: '',
          }),
        ],
      } as any;

      await service.validateToSend();

      expect(spy).toHaveBeenCalledWith(false);
    });

    it('COB-RET-002: validateToSend ON when all selected docs are complete', async () => {
      const spy = spyOn(service, 'onCollectionValidToSend');
      service.collection = {
        coType: '2',
        collectionDetails: [
          legacyCompleteDetail({ coDocument: 'FAC-A' }),
          legacyCompleteDetail({
            coDocument: 'FAC-B',
            nuAmountRetention: 5,
            nuVoucherRetention: 'ABC',
            daVoucher: '2026-08-04',
          }),
        ],
      } as any;

      await service.validateToSend();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('COB-RET-003: validateToSend ON for single complete retention detail', async () => {
      const spy = spyOn(service, 'onCollectionValidToSend');
      service.collection = {
        coType: '2',
        collectionDetails: [legacyCompleteDetail()],
      } as any;

      await service.validateToSend();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('COB-RET-004: validateToSend OFF when dynamic retention line is incomplete', async () => {
      const spy = spyOn(service, 'onCollectionValidToSend');
      service.dynamicRetentions = true;
      service.collectRetentions = [{
        idCollectRetention: 1,
        requireInput: true,
        nuVoucherLength: 10,
      } as any];
      service.collection = {
        coType: '2',
        collectionDetails: [{
          coDocument: 'FAC-A',
          nuAmountRetention: 0,
          nuAmountRetention2: 0,
          collectionDetailRetentions: [{
            idCollectRetention: 1,
            nuAmountRetention: 15,
            nuVoucherRetention: '',
            daVoucherRetention: '2026-08-05',
          }],
        }],
      } as any;

      await service.validateToSend();

      expect(spy).toHaveBeenCalledWith(false);
    });

    it('COB-RET-005: isRetentionDetailComplete / areAllRetentionDetailsComplete unit cases', () => {
      expect(service.areAllRetentionDetailsComplete([])).toBeFalse();
      expect(service.areAllRetentionDetailsComplete(undefined)).toBeFalse();
      expect(service.isRetentionDetailComplete(null)).toBeFalse();

      const complete = legacyCompleteDetail();
      expect(service.isRetentionDetailComplete(complete)).toBeTrue();
      expect(service.areAllRetentionDetailsComplete([complete])).toBeTrue();

      const zeroAmount = legacyCompleteDetail({ nuAmountRetention: 0, nuAmountRetention2: 0 });
      expect(service.isRetentionDetailComplete(zeroAmount)).toBeFalse();

      const missingVoucher = legacyCompleteDetail({ nuVoucherRetention: '   ' });
      expect(service.isRetentionDetailComplete(missingVoucher)).toBeFalse();

      const missingDate = legacyCompleteDetail({ daVoucher: '' });
      expect(service.isRetentionDetailComplete(missingDate)).toBeFalse();

      service.sizeRetention = 10;
      expect(service.isRetentionDetailComplete(legacyCompleteDetail({ nuVoucherRetention: '123' }))).toBeFalse();
      expect(service.isRetentionDetailComplete(legacyCompleteDetail({ nuVoucherRetention: '1234567890' }))).toBeTrue();

      service.dynamicRetentions = true;
      service.collectRetentions = [{
        idCollectRetention: 7,
        requireInput: true,
        nuVoucherLength: 5,
      } as any];
      const dynamicOk = {
        coDocument: 'FAC-D',
        collectionDetailRetentions: [{
          idCollectRetention: 7,
          nuAmountRetention: 3,
          nuVoucherRetention: '12345',
          daVoucherRetention: '2026-01-01',
        }],
      } as CollectionDetail;
      expect(service.isRetentionDetailComplete(dynamicOk)).toBeTrue();

      const dynamicNoId = {
        coDocument: 'FAC-D2',
        collectionDetailRetentions: [{
          idCollectRetention: 0,
          nuAmountRetention: 3,
          nuVoucherRetention: '12345',
          daVoucherRetention: '2026-01-01',
        }],
      } as CollectionDetail;
      expect(service.isRetentionDetailComplete(dynamicNoId)).toBeFalse();

      expect(service.areAllRetentionDetailsComplete([complete, zeroAmount])).toBeFalse();
    });

    it('COB-RET-SEND-001: getRetentionSendValidationMessage for zero amount uses coDocument', () => {
      service.collectionTags = new Map([
        ['COB_MSJ_RETENTION_AMOUNT_REQUIRED', 'Falta monto en {coDocument}.'],
        ['COB_MSJ_RETENTION_INCOMPLETE_SEND', 'Retención incompleta genérica.'],
      ]);
      service.collection = {
        collectionDetails: [{
          coDocument: 'FAC-001',
          nuAmountRetention: 0,
          nuAmountRetention2: 0,
        } as CollectionDetail],
      } as any;
      service.documentSales = [{
        isSelected: true,
        positionCollecDetails: 0,
      } as DocumentSale];

      expect(service.findFirstIncompleteRetentionDocumentIndex()).toBe(0);
      expect(service.getRetentionSendValidationMessage()).toBe('Falta monto en FAC-001.');
    });

    it('COB-RET-SEND-001: getRetentionSendValidationMessage for missing voucher uses generic tag', () => {
      service.collectionTags = new Map([
        ['COB_MSJ_RETENTION_INCOMPLETE_SEND', 'Complete monto, comprobante y fecha.'],
      ]);
      const incomplete = legacyCompleteDetail({ nuVoucherRetention: '' });
      service.collection = {
        collectionDetails: [incomplete],
      } as any;
      service.documentSales = [{
        isSelected: true,
        positionCollecDetails: 0,
      } as DocumentSale];

      expect(service.getRetentionSendValidationMessage()).toBe('Complete monto, comprobante y fecha.');
    });
  });

  describe('COB-SEND-UX-001 send validation message and focus tab', () => {
    it('getCollectionSendValidationMessage: comentario obligatorio', () => {
      service.collection = {
        coType: '0',
        collectionPayments: [{ coPaymentMethod: 'ef', nuAmountPartial: 10 } as any],
        collectionDetails: [{ coDocument: 'F-1', nuAmountPaid: 10 }],
      } as any;
      service.requiredComment = true;
      service.validComment = false;
      service.hidePayments = false;
      service.hideDocuments = true;
      spyOn(service, 'hasIncompletePaymentMethods').and.returnValue(false);
      spyOn(service, 'hasEmptyCollectionPayments').and.returnValue(false);
      spyOn(service, 'hasIncompletePersistedPaymentAmounts').and.returnValue(false);
      spyOn(service, 'hasIncompleteDocumentAmountToPay').and.returnValue(false);
      service.collectionTags = new Map([
        ['COB_MSJ_ERROR_NO_COMMENT', 'El comentario es obligatorio.'],
      ]);

      expect(service.getCollectionSendValidationMessage()).toBe('El comentario es obligatorio.');
      expect(service.resolveSendValidationFocusTab()).toBe('default');
    });

    it('SEND-TAB-001: sin issues resolve es null y request no emite', () => {
      service.collection = { coType: '0' } as any;
      service.lastSendIssues = [];
      spyOn(service as any, 'collectSyncFieldSendIssues').and.returnValue([]);
      let focused: string | undefined = 'sentinel';
      service.focusSendValidationTab.subscribe((tab) => focused = tab);

      expect(service.resolveSendValidationFocusTab()).toBeNull();
      service.requestSendValidationTabFocus();
      expect(focused).toBe('sentinel');
    });

    it('getCollectionSendValidationMessage: pago incompleto enfoca Pagos', () => {
      service.collection = { coType: '0' } as any;
      service.hidePayments = false;
      spyOn(service, 'hasEmptyCollectionPayments').and.returnValue(false);
      spyOn(service, 'hasIncompletePaymentMethods').and.returnValue(true);
      service.collectionTags = new Map([
        ['COB_MSJ_ERROR_INCOMPLETE_PAYMENT', 'Método de pago incompleto.'],
      ]);

      expect(service.getCollectionSendValidationMessage()).toBe('Método de pago incompleto.');
      expect(service.resolveSendValidationFocusTab()).toBe('pagos');
    });

    it('getCollectionSendValidationMessage: retención reusa mensaje de retención', () => {
      service.collection = { coType: '2', collectionDetails: [] } as any;
      spyOn(service, 'areAllRetentionDetailsComplete').and.returnValue(false);
      spyOn(service, 'getRetentionSendValidationMessage').and.returnValue('Retención incompleta.');

      expect(service.getCollectionSendValidationMessage()).toBe('Retención incompleta.');
      expect(service.resolveSendValidationFocusTab()).toBe('documentos');
    });

    it('getCollectionSendValidationMessage: monto a pagar faltante enfoca Documentos', () => {
      service.collection = {
        coType: '0',
        collectionDetails: [{ coDocument: 'F-1', nuAmountPaid: 0 }],
        collectionPayments: [{ coPaymentMethod: 'ef', nuAmountPartial: 10 }],
      } as any;
      service.hideDocuments = false;
      service.hidePayments = false;
      spyOn(service, 'hasEmptyCollectionPayments').and.returnValue(false);
      spyOn(service, 'hasIncompletePaymentMethods').and.returnValue(false);
      service.collectionTags = new Map([
        ['COB_MSJ_ERROR_NO_AMOUNT_TO_PAY', 'Falta el monto a pagar.'],
      ]);

      expect(service.hasIncompleteDocumentAmountToPay()).toBeTrue();
      expect(service.hasSendFieldErrors()).toBeTrue();
      expect(service.getCollectionSendValidationMessage()).toBe('Falta el monto a pagar.');
      expect(service.resolveSendValidationFocusTab()).toBe('documentos');
    });

    it('COB-SEND-AMT-001: FACT + NCR con montos negativos no bloquea Enviar por monto documento', () => {
      service.collection = {
        coType: '0',
        collectionDetails: [
          {
            coDocument: 'FACT38565',
            coTypeDoc: 'FACT',
            nuAmountPaid: 120690.52,
            nuBalanceDoc: 123466.27,
            inPaymentPartial: true,
          },
          {
            coDocument: 'NCR20000427',
            coTypeDoc: 'NCR',
            nuAmountPaid: -15000,
            nuBalanceDoc: -15000,
          },
          {
            coDocument: 'FACT39581',
            coTypeDoc: 'FACT',
            nuAmountPaid: 25000,
            nuBalanceDoc: 25000,
          },
          {
            coDocument: 'NCR20000428',
            coTypeDoc: 'NCR',
            nuAmountPaid: -12775.75,
            nuBalanceDocOriginal: -12775.75,
          },
        ],
        collectionPayments: [{ coPaymentMethod: 'ef', nuAmountPartial: 54000 }],
      } as any;
      service.hideDocuments = false;
      service.hidePayments = false;

      expect(service.hasIncompleteDocumentAmountToPay()).toBeFalse();
    });

    it('COB-SEND-AMT-001: NCR con nuAmountPaid 0 sigue bloqueando Enviar', () => {
      service.collection = {
        coType: '0',
        collectionDetails: [
          { coDocument: 'FAC-1', nuAmountPaid: 100, nuBalanceDoc: 100 },
          { coDocument: 'NCR-1', coTypeDoc: 'NCR', nuAmountPaid: 0, nuBalanceDoc: -100 },
        ],
      } as any;
      service.hideDocuments = false;

      expect(service.hasIncompleteDocumentAmountToPay()).toBeTrue();
    });

    it('hasIncompletePersistedPaymentMethods: transferencia sin cuenta receptor', () => {
      service.collection = {
        coType: '0',
        collectionPayments: [{
          coPaymentMethod: 'tr',
          nuAmountPartial: 100,
          daValue: '2026-01-01',
          naBank: 'Banco',
          nuPaymentDoc: 'REF1',
          nuBankAccount: '',
        }],
      } as any;
      service.hidePayments = false;
      service.clientBankAccount = false;
      service.pagoTransferencia = [];

      expect(service.hasIncompletePersistedPaymentMethods()).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeTrue();
    });

    it('hasIncompletePersistedPaymentAmounts: monto 0 en SQLite sin UI hidratada', () => {
      service.collection = {
        coType: '0',
        collectionPayments: [{ coPaymentMethod: 'ef', nuAmountPartial: 0 }],
      } as any;
      service.hidePayments = false;
      service.pagoEfectivo = [];
      service.tipoPagoEfectivo = false;

      expect(service.hasIncompletePersistedPaymentAmounts()).toBeTrue();
      expect(service.hasIncompletePaymentMethods()).toBeTrue();
    });

    it('requestSendValidationTabFocus emite la pestaña resuelta', () => {
      service.collection = { coType: '0' } as any;
      spyOn(service, 'hasEmptyCollectionPayments').and.returnValue(false);
      spyOn(service, 'hasIncompletePaymentMethods').and.returnValue(true);
      let focused: string | undefined;
      service.focusSendValidationTab.subscribe((tab) => { focused = tab; });

      service.requestSendValidationTabFocus();

      expect(focused).toBe('pagos');
    });

    it('COB-DISC-004: Otros monto 0 válido cuando cobro cubierto y efectivoRequerido es 0', () => {
      service.isFullyCoveredCollection = true;
      service.efectivoRequerido = 0;
      service.enableDifferenceCodes = true;
      service.coTypeModule = '0';
      service.collection = {
        coType: '0',
        collectionPayments: [{
          coPaymentMethod: 'ot',
          coType: 'ot',
          nuAmountPartial: 0,
          idDifferenceCode: 1,
          coDifferenceCode: 'CD01',
          nuPaymentDoc: 'REF',
        }],
      } as any;
      service.pagoOtros = [{
        monto: 0,
        nombre: 'Cubierto',
        differenceCode: { idDifferenceCode: 1, coDifferenceCode: 'CD01' },
      } as any];
      service.tipoPagoOtros = true;

      expect(service.hasIncompletePersistedPaymentAmounts()).toBeFalse();
      expect(service.hasIncompletePaymentMethods()).toBeFalse();
      service.syncAddPaymentMethodDisabledState();
      expect(service.isAddPaymentMethodDisabled()).toBeFalse();
    });
  });

  describe('COB-SEND-FLUSH-001 flush pre-envío sin bucle validateToSend', () => {
    it('notifyCollectionEdited durante syncPendingInputs no dispara validateToSend', () => {
      service.collection = { coType: '0' } as any;
      const validateSpy = spyOn(service, 'validateToSend').and.resolveTo();

      const unregister = service.registerSendValidationFlushHandler(() => {
        service.notifyCollectionEdited();
      });

      service.syncPendingInputsBeforeSendValidation();

      expect(validateSpy).not.toHaveBeenCalled();
      unregister();
    });

    it('validateToSend termina en una pasada aunque el flush llame notifyCollectionEdited', async () => {
      service.collection = { coType: '0' } as any;

      let validateCalls = 0;
      const originalValidate = service.validateToSend.bind(service);
      spyOn(service, 'validateToSend').and.callFake(async function (this: CollectionService) {
        validateCalls++;
        if (validateCalls > 5) {
          fail('validateToSend entró en bucle');
        }
        return originalValidate.call(this);
      });

      spyOn(service, 'evaluateSendReadiness').and.resolveTo([]);

      const unregister = service.registerSendValidationFlushHandler(() => {
        service.notifyCollectionEdited();
      });

      await service.validateToSend();

      expect(validateCalls).toBe(1);
      unregister();
    });
  });

  describe('COB-TOTAL-003 Monto Saldo restante con retenciones', () => {
    it('full payment with retention shows 0 remaining (500 - 100 ret - 400 paid)', () => {
      const detail = {
        nuBalanceDoc: 500,
        nuBalanceDocOriginal: 500,
        nuAmountPaid: 400,
        nuAmountDiscount: 0,
        nuAmountCollectDiscount: 0,
        nuAmountRetention: 100,
        nuAmountRetention2: 0,
        inPaymentPartial: false,
        isSave: true,
      } as CollectionDetail;

      expect(service.resolveCollectionDetailRemainingBalance(detail)).toBe(0);
    });

    it('partial payment without deductions keeps gross minus paid (COB-TOTAL-002)', () => {
      const detail = {
        nuBalanceDoc: 157.75,
        nuBalanceDocOriginal: 157.75,
        nuAmountPaid: 57,
        nuAmountDiscount: 0,
        nuAmountCollectDiscount: 0,
        nuAmountRetention: 0,
        nuAmountRetention2: 0,
        inPaymentPartial: true,
        isSave: true,
      } as CollectionDetail;

      expect(service.resolveCollectionDetailRemainingBalance(detail)).toBe(100.75);
    });

    it('COB-TOTAL-004: partial + legacy retention uses gross minus paid (not net)', () => {
      const detail = {
        nuBalanceDoc: 500,
        nuBalanceDocOriginal: 500,
        nuAmountPaid: 200,
        nuAmountDiscount: 0,
        nuAmountCollectDiscount: 0,
        nuAmountRetention: 100,
        nuAmountRetention2: 0,
        inPaymentPartial: true,
        isSave: true,
      } as CollectionDetail;

      expect(service.resolveCollectionDetailRemainingBalance(detail)).toBe(300);
    });

    it('COB-TOTAL-004: partial 154.03 + ret 15+35 on 254.03 shows 100', () => {
      const detail = {
        nuBalanceDoc: 254.03,
        nuBalanceDocOriginal: 254.03,
        nuAmountPaid: 154.03,
        nuAmountDiscount: 0,
        nuAmountCollectDiscount: 0,
        nuAmountRetention: 15,
        nuAmountRetention2: 35,
        inPaymentPartial: true,
        isSave: true,
      } as CollectionDetail;

      expect(service.resolveCollectionDetailRemainingBalance(detail)).toBeCloseTo(100, 2);
    });

    it('COB-TOTAL-004: partial + dynamic retentions ignores them for remaining', () => {
      service.dynamicRetentions = true;
      const detail = {
        nuBalanceDoc: 254.03,
        nuBalanceDocOriginal: 254.03,
        nuAmountPaid: 154.03,
        nuAmountDiscount: 0,
        nuAmountCollectDiscount: 0,
        nuAmountRetention: 0,
        nuAmountRetention2: 0,
        collectionDetailRetentions: [
          { idCollectRetention: 1, nuAmountRetention: 15 },
          { idCollectRetention: 2, nuAmountRetention: 35 },
        ],
        inPaymentPartial: true,
        isSave: true,
      } as CollectionDetail;

      expect(service.resolveCollectionDetailRemainingBalance(detail)).toBeCloseTo(100, 2);
    });
  });

  describe('COB-TOTAL-001 Total General nuAmountTotal on reopen/persist', () => {
    function stubTotalSideEffects(): void {
      const svc = service as any;
      spyOn(service, 'convertirMonto').and.callFake((amount: number) => Number(amount) || 0);
      spyOn(svc.currencyService, 'formatNumber').and.callFake((n: number) => String(n ?? 0));
      spyOn(service, 'cleanFormattedNumber').and.callFake((value: string | number) => Number(value) || 0);
      spyOn(svc, 'shouldApplyIgtfToCollection').and.returnValue(false);
      spyOn(svc, 'shouldCalculateEmbeddedIgtf').and.returnValue(false);
      spyOn(svc, 'isRetentionCollection').and.returnValue(false);
      spyOn(svc, 'resolveAutomatedPrepaid').and.stub();
      spyOn(service, 'syncAddPaymentMethodDisabledState').and.stub();
      spyOn(svc, 'syncCollectionDetailsIgtfAmounts').and.stub();
      spyOn(svc, 'syncCollectionIgtfFields').and.stub();
      spyOn(svc, 'applyCollectionIgtfAmountFields').and.stub();
      spyOn(svc, 'restoreCollectionIgtfFields').and.stub();
      spyOn(svc, 'restorePersistedIgtfDisplayAmounts').and.stub();
    }

    function setupSavedHardCollection(): void {
      stubTotalSideEffects();
      service.coTypeModule = '0';
      service.isOpen = false;
      service.isChangePaymentPartialPersistence = false;
      service.isRateChangeInProgress = false;
      service.tipoPagoTransferencia = true;
      service.tipoPagoEfectivo = false;
      service.tipoPagoCheque = false;
      service.tipoPagoDeposito = false;
      service.tipoPagoPagoMovil = false;
      service.tipoPagoOtros = false;
      service.pagoTransferencia = [] as any[];
      service.pagoEfectivo = [] as any[];
      service.pagoCheque = [] as any[];
      service.pagoDeposito = [] as any[];
      service.pagoMovil = [] as any[];
      service.pagoOtros = [] as any[];
      service.montoTotalPagado = 0;
      service.montoTotalPagar = 0;
      service.documentSales = [] as DocumentSale[];
      service.documentSalesBackup = [] as DocumentSale[];
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 36.5,
        stDelivery: service.COLLECT_STATUS_SAVED,
        stCollection: service.COLLECT_STATUS_SAVED,
        coType: '0',
        nuAmountFinal: 2000.94,
        nuAmountFinalConversion: 73034.31,
        nuAmountTotal: 2000.94,
        nuAmountTotalConversion: 73034.31,
        nuAmountPaid: 2000.94,
        nuAmountPaidConversion: 73034.31,
        nuAmountIgtf: 0,
        collectionDetails: [{
          idDocument: 10,
          coDocument: 'FAC-10',
          inPaymentPartial: false,
          nuAmountPaid: 2000.94,
          nuAmountPaidConversion: 2000.94,
          nuBalanceDoc: 2000.94,
          nuBalanceDocOriginal: 2000.94,
          nuAmountDoc: 2000.94,
          nuAmountDiscount: 0,
          nuAmountCollectDiscount: 0,
          nuAmountRetention: 0,
          nuAmountRetention2: 0,
          nuAmountIgtf: 0,
          isSave: true,
        }] as CollectionDetail[],
        collectionPayments: [{
          coPaymentMethod: 'tr',
          nuAmountPartial: 2000.94,
          nuAmountPartialConversion: 73034.31,
        }],
      } as any;
    }

    it('forceRecalc with empty UI arrays keeps nuAmountTotal from collectionPayments', async () => {
      setupSavedHardCollection();

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagado).toBe(2000.94);
      expect(service.collection.nuAmountTotal).toBe(2000.94);
      expect(service.collection.nuAmountTotal).not.toBe(0);
    });

    it('preserve path after UI hydrate syncs nuAmountTotal to montoTotalPagado', async () => {
      setupSavedHardCollection();
      service.collection.nuAmountTotal = 0;
      service.collection.nuAmountTotalConversion = 0;
      service.pagoTransferencia = [{
        monto: 2000.94,
        montoConversion: 73034.31,
        type: 'tr',
        posCollectionPayment: 0,
      }] as any[];

      await service.calculatePayment('', 0, false, true);

      expect(service.montoTotalPagar).toBe(2000.94);
      expect(service.montoTotalPagado).toBe(2000.94);
      expect(service.collection.nuAmountTotal).toBe(2000.94);
    });

    it('syncNuAmountTotalFromPaidAmounts aligns header before persist (normal cobro)', () => {
      stubTotalSideEffects();
      service.coTypeModule = '0';
      service.montoTotalPagado = 150.5;
      service.collection = {
        coCurrency: 'USD',
        coType: '0',
        nuAmountTotal: 0,
        nuAmountTotalConversion: 0,
        collectionPayments: [],
      } as any;

      (service as any).syncNuAmountTotalFromPaidAmounts();

      expect(service.collection.nuAmountTotal).toBe(150.5);
      expect(service.collection.nuAmountTotalConversion).toBe(150.5);
    });

    it('retention syncNuAmountTotalFromPaidAmounts does not overwrite retention totals', () => {
      stubTotalSideEffects();
      (service as any).isRetentionCollection.and.returnValue(true);
      service.coTypeModule = '2';
      service.montoTotalPagado = 99;
      service.collection = {
        coCurrency: 'USD',
        coType: '2',
        nuAmountTotal: 40,
        nuAmountTotalConversion: 40,
        collectionPayments: [],
      } as any;

      (service as any).syncNuAmountTotalFromPaidAmounts();

      expect(service.collection.nuAmountTotal).toBe(40);
    });

    it('SENT forceRecalc with empty UI also restores paid from collectionPayments', async () => {
      setupSavedHardCollection();
      service.collection.stDelivery = service.COLLECT_STATUS_SENT;
      service.collection.nuAmountTotal = 2000.94;

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagado).toBe(2000.94);
      expect(service.collection.nuAmountTotal).toBe(2000.94);
    });
  });

  describe('COB-DISC-001 attachCollectionDetailDiscountsToDetails', () => {
    it('attaches manual discount only to matching coDocument', () => {
      const details = [
        { coDocument: 'FF081402', coCollection: 'COB-1', collectionDetailDiscounts: [] },
        { coDocument: 'FF082165', coCollection: 'COB-1', collectionDetailDiscounts: [] },
      ] as any[];
      const discounts = [{
        coCollection: 'COB-1',
        coDocument: 'FF081402',
        idCollectDiscount: -1,
        naCollectDiscountOther: 'Descuento manual',
        nuAmountCollectDiscountOther: 8,
      }] as any[];

      service.attachCollectionDetailDiscountsToDetails(details, discounts);

      expect(details[0].collectionDetailDiscounts.length).toBe(1);
      expect(details[0].collectionDetailDiscounts[0].nuAmountCollectDiscountOther).toBe(8);
      expect(details[1].collectionDetailDiscounts).toEqual([]);
    });

    it('keeps distinct discounts per document without cross-leak', () => {
      const details = [
        { coDocument: 'DOC-A', collectionDetailDiscounts: [] },
        { coDocument: 'DOC-B', collectionDetailDiscounts: [] },
      ] as any[];
      const discounts = [
        {
          coDocument: 'DOC-A',
          idCollectDiscount: -1,
          nuAmountCollectDiscountOther: 8,
        },
        {
          coDocument: 'DOC-B',
          idCollectDiscount: 12,
          nuAmountCollectDiscountOther: 3,
        },
      ] as any[];

      service.attachCollectionDetailDiscountsToDetails(details, discounts);

      expect(details[0].collectionDetailDiscounts.map((d: any) => d.idCollectDiscount)).toEqual([-1]);
      expect(details[1].collectionDetailDiscounts.map((d: any) => d.idCollectDiscount)).toEqual([12]);
    });

    it('matches coDocument after normalizeCoDocument trims spaces', () => {
      const details = [
        { coDocument: 'FF081402', collectionDetailDiscounts: [] },
      ] as any[];
      const discounts = [{
        coDocument: '  FF081402  ',
        idCollectDiscount: -1,
        nuAmountCollectDiscountOther: 8,
      }] as any[];

      service.attachCollectionDetailDiscountsToDetails(details, discounts);

      expect(details[0].collectionDetailDiscounts.length).toBe(1);
      expect(details[0].collectionDetailDiscounts[0].nuAmountCollectDiscountOther).toBe(8);
    });
  });

  describe('COB-SAVE-001 Guardar habilitado sin validar campos', () => {
    it('cobro nuevo habilita Guardar sin General válida', () => {
      service.collection = { stDelivery: 3 } as any;
      service.resetCollectionExitBaseline();
      service.generalTabValidForSave = false;
      let saveEnabled: boolean | undefined;
      service.collectValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });

    it('applyPersistSucceededBaseline deshabilita Guardar hasta dirty', () => {
      service.collection = { stDelivery: 3 } as any;
      service.resetCollectionExitBaseline();
      let saveEnabled: boolean | undefined;
      service.collectValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();

      service.applyPersistSucceededBaseline();
      expect(saveEnabled).toBeFalse();
    });

    it('colección solo lectura deshabilita Guardar', () => {
      service.collection = { stDelivery: service.COLLECT_STATUS_TO_SEND } as any;
      service.collectionDirtySincePersist = true;
      let saveEnabled: boolean | undefined;
      service.collectValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeFalse();
    });
  });

  describe('COB-SAVE-002 Guardar OFF tras guardar hasta editar', () => {
    it('baseline limpio deshabilita Guardar aunque General sea válida', () => {
      service.collection = { stDelivery: 3 } as any;
      service.collectionPersistedBaseline = true;
      service.collectionDirtySincePersist = false;
      let saveEnabled: boolean | undefined;
      service.collectValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeFalse();
    });

    it('markCollectionDirty re-habilita Guardar tras baseline', () => {
      service.collection = { stDelivery: 3 } as any;
      let saveEnabled: boolean | undefined;
      service.collectValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.applyPersistSucceededBaseline();

      expect(saveEnabled).toBeFalse();
      service.markCollectionDirty();
      expect(saveEnabled).toBeTrue();
    });

    it('reapertura persistida deja Guardar OFF hasta dirty', () => {
      service.collection = { stDelivery: 3 } as any;
      let saveEnabled: boolean | undefined;
      service.collectValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.markCollectionOpenedFromPersistedCopy();
      expect(saveEnabled).toBeFalse();

      service.markCollectionDirty();
      expect(saveEnabled).toBeTrue();
    });

    it('cobro nuevo sin baseline permite Guardar sin General válida', () => {
      service.collection = { stDelivery: 3 } as any;
      service.resetCollectionExitBaseline();
      service.generalTabValidForSave = false;
      let saveEnabled: boolean | undefined;
      service.collectValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });
  });

  describe('COB-FALT-001 faltante→0 refreshes montoTotalPagar on SAVED', () => {
    function makeDetail(partial: Partial<CollectionDetail>): CollectionDetail {
      return {
        idDocument: 1,
        coDocument: 'FAC-1',
        inPaymentPartial: false,
        nuAmountPaid: 0,
        nuAmountPaidConversion: 0,
        nuBalanceDoc: 0,
        nuBalanceDocConversion: 0,
        nuBalanceDocOriginal: 0,
        nuAmountDoc: 0,
        nuAmountDiscount: 0,
        nuAmountDiscountConversion: 0,
        nuAmountCollectDiscount: 0,
        nuAmountRetention: 0,
        nuAmountRetention2: 0,
        nuAmountIgtf: 0,
        isSave: true,
        ...partial,
      } as CollectionDetail;
    }

    function stubPaymentSideEffects(): void {
      const svc = service as any;
      spyOn(service, 'convertirMonto').and.callFake((amount: number) => Number(amount) || 0);
      spyOn(svc.currencyService, 'formatNumber').and.callFake((n: number) => String(n ?? 0));
      spyOn(service, 'cleanFormattedNumber').and.callFake((value: string | number) => Number(value) || 0);
      spyOn(svc, 'shouldApplyIgtfToCollection').and.returnValue(false);
      spyOn(svc, 'shouldCalculateEmbeddedIgtf').and.returnValue(false);
      spyOn(svc, 'isRetentionCollection').and.returnValue(false);
      spyOn(svc, 'resolveAutomatedPrepaid').and.stub();
      spyOn(service, 'syncAddPaymentMethodDisabledState').and.stub();
      spyOn(svc, 'syncCollectionDetailsIgtfAmounts').and.stub();
      spyOn(svc, 'syncCollectionIgtfFields').and.stub();
      spyOn(svc, 'applyCollectionIgtfAmountFields').and.stub();
      spyOn(svc, 'restoreCollectionIgtfFields').and.stub();
      spyOn(svc, 'restorePersistedIgtfDisplayAmounts').and.stub();
    }

    it('SAVED: clearing faltante + syncing nuAmountPaid lifts montoTotalPagar to full balance', async () => {
      stubPaymentSideEffects();
      service.coTypeModule = '0';
      service.isOpen = false;
      service.isChangePaymentPartialPersistence = false;
      service.isRateChangeInProgress = false;
      service.montoTotalPagado = 400;
      service.documentSales = [{
        idDocument: 10,
        coDocument: 'FAC-10',
        isSelected: true,
        isSave: true,
        inPaymentPartial: false,
        nuAmountPaid: 400,
        positionCollecDetails: 0,
      } as DocumentSale];
      service.documentSalesBackup = [{
        idDocument: 10,
        nuBalance: 500,
        nuAmountPaid: 400,
        isSave: true,
      } as DocumentSale];
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_SAVED,
        stCollection: service.COLLECT_STATUS_SAVED,
        coType: '0',
        nuAmountFinal: 400,
        nuAmountPaid: 400,
        nuAmountTotal: 400,
        nuAmountIgtf: 0,
        collectionDetails: [
          makeDetail({
            idDocument: 10,
            coDocument: 'FAC-10',
            nuBalanceDoc: 500,
            nuBalanceDocOriginal: 500,
            nuAmountDoc: 500,
            nuAmountDiscount: 0,
            nuAmountPaid: 500,
            nuAmountPaidConversion: 500,
            isSave: true,
          }),
        ],
        collectionPayments: [{
          coPaymentMethod: 'ef',
          nuAmountPartial: 400,
        }],
      } as any;
      service.tipoPagoEfectivo = true;
      service.pagoEfectivo = [{ monto: 400, type: 'ef', posCollectionPayment: 0 }] as any[];

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(500);
      expect(service.montoTotalPagar).not.toBe(400);
    });

    it('SAVED preserve: stale paid < expectedNet after faltante 0 does not freeze montoTotalPagar', async () => {
      stubPaymentSideEffects();
      service.coTypeModule = '0';
      service.isOpen = false;
      service.isChangePaymentPartialPersistence = false;
      service.isRateChangeInProgress = false;
      service.montoTotalPagado = 400;
      service.documentSales = [{
        idDocument: 10,
        coDocument: 'FAC-10',
        isSelected: true,
        isSave: true,
        inPaymentPartial: false,
        nuAmountPaid: 400,
        positionCollecDetails: 0,
      } as DocumentSale];
      service.documentSalesBackup = [{
        idDocument: 10,
        nuBalance: 500,
        nuAmountPaid: 400,
        isSave: true,
      } as DocumentSale];
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_SAVED,
        stCollection: service.COLLECT_STATUS_SAVED,
        coType: '0',
        nuAmountFinal: 400,
        nuAmountPaid: 400,
        nuAmountTotal: 400,
        nuAmountIgtf: 0,
        collectionDetails: [
          makeDetail({
            idDocument: 10,
            coDocument: 'FAC-10',
            nuBalanceDoc: 500,
            nuBalanceDocOriginal: 500,
            nuAmountDoc: 500,
            nuAmountDiscount: 0,
            // Neto viejo aún en detail (antes del sync de amountPaid)
            nuAmountPaid: 400,
            nuAmountPaidConversion: 400,
            isSave: true,
          }),
        ],
        collectionPayments: [{
          coPaymentMethod: 'tr',
          nuAmountPartial: 400,
        }],
      } as any;
      service.tipoPagoTransferencia = true;
      service.pagoTransferencia = [{ monto: 400, type: 'tr', posCollectionPayment: 0 }] as any[];

      await service.calculatePayment('', 0, false, true);

      expect(service.montoTotalPagar).toBe(500);
    });

    it('restoreDocumentSaleState restores faltante snapshot on cancel', () => {
      stubPaymentSideEffects();
      service.documentSales = [{
        idDocument: 10,
        coDocument: 'FAC-10',
        positionCollecDetails: 0,
        isSave: true,
        nuAmountPaid: 400,
      } as DocumentSale];
      service.documentSalesBackup = [{
        idDocument: 10,
        coDocument: 'FAC-10',
        positionCollecDetails: 0,
        isSave: true,
        nuBalance: 500,
        nuAmountPaid: 400,
      } as DocumentSale];
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_SAVED,
        collectionDetails: [
          makeDetail({
            idDocument: 10,
            coDocument: 'FAC-10',
            nuBalanceDoc: 500,
            nuAmountDiscount: 100,
            nuAmountDiscountConversion: 100,
            nuAmountPaid: 400,
            isSave: true,
          }),
        ],
        collectionPayments: [],
      } as any;

      service.captureOpenDetailFaltanteBackup(0);
      service.collection.collectionDetails[0].nuAmountDiscount = 0;
      service.collection.collectionDetails[0].nuAmountDiscountConversion = 0;

      service.restoreDocumentSaleState(0);

      expect(service.collection.collectionDetails[0].nuAmountDiscount).toBe(100);
      expect(service.collection.collectionDetails[0].nuAmountDiscountConversion).toBe(100);
    });

    it('partial payment still uses nuAmountPaid (not full balance) after faltante 0', async () => {
      stubPaymentSideEffects();
      service.coTypeModule = '0';
      service.isOpen = false;
      service.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        stDelivery: service.COLLECT_STATUS_SAVED,
        collectionDetails: [
          makeDetail({
            idDocument: 99,
            coDocument: 'FAC-99',
            inPaymentPartial: true,
            nuAmountPaid: 40,
            nuAmountPaidConversion: 40,
            nuBalanceDoc: 100,
            nuBalanceDocOriginal: 100,
            nuAmountDiscount: 0,
            isSave: true,
          }),
        ],
        collectionPayments: [],
        nuAmountIgtf: 0,
      } as any;
      service.documentSales = [] as DocumentSale[];
      service.documentSalesBackup = [] as DocumentSale[];

      await service.calculatePayment('', 0, true, true);

      expect(service.montoTotalPagar).toBe(40);
    });
  });

  describe('syncCollectionDetailDiscountConversion', () => {
    it('clears stale conversion when faltante local is set to 0', () => {
      service.collection = {
        coCurrency: 'VES',
        nuValueLocal: 36.5,
      } as any;

      const detail = {
        nuAmountDiscount: 0,
        nuAmountDiscountConversion: 13.5887,
      } as CollectionDetail;

      service.syncCollectionDetailDiscountConversion(detail);

      expect(detail.nuAmountDiscountConversion).toBe(0);
    });

    it('recalculates conversion when faltante local is positive', () => {
      service.collection = {
        coCurrency: 'VES',
        nuValueLocal: 2,
      } as any;
      spyOn(service, 'convertirMonto').and.returnValue(50);

      const detail = {
        nuAmountDiscount: 100,
        nuAmountDiscountConversion: 0,
      } as CollectionDetail;

      service.syncCollectionDetailDiscountConversion(detail);

      expect(service.convertirMonto).toHaveBeenCalled();
      expect(detail.nuAmountDiscountConversion).toBe(50);
    });

    it('does not throw when this.collection is undefined (batch/sync path)', () => {
      (service as any).collection = undefined;
      spyOn(service, 'convertirMonto').and.returnValue(12);

      const detail = {
        nuAmountDiscount: 100,
        nuAmountDiscountConversion: 5,
        nuValueLocal: 36,
        coOriginal: 'USD',
      } as unknown as CollectionDetail;

      expect(() =>
        service.syncCollectionDetailDiscountConversion(detail, 36, 'USD'),
      ).not.toThrow();
      expect(service.convertirMonto).toHaveBeenCalledWith(100, 36, 'USD');
      expect(detail.nuAmountDiscountConversion).toBe(12);
    });
  });

  describe('COB-UX-SEND-002 Enviar prerequisites (doc + payment by coType)', () => {
    function assignDocument(): void {
      service.collection = {
        ...(service.collection ?? {}),
        collectionDetails: [{
          idDocument: 1,
          coDocument: 'FAC-1',
        } as CollectionDetail],
        collectionPayments: service.collection?.collectionPayments ?? [],
      } as any;
      service.documentSales = [{
        isSelected: true,
        positionCollecDetails: 0,
      } as DocumentSale];
    }

    function assignPayment(): void {
      service.collection = {
        ...(service.collection ?? {}),
        collectionDetails: service.collection?.collectionDetails ?? [],
        collectionPayments: [{
          coPaymentMethod: 'ef',
          coType: 'ef',
          nuAmountPartial: 0,
        } as any],
      } as any;
    }

    beforeEach(() => {
      service.hideDocuments = false;
      service.hidePayments = false;
      service.documentSales = [];
      service.collection = {
        coType: '0',
        stDelivery: 0,
        stCollection: 0,
        isSave: 0,
        collectionDetails: [],
        collectionPayments: [],
      } as any;
      service.sendBlockedByFields = false;
      service.disableSendButton = false;
    });

    it('COB-UX-SEND-002: normal cobro requires document and payment', () => {
      expect(service.hasSendPrerequisites()).toBeFalse();

      assignDocument();
      expect(service.hasSendPrerequisites()).toBeFalse();

      assignPayment();
      expect(service.hasSendPrerequisites()).toBeTrue();
    });

    it('COB-UX-SEND-002: anticipo (coType 1) requires payment only', () => {
      service.hideDocuments = true;
      service.collection.coType = '1';

      expect(service.hasSendPrerequisites()).toBeFalse();

      assignPayment();
      expect(service.hasSendPrerequisites()).toBeTrue();
    });

    it('COB-UX-SEND-002: retención (coType 2) requires document only', () => {
      service.hidePayments = true;
      service.collection.coType = '2';

      expect(service.hasSendPrerequisites()).toBeFalse();

      assignDocument();
      expect(service.hasSendPrerequisites()).toBeTrue();
    });

    it('updateSendButtonAvailability disables Enviar until prerequisites met', () => {
      service.updateSendButtonAvailability();
      expect(service.disableSendButton).toBeTrue();

      assignDocument();
      assignPayment();
      service.updateSendButtonAvailability();
      expect(service.disableSendButton).toBeFalse();
    });

    it('resetSendValidationUx does not enable Enviar without prerequisites', () => {
      service.resetSendValidationUx();
      expect(service.sendValidationAttempted).toBeFalse();
      expect(service.sendBlockedByFields).toBeFalse();
      expect(service.disableSendButton).toBeTrue();
    });

    it('sendBlockedByFields keeps Enviar disabled even with prerequisites', () => {
      assignDocument();
      assignPayment();
      service.sendBlockedByFields = true;
      service.updateSendButtonAvailability();
      expect(service.disableSendButton).toBeTrue();
    });

    it('refreshSendBlockedState re-enables Enviar when prerequisites met', () => {
      assignDocument();
      assignPayment();
      service.sendBlockedByFields = true;

      service.refreshSendBlockedState();

      expect(service.sendBlockedByFields).toBeFalse();
      expect(service.disableSendButton).toBeFalse();
    });

    it('refreshSendBlockedState stays disabled when prerequisites lost after unblock', () => {
      service.sendBlockedByFields = true;

      service.refreshSendBlockedState();

      expect(service.sendBlockedByFields).toBeFalse();
      expect(service.disableSendButton).toBeTrue();
    });

    it('COB-SEND-UX-002: markCollectionDirty re-enables Enviar tras fallo al pulsar', () => {
      service.hidePayments = true;
      service.collection.coType = '2';
      assignDocument();
      service.sendBlockedByFields = true;
      service.updateSendButtonAvailability();
      expect(service.disableSendButton).toBeTrue();

      service.markCollectionDirty();
      expect(service.sendBlockedByFields).toBeFalse();
      expect(service.disableSendButton).toBeFalse();
    });
  });

  describe('COB-SEND-UX-003 Enviar refresh and doc prerequisite by coType', () => {
    function assignInMemoryDocument(coType: string): void {
      service.collection = {
        coType,
        stDelivery: 0,
        stCollection: 0,
        isSave: 0,
        collectionDetails: [{
          coDocument: 'FAC-TOTAL-1',
          idDocument: 0,
        } as CollectionDetail],
        collectionPayments: [],
      } as any;
      service.documentSales = [];
    }

    function assignCompleteRetentionDetail(): CollectionDetail {
      return {
        coDocument: 'FAC-R1',
        nuAmountRetention: 10,
        nuAmountRetention2: 0,
        nuVoucherRetention: '1234567890',
        daVoucher: '2026-08-01',
        collectionDetailRetentions: [{
          idCollectRetention: 1,
          nuAmountRetention: 10,
          nuVoucherRetention: '1234567890',
          daVoucherRetention: '2026-08-01',
        }],
      } as CollectionDetail;
    }

    beforeEach(() => {
      service.hideDocuments = false;
      service.hidePayments = false;
      service.sendBlockedByFields = false;
      service.disableSendButton = true;
    });

    it('COB-SEND-UX-003a: coType 0 accepts collectionDetails without documentSales selection', () => {
      assignInMemoryDocument('0');
      expect(service.hasAssignedDocumentForSendUx()).toBeTrue();
      service.updateSendButtonAvailability();
      expect(service.disableSendButton).toBeTrue();
      service.collection.collectionPayments = [{
        coPaymentMethod: 'ef',
        coType: 'ef',
        nuAmountPartial: 10,
      } as any];
      service.updateSendButtonAvailability();
      expect(service.disableSendButton).toBeFalse();
    });

    it('COB-SEND-UX-003a: coType 3 and 4 same in-memory doc rule', () => {
      for (const coType of ['3', '4']) {
        assignInMemoryDocument(coType);
        expect(service.hasAssignedDocumentForSendUx()).toBeTrue();
      }
    });

    it('COB-SEND-UX-003b: coType 1 requires payment only', () => {
      service.hideDocuments = true;
      service.collection = {
        coType: '1',
        collectionDetails: [],
        collectionPayments: [],
      } as any;
      expect(service.hasSendPrerequisites()).toBeFalse();
      service.collection.collectionPayments = [{
        coPaymentMethod: 'ef',
        coType: 'ef',
        nuAmountPartial: 5,
      } as any];
      expect(service.hasSendPrerequisites()).toBeTrue();
    });

    it('COB-SEND-UX-003: refreshSendUxAfterEdit clears sendBlocked and enables when prerequisites met', () => {
      service.hidePayments = true;
      assignInMemoryDocument('2');
      service.sendBlockedByFields = true;
      service.updateSendButtonAvailability();
      expect(service.disableSendButton).toBeTrue();

      service.refreshSendUxAfterEdit();
      expect(service.sendBlockedByFields).toBeFalse();
      expect(service.disableSendButton).toBeFalse();
    });

    it('COB-RET-SEND-002: coType 2 two complete details enable Enviar', () => {
      service.hidePayments = true;
      service.dynamicRetentions = true;
      service.collectRetentions = [{
        idCollectRetention: 1,
        requireInput: true,
        nuVoucherLength: 10,
      } as any];
      service.collection = {
        coType: '2',
        collectionDetails: [
          assignCompleteRetentionDetail(),
          { ...assignCompleteRetentionDetail(), coDocument: 'FAC-R2' },
        ],
      } as any;
      service.sendBlockedByFields = false;
      service.updateSendButtonAvailability();
      expect(service.hasSendPrerequisites()).toBeTrue();
      expect(service.disableSendButton).toBeFalse();
    });

    it('COB-RET-SEND-004: coType 2 second detail via Total (collectionDetails only)', () => {
      service.hidePayments = true;
      service.collection = {
        coType: '2',
        stDelivery: 0,
        stCollection: 0,
        isSave: 0,
        collectionDetails: [
          assignCompleteRetentionDetail(),
          { ...assignCompleteRetentionDetail(), coDocument: 'FAC-MANUAL-2' },
        ],
      } as any;
      service.documentSales = [];
      expect(service.hasAssignedDocumentForSendUx()).toBeTrue();
      expect(service.hasSendPrerequisites()).toBeTrue();
    });
  });

  describe('COB-SESSION-001 Nuevo Cobro idéntico desde 0 tras enviar', () => {
    interface NewSessionSnapshot {
      sendBlockedByFields: boolean;
      sendValidationAttempted: boolean;
      lastValidToSend: boolean;
      lastSendIssues: unknown[];
      retentionSendFocusDocIndex: number | null;
      collectionPersistedBaseline: boolean;
      collectionDirtySincePersist: boolean;
      cobro25: boolean;
      hidePayments: boolean;
      hideDocuments: boolean;
      isAnticipo: boolean;
      isRetention: boolean;
      newCollect: boolean;
      initCollect: boolean;
      disableSendButton: boolean;
      tabSelected: string;
      documentSalesLength: number;
    }

    function captureNewSessionSnapshot(): NewSessionSnapshot {
      return {
        sendBlockedByFields: service.sendBlockedByFields,
        sendValidationAttempted: service.sendValidationAttempted,
        lastValidToSend: service.lastValidToSend,
        lastSendIssues: [...service.lastSendIssues],
        retentionSendFocusDocIndex: service.retentionSendFocusDocIndex,
        collectionPersistedBaseline: service.collectionPersistedBaseline,
        collectionDirtySincePersist: service.collectionDirtySincePersist,
        cobro25: service.cobro25,
        hidePayments: service.hidePayments,
        hideDocuments: service.hideDocuments,
        isAnticipo: service.isAnticipo,
        isRetention: service.isRetention,
        newCollect: service.newCollect,
        initCollect: service.initCollect,
        disableSendButton: service.disableSendButton,
        tabSelected: service.tabSelected,
        documentSalesLength: service.documentSales.length,
      };
    }

    function simulatePostSendDirtyState(): void {
      service.applyPersistSucceededBaseline();
      service.sendBlockedByFields = true;
      service.lastValidToSend = false;
      service.lastSendIssues = [{ message: 'Error', tab: 'pagos' } as any];
      service.retentionSendFocusDocIndex = 2;
      service.cobro25 = true;
      service.hidePayments = true;
      service.isRetention = true;
      service.collection = {
        coType: '2',
        collectionDetails: [{ coDocument: 'FAC-OLD' }],
        collectionPayments: [{ coPaymentMethod: 'ef', nuAmountPartial: 100 }],
      } as any;
      service.documentSales = [{ coDocument: 'FAC-OLD', isSelected: true } as any];
    }

    it('COB-SESSION-001a: beginNewCollectionSession(0) matches fresh baseline', () => {
      service.beginNewCollectionSession(0);
      const baseline = captureNewSessionSnapshot();

      expect(baseline.sendBlockedByFields).toBeFalse();
      expect(baseline.disableSendButton).toBeTrue();
      expect(baseline.newCollect).toBeTrue();
      expect(baseline.initCollect).toBeTrue();
      expect(baseline.hidePayments).toBeFalse();
      expect(baseline.cobro25).toBeFalse();
      expect(baseline.documentSalesLength).toBe(0);
    });

    it('COB-SESSION-001b: post-send dirty state resets to same baseline on new cobro', () => {
      service.beginNewCollectionSession(0);
      const baseline = captureNewSessionSnapshot();

      simulatePostSendDirtyState();
      service.beginNewCollectionSession(0);
      const afterReset = captureNewSessionSnapshot();

      expect(afterReset).toEqual(baseline);
    });

    it('COB-SESSION-001c: retention then IGTF restores hidePayments', () => {
      simulatePostSendDirtyState();
      service.beginNewCollectionSession(3);

      expect(service.hidePayments).toBeFalse();
      expect(service.hideDocuments).toBeFalse();
      expect(service.isRetention).toBeFalse();
      expect(service.coTypeModule).toBe('3');
    });

    it('COB-SESSION-001d: cobro25 then normal clears cobro25 flag', () => {
      service.beginNewCollectionSession(4);
      expect(service.cobro25).toBeTrue();

      simulatePostSendDirtyState();
      service.beginNewCollectionSession(0);
      expect(service.cobro25).toBeFalse();
    });

    it('COB-SESSION-001e: resetCollectionSessionState clears send issues without new session', () => {
      simulatePostSendDirtyState();
      service.resetCollectionSessionState();

      expect(service.sendBlockedByFields).toBeFalse();
      expect(service.lastSendIssues).toEqual([]);
      expect(service.collectionPersistedBaseline).toBeFalse();
      expect(service.documentSales.length).toBe(0);
    });
  });

  describe('COB-SESSION-002 reset cobro cubierto entre sesiones', () => {
    it('resetCobroPaymentCoverageSessionState limpia remanente y flags de cobertura', () => {
      service.discountRemnantPrepaidByDocument.set('FAC-OLD', 50);
      service.discountRemnantPrepaidAmount = 50;
      service.isFullyCoveredCollection = true;
      service.efectivoRequerido = 0;
      service.creditBalancePrepaidAmount = 50;
      service.createAutomatedPrepaid = true;
      service.anticipoAutomatico = [{ type: 'ot', posCollectionPayment: 0 }];

      service.resetCobroPaymentCoverageSessionState();

      expect(service.discountRemnantPrepaidByDocument.size).toBe(0);
      expect(service.discountRemnantPrepaidAmount).toBe(0);
      expect(service.isFullyCoveredCollection).toBeFalse();
      expect(service.efectivoRequerido).toBe(0);
      expect(service.creditBalancePrepaidAmount).toBe(0);
      expect(service.createAutomatedPrepaid).toBeFalse();
      expect(service.anticipoAutomatico).toEqual([]);
    });

    it('COB-SESSION-002: beginNewCollectionSession no arrastra remanente de cobro anterior', () => {
      service.discountRemnantPrepaidByDocument.set('FAC-OLD', 50);
      service.discountRemnantPrepaidAmount = 50;
      service.createAutomatedPrepaid = true;
      service.isFullyCoveredCollection = true;

      service.beginNewCollectionSession(0);

      expect(service.discountRemnantPrepaidByDocument.size).toBe(0);
      expect(service.hasConfirmedDiscountRemnantPrepaid()).toBeFalse();
      expect(service.createAutomatedPrepaid).toBeFalse();
      expect(service.isFullyCoveredCollection).toBeFalse();
    });

    it('COB-SESSION-002b: initCollection limpia remanente stale', () => {
      service.discountRemnantPrepaidByDocument.set('FAC-OLD', 80);
      service.discountRemnantPrepaidAmount = 80;
      service.coTypeModule = '0';

      service.initCollection({} as any);

      expect(service.discountRemnantPrepaidByDocument.size).toBe(0);
      expect(service.hasConfirmedDiscountRemnantPrepaid()).toBeFalse();
    });
  });

  describe('COB-TAB-GENERAL-001 General tab remount', () => {
    it('beginNewCollectionSession sets initCollect for first mount only', () => {
      service.initCollect = false;
      service.beginNewCollectionSession(0);
      expect(service.initCollect).toBeTrue();
      expect(service.newCollect).toBeTrue();
    });
  });

  describe('COB-INV-COMMENT-001 cleanString', () => {
    it('preserves trailing and internal spaces (no trim on ionInput path)', () => {
      expect(service.cleanString('hola ')).toBe('hola ');
      expect(service.cleanString('hola mundo')).toBe('hola mundo');
      expect(service.cleanString('  hola')).toBe('  hola');
    });

    it('still strips ; \' " characters', () => {
      expect(service.cleanString(`hola;"'mundo"`)).toBe('holamundo');
    });
  });
});
