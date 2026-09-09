import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { ItemListaCobros } from '../item-lista-cobros';

@Component({
  selector: 'app-cobros-container',
  templateUrl: './cobros-container.component.html',
  styleUrls: ['./cobros-container.component.scss'],
  standalone: false
})
export class CobrosContainerComponent implements OnInit {

  public subs: any;
  public collectService = inject(CollectionService);
  public router = inject(Router);
  public services = inject(ServicesService);
  public synchronizationServices = inject(SynchronizationDBService);
  public globalConfig = inject(GlobalConfigService);
  public geoLoc = inject(GeolocationService);
  private messageService = inject(MessageService);

  public collectValid: Boolean = false;
  public coordenada = '';
  private isLoadingCollectList = false;

  constructor() { }

  ngOnInit() {
    if (this.collectService.userMustActivateGPS) {
      this.coordenada = '';
      this.geoLoc.getCurrentPosition().then(xy => {
        if (xy.length > 0) {
          this.coordenada = xy;

        }
      })
    }
    this.collectService.getTags(this.synchronizationServices.getDatabase(),);
    this.collectService.getTagsDenario(this.synchronizationServices.getDatabase(),);
    this.backRoute();

  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }


  backRoute() {
    this.subs = this.collectService.backRoute.subscribe((data: string) => {
      console.log('Back-Container: ' + data);
      if (this.collectService.cobrosComponent) {
        //estoy en el home
        //this.collectService.cobrosComponent = false;
        this.router.navigate(['home']);
      } else if (this.collectService.cobroComponent) {
        //estoy en un cobro
        this.collectService.showHeaderButtonsFunction(false);
        this.collectService.collectionIsSave = true;
        this.collectService.initCollect = true;
        this.collectService.disableSavedButton = true;
        this.collectService.disableSendButton = true;
        this.collectService.showHeaderButtons = false;
        this.collectService.cobroComponent = false;
        this.collectService.cobrosComponent = true;
      } else if (this.collectService.cobroListComponent) {
        this.collectService.showHeaderButtonsFunction(false);
        this.collectService.showHeaderButtons = false;
        this.collectService.cobroListComponent = false;
        this.collectService.cobrosComponent = true;
      } else {
        this.router.navigate(['home']);
      }
    });
  }

  nuevoCobro(type: number) {
    this.messageService.showLoading().then(() => {
      if (this.collectService.userMustActivateGPS) {
        if (!this.coordenada && this.coordenada.length < 1) {
          this.geoLoc.getCurrentPosition().then(xy => {
            if (xy.length > 0) {
              this.coordenada = xy;
              this.goToNuevoCobro(type);
            }
          })
        } else {
          this.goToNuevoCobro(type);
        }
      } else {
        this.goToNuevoCobro(type);
      }
      this.messageService.hideLoading();
    })
  }

  goToNuevoCobro(type: number) {
    this.messageService.showLoading().then(() => {
      this.collectService.beginNewCollectionSession(type);

      if (this.collectService.userMustActivateGPS) {
        this.collectService.collection.coordenada = this.coordenada;
      }

      this.collectService.showHeaderButtonsFunction(true);
      this.collectService.cobrosComponent = false;
      this.collectService.cobroComponent = true;
    });
  }

  buscarCobro() {
    if (this.isLoadingCollectList) {
      return;
    }
    console.log("buscar cobro");

    this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO')!;
    this.isLoadingCollectList = true;
    this.messageService.showLoading().then(() => {
      this.collectService.findCollect(this.synchronizationServices.getDatabase()).then(resp => {
        this.messageService.hideLoading();
        this.collectService.cobrosComponent = false;
        this.collectService.cobroListComponent = true;
      }).finally(() => {
        this.isLoadingCollectList = false;
      });
    });
  }
}
