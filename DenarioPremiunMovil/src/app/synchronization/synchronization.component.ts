import { Component, OnInit, inject } from '@angular/core';
import { NavController, Platform } from '@ionic/angular';
import { of, Observable, Subscription, from } from 'rxjs';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { ServicesService } from '../services/services.service';
import { TablesLastUpdate } from '../modelos/tables/tables-lastUpdate';
import { syncResponse } from '../modelos/tables/getSyncResponse';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from '../services/messageService/message.service';
import { HttpClient } from '@angular/common/http';
import createTables from 'src/assets/database/createTables.json';
import { ImageServicesService } from '../services/imageServices/image-services.service';
import { MessageAlert } from '../modelos/tables/messageAlert';
import { StraightSwap } from '../modelos/tables/straightSwap';
import { PedidosService } from '../pedidos/pedidos.service';
import { AutoSendService } from '../services/autoSend/auto-send.service';

const TABLAS_CATALOGO = [8, 13, 15, 23, 25, 29, 32, 34, 35, 37, 39, 42, 43, 44, 46, 48, 50, 51, 53, 54, 59, 60, 72, 74, 81, 84];

@Component({
  selector: 'app-synchronization',
  templateUrl: './synchronization.component.html',
  styleUrls: ['./synchronization.component.scss'],
  standalone: false
})
export class SynchronizationComponent implements OnInit {
  // --- PROPIEDADES PÚBLICAS Y DE INYECCIÓN ---
  public globalConfig = inject(GlobalConfigService);
  public synchronizationServices = inject(SynchronizationDBService)
  private services = inject(ServicesService);
  private pedidosService = inject(PedidosService);
  private message = inject(MessageService);
  private imageServices = inject(ImageServicesService);
  private autoSend = inject(AutoSendService);

  public messageAlert!: MessageAlert;
  private sqlTableMap: Record<string, { table: string, id: string, idName: string }> = {};
  private sqlTableMapById: Record<number, { table: string, id: string, idName: string }> = {};
  private tableKeyOrder: number[] = []; // Orden de sincronización de tablas
  private selectedTableIds: number[] | null = null;

  private N = 0;
  private PROGRESS = 0;
  private BUFF = 0;

  public buffer = 0;
  public progress = 0;
  public tableVersion!: Observable<any[]>;
  public values!: (string | string)[];
  public tables = {} as TablesLastUpdate;
  public tabla = {} as TablesLastUpdate;
  public pruebaObservable = new Observable;
  public currentPage = 0;

  public valor = 0;
  public tags = new Map<string, string>([]);

  public sub!: object;
  public id!: string;
  public alertMessageOpenSend: Boolean = false;
  public currentTableIndex = 0; // Índice para recorrer las tablas a sincronizar
  public user: any = {};

  backButtonSubscription: Subscription = this.platform.backButton.subscribeWithPriority(1, () => {
    //console.log('backButton was called!');
    //de aqui no te vas
  });

  // Botones para alertas (puedes personalizar los textos)
  public alertButtons = [
    {
      text: '',
      role: 'cancel'
    },
    {
      text: '',
      role: 'confirm'
    },
  ];

  /**
   * Mapeo de IDs de tabla a claves de configuración.
   * Permite saber qué tabla corresponde a cada ID recibido.
   */
  private tableKeyMap: Record<number, keyof typeof this.insertConfig> = {
    1: 'address_clients',
    2: 'banks',
    3: 'clients',
    5: 'distribution_channels',
    6: 'document_sales',
    7: 'document_sale_types',
    8: 'enterprises',
    9: 'incidence_motives',
    10: 'incidence_types',
    13: 'price_lists',
    15: 'products',
    16: 'return_motives',
    17: 'return_types',
    20: 'bank_accounts',
    23: 'lists',
    25: 'stocks',
    29: 'discounts',
    31: 'payment_conditions',
    32: 'product_units',
    33: 'visits',
    34: 'iva_lists',
    35: 'warehouses',
    37: 'global_discounts',
    38: 'client_bank_accounts',
    39: 'product_min_muls',
    40: 'user_informations',
    42: 'currency_enterprises',
    43: 'currency_relations',
    44: 'conversion_types',
    46: 'type_product_structures',
    48: 'product_structures',
    50: 'units',/*
    51: 'product_structure_counts', */
    52: 'order_types',
    53: 'user_product_favs',
    54: 'client_avg_products',
    55: 'igtf_lists',
    56: 'invoices',
    57: 'invoice_details',
    58: 'invoice_detail_units',
    59: 'client_channel_order_type',
    60: 'order_type_product_structure',
    61: 'statuses',
    62: 'transaction_types',
    63: 'transaction_statuses',
    64: 'orders',
    65: 'collections',
    66: 'returns',
    67: 'client_stocks',
    68: 'deposits',
    69: 'orderDetails',
    70: 'orderDetailUnits',
    71: 'orderDetailDiscounts',
    72: 'conversion',
    73: 'modules',
    74: 'currencyModules',
    75: 'differenceCodes',
    76: 'collectDiscounts',
    77: 'straight_swap',
    78: 'return_category',
    79: 'typeDocument',
    80: 'codePhoneNumber',
    81: 'unit_pricelist',
    83: 'collectRetention',
    84: 'product_bonus_fav',
  };

  /**
   * Mapeo de claves de tabla a nombres amigables para mostrar en la UI.
   */
  private tableLabelMap: Record<string, string> = {
    address_clients: 'Dirección de Clientes',
    banks: 'Bancos',
    clients: 'Clientes',
    distribution_channels: 'Canal de Distribución',
    document_sales: 'Documento de Venta',
    document_sale_types: 'Tipo de Documento de Venta',
    enterprises: 'Empresas',
    incidence_motives: 'Motivos de Incidencia',
    incidence_types: 'Tipos de Incidencia',
    price_lists: 'Listas de Precios',
    products: 'Productos',
    return_motives: 'Motivo de Devolución',
    return_types: 'Tipo de Devolución',
    bank_accounts: 'Cuentas Bancarias',
    lists: 'Listas',
    stocks: 'Inventario',
    discounts: 'Descuentos',
    payment_conditions: 'Condiciones de Pago',
    product_units: 'Unidades de Producto',
    visits: 'Visitas',
    units: "Unidades",
    iva_lists: 'IVA',
    warehouses: 'Almacén',
    global_discounts: 'Descuento Global',
    client_bank_accounts: 'Cuenta Bancaria de Cliente',
    product_min_muls: 'Mínimos y Múltiplos de Producto',
    user_informations: 'Información de Usuario',
    currency_enterprises: 'Moneda de Empresa',
    currency_relations: 'Relación de Moneda',
    conversion_types: 'Tipo de Conversión',
    type_product_structures: 'Tipo de Estructura de Producto',
    product_structures: 'Estructura de Producto',
    product_structure_counts: 'Conteo de Estructura de Producto',
    order_types: 'Tipo de Pedido',
    user_product_favs: 'Favoritos de Usuario',
    client_avg_products: 'Promedio de Cliente',
    igtf_lists: 'IGTF',
    invoices: 'Facturas',
    invoice_details: 'Detalles de Factura',
    invoice_detail_units: 'Unidades de Detalle de Factura',
    client_channel_order_type: 'Tipos de Pedido por Canal de Cliente',
    order_type_product_structure: 'Tipo de Pedido por Estructura de Producto',
    transaction_types: 'Tipos de Transacción',
    statuses: 'Estados',
    transaction_statuses: 'Estados de Transacción',
    orders: 'Pedidos',
    collections: 'Cobros',
    returns: 'Devoluciones',
    client_stocks: 'Inventarios',
    deposits: 'Depositos',
    orderDetails: 'Detalles de Pedido',
    orderDetailUnits: 'Unidades de Detalle de Pedido',
    orderDetailDiscounts: 'Descuentos de Detalle de Pedido',
    conversion: 'Tasas de Conversión',
    modules: 'Módulos',
    currencyModules: 'Monedas Módulos',
    differenceCodes: 'Códigos de Diferencia',
    collectDiscounts: 'Descuentos de Cobro',
    straight_swap: 'Cambio Por Cambio',
    return_category: 'Categoría de Devolución',
    typeDocument: 'Tipo de Documento',
    codePhoneNumber: 'Código de Número Telefónico',
    unit_pricelist: 'Lista de Precio por Unidad',
    collectRetention: 'Tipos de Retención',
    product_bonus_fav: 'Bonificaciones de Producto',
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private platform: Platform,
  ) {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);

      } catch (e) {
        this.user = {};
      }
    }
  }

  /**
   * Inicializa el componente, obtiene el orden de tablas y gestiona la navegación.
   */
  ngOnInit() {
    this.generateSqlTableMap();
    this.message.hideLoading();

    this.tableKeyOrder = Object.keys(this.tableKeyMap)
      .map(Number)
      .sort((a, b) => a - b);
    this.currentTableIndex = 0;
    if (localStorage.getItem("connectionType") == "wifi" || localStorage.getItem("connectionType") == "cellular") {
      //HAY CONEXION
      this.generateSqlTableMap();
      this.N = Object.keys(this.tableKeyMap).length;
      this.PROGRESS = 1 / this.N;
      this.BUFF = 1 / this.N;

      this.message.hideLoading();
      this.tableKeyOrder = Object.keys(this.tableKeyMap)
        .map(Number)
        .sort((a, b) => a - b);
      this.currentTableIndex = 0;

      //con esta funcion definimos que tabla se sincroniza primero
      this.adjustTableOrderDependency(63, 68); //queremos que la tabla 63 se sincronice desues que la 68

      this.applyTableFilters();

      this.sub = this.route.params.subscribe(
        params => {
          this.id = params['sincronizar'];
        })
      if (this.id == 'sincronizar') {
        // Mostrar modal para preguntar si quiere sincronizar
        this.alertMessageOpenSend = true;
      } else {
        this.sincronice();
      }
    } else {
      this.messageAlert = new MessageAlert(
        "Denario Premium",
        "No hay conexión a internet, por favor conectese a una red Wifi o señal de datos para sincronizar."
      );
      this.message.alertModal(this.messageAlert);
    }
  }

  private applyTableFilters() {
    const tablesParam = this.route.snapshot.queryParamMap.get('tables');
    if (tablesParam) {
      this.selectedTableIds = tablesParam
        .split(',')
        .map(x => Number(x.trim()))
        .filter(x => !Number.isNaN(x));
    }

    if (this.selectedTableIds?.length) {
      this.tableKeyOrder = this.tableKeyOrder.filter(id => this.selectedTableIds!.includes(id));
    }

    if (this.user.transportista) {
      const tablasTransportista = [1, 3, 5, 8, 9, 10, 15, 23, 32, 33, 42, 43, 44, 46, 48, 50];
      this.tableKeyOrder = this.tableKeyOrder.filter(id => tablasTransportista.includes(id));
    }

    if (this.user.catalogo) {
      this.tableKeyOrder = this.tableKeyOrder.filter(id => TABLAS_CATALOGO.includes(id));
    }

    this.recomputeProgressStep();
  }

  private recomputeProgressStep() {
    this.N = Math.max(this.tableKeyOrder.length, 1);
    this.PROGRESS = 1 / this.N;
    this.BUFF = 1 / this.N;
  }

  /**
 * Mueve el `dependentId` para que quede inmediatamente después de `afterId`
 * dentro de `this.tableKeyOrder`, si ambos existen.
 * No modifica la lista si alguno no está presente.
 */
  private adjustTableOrderDependency(dependentId: number, afterId: number): void {
    if (!Array.isArray(this.tableKeyOrder) || this.tableKeyOrder.length === 0) return;

    const depIndex = this.tableKeyOrder.indexOf(dependentId);
    const afterIndex = this.tableKeyOrder.indexOf(afterId);

    // Si alguno no existe o ya está después, no hacemos nada
    if (depIndex === -1 || afterIndex === -1) return;
    if (depIndex > afterIndex) return; // ya está después

    // Remover el elemento dependentId de su posición actual
    this.tableKeyOrder.splice(depIndex, 1);

    // Recalcular afterIndex en caso de que la remoción afecte índices
    const newAfterIndex = this.tableKeyOrder.indexOf(afterId);
    const insertPos = newAfterIndex === -1 ? this.tableKeyOrder.length : newAfterIndex + 1;

    // Insertar dependentId después de afterId
    this.tableKeyOrder.splice(insertPos, 0, dependentId);
  }

  ngOnDestroy(): void {
    // Unsubscribe from route params
    //this.sub.unsubscribe(); // not fucking with this.
    // Unsubscribe from back button event
    this.backButtonSubscription.unsubscribe();
  }

  /**
 * Borra filas de una tabla local según los IDs recibidos.
 * @param deletedRowsIds IDs de filas a borrar
 * @param tableName Nombre de la tabla SQL
 * @param idField Campo identificador de la tabla
 */

  /**
 * Genera el mapeo sqlTableMap automáticamente desde createTables.json
 * Asume que cada objeto tiene: { key: string, name: string, id: string, idName: string }
 */
  private generateSqlTableMap() {
    for (const table of createTables) {
      const sqlInfo = {
        table: table.name,
        id: String(table.id),
        idName: table.idName
      };
      this.sqlTableMap[String(table.name)] = sqlInfo;
      if (table.id != null) {
        this.sqlTableMapById[Number(table.id)] = sqlInfo;
      }
    }
  }

  private resolveTableLastUpdate(tableKey: keyof TablesLastUpdate): string {
    const stored = this.tables[tableKey];
    if (typeof stored === 'string' && stored.trim() !== '') {
      return stored;
    }
    return '1970-01-01 00:00:00.000';
  }

  private persistTableLastUpdate(tableKey: keyof TablesLastUpdate, updateTime: string): void {
    if (typeof updateTime === 'string' && updateTime.trim() !== '') {
      (this.tables as Record<string, string>)[tableKey as string] = updateTime;
    }
  }

  /**
   * Inicia la sincronización de tablas y carga los tags.
   */
  async sincronice(): Promise<void> {
    await this.autoSend.runPendingQueue();
    this.getTablesVersion();
    this.initProgress(this.PROGRESS, this.BUFF);
    // Carga tags para la UI
    this.services.getTags(this.synchronizationServices.getDatabase(), "HOME", "ESP").then(result => {
      for (var i = 0; i < result.length; i++) {
        this.services.tags.set(
          result[i].coApplicationTag, result[i].tag
        )
      }
    });

    this.services.getTags(this.synchronizationServices.getDatabase(), "DEN", "ESP").then(result => {
      for (var i = 0; i < result.length; i++) {
        this.services.tags.set(
          result[i].coApplicationTag, result[i].tag
        )
      }
    })
  }

  /**
   * Obtiene la versión de cada tabla y actualiza el objeto `tables` con la última actualización.
   */
  getTablesVersion() {
    return this.synchronizationServices.getTablesVersion().then((result) => {
      for (var i in result) {
        switch (result[i].id_table) {
          case 1: {
            this.tables.addressClientTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 2: {
            this.tables.bankTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 3: {
            this.tables.clientTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 5: {
            this.tables.distributionChannelTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 6: {
            this.tables.documentSaleTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 7: {
            this.tables.documentSaleTypeTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 8: {
            this.tables.enterpriseTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 9: {
            this.tables.incidenceMotiveTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 10: {
            this.tables.incidenceTypeTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 13: {
            this.tables.priceListTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 15: {
            this.tables.productTableLastUpdate = result[i].last_update;
            this.tables.page = 0;

            break;
          }
          case 16: {
            this.tables.returnMotiveTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 17: {
            this.tables.returnTypeTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 20: {
            this.tables.bankAccountTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 23: {
            this.tables.listTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 25: {
            this.tables.stockTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 29: {
            this.tables.discountTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 31: {
            this.tables.paymentConditionTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 32: {
            this.tables.productUnitTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 33: {
            this.tables.visitTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 34: {
            this.tables.ivaListTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 35: {
            this.tables.warehouseTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 37: {
            this.tables.globalDiscountTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 38: {
            this.tables.clientBankAccountTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 39: {
            this.tables.productMinMulFavTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 40: {
            this.tables.userInformationTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 42: {
            this.tables.currencyEnterpriseTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 43: {
            this.tables.currencyRelationTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 44: {
            this.tables.conversionTypeTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 46: {
            this.tables.typeProductStructureTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 48: {
            this.tables.productStructureTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 50: {
            this.tables.unitTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          /* case 51: {
            this.tables.productStructureCountTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          } */
          case 52: {
            this.tables.orderTypeTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 53: {
            this.tables.userProductFavTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 54: {
            this.tables.clientAvgProductTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 55: {
            this.tables.igtfListTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 56: {
            this.tables.invoiceTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 57: {
            this.tables.invoiceDetailTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 58: {
            this.tables.invoiceDetailUnitTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 59: {
            this.tables.clientChannelOrderTypeTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 60: {
            this.tables.orderTypeProductStructureTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }

          case 61: {
            this.tables.statusTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }

          case 62: {
            this.tables.transactionTypeTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }

          case 63: {
            this.tables.transactionStatusTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }

          case 64: {
            this.tables.orderTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 65: {
            this.tables.collectionTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 66: {
            this.tables.returnTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 67: {
            this.tables.clientStockTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 68: {
            this.tables.depositTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 69: {
            this.tables.orderDetailTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 70: {
            this.tables.orderDetailUnitTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 71: {
            this.tables.orderDetailDiscountTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 72: {
            this.tables.conversionTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 73: {
            this.tables.moduleTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 74: {
            this.tables.currencyModuleTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 75: {
            this.tables.differenceCodeTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 76: {
            this.tables.collectDiscountTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 77: {
            this.tables.straightSwapTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }

          case 78: {
            this.tables.returnCategoryTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 79: {
            this.tables.typeDocumentTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 80: {
            this.tables.codePhoneNumberTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 81: {
            this.tables.unitPriceListTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 83: {
            this.tables.collectRetentionTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }
          case 84: {
            this.tables.bonusTableLastUpdate = result[i].last_update;
            this.tables.page = 0;
            break;
          }

          default: {
            //statements;
            break;
          }
        }
      }
      // Inicia la sincronización de datos
      this.syncronice(this.tables)
    });
  }

  /**
   * Llama al proceso de sincronización de tablas.
   */
  syncronice(table: TablesLastUpdate) {
    Object.getOwnPropertyNames(table);
    Object.values(table);
    this.syncNextTable(table);
  }

  /**
   * Sincroniza la siguiente tabla según el índice actual.
   * Incluye validaciones especiales para saltar tablas según configuración global.
   */
  syncNextTable(table: TablesLastUpdate) {
    const promesa = new Promise<string>((resolve, reject) => {
      if (this.currentTableIndex == this.tableKeyOrder.length) {
        // Terminaste todas las tablas
        // 1. Obtén la lista de imágenes del servidor

        if (this.user.transportista) {
          this.router.navigate(['home']);
          return;
        } else {
          this.imageServices.getServerImageList().then(obs => {
            obs.subscribe({
              complete: () => {
                this.router.navigate(['home']).then(() => {
                  this.imageServices.downloadWithConcurrency(this.imageServices.downloadFileList);
                });
              }
            });
          });
          return;
        }
      }

      // Filtra las tablas si el usuario es transportista
      if (this.user.transportista) {
        const tablasTransportista = [1, 3, 5, 8, 9, 10, 15, 23, 32, 33, 42, 43, 44, 46, 48, 50]; // ejemplo, ajusta según tu lógica
        this.tableKeyOrder = this.tableKeyOrder.filter(id => tablasTransportista.includes(id));
        this.N = Object.keys(this.tableKeyMap).length;
        this.PROGRESS = 1 / this.N;
        this.BUFF = 1 / this.N;
      }

      ///DEFINIR QUE TABLAS LLEVA EL ROL CLIENTE
      if (this.user.cliente) {
        const tablasCliente = [1, 3, 5, 7, 8, 13, 15, 23, 25, 32, 34, 35, 37, 39, 42, 43, 44, 46, 50, 52, 53, 54, 55, 60, 61, 62, 63, 64, 69, 70, 71, 72, 72, 74, 81]; // ejemplo, ajusta según tu lógica
        this.tableKeyOrder = this.tableKeyOrder.filter(id => tablasCliente.includes(id));
        this.N = Object.keys(this.tableKeyMap).length;
        this.PROGRESS = 1 / this.N;
        this.BUFF = 1 / this.N;
      }

      ///DEFINIR QUE TABLAS LLEVA EL ROL CATALOGO
      if (this.user.catalogo) {
        this.tableKeyOrder = this.tableKeyOrder.filter(id => TABLAS_CATALOGO.includes(id));
        this.N = Object.keys(this.tableKeyMap).length;
        this.PROGRESS = 1 / this.N;
        this.BUFF = 1 / this.N;
      }

      const tableId = this.tableKeyOrder[this.currentTableIndex];
      const key = this.tableKeyMap[tableId];

      // -- Aquí esperamos el resultado de shouldSyncTable, sea síncrono o asíncrono --
      Promise.resolve(this.shouldSyncTable(tableId))
        .then((shouldSync) => {
          if (!shouldSync) {
            // Si NO se debe sincronizar, simplemente avanza a la siguiente tabla
            this.currentTableIndex++;
            this.syncNextTable(table);
            return;
          }

          // -------------------------------------------------------------
          const rowKey = this.insertConfig[key].rowKey;
          const tableLastUpdateKey = this.insertConfig[key].tableKey;

          let tabla = {
            [tableLastUpdateKey]: this.resolveTableLastUpdate(tableLastUpdateKey as keyof TablesLastUpdate),
            page: table.page
          };

          // Muestra el nombre amigable de la tabla que se está sincronizando
          this.synchronizationServices.tablaSincronizando = `- ${this.tableLabelMap[key] || key}`;

          from(this.services.getSync(JSON.stringify(tabla))).subscribe({
            next: (result) => {
              const resTable = (result.data as any)[rowKey];
              const sqlInfo = this.sqlTableMapById[tableId];

              if (!resTable) {
                console.error(`[sync] No se recibió data para la tabla con key=${key} (tableId=${tableId})`);
              }

              // 1. Borra filas si corresponde
              if (resTable.deletedRowsIds != null && sqlInfo) {
                this.handleDeletedRows(resTable.deletedRowsIds, sqlInfo.table, sqlInfo.idName);
              }

              // 2. Si no hay páginas, solo actualiza versión y avanza
              if (resTable.numberOfPages == 0) {
                this.synchronizationServices.updateVersionsTables(resTable.updateTime, Number(resTable.id)).then(() => {
                  this.persistTableLastUpdate(tableLastUpdateKey as keyof TablesLastUpdate, resTable.updateTime);
                  this.initProgress(this.PROGRESS, this.BUFF);
                  this.notifyProductMinMulSynced(key);

                  table.page = 0;
                  resolve(rowKey);
                });
              } else if (resTable.row != null) {
                // 3. Si hay datos, inserta y sigue
                this.insertTable(key, result.data).then(response => {
                  if (response) {
                    this.syncNextTable(response);
                  } else if (resTable.numberOfPages == resTable.page) {
                    this.synchronizationServices.updateVersionsTables(resTable.updateTime, Number(resTable.id)).then(() => {
                      this.persistTableLastUpdate(tableLastUpdateKey as keyof TablesLastUpdate, resTable.updateTime);
                      this.notifyProductMinMulSynced(key);
                      table.page = 0;
                      resolve(rowKey);
                    });
                  }
                });
              } else {
                // 4. Si no hay datos ni borrados, solo avanza
                this.initProgress(this.PROGRESS, this.BUFF);
                table.page = 0;
                resolve(rowKey);
              }
            },
            error: (e) => {
              this.initProgress(this.PROGRESS, this.BUFF);

              table.page = 0;
              console.error(e);
              resolve('error');
            }
          });
        })
        .catch((err) => {
          // En caso de error evaluando shouldSyncTable, lo logueamos y saltamos la tabla
          console.error('[sync] shouldSyncTable error for tableId', tableId, err);
          this.currentTableIndex++;
          this.syncNextTable(table);
          return;
        });
    });

    promesa.then((nextTable) => {
      this.currentTableIndex++;
      // Si insertTable retornó un nuevo objeto (para la siguiente página), úsalo
      if (nextTable && typeof nextTable === 'object') {
        this.syncNextTable(nextTable as TablesLastUpdate);
      } else {
        this.syncNextTable(table);
      }
    }).catch((error) => {
      console.log('no sincronice', error);
    });
  }

  // ...existing code...

  /**
   * Decide si una tabla debe sincronizarse, consultando la configuración global.
   * Normaliza valores booleanos y strings "true"/"false".
   */
  private shouldSyncTable(tableId: number): boolean | Promise<boolean> {
    const cfgTrue = (key: string): boolean => {
      const val: any = this.globalConfig.get(key);
      if (typeof val === 'undefined' || val === null) return false;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        if (val.trim() === "") return false;
        return val.toLowerCase() === 'true';
      }
      return false; // por defecto consideramos deshabilitado si no está presente
    };

    // Validaciones por grupos de tablas (mismo comportamiento que tenías antes,
    // pero centralizado y robusto frente a tipos).
    if ([56, 57, 58].includes(tableId)) {
      return cfgTrue('validateReturn');
    }
    if ([59, 60].includes(tableId)) {
      return cfgTrue('userCanSelectChannel');
    }
    if ([61, 62, 65, 64, 66, 67, 68, 63].includes(tableId)) {
      return cfgTrue('transactionHistory');
    }
    // LA VALIDACIÓN SOLICITADA: tabla 72 depende de conversionCalculator
    if ([72].includes(tableId)) {
      return cfgTrue('conversionCalculator');
    }

    // Usar la clave correcta (plural) consistente con insertConfig
    if ([73, 74].includes(tableId)) {
      const cfgKey = 'currencyModule';
      console.debug(`[sync] shouldSyncTable: tableId=${tableId}, cfgKey=${cfgKey}, cfgValue=`, this.globalConfig.get(cfgKey));
      return cfgTrue(cfgKey);
    }

    if ([75].includes(tableId)) {
      return cfgTrue('enableDifferenceCodes');
    }

    if ([76].includes(tableId)) {
      return cfgTrue('userCanSelectCollectDiscount');
    }

    if ([83].includes(tableId)) {
      return cfgTrue('retencion');
    }

    if ([77, 78].includes(tableId)) {
      return cfgTrue('suggestedOrderByDispatchAndReturn');
    }

    if ([81].includes(tableId)) {
      return cfgTrue('unitByPriceList');
    }

    // Para cualquier otra tabla, por defecto sincronizamos
    return true;
  }

  /**
   * Helper genérico para insertar lotes de datos en la tabla correspondiente.
   */
  private insertTableBatch(
    batchFn: (rows: any) => Promise<any>,
    rows: any,
    tableKey: keyof TablesLastUpdate,
    resTable: any,
    pageKey: string,
    numberOfPagesKey: string
  ): Promise<TablesLastUpdate | false> {
    return batchFn(rows).then(() => {
      const tableLastUpdate: Record<string, any> = {};
      tableLastUpdate[tableKey as string] = this.resolveTableLastUpdate(tableKey);
      tableLastUpdate['page'] = resTable[pageKey] + 1;
      this.initProgress(this.PROGRESS / resTable[numberOfPagesKey], this.BUFF / resTable[numberOfPagesKey]);
      resTable[pageKey]++;
      if (resTable[pageKey] < resTable[numberOfPagesKey]) {
        return tableLastUpdate as TablesLastUpdate;
      } else {
        return false;
      }
    });
  }

  /**
   * Configuración centralizada de tablas para la inserción de datos.
   * Define cómo insertar cada tabla y cómo acceder a sus propiedades.
   */
  private insertConfig = {
    address_clients: {
      batchFn: this.synchronizationServices.insertAddressClientBatch.bind(this.synchronizationServices),
      rowKey: 'addressClientTable',
      tableKey: 'addressClientTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    clients: {
      batchFn: this.synchronizationServices.insertClientBatch.bind(this.synchronizationServices),
      rowKey: 'clientTable',
      tableKey: 'clientTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    banks: {
      batchFn: this.synchronizationServices.insertBanksBatch.bind(this.synchronizationServices),
      rowKey: 'bankTable',
      tableKey: 'bankTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    distribution_channels: {
      batchFn: this.synchronizationServices.insertDistributionChannelBatch.bind(this.synchronizationServices),
      rowKey: 'distributionChannelTable',
      tableKey: 'distributionChannelTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    document_sale_types: {
      batchFn: this.synchronizationServices.insertDocumentSaleTypeBatch.bind(this.synchronizationServices),
      rowKey: 'documentSaleTypeTable',
      tableKey: 'documentSaleTypeTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    document_sales: {
      batchFn: this.synchronizationServices.insertDocumentSaleBatch.bind(this.synchronizationServices),
      rowKey: 'documentSaleTable',
      tableKey: 'documentSaleTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    lists: {
      batchFn: this.synchronizationServices.insertListBatch.bind(this.synchronizationServices),
      rowKey: 'listTable',
      tableKey: 'listTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    payment_conditions: {
      batchFn: this.synchronizationServices.insertPaymentConditionBatch.bind(this.synchronizationServices),
      rowKey: 'paymentConditionTable',
      tableKey: 'paymentConditionTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    price_lists: {
      batchFn: this.synchronizationServices.insertPriceListBatch.bind(this.synchronizationServices),
      rowKey: 'priceListTable',
      tableKey: 'priceListTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    products: {
      batchFn: this.synchronizationServices.insertProductBatch.bind(this.synchronizationServices),
      rowKey: 'productTable',
      tableKey: 'productTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    units: {
      batchFn: this.synchronizationServices.insertUnitBatch.bind(this.synchronizationServices),
      rowKey: 'unitTable',
      tableKey: 'unitTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    product_units: {
      batchFn: this.synchronizationServices.insertProductUnitBatch.bind(this.synchronizationServices),
      rowKey: 'productUnitTable',
      tableKey: 'productUnitTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    enterprises: {
      batchFn: this.synchronizationServices.insertEnterpriseBatch.bind(this.synchronizationServices),
      rowKey: 'enterpriseTable',
      tableKey: 'enterpriseTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    incidence_motives: {
      batchFn: this.synchronizationServices.insertIncidenceMotiveBatch.bind(this.synchronizationServices),
      rowKey: 'incidenceMotiveTable',
      tableKey: 'incidenceMotiveTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    incidence_types: {
      batchFn: this.synchronizationServices.insertIncidenceTypeBatch.bind(this.synchronizationServices),
      rowKey: 'incidenceTypeTable',
      tableKey: 'incidenceTypeTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    return_motives: {
      batchFn: this.synchronizationServices.insertReturnMotiveBatch.bind(this.synchronizationServices),
      rowKey: 'returnMotiveTable',
      tableKey: 'returnMotiveTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    return_types: {
      batchFn: this.synchronizationServices.insertReturnTypeBatch.bind(this.synchronizationServices),
      rowKey: 'returnTypeTable',
      tableKey: 'returnTypeTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    bank_accounts: {
      batchFn: this.synchronizationServices.insertBankAccountBatch.bind(this.synchronizationServices),
      rowKey: 'bankAccountTable',
      tableKey: 'bankAccountTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    stocks: {
      batchFn: this.synchronizationServices.insertStockBatch.bind(this.synchronizationServices),
      rowKey: 'stockTable',
      tableKey: 'stockTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    discounts: {
      batchFn: this.synchronizationServices.insertDiscountBatch.bind(this.synchronizationServices),
      rowKey: 'discountTable',
      tableKey: 'discountTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    visits: {
      batchFn: this.synchronizationServices.insertVisitsBatch.bind(this.synchronizationServices),
      rowKey: 'visitTable',
      tableKey: 'visitTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    iva_lists: {
      batchFn: this.synchronizationServices.insertIvaBatch.bind(this.synchronizationServices),
      rowKey: 'ivaListTable',
      tableKey: 'ivaListTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    warehouses: {
      batchFn: this.synchronizationServices.insertWarehouseBatch.bind(this.synchronizationServices),
      rowKey: 'warehouseTable',
      tableKey: 'warehouseTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    global_discounts: {
      batchFn: this.synchronizationServices.insertGlobalDiscountBatch.bind(this.synchronizationServices),
      rowKey: 'globalDiscountTable',
      tableKey: 'globalDiscountTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    client_bank_accounts: {
      batchFn: this.synchronizationServices.insertClientBankAccountBatch.bind(this.synchronizationServices),
      rowKey: 'clientBankAccountTable',
      tableKey: 'clientBankAccountTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    product_min_muls: {
      batchFn: this.synchronizationServices.insertProductMinMulBatch.bind(this.synchronizationServices),
      rowKey: 'productMinMulFavTable',
      tableKey: 'productMinMulFavTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    product_bonus_fav: {
      batchFn: this.synchronizationServices.processProductBonusFavDelta.bind(this.synchronizationServices),
      rowKey: 'productBonusFavTable',
      tableKey: 'bonusTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    user_informations: {
      batchFn: this.synchronizationServices.insertUserInformationBatch.bind(this.synchronizationServices),
      rowKey: 'userInformationTable',
      tableKey: 'userInformationTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    currency_enterprises: {
      batchFn: this.synchronizationServices.insertCurrencyEnterpriseBatch.bind(this.synchronizationServices),
      rowKey: 'currencyEnterpriseTable',
      tableKey: 'currencyEnterpriseTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    currency_relations: {
      batchFn: this.synchronizationServices.insertCurrencyRelationBatch.bind(this.synchronizationServices),
      rowKey: 'currencyRelationTable',
      tableKey: 'currencyRelationTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    conversion_types: {
      batchFn: this.synchronizationServices.insertConversionTypesBatch.bind(this.synchronizationServices),
      rowKey: 'conversionTypeTable',
      tableKey: 'conversionTypeTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    type_product_structures: {
      batchFn: this.synchronizationServices.insertTypeProductStructureBatch.bind(this.synchronizationServices),
      rowKey: 'typeProductStructureTable',
      tableKey: 'typeProductStructureTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    product_structures: {
      batchFn: this.synchronizationServices.insertProductStructureBatch.bind(this.synchronizationServices),
      rowKey: 'productStructureTable',
      tableKey: 'productStructureTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    product_structure_counts: {
      batchFn: this.synchronizationServices.insertProductStructureCountBatch.bind(this.synchronizationServices),
      rowKey: 'productStructureCountTable',
      tableKey: 'productStructureCountTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    order_types: {
      batchFn: this.synchronizationServices.insertOrderTypeBatch.bind(this.synchronizationServices),
      rowKey: 'orderTypeTable',
      tableKey: 'orderTypeTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    user_product_favs: {
      batchFn: this.synchronizationServices.insertUserProductFavBatch.bind(this.synchronizationServices),
      rowKey: 'userProductFavTable',
      tableKey: 'userProductFavTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    client_avg_products: {
      batchFn: this.synchronizationServices.insertClientAvgProductBatch.bind(this.synchronizationServices),
      rowKey: 'clientAvgProductTable',
      tableKey: 'clientAvgProductTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    igtf_lists: {
      batchFn: this.synchronizationServices.insertIgtfBatch.bind(this.synchronizationServices),
      rowKey: 'igtfListTable',
      tableKey: 'igtfListTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    invoices: {
      batchFn: this.synchronizationServices.insertInvoiceBatch.bind(this.synchronizationServices),
      rowKey: 'invoiceTable',
      tableKey: 'invoiceTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    invoice_details: {
      batchFn: this.synchronizationServices.insertInvoiceDetailBatch.bind(this.synchronizationServices),
      rowKey: 'invoiceDetailTable',
      tableKey: 'invoiceDetailTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    invoice_detail_units: {
      batchFn: this.synchronizationServices.insertInvoiceDetailUnitBatch.bind(this.synchronizationServices),
      rowKey: 'invoiceDetailUnitTable',
      tableKey: 'invoiceDetailUnitTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    client_channel_order_type: {
      batchFn: this.synchronizationServices.insertClientChannelOrderTypeBatch.bind(this.synchronizationServices),
      rowKey: 'clientChannelOrderTypeTable',
      tableKey: 'clientChannelOrderTypeTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    order_type_product_structure: {
      batchFn: this.synchronizationServices.insertOrderTypeProductStructureBatch.bind(this.synchronizationServices),
      rowKey: 'orderTypeProductStructureTable',
      tableKey: 'orderTypeProductStructureTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    transaction_statuses: {
      batchFn: this.synchronizationServices.insertTransactionStatusesBatch.bind(this.synchronizationServices),
      rowKey: 'transactionStatusTable',
      tableKey: 'transactionStatusTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    transaction_types: {
      batchFn: this.synchronizationServices.insertTransactionTypesBatch.bind(this.synchronizationServices),
      rowKey: 'transactionTypeTable',
      tableKey: 'transactionTypeTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    statuses: {
      batchFn: this.synchronizationServices.insertStatusesBatch.bind(this.synchronizationServices),
      rowKey: 'statusTable',
      tableKey: 'statusTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    orders: {
      batchFn: this.synchronizationServices.insertOrderBatch.bind(this.synchronizationServices),
      rowKey: 'orderTable',
      tableKey: 'orderTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    collections: {
      batchFn: this.synchronizationServices.insertCollectionBatch.bind(this.synchronizationServices),
      rowKey: 'collectionTable',
      tableKey: 'collectionTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    returns: {
      batchFn: this.synchronizationServices.insertReturnBatch.bind(this.synchronizationServices),
      rowKey: 'returnTable',
      tableKey: 'returnTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    client_stocks: {
      batchFn: this.synchronizationServices.insertClientStockBatch.bind(this.synchronizationServices),
      rowKey: 'clientStockTable',
      tableKey: 'clientStockTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    deposits: {
      batchFn: this.synchronizationServices.insertDepositBatch.bind(this.synchronizationServices),
      rowKey: 'depositTable',
      tableKey: 'depositTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    orderDetails: {
      batchFn: this.synchronizationServices.insertOrderDetailBatch.bind(this.synchronizationServices),
      rowKey: 'orderDetailTable',
      tableKey: 'orderDetailTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    orderDetailUnits: {
      batchFn: this.synchronizationServices.insertOrderDetailUnitBatch.bind(this.synchronizationServices),
      rowKey: 'orderDetailUnitTable',
      tableKey: 'orderDetailUnitTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    orderDetailDiscounts: {
      batchFn: this.synchronizationServices.insertOrderDetailDiscountBatch.bind(this.synchronizationServices),
      rowKey: 'orderDetailDiscountTable',
      tableKey: 'orderDetailDiscountTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    conversion: {
      batchFn: this.synchronizationServices.insertConversionBatch.bind(this.synchronizationServices),
      rowKey: 'conversionTable',
      tableKey: 'conversionTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    modules: {
      batchFn: this.synchronizationServices.insertModulesBatch.bind(this.synchronizationServices),
      rowKey: 'moduleTable',
      tableKey: 'moduleTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    currencyModules: {
      batchFn: this.synchronizationServices.insertCurrencyModulesBatch.bind(this.synchronizationServices),
      rowKey: 'currencyModuleTable',
      tableKey: 'currencyModuleTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    differenceCodes: {
      batchFn: this.synchronizationServices.insertDifferenceCodesBatch.bind(this.synchronizationServices),
      rowKey: 'differenceCodeTable',
      tableKey: 'differenceCodeTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    collectDiscounts: {
      batchFn: this.synchronizationServices.insertCollectDiscountsBatch.bind(this.synchronizationServices),
      rowKey: 'collectDiscountTable',
      tableKey: 'collectDiscountTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    straight_swap: {
      batchFn: this.synchronizationServices.insertStraightSwapBatch.bind(this.synchronizationServices),
      rowKey: 'straightSwapTable',
      tableKey: 'straightSwapTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    return_category: {
      batchFn: this.synchronizationServices.insertReturnCategoryBatch.bind(this.synchronizationServices),
      rowKey: 'returnCategoryTable',
      tableKey: 'returnCategoryTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    typeDocument: {
      batchFn: this.synchronizationServices.insertTypeDocumentBatch.bind(this.synchronizationServices),
      rowKey: 'typeDocumentTable',
      tableKey: 'typeDocumentTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    codePhoneNumber: {
      batchFn: this.synchronizationServices.insertCodePhoneNumberBatch.bind(this.synchronizationServices),
      rowKey: 'codePhoneNumberTable',
      tableKey: 'codePhoneNumberTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    unit_pricelist: {
      batchFn: this.synchronizationServices.insertUnitPriceListBatch.bind(this.synchronizationServices),
      rowKey: 'unitPriceListTable',
      tableKey: 'unitPriceListTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    collectRetention: {
      batchFn: this.synchronizationServices.insertCollectRetentionsBatch.bind(this.synchronizationServices),
      rowKey: 'collectRetentionTable',
      tableKey: 'collectRetentionTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
  };

  /**
   * Método genérico para insertar cualquier tabla.
   * @param tableName Nombre de la tabla según insertConfig
   * @param res syncResponse recibido del backend
   */
  insertTable(tableName: keyof typeof this.insertConfig, res: syncResponse) {
    const cfg = this.insertConfig[tableName];
    return this.insertTableBatch(
      cfg.batchFn,
      (res as any)[cfg.rowKey].row,
      cfg.tableKey as keyof TablesLastUpdate,
      (res as any)[cfg.rowKey],
      cfg.pageKey,
      cfg.numberOfPagesKey
    );
  }

  private notifyProductMinMulSynced(tableName: string): void {
    if (tableName === 'product_min_muls') {
      this.pedidosService.invalidateCatalogCache();
      void this.pedidosService.refreshProductMinMulData();
      return;
    }
    if (tableName === 'product_bonus_fav') {
      this.pedidosService.invalidateCatalogCache();
      void this.pedidosService.refreshProductBonusFavData();
    }
  }

  /**
   * Actualiza el progreso de la sincronización.
   * @param progreso Progreso a sumar
   * @param buffer Buffer a sumar
   */
  initProgress(progreso: number, buffer: number) {
    this.progress += progreso;
    this.buffer += buffer;
  }

  handleDeletedRows(deletedRowsIds: any, tableName: string, idField: string) {
    if (deletedRowsIds == null) {
      return;
    }
    if (tableName === 'deposits' && idField === 'id_deposit') {
      this.synchronizationServices.deleteDepositRowsSafely(deletedRowsIds);
      return;
    }
    this.synchronizationServices.deleteDataTable(deletedRowsIds, tableName, idField);
  }
}
