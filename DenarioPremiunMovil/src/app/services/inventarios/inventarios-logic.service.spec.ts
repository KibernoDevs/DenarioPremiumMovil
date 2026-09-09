import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { InventariosLogicService } from './inventarios-logic.service';
import { Inventarios } from 'src/app/modelos/inventarios';
import { DELIVERY_STATUS_SAVED, DELIVERY_STATUS_SENT, DELIVERY_STATUS_TO_SEND } from 'src/app/utils/appConstants';
import { ClientStockSuggestedOrder } from 'src/app/modelos/tables/client-stock-suggested-order';

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

  describe('Pedidos sugeridos sync merge', () => {
    it('no pisa snapshot local pendiente de subir si servidor no trae id', async () => {
      const executeCalls: string[] = [];
      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.callFake((sql: string) => {
          executeCalls.push(sql);
          if (sql.includes('cs_st_delivery')) {
            return Promise.resolve({
              rows: {
                length: 1,
                item: () => ({
                  id_client_stock_suggested_order: null,
                  co_client_stock_suggested_order: 'CO-SUG-1',
                  co_client_stock: 'CO-CS-1',
                  cs_st_delivery: DELIVERY_STATUS_TO_SEND,
                }),
              },
            });
          }
          return Promise.resolve({ rows: { length: 0, item: () => null } });
        }),
        sqlBatch: jasmine.createSpy('sqlBatch').and.resolveTo([]),
      } as any;

      await service.mergeSyncedSuggestedOrdersWithLocal(dbMock, [
        ClientStockSuggestedOrder.fromJson({
          coClientStockSuggestedOrder: 'CO-SUG-1',
          coClientStock: 'CO-CS-1',
          idClientStockSuggestedOrder: null,
        } as ClientStockSuggestedOrder),
      ]);

      expect(dbMock.sqlBatch).not.toHaveBeenCalled();
      expect(executeCalls.some(sql => sql.includes('INSERT OR REPLACE INTO client_stock_suggested_orders'))).toBeFalse();
    });

    it('actualiza id servidor en snapshot local pendiente cuando sync trae id', async () => {
      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.callFake((sql: string) => {
          if (sql.includes('cs_st_delivery')) {
            return Promise.resolve({
              rows: {
                length: 1,
                item: () => ({
                  id_client_stock_suggested_order: null,
                  co_client_stock_suggested_order: 'CO-SUG-1',
                  co_client_stock: 'CO-CS-1',
                  cs_st_delivery: DELIVERY_STATUS_TO_SEND,
                }),
              },
            });
          }
          if (sql.startsWith('UPDATE client_stock_suggested_orders SET id_client_stock_suggested_order')) {
            return Promise.resolve({ rows: { length: 0, item: () => null } });
          }
          return Promise.resolve({ rows: { length: 0, item: () => null } });
        }),
        sqlBatch: jasmine.createSpy('sqlBatch').and.resolveTo([]),
      } as any;

      await service.mergeSyncedSuggestedOrdersWithLocal(dbMock, [
        ClientStockSuggestedOrder.fromJson({
          coClientStockSuggestedOrder: 'CO-SUG-1',
          coClientStock: 'CO-CS-1',
          idClientStockSuggestedOrder: 99,
        } as ClientStockSuggestedOrder),
      ]);

      expect(dbMock.executeSql).toHaveBeenCalledWith(
        jasmine.stringMatching(/UPDATE client_stock_suggested_orders SET id_client_stock_suggested_order/),
        jasmine.arrayContaining([99]),
      );
    });

    it('inserta fila nueva del servidor cuando no hay local', async () => {
      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.callFake((sql: string) => {
          if (sql.includes('cs_st_delivery')) {
            return Promise.resolve({ rows: { length: 0, item: () => null } });
          }
          if (sql.includes('INSERT OR REPLACE INTO client_stock_suggested_orders')) {
            return Promise.resolve({ rows: { length: 0, item: () => null } });
          }
          return Promise.resolve({ rows: { length: 0, item: () => null } });
        }),
        sqlBatch: jasmine.createSpy('sqlBatch').and.resolveTo([]),
      } as any;

      await service.mergeSyncedSuggestedOrdersWithLocal(dbMock, [
        ClientStockSuggestedOrder.fromJson({
          coClientStockSuggestedOrder: 'CO-SUG-NEW',
          coClientStock: 'CO-CS-2',
          idClientStockSuggestedOrder: 50,
          idClient: 1,
          coClient: 'C1',
          idAddressClient: 1,
          coAddressClient: 'A1',
          idEnterprise: 1,
          coEnterprise: 'E1',
          idUser: 1,
          coUser: 'U1',
        } as ClientStockSuggestedOrder),
      ]);

      expect(dbMock.executeSql).toHaveBeenCalledWith(
        jasmine.stringMatching(/INSERT OR REPLACE INTO client_stock_suggested_orders/),
        jasmine.any(Array),
      );
    });
  });

  describe('INV-DAYS-001 resolvePositiveInventoryDays', () => {
    it('defaults undefined, NaN and values < 1 to 1', () => {
      expect(service.resolvePositiveInventoryDays(undefined)).toBe(1);
      expect(service.resolvePositiveInventoryDays(null)).toBe(1);
      expect(service.resolvePositiveInventoryDays(Number.NaN)).toBe(1);
      expect(service.resolvePositiveInventoryDays(0)).toBe(1);
      expect(service.resolvePositiveInventoryDays(-2)).toBe(1);
    });

    it('keeps valid horizon days', () => {
      expect(service.resolvePositiveInventoryDays(1)).toBe(1);
      expect(service.resolvePositiveInventoryDays(7)).toBe(7);
    });
  });

  describe('refreshSuggestedOrdersIfEnabled', () => {
    const dbMock = {} as any;

    it('limpia productsSuggested si suggestedOrder está OFF', async () => {
      service.suggestedOrder = false;
      service.productsSuggested = [{ idProduct: 1, unitsSuggested: [] }] as any;
      service.idProductsSuggested = [1];
      service.newClientStock = {
        clientStockDetails: [{ idProduct: 1, clientStockDetailUnits: [] }],
      } as any;

      await service.refreshSuggestedOrdersIfEnabled(dbMock);

      expect(service.productsSuggested).toEqual([]);
      expect(service.idProductsSuggested).toEqual([]);
    });

    it('no calcula si no hay productos en inventario', async () => {
      service.suggestedOrder = true;
      spyOn(service, 'calcularTotalesSugerenciaPedido').and.resolveTo();
      service.newClientStock = { clientStockDetails: [] } as any;

      await service.refreshSuggestedOrdersIfEnabled(dbMock);

      expect(service.calcularTotalesSugerenciaPedido).not.toHaveBeenCalled();
      expect(service.productsSuggested).toEqual([]);
    });

    it('calcula si suggestedOrder ON y hay productos', async () => {
      service.suggestedOrder = true;
      spyOn(service, 'calcularTotalesSugerenciaPedido').and.resolveTo();
      service.newClientStock = {
        clientStockDetails: [{
          idProduct: 1,
          clientStockDetailUnits: [{
            idProductUnit: 10,
            quStock: 5,
            idUnit: 1,
            coUnit: 'U',
            naUnit: 'Caja',
          }],
        }],
      } as any;

      await service.refreshSuggestedOrdersIfEnabled(dbMock);

      expect(service.calcularTotalesSugerenciaPedido).toHaveBeenCalledWith(dbMock);
    });

    it('loadSuggestedOrderConfig lee flags sin resetear inventario', () => {
      (service.globalConfig.get as jasmine.Spy).and.callFake((key: string) => {
        if (key === 'suggestedOrder') {
          return 'true';
        }
        if (key === 'suggestedOrderByDispatchAndReturn') {
          return 'false';
        }
        return '';
      });

      service.loadSuggestedOrderConfig();

      expect(service.suggestedOrder).toBeTrue();
      expect(service.suggestedOrderByDispatchAndReturn).toBeFalse();
    });

    it('initClientStockDetails carga suggestedOrder y limpia sugerencias', () => {
      (service.globalConfig.get as jasmine.Spy).and.callFake((key: string) => {
        if (key === 'suggestedOrder') {
          return 'true';
        }
        if (key === 'suggestedOrderByDispatchAndReturn') {
          return 'true';
        }
        if (key === 'signatureStock') {
          return 'false';
        }
        return '';
      });
      service.productsSuggested = [{ idProduct: 1, unitsSuggested: [] }] as any;

      service.initClientStockDetails();

      expect(service.suggestedOrder).toBeTrue();
      expect(service.suggestedOrderByDispatchAndReturn).toBeTrue();
      expect(service.productsSuggested).toEqual([]);
    });
  });
});
