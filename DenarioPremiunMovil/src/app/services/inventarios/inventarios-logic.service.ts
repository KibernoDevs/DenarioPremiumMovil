import { Injectable, inject } from '@angular/core';
import { Subject, firstValueFrom, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { CapacitorHttp } from '@capacitor/core';

import { Client } from 'src/app/modelos/tables/client';
import { ClientStocks, ClientStocksDetail, ClientStocksDetailUnits } from 'src/app/modelos/tables/client-stocks';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { ServicesService } from '../services.service';
import { DateServiceService } from '../dates/date-service.service';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { AddresClient } from 'src/app/modelos/tables/addresClient';
import { ClientStockTotal } from 'src/app/modelos/client-stock-total';
import { Inventarios } from 'src/app/modelos/inventarios';
import { TiposPago } from 'src/app/modelos/tipos-pago';
import { DELIVERY_STATUS_SAVED, DELIVERY_STATUS_SENT, DELIVERY_STATUS_TO_SEND, VISIT_STATUS_TO_SEND, VISIT_STATUS_VISITED } from 'src/app/utils/appConstants'
import { ImageServicesService } from '../imageServices/image-services.service';
import { Unit } from 'src/app/modelos/tables/unit';
import { ProductUtil } from 'src/app/modelos/ProductUtil';
import { ProductStructureService } from '../productStructures/product-structure.service';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { ItemListaInventarios } from 'src/app/inventarios/item-lista-inventarios';
import { HistoryTransaction } from '../historyTransaction/historyTransaction';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { ProductSuggestedUtil, UnitSuggestedUtil } from 'src/app/modelos/ProductSuggestedUtil';
import { PedidosDbService } from 'src/app/pedidos/pedidos-db.service';
import { StraightSwap } from 'src/app/modelos/tables/straightSwap';
import { ReturnDetail } from 'src/app/modelos/tables/ReturnDetail';
import { InvoiceDetailUnit } from 'src/app/modelos/tables/invoiceDetailUnit';
import { CurrencyEnterprise } from 'src/app/modelos/tables/currencyEnterprise';
import {
  ClientStockSuggestedOrder,
  ClientStockSuggestedOrderDetail,
} from 'src/app/modelos/tables/client-stock-suggested-order';
import { ItemListaPedidoSugerido } from 'src/app/inventarios/item-lista-pedido-sugerido';
import { PendingTransaction } from 'src/app/modelos/tables/pendingTransactions';




@Injectable({
  providedIn: 'root'
})
export class InventariosLogicService {
  public services = inject(ServicesService);
  public dateServ = inject(DateServiceService);
  public router = inject(Router);
  public productStructureService = inject(ProductStructureService);
  public globalConfig = inject(GlobalConfigService);
  public adjuntoService = inject(AdjuntoService);
  public historyTransaction = inject(HistoryTransaction);
  public orderDbServ = inject(PedidosDbService);


  public initInventario: Boolean = true;
  public backRoute = new Subject<string>;
  public inventarioComp: Boolean = false;
  public inventarioList: Boolean = false;
  public inventarioSuggestedList: Boolean = false;
  public containerComp: Boolean = true;
  public showButtons = new Subject<Boolean>;
  public newClientStock: ClientStocks = {} as ClientStocks;
  public stockValid = new Subject<Boolean>;
  public stockValidToSave = new Subject<Boolean>;
  public stockValidToSend = new Subject<Boolean>;
  public hideTab: Boolean = true;
  public subs: any;
  public nombreCliente: string = "";
  public clientStockValid: Boolean = false;
  public selectedClient: Boolean = false;
  public listaEmpresa: Enterprise[] = [];
  public empresaSeleccionada!: Enterprise;
  public showHeaderButtons: Boolean = false;
  public disableSaveButton: Boolean = true;
  public cannotSendClientStock: Boolean = true;
  public alertMessageOpen: Boolean = false;
  public alertMessage: Boolean = false;
  public disabledEnterprise: boolean = false;
  public userMustActivateGPS: boolean = false;
  public expirationBatch: boolean = false;
  public suggestedOrder: boolean = false;
  public suggestedOrderByDispatchAndReturn: boolean = false;
  public productsSuggested: ProductSuggestedUtil[] = [];
  public idProductsSuggested: number[] = [];
  public idProductsUnitsSuggested: number[] = [];
  public idUnitsSuggested: number[] = [];

  /** Decisión de adjuntar sugerencia al POST inventario (por co_client_stock). */
  private suggestedOrderAttachOnStockSend = new Map<string, boolean>();
  /** Envío pedido desde sugerencia: adjuntar snapshot si existe (obligatorio). */
  private forceSuggestedOrderAttachOnStockSend = new Set<string>();

  public enterpriseClientStock: Enterprise = {} as Enterprise;
  public clientClientStock: Client = {} as Client;
  public client!: Client;


  public inventarioTags = new Map<string, string>([]);
  public inventarioTagsDenario = new Map<string, string>([]);

  public addressClient: AddresClient[] = [];
  public clientStocksTotal: ClientStockTotal[] = [];
  public inventarios: Inventarios[] = [];
  public itemListClientStocks: ItemListaInventarios[] = [];
  public productSelected!: ProductUtil;
  public productSelectedIndex!: number;
  /* public variables = new Map<number, Inventarios[]>([]); */
  public productTypeStocksMap = new Map<number, number>();
  public tiposPago: TiposPago[] = [];
  public typeStocks: Inventarios[] = [];
  public cliente = {} as Client;
  public typeExh: Boolean = false;
  public typeDep: Boolean = false;
  public productUnitList!: Unit[];
  public unitSelected!: Unit;
  public inventarioSent: boolean = false;
  public showProductList: boolean = false;
  public isEdit: boolean = false;
  public selectedInventoryType: 'exh' | 'dep' = 'exh';

  public message!: string;

  /** General válida: cliente + sucursal (desbloquea pestañas y base de Guardar/Enviar). */
  public generalTabValidForSave = false;
  public stockPersistedBaseline = false;
  public stockDirtySincePersist = false;
  private stockDirtyTrackingPaused = false;
  public sendValidationAttempted = false;
  public sendBlockedByFields = false;
  public stockSendFocusTypeStockIndex = -1;
  public focusSendValidationTab = new Subject<'default' | 'inventario' | 'actividades' | 'adjuntos'>();

  constructor() {

  }

  showHeaderButtonsFunction(headerButtons: Boolean) {
    this.showButtons.next(headerButtons);
  }

  onStockValidToSave(valid: Boolean) {
    console.log('returnLogicService: onReturnValid');
    this.stockValidToSave.next(valid);
  }

  onStockValidToSend(validToSend: Boolean) {
    console.log('returnLogicService: onReturnValidToSend');
    this.stockValidToSend.next(validToSend);
  }

  onClientStockValid(valid: Boolean) {
    console.log('clientStockService: onClientStockValid');
    this.generalTabValidForSave = !!valid;
    this.stockValid.next(valid);
    this.updateSaveButtonAvailability();
    this.updateSendButtonAvailability();
  }

  pauseStockDirtyTracking(): void {
    this.stockDirtyTrackingPaused = true;
  }

  resumeStockDirtyTracking(): void {
    this.stockDirtyTrackingPaused = false;
  }

  markStockDirty(): void {
    if (this.stockDirtyTrackingPaused) {
      return;
    }
    this.stockDirtySincePersist = true;
    this.updateSaveButtonAvailability();
  }

  applyPersistSucceededBaseline(): void {
    this.stockDirtySincePersist = false;
    this.stockPersistedBaseline = true;
    this.updateSaveButtonAvailability();
  }

  resetStockExitBaseline(): void {
    this.stockPersistedBaseline = false;
    this.stockDirtySincePersist = false;
    this.updateSaveButtonAvailability();
  }

  markStockOpenedFromPersistedCopy(): void {
    this.stockPersistedBaseline = true;
    this.stockDirtySincePersist = false;
    this.updateSaveButtonAvailability();
    this.updateSendButtonAvailability();
  }

  /** Marca edición de usuario y refresca botones (no usar en hidratación/reapertura). */
  notifyStockEdited(): void {
    this.markStockDirty();
    this.refreshSendBlockedState();
    this.updateSaveButtonAvailability();
    this.updateSendButtonAvailability();
  }

  isStockReadOnlyForEdit(): boolean {
    const stDelivery = Number(this.newClientStock?.stDelivery ?? 0);
    return stDelivery === DELIVERY_STATUS_TO_SEND
      || stDelivery === DELIVERY_STATUS_SENT;
  }

  public updateSaveButtonAvailability(): void {
    if (this.isStockReadOnlyForEdit()) {
      this.onStockValidToSave(false);
      return;
    }
    if (this.adjuntoService.weightLimitExceeded) {
      this.onStockValidToSave(false);
      return;
    }
    const generalOk = this.generalTabValidForSave;
    const hasChangesToSave =
      !this.stockPersistedBaseline || this.stockDirtySincePersist;
    this.onStockValidToSave(generalOk && hasChangesToSave);
  }

  public updateSendButtonAvailability(): void {
    if (this.isStockReadOnlyForEdit()) {
      this.onStockValidToSend(false);
      return;
    }
    if (this.adjuntoService.weightLimitExceeded) {
      this.onStockValidToSend(false);
      return;
    }
    // Tras fallo de Enviar, apagar hasta que el usuario edite (mismo criterio Cobros).
    if (this.sendBlockedByFields) {
      this.onStockValidToSend(false);
      return;
    }
    // Enviar ON con General. Campos incompletos se validan al click (INV-SEND-001).
    this.onStockValidToSend(this.generalTabValidForSave);
  }

  public resetSendValidationUx(): void {
    this.sendValidationAttempted = false;
    this.sendBlockedByFields = false;
    this.stockSendFocusTypeStockIndex = -1;
    this.updateSendButtonAvailability();
  }

  public refreshSendBlockedState(): void {
    if (!this.sendBlockedByFields) {
      return;
    }
    // Al editar, reactivar Enviar para reintentar y ver el siguiente mensaje exacto.
    this.sendBlockedByFields = false;
  }

  private hasMissingGpsCoordinate(): boolean {
    if (!this.userMustActivateGPS) {
      return false;
    }
    const coord = (this.newClientStock?.coordenada ?? '').toString().trim();
    return coord.length === 0;
  }

  public findFirstIncompleteTypeStockIndex(): number {
    if (this.typeStocks.length === 0) {
      return -1;
    }
    for (let i = 0; i < this.typeStocks.length; i++) {
      const typeStock = this.typeStocks[i];
      if (!typeStock.validateCantidad) {
        return i;
      }
      if (this.expirationBatch && !typeStock.validateLote) {
        return i;
      }
    }
    return -1;
  }

  public shouldShowProductStockSendError(coProduct: string): boolean {
    if (!this.sendValidationAttempted) {
      return false;
    }
    const detail = this.newClientStock.clientStockDetails?.find(d => d.coProduct === coProduct);
    if (!detail) {
      return false;
    }
    return this.typeStocks.some(typeStock =>
      typeStock.idProduct === detail.idProduct
      && (!typeStock.validateCantidad || (this.expirationBatch && !typeStock.validateLote))
    );
  }

  /**
   * Errores que bloquean Enviar: General + productos (+ GPS si config).
   * Firma/adjuntos no son obligatorios: `signatureStock` solo muestra el panel de firma.
   */
  public hasStockFieldErrors(): boolean {
    if (!this.generalTabValidForSave || !this.selectedClient) {
      return true;
    }
    // Productos antes que GPS (evitar falso positivo en inventario vacío).
    if (!this.checkValidStockToSend()) {
      return true;
    }
    if (this.hasMissingGpsCoordinate()) {
      return true;
    }
    return false;
  }

  /** Guardar solo exige General (cliente + sucursal). Productos/GPS van en Enviar. */
  public hasStockSaveErrors(): boolean {
    return !this.generalTabValidForSave || !this.selectedClient;
  }

  public getStockSaveValidationMessage(): string {
    return this.inventarioTags.get('INV_ERROR_LIST_ADDRESS')
      ?? 'Este cliente no tiene sucursal asignada, por favor consulte su administrador';
  }

  /**
   * Mensaje al pulsar Enviar: prioridad General → productos → GPS.
   */
  public getStockValidationMessage(): string {
    if (!this.generalTabValidForSave || !this.selectedClient) {
      return this.inventarioTags.get('INV_ERROR_LIST_ADDRESS')
        ?? 'Este cliente no tiene sucursal asignada, por favor consulte su administrador';
    }
    if (this.typeStocks.length === 0) {
      // No usar INV_MSJ_ERROR_TYPESTOCKS aquí: habla de cantidad/tipo, no de producto faltante.
      return this.inventarioTags.get('INV_MSJ_ERROR_NO_PRODUCTS')
        ?? 'Debe seleccionar al menos un producto para el inventario.';
    }
    const incompleteIndex = this.findFirstIncompleteTypeStockIndex();
    if (incompleteIndex >= 0) {
      const typeStock = this.typeStocks[incompleteIndex];
      if (!typeStock.validateCantidad) {
        return this.inventarioTags.get('INV_MSJ_ERROR_INCOMPLETE_QTY')
          ?? 'Complete cantidad, unidad y fecha de vencimiento en todos los productos inventariados.';
      }
      if (this.expirationBatch && !typeStock.validateLote) {
        return this.inventarioTags.get('INV_MSJ_ERROR_INCOMPLETE_BATCH')
          ?? 'Complete el lote en todos los productos inventariados.';
      }
    }
    if (this.hasMissingGpsCoordinate()) {
      return this.inventarioTags.get('INV_MSJ_ERROR_NO_GPS')
        ?? 'Debe activar el GPS y obtener la ubicación antes de continuar.';
    }
    return this.inventarioTags.get('INV_MSJ_ERROR_NO_PRODUCTS')
      ?? 'Debe seleccionar al menos un producto para el inventario.';
  }

  /** Pestaña del primer error bloqueante. Null = sin error (SEND-TAB-001). */
  public resolveSendValidationFocusTab(): 'default' | 'inventario' | 'actividades' | 'adjuntos' | null {
    if (!this.generalTabValidForSave || !this.selectedClient) {
      return 'default';
    }
    if (this.typeStocks.length === 0) {
      return this.hideTab ? 'inventario' : 'actividades';
    }
    if (this.findFirstIncompleteTypeStockIndex() >= 0) {
      return this.hideTab ? 'inventario' : 'actividades';
    }
    if (this.hasMissingGpsCoordinate()) {
      return 'default';
    }
    return null;
  }

  /** Emite la pestaña a enfocar tras un fallo de Enviar/Guardar. */
  public requestSendValidationTabFocus(
    tab?: 'default' | 'inventario' | 'actividades' | 'adjuntos' | null,
  ): void {
    const focus = tab === undefined ? this.resolveSendValidationFocusTab() : tab;
    if (focus == null) {
      return;
    }
    this.focusSendValidationTab.next(focus);
  }

  /** @deprecated Usar notifyStockEdited / updateSaveButtonAvailability / updateSendButtonAvailability */
  updateHeaderButtons() {
    this.refreshSendBlockedState();
    this.updateSaveButtonAvailability();
    this.updateSendButtonAvailability();
  }


  checkValidStockToSend() {
    if (this.typeStocks.length == 0) {
      return false;
    }
    for (const typeStock of this.typeStocks) {
      if (!typeStock.validateCantidad) {
        return false;
      }
      if (this.expirationBatch && !typeStock.validateLote) {
        return false;
      }
    };
    return true;
  }



  getTags(dbServ: SQLiteObject) {
    return this.services.getTags(dbServ, "INV", "ESP").then(result => {
      for (var i = 0; i < result.length; i++) {
        this.inventarioTags.set(
          result[i].coApplicationTag, result[i].tag
        )
      }
      if (this.tiposPago.length == 0) {
        this.tiposPago.push({
          type: this.inventarioTags.get('INV_EXH_TYPE')!,
          name: this.inventarioTags.get('INV_EXH_NAME')!,
          selected: false,
        });
        this.tiposPago.push({
          type: this.inventarioTags.get('INV_DEP_TYPE')!,
          name: this.inventarioTags.get('INV_DEP_NAME')!,
          selected: false,
        });
      }
      return Promise.resolve(true);
    })
  }

  getTagsDenario(dbServ: SQLiteObject) {
    return this.services.getTags(dbServ, "DEN", "ESP").then(result => {
      for (var i = 0; i < result.length; i++) {
        this.inventarioTagsDenario.set(
          result[i].coApplicationTag, result[i].tag
        )
      }
      return Promise.resolve(true);
    })
  }

  loadSuggestedOrderConfig(): void {
    this.suggestedOrder = this.globalConfig.get('suggestedOrder')?.toLowerCase() === 'true';
    this.suggestedOrderByDispatchAndReturn = this.globalConfig.get('suggestedOrderByDispatchAndReturn')?.toLowerCase() === 'true';
  }

  /** INV-DAYS-001: {} as ClientStocks no aplica defaults del constructor. */
  resolvePositiveInventoryDays(value: number | null | undefined): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) {
      return 1;
    }
    return n;
  }

  initClientStockDetails() {
    this.initInventario = true;
    this.selectedClient = false;
    this.inventarioSent = false;
    this.disableSaveButton = true;
    this.cannotSendClientStock = true;
    this.generalTabValidForSave = false;
    this.stockPersistedBaseline = false;
    this.stockDirtySincePersist = false;
    this.stockDirtyTrackingPaused = false;
    this.sendValidationAttempted = false;
    this.sendBlockedByFields = false;
    this.stockSendFocusTypeStockIndex = -1;
    this.newClientStock = {} as ClientStocks;
    this.newClientStock.clientStockDetails = [] as ClientStocksDetail[];
    /* this.tiposPago = [] as TiposPago[]; */
    /* this.typeStocks = [] as Inventarios[]; */
    /* this.variables = new Map<number, Inventarios[]>(); */
    this.newClientStock.productList = [] as ProductUtil[];
    this.productTypeStocksMap = new Map<number, number>();
    this.typeStocks = [] as Inventarios[];
    this.selectedInventoryType = 'exh';
    this.disabledEnterprise = this.globalConfig.get('enterpriseEnabled') === 'true' ? false : true;
    this.expirationBatch = this.globalConfig.get('expirationBatch') === 'true' ? true : false;
    this.loadSuggestedOrderConfig();
    this.productsSuggested = [];
    this.idProductsSuggested = [];
    this.idProductsUnitsSuggested = [];
    this.idUnitsSuggested = [];
  }

  showBackRoute(route: string) {
    console.log('clientStockService: showBackRoute');
    this.backRoute.next(route);
  }

  getAllAddressByClient(dbServ: SQLiteObject, idClient: number) {
    let selectStatement = 'SELECT * FROM address_clients WHERE id_client = ?';
    //var database = dbServ;
    let addressClient: AddresClient[] = [];
    return dbServ.executeSql(selectStatement, [idClient]).then(result => {
      if (result.rows.length > 0) {
        for (let i = 0; i < result.rows.length; i++) {
          addressClient.push({
            idAddress: result.rows.item(i).id_address,
            coAddress: result.rows.item(i).co_address,
            naAddress: result.rows.item(i).na_address,
            idClient: result.rows.item(i).id_client,
            idAddressType: result.rows.item(i).id_address_type,
            coAddressType: result.rows.item(i).co_address_type,
            txAddress: result.rows.item(i).tx_address,
            nuPhone: result.rows.item(i).nu_phone,
            naResponsible: result.rows.item(i).na_responsible,
            coEnterpriseStructure: result.rows.item(i).co_enterprise_structure,
            idEnterpriseStructure: result.rows.item(i).id_enterprise_structure,
            coClient: result.rows.item(i).co_client,
            coEnterprise: result.rows.item(i).co_enterprise,
            idEnterprise: result.rows.item(i).id_enterprise,
            coordenada: result.rows.item(i).coordenada,
            editable: result.rows.item(i).editable,
          });
        }
        this.addressClient = addressClient;
        this.newClientStock.idAddressClient = addressClient[0].idAddress;
        this.newClientStock.coAddressClient = addressClient[0].coAddress;
        return true;
      } else
        return false;
    }).catch(e => {
      this.addressClient = [];
      console.log("[ClientStockLogicService] Error al cargar Sucursales.");
      console.log(e);
      return false;
    })
  };

  clientStocksTotalization() {
    this.clientStocksTotal = [] as ClientStockTotal[]
    for (var i = 0; i < this.newClientStock.clientStockDetails.length; i++) {
      for (var j = 0; j < this.newClientStock.clientStockDetails[i].clientStockDetailUnits.length; j++) {
        let clientStockTotal = new ClientStockTotal;

        clientStockTotal.idProduct = this.newClientStock.clientStockDetails[i].idEnterprise;
        clientStockTotal.coEnterprise = this.newClientStock.clientStockDetails[i].coEnterprise;
        clientStockTotal.idProduct = this.newClientStock.clientStockDetails[i].idProduct;
        clientStockTotal.coProduct = this.newClientStock.clientStockDetails[i].coProduct;
        clientStockTotal.naProduct = this.newClientStock.clientStockDetails[i].naProduct;
        clientStockTotal.naUnit = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[0].naUnit;
        clientStockTotal.idUnit = 0;
        clientStockTotal.coUnit = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[0].coUnit;
        clientStockTotal.totalUnits += this.newClientStock.clientStockDetails[i].clientStockDetailUnits[0].quStock;
        clientStockTotal.ubicacion = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[0].ubicacion;
        if (clientStockTotal.ubicacion = "Exhibicion") {
          clientStockTotal.totalExh += this.newClientStock.clientStockDetails[i].clientStockDetailUnits[0].quStock;
        } else {
          clientStockTotal.totalDep += this.newClientStock.clientStockDetails[i].clientStockDetailUnits[0].quStock;
        }

        this.clientStocksTotal.push(clientStockTotal)

      }
    }

    return this.clientStocksTotal
  }

  setVariablesMap() {
    for (var i = 0; i < this.newClientStock.clientStockDetails.length; i++) {
      this.productTypeStocksMap.set(this.newClientStock.clientStockDetails[i].idProduct, i);
      for (var j = 0; j < this.newClientStock.clientStockDetails[i].clientStockDetailUnits.length; j++) {
        switch (this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].ubicacion) {
          case "exh": {
            let newTypeStock: Inventarios = {} as Inventarios;
            newTypeStock.tipo = "exh";
            newTypeStock.idProduct = this.newClientStock.clientStockDetails[i].idProduct;
            //newTypeStock.fechaVencimiento = this.dateServ.hoyISO();;
            newTypeStock.cantidad = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].quStock;
            newTypeStock.lote = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].nuBatch;
            newTypeStock.fechaVencimiento = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].daExpiration;
            newTypeStock.unidad = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].naUnit;
            newTypeStock.validateCantidad = true;
            newTypeStock.validateLote = true;
            newTypeStock.clientStockDetail = [] as ClientStocksDetail[]
            newTypeStock.clientStockDetail.push(this.newClientStock.clientStockDetails[i]);
            newTypeStock.showDateModalExh = false;
            newTypeStock.showDateModalDep = false;
            this.typeStocks.push(newTypeStock);
            this.typeExh = true;
            break;
          }
          case "dep": {
            let newTypeStock: Inventarios = {} as Inventarios;
            newTypeStock.tipo = "dep";
            newTypeStock.idProduct = this.newClientStock.clientStockDetails[i].idProduct;
            //newTypeStock.fechaVencimiento = this.dateServ.hoyISO();;
            newTypeStock.cantidad = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].quStock;
            newTypeStock.lote = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].nuBatch;
            newTypeStock.fechaVencimiento = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].daExpiration;
            newTypeStock.unidad = this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].naUnit;
            newTypeStock.validateCantidad = true;
            newTypeStock.validateLote = true;
            newTypeStock.clientStockDetail = [] as ClientStocksDetail[];
            newTypeStock.clientStockDetail.push(this.newClientStock.clientStockDetails[i]);
            newTypeStock.showDateModalExh = false;
            newTypeStock.showDateModalDep = false;
            this.typeStocks.push(newTypeStock);
            this.typeDep = true;
            break;
          }
        }
      }

    }
  }

  setClientStockObject(i: number, j: number, type: string) {
    let idProduct = this.newClientStock.clientStockDetails[i].idProduct;

    for (var k = 0; k < this.newClientStock.productList.length; k++) {
      if (this.newClientStock.productList[k].idProduct == idProduct) {
        this.newClientStock.productList[k].typeStocks = [] as Inventarios[];
        let inventario = {} as Inventarios;
        inventario.validateCantidad = true;
        inventario.validateLote = false;
        inventario.idProduct = idProduct;
        inventario.indexDetail = j;
        inventario.indexDetailUnit = i;
        inventario.tipo = type;
        inventario.unidad = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].naUnit;
        inventario.idProductList = j;
        inventario.fechaVencimiento = this.dateServ.hoyISO();
        inventario.cantidad = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].quStock;
        inventario.lote = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].nuBatch;

        this.newClientStock.productList[k].typeStocks?.push(inventario);

        if (inventario.tipo == "exh") {
          this.typeExh = true;
        } else {
          this.typeDep = true;
        }

        this.newClientStock.productList[k].typeStocks![j].clientStockDetail = [] as ClientStocksDetail[];
        let clientStockDetail = {} as ClientStocksDetail;

        clientStockDetail.idClientStockDetail = 0;
        if (this.typeStocks.length == 1) {
          /* clientStockDetail.coClientStockDetail = this.dateServ.generateCO(0); */
          clientStockDetail.coClientStockDetail = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].coClientStockDetail;
        } else {
          clientStockDetail.coClientStockDetail = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].coClientStockDetail;
        }

        clientStockDetail.coClientStock = this.newClientStock.coClientStock;
        clientStockDetail.idProduct = this.newClientStock.clientStockDetails[k].idProduct;
        clientStockDetail.coProduct = this.newClientStock.clientStockDetails[k].coProduct;
        clientStockDetail.naProduct = this.newClientStock.clientStockDetails[k].naProduct;
        clientStockDetail.coEnterprise = this.newClientStock.coEnterprise;
        clientStockDetail.idEnterprise = this.newClientStock.idEnterprise;
        clientStockDetail.posicion = 0;
        clientStockDetail.isEdit = true;
        clientStockDetail.isSave = true;

        let lengthTypeStocks = this.newClientStock.productList[k].typeStocks?.length! - 1

        this.newClientStock.productList[k].typeStocks![lengthTypeStocks].clientStockDetail.push(clientStockDetail);
        let length = this.newClientStock.productList[k].typeStocks![lengthTypeStocks].clientStockDetail.length - 1;

        this.newClientStock.productList[k].typeStocks![lengthTypeStocks].clientStockDetail[length].clientStockDetailUnits = [] as ClientStocksDetailUnits[];
        let clientStockDetailUnits = {} as ClientStocksDetailUnits;

        clientStockDetailUnits.idClientStockDetailUnit = 0;
        clientStockDetailUnits.coClientStockDetailUnit = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].coClientStockDetailUnit
        clientStockDetailUnits.coClientStockDetail = clientStockDetail.coClientStockDetail
        clientStockDetailUnits.idProductUnit = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].idProductUnit
        clientStockDetailUnits.coProductUnit = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].coProductUnit
        clientStockDetailUnits.idUnit = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].idUnit
        clientStockDetailUnits.coUnit = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].coUnit
        clientStockDetailUnits.quUnit = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].quUnit
        clientStockDetailUnits.naUnit = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].naUnit
        clientStockDetailUnits.quStock = this.newClientStock.clientStockDetails[k].clientStockDetailUnits[j].quStock;
        clientStockDetailUnits.quSuggested = 0;
        clientStockDetailUnits.coEnterprise = this.newClientStock.coEnterprise;
        clientStockDetailUnits.idEnterprise = this.newClientStock.idEnterprise;
        clientStockDetailUnits.ubicacion = type;
        clientStockDetailUnits.isEdit = true
        clientStockDetailUnits.isSave = true;
        clientStockDetailUnits.posicion = 0;
        clientStockDetailUnits.nuBatch = "";
        clientStockDetailUnits.daExpiration = this.newClientStock.productList[k].typeStocks![j].fechaVencimiento;
        this.newClientStock.productList[k].typeStocks![j].clientStockDetail[length].clientStockDetailUnits.push(clientStockDetailUnits);
        /* this.variables.set(this.newClientStock.clientStockDetails[i].idProduct, this.typeStocks); */
      }
    }

    this.notifyStockEdited();
  }

  async refreshSuggestedOrdersIfEnabled(dbServ: SQLiteObject): Promise<void> {
    if (!this.suggestedOrder) {
      this.productsSuggested = [];
      this.idProductsSuggested = [];
      this.idProductsUnitsSuggested = [];
      this.idUnitsSuggested = [];
      return;
    }

    const hasDetails = (this.newClientStock.clientStockDetails?.length ?? 0) > 0;
    if (!hasDetails) {
      this.productsSuggested = [];
      this.idProductsSuggested = [];
      this.idProductsUnitsSuggested = [];
      this.idUnitsSuggested = [];
      return;
    }

    await this.calcularTotalesSugerenciaPedido(dbServ);
  }

  async calcularTotalesSugerenciaPedido(dbServ: SQLiteObject) {
    let idEnterprise = this.newClientStock.idEnterprise;
    let idClient = this.newClientStock.idClient;
    let idAddressClient = this.newClientStock.idAddressClient;
    //inicializamos el map de totales para cada producto
    //esto incluye stock actual.
    let mapProducts = this.getMappedProductUtils();
    
    let idProductUnits = [];
    let idProducts = [];
    let idUnits = [];
    let coUnits = [];
    for (const [idProduct, mapUnits] of mapProducts) {
      idProducts.push(idProduct);
      for (const [idProductUnit, unitUtil] of mapUnits) {
        idProductUnits.push(idProductUnit);
        idUnits.push(unitUtil.idUnit);
        coUnits.push(unitUtil.coUnit);
      }
    }
    if(idUnits[0] == undefined){
      //cuando carga un inventario guardado no trae los idUnits, por lo que se deben cargar con base en los idProductUnits
      idUnits = await this.getIdUnitsByProductUnit(dbServ, idProductUnits);
    }

  
    if(this.suggestedOrderByDispatchAndReturn){
    let daysSinceLastInventory = this.resolvePositiveInventoryDays(this.newClientStock.daysSinceLast);
    let daysUntilNextInventory = this.resolvePositiveInventoryDays(this.newClientStock.daysUntilNext);
    this.newClientStock.daysUntilNext = daysUntilNextInventory;

    //inventario anterior
    let previousCS = await this.getPreviousClientStock(dbServ, idClient, idAddressClient, this.newClientStock.coClientStock);
    if (previousCS == null) {
      //si no hay previo, se asume que el inventario inicial es 0, por lo que no se hace nada
      this.newClientStock.daysSinceLast = daysSinceLastInventory = 1;
    }else{
      //tomamos la fecha del inventario anterior para calcular los días desde el último inventario,
      daysSinceLastInventory = this.dateServ.daysSince(previousCS.daClientStock);
      if(daysSinceLastInventory <= 0){
        daysSinceLastInventory = 1;
      }
      this.newClientStock.daysSinceLast = daysSinceLastInventory;
      

      for (var i = 0; i < previousCS.clientStockDetails.length; i++) {
        for (var j = 0; j < previousCS.clientStockDetails[i].clientStockDetailUnits.length; j++) {
          let idProduct = previousCS.clientStockDetails[i].idProduct;
          let idProductUnit = previousCS.clientStockDetails[i].clientStockDetailUnits[j].idProductUnit;
          let quStock = previousCS.clientStockDetails[i].clientStockDetailUnits[j].quStock;
          let mapUnits = mapProducts.get(idProduct);
          if(mapUnits != undefined){
            let unitUtil = mapUnits.get(idProductUnit);
            if(unitUtil != undefined){
              unitUtil.previousStock += quStock;
            }
          }
        }
      }
    }
    let dateLastInventory =  this.dateServ.pastDaysISO(daysSinceLastInventory);
    //despacho por facturas del mismo dia que la ultima facturacion (cliente+sucursal)
    let dispatchsByLastInvoice = await this.getInvoiceDetailUnitsFromLastClientInvoice(
      dbServ, idProductUnits, idClient, idAddressClient
    );
    

    //Cambio por cambio
    let straightSwaps = await this.getStraightSwapsByClientStock(dbServ, idProducts, 
      idUnits, idEnterprise, idClient, idAddressClient, dateLastInventory);
    for (var i = 0; i < straightSwaps.length; i++) {
      let idProduct = straightSwaps[i].idProduct;
      let idProductUnit = straightSwaps[i].idProductUnit;
      let quStock = straightSwaps[i].quSwap;
      let mapUnits = mapProducts.get(idProduct);
      if(mapUnits != undefined){
        let unitUtil = mapUnits.get(idProductUnit);
        if(unitUtil != undefined){
          unitUtil.straightSwapStock += quStock;
        }
      }
    }

    //inventario inicial se calcula con el paso anterior
    //inventario actual se agregó antes del if porque se necesita para ambos casos
    //devolución por distribución
    let returnsByDistribution = await this.getReturnsByDistribution(dbServ, idProducts, coUnits, idEnterprise, idClient, dateLastInventory);
    if(typeof returnsByDistribution != "undefined"){
    for (var i = 0; i < returnsByDistribution.length; i++) {
      let idProduct = returnsByDistribution[i].idProduct;
      let coUnit = returnsByDistribution[i].coMeasureUnit;
      let quStock = returnsByDistribution[i].quProduct;
      let mapUnits = mapProducts.get(idProduct);
      if(mapUnits != undefined){
        //como el return es por unidad y no por product unit, se busca la unidad dentro de las unidades del producto para asignar la devolución
        for(const [idProductUnit, unitUtil] of mapUnits){
          if(unitUtil.coUnit == coUnit){
          unitUtil.returnedStock += quStock;
          break;
        }
      }
    }
  }
}
    //Pedido Sugerido = Venta/Dias desde ultima visita × Días hasta la próxima visita
    for(const [idProduct, mapUnits] of mapProducts){
      for(const [idProductUnit, unitUtil] of mapUnits){
        let dispatched = dispatchsByLastInvoice.find(d => d.idProductUnit == idProductUnit);
        if(dispatched != undefined){
          unitUtil.dispatchedStock = dispatched.quInvoice;
        }
      //Inventario Inicial = Inventario anterior + Despacho + Cambio por cambio
        unitUtil.initialStock = unitUtil.previousStock + unitUtil.dispatchedStock + unitUtil.straightSwapStock;
        //Venta = Inventario Inicial - Inventario actual - Devolución por distribución
        unitUtil.soldUnits = unitUtil.initialStock - unitUtil.currentStock - unitUtil.returnedStock;
        //Pedido Sugerido = Venta/Dias desde ultima visita × Días hasta la próxima visita
        unitUtil.estimatedDailyUnits = unitUtil.soldUnits / daysSinceLastInventory;
        if(unitUtil.estimatedDailyUnits < 0){
          unitUtil.estimatedDailyUnits = 0;
        }
        unitUtil.quUnitSuggested = Math.round(unitUtil.estimatedDailyUnits * daysUntilNextInventory);
        if(unitUtil.quUnitSuggested < 0){
          unitUtil.quUnitSuggested = 0;
        }
        // Si Inventario actual >= sugerido, entonces sugerido = 0
        // Es decir, ya tiene lo que va a usar hasta la siguiente visita.
        if(unitUtil.currentStock >= unitUtil.quUnitSuggested){
          unitUtil.quUnitSuggested = 0;
        }
      }
    }

    }else{
      //version anterior que solo usa average diario de venta
    let listAvgProduct = await this.orderDbServ.getClientAvgStock(dbServ, idEnterprise, idClient, idProductUnits, idAddressClient, idProducts);
    for (var i = 0; i < listAvgProduct.length; i++) {
      let idProduct = listAvgProduct[i].idProduct;
      let idProductUnit = listAvgProduct[i].idProductUnit;
      let quAvg = listAvgProduct[i].average;
      let mapUnits = mapProducts.get(idProduct);
      if(mapUnits != undefined){
        let unitUtil = mapUnits.get(idProductUnit);
        if(unitUtil != undefined){
          unitUtil.dispatchedStock = quAvg;
        }
        
      }
    }
    for(const [idProduct, mapUnits] of mapProducts){
      for(const [idProductUnit, unitUtil] of mapUnits){
        if(unitUtil.dispatchedStock > 0){
          unitUtil.quUnitSuggested = unitUtil.dispatchedStock - unitUtil.currentStock;
          if(unitUtil.quUnitSuggested < 0){
            unitUtil.quUnitSuggested = 0;
          }
        }else{
          unitUtil.quUnitSuggested = unitUtil.currentStock;
        }
      }
    }
    }
    this.productsSuggested = this.mapProductsToProductSuggestedUtil(mapProducts);
    this.idProductsSuggested = idProducts;
    this.idProductsUnitsSuggested = idProductUnits;
    this.idUnitsSuggested = idUnits;
  }

  getMappedProductUtils() {
    let mapProducts = new Map<number, Map<number, UnitSuggestedUtil>>();
    for (var i = 0; i < this.newClientStock.clientStockDetails.length; i++) {
      let mapUnits = new Map<number, UnitSuggestedUtil>();
      for (var j = 0; j < this.newClientStock.clientStockDetails[i].clientStockDetailUnits.length; j++) {
        let unit = mapUnits.get(this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].idProductUnit);
        if(unit){
          //Actualizamos el stock actual sumando las unidades de cada detalle, esto para tener un total por unidad de producto y no por detalle
          unit.currentStock += this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].quStock;
          mapUnits.set(unit.idProductUnit, unit);
          continue;
        }else{
        let unitSuggestedUtil: UnitSuggestedUtil = {
          idUnit: this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].idUnit,
          idProductUnit: this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].idProductUnit,
          coUnit: this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].coUnit,
          quUnitSuggested: 0,
          previousStock: 0,
          currentStock: this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].quStock,
          dispatchedStock: 0,
          straightSwapStock: 0,
          returnedStock: 0,
          initialStock: 0,
          estimatedDailyUnits: 0,
          soldUnits: 0

        }
        
        mapUnits.set(this.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].idProductUnit, unitSuggestedUtil);
      }
      }
      mapProducts.set(this.newClientStock.clientStockDetails[i].idProduct, mapUnits);
    }
    return mapProducts;
  }

  mapProductsToProductSuggestedUtil(mapProducts: Map<number, Map<number, UnitSuggestedUtil>>): ProductSuggestedUtil[] {
    let productsSuggested: ProductSuggestedUtil[] = [];
    for (const [idProduct, mapUnits] of mapProducts) {
      let productSuggested: ProductSuggestedUtil = {
        idProduct: idProduct,
        unitsSuggested: []
      }
      for (const [idUnit, unitUtil] of mapUnits) {
        productSuggested.unitsSuggested.push(unitUtil);
      }
      productsSuggested.push(productSuggested);
    }
    return productsSuggested;
  }

  getIdUnitsByProductUnit(dbServ: SQLiteObject, idProductUnits: number[]) {
    let idUnits: number[] = [];
    let selectStatement = `SELECT id_unit FROM product_units WHERE id_product_unit IN (${idProductUnits.join(",")})`;
    return dbServ.executeSql(selectStatement, []).then(result => {
      for (var i = 0; i < result.rows.length; i++) {
        idUnits.push(result.rows.item(i).id_unit);
      }
      return idUnits;
    });
  }

  async deleteSuggestedOrderSnapshot(dbServ: SQLiteObject, coClientStock: string): Promise<void> {
    if (!coClientStock) {
      return;
    }
    try {
      const headerRows = await dbServ.executeSql(
        'SELECT co_client_stock_suggested_order FROM client_stock_suggested_orders WHERE co_client_stock = ?',
        [coClientStock],
      );
      const batch: (string | (string | number | null)[])[][] = [];
      for (let i = 0; i < headerRows.rows.length; i++) {
        const coSuggested = headerRows.rows.item(i).co_client_stock_suggested_order as string;
        batch.push([
          'DELETE FROM client_stock_suggested_order_details WHERE co_client_stock_suggested_order = ?',
          [coSuggested],
        ]);
      }
      batch.push([
        'DELETE FROM client_stock_suggested_orders WHERE co_client_stock = ?',
        [coClientStock],
      ]);
      if (batch.length > 0) {
        await dbServ.sqlBatch(batch);
      }
    } catch (e) {
      console.log('[deleteSuggestedOrderSnapshot]', e);
    }
  }

  private resolveSuggestedProductLabels(
    idProduct: number,
    idUnit: number,
    idProductUnit: number,
  ): { coProduct: string; naProduct: string; coUnit: string; naUnit: string; coProductUnit: string } {
    const detail = this.newClientStock.clientStockDetails?.find(d => d.idProduct === idProduct);
    const unitRow = detail?.clientStockDetailUnits?.find(
      u => u.idProductUnit === idProductUnit || u.idUnit === idUnit,
    );
    return {
      coProduct: detail?.coProduct ?? '',
      naProduct: detail?.naProduct ?? '',
      coUnit: unitRow?.coUnit ?? '',
      naUnit: unitRow?.naUnit ?? '',
      coProductUnit: unitRow?.coProductUnit ?? '',
    };
  }

  setAttachSuggestedOrderOnStockSend(coClientStock: string, attach: boolean): void {
    if (!coClientStock) {
      return;
    }
    this.suggestedOrderAttachOnStockSend.set(coClientStock, attach);
  }

  setForceAttachSuggestedOrderOnStockSend(coClientStock: string): void {
    if (!coClientStock) {
      return;
    }
    this.forceSuggestedOrderAttachOnStockSend.add(coClientStock);
  }

  shouldAttachSuggestedOrderOnStockSend(coClientStock: string): boolean {
    if (!coClientStock) {
      return false;
    }
    if (this.forceSuggestedOrderAttachOnStockSend.has(coClientStock)) {
      return true;
    }
    if (this.suggestedOrderAttachOnStockSend.has(coClientStock)) {
      return this.suggestedOrderAttachOnStockSend.get(coClientStock) ?? false;
    }
    return false;
  }

  clearSuggestedOrderSendFlags(coClientStock: string): void {
    if (!coClientStock) {
      return;
    }
    this.suggestedOrderAttachOnStockSend.delete(coClientStock);
    this.forceSuggestedOrderAttachOnStockSend.delete(coClientStock);
  }

  async saveSuggestedOrderSnapshot(
    dbServ: SQLiteObject,
    moneda?: CurrencyEnterprise,
  ): Promise<void> {
    const stock = this.newClientStock;
    const coClientStock = stock.coClientStock;
    if (!coClientStock) {
      return;
    }

    const existing = await this.getSuggestedOrderSnapshotByClientStock(dbServ, coClientStock);
    const coSuggestedOrder = existing?.coClientStockSuggestedOrder ?? this.dateServ.generateCO(0);

    if (existing?.coClientStockSuggestedOrder) {
      await dbServ.executeSql(
        'DELETE FROM client_stock_suggested_order_details WHERE co_client_stock_suggested_order = ?',
        [existing.coClientStockSuggestedOrder],
      );
    }

    const details: ClientStockSuggestedOrderDetail[] = [];
    let posicion = 0;
    const productsSuggested = this.productsSuggested ?? [];

    for (const product of productsSuggested) {
      for (const unit of product.unitsSuggested) {
        const labels = this.resolveSuggestedProductLabels(
          product.idProduct,
          unit.idUnit,
          unit.idProductUnit,
        );
        details.push(new ClientStockSuggestedOrderDetail(
          null,
          this.dateServ.generateCO(posicion + 1),
          coSuggestedOrder,
          product.idProduct,
          labels.coProduct,
          labels.naProduct,
          unit.idProductUnit,
          labels.coProductUnit,
          unit.idUnit,
          unit.coUnit || labels.coUnit,
          labels.naUnit,
          stock.idEnterprise,
          stock.coEnterprise,
          posicion,
          unit.quUnitSuggested ?? 0,
          unit.previousStock ?? 0,
          unit.currentStock ?? 0,
          unit.dispatchedStock ?? 0,
          unit.straightSwapStock ?? 0,
          unit.returnedStock ?? 0,
          unit.initialStock ?? 0,
          unit.soldUnits ?? 0,
          unit.estimatedDailyUnits ?? 0,
        ));
        posicion++;
      }
    }

    const header = new ClientStockSuggestedOrder(
      existing?.idClientStockSuggestedOrder ?? null,
      coSuggestedOrder,
      coClientStock,
      stock.idClientStock ?? null,
      stock.idClient,
      stock.coClient,
      stock.idAddressClient,
      stock.coAddressClient,
      stock.idEnterprise,
      stock.coEnterprise,
      stock.idUser,
      stock.coUser,
      stock.daysSinceLast ?? 1,
      stock.daysUntilNext ?? 1,
      this.suggestedOrderByDispatchAndReturn ? 1 : 0,
      moneda?.idCurrency ?? existing?.idCurrency ?? null,
      moneda?.coCurrency ?? existing?.coCurrency ?? null,
      this.dateServ.hoyISOFullTime(),
      details.length,
      existing?.coOrder ?? null,
      existing?.idOrder ?? null,
      existing?.inOrderSent ?? 0,
      details,
    );

    const batch: (string | (string | number | null)[])[][] = [
      [this.suggestedOrderHeaderInsertSql, this.buildSuggestedOrderHeaderBatchRow(header)],
    ];

    for (const detail of details) {
      batch.push([this.suggestedOrderDetailInsertSql, this.buildSuggestedOrderDetailBatchRow(detail)]);
    }

    await dbServ.sqlBatch(batch);
  }

  async markSuggestedOrderLinked(
    dbServ: SQLiteObject,
    coClientStock: string | null | undefined,
    coOrder: string,
    idOrder: number | null | undefined,
    sent: boolean,
  ): Promise<void> {
    if (!coClientStock) {
      return;
    }
    try {
      if (sent) {
        await dbServ.executeSql(
          'UPDATE client_stock_suggested_orders SET in_order_sent = 1, co_order = ?, id_order = ? WHERE co_client_stock = ?',
          [coOrder, idOrder ?? null, coClientStock],
        );
      } else {
        await dbServ.executeSql(
          'UPDATE client_stock_suggested_orders SET co_order = ?, id_order = ? WHERE co_client_stock = ?',
          [coOrder, idOrder ?? null, coClientStock],
        );
      }
      await this.trySyncSuggestedOrderLink(dbServ, coClientStock);
    } catch (e) {
      console.log('[markSuggestedOrderLinked]', e);
    }
  }

  private readonly suggestedOrderHeaderInsertSql = 'INSERT OR REPLACE INTO client_stock_suggested_orders ('
    + 'id_client_stock_suggested_order, co_client_stock_suggested_order, co_client_stock, id_client_stock, '
    + 'id_client, co_client, id_address_client, co_address_client, id_enterprise, co_enterprise, id_user, co_user, '
    + 'days_since_last, days_until_next, by_dispatch_and_return, id_currency, co_currency, da_suggested, '
    + 'nu_details, co_order, id_order, in_order_sent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

  private readonly suggestedOrderDetailInsertSql = 'INSERT OR REPLACE INTO client_stock_suggested_order_details ('
    + 'id_client_stock_suggested_order_detail, co_client_stock_suggested_order_detail, co_client_stock_suggested_order, '
    + 'id_product, co_product, na_product, id_product_unit, co_product_unit, id_unit, co_unit, na_unit, '
    + 'id_enterprise, co_enterprise, posicion, qu_unit_suggested, previous_stock, current_stock, dispatched_stock, '
    + 'straight_swap_stock, returned_stock, initial_stock, sold_units, estimated_daily_units) '
    + 'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

  private buildSuggestedOrderHeaderBatchRow(header: ClientStockSuggestedOrder): (string | number | null)[] {
    return [
      header.idClientStockSuggestedOrder,
      header.coClientStockSuggestedOrder,
      header.coClientStock,
      header.idClientStock,
      header.idClient,
      header.coClient,
      header.idAddressClient,
      header.coAddressClient,
      header.idEnterprise,
      header.coEnterprise,
      header.idUser,
      header.coUser,
      header.daysSinceLast,
      header.daysUntilNext,
      header.byDispatchAndReturn,
      header.idCurrency,
      header.coCurrency,
      header.daSuggested,
      header.nuDetails,
      header.coOrder,
      header.idOrder,
      header.inOrderSent,
    ];
  }

  private buildSuggestedOrderDetailBatchRow(detail: ClientStockSuggestedOrderDetail): (string | number | null)[] {
    return [
      detail.idClientStockSuggestedOrderDetail,
      detail.coClientStockSuggestedOrderDetail,
      detail.coClientStockSuggestedOrder,
      detail.idProduct,
      detail.coProduct,
      detail.naProduct,
      detail.idProductUnit,
      detail.coProductUnit,
      detail.idUnit,
      detail.coUnit,
      detail.naUnit,
      detail.idEnterprise,
      detail.coEnterprise,
      detail.posicion,
      detail.quUnitSuggested,
      detail.previousStock,
      detail.currentStock,
      detail.dispatchedStock,
      detail.straightSwapStock,
      detail.returnedStock,
      detail.initialStock,
      detail.soldUnits,
      detail.estimatedDailyUnits,
    ];
  }

  private async persistSuggestedOrderHeader(
    dbServ: SQLiteObject,
    header: ClientStockSuggestedOrder,
  ): Promise<void> {
    await dbServ.executeSql(
      this.suggestedOrderHeaderInsertSql,
      this.buildSuggestedOrderHeaderBatchRow(header),
    );
  }

  async mergeSyncedSuggestedOrdersWithLocal(
    dbServ: SQLiteObject,
    serverRows: ClientStockSuggestedOrder[],
  ): Promise<void> {
    for (const rawRow of serverRows ?? []) {
      const normalized = ClientStockSuggestedOrder.fromJson(rawRow as ClientStockSuggestedOrder);
      if (!normalized.coClientStockSuggestedOrder) {
        continue;
      }

      const localRes = await dbServ.executeSql(
        'SELECT s.*, cs.st_delivery AS cs_st_delivery FROM client_stock_suggested_orders s '
        + 'LEFT JOIN client_stocks cs ON cs.co_client_stock = s.co_client_stock '
        + 'WHERE s.co_client_stock_suggested_order = ? LIMIT 1',
        [normalized.coClientStockSuggestedOrder],
      );

      if (localRes.rows.length > 0) {
        const local = this.mapSuggestedOrderHeaderRow(localRes.rows.item(0));
        const stDelivery = localRes.rows.item(0).cs_st_delivery as number | null | undefined;
        const inventarioNotSent = stDelivery != null
          && Number(stDelivery) !== DELIVERY_STATUS_SENT
          && Number(stDelivery) !== 1;
        const localNoServerId = !local.idClientStockSuggestedOrder || Number(local.idClientStockSuggestedOrder) <= 0;
        const serverHasId = normalized.idClientStockSuggestedOrder != null
          && Number(normalized.idClientStockSuggestedOrder) > 0;

        if (localNoServerId && inventarioNotSent && !serverHasId) {
          continue;
        }

        if (localNoServerId && inventarioNotSent && serverHasId) {
          await dbServ.executeSql(
            'UPDATE client_stock_suggested_orders SET id_client_stock_suggested_order = ?, '
            + 'id_client_stock = COALESCE(?, id_client_stock), co_order = COALESCE(?, co_order), '
            + 'id_order = COALESCE(?, id_order), in_order_sent = CASE WHEN ? = 1 THEN 1 ELSE in_order_sent END '
            + 'WHERE co_client_stock_suggested_order = ?',
            [
              normalized.idClientStockSuggestedOrder,
              normalized.idClientStock,
              normalized.coOrder,
              normalized.idOrder,
              normalized.inOrderSent,
              normalized.coClientStockSuggestedOrder,
            ],
          );
          continue;
        }
      }

      await this.persistSuggestedOrderHeader(dbServ, normalized);
    }
  }

  async mergeSyncedSuggestedOrderDetailsWithLocal(
    dbServ: SQLiteObject,
    serverRows: ClientStockSuggestedOrderDetail[],
  ): Promise<void> {
    const batch: (string | (string | number | null)[])[][] = [];
    for (const rawRow of serverRows ?? []) {
      const detail = ClientStockSuggestedOrderDetail.fromJson(rawRow as ClientStockSuggestedOrderDetail);
      if (!detail.coClientStockSuggestedOrderDetail) {
        continue;
      }
      batch.push([
        this.suggestedOrderDetailInsertSql,
        this.buildSuggestedOrderDetailBatchRow(detail),
      ]);
    }
    if (batch.length > 0) {
      await dbServ.sqlBatch(batch);
    }
  }

  async getSuggestedOrderSnapshotByClientStock(
    dbServ: SQLiteObject,
    coClientStock: string,
  ): Promise<ClientStockSuggestedOrder | null> {
    if (!coClientStock) {
      return null;
    }
    try {
      const headerData = await dbServ.executeSql(
        'SELECT * FROM client_stock_suggested_orders WHERE co_client_stock = ? ORDER BY da_suggested DESC LIMIT 1',
        [coClientStock],
      );
      if (headerData.rows.length < 1) {
        return null;
      }
      const snapshot = this.mapSuggestedOrderHeaderRow(headerData.rows.item(0));
      const detailData = await dbServ.executeSql(
        'SELECT * FROM client_stock_suggested_order_details WHERE co_client_stock_suggested_order = ? ORDER BY posicion ASC',
        [snapshot.coClientStockSuggestedOrder],
      );
      snapshot.details = [];
      for (let i = 0; i < detailData.rows.length; i++) {
        snapshot.details.push(this.mapSuggestedOrderDetailRow(detailData.rows.item(i)));
      }
      return snapshot;
    } catch (e) {
      console.log('[getSuggestedOrderSnapshotByClientStock]', e);
      return null;
    }
  }

  async applyServerSuggestedOrderIdsFromResponse(
    dbServ: SQLiteObject,
    coClientStock: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    const nested = result['clientStockSuggestedOrder'] as ClientStockSuggestedOrder | undefined;
    const headerId = Number(
      result['clientStockSuggestedOrderId']
      ?? nested?.idClientStockSuggestedOrder
      ?? 0,
    );
    if (!coClientStock || headerId <= 0) {
      return;
    }

    const snapshot = await this.getSuggestedOrderSnapshotByClientStock(dbServ, coClientStock);
    if (!snapshot?.coClientStockSuggestedOrder) {
      return;
    }

    await dbServ.executeSql(
      'UPDATE client_stock_suggested_orders SET id_client_stock_suggested_order = ?, id_client_stock = COALESCE(?, id_client_stock) '
      + 'WHERE co_client_stock_suggested_order = ?',
      [headerId, result['clientStockId'] ?? null, snapshot.coClientStockSuggestedOrder],
    );

    const detailIds = (
      result['clientStockSuggestedOrderDetails']
      ?? nested?.details
      ?? []
    ) as ClientStockSuggestedOrderDetail[];

    for (const detailRow of detailIds) {
      const coDetail = detailRow.coClientStockSuggestedOrderDetail;
      const idDetail = detailRow.idClientStockSuggestedOrderDetail;
      if (!coDetail || idDetail == null || Number(idDetail) <= 0) {
        continue;
      }
      await dbServ.executeSql(
        'UPDATE client_stock_suggested_order_details SET id_client_stock_suggested_order_detail = ? '
        + 'WHERE co_client_stock_suggested_order_detail = ?',
        [idDetail, coDetail],
      );
    }
  }

  private buildSuggestedOrderLinkPayload(snapshot: ClientStockSuggestedOrder): Record<string, unknown> {
    return {
      clientStockSuggestedOrder: {
        idClientStockSuggestedOrder: snapshot.idClientStockSuggestedOrder,
        coClientStockSuggestedOrder: snapshot.coClientStockSuggestedOrder,
        coClientStock: snapshot.coClientStock,
        coOrder: snapshot.coOrder,
        idOrder: snapshot.idOrder,
        inOrderSent: snapshot.inOrderSent,
      },
    };
  }

  async trySyncSuggestedOrderLink(
    dbServ: SQLiteObject,
    coClientStock: string,
  ): Promise<void> {
    const connected = localStorage.getItem('connected') === 'true';
    const snapshot = await this.getSuggestedOrderSnapshotByClientStock(dbServ, coClientStock);
    if (!snapshot?.idClientStockSuggestedOrder || Number(snapshot.idClientStockSuggestedOrder) <= 0) {
      return;
    }

    if (!connected) {
      await this.queueSuggestedOrderLinkPending(dbServ, coClientStock);
      return;
    }

    try {
      const payload = this.buildSuggestedOrderLinkPayload(snapshot);
      let opt = this.services.getHttpOptionsAuthorization();
      opt.url += 'clientstockservice/clientstocksuggestedorderlink';
      opt.data = payload;
      const resp = await firstValueFrom(from(CapacitorHttp.post(opt)).pipe(map(r => r.data)));
      if (resp?.errorCode === '000') {
        await this.clearSuggestedOrderLinkPending(dbServ, coClientStock);
        return;
      }
      await this.queueSuggestedOrderLinkPending(dbServ, coClientStock);
    } catch (e) {
      console.log('[trySyncSuggestedOrderLink]', e);
      await this.queueSuggestedOrderLinkPending(dbServ, coClientStock);
    }
  }

  async queueSuggestedOrderLinkPending(
    dbServ: SQLiteObject,
    coClientStock: string,
  ): Promise<void> {
    const snapshot = await this.getSuggestedOrderSnapshotByClientStock(dbServ, coClientStock);
    if (!snapshot?.idClientStockSuggestedOrder || Number(snapshot.idClientStockSuggestedOrder) <= 0) {
      return;
    }
    const pending: PendingTransaction = {
      coTransaction: coClientStock,
      idTransaction: snapshot.idOrder ?? 0,
      type: 'suggestedOrderLink',
    };
    await this.services.insertPendingTransaction(dbServ, pending);
  }

  private async clearSuggestedOrderLinkPending(
    dbServ: SQLiteObject,
    coClientStock: string,
  ): Promise<void> {
    await dbServ.executeSql(
      'DELETE FROM pending_transactions WHERE co_transaction = ? AND type = ?',
      [coClientStock, 'suggestedOrderLink'],
    );
  }

  async dispatchSuggestedOrderLinkSync(
    dbServ: SQLiteObject,
    coClientStock: string,
  ): Promise<boolean> {
    const connected = localStorage.getItem('connected') === 'true';
    if (!connected) {
      return true;
    }
    const snapshot = await this.getSuggestedOrderSnapshotByClientStock(dbServ, coClientStock);
    if (!snapshot?.idClientStockSuggestedOrder || Number(snapshot.idClientStockSuggestedOrder) <= 0) {
      return true;
    }
    try {
      const payload = this.buildSuggestedOrderLinkPayload(snapshot);
      let opt = this.services.getHttpOptionsAuthorization();
      opt.url += 'clientstockservice/clientstocksuggestedorderlink';
      opt.data = payload;
      const resp = await firstValueFrom(from(CapacitorHttp.post(opt)).pipe(map(r => r.data)));
      if (resp?.errorCode === '000') {
        await this.clearSuggestedOrderLinkPending(dbServ, coClientStock);
        return true;
      }
      return false;
    } catch (e) {
      console.log('[dispatchSuggestedOrderLinkSync]', e);
      return false;
    }
  }

  prepareSuggestedOrderSnapshotForUpload(
    snapshot: ClientStockSuggestedOrder,
    nullifyServerIds: boolean,
  ): ClientStockSuggestedOrder {
    const copy = ClientStockSuggestedOrder.fromJson({
      idClientStockSuggestedOrder: snapshot.idClientStockSuggestedOrder,
      coClientStockSuggestedOrder: snapshot.coClientStockSuggestedOrder,
      coClientStock: snapshot.coClientStock,
      idClientStock: snapshot.idClientStock,
      idClient: snapshot.idClient,
      coClient: snapshot.coClient,
      idAddressClient: snapshot.idAddressClient,
      coAddressClient: snapshot.coAddressClient,
      idEnterprise: snapshot.idEnterprise,
      coEnterprise: snapshot.coEnterprise,
      idUser: snapshot.idUser,
      coUser: snapshot.coUser,
      daysSinceLast: snapshot.daysSinceLast,
      daysUntilNext: snapshot.daysUntilNext,
      byDispatchAndReturn: snapshot.byDispatchAndReturn,
      idCurrency: snapshot.idCurrency,
      coCurrency: snapshot.coCurrency,
      daSuggested: snapshot.daSuggested,
      nuDetails: snapshot.nuDetails,
      coOrder: snapshot.coOrder,
      idOrder: snapshot.idOrder,
      inOrderSent: snapshot.inOrderSent,
      details: snapshot.details?.map(d => ({
        idClientStockSuggestedOrderDetail: d.idClientStockSuggestedOrderDetail,
        coClientStockSuggestedOrderDetail: d.coClientStockSuggestedOrderDetail,
        coClientStockSuggestedOrder: d.coClientStockSuggestedOrder,
        idProduct: d.idProduct,
        coProduct: d.coProduct,
        naProduct: d.naProduct,
        idProductUnit: d.idProductUnit,
        coProductUnit: d.coProductUnit,
        idUnit: d.idUnit,
        coUnit: d.coUnit,
        naUnit: d.naUnit,
        idEnterprise: d.idEnterprise,
        coEnterprise: d.coEnterprise,
        posicion: d.posicion,
        quUnitSuggested: d.quUnitSuggested,
        previousStock: d.previousStock,
        currentStock: d.currentStock,
        dispatchedStock: d.dispatchedStock,
        straightSwapStock: d.straightSwapStock,
        returnedStock: d.returnedStock,
        initialStock: d.initialStock,
        soldUnits: d.soldUnits,
        estimatedDailyUnits: d.estimatedDailyUnits,
      })) ?? [],
    });
    if (nullifyServerIds) {
      copy.idClientStockSuggestedOrder = null;
      for (const detail of copy.details) {
        detail.idClientStockSuggestedOrderDetail = null;
      }
    }
    return copy;
  }

  async deleteSuggestedOrderRowsByCo(
    dbServ: SQLiteObject,
    coList: string[],
    table: 'header' | 'detail',
  ): Promise<void> {
    if (!coList?.length) {
      return;
    }
    const placeholders = coList.map(() => '?').join(',');
    if (table === 'detail') {
      await dbServ.executeSql(
        `DELETE FROM client_stock_suggested_order_details WHERE co_client_stock_suggested_order_detail IN (${placeholders})`,
        coList,
      );
      return;
    }
    const batch: (string | (string | number | null)[])[][] = [];
    for (const co of coList) {
      batch.push([
        'DELETE FROM client_stock_suggested_order_details WHERE co_client_stock_suggested_order = ?',
        [co],
      ]);
    }
    batch.push([
      `DELETE FROM client_stock_suggested_orders WHERE co_client_stock_suggested_order IN (${placeholders})`,
      coList,
    ]);
    await dbServ.sqlBatch(batch);
  }

  isSuggestedOrderSent(snapshot: ClientStockSuggestedOrder | ItemListaPedidoSugerido): boolean {
    return Number(snapshot.inOrderSent) === 1;
  }

  private mapSuggestedOrderHeaderRow(row: any): ClientStockSuggestedOrder {
    return ClientStockSuggestedOrder.fromJson({
      idClientStockSuggestedOrder: row.id_client_stock_suggested_order,
      coClientStockSuggestedOrder: row.co_client_stock_suggested_order,
      coClientStock: row.co_client_stock,
      idClientStock: row.id_client_stock,
      idClient: row.id_client,
      coClient: row.co_client,
      idAddressClient: row.id_address_client,
      coAddressClient: row.co_address_client,
      idEnterprise: row.id_enterprise,
      coEnterprise: row.co_enterprise,
      idUser: row.id_user,
      coUser: row.co_user,
      daysSinceLast: row.days_since_last,
      daysUntilNext: row.days_until_next,
      byDispatchAndReturn: row.by_dispatch_and_return,
      idCurrency: row.id_currency,
      coCurrency: row.co_currency,
      daSuggested: row.da_suggested,
      nuDetails: row.nu_details,
      coOrder: row.co_order,
      idOrder: row.id_order,
      inOrderSent: row.in_order_sent,
      details: [],
    });
  }

  private mapSuggestedOrderDetailRow(row: any): ClientStockSuggestedOrderDetail {
    return ClientStockSuggestedOrderDetail.fromJson({
      idClientStockSuggestedOrderDetail: row.id_client_stock_suggested_order_detail,
      coClientStockSuggestedOrderDetail: row.co_client_stock_suggested_order_detail,
      coClientStockSuggestedOrder: row.co_client_stock_suggested_order,
      idProduct: row.id_product,
      coProduct: row.co_product,
      naProduct: row.na_product,
      idProductUnit: row.id_product_unit,
      coProductUnit: row.co_product_unit,
      idUnit: row.id_unit,
      coUnit: row.co_unit,
      naUnit: row.na_unit,
      idEnterprise: row.id_enterprise,
      coEnterprise: row.co_enterprise,
      posicion: row.posicion,
      quUnitSuggested: row.qu_unit_suggested,
      previousStock: row.previous_stock,
      currentStock: row.current_stock,
      dispatchedStock: row.dispatched_stock,
      straightSwapStock: row.straight_swap_stock,
      returnedStock: row.returned_stock,
      initialStock: row.initial_stock,
      soldUnits: row.sold_units,
      estimatedDailyUnits: row.estimated_daily_units,
    });
  }

  async getAllSuggestedOrderSnapshots(dbServ: SQLiteObject): Promise<ItemListaPedidoSugerido[]> {
    const select = 'SELECT s.id_client_stock_suggested_order, s.co_client_stock_suggested_order, s.co_client_stock, '
      + 's.id_client_stock, s.id_client, s.co_client, s.id_address_client, s.co_address_client, s.id_enterprise, '
      + 's.co_enterprise, s.id_user, s.co_user, s.days_since_last, s.days_until_next, s.by_dispatch_and_return, '
      + 's.id_currency, s.co_currency, s.da_suggested, s.nu_details, s.co_order, s.id_order, s.in_order_sent, '
      + 'COALESCE(cs.lb_client, c.lb_client, \'\') AS lb_client, COALESCE(cs.da_client_stock, \'\') AS da_client_stock '
      + 'FROM client_stock_suggested_orders s '
      + 'LEFT JOIN client_stocks cs ON cs.co_client_stock = s.co_client_stock '
      + 'LEFT JOIN clients c ON c.id_client = s.id_client '
      + 'ORDER BY s.da_suggested DESC';

    try {
      const data = await dbServ.executeSql(select, []);
      const items: ItemListaPedidoSugerido[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        const row = data.rows.item(i);
        const header = this.mapSuggestedOrderHeaderRow(row);
        items.push({
          ...header,
          lbClient: row.lb_client ?? '',
          daClientStock: row.da_client_stock ?? '',
        });
      }
      return items;
    } catch (e) {
      console.log('[getAllSuggestedOrderSnapshots]', e);
      return [];
    }
  }

  async getSuggestedOrderSnapshotByCo(
    dbServ: SQLiteObject,
    coClientStockSuggestedOrder: string,
  ): Promise<ClientStockSuggestedOrder | null> {
    if (!coClientStockSuggestedOrder) {
      return null;
    }
    try {
      const headerData = await dbServ.executeSql(
        'SELECT * FROM client_stock_suggested_orders WHERE co_client_stock_suggested_order = ? LIMIT 1',
        [coClientStockSuggestedOrder],
      );
      if (headerData.rows.length < 1) {
        return null;
      }
      const snapshot = this.mapSuggestedOrderHeaderRow(headerData.rows.item(0));
      const detailData = await dbServ.executeSql(
        'SELECT * FROM client_stock_suggested_order_details WHERE co_client_stock_suggested_order = ? ORDER BY posicion ASC',
        [coClientStockSuggestedOrder],
      );
      snapshot.details = [];
      for (let i = 0; i < detailData.rows.length; i++) {
        snapshot.details.push(this.mapSuggestedOrderDetailRow(detailData.rows.item(i)));
      }
      return snapshot;
    } catch (e) {
      console.log('[getSuggestedOrderSnapshotByCo]', e);
      return null;
    }
  }

  mapSnapshotToPreviewData(snapshot: ClientStockSuggestedOrder): {
    productsSuggested: ProductSuggestedUtil[];
    clientStockDetails: ClientStocksDetail[];
    empresaSeleccionada: Enterprise;
    diasDesdeUltimoInventario: number;
    diasHastaSiguienteInventario: number;
    monedaInicial: CurrencyEnterprise | null;
    suggestedOrderByDispatchAndReturn: boolean;
    blockCreateSuggestedOrder: boolean;
  } {
    const productsSuggested = this.mapSnapshotDetailsToProductSuggestedUtil(snapshot.details);
    const clientStockDetails = this.mapSnapshotDetailsToClientStockDetails(snapshot.details);
    const empresaSeleccionada = {
      idEnterprise: snapshot.idEnterprise,
      coEnterprise: snapshot.coEnterprise,
    } as Enterprise;
    const monedaInicial = snapshot.idCurrency != null && snapshot.coCurrency
      ? ({ idCurrency: snapshot.idCurrency, coCurrency: snapshot.coCurrency } as CurrencyEnterprise)
      : null;

    return {
      productsSuggested,
      clientStockDetails,
      empresaSeleccionada,
      diasDesdeUltimoInventario: snapshot.daysSinceLast ?? 1,
      diasHastaSiguienteInventario: snapshot.daysUntilNext ?? 1,
      monedaInicial,
      suggestedOrderByDispatchAndReturn: Number(snapshot.byDispatchAndReturn) === 1,
      blockCreateSuggestedOrder: this.isSuggestedOrderSent(snapshot),
    };
  }

  private mapSnapshotDetailsToProductSuggestedUtil(
    details: ClientStockSuggestedOrderDetail[],
  ): ProductSuggestedUtil[] {
    const byProduct = new Map<number, ProductSuggestedUtil>();
    for (const detail of details) {
      let product = byProduct.get(detail.idProduct);
      if (!product) {
        product = new ProductSuggestedUtil(detail.idProduct, []);
        byProduct.set(detail.idProduct, product);
      }
      product.unitsSuggested.push(new UnitSuggestedUtil(
        detail.idUnit,
        detail.coUnit,
        detail.idProductUnit,
        detail.quUnitSuggested,
        detail.previousStock,
        detail.currentStock,
        detail.dispatchedStock,
        detail.straightSwapStock,
        detail.returnedStock,
        detail.initialStock,
        detail.estimatedDailyUnits,
        detail.soldUnits,
      ));
    }
    return Array.from(byProduct.values());
  }

  private mapSnapshotDetailsToClientStockDetails(
    details: ClientStockSuggestedOrderDetail[],
  ): ClientStocksDetail[] {
    const byProduct = new Map<number, ClientStocksDetail>();
    for (const detail of details) {
      let stockDetail = byProduct.get(detail.idProduct);
      if (!stockDetail) {
        stockDetail = new ClientStocksDetail(
          null,
          '',
          '',
          detail.idProduct,
          detail.coProduct,
          detail.naProduct,
          detail.idEnterprise,
          detail.coEnterprise,
          false,
          detail.posicion,
          true,
          [],
          [],
        );
        byProduct.set(detail.idProduct, stockDetail);
      }
      stockDetail.clientStockDetailUnits.push({
        idClientStockDetailUnit: 0,
        coClientStockDetailUnit: '',
        coClientStockDetail: '',
        coProductUnit: detail.coProductUnit,
        idUnit: detail.idUnit,
        coUnit: detail.coUnit,
        idProductUnit: detail.idProductUnit,
        naUnit: detail.naUnit,
        quStock: detail.currentStock,
        quSuggested: detail.quUnitSuggested,
        coEnterprise: detail.coEnterprise,
        idEnterprise: detail.idEnterprise,
        quUnit: 0,
        ubicacion: '',
        isEdit: false,
        nuBatch: '',
        daExpiration: '',
        posicion: detail.posicion,
        isSave: true,
      });
    }
    return Array.from(byProduct.values());
  }

  deleteClientStocksBatch(dbServ: SQLiteObject, clientStocks: ClientStocks[]) {
    let queries: any[] = [];
    const deleteStatement = "DELETE FROM client_stocks WHERE co_client_stock = ?";
    const deleteDetailsStatement = "DELETE FROM client_stocks_details WHERE co_client_stock = ?";

    for (let i = 0; i < clientStocks.length; i++) {
      let coClientStock = clientStocks[i].coClientStock;
      queries.push([deleteDetailsStatement, [coClientStock]]);
      queries.push([deleteStatement, [coClientStock]]);
    }
    return dbServ.sqlBatch(queries).then(() => {
      console.log("[Deposit Service] deleteDepositsBatch exitoso");
    }).catch(error => {
      console.log("[Deposit Service] Error al ejecutar deleteDepositsBatch.");
      console.log(error);
    });
  }

  /** Evita pérdida de vínculo pedido inventario cuando memoria está desactualizada. */
  private async mergeStoredClientStockLinks(dbServ: SQLiteObject, clientStock: ClientStocks): Promise<void> {
    const coCs = clientStock.coClientStock;
    if (!coCs) {
      return;
    }
    try {
      const result = await dbServ.executeSql(
        'SELECT co_order, id_order FROM client_stocks WHERE co_client_stock = ? LIMIT 1',
        [coCs],
      );
      if (result.rows.length < 1) {
        return;
      }
      const row = result.rows.item(0);
      const rowCoOrder = row.co_order as string | null | undefined;
      const rowIdOrder = row.id_order as number | null | undefined;
      const coUnset = clientStock.coOrder == null || String(clientStock.coOrder).length === 0;
      const idUnset = clientStock.idOrder == null || clientStock.idOrder === 0;
      if (coUnset && rowCoOrder != null && String(rowCoOrder).length > 0) {
        clientStock.coOrder = rowCoOrder;
      }
      if (idUnset && rowIdOrder != null && Number(rowIdOrder) > 0) {
        clientStock.idOrder = Number(rowIdOrder);
      }
    } catch (e) {
      console.log('[mergeStoredClientStockLinks]', e);
    }
  }

  async saveClientStockBatch(dbServ: SQLiteObject, clientStocks: ClientStocks[]) {
    for (let i = 0; i < clientStocks.length; i++) {
      await this.mergeStoredClientStockLinks(dbServ, clientStocks[i]);
    }
    const insertClientStock = 'INSERT OR REPLACE INTO client_stocks ('
      + 'id_client_stock, co_client_stock, id_user, co_user, id_client, co_client, id_address_client,'
      + 'co_address_client,coordenada, tx_comment,'
      + 'id_enterprise, co_enterprise, st_client_stock, da_client_stock, lb_client, isSave, nu_attachments, has_attachments, '
      + 'id_order, co_order, st_delivery, days_since_last, days_until_next) VALUES ('
      + '?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

    const insertClientStocksDetails = "INSERT OR REPLACE INTO client_stocks_details ("
      + "id_client_stock_detail, co_client_stock_detail, co_client_stock, na_product, co_product, id_product,"
      + "co_enterprise,id_enterprise, posicion,isSave"
      + ") VALUES ("
      + "?,?,?,?,?,?,?,?,?,?)"

    const insertClientStockDetailsUnit = "INSERT OR REPLACE INTO client_stocks_details_units ("
      + "id_client_stock_detail_unit, co_client_stock_detail_unit,"
      + "co_client_stock_detail, co_product_unit,co_unit,"
      + "id_product_unit,qu_stock,"
      + "co_enterprise,id_enterprise, qu_unit, na_unit,ubicacion, posicion,nu_batch, da_expiration,isSave"
      + ") VALUES ("
      + "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"

    let queries: any[] = []//(string | (string | number | boolean)[])[] = [];

    for (var cliS = 0; cliS < clientStocks.length; cliS++) {
      const clientStock = clientStocks[cliS];

      queries.push([insertClientStock,
        [
          clientStock.idClientStock, clientStock.coClientStock, clientStock.idUser, clientStock.coUser,
          clientStock.idClient, clientStock.coClient, clientStock.idAddressClient, clientStock.coAddressClient,
          clientStock.coordenada, clientStock.txComment, clientStock.idEnterprise, clientStock.coEnterprise,
          clientStock.stClientStock, clientStock.daClientStock, clientStock.lbClient, clientStock.isSave,
          clientStock.nuAttachments, clientStock.hasAttachments, clientStock.idOrder ?? null, clientStock.coOrder ?? null,
          clientStock.stDelivery, clientStock.daysSinceLast, clientStock.daysUntilNext
        ]
      ]);

      for (var cliSDetail = 0; cliSDetail < clientStock.clientStockDetails.length; cliSDetail++) {
        const clientStockDetail = clientStock.clientStockDetails[cliSDetail];

        queries.push([insertClientStocksDetails,
          [
            clientStockDetail.idClientStockDetail, clientStockDetail.coClientStockDetail, clientStockDetail.coClientStock,
            clientStockDetail.naProduct, clientStockDetail.coProduct, clientStockDetail.idProduct,
            clientStockDetail.coEnterprise, clientStockDetail.idEnterprise, clientStockDetail.posicion, clientStockDetail.isSave
          ]
        ]);

        for (var cliSDetailUnit = 0; cliSDetailUnit < clientStockDetail.clientStockDetailUnits.length; cliSDetailUnit++) {
          const clientStockDetailUnit = clientStockDetail.clientStockDetailUnits[cliSDetailUnit];

          queries.push([insertClientStockDetailsUnit,
            [
              clientStockDetailUnit.idClientStockDetailUnit, clientStockDetailUnit.coClientStockDetailUnit,
              clientStockDetailUnit.coClientStockDetail, clientStockDetailUnit.coProductUnit, clientStockDetailUnit.coUnit,
              clientStockDetailUnit.idProductUnit, clientStockDetailUnit.quStock,
              clientStockDetailUnit.coEnterprise, clientStockDetailUnit.idEnterprise, clientStockDetailUnit.quUnit,
              clientStockDetailUnit.naUnit, clientStockDetailUnit.ubicacion, clientStockDetailUnit.posicion,
              clientStockDetailUnit.nuBatch, clientStockDetailUnit.daExpiration, clientStockDetailUnit.isSave
            ]
          ]);
        }
      }

    }

    return dbServ.sqlBatch(queries).then(() => { }).catch(error => { });


  }

  async saveClientStock(dbServ: SQLiteObject, send: Boolean) {
    var insertStatement: string = '';

    var batch = [];

    await this.mergeStoredClientStockLinks(dbServ, this.newClientStock);

    if (send) {
      this.newClientStock.stDelivery = DELIVERY_STATUS_TO_SEND;
    } else {
      this.newClientStock.stDelivery = DELIVERY_STATUS_SAVED;
    }
    this.newClientStock.hasAttachments = this.adjuntoService.hasItems();
    this.newClientStock.nuAttachments = this.adjuntoService.getNuAttachment();


    insertStatement = 'INSERT OR REPLACE INTO client_stocks ('
      + 'id_client_stock, co_client_stock, id_user, co_user, id_client, co_client, id_address_client,'
      + 'co_address_client,coordenada, tx_comment,'
      + 'id_enterprise, co_enterprise, st_client_stock, da_client_stock, lb_client, isSave, nu_attachments, has_attachments, id_order, co_order, st_delivery,'
      + ' days_since_last, days_until_next) VALUES ('
      + '?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

    var q = [insertStatement,
      [this.newClientStock.idClientStock, this.newClientStock.coClientStock, this.newClientStock.idUser, this.newClientStock.coUser,
      this.newClientStock.idClient, this.newClientStock.coClient, this.newClientStock.idAddressClient, this.newClientStock.coAddressClient,
      this.newClientStock.coordenada, this.newClientStock.txComment, this.newClientStock.idEnterprise, this.newClientStock.coEnterprise,
      this.newClientStock.stClientStock, this.newClientStock.daClientStock, this.newClientStock.lbClient, this.newClientStock.isSave,
      this.newClientStock.nuAttachments, this.newClientStock.hasAttachments,
      this.newClientStock.idOrder ?? null, this.newClientStock.coOrder ?? null,
      this.newClientStock.stDelivery,
      this.newClientStock.daysSinceLast, this.newClientStock.daysUntilNext]
    ];
    batch.push(q);

    try {
      await dbServ.sqlBatch(batch);
      console.log("SE GUARDO CLIENT_STOCKS");
      await this.saveClientStocksDetails(dbServ,this.newClientStock.coClientStock, this.newClientStock.clientStockDetails);
    } catch (e) {
      console.log("ERROR GUARDAR CLIENT_STOCKS");
      console.log(e);
    }

  }

  saveClientStocksDetails(dbServ: SQLiteObject, coClientStock: string, clientStockDetails: ClientStocksDetail[]) {
    let insertStatement: string = "";
    var batch: any[] = [];

    insertStatement = "INSERT OR REPLACE INTO client_stocks_details ("
      + "id_client_stock_detail, co_client_stock_detail, co_client_stock, na_product, co_product, id_product,"
      + "co_enterprise,id_enterprise, posicion,isSave"
      + ") VALUES ("
      + "?,?,?,?,?,?,?,?,?,?)"

    /*     this.variables.forEach((value, key) => {
          for (var i = 0; i < value.length; i++) {

            var q = [insertStatement,
              [value[i].clientStockDetail[0].idClientStockDetail, value[i].clientStockDetail[0].coClientStockDetail,
              value[i].clientStockDetail[0].coClientStock, value[i].clientStockDetail[0].naProduct,
              value[i].clientStockDetail[0].coProduct, value[i].clientStockDetail[0].idProduct,
              value[i].clientStockDetail[0].coEnterprise, value[i].clientStockDetail[0].idEnterprise,
              value[i].clientStockDetail[0].posicion, value[i].clientStockDetail[0].isSave]
            ]

            batch.push(q);

          }
        }) */
    for (var i = 0; i < clientStockDetails.length; i++) {
      var q =
        [insertStatement,
          [
            clientStockDetails[i].idClientStockDetail, this.newClientStock.clientStockDetails[i].coClientStockDetail,
            coClientStock, this.newClientStock.clientStockDetails[i].naProduct,
            clientStockDetails[i].coProduct, this.newClientStock.clientStockDetails[i].idProduct,
            clientStockDetails[i].coEnterprise, this.newClientStock.clientStockDetails[i].idEnterprise,
            clientStockDetails[i].posicion, this.newClientStock.clientStockDetails[i].isSave
          ]
        ]

      batch.push(q);
    }

    return dbServ.sqlBatch(batch).then(() => {
      /* return this.getIncidencesByVisit(input[0].idVisit); */
      console.log("SE GUARDO CLIENT_STOCKS_DETAILS");
      this.saveClientStocksDetailsUnits(dbServ, clientStockDetails);
    }).catch(e => {
      console.log("ERROR GUARDAR CLIENT_STOCKS_DETAILS");
      console.log(e);
    });
  }

  saveClientStocksDetailsUnits(dbServ: SQLiteObject, clientStockDetails: ClientStocksDetail[]) {
    let insertStatement: string = "";
    var batch: any[] = [];
    insertStatement = "INSERT OR REPLACE INTO client_stocks_details_units ("
      + "id_client_stock_detail_unit, co_client_stock_detail_unit,"
      + "co_client_stock_detail, co_product_unit,co_unit,"
      + "id_product_unit,qu_stock,"
      + "co_enterprise,id_enterprise, qu_unit, na_unit,ubicacion, posicion,nu_batch, da_expiration,isSave"
      + ") VALUES ("
      + "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"

    /* this.variables.forEach((value, key) => {
      for (var i = 0; i < value.length; i++) {
        var q = [insertStatement,
          [value[i].clientStockDetail[0].clientStockDetailUnits[0].idClientStockDetailUnit,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].coClientStockDetailUnit,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].coClientStockDetail,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].coProductUnit,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].coUnit,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].idProductUnit,
          value[i].cantidad,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].coEnterprise,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].idEnterprise,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].quUnit,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].naUnit,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].ubicacion,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].posicion,
          value[i].lote,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].daExpiration,
          value[i].clientStockDetail[0].clientStockDetailUnits[0].isSave]
        ]
        batch.push(q);
      }
    }) */

    for (var i = 0; i < clientStockDetails.length; i++) {
      for (var j = 0; j < clientStockDetails[i].clientStockDetailUnits.length; j++) {
        var q =
          [insertStatement,
            [
              clientStockDetails[i].clientStockDetailUnits[j].idClientStockDetailUnit,
              clientStockDetails[i].clientStockDetailUnits[j].coClientStockDetailUnit,
              clientStockDetails[i].clientStockDetailUnits[j].coClientStockDetail,
              clientStockDetails[i].clientStockDetailUnits[j].coProductUnit,
              clientStockDetails[i].clientStockDetailUnits[j].coUnit,
              clientStockDetails[i].clientStockDetailUnits[j].idProductUnit,
              clientStockDetails[i].clientStockDetailUnits[j].quStock,
              clientStockDetails[i].clientStockDetailUnits[j].coEnterprise,
              clientStockDetails[i].clientStockDetailUnits[j].idEnterprise,
              clientStockDetails[i].clientStockDetailUnits[j].quUnit,
              clientStockDetails[i].clientStockDetailUnits[j].naUnit,
              clientStockDetails[i].clientStockDetailUnits[j].ubicacion,
              clientStockDetails[i].clientStockDetailUnits[j].posicion,
              clientStockDetails[i].clientStockDetailUnits[j].nuBatch,
              clientStockDetails[i].clientStockDetailUnits[j].daExpiration,
              clientStockDetails[i].clientStockDetailUnits[j].isSave]
          ]
        batch.push(q);
      }
    }

    return dbServ.sqlBatch(batch).then(() => {
      /* return this.getIncidencesByVisit(input[0].idVisit); */
      console.log("SE GUARDO CLIENT_STOCKS_DETAILS_UNITS");
      return true;
    }).catch(e => {
      console.log("ERROR GUARDAR CLIENT_STOCKS_DETAILS_UNITS");
      console.log(e);
    });
  }

  /* getClientStock(coClientStock: string) {
    let clientStockDetails = [] as ClientStocksDetail[];
    this.variables.forEach((value, key) => {
      for (var i = 0; i < value.length; i++) {
        let details = {} as ClientStocksDetail;
        let detailsUnits = {} as ClientStocksDetailUnits;
        details.idClientStockDetail = value[i].clientStockDetail[0].idClientStockDetail;
        details.coClientStockDetail = value[i].clientStockDetail[0].coClientStockDetail;
        details.coClientStock = value[i].clientStockDetail[0].coClientStock;
        details.idProduct = value[i].clientStockDetail[0].idProduct;
        details.coProduct = value[i].clientStockDetail[0].coProduct;
        details.naProduct = value[i].clientStockDetail[0].naProduct;
        details.idEnterprise = value[i].clientStockDetail[0].idEnterprise;
        details.coEnterprise = value[i].clientStockDetail[0].coEnterprise;
        details.isEdit = value[i].clientStockDetail[0].isEdit;
        details.posicion = value[i].clientStockDetail[0].posicion;
        details.isSave = value[i].clientStockDetail[0].isSave;

        details.clientStockDetailUnits = [] as ClientStocksDetailUnits[];

        detailsUnits.coClientStockDetail = value[i].clientStockDetail[0].clientStockDetailUnits[0].coClientStockDetail;
        detailsUnits.coClientStockDetailUnit = value[i].clientStockDetail[0].clientStockDetailUnits[0].coClientStockDetailUnit;
        detailsUnits.coEnterprise = value[i].clientStockDetail[0].clientStockDetailUnits[0].coEnterprise;
        detailsUnits.coProductUnit = value[i].clientStockDetail[0].clientStockDetailUnits[0].coProductUnit;
        detailsUnits.coUnit = value[i].clientStockDetail[0].clientStockDetailUnits[0].coUnit;
        detailsUnits.daExpiration = value[i].clientStockDetail[0].clientStockDetailUnits[0].daExpiration.replace('T', ' ');
        detailsUnits.idClientStockDetailUnit = value[i].clientStockDetail[0].clientStockDetailUnits[0].idClientStockDetailUnit;
        detailsUnits.idEnterprise = value[i].clientStockDetail[0].clientStockDetailUnits[0].idEnterprise;
        detailsUnits.idProductUnit = value[i].clientStockDetail[0].clientStockDetailUnits[0].idProductUnit;
        detailsUnits.idUnit = value[i].clientStockDetail[0].clientStockDetailUnits[0].idUnit;
        detailsUnits.isEdit = value[i].clientStockDetail[0].clientStockDetailUnits[0].isEdit;
        detailsUnits.isSave = value[i].clientStockDetail[0].clientStockDetailUnits[0].isSave;
        detailsUnits.naUnit = value[i].clientStockDetail[0].clientStockDetailUnits[0].naUnit;
        detailsUnits.nuBatch = value[i].clientStockDetail[0].clientStockDetailUnits[0].nuBatch;
        detailsUnits.posicion = value[i].clientStockDetail[0].clientStockDetailUnits[0].posicion;
        detailsUnits.quStock = value[i].clientStockDetail[0].clientStockDetailUnits[0].quStock;
        detailsUnits.quSuggested = value[i].clientStockDetail[0].clientStockDetailUnits[0].quSuggested;
        detailsUnits.quUnit = value[i].clientStockDetail[0].clientStockDetailUnits[0].quUnit;
        detailsUnits.ubicacion = value[i].clientStockDetail[0].clientStockDetailUnits[0].ubicacion;
        details.clientStockDetailUnits.push(detailsUnits);
        clientStockDetails.push(details);
      }
    })
    this.newClientStock.clientStockDetails = clientStockDetails;
    return Promise.resolve(true);

  } */
  getClientStock(dbServ: SQLiteObject, coClientStock: string) {
    var clientStock: ClientStocks;

    let selectClientStock = "SELECT "
      + "id_client_stock as idClientStock, co_client_stock as coClientStock, id_user as idUser, co_user as coUser,"
      + "id_client as idClient, co_client as coClient, id_address_client as idAddressClient, co_address_client as coAddressClient,"
      + "coordenada, tx_comment as txComment, id_enterprise as idEnterprise, co_enterprise as coEnterprise,"
      + "da_client_stock as daClientStock, st_client_stock as stClientStock, lb_client as lbClient, isSave as isSave, "+
      "nu_attachments as nuAttachments, has_attachments as hasAttachments, id_order as idOrder, co_order as coOrder, "+
      "st_delivery as stDelivery, days_since_last as daysSinceLast, days_until_next as daysUntilNext "
      + "FROM client_stocks WHERE co_client_stock = ?"

    return dbServ.executeSql(selectClientStock, [coClientStock]).then(result => {
      clientStock = result.rows.item(0);
      console.log(clientStock);
      return this.getClientStockDetails(dbServ, clientStock.coClientStock).then(details => {
        clientStock.clientStockDetails = details;

          return clientStock
      })
    }).catch(e => {
      console.log("Error al ejecutar getClientStock.");
      console.log(e);
      return clientStock;
    });
  }

  getPreviousClientStock(dbServ: SQLiteObject, idClient: number, idAddressClient: number, coClientStock: string) {
    let selectStatement = 
      "SELECT * FROM client_stocks WHERE id_client = ? AND id_address_client = ? AND co_client_stock < ? AND id_client_stock <> 0 ORDER BY da_client_stock DESC LIMIT 1";

    return dbServ.executeSql(selectStatement, [idClient, idAddressClient, coClientStock]).then(result => {
      if(result.rows.length > 0){
        let item = result.rows.item(0);
        let clientStock: ClientStocks = {
          idClientStock: item.id_client_stock,
          coClientStock: item.co_client_stock,
          idUser: item.id_user,
          coUser: item.co_user,
          idClient: item.id_client,
          coClient: item.co_client,
          idAddressClient: item.id_address_client,
          coAddressClient: item.co_address_client,
          coordenada: item.coordenada,
          txComment: item.tx_comment,
          idEnterprise: item.id_enterprise,
          coEnterprise: item.co_enterprise,
          daClientStock: item.da_client_stock,
          stClientStock: item.st_client_stock,
          lbClient: item.lb_client,
          isSave: item.isSave,
          nuAttachments: item.nu_attachments,
          hasAttachments: item.has_attachments,
          idOrder: item.id_order ?? null,
          coOrder: item.co_order ?? null,
          stDelivery: item.st_delivery,
          daysSinceLast: item.days_since_last,
          daysUntilNext: item.days_until_next,
          lbEnterprise: item.lb_enterprise,
          clientStockDetails: [],
          isEdit: false,
          productList: []


        }
        return this.getClientStockDetails(dbServ, clientStock.coClientStock).then(details => {
          clientStock.clientStockDetails = details;
          return clientStock;
        })
      }else{
        //no hay previous client stock
        return null;
      }
  });
  }


  getInfoUnit(dbServ: SQLiteObject, clientStock: ClientStocks) {
    let selectStatement = "select u.co_unit as coUnit, u.na_unit as naUnit, pu.qu_unit as quUnit "
      + "from product_units pu "
      + "join units u on (u.id_unit = pu.id_unit or u.co_unit = pu.co_unit) "
      + "where pu.id_product_unit = ? and u.id_enterprise = pu.id_enterprise";

    let queries: Promise<void>[] = [];

    for (let i = 0; i < clientStock.clientStockDetails.length; i++) {
      for (let j = 0; j < clientStock.clientStockDetails[i].clientStockDetailUnits.length; j++) {
        const detailUnit = clientStock.clientStockDetails[i].clientStockDetailUnits[j];
        const idProductUnit = detailUnit.idProductUnit;

        if (idProductUnit == null) {
          continue;
        }

        let p = dbServ.executeSql(selectStatement, [idProductUnit]).then(result => {
          if (result.rows.length > 0) {
            detailUnit.coUnit = result.rows.item(0).coUnit;
            detailUnit.naUnit = result.rows.item(0).naUnit;
            detailUnit.quUnit = result.rows.item(0).quUnit;
          }
        });

        queries.push(p);
      }
    }

    return Promise.all(queries).then(() => {
      return clientStock;
    }).catch(e => {
      console.log("Error al ejecutar getInfoUnit.");
      console.log(e);
      return clientStock;
    });
  }

  getClientStockDetails(dbServ: SQLiteObject, coCLientStock: string) {
    let selectClientStockDetail = "SELECT c.id_client_stock_detail as idClientStockDetail, c.co_client_stock_detail as coClientStockDetail, " +
      "c.co_client_stock as coClientStock, c.co_product as coProduct, p.na_product as naProduct, c.id_product as idProduct, " +
      "c.co_enterprise as coEnterprise,c.id_enterprise as idEnterprise, c.posicion, c.isSave as isSave " +
      "FROM client_stocks_details c " +
      "JOIN products p on p.id_product = c.id_product " +
      "WHERE c.co_client_stock = ?"

    return dbServ.executeSql(selectClientStockDetail, [coCLientStock]).then(data => {
      //console.log(data);
      let listCoDetails: string[] = [];
      let clientStockDetails: ClientStocksDetail[] = []
      for (let i = 0; i < data.rows.length; i++) {
        const item = data.rows.item(i);
        clientStockDetails.push(item);
        clientStockDetails[i].clientStockDetailUnits = [] as ClientStocksDetailUnits[]
        listCoDetails.push(item.coClientStockDetail);
      }
      return this.getClientStockDetailUnitsByCoDetail(dbServ, listCoDetails).then(units => {
        for (let i = 0; i < clientStockDetails.length; i++) {
          clientStockDetails[i].clientStockDetailUnits = units.filter(u => u.coClientStockDetail === clientStockDetails[i].coClientStockDetail);
        }
        return clientStockDetails;
      });
    }).catch(e => {
      console.log("Error al ejecutar getClientStockDetails.");
      console.log(e);
      return [];
    });
  }

  getClientStockDetailUnitsByCoDetail(dbServ: SQLiteObject, coClientStockDetails: String[]) {
    let select = "Select * from client_stocks_details_units where co_client_stock_detail in (" 
    + coClientStockDetails.join(",") + ")";
    return dbServ.executeSql(select, []).then(data => {
      let clientStockDetailUnits: ClientStocksDetailUnits[] = [];
      let item = data.rows.item(0);
      for (let i = 0; i < data.rows.length; i++) {
        let unit: ClientStocksDetailUnits = {
          idClientStockDetailUnit: data.rows.item(i).id_client_stock_detail_unit,
          coClientStockDetailUnit: data.rows.item(i).co_client_stock_detail_unit,
          coClientStockDetail: data.rows.item(i).co_client_stock_detail,
          coProductUnit: data.rows.item(i).co_product_unit,
          coUnit: data.rows.item(i).co_unit,
          idProductUnit: data.rows.item(i).id_product_unit,
          naUnit: data.rows.item(i).na_unit,
          quStock: data.rows.item(i).qu_stock,
          coEnterprise: data.rows.item(i).co_enterprise,
          quUnit: data.rows.item(i).qu_unit,
          ubicacion: data.rows.item(i).ubicacion,
          idEnterprise: data.rows.item(i).id_enterprise,
          daExpiration: data.rows.item(i).da_expiration,
          nuBatch: data.rows.item(i).nu_batch,
          posicion: data.rows.item(i).posicion,
          isSave: data.rows.item(i).isSave,
          idUnit: 0,
          quSuggested: 0,
          isEdit: false

        }
        clientStockDetailUnits.push(unit);


        }
        return clientStockDetailUnits;
      });
  }

  getClientStockDetailsUnits(dbServ: SQLiteObject, coClientStocksDetail: string, index: number) {

    let selectClientStockDetailUnit = "SELECT "
      + "id_client_stock_detail_unit as idClientStockDetailUnit, co_client_stock_detail_unit as coClientStockDetailUnit,"
      + "co_client_stock_detail as coClientStockDetail, co_product_unit as coProductUnit, co_unit as coUnit,"
      + "id_product_unit as idProductUnit, na_unit as naUnit, qu_stock as quStock, co_enterprise as coEnterprise,"
      + "qu_unit as quUnit, ubicacion, id_enterprise as idEnterprise, da_expiration as daExpiration,"
      + "nu_batch as nuBatch, posicion, isSave as isSave "
      + "FROM client_stocks_details_units WHERE co_client_stock_detail = ?";

    return dbServ.executeSql(selectClientStockDetailUnit, [coClientStocksDetail]).then(data => {
      let clientStockDetailUnits = [] as ClientStocksDetailUnits[]
      for (let i = 0; i < data.rows.length; i++) {

        clientStockDetailUnits.push(data.rows.item(i));

      }
      return [index, clientStockDetailUnits] as const;

    }).catch(e => {
      console.log("Error al ejecutar getClientStockDetails.");
      console.log(e);
      return [];
    });

  }

  getAllClientStock(dbServ: SQLiteObject) {
    let selectStatement = "SELECT cs.id_client_stock as idClientStock, cs.co_client_stock as coClientStock," +
      "cs.id_user as idUser,cs.co_user as coUser, cs.id_client as idClient, cs.co_client as coClient, " +
      "cs.id_address_client as idAddressClient,cs.co_address_client as coAddressClient,cs.coordenada, " +
      "cs.tx_comment as txComment,cs.id_enterprise as idEnterprise, cs.co_enterprise as coEnterprise, cs.st_client_stock as stClientStock," +
      "cs.da_client_stock as daClientStock, c.lb_client as lbClient, cs.isSave, cs.id_order as idOrder, cs.co_order as coOrder, cs.st_delivery as stDelivery, cs.days_since_last as daysSinceLast, cs.days_until_next as daysUntilNext " +
      "FROM client_stocks cs " +
      "join clients c on cs.id_client = c.id_client " +
      "ORDER BY cs.st_delivery DESC, cs.da_client_stock DESC";
    return dbServ.executeSql(selectStatement, []).then(async data => {
      let promises: Promise<void>[] = [];
      let clientStock = [] as ClientStocks[];
      this.itemListClientStocks = [] as ItemListaInventarios[];

      for (var i = 0; i < data.rows.length; i++) {
        clientStock.push(data.rows.item(i));
        let item = data.rows.item(i);

        // Crea un nuevo objeto para cada item
        let p = this.historyTransaction.getStatusTransaction(dbServ, 5, item.idClientStock!).then(status => {
          const itemClientStock: ItemListaInventarios = {
            idClientStock: item.idClientStock,
            coClientStock: item.coClientStock,
            coClient: item.coClient,
            lbClient: item.lbClient,
            stClientStock: item.stClientStock,
            daClientStock: item.daClientStock,
            naStatus: status,
            stDelivery: item.stDelivery,
          };
          this.itemListClientStocks.push(itemClientStock);
        });
        promises.push(p);
      }
      await Promise.all(promises);

      return clientStock;
    }).catch(e => {
      console.log("Error al ejecutar getAllClientStock.");
      console.log(e);
      return [];
    });
  }

  deleteClientStock(dbServ: SQLiteObject, coClientStock: string) {
    return this.deleteSuggestedOrderSnapshot(dbServ, coClientStock).then(() => {
      let deleteStatement = "DELETE FROM client_stocks WHERE co_client_stock = ?";
      return dbServ.executeSql(deleteStatement, [coClientStock]).then(data => {
        return Promise.resolve(true);
      });
    }).catch(e => {
      console.log("Error al ejecutar deleteClientStock.");
      console.log(e);
      return false;
    });
  }

  deleteClientStockDetails(dbServ: SQLiteObject, coClientStockDetail: string) {
    let deleteStatement = "DELETE FROM client_stocks_details WHERE co_client_stock = ?";
    return dbServ.executeSql(deleteStatement, [coClientStockDetail]).then(data => {
      console.log("Se elimino clientStockDetail " + coClientStockDetail);
      return Promise.resolve(true);
    }).catch(e => {
      console.log("Error al ejecutar deleteClientStockDetail.");
      console.log(e);
      return false;
    });
  }

  deleteClientStockDetailsUnits(dbServ: SQLiteObject, coClientStockDetails: string[]) {
    var batch = [];
    let deleteStatement = "DELETE FROM client_stocks_details_units WHERE co_client_stock_detail = ?";
    for (var i = 0; i < coClientStockDetails.length; i++) {

      var q = [deleteStatement, [coClientStockDetails[i]]]

      batch.push(q);

    }
    return dbServ.sqlBatch(batch).then(() => {
      console.log("Se elimino clientStockDetailUnits " + coClientStockDetails);

      return Promise.resolve(true);

    }).catch(e => {
      console.log("Error al ejecutar deleteClientStockDetailUnits.");
      console.log(e);
    });
  }

  getStraightSwapsByClientStock(dbServ: SQLiteObject, idProducts: number[], idUnits: number[], idEnterprise: number, idClient: number, idAddressClient: number, dateLastInventory: string) {
    let select = "select * from straight_swap ss "+
    "where ss.id_product IN ("+idProducts.join(",")+") and ss.id_unit IN ("+idUnits.join(",")+
    ") and ss.id_enterprise = "+idEnterprise+" and ss.id_client = "+idClient+" and ss.id_address_client = "+idAddressClient+" and ss.da_cambio > '"+dateLastInventory+"'";

    return dbServ.executeSql(select, []).then(data => {
      let straightSwaps: StraightSwap[] = [];
      for (var i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i);
        let straightSwap: StraightSwap = {
          idSwap: item.id_swap,
          coSwap: item.co_swap,
          idProduct: item.id_product, 
          idUnit: item.id_unit,
          coProduct: item.co_product,
          coUnit: item.co_unit,
          idEnterprise: item.id_enterprise,
          coEnterprise: item.co_enterprise,
          daCambio: item.da_cambio,
          quSwap: item.qu_swap,
          idClient: item.id_client,
          idAddressClient: item.id_address_client,
          coClient: item.co_client,
          coAddressClient: item.co_address_client,
          idProductUnit: item.id_product_unit,
          coProductUnit: item.co_product_unit,
        };

        straightSwaps.push(straightSwap);
      }
      return straightSwaps;
  });
}

getInvoiceDetailUnitsFromLastClientInvoice(
  dbServ: SQLiteObject,
  idProductUnits: number[],
  idClient: number,
  idAddressClient: number
) {
  if (idProductUnits.length === 0) {
    return Promise.resolve([] as InvoiceDetailUnit[]);
  }

  const select = "SELECT idu.* FROM invoice_detail_units idu " +
    "INNER JOIN invoice_details id ON id.id_invoice_detail = idu.id_invoice_detail " +
    "INNER JOIN invoices inv ON inv.id_invoice = id.id_invoice " +
    "WHERE inv.id_client = ? AND inv.id_address_client = ? " +
    "AND substr(inv.da_invoice, 1, 10) = (" +
      "SELECT substr(da_invoice, 1, 10) FROM invoices " +
      "WHERE id_client = ? AND id_address_client = ? " +
      "ORDER BY da_invoice DESC, id_invoice DESC LIMIT 1" +
    ") AND idu.id_product_unit IN (" + idProductUnits.join(",") + ")";

  return dbServ.executeSql(select, [idClient, idAddressClient, idClient, idAddressClient]).then(data => {
    const byProductUnit = new Map<number, InvoiceDetailUnit>();
    for (let i = 0; i < data.rows.length; i++) {
      const item = data.rows.item(i);
      const idProductUnit = item.id_product_unit;
      const existing = byProductUnit.get(idProductUnit);
      if (existing !== undefined) {
        existing.quInvoice += item.qu_invoice;
      } else {
        byProductUnit.set(idProductUnit, {
          idInvoiceDetailUnit: item.id_invoice_detail_unit,
          coInvoiceDetailUnit: item.co_invoice_detail_unit,
          idProductUnit,
          coProductUnit: item.co_product_unit,
          idInvoiceDetail: item.id_invoice_detail,
          coInvoiceDetail: item.co_invoice_detail,
          quInvoice: item.qu_invoice,
          coEnterprise: item.co_enterprise,
          idEnterprise: item.id_enterprise
        });
      }
    }
    return Array.from(byProductUnit.values());
  });
}

getInvoicesDetailUnitsByIdProductUnit(
  dbServ: SQLiteObject,
  idProductUnits: number[],
  idClient: number,
  idAddressClient: number
) {
  if (idProductUnits.length === 0) {
    return Promise.resolve([] as InvoiceDetailUnit[]);
  }

  let select = "SELECT * FROM ("+
      "SELECT idu.*, ROW_NUMBER() OVER (PARTITION BY idu.id_product_unit ORDER BY idu.id_invoice_detail_unit DESC) as rn "+
      "FROM invoice_detail_units idu "+
      "INNER JOIN invoice_details id ON id.id_invoice_detail = idu.id_invoice_detail "+
      "INNER JOIN invoices inv ON inv.id_invoice = id.id_invoice "+
      "WHERE idu.id_product_unit IN ("+idProductUnits.join(",")+") "+
      "AND inv.id_client = ? AND inv.id_address_client = ?"+
    ") WHERE rn = 1;";
    return dbServ.executeSql(select, [idClient, idAddressClient]).then(data => {
      let invoiceDetailUnits: InvoiceDetailUnit[] = [];
      for (var i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i);
        let invoiceDetailUnit: InvoiceDetailUnit = {
          idInvoiceDetailUnit: item.id_invoice_detail_unit,
          coInvoiceDetailUnit: item.co_invoice_detail_unit,
          idProductUnit: item.id_product_unit,
          coProductUnit: item.co_product_unit,
          idInvoiceDetail: item.id_invoice_detail,
          coInvoiceDetail: item.co_invoice_detail,
          quInvoice: item.qu_invoice,
          coEnterprise: item.co_enterprise,
          idEnterprise: item.id_enterprise 
        };
        invoiceDetailUnits.push(invoiceDetailUnit);
      }
      return invoiceDetailUnits;
    });

}

getReturnsByDistribution(dbServ: SQLiteObject, idProducts: number[], coUnits: String[], idEnterprise: number, idClient: number, dateLastInventory: string) {
let select = "select *  from return_details rd where co_return in "+
"(SELECT r.co_return from returns r where r.id_type in "+
  "(select rt.id_type from return_types rt where rt.id_return_category in "+
    "(select rc.id_return_category from return_category rc where rc.subtract_suggestion = 'true') )"+
  "and r.id_client = "+idClient+" and r.id_enterprise = "+idEnterprise+" and r.id_return <> 0 and r.da_return >= '"+dateLastInventory.substring(0, 10)+"') "+
"and rd.id_product IN ("+idProducts.join(",")+") and rd.co_measure_unit IN ('"+coUnits.join("','")+"')";

  return dbServ.executeSql(select, []).then(data => {
    let returnDetails: ReturnDetail[] = [];
    for (var i = 0; i < data.rows.length; i++) {
      let item = data.rows.item(i);
      let returnDetail: ReturnDetail = {
        coReturnDetail: item.co_return_detail,
        idReturn: item.id_return,
        idProduct: item.id_product,
        idUnit: item.id_unit,
        coProduct: item.co_product,
        coMeasureUnit: item.co_measure_unit,
        coReturn: item.co_return,
        naProduct: item.na_product,
        quProduct: item.qu_product,
        naMeasureUnit: item.na_measure_unit,
        productUnits: [],
        validateProductUnits: [],
        unit: undefined,
        nuLote: item.nu_lote,
        daDueDate: item.da_due_date,
        coDocument: item.co_document,
        idMotive: item.id_motive,
        showDateModal: false        
      };

      returnDetails.push(returnDetail);
    }
    return returnDetails;
  }).catch(e => {
    console.log("Error al ejecutar getReturnsByDistribution.");
    console.log(e.message);
  });
}

  onShowProductStructures() {
    this.showProductList = false;
    this.productStructureService.onAddProductCLicked();
  }

}
