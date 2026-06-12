import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { Return } from 'src/app/modelos/tables/return';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { ReturnLogicService } from 'src/app/services/returns/return-logic.service';

@Component({
    selector: 'devoluciones-container',
    templateUrl: './devoluciones-container.component.html',
    styleUrls: ['./devoluciones-container.component.scss'],
    standalone: false
})
export class DevolucionesContainerComponent implements OnInit, OnDestroy {

  returnLogic = inject(ReturnLogicService);
  router = inject(Router);
  public dateServ = inject(DateServiceService);
  public geoLoc =  inject(GeolocationService);



  devolucionComp: Boolean = false;
  devolucionList: Boolean = false;
  containerComp: Boolean = true;
  devolucionSearchComp: Boolean = false;
  selectedReturn: Boolean = false;
  sub1: any;
  sub2: any;

  @Input()
  containerTags = new Map<string, string>([]);

  constructor() { }


  ngOnInit() {
    this.sub1 = this.returnLogic.backRoute.subscribe((data: string) => {
      if (this.devolucionComp || this.devolucionList) {
        this.devolucionComp = false;
        this.devolucionList = false;
        this.containerComp = true;
        this.returnLogic.showHeaderButtons(false);
        this.router.navigate(['devoluciones']);
      } else {
        this.router.navigate(['home']);
      }
      this.returnLogic.newReturn = {} as Return;
      this.returnLogic.productList = [];
    });

    this.sub2 = this.returnLogic.returnSelected.subscribe((data: Boolean) => {
      this.devolucionComp = true;
      this.selectedReturn = true;
      this.containerComp = false;
      this.devolucionList = false;
      this.returnLogic.showHeaderButtons(!this.returnLogic.returnSent);
    });
    this.returnLogic.newReturn.coordenada = "";
      if (this.returnLogic.userMustActivateGPS) {
      this.geoLoc.getCurrentPosition().then(xy => {
        if (xy.length > 0) {
          this.returnLogic.newReturn.coordenada = xy;
        }
      })
    } 
    
  }

  ngOnDestroy(): void {
    this.sub1.unsubscribe();
    this.sub2.unsubscribe();
  }

  newReturnButton(){
    if(this.returnLogic.userMustActivateGPS){
      if(this.returnLogic.newReturn.coordenada && this.returnLogic.newReturn.coordenada.length > 0){
        this.newReturn();
      } else {
      this.geoLoc.getCurrentPosition().then(xy => {
        if(xy.length > 0){
          this.returnLogic.newReturn.coordenada = xy;
          this.newReturn();
        }
      })
    }
    }else{
      this.newReturn();
    }
  }


  newReturn() {
    this.returnLogic.newReturn.daReturn = this.dateServ.hoyISOFullTime();
    console.log('daReturn: ' + this.returnLogic.newReturn.daReturn);
    this.devolucionComp = true;
    this.containerComp = false;
    this.returnLogic.returnSent = false;
    this.returnLogic.showHeaderButtons(true);
    
  }

  findReturn() {
    this.devolucionList = true;
    this.devolucionComp = false;
    this.containerComp = false;
    this.returnLogic.showHeaderButtons(false);
    //this.adjuntoServ.setup(this.config.get('signatureReturn') == 'true', this.returnLogic.returnSent.valueOf());
  }


}
