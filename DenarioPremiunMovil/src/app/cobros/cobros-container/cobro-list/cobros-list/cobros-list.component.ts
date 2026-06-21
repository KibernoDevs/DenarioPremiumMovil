import { Component, OnInit, inject } from '@angular/core';
import { InfiniteScrollCustomEvent } from '@ionic/angular';
import { ItemListaCobros } from 'src/app/cobros/item-lista-cobros';
import { Collection } from 'src/app/modelos/tables/collection';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { COLLECT_STATUS_SAVED, COLLECT_STATUS_SENT, COLLECT_STATUS_TO_SEND, COLLECT_STATUS_NEW } from 'src/app/utils/appConstants';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';

@Component({
  selector: 'app-cobros-list',
  templateUrl: './cobros-list.component.html',
  styleUrls: ['./cobros-list.component.scss'],
  standalone: false
})
export class CobrosListComponent implements OnInit {
  // Servicios
  public enterpriseServ = inject(EnterpriseService);
  public collectService = inject(CollectionService);
  public geoLoc = inject(GeolocationService);
  private messageService = inject(MessageService);
  public synchronizationServices = inject(SynchronizationDBService);

  coordenada = '';

  public valid: Boolean = false;
  public alertDelete: boolean = false;
  public allItems: any[] = [];         // llena al cargar
  // lo que iteras en la plantilla
  public searchText = '';

  public indice = 0;
  public headerDelete = "";
  public mensajeDelete = "";
  public selectedCollect!: Collection;
  public selectedCollectIndex: number = 0;

  // --- Infinite scroll / paginación client-side ---
  private readonly PAGE_SIZE = 20;
  //public displayedItems: ItemListaCobros[] = []; // lo que se muestra en la UI
  private displayedIndexMap: Map<string, number> = new Map(); // map co_collection -> indice real en itemListaCobros
  private currentOffset = 0; // cuántos items ya mostramos
  public hasMore = true;

  public COLLECT_STATUS_SAVED = COLLECT_STATUS_SAVED;
  public COLLECT_STATUS_SENT = COLLECT_STATUS_SENT;
  public COLLECT_STATUS_TO_SEND = COLLECT_STATUS_TO_SEND;
  public COLLECT_STATUS_NEW = COLLECT_STATUS_NEW;


  public buttonsDelete = [
    {
      text: this.collectService.collectionTags.get('MSG_BOTON_CANCELAR_DEV') ? this.collectService.collectionTags.get('MSG_BOTON_CANCELAR_DEV') : "Cancelar",
      role: 'cancel',
      handler: () => { },
    },
    {
      text: this.collectService.collectionTags.get('MSG_BOTON_DELETE_DEV') ? this.collectService.collectionTags.get('MSG_BOTON_DELETE_DEV') : "Eliminar",
      role: 'confirm',
      handler: () => {
        this.deleteCollect(0);
      },
    }
  ];

  constructor() {
    // inicializa after load
    this.allItems = this.collectService.itemListaCobros;        // lo que obtengas originalmente
    this.collectService.displayedItems = [...this.allItems];
  }

  ngOnInit() {
    if (this.collectService.userMustActivateGPS) {
      this.coordenada = '';
      this.geoLoc.getCurrentPosition().then(xy => {
        if (xy.length > 0) {
          this.coordenada = xy;
        }
      })
    }
    this.collectService.newCollect = false;
    this.headerDelete = this.collectService.collectionTags.get('COB_HEADER_MESSAGE')!;
    this.mensajeDelete = this.collectService.collectionTags.get('COB_CONFIRM_DELETE')!;
    this.collectService.initLogicService();

    // Cargar la primera página (si ya hay datos en el service lo toma, sino intenta forzar la carga)
    this.tryLoadInitialItems();
  }

  private tryLoadInitialItems() {
    const total = this.collectService.itemListaCobros?.length ?? 0;
    if (total > 0) {
      this.rebuildDisplayedItems(Math.min(this.PAGE_SIZE, total));
    } else {
      // Si no hay items, intenta cargar la lista (buscarCobro en container suele hacerlo, pero por seguridad aquí intentamos)
      this.collectService.findCollect(this.synchronizationServices.getDatabase()).then(() => {
        const newTotal = this.collectService.itemListaCobros?.length ?? 0;
        this.rebuildDisplayedItems(Math.min(this.PAGE_SIZE, newTotal));
      }).catch(err => {
        console.warn('CobrosList: fallo al cargar lista inicial', err);
        this.rebuildDisplayedItems(0);
      });
    }
  }

  private rebuildDisplayedItems(count: number) {
    const total = this.collectService.itemListaCobros?.length ?? 0;
    this.collectService.displayedItems = this.collectService.itemListaCobros.slice(0, count);
    this.displayedIndexMap.clear();
    for (let i = 0; i < this.collectService.displayedItems.length; i++) {
      const it = this.collectService.displayedItems[i];
      // usamos co_collection como clave (único por colección)
      this.displayedIndexMap.set(it.co_collection, this.collectService.itemListaCobros.findIndex(x => x.co_collection === it.co_collection));
    }
    this.currentOffset = this.collectService.displayedItems.length;
    this.hasMore = this.currentOffset < total;
  }

  private loadNextPage(): Promise<void> {
    return new Promise((resolve) => {
      const total = this.collectService.itemListaCobros?.length ?? 0;
      if (!this.hasMore || total === 0) {
        this.hasMore = false;
        resolve();
        return;
      }
      const nextOffset = this.currentOffset + this.PAGE_SIZE;
      const nextSlice = this.collectService.itemListaCobros.slice(this.currentOffset, nextOffset);
      for (const item of nextSlice) {
        this.collectService.displayedItems.push(item);
        this.displayedIndexMap.set(item.co_collection, this.collectService.itemListaCobros.findIndex(x => x.co_collection === item.co_collection));
      }
      this.currentOffset = this.collectService.displayedItems.length;
      this.hasMore = this.currentOffset < total;
      resolve();
    });
  }

  // Devuelve el índice real en la lista completa para usar al abrir/eliminar
  getOriginalIndex(collect: ItemListaCobros): number {
    const key = collect?.co_collection;
    if (!key) return -1;
    const mapped = this.displayedIndexMap.get(key);
    if (mapped != null && mapped >= 0) return mapped;
    // fallback: buscar por id
    return this.collectService.itemListaCobros.findIndex(x => x.id_collection === collect.id_collection);
  }

  onCollectSelect(coCollection: string, index: number, stCollection: number) {
    if (this.collectService.userMustActivateGPS && stCollection < 3) {
      if (!this.coordenada && this.coordenada.length < 1) {
        this.geoLoc.getCurrentPosition().then(xy => {
          if (xy.length > 0) {
            this.coordenada = xy;
            this.openCollect(coCollection, index);
          }
        })
      } else {
        this.openCollect(coCollection, index);
      }
    } else {
      this.openCollect(coCollection, index);
    }
  }

  openCollect(coCollection: string, index: number) {
    this.messageService.showLoading().then(() => {
      this.collectService.pauseCollectionDirtyTracking();
      this.enterpriseServ.setup(this.synchronizationServices.getDatabase()).then(() => {
        this.collectService.enterpriseList = this.enterpriseServ.empresas;
        this.collectService.collection = {} as Collection;
        this.collectService.collection = this.collectService.listCollect[index];
        this.collectService.documentSales = [] as DocumentSale[];
        this.collectService.documentSalesBackup = [] as DocumentSale[];
        this.collectService.mapDocumentsSales.clear();
        this.collectService.createAutomatedPrepaid = false;
        this.collectService.anticipoAutomatico = [];
        this.collectService.montoTotalPagado = 0;
        this.collectService.montoTotalPagar = 0;
        this.collectService.coTypeModule = this.collectService.collection.coType.toString();
        this.collectService.cobroValid = true;

        switch (Number(this.collectService.collection.coType)) {
          case 0: {
            this.collectService.isAnticipo = false;
            this.collectService.hideDocuments = false;
            this.collectService.hidePayments = false;
            this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO')!;
            break;
          }
          case 1: {
            this.collectService.isAnticipo = true;
            this.collectService.hideDocuments = true;
            this.collectService.hidePayments = false;
            this.collectService.disabledSelectCollectMethodDisabled = false;
            this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO_ANTICIPO')!;
            break;
          }
          case 2: {
            this.collectService.isRetention = true;
            this.collectService.isAnticipo = false;
            this.collectService.hideDocuments = false;
            this.collectService.hidePayments = true;
            this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO_RETENTION')!;
            break;
          }
          case 3: {
            this.collectService.isAnticipo = false;
            this.collectService.hideDocuments = false;
            this.collectService.hidePayments = false;
            this.collectService.titleModule = this.collectService.collectionTags.get('COB_NOMBRE_MODULO_IGTF')!;
            break;
          }
          case 4: {
            this.collectService.isAnticipo = false;
            this.collectService.hideDocuments = false;
            this.collectService.hidePayments = false;
            this.collectService.disabledSelectCollectMethodDisabled = false;
            this.collectService.titleModule = this.collectService.collectionTags.get('COB_MODULE_COBRO25')!;
            break;
          }
        }

        if (this.collectService.historicoTasa) this.collectService.haveRate = true;

        for (var i = 0; i < this.collectService.enterpriseList.length; i++) {
          if (this.collectService.collection.idEnterprise == this.collectService.enterpriseList[i].idEnterprise) {
            this.collectService.enterpriseSelected = this.collectService.enterpriseList[i];
            i = this.collectService.enterpriseList.length;
            break;
          }
        }

        if (this.collectService.userMustActivateGPS) {
          this.collectService.collection.coordenada = this.coordenada;
        }

        this.collectService.getCollection(this.synchronizationServices.getDatabase(), coCollection).then(persistedCollection => {
          if (persistedCollection?.coCollection) {
            this.collectService.mergePersistedCollectionIgtfFields(persistedCollection);
          }

          this.collectService.getCollectionDetails(this.synchronizationServices.getDatabase(), coCollection).then(collectionDetails => {
          this.collectService.collection.collectionDetails = collectionDetails;
          this.collectService.getCollectionDetailsDiscounts(this.synchronizationServices.getDatabase(), coCollection).then(collectionDetailsDiscounts => {


            const all = collectionDetailsDiscounts || [];
            const isDiscount = (x: any): x is any => x && (x.idCollectDiscount !== undefined || x.nuCollectDiscount !== undefined);
            const discounts = (all as any[]).filter(isDiscount);
            if (collectionDetailsDiscounts.length > 0) {
              for (const detail of this.collectService.collection.collectionDetails) {
                detail.collectionDetailDiscounts = discounts.filter(d => d.coCollection === detail.coCollection) ?? [];
              }

            }

            this.collectService.getCollectionPayments(this.synchronizationServices.getDatabase(), coCollection).then(collectionPayment => {
              if (this.collectService.collection.stDelivery == this.COLLECT_STATUS_TO_SEND || this.collectService.collection.stDelivery == 1) {
                this.collectService.hideDocuments = true;
                this.collectService.hidePayments = true;
              } /* else if (this.collectService.collection.stDelivery == 3) {
                this.collectService.showHeaderButtonsFunction(false);
                this.collectService.hideDocuments = true;
                this.collectService.hidePayments = true;
              } */ else {
                this.collectService.showHeaderButtonsFunction(true);
              }

              this.collectService.collection.collectionPayments = collectionPayment;
              this.collectService.isOpenCollect = true;
              this.collectService.cobroListComponent = false;
              this.collectService.cobroComponent = true;
              this.collectService.markCollectionOpenedFromPersistedCopy();
              this.messageService.hideLoading();
            })
          })
        });
        });
      })
    });
  }

  showAlertDelete(deleteCollect: ItemListaCobros, index: number) {
    const found = this.collectService.listCollect.find(item => item.idCollection === deleteCollect.id_collection);
    if (found) {
      this.selectedCollect = found;
    }
    this.selectedCollectIndex = index;
    this.setAlertDelete(true);
  }

  deleteCollect(index: number) {
    this.collectService.deleteCollection(this.synchronizationServices.getDatabase(), this.selectedCollect.coCollection).then(r => {
      // Eliminar del servicio (lista completa)
      this.collectService.listCollect.splice(this.selectedCollectIndex, 1);
      this.collectService.itemListaCobros.splice(this.selectedCollectIndex, 1);
      // Reconstruir los displayedItems para mantener consistencia
      const newTotal = this.collectService.itemListaCobros.length;
      const desired = Math.min(this.currentOffset, newTotal);
      this.rebuildDisplayedItems(desired);
      console.log(r, "BORRADO CON EXITO");
    })
  }

  setAlertDelete(value: boolean) {
    this.alertDelete = value;
  }

  /* handleInput(event: any) {
    this.searchText = (event?.detail?.value ?? '').toString().toLowerCase().trim();
  } */
  handleInput(event: any) {
    this.searchText = (event?.detail?.value ?? '').toString().toLowerCase().trim();
    if (!this.searchText) {
      this.collectService.displayedItems = [...this.allItems];
      return;
    }
    const q = this.searchText;
    this.collectService.displayedItems = this.allItems.filter(collect => {
      const coClient = (collect.co_client ?? '').toString().toLowerCase();
      const lbClient = (collect.lb_client ?? '').toString().toLowerCase();
      const idColl = collect.id_collection != null ? collect.id_collection.toString() : '';
      return coClient.includes(q) || lbClient.includes(q) || idColl.includes(q);
    });
  }

  async onIonInfinite(ev: any) {
    // cargar siguiente página
    await this.loadNextPage();
    // completar el infinite scroll
    try {
      (ev as InfiniteScrollCustomEvent).target.complete();
      // si ya no hay más, deshabilitar el infinite-scroll para evitar llamadas adicionales
      if (!this.hasMore) {
        (ev as InfiniteScrollCustomEvent).target.disabled = true;
      }
    } catch (err) {
      console.warn('onIonInfinite: complete error', err);
    }
  }

  getStatusOrderName(stCollection: number, stDelivery: number, naStatus: any) {
    if (stCollection != 0) {
      if (naStatus == null || naStatus === undefined) {
        return this.getStatus(stDelivery, naStatus);
      }
      return naStatus;
    } else {
      this.getStatus(stDelivery, naStatus);
    }
  }

  getStatus(status: number, naStatus: any): string {
    switch (status) {
      case 3: return this.collectService.collectionTags.get("COB_STATUS_SAVED")!;
      case COLLECT_STATUS_TO_SEND: return this.collectService.collectionTags.get("COB_STATUS_TO_SEND")!;
      case 1:
        return naStatus == null ? this.collectService.collectionTags.get("COB_STATUS_SENT")! : naStatus;
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

  getCoTypeName(coType: string | number): string {
    const typeStr = String(coType);
    switch (typeStr) {
      case '0': return this.collectService.collectionTags.get("COB_TYPE_COBRO")!;
      case '1': return this.collectService.collectionTags.get("COB_TYPE_ANTICIPO")!;
      case '2': return this.collectService.collectionTags.get("COB_TYPE_RETENCION")!;
      case '3': return this.collectService.collectionTags.get("COB_TYPE_IGTF")!;
      default: return 'Cobro';
    }
  }

  showCollectComment(event: Event, comment: string | null | undefined): void {
    // Evitar que el click del icono burbujee y active onCollectSelect
    event.stopPropagation();

    if (!comment) return;
    const header = this.collectService.collectionTags.get('COB_DEV_COMMENT') ?? 'Motivo';
    const messageAlert = new MessageAlert(header, comment);
    this.messageService.alertModal(messageAlert);
  }
}
