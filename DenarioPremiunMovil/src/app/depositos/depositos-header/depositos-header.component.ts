import { Component, EventEmitter, OnInit, Output, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { DepositService } from 'src/app/services/deposit/deposit.service';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { Subscription } from 'rxjs';
import { Platform } from '@ionic/angular';
import { MessageService } from 'src/app/services/messageService/message.service';
import { DEPOSITO_STATUS_NEW, DEPOSITO_STATUS_SAVED, DEPOSITO_STATUS_TO_SEND, DEPOSITO_STATUS_SENT } from 'src/app/utils/appConstants';


@Component({
  selector: 'app-depositos-header',
  templateUrl: './depositos-header.component.html',
  styleUrls: ['./depositos-header.component.scss'],
  standalone: false
})
export class DepositosHeaderComponent implements OnInit {


  @Output()
  backClicked: EventEmitter<string> = new EventEmitter<string>();


  public depositService = inject(DepositService);
  public adjuntoService = inject(AdjuntoService);
  public synchronizationServices = inject(SynchronizationDBService);

  public messageService = inject(MessageService)

  public subscriberShow: any;
  public subscriberDisabled: any;
  public subscriberToSend: any;

  //public subscriptionWeightLimit: any;
  //public subscriptionAttachmentChange: any;

  public alertMessageOpenSend: Boolean = false;
  public alertMessageOpenSave: Boolean = false;

  public DEPOSITO_STATUS_NEW = DEPOSITO_STATUS_NEW;
  public DEPOSITO_STATUS_SAVED = DEPOSITO_STATUS_SAVED;
  public DEPOSITO_STATUS_TO_SEND = DEPOSITO_STATUS_TO_SEND;
  public DEPOSITO_STATUS_SENT = DEPOSITO_STATUS_SENT;

  public buttonsSalvar = [
    {
      text: '',
      role: 'save',
      handler: () => {
        console.log('save and exit');
        this.depositService.depositValid = false;
        this.saveDeposit().then(() => {
          this.alertMessageOpenSave = true;
          this.depositService.depositValid = false;
          this.depositService.message = this.depositService.depositTags.get('DEP_SAVE_MSG')!;
          setTimeout(() => {
            this.messageService.hideLoading();
            this.depositService.showBackRoute('depositos');
          }, 100);

        });
      },
    },
    {
      text: '',
      role: 'exit',
      handler: () => {
        console.log('exit w/o save');
        this.depositService.depositValid = false;
        this.depositService.showBackRoute('depositos');


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
  ) { }

  ngOnInit() {

    this.subscriberShow = this.depositService.showButtons.subscribe((showButtons: Boolean) => {
      this.depositService.showHeaderButtons = showButtons;
    });

    this.subscriberDisabled = this.depositService.depositValidToSave.subscribe((validToSave: Boolean) => {
      this.depositService.disabledSaveButton = !validToSave;
    });

    this.subscriberToSend = this.depositService.depositValidToSend.subscribe((validToSend: Boolean) => {
      this.depositService.disabledSendButton = !validToSend;
    });

    /*
    this.subscriptionAttachmentChange = this.adjuntoService.AttachmentChanged.subscribe(() => {
      var disable = (this.depositService.deposit.depositCollect.length == 0);
      this.depositService.disabledSendButton = disable;
      this.depositService.disabledSaveButton = disable;
    });

    this.subscriptionWeightLimit = this.adjuntoService.AttachmentWeightExceeded.subscribe(() => {
      this.depositService.disabledSendButton = true;
      this.depositService.disabledSaveButton = true;
    });
    */

  }

  ngOnDestroy() {
    this.subscriberShow.unsubscribe();
    this.subscriberDisabled.unsubscribe();
    this.subscriberToSend.unsubscribe();
    this.backButtonSubscription.unsubscribe();
    //this.subscriptionAttachmentChange.unsubscribe();
    //this.subscriptionWeightLimit.unsubscribe();
  }

  setResultSend(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpenSend = false;
      this.sendDeposit();
    } else {
      this.alertMessageOpenSend = false;
    }
  }

  setResultSave(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpenSave = false;
      //this.saveDeposit();
    } else {
      this.alertMessageOpenSave = false;
    }
  }



  goBack() {
    if (!this.depositService.depositValid) {
      this.depositService.saveOrExitOpen = false;
      this.depositService.showBackRoute('depositos');
      return;
    }

    const shouldPromptExitSaveOrDiscard =
      !this.depositService.depositPersistedBaseline || this.depositService.depositDirtySincePersist;

    if (shouldPromptExitSaveOrDiscard) {
      this.buttonsSalvar[0].text = this.depositService.depositTagsDenario.get('DENARIO_BOTON_SALIR_GUARDAR')!
      this.buttonsSalvar[1].text = this.depositService.depositTagsDenario.get('DENARIO_BOTON_SALIR')!
      this.buttonsSalvar[2].text = this.depositService.depositTagsDenario.get('DENARIO_BOTON_CANCELAR')!
      this.depositService.saveOrExitOpen = true;
    } else {
      this.depositService.showBackRoute('depositos');
    }

  }

  backButtonSubscription: Subscription = this.platform.backButton.subscribeWithPriority(10, () => {
    //console.log('backButton was called!');
    this.goBack();
  });

  buttonSave() {

    this.saveDeposit().then(() => {
      this.depositService.message = this.depositService.depositTags.get('DEP_SAVE_MSG')!;
      this.alertMessageOpenSave = true;
      this.messageService.hideLoading();
    })
  }

  buttonSend() {
    this.depositService.message = this.depositService.depositTags.get('DEP_SEND_MSG')!;
    this.alertMessageOpenSend = true;
  }

  saveDeposit(): Promise<any> {
    return this.messageService.showLoading().then(() => {
      this.depositService.deposit.stDeposit = this.DEPOSITO_STATUS_SAVED;
      this.depositService.deposit.stDelivery = this.DEPOSITO_STATUS_SAVED;
      return this.depositService.saveDeposit(this.synchronizationServices.getDatabase(), this.depositService.deposit).then(resp => {
        console.log("DEPOSIT SAVE");
        this.adjuntoService.savePhotos(this.synchronizationServices.getDatabase(), this.depositService.deposit.coDeposit, "depositos");
        this.depositService.applyPersistSucceededBaseline();
        return true;
      });
    });

  }

  sendDeposit() {
    this.messageService.showLoading().then(() => {
      this.depositService.deposit.stDeposit = this.DEPOSITO_STATUS_TO_SEND;
      this.depositService.saveDeposit(this.synchronizationServices.getDatabase(), this.depositService.deposit).then(resp => {
        console.log("DEPOSIT SAVE READY TO SEND");
        this.depositService.applyPersistSucceededBaseline();
        this.messageService.alertModal(
          {
            header: this.depositService.depositTags.get('DENARIO_NOMBRE_APP')!,
            message: this.depositService.depositTags.get('DEP_SEND_MSG')!,
          }
        );
        this.adjuntoService.savePhotos(this.synchronizationServices.getDatabase(), this.depositService.deposit.coDeposit, "depositos");
        this.depositService.sendDeposit.next(this.depositService.deposit.coDeposit);
      });
    });

  }


  setsaveOrExitOpen(isOpen: boolean) {
    this.depositService.saveOrExitOpen = isOpen;
  }
}
