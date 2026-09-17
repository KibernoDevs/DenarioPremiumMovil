import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { InventarioActividadesComponent } from './inventario-actividades.component';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';
import { ProductSuggestedUtil, UnitSuggestedUtil } from 'src/app/modelos/ProductSuggestedUtil';
import {
  configureIonicComponentTestingModule,
  createShallowComponentFixture,
} from 'src/app/testing/ionic-component-spec.helpers';

describe('InventarioActividadesComponent', () => {
  let component: InventarioActividadesComponent;
  let fixture: ComponentFixture<InventarioActividadesComponent>;
  let inventariosLogicService: InventariosLogicService;

  beforeEach(waitForAsync(() => {
    configureIonicComponentTestingModule(InventarioActividadesComponent).compileComponents();
  }));

  beforeEach(() => {
    ({ fixture, component } = createShallowComponentFixture(InventarioActividadesComponent));
    inventariosLogicService = TestBed.inject(InventariosLogicService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('columna Sugerido en Resumen', () => {
    it('arma suggestedEntries cuando suggestedOrder ON', () => {
      inventariosLogicService.suggestedOrder = true;
      inventariosLogicService.newClientStock = {
        clientStockDetails: [{
          idProduct: 10,
          coProduct: 'P10',
          naProduct: 'Producto 10',
          clientStockDetailUnits: [{
            idProductUnit: 100,
            naUnit: 'Caja',
            quStock: 5,
            ubicacion: 'exh',
          }],
        }],
      } as any;
      inventariosLogicService.productsSuggested = [
        new ProductSuggestedUtil(10, [
          new UnitSuggestedUtil(1, 'CAJ', 100, 12, 0, 5, 0, 0, 0, 0, 0, 0),
        ]),
      ];

      (component as any).rebuildTableData();

      expect(component.inventoryRows.length).toBe(1);
      expect(component.inventoryRows[0].suggestedEntries).toEqual(['12 Caja']);
    });

    it('no arma suggestedEntries cuando suggestedOrder OFF', () => {
      inventariosLogicService.suggestedOrder = false;
      inventariosLogicService.newClientStock = {
        clientStockDetails: [{
          idProduct: 10,
          coProduct: 'P10',
          naProduct: 'Producto 10',
          clientStockDetailUnits: [{
            idProductUnit: 100,
            naUnit: 'Caja',
            quStock: 5,
            ubicacion: 'exh',
          }],
        }],
      } as any;
      inventariosLogicService.productsSuggested = [
        new ProductSuggestedUtil(10, [
          new UnitSuggestedUtil(1, 'CAJ', 100, 12, 0, 5, 0, 0, 0, 0, 0, 0),
        ]),
      ];

      (component as any).rebuildTableData();

      expect(component.inventoryRows[0].suggestedEntries).toEqual([]);
    });
  });

  describe('INV-SUG-003 preview no persiste', () => {
    it('preguntarSugerirPedido no llama saveSuggestedOrderSnapshot', async () => {
      (inventariosLogicService as any).calcularTotalesSugerenciaPedido = jasmine.createSpy(
        'calcularTotalesSugerenciaPedido',
      ).and.resolveTo();
      (inventariosLogicService as any).saveSuggestedOrderSnapshot = jasmine.createSpy(
        'saveSuggestedOrderSnapshot',
      ).and.resolveTo();
      (inventariosLogicService as any).markPendingSuggestedOrderPersist = jasmine.createSpy(
        'markPendingSuggestedOrderPersist',
      );
      (inventariosLogicService as any).productsSuggested = [];
      (inventariosLogicService as any).inventarioTags = new Map<string, string>();
      (inventariosLogicService as any).empresaSeleccionada = { idEnterprise: 1 };
      inventariosLogicService.newClientStock = {
        coClientStock: 'CS-1',
        clientStockDetails: [],
        daysSinceLast: 1,
        daysUntilNext: 1,
      } as any;
      (component.orderServ as { getTag?: (k: string) => string }).getTag = () => 'Moneda';
      spyOn(component.modalCtrl, 'create').and.resolveTo({
        present: () => Promise.resolve(),
        onDidDismiss: () => Promise.resolve({ role: 'cancel', data: undefined }),
      } as any);

      await component.preguntarSugerirPedido();

      expect(inventariosLogicService.markPendingSuggestedOrderPersist).toHaveBeenCalledWith('CS-1');
      expect(inventariosLogicService.calcularTotalesSugerenciaPedido).toHaveBeenCalled();
      expect(inventariosLogicService.saveSuggestedOrderSnapshot).not.toHaveBeenCalled();
    });
  });
});
