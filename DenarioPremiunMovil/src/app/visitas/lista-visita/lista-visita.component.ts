import { Component, OnInit, inject } from '@angular/core';
import { MessageService } from 'src/app/services/messageService/message.service';
import { MessageComponent } from 'src/app/message/message.component';
import { VisitasService } from '../visitas.service';
import { Router } from '@angular/router';
import { Visit } from 'src/app/modelos/tables/visit';
import { VISIT_STATUS_NOT_VISITED, VISIT_STATUS_SAVED, VISIT_STATUS_TO_SEND, VISIT_STATUS_VISITED } from 'src/app/utils/appConstants';
import { ReadVarExpr } from '@angular/compiler';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { Platform, ViewWillEnter } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { formatClientForList } from 'src/app/utils/client-display.util';


@Component({
  selector: 'app-lista-visita',
  templateUrl: './lista-visita.component.html',
  styleUrls: ['./lista-visita.component.scss'],
  standalone: false
})
export class ListaVisitaComponent implements OnInit, ViewWillEnter {
  listaVisitas: Visit[] = []
  searchText = "";

  alertDelete: boolean = false;
  selectedVisit: string = "";

  mensajeDelete = ""
  headerDelete = "";
// Make constant accessible in template for use in *ngIf or similar directives 
   VISIT_STATUS_SAVED = VISIT_STATUS_SAVED; 
  public rolTransportista: boolean = false;

  public service = inject(VisitasService);
  private router = inject(Router);
  private message = inject(MessageService);
  private geoLoc = inject(GeolocationService);
  private dateService = inject(DateServiceService);
  

  backButtonSubscription: Subscription = this.platform.backButton.subscribeWithPriority(10, () => {
    //console.log('backButton was called!');
    this.router.navigate(['visitas']);
  });

  constructor(
   
    private platform: Platform,
  ) {
    
  }

  ngOnInit() {
    this.headerDelete = this.getTag('VIS_HEADER_MENSAJE');
    this.mensajeDelete = this.getTag('VIS_BORRAR_CONFIRMA');
    this.service.coordenadas = "";
    this.rolTransportista = this.service.rolTransportista;
    if (this.service.userMustActivateGPS) {
      this.geoLoc.getCurrentPosition().then(xy => {
        if (xy.length > 0) {
          this.service.coordenadas = xy;
        }
      });
    }
  }

  ionViewWillEnter(): void {
    this.refreshList();
  }

  ngOnDestroy() {
    this.backButtonSubscription.unsubscribe();
  }
  refreshList() {
    this.service.getVisitList(this.dateService.onlyDateHoyISO() + "%").then(list => {
      this.listaVisitas = list;
      console.log(this.listaVisitas);
      /*
      for (let index = 0; index < this.listaVisitas.length; index++) {
        const visit =
          this.listaVisitas[index];
        if (this.dateService.compareDates(this.dateService.hoyISO(), visit.daVisit)) {
          //si  la fecha de visita es ayer o antes, se elimina de la lista
          console.log("eliminada: " + visit.idVisit);
          this.listaVisitas.splice(index, 1);
          index--;
        }
      }*/
    })
  }

  handleInput(event: any) {
    this.searchText = event.target.value.toLowerCase();
  }

  statusColor(stVisit: number) {
    if (stVisit == VISIT_STATUS_NOT_VISITED) {
      return '#FF0000'
    } else {
      return '#000000'
    }
  }

  selectVisit(visit: Visit) {
    this.message.showLoading().then(() => {
  if (this.service.userMustActivateGPS &&
     visit.stVisit === VISIT_STATUS_NOT_VISITED) {     
        if (this.service.coordenadas.length > 0) {
          this.goToVisita(visit);
        }else{
          this.geoLoc.getCurrentPosition().then(coords => { 
            this.service.coordenadas = coords;
            if(this.service.coordenadas.length >0){
            this.goToVisita(visit);
            }else{
              this.message.hideLoading();
            }
          });
        }    
    } else {
      this.goToVisita(visit);
    }
  });
}

  goToVisita(visit: Visit) {
    this.service.getIncidencesByVisit(visit.coVisit).then(inc => {
      //busco incidencias en bd, porque la lista no las tiene.
      this.message.hideLoading();
      visit.visitDetails = inc;
      this.service.visit = visit;
      this.service.editVisit = true;
      this.router.navigate(['visita']);
    });
  }


  getTag(tagName: string) {
    return this.service.getTag(tagName);
  }

  formatVisitClient(visit: Visit): string {
    return formatClientForList(visit.coClient, visit.naClient);
  }

  matchesVisitSearch(visit: Visit): boolean {
    if (this.searchText === '') {
      return true;
    }
    const search = this.searchText;
    return visit.coVisit.toLowerCase().includes(search)
      || (visit.coClient ?? '').toLowerCase().includes(search)
      || (visit.naClient ?? '').toLowerCase().includes(search);
  }

  getStatusVisitName(stVisit: number, isReassigned: boolean) {

    switch (stVisit) {
      case VISIT_STATUS_NOT_VISITED:
        if (isReassigned) {
          return "Reagendado";
        }else{
          return "No Visitado";
        }

      case VISIT_STATUS_TO_SEND:
        return "Por Enviar";
        

      case VISIT_STATUS_VISITED:
        return "Visitado";
        

      case VISIT_STATUS_SAVED:
        return "Guardado";
        

      default:
        return "";
        
    }
  }

  deleteVisit() {
    this.service.deleteVisit(this.selectedVisit).then(() => {
      this.message.transaccionMsjModalNB(this.getTag('VIS_BORRAR_EXITO'));
      this.refreshList();
    });
  }

  showAlertDelete(visit: Visit) {
    this.selectedVisit = visit.coVisit;
    this.setAlertDelete(true);
  }

  public buttonsDelete = [
    {
      text: this.getTag('DENARIO_BOTON_CANCELAR').toUpperCase(),
      role: 'cancel',
      handler: () => {
        //console.log('Alert canceled');
      },
    },
    {
      text: this.getTag('DENARIO_BOTON_ACEPTAR'),
      role: 'confirm',
      handler: () => {
        this.deleteVisit();
      },
    }
  ];

  setAlertDelete(value: boolean) {
    this.alertDelete = value;
  }


}
