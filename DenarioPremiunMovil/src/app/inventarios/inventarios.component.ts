import { Component, Input, OnInit, inject } from '@angular/core';
import { MessageService } from '../services/messageService/message.service';
import { ServicesService } from '../services/services.service';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { InventariosLogicService } from '../services/inventarios/inventarios-logic.service';

@Component({
    selector: 'app-inventarios',
    templateUrl: './inventarios.component.html',
    styleUrls: ['./inventarios.component.scss'],
    standalone: false
})
export class InventariosComponent implements OnInit {

  public message = inject(MessageService);
  public services = inject(ServicesService);
  public db = inject(SynchronizationDBService);
  public inventariosLogicService = inject(InventariosLogicService)

  public tags = new Map<string, string>([]);


  constructor() { }

  ngOnInit() {
    this.inventariosLogicService.loadSuggestedOrderConfig();
    this.message.showLoading().then(() => {
      this.inventariosLogicService.getTags(this.db.getDatabase()).then(resp => {
        if (resp)
          this.message.hideLoading();
      })
      this.inventariosLogicService.getTagsDenario(this.db.getDatabase()).then(resp => {
        if (resp)
          this.message.hideLoading();
      })

    });
  }
}
