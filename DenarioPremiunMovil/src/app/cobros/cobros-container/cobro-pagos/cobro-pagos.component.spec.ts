import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { CobroPagosComponent } from './cobro-pagos.component';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';

describe('CobroPagosComponent', () => {
  let component: CobroPagosComponent;
  let fixture: ComponentFixture<CobroPagosComponent>;
  let collectionServiceMock: any;

  beforeEach(waitForAsync(() => {
    collectionServiceMock = {
      montoTotalPagar: 0,
      disableSendButton: false,
      pagoEfectivo: [],
      pagoCheque: [],
      pagoDeposito: [],
      pagoTransferencia: [],
      pagoMovil: [],
      pagoOtros: [],
      collectionTagsDenario: new Map([['DENARIO_BOTON_ACEPTAR', 'Aceptar']]),
      collection: {
        coCurrency: 'USD',
        collectionPayments: [],
      },
      syncExchangeRateToCollectionHeader: jasmine.createSpy('syncExchangeRateToCollectionHeader').and.returnValue(1),
      convertirMonto: jasmine.createSpy('convertirMonto').and.callFake((amount: number) => amount),
      validateToSend: jasmine.createSpy('validateToSend'),
      notifyCollectionEdited: jasmine.createSpy('notifyCollectionEdited'),
      markCollectionDirty: jasmine.createSpy('markCollectionDirty'),
      updateSendButtonAvailability: jasmine.createSpy('updateSendButtonAvailability'),
      refreshSendBlockedState: jasmine.createSpy('refreshSendBlockedState'),
      refreshSendUxAfterEdit: jasmine.createSpy('refreshSendUxAfterEdit'),
      sendValidationAttempted: false,
      isAddPaymentMethodDisabled: jasmine.createSpy('isAddPaymentMethodDisabled').and.returnValue(false),
      blockSaveAndSendForInvalidPayments: jasmine.createSpy('blockSaveAndSendForInvalidPayments'),
      lengthMethodPaid: 0,
      tiposPago: [],
      dateRate: '2026-08-04',
      validateCollectionDate: false,
      getIndexedPaymentFieldErrors: jasmine.createSpy('getIndexedPaymentFieldErrors').and.returnValue([]),
      collectionTags: new Map<string, string>(),
      cleanString: (value: string) => value,
      buildAutomatedPrepaidMessage: jasmine.createSpy('buildAutomatedPrepaidMessage').and.returnValue('Mensaje anticipo automático'),
      createAutomatedPrepaid: false,
      recentOpenCollect: false,
    };

    TestBed.configureTestingModule({
      declarations: [CobroPagosComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: CollectionService, useValue: collectionServiceMock },
        { provide: CurrencyService, useValue: {} },
        {
          provide: DateServiceService,
          useValue: {
            hoyISO: () => '2026-08-04',
            hoyISOFullTime: () => '2026-08-04 12:00:00',
            toDbDateTime: (value: string) => value,
            normalizeDateRateToDbDateTime: (value: string) => value,
          },
        },
        { provide: GlobalConfigService, useValue: { get: () => undefined } },
      ],
    })
      .overrideComponent(CobroPagosComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(CobroPagosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter banks by normalized name', () => {
    const banks = [
      { naBank: 'Banco Mercantil', coBank: '0105' },
      { naBank: 'Banco Provincial', coBank: '0108' },
    ];
    const searchKey = component.getBankSearchKey('pm', 0, 'banks');

    component.setBankSearchTerm(searchKey, 'mercantil');

    expect(component.getFilteredBanks(banks, searchKey)).toEqual([banks[0]]);
  });

  it('should filter bank accounts by account number or code', () => {
    const bankAccounts = [
      { naBank: 'Banco Nacional', nuAccount: '010200000001', coBank: 'BNC' },
      { naBank: 'Banco Plaza', nuAccount: '013800000002', coBank: 'PLZ' },
    ];
    const searchKey = component.getBankSearchKey('de', 1, 'accounts');

    component.setBankSearchTerm(searchKey, '0138');

    expect(component.getFilteredBanks(bankAccounts, searchKey)).toEqual([bankAccounts[1]]);
  });

  it('should restore the full bank list when the search is cleared', () => {
    const banks = [
      { naBank: 'Banco Mercantil' },
      { naBank: 'Banco Provincial' },
    ];
    const searchKey = component.getBankSearchKey('ch', 0, 'banks');

    component.setBankSearchTerm(searchKey, 'provincial');
    component.clearBankSearch(searchKey);

    expect(component.getFilteredBanks(banks, searchKey)).toEqual(banks);
  });

  it('COB-UX-SEND-001: setMonto refreshes send UX state instead of forcing Enviar OFF', () => {
    collectionServiceMock.disableSendButton = false;
    collectionServiceMock.pagoEfectivo = [{
      monto: 100,
      posCollectionPayment: 0,
      fecha: '',
    }];
    collectionServiceMock.collection.collectionPayments = [{
      coType: 'ef',
      coPaymentMethod: 'ef',
      nuAmountPartial: 100,
      daValue: '',
      daCollectionPayment: '',
    }];
    spyOn(component, 'validatePayment');

    component.setMonto(50, 0, 'ef');

    expect(collectionServiceMock.disableSendButton).toBeFalse();
    expect(collectionServiceMock.pagoEfectivo[0].monto).toBe(50);
    expect(collectionServiceMock.collection.collectionPayments[0].nuAmountPartial).toBe(50);
    expect(component.validatePayment).toHaveBeenCalledWith('ef', 0);
  });

  it('validatePaymentMethodsForSend refreshes send UX after field change', () => {
    component.validatePaymentMethodsForSend();
    expect(collectionServiceMock.refreshSendUxAfterEdit).toHaveBeenCalled();
  });

  it('shouldShowPaymentFieldError is true only after send attempt with field errors', () => {
    collectionServiceMock.sendValidationAttempted = false;
    collectionServiceMock.getIndexedPaymentFieldErrors.and.returnValue(['monto']);
    expect(component.shouldShowPaymentFieldError('ef', 0, 'monto')).toBeFalse();

    collectionServiceMock.sendValidationAttempted = true;
    expect(component.shouldShowPaymentFieldError('ef', 0, 'monto')).toBeTrue();
    expect(component.shouldShowPaymentFieldError('ef', 0, 'fecha')).toBeFalse();
  });

  it('COB-DIFF-001: differenceCode error label after send attempt', () => {
    collectionServiceMock.sendValidationAttempted = true;
    collectionServiceMock.getIndexedPaymentFieldErrors.and.returnValue(['differenceCode']);
    collectionServiceMock.collectionTags = new Map([
      ['COB_MSJ_ERROR_NO_DIFFERENCE_CODE', 'Seleccione código diferencia'],
    ]);

    expect(component.shouldShowPaymentFieldError('ot', 0, 'differenceCode')).toBeTrue();
    expect(component.getDifferenceCodeRequiredFieldLabel()).toContain('código diferencia');
  });

  it('COB-DATE-001: getFechaValor TR writes daValue and daCollectionPayment', () => {
    collectionServiceMock.validateCollectionDate = false;
    collectionServiceMock.pagoTransferencia = [{
      fecha: '2026-08-11',
      posCollectionPayment: 0,
    }];
    collectionServiceMock.collection.collectionPayments = [{
      coType: 'tr',
      coPaymentMethod: 'tr',
      daValue: '2026-08-11 00:00:00',
      daCollectionPayment: '2026-08-11 00:00:00',
    }];

    component.getFechaValor('2026-08-01', 0, 'tr');

    const payment = collectionServiceMock.collection.collectionPayments[0];
    expect(collectionServiceMock.pagoTransferencia[0].fecha).toBe('2026-08-01');
    expect(payment.daValue).toBe('2026-08-01');
    expect(payment.daCollectionPayment).toBe('2026-08-01');
  });

  it('COB-DATE-001: getFechaValor PM writes daValue and daCollectionPayment', () => {
    collectionServiceMock.validateCollectionDate = false;
    collectionServiceMock.pagoMovil = [{
      fecha: '2026-08-11',
      posCollectionPayment: 0,
    }];
    collectionServiceMock.collection.collectionPayments = [{
      coType: 'pm',
      coPaymentMethod: 'pm',
      daValue: '2026-08-11 00:00:00',
      daCollectionPayment: '2026-08-11 00:00:00',
    }];

    component.getFechaValor('2026-08-01', 0, 'pm');

    const payment = collectionServiceMock.collection.collectionPayments[0];
    expect(collectionServiceMock.pagoMovil[0].fecha).toBe('2026-08-01');
    expect(payment.daValue).toBe('2026-08-01');
    expect(payment.daCollectionPayment).toBe('2026-08-01');
  });

  it('COB-UX-SEND-002: addTipoPago refreshes Enviar button availability', () => {
    component.addTipoPago('ef');

    expect(collectionServiceMock.collection.collectionPayments.length).toBe(1);
    expect(collectionServiceMock.updateSendButtonAvailability).toHaveBeenCalled();
  });

  it('COB-PREPAID-003: checkCreateAutomatedPrepaid usa mensaje dedicado aunque mensaje global sea de adjuntos', () => {
    collectionServiceMock.createAutomatedPrepaid = true;
    collectionServiceMock.recentOpenCollect = false;
    collectionServiceMock.mensaje = 'Para poder enviar el Cobro, debe agregar al menos un adjunto';

    component.checkCreateAutomatedPrepaid();

    expect(collectionServiceMock.buildAutomatedPrepaidMessage).toHaveBeenCalled();
    expect(component.automatedPrepaidAlertMessage).toBe('Mensaje anticipo automático');
    expect(component.alertMessageOpen).toBeTrue();
    expect(collectionServiceMock.mensaje).toBe('Para poder enviar el Cobro, debe agregar al menos un adjunto');
  });
});
