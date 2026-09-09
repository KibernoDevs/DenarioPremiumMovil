import { Component, EventEmitter, OnInit, Output, inject, Input, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { Collection } from 'src/app/modelos/tables/collection';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { AutoSendService } from 'src/app/services/autoSend/auto-send.service';
import { ServicesService } from 'src/app/services/services.service';
import { COLLECT_STATUS_SAVED, COLLECT_STATUS_SENT, COLLECT_STATUS_TO_SEND, COLLECT_STATUS_NEW } from 'src/app/utils/appConstants';
import {
  canCreateCollectionForClient,
  MSG_CLIENT_SUSPENDED_COLLECTION,
} from 'src/app/utils/client-suspension.policy';


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
  private services = inject(ServicesService);
  private autoSend = inject(AutoSendService);
  private cdr = inject(ChangeDetectorRef);
  messageAlert!: MessageAlert;



  public textSave: String = '';
  public textExit: String = '';
  public alertSaveOrExit: Boolean = false;
  public alertMessageOpen: Boolean = false;
  public alertMessageOpenSend: Boolean = false;
  /** Alerta local de validación Enviar (no depende de app-message). */
  public alertMessageOpenValidation = false;
  public validationFailureMessage = '';

  public textAlertButtonCancel: String = '';
  public textAlertButtonConfirm: String = '';
  public header: string = '';
  public mensaje: string = '';

  public subscriberShow: any;
  public subscriberDisabled: any;
  public subscriptionAttachmentChanged: any;
  public subscriptionAttachmentWeightExceeded: any;

  public COLLECT_STATUS_SAVED = COLLECT_STATUS_SAVED;
  public COLLECT_STATUS_SENT = COLLECT_STATUS_SENT;
  public COLLECT_STATUS_TO_SEND = COLLECT_STATUS_TO_SEND;
  public COLLECT_STATUS_NEW = COLLECT_STATUS_NEW;

  /** Evita doble Enviar si ion-alert didDismiss dispara dos veces. */
  private isSendingNormalCollection = false;

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

  public alertButtonsValidation = [
    {
      text: 'Aceptar',
      role: 'confirm',
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
        this.alertButtonsValidation[0].text =
          this.collectService.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')! || 'Aceptar';
      }
    })

    this.subscriberShow = this.collectService.showButtons.subscribe((data: Boolean) => {
      this.collectService.showHeaderButtons = data;
      if (data && !this.collectService.isCollectionReadOnlyForEdit()) {
        this.resetSendValidationAlerts();
        this.collectService.resetSendValidationUx();
      }
    });

    this.subscriberDisabled = this.collectService.collectValidToSave.subscribe((data: Boolean) => {
      this.collectService.disableSavedButton = data ? false : true;
    });

    this.subscriptionAttachmentChanged = this.adjuntoService.AttachmentChanged.subscribe(() => {
      this.collectService.notifyCollectionEdited();
      this.cdr.detectChanges();
    });
    this.subscriptionAttachmentWeightExceeded = this.adjuntoService.AttachmentWeightExceeded.subscribe(() => {
      this.collectService.updateSaveButtonAvailability();
      this.collectService.disableSendButton = true;
    })
  }

  ngOnDestroy() {
    this.subscriberShow?.unsubscribe();
    this.subscriberDisabled?.unsubscribe();
    this.backButtonSubscription?.unsubscribe();
    this.subscriptionAttachmentChanged?.unsubscribe();
    this.subscriptionAttachmentWeightExceeded?.unsubscribe();
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
    this.collectService.resetSendValidationUx();
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
    // Cerrar primero; un segundo didDismiss (isOpen→false) no debe reenviar.
    if (!this.alertMessageOpenSend) {
      return;
    }
    this.alertMessageOpenSend = false;
    if (ev?.detail?.role === 'confirm') {
      this.sendOrSave(true);
    }
  }

  private isCollectSendOnline(): boolean {
    return localStorage.getItem('connected') === 'true';
  }

  /** UX de “Por Enviar” (paths que aún encolan vía saveSend + AutoSend en paralelo). */
  notifyCollectionQueuedForSend(): void {
    this.collectService.sendCollection = true;

    const sendMessage = this.isCollectSendOnline()
      ? this.collectService.collectionTags.get('COB_DENARIO_TO_SEND')!
      : this.collectService.collectionTags.get('COB_DENARIO_TO_SEND_OFFLINE')!;

    if (this.collectService.lastPersistCreatedSeparateIgtfDocument) {
      this.collectService.mensaje = `${sendMessage}\n\n${this.collectService.resolveSeparateIgtfDocumentCreatedMessage()}`;
      this.alertMessageOpen = true;
      return;
    }

    this.messageAlert = new MessageAlert(
      this.collectService.collectionTags.get('COB_HEADER_MESSAGE')!,
      sendMessage,
    );
    this.messageService.alertModal(this.messageAlert);
  }

  /** Solo offline: un aviso de cola (online usa loading + alertas AutoSend). */
  private notifyOfflineCollectQueued(): void {
    this.collectService.sendCollection = true;
    if (this.isCollectSendOnline()) {
      return;
    }

    const sendMessage = this.collectService.collectionTags.get('COB_DENARIO_TO_SEND_OFFLINE')!;
    if (this.collectService.lastPersistCreatedSeparateIgtfDocument) {
      this.collectService.mensaje = `${sendMessage}\n\n${this.collectService.resolveSeparateIgtfDocumentCreatedMessage()}`;
      this.alertMessageOpen = true;
      return;
    }

    this.messageAlert = new MessageAlert(
      this.collectService.collectionTags.get('COB_HEADER_MESSAGE')!,
      sendMessage,
    );
    this.messageService.alertModal(this.messageAlert);
  }

  saveSendNewCollection(send: Boolean, coCollection: string) {
    if (send) {
      this.collectService.saveSendCollection(coCollection);
      this.notifyCollectionQueuedForSend();
    }
  }

  private resetSendValidationAlerts(): void {
    this.alertMessageOpenValidation = false;
    this.validationFailureMessage = '';
    this.alertMessageOpenSend = false;
  }

  private async finishAfterSendNavigation(): Promise<void> {
    this.resetSendValidationAlerts();
    this.collectService.resetCollectionSessionState();
    this.collectService.initCollect = true;
    this.collectService.showHeaderButtons = false;
    this.collectService.cobroComponent = false;
    this.collectService.cobrosComponent = true;
    await this.messageService.hideLoading();
  }

  /**
   * COB-PREPAID-002: cobro normal — batch cobro + anticipo + un runPendingQueue.
   * Online: loading solo mientras persiste/encola; luego hide → AutoSend (alertas limpios).
   * Sin “Su Cobro será enviado” online. Offline: sin loading + aviso de cola.
   */
  private async sendNormalCollectionWithOptionalPrepaid(): Promise<void> {
    if (this.isSendingNormalCollection) {
      return;
    }
    this.isSendingNormalCollection = true;
    const online = this.isCollectSendOnline();

    try {
      if (online) {
        await this.messageService.showLoading();
      }

      const db = this.synchronizationServices.getDatabase();
      const coCollection = this.collectService.collection.coCollection;

      const response = await this.collectService.saveCollection(
        db,
        this.collectService.collection,
        true,
      );
      await this.adjuntoService.savePhotos(db, coCollection, 'cobros');
      console.log(response);
      this.collectService.applyPersistSucceededBaseline();

      const shouldCreatePrepaid = await this.collectService.refreshAutomatedPrepaidBeforeSend();
      let anticipoCoCollection: string | null = null;
      if (shouldCreatePrepaid) {
        anticipoCoCollection = await this.collectService.createAnticipoCollection(
          db,
          this.collectService.collection,
          false,
        );
        console.log(anticipoCoCollection, ' SE CREO ANTICIPO AUTOMATICO');
        this.collectService.createAutomatedPrepaid = false;
        this.collectService.anticipoAutomatico = [];
      }

      const transactions = this.collectService.buildCollectPendingBatch(
        coCollection,
        anticipoCoCollection,
      );
      await this.services.insertPendingTransactionBatch(db, transactions);
      this.collectService.sendCollection = true;

      // Esperar a que el spinner se cierre del todo antes de AutoSend (evita z-index overlap).
      await this.finishAfterSendNavigation();
      if (!online) {
        this.notifyOfflineCollectQueued();
      }
      await this.autoSend.runPendingQueue();
    } finally {
      this.isSendingNormalCollection = false;
      await this.messageService.hideLoading();
    }
  }

  sendOrSave(sendOrSave: boolean) {
    if (!canCreateCollectionForClient(this.collectService.client)) {
      this.messageService.transaccionMsjModalNB(MSG_CLIENT_SUSPENDED_COLLECTION);
      return;
    }

    if (sendOrSave) {
      void this.persistSendAfterRevalidation();
      return;
    }

    this.persistSaveOnly();
  }

  /**
   * Enviar: revalida el colector completo antes de persistir (COB-SEND-ATTACH-001).
   * Evita que confirmación abierta o prepaid dejen pasar adjuntos/campos/tolerancia.
   */
  private async persistSendAfterRevalidation(): Promise<void> {
    this.collectService.sendValidationAttempted = true;
    const blocking = await this.collectService.evaluateSendReadiness();
    if (blocking.length > 0 || !this.collectService.canProceedSendAfterValidation()) {
      this.collectService.sendBlockedByFields = true;
      this.collectService.updateSendButtonAvailability();
      const issue = blocking[0] ?? this.collectService.lastSendIssues[0];
      if (this.collectService.collection.coType === '2') {
        this.collectService.retentionSendFocusDocIndex =
          this.collectService.findFirstIncompleteRetentionDocumentIndex();
      }
      this.showSendValidationAlert(
        issue?.message ?? this.collectService.getCollectionSendValidationMessage(),
      );
      this.collectService.requestSendValidationTabFocus(issue?.tab);
      return;
    }

    this.collectService.collectionIsSave = true;

    // Cobro normal Enviar: online=loading+AutoSend; offline=aviso cola.
    if (this.collectService.collection.coType === '0') {
      this.collectService.collection.stDelivery = 2;
      this.collectService.collection.stCollection = this.COLLECT_STATUS_TO_SEND;
      void this.sendNormalCollectionWithOptionalPrepaid().catch(err => {
        console.error('CobrosHeader: error enviando cobro con anticipo', err);
        this.collectService.collectionIsSave = false;
        void this.messageService.hideLoading();
      });
      return;
    }

    this.messageService.showLoading().then(async () => {
      if (this.collectService.collection.coType === '1') {
        await this.collectService.calcularMontos('', 0);
        this.collectService.syncAnticipoTotalsBeforePersist();
      }

      this.collectService.collection.stDelivery = 2;
      this.collectService.collection.stCollection = this.COLLECT_STATUS_TO_SEND;

      this.collectService.saveCollection(
        this.synchronizationServices.getDatabase(),
        this.collectService.collection,
        true,
      ).then(response => {
        this.adjuntoService.savePhotos(
          this.synchronizationServices.getDatabase(),
          this.collectService.collection.coCollection,
          'cobros',
        ).then(() => {
          console.log(response);
          this.collectService.applyPersistSucceededBaseline();
          this.saveSendNewCollection(true, this.collectService.collection.coCollection);
          this.collectService.refreshAutomatedPrepaidBeforeSend().then((shouldCreatePrepaid) => {
            if (shouldCreatePrepaid) {
              this.collectService.createAnticipoCollection(
                this.synchronizationServices.getDatabase(),
                this.collectService.collection,
              ).then(resp => {
                console.log(resp, ' SE CREO ANTICIPO AUTOMATICO');
                this.collectService.createAutomatedPrepaid = false;
                this.collectService.anticipoAutomatico = [];
              });
            }

            this.finishAfterSendNavigation();
          });
        });
      });
    });
  }

  private persistSaveOnly(): void {
    this.collectService.collectionIsSave = true;

    this.messageService.showLoading().then(async () => {
      if (this.collectService.collection.coType === '1') {
        await this.collectService.calcularMontos('', 0);
        this.collectService.syncAnticipoTotalsBeforePersist();
      }

      this.collectService.collection.stDelivery = 3;
      this.collectService.collection.stCollection = 3;
      this.collectService.saveCollection(
        this.synchronizationServices.getDatabase(),
        this.collectService.collection,
        false,
      ).then(async response => {
        await this.adjuntoService.savePhotos(
          this.synchronizationServices.getDatabase(),
          this.collectService.collection.coCollection,
          'cobros',
        );
        console.log(response);
        this.collectService.applyPersistSucceededBaseline();
        this.saveSendNewCollection(false, this.collectService.collection.coCollection);
        switch (this.collectService.collection.coType) {
          case '0': {
            this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_COLLECT_MSG')!;
            break;
          }
          case '1': {
            this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_ANTICIPO_MSG')!;
            break;
          }
          case '2': {
            this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_RETENTION_MSG')!;
            break;
          }
          case '3': {
            this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_IGTF_MSG')!;
            break;
          }
          default: {
            this.collectService.mensaje = this.collectService.collectionTags.get('COB_SAVE_COLLECT_MSG')!;
          }
        }
        this.alertMessageOpen = true;
        this.messageService.hideLoading();
      });
    });
  }

  /**
   * Alerta en el header (misma capa que Enviar).
   * No depende de app-message / transaccionMsjNB.
   */
  private showSendValidationAlert(rawMessage: string): void {
    const message = (rawMessage ?? '').toString().trim()
      || 'Complete los campos obligatorios antes de enviar.';
    this.validationFailureMessage = message;
    this.alertMessageOpenValidation = true;
    this.cdr.detectChanges();
  }

  setResultValidation(): void {
    this.alertMessageOpenValidation = false;
  }

  sendCollect() {
    this.collectService.sendValidationAttempted = true;

    void this.collectService.validateToSend().then(() => {
      // COB-SEND-ATTACH-001: no confiar solo en lastValidToSend (prepaid podía forzarlo).
      if (!this.collectService.canProceedSendAfterValidation()) {
        this.collectService.sendBlockedByFields = true;
        this.collectService.updateSendButtonAvailability();
        const issue = this.collectService.lastSendIssues[0];
        if (this.collectService.collection.coType === '2') {
          this.collectService.retentionSendFocusDocIndex =
            this.collectService.findFirstIncompleteRetentionDocumentIndex();
        }
        this.showSendValidationAlert(
          issue?.message ?? this.collectService.getCollectionSendValidationMessage(),
        );
        this.collectService.requestSendValidationTabFocus(issue?.tab);
        return;
      }

      this.collectService.sendBlockedByFields = false;
      this.collectService.updateSendButtonAvailability();

      switch (this.collectService.collection.coType) {
        case '0': {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_COLLECT_MSG')!;
          break;
        }
        case '1': {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_ANTICIPO_MSG')!;
          break;
        }
        case '2': {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_RETENTION_MSG')!;
          break;
        }
        case '3': {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_IGTF_MSG')!;
          break;
        }
        default: {
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_SEND_COLLECT_MSG')!;
        }
      }

      this.alertMessageOpenSend = true;
      this.cdr.detectChanges();
    });
  }


  /* validateBack() {
    if (!this.collectService.collectValid) {
      this.alertSaveOrExit = true
    } else {
      this.goBack();
    }
  } */
}
