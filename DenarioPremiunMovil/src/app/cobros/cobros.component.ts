import { Component, EventEmitter, OnInit, Output, inject, ViewChild, Input } from '@angular/core';
import { AdjuntoComponent } from 'src/app/adjuntos/adjunto/adjunto.component';
import { ClienteSelectorComponent } from '../cliente-selector/cliente-selector.component';
import { Client } from 'src/app/modelos/tables/client';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { Collection } from 'src/app/modelos/tables/collection';
import { MessageService } from 'src/app/services/messageService/message.service';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { PendingTransaction } from '../modelos/tables/pendingTransactions';
import { AutoSendService } from '../services/autoSend/auto-send.service';
import { ServicesService } from '../services/services.service';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';

@Component({
    selector: 'app-cobros',
    templateUrl: './cobros.component.html',
    styleUrls: ['./cobros.component.scss'],
    standalone: false
})
export class CobrosComponent implements OnInit {

  public messageAlert!: MessageAlert;
  public collectService = inject(CollectionService)
  public message = inject(MessageService)
  public autoSend = inject(AutoSendService);
  public services = inject(ServicesService);
  public synchronizationServices = inject(SynchronizationDBService);


  public segment = 'default';
  public fecha!: Date;
  public collectValid: Boolean = false;

  public subs: any;


  constructor() {

    this.subscribeSendSave();
    this.collectService.cobrosComponent = true

  }

  ngOnInit() {
    this.message.showLoading().then(() => {
      this.collectService.getTags(this.synchronizationServices.getDatabase()).then(resp => {
        if (resp)
          this.message.hideLoading();
      })

    });
    this.collectService.userMustActivateGPS = this.collectService.globalConfig.get("userMustActivateGPS").toLowerCase()=== 'true';
  }

  sendCollection(coCollection: string) {
    let pendingTransaction = {} as PendingTransaction;
    pendingTransaction.coTransaction = coCollection;
    pendingTransaction.idTransaction = 0
    pendingTransaction.type = "collect";

    this.services.insertPendingTransaction(this.synchronizationServices.getDatabase(), pendingTransaction).then(result => {
      if (result) {
        void this.autoSend.runPendingQueue();
        /*  this.clientLogic.clientNewPotentialClientComponent = false;
         this.clientLogic.clienteNuevoBlancoImg = true;
         this.clientLogic.clientContainerComponent = true; */
      }
    })
  }

  subscribeSendSave() {
    this.subs = this.collectService.saveSend.subscribe((data) => {
      //this.sendCollection(this.newPotentialClient, data);
      this.sendCollection(data);
    })
  }

}