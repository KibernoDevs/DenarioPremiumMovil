import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { IonicModule, ModalController, Platform } from '@ionic/angular';
import { Subject } from 'rxjs';

import { AdjuntoService } from '../adjuntos/adjunto.service';
import { ClienteSelectorService } from '../cliente-selector/cliente-selector.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { AutoSendService } from '../services/autoSend/auto-send.service';
import { ClientesDatabaseServicesService } from '../services/clientes/clientes-database-services.service';
import { CurrencyService } from '../services/currency/currency.service';
import { DateServiceService } from '../services/dates/date-service.service';
import { DepositService } from '../services/deposit/deposit.service';
import { EnterpriseService } from '../services/enterprise/enterprise.service';
import { GeolocationService } from '../services/geolocation/geolocation.service';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';
import { ImageServicesService } from '../services/imageServices/image-services.service';
import { InventariosLogicService } from '../services/inventarios/inventarios-logic.service';
import { MessageService } from '../services/messageService/message.service';
import { ProductService } from '../services/products/product.service';
import { ProductStructureService } from '../services/productStructures/product-structure.service';
import { ReturnDatabaseService } from '../services/returns/return-database.service';
import { ReturnLogicService } from '../services/returns/return-logic.service';
import { ServicesService } from '../services/services.service';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';

const denarioTags = new Map<string, string>([
  ['DENARIO_BOTON_CANCELAR', 'Cancelar'],
  ['DENARIO_BOTON_ACEPTAR', 'Aceptar'],
  ['DENARIO_BOTON_SALIR_GUARDAR', 'Guardar y salir'],
  ['DENARIO_BOTON_SALIR', 'Salir sin guardar'],
]);

export const mockDatabase = {} as Record<string, unknown>;

export const mockSynchronizationDBService = {
  getDatabase: () => mockDatabase,
};

export const mockMessageService = {
  showLoading: () => Promise.resolve(),
  hideLoading: () => undefined,
  transaccionMsjModalNB: () => undefined,
  alertModal: () => undefined,
};

export const mockServicesService = {
  getTags: () => Promise.resolve([]),
  insertPendingTransaction: () => Promise.resolve(true),
  tags: { get: () => undefined },
};

export const mockGlobalConfigService = {
  get: () => 'false',
};

export const mockGeolocationService = {
  getCurrentPosition: () => Promise.resolve(''),
};

export const mockDateService = {
  hoyISO: () => '2026-01-01',
  generateCO: () => 'DEV-001',
};

export const mockRouter = {
  navigate: jasmine.createSpy('navigate'),
};

export const mockPlatform = {
  backButton: {
    subscribeWithPriority: () => ({ unsubscribe: () => undefined }),
  },
};

export const mockAutoSendService = {
  runPendingQueue: () => Promise.resolve(),
};

export const mockAdjuntoService = {
  weightLimitExceeded: false,
  hasItems: () => true,
  getNuAttachment: () => 0,
  AttachmentChanged: new Subject<void>(),
  AttachmentWeightExceeded: new Subject<void>(),
};

export const mockModalController = {
  create: () =>
    Promise.resolve({
      present: () => Promise.resolve(),
      dismiss: () => Promise.resolve(),
    }),
};

export const mockInventariosLogicService = {
  getTags: () => Promise.resolve(true),
  getTagsDenario: () => Promise.resolve(true),
  userMustActivateGPS: false,
  inventarioComp: false,
  isEdit: false,
  sendStock: new Subject<unknown>(),
  stockValidToSave: new Subject<boolean>(),
  stockValidToSend: new Subject<boolean>(),
  showButtons: new Subject<boolean>(),
  backRoute: new Subject<string>(),
  inventarioTagsDenario: denarioTags,
  inventarioTags: new Map<string, string>(),
  globalConfig: mockGlobalConfigService,
  newClientStock: {
    clientStockDetails: [],
    hasAttachments: false,
    nuAttachments: 0,
    coordenada: '',
  },
  getAllClientStock: () => Promise.resolve([]),
  getClientStockCoordenada: () => Promise.resolve(''),
  showBackRoute: () => undefined,
  showHeaderButtons: false,
  disableSaveButton: true,
  cannotSendClientStock: true,
  notifyStockEdited: () => undefined,
  refreshSendBlockedState: () => undefined,
  updateSaveButtonAvailability: () => undefined,
  updateSendButtonAvailability: () => undefined,
  showHeaderButtonsFunction: () => undefined,
};

export const mockDepositService = {
  depositComponent: false,
  depositNewComponent: false,
  userMustActivateGPS: false,
  globalConfig: mockGlobalConfigService,
  getTags: () => undefined,
  getTagsDenario: () => undefined,
  sendDeposit: new Subject<string>(),
  backRoute: new Subject<string>(),
  deposit: { depositCollect: [], stDelivery: '' },
  depositValidToSave: new Subject<boolean>(),
  depositValidToSend: new Subject<boolean>(),
  showButtons: new Subject<boolean>(),
  depositTags: new Map<string, string>(),
  depositTagsDenario: denarioTags,
  coordenadas: '',
  showHeaderButtonsFunction: () => undefined,
};

export const mockReturnLogicService = {
  validateReturn: false,
  requeridedNroFactura: false,
  userMustActivateGPS: false,
  bloquearFactura: false,
  validateClient: false,
  tags: new Map<string, string>(),
  returnTypes: [{ idType: 1 }],
  newReturn: {} as Record<string, unknown>,
  invoiceChanged: new Subject<unknown>(),
  backRoute: new Subject<string>(),
  onReturnGeneralValid: () => undefined,
  resetReturnExitBaseline: () => undefined,
  findInvoiceDetailUnits: () => Promise.resolve(),
};

export const mockReturnDatabaseService = {};

export const mockEnterpriseService = {
  setup: () => Promise.resolve(),
  defaultEnterprise: () => ({ idEnterprise: 1 }),
  empresas: [{ idEnterprise: 1 }],
};

export const mockClienteSelectorService = {
  ClientChanged: new Subject<unknown>(),
  checkClient: false,
  setup: () => undefined,
};

export const mockProductService = {};

export const mockProductStructureService = {};

export const mockPedidosService = {};

export const mockImageServicesService = {};

export const mockClientesDatabaseServicesService = {};

export const mockCurrencyService = {
  setup: () => Promise.resolve(),
  getCurrencyModule: () => Promise.resolve([]),
};

export function commonHttpProviders() {
  return [provideHttpClient(), provideHttpClientTesting()];
}

export function commonComponentProviders(): unknown[] {
  return [
    ...commonHttpProviders(),
    { provide: MessageService, useValue: mockMessageService },
    { provide: SynchronizationDBService, useValue: mockSynchronizationDBService },
    { provide: ServicesService, useValue: mockServicesService },
    { provide: GlobalConfigService, useValue: mockGlobalConfigService },
    { provide: GeolocationService, useValue: mockGeolocationService },
    { provide: DateServiceService, useValue: mockDateService },
    { provide: Router, useValue: mockRouter },
    { provide: Platform, useValue: mockPlatform },
    { provide: AutoSendService, useValue: mockAutoSendService },
    { provide: AdjuntoService, useValue: mockAdjuntoService },
    { provide: ModalController, useValue: mockModalController },
    { provide: InventariosLogicService, useValue: mockInventariosLogicService },
    { provide: DepositService, useValue: mockDepositService },
    { provide: ReturnLogicService, useValue: mockReturnLogicService },
    { provide: ReturnDatabaseService, useValue: mockReturnDatabaseService },
    { provide: EnterpriseService, useValue: mockEnterpriseService },
    { provide: ClienteSelectorService, useValue: mockClienteSelectorService },
    { provide: ProductService, useValue: mockProductService },
    { provide: ProductStructureService, useValue: mockProductStructureService },
    { provide: PedidosService, useValue: mockPedidosService },
    { provide: ImageServicesService, useValue: mockImageServicesService },
    { provide: ClientesDatabaseServicesService, useValue: mockClientesDatabaseServicesService },
    { provide: CurrencyService, useValue: mockCurrencyService },
  ];
}

export function configureIonicComponentTestingModule(
  component: Type<unknown>,
  extraProviders: unknown[] = [],
) {
  return TestBed.configureTestingModule({
    declarations: [component],
    imports: [IonicModule.forRoot()],
    providers: [...commonComponentProviders(), ...extraProviders],
    teardown: { destroyAfterEach: false },
  }).overrideComponent(component, { set: { template: '' } });
}

/** Instancia el componente sin detectChanges; evita ngOnInit en specs smoke. */
export function createShallowComponentFixture<T>(
  component: Type<T>,
): { fixture: ComponentFixture<T>; component: T } {
  const fixture = TestBed.createComponent(component);
  return { fixture, component: fixture.componentInstance };
}
