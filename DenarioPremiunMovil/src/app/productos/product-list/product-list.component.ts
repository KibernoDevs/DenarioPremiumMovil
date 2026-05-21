import { ChangeDetectorRef, Component, DoCheck, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { InfiniteScrollCustomEvent, IonInfiniteScroll } from '@ionic/angular';
import { Subject, Subscription } from 'rxjs';
import { ProductDetail } from 'src/app/modelos/ProductDetail';
import { ProductUtil } from 'src/app/modelos/ProductUtil';
import { Imagenes } from 'src/app/modelos/imagenes';
import { CurrencyModules } from 'src/app/modelos/tables/currencyModules';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { Product } from 'src/app/modelos/tables/product';
import { ProductStructure } from 'src/app/modelos/tables/productStructure';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ProductStructureService } from 'src/app/services/productStructures/product-structure.service';
import { ProductService } from 'src/app/services/products/product.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

@Component({
  selector: 'product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
  standalone: false
})
export class ProductListComponent implements OnInit {

  private subs = new Subscription();

  productService = inject(ProductService);
  productStructureService = inject(ProductStructureService);
  services = inject(ServicesService);
  db = inject(SynchronizationDBService);
  message = inject(MessageService);
  imageServices = inject(ImageServicesService);
  currencyService = inject(CurrencyService);
  orderService = inject(PedidosService);
  config = inject(GlobalConfigService);

  public imagesMap: { [imgName: string]: string } = {};


  @Input()
  productTags = new Map<string, string>([]);
  @Input()
  empresaSeleccionada!: Enterprise;
  @Input()
  psSeleccionada!: ProductStructure;
  @Input()
  searchText: string = '';
  showConversionInfo: Boolean = false;
  localCurrencyDefault: Boolean = true;
  noProductsAlertShown = false;

  productList: ProductUtil[] = [];
  productListView: ProductUtil[] = [];
  idProductStructureList: number[] = [];
  coProductStructureListString: string = "";
  selectedProduct!: ProductUtil;
  productDetail!: ProductDetail;
  productModule: Boolean = false;
  currencyModuleEnabled: Boolean = false;
  defaultCurrency: string = '';
  startPro: number = 0;
  endPro: number = 20;
  
  page: number = 0;

  @Output()
  selectedProductChanged: EventEmitter<ProductDetail> = new EventEmitter<ProductDetail>();

  @ViewChild(IonInfiniteScroll)
  infiniteScroll!: IonInfiniteScroll;

  constructor(
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit() {

    //this.productService.showStock = this.productService.globalConfig.get("showStock") == "true" ? true : false;

    this.subs.add(
      this.imageServices.imageLoaded$.subscribe(({ imgName, imgSrc }) => {
        this.imagesMap[imgName] = imgSrc;
        this.cd.markForCheck();
      })
    );

    // Reemite imágenes cacheadas (si existen)
    if(this.orderService.showProductImages){
      this.imageServices.emitCachedImages();
    }
    this.currencyModuleEnabled = this.config.get("currencyModule").toLowerCase() === "true";
    var currencyModule: CurrencyModules = this.currencyService.getCurrencyModule('pro');
    this.showConversionInfo = currencyModule.showConversion;
    this.localCurrencyDefault = currencyModule.localCurrencyDefault;
    this.defaultCurrency = this.productService.empresaSeleccionada.coCurrencyDefault;
    if (this.currencyModuleEnabled) {
      if (currencyModule.idModule > 0 && this.localCurrencyDefault) {
        this.defaultCurrency = this.currencyService.getLocalCurrency().coCurrency;
      } else {
        this.defaultCurrency = this.currencyService.getHardCurrency().coCurrency;
      }
    }
    if (this.searchText) {
      if (this.productService.productList.length > 0) {
        //this.productList = this.filterProductList(this.productService.productList);
        this.productList = this.productService.productList;
        if(this.orderService.unitByPriceList){
          this.fillListPrices(this.productList);
        }
      } else {
        this.productService.getProductsSearchedByCoProductAndNaProduct(this.db.getDatabase(),
          this.searchText, this.productService.empresaSeleccionada.idEnterprise, this.defaultCurrency, 0).then(() => {
            this.noProductsAlertShown = false;
            //this.productList = this.filterProductList(this.productService.productList);
            this.productList = this.productService.productList;
            this.noProductsAlertShown = this.productList.length === 0;
            this.message.hideLoading();
          });
      }
    } else {
      this.idProductStructureList = this.productStructureService.idProductStructureList;
      this.coProductStructureListString = this.productStructureService.coProductStructureListString;
      this.productService.getProductsByCoProductStructureAndIdEnterprise(this.db.getDatabase(),
        this.idProductStructureList, this.empresaSeleccionada.idEnterprise, this.defaultCurrency, 0).then(() => {
          this.noProductsAlertShown = false;
          //this.productList = this.filterProductList(this.productService.productList);
          this.productList = this.productService.productList;
          if(this.orderService.unitByPriceList){
            this.fillListPrices(this.productList);
          }
          this.noProductsAlertShown = this.productList.length === 0;
        });
    }
  }

  filterProductList(list: ProductUtil[]) {
    //No se usa por los momentos.
    //Esta funcion filtra productos sin stock y productos sin precio, dependiendo de la configuracion seteada en PedidosService. 
    //Se dejo por si en algun momento se quiere volver a usar esta funcionalidad sin tener que reescribirla.
    if (this.orderService.hideStock0){
      list = list.filter(product => product.stock && product.stock > 0);
    }
    if( this.orderService.hideProdWithoutPrice){
      const distinctIds = new Set<number>(
        this.orderService.listaPricelist.map(pl => pl.idProduct)
      );
      list = list.filter(product => distinctIds.has(product.idProduct));
    }

    return list;
  }

  searchSubscription: Subscription = this.productService.productoSearch.subscribe((data) => {
    this.searchText = data;
    if (!this.searchText) {
      this.message.hideLoading();
      return;
    }
    if (this.searchText) {
      this.productService.getProductsSearchedByCoProductAndNaProduct(this.db.getDatabase(),
        this.searchText, this.productService.empresaSeleccionada.idEnterprise, this.defaultCurrency, 0).then(() => {
          this.noProductsAlertShown = false;
          //this.productList = this.filterProductList(this.productService.productList);
          this.productList = this.productService.productList;
        if(this.orderService.unitByPriceList){
          this.fillListPrices(this.productList);
        }
          this.noProductsAlertShown = this.productList.length === 0;
          this.message.hideLoading();
        });
    }
  });

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
    this.subs.unsubscribe();
  }

  onIonInfinite(ev: any) {
    this.page++;
    if (this.searchText) {
      this.productService.getProductsSearchedByCoProductAndNaProduct(this.db.getDatabase(),
        this.searchText, this.productService.empresaSeleccionada.idEnterprise, this.defaultCurrency, this.page).then(() => {
          //const newProducts = this.filterProductList(this.productService.productList);
          const newProducts = this.productService.productList;
          this.productList = [...this.productList, ...newProducts];
          if (newProducts.length < this.productService.MAX_ITEMS_PER_PAGE) {
            this.infiniteScroll.disabled = true;
          }
          (ev as InfiniteScrollCustomEvent).target.complete();
        });
    } else {
      this.productService.getProductsByCoProductStructureAndIdEnterprise(this.db.getDatabase(),
        this.idProductStructureList, this.empresaSeleccionada.idEnterprise, this.defaultCurrency, this.page).then(() => {
          //const newProducts = this.filterProductList(this.productService.productList);
          const newProducts = this.productService.productList;
          if(this.orderService.unitByPriceList){
          this.fillListPrices(newProducts);
        }
          this.productList = [...this.productList, ...newProducts];
          if (newProducts.length < this.productService.MAX_ITEMS_PER_PAGE) {
            this.infiniteScroll.disabled = true;
          }
          (ev as InfiniteScrollCustomEvent).target.complete();
        });
      }

  }

  onShowProductDetail(product: ProductUtil) {
    console.log('Product selected: ' + product.naProduct);
    this.selectedProduct = product;
    this.productService.getProductDetailByIdProduct(this.db.getDatabase(), this.selectedProduct.idList, this.selectedProduct.idProduct, this.defaultCurrency).then(() => {
      this.productDetail = this.productService.productDetail;
      this.selectedProductChanged.emit(this.productDetail);
      if(this.orderService.unitByPriceList){
        this.productService.listPrices = product.listPrices;
      }
    });
  }

  getPrecioConIVA(precio: number, iva: number): string {
    let precioConIVA = precio;
    if (iva && iva > 0) {
      precioConIVA = precio * (1 + iva / 100);
    }
    return this.formatNumber(precioConIVA);
  }

  formatNumber(num: number) {
    return this.productService.formatNumber(num);
  }

  fillListPrices(products: ProductUtil[]) {
    products.forEach(product => {
      this.getPriceList(product);
    });
  }

  convertPrice(price: number, coCurrency: string){
    return this.currencyService.convertFrom(price, coCurrency);
  }

  getPriceList(product: ProductUtil) {
    //[unitByPriceList] obtenemos el precio de la lista de  precios seleccionada para mostrarlo en la lista de productos, si es que la lista de precios esta activa y tiene un precio para ese producto.
          //llenamos la lista a mostrar en el producto.
          let nuPriceList: {idList: number, naList: string, nuPrice: number, coUnit: string, naUnit: string, coCurrency: string}[] = [];
          let priceLists = this.orderService.listaPricelist.filter(pl => pl.idProduct == product.idProduct);
          priceLists.forEach(pl => {
            let list = this.orderService.listaList.filter(l => l.idList == pl.idList)[0];
            //buscamos el nombre de la unidad de la lista de precio
            let idUnitPL = this.orderService.listaUnitPriceList.filter(u => u.idList == pl.idList)[0]?.idUnit;
            let naUnit = this.orderService.listaUnitInfo.filter(u => u.idUnit == idUnitPL)[0]?.naUnit || '';
            let coUnit = this.orderService.listaUnitInfo.filter(u => u.idUnit == idUnitPL)[0]?.coUnit || '';

            if(list){
              nuPriceList.push({
                                idList: list.idList, 
                                naList: list.naList, 
                                nuPrice: pl.nuPrice,
                                coUnit: coUnit,
                                naUnit: naUnit,
                                coCurrency: pl.coCurrency
                              });
            }
          });
          product.listPrices = nuPriceList;
        }
  
}
