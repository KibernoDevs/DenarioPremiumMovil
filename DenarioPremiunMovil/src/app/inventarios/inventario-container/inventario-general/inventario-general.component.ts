import { Component, OnInit, inject, Input, ViewChild } from '@angular/core';
import { ClienteSelectorComponent } from 'src/app/cliente-selector/cliente-selector.component';
import { Client } from 'src/app/modelos/tables/client';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';
import { COLOR_AMARILLO, DELIVERY_STATUS_NEW } from 'src/app/utils/appConstants';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ClientStocks, ClientStocksDetail, ClientStocksDetailUnits } from 'src/app/modelos/tables/client-stocks';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { Subscription } from 'rxjs/internal/Subscription';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { Inventarios } from 'src/app/modelos/inventarios';
import { ProductUtil } from 'src/app/modelos/ProductUtil';
import { ClienteSelectorService } from 'src/app/cliente-selector/cliente-selector.service';
import { ClientesDatabaseServicesService } from 'src/app/services/clientes/clientes-database-services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';



@Component({
  selector: 'app-inventario-general',
  templateUrl: './inventario-general.component.html',
  styleUrls: ['./inventario-general.component.scss'],
  standalone: false
})
export class InventarioGeneralComponent implements OnInit {

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
  public changeClient: boolean = false;
  public newClient!: Client;
  public cambieCLiente: boolean = false;
  public direccionAnterior!: number;
  public coDireccionAnterior!: string;
  showDateModal: boolean = false;
  daysSinceLastInventory: number = 1;
  daysUntilNextInventory: number = 1;
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
  public alertButtons2 = [
    {
      text: '',
      role: 'cancel'
    },
    {
      text: '',
      role: 'confirm'
    },
  ];

  ClientChangeSubscription: Subscription = this.clientSelectorService.ClientChanged.subscribe(client => {

    //this.inventariosLogicService.alertMessage = true;
    //this.inventariosLogicService.message = "Se ha detectado cambio del cliente por lo que debera iniciar nuevamente la transacción."
    this.newClient = client;
    //this.reset();
    this.inventariosLogicService.client = client;
    this.cambieCLiente = true;
    this.inventariosLogicService.selectedClient = false;
    //this.nombreCliente = client.lbClient;
    /* this.collectService.initCollect = true;
    this.collectService.newClient = client;
    this.collectService.changeClient = true; */
    //this.collectService.fechaMayor = this.dateServ.hoyISO();


    this.inventariosLogicService.client = client;
    /* this.collectService.newClient = {} as Client; */
    this.changeClient = false;
    this.setClientfromSelector(this.inventariosLogicService.client);
    /*  this.collectService.cobroValid = false;
     this.reset(client); */
    this.inventariosLogicService.initInventario = true;
    this.clientSelectorService.checkClient = true;
    this.inventariosLogicService.selectedClient = false;
    this.ngOnInit();
    this.message.hideLoading();
  })

  constructor(private clientSelectorService: ClienteSelectorService) { }

  ngOnInit() {
    this.message.hideLoading();
    this.inventariosLogicService.showProductList = false;
    this.viewOnly = this.inventariosLogicService.inventarioSent.valueOf();
    if (this.inventariosLogicService.initInventario) {
      this.alertButtons[0].text = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
      this.alertButtons2[0].text = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_CANCELAR')!
      this.alertButtons2[1].text = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
      //ESTO PARA HACER EL PROCESO DE CARGA 1 SOLA VEZ Y NO CADA VEZ QUE SE LE DE A LA PESTANA GENERAL
      this.initInventario()
      this.adjuntoService.setup(this.dbServ.getDatabase(), this.config.get("signatureStock") == "true", this.viewOnly, COLOR_AMARILLO);
      //this.daClientStock = this.dateServ.hoyISOFullTime();
      this.inventariosLogicService.alertMessage = false;
      this.inventariosLogicService.alertMessageOpen = false;
      this.checkAddressClient = this.config.get("checkAddressClient").toLowerCase() === "true";
      /* this.daClientStock = this.dateServ.hoyISOFullTime();
      this.inventariosLogicService.fechaMenor = this.dateServ.hoyISO();    */
      this.inventariosLogicService.newClientStock.hasAttachments = this.adjuntoService.hasItems();
      this.inventariosLogicService.newClientStock.nuAttachments = this.adjuntoService.getNuAttachment();
    }
    this.txComment = this.inventariosLogicService.newClientStock.txComment;
    this.daysSinceLastInventory = this.inventariosLogicService.newClientStock.daysSinceLast;
    this.daysUntilNextInventory = this.inventariosLogicService.newClientStock.daysUntilNext;
  }



  ngOnDestroy() {
    this.ClientChangeSubscription.unsubscribe();
  }

  setChangesMade(value: boolean) {
    //ESTA FUNCION SE USARA PARA CONTROLAR SI PUEDO ENVIAR O GUARDAR, CVER QUE HAGO ACA
    this.inventariosLogicService.onStockValidToSave(value);
    this.inventariosLogicService.onStockValidToSend(value);
  }

  initInventario() {
    this.inventariosLogicService.initInventario = false;
    this.inventariosLogicService.cliente = {} as Client;

    if (this.cambieCLiente)
      this.inventariosLogicService.cliente = this.newClient;

    this.message.showLoading().then(() => {
      this.enterpriseServ.setup(this.dbServ.getDatabase()).then(() => {
        this.inventariosLogicService.listaEmpresa = this.enterpriseServ.empresas;
        if (!this.inventariosLogicService.inventarioSent) {
          //this.selectorCliente.updateClientList(this.inventariosLogicService.listaEmpresa[0].idEnterprise);
          //this.selectorCliente.setSkin(this.inventariosLogicService.inventarioTags.get('INV_NOMBRE_MODULO')!, "fondoAmarillo");
          this.selectorCliente.setup(this.inventariosLogicService.listaEmpresa[0].idEnterprise, "Inventarios", 'fondoAmarillo', null, false, 'inv');
          /*  this.clientService.getClientById(this.inventariosLogicService.newClientStock.idClient).then(client => {
            this.inventariosLogicService.client = client;
            this.selectorCliente.setup(this.inventariosLogicService.empresaSeleccionada.idEnterprise, "Inventarios", 'fondoVerde', client, false);


           }) */
        }
        this.orderServ.empresaSeleccionada = this.inventariosLogicService.listaEmpresa[0];
        this.orderServ.setup();
        //ESTO ES PARA CUANDO CAMBIE DE PESTANAS, RECUPERAR LA INFORMACION YA COLOCADA
        this.txComment = this.inventariosLogicService.newClientStock.txComment;
        this.daysSinceLastInventory = this.inventariosLogicService.newClientStock.daysSinceLast;
        this.daysUntilNextInventory = this.inventariosLogicService.newClientStock.daysUntilNext;
        if (this.inventariosLogicService.newClientStock.idClient == undefined) {

          //ESTOY REALIZANDO UN INVENTARIO DESDE 0
          this.inventariosLogicService.empresaSeleccionada = this.inventariosLogicService.listaEmpresa[0];
          this.geoServ.getCurrentPosition().then(coords => { this.coordenada = coords });
          //this.selectorCliente.updateClientList(this.inventariosLogicService.listaEmpresa[0].idEnterprise);
          this.inventariosLogicService.onClientStockValid(false);
          this.message.hideLoading();

        } else {

          //YA TENGO UN INVENTARIO VALIDO
          this.inventariosLogicService.selectedClient = true;
          this.inventariosLogicService.onClientStockValid(true);

          this.inventariosLogicService.cliente.idClient = this.inventariosLogicService.newClientStock.idClient;
          this.inventariosLogicService.cliente.coClient = this.inventariosLogicService.newClientStock.coClient;
          this.inventariosLogicService.cliente.lbClient = this.inventariosLogicService.newClientStock.lbClient;
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
                    if (!this.inventariosLogicService.inventarioSent) {
                      this.selectorCliente.updateClientList(this.inventariosLogicService.empresaSeleccionada.idEnterprise);

                    }
                    break;
                  }
                }

                if (clientStock.clientStockDetails.length == 0) {
                  this.inventariosLogicService.newClientStock.clientStockDetails = [] as ClientStocksDetail[];
                } else {
                  const detailUnitPromises = clientStock.clientStockDetails.map((detail, detailIndex) =>
                    this.inventariosLogicService
                      .getClientStockDetailsUnits(this.dbServ.getDatabase(), detail.coClientStockDetail, detailIndex)
                      .then((data: readonly [number, ClientStocksDetailUnits[]] | never[]) => {
                        const [index, detailUnits] = data;
                        clientStock.clientStockDetails[index].clientStockDetailUnits = [...detailUnits];
                      })
                  );

                  Promise.all(detailUnitPromises).then(() => {
                    this.inventariosLogicService.newClientStock.clientStockDetails = clientStock.clientStockDetails;
                    this.inventariosLogicService.setVariablesMap();
                    this.inventariosLogicService.onStockValidToSave(true);
                    this.inventariosLogicService.onStockValidToSend(true);

                    if (clientStock.stDelivery == 1 || clientStock.stDelivery == null) {
                      this.inventariosLogicService.getInfoUnit(this.dbServ.getDatabase(), clientStock).then(() => {
                        this.message.hideLoading();
                      });
                      return;
                    }

                    this.message.hideLoading();
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
            this.changeClient = false;
          }

        }


        this.inventariosLogicService.empresaSeleccionada = this.inventariosLogicService.listaEmpresa[0];

        if (!this.inventariosLogicService.inventarioSent) {
          this.selectorCliente.updateClientList(this.inventariosLogicService.empresaSeleccionada.idEnterprise);
        }
      });
    })
  }

  setDaysSinceLastInventory(){
    if(this.daysSinceLastInventory < 1){
      this.inventariosLogicService.newClientStock.daysSinceLast = 1;
      this.daysSinceLastInventory = 1;
    }else{
      this.inventariosLogicService.newClientStock.daysSinceLast = this.daysSinceLastInventory;
    }
  }

  setDaysUntilNextInventory(){
    if(this.daysUntilNextInventory < 1){
      this.inventariosLogicService.newClientStock.daysUntilNext = 1;
      this.daysUntilNextInventory = 1;
    }else{
      this.inventariosLogicService.newClientStock.daysUntilNext = this.daysUntilNextInventory;
    }
  }

  onEnterpriseSelect() {
    const enterprise = this.inventariosLogicService.empresaSeleccionada;

    this.reiniciarInventarioPorEnterprise(enterprise);

  }

  private reiniciarInventarioPorEnterprise(enterprise: Enterprise) {
    this.inventariosLogicService.onStockValidToSave(false);
    this.inventariosLogicService.onStockValidToSend(false);
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
    this.changeClient = false;
    this.cambieCLiente = false;

    if (this.inventariosLogicService.userMustActivateGPS) {
      this.geoServ.getCurrentPosition().then(coords => {
        this.coordenada = coords;
        this.inventariosLogicService.newClientStock.coordenada = coords;
      });
    }

    this.selectorCliente.setup(enterprise.idEnterprise, "Inventarios", 'fondoAmarillo', null, false, 'inv');
    this.orderServ.empresaSeleccionada = enterprise;
    this.orderServ.setup();

  }

  setClientfromSelector(cliente: Client) {
    if (cliente) {
      if (cliente.idClient != this.inventariosLogicService.newClientStock.idClient && this.changeClient) {
        /*  this.inventariosLogicService.alertMessage = true;
        this.inventariosLogicService.message = "Se ha detectado cambio del cliente por lo que debera iniciar nuevamente la transacción."
        this.newClient = cliente; */
      } else {
        this.message.showLoading().then(() => {
          this.changeClient = true;
          this.clientSelectorService.checkClient = true;
          this.newClient = {} as Client;
          this.inventariosLogicService.onStockValidToSave(true);
          this.inventariosLogicService.isEdit = true;
          this.inventariosLogicService.newClientStock.coClientStock = this.dateServ.generateCO(0);
          this.inventariosLogicService.newClientStock.idClientStock = 0; // este se va a actualizar con la repsuesta del API
          this.inventariosLogicService.cliente = cliente;
          this.inventariosLogicService.clientStockValid = true;
          this.inventariosLogicService.nombreCliente = cliente.lbClient;
          this.inventariosLogicService.clientClientStock = this.inventariosLogicService.cliente;
          //this.selectorCliente.updateClientList(this.inventariosLogicService.empresaSeleccionada.idEnterprise);
          this.inventariosLogicService.newClientStock.idClient = this.inventariosLogicService.cliente.idClient;
          this.inventariosLogicService.newClientStock.coClient = this.inventariosLogicService.cliente.coClient;
          this.inventariosLogicService.newClientStock.lbClient = this.inventariosLogicService.cliente.lbClient;
          this.inventariosLogicService.newClientStock.idEnterprise = this.inventariosLogicService.empresaSeleccionada.idEnterprise;
          this.inventariosLogicService.newClientStock.coEnterprise = this.inventariosLogicService.empresaSeleccionada.coEnterprise;
          this.inventariosLogicService.newClientStock.idUser = Number(localStorage.getItem("idUser"));
          this.inventariosLogicService.newClientStock.coUser = localStorage.getItem('coUser') || "[]";
          this.inventariosLogicService.enterpriseClientStock = this.inventariosLogicService.empresaSeleccionada;
          this.inventariosLogicService.newClientStock.daClientStock = this.dateServ.hoyISOFullTime();
          this.inventariosLogicService.newClientStock.txComment = this.txComment;
          this.inventariosLogicService.newClientStock.coordenada = this.coordenada;
          /* this.inventariosLogicService.newClientStock.daClientStock =  */
          this.inventariosLogicService.newClientStock.stDelivery = DELIVERY_STATUS_NEW; // 0 = Nuevo, 1 = Guardado, 2 = Por Enviar, 3 = Enviado
          this.inventariosLogicService.newClientStock.stClientStock = DELIVERY_STATUS_NEW;
          this.inventariosLogicService.getAllAddressByClient(this.dbServ.getDatabase(), this.inventariosLogicService.cliente.idClient).then((result) => {
            if (result) {
              this.direccionAnterior = this.inventariosLogicService.newClientStock.idAddressClient;
              this.coDireccionAnterior = this.inventariosLogicService.newClientStock.coAddressClient;
              this.inventariosLogicService.selectedClient = true;
              this.inventariosLogicService.onClientStockValid(true);
            } else {
              //setTimeout(() => {
              this.inventariosLogicService.selectedClient = false;
              this.inventariosLogicService.onStockValidToSave(false);
              this.inventariosLogicService.onStockValidToSend(false);
              this.inventariosLogicService.onClientStockValid(false);
              this.inventariosLogicService.message = this.inventariosLogicService.inventarioTags.get('INV_ERROR_LIST_ADDRESS')!;
              this.inventariosLogicService.alertMessageOpen = true;
              //}, 500);

            }
            this.message.hideLoading();
          });
        });

      }

    }
    else {
      console.log("cliente vacio");
      this.inventariosLogicService.nombreCliente = "";
    }
  }

  setTXComment() {
    const clean = this.cleanString(this.txComment);
    if (this.txComment !== clean) {
      this.txComment = clean;
      this.inventariosLogicService.newClientStock.txComment = clean;
      if (this.txCommentInput && this.txCommentInput.value !== clean) {
        this.txCommentInput.value = clean;
      }
    } else {
      this.inventariosLogicService.newClientStock.txComment = this.txComment;
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

  getFechaValor() {
    // this.dateServ.hoyISO();
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
  setResult2(ev: any) {
    if (ev.detail.role === 'confirm') {
      //CAMBIAR CLIENTE
      this.inventariosLogicService.alertMessage = false;
      this.changeClient = false;
      this.inventariosLogicService.selectedClient = false;
      this.inventariosLogicService.inventarioSent = false;
      this.inventariosLogicService.disableSaveButton = true;
      this.inventariosLogicService.cannotSendClientStock = true;
      this.inventariosLogicService.newClientStock = {} as ClientStocks;
      this.inventariosLogicService.newClientStock.clientStockDetails = [] as ClientStocksDetail[];
      this.inventariosLogicService.newClientStock.productList = [] as ProductUtil[];
      this.inventariosLogicService.productTypeStocksMap = new Map<number, number>();
      this.inventariosLogicService.typeStocks = [] as Inventarios[];
      this.inventariosLogicService.initInventario = false;
      this.alertButtons[0].text = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
      this.alertButtons2[0].text = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_CANCELAR')!
      this.alertButtons2[1].text = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
      this.adjuntoService.setup(this.dbServ.getDatabase(), this.config.get("signatureStock") == "true", this.viewOnly, COLOR_AMARILLO);
      this.daClientStock = this.dateServ.hoyISOFullTime();
      this.inventariosLogicService.alertMessage = false;
      this.inventariosLogicService.alertMessageOpen = false;
      this.setClientfromSelector(this.newClient);
    } else {
      //NO HAGO NADA
      this.inventariosLogicService.alertMessage = false;
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
              //console.log('Alert canceled');
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


}
