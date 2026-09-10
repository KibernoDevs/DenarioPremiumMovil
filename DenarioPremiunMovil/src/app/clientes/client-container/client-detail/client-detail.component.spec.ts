import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';

import { ClienteComponent } from './client-detail.component';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';

describe('ClienteComponent (client-detail)', () => {
  let component: ClienteComponent;
  let fixture: ComponentFixture<ClienteComponent>;
  let clientLogicMock: any;
  let currencyServiceMock: any;
  let globalConfigMock: any;

  beforeEach(waitForAsync(() => {
    clientLogicMock = {
      initService: jasmine.createSpy('initService'),
      refreshCliCurrencyModule: jasmine.createSpy('refreshCliCurrencyModule').and.returnValue(Promise.resolve()),
      checkUserStatus: jasmine.createSpy('checkUserStatus'),
      esTransportista: false,
      multiCurrency: true,
      fromSelector: false,
      clientTags: new Map<string, string>(),
      localCurrency: { coCurrency: 'BS' },
      hardCurrency: { coCurrency: 'USD' },
      datos: {
        client: {
          idClient: 1,
          coCurrency: 'USD',
          saldo1: 0,
          saldo2: 2096.23,
          idAddressClients: 10,
          txDescription1: '',
          txDescription2: '',
          nuCreditLimit: 5000,
        },
        document: [],
      },
      listaDirecciones: [
        {
          idAddress: 10,
          coAddress: 'DIR-10',
          txAddress: 'Calle A',
          coordenada: '10,20',
          editable: true,
        },
        {
          idAddress: 20,
          coAddress: 'DIR-20',
          txAddress: 'Calle B',
          coordenada: '30,40',
          editable: false,
        },
      ],
      resolveClientBalanceTotals: jasmine.createSpy('resolveClientBalanceTotals').and.returnValue({
        saldoLocal: 1546766.19,
        saldoFuerte: 2096.23,
      }),
      documentSaleSelect: null,
      clientDetailComponent: true,
      clientDocumentSaleComponent: false,
      opendDocClick: false,
      segment: 'default',
      showConversion: false,
      closeClientShareModal: {
        subscribe: () => ({ unsubscribe: () => undefined }),
      },
    };

    currencyServiceMock = {
      multimoneda: true,
      precision: 2,
      localCurrency: { coCurrency: 'BS' },
      hardCurrency: { coCurrency: 'USD' },
      toHardCurrency: (n: number) => n / 737.88,
      toLocalCurrency: (n: number) => n * 737.88,
      formatNumber: (n: number) => String(n),
    };

    globalConfigMock = {
      get: jasmine.createSpy('get').and.callFake((key: string) =>
        key === 'conversionDocument' ? 'true' : '',
      ),
    };

    TestBed.configureTestingModule({
      declarations: [ClienteComponent],
      providers: [
        { provide: ClientLogicService, useValue: clientLogicMock },
        { provide: CurrencyService, useValue: currencyServiceMock },
        { provide: GlobalConfigService, useValue: globalConfigMock },
        { provide: ChangeDetectorRef, useValue: { markForCheck: () => undefined } },
      ],
    })
      .overrideComponent(ClienteComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ClienteComponent);
    component = fixture.componentInstance;
    component.client = { ...clientLogicMock.datos.client } as any;
    // ngOnDestroy hace unsubscribe; ngOnInit no corre en estos tests.
    component.subjectClientShareModalOpen = { unsubscribe: () => undefined };
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('CLI-CURRENCY-SYNC: ngOnInit recarga currency_modules CLI desde SQLite', async () => {
    await component.ngOnInit();
    expect(clientLogicMock.refreshCliCurrencyModule).toHaveBeenCalled();
  });

  it('DM-CLT-009 / CLI-SALDOS-001: initializeClientBalances usa buckets docs (local/hard)', () => {
    (component as any).initializeClientBalances();

    expect(clientLogicMock.resolveClientBalanceTotals).toHaveBeenCalledWith(
      0,
      2096.23,
      'USD',
      true,
    );
    expect(component.saldoLocal).toBeCloseTo(1546766.19, 2);
    expect(component.saldoFuerte).toBeCloseTo(2096.23, 2);
  });

  it('CLI-CREDIT-001: crédito display local/hard (no etiqueta coCurrency)', () => {
    component.localCurrency = 'BS';
    (component as any).initializeClientBalances();
    (component as any).initializeClientCredits();

    expect(component.creditoFuerte).toBe(5000);
    expect(component.creditoLocal).toBeCloseTo(5000 * 737.88, 2);
    expect(component.availableCreditFuerte).toBeCloseTo(5000 - 2096.23, 2);
    expect(component.availableCreditLocal).toBeCloseTo((5000 * 737.88) - 1546766.19, 2);
  });

  it('DM-CLT-010: onChangeAddress actualiza dirección y coordenada del cliente', () => {
    component.selectedAddress = clientLogicMock.listaDirecciones[1];
    component.onChangeAddress({});

    expect(component.client.txAddress).toBe('Calle B');
    expect(component.client.idAddressClients).toBe(20);
    expect(component.client.coAddressClients).toBe('DIR-20');
    expect(component.client.coordenada).toBe('30,40');
    expect(component.client.editable).toBeFalse();
  });

  it('DM-CLT-013: showDocVentasTab false si transportista', () => {
    clientLogicMock.esTransportista = true;
    expect(component.showDocVentasTab()).toBeFalse();

    clientLogicMock.esTransportista = false;
    expect(component.showDocVentasTab()).toBeTrue();
  });

  it('htmlClientDescription false por defecto si la clave no viene', () => {
    component.ngOnInit();
    expect(component.htmlClientDescription).toBeFalse();
  });

  it('htmlClientDescription true solo con clave htmlClientDescription (no infoVendedores)', () => {
    globalConfigMock.get.and.callFake((key: string) => {
      if (key === 'htmlClientDescription') {
        return 'true';
      }
      if (key === 'infoVendedores') {
        return 'true';
      }
      return key === 'conversionDocument' ? 'true' : '';
    });

    component.ngOnInit();

    expect(component.htmlClientDescription).toBeTrue();
    expect(globalConfigMock.get).toHaveBeenCalledWith('htmlClientDescription');
  });

  it('sanitizeDescription limpia null y deja HTML para innerHTML', () => {
    expect((component as any).sanitizeDescription(null)).toBe('');
    expect((component as any).sanitizeDescription('null')).toBe('');
    expect((component as any).sanitizeDescription('<b>Importante</b><br>Linea 2'))
      .toBe('<b>Importante</b><br>Linea 2');
  });

  it('openDescriptionModal carga título y HTML de la descripción pedida', () => {
    component.client = {
      ...component.client,
      txDescription1: '<p>Uno</p>',
      txDescription2: '<p>Dos</p>',
    } as any;
    clientLogicMock.clientTags = new Map([
      ['CLI_DETAIL_DESCRIPTION_1', 'Descripción 1'],
      ['CLI_DETAIL_DESCRIPTION_2', 'Descripción 2'],
    ]);

    component.openDescriptionModal(1);
    expect(component.descriptionModalOpen).toBeTrue();
    expect(component.descriptionModalTitle).toBe('Descripción 1');
    expect(component.descriptionModalHtml).toBe('<p>Uno</p>');

    component.openDescriptionModal(2);
    expect(component.descriptionModalTitle).toBe('Descripción 2');
    expect(component.descriptionModalHtml).toBe('<p>Dos</p>');

    component.closeDescriptionModal();
    expect(component.descriptionModalOpen).toBeFalse();
  });

  it('DM-CLT-014: openDoc navega a pantalla de documento', () => {
    component.document = [
      { idDocument: 99, coDocument: 'FAC-1' } as any,
      { idDocument: 100, coDocument: 'FAC-2' } as any,
    ];

    component.openDoc(100, 1);

    expect(clientLogicMock.documentSaleSelect).toEqual(component.document[1]);
    expect(clientLogicMock.clientDetailComponent).toBeFalse();
    expect(clientLogicMock.clientDocumentSaleComponent).toBeTrue();
    expect(clientLogicMock.opendDocClick).toBeTrue();
  });
});
