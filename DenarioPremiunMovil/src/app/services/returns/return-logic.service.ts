import { EventEmitter, Injectable, inject } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { ProductUtil } from 'src/app/modelos/ProductUtil';
import { ReturnDetail } from 'src/app/modelos/tables/ReturnDetail';
import { Client } from 'src/app/modelos/tables/client';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { Return } from 'src/app/modelos/tables/return';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { ReturnMotive } from 'src/app/modelos/tables/returnMotive';
import { ReturnType } from 'src/app/modelos/tables/returnType';
import { ProductService } from '../products/product.service';
import { Unit } from 'src/app/modelos/tables/unit';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { MessageService } from '../messageService/message.service';
import { ServicesService } from '../services.service';
import { AutoSendService } from '../autoSend/auto-send.service';
import { Router } from '@angular/router';
import { ReturnDatabaseService } from './return-database.service';
import { DateServiceService } from '../dates/date-service.service';
import { ReturnList } from 'src/app/modelos/ReturnList';
import { EnterpriseService } from '../enterprise/enterprise.service';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { Invoice } from 'src/app/modelos/tables/invoice';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { ClienteSelectorService } from 'src/app/cliente-selector/cliente-selector.service';
import { ItemListaCobros } from 'src/app/cobros/item-lista-cobros';
import { ItemListaDevoluciones } from 'src/app/devoluciones/item-lista-devoluciones';
import { HistoryTransaction } from '../historyTransaction/historyTransaction';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';

@Injectable({
  providedIn: 'root'
})
export class ReturnLogicService {
  dbServ = inject(SynchronizationDBService);
  productService = inject(ProductService);
  messageService = inject(MessageService);
  synchronizationServices = inject(SynchronizationDBService);
  services = inject(ServicesService);
  autoSend = inject(AutoSendService);
  router = inject(Router);
  returnDatabaseService = inject(ReturnDatabaseService);
  dateServ = inject(DateServiceService);
  enterpriseServ = inject(EnterpriseService);
  adjuntoService = inject(AdjuntoService);
  selectorService = inject(ClienteSelectorService);
  historyTransaction = inject(HistoryTransaction);


  newReturn: Return = {} as Return;
  sendReturn: Return = {} as Return;
  enterpriseReturn: Enterprise = {} as Enterprise;
  clientReturn: Client = {} as Client;
  productList: ReturnDetail[] = [];
  validateReturnProductList: ProductUtil[] = [];
  returnMotives: ReturnMotive[] = [];
  returnTypes: ReturnType[] = [];
  returnList: ReturnList[] = [];
  unitsByProduct: Unit[] = [];
  invoices: Invoice[] = [];
  //public invoiceAnterior: null | Invoice = null;
  itemReturns: ItemListaDevoluciones[] = [];

  messageAlert!: MessageAlert;
  tags = new Map<string, string>([]);
  selectedReturn: boolean = false;
  returnSent: boolean = false;
  returnChanged: boolean = false;
  validateReturn: boolean = false;
  requeridedNroFactura: boolean = false;
  userMustActivateGPS: boolean = false;
  validateClient: boolean = false;
  bloquearFactura: boolean = true;

  backRoute = new Subject<string>;
  showButtons = new Subject<Boolean>;
  returnValid = new Subject<Boolean>;
  returnValidToSend = new Subject<Boolean>;
  returnValidToSave = new Subject<Boolean>;
  productListCart = new Subject<ReturnDetail[]>;
  returnSelected = new Subject<Boolean>;
  productsByInvoice = new Subject<Boolean>;
  invoiceChanged: Subject<Invoice> = new Subject<Invoice>();

  AttachSubscription: Subscription = this.adjuntoService.AttachmentChanged.subscribe(() => {
    this.setChange(true, true);
  });


  constructor() {
    this.enterpriseServ.setup(this.dbServ.getDatabase()).then();
    this.getReturnTypes();
    this.getReturnMotives();

  }

  ngOnDestroy() {
    this.AttachSubscription.unsubscribe();
  }

  setChange(devolucion: boolean, cliente: boolean) {
    this.returnChanged = devolucion;
    this.validateClient = cliente;
    this.selectorService.checkClient = true;
  }

  getReturnTypes() {
    console.log('returnLogicService: getReturnTypes');
    var database = this.dbServ.getDatabase();
    this.returnTypes = [];
    var select = 'select rt.id_type, rt.na_type FROM return_types rt ORDER BY rt.na_type ASC'
    return database.executeSql(select, []).then(result => {
      for (let i = 0; i < result.rows.length; i++) {
        this.returnTypes.push({
          idType: result.rows.item(i).id_type,
          naType: result.rows.item(i).na_type,
        });
      }
      this.newReturn.idType = this.returnTypes[0].idType;
    }).catch(e => {
      this.returnTypes = [];
      console.log("[ReturnLogicService] Error al cargar Return Types.");
      console.log(e);
    })
  }

  getReturnMotives() {
    console.log('returnLogicService: getReturnMotives');
    var database = this.dbServ.getDatabase();
    this.returnMotives = [];
    var select = 'select rm.id_motive, rm.na_motive FROM return_motives rm ORDER BY rm.na_motive ASC'
    return database.executeSql(select, []).then(result => {
      for (let i = 0; i < result.rows.length; i++) {
        this.returnMotives.push({
          idMotive: result.rows.item(i).id_motive,
          naMotive: result.rows.item(i).na_motive,
        });
      }
    }).catch(e => {
      this.returnMotives = [];
      console.log("[ReturnLogicService] Error al cargar Return Motives.");
      console.log(e);
    })
  }

  showHeaderButtons(headerButtos: Boolean) {
    this.showButtons.next(headerButtos);
  }

  showBackRoute(route: string) {
    console.log('returnLogicService: showBackRoute');
    this.backRoute.next(route);
  }

  onReturnValid(valid: Boolean) {
    console.log('returnLogicService: onReturnValid');
    this.returnValid.next(valid);
  }

  onReturnValidToSend(validToSend: Boolean) {
    console.log('returnLogicService: onReturnValidToSend');
    this.returnValidToSend.next(validToSend);
  }

  onReturnValidToSave(validToSave: Boolean) {
    console.log('returnLogicService: onReturnValidToSave');
    this.returnValidToSave.next(validToSave);
  }

  deleteReturn() {
    console.log('returnLogicService: deleteReturn');
    this.newReturn = {} as Return;
    this.productList = [];
  }

  addProductDev(product: ProductUtil) {
    let returnDetail: ReturnDetail = {} as ReturnDetail;
    returnDetail.coReturn = this.newReturn.coReturn;
    returnDetail.coReturnDetail = this.dateServ.generateCO(0);
    returnDetail.idProduct = product.idProduct;
    returnDetail.coProduct = product.coProduct;
    returnDetail.naProduct = product.naProduct;
    returnDetail.idMotive = this.returnMotives[0].idMotive;
    if (this.validateReturn) {
      returnDetail.coDocument = this.newReturn.coInvoice;
    }
    returnDetail.daDueDate = null;
    returnDetail.nuLote = '';
    console.log('returnDetail. ' + JSON.stringify(returnDetail));
    this.productService.getUnitsByIdProductOrderByCoPrimaryUnit(this.dbServ.getDatabase(), product.idProduct).then(() => {
      returnDetail.productUnits = this.productService.unitsByProduct;
      returnDetail.unit = returnDetail.productUnits[0];
      returnDetail.idUnit = returnDetail.productUnits[0].idUnit;
    });
    returnDetail.showDateModal = false;
    this.setChange(true, true);
    this.productList.push(returnDetail);
    this.onReturnValidToSend(false);
    this.productListCart.next(this.productList);
  }

  removeProductDev(index: number) {
    this.productList.splice(index, 1);
    this.setChange(true, true);
    this.productListCart.next(this.productList);
  }

  getReturnList() {
    console.log('returnLogicService: getReturnList');
    var database = this.dbServ.getDatabase();
    this.returnList = [];
    this.itemReturns = [] as ItemListaDevoluciones[];
    var select = 'select rt.id_return as idReturn, rt.co_return as coReturn, rt.co_client as coClient, rt.lb_client as naClient, rt.st_return as stReturn, rt.da_return as daReturn, rt.st_delivery as stDelivery FROM returns rt ORDER BY rt.st_delivery DESC, rt.da_return DESC'
    return database.executeSql(select, []).then(async result => {
      let promises: Promise<void>[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        this.returnList.push(result.rows.item(i));

        // Agrega la promesa al array antes del then
        let item = result.rows.item(i);

        const p = this.historyTransaction.getStatusTransaction(database, 4, item.idReturn).then(status => {
          let itemReturn: ItemListaDevoluciones = {
            idReturn: item.idReturn,
            coReturn: item.coReturn,
            coClient: item.coClient,
            naClient: item.naClient,
            lbClient: item.lbClient,
            stReturn: item.stReturn,
            daReturn: item.daReturn,
            naStatus: status,
            stDelivery: item.stDelivery
          }
          this.itemReturns.push(itemReturn);
        });
        promises.push(p);


      }

      await Promise.all(promises);

      return this.returnList;
    }).catch(e => {
      this.returnList = [];
      console.log("[ReturnLogicService] Error al cargar Return List.");
      console.log(e);
    })
  }

  updateSendButtonState() {
    let valid = true;
    if (this.productList.length > 0) {
      for (let index = 0; index < this.productList.length; index++) {
        const element = this.productList[index];
        if (!element.coDocument || !element.quProduct) {
          valid = false;
          break;
        }
      }
    } else {
      valid = false;
    }
    this.onReturnValidToSend(valid);
    this.onReturnValidToSave(valid);
    this.setChange(true, true);
  }
  /*   getTags() {
      this.services.getTags(this.dbServ.getDatabase(), "DEV", "ESP").then(result => {
        for (var i = 0; i < result.length; i++) {
          this.tags.set(
            result[i].coApplicationTag, result[i].tag
          )
        }
      })
    } */

  findReturnSelected(coReturn: string) {
    console.log('returnLogicService: findReturn');
    let coords = this.newReturn.coordenada;
    //buscar la cabecera de devolucion
    this.findReturn(coReturn).then(() => {
      this.findReturnDetails(this.dbServ.getDatabase(), coReturn).then(() => {
        this.selectedReturn = true;
        if (this.userMustActivateGPS) {
          this.newReturn.coordenada = coords;
        }
        this.returnSelected.next(true)
      });
      this.adjuntoService.getSavedPhotos(this.dbServ.getDatabase(), this.newReturn.coReturn, 'devoluciones');
      this.enterpriseReturn = this.enterpriseServ.empresas.find((emp) => emp.idEnterprise === this.newReturn.idEnterprise)!;
      this.returnSent = this.newReturn.stDelivery === null || this.newReturn.stDelivery === 1;
      this.bloquearFactura = this.newReturn.stDelivery === null || this.newReturn.stDelivery === 1;
      this.findInvoices().then();
      this.findInvoiceDetailUnits().then();
      this.setChange(false, true);

    });
  }

  findReturn(coReturn: string) {
    var database = this.dbServ.getDatabase();
    this.newReturn = {} as Return;
    var select = "select rs.id_return as idReturn, rs.co_return as coReturn, rs.st_return as stReturn, rs.da_return as daReturn, rs.na_responsible as naResponsible, rs.na_responsible as naResponsible, " +
      " rs.nu_seal as nuSeal, rs.id_type as idType, rs.tx_comment as txComment, rs.co_user as coUser, rs.id_user as idUser, " +
      " rs.co_client as coClient, rs.id_client as idClient, rs.lb_client as lbClient, rs.co_invoice as coInvoice, rs.id_invoice as idInvoice, rs.st_delivery as stDelivery, " +
      " rs.coordenada as coordenada, rs.co_enterprise as coEnterprise, rs.id_enterprise as idEnterprise FROM returns rs where rs.co_return = ?"
    return database.executeSql(select, [coReturn]).then(result => {
      this.newReturn = result.rows.item(0);
    }).catch(e => {
      this.newReturn = {} as Return;
      console.log("[ReturnLogicService] Error al cargar findReturn.");
      console.log(e);
    })
  }

  findReturnDetails(dbServ: SQLiteObject, coReturn: string) {
    this.productList = [];
    return this.returnDatabaseService.getDetailsByCoReturn(dbServ, coReturn).then((result) => {
      this.productList = result;
      this.productListCart.next(this.productList);
    }).catch(e => {
      this.newReturn = {} as Return;
      console.log("[ReturnLogicService] Error al cargar findReturnDetails.");
      console.log(e);
    })
  }

  findInvoices() {
    this.invoices = [];
    return this.returnDatabaseService.getInvoicesByIdClient(this.synchronizationServices.getDatabase(), this.newReturn.idClient).then((result) => {
      this.invoices = result;
    }).catch(e => {
      console.log("[ReturnLogicService] Error al cargar findInvoices.");
      console.log(e);
    })
  }

  findProductsByInvoice() {
    this.validateReturnProductList = [];
    return this.productService.getProductsByIdInvoice(this.dbServ.getDatabase(), this.newReturn.idInvoice).then(() => {
      this.validateReturnProductList = this.productService.productList;
      this.productsByInvoice.next(true);
    }).catch(e => {
      this.productsByInvoice.next(true);
      console.log("[ReturnLogicService] Error al cargar findInvoices.");
      console.log(e);
    })
  }

  findInvoiceDetailUnits() {
    return this.returnDatabaseService.getInvoiceDetailUnitsByIdInvoice(this.synchronizationServices.getDatabase(), this.newReturn.idInvoice).then(() => {
      this.newReturn.invoicedetailUnits = this.returnDatabaseService.invoiceDetailUnits;
    });
  }

}
