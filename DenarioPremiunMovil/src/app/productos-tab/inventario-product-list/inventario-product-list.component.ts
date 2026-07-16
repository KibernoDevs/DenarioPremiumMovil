
import { ChangeDetectorRef, Component, Input, OnInit, ViewChild, inject } from '@angular/core';
import { ProductUtil } from 'src/app/modelos/ProductUtil';
import { Inventarios } from 'src/app/modelos/inventarios';
import { ClientStocksDetailUnits, ClientStocksDetail, ClientStocks } from 'src/app/modelos/tables/client-stocks';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ProductStructureService } from 'src/app/services/productStructures/product-structure.service';
import { ProductService } from 'src/app/services/products/product.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { DELIVERY_STATUS_SAVED, DELIVERY_STATUS_SENT, DELIVERY_STATUS_TO_SEND, VISIT_STATUS_TO_SEND, VISIT_STATUS_VISITED } from 'src/app/utils/appConstants'
import { Subscription } from 'rxjs/internal/Subscription';
import { InfiniteScrollCustomEvent, IonInfiniteScroll } from '@ionic/angular';
import { Unit } from 'src/app/modelos/tables/unit';

interface InventoryLotRow {
  cantidad: number | null;
  lote: string;
  fechaVencimiento: string;
  unidad: Unit | null;
}

@Component({
  selector: 'inventario-product-list',
  templateUrl: './inventario-product-list.component.html',
  styleUrls: ['./inventario-product-list.component.scss'],
  standalone: false
})
export class InventarioProductListComponent implements OnInit {

  @Input()
  empresaSeleccionada!: Enterprise;
  @Input()
  productsTabTags = new Map<string, string>([]);
  @Input()
  searchText: string = '';

  public productListSub: any;
  public productStructureService = inject(ProductStructureService);
  public productService = inject(ProductService);
  public inventariosLogicService = inject(InventariosLogicService)
  public globalConfig = inject(GlobalConfigService);
  public dateServ = inject(DateServiceService);
  public services = inject(ServicesService);
  public db = inject(SynchronizationDBService);
  public message = inject(MessageService);
  public serviceImages = inject(ImageServicesService);
  public messageAlert!: MessageAlert;

  page: number = 0;

  public clientStocksTags = new Map<string, string>([]);
  public showReturnDetail: Boolean = true;
  public psClicked!: any;
  public favClicked!: any;
  public featClicked!: any;
  public idProductStructureList: number[] = [];
  public coProductStructureListString: string = "";

  public cantidadSeleccionada!: Number;
  public loteSeleccionado!: string;
  public showProductStructure: Boolean = true;
  public esconder: Boolean = false;
  public showTypeStocksModal = false;
  public selectedInventoryType: 'exh' | 'dep' = 'exh';
  public modalInventoryType: 'exh' | 'dep' = 'exh';
  public showModalTypeSelector = false;
  public inventoryFilter: 'all' | 'inventoried' = 'all';
  public fullProductList: ProductUtil[] = [];
  public inventoryRows: InventoryLotRow[] = [];
  public expirationBatch = false;
  public inventoriedProductLocations = new Map<number, Set<'exh' | 'dep'>>();
  public typeStockMethod: string = "";
  public imagesMap: { [imgName: string]: string } = {};
  searchSub: any;
  inventoryTabSub: any;
  searchTextChanged: any;
  returnBackSub: any;
  private subs = new Subscription();
  noProductsAlertShown = false;

  @ViewChild(IonInfiniteScroll)
  infiniteScroll!: IonInfiniteScroll;

  constructor(
    private cd: ChangeDetectorRef,
  ) {
  }

  ngOnInit() {

    this.expirationBatch = this.globalConfig.get('expirationBatch') === 'true';

    this.subs.add(
      this.serviceImages.imageLoaded$.subscribe(({ imgName, imgSrc }) => {
        this.imagesMap[imgName] = imgSrc;
        this.cd.markForCheck();
      })
    );

    this.searchText = '';

    console.log('Estoy en inventario');
    this.inventariosLogicService.productSelected = {} as ProductUtil
    this.psClicked = this.productService.productStructureCLicked.subscribe((data) => {
      this.inventariosLogicService.showProductList = data;
      if (this.inventariosLogicService.showProductList) {
        this.inventoryFilter = 'all';
        this.idProductStructureList = this.productStructureService.idProductStructureList;
        this.coProductStructureListString = this.productStructureService.coProductStructureListString;
        this.page = 0;
        this.productService.getProductsByCoProductStructureAndIdEnterprise(this.db.getDatabase(),
          this.idProductStructureList, this.empresaSeleccionada.idEnterprise, this.empresaSeleccionada.coCurrencyDefault, 0).then(async () => {
            this.noProductsAlertShown = false;
            await this.assignFilteredProductList(this.productService.productList, true);
            this.refreshInventoriedProducts();
            /* this.inventariosLogicService.setVariablesMap(); */
          });
      }
    });

    this.searchTextChanged = this.productService.searchTextChanged.subscribe((value) => {
      this.searchText = value;
    });

    this.searchSub = this.productService.onSearchClicked.subscribe(async (data) => {
      /*this.productService.getProductsSearchedByCoProductAndNaProduct(
        this.searchText,
        this.empresaSeleccionada.idEnterprise,
        this.empresaSeleccionada.coCurrencyDefault, 0).then(() => {*/
        this.page = 0;
      this.inventoryFilter = 'all';
      this.inventariosLogicService.showProductList = data;
      this.noProductsAlertShown = false;
      await this.assignFilteredProductList(this.productService.productList, true);
      this.refreshInventoriedProducts();
      //  });
    });

    this.inventoryTabSub = this.productService.inventoryTabClicked.subscribe(async () => {
      const currentProducts = this.inventariosLogicService.newClientStock.productList || [];
      if (this.fullProductList.length === 0 && currentProducts.length > 0) {
        this.fullProductList = [...currentProducts];
      }

      this.inventoryFilter = 'inventoried';
      this.inventariosLogicService.showProductList = true;
      this.inventariosLogicService.onStockValidToSend(true);

      const inventoriedProducts = await this.buildInventoriedProductListFromDetails();
      if (inventoriedProducts.length > 0) {
        this.inventariosLogicService.newClientStock.productList = inventoriedProducts;
      }

      this.noProductsAlertShown = this.inventariosLogicService.newClientStock.productList.length === 0;
      this.refreshInventoriedProducts();
    });

    this.featClicked = this.productService.featuredStructureClicked.subscribe((data) => {
      this.productService.getFeaturedProducts(this.db.getDatabase(),
        this.empresaSeleccionada.idEnterprise,
        this.empresaSeleccionada.coCurrencyDefault,
        this.globalConfig.get('userCanChangeWarehouse') === 'true',
        this.inventariosLogicService.cliente.idClient,
        this.inventariosLogicService.cliente.idList,
        0).then(async () => {
          this.noProductsAlertShown = false;
          this.inventoryFilter = 'all';
          this.inventariosLogicService.showProductList = data;
          await this.assignFilteredProductList(this.productService.productList, true);
          this.refreshInventoriedProducts();
        }
        )
    });

    this.favClicked = this.productService.favoriteStructureClicked.subscribe((data) => {
      this.productService.getFavoriteProducts(this.db.getDatabase(),
        this.empresaSeleccionada.idEnterprise,
        this.empresaSeleccionada.coCurrencyDefault,
        this.globalConfig.get('userCanChangeWarehouse') === 'true',
        this.inventariosLogicService.cliente.idClient,
        this.inventariosLogicService.cliente.idList,
        0).then(async () => {
          this.noProductsAlertShown = false;
          this.inventoryFilter = 'all';
          this.inventariosLogicService.showProductList = true;
          await this.assignFilteredProductList(this.productService.productList, true);
          this.refreshInventoriedProducts();
        }
        )
    });

      this.returnBackSub = this.productService.returnBackClicked.subscribe(() => {
        if (this.inventariosLogicService.showProductList) {
          this.onShowProductStructures();
        }
      });
    //}
  }

  ngOnDestroy(): void {
    this.searchSub.unsubscribe();
    this.inventoryTabSub.unsubscribe();
    this.psClicked.unsubscribe();
    this.featClicked.unsubscribe();
    this.favClicked.unsubscribe();
    this.subs.unsubscribe();
    this.searchTextChanged.unsubscribe();
    this.returnBackSub.unsubscribe();
  }

  onShowProductStructures() {
    this.inventariosLogicService.onShowProductStructures();
    this.productService.onBackButtonClicked();
    this.productService.searchStructures = true;
    /* this.inventariosLogicService.showProductList = false;
    this.productStructureService.onAddProductCLicked(); */
  }

  onSelectProductInv(index: number, prod: ProductUtil) {
    this.inventariosLogicService.productSelected = prod;
    this.inventariosLogicService.productSelectedIndex = index;
    this.inventariosLogicService.productSelected.images = this.serviceImages.getImgForProduct(prod.coProduct) ?? undefined;
    this.esconder = true;
    this.inventariosLogicService.selectedInventoryType = this.selectedInventoryType;

    this.message.showLoading().then(() => {
      this.productService.getUnitsByIdProductOrderByCoPrimaryUnit(this.db.getDatabase(), prod.idProduct).then(() => {
        const units = this.productService.unitsByProduct || [];
        const recordedLocations = this.getRecordedInventoryLocationsByProduct(prod.idProduct);
        const hasBothRecordedTypes = recordedLocations.has('exh') && recordedLocations.has('dep');

        // Regla principal: el modal sigue el tipo seleccionado en el filtro global.
        this.modalInventoryType = this.selectedInventoryType;

        // Solo mostramos selector de tipo en modal cuando estamos en Inventariados
        // y el producto tiene ambos tipos registrados.
        this.showModalTypeSelector = this.inventoryFilter === 'inventoried' && hasBothRecordedTypes;

        this.inventariosLogicService.newClientStock.productList[index].productUnitList = units;
        this.inventariosLogicService.unitSelected = units[0];
        this.loadInventoryRowsForSelectedProduct(units);
        this.showTypeStocksModal = true;
        this.message.hideLoading();
      });
    })
  }

  private loadInventoryRowsForSelectedProduct(units: Unit[]) {
    const selectedProduct = this.inventariosLogicService.productSelected;
    const detail = this.inventariosLogicService.newClientStock.clientStockDetails?.find(d => d.idProduct === selectedProduct.idProduct);
    const location = this.modalInventoryType;

    if (!detail?.clientStockDetailUnits?.length) {
      this.inventoryRows = [this.createEmptyInventoryRow(units[0] || null)];
      return;
    }

    const rows = detail.clientStockDetailUnits
      .filter(unit => unit.ubicacion === location)
      .map(unit => {
        const matchedUnit = units.find(u => u.idProductUnit === unit.idProductUnit) || units[0] || null;
        return {
          cantidad: unit.quStock,
          lote: unit.nuBatch || '',
          fechaVencimiento: unit.daExpiration || this.dateServ.hoyISO(),
          unidad: matchedUnit,
        } as InventoryLotRow;
      });

    this.inventoryRows = rows.length ? rows : [this.createEmptyInventoryRow(units[0] || null)];
  }

  private createEmptyInventoryRow(defaultUnit: Unit | null): InventoryLotRow {
    return {
      cantidad: null,
      lote: '',
      fechaVencimiento: this.dateServ.hoyISO(),
      unidad: defaultUnit,
    };
  }

  addInventoryRow() {
    const defaultUnit = this.inventariosLogicService.productSelected?.productUnitList?.[0] || null;
    this.inventoryRows.push(this.createEmptyInventoryRow(defaultUnit));
  }

  removeInventoryRow(index: number) {
    if (index < 0 || index >= this.inventoryRows.length) {
      return;
    }

    if (this.inventoryRows.length === 1) {
      const defaultUnit = this.inventariosLogicService.productSelected?.productUnitList?.[0]
        || this.inventoryRows[0]?.unidad
        || null;
      this.inventoryRows = [this.createEmptyInventoryRow(defaultUnit)];
      return;
    }

    this.inventoryRows.splice(index, 1);
  }

  saveInventoryRows() {
    const cleanRows = this.inventoryRows.filter(row =>
      row.cantidad !== null || row.lote.trim().length > 0 || !!row.unidad
    );

    if (cleanRows.length === 0) {
      this.showValidationMessage('Debe ingresar al menos un registro de inventario.');
      return;
    }

    const invalid = cleanRows.some(row => {
      const invalidQuantity = !row.cantidad || Number(row.cantidad) <= 0;
      const invalidUnit = !row.unidad;
      const invalidBatch = this.expirationBatch && !row.lote.trim();
      const invalidDate = !row.fechaVencimiento;
      return invalidQuantity || invalidUnit || invalidBatch || invalidDate;
    });

    if (invalid) {
      this.showValidationMessage('Complete cantidad, unidad, fecha y lote para continuar.');
      return;
    }

    this.applyRowsToInventory(cleanRows);
    this.inventariosLogicService.updateHeaderButtons();
    this.inventariosLogicService.isEdit = true;
    this.closeTypeStocksModal();
  }

  private showValidationMessage(message: string) {
    this.messageAlert = new MessageAlert(
      this.productsTabTags.get('PROD_STOCK_PROD') || 'Inventario',
      message,
    );
    this.message.alertModal(this.messageAlert);
  }

  private applyRowsToInventory(rows: InventoryLotRow[]) {
    const selectedProduct = this.inventariosLogicService.productSelected;
    const location = this.modalInventoryType;

    this.inventariosLogicService.typeStocks = this.inventariosLogicService.typeStocks.filter(typeStock =>
      !(typeStock.idProduct === selectedProduct.idProduct && typeStock.tipo === location)
    );

    let detail = this.inventariosLogicService.newClientStock.clientStockDetails.find(d => d.idProduct === selectedProduct.idProduct);
    if (!detail) {
      detail = {} as ClientStocksDetail;
      detail.idClientStockDetail = 0;
      detail.coClientStockDetail = this.dateServ.generateCO(0);
      detail.coClientStock = this.inventariosLogicService.newClientStock.coClientStock;
      detail.idProduct = selectedProduct.idProduct;
      detail.coProduct = selectedProduct.coProduct;
      detail.naProduct = selectedProduct.naProduct;
      detail.coEnterprise = this.inventariosLogicService.newClientStock.coEnterprise;
      detail.idEnterprise = this.inventariosLogicService.newClientStock.idEnterprise;
      detail.posicion = 0;
      detail.isEdit = true;
      detail.isSave = true;
      detail.clientStockDetailUnits = [] as ClientStocksDetailUnits[];
      this.inventariosLogicService.newClientStock.clientStockDetails.push(detail);
    }

    detail.clientStockDetailUnits = (detail.clientStockDetailUnits || []).filter(unit => unit.ubicacion !== location);

    rows.forEach((row, idx) => {
      const unit = row.unidad!;

      const typeStock = {} as Inventarios;
      typeStock.tipo = location;
      typeStock.idProduct = selectedProduct.idProduct;
      typeStock.fechaVencimiento = row.fechaVencimiento;
      typeStock.validateCantidad = Number(row.cantidad) > 0;
      typeStock.validateLote = this.expirationBatch ? row.lote.trim().length > 0 : true;
      typeStock.showDateModalDep = false;
      typeStock.showDateModalExh = false;
      typeStock.clientStockDetail = [detail];
      typeStock.cantidad = Number(row.cantidad);
      typeStock.lote = row.lote;
      typeStock.unidad = unit.naUnit;
      this.inventariosLogicService.typeStocks.push(typeStock);

      const detailUnit = {} as ClientStocksDetailUnits;
      detailUnit.idClientStockDetailUnit = 0;
      // coClientStockDetailUnit is a PK in SQLite. It must be unique per row.
      detailUnit.coClientStockDetailUnit = this.dateServ.generateCO(idx + 1);
      detailUnit.coClientStockDetail = detail!.coClientStockDetail;
      detailUnit.idProductUnit = unit.idProductUnit;
      detailUnit.coProductUnit = unit.coProductUnit;
      detailUnit.idUnit = unit.idUnit;
      detailUnit.coUnit = unit.coUnit;
      detailUnit.quUnit = unit.quUnit;
      detailUnit.naUnit = unit.naUnit;
      detailUnit.quStock = Number(row.cantidad);
      detailUnit.quSuggested = 0;
      detailUnit.coEnterprise = this.inventariosLogicService.newClientStock.coEnterprise;
      detailUnit.idEnterprise = this.inventariosLogicService.newClientStock.idEnterprise;
      detailUnit.ubicacion = location;
      detailUnit.isEdit = true;
      detailUnit.isSave = true;
      detailUnit.posicion = idx;
      detailUnit.nuBatch = row.lote.trim();
      detailUnit.daExpiration = row.fechaVencimiento;
      detail.clientStockDetailUnits.push(detailUnit);
    });

    const detailIndex = this.inventariosLogicService.newClientStock.clientStockDetails.findIndex(d => d.idProduct === selectedProduct.idProduct);
    if (detailIndex >= 0) {
      this.inventariosLogicService.productTypeStocksMap.set(selectedProduct.idProduct, detailIndex);
    }

    this.inventariosLogicService.typeExh = this.inventariosLogicService.typeStocks.some(stock => stock.tipo === 'exh');
    this.inventariosLogicService.typeDep = this.inventariosLogicService.typeStocks.some(stock => stock.tipo === 'dep');
    this.inventariosLogicService.onStockValidToSave(true);
    this.inventariosLogicService.onStockValidToSend(true);
    this.refreshInventoriedProducts();
  }

  refreshInventoriedProducts() {
    this.inventoriedProductLocations.clear();
    const details = this.inventariosLogicService.newClientStock.clientStockDetails || [];

    details.forEach(detail => {
      if (detail?.idProduct && detail.clientStockDetailUnits?.length) {
        detail.clientStockDetailUnits.forEach(unit => {
          if (Number(unit.quStock) <= 0) {
            return;
          }

          const normalizedLocation = this.normalizeInventoryLocation(unit.ubicacion);
          if (!normalizedLocation) {
            return;
          }

          const currentLocations = this.inventoriedProductLocations.get(detail.idProduct) || new Set<'exh' | 'dep'>();
          currentLocations.add(normalizedLocation);
          this.inventoriedProductLocations.set(detail.idProduct, currentLocations);
        });
      }
    });
  }

  private async filterProductsWithUnits(products: ProductUtil[]): Promise<ProductUtil[]> {
    if (!products.length) {
      return [];
    }

    const idProducts = products.map(product => product.idProduct);
    const idsWithUnits = await this.productService.getIdProductsWithProductUnits(
      this.db.getDatabase(),
      idProducts,
    );

    return products.filter(product => idsWithUnits.has(product.idProduct));
  }

  private async assignFilteredProductList(
    products: ProductUtil[],
    updateFullList: boolean,
  ): Promise<ProductUtil[]> {
    const filtered = await this.filterProductsWithUnits(products);
    this.inventariosLogicService.newClientStock.productList = filtered;
    if (updateFullList) {
      this.fullProductList = [...filtered];
    }
    this.noProductsAlertShown = filtered.length === 0;
    return filtered;
  }

  private async buildInventoriedProductListFromDetails(): Promise<ProductUtil[]> {
    const details = this.inventariosLogicService.newClientStock.clientStockDetails || [];
    const currentProductList = this.inventariosLogicService.newClientStock.productList || [];
    const currentById = new Map<number, ProductUtil>(currentProductList.map(p => [p.idProduct, p]));

    const inventoriedProducts = details
      .filter(detail => (detail.clientStockDetailUnits || []).some(unit => Number(unit.quStock) > 0))
      .map(detail => {
        const existing = currentById.get(detail.idProduct);
        if (existing) {
          return existing;
        }

        return {
          idProduct: detail.idProduct,
          coProduct: detail.coProduct,
          naProduct: detail.naProduct,
          points: 0,
          txDescription: '',
          idList: 0,
          price: 0,
          coCurrency: this.empresaSeleccionada.coCurrencyDefault,
          priceOpposite: 0,
          coCurrencyOpposite: this.empresaSeleccionada.coCurrencyDefault,
          stock: 0,
          idEnterprise: detail.idEnterprise,
          coEnterprise: detail.coEnterprise,
          images: this.serviceImages.getImgForProduct(detail.coProduct) ?? '../../../assets/images/nodisponible.png',
          typeStocks: undefined,
          productUnitList: undefined,
          idProductStructure: 0,
          nuTax: 0,
        } as ProductUtil;
      });

    return this.filterProductsWithUnits(inventoriedProducts);
  }

  private normalizeInventoryLocation(value: string | undefined | null): 'exh' | 'dep' | null {
    const location = (value || '').toLowerCase();
    if (location === 'exh' || location.includes('exhib')) {
      return 'exh';
    }
    if (location === 'dep' || location.includes('depo')) {
      return 'dep';
    }
    return null;
  }

  isProductInventoried(product: ProductUtil): boolean {
    const locations = this.inventoriedProductLocations.get(product.idProduct);
    return !!locations && locations.size > 0;
  }

  isProductInventoriedBySelectedType(product: ProductUtil): boolean {
    const locations = this.inventoriedProductLocations.get(product.idProduct);
    return !!locations && locations.has(this.selectedInventoryType);
  }

  getInventoryLocationLabel(product: ProductUtil): string {
    const locations = this.inventoriedProductLocations.get(product.idProduct);
    if (!locations || locations.size === 0) {
      return '';
    }

    const labels: string[] = [];
    if (locations.has('exh')) {
      labels.push(this.productsTabTags.get('PROD_INV_SEGMENT_EXH') || 'Exhibición');
    }
    if (locations.has('dep')) {
      labels.push(this.productsTabTags.get('PROD_INV_SEGMENT_DEP') || 'Depósito');
    }

    return labels.join(' / ');
  }

  onInventoryTypeChanged(type: string | number | undefined | null) {
    const normalizedType: 'exh' | 'dep' = type === 'dep' ? 'dep' : 'exh';
    this.selectedInventoryType = normalizedType;
    this.inventariosLogicService.selectedInventoryType = normalizedType;
  }

  onModalInventoryTypeChanged(type: string | number | undefined | null) {
    const normalizedType: 'exh' | 'dep' = type === 'dep' ? 'dep' : 'exh';
    this.modalInventoryType = normalizedType;
    const units = this.inventariosLogicService.productSelected?.productUnitList || [];
    this.loadInventoryRowsForSelectedProduct(units);
  }

  private getRecordedInventoryLocationsByProduct(idProduct: number): Set<'exh' | 'dep'> {
    const locations = new Set<'exh' | 'dep'>();
    const detail = this.inventariosLogicService.newClientStock.clientStockDetails?.find(d => d.idProduct === idProduct);

    if (!detail?.clientStockDetailUnits?.length) {
      return locations;
    }

    detail.clientStockDetailUnits.forEach(unit => {
      if (Number(unit.quStock) <= 0) {
        return;
      }
      const normalized = this.normalizeInventoryLocation(unit.ubicacion);
      if (normalized) {
        locations.add(normalized);
      }
    });

    return locations;
  }

  onInventoryFilterChanged(value: string | number | undefined | null) {
    const previousFilter = this.inventoryFilter;
    const filter = value === 'inventoried' ? 'inventoried' : 'all';
    this.inventoryFilter = filter;

    if (filter === 'inventoried' && previousFilter === 'all') {
      const currentProducts = this.inventariosLogicService.newClientStock.productList || [];
      if (currentProducts.length > 0) {
        this.fullProductList = [...currentProducts];
      }
    }

    if (filter === 'all') {
      if (this.fullProductList.length > 0) {
        this.inventariosLogicService.newClientStock.productList = [...this.fullProductList];
        this.noProductsAlertShown = this.inventariosLogicService.newClientStock.productList.length === 0;
        return;
      }

      if (this.idProductStructureList.length > 0) {
        this.page = 0;
        this.productService.getProductsByCoProductStructureAndIdEnterprise(
          this.db.getDatabase(),
          this.idProductStructureList,
          this.empresaSeleccionada.idEnterprise,
          this.empresaSeleccionada.coCurrencyDefault,
          0
        ).then(async () => {
          await this.assignFilteredProductList(this.productService.productList, true);
        });
        return;
      }

      this.page = 0;
      this.productService.getProductsSearchedByCoProductAndNaProduct(
        this.db.getDatabase(),
        '',
        this.empresaSeleccionada.idEnterprise,
        this.empresaSeleccionada.coCurrencyDefault,
        0
      ).then(async () => {
        await this.assignFilteredProductList(this.productService.productList, true);
      });
      return;
    }

    this.buildInventoriedProductListFromDetails().then(inventoriedProducts => {
      this.inventariosLogicService.newClientStock.productList = inventoriedProducts;
      this.noProductsAlertShown = inventoriedProducts.length === 0;
    });
  }

  getVisibleProducts(): ProductUtil[] {
    const productList = this.inventariosLogicService.newClientStock.productList || [];
    const search = (this.searchText || '').trim().toLowerCase();

    return productList.filter(product => {
      const matchSearch = !search
        || product.coProduct.toLowerCase().includes(search)
        || product.naProduct.toLowerCase().includes(search);

      if (!matchSearch) {
        return false;
      }

      const isInventoried = this.isProductInventoriedBySelectedType(product);
      if (this.inventoryFilter === 'inventoried') {
        return isInventoried;
      }

      return true;
    });
  }

  closeTypeStocksModal() {
    this.showTypeStocksModal = false;
    this.inventoryRows = [];
    this.showModalTypeSelector = false;
  }

  compareWith(o1: any, o2: any) {
    return "";
    /* return o1 && o2 ? o1.id === o2.id : o1 === o2; */
  }

  imprimir() {
    console.log(this.inventariosLogicService.newClientStock)
    //console.log(this.serviceImages.mapImages)
  }

   onIonInfinite(ev: any) {
      this.page++;
      if (this.searchText) {
        this.productService.getProductsSearchedByCoProductAndNaProduct(this.db.getDatabase(),
          this.searchText, this.empresaSeleccionada.idEnterprise, this.empresaSeleccionada.coCurrencyDefault, this.page).then(async () => {
            const filteredPage = await this.filterProductsWithUnits(this.productService.productList);
            this.inventariosLogicService.newClientStock.productList =
            [...this.inventariosLogicService.newClientStock.productList, ...filteredPage];
            if (this.inventoryFilter === 'all') {
              this.fullProductList = [...this.inventariosLogicService.newClientStock.productList];
            }
            if (this.productService.productList.length < this.productService.MAX_ITEMS_PER_PAGE) {
              this.infiniteScroll.disabled = true;
            }
            (ev as InfiniteScrollCustomEvent).target.complete();
          });
      } else {
        this.productService.getProductsByCoProductStructureAndIdEnterprise(this.db.getDatabase(),
          this.idProductStructureList, this.empresaSeleccionada.idEnterprise, this.empresaSeleccionada.coCurrencyDefault, this.page).then(async () => {
            const filteredPage = await this.filterProductsWithUnits(this.productService.productList);
            this.inventariosLogicService.newClientStock.productList = [...this.inventariosLogicService.newClientStock.productList, ...filteredPage];
            if (this.inventoryFilter === 'all') {
              this.fullProductList = [...this.inventariosLogicService.newClientStock.productList];
            }
            if (this.productService.productList.length < this.productService.MAX_ITEMS_PER_PAGE) {
              this.infiniteScroll.disabled = true;
            }
            (ev as InfiniteScrollCustomEvent).target.complete();
          });
        }

    }


}
