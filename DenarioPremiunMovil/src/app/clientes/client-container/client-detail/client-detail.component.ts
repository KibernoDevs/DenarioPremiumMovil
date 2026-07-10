import { Component, EventEmitter, inject, Input, OnInit, AfterViewInit, OnDestroy, Output, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { ClientShareModalComponent } from '../client-share-modal/client-share-modal.component';
import { SynchronizationDBService } from '../../../services/synchronization/synchronization-db.service';
import { Client } from '../../../modelos/tables/client';
import { ClientesDatabaseServicesService } from '../../../services/clientes/clientes-database-services.service';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { SelectedClient } from 'src/app/modelos/selectedClient';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { Coordinate } from 'src/app/modelos/coordinate';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { AddresClient } from 'src/app/modelos/tables/addresClient';
import { formatClientForTab } from 'src/app/utils/client-display.util';

type ClientWithBalanceAlias = Client & { saldo?: number };

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss'],
  standalone: false
})
export class ClienteComponent implements OnInit, AfterViewInit, OnDestroy {

  private globalConfig = inject(GlobalConfigService);
  public clientLogic = inject(ClientLogicService);
  public currencyService = inject(CurrencyService);
  private cdr = inject(ChangeDetectorRef);

  public params!: any;
  public document!: DocumentSale[];
  public allDocuments: DocumentSale[] = [];
  public readonly DOCUMENT_SALES_PAGE_SIZE = 30;
  public documentSalesCurrentPage = 0;
  public documentSalesTotalRows = 0;
  public documentsTableLayoutReady = true;
  public readonly documentsTableSkeletonRows = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  public client!: Client;
  public sub!: object;
  public idCliente!: number;
  public multiCurrency!: Boolean;
  public tagRif: string = "";
  public nuCreditLimitConversion: string = "";
  public availableCreditConversion: string = "";
  public localCurrency = '';
  public hardCurrency = '';
  public decimales = 2;
  public selectedAddress!: AddresClient;
  public saldoLocal: number = 0;
  public saldoFuerte: number = 0;

  subjectClientShareModalOpen: any;
  // selección múltiple de documentos
  public selectedDocuments: string[] = [];
  public shareDocuments: DocumentSale[] = [];

  // control de modales
  public clientShareModalOpen = false;
  public clientSelectShareModalOpen = false;

  @ViewChild('documentsTablePanel') documentsTablePanel?: ElementRef<HTMLElement>;
  @ViewChild('documentsTableScroll') documentsTableScroll?: ElementRef<HTMLElement>;
  @ViewChild('documentsHeaderScroll') documentsHeaderScroll?: ElementRef<HTMLElement>;
  @ViewChild('documentsBodyWrap') documentsBodyWrap?: ElementRef<HTMLElement>;

  private documentsTableLayoutKey = '';
  private documentsTableLayoutFrame = 0;
  private documentsTableResizeObserver?: ResizeObserver;

  @Input() showHeader: boolean = false;

  constructor() {
    this.clientLogic.initService();
  }

  ngOnInit() {
    //console.log(this.clientDetail);
    this.client = this.clientLogic.datos.client;
    this.clientLogic.checkUserStatus();
    this.client.txDescription1 = this.sanitizeDescription(this.client.txDescription1);
    this.client.txDescription2 = this.sanitizeDescription(this.client.txDescription2);


    this.selectedAddress = this.clientLogic.listaDirecciones.find(address => address.idAddress === this.client.idAddressClients)!;

    this.localCurrency = this.currencyService.localCurrency.coCurrency;
    if (this.clientLogic.multiCurrency) {
      this.hardCurrency = this.currencyService.hardCurrency.coCurrency;
    }
    this.decimales = this.currencyService.precision;

    this.initializeClientBalances();

    if (this.clientLogic.multiCurrency && this.currencyService.multimoneda) {
      if (this.client.coCurrency === this.clientLogic.localCurrency.coCurrency) {
        this.nuCreditLimitConversion = this.formatNumber(this.currencyService.toHardCurrency(this.client.nuCreditLimit));
        this.availableCreditConversion = this.formatNumber(this.currencyService.toHardCurrency(this.getAvailableCredit()));
      } else {
        this.nuCreditLimitConversion = this.formatNumber(this.currencyService.toLocalCurrency(this.client.nuCreditLimit));
        this.availableCreditConversion = this.formatNumber(this.currencyService.toLocalCurrency(this.getAvailableCredit()));
      }
    }


    this.allDocuments = Array.isArray(this.clientLogic.datos.document)
      ? [...this.clientLogic.datos.document]
      : [];
    this.documentSalesTotalRows = this.allDocuments.length;
    this.documentSalesCurrentPage = 0;
    this.getColorRowDocumentSale();
    this.applyDocumentPage();

    this.tagRif = this.globalConfig.get("tagRif")!;

    this.subjectClientShareModalOpen = this.clientLogic.closeClientShareModal.subscribe((open: Boolean) => {
      this.clientShareModalOpen = false;
    });
  }

  ngAfterViewInit(): void {
    const panel = this.documentsTablePanel?.nativeElement;
    if (panel && typeof ResizeObserver !== 'undefined') {
      let lastWidth = 0;
      this.documentsTableResizeObserver = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width ?? 0;
        if (width > 0 && Math.abs(width - lastWidth) > 1) {
          lastWidth = width;
          this.invalidateDocumentsTableLayoutCache();
          this.scheduleDocumentsTableLayoutSync(0, false);
        }
      });
      this.documentsTableResizeObserver.observe(panel);
    }

    if (this.documentSalesTotalRows > 0) {
      this.scheduleDocumentsTableLayoutSync();
    }
  }

  private ensureDocumentsTableResizeObserver(): void {
    if (this.documentsTableResizeObserver) return;
    const panel = this.documentsTablePanel?.nativeElement;
    if (!panel || typeof ResizeObserver === 'undefined') return;
    let lastWidth = 0;
    this.documentsTableResizeObserver = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0 && Math.abs(width - lastWidth) > 1) {
        lastWidth = width;
        this.invalidateDocumentsTableLayoutCache();
        this.scheduleDocumentsTableLayoutSync(0, false);
      }
    });
    this.documentsTableResizeObserver.observe(panel);
  }

  public onClientSegmentChange(event: CustomEvent): void {
    if (event.detail?.value === 'docVentas') {
      this.ensureDocumentsTableResizeObserver();
      this.invalidateDocumentsTableLayoutCache();
      this.scheduleDocumentsTableLayoutSync();
    }
  }

  ngOnDestroy() {
    this.documentsTableResizeObserver?.disconnect();
    if (this.documentsTableLayoutFrame) {
      cancelAnimationFrame(this.documentsTableLayoutFrame);
    }
    this.subjectClientShareModalOpen.unsubscribe();
  }

  private sanitizeDescription(value: any): string {
    if (value == null || value === undefined) return '';
    const s = String(value).trim();
    if (s === '' || s.toLowerCase() === 'null') return '';
    return s;
  }

  private initializeClientBalances(): void {
    const saldo1 = this.getClientSaldo1();
    const saldo2 = this.getClientSaldo2();

    this.saldoLocal = saldo1;
    this.saldoFuerte = saldo2;

    if (!this.clientLogic.multiCurrency || !this.currencyService.multimoneda) {
      return;
    }

    this.saldoLocal = saldo1 + this.currencyService.toLocalCurrency(saldo2);
    this.saldoFuerte = this.currencyService.toHardCurrency(this.saldoLocal);
  }

  private getClientSaldo1(): number {
    const client = this.client as ClientWithBalanceAlias;
    return Number(client?.saldo1 ?? client?.saldo ?? 0);
  }

  private getClientSaldo2(): number {
    return Number(this.client?.saldo2 ?? 0);
  }

  openDoc(idDocumento: number, index: number) {
    console.log(idDocumento, index);
    console.log(this.document[index]);
    this.clientLogic.documentSaleSelect = {} as DocumentSale;
    this.clientLogic.documentSaleSelect = this.document[index];
    this.clientLogic.clientDetailComponent = false;
    this.clientLogic.clientDocumentSaleComponent = true;
    this.clientLogic.opendDocClick = true;
  }

  public get documentSalesTotalPages(): number {
    return Math.max(Math.ceil(this.documentSalesTotalRows / this.DOCUMENT_SALES_PAGE_SIZE), 1);
  }

  public get documentSalesPageStart(): number {
    if (this.documentSalesTotalRows === 0) {
      return 0;
    }

    return (this.documentSalesCurrentPage * this.DOCUMENT_SALES_PAGE_SIZE) + 1;
  }

  public get documentSalesPageEnd(): number {
    const nextPageEnd = (this.documentSalesCurrentPage + 1) * this.DOCUMENT_SALES_PAGE_SIZE;

    return Math.min(nextPageEnd, this.documentSalesTotalRows);
  }

  public get canShowDocumentPagination(): boolean {
    return this.documentSalesTotalRows > this.DOCUMENT_SALES_PAGE_SIZE;
  }

  public get canGoToPreviousDocumentsPage(): boolean {
    return this.documentSalesCurrentPage > 0;
  }

  public get canGoToNextDocumentsPage(): boolean {
    return this.documentSalesPageEnd < this.documentSalesTotalRows;
  }

  public goToPreviousDocumentsPage(): void {
    if (!this.canGoToPreviousDocumentsPage) {
      return;
    }

    this.loadDocumentsPage(this.documentSalesCurrentPage - 1);
  }

  public goToNextDocumentsPage(): void {
    if (!this.canGoToNextDocumentsPage) {
      return;
    }

    this.loadDocumentsPage(this.documentSalesCurrentPage + 1);
  }

  private loadDocumentsPage(page: number): void {
    this.markDocumentsTableLayoutPending();
    this.documentSalesCurrentPage = Math.max(page, 0);
    this.applyDocumentPage();
    this.resetDocumentsTableScroll();
    this.invalidateDocumentsTableLayoutCache();
    this.scheduleDocumentsTableLayoutSync(0, false);
  }

  private applyDocumentPage(): void {
    const start = this.documentSalesCurrentPage * this.DOCUMENT_SALES_PAGE_SIZE;
    this.document = this.allDocuments.slice(start, start + this.DOCUMENT_SALES_PAGE_SIZE);
  }

  private markDocumentsTableLayoutPending(): void {
    this.documentsTableLayoutReady = false;
    this.cdr.markForCheck();
  }

  private completeDocumentsTableLayout(): void {
    this.documentsTableLayoutReady = true;
    this.cdr.markForCheck();
  }

  private getIonColumnSize(col: HTMLElement): number {
    const size = col.getAttribute('size');

    return size ? parseInt(size, 10) : 12;
  }

  private getDocumentsTableColumns(row: Element | null): HTMLElement[] {
    if (!row) {
      return [];
    }

    return Array.from(row.querySelectorAll('ion-col')) as HTMLElement[];
  }

  private getDocumentsTableRowsToMeasure(bodyRows: Element[]): Element[] {
    if (bodyRows.length <= 3) {
      return bodyRows;
    }

    const middleIndex = Math.floor(bodyRows.length / 2);
    return [bodyRows[0], bodyRows[middleIndex], bodyRows[bodyRows.length - 1]];
  }

  private invalidateDocumentsTableLayoutCache(): void {
    this.documentsTableLayoutKey = '';
  }

  private buildDocumentsTableLayoutKey(
    headerColsCount: number,
    bodyRowsCount: number,
    viewportWidth: number
  ): string {
    return [
      this.documentSalesCurrentPage,
      headerColsCount,
      bodyRowsCount,
      viewportWidth
    ].join('|');
  }

  private applyProvisionalDocumentsTableLayout(
    tablePanel: HTMLElement,
    headerCols: HTMLElement[],
    bodyRows: Element[],
    viewportWidth: number
  ): void {
    const columnSizes = headerCols.map(col => this.getIonColumnSize(col));
    const totalSize = columnSizes.reduce((sum, size) => sum + size, 0);

    if (totalSize === 0) {
      return;
    }

    const minColumnWidth = 52;
    const minWidths = columnSizes.map(size => Math.max(minColumnWidth, size * 10));
    const minTableWidth = minWidths.reduce((sum, width) => sum + width, 0);
    const tableWidth = Math.max(minTableWidth, viewportWidth);
    const assignedWidths = columnSizes.map((size, index) => {
      const proportionalWidth = Math.ceil((size / totalSize) * tableWidth);
      return Math.max(minWidths[index], proportionalWidth);
    });
    const resolvedTableWidth = assignedWidths.reduce((sum, width) => sum + width, 0);

    tablePanel.style.setProperty('--documents-table-width', `${resolvedTableWidth}px`);

    const applyColumnWidth = (col: HTMLElement, index: number): void => {
      const widthPx = `${assignedWidths[index]}px`;
      col.style.width = widthPx;
      col.style.minWidth = widthPx;
      col.style.maxWidth = widthPx;
    };

    headerCols.forEach(applyColumnWidth);
    bodyRows.forEach(row => {
      this.getDocumentsTableColumns(row).forEach(applyColumnWidth);
    });
  }

  private syncDocumentsTableLayout(): boolean {
    const tablePanel = this.documentsTablePanel?.nativeElement;
    const tableStack = this.documentsTableScroll?.nativeElement?.querySelector('.documents-table-stack') as HTMLElement | null;
    const headerWrap = this.documentsHeaderScroll?.nativeElement;
    const bodyWrap = this.documentsBodyWrap?.nativeElement;

    if (!tablePanel || !tableStack || !headerWrap || !bodyWrap) {
      return false;
    }

    const headerRow = headerWrap.querySelector('ion-row.cabecera');
    const bodyGrid = bodyWrap.querySelector('ion-grid');

    if (!headerRow || !bodyGrid) {
      return false;
    }

    const headerCols = this.getDocumentsTableColumns(headerRow);
    const bodyRows = Array.from(bodyGrid.querySelectorAll('ion-row'));

    if (headerCols.length === 0 || bodyRows.length === 0) {
      this.completeDocumentsTableLayout();
      return true;
    }

    const viewportWidth = this.documentsTableScroll?.nativeElement?.clientWidth ?? bodyWrap.clientWidth;
    const layoutKey = this.buildDocumentsTableLayoutKey(headerCols.length, bodyRows.length, viewportWidth);

    this.applyProvisionalDocumentsTableLayout(tablePanel, headerCols, bodyRows, viewportWidth);

    if (layoutKey === this.documentsTableLayoutKey) {
      this.completeDocumentsTableLayout();
      return true;
    }

    const headerRows = Array.from(headerWrap.querySelectorAll('ion-row')) as HTMLElement[];
    const bodyRowElements = bodyRows as HTMLElement[];
    const rowsToMeasure = this.getDocumentsTableRowsToMeasure(bodyRows);

    headerRows.forEach(row => {
      row.style.tableLayout = 'auto';
    });
    bodyRowElements.forEach(row => {
      row.style.tableLayout = 'auto';
    });

    const columnSizes = headerCols.map(col => this.getIonColumnSize(col));
    const totalSize = columnSizes.reduce((sum, size) => sum + size, 0);
    const minWidths = new Array<number>(headerCols.length).fill(0);

    const measureColumnWidth = (col: HTMLElement, index: number): void => {
      if (index >= headerCols.length) {
        return;
      }

      minWidths[index] = Math.max(minWidths[index], col.scrollWidth, col.getBoundingClientRect().width);
    };

    headerCols.forEach(measureColumnWidth);
    rowsToMeasure.forEach(row => {
      this.getDocumentsTableColumns(row).forEach(measureColumnWidth);
    });

    const minTableWidth = minWidths.reduce((sum, width) => sum + width, 0);
    const tableWidth = Math.max(minTableWidth, viewportWidth);
    const assignedWidths = columnSizes.map((size, index) => {
      const proportionalWidth = Math.ceil((size / totalSize) * tableWidth);

      return Math.max(minWidths[index], proportionalWidth);
    });
    const resolvedTableWidth = assignedWidths.reduce((sum, width) => sum + width, 0);
    const tableWidthPx = `${resolvedTableWidth}px`;

    tablePanel.style.setProperty('--documents-table-width', tableWidthPx);

    const applyColumnWidth = (col: HTMLElement, index: number): void => {
      const widthPx = `${assignedWidths[index]}px`;
      col.style.width = widthPx;
      col.style.minWidth = widthPx;
      col.style.maxWidth = widthPx;
    };

    headerCols.forEach(applyColumnWidth);
    bodyRows.forEach(row => {
      this.getDocumentsTableColumns(row).forEach(applyColumnWidth);
    });

    headerRows.forEach(row => {
      row.style.tableLayout = 'fixed';
    });
    bodyRowElements.forEach(row => {
      row.style.tableLayout = 'fixed';
    });

    this.documentsTableLayoutKey = layoutKey;
    this.completeDocumentsTableLayout();
    return true;
  }

  private resetDocumentsTableScroll(): void {
    const scrollContainer = this.documentsTableScroll?.nativeElement;

    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
      scrollContainer.scrollLeft = 0;
    }
  }

  private scheduleDocumentsTableLayoutSync(retryCount = 0, markPending = true): void {
    if (markPending && retryCount === 0) {
      this.markDocumentsTableLayoutPending();
    }

    if (this.documentsTableLayoutFrame) {
      cancelAnimationFrame(this.documentsTableLayoutFrame);
    }

    this.documentsTableLayoutFrame = requestAnimationFrame(() => {
      this.documentsTableLayoutFrame = requestAnimationFrame(() => {
        this.documentsTableLayoutFrame = 0;
        const synced = this.syncDocumentsTableLayout();

        if (!synced && retryCount < 2) {
          this.scheduleDocumentsTableLayoutSync(retryCount + 1, false);
        }
      });
    });
  }

  viewCoordenada(verCrear: Boolean, client: Client, module: string) {
    if (verCrear)
      console.log("ver mapa");
    else
      console.log("crear ubicacion");
    this.clientLogic.viewCoordenada(client, module);
  }

  hayCoordenada(coord: string) {
    if (coord == null || coord.trim() === "" ||
      coord.toLowerCase().trim() === "null" || coord.trim() == "0,0") {
      return false;
    }
    return true;
  }

  //funcion que devuelve la coordenada si existe
  getCoordenada(coord: string) {
    if (this.hayCoordenada(coord)) {
      return coord;
    }
    return "";
  }

  //Hacer estas conversiones en el servicio de moneda
  //tomaria muchos queries a la bd, lo hacemos aca mejor.
  toLocalCurrency(hardAmount: number, doc: DocumentSale): string {
    if (doc.coCurrency == this.localCurrency) {
      //si la moneda es la misma, no se convierte
      return this.formatNumber(hardAmount);
    }
    return this.formatNumber(((hardAmount * doc.nuValueLocal) / this.currencyService.currencyRelation));
  }

  toHardCurrency(localAmount: number, doc: DocumentSale): string {
    if (doc.coCurrency == this.hardCurrency) {
      return this.formatNumber(localAmount);
    }
    return this.formatNumber(((localAmount * this.currencyService.currencyRelation) / doc.nuValueLocal));
  }

  formatNumber(num: number) {
    return this.currencyService.formatNumber(num);
  }

  getAvailableCredit(): number {
    return Number(this.client?.nuCreditLimit ?? 0) - (this.getClientSaldo1() + this.getClientSaldo2());
  }

  getDaDueDate(daDueDate: string) {
    if (!daDueDate) return 0;

    const rawDate = String(daDueDate).split(' ')[0].trim();
    let dueDate: Date | null = null;

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [day, month, year] = rawDate.split('/').map(Number);
      dueDate = new Date(year, month - 1, day);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      const [year, month, day] = rawDate.split('-').map(Number);
      dueDate = new Date(year, month - 1, day);
    } else {
      const parsed = new Date(rawDate);
      dueDate = Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (!dueDate) return 0;

    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    const diffDays = Math.floor((todayOnly.getTime() - dueDateOnly.getTime()) / 86400000);
    return Math.abs(diffDays);
  }

  oppositeCoCurrency(coCurrency: string) {
    return this.currencyService.oppositeCoCurrency(coCurrency);
  }

  public toggleDocumentSelection(coDocument: string, event?: any): void {
    const checked = event?.detail?.checked ?? !!event?.target?.checked;
    if (!Array.isArray(this.selectedDocuments)) this.selectedDocuments = [];
    const idx = this.selectedDocuments.indexOf(coDocument);
    if (checked) {
      if (idx === -1) this.selectedDocuments.push(coDocument);
    } else {
      if (idx !== -1) this.selectedDocuments.splice(idx, 1);
    }
  }

  public selectAllDocuments(): void {
    this.selectedDocuments = this.getShareableDocuments().map(doc => doc.coDocument);
  }

  private getShareableDocuments(): DocumentSale[] {
    if (this.allDocuments.length > 0) {
      return this.allDocuments;
    }

    return Array.isArray(this.clientLogic.datos?.document)
      ? this.clientLogic.datos.document
      : [];
  }

  public openSelectShareModal(open: boolean): void {
    this.clientSelectShareModalOpen = !!open;
  }

  public openShareModal(open: boolean): void {
    if (!open) {
      this.clientShareModalOpen = false;
      return;
    }

    const docs = this.getShareableDocuments();
    const selectedDocs = this.selectedDocuments
      .map(co => docs.find(doc => doc.coDocument === co))
      .filter((doc): doc is DocumentSale => !!doc);

    if (selectedDocs.length === 0) {
      return;
    }

    this.shareDocuments = selectedDocs;
    this.clientLogic.documentsSaleSelectShared = selectedDocs;
    this.clientShareModalOpen = true;
  }

  public onShareModalDismiss(): void {
    this.clientShareModalOpen = false;
    this.shareDocuments = [];
  }

  onChangeAddress($event: any) {
    //cargamos la data de la direccion al cliente para usarla luego en modal de direcciones.
    //his.selectedAddress = $event.detail.value;
    this.client.txAddress = this.selectedAddress.txAddress;
    this.client.idAddressClients = this.selectedAddress.idAddress;
    this.client.coAddressClients = this.selectedAddress.coAddress;
    this.client.coordenada = this.selectedAddress.coordenada;
    this.client.editable = this.selectedAddress.editable;

    //console.log(this.client.coordenada);
  }

  addressCompare(o1: AddresClient, o2: AddresClient): boolean {
    return o1 && o2 ? o1.idAddress === o2.idAddress : o1 === o2;
  }

  showDocVentasTab() {
    if (this.clientLogic.esTransportista) {
      return false;
    }
    /*
    if (this.clientLogic.fromSelector){
      return false;
    }
      */
    return true;
  }

  convertirMonto(monto: number, rate: number, currency: string) {

    if (currency == this.localCurrency) {
      return this.currencyService.formatNumber(this.cleanFormattedNumber(this.currencyService.formatNumber(monto / rate)));
    } else {
      return this.currencyService.formatNumber(this.cleanFormattedNumber(this.currencyService.formatNumber(monto * rate)));
    }
  }

  public cleanFormattedNumber(str: string): number {
    // Elimina espacios
    str = str.trim();
    // Elimina separador de miles (puntos)
    str = str.replace(/\./g, '');
    // Cambia la coma decimal por punto
    str = str.replace(/,/g, '.');
    // Convierte a número
    return Number(str);
  }

  getColorRowDocumentSale() {
    try {
      if (!Array.isArray(this.allDocuments)) return;

      for (let i = 0; i < this.allDocuments.length; i++) {
        const doc = this.allDocuments[i];
        if (!doc) continue;

        const currentColor = String(doc.colorRow ?? '').trim().toLowerCase();

        // Si ya está en rojo, no se vuelve a modificar.
        if (currentColor === 'red') {
          doc.colorRow = 'Red';
          this.allDocuments[i].colorRow = 'Red';
          continue;
        }

        const docNuBalance = Number(doc.nuBalance ?? 0);
        if (docNuBalance <= 0) {
          doc.colorRow = 'black';
        } else {
          const dueSoon = this.clientLogic.isDueSoon(doc.daDueDate);
          doc.colorRow = dueSoon ? 'Red' : 'Blue';
        }

        // Asegura que el array fuente refleje el color calculado.
        this.allDocuments[i].colorRow = doc.colorRow;


        // Mantener mapa actualizado (si existe entrada por idDocument)
        /*  if (doc.idDocument != null && this.mapDocumentsSales && this.mapDocumentsSales.has(doc.idDocument)) {
           const mapped = this.mapDocumentsSales.get(doc.idDocument)!;
           mapped.colorRow = doc.colorRow;
           this.mapDocumentsSales.set(doc.idDocument, mapped);
         } */
      }
    } catch (err) {
      console.warn('[CollectionService] getColorRowDocumentSale error:', err);
    }
  }

  get clienteTabLabel(): string {
    return formatClientForTab(this.client?.naClient, this.client?.coClient, this.client?.lbClient);
  }
}
