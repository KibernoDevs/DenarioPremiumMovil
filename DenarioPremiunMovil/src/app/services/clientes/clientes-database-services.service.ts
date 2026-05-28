import { Injectable, inject } from '@angular/core';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';

import { GlobalConfigService } from '../globalConfig/global-config.service';
import { DocumentSale } from '../../modelos/tables/documentSale';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { AddresClient } from 'src/app/modelos/tables/addresClient';
import { MAX_ITEMS_PER_PAGE } from 'src/app/utils/appConstants';
import { Client } from 'src/app/modelos/tables/client';
import { TextService } from '../text/text.service';

@Injectable({
  providedIn: 'root'
})
export class ClientesDatabaseServicesService {
  private globalConfig = inject(GlobalConfigService);
  public dbServ = inject(SynchronizationDBService);
  textService = inject(TextService);

  MAX_ITEMS_PER_PAGE = MAX_ITEMS_PER_PAGE; // cantidad de registros a traer por cada consulta a la base de datos (para evitar problemas de rendimiento)

  constructor() { }

  ClientBDtoClient(data: any): Client[] {
    let clients: Client[] = [];
    for (let i = 0; i < data.rows.length; i++) {
      clients.push({
        idClient: data.rows.item(i).id_client,
        coClient: data.rows.item(i).co_client,
        lbClient: data.rows.item(i).lb_client,
        naClient: data.rows.item(i).na_client,
        nuRif: data.rows.item(i).nu_rif,
        idChannel: data.rows.item(i).id_channel,
        idWarehouse: data.rows.item(i).id_warehouse,
        idHeadQuarter: 0,
        idList: data.rows.item(i).id_list,
        idPaymentCondition: data.rows.item(i).id_payment_condition,
        coPaymentCondition: data.rows.item(i).co_payment_condition,
        naPaymentCondition: data.rows.item(i).na_payment_condition,
        inSuspension: data.rows.item(i).in_suspension,
        quDiscount: data.rows.item(i).qu_discount,
        naEmail: data.rows.item(i).na_email,
        nuCreditLimit: data.rows.item(i).nu_credit_limit,
        naWebSite: data.rows.item(i).na_web_site,
        idCurrency: data.rows.item(i).id_currency,
        coCurrency: data.rows.item(i).co_currency,
        multimoneda: data.rows.item(i).multimoneda,
        coEnterprise: data.rows.item(i).co_enterprise,
        idEnterprise: data.rows.item(i).id_enterprise,
        channel: data.rows.item(i).channel,
        lblEnterprise: data.rows.item(i).lbl_enterprise,
        naPriceList: data.rows.item(i).na_price_list,
        naResponsible: data.rows.item(i).na_responsible,
        nuPhone: data.rows.item(i).nu_phone,
        saldo1: data.rows.item(i).saldo1 == null ? 0 : data.rows.item(i).saldo1,
        saldo1Conver: data.rows.item(i).saldo1Conver == null ? 0 : data.rows.item(i).saldo1Conver,
        saldo2: data.rows.item(i).saldo2 == null ? 0 : data.rows.item(i).saldo2,
        saldo2Conver: data.rows.item(i).saldo2Conver == null ? 0 : data.rows.item(i).saldo2Conver,
        txAddress: data.rows.item(i).tx_address,
        coordenada: data.rows.item(i).coordenada,
        editable: data.rows.item(i).editable,
        idAddressClients: 0,
        coAddressClients: "",
        collectionIva: data.rows.item(i).collection_iva == "true" ? true : false,
        txDescription1: data.rows.item(i).tx_description_1,
        txDescription2: data.rows.item(i).tx_description_2,
        daDocument: data.rows.item(i).daDocument,
        daDueDate: data.rows.item(i).daDueDate,
        countDueDate: data.rows.item(i).countDueDate,
        colorRow: ""
      });
    }
    return clients;
  }

  getClients(idEnterprise: number, page: number) {
    let selectStatement = "";
    let offset = page * this.MAX_ITEMS_PER_PAGE;
    if (this.globalConfig.get("multiCurrency") == 'true') {
      if (this.globalConfig.get("conversionDocument") == 'true') {
        selectStatement = 'SELECT c.*, (SELECT p.na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1 ) na_price_list, ' +
          '(SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1 ) channel, ' +
          '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency =  "' + localStorage.getItem("localCurrency") + '") saldo1,' +
          '(SELECT SUM(ds.nu_balance / ds.nu_value_local) FROM document_sales ds WHERE  ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND  ds.co_currency =  "' + localStorage.getItem("localCurrency") + '") saldo1Conver,' +
          '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE  ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency =  "' + localStorage.getItem("hardCurrency") + '") saldo2,' +
          '(SELECT SUM(ds.nu_balance * ds.nu_value_local) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND  ds.co_currency =  "' + localStorage.getItem("hardCurrency") + '") saldo2Conver,' +
          '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency = c.co_currency) nuAmountTotal1, ' +
          '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client  AND ds.co_currency != c.co_currency) nuAmountTotal2, ' +
          '(SELECT co_currency FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) coCurrency, ' +
          '(SELECT da_document FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDocument, ' +
          '(SELECT MIN(ds.da_due_date) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDueDate, ' +
          '(SELECT COUNT(*) FROM document_sales ds WHERE ds.id_client=c.id_client AND ds.da_due_date < DATE("now") AND  ds.id_enterprise = ' + idEnterprise + ') as countDueDate, ' +
          '(SELECT coordenada FROM address_clients ac WHERE ac.id_client=c.id_client) coordenada, ' +
          '(SELECT editable FROM address_clients ac WHERE ac.id_client=c.id_client) editable, ' +
          '(SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1 ) lbl_enterprise ' +
          'FROM clients c ' +
          'LEFT JOIN lists p ON p.id_list = c.id_list ' +
          'LEFT JOIN distribution_channels dc ON dc.id_channel = c.id_channel ' +
          'WHERE c.id_enterprise = ? ';

      } else {
        selectStatement = 'SELECT c.*, (SELECT p.na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1 ) na_price_list, ' +
          '(SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1 ) channel, ' +
          '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency = c.co_currency) saldo1 ,' +
          '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND  ds.co_currency != c.co_currency) saldo2 ,' +
          '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency = c.co_currency) nuAmountTotal1, ' +
          '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client  AND ds.co_currency != c.co_currency) nuAmountTotal2, ' +
          '(SELECT co_currency FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) coCurrency, ' +
          '(SELECT da_document FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDocument, ' +
          '(SELECT MIN(ds.da_due_date) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDueDate, ' +
          '(SELECT COUNT(*) FROM document_sales ds WHERE ds.id_client=c.id_client AND ds.da_due_date < DATE("now") AND  ds.id_enterprise = ' + idEnterprise + ') as countDueDate, ' + '(SELECT coordenada FROM address_clients ac WHERE ac.id_client=c.id_client) coordenada, ' +
          '(SELECT editable FROM address_clients ac WHERE ac.id_client=c.id_client) editable, ' +
          '(SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1 ) lbl_enterprise ' +
          'FROM clients c ' +
          'LEFT JOIN lists p ON p.id_list = c.id_list ' +
          'LEFT JOIN distribution_channels dc ON dc.id_channel = c.id_channel ' +
          'WHERE c.id_enterprise = ? ';
      }
    } else {
      selectStatement = 'SELECT c.*, (SELECT p.na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1 ) na_price_list, ' +
        '(SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1 ) channel, ' +
        '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) saldo1, ' +
        '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) nuAmountTotal, ' +
        '(SELECT co_currency FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) coCurrency, ' +
        '(SELECT da_document FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDocument, ' +
        '(SELECT MIN(ds.da_due_date) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDueDate, ' +
        '(SELECT COUNT(*) FROM document_sales ds WHERE ds.id_client=c.id_client AND ds.da_due_date < DATE("now") AND  ds.id_enterprise = ' + idEnterprise + ') as countDueDate, ' + '(SELECT coordenada FROM address_clients ac WHERE ac.id_client=c.id_client) coordenada, ' +
        '(SELECT editable FROM address_clients ac WHERE ac.id_client=c.id_client) editable, ' +
        '(SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1 ) lbl_enterprise ' +
        'FROM clients c ' +
        'LEFT JOIN lists p ON p.id_list = c.id_list ' +
        'LEFT JOIN distribution_channels dc ON dc.id_channel = c.id_channel ' +
        'WHERE c.id_enterprise = ? ';
    }

    /* selectStatement = "SELECT * FROM clients" */
    if (this.globalConfig.get("clientsOrderBy") != '') {
      if (this.globalConfig.get("clientsOrderBy") == "na_client") {
        selectStatement += ' ORDER BY TRIM(LOWER(c.lb_client)) COLLATE NOCASE ASC, c.id_client ASC';
      } else if (this.globalConfig.get("clientsOrderBy") == "due_date") {
        //primero los que tengan mayor deuda y luego por fecha de vencimiento (los mas vencidos primero)
        selectStatement += ' ORDER BY countDueDate DESC, daDueDate ASC, c.id_client ASC';
      } else selectStatement += ' ORDER BY c.' + this.globalConfig.get("clientsOrderBy") + ', c.id_client ASC';
    }

    selectStatement += ' LIMIT ' + this.MAX_ITEMS_PER_PAGE + ' OFFSET ' + offset;

    return this.dbServ.getDatabase().executeSql(selectStatement, [idEnterprise]).then(data => {
      let lists = this.ClientBDtoClient(data);
      return lists;
    })


  }

  searchClients(idEnterprise: number, searchText: string, page: number) {
    let selectStatement = "";
    let offset = page * this.MAX_ITEMS_PER_PAGE;
    // Normalize and split search text into tokens
    const tokens = (searchText || '').toString().trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);

    let orderBy = ' '
    if (this.globalConfig.get("clientsOrderBy") != '') {
      if (this.globalConfig.get("clientsOrderBy") == "na_client") {
        orderBy += ' ORDER BY TRIM(LOWER(c.lb_client)) COLLATE NOCASE ASC, c.id_client ASC';
      } else if (this.globalConfig.get("clientsOrderBy") == "due_date") {
        orderBy += ' ORDER BY countDueDate DESC, daDueDate ASC, c.id_client ASC';
      } else
        orderBy += ' ORDER BY c.' + this.globalConfig.get("clientsOrderBy") + ', c.id_client ASC';
    }
    // Build WHERE clause: for each token require (co_product LIKE ? OR na_product LIKE ?)
    const tokenClauses: string[] = [];
    const params: any[] = [];
    for (const t of tokens) {
      const pattern = this.textService.convertToSqliteAccentGlob(t);
      tokenClauses.push("(c.co_client GLOB ? OR c.lb_client GLOB ?)");
      params.push(pattern, pattern);
    }

    // always filter by enterprise
    const whereTokens = tokenClauses.length ? tokenClauses.join(" AND ") + " AND c.id_enterprise = ?" : "c.id_enterprise = ?";
    params.push(idEnterprise);

    //paginacion: limit y offset
    params.push(this.MAX_ITEMS_PER_PAGE, offset);

    if (this.globalConfig.get("multiCurrency") == 'true') {
      if (this.globalConfig.get("conversionDocument") == 'true') {
        selectStatement = 'SELECT c.*, (SELECT p.na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1 ) na_price_list, ' +
          '(SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1 ) channel, ' +
          '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency =  "' + localStorage.getItem("localCurrency") + '") saldo1,' +
          '(SELECT SUM(ds.nu_balance / ds.nu_value_local) FROM document_sales ds WHERE  ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND  ds.co_currency =  "' + localStorage.getItem("localCurrency") + '") saldo1Conver,' +
          '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE  ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency =  "' + localStorage.getItem("hardCurrency") + '") saldo2,' +
          '(SELECT SUM(ds.nu_balance * ds.nu_value_local) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND  ds.co_currency =  "' + localStorage.getItem("hardCurrency") + '") saldo2Conver,' +
          '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency = c.co_currency) nuAmountTotal1, ' +
          '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client  AND ds.co_currency != c.co_currency) nuAmountTotal2, ' +
          '(SELECT co_currency FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) coCurrency, ' +
          '(SELECT da_document FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDocument, ' +
          '(SELECT MIN(ds.da_due_date) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDueDate, ' +
          '(SELECT COUNT(*) FROM document_sales ds WHERE ds.id_client=c.id_client AND ds.da_due_date < DATE("now") AND  ds.id_enterprise = ' + idEnterprise + ') as countDueDate, ' +
          '(SELECT coordenada FROM address_clients ac WHERE ac.id_client=c.id_client) coordenada, ' +
          '(SELECT editable FROM address_clients ac WHERE ac.id_client=c.id_client) editable, ' +
          '(SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1 ) lbl_enterprise ' +
          'FROM clients c ' +
          'LEFT JOIN lists p ON p.id_list = c.id_list ' +
          'LEFT JOIN distribution_channels dc ON dc.id_channel = c.id_channel ' +
          'WHERE ' + whereTokens + ' ' + orderBy + ' LIMIT ? OFFSET ?';

      } else {
        selectStatement = 'SELECT c.*, (SELECT p.na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1 ) na_price_list, ' +
          '(SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1 ) channel, ' +
          '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency = c.co_currency) saldo1 ,' +
          '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND  ds.co_currency != c.co_currency) saldo2 ,' +
          '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client AND ds.co_currency = c.co_currency) nuAmountTotal1, ' +
          '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client  AND ds.co_currency != c.co_currency) nuAmountTotal2, ' +
          '(SELECT co_currency FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) coCurrency, ' +
          '(SELECT da_document FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDocument, ' +
          '(SELECT MIN(ds.da_due_date) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDueDate, ' +
          '(SELECT COUNT(*) FROM document_sales ds WHERE ds.id_client=c.id_client AND ds.da_due_date < DATE("now") AND  ds.id_enterprise = ' + idEnterprise + ') as countDueDate, ' + '(SELECT coordenada FROM address_clients ac WHERE ac.id_client=c.id_client) coordenada, ' +
          '(SELECT editable FROM address_clients ac WHERE ac.id_client=c.id_client) editable, ' +
          '(SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1 ) lbl_enterprise ' +
          'FROM clients c ' +
          'LEFT JOIN lists p ON p.id_list = c.id_list ' +
          'LEFT JOIN distribution_channels dc ON dc.id_channel = c.id_channel ' +
          'WHERE ' + whereTokens + ' ' + orderBy + ' LIMIT ? OFFSET ?';
      }
    } else {
      selectStatement = 'SELECT c.*, (SELECT p.na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1 ) na_price_list, ' +
        '(SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1 ) channel, ' +
        '(SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) saldo1, ' +
        '(SELECT SUM(ds.nu_amount_total) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) nuAmountTotal, ' +
        '(SELECT co_currency FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) coCurrency, ' +
        '(SELECT da_document FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDocument, ' +
        '(SELECT MIN(ds.da_due_date) FROM document_sales ds WHERE ds.id_enterprise = ' + idEnterprise + ' AND ds.id_client=c.id_client) daDueDate, ' +
        '(SELECT COUNT(*) FROM document_sales ds WHERE ds.id_client=c.id_client AND ds.da_due_date < DATE("now") AND  ds.id_enterprise = ' + idEnterprise + ') as countDueDate, ' + '(SELECT coordenada FROM address_clients ac WHERE ac.id_client=c.id_client) coordenada, ' +
        '(SELECT editable FROM address_clients ac WHERE ac.id_client=c.id_client) editable, ' +
        '(SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1 ) lbl_enterprise ' +
        'FROM clients c ' +
        'LEFT JOIN lists p ON p.id_list = c.id_list ' +
        'LEFT JOIN distribution_channels dc ON dc.id_channel = c.id_channel ' +
        'WHERE ' + whereTokens + ' ' + orderBy + ' LIMIT ? OFFSET ?';
    }
    return this.dbServ.getDatabase().executeSql(selectStatement, params).then(data => {
      let lists = this.ClientBDtoClient(data);
      return lists;
    });
  }

  getClient(idClient: number, idEnterprise: number) {
    let selectStatement = 'SELECT co_client as coClient, co_currency as coCurrency, co_enterprise as coEnterprise,'
      + 'co_payment_condition as coPaymentCondition,id_channel as idChannel,id_client as idClient,id_currency as idCurrency,'
      + 'id_enterprise as idEnterprise,id_head_quarter as idHeadQuarter,id_list as idList,id_payment_condition as idPaymentCondition,'
      + 'id_warehouse as idWarehouse,in_suspension as inSuspension,lb_client as lbClient,multimoneda, na_email as naEmail,'
      + 'na_web_site as naWebSite,nu_credit_limit as nuCreditLimit,nu_rif as nuRif,qu_discount as quDiscount'
      + ' FROM clients  WHERE id_client = ? and id_enterprise = ?';
    return this.dbServ.getDatabase().executeSql(selectStatement, [idClient, idEnterprise]).then(data => {
      return this.ClientBDtoClient(data)[0];
    })
  }

  getClientById(idClient: number) {

    if (this.globalConfig.get("multiCurrency")) {
      if (this.globalConfig.get("conversionDocument")) {
        const localCurrency = localStorage.getItem('localCurrency') || '';
        const hardCurrency = localStorage.getItem('hardCurrency') || '';

        const selectStatement = `
  SELECT c.co_client AS coClient,
         c.co_currency AS coCurrency,
         c.co_enterprise AS coEnterprise,
         c.co_payment_condition AS coPaymentCondition,
         c.id_channel AS idChannel,
         c.id_client AS idClient,
         c.id_currency AS idCurrency,
         c.id_enterprise AS idEnterprise,
         c.id_head_quarter AS idHeadQuarter,
         c.id_list AS idList,
         c.id_payment_condition AS idPaymentCondition,
         c.id_warehouse AS idWarehouse,
         c.in_suspension AS inSuspension,
         c.lb_client AS lbClient,
         c.multimoneda,
         c.na_email AS naEmail,
         c.na_web_site AS naWebSite,
         c.nu_credit_limit AS nuCreditLimit,
         c.nu_rif AS nuRif,
         c.qu_discount AS quDiscount,
         c.tx_description_1 AS txDescription1,
         c.tx_description_2 AS txDescription2,

         (SELECT na_responsible FROM address_clients WHERE id_client = ? LIMIT 1) AS naResponsible,
         (SELECT na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1) AS naPriceList,
         (SELECT nu_phone FROM address_clients WHERE id_client = ? LIMIT 1) AS nuPhone,
         (SELECT tx_address FROM address_clients WHERE id_client = ? LIMIT 1) AS txAddress,

         (SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1) AS channel,

         (SELECT SUM(ds.nu_balance) FROM document_sales ds
            WHERE ds.id_client = ? AND ds.co_currency = ?) AS saldo1,
         (SELECT SUM(ds.nu_balance / ds.nu_value_local) FROM document_sales ds
            WHERE ds.id_client = ? AND ds.co_currency = ?) AS saldo1Conver,
         (SELECT SUM(ds.nu_balance) FROM document_sales ds
            WHERE ds.id_client = ? AND ds.co_currency = ?) AS saldo2,
         (SELECT SUM(ds.nu_balance * ds.nu_value_local) FROM document_sales ds
            WHERE ds.id_client = ? AND ds.co_currency = ?) AS saldo2Conver,

         (SELECT co_currency FROM document_sales ds WHERE ds.id_client = ? LIMIT 1) AS coCurrency,

         (SELECT ac.coordenada FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS coordenada,
         (SELECT ac.editable FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS editable,
         (SELECT id_address FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS idAddressClients,
         (SELECT co_address FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS coAddressClients,

         (SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1) AS lblEnterprise,

         -- nueva: nombre de la condicion de pago
         (SELECT pc.na_payment_condition FROM payment_conditions pc
            WHERE pc.co_payment_condition = c.co_payment_condition LIMIT 1) AS na_payment_condition,

          (SELECT COUNT(*) FROM document_sales ds WHERE ds.id_client=c.id_client AND ds.da_due_date < DATE("now") AND  ds.id_enterprise = c.id_enterprise) as countDueDate
  FROM clients c
  WHERE id_client = ?
`;

        // parámetros en el mismo orden de los '?' arriba:
        // 1 naResponsible(idClient), 2 nuPhone(idClient), 3 txAddress(idClient),
        // 4 saldo1.id_client, 5 saldo1.co_currency,
        // 6 saldo1Conver.id_client, 7 saldo1Conver.co_currency,
        // 8 saldo2.id_client, 9 saldo2.co_currency,
        // 10 saldo2Conver.id_client, 11 saldo2Conver.co_currency,
        // 12 coCurrency.id_client,
        // 13 WHERE id_client = ?
        const params = [
          idClient,         // naResponsible
          idClient,         // nuPhone
          idClient,         // txAddress
          idClient,         // saldo1.id_client
          localCurrency,    // saldo1.co_currency
          idClient,         // saldo1Conver.id_client
          localCurrency,    // saldo1Conver.co_currency
          idClient,         // saldo2.id_client
          hardCurrency,     // saldo2.co_currency
          idClient,         // saldo2Conver.id_client
          hardCurrency,     // saldo2Conver.co_currency
          idClient,         // coCurrency.id_client
          idClient          // countDueDate.id_client
        ];

        // Ejecuta la query con los parámetros:
        return this.dbServ.getDatabase().executeSql(selectStatement, params).then(data => {
          // ... tu mapeo existente ... añade la nueva propiedad si la quieres exponer:
          // data.rows.item(i).na_payment_condition
          // por ejemplo:
          const row = data.rows.item(0);
          row.saldo1 = row.saldo1 == null ? 0 : row.saldo1;
          row.saldo1Conver = row.saldo1Conver == null ? 0 : row.saldo1Conver;
          row.saldo2 = row.saldo2 == null ? 0 : row.saldo2;
          row.saldo2Conver = row.saldo2Conver == null ? 0 : row.saldo2Conver;
          return row;
        });

      } else {
        // Replace the existing var selectStatement + executeSql(...) for the non-conversionDocument branch of getClientById with:

        const selectStatement = `
  SELECT
    c.co_client AS coClient,
    c.co_currency AS coCurrency,
    c.co_enterprise AS coEnterprise,
    c.co_payment_condition AS coPaymentCondition,
    c.id_channel AS idChannel,
    c.id_client AS idClient,
    c.id_currency AS idCurrency,
    c.id_enterprise AS idEnterprise,
    c.id_head_quarter AS idHeadQuarter,
    c.id_list AS idList,
    c.id_payment_condition AS idPaymentCondition,
    c.nu_credit_limit AS nuCreditLimit,
    c.id_warehouse AS idWarehouse,
    c.in_suspension AS inSuspension,
    c.lb_client AS lbClient,
    c.nu_rif AS nuRif,
    c.multimoneda,
    c.na_email AS naEmail,
    c.na_client AS naClient,
    c.qu_discount AS quDiscount,
    c.tx_description_1 AS txDescription1,
    c.tx_description_2 AS txDescription2,

    (SELECT na_responsible FROM address_clients WHERE id_client = ? LIMIT 1) AS naResponsible,
    (SELECT na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1) AS naPriceList,
    (SELECT nu_phone FROM address_clients WHERE id_client = ? LIMIT 1) AS nuPhone,
    (SELECT tx_address FROM address_clients WHERE id_client = ? LIMIT 1) AS txAddress,

    (SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1) AS channel,

    (SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_client = ? AND ds.co_currency = c.co_currency) AS saldo1,
    (SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_client = ? AND ds.co_currency != c.co_currency) AS saldo2,
    (SELECT co_currency FROM document_sales ds WHERE ds.id_client = ? LIMIT 1) AS coCurrency,

    (SELECT ac.coordenada FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS coordenada,
    (SELECT ac.editable FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS editable,
    (SELECT id_address FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS idAddressClients,
    (SELECT co_address FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS coAddressClients,

    (SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1) AS lblEnterprise,

    -- nombre de la condición de pago
    (SELECT pc.na_payment_condition FROM payment_conditions pc
       WHERE pc.co_payment_condition = c.co_payment_condition LIMIT 1) AS na_payment_condition,

     (SELECT COUNT(*) FROM document_sales ds WHERE ds.id_client=c.id_client AND ds.da_due_date < DATE("now") AND  ds.id_enterprise = c.id_enterprise) as countDueDate

  FROM clients c
  WHERE c.id_client = ?
`;

        // parámetros (en el mismo orden que los '?' en la consulta)
        const params = [
          idClient, // naResponsible
          idClient, // nuPhone
          idClient, // txAddress
          idClient, // saldo1.ds.id_client
          idClient, // saldo2.ds.id_client
          idClient, // coCurrency.ds.id_client
          idClient  // WHERE c.id_client = ?
        ];

        return this.dbServ.getDatabase().executeSql(selectStatement, params).then(data => {
          if (data.rows.length === 0) return null;
          const row = data.rows.item(0);

          // Normalizar saldos (igual que en la otra rama)
          row.saldo1 = row.saldo1 == null ? 0 : row.saldo1;
          row.saldo2 = row.saldo2 == null ? 0 : row.saldo2;

          // Exponer la descripción de la condición de pago con camelCase
          row.naPaymentCondition = row.na_payment_condition ?? null;

          return row;
        });
      }
    } else {
      // Reemplaza el var selectStatement + executeSql(...) por lo siguiente:

      const selectStatement = `
  SELECT
    c.co_client AS coClient,
    c.co_currency AS coCurrency,
    c.co_enterprise AS coEnterprise,
    c.co_payment_condition AS coPaymentCondition,
    c.id_channel AS idChannel,
    c.id_client AS idClient,
    c.id_currency AS idCurrency,
    c.id_enterprise AS idEnterprise,
    c.id_head_quarter AS idHeadQuarter,
    c.id_list AS idList,
    c.id_payment_condition AS idPaymentCondition,
    c.nu_credit_limit AS nuCreditLimit,
    c.id_warehouse AS idWarehouse,
    c.in_suspension AS inSuspension,
    c.lb_client AS lbClient,
    c.nu_rif AS nuRif,
    c.multimoneda,
    c.na_email AS naEmail,
    c.na_client AS naClient,
    c.qu_discount AS quDiscount,
    c.tx_description_1 AS txDescription1,
    c.tx_description_2 AS txDescription2,

    (SELECT na_responsible FROM address_clients WHERE id_client = ? LIMIT 1) AS na_responsible,
    (SELECT na_list FROM lists p WHERE p.id_list = c.id_list LIMIT 1) AS na_price_list,
    (SELECT nu_phone FROM address_clients WHERE id_client = ? LIMIT 1) AS nu_phone,
    (SELECT tx_address FROM address_clients WHERE id_client = ? LIMIT 1) AS tx_address,

    (SELECT na_channel FROM distribution_channels WHERE id_channel = c.id_channel LIMIT 1) AS channel,

    (SELECT SUM(ds.nu_balance) FROM document_sales ds WHERE ds.id_client = ? AND ds.co_currency = c.co_currency) AS saldo,
    (SELECT co_currency FROM document_sales ds WHERE ds.id_client = ? LIMIT 1) AS coCurrency,

    (SELECT ac.coordenada FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS coordenada,
    (SELECT ac.editable FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS editable,
    (SELECT id_address FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS idAddressClients,
    (SELECT co_address FROM address_clients ac WHERE ac.id_client = c.id_client LIMIT 1) AS coAddressClients,

    (SELECT e.lb_enterprise FROM enterprises e WHERE e.id_enterprise = c.id_enterprise LIMIT 1) AS lblEnterprise,

    -- nombre de la condición de pago desde payment_conditions
    (SELECT pc.na_payment_condition FROM payment_conditions pc
       WHERE pc.co_payment_condition = c.co_payment_condition LIMIT 1) AS na_payment_condition,

     (SELECT COUNT(*) FROM document_sales ds WHERE ds.id_client=c.id_client AND ds.da_due_date < DATE("now") AND  ds.id_enterprise = c.id_enterprise) as countDueDate

  FROM clients c
  WHERE c.id_client = ?
`;

      // parámetros (orden de los '?' en la query)
      const params = [
        idClient, // na_responsible
        idClient, // nu_phone
        idClient, // tx_address
        idClient, // saldo (ds.id_client)
        idClient, // coCurrency (ds.id_client)
        idClient  // WHERE c.id_client = ?
      ];

      return this.dbServ.getDatabase().executeSql(selectStatement, params).then(data => {
        if (!data || data.rows.length === 0) return null;
        const row = data.rows.item(0);

        // Normalizaciones / alias y nueva propiedad camelCase
        row.saldo = row.saldo == null ? 0 : row.saldo;
        row.coCurrency = row.coCurrency ?? row.co_currency ?? null;
        // Exponer la descripción de la condición de pago en camelCase
        row.naPaymentCondition = row.na_payment_condition ?? null;
        // También puedes mapear/aliasar otras columnas si tu código cliente usa nombres distintos

        return row;
      });
    }
  }

  getDocumentSaleByIdClient(idClient: number) {
    let selectStatement = 'SELECT DISTINCT ds.*, ' +
      '(SELECT na_type FROM document_sale_types WHERE co_type = ds.co_document_sale_type) naType ' +
      'FROM document_sales ds WHERE ds.id_client = ?';

    return this.dbServ.getDatabase().executeSql(selectStatement, [idClient]).then(data => {
      let lists: DocumentSale[] = [];

      for (let i = 0; i < data.rows.length; i++) {
        lists.push({
          idDocument: data.rows.item(i).id_document,
          idClient: data.rows.item(i).id_client,
          coClient: data.rows.item(i).co_client,
          idDocumentSaleType: data.rows.item(i).id_document_sale_type,
          coDocumentSaleType: data.rows.item(i).co_document_sale_type,
          daDocument: data.rows.item(i).da_document,
          daDueDate: data.rows.item(i).da_due_date,
          nuAmountBase: data.rows.item(i).nu_amount_base,
          nuAmountDiscount: data.rows.item(i).nu_amount_discount,
          nuAmountTax: data.rows.item(i).nu_amount_tax,
          nuAmountTotal: data.rows.item(i).nu_amount_total,
          nuAmountPaid: data.rows.item(i).nu_amount_total,
          nuBalance: data.rows.item(i).nu_balance,
          coCurrency: data.rows.item(i).co_currency,
          idCurrency: data.rows.item(i).id_currency,
          nuDocument: data.rows.item(i).nu_document,
          txComment: data.rows.item(i).tx_comment,
          coDocument: data.rows.item(i).co_document,
          coCollection: data.rows.item(i).co_collection,
          nuValueLocal: data.rows.item(i).nu_value_local,
          stDocumentSale: data.rows.item(i).st_document_sale,
          coEnterprise: data.rows.item(i).co_enterprise,
          idEnterprise: data.rows.item(i).id_enterprise,
          naType: data.rows.item(i).naType,
          isSelected: false,
          positionCollecDetails: 0,
          nuAmountRetention: 0,
          nuAmountRetention2: 0,
          daVoucher: "",
          nuVaucherRetention: "",
          igtfAmount: 0,
          txConversion: 0,
          inPaymentPartial: false,
          historicPaymentPartial: false,
          isSave: false,
          colorRow: '',
          daUpdate: '',
          missingRetention: false,
        })
      }
      return lists
    }).catch(e => {
      let lists: DocumentSale[] = [];
      console.log(e);
      return lists;
    })
  }

  getAddressClientsByIdClient(idClient: number) {
    let selectStatement = 'SELECT * FROM address_clients WHERE id_client = ?';

    return this.dbServ.getDatabase().executeSql(selectStatement, [idClient]).then(data => {
      let lists: AddresClient[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        const item = data.rows.item(i);
        lists.push({
          idAddress: item.id_address,
          coAddress: item.co_address,
          idClient: item.id_client,
          idAddressType: item.id_address_type,
          coAddressType: item.co_address_type,
          naAddress: item.na_address,
          txAddress: item.tx_address,
          nuPhone: item.nu_phone,
          naResponsible: item.na_responsible,
          coEnterpriseStructure: item.co_enterprise_structure,
          idEnterpriseStructure: item.id_enterprise_structure,
          coClient: item.co_client,
          coEnterprise: item.co_enterprise,
          idEnterprise: item.id_enterprise,
          coordenada: item.coordenada,
          editable: item.editable.toLowerCase() === 'true' ? true : false,
        })
      }
      return lists;
    }).catch(e => {
      let lists: AddresClient[] = [];
      console.log(e);
      return lists;
    })
  }

}
