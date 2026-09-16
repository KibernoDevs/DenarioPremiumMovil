import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { PendingTransaction } from 'src/app/modelos/tables/pendingTransactions';
import { AutoSendService } from 'src/app/services/autoSend/auto-send.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ReturnDatabaseService } from 'src/app/services/returns/return-database.service';
import { ReturnLogicService } from 'src/app/services/returns/return-logic.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { DELIVERY_STATUS_SAVED, DELIVERY_STATUS_TO_SEND } from 'src/app/utils/appConstants';

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
  adjuntoService = inject(AdjuntoService);
  private cdr = inject(ChangeDetectorRef);

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
  alertMessageOpenSave: Boolean = false;
  /** Alerta local de validación (mensaje exacto). */
  alertMessageOpenValidation = false;
  validationFailureMessage = '';
  alertButtonsValidation: any[] = [];
  saveOrExitOpen = false;
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
    this.textAlertButtonCancel = this.returnLogic.tags.get('DENARIO_BOTON_CANCELAR')! ? this.returnLogic.tags.get('DENARIO_BOTON_CANCELAR')! : 'Cancelar';
    this.textAlertButtonConfirm = this.returnLogic.tags.get('DENARIO_BOTON_ACEPTAR')! ? this.returnLogic.tags.get('DENARIO_BOTON_ACEPTAR')! : 'Aceptar';
    this.textSave = this.returnLogic.tags.get('DENARIO_BOTON_SALIR_GUARDAR')! ? this.returnLogic.tags.get('DENARIO_BOTON_SALIR_GUARDAR')! : 'Guardar y salir';
    this.textExit = this.returnLogic.tags.get('DENARIO_BOTON_SALIR')! ? this.returnLogic.tags.get('DENARIO_BOTON_SALIR')! : 'Salir sin guardar';

    this.returnLogic.resetReturnValidationUxFlags();
    this.returnLogic.setChange(false, false);
    this.subscriberShow = this.returnLogic.showButtons.subscribe((data: Boolean) => {
      this.showHeaderButtos = data;
    });

    this.subscriberDisabled = this.returnLogic.returnValidToSave.subscribe((data: Boolean) => {
      this.disableSendButton = !data;
    });

    this.subscriberToSend = this.returnLogic.returnValidToSend.subscribe((validToSend: Boolean) => {
      this.cannotSendReturn = !validToSend;
    });

    this.subscriptionAttachmentWeightExceeded = this.adjuntoService.AttachmentWeightExceeded.subscribe(() => {
      this.returnLogic.updateSaveButtonAvailability();
      this.returnLogic.updateSendButtonAvailability();
    });

    this.subscriptionAttachmentChanged = this.adjuntoService.AttachmentChanged.subscribe(() => {
      this.returnLogic.notifyReturnEdited();
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

    this.alertButtonsValidation = [
      {
        text: this.textAlertButtonConfirm,
        role: 'confirm',
      },
    ];

    this.buttonsSalvar = [
      {
        text: this.textSave,
        role: 'save',
        handler: () => {
          if (!this.validateReturnBeforeSave()) {
            return;
          }
          this.saveAndExit(this.synchronizationServices.getDatabase());
        },
      },
      {
        text: this.textExit,
        role: 'exit',
        handler: () => {
          this.returnLogic.setChange(false, false);
          this.returnLogic.finishReturnDetailNavigation();
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
    if (!this.returnLogic.returnDetailActive) {
      this.saveOrExitOpen = false;
      this.returnLogic.showBackRoute('devoluciones');
      this.messageService.hideLoading();
      return;
    }

    if (this.returnLogic.isReturnReadOnlyForEdit() || this.returnLogic.returnSent) {
      this.saveOrExitOpen = false;
      this.returnLogic.finishReturnDetailNavigation();
      this.returnLogic.showBackRoute('devoluciones');
      this.messageService.hideLoading();
      return;
    }

    if (this.returnLogic.shouldPromptReturnExitSaveOrDiscard()) {
      this.buttonsSalvar[0].text = this.returnLogic.tags.get('DENARIO_BOTON_SALIR_GUARDAR')
        ?? this.textSave;
      this.buttonsSalvar[1].text = this.returnLogic.tags.get('DENARIO_BOTON_SALIR')
        ?? this.textExit;
      this.buttonsSalvar[2].text = this.returnLogic.tags.get('DENARIO_BOTON_CANCELAR')
        ?? this.textAlertButtonCancel;
      this.saveOrExitOpen = true;
      return;
    }

    this.saveOrExitOpen = false;
    this.returnLogic.finishReturnDetailNavigation();
    this.returnLogic.showBackRoute('devoluciones');
    this.messageService.hideLoading();
  }

  backButtonSubscription: Subscription = this.platform.backButton.subscribeWithPriority(10, () => {
    this.onBackClicked();
  });

  private notifyReturnValidationFailure(options: {
    blockSend: boolean;
    message: string;
    focusTab?: 'default' | 'productos' | 'adjuntos';
  }): void {
    if (options.blockSend) {
      this.returnLogic.sendBlockedByFields = true;
      this.returnLogic.updateSendButtonAvailability();
    }
    this.returnLogic.requestSendValidationTabFocus(options.focusTab);
    this.showReturnValidationAlert(options.message);
  }

  private showReturnValidationAlert(rawMessage: string): void {
    const message = (rawMessage ?? '').toString().trim()
      || 'Complete los campos obligatorios antes de continuar.';
    this.validationFailureMessage = message;
    this.alertMessageOpenValidation = true;
    this.cdr.detectChanges();
  }

  setResultValidation(): void {
    this.alertMessageOpenValidation = false;
  }

  /** Guardar / Guardar y salir: solo General (DEV-SAVE-001). */
  private validateReturnBeforeSave(): boolean {
    if (!this.returnLogic.hasReturnSaveErrors()) {
      return true;
    }
    this.notifyReturnValidationFailure({
      blockSend: false,
      message: this.returnLogic.getReturnSaveValidationMessage(),
      focusTab: 'default',
    });
    return false;
  }

  /** Enviar: validación completa + mensaje + salto de pestaña. */
  private validateReturnBeforeSend(): boolean {
    this.returnLogic.sendValidationAttempted = true;

    if (this.returnLogic.hasReturnFieldErrors()) {
      this.notifyReturnValidationFailure({
        blockSend: true,
        message: this.returnLogic.getReturnValidationMessage(),
      });
      return false;
    }

    this.returnLogic.sendBlockedByFields = false;
    this.returnLogic.updateSendButtonAvailability();
    return true;
  }

  buttonSaveReturn(): void {
    if (!this.validateReturnBeforeSave()) {
      return;
    }
    this.header = this.headerTags.get('DENARIO_DEV')!;
    this.mensaje =
      this.returnLogic.tags.get('DEV_MSJ_SAVE_QUESTION')
      ?? '¿Desea guardar la devolución?';
    this.alertMessageOpenSave = true;
  }

  buttonSendReturn(): void {
    if (!this.validateReturnBeforeSend()) {
      return;
    }
    this.header = this.headerTags.get('DENARIO_DEV')!;
    this.mensaje = this.headerTags.get('DENARIO_DEV_CONFIRM_SEND')!;
    this.alertMessageOpen = true;
  }

  setResultSave(ev: any): void {
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpenSave = false;
      void this.persistReturnSaved();
    } else {
      this.alertMessageOpenSave = false;
    }
  }

  private persistReturnSaved(): Promise<void> {
    this.returnLogic.newReturn.details = this.returnLogic.productList;
    return this.messageService.showLoading().then(() => {
      this.returnLogic.newReturn.stDelivery = DELIVERY_STATUS_SAVED;
      this.returnLogic.newReturn.hasAttachments = this.adjuntoService.hasItems();
      this.returnLogic.newReturn.nuAttachments = this.adjuntoService.getNuAttachment();
      return this.returnDatabaseService.saveReturn(
        this.synchronizationServices.getDatabase(),
        this.returnLogic.newReturn,
      ).then(async () => {
        await this.returnDatabaseService.deleteReturnDetails(
          this.synchronizationServices.getDatabase(),
          this.returnLogic.newReturn.coReturn,
        );
        await this.returnDatabaseService.saveReturnDetails(
          this.synchronizationServices.getDatabase(),
          this.returnLogic.newReturn.details,
        );
        await this.adjuntoService.savePhotos(
          this.synchronizationServices.getDatabase(),
          this.returnLogic.newReturn.coReturn,
          'devoluciones',
        );
        this.returnLogic.applyReturnPersistSucceededBaseline();
        this.returnLogic.resetSendValidationUx();
        this.returnLogic.setChange(false, true);
        this.messageAlert = new MessageAlert(
          this.headerTags.get('DENARIO_DEV')!,
          this.headerTags.get('DENARIO_DEV_TO_SAVE')!,
        );
        this.messageService.alertModal(this.messageAlert);
        this.messageService.hideLoading();
      }).catch(err => {
        console.log('saveReturn: ' + err);
        this.messageService.hideLoading();
      });
    });
  }

  sendReturn(dbServ: SQLiteObject) {
    const pendingTransaction = {} as PendingTransaction;
    this.returnLogic.newReturn.stDelivery = DELIVERY_STATUS_TO_SEND;
    this.returnLogic.newReturn.hasAttachments = this.adjuntoService.hasItems();
    this.returnLogic.newReturn.nuAttachments = this.adjuntoService.getNuAttachment();
    this.messageService.showLoading().then(() => {
      this.returnDatabaseService.saveReturn(dbServ, this.returnLogic.newReturn).then(async () => {
        await this.adjuntoService.savePhotos(
          this.synchronizationServices.getDatabase(),
          this.returnLogic.newReturn.coReturn,
          'devoluciones',
        );
        this.returnDatabaseService.saveReturnDetails(dbServ, this.returnLogic.newReturn.details).then(() => {
          pendingTransaction.coTransaction = this.returnLogic.newReturn.coReturn;
          pendingTransaction.idTransaction = this.returnLogic.newReturn.idReturn;
          pendingTransaction.type = 'return';
          if (localStorage.getItem('connected') == 'true') {
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
              void this.autoSend.runPendingQueue();
              this.returnLogic.applyReturnPersistSucceededBaseline();
              this.returnLogic.resetSendValidationUx();
              this.returnLogic.returnChanged = false;
              this.onBackClicked();
            }
          });
        });
      }).catch(err => console.log('saveSendNewReturn: ' + err))
        .finally(() => this.messageService.hideLoading());
    });
  }

  saveAndExit(dbServ: SQLiteObject) {
    this.returnLogic.newReturn.details = this.returnLogic.productList;
    this.messageService.showLoading().then(() => {
      this.returnLogic.newReturn.stDelivery = DELIVERY_STATUS_SAVED;
      this.returnLogic.newReturn.hasAttachments = this.adjuntoService.hasItems();
      this.returnLogic.newReturn.nuAttachments = this.adjuntoService.getNuAttachment();
      this.returnDatabaseService.saveReturn(dbServ, this.returnLogic.newReturn).then(async () => {
        await this.adjuntoService.savePhotos(
          this.synchronizationServices.getDatabase(),
          this.returnLogic.newReturn.coReturn,
          'devoluciones',
        );
        this.returnDatabaseService.deleteReturnDetails(dbServ, this.returnLogic.newReturn.coReturn).then();
        this.returnDatabaseService.saveReturnDetails(dbServ, this.returnLogic.newReturn.details).then();
        this.returnLogic.setChange(false, false);
        this.returnLogic.applyReturnPersistSucceededBaseline();
        this.returnLogic.finishReturnDetailNavigation();
        this.returnLogic.showBackRoute('devoluciones');
        this.messageService.hideLoading();
      }).catch(err => console.log('saveReturn: ' + err));
    });
  }

  setResult(ev: any) {
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpen = false;
      this.returnLogic.newReturn.details = this.returnLogic.productList;
      this.sendReturn(this.synchronizationServices.getDatabase());
    } else {
      this.alertMessageOpen = false;
    }
  }

  setsaveOrExitOpen(isOpen: boolean) {
    this.saveOrExitOpen = isOpen;
  }

}
