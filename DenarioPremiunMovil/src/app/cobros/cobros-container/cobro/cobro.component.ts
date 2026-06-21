import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { CobrosDocumentComponent } from '../cobro-documents/cobro-documents.component';

@Component({
  selector: 'app-cobro',
  templateUrl: './cobro.component.html',
  styleUrls: ['./cobro.component.scss'],
  standalone: false
})
export class CobroComponent implements OnInit, OnDestroy {

  public messageAlert!: MessageAlert;
  public collectService = inject(CollectionService);
  public messageService = inject(MessageService);
  public globalConfig = inject(GlobalConfigService);

  public subs: any;

  // propiedad local usada por la vista en lugar de usar directamente el servicio
  public collectValidTabsLocal: boolean = false;

  public segment = 'default';
  public documentsTabMounted = false;
  public fecha!: Date;

  @ViewChild('cobroDocuments') cobroDocuments?: CobrosDocumentComponent;

  constructor() {
    // inicializamos en false (evita cambios inesperados)
    this.collectService.collectValidTabs = false;
    this.collectValidTabsLocal = false;
  }

  ngOnInit() {
    if (this.collectService.initCollect) {
      this.collectValidFunc();
    } else {
      // deferimos la asignación para evitar cambiar un valor ligado al template
      // durante la misma pasada de change detection
      setTimeout(() => {
        this.collectService.collectValidTabs = true;
        this.collectValidTabsLocal = true;
      }, 0);
      this.segment = "default";
    }
  }

  collectValidFunc() {
    // guardamos la suscripción para poder cancelarla en ngOnDestroy
    this.subs = this.collectService.validCollection.subscribe((data: Boolean) => {
      // Deferimos la actualización al siguiente tick para evitar NG0100
      setTimeout(() => {
        // actualizamos la propiedad local que usa la plantilla
        this.collectValidTabsLocal = data.valueOf();
        // opcional: mantener sincronizado el servicio si lo necesita el resto
        this.collectService.collectValidTabs = data.valueOf();
      }, 0);
    });
  }

  onSegmentChange(event: CustomEvent): void {
    const value = event.detail?.value as string;
    if (value === 'documentos') {
      this.documentsTabMounted = true;
      this.cobroDocuments?.ensureDocumentsTableResizeObserver();
      this.cobroDocuments?.invalidateDocumentsTableLayoutCache();
      this.cobroDocuments?.scheduleDocumentsTableLayoutSync();
    }
    this.onChangeTab(value);
  }

  onChangeTab(tab: string) {
    try {
      console.log('[onChangeTab] start ->', tab);
      console.time('[onChangeTab] duration');
    } catch (e) {
      /* ignore console errors */
    }

    // Allow Angular to update the view, then measure end of tick
    setTimeout(() => {
      try {
        console.timeEnd('[onChangeTab] duration');
        console.log('[onChangeTab] current segment ->', this.segment);
        this.collectService.tabSelected = this.segment;
      } catch (e) {
        /* ignore */
      }
    }, 0);
  }

  getDate() {
    console.log(this.fecha);
  }

  ngOnDestroy() {
    if (this.subs && typeof this.subs.unsubscribe === 'function') {
      this.subs.unsubscribe();
    }
  }
}