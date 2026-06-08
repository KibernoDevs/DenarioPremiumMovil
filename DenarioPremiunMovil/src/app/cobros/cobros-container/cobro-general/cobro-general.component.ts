//CAPACTIOR IONIC
import { Component, EventEmitter, OnInit, Output, inject, ViewChild, Input, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs/internal/Subscription';
import { ClienteSelectorComponent } from '../../../cliente-selector/cliente-selector.component';
import { Client } from 'src/app/modelos/tables/client';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { CollectionDetail, CollectionPayment } from 'src/app/modelos/tables/collection';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { Currencies } from 'src/app/modelos/tables/currencies';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { ConversionType } from 'src/app/modelos/tables/conversionType';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { MessageService } from 'src/app/services/messageService/message.service';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { COLOR_VERDE } from 'src/app/utils/appConstants';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { ClientesDatabaseServicesService } from 'src/app/services/clientes/clientes-database-services.service';
import { PagoEfectivo } from 'src/app/modelos/pago-efectivo';
import { PagoTransferencia } from 'src/app/modelos/pago-transferencia';
import { PagoDeposito } from 'src/app/modelos/pago-deposito';
import { PagoCheque } from 'src/app/modelos/pago-cheque';
import { PagoOtros } from 'src/app/modelos/pago-otros';
import { PagoMovil } from 'src/app/modelos/pago-movil';
import { IonInput } from '@ionic/angular/directives/proxies';
import { ClienteSelectorService } from 'src/app/cliente-selector/cliente-selector.service';
import { BankAccount } from 'src/app/modelos/tables/bankAccount';
import { BancoReceptor } from 'src/app/modelos/bancoReceptor';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';


@Component({
  selector: 'app-cobro-general',
  templateUrl: './cobro-general.component.html',
  styleUrls: ['./cobro-general.component.scss'],
  standalone: false
})
export class CobrosGeneralComponent implements OnInit {

  @ViewChild('input') input!: IonInput;
  @ViewChild(ClienteSelectorComponent) selectorCliente!: ClienteSelectorComponent;

  private subscriptions: Subscription[] = [];

  // Servicios públicos solo si los usas en el template
  public collectService = inject(CollectionService);
  public dateServ = inject(DateServiceService);

  // Servicios privados
  private enterpriseServ = inject(EnterpriseService);
  private globalConfig = inject(GlobalConfigService);
  private geoServ = inject(GeolocationService);
  public currencyServices = inject(CurrencyService);
  private messageService = inject(MessageService);
  private clientService = inject(ClientesDatabaseServicesService);
  private adjuntoService = inject(AdjuntoService);
  public synchronizationServices = inject(SynchronizationDBService);

  // Variables públicas solo si las usas en el template
  public segment = 'default';
  public cobroValid: Boolean = false;
  public viewOnly: boolean = false;
  public changeRate: Boolean = false;
  public dateCollect: string = this.dateServ.hoyISOFullTime();
  public dateRate: string = this.dateServ.hoyISO();
  public multiCurrency: Boolean = false;
  public mensaje: string = '';
  public currencySelected!: Currencies;
  public showDateRateModal: boolean = false;

  // Variables privadas
  private mapFechas = new Map<string, ConversionType>([]);
  private messageAlert!: MessageAlert;
  private coordenadas: string = "";

  public manualRateError: string = '';
  private lastManualRateValue: number = 0;
  private pendingDateRateVisual: string = '';

  public alertButtons = [
    { text: '', role: 'confirm' },
  ];
  public alertButtonsSend = [
    { text: '', role: 'cancel' },
    { text: '', role: 'confirm' },
  ];

  constructor(private clientSelectorService: ClienteSelectorService) { }

  async ngOnInit() {
    await Promise.all([
      this.collectService.loadTypeDocumentList(this.synchronizationServices.getDatabase()),
      this.collectService.loadCodePhoneNumberList(this.synchronizationServices.getDatabase())
    ]);

    // Si el cobro no es nuevo y tiene tasa guardada, mostrar esa tasa en el input manual.
    if (this.collectService.enabledManualRate) {
      const savedRate = Number(this.collectService?.collection?.nuValueLocal ?? 0);
      const isExistingCollection = Number(this.collectService?.collection?.stCollection ?? 0) !== this.collectService.COLLECT_STATUS_NEW
        || Number(this.collectService?.collection?.stDelivery ?? 0) !== this.collectService.COLLECT_STATUS_NEW
        || !!(this.collectService?.collection?.coCollection && this.collectService.collection.coCollection.trim().length > 0);
      const useSavedRate = isExistingCollection && Number.isFinite(savedRate) && savedRate > 0;

      if (useSavedRate) {
        this.collectService.rateSelected = savedRate;
        this.lastManualRateValue = savedRate;
      } else if (!this.collectService.rateSelected || this.collectService.rateSelected === 0) {
        this.collectService.rateSelected = this.lastRateValue;
        this.lastManualRateValue = this.lastRateValue;
      } else {
        // Mantener la tasa manual ya ingresada
        this.lastManualRateValue = this.collectService.rateSelected;
      }
    }

    if (this.collectService.collection.stDelivery == this.collectService.COLLECT_STATUS_TO_SEND || this.collectService.collection.stDelivery == this.collectService.COLLECT_STATUS_SENT || this.collectService.collection.stDelivery == 6) {
      //ES UN COBRO ENVIADO, NO DEBO HACER NADA, SOLO MOSTRAR LA DATA

      this.setSendedCollection();
    } else {
      this.subscriptions.push(
        this.clientSelectorService.ClientChanged.subscribe(client => {
          this.clientSelectorService.checkClient = false;
          this.collectService.client = client;
          this.collectService.initCollect = true;
          this.collectService.changeClient = true;
          this.collectService.onChangeClient = true;
          this.collectService.cobroValid = true;
          void this.reset(client);
        }),
        this.adjuntoService.AttachmentChanged.subscribe(() => {
          this.setChangesMade(true);
        })
      );

      this.initGeneralState();
    }
  }

  public setSendedCollection() {
    this.collectService.getCurrencies(this.synchronizationServices.getDatabase(), this.collectService.enterpriseSelected.idEnterprise);

    this.collectService.initLogicService();
    this.collectService.onCollectionValid(true);
    this.collectService.cobroValid = true;
    this.collectService.collectValidTabs = true;
    this.collectService.enterpriseEnabled = false;
    this.collectService.montoTotalPagar = this.collectService.collection.nuAmountFinal;
    this.collectService.montoTotalPagarConversion = this.collectService.collection.nuAmountFinalConversion;
    this.collectService.montoTotalPagado = this.collectService.collection.nuAmountTotal;
    this.collectService.montoTotalPagadoConversion = this.collectService.collection.nuAmountTotalConversion;
    this.dateCollect = this.collectService.collection.daCollection;
    this.collectService.disabledInputClient = true;
    this.collectService.rateSelected = this.collectService.collection.nuValueLocal;
    this.rateSelected = this.collectService.collection.nuValueLocal;

    this.initializeCurrenciesAndRates();
    this.collectService.loadPaymentMethods();
    this.loadPayments();
    this.clientService.getClientById(this.collectService.collection.idClient).then(client => {
      this.collectService.client = client;
      this.adjuntoService.setup(this.synchronizationServices.getDatabase(), this.globalConfig.get("signatureCollection") == "true", true, COLOR_VERDE);
      this.adjuntoService.getSavedPhotos(this.synchronizationServices.getDatabase(), this.collectService.collection.coCollection, 'cobros');
      this.selectorCliente.setup(this.collectService.enterpriseSelected.idEnterprise, "Cobros", 'fondoVerde', client, false, 'cob');

      if (!this.collectService.igtfList?.length)
        this.collectService.getIgtfList(this.synchronizationServices.getDatabase());

      this.collectService.changeEnterprise = false;

    });
  }

  private initGeneralState() {
    this.collectService.recentOpenCollect = false;
    this.messageService.hideLoading();
    this.collectService.alertMessageOpen = false;
    this.initializeCurrenciesAndRates();
    this.alertButtonsSend[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_CANCELAR')!
    this.alertButtonsSend[1].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
    this.collectService.requiredComment = this.globalConfig.get('requiredComment') === 'true';
    this.collectService.validComment = !this.collectService.requiredComment;

    if (this.collectService.isOpenCollect) {
      this.handleOpenCollect();
    } else if (this.collectService.initCollect) {
      this.handleInitCollect();
    } else {
      this.collectService.cobroValid = true;
    }
  }

  private handleOpenCollect() {
    this.collectService.isOpenCollect = false;
    this.collectService.recentOpenCollect = true;
    //this.collectService.disabledCurrency = true;
    this.collectService.cobroValid = true;

    if (Number(this.collectService.collection.stDelivery) == this.collectService.COLLECT_STATUS_SAVED) {
      this.adjuntoService.setup(this.synchronizationServices.getDatabase(), this.globalConfig.get("signatureCollection") == "true", false, COLOR_VERDE);
      this.adjuntoService.getSavedPhotos(this.synchronizationServices.getDatabase(), this.collectService.collection.coCollection, 'cobros');
      if (Number(this.collectService.collection.stDelivery) === this.collectService.COLLECT_STATUS_SENT)
        this.collectService.onCollectionValid(true);
    }

    this.dateCollect = this.collectService.collection.daCollection;
    this.clientService.getClientById(this.collectService.collection.idClient).then(client => {
      this.collectService.client = client;
      this.selectorCliente.setup(this.collectService.enterpriseSelected.idEnterprise, "Cobros", 'fondoVerde', client, false, 'cob');

      this.collectService.loadPaymentMethods();
      this.collectService.initLogicService();
      this.loadDataMaster();
      this.collectService.enterpriseEnabled = true;
      this.collectService.disabledClient = true;
      this.collectService.initCollect = false;
      this.collectService.unlockTabs().then((resp) => {
        this.collectService.onCollectionValid(resp);
      });

      if (this.collectService.enableDifferenceCodes) {
        this.collectService.getDifferenceCodes(this.synchronizationServices.getDatabase())
          .then(() => {
            // una vez cargados los difference codes, vincula los pagos 'otros'
            this.collectService.syncPagoOtrosDifferenceCodes();
          })
          .catch(err => console.error('getDifferenceCodes error', err));
      }

      this.collectService.changeEnterprise = false;
      if (this.collectService.currencySelectedDocument == null || this.collectService.currencySelectedDocument == undefined) {
        this.collectService.currencySelectedDocument = this.collectService.currencyListDocument[0];

      }


    });

    this.collectService.validateReferencePayment();
  }

  private handleInitCollect() {
    this.clientSelectorService.checkClient = true;
    this.alertButtons[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!;
    this.initCollection();
    this.adjuntoService.setup(this.synchronizationServices.getDatabase(), this.globalConfig.get("signatureCollection") == "true", this.viewOnly, COLOR_VERDE);
    this.collectService.loadPaymentMethods();
    this.collectService.initLogicService();

    if (this.collectService.enableDifferenceCodes) {
      this.collectService.getDifferenceCodes(this.synchronizationServices.getDatabase())
        .then(() => {
          // una vez cargados los difference codes, vincula los pagos 'otros'
          this.collectService.syncPagoOtrosDifferenceCodes();
        })
        .catch(err => console.error('getDifferenceCodes error', err));
    }

  }

  private initializeCurrenciesAndRates() {
    this.collectService.localCurrency = this.currencyServices.getLocalCurrency();
    this.collectService.hardCurrency = this.currencyServices.getHardCurrency();
  }

  private initializeCollectionData(client: Client) {
    this.collectService.collection = this.collectService.initCollection(this.collectService.collection);
    this.collectService.collection.coCollection = this.dateServ.generateCO(0);
    this.collectService.collection.idEnterprise = this.collectService.enterpriseSelected.idEnterprise;
    this.collectService.collection.coEnterprise = this.collectService.enterpriseSelected.coEnterprise;
    this.collectService.collection.coordenada = this.coordenadas;
    this.collectService.collection.daCollection = this.dateCollect;
    this.collectService.client = client;
    this.collectService.nameClient = client.lbClient;
    this.collectService.collection.idClient = client.idClient;
    this.collectService.collection.coClient = client.coClient;
    this.collectService.collection.lbClient = client.lbClient;
  }

  private updateSelectedEnterprise(idEnterprise: number) {
    const empresa = this.collectService.enterpriseList.find(e => e.idEnterprise === idEnterprise);
    if (empresa) {
      this.collectService.enterpriseSelected = empresa;
    }
  }

  private updateSelectedCurrency(idCurrency: number) {
    const moneda = this.collectService.currencyList.find(c => c.idCurrency === idCurrency);
    if (moneda) {
      this.collectService.currencySelected = moneda;
    }
  }

  private updateSelectedIgtf(price: number) {
    const igtf = this.collectService.igtfList.find(i => i.price == price);
    if (igtf) {
      this.collectService.igtfSelected = igtf;
    }
  }

  private getAllDocumentsCurrency(): string {
    return this.collectService.currencyListDocument[0]?.coCurrency || 'Moneda';
  }

  private resetDocumentCurrencyFilter(): void {
    this.collectService.currencySelectedDocument = this.collectService.currencyListDocument[0];
    this.collectService.documentCurrency = this.getAllDocumentsCurrency();
  }

  private getDocumentSalesFirstPageOptions(): { limit: number; offset: number; includeSelected: boolean } {
    const limit = this.collectService.DOCUMENT_SALES_PAGE_SIZE;
    this.collectService.documentSalesPageSize = limit;
    this.collectService.documentSalesCurrentPage = 0;

    return {
      limit,
      offset: 0,
      includeSelected: true
    };
  }

  private loadAllDocumentsSales(): Promise<void> {
    return this.collectService.getDocumentsSales(
      this.synchronizationServices.getDatabase(),
      this.collectService.collection.idClient,
      this.getAllDocumentsCurrency(),
      this.collectService.collection.coCollection,
      this.collectService.collection.idEnterprise,
      this.getDocumentSalesFirstPageOptions()
    ).then(() => {
      this.collectService.getDateRate(this.synchronizationServices.getDatabase(), this.collectService.dateRateVisual);
      if (this.collectService.historicPartialPayment) {
        this.collectService.findIsPaymentPartial(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);
      }
      this.collectService.findIsMissingRetention(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);
    });
  }

  async reset(client: Client) {
    this.clientSelectorService.checkClient = true;
    this.collectService.initCollect = false;
    this.alertButtons[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!;
    await this.collectService.loadPaymentMethods();
    await this.collectService.initLogicService();
    this.collectService.enterpriseList = this.enterpriseServ.empresas;
    this.collectService.getCurrencies(this.synchronizationServices.getDatabase(),
      this.collectService.enterpriseSelected.idEnterprise);
    this.initializeCollectionData(client);
    //this.selectorCliente.updateClientList(this.collectService.enterpriseSelected.idEnterprise);
    //this.selectorCliente.setup(this.collectService.enterpriseSelected.idEnterprise, "Cobros", 'fondoVerde', client, true, 'cob');

    if (this.collectService.historicoTasa)
      this.collectService.getTasasHistorico(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise)
        .then(() => {

        });
    this.initializeCurrenciesAndRates();
    if (!this.collectService.igtfList?.length)
      this.collectService.getIgtfList(this.synchronizationServices.getDatabase());
    this.loadData();
  }

  print() {
    console.log(this.collectService.collection);
  }

  loadDataMaster() {
    this.initializeCurrenciesAndRates();
    this.enterpriseServ.setup(this.synchronizationServices.getDatabase()).then(() => {
      this.collectService.enterpriseList = this.enterpriseServ.empresas;
      this.updateSelectedEnterprise(this.collectService.collection.idEnterprise);
      this.collectService.getCurrencies(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise).then(() => {
        const savedRate = Number(this.collectService?.collection?.nuValueLocal ?? 0);
        const isExistingCollection = Number(this.collectService?.collection?.stCollection ?? 0) !== this.collectService.COLLECT_STATUS_NEW
          || Number(this.collectService?.collection?.stDelivery ?? 0) !== this.collectService.COLLECT_STATUS_NEW
          || !!(this.collectService?.collection?.coCollection && this.collectService.collection.coCollection.trim().length > 0);
        const useSavedManualRate = this.collectService.enabledManualRate
          && isExistingCollection
          && Number.isFinite(savedRate)
          && savedRate > 0;

        if (useSavedManualRate) {
          this.collectService.rateSelected = savedRate;
          this.lastManualRateValue = savedRate;
        } else if (this.collectService.historicoTasa) {
          this.collectService.getTasasHistorico(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise)
            .then(() => {
              this.collectService.getDateRate(
                this.synchronizationServices.getDatabase(),
                this.collectService.collection.daRate
              );
            });
        }

        this.collectService.getDocumentsSales(
          this.synchronizationServices.getDatabase(),
          this.collectService.collection.idClient,
          this.getAllDocumentsCurrency(),
          this.collectService.collection.coCollection,
          this.collectService.collection.idEnterprise,
          this.getDocumentSalesFirstPageOptions()
        ).then(() => {
          if (this.collectService.historicPartialPayment) {
            this.collectService.findIsPaymentPartial(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);
          }
          this.collectService.findIsMissingRetention(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);

        });
        this.updateSelectedCurrency(this.collectService.collection.idCurrency);
        //this.collectService.disabledCurrency = true;
        this.collectService.getIgtfList(this.synchronizationServices.getDatabase()).then(() => {
          this.updateSelectedIgtf(this.collectService.collection.nuIgtf);
        });


        this.loadData();
      });
    });
  }

  loadPayments() {
    const payments = this.collectService.collection.collectionPayments;
    const bankAccounts = this.collectService.listBankAccounts;
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      switch (payment.coPaymentMethod) {
        case 'ef': {
          const newPagoEfectivo: PagoEfectivo = {
            monto: payment.nuAmountPartial,
            montoConversion: payment.nuAmountPartialConversion,
            nuRecibo: payment.nuPaymentDoc,
            fecha: payment.daValue!,
            posCollectionPayment: i,
            type: "ef",
            anticipoPrepaid: payment.isAnticipoPrepaid,
            disabled: false,
            showDateModal: false,
          };
          this.collectService.pagoEfectivo.push(newPagoEfectivo);
          break;
        }
        case 'tr': {
          const newPagoTransferencia: PagoTransferencia = {
            idBanco: payment.idBank,
            nombreBanco: payment.naBank,
            numeroTransferencia: payment.nuPaymentDoc,
            numeroCuenta: payment.nuClientBankAccount,
            numeroCuentaCliente: payment.newNuClientBankAccount,
            monto: payment.nuAmountPartial,
            montoConversion: payment.nuAmountPartialConversion,
            fecha: payment.daValue!,
            nuevaCuenta: payment.newNuClientBankAccount,
            posCollectionPayment: i,
            type: "tr",
            anticipoPrepaid: payment.isAnticipoPrepaid,
            disabled: false,
            bancoReceptor: this.getBancoReceptor(payment.nuClientBankAccount),
            showDateModal: false,
            showNuevaCuenta: false,
          };
          const cuenta = bankAccounts.find(b => b.idBank == newPagoTransferencia.idBanco);
          if (cuenta) {
            this.collectService.bankAccountSelected[newPagoTransferencia.posCollectionPayment] = cuenta;
            newPagoTransferencia.disabled = false;
          }
          this.collectService.pagoTransferencia.push(newPagoTransferencia);
          break;
        }
        case 'pm': {
          const fallbackType = this.collectService.typeDocumentList[0]?.coTypeDocument || 'V';
          const fallbackPhoneCode = this.collectService.codePhoneNumberList[0]?.coCodePhoneNumber || '0414';
          const rawLegacyDocument = (payment.coClientBankAccount || '').trim();
          const legacyDocumentParts = rawLegacyDocument.split('-');
          const rawPhone = (payment.nuPhoneNumber || '').replace(/\D/g, '');
          const typeById = this.collectService.typeDocumentList.find(
            typeDocument => typeDocument.idTypeDocument === payment.idTypeDocument
          );
          const phoneCodeById = this.collectService.codePhoneNumberList.find(
            codePhoneNumber => codePhoneNumber.idCodePhoneNumber === payment.idCodePhoneNumber
          );
          const phoneCodeByPrefix = this.collectService.codePhoneNumberList.find(
            codePhoneNumber => rawPhone.startsWith(codePhoneNumber.coCodePhoneNumber)
          );
          const selectedPhoneCode = phoneCodeById?.coCodePhoneNumber
            || phoneCodeByPrefix?.coCodePhoneNumber
            || fallbackPhoneCode;
          const phoneNumber = payment.nuPhoneNumber
            ? (phoneCodeByPrefix ? rawPhone.slice(phoneCodeByPrefix.coCodePhoneNumber.length) : rawPhone)
            : '';
          const newPagoMovil: PagoMovil = {
            idBancoEmisor: 0,
            nombreBancoEmisor: '',
            idBancoDestino: payment.idBank,
            nombreBancoDestino: payment.naBank,
            numeroCuentaDestino: payment.nuBankAccount ?? '',
            tipoDocumento: typeById?.coTypeDocument || legacyDocumentParts[0] || fallbackType,
            numeroDocumento: (payment.nuDocument || legacyDocumentParts[1] || '').replace(/\D/g, ''),
            codigoTelefono: selectedPhoneCode,
            numeroTelefono: phoneNumber,
            numeroReferencia: (payment.nuPaymentDoc || '').replace(/\D/g, ''),
            monto: payment.nuAmountPartial,
            montoConversion: payment.nuAmountPartialConversion,
            fecha: payment.daValue!,
            posCollectionPayment: i,
            type: 'pm',
            anticipoPrepaid: payment.isAnticipoPrepaid,
            disabled: false,
            showDateModal: false,
          };

          const bancoEmisor = this.collectService.listBanks?.find(
            b => b.coBank === payment.coClientBankAccount || b.naBank === payment.coClientBankAccount
          );
          if (bancoEmisor) {
            newPagoMovil.idBancoEmisor = bancoEmisor.idBank;
            newPagoMovil.nombreBancoEmisor = bancoEmisor.naBank;
          }

          const bancoDestino = bankAccounts.find(b => b.idBank == newPagoMovil.idBancoDestino && b.nuAccount == newPagoMovil.numeroCuentaDestino);
          if (bancoDestino) {
            this.collectService.clientBankAccountSelected[newPagoMovil.posCollectionPayment] = bancoDestino as any;
          }

          this.collectService.pagoMovil.push(newPagoMovil);
          break;
        }
        case 'de': {
          const newPagoDeposito: PagoDeposito = {
            idBanco: payment.idBank,
            nombreBanco: payment.naBank,
            numeroCuenta: payment.nuClientBankAccount,
            numeroDeposito: payment.nuPaymentDoc,
            fecha: payment.daValue!,
            monto: payment.nuAmountPartial,
            montoConversion: payment.nuAmountPartialConversion,
            posCollectionPayment: i,
            type: "de",
            anticipoPrepaid: payment.isAnticipoPrepaid,
            disabled: false,
            showDateModal: false,
          };
          const cuenta = bankAccounts.find(b => b.idBank == newPagoDeposito.idBanco);
          if (cuenta) {
            this.collectService.bankAccountSelected[newPagoDeposito.posCollectionPayment] = cuenta;
            newPagoDeposito.disabled = false;
          }
          this.collectService.pagoDeposito.push(newPagoDeposito);
          break;
        }
        case 'ch': {
          const newPagoCheque: PagoCheque = {
            idBanco: payment.idBank,
            nombreBanco: payment.naBank,
            fecha: payment.daValue!,
            monto: payment.nuAmountPartial,
            montoConversion: payment.nuAmountPartialConversion,
            fechaValor: payment.daCollectionPayment!,
            numeroCheque: payment.nuPaymentDoc,
            nuevaCuenta: payment.newNuClientBankAccount,
            posCollectionPayment: i,
            type: "ch",
            anticipoPrepaid: payment.isAnticipoPrepaid,
            disabled: false,
            bancoReceptor: new BancoReceptor(),
            showDateVenceModal: false,
            showDateValorModal: false,
            showNuevaCuenta: false,
          };
          this.collectService.pagoCheque.push(newPagoCheque);
          break;
        }
        case 'ot': {
          // intenta encontrar la instancia de DifferenceCode ya cargada
          const selectedDiff = (this.collectService.differenceCode || []).find(dc => dc.idDifferenceCode === payment.idDifferenceCode) ?? null;

          const newPagoOtros: any = {
            nombre: payment.nuPaymentDoc,
            monto: payment.nuAmountPartial,
            montoConversion: payment.nuAmountPartialConversion,
            posCollectionPayment: i,
            type: "ot",
            anticipoPrepaid: payment.isAnticipoPrepaid,
            disabled: false,
            fecha: payment.daValue!,
            showDateModal: false,
            // usa la instancia encontrada (o null)
            differenceCode: selectedDiff
          };
          this.collectService.pagoOtros.push(newPagoOtros);
          break;
        }
      }
    }
    this.collectService.calcularMontos("", 0);
    this.collectService.checkTiposPago();
    this.collectService.validateToSend();
  }

  initCollection() {

    this.collectService.initCollect = false;
    this.collectService.fechaMenor = this.dateServ.hoyISO();
    //this.collectService.fechaMayor = this.dateServ.hoyISO();
    this.collectService.client = {} as Client;
    this.collectService.cobroValid = false;

    this.messageService.showLoading().then(() => {
      this.geoServ.getCurrentPosition().then(coords => {
        if (this.collectService.userMustActivateGPS) {
          //prevenimos que sobreescriba coordenadas con string vacio
          if (coords.length > 0) {
            this.collectService.collection.coordenada = coords
          }
        } else {
          this.collectService.collection.coordenada = coords
        }


      });
      this.enterpriseServ.setup(this.synchronizationServices.getDatabase()).then(() => {

        this.collectService.enterpriseList = this.enterpriseServ.empresas;
        this.messageService.hideLoading();

        //ESTO ES PARA CUANDO CAMBIE DE PESTANAS, RECUPERAR LA INFORMACION YA COLOCADA
        if (this.collectService.newCollect) {
          //ESTOY REALIZANDO UN COBRO DESDE 0
          this.collectService.collection = this.collectService.initCollection(this.collectService.collection);

          if (this.collectService.changeEnterprise) {
            this.collectService.changeEnterprise = false;
          } else {
            this.collectService.enterpriseSelected = this.collectService.enterpriseList[0];
          }
          this.collectService.getCurrencies(this.synchronizationServices.getDatabase(), this.collectService.enterpriseSelected.idEnterprise);


          let nameModule = "Cobros"
          switch (this.collectService.coTypeModule) {
            case "0": {
              console.log("NUEVO COBRO");
              nameModule = this.collectService.collectionTags.get("COB_TYPE_COBRO")!
              break
            }
            case "1": {
              console.log("ANTICIPO")
              nameModule = this.collectService.collectionTags.get("COB_TYPE_ANTICIPO")!
              break
            }
            case "2": {
              console.log("RETENCION");
              nameModule = this.collectService.collectionTags.get("COB_TYPE_RETENCION")!

              break
            }
            case "3": {
              console.log("IGTF")
              nameModule = this.collectService.collectionTags.get("COB_TYPE_IGTF")!
              break;
            }
          }
          this.selectorCliente.setup(this.collectService.enterpriseSelected.idEnterprise, nameModule, 'fondoVerde', null, true, 'cob');
          //this.selectorCliente.updateClientList(this.collectService.enterpriseSelected.idEnterprise);

          this.collectService.collection.coCollection = this.dateServ.generateCO(0);
          this.collectService.collection.idEnterprise = this.collectService.enterpriseSelected.idEnterprise;
          this.collectService.collection.coEnterprise = this.collectService.enterpriseList[0].coEnterprise;
          this.collectService.collection.coordenada = this.coordenadas;

          if (this.collectService.historicoTasa)
            this.collectService.getTasasHistorico(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise)
              .then(() => {

              });
          /* else
            this.collectService.getDocumentsSales(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient, this.collectService.currencySelectedDocument.coCurrency,
              this.collectService.collection.coCollection, this.collectService.collection.idEnterprise).then(() => {
                if (this.collectService.historicPartialPayment) {
                  this.collectService.findIsPaymentPartial(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);
                }
                this.collectService.findIsMissingRetention(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);

              }); */
          // }

          if (this.collectService.igtfList == null || this.collectService.igtfList.length == 0)
            this.collectService.getIgtfList(this.synchronizationServices.getDatabase());



        }

        this.collectService.getCurrencies(this.synchronizationServices.getDatabase(), this.collectService.enterpriseSelected.idEnterprise);
        if (this.collectService.changeClient) {
          this.collectService.alertMessageOpen = false;
          this.collectService.alertMessageChangeCurrency = false;

          this.collectService.client = this.collectService.newClient;
          this.collectService.newClient = {} as Client;
          this.setClientfromSelector(this.collectService.client);
        }

        if (this.collectService.currencySelectedDocument == null || this.collectService.currencySelectedDocument == undefined) {
          this.collectService.currencySelectedDocument = this.collectService.currencyListDocument[0];

        }

      });
    }).catch(e => {
      console.log(e);
      this.messageService.hideLoading();
    })
  }


  setChangesMade(value: boolean) {
    //ESTA FUNCION SE USARA PARA CONTROLAR SI PUEDO ENVIAR O GUARDAR, CVER QUE HAGO ACA
    /* this.collectService.onCollectionValidToSave(true);
    this.collectService.onCollectionValidToSend(true); */
    this.collectService.validateToSend();
  }



  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onEnterpriseSelect() {

    //AL CAMBIAR DE EMPRESA RESETEO TODO
    this.collectService.initCollect = true;

    this.messageService.showLoading().then(() => {
      this.selectorCliente.updateClientList(this.collectService.enterpriseSelected.idEnterprise);
      this.ngOnInit();
      this.collectService.client = {} as Client;
      this.collectService.nameClient = "";
      //luego de seleccionar empresa, buscamos las tasas
      if (this.collectService.historicoTasa)
        this.collectService.getTasasHistorico(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise)
          .then(() => {
            this.collectService.getDateRate(
              this.synchronizationServices.getDatabase(),
              this.collectService.dateRateVisual.split("T")[0]

            );
          });

      if (this.globalConfig.get("requiredComment") === 'false' ? true : false) {
        /* this.collectService.onCollectionValid(true); */
        this.collectService.unlockTabs().then((resp) => {
          this.collectService.onCollectionValid(resp);
        })
      }
      /*   } else {
          this.collectService.cobroValid = false;
          this.collectService.unlockTabs().then((resp) => {
            this.collectService.onCollectionValid(resp);
          })
        } */
      //})

      /* this.collectService.changeEnterprise = false; */
    })


  }

  loadData() {
    this.clientSelectorService.checkClient = true;

    //SE BUSCA LA MONEDA
    this.collectService.getCurrencies(this.synchronizationServices.getDatabase(), this.collectService.enterpriseSelected.idEnterprise).then(r => {

      const savedRate = Number(this.collectService?.collection?.nuValueLocal ?? 0);
      const isExistingCollection = Number(this.collectService?.collection?.stCollection ?? 0) !== this.collectService.COLLECT_STATUS_NEW
        || Number(this.collectService?.collection?.stDelivery ?? 0) !== this.collectService.COLLECT_STATUS_NEW
        || !!(this.collectService?.collection?.coCollection && this.collectService.collection.coCollection.trim().length > 0);
      const useSavedManualRate = this.collectService.enabledManualRate
        && isExistingCollection
        && Number.isFinite(savedRate)
        && savedRate > 0;

      if (this.collectService.collection.stDelivery === this.collectService.COLLECT_STATUS_SENT) {
        this.collectService.rateSelected = this.collectService.collection.nuValueLocal;
        this.lastManualRateValue = this.collectService.collection.nuValueLocal;
        this.collectService.historicoTasa = true;
      } else if (useSavedManualRate) {
        this.collectService.rateSelected = savedRate;
        this.lastManualRateValue = savedRate;
      } else if (this.collectService.historicoTasa) {
        this.collectService.getTasasHistorico(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise)
          .then(() => {
            this.collectService.getDateRate(
              this.synchronizationServices.getDatabase(),
              this.collectService.dateRateVisual.split("T")[0]
            );
          });
      }


      //BUSCAMOS LAS CUENTAS DE BANCOS DEL CLIENTE
      this.collectService.getAllClientBankAccountByEnterprise(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise, this.collectService.collection.coClient).then((result: any[]) => {
        this.collectService.clientBankAccounts = result;

        //BUSCAMOS LOS CUENTAS BANCOS DE LA EMPRESA
        this.collectService.bankAccountSelected = [] as BankAccount[];
        this.collectService.getAllBankAccountsByEnterprise(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise, this.collectService.collection.coCurrency).then(result => {
          this.collectService.listBankAccounts = result;
          this.loadPayments();

          this.collectService.getAllBanks(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise);

          this.collectService.unlockTabs().then((resp) => {
            this.collectService.onCollectionValid(resp);
            if (this.collectService.onChangeClient)
              this.collectService.onChangeClient = false;

            if (this.collectService.collection.stDelivery >= this.collectService.COLLECT_STATUS_TO_SEND) {
              this.collectService.disabledInputClient = true;
              this.collectService.enterpriseEnabled = false;
              //this.collectService.collection.nuValueLocal = 80;
            }

            if (this.collectService.documentCurrency == undefined || this.collectService.documentCurrency == null || this.collectService.documentCurrency == "") {
              this.resetDocumentCurrencyFilter();
            }


            this.collectService.getDocumentsSales(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient,
              this.getAllDocumentsCurrency(), this.collectService.collection.coCollection, this.collectService.collection.idEnterprise,
              this.getDocumentSalesFirstPageOptions()).then(() => {
                if (this.collectService.historicPartialPayment) {
                  this.collectService.findIsPaymentPartial(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);
                }
                if (this.collectService.userCanSelectCollectDiscount) {
                  this.collectService.getCollectDiscounts(
                    this.synchronizationServices.getDatabase(),
                    this.collectService.collection.idEnterprise
                  );
                }
                this.collectService.findIsMissingRetention(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);

              });
          })

          if (this.collectService.requiredComment) {
            if (this.collectService.collection.txComment && this.collectService.collection.txComment.trim().length > 0) {
              this.collectService.validComment = true;
            } else {
              this.collectService.validComment = false;
              this.setFocus()
            }
          }
        })

      })

    })
  }

  setClientfromSelector(client: Client) {
    if (client == undefined) {
      console.log("client vacio");
      this.collectService.nameClient = "";
      return;
    }

    // Si ya está seleccionado el mismo cliente, no hacer nada.
    if (client.idClient == this.collectService.collection.idClient) {
      return;
    }

    // SI ES LA PRIMERA VEZ
    if (this.collectService.collection.idClient == 0) {
      this.clientSelectorService.checkClient = true;
      this.collectService.client = client;
      this.collectService.cobroValid = true;
      this.collectService.nameClient = client.lbClient;
      this.collectService.collection.idClient = client.idClient;
      this.collectService.collection.coClient = client.coClient;
      this.collectService.collection.lbClient = client.lbClient;
      this.collectService.collection.idEnterprise = this.collectService.enterpriseSelected.idEnterprise;
      this.collectService.collection.coEnterprise = this.collectService.enterpriseSelected.coEnterprise;
      this.collectService.collection.daCollection = this.dateCollect;
      this.loadData();
    } else {
      // SE CAMBIO CLIENTE (incluye selección desde resultados del buscador)
      this.clientSelectorService.checkClient = false;
      this.collectService.cobroValid = true;
      void this.reset(client);
    }
  }

  getCurrency() {
    if (this.globalConfig.get('multiCurrency') === 'true')
      if (this.collectService.client.multimoneda == ("true")) {
        //el client tiene varias monedas
      } else {

      }
  }

  setChangeCurrency(event: any) {
    this.collectService.alertMessageChangeCurrency = false;
    if (event.detail.role === 'confirm') {
      console.log("CAMBIAR MONEDA");
      this.onChangeCurrency(this.currencySelected);
    }

  }

  onChangeDateRateMsj(event: any) {
    const selectedDate = this.normalizeDateRateValue(event);
    if (!selectedDate) {
      return;
    }

    this.pendingDateRateVisual = selectedDate;

    if (this.collectService.collection.collectionDetails.length > 0) {
      this.collectService.mensaje = this.collectService.collectionTags.get('COB_COB_CHANGE_DATERATE')! == undefined ? "Está cambiando la fecha de la tasa, esto recalculará  los montos. ¿Desea continuar?" : this.collectService.collectionTags.get('COB_COB_CHANGE_DATERATE')!;
      this.collectService.alertMessageChangeDateRate = true
    } else {
      this.collectService.dateRateVisual = selectedDate;
      void this.onChangeDateRate();
    }
  }

  async onChangeDateRate() {
    try {
      await this.collectService.getDateRate(this.synchronizationServices.getDatabase(), this.collectService.dateRateVisual);

      if (this.collectService.historicPartialPayment) {
        this.collectService.findIsPaymentPartial(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);
      }

      await this.recalculateAmountsForRateChange(this.collectService.validateCollectionDate);
    } catch (err) {
      console.error('[onChangeDateRate] error:', err);
    }
  }

  async setChangeDateRate(event: any) {
    this.collectService.alertMessageChangeDateRate = false;
    if (event.detail.role === 'confirm') {
      console.log("CAMBIAR DATERATE");

      if (this.pendingDateRateVisual) {
        this.collectService.dateRateVisual = this.pendingDateRateVisual;
      }

      //await this.resetValues();
      await this.onChangeDateRate();
    } else {
      //SI NO QUIERE CAMBIAR, DEBO COLOCAR LA FECHA ANTERIOR
      this.collectService.dateRateVisual = this.collectService.collection.daRate;
    }

    this.pendingDateRateVisual = '';
  }

  private normalizeDateRateValue(value: any): string {
    const raw = value?.detail?.value ?? value?.target?.value ?? value;
    if (!raw) {
      return '';
    }

    const asString = String(raw);
    return asString.length >= 10 ? asString.substring(0, 10) : '';
  }


  onChangeCurrencyMsj(event: any) {
    if (this.collectService.collection.collectionDetails.length > 0 || this.collectService.collection.collectionPayments.length > 0) {
      this.currencySelected = event.target.value;
      switch (this.collectService.collection.coType) {
        case "0": {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_COB_CHANGE_CURRENCY')!;
          break;
        }
        case "1": {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_ANT_CHANGE_CURRENCY')!;
          break;
        }
        case "2": {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_RET_CHANGE_CURRENCY')!;
          break;
        }
        case "3": {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_IGTF_CHANGE_CURRENCY')!;
          break;
        }
        default: {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_COB_CHANGE_CURRENCY')!;
          break;
        }
      }

      this.collectService.alertMessageChangeCurrency = true
    } else {
      this.currencySelected = event.target.value
      this.collectService.collection.coCurrency = this.currencySelected.coCurrency;
      this.collectService.collection.idCurrency = this.currencySelected.idCurrency;

      if (this.currencySelected.localCurrency.toString() == 'true') {
        this.collectService.currencyLocal = true;
        this.collectService.currencyHard = false;
      }


      if (this.currencySelected.hardCurrency.toString() == 'true') {
        this.collectService.currencyHard = true;
        this.collectService.currencyLocal = false;
      }


      //this.collectService.currencySelectedDocument = event.target.value;
      this.collectService.setCurrencyConversion();
      this.collectService.getAllBankAccountsByEnterprise(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise, this.collectService.collection.coCurrency).then(result => {
        this.collectService.listBankAccounts = result;
        this.resetDocumentCurrencyFilter();

        this.collectService.getDocumentsSales(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient, this.getAllDocumentsCurrency(),
          this.collectService.collection.coCollection, this.collectService.collection.idEnterprise,
          this.getDocumentSalesFirstPageOptions()).then(response => {


            if (this.collectService.historicPartialPayment) {
              this.collectService.findIsPaymentPartial(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);
            }

            if (this.collectService.documentSales.length > 0)
              this.collectService.documentsSaleComponent = true;
            else
              this.collectService.documentsSaleComponent = false;

            this.collectService.findIsMissingRetention(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient);
            this.loadPayments();
          })

      })
    }

  }

  async resetValues() {
    if (this.collectService.collection.collectionDetails.length > 0) {
      //DEBO ELIMINAR
      this.collectService.collection.collectionDetails = [] as CollectionDetail[];
    }
    if (this.collectService.collection.collectionPayments.length > 0) {
      this.collectService.collection.collectionPayments = [] as CollectionPayment[];
    }


    this.collectService.documentSales = [] as DocumentSale[];
    this.collectService.documentSalesBackup = [] as DocumentSale[];
    this.collectService.documentSaleOpen = {} as DocumentSale;
    this.collectService.mapDocumentsSales.clear();

    this.collectService.collection.nuAmountFinal = 0;
    this.collectService.collection.nuAmountFinalConversion = 0;
    this.collectService.collection.nuAmountTotal = 0;
    this.collectService.collection.nuAmountTotalConversion = 0;
    this.collectService.collection.nuDifference = 0;
    this.collectService.collection.nuDifferenceConversion = 0;
  }


  async onChangeCurrency(currency: Currencies) {

    await this.resetValues();

    if (this.collectService.collection.coType != "1")
      this.collectService.disabledSelectCollectMethodDisabled = true;

    this.collectService.currencySelected = currency;

    this.collectService.collection.idCurrency = currency.idCurrency;
    this.collectService.collection.coCurrency = currency.coCurrency;

    this.collectService.setCurrencyDocument();
    this.resetDocumentCurrencyFilter();
    this.collectService.loadPaymentMethods();
    this.collectService.setCurrencyConversion();
    await this.loadAllDocumentsSales();
    this.collectService.calculatePayment("", 0);


    this.collectService.getAllBankAccountsByEnterprise(this.synchronizationServices.getDatabase(), this.collectService.collection.idEnterprise, this.collectService.collection.coCurrency).then(result => {
      this.collectService.listBankAccounts = result;
      this.loadPayments();

    })
  }

  isWeekday = (dateString: string) => {
    const date = new Date(dateString);
    const utcDay = date.getUTCDay();

    /**
     * Date will be enabled if it is not
     * Sunday or Saturday
     */
    return utcDay /* !== 0 && utcDay !== 6 */;
  };

  async onChangeRate(ev: any): Promise<void> {
    const selectedRate = Number(ev?.detail?.value ?? ev);
    if (!Number.isFinite(selectedRate) || selectedRate <= 0) return;

    await this.applySelectedRate(selectedRate);
  }

  onOpenCalendar() {
    if (this.collectService.collection.stDelivery != this.collectService.COLLECT_STATUS_TO_SEND && this.collectService.collection.stDelivery != this.collectService.COLLECT_STATUS_SENT) {
      this.collectService.getDateRate(this.synchronizationServices.getDatabase(), this.collectService.dateRateVisual.split("T")[0]);
      this.collectService.calculatePayment("", 0);
    }
  }

  onDateRateClick() {
    if (this.collectService.canChangeRate) {
      this.onOpenCalendar();
    }
  }

  onChangeTxConversion(event: any) {
    if (event.target.value.trim() != "") {
      this.collectService.collection.txConversion = this.collectService.cleanString(event.target.value.trim());
      this.collectService.unlockTabs().then((resp) => {
        this.collectService.onCollectionValid(resp);
      })
    } else {
      this.collectService.collection.txConversion = event.target.value.trim();
      this.messageAlert = new MessageAlert(
        this.collectService.collectionTags.get('COB_HEADER_MESSAGE')!,
        this.collectService.collectionTags.get('COB_EMPTY_TXCONVERSION')!,
      );
      this.messageService.alertModal(this.messageAlert);
    }
  }

  setResponsible() {
    this.collectService.collection.naResponsible = this.collectService.cleanString(this.collectService.collection.naResponsible.trim());
  }

  setComment() {
    if (this.collectService.changeClient)
      this.collectService.changeClient = false;
    else if (this.collectService.collection.txComment.trim() == "") {
      this.collectService.validComment = false;
      this.mensaje = this.collectService.collectionTags.get('COB_EMPTY_TXCOMMENT')!,
        this.collectService.alertMessageOpen = true;
    } else
      this.collectService.validComment = true;

    this.collectService.collection.txComment = this.collectService.cleanString(this.collectService.collection.txComment.trim());

    this.collectService.unlockTabs().then((resp) => {
      this.collectService.onCollectionValid(resp);
    })
  }

  setResult(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    this.collectService.alertMessageOpen = false;
    this.collectService.mensaje = '';

  }
  setResultEnterprise(ev: any) {

    console.log('Apretó:' + ev.detail.role);
    if (ev.detail.role === 'confirm') {
      this.collectService.alertMessageChangeEnterprise = false;
      this.collectService.cobroValid = false;
      this.collectService.changeClient = false;
      this.collectService.newCollect = true;
      this.onEnterpriseSelect();
    } else {
      const empresa = this.collectService.enterpriseList.find(e => e.idEnterprise == this.collectService.collection.idEnterprise);
      if (empresa) {
        this.collectService.enterpriseSelected = empresa;
      }

      this.collectService.alertMessageChangeEnterprise = false;
    }
  }

  setFocus() {
    if (this.input == undefined) {
      setTimeout(() => {
        this.setFocus();
      }, 500);
    } else
      this.input.setFocus();
  }

  tagFecha() {
    if (this.collectService.isAnticipo) {
      return this.collectService.collectionTags.get('COB_FECHA_ANTICIPO');
    }
    if (this.collectService.isRetention) {
      return this.collectService.collectionTags.get('COB_FECHA_RETENCION');
    }
    return this.collectService.collectionTags.get('COB_FECHA_COBRO');
  }

  onChangeEnterprise() {
    if (this.collectService.collection.collectionDetails.length > 0 || this.collectService.collection.collectionPayments.length > 0 || this.collectService.nameClient != "") {
      this.collectService.alertMessageChangeEnterprise = true;

      this.collectService.mensaje = this.collectService.collectionTags.get('COB_RESET_ENTERPRISE_CONFIRMA')!;
    } else {
      this.collectService.cobroValid = false;
      this.collectService.changeClient = false;
      this.collectService.newCollect = true;
      this.onEnterpriseSelect();
    }
    this.collectService.changeEnterprise = true;

  }

  setShowDateRateModal(show: boolean) {
    this.showDateRateModal = show;
    if (!show) return;

    const raw = this.collectService?.collection?.daRate ?? this.collectService?.dateRateVisual;
    if (raw) {
      const s = raw.toString();
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/); // extrae YYYY-MM-DD si está al inicio
      if (m) {
        this.collectService.dateRateVisual = m[1]; // "2025-10-24"
      } else {
        // fallback seguro: crea Date y toma YYYY-MM-DD (solo si no había formato reconocible)
        const d = new Date(s.replace(' ', 'T'));
        d.setHours(0, 0, 0, 0);
        this.collectService.dateRateVisual = d.toISOString().substring(0, 10);
      }
    } else {
      this.collectService.dateRateVisual = this.dateServ.onlyDateHoyISO();
    }
  }

  bottonDateRateLabel() {
    if (this.collectService.collection.stDelivery == this.collectService.COLLECT_STATUS_TO_SEND || this.collectService.collection.stDelivery == this.collectService.COLLECT_STATUS_SENT) {
      // normalizar a formato con espacio en vez de 'T'
      if (this.collectService.collection.daRate) {
        this.collectService.dateRateVisual = this.collectService.collection.daRate.replace('T', ' ');
      }
      return this.dateServ.formatShort(this.collectService.dateRateVisual);
    } else if (this.collectService.collection.stDelivery == this.collectService.COLLECT_STATUS_SAVED) {
      if (this.collectService.collection.daRate) {
        this.collectService.dateRateVisual = this.collectService.collection.daRate.replace('T', ' ');
      }
      return this.dateServ.formatShort(this.collectService.dateRateVisual);
    } else if (this.collectService.collection.stDelivery == 6) {
      const raw = this.collectService.collection.daCollection || '';
      this.collectService.dateRate = raw.substring(0, 19).replace('T', ' ');
      this.collectService.dateRateVisual = raw.replace('T', ' ');
      return this.dateServ.formatShort(this.collectService.dateRateVisual);
    } else {
      // si dateRateVisual contiene 'T' lo reemplazamos por espacio
      if (this.collectService.dateRateVisual && this.collectService.dateRateVisual.indexOf('T') !== -1) {
        this.collectService.dateRateVisual = this.collectService.dateRateVisual.replace('T', ' ');
      }
      this.collectService.dateRate = (this.collectService.dateRate || '').split("T")[0];
      return this.dateServ.formatShort(this.collectService.dateRateVisual);
    }
  }

  getBancoReceptor(nuClientBankAccount: string): BancoReceptor {
    const bancoReceptor = this.collectService.listBankAccounts.find(b => b.nuAccount == nuClientBankAccount);
    if (bancoReceptor) {
      return {
        coAccount: bancoReceptor.coAccount,
        coBank: bancoReceptor.coBank,
        coCurrency: bancoReceptor.coCurrency,
        coEnterprise: bancoReceptor.coEnterprise,
        coType: bancoReceptor.coType,
        idBank: bancoReceptor.idBank,
        idBankAccount: bancoReceptor.idBankAccount,
        idCurrency: bancoReceptor.idCurrency,
        idEnterprise: bancoReceptor.idEnterprise,
        naBank: bancoReceptor.naBank,
        nuAccount: bancoReceptor.nuAccount,
      }
    } else {
      return new BancoReceptor();
    }
  }


  /**
   * Valida y aplica la tasa manual al perder el foco (evento de ionBlur)
   */
  public onManualRateBlur(): void {
    if (this.manualRateError) {
      // No aplicar si hay error
      return;
    }
    // Si la tasa cambió, recalcular montos
    if (this.rateSelected !== this.lastManualRateValue) {
      this.lastManualRateValue = this.rateSelected;
      void this.applySelectedRate(this.rateSelected);
    }
  }

  /**
   * Maneja el input de la tasa manual (evento de ionInput)
   */
  public async onManualRateInput(event: any): Promise<void> {
    const rawValue = event?.detail?.value ?? event?.target?.value;
    const value = parseFloat(rawValue);
    if (isNaN(value) || value <= 0) {
      this.manualRateError = 'Ingrese un valor numérico mayor a 0';
      return;
    }
    this.manualRateError = '';
    await this.applySelectedRate(value);
  }

  private async applySelectedRate(rate: number): Promise<void> {
    this.rateSelected = rate;
    this.collectService.collection.nuValueLocal = rate;
    this.collectService.haveRate = true;
    this.collectService.updateRateDocument();
    await this.recalculateAmountsForRateChange(false);
  }

  private async recalculateAmountsForRateChange(updatePaymentDates: boolean): Promise<void> {
    this.collectService.isRateChangeInProgress = true;
    try {
      this.collectService.montoTotalPagar = 0;
      this.collectService.montoTotalPagarConversion = 0;

      this.restoreDocumentSalesFromView();
      this.rebuildCollectionDetails();

      if (this.collectService.multiCurrency) {
        await this.collectService.convertDocumentSales();
        this.collectService.setCurrencyConversion();
      }

      this.syncPaymentConversionsForRateChange();
      await this.collectService.calcularMontos('', 0);

      if (updatePaymentDates) {
        this.collectService.updateRateTiposPago();
      }

      const validTabs = await this.collectService.unlockTabs();
      this.collectService.onCollectionValid(validTabs);
    } finally {
      this.collectService.isRateChangeInProgress = false;
    }
  }

  private restoreDocumentSalesFromView(): void {
    if (!Array.isArray(this.collectService.documentSalesView)) {
      this.collectService.documentSales = [];
      this.collectService.documentSalesBackup = [];
      return;
    }

    try {
      const collectionDetails = Array.isArray(this.collectService.collection.collectionDetails)
        ? this.collectService.collection.collectionDetails
        : [];
      const detailByDocumentId = new Map<number, CollectionDetail>(
        collectionDetails.map(detail => [detail.idDocument, detail])
      );
      const deep = this.collectService.documentSalesView.map(d => JSON.parse(JSON.stringify(d)));
      const deepWithPreservedFields = deep.map(documentSale => {
        const detail = detailByDocumentId.get(documentSale.idDocument);
        if (detail) {
          this.preserveCollectionDetailFieldsInDocument(documentSale, detail);
        }
        return documentSale;
      });

      this.collectService.documentSales = deepWithPreservedFields.map(d => ({ ...d }));
      this.collectService.documentSalesBackup = deepWithPreservedFields.map(d => ({ ...d }));
    } catch (e) {
      const collectionDetails = Array.isArray(this.collectService.collection.collectionDetails)
        ? this.collectService.collection.collectionDetails
        : [];
      const detailByDocumentId = new Map<number, CollectionDetail>(
        collectionDetails.map(detail => [detail.idDocument, detail])
      );
      const shallowWithPreservedFields = this.collectService.documentSalesView.map(documentSale => {
        const copy = { ...documentSale };
        const detail = detailByDocumentId.get(copy.idDocument);
        if (detail) {
          this.preserveCollectionDetailFieldsInDocument(copy, detail);
        }
        return copy;
      });

      this.collectService.documentSales = [...shallowWithPreservedFields];
      this.collectService.documentSalesBackup = [...shallowWithPreservedFields];
      console.warn('No se pudo serializar documentSalesView para copia profunda, usando copia superficial', e);
    }
  }

  private preserveCollectionDetailFieldsInDocument(documentSale: any, detail: CollectionDetail): void {
    const fieldsToPreserve = [
      'nuAmountPaid',
      'nuAmountPaidConversion',
      'inPaymentPartial',
      'nuAmountRetention',
      'nuAmountRetention2',
      'nuAmountRetention2Conversion',
      'nuAmountRetentionConversion',
      'nuAmountRetentionIslrConversion',
      'nuAmountRetentionIvaConversion',
    ];

    fieldsToPreserve.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(documentSale, field)) {
        documentSale[field] = (detail as any)[field];
      }
    });
  }

  private syncPaymentConversionsForRateChange(): void {
    const updatePago = (pago: { monto: number; montoConversion: number }): void => {
      pago.montoConversion = this.collectService.convertirMonto(pago.monto, 0, this.collectService.collection.coCurrency);
    };

    this.collectService.pagoEfectivo.forEach(updatePago);
    this.collectService.pagoCheque.forEach(updatePago);
    this.collectService.pagoDeposito.forEach(updatePago);
    this.collectService.pagoTransferencia.forEach(updatePago);
    this.collectService.pagoMovil.forEach(updatePago);
    this.collectService.pagoOtros.forEach(updatePago);

    this.collectService.collection.collectionPayments.forEach(payment => {
      payment.nuAmountPartialConversion = this.collectService.convertirMonto(
        payment.nuAmountPartial,
        0,
        this.collectService.collection.coCurrency
      );
    });
  }

  /**
   * Reconstruye collectionDetails a partir de los documentos seleccionados, emulando la lógica de initCollectionDetail.
   */
  private rebuildCollectionDetails(): void {
    if (!Array.isArray(this.collectService.collection.collectionDetails)) return;
    const previousDetails = new Map<number, CollectionDetail>(
      this.collectService.collection.collectionDetails.map(detail => [detail.idDocument, detail])
    );
    const selectedDocs = this.collectService.documentSalesView.filter(doc => doc.isSelected);
    this.collectService.collection.collectionDetails = [];
    selectedDocs.forEach(doc => {
      let nuAmountTotal = 0, nuAmountBalance = 0, nuAmountTotalConversion = 0, nuAmountBalanceConversion = 0;
      let nuBalanceOriginal, nuBalanceOriginalConversion;
      const previousDetail = previousDetails.get(doc.idDocument);

      if (doc.coCurrency != this.collectService.collection.coCurrency) {
        nuAmountBalance = this.collectService.convertirMonto(doc.nuBalance, this.collectService.collection.nuValueLocal, doc.coCurrency);
        nuAmountBalanceConversion = doc.nuBalance;
        nuAmountTotal = this.collectService.convertirMonto(doc.nuAmountTotal, this.collectService.collection.nuValueLocal, doc.coCurrency);
        nuAmountTotalConversion = doc.nuAmountTotal;
        nuBalanceOriginalConversion = doc.nuBalance;
        nuBalanceOriginal = this.collectService.convertirMonto(doc.nuBalance, this.collectService.collection.nuValueLocal, doc.coCurrency);
      } else {
        nuAmountTotal = doc.nuAmountTotal;
        nuAmountBalance = doc.nuBalance;
        nuAmountBalanceConversion = this.collectService.convertirMonto(nuAmountBalance, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency);
        nuAmountTotalConversion = this.collectService.convertirMonto(nuAmountTotal, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency);
        nuBalanceOriginal = doc.nuBalance;
        nuBalanceOriginalConversion = this.collectService.convertirMonto(doc.nuBalance, this.collectService.collection.nuValueLocal, doc.coCurrency);
      }

      const inPaymentPartial = previousDetail?.inPaymentPartial
        ?? (this.collectService.coTypeModule != "2"
          ? this.collectService.alwaysPartialPayment || !!this.collectService.documentSaleOpen?.inPaymentPartial
          : false);
      const missingRetention = previousDetail?.missingRetention
        ?? (this.collectService.coTypeModule != "2"
          ? this.collectService.alwaysRetention || !!this.collectService.documentSaleOpen?.missingRetention
          : false);
      const nuAmountRetention = previousDetail?.nuAmountRetention ?? 0;
      const nuAmountRetention2 = previousDetail?.nuAmountRetention2 ?? 0;
      const nuAmountDiscount = previousDetail?.nuAmountDiscount ?? 0;
      const nuAmountCollectDiscount = previousDetail?.nuAmountCollectDiscount ?? 0;
      const nuAmountIgtf = previousDetail?.nuAmountIgtf ?? 0;

      this.collectService.collection.collectionDetails.push({
        idCollectionDetail: previousDetail?.idCollectionDetail ?? null,
        coCollection: this.collectService.collection.coCollection,
        coDocument: doc.coDocument.toString(),
        idDocument: doc.idDocument,
        inPaymentPartial: inPaymentPartial,
        nuVoucherRetention: previousDetail?.nuVoucherRetention ?? "",
        nuAmountRetention: nuAmountRetention,
        nuAmountRetention2: nuAmountRetention2,
        nuAmountRetentionConversion: this.collectService.convertirMonto(nuAmountRetention, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency),
        nuAmountRetention2Conversion: this.collectService.convertirMonto(nuAmountRetention2, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency),
        nuAmountRetentionIslrConversion: this.collectService.convertirMonto(nuAmountRetention2, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency),
        nuAmountRetentionIvaConversion: this.collectService.convertirMonto(nuAmountRetention, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency),
        nuAmountPaid: nuAmountBalance,
        nuAmountPaidConversion: nuAmountBalanceConversion,
        nuAmountDiscount: nuAmountDiscount,
        nuAmountDiscountConversion: this.collectService.convertirMonto(nuAmountDiscount, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency),
        nuAmountDoc: nuAmountTotal!,
        nuAmountDocConversion: nuAmountTotalConversion,
        daDocument: doc.daDocument,
        nuBalanceDoc: nuAmountBalance!,
        nuBalanceDocConversion: nuAmountBalanceConversion,
        nuBalanceDocOriginal: nuBalanceOriginal!,
        nuBalanceDocOriginalConversion: nuBalanceOriginalConversion!,
        coOriginal: doc.coCurrency,
        coTypeDoc: doc.coDocumentSaleType,
        nuValueLocal: this.collectService.collection.nuValueLocal,
        nuAmountIgtf: nuAmountIgtf,
        nuAmountIgtfConversion: this.collectService.convertirMonto(nuAmountIgtf, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency),
        st: previousDetail?.st ?? 0,
        isSave: previousDetail?.isSave ?? false,
        daVoucher: previousDetail?.daVoucher ?? this.dateServ.onlyDateHoyISO(),
        hasDiscount: previousDetail?.hasDiscount ?? false,
        discountComment: previousDetail?.discountComment ?? "",
        nuAmountCollectDiscount: nuAmountCollectDiscount,
        nuCollectDiscount: previousDetail?.nuCollectDiscount ?? 0,
        missingRetention: missingRetention,
        nuAmountCollectDiscountConversion: this.collectService.convertirMonto(nuAmountCollectDiscount, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency),
        collectionDetailDiscounts: previousDetail?.collectionDetailDiscounts,
      });
      // Actualizar positionCollecDetails en los arrays de documentos
      const newPos = this.collectService.collection.collectionDetails.length - 1;
      const docIndex = this.collectService.documentSales.findIndex(documentSale => documentSale.idDocument === doc.idDocument);
      if (docIndex >= 0) {
        this.collectService.documentSales[docIndex].positionCollecDetails = newPos;
        this.collectService.documentSalesBackup[docIndex].positionCollecDetails = newPos;
      }
      const viewIndex = this.collectService.documentSalesView.findIndex(documentSale => documentSale.idDocument === doc.idDocument);
      if (viewIndex >= 0) {
        this.collectService.documentSalesView[viewIndex].positionCollecDetails = newPos;
      }

      if (this.collectService.coTypeModule == "3") {
        this.collectService.collection.coOriginalCollection = doc.coCollection;
      }
    });
  }

  // Exponer enabledManualRate y rateSelected para el template
  get enabledManualRate(): boolean {
    return this.collectService.enabledManualRate;
  }

  get rateSelected(): number {
    return this.collectService.rateSelected;
  }
  set rateSelected(val: number) {
    this.collectService.rateSelected = val;
  }
  // True cuando el cobro ya fue enviado/por enviar o status 6
  get isSentDelivery(): boolean {
    const st = Number(this.collectService?.collection?.stDelivery);
    return st === this.collectService.COLLECT_STATUS_TO_SEND || st === this.collectService.COLLECT_STATUS_SENT || st === 6;
  }

  get showDateRateSection(): boolean {
    const stCollection = Number(this.collectService?.collection?.stCollection);
    return this.collectService.multiCurrency
      || this.collectService.showConversion
      || stCollection !== this.collectService.COLLECT_STATUS_TO_SEND
      || stCollection == this.collectService.COLLECT_STATUS_SAVED
      || stCollection !== 6;
  }

  get isDateRateLabelDisabled(): boolean {
    return !this.collectService.canChangeRate;
  }

  get isDateRateButtonDisabled(): boolean {
    const stDelivery = Number(this.collectService?.collection?.stDelivery);
    const stCollection = Number(this.collectService?.collection?.stCollection);
    return stDelivery === this.collectService.COLLECT_STATUS_TO_SEND
      || stDelivery === this.collectService.COLLECT_STATUS_SENT
      || stCollection === 6
      || !this.collectService.canChangeRate;
  }

  /**
 * Última tasa conocida (para inicializar el input y validar mínimo)
 * Se asume que la lógica ya la calcula y la deja en rateSelected o en rateList.
 */
  get lastRateValue(): number {
    if (this.collectService.rateList && this.collectService.rateList.length > 0) {
      return Math.max(...this.collectService.rateList);
    }
    return this.collectService.rateSelected || 0.01;
  }
}
