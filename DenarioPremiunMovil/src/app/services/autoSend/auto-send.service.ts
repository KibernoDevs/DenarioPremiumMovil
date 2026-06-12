import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, Subject, map, finalize, concatMap, timer, from, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CapacitorHttp, HttpOptions, HttpResponse, HttpHeaders } from '@capacitor/core';
import { Device } from '@capacitor/device';

import { PendingTransaction } from 'src/app/modelos/tables/pendingTransactions';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { VisitasService } from 'src/app/visitas/visitas.service';
import { ServicesService } from '../services.service';
import { MessageService } from '../messageService/message.service';
import { Response } from 'src/app/modelos/response';
import { Visit } from 'src/app/modelos/tables/visit';
import { DELIVERY_STATUS_SENT, DELIVERY_STATUS_TO_SEND, VISIT_STATUS_TO_SEND, VISIT_STATUS_VISITED, CLIENT_POTENTIAL_STATUS_SENT, COLLECT_STATUS_NEW, COLLECT_STATUS_SAVED, COLLECT_STATUS_SENT, COLLECT_STATUS_TO_SEND, DEPOSITO_STATUS_SENT } from 'src/app/utils/appConstants'
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { UserAddresClients } from 'src/app/modelos/tables/userAddresClients';
import { ClientLocationService } from '../clientes/locationClient/client-location.service';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { Return } from 'src/app/modelos/tables/return';
import { ReturnDatabaseService } from '../returns/return-database.service';
import { InventariosLogicService } from '../inventarios/inventarios-logic.service';
import { ClientStocks, ClientStocksDetailUnits } from 'src/app/modelos/tables/client-stocks';
import { PotentialClientDatabaseServicesService } from '../clientes/potentialClient/potential-client-database-services.service';
//import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { Orders } from 'src/app/modelos/tables/orders';
import { OrderDetail } from 'src/app/modelos/tables/orderDetail';
import { OrderDetailUnit } from 'src/app/modelos/tables/orderDetailUnit';
import { OrderDetailDiscount } from 'src/app/modelos/orderDetailDiscount';
import { CollectionService } from '../collection/collection-logic.service';
import { Collection } from 'src/app/modelos/tables/collection';
import { Deposit } from 'src/app/modelos/tables/deposit';
import { DepositService } from '../deposit/deposit.service';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { Request } from 'src/app/modelos/request';
import { PotentialClient } from 'src/app/modelos/tables/potentialClient';
import { PendingTransactionsAttachments } from 'src/app/modelos/tables/pendingTransactionsAttachments';
import { DateServiceService } from '../dates/date-service.service';

@Injectable({
  providedIn: 'root'
})
export class AutoSendService implements OnInit {

  public obsQueue = new Subject<Observable<any>>();
  public obsQueueCount = 1;
  public funcObsQueue = new Subject<() => Observable<any>>();
  public funcObsQueueCount = 1;
  public pendingTransaction!: PendingTransaction[];
  public pendingTransactionsAttachments!: PendingTransactionsAttachments[];
  public messageAlert!: MessageAlert;
  private potentialClientServices = inject(PotentialClientDatabaseServicesService)
  private locationServices = inject(ClientLocationService)
  private inventariosLogicService = inject(InventariosLogicService)
  private collectionService = inject(CollectionService);
  private depositService = inject(DepositService);
  private visitService = inject(VisitasService);
  private orderService = inject(PedidosService);
  private dateServ = inject(DateServiceService);

  public rolTransportista = false;
  private isProcessingPending = false;

  constructor(
    private dbService: SynchronizationDBService,

    private services: ServicesService,
    private http: HttpClient,
    private messageService: MessageService,
    private router: Router,
    private adjuntoService: AdjuntoService,
    private returnDatabaseService: ReturnDatabaseService
  ) {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        let userTransportista = JSON.parse(userStr);
        if (userTransportista.transportista) {
          this.rolTransportista = true;
        }
      } catch (e) {
        this.rolTransportista = false;
      }
    }
  }

  ngOnInit(): void {
    this.getPendingTransaction().then((result) => {
      this.pendingTransaction = result;
      if (this.pendingTransaction.length > 0) {
        this.funcObsQueueCount = this.pendingTransaction.length;
        /* this.process(this.pendingTransaction) */
        this.initTransaction(this.pendingTransaction);
      }
    })
    this.getPendingTransactionsAttachments().then((result) => {
      console.log("PendingTransactionsAttachments", result);
      this.pendingTransactionsAttachments = result;
      if (this.pendingTransactionsAttachments.length > 0) {
        // actualizar en memoria la propiedad `cantidad` con el total por coTransaction
        const counts = new Map<string, number>();
        this.pendingTransactionsAttachments.forEach(att => {
          counts.set(att.coTransaction, (counts.get(att.coTransaction) ?? 0) + 1);
        });
        this.pendingTransactionsAttachments.forEach(att => {
          att.cantidad = counts.get(att.coTransaction) ?? 0;
        });
        this.adjuntoService.sendPendingPhotos(this.dbService.getDatabase(), this.pendingTransactionsAttachments);
      }
    })
  }

  async runPendingQueue(): Promise<void> {
    if (this.isProcessingPending) {
      return;
    }

    this.isProcessingPending = true;
    try {
      const pending = await this.getPendingTransaction();
      this.pendingTransaction = pending;
      if (pending.length > 0) {
        this.funcObsQueueCount = pending.length;
        this.initTransaction(pending);
      }

      const pendingAttachments = await this.getPendingTransactionsAttachments();
      this.pendingTransactionsAttachments = pendingAttachments;
      if (pendingAttachments.length > 0) {
        const counts = new Map<string, number>();
        pendingAttachments.forEach(att => {
          counts.set(att.coTransaction, (counts.get(att.coTransaction) ?? 0) + 1);
        });
        pendingAttachments.forEach(att => {
          att.cantidad = counts.get(att.coTransaction) ?? 0;
        });

        this.adjuntoService.sendPendingPhotos(this.dbService.getDatabase(), pendingAttachments);
      }
    } finally {
      this.isProcessingPending = false;
    }
  }

  public addFuncObs() {
    const currentCount = this.funcObsQueueCount;
    console.log('[QUEUING]', currentCount)
    /* const subject = timer(1000).pipe(map(x => currentCount)); */
    const subject = timer(1000).pipe(map(x => currentCount));
    this.funcObsQueue.next(() => {
      console.log('executing func')
      return subject;
    });
    this.funcObsQueueCount++;
  }

  private getPendingTransaction() {
    let pendingTransaction: PendingTransaction[] = [];
    return this.dbService.getDatabase().executeSql(
      'SELECT * FROM pending_transactions ORDER BY rowid ASC', [
    ]).then(res => {
      for (var i = 0; i < res.rows.length; i++) {
        pendingTransaction.push({
          coTransaction: res.rows.item(i).co_transaction,
          idTransaction: res.rows.item(i).id_transaction,
          type: res.rows.item(i).type
        })
      }
      return pendingTransaction;
    }).catch(e => {
      console.log(e);
      return pendingTransaction;
    })
  }

  private getPendingTransactionsAttachments() {
    let pendingTransactionsAttachments: PendingTransactionsAttachments[] = [];
    return this.dbService.getDatabase().executeSql(
      'SELECT * FROM pending_transactions_attachments WHERE id_transaction <> 0;', [
    ]).then(res => {
      for (var i = 0; i < res.rows.length; i++) {
        pendingTransactionsAttachments.push({
          naAttachment: res.rows.item(i).na_attachment,
          idTransaction: res.rows.item(i).id_transaction,
          coTransaction: res.rows.item(i).co_transaction,
          type: res.rows.item(i).type,
          naTransaction: res.rows.item(i).na_transaction,
          position: res.rows.item(i).position,
          cantidad: 0
        })
      }
      return pendingTransactionsAttachments;
    }).catch(e => {
      console.log(e);
      return pendingTransactionsAttachments;
    })
  }

  private process(transaction: PendingTransaction[]) {
    console.log('PROCESSING QUEUE...')
    this.funcObsQueue
      .pipe(
        finalize(() => console.log('stopped processing queue')),
        concatMap(x => x()))
      .subscribe(x => {
        console.log('[PROCESSED]', x)
      });
  }

  async initTransaction(pendingTransactions: PendingTransaction[]): Promise<void> {
    if (pendingTransactions.length === 0) {
      return;
    }

    const isOnline = (): boolean => localStorage.getItem('connected') === 'true';

    for (const pt of pendingTransactions) {
      try {
        const advanceQueue = await this.settlePendingTransaction(pt);
        /** false sólo debe cortar ciclo ante fallos tipo 066 / no clasificados; errores >99 “skip” siguen como true y no cortan. */
        if (!advanceQueue && isOnline()) {
          break;
        }
      } catch (e) {
        console.log('[AutoSendService] Error en pendiente:', e);
        if (isOnline()) {
          break;
        }
      }
    }
  }

  private async settlePendingTransaction(pt: PendingTransaction): Promise<boolean> {
    switch (pt.type) {
      case "collect":
        return this.dispatchCollectTransaction(pt.coTransaction);
      case "potentialClient":
        return this.dispatchPotentialClientTransaction(pt.coTransaction);
      case "visit":
        return this.dispatchVisitTransaction(pt.coTransaction);
      case "order":
        return this.dispatchOrderTransaction(pt.coTransaction);
      case "deposit":
        return this.dispatchDepositTransaction(pt.coTransaction);
      case "updateaddress":
        return this.dispatchUpdateAddressTransaction(pt.coTransaction);
      case "return":
        return this.dispatchReturnTransaction(pt.coTransaction);
      case "clientStock":
        return this.dispatchClientStockTransaction(pt.coTransaction);
      default:
        console.warn("[AutoSendService] Tipo de pendiente desconocido:", pt.type);
        return true;
    }
  }

  private async dispatchCollectTransaction(coTransaction: string): Promise<boolean> {
    const request: Request = {
      collection: {} as Collection,
      document: {} as DocumentSale,
    };

    const collect = await this.collectionService.getCollection(this.dbService.getDatabase(), coTransaction);
    if (!collect) {
      console.warn("[AutoSendService] Sin datos de cobro " + coTransaction);
      return true;
    }

    request.collection = collect;
    request.collection.idUser = Number(localStorage.getItem("idUser"));
    request.collection.coUser = localStorage.getItem("coUser")!;
    if ((collect.hasIGTF != null ? collect.hasIGTF.toString() : "false") == "true") {
      request.document = request.collection.document!;
      if (Object.keys(request.document).length <= 0)
        delete request.document;
    } else {
      delete request.document;
    }

    const coType = Number(request.collection.coType);
    const db = this.dbService.getDatabase();

    if (coType === 1) {
      request.collection.collectionPayments = await this.collectionService.getCollectionPayments(db, coTransaction);
      request.collection.collectionDetails = [];
    } else if (coType === 2) {
      const collectionDetails = await this.collectionService.getCollectionDetails(db, coTransaction);
      request.collection.collectionDetails = collectionDetails.map(detail => ({
        ...detail,
        nuBalanceDoc: detail.nuBalanceDocOriginal,
        nuBalanceDocConversion: detail.nuBalanceDocOriginalConversion,
      }));
      request.collection.collectionPayments = [];
    } else {
      const collectionDetails = await this.collectionService.getCollectionDetails(db, coTransaction);
      request.collection.collectionDetails = collectionDetails.map(detail => ({
        ...detail,
        nuBalanceDoc: detail.nuBalanceDocOriginal,
        nuBalanceDocConversion: detail.nuBalanceDocOriginalConversion,
      }));
      const collectionDetailsDiscounts = await this.collectionService.getCollectionDetailsDiscounts(db, coTransaction);
      const all = (collectionDetailsDiscounts || []) as any[];
      const isDiscount = (x: any): boolean =>
        Boolean(x && (x.idCollectDiscount !== undefined || x.nuCollectDiscount !== undefined));
      const discounts = all.filter(isDiscount);
      for (let i = 0; i < request.collection.collectionDetails.length; i++) {
        const detail = request.collection.collectionDetails[i] as any;
        detail.collectionDetailDiscounts =
          discounts.filter((d: any) => d.coDocument === detail.coDocument) ?? [];
      }
      request.collection.collectionPayments = await this.collectionService.getCollectionPayments(db, coTransaction);
    }

    const payments = request.collection?.collectionPayments ?? [];
    const details = request.collection?.collectionDetails ?? [];
    let send = true;
    switch (coType) {
      case 0:
      case 1:
        if (payments.length === 0) {
          send = false;
        }
        break;
      case 2:
        if (details.length === 0) {
          send = false;
        }
        break;
      case 3:
      case 4:
        if (payments.length === 0 || details.length === 0) {
          send = false;
        }
        break;

      default:
        send = false;
        console.warn(
          "AutoSendService: coType desconocido (" +
            coType +
            "). Se cancela el envío por seguridad.",
        );
        break;
    }

    if (!send) {
      return true;
    }
    return await this.sendTransaction(request, "collect", coTransaction);
  }

  private async dispatchPotentialClientTransaction(coTransaction: string): Promise<boolean> {
    const request = { potentialClient: {} } as Request;
    const pc = await this.potentialClientServices.getPotentialClientById(coTransaction);
    if (!pc || pc.length === 0) {
      console.warn("[AutoSendService] Potential client vacío " + coTransaction);
      return true;
    }
    request.potentialClient = {
      coClient: pc[0].coClient,
      naClient: pc[0].naClient,
      nuRif: pc[0].nuRif,
      naResponsible: pc[0].naResponsible,
      emClient: pc[0].emClient,
      nuPhone: pc[0].nuPhone,
      coUser: pc[0].coUser,
      idUser: pc[0].idUser,
      txAddress: pc[0].txAddress,
      txAddressDispatch: pc[0].txAddressDispatch,
      txClient: pc[0].txClient,
      naWebSite: pc[0].naWebSite,
      daClient: pc[0].daPotentialClient,
      coEnterprise: pc[0].coEnterprise,
      idEnterprise: pc[0].idEnterprise,
      coordenada: pc[0].coordenada,
      coordenadaClient: pc[0].coordenadaClient,
      nuAttachments: pc[0].nuAttachments,
      hasAttachments: String(pc[0].hasAttachments).toLowerCase() === "true",
    };
    return await this.sendTransaction(request, "potentialClient", pc[0].coClient);
  }

  private async dispatchVisitTransaction(coTransaction: string): Promise<boolean> {
    const request: Request = {
      visit: {} as Visit,
    };
    const v = await this.visitService.getVisit(coTransaction);

    request.visit = v;

    if (this.rolTransportista) {
      if (v.visitDetails && Array.isArray(v.visitDetails)) {
        for (let i = 0; i < v.visitDetails.length; i++) {
          if (request.visit.visitDetails![i].coCause === 0) {
            request.visit.visitDetails![i].coCause = null as any;
          }
        }
      }
    }
    request.visit.coordenadaSaved = false;
    if (v.stVisit == VISIT_STATUS_TO_SEND) {
      request.visit.idVisit = null as any;
    }

    return await this.sendTransaction(request, "visit", v.coVisit);
  }

  private async dispatchOrderTransaction(coTransaction: string): Promise<boolean> {
    let request: Request = {
      order: {} as Orders,
    };
    const o = await this.orderService.getPedido(coTransaction);
    if (o != null) {
      request = {
        order: o,
      };
    }
    if (request.order!.stOrder == DELIVERY_STATUS_TO_SEND) {
      request.order!.idOrder = null as any;
      for (let i = 0; i < request.order!.orderDetails.length; i++) {
        request.order!.orderDetails[i].idOrderDetail = null as any;
        for (let j = 0; j < request.order!.orderDetails[i].orderDetailUnit.length; j++) {
          request.order!.orderDetails[i].orderDetailUnit[j].idOrderDetailUnit = null as any;
        }
        if (request.order!.orderDetails[i].orderDetailDiscount != null) {
          for (let k = 0; k < request.order!.orderDetails[i].orderDetailDiscount!.length; k++) {
            request.order!.orderDetails[i].orderDetailDiscount![k].idOrderDetailDiscount =
              null as any;
            request.order!.orderDetails[i].orderDetailDiscount![k].idOrderDetail = null as any;
          }
        }
      }
    }
    return await this.sendTransaction(request, "order", coTransaction);
  }

  private async dispatchDepositTransaction(coTransaction: string): Promise<boolean> {
    const request: Request = {
      deposit: {} as Deposit,
      collectionIds: {},
    };
    const deposit = await this.depositService.getDeposit(this.dbService.getDatabase(), coTransaction);
    request.deposit = deposit!;
    request.deposit.idUser = Number(localStorage.getItem("idUser"));
    request.deposit.coUser = localStorage.getItem("coUser")!;
    request.deposit.idDeposit = null;

    await this.depositService.getDepositCollect(this.dbService.getDatabase(), coTransaction);
    const collectionIds = await this.depositService.getIdsDepositCollect(
      this.dbService.getDatabase(),
      coTransaction,
    );
    request.collectionIds = collectionIds;
    return await this.sendTransaction(request, "deposit", coTransaction);
  }

  private async dispatchUpdateAddressTransaction(coTransaction: string): Promise<boolean> {
    const request: Request = {
      userAddressClient: {} as UserAddresClients,
    };
    const result = await this.locationServices.getUserAddresLocation(
      this.dbService.getDatabase(),
      coTransaction,
    );
    request.userAddressClient = result;
    request.userAddressClient.idUserAddressClient = null as any;
    return await this.sendTransaction(request, "updateaddress", result.coUserAddressClient);
  }

  private async dispatchReturnTransaction(coTransaction: string): Promise<boolean> {
    const request: Request = {
      returns: {} as Return,
    };
    try {
      const ret = await this.returnDatabaseService.getReturn(this.dbService.getDatabase(), coTransaction);
      request.returns = { ...ret, details: ret.details?.map(detail => ({ ...detail })) ?? [] };
      if (ret.stDelivery == DELIVERY_STATUS_TO_SEND) {
        request.returns.idReturn = null as any;
        request.returns.daReturn = request.returns.daReturn.replace('T', ' ');
        for (let i = 0; i < request.returns.details.length; i++) {
          request.returns.details[i].idReturn = null as any;
        }
      }
      return await this.sendTransaction(request, "return", ret.coReturn);
    } catch (e) {
      console.log("[ReturnDatabaseService] Error al ejecutar getReturn.");
      console.log(e);
      return false;
    }
  }

  private async dispatchClientStockTransaction(coTransaction: string): Promise<boolean> {
    const request: Request = {
      clientStock: {} as ClientStocks,
    };
    try {
      const clientStock = await this.inventariosLogicService.getClientStock(
        this.dbService.getDatabase(),
        coTransaction,
      );
      console.log(clientStock);
      request.clientStock = clientStock;
      request.clientStock.daClientStock = request.clientStock.daClientStock.replace("T", " ");
      if (clientStock.stDelivery == DELIVERY_STATUS_TO_SEND) {
        request.clientStock.idClientStock = null as any;
        request.clientStock.daClientStock = request.clientStock.daClientStock.replace("T", " ");
        for (let i = 0; i < request.clientStock.clientStockDetails.length; i++) {
          request.clientStock.clientStockDetails[i].idClientStockDetail = null as any;
        }
      }
      return await this.sendTransaction(request, "clientStock", clientStock.coClientStock);
    } catch (e) {
      console.log("Error al ejecutar getClientStock.");
      console.log(e);
      return false;
    }
  }

  async sendTransaction(request: any, type: string, coTransaction: string): Promise<boolean> {
    const connected = localStorage.getItem('connected') === 'true';

    /** Sin conexión: no borra pendientes aquí (deja igual que antes). Siguiente item puede intentarse. */
    if (!connected) {
      return true;
    }

    try {
      try {
        const deviceInfo = await Device.getInfo();
        const deviceId = await Device.getId();
        request.transactionDeviceAuth = {
          deviceUUID: deviceId.identifier,
          devicePlatform: deviceInfo.platform,
          deviceModel: deviceInfo.model,
          deviceVersion: deviceInfo.name,
          appVersion: localStorage.getItem('versionApp'),
          dbVersion: localStorage.getItem('db_version'),
          idTransaction: null,
          coTransaction: coTransaction,
          typeTransaction: type,
        };
      } catch (error) {
        console.log('No se pudo obtener info del dispositivo para autoenvio', error);
      }

      const result = await firstValueFrom(this.callService(request, type, coTransaction));
      console.log(result);

      if (result && result.errorCode === '000') {
        this.messageAlert = new MessageAlert('Denario Premium', result.errorMessage);
        this.messageService.alertModal(this.messageAlert);

        await this.persistServerSuccessForPending(type, result);

        await this.deletePendingTransaction(result.coTransaction, result.type);
        return true;
      }

      if (result && result.errorCode === '066') {
        this.messageAlert = new MessageAlert('Denario Premium', result.errorMessage);
        this.messageService.alertModal(this.messageAlert);
        return false;
      }

      if (this.isBadRequestResponse(result)) {
        await this.handleBadRequestFailedTransaction(coTransaction, type, request, result);
        return true;
      }

      if (this.shouldSkipAndKeepPending(result)) {
        console.warn(
          `[AutoSendService] Error > 99 (no 400). Se salta y se mantiene en pendientes ${type}:${coTransaction}`,
          result,
        );
        /** true = no detener initTransaction; esta fila sigue en SQLite, el resto sí se intenta. */
        return true;
      }

      console.warn(
        `[AutoSendService] Se mantiene en pendientes ${type}:${coTransaction} por error no-400`,
        result,
      );
      return false;
    } catch (e: any) {
      if (this.isBadRequestError(e)) {
        await this.handleBadRequestFailedTransaction(
          coTransaction,
          type,
          request,
          this.normalizeHttpErrorPayload(e),
        );
        return true;
      }
      if (this.shouldSkipAndKeepPending(e)) {
        console.warn(
          `[AutoSendService] Error > 99 (no 400). Se salta y se mantiene en pendientes ${type}:${coTransaction}`,
          e,
        );
        /** Misma política que rama síncrona: cola sigue con siguientes pendientes. */
        return true;
      }
      console.error(e);
      console.warn(
        `[AutoSendService] Se mantiene en pendientes ${type}:${coTransaction} por error no-400`,
        e,
      );
      return false;
    }
  }

  /** Escrituras locales antes de borrar pendiente; clientStock debe completar vínculos antes del siguiente envío. */
  private async persistServerSuccessForPending(type: string, result: any): Promise<void> {
    switch (type) {
      case 'potentialClient':
        this.updateTransaction(result.coTransaction, result.idClient, result.type);
        return;
      case 'visit':
        this.updateTransaction(result.coTransaction, result.idVisit, result.type);
        return;
      case 'order':
        this.updateTransaction(result.coTransaction, result.orderId, result.type);
        return;
      case 'updateaddress':
        this.updateTransaction(result.coTransaction, result.userAddressClientId, result.type);
        return;
      case 'return':
        this.updateTransaction(result.coTransaction, result.returnId, result.type);
        return;
      case 'clientStock':
        await this.updateTransaction(result.coTransaction, result.clientStockId, result.type);
        return;
      case 'collect':
        this.updateTransaction(result.coTransaction, result.collectionId, result.type);
        return;
      case 'deposit':
        this.updateTransaction(result.coTransaction, result.depositId, result.type);
        return;
      default:
        return;
    }
  }


  /** Solo HTTP 400 / Bad Request: sale de pendientes y va a failed_transactions. */
  private isBadRequestResponse(result: any): boolean {
    if (!result) {
      return false;
    }

    const status = Number(result.httpStatus ?? result.status ?? result.statusCode);
    if (status === 400) {
      return true;
    }

    const code = String(result.errorCode ?? result.code ?? '').trim();
    const normalizedCode = code.toUpperCase();
    if (
      code === '400' ||
      normalizedCode === 'BAD_REQUEST' ||
      normalizedCode === 'ERR_BAD_REQUEST'
    ) {
      return true;
    }

    return false;
  }

  private isBadRequestError(error: any): boolean {
    if (!error) {
      return false;
    }

    const status = Number(error.status ?? error.statusCode ?? error?.error?.status ?? error?.error?.statusCode);
    if (status === 400) {
      return true;
    }

    const errorCode = error.code ?? error.errorCode ?? error?.error?.code ?? error?.error?.errorCode;
    if (errorCode === 400) {
      return true;
    }

    if (typeof errorCode === 'string') {
      const normalizedCode = errorCode.toUpperCase();
      if (normalizedCode === '400' || normalizedCode === 'BAD_REQUEST' || normalizedCode === 'ERR_BAD_REQUEST') {
        return true;
      }
    }

    return false;
  }

  private shouldSkipAndKeepPending(payload: any): boolean {
    if (!payload) {
      return false;
    }

    const status = Number(payload.httpStatus ?? payload.status ?? payload.statusCode ?? payload?.error?.status ?? payload?.error?.statusCode);
    if (!isNaN(status)) {
      return status > 99 && status !== 400;
    }

    const rawCode = payload.errorCode ?? payload.code ?? payload?.error?.errorCode ?? payload?.error?.code;
    const numericCode = Number(rawCode);
    if (!isNaN(numericCode)) {
      return numericCode > 99 && numericCode !== 400;
    }

    if (typeof rawCode === 'string') {
      const normalizedCode = rawCode.trim().toUpperCase();
      if (normalizedCode.startsWith('5')) {
        return true;
      }
    }

    return false;
  }

  private async handleBadRequestFailedTransaction(
    coTransaction: string,
    type: string,
    request: any,
    payload?: any
  ): Promise<void> {
    try {
      if (type === 'collect') {
        await this.restoreCollectDocumentStatus(coTransaction);
      }

      await this.insertFailedTransaction(
        coTransaction,
        type,
        payload?.errorCode ?? '400',
        payload?.errorMessage ?? 'Bad request al enviar la transacción.',
        request
      );

      await this.deletePendingTransaction(coTransaction, type);
    } catch (e) {
      console.log('Error al mover bad request a transacciones fallidas', e);
    }
  }

  private normalizeHttpErrorPayload(error: any): { errorCode: string; errorMessage: string } {
    const nested = error?.error ?? {};
    const status = error?.status ?? error?.statusCode ?? nested?.status ?? nested?.statusCode;
    const errorCode = String(
      error?.code ?? error?.errorCode ?? nested?.code ?? nested?.errorCode ?? status ?? ''
    );
    const errorMessage = String(
      error?.message ??
        nested?.message ??
        nested?.errorMessage ??
        nested?.error ??
        'Error de servidor al enviar la transacción.'
    );
    return { errorCode, errorMessage };
  }

  private async restoreCollectDocumentStatus(coTransaction: string): Promise<void> {
    try {
      await this.collectionService.updateDocumentStForDelete(
        this.dbService.getDatabase(),
        coTransaction
      );
    } catch (error) {
      console.error(
        `[AutoSendService] Error al restaurar document_st para cobro fallido ${coTransaction}`,
        error
      );
    }
  }

  private resolveFailedTransactionContext(
    request: any,
    type: string
  ): { idUser: number; coUser: string; idEnterprise: number; coEnterprise: string } {
    const idUser = Number(localStorage.getItem('idUser') ?? 0);
    const coUser = localStorage.getItem('coUser') ?? '';
    const entity = this.getFailedTransactionEntity(request, type);
    const idEnterprise = entity?.idEnterprise ?? 0;
    const coEnterprise = entity?.coEnterprise ?? '';
    return { idUser, coUser, idEnterprise, coEnterprise };
  }

  private getFailedTransactionEntity(request: any, type: string): {
    idEnterprise?: number;
    coEnterprise?: string;
  } | null {
    if (!request) {
      return null;
    }
    switch (type) {
      case 'collect':
        return request.collection ?? null;
      case 'order':
        return request.order ?? null;
      case 'deposit':
        return request.deposit ?? null;
      case 'potentialClient':
        return request.potentialClient ?? null;
      case 'visit':
        return request.visit ?? null;
      case 'return':
        return request.returns ?? null;
      case 'clientStock':
        return request.clientStock ?? null;
      case 'updateaddress':
        return request.userAddressClient ?? null;
      default:
        return null;
    }
  }

  private insertFailedTransaction(
    coTransaction: string,
    type: string,
    errorCode: string,
    errorMessage: string,
    request: any
  ) {
    let txObject = '{}';
    try {
      txObject = JSON.stringify(request ?? {});
    } catch (e) {
      txObject = JSON.stringify({ serializationError: true });
    }

    const coFailedTransaction = this.dateServ.generateCO(0);
    const { idUser, coUser, idEnterprise, coEnterprise } =
      this.resolveFailedTransactionContext(request, type);

    return this.dbService.getDatabase().executeSql(
      'INSERT INTO failed_transactions(co_failed_transaction, co_transaction, type, error_code, error_message, transaction_object, da_failed, co_user, id_user, co_enterprise, id_enterprise) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      [
        coFailedTransaction,
        coTransaction,
        type,
        errorCode,
        errorMessage,
        txObject,
        new Date().toISOString(),
        coUser,
        idUser,
        coEnterprise,
        idEnterprise,
      ]
    );
  }

  callService(request: any, type: string, coTransaction: string) {
    var url: string = this.services.getURLService();
    switch (type) {
      case "potentialClient":
        url = url + 'potentialclientservice/potentialclient'
        break;

      case "visit":
        url = url + "visitservice/visit"
        break;

      case "updateaddress":
        url = url + "addressclientservice/updateaddress";
        break;

      case "return":
        url = url + "returnservice/return"
        break;

      case "clientStock":
        url = url + "clientstockservice/clientstock"
        break;

      case 'order':
        url = url + 'orderservice/order';
        break

      case 'collect':
        url = url + 'collectionservice/collection';
        break

      case 'deposit':
        url = url + 'depositservice/deposit';
        break


      default:
        break;
    }
    let opt = this.services.getHttpOptionsAuthorization();
    opt.url = url;
    opt.data = request;

    return from(CapacitorHttp.post(opt))
      .pipe(
        map(resp => {
          if (resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data)) {
            resp.data.coTransaction = coTransaction;
            resp.data.type = type;
            resp.data.httpStatus = resp.status;
            return resp.data;
          }
          return {
            coTransaction,
            type,
            httpStatus: resp.status,
            errorCode: String(resp.status),
            errorMessage:
              typeof resp.data === 'string'
                ? resp.data
                : 'Ocurrió un error al enviar la transacción.',
          };
        })
      );
  }

  async updateTransaction(coTransaction: string, idTransaction: number, type: string) {

    const updatePendingTransactionsAttachments = 'UPDATE pending_transactions_attachments SET id_transaction = ? WHERE co_transaction = ?';
    await this.dbService.getDatabase().executeSql(updatePendingTransactionsAttachments, [idTransaction, coTransaction])

    switch (type) {
      case 'potentialClient': {
        this.dbService.getDatabase()!.executeSql(
          'UPDATE potential_clients SET id_client = ?, st_potential_client = ? WHERE co_client = ?',
          [idTransaction, CLIENT_POTENTIAL_STATUS_SENT, coTransaction]
        ).then(res => {
          console.log("UPDATE EXITOSO ", res);
          this.adjuntoService.sendPhotos(this.dbService.getDatabase(), idTransaction, "clientes", coTransaction);
        }).catch(e => {
          console.log("UPDATE NO EXITOSO ", e);
        })
        break;
      }

      case 'visit': {

        this.dbService.getDatabase().executeSql("UPDATE incidences SET id_visit = ?  WHERE co_visit = ?", [idTransaction, coTransaction]).then(res => {

          console.log("UPDATE EXITOSO ", res);
          this.adjuntoService.sendPhotos(this.dbService.getDatabase(), idTransaction, "visitas", coTransaction);
        }).catch(e => {
          console.log("UPDATE NO EXITOSO ", e);
        });

        this.dbService.getDatabase().executeSql(
          'UPDATE visits SET id_visit = ?, st_visit = ? WHERE co_visit = ?', [idTransaction, VISIT_STATUS_VISITED, coTransaction]
        ).catch(e => {
          console.log("UPDATE NO EXITOSO ", e);
        });
        break;
      }

      case 'order':
        this.dbService.getDatabase().executeSql(
          'UPDATE orders SET id_order = ?, st_delivery = ? WHERE co_order = ?', [idTransaction, DELIVERY_STATUS_SENT, coTransaction]
        ).then(res => {
          this.adjuntoService.sendPhotos(this.dbService.getDatabase(), idTransaction, "pedidos", coTransaction);
          void this.dbService.getDatabase().executeSql(
            'UPDATE client_stocks SET id_order = ? WHERE co_order = ?',
            [idTransaction, coTransaction],
          ).catch(e => console.log('UPDATE client_stocks.id_order vínculo', e));
        })
        break;

      case 'updateaddress': {
        this.dbService.getDatabase().executeSql(
          'UPDATE user_address_clients SET id_user_address_client = ?, status = ? WHERE co_user_address_client = ?',
          [idTransaction, DELIVERY_STATUS_SENT, coTransaction]
        ).then(res => {
          console.log("UPDATE EXITOSO ", res);
        }).catch(e => {
          console.log("UPDATE NO EXITOSO ", e);
        })
        break;
      }

      case 'return': {
        this.dbService.getDatabase().executeSql(
          'UPDATE returns SET id_return = ?, st_delivery = ? WHERE co_return = ?',
          [idTransaction, 1, coTransaction]
        ).then(res => {
          console.log("UPDATE EXITOSO ", res);

          this.adjuntoService.sendPhotos(this.dbService.getDatabase(), idTransaction, "devoluciones", coTransaction);

        }).catch(e => {
          console.log("UPDATE NO EXITOSO ", e);
        })
        break;
      }

      case 'clientStock': {
        await this.dbService.getDatabase().executeSql(
          'UPDATE client_stocks SET id_client_stock = ?, st_delivery = ? WHERE co_client_stock = ?',
          [idTransaction, DELIVERY_STATUS_SENT, coTransaction]
        );
        console.log("UPDATE EXITOSO ", coTransaction);
        this.adjuntoService.sendPhotos(this.dbService.getDatabase(), idTransaction, "inventarios", coTransaction);
        await this.dbService.getDatabase().executeSql(
          'UPDATE orders SET id_client_stock = ? WHERE co_client_stock = ?',
          [idTransaction, coTransaction],
        );
        break;
      }

      case 'collect': {
        this.dbService.getDatabase().executeSql(
          'UPDATE collections SET id_collection= ?, st_collection= ?, st_delivery = 1 WHERE co_collection = ?',
          [idTransaction, DELIVERY_STATUS_SENT, coTransaction]
        ).then(res => {
          console.log("UPDATE EXITOSO ", res);
          this.adjuntoService.sendPhotos(this.dbService.getDatabase(), idTransaction, "cobros", coTransaction);
        }).catch(e => {
          console.log("UPDATE NO EXITOSO ", e);
        })
        break;
      }
      case 'deposit': {
        this.dbService.getDatabase().executeSql(
          'UPDATE deposits SET id_deposit= ?, st_deposit= ?, st_delivery = ? WHERE co_deposit= ?',
          [idTransaction, DEPOSITO_STATUS_SENT, 1, coTransaction]
        ).then(res => {
          console.log("UPDATE EXITOSO ", res);
          this.adjuntoService.sendPhotos(this.dbService.getDatabase(), idTransaction, "depositos", coTransaction);
        }).catch(e => {
          console.log("UPDATE NO EXITOSO ", e);
        })
        break;
      }
    }
  }

  deletePendingTransaction(coTransaction: string, type: string) {
    return this.dbService.getDatabase().executeSql(
      'DELETE FROM pending_transactions WHERE co_transaction = ? AND type = ?',
      [coTransaction, type]
    ).then(res => {
      console.log("BORRADO EXITOSO ", res);
    }).catch(e => {
      console.log("BORRADO NO EXITOSO ", e);
    })
  }
  /*
    getOrderRequest(coOrder: string) {
      //busca todos los documentos relacionados con el coOrder y los devuelve en un request.
      //para mandarlo a backend.

      let order: Orders;
      let orderDetails: OrderDetail[] = [];
      let orderUnits: OrderDetailUnit[] = [];
      let orderDetailDiscounts: OrderDetailDiscount[] = [];

      let queryOrder = "SELECT co_order as coOrder, co_client as coClient , id_client as idClient , da_order as daOrder, " +
        "da_created as daCreated , na_responsible as naResponsible, id_user as idUser, id_order_creator as idOrderCreator, " +
        "in_order_review as inOrderReview, nu_amount_total as nuAmountTotal, nu_amount_final as nuAmountFinal, co_currency as coCurrency, " +
        "da_dispatch as daDispatch, tx_comment as txComment, nu_purchase as nuPurchase , co_enterprise as coEnterprise, co_user as coUser , " +
        "co_payment_condition as coPaymentCondition, id_payment_condition as idPaymentCondition, id_enterprise as idEnterprise, " +
        "co_address_client as coAddress, id_address_client as idAddress, nu_amount_discount as nuAmountDiscount, " +
        "nu_amount_total_base as nuAmountTotalBase, st_order as stOrder, coordenada , nu_discount as nuDiscount, " +
        "id_currency as idCurrency, id_currency_conversion as idCurrencyConversion, nu_value_local as nuValueLocal, " +
        "nu_amount_total_conversion as nuAmountTotalConversion, nu_amount_final_conversion as nuAmountFinalConversion, " +
        "procedencia , nu_amount_total_base_conversion as nuAmountTotalBaseConversion, " +
        "nu_amount_discount_conversion nuAmountDiscountConversion, id_order_type as idOrderType, nu_attachments as nuAttachments, has_attachments as hasAttachments " +
        "FROM orders WHERE co_order = ?";

      let queryDetails = "SELECT co_order_detail as coOrderDetail , co_order as coOrder , co_product as coProduct, " +
        "na_product as naProduct, id_product as idProduct, nu_price_base as nuPriceBase, nu_amount_total as nuAmountTotal, " +
        "co_warehouse as coWarehouse, id_warehouse as idWarehouse, qu_suggested as quSuggested, co_enterprise as coEnterprise, " +
        "id_enterprise as idEnterprise, iva , nu_discount_total as nuDiscountTotal, co_discount as coDiscount, id_discount as idDiscount, " +
        "co_price_list as coPriceList, id_price_list as idPriceList, posicion , nu_price_base_conversion as nuPriceConversion, " +
        "nu_discount_total_conversion  nuDiscountTotalConversion, nu_amount_total_conversion as nuAmountTotalConversion " +
        "FROM order_details WHERE co_order = ? ";

      // para estos 2 debo usar un hack asqueroso donde agrego los coOrderDetail directo al query como strings.
      let queryUnits = "SELECT co_order_detail_unit  as coOrderDetailUnit, co_order_detail as coOrderDetail, " +
        "co_product_unit as coProductUnit, id_product_unit as idProductUnit, qu_order as quOrder, co_enterprise as coEnterprise, " +
        "id_enterprise as idEnterprise, co_unit as coUnit, qu_suggested as quSuggested " +
        "FROM order_detail_units WHERE co_order_detail in (";

      let queryDiscounts = "SELECT co_order_detail_discount as coOrderDetailDiscount, " +
        "co_order_detail as coOrderDetail, id_order_detail as idOrderDetail, id_discount as idDiscount, qu_discount as quDiscount, " +
        "nu_price_final as nuPriceFinal, co_enterprise as coEnterprise, id_enterprise as idEnterprise " +
        "FROM order_detail_discount WHERE co_order_detail in (";


      return this.dbService.getDatabase().executeSql(queryOrder, [coOrder]).then(data1 => {
        order = data1.rows.item(0);
        return this.dbService.getDatabase().executeSql(queryDetails, [coOrder]).then(data2 => {
          let coOrderDetails: string[] = [];
          for (let i = 0; i < data2.rows.length; i++) {
            let item = data2.rows.item(i);

            orderDetails.push(item);
            coOrderDetails.push(item.coOrderDetail);
          }
          order.orderDetails = orderDetails;

          return this.dbService.getDatabase().executeSql(queryUnits + coOrderDetails.toString() + ")", []).then(data3 => {
            for (let i = 0; i < data3.rows.length; i++) {
              let item = data3.rows.item(i)
              orderUnits.push(item);
              let detail = orderDetails.find(x => x.coOrderDetail == item.coOrderDetail);
              if (detail) {
                if (detail.orderDetailUnit) { }
                else { detail.orderDetailUnit = [] }
                detail.orderDetailUnit.push(item);
              }
            }

            return this.dbService.getDatabase().executeSql(queryDiscounts + coOrderDetails.toString() + ")", []).then(data4 => {
              for (let i = 0; i < data4.rows.length; i++) {
                let item = data4.rows.item(i);
                orderDetailDiscounts.push(item);
                let detail = orderDetails.find(x => x.coOrderDetail == item.coOrderDetail);
                if (detail) {
                  if (detail.orderDetailDiscount) { }
                  else { detail.orderDetailDiscount = [] }
                  detail.orderDetailDiscount.push(item);
                }
              }
              order.nuDetails = orderDetails.length;

              let request = {
                order: order,
                //orderDetails: orderDetails,
                //orderDetailUnits: orderUnits,
                //orderDetailDiscounts: orderDetailDiscounts

              }

              console.log(request);
              return request;

            });
          });
        })


      });


    }
      */

}
