import { ChangeDetectorRef, Component, ElementRef, Input, OnInit, QueryList, Renderer2, ViewChild, ViewChildren, inject } from '@angular/core';
import { InfiniteScrollCustomEvent, IonAccordionGroup, IonInput } from '@ionic/angular';
import { Subject, Subscription } from 'rxjs';
import { ProductUtil } from 'src/app/modelos/ProductUtil';
import { OrderUtil } from 'src/app/modelos/orderUtil';
import { Discount } from 'src/app/modelos/tables/discount';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { IvaList } from 'src/app/modelos/tables/iva';
import { List } from 'src/app/modelos/tables/list';
import { Warehouse } from 'src/app/modelos/tables/warehouse';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ProductStructureService } from 'src/app/services/productStructures/product-structure.service';
import { ProductService } from 'src/app/services/products/product.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

@Component({
  selector: 'productos-tab-order-product-list',
  templateUrl: './productos-tab-order-product-list.component.html',
  styleUrls: ['./productos-tab-order-product-list.component.scss'],
  standalone: false
})
export class ProductosTabOrderProductListComponent implements OnInit {
  productStructureService = inject(ProductStructureService);
  productService = inject(ProductService);
  public message = inject(MessageService);
  public orderServ = inject(PedidosService);
  public currencyServ = inject(CurrencyService);
  db = inject(SynchronizationDBService);
  imageServices = inject(ImageServicesService);

  @Input()
  devolucion: Boolean = false;
  @Input()
  pedido: Boolean = false;
  @Input()
  inventario: Boolean = false;
  @Input()
  searchText: string = '';
  @Input()
  productsTabTags = new Map<string, string>([]);
  @Input()
  empresaSeleccionada!: Enterprise;

  @ViewChildren('quAmountInput') quAmountInputs!: QueryList<IonInput>;
  @ViewChild('accordionGroup') accordionGroup!: IonAccordionGroup;
  page = 0;
  scrollDisable = false;
  productList: ProductUtil[] = [];
  orderUtilList: OrderUtil[] = []
  showProductList: Boolean = false;
  idProductStructureList: number[] = [];
  coProductStructureListString: string = "";

  nameProductStructure = "";
  ivaList: IvaList[] = [];
  warehouseList: Warehouse[] = [];

  quInputMode = 'numeric';

  modoLista = 'structure'
  psClicked!: any;
  featuredPSClicked!: any;

  favoritePSClicked!: any;

  carritoButtonClicked!: any;

  searchTextChanged!: any;
  searchSub!: any;
  returnBackSub!: any;

  detailModal = false;
  discountModal = false;
  productoModal!: OrderUtil;
  noProductsAlertShown = false;

  disablePriceListSelector = false;
  public imagesMap: { [imgName: string]: string } = {};
  private subs = new Subscription();

  priceListColSize = 12;
  priceListInfoModal = false;

  constructor(

    private cd: ChangeDetectorRef,
  ) { }


  ngOnInit() {
    console.log('Estoy en Pedido');

    if (this.orderServ.priceListInfoModal) {
      //hay que hacer espacio para el boton de info del pricelist
      this.priceListColSize = 10;
    }
    this.subs.add(
      this.imageServices.imageLoaded$.subscribe(({ imgName, imgSrc }) => {
        this.imagesMap[imgName] = imgSrc;
        this.cd.markForCheck();
      })
    );

    this.searchTextChanged = this.productService.searchTextChanged.subscribe((value) => {
      this.searchText = value;
    });

    this.ivaList = this.orderServ.ivaList;
    this.disablePriceListSelector = (!this.orderServ.userCanChangePriceListProduct);
    this.searchSub = this.productService.onSearchClicked.subscribe((data) => {
      this.modoLista = 'search';
      this.noProductsAlertShown = false;
      this.warehouseList = this.orderServ.listaWarehouse;
      this.showProductList = true;
      this.nameProductStructure = '';
      this.productList = this.productService.productList;

      this.orderUtilList = this.orderServ.productListToOrderUtil(this.productList);
      this.noProductsAlertShown = (this.orderUtilList.length == 0);

    });

    this.psClicked = this.productService.productStructureCLicked.subscribe((data) => {
      this.noProductsAlertShown = false;
      this.showProductList = data;
      this.page = 0;
      this.modoLista = 'structure';
      this.scrollDisable = false;
      this.nameProductStructure = this.productStructureService.nombreProductStructureSeleccionada;
      if (this.showProductList) {
        this.idProductStructureList = this.productStructureService.idProductStructureList;
        this.coProductStructureListString = this.productStructureService.coProductStructureListString;
        // this.ivaList = this.orderServ.ivaList;
        this.warehouseList = this.orderServ.listaWarehouse;
        this.productService.getProductsByCoProductStructureAndIdEnterprisePaged(this.db.getDatabase(),
          this.idProductStructureList, this.empresaSeleccionada.idEnterprise, this.orderServ.monedaSeleccionada.coCurrency,
          this.orderServ.userCanChangeWarehouse, this.orderServ.cliente.idClient, this.orderServ.listaSeleccionada.idList, this.page).then(() => {
            this.productList = this.productService.productList;
            this.orderUtilList = this.orderServ.productListToOrderUtil(this.productList);
            if (this.orderUtilList.length < 20) {
              //probablemente muchos productos fueron eliminados, agregamos mas.
              this.onIonInfinite(null);
            }
            this.noProductsAlertShown = (this.orderUtilList.length == 0);

          });
      }
    });

    //caso featuredProduct:
    this.featuredPSClicked = this.productService.featuredStructureClicked.subscribe((showList) => {
      this.noProductsAlertShown = false;
      this.showProductList = showList;
      this.nameProductStructure = this.productStructureService.nombreProductStructureSeleccionada;
      if (this.showProductList) {
        this.modoLista = 'featured';
        this.scrollDisable = false;
        this.page = 0;
        this.idProductStructureList = this.productStructureService.idProductStructureList;
        this.coProductStructureListString = this.productStructureService.coProductStructureListString;
        //this.ivaList = this.orderServ.ivaList;
        this.warehouseList = this.orderServ.listaWarehouse;
        //usamos featured product = true en lugar de la estrucutura
        this.productService.getFeaturedProducts(this.db.getDatabase(),
          this.empresaSeleccionada.idEnterprise, this.orderServ.monedaSeleccionada.coCurrency,
          this.orderServ.userCanChangeWarehouse, this.orderServ.cliente.idClient, this.orderServ.listaSeleccionada.idList, this.page).then(() => {
            this.productList = this.productService.productList;
            this.orderUtilList = this.orderServ.productListToOrderUtil(this.productList);
            this.noProductsAlertShown = (this.orderUtilList.length == 0);
          });
      }
    });
    //caso favorito:
    this.favoritePSClicked = this.productService.favoriteStructureClicked.subscribe((showList) => {
      this.noProductsAlertShown = false;
      this.showProductList = showList;
      this.nameProductStructure = this.productStructureService.nombreProductStructureSeleccionada;
      if (this.showProductList) {
        this.modoLista = 'favorite';
        this.scrollDisable = false;
        this.page = 0;
        this.idProductStructureList = this.productStructureService.idProductStructureList;
        this.coProductStructureListString = this.productStructureService.coProductStructureListString;

        this.warehouseList = this.orderServ.listaWarehouse;
        //buscamos en la tabla de favoritos
        this.productService.getFavoriteProducts(this.db.getDatabase(),
          this.empresaSeleccionada.idEnterprise, this.orderServ.monedaSeleccionada.coCurrency,
          this.orderServ.userCanChangeWarehouse, this.orderServ.cliente.idClient, this.orderServ.listaSeleccionada.idList, this.page).then(() => {
            this.productList = this.productService.productList;
            this.orderUtilList = this.orderServ.productListToOrderUtil(this.productList);
            this.noProductsAlertShown = (this.orderUtilList.length == 0);
          });
      }

    });

    //caso carrito:
    this.carritoButtonClicked = this.productService.carritoButtonClicked.subscribe((showList) => {
      this.noProductsAlertShown = false;
      this.showProductList = showList;
      this.modoLista = 'carrito';
      this.orderUtilList = this.orderServ.carrito;
      this.warehouseList = this.orderServ.listaWarehouse;
      this.nameProductStructure = this.orderServ.getTag("PED_CARRITO")
      this.noProductsAlertShown = (this.orderUtilList.length == 0);
    });

    this.returnBackSub = this.productService.returnBackClicked.subscribe(() => {
      if (this.showProductList) {
        this.onShowProductStructures();
      }
    });

    this.cantidadInputMode();
  }

  onIonInfinite(ev: InfiniteScrollCustomEvent | null) {
    this.page++;
    switch (this.modoLista) {
      case 'structure':
        this.productService.getProductsByCoProductStructureAndIdEnterprisePaged(this.db.getDatabase(),
          this.idProductStructureList, this.empresaSeleccionada.idEnterprise, this.orderServ.monedaSeleccionada.coCurrency,
          this.orderServ.userCanChangeWarehouse, this.orderServ.cliente.idClient, this.orderServ.listaSeleccionada.idList, this.page).then(() => {
            this.updateList(ev);

          });
        break;

      case 'favorite':
        this.productService.getFavoriteProducts(this.db.getDatabase(),
          this.empresaSeleccionada.idEnterprise, this.orderServ.monedaSeleccionada.coCurrency,
          this.orderServ.userCanChangeWarehouse, this.orderServ.cliente.idClient, this.orderServ.listaSeleccionada.idList, this.page).then(() => {
            this.updateList(ev);

          });
        break;

      case 'featured':
        this.productService.getFeaturedProducts(this.db.getDatabase(),
          this.empresaSeleccionada.idEnterprise, this.orderServ.monedaSeleccionada.coCurrency,
          this.orderServ.userCanChangeWarehouse, this.orderServ.cliente.idClient, this.orderServ.listaSeleccionada.idList, this.page).then(() => {
            this.updateList(ev);

          });
        break;

      case 'search':
        this.productService.getProductsSearchedByCoProductAndNaProductAndIdList(
          this.db.getDatabase(), this.searchText, this.empresaSeleccionada.idEnterprise,
          this.orderServ.monedaSeleccionada.coCurrency,
          this.orderServ.listaSeleccionada.idList, this.page).then(() => {
            this.updateList(ev);
          });
        break;

      case 'carrito':
        //no hay que hacer nada, ya que el carrito no tiene paginacion
        this.scrollDisable = true;
        if (ev) {
          ev.target.complete(); //termina la animacion del infiniteScroll
        }
        break;
    }

  }

  updateList(ev: InfiniteScrollCustomEvent | null) {
    if (this.productService.productList.length == 0) {
      this.scrollDisable = true;
    } else {
      let tempList = this.orderServ.productListToOrderUtil(this.productService.productList);
      for (let i = 0; i < tempList.length; i++) {
        const item = tempList[i];
        this.orderUtilList.push(item);
      }
      this.noProductsAlertShown = (this.orderUtilList.length == 0);
    }
    if (ev) {
      ev.target.complete(); //termina la animacion del infiniteScroll
    }
  }

  loadProductToModal(prod: OrderUtil) {
    this.productoModal = prod;
    this.showDetailModal(true);
  }

  showDetailModal(show: boolean) {
    //console.log("SHOW ME THE MODAL");
    this.detailModal = show;

    if (!show) {
      //al ocultar el modal agregamos el producto al carrito
      this.orderServ.alCarrito(this.productoModal);
    }
  }

  // orderServ.getTag(tagName: string){
  //   var tag = this.orderServ.tags.get(tagName);
  //   if(tag == undefined){
  //     console.log("Error al buscar tag "+tagName);
  //     tag = '' ;
  // }
  //   return tag;
  // }

  getUnitName(prod: OrderUtil) {
    return prod.unitList.filter(u => u.idUnit == prod.idUnit)[0].naUnit;
  }


  ngOnDestroy(): void {
    this.psClicked.unsubscribe();
    this.featuredPSClicked.unsubscribe();
    this.favoritePSClicked.unsubscribe();
    this.searchSub.unsubscribe();
    this.carritoButtonClicked.unsubscribe();
    this.searchTextChanged.unsubscribe();
    this.returnBackSub.unsubscribe();
    this.subs.unsubscribe();
  }

  onProductQuantityChange(prod: OrderUtil) {
    let unit = prod.unitList.filter(u => prod.idUnit == u.idUnit)[0];
    if ((prod.discountList.length > 1)) {
      this.autoDiscount(prod);
    }
    if (prod.quStock <= 0) {
      if (this.orderServ.stock0) {
        if (this.orderServ.validStock) {
          //mostramos error, pero dejamos agregar al carrito
          this.message.transaccionMsjModalNB(this.orderServ.getTag("PED_ALERTA_INVENTARIO"));
        }
        //no hay que chequear inventario
        unit.quAmount = prod.quAmount;
        this.orderServ.alCarrito(prod);
        return;
      } else {
        if (prod.quStockAux == prod.quAmount) {
          //se llevo la cantidad justa. no hay problema
          unit.quAmount = prod.quAmount;
          this.orderServ.alCarrito(prod);
        } else {
          this.message.transaccionMsjModalNB(this.orderServ.getTag("PED_ERROR_STOCK0"));
          prod.quAmount = 0;
        }

      }
    }

    //hay que chequear inventario
    if (this.orderServ.validStock) {
      prod.quStock = prod.quStockAux - prod.quAmount;
    }
    if (this.orderServ.validStock && !this.orderServ.stock0 &&(prod.quAmount > prod.quStockAux)) {
      this.message.transaccionMsjModalNB(this.orderServ.getTag("PED_ERROR_INVENTARIO"));
      prod.quAmount = 0;
    } else {
      unit.quAmount = prod.quAmount;
      this.orderServ.alCarrito(prod);
    }

  }

  onProductQuantityInput(prod: OrderUtil) {
    //igual que onProductQuantityChange, pero no mando al carrito
    let unit = prod.unitList.filter(u => prod.idUnit == u.idUnit)[0];
    if ((prod.discountList.length > 1)) {
      this.autoDiscount(prod);
    }
    if (this.orderServ.stock0 && prod.quStock == 0) {
      //no hay que chequear inventario
      unit.quAmount = prod.quAmount;
      //this.orderServ.alCarrito(prod);
      return;
    }
    //hay que chequear inventario
    if (this.orderServ.validStock) {
      prod.quStock = prod.quStockAux - prod.quAmount;
    }
    if (this.orderServ.validStock && !this.orderServ.stock0 && (prod.quAmount > prod.quStockAux)) {
      this.message.transaccionMsjModalNB(this.orderServ.getTag("PED_ERROR_INVENTARIO"));
      prod.quAmount = 0;
    } else {
      unit.quAmount = prod.quAmount;
      //this.orderServ.alCarrito(prod);
    }

  }

  getDiscountName(discount: Discount) {
    if (discount.idDiscount == 0) {
      return this.orderServ.getTag("PED_PLACEHOLDER_DCTO");
    } else {
      return discount.quDiscount.toString();
    }
  }

  loadDiscount(prod: OrderUtil) {
    this.productoModal = prod;
    this.showDiscountModal(true);
  }

  showDiscountModal(val: boolean) {
    this.discountModal = val;
  }

  loadPriceListInfo(prod: OrderUtil) {
    this.productoModal = prod;
    this.showPriceListInfoModal(true);
  }

  showPriceListInfoModal(val: boolean) {
    this.priceListInfoModal = val;
  }

  autoDiscount(prod: OrderUtil) {
    for (let i = 0; i < prod.discountList.length; i++) {
      if (prod.quAmount >= prod.discountList[i].quVolIni && prod.quAmount <= prod.discountList[i].quVolFin) {
        prod.idDiscount = prod.discountList[i].idDiscount;
        prod.quDiscount = prod.discountList[i].quDiscount;
        return;
      }
    }
    //si llegamos aqui es que no encontro descuento
    prod.idDiscount = 0;
    prod.quDiscount = 0;
  }
  onShowProductStructures() {
    this.orderUtilList = [] as OrderUtil[];
    this.showProductList = false;
    this.productService.searchStructures = true;
    this.productService.onBackButtonClicked();
    this.productStructureService.onAddProductCLicked();
    this.productStructureService.idProductStructureList = [];
    this.productStructureService.nombreProductStructureSeleccionada = '';
  }

  onSelectProductDev() {
    console.log('Devolucion not implemented.');
  }

  setSearchText(value: string) {
    this.searchText = value;
  }

  onSelectProductPed(i: number, prod: OrderUtil) {

    if (!this.orderServ.stock0 && (prod.quStockAux <= 0)) {
      this.message.transaccionMsjModalNB(this.orderServ.getTag("PED_ERROR_STOCK0"));
      //this.accordionGroup.value = undefined;
    } else {
      //const nativeEl = this.accordionGroup;
      //autofoco al abrir el producto seleccionado
      /*
      if (this.accordionGroup.value !== prod.coProduct) {
        setTimeout(() => {
          this.quAmountInputs.toArray()[i].setFocus();
        }, 150);
      }
      */
    }
  }

  onSelectPriceList(e: any, product: OrderUtil) {
    const idList = e.detail.value as number;
    const selectEl = e?.target as HTMLIonSelectElement;
      let prevList = product.idList;
      if(this.orderServ.unitByPriceList){
        //revisamos primero si tenemos esa unidad. Si no, mostramos error.
      let upl = this.orderServ.listaUnitPriceList.filter(u => u.idList == idList)[0];
      if(!upl){
        console.log("No se encontro unidad para la lista seleccionada");
        this.message.transaccionMsjModalNB("No se encontro unidad para la lista seleccionada");
        product.idList = prevList; //volvemos a la lista anterior, ya que no se encontro unidad para la nueva lista
        selectEl.value = prevList;
        this.cd.detectChanges(); 
        return;
      }
      let unit = product.unitList.filter(u => u.idUnit == upl.idUnit)[0];
      if(unit){
        product.idUnit = unit.idUnit;
        this.selectUnitById(unit.idUnit, product);
      }else{
        console.log("No se encontro unidad para la lista de precio seleccionada");
        this.message.transaccionMsjModalNB("No se encontro unidad para la lista de precio seleccionada");
        product.idList = prevList;
        selectEl.value = prevList;
        this.cd.detectChanges(); //volvemos a la lista anterior, ya que no se encontro unidad para la nueva lista
        return;
      }
    }
    product.idList = idList;

    const pricelist = this.orderServ.listaPricelist.filter(pl => pl.idProduct == product.idProduct && pl.idList == idList)[0];
    product.idPriceList = pricelist.idPriceList;
    product.coPriceList = pricelist.coPriceList;
    product.coCurrency = pricelist.coCurrency;

    product.nuPrice = pricelist.nuPrice;


    this.orderServ.alCarrito(product);
  }

  onSelectUnit(e: any, product: OrderUtil) {
    const unit = e.detail.value;
    this.selectUnitById(unit, product);
  }

  selectUnitById(unitId: number, product: OrderUtil) {
    product.idUnit = unitId;
    this.orderServ.alCarrito(product);
    product.quAmount = 0;
  }

  onSelectIVA(e: any, product: OrderUtil) {
    const iva = e.detail.value;
    product.iva = iva
    this.orderServ.alCarrito(product);
  }

  onManualDiscountChange(e: any, product: OrderUtil) {
    const raw = e?.detail?.value;

    if (raw === '' || raw === null || raw === undefined) {
      product.idDiscount = null;
      product.quDiscount = 0;
      this.orderServ.alCarrito(product);
      this.cd.detectChanges();
      return;
    }

    this.onSelectDiscount({ detail: { manualDiscount: raw } }, product);
  }

  onSelectDiscount(e: any, product: OrderUtil) {
    if (e?.detail?.manualDiscount !== undefined) {
      const max = Math.max(1, Number(this.orderServ.setMaxProductDiscount) || 1);
      const parsed = Number(e.detail.manualDiscount);
      if (Number.isNaN(parsed)) {
        return;
      }

      const manualDiscount = Math.min(max, Math.max(1, parsed));
      product.idDiscount = null;
      product.quDiscount = manualDiscount;
      this.orderServ.alCarrito(product);
      this.cd.detectChanges();
      return;
    }

    // Prefer event value but fallback to the model (keeps it in-sync when ngModel changed it).
    const raw = (e && e.detail && (e.detail.value !== undefined)) ? e.detail.value : product.idDiscount;
    // Ensure a numeric primitive (0 stays 0, '0' -> 0)
    const idDiscount = (raw === null || raw === undefined) ? 0 : Number(raw);
    let dc = product.discountList.filter(dc => dc.idDiscount == idDiscount)[0];
    if (!dc) {
      console.log("no se encontro el descuento " + idDiscount);

    } else {
      if (idDiscount == 0 || (product.quAmount >= dc.quVolIni && product.quAmount <= dc.quVolFin)) {
        //idDiscount = 0 significa sin descuento
        product.idDiscount = dc.idDiscount;
        product.quDiscount = dc.quDiscount;
      } else {
        setTimeout(() => {
          this.autoDiscount(product);
          this.cd.detectChanges();
        }, 0);
        this.message.transaccionMsjModalNB("Este Descuento no aplica para la cantidad seleccionada.");

      }

    }


    this.orderServ.alCarrito(product);
    this.cd.detectChanges();

  }

  getNaUnitByPriceList(product: OrderUtil, idList: number): string {
    let upl = this.orderServ.listaUnitPriceList.filter(u => u.idList == idList)[0];
    if (upl) {
      let unit = this.orderServ.listaUnitInfo.filter(u => u.idUnit == upl.idUnit)[0];
      if (unit) {
        return unit.naUnit;
      }
    }
    return '';
  }

  compareWithDiscount = (o1: any, o2: any) => {
    if (o1 === o2) return true;
    if ((o1 === null || o1 === undefined) && (o2 === null || o2 === undefined)) return true;
    // numeric string vs number
    return (o1 != null && o2 != null && Number(o1) === Number(o2));
  }

  /*
  compareWarehouse = (o1: any, o2: any) => {
    if (o1 === o2) return true;
    if ((o1 === null || o1 === undefined) && (o2 === null || o2 === undefined)) return true;
    return (o1 != null && o2 != null && o1.idWarehouse === o2.idWarehouse);
  }
    */

  onSelectWarehouse(e: any, product: OrderUtil) {
    const idwh = e.detail.value;
    var warehouse = this.warehouseList.filter(w => w.idWarehouse == idwh)[0];
    var stock = this.orderServ.listaStock.filter(s => s.idProduct == product.idProduct && s.idWarehouse == warehouse.idWarehouse)[0];
    product.idWarehouse = warehouse.idWarehouse;
    product.naWarehouse = warehouse.naWarehouse;
    product.coWarehouse = warehouse.coWarehouse;
    if (stock) {
      product.quStock = stock.quStock;
      product.quStockAux = stock.quStock;
    } else {
      product.quStock = 0;
      product.quStockAux = 0;
    }

    this.onProductQuantityChange(product);
    this.orderServ.alCarrito(product);

  }

  private isDistinctItemsLimitActive(): boolean {
    const t = this.orderServ.tipoOrden;
    if (!t) {
      return false;
    }
    const limitOn =
      t.itemsLimit === true ||
      (t.itemsLimit as unknown) === 1 ||
      (t.itemsLimit as unknown) === '1';
    if (!limitOn || t.quItems <= 0) {
      return false;
    }
    return this.orderServ.carrito.length >= t.quItems;
  }

  private isProductInCarrito(prod: OrderUtil): boolean {
    return this.orderServ.carrito.some((c) => c.idProduct === prod.idProduct);
  }

  hasItemsLimit(): boolean {
    const t = this.orderServ.tipoOrden;
    if (!t) {
      return false;
    }
    const limitOn =
      t.itemsLimit === true ||
      (t.itemsLimit as unknown) === 1 ||
      (t.itemsLimit as unknown) === '1';
    return limitOn && t.quItems > 0;
  }

  itemsLimitText(): string {
    const t = this.orderServ.tipoOrden;
    return `Items ${this.orderServ.carrito.length}/${t?.quItems ?? 0}`;
  }

  disableProduct(prod: OrderUtil) {
    if (this.isDistinctItemsLimitActive() && !this.isProductInCarrito(prod)) {
      return true;
    }
    if (!prod.nuPrice) {
      return true;
    }
    if (!this.orderServ.stock0 && (prod.quStockAux <= 0)) {
      var stocks = this.orderServ.listaStock.filter(s => s.idProduct == prod.idProduct)
      //si el warehouse seleccionado tiene 0 stock, comprobamos si hay stock en otro warehouse
      if (!this.orderServ.userCanChangeWarehouse) {
        return true;
      }
      for (let i = 0; i < stocks.length; i++) {
        if (stocks[i].quStock > 0) {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  cantidadInputMode() {
    if (this.orderServ.quUnitDecimals) {
      this.quInputMode = 'decimal';
    } else {
      this.quInputMode = 'numeric';
    }
  }

  quStock(prod: OrderUtil) {
    let stock = prod.quStock;
    let unit = prod.unitList.filter(u => prod.idUnit == u.idUnit)[0];
    if (this.orderServ.quUnitDecimals) {
      return this.formatNum(stock / unit.quUnit);
    }
    return Math.floor(stock / unit.quUnit).toString();
  }


  formatNum(input: number) {
    return this.currencyServ.formatNumber(input);
  }

  onSelectProductInv() {
    console.log('Inventario not implemented.');
  }
}
