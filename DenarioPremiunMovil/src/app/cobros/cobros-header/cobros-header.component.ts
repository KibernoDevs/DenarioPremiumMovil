import { Component, EventEmitter, OnInit, Output, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { Collection } from 'src/app/modelos/tables/collection';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { COLLECT_STATUS_SAVED, COLLECT_STATUS_SENT, COLLECT_STATUS_TO_SEND, COLLECT_STATUS_NEW } from 'src/app/utils/appConstants';


@Component({
  selector: 'app-cobros-header',
  templateUrl: './cobros-header.component.html',
  styleUrls: ['./cobros-header.component.scss'],
  standalone: false
})
export class CobrosHeaderComponent implements OnInit {

  @Output()
  backClicked: EventEmitter<string> = new EventEmitter<string>();


  public collectService = inject(CollectionService);
  public adjuntoService = inject(AdjuntoService);
  public synchronizationServices = inject(SynchronizationDBService);
  public messageService = inject(MessageService);
  messageAlert!: MessageAlert;



  public textSave: String = '';
  public textExit: String = '';
  public alertSaveOrExit: Boolean = false;
  public alertMessageOpen: Boolean = false;
  public alertMessageOpenSend: Boolean = false;

  public textAlertButtonCancel: String = '';
  public textAlertButtonConfirm: String = '';
  public header: string = '';
  public mensaje: string = '';

  public subscriberShow: any;
  public subscriberDisabled: any;
  public subscriberToSend: any;
  public subscriptionAttachmentChanged: any;
  public subscriptionAttachmentWeightExceeded: any;

  public COLLECT_STATUS_SAVED = COLLECT_STATUS_SAVED;
  public COLLECT_STATUS_SENT = COLLECT_STATUS_SENT;
  public COLLECT_STATUS_TO_SEND = COLLECT_STATUS_TO_SEND;
  public COLLECT_STATUS_NEW = COLLECT_STATUS_NEW;

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

  public buttonsSalvar = [
    {
      text: '',
      role: 'save',
      handler: () => {
        console.log('save and exit');
        this.messageService.showLoading().then(() => {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_COLLECT_MSG')!;
          this.alertMessageOpen = true;
          this.collectService.collection.stDelivery = 3;
          this.collectService.collection.stCollection = 3;
          this.collectService.saveCollection(this.synchronizationServices.getDatabase(), this.collectService.collection, true).then(async response => {
            await this.adjuntoService.savePhotos(this.synchronizationServices.getDatabase(), this.collectService.collection.coCollection, "cobros");
            console.log(response);
            this.collectService.applyPersistSucceededBaseline();
            this.collectService.initCollect = true;
            this.collectService.disableSavedButton = true;
            this.collectService.disableSendButton = true;
            this.collectService.showHeaderButtons = false;
            this.collectService.cobroComponent = false;
            this.collectService.collectValid = false;
            this.collectService.collectionIsSave = false;
            this.collectService.cobrosComponent = true;
            this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO')!
            this.messageService.hideLoading();

          })
        });

      },
    },
    {
      text: '',
      role: 'exit',
      handler: () => {
        console.log('exit w/o save');
        this.collectService.collectValid = false;
        this.collectService.collectionIsSave = false;
        this.collectService.newCollect = false;
        this.collectService.resetCollectionExitBaseline();
        this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO')!

        this.collectService.showBackRoute('cobros');
      },
    },
    {
      text: '',
      role: 'cancel',
      handler: () => {
        console.log('exit canceled');
      },
    },
  ];

  constructor(
    private router: Router,
    private platform: Platform,
  ) {

    // this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO')! == null ? "Cobros" : this.collectService.collectionTags.get('COB_NOMBRE_MODULO')!;
  }

  ngOnInit() {
    this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO')! == null ? "Cobros" : this.collectService.collectionTags.get('COB_NOMBRE_MODULO')!;
    this.collectService.getTagsDenario(this.synchronizationServices.getDatabase(),).then(resp => {
      if (resp) {
        this.buttonsSalvar[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_SALIR_GUARDAR')!
        this.buttonsSalvar[1].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_SALIR')!
        this.buttonsSalvar[2].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_CANCELAR')!

        /* this.alertButtons[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_CANCELAR')! */
        this.alertButtons[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!

        this.alertButtonsSend[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_CANCELAR')!
        this.alertButtonsSend[1].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
      }
    })

    this.subscriberShow = this.collectService.showButtons.subscribe((data: Boolean) => {
      this.collectService.showHeaderButtons = data;
    });

    this.subscriberDisabled = this.collectService.collectValidToSave.subscribe((data: Boolean) => {
      this.collectService.disableSavedButton = data ? false : true;
    });

    this.subscriberToSend = this.collectService.collectValidToSend.subscribe((validToSend: Boolean) => {
      this.collectService.disableSendButton = validToSend ? false : true;
    });

    this.subscriptionAttachmentChanged = this.adjuntoService.AttachmentChanged.subscribe(() => {
      this.collectService.markCollectionDirty();
      this.collectService.validateToSend();
      this.collectService.disableSavedButton = this.collectService.disableSendButton;
    });
    this.subscriptionAttachmentWeightExceeded = this.adjuntoService.AttachmentWeightExceeded.subscribe(() => {
      this.collectService.disableSavedButton = true;
      this.collectService.disableSendButton = true;
    })
  }

  ngOnDestroy() {
    this.subscriberShow.unsubscribe();
    this.subscriberDisabled.unsubscribe();
    this.subscriberToSend.unsubscribe();
    this.backButtonSubscription.unsubscribe();
    this.subscriptionAttachmentChanged.unsubscribe();
    this.subscriptionAttachmentWeightExceeded.unsubscribe();
  }

  resetValues() {
    this.collectService.collection = {} as Collection;
    /* this.collectService.enterpriseSelected = {} as Enterprise; */
    this.collectService.enterpriseSelected = this.collectService.enterpriseList[0];
  }

  goBack() {

    //SI ESTOY EN COBRO25, RETORNO A FALSO
    if (this.collectService.cobro25)
      this.collectService.cobro25 = false;

    if (this.collectService.cobrosComponent) {
      this.collectService.isAnticipo = false;
      this.collectService.isRetention = false;
      this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO')!;
      this.collectService.hideDocuments = false;
      this.collectService.hidePayments = false;
      this.collectService.collectValid = false;
      this.collectService.collectionIsSave = false;
      this.collectService.newCollect = false;
      this.resetValues();
      this.ngOnDestroy();
      this.collectService.showBackRoute('cobros');

    } else if (this.collectService.cobroListComponent) {
      this.collectService.collectValid = false;
      this.collectService.collectionIsSave = false;
      this.collectService.cobroListComponent = false;
      this.collectService.cobrosComponent = true;
    } else if (this.collectService.cobroComponent) {
      if (this.collectService.shouldPromptCollectionExitSaveOrDiscard()) {
        this.collectService.saveOrExitOpen = true;
      } else {
        this.exitCollectionWithoutSave();
      }
    } else {
      this.exitCollectionWithoutSave();
    }
  }

  private exitCollectionWithoutSave(): void {
    this.collectService.collectValid = false;
    this.collectService.collectionIsSave = false;
    this.collectService.coTypeModule = '0';
    this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO')!;
    this.collectService.isAnticipo = false;
    this.collectService.isRetention = false;
    this.collectService.hideDocuments = false;
    this.collectService.hidePayments = false;
    this.collectService.newCollect = false;
    this.collectService.resetCollectionExitBaseline();
    this.resetValues();
    this.collectService.showBackRoute('cobros');
  }

  backButtonSubscription: Subscription = this.platform.backButton.subscribeWithPriority(10, () => {
    //console.log('backButton was called!');
    this.goBack();
  });

  setsaveOrExitOpen(isOpen: boolean) {
    this.collectService.saveOrExitOpen = isOpen;
  }

  setResult(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpen = false;
    } else {
      this.alertMessageOpen = false;
    }
  }

  setResultSend(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpenSend = false;
      this.sendOrSave(true)
    } else {
      this.alertMessageOpenSend = false;
    }
  }

  saveSendNewCollection(send: Boolean, coCollection: string) {
    if (send) {
      this.collectService.sendCollection = true;
      this.collectService.saveSendCollection(coCollection);
      if (localStorage.getItem("connected") == "true") {
        this.messageAlert = new MessageAlert(
          this.collectService.collectionTags.get('COB_HEADER_MESSAGE')!,
          this.collectService.collectionTags.get('COB_DENARIO_TO_SEND')!,
        );
      } else {
        this.messageAlert = new MessageAlert(
          this.collectService.collectionTags.get('COB_HEADER_MESSAGE')!,
          this.collectService.collectionTags.get('COB_DENARIO_TO_SEND_OFFLINE')!,
        );

      }
      this.messageService.alertModal(this.messageAlert);
    }

  }

  sendOrSave(sendOrSave: boolean) {
   
    if (this.collectService.collection.coType == "0" && sendOrSave) {
      //ES UN COBRO, SE DEBE BUSCAR EN TODOS LOS DETAILS SI HAY RETENCIONES, SI HAY RETENCIONES HAY QUE BUSCAR
      // SI HAY ADJUNTOS, SI NO HAY, SE DEBE ENVIAR MSJ DE ALERTA Y
      //NO SE DEBE PERMITIR EL ENVIO HASTA QUE SE ADJUNTE AL MENOS UN DOCUMENTO
      try {
        const details = this.collectService.collection?.collectionDetails;
        const hasRetentions = Array.isArray(details) && details.some(d =>
          this.collectService.getDetailRetentionTotal(d) > 0
        );


        //NUEVA VALIDACION, SI LA CONFIGURACION DE LA EMPRESA INDICA QUE LOS COBROS REQUIEREN ADJUNTOS, SE VALIDA QUE HAYA ADJUNTOS INDEPENDIENTEMENTE DE SI HAY RETENCIONES O NO
        if (this.collectService.requiredCollectionAttachments) {
          if (!this.adjuntoService.hasItems()) {
            //NO HAY ADJUNTOS
            this.messageService.transaccionMsjModalNB(this.collectService.collectionTags.get('COB_RET_MSJ_COLLECTION_NO_ATTACHMENTS')!);
            return;
          }
        }

        // Guardar resultado en el servicio para uso posterior y log para depuración
        //this.collectService.isRetention = !!hasRetentions;
        if (hasRetentions) {
          console.log('CobrosHeader: Detected retention amounts in collectionDetails', {
            collectionId: this.collectService.collection?.coCollection,
            hasRetentions
          });

          if (!this.adjuntoService.hasItems()) {
            //NO HAY ADJUNTOS
            this.messageService.transaccionMsjModalNB(this.collectService.collectionTags.get('COB_MSJ_RETENTION_NO_ATTACHMENTS')!);
            return;
          }
        }
      } catch (err) {
        console.error('CobrosHeader: error comprobando retenciones en collectionDetails', err);
      }
    }
    
    if (this.collectService.collection.coType == "1" && sendOrSave) {
      if (this.collectService.requiredAnticipoAttachments) {
        if (!this.adjuntoService.hasItems()) {
          this.messageService.transaccionMsjModalNB(this.collectService.collectionTags.get('COB_RET_MSJ_ANTICIPO_NO_ATTACHMENTS')!);
          return;
        }
      }
    }

    if (this.collectService.collection.coType == "2" && sendOrSave) {
      if (this.collectService.requiredRetentionAttachments) {
        if (!this.adjuntoService.hasItems()) {
          this.messageService.transaccionMsjModalNB(this.collectService.collectionTags.get('COB_RET_MSJ_RETENTION_NO_ATTACHMENTS')!);
          return;
        }
      }
    }

    this.collectService.collectionIsSave = true;
    this.messageService.showLoading().then(() => {
      if (sendOrSave) {
        //envio
        this.collectService.collection.stDelivery = 2;
        this.collectService.collection.stCollection = this.COLLECT_STATUS_TO_SEND;
        this.collectService.saveCollection(this.synchronizationServices.getDatabase(), this.collectService.collection, sendOrSave).then(response => {
          this.adjuntoService.savePhotos(this.synchronizationServices.getDatabase(), this.collectService.collection.coCollection, "cobros").then(() => {
            console.log(response);
            this.collectService.applyPersistSucceededBaseline();
            this.saveSendNewCollection(true, this.collectService.collection.coCollection);
            this.collectService.refreshAutomatedPrepaidBeforeSend().then((shouldCreatePrepaid) => {
              if (shouldCreatePrepaid) {
                //DEBO CREAR EL ANTICIPO AUTOMATICO
                this.collectService.createAnticipoCollection(this.synchronizationServices.getDatabase(), this.collectService.collection).then(resp => {
                  console.log(resp, " SE CREO ANTICIPO AUTOMATICO");
                  this.collectService.createAutomatedPrepaid = false;
                  this.collectService.anticipoAutomatico = [];
                });
              }

              this.collectService.initCollect = true;
              this.collectService.disableSavedButton = true;
              this.collectService.disableSendButton = true;
              this.collectService.showHeaderButtons = false;
              this.collectService.cobroComponent = false;
              this.collectService.cobrosComponent = true;
              this.collectService.collectValid = false;
              this.collectService.collectionIsSave = false;
              this.messageService.hideLoading();
            });
          })


        })
      } else {
        //salvo
        this.collectService.collection.stDelivery = 3;
        this.collectService.collection.stCollection = 3;
        this.collectService.saveCollection(this.synchronizationServices.getDatabase(), this.collectService.collection, sendOrSave).then(async response => {
          await this.adjuntoService.savePhotos(this.synchronizationServices.getDatabase(), this.collectService.collection.coCollection, "cobros");
          console.log(response);
          this.collectService.applyPersistSucceededBaseline();
          this.saveSendNewCollection(false, this.collectService.collection.coCollection);
          switch (this.collectService.collection.coType) {
            case "0": {
              this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_COLLECT_MSG')!;
              break;
            }

            case "1": {
              this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_ANTICIPO_MSG')!;
              break;
            }

            case "2": {
              this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_RETENTION_MSG')!;
              break;
            }

            case "3": {
              this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_IGTF_MSG')!;
              break;
            }
            default: {
              this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_COLLECT_MSG')!;
            }
          }
          this.alertMessageOpen = true;
          this.messageService.hideLoading();
        })
      }
    });

  }

  sendCollect() {
    switch (this.collectService.collection.coType) {
      case "0": {
        this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_COLLECT_MSG')!;
        break;
      }

      case "1": {
        this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_ANTICIPO_MSG')!;
        break;
      }

      case "2": {
        this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_RETENTION_MSG')!;
        break;
      }

      case "3": {
        this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_IGTF_MSG')!;
        break;
      }
      default: {
        this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_COLLECT_MSG')!;
      }
    }

    this.alertMessageOpenSend = true;
  }


  /* validateBack() {
    if (!this.collectService.collectValid) {
      this.alertSaveOrExit = true
    } else {
      this.goBack();
    }
  } */
}
