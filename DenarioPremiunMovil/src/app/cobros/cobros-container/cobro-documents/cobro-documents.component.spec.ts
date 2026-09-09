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
      collectDiscounts: [],
      totalCollectDiscountsSelected: 0,
      maxCollectDiscount: 100,
      mensaje: '',
      discountRemnantPrepaidByDocument: new Map(),
      discountRemnantPrepaidAmount: 0,
      setDiscountRemnantPrepaidForDocument: jasmine.createSpy('setDiscountRemnantPrepaidForDocument'),
      clearDiscountRemnantPrepaidForDocument: jasmine.createSpy('clearDiscountRemnantPrepaidForDocument'),
      convertCollectionAmountToPrepaidCurrency: jasmine.createSpy('convertCollectionAmountToPrepaidCurrency')
        .and.callFake((n: number) => n),
      buildDiscountRemnantPrepaidMessage: jasmine.createSpy('buildDiscountRemnantPrepaidMessage')
        .and.callFake((n: number) => `¿anticipo ${n}?`),
      ensureAutomatedPrepaidPaymentTemplate: jasmine.createSpy('ensureAutomatedPrepaidPaymentTemplate'),
      collection: {
        collectionDetails: [],
      },
      documentSaleOpen: null,
      collectionTags: new Map(),
      collectionTagsDenario: new Map([['DENARIO_BOTON_ACEPTAR', 'Aceptar'], ['DENARIO_BOTON_CANCELAR', 'Cancelar']]),
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

  describe('COB-DISC-002 maxCollectDiscount', () => {
    beforeEach(() => {
      collectServiceMock.maxCollectDiscount = 10;
      collectServiceMock.totalCollectDiscountsSelected = 0;
      collectServiceMock.tempSelectedCollectDiscounts = [];
      collectServiceMock.collectDiscounts = [
        { idCollectDiscount: 1, nuCollectDiscount: 8, naCollectDiscount: 'D8', requireInput: false },
        { idCollectDiscount: 2, nuCollectDiscount: 5, naCollectDiscount: 'D5', requireInput: false },
        { idCollectDiscount: 3, nuCollectDiscount: null, naCollectDiscount: null, requireInput: true },
      ];
      collectServiceMock.collectionTags = new Map();
      collectServiceMock.mensaje = '';
      component.alertMessageOpen = false;
      spyOn(component as any, 'validateCollectDiscountsInputs').and.stub();
    });

    it('rechaza segundo descuento que supera el tope y no lo agrega', () => {
      component.toggleTempSelection(1);
      expect(collectServiceMock.tempSelectedCollectDiscounts.length).toBe(1);
      expect(collectServiceMock.totalCollectDiscountsSelected).toBe(8);

      component.toggleTempSelection(2);
      expect(collectServiceMock.tempSelectedCollectDiscounts.length).toBe(1);
      expect(collectServiceMock.totalCollectDiscountsSelected).toBe(8);
      expect(component.alertMessageOpen).toBeTrue();
      expect(collectServiceMock.mensaje).toContain('10');
      expect(collectServiceMock.mensaje).toContain('2');
    });

    it('destilda el último descuento que excede maxCollectDiscount (20% + 65% con tope 80%)', () => {
      collectServiceMock.maxCollectDiscount = 80;
      collectServiceMock.collectDiscounts = [
        { idCollectDiscount: 10, nuCollectDiscount: 20, naCollectDiscount: 'D20', requireInput: false },
        { idCollectDiscount: 11, nuCollectDiscount: 65, naCollectDiscount: 'D65', requireInput: false },
      ];

      component.toggleTempSelection(10);
      expect(collectServiceMock.tempSelectedCollectDiscounts.map((d: any) => d.idCollectDiscount))
        .toEqual([10]);
      expect(collectServiceMock.totalCollectDiscountsSelected).toBe(20);

      const checkbox = { checked: true } as HTMLIonCheckboxElement;
      const event = { detail: { checked: true }, target: checkbox } as unknown as CustomEvent;
      component.toggleTempSelection(11, event);

      expect(collectServiceMock.tempSelectedCollectDiscounts.map((d: any) => d.idCollectDiscount))
        .toEqual([10]);
      expect(collectServiceMock.totalCollectDiscountsSelected).toBe(20);
      expect(checkbox.checked).toBeFalse();
      expect(component.alertMessageOpen).toBeTrue();
    });

    it('setNu que excede quita el descuento y muestra disponible', () => {
      collectServiceMock.tempSelectedCollectDiscounts = [
        { idCollectDiscount: 1, nuCollectDiscount: 8, naCollectDiscount: 'D8', requireInput: false },
        { idCollectDiscount: 3, nuCollectDiscount: 0, naCollectDiscount: null, requireInput: true },
      ];
      collectServiceMock.totalCollectDiscountsSelected = 8;

      component.setNuCollectDiscount(3, 5);

      expect(collectServiceMock.tempSelectedCollectDiscounts.some(
        (d: any) => d.idCollectDiscount === 3,
      )).toBeFalse();
      expect(collectServiceMock.totalCollectDiscountsSelected).toBe(8);
      expect(component.alertMessageOpen).toBeTrue();
      expect(collectServiceMock.mensaje).toContain('2');
    });

    it('getRemainingCollectDiscountPercent respeta maxCollectDiscount', () => {
      collectServiceMock.totalCollectDiscountsSelected = 7;
      expect(component.getRemainingCollectDiscountPercent()).toBe(3);
      expect(component.getMaxCollectDiscountPercent()).toBe(10);
    });
  });

  describe('COB-DISC-003 discount remnant prepaid', () => {
    beforeEach(() => {
      collectServiceMock.convertirMonto = jasmine.createSpy('convertirMonto').and.callFake((n: number) => n);
      collectServiceMock.documentSaleOpen = {
        coDocument: 'FAC-1',
        nuAmountBase: 100,
        nuAmountDiscount: 0,
        coCurrency: 'USD',
        nuAmountRetention: 0,
        nuAmountRetention2: 0,
        positionCollecDetails: 0,
      };
      collectServiceMock.collection = {
        coCurrency: 'USD',
        nuValueLocal: 1,
        collectionDetails: [{ coDocument: 'FAC-1', nuAmountDiscount: 0 }],
      };
      collectServiceMock.documentSalesView = [{ nuBalance: 100, coDocument: 'FAC-1' }];
      collectServiceMock.selectedCollectDiscounts = [];
      collectServiceMock.tempSelectedCollectDiscounts = [];
      collectServiceMock.collectDiscounts = [];
      (component as any).indexDocumentSaleOpen = 0;
      (component as any).manualCollectDiscountAmount = 150;
      spyOn(component as any, 'calculateSaldo').and.resolveTo(undefined);
      spyOn(component, 'applyCollectDiscounts').and.resolveTo(undefined);
    });

    it('accept con remanente abre confirmación y no aplica aún', async () => {
      await component.acceptCollectDiscounts();

      expect(component.alertDiscountRemnantOpen).toBeTrue();
      expect(collectServiceMock.buildDiscountRemnantPrepaidMessage).toHaveBeenCalledWith(50);
      expect(component.applyCollectDiscounts).not.toHaveBeenCalled();
    });

    it('confirm Sí aplica full y registra remanente', async () => {
      (component as any).pendingDiscountRemnantInCollection = 50;
      await component.setResultDiscountRemnant({ detail: { role: 'confirm' } });

      expect(component.applyCollectDiscounts).toHaveBeenCalledWith({ clampToBalance: false });
      expect(collectServiceMock.setDiscountRemnantPrepaidForDocument)
        .toHaveBeenCalledWith('FAC-1', 50);
      expect(collectServiceMock.ensureAutomatedPrepaidPaymentTemplate).toHaveBeenCalled();
      expect(component.assignDiscountsOpen).toBeFalse();
    });

    it('confirm No vuelve al modal de descuentos sin aplicar', async () => {
      component.assignDiscountsOpen = false;
      (component as any).pendingDiscountRemnantInCollection = 50;
      await component.setResultDiscountRemnant({ detail: { role: 'cancel' } });

      expect(component.applyCollectDiscounts).not.toHaveBeenCalled();
      expect(collectServiceMock.clearDiscountRemnantPrepaidForDocument)
        .toHaveBeenCalledWith('FAC-1');
      expect(component.assignDiscountsOpen).toBeTrue();
    });

    it('computeCollectDiscountPreview: saldo 100 descuento 150 → remanente 50', () => {
      const preview = component.computeCollectDiscountPreview(false);
      expect(preview?.baseBalance).toBe(100);
      expect(preview?.discountTotal).toBe(150);
      expect(preview?.remnantInCollectionCurrency).toBe(50);

      const clamped = component.computeCollectDiscountPreview(true);
      expect(clamped?.discountTotal).toBe(100);
      expect(clamped?.remnantInCollectionCurrency).toBe(0);
    });
  });
});
