import { AfterViewInit, Component, OnInit, inject, ViewChild } from '@angular/core';
import { ClienteSelectorComponent } from 'src/app/cliente-selector/cliente-selector.component';
import { Client } from 'src/app/modelos/tables/client';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';
import { COLOR_AMARILLO, DELIVERY_STATUS_NEW, DELIVERY_STATUS_TO_SEND } from 'src/app/utils/appConstants';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ClientStocksDetail, ClientStocksDetailUnits } from 'src/app/modelos/tables/client-stocks';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { Subscription } from 'rxjs/internal/Subscription';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { ClienteSelectorService } from 'src/app/cliente-selector/cliente-selector.service';
import { ClientesDatabaseServicesService } from 'src/app/services/clientes/clientes-database-services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { formatClientForTab } from 'src/app/utils/client-display.util';
import {
  TEXT_COMMENT_MAX_LENGTH,
  TEXT_COMMENT_MIN_LENGTH,
} from 'src/app/utils/text-comment-field.constants';
import { applyTextCommentMaxLength } from 'src/app/utils/text-comment-field.util';



@Component({
  selector: 'app-inventario-general',
  templateUrl: './inventario-general.component.html',
  styleUrls: ['./inventario-general.component.scss'],
  standalone: false
})
export class InventarioGeneralComponent implements OnInit, AfterViewInit {

  readonly textCommentMaxLength = TEXT_COMMENT_MAX_LENGTH;
  readonly textCommentMinLength = TEXT_COMMENT_MIN_LENGTH;

  @ViewChild(ClienteSelectorComponent)
  selectorCliente!: ClienteSelectorComponent;

  @ViewChild('txCommentInput', { static: false })
  txCommentInput: any;

  public enterpriseServ = inject(EnterpriseService);
  public inventariosLogicService = inject(InventariosLogicService);
  public dateServ = inject(DateServiceService);
  public img = inject(ImageServicesService);
  public message = inject(MessageService);
  public adjuntoService = inject(AdjuntoService)
  private config = inject(GlobalConfigService)
  public geoServ = inject(GeolocationService);
  private orderServ = inject(PedidosService);
  public clientService = inject(ClientesDatabaseServicesService);
  public dbServ = inject(SynchronizationDBService);

  public daClientStock: string = ""
  public txComment: string = ""
  public coordenada: string = ""
  public checkAddressClient!: boolean;

  public viewOnly: boolean = false;
  public newClient!: Client;
  public cambieCLiente: boolean = false;
  public direccionAnterior!: number;
  public coDireccionAnterior!: string;
  showDateModal: boolean = false;
  daysSinceLastInventory: number = 1;
  daysUntilNextInventory: number = 1;
  public alertButtons = [
    {
      text: '',
      role: 'confirm'
    },
  ];

  ClientChangeSubscription: Subscription = this.clientSelectorService.ClientChanged.subscribe(client => {
    if (!this.canModifyClient()) {
      return;
    }
    void this.onConfirmedClientChange(client);
  })

  constructor(private clientSelectorService: ClienteSelectorService) { }

  ngOnInit() {
    this.message.hideLoading();
    this.inventariosLogicService.showProductList = false;
    this.viewOnly = this.inventariosLogicService.inventarioSent.valueOf();
    if (this.inventariosLogicService.initInventario) {
      this.alertButtons[0].text = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
      //ESTO PARA HACER EL PROCESO DE CARGA 1 SOLA VEZ Y NO CADA VEZ QUE SE LE DE A LA PESTANA GENERAL
      this.initInventario()
      this.adjuntoService.setup(this.dbServ.getDatabase(), this.config.get("signatureStock") == "true", this.viewOnly, COLOR_AMARILLO);
      this.inventariosLogicService.alertMessage = false;
      this.inventariosLogicService.alertMessageOpen = false;
      this.checkAddressClient = this.config.get("checkAddressClient").toLowerCase() === "true";
      this.inventariosLogicService.newClientStock.hasAttachments = this.adjuntoService.hasItems();
      this.inventariosLogicService.newClientStock.nuAttachments = this.adjuntoService.getNuAttachment();
    }
    this.txComment = this.inventariosLogicService.newClientStock.txComment;
    this.daysSinceLastInventory = this.inventariosLogicService.resolvePositiveInventoryDays(
      this.inventariosLogicService.newClientStock.daysSinceLast
    );
    this.daysUntilNextInventory = this.inventariosLogicService.resolvePositiveInventoryDays(
      this.inventariosLogicService.newClientStock.daysUntilNext
    );
  }

  ngAfterViewInit() {
    this.rearmSelectorAfterTabRestore();
  }

  ngOnDestroy() {
    this.ClientChangeSubscription.unsubscribe();
  }

  setChangesMade(value: boolean) {
    if (value) {
      this.inventariosLogicService.notifyStockEdited();
    }
  }

  initInventario() {
    this.inventariosLogicService.initInventario = false;
    this.inventariosLogicService.cliente = {} as Client;

    if (this.cambieCLiente){
      this.inventariosLogicService.cliente = this.newClient;
      this.inventariosLogicService.newClientStock.clientStockDetails = [] as ClientStocksDetail[];

    }

    this.message.showLoading().then(async () => {
      await this.enterpriseServ.setup(this.dbServ.getDatabase());
      this.inventariosLogicService.listaEmpresa = this.enterpriseServ.empresas;
      if (!this.inventariosLogicService.inventarioSent && this.canModifyClient()) {
        this.selectorCliente.setup(this.inventariosLogicService.listaEmpresa[0].idEnterprise, "Inventarios", 'fondoAmarillo', null, false, 'inv');
      }
      this.orderServ.empresaSeleccionada = this.inventariosLogicService.listaEmpresa[0];
      await this.orderServ.setup();
        //ESTO ES PARA CUANDO CAMBIE DE PESTANAS, RECUPERAR LA INFORMACION YA COLOCADA
        this.txComment = this.inventariosLogicService.newClientStock.txComment;
        this.daysSinceLastInventory = this.inventariosLogicService.resolvePositiveInventoryDays(
          this.inventariosLogicService.newClientStock.daysSinceLast
        );
        this.daysUntilNextInventory = this.inventariosLogicService.resolvePositiveInventoryDays(
          this.inventariosLogicService.newClientStock.daysUntilNext
        );
        if (this.inventariosLogicService.newClientStock.idClient == undefined) {

          //ESTOY REALIZANDO UN INVENTARIO DESDE 0
          this.inventariosLogicService.empresaSeleccionada = this.inventariosLogicService.listaEmpresa[0];
          this.geoServ.getCurrentPosition().then(coords => { this.coordenada = coords });
          this.inventariosLogicService.onClientStockValid(false);
          this.message.hideLoading();

        } else {

          //YA TENGO UN INVENTARIO VALIDO
          this.inventariosLogicService.selectedClient = true;
          this.inventariosLogicService.onClientStockValid(true);

          this.inventariosLogicService.cliente.idClient = this.inventariosLogicService.newClientStock.idClient;
          this.inventariosLogicService.cliente.coClient = this.inventariosLogicService.newClientStock.coClient;
          this.inventariosLogicService.cliente.lbClient = this.inventariosLogicService.newClientStock.lbClient;
          this.inventariosLogicService.cliente.naClient = this.inventariosLogicService.newClientStock.lbClient;
          this.inventariosLogicService.nombreCliente = this.inventariosLogicService.newClientStock.lbClient;

          //PARA BUSCAR LAS FOTOS DE UN INVENTARIO GUARDADO
          this.adjuntoService.getSavedPhotos(this.dbServ.getDatabase(), this.inventariosLogicService.newClientStock.coClientStock, "inventarios");

          this.inventariosLogicService.getAllAddressByClient(this.dbServ.getDatabase(), this.inventariosLogicService.cliente.idClient)

          if (!this.cambieCLiente) {

            this.inventariosLogicService.getClientStock(this.dbServ.getDatabase(), this.inventariosLogicService.newClientStock.coClientStock).then(clientStock => {
              console.log(clientStock);
              if (clientStock != undefined) {
                this.daClientStock = '';
                if (clientStock.clientStockDetails.length == 0) {
                  this.message.hideLoading();
                }

                for (var i = 0; i < this.inventariosLogicService.listaEmpresa.length; i++) {
                  if (this.inventariosLogicService.listaEmpresa[i].idEnterprise == this.inventariosLogicService.newClientStock.idEnterprise) {
                    this.inventariosLogicService.empresaSeleccionada = this.inventariosLogicService.listaEmpresa[i];
                    this.inventariosLogicService.enterpriseClientStock = this.inventariosLogicService.empresaSeleccionada;
                    if (!this.inventariosLogicService.inventarioSent && this.canModifyClient()) {
                      this.selectorCliente.updateClientList(this.inventariosLogicService.empresaSeleccionada.idEnterprise)
                        .then(() => this.finalizeSavedInventoryClientGuard());
                    }
                    break;
                  }
                }

                if (clientStock.clientStockDetails.length == 0) {
                  this.inventariosLogicService.newClientStock.clientStockDetails = [] as ClientStocksDetail[];
                  this.inventariosLogicService.markStockOpenedFromPersistedCopy();
                  this.message.hideLoading();
                } else {
                  const detailUnitPromises = clientStock.clientStockDetails.map((detail, detailIndex) =>
                    this.inventariosLogicService
                      .getClientStockDetailsUnits(this.dbServ.getDatabase(), detail.coClientStockDetail, detailIndex)
                      .then((data: readonly [number, ClientStocksDetailUnits[]] | never[]) => {
                        const [index, detailUnits] = data;
                        clientStock.clientStockDetails[index].clientStockDetailUnits = [...detailUnits];
                      })
                  );

                  Promise.all(detailUnitPromises).then(async () => {
                    this.inventariosLogicService.pauseStockDirtyTracking();
                    this.inventariosLogicService.newClientStock.clientStockDetails = clientStock.clientStockDetails;
                    this.inventariosLogicService.setVariablesMap();
                    this.inventariosLogicService.markStockOpenedFromPersistedCopy();
                    this.inventariosLogicService.resumeStockDirtyTracking();
                    await this.inventariosLogicService.refreshSuggestedOrdersIfEnabled(this.dbServ.getDatabase());

                    if (clientStock.stDelivery == 1 || clientStock.stDelivery == null) {
                      this.inventariosLogicService.getInfoUnit(this.dbServ.getDatabase(), clientStock).then(() => {
                        this.message.hideLoading();
                        this.finalizeSavedInventoryClientGuard();
                      });
                      return;
                    }

                    this.message.hideLoading();
                    this.finalizeSavedInventoryClientGuard();
                  });
                }


              } else {
                this.message.hideLoading();

              }

            }).catch(e => {
              console.log("Error al ejecutar getClientStock.");
              console.log(e);
              return null;
            });
          } else {
            this.message.hideLoading();
            this.finalizeSavedInventoryClientGuard();
          }

        }


        this.inventariosLogicService.empresaSeleccionada = this.inventariosLogicService.listaEmpresa[0];

        if (!this.inventariosLogicService.inventarioSent && this.canModifyClient()) {
          this.selectorCliente.updateClientList(this.inventariosLogicService.empresaSeleccionada.idEnterprise)
            .then(() => this.finalizeSavedInventoryClientGuard());
        }
    });
  }

  setDaysSinceLastInventory(){
    const days = this.inventariosLogicService.resolvePositiveInventoryDays(this.daysSinceLastInventory);
    this.daysSinceLastInventory = days;
    this.inventariosLogicService.newClientStock.daysSinceLast = days;
    void this.inventariosLogicService.refreshSuggestedOrdersIfEnabled(this.dbServ.getDatabase());
    this.inventariosLogicService.notifyStockEdited();
  }

  setDaysUntilNextInventory(){
    const days = this.inventariosLogicService.resolvePositiveInventoryDays(this.daysUntilNextInventory);
    this.daysUntilNextInventory = days;
    this.inventariosLogicService.newClientStock.daysUntilNext = days;
    void this.inventariosLogicService.refreshSuggestedOrdersIfEnabled(this.dbServ.getDatabase());
    this.inventariosLogicService.notifyStockEdited();
  }

  onEnterpriseSelect() {
    const enterprise = this.inventariosLogicService.empresaSeleccionada;

    this.reiniciarInventarioPorEnterprise(enterprise);

  }

  private async reiniciarInventarioPorEnterprise(enterprise: Enterprise) {
    this.inventariosLogicService.onClientStockValid(false);
    this.inventariosLogicService.initClientStockDetails();

    this.inventariosLogicService.empresaSeleccionada = enterprise;
    this.inventariosLogicService.enterpriseClientStock = enterprise;
    this.inventariosLogicService.cliente = {} as Client;
    this.inventariosLogicService.nombreCliente = "";
    this.inventariosLogicService.clientStockValid = false;
    this.inventariosLogicService.selectedClient = false;
    this.inventariosLogicService.newClientStock.idEnterprise = enterprise.idEnterprise;
    this.inventariosLogicService.newClientStock.coEnterprise = enterprise.coEnterprise;
    this.inventariosLogicService.newClientStock.daClientStock = this.dateServ.hoyISOFullTime();
    this.inventariosLogicService.newClientStock.txComment = "";
    this.inventariosLogicService.newClientStock.daysSinceLast = 1;
    this.inventariosLogicService.newClientStock.daysUntilNext = 1;

    this.txComment = "";
    this.daysSinceLastInventory = 1;
    this.daysUntilNextInventory = 1;
    this.daClientStock = this.inventariosLogicService.newClientStock.daClientStock;
    this.coordenada = "";
    this.cambieCLiente = false;

    if (this.inventariosLogicService.userMustActivateGPS) {
      this.geoServ.getCurrentPosition().then(coords => {
        this.coordenada = coords;
        this.inventariosLogicService.newClientStock.coordenada = coords;
      });
    }

    this.selectorCliente.setup(enterprise.idEnterprise, "Inventarios", 'fondoAmarillo', null, false, 'inv');
    this.orderServ.empresaSeleccionada = enterprise;
    await this.orderServ.setup();

  }

  canModifyClient(): boolean {
    return this.inventariosLogicService.newClientStock.stDelivery !== DELIVERY_STATUS_TO_SEND;
  }

  setClientfromSelector(cliente: Client) {
    if (cliente) {
      if (!this.canModifyClient()
        && cliente.idClient != this.inventariosLogicService.newClientStock.idClient) {
        return;
      }
      this.message.showLoading().then(() => {
        this.newClient = {} as Client;
        this.inventariosLogicService.isEdit = true;

        const isNewInventory = !this.inventariosLogicService.newClientStock.coClientStock;
        if (isNewInventory) {
          this.inventariosLogicService.newClientStock.coClientStock = this.dateServ.generateCO(0);
          this.inventariosLogicService.newClientStock.idClientStock = 0; // este se va a actualizar con la repsuesta del API
          this.inventariosLogicService.newClientStock.daClientStock = this.dateServ.hoyISOFullTime();
          this.inventariosLogicService.newClientStock.stDelivery = DELIVERY_STATUS_NEW; // 0 = Nuevo, 1 = Guardado, 2 = Por Enviar, 3 = Enviado
          this.inventariosLogicService.newClientStock.stClientStock = DELIVERY_STATUS_NEW;
        }

        this.inventariosLogicService.cliente = cliente;
        this.inventariosLogicService.cliente.naClient = cliente.naClient || cliente.lbClient;
        this.inventariosLogicService.clientStockValid = true;
        this.inventariosLogicService.nombreCliente = cliente.lbClient;
        this.inventariosLogicService.clientClientStock = this.inventariosLogicService.cliente;
        this.inventariosLogicService.newClientStock.idClient = this.inventariosLogicService.cliente.idClient;
        this.inventariosLogicService.newClientStock.coClient = this.inventariosLogicService.cliente.coClient;
        this.inventariosLogicService.newClientStock.lbClient = this.inventariosLogicService.cliente.lbClient;
        this.inventariosLogicService.newClientStock.idEnterprise = this.inventariosLogicService.empresaSeleccionada.idEnterprise;
        this.inventariosLogicService.newClientStock.coEnterprise = this.inventariosLogicService.empresaSeleccionada.coEnterprise;
        this.inventariosLogicService.newClientStock.idUser = Number(localStorage.getItem("idUser"));
        this.inventariosLogicService.newClientStock.coUser = localStorage.getItem('coUser') || "[]";
        this.inventariosLogicService.enterpriseClientStock = this.inventariosLogicService.empresaSeleccionada;
        this.inventariosLogicService.newClientStock.txComment = this.txComment;
        this.inventariosLogicService.newClientStock.coordenada = this.coordenada;
        this.syncClientChangeGuard(cliente);
        this.inventariosLogicService.getAllAddressByClient(this.dbServ.getDatabase(), this.inventariosLogicService.cliente.idClient).then((result) => {
          if (result) {
            this.direccionAnterior = this.inventariosLogicService.newClientStock.idAddressClient;
            this.coDireccionAnterior = this.inventariosLogicService.newClientStock.coAddressClient;
            this.inventariosLogicService.selectedClient = true;
            this.inventariosLogicService.onClientStockValid(true);
            this.inventariosLogicService.notifyStockEdited();
          } else {
            this.inventariosLogicService.selectedClient = false;
            this.inventariosLogicService.onClientStockValid(false);
            this.inventariosLogicService.message = this.inventariosLogicService.inventarioTags.get('INV_ERROR_LIST_ADDRESS')!;
            this.inventariosLogicService.alertMessageOpen = true;
          }
          this.message.hideLoading();
        });
      });
    }
    else {
      console.log("cliente vacio");
      this.inventariosLogicService.nombreCliente = "";
    }
  }

  setTXComment() {
    const clean = applyTextCommentMaxLength(
      this.cleanString(this.txComment),
      this.textCommentMaxLength,
    );
    if (this.txComment !== clean) {
      this.txComment = clean;
      this.inventariosLogicService.newClientStock.txComment = clean;
      if (this.txCommentInput && this.txCommentInput.value !== clean) {
        this.txCommentInput.value = clean;
      }
    } else {
      this.inventariosLogicService.newClientStock.txComment = this.txComment;
    }
    this.inventariosLogicService.notifyStockEdited();
  }

  cleanString(str: string): string {
    // COB-INV-COMMENT-001: no trim en ionInput — mismo criterio que Pedidos/Depósitos.
    str = str.replace(/;/g, '');
    str = str.replace(/'/g, '');
    str = str.replace(/"/g, '');

    return str;
  }

  getFechaValor() {
    if (this.inventariosLogicService.newClientStock.stDelivery != 3)
      this.inventariosLogicService.newClientStock.daClientStock = this.daClientStock;
  }

  daClientStockFormatted() {
    if (this.daClientStock.length < 1) {
      if (this.inventariosLogicService.newClientStock.daClientStock.length > 0) {
        this.daClientStock = this.inventariosLogicService.newClientStock.daClientStock;
      } else {
        this.daClientStock = this.dateServ.hoyISOFullTime();
      }
    }
    this.getFechaValor();
    return this.dateServ.formatComplete(this.daClientStock);
  }
  setResult() {
    this.inventariosLogicService.alertMessageOpen = false;
  }

  private async onConfirmedClientChange(client: Client): Promise<void> {
    await this.applyClientChangeReset(client);
    this.setClientfromSelector(client);
    this.clientSelectorService.checkClient = false;
    this.clientSelectorService.clienteAnterior = client;
    this.message.hideLoading();
  }

  private shouldEnableClientChangeGuard(): boolean {
    return !this.inventariosLogicService.inventarioSent
      && this.inventariosLogicService.newClientStock.idClient != undefined
      && this.canModifyClient()
      && this.inventariosLogicService.hasStockContentForClientChangeGuard();
  }

  private syncClientChangeGuard(client: Client): void {
    if (!this.canModifyClient() || this.inventariosLogicService.inventarioSent || !client?.idClient) {
      this.clientSelectorService.checkClient = false;
      return;
    }
    this.clientSelectorService.clienteAnterior = client;
    this.clientSelectorService.checkClient = this.inventariosLogicService.hasStockContentForClientChangeGuard();
  }

  private rearmSelectorAfterTabRestore(): void {
    if (!this.shouldEnableClientChangeGuard()) {
      const client = this.inventariosLogicService.cliente;
      if (client?.idClient) {
        this.syncClientChangeGuard(client);
      }
      return;
    }
    this.finalizeSavedInventoryClientGuard();
  }

  private finalizeSavedInventoryClientGuard(): void {
    if (!this.shouldEnableClientChangeGuard()) {
      return;
    }
    const client = this.inventariosLogicService.cliente;
    this.syncClientChangeGuard(client);
    const enterprise = this.inventariosLogicService.empresaSeleccionada;
    if (this.selectorCliente && enterprise?.idEnterprise) {
      this.selectorCliente.setup(
        enterprise.idEnterprise,
        'Inventarios',
        'fondoAmarillo',
        client,
        true,
        'inv'
      );
      void this.selectorCliente.updateClientList(enterprise.idEnterprise)
        .then(() => this.syncClientChangeGuard(client));
    }
  }

  private async applyClientChangeReset(newClient: Client): Promise<void> {
    const coClientStock = this.inventariosLogicService.newClientStock.coClientStock;
    this.inventariosLogicService.resetStockDraftOnClientChange();
    this.daysSinceLastInventory = 1;
    this.daysUntilNextInventory = 1;
    this.alertButtons[0].text = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_ACEPTAR')
      ?? 'Aceptar';
    this.adjuntoService.setup(this.dbServ.getDatabase(), this.config.get("signatureStock") == "true", this.viewOnly, COLOR_AMARILLO);
    this.daClientStock = this.inventariosLogicService.newClientStock.daClientStock || this.dateServ.hoyISOFullTime();
    this.newClient = newClient;
    this.cambieCLiente = false;
    if (coClientStock) {
      await this.inventariosLogicService.deletePersistedStockDetails(
        this.dbServ.getDatabase(),
        coClientStock,
      );
    }
  }

  onSucursalSelect() {
    let direccionCliente = this.inventariosLogicService.newClientStock.idAddressClient
    let header = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_HEADER_ALERTA');
    if (header == undefined) {
      header = "";
    }
    let message = this.inventariosLogicService.inventarioTagsDenario.get("DENARIO_CAMBIO_DIRECCION");
    if (message == undefined) {
      message = "";
    }
    let aceptar = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_CANCELAR');
    if (aceptar == undefined) {
      aceptar = "";
    }
    let cancelar = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_ACEPTAR');
    if (cancelar == undefined) {
      cancelar = "";
    }
    if (this.checkAddressClient &&
      (direccionCliente != this.direccionAnterior)) {
      //[checkAddressClient] mensaje de cambio de cliente
      this.message.alertCustomBtn(
        {
          header: header,
          message: message
        },
        [
          {
            text: aceptar,
            role: 'cancel',
            handler: () => {
              this.inventariosLogicService.newClientStock.idAddressClient = this.direccionAnterior;
              this.inventariosLogicService.newClientStock.coAddressClient = this.coDireccionAnterior;
            },
          },
          {
            text: cancelar,
            role: 'confirm',
            handler: () => {
              this.setChangesMade(true);
              this.direccionAnterior = this.inventariosLogicService.newClientStock.idAddressClient;
              this.coDireccionAnterior = this.inventariosLogicService.newClientStock.coAddressClient;
            },
          }
        ]
      )
    }
  }

  setShowDateModal(val: boolean) {
    this.showDateModal = val;
  }

  print() {
    console.log(this.inventariosLogicService.newClientStock);
  }

  get clienteTabLabel(): string {
    const cliente = this.inventariosLogicService.cliente;
    return formatClientForTab(cliente?.naClient, cliente?.coClient, cliente?.lbClient);
  }

}
