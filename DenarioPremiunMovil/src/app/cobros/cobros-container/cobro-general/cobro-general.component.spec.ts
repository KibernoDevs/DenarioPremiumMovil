import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { Subject } from 'rxjs';

import { CobrosGeneralComponent } from './cobro-general.component';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ClientesDatabaseServicesService } from 'src/app/services/clientes/clientes-database-services.service';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { ClienteSelectorService } from 'src/app/cliente-selector/cliente-selector.service';
import { CollectionPayment } from 'src/app/modelos/tables/collection';

describe('CobrosGeneralComponent', () => {
  let component: CobrosGeneralComponent;
  let fixture: ComponentFixture<CobrosGeneralComponent>;
  let collectServiceMock: any;

  beforeEach(waitForAsync(() => {
    collectServiceMock = {
      clientBankAccount: true,
      listBankAccounts: [],
      bankAccountSelected: [],
      clientBankAccounts: [],
      clientBankAccountSelected: [],
      collectionTags: new Map(),
      collectionTagsDenario: new Map([['DENARIO_BOTON_ACEPTAR', 'Aceptar']]),
      collection: {
        stCollection: 0,
        stDelivery: 0,
        coCollection: '',
        nuValueLocal: 0,
      },
      COLLECT_STATUS_NEW: 0,
      COLLECT_STATUS_TO_SEND: 2,
      COLLECT_STATUS_SENT: 3,
      enabledManualRate: false,
      rateSelected: 0,
      loadTypeDocumentList: jasmine.createSpy('loadTypeDocumentList').and.resolveTo(undefined),
      loadCodePhoneNumberList: jasmine.createSpy('loadCodePhoneNumberList').and.resolveTo(undefined),
    };

    TestBed.configureTestingModule({
      declarations: [CobrosGeneralComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: CollectionService, useValue: collectServiceMock },
        {
          provide: DateServiceService,
          useValue: {
            hoyISO: () => '2026-08-04',
            hoyISOFullTime: () => '2026-08-04 12:00:00',
          },
        },
        { provide: EnterpriseService, useValue: {} },
        { provide: GlobalConfigService, useValue: { get: () => undefined } },
        { provide: GeolocationService, useValue: {} },
        { provide: CurrencyService, useValue: {} },
        { provide: MessageService, useValue: {} },
        { provide: ClientesDatabaseServicesService, useValue: {} },
        {
          provide: AdjuntoService,
          useValue: { AttachmentChanged: new Subject<void>() },
        },
        {
          provide: SynchronizationDBService,
          useValue: { getDatabase: () => ({}) },
        },
        {
          provide: ClienteSelectorService,
          useValue: {
            ClientChanged: new Subject<any>(),
            checkClient: false,
          },
        },
      ],
    })
      .overrideComponent(CobrosGeneralComponent, { set: { template: '' } })
      .compileComponents();

    // Evita ngOnInit (initGeneralState / SQLite); estos casos solo ejercitan hidratación TR.
    spyOn(CobrosGeneralComponent.prototype, 'ngOnInit').and.resolveTo();
    fixture = TestBed.createComponent(CobrosGeneralComponent);
    component = fixture.componentInstance;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('COB-TR-003: buildHydratedTransferenciaPayment maps receptor and client accounts without inversion', () => {
    const payment = {
      idBank: 11,
      naBank: 'Banco Receptor',
      nuBankAccount: '0102-RECEPTOR',
      nuClientBankAccount: '0102-CLIENTE',
      coClientBankAccount: 'CLI-ACC',
      newNuClientBankAccount: '',
      nuPaymentDoc: 'TR-REF-1',
      nuAmountPartial: 120,
      nuAmountPartialConversion: 120,
      daValue: '2026-08-04',
      isAnticipoPrepaid: false,
    } as CollectionPayment;

    const hydrated = (component as any).buildHydratedTransferenciaPayment(payment, 0, []);

    expect(hydrated.numeroCuenta).toBe('0102-RECEPTOR');
    expect(hydrated.numeroCuentaCliente).toBe('0102-CLIENTE');
    expect(hydrated.numeroTransferencia).toBe('TR-REF-1');
    expect(hydrated.showNuevaCuenta).toBeFalse();
    expect(hydrated.nuevaCuenta).toBe('');
    expect(hydrated.monto).toBe(120);
  });

  it('COB-TR-003: buildHydratedTransferenciaPayment restores nueva cuenta text', () => {
    const payment = {
      idBank: 11,
      naBank: 'Banco Receptor',
      nuBankAccount: '0102-RECEPTOR',
      nuClientBankAccount: 'Nueva Cuenta',
      coClientBankAccount: 'Nueva Cuenta',
      newNuClientBankAccount: '0123-NUEVA',
      nuPaymentDoc: 'TR-REF-2',
      nuAmountPartial: 80,
      nuAmountPartialConversion: 80,
      daValue: '2026-08-04',
      isAnticipoPrepaid: false,
    } as CollectionPayment;

    const hydrated = (component as any).buildHydratedTransferenciaPayment(payment, 1, []);

    expect(hydrated.showNuevaCuenta).toBeTrue();
    expect(hydrated.numeroCuentaCliente).toBe('Nueva Cuenta');
    expect(hydrated.nuevaCuenta).toBe('0123-NUEVA');
    expect(hydrated.numeroCuenta).toBe('0102-RECEPTOR');
  });

  it('COB-CH-001: buildHydratedChequePayment restores banco emisor in bankAccountSelected', () => {
    collectServiceMock.listBanks = [
      { idBank: 7, coBank: 'BANCO-7', naBank: 'Banco Provincial', coEnterprise: '', idEnterprise: 0 },
    ];
    collectServiceMock.bankAccountSelected = [];

    const payment = {
      idBank: 7,
      naBank: 'Banco Provincial',
      coClientBankAccount: 'Banco Provincial',
      nuPaymentDoc: 'CH-001',
      nuAmountPartial: 50,
      nuAmountPartialConversion: 50,
      daValue: '2026-08-04',
      daCollectionPayment: '2026-08-05',
      isAnticipoPrepaid: false,
    } as CollectionPayment;

    const hydrated = (component as any).buildHydratedChequePayment(payment, 0);

    expect(hydrated.nombreBanco).toBe('Banco Provincial');
    expect(hydrated.idBanco).toBe(7);
    expect(collectServiceMock.bankAccountSelected[0]?.naBank).toBe('Banco Provincial');
    expect(collectServiceMock.bankAccountSelected[0]?.idBank).toBe(7);
  });

  it('COB-CH-001: buildHydratedChequePayment falls back to coClientBankAccount when naBank is empty', () => {
    collectServiceMock.listBanks = [
      { idBank: 3, coBank: '0102', naBank: 'Banco de Venezuela', coEnterprise: '', idEnterprise: 0 },
    ];
    collectServiceMock.bankAccountSelected = [];

    const payment = {
      idBank: 0,
      naBank: '',
      coClientBankAccount: '0102',
      nuPaymentDoc: 'CH-002',
      nuAmountPartial: 80,
      nuAmountPartialConversion: 80,
      daValue: '2026-08-04',
      daCollectionPayment: '2026-08-05',
      isAnticipoPrepaid: false,
    } as CollectionPayment;

    const hydrated = (component as any).buildHydratedChequePayment(payment, 1);

    expect(hydrated.nombreBanco).toBe('Banco de Venezuela');
    expect(collectServiceMock.bankAccountSelected[1]?.naBank).toBe('Banco de Venezuela');
  });

  it('COB-PM-001: buildHydratedPagoMovilPayment restores emisor and destino pickers', () => {
    collectServiceMock.listBanks = [
      { idBank: 4, coBank: '0104', naBank: 'Banco Mercantil', coEnterprise: '', idEnterprise: 0 },
    ];
    collectServiceMock.bankAccountSelected = [];
    collectServiceMock.clientBankAccountSelected = [];
    collectServiceMock.typeDocumentList = [{ coTypeDocument: 'V', idTypeDocument: 1 }];
    collectServiceMock.codePhoneNumberList = [{ coCodePhoneNumber: '0414', idCodePhoneNumber: 1 }];

    const payment = {
      idBank: 9,
      naBank: 'Cuenta Receptora',
      nuBankAccount: '0102-9999',
      coClientBankAccount: '0104',
      nuPaymentDoc: 'PM-REF',
      nuDocument: '12345678',
      nuPhoneNumber: '04141234567',
      nuAmountPartial: 100,
      nuAmountPartialConversion: 100,
      daValue: '2026-08-04',
      isAnticipoPrepaid: false,
    } as CollectionPayment;

    const bankAccounts = [
      { idBank: 9, naBank: 'Cuenta Receptora', nuAccount: '0102-9999' },
    ];

    const hydrated = (component as any).buildHydratedPagoMovilPayment(payment, 0, bankAccounts);

    expect(hydrated.nombreBancoEmisor).toBe('Banco Mercantil');
    expect(collectServiceMock.bankAccountSelected[0]?.naBank).toBe('Banco Mercantil');
    expect(hydrated.nombreBancoDestino).toBe('Cuenta Receptora');
    expect(collectServiceMock.clientBankAccountSelected[0]?.nuAccount).toBe('0102-9999');
  });

  it('COB-DE-001: buildHydratedDepositoPayment restores receptor account picker', () => {
    collectServiceMock.bankAccountSelected = [];

    const payment = {
      idBank: 2,
      naBank: 'Banco Banesco',
      nuClientBankAccount: '0134-5555',
      nuPaymentDoc: 'DEP-001',
      nuAmountPartial: 200,
      nuAmountPartialConversion: 200,
      daValue: '2026-08-04',
      isAnticipoPrepaid: false,
    } as CollectionPayment;

    const bankAccounts = [
      { idBank: 2, naBank: 'Banco Banesco', nuAccount: '0134-5555' },
      { idBank: 2, naBank: 'Banco Banesco', nuAccount: '0134-0000' },
    ];

    const hydrated = (component as any).buildHydratedDepositoPayment(payment, 0, bankAccounts);

    expect(hydrated.numeroCuenta).toBe('0134-5555');
    expect(collectServiceMock.bankAccountSelected[0]?.nuAccount).toBe('0134-5555');
    expect(collectServiceMock.bankAccountSelected[0]?.naBank).toBe('Banco Banesco');
  });
});
