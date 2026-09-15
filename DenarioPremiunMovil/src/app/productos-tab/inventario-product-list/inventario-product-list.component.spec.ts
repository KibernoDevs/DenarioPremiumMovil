import { InventarioProductListComponent } from './inventario-product-list.component';
import { ProductUtil } from 'src/app/modelos/ProductUtil';

describe('InventarioProductListComponent', () => {
  // Evitar TestBed (SQLite/sync DI). Probar filtro visible en aislamiento.
  function createComponentForVisibleFilter(
    products: Partial<ProductUtil>[],
    searchText: string,
  ): InventarioProductListComponent {
    const component = Object.create(
      InventarioProductListComponent.prototype,
    ) as InventarioProductListComponent;
    component.searchText = searchText;
    component.inventoryFilter = 'all';
    component.inventariosLogicService = {
      newClientStock: { productList: products as ProductUtil[] },
    } as any;
    component.isProductInventoriedBySelectedType = () => false;
    return component;
  }

  describe('INV-SEARCH-001 getVisibleProducts accent-insensitive', () => {
    const products = [
      { coProduct: 'A01', naProduct: 'Azúcar refinada' },
      { coProduct: 'A02', naProduct: 'Calorías light' },
      { coProduct: 'B01', naProduct: 'Cafe molido' },
    ];

    it('encuentra Azúcar al buscar sin tilde (azucar)', () => {
      const component = createComponentForVisibleFilter(products, 'azucar');
      const visible = component.getVisibleProducts();
      expect(visible.map(p => p.coProduct)).toEqual(['A01']);
    });

    it('encuentra Azúcar al buscar con tilde (azúcar)', () => {
      const component = createComponentForVisibleFilter(products, 'azúcar');
      const visible = component.getVisibleProducts();
      expect(visible.map(p => p.coProduct)).toEqual(['A01']);
    });

    it('encuentra Calorías al buscar sin tilde (calorias)', () => {
      const component = createComponentForVisibleFilter(products, 'calorias');
      const visible = component.getVisibleProducts();
      expect(visible.map(p => p.coProduct)).toEqual(['A02']);
    });

    it('sin texto de búsqueda muestra todos', () => {
      const component = createComponentForVisibleFilter(products, '');
      expect(component.getVisibleProducts().length).toBe(3);
    });
  });

  describe('INV-CLIENT-001 arm guard al persistir cantidad', () => {
    it('applyRowsToInventory llama armClientChangeGuardAfterStockEdit', () => {
      const component = Object.create(
        InventarioProductListComponent.prototype,
      ) as InventarioProductListComponent;
      const arm = jasmine.createSpy('arm');
      const detail = {
        idProduct: 1,
        clientStockDetailUnits: [] as any[],
      };
      component.inventariosLogicService = {
        productSelected: { idProduct: 1, coProduct: 'P1', naProduct: 'Prod' },
        typeStocks: [],
        newClientStock: {
          coClientStock: 'INV1',
          coEnterprise: 'E',
          idEnterprise: 1,
          clientStockDetails: [detail],
        },
        productTypeStocksMap: new Map(),
        notifyStockEdited: jasmine.createSpy('notify'),
        armClientChangeGuardAfterStockEdit: arm,
      } as any;
      component.modalInventoryType = 'exh';
      component.expirationBatch = false;
      component.dateServ = { generateCO: () => 'U1' } as any;
      component.refreshInventoriedProducts = () => undefined;
      component.clientSelectorService = { checkClient: false, clienteAnterior: null } as any;

      (component as any).applyRowsToInventory([
        {
          cantidad: 2,
          lote: '',
          fechaVencimiento: '2026-01-01',
          unidad: {
            idProductUnit: 1,
            coProductUnit: 'PU',
            idUnit: 1,
            coUnit: 'UN',
            quUnit: 1,
            naUnit: 'UND',
          },
        },
      ]);

      expect(arm).toHaveBeenCalled();
    });
  });
});
