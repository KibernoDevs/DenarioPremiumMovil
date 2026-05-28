import { Injectable, inject } from '@angular/core';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { List } from 'src/app/modelos/tables/list';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { ProductPriceUtil } from 'src/app/modelos/ProductPriceUtil';
import { CurrencyService } from '../currency/currency.service';

@Injectable({
  providedIn: 'root'
})
export class PriceListService {

  dbServ = inject(SynchronizationDBService);
  globalConfig = inject(GlobalConfigService);
  currencyService = inject(CurrencyService);

  public productlists: List[] = [];
  productPrice!: ProductPriceUtil;

  constructor() { }

  getListByIdProduct(idProduct: number) {
    var database = this.dbServ.getDatabase();
    this.productlists = [];
    var select = "select l.* from lists l join price_lists pl on l.id_list = pl.id_list join products p on pl.id_product = p.id_product where p.id_product = ? group by l.id_list order by l.na_list"
    return database.executeSql(select, [idProduct]).then(result => {
      for (let i = 0; i < result.rows.length; i++) {
        this.productlists.push({
          idList: result.rows.item(i).id_list,
          coList: result.rows.item(i).co_list,
          naList: result.rows.item(i).na_list,
          idEnterprise: result.rows.item(i).id_enterprise,
          coEnterprise: result.rows.item(i).co_enterprise,
          showOnly: result.rows.item(i).show_only
        });
      }
    }
    ).catch(e => {
      this.productlists = [];
      console.log("[PriceListService] Error al cargar listas.");
      console.log(e);
    })
  }

  /* "(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.co_currency = ? order by l.na_list limit 1) as nu_price_default, " +
       "(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.co_currency = ? order by l.na_list limit 1) as co_currency_default, " +
       "(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.co_currency != ? order by l.na_list limit 1) as nu_price_opposite, " +
       "(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.co_currency != ? order by l.na_list limit 1) as co_currency_opposite, " +  */


  getPriceListByIdListAndIdProduct(idList: number, idProductQuery: number, coCurrency: string) {
    var database = this.dbServ.getDatabase();
    this.productPrice = new ProductPriceUtil(idProductQuery, 0, coCurrency, 0, coCurrency);
    const select = "SELECT (SELECT pl.nu_price FROM price_lists pl WHERE pl.id_list = ? AND pl.id_product = ?) AS nu_price_default, " +
      "(SELECT pl.co_currency FROM price_lists pl WHERE pl.id_list = ? AND pl.id_product = ?) AS co_currency;";

    return database.executeSql(select, [idList, idProductQuery, idList, idProductQuery]).then(data => {
      if (!data.rows.length) {
        return;
      }

      const priceDefault = data.rows.item(0).nu_price_default;
      const currencyDefault = data.rows.item(0).co_currency;

      this.productPrice = new ProductPriceUtil(
        idProductQuery,
        priceDefault, // Precio de la lista de precio
        currencyDefault, // moneda de la lista de precio
        this.currencyService.isLocalCurrency(currencyDefault) ?
          this.currencyService.toHardCurrency(priceDefault) :
          this.currencyService.toLocalCurrency(priceDefault), // Precio en la moneda opuesta a la lista de precio
        this.currencyService.oppositeCoCurrency(currencyDefault), // moneda opuesta a la lista de precio
      );
    }).catch(e => {
      console.log("[PriceListService] Error al cargar getPriceListByIdListAndIdProduct.");
      console.log(e);
    })
  }
}
