import { Component, OnInit, inject } from '@angular/core';
import { ClientLogicService } from '../services/clientes/client-logic.service';
import { MessageService } from '../services/messageService/message.service';


@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.scss'],
  standalone: false
})

export class ClientesComponent implements OnInit {
  public clientLogic = inject(ClientLogicService);
  private messageService = inject(MessageService);

  constructor() { }

  ngOnInit() {
    this.messageService.showLoading().then(() => {
      // setup + initService (CLI) para no quedar con flags de currency_modules pre-sync
      this.clientLogic.refreshCliCurrencyModule().then(() => {
        this.clientLogic.getTags().then(() => this.clientLogic.getTagsDenario()).then(resp => {
          if (resp) {
            this.messageService.hideLoading();
          }
        });
      });
    });
  }
}
