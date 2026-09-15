
import { ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { PendingTransaction } from 'src/app/modelos/tables/pendingTransactions';
import { AutoSendService } from 'src/app/services/autoSend/auto-send.service';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { DELIVERY_STATUS_SENT, DELIVERY_STATUS_TO_SEND, VISIT_STATUS_TO_SEND, VISIT_STATUS_VISITED } from 'src/app/utils/appConstants'
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { Subscription } from 'rxjs';
import { Platform } from '@ionic/angular';


@Component({
  selector: 'app-inventario-header',
  templateUrl: './inventario-header.component.html',
  styleUrls: ['./inventario-header.component.scss'],
  standalone: false
})
export class InventarioHeaderComponent implements OnInit {

  public inventariosLogicService = inject(InventariosLogicService);
  private messageService = inject(MessageService);
  private services = inject(ServicesService);
  private synchronizationServices = inject(SynchronizationDBService);
  private autoSend = inject(AutoSendService);
  public adjuntoService = inject(AdjuntoService);
  private cdr = inject(ChangeDetectorRef);

  public messageAlert!: MessageAlert;

  /*   public showHeaderButtons: Boolean = false;
    public disableSendButton: Boolean = true;
    public cannotSendClientStock: Boolean = true;
    public alertMessageOpen: Boolean = false; */
  public header: string = '';
  public mensaje: string = '';
  public alertButtons: any;
  public alertButtonsValidation: any;
  public buttonsSalvar: any;
  public subscriberShow: any;
  public subscriberDisabled: any;
  public subscriberToSend: any;
  public AttachSubscription: any;
  public AttachWeightSubscription: any;
  public textAlertButtonCancel: String = '';
  public textAlertButtonConfirm: String = '';
  public textSave: String = '';
  public textExit: String = '';
  public saveOrExitOpen = false;
  public alertMessageOpenSend: Boolean = false;
  public alertMessageOpenSave: Boolean = false;
  public alertMessageOpenSendSuggested = false;
  /** Alerta local de validación (mensaje exacto; no depende de app-message). */
  public alertMessageOpenValidation = false;
  public validationFailureMessage = '';
  backButtonSubscription: Subscription = this.platform.backButton.subscribeWithPriority(10, () => {
    //console.log('backButton was called!');
    this.onBackClicked();
  });


  constructor(private router: Router,
    private platform: Platform,
  ) {

  }

  ngOnInit() {
    this.textAlertButtonCancel = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_CANCELAR')! ? this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_CANCELAR')! : "Cancelar";
    this.textAlertButtonConfirm = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_ACEPTAR')! ? this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_ACEPTAR')! : "Aceptar";
    this.textSave = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_SALIR_GUARDAR')! ? this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_SALIR_GUARDAR')! : "Guardar y salir";
    this.textExit = this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_SALIR')! ? this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_BOTON_SALIR')! : "Salir sin guardar";

    this.subscriberShow = this.inventariosLogicService.showButtons.subscribe((data: Boolean) => {
      this.inventariosLogicService.showHeaderButtons = data;
    });

    this.subscriberDisabled = this.inventariosLogicService.stockValidToSave.subscribe((data: Boolean) => {
      this.inventariosLogicService.disableSaveButton = !data;
    });

    this.subscriberToSend = this.inventariosLogicService.stockValidToSend.subscribe((validToSend: Boolean) => {
      this.inventariosLogicService.cannotSendClientStock = !validToSend;
    });

    this.AttachSubscription = this.adjuntoService.AttachmentChanged.subscribe(() => {
      this.inventariosLogicService.newClientStock.hasAttachments = this.adjuntoService.hasItems();
      this.inventariosLogicService.newClientStock.nuAttachments = this.adjuntoService.getNuAttachment();
      this.inventariosLogicService.notifyStockEdited();
    });

    this.AttachWeightSubscription = this.adjuntoService.AttachmentWeightExceeded.subscribe(() => {
      this.inventariosLogicService.updateSaveButtonAvailability();
      this.inventariosLogicService.updateSendButtonAvailability();
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
          console.log('save and exit');
          this.saveAndExit();
        },
      },
      {
        text: this.textExit,
        role: 'exit',
        handler: () => {
          console.log('exit w/o save');
          /* this.inventariosLogicService.setChange(false, false); */
          this.inventariosLogicService.showBackRoute('inventarios');
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

  ngOnDestroy() {
    this.subscriberShow.unsubscribe();
    this.subscriberDisabled.unsubscribe();
    this.subscriberToSend.unsubscribe();
    this.backButtonSubscription.unsubscribe();
    this.subscriberShow.unsubscribe();
    this.AttachSubscription.unsubscribe();
    this.AttachWeightSubscription.unsubscribe();
  }


  onBackClicked() {

    if (this.inventariosLogicService.isEdit) {
      this.saveOrExitOpen = true;
    } else
      this.inventariosLogicService.showBackRoute('inventarios');
  }

  saveSendNewReturn(send: Boolean, buttonBack: Boolean) {

    this.messageService.showLoading().then(() => {
      let coClientStockDetailUnits = [];

      for (var i = 0; i < this.inventariosLogicService.newClientStock.clientStockDetails.length; i++) {
        for (var j = 0; j < this.inventariosLogicService.newClientStock.clientStockDetails[i].clientStockDetailUnits.length; j++) {
          coClientStockDetailUnits.push(
            this.inventariosLogicService.newClientStock.clientStockDetails[i].clientStockDetailUnits[j].coClientStockDetail
          )
        }
      }

      this.inventariosLogicService.deleteClientStockDetailsUnits(this.synchronizationServices.getDatabase(), coClientStockDetailUnits).then(result => {
        this.inventariosLogicService.deleteClientStockDetails(this.synchronizationServices.getDatabase(), this.inventariosLogicService.newClientStock.coClientStock).then(result => {
          //SE GUARDARA CLIENTSTOCK
          this.inventariosLogicService.saveClientStock(this.synchronizationServices.getDatabase(), send).then(async (res) => {
            this.inventariosLogicService.isEdit = false;
            const db = this.synchronizationServices.getDatabase();
            await this.adjuntoService.savePhotos(db, this.inventariosLogicService.newClientStock.coClientStock, "inventarios");

            console.log(res);
            this.inventariosLogicService.applyPersistSucceededBaseline();
            this.inventariosLogicService.resetSendValidationUx();
            if (send) {
              //SE ENVIARA Y GUARDARA CLIENTSTOCK
              let pendingTransaction = {} as PendingTransaction;
              pendingTransaction.coTransaction = this.inventariosLogicService.newClientStock.coClientStock;
              pendingTransaction.idTransaction = this.inventariosLogicService.newClientStock.idClientStock;
              pendingTransaction.type = "clientStock";

              console.log("preparando para enviar inventario");


              if (localStorage.getItem("connected") == "true") {
                //nada aca
                this.messageAlert = new MessageAlert(
                  this.inventariosLogicService.inventarioTags.get('INV_HEADER_MESSAGE')!,
                  this.inventariosLogicService.inventarioTags.get('INV_SEND_STOCK_MSG') == undefined ? "El Inventario será enviado" : this.inventariosLogicService.inventarioTags.get('INV_SEND_STOCK_MSG')!,
                );
                this.messageService.alertModal(this.messageAlert);
              } else {
                this.messageAlert = new MessageAlert(
                  this.inventariosLogicService.inventarioTags.get('INV_HEADER_MESSAGE')!,
                  this.inventariosLogicService.inventarioTags.get('INV_MSJ_ERROR_NOTSIGNAL') == undefined ? "No hay conexión a internet, no se puede enviar el inventario" : this.inventariosLogicService.inventarioTags.get('INV_MSJ_ERROR_NOTSIGNAL')!,

                );
                this.messageService.alertModal(this.messageAlert);
              }

              this.services.insertPendingTransaction(this.synchronizationServices.getDatabase(), pendingTransaction).then(result => {
                if (result) {
                  void this.autoSend.runPendingQueue();
                  /* this.router.navigate(['inventarios']); */
                  this.inventariosLogicService.showBackRoute('inventarios');
                  this.messageService.hideLoading();
                }
              })

            } else {
              this.messageAlert = new MessageAlert(
                this.inventariosLogicService.inventarioTags.get('INV_HEADER_MESSAGE')!,
                this.inventariosLogicService.inventarioTags.get('INV_MSJ_SAVETYPESTOCK')!,

              );
              this.messageService.alertModal(this.messageAlert);
              if (buttonBack) {
                console.log("salvar y salir")
                this.inventariosLogicService.showBackRoute('inventarios');

              }
              this.messageService.hideLoading();
            }
          })
        })
      })
    });

  }


  subscriber() {
    this.subscriberShow = this.inventariosLogicService.showButtons.subscribe((data: Boolean) => {
      this.inventariosLogicService.showHeaderButtons = data;
    });
  }

  setResult(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    if (ev.detail.role === 'confirm') {
      if (this.alertMessageOpenSend) {
        this.alertMessageOpenSend = false;
        void this.proceedAfterSendConfirm();
        return;
      }
      if (this.alertMessageOpenSave) {
        this.alertMessageOpenSave = false;
        this.saveSendNewReturn(false, false);
      }

    } else {

      this.alertMessageOpenSend = false;
      this.alertMessageOpenSave = false;
    }
  }

  private async proceedAfterSendConfirm(): Promise<void> {
    const db = this.synchronizationServices.getDatabase();
    const coClientStock = this.inventariosLogicService.newClientStock.coClientStock;

    if (!this.inventariosLogicService.suggestedOrder) {
      this.inventariosLogicService.setAttachSuggestedOrderOnStockSend(coClientStock, false);
      this.saveSendNewReturn(true, false);
      return;
    }

    const snapshot = await this.inventariosLogicService.getSuggestedOrderSnapshotByClientStock(
      db,
      coClientStock,
    );
    const pendingSuggested = this.inventariosLogicService.hasPendingSuggestedOrderPersist(coClientStock);

    if (snapshot || pendingSuggested) {
      this.header = this.inventariosLogicService.inventarioTags.get('INV_HEADER_MESSAGE')!;
      this.mensaje = this.inventariosLogicService.inventarioTags.get('INV_MSJ_SEND_SUGGESTED_ORDER')
        ?? '¿Desea enviar también la sugerencia de pedido?';
      this.alertMessageOpenSendSuggested = true;
      return;
    }

    this.inventariosLogicService.setAttachSuggestedOrderOnStockSend(coClientStock, false);
    this.saveSendNewReturn(true, false);
  }

  setResultSendSuggested(ev: { detail: { role?: string } }): void {
    const coClientStock = this.inventariosLogicService.newClientStock.coClientStock;
    const attach = ev.detail.role === 'confirm';
    this.inventariosLogicService.setAttachSuggestedOrderOnStockSend(coClientStock, attach);
    this.alertMessageOpenSendSuggested = false;
    this.saveSendNewReturn(true, false);
  }

  private notifyStockValidationFailure(options: {
    blockSend: boolean;
    message: string;
    focusTab?: 'default' | 'inventario' | 'actividades' | 'adjuntos';
  }): void {
    const focusIndex = this.inventariosLogicService.findFirstIncompleteTypeStockIndex();
    if (focusIndex >= 0) {
      this.inventariosLogicService.stockSendFocusTypeStockIndex = focusIndex;
    }
    if (options.blockSend) {
      this.inventariosLogicService.sendBlockedByFields = true;
      this.inventariosLogicService.updateSendButtonAvailability();
    }
    this.inventariosLogicService.requestSendValidationTabFocus(options.focusTab);
    this.showStockValidationAlert(options.message);
  }

  /** Alerta en el header con el fallo exacto (misma capa que Enviar/Guardar). */
  private showStockValidationAlert(rawMessage: string): void {
    const message = (rawMessage ?? '').toString().trim()
      || 'Complete los campos obligatorios antes de continuar.';
    this.validationFailureMessage = message;
    this.alertMessageOpenValidation = true;
    this.cdr.detectChanges();
  }

  setResultValidation(): void {
    this.alertMessageOpenValidation = false;
  }

  /** Guardar: solo General (INV-SAVE-001). */
  private validateStockBeforeSave(): boolean {
    if (this.inventariosLogicService.hasStockSaveErrors()) {
      this.notifyStockValidationFailure({
        blockSend: false,
        message: this.inventariosLogicService.getStockSaveValidationMessage(),
        focusTab: 'default',
      });
      return false;
    }
    return true;
  }

  /** Enviar: validación completa (productos → GPS → firma). */
  private validateStockBeforeSend(): boolean {
    this.inventariosLogicService.sendValidationAttempted = true;

    if (this.inventariosLogicService.hasStockFieldErrors()) {
      this.notifyStockValidationFailure({
        blockSend: true,
        message: this.inventariosLogicService.getStockValidationMessage(),
      });
      return false;
    }

    this.inventariosLogicService.sendBlockedByFields = false;
    this.inventariosLogicService.updateSendButtonAvailability();
    return true;
  }

  saveStock() {
    if (!this.validateStockBeforeSave()) {
      return;
    }
    this.header = this.inventariosLogicService.inventarioTags.get('INV_HEADER_MESSAGE')!;
    this.mensaje = this.inventariosLogicService.inventarioTags.get('INV_MSJ_SAVE_QUESTION_TYPESTOCK')!;
    this.alertMessageOpenSave = true;
  }

  sendStock() {
    if (!this.validateStockBeforeSend()) {
      return;
    }
    this.header = this.inventariosLogicService.inventarioTags.get('INV_HEADER_MESSAGE')!;
    this.mensaje = this.inventariosLogicService.inventarioTags.get('INV_MSJ_SEND_QUESTION_TYPESTOCK')!;
    this.alertMessageOpenSend = true;
  }

  sendOrSave(sendOrSave: Boolean) {
    if (sendOrSave) {
      this.sendStock();
    } else {
      this.saveStock();
    }
  }

  saveAndExit() {
    this.saveSendNewReturn(false, true);
  }

  setsaveOrExitOpen(isOpen: boolean) {
    this.saveOrExitOpen = isOpen;
  }
}
