import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ModalController } from '@ionic/angular';

import { ReturnLogicService } from './return-logic.service';
import { ReturnDetail } from 'src/app/modelos/tables/ReturnDetail';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { EnterpriseService } from '../enterprise/enterprise.service';
import { AutoSendService } from '../autoSend/auto-send.service';
import { ReturnDatabaseService } from './return-database.service';
import { ProductService } from '../products/product.service';
import { MessageService } from '../messageService/message.service';
import { HistoryTransaction } from '../historyTransaction/historyTransaction';
import { DELIVERY_STATUS_NEW, DELIVERY_STATUS_SENT, DELIVERY_STATUS_TO_SEND } from 'src/app/utils/appConstants';

describe('ReturnLogicService', () => {
  let service: ReturnLogicService;

  const mockDb = {
    executeSql: jasmine.createSpy('executeSql').and.returnValue(
      Promise.resolve({ rows: { length: 0, item: () => ({}) } }),
    ),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ModalController, useValue: { create: () => Promise.resolve({ present: () => Promise.resolve() }) } },
        {
          provide: SynchronizationDBService,
          useValue: { getDatabase: () => mockDb },
        },
        {
          provide: EnterpriseService,
          useValue: { setup: () => Promise.resolve(), empresas: [] },
        },
        { provide: AutoSendService, useValue: {} },
        { provide: ReturnDatabaseService, useValue: {} },
        { provide: ProductService, useValue: { unitsByProduct: [] } },
        { provide: MessageService, useValue: {} },
        { provide: HistoryTransaction, useValue: { getStatusTransaction: () => Promise.resolve('') } },
      ],
    });
    service = TestBed.inject(ReturnLogicService);
    service.userMustActivateGPS = false;
    service.validateReturn = false;
    service.requeridedNroFactura = false;
    service.newReturn = {
      idClient: 0,
      idInvoice: 0,
      coordenada: '',
      stDelivery: 3,
      invoicedetailUnits: [],
    } as any;
    service.productList = [];
    service.tags.set('DEV_MSJ_ERROR_NO_CLIENT', 'Seleccione un cliente');
    service.tags.set('DEV_MSJ_ERROR_NO_INVOICE', 'Seleccione una factura');
    service.tags.set('DEV_MSJ_ERROR_NO_PRODUCTS', 'Agregue productos');
    service.tags.set('DEV_MSJ_ERROR_INCOMPLETE_PRODUCT', 'Complete productos');
    service.tags.set('DEV_MSJ_ERROR_INVALID_QTY', 'Cantidad inválida');
    service.tags.set('DEV_MSJ_ERROR_NO_ATTACHMENTS', 'Adjunte firma');
    service.tags.set('DEV_MSJ_ERROR_NO_GPS', 'Active GPS');
    service.adjuntoService.weightLimitExceeded = false;
    spyOn(service.adjuntoService, 'hasItems').and.returnValue(true);
    spyOn(service.globalConfig, 'get').and.callFake((key: string) => {
      if (key === 'signatureReturn') {
        return 'false';
      }
      if (key === 'userMustActivateGPS') {
        return 'false';
      }
      return '';
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('DEV-SAVE-001 Guardar tras General válida', () => {
    it('devolución nueva sin baseline permite Guardar con General válida', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.resetReturnExitBaseline();
      let saveEnabled: boolean | undefined;
      service.returnValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });

    it('baseline limpio deshabilita Guardar aunque General sea válida', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.returnPersistedBaseline = true;
      service.returnDirtySincePersist = false;
      let saveEnabled: boolean | undefined;
      service.returnValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeFalse();
    });

    it('markReturnDirty re-habilita Guardar tras baseline', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      let saveEnabled: boolean | undefined;
      service.returnValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.applyReturnPersistSucceededBaseline();

      expect(saveEnabled).toBeFalse();
      service.markReturnDirty();
      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });

    it('hasReturnSaveErrors false sin productos si General OK', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.productList = [];

      expect(service.hasReturnSaveErrors()).toBeFalse();
      expect(service.hasReturnFieldErrors()).toBeTrue();
    });

    it('DEV-BACK-001: nueva con General OK pide modal al salir', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.newReturn.stDelivery = DELIVERY_STATUS_NEW;
      service.resetReturnExitBaseline();

      expect(service.shouldPromptReturnExitSaveOrDiscard()).toBeTrue();
    });

    it('DEV-BACK-001: sin General ni dirty no pide modal', () => {
      service.generalTabValidForSave = false;
      service.returnChanged = false;
      service.resetReturnExitBaseline();

      expect(service.shouldPromptReturnExitSaveOrDiscard()).toBeFalse();
    });

    it('DEV-BACK-001: persistida limpia no pide modal; dirty sí', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.markReturnOpenedFromPersistedCopy();
      expect(service.shouldPromptReturnExitSaveOrDiscard()).toBeFalse();

      service.notifyReturnEdited();
      expect(service.shouldPromptReturnExitSaveOrDiscard()).toBeTrue();
    });
  });

  describe('DEV-SEND-001 Enviar y validación al click', () => {
    it('Enviar ON con General válida aunque no haya productos', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      let sendEnabled: boolean | undefined;
      service.returnValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeTrue();
    });

    it('sendBlockedByFields apaga Enviar hasta editar', () => {
      service.generalTabValidForSave = true;
      service.sendBlockedByFields = true;
      let sendEnabled: boolean | undefined;
      service.returnValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeFalse();

      service.notifyReturnEdited();
      expect(service.sendBlockedByFields).toBeFalse();
      expect(sendEnabled).toBeTrue();
    });

    it('hasReturnFieldErrors true sin productos', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.productList = [];

      expect(service.hasReturnFieldErrors()).toBeTrue();
      expect(service.getReturnValidationMessage()).toContain('Agregue productos');
      expect(service.resolveSendValidationFocusTab()).toBe('productos');
    });

    it('hasReturnFieldErrors true sin cliente', () => {
      service.generalTabValidForSave = false;
      service.newReturn.idClient = 0;

      expect(service.hasReturnFieldErrors()).toBeTrue();
      expect(service.getReturnValidationMessage()).toContain('Seleccione un cliente');
      expect(service.resolveSendValidationFocusTab()).toBe('default');
    });

    it('validateReturn exige factura en validación', () => {
      service.validateReturn = true;
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.newReturn.idInvoice = 0;
      service.productList = [{ quProduct: 1, coDocument: 'F001' } as ReturnDetail];

      expect(service.hasReturnFieldErrors()).toBeTrue();
      expect(service.getReturnValidationMessage()).toContain('Seleccione una factura');
      expect(service.resolveSendValidationFocusTab()).toBe('default');
    });

    it('requeridedNroFactura exige coDocument por línea', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.requeridedNroFactura = true;
      service.productList = [{ quProduct: 2, coDocument: '' } as ReturnDetail];

      expect(service.hasReturnFieldErrors()).toBeTrue();
      expect(service.getReturnValidationMessage()).toContain('Complete productos');
      expect(service.resolveSendValidationFocusTab()).toBe('productos');
    });

    it('SEND-TAB-001: devolución completa resolve es null y request no emite', () => {
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.validateReturn = false;
      service.requeridedNroFactura = false;
      service.userMustActivateGPS = false;
      service.productList = [{ quProduct: 1, coDocument: 'F001' } as ReturnDetail];
      let focused: string | undefined = 'sentinel';
      service.focusSendValidationTab.subscribe((tab) => focused = tab);

      expect(service.resolveSendValidationFocusTab()).toBeNull();
      service.requestSendValidationTabFocus();
      expect(focused).toBe('sentinel');
    });

    it('devolución por enviar queda read-only', () => {
      service.newReturn.stDelivery = DELIVERY_STATUS_TO_SEND;
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      let saveEnabled: boolean | undefined;
      let sendEnabled: boolean | undefined;
      service.returnValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.returnValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSaveButtonAvailability();
      service.updateSendButtonAvailability();
      expect(saveEnabled).toBeFalse();
      expect(sendEnabled).toBeFalse();
    });

    it('devolución enviada queda read-only', () => {
      service.newReturn.stDelivery = DELIVERY_STATUS_SENT;
      service.returnSent = true;
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      let saveEnabled: boolean | undefined;
      let sendEnabled: boolean | undefined;
      service.returnValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.returnValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSaveButtonAvailability();
      service.updateSendButtonAvailability();
      expect(saveEnabled).toBeFalse();
      expect(sendEnabled).toBeFalse();
    });
  });

  describe('DEV-SEND-001 adjuntos signatureReturn', () => {
    beforeEach(() => {
      (service.globalConfig.get as jasmine.Spy).and.callFake((key: string) => {
        if (key === 'signatureReturn') {
          return 'true';
        }
        return '';
      });
      service.generalTabValidForSave = true;
      service.newReturn.idClient = 10;
      service.productList = [{ quProduct: 1, coDocument: '0' } as ReturnDetail];
    });

    it('signatureReturn no exige adjuntos (solo muestra firma)', () => {
      (service.adjuntoService.hasItems as jasmine.Spy).and.returnValue(false);

      expect(service.hasReturnFieldErrors()).toBeFalse();
    });
  });
});
