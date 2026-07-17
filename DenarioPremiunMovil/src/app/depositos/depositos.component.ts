import { Component, inject, OnInit } from '@angular/core';
import { DepositService } from '../services/deposit/deposit.service';
import { PendingTransaction } from '../modelos/tables/pendingTransactions';
import { AutoSendService } from '../services/autoSend/auto-send.service';
import { ServicesService } from '../services/services.service';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { Deposit } from '../modelos/tables/deposit';
import { MessageService } from '../services/messageService/message.service';

@Component({
  selector: 'app-depositos',
  templateUrl: './depositos.component.html',
  styleUrls: ['./depositos.component.scss'],
  standalone: false
})
export class DepositosComponent implements OnInit {

  public depositService = inject(DepositService);
  public autoSend = inject(AutoSendService);
  public services = inject(ServicesService);
  public synchronizationServices = inject(SynchronizationDBService);
  public messageService = inject(MessageService);

  public subs: any;

  constructor() {
    this.depositService.depositComponent = true;
  }

  ngOnInit() {
    this.depositService.userMustActivateGPS = this.depositService.globalConfig.get("userMustActivateGPS").toLowerCase() === 'true';
    this.depositService.getTags(this.synchronizationServices.getDatabase());
    this.depositService.getTagsDenario(this.synchronizationServices.getDatabase());
    this.subscribeSendSave();
  }

  subscribeSendSave() {
    this.subs = this.depositService.sendDeposit.subscribe((data) => {
      //this.sendCollection(this.newPotentialClient, data);
      this.sendDeposit(data);
    })
  }

  sendDeposit(coDeposit: string) {
    let pendingTransaction = {} as PendingTransaction;
    pendingTransaction.coTransaction = coDeposit;
    pendingTransaction.idTransaction = 0
    pendingTransaction.type = "deposit";

    this.services.insertPendingTransaction(this.synchronizationServices.getDatabase(), pendingTransaction).then(result => {
      if (result) {
        void this.autoSend.runPendingQueue();
        this.depositService.showHeaderButtons = false;
        this.depositService.depositListComponent = false;
        this.depositService.depositNewComponent = false;
        this.depositService.depositComponent = true;
        this.depositService.depositValid = false;
        this.depositService.deposit = {} as Deposit;
      }
      this.messageService.hideLoading();
    })
  }

}
