import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { InfiniteScrollCustomEvent, NavController } from '@ionic/angular';
import { ClienteSelectorService } from 'src/app/cliente-selector/cliente-selector.service';
import { SelectedClient } from 'src/app/modelos/selectedClient';

import { Client } from 'src/app/modelos/tables/client';
import { CurrencyEnterprise } from 'src/app/modelos/tables/currencyEnterprise';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { ClientesDatabaseServicesService } from 'src/app/services/clientes/clientes-database-services.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

@Component({
  selector: 'app-client-list',
  templateUrl: './client-list.component.html',
  styleUrls: ['./client-list.component.scss'],
  standalone: false
})
export class ClientListComponent implements OnInit {

  private currencyService = inject(CurrencyService);
  public enterpriseServ = inject(EnterpriseService)
  public clientLogic = inject(ClientLogicService);
  private service = inject(ClienteSelectorService);

  private messageService = inject(MessageService);

  public listaEmpresa: Enterprise[] = [];
  public prueba!: string[];
  public clients!: any[];
  public client!: Client;
  public tags = new Map<string, string>([]);
  public results!: any;
  public cliente!: Client;
  public nombreCliente: string = "";

  public indice!: number;
  public clientDetailComponent: Boolean = false;
  public precision = this.currencyService.precision;
  scrollDisable = false;
  private isSearching = false;
  public transportista = false;

  public dateToday: Date = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  })();



  @Input()
  searchText: string = "";

  constructor(
    private router: Router,
  ) {
    this.searchText = '';
  }

  ngOnInit() {
    this.clientLogic.setNombreModulo('CLI_NOMBRE_MODULO', 'Clientes');

    this.clientLogic.clientListComponent = true;
    this.clientLogic.clienteNuevoBlancoImg = true;
    this.searchText = "";
    this.indice = 1;
    this.clientDetailComponent = false;
    this.onChangeEnterprise();
    this.clientLogic.fromSelector = false; //indicamos que no venimos del selector de cliente, sino del listado de clientes
    this.scrollDisable = false;
    this.checkUserStatus();
  }

  onIonInfinite(ev: InfiniteScrollCustomEvent) {
    this.clientLogic.clientListPage++;
    if (this.clientLogic.clientListSearchMode) {
      this.clientLogic.searchClients(this.clientLogic.empresaSeleccionada.idEnterprise, this.searchText).then(result => {
        this.onIonInfiniteFinish(ev, result);
      });
    } else {
      this.clientLogic.getClients(this.clientLogic.empresaSeleccionada.idEnterprise).then(result => {
        this.onIonInfiniteFinish(ev, result);
      });
    }
  }

  onIonInfiniteFinish(ev: InfiniteScrollCustomEvent, result: boolean) {
    this.scrollDisable = result;
    (ev as InfiniteScrollCustomEvent).target.complete();
    this.clientLogic.message.hideLoading();
  }
  handleInput(event: any) {
    this.searchText = event.target.value.toLowerCase();
  }
  oppositeCoCurrency(coCurrency: string) {
    return this.currencyService.oppositeCoCurrency(coCurrency);
  }

  formatNumber(num: number) {
    return this.currencyService.formatNumber(num);
  }

  onSearchEnter(event: Event) {
    event?.preventDefault();
    event.stopPropagation();
    void this.runSearch(event.target as HTMLInputElement | null);
  }

  onSearchClicked(event?: Event) {
    event?.preventDefault();
    void this.runSearch(event?.target as HTMLInputElement | null);
  }

  private async runSearch(inputElement?: HTMLInputElement | null) {
    if (this.isSearching) {
      return;
    }

    this.isSearching = true;

    if (inputElement) {
      this.searchText = inputElement.value;
      inputElement.blur();
    }

    this.searchText = (this.searchText || '').trim();
    this.clientLogic.clientListPage = 0;

    await this.messageService.showLoading();

    try {
      if (this.searchText === '') {
        this.scrollDisable = await this.clientLogic.getClients(this.clientLogic.empresaSeleccionada.idEnterprise);
      } else {
        this.scrollDisable = await this.clientLogic.searchClients(this.clientLogic.empresaSeleccionada.idEnterprise, this.searchText);
      }
    } catch (error) {
      console.error('Error searching clients', error);
      this.scrollDisable = true;
    } finally {
      this.isSearching = false;
      this.messageService.hideLoading();
    }
  }

  checkUserStatus(){
    this.clientLogic.checkUserStatus()
    this.transportista = this.clientLogic.esTransportista;
  }
  onChangeEnterprise() {
    this.service.clientes = [] as Client[];
    this.clientLogic.clientListPage = 0;
    this.clientLogic.getClients(this.clientLogic.empresaSeleccionada.idEnterprise).then(result => {
      /*
            if (this.currencyService.multimoneda) {
              let saldoCliente = 0, saldoOpuesto = 0;
              for (let c = 0; c < this.clientLogic.clients.length; c++) {
                if (this.clientLogic.clients[c].coCurrency == this.clientLogic.localCurrency.coCurrency) {
                  saldoCliente = this.clientLogic.clients[c].saldo1 + this.currencyService.toLocalCurrency(this.clientLogic.clients[c].saldo2);
                  saldoOpuesto = this.currencyService.toHardCurrency(saldoCliente);
                } else {
                  saldoCliente = this.clientLogic.clients[c].saldo1 + this.currencyService.toHardCurrency(this.clientLogic.clients[c].saldo2);
                  saldoOpuesto = this.currencyService.toLocalCurrency(saldoCliente);
                }
                this.clientLogic.clients[c].saldo1 = saldoCliente;
                this.clientLogic.clients[c].saldo2 = saldoOpuesto;
                saldoCliente = saldoOpuesto = 0;
              }
            }
              */
      this.service.clientes = this.clientLogic.clients;
    })
  }
}
