import { EventEmitter, Injectable, inject } from '@angular/core';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { TypeProductStructure } from 'src/app/modelos/tables/typeProductStructure';
import { ProductDetail } from 'src/app/modelos/ProductDetail';
import { ProductUtil } from 'src/app/modelos/ProductUtil';
import { ProductStructureService } from '../productStructures/product-structure.service';
import { Subject } from 'rxjs';
import { Unit } from 'src/app/modelos/tables/unit';
import { Filesystem } from '@capacitor/filesystem';
import { ImageServicesService } from '../imageServices/image-services.service';
import { Imagenes } from 'src/app/modelos/imagenes';
import { CurrencyService } from '../currency/currency.service';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { List } from 'src/app/modelos/tables/list';
import { PriceList } from 'src/app/modelos/tables/priceList';
import { UnitPriceList } from 'src/app/modelos/tables/unitPriceList';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { TextService } from '../text/text.service';
import { UnitInfo } from 'src/app/modelos/unitInfo';
import { MAX_ITEMS_PER_PAGE } from 'src/app/utils/appConstants';
import type { PedidosService } from 'src/app/pedidos/pedidos.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  //dbServ = inject(SynchronizationDBService);
  imageServices = inject(ImageServicesService);
  currencyService = inject(CurrencyService);
  globalConfig = inject(GlobalConfigService);
  psService = inject(ProductStructureService);
  textService = inject(TextService);



  /** Snapshot estable para UI catálogo: copia tags/flags/tablas después de PedidosService.setup(). */
  catalogOrderPresentationTags = new Map<string, string>();

  catalogShowProductImages = false;
  catalogDisplayProductPoints = false;
  catalogShowStock = false;
  catalogQuUnitDecimals = false;
  catalogUnitByPriceList = false;
  catalogValidateWarehouses = false;
  catalogProductMinMul = false;
  catalogHideStock0 = false;
  catalogHideProdWithoutPrice = false;

  catalogListaPricelist: PriceList[] = [];
  catalogListaList: List[] = [];
  catalogListaUnitPriceList: UnitPriceList[] = [];
  catalogListaUnitInfo: UnitInfo[] = [];
  private catalogProdMinMulMap = new Map<number, { quMinimum: number; quMultiple: number }>();

  public productList: ProductUtil[] = [];
  public typeProductStructureList: TypeProductStructure[] = [];
  public coProductStructureList: string[] = [];
  public productDetail!: ProductDetail;
  public listPrices?: {idList: number, naList: string, nuPrice: number, coUnit: string, naUnit: string, coCurrency: string}[];
  public empresaSeleccionada!: Enterprise;
  public listaEmpresa: Enterprise[] = [];
  public multiempresa: Boolean = false;
  public unitsByProduct: Unit[] = [];
  public vatExemptProducts: boolean = false;
  public userCanSelectIVA:boolean = false;

  productoSearch = new Subject<string>;
  onSearchClicked = new Subject<boolean>;
  productStructureCLicked = new Subject<boolean>;
  featuredStructureClicked = new Subject<boolean>;
  backButtonClicked = new Subject<boolean>;
  favoriteStructureClicked = new Subject<boolean>;
  inventoryTabClicked = new Subject<boolean>;
  carritoButtonClicked = new Subject<boolean>();
  returnBackClicked = new Subject<boolean>();

  searchTextChanged = new Subject<string>();
  searchStructures = false; //flag para saber si se busca en todas las estructuras.

  MAX_ITEMS_PER_PAGE = MAX_ITEMS_PER_PAGE; // cantidad de registros a traer por cada consulta a la base de datos (para evitar problemas de rendimiento)
  private productSearchRequestId = 0;

  constructor() { }

  /**
   * Copia estado desde `PedidosService` (no inyectarlo aquí: evita ciclo DI vía ReturnDatabaseService → ProductService → Pedidos).
   */
  syncOrderPresentationFromPedidos(ped: PedidosService): void {
    this.catalogOrderPresentationTags = new Map(ped.tags);
    this.catalogShowProductImages = !!ped.showProductImages;
    this.catalogDisplayProductPoints = !!ped.displayProductPoints;
    this.catalogShowStock = !!ped.showStock;
    this.catalogQuUnitDecimals = !!ped.quUnitDecimals;
    this.catalogUnitByPriceList = !!ped.unitByPriceList;
    this.catalogValidateWarehouses = !!ped.validateWarehouses;
    this.catalogProductMinMul = !!ped.productMinMul;
    this.catalogHideStock0 = !!ped.hideStock0;
    this.catalogHideProdWithoutPrice = !!ped.hideProdWithoutPrice;
    this.catalogListaPricelist = [...ped.listaPricelist];
    this.catalogListaList = [...ped.listaList];
    this.catalogListaUnitPriceList = [...ped.listaUnitPriceList];
    this.catalogListaUnitInfo = [...ped.listaUnitInfo];
    this.catalogProdMinMulMap = new Map(ped.prodMinMulMap);
  }

  getCatalogPresentationTag(coApplicationTag: string): string {
    const fromOrder = this.catalogOrderPresentationTags.get(coApplicationTag);
    return typeof fromOrder === 'string' ? fromOrder : '';
  }

  getCatalogProdMinMul(idProduct: number): { quMinimum: number; quMultiple: number } {
    const row = this.catalogProdMinMulMap.get(idProduct);
    return row ? { ...row } : { quMinimum: 1, quMultiple: 1 };
  }

  catalogHasProdMinMul(idProduct: number): boolean {
    return this.catalogProductMinMul && this.catalogProdMinMulMap.has(idProduct);
  }

  formatStock(stock: number | null, quUnitDecimals: boolean): string {
    if (quUnitDecimals) {
      //mostrar decimales
      if (stock === null) {
        return this.currencyService.formatNumber(0);
      }
      return this.currencyService.formatNumber(stock);
    } else {
      //no mostrar decimales
      if (stock === null) {
        return '0';
      }
      return Math.floor(stock).toString();
    }


  }

  onProductSearch(search: string) {
    this.productoSearch.next(search);

  }

  onProductStructureCLicked() {
    this.productStructureCLicked.next(true);
  }

  onProductTabSearchClicked() {
    this.onSearchClicked.next(true);
  }

  onFeaturedStructureClicked() {
    this.featuredStructureClicked.next(true);
  }

  onFavoriteStructureClicked() {
    this.favoriteStructureClicked.next(true);
  }

  onInventoryTabClicked() {
    this.inventoryTabClicked.next(true);
  }

  onCarritoButtonClicked() {
    this.carritoButtonClicked.next(true);
  }

  onBackButtonClicked() {
    this.backButtonClicked.next(true);
  }

  onReturnBackClicked() {
    this.returnBackClicked.next(true);
  }

  private getProductsOrderByClause(): string {
    const fallback = 'p.na_product ASC';
    let configuredOrder = (this.globalConfig.get('productsOrderBy') || '').toString().trim();


    if (!configuredOrder) {
      return fallback;
    }

    const normalizedOrder = configuredOrder.toLowerCase();
    const validOrderRegex = /^(na_product|co_product|nu_priority)$/i;

    if (!validOrderRegex.test(normalizedOrder)) {
      return fallback;
    }

    if (/\s+(asc|desc)$/i.test(normalizedOrder)) {
      return normalizedOrder;
    }

    return 'p.'+normalizedOrder+' ASC';
  }

  getProductsByCoProductStructureAndIdEnterprise(dbServ: SQLiteObject, idProductStructures: number[], idEnterprise: number, coCurrency: string, page: number) {
    var database = dbServ;
    this.productList = [];
    if (this.globalConfig.get("conversionByPriceList") == "true") {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, " +
        " (select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product order by l.na_list limit 1) as id_list, " +
        " (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product order by l.na_list limit 1) as nu_price, " +
        " (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product order by l.na_list limit 1) as co_currency, " +
        " (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product order by l.na_list limit 1) as nu_price_opposite, " +
        " (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product order by l.na_list limit 1) as co_currency_opposite, " +
        " (select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, p.id_enterprise, p.co_enterprise FROM products p WHERE p.id_product_structure in ( " + idProductStructures +
        " ) AND p.id_enterprise = ? ORDER BY " + this.getProductsOrderByClause() + " LIMIT " + this.MAX_ITEMS_PER_PAGE + " OFFSET " + (page * this.MAX_ITEMS_PER_PAGE) + ";";
      return database.executeSql(select, [idEnterprise]).then(result => {
        this.productList = [];
        for (let i = 0; i < result.rows.length; i++) {
          this.productList.push({
            idProduct: result.rows.item(i).id_product,
            coProduct: result.rows.item(i).co_product,
            naProduct: result.rows.item(i).na_product,
            points: result.rows.item(i).points,
            txDescription: result.rows.item(i).tx_description,
            idList: result.rows.item(i).id_list,
            price: result.rows.item(i).nu_price,
            coCurrency: result.rows.item(i).co_currency,
            priceOpposite: result.rows.item(i).nu_price_opposite,
            coCurrencyOpposite: result.rows.item(i).co_currency_opposite,
            stock: result.rows.item(i).qu_stock,
            idEnterprise: result.rows.item(i).id_enterprise,
            coEnterprise: result.rows.item(i).co_enterprise,
            images: this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: result.rows.item(i).id_product_structure,
            nuTax: result.rows.item(i).nu_tax
          });
        }
      }).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos.");
        console.log(e);
      })
    } else {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, " +
        "(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product order by l.na_list limit 1) as id_list, " +
        "(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product order by l.na_list limit 1) as nu_price, " +
        "(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product order by l.na_list limit 1) as co_currency, " +
        "(select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, " +
        'p.id_enterprise, p.co_enterprise FROM products p WHERE p.id_product_structure in ( ' + idProductStructures +
        ' ) AND p.id_enterprise = ? ORDER BY ' + this.getProductsOrderByClause() + ' LIMIT ' + this.MAX_ITEMS_PER_PAGE + " OFFSET " + (page * this.MAX_ITEMS_PER_PAGE) + ";";
      return database.executeSql(select, [idEnterprise]).then(result => {
        this.productList = [];
        for (let i = 0; i < result.rows.length; i++) {
          var item = result.rows.item(i);
          var product = {
            idProduct: item.id_product,
            coProduct: item.co_product,
            naProduct: item.na_product,
            points: item.points,
            txDescription: item.tx_description,
            idList: item.id_list,
            price: item.nu_price,
            coCurrency: item.co_currency,
            priceOpposite: this.currencyService.isLocalCurrency(item.co_currency) ?
              this.currencyService.toHardCurrency(item.nu_price) :
              this.currencyService.toLocalCurrency(item.nu_price), // Precio en la moneda opuesta a la lista de precio
            coCurrencyOpposite: this.currencyService.oppositeCoCurrency(item.co_currency), // moneda opuesta a la lista de precio,
            stock: item.qu_stock,
            idEnterprise: item.id_enterprise,
            coEnterprise: item.co_enterprise,
            images: this.imageServices.mapImagesFiles.get(item.co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(item.co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: item.id_product_structure,
            nuTax: item.nu_tax
          } as ProductUtil;
          if (coCurrency != product.coCurrency) {
            //intercambiamos precios y monedas
            this.switchPrices(product);
          }
          this.productList.push(product);
        }
      }).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos.");
        console.log(e);
      })
    }
  }

  getProductsByCoProductStructureAndIdEnterprisePaged(dbServ: SQLiteObject, idProductStructures: number[], idEnterprise: number, coCurrency: string, userCanChangeWarehouse: boolean, id_client: number, id_list: number, page: number,) {
    var database = dbServ;
    var offset = page * this.MAX_ITEMS_PER_PAGE;
    this.productList = [];
    if (this.globalConfig.get("conversionByPriceList") == "true") {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, " +
        " (select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as id_list, " +
        " (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as nu_price, " +
        " (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as co_currency, " +
        " (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as nu_price_opposite, " +
        " (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as co_currency_opposite, ";
      if (userCanChangeWarehouse) {
        select = select + " (select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, ";
      } else {
        select = select + " (select s.qu_stock from stocks s where s.id_product = p.id_product AND s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = " + id_client + " AND c.id_enterprise = p.id_enterprise)) as qu_stock, ";
      }
      select = select +
        " p.id_enterprise, p.co_enterprise FROM products p WHERE p.id_product_structure in ( " + idProductStructures + " ) ";
      if (!userCanChangeWarehouse) {
        //filtramos que solo aparezcan los productos del almacen del cliente
        select = select + 'AND p.id_product in (select s.id_product from stocks s where  s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = ' + id_client + ' AND c.id_enterprise = p.id_enterprise)) ';
      }
      select = select + "ORDER BY " + this.getProductsOrderByClause() + " limit ? offset ?"
      return database.executeSql(select, [this.MAX_ITEMS_PER_PAGE, offset]).then(result => {
        this.productList = [];
        for (let i = 0; i < result.rows.length; i++) {
          this.productList.push({
            idProduct: result.rows.item(i).id_product,
            coProduct: result.rows.item(i).co_product,
            naProduct: result.rows.item(i).na_product,
            points: result.rows.item(i).points,
            txDescription: result.rows.item(i).tx_description,
            idList: result.rows.item(i).id_list,
            price: result.rows.item(i).nu_price,
            coCurrency: result.rows.item(i).co_currency,
            priceOpposite: result.rows.item(i).nu_price_opposite,
            coCurrencyOpposite: result.rows.item(i).co_currency_opposite,
            stock: result.rows.item(i).qu_stock,
            idEnterprise: result.rows.item(i).id_enterprise,
            coEnterprise: result.rows.item(i).co_enterprise,
            images: this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: result.rows.item(i).id_product_structure,
            nuTax: result.rows.item(i).nu_tax
          });
        }
      }).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos.");
        console.log(e);
      })
    } else {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, " +
        "(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as id_list, " +
        "(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as nu_price, " +
        "(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as co_currency, "
      if (userCanChangeWarehouse) {
        select = select + "(select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, ";
      } else {
        select = select + " (select s.qu_stock from stocks s where s.id_product = p.id_product AND s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = " + id_client + " AND c.id_enterprise = p.id_enterprise)) as qu_stock, ";
      }
      select = select +
        'p.id_enterprise, p.co_enterprise FROM products p WHERE p.id_product_structure in ( ' + idProductStructures + ' ) ';
      if (!userCanChangeWarehouse) {
        //filtramos que solo aparezcan los productos del almacen del cliente
        select = select + 'AND p.id_product in (select s.id_product from stocks s where  s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = ' + id_client + ' AND c.id_enterprise = p.id_enterprise)) ';
      }
      select = select + 'AND p.id_enterprise = ? ORDER BY ' + this.getProductsOrderByClause() + ' limit ? offset ?'
      return database.executeSql(select, [idEnterprise, this.MAX_ITEMS_PER_PAGE, offset]).then(result => {
        this.productList = [];
        for (let i = 0; i < result.rows.length; i++) {
          this.productList.push({
            idProduct: result.rows.item(i).id_product,
            coProduct: result.rows.item(i).co_product,
            naProduct: result.rows.item(i).na_product,
            points: result.rows.item(i).points,
            txDescription: result.rows.item(i).tx_description,
            idList: result.rows.item(i).id_list,
            price: result.rows.item(i).nu_price,
            coCurrency: result.rows.item(i).co_currency,
            priceOpposite: result.rows.item(i).co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.toHardCurrency(result.rows.item(i).nu_price) :
              this.currencyService.toLocalCurrency(result.rows.item(i).nu_price), // Precio en la moneda opuesta a la lista de precio
            coCurrencyOpposite: result.rows.item(i).co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.hardCurrency.coCurrency :
              this.currencyService.localCurrency.coCurrency, // moneda opuesta a la lista de precio,
            stock: result.rows.item(i).qu_stock,
            idEnterprise: result.rows.item(i).id_enterprise,
            coEnterprise: result.rows.item(i).co_enterprise,
            images: this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: result.rows.item(i).id_product_structure,
            nuTax: result.rows.item(i).nu_tax
          });
        }
      }).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos con paginacion.");
        console.log(e);
      })
    }
  }

  getFeaturedProducts(dbServ: SQLiteObject, idEnterprise: number, coCurrency: string, userCanChangeWarehouse: boolean, id_client: number, id_list: number, page: number) {
    var database = dbServ;
    var offset = page * this.MAX_ITEMS_PER_PAGE;
    this.productList = [];
    if (this.globalConfig.get("conversionByPriceList") == "true") {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, " +
        "(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product order by l.na_list limit 1) as id_list, " //+
      //"(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = "+id_list+" order by l.na_list limit 1) as nu_price, " +
      //"(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = "+id_list+" order by l.na_list limit 1) as co_currency, " +
      //"(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = "+id_list+" order by l.na_list limit 1) as nu_price_opposite, " +
      //"(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = "+id_list+" order by l.na_list limit 1) as co_currency_opposite, ";
      if (userCanChangeWarehouse) {
        select = select + " (select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, ";
      } else {
        select = select + " (select s.qu_stock from stocks s where s.id_product = p.id_product AND s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = " + id_client + " AND c.id_enterprise = p.id_enterprise)) as qu_stock, ";
      }
      select = select +
        " p.id_enterprise, p.co_enterprise FROM products p WHERE p.featured_product = 'true' and p.id_enterprise = ? ";
      if (!userCanChangeWarehouse) {
        //filtramos que solo aparezcan los productos del almacen del cliente
        select = select + 'AND p.id_product in (select s.id_product from stocks s where  s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = ' + id_client + ' AND c.id_enterprise = p.id_enterprise)) ';
      }
      select = select + " ORDER BY " + this.getProductsOrderByClause() + " limit ? offset ?;"
      return database.executeSql(select, [idEnterprise, this.MAX_ITEMS_PER_PAGE, offset]).then(result => {
        this.productList = [];
        for (let i = 0; i < result.rows.length; i++) {
          let item = result.rows.item(i);
          this.productList.push({
            idProduct: item.id_product,
            coProduct: item.co_product,
            naProduct: item.na_product,
            points: item.points,
            txDescription: item.tx_description,
            idList: item.id_list,
            price: item.nu_price,
            coCurrency: item.co_currency,
            priceOpposite: item.nu_price_opposite,
            coCurrencyOpposite: item.co_currency_opposite,
            stock: item.qu_stock,
            idEnterprise: item.id_enterprise,
            coEnterprise: item.co_enterprise,
            images: this.imageServices.mapImagesFiles.get(item.co_product) === undefined ?
              '../../../assets/images/nodisponible.png' :
              this.imageServices.mapImagesFiles.get(item.co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: item.id_product_structure,
            nuTax: item.nu_tax
          });
        }
      }).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos.");
        console.log(e);
      })
    } else {
      var select = 'select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, ' +
        '(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = ' + id_list + ' order by l.na_list limit 1) as id_list, '// +
      //'(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = '+id_list+' order by l.na_list limit 1) as nu_price, ' +
      //'(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = '+id_list+' order by l.na_list limit 1) as co_currency, ';
      if (userCanChangeWarehouse) {
        select = select + " (select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, ";
      } else {
        select = select + " (select s.qu_stock from stocks s where s.id_product = p.id_product AND s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = " + id_client + " AND c.id_enterprise = p.id_enterprise)) as qu_stock, ";
      }
      select = select +
        'p.id_enterprise, p.co_enterprise FROM products p WHERE p.featured_product = "true" AND p.id_enterprise = ? ';
      if (!userCanChangeWarehouse) {
        //filtramos que solo aparezcan los productos del almacen del cliente
        select = select + 'AND p.id_product in (select s.id_product from stocks s where  s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = ' + id_client + ' AND c.id_enterprise = p.id_enterprise)) ';
      }
      select = select + 'ORDER BY ' + this.getProductsOrderByClause() + ' limit ? offset ?'
      return database.executeSql(select, [idEnterprise, this.MAX_ITEMS_PER_PAGE, offset]).then(result => {
        this.productList = [];
        for (let i = 0; i < result.rows.length; i++) {
          let item = result.rows.item(i);
          this.productList.push({
            idProduct: item.id_product,
            coProduct: item.co_product,
            naProduct: item.na_product,
            points: item.points,
            txDescription: item.tx_description,
            idList: item.id_list,
            price: 0,// item.nu_price,
            coCurrency: "",//item.co_currency,
            priceOpposite: 0,/* item.co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.toHardCurrency(item.nu_price) :
              this.currencyService.toLocalCurrency(item.nu_price), // Precio en la moneda opuesta a la lista de precio*/
            coCurrencyOpposite: "", /*item.co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.hardCurrency.coCurrency :
              this.currencyService.localCurrency.coCurrency,*/ // moneda opuesta a la lista de precio,
            stock: item.qu_stock,
            idEnterprise: item.id_enterprise,
            coEnterprise: item.co_enterprise,
            images: this.imageServices.mapImagesFiles.get(item.co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(item.co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: item.id_product_structure,
            nuTax: item.nu_tax
          });
        }
      }).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos.");
        console.log(e);
      })
    }

  }

  getFeaturedProductCount(dbServ: SQLiteObject, idEnterprise: number) {
    var database = dbServ;
    let query = 'SELECT count(id_product) as count from products where featured_product = "true" and id_enterprise = ?'
    return database.executeSql(query, [idEnterprise]).then(result => {
      return result.rows.item(0).count;
    })
  }

  getFavoriteProductCount(dbServ: SQLiteObject, idEnterprise: number) {
    var database = dbServ;
    let query = 'select  count(distinct id_product) as count from user_product_favs where id_enterprise = ?'
    return database.executeSql(query, [idEnterprise]).then(result => {
      return result.rows.item(0).count;
    })
  }

  getFavoriteProducts(dbServ: SQLiteObject, idEnterprise: number, coCurrency: string, userCanChangeWarehouse: boolean, id_client: number, id_list: number, page: number) {
    var database = dbServ;
    var offset = page * this.MAX_ITEMS_PER_PAGE;
    this.productList = [];
    if (this.globalConfig.get("conversionByPriceList") == "true") {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, " +
        "(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as id_list, " //+
      //"(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = "+id_list+" order by l.na_list limit 1) as nu_price, " +
      //"(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = "+id_list+" order by l.na_list limit 1) as co_currency, " +
      //"(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = "+id_list+" order by l.na_list limit 1) as nu_price_opposite, " +
      //"(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = "+id_list+" order by l.na_list limit 1) as co_currency_opposite, ";
      if (userCanChangeWarehouse) {
        select = select + " (select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, ";
      } else {
        select = select + " (select s.qu_stock from stocks s where s.id_product = p.id_product AND s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = " + id_client + " AND c.id_enterprise = p.id_enterprise)) as qu_stock, ";
      }
      select = select +
        " p.id_enterprise, p.co_enterprise FROM products p WHERE p.id_enterprise = ? " +
        'AND p.id_product in (select distinct id_product from user_product_favs) ';
      if (!userCanChangeWarehouse) {
        //filtramos que solo aparezcan los productos del almacen del cliente
        select = select + 'AND p.id_product in (select s.id_product from stocks s where  s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = ' + id_client + ' AND c.id_enterprise = p.id_enterprise)) ';
      }
      select = select +
        'ORDER BY ' + this.getProductsOrderByClause() + ' limit ? offset ?;'
      return database.executeSql(select, [idEnterprise, this.MAX_ITEMS_PER_PAGE, offset]).then(result => {
        this.productList = [];
        for (let i = 0; i < result.rows.length; i++) {
          this.productList.push({
            idProduct: result.rows.item(i).id_product,
            coProduct: result.rows.item(i).co_product,
            naProduct: result.rows.item(i).na_product,
            points: result.rows.item(i).points,
            txDescription: result.rows.item(i).tx_description,
            idList: result.rows.item(i).id_list,
            price: result.rows.item(i).nu_price,
            coCurrency: result.rows.item(i).co_currency,
            priceOpposite: result.rows.item(i).nu_price_opposite,
            coCurrencyOpposite: result.rows.item(i).co_currency_opposite,
            stock: result.rows.item(i).qu_stock,
            idEnterprise: result.rows.item(i).id_enterprise,
            coEnterprise: result.rows.item(i).co_enterprise,
            images: this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: result.rows.item(i).id_product_structure,
            nuTax: result.rows.item(i).nu_tax
          });
        }
      }).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos.");
        console.log(e);
      })
    } else {
      var select = 'select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, ' +
        '(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = ' + id_list + ' order by l.na_list limit 1) as id_list, ' //+
      //'(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = '+id_list+' order by l.na_list limit 1) as nu_price, ' +
      //'(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = '+id_list+' order by l.na_list limit 1) as co_currency, ';
      if (userCanChangeWarehouse) {
        select = select + " (select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, ";
      } else {
        select = select + " (select s.qu_stock from stocks s where s.id_product = p.id_product AND s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = " + id_client + " AND c.id_enterprise = p.id_enterprise)) as qu_stock, ";
      }
      select = select +
        'p.id_enterprise, p.co_enterprise FROM products p WHERE  p.id_enterprise = ? ' +
        'AND p.id_product in (select distinct id_product from user_product_favs) ';
      if (!userCanChangeWarehouse) {
        //filtramos que solo aparezcan los productos del almacen del cliente
        select = select + 'AND p.id_product in (select s.id_product from stocks s where  s.id_warehouse = (SELECT id_warehouse FROM clients c WHERE c.id_client = ' + id_client + ' AND c.id_enterprise = p.id_enterprise)) ';
      }
      select = select +
        'ORDER BY ' + this.getProductsOrderByClause() + ' limit ? offset ?';
      return database.executeSql(select, [idEnterprise, this.MAX_ITEMS_PER_PAGE, offset]).then(result => {
        this.productList = [];
        for (let i = 0; i < result.rows.length; i++) {
          this.productList.push({
            idProduct: result.rows.item(i).id_product,
            coProduct: result.rows.item(i).co_product,
            naProduct: result.rows.item(i).na_product,
            points: result.rows.item(i).points,
            txDescription: result.rows.item(i).tx_description,
            idList: result.rows.item(i).id_list,
            price: 0, //result.rows.item(i).nu_price,
            coCurrency: '',//result.rows.item(i).co_currency,
            priceOpposite: 0,/*result.rows.item(i).co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.toHardCurrency(result.rows.item(i).nu_price) :
              this.currencyService.toLocalCurrency(result.rows.item(i).nu_price), // Precio en la moneda opuesta a la lista de precio */
            coCurrencyOpposite: '',/*result.rows.item(i).co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.hardCurrency.coCurrency :
              this.currencyService.localCurrency.coCurrency, // moneda opuesta a la lista de precio,*/
            stock: result.rows.item(i).qu_stock,
            idEnterprise: result.rows.item(i).id_enterprise,
            coEnterprise: result.rows.item(i).co_enterprise,
            images: this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: result.rows.item(i).id_product_structure,
            nuTax: result.rows.item(i).nu_tax
          });
        }
      }).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos.");
        console.log(e);
      })
    }

  }

  getProductsByCoProductAndNaProduct(searchText: string) {
    let productListFilter: ProductUtil[] = this.productList.filter(p => {
      console.log(p.naProduct.toLowerCase().includes(searchText));
      p.naProduct.toLowerCase().includes(searchText);
    });
    return productListFilter;
  }

  getProductsSearchedByCoProductAndNaProduct(dbServ: SQLiteObject, searchText: string, idEnterprise: number, coCurrency: string, page: number) {
    var database = dbServ;
    this.productList = [];

    // Normalize and split search text into tokens
    const tokens = (searchText || '').toString().trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);

    // Build WHERE clause: for each token require (co_product LIKE ? OR na_product LIKE ?)
    const tokenClauses: string[] = [];
    const params: any[] = [];
    for (const t of tokens) {
      const pattern = this.textService.convertToSqliteAccentGlob(t);
      tokenClauses.push("(p.co_product GLOB ? OR p.na_product GLOB ?)");
      params.push(pattern, pattern);
    }

    // always filter by enterprise
    var whereTokens = tokenClauses.length ? tokenClauses.join(" AND ") + " AND p.id_enterprise = ?" : "p.id_enterprise = ?";
    params.push(idEnterprise);

    if (this.psService && this.psService.idProductStructureList.length > 0) {
      whereTokens += " AND p.id_product_structure IN (" + this.psService.idProductStructureList.map(() => '?').join(',') + ")";
      params.push(... this.psService.idProductStructureList);
    }

    //paginacion: limit y offset
    const offset = page * this.MAX_ITEMS_PER_PAGE;
    params.push(this.MAX_ITEMS_PER_PAGE, offset);

    let orderByClause = this.getProductsOrderByClause();

    if (this.globalConfig.get("conversionByPriceList") == "true") {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, (select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product order by l.na_list limit 1) as id_list, " +
        " (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product order by l.na_list limit 1) as nu_price, " +
        " (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product order by l.na_list limit 1) as co_currency, " +
        " (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product order by l.na_list limit 1) as nu_price_opposite, " +
        " (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product order by l.na_list limit 1) as co_currency_opposite, " +
        " (select s.qu_stock from stocks s where s.id_product = p.id_product) as qu_stock, p.id_enterprise, p.co_enterprise FROM products p WHERE " + whereTokens + " ORDER BY " + orderByClause + " limit ? offset ?";
      return database.executeSql(select, params).then(result => {
        for (let i = 0; i < result.rows.length; i++) {
          this.productList.push({
            idProduct: result.rows.item(i).id_product,
            coProduct: result.rows.item(i).co_product,
            naProduct: result.rows.item(i).na_product,
            points: result.rows.item(i).points,
            txDescription: result.rows.item(i).tx_description,
            idList: result.rows.item(i).id_list,
            price: result.rows.item(i).nu_price,
            coCurrency: result.rows.item(i).co_currency,
            priceOpposite: result.rows.item(i).nu_price_opposite,
            coCurrencyOpposite: result.rows.item(i).co_currency_opposite,
            stock: result.rows.item(i).qu_stock,
            idEnterprise: result.rows.item(i).id_enterprise,
            coEnterprise: result.rows.item(i).co_enterprise,
            images: this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: result.rows.item(i).id_product_structure,
            nuTax: result.rows.item(i).nu_tax
          });
        }
      }
      ).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos.");
        console.log(e);
      })
    } else {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, " +
        "p.tx_description, p.id_product_structure, p.nu_tax, " +
        "(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list " +
        "where pl.id_product = p.id_product order by l.na_list limit 1) as id_list, " +
        "(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list " +
        "where pl.id_product = p.id_product order by l.na_list limit 1) as nu_price, " +
        "(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list " +
        "where pl.id_product = p.id_product order by l.na_list limit 1) as co_currency, " +
        "(select s.qu_stock from stocks s where s.id_product = p.id_product) as qu_stock, " +
        "p.id_enterprise, p.co_enterprise FROM products p WHERE " + whereTokens +
        " ORDER BY " + orderByClause + " limit ? offset ?";
      return database.executeSql(select, params).then(result => {
        for (let i = 0; i < result.rows.length; i++) {
          let item = result.rows.item(i);
          let product = {
            idProduct: item.id_product,
            coProduct: item.co_product,
            naProduct: item.na_product,
            points: item.points,
            txDescription: item.tx_description,
            idList: item.id_list,
            price: item.nu_price,
            coCurrency: item.co_currency,
            priceOpposite: item.co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.toHardCurrency(item.nu_price) :
              this.currencyService.toLocalCurrency(item.nu_price), // Precio en la moneda opuesta a la lista de precio
            coCurrencyOpposite: item.co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.hardCurrency.coCurrency :
              this.currencyService.localCurrency.coCurrency, // moneda opuesta a la lista de precio,
            stock: item.qu_stock,
            idEnterprise: item.id_enterprise,
            coEnterprise: item.co_enterprise,
            images: this.imageServices.mapImagesFiles.get(item.co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(item.co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: item.id_product_structure,
            nuTax: item.nu_tax
          } as ProductUtil;
          if (coCurrency != product.coCurrency) {
            //intercambiamos precios y monedas
            this.switchPrices(product);
          }
          this.productList.push(product);
        }
      }
      ).catch(e => {
        this.productList = [];
        console.log("[ProductService] Error al cargar productos.");
        console.log(e);
      })
    }
  }

  getProductsSearchedByCoProductAndNaProductAndIdList(dbServ: SQLiteObject, searchText: string, idEnterprise: number, coCurrency: string, id_list: number, page: number): Promise<void> {
    if (page === 0) {
      this.productSearchRequestId++;
    }
    const requestId = this.productSearchRequestId;
    const database = dbServ;
    const tokens = (searchText || '').toString().trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);

    const tokenClauses: string[] = [];
    const params: any[] = [];
    for (const t of tokens) {
      const pattern = this.textService.convertToSqliteAccentGlob(t);
      tokenClauses.push("(p.co_product GLOB ? OR p.na_product GLOB ?)");
      params.push(pattern, pattern);
    }

    let whereClause = tokenClauses.length ? tokenClauses.join(" AND ") + " AND p.id_enterprise = ?" : "p.id_enterprise = ?";
    params.push(idEnterprise);

    if (this.psService && this.psService.idProductStructureList.length > 0) {
      whereClause += " AND p.id_product_structure IN (" + this.psService.idProductStructureList.map(() => '?').join(',') + ")";
      params.push(...this.psService.idProductStructureList);
    }

    const offset = page * this.MAX_ITEMS_PER_PAGE;
    params.push(this.MAX_ITEMS_PER_PAGE, offset);

    const orderByClause = "ORDER BY " + this.getProductsOrderByClause();
    this.productList = [];

    const mapRowsWithOppositeColumns = (result: any): void => {
      if (requestId !== this.productSearchRequestId) {
        return;
      }
      try {
        for (let i = 0; i < result.rows.length; i++) {
          const row = result.rows.item(i);
          this.productList.push({
            idProduct: row.id_product,
            coProduct: row.co_product,
            naProduct: row.na_product,
            points: row.points,
            txDescription: row.tx_description,
            idList: row.id_list,
            price: row.nu_price,
            coCurrency: row.co_currency,
            priceOpposite: row.nu_price_opposite,
            coCurrencyOpposite: row.co_currency_opposite,
            stock: row.qu_stock,
            idEnterprise: row.id_enterprise,
            coEnterprise: row.co_enterprise,
            images: this.imageServices.mapImagesFiles.get(row.co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(row.co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: row.id_product_structure,
            nuTax: row.nu_tax
          });
        }
      } catch (error) {
        this.productList = [];
        console.log("[ProductService] Error al procesar productos.");
        console.log(error);
      }
    };

    const mapRowsWithCalculatedOpposite = (result: any): void => {
      if (requestId !== this.productSearchRequestId) {
        return;
      }
      try {
        for (let i = 0; i < result.rows.length; i++) {
          const row = result.rows.item(i);
          this.productList.push({
            idProduct: row.id_product,
            coProduct: row.co_product,
            naProduct: row.na_product,
            points: row.points,
            txDescription: row.tx_description,
            idList: row.id_list,
            price: row.nu_price,
            coCurrency: row.co_currency,
            priceOpposite: row.co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.toHardCurrency(row.nu_price) :
              this.currencyService.toLocalCurrency(row.nu_price),
            coCurrencyOpposite: row.co_currency === this.currencyService.getLocalCurrency ?
              this.currencyService.hardCurrency.coCurrency :
              this.currencyService.localCurrency.coCurrency,
            stock: row.qu_stock,
            idEnterprise: row.id_enterprise,
            coEnterprise: row.co_enterprise,
            images: this.imageServices.mapImagesFiles.get(row.co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(row.co_product)?.[0],
            typeStocks: undefined,
            productUnitList: undefined,
            idProductStructure: row.id_product_structure,
            nuTax: row.nu_tax
          });
        }
      } catch (error) {
        this.productList = [];
        console.log("[ProductService] Error al procesar productos.");
        console.log(error);
      }
    };

    const handleSearchError = (error: unknown): void => {
      if (requestId !== this.productSearchRequestId) {
        return;
      }
      this.productList = [];
      console.log("[ProductService] Error al cargar productos.");
      console.log(error);
    };

    if (this.globalConfig.get("conversionByPriceList") == "true") {
      const select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, (select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as id_list, " +
        " (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as nu_price, " +
        " (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as co_currency, " +
        " (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as nu_price_opposite, " +
        " (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as co_currency_opposite, " +
        " (select SUM(s.qu_stock) from stocks s where s.id_product = p.id_product) as qu_stock, p.id_enterprise, p.co_enterprise FROM products p WHERE " + whereClause + " " + orderByClause + " limit ? offset ?";
      return database.executeSql(select, params)
        .then(mapRowsWithOppositeColumns)
        .catch(handleSearchError);
    }

    const select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, p.id_product_structure, p.nu_tax, " +
      "(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as id_list," +
      "(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + id_list + " order by l.na_list limit 1) as nu_price," +
      "(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + id_list + "  order by l.na_list limit 1) as co_currency," +
      "(select SUM(s.qu_stock) from stocks s where s.id_product = p.id_product) as qu_stock, p.id_enterprise, p.co_enterprise FROM products p WHERE " + whereClause + " " + orderByClause + " limit ? offset ?";
    return database.executeSql(select, params)
      .then(mapRowsWithCalculatedOpposite)
      .catch(handleSearchError);
  }
  private buildProductDetailFromClause(): string {
    return ' from products p' +
      ' left join product_structures ps on p.id_product_structure = ps.id_product_structure' +
      ' left join units u on p.co_primary_unit = u.co_unit and p.id_enterprise = u.id_enterprise';
  }

  private buildProductDetailStructureColumns(): string {
    return 'COALESCE(ps.id_product_structure, p.id_product_structure, 0) as id_product_structure, ' +
      'COALESCE(ps.co_product_structure, \'\') as co_product_structure, ' +
      'COALESCE(ps.na_product_structure, \'\') as na_product_structure, ' +
      'COALESCE(u.id_unit, 0) as id_unit, ' +
      'COALESCE(u.co_unit, p.co_primary_unit, \'\') as co_unit, ' +
      'COALESCE(u.na_unit, \'\') as na_unit';
  }

  private buildDefaultPriceListSubquery(column: 'nu_price' | 'co_currency'): string {
    const defaultValue = column === 'nu_price' ? '0' : '\'\'';
    return `COALESCE((select pl.${column} from price_lists pl left join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product order by l.na_list limit 1), ${defaultValue}) as ${column}`;
  }

  private resolveProductDetailPrices(nuPrice: number | null | undefined, coCurrency: string | null | undefined): {
    priceLocal: number;
    priceHard: number | null;
    coCurrencyLocal: string;
    coCurrencyHard: string | null;
  } {
    const price = Number(nuPrice ?? 0);
    const currency = (coCurrency ?? '').trim();

    if (!currency) {
      return {
        priceLocal: price,
        priceHard: price,
        coCurrencyLocal: '',
        coCurrencyHard: null,
      };
    }

    return {
      priceLocal: price,
      priceHard: this.currencyService.isLocalCurrency(currency)
        ? this.currencyService.toHardCurrency(price)
        : this.currencyService.toLocalCurrency(price),
      coCurrencyLocal: currency,
      coCurrencyHard: this.currencyService.oppositeCoCurrency(currency),
    };
  }

  private mapProductDetailRow(row: Record<string, unknown>): ProductDetail {
    const prices = this.resolveProductDetailPrices(
      row['nu_price'] as number | null | undefined,
      row['co_currency'] as string | null | undefined
    );

    return {
      idProduct: Number(row['id_product'] ?? 0),
      coProduct: String(row['co_product'] ?? ''),
      naProduct: String(row['na_product'] ?? ''),
      idProductStructure: Number(row['id_product_structure'] ?? 0),
      coProductStructure: String(row['co_product_structure'] ?? ''),
      naProductStructure: String(row['na_product_structure'] ?? ''),
      txDescription: String(row['tx_description'] ?? ''),
      idUnit: Number(row['id_unit'] ?? 0),
      coUnit: String(row['co_unit'] ?? ''),
      naUnit: String(row['na_unit'] ?? ''),
      points: Number(row['points'] ?? 0),
      coEnterprise: String(row['co_enterprise'] ?? ''),
      idEnterprise: Number(row['id_enterprise'] ?? 0),
      nuTax: Number(row['nu_tax'] ?? 0),
      priceLocal: prices.priceLocal,
      priceHard: prices.priceHard,
      coCurrencyHard: prices.coCurrencyHard,
      coCurrencyLocal: prices.coCurrencyLocal,
      conversion: this.currencyService.getLocalValue(),
      stock: Number(row['qu_stock'] ?? 0),
      txPacking: String(row['tx_packing'] ?? ''),
      txDimension: String(row['tx_dimension'] ?? ''),
    } as ProductDetail;
  }

  getProductDetailByIdProduct(dbServ: SQLiteObject, idList: number, idProduct: number, coCurrency: string) {
    var database = dbServ;
    this.productDetail = {} as ProductDetail;
    if (this.globalConfig.get("conversionByPriceList") == "true") {
      var select = "select p.id_product, p.co_product, p.na_product, p.tx_description, p.tx_packing, p.tx_dimension, p.points, p.nu_tax, " +
        this.buildProductDetailStructureColumns() + ", " +
        "COALESCE((select pl.nu_price from price_lists pl where pl.id_list = " + idList + " and pl.id_product = " + idProduct + " and pl.co_currency = '" + coCurrency + "'), 0) as nu_price_default, " +
        "COALESCE((select pl.co_currency from price_lists pl where pl.id_list = " + idList + " and pl.id_product = " + idProduct + " and pl.co_currency = '" + coCurrency + "'), '') as co_currency_default, " +
        "COALESCE((select pl.nu_price from price_lists pl where pl.id_list = " + idList + " and pl.id_product = " + idProduct + " and pl.co_currency != '" + coCurrency + "'), 0) as nu_price_opposite, " +
        "COALESCE((select pl.co_currency from price_lists pl where pl.id_list = " + idList + " and pl.id_product = " + idProduct + " and pl.co_currency != '" + coCurrency + "'), '') as co_currency_opposite, " +
        "COALESCE((select SUM(s.qu_stock) from stocks s where s.id_product = p.id_product), 0) as qu_stock, p.co_enterprise, p.id_enterprise" +
        this.buildProductDetailFromClause() + " where p.id_product = " + idProduct
      return database.executeSql(select, []).then(pd => {
        if (pd && pd.rows.length > 0) {
          const row = pd.rows.item(0);
          this.productDetail = new ProductDetail(
            row.id_product,
            row.co_product ?? '',
            row.na_product ?? '',
            row.id_product_structure ?? 0,
            row.co_product_structure ?? '',
            row.na_product_structure ?? '',
            row.tx_description ?? '',
            row.tx_packing ?? '',
            row.tx_dimension ?? '',
            row.id_unit ?? 0,
            row.co_unit ?? '',
            row.na_unit ?? '',
            row.points ?? 0,
            row.nu_price_default ?? 0,
            row.co_currency_default ?? '',
            row.nu_price_opposite ?? 0,
            row.co_currency_opposite ?? '',
            this.currencyService.getLocalValue(),
            row.qu_stock ?? 0,
            row.co_enterprise ?? '',
            row.id_enterprise ?? 0,
            row.nu_tax ?? 0
          )
          console.log(this.productDetail);
        }
      }).catch(e => {
        this.productDetail = {} as ProductDetail;
        console.log("[ProductService] Error al cargar detalle de producto.");
        console.log(e);
      })
    } else {
      var select = "select p.id_product, p.co_product, p.na_product, p.nu_tax, p.tx_packing, p.tx_dimension, p.tx_description, p.points, " +
        this.buildProductDetailStructureColumns() + ", " +
        this.buildDefaultPriceListSubquery('nu_price') + ", " +
        this.buildDefaultPriceListSubquery('co_currency') + ", " +
        "COALESCE((select SUM(s.qu_stock) from stocks s where s.id_product = p.id_product), 0) as qu_stock, p.co_enterprise, p.id_enterprise" +
        this.buildProductDetailFromClause() + " where p.id_product = ?"
      return database.executeSql(select, [idProduct]).then(pd => {
        if (pd && pd.rows.length > 0) {
          this.productDetail = this.mapProductDetailRow(pd.rows.item(0));
          console.log(this.productDetail);
          /*this.productDetail = new ProductDetail(
            pd.rows.item(0).id_product,
            pd.rows.item(0).co_product,
            pd.rows.item(0).na_product,
            pd.rows.item(0).id_product_structure,
            pd.rows.item(0).co_product_structure,
            pd.rows.item(0).na_product_structure,
            pd.rows.item(0).tx_description,
            pd.rows.item(0).tx_packing,
            pd.rows.item(0).id_unit,
            pd.rows.item(0).co_unit,
            pd.rows.item(0).na_unit,
            pd.rows.item(0).points,
            pd.rows.item(0).nu_price, // Precio en la moneda de Lista de precio
            pd.rows.item(0).co_currency, // moneda de Lista de precio
            this.currencyService.isLocalCurrency(pd.rows.item(0).co_currency) ?
              this.currencyService.toHardCurrency(pd.rows.item(0).nu_price) :
              this.currencyService.toLocalCurrency(pd.rows.item(0).nu_price), // Precio en la moneda opuesta a la lista de precio
            this.currencyService.oppositeCoCurrency(pd.rows.item(0).co_currency),  // TASA
            pd.rows.item(0).qu_stock,
            pd.rows.item(0).co_enterprise,
            pd.rows.item(0).id_enterprise,
            pd.rows.item(0).nu_tax
          )*/
        }
      }).catch(e => {
        this.productDetail = {} as ProductDetail;
        console.log("[ProductService] Error al cargar detalle de producto.");
        console.log(e);
      })
    }

  }

  getUnitsByIdProductOrderByCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number) {
    //return this.getUnitByIdProductAndCoPrimaryUnit(idProduct);
    return this.getUnitByIdProductAndCoPrimaryUnit(dbServ, idProduct).then(() => {
      this.getUnitByIdProductAndNotCoPrimaryUnit(dbServ, idProduct).then();
    });
  }

  getUnitByIdProductAndCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number) {
    var database = dbServ;
    this.unitsByProduct = [];
    var select = "select u.id_unit, u.co_unit, u.na_unit, u.id_enterprise, u.co_enterprise, pu.id_product_unit, pu.co_product_unit, pu.qu_unit  from units u join product_units pu on u.id_unit = pu.id_unit join products p on pu.id_product = p.id_product where pu.id_product = ? and u.co_unit = p.co_primary_unit"
    return database.executeSql(select, [idProduct]).then(result => {
      for (let i = 0; i < result.rows.length; i++) {
        this.unitsByProduct.push({
          idUnit: result.rows.item(i).id_unit,
          coUnit: result.rows.item(i).co_unit,
          naUnit: result.rows.item(i).na_unit,
          idEnterprise: result.rows.item(i).id_enterprise,
          coEnterprise: result.rows.item(i).co_enterprise,
          idProductUnit: result.rows.item(i).id_product_unit,
          coProductUnit: result.rows.item(i).co_product_unit,
          quUnit: result.rows.item(i).qu_unit,
        });
      }
    }).catch(e => {
      this.unitsByProduct = [];
      console.log("[ProductService] Error al cargar getUnitByIdProductAndCoPrimaryUnit.");
      console.log(e);
    })
  }

  getUnitByIdProductAndNotCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number) {
    var database = dbServ;
    var select = "select u.id_unit, u.co_unit, u.na_unit, u.id_enterprise, u.co_enterprise, pu.id_product_unit, pu.co_product_unit, pu.qu_unit from units u join product_units pu on u.id_unit = pu.id_unit join products p on pu.id_product = p.id_product where pu.id_product = ? and u.co_unit != p.co_primary_unit"
    return database.executeSql(select, [idProduct]).then(result => {
      for (let i = 0; i < result.rows.length; i++) {
        this.unitsByProduct.push({
          idUnit: result.rows.item(i).id_unit,
          coUnit: result.rows.item(i).co_unit,
          naUnit: result.rows.item(i).na_unit,
          idEnterprise: result.rows.item(i).id_enterprise,
          coEnterprise: result.rows.item(i).co_enterprise,
          idProductUnit: result.rows.item(i).id_product_unit,
          coProductUnit: result.rows.item(i).co_product_unit,
          quUnit: result.rows.item(i).qu_unit,
        });
      }
    }).catch(e => {
      this.unitsByProduct = [];
      console.log("[ProductService] Error al cargar getUnitByIdProductAndNotCoPrimaryUnit.");
      console.log(e);
    })
  }

  getUnitByIdProductAndCoUnit(dbServ: SQLiteObject, idProduct: number, coUnit: string) {

    //TENGO QUE BUSCAR LA UNIDAD SELECCIONADA
    var database = dbServ;
    let unitByProduct = Unit;
    var select = "select u.id_unit, u.co_unit, u.na_unit, u.id_enterprise, u.co_enterprise, pu.id_product_unit, pu.co_product_unit, pu.qu_unit  from units u join product_units pu on u.id_unit = pu.id_unit join products p on pu.id_product = p.id_product where pu.id_product = ? and u.co_unit = ?"
    return database.executeSql(select, [idProduct, coUnit]).then(result => {
      for (let i = 0; i < result.rows.length; i++) {
        this.unitsByProduct.push({
          idUnit: result.rows.item(i).id_unit,
          coUnit: result.rows.item(i).co_unit,
          naUnit: result.rows.item(i).na_unit,
          idEnterprise: result.rows.item(i).id_enterprise,
          coEnterprise: result.rows.item(i).co_enterprise,
          idProductUnit: result.rows.item(i).id_product_unit,
          coProductUnit: result.rows.item(i).co_product_unit,
          quUnit: result.rows.item(i).qu_unit,
        });
      }
    }).catch(e => {
      this.unitsByProduct = [];
      console.log("[ProductService] Error al cargar getUnitByIdProductAndCoPrimaryUnit.");
      console.log(e);
    })
  }

  getProductsByIdInvoice(dbServ: SQLiteObject, idInvoice: number) {
    var database = dbServ;
    this.productList = [];

    var select = 'SELECT id_product, co_product, na_product, id_enterprise, co_enterprise, p.id_product_structure, p.nu_tax ' +
      'FROM products p WHERE id_product IN ' +
      '(SELECT id_product FROM invoice_details WHERE id_invoice = ? ORDER BY id_product ASC)'
    return database.executeSql(select, [idInvoice]).then(result => {
      for (let i = 0; i < result.rows.length; i++) {
        this.productList.push({
          idProduct: result.rows.item(i).id_product,
          coProduct: result.rows.item(i).co_product,
          naProduct: result.rows.item(i).na_product,
          idEnterprise: result.rows.item(i).id_enterprise,
          coEnterprise: result.rows.item(i).co_enterprise,
          images: this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product)?.[0],
          txDescription: '',
          points: 0,
          idList: 0,
          price: 0,
          coCurrency: '',
          priceOpposite: 0,
          coCurrencyOpposite: '',
          stock: 0,
          typeStocks: undefined,
          productUnitList: undefined,
          idProductStructure: result.rows.item(i).id_product_structure,
          nuTax: result.rows.item(i).nu_tax
        });
      }
    }).catch(e => {
      this.productList = [];
      console.log("[ProductService] Error al cargar productos.");
      console.log(e);
    })
  }

  searchProductsByIdInvoiceAndSearchText(dbServ: SQLiteObject, idInvoice: number, searchText: string) {
    var database = dbServ;
    this.productList = [];
    const tokens = (searchText || '').toString().trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const tokenClauses: string[] = [];
    const params: any[] = [];

    params.push(idInvoice);
    for (const t of tokens) {
      const pattern = this.textService.convertToSqliteAccentGlob(t);
      tokenClauses.push("(co_product GLOB ? OR na_product GLOB ?)");
      params.push(pattern, pattern);
    }
    var whereClause = tokenClauses.length ? tokenClauses.join(" AND ") : "1";
    var select = 'SELECT id_product, co_product, na_product, id_enterprise, co_enterprise, p.id_product_structure, p.nu_tax ' +
      'FROM products p WHERE id_product IN ' +
      '(SELECT id_product FROM invoice_details WHERE id_invoice = ? ORDER BY id_product ASC) AND ' + whereClause;
    return database.executeSql(select, params).then(result => {
      for (let i = 0; i < result.rows.length; i++) {
        this.productList.push({
          idProduct: result.rows.item(i).id_product,
          coProduct: result.rows.item(i).co_product,
          naProduct: result.rows.item(i).na_product,
          idEnterprise: result.rows.item(i).id_enterprise,
          coEnterprise: result.rows.item(i).co_enterprise,
          images: this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product) === undefined ? '../../../assets/images/nodisponible.png' : this.imageServices.mapImagesFiles.get(result.rows.item(i).co_product)?.[0],
          txDescription: '',
          points: 0,
          idList: 0,
          price: 0,
          coCurrency: '',
          priceOpposite: 0,
          coCurrencyOpposite: '',
          stock: 0,
          typeStocks: undefined,
          productUnitList: undefined,
          idProductStructure: result.rows.item(i).id_product_structure,
          nuTax: result.rows.item(i).nu_tax
        });
      }
    }).catch(e => {
      this.productList = [];
      console.log("[ProductService] Error al buscar productos.");
      console.log(e);
    });
  }


  generarListIn(listaString: string[]) {
    let lista: string = "";
    for (var contador = 0; contador < listaString.length; contador++) {
      if (contador == listaString.length - 1) {
        lista += '"' + listaString[contador] + '"';
      } else {
        lista += '"' + listaString[contador] + '",';
      }
    }
    return lista;
  }

  formatNumber(input: number) {
    return this.currencyService.formatNumber(input);
  }

  switchPrices(product: ProductUtil) {
    //para el caso donde conversionByPriceList = false,
    //si la moneda del producto no es la que se debe mostrar primero, se intercambian.
    let tempPrice = product.price;
    let tempCurrency = product.coCurrency;
    product.price = product.priceOpposite ? product.priceOpposite : 0;
    product.coCurrency = product.coCurrencyOpposite;
    product.priceOpposite = tempPrice;
    product.coCurrencyOpposite = tempCurrency;

  }
}
