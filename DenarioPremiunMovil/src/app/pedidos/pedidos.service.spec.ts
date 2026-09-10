import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { Subject } from 'rxjs';

import { OrderEditContext, PedidosService } from './pedidos.service';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { ServicesService } from '../services/services.service';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';
import { ClienteSelectorService } from '../cliente-selector/cliente-selector.service';
import { OrderUtil } from '../modelos/orderUtil';

describe('PedidosService', () => {
  let service: PedidosService;
  let servicesSpy: jasmine.SpyObj<ServicesService>;
  const mockDb = {} as import('@awesome-cordova-plugins/sqlite').SQLiteObject;

  const tagRow = (coApplicationTag: string, tag: string) => ({
    idApplicationTag: 1,
    coApplicationTag,
    coLanguage: 'ESP',
    coModule: 'PED',
    naModule: 'Pedidos',
    tag,
  });

  const baseContext = (): OrderEditContext => ({
    idClient: 10,
    idAddressClient: 5,
    nuPurchase: 'ORD-001',
    txComment: 'Comentario',
    pedidoModificable: true,
  });

  const buildCartItem = (overrides: Partial<OrderUtil> = {}): OrderUtil =>
    ({
      idProduct: 1,
      idWarehouse: 1,
      ...overrides,
    }) as OrderUtil;

  beforeEach(() => {
    servicesSpy = jasmine.createSpyObj('ServicesService', ['getTags']);
    servicesSpy.getTags.and.callFake((_db, module: string) => {
      if (module === 'PED') {
        return Promise.resolve([tagRow('PED_NOMBRE_MODULO', 'Pedidos')]);
      }
      if (module === 'PROD') {
        return Promise.resolve([tagRow('PROD_BUSCAR', 'Buscar')]);
      }
      return Promise.resolve([tagRow('DENARIO_BOTON_ACEPTAR', 'Aceptar')]);
    });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FileOpener, useValue: { open: () => Promise.resolve() } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: SynchronizationDBService, useValue: { getDatabase: () => mockDb } },
        { provide: ServicesService, useValue: servicesSpy },
        { provide: ModalController, useValue: { create: () => Promise.resolve({ present: () => Promise.resolve() }) } },
        {
          provide: ClienteSelectorService,
          useValue: { ClientChanged: new Subject(), checkClient: false, setup: () => undefined },
        },
      ],
    });
    service = TestBed.inject(PedidosService);
    service.pedidoModificable = true;
    service.validateNuOrder = false;
    service.requiredCommentOrder = false;
    service.validateWarehouses = false;
    service.userMustActivateGPS = false;
    service.signatureOrder = false;
    service.coordenadas = '10,20';
    service.carrito = [];
    service.cliente = { idClient: 10 } as any;
    service.tags.set('PED_MSJ_ERROR_NO_CLIENT', 'Seleccione un cliente');
    service.tags.set('PED_MSJ_ERROR_NO_ADDRESS', 'Seleccione sucursal');
    service.tags.set('PED_MSJ_ERROR_NO_NU_ORDER', 'Ingrese número de orden');
    service.tags.set('PED_MSJ_ERROR_NO_COMMENT', 'Comentario obligatorio');
    service.tags.set('PED_MSJ_ERROR_NO_PRODUCTS', 'Agregue productos');
    service.tags.set('PED_MSJ_ERROR_NO_SIGNATURE', 'Adjunte firma');
    service.tags.set('PED_MSJ_ERROR_NO_GPS', 'Active GPS');
    service.tags.set('PED_MSJ_ERROR_NO_WAREHOUSE', 'Seleccione almacén');
    service.adjuntoService.weightLimitExceeded = false;
    spyOn(service.adjuntoService, 'hasItems').and.returnValue(true);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTags / ensureModuleReady', () => {
    beforeEach(() => {
      service.tags.clear();
      service.ProdSelecttags.clear();
      servicesSpy.getTags.calls.reset();
    });

    it('getTags puebla tags y ProdSelecttags desde SQLite', async () => {
      const loaded = await service.getTags(mockDb);

      expect(loaded).toBeTrue();
      expect(service.getTag('PED_NOMBRE_MODULO')).toBe('Pedidos');
      expect(service.ProdSelecttags.get('PROD_BUSCAR')).toBe('Buscar');
      expect(service.getTag('DENARIO_BOTON_ACEPTAR')).toBe('Aceptar');
    });

    it('getTags usa cache y no re-ejecuta SQL', async () => {
      await service.getTags(mockDb);
      servicesSpy.getTags.calls.reset();

      await service.getTags(mockDb);

      expect(servicesSpy.getTags).not.toHaveBeenCalled();
    });

    it('ensureModuleReady carga config y tags', async () => {
      await service.ensureModuleReady(mockDb);

      expect(service.getTag('PED_NOMBRE_MODULO')).toBe('Pedidos');
    });
  });

  describe('PED-SAVE-001 Guardar tras General válida', () => {
    it('pedido nuevo sin baseline permite Guardar con General válida', () => {
      service.generalTabValidForSave = true;
      service.setOrderEditContext(baseContext());
      service.resetOrderExitBaseline();
      let saveEnabled: boolean | undefined;
      service.orderValidToSave.subscribe((v: boolean) => saveEnabled = v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });

    it('baseline limpio deshabilita Guardar aunque General sea válida', () => {
      service.generalTabValidForSave = true;
      service.setOrderEditContext(baseContext());
      service.orderPersistedBaseline = true;
      service.orderDirtySincePersist = false;
      let saveEnabled: boolean | undefined;
      service.orderValidToSave.subscribe((v: boolean) => saveEnabled = v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeFalse();
    });

    it('markOrderDirty re-habilita Guardar tras baseline', () => {
      service.generalTabValidForSave = true;
      service.setOrderEditContext(baseContext());
      let saveEnabled: boolean | undefined;
      service.orderValidToSave.subscribe((v: boolean) => saveEnabled = v);
      service.applyOrderPersistSucceededBaseline();

      expect(saveEnabled).toBeFalse();
      service.markOrderDirty();
      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });
  });

  describe('PED-SEND-001 Enviar y validación al click', () => {
    it('Enviar ON con General válida aunque carrito vacío', () => {
      service.generalTabValidForSave = true;
      service.setOrderEditContext(baseContext());
      let sendEnabled: boolean | undefined;
      service.orderValidToSend.subscribe((v: boolean) => sendEnabled = v);

      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeTrue();
    });

    it('hasOrderFieldErrors true sin productos', () => {
      service.generalTabValidForSave = true;
      service.setOrderEditContext(baseContext());

      expect(service.hasOrderFieldErrors()).toBeTrue();
      expect(service.getOrderValidationMessage()).toContain('Agregue productos');
    });

    it('hasOrderFieldErrors true sin cliente', () => {
      const ctx = baseContext();
      ctx.idClient = null;
      service.generalTabValidForSave = false;
      service.setOrderEditContext(ctx);

      expect(service.hasOrderFieldErrors()).toBeTrue();
      expect(service.getOrderValidationMessage()).toContain('Seleccione un cliente');
    });

    it('validateNuOrder exige número de orden', () => {
      service.validateNuOrder = true;
      service.generalTabValidForSave = true;
      const ctx = baseContext();
      ctx.nuPurchase = '';
      service.setOrderEditContext(ctx);
      service.carrito = [buildCartItem()];

      expect(service.hasOrderFieldErrors()).toBeTrue();
      expect(service.getOrderValidationMessage()).toContain('número de orden');
    });

    it('requiredCommentOrder exige comentario en pedido editable', () => {
      service.requiredCommentOrder = true;
      service.generalTabValidForSave = true;
      const ctx = baseContext();
      ctx.txComment = '';
      service.setOrderEditContext(ctx);
      service.carrito = [buildCartItem()];

      expect(service.hasOrderFieldErrors()).toBeTrue();
      expect(service.getOrderValidationMessage()).toContain('Comentario obligatorio');
    });

    it('pedido no editable queda read-only', () => {
      service.pedidoModificable = false;
      service.generalTabValidForSave = true;
      service.setOrderEditContext({ ...baseContext(), pedidoModificable: false });
      let saveEnabled: boolean | undefined;
      let sendEnabled: boolean | undefined;
      service.orderValidToSave.subscribe((v: boolean) => saveEnabled = v);
      service.orderValidToSend.subscribe((v: boolean) => sendEnabled = v);

      service.updateSaveButtonAvailability();
      service.updateSendButtonAvailability();
      expect(saveEnabled).toBeFalse();
      expect(sendEnabled).toBeFalse();
    });

    it('validateWarehouses exige almacén por línea', () => {
      service.validateWarehouses = true;
      service.generalTabValidForSave = true;
      service.setOrderEditContext(baseContext());
      service.carrito = [buildCartItem({ idWarehouse: 0 })];

      expect(service.hasOrderFieldErrors()).toBeTrue();
      expect(service.getOrderValidationMessage()).toContain('almacén');
    });
  });

  describe('PED-SEND-001 adjuntos signatureOrder', () => {
    beforeEach(() => {
      service.signatureOrder = true;
      service.generalTabValidForSave = true;
      service.setOrderEditContext(baseContext());
      service.carrito = [buildCartItem()];
    });

    it('signatureOrder no exige adjuntos (solo muestra firma)', () => {
      (service.adjuntoService.hasItems as jasmine.Spy).and.returnValue(false);

      expect(service.hasOrderFieldErrors()).toBeFalse();
    });
  });

  describe('PED-SEND-001 GPS', () => {
    it('hasOrderFieldErrors true sin coordenadas cuando userMustActivateGPS', () => {
      service.userMustActivateGPS = true;
      service.coordenadas = '';
      service.generalTabValidForSave = true;
      service.setOrderEditContext(baseContext());
      service.carrito = [buildCartItem()];

      expect(service.hasOrderFieldErrors()).toBeTrue();
      expect(service.getOrderValidationMessage()).toContain('Active GPS');
    });
  });

  describe('userCanChangeUnits / disableUnitSelector', () => {
    let config: GlobalConfigService;

    beforeEach(() => {
      config = TestBed.inject(GlobalConfigService);
      config.variables = new Map<string, string>([]);
    });

    it('clave ausente o vacía queda true y selector ON', () => {
      service.getConfig();
      expect(service.userCanChangeUnits).toBeTrue();
      expect(service.disableUnitSelector).toBeFalse();

      config.variables.set('userCanChangeUnits', '');
      service.getConfig();
      expect(service.userCanChangeUnits).toBeTrue();
      expect(service.disableUnitSelector).toBeFalse();
    });

    it('true deja selector ON si unitByPriceList=false', () => {
      config.variables.set('userCanChangeUnits', 'true');
      service.getConfig();
      service.unitByPriceList = false;
      expect(service.userCanChangeUnits).toBeTrue();
      expect(service.disableUnitSelector).toBeFalse();
    });

    it('false deshabilita selector', () => {
      config.variables.set('userCanChangeUnits', 'false');
      service.getConfig();
      service.unitByPriceList = false;
      expect(service.userCanChangeUnits).toBeFalse();
      expect(service.disableUnitSelector).toBeTrue();
    });

    it('unitByPriceList=true deshabilita selector aunque userCanChangeUnits=true', () => {
      config.variables.set('userCanChangeUnits', 'true');
      service.getConfig();
      service.unitByPriceList = true;
      expect(service.userCanChangeUnits).toBeTrue();
      expect(service.disableUnitSelector).toBeTrue();
    });
  });
});
