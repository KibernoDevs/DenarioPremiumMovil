import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from 'src/app/modelos/tables/client';
import { CurrencyEnterprise } from 'src/app/modelos/tables/currencyEnterprise';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { PotentialClient } from 'src/app/modelos/tables/potentialClient';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { ClientesDatabaseServicesService } from 'src/app/services/clientes/clientes-database-services.service';
import { ClientLocationService } from 'src/app/services/clientes/locationClient/client-location.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

@Component({
  selector: 'app-client-container',
  templateUrl: './client-container.component.html',
  styleUrls: ['./client-container.component.scss'],
  standalone: false
})
export class ClienteContainerComponent implements OnInit {

  public clientLogic = inject(ClientLogicService);
  public router = inject(Router);
  public services = inject(ServicesService);
  public messageService = inject(MessageService);
  public locationClient = inject(ClientLocationService)
  private globalConfig = inject(GlobalConfigService);

  public subs: any;
  public empresaSeleccionada!: Enterprise;
  public clientSearchComponent: Boolean = false;

  constructor() { }

  ngOnInit() {
    this.clientSearchComponent = true;
    this.clientLogic.getCurrency();
    this.clientLogic.getEnterprise();
    this.backRouteService();
  }


  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  backRouteService() {
    this.subs = this.clientLogic.backRoute.subscribe((data: string) => {
      console.log("estoy aca", data)
      if (this.clientLogic.clientContainerComponent) {
        /* this.clientLogic.clientContainerComponent = false; */
        this.router.navigate(['home']);
      } else if (this.clientLogic.clientListComponent) {
        this.clientLogic.clientListComponent = false;
        this.clientLogic.clientContainerComponent = true;
      } else if (this.clientLogic.clientDetailComponent) {
        this.clientLogic.segment = 'default';
        this.clientLogic.clientDetailComponent = false;
        this.clientLogic.clientListComponent = true;
      } else if (this.clientLogic.clientPotentialClientComponent) {
        this.clientLogic.clientPotentialClientComponent = false;
        this.clientLogic.clientContainerComponent = true;
      } else if (this.clientLogic.clientNewPotentialClientComponent) {
        this.clientLogic.savePotentialClient = false;
        this.clientLogic.saveSendPotentialClient = false;
        this.clientLogic.clientNewPotentialClientComponent = false;
        this.clientLogic.clientContainerComponent = true; //home de clientes
        this.clientLogic.clienteNuevoBlancoImg = true;
        //this.clientLogic.clientPotentialClientComponent = true; //listado de clientes potenciales
      } else if (this.clientLogic.clientLocationComponent) {
        this.clientLogic.saveOrExitOpen = false;
        this.clientLogic.clientLocationComponent = false;
        this.clientLogic.clienteNuevoBlancoImg = true;
        this.clientLogic.clientDetailComponent = true;
      } else if (this.clientLogic.clientDocumentSaleComponent) {
        if (this.clientLogic.opendDocClick) {
          //aca tengo que ir directo a la pestaña de documentos, como lo hago???
          this.clientLogic.opendDocClick = false;
          this.clientLogic.clientDocumentSaleComponent = false;
          this.clientLogic.clientDetailComponent = true;
          this.clientLogic.segment = 'docVentas';
        } else {
          this.clientLogic.clientDocumentSaleComponent = false;
          this.clientLogic.clientDetailComponent = true;
        }
      }
    });
  }

  clientList() {
    this.messageService.showLoading().then(async () => {
      await this.clientLogic.refreshCliCurrencyModule();
      this.clientLogic.clientListPage = 0;
      this.clientLogic.getClients(this.clientLogic.listaEmpresa[0].idEnterprise).then(async resp => {
        this.messageService.hideLoading();


        this.clientLogic.clientContainerComponent = false;
        this.clientLogic.clientListComponent = true;
      });
    })

  }


  newPotentialClient() {
    this.clientLogic.potentialClient = {} as PotentialClient;
    this.clientLogic.clientContainerComponent = false;
    this.clientLogic.clienteNuevoBlancoImg = false;
    this.clientLogic.clientNewPotentialClientComponent = true;
  }

  findPotentialClient() {
    this.clientLogic.clientContainerComponent = false;
    this.clientLogic.clienteNuevoBlancoImg = false;
    this.clientLogic.clientPotentialClientComponent = true;
    this.clientLogic.clienteNuevoBlancoImg = true;
  }
}
