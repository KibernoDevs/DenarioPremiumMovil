import { Component, OnInit, EventEmitter, Output, ViewChild, inject } from '@angular/core';
import { Client } from '../modelos/tables/client';
import { InfiniteScrollCustomEvent, IonModal } from '@ionic/angular';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { ClientesDatabaseServicesService } from '../services/clientes/clientes-database-services.service';
import { CurrencyService } from '../services/currency/currency.service';
import { CurrencyEnterprise } from '../modelos/tables/currencyEnterprise';
import { ClienteSelectorService } from './cliente-selector.service';
import { CollectionService } from '../services/collection/collection-logic.service';
import { MessageService } from '../services/messageService/message.service';
import { ClientLogicService } from '../services/clientes/client-logic.service';
import { ModalController } from '@ionic/angular';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';



@Component({
  selector: 'app-cliente-selector',
  templateUrl: './cliente-selector.component.html',
  styleUrls: ['./cliente-selector.component.scss'],
  standalone: false
})
export class ClienteSelectorComponent implements OnInit {

  //injectss
  private clientServ = inject(ClientesDatabaseServicesService);
  private dbServ = inject(SynchronizationDBService);
  private currencyService = inject(CurrencyService);
  private service = inject(ClienteSelectorService);
  private collectLogic = inject(CollectionService);
  private messageService = inject(MessageService);
  public clientLogic = inject(ClientLogicService);
  public modalCtrl = inject(ModalController);
  private globalConfig = inject(GlobalConfigService);


  public tags = new Map<string, string>([]);
  public clientes!: Client[]
  public searchText: string = '';
  public searchMode: boolean = false;
  public clientChangeOpen = false;
  public multimoneda: boolean = false;
  public cliente!: Client

  public isModalOpen: boolean = false;
  public precision = this.currencyService.precision;
  private localCurrency!: CurrencyEnterprise;
  private hardCurrency!: CurrencyEnterprise;

  public showConversion = false;
  public localCurrencyDefault = true;
  public currencySwitchEnabled = false; // si el usuario no tiene currencyModule, no reordenamos monedas.

  public colorModulo: string = '';

  public nombreModulo: string = '';

  public headerConfirm: string = '';

  public mensajeClientChange: string = '';

  public btnAceptar: string = '';

  public btnCancelar: string = '';

  public noClientsAlertShown = false;

  public page = 0; // para paginacion de clientes.
  public scrollDisable = false;



  @ViewChild(IonModal) modal!: IonModal;


  constructor(

  ) {
    this.tags = this.service.tags;
    this.colorModulo = this.service.colorModulo;
    this.nombreModulo = this.service.nombreModulo;
    this.clientes = this.service.clientes;
    this.multimoneda = this.currencyService.multimoneda;

    //busco monedas
    this.currencyService.setup(this.dbServ.getDatabase()).then(() => {
      this.localCurrency = this.currencyService.getLocalCurrency();
      this.hardCurrency = this.currencyService.getHardCurrency();

    })

  }

  ngOnInit() {
    //console.log("Cliente selector ON");
    //this.dateToday = this.dateServ.onlyDateHoyISO();
    if (this.service.currencyModule) {
      this.loadCurrencyModule();
    }
    this.noClientsAlertShown = false;
  }

  getTag(tagName: string) {
    var tag = this.tags.get(tagName);
    if (tag == undefined) {
      console.log("Error al buscar tag " + tagName);
      tag = '';
    }
    return tag;
  }

  formatNum(num: number) {
    return this.currencyService.formatNumber(num);
  }
  setup(idEnterprise: number, nombreModulo: string, colorModulo: string, cliente: null | Client, checkClient: boolean, coModule: string) {
    //hace la configuracion inicial y habilita el chequeo de cambio de cliente
    this.setSkin(nombreModulo, colorModulo);

    this.service.checkClient = checkClient;
    this.service.clienteAnterior = cliente;
    this.service.currencyModule = this.currencyService.getCurrencyModule(coModule);
    if (this.service.currencyModule) {
      this.loadCurrencyModule();
    }
    this.page = 0;
    this.scrollDisable = false;
    this.service.idEnterprise = idEnterprise;
    this.updateClientList(idEnterprise);


  }

  onModalOpen() {
    //console.log("modal abierto");
    this.searchMode = false;
    this.searchText = '';
    this.scrollDisable = false;
    this.clientes = this.service.clientes;
    if (this.clientes.length == 0) {
      this.updateClientList(this.service.idEnterprise);
    }
  }
  setSkin(nombreModulo: string, colorModulo: string) {
    this.colorModulo = colorModulo;
    this.nombreModulo = nombreModulo;

    this.service.colorModulo = colorModulo;
    this.service.nombreModulo = nombreModulo;
  }

  loadCurrencyModule() {
    //carga variables que dependen del currencyModule
    this.showConversion = this.service.currencyModule.showConversion;
    this.localCurrencyDefault = this.service.currencyModule.localCurrencyDefault;
    if (this.service.currencyModule.idModule > 0) {
      this.currencySwitchEnabled = true;
    }
  }

  updateClientList(idEnterprise: number): Promise<any> {

    return this.messageService.showLoading().then(() => {
      this.service.idEnterprise = idEnterprise;
      return this.getClients(idEnterprise).then(() => {
        //console.log("Clientes cargados");
      });
    });
  }

  getClients(idEnterprise: number): Promise<any> {
    this.searchMode = false;
    return this.clientServ.getClients(idEnterprise, this.page).then(result => {
      this.handleUpdateClientList(result);
    });
  }

  searchClients(idEnterprise: number, searchText: string): Promise<any> {
    this.searchMode = true;
    return this.messageService.showLoading().then(() => {
      return this.clientServ.searchClients(idEnterprise, searchText, this.page).then(result => {
        this.handleUpdateClientList(result);
      });
    });
  }

  async handleUpdateClientList(result: Client[]) {
    this.scrollDisable = result.length < this.clientServ.MAX_ITEMS_PER_PAGE;
    if (this.page == 0) {
      this.clientes = [] as Client[];
      this.service.clientes = [] as Client[];
    }

    let clientsToShow = result;
    if (this.collectLogic.userCanCollectIva && this.collectLogic.cobro25) {
      clientsToShow = result.filter(client => client.collectionIva);
    }

    if (this.multimoneda) {
      this.fixClientListSaldos(clientsToShow);
    }
/*
    if (this.globalConfig.get("clientsOrderBy") == "due_date") {
      await this.oderByDueDateAndSaldo(clientsToShow);
    }
*/

    this.clientes = [...this.clientes, ...clientsToShow];
    //}
    //console.log("[ClienteSelector] Lista de clientes actualizada");
    this.noClientsAlertShown = this.clientes.length == 0;
    //para usarlo luego
    if (!this.searchMode) {
      this.service.clientes = this.clientes;
    }
    this.service.checkClient = false;
    this.messageService.hideLoading();
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

  fixClientListSaldos(result: any) {
    //mostrando los saldos correctamente
    let saldoCliente = 0, saldoOpuesto = 0;
    for (let c = 0; c < result.length; c++) {
      if (result[c].coCurrency == this.localCurrency.coCurrency) {
        saldoCliente = result[c].saldo1 + this.currencyService.toLocalCurrency(result[c].saldo2);
        saldoOpuesto = this.currencyService.toHardCurrency(saldoCliente);
      } else {
        saldoCliente = result[c].saldo1 + this.currencyService.toHardCurrency(result[c].saldo2);
        saldoOpuesto = this.currencyService.toLocalCurrency(saldoCliente);
      }
      result[c].saldo1 = saldoCliente;
      result[c].saldo2 = saldoOpuesto;

      if (this.currencySwitchEnabled && this.localCurrencyDefault) {
        //la primera moneda es la local
        if (result[c].coCurrency != this.localCurrency.coCurrency) {
          //cambiamos la moneda del cliente
          result[c].coCurrency = this.oppositeCoCurrency(result[c].coCurrency);
          var tempSaldo = result[c].saldo1;
          result[c].saldo1 = result[c].saldo2;
          result[c].saldo2 = tempSaldo;
        }
      } else {
        //la primera moneda es la dura
        if (result[c].coCurrency != this.hardCurrency.coCurrency) {
          //cambiamos la moneda del cliente
          result[c].coCurrency = this.oppositeCoCurrency(result[c].coCurrency);
          var tempSaldo = result[c].saldo1;
          result[c].saldo1 = result[c].saldo2;
          result[c].saldo2 = tempSaldo;
        }
      }

      saldoCliente = saldoOpuesto = 0;

    }
    return result;
  }

  @Output() clienteSeleccionado: EventEmitter<Client> = new EventEmitter<Client>();
  selectClient(input: Client) {

    if (this.service.checkClient && this.service.clienteAnterior != null
      && this.service.clienteAnterior.idClient != input.idClient) {
      //mostramos ventana
      this.cliente = input;
      this.setClientChangeOpen(true);
    } else {
      this.service.clienteAnterior = input;
      this.clienteSeleccionado.emit(input);
      this.closeModal();
    }

  }

  sendClient() {
    //this.clienteSeleccionado.emit(this.cliente);
    this.service.onCLientChanged(this.cliente);
  }


  handleInput(event: any) {

    //no se usa por ahora
    this.noClientsAlertShown = false;
    this.searchText = event.target.value.toLowerCase();


    let countCoClient = this.clientes.filter(c => c.coClient.toLowerCase().includes(this.searchText)).length;
    let countLbClient = this.clientes.filter(c => c.lbClient.toLowerCase().includes(this.searchText)).length;
    this.noClientsAlertShown = (countCoClient + countLbClient) == 0;
  }

  /*
  getClients() {
    //console.log("getClients")
    return this.clientServ.getClients(1);
  }
  */

  closeModal() {
    this.modal.dismiss(null, 'cancel');
    //console.log("cerre el modal de cliente");
  }

  /*
  onIonInfinite(ev: any) {
    this.indice++;
    setTimeout(() => {
      (ev as InfiniteScrollCustomEvent).target.complete();
    }, 800);
  }*/

  oppositeCoCurrency(coCurrency: string) {
    return this.currencyService.oppositeCoCurrency(coCurrency);
  }

  setClientChangeOpen(value: boolean) {
    this.btnAceptar = this.getTag('CLI_ACEPTAR');
    this.btnCancelar = this.getTag('CLI_CANCELAR');
    this.headerConfirm = this.getTag('CLI_HEADER_ALERTA');
    this.mensajeClientChange = this.getTag('CLI_RESET_CONFIRMA');
    this.buttonsClientChange = [
      {
        text: this.btnCancelar,
        role: 'cancel',
        handler: () => {
          this.clientChangeOpen = false;
          this.closeModal();

        }
      },

      {
        text: this.btnAceptar,
        role: 'confirm',
        handler: () => {

          this.service.clienteAnterior = this.cliente;
          this.sendClient();
          this.closeModal();

        },
      }

    ];


    this.clientChangeOpen = value;
  }

  public buttonsClientChange = [

    {
      text: this.btnAceptar,
      role: 'confirm',
      handler: () => {

        this.service.clienteAnterior = this.cliente;
        this.sendClient();

      },
    },
    {
      text: this.btnCancelar,
      role: 'cancel',
      handler: () => {
        this.closeModal()
      }
    }
  ];

  onSearchClicked(event?: Event) {
    event?.preventDefault();
    const inputElement = event?.target as HTMLInputElement | null;
    this.messageService.showLoading();
    if (inputElement) {
      this.searchText = inputElement.value;
    }
    this.page = 0;
    if (this.searchText.trim() == '') {
      this.onModalOpen();
    } else {
      this.searchClients(this.service.idEnterprise, this.searchText);
    }


  }
  onIonInfinite(ev: InfiniteScrollCustomEvent) {
    this.page++;
    if (this.searchMode) {
      this.searchClients(this.service.idEnterprise, this.searchText).then(() => {
        (ev as InfiniteScrollCustomEvent).target.complete();
        this.messageService.hideLoading();
      });
    } else {
      this.getClients(this.service.idEnterprise).then(() => {
        (ev as InfiniteScrollCustomEvent).target.complete();
      });
    }
  }


}
