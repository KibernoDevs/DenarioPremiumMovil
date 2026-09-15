import { InventarioGeneralComponent } from './inventario-general.component';

describe('InventarioGeneralComponent', () => {
  // cleanString no usa this; evitar TestBed (SQLite / sync DI).
  const cleanString = (str: string) =>
    InventarioGeneralComponent.prototype.cleanString.call({}, str);

  describe('COB-INV-COMMENT-001 cleanString', () => {
    it('preserves trailing spaces so ionInput does not eat Espacio', () => {
      expect(cleanString('hola ')).toBe('hola ');
      expect(cleanString('hola mundo')).toBe('hola mundo');
    });

    it('still strips ; \' " characters', () => {
      expect(cleanString(`hola;"'mundo"`)).toBe('holamundo');
    });
  });

  describe('INV-DAYS-001 applyClientChangeReset', () => {
    it('restores daysUntilNext and daysSinceLast to 1 after client wipe', async () => {
      const inventariosLogicService = {
        newClientStock: {
          coClientStock: 'INV1',
          daysUntilNext: 7,
          daysSinceLast: 3,
        },
        resetStockDraftOnClientChange: jasmine.createSpy('reset').and.callFake(function (this: any) {
          this.newClientStock = {
            coClientStock: 'INV1',
            daClientStock: '2026-01-01',
            daysUntilNext: 1,
            daysSinceLast: 1,
          };
        }),
        deletePersistedStockDetails: jasmine.createSpy('deleteDetails').and.resolveTo(),
        inventarioTagsDenario: new Map([['DENARIO_BOTON_ACEPTAR', 'Aceptar']]),
      };
      const ctx: any = {
        inventariosLogicService,
        adjuntoService: { setup: jasmine.createSpy('setup') },
        config: { get: () => 'false' },
        dbServ: { getDatabase: () => ({}) },
        dateServ: { hoyISOFullTime: () => 'now' },
        viewOnly: false,
        alertButtons: [{ text: '' }],
        daysSinceLastInventory: 99,
        daysUntilNextInventory: 99,
        daClientStock: '',
      };

      await InventarioGeneralComponent.prototype['applyClientChangeReset'].call(
        ctx,
        { idClient: 2 } as any,
      );

      expect(inventariosLogicService.resetStockDraftOnClientChange).toHaveBeenCalled();
      expect(inventariosLogicService.deletePersistedStockDetails).toHaveBeenCalled();
      expect(inventariosLogicService.newClientStock.daysUntilNext).toBe(1);
      expect(inventariosLogicService.newClientStock.daysSinceLast).toBe(1);
      expect(ctx.daysUntilNextInventory).toBe(1);
      expect(ctx.daysSinceLastInventory).toBe(1);
      expect(inventariosLogicService.newClientStock.coClientStock).toBe('INV1');
    });

    it('setDaysUntilNextInventory does not persist undefined as daysUntilNext', () => {
      const inventariosLogicService = {
        resolvePositiveInventoryDays: (v: number | null | undefined) => {
          const n = Number(v);
          return !Number.isFinite(n) || n < 1 ? 1 : n;
        },
        newClientStock: { daysUntilNext: undefined as number | undefined },
        refreshSuggestedOrdersIfEnabled: jasmine.createSpy('refresh').and.resolveTo(),
        notifyStockEdited: jasmine.createSpy('notify'),
      };
      const ctx: any = {
        inventariosLogicService,
        dbServ: { getDatabase: () => ({}) },
        daysUntilNextInventory: undefined,
      };

      InventarioGeneralComponent.prototype.setDaysUntilNextInventory.call(ctx);

      expect(inventariosLogicService.newClientStock.daysUntilNext).toBe(1);
      expect(ctx.daysUntilNextInventory).toBe(1);
    });
  });

  describe('INV-CLIENT-001 guard y reset al cambiar cliente', () => {
    it('setClientfromSelector no vacía la toma (reset solo por ClientChanged)', () => {
      const inventariosLogicService = {
        newClientStock: {
          idClient: 1,
          coClientStock: 'INV1',
          stDelivery: 0,
          clientStockDetails: [{ idProduct: 9 }],
        },
        empresaSeleccionada: { idEnterprise: 1, coEnterprise: 'E1' },
        cliente: { idClient: 1 },
        inventarioSent: false,
        isEdit: false,
        hasStockContentForClientChangeGuard: () => true,
        getAllAddressByClient: jasmine.createSpy('addr').and.resolveTo(true),
        onClientStockValid: jasmine.createSpy('valid'),
        notifyStockEdited: jasmine.createSpy('notify'),
        resetStockDraftOnClientChange: jasmine.createSpy('reset'),
        inventarioTags: new Map(),
      };
      const clientSelectorService = {
        checkClient: false,
        clienteAnterior: null as any,
      };
      const ctx: any = {
        inventariosLogicService,
        clientSelectorService,
        canModifyClient: () => true,
        message: { showLoading: () => Promise.resolve(), hideLoading: () => undefined },
        dateServ: { generateCO: () => 'CO', hoyISOFullTime: () => 'now' },
        dbServ: { getDatabase: () => ({}) },
        txComment: '',
        coordenada: '',
        syncClientChangeGuard: InventarioGeneralComponent.prototype['syncClientChangeGuard'],
      };

      InventarioGeneralComponent.prototype.setClientfromSelector.call(ctx, {
        idClient: 2,
        coClient: 'C2',
        lbClient: 'B',
        naClient: 'B',
      } as any);

      expect(inventariosLogicService.resetStockDraftOnClientChange).not.toHaveBeenCalled();
      expect(inventariosLogicService.newClientStock.clientStockDetails.length).toBe(1);
    });

    it('syncClientChangeGuard activa checkClient solo con toma o adjuntos', () => {
      const clientSelectorService = { checkClient: false, clienteAnterior: null as any };
      const inventariosLogicService = {
        inventarioSent: false,
        hasStockContentForClientChangeGuard: () => true,
      };
      const ctx: any = {
        clientSelectorService,
        inventariosLogicService,
        canModifyClient: () => true,
      };
      const client = { idClient: 7 } as any;

      InventarioGeneralComponent.prototype['syncClientChangeGuard'].call(ctx, client);

      expect(clientSelectorService.checkClient).toBeTrue();
      expect(clientSelectorService.clienteAnterior).toBe(client);

      inventariosLogicService.hasStockContentForClientChangeGuard = () => false;
      InventarioGeneralComponent.prototype['syncClientChangeGuard'].call(ctx, client);
      expect(clientSelectorService.checkClient).toBeFalse();
      expect(clientSelectorService.clienteAnterior).toBe(client);
    });

    it('ngAfterViewInit rearma el selector si hay idClient y toma', () => {
      const finalize = jasmine.createSpy('finalize');
      const ctx: any = {
        rearmSelectorAfterTabRestore: InventarioGeneralComponent.prototype['rearmSelectorAfterTabRestore'],
        shouldEnableClientChangeGuard: () => true,
        finalizeSavedInventoryClientGuard: finalize,
      };

      InventarioGeneralComponent.prototype.ngAfterViewInit.call(ctx);

      expect(finalize).toHaveBeenCalled();
    });
  });
});
