import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ClienteSelectorComponent } from 'src/app/cliente-selector/cliente-selector.component';
import { Client } from 'src/app/modelos/tables/client';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { ReturnLogicService } from 'src/app/services/returns/return-logic.service';
import { DELIVERY_STATUS_SENT, DELIVERY_STATUS_TO_SEND } from 'src/app/utils/appConstants';


@Component({
    selector: 'app-devolucion',
    templateUrl: './devolucion.component.html',
    styleUrls: ['./devolucion.component.scss'],
    standalone: false
})
export class DevolucionComponent implements OnInit, OnDestroy {


  enterpriseServ = inject(EnterpriseService);
  returnLogic = inject(ReturnLogicService);
  geoServ = inject(GeolocationService);
  private cdr = inject(ChangeDetectorRef);

  @Input()
  devolucionTags = new Map<string, string>([]);
  @ViewChild(ClienteSelectorComponent)
  selectorCliente!: ClienteSelectorComponent;

  listaEmpresa: Enterprise[] = [];
  empresaSeleccionada!: Enterprise;
  cliente!: Client;
  segment: string = 'default';
  nombreCliente: string = "";
  returnValid: Boolean = false;
  botonAgregar: Boolean = true;
  devolucion: Boolean = true;
  pedido: Boolean = false;
  private focusTabSub?: Subscription;
  private returnValidSub?: Subscription;


  constructor() { }

  ngOnInit() {
    this.botonAgregar = !this.returnLogic.returnSent;
    if(this.returnLogic.newReturn.stDelivery == undefined){
      //fix temporal para que las devoluciones viejas no fallen
      this.returnLogic.newReturn.stDelivery = this.returnLogic.newReturn.stReturn;
    }      

    if(!this.returnLogic.userMustActivateGPS && (this.returnLogic.newReturn.stDelivery !== DELIVERY_STATUS_TO_SEND &&
       this.returnLogic.newReturn.stDelivery !== DELIVERY_STATUS_SENT &&
      this.returnLogic.newReturn.stDelivery !== 6)){ 
    this.geoServ.getCurrentPosition().then(coords => { this.returnLogic.newReturn.coordenada = coords });
    }
    this.returnValidSub = this.returnLogic.returnValid.subscribe((data: Boolean) => {
      this.returnValid = data;
    });

    this.focusTabSub = this.returnLogic.focusSendValidationTab.subscribe((tab) => {
      this.applySendValidationTabFocus(tab);
    });
  }

  ngOnDestroy() {
    this.focusTabSub?.unsubscribe();
    this.returnValidSub?.unsubscribe();
  }

  /** Salta a la pestaña del primer error tras fallo de Enviar (DEV-SEND-001). */
  private applySendValidationTabFocus(
    tab: 'default' | 'productos' | 'adjuntos',
  ): void {
    const generalOk = !!this.returnValid || this.returnLogic.generalTabValidForSave;

    if ((tab === 'productos' || tab === 'adjuntos') && !generalOk) {
      tab = 'default';
    }

    if (generalOk && !this.returnValid) {
      this.returnValid = true;
    }

    this.segment = tab;
    this.cdr.detectChanges();
  }

  shouldShowSendErrorHintOnTab(
    tab: 'default' | 'productos' | 'adjuntos',
  ): boolean {
    if (!this.returnLogic.sendValidationAttempted) {
      return false;
    }
    const focus = this.returnLogic.resolveSendValidationFocusTab();
    return focus != null && focus === tab;
  }

  onChangeTab(tab: string) {
    this.segment = tab;
  }

}
