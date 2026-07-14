import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, fromEventPattern, identity, Observable, throwError, firstValueFrom } from 'rxjs';
import { NavController } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
// import { SQLitePorter } from '@ionic-native/sqlite-porter';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { ServicesService } from '../services.service';
import { syncResponse } from 'src/app/modelos/tables/getSyncResponse';
import { AddresClient } from '../../modelos/tables/addresClient';
import { Client } from 'src/app/modelos/tables/client';
import { Currencies } from 'src/app/modelos/tables/currencies';
import { DistributionChannel } from 'src/app/modelos/tables/distributionChannel';
import { DocumentSaleType } from 'src/app/modelos/tables/documentSaleType';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { List } from 'src/app/modelos/tables/list';
import { PaymentCondition } from 'src/app/modelos/tables/paymentCondition';
import { ProductLine } from 'src/app/modelos/tables/productLine';
import { Product } from 'src/app/modelos/tables/product';
import { Unit } from 'src/app/modelos/tables/unit';
import { ProductUnit } from 'src/app/modelos/tables/productUnit';
import { PriceList } from 'src/app/modelos/tables/priceList';
import { GlobalConfiguration } from 'src/app/modelos/tables/globalConfiguration';
import { Bank } from 'src/app/modelos/tables/bank';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { IncidenceMotive } from 'src/app/modelos/tables/incidenceMotive';
import { IncidenceType } from 'src/app/modelos/tables/incidenceType';
import { ReturnMotive } from 'src/app/modelos/tables/returnMotive';
import { ReturnType } from 'src/app/modelos/tables/returnType';
import { BankAccount } from 'src/app/modelos/tables/bankAccount';
import { Stock } from 'src/app/modelos/tables/stock';
import { Discount } from 'src/app/modelos/tables/discount';
import { Visit } from 'src/app/modelos/tables/visit';
import { IvaList } from 'src/app/modelos/tables/iva';
import { Warehouse } from 'src/app/modelos/tables/warehouse';
import { GlobalDiscount } from 'src/app/modelos/tables/globalDiscount';
import { ProductMinMulFav } from 'src/app/modelos/tables/productMinMul';
import { ProductBonusFav } from 'src/app/modelos/tables/productBonusFav';
import { ClientBankAccount } from 'src/app/modelos/tables/clientBankAccount';
import { UserInformation } from 'src/app/modelos/tables/userInformation';
import { CurrencyEnterprise } from 'src/app/modelos/tables/currencyEnterprise';
import { CurrencyRelation } from 'src/app/modelos/tables/currencyRelation';
import { ConversionType } from 'src/app/modelos/tables/conversionType';
import { ProductStructure } from 'src/app/modelos/tables/productStructure';
import { ProductStructureCount } from 'src/app/modelos/tables/productStructureCount';
import { OrderType } from 'src/app/modelos/tables/orderType';
import { UserProductFav } from 'src/app/modelos/tables/userProductFav';
import { TypeProductStructure } from 'src/app/modelos/tables/typeProductStructure';
import { ClientAvgProduct } from 'src/app/modelos/tables/clientAvgProduct';
import { Invoice } from 'src/app/modelos/tables/invoice';
import { IgtfList } from 'src/app/modelos/tables/igtfList';
import { InvoiceDetail } from 'src/app/modelos/tables/invoiceDetail';
import { InvoiceDetailUnit } from 'src/app/modelos/tables/invoiceDetailUnit';
import { ApplicationTag } from 'src/app/modelos/tables/applicationTag';
import { User } from 'src/app/modelos/user';
import { Router } from '@angular/router';
import { ClientChannelOrderType } from 'src/app/modelos/tables/clientChannelOrderType';
import { OrderTypeProductStructure } from 'src/app/modelos/tables/orderTypeProductStructure';
import { Statuses } from 'src/app/modelos/tables/statuses';
import { TransactionTypes } from 'src/app/modelos/tables/transactionTypes';
import { TransactionStatuses } from 'src/app/modelos/tables/transactionStatuses';
import { Orders } from 'src/app/modelos/tables/orders';
import { PedidosDbService } from 'src/app/pedidos/pedidos-db.service';
import { Collection } from 'src/app/modelos/tables/collection';
import { CollectionService } from '../collection/collection-logic.service';
import { Return } from 'src/app/modelos/tables/return';
import { ClientStocks } from 'src/app/modelos/tables/client-stocks';
import { Deposit } from 'src/app/modelos/tables/deposit';
import { ReturnLogicService } from '../returns/return-logic.service';
import { InventariosLogicService } from '../inventarios/inventarios-logic.service';
import { DepositService } from '../deposit/deposit.service';
import { ReturnDatabaseService } from '../returns/return-database.service';
import { OrderDetail } from 'src/app/modelos/tables/orderDetail';
import { OrderDetailUnit } from 'src/app/modelos/tables/orderDetailUnit';
import { OrderDetailDiscount } from 'src/app/modelos/orderDetailDiscount';
import { Conversion } from 'src/app/modelos/tables/conversion';
import { CurrencyModules } from '../../modelos/tables/currencyModules';
import { Modules } from '../../modelos/tables/modules';
import { DifferenceCode } from 'src/app/modelos/tables/differenceCode';
import { CollectDiscounts } from 'src/app/modelos/tables/collectDiscounts';
import { StraightSwap } from 'src/app/modelos/tables/straightSwap';
import { ReturnCategory } from 'src/app/modelos/tables/returnCategory';
import { CodePhoneNumber } from 'src/app/modelos/tables/codePhoneNumber';
import { UnitPriceList } from 'src/app/modelos/tables/unitPriceList';
import { TypeDocument } from 'src/app/modelos/tables/typeDocument';
import { CollectRetentions } from 'src/app/modelos/tables/collectRetentions';


/** Mock SQLiteObject para navegador: retorna resultados vacíos y permite probar la app con TestSprite */
function createMockSqliteObject(): SQLiteObject {
  const emptyRows = {
    length: 0,
    item: (_i: number) => null
  };
  return {
    executeSql: (_sql: string, _params?: any[]) =>
      Promise.resolve({ rows: emptyRows, rowsAffected: 0 }),
    sqlBatch: (_operations: any[]) => Promise.resolve([])
  } as SQLiteObject;
}

@Injectable({
  providedIn: 'root'
})

export class SynchronizationDBService {
  private database!: SQLiteObject;
  private services = inject(ServicesService);
  private pedidosService = inject(PedidosDbService);
  private collectionService = inject(CollectionService);
  private returnService = inject(ReturnDatabaseService);
  private clientStockService = inject(InventariosLogicService);
  private depositService = inject(DepositService);
  private databaseReady!: BehaviorSubject<boolean>;
  private tables: any[] = [];
  public tablaSincronizando: string = "";
  public inHome: Boolean = true;
  private CURRENT_DB_VERSION: number = 18;
  private readonly DEFAULT_TABLE_LAST_UPDATE = '1970-01-01 00:00:00.000';

  constructor(
    private navController: NavController,

    private sqlite: SQLite,
    private http: HttpClient,
    private router: Router,

  ) {
    this.databaseReady = new BehaviorSubject(false);

    this.tables = [
      { "id": 99996, "nameTable": "transactionImage" },
      { "id": 99997, "nameTable": "incidences" },
      { "id": 99998, "nameTable": "globalConfiguration" },
      { "id": 99999, "nameTable": "versionsTables" },
      { "id": 1, "nameTable": "addressClientTable" },
      { "id": 2, "nameTable": "bankTable" },
      { "id": 3, "nameTable": "clientTable" },
      { "id": 5, "nameTable": "distributionChannelTable" },
      { "id": 6, "nameTable": "documentSaleTable" },
      { "id": 7, "nameTable": "documentSaleTypeTable" },
      { "id": 8, "nameTable": "enterpriseTable" },
      { "id": 9, "nameTable": "incidenceMotiveTable" },
      { "id": 10, "nameTable": "incidenceTypeTable" },
      { "id": 13, "nameTable": "priceListTable" },
      { "id": 15, "nameTable": "productTable" },
      { "id": 16, "nameTable": "returnMotiveTable" },
      { "id": 17, "nameTable": "returnTypeTable" },
      { "id": 20, "nameTable": "bankAccountTable" },
      { "id": 23, "nameTable": "listTable" },
      { "id": 25, "nameTable": "stockTable" },
      { "id": 29, "nameTable": "discountTable" },
      { "id": 31, "nameTable": "paymentConditionTable" },
      { "id": 32, "nameTable": "productUnitTable" },
      { "id": 33, "nameTable": "visitTable" },
      { "id": 34, "nameTable": "ivaListTable" },
      { "id": 35, "nameTable": "warehouseTable" },
      { "id": 37, "nameTable": "globalDiscountTable" },
      { "id": 38, "nameTable": "clientBankAccountTable" },
      { "id": 39, "nameTable": "productMinMulTable" },
      { "id": 40, "nameTable": "userInformationTable" },
      { "id": 42, "nameTable": "currencyEnterpriseTable" },
      { "id": 43, "nameTable": "currencyRelationTable" },
      { "id": 44, "nameTable": "conversionTypeTable" },
      { "id": 46, "nameTable": "typeProductStructureTable" },
      { "id": 48, "nameTable": "productStructureTable" },
      { "id": 50, "nameTable": "unitTable" },/*
      { "id": 51, "nameTable": "productStructureCountTable" }, */
      { "id": 52, "nameTable": "orderTypeTable" },
      { "id": 53, "nameTable": "userProductFavTable" },
      { "id": 54, "nameTable": "clientAvgProductTable" },
      { "id": 55, "nameTable": "igtfListTable" },
      { "id": 56, "nameTable": "invoiceTable" },
      { "id": 57, "nameTable": "invoiceDetailTable" },
      { "id": 58, "nameTable": "invoiceDetailUnitTable" },
      { "id": 59, "nameTable": "clientChannelOrderTypeTable" },
      { "id": 60, "nameTable": "orderTypeProductStructureTable" },
      { "id": 61, "nameTable": "statusTable" },
      { "id": 62, "nameTable": "transactionTypeTable" },
      { "id": 63, "nameTable": "transactionStatusesTable" },
      { "id": 64, "nameTable": "orderTable" },
      { "id": 65, "nameTable": "collectionTable" },
      { "id": 66, "nameTable": "returnTable" },
      { "id": 67, "nameTable": "clientStockTable" },
      { "id": 68, "nameTable": "depositTable" },
      { "id": 69, "nameTable": "orderDetailTable" },
      { "id": 70, "nameTable": "orderDetailUnitTable" },
      { "id": 71, "nameTable": "orderDetailDiscountTable" },
      { "id": 72, "nameTable": "conversionTable" },
      { "id": 73, "nameTable": "modules" },
      { "id": 74, "nameTable": "currencyModules" },
      { "id": 75, "nameTable": "differenceCodes" },
      { "id": 76, "nameTable": "collectDiscounts" },
      { "id": 77, "nameTable": "straightSwap"},
      { "id": 78, "nameTable": "returnCategory"},
      { "id": 79, "nameTable": "typeDocument" },
      { "id": 80, "nameTable": "codePhoneNumber" },
      { "id": 81, "nameTable": "unitPriceListTable" },
      { "id": 83, "nameTable": "collectRetention" },
      { "id": 84, "nameTable": "productBonusFavTable" }
    ]
  }

  async initDb(user: User, conexion: Boolean) {
    this.databaseReady = new BehaviorSubject(false);
    const createPromise = this.sqlite.create({
      name: 'denarioPremium',
      location: 'default'
    });
    if (!createPromise) {
      console.warn('SQLite no disponible (ejecutando en navegador). Usando mock para pruebas con TestSprite.');
      this.database = createMockSqliteObject();
      this.createTables(user, conexion);
      return;
    }
    createPromise.then((db: SQLiteObject) => {
      this.database = db;
      this.createTables(user, conexion);
    }).catch(e => console.log(e));
  }

  getDatabase(): SQLiteObject {
    if (!this.database && !Capacitor.isNativePlatform()) {
      return createMockSqliteObject();
    }
    return this.database;
  }

  async createTables(user: User, conexion: Boolean) {
    if (localStorage.getItem("createTables") == "false" || localStorage.getItem("createTables") == null) {
      const promesa = new Promise<string>(async (resolve, reject) => {
        if (conexion) {
          var j = 1;
          (await this.getCreateTables()).subscribe((res) => {
            for (var i in res) {
              this.database.executeSql(res[i].sql, []).then((result) => {
                j++;
                if (j == res.length) {
                  localStorage.setItem("createTables", "true");
                  resolve("true");
                }

              }).catch((error) => {
                console.log(error, res[i].table)
              });
              //si tiene indice lo crea
              if (res[i].index && res[i].index.length > 0) {
                this.database.executeSql(res[i].index, []).then(() => {
                  console.log("Index created for table:", res[i].table);
                }).catch((error) => {
                  console.log(error, res[i].table);
                });
              }
            }

          });
        } else {
          localStorage.setItem("createTables", "true");
          resolve("true");

        }
      })

      promesa.then(async (value) => {
        await this.checkAndRunMigrations();

        this.inHome = false;
        if (conexion) {
          let variablesConfiguracion = JSON.parse(localStorage.getItem("globalConfiguration") || "[]");

          this.insertGlobalConfiguration(variablesConfiguracion)
          if (user.tags.length > 0)
            this.insertTags(user.tags)

          this.initTableVersions(this.tables);
          this.navController.navigateForward("synchronization")
        } else
          this.router.navigate(['home']);

      }).catch((error) => {
        console.log(error);
      }).finally(() => {
        console.log("fin promesa insertar")
      });
    } else {
      if (conexion) {
        await this.checkAndRunMigrations();
        console.log("YA LAS TABLAS ESTAN CREADAS", user);
        /*      if (localStorage.getItem("sincronizarHome") == "true") {
               localStorage.setItem("sincronizarHome", "false");
               //this.router.navigate(['synchronization']);
               this.inHome = false;
               //this.navController.navigateForward("synchronization")

             } else { */
        this.navController.navigateForward("synchronization");
        //this.globalConfig.setVars(user.variablesConfiguracion);
        let variablesConfiguracion = JSON.parse(localStorage.getItem("globalConfiguration") || "[]");

        this.insertGlobalConfiguration(variablesConfiguracion)
        this.insertTags(user.tags)
        //}        //DEBO IR A SINCRONIZAR
      } else {
        //ESTOY SIN DATOS PERO YA SINCRONICE UNA VEZ, SE DEJA LOGGEAR Y SE MANDA MSJ DE NOTIFICACION
        localStorage.setItem("connected", "false")
        this.services.getTags(this.getDatabase(), "HOME", "ESP").then(result => {
          for (var i = 0; i < result.length; i++) {
            this.services.tags.set(
              result[i].coApplicationTag, result[i].tag
            )
          }
          this.services.getTags(this.getDatabase(), "DEN", "ESP").then(result => {
            for (var i = 0; i < result.length; i++) {
              this.services.tags.set(
                result[i].coApplicationTag, result[i].tag
              )
            }
            this.router.navigate(['home']);
          })

        });

      }
    }

  }

  async checkAndRunMigrations() {
    try {
      if (!Capacitor.isNativePlatform()) {
        localStorage.setItem('db_version', String(this.CURRENT_DB_VERSION));
        return;
      }
      const storedVersion = Number(localStorage.getItem('db_version') || '1');
      if (storedVersion >= this.CURRENT_DB_VERSION) {
        return;
      }
      for (let v = storedVersion + 1; v <= this.CURRENT_DB_VERSION; v++) {
        await this.runMigrationForVersion(v);
        localStorage.setItem('db_version', String(v));
        console.log(`Database migrated to v${v}`);
      }
    } catch (e) {
      console.log('checkAndRunMigrations error', e);
      throw e;
    }
  }

  private async runMigrationForVersion(version: number) {
    try {
      const migrations = await this.loadMigrationFile(version);
      if (!migrations || migrations.length === 0) return;
      for (const m of migrations) {
        if (typeof m === 'string') {
          await this.executeMigrationSql(m, []);
        } else if (m && m.sql) {
          const params = m.params || [];
          await this.executeMigrationSql(m.sql, params);
        }
      }
    } catch (e) {
      console.log(`runMigrationForVersion v${version} error`, e);
      throw e;
    }
  }

  private async loadMigrationFile(version: number): Promise<any[]> {
    try {
      const url = 'assets/database/migrations/v' + version + '.json';
      const obs = this.http.get<any[]>(url);
      return await firstValueFrom(obs);
    } catch (e) {
      console.log('loadMigrationFile error', e);
      return [];
    }
  }

  private async executeMigrationSql(sql: string, params: any[] = []): Promise<void> {
    const alterTableAddColumn = this.getAlterTableAddColumnTarget(sql);
    if (alterTableAddColumn) {
      const { tableName, columnName } = alterTableAddColumn;
      const columnExists = await this.checkIfColumnExists(tableName, columnName);
      if (columnExists) {
        return;
      }
    }

    await this.database.executeSql(sql, params);
  }

  private getAlterTableAddColumnTarget(sql: string): { tableName: string; columnName: string } | null {
    const match = /^\s*alter\s+table\s+([^\s]+)\s+add\s+column(?:\s+if\s+not\s+exists)?\s+([^\s]+)/i.exec(sql);
    if (!match) {
      return null;
    }

    const tableName = this.normalizeSqlIdentifier(match[1]);
    const columnName = this.normalizeSqlIdentifier(match[2]);
    if (!tableName || !columnName) {
      return null;
    }

    return { tableName, columnName };
  }

  private normalizeSqlIdentifier(identifier: string): string {
    const trimmed = String(identifier || '').trim().replace(/[;,]+$/, '');
    const bracketMatch = /^\[(.*)\]$/.exec(trimmed);
    if (bracketMatch) {
      return bracketMatch[1];
    }
    const quoteMatch = /^"(.*)"$|^'(.*)'$|^`(.*)`$/.exec(trimmed);
    if (quoteMatch) {
      return quoteMatch[1] || quoteMatch[2] || quoteMatch[3] || '';
    }
    return trimmed;
  }

  private async checkIfColumnExists(tableName: string, columnName: string): Promise<boolean> {
    const table = String(tableName).replace(/'/g, "''");
    const pragmaQuery = `PRAGMA table_info('${table}')`;
    const result = await this.database.executeSql(pragmaQuery, []);

    for (let i = 0; i < result.rows.length; i++) {
      const column = result.rows.item(i);
      if (column?.name === columnName) {
        return true;
      }
    }

    return false;
  }

  getDataBaseState() {
    return this.databaseReady.asObservable();
  }

  ensureTableVersionEntries(): Promise<void> {
    const insertStatement =
      'INSERT OR IGNORE INTO versionsTables (id_table, name_table, last_update, numreg) VALUES (?,?,?,0)';
    const statements = this.tables
      .filter(table => table.id < 99996)
      .map(table => [
        insertStatement,
        [table.id, table.nameTable, this.DEFAULT_TABLE_LAST_UPDATE],
      ]);

    if (statements.length === 0) {
      return Promise.resolve();
    }

    return this.database.sqlBatch(statements).then(() => undefined).catch(error => {
      console.log('ensureTableVersionEntries error', error);
    });
  }

  getTablesVersion() {
    return this.ensureTableVersionEntries().then(() =>
      this.database.executeSql('SELECT * FROM versionsTables', []).then(data => {
        const lists = [];
        for (let i = 0; i < data.rows.length; i++) {
          lists.push(data.rows.item(i));
        }
        return lists;
      }),
    );
  }

  async getCreateTables(): Promise<Observable<any[]>> {
    return this.http.get<any[]>('assets/database/createTables.json');
  }

  initTableVersions(tables: any[]) {
    var statements = [];

    let insertStatement = "INSERT OR REPLACE INTO versionsTables (id_table, name_table,last_update,numreg) VALUES (?,?,?,?)";

    for (var i = 0; i < tables.length; i++) {
      statements.push([insertStatement, [tables[i].id, tables[i].nameTable, '1970-01-01 00:00:00.000', 0]])
    }
    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log("versionTables Error", e);
    })
  }

  updateVersionsTables(lastUpdate: string, idTable: number) {
    const tableMeta = this.tables.find(table => table.id === idTable);
    const nameTable = tableMeta?.nameTable ?? '';
    const upsertStatement =
      'INSERT OR REPLACE INTO versionsTables (id_table, name_table, last_update, numreg) ' +
      'VALUES (?, ?, ?, COALESCE((SELECT numreg FROM versionsTables WHERE id_table = ?), 0))';

    return this.database.executeSql(
      upsertStatement,
      [idTable, nameTable, lastUpdate, idTable],
    ).then(() => true).catch(error => {
      console.log('updateVersionsTables error', error);
    });
  }

  async insertGlobalConfiguration(obj: GlobalConfiguration[]) {
    this.tablaSincronizando = "- Variables Configuración";
    var inserStatement = 'INSERT OR REPLACE INTO global_configuration(' +
      'id_config,clave,valor,descripcion) ' +
      'VALUES(?,?,?,?)';
    var statements = [];
    for (var i = 0; i < obj.length; i++) {
      statements.push([inserStatement, [obj[i].idConfig, obj[i].clave, obj[i].valor, obj[i].descripcion]])
    }
    this.database.sqlBatch(statements).then(res => {
      console.log("insertglobal ready");
    }).catch(e => {
      console.log("insertglobal Error", e);
    })
  }

  async insertTags(obj: ApplicationTag[]) {
    this.tablaSincronizando = "- Etiquetas";
    var inserStatement = 'INSERT OR REPLACE INTO application_tags(' +
      'id_application_tag,co_application_tag,co_language,co_module,na_module,tag' +
      ')' +
      'VALUES(?,?,?,?,?,?)';
    var statements = [];

    for (var i = 0; i < obj.length; i++) {
      statements.push([inserStatement, [obj[i].idApplicationTag, obj[i].coApplicationTag, obj[i].coLanguage,
      obj[i].coModule, obj[i].naModule, obj[i].tag]])
    }
    this.database.sqlBatch(statements).then(res => {
      console.log("insertags ready");
    }).catch(e => {
      console.log("insertags Error", e);
    })
  }

  insertAddressClientBatch(arr: AddresClient[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO address_clients(" +
      'id_address, co_address,id_client,id_address_type,co_address_type,' +
      'tx_address, nu_phone,na_responsible,co_enterprise_structure,id_enterprise_structure,' +
      'co_client, co_enterprise, id_enterprise, na_address, coordenada, editable' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idAddress, arr[i].coAddress, arr[i].idClient, arr[i].idAddressType, arr[i].coAddressType,
      arr[i].txAddress, arr[i].nuPhone, arr[i].naResponsible, arr[i].coEnterpriseStructure, arr[i].idEnterpriseStructure,
      arr[i].coClient, arr[i].coEnterprise, arr[i].idEnterprise, arr[i].naAddress, arr[i].coordenada, arr[i].editable]])
    }

    return this.database.sqlBatch(statements).then(res => {
      console.log("insert addresClient ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertBanksBatch(arr: Bank[]) {
    var statements = [];
    let insertStatement = 'INSERT OR REPLACE INTO banks(' +
      'id_bank,co_enterprise,id_enterprise,na_bank,co_bank' +
      ') ' +
      'VALUES(?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idBank, obj.coEnterprise, obj.idEnterprise, obj.naBank, obj.coBank]])
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertClientBatch(arr: Client[]) {
    let insertStatement = 'INSERT OR REPLACE INTO clients(' +
      'id_client,id_enterprise,co_enterprise,co_client,lb_client,na_client,' +
      'nu_rif,id_channel,id_warehouse,id_head_quarter,id_list,' +
      'id_payment_condition,co_payment_condition,in_suspension,qu_discount,na_email,' +
      'nu_credit_limit,na_web_site,id_currency,co_currency,multimoneda,collection_iva, tx_description_1,tx_description_2 ' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idClient, obj.idEnterprise, obj.coEnterprise, obj.coClient,
      obj.lbClient, obj.naClient, obj.nuRif, obj.idChannel, obj.idWarehouse, obj.idHeadQuarter, obj.idList,
      obj.idPaymentCondition, obj.coPaymentCondition, obj.inSuspension, obj.quDiscount, obj.naEmail,
      obj.nuCreditLimit, obj.naWebSite, obj.idCurrency, obj.coCurrency, obj.multimoneda, obj.collectionIva,
      obj.txDescription1, obj.txDescription2]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);

    })
  }

  insertDistributionChannelBatch(arr: DistributionChannel[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO distribution_channels(" +
      'id_channel,co_channel,na_channel,short_na_channel,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idChannel, obj.coChannel, obj.naChannel,
      obj.shortNaChannel, obj.coEnterprise, obj.idEnterprise]])
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }


  insertDocumentSaleBatch(arr: DocumentSale[]) {
    const standardRows: DocumentSale[] = [];
    const igtfUpsertTasks: Promise<void>[] = [];

    for (const obj of arr) {
      if (this.isSeparateIgtfDocumentSale(obj)) {
        igtfUpsertTasks.push(this.upsertIgtfDocumentSaleReplacingDuplicates(obj));
        continue;
      }

      standardRows.push(obj);
    }

    return Promise.all(igtfUpsertTasks)
      .then(() => {
        if (standardRows.length === 0) {
          return undefined;
        }

        return this.insertDocumentSaleBatchDirect(standardRows);
      });
  }

  private isSeparateIgtfDocumentSale(documentSale: DocumentSale): boolean {
    if (documentSale.coDocumentSaleType === 'IGTF') {
      return true;
    }

    return /^IGTF-/i.test(String(documentSale.coDocument ?? '').trim());
  }

  private normalizeDocumentCoDocumentKey(coDocument: unknown): string {
    return String(coDocument ?? '').trim();
  }

  private resolveKeepIdDocumentForCoDocument(
    incomingIdDocument: number,
    existingIdDocuments: number[],
  ): number {
    const incomingId = Number(incomingIdDocument) || 0;
    const preferredExistingId = existingIdDocuments.find(id => id > 0) ?? existingIdDocuments[0] ?? 0;

    if (incomingId > 0) {
      return incomingId;
    }

    return preferredExistingId;
  }

  private deleteDocumentSalesByCoDocumentExceptId(
    coDocument: string,
    keepIdDocument: number,
  ): Promise<void> {
    return this.database.executeSql(
      'DELETE FROM document_st WHERE co_document = ? AND id_document != ?',
      [coDocument, keepIdDocument],
    ).then(() => this.database.executeSql(
      'DELETE FROM document_sales WHERE co_document = ? AND id_document != ?',
      [coDocument, keepIdDocument],
    )).then(() => undefined);
  }

  private async upsertIgtfDocumentSaleReplacingDuplicates(obj: DocumentSale): Promise<void> {
    const coDocument = this.normalizeDocumentCoDocumentKey(obj.coDocument);
    let keepIdDocument = Number(obj.idDocument ?? 0);

    if (coDocument) {
      const existing = await this.database.executeSql(
        `SELECT id_document FROM document_sales
         WHERE co_document = ?
         ORDER BY CASE WHEN id_document > 0 THEN 0 ELSE 1 END, id_document DESC`,
        [coDocument],
      );

      if (existing.rows.length > 0) {
        const existingIds: number[] = [];
        for (let i = 0; i < existing.rows.length; i++) {
          existingIds.push(Number(existing.rows.item(i).id_document ?? 0));
        }

        keepIdDocument = this.resolveKeepIdDocumentForCoDocument(keepIdDocument, existingIds);
        await this.deleteDocumentSalesByCoDocumentExceptId(coDocument, keepIdDocument);
      }
    }

    obj.idDocument = keepIdDocument;
    await this.insertDocumentSaleBatchDirect([obj]);
  }

  private insertDocumentSaleBatchDirect(arr: DocumentSale[]) {
    if (arr.length === 0) {
      return Promise.resolve(undefined);
    }

    const statements = [];
    const insertStatement = 'INSERT OR REPLACE INTO document_sales(' +
      'id_document,id_client,co_client,id_document_sale_type, co_document_sale_type,' +
      'da_document,da_due_date,nu_amount_base,nu_amount_discount,nu_amount_tax,' +
      'nu_amount_total,nu_balance,id_currency,co_currency,id_enterprise,' +
      'co_enterprise,nu_document,tx_comment,co_document,co_collection,' +
      'nu_value_local,st_document_sale, da_update' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

    for (let i = 0; i < arr.length; i++) {
      const obj = arr[i];
      statements.push([insertStatement, [obj.idDocument, obj.idClient, obj.coClient, obj.idDocumentSaleType, obj.coDocumentSaleType,
      obj.daDocument, obj.daDueDate, obj.nuAmountBase, obj.nuAmountDiscount, obj.nuAmountTax,
      obj.nuAmountTotal, obj.nuBalance, obj.idCurrency, obj.coCurrency, obj.idEnterprise,
      obj.coEnterprise, obj.nuDocument, obj.txComment, obj.coDocument, obj.coCollection,
      obj.nuValueLocal, obj.stDocumentSale, obj.daUpdate]]);
    }

    return this.database.sqlBatch(statements).then(() => {
      const documentStStatements = [];
      const statementsDocumentSt = 'INSERT OR REPLACE INTO document_st (' +
        'id_document, co_document, st_document' +
        ') VALUES (' +
        '?,?,?)';

      for (let i = 0; i < arr.length; i++) {
        const obj = arr[i];
        documentStStatements.push([statementsDocumentSt, [obj.idDocument, obj.coDocument, 0]]);
      }

      return this.database.sqlBatch(documentStStatements).then(res => {
        console.log(res);
      }).catch(e => {
        console.log(e);
      });
    }).catch(e => {
      console.log(e);
    });
  }

  insertDocumentSaleTypeBatch(arr: DocumentSaleType[]) {
    var statements = [];
    let insertStatement = 'INSERT OR REPLACE INTO document_sale_types(' +
      'id_document_sale_type,co_type,na_type,co_equiv,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?)'


    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idDocumentSaleType, obj.coType,
      obj.naType, obj.coEquiv, obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertIncidenceMotiveBatch(arr: IncidenceMotive[]) {
    var statements = [];
    let insertStatement = 'INSERT OR REPLACE INTO incidence_motives(' +
      'id_motive,id_type,na_motive' +
      ') ' +
      'VALUES(?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idMotive, obj.idType, obj.naMotive]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertIncidenceTypeBatch(arr: IncidenceType[]) {
    var statements = [];
    let insertStatement = 'INSERT OR REPLACE INTO incidence_types(' +
      'id_type, na_type, required_event, required_signature' +
      ') ' +
      'VALUES(?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idType, obj.naType, obj.requiredEvent, obj.requiredSignature]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertEnterpriseBatch(arr: Enterprise[]) {
    var statements = [];
    let insertStatement = 'INSERT OR REPLACE INTO enterprises(' +
      'id_enterprise,lb_enterprise,co_enterprise,co_currency_default,enterprise_default, priority_selection' +
      ') ' +
      'VALUES(?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idEnterprise, obj.lbEnterprise, obj.coEnterprise,
      obj.coCurrencyDefault, obj.enterpriseDefault, obj.prioritySelection]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertListBatch(arr: List[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO lists(" +
      'id_list,co_list,na_list,co_enterprise,id_enterprise,show_only' +
      ') ' +
      'VALUES(?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      if(obj.showOnly == null || obj.showOnly == undefined){
        obj.showOnly = false
      }
      statements.push([insertStatement, [obj.idList, obj.coList, obj.naList,
      obj.coEnterprise, obj.idEnterprise, obj.showOnly]])
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertStockBatch(arr: Stock[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO stocks(" +
      'id_stock,id_product,co_product,qu_stock,id_warehouse,' +
      'co_warehouse,da_update_stock,co_enterprise,id_enterprise,co_unit' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idStock, obj.idProduct, obj.coProduct,
      obj.quStock, obj.idWarehouse, obj.coWarehouse,
      obj.daUpdateStock, obj.coEnterprise, obj.idEnterprise, obj.coUnit]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertDiscountBatch(arr: Discount[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO discounts(" +
      'id_discount,id_price_list,qu_discount,co_list,id_list,' +
      'co_product,co_unit,id_unit,qu_vol_ini,qu_vol_fin,' +
      'nu_priority,id_product,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idDiscount, obj.idPriceList,
      obj.quDiscount, obj.coList, obj.idList,
      obj.coProduct, obj.coUnit, obj.idUnit, obj.quVolIni, obj.quVolFin,
      obj.nuPriority, obj.idProduct, obj.coEnterprise, obj.idEnterprise]]);
    }
    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertPaymentConditionBatch(arr: PaymentCondition[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO payment_conditions(" +
      'id_payment_condition,co_payment_condition,na_payment_condition,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idPaymentCondition, obj.coPaymentCondition,
      obj.naPaymentCondition, obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertPriceListBatch(arr: PriceList[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO price_lists(" +
      'id_price_list,co_price_list,id_product,id_list,nu_measure_unit_price,' +
      'nu_price,co_currency,id_currency,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idPriceList, obj.coPriceList, obj.idProduct,
      obj.idList, obj.nuMeasureUnitPrice, obj.nuPrice, obj.coCurrency,
      obj.idCurrency, obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertProductBatch(arr: Product[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO products(" +
      'id_product,co_product,na_product,co_primary_unit,co_product_structure,' +
      'id_product_structure,tx_dimension,tx_packing,points,nu_priority,' +
      'featured_product,tx_description, co_enterprise, id_enterprise, nu_tax' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idProduct, obj.coProduct, obj.naProduct,
      obj.coPrimaryUnit, obj.coProductStructure, obj.idProductStructure, obj.txDimension,
      obj.txPacking, obj.points, obj.nuPriority, obj.featuredProduct,
      obj.txDescription, obj.coEnterprise, obj.idEnterprise, obj.nuTax]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertReturnMotiveBatch(arr: ReturnMotive[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO return_motives(" +
      'id_motive,na_motive' +
      ') ' +
      'VALUES(?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idMotive, obj.naMotive]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertReturnTypeBatch(arr: ReturnType[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO return_types(" +
      'id_type,na_type,id_return_category' +
      ') ' +
      'VALUES(?,?,?)'


    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idType, obj.naType, obj.idReturnCategory]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertBankAccountBatch(arr: BankAccount[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO bank_accounts(" +
      'id_bank_account,co_bank,id_bank,co_account,nu_account,' +
      'co_type,co_currency,id_currency,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idBankAccount, obj.coBank, obj.idBank,
      obj.coAccount, obj.nuAccount, obj.coType, obj.coCurrency, obj.idCurrency,
      obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertProductUnitBatch(arr: ProductUnit[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO product_units(" +
      'id_product_unit,co_product_unit,co_product,id_product,co_unit,' +
      'id_unit,qu_unit,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idProductUnit, obj.coProductUnit,
      obj.coProduct, obj.idProduct, obj.coUnit, obj.idUnit, obj.quUnit,
      obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {

    }).catch(e => {
      console.log(e);
    })
  }

  insertVisitsBatch(arr: Visit[]) {

    var statements = [];
    let insertStatement = "INSERT INTO visits(" +
  'id_visit, co_visit, st_visit, da_visit, coordenada, id_client, co_client,' +
  'na_client, nu_sequence, id_user, co_user, co_enterprise, id_enterprise, da_real,' +
  'da_initial, id_address_client, co_address_client, nu_attachments, has_attachments,' +
  'is_reassigned, tx_reassigned_motive, da_reassign) ' +
  'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ' +
  'ON CONFLICT(co_visit) DO UPDATE SET ' +
  'co_visit=excluded.co_visit, ' +
  'st_visit=CASE WHEN visits.st_visit = 3 THEN excluded.st_visit ELSE visits.st_visit END, ' +
  'da_visit=excluded.da_visit, ' +
  'coordenada=excluded.coordenada, id_client=excluded.id_client, co_client=excluded.co_client, ' +
  'na_client=excluded.na_client, nu_sequence=excluded.nu_sequence, id_user=excluded.id_user, ' +
  'co_user=excluded.co_user, co_enterprise=excluded.co_enterprise, id_enterprise=excluded.id_enterprise, ' +
  'da_real=excluded.da_real, da_initial=excluded.da_initial, id_address_client=excluded.id_address_client, ' +
  'co_address_client=excluded.co_address_client, nu_attachments=excluded.nu_attachments, ' +
  'has_attachments=excluded.has_attachments, is_reassigned=excluded.is_reassigned, ' +
  'tx_reassigned_motive=excluded.tx_reassigned_motive, da_reassign=excluded.da_reassign';
    
    /*"INSERT OR REPLACE INTO visits(" +
      'id_visit, co_visit, st_visit, da_visit, coordenada, id_client, co_client,' +
      'na_client, nu_sequence, id_user, co_user, co_enterprise, id_enterprise, da_real,' +
      'da_initial, id_address_client, co_address_client, nu_attachments, has_attachments,' +
      'is_reassigned, tx_reassigned_motive, da_reassign) ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'*/

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [
        obj.idVisit, obj.coVisit, obj.stVisit, obj.daVisit, obj.coordenada, obj.idClient,
        obj.coClient, obj.naClient, obj.nuSequence, obj.idUser, obj.coUser, obj.coEnterprise,
        obj.idEnterprise, obj.daReal, obj.daInitial, obj.idAddressClient, obj.coAddressClient,
        obj.nuAttachments, obj.hasAttachments, obj.isReassigned, obj.txReassignedMotive, obj.daReassign
      ]]);
    }
    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertIvaBatch(arr: IvaList[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO iva_lists(" +
      'id_iva_list,price_iva,tx_description,default_iva' +
      ') ' +
      'VALUES(?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idIvaList, obj.priceIva,
      obj.txDescripcion, obj.defaultIVA]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertWarehouseBatch(arr: Warehouse[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO warehouses(" +
      'id_warehouse,co_warehouse,na_warehouse,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idWarehouse, obj.coWarehouse, obj.naWarehouse,
      obj.coEnterprise, obj.idEnterprise]]);
    }
    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertGlobalDiscountBatch(arr: GlobalDiscount[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO global_discounts(" +
      'id_global_discount,global_discount,tx_description,default_global_discount' +
      ') ' +
      'VALUES(?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idGlobalDiscount, obj.globalDiscount,
      obj.txDescription, obj.defaultGlobalDiscount]]);
    }
    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertClientBankAccountBatch(arr: ClientBankAccount[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO client_bank_accounts(" +
      'id_client_bank_account,co_client_bank_account,co_bank,id_bank,co_client,' +
      'id_client,nu_account,co_type,co_currency,id_currency,' +
      'co_enterprise,id_enterprise ' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idClientBankAccount, obj.coClientBankAccount,
      obj.coBank, obj.idBank, obj.coClient,
      obj.idClient, obj.nuAccount, obj.coType, obj.coCurrency, obj.idCurrency,
      obj.coEnterprise, obj.idEnterprise]]);
    }
    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertProductMinMulBatch(arr: ProductMinMulFav[]) {
    var statements = [];
    const deleteStatement = 'DELETE FROM product_min_muls WHERE id_product = ? AND id_enterprise = ?';
    let insertStatement = "INSERT OR REPLACE INTO product_min_muls (" +
      'id_product_min_mul,co_product,id_product,qu_minimum,qu_multiple,' +
      'flag,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?)'
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([deleteStatement, [obj.idProduct, obj.idEnterprise]]);
      statements.push([insertStatement, [obj.idProductMinMul, obj.coProduct,
      obj.idProduct, obj.quMinimum, obj.quMultiple,
      ProductMinMulFav.normalizeFlag(obj.flag), obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(() => {
      return this.normalizeProductMinMulLegacyFlags();
    }).then(() => {
      return this.removeDuplicateProductMinMulRows();
    }).catch(e => {
      console.log(e);
    })
  }

  /**
   * REQ-01 · Tabla 84 — delta product_bonus_fav (altas/bajas/modificaciones).
   */
  processProductBonusFavDelta(arr: ProductBonusFav[]) {
    const statements: any[] = [];
    const deleteSql = 'DELETE FROM product_bonus_fav WHERE id_product_bonus_fav = ?';
    const upsertSql =
      'INSERT OR REPLACE INTO product_bonus_fav (' +
      'id_product_bonus_fav, co_product_bonus_fav, id_product, co_product, id_enterprise, co_enterprise, ' +
      'qu_buy, qu_bonus, flag, co_operation, da_update' +
      ') VALUES (?,?,?,?,?,?,?,?,?,?,?)';

    for (let i = 0; i < arr.length; i++) {
      const row = arr[i];
      if (row.coOperation === 'D' || ProductBonusFav.normalizeFlag(row.flag) === 0) {
        statements.push([deleteSql, [row.idProductBonusFav]]);
      } else {
        statements.push([upsertSql, [
          row.idProductBonusFav,
          row.coProductBonusFav,
          row.idProduct,
          row.coProduct,
          row.idEnterprise,
          row.coEnterprise,
          row.quBuy,
          row.quBonus,
          ProductBonusFav.normalizeFlag(row.flag),
          row.coOperation || 'I',
          row.daUpdate
        ]]);
      }
    }

    return this.database.sqlBatch(statements).then(() => undefined).catch((e: any) => {
      console.log(e);
    });
  }

  private removeDuplicateProductMinMulRows(): Promise<void> {
    const dedupeStatement = 'DELETE FROM product_min_muls ' +
      'WHERE id_product_min_mul IN (' +
      'SELECT id_product_min_mul FROM (' +
      'SELECT p1.id_product_min_mul ' +
      'FROM product_min_muls p1 ' +
      'INNER JOIN product_min_muls p2 ' +
      'ON p1.id_product = p2.id_product ' +
      'AND p1.id_enterprise = p2.id_enterprise ' +
      'AND p1.id_product_min_mul < p2.id_product_min_mul' +
      ')' +
      ')';

    return this.database.executeSql(dedupeStatement, []).then(() => undefined);
  }

  private normalizeProductMinMulLegacyFlags(): Promise<void> {
    const normalizeTrue = "UPDATE product_min_muls SET flag = 1 " +
      "WHERE LOWER(CAST(flag AS TEXT)) IN ('true', '1')";
    const normalizeFalse = "UPDATE product_min_muls SET flag = 0 " +
      "WHERE LOWER(CAST(flag AS TEXT)) IN ('false', '0')";

    return this.database.executeSql(normalizeTrue, []).then(() => {
      return this.database.executeSql(normalizeFalse, []);
    }).then(() => undefined);
  }

  insertUserInformationBatch(arr: UserInformation[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO user_informations (" +
      'id_user_information,id_user,co_user,title,content,' +
      'co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idUserInformation, obj.idUser, obj.coUser,
      obj.title, obj.content,
      obj.coEnterprise, obj.idEnterprise]]);
    }
    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertCurrencyEnterpriseBatch(arr: CurrencyEnterprise[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO currency_enterprises  (" +
      'id_currency_enterprise,id_currency,co_currency,local_currency,hard_currency,' +
      'co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idCurrencyEnterprise, obj.idCurrency, obj.coCurrency,
      obj.localCurrency, obj.hardCurrency,
      obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertCurrencyRelationBatch(arr: CurrencyRelation[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO currency_relations  (" +
      'id_currency_relation,co_currency_hard,co_currency_local,nu_exchange_rate,co_enterprise,' +
      'id_enterprise' +

      ') ' +
      'VALUES(?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idCurrencyRelation, obj.coCurrencyHard, obj.coCurrencyLocal,
      obj.nuExchangeRate, obj.coEnterprise,
      obj.idEnterprise]]);
    }
    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertConversionTypesBatch(arr: ConversionType[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO conversion_types  (" +
      'id_conversion_type,co_conversion_type,co_currency_hard,co_currency_local,nu_value_local,' +
      'date_conversion,co_enterprise,id_enterprise, id_conversion' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?)'


    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idConversionType, obj.coConversionType, obj.coCurrencyHard,
      obj.coCurrencyLocal, obj.nuValueLocal,
      obj.dateConversion, obj.coEnterprise, obj.idEnterprise, obj.idConversion]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertTypeProductStructureBatch(arr: TypeProductStructure[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO type_product_structures  (" +
      'id_type_product_structure,type,co_type_product_structure,na_type_product_structure,sco_type_product_structure,' +
      'nu_level,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?)'



    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idTypeProductStructure, obj.type,
      obj.coTypeProductStructure, obj.naTypeProductStructure, obj.scoTypeProductStructure,
      obj.nuLevel, obj.coEnterprise, obj.idEnterprise]]);
    }
    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertProductStructureBatch(arr: ProductStructure[]) {
    let insertStatement = "INSERT OR REPLACE INTO product_structures  (" +
      'id_product_structure,type,co_product_structure,na_product_structure,id_type_product_structure,co_type_product_structure,' +
      'sco_product_structure,sna_product_structure,co_enterprise,id_enterprise, qu_products' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idProductStructure, obj.type, obj.coProductStructure,
      obj.naProductStructure, obj.idTypeProductStructure, obj.coTypeProductStructure,
      obj.scoProductStructure, obj.snaProductStructure, obj.coEnterprise, obj.idEnterprise, obj.quProducts]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertUnitBatch(arr: Unit[]) {
    let inserStatement = "INSERT OR REPLACE INTO units(" +
      'id_unit,co_unit,na_unit,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([inserStatement, [obj.idUnit, obj.coUnit, obj.naUnit, obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertProductStructureCountBatch(arr: ProductStructureCount[]) {
    let insertStatement = "INSERT OR REPLACE INTO product_structure_counts(" +
      'id,id_product_structure,co_product_structure,na_product_structure,qu_products,' +
      'id_type_product_structure,co_type_product_structure,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.id, obj.idProductStructure, obj.coProductStructure,
      obj.naProductStructure, obj.quProducts,
      obj.idTypeProductStructure, obj.coTypeProductStructure, obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertOrderTypeBatch(arr: OrderType[]) {
    let insertStatement = "INSERT OR REPLACE INTO order_types(" +
      'id_order_type,co_order_type,na_order_type,default_value,co_enterprise,items_limit,qu_items,id_iva_list,id_list,co_list' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      const row = obj as OrderType & { id_iva_list?: number | null; id_list?: number | null; co_list?: string | null };
      const idIvaListResolved = row.idIvaList ?? row.id_iva_list ?? null;
      const idListResolved = row.idList ?? row.id_list ?? null;
      const coListResolved = row.coList ?? row.co_list ?? null;
      const itemsLimitRaw = obj.itemsLimit as boolean | number | string | undefined;
      const itemsLimitFlag = itemsLimitRaw === true || itemsLimitRaw === 1 || itemsLimitRaw === '1';
      const defaultValRaw = obj.defaultValue as boolean | number | string | undefined;
      const defaultFlag = defaultValRaw === true || defaultValRaw === 1 || defaultValRaw === '1';
      statements.push([insertStatement, [obj.idOrderType, obj.coOrderType, obj.naOrderType,
      defaultFlag ? 1 : 0, obj.coEnterprise, itemsLimitFlag ? 1 : 0, obj.quItems ?? 0, idIvaListResolved,
      idListResolved, coListResolved]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertUserProductFavBatch(arr: UserProductFav[]) {
    let insertStatement = "INSERT OR REPLACE INTO user_product_favs(" +
      'id_user_product_favs,co_user,id_user,co_product,id_product,' +
      'if_change,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idUserProductFavs, obj.coUser, obj.idUser, obj.coProduct,
      obj.idProduct, obj.ifChange, obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertClientAvgProductBatch(arr: ClientAvgProduct[]) {
    let insertStatement = "INSERT OR REPLACE INTO client_avg_products(" +
      'id_client_avg_product,id_client,co_client,id_product,co_product,' +
      'id_product_unit,co_product_unit,id_address_client,co_address_client,average,' +
      'co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idClientAvgProduct, obj.idClient, obj.coClient,
      obj.idProduct, obj.coProduct,
      obj.idProductUnit, obj.coProductUnit, obj.idAddressClient, obj.coAddressClient, obj.average,
      obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertIgtfBatch(arr: IgtfList[]) {
    let insertStatement = "INSERT OR REPLACE INTO igtf_lists(" +
      'id_igtf,na_igtf,price,descripcion,default_igtf' +
      ') ' +
      'VALUES(?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idIgtf, obj.naIgtf, obj.price, obj.descripcion, obj.defaultIgtf]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertInvoiceBatch(arr: Invoice[]) {
    let insertStatement = "INSERT OR REPLACE INTO invoices(" +
      'id_invoice,co_invoice,co_client,id_client,da_invoice,' +
      'na_responsible,id_user,nu_amount_total, nu_amount_final,co_currency,' +
      'da_dispatch,tx_comment,nu_purchase,co_user,co_payment_condition,' +
      'id_payment_condition,co_address_client,id_address_client,nu_discount,id_currency,' +
      'id_conversion_type,nu_value_local,nu_amount_final_conversion,nu_amount_total_conversion,co_enterprise,' +
      'id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idInvoice, obj.coInvoice, obj.coClient,
      obj.idClient, obj.daInvoice,
      obj.naResponsible, obj.idUser, obj.nuAmountTotal, obj.nuAmountFinal, obj.coCurrency,
      obj.daDispatch, obj.txComment, obj.nuPurchase, obj.coUser, obj.coPaymentCondition,
      obj.idPaymentCondition, obj.coAddressClient, obj.idAddressClient, obj.nuDiscount, obj.idCurrency,
      obj.idConversionType, obj.nuValueLocal, obj.nuAmountFinalConversion,
      obj.nuAmountTotalConversion, obj.coEnterprise,
      obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertInvoiceDetailBatch(arr: InvoiceDetail[]) {
    let insertStatement = "INSERT OR REPLACE INTO invoice_details(" +
      'id_invoice_detail,co_invoice_detail,co_invoice,id_invoice,co_product,' +
      'id_product,nu_amount_total,co_warehouse,id_warehouse,iva,' +
      'nu_discount_total,co_discount,id_discount,co_price_list,id_price_list,' +
      'co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idInvoiceDetail, obj.coInvoiceDetail, obj.coInvoice,
      obj.idInvoice, obj.coProduct,
      obj.idProduct, obj.nuAmountTotal, obj.coWarehouse, obj.idWarehouse, obj.iva,
      obj.nuDiscountTotal, obj.coDiscount, obj.idDiscount, obj.coPriceList, obj.idPriceList,
      obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertInvoiceDetailUnitBatch(arr: InvoiceDetailUnit[]) {
    let insertStatement = "INSERT OR REPLACE INTO invoice_detail_units(" +
      'id_invoice_detail_unit,co_invoice_detail_unit,co_invoice_detail,id_invoice_detail,co_product_unit,' +
      'id_product_unit,qu_invoice,co_enterprise,id_enterprise' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?)'

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idInvoiceDetailUnit, obj.coInvoiceDetailUnit,
      obj.coInvoiceDetail, obj.idInvoiceDetail, obj.coProductUnit,
      obj.idProductUnit, obj.quInvoice, obj.coEnterprise, obj.idEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertClientChannelOrderTypeBatch(arr: ClientChannelOrderType[]) {
    let insertStatement = 'INSERT OR REPLACE INTO client_channel_order_type (' +
      'id_client_channel_order_type, co_client_channel_order_type, id_client,' +
      'co_client, id_distribution_channel, co_distribution_channel,' +
      'id_order_type, co_order_type, id_enterprise,' +
      'co_enterprise' +
      ') VALUES (' +
      '?,?,?,?,?,?,?,?,?,?)';

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idClientChannelOrderType, obj.coClientChannelOrderType,
      obj.idClient, obj.coClient, obj.idDistributionChannel, obj.coDistributionChannel, obj.idOrderType,
      obj.coOrderType, obj.idEnterprise, obj.coEnterprise]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertOrderTypeProductStructureBatch(arr: OrderTypeProductStructure[]) {
    let insertStatement = 'INSERT OR REPLACE INTO order_type_product_structure (' +
      'id_order_type_product_structure,' +
      'co_order_type_product_structure,' +
      'id_order_type,' +
      'co_order_type,' +
      'id_product_structure,' +
      'co_product_structure,' +
      'id_enterprise,' +
      'co_enterprise' +
      ') VALUES (' +
      '?,?,?,?,?,?,?,?)';

    var statements = [];
    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idOrderTypeProductStructure, obj.coOrderTypeProductStructure, obj.idOrderType,
      obj.coOrderType, obj.idProductStructure, obj.coProductStructure, obj.idEnterprise, obj.coEnterprise
      ]]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // console.log(res);
    }).catch(e => {
      console.log(e);
    })
  }

  insertTransactionStatusesBatch(arr: TransactionStatuses[]) {
    var statements = [];
    this.collectionService.listTransactionStatusCollections = [] as TransactionStatuses[]; // LIMPIO LA LISTA ANTES DE CARGAR NUEVOS DATOS
    let insertStatement = "INSERT OR REPLACE INTO transaction_statuses(" +
      "id_transaction_status, da_transaction_statuses,id_transaction_type," +
      "co_transaction_type,co_transaction,id_transaction," +
      "id_status,co_status, tx_comment" +
      ") " +
      "VALUES(?,?,?,?,?,?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idTransactionStatus, arr[i].daTransactionStatuses,
      arr[i].idTransactionType, arr[i].coTransactionType, arr[i].coTransaction, arr[i].idTransaction,
      arr[i].idStatus, arr[i].coStatus, arr[i].txComment]])
      if (arr[i].idTransactionType === 3) {
        //GUARDO LA LISTA DE  COBROS PARA CHEQUEAR SI VIENEN RECHAZADOS
        //Y ACTUALIZAR LOS DOCUMENTOS DE ESE COBRO
        this.collectionService.listTransactionStatusCollections.push(arr[i]);
      }
    }

    return this.database.sqlBatch(statements).then(res => {
      console.log("insert transactionStatuses ready")
      this.collectionService.checkRequireApproval(this.database).then((res) => {
        if (res)
          this.collectionService.checkHistoricCollects(this.database).then(() => {
            console.log("checkHistoricCollects process finished");
            this.collectionService.unlockDocumentSales(this.database);
            this.collectionService.lockDocumentSales(this.database);
          });
      })
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertTransactionTypesBatch(arr: TransactionTypes[]) {

    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO transaction_types(" +
      "id_transaction_type,co_transaction_type,na_transaction_type,require_approval " +
      ") " +
      "VALUES(?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idTransactionType,
      arr[i].coTransactionType, arr[i].naTransactionType, arr[i].requireApproval]])
    }

    return this.database.sqlBatch(statements).then(res => {
      console.log("insert TransactionTypes ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertStatusesBatch(arr: Statuses[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO statuses(" +
      "id_status, co_status, na_status, status_action" +
      ") " +
      "VALUES(?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idStatus, arr[i].coStatus, arr[i].naStatus, arr[i].statusAction]])
    }

    return this.database.sqlBatch(statements).then(res => {
      console.log("insert Statuses ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertOrderBatch(arr: Orders[]) {
    return this.pedidosService.saveOrderBatch(this.database, arr)
  }

  insertOrderDetailBatch(arr: OrderDetail[]) {
    return this.pedidosService.saveOrderDetailBatch(this.database, arr)
  }
  insertOrderDetailUnitBatch(arr: OrderDetailUnit[]) {
    return this.pedidosService.saveOrderDetailUnitBatch(this.database, arr)
  }
  insertOrderDetailDiscountBatch(arr: OrderDetailDiscount[]) {
    return this.pedidosService.saveOrderDetailDiscountBatch(this.database, arr)
  }

  insertCollectionBatch(arr: Collection[]) {
    return this.collectionService.deleteCollectionsBatch(this.database, arr).then((r) => {
      console.log("deleteCollectionsBatch completed before insertCollectionBatch");
      return this.collectionService.saveCollectionBatch(this.database, arr);
    })

  }
  insertReturnBatch(arr: Return[]) {
    return this.returnService.mergeSyncedReturnsWithLocalDates(this.database, arr).then(mergedReturns => {
      return this.returnService.deleteReturnsBatch(this.database, mergedReturns).then(() => {
        return this.returnService.saveReturnBatch(this.database, mergedReturns);
      });
    });
  }

  insertClientStockBatch(arr: ClientStocks[]) {
    return this.clientStockService.deleteClientStocksBatch(this.database, arr).then((r) => {
      return this.clientStockService.saveClientStockBatch(this.database, arr);
    })
  }

  insertDepositBatch(arr: Deposit[]) {
    return this.depositService.mergeSyncedDepositsWithLocal(this.database, arr).then((merged) => {
      return this.depositService.saveDepositBatch(this.database, merged);
    });
  }

  deleteDepositRowsSafely(ids: number[]) {
    return this.depositService.filterAndDeleteDepositsByServerIds(this.database, ids);
  }

  deleteDataTable(arr: number[], nameTable: string, nameId: string) {
    let deleteStatement = "DELETE FROM " + nameTable + " WHERE " + nameId + " IN (" + arr + ")";
    this.database.executeSql(
      deleteStatement, []).then(res => {
        console.log("borrado exitoso " + nameTable)
      }).catch(e => {
        console.log(e);
      })
  }

  getStatusTranssacion(db: SQLiteObject, status: number, transaccionName: string) {
    let query = "SELECT o.id_order, st.na_status FROM transaction_statuses ts " +
      "JOIN orders o ON ts.id_transaction = o.id_order AND ts.co_transaction_type = ? " +
      "JOIN statuses st ON ts.id_status = st.id_status WHERE o.id_order = ? " +
      "ORDER BY ts.da_transaction_statuses limit 1";

    return db.executeSql(query, [status, transaccionName]).then(data => {
      let naStatus: string = "";
      naStatus = data.rows.length > 0 ? data.rows.item(0).na_status : "";
      return naStatus;
    });
  }

  insertConversionBatch(arr: Conversion[]) {
    var statements: any[] = [];
    let insertStatement = "INSERT OR REPLACE INTO conversion (id_conversion, co_conversion, na_conversion, primary_currency, id_enterprise) VALUES(?,?,?,?,?)";

    for (var i = 0; i < arr.length; i++) {
      const item = arr[i] || {} as any;
      statements.push([
        insertStatement,
        [
          item.idConversion ?? null,
          item.coConversion ?? null,
          item.naConversion ?? null,
          item.primaryCurrency ? 1 : 0,
          item.idEnterprise ?? null
        ]
      ]);
    }

    return this.database.sqlBatch(statements).then(res => {
      // opcional: puedes agregar lógica adicional aquí si hace falta
    }).catch(e => {
      console.log('insertConversionBatch error', e);
    });
  }
  insertModulesBatch(arr: Modules[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO modules(" +
      "id_module, co_module ,na_module" +
      ") " +
      "VALUES(?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idModule, arr[i].coModule, arr[i].naModule]])
    }

    return this.database.sqlBatch(statements).then(res => {
      console.log("insert currency_modules ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertCurrencyModulesBatch(arr: CurrencyModules[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO currency_modules(" +
      "id_currency_module, id_module ,local_currency_default, show_conversion, currency_selector" +
      ") " +
      "VALUES(?,?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idCurrencyModules, arr[i].idModule, arr[i].localCurrencyDefault, arr[i].showConversion, arr[i].currencySelector]])
    }

    return this.database.sqlBatch(statements).then(res => {
      console.log("insert modules ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertDifferenceCodesBatch(arr: DifferenceCode[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO difference_codes(" +
      "id_difference_code, co_difference_code ,na_difference_code, tx_description" +
      ") " +
      "VALUES(?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idDifferenceCode, arr[i].coDifferenceCode, arr[i].naDifferenceCode, arr[i].txDescription]])
    }

    return this.database.sqlBatch(statements).then(res => {
      console.log("insert DifferenceCode ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertCollectDiscountsBatch(arr: CollectDiscounts[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO collect_discounts(" +
      "id_collect_discount, nu_collect_discount, na_collect_discount, require_input, id_enterprise" +
      ") " +
      "VALUES(?,?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      const row = arr[i] as CollectDiscounts & { id_enterprise?: number };
      const idEnterpriseResolved =
        row.idEnterprise ?? row.id_enterprise ?? null;
      statements.push([insertStatement, [row.idCollectDiscount,
      row.nuCollectDiscount, row.naCollectDiscount, row.requireInput,
      idEnterpriseResolved]
      ])
    }
    return this.database.sqlBatch(statements).then(res => {
      console.log("insert collect_discounts ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertStraightSwapBatch(arr: StraightSwap[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO straight_swap(" +
      "id_swap, co_swap, id_client, co_client, id_address_client, co_address_client, id_enterprise, co_enterprise, id_product, co_product, id_product_unit, co_product_unit, id_unit, co_unit, da_cambio, qu_swap" +
      ") " +
      "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idSwap, arr[i].coSwap, arr[i].idClient, arr[i].coClient, arr[i].idAddressClient, arr[i].coAddressClient, arr[i].idEnterprise, arr[i].coEnterprise, arr[i].idProduct, arr[i].coProduct, arr[i].idProductUnit, arr[i].coProductUnit, arr[i].idUnit, arr[i].coUnit, arr[i].daCambio, arr[i].quSwap]])
    }

    return this.database.sqlBatch(statements).then(res => {
      console.log("insert straight_swap ready")
            return res;
    }).catch(e => {
      console.log(e);
    })
  }
  insertTypeDocumentBatch(arr: TypeDocument[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO type_document(" +
      "id_type_document, co_type_document, na_type_document" +
      ") " +
      "VALUES(?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idTypeDocument,
      arr[i].coTypeDocument, arr[i].naTypeDocument]
      ])
    }
    return this.database.sqlBatch(statements).then(res => {
      console.log("insert type_document ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertReturnCategoryBatch(arr: ReturnCategory[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO return_category(" +
      "id_return_category, na_return_category ,add_suggestion, subtract_suggestion" +
      ") " +
      "VALUES(?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idReturnCategory, arr[i].naReturnCategory, arr[i].addSuggestion, arr[i].subtractSuggestion]])
    }

    return this.database.sqlBatch(statements).then(res => {
      console.log("insert return_category ready")
            return res;
    }).catch(e => {
      console.log(e);
    })
  }
  insertCodePhoneNumberBatch(arr: CodePhoneNumber[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO code_phone_number(" +
      "id_code_phone_number, co_code_phone_number, na_code_phone_number" +
      ") " +
      "VALUES(?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idCodePhoneNumber,
      arr[i].coCodePhoneNumber, arr[i].naCodePhoneNumber]
      ])
    }
    return this.database.sqlBatch(statements).then(res => {
      console.log("insert code_phone_number ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertUnitPriceListBatch(arr: UnitPriceList[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO unit_pricelist(" +
      "id_unit_pricelist, co_unit_pricelist, id_unit, co_unit, id_list, co_list, co_enterprise, id_enterprise" +
      ") " +
      "VALUES(?,?,?,?,?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      statements.push([insertStatement, [arr[i].idUnitPriceList,
      arr[i].coUnitPriceList, arr[i].idUnit, arr[i].coUnit, arr[i].idList,
      arr[i].coList, arr[i].coEnterprise, arr[i].idEnterprise]
      ])
    }
    return this.database.sqlBatch(statements).then(res => {
      console.log("insert unit_pricelist ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }

  insertCollectRetentionsBatch(arr: CollectRetentions[]) {
    var statements = [];
    let insertStatement = "INSERT OR REPLACE INTO collect_retentions(" +
      "id_collect_retention, co_collect_retention, na_collect_retention, require_input, nu_voucher_length, id_enterprise" +
      ") " +
      "VALUES(?,?,?,?,?,?)"

    for (var i = 0; i < arr.length; i++) {
      const row = arr[i] as CollectRetentions & { id_enterprise?: number };
      const idEnterpriseResolved =
        row.idEnterprise ?? row.id_enterprise ?? null;
      statements.push([insertStatement, [row.idCollectRetention,
      row.coCollectRetention, row.naCollectRetention, row.requireInput,
      row.nuVoucherLength ?? 0,
      idEnterpriseResolved]
      ])
    }
    return this.database.sqlBatch(statements).then(res => {
      console.log("insert collect_retentions ready")
      return res;
    }).catch(e => {
      console.log(e);
    })
  }
}
