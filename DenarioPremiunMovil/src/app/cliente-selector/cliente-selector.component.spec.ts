import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ClienteSelectorComponent } from './cliente-selector.component';
import { ClienteSelectorService } from './cliente-selector.service';
import { CurrencyService } from '../services/currency/currency.service';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { ClientesDatabaseServicesService } from '../services/clientes/clientes-database-services.service';
import { CollectionService } from '../services/collection/collection-logic.service';
import { MessageService } from '../services/messageService/message.service';
import { ClientLogicService } from '../services/clientes/client-logic.service';
import { ModalController } from '@ionic/angular';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';
import { Client } from '../modelos/tables/client';
import { CurrencyModules } from '../modelos/tables/currencyModules';

describe('ClienteSelectorComponent', () => {
  let component: ClienteSelectorComponent;
  let fixture: ComponentFixture<ClienteSelectorComponent>;
  let currencyServiceMock: jasmine.SpyObj<CurrencyService>;
  let selectorServiceMock: Partial<ClienteSelectorService>;

  beforeEach(waitForAsync(() => {
    currencyServiceMock = jasmine.createSpyObj('CurrencyService', [
      'setup',
      'getLocalCurrency',
      'getHardCurrency',
      'getCurrencyModule',
      'formatNumber',
      'hasValidExchangeRate',
    ]);
    currencyServiceMock.setup.and.resolveTo();
    currencyServiceMock.getLocalCurrency.and.returnValue({ coCurrency: 'BS' } as any);
    currencyServiceMock.getHardCurrency.and.returnValue({ coCurrency: 'USD' } as any);
    currencyServiceMock.formatNumber.and.callFake((n: number) => String(n));
    currencyServiceMock.hasValidExchangeRate.and.returnValue(true);
    currencyServiceMock.getCurrencyModule.and.returnValue(
      new CurrencyModules(1, 1, false, false, true),
    );
    (currencyServiceMock as any).multimoneda = true;
    (currencyServiceMock as any).precision = 2;

    selectorServiceMock = {
      tags: new Map(),
      colorModulo: '',
      nombreModulo: '',
      clientes: [],
      checkClient: false,
      clienteAnterior: null as any,
      selectionCoModule: 'ped',
      currencyModule: new CurrencyModules(1, 1, false, false, true),
      idEnterprise: 1,
      getTag: (t: string) => t,
      ensureTagsLoaded: jasmine.createSpy('ensureTagsLoaded').and.resolveTo(),
      onCLientChanged: jasmine.createSpy('onCLientChanged'),
    };

    TestBed.configureTestingModule({
      declarations: [ClienteSelectorComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: ClienteSelectorService, useValue: selectorServiceMock },
        { provide: CurrencyService, useValue: currencyServiceMock },
        { provide: SynchronizationDBService, useValue: { getDatabase: () => ({}) } },
        { provide: ClientesDatabaseServicesService, useValue: {} },
        { provide: CollectionService, useValue: { userCanCollectIva: false, cobro25: false } },
        { provide: MessageService, useValue: { showLoading: () => Promise.resolve(), hideLoading: () => undefined } },
        { provide: ClientLogicService, useValue: { checkUserStatus: () => undefined, esTransportista: false, showClientDetail: () => undefined } },
        { provide: ModalController, useValue: {} },
        { provide: GlobalConfigService, useValue: { get: () => 'false' } },
      ],
    })
      .overrideComponent(ClienteSelectorComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ClienteSelectorComponent);
    component = fixture.componentInstance;
    component.localCurrency = { coCurrency: 'BS' } as any;
    component.hardCurrency = { coCurrency: 'USD' } as any;
    component.multimoneda = true;
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('con moneda fuerte y conversiones OFF muestra solo saldo hard como primario', () => {
    component.localCurrencyDefault = false;
    component.showConversion = false;
    const client = { saldo1: 1000, saldo2: 25 } as Client;

    expect(component.getPrimaryCurrencyLabel()).toBe('USD');
    expect(component.getPrimarySaldo(client)).toBe(25);
    expect(component.canShowConversion).toBeFalse();
  });

  it('con moneda local y conversiones ON muestra local primario y hard secundario', () => {
    component.localCurrencyDefault = true;
    component.showConversion = true;
    const client = { saldo1: 1000, saldo2: 25 } as Client;

    expect(component.getPrimaryCurrencyLabel()).toBe('BS');
    expect(component.getPrimarySaldo(client)).toBe(1000);
    expect(component.getSecondaryCurrencyLabel()).toBe('USD');
    expect(component.getSecondarySaldo(client)).toBe(25);
    expect(component.canShowConversion).toBeTrue();
  });
});
