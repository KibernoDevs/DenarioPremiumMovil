import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { InventariosLogicService } from './inventarios-logic.service';
import { Inventarios } from 'src/app/modelos/inventarios';
import { DELIVERY_STATUS_SAVED, DELIVERY_STATUS_TO_SEND } from 'src/app/utils/appConstants';

describe('InventariosLogicService', () => {
  let service: InventariosLogicService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(InventariosLogicService);
    service.newClientStock = { stDelivery: DELIVERY_STATUS_SAVED } as any;
    service.inventarioTags.set('INV_MSJ_ERROR_TYPESTOCKS', 'Debe ingresar alguna cantidad de Inventario');
    service.inventarioTags.set('INV_MSJ_ERROR_NO_PRODUCTS', 'Debe seleccionar al menos un producto para el inventario.');
    service.inventarioTags.set('INV_MSJ_ERROR_NO_ATTACHMENTS', 'Debe adjuntar firma');
    service.inventarioTags.set('INV_MSJ_ERROR_INCOMPLETE_QTY', 'Complete cantidad');
    service.inventarioTags.set('INV_MSJ_ERROR_NO_GPS', 'Debe activar GPS');
    service.inventarioTags.set('INV_ERROR_LIST_ADDRESS', 'Sin sucursal');
    service.adjuntoService.weightLimitExceeded = false;
    spyOn(service.adjuntoService, 'hasItems').and.returnValue(true);
    spyOn(service.globalConfig, 'get').and.callFake((key: string) => {
      if (key === 'signatureStock') {
        return 'false';
      }
      return '';
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('INV-SAVE-001 Guardar tras General válida', () => {
    it('cobro nuevo sin baseline permite Guardar con General válida', () => {
      service.generalTabValidForSave = true;
      service.resetStockExitBaseline();
      let saveEnabled: boolean | undefined;
      service.stockValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });

    it('baseline limpio deshabilita Guardar aunque General sea válida', () => {
      service.generalTabValidForSave = true;
      service.stockPersistedBaseline = true;
      service.stockDirtySincePersist = false;
      let saveEnabled: boolean | undefined;
      service.stockValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeFalse();
    });

    it('markStockDirty re-habilita Guardar tras baseline', () => {
      service.generalTabValidForSave = true;
      let saveEnabled: boolean | undefined;
      service.stockValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.applyPersistSucceededBaseline();

      expect(saveEnabled).toBeFalse();
      service.markStockDirty();
      expect(saveEnabled).toBeTrue();
    });

    it('reapertura persistida deja Guardar OFF hasta dirty', () => {
      service.generalTabValidForSave = true;
      let saveEnabled: boolean | undefined;
      service.stockValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.markStockOpenedFromPersistedCopy();
      expect(saveEnabled).toBeFalse();

      service.markStockDirty();
      expect(saveEnabled).toBeTrue();
    });

    it('hasStockSaveErrors false sin productos si General OK', () => {
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.typeStocks = [];

      expect(service.hasStockSaveErrors()).toBeFalse();
      expect(service.hasStockFieldErrors()).toBeTrue();
    });
  });

  describe('INV-SEND-001 Enviar y validación al click', () => {
    it('Enviar ON con General válida aunque productos incompletos', () => {
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.typeStocks = [{
        validateCantidad: false,
        validateLote: false,
      } as unknown as Inventarios];
      let sendEnabled: boolean | undefined;
      service.stockValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeTrue();
    });

    it('hasStockFieldErrors true sin filas de inventario', () => {
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.typeStocks = [];

      expect(service.hasStockFieldErrors()).toBeTrue();
      expect(service.getStockValidationMessage()).toContain('seleccionar al menos un producto');
      expect(service.getStockValidationMessage()).not.toContain('cantidad de Inventario');
    });

    it('sin tag NO_PRODUCTS no cae en TYPESTOCKS', () => {
      service.inventarioTags.delete('INV_MSJ_ERROR_NO_PRODUCTS');
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.typeStocks = [];

      const msg = service.getStockValidationMessage();
      expect(msg).toContain('seleccionar al menos un producto');
      expect(msg).not.toContain('borrar el tipo');
      expect(msg).not.toContain('cantidad de Inventario');
    });

    it('hasStockFieldErrors true con cantidad incompleta', () => {
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.typeStocks = [{
        validateCantidad: false,
        validateLote: true,
      } as unknown as Inventarios];

      expect(service.hasStockFieldErrors()).toBeTrue();
      expect(service.getStockValidationMessage()).toContain('Complete cantidad');
    });

    it('inventario vacío prioriza mensaje de productos sobre adjuntos', () => {
      (service.globalConfig.get as jasmine.Spy).and.callFake((key: string) => {
        if (key === 'signatureStock') {
          return 'true';
        }
        return '';
      });
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.typeStocks = [];
      (service.adjuntoService.hasItems as jasmine.Spy).and.returnValue(false);

      expect(service.hasStockFieldErrors()).toBeTrue();
      expect(service.getStockValidationMessage()).toContain('seleccionar al menos un producto');
      expect(service.getStockValidationMessage()).not.toContain('Debe adjuntar firma');
    });

    it('sendBlockedByFields apaga Enviar hasta editar', () => {
      service.generalTabValidForSave = true;
      service.sendBlockedByFields = true;
      let sendEnabled: boolean | undefined;
      service.stockValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeFalse();
    });

    it('al editar se limpia sendBlockedByFields y Enviar vuelve ON', () => {
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.sendBlockedByFields = true;
      service.typeStocks = [{
        validateCantidad: false,
        validateLote: true,
      } as unknown as Inventarios];
      let sendEnabled: boolean | undefined;
      service.stockValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeFalse();
      expect(service.sendBlockedByFields).toBeTrue();

      service.notifyStockEdited();
      expect(service.sendBlockedByFields).toBeFalse();
      expect(sendEnabled).toBeTrue();
    });

    it('inventario por enviar queda read-only', () => {
      service.newClientStock.stDelivery = DELIVERY_STATUS_TO_SEND;
      service.generalTabValidForSave = true;
      let saveEnabled: boolean | undefined;
      let sendEnabled: boolean | undefined;
      service.stockValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.stockValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSaveButtonAvailability();
      service.updateSendButtonAvailability();
      expect(saveEnabled).toBeFalse();
      expect(sendEnabled).toBeFalse();
    });

    it('sin productos enfoca pestaña inventario', () => {
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.hideTab = true;
      service.typeStocks = [];

      expect(service.resolveSendValidationFocusTab()).toBe('inventario');
    });

    it('con productos completos y signatureStock no enfoca adjuntos', () => {
      (service.globalConfig.get as jasmine.Spy).and.callFake((key: string) => {
        if (key === 'signatureStock') {
          return 'true';
        }
        return '';
      });
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.hideTab = true;
      service.typeStocks = [{ validateCantidad: true, validateLote: true } as unknown as Inventarios];
      (service.adjuntoService.hasItems as jasmine.Spy).and.returnValue(false);

      expect(service.resolveSendValidationFocusTab()).toBeNull();
    });

    it('SEND-TAB-001: sin errores resolve es null y request no emite', () => {
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.hideTab = true;
      service.typeStocks = [{ validateCantidad: true, validateLote: true } as unknown as Inventarios];
      let focused: string | undefined = 'sentinel';
      service.focusSendValidationTab.subscribe((tab) => focused = tab);

      expect(service.resolveSendValidationFocusTab()).toBeNull();
      service.requestSendValidationTabFocus();
      expect(focused).toBe('sentinel');
    });

    it('requestSendValidationTabFocus emite la pestaña resuelta', () => {
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.hideTab = true;
      service.typeStocks = [];
      let focused: string | undefined;
      service.focusSendValidationTab.subscribe((tab) => focused = tab);

      service.requestSendValidationTabFocus();
      expect(focused).toBe('inventario');
    });
  });

  describe('INV-SEND-001 adjuntos signatureStock', () => {
    beforeEach(() => {
      (service.globalConfig.get as jasmine.Spy).and.callFake((key: string) => {
        if (key === 'signatureStock') {
          return 'true';
        }
        return '';
      });
    });

    it('signatureStock no exige adjuntos (solo muestra firma)', () => {
      service.generalTabValidForSave = true;
      service.selectedClient = true;
      service.typeStocks = [{ validateCantidad: true, validateLote: true } as unknown as Inventarios];
      (service.adjuntoService.hasItems as jasmine.Spy).and.returnValue(false);

      expect(service.hasStockFieldErrors()).toBeFalse();
    });
  });
});
