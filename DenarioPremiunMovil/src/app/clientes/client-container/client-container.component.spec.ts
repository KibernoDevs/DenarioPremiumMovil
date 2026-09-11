import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import { ClienteContainerComponent } from './client-container.component';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ServicesService } from 'src/app/services/services.service';
import { ClientLocationService } from 'src/app/services/clientes/locationClient/client-location.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';

describe('ClienteContainerComponent', () => {
  let component: ClienteContainerComponent;
  let fixture: ComponentFixture<ClienteContainerComponent>;
  let clientLogicMock: any;
  let routerMock: any;
  let backRoute$: Subject<string>;

  beforeEach(waitForAsync(() => {
    backRoute$ = new Subject<string>();
    clientLogicMock = {
      backRoute: backRoute$,
      getCurrency: jasmine.createSpy('getCurrency'),
      getEnterprise: jasmine.createSpy('getEnterprise'),
      initService: jasmine.createSpy('initService'),
      refreshCliCurrencyModule: jasmine.createSpy('refreshCliCurrencyModule').and.resolveTo(undefined),
      getClients: jasmine.createSpy('getClients').and.resolveTo([]),
      getPotentialClient: jasmine.createSpy('getPotentialClient'),
      listaEmpresa: [{ idEnterprise: 1 }],
      clientListPage: 0,
      clientContainerComponent: true,
      clientListComponent: false,
      clientDetailComponent: false,
      clientPotentialClientComponent: false,
      clientNewPotentialClientComponent: false,
      clientLocationComponent: false,
      clientDocumentSaleComponent: false,
      clienteNuevoBlancoImg: true,
      savePotentialClient: false,
      saveSendPotentialClient: false,
      saveOrExitOpen: false,
      opendDocClick: false,
      segment: 'docVentas',
      potentialClient: {},
    };
    routerMock = { navigate: jasmine.createSpy('navigate') };

    TestBed.configureTestingModule({
      declarations: [ClienteContainerComponent],
      providers: [
        { provide: ClientLogicService, useValue: clientLogicMock },
        { provide: Router, useValue: routerMock },
        { provide: ServicesService, useValue: {} },
        {
          provide: MessageService,
          useValue: {
            showLoading: jasmine.createSpy('showLoading').and.resolveTo(undefined),
            hideLoading: jasmine.createSpy('hideLoading'),
          },
        },
        { provide: ClientLocationService, useValue: {} },
        { provide: GlobalConfigService, useValue: { get: () => '' } },
      ],
    })
      .overrideComponent(ClienteContainerComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ClienteContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  afterEach(() => {
    backRoute$.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('DM-CLT-018: back desde home clientes navega a Home', () => {
    clientLogicMock.clientContainerComponent = true;
    backRoute$.next('back');
    expect(routerMock.navigate).toHaveBeenCalledWith(['home']);
  });

  it('DM-CLT-016: back desde listado vuelve a home clientes', () => {
    clientLogicMock.clientContainerComponent = false;
    clientLogicMock.clientListComponent = true;
    backRoute$.next('back');

    expect(clientLogicMock.clientListComponent).toBeFalse();
    expect(clientLogicMock.clientContainerComponent).toBeTrue();
  });

  it('DM-CLT-017: back desde detalle vuelve a listado y resetea segment', () => {
    clientLogicMock.clientContainerComponent = false;
    clientLogicMock.clientListComponent = false;
    clientLogicMock.clientDetailComponent = true;
    clientLogicMock.segment = 'docVentas';
    backRoute$.next('back');

    expect(clientLogicMock.clientDetailComponent).toBeFalse();
    expect(clientLogicMock.clientListComponent).toBeTrue();
    expect(clientLogicMock.segment).toBe('default');
  });

  it('DM-CLT-019: newPotentialClient abre formulario', () => {
    component.newPotentialClient();

    expect(clientLogicMock.clientContainerComponent).toBeFalse();
    expect(clientLogicMock.clientNewPotentialClientComponent).toBeTrue();
    expect(clientLogicMock.clienteNuevoBlancoImg).toBeFalse();
  });

  it('DM-CLT-029: findPotentialClient abre listado de potenciales', () => {
    component.findPotentialClient();

    expect(clientLogicMock.clientContainerComponent).toBeFalse();
    expect(clientLogicMock.clientPotentialClientComponent).toBeTrue();
  });
});
