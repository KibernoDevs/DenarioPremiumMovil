import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { CobrosDocumentComponent } from './cobro-documents.component';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { ClienteSelectorService } from 'src/app/cliente-selector/cliente-selector.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';

describe('CobrosDocumentComponent', () => {
  let component: CobrosDocumentComponent;
  let fixture: ComponentFixture<CobrosDocumentComponent>;
  let collectServiceMock: any;
  let globalConfigMock: { get: jasmine.Spy };

  beforeEach(waitForAsync(() => {
    globalConfigMock = {
      get: jasmine.createSpy('get').and.returnValue(undefined),
    };
    collectServiceMock = {
      documentSales: [],
      documentSalesBackup: [],
      documentSalesView: [],
      documentSalesPageIds: new Set<number>(),
      documentsSaleComponent: false,
      isPaymentPartial: false,
      alwaysPartialPayment: false,
      isChangePaymentPartialPersistence: false,
      selectedCollectDiscounts: [1],
      tempSelectedCollectDiscounts: [{ idCollectDiscount: 1 }],
      prevSelectedCollectDiscounts: [1],
      collection: {
        collectionDetails: [],
      },
      documentSaleOpen: null,
      collectionTags: new Map(),
      collectionTagsDenario: new Map([['DENARIO_BOTON_ACEPTAR', 'Aceptar']]),
    };

    TestBed.configureTestingModule({
      declarations: [CobrosDocumentComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: CollectionService, useValue: collectServiceMock },
        { provide: ClienteSelectorService, useValue: {} },
        { provide: GlobalConfigService, useValue: globalConfigMock },
        { provide: CurrencyService, useValue: { formatNumber: (n: number) => String(n) } },
        {
          provide: DateServiceService,
          useValue: { hoyISO: () => '2026-08-04' },
        },
        { provide: SynchronizationDBService, useValue: { getDatabase: () => ({}) } },
        { provide: ClientLogicService, useValue: {} },
        { provide: MessageService, useValue: {} },
        {
          provide: ChangeDetectorRef,
          useValue: { detectChanges: () => undefined, markForCheck: () => undefined },
        },
      ],
    })
      .overrideComponent(CobrosDocumentComponent, { set: { template: '' } })
      .compileComponents();

    spyOn(CobrosDocumentComponent.prototype, 'ngOnInit').and.stub();
    spyOn(CobrosDocumentComponent.prototype, 'ngAfterViewInit').and.stub();
    fixture = TestBed.createComponent(CobrosDocumentComponent);
    component = fixture.componentInstance;
    (component as any).cdr = {
      detectChanges: () => undefined,
      markForCheck: () => undefined,
    };
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('P2: applyDocumentFilter keeps only page docs matching currency', () => {
    collectServiceMock.documentSales = [
      { idDocument: 1, coCurrency: 'USD' },
      { idDocument: 2, coCurrency: 'VES' },
      { idDocument: 3, coCurrency: 'USD' },
    ] as DocumentSale[];
    collectServiceMock.documentSalesPageIds = new Set([1, 2]);

    (component as any).applyDocumentFilter('USD', false);

    expect(component.filteredDocumentsView.map(d => d.idDocument)).toEqual([1]);
    expect(collectServiceMock.documentsSaleComponent).toBeTrue();
  });

  it('P2: syncDocumentPaymentPartialState marks detail and document as partial', () => {
    collectServiceMock.documentSales = [{
      idDocument: 9,
      inPaymentPartial: false,
      positionCollecDetails: 0,
    }] as DocumentSale[];
    collectServiceMock.documentSalesBackup = [{
      idDocument: 9,
      inPaymentPartial: false,
    }] as DocumentSale[];
    collectServiceMock.documentSalesView = [{
      idDocument: 9,
      inPaymentPartial: false,
    }] as DocumentSale[];
    collectServiceMock.collection.collectionDetails = [{
      idDocument: 9,
      inPaymentPartial: false,
    }];
    collectServiceMock.documentSaleOpen = {
      idDocument: 9,
      inPaymentPartial: false,
      positionCollecDetails: 0,
    };

    (component as any).syncDocumentPaymentPartialState(0, 0, true);

    expect(collectServiceMock.isPaymentPartial).toBeTrue();
    expect(collectServiceMock.documentSales[0].inPaymentPartial).toBeTrue();
    expect(collectServiceMock.collection.collectionDetails[0].inPaymentPartial).toBeTrue();
    expect(collectServiceMock.documentSaleOpen.inPaymentPartial).toBeTrue();
  });

  it('COB-DISC-001: clearDocumentDiscountUiState resets shared discount buffers', () => {
    (component as any).manualCollectDiscountAmount = 8;
    (component as any).manualCollectDiscountAmountBackup = 8;
    (component as any).centsManualCollectDiscount = 800;
    (component as any).displayManualCollectDiscount = '8,00';
    (component as any).assignDiscountsOpen = true;

    (component as any).clearDocumentDiscountUiState();

    expect((component as any).manualCollectDiscountAmount).toBe(0);
    expect((component as any).manualCollectDiscountAmountBackup).toBe(0);
    expect((component as any).centsManualCollectDiscount).toBeUndefined();
    expect((component as any).displayManualCollectDiscount).toBe('');
    expect((component as any).assignDiscountsOpen).toBeFalse();
    expect(collectServiceMock.selectedCollectDiscounts).toEqual([]);
    expect(collectServiceMock.tempSelectedCollectDiscounts).toEqual([]);
    expect(collectServiceMock.prevSelectedCollectDiscounts).toEqual([]);
  });

  it('COB-DISC-001: checkCollectDiscount keeps manual amount 0 when detail has no discounts', () => {
    (component as any).manualCollectDiscountAmount = 8;
    collectServiceMock.documentSaleOpen = {
      coDocument: 'FF082165',
      positionCollecDetails: 0,
    };
    collectServiceMock.collection.collectionDetails = [{
      coDocument: 'FF082165',
      collectionDetailDiscounts: [],
    }];

    component.checkCollectDiscount();

    expect((component as any).manualCollectDiscountAmount).toBe(0);
    expect(collectServiceMock.selectedCollectDiscounts).toEqual([]);
  });

  it('COB-FALT-001: validate enables Guardar when faltante is 0 and amountPaid is valid', () => {
    collectServiceMock.coTypeModule = '0';
    collectServiceMock.isPaymentPartial = false;
    collectServiceMock.alwaysPartialPayment = false;
    collectServiceMock.enablePartialPayment = true;
    collectServiceMock.isChangePaymentPartial = false;
    collectServiceMock.validNuRetention = false;
    collectServiceMock.retencion = false;
    collectServiceMock.amountPaid = 500;
    collectServiceMock.amountPaidDoc = 500;
    collectServiceMock.indexDocumentSaleOpen = 0;
    collectServiceMock.parteDecimal = 2;
    collectServiceMock.documentSaleOpen = {
      positionCollecDetails: 0,
      nuAmountRetention: 0,
      nuAmountRetention2: 0,
      nuAmountTax: 0,
      nuAmountBase: 500,
      nuAmountPaid: 500,
      nuBalance: 500,
    };
    collectServiceMock.documentSales = [{
      idDocument: 1,
      isSave: true,
      nuAmountPaid: 500,
      positionCollecDetails: 0,
    }];
    collectServiceMock.documentSalesBackup = [{
      idDocument: 1,
      nuBalance: 500,
      nuAmountPaid: 500,
      isSave: true,
    }];
    collectServiceMock.collection.collectionDetails = [{
      idDocument: 1,
      nuAmountDiscount: 0,
      nuAmountCollectDiscount: 0,
      nuAmountRetention: 0,
      nuAmountRetention2: 0,
      nuBalanceDoc: 500,
      nuAmountPaid: 400,
      inPaymentPartial: false,
      isSave: true,
    }];
    collectServiceMock.collectionTags = new Map();
    collectServiceMock.ensureNumber = jasmine.createSpy('ensureNumber');
    collectServiceMock.convertirMonto = jasmine.createSpy('convertirMonto').and.callFake((n: number) => n);
    collectServiceMock.calculatePayment = jasmine.createSpy('calculatePayment').and.resolveTo(false);
    spyOn(component as any, 'syncOpenDocumentAmountPaidWithRetentions').and.stub();
    spyOn(component as any, 'resolveOpenDocumentMaxAmountToPay').and.returnValue(500);
    spyOn(component as any, 'exceedsMaxAmountToPay').and.returnValue(false);
    spyOn(component as any, 'isEmptyOrZeroRetention').and.returnValue(false);
    spyOn(component as any, 'getDocumentRetentionTotal').and.returnValue(0);
    spyOn(component as any, 'isCollectRetentionEntryInProgress').and.returnValue(false);
    spyOn(component as any, 'shouldSkipSendValidationOnPaymentRecalc').and.returnValue(false);
    spyOn(component as any, 'validateOpenDocumentRetentionTotals').and.returnValue(true);
    (component as any).currencyService = {
      cleanFormattedNumber: (v: string | number) => Number(v) || 0,
      formatNumber: (n: number) => String(n ?? 0),
    };

    (component as any).validate();

    expect(component.disabledSaveButton).toBeFalse();
    expect(collectServiceMock.calculatePayment).toHaveBeenCalledWith('', 0, true, false);
    expect(collectServiceMock.collection.collectionDetails[0].nuAmountPaid).toBe(500);
  });

  it('COB-FALT-001: syncOpenDetailNuAmountPaidFromAmountPaid updates detail net', () => {
    collectServiceMock.coTypeModule = '0';
    collectServiceMock.isPaymentPartial = false;
    collectServiceMock.amountPaid = 500;
    collectServiceMock.collection = {
      nuValueLocal: 1,
      coCurrency: 'USD',
      collectionDetails: [{ nuAmountPaid: 400, nuAmountPaidConversion: 400 }],
    };
    collectServiceMock.documentSaleOpen = { positionCollecDetails: 0 };
    collectServiceMock.convertirMonto = jasmine.createSpy('convertirMonto').and.callFake((n: number) => n);

    (component as any).syncOpenDetailNuAmountPaidFromAmountPaid();

    expect(collectServiceMock.collection.collectionDetails[0].nuAmountPaid).toBe(500);
    expect(collectServiceMock.collection.collectionDetails[0].nuAmountPaidConversion).toBe(500);
  });

  it('COB-RET-SEND-001: shouldShowDocumentRetentionSendError after send attempt', () => {
    collectServiceMock.sendValidationAttempted = true;
    collectServiceMock.collection = {
      coType: '2',
      collectionDetails: [{ coDocument: 'FAC-1', nuAmountRetention: 0, nuAmountRetention2: 0 }],
    };
    collectServiceMock.documentSales = [{
      isSelected: true,
      positionCollecDetails: 0,
    }];
    collectServiceMock.isRetentionDetailComplete = jasmine.createSpy('isRetentionDetailComplete').and.returnValue(false);

    expect(component.shouldShowDocumentRetentionSendError(0)).toBeTrue();

    collectServiceMock.sendValidationAttempted = false;
    expect(component.shouldShowDocumentRetentionSendError(0)).toBeFalse();
  });

  describe('COB-PARTIAL-001 pago parcial por documento', () => {
    it('documento nuevo no hereda el toggle parcial del documento anterior', () => {
      collectServiceMock.alwaysPartialPayment = false;
      collectServiceMock.isChangePaymentPartialPersistence = true;
      collectServiceMock.isPaymentPartial = true;

      const result = (component as any).resolvePartialPaymentForOpenDocument(
        { inPaymentPartial: false, isSave: false },
        { inPaymentPartial: false, isSave: false },
      );

      expect(result).toBeFalse();
    });

    it('documento con parcial editado conserva su propio flag', () => {
      collectServiceMock.alwaysPartialPayment = false;
      collectServiceMock.isChangePaymentPartialPersistence = false;
      collectServiceMock.isPaymentPartial = false;

      const result = (component as any).resolvePartialPaymentForOpenDocument(
        { inPaymentPartial: true, isSave: false },
        { inPaymentPartial: true, isSave: false },
      );

      expect(result).toBeTrue();
    });

    it('documento guardado usa inPaymentPartial persistido', () => {
      collectServiceMock.alwaysPartialPayment = false;

      const result = (component as any).resolvePartialPaymentForOpenDocument(
        { inPaymentPartial: true, isSave: true },
        { inPaymentPartial: false, isSave: true },
      );

      expect(result).toBeTrue();
    });
  });
});
