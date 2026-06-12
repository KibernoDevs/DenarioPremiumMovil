import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { PendingTransaction } from 'src/app/modelos/tables/pendingTransactions';
import { AutoSendService } from 'src/app/services/autoSend/auto-send.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ReturnDatabaseService } from 'src/app/services/returns/return-database.service';
import { ReturnLogicService } from 'src/app/services/returns/return-logic.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { COLOR_AMARILLO, DELIVERY_STATUS_SAVED, DELIVERY_STATUS_TO_SEND } from 'src/app/utils/appConstants';

@Component({
  selector: 'devoluciones-header',
  templateUrl: './devoluciones-header.component.html',
  styleUrls: ['./devoluciones-header.component.scss'],
  standalone: false
})
export class DevolucionesHeaderComponent implements OnInit, OnDestroy {


  returnLogic = inject(ReturnLogicService);
  returnDatabaseService = inject(ReturnDatabaseService);
  messageService = inject(MessageService);
  services = inject(ServicesService);
  synchronizationServices = inject(SynchronizationDBService);
  autoSend = inject(AutoSendService);
  router = inject(Router);

  adjuntoServ = inject(AdjuntoService);
  config = inject(GlobalConfigService);

  adjuntoService = inject(AdjuntoService);

  @Input()
  headerTags = new Map<string, string>([]);

  messageAlert!: MessageAlert;
  showHeaderButtos: Boolean = false;
  disableSendButton: Boolean = true;
  cannotSendReturn: Boolean = true;
  header: string = '';
  mensaje: string = '';
  backRoute: string = '/home';
  subscriberShow: any;
  subscriberDisabled: any;
  subscriberToSend: any;
  subscriptionAttachmentChanged: any;
  subscriptionAttachmentWeightExceeded: any;
  alertMessageOpen: Boolean = false;
  saveOrExitOpen = false;
  saveAndExitBtn!: string;
  exitBtn!: string;
  cancelBtn!: string;
  textAlertButtonCancel: String = '';
  textAlertButtonConfirm: String = '';
  textSave: String = '';
  textExit: String = '';

  alertButtons: any;
  buttonsSalvar: any;

  constructor(
    private platform: Platform,
  ) { }

  ngOnInit() {
    this.textAlertButtonCancel = this.returnLogic.tags.get('DENARIO_BOTON_CANCELAR')! ? this.returnLogic.tags.get('DENARIO_BOTON_CANCELAR')! : "Cancelar";
    this.textAlertButtonConfirm = this.returnLogic.tags.get('DENARIO_BOTON_ACEPTAR')! ? this.returnLogic.tags.get('DENARIO_BOTON_ACEPTAR')! : "Aceptar";
    this.textSave = this.returnLogic.tags.get('DENARIO_BOTON_SALIR_GUARDAR')! ? this.returnLogic.tags.get('DENARIO_BOTON_SALIR_GUARDAR')! : "Guardar y salir";
    this.textExit = this.returnLogic.tags.get('DENARIO_BOTON_SALIR')! ? this.returnLogic.tags.get('DENARIO_BOTON_SALIR')! : "Salir sin guardar";

    this.returnLogic.setChange(false, false);
    this.subscriberShow = this.returnLogic.showButtons.subscribe((data: Boolean) => {
      this.showHeaderButtos = data;
      this.adjuntoServ.setup(this.synchronizationServices.getDatabase(), this.config.get('signatureReturn') == 'true', !data, COLOR_AMARILLO);
    });

    this.subscriberDisabled = this.returnLogic.returnValidToSave.subscribe((data: Boolean) => {
      this.disableSendButton = !data;
    });

    this.subscriberToSend = this.returnLogic.returnValidToSend.subscribe((validToSend: Boolean) => {
      this.cannotSendReturn = !validToSend;
    });

    this.subscriptionAttachmentWeightExceeded = this.adjuntoServ.AttachmentWeightExceeded.subscribe(() => {
      this.disableSendButton = true;
      this.cannotSendReturn = true;
    });

    this.subscriptionAttachmentChanged = this.adjuntoService.AttachmentChanged.subscribe(() => {
      //this.returnLogic.setChange(true, true); //dupe
      this.returnLogic.updateSendButtonState();
    });

    this.alertButtons = [
      {
        text: this.textAlertButtonCancel,
        role: 'cancel'
      },
      {
        text: this.textAlertButtonConfirm,
        role: 'confirm'
      },
    ];

    this.buttonsSalvar = [
      {
        text: this.textSave,
        role: 'save',
        handler: () => {
          console.log('save and exit');
          this.saveAndExit(this.synchronizationServices.getDatabase());
        },
      },
      {
        text: this.textExit,
        role: 'exit',
        handler: () => {
          console.log('exit w/o save');
          this.returnLogic.setChange(false, false);
          this.returnLogic.showBackRoute('devoluciones');
        },
      },
      {
        text: this.textAlertButtonCancel,
        role: 'cancel',
        handler: () => {
          console.log('exit canceled');
        },
      },
    ];
  }

  ngOnDestroy(): void {
    this.subscriberShow.unsubscribe();
    this.subscriberDisabled.unsubscribe();
    this.subscriberToSend.unsubscribe();
    this.backButtonSubscription.unsubscribe();
    this.subscriptionAttachmentWeightExceeded.unsubscribe();
    this.subscriptionAttachmentChanged.unsubscribe();
  }


  onBackClicked() {
    if (this.returnLogic.returnChanged && this.returnLogic.newReturn.stDelivery == 3) {
      this.saveOrExitOpen = true;
    } else {
      this.returnLogic.showBackRoute('devoluciones');
      this.messageService.hideLoading();
    }
  }

  backButtonSubscription: Subscription = this.platform.backButton.subscribeWithPriority(10, () => {
    //console.log('backButton was called!');
    this.onBackClicked();
  });

  saveSendNewReturn(send: Boolean) {
    this.returnLogic.newReturn.details = this.returnLogic.productList;
    if (send) { // se quiere enviar la devolucion
      this.header = this.headerTags.get('DENARIO_DEV')!;
      this.mensaje = this.headerTags.get('DENARIO_DEV_CONFIRM_SEND')!;
      this.alertMessageOpen = true;
    } else {
      // SOLO SE VA A GUARDAR LA DEVOLUCION, NO SERA ENVIADA
      this.messageService.showLoading().then(() => {
        console.log('daReturn ' + this.returnLogic.newReturn.daReturn);
        this.returnLogic.newReturn.stDelivery = 3;
        this.returnLogic.newReturn.hasAttachments = this.adjuntoService.hasItems();
        this.returnLogic.newReturn.nuAttachments = this.adjuntoService.getNuAttachment();
        this.returnDatabaseService.saveReturn(this.synchronizationServices.getDatabase(), this.returnLogic.newReturn).then(async () => {
          //aqui voy a llamar a insertar los detalles
          this.returnDatabaseService.saveReturnDetails(this.synchronizationServices.getDatabase(), this.returnLogic.newReturn.details).then(() => {
            this.messageAlert = new MessageAlert(
              this.headerTags.get('DENARIO_DEV')!,
              this.headerTags.get('DENARIO_DEV_TO_SAVE')!,
            );
            this.messageService.alertModal(this.messageAlert);
          });

          //guardamos adjuntos
          await this.adjuntoService.savePhotos(this.synchronizationServices.getDatabase(), this.returnLogic.newReturn.coReturn, "devoluciones");
          this.messageService.hideLoading();
          this.returnLogic.setChange(false, true);
        }).catch(err => console.log('saveReturn: ' + err));
      });

    }
  }

  sendReturn(dbServ: SQLiteObject) {
    let pendingTransaction = {} as PendingTransaction;
    this.returnLogic.newReturn.stDelivery = DELIVERY_STATUS_TO_SEND;
    this.returnLogic.newReturn.hasAttachments = this.adjuntoService.hasItems();
    this.returnLogic.newReturn.nuAttachments = this.adjuntoService.getNuAttachment();
    this.messageService.showLoading().then(() => {
      this.returnDatabaseService.saveReturn(dbServ, this.returnLogic.newReturn).then(async () => {

        //guardamos y enviamos adjuntos
        await this.adjuntoService.savePhotos(this.synchronizationServices.getDatabase(), this.returnLogic.newReturn.coReturn,
          "devoluciones").then(() => {

          });

        //aqui voy a llamar a insertar los detalles
        this.returnDatabaseService.saveReturnDetails(dbServ, this.returnLogic.newReturn.details).then(() => {

          // COMO SE VA A ENVIAR, DESPUES DE GUARDAR LA DEVOLUCION SE VA
          pendingTransaction.coTransaction = this.returnLogic.newReturn.coReturn;
          pendingTransaction.idTransaction = this.returnLogic.newReturn.idReturn;
          pendingTransaction.type = "return";
          if (localStorage.getItem("connected") == "true") {
            this.messageAlert = new MessageAlert(
              this.headerTags.get('DENARIO_DEV')!,
              this.headerTags.get('DENARIO_DEV_TO_SEND')!,
            );
            this.messageService.alertModal(this.messageAlert);

          } else {
            this.messageAlert = new MessageAlert(
              this.headerTags.get('DENARIO_DEV')!,
              this.headerTags.get('DENARIO_DEV_TO_SEND_OFFLINE')!,
            );
            this.messageService.alertModal(this.messageAlert);
          }

          this.services.insertPendingTransaction(this.synchronizationServices.getDatabase(), pendingTransaction).then(result => {
            if (result) {
              this.autoSend.ngOnInit();
              this.returnLogic.returnChanged = false;
              this.onBackClicked();
            }
          });

          this.returnLogic.onReturnValidToSave(false);
          this.returnLogic.onReturnValidToSend(false);
        });
      }).catch(err => console.log('saveSendNewReturn: ' + err));
    });

  }

  saveAndExit(dbServ: SQLiteObject) {
    this.messageService.showLoading().then(() => {
      this.returnLogic.newReturn.details = this.returnLogic.productList;
      // SOLO SE VA A GUARDAR LA DEVOLUCION, NO SERA ENVIADA
      console.log('daReturn ' + this.returnLogic.newReturn.daReturn);
      this.returnLogic.newReturn.stDelivery = DELIVERY_STATUS_SAVED;
      this.returnLogic.newReturn.hasAttachments = this.adjuntoService.hasItems();
      this.returnLogic.newReturn.nuAttachments = this.adjuntoService.getNuAttachment();
      this.returnDatabaseService.saveReturn(dbServ, this.returnLogic.newReturn).then(async () => {
        //guardo adjuntos
        await this.adjuntoService.savePhotos(this.synchronizationServices.getDatabase(), this.returnLogic.newReturn.coReturn,
          "devoluciones");

        //primero debo eliminar detalles si hay
        this.returnDatabaseService.deleteReturnDetails(dbServ, this.returnLogic.newReturn.coReturn).then();
        // inserto los detalles finales
        this.returnDatabaseService.saveReturnDetails(dbServ, this.returnLogic.newReturn.details).then();
        this.returnLogic.setChange(false, false);
        this.returnLogic.showBackRoute('devoluciones');
        this.messageService.hideLoading();
      }).catch(err => console.log('saveReturn: ' + err));
    });

  }

  setResult(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpen = false;
      this.sendReturn(this.synchronizationServices.getDatabase());
    } else {
      this.alertMessageOpen = false;
    }
  }

  setsaveOrExitOpen(isOpen: boolean) {
    this.saveOrExitOpen = isOpen;
  }

}
