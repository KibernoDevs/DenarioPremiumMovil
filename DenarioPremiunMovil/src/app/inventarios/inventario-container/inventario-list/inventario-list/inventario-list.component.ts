import { Component, OnInit, inject } from '@angular/core';
import { InfiniteScrollCustomEvent } from '@ionic/angular';
import { ClientStocks } from 'src/app/modelos/tables/client-stocks';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { DELIVERY_STATUS_SAVED, DELIVERY_STATUS_SENT, DELIVERY_STATUS_TO_SEND, VISIT_STATUS_TO_SEND, VISIT_STATUS_VISITED } from 'src/app/utils/appConstants'
import { ItemListaInventarios } from 'src/app/inventarios/item-lista-inventarios';
import { LOCAL_LIST_PAGE_SIZE, paginateFilteredList } from 'src/app/utils/local-paginated-list.util';

@Component({
  selector: 'app-inventario-list',
  templateUrl: './inventario-list.component.html',
  styleUrls: ['./inventario-list.component.scss'],
  standalone: false
})
export class InventarioListComponent implements OnInit {

  public inventariosLogicService = inject(InventariosLogicService)
  public message = inject(MessageService);
  private geoLoc = inject(GeolocationService);
  public synchronizationServices = inject(SynchronizationDBService);
  public listClientStock: ClientStocks[] = []
  public valid: Boolean = false;
  public delete: Boolean = false;
  public searchText: string = '';
  public displayedItems: ItemListaInventarios[] = [];
  public scrollDisable = false;
  public messageAlert!: MessageAlert;

  private readonly pageSize = LOCAL_LIST_PAGE_SIZE;
  private filteredItems: ItemListaInventarios[] = [];
  private currentPage = 0;

  public DELIVERY_STATUS_SAVED = DELIVERY_STATUS_SAVED; // para usar en el html

  constructor() { }

  ngOnInit() {
    this.message.showLoading().then(() => {
      this.inventariosLogicService.getAllClientStock(this.synchronizationServices.getDatabase(),).then(list => {
        this.listClientStock = list;
        this.resetListPagination();
        this.message.hideLoading();
        if (this.listClientStock.length == 0)
          this.valid = true;
      });
    })
    if (this.inventariosLogicService.userMustActivateGPS) {
      this.inventariosLogicService.newClientStock.coordenada = "";
      this.geoLoc.getCurrentPosition().then(xy => {
        if (xy.length > 0) {
          this.inventariosLogicService.newClientStock.coordenada = xy;
        }
      })

    }

  }

  private matchesSearch(item: ItemListaInventarios): boolean {
    if (!this.searchText) {
      return true;
    }
    const coClient = (item.coClient ?? '').toLowerCase();
    const lbClient = (item.lbClient ?? '').toLowerCase();
    const idRef = item.idClientStock != null ? item.idClientStock.toString() : '';
    return coClient.includes(this.searchText)
      || lbClient.includes(this.searchText)
      || idRef.includes(this.searchText);
  }

  private buildFilteredItems(): ItemListaInventarios[] {
    return this.inventariosLogicService.itemListClientStocks.filter(item => this.matchesSearch(item));
  }

  private resetListPagination(): void {
    this.filteredItems = this.buildFilteredItems();
    this.currentPage = 0;
    this.refreshDisplayedItems();
  }

  private refreshDisplayedItems(): void {
    const page = paginateFilteredList(this.filteredItems, this.currentPage, this.pageSize);
    this.displayedItems = page.items;
    this.scrollDisable = page.scrollDisable;
  }

  getOriginalIndex(item: ItemListaInventarios): number {
    return this.inventariosLogicService.itemListClientStocks.findIndex(
      stock => stock.coClientStock === item.coClientStock
    );
  }

  deleteClientStock(index: number) {
    this.delete = true;
    console.log("BORRAR EL ELEMENTO " + index + " de la lista")

    //DEBERIA PREGUNTAR SI DESEA BORRAR EL INVENTARIO

    this.message.showLoading().then(() => {
      this.inventariosLogicService.deleteClientStock(this.synchronizationServices.getDatabase(), this.listClientStock[index].coClientStock).then(response => {
        this.delete = false;
        // this.listClientStock.splice(index, 1);

        if (this.listClientStock.length == 0)
          this.valid = true;

        this.message.hideLoading();
        if (response) {
          this.listClientStock.splice(index, 1);
          this.inventariosLogicService.itemListClientStocks.splice(index, 1);
          this.resetListPagination();
          this.messageAlert = new MessageAlert(
            "Denario Inventarios",
            "¡EL Inventario se borro con exito!"
          );
          this.message.alertModal(this.messageAlert);
        } else {
          this.messageAlert = new MessageAlert(
            "Denario Inventarios",
            "¡EL Inventario no pudo ser borrado con exito!"
          );
          this.message.alertModal(this.messageAlert);
        }
      })
    })


  }

  beforeOpenStock(index: number) {
    //el pedido no es enviado?: saved = true;
    var saved = (this.listClientStock[index].stDelivery == 3);
    if (this.inventariosLogicService.userMustActivateGPS && saved) {
      if (!this.inventariosLogicService.newClientStock.coordenada ||
        this.inventariosLogicService.newClientStock.coordenada !== "") {
        this.geoLoc.getCurrentPosition().then(xy => {
          if (xy.length > 0) {
            this.inventariosLogicService.newClientStock.coordenada = xy;
            this.openClientStock(index);
          }
        })
      } else {
        this.openClientStock(index);
      }
    } else {
      this.openClientStock(index);
    }
  }
  openClientStock(index: number) {
    if (!this.delete) {
      this.inventariosLogicService.initClientStockDetails();

      console.log("abrir EL ELEMENTO " + index + " de la lista")
      this.inventariosLogicService.newClientStock = this.listClientStock[index];
      this.inventariosLogicService.inventarioComp = true;
      this.inventariosLogicService.containerComp = false;
      this.inventariosLogicService.inventarioList = false;
      if (this.inventariosLogicService.newClientStock.stDelivery == 1 || this.inventariosLogicService.newClientStock.stDelivery == null) {
        this.inventariosLogicService.showHeaderButtonsFunction(false);
        this.inventariosLogicService.hideTab = false;
        this.inventariosLogicService.inventarioSent = true;
      } else {
        this.inventariosLogicService.hideTab = true;
        this.inventariosLogicService.showHeaderButtonsFunction(true);
      }
    }
  }

  onIonInfinite(ev: InfiniteScrollCustomEvent) {
    if (this.scrollDisable) {
      ev.target.complete();
      return;
    }
    this.currentPage++;
    this.refreshDisplayedItems();
    ev.target.complete();
  }

  handleInput(event: any) {
    this.searchText = (event?.detail?.value ?? event?.target?.value ?? '').toString().toLowerCase().trim();
    this.resetListPagination();
  }

  getStatusOrderName(status: number, naStatus: any, idClientStock: number) {
    if (typeof naStatus === 'object') {
      return naStatus.na_status;
    } else
      if (idClientStock == null || idClientStock == 0) {
        switch (status) {
          case 3: return this.inventariosLogicService.inventarioTagsDenario.get("DENARIO_DEV_SAVED")! == undefined ? "Guardado" : this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_DEV_SAVED')!;
          case DELIVERY_STATUS_TO_SEND: return this.inventariosLogicService.inventarioTagsDenario.get("DENARIO_DEV_TO_BE_SENDED")! == undefined ? "Por enviar" : this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_DEV_TO_BE_SENDED')!;
          case 1: return this.inventariosLogicService.inventarioTagsDenario.get("DENARIO_DEV_SENDED")! == undefined ? "Enviado" : this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_DEV_SENDED')!;
          case 6:
            // naStatus puede ser string o un objeto => normalizar a string
            if (naStatus == null) return 'Enviado';
            if (typeof naStatus === 'string') {
              return naStatus;
            }
            if (typeof naStatus === 'object') {
              // intenta varias propiedades comunes
              return naStatus.na_status;
            }
            return String(naStatus);

          default: return '';
        }
      }
      else {
        return this.inventariosLogicService.inventarioTagsDenario.get("DENARIO_DEV_SENDED")! == undefined ? "Enviado" : this.inventariosLogicService.inventarioTagsDenario.get('DENARIO_DEV_SENDED')!;
      }
  }

}
