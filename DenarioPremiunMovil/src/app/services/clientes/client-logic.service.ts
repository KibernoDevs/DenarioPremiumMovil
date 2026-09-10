import { Injectable, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import {
  CLIENT_POTENTIAL_STATUS_SENT,
  CLIENT_POTENTIAL_STATUS_TO_SEND,
} from 'src/app/utils/appConstants';
import { ServicesService } from '../services.service';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { CurrencyEnterprise } from 'src/app/modelos/tables/currencyEnterprise';
import { CurrencyService } from '../currency/currency.service';
import { EnterpriseService } from '../enterprise/enterprise.service';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { MessageService } from '../messageService/message.service';
import { ClientesDatabaseServicesService } from './clientes-database-services.service';
import { Client } from 'src/app/modelos/tables/client';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { SelectedClient } from 'src/app/modelos/selectedClient';
import { PotentialClientDatabaseServicesService } from './potentialClient/potential-client-database-services.service';
import { PotentialClient } from 'src/app/modelos/tables/potentialClient';

import { Coordinate } from 'src/app/modelos/coordinate';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { AddresClient } from 'src/app/modelos/tables/addresClient';
import { IonModal, ModalController } from '@ionic/angular';
import { ClienteComponent } from 'src/app/clientes/client-container/client-detail/client-detail.component';
import { filterClientsBySelectionMode } from 'src/app/utils/client-suspension.policy';
import { isPromoterHideFinanceActive } from 'src/app/guards/promoter-hide-finance.guard';


@Injectable({
  providedIn: 'root'
})
export class ClientLogicService {

  public services = inject(ServicesService);
  public dbServ = inject(SynchronizationDBService);
  public currencyService = inject(CurrencyService);
  public enterpriseServ = inject(EnterpriseService);
  public message = inject(MessageService);
  public clientesServices = inject(ClientesDatabaseServicesService);
  public globalConfig = inject(GlobalConfigService);
  public potentialClientService = inject(PotentialClientDatabaseServicesService);
  public adjuntoService = inject(AdjuntoService);
  private modalCtrl = inject(ModalController);

  public showButtons = new Subject<Boolean>;
  public stockValidToSave = new Subject<Boolean>;
  public stockValidToSend = new Subject<Boolean>;
  public stockValid = new Subject<Boolean>;
  public backRoute = new Subject<string>;
  public closeClientShareModal = new Subject<Boolean>();

  public hardCurrency!: CurrencyEnterprise;
  public localCurrency!: CurrencyEnterprise;
  public datos!: SelectedClient;
  public enterprises!: Enterprise[];
  public empresaSeleccionada!: Enterprise;
  public clientTags = new Map<string, string>([]);
  public clientTagsDenario = new Map<string, string>([]);
  public listaEmpresa: Enterprise[] = [];
  public results!: any;
  public clients!: Client[];
  public potentialClients!: PotentialClient[];
  public potentialClient!: PotentialClient;
  public documentSaleSelect!: DocumentSale;
  public documentsSaleSelectShared: DocumentSale[] = [];
  public indice!: number;
  public coordenada!: Coordinate;
  public listaDirecciones: AddresClient[] = [];

  public clientContainerComponent: Boolean = true;
  public clientListComponent: Boolean = false;
  public clientDetailComponent: Boolean = false;
  public clientDocumentSaleComponent: Boolean = false;
  public clientPotentialClientComponent: Boolean = false;
  public clientNewPotentialClientComponent: Boolean = false;
  public clientLocationComponent: Boolean = false;
  public disabledEnterprise: Boolean = false;
  public opendDocClick: Boolean = false;
  public openDocSales: Boolean = false;
  public cannotSavePotentialClient: Boolean = true;
  public cannotSendPotentialClient: Boolean = true;
  public validPotentialClient: Boolean = false;

  /** Clientes potenciales — UX Guardar/Enviar (patrón Inventarios/Depósitos). */
  public generalTabValidForSave = false;
  public potentialClientPersistedBaseline = false;
  public potentialClientDirtySincePersist = false;
  public sendValidationAttempted = false;
  public sendBlockedByFields = false;
  public potentialClientForm: FormGroup | null = null;
  public userMustActivateGPS = false;

  public clienteNuevoBlancoImg: Boolean = true;//si hay algun cambio en el nuevo cliente potencial
  public newPotentialClientChanged: Boolean = false;//si hay algun cambio en el nuevo cliente potencial
  public saveSendPotentialClient: Boolean = false; //BOTONES saalvar y enviar cliente potencial
  public savePotentialClient: Boolean = false; //BOTONES saalvar y enviar cliente potencial
  public saveOrExitOpen = false;
  public exitToPotentialClientListAfterSave = false;
  public clientLocationChanged: Boolean = false;
  public cannotSendClientCoordinate: Boolean = false;

  public showConversion: boolean = true;
  public multiCurrency: boolean = false;

  /** Promotor + promoterHideFinance: ocultar saldos/docs en UI; Vendedor sin cambios. */
  get isFinanceHiddenForUser(): boolean {
    return isPromoterHideFinanceActive(this.globalConfig);
  }

  /** Muestra saldo convertido solo con multimoneda, config activa y tasa válida. */
  canShowConversion(): boolean {
    if (this.isFinanceHiddenForUser) {
      return false;
    }
    return this.showConversion
      && this.multiCurrency
      && this.currencyService.hasValidExchangeRate();
  }

  private ensureModuleCurrenciesLoaded(): void {
    if (!this.localCurrency?.coCurrency) {
      this.localCurrency = this.currencyService.getLocalCurrency();
    }
    if (!this.hardCurrency?.coCurrency) {
      this.hardCurrency = this.currencyService.getHardCurrency();
    }
  }

  /** Etiqueta moneda primaria según currency_modules.localCurrencyDefault (módulo CLI). */
  getPrimaryCurrencyLabel(): string {
    this.ensureModuleCurrenciesLoaded();
    return this.localCurrencyDefault
      ? (this.localCurrency?.coCurrency ?? '')
      : (this.hardCurrency?.coCurrency ?? '');
  }

  /** Etiqueta moneda secundaria (conversión) según localCurrencyDefault. */
  getSecondaryCurrencyLabel(): string {
    this.ensureModuleCurrenciesLoaded();
    return this.localCurrencyDefault
      ? (this.hardCurrency?.coCurrency ?? '')
      : (this.localCurrency?.coCurrency ?? '');
  }

  /**
   * saldo1=local / saldo2=hard tras fixClientListSaldos.
   * Elige cuál mostrar primero según currency_modules (sin mutar buckets).
   */
  getPrimarySaldo(client: Pick<Client, 'saldo1' | 'saldo2'>): number {
    const saldo1 = this.toFiniteSaldo(client.saldo1);
    const saldo2 = this.toFiniteSaldo(client.saldo2);
    return this.localCurrencyDefault ? saldo1 : saldo2;
  }

  getSecondarySaldo(client: Pick<Client, 'saldo1' | 'saldo2'>): number {
    const saldo1 = this.toFiniteSaldo(client.saldo1);
    const saldo2 = this.toFiniteSaldo(client.saldo2);
    return this.localCurrencyDefault ? saldo2 : saldo1;
  }

  /** Totales ya resueltos en buckets local/fuerte (detalle). */
  pickPrimaryFromLocalHard(localAmount: number, hardAmount: number): number {
    return this.localCurrencyDefault
      ? this.toFiniteSaldo(localAmount)
      : this.toFiniteSaldo(hardAmount);
  }

  pickSecondaryFromLocalHard(localAmount: number, hardAmount: number): number {
    return this.localCurrencyDefault
      ? this.toFiniteSaldo(hardAmount)
      : this.toFiniteSaldo(localAmount);
  }

  public transportRole: boolean = false;
  public localCurrencyDefault: boolean = false;
  public user: any = {};
  esTransportista: boolean = false;
  public currencyModule: any;
  public fromSelector = false; //flag que indica si estas abriendo el detalle de cliente desde selector o no.
  public nameModule: string = "";
  public segment = 'default';
  public nombreModulo = 'Clientes';
  public nombreModuloEsLargo: boolean = false;

  clientListPage = 0;
  clientListSearchMode = false;

  public dateToday: Date = (() => {
    const d = new Date();
    d.setDate(d.getDate());
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  //@ViewChild(IonModal) modal!: IonModal;

  constructor() {
    this.multiCurrency = this.globalConfig.get('multiCurrency').toString() === "true" ? true : false;
    this.currencyModule = this.currencyService.getCurrencyModule("cli");
    this.localCurrencyDefault = this.currencyModule.localCurrencyDefault.toString() === 'true' ? true : false;
    this.showConversion = this.currencyModule.showConversion.toString() === 'true' ? true : false;
    this.transportRole = this.globalConfig.get("transportRole").toString() === 'true' ? true : false;
    //Si el rol de transportista esta activo, debo validar si el usuario es transportista
    if (this.transportRole) {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          let user = JSON.parse(userStr);
          if (user.transportista) {
            this.esTransportista = user.transportista;
            this.showConversion = false;
          } else {
            //puede ser undefined o similar
            this.esTransportista = false;
            this.showConversion = this.currencyModule.showConversion.toString() === 'true' ? true : false;
          }
        } catch (e) {
          this.esTransportista = false;
          this.showConversion = this.currencyModule.showConversion.toString() === 'true' ? true : false;
        }
      }
    } else {
      this.esTransportista = false;
      this.showConversion = this.currencyModule.showConversion.toString() === 'true' ? true : false;
    }

  }


    checkUserStatus(){
        const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        let user = JSON.parse(userStr);
        this.esTransportista = user.transportista;
        //se pueden agregar los otros roles luego, de ser necesario.
      } catch (e) {
        this.esTransportista = false;
      }
    } else {
      this.esTransportista = false;
    }
  }

  initService() {
    this.multiCurrency = this.globalConfig.get('multiCurrency').toString() === "true" ? true : false;
    this.currencyModule = this.currencyService.getCurrencyModule("cli");
    // parseCurrencyModuleFlag: boolean/0/1/'true' desde SQLite post-sync (no solo toString === 'true')
    this.localCurrencyDefault = this.currencyService.parseCurrencyModuleFlag(
      this.currencyModule.localCurrencyDefault);
    this.showConversion = this.currencyService.parseCurrencyModuleFlag(
      this.currencyModule.showConversion);
    this.transportRole = this.globalConfig.get("transportRole").toString() === 'true' ? true : false;
    //Si el rol de transportista esta activo, debo validar si el usuario es transportista
    if (this.transportRole) {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          let user = JSON.parse(userStr);
          if (user.transportista) {
            this.esTransportista = user.transportista;
            this.showConversion = false;
          } else {
            //puede ser undefined o similar
            this.esTransportista = false;
            this.showConversion = this.currencyService.parseCurrencyModuleFlag(
              this.currencyModule.showConversion);
          }
        } catch (e) {
          this.esTransportista = false;
          this.showConversion = this.currencyService.parseCurrencyModuleFlag(
            this.currencyModule.showConversion);
        }
      }
    } else {
      this.esTransportista = false;
      this.showConversion = this.currencyService.parseCurrencyModuleFlag(
        this.currencyModule.showConversion);
    }
  }

  /**
   * Recarga currency_modules desde SQLite y aplica flags del módulo CLI.
   * Pedidos/Cobros ya hacen setup al abrir; Clientes reutiliza el mapa en memoria
   * y tras sync quedaba con showConversion/localCurrencyDefault viejos.
   */
  async refreshCliCurrencyModule(): Promise<void> {
    await this.currencyService.setup(this.dbServ.getDatabase());
    this.initService();
    this.localCurrency = this.currencyService.getLocalCurrency();
    this.hardCurrency = this.currencyService.getHardCurrency();
  }

  getCurrency() {
    this.refreshCliCurrencyModule();
  }

  setNombreModulo(tagKey: string, fallback: string = 'Clientes') {
    const moduleTitle = this.getClientTag(tagKey, fallback);
    this.nombreModulo = moduleTitle;
    this.nombreModuloEsLargo = moduleTitle.length > 12;
  }

  /** CLI + DEN: clientTags primero, luego clientTagsDenario (mismo patrón que collectionTagsDenario en Cobros). */
  getClientTag(tagKey: string, fallback = ''): string {
    const key = tagKey?.trim() ?? '';
    if (!key) {
      return fallback;
    }

    const fromClientTags = this.clientTags.get(key);
    if (fromClientTags != null && String(fromClientTags).trim().length > 0) {
      return String(fromClientTags).trim();
    }

    const fromDenarioTags = this.clientTagsDenario.get(key);
    if (fromDenarioTags != null && String(fromDenarioTags).trim().length > 0) {
      return String(fromDenarioTags).trim();
    }

    return fallback;
  }

  private storeClientTag(key: string, value: string, denarioMap = false): void {
    const normalizedKey = key?.trim() ?? '';
    if (!normalizedKey) {
      return;
    }
    const normalizedValue = value != null ? String(value) : '';
    this.clientTags.set(normalizedKey, normalizedValue);
    if (denarioMap) {
      this.clientTagsDenario.set(normalizedKey, normalizedValue);
    }
  }

  getEnterprise() {
    this.enterpriseServ.setup(this.dbServ.getDatabase()).then(() => {
      this.listaEmpresa = this.enterpriseServ.empresas;
      this.empresaSeleccionada = this.enterpriseServ.empresas[0];
      this.disabledEnterprise = this.globalConfig.get('enterpriseEnabled') === 'true' ? false : true;

    });
  }


  showHeaderButtons(headerButtons: Boolean) {
    this.showButtons.next(headerButtons);
  }

  showBackRoute(route: string) {
    console.log('clientLogic: showBackRoute ', route);
    this.backRoute.next(route);
  }

  getTags() {
    return this.services.getTags(this.dbServ.getDatabase(), 'CLI', 'ESP').then(result => {
      for (let i = 0; i < result.length; i++) {
        this.storeClientTag(result[i].coApplicationTag, result[i].tag);
      }
      return this.services.getTags(this.dbServ.getDatabase(), 'DEN', 'ESP').then(denarioResult => {
        for (let i = 0; i < denarioResult.length; i++) {
          this.storeClientTag(denarioResult[i].coApplicationTag, denarioResult[i].tag, true);
        }

        return Promise.resolve(true);
      });
    });
  }

  getTagsDenario() {
    return this.services.getTags(this.dbServ.getDatabase(), 'DEN', 'ESP').then(result => {
      for (let i = 0; i < result.length; i++) {
        this.storeClientTag(result[i].coApplicationTag, result[i].tag, true);
      }
      return Promise.resolve(true);
    });
  }

  getClients(idEnterprise: number) {
    this.clientListSearchMode = false;
    return this.clientesServices.getClients(idEnterprise, this.clientListPage)
      .then((result) => {
        return this.updateClientListAfterEdit(result);
      });
  }

  searchClients(idEnterprise: number, searchText: string) {
    this.clientListSearchMode = true;
    return this.clientesServices.searchClients(idEnterprise, searchText, this.clientListPage).then((result) => {
      return this.updateClientListAfterEdit(result);
    });
  }

  async updateClientListAfterEdit(clients: Client[]) {
    const pageExhausted = clients.length < this.clientesServices.MAX_ITEMS_PER_PAGE;
    if (this.clientListPage === 0) {
      this.clients = [] as Client[];
    }
    this.fixClientListSaldos(clients);
    const visibleClients = filterClientsBySelectionMode(clients, 'default');
    if (this.clientListPage === 0) {
      this.clients = visibleClients;
    } else {
      this.clients = this.clients.concat(visibleClients);
    }
    this.results = [...visibleClients];

    // Recorre todos los clientes y loggea si la moneda es distinta a la moneda local

    if (this.globalConfig.get("clientsOrderBy") == "due_date") {
      await this.oderByDueDateAndSaldo(this.clients);
    }

    return Promise.resolve(pageExhausted);
  }

  async oderByDueDateAndSaldo(clientes: Client[]) {
    clientes.sort((a, b) => {
      const totalA = (a.saldo1 ?? 0) + (a.saldo2 ?? 0);
      const totalB = (b.saldo1 ?? 0) + (b.saldo2 ?? 0);

      const groupA = (a.countDueDate ?? 0) > 0 ? 0 : 1;
      const groupB = (b.countDueDate ?? 0) > 0 ? 0 : 1;

      if (groupA !== groupB) {
        return groupA - groupB;
      }

      return totalB - totalA;
    });
  }

  private toFiniteSaldo(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Combina saldo1/saldo2 con semántica moneda-cliente / opuesta
   * (misma regla que usa la lista cuando conversionDocument != true).
   */
  resolveClientCurrencyPairBalances(
    saldo1Raw: unknown,
    saldo2Raw: unknown,
    coCurrency: string,
  ): { saldoCliente: number; saldoOpuesto: number } {
    const saldo1 = this.toFiniteSaldo(saldo1Raw);
    const saldo2 = this.toFiniteSaldo(saldo2Raw);
    const hasRate = this.currencyService.hasValidExchangeRate();

    if (!hasRate) {
      return { saldoCliente: saldo1, saldoOpuesto: 0 };
    }

    if (coCurrency === this.localCurrency.coCurrency) {
      const saldoCliente = saldo1 + this.currencyService.toLocalCurrency(saldo2);
      return {
        saldoCliente: this.toFiniteSaldo(saldoCliente),
        saldoOpuesto: this.toFiniteSaldo(this.currencyService.toHardCurrency(saldoCliente)),
      };
    }

    const saldoCliente = saldo1 + this.currencyService.toHardCurrency(saldo2);
    return {
      saldoCliente: this.toFiniteSaldo(saldoCliente),
      saldoOpuesto: this.toFiniteSaldo(this.currencyService.toLocalCurrency(saldoCliente)),
    };
  }

  /**
   * Totales listos para etiquetas fijas Saldo local / Saldo fuerte del detalle.
   * - conversionDocument=true: saldo1=local, saldo2=hard.
   * - conversionDocument!=true: saldo1=moneda cliente, saldo2=opuesta (como la lista).
   */
  resolveClientBalanceTotals(
    saldo1Raw: unknown,
    saldo2Raw: unknown,
    coCurrency: string,
    conversionDocument: boolean = false,
  ): { saldoLocal: number; saldoFuerte: number } {
    const saldo1 = this.toFiniteSaldo(saldo1Raw);
    const saldo2 = this.toFiniteSaldo(saldo2Raw);
    const hasRate = this.currencyService.hasValidExchangeRate();

    if (conversionDocument) {
      if (!hasRate) {
        return { saldoLocal: saldo1, saldoFuerte: saldo2 };
      }
      const saldoLocal = saldo1 + this.currencyService.toLocalCurrency(saldo2);
      return {
        saldoLocal: this.toFiniteSaldo(saldoLocal),
        saldoFuerte: this.toFiniteSaldo(this.currencyService.toHardCurrency(saldoLocal)),
      };
    }

    const { saldoCliente, saldoOpuesto } = this.resolveClientCurrencyPairBalances(
      saldo1,
      saldo2,
      coCurrency,
    );

    if (coCurrency === this.localCurrency.coCurrency) {
      return { saldoLocal: saldoCliente, saldoFuerte: saldoOpuesto };
    }

    return { saldoLocal: saldoOpuesto, saldoFuerte: saldoCliente };
  }

  /**
   * CLI-SALDOS-001: post-proceso de Saldo display.
   * SQL ya trae saldo1=local / saldo2=hard (docs). No muta coCurrency del cliente.
   */
  fixClientListSaldos(clients: Client[]): Client[] {
    if (!this.localCurrency?.coCurrency) {
      this.localCurrency = this.currencyService.getLocalCurrency();
    }
    if (!this.hardCurrency?.coCurrency) {
      this.hardCurrency = this.currencyService.getHardCurrency();
    }

    if (this.currencyService.multimoneda) {
      for (let c = 0; c < clients.length; c++) {
        const { saldoLocal, saldoFuerte } = this.resolveClientBalanceTotals(
          clients[c].saldo1,
          clients[c].saldo2,
          clients[c].coCurrency,
          true,
        );
        clients[c].saldo1 = saldoLocal;
        clients[c].saldo2 = saldoFuerte;
      }
    }
    return clients;
  }

  // Reemplazar la función goToClient existente por esta versión async
  async goToClient(idClient: number): Promise<void> {
    try {
      this.clientListComponent = false; // apagamos el componente client list

      // 1) Obtener cliente
      const clientResult = await this.clientesServices.getClientById(Number(idClient));
      this.datos = {} as SelectedClient;

      // Normalizar moneda del cliente (crédito / etiqueta).
      // CLI-SALDOS-001: no convertir saldo1 — SQL detalle ya trae buckets docs local/hard.
      if (this.localCurrencyDefault) {
        if (clientResult.idCurrency !== this.localCurrency.idCurrency) {
          clientResult.nuCreditLimit = this.currencyService.toOppositeCurrency(clientResult.coCurrency, clientResult.nuCreditLimit);
          clientResult.coCurrency = this.localCurrency.coCurrency;
        }
      } else {
        if (clientResult.idCurrency !== this.hardCurrency.idCurrency) {
          clientResult.coCurrency = this.hardCurrency.coCurrency;
          clientResult.nuCreditLimit = this.currencyService.toOppositeCurrency(this.hardCurrency.coCurrency, clientResult.nuCreditLimit);
        }
      }

      clientResult.editable = clientResult.editable == null ? false : (clientResult.editable.toString().toLowerCase() === 'true');

      if (clientResult.coCurrency == null || clientResult.coCurrency.trim() === "") {
        clientResult.coCurrency = this.currencyService.getCurrencyById(clientResult.idCurrency).coCurrency;
      }

      this.datos.client = clientResult;

      // 2) Obtener documentos de venta del cliente
      const docsResult = await this.clientesServices.getDocumentSaleByIdClient(Number(idClient));
      if (Array.isArray(docsResult)) {
        //esta conversion no se deberia hacer si no se esta haciendo en Cobros. Deben verse igual en cobros y aca.
        /*
        if (this.localCurrencyDefault) {
          for (const c of docsResult) {
            if (c.coCurrency !== this.localCurrency.coCurrency) {
              c.nuAmountPaid = this.currencyService.toOppositeCurrency(c.coCurrency, c.nuAmountPaid);
              c.nuAmountTotal = this.currencyService.toOppositeCurrency(c.coCurrency, c.nuAmountTotal);
              c.nuBalance = this.currencyService.toOppositeCurrency(c.coCurrency, c.nuBalance);
              c.nuAmountDiscount = this.currencyService.toOppositeCurrency(c.coCurrency, c.nuAmountDiscount);
              c.nuAmountRetention = this.currencyService.toOppositeCurrency(c.coCurrency, c.nuAmountRetention);
              c.nuAmountRetention2 = this.currencyService.toOppositeCurrency(c.coCurrency, c.nuAmountRetention2);
              c.nuAmountTax = this.currencyService.toOppositeCurrency(c.coCurrency, c.nuAmountTax);
              c.coCurrency = this.localCurrency.coCurrency;
            }
          }
        } else {
          for (const c of docsResult) {
            if (c.coCurrency !== this.hardCurrency.coCurrency) {
              c.coCurrency = this.hardCurrency.coCurrency;
              c.nuAmountPaid = this.currencyService.toOppositeCurrency(this.hardCurrency.coCurrency, c.nuAmountPaid);
              c.nuAmountTotal = this.currencyService.toOppositeCurrency(this.hardCurrency.coCurrency, c.nuAmountTotal);
              c.nuBalance = this.currencyService.toOppositeCurrency(this.hardCurrency.coCurrency, c.nuBalance);
              c.nuAmountDiscount = this.currencyService.toOppositeCurrency(this.hardCurrency.coCurrency, c.nuAmountDiscount);
              c.nuAmountRetention = this.currencyService.toOppositeCurrency(this.hardCurrency.coCurrency, c.nuAmountRetention);
              c.nuAmountRetention2 = this.currencyService.toOppositeCurrency(this.hardCurrency.coCurrency, c.nuAmountRetention2);
              c.nuAmountTax = this.currencyService.toOppositeCurrency(this.hardCurrency.coCurrency, c.nuAmountTax);
            }
          }
        }
        */
        this.datos.document = docsResult;
        this.datos.document.forEach((doc) => {
          if (typeof doc.daDocument === 'string' && doc.daDocument.includes('-')) {
            doc.daDocument = doc.daDocument.split("-")[2] + "/" + doc.daDocument.split("-")[1] + "/" + doc.daDocument.split("-")[0];
          }
          if (typeof doc.daDueDate === 'string' && doc.daDueDate.includes('-')) {
            doc.daDueDate = doc.daDueDate.split("-")[2] + "/" + doc.daDueDate.split("-")[1] + "/" + doc.daDueDate.split("-")[0];
          }
        });
      } else {
        // Si la llamada no devolvió array, asegurar valores por defecto
        this.datos.document = [];
      }

      // 3) Obtener direcciones del cliente
      try {
        const addresses = await this.clientesServices.getAddressClientsByIdClient(Number(idClient));
        this.listaDirecciones = Array.isArray(addresses) ? addresses : [];
        this.clientDetailComponent = true;
      } catch (e) {
        this.listaDirecciones = [];
        this.clientDetailComponent = true;
        console.warn('[goToClient] error cargando direcciones:', e);
      }

    } catch (err) {
      console.error('[goToClient] error:', err);
      // En caso de error, aseguramos estados razonables
      this.datos = {} as SelectedClient;
      this.datos.document = [];
      this.clientDetailComponent = false;
      this.listaDirecciones = [];
    }
  }

  viewCoordenadaPotentialClient(potentialClient: PotentialClient, module: string) {
    this.nameModule = module;
    this.coordenada = {} as Coordinate;
    this.coordenada.idClient = potentialClient.idClient;
    this.coordenada.idAddressClients = 0;
    this.coordenada.coAddressClients = "";
    this.coordenada.editable = true;
    this.coordenada.idEnterprise = potentialClient.idEnterprise;
    this.coordenada.naClient = potentialClient.naClient;
    this.coordenada.lat = Number((potentialClient.coordenada.split(",")[0].trim()));
    this.coordenada.lng = Number((potentialClient.coordenada.split(",")[1].trim()));

    this.datos = {} as SelectedClient;
    this.datos.client = {} as Client;
    this.datos.client.idClient = potentialClient.idClient;
    this.datos.client.idAddressClients = 0;
    this.datos.client.editable = true;

    this.saveSendPotentialClient = false;
    this.clientContainerComponent = false;
    this.clienteNuevoBlancoImg = false;
    this.clientNewPotentialClientComponent = false;
    this.clienteNuevoBlancoImg = false;
    this.clientLocationComponent = true;
  }

  viewCoordenada(client: Client, module: string) {
    this.clienteNuevoBlancoImg = false;
    this.nameModule = module;
    //DEBO VALIDAR SI EXISTE COORDENADAS, SI NO EXISTE COLOCAR LA COORDENADA DEL TELEFONO, SINO YA VEREMOS!
    this.coordenada = {} as Coordinate
    if (client.coordenada == null
      || client.coordenada.trim() == ""
      || client.coordenada.trim() == "0,0"
      || client.coordenada.toLowerCase().trim() === "null") {
      this.coordenada.lat = 0;
      this.coordenada.lng = 0;
    } else {
      this.coordenada.lat = Number((client.coordenada.split(",")[0].trim()));
      this.coordenada.lng = Number((client.coordenada.split(",")[1].trim()));
    }
    this.coordenada.idClient = client.idClient;
    this.coordenada.idAddressClients = client.idAddressClients;
    this.coordenada.coAddressClients = client.coAddressClients;
    this.coordenada.editable = client.editable;
    this.coordenada.idEnterprise = client.idEnterprise;
    this.coordenada.naClient = client.lbClient;

    switch (module) {
      case "client":
        this.clientDetailComponent = false;
        this.clientLocationComponent = true;
        break;
      case "clientNewPotentialClient":
        this.clientNewPotentialClientComponent = false;
        this.clientLocationComponent = true;
        break;
      case "visitas":
        this.clientLocationComponent = true;
        break;
    }


  }

  getPotentialClient(): Promise<PotentialClient[]> {
    return this.potentialClientService.getPotentialClient().then(result => {
      this.indice = 1;
      this.potentialClients = result;
      return result;
    });
  }

  getEnterprisePotentialClient() {
    this.userMustActivateGPS =
      this.globalConfig.get('userMustActivateGPS').toLowerCase() === 'true';
    return this.potentialClientService.getEnterprises().then(result => {
      this.enterprises = result;
      if (result.length == 1) {
        this.empresaSeleccionada = result[0];
        this.potentialClient.idEnterprise = result[0].idEnterprise;
        this.onPotentialClientGeneralValid(true);
      }
      return result;
    });
  }

  registerPotentialClientForm(form: FormGroup): void {
    this.potentialClientForm = form;
  }

  clearPotentialClientForm(): void {
    this.potentialClientForm = null;
  }

  onPotentialClientGeneralValid(valid: boolean): void {
    this.generalTabValidForSave = valid;
    this.updatePotentialClientSaveButtonAvailability();
    this.updatePotentialClientSendButtonAvailability();
  }

  isPotentialClientReadOnlyForEdit(): boolean {
    const st = Number(this.potentialClient?.stPotentialClient ?? -1);
    return st === CLIENT_POTENTIAL_STATUS_TO_SEND
      || st === CLIENT_POTENTIAL_STATUS_SENT;
  }

  updatePotentialClientSaveButtonAvailability(): void {
    if (this.isPotentialClientReadOnlyForEdit() || !this.saveSendPotentialClient) {
      this.cannotSavePotentialClient = true;
      return;
    }
    if (this.adjuntoService.weightLimitExceeded) {
      this.cannotSavePotentialClient = true;
      return;
    }
    // Guardar ON con cambios (dirty); el nombre se valida al pulsar (mensaje si falta).
    const hasChangesToSave =
      !this.potentialClientPersistedBaseline || this.potentialClientDirtySincePersist;
    this.cannotSavePotentialClient = !hasChangesToSave;
  }

  updatePotentialClientSendButtonAvailability(): void {
    if (this.isPotentialClientReadOnlyForEdit() || !this.saveSendPotentialClient) {
      this.cannotSendPotentialClient = true;
      return;
    }
    if (this.adjuntoService.weightLimitExceeded) {
      this.cannotSendPotentialClient = true;
      return;
    }
    // Enviar ON con General (empresa). Campos incompletos no apagan el botón (POT-SEND-001).
    this.cannotSendPotentialClient = !this.generalTabValidForSave;
  }

  resetPotentialClientSendValidationUx(): void {
    this.sendValidationAttempted = false;
    this.sendBlockedByFields = false;
    this.updatePotentialClientSendButtonAvailability();
  }

  refreshPotentialClientSendBlockedState(): void {
    // Si había bloqueo tras Enviar fallido, liberar en cuanto el form quede completo.
    if (this.sendBlockedByFields && !this.hasPotentialClientFieldErrors()) {
      this.sendBlockedByFields = false;
    }
  }

  notifyPotentialClientEdited(): void {
    this.markPotentialClientDirty();
    this.refreshPotentialClientSendBlockedState();
    this.updatePotentialClientSaveButtonAvailability();
    this.updatePotentialClientSendButtonAvailability();
  }

  markPotentialClientDirty(): void {
    this.potentialClientDirtySincePersist = true;
  }

  applyPotentialClientPersistSucceededBaseline(): void {
    this.potentialClientDirtySincePersist = false;
    this.potentialClientPersistedBaseline = true;
    this.updatePotentialClientSaveButtonAvailability();
    this.updatePotentialClientSendButtonAvailability();
  }

  resetPotentialClientExitBaseline(): void {
    this.potentialClientPersistedBaseline = false;
    this.potentialClientDirtySincePersist = false;
    this.updatePotentialClientSaveButtonAvailability();
    this.updatePotentialClientSendButtonAvailability();
  }

  markPotentialClientOpenedFromPersistedCopy(): void {
    this.potentialClientPersistedBaseline = true;
    this.potentialClientDirtySincePersist = false;
    this.updatePotentialClientSaveButtonAvailability();
    this.updatePotentialClientSendButtonAvailability();
  }

  resetPotentialClientValidationUxFlags(): void {
    this.generalTabValidForSave = false;
    this.sendValidationAttempted = false;
    this.sendBlockedByFields = false;
    this.potentialClientPersistedBaseline = false;
    this.potentialClientDirtySincePersist = false;
  }

  private getPotentialClientControl(name: string): AbstractControl | null {
    return this.potentialClientForm?.get(name) ?? null;
  }

  private isPotentialClientControlValid(name: string): boolean {
    const control = this.getPotentialClientControl(name);
    return !!control && control.errors == null;
  }

  /** Nombre del cliente potencial con texto (mínimo para Guardar). */
  public hasPotentialClientNameFilled(): boolean {
    const control = this.getPotentialClientControl('naClient');
    if (control) {
      const value = String(control.value ?? '').trim();
      return value.length > 0 && control.errors == null;
    }
    return String(this.potentialClient?.naClient ?? '').trim().length > 0;
  }

  private hasEnterpriseSelected(): boolean {
    if (this.empresaSeleccionada?.idEnterprise) {
      return true;
    }
    return this.isPotentialClientControlValid('idEnterprise');
  }

  public isPotentialClientEnterpriseMissing(): boolean {
    return !this.hasEnterpriseSelected();
  }

  private isPotentialClientFormComplete(): boolean {
    const requiredFields = [
      'idEnterprise',
      'naClient',
      'nuRif',
      'txAddress',
      'txAddressDispatch',
      'txClient',
      'naResponsible',
      'emClient',
      'nuPhone',
    ];
    return requiredFields.every((field) => this.isPotentialClientControlValid(field));
  }

  private hasMissingGpsCoordinate(): boolean {
    if (!this.userMustActivateGPS) {
      return false;
    }
    const coord = (this.potentialClient?.coordenada ?? '').toString().trim();
    return coord.length === 0;
  }

  /** Errores que bloquean Guardar: solo nombre vacío (no formulario completo). */
  public hasPotentialClientSaveErrors(): boolean {
    return !this.hasPotentialClientNameFilled();
  }

  public getPotentialClientSaveValidationMessage(): string {
    if (!this.hasPotentialClientNameFilled()) {
      return this.clientTags.get('CLI_NEW_POT_MENSAJE_ERROR_NOMBRE_CLIENTE')
        ?? this.clientTags.get('CLI_POT_MSJ_ERROR_NO_NAME')
        ?? 'Indique el nombre del cliente potencial para guardar.';
    }
    return this.clientTags.get('CLI_POT_MSJ_ERROR_INCOMPLETE_FORM')
      ?? 'Complete los campos mínimos para guardar.';
  }

  /**
   * Errores que bloquean Enviar: General + formulario.
   * Firma/adjuntos no son obligatorios: `signatureClient` solo muestra el panel de firma.
   */
  public hasPotentialClientFieldErrors(): boolean {
    if (!this.generalTabValidForSave || !this.hasEnterpriseSelected()) {
      return true;
    }
    if (!this.isPotentialClientFormComplete()) {
      return true;
    }
    if (this.hasMissingGpsCoordinate()) {
      return true;
    }
    return false;
  }

  public getPotentialClientValidationMessage(): string {
    if (!this.generalTabValidForSave || !this.hasEnterpriseSelected()) {
      return this.clientTags.get('CLI_POT_MSJ_ERROR_NO_ENTERPRISE')
        ?? 'Seleccione una empresa para continuar.';
    }
    if (!this.isPotentialClientControlValid('naClient')) {
      return this.clientTags.get('CLI_NEW_POT_MENSAJE_ERROR_NOMBRE_CLIENTE')
        ?? this.clientTags.get('CLI_POT_MSJ_ERROR_INCOMPLETE_FORM')
        ?? 'Complete el nombre del cliente.';
    }
    if (!this.isPotentialClientControlValid('nuRif')
      || !this.isPotentialClientControlValid('txAddress')
      || !this.isPotentialClientControlValid('txAddressDispatch')
      || !this.isPotentialClientControlValid('txClient')
      || !this.isPotentialClientControlValid('naResponsible')
      || !this.isPotentialClientControlValid('emClient')
      || !this.isPotentialClientControlValid('nuPhone')) {
      return this.clientTags.get('CLI_POT_MSJ_ERROR_INCOMPLETE_FORM')
        ?? 'Complete todos los campos obligatorios del cliente potencial.';
    }
    if (this.hasMissingGpsCoordinate()) {
      return this.clientTags.get('CLI_POT_MSJ_ERROR_NO_GPS')
        ?? 'Debe activar el GPS y obtener la ubicación antes de continuar.';
    }
    return this.clientTags.get('CLI_POT_MSJ_ERROR_INCOMPLETE_FORM')
      ?? 'Complete los campos obligatorios del cliente potencial.';
  }

  public syncPotentialClientFormValidity(): boolean {
    const complete = this.isPotentialClientFormComplete();
    this.validPotentialClient = complete;
    return complete;
  }

  getDocumentSale(idClient: number) {
    return this.clientesServices
  }

  openClientLocationComponent() {
    this.clientLocationComponent = true;
  }

  closeClientShareModalFunction() {
    this.closeClientShareModal.next(true);
  }


  // Reemplazar viewDetailClient para esperar la promesa completa
  async viewDetailClient(idClient: number): Promise<void> {
    await this.getCurrency();
    this.clientContainerComponent = true; // Aseguramos que el contenedor de clientes esté activo
    await this.goToClient(idClient); // ahora espera hasta que goToClient termine todas las cargas
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

  public isDueSoon(daDueDate: string | Date | undefined | null): boolean {
    const dueDate = this.parseDate(daDueDate);
    if (!dueDate) return false;
    // normalizar horas a medianoche antes de comparar
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }


  public async closeModal(): Promise<void> {
    try {
      const topModal = await this.modalCtrl.getTop();
      if (topModal) {
        await topModal.dismiss();
      }
    } catch (err) {
      console.warn('closeModal error:', err);
    }
  }

  async showClientDetail(event: Event, client: Client) {
    event.stopPropagation();
    await this.message.showLoading();
    try {
      //mostramos el componente de detalle
      this.segment = 'default';
      // Cerrar el modal selector primero (evita que quede encima)
      await this.closeModal();

      //indicamos que venimos del selector de cliente
      this.fromSelector = true;

      // Cargar tags y datos del cliente
      this.getTags();
      this.getTagsDenario();
      await this.viewDetailClient(client.idClient);

      // Abrir modal con el componente de detalle
      const modal = await this.modalCtrl.create({
        component: ClienteComponent,
        componentProps: { showHeader: true },
        cssClass: 'client-detail-modal'
      });

      await modal.present();
      // opcional: await modal.onDidDismiss() si necesitas manejar la respuesta
    } catch (err) {
      console.error('Error mostrando detalle de cliente en modal:', err);
    } finally {
      await this.message.hideLoading();
    }
  }
}
