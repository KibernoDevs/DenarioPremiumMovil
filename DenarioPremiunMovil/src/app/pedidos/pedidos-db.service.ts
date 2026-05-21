import { inject, Injectable } from '@angular/core';
import { PriceList } from '../modelos/tables/priceList';
import { OrderType } from '../modelos/tables/orderType';
import { AddresClient } from '../modelos/tables/addresClient';
import { List } from '../modelos/tables/list';
import { UnitInfo } from '../modelos/unitInfo';
import { Product } from '../modelos/tables/product';
import { IvaList } from '../modelos/tables/iva';
import { Discount } from '../modelos/tables/discount';
import { PaymentCondition } from '../modelos/tables/paymentCondition';
import { Warehouse } from '../modelos/tables/warehouse';
import { Stock } from '../modelos/tables/stock';
import { ProductStructure } from '../modelos/tables/productStructure';
import { Orders } from '../modelos/tables/orders';
import { ItemListaPedido } from './item-lista-pedido';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { OrderDetail } from '../modelos/tables/orderDetail';
import { OrderDetailUnit } from '../modelos/tables/orderDetailUnit';
import { OrderDetailDiscount } from '../modelos/orderDetailDiscount';
import { ProductUtil } from '../modelos/ProductUtil';
import { GlobalDiscount } from '../modelos/tables/globalDiscount';
import { OrderTypeProductStructure } from '../modelos/tables/orderTypeProductStructure';
import { ClientChannelOrderType } from '../modelos/tables/clientChannelOrderType';
import { DistributionChannel } from '../modelos/tables/distributionChannel';
import { ProductMinMulFav } from '../modelos/tables/productMinMul';
import { ClientAvgProduct } from '../modelos/tables/clientAvgProduct';
import { Client } from '../modelos/tables/client';
import { HistoryTransaction } from '../services/historyTransaction/historyTransaction';
import { UnitPriceList } from '../modelos/tables/unitPriceList';

@Injectable({
  providedIn: 'root'
})



export class PedidosDbService {

  public historyTransaction = inject(HistoryTransaction);

  constructor() { }

  getPricelists(db: SQLiteObject, idEnterprise: number, idLists: number[]) {
    let query = "SELECT id_price_list as idPriceList, co_price_list as coPriceList, id_product as idProduct," +
      "id_list as idList, nu_measure_unit_price as nuMeasureUnitPrice, nu_price as nuPrice, co_currency as coCurrency, " +
      "id_currency as idCurrency, co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
      "FROM price_lists WHERE id_enterprise = ? AND id_list IN (" + idLists.join(",") + ")";

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: PriceList[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    })
  }

  getOrderTypes(db: SQLiteObject, coEnterprise: string) {
    let query = "SELECT id_order_type as idOrderType, co_order_type as coOrderType, na_order_type as naOrderType, " +
      "default_value as defaultValue, co_enterprise as coEnterprise, id_enterprise as idEnterprise, " +
      "items_limit as itemsLimit, qu_items as quItems " +
      "from order_types where co_enterprise = ? order by default_value DESC";

    return db.executeSql(query, [coEnterprise]).then(data => {
      let list: OrderType[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        const row = data.rows.item(i) as OrderType;
        row.defaultValue = !!row.defaultValue;
        row.itemsLimit = !!row.itemsLimit;
        row.quItems = Number(row.quItems ?? 0);
        list.push(row);
      }
      return list;
    })
  }
  /*
    getClient(db: SQLiteObject, idClient: number, idEnterprise: number) {
      let selectStatement = 'SELECT co_client as coClient, co_currency as coCurrency, co_enterprise as coEnterprise,'
        + 'co_payment_condition as coPaymentCondition,id_channel as idChannel,id_client as idClient,id_currency as idCurrency,'
        + 'id_enterprise as idEnterprise,id_head_quarter as idHeadQuarter,id_list as idList,id_payment_condition as idPaymentCondition,'
        + 'id_warehouse as idWarehouse,in_suspension as inSuspension,lb_client as lbClient,multimoneda, na_email as naEmail,'
        + 'na_web_site as naWebSite,nu_credit_limit as nuCreditLimit,nu_rif as nuRif,qu_discount as quDiscount'
        + ' FROM clients  WHERE id_client = ? and id_enterprise = ?';
      return db.executeSql(selectStatement, [idClient, idEnterprise]).then(data => {
        return data.rows.item(0);
      })
    }
    */

  getClient(db: SQLiteObject, idClient: number, multiCurrency: boolean) {
    if (multiCurrency) {

      var selectStatement = 'SELECT c.co_client as coClient, c.co_currency as coCurrency, c.co_enterprise as coEnterprise,' +
        'c.co_payment_condition as coPaymentCondition,c.id_channel as idChannel,c.id_client as idClient,c.id_currency as idCurrency,' +
        'c.id_enterprise as idEnterprise,c.id_head_quarter as idHeadQuarter,c.id_list as idList,c.id_payment_condition as idPaymentCondition,' +
        'c.id_warehouse as idWarehouse,c.in_suspension as inSuspension,c.lb_client as lbClient,c.multimoneda, c.na_email as naEmail, c.nu_credit_limit as nuCreditLimit, ' +
        '(SELECT na_responsible FROM address_clients WHERE id_client = ? LIMIT 1 ) na_responsible, ' +
        '(SELECT na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1 ) na_price_list,(SELECT nu_phone FROM address_clients WHERE id_client = ? LIMIT 1 ) nuPhone, ' +
        '(SELECT tx_address FROM address_clients WHERE id_client = ? LIMIT 1 ) tx_address, ' +
        '(SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1 ) channel, ' +
        '(SELECT SUM(ds.nu_balance) from document_sales ds WHERE ds.id_client=? AND ds.co_currency = c.co_currency) saldo1,' +
        '(SELECT SUM(ds.nu_balance) from document_sales ds WHERE ds.id_client=?  AND ds.co_currency != c.co_currency) saldo2,' +
        '(SELECT co_currency FROM document_sales ds WHERE ds.id_client=?) coCurrency,' +
        '(SELECT coordenada FROM address_clients ac WHERE ac.id_client=c.id_client) coordenada, ' +
        '(SELECT editable FROM address_clients ac WHERE ac.id_client=c.id_client) editable, ' +
        '(SELECT id_address FROM address_clients ac WHERE ac.id_client=c.id_client) idAddressClients, ' +
        '(SELECT co_address FROM address_clients ac WHERE ac.id_client=c.id_client) coAddressClients, ' +
        '(SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1 ) lbl_enterprise  FROM clients c WHERE id_client = ?';


      return db.executeSql(selectStatement, [idClient, idClient, idClient, idClient, idClient, idClient, idClient]).then(data => {
        data.rows.item(0).saldo1 = data.rows.item(0).saldo1 == null ? 0 : data.rows.item(0).saldo1;
        data.rows.item(0).saldo2 = data.rows.item(0).saldo2 == null ? 0 : data.rows.item(0).saldo2;

        return data.rows.item(0) as Client;
      })

    } else {
      var selectStatement = 'SELECT c.co_client as coClient, c.co_currency as coCurrency, c.co_enterprise as coEnterprise,' +
        'c.co_payment_condition as coPaymentCondition,c.id_channel as idChannel,c.id_client as idClient,c.id_currency as idCurrency,' +
        'c.id_enterprise as idEnterprise,c.id_head_quarter as idHeadQuarter,c.id_list as idList,c.id_payment_condition as idPaymentCondition,' +
        'c.id_warehouse as idWarehouse,c.in_suspension as inSuspension,c.lb_client as lbClient,c.multimoneda, c.na_email as naEmail, c.nu_credit_limit as nuCreditLimit, ' +
        '(SELECT na_responsible FROM address_clients WHERE id_client = ? LIMIT 1 ) na_responsible, ' +
        '(SELECT na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1 ) na_price_list,(SELECT nu_phone FROM address_clients WHERE id_client = ? LIMIT 1 ) nuPhone, ' +
        '(SELECT tx_address FROM address_clients WHERE id_client = ? LIMIT 1 ) tx_address, ' +
        '(SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1 ) channel, ' +
        '(SELECT SUM(ds.nu_balance) from document_sales ds WHERE ds.id_client=?) saldo,' +
        '(SELECT co_currency FROM document_sales ds WHERE ds.id_client=?) coCurrency,' +
        '(SELECT coordenada FROM address_clients ac WHERE ac.id_client=c.id_client) coordenada, ' +
        '(SELECT editable FROM address_clients ac WHERE ac.id_client=c.id_client) editable, ' +
        '(SELECT id_address FROM address_clients ac WHERE ac.id_client=c.id_client) idAddressClients, ' +
        '(SELECT co_address FROM address_clients ac WHERE ac.id_client=c.id_client) coAddressClients, ' +
        '(SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1 ) lbl_enterprise  FROM clients c WHERE id_client = ?';
      console.log("en query: getClientById");
      return db.executeSql(selectStatement, [idClient, idClient, idClient, idClient, idClient, idClient]).then(data => {

        return data.rows.item(0) as Client;
      })
    }
  }

  getAddressClient(db: SQLiteObject, idClient: number) {
    let query = "SELECT * FROM address_clients where id_client = ?";

    return db.executeSql(query, [idClient]).then(data => {
      let list: AddresClient[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i)
        let address: AddresClient = {
          idAddress: item.id_address,
          coAddress: item.co_address,
          naAddress: item.na_address,
          idClient: item.id_client,
          idAddressType: item.id_address_type,
          coAddressType: item.co_address_type,
          txAddress: item.tx_address,
          nuPhone: item.nu_phone,
          naResponsible: item.na_responsible,
          coEnterpriseStructure: item.co_enterprise_structure,
          idEnterpriseStructure: item.id_enterprise_structure,
          coClient: item.co_client,
          coEnterprise: item.co_enterprise,
          idEnterprise: item.id_enterprise,
          coordenada: item.coordenada,
          editable: item.editable,
        }
        list.push(address);
      }
      return list;
    })
  }

  getLists(db: SQLiteObject, idEnterprise: number) {
    //este trae todas las listas que se usan realmente en los pedidos.
    let query = "SELECT * from lists where id_enterprise = ? and show_only = 'false'"
    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: List[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i)
        list.push({
          idList: item.id_list,
          coList: item.co_list,
          naList: item.na_list,
          idEnterprise: item.id_enterprise,
          coEnterprise: item.co_enterprise,
          showOnly: item.show_only
        });
      }
      return list;
    })
  }


  getListForInfoModal(db: SQLiteObject, idEnterprise: number) {
    //este trae listsas que se muestran en el modal. Solo las que tienen show_only = true
        let query = "SELECT * from lists where id_enterprise = ? and show_only = 'true'"
    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: List[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i)
        list.push({
          idList: item.id_list,
          coList: item.co_list,
          naList: item.na_list,
          idEnterprise: item.id_enterprise,
          coEnterprise: item.co_enterprise,
          showOnly: item.show_only
        });
      }
      return list;
    })
  }

  getPriceListbyEnterprise(db: SQLiteObject, idEnterprise: number) {
    let query = "SELECT id_price_list as idPriceList, co_price_list as coPriceList, id_product as idProduct, " +
      "id_list as idList, nu_measure_unit_price as nuMeasureUnitPrice, nu_price as nuPrice, " +
      "co_currency as coCurrency, id_currency as idCurrency, " +
      "co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
      "from price_lists where id_enterprise = ?"

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: PriceList[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    })

  }

  getUnitInfo(db: SQLiteObject, idEnterprise: number) {
    let query = "SELECT pu.co_unit as coUnit, u.na_unit as naUnit, pu.id_unit as idUnit, " +
      "pu.co_enterprise as coEnterprise, pu.id_enterprise as idEnterprise, " +
      "pu.id_product_unit as idProductUnit, pu.co_product_unit as coProductUnit, " +
      "pu.id_product as idProduct, pu.co_product as coProduct, pu.qu_unit as quUnit, 0 as quAmount " +
      "from product_units pu JOIN units u where pu.id_unit = u.id_unit and pu.id_enterprise = ?";

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: UnitInfo[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    })

  }

  getPriceListbyCurrency(db: SQLiteObject, idEnterprise: number, idCurrency: number) {
    let query = "SELECT id_price_list as idPriceList, co_price_list as coPriceList, id_product as idProduct, " +
      "id_list as idList, nu_measure_unit_price as nuMeasureUnitPrice, nu_price as nuPrice, " +
      "co_currency as coCurrency, id_currency as idCurrency, " +
      "co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
      "from price_lists where id_enterprise = ? AND id_currency = ?"

    return db.executeSql(query, [idEnterprise, idCurrency]).then(data => {
      let list: PriceList[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    })

  }

  getProducts(db: SQLiteObject, idEnterprise: number) {
    let query = "select id_product as idProduct, co_product as coProduct, na_product as naProduct, " +
      "co_primary_unit as coPrimaryUnit, co_product_structure as coProductStructure, " +
      "id_product_structure as idProductStructure, tx_dimension as txDimension, " +
      "tx_packing as txPacking, points, nu_priority as nuPriority, featured_product as featuredProduct, " +
      "tx_description as txDescription, co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
      "from products where id_enterprise = ? ";

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: Product[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    });

  }

  getIVAList(db: SQLiteObject) {
    let query = "SELECT id_iva_list as idIvaList, price_iva as priceIva, " +
      "tx_description as txDescripcion, default_iva as defaultIVA " +
      "FROM iva_lists ORDER by default_iva desc"

    return db.executeSql(query, []).then(data => {
      let list: IvaList[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    });
  }

  getDiscounts(db: SQLiteObject, idEnterprise: number) {
    let query = "SELECT id_discount as idDiscount, id_price_list as idPriceList, qu_discount as quDiscount, " +
      "co_list as coList, id_list as idList, co_product as coProduct, id_product as idProduct, " +
      "co_unit as coUnit, id_unit as idUnit, qu_vol_ini as quVolIni, qu_vol_fin as quVolFin, " +
      "nu_priority as nuPriority, co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
      "FROM discounts where id_enterprise = ? "

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: Discount[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    });

  }

  getPaymentConditions(db: SQLiteObject, idEnterprise: number) {
    let query = "SELECT id_payment_condition as idPaymentCondition, co_payment_condition as coPaymentCondition, " +
      "na_payment_condition as naPaymentCondition, co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
      "from payment_conditions where id_enterprise = ? " +
      "order by na_payment_condition ASC";

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: PaymentCondition[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    })
  }

  getWarehouses(db: SQLiteObject, idEnterprise: number) {
    let query = "SELECT id_warehouse as idWarehouse, co_warehouse as coWarehouse, na_warehouse as naWarehouse, " +
      " co_enterprise as coEnterprise, id_enterprise as idEnterprise" +
      " FROM warehouses w WHERE w.id_enterprise = ? " +
      " ORDER BY na_warehouse ASC"

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: Warehouse[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    })
  }

  getStocks(db: SQLiteObject, idEnterprise: number) {
    let query = "SELECT * from stocks where id_enterprise = ?"

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: Stock[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i);
        let stock: Stock = {
          idStock: item.id_stock,
          idProduct: item.id_product,
          coProduct: item.co_product,
          quStock: item.qu_stock,
          idWarehouse: item.id_warehouse,
          coWarehouse: item.co_warehouse,
          daUpdateStock: item.da_update_stock,
          coEnterprise: item.co_enterprise,
          idEnterprise: item.id_enterprise,
          coUnit: item.co_unit
        }
        list.push(stock);
      }
      return list;
    })
  }

  getProductStructures(db: SQLiteObject, idEnterprise: number) {
    let query = "select id_product_structure as idProductStructure, type, co_product_structure as coProductStructure, " +
      "na_product_structure as naProductStructure, id_type_product_structure as idTypeProductStructure, " +
      "co_type_product_structure as coTypeProductStructure, sco_product_structure as scoProductStructure, " +
      "sna_product_structure as snaProductStructure, co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
      " from product_structures where id_enterprise = ? "

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: ProductStructure[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    })
  }

  saveOrder(db: SQLiteObject, order: Orders) {
    let orderQuery = "INSERT OR REPLACE INTO orders (id_order, co_order, co_client, id_client, da_order, da_created, na_responsible, " +
      "id_user, id_order_creator, in_order_review, nu_amount_total, nu_amount_final, co_currency, " +
      "da_dispatch, tx_comment, nu_purchase, co_enterprise, co_user, co_payment_condition, " +
      "id_payment_condition, id_enterprise, co_address_client, id_address_client, nu_amount_discount, " +
      "nu_amount_total_base, st_order, coordenada, nu_discount, id_currency, id_currency_conversion, " +
      "nu_value_local, nu_amount_total_conversion, nu_amount_final_conversion, procedencia, " +
      "nu_amount_total_base_conversion, nu_amount_discount_conversion, id_order_type, nu_attachments, has_attachments, " +
      "nu_details, nu_amount_total_product_discount, nu_amount_total_product_discount_conversion, id_distribution_channel, co_distribution_channel, " +
      "st_delivery, id_client_stock, co_client_stock) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    let detailQuery = "INSERT OR REPLACE INTO order_details (id_order_detail, co_order_detail, co_order, co_product, na_product, " +
      "id_product, nu_price_base, nu_amount_total, co_warehouse, id_warehouse, qu_suggested, co_enterprise, id_enterprise, " +
      "iva, nu_discount_total, co_discount, id_discount, co_price_list, id_price_list, posicion, nu_price_base_conversion, " +
      "nu_discount_total_conversion, nu_amount_total_conversion) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    let unitQuery = "INSERT OR REPLACE INTO order_detail_units ( id_order_detail_unit, co_order_detail_unit, co_order_detail, " +
      "co_product_unit, id_product_unit, qu_order, co_enterprise, id_enterprise, co_unit, qu_suggested ) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?)";

    let dcQuery = "INSERT OR REPLACE INTO order_detail_discount ( id_order_detail_discount, co_order_detail_discount, " +
      "co_order_detail, id_order_detail, id_discount, qu_discount, nu_price_final, co_enterprise, id_enterprise ) " +
      "VALUES (?,?,?,?,?,?,?,?,?)";

    let queries: any[] = []//(string | (string | number | boolean)[])[] = [];

    //query de order
    queries.push([orderQuery, [order.idOrder, order.coOrder, order.coClient, order.idClient, order.daOrder, order.daCreated, order.naResponsible,
    order.idUser, order.idOrderCreator, order.inOrderReview, order.nuAmountTotal, order.nuAmountFinal, order.coCurrency,
    order.daDispatch, order.txComment, order.nuPurchase, order.coEnterprise, order.coUser, order.coPaymentCondition,
    order.idPaymentCondition, order.idEnterprise, order.coAddress, order.idAddress, order.nuAmountDiscount,
    order.nuAmountTotalBase, order.stOrder, order.coordenada, order.nuDiscount, order.idCurrency, order.idCurrencyConversion,
    order.nuValueLocal, order.nuAmountTotalConversion, order.nuAmountFinalConversion, order.procedencia, order.nuAmountTotalBaseConversion,
    order.nuAmountDiscountConversion, order.idOrderType, order.nuAttachments, order.hasAttachments, order.nuDetails,
    order.nuAmountTotalProductDiscount, order.nuAmountTotalProductDiscountConversion, order.idDistributionChannel, order.coDistributionChannel, order.stDelivery,
    order.idClientStock ?? null, order.coClientStock ?? null]]);

    for (let i = 0; i < order.orderDetails.length; i++) {
      const item = order.orderDetails[i];
      //query de detail
      queries.push([detailQuery, [item.idOrderDetail, item.coOrderDetail, item.coOrder, item.coProduct, item.naProduct, item.idProduct, item.nuPriceBase,
      item.nuAmountTotal, item.coWarehouse, item.idWarehouse, item.quSuggested, item.coEnterprise, item.idEnterprise, item.iva,
      item.nuDiscountTotal, item.coDiscount, item.idDiscount, item.coPriceList, item.idPriceList, item.posicion,
      item.nuPriceBaseConversion, item.nuDiscountTotalConversion, item.nuAmountTotalConversion,]]);

      //query de discount
      if (item.orderDetailDiscount && item.orderDetailDiscount[0].quDiscount != null) {
        queries.push([dcQuery, [item.orderDetailDiscount[0].idOrderDetailDiscount, item.orderDetailDiscount[0].coOrderDetailDiscount, item.orderDetailDiscount[0].coOrderDetail, item.orderDetailDiscount[0].idOrderDetail,
        item.orderDetailDiscount[0].idDiscount, item.orderDetailDiscount[0].quDiscount, item.orderDetailDiscount[0].nuPriceFinal,
        item.orderDetailDiscount[0].coEnterprise, item.orderDetailDiscount[0].idEnterprise,]]);
      }


      for (let j = 0; j < item.orderDetailUnit.length; j++) {
        const unit = item.orderDetailUnit[j];
        if (unit.quOrder <= 0) {
          continue;
        }
        //query de unidad
        queries.push([unitQuery, [unit.idOrderDetailUnit, unit.coOrderDetailUnit, unit.coOrderDetail, unit.coProductUnit,
        unit.idProductUnit, unit.quOrder, unit.coEnterprise, unit.idEnterprise, unit.coUnit, unit.quSuggested,]]);

      }

    }

    return db.sqlBatch(queries).catch(error => {
      console.error("Error saving order batch: ", error);
     });

  }

  saveOrderBatch(db: SQLiteObject, orders: Orders[]) {
    let orderQuery = "INSERT OR REPLACE INTO orders (id_order, co_order, co_client, id_client, da_order, da_created, na_responsible, " +
      "id_user, id_order_creator, in_order_review, nu_amount_total, nu_amount_final, co_currency, " +
      "da_dispatch, tx_comment, nu_purchase, co_enterprise, co_user, co_payment_condition, " +
      "id_payment_condition, id_enterprise, co_address_client, id_address_client, nu_amount_discount, " +
      "nu_amount_total_base, st_order, coordenada, nu_discount, id_currency, id_currency_conversion, " +
      "nu_value_local, nu_amount_total_conversion, nu_amount_final_conversion, procedencia, " +
      "nu_amount_total_base_conversion, nu_amount_discount_conversion, id_order_type, nu_attachments, has_attachments, " +
      "nu_details, nu_amount_total_product_discount, nu_amount_total_product_discount_conversion, id_distribution_channel, co_distribution_channel, " +
      "st_delivery, id_client_stock, co_client_stock) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    let queries: any[] = []//(string | (string | number | boolean)[])[] = [];

    for (let o = 0; o < orders.length; o++) {
      const order = orders[o];
      //query de order
      queries.push([orderQuery, [order.idOrder, order.coOrder, order.coClient, order.idClient, order.daOrder, order.daCreated, order.naResponsible,
      order.idUser, order.idOrderCreator, order.inOrderReview, order.nuAmountTotal, order.nuAmountFinal, order.coCurrency,
      order.daDispatch, order.txComment, order.nuPurchase, order.coEnterprise, order.coUser, order.coPaymentCondition,
      order.idPaymentCondition, order.idEnterprise, order.coAddress, order.idAddress, order.nuAmountDiscount,
      order.nuAmountTotalBase, order.stOrder, order.coordenada, order.nuDiscount, order.idCurrency, order.idCurrencyConversion,
      order.nuValueLocal, order.nuAmountTotalConversion, order.nuAmountFinalConversion, order.procedencia, order.nuAmountTotalBaseConversion,
      order.nuAmountDiscountConversion, order.idOrderType, order.nuAttachments, order.hasAttachments, order.nuDetails,
      order.nuAmountTotalProductDiscount, order.nuAmountTotalProductDiscountConversion, order.idDistributionChannel, order.coDistributionChannel, order.stDelivery,
      order.idClientStock ?? null, order.coClientStock ?? null]]);
    }
    return db.sqlBatch(queries).then(() => { }).catch(error => { });
  }

  saveOrderDetailBatch(db: SQLiteObject, orderDetails: OrderDetail[]) {
    let detailQuery = "INSERT OR REPLACE INTO order_details (id_order_detail, co_order_detail, co_order, co_product, na_product, " +
      "id_product, nu_price_base, nu_amount_total, co_warehouse, id_warehouse, qu_suggested, co_enterprise, id_enterprise, " +
      "iva, nu_discount_total, co_discount, id_discount, co_price_list, id_price_list, posicion, nu_price_base_conversion, " +
      "nu_discount_total_conversion, nu_amount_total_conversion) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    let queries: any[] = []//(string | (string | number | boolean)[])[] = [];

    for (let o = 0; o < orderDetails.length; o++) {
      const orderDetail = orderDetails[o];
      queries.push([detailQuery, [orderDetail.idOrderDetail, orderDetail.coOrderDetail, orderDetail.coOrder, orderDetail.coProduct, orderDetail.naProduct,
      orderDetail.idProduct, orderDetail.nuPriceBase, orderDetail.nuAmountTotal, orderDetail.coWarehouse, orderDetail.idWarehouse, orderDetail.quSuggested,
      orderDetail.coEnterprise, orderDetail.idEnterprise, orderDetail.iva, orderDetail.nuDiscountTotal, orderDetail.coDiscount, orderDetail.idDiscount,
      orderDetail.coPriceList, orderDetail.idPriceList, orderDetail.posicion, orderDetail.nuPriceBaseConversion, orderDetail.nuDiscountTotalConversion,
      orderDetail.nuAmountTotalConversion]]);
    }

    return db.sqlBatch(queries).then(() => { }).catch(error => { });
  }

  saveOrderDetailUnitBatch(db: SQLiteObject, orderDetailUnits: OrderDetailUnit[]) {
    let unitQuery = "INSERT OR REPLACE INTO order_detail_units ( id_order_detail_unit, co_order_detail_unit, co_order_detail, " +
      "co_product_unit, id_product_unit, qu_order, co_enterprise, id_enterprise, co_unit, qu_suggested ) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?)";
    let queries: any[] = []//(string | (string | number | boolean)[])[] = [];

    for (let o = 0; o < orderDetailUnits.length; o++) {
      const orderDetailUnit = orderDetailUnits[o];
      queries.push([unitQuery, [orderDetailUnit.idOrderDetailUnit, orderDetailUnit.coOrderDetailUnit, orderDetailUnit.coOrderDetail,
      orderDetailUnit.coProductUnit, orderDetailUnit.idProductUnit, orderDetailUnit.quOrder, orderDetailUnit.coEnterprise,
      orderDetailUnit.idEnterprise, orderDetailUnit.coUnit, orderDetailUnit.quSuggested]]);
    }

    return db.sqlBatch(queries).then(() => { }).catch(error => { });
  }

  saveOrderDetailDiscountBatch(db: SQLiteObject, orderDetailDiscounts: OrderDetailDiscount[]) {
    let dcQuery = "INSERT OR REPLACE INTO order_detail_discount ( id_order_detail_discount, co_order_detail_discount, " +
      "co_order_detail, id_order_detail, id_discount, qu_discount, nu_price_final, co_enterprise, id_enterprise ) " +
      "VALUES (?,?,?,?,?,?,?,?,?)";
    let queries: any[] = []//(string | (string | number | boolean)[])[] = [];

    for (let o = 0; o < orderDetailDiscounts.length; o++) {
      const orderDetailDiscount = orderDetailDiscounts[o];
      queries.push([dcQuery, [orderDetailDiscount.idOrderDetailDiscount, orderDetailDiscount.coOrderDetailDiscount,
      orderDetailDiscount.coOrderDetail, orderDetailDiscount.idOrderDetail, orderDetailDiscount.idDiscount,
      orderDetailDiscount.quDiscount, orderDetailDiscount.nuPriceFinal, orderDetailDiscount.coEnterprise,
      orderDetailDiscount.idEnterprise]]);
    }

    return db.sqlBatch(queries).then(() => { }).catch(error => { });
  }

  getPedido(db: SQLiteObject, coOrder: string) {
    //busca todos los documentos relacionados con el coOrder y los devuelve como un Orders
    //para Copiar/Ver

    let order: Orders;
    let orderDetails: OrderDetail[] = [];
    let orderUnits: OrderDetailUnit[] = [];
    let orderDetailDiscounts: OrderDetailDiscount[] = [];

    let queryOrder = "SELECT * FROM orders WHERE co_order = ?";

    let queryDetails = "SELECT * FROM order_details WHERE co_order = ? ";

    // para estos 2 debo usar un hack asqueroso donde agrego los coOrderDetail directo al query como strings.
    let queryUnits = "SELECT * FROM order_detail_units WHERE co_order_detail in (";

    let queryDiscounts = "SELECT * FROM order_detail_discount WHERE co_order_detail in ( ";


    return db.executeSql(queryOrder, [coOrder]).then(dataHeader => {
      if (dataHeader.rows.length > 1) {
        console.error("ERROR: getPedido. Se obtuvo mas de un pedido");
      }
      if (dataHeader.rows.length == 0) {
        console.error("ERROR: getPedido. No se obtuvo pedido");
        return null;
      }
      order = this.orderDBtoOrders(dataHeader.rows.item(0));
      return db.executeSql(queryDetails, [coOrder]).then(dataDetails => {
        if (dataDetails.rows.length == 0) {
          console.error("ERROR: getPedido. No se obtuvieron detalles");
          return null;
        }

        let coOrderDetails: string = "'";
        for (let i = 0; i < dataDetails.rows.length; i++) {
          let item = this.detailsDBtoOrderDetail(dataDetails.rows.item(i));
          orderDetails.push(item);
          coOrderDetails = coOrderDetails + item.coOrderDetail;
          if (i < dataDetails.rows.length - 1) {
            coOrderDetails = coOrderDetails + "', '";
          }
        }
        coOrderDetails = coOrderDetails + "')";
        order.orderDetails = orderDetails;


        return db.executeSql(queryUnits + coOrderDetails, []).then(dataUnits => {
          if (dataUnits.rows.length == 0) {
            console.error("ERROR: getPedido. No se obtuvieron unidades");
            return null;
          }
          for (let i = 0; i < dataUnits.rows.length; i++) {
            let item = this.unitDBtoOrderDetailUnit(dataUnits.rows.item(i));
            orderUnits.push(item);
            let detail = orderDetails.find(x => x.coOrderDetail == item.coOrderDetail);
            if (detail) {
              if (detail.orderDetailUnit) { }
              else { detail.orderDetailUnit = [] }
              detail.orderDetailUnit.push(item);
            }
          }

          return db.executeSql(queryDiscounts + coOrderDetails, []).then(dataDiscount => {

            //No hay descuento? no hay problema.
            for (let i = 0; i < dataDiscount.rows.length; i++) {
              let item = this.discountDBtoOrderDetailDiscount(dataDiscount.rows.item(i));
              orderDetailDiscounts.push(item);
              let detail = orderDetails.find(x => x.coOrderDetail == item.coOrderDetail);
              if (detail) {
                if (detail.orderDetailDiscount) { }
                else { detail.orderDetailDiscount = [] }
                detail.orderDetailDiscount.push(item);
              }
            }



            console.log(order);
            return order;

          }).catch(error => {
            console.error("ERROR: getPedido. Error al obtener descuentos: ", error)
          });
        });
      })


    });


  }

  getListaPedidos(db: SQLiteObject) {
    // obtiene la lista de pedidos para mostrarlos en pedidos-lista (para copiar o ver);
    let query = "SELECT id_order, co_order, orders.co_client as co_client, clients.lb_client as lb_client, st_order, st_delivery, da_order " +
      "FROM orders JOIN clients ON orders.id_client = clients.id_client " +
      "ORDER BY st_delivery DESC, da_order DESC";

    return db.executeSql(query, []).then(async data => {
      let orders: ItemListaPedido[] = [];
      let promises: Promise<void>[] = [];

      for (let i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i);
        // Creamos una promesa para cada pedido
        let p = this.historyTransaction.getStatusTransaction(db, 2, item.id_order).then(status => {
          item.na_status = status;
          orders.push(item);
        });
        promises.push(p);
      }

      // Espera a que todas las promesas terminen
      await Promise.all(promises);
      return orders;
    });
  }

  getProductsbyIdProduct(db: SQLiteObject, idProducts: number[], idList: number, coCurrency: string, idEnterprise: number, conversionByPriceList: boolean) {

    if (conversionByPriceList) {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, " +
        " (select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = " + idList + " order by l.na_list limit 1) as id_list, " +
        //" (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + idList + " order by l.na_list limit 1) as nu_price, " +
        //" (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + idList + " order by l.na_list limit 1) as co_currency, " +
        //" (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + idList + " order by l.na_list limit 1) as nu_price_opposite, " +
        //" (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_list = " + idList + " order by l.na_list limit 1) as co_currency_opposite, " +
        " (select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, p.id_enterprise, p.co_enterprise FROM products p " +
        "WHERE p.id_product in ( " + idProducts.toString() + " ) AND p.id_enterprise = ? ORDER BY p.na_product ASC;"
    }
    else {
      var select = 'select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, ' +
        '(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = ' + idList + ' order by l.na_list limit 1) as id_list, ' +
        //'(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = ' + idList + '  order by l.na_list limit 1) as nu_price, ' +
        //'(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_list = ' + idList + '  order by l.na_list limit 1) as co_currency, ' +
        '(select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, ' +
        'p.id_enterprise, p.co_enterprise FROM products p WHERE p.id_product in ( ' + idProducts.toString() + ' ) AND p.id_enterprise = ? ORDER BY p.na_product ASC'
    }
    return db.executeSql(select, [idEnterprise]);

  }

  getProductsbyIdProductAndPricelists(db: SQLiteObject, idProducts: number[], idPriceLists: number[], coCurrency: string, idEnterprise: number, conversionByPriceList: boolean) {

    if (conversionByPriceList) {
      var select = "select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, " +
        " (select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_price_list in (" + idPriceLists + ") order by l.na_list limit 1) as id_list, " +
        //" (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_price_list in (" + idPriceLists + ") order by l.na_list limit 1) as nu_price, " +
        //" (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency = '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_price_list in (" + idPriceLists + ") order by l.na_list limit 1) as co_currency, " +
        //" (select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_price_list in (" + idPriceLists + ") order by l.na_list limit 1) as nu_price_opposite, " +
        //" (select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.co_currency != '" + coCurrency + "' and pl.id_product = p.id_product and pl.id_price_list in (" + idPriceLists + ") order by l.na_list limit 1) as co_currency_opposite, " +
        " (select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, p.id_enterprise, p.co_enterprise FROM products p " +
        "WHERE p.id_product in ( " + idProducts.toString() + " ) AND p.id_enterprise = ? ORDER BY p.na_product ASC;"
    }
    else {
      var select = 'select p.id_product, p.co_product, p.na_product, p.points, p.tx_description, ' +
        '(select pl.id_list from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_price_list in (' + idPriceLists + ') order by l.na_list limit 1) as id_list, ' +
        //'(select pl.nu_price from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_price_list in (' + idPriceLists + ') order by l.na_list limit 1) as nu_price, ' +
        //'(select pl.co_currency from price_lists pl join lists l on pl.id_list = l.id_list where pl.id_product = p.id_product and pl.id_price_list in (' + idPriceLists + ') order by l.na_list limit 1) as co_currency, ' +
        '(select s.qu_stock from stocks s join warehouses w on s.id_warehouse = w.id_warehouse where s.id_product = p.id_product order by w.na_warehouse limit 1) as qu_stock, ' +
        'p.id_enterprise, p.co_enterprise FROM products p WHERE p.id_product in ( ' + idProducts.toString() + ' ) AND p.id_enterprise = ? ORDER BY p.na_product ASC'
    }
    return db.executeSql(select, [idEnterprise]);

  }

  deleteOrder(db: SQLiteObject, coOrder: String) {
    //borra el pedido y todos sus documentos relacionados

    let queryOrder = 'DELETE FROM orders WHERE co_order = ?';
    let queryDetail = 'DELETE FROM order_details WHERE co_order = ?';

    let queryUnits = 'DELETE from order_detail_units where co_order_detail in ';
    let queryDiscounts = 'DELETE from order_detail_discount where co_order_detail in '
    let subquery = '(select co_order_detail from order_details where co_order = ?)';

    let queryPhotos = "DELETE FROM transaction_images WHERE na_transaction = 'order' AND  co_transaction = ?";
    let queryFiles = "DELETE FROM transaction_files WHERE na_transaction =  'order' AND  co_transaction = ?";
    let querySignatures = "DELETE FROM transaction_signatures WHERE na_transaction =  'order' AND  co_transaction = ?";

    //los de unit y discount necesitan que existan los detail, asi que se borran antes de los demas.
    return db.sqlBatch([
      [queryUnits + subquery, [coOrder]],
      [queryDiscounts + subquery, [coOrder]]
    ]).then(() => {
      return db.sqlBatch([
        [queryOrder, [coOrder]],
        [queryDetail, [coOrder]],
        [queryPhotos, [coOrder]],
        [queryFiles, [coOrder]],
        [querySignatures, [coOrder]]
      ])
    })
  }

  getGlobalDiscounts(db: SQLiteObject, noDiscount: string) {
    let query = "SELECT id_global_discount as idGlobalDiscount, global_discount as globalDiscount, " +
      "tx_description as txDescription, default_global_discount as defaultGlobalDiscount " +
      "from global_discounts"

    return db.executeSql(query, []).then(data => {
      let list: GlobalDiscount[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      //descuento por defecto de 0%
      const noDC = {
        idGlobalDiscount: 0,
        globalDiscount: 0,
        txDescription: noDiscount,
        defaultGlobalDiscount: true
      };
      list.unshift(noDC);
      return list;
    });
  }

  getOrderTypeProductStructure(db: SQLiteObject, idEnterprise: number) {
    //busca la relacion OrderType-ProductStructure, para usar en userCanSelectChannel;
    let query = "select id_order_type_product_structure as idOrderTypeProductStructure, " +
      "co_order_type_product_structure as coOrderTypeProductStructure, id_order_type as idOrderType, " +
      "co_order_type as coOrderType, id_product_structure as idProductStructure, " +
      "co_product_structure as coProductStructure, id_enterprise as idEnterprise, co_enterprise as coEnterprise " +
      "FROM order_type_product_structure WHERE id_enterprise = ?";
    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: OrderTypeProductStructure[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    });
  }

  getClientChannelOrderTypes(db: SQLiteObject, idClient: number, idEnterprise: number) {
    let query = "select id_client_channel_order_type as idClientChannelOrderType, " +
      "co_client_channel_order_type as coClientChannelOrderType, id_client as idClient, " +
      "co_client as coClient, id_distribution_channel as idDistributionChannel, " +
      "co_distribution_channel as coDistributionChannel, id_order_type as idOrderType, " +
      "co_order_type as coOrderType, id_enterprise as idEnterprise, co_enterprise as coEnterprise " +
      "from client_channel_order_type where id_client = ? and id_enterprise = ? order by id_distribution_channel asc";
    return db.executeSql(query, [idClient, idEnterprise]).then(data => {
      let list: ClientChannelOrderType[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    });
  }

  getDistributionChannels(db: SQLiteObject, idEnterprise: number) {
    let query = "select id_channel as idChannel, co_channel as coChannel, na_channel as naChannel, " +
      "short_na_channel as shortNaChannel, co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
      "from distribution_channels where id_enterprise = ?";
    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: DistributionChannel[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    });
  }

  getProductMinMul(db: SQLiteObject, idEnterprise: number) {
    let query = "select id_product_min_mul as idProductMinMul, co_product as coProduct, " +
      "id_product as idProduct, qu_minimum as quMinimum, qu_multiple as quMultiple, " +
      "flag, co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
      "from product_min_muls where id_enterprise = ? and (qu_minimum > 1 OR qu_multiple > 1) and flag = 'true'";

    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: ProductMinMulFav[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    });
  }

  getClientAvgStock(db: SQLiteObject, idEnterprise: number, idClient: number, idProductUnit: number[],
    idAddressClient: number, idProduct: number[]) {
    let part1 = "SELECT id_client_avg_product as idClientAvgProduct, id_client as idClient, " +
      "co_client as coClient, id_address_client as idAddressClient, co_address_client as coAddressClient, " +
      "id_product as idProduct, co_product as coProduct, id_product_unit as idProductUnit, " +
      "co_product_unit as coProductUnit, average as average, co_enterprise as coEnterprise, " +
      "id_enterprise as idEnterprise FROM client_avg_products WHERE id_enterprise = ? AND id_client = ? " +
      "AND id_address_client = ? and id_product in (";
    let part2 = ")  AND id_product_unit in (";

    let query = part1 + idProduct.toString() + part2 + idProductUnit.toString() + ")";

    return db.executeSql(query, [idEnterprise, idClient, idAddressClient]).then(data => {
      let list: ClientAvgProduct[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        list.push(data.rows.item(i));
      }
      return list;
    });
  }

  getUnitPriceList(db: SQLiteObject, idEnterprise: number) {
    let query = "SELECT * from unit_pricelist where id_enterprise = ?";
    return db.executeSql(query, [idEnterprise]).then(data => {
      let list: UnitPriceList[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i);
        let upl: UnitPriceList = {
          idUnitPriceList: item.id_unit_price_list,
          coUnitPriceList: item.co_unit_price_list,
          idUnit: item.id_unit,
          coUnit: item.co_unit,
          idList: item.id_list,
          coList: item.co_list,
          idEnterprise: item.id_enterprise,
          coEnterprise: item.co_enterprise
        };
        list.push(upl);
      }
      return list;
    });
  }


  public orderDBtoOrders(orderDB: any): Orders {
    //convierte un objeto obtenido de la base de datos a un Orders
    //de esta manera es mas amigable agregar campos en el futuro
    let order: Orders = {
      idOrder: orderDB.id_order,
      coOrder: orderDB.co_order,
      coClient: orderDB.co_client,
      idClient: orderDB.id_client,
      daOrder: orderDB.da_order,
      daCreated: orderDB.da_created,
      naResponsible: orderDB.na_responsible,
      idUser: orderDB.id_user,
      idOrderCreator: orderDB.id_order_creator,
      inOrderReview: orderDB.in_order_review === 'true' ? true : false,
      nuAmountTotal: orderDB.nu_amount_total,
      nuAmountFinal: orderDB.nu_amount_final,
      coCurrency: orderDB.co_currency,
      daDispatch: orderDB.da_dispatch,
      txComment: orderDB.tx_comment,
      nuPurchase: orderDB.nu_purchase,
      coEnterprise: orderDB.co_enterprise,
      coUser: orderDB.co_user,
      coPaymentCondition: orderDB.co_payment_condition,
      idPaymentCondition: orderDB.id_payment_condition,
      idEnterprise: orderDB.id_enterprise,
      coAddress: orderDB.co_address_client,
      idAddress: orderDB.id_address_client,
      nuAmountDiscount: orderDB.nu_amount_discount,
      nuAmountTotalBase: orderDB.nu_amount_total_base,
      stOrder: orderDB.st_order,
      coordenada: orderDB.coordenada,
      nuDiscount: orderDB.nu_discount,
      idCurrency: orderDB.id_currency,
      idCurrencyConversion: orderDB.id_currency_conversion,
      nuValueLocal: orderDB.nu_value_local,
      nuAmountTotalConversion: orderDB.nu_amount_total_conversion,
      nuAmountFinalConversion: orderDB.nu_amount_final_conversion,
      procedencia: orderDB.procedencia,
      nuAmountTotalBaseConversion: orderDB.nu_amount_total_base_conversion,
      nuAmountDiscountConversion: orderDB.nu_amount_discount_conversion,
      idOrderType: orderDB.id_order_type,
      nuAttachments: orderDB.nu_attachments,
      hasAttachments: orderDB.has_attachments,
      nuDetails: orderDB.nu_details,
      nuAmountTotalProductDiscount: orderDB.nu_amount_total_product_discount,
      nuAmountTotalProductDiscountConversion: orderDB.nu_amount_total_product_discount_conversion,
      idDistributionChannel: orderDB.id_distribution_channel,
      coDistributionChannel: orderDB.co_distribution_channel,
      stDelivery: orderDB.st_delivery == null ? 1 : orderDB.st_delivery,
      idClientStock: orderDB.id_client_stock ?? null,
      coClientStock: orderDB.co_client_stock ?? null,
      orderDetails: []
    };
    return order;
  }

  public detailsDBtoOrderDetail(detailDB: any): OrderDetail {
    //convierte un objeto obtenido de la base de datos a un OrderDetail
    //de esta manera es mas amigable agregar campos en el futuro
    let detail: OrderDetail = {
      idOrderDetail: detailDB.id_order_detail,
      coOrderDetail: detailDB.co_order_detail,
      coOrder: detailDB.co_order,
      coProduct: detailDB.co_product,
      naProduct: detailDB.na_product,
      idProduct: detailDB.id_product,
      nuPriceBase: detailDB.nu_price_base,
      nuAmountTotal: detailDB.nu_amount_total,
      coWarehouse: detailDB.co_warehouse,
      idWarehouse: detailDB.id_warehouse,
      quSuggested: detailDB.qu_suggested,
      coEnterprise: detailDB.co_enterprise,
      idEnterprise: detailDB.id_enterprise,
      iva: detailDB.iva,
      nuDiscountTotal: detailDB.nu_discount_total,
      coDiscount: detailDB.co_discount,
      idDiscount: detailDB.id_discount,
      coPriceList: detailDB.co_price_list,
      idPriceList: detailDB.id_price_list,
      posicion: detailDB.posicion,
      nuPriceBaseConversion: detailDB.nu_price_base_conversion,
      nuDiscountTotalConversion: detailDB.nu_discount_total_conversion,
      nuAmountTotalConversion: detailDB.nu_amount_total_conversion,
      orderDetailUnit: [],
      orderDetailDiscount: []
    };
    return detail;
  }

  public unitDBtoOrderDetailUnit(unitDB: any): OrderDetailUnit {
    //convierte un objeto obtenido de la base de datos a un OrderDetailUnit
    //de esta manera es mas amigable agregar campos en el futuro
    let unit: OrderDetailUnit = {
      idOrderDetailUnit: unitDB.id_order_detail_unit,
      coOrderDetailUnit: unitDB.co_order_detail_unit,
      coOrderDetail: unitDB.co_order_detail,
      coProductUnit: unitDB.co_product_unit,
      idProductUnit: unitDB.id_product_unit,
      quOrder: unitDB.qu_order,
      coEnterprise: unitDB.co_enterprise,
      idEnterprise: unitDB.id_enterprise,
      coUnit: unitDB.co_unit,
      quSuggested: unitDB.qu_suggested

    };
    return unit;
  }

  public discountDBtoOrderDetailDiscount(discountDB: any): OrderDetailDiscount {
    //convierte un objeto obtenido de la base de datos a un OrderDetailDiscount
    //de esta manera es mas amigable agregar campos en el futuro
    let discount: OrderDetailDiscount = {
      idOrderDetailDiscount: discountDB.id_order_detail_discount,
      coOrderDetailDiscount: discountDB.co_order_detail_discount,
      coOrderDetail: discountDB.co_order_detail,
      idOrderDetail: discountDB.id_order_detail,
      idDiscount: discountDB.id_discount,
      quDiscount: discountDB.qu_discount,
      nuPriceFinal: discountDB.nu_price_final,
      coEnterprise: discountDB.co_enterprise,
      idEnterprise: discountDB.id_enterprise
    };
    return discount;
  }


}
