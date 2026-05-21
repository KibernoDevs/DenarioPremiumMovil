import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common'
import { DateServiceService } from '../../services/dates/date-service.service';
import { Client } from '../../modelos/tables/client';
import { VisitasService } from '../visitas.service';
import { ServicesService } from '../../services/services.service';
import { SynchronizationDBService } from '../../services/synchronization/synchronization-db.service';
import { ClienteSelectorComponent } from '../../cliente-selector/cliente-selector.component';
import { AdjuntoComponent } from 'src/app/adjuntos/adjunto/adjunto.component';
import { IncidenceType } from 'src/app/modelos/tables/incidenceType';
import { IncidenceMotive } from 'src/app/modelos/tables/incidenceMotive';
import { EventoVisita } from 'src/app/modelos/evento-visita';
import { MessageService } from 'src/app/services/messageService/message.service';
import { MessageComponent } from 'src/app/message/message.component';
import { Visit } from 'src/app/modelos/tables/visit';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { Incidence } from 'src/app/modelos/tables/incidence';
import { VISIT_STATUS_NOT_VISITED, VISIT_STATUS_TO_SEND, VISIT_STATUS_VISITED, VISIT_STATUS_SAVED, COLOR_LILA, VISIT_IS_DISPATCHED_NO, VISIT_IS_DISPATCHED_PARTIAL, VISIT_IS_DISPATCHED_YES } from 'src/app/utils/appConstants';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { PendingTransaction } from 'src/app/modelos/tables/pendingTransactions';
import { AutoSendService } from 'src/app/services/autoSend/auto-send.service';
import { Router } from '@angular/router';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ClienteSelectorService } from 'src/app/cliente-selector/cliente-selector.service';
import { AddresClient } from 'src/app/modelos/tables/addresClient';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { ClientLocationComponent } from 'src/app/clientes/client-container/client-location/client-location.component';
import { SelectedClient } from 'src/app/modelos/selectedClient';
import { ClientLocationService } from 'src/app/services/clientes/locationClient/client-location.service';
import { ClientesDatabaseServicesService } from 'src/app/services/clientes/clientes-database-services.service';


@Component({
  selector: 'app-visita',
  templateUrl: './visita.component.html',
  styleUrls: ['./visita.component.scss'],
  standalone: false
})
export class VisitaComponent implements OnInit {
  //injects
  adjuntoService = inject(AdjuntoService);
  dateServ = inject(DateServiceService);
  visitServ = inject(VisitasService);
  servicesServ = inject(ServicesService);
  syncServ = inject(SynchronizationDBService);
  message = inject(MessageService);
  geoServ = inject(GeolocationService);
  enterpriseServ = inject(EnterpriseService);
  autoSend = inject(AutoSendService);
  router = inject(Router);
  platform = inject(Platform);
  location = inject(Location);
  clientSelectorService = inject(ClienteSelectorService);
  clientLogic = inject(ClientLogicService);
  clientLocationServ = inject(ClientLocationService);
  clientDBServ = inject(ClientesDatabaseServicesService);
  messageAlert!: MessageAlert;

  segment = 'default';
  fechaMinima = this.dateServ.hoyISO();
  fechaVisita = this.dateServ.hoyISOFullTime();
  fechaInitial = ''; //fecha que se obtiene al darle al boton "nueva visita"
  cliente = {} as Client;
  direccionCliente!: AddresClient;
  direccionAnterior!: AddresClient;
  clienteAnterior = {} as Client;
  nombreCliente: string = "";
  listaActividades!: IncidenceType[];
  listaMotivos!: IncidenceMotive[];
  listaMotivosFiltrados!: IncidenceMotive[];
  listaDirecciones: AddresClient[] = [];
  motiveLock = true;
  initialLock = false;
  hasClient = false;
  //coordenadas: string = "";
  nuSequence: number = 1;
  actividadSeleccionada!: IncidenceType | null;
  motivoSeleccionado!: IncidenceMotive | null;
  comentario: string = "";
  multiempresa = false;
  listaEmpresa: Enterprise[] = [];
  empresaSeleccionada!: Enterprise;
  listaEventos: EventoVisita[] = [];

  eventosABorrar: EventoVisita[] = [];
  eventoAEditar: number = -1;

  showEventModal = false;

  showDateModal = false;

  changesMade: boolean = false;

  disableSaveButton = false;
  disableSendButton = false;
  disabledButtonEvent = false;
  actividadRequiereEvento = false;
  actividadRequiereFirma = false;

  clientRedLabel = false;
  initVisitRedLabel = false;
  initVisitRedMsg = "";
  addressRedLabel = false;
  disabledButtonViewRoute = true;
  estadoDespacho: string = '';
  observacionDespacho: string = '';
  public rolTransportista: boolean = false;
  showReagendarModal = false;
  reagendarData: { fecha: string, motivo: string } | null = null;
  motivoReagendo: string = '';
  fechaReagendo: string = '';
  fechaMinimaReagendo: string = '';

  signatureSubscription: Subscription = this.adjuntoService.signatureChanged.subscribe(firma => {
    this.checkFirmaAndDisableSend();
  });

  AttachSubscription: Subscription = this.adjuntoService.AttachmentChanged.subscribe(() => {
    this.setChangesMade(true);
    this.checkFirmaAndDisableSend();
  });

  AttachLimitExceededSubscription: Subscription = this.adjuntoService.AttachmentWeightExceeded.subscribe(() => {
    this.setChangesMade(false);//no permitimos cambios si se excede el peso
  });

  ClientChangeSubscription: Subscription = this.clientSelectorService.ClientChanged.subscribe(client => {

    this.reset();
    this.cliente = client;
    if (this.cliente.coordenada == undefined || this.cliente.coordenada == null) {
      this.disabledButtonViewRoute = true;
    } else
      this.disabledButtonViewRoute = true;
    this.nombreCliente = client.lbClient;
  });

  backButtonSubscription: Subscription = this.platform.backButton.subscribeWithPriority(10, () => {
    //console.log('backButton was called!');
    if (this.showEventModal) {
      //cerramos el modal de eventos primero.
      this.resetEventSelect();
    } else {
      this.goBack();
    }
  });

  viewOnly: boolean = false;// solo lectura, no se puede cambiar nada
  fromWeb: boolean = false; //viene desde la web, ciertas cosas no se pueden modificar

  public saveOrExitOpen = false;
  public alertConfirmSend = false;

  public clientChangeOpen = false;

  public headerSave!: string;
  public saveAndExitBtn!: string;
  public exitBtn!: string;
  public cancelBtn!: string;

  public mensajeClientChange: string = "";

  //config
  public enterpriseEnabled!: boolean;
  public userMustActivateGPS!: boolean;
  public checkAddressClient!: boolean;
  //fin config


  public headerConfirm!: string;
  public mensajeConfirm!: string;

  @ViewChild(ClienteSelectorComponent)
  selectorCliente!: ClienteSelectorComponent;
  @ViewChild(AdjuntoComponent)
  selectorAdjuntos!: AdjuntoComponent;

  @ViewChild('comentarioInput', { static: false })
  comentarioInput: any;

  popoverOptions = {
    side: "bottom",
    alignment: "center",
    reference: "trigger",

  }

  constructor(
  ) {
    this.clientLogic.clientLocationComponent = false;

  }

  ngOnInit() {

    this.enterpriseServ.setup(this.syncServ.getDatabase()).then(() => {

      this.listaEmpresa = this.enterpriseServ.empresas;
      this.empresaSeleccionada = this.listaEmpresa[0];
      this.multiempresa = this.enterpriseServ.esMultiempresa();
      this.enterpriseEnabled = this.visitServ.enterpriseEnabled;
      this.checkAddressClient = this.visitServ.checkAddressClient;
      this.rolTransportista = this.visitServ.rolTransportista;
      this.listaActividades = this.visitServ.listaActividades;
      this.listaMotivos = this.visitServ.listaMotivos;
      this.listaEventos = [];
      this.onDateSelect();
      this.setChangesMade(false);

      if (this.visitServ.editVisit) {
        //poblamos la data con lo que esta en la visita guardada
        var visita = this.visitServ.visit;


        if (this.multiempresa) {
          for (let i = 0; i < this.listaEmpresa.length; i++) {
            const empresa = this.listaEmpresa[i];
            if (empresa.idEnterprise === visita.idEnterprise) {
              this.empresaSeleccionada = empresa;
              break
            }
          }
        }

        this.fechaVisita = this.fechaMinima = this.dateServ.toISOString(visita.daVisit);
        this.fechaInitial = visita.daInitial;
        this.visitServ.coordenadas = visita.coordenada;
        this.clientDBServ.getClientById(visita.idClient).then(client => {
          this.cliente = client;
          this.setClientfromSelector(this.cliente);
          if (this.rolTransportista)
            this.selectorCliente?.setup(this.empresaSeleccionada.idEnterprise,
              this.getTag("VIS_NOMBRE_MODULO_DESPACHOS"), "fondoLila", null, false, 'vis');
          else
            this.selectorCliente?.setup(this.empresaSeleccionada.idEnterprise,
              this.getTag("VIS_NOMBRE_MODULO"), "fondoLila", null, false, 'vis');

        });
        /*
        this.cliente.idClient = visita.idClient;
        this.cliente.coClient = visita.coClient;
        this.cliente.lbClient = this.nombreCliente = visita.naClient;
        this.cliente.idAddressClients = visita.idAddressClient;
        this.cliente.coAddressClients = visita.coAddressClient;
        */
        this.nuSequence = visita.nuSequence;
        this.viewOnly = (visita.stVisit == VISIT_STATUS_VISITED);
        this.fromWeb = (visita.stVisit == VISIT_STATUS_NOT_VISITED);
        this.initialLock = this.fromWeb;
        this.adjuntoService.setup(this.syncServ.getDatabase(), this.visitServ.signatureVisit, this.viewOnly, COLOR_LILA);
        this.adjuntoService.getSavedPhotos(this.syncServ.getDatabase(), visita.coVisit, 'visitas');

        // y las incidencias tambien:
        for (let i = 0; i < visita.visitDetails.length; i++) {
          const inc = visita.visitDetails[i];

          let motive = this.listaMotivos.find((im) => {
            return im.idMotive == inc.coCause;
          })
          let tipo = this.listaActividades.find((it) => {
            return it.idType == inc.coType;
          });

          if (motive && tipo) {
            var ev = {
              pos: i,
              coIncid: inc.coIncid,
              actividad: tipo,
              evento: motive,
              comentario: inc.txDescription,
              saved: true
            } as EventoVisita;



            this.listaEventos.push(ev)
          }
          ;
        }
        this.disableSendButton = this.fromWeb;


      } else {
        this.visitServ.visit = {} as Visit;
        this.visitServ.visit.stVisit = VISIT_STATUS_SAVED;
        this.viewOnly = false;
        this.fromWeb = false;
        this.fechaInitial = this.dateServ.hoyISOFullTime();
        if (this.rolTransportista)
          this.selectorCliente.setup(this.empresaSeleccionada.idEnterprise,
            this.getTag("VIS_NOMBRE_MODULO_DESPACHOS"), "fondoLila", null, false, 'vis');
        else
          this.selectorCliente.setup(this.empresaSeleccionada.idEnterprise,
            this.getTag("VIS_NOMBRE_MODULO"), "fondoLila", null, false, 'vis');

        this.adjuntoService.setup(this.syncServ.getDatabase(), this.visitServ.signatureVisit, this.viewOnly, COLOR_LILA);
      }


      const hoy = new Date();
      hoy.setDate(hoy.getDate() + 1);
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, '0');
      const dd = String(hoy.getDate()).padStart(2, '0');
      this.fechaMinimaReagendo = `${yyyy}-${mm}-${dd}`;
      // ...resto de tu código...F
    });

    this.headerConfirm = this.getTag('DENARIO_HEADER_ALERTA');
    if (this.rolTransportista)
      this.mensajeConfirm = this.getTag('VIS_MENSAJE_ENVIAR_DESPACHO');
    else
      this.mensajeConfirm = this.getTag('VIS_MENSAJE_ENVIAR');

    this.headerSave = this.getTag('DENARIO_HEADER_ALERTA');
    this.saveAndExitBtn = this.getTag('DENARIO_BOTON_SALIR_GUARDAR');
    this.exitBtn = this.getTag('DENARIO_BOTON_SALIR');
    this.cancelBtn = this.getTag('DENARIO_BOTON_CANCELAR');

    //this.mensajeClientChange = this.getTag("VIS_RESET_CONFIRMA");

    this.setButtonsSalvar();

    if (!this.visitServ.userMustActivateGPS &&
      (this.visitServ.visit.stVisit === VISIT_STATUS_NOT_VISITED ||
        this.visitServ.visit.stVisit === VISIT_STATUS_SAVED)) {
      //si esta desactivado, se hace el chequeo suave de fondo.
      //no bloqueamos si coords esta vacio
      if (this.visitServ.coordenadas == "") {
        this.geoServ.getCurrentPosition().then(coords => {
          if (coords.length > 0) {
            this.visitServ.coordenadas = coords;
            this.disabledButtonViewRoute = false;
          }
        })
      }
    } else {
      this.disabledButtonViewRoute = true;
    }
    this.clientLogic.getTags();

    this.message.hideLoading();

  }

  reset() {
    this.fechaMinima = this.dateServ.hoyISO();
    this.fechaVisita = this.dateServ.hoyISOFullTime();
    this.cliente = {} as Client;
    this.listaEventos = [];
    this.setChangesMade(false);

    this.adjuntoService.setup(this.syncServ.getDatabase(), this.visitServ.signatureVisit, this.viewOnly, COLOR_LILA);
  }

  ngOnDestroy() {
    this.AttachSubscription.unsubscribe();
    this.ClientChangeSubscription.unsubscribe();
    this.backButtonSubscription.unsubscribe();
    if (this.signatureSubscription) {
      this.signatureSubscription.unsubscribe();
    }
    this.AttachLimitExceededSubscription.unsubscribe();
  }


  iniciarVisita() {
    // Limpiamos coordenadas previas para evitar arrastre entre visitas.
    this.visitServ.coordenadas = "";
    if (this.visitServ.userMustActivateGPS) {
      //en este caso no se puede continuar si no hay coordenadas
      this.geoServ.getCurrentPosition().then(coords => {
        if (coords.length > 0) {

          this.segment = 'actividades';
        } else {
          console.log("no hay coordenadas, locacion debe estar inactiva");
          this.initialLock = true;
          this.initVisitRedMsg = this.getTag("DENARIO_ERR_GPS");
          this.initVisitRedLabel = true;
        }
        this.setCoordinates(coords);
      });
    } else {
      //si no es obligatorio, puede iniciar sin coords y se buscan en el fondo.
      this.initialLock = false;
      this.segment = 'actividades';
      this.geoServ.getCurrentPosition().then(coords => {
        if (coords.length > 0) {
          this.setCoordinates(coords);
        }
      });

    }
  }

  setCoordinates(coords: string) {
    this.visitServ.coordenadas = coords
    this.fechaInitial = this.dateServ.hoyISOFullTime();
    console.log("iniciando visita: " + this.fechaInitial);
    this.initialLock = false;
    this.initVisitRedLabel = false;
  }

  setClientfromSelector(cliente: Client) {
    if (cliente != null) {
      this.cliente = cliente;
      if (this.cliente.coordenada == undefined || this.cliente.coordenada == null) {
        this.disabledButtonViewRoute = true;
      } else
        this.disabledButtonViewRoute = true;
      this.hasClient = true;
      //SI no hay cliente anterior, y no seleccionó el mismo anterior, y hay eventos o Adjuntos, deberia resetear
      if (this.clienteAnterior.idClient != null && cliente.idClient != this.clienteAnterior.idClient && (this.listaEventos.length > 0 || this.adjuntoService.hasItems())) {
        //si hay un cliente anterior debo preguntarle al usuario
        //si quiere cambiar (y resetear la visita)
        //o regresar al cliente anterior
        this.setClientChangeOpen(true);

      } else {
        this.clienteAnterior = cliente;
        this.clientRedLabel = false;
      }
      this.nombreCliente = cliente.lbClient;
      this.setChangesMade(true);

      let idAddressClients: number;
      idAddressClients = cliente.idAddressClients;

      this.visitServ.getAddressClient(cliente.idClient).then(data => {
        this.listaDirecciones = data;

        let dir = data.find((dir) => dir.idAddress == idAddressClients);
        if (dir != undefined) {

          this.direccionCliente = dir;
        } else {
          this.direccionCliente = data[0];
        }


        /////ACA VALIDAR, SI ROL TRANSPORTISTA, VERIFICAR SI///////
        /////TENGO ASIGNADA UNA VISTA CON ESTE CLIENTE Y CON ESTA SUCURSAL//////
        ///************* */
        if (this.rolTransportista) {
          this.visitServ.getVisitList(this.dateServ.onlyDateHoyISO() + "%").then(list => {

            console.log(list);
            let visit = list.find(v => v.idClient === this.cliente.idClient && v.idAddressClient === this.direccionCliente.idAddress);
            /* if (visit && visit.stVisit != VISIT_STATUS_NOT_VISITED) {
              // Cierra cualquier mensaje/modal activo antes de mostrar el error
              if (this.message.dismissAll) {
                this.message.dismissAll();
              }
              this.message.transaccionMsjModalNB(this.getTag('VIS_MENSAJE_CLIENT_SUCURSAL'));
              this.initialLock = true;
              this.disabledButtonViewRoute = true;
            } else {
              // ...tu lógica normal...
            } */

          })
        }
        ///************* */

        if (this.visitServ.coordenadas != "" && this.direccionCliente.coordenada != "") {
          this.disabledButtonViewRoute = false;
        } else {
          this.disabledButtonViewRoute = true;
        }

        this.direccionAnterior = this.direccionCliente;
        this.onAddressSelect();

      })


    }
    else {
      console.log("cliente vacio");
      this.nombreCliente = "";
      this.hasClient = false;
    }
  }

  onEnterpriseSelect() {
    this.selectorCliente.updateClientList(this.empresaSeleccionada.idEnterprise);
    this.cliente = {} as Client;
    this.nombreCliente = "";
    this.setChangesMade(true);
  }

  onAddressSelect() {
    this.cliente.coAddressClients = this.direccionCliente.coAddress;
    this.cliente.idAddressClients = this.direccionCliente.idAddress;
    if (this.direccionCliente != null) {
      if (
        this.checkAddressClient &&
        (this.direccionCliente.idAddress != this.direccionAnterior.idAddress)
      ) {
        // Mensaje de cambio de dirección
        this.message.alertCustomBtn(
          {
            header: this.getTag('DENARIO_HEADER_ALERTA'),
            message: this.getTag("DENARIO_CAMBIO_DIRECCION")
          },
          [
            {
              text: this.getTag('DENARIO_BOTON_CANCELAR'),
              role: 'cancel',
              handler: () => {
                this.direccionCliente = this.direccionAnterior;
              },
            },
            {
              text: this.getTag('DENARIO_BOTON_ACEPTAR'),
              role: 'confirm',
              handler: () => {
                this.direccionAnterior = this.direccionCliente;
                this.setChangesMade(true);
              },
            }
          ]
        );
      } else if (
        !this.viewOnly &&
        this.direccionCliente.editable &&
        (this.direccionCliente.coordenada === null
          || this.direccionCliente.coordenada.trim() === ""
          || this.direccionCliente.coordenada.trim() === "0,0"
          || this.direccionCliente.coordenada.toLowerCase().trim() === "null")) {
        // Mensaje de coordenadas faltantes SOLO si no se mostró el anterior
        this.addressRedLabel = false; //quitamos borde rojo, si lo tenia
        this.message.alertCustomBtn(
          {
            header: this.getTag('DENARIO_HEADER_ALERTA'),
            message: this.getTag("VIS_MENSAJE_COORDENADAS")
          },
          [
            {
              text: this.getTag('DENARIO_BOTON_CANCELAR-'),
              role: 'cancel',
              handler: () => { },
            },
            {
              text: this.getTag('DENARIO_BOTON_AGREGAR'),
              role: 'confirm',
              handler: () => {
                this.AddClientAddress();
              },
            }
          ]
        );
      }
    }
  }

  AddClientAddress() {
    //Esta funcion se ejecuta cuando la direccion no tiene coordenadas y
    //el usuario accede a agregarla
    //this.clientLogic.goToClient(this.cliente.idClient);
    this.clientLogic.datos = {} as SelectedClient;
    this.clientLogic.datos.client = this.cliente;
    this.clientLogic.viewCoordenada(this.cliente, "visitas");


  }

  getTag(tagName: string) {
    return this.visitServ.getTag(tagName)
  }

  resetEventSelect() {
    if (this.actividadSeleccionada) {
      if (this.rolTransportista)
        this.disabledButtonEvent = true;
      else
        this.disabledButtonEvent = false;
    }

    this.listaMotivosFiltrados = [];
    this.actividadSeleccionada = null;
    this.motivoSeleccionado = null;
    this.motiveLock = true;
    this.comentario = "";
    this.showEventModal = false;

  }



  onDateSelect() {
    this.setChangesMade(true);
    this.visitServ.getNuSequence(this.fechaVisita).then(nuSeq => {
      this.nuSequence = nuSeq;
    })
  }

  onSelectActivity(e: any) {
    //console.log(e.detail.value);
    this.listaMotivos = this.visitServ.listaMotivos;
    this.actividadSeleccionada = e.detail.value;
    this.motivoSeleccionado = null;
    if (this.actividadSeleccionada != null) {
      if (e.detail.value.requiredEvent == "true") {
        this.actividadRequiereEvento = true;
      } else {
        this.actividadRequiereEvento = false;
      }
      if (e.detail.value.requiredSignature == "true") {
        this.actividadRequiereFirma = true;
      } else {
        this.actividadRequiereFirma = false;
      }

      this.listaMotivosFiltrados =
        this.listaMotivos.filter((mot) => mot.idType === this.actividadSeleccionada!.idType)
      this.motiveLock = this.actividadRequiereEvento;
    }

    if (this.rolTransportista) {
      this.disabledButtonEvent = true;
      this.checkFirmaAndDisableSend();
    }

    if (this.actividadRequiereFirma) {
      this.message.transaccionMsjModalNB("Esta actividad requiere Firma del cliente");
    }
  }

  checkFirmaAndDisableSend() {
    if (this.actividadRequiereFirma) {
      if (!this.adjuntoService.tieneFirma()) {
        this.disableSendButton = true;
      } else {

      }
    } else {
      this.disableSendButton = false;
    }
    if (this.listaEventos.length == 0)
      this.disableSendButton = true;
  }

  onSelectMotive(e: any) {
    this.motivoSeleccionado = e.detail.value;
  }

  closeMapModal() {
    this.clientLogic.clientLocationComponent = false;
  }

  checkSegment() {
    if (this.cliente.idClient == null) {
      this.clientRedLabel = true;
    } else {
      if (this.initialLock) {
        this.initVisitRedMsg = this.getTag("VIS_INIT_WARN");
        this.initVisitRedLabel = true;

      }
      if (this.direccionCliente == null) {
        this.addressRedLabel = true;
      }

    }
  }

  deleteEvent(input: EventoVisita) {


    if (this.visitServ.editVisit) {
      //marcamos para borrar
      ///this.visitServ.deleteIncidence(input.coIncid);
      this.eventosABorrar.push(input);
    }
    //console.log(input);
    this.listaEventos.splice(input.pos, 1);
    for (let index = 0; index < this.listaEventos.length; index++) {
      this.listaEventos[index].pos = index;
    }
    //console.log(JSON.stringify(this.listaEventos));
    this.setChangesMade(true);

    if (this.rolTransportista)
      this.disabledButtonEvent = false;
  }

  editEvent(input: EventoVisita) {
    if (this.viewOnly) {

    } else {
      this.onSelectActivity({ detail: { value: input.actividad } })
      this.motivoSeleccionado = input.evento;
      this.comentario = input.comentario;
      this.eventoAEditar = input.pos;

      this.showEventModal = true;
    }





  }

  saveEventChanges() {
    var evento = this.listaEventos[this.eventoAEditar];
    /*  if (this.actividadSeleccionada != null && this.motivoSeleccionado != null) {

       evento.evento = this.motivoSeleccionado;
       evento.actividad = this.actividadSeleccionada;
       evento.comentario = this.comentario;
       this.eventoAEditar = -1;
       this.setChangesMade(true);
       this.resetEventSelect();
       this.showEventModal = false;
     } else {
       this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_AGREGUE_ACT"));
     } */
    let saveEventChanges = false;
    if (this.actividadRequiereEvento) {
      // Se cumple si requiredEvent es boolean true o string "true"
      if (this.motivoSeleccionado != null) {
        saveEventChanges = true;
      } else {
        this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_AGREGUE_ACT"));
      }
    } else {
      saveEventChanges = true;
    }

    if (saveEventChanges) {
      evento.evento = this.motivoSeleccionado!;
      evento.actividad = this.actividadSeleccionada!;
      evento.saved = false;
      evento.comentario = this.comentario;
      this.eventoAEditar = -1;
      this.setChangesMade(true);
      this.resetEventSelect();
      this.showEventModal = false;/*  */
    }

    if (this.rolTransportista)
      this.disabledButtonEvent = true;


  }

  saveEvent() {
    
  if (this.actividadSeleccionada) {

    let saveEvent = false;
    if (this.actividadRequiereEvento) {
      if (this.motivoSeleccionado && this.motivoSeleccionado.idMotive > 0) {
        saveEvent = true;
      } else {
        this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_AGREGUE_ACT"));
      }
    } else {
      saveEvent = true;

      this.motivoSeleccionado = {
        idType: 0,
        naMotive: "",
        idMotive: 0
      }
    }

    if (saveEvent) {
      var ev = {
        pos: this.listaEventos.length,
        coIncid: 0, //coIncid se asigna al guardar la visita
        actividad: this.actividadSeleccionada,
        evento: this.motivoSeleccionado,
        comentario: this.comentario,
        saved: false
      } as EventoVisita;

      //console.log(ev);
      this.listaEventos.push(ev);
      this.resetEventSelect();
      this.setChangesMade(true);
      this.showEventModal = false;
      this.clientSelectorService.checkClient = true;
    }
  }else{
    this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_AGREGUE_ACT"));
  }
  }

  saveButton() {
    if (this.changesMade) {
      this.saveVisit(false);
    }
  }

  async saveVisit(willSend: boolean) {

    var idVisit = null;
    var stVisit = VISIT_STATUS_SAVED;
    if (willSend) {
      stVisit = VISIT_STATUS_TO_SEND;
    }
    var coVisit = this.dateServ.generateCO(0);
    if (this.visitServ.editVisit) {
      idVisit = this.visitServ.visit.idVisit;
      coVisit = this.visitServ.visit.coVisit;
    }
    var visita: Visit = {
      idVisit: idVisit,
      coVisit: coVisit,
      stVisit: stVisit,
      daVisit: this.visitServ.visit.daVisit ?
        this.visitServ.visit.daVisit.replace("T", " ") :
        this.fechaVisita.replace("T", " "),
      coordenada: this.visitServ.coordenadas,
      idClient: this.cliente.idClient,
      coClient: this.cliente.coClient,
      naClient: this.cliente.lbClient,
      nuSequence: this.nuSequence,
      idUser: Number(localStorage.getItem("idUser")),
      coUser: localStorage.getItem('coUser') || "[]",
      coEnterprise: this.empresaSeleccionada.coEnterprise,
      idEnterprise: this.empresaSeleccionada.idEnterprise,
      daReal: willSend ? this.dateServ.hoyISOFullTime() : "", //solo se agrega daReal si se va a enviar
      daInitial: this.fechaInitial ? this.fechaInitial.replace("T", " ") : this.fechaInitial,
      idAddressClient: this.cliente.idAddressClients,
      coAddressClient: this.cliente.coAddressClients,
      visitDetails: [],
      coordenadaSaved: false, //este SIEMPRE es false.
      hasAttachments: this.adjuntoService.hasItems(),
      nuAttachments: this.adjuntoService.getNuAttachment(),
      isReassigned: this.visitServ.visit.isReassigned ? this.visitServ.visit.isReassigned : false,
      txReassignedMotive: this.visitServ.visit.txReassignedMotive,
      daReassign: this.visitServ.visit.daReassign ? this.visitServ.visit.daReassign.replace("T", " ") : this.visitServ.visit.daReassign,
      isDispatched: this.visitServ.visit.isDispatched ? this.visitServ.visit.isDispatched : false,
      noDispatchedMotive: this.visitServ.visit.noDispatchedMotive,
      isVisited: this.visitServ.visit.isVisited ? this.visitServ.visit.isVisited : false,
    }
    //console.log("visita antes de insert:");
    //console.log(visita);
    var incidences: Incidence[] = [];

    return this.visitServ.saveVisit(visita).then(async v => {
      visita = v.rows.item(0);

      //una vez que se guarda por primera vez, las veces siguientes "editan" la visita
      this.visitServ.visit = visita;
      this.visitServ.editVisit = true;

      //console.log("visita despues de insert:");
      //console.log(visita);

      //borramos incidencias marcadas para borrar
      for (let i = 0; i < this.eventosABorrar.length; i++) {
        const item = this.eventosABorrar[i];
        this.visitServ.deleteIncidence(item.coIncid);

      }

      // a insertar incidencias
      for (let i = 0; i < this.listaEventos.length; i++) {
        var item = this.listaEventos[i];
        if (item.saved) {
          //si ya estaba guardada, no la guardamos de nuevo
          continue;
        } else {
          var inc = {
            idVisit: visita.idVisit,
            coVisit: visita.coVisit,
            coIncid: item.coIncid,
            coType: item.actividad.idType,
            coCause: item.evento.idMotive,
            txDescription: this.cleanString(item.comentario),
          }
          incidences.push(inc);
          item.saved = true; //marcamos como guardada
        }



      }
      //insertamos imagenes si hay en adjuntos
      await this.adjuntoService.savePhotos(this.syncServ.getDatabase(), visita.coVisit, "visitas");
      this.setChangesMade(false);
      const list = await this.visitServ.saveIncidences(incidences);
      if (!willSend) {
        this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_VISITA_GUARDA"));
        this.disableSendButton = false;
      } else {
      }
      return {
        visit: visita,
        incidencias: list
      };

    });
  }

  sendVisit() {
    if (this.cliente && this.listaEventos.length > 0) {
      this.disableSendButton = true;
      this.message.showLoading().then(() => {
        this.enviarVisita(true);
      });
    } else {
      this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_AGREGUE_ACT"));
    }

  }

  async enviarVisita(isVisited: boolean) {
    //revisamos que tengamos coordenadas
    if (!this.visitServ.coordenadas || this.visitServ.coordenadas.length <= 0) {
      await this.message.showLoading().then(async () => {
        await this.geoServ.getCurrentPosition().then(coords => {
          if (coords.length > 0) {
            this.setCoordinates(coords);
          }
          this.message.hideLoading();
        });

      });
    }
    this.visitServ.visit.isVisited = isVisited;
    await this.saveVisit(true).then(async saved => {
      //console.log("insertadas las incidencias");
      //var incidences = saved.incidencias;
      var visita = saved.visit;

      // console.log(incidences);


      //ahora es el turno de las transacciones

      //la transaccion de la visita
      var transactions: PendingTransaction[] = [];
      var tr: PendingTransaction = new PendingTransaction(
        visita.coVisit,
        visita.idVisit,
        "visit"
      );
      transactions.push(tr);

      if (localStorage.getItem("connected") == "true") {
        this.messageAlert = new MessageAlert(
          this.getTag('VIS_DENARIO')!,
          this.getTag('VIS_DENARIO_TO_SEND')!,
        );

      } else {
        this.messageAlert = new MessageAlert(
          this.getTag('VIS_DENARIO')!,
          this.getTag('VIS_DENARIO_TO_SEND_OFFLINE')!,
        );
      }
      this.message.alertModal(this.messageAlert);

      this.servicesServ.insertPendingTransactionBatch(this.syncServ.getDatabase(), transactions).then(() => {

        //finalizamos y regresamos a la pagina de visitas
        this.autoSend.ngOnInit();
        this.message.hideLoading();
        this.router.navigate(['visitas']);
      });

    });
  }

  confirmSend() {
    if (this.visitServ.visit.stVisit != VISIT_STATUS_VISITED)
      this.alertConfirmSend = true;
  }


  goBack() {

    if (!this.viewOnly && this.changesMade) {
      //this.message.saveOrExitOpenMSG();
      this.saveOrExitOpen = true;
    } else {
      //this.router.navigate(['visitas']);
      this.location.back();
    }


  }

  saveAndExit() {
    this.saveVisit(false);
    this.router.navigate(['visitas']);
  }

  setsaveOrExitOpen(isOpen: boolean) {
    this.saveOrExitOpen = isOpen;

  }

  setConfirmSend(isOpen: boolean) {
    this.alertConfirmSend = isOpen;

  }

  setShowEventModal(value: boolean) {
    this.showEventModal = value;
  }

  setClientChangeOpen(value: boolean) {
    this.clientChangeOpen = value;
  }

  setChangesMade(value: boolean) {
    this.changesMade = value;
    if (value) {
      var disable = !((this.cliente.idClient != null) &&
        (this.listaEventos.length > 0) &&
        (!this.adjuntoService.weightLimitExceeded));
      this.disableSaveButton = disable;
      this.disableSendButton = disable;
      if (this.rolTransportista) {
        //this.initialLock = false;
        this.disabledButtonViewRoute = false;
      }
    } else {
      this.disableSaveButton = true;
      this.disableSendButton = true;
    }

    if (this.rolTransportista)
      this.checkFirmaAndDisableSend();
  }

  onCommentInput() {
    const cleaned = this.cleanString(this.comentario);
    if (this.comentario !== cleaned) {
      this.comentario = cleaned;
      if (this.comentarioInput && this.comentarioInput.value !== cleaned) {
        this.comentarioInput.value = cleaned;
      }
    }
  }
  cleanString(str: string): string {
    // Elimina ;
    str = str.replace(/;/g, '');
    // Elimina comillas simples
    str = str.replace(/'/g, '');
    // Elimina comillas dobles
    str = str.replace(/"/g, '');
    return str;
  }
  saveLocation() {
    this.clientLocationServ.saveLocation();
    this.direccionCliente.coordenada = this.clientLogic.coordenada.lat + ',' + this.clientLogic.coordenada.lng;
    this.closeMapModal();
  }

  saveLocationButton() {
    let mensaje = this.clientLogic.clientTags.get('CLI_DENARIO_CONFIRM_SEND_LOCATION')!;
    this.message.alertCustomBtn(
      {
        header: this.getTag('DENARIO_HEADER_ALERTA'),
        message: mensaje
      },
      [
        {
          text: this.getTag('DENARIO_BOTON_CANCELAR'),
          role: 'cancel',
          handler: () => {
            //console.log('Alert canceled');
          },
        },
        {
          text: this.getTag('DENARIO_BOTON_ACEPTAR'),
          role: 'confirm',
          handler: () => {
            this.saveLocation();
            //this.message.dismissAll();
          },
        }
      ]
    )
  }

  setShowDateModal(value: boolean) {
    this.showDateModal = value;
  }

  buttonsSalvar = [
    {
      text: this.saveAndExitBtn,
      role: 'save',
      handler: () => {
        console.log('save and exit');
        this.saveAndExit();

      },
    },
    {
      text: this.exitBtn,
      role: 'exit',
      handler: () => {
        console.log('exit w/o save');
        this.router.navigate(['visitas']);
      },
    },
    {
      text: this.cancelBtn,
      role: 'cancel',
      handler: () => {
        console.log('exit canceled');
      },
    },
  ];

  setButtonsSalvar() {
    this.buttonsSalvar = [
      {
        text: this.saveAndExitBtn,
        role: 'save',
        handler: () => {
          console.log('save and exit');
          this.saveAndExit();

        },
      },
      {
        text: this.exitBtn,
        role: 'exit',
        handler: () => {
          console.log('exit w/o save');
          this.router.navigate(['visitas']);
        },
      },
      {
        text: this.cancelBtn,
        role: 'cancel',
        handler: () => {
          console.log('exit canceled');
        },
      },
    ];
  }


  public buttonsConfirmExit = [
    {
      text: this.getTag('DENARIO_BOTON_CANCELAR').toUpperCase(),
      role: 'cancel',
      handler: () => {
        //console.log('Alert canceled');
      },
    },
    {
      text: this.getTag('DENARIO_BOTON_ACEPTAR'),
      role: 'confirm',
      handler: () => {
        this.sendVisit();
      },
    }
  ];

  async openRouteInGoogleMaps() {
    let hasNoClientCoordinates = false;
    if (this.cliente.coordenada == null
      || this.cliente.coordenada.trim() == ""
      || this.cliente.coordenada.trim() == "0,0"
      || this.cliente.coordenada.toLowerCase().trim() === "null") {
      if (this.clientLogic.coordenada &&
        this.clientLogic.coordenada.lat !== 0 &&
        this.clientLogic.coordenada.lng !== 0) {
        //intentamos obtenerla de clientLogic
        this.cliente.coordenada = this.clientLogic.coordenada.lat + ',' + this.clientLogic.coordenada.lng;
      } else {
        /*  this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_NO_COORDENADAS_DESTINO"));
         this.disabledButtonViewRoute = true;
         return; */
        hasNoClientCoordinates = true;
      }

    }

    if (!this.visitServ.coordenadas) {
      await this.message.showLoading().then(async () => {
        await this.geoServ.getCurrentPosition().then(coords => {
          if (coords.length > 0) {
            this.setCoordinates(coords);
          }
          this.message.hideLoading();
        });

      });
    }

    if (hasNoClientCoordinates) {
      if (this.visitServ.coordenadas != null && this.visitServ.coordenadas.trim().length > 0) {
        const myLat = this.visitServ.coordenadas.split(',')[0];
        const myLng = this.visitServ.coordenadas.split(',')[1];
        /*  const myLat = 10.490474986680338;
         const myLng = -66.85553857487967; */
        const origin = `${myLat},${myLng}`;

        // Supón que tienes la dirección como string:
        if (this.direccionCliente.txAddress == null || this.direccionCliente.txAddress.trim().length == 0) {
          this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_NO_COORDENADAS_DESTINO"));
          this.disabledButtonViewRoute = true;
          return;
        }
        const destination = encodeURIComponent(this.direccionCliente.txAddress);

        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
        window.open(url, '_blank');

      } else {
        this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_NO_COORDENADAS_ORIGEN"));
        this.disabledButtonViewRoute = true;
      }

    } else if (this.visitServ.coordenadas) {

      const myLat = this.visitServ.coordenadas.split(',')[0];
      const myLng = this.visitServ.coordenadas.split(',')[1];
      const destLat = this.cliente.coordenada.split(',')[0];
      const destLng = this.cliente.coordenada.split(',')[1];

      if (!destLat || !destLng) {
        this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_NO_COORDENADAS_DESTINO"));
        this.disabledButtonViewRoute = true;
        return;
      }

      if (!myLat || !myLng) {
        this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_NO_COORDENADAS_ORIGEN"));
        this.disabledButtonViewRoute = true;
        return;
      }
      const url = `https://www.google.com/maps/dir/?api=1&origin=${myLat},${myLng}&destination=${destLat},${destLng}&travelmode=driving`;
      window.open(url, '_blank');
    } else {
      this.message.transaccionMsjModalNB(this.getTag("VIS_MENSAJE_NO_COORDENADAS_ORIGEN"));
      this.disabledButtonViewRoute = true;
    }

  }

  reagendarVisita() {
    this.motivoReagendo = this.visitServ.visit.txReassignedMotive;
    this.fechaReagendo = this.visitServ.visit.daReassign;
    this.showReagendarModal = true;
    if (this.visitServ.userMustActivateGPS) {
      //en este caso no se puede continuar si no hay coordenadas
      this.geoServ.getCurrentPosition().then(coords => {
        if (coords.length > 0) {
          this.setCoordinates(coords);
          this.segment = 'actividades';
          this.visitServ.coordenadas = coords;
        } else {
          console.log("no hay coordenadas, locacion debe estar inactiva");
          this.initialLock = true;
          this.initVisitRedMsg = this.getTag("DENARIO_ERR_GPS");
          this.initVisitRedLabel = true;
        }
      });
    } else {
      //si no es obligatorio, puede iniciar sin coords y se buscan en el fondo.
      this.initialLock = false;
      this.segment = 'actividades';
      this.geoServ.getCurrentPosition().then(coords => {
        if (coords.length > 0) {
          this.visitServ.coordenadas = coords;
          this.setCoordinates(coords);
        }
      });

    }


  }


  sendMessageConfirmReagenda() {
    this.message.alertCustomBtn(
      {
        header: this.getTag('DENARIO_HEADER_ALERTA'),
        message: "Esta seguro de reagendar el Despacho?"
      },
      [
        {
          text: this.getTag('DENARIO_BOTON_CANCELAR'),
          role: 'cancel',
          handler: () => {
            this.fechaReagendo = "";
            this.motivoReagendo = "";
            this.showReagendarModal = false;
          },
        },
        {
          text: this.getTag('DENARIO_BOTON_ACEPTAR'),
          role: 'confirm',
          handler: () => {

            this.confirmarReagendar();
          },
        }
      ]
    );
  }
  confirmarReagendar() {
    console.log("confirmar");
    this.visitServ.visit.isReassigned = true;
    this.visitServ.visit.daReassign = this.fechaVisita;
    this.visitServ.visit.daVisit = this.fechaReagendo;
    this.visitServ.visit.txReassignedMotive = this.motivoReagendo;
    this.visitServ.visit.noDispatchedMotive = "Reasignado";
    this.enviarVisita(false).then(() => {
      this.fechaReagendo = "";
      this.motivoReagendo = "";
      this.showReagendarModal = false;
      //this.router.navigate(['visitas']);
    });
  }

  closeReagendarModal() {
    this.fechaReagendo = "";
    this.motivoReagendo = "";
    this.showReagendarModal = false;
    this.initialLock = true;
  }
}
