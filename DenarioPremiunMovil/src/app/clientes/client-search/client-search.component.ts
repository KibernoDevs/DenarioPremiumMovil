import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';

@Component({
    selector: 'app-client-search',
    templateUrl: './client-search.component.html',
    styleUrls: ['./client-search.component.scss'],
    standalone: false
})
export class ClientSearchComponent implements OnInit {
  @Output()
  searchTextEmit: EventEmitter<string> = new EventEmitter<string>();

  clientLogic = inject(ClientLogicService);
  searchPlaceholder = '';

  ngOnInit() {
    this.searchPlaceholder = this.clientLogic.clientTags.get('CLI_PLACEHOLDER') ?? 'Clientes...';
  }

  handleInput(searchText: any) {
    this.searchTextEmit.emit(searchText.target.value.toLowerCase());
  }
}
