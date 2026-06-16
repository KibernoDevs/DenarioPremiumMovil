import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';

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
  public suggestedOrderByDispatchAndReturn: boolean = false;
  public productsSuggested: ProductSuggestedUtil[] = [];
  public idProductsSuggested: number[] = [];
  public idProductsUnitsSuggested: number[] = [];
  public idUnitsSuggested: number[] = [];


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
    this.stockValid.next(valid);
  }

  updateHeaderButtons() {
    if (this.adjuntoService.weightLimitExceeded) {
      this.onStockValidToSave(false);
      this.onStockValidToSend(false);
      return;
    }
    //si ningun otro flag ha bloqueado el guardado o envio, validamos los stocks
    var valid = this.checkValidStockToSend();
    this.onStockValidToSave(valid);
    this.onStockValidToSend(valid);
    return;
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

  initClientStockDetails() {
    this.initInventario = true;
    this.selectedClient = false;
    this.inventarioSent = false;
    this.disableSaveButton = true;
    this.cannotSendClientStock = true;
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
    this.suggestedOrderByDispatchAndReturn = this.globalConfig.get("suggestedOrderByDispatchAndReturn")?.toLowerCase() === "true";
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

    this.onStockValidToSend(true);
    this.onStockValidToSave(true);
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
    let daysSinceLastInventory = this.newClientStock.daysSinceLast;
    let daysUntilNextInventory = this.newClientStock.daysUntilNext;

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
    //despacho por ultima facturacion
    let dispatchsByLastInvoice = await this.getInvoicesDetailUnitsByIdProductUnit(dbServ, idProductUnits);
    

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
      "SELECT * FROM client_stocks WHERE id_client = ? AND id_address_client = ? AND co_client_stock < ? ORDER BY da_client_stock DESC LIMIT 1";

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
    let deleteStatement = "DELETE FROM client_stocks WHERE co_client_stock = ?";
    return dbServ.executeSql(deleteStatement, [coClientStock]).then(data => {
      return Promise.resolve(true);
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

getInvoicesDetailUnitsByIdProductUnit(dbServ: SQLiteObject, idProductUnits: number[]) {
  let select = "SELECT * FROM ("+
      "SELECT *, ROW_NUMBER() OVER (PARTITION BY id_product_unit ORDER BY id_invoice_detail_unit DESC) as rn "+
      "FROM invoice_detail_units "+
      "WHERE id_product_unit IN ("+idProductUnits.join(",")+")"+
    ") WHERE rn = 1;";
    return dbServ.executeSql(select, []).then(data => {
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
  "and r.id_client = "+idClient+" and r.id_enterprise = "+idEnterprise+" and r.da_return >= '"+dateLastInventory.substring(0, 10)+"') "+
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
