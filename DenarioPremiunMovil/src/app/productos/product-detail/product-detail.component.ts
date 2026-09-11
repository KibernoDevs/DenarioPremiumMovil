import { Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { ProductDetail } from 'src/app/modelos/ProductDetail';
import { List } from 'src/app/modelos/tables/list';
import { PriceListService } from 'src/app/services/priceLists/price-list.service';
import { Warehouse } from 'src/app/modelos/tables/warehouse';
import { StockService } from 'src/app/services/stocks/stock.service';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { Swiper } from 'swiper';
import { register } from 'swiper/element/bundle';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { ProductService } from 'src/app/services/products/product.service';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { CurrencyModules } from 'src/app/modelos/tables/currencyModules';
import { TextService } from 'src/app/services/text/text.service';
import { UnitInfo } from 'src/app/modelos/unitInfo';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

register();

@Component({
    selector: 'product-detail',
    templateUrl: './product-detail.component.html',
    styleUrls: ['./product-detail.component.scss'],
    standalone: false
})
export class ProductDetailComponent implements OnInit, OnChanges {

  priceListService = inject(PriceListService);
  productService = inject(ProductService);
  pedidosService = inject(PedidosService);
  stockService = inject(StockService);
  imageServices = inject(ImageServicesService);
  globalConfig = inject(GlobalConfigService);
  currencyService = inject(CurrencyService);
  textService = inject(TextService);
  db = inject(SynchronizationDBService);

  @Input()
  productDetailTags = new Map<string, string>([]);
  @Input()
  pSeleccionado!: ProductDetail;

  multiCurrency!: Boolean;
  conversionByPriceList!: Boolean;
  currencyModuleEnabled!: Boolean;
  localCurrencyDefault: Boolean = true;
  showConversionInfo: Boolean = true;
  enableCurrencySwitch: Boolean = false;//Por si aun no tienen currencyModule activado
  hideProductWarehouse: Boolean = false;
  listSeleccionada!: List;
  lists: List[] = [];
  warehouseSeleccionado!: Warehouse;
  warehouses: Warehouse[] = [];
  //listPhotos: Imagenes[] = [];
  listPhotos: string[] = [];
  productImages: string[] = [];
  listPrices?: {idList: number, naList: string, nuPrice: number, coUnit: string, naUnit: string, coCurrency: string}[] = [];
  unitList: UnitInfo[] = [];
  selectedIdUnit = 0;
  basePriceLocal = 0;
  basePriceHard: number | null = null;
  imageZoomOpen = false;
  /** Índice del carrusel al abrir el zoom (foto visible/pulsada). */
  imageZoomStartIndex = 0;

  @ViewChild('zoomSwiper') zoomSwiper?: ElementRef<HTMLElement & { swiper?: { slideTo: (i: number, speed?: number) => void } }>;

  public swiper!: Swiper;

  constructor() { }

  async ngOnInit() {
    /* this.getProductImages(); */
    await this.productService.syncOrderPresentationFromPedidos(this.pedidosService);
    this.multiCurrency = this.globalConfig.get("multiCurrency") == "true";
    this.conversionByPriceList = this.globalConfig.get("conversionByPriceList").toLowerCase() === "true";
    this.currencyModuleEnabled = this.globalConfig.get("currencyModule").toLowerCase() === "true";
    this.hideProductWarehouse = this.globalConfig.get("hideProductWarehouse") == "true";
    var currencyModule: CurrencyModules = this.currencyService.getCurrencyModule('pro');
    this.showConversionInfo = currencyModule.showConversion;
    this.localCurrencyDefault = currencyModule.localCurrencyDefault;
    this.enableCurrencySwitch = this.currencyModuleEnabled && currencyModule.idModule > 0;

    this.priceListService.getListByIdProduct(this.pSeleccionado.idProduct).then(() => {
      this.lists = this.priceListService.productlists;
      this.listSeleccionada = this.lists[0];
    });
    void this.loadWarehousesAndStockForSelectedProduct();

    if(this.productService.catalogUnitByPriceList){
      this.listPrices = this.productService.listPrices;
    }

    this.loadProductImages();
    this.syncBasePricesFromDetail();

    if (this.productService.catalogUnitByPriceList) {
      return;
    }
    await this.loadUnitsForProduct();
    console.log('pSeleccionado: ' + JSON.stringify(this.pSeleccionado));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pSeleccionado'] && this.pSeleccionado?.coProduct) {
      this.loadProductImages();
      if (!changes['pSeleccionado'].firstChange) {
        void this.loadWarehousesAndStockForSelectedProduct();
        void this.reloadDetailForProduct();
      }
    }
  }

  private async reloadDetailForProduct(): Promise<void> {
    if (this.productService.catalogUnitByPriceList) {
      this.listPrices = this.productService.listPrices;
      return;
    }

    await this.priceListService.getListByIdProduct(this.pSeleccionado.idProduct);
    this.lists = this.priceListService.productlists;
    this.listSeleccionada = this.lists[0];
    this.syncBasePricesFromDetail();
    await this.loadUnitsForProduct();
  }

  private async loadUnitsForProduct(): Promise<void> {
    if (this.productService.catalogUnitByPriceList || !this.pSeleccionado?.idProduct) {
      return;
    }

    this.unitList = this.productService.getCatalogUnitsForProduct(this.pSeleccionado.idProduct);
    if (this.unitList.length === 0) {
      await this.productService.getUnitsByIdProductOrderByCoPrimaryUnit(
        this.db.getDatabase(),
        this.pSeleccionado.idProduct,
      );
      this.unitList = this.productService.unitsByProduct.map(unit =>
        this.productService.mapUnitToUnitInfo(unit, this.pSeleccionado.idProduct, this.pSeleccionado.coProduct),
      );
    }

    this.selectedIdUnit = this.resolveDefaultUnitId();
    this.applySelectedUnitToProduct();
  }

  private resolveDefaultUnitId(): number {
    const fromDetail = this.unitList.find(u => u.idUnit === this.pSeleccionado.idUnit);
    if (fromDetail) {
      return fromDetail.idUnit;
    }
    return this.unitList[0]?.idUnit ?? this.pSeleccionado.idUnit;
  }

  onUnitChanged(idUnit: number): void {
    this.selectedIdUnit = idUnit;
    this.applySelectedUnitToProduct();
  }

  private applySelectedUnitToProduct(): void {
    const unit = this.getSelectedUnit();
    if (!unit) {
      return;
    }
    this.pSeleccionado.idUnit = unit.idUnit;
    this.pSeleccionado.coUnit = unit.coUnit;
    this.pSeleccionado.naUnit = unit.naUnit;
  }

  getSelectedUnit(): UnitInfo | undefined {
    return this.unitList.find(u => u.idUnit === this.selectedIdUnit);
  }

  getDisplayPriceLocal(): number {
    return this.productService.resolveDisplayPriceForUnit(this.basePriceLocal, this.getSelectedUnit());
  }

  getDisplayPriceHard(): number {
    if (this.basePriceHard == null) {
      return 0;
    }
    return this.productService.resolveDisplayPriceForUnit(this.basePriceHard, this.getSelectedUnit());
  }

  hasConversionRate(): boolean {
    const rate = this.pSeleccionado?.conversion;
    return rate != null && String(rate).trim().length > 0;
  }

  openImageZoom(index = 0): void {
    const max = Math.max(this.getZoomImages().length - 1, 0);
    this.imageZoomStartIndex = Math.min(Math.max(0, Number(index) || 0), max);
    this.imageZoomOpen = true;
  }

  closeImageZoom(): void {
    this.imageZoomOpen = false;
  }

  /** Tras abrir el modal, fuerza el slide del zoom a la foto pulsada. */
  onZoomModalPresented(): void {
    const apply = () => {
      const swiper = this.zoomSwiper?.nativeElement?.swiper;
      swiper?.slideTo(this.imageZoomStartIndex, 0);
    };
    apply();
    setTimeout(apply, 50);
  }

  getZoomImages(): string[] {
    if (this.productImages.length > 0) {
      return this.productImages;
    }
    const fallback = this.pSeleccionado?.coProduct
      ? this.imageServices.getImgForProduct(this.pSeleccionado.coProduct)
      : '../../../assets/images/nodisponible.png';
    return [fallback || '../../../assets/images/nodisponible.png'];
  }

  private syncBasePricesFromDetail(): void {
    this.checkReorderPrices();
    this.basePriceLocal = this.pSeleccionado.priceLocal;
    this.basePriceHard = this.pSeleccionado.priceHard;
  }

  private async loadProductImages(): Promise<void> {
    const productId = this.pSeleccionado?.coProduct;
    if (!productId) {
      this.productImages = [];
      return;
    }

    try {
      this.productImages = await this.imageServices.getImagesForProduct(productId);
    } catch (err) {
      console.warn('[ProductDetail] failed loading product images for', productId, err);
      this.productImages = [];
    }
  }

  /**
   * Carga almacenes del producto y deja el inventario del almacén seleccionado
   * (no la suma de todos los almacenes que viene en pSeleccionado.stock).
   */
  private async loadWarehousesAndStockForSelectedProduct(): Promise<void> {
    if (!this.pSeleccionado?.idProduct) {
      this.warehouses = [];
      return;
    }

    if (!this.productService.catalogValidateWarehouses || this.hideProductWarehouse) {
      return;
    }

    await this.stockService.getWarehousesByIdProduct(this.pSeleccionado.idProduct);
    this.warehouses = this.stockService.productWarehouses ?? [];
    this.warehouseSeleccionado = this.warehouses[0];

    if (this.warehouseSeleccionado?.idWarehouse != null) {
      await this.refreshStockForWarehouse(this.warehouseSeleccionado.idWarehouse);
    }
  }

  private async refreshStockForWarehouse(idWarehouse: number): Promise<void> {
    if (!this.pSeleccionado?.idProduct || idWarehouse == null) {
      return;
    }

    const stock = await this.stockService.getStockByIdWarehousesAndIdProduct(
      idWarehouse,
      this.pSeleccionado.idProduct,
    );
    this.pSeleccionado.stock = Number(stock ?? 0);
  }

  onListChanged(idList: number) {
    this.priceListService.getPriceListByIdListAndIdProduct(idList, this.pSeleccionado.idProduct, this.productService.empresaSeleccionada.coCurrencyDefault).then(() => {
      this.pSeleccionado.priceLocal = this.priceListService.productPrice.priceDefault;
      this.pSeleccionado.coCurrencyLocal = this.priceListService.productPrice.coCurrencyDefault;
      this.pSeleccionado.priceHard = this.priceListService.productPrice.priceOpposite;
      this.pSeleccionado.coCurrencyHard = this.priceListService.productPrice.coCurrencyOpposite;
      this.syncBasePricesFromDetail();
    });
  }

  checkReorderPrices(){
    if(this.localCurrencyDefault){
      //la local es la por defecto
    if(this.pSeleccionado.coCurrencyLocal != this.currencyService.getLocalCurrency().coCurrency){
      //vino la dura como local
        this.reorderPrices();
      }
    }else{
      //la hard es la por defecto
      if(this.pSeleccionado.coCurrencyLocal != this.currencyService.getHardCurrency().coCurrency){
        //vino la local como hard
        this.reorderPrices();
      }
    }
  }

  reorderPrices(){
        let tempPrice = this.pSeleccionado.priceLocal;
        let tempCurrency = this.pSeleccionado.coCurrencyLocal;
        this.pSeleccionado.priceLocal = this.pSeleccionado.priceHard? this.pSeleccionado.priceHard : 0;
        this.pSeleccionado.coCurrencyLocal = this.pSeleccionado.coCurrencyHard? 
          this.pSeleccionado.coCurrencyHard : this.currencyService.getOppositeCurrency(tempCurrency).coCurrency;
        this.pSeleccionado.priceHard = tempPrice;
        this.pSeleccionado.coCurrencyHard = tempCurrency;
    }
  

  onWarehouseChanged(idWarehouse: number) {
    void this.refreshStockForWarehouse(idWarehouse);
  }
  formatNumber(num: number) {
    return this.productService.formatNumber(num);
  }

  convertPrice(price: number, coCurrency: string) {
    return this.currencyService.convertFrom(price, coCurrency);
  }

  /**
   * Precio visual por unidad completa (precio base * quUnit) cuando unitByPriceList.
   */
  getUnitPriceListDisplayPrice(basePrice: number, coUnit: string): number {
    const unit = this.productService.catalogListaUnitInfo.find(
      u => u.idProduct === this.pSeleccionado.idProduct && u.coUnit === coUnit
    );
    return basePrice * (unit?.quUnit ?? 1);
  }

  detailShowsMinimumQty(idProduct: number): boolean {
    if (!this.productService.catalogHasProdMinMul(idProduct)) {
      return false;
    }
    return this.productService.getCatalogProdMinMul(idProduct).quMinimum > 1;
  }

  detailShowsMultipleQty(idProduct: number): boolean {
    if (!this.productService.catalogHasProdMinMul(idProduct)) {
      return false;
    }
    return this.productService.getCatalogProdMinMul(idProduct).quMultiple > 1;
  }

  detailMinQty(idProduct: number): number {
    return this.productService.getCatalogProdMinMul(idProduct).quMinimum;
  }

  detailMulQty(idProduct: number): number {
    return this.productService.getCatalogProdMinMul(idProduct).quMultiple;
  }

  isNotNullOrEmpty(str: string | null | undefined): boolean {
    return !this.textService.isNull(str);
  }

  /*  async getProductImages() {    
         if(this.imageServices.mapImagesFiles.get(this.pSeleccionado.coProduct) === undefined){
          this.listPhotos.push('');
         }else{
          let pathImages = this.imageServices.mapImagesFiles.get(this.pSeleccionado.coProduct);
          for (let index = 0; index < pathImages?.length; index++) {
            const element = array[index];
            
          }
          this.listPhotos = this.imageServices.mapImagesFiles.get(this.pSeleccionado.coProduct)?.values();
         }
    }  */


}
