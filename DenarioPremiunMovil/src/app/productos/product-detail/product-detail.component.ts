import { Component, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
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

  public swiper!: Swiper;

  constructor() { }

  ngOnInit() {
    /* this.getProductImages(); */
    this.productService.syncOrderPresentationFromPedidos(this.pedidosService);
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
    if(this.productService.catalogValidateWarehouses && !this.hideProductWarehouse){
    this.stockService.getWarehousesByIdProduct(this.pSeleccionado.idProduct).then(() => {
      this.warehouses = this.stockService.productWarehouses;
      this.warehouseSeleccionado = this.warehouses[0];
    });
    }

    if(this.productService.catalogUnitByPriceList){
      this.listPrices = this.productService.listPrices;
    }

    this.loadProductImages();

    this.checkReorderPrices();
    //console.log('pSeleccionado: ' + JSON.stringify(this.pSeleccionado));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pSeleccionado'] && this.pSeleccionado?.coProduct) {
      this.loadProductImages();
    }
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

  onListChanged(idList: number) {
    this.priceListService.getPriceListByIdListAndIdProduct(idList, this.pSeleccionado.idProduct, this.productService.empresaSeleccionada.coCurrencyDefault).then(() => {
      this.pSeleccionado.priceLocal = this.priceListService.productPrice.priceDefault;
      this.pSeleccionado.coCurrencyLocal = this.priceListService.productPrice.coCurrencyDefault;
      this.pSeleccionado.priceHard = this.priceListService.productPrice.priceOpposite;
      this.pSeleccionado.coCurrencyHard = this.priceListService.productPrice.coCurrencyOpposite;
      console.log('pSeleccionado.priceLocal: ' + this.pSeleccionado.priceLocal);
      this.checkReorderPrices();
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
    this.stockService.getStockByIdWarehousesAndIdProduct(idWarehouse, this.pSeleccionado.idProduct).then((data: number) => {
      this.pSeleccionado.stock = data;
    });
  }
  formatNumber(num: number) {
    return this.productService.formatNumber(num);
  }

  convertPrice(price: number, coCurrency: string) {
    return this.currencyService.convertFrom(price, coCurrency);
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
