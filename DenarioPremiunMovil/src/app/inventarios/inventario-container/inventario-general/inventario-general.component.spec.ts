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
    it('restores daysUntilNext and daysSinceLast to 1 after client wipe', () => {
      const inventariosLogicService = {
        alertMessage: true,
        selectedClient: true,
        inventarioSent: true,
        disableSaveButton: false,
        cannotSendClientStock: false,
        newClientStock: {
          coClientStock: 'INV1',
          idClientStock: 9,
          stDelivery: 1,
          stClientStock: 1,
          daClientStock: '2026-01-01',
          daysUntilNext: 7,
          daysSinceLast: 3,
        },
        productTypeStocksMap: new Map(),
        typeStocks: [{ id: 1 }],
        initInventario: true,
        inventarioTagsDenario: new Map([
          ['DENARIO_BOTON_ACEPTAR', 'Aceptar'],
          ['DENARIO_BOTON_CANCELAR', 'Cancelar'],
        ]),
        alertMessageOpen: true,
      };
      const ctx: any = {
        inventariosLogicService,
        adjuntoService: { setup: jasmine.createSpy('setup') },
        config: { get: () => 'false' },
        dbServ: { getDatabase: () => ({}) },
        dateServ: { hoyISOFullTime: () => 'now' },
        viewOnly: false,
        alertButtons: [{ text: '' }],
        alertButtons2: [{ text: '' }, { text: '' }],
        changeClient: true,
        daysSinceLastInventory: 99,
        daysUntilNextInventory: 99,
        daClientStock: '',
      };

      InventarioGeneralComponent.prototype['applyClientChangeReset'].call(
        ctx,
        { idClient: 2 } as any,
      );

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
});
