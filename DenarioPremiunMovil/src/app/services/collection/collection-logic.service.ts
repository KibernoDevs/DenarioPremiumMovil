import { COLLECT_STATUS_SAVED } from './../../utils/appConstants';
import { Position } from '@capacitor/geolocation';
import { Injectable, Injector, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { ChangeDetectorRef } from '@angular/core';


import { Client } from 'src/app/modelos/tables/client';
import { Collection, CollectionDetail, CollectionDetailDiscounts, CollectionPayment } from 'src/app/modelos/tables/collection';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { Currencies } from 'src/app/modelos/tables/currencies';
import { ConversionType } from 'src/app/modelos/tables/conversionType';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { IgtfList } from 'src/app/modelos/tables/igtfList';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { PagoCheque } from 'src/app/modelos/pago-cheque';
import { BankAccount } from 'src/app/modelos/tables/bankAccount';
import { ServicesService } from '../services.service';
import { DateServiceService } from '../dates/date-service.service';
import { PagoDeposito } from 'src/app/modelos/pago-deposito';
import { PagoEfectivo } from 'src/app/modelos/pago-efectivo';
import { PagoOtros } from 'src/app/modelos/pago-otros';
import { PagoMovil } from 'src/app/modelos/pago-movil';
import { PagoTransferencia } from 'src/app/modelos/pago-transferencia';
import { TiposPago } from 'src/app/modelos/tipos-pago';
import { CurrencyService } from '../currency/currency.service';
import { Retention } from 'src/app/modelos/retention';
import { Bank } from 'src/app/modelos/tables/bank';
import { PaymentPartials } from 'src/app/modelos/paymentPartial';
import { ClientBankAccount } from 'src/app/modelos/tables/clientBankAccount';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { HistoryTransaction } from '../historyTransaction/historyTransaction';
import { ItemListaCobros } from 'src/app/cobros/item-lista-cobros';
import { COLLECT_STATUS_SENT, COLLECT_STATUS_TO_SEND, COLLECT_STATUS_NEW } from 'src/app/utils/appConstants';
import { TransactionStatuses } from '../../modelos/tables/transactionStatuses';
import { MessageService } from '../messageService/message.service';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { DifferenceCode } from 'src/app/modelos/tables/differenceCode';
import { ClientLogicService } from '../clientes/client-logic.service';
import { CollectDiscounts } from 'src/app/modelos/tables/collectDiscounts';
import { TypeDocument } from 'src/app/modelos/tables/typeDocument';
import { CodePhoneNumber } from 'src/app/modelos/tables/codePhoneNumber';

export interface DocumentSalesPagination {
  limit: number;
  offset: number;
  includeSelected?: boolean;
}


@Injectable({
  providedIn: 'root'
})

export class CollectionService {
  // Getter para uso en template si es necesario
  public getLastRateValue(): number {
    return this.lastRateValue;
  }
  public globalConfig = inject(GlobalConfigService);
  public services = inject(ServicesService);
  public dateServ = inject(DateServiceService);
  public historyTransaction = inject(HistoryTransaction);
  private currencyService = inject(CurrencyService);
  public adjuntoService = inject(AdjuntoService);
  public injector = inject(Injector);
  //public clientLogic = inject(ClientLogicService);
  private _messageService?: MessageService;
  public get messageService(): MessageService {
    if (!this._messageService) {
      this._messageService = this.injector.get(MessageService);
    }
    return this._messageService!;
  }

  public collection!: Collection;
  public enterprise!: Enterprise;
  public client!: Client;
  public newClient!: Client;
  public currencies!: Currencies[];
  public currencySelected!: Currencies;
  public currencyConversion!: Currencies;
  public conversionTypes: ConversionType[] = [];
  public documentSales: DocumentSale[] = [];
  public documentSalesBackup: DocumentSale[] = [];
  public documentSalesView: DocumentSale[] = [];
  public readonly DOCUMENT_SALES_PAGE_SIZE = 30;
  public documentSalesPageSize: number = this.DOCUMENT_SALES_PAGE_SIZE;
  public documentSalesCurrentPage: number = 0;
  public documentSalesTotalRows: number = 0;
  public documentSalesPageIds = new Set<number>();
  public igtfSelected!: IgtfList;
  public igtfList!: IgtfList[];
  public retention!: Retention;
  public listCollect: Collection[] = [];
  public listBankAccounts!: BankAccount[];
  public listBanks!: Bank[];
  public clientBankAccounts!: ClientBankAccount[];
  public enterpriseSelected!: Enterprise;
  public localCurrency!: Currencies;
  public hardCurrency!: Currencies;
  public currencyList!: Currencies[];
  public currencyListDocument: Currencies[] = [];
  public enterpriseList: Enterprise[] = [];
  public currencySelectedDocument!: Currencies;
  public documentSaleOpen!: DocumentSale;
  public pagoEfectivo: PagoEfectivo[] = [];
  public pagoCheque: PagoCheque[] = [];
  public pagoDeposito: PagoDeposito[] = [];
  public pagoTransferencia: PagoTransferencia[] = [];
  public pagoMovil: PagoMovil[] = [];
  public pagoOtros: PagoOtros[] = [];
  public tiposPago: TiposPago[] = [];
  public bankAccountSelected!: BankAccount[];
  public clientBankAccountSelected!: BankAccount[];
  public paymentPartials: PaymentPartials[] = [];
  public itemListaCobros: ItemListaCobros[] = [];
  public coDocumentToUpdate: string[] = [];
  public listTransactionStatusCollections: TransactionStatuses[] = [];
  public collectionRefused: TransactionStatuses[] = [];
  public collectionApproved: TransactionStatuses[] = [];
  public collectionSended: TransactionStatuses[] = [];
  public differenceCode: DifferenceCode[] = [];
  public differenceCodeSelected: DifferenceCode[] = [];
  public collectDiscounts: CollectDiscounts[] = [];
  public typeDocumentList: TypeDocument[] = [];
  public codePhoneNumberList: CodePhoneNumber[] = [];
  public tempSelectedCollectDiscounts: CollectDiscounts[] = [];
  public prevSelectedCollectDiscounts: CollectDiscounts[] = [];
  public selectedCollectDiscounts: number[] = [];
  public displayedItems: any[] = [];

  public messageAlert!: MessageAlert;
  public anticipoAutomatico!: any;

  public collectionTags = new Map<string, string>([]);
  public collectionTagsDenario = new Map<string, string>([]);

  public tipoPagoEfectivo!: boolean;
  public tipoPagoCheque!: boolean;
  public tipoPagoDeposito!: boolean;
  public tipoPagoTransferencia!: boolean;
  public tipoPagoOtros!: boolean;
  public tipoPagoPagoMovil!: boolean;
  public haveRate: boolean = false;
  public initCollect: boolean = true;
  public showHeaderButtons: Boolean = false;
  public disableSavedButton: boolean = true;
  public disableSendButton: boolean = true;
  public saveOrExitOpen = false;
  /** Tras guardar o abrir desde lista: hay copia coherente en BD. */
  public collectionPersistedBaseline = false;
  /** Cambios locales desde el último guardado / apertura limpia. */
  public collectionDirtySincePersist = false;
  private collectionDirtyTrackingPaused = false;
  public alertMessageOpen: boolean = false;
  public alertMessageChangeCurrency: boolean = false;
  public alertMessageChangeDateRate: boolean = false;
  public isLocalCurrency: boolean = false;
  public isHardCurrency: boolean = false;
  public multiCurrency!: boolean;
  public isOpen: boolean = false;
  public isPaymentPartial: boolean = false;
  public isChangePaymentPartial: boolean = false;
  public isChangePaymentPartialPersistence: boolean = false;
  public igtfDefault: boolean = false;
  public separateIgtf: boolean = false;
  public userMustActivateGPS: boolean = true; //si la pongo en false puedes entrar al clickear rapido
  public disabledCurrency: boolean = false;
  public enterpriseEnabled: boolean = false;
  public disabledClient: boolean = false;
  public createAutomatedPrepaid: boolean = false;
  public addRetention: boolean = false;
  public documentsSaleComponent: boolean = false;
  public documentsClientReloaded$ = new Subject<number>();
  public cobroComponent: boolean = false;
  public cobrosComponent: boolean = true;
  public cobrosDocumentComponent: boolean = true;
  public cobroListComponent: boolean = false;
  public collectionIsSave: boolean = false;
  public collectValid: boolean = false;
  public requiredComment: boolean = false;
  public validComment: boolean = false;
  public isAnticipo: boolean = false;
  public isRetention: boolean = false;
  public changeClient: boolean = false;
  public onChangeClient: boolean = false;
  public changeEnterprise: boolean = false;
  public isOpenCollect: boolean = false;
  public recentOpenCollect: boolean = false;
  public hideDocuments: boolean = false;
  public hidePayments: boolean = false;
  public userCanSelectIGTF: boolean = false;
  public historicoTasa: boolean = false;
  public retentionDocTypeCR: boolean = false;
  public validNuRetention: boolean = false;
  public clientBankAccount: boolean = false;
  public retencion: boolean = false;
  public validateDaVoucher: boolean = true;
  public haveDocumentSale: boolean = false;
  public newCollect: boolean = false;
  public alertMessageChangeEnterprise: boolean = false;
  public cobroValid: boolean = false;
  public validateCollectionDate: boolean = false;
  public enableDate: boolean = true;
  public historicPartialPayment: boolean = false;
  public userCanCollectIva: boolean = true;
  public sendCollection: boolean = false;
  public openPaymentPartial: boolean = false;
  public showNuevaCuenta: boolean = false;
  public cobro25: boolean = false;
  public disabledInputClient: boolean = false;
  //public conversionDocument: boolean = false;
  public currencyBank: boolean = false;
  public currencyLocal: boolean = false;
  public currencyHard: boolean = false;
  public disableCheckIGTF: boolean = false;
  public tolerancia0: boolean = false;
  public MonedaToleranciaIsLocal: boolean = false;
  public MonedaToleranciaIsHard: boolean = false;
  public automatedPrepaid: boolean = false;
  public existPartialPayment: boolean = false;
  public allPaymentPartial: boolean = false;
  public disabledSelectCollectMethodDisabled: boolean = true;
  public collectValidTabs: boolean = true;
  public calculateDifference: boolean = false;
  public showConversion: boolean = true;
  public currencySelector: boolean = true;
  public userCanAddRetention: boolean = false;
  public messageSended: boolean = false;
  public enableDifferenceCodes: boolean = false;
  public userCanSelectCollectDiscount: boolean = false;
  public missingRetention: boolean = false;
  public missingRetentionValue: boolean = false;
  public canChangeRate: boolean = false;
  public alwaysRetention: boolean = false;
  public alwaysPartialPayment: boolean = false;
  public enablePartialPayment: boolean = false;
  public requiredCollectionAttachments: boolean = false;
  public requiredAnticipoAttachments: boolean = false;
  public requiredRetentionAttachments: boolean = false;
  private typeDocumentListLoaded: boolean = false;
  private codePhoneNumberListLoaded: boolean = false;
  public enabledManualRate: boolean = false;
  public isRateChangeInProgress: boolean = false;

  public totalEfectivo: number = 0;
  public totalCheque: number = 0;
  public totalDeposito: number = 0;
  public totalTransferencia: number = 0;
  public totalPagoMovil: number = 0;
  public totalOtros: number = 0;
  public coTypeModule!: string;
  public lengthMethodPaid: number = -1;
  public montoTotalPagar: number = 0;
  public montoTotalPagarConversion: number = 0;
  public montoTotalPagado: number = 0;
  public montoTotalPagadoConversion: number = 0;
  public montoIgtf: number = 0;
  public montoIgtfConversion: number = 0;
  public montoIgtfLocal: number = 0;
  public montoTotalDiscounts: number = 0;
  public rateList: number[] = [];
  public rateSelected!: number;
  public parteDecimal: number = 0;
  public montoaPagar: number = 0;
  public indexDocumentSaleOpen: number = 0;
  public sizeRetention: number = 0;
  public amountPaymentPartial: number = 0;
  public amountPaid: number = 0;
  public amountPaidConversion: number = 0;
  public amountPaidDoc: number = 0;
  public amountPaidRetention: number = 0;
  public nuAmountTotal: number = 0;
  public nuBalance: number = 0;
  public RangoTolerancia: number = 0;
  public prepaidRangeAmount: number = 0;
  public RangoToleranciaPositiva: number = 0;
  public RangoToleranciaNegativa: number = 0;
  public TipoTolerancia: number = 0;
  public difDocsNegativosByRate: number = 0;
  public difDocsNegativosByOriginalRate: number = 0;
  public difference: number = 0;
  public totalCollectDiscounts: number = 0;
  public totalCollectDiscountsSelected: number = 0;
  public totalHistoricPartialPayment: number = 0;

  public documentCurrency!: string;
  public dateTasa!: string;
  public fechaMayor: string = this.dateServ.hoyISO();
  public fechaMenor!: string;
  public dateRate: string = "";
  public dateRateVisual: string = "";
  public formatRetention: string = "";
  public titleModule: string = "";
  public nuevaCuenta!: string;
  public nameClient: string = "";
  public mensaje: string = '';
  public coDocumentPaymentPartial: string = '';
  public MonedaTolerancia: string = "";
  public prepaidRangeCurrency: string = "";
  public tabSelected: string = "general";
  public totalCollectDiscountsView: string = "";

  public backRoute = new Subject<string>;
  public saveCollect = new Subject<string>;
  public saveSend = new Subject<string>;
  public validCollection = new Subject<Boolean>;
  public showButtons = new Subject<Boolean>;
  public collectValidToSave = new Subject<Boolean>;
  public collectValidToSend = new Subject<Boolean>;

  public mapDocumentsSales = new Map<number, DocumentSale>([]);

  public regexOnlyText = new RegExp("[A-Za-z]", "i");
  public regexAlphaNumeric = new RegExp("[A-Za-z0-9]", "i");

  public dateToday: Date = (() => {
    const d = new Date();
    d.setDate(d.getDate());
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  public alertButtons = [
    /*  {
       text: '',
       role: 'cancel'
     }, */
    {
      text: '',
      role: 'confirm'
    },
  ];

  public alertButtonsSend = [
    {
      text: '',
      role: 'cancel'
    },
    {
      text: '',
      role: 'confirm'
    },
  ];


  public COLLECT_STATUS_TO_SEND = COLLECT_STATUS_TO_SEND;
  public COLLECT_STATUS_NEW = COLLECT_STATUS_NEW;
  public COLLECT_STATUS_SAVED = COLLECT_STATUS_SAVED;
  public COLLECT_STATUS_SENT = COLLECT_STATUS_SENT;

  initLogicService() {


    this.COLLECT_STATUS_TO_SEND = COLLECT_STATUS_TO_SEND;
    this.COLLECT_STATUS_NEW = COLLECT_STATUS_NEW;
    this.COLLECT_STATUS_SAVED = COLLECT_STATUS_SAVED;
    this.COLLECT_STATUS_SENT = COLLECT_STATUS_SENT;

    //this.coTypeModule = '0';
    //this.titleModule = this.collectionTags.get('COB_NOMBRE_MODULO')!;
    this.disabledClient = false;

    //SETEAMOS LAS VARIABLES PARA COBROS
    this.parteDecimal = Number(this.globalConfig.get('parteDecimal'));
    this.enterpriseEnabled = this.globalConfig.get('enterpriseEnabled') === 'true' ? true : false;
    this.sizeRetention = Number(this.globalConfig.get('sizeRetention'));
    this.retentionDocTypeCR = this.globalConfig.get('retentionDocTypeCR') === "true" ? true : false;
    this.clientBankAccount = this.globalConfig.get('clientBankAccount') === "true" ? true : false;
    this.userCanSelectIGTF = this.globalConfig.get('userCanSelectIGTF') === "true" ? true : false;
    this.retencion = this.globalConfig.get('retencion') === "true" ? true : false;
    this.historicoTasa = this.globalConfig.get('historicoTasa') === "true" ? true : false;
    this.validateCollectionDate = this.globalConfig.get('validateCollectionDate') === "true" ? true : false;
    this.historicPartialPayment = this.globalConfig.get('historicPartialPayment') === "true" ? true : false;
    this.userCanCollectIva = this.globalConfig.get('userCanCollectIva') === "true" ? true : false;
    //this.conversionDocument = this.globalConfig.get('conversionDocument') === "true" ? true : false;
    this.currencyBank = this.globalConfig.get('currencyBank') == "true" ? true : false;
    this.disableCheckIGTF = this.globalConfig.get('disableCheckIGTF') == "true" ? true : false;
    this.tolerancia0 = this.globalConfig.get('tolerancia0') == "true" ? true : false;
    this.TipoTolerancia = Number(this.globalConfig.get('TipoTolerancia'));
    this.RangoTolerancia = Number(this.globalConfig.get('RangoTolerancia'));
    this.MonedaTolerancia = this.globalConfig.get('MonedaTolerancia');
    this.multiCurrency = this.globalConfig.get('multiCurrency') === 'true' ? true : false;
    this.prepaidRangeCurrency = this.globalConfig.get('prepaidRangeCurrency');
    this.prepaidRangeAmount = Number(this.globalConfig.get('prepaidRangeAmount'));
    this.igtfDefault = this.globalConfig.get('igtfDefault') === 'true' ? true : false;
    this.automatedPrepaid = this.globalConfig.get('automatedPrepaid') === 'true' ? true : false;
    this.RangoToleranciaNegativa = Number(this.globalConfig.get('RangoToleranciaNegativa'));
    this.RangoToleranciaPositiva = Number(this.globalConfig.get('RangoToleranciaPositiva'));
    if (this.globalConfig.get("currencyModule") == "true" ? true : false) {
      this.showConversion = this.currencyService.getCurrencyModule("cob").showConversion.toString() === "true" ? true : false;
      this.currencySelector = this.currencyService.getCurrencyModule("cob").currencySelector.toString() === "true" ? true : false;
      this.disabledCurrency = this.currencyService.getCurrencyModule("cob").currencySelector.toString() === "true" ? false : true;
    }
    this.userCanAddRetention = this.globalConfig.get('userCanAddRetention') === 'true' ? true : false;
    this.enableDifferenceCodes = this.globalConfig.get('enableDifferenceCodes') === 'true' ? true : false;
    const userCanSelectCollectDiscountValue = (this.globalConfig.get('userCanSelectCollectDiscount') || '').trim();
    this.userCanSelectCollectDiscount = userCanSelectCollectDiscountValue === 'true' ? true : false;
    const canChangeRateValue = (this.globalConfig.get('canChangeRate') || '').trim();
    this.canChangeRate = canChangeRateValue === 'true' ? true : false;
    const missingRetentionValue = (this.globalConfig.get('missingRetention') || '').trim();
    this.missingRetention = missingRetentionValue === 'true' ? true : false;
    const alwaysRetentionValue = (this.globalConfig.get('alwaysRetention') || '').trim();
    this.alwaysRetention = alwaysRetentionValue === 'true' ? true : false;
    const alwaysPartialPaymentValue = (this.globalConfig.get('alwaysPartialPayment') || '').trim();
    this.alwaysPartialPayment = alwaysPartialPaymentValue === 'true' ? true : false;
    const enablePartialPaymentValue = (this.globalConfig.get('enablePartialPayment') || '').trim();
    this.enablePartialPayment = enablePartialPaymentValue === '' ? true : enablePartialPaymentValue === 'true' ? true : false;
    const requiredCollectionAttachmentsValue = (this.globalConfig.get('requiredCollectionAttachments') || '').trim();
    this.requiredCollectionAttachments = requiredCollectionAttachmentsValue === '' ? true : requiredCollectionAttachmentsValue === 'true' ? true : false;
    const requiredAnticipoAttachmentsValue = (this.globalConfig.get('requiredAnticipoAttachments') || '').trim();
    this.requiredAnticipoAttachments = requiredAnticipoAttachmentsValue === '' ? true : requiredAnticipoAttachmentsValue === 'true' ? true : false;
    const requiredRetentionAttachmentsValue = (this.globalConfig.get('requiredRetentionAttachments') || '').trim();
    this.requiredRetentionAttachments = requiredRetentionAttachmentsValue === '' ? true : requiredRetentionAttachmentsValue === 'true' ? true : false;
    const enabledManualRateValue = (this.globalConfig.get('enabledManualRate') || '').trim();
    this.enabledManualRate = enabledManualRateValue === '' ? true : enabledManualRateValue === 'true' ? true : false;



    //this.showNuevaCuenta = this.clientBankAccount === true ? true : false;

    this.changeClient = false;
    this.newCollect = true;
    this.cobroValid = false;
    this.disabledInputClient = false;
    this.alertMessageOpen = false;
    this.alertMessageChangeCurrency = false;


    if (this.globalConfig.get('formatRetention') === '0')
      this.formatRetention = "number";
    else if (this.globalConfig.get('formatRetention') === '1')
      this.formatRetention = "text";
    else if (this.globalConfig.get('formatRetention') === '2')
      this.formatRetention = "alpha";

    this.alertButtonsSend[0].text = this.collectionTagsDenario.get('DENARIO_BOTON_CANCELAR')!
    this.alertButtonsSend[1].text = this.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
    this.alertButtons[0].text = this.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!

    if (!this.userCanSelectIGTF) {
      this.igtfSelected = {
        idIgtf: 0,
        naIgtf: '',
        price: 0,
        descripcion: '',
        defaultIgtf: 'false'
      } as IgtfList;
    }

    return Promise.resolve(true);
  }

  showBackRoute(route: string) {
    console.log('Back-Service: ' + route);
    this.backRoute.next(route);
    // this.titleModule = this.collectionTags.get('COB_NOMBRE_MODULO')!;
  }

  pauseCollectionDirtyTracking(): void {
    this.collectionDirtyTrackingPaused = true;
  }

  resumeCollectionDirtyTracking(): void {
    this.collectionDirtyTrackingPaused = false;
  }

  markCollectionDirty(): void {
    if (this.collectionDirtyTrackingPaused || this.recentOpenCollect) {
      return;
    }
    this.collectionDirtySincePersist = true;
  }

  applyPersistSucceededBaseline(): void {
    this.collectionDirtySincePersist = false;
    this.collectionPersistedBaseline = true;
  }

  resetCollectionExitBaseline(): void {
    this.collectionPersistedBaseline = false;
    this.collectionDirtySincePersist = false;
  }

  markCollectionOpenedFromPersistedCopy(): void {
    this.collectionPersistedBaseline = true;
    this.collectionDirtySincePersist = false;
  }

  isCollectionReadOnlyForEdit(): boolean {
    const stDelivery = Number(this.collection?.stDelivery ?? 0);
    return stDelivery === COLLECT_STATUS_TO_SEND
      || stDelivery === COLLECT_STATUS_SENT
      || stDelivery === 6;
  }

  shouldPromptCollectionExitSaveOrDiscard(): boolean {
    if (!this.cobroComponent || this.isCollectionReadOnlyForEdit()) {
      return false;
    }

    if (!this.cobroValid && !this.collectValid) {
      return false;
    }

    return !this.collectionPersistedBaseline || this.collectionDirtySincePersist;
  }

  loadPaymentMethods() {
    // Cargamos los tipos de pago según la configuración de la app.
    this.pagoEfectivo = [] as PagoEfectivo[];
    this.pagoCheque = [] as PagoCheque[];
    this.pagoDeposito = [] as PagoDeposito[];
    this.pagoTransferencia = [] as PagoTransferencia[];
    this.pagoMovil = [] as PagoMovil[];
    this.pagoOtros = [] as PagoOtros[];
    this.tiposPago = [] as TiposPago[];

    const paymentConfigRaw = (this.globalConfig.get('colletionPayment') || '').trim();
    const configFlags = paymentConfigRaw.split('-').map(flag => flag.trim().toLowerCase() === 'true');
    const getFlag = (index: number) => configFlags[index] === true;

    this.tipoPagoEfectivo = getFlag(0);
    this.tipoPagoCheque = getFlag(1);
    this.tipoPagoDeposito = getFlag(2);
    this.tipoPagoTransferencia = getFlag(3);
    this.tipoPagoOtros = getFlag(4);
    this.tipoPagoPagoMovil = getFlag(5);

    const paymentTypeDefinitions: Array<{ enabled: boolean; type: string; name: string }> = [
      { enabled: this.tipoPagoEfectivo, type: 'ef', name: 'Efectivo' },
      { enabled: this.tipoPagoCheque, type: 'ch', name: 'Cheque' },
      { enabled: this.tipoPagoDeposito, type: 'de', name: 'Depósito' },
      { enabled: this.tipoPagoTransferencia, type: 'tr', name: 'Transferencia' },
      { enabled: this.tipoPagoOtros, type: 'ot', name: 'Otros' },
      { enabled: this.tipoPagoPagoMovil, type: 'pm', name: 'Pago Móvil' },
    ];

    this.tiposPago = paymentTypeDefinitions
      .filter(paymentType => paymentType.enabled)
      .map(paymentType => ({
        type: paymentType.type,
        name: paymentType.name,
        selected: false
      }));

    return Promise.resolve(true);
  }


  getTags(dbServ: SQLiteObject) {
    return this.services.getTags(dbServ, "COB", "ESP").then(result => {
      for (var i = 0; i < result.length; i++) {
        this.collectionTags.set(
          result[i].coApplicationTag, result[i].tag
        )
      }
      return Promise.resolve(true);
    })
  }
  getTagsDenario(dbServ: SQLiteObject) {
    return this.services.getTags(dbServ, "DEN", "ESP").then(result => {
      for (var i = 0; i < result.length; i++) {
        this.collectionTagsDenario.set(
          result[i].coApplicationTag, result[i].tag
        )
      }
      return Promise.resolve(true);
    })
  }

  // ...existing code...

  getCurrencies(dbServ: SQLiteObject, idEnterprise: number) {
    // Trae las monedas de la empresa y normaliza la selección inicial.
    return this.getCurrenciesEnterprise(dbServ, idEnterprise).then((result) => {
      // normalizar resultado
      this.currencyList = Array.isArray(result) ? result : [];

      // utilidad local para interpretar 'true' tanto si viene como boolean o string
      const isTrue = (v: any) => v === true || String(v ?? '').toLowerCase() === 'true';

      // identificar moneda local/hard en la lista
      const localCurrencyItem = this.currencyList.find(c => isTrue(c?.localCurrency));
      const hardCurrencyItem = this.currencyList.find(c => isTrue(c?.hardCurrency));

      // almacena referencias si existen (no asigna aún como selected)
      if (localCurrencyItem) this.localCurrency = localCurrencyItem;
      if (hardCurrencyItem) this.hardCurrency = hardCurrencyItem;

      // Si no había marca explícita, dejamos placeholders (se completará en setCurrency)
      if (!this.localCurrency && this.currencyList.length > 0) {
        // no forzamos yet, lo resolverá setCurrency con su prioridad
        this.localCurrency = this.currencyList[0];
      }
      if (!this.hardCurrency && this.currencyList.length > 1) {
        this.hardCurrency = this.currencyList.find(c => c !== this.localCurrency) ?? this.currencyList[0];
      }

      // Delegamos la lógica de selección a setCurrency, que aplica prioridades y fallbacks.
      return this.setCurrency();
    });
  }


  /**
   * Selecciona la moneda de la colección según estas reglas:
   * - Si collection.stCollection != 0 -> usar collection.coCurrency (si existe en currencyList).
   * - Si stCollection == 0:
   *    - Si currencyModule activo -> usar la configuración del módulo (localCurrencyDefault):
   *        - si true -> moneda marcada localCurrency === true
   *        - si false -> moneda marcada hardCurrency === true
   *    - Si currencyModule inactivo -> usar enterpriseSelected.coCurrencyDefault
   *
   * Siempre aplicar fallbacks seguros (enterprise default -> local flag -> first item).
   */
  setCurrency(): Promise<boolean> {
    const isTrue = (v: any) => v === true || String(v ?? '').toLowerCase() === 'true';

    // Seguridad: lista de monedas
    if (!Array.isArray(this.currencyList) || this.currencyList.length === 0) {
      console.warn('[CollectionService] setCurrency: currencyList vacía');
      this.currencySelected = {} as Currencies;
      this.localCurrency = this.localCurrency ?? ({} as Currencies);
      this.hardCurrency = this.hardCurrency ?? ({} as Currencies);
      return Promise.resolve(true);
    }

    const findByCo = (co?: string) => {
      if (!co) return undefined;
      return this.currencyList.find(c => ((c?.coCurrency ?? '').toString() === co.toString()));
    };

    const st = Number(this.collection?.stDelivery ?? this.COLLECT_STATUS_NEW);
    let chosen: Currencies | undefined;

    // 1) Si la colección ya tiene estado distinto de 0 -> respetar collection.coCurrency
    if (st !== 0) {
      const co = (this.collection?.coCurrency ?? '').toString();
      chosen = findByCo(co);
      if (chosen) {
        console.debug('[CollectionService] setCurrency: seleccionada por collection.coCurrency:', chosen.coCurrency);
      } else {
        console.warn('[CollectionService] setCurrency: collection.coCurrency no encontrada en currencyList:', co);
        // fallback razonable: intentar enterprise default u otra heurística más abajo
      }
      // aplicar elección (si chosen undefined, applyChosenCurrency manejará fallback)
      this.applyChosenCurrency(chosen);
      return Promise.resolve(true);
    }

    // 2) st === 0 -> decidir según currencyModule o enterprise default
    const currencyModuleEnabled = isTrue(this.globalConfig.get('currencyModule'));

    if (currencyModuleEnabled) {
      // Leer la configuración del módulo 'cob' (puede no contener coCurrency; usamos localCurrencyDefault)
      let moduleCfg: any = null;
      try {
        if (this.currencyService && typeof this.currencyService.getCurrencyModule === 'function') {
          moduleCfg = this.currencyService.getCurrencyModule('cob');
        }
      } catch (err) {
        console.warn('[CollectionService] setCurrency: error leyendo currency module config', err);
        moduleCfg = null;
      }

      const localCurrencyDefault = isTrue(moduleCfg?.localCurrencyDefault);

      if (localCurrencyDefault) {
        chosen = this.currencyList.find(c => isTrue(c?.localCurrency));
        console.debug('[CollectionService] currencyModule activo: prefer localCurrency =>', chosen?.coCurrency);
      } else {
        chosen = this.currencyList.find(c => isTrue(c?.hardCurrency));
        console.debug('[CollectionService] currencyModule activo: prefer hardCurrency =>', chosen?.coCurrency);
      }

      // Si no encontró por flag, fallback a enterprise default o primera moneda
      if (!chosen) {
        const enterpriseCo = (this.enterpriseSelected?.coCurrencyDefault ?? '').toString();
        if (enterpriseCo) chosen = findByCo(enterpriseCo);
      }

      if (!chosen) {
        chosen = this.currencyList[0];
        console.debug('[CollectionService] currencyModule: fallback a primera moneda =>', chosen.coCurrency);
      }

      this.applyChosenCurrency(chosen);
      return Promise.resolve(true);
    }

    // 3) currencyModule deshabilitado -> usar enterpriseSelected.coCurrencyDefault
    const enterpriseDefaultCo = (this.enterpriseSelected?.coCurrencyDefault ?? '').toString();
    if (enterpriseDefaultCo) {
      chosen = findByCo(enterpriseDefaultCo);
      if (chosen) {
        console.debug('[CollectionService] currencyModule deshabilitado: selected by enterprise default:', chosen.coCurrency);
        this.applyChosenCurrency(chosen);
        return Promise.resolve(true);
      } else {
        console.warn('[CollectionService] enterpriseSelected.coCurrencyDefault no encontrada en currencyList:', enterpriseDefaultCo);
      }
    }

    // 4) Si seguimos sin moneda: intentar moneda marcada local
    chosen = this.currencyList.find(c => isTrue(c?.localCurrency));
    if (chosen) {
      console.debug('[CollectionService] currencyModule deshabilitado: selected by localCurrency flag:', chosen.coCurrency);
      this.applyChosenCurrency(chosen);
      return Promise.resolve(true);
    }

    // 5) Último fallback: primera moneda
    chosen = this.currencyList[0];
    console.debug('[CollectionService] setCurrency: fallback final a primera moneda:', chosen.coCurrency);
    this.applyChosenCurrency(chosen);
    return Promise.resolve(true);
  }

  /**
   * Aplica la moneda elegida: sincroniza collection, detecta local/hard si faltan,
   * actualiza flags y dispara conversiones/documentos cuando corresponda.
   */
  private applyChosenCurrency(chosen?: Currencies) {
    const isTrue = (v: any) => v === true || String(v ?? '').toLowerCase() === 'true';

    // Garantizar un objeto válido
    this.currencySelected = (chosen ?? (this.currencyList.length ? this.currencyList[0] : ({} as Currencies))) as Currencies;

    // Asegurar referencias local/hard si aún no están establecidas
    if (!this.localCurrency || !this.localCurrency.coCurrency) {
      if (isTrue(this.currencySelected?.localCurrency)) {
        this.localCurrency = this.currencySelected;
      } else {
        const detectedLocal = this.currencyList.find(c => isTrue(c?.localCurrency));
        if (detectedLocal) this.localCurrency = detectedLocal;
      }
    }

    if (!this.hardCurrency || !this.hardCurrency.coCurrency) {
      const detectedHard = this.currencyList.find(c => isTrue(c?.hardCurrency) && c !== this.localCurrency);
      if (detectedHard) this.hardCurrency = detectedHard;
      else this.hardCurrency = this.currencyList.find(c => c !== this.localCurrency) ?? this.currencyList[0];
    }

    // Sincronizar colección con la moneda seleccionada
    if (this.currencySelected && this.currencySelected.coCurrency) {
      this.collection.idCurrency = this.currencySelected.idCurrency;
      this.collection.coCurrency = this.currencySelected.coCurrency;
    } else {
      this.collection.idCurrency = this.collection.idCurrency ?? 0;
      this.collection.coCurrency = this.collection.coCurrency ?? '';
    }

    // Flags para UI/uso posterior
    this.currencyLocal = String(this.currencySelected?.localCurrency ?? '').toString() === 'true';
    this.currencyHard = String(this.currencySelected?.hardCurrency ?? '').toString() === 'true';

    // Configurar conversiones/documentos si procede
    try {
      if (this.multiCurrency) this.setCurrencyConversion();
    } catch (err) {
      console.warn('[CollectionService] setCurrencyConversion failed', err);
    }

    try {
      this.setCurrencyDocument();
    } catch (err) {
      console.warn('[CollectionService] setCurrencyDocument failed', err);
    }
  }

  setCurrencyDocument() {
    // Crea un objeto genérico de tipo Currencies
    const genericCurrency = new Currencies(
      0, // idCurrencyEnterprise
      0, // idCurrency
      'Moneda', // coCurrency
      false, // localCurrency
      false, // hardCurrency
      '', // coEnterprise
      0  // idEnterprise
    );

    // Asigna el array con el objeto genérico y luego el contenido real
    this.currencyListDocument = [genericCurrency, ...this.currencyList];
    // Después de cargar currencyListDocument:
    //this.currencySelectedDocument = this.currencyListDocument.find(c => c.coCurrency === this.collection.coCurrency) ?? genericCurrency;
  }

  setCurrencyConversion() {
    if (this.currencySelected.localCurrency.toString() === 'true')
      this.currencyConversion = this.hardCurrency;
    else
      this.currencyConversion = this.localCurrency;
  }

  getTasasHistorico(dbServ: SQLiteObject, idEnterprise: number) {
    return this.getTasasHistoricoFunction(dbServ, idEnterprise).then((result) => {
      /*       this.dateMayor = new Date(result[0].date_conversion);
            this.dateMenor = new Date(result[result.length - 1].date_conversion); */
      //this.dateServ.hoyISOFullTime();
      let hora = this.dateServ.hoyISOFullTime();
      let dateMayor = new Date(result[0].dateConversion);
      let yearMayor = dateMayor.getFullYear();
      let diaMayor = dateMayor.getDate().toString();
      let monthMayor = dateMayor.getMonth().toString();
      let dateMenor = new Date(result[result.length - 1].dateConversion);
      let yearMenor = dateMenor.getFullYear();
      let diaMenor = dateMenor.getDate().toString();
      let monthMenor = dateMenor.getMonth().toString();

      monthMenor = (Number(monthMenor) + 1).toString();
      monthMayor = (Number(monthMayor) + 1).toString();
      if (Number(diaMayor) < 10)
        diaMayor = "0" + diaMayor;

      if (Number(diaMenor) < 10)
        diaMenor = "0" + diaMenor;

      if (Number(monthMayor) < 10)
        monthMayor = "0" + monthMayor;

      if (Number(monthMenor) < 10)
        monthMenor = "0" + monthMenor;

      this.fechaMenor = yearMenor + "-" + monthMenor + "-" + diaMenor + "T00:00:00";
      /* this.fechaMayor = yearMayor + "-" + monthMayor + "-" + diaMayor + " " + hora.split(" ")[1]; */
      this.dateRate = yearMayor + "-" + monthMayor + "-" + diaMayor + " " + hora.split(" ")[1];

      if (this.collection.stDelivery == this.COLLECT_STATUS_SAVED) {
        this.dateRateVisual = this.collection.daRate + "T00:00:00";
      } else
        this.dateRateVisual = yearMayor + "-" + monthMayor + "-" + diaMayor + "T00:00:00";

      return Promise.resolve(true);
    })
  }

  getDateRate(dbServ: SQLiteObject, fecha: string) {

    if (this.collection.stDelivery == COLLECT_STATUS_TO_SEND)
      return;

    this.dateRate = fecha;
    //LUEGO DE SELECCIONAR LA FECHA, HAY QUE BUSCAR LA TASA CORRESPONDE A LA FECHA
    this.rateList = [];

    //if (this.collection.stCollection == 0)
    this.collection.daRate = fecha.substring(0, 10);
    ;
    /* this.valueTasa = this.mapFechas.get(fecha.split("T")[0])!; */

    this.conversionTypes.find((ct) => {
      if (fecha.substring(0, 10) == ct.dateConversion.substring(0, 10)) {
        this.rateList.push(ct.nuValueLocal);
      }
    })

    const savedRate = Number(this.collection?.nuValueLocal ?? 0);
    const isExistingCollection = Number(this.collection?.stCollection ?? 0) !== this.COLLECT_STATUS_NEW
      || Number(this.collection?.stDelivery ?? 0) !== this.COLLECT_STATUS_NEW
      || !!(this.collection?.coCollection && this.collection.coCollection.trim().length > 0);
    const keepSavedManualRate = this.enabledManualRate && isExistingCollection && Number.isFinite(savedRate) && savedRate > 0;

    if (this.rateList.length > 0) {
      this.historicoTasa = true;
      if (keepSavedManualRate) {
        this.rateSelected = savedRate;
        this.collection.nuValueLocal = savedRate;
      } else {
        this.rateSelected = this.collection.nuValueLocal = this.rateList[0];
      }
      this.haveRate = true;
      this.updateRateDocument();
      this.unlockTabsFunction(false);
      return Promise.resolve(true);
    } else {
      //no tengo tasa para ese dia
      if (this.collection.stDelivery == this.COLLECT_STATUS_SENT) {
        this.rateSelected = this.collection.nuValueLocal;
        this.historicoTasa = true;
      } else {
        this.historicoTasa = false;
        this.unlockTabsFunction(true);
      }
      return Promise.resolve(true);
    }
  }

  unlockTabsFunction(msj: boolean) {
    this.unlockTabs().then((resp) => {
      if (msj) {
        this.mensaje = "No hay tasa para la fecha seleccionada";
        this.alertMessageOpen = true;
      }

      this.onCollectionValid(resp);
    })
  }


  updateRateDocument() {
    // Propagar la tasa seleccionada a documentSales y documentSalesBackup
    if (Array.isArray(this.documentSales) && this.documentSales.length > 0) {
      for (let i = 0; i < this.documentSales.length; i++) {
        this.documentSales[i].nuValueLocal = this.rateSelected;
      }
    }

    if (Array.isArray(this.documentSalesBackup) && this.documentSalesBackup.length > 0) {
      for (let i = 0; i < this.documentSalesBackup.length; i++) {
        this.documentSalesBackup[i].nuValueLocal = this.rateSelected;
      }
    }

    if (Array.isArray(this.documentSalesView) && this.documentSalesView.length > 0) {
      for (let i = 0; i < this.documentSalesView.length; i++) {
        this.documentSalesView[i].nuValueLocal = this.rateSelected;
      }
    }
  }

  async calculatePayment(type: string, index: number, forceRecalc: boolean = false, skipValidateToSend: boolean = false) {

    this.montoTotalPagar = 0;
    let monto = 0;
    let montoConversion = 0;
    let montoTotalDiscounts = 0;
    this.montoTotalPagar = 0;
    this.montoTotalDiscounts = 0;

    /* if (this.collection.stDelivery == this.COLLECT_STATUS_SENT) {
      this.montoTotalPagar = Number(this.collection.nuAmountFinal ?? 0) - Number(this.collection.nuAmountDiscount ?? 0);
      this.montoTotalPagarConversion = Number(this.collection.nuAmountFinalConversion ?? 0) - Number(this.collection.nuAmountDiscountConversion ?? 0);
      this.collection.nuDifference = this.cleanFormattedNumber(this.currencyService.formatNumber(this.collection.nuAmountPaid ?? 0))
        - this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagar));
      this.collection.nuDifferenceConversion = this.convertirMonto(this.collection.nuDifference, 0, this.collection.coCurrency);
      return;
    } */

    if (this.collection.collectionDetails.length == 0) {
      this.montoTotalPagado = 0;
      this.montoTotalPagadoConversion = 0;
      this.onCollectionValidToSend(false);
      this.onCollectionValidToSave(true);
      return;
    }

    if (Array.isArray(this.collection.collectionPayments) && this.collection.collectionPayments.length > 0) {
      this.syncMontosPagadosFromPayments();
    }

    const preserveAmountsWithoutRecalc = !forceRecalc && !this.isChangePaymentPartialPersistence && (
      this.collection.stDelivery == this.COLLECT_STATUS_TO_SEND
      || this.collection.stDelivery == this.COLLECT_STATUS_SENT
      || this.collection.stDelivery == null
      || (this.collection.stDelivery == this.COLLECT_STATUS_SAVED && !this.isRateChangeInProgress)
    );

    const persistedAmountToPay = Number(this.collection.nuAmountPaid) > 0
      ? Number(this.collection.nuAmountPaid)
      : Number(this.collection.nuAmountFinal ?? 0);

    if (preserveAmountsWithoutRecalc && persistedAmountToPay > 0) {
      const hasAmountPaidConversion = this.collection.nuAmountPaidConversion !== null
        && this.collection.nuAmountPaidConversion !== undefined
        && !isNaN(Number(this.collection.nuAmountPaidConversion));

      monto = persistedAmountToPay;
      montoConversion = Number(this.collection.nuAmountPaid) > 0 && hasAmountPaidConversion
        ? Number(this.collection.nuAmountPaidConversion)
        : Number(this.collection.nuAmountFinalConversion ?? 0);
      this.montoTotalPagar = this.cleanFormattedNumber(this.currencyService.formatNumber(persistedAmountToPay));
      this.montoTotalPagarConversion = this.cleanFormattedNumber(this.currencyService.formatNumber(montoConversion));
      this.restoreCollectionIgtfFields();
      this.restorePersistedIgtfDisplayAmounts();
      this.collection.nuDifference = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagado))
        - this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagar));
      this.collection.nuDifferenceConversion = this.convertirMonto(this.collection.nuDifference, 0, this.collection.coCurrency);
      this.resolveAutomatedPrepaid(type, index);
      return Promise.resolve(this.createAutomatedPrepaid);
    } else {
      if (this.collection.stDelivery == this.COLLECT_STATUS_SENT || this.collection.stDelivery == this.COLLECT_STATUS_TO_SEND) {
        monto = Number(this.collection.nuAmountTotal ?? 0);
        montoConversion = Number(this.collection.nuAmountTotalConversion ?? 0);
      } else
        for (var j = 0; j < this.collection.collectionDetails.length; j++) {
          for (var i = 0; i < this.documentSales.length; i++) {
            //for (var j = 0; j < this.collection.collectionDetails.length; j++) {
            if (this.documentSales[i].isSave) {
              let pos = this.documentSales[i].positionCollecDetails;
              if (this.collection.collectionDetails[j].inPaymentPartial === true) {
                monto += this.collection.collectionDetails[pos].nuAmountPaid;
                montoConversion += this.convertirMonto(this.collection.collectionDetails[pos].nuAmountPaid, this.collection.nuValueLocal, this.collection.coCurrency);
              } else if (this.collection.collectionDetails[j].idDocument == this.documentSales[i].idDocument) {
                monto += this.documentSalesBackup[i].nuBalance;
                montoConversion += this.convertirMonto(this.documentSalesBackup[i].nuBalance, this.collection.nuValueLocal, this.collection.coCurrency);
                montoTotalDiscounts += this.getDetailDeductionsForTotals(
                  this.collection.collectionDetails[pos],
                  true
                );
              }
            } else if (this.collection.collectionDetails[j].idDocument == this.documentSales[i].idDocument) {
              monto += this.documentSalesBackup[i].nuBalance;
              let pos = this.documentSales[i].positionCollecDetails;
              montoConversion += this.convertirMonto(this.documentSalesBackup[i].nuBalance, this.collection.nuValueLocal, this.collection.coCurrency);
              montoTotalDiscounts += this.getDetailDeductionsForTotals(
                this.collection.collectionDetails[pos],
                false,
                this.documentSalesBackup[i]
              );
            }
          }
          // No mutar nuAmountPaid por detalle durante recálculos de tasa.
          // El IGTF se calcula y presenta a nivel de totales para evitar acumulaciones.
        }
    }

    if (this.userCanSelectIGTF
      && this.collection.coCurrency == this.hardCurrency.coCurrency) {
      const igtfRate = this.normalizeIgtfPrice(this.igtfSelected?.price);
      this.montoIgtf = this.cleanFormattedNumber(this.currencyService.formatNumber(((monto * igtfRate) / 100)));
      this.montoIgtfConversion = this.convertirMonto(this.montoIgtf, 0, this.collection.coCurrency);

      if (this.separateIgtf) {
        if (this.currencySelected.hardCurrency.toString() === "true")
          this.montoIgtfLocal = (this.montoIgtf * this.collection.nuValueLocal);

        this.montoTotalPagar = this.cleanFormattedNumber(this.currencyService.formatNumber(monto - montoTotalDiscounts));
      }
      else
        this.montoTotalPagar = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoIgtf)) + this.cleanFormattedNumber(this.currencyService.formatNumber(monto));
    } else {
      this.montoTotalPagar = this.cleanFormattedNumber(this.currencyService.formatNumber(monto - montoTotalDiscounts));
      this.montoIgtf = 0;
      this.montoIgtfConversion = 0;
    }


    this.collection.nuAmountPaid = this.montoTotalPagar;
    this.collection.nuAmountPaidConversion = this.convertirMonto(this.montoTotalPagar, 0, this.collection.coCurrency);
    this.collection.nuAmountFinal = this.montoTotalPagar;
    this.collection.nuAmountFinalConversion = this.convertirMonto(this.collection.nuAmountFinal, 0, this.collection.coCurrency);
    this.collection.nuAmountTotal = this.montoTotalPagado;
    this.collection.nuAmountIgtf = this.montoIgtf;
    this.collection.nuAmountIgtfConversion = this.convertirMonto(this.montoIgtf, 0, this.collection.coCurrency);

    if (this.coTypeModule == "2") {
      //es retencion
      this.collection.nuDifference = 0;
    }
    else if (this.separateIgtf) {
      this.montoTotalPagarConversion = this.cleanFormattedNumber(this.currencyService.formatNumber(montoConversion));
      this.collection.nuDifference = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagado)) - this.cleanFormattedNumber(this.currencyService.formatNumber(monto - montoTotalDiscounts));
    } else {
      this.collection.nuDifference = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagado)) - this.cleanFormattedNumber(this.currencyService.formatNumber(monto - montoTotalDiscounts + this.montoIgtf));

      this.montoTotalPagarConversion = this.cleanFormattedNumber(this.currencyService.formatNumber(montoConversion + this.montoIgtfConversion));
    }

    this.collection.nuDifferenceConversion = this.convertirMonto(this.collection.nuDifference, 0, this.collection.coCurrency);
    this.collection.nuAmountTotalConversion = this.convertirMonto(this.collection.nuAmountTotal, 0, this.collection.coCurrency);
    this.syncCollectionIgtfFields();
    this.resolveAutomatedPrepaid(type, index, skipValidateToSend);
    return Promise.resolve(this.createAutomatedPrepaid);
  }

  private getDetailDeductionsForTotals(
    detail: CollectionDetail | undefined,
    isDocumentSaved: boolean,
    documentBackup?: { nuAmountRetention?: number; nuAmountRetention2?: number },
  ): number {
    if (!detail) {
      return 0;
    }
    const collectDiscount = isDocumentSaved ? Number(detail.nuAmountCollectDiscount ?? 0) : 0;
    const retention = isDocumentSaved
      ? Number(detail.nuAmountRetention ?? 0)
      : Number(documentBackup?.nuAmountRetention ?? 0);
    const retention2 = isDocumentSaved
      ? Number(detail.nuAmountRetention2 ?? 0)
      : Number(documentBackup?.nuAmountRetention2 ?? 0);
    return Number(detail.nuAmountDiscount ?? 0) + collectDiscount + retention + retention2;
  }

  private hasValidDocumentSalesForSend(): boolean {
    if (!Array.isArray(this.documentSales) || this.documentSales.length === 0) {
      return false;
    }

    const details = Array.isArray(this.collection?.collectionDetails)
      ? this.collection.collectionDetails
      : [];

    if (details.length === 0) {
      return false;
    }

    return this.documentSales.some((doc, index) =>
      this.isDocumentSaleReadyForSend(doc, index, details)
    );
  }

  private isDocumentSaleReadyForSend(
    doc: DocumentSale | undefined,
    index: number,
    details: CollectionDetail[],
  ): boolean {
    if (!doc?.isSelected) {
      return false;
    }

    const pos = doc.positionCollecDetails;
    if (!Number.isInteger(pos) || pos < 0 || pos >= details.length) {
      return false;
    }

    const detail = details[pos];
    if (!detail?.coDocument && !detail?.idDocument) {
      return false;
    }

    if (doc.isSave === true) {
      return true;
    }

    if (this.isOpen && this.indexDocumentSaleOpen === index) {
      return false;
    }

    return !this.hasUnsavedCollectDiscountOnDetail(detail);
  }

  private hasUnsavedCollectDiscountOnDetail(detail: CollectionDetail): boolean {
    if (Number(detail.nuAmountCollectDiscount ?? 0) <= 0) {
      return false;
    }

    const hasCatalogDiscount = Number(detail.nuCollectDiscount ?? 0) > 0;
    const hasDiscountFlag = detail.hasDiscount === true;
    const hasDetailDiscounts = Array.isArray(detail.collectionDetailDiscounts)
      && detail.collectionDetailDiscounts.length > 0;

    return hasCatalogDiscount || hasDiscountFlag || hasDetailDiscounts;
  }

  private syncMontosPagadosFromPayments(): void {
    this.montoTotalPagado = 0;

    if (this.tipoPagoEfectivo) {
      for (const pago of this.pagoEfectivo) {
        this.montoTotalPagado += Number(pago.monto ?? 0);
      }
    }
    if (this.tipoPagoCheque) {
      for (const pago of this.pagoCheque) {
        this.montoTotalPagado += Number(pago.monto ?? 0);
      }
    }
    if (this.tipoPagoDeposito) {
      for (const pago of this.pagoDeposito) {
        this.montoTotalPagado += Number(pago.monto ?? 0);
      }
    }
    if (this.tipoPagoTransferencia) {
      for (const pago of this.pagoTransferencia) {
        this.montoTotalPagado += Number(pago.monto ?? 0);
      }
    }
    if (this.tipoPagoPagoMovil) {
      for (const pago of this.pagoMovil) {
        this.montoTotalPagado += Number(pago.monto ?? 0);
      }
    }
    if (this.tipoPagoOtros) {
      for (const pago of this.pagoOtros) {
        this.montoTotalPagado += Number(pago.monto ?? 0);
      }
    }

    this.montoTotalPagado = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagado));
  }

  private getAmountToPayForPrepaidCheck(): number {
    const runtimeAmount = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagar));
    if (runtimeAmount > 0) {
      return runtimeAmount;
    }
    return Number(this.collection.nuAmountFinal ?? this.collection.nuAmountPaid ?? 0);
  }

  private getPaymentExcessAmount(): number {
    this.syncMontosPagadosFromPayments();
    const amountPaid = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagado));
    const amountToPay = this.cleanFormattedNumber(this.currencyService.formatNumber(this.getAmountToPayForPrepaidCheck()));
    return amountPaid - amountToPay;
  }

  private isPositiveExcessWithinTolerance(excess: number): boolean {
    if (excess <= 0) {
      return true;
    }
    if (!this.tolerancia0 || this.TipoTolerancia !== 0) {
      return false;
    }
    if (this.collection.coCurrency !== this.MonedaTolerancia) {
      return false;
    }
    return excess < this.RangoToleranciaPositiva;
  }

  private getPrepaidExcessAmount(): number {
    const excess = this.getPaymentExcessAmount();
    if (excess <= 0 || this.isPositiveExcessWithinTolerance(excess)) {
      return 0;
    }
    if (this.prepaidRangeCurrency === this.collection.coCurrency) {
      return excess;
    }
    const conversionExcess = Number(this.collection.nuDifferenceConversion ?? 0);
    return conversionExcess > 0 ? conversionExcess : excess;
  }

  shouldCreateAutomatedPrepaidOnSend(): boolean {
    if (!this.automatedPrepaid || this.coTypeModule !== '0' || this.existPartialPayment) {
      return false;
    }

    const prepaidExcess = this.getPrepaidExcessAmount();
    if (prepaidExcess <= this.prepaidRangeAmount) {
      return false;
    }

    return this.createAutomatedPrepaid
      && Array.isArray(this.anticipoAutomatico)
      && this.anticipoAutomatico.length > 0;
  }

  refreshAutomatedPrepaidBeforeSend(): Promise<boolean> {
    return this.calcularMontos('', 0).then(() => {
      this.resolveAutomatedPrepaid('', 0);
      return this.shouldCreateAutomatedPrepaidOnSend();
    });
  }

  private resolveAutomatedPrepaid(type: string, index: number, skipValidateToSend: boolean = false): void {
    this.createAutomatedPrepaid = false;

    if (this.automatedPrepaid && this.coTypeModule === '0' && !this.existPartialPayment) {
      const prepaidExcess = this.getPrepaidExcessAmount();
      if (prepaidExcess > this.prepaidRangeAmount) {
        this.createAutomatedPrepaid = true;
      }
    }

    this.checkTiposPago();
    if (this.createAutomatedPrepaid) {
      this.setAutomatedPrepaid(type, index);
    }
    if (!skipValidateToSend) {
      this.validateToSend();
    }
  }

  checkTiposPago() {

    if (this.tipoPagoEfectivo && this.pagoEfectivo.length > 0) {
      for (let ef in this.pagoEfectivo) {
        if (this.pagoEfectivo[ef].anticipoPrepaid) {
          this.pagoEfectivo[ef].anticipoPrepaid = false;
          break;
        }
      }
    }

    if (this.tipoPagoCheque && this.pagoCheque.length > 0) {
      for (let ef in this.pagoCheque) {
        if (this.pagoCheque[ef].anticipoPrepaid) {
          this.pagoCheque[ef].anticipoPrepaid = false;
          break;
        }
      }
    }

    if (this.tipoPagoDeposito && this.pagoDeposito.length > 0) {
      for (let ef in this.pagoDeposito) {
        if (this.pagoDeposito[ef].anticipoPrepaid) {
          this.pagoDeposito[ef].anticipoPrepaid = false;
          break;
        }
      }
    }

    if (this.tipoPagoTransferencia && this.pagoTransferencia.length > 0) {
      for (let ef in this.pagoTransferencia) {
        if (this.pagoTransferencia[ef].anticipoPrepaid) {
          this.pagoTransferencia[ef].anticipoPrepaid = false;
          break;
        }
      }
    }

    if (this.tipoPagoPagoMovil && this.pagoMovil.length > 0) {
      for (let pm in this.pagoMovil) {
        if (this.pagoMovil[pm].anticipoPrepaid) {
          this.pagoMovil[pm].anticipoPrepaid = false;
          break;
        }
      }
    }

    if (this.tipoPagoOtros && this.pagoOtros.length > 0) {
      for (let ef in this.pagoOtros) {
        if (this.pagoOtros[ef].anticipoPrepaid) {
          this.pagoOtros[ef].anticipoPrepaid = false;
          break;
        }
      }
    }
  }

  setAutomatedPrepaid(type: string, index: number) {
    if (type == "") {
      this.resetAutomatedPrepaid();
      return;
    }


    if (this.pagoOtros.length === 0 && this.pagoCheque.length === 0 && this.pagoDeposito.length === 0 && this.pagoTransferencia.length === 0 && this.pagoMovil.length === 0 && this.pagoEfectivo.length === 0)
      this.disabledSelectCollectMethodDisabled = false;
    else
      this.disabledSelectCollectMethodDisabled = true;

    switch (type) {
      case "ef": {
        this.anticipoAutomatico = [] as PagoEfectivo[];
        this.anticipoAutomatico.push(this.pagoEfectivo[index]);
        this.pagoEfectivo[index].anticipoPrepaid = true;
        break
      }
      case "ch": {

        this.anticipoAutomatico = [] as PagoCheque[];
        this.anticipoAutomatico.push(this.pagoCheque[index]);
        this.pagoCheque[index].anticipoPrepaid = true;
        break
      }

      case "de": {
        this.anticipoAutomatico = [] as PagoDeposito[];
        this.anticipoAutomatico.push(this.pagoDeposito[index]);
        this.pagoDeposito[index].anticipoPrepaid = true;
        break;
      }

      case "tr": {
        this.anticipoAutomatico = [] as PagoTransferencia[];
        this.anticipoAutomatico.push(this.pagoTransferencia[index]);
        this.pagoTransferencia[index].anticipoPrepaid = true;
        break;
      }

      case "pm": {
        this.anticipoAutomatico = [] as PagoMovil[];
        this.anticipoAutomatico.push(this.pagoMovil[index]);
        this.pagoMovil[index].anticipoPrepaid = true;
        break;
      }

      case "ot": {
        this.anticipoAutomatico = [] as PagoOtros[];
        this.anticipoAutomatico.push(this.pagoOtros[index]);
        this.pagoOtros[index].anticipoPrepaid = true;
        break;
      }
      default: {
        break;
      }
    }
  }
  resetAutomatedPrepaid() {

    // Limpiar todos los flags primero
    const tipos = [
      { arr: this.pagoEfectivo, tipo: 'ef' },
      { arr: this.pagoCheque, tipo: 'ch' },
      { arr: this.pagoDeposito, tipo: 'de' },
      { arr: this.pagoTransferencia, tipo: 'tr' },
      { arr: this.pagoMovil, tipo: 'pm' },
      { arr: this.pagoOtros, tipo: 'ot' },
    ];
    tipos.forEach(({ arr }) => {
      if (arr && arr.length > 0) {
        arr.forEach((p: any) => p.anticipoPrepaid = false);
      }
    });

    const excess = this.getPrepaidExcessAmount();
    if (excess <= this.prepaidRangeAmount) {
      return;
    }

    for (let i = tipos.length - 1; i >= 0; i--) {
      const { arr, tipo } = tipos[i];
      if (arr && arr.length > 0) {
        this.setAutomatedPrepaid(tipo, arr.length - 1);
        return;
      }
    }
  }

  getNuValueLocal() {
    return this.collection.nuValueLocal;
  }

  convertirMonto(monto: number, rate: number, currency: string) {

    if (this.multiCurrency) {
      //let rateReal = this.getNuValueLocal(rate);
      let rateReal = rate;
      if (rate == 0)
        rateReal = this.collection.nuValueLocal;

      if (monto > 0)
        rateReal = this.collection.nuValueLocal;
      /* if (this.currencySelected.coCurrency != currency) { */
      if (this.currencySelected.localCurrency.toString() === "true") {
        if (currency == this.currencyConversion.coCurrency) {
          if (this.historicoTasa)
            return this.cleanFormattedNumber(this.currencyService.formatNumber(monto * rateReal));
          else
            return this.cleanFormattedNumber(this.currencyService.formatNumber(monto * rateReal));
        } else if (this.historicoTasa)
          return this.cleanFormattedNumber(this.currencyService.formatNumber(monto / rateReal));
        else
          return this.cleanFormattedNumber(this.currencyService.formatNumber(monto / rateReal));
      } else {
        if (currency == this.currencyConversion.coCurrency) {
          if (this.historicoTasa)
            return this.cleanFormattedNumber(this.currencyService.formatNumber(monto / rateReal));
          else
            return this.cleanFormattedNumber(this.currencyService.formatNumber(monto / rateReal));
        } else if (this.historicoTasa)
          return this.cleanFormattedNumber(this.currencyService.formatNumber(monto * rateReal));
        else
          return this.cleanFormattedNumber(this.currencyService.formatNumber(monto * rateReal));
      }
    } else {
      return 0
    }

  }

  calcularMontos(type: string, index: number) {
    this.montoTotalPagado = 0;
    if (this.tipoPagoEfectivo) {
      this.totalEfectivo = 0;
      for (let efe = 0; efe < this.pagoEfectivo.length; efe++) {
        this.totalEfectivo += this.pagoEfectivo[efe].monto;
        this.montoTotalPagado += this.pagoEfectivo[efe].monto;
      }
    }
    if (this.tipoPagoCheque) {
      this.totalCheque = 0;
      for (let ch = 0; ch < this.pagoCheque.length; ch++) {
        this.totalCheque += this.pagoCheque[ch].monto;
        this.montoTotalPagado += this.pagoCheque[ch].monto;
      }
    }
    if (this.tipoPagoDeposito) {
      this.totalDeposito = 0;
      for (let dep = 0; dep < this.pagoDeposito.length; dep++) {
        this.totalDeposito += this.pagoDeposito[dep].monto;
        this.montoTotalPagado += this.pagoDeposito[dep].monto;
      }
    }
    if (this.tipoPagoTransferencia) {
      this.totalTransferencia = 0;
      for (let tr = 0; tr < this.pagoTransferencia.length; tr++) {
        this.totalTransferencia += this.pagoTransferencia[tr].monto;
        this.montoTotalPagado += this.pagoTransferencia[tr].monto;
      }
    }
    if (this.tipoPagoPagoMovil) {
      this.totalPagoMovil = 0;
      for (let pm = 0; pm < this.pagoMovil.length; pm++) {
        this.totalPagoMovil += this.pagoMovil[pm].monto;
        this.montoTotalPagado += this.pagoMovil[pm].monto;
      }
    }
    if (this.tipoPagoOtros) {
      this.totalOtros = 0;
      for (let otros = 0; otros < this.pagoOtros.length; otros++) {
        this.totalOtros += this.pagoOtros[otros].monto;
        this.montoTotalPagado += this.pagoOtros[otros].monto;
      }
    }

    this.montoTotalPagado = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagado));

    if (this.collection.coCurrency == this.localCurrency.coCurrency) {
      this.montoTotalPagadoConversion = this.convertirMonto(this.montoTotalPagado, 0, this.collection.coCurrency);
    } else {

      this.montoTotalPagadoConversion = this.convertirMonto(this.montoTotalPagado, 0, this.collection.coCurrency);
    }

    this.calculatePayment(type, index);
    if (this.coTypeModule == "0") {
      if (this.createAutomatedPrepaid) {
        if (!this.recentOpenCollect && !this.isRateChangeInProgress) {
          this.mensaje = this.collectionTags.get('COB_MSG_AUTOMATED_PREPAID')! + " " + this.currencyService.formatNumber(this.collection.nuDifference);
          this.alertMessageOpen = true;
        }
        this.onCollectionValidToSend(true);
      } else if (this.disabledSelectCollectMethodDisabled && this.collection.collectionDetails.length > 0) {
        this.disabledSelectCollectMethodDisabled = false;
      }
      if (this.recentOpenCollect)
        this.recentOpenCollect = false;
    }


    return Promise.resolve(true);
  }

  async validateToSend() {
    this.markCollectionDirty();
    const isAlwaysPartialWithFixedMode = this.alwaysPartialPayment && !this.enablePartialPayment;

    if (!isAlwaysPartialWithFixedMode && (this.alwaysPartialPayment || this.allPaymentPartial)) {
      if (this.collection.collectionPayments?.length > 0 && this.montoTotalPagado != this.montoTotalPagar && this.montoTotalPagado > 0) {
        if (!this.messageSended) {
          this.mensaje = this.collectionTags.get('COB_ERROR_PARTIAL_PAY')!;

          this.messageAlert = new MessageAlert(
            this.collectionTags.get('COB_NOMBRE_MODULO')!,
            this.mensaje,
          );
          this.messageService.alertModal(this.messageAlert);
          this.messageSended = true;
        }
      }
    }

    this.montoTotalPagar = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagar));
    this.montoTotalPagado = this.cleanFormattedNumber(this.currencyService.formatNumber(this.montoTotalPagado));

    this.alertMessageOpen = false;
    if (this.collection.coType == '1') {
      //SI ERES ANTICIPO
      if (this.collection.collectionPayments.length > 0) {
        if (this.collection && Array.isArray(this.collection.collectionPayments) && this.collection.collectionPayments.length > 0) {
          const hasPartialAmount = this.collection.collectionPayments.some(p => {
            const amt = p?.nuAmountPartial;
            return amt !== null && amt !== undefined && !isNaN(Number(amt)) && Number(amt) > 0;
          });

          if (hasPartialAmount) {
            this.onCollectionValidToSend(true);
          } else {
            this.onCollectionValidToSend(false);
            return;
          }
        }
      }

    } else if (this.collection.coType == '2') {
      //SI ERES RETENCION Y ESTAS ACA, LA RETENCION ES VALIDA
      if (this.collection.collectionDetails.length > 0) {
        //DEBO VALIDAR SI LOS DETAILS TIENEN MONTO DE RETENCION O IVA

        let sum = 0;
        for (var i = 0; i < this.collection.collectionDetails.length; i++) {
          sum = this.collection.collectionDetails[i].nuAmountRetention + this.collection.collectionDetails[i].nuAmountRetention2;
        }
        if (sum > 0) {
          this.onCollectionValidToSend(true);
        } else {
          this.onCollectionValidToSend(false);
          return;
        }
      }
    } else {

      if (!(await this.validateReferencePayment())) {
        this.onCollectionValidToSend(false);
        return;
      }

      if (!this.hasValidDocumentSalesForSend()) {
        this.onCollectionValidToSend(false);
        return;
      }

      //DEBO VALIDAR SI HAY ALGUN PAGO PARCIAL, EL MONTO DEBE PAGADO DEBE SER IGUAL AL MONTO A PAGAR
      let onlyPaymentPartial = 0;
      // Seguridad: normalizar array
      const details = Array.isArray(this.collection.collectionDetails) ? this.collection.collectionDetails : [];

      // Helper local para interpretar 'true' (acepta boolean o string)
      const isTrue = (v: any) => v === true || String(v ?? '').toLowerCase() === 'true';

      // Contar cuantos detalles están marcado como pago parcial
      onlyPaymentPartial = details.reduce((count, d) => {
        return count + (isTrue(d?.inPaymentPartial) ? 1 : 0);
      }, 0);

      // Existencia: true si hay al menos uno marcado
      this.existPartialPayment = onlyPaymentPartial > 0;

      this.allPaymentPartial = false;
      if (this.collection.collectionDetails.length > 0)
        if (onlyPaymentPartial == this.collection.collectionDetails.length)
          this.allPaymentPartial = true;

      if (this.enableDifferenceCodes) {
        const payments = Array.isArray(this.collection.collectionPayments) ? this.collection.collectionPayments : [];
        for (let i = 0; i < payments.length; i++) {
          const pago = payments[i];
          const method = (pago.coPaymentMethod ?? pago.coType ?? '').toString().toLowerCase();
          if (method === 'ot') {
            const idDiff = pago.idDifferenceCode;
            const coDiff = (pago.coDifferenceCode ?? '').toString().trim();
            // Requerimos que idDifferenceCode no sea null/undefined y que coDifferenceCode no sea cadena vacía
            if (idDiff == null || coDiff === '') {
              /*  this.mensaje = "Para pagos de tipo 'Otros' debe seleccionar un código de diferencia y su código asociado.";
               this.messageAlert = new MessageAlert(
                 this.collectionTags.get('COB_NOMBRE_MODULO') ?? 'Denario Premium',
                 this.mensaje
               );
               this.messageService.alertModal(this.messageAlert);*/
              this.onCollectionValidToSend(false);
              return;
            }
          }
        }
      }

      if (this.existPartialPayment) {
        if (this.alwaysPartialPayment) {
          this.checkTolerancia();
        } else if (this.allPaymentPartial && this.collection.collectionPayments.length > 0 && this.tabSelected == "pagos") {
          if (this.alwaysPartialPayment) {
            if (this.tolerancia0) {
              this.checkTolerancia();
            } else {
              if (Math.abs(this.montoTotalPagado) == Math.abs(this.montoTotalPagar)) {
                this.onCollectionValidToSend(true);
              } else {
                this.onCollectionValidToSend(false);
                return;
              }
            }
          } else if (this.montoTotalPagado == this.montoTotalPagar) {
            this.onCollectionValidToSend(true);
          } else {
            this.onCollectionValidToSend(false);
            return;
          }
        } else if (this.collection.collectionPayments.length > 0) {
          if (this.tolerancia0) {
            this.checkTolerancia();
          } else {
            if (Math.abs(this.montoTotalPagado) == Math.abs(this.montoTotalPagar)) {
              this.onCollectionValidToSend(true);
            } else {
              this.onCollectionValidToSend(false);
              return;
            }
          }
        }
      } else {
        if (isNaN(this.montoTotalPagado))
          this.montoTotalPagado = 0;
        if (isNaN(this.montoTotalPagar))
          this.montoTotalPagar = 0;

        if (this.collection.collectionPayments.length == 0) {
          this.onCollectionValidToSend(false);
          return;
        } else {

          if (this.tolerancia0) {
            this.checkTolerancia();
          } else {
            if (Math.abs(this.montoTotalPagado) == Math.abs(this.montoTotalPagar)) {
              this.onCollectionValidToSend(true);
            } else {
              this.onCollectionValidToSend(false);
              return;
            }
          }
        }
      }
    }
  }

  checkTolerancia() {
    const isAlwaysPartialWithFixedMode = this.alwaysPartialPayment && !this.enablePartialPayment;

    if (this.alwaysPartialPayment && this.existPartialPayment && !isAlwaysPartialWithFixedMode) {
      if (this.montoTotalPagado != this.montoTotalPagar) {
        this.onCollectionValidToSend(false);
        /* if (!this.messageSended) {
          this.mensaje = this.collectionTags.get('COB_ERROR_PARTIAL_PAY')!;

          this.messageAlert = new MessageAlert(
            this.collectionTags.get('COB_NOMBRE_MODULO')!,
            this.mensaje,
          );
          this.messageService.alertModal(this.messageAlert);
          this.messageSended = true;

        } */
      } else {
        this.onCollectionValidToSend(true);
      }
      return;
    } else if (this.montoTotalPagado <= 0)
      this.onCollectionValidToSend(false);
    else if (this.TipoTolerancia == 0) {
      //TOLERANCIA0 TRUE PERMITO DIFERENCIA SE DEBEN VALIDAR LAS SIGUIENTES VARIABLES TipoTolerancia, RangoTolerancia, MonedaTolerancia
      if (this.collection.coCurrency == this.MonedaTolerancia) {
        //COMO LA MONEDA DEL COBRO Y LA MONEDA DE LA TOLERANCIA SON IGUALES, ENTONCES COMPARO DIRECTAMENTE
        let amount = this.montoTotalPagado - this.montoTotalPagar;
        if (amount > 0) {
          if (amount < this.RangoToleranciaPositiva)
            this.onCollectionValidToSend(true);
          else {
            this.onCollectionValidToSend(false);
            return;
          }
        } else if (amount < 0) {
          if (Math.abs(amount) > this.RangoToleranciaNegativa)
            this.onCollectionValidToSend(false);
          else {
            this.onCollectionValidToSend(true);
          }
        } else {
          this.onCollectionValidToSend(true);
        }


      } else {
        //LA MONEDA DEL COBRO Y DE LA TOLERANCIA SON DISTINTAS, DEBO SABER QUE MONEDA ES PARA REALIZAR LA CONVERSION
        //CORRESPONDIENTE PARA CALCULAR BIEN LA DIFERENCIA
        if (this.MonedaToleranciaIsLocal) {
          if (this.collection.coCurrency == this.MonedaTolerancia) {
            //LA MONEDA ES LOCAL, NO DEBO CONVERTIR
            let amount = this.montoTotalPagado - this.montoTotalPagar;
            if (amount > 0) {
              if (amount < this.RangoToleranciaPositiva)
                this.onCollectionValidToSend(true);
              else {
                this.onCollectionValidToSend(false);
                return;
              }
            } else if (amount < 0) {
              if (Math.abs(amount) > this.RangoToleranciaNegativa)
                this.onCollectionValidToSend(false);
              else {
                this.onCollectionValidToSend(true);
              }
            } else {
              this.onCollectionValidToSend(true);
            }
          } else {
            //LA MONEDA TOLERANCIA ES LOCA, PERO LA MONEDA DEL COBRO ES LA HARD, DEBO CONVERTIR LA TOLERANCIA A HARD
            let amount = this.montoTotalPagado - this.montoTotalPagar;
            if (amount > 0) {
              if (amount < this.convertirMonto(this.RangoToleranciaPositiva, 0, this.collection.coCurrency))
                this.onCollectionValidToSend(true);
              else {
                this.onCollectionValidToSend(false);
                return;
              }
            } else if (amount < 0) {
              if (Math.abs(amount) < this.convertirMonto(this.RangoToleranciaNegativa, 0, this.collection.coCurrency))
                this.onCollectionValidToSend(true);
              else {
                this.onCollectionValidToSend(false);
                return;
              }
            } else {
              this.onCollectionValidToSend(true);
            }
          }
        } else {
          //LA MONEDA TOLERANCIA ES HARD
          if (this.collection.coCurrency == this.MonedaTolerancia) {
            //LA MONEDA ES LOCAL, NO DEBO CONVERTIR
            let amount = this.montoTotalPagado - this.montoTotalPagar;
            if (amount > 0) {
              if (amount < this.RangoToleranciaPositiva)
                this.onCollectionValidToSend(true);
              else {
                this.onCollectionValidToSend(false);
                return;
              }
            } else if (amount < 0) {
              if (Math.abs(amount) > this.RangoToleranciaNegativa)
                this.onCollectionValidToSend(false);
              else {
                this.onCollectionValidToSend(true);
              }
            } else {
              this.onCollectionValidToSend(true);
            }
          } else {
            //LA MONEDA TOLERANCIA ES HARD, PERO LA MONEDA DEL COBRO ES LA HARD, DEBO CONVERTIR LA TOLERANCIA A LOCAL
            let amount = this.montoTotalPagado - this.montoTotalPagar;
            if (amount > 0) {
              if (amount < this.convertirMonto(this.RangoToleranciaPositiva, 0, this.MonedaTolerancia))
                this.onCollectionValidToSend(true);
              else {
                this.onCollectionValidToSend(false);
                return;
              }
            } else if (amount < 0) {
              if ((Math.abs(amount)) > this.convertirMonto(this.RangoToleranciaNegativa, 0, this.MonedaTolerancia))
                this.onCollectionValidToSend(false);
              else {
                this.onCollectionValidToSend(true);
              }
            } else {
              this.onCollectionValidToSend(true);
            }

          }
        }
      }
    } else {
      //EL TIPO DE TOLERANCIA ES POR RANGO, SE DEBE SACAR PORCENTAJE Y CALCULAR SI SE PUEDE ENVIAR O NO
      const delta = Number(((Number(this.montoTotalPagado) || 0) - (Number(this.montoTotalPagar) || 0)).toFixed(this.parteDecimal));
      const base = Math.abs(Number(this.montoTotalPagar) || 0);


      // Si el monto a pagar es 0, exigir igualdad exacta
      if (base === 0) {
        if (Math.abs(delta) === 0) {
          this.onCollectionValidToSend(true);
        } else {
          this.onCollectionValidToSend(false);
          return;
        }
      }

      // RangoToleranciaPositiva y RangoToleranciaNegativa son porcentajes
      const allowedPositive = (base * (Number(this.RangoToleranciaPositiva) || 0)) / 100;
      const allowedNegative = (base * (Number(this.RangoToleranciaNegativa) || 0)) / 100;

      if (delta >= 0) {
        // Sobrepago: comparar contra rango positivo
        if (delta <= allowedPositive) {
          this.onCollectionValidToSend(true);
        } else {
          this.onCollectionValidToSend(false);
          return;
        }
      } else {
        // Falta pago: comparar magnitud contra rango negativo
        if (Math.abs(delta) <= allowedNegative) {
          this.onCollectionValidToSend(true);
        } else {
          this.onCollectionValidToSend(false);
          return;
        }
      }
    }
  }

  async validateReferencePayment() {
    // Si no hay colección o no hay pagos, no está válido para enviar
    if (!this.collection || !this.collection.collectionPayments || this.collection.collectionPayments.length <= 0) {
      this.onCollectionValidToSend(false);
      return false;
    }

    // Validar que todos los pagos tengan monto parcial válido (no null/empty/0/NaN)
    const invalidAmount = this.collection.collectionPayments.some(p => {
      const amt = p.nuAmountPartial;
      return amt == null || isNaN(Number(amt)) || Number(amt) === 0;
    });
    if (invalidAmount) {
      this.onCollectionValidToSend(false);
      return false;
    }

    // Validar referencias en pagos que no son efectivo
    const existePagoSinReferencia = this.collection.collectionPayments.some(pago => {
      // algunos registros usan 'coType' y otros 'coPaymentMethod' para el tipo ('ef' = efectivo)
      const payType = (pago.coType ?? pago.coPaymentMethod ?? '').toString().toLowerCase();

      // Si es efectivo, no requerimos referencia
      if (payType === 'ef') return false;

      // Dependiendo del método, la referencia puede estar en distintos campos.
      // Consideramos válidas cualquiera de estas si no están vacías:
      const refs = [
        pago.nuPaymentDoc,        // número de documento de pago
        pago.nuCollectionPayment, // posible campo de recibo
        pago.nuClientBankAccount,  // posible cuenta/recibo
        pago.nuClientBankAccount   // repetido como alternativa en algunos sitios
      ];

      const hasRef = refs.some(r => r !== undefined && r !== null && String(r).trim() !== '');

      // Si no hay referencia válida -> es un pago sin referencia
      return !hasRef;
    });

    if (existePagoSinReferencia) {
      this.onCollectionValidToSend(false);
      return false;
    } else {
      return true;
    }

  }

  cleanString(str: string): string {
    // Elimina espacios al principio y al final
    str = str.trim();
    // Elimina ;
    str = str.replace(/;/g, '');
    // Elimina comillas simples
    str = str.replace(/'/g, '');
    // Elimina comillas dobles
    str = str.replace(/"/g, '');


    return str;
  }

  public cleanFormattedNumber(str: string): number {
    // Elimina espacios
    str = str.trim();
    // Elimina separador de miles (puntos)
    str = str.replace(/\./g, '');
    // Cambia la coma decimal por punto
    str = str.replace(/,/g, '.');
    // Convierte a número
    return Number(str);
  }

  showHeaderButtonsFunction(headerButtos: boolean) {
    this.showButtons.next(headerButtos);
  }

  onCollectionValidToSave(valid: boolean) {
    console.log('returnLogicService: onReturnValid');
    if (!valid) {
      if (this.createAutomatedPrepaid)
        this.collectValidToSave.next(this.createAutomatedPrepaid);
    } else
      this.collectValidToSave.next(valid);
  }

  onCollectionValidToSend(validToSend: boolean) {
    console.log('returnLogicService: onReturnValidToSend');
    if (!validToSend) {
      if (this.createAutomatedPrepaid)
        this.collectValidToSend.next(this.createAutomatedPrepaid);
    } else
      this.collectValidToSend.next(validToSend);
  }


  onCollectionValid(valid: boolean) {
    console.log('clientStockService: onClientStockValid');
    if (valid) {
      if (this.onChangeClient)
        this.cobroValid = true;

      if (this.collection.stDelivery == this.COLLECT_STATUS_SAVED || this.collection.stDelivery == this.COLLECT_STATUS_SENT)
        this.cobroValid = true;

      this.onCollectionValidToSave(true);
    } else {
      if (this.onChangeClient)
        this.cobroValid = true;
    }
    if (this.collection.stDelivery == this.COLLECT_STATUS_TO_SEND || this.collection.stDelivery == this.COLLECT_STATUS_SENT)
      this.cobroValid = true;

    this.validCollection.next(valid);
  }

  unlockTabs() {
    let banderaMulticurrency = true;
    let banderaHistoricoTasa = true;
    let banderaChangeEnterprise = true;
    let banderaRequiredComment = true;

    /*     if (this.globalConfig.get('multiCurrency') === "false") {
          banderaMulticurrency = false;
        } else
          banderaMulticurrency = true */

    if (this.globalConfig.get('historicoTasa') === "true" && !this.historicoTasa) {
      banderaHistoricoTasa = false;
    }

    if (this.changeEnterprise) {
      banderaChangeEnterprise = false;
    }

    if (this.globalConfig.get("requiredComment") === 'true' ? true : false) {
      if (this.collection.txComment.trim() == "") {
        if (this.collection.stDelivery == this.COLLECT_STATUS_SAVED)
          banderaRequiredComment = true;
        else
          banderaRequiredComment = false;
      } else {
        banderaRequiredComment = true;
      }
    } else {
      banderaRequiredComment = true;

    }

    return Promise.resolve(banderaMulticurrency && banderaHistoricoTasa && banderaChangeEnterprise && banderaRequiredComment);
  }

  initCollection(collection: Collection) {
    this.pagoEfectivo = [] as PagoEfectivo[];
    this.pagoCheque = [] as PagoCheque[];
    this.pagoDeposito = [] as PagoDeposito[];
    this.pagoTransferencia = [] as PagoTransferencia[];
    this.pagoMovil = [] as PagoMovil[];
    this.pagoOtros = [] as PagoOtros[];
    this.lengthMethodPaid = -1;
    this.bankAccountSelected = [] as BankAccount[];
    this.clientBankAccountSelected = [] as BankAccount[];
    this.collectionIsSave = false;
    this.igtfList = [] as IgtfList[];
    this.igtfSelected = {} as IgtfList;
    this.alertMessageOpen = false;
    this.createAutomatedPrepaid = false;


    //this.enterpriseSelected = {} as Enterprise;
    this.listBankAccounts = [] as BankAccount[];
    this.clearDocumentSalesState();
    this.tempSelectedCollectDiscounts = [] as CollectDiscounts[];
    this.prevSelectedCollectDiscounts = [] as CollectDiscounts[];

    this.montoTotalPagar = 0;
    this.montoTotalPagarConversion = 0;
    this.currencySelectedDocument = Array.isArray(this.currencyListDocument) && this.currencyListDocument.length > 0
      ? this.currencyListDocument[0]
      : {} as Currencies;

    if (this.coTypeModule == '0')
      this.disabledSelectCollectMethodDisabled = true;
    else
      this.disabledSelectCollectMethodDisabled = false;

    this.missingRetentionValue = this.alwaysRetention;

    return collection = {
      idUser: Number(localStorage.getItem("idUser")),
      coUser: localStorage.getItem("coUser")!,
      idCollection: null,
      coCollection: "",
      coOriginalCollection: null,
      daCollection: "",
      daRate: "",
      naResponsible: "",
      idCurrency: 0,
      idCurrencyConversion: 0,
      coCurrency: "",
      coCurrencyConversion: "",
      coType: this.coTypeModule,
      txComment: "",
      lbClient: "",
      naClient: "",
      idClient: 0,
      coClient: "",
      idEnterprise: 0,
      coEnterprise: "",
      stCollection: 0,
      stDelivery: 0,
      isEdit: 0,
      isEditTotal: 0,
      isSave: 0,
      nuValueLocal: 0,
      //idConversionType: 0,
      txConversion: "",
      nuAmountTotal: 0,
      nuAmountTotalConversion: 0,
      nuAmountPaid: 0,
      nuAmountPaidConversion: 0,
      nuAmountDiscountTotal: 0,
      nuAmountDiscountTotalConversion: 0,
      nuDifference: 0,
      nuDifferenceConversion: 0,
      nuIgtf: 0,
      nuAmountIgtf: 0,
      nuAmountFinal: 0,
      nuAmountIgtfConversion: 0,
      nuAmountFinalConversion: 0,
      hasIGTF: false,
      document: new DocumentSale,
      coordenada: "",
      //daVoucher: "",
      nuAttachments: 0,
      hasAttachments: false,
      collectionDetails: [] as CollectionDetail[],
      collectionPayments: [] as CollectionPayment[],

    }
  }

  public async convertAmount(
    value: number,
    from: 'local' | 'hard',
    to: 'local' | 'hard',
    coTypeDoc: string,
    nuValueLocalDoc: number
  ): Promise<number> {
    let tasa = 0;
    if (nuValueLocalDoc == 0)
      tasa = this.getNuValueLocal();
    else
      tasa = nuValueLocalDoc;

    if (value > 0)
      tasa = this.collection.nuValueLocal;

    if (from === to) return value;

    if (to === 'local') {
      // Si tu método es síncrono, puedes dejarlo así
      return this.currencyService.toLocalCurrencyByNuValueLocal(value, tasa);
    } else {
      // Espera la llamada asíncrona
      return this.currencyService.toHardCurrencyByNuValueLocal(value, tasa);
    }
  }

  public async toHardCurrencyByNuValueLocal(localAmount: number, nuValueLocal: number
  ): Promise<number> {
    // Si necesitas lógica asíncrona, usa await aquí
    if (nuValueLocal == null)
      return 0;
    else if (localAmount < 0) {
      this.calculateDifference = true;
      return nuValueLocal;
    } else {
      this.calculateDifference = false;
      return (localAmount * 1) / nuValueLocal;
    }
  }

  // Helper para asegurar valores numéricos
  public ensureNumber(obj: any, prop: string) {
    if (obj[prop] == null || obj[prop] == undefined) obj[prop] = 0;
  }

  public toLocal(value: number): number {
    return this.currencyService.toLocalCurrencyByNuValueLocal(value, this.collection.nuValueLocal);
  }

  public toHard(value: number): number {

    return this.currencyService.toHardCurrencyByNuValueLocal(value, this.collection.nuValueLocal);

  }

  public updateBalancesOnPartialPay(index: number) {
    const backup = this.documentSalesBackup[index];

    this.amountPaid = this.cleanFormattedNumber(this.currencyService.formatNumber(backup.nuBalance));
  }

  public isRetentionInvalid(nuAmountRetention: number, nuAmountRetention2: number, nuBalance: number): boolean {
    const suma = nuAmountRetention + nuAmountRetention2;
    return suma > nuBalance || suma < 0 || (nuAmountRetention === 0 && nuAmountRetention2 === 0);
  }

  restoreDocumentSaleState(index: number) {
    // Copia los datos de documentSales[index] a documentSaleOpen y documentSalesBackup[index]
    const original = { ...this.documentSalesBackup[index] };
    this.documentSaleOpen = { ...original };
    this.documentSales[index] = { ...original };
    /*  if (this.collection.stDelivery == DELIVERY_STATUS_SAVED) { */
    let collectioDetail: any;
    let position = 0;

    if (this.documentSaleOpen.positionCollecDetails === undefined || this.documentSaleOpen.positionCollecDetails === null) {
      const idx = Array.isArray(this.collection?.collectionDetails)
        ? this.collection.collectionDetails.findIndex(d => d && d.coDocument === this.documentSaleOpen.coDocument)
        : -1;
      if (idx !== -1) {
        position = idx;
        collectioDetail = this.collection.collectionDetails[idx];
      } else {
        // fallback: keep position 0 if not found
        position = 0;
        collectioDetail = undefined;
      }
    } else {
      position = this.documentSaleOpen.positionCollecDetails;
      collectioDetail = this.collection.collectionDetails[position];
    }

    const positionCollecDetails = position;
    const nuAmountBase = this.collection.collectionDetails[positionCollecDetails].nuBalanceDoc,
      nuAmountDiscount = this.collection.collectionDetails[positionCollecDetails].nuAmountDiscount,
      nuAmountPaid = this.collection.collectionDetails[positionCollecDetails].nuAmountPaid,
      nuAmountRetention = this.collection.collectionDetails[positionCollecDetails].nuAmountRetention,
      nuAmountRetention2 = this.collection.collectionDetails[positionCollecDetails].nuAmountRetention2,
      nuAmountTotal = this.collection.collectionDetails[positionCollecDetails].nuAmountDoc,
      nuBalance = this.collection.collectionDetails[positionCollecDetails].nuBalanceDoc,
      inPaymentPartial = this.collection.collectionDetails[positionCollecDetails].inPaymentPartial,
      isSave = this.collection.collectionDetails[positionCollecDetails].isSave;

    //this.documentSales[index].nuAmountBase = nuAmountBase;
    //this.documentSalesBackup[index].nuAmountBase = nuAmountBase;
    /*  this.documentSales[index].nuAmountDiscount = nuAmountDiscount;
     this.documentSalesBackup[index].nuAmountDiscount = nuAmountDiscount; */
    this.documentSales[index].nuAmountPaid = nuAmountPaid;
    this.documentSalesBackup[index].nuAmountPaid = nuAmountPaid;
    this.documentSales[index].nuAmountRetention = nuAmountRetention;
    this.documentSalesBackup[index].nuAmountRetention = nuAmountRetention;
    this.documentSales[index].nuAmountRetention2 = nuAmountRetention2;
    this.documentSalesBackup[index].nuAmountRetention2 = nuAmountRetention2;
    this.documentSales[index].nuAmountTotal = nuAmountTotal;
    this.documentSalesBackup[index].nuAmountTotal = nuAmountTotal;
    this.documentSales[index].nuBalance = nuBalance;
    this.documentSalesBackup[index].nuBalance = nuBalance;
    this.documentSales[index].inPaymentPartial = inPaymentPartial;
    this.documentSalesBackup[index].inPaymentPartial = inPaymentPartial;
    this.documentSales[index].isSave = isSave;
    this.documentSalesBackup[index].isSave = isSave;

    /*  } */

    this.calculatePayment("", 0);
  }

  public copyDocumentSaleOpenToSalesAndDetails() {
    const open = this.documentSaleOpen;
    const idx = this.indexDocumentSaleOpen;
    const detailIdx = open.positionCollecDetails;

    // Copia a documentSales
    this.documentSales[idx].inPaymentPartial = this.isPaymentPartial;
    this.documentSales[idx].isSave = true;
    this.documentSalesBackup[idx].inPaymentPartial = this.isPaymentPartial;
    this.documentSalesBackup[idx].isSave = true;
    this.documentSales[idx].nuAmountPaid = this.amountPaid;
    this.documentSalesBackup[idx].nuAmountPaid = this.amountPaid;
    //this.documentSales[idx].nuAmountBase = this.amountPaid;
    //this.documentSalesBackup[idx].nuAmountBase = this.amountPaid;
    /* this.documentSales[idx].nuAmountDiscount = open.nuAmountDiscount;
    this.documentSalesBackup[idx].nuAmountDiscount = open.nuAmountDiscount; */

    // Copia a collectionDetails
    const detail = this.collection.collectionDetails[detailIdx];
    if (detail) {
      // Preservar los saldos originales para no mutarlos durante las actualizaciones
      const originalBalance = detail.nuBalanceDocOriginal;
      const originalBalanceConversion = detail.nuBalanceDocOriginalConversion;

      detail.inPaymentPartial = this.isPaymentPartial;
      detail.nuAmountPaid = this.amountPaid
      detail.nuAmountPaidConversion = this.convertirMonto(this.amountPaid, this.collection.nuValueLocal, this.collection.coCurrency);
      // nuBalanceDoc conserva el saldo original del documento; los descuentos de cobro
      // se aplican vía nuAmountCollectDiscount en calculatePayment
      detail.daVoucher = open.daVoucher;
      detail.nuAmountDiscountConversion = this.convertirMonto(detail.nuAmountDiscount, this.collection.nuValueLocal, this.collection.coCurrency);
      detail.nuAmountRetention = open.nuAmountRetention;
      detail.nuAmountRetentionConversion = this.convertirMonto(open.nuAmountRetention, this.collection.nuValueLocal, this.collection.coCurrency);
      detail.nuAmountRetention2 = open.nuAmountRetention2;
      detail.nuAmountRetention2Conversion = this.convertirMonto(open.nuAmountRetention2, this.collection.nuValueLocal, this.collection.coCurrency);
      detail.nuVoucherRetention = open.nuVaucherRetention;
      detail.nuValueLocal = open.nuValueLocal;
      detail.isSave = true;

      // Restablecer explícitamente los montos originales para garantizar que no se alteren
      detail.nuBalanceDocOriginal = originalBalance;
      detail.nuBalanceDocOriginalConversion = originalBalanceConversion;

      // ...otros campos...
    }
  }

  updateRateTiposPago() {
    try {
      const fecha = (this.collection && this.collection.daRate) ? this.collection.daRate + " 00:00:00" : "";

      // Actualizar collection.collectionPayments -> daValue
      if (Array.isArray(this.collection?.collectionPayments)) {
        for (let i = 0; i < this.collection.collectionPayments.length; i++) {
          try {
            this.collection.collectionPayments[i].daValue = fecha;
          } catch (err) {
            // si la estructura no tiene daValue, ignorar
          }
        }
      }

      // Actualizar pagoEfectivo[].fecha
      if (Array.isArray(this.pagoEfectivo)) {
        for (let i = 0; i < this.pagoEfectivo.length; i++) {
          this.pagoEfectivo[i].fecha = fecha;
        }
      }

      // Actualizar pagoCheque[].fecha
      if (Array.isArray(this.pagoCheque)) {
        for (let i = 0; i < this.pagoCheque.length; i++) {
          this.pagoCheque[i].fecha = fecha;
        }
      }

      // Actualizar pagoDeposito[].fecha
      if (Array.isArray(this.pagoDeposito)) {
        for (let i = 0; i < this.pagoDeposito.length; i++) {
          this.pagoDeposito[i].fecha = fecha;
        }
      }

      // Actualizar pagoTransferencia[].fecha
      if (Array.isArray(this.pagoTransferencia)) {
        for (let i = 0; i < this.pagoTransferencia.length; i++) {
          this.pagoTransferencia[i].fecha = fecha;
        }
      }

      // Actualizar pagoMovil[].fecha
      if (Array.isArray(this.pagoMovil)) {
        for (let i = 0; i < this.pagoMovil.length; i++) {
          this.pagoMovil[i].fecha = fecha;
        }
      }

      // pagoOtros no tiene campo 'fecha' en el modelo actual -> no se toca
    } catch (err) {
      console.warn('[CollectionService] updateRateTiposPago error:', err);
    }
  }

  checkRequireApproval(db: SQLiteObject): Promise<boolean> {
    const selectStatement = 'SELECT require_approval as requireApproval FROM transaction_types WHERE id_transaction_type == 3';
    let requireApproval = false
    return db.executeSql(selectStatement, []).then((res) => {
      requireApproval = res.rows.item(0).requireApproval == "true" ? true : false;
      return Promise.resolve(requireApproval);
    }).catch((err) => {
      return Promise.resolve(requireApproval);
    })
  }


  async checkHistoricCollects(db: SQLiteObject): Promise<boolean> {
    this.collectionRefused = [] as TransactionStatuses[];
    this.collectionApproved = [] as TransactionStatuses[];
    this.collectionSended = [] as TransactionStatuses[];
    try {
      const list = Array.isArray(this.listTransactionStatusCollections) ? this.listTransactionStatusCollections : [];
      if (list.length === 0) return Promise.resolve(false);

      // --- DEPURACIÓN: mantener solo el registro más reciente por (idTransaction, coTransaction)
      const dedupMap = new Map<string, TransactionStatuses>();
      for (const ts of list) {
        if (!ts) continue;
        const idTrans = ts.idTransaction ?? (ts as any).id_transaction ?? (ts as any).id;
        const coTrans = (ts.coTransaction ?? (ts as any).co_transaction ?? (ts as any).coCollection ?? (ts as any).co_collection ?? '').toString();
        const key = `${idTrans ?? ''}#${coTrans}`;

        // Normalizar y parsear fecha (si no existe, tratamos como mínima)
        const curDate = ts.daTransactionStatuses ? new Date(ts.daTransactionStatuses) : null;

        const existing = dedupMap.get(key);
        if (!existing) {
          dedupMap.set(key, ts);
        } else {
          const existingDate = existing.daTransactionStatuses ? new Date(existing.daTransactionStatuses) : null;
          if (curDate && (!existingDate || curDate > existingDate)) {
            dedupMap.set(key, ts);
          }
        }
      }

      const dedupedList = Array.from(dedupMap.values());
      if (dedupedList.length === 0) return Promise.resolve(false);
      // --- fin depuración

      // Extraer ids únicos y sanearlos desde la lista depurada
      const ids = Array.from(new Set(dedupedList
        .map(ts => ts?.idStatus ?? (ts as any)?.id_status ?? (ts as any)?.id)
        .filter(id => id !== undefined && id !== null)
        .map(String)
      ));
      if (ids.length === 0) return Promise.resolve(false);

      // Preparar query IN (...) para obtener todos los statuses en una sola llamada
      const placeholders = ids.map(_ => '?').join(',');
      const sql = `SELECT * FROM statuses WHERE id_status IN (${placeholders})`;

      const res = await db.executeSql(sql, ids);
      const statusMap = new Map<string, number>();
      for (let i = 0; i < res.rows.length; i++) {
        const row = res.rows.item(i);
        const key = String(row.id_status);
        statusMap.set(key, Number(row.status_action));
      }

      // Asignar a collectionRefused/Approved/Sended usando la lista depurada
      for (const ts of dedupedList) {
        const idStatus = ts.idStatus ?? (ts as any).id_status ?? (ts as any).id;
        if (idStatus == null) continue;
        switch (statusMap.get(String(idStatus))) {
          case 1:
            //this.collectionApproved.push(ts);
            this.collectionSended.push(ts);//lista para bloquear los documentos
            break;
          case 2:
            this.collectionRefused.push(ts);//lista para liberar los documentos
            break;
          case 3:
            this.collectionSended.push(ts);//lista para bloquear los documentos
            break;
          default:
            // otros casos se ignoran
            break;
        }
      }
    } catch (err) {
      console.error('[checkHistoricCollects] error:', err);
    }
    return Promise.resolve(true);
  }


  async lockDocumentSales(db: SQLiteObject): Promise<string[]> {
    const docsLock: string[] = [];
    const docsUnlock: string[] = [];
    try {
      const list = Array.isArray(this.collectionSended) ? this.collectionSended : [];
      if (list.length === 0) {
        this.coDocumentToUpdate = [];
        return docsLock;
      }

      // extraer coTransaction (acepta varias posibles claves)
      const coTransactions = Array.from(new Set(
        list
          .map(ts => (ts as any)?.coTransaction ?? (ts as any)?.co_transaction ?? (ts as any)?.coCollection ?? (ts as any)?.co_collection)
          .filter(Boolean)
          .map(String)
      ));

      if (coTransactions.length === 0) {
        this.coDocumentToUpdate = [];
        return docsLock;
      }

      // preparar consulta IN (...) para obtener todos los co_document de una sola vez
      const placeholders = coTransactions.map(() => '?').join(',');
      /* const sql = `SELECT DISTINCT co_document FROM collection_details WHERE co_collection IN (${placeholders}) AND in_payment_partial = 'false'`;

      const res = await db.executeSql(sql, coTransactions);
      for (let i = 0; i < res.rows.length; i++) {
        const cd = res.rows.item(i).co_document;
        if (cd != null) docs.push(cd);
      }
 */

      //DOCUMENTOS A BLOQUEAR
      const sqlBloquear = `SELECT DISTINCT(ds.co_document)
FROM document_sales ds
JOIN collection_details cd ON ds.co_document = cd.co_document AND cd.in_payment_partial = 'false'
JOIN collections c ON cd.co_collection = c.co_collection AND c.st_collection IN (1,3)
JOIN transaction_statuses ts ON c.co_collection = ts.co_transaction AND ts.id_transaction_type = 3
WHERE ts.da_transaction_statuses = (
    SELECT MAX(ts2.da_transaction_statuses)
    FROM transaction_statuses ts2
    JOIN collection_details cd2 ON cd2.co_collection = ts2.co_transaction
    WHERE cd2.co_document = ds.co_document
      AND ts2.id_transaction_type = 3
)
AND ts.da_transaction_statuses > ds.da_update;`;

      try {
        const resBloq = await db.executeSql(sqlBloquear, []);
        // SELECT: filas devueltas
        if (resBloq.rows && resBloq.rows.length > 0) {
          for (let i = 0; i < resBloq.rows.length; i++) {
            docsLock.push(resBloq.rows.item(i).co_document);
            // procesar row
          }
        } else {
          // no hay filas (resultado vacío)
        }
      } catch (err) {
        console.error('SQL execution error:', err);
        // manejar error: reintentar, notificar, etc.
      }

      //DOCUMENTOS A DESBLOQUEAR
      this.coDocumentToUpdate = docsLock.slice();
      const sqlDesbloquear = `SELECT DISTINCT(ds.co_document)
FROM document_sales ds
JOIN collection_details cd ON ds.co_document = cd.co_document AND cd.in_payment_partial = 'false'
JOIN collections c ON cd.co_collection = c.co_collection AND c.st_collection IN (1,3)
JOIN transaction_statuses ts ON c.co_collection = ts.co_transaction AND ts.id_transaction_type = 3
WHERE ts.da_transaction_statuses = (
    SELECT MAX(ts2.da_transaction_statuses)
    FROM transaction_statuses ts2
    JOIN collection_details cd2 ON cd2.co_collection = ts2.co_transaction
    WHERE cd2.co_document = ds.co_document
      AND ts2.id_transaction_type = 3
)
AND ds.da_update >= ts.da_transaction_statuses
UNION
SELECT DISTINCT(ds.co_document)
FROM document_sales ds
JOIN collection_details cd ON ds.co_document = cd.co_document AND cd.in_payment_partial = 'true';`;

      try {
        const resDesbloq = await db.executeSql(sqlDesbloquear, []);
        // SELECT: filas devueltas
        if (resDesbloq.rows && resDesbloq.rows.length > 0) {
          for (let i = 0; i < resDesbloq.rows.length; i++) {
            docsUnlock.push(resDesbloq.rows.item(i).co_document);
            // procesar row
          }
        } else {
          // no hay filas (resultado vacío)
        }
      } catch (err) {
        console.error('SQL execution error:', err);
        // manejar error: reintentar, notificar, etc.
      }

      try {
        await this.checkDocumentSales(db, docsLock, 2);
        await this.checkDocumentSales(db, docsUnlock, 0);
      } catch (e) {
        console.error('[findDocumentSalesRefused] checkDocumentSales error:', e);
      }

      return docsLock;
    } catch (err) {
      console.error('[findDocumentSalesRefused] error:', err);
      this.coDocumentToUpdate = [];
      return docsLock;
    }
  }

  async unlockDocumentSales(db: SQLiteObject): Promise<string[]> {
    const docs: string[] = [];
    try {
      // Usar tanto collectionRefused como collectionApproved como fuente
      const combinedList = [
        ...(Array.isArray(this.collectionRefused) ? this.collectionRefused : []),
        ...(Array.isArray(this.collectionApproved) ? this.collectionApproved : [])
      ];

      if (combinedList.length === 0) {
        this.coDocumentToUpdate = [];
        return docs;
      }

      // extraer coTransaction (acepta varias posibles claves)
      const coTransactions = Array.from(new Set(
        combinedList
          .map(ts => (ts as any)?.coTransaction ?? (ts as any)?.co_transaction ?? (ts as any)?.coCollection ?? (ts as any)?.co_collection)
          .filter(Boolean)
          .map(String)
      ));

      if (coTransactions.length === 0) {
        this.coDocumentToUpdate = [];
        return docs;
      }

      // preparar consulta IN (...) para obtener todos los co_document de una sola vez
      const placeholders = coTransactions.map(() => '?').join(',');
      const sql = `SELECT DISTINCT co_document FROM collection_details WHERE co_collection IN (${placeholders})`;

      const res = await db.executeSql(sql, coTransactions);
      for (let i = 0; i < res.rows.length; i++) {
        const cd = res.rows.item(i).co_document;
        if (cd != null) docs.push(cd);
      }

      // Guardar resultado en la propiedad usada por otros flujos
      this.coDocumentToUpdate = docs.slice();

      // llamar a checkDocumentSales para actualizar st_document = 0 (desbloquear)
      try {
        await this.checkDocumentSales(db, docs, 0);
      } catch (e) {
        console.error('[unlockDocumentSales] checkDocumentSales error:', e);
      }

      return docs;
    } catch (err) {
      console.error('[unlockDocumentSales] error:', err);
      this.coDocumentToUpdate = [];
      return docs;
    }
  }

  async checkDocumentSales(dbServ: SQLiteObject, coDocumentSales: string[], action: number): Promise<boolean> {
    //action: 0 el documento vuelvo a salir, 2 documento bloqueado
    try {
      if (!Array.isArray(coDocumentSales) || coDocumentSales.length === 0) {
        return true;
      }

      // sanitizar: eliminar nulos y convertir a strings
      const docs = coDocumentSales.filter(d => d != null).map(String);
      if (docs.length === 0) return true;

      const placeholders = docs.map(() => '?').join(',');
      const sql = `UPDATE document_st SET st_document = ${action} WHERE co_document IN (${placeholders})`;

      await dbServ.executeSql(sql, docs);
      return true;
    } catch (err) {
      console.error('[checkDocumentSales] error updating document_st:', err);
      return false;
    }
  }

  syncPagoOtrosDifferenceCodes() {
    if (!Array.isArray(this.pagoOtros)) return;
    const diffList = this.differenceCode || [];
    for (const pago of this.pagoOtros) {
      const idx = pago?.posCollectionPayment;
      if (idx == null) continue;
      const payment = this.collection.collectionPayments?.[idx];
      if (!payment) continue;
      const found = diffList.find(dc => dc.idDifferenceCode === payment.idDifferenceCode);
      // As pago.differenceCode expects an object with the shape { idDifferenceCode: number | null; coDifferenceCode: string | null; }
      // provide a default object when no matching difference code is found to avoid assigning null.
      pago.differenceCode = found ?? { idDifferenceCode: null, coDifferenceCode: null };
    }
  }

  getColorRowDocumentSale() {
    try {
      if (!Array.isArray(this.documentSales)) return;

      for (let i = 0; i < this.documentSales.length; i++) {
        const doc = this.documentSales[i];
        if (!doc) continue;

        // Si es nota de crédito -> negro
        const docType = String(doc.coDocumentSaleType ?? '').trim().toUpperCase();
        const docNuBalance = doc.nuBalance
        if (docNuBalance <= 0) {
          doc.colorRow = 'black';
        } else {
          // isDueSoon devuelve boolean -> mapeamos a color
          const dueSoon = this.isDueSoon(doc.daDueDate);
          doc.colorRow = dueSoon ? 'Red' : 'Blue';
        }

        // Mantener sincronizado documentSalesView si existe
        if (Array.isArray(this.documentSalesView) && this.documentSalesView[i]) {
          this.documentSalesView[i].colorRow = doc.colorRow;
        }

        // Mantener mapa actualizado (si existe entrada por idDocument)
        if (doc.idDocument != null && this.mapDocumentsSales && this.mapDocumentsSales.has(doc.idDocument)) {
          const mapped = this.mapDocumentsSales.get(doc.idDocument)!;
          mapped.colorRow = doc.colorRow;
          this.mapDocumentsSales.set(doc.idDocument, mapped);
        }
      }
    } catch (err) {
      console.warn('[CollectionService] getColorRowDocumentSale error:', err);
    }
  }

  public isDueSoon(daDueDate: string | Date | undefined | null): boolean {
    const dueDate = this.parseDate(daDueDate);
    if (!dueDate) return false;
    // normalizar horas a medianoche antes de comparar
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < this.dateToday;
  }

  private parseDate(value: string | number | Date | undefined | null): Date | null {
    if (!value && value !== 0) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
      const n = new Date(value);
      return isNaN(n.getTime()) ? null : n;
    }
    const s = String(value).trim();
    if (!s) return null;

    // dd/MM/yyyy[ HH:mm[:ss]]
    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
    if (slash) {
      const day = Number(slash[1]), month = Number(slash[2]) - 1, year = Number(slash[3]);
      const hr = Number(slash[4] ?? 0), min = Number(slash[5] ?? 0), sec = Number(slash[6] ?? 0);
      const d = new Date(year, month, day, hr, min, sec);
      return isNaN(d.getTime()) ? null : d;
    }

    // yyyy-MM-dd[THH:mm[:ss]]
    const dash = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
    if (dash) {
      const year = Number(dash[1]), month = Number(dash[2]) - 1, day = Number(dash[3]);
      const hr = Number(dash[4] ?? 0), min = Number(dash[5] ?? 0), sec = Number(dash[6] ?? 0);
      const d = new Date(year, month, day, hr, min, sec);
      return isNaN(d.getTime()) ? null : d;
    }

    // Fallback a Date constructor / parse
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  public deepFreeze(obj: any) {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(k => this.deepFreeze(obj[k]));
      Object.freeze(obj);
    }
  }

  getStatusOrderName(stCollection: number, stDelivery: number, naStatus: any) {
    if (stCollection != 0) {
      if (naStatus == null || naStatus === undefined) {
        return this.getStatus(stDelivery, naStatus);
      }
      return naStatus;
    } else {
      this.getStatus(stDelivery, naStatus);
    }
  }

  getStatus(status: number, naStatus: any): string {
    switch (status) {
      case 3: return this.collectionTags.get("COB_STATUS_SAVED")!;
      case COLLECT_STATUS_TO_SEND: return this.collectionTags.get("COB_STATUS_TO_SEND")!;
      case 1:
        return naStatus == null ? this.collectionTags.get("COB_STATUS_SENT")! : naStatus;
      case 6:
        // naStatus puede ser string o un objeto => normalizar a string
        if (naStatus == null) return 'Enviado';
        if (typeof naStatus === 'string') {
          return naStatus;
        }
        if (typeof naStatus === 'object') {
          // intenta varias propiedades comunes
          return naStatus.na_status;
        }
        return String(naStatus);

      default: return '';
    }
  }

  /**
 * Devuelve la última tasa conocida (mayor de la lista o la seleccionada)
 */
  get lastRateValue(): number {
    if (this.rateList && this.rateList.length > 0) {
      return Math.max(...this.rateList);
    }
    return this.rateSelected || 0.01;
  }

  ///////////////////QUERYS////////////////

  getAllBanks(dbServ: SQLiteObject, idEnterprise: number) {
    this.listBanks = [] as Bank[];


    var selectStatement = 'SELECT * FROM banks WHERE id_enterprise = ?';
    dbServ.executeSql(selectStatement, [idEnterprise]).then(data => {
      if (this.clientBankAccount) {
        this.listBanks.push({
          idBank: 0,
          coBank: "Nueva Cuenta",
          naBank: "Nueva Cuenta",
          coEnterprise: this.collection.coEnterprise,
          idEnterprise: this.collection.idEnterprise
        });
      }
      for (let i = 0; i < data.rows.length; i++) {
        const item = data.rows.item(i);
        this.listBanks.push({
          idBank: item.id_bank,
          coBank: item.co_bank,
          naBank: item.na_bank,
          coEnterprise: item.co_enterprise,
          idEnterprise: item.id_enterprise,
        });
      }
    })
  }

  clearDocumentSalesState(): void {
    this.documentSales = [] as DocumentSale[];
    this.documentSalesBackup = [] as DocumentSale[];
    this.documentSalesView = [] as DocumentSale[];
    this.mapDocumentsSales.clear();
    this.documentSalesPageIds.clear();
    this.documentSalesTotalRows = 0;
    this.documentSalesCurrentPage = 0;
    this.documentsSaleComponent = false;
  }

  async getDocumentsSales(
    dbServ: SQLiteObject,
    idClient: number,
    coCurrency: string,
    coCollection: string,
    idEnterprise: number,
    pagination?: DocumentSalesPagination
  ): Promise<DocumentSale[] | void> {

    if (this.collection.stDelivery == this.COLLECT_STATUS_TO_SEND) return Promise.resolve();
    this.clearDocumentSalesState();

    if (pagination) {
      this.documentSalesPageSize = pagination.limit;
      this.documentSalesCurrentPage = Math.floor(pagination.offset / pagination.limit);
    }

    const moduleType = this.coTypeModule;
    const currencyIsEmpty = coCurrency === '' || coCurrency === 'Moneda';

    const { query, params, isIgtf } = this.buildDocsQuery({
      moduleType,
      currencyIsEmpty,
      idClient,
      coCurrency,
      idEnterprise,
      coCollection
    });

    try {
      if (pagination) {
        this.documentSalesTotalRows = await this.countDocumentsSales(dbServ, query, params);
      }

      const paginated = this.applyDocumentsSalesPagination(query, params, pagination);
      const data = await dbServ.executeSql(paginated.query, paginated.params);
      this.addDocumentSalesRows(data, isIgtf, true);

      if (pagination?.includeSelected) {
        await this.addSelectedDocumentsSales(dbServ, coCollection, isIgtf);
      }

      if (!pagination) {
        this.documentSalesTotalRows = this.documentSales.length;
      }

      this.documentsSaleComponent = this.documentSales.length > 0;
      this.documentSalesView = JSON.parse(JSON.stringify(this.documentSales));

      if (this.multiCurrency)
        this.convertDocumentSales();

      this.getColorRowDocumentSale();
      this.documentsClientReloaded$.next(idClient);
      return this.documentSales;
    } catch {
      return Promise.resolve(this.documentSales);
    }
  }

  private applyDocumentsSalesPagination(
    query: string,
    params: any[],
    pagination?: DocumentSalesPagination
  ): { query: string; params: any[] } {
    if (!pagination) {
      return { query, params };
    }

    return {
      query: `${query} LIMIT ? OFFSET ?`,
      params: [...params, pagination.limit, pagination.offset]
    };
  }

  private async countDocumentsSales(dbServ: SQLiteObject, query: string, params: any[]): Promise<number> {
    const countQuery = `SELECT COUNT(1) AS total FROM (SELECT DISTINCT id_document FROM (${query}) documents_count)`;
    const data = await dbServ.executeSql(countQuery, params);
    return Number(data.rows.item(0)?.total ?? 0);
  }

  private addDocumentSalesRows(data: any, isIgtf: boolean, markAsPageRow: boolean): void {
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows.item(i);

      if (markAsPageRow) {
        this.documentSalesPageIds.add(row.id_document);
      }

      if (this.mapDocumentsSales.has(row.id_document)) continue;

      const doc = this.mapRowToDocumentSale(row, isIgtf);
      const backup = Object.assign({}, doc);
      const index = this.documentSales.length;

      this.documentSales.push(doc);
      this.documentSalesBackup.push(backup);
      this.mapDocumentsSales.set(row.id_document, doc);

      if (!this.isOpenCollect) {
        this.applyExistingSelection(index, doc, backup);
      } else {
        doc.isSelected = false;
        backup.isSelected = false;
      }
    }
  }

  private async addSelectedDocumentsSales(dbServ: SQLiteObject, coCollection: string, isIgtf: boolean): Promise<void> {
    if (!coCollection) {
      return;
    }

    const query =
      'SELECT DISTINCT d.* FROM document_sales d ' +
      'WHERE d.co_document IN (SELECT co_document FROM collection_details WHERE co_collection = ?)';
    const data = await dbServ.executeSql(query, [coCollection]);
    this.addDocumentSalesRows(data, isIgtf, false);
  }

  private buildDocsQuery(opts: {
    moduleType: string;
    currencyIsEmpty: boolean;
    idClient: number;
    coCurrency: string;
    idEnterprise: number;
    coCollection: string;
  }): { query: string; params: any[]; isIgtf: boolean } {
    const { moduleType, currencyIsEmpty, idClient, coCurrency, idEnterprise, coCollection } = opts;

    const commonOrder = `ORDER BY
      CASE WHEN DATE(d.da_due_date) < DATE('now', 'localtime') THEN 0 ELSE 1 END ASC,
      COALESCE(DATE(d.da_due_date), DATE('0001-01-01')) ASC,
      CASE WHEN d.co_currency = "${this.enterpriseSelected.coCurrencyDefault}" THEN 0 ELSE 1 END,
      d.co_currency`;

    // module 0 and 2 are non-IGTF, but module 2 omits ds.st_document < 2

    const includeDocStateFilter = moduleType === '0' || moduleType === '4';
    const includeDocStateFilterRetenttion = moduleType === '2';

    if (moduleType === '0' || moduleType === '2' || moduleType === '4') {
      if (currencyIsEmpty) {
        return {
          isIgtf: false,
          params: [idClient, idEnterprise, coCollection],
          query:
            'SELECT d.* FROM document_sales d ' +
            'LEFT JOIN document_st ds ON d.co_document = ds.co_document ' +
            'WHERE (d.id_client = ? ' +
            (includeDocStateFilter ? 'AND ds.st_document < 2 ' : '') +
            (includeDocStateFilterRetenttion ? 'AND ds.st_document < 3 ' : '') +
            'AND d.id_enterprise = ? AND d.co_document_sale_type != "IGTF") ' +
            'OR d.co_document IN (SELECT co_document FROM collection_details WHERE co_collection= ? ) ' +
            commonOrder
        };
      }

      return {
        isIgtf: false,
        params: [idClient, coCurrency, idEnterprise, coCollection],
        query:
          'SELECT d.* FROM document_sales d ' +
          'LEFT JOIN document_st ds ON d.co_document = ds.co_document ' +
          'WHERE (d.id_client = ? ' +
          (includeDocStateFilter ? 'AND ds.st_document < 2 ' : '') +
          'AND d.co_currency = ? AND d.id_enterprise = ? AND d.co_document_sale_type != "IGTF") ' +
          'OR d.co_document IN (SELECT co_document FROM collection_details WHERE co_collection= ? ) ' +
          commonOrder
      };
    }

    // module 3 -> IGTF only
    if (currencyIsEmpty) {
      return {
        isIgtf: true,
        params: [idClient, idEnterprise],
        query:
          'SELECT DISTINCT d.* FROM document_sales d ' +
          'LEFT JOIN document_st ds ON d.co_document = ds.co_document ' +
          'WHERE d.id_client = ? AND ds.st_document < 2 AND d.id_enterprise = ? AND d.co_document_sale_type = "IGTF" ' +
          commonOrder
      };
    }

    return {
      isIgtf: true,
      params: [idClient, coCurrency, idEnterprise],
      query:
        'SELECT DISTINCT d.* FROM document_sales d ' +
        'LEFT JOIN document_st ds ON d.co_document = ds.co_document ' +
        'WHERE d.id_client = ? AND ds.st_document < 2 AND d.co_currency = ?  AND d.id_enterprise = ? AND d.co_document_sale_type = "IGTF" ' +
        commonOrder
    };
  }

  private mapRowToDocumentSale(row: any, isIgtf: boolean): DocumentSale {
    const doc = {} as DocumentSale;
    doc.idDocument = row.id_document;
    doc.idClient = row.id_client;
    doc.coClient = row.co_client;
    doc.idDocumentSaleType = row.id_document_sale_type;
    doc.coDocumentSaleType = row.co_document_sale_type;
    doc.daDocument = row.da_document;
    doc.daDueDate = row.da_due_date;
    doc.nuAmountBase = row.nu_amount_base == null ? 0 : row.nu_amount_base;
    doc.nuAmountDiscount = row.nu_amount_discount == null ? 0 : row.nu_amount_discount;
    doc.nuAmountTax = row.nu_amount_tax == null ? 0 : row.nu_amount_tax;
    doc.nuAmountTotal = row.nu_amount_total == null ? 0 : row.nu_amount_total;
    doc.nuAmountPaid = row.nu_amount_paid == null ? 0 : row.nu_amount_paid;
    doc.nuBalance = row.nu_balance == null ? 0 : row.nu_balance;
    doc.coCurrency = row.co_currency;
    doc.idCurrency = row.id_currency;
    doc.nuDocument = row.nu_document;
    doc.txComment = row.tx_comment;
    doc.coDocument = row.co_document;
    doc.coCollection = row.co_collection;
    doc.nuValueLocal = row.nu_value_local;
    doc.stDocumentSale = row.st_document_sale;
    doc.coEnterprise = row.co_enterprise;
    doc.idEnterprise = row.id_enterprise;
    doc.naType = isIgtf ? row.naTypev : row.naType;
    doc.isSelected = false;
    doc.positionCollecDetails = row.positionCollecDetails;
    doc.nuAmountRetention = row.nuAmountRetention == null ? 0 : row.nuAmountRetention;
    doc.nuAmountRetention2 = row.nuAmountRetention2 == null ? 0 : row.nuAmountRetention2;
    doc.daVoucher = row.daVoucher == null ? '' : row.daVoucher;
    doc.nuVaucherRetention = row.nuVaucherRetention == null ? 0 : row.nuVaucherRetention;
    doc.igtfAmount = row.igtfAmount == null ? 0 : row.igtfAmount;
    doc.txConversion = row.txConversion == null ? '' : row.txConversion;
    doc.inPaymentPartial = false;
    doc.historicPaymentPartial = false;
    doc.isSave = false;
    doc.missingRetention = this.missingRetentionValue;
    return doc;
  }

  private applyExistingSelection(index: number, doc: DocumentSale, backup: DocumentSale) {
    for (let cd = 0; cd < this.collection.collectionDetails.length; cd++) {
      const detail = this.collection.collectionDetails[cd];
      if (doc.idDocument !== detail.idDocument) continue;

      this.disabledSelectCollectMethodDisabled = false;
      this.documentSales[index].isSelected = true;
      this.documentSalesBackup[index].isSelected = true;
      this.documentSales[index].isSave = detail.isSave;
      this.documentSalesBackup[index].isSave = detail.isSave;
      this.documentSalesBackup[index].daVoucher = detail.daVoucher!;

      if (this.collection.stDelivery != 3) {
        detail.nuBalanceDoc = this.convertirMonto(doc.nuBalance, this.collection.nuValueLocal, doc.coCurrency);
        detail.nuBalanceDocConversion = doc.nuBalance;
        if (detail.inPaymentPartial !== true) {
          detail.nuAmountPaid = this.convertirMonto(doc.nuBalance, this.collection.nuValueLocal, doc.coCurrency);
          detail.nuAmountPaidConversion = doc.nuBalance;
        }
      }

      this.documentSalesBackup[index].nuBalance = this.convertirMonto(doc.nuBalance, this.collection.nuValueLocal, doc.coCurrency);
      if (detail.inPaymentPartial !== true) {
        this.documentSalesBackup[index].nuAmountPaid = this.convertirMonto(doc.nuBalance, this.collection.nuValueLocal, doc.coCurrency);
      }
      this.documentSalesBackup[index].nuAmountRetention = detail.nuAmountRetention;
      this.documentSalesBackup[index].nuAmountRetention2 = detail.nuAmountRetention2;
      this.documentSalesBackup[index].nuValueLocal = detail.nuValueLocal;
      this.documentSalesBackup[index].nuVaucherRetention = detail.nuVoucherRetention;

      this.documentSales[index].positionCollecDetails = cd;
      this.documentSalesBackup[index].positionCollecDetails = cd;
    }
  }

  /**
   * Convierte los importes de documentSales según la moneda de la colección.
   * - Si la colección está en hardCurrency y el documento en localCurrency: convierte local -> hard.
   * - Si la colección está en localCurrency y el documento en hardCurrency: convierte hard -> local.
   *
   * Convierte los campos: nuAmountBase, nuAmountDiscount, nuAmountTax, nuAmountTotal, nuBalance.
   */
  async convertDocumentSales(): Promise<void> {
    try {
      if (!this.documentSales || this.documentSales.length === 0) return;
      if (!this.collection || !this.collection.coCurrency) return;

      // asegúrate de tener referencias a monedas
      const local = this.localCurrency?.coCurrency ? this.localCurrency : this.currencyService.localCurrency;
      const hard = this.hardCurrency?.coCurrency ? this.hardCurrency : this.currencyService.hardCurrency;
      if (!local || !hard) return;

      const collectionIsHard = this.collection.coCurrency === hard.coCurrency;
      const collectionIsLocal = this.collection.coCurrency === local.coCurrency;

      // nada que convertir si collection no es local ni hard
      if (!collectionIsHard && !collectionIsLocal) return;

      // recorrer documentos
      for (let i = 0; i < this.documentSales.length; i++) {
        const doc = this.documentSales[i];
        if (!doc || !doc.coCurrency) continue;

        // normalizar campos numéricos
        this.ensureNumber(doc, 'nuAmountBase');
        // this.ensureNumber(doc, 'nuAmountDiscount');
        this.ensureNumber(doc, 'nuAmountTax');
        this.ensureNumber(doc, 'nuAmountTotal');
        this.ensureNumber(doc, 'nuBalance');

        //const rateForDoc = (doc.nuValueLocal ?? this.collection.nuValueLocal) ?? 0;
        const rateForDoc = this.collection.nuValueLocal;
        const coTypeDoc = (doc.coDocumentSaleType ?? '').toString();

        // collection hard, doc local -> convertir local -> hard
        if (collectionIsHard && doc.coCurrency === local.coCurrency) {
          doc.nuAmountBase = await this.convertAmount(doc.nuAmountBase, 'local', 'hard', coTypeDoc, rateForDoc);
          //doc.nuAmountDiscount = await this.convertAmount(doc.nuAmountDiscount, 'local', 'hard', coTypeDoc, rateForDoc);
          doc.nuAmountTax = await this.convertAmount(doc.nuAmountTax, 'local', 'hard', coTypeDoc, rateForDoc);
          doc.nuAmountTotal = await this.convertAmount(doc.nuAmountTotal, 'local', 'hard', coTypeDoc, rateForDoc);
          doc.nuBalance = await this.convertAmount(doc.nuBalance, 'local', 'hard', coTypeDoc, rateForDoc);
          // actualizar currency del doc al de la colección (opcional, si se requiere mostrar convertido como moneda de la colección)
          // doc.coCurrency = this.collection.coCurrency;
        }

        // collection local, doc hard -> convertir hard -> local
        if (collectionIsLocal && doc.coCurrency === hard.coCurrency) {
          doc.nuAmountBase = await this.convertAmount(doc.nuAmountBase, 'hard', 'local', coTypeDoc, rateForDoc);
          //doc.nuAmountDiscount = await this.convertAmount(doc.nuAmountDiscount, 'hard', 'local', coTypeDoc, rateForDoc);
          doc.nuAmountTax = await this.convertAmount(doc.nuAmountTax, 'hard', 'local', coTypeDoc, rateForDoc);
          doc.nuAmountTotal = await this.convertAmount(doc.nuAmountTotal, 'hard', 'local', coTypeDoc, rateForDoc);
          doc.nuBalance = await this.convertAmount(doc.nuBalance, 'hard', 'local', coTypeDoc, rateForDoc);
          // doc.coCurrency = this.collection.coCurrency;
        }

        // Mantener backup sincronizado (busca por idDocument)
        if (this.documentSalesBackup && this.documentSalesBackup.length > 0) {
          const idxBackup = this.documentSalesBackup.findIndex(b => b.idDocument === doc.idDocument);
          if (idxBackup >= 0) {
            // copia profunda de los campos actualizados
            this.documentSalesBackup[idxBackup] = Object.assign({}, this.documentSalesBackup[idxBackup], {
              nuAmountBase: doc.nuAmountBase,
              //nuAmountDiscount: doc.nuAmountDiscount,
              nuAmountTax: doc.nuAmountTax,
              nuAmountTotal: doc.nuAmountTotal,
              nuBalance: doc.nuBalance,
              nuValueLocal: doc.nuValueLocal
            });
          }
        }

        // Actualizar mapDocumentsSales si existe entry
        if (doc.idDocument != null && this.mapDocumentsSales.has(doc.idDocument)) {
          this.mapDocumentsSales.set(doc.idDocument, doc);
        }
      }

      this.documentSalesBackup = JSON.parse(JSON.stringify(this.documentSales));
    } catch (err) {
      console.error('convertDocumentSales error:', err);
    }
  }

  async convertDocumentSaleIndex(index: number) {
    try {
      if (!this.documentSales || this.documentSales.length === 0) return;
      if (!this.collection || !this.collection.coCurrency) return;

      // asegúrate de tener referencias a monedas
      const local = this.localCurrency?.coCurrency ? this.localCurrency : this.currencyService.localCurrency;
      const hard = this.hardCurrency?.coCurrency ? this.hardCurrency : this.currencyService.hardCurrency;
      if (!local || !hard) return;

      const collectionIsHard = this.collection.coCurrency === hard.coCurrency;
      const collectionIsLocal = this.collection.coCurrency === local.coCurrency;

      // nada que convertir si collection no es local ni hard
      if (!collectionIsHard && !collectionIsLocal) return;

      // recorrer documentos
      const doc = this.documentSales[index];

      // normalizar campos numéricos
      this.ensureNumber(doc, 'nuAmountBase');
      //this.ensureNumber(doc, 'nuAmountDiscount');
      this.ensureNumber(doc, 'nuAmountTax');
      this.ensureNumber(doc, 'nuAmountTotal');
      this.ensureNumber(doc, 'nuBalance');

      const rateForDoc = (doc.nuValueLocal ?? this.collection.nuValueLocal) ?? 0;
      const coTypeDoc = (doc.coDocumentSaleType ?? '').toString();

      // collection hard, doc local -> convertir local -> hard
      if (collectionIsHard && doc.coCurrency === local.coCurrency) {
        doc.nuAmountBase = await this.convertAmount(doc.nuAmountBase, 'local', 'hard', coTypeDoc, rateForDoc);
        //doc.nuAmountDiscount = await this.convertAmount(doc.nuAmountDiscount, 'local', 'hard', coTypeDoc, rateForDoc);
        doc.nuAmountTax = await this.convertAmount(doc.nuAmountTax, 'local', 'hard', coTypeDoc, rateForDoc);
        doc.nuAmountTotal = await this.convertAmount(doc.nuAmountTotal, 'local', 'hard', coTypeDoc, rateForDoc);
        doc.nuBalance = await this.convertAmount(doc.nuBalance, 'local', 'hard', coTypeDoc, rateForDoc);
        // actualizar currency del doc al de la colección (opcional, si se requiere mostrar convertido como moneda de la colección)
        // doc.coCurrency = this.collection.coCurrency;
      }

      // collection local, doc hard -> convertir hard -> local
      if (collectionIsLocal && doc.coCurrency === hard.coCurrency) {
        doc.nuAmountBase = await this.convertAmount(doc.nuAmountBase, 'hard', 'local', coTypeDoc, rateForDoc);
        //doc.nuAmountDiscount = await this.convertAmount(doc.nuAmountDiscount, 'hard', 'local', coTypeDoc, rateForDoc);
        doc.nuAmountTax = await this.convertAmount(doc.nuAmountTax, 'hard', 'local', coTypeDoc, rateForDoc);
        doc.nuAmountTotal = await this.convertAmount(doc.nuAmountTotal, 'hard', 'local', coTypeDoc, rateForDoc);
        doc.nuBalance = await this.convertAmount(doc.nuBalance, 'hard', 'local', coTypeDoc, rateForDoc);
        // doc.coCurrency = this.collection.coCurrency;
      }

      // Mantener backup sincronizado (busca por idDocument)
      if (this.documentSalesBackup && this.documentSalesBackup.length > 0) {
        const idxBackup = this.documentSalesBackup.findIndex(b => b.idDocument === doc.idDocument);
        if (idxBackup >= 0) {
          // copia profunda de los campos actualizados
          this.documentSalesBackup[idxBackup] = Object.assign({}, this.documentSalesBackup[idxBackup], {
            nuAmountBase: doc.nuAmountBase,
            //nuAmountDiscount: doc.nuAmountDiscount,
            nuAmountTax: doc.nuAmountTax,
            nuAmountTotal: doc.nuAmountTotal,
            nuBalance: doc.nuBalance,
            nuValueLocal: doc.nuValueLocal
          });
        }
      }

      // Actualizar mapDocumentsSales si existe entry
      if (doc.idDocument != null && this.mapDocumentsSales.has(doc.idDocument)) {
        this.mapDocumentsSales.set(doc.idDocument, doc);
      }
      this.documentSalesBackup[index] = JSON.parse(JSON.stringify(this.documentSales[index]));
    } catch (err) {
      console.error('convertDocumentSales error:', err);
    }
  }

  findIsPaymentPartial(dbServ: SQLiteObject, idClient: number) {
    const coDocuments = Array.from(this.mapDocumentsSales.values()).map(obj => obj.coDocument);
    if (coDocuments.length === 0) return Promise.resolve();

    const selectStatement = `
    SELECT code.co_document, code.in_payment_partial
    FROM collection_details code
    JOIN collection_payments copa ON code.co_collection = copa.co_collection
    JOIN collections co ON co.id_client = ?
    WHERE code.in_payment_partial == 'true' AND code.co_document IN ('${coDocuments.join("', '")}')
  `;

    return dbServ.executeSql(selectStatement, [idClient]).then(data => {
      // Crea un Map para acceso rápido por id_document (usar idDocument como clave numérica)
      const docSalesMap = new Map<string, DocumentSale>();
      this.documentSales.forEach(ds => {
        if (ds && typeof ds.coDocument === 'string') docSalesMap.set(ds.coDocument, ds);
      });
      const docSalesBackupMap = new Map<string, DocumentSale>();
      this.documentSalesBackup.forEach(ds => {
        if (ds && typeof ds.coDocument === 'string') docSalesBackupMap.set(ds.coDocument, ds);
      });
      const docSalesViewMap = new Map<string, DocumentSale>();
      this.documentSalesView.forEach(ds => {
        if (ds && typeof ds.coDocument === 'string') docSalesViewMap.set(ds.coDocument, ds);
      });

      this.totalHistoricPartialPayment = data.rows.length;
      for (let i = 0; i < data.rows.length; i++) {
        const coDoc = data.rows.item(i).co_document;
        const isPartial = data.rows.item(i).in_payment_partial === 'true';

        // Actualiza los mapas indexados por coDocument
        const ds = docSalesMap.get(coDoc);
        if (ds) {
          ds.historicPaymentPartial = isPartial;
        }
        const dsView = docSalesViewMap.get(coDoc);
        if (dsView) {
          dsView.historicPaymentPartial = isPartial;
        }
        const dsBackup = docSalesBackupMap.get(coDoc);
        if (dsBackup) {
          dsBackup.historicPaymentPartial = isPartial;
        }

        // Sincronizar mapDocumentsSales (que está indexado por idDocument:number)
        // buscando el idDocument desde el entry por coDocument
        const source = ds ?? dsBackup ?? dsView;
        if (source && source.idDocument != null) {
          const id = source.idDocument;
          if (this.mapDocumentsSales.has(id)) {
            const mapped = this.mapDocumentsSales.get(id)!;
            mapped.historicPaymentPartial = isPartial;
            this.mapDocumentsSales.set(id, mapped);
          }
        } else {
          // fallback: buscar por valor si no encontramos source
          for (const [id, val] of this.mapDocumentsSales.entries()) {
            if (val && val.coDocument === coDoc) {
              val.historicPaymentPartial = isPartial;
              this.mapDocumentsSales.set(id, val);
              break;
            }
          }
        }
      }
    }).catch(e => {
      console.error('Error en findIsPaymentPartial:', e);
      return Promise.resolve();
    });
  }

  findIsMissingRetention(dbServ: SQLiteObject, idClient: number) {
    const coDocuments = Array.from(this.mapDocumentsSales.values()).map(obj => obj.coDocument);
    if (coDocuments.length === 0) return Promise.resolve();

    const selectStatement = `
    SELECT code.co_document, code.missing_retention
    FROM collection_details code
    JOIN collections co ON co.id_client = ?
    WHERE code.missing_retention == 'true' AND code.co_document IN ('${coDocuments.join("', '")}')
  `;

    return dbServ.executeSql(selectStatement, [idClient]).then(data => {
      // Crea un Map para acceso rápido por id_document (usar idDocument como clave numérica)
      const docSalesMap = new Map<string, DocumentSale>();
      this.documentSales.forEach(ds => {
        if (ds && typeof ds.coDocument === 'string') docSalesMap.set(ds.coDocument, ds);
      });
      const docSalesBackupMap = new Map<string, DocumentSale>();
      this.documentSalesBackup.forEach(ds => {
        if (ds && typeof ds.coDocument === 'string') docSalesBackupMap.set(ds.coDocument, ds);
      });
      const docSalesViewMap = new Map<string, DocumentSale>();
      this.documentSalesView.forEach(ds => {
        if (ds && typeof ds.coDocument === 'string') docSalesViewMap.set(ds.coDocument, ds);
      });

      for (let i = 0; i < data.rows.length; i++) {
        const coDoc = data.rows.item(i).co_document;
        const missingRetention = data.rows.item(i).missing_retention === 'true';

        // Actualiza los mapas indexados por coDocument
        const ds = docSalesMap.get(coDoc);
        if (ds) {
          ds.missingRetention = missingRetention;
        }
        const dsView = docSalesViewMap.get(coDoc);
        if (dsView) {
          dsView.missingRetention = missingRetention;
        }
        const dsBackup = docSalesBackupMap.get(coDoc);
        if (dsBackup) {
          dsBackup.missingRetention = missingRetention;
        }

        // Sincronizar mapDocumentsSales (que está indexado por idDocument:number)
        // buscando el idDocument desde el entry por coDocument
        const source = ds ?? dsBackup ?? dsView;
        if (source && source.idDocument != null) {
          const id = source.idDocument;
          if (this.mapDocumentsSales.has(id)) {
            const mapped = this.mapDocumentsSales.get(id)!;
            mapped.missingRetention = missingRetention;
            this.mapDocumentsSales.set(id, mapped);
          }
        } else {
          // fallback: buscar por valor si no encontramos source
          for (const [id, val] of this.mapDocumentsSales.entries()) {
            if (val && val.coDocument === coDoc) {
              val.missingRetention = missingRetention;
              this.mapDocumentsSales.set(id, val);
              break;
            }
          }
        }
      }
    }).catch(e => {
      console.error('Error en findIsPaymentPartial:', e);
      return Promise.resolve();
    });
  }


  getPaymentPartialByDocument(dbServ: SQLiteObject, coDocument: string) {

    let selectStatement = "SELECT " +
      "co.co_currency, " +
      "co.da_collection, " +
      "co.id_collection, " +
      "co.st_collection, " +
      "co.st_delivery, " +
      "code.co_document, " +
      "code.nu_balance_doc, " +
      "SUM(copa.nu_amount_partial) AS nu_amount_paid, " +
      "GROUP_CONCAT(" +
      "copa.co_payment_method || ': ' || " +
      "CASE WHEN copa.nu_payment_doc IS NULL OR copa.nu_payment_doc = '' THEN 'No Ref' ELSE copa.nu_payment_doc END, " +
      "'\n'" +
      ") AS payment_refs, " +
      "GROUP_CONCAT(" +
      "copa.nu_amount_partial, " +
      "'\n'" +
      ") AS payment_details " +
      "FROM collections co " +
      "JOIN collection_details code  ON co.co_collection = code.co_collection " +
      "JOIN collection_payments copa ON co.co_collection = copa.co_collection " +
      "WHERE code.co_document = ? AND code.in_payment_partial = 'true' " +
      "GROUP BY co.co_currency, co.da_collection, co.id_collection, co.st_delivery, code.co_document, code.nu_balance_doc";

    return dbServ.executeSql(selectStatement, [coDocument]).then(data => {
      //return dbServ.executeSql(selectStatement, [this.mapDocumentsSales.get(idDocument)!.coDocument]).then(data => {
      if (data.rows.length > 0) {
        this.coDocumentPaymentPartial = data.rows.item(0).co_document;
        this.paymentPartials = [] as PaymentPartials[];
        var status = ["No Status", "Guardado", "Por Enviar", "Enviado"]
        for (var i = 0; i < data.rows.length; i++) {
          let item = this.itemListaCobros.find(item => item.id_collection == data.rows.item(i).id_collection);
          this.paymentPartials.push({
            idCollection: data.rows.item(i).id_collection,
            daCollection: data.rows.item(i).da_collection,
            coCurrency: data.rows.item(i).co_currency,
            nuAmountPaid: data.rows.item(i).nu_amount_paid,
            nuBalanceDoc: data.rows.item(i).nu_balance_doc,
            coPaymentMethod: '',
            paymentRefs: data.rows.item(i).payment_refs,
            paymentDetails: data.rows.item(i).payment_details,
            stCollection: data.rows.item(i).st_collection,
            stDelivery: data.rows.item(i).st_delivery,
            nuPaymentDoc: '',
            naStatus: item?.na_status!
          })
        }
      }
    })
  }

  getIgtfList(dbServ: SQLiteObject) {

    this.igtfList = [] as IgtfList[];

    return dbServ.executeSql('SELECT ' +
      'id_igtf as idIgtf, ' +
      'na_igtf as naIgtf, ' +
      'price as price, ' +
      'descripcion as descripcion, ' +
      'default_igtf as defaultIgtf ' +
      'FROM igtf_lists;', []).then(data => {
        for (let i = 0; i < data.rows.length; i++) {
          this.igtfList.push(data.rows.item(i));
        }

        this.restoreCollectionIgtfFields();
        return Promise.resolve(this.igtfList)
      })
  }

  private normalizeIgtfPrice(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private findIgtfListItemByPrice(savedPrice: number): IgtfList | undefined {
    if (savedPrice <= 0 || !Array.isArray(this.igtfList)) {
      return undefined;
    }

    const epsilon = 0.0001;
    return this.igtfList.find(item => {
      const itemPrice = this.normalizeIgtfPrice(item?.price);
      return Math.abs(itemPrice - savedPrice) < epsilon;
    });
  }

  private restorePersistedIgtfDisplayAmounts(): void {
    if (!this.userCanSelectIGTF || this.collection.coCurrency !== this.hardCurrency?.coCurrency) {
      this.montoIgtf = 0;
      this.montoIgtfConversion = 0;
      return;
    }

    const savedIgtfAmount = this.normalizeIgtfPrice(this.collection?.nuAmountIgtf);
    if (savedIgtfAmount <= 0) {
      this.montoIgtf = 0;
      this.montoIgtfConversion = 0;
      return;
    }

    this.montoIgtf = this.cleanFormattedNumber(this.currencyService.formatNumber(savedIgtfAmount));
    const savedIgtfConversion = this.normalizeIgtfPrice(this.collection?.nuAmountIgtfConversion);
    this.montoIgtfConversion = savedIgtfConversion > 0
      ? this.cleanFormattedNumber(this.currencyService.formatNumber(savedIgtfConversion))
      : this.convertirMonto(this.montoIgtf, 0, this.collection.coCurrency);
  }

  private toBooleanFlag(value: unknown): boolean {
    return value === true || value === 1 || String(value ?? '').toLowerCase() === 'true' || String(value ?? '') === '1';
  }

  syncCollectionIgtfFields(): void {
    if (!this.userCanSelectIGTF) {
      return;
    }
    this.collection.nuIgtf = this.normalizeIgtfPrice(this.igtfSelected?.price);
    this.collection.hasIGTF = this.separateIgtf;
  }

  compareIgtfOptions(first: IgtfList | null | undefined, second: IgtfList | null | undefined): boolean {
    if (!first || !second) {
      return first === second;
    }

    const firstId = Number(first.idIgtf ?? 0);
    const secondId = Number(second.idIgtf ?? 0);
    if (firstId > 0 && secondId > 0) {
      return firstId === secondId;
    }

    return Math.abs(this.normalizeIgtfPrice(first.price) - this.normalizeIgtfPrice(second.price)) < 0.0001;
  }

  mergePersistedCollectionIgtfFields(source: Collection): void {
    if (!source?.coCollection || !this.collection) {
      return;
    }

    this.collection.nuIgtf = this.normalizeIgtfPrice(source.nuIgtf);
    this.collection.hasIGTF = source.hasIGTF;
    this.collection.nuAmountIgtf = this.normalizeIgtfPrice(source.nuAmountIgtf);
    this.collection.nuAmountIgtfConversion = this.normalizeIgtfPrice(source.nuAmountIgtfConversion);

    const listIndex = this.listCollect.findIndex(item => item.coCollection === source.coCollection);
    if (listIndex >= 0) {
      this.listCollect[listIndex].nuIgtf = this.collection.nuIgtf;
      this.listCollect[listIndex].hasIGTF = this.collection.hasIGTF;
      this.listCollect[listIndex].nuAmountIgtf = this.collection.nuAmountIgtf;
      this.listCollect[listIndex].nuAmountIgtfConversion = this.collection.nuAmountIgtfConversion;
    }
  }

  updateListCollectIgtfFromCollection(collection: Collection): void {
    if (!collection?.coCollection) {
      return;
    }

    const listIndex = this.listCollect.findIndex(item => item.coCollection === collection.coCollection);
    if (listIndex < 0) {
      return;
    }

    this.listCollect[listIndex].nuIgtf = this.normalizeIgtfPrice(collection.nuIgtf);
    this.listCollect[listIndex].hasIGTF = collection.hasIGTF;
    this.listCollect[listIndex].nuAmountIgtf = this.normalizeIgtfPrice(collection.nuAmountIgtf);
    this.listCollect[listIndex].nuAmountIgtfConversion = this.normalizeIgtfPrice(collection.nuAmountIgtfConversion);
  }

  private isPersistedCollection(): boolean {
    const stDelivery = Number(this.collection?.stDelivery ?? 0);
    const stCollection = Number(this.collection?.stCollection ?? 0);
    const isSave = Number(this.collection?.isSave ?? 0);

    if (stDelivery === this.COLLECT_STATUS_NEW
      && stCollection === this.COLLECT_STATUS_NEW
      && isSave === 0) {
      return false;
    }

    return stDelivery === this.COLLECT_STATUS_SAVED
      || stDelivery === this.COLLECT_STATUS_TO_SEND
      || stDelivery === this.COLLECT_STATUS_SENT
      || isSave === 1;
  }

  private applyDefaultIgtfSelection(): void {
    const defaultIgtf = this.igtfList.find(item => item.defaultIgtf === 'true');
    if (!defaultIgtf) {
      return;
    }

    this.igtfSelected = defaultIgtf;
    this.syncCollectionIgtfFields();
  }

  private resolveSavedIgtfPrice(): number {
    let savedPrice = this.normalizeIgtfPrice(this.collection?.nuIgtf);
    if (savedPrice > 0) {
      return savedPrice;
    }

    if (!this.isPersistedCollection()) {
      return 0;
    }

    return this.inferSavedIgtfRateFromAmounts();
  }

  private inferSavedIgtfRateFromAmounts(): number {
    const igtfAmount = this.normalizeIgtfPrice(this.collection?.nuAmountIgtf);
    if (igtfAmount <= 0 || !Array.isArray(this.igtfList) || this.igtfList.length === 0) {
      return 0;
    }

    let baseAmount = this.normalizeIgtfPrice(this.collection?.nuAmountPaid);
    if (baseAmount <= 0) {
      baseAmount = this.normalizeIgtfPrice(this.collection?.nuAmountFinal);
    }

    if (!this.separateIgtf && igtfAmount > 0 && baseAmount > igtfAmount) {
      baseAmount -= igtfAmount;
    }

    if (baseAmount <= 0) {
      return 0;
    }

    const inferredRate = (igtfAmount * 100) / baseAmount;
    const matchedIgtf = this.findIgtfListItemByPrice(inferredRate);
    if (matchedIgtf) {
      return this.normalizeIgtfPrice(matchedIgtf.price);
    }

    let closestIgtf: IgtfList | undefined;
    let closestDiff = Number.POSITIVE_INFINITY;
    for (const item of this.igtfList) {
      const diff = Math.abs(this.normalizeIgtfPrice(item.price) - inferredRate);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIgtf = item;
      }
    }

    if (closestIgtf && closestDiff <= 0.05) {
      return this.normalizeIgtfPrice(closestIgtf.price);
    }

    return 0;
  }

  private applyIgtfSelectionByPrice(savedPrice: number): boolean {
    if (savedPrice <= 0) {
      return false;
    }

    const matchedIgtf = this.findIgtfListItemByPrice(savedPrice);
    if (!matchedIgtf) {
      return false;
    }

    this.igtfSelected = matchedIgtf;
    this.collection.nuIgtf = this.normalizeIgtfPrice(matchedIgtf.price);
    return true;
  }

  restoreCollectionIgtfFields(): void {
    if (!this.userCanSelectIGTF || !Array.isArray(this.igtfList) || this.igtfList.length === 0) {
      return;
    }

    this.separateIgtf = this.toBooleanFlag(this.collection?.hasIGTF);
    this.collection.hasIGTF = this.separateIgtf;

    if (!this.isPersistedCollection()) {
      this.applyDefaultIgtfSelection();
      return;
    }

    const savedPrice = this.resolveSavedIgtfPrice();
    if (savedPrice > 0 && this.applyIgtfSelectionByPrice(savedPrice)) {
      return;
    }
  }


  getCurrenciesEnterprise(dbServ: SQLiteObject, idEnterprise: number) {

    return dbServ.executeSql('SELECT ' +
      'id_currency_enterprise as idCurrencyEnterprise, ' +
      'id_currency as idCurrency, ' +
      'co_currency as coCurrency, ' +
      'local_currency as localCurrency, ' +
      'hard_currency as hardCurrency, ' +
      'co_enterprise as coEnterprise, ' +
      'id_enterprise as idEnterprise ' +
      'FROM currency_enterprises WHERE id_enterprise = ?', [idEnterprise]).then(data => {
        let currencies: Currencies[] = [];
        for (let i = 0; i < data.rows.length; i++) {
          const item = data.rows.item(i);
          item.localCurrency === "true" ? true : false;
          item.hardCurrency === "true" ? true : false;
          currencies.push(item);
        }
        return currencies;
      })
  }

  getTasasHistoricoFunction(dbServ: SQLiteObject, idEnterprise: number) {

    return dbServ.executeSql('SELECT ' +
      'co_conversion_type as coConversionType, ' +
      'co_currency_hard as coCurrencyHard, ' +
      'co_currency_local as coCurrencyLocal, ' +
      'co_enterprise as coEnterprise, ' +
      'date_conversion as dateConversion, ' +
      'id_conversion_type as idConversionType, ' +
      'id_enterprise as idEnterprise, ' +
      'nu_value_local as nuValueLocal ' +
      'FROM conversion_types WHERE id_enterprise = ? ORDER BY date_conversion DESC;',
      [idEnterprise]).then(data => {
        let conversionTypes: ConversionType[] = [];
        for (let i = 0; i < data.rows.length; i++) {
          const item = data.rows.item(i);
          conversionTypes.push(item);
        }
        return this.conversionTypes = conversionTypes
      })
  }

  getDocumentById(dbServ: SQLiteObject, idEnterprise: number, idDocument: number, index: number, posicion: number) {

    return dbServ.executeSql('SELECT ' +
      'co_client as coClient,co_collection as coCollection, co_currency as coCurrency, co_document as coDocument,' +
      'co_document_sale_type as coDocumentSaleType, co_enterprise as coEnterprise, da_document as daDocument,' +
      'da_due_date as daDueDate,id_client as idClient,id_currency as idCurrency, id_document as idDocument,' +
      'id_document_sale_type as idDocumentSaleType, id_enterprise as idEnterprise,nu_amount_base as nuAmountBase,' +
      'nu_amount_discount as nuAmountDiscount, nu_amount_tax as nuAmountTax,nu_amount_total as nuAmountTotal,' +
      'nu_balance as nuBalance,nu_document as nuDocument, nu_value_local as nuValueLocal, st_document_sale as stDocumentSale,' +
      'tx_comment as txComment ' +
      'FROM document_sales d WHERE d.id_enterprise = ? AND d.id_document = ?',
      [idEnterprise, idDocument]).then(data => {
        this.documentSales[index] = {
          idDocument: data.rows.item(0).idDocument,
          idClient: data.rows.item(0).idClient,
          coClient: data.rows.item(0).coClient,
          idDocumentSaleType: data.rows.item(0).idDocumentSaleType,
          coDocumentSaleType: data.rows.item(0).coDocumentSaleType,
          daDocument: data.rows.item(0).daDocument,
          daDueDate: this.documentSales[index].daDueDate,
          nuAmountBase: data.rows.item(0).nuAmountBase == undefined ? 0 : data.rows.item(0).nuAmountBase,
          nuAmountDiscount: data.rows.item(0).nuAmountDiscount == undefined ? 0 : data.rows.item(0).nuAmountDiscount,
          nuAmountTax: data.rows.item(0).nuAmountTax == undefined ? 0 : data.rows.item(0).nuAmountTax,
          nuAmountTotal: data.rows.item(0).nuAmountTotal == undefined ? 0 : data.rows.item(0).nuAmountTotal,
          nuAmountPaid: this.coTypeModule != '2' ? data.rows.item(0).nuAmountPaid : this.amountPaidRetention,
          nuBalance: data.rows.item(0).nuBalance,
          coCurrency: data.rows.item(0).coCurrency,
          idCurrency: data.rows.item(0).idCurrency,
          nuDocument: data.rows.item(0).nuDocument,
          txComment: data.rows.item(0).txComment,
          coDocument: data.rows.item(0).coDocument,
          coCollection: data.rows.item(0).coCollection,
          nuValueLocal: data.rows.item(0).nuValueLocal,
          stDocumentSale: data.rows.item(0).stDocumentSale,
          coEnterprise: data.rows.item(0).coEnterprise,
          idEnterprise: data.rows.item(0).idEnterprise,
          naType: data.rows.item(0).naType,
          positionCollecDetails: this.documentSales[index].positionCollecDetails,
          nuAmountRetention: data.rows.item(0).nuAmountRetention == undefined ? 0 : data.rows.item(0).nuAmountRetention,
          nuAmountRetention2: data.rows.item(0).nuAmountRetention2 == undefined ? 0 : data.rows.item(0).nuAmountRetention2,
          daVoucher: data.rows.item(0).daVoucher == undefined ? "" : data.rows.item(0).daVoucher,
          // ensure daUpdate is provided (DB column may be daUpdate or da_update) to satisfy the DocumentSale model
          daUpdate: data.rows.item(0).daUpdate == undefined ? (data.rows.item(0).da_update == undefined ? "" : data.rows.item(0).da_update) : data.rows.item(0).daUpdate,
          nuVaucherRetention: data.rows.item(0).nuVaucherRetention == undefined ? "" : this.documentSales[index].nuVaucherRetention,
          igtfAmount: data.rows.item(0).igtfAmount == undefined ? 0 : this.documentSales[index].igtfAmount,
          txConversion: this.documentSales[index].txConversion,
          inPaymentPartial: this.documentSales[index].inPaymentPartial,
          historicPaymentPartial: this.documentSales[index].historicPaymentPartial,
          isSelected: this.documentSales[index].isSelected,
          isSave: false,
          colorRow: this.documentSales[index].colorRow,
          missingRetention: this.documentSales[index].missingRetention,
        }
        this.documentSalesBackup[index] = Object.assign({}, this.documentSales[index]);
        this.documentSalesBackup[index].positionCollecDetails = -1;

        this.documentSalesView[index] = JSON.parse(JSON.stringify(this.documentSalesBackup[index]));
        this.convertDocumentSaleIndex(index);
        return Promise.resolve(posicion);
      }).catch(e => {
        //this.documentSales
        return Promise.resolve(0);
      })
  }

  getIgtf(dbServ: SQLiteObject) {
    dbServ.executeSql('SELECT ' +
      'id_igtf as idIgtf, ' +
      'na_igtf as naIgtf, ' +
      'price as price, ' +
      'descripcion as descripcion, ' +
      'default_igtf as defaultIgtf ' +
      'FROM igtf_lists;', []).then(data => {
        let igtfList: IgtfList[] = [];
        for (let i = 0; i < data.rows.length; i++) {
          const item = data.rows.item(i);
          igtfList.push(item);
        }
        this.igtfList = [] as IgtfList[];
        this.igtfList = igtfList;
      })
  }

  getRate(dbServ: SQLiteObject, idEnterprise: number) {

    return dbServ.executeSql('SELECT * FROM conversion_types WHERE id_enterprise = ? ORDER BY date_conversion DESC LIMIT 1;',
      [idEnterprise]).then(data => {
        let rate: ConversionType;
        if (data.rows.length > 0)
          rate = data.rows.item(0);
        else
          rate = {} as ConversionType;
        return rate;
      })
  }

  getAllClientBankAccountByEnterprise(dbServ: SQLiteObject, idEnterprise: number, coClient: string,) {
    return dbServ.executeSql('SELECT DISTINCT cba.*, b.id_bank, b.na_bank FROM client_bank_accounts cba ' +
      'JOIN banks b ON cba.co_bank = b.co_bank AND cba.id_enterprise = b.id_enterprise ' +
      'WHERE cba.id_enterprise = ? AND cba.co_client = ?',
      [idEnterprise, coClient]).then(data => {
        let clientBankAccounts: ClientBankAccount[] = [];

        if (this.clientBankAccount) {
          clientBankAccounts.push({
            idBank: 0,
            idClient: 0,
            idClientBankAccount: 0,
            idCurrency: this.collection.idCurrency,
            idEnterprise: this.collection.idEnterprise,
            coBank: "Nueva Cuenta",
            coClient: "0",
            coClientBankAccount: "Nueva Cuenta",
            coCurrency: this.collection.coCurrency,
            coEnterprise: this.collection.coEnterprise,
            coType: "0",
            naBank: "Nueva Cuenta",
            nuAccount: "Nueva Cuenta",
          })
        }

        if (data.rows.length > 0)
          for (let i = 0; i < data.rows.length; i++) {
            clientBankAccounts.push({
              idBank: data.rows.item(i).id_bank,
              idClient: data.rows.item(i).id_client,
              idClientBankAccount: data.rows.item(i).id_client_bank_account,
              idCurrency: data.rows.item(i).id_currency,
              idEnterprise: data.rows.item(i).id_enterprise,
              coBank: data.rows.item(i).co_bank,
              coClient: data.rows.item(i).co_client,
              coClientBankAccount: data.rows.item(i).co_client_bank_account,
              coCurrency: data.rows.item(i).co_currency,
              coEnterprise: data.rows.item(i).co_enterprise,
              coType: data.rows.item(i).co_type,
              naBank: data.rows.item(i).na_bank,
              nuAccount: data.rows.item(i).nu_account,
            })
          }
        return clientBankAccounts;
      });
  }

  getAllBankAccountsByEnterprise(dbServ: SQLiteObject, idEnterprise: number, coCurrency: string) {

    let selectStatement = ""
    if (this.currencyBank) {
      selectStatement = 'SELECT * FROM bank_accounts ba, banks b WHERE ba.id_enterprise = ?' +
        ' AND b.co_enterprise = (SELECT co_enterprise FROM enterprises WHERE id_enterprise = ?)' +
        ' AND ba.co_bank = b.co_bank';

      return dbServ.executeSql(selectStatement,
        [idEnterprise, idEnterprise]).then(data => {
          let bankAccount: BankAccount[] = [];
          if (data.rows.length > 0)
            for (let i = 0; i < data.rows.length; i++) {
              bankAccount.push({
                idBankAccount: data.rows.item(i).id_bank_account,
                coBank: data.rows.item(i).co_bank,
                idBank: data.rows.item(i).id_bank,
                coAccount: data.rows.item(i).co_account,
                nuAccount: data.rows.item(i).nu_account,
                coType: data.rows.item(i).co_type,
                coCurrency: data.rows.item(i).co_currency,
                idCurrency: data.rows.item(i).id_currency,
                coEnterprise: data.rows.item(i).co_enterprise,
                idEnterprise: data.rows.item(i).id_enterprise,
                naBank: data.rows.item(i).na_bank,
                coClientBankAccount: data.rows.item(i).co_client_bank_account,
              })
            }

          return bankAccount;
        })
    } else {
      selectStatement = 'SELECT * FROM bank_accounts ba, banks b WHERE ba.id_enterprise = ?' +
        ' AND b.co_enterprise = (SELECT co_enterprise FROM enterprises WHERE id_enterprise = ?)' +
        ' AND ba.co_bank = b.co_bank AND ba.co_currency = ?';
      return dbServ.executeSql(selectStatement,
        [idEnterprise, idEnterprise, coCurrency]).then(data => {
          let bankAccount: BankAccount[] = [];
          if (data.rows.length > 0)
            for (let i = 0; i < data.rows.length; i++) {
              bankAccount.push({
                idBankAccount: data.rows.item(i).id_bank_account,
                coBank: data.rows.item(i).co_bank,
                idBank: data.rows.item(i).id_bank,
                coAccount: data.rows.item(i).co_account,
                nuAccount: data.rows.item(i).nu_account,
                coType: data.rows.item(i).co_type,
                coCurrency: data.rows.item(i).co_currency,
                idCurrency: data.rows.item(i).id_currency,
                coEnterprise: data.rows.item(i).co_enterprise,
                idEnterprise: data.rows.item(i).id_enterprise,
                naBank: data.rows.item(i).na_bank,
                coClientBankAccount: data.rows.item(i).co_client_bank_account,
              })
            }

          return bankAccount;
        }).catch(e => {
          let bankAccount: BankAccount[] = [];
          return bankAccount;
        })
    }
  }
  createDocumentSaleIGTF(dbServ: SQLiteObject, collection: Collection) {
    let igtfDocument = [] as DocumentSale[];
    let date = this.dateServ.hoyISOFullTime();
    igtfDocument.push({
      idDocument: 0,
      idClient: collection.idClient,
      coClient: collection.coClient,
      idDocumentSaleType: 4,
      coDocumentSaleType: "IGTF",
      daDocument: date.split(" ")[0],
      daDueDate: date.split(" ")[0],
      nuAmountBase: 0,
      nuAmountDiscount: 0,
      nuAmountTax: 0,
      nuAmountTotal: collection.nuAmountIgtf,
      nuAmountPaid: 0,
      nuBalance: collection.nuAmountIgtf,
      coCurrency: collection.coCurrency,
      idCurrency: collection.idCurrency,
      nuDocument: "",
      txComment: "IGTF " + collection.nuAmountIgtf + " " + collection.coCollection,
      coDocument: "IGTF-" + date,
      coCollection: collection.coCollection,
      nuValueLocal: collection.nuValueLocal,
      stDocumentSale: 0,
      coEnterprise: collection.coEnterprise,
      idEnterprise: collection.idEnterprise,
      naType: "IGTF",
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
      colorRow: "",
      daUpdate: "",
      missingRetention: false,
    });

    this.insertDocumentSaleBatch(dbServ, igtfDocument).then((resp) => {
      console.log("SE GUARDO DOCUMETNO IGTF EN DOCUMETN SALES DESDE COLLECT");
    });
  }

  insertDocumentSaleBatch(dbServ: SQLiteObject, arr: DocumentSale[]) {
    var statements = [];
    let insertStatement = 'INSERT OR REPLACE INTO document_sales(' +
      'id_document,id_client,co_client,id_document_sale_type, co_document_sale_type,' +
      'da_document,da_due_date,nu_amount_base,nu_amount_discount,nu_amount_tax,' +
      'nu_amount_total,nu_balance,id_currency,co_currency,id_enterprise,' +
      'co_enterprise,nu_document,tx_comment,co_document,co_collection,' +
      'nu_value_local,st_document_sale' +
      ') ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'

    for (var i = 0; i < arr.length; i++) {
      var obj = arr[i];
      statements.push([insertStatement, [obj.idDocument, obj.idClient, obj.coClient, obj.idDocumentSaleType, obj.coDocumentSaleType,
      obj.daDocument, obj.daDueDate, obj.nuAmountBase, obj.nuAmountDiscount, obj.nuAmountTax,
      obj.nuAmountTotal, obj.nuBalance, obj.idCurrency, obj.coCurrency, obj.idEnterprise,
      obj.coEnterprise, obj.nuDocument, obj.txComment, obj.coDocument, obj.coCollection,
      obj.nuValueLocal, obj.stDocumentSale]]);
    }

    return dbServ.sqlBatch(statements).then(res => {
      var statements = [];

      let statementsDocumentSt = 'INSERT OR REPLACE INTO document_st (' +
        'id_document, co_document, st_document' +
        ') VALUES (' +
        '?,?,?)'
      for (var i = 0; i < arr.length; i++) {
        var obj = arr[i];
        statements.push([statementsDocumentSt, [obj.idDocument, obj.coDocument, 0]]);
      }
      dbServ.sqlBatch(statements).then(res => {
        console.log(res)
      }).catch(e => {
        console.log(e);
      })
    }).catch(e => {
      console.log(e);
    })
  }

  deleteCollectionBatch(dbServ: SQLiteObject, deleteCollectionSQL: string, deleteCollectionDetailsSQL: string, deleteCollectionDetailDiscountsSQL: string, deleteCollectionPaymentsSQL: string, coCollection: string) {
    var statements = [];
    statements.push([deleteCollectionSQL, [coCollection]]);
    statements.push([deleteCollectionDetailsSQL, [coCollection]]);
    statements.push([deleteCollectionDetailDiscountsSQL, [coCollection]]);
    statements.push([deleteCollectionPaymentsSQL, [coCollection]]);

    return dbServ.sqlBatch(statements).then(res => {
      return Promise.resolve();
    }).catch(e => {
      return Promise.reject(e);
    })
  }

  saveCollection(dbServ: SQLiteObject, collection: Collection, action: boolean) {


    return this.adjuntoService.getQuantityAdjuntos().then(number => {
      this.collection.nuAttachments = number;
      if (this.collection.nuAttachments > 0)
        this.collection.hasAttachments = true;

      this.syncCollectionIgtfFields();

      if (collection.hasIGTF && action) {
        //SE DEBE CREAR UN DOCUMENTO DE VENTA TIPO IGTF
        this.createDocumentSaleIGTF(dbServ, collection);
      }

      this.collection.nuAmountFinal = this.montoTotalPagar;
      this.collection.nuAmountFinalConversion = this.convertirMonto(this.collection.nuAmountFinal, 0, this.collection.coCurrency);


      const details = this.collection?.collectionDetails ?? [];
      const nuAmountDiscountTotal = details.reduce((sum, detail) => sum + Number(detail?.nuAmountCollectDiscount ?? 0), 0);
      const nuAmountDiscountTotalConversion = details.reduce((sum, detail) => sum + Number(detail?.nuAmountCollectDiscountConversion ?? 0), 0);



      const deleteCollectionSQL = 'DELETE FROM collections WHERE co_collection = ?';
      const deleteCollectionDetailsSQL = 'DELETE FROM collection_details WHERE co_collection = ?';
      const deleteCollectionDetailsDiscountSQL = 'DELETE FROM collection_detail_discounts WHERE co_collection = ?';
      const deleteCollectionPaymentsSQL = 'DELETE FROM collection_payments WHERE co_collection = ?';

      return this.deleteCollectionBatch(dbServ, deleteCollectionSQL, deleteCollectionDetailsSQL, deleteCollectionDetailsDiscountSQL, deleteCollectionPaymentsSQL, collection.coCollection).then(() => {
        const insertCollection = "INSERT OR REPLACE INTO collections (" +
          "id_collection," +
          "co_collection," +
          "co_original_collection," +
          "id_client," +
          "co_client," +
          "lb_client," +
          "st_collection," +
          "st_delivery," +
          "da_collection," +
          "da_rate," +
          "na_responsible," +
          "id_enterprise," +
          "co_enterprise," +
          "id_currency," +
          "co_currency," +
          "co_type," +
          "tx_comment," +
          "coordenada," +
          "nu_value_local," +
          "nu_difference," +
          "nu_difference_conversion," +
          "tx_conversion," +
          "nu_amount_total," +
          "nu_amount_total_conversion," +
          "nu_amount_igtf," +
          "nu_amount_igtf_conversion," +
          "nu_amount_final," +
          "nu_amount_final_conversion," +
          "nu_amount_discount_total," +
          "nu_amount_discount_total_conversion," +
          "nu_igtf," +
          "hasIGTF," +
          "nu_attachments," +
          "has_attachments" +
          ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

        return dbServ.executeSql(insertCollection,
          [
            0,
            collection.coCollection,
            collection.coOriginalCollection,
            collection.idClient,
            collection.coClient,
            collection.lbClient,
            collection.stCollection,
            collection.stDelivery,
            collection.daCollection,
            collection.daRate,
            collection.naResponsible,
            collection.idEnterprise,
            collection.coEnterprise,
            collection.idCurrency,
            collection.coCurrency,
            collection.coType,
            collection.txComment,
            collection.coordenada,
            collection.nuValueLocal,
            collection.nuDifference,
            collection.nuDifferenceConversion,
            collection.txConversion,
            collection.nuAmountTotal,
            collection.nuAmountTotalConversion,
            collection.nuAmountIgtf,
            collection.nuAmountIgtfConversion,
            collection.nuAmountFinal,
            collection.nuAmountFinalConversion,
            nuAmountDiscountTotal,
            nuAmountDiscountTotalConversion,
            collection.nuIgtf,
            collection.hasIGTF,
            collection.nuAttachments,
            collection.hasAttachments,

          ]
        ).then(data => {
          console.log("COLLECTION INSERT", data);
          this.updateListCollectIgtfFromCollection(collection);

          //cobro o igtf
          if (collection.coType == '0' || collection.coType == '2' || collection.coType == '3' || collection.coType == '4') {
            return this.updateDocumentSt(dbServ, this.documentSales, collection.coType).then((resp) => {
              console.log("TERMINE DOCUMENT ST")
              return this.saveCollectionDetail(dbServ, this.collection.collectionDetails, this.collection.coCollection).then(resp => {
                return this.saveCollectionDetailDiscounts(dbServ, this.collection.collectionDetails, this.collection.coCollection).then(resp => {
                  return this.saveCollectionPayment(dbServ, this.collection.collectionPayments, this.collection.coCollection).then(resp => {
                    if (action) {
                      this.documentSales = [] as DocumentSale[];
                      this.documentSalesBackup = [] as DocumentSale[];
                    }

                    return resp
                  })
                })
              });
            });
          } else if (collection.coType == '1') {
            //es ancitipo solo debo guardar el payment
            return this.saveCollectionPayment(dbServ, this.collection.collectionPayments, this.collection.coCollection).then(resp => {
              return resp
            })
          } else if (collection.coType == '2') {
            //es retencion, solo debo guardar el detalle
            return this.updateDocumentSt(dbServ, this.documentSales).then((resp) => {
              console.log("TERMINE DOCUMENT ST")
              return this.saveCollectionDetail(dbServ, this.collection.collectionDetails, this.collection.coCollection).then(resp => {
                if (action) {
                  this.documentSales = [] as DocumentSale[];
                  this.documentSalesBackup = [] as DocumentSale[];
                }
                return resp;
              });

            });

          } else {

            return Promise.resolve();
          }
        }).catch(e => {
          return Promise.reject(e);
        })
      });
    })

  }

  saveCollectionBatch(dbServ: SQLiteObject, collection: Collection[]) {

    const insertCollectionSQL = `
  INSERT OR REPLACE INTO collections (
    id_collection,
    co_collection,
    co_original_collection,
    id_client,
    co_client,
    lb_client,
    st_collection,
    st_delivery,
    da_collection,
    da_rate,
    na_responsible,
    id_enterprise,
    co_enterprise,
    nu_amount_total,
    nu_amount_total_conversion,
    id_currency,
    co_currency,
    co_type,
    tx_comment,
    coordenada,
    nu_value_local,
    nu_difference,
    nu_difference_conversion,
    tx_conversion,
    nu_igtf,
    nu_amount_igtf,
    nu_amount_igtf_conversion,
    nu_amount_final,
    nu_amount_final_conversion,
    nu_amount_discount_total,
    nu_amount_discount_total_conversion,
    hasIGTF,
    nu_attachments,
    has_attachments
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

    const insertCollectionDetailSQL = `INSERT OR REPLACE INTO collection_details (
    id_collection_detail,
      co_collection,
      co_document,
      in_payment_partial,
      nu_voucher_retention,
      nu_amount_retention,
      nu_amount_retention2,
      nu_amount_paid,
      nu_amount_paid_conversion,
      nu_amount_discount,
      nu_amount_discount_conversion,
      nu_amount_doc,
      nu_amount_doc_conversion,
      da_document,
      nu_balance_doc,
      nu_balance_doc_conversion,
      nu_balance_doc_original,
      nu_balance_doc_original_conversion,
      co_original,
      co_type_doc,
      id_document,
      nu_amount_retention_iva_conversion,
      nu_amount_retention_islr_conversion,
      nu_amount_igtf,
      nu_amount_igtf_conversion,
      da_voucher,
      has_discount,
      discount_comment,
      nu_amount_collect_discount,
      nu_amount_collect_discount_conversion,
      nu_collect_discount,
      missing_retention
) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`;

    const insertCollectionPaymentSQL = `
  INSERT OR REPLACE INTO collection_payments (
    id_collection_payment,
    co_collection,
    id_collection_detail,
    co_payment_method,
    id_bank,
    nu_payment_doc,
    na_bank,
    co_client_bank_account,
    nu_client_bank_account,
    da_value,
    da_collection_payment,
    nu_collection_payment,
    nu_amount_partial,
    nu_amount_partial_conversion,
    co_type,
    id_difference_code,
    co_difference_code,
    nu_bank_account,
    id_type_document,
    nu_document,
    id_code_phone_number,
    nu_phone_number

  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
    const insertCollectionDetailDiscountSQL = `
  INSERT OR REPLACE INTO collection_detail_discounts (
    id_collection_detail_discount,
    id_collection_detail,
    nu_collect_discount_other,
    na_collect_discount_other,
    co_collection,
    co_document,
    nu_amount_collect_discount_other,
    nu_amount_collect_discount_other_conversion,
    posicion
  ) VALUES (?,?,?,?,?,?,?,?,?)
    `

    let queries: any[] = []//(string | (string | number | boolean)[])[] = [];

    const details = this.collection?.collectionDetails ?? [];
    const nuAmountDiscountTotal = details.reduce((sum, detail) => sum + Number(detail?.nuAmountCollectDiscount ?? 0), 0);
    const nuAmountDiscountTotalConversion = details.reduce((sum, detail) => sum + Number(detail?.nuAmountCollectDiscountConversion ?? 0), 0);


    for (var co = 0; co < collection.length; co++) {
      const collect = collection[co];
      queries.push([insertCollectionSQL,
        [
          collect.idCollection,
          collect.coCollection,
          collect.coOriginalCollection,
          collect.idClient,
          collect.coClient,
          collect.naClient,
          collect.stCollection,
          1,
          collect.daCollection,
          collect.daRate,
          collect.naResponsible,
          collect.idEnterprise,
          collect.coEnterprise,
          collect.nuAmountTotal,
          collect.nuAmountTotalConversion,
          collect.idCurrency,
          collect.coCurrency,
          collect.coType,
          collect.txComment,
          collect.coordenada,
          collect.nuValueLocal,
          collect.nuDifference,
          collect.nuDifferenceConversion,
          collect.txConversion,
          collect.nuIgtf,
          collect.nuAmountIgtf,
          collect.nuAmountIgtfConversion,
          collect.nuAmountFinal,
          collect.nuAmountFinalConversion,
          nuAmountDiscountTotal,
          nuAmountDiscountTotalConversion,
          collect.hasIGTF,
          collect.nuAttachments,
          collect.hasAttachments,

        ]
      ]);

      for (var coDetail = 0; coDetail < collect.collectionDetails.length; coDetail++) {
        const collectionDetail = collection[co].collectionDetails[coDetail];

        if (collectionDetail.inPaymentPartial == true) {
          this.coDocumentToUpdate.push(collectionDetail.coDocument);
        }
        queries.push([insertCollectionDetailSQL,
          [
            collectionDetail.idCollectionDetail,
            collectionDetail.coCollection,
            collectionDetail.coDocument,
            collectionDetail.inPaymentPartial,
            collectionDetail.nuVoucherRetention,
            collectionDetail.nuAmountRetention,
            collectionDetail.nuAmountRetention2,
            collectionDetail.nuAmountPaid,
            collectionDetail.nuAmountPaidConversion,
            collectionDetail.nuAmountDiscount,
            collectionDetail.nuAmountDiscountConversion,
            collectionDetail.nuAmountDoc,
            collectionDetail.nuAmountDocConversion,
            collectionDetail.daDocument,
            collectionDetail.nuBalanceDoc,
            collectionDetail.nuBalanceDocConversion,
            collectionDetail.nuBalanceDocOriginal,
            collectionDetail.nuBalanceDocOriginalConversion,
            collectionDetail.coOriginal,
            collectionDetail.coTypeDoc,
            collectionDetail.idDocument,
            collectionDetail.nuAmountRetentionIvaConversion,
            collectionDetail.nuAmountRetentionIslrConversion,
            collectionDetail.nuAmountIgtf,
            collectionDetail.nuAmountIgtfConversion,
            collectionDetail.daVoucher,
            collectionDetail.hasDiscount,
            collectionDetail.discountComment,
            collectionDetail.nuAmountCollectDiscount,
            collectionDetail.nuAmountCollectDiscountConversion,
            collectionDetail.nuCollectDiscount,
            collectionDetail.missingRetention
          ]
        ]);

        if (collectionDetail.collectionDetailDiscounts?.length! > 0) {
          for (var coDetailDiscount = 0; coDetailDiscount < collectionDetail.collectionDetailDiscounts!.length; coDetailDiscount++) {
            const collectionDetailDiscount = collectionDetail.collectionDetailDiscounts![coDetailDiscount];
            queries.push([insertCollectionDetailDiscountSQL,
              [
                collectionDetailDiscount.idCollectionDetailDiscount,
                collectionDetailDiscount.idCollectionDetail,
                collectionDetailDiscount.nuCollectDiscountOther,
                collectionDetailDiscount.naCollectDiscountOther,
                collectionDetail.coCollection,
                collectionDetail.coDocument,
                collectionDetailDiscount.nuAmountCollectDiscountOther,
                collectionDetailDiscount.nuAmountCollectDiscountOtherConversion,
                collectionDetailDiscount.posicion
              ]
            ]);
          }
        }
      }

      for (var coDetailPayment = 0; coDetailPayment < collect.collectionPayments.length; coDetailPayment++) {
        const collectionPayment = collect.collectionPayments[coDetailPayment];
        queries.push([insertCollectionPaymentSQL,
          [
            collectionPayment.idCollectionPayment,
            collectionPayment.coCollection,
            collectionPayment.idCollectionDetail,
            collectionPayment.coPaymentMethod,
            collectionPayment.idBank,
            collectionPayment.nuPaymentDoc,
            collectionPayment.naBank,
            collectionPayment.coClientBankAccount,
            collectionPayment.nuClientBankAccount,
            collectionPayment.daValue,
            collectionPayment.daCollectionPayment,
            collectionPayment.nuCollectionPayment,
            collectionPayment.nuAmountPartial,
            collectionPayment.nuAmountPartialConversion,
            collectionPayment.coType,
            collectionPayment.idDifferenceCode,
            collectionPayment.coDifferenceCode,
            collectionPayment.nuBankAccount,
            collectionPayment.idTypeDocument,
            collectionPayment.nuDocument,
            collectionPayment.idCodePhoneNumber,
            collectionPayment.nuPhoneNumber,
          ]
        ]);
      }
    }
    return dbServ.sqlBatch(queries).then(() => {
      console.log('Batch insertado con éxito');
    }).catch(error => {

      console.log('Error al insertar en batch:', error);
    });
  }

  deleteCollectionsBatch(dbServ: SQLiteObject, collection: Collection[]) {
    const deleteCollectionsSQL = `DELETE FROM collections WHERE co_collection = ?`;
    const deleteCollectionDetailsSQL = `DELETE FROM collection_details WHERE co_collection = ?`;
    const deleteCollectionDetailDiscountsSQL = `DELETE FROM collection_detail_discounts WHERE co_collection = ?`;
    const deleteCollectionPaymentsSQL = `DELETE FROM collection_payments WHERE co_collection = ?`;

    let queries: any[] = []
    for (var co = 0; co < collection.length; co++) {
      const collect = collection[co];
      queries.push([deleteCollectionsSQL, [collect.coCollection]]);
      for (var coDetail = 0; coDetail < collect.collectionDetails.length; coDetail++) {
        const collectionDetail = collect.collectionDetails[coDetail];
        queries.push([deleteCollectionDetailsSQL, [collect.coCollection]]);
        if (collectionDetail.collectionDetailDiscounts?.length! > 0)
          for (var coDetailDiscount = 0; coDetailDiscount < collect.collectionDetails[coDetail].collectionDetailDiscounts!.length; coDetailDiscount++) {
            const collectionDetailDisctount = collect.collectionDetails[coDetail].collectionDetailDiscounts![coDetailDiscount];
            queries.push([deleteCollectionDetailDiscountsSQL, [collect.coCollection]]);
          }
      }
      for (var coDetailPayment = 0; coDetailPayment < collect.collectionPayments.length; coDetailPayment++) {
        const collectionPayment = collect.collectionPayments[coDetailPayment];
        queries.push([deleteCollectionPaymentsSQL, [collect.coCollection]]);
      }
    }

    return dbServ.sqlBatch(queries).then(() => {
      console.log('Batch delete con éxito');
      return Promise.resolve(true);
    }).catch(error => {
      console.log('Error al insertar en batch:', error);
      return Promise.resolve(false);
    });

  }

  saveCollectionDetail(dbServ: SQLiteObject, collectionDetail: CollectionDetail[], coCollection: string) {


    //if (collectionDetail.length > 0)
    dbServ.executeSql("DELETE FROM collection_details WHERE co_collection = ?", [coCollection]).then(res => {
    }).catch(e => {
      console.log(e);
    })

    let statementsCollectionDetails = [];
    const inserStatementCollectionDetail = `INSERT OR REPLACE INTO collection_details (
    id_collection_detail,
      co_collection,
      co_document,
      in_payment_partial,
      nu_voucher_retention,
      nu_amount_retention,
      nu_amount_retention2,
      nu_amount_paid,
      nu_amount_paid_conversion,
      nu_amount_discount,
      nu_amount_discount_conversion,
      nu_amount_doc,
      nu_amount_doc_conversion,
      da_document,
      nu_balance_doc,
      nu_balance_doc_conversion,
      nu_balance_doc_original,
      nu_balance_doc_original_conversion,
      co_original,
      co_type_doc,
      id_document,
      nu_amount_retention_iva_conversion,
      nu_amount_retention_islr_conversion,
      nu_amount_igtf,
      nu_amount_igtf_conversion,
      da_voucher,
      has_discount,
      discount_comment,
      nu_amount_collect_discount,
      nu_amount_collect_discount_conversion,
      nu_collect_discount,
      missing_retention
) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?); `;

    for (var i = 0; i < collectionDetail.length; i++) {
      statementsCollectionDetails.push([inserStatementCollectionDetail, [
        0,
        collectionDetail[i].coCollection,
        collectionDetail[i].coDocument,
        collectionDetail[i].inPaymentPartial,
        collectionDetail[i].nuVoucherRetention,
        collectionDetail[i].nuAmountRetention,
        collectionDetail[i].nuAmountRetention2,
        collectionDetail[i].nuAmountPaid,
        collectionDetail[i].nuAmountPaidConversion,
        collectionDetail[i].nuAmountDiscount,
        collectionDetail[i].nuAmountDiscountConversion,
        collectionDetail[i].nuAmountDoc,
        collectionDetail[i].nuAmountDocConversion,
        collectionDetail[i].daDocument,
        collectionDetail[i].nuBalanceDoc,
        collectionDetail[i].nuBalanceDocConversion,
        collectionDetail[i].nuBalanceDocOriginal,
        collectionDetail[i].nuBalanceDocOriginalConversion,
        collectionDetail[i].coOriginal,
        collectionDetail[i].coTypeDoc,
        collectionDetail[i].idDocument,
        collectionDetail[i].nuAmountRetentionIvaConversion,
        collectionDetail[i].nuAmountRetentionIslrConversion,
        collectionDetail[i].nuAmountIgtf,
        collectionDetail[i].nuAmountIgtfConversion,
        collectionDetail[i].daVoucher,
        collectionDetail[i].hasDiscount,
        collectionDetail[i].discountComment,
        collectionDetail[i].nuAmountCollectDiscount,
        collectionDetail[i].nuAmountCollectDiscountConversion,
        collectionDetail[i].nuCollectDiscount,
        collectionDetail[i].missingRetention
      ]]);
    }

    return dbServ.sqlBatch(statementsCollectionDetails).then(res => {
      console.log("COLLECTION DETAILS INSERT", res);
      return Promise.resolve("TERMINE");
    }).catch(e => {
      console.log(e);
    })
  }

  saveCollectionDetailDiscounts(dbServ: SQLiteObject, collectionDetail: CollectionDetail[], coCollection: string) {
    const statementsCollectionDiscount = [];
    const insertStatement = "INSERT OR REPLACE INTO collection_detail_discounts(" +
      "id_collection_detail," +
      "id_collect_discount," +
      "nu_collect_discount_other," +
      "na_collect_discount_other," +
      "co_collection," +
      "co_document," +
      "nu_amount_collect_discount_other," +
      "nu_amount_collect_discount_other_conversion," +
      "posicion" +
      ") VALUES (?,?,?,?,?,?,?,?,?)";

    for (var i = 0; i < collectionDetail.length; i++) {
      for (var j = 0; j < collectionDetail[i].collectionDetailDiscounts!?.length; j++) {
        statementsCollectionDiscount.push([insertStatement, [
          collectionDetail[i].collectionDetailDiscounts![j].idCollectionDetail,
          collectionDetail[i].collectionDetailDiscounts![j].idCollectDiscount,
          collectionDetail[i].collectionDetailDiscounts![j].nuCollectDiscountOther,
          collectionDetail[i].collectionDetailDiscounts![j].naCollectDiscountOther,
          coCollection,
          collectionDetail[i].collectionDetailDiscounts![j].coDocument,
          collectionDetail[i].collectionDetailDiscounts![j].nuAmountCollectDiscountOther,
          collectionDetail[i].collectionDetailDiscounts![j].nuAmountCollectDiscountOtherConversion,
          collectionDetail[i].collectionDetailDiscounts![j].posicion
        ]]);
      }

    }

    return dbServ.sqlBatch(statementsCollectionDiscount).then(res => {
      console.log("collection_detail_discounts INSERT", res);
      return Promise.resolve("TERMINE");
      //this.saveCollectionPayment(this.collection.collectPayment)
    }).catch(e => {
      console.log(e);
    })

  }

  saveCollectionPayment(dbServ: SQLiteObject, collectionPayment: CollectionPayment[], coCollection: string) {

    //if (collectionPayment.length > 0)
    dbServ.executeSql("DELETE FROM collection_payments WHERE co_collection = ?", [coCollection]).then(res => {

    }).catch(e => {
      console.log(e);
    })

    const statementsCollectionPayment = [];
    const insertStatement = "INSERT OR REPLACE INTO collection_payments(" +
      "id_collection_payment," +
      "co_collection, " +
      "id_collection_detail, " +
      "co_payment_method, " +
      "id_bank, " +
      "nu_payment_doc, " +
      "na_bank, " +
      "co_client_bank_account, " +
      "nu_client_bank_account, " +
      "da_value, " +
      "da_collection_payment, " +
      "nu_collection_payment, " +
      "nu_amount_partial, " +
      "nu_amount_partial_conversion, " +
      "co_type," +
      "id_difference_code," +
      "co_difference_code," +
      "nu_bank_account," +
      "id_type_document," +
      "nu_document," +
      "id_code_phone_number," +
      "nu_phone_number" +
      ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    for (var i = 0; i < collectionPayment.length; i++) {
      statementsCollectionPayment.push([insertStatement, [
        0,
        collectionPayment[i].coCollection,
        collectionPayment[i].idCollectionDetail,
        collectionPayment[i].coPaymentMethod,
        collectionPayment[i].idBank,
        collectionPayment[i].nuPaymentDoc,
        collectionPayment[i].naBank,
        collectionPayment[i].coClientBankAccount,
        collectionPayment[i].nuClientBankAccount,
        collectionPayment[i].daValue,
        collectionPayment[i].daCollectionPayment,
        collectionPayment[i].nuCollectionPayment,
        collectionPayment[i].nuAmountPartial,
        collectionPayment[i].nuAmountPartialConversion,
        collectionPayment[i].coType,
        collectionPayment[i].idDifferenceCode,
        collectionPayment[i].coDifferenceCode,
        collectionPayment[i].nuBankAccount,
        collectionPayment[i].idTypeDocument,
        collectionPayment[i].nuDocument,
        collectionPayment[i].idCodePhoneNumber,
        collectionPayment[i].nuPhoneNumber,
      ]]);
    }

    return dbServ.sqlBatch(statementsCollectionPayment).then(res => {
      console.log("COLLECTION PAYMENTS INSERT", res);
      return Promise.resolve("TERMINE");
    }).catch(e => {
      console.log(e);
    })
  }

  saveSendCollection(coCollection: string) {
    this.saveSend.next(coCollection);
  }

  //createAnticipoCollection(collection: Collection, inserStatement: string) {
  createAnticipoCollection(dbServ: SQLiteObject, collection: Collection) {
    let inserStatement = "INSERT OR REPLACE INTO collections (" +
      "id_collection," +
      "co_collection," +
      "co_original_collection," +
      "id_client," +
      "co_client," +
      "lb_client," +
      "st_collection," +
      "st_delivery," +
      "da_collection," +
      "da_rate," +
      "na_responsible," +
      "id_enterprise," +
      "co_enterprise," +
      "id_currency," +
      "co_currency," +
      "co_type," +
      "tx_comment," +
      "coordenada," +
      "nu_value_local," +
      "nu_difference," +
      "nu_difference_conversion," +
      "tx_conversion," +
      "nu_amount_total," +
      "nu_amount_total_conversion," +
      "nu_amount_igtf," +
      "nu_amount_igtf_conversion," +
      "nu_amount_final," +
      "nu_amount_final_conversion," +
      "nu_amount_discount_total," +
      "nu_amount_discount_total_conversion," +
      "nu_igtf," +
      "hasIGTF," +
      "nu_attachments," +
      "has_attachments" +
      ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";


    let newCoCollection = this.dateServ.generateCO(0);
    return dbServ.executeSql(inserStatement,
      [
        0,
        newCoCollection,
        collection.coCollection,
        collection.idClient,
        collection.coClient,
        collection.lbClient,
        collection.stCollection,
        collection.stDelivery,
        collection.daCollection,
        collection.daRate,
        collection.naResponsible,
        collection.idEnterprise,
        collection.coEnterprise,
        collection.idCurrency,
        collection.coCurrency,
        1, //TIPO ANTICIPO
        collection.txComment,
        collection.coordenada,
        collection.nuValueLocal,
        0,//collection.nuDifference,
        0,//collection.nuDifferenceConversion,
        collection.txConversion,
        collection.nuDifference,//collection.nuAmountTotal,
        collection.nuDifferenceConversion,//collection.nuAmountTotalConversion,
        0,//collection.nuAmountIgtf,
        0,//collection.nuAmountIgtfConversion,
        collection.nuDifference,//collection.nuAmountFinal,
        collection.nuDifferenceConversion,//collection.nuAmountFinalConversion,
        collection.nuAmountDiscountTotal,//collection.nuAmountDiscountTotal,
        collection.nuAmountDiscountTotalConversion,//collection.nuAmountDiscountTotalConversion,
        collection.nuIgtf,
        collection.hasIGTF,
        collection.nuAttachments,
        collection.hasAttachments
      ]).then(data => {
        console.log("CREE ANTICIPO AUTOMATICO, DEBO CREAR EL PAYMENT")
        return this.createAnticipoCollectionPayment(dbServ, collection, newCoCollection);
      }).catch(e => {
        console.log(e);
      })
  }

  createAnticipoCollectionPayment(dbServ: SQLiteObject, collection: Collection, newCoCollection: string) {

    let insertStatement = "INSERT OR REPLACE INTO collection_payments(" +
      "id_collection_payment," +
      "co_collection," +
      "id_collection_detail," +
      "co_payment_method," +
      "id_bank," +
      "nu_payment_doc," +
      "na_bank," +
      "co_client_bank_account," +
      "nu_client_bank_account," +
      "da_value," +
      "da_collection_payment," +
      "nu_collection_payment," +
      "nu_amount_partial," +
      "nu_amount_partial_conversion," +
      "co_type," +
      "id_difference_code," +
      "co_difference_code," +
      "nu_bank_account," +
      "id_type_document," +
      "nu_document," +
      "id_code_phone_number," +
      "nu_phone_number" +
      ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    const sourcePayment = collection.collectionPayments[this.anticipoAutomatico[0].posCollectionPayment];
    return dbServ.executeSql(insertStatement,
      [
        0,
        newCoCollection,
        sourcePayment.idCollectionDetail,
        sourcePayment.coPaymentMethod,
        sourcePayment.idBank,
        sourcePayment.nuPaymentDoc,
        sourcePayment.naBank,
        sourcePayment.coClientBankAccount,
        sourcePayment.nuClientBankAccount,
        sourcePayment.daValue,
        sourcePayment.daCollectionPayment,
        sourcePayment.nuCollectionPayment,
        collection.nuDifference,
        collection.nuDifferenceConversion,
        this.anticipoAutomatico[0].type,
        sourcePayment.idDifferenceCode,
        sourcePayment.coDifferenceCode,
        sourcePayment.nuBankAccount,
        sourcePayment.idTypeDocument,
        sourcePayment.nuDocument,
        sourcePayment.idCodePhoneNumber,
        sourcePayment.nuPhoneNumber,
      ]).then(data => {
        console.log("SE CREO COLLECTION PAYMENTS AUTOMATICO POR EL ANTICIPO");
        this.saveSendCollection(newCoCollection);
        return true;
      }).catch(e => {
        console.log(e);
        return false;
      })
  }

  updateDocumentSt(dbServ: SQLiteObject, documentSales: DocumentSale[], coType: string = "") {
    if (documentSales.length == 0) {
      return Promise.resolve(true);
    }
    let daUpdate = this.dateServ.hoyISOFullTime();
    if (documentSales[0].coDocumentSaleType == "IGTF") {

      const updateStatement = "UPDATE document_st SET st_document = 2, da_update = ? WHERE co_document = ?"
      return dbServ.executeSql(updateStatement,
        [daUpdate, documentSales[0].coDocument]
      ).then(data => {
        console.log("UPDATE DOCUMENTO IGTF", documentSales[0].coDocument)
      }).catch(e => {
        console.log(e);
      })
    } else {
      let stamentenDocumentSt = []
      /*     let insertStatement = 'INSERT OR REPLACE INTO document_st (' +
            'id_document,co_document,st_document' +
            ') VALUES (?,?,?)'; */
      const updateStatement = "UPDATE document_st SET st_document = ?, da_update = ? WHERE co_document = ?"
      for (var i = 0; i < documentSales.length; i++) {
        let stDelivery = 0;
        if (documentSales[i].isSelected) {
          if (coType == '2') {
            //es una retencion, no debe marcar el documento como entregado
            stDelivery = 0;
          } else if (documentSales[i].inPaymentPartial) { // Prioridad al pago parcial
            stDelivery = 0;
          } else if (documentSales[i].missingRetention) { // Luego la retención
            stDelivery = 2;
          } else {
            stDelivery = 2;
          }

          stamentenDocumentSt.push([updateStatement, [
            stDelivery,
            daUpdate,
            documentSales[i].coDocument,
          ]]);
        } else {
          stamentenDocumentSt.push([updateStatement, [
            stDelivery,
            daUpdate,
            documentSales[i].coDocument,
          ]]);
        }
      }

      return dbServ.sqlBatch(stamentenDocumentSt).then(res => {
        console.log("SE ACTUALIZARON LOS DOCUMENT ST")
        /*  dbServ.executeSql('SELECT * FROM document_st', []).then(resBloq => {
           console.log("DOCUMENT STs", resBloq);
           return Promise.resolve(true)
         }).catch(e => {
           console.log(e);
           return Promise.resolve(true)
         }) */
        setTimeout(() => {
          return Promise.resolve(true)
        }, 1000);

      }).catch(e => {
        console.log(e);
        return e;
      })
    }
  }



  getDocumentIGTF(dbServ: SQLiteObject, collection: Collection) {
    return dbServ.executeSql(
      'SELECT * FROM document_sales WHERE co_collection = ?', [collection.coCollection
    ]).then(data => {
      if (data.rows.length > 0) {
        let documentSales = {} as DocumentSale;
        documentSales.idDocument = data.rows.item(0).id_document;
        documentSales.idClient = data.rows.item(0).id_client;
        documentSales.coClient = data.rows.item(0).co_client;
        documentSales.idDocumentSaleType = data.rows.item(0).id_document_sale_type;
        documentSales.coDocumentSaleType = data.rows.item(0).co_document_sale_type;
        documentSales.daDocument = data.rows.item(0).da_document;
        documentSales.daDueDate = data.rows.item(0).da_due_date;

        if (data.rows.item(0).na_amount_base === null || data.rows.item(0).na_amount_base === undefined) {
          documentSales.nuAmountBase = 0;
        } else {
          documentSales.nuAmountBase = data.rows.item(0).na_amount_base;
        }

        if (data.rows.item(0).nu_amount_discount === null || data.rows.item(0).nu_amount_discount === undefined) {
          documentSales.nuAmountDiscount = 0;
        } else {
          documentSales.nuAmountDiscount = data.rows.item(0).nu_amount_discount;
        }

        if (data.rows.item(0).nu_amount_tax === null || data.rows.item(0).nu_amount_tax === undefined) {
          documentSales.nuAmountTax = 0;
        } else {
          documentSales.nuAmountTax = data.rows.item(0).nu_amount_tax;
        }
        documentSales.nuAmountTotal = data.rows.item(0).nu_amount_total;
        documentSales.nuAmountPaid = data.rows.item(0).nu_amount_paid;
        documentSales.nuBalance = data.rows.item(0).nu_balance;
        documentSales.coCurrency = data.rows.item(0).co_currency;
        documentSales.idCurrency = data.rows.item(0).id_currency;
        documentSales.nuDocument = data.rows.item(0).nu_document;
        documentSales.txComment = data.rows.item(0).tx_comment;
        documentSales.coDocument = data.rows.item(0).co_document;
        documentSales.coCollection = data.rows.item(0).co_collection;
        documentSales.nuValueLocal = data.rows.item(0).nu_value_local;
        documentSales.stDocumentSale = data.rows.item(0).st_document_sale;
        documentSales.coEnterprise = data.rows.item(0).co_enterprise;
        documentSales.idEnterprise = data.rows.item(0).id_enterprise;
        documentSales.naType = data.rows.item(0).na_type;
        documentSales.inPaymentPartial = false;
        documentSales.isSelected = false;
        documentSales.isSave = false;

        collection.document = documentSales;


      }
      return collection;
    })
  }

  getCollection(dbServ: SQLiteObject, coCollection: string) {
    return dbServ.executeSql(
      'SELECT * FROM collections WHERE co_collection = ?', [coCollection
    ]).then(res => {
      let collection = {} as Collection;
      if (res.rows.length > 0) {
        //collection.idCollection = res.rows.item(0).id_collection;
        collection.coCollection = res.rows.item(0).co_collection;
        collection.coOriginalCollection = res.rows.item(0).co_original_collection;
        collection.daCollection = res.rows.item(0).da_collection;
        collection.naResponsible = res.rows.item(0).na_responsible;
        collection.coCurrency = res.rows.item(0).co_currency;
        collection.coType = res.rows.item(0).co_type;
        collection.txComment = res.rows.item(0).tx_comment;
        collection.lbClient = res.rows.item(0).lb_client;
        collection.naClient = res.rows.item(0).lb_client;
        collection.idClient = res.rows.item(0).id_client;
        collection.coClient = res.rows.item(0).co_client;
        collection.idEnterprise = res.rows.item(0).id_enterprise;
        collection.coEnterprise = res.rows.item(0).co_enterprise;
        collection.stCollection = res.rows.item(0).st_collection;
        collection.stDelivery = res.rows.item(0).st_delivery;
        collection.isEdit = 0;
        collection.isEditTotal = 0;
        collection.isSave = 1;
        collection.nuValueLocal = res.rows.item(0).nu_value_local;
        //collection.idConversionType = res.rows.item(0).id_conversion_type;
        collection.idCurrency = res.rows.item(0).id_currency;
        collection.txConversion = res.rows.item(0).tx_conversion;
        collection.nuAmountTotal = res.rows.item(0).nu_amount_total == null ? 0 : res.rows.item(0).nu_amount_total;
        collection.nuAmountTotalConversion = res.rows.item(0).nu_amount_total_conversion == null ? 0 : res.rows.item(0).nu_amount_total_conversion;
        collection.nuDifference = res.rows.item(0).nu_difference == null ? 0 : res.rows.item(0).nu_difference;
        collection.nuDifferenceConversion = res.rows.item(0).nu_difference_conversion == null ? 0 : res.rows.item(0).nu_difference_conversion;
        collection.nuIgtf = res.rows.item(0).nu_igtf == null ? 0 : res.rows.item(0).nu_igtf;
        collection.nuAmountFinal = res.rows.item(0).nu_amount_final == null ? 0 : res.rows.item(0).nu_amount_final;
        collection.nuAmountFinalConversion = res.rows.item(0).nu_amount_final_conversion == null ? 0 : res.rows.item(0).nu_amount_final_conversion;
        collection.nuAmountIgtf = res.rows.item(0).nu_amount_igtf == null ? 0 : res.rows.item(0).nu_amount_igtf;
        collection.nuAmountIgtfConversion = res.rows.item(0).nu_amount_igtf_conversion == null ? 0 : res.rows.item(0).nu_amount_igtf_conversion;
        collection.nuAmountPaid = res.rows.item(0).nu_amount_paid == null ? 0 : res.rows.item(0).nu_amount_paid;
        collection.nuAmountPaidConversion = res.rows.item(0).nu_amount_paid_conversion == null ? 0 : res.rows.item(0).nu_amount_paid_conversion;
        collection.nuAmountDiscountTotal = res.rows.item(0).nu_amount_discount_total == null ? 0 : res.rows.item(0).nu_amount_discount_total;
        collection.nuAmountDiscountTotalConversion = res.rows.item(0).nu_amount_discount_total_conversion == null ? 0 : res.rows.item(0).nu_amount_discount_total_conversion;
        collection.hasIGTF = res.rows.item(0).hasIGTF == undefined ? false : res.rows.item(0).hasIGTF;
        //collection.daVoucher = res.rows.item(0).daVoucher;
        collection.document = {} as DocumentSale;
        collection.coordenada = res.rows.item(0).coordenada;
        collection.hasAttachments = res.rows.item(0).has_attachments == "true" ? true : false;
        collection.nuAttachments = res.rows.item(0).nu_attachments;
        collection.collectionDetails = [] as CollectionDetail[];
        collection.collectionPayments = [] as CollectionPayment[];
      }


      if (collection.hasIGTF.toString() === "true" ? true : false) {
        return this.getDocumentIGTF(dbServ, collection).then(resp => {
          return collection
        })
      } else
        return collection;
    }).catch(e => {
      let collection = {} as Collection;
      console.log(e);
      return collection;
    })
  }

  getCollectionDetails(dbServ: SQLiteObject, coCollection: string) {
    return dbServ.executeSql(
      'SELECT * FROM collection_details WHERE co_collection = ?', [coCollection
    ]).then(res => {
      let collectionDetails: CollectionDetail[] = [];
      for (var i = 0; i < res.rows.length; i++) {
        collectionDetails.push({
          //idCollectionDetail: null,
          coCollection: res.rows.item(i).co_collection,
          coDocument: res.rows.item(i).co_document,
          idDocument: res.rows.item(i).id_document,
          inPaymentPartial: res.rows.item(i).in_payment_partial === "true" ? true : false,
          nuVoucherRetention: res.rows.item(i).nu_voucher_retention,
          nuAmountRetention: res.rows.item(i).nu_amount_retention,
          nuAmountRetention2: res.rows.item(i).nu_amount_retention2,
          nuAmountRetentionConversion: res.rows.item(i).nu_amount_retention_iva_conversion,
          nuAmountRetentionIvaConversion: res.rows.item(i).nu_amount_retention_iva_conversion,
          nuAmountRetention2Conversion: res.rows.item(i).nu_amount_retention_islr_conversion,
          nuAmountRetentionIslrConversion: res.rows.item(i).nu_amount_retention_islr_conversion,
          nuAmountPaid: res.rows.item(i).nu_amount_paid,
          nuAmountPaidConversion: res.rows.item(i).nu_amount_paid_conversion,
          nuAmountDiscount: res.rows.item(i).nu_amount_discount,
          nuAmountDiscountConversion: res.rows.item(i).nu_amount_discount_conversion,
          nuAmountDoc: res.rows.item(i).nu_amount_doc,
          nuAmountDocConversion: res.rows.item(i).nu_amount_doc_conversion,
          daDocument: res.rows.item(i).da_document,
          nuBalanceDoc: res.rows.item(i).nu_balance_doc,
          nuBalanceDocConversion: res.rows.item(i).nu_balance_doc_conversion,
          nuBalanceDocOriginal: res.rows.item(i).nu_balance_doc_original,
          nuBalanceDocOriginalConversion: res.rows.item(i).nu_balance_doc_original_conversion,
          coOriginal: res.rows.item(i).co_original,
          coTypeDoc: res.rows.item(i).co_type_doc,
          nuValueLocal: res.rows.item(i).nu_value_local,
          nuAmountIgtf: res.rows.item(i).nu_amount_igtf,
          nuAmountIgtfConversion: res.rows.item(i).nu_amount_igtf_conversion,
          st: res.rows.item(i).st,
          isSave: true,
          daVoucher: res.rows.item(i).da_voucher == "" ? null : res.rows.item(i).da_voucher,
          hasDiscount: res.rows.item(i).has_discount == "true" ? true : false,
          discountComment: res.rows.item(i).discount_comment == "" ? null : res.rows.item(i).discount_comment,
          nuAmountCollectDiscount: res.rows.item(i).nu_amount_collect_discount,
          nuCollectDiscount: res.rows.item(i).nu_collect_discount,
          missingRetention: res.rows.item(i).missing_retention == "true" ? true : false,
          nuAmountCollectDiscountConversion: res.rows.item(i).nu_amount_collect_discount_conversion,
          collectionDetailDiscounts: [] as CollectionDetailDiscounts[],
        })
      }
      return collectionDetails;
    }).catch(e => {
      let collectionDetails: CollectionDetail[] = [];
      console.log(e);
      return collectionDetails;
    })
  }

  getCollectionDetailsDiscounts(dbServ: SQLiteObject, coCollection: string) {
    return dbServ.executeSql(
      'SELECT * FROM collection_detail_discounts WHERE co_collection = ?',
      [coCollection]).then(res => {
        let CollectionDetailDiscounts: CollectionDetailDiscounts[] = [];
        for (var i = 0; i < res.rows.length; i++) {
          CollectionDetailDiscounts.push({
            idCollectionDetailDiscount: res.rows.item(i).id_collection_detail_discount,
            idCollectionDetail: res.rows.item(i).id_collection_detail,
            idCollectDiscount: res.rows.item(i).id_collect_discount,
            nuCollectDiscountOther: res.rows.item(i).nu_collect_discount_other == undefined ? null : res.rows.item(i).nu_collect_discount_other,
            naCollectDiscountOther: res.rows.item(i).na_collect_discount_other == undefined ? null : res.rows.item(i).na_collect_discount_other,
            coCollection: res.rows.item(i).co_collection,
            coDocument: res.rows.item(i).co_document,
            nuAmountCollectDiscountOther: res.rows.item(i).nu_amount_collect_discount_other == undefined ? null : res.rows.item(i).nu_amount_collect_discount_other,
            nuAmountCollectDiscountOtherConversion: res.rows.item(i).nu_amount_collect_discount_other_conversion == undefined ? null : res.rows.item(i).nu_amount_collect_discount_other_conversion,
            posicion: res.rows.item(i).posicion == undefined ? null : res.rows.item(i).posicion,
          })
        }
        return CollectionDetailDiscounts;
      }).catch(e => {
        let collectionDetails: CollectionDetail[] = [];
        console.log(e);
        return collectionDetails;
      })
  }

  getCollectionPayments(dbServ: SQLiteObject, coCollection: string) {
    return dbServ.executeSql(
      'SELECT * FROM collection_payments WHERE co_collection = ?', [coCollection
    ]).then(res => {
      let collectionPayments: CollectionPayment[] = [];
      let daCollectionPayment = null;
      let daValue = null;
      for (var i = 0; i < res.rows.length; i++) {
        /* if (res.rows.item(i).da_collection_payment.split("T").length > 1) {
          daCollectionPayment = res.rows.item(i).da_collection_payment.split("T")[0] + " " + res.rows.item(i).da_collection_payment.split("T")[1]
        }
        if (res.rows.item(i).da_value.split("T").length > 1) {
          daValue = res.rows.item(i).da_value.split("T")[0] + " " + res.rows.item(i).da_value.split("T")[1]
        } */

        collectionPayments.push({
          //idCollectionPayment: null,
          /* idCollection: res.rows.item(i).id_collection, */
          coCollection: res.rows.item(i).co_collection,
          idCollectionDetail: res.rows.item(i).id_collection_detail,
          coPaymentMethod: res.rows.item(i).co_payment_method,
          idBank: res.rows.item(i).id_bank,
          nuPaymentDoc: res.rows.item(i).nu_payment_doc,
          naBank: res.rows.item(i).na_bank,
          coClientBankAccount: res.rows.item(i).co_client_bank_account,
          nuClientBankAccount: res.rows.item(i).nu_client_bank_account,
          //daValue: daValue,
          //daCollectionPayment: daCollectionPayment,
          daValue: res.rows.item(i).da_value,
          daCollectionPayment: res.rows.item(i).da_collection_payment,
          nuCollectionPayment: res.rows.item(i).nu_client_bank_account,
          newNuClientBankAccount: res.rows.item(i).newNuClientBankAccount,
          nuAmountPartial: res.rows.item(i).nu_amount_partial,
          nuAmountPartialConversion: res.rows.item(i).nu_amount_partial_conversion,
          coType: res.rows.item(i).co_type,
          st: 0,
          isSave: true,
          isAnticipoPrepaid: false,
          idDifferenceCode: this.enableDifferenceCodes ? res.rows.item(i).id_difference_code : 0,
          coDifferenceCode: this.enableDifferenceCodes ? res.rows.item(i).co_difference_code : "",
          nuBankAccount: res.rows.item(i).nu_bank_account,
          idTypeDocument: res.rows.item(i).id_type_document,
          nuDocument: res.rows.item(i).nu_document,
          idCodePhoneNumber: res.rows.item(i).id_code_phone_number ?? res.rows.item(i).id_code_phone_number,
          nuPhoneNumber: res.rows.item(i).nu_phone_number ?? res.rows.item(i).nu_phone_number,


        })
      }
      return collectionPayments;

    }).catch(e => {
      let collectionPayments: CollectionPayment[] = [];
      console.log(e);
      return collectionPayments;
    })
  }

  async findCollect(dbServ: SQLiteObject) {
    try {
      console.time('[findCollect] total');
      const start = Date.now();
      this.listCollect = [] as Collection[];
      this.itemListaCobros = [] as ItemListaCobros[];
      const res = await dbServ.executeSql(
        //'SELECT c.* FROM collections c ORDER BY c.st_delivery ASC, c.st_collection ASC,  c.da_collection ASC, c.id_collection DESC;', []
        'SELECT c.* FROM collections c ORDER BY c.st_delivery DESC, c.da_collection DESC, c.st_collection ASC, c.id_collection DESC; ', []
      );

      const promises: Promise<void>[] = [];

      for (let i = 0; i < res.rows.length; i++) {
        let respCollect = {} as Collection;
        respCollect.idCollection = res.rows.item(i).id_collection;
        respCollect.coCollection = res.rows.item(i).co_collection;
        respCollect.coOriginalCollection = res.rows.item(i).co_original_collection;
        respCollect.daCollection = res.rows.item(i).da_collection;
        respCollect.daRate = res.rows.item(i).da_rate;
        respCollect.naResponsible = res.rows.item(i).na_responsible;
        respCollect.coCurrency = res.rows.item(i).co_currency;
        respCollect.coType = res.rows.item(i).co_type;
        respCollect.txComment = res.rows.item(i).tx_comment;
        respCollect.lbClient = res.rows.item(i).lb_client;
        respCollect.idClient = res.rows.item(i).id_client;
        respCollect.coClient = res.rows.item(i).co_client;
        respCollect.idEnterprise = res.rows.item(i).id_enterprise;
        respCollect.coEnterprise = res.rows.item(i).co_enterprise;
        respCollect.stCollection = res.rows.item(i).st_collection;
        respCollect.stDelivery = res.rows.item(i).st_delivery == null ? 1 : res.rows.item(i).st_delivery;
        respCollect.isEdit = 0;
        respCollect.isEditTotal = 0;
        respCollect.isSave = 1;
        respCollect.nuValueLocal = res.rows.item(i).nu_value_local;
        respCollect.idCurrency = res.rows.item(i).id_currency;
        respCollect.txConversion = res.rows.item(i).tx_conversion;
        respCollect.nuAmountTotal = res.rows.item(i).nu_amount_total;
        respCollect.nuAmountTotalConversion = res.rows.item(i).nu_amount_total_conversion;
        respCollect.nuDifference = res.rows.item(i).nu_difference;
        respCollect.nuDifferenceConversion = res.rows.item(i).nu_difference_conversion;
        respCollect.nuIgtf = res.rows.item(i).nu_igtf;
        respCollect.nuAmountFinal = res.rows.item(i).nu_amount_final;
        respCollect.nuAmountFinalConversion = res.rows.item(i).nu_amount_final_conversion;
        respCollect.nuAmountIgtf = res.rows.item(i).nu_amount_igtf;
        respCollect.nuAmountIgtfConversion = res.rows.item(i).nu_amount_igtf_conversion;
        respCollect.nuAmountPaid = res.rows.item(i).nu_amount_paid;
        respCollect.nuAmountPaidConversion = res.rows.item(i).nu_amount_paid_conversion;
        respCollect.hasIGTF = res.rows.item(i).hasIGTF;
        respCollect.document = {} as DocumentSale;
        respCollect.coordenada = res.rows.item(i).coordenada;
        this.listCollect.push(respCollect);

        let item = res.rows.item(i);

        // Agrega la promesa al array antes del then
        const p = this.historyTransaction.getStatusTransaction(dbServ, 3, item.id_collection).then(data => {
          let itemListaCobro = {} as ItemListaCobros;
          itemListaCobro.id_collection = item.id_collection;
          itemListaCobro.co_collection = item.co_collection;
          itemListaCobro.co_client = item.co_client;
          itemListaCobro.lb_client = item.lb_client;
          itemListaCobro.st_collection = item.st_collection;
          itemListaCobro.st_delivery = item.st_delivery;
          itemListaCobro.da_collection = item.da_collection;
          itemListaCobro.na_status = data.na_status;
          itemListaCobro.co_type = item.co_type;
          itemListaCobro.tx_comment = data.tx_comment;

          this.itemListaCobros.push(itemListaCobro);
        }).catch(err => {
          console.error('[findCollect] getStatusTransaction error for id:', item.id_collection, err);
        });
        promises.push(p);
      }

      const mid = Date.now();
      console.log('[findCollect] queries prepared:', promises.length, 'rows:', res.rows.length, 'ms_prepare:', mid - start);

      await Promise.all(promises);

      const end = Date.now();
      console.log('[findCollect] finished. total_ms:', end - start);
      console.timeEnd('[findCollect] total');

      return this.itemListaCobros;
    } catch (err) {
      console.error('[findCollect] error:', err);
      return this.itemListaCobros;
    }
  }

  //var updateStatement = 'UPDATE document_st SET st_document = 0 where co_document in (SELECT co_document FROM collection_details where co_collection= ?)';

  updateDocumentStForDelete(dbServ: SQLiteObject, coCollection: string) {
    return dbServ.executeSql(
      "UPDATE document_st SET st_document = 0 WHERE co_document IN " +
      "(SELECT co_document FROM collection_details WHERE co_collection = ?)", [coCollection]).then(res => {
        return Promise.resolve(true);
      }).catch(e => {
        return Promise.resolve(true);
      })
  }

  deleteCollection(dbServ: SQLiteObject, coCollection: string) {
    return dbServ.executeSql(
      "DELETE FROM collections WHERE co_collection = ?", [coCollection]).then(res => {
        this.updateDocumentStForDelete(dbServ, coCollection).then(resp => {
          this.deleteCollectionDetails(dbServ, coCollection);
        })
        return Promise.resolve(true);
      }).catch(e => {
        let collection = {} as Collection;
        console.log(e);
        return Promise.resolve(true);
      })
  }

  deleteCollectionDetails(dbServ: SQLiteObject, coCollection: string) {
    return dbServ.executeSql(
      "DELETE FROM collection_details WHERE co_collection = ?", [coCollection]).then(res => {
        this.deleteCollectionPayments(dbServ, coCollection);
        return Promise.resolve(true);
      }).catch(e => {
        let collection = {} as Collection;
        console.log(e);
        return Promise.resolve(true);
      })
  }
  deleteCollectionPayments(dbServ: SQLiteObject, coCollection: string) {
    return dbServ.executeSql(
      "DELETE FROM collection_payments WHERE co_collection = ?", [coCollection]).then(res => {
        return Promise.resolve(true);
      }).catch(e => {
        let collection = {} as Collection;
        console.log(e);
        return Promise.resolve(true);
      })
  }

  getDifferenceCodes(dbServ: SQLiteObject) {
    const selectStatement = 'SELECT * FROM difference_codes';
    return dbServ.executeSql(selectStatement, []).then(res => {
      this.differenceCode = [] as DifferenceCode[];
      for (var i = 0; i < res.rows.length; i++) {
        this.differenceCode.push({
          idDifferenceCode: res.rows.item(i).id_difference_code,
          coDifferenceCode: res.rows.item(i).co_difference_code,
          naDifferenceCode: res.rows.item(i).na_difference_code,
          txDescription: res.rows.item(i).tx_description
        })
      }
      return Promise.resolve(true);
    }).catch(e => {

      return Promise.resolve(true);
    })
  }

  getCollectDiscounts(dbServ: SQLiteObject, idEnterprise: number) {
    const selectStatement =
      'SELECT * FROM collect_discounts WHERE id_enterprise = ? ORDER BY nu_collect_discount ASC';
    return dbServ.executeSql(selectStatement, [idEnterprise]).then(res => {
      this.collectDiscounts = [] as CollectDiscounts[];
      for (var i = 0; i < res.rows.length; i++) {
        const row = res.rows.item(i);
        const idEntRaw = row.id_enterprise;
        const idEntParsed =
          idEntRaw === undefined || idEntRaw === null ? null : Number(idEntRaw);
        this.collectDiscounts.push({
          idCollectDiscount: row.id_collect_discount,
          nuCollectDiscount: row.nu_collect_discount,
          naCollectDiscount: row.na_collect_discount,
          requireInput: row.require_input == "true" ? true : false,
          nuAmountCollectDiscount: 0,
          nuAmountCollectDiscountConversion: 0,
          position: 0,
          idEnterprise: idEntParsed,
        })
      }
      return Promise.resolve(true);
    }).catch(e => {

      return Promise.resolve(true);
    })
  }

  loadTypeDocumentList(dbServ: SQLiteObject, forceReload: boolean = false) {
    if (this.typeDocumentListLoaded && !forceReload) {
      return Promise.resolve(this.typeDocumentList);
    }

    return this.getTypeDocument(dbServ).then((list: TypeDocument[]) => {
      this.typeDocumentList = list || [];
      this.typeDocumentListLoaded = true;

      if (this.typeDocumentList.length > 0) {
        const defaultType = this.typeDocumentList[0].coTypeDocument;
        this.pagoMovil.forEach(pm => {
          if (!pm.tipoDocumento) {
            pm.tipoDocumento = defaultType as any;
          }
        });
      }

      return Promise.resolve(this.typeDocumentList);
    }).catch(e => {
      console.log(e);
      this.typeDocumentList = [];
      return Promise.resolve(this.typeDocumentList);
    })
  }

  getTypeDocument(dbServ: SQLiteObject, idTypeDocument?: number) {
    let selectStatement = 'SELECT * FROM type_document';
    const params: any[] = [];

    if (idTypeDocument != null) {
      selectStatement += ' WHERE id_type_document = ?';
      params.push(idTypeDocument);
    }

    selectStatement += ' ORDER BY id_type_document ASC';

    return dbServ.executeSql(selectStatement, params).then(res => {
      let typeDocuments: TypeDocument[] = [];
      for (var i = 0; i < res.rows.length; i++) {
        typeDocuments.push({
          idTypeDocument: res.rows.item(i).id_type_document,
          coTypeDocument: res.rows.item(i).co_type_document,
          naTypeDocument: res.rows.item(i).na_type_document,
        } as TypeDocument)
      }
      return Promise.resolve(typeDocuments);
    }).catch(e => {
      console.log(e);
      return Promise.resolve([] as TypeDocument[]);
    })
  }

  loadCodePhoneNumberList(dbServ: SQLiteObject, forceReload: boolean = false) {
    if (this.codePhoneNumberListLoaded && !forceReload) {
      return Promise.resolve(this.codePhoneNumberList);
    }

    return this.getCodePhoneNumber(dbServ).then((list: CodePhoneNumber[]) => {
      this.codePhoneNumberList = list || [];
      this.codePhoneNumberListLoaded = true;

      if (this.codePhoneNumberList.length > 0) {
        const defaultCode = this.codePhoneNumberList[0].coCodePhoneNumber;
        this.pagoMovil.forEach(pm => {
          if (!pm.codigoTelefono) {
            pm.codigoTelefono = defaultCode as any;
          }
        });
      }

      return Promise.resolve(this.codePhoneNumberList);
    }).catch(e => {
      console.log(e);
      this.codePhoneNumberList = [];
      return Promise.resolve(this.codePhoneNumberList);
    })
  }

  getCodePhoneNumber(dbServ: SQLiteObject, idCodePhoneNumber?: number) {
    let selectStatement = 'SELECT * FROM code_phone_number';
    const params: any[] = [];

    if (idCodePhoneNumber != null) {
      selectStatement += ' WHERE id_code_phone_number = ?';
      params.push(idCodePhoneNumber);
    }

    selectStatement += ' ORDER BY id_code_phone_number ASC';

    return dbServ.executeSql(selectStatement, params).then(res => {
      let codePhoneNumbers: CodePhoneNumber[] = [];
      for (var i = 0; i < res.rows.length; i++) {
        codePhoneNumbers.push({
          idCodePhoneNumber: res.rows.item(i).id_code_phone_number,
          coCodePhoneNumber: res.rows.item(i).co_code_phone_number,
          naCodePhoneNumber: res.rows.item(i).na_code_phone_number,
        } as CodePhoneNumber)
      }
      return Promise.resolve(codePhoneNumbers);
    }).catch(e => {
      console.log(e);
      return Promise.resolve([] as CodePhoneNumber[]);
    })
  }




  ///////////////////QUERYS////////////////
}
