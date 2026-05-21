import { Component, Input, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ClientStocks } from 'src/app/modelos/tables/client-stocks';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { MessageService } from 'src/app/services/messageService/message.service';
@Component({
    selector: 'app-inventario-container',
    templateUrl: './inventario-container.component.html',
    styleUrls: ['./inventario-container.component.scss'],
    standalone: false
})
export class InventarioContainerComponent implements OnInit {

  public inventariosLogicService = inject(InventariosLogicService);
  public router = inject(Router);
  public dateServ = inject(DateServiceService);
  private geoLoc = inject(GeolocationService);
  private message = inject(MessageService);

  public subs: any;

  constructor() { }

  ngOnInit() {
    this.inventariosLogicService.userMustActivateGPS = this.inventariosLogicService.globalConfig.get('userMustActivateGPS') === 'true';
        if(this.inventariosLogicService.userMustActivateGPS){
      this.inventariosLogicService.newClientStock.coordenada = "";
      this.geoLoc.getCurrentPosition().then(xy => {
        if(xy.length > 0){
          this.inventariosLogicService.newClientStock.coordenada = xy;
        }
      })

    }
    this.backRouteService();
  }


  ngOnDestroy() {
    this.subs.unsubscribe();
  }


  backRouteService() {
    this.subs = this.inventariosLogicService.backRoute.subscribe((data: string) => {
     if (this.inventariosLogicService.inventarioComp) {
        this.inventariosLogicService.isEdit = false;
        this.inventariosLogicService.inventarioComp = false;
        this.inventariosLogicService.inventarioList = false;
        this.inventariosLogicService.containerComp = true;
        this.inventariosLogicService.showHeaderButtonsFunction(false);
        this.inventariosLogicService.newClientStock = {} as ClientStocks;
        this.router.navigate(['inventarios']);
      } else if (this.inventariosLogicService.inventarioList) {
        this.inventariosLogicService.isEdit = false;
        this.inventariosLogicService.inventarioComp = false;
        this.inventariosLogicService.inventarioList = false;
        this.inventariosLogicService.containerComp = true;
        this.inventariosLogicService.showHeaderButtonsFunction(false);
        this.inventariosLogicService.newClientStock = {} as ClientStocks;
        this.router.navigate(['inventarios']);
      } else if (this.inventariosLogicService.containerComp) {
        this.inventariosLogicService.isEdit = false;
        this.inventariosLogicService.newClientStock = {} as ClientStocks;
        this.router.navigate(['home']);
      }

    });
  }

  newStockButton(){
    if(this.inventariosLogicService.userMustActivateGPS){
      this.message.showLoading().then(() => {
              if(!this.inventariosLogicService.newClientStock.coordenada ||
        this.inventariosLogicService.newClientStock.coordenada.length < 1){
      this.geoLoc.getCurrentPosition().then(xy => {
        if(xy.length > 0){
          this.inventariosLogicService.newClientStock.coordenada = xy;
          this.newClientStock();
        }
      })
    }else{
      this.newClientStock();
    }
      });
    }else{
      this.newClientStock();
    }
  }

  newClientStock() {
    this.inventariosLogicService.hideTab = true;
    this.inventariosLogicService.newClientStock.daClientStock = this.dateServ.hoyISOFullTime();
    this.inventariosLogicService.inventarioComp = true;
    this.inventariosLogicService.containerComp = false;
    this.inventariosLogicService.inventarioList = false;
    this.inventariosLogicService.showHeaderButtonsFunction(true);
    this.inventariosLogicService.initClientStockDetails();
    this.inventariosLogicService.newClientStock.daysSinceLast = 1;
    this.inventariosLogicService.newClientStock.daysUntilNext = 1;
  }

  findClientStock() {
    this.inventariosLogicService.inventarioComp = false;
    this.inventariosLogicService.containerComp = false;

    this.inventariosLogicService.inventarioList = true;

    this.inventariosLogicService.showHeaderButtonsFunction(false);

  }

}
