import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CollectionDetailDiscounts, CollectionDetailRetentions, CollectionPayment } from 'src/app/modelos/tables/collection';
import { CollectRetentions } from 'src/app/modelos/tables/collectRetentions';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { PagoCheque } from 'src/app/modelos/pago-cheque';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { PagoEfectivo } from 'src/app/modelos/pago-efectivo';
import { PagoDeposito } from 'src/app/modelos/pago-deposito';
import { PagoTransferencia } from 'src/app/modelos/pago-transferencia';
import { PagoOtros } from 'src/app/modelos/pago-otros';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { BankAccount } from 'src/app/modelos/tables/bankAccount';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { CollectDiscounts } from 'src/app/modelos/tables/collectDiscounts';
import { IgtfList } from 'src/app/modelos/tables/igtfList';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ClienteSelectorService } from 'src/app/cliente-selector/cliente-selector.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-cobro-documents',
  templateUrl: './cobro-documents.component.html',
  styleUrls: ['./cobro-documents.component.scss'],
  standalone: false
})
export class CobrosDocumentComponent implements OnInit, AfterViewInit, OnDestroy {

  public collectService = inject(CollectionService);
  public clientSelectorService = inject(ClienteSelectorService);
  public globalConfig = inject(GlobalConfigService);
  public currencyService = inject(CurrencyService);
  public dateServ = inject(DateServiceService);
  public synchronizationServices = inject(SynchronizationDBService);
  public clientLogic = inject(ClientLogicService);
  private messageService = inject(MessageService);
  public cdr: ChangeDetectorRef;

  public Math = Math;
  public Number = Number;
  public indexDocumentSaleOpen: number = -1;

  public daVoucher: string = "";
  public fechaHoy: string = "";

  public centsDiscount: number | undefined;
  public displayDiscount: string = '';
  public centsRetention: number | undefined;
  public displayRetention: string = '';
  public centsRetention2: number | undefined;
  public displayRetention2: string = '';
  public centsAmountPaid: number | undefined;
  public displayAmountPaid: string = '';
  public nuCollectDiscount: number | undefined;
  public naCollectDiscount: string = '';
  public discountComment: string = '';
  public manualCollectDiscountAmount: number = 0;
  private manualCollectDiscountAmountBackup: number = 0;
  public centsManualCollectDiscount: number | undefined;
  public displayManualCollectDiscount: string = '';
  private readonly MANUAL_COLLECT_DISCOUNT_ID = -1;
  private readonly MANUAL_COLLECT_DISCOUNT_LABEL = 'Descuento manual';

  public assignDiscountsOpen: boolean = false;

  public detailCollectDiscountsPos: number = 0;

  public disabledSaveButton: boolean = false;
  public alertMessageOpen: boolean = false;
  public alertMessageOpen2: boolean = false;
  private hasShownPartialPayMessage: boolean = false;
  // Flags para evitar race conditions entre keydown y input (teclados virtuales / emuladores)
  private discountKeyInFlight: boolean = false;
  private retentionKeyInFlight: boolean = false;
  private retention2KeyInFlight: boolean = false;
  private amountPaidKeyInFlight: boolean = false;
  private manualCollectDiscountKeyInFlight: boolean = false;
  public disabledCollectDiscountButton: boolean = false;
  // When true, discount checkboxes should be disabled in the template
  public disableDiscountCheckboxes: boolean = false;

  public selectedCollectRetentionId: number | undefined;
  private documentRetentionLines: Array<{
    idCollectRetention: number;
    coCollectRetention: string;
    nuAmountRetention: number;
    nuVoucherRetention: string;
    daVoucherRetention: string;
  }> = [];
  private detailCollectRetentionsPos = 0;
  private collectRetentionCentsMap = new Map<number, number>();
  private collectRetentionDisplayMap = new Map<number, string>();
  private collectRetentionKeyInFlightMap = new Map<number, boolean>();
  private retentionLineVoucherValidMap = new Map<number, boolean>();
  private retentionLineDateValidMap = new Map<number, boolean>();

  public mensaje: string = '';
  public saldo: string = "";
  public saldoConversion: string = "";
  public saldoView: number = 0;
  public saldoConversionView: number = 0;
  public baseView: number = 0;
  public baseConversionView: number = 0;
  public valuePartialPayment: number = 0;
  public discountView: number = 0;
  public discountViewConversion: number = 0;
  public ivaView: number = 0;
  public ivaViewConversion: number = 0;
  public totalView: number = 0;
  public totalViewConversion: number = 0;
  public filteredDocumentsView: DocumentSale[] = [];
  public documentsTableLayoutReady = true;
  public readonly documentsTableSkeletonRows = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  @ViewChild('documentsTablePanel') documentsTablePanel?: ElementRef<HTMLElement>;
  @ViewChild('documentsTableScroll') documentsTableScroll?: ElementRef<HTMLElement>;
  @ViewChild('documentsHeaderScroll') documentsHeaderScroll?: ElementRef<HTMLElement>;
  @ViewChild('documentsBodyWrap') documentsBodyWrap?: ElementRef<HTMLElement>;

  private documentsTableLayoutKey = '';
  private documentsTableLayoutFrame = 0;
  private documentsTableResizeObserver?: ResizeObserver;
  private lastLoadedClientId: number | null = null;
  private clientChangedSub?: Subscription;
  private documentReloadSub?: Subscription;


  public alertButtons = [
    /*  {
       text: '',
       role: 'cancel'
     }, */
    {
      text: '',
      role: 'confirm'
    },
  ];

  public alertButtons2 = [
    {
      text: '',
      role: 'cancel'
    },
    {
      text: '',
      role: 'confirm'
    },
  ];


  constructor() {
    this.cdr = inject(ChangeDetectorRef);
    this.alertButtons[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!;
    this.alertButtons2[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_CANCELAR')!;
    this.alertButtons2[1].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!;

  }
  ngOnInit() {
    this.fechaHoy = this.dateServ.onlyDateHoyISO();
    this.initializeDocumentCurrencyFilter();

    this.clientChangedSub = this.clientSelectorService.ClientChanged.subscribe(() => {
      this.lastLoadedClientId = null;
      this.clearLocalDocumentsView();
    });

    this.documentReloadSub = this.collectService.documentsClientReloaded$.subscribe((idClient) => {
      this.lastLoadedClientId = idClient;
      this.applyDocumentFilter(this.collectService.documentCurrency || 'Moneda');
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    this.ensureDocumentsTableResizeObserver();
  }

  public ensureDocumentsTableResizeObserver(): void {
    if (this.documentsTableResizeObserver) return;
    const panel = this.documentsTablePanel?.nativeElement;
    if (!panel || typeof ResizeObserver === 'undefined') {
      return;
    }

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

  ngOnDestroy(): void {
    this.clientChangedSub?.unsubscribe();
    this.documentReloadSub?.unsubscribe();
    this.documentsTableResizeObserver?.disconnect();
    if (this.documentsTableLayoutFrame) {
      cancelAnimationFrame(this.documentsTableLayoutFrame);
    }
  }

  private clearLocalDocumentsView(): void {
    this.filteredDocumentsView = [];
    this.documentsTableLayoutReady = false;
    this.markDocumentsTableLayoutPending();
    this.cdr.detectChanges();
  }

  async refreshDocumentsForCurrentClient(forceReload = false): Promise<void> {
    const clientId = this.collectService.collection.idClient;
    if (!clientId) {
      this.clearLocalDocumentsView();
      return;
    }

    if (!forceReload
      && this.lastLoadedClientId === clientId
      && this.filteredDocumentsView.length > 0) {
      this.applyDocumentFilter(this.collectService.documentCurrency || 'Moneda');
      this.cdr.detectChanges();
      return;
    }

    this.clearLocalDocumentsView();
    await this.loadDocumentsSalePage(0, clientId);
    this.lastLoadedClientId = clientId;
    this.cdr.detectChanges();
  }



  onChangeCurrencyDoc(event: any) {
    const selected = event?.detail?.value ?? event?.target?.value;
    const selectedCurrency = selected?.coCurrency ?? '';

    this.collectService.currencySelectedDocument = selected;
    this.collectService.documentCurrency = selectedCurrency;
    void this.loadDocumentsSalePage(0);
  }

  private applyDocumentFilter(coCurrency: string, scheduleLayout = true): void {
    const source = this.collectService.documentSalesView?.length
      ? this.collectService.documentSalesView
      : this.collectService.documentSales;
    const pageIds = this.collectService.documentSalesPageIds;
    const pageSource = pageIds?.size
      ? source.filter(doc => pageIds.has(doc.idDocument))
      : source;

    if (!Array.isArray(pageSource) || pageSource.length === 0) {
      this.filteredDocumentsView = [];
      this.collectService.documentsSaleComponent = false;
      this.documentsTableLayoutReady = true;
      return;
    }

    if (scheduleLayout) {
      this.markDocumentsTableLayoutPending();
    }

    this.filteredDocumentsView = (!coCurrency || coCurrency === 'Moneda')
      ? pageSource
      : pageSource.filter(doc => doc.coCurrency === coCurrency);

    this.collectService.documentsSaleComponent = this.filteredDocumentsView.length > 0;
    if (scheduleLayout) {
      this.scheduleDocumentsTableLayoutSync(0, false);
    }
  }

  private markDocumentsTableLayoutPending(): void {
    this.documentsTableLayoutReady = false;
    this.cdr.markForCheck();
  }

  private completeDocumentsTableLayout(): void {
    this.documentsTableLayoutReady = true;
    this.cdr.markForCheck();
  }

  public getSourceIndex(documentSale: DocumentSale): number {
    const byId = this.collectService.documentSales.findIndex(d => d.idDocument === documentSale.idDocument);
    if (byId >= 0) return byId;

    return this.collectService.documentSales.findIndex(
      d => d.coDocument === documentSale.coDocument && d.idEnterprise === documentSale.idEnterprise
    );
  }

  getDocumentsSale(idClient: number, coCurrency: string, coCollection: string, idEnterprise: number): Promise<void> {
    return this.loadDocumentsSalePage(0, idClient, coCurrency, coCollection, idEnterprise);
  }

  public get documentSalesTotalPages(): number {
    const total = this.collectService.documentSalesTotalRows;
    const pageSize = this.collectService.documentSalesPageSize;
    return Math.max(Math.ceil(total / pageSize), 1);
  }

  public get documentSalesPageStart(): number {
    if (this.collectService.documentSalesTotalRows === 0) {
      return 0;
    }

    return (this.collectService.documentSalesCurrentPage * this.collectService.documentSalesPageSize) + 1;
  }

  public get documentSalesPageEnd(): number {
    const nextPageEnd = (this.collectService.documentSalesCurrentPage + 1) * this.collectService.documentSalesPageSize;
    return Math.min(nextPageEnd, this.collectService.documentSalesTotalRows);
  }

  public get canShowDocumentPagination(): boolean {
    return this.documentSalesTotalPages > 1;
  }

  public get canGoToPreviousDocumentsPage(): boolean {
    return this.collectService.documentSalesCurrentPage > 0;
  }

  public get canGoToNextDocumentsPage(): boolean {
    return this.documentSalesPageEnd < this.collectService.documentSalesTotalRows;
  }

  public goToPreviousDocumentsPage(): void {
    if (!this.canGoToPreviousDocumentsPage) {
      return;
    }

    void this.loadDocumentsSalePage(this.collectService.documentSalesCurrentPage - 1);
  }

  public goToNextDocumentsPage(): void {
    if (!this.canGoToNextDocumentsPage) {
      return;
    }

    void this.loadDocumentsSalePage(this.collectService.documentSalesCurrentPage + 1);
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

  public invalidateDocumentsTableLayoutCache(): void {
    this.documentsTableLayoutKey = '';
  }

  private buildDocumentsTableLayoutKey(
    headerColsCount: number,
    bodyRowsCount: number,
    viewportWidth: number
  ): string {
    return [
      this.collectService.documentSalesCurrentPage,
      this.collectService.documentCurrency,
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

    this.applyProvisionalDocumentsTableLayout(tablePanel, headerCols, bodyRows, viewportWidth);

    const layoutKey = this.buildDocumentsTableLayoutKey(headerCols.length, bodyRows.length, viewportWidth);

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

  public scheduleDocumentsTableLayoutSync(retryCount = 0, markPending = true): void {
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
          this.scheduleDocumentsTableLayoutSync(retryCount + 1);
        }
      });
    });
  }

  private async loadDocumentsSalePage(
    page: number,
    idClient: number = this.collectService.collection.idClient,
    coCurrency: string = this.collectService.documentCurrency || 'Moneda',
    coCollection: string = this.collectService.collection.coCollection,
    idEnterprise: number = this.collectService.collection.idEnterprise
  ): Promise<void> {
    const pageSize = this.collectService.documentSalesPageSize || this.collectService.DOCUMENT_SALES_PAGE_SIZE;
    const safePage = Math.max(page, 0);

    await this.collectService.getDocumentsSales(
      this.synchronizationServices.getDatabase(),
      idClient,
      coCurrency,
      coCollection,
      idEnterprise,
      {
        limit: pageSize,
        offset: safePage * pageSize,
        includeSelected: true
      }
    );

    this.markDocumentsTableLayoutPending();
    this.applyDocumentFilter(this.collectService.documentCurrency || 'Moneda', false);

    if (this.collectService.historicPartialPayment) {
      await this.collectService.findIsPaymentPartial(
        this.synchronizationServices.getDatabase(),
        this.collectService.collection.idClient
      );
    }

    this.resetDocumentsTableScroll();
    this.invalidateDocumentsTableLayoutCache();
    this.scheduleDocumentsTableLayoutSync(0, false);
  }

  private initializeDocumentCurrencyFilter(): void {
    const monedaOption = Array.isArray(this.collectService.currencyListDocument)
      ? this.collectService.currencyListDocument.find(c => c?.coCurrency === 'Moneda')
      : undefined;

    if (monedaOption) {
      this.collectService.currencySelectedDocument = monedaOption;
    }

    this.collectService.documentCurrency = 'Moneda';
    this.collectService.documentSalesCurrentPage = 0;
    this.applyDocumentFilter('Moneda');
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

  getIgtfList() {
    this.collectService.restoreCollectionIgtfFields();
    this.collectService.calculatePayment('', 0, true);
    this.cdr.detectChanges();
  }

  compareIgtfOptions = (first: IgtfList | null | undefined, second: IgtfList | null | undefined): boolean => {
    return this.collectService.compareIgtfOptions(first, second);
  };

  onChangeIgtf(event: any) {
    const selected = event?.detail?.value ?? event?.target?.value;
    if (selected) {
      this.collectService.igtfSelected = selected;
    }

    if (this.normalizeIgtfSelectionPrice() === 0) {
      this.collectService.separateIgtf = false;
    }

    this.collectService.syncCollectionIgtfFields();
    this.collectService.calculatePayment('', 0, true);
    this.refreshOpenDocumentAmountPaidIfNeeded();
    this.cdr.detectChanges();
  }

  private normalizeIgtfSelectionPrice(): number {
    const parsed = Number(this.collectService.igtfSelected?.price ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  separateIgtf() {
    this.collectService.handleSeparateIgtfToggle();
    this.refreshOpenDocumentAmountPaidIfNeeded();
    this.cdr.detectChanges();
    if (this.collectService.igtfSelected.price <= 0 && this.collectService.separateIgtf) {
      this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_IGTF_MAYOR0')!;
      this.alertMessageOpen = true;
    }
  }

  async calculateSaldo(index: number) {
    // No mutaciones: leer copias de los objetos para evitar tocar documentSalesView / documentSales / collectionDetails
    const docBackup = JSON.parse(JSON.stringify(this.collectService.documentSalesBackup?.[index] ?? {}));
    const doc = JSON.parse(JSON.stringify(this.collectService.documentSales?.[index] ?? {}));
    const docOriginal = JSON.parse(JSON.stringify(this.collectService.documentSalesView?.[index] ?? {}));

    // valores locales para construir resultado
    let newSaldo = "0";
    let newSaldoConversion = "0";
    let newSaldoView = "0";
    let newSaldoConversionView = "0";

    const commit = () => {
      this.saldo = newSaldo;
      this.saldoConversion = newSaldoConversion;


      if (this.collectService.collection.coCurrency == docOriginal.coCurrency) {
        this.saldoView = docOriginal.nuBalance;
        this.saldoConversionView = this.collectService.convertirMonto(docOriginal.nuBalance, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency);
        this.baseView = docOriginal.nuAmountBase;
        this.baseConversionView = this.collectService.convertirMonto(docOriginal.nuAmountBase, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency);
        this.discountView = docOriginal.nuAmountDiscount ?? 0;
        this.discountViewConversion = this.collectService.convertirMonto(docOriginal.nuAmountDiscount ?? 0, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency);
        this.ivaView = docOriginal.nuAmountTax ?? 0;
        this.ivaViewConversion = this.collectService.convertirMonto(docOriginal.nuAmountTax ?? 0, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency);
        this.totalView = docOriginal.nuAmountTotal ?? 0;
        this.totalViewConversion = this.collectService.convertirMonto(docOriginal.nuAmountTotal ?? 0, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency);
      } else {
        this.saldoConversionView = (docOriginal.nuBalance);
        this.saldoView = this.collectService.convertirMonto(docOriginal.nuBalance, this.collectService.collection.nuValueLocal, docOriginal.coCurrency);
        this.baseConversionView = (docOriginal.nuAmountBase);
        this.baseView = this.collectService.convertirMonto(docOriginal.nuAmountBase, this.collectService.collection.nuValueLocal, docOriginal.coCurrency);
        this.discountViewConversion = (docOriginal.nuAmountDiscount ?? 0);
        this.discountView = this.collectService.convertirMonto(docOriginal.nuAmountDiscount ?? 0, this.collectService.collection.nuValueLocal, docOriginal.coCurrency);
        this.ivaViewConversion = (docOriginal.nuAmountTax ?? 0);
        this.ivaView = this.collectService.convertirMonto(docOriginal.nuAmountTax ?? 0, this.collectService.collection.nuValueLocal, docOriginal.coCurrency);
        this.totalViewConversion = (docOriginal.nuAmountTotal ?? 0);
        this.totalView = this.collectService.convertirMonto(docOriginal.nuAmountTotal ?? 0, this.collectService.collection.nuValueLocal, docOriginal.coCurrency);
      }
      return true;
    };

    // Si no existe documento, salir sin tocar nada en servicios
    if (!doc || Object.keys(doc).length === 0) return commit();

    const formatDetail = (detail: any, backupVal = 0) => {
      const nuBalanceDoc = Number(detail?.nuBalanceDoc ?? backupVal);
      const nuBalanceDocConversion = Number(detail?.nuBalanceDocConversion ?? backupVal);
      const formattedBalance = this.currencyService.formatNumber(nuBalanceDoc);
      const formattedConversion = this.currencyService.formatNumber(nuBalanceDocConversion);
      return {
        newSaldo: formattedBalance,
        newSaldoConversion: formattedConversion,
        newSaldoView: formattedBalance,
        newSaldoConversionView: formattedConversion
      };
    };

    const backupBalance = Number(docBackup?.nuBalance ?? 0);

    if (!doc.isSave) {
      if (this.collectService.collection.stDelivery == this.collectService.COLLECT_STATUS_SAVED) {
        const indexCollectionDetail = doc.positionCollecDetails;
        const detail = JSON.parse(JSON.stringify(this.collectService.collection.collectionDetails?.[indexCollectionDetail] ?? null));
        if (detail) {
          ({ newSaldo, newSaldoConversion, newSaldoView, newSaldoConversionView } = formatDetail(detail));
        } else {
          newSaldo = this.currencyService.formatNumber(backupBalance);
          newSaldoView = this.currencyService.formatNumber(Number(docBackup?.nuBalance ?? 0));
          newSaldoConversion = this.currencyService.formatNumber(
            this.collectService.convertirMonto(backupBalance, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency)
          );
          newSaldoConversionView = this.currencyService.formatNumber(
            this.collectService.convertirMonto(Number(docBackup?.nuBalance ?? 0), this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency)
          );
        }
        return commit();
      } else {
        newSaldo = this.currencyService.formatNumber(backupBalance);
        newSaldoView = this.currencyService.formatNumber(Number(docBackup?.nuBalance ?? 0));
        newSaldoConversion = this.currencyService.formatNumber(
          this.collectService.convertirMonto(backupBalance, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency)
        );
        newSaldoConversionView = this.currencyService.formatNumber(
          this.collectService.convertirMonto(Number(docBackup?.nuBalance ?? 0), this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency)
        );
        return commit();
      }
    } else {
      const indexCollectionDetail = doc.positionCollecDetails;
      const detail = JSON.parse(JSON.stringify(this.collectService.collection.collectionDetails?.[indexCollectionDetail] ?? null));
      if (detail) {
        ({ newSaldo, newSaldoConversion, newSaldoView, newSaldoConversionView } = formatDetail(detail));
      } else {
        newSaldo = this.currencyService.formatNumber(0);
        newSaldoConversion = this.currencyService.formatNumber(0);
        newSaldoView = this.currencyService.formatNumber(0);
        newSaldoConversionView = this.currencyService.formatNumber(0);
      }
      return commit();
    }
  }

  private resolveDetailGrossBalance(
    detail: {
      nuBalanceDoc?: number;
      nuBalanceDocOriginal?: number;
      nuAmountDoc?: number;
    } | null | undefined,
    backup?: { nuBalance?: number },
    documentSaleOpen?: { nuBalance?: number },
  ): number {
    const candidates = [
      Number(detail?.nuBalanceDoc ?? 0),
      Number(detail?.nuBalanceDocOriginal ?? 0),
      Number(backup?.nuBalance ?? 0),
      Number(documentSaleOpen?.nuBalance ?? 0),
      Number(detail?.nuAmountDoc ?? 0),
    ];
    return candidates.find(value => Number.isFinite(value) && value > 0) ?? 0;
  }

  private isPersistedDocumentOpen(index: number): boolean {
    const cs = this.collectService;
    const pos = cs.documentSaleOpen?.positionCollecDetails
      ?? cs.documentSales[index]?.positionCollecDetails;
    const detail = Number.isInteger(pos)
      ? cs.collection.collectionDetails?.[pos as number]
      : undefined;
    return cs.documentSaleOpen?.isSave === true
      || cs.documentSales[index]?.isSave === true
      || detail?.isSave === true;
  }

  private resolveOpenDocumentGrossBalance(index: number): number {
    const backup = this.collectService.documentSalesBackup[index];
    const pos = this.collectService.documentSaleOpen?.positionCollecDetails
      ?? this.collectService.documentSales[index]?.positionCollecDetails;
    const detail = Number.isInteger(pos)
      ? this.collectService.collection.collectionDetails?.[pos as number]
      : undefined;
    return this.resolveDetailGrossBalance(
      detail,
      backup,
      this.collectService.documentSaleOpen,
    );
  }

  private resolveOpenDocumentPaymentParams(index: number): {
    grossBalance: number;
    nuAmountDiscount?: number;
    nuAmountCollectDiscount?: number;
    nuAmountRetention?: number;
    nuAmountRetention2?: number;
  } {
    const cs = this.collectService;
    const grossBalance = this.resolveOpenDocumentGrossBalance(index);
    const pos = cs.documentSaleOpen?.positionCollecDetails
      ?? cs.documentSales[index]?.positionCollecDetails;
    const detail = Number.isInteger(pos)
      ? cs.collection.collectionDetails?.[pos as number]
      : undefined;
    const liveRetentions = this.resolveOpenDocumentLiveRetentionTotals();

    return {
      grossBalance,
      nuAmountDiscount: detail?.nuAmountDiscount,
      nuAmountCollectDiscount: detail?.nuAmountCollectDiscount,
      nuAmountRetention: liveRetentions.retention,
      nuAmountRetention2: liveRetentions.retention2,
    };
  }

  private resolveOpenDocumentLiveRetentionTotals(): {
    retention: number;
    retention2: number;
  } {
    if (this.documentRetentionLines.length > 0) {
      const total = this.getDocumentRetentionTotal();
      return { retention: total, retention2: 0 };
    }

    const cs = this.collectService;
    return {
      retention: Number(cs.documentSaleOpen?.nuAmountRetention ?? 0),
      retention2: Number(cs.documentSaleOpen?.nuAmountRetention2 ?? 0),
    };
  }

  private resolveOpenDocumentPayment(index: number) {
    return this.collectService.resolveDocumentPaymentAmount(
      this.resolveOpenDocumentPaymentParams(index),
    );
  }

  private resolveOpenDocumentNetAmountToPay(index: number): number {
    return this.resolveOpenDocumentPayment(index).netAfterDeductions;
  }

  private resolveOpenDocumentIgtfBase(index: number): number {
    return this.resolveOpenDocumentPayment(index).igtfBase;
  }

  private resolveOpenDocumentAmountToPay(index: number): number {
    return this.resolveOpenDocumentPayment(index).amountToPay;
  }

  private resolveOpenDocumentMaxAmountToPay(index: number): number {
    return this.resolveOpenDocumentAmountToPay(index);
  }

  private resolveOpenDocumentMaxRetentionAllowed(index: number): number {
    const cs = this.collectService;
    const grossBalance = this.resolveOpenDocumentGrossBalance(index);
    const pos = cs.documentSaleOpen?.positionCollecDetails
      ?? cs.documentSales[index]?.positionCollecDetails;
    const detail = Number.isInteger(pos)
      ? cs.collection.collectionDetails?.[pos as number]
      : undefined;
    const otherDeductions = Number(detail?.nuAmountDiscount ?? 0)
      + Number(detail?.nuAmountCollectDiscount ?? 0);
    return Math.max(0, grossBalance - otherDeductions);
  }

  private isCollectRetentionEntryInProgress(): boolean {
    for (const inFlight of this.collectRetentionKeyInFlightMap.values()) {
      if (inFlight) {
        return true;
      }
    }
    return false;
  }

  private exceedsMaxAmountToPay(amountPaid: number, maxAmountToPay: number): boolean {
    return Math.abs(Number(amountPaid ?? 0)) > Math.abs(maxAmountToPay) + 0.01;
  }

  private syncOpenDocumentAmountPaidWithRetentions(index: number): void {
    const cs = this.collectService;
    if (index < 0 || cs.coTypeModule === '2' || cs.isPaymentPartial) {
      return;
    }

    const openDoc = cs.documentSaleOpen;
    const hasActiveRetentions = this.documentRetentionLines.length > 0
      || this.getDocumentRetentionTotal() > 0
      || Number(openDoc?.nuAmountRetention ?? 0) > 0
      || Number(openDoc?.nuAmountRetention2 ?? 0) > 0;
    if (!hasActiveRetentions) {
      return;
    }

    if (!this.validateOpenDocumentRetentionTotals(false)) {
      return;
    }

    this.recalculateOpenDocumentAmountAndIgtf(index);
  }

  private validateOpenDocumentRetentionTotals(showAlert: boolean = false): boolean {
    const index = this.collectService.indexDocumentSaleOpen;
    if (index < 0 || !this.collectService.retencion) {
      return true;
    }

    const cs = this.collectService;
    const liveRetentions = this.resolveOpenDocumentLiveRetentionTotals();
    const retentionIva = liveRetentions.retention;
    const retentionIslr = liveRetentions.retention2;
    const retentionSum = retentionIva + retentionIslr;
    if (retentionSum <= 0) {
      return true;
    }

    const maxRetentionAllowed = this.resolveOpenDocumentMaxRetentionAllowed(index);
    if (retentionSum <= maxRetentionAllowed + 0.01) {
      return true;
    }

    cs.mensaje = cs.collectionTags.get('COB_MSJ_PAY_MAYOR_DOCAMOUNT')
      ?? 'La suma de retenciones no puede superar el saldo del documento';
    if (showAlert) {
      this.alertMessageOpen = true;
    }
    this.disabledSaveButton = true;
    return false;
  }

  private recalculateOpenDocumentAmountAndIgtf(index: number): void {
    if (index < 0) {
      return;
    }

    const cs = this.collectService;
    if (cs.coTypeModule === '2') {
      this.setAmountTotal();
      return;
    }

    if (cs.isPaymentPartial) {
      return;
    }

    const payment = this.resolveOpenDocumentPayment(index);
    this.applyDocumentAmountPaidDisplay(payment);
    this.syncDocumentAmountPaidState(index, cs.amountPaid);
    cs.amountPaid = this.currencyService.cleanFormattedNumber(
      this.currencyService.formatNumber(cs.amountPaid),
    );
    this.centsAmountPaid = Math.round((cs.amountPaid ?? 0) * this.centsFactor());
    this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
  }

  private applyDocumentAmountPaidDisplay(payment: {
    netAfterDeductions: number;
    igtfBase: number;
    igtfAmount: number;
    amountToPay: number;
  }): void {
    const cs = this.collectService;
    const amountToApply = cs.isPaymentPartial
      ? payment.netAfterDeductions
      : payment.amountToPay;
    const factor = this.centsFactor();

    cs.amountPaid = amountToApply;
    cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(
      this.currencyService.formatNumber(amountToApply),
    );
    this.syncDocumentOpenIgtfAmount(payment.igtfBase, payment.igtfAmount);
    this.centsAmountPaid = Math.round((amountToApply ?? 0) * factor);
    this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
  }

  private syncDocumentOpenIgtfAmount(igtfBase: number, igtfAmount?: number): void {
    const cs = this.collectService;
    if (!cs.documentSaleOpen || !cs.shouldApplyIgtfToCollection()) {
      return;
    }

    cs.documentSaleOpen.igtfAmount = igtfAmount ?? cs.resolveDocumentIgtfAmount(igtfBase);
  }

  private syncAmountPaidDisplayForOpen(index: number): void {
    const cs = this.collectService;
    if (cs.coTypeModule === '2') {
      cs.amountPaidRetention = this.currencyService.cleanFormattedNumber(
        this.currencyService.formatNumber(
          Number(cs.documentSaleOpen?.nuAmountRetention ?? 0)
          + Number(cs.documentSaleOpen?.nuAmountRetention2 ?? 0),
        ),
      );
      return;
    }

    if (cs.isPaymentPartial) {
      this.syncPersistedPartialPaymentAmount(index);
      return;
    }

    if (this.isPersistedDocumentOpen(index)) {
      this.syncPersistedFullPaymentAmount(index);
      return;
    }

    const payment = this.resolveOpenDocumentPayment(index);
    this.applyDocumentAmountPaidDisplay(payment);
    this.syncDocumentAmountPaidState(index, cs.amountPaid);
  }

  private syncDocumentAmountPaidState(index: number, amountToApply: number): void {
    const cs = this.collectService;
    if (cs.documentSaleOpen) {
      cs.documentSaleOpen.nuAmountPaid = amountToApply;
    }
    if (index >= 0) {
      cs.documentSales[index].nuAmountPaid = amountToApply;
      cs.documentSalesBackup[index].nuAmountPaid = amountToApply;
    }
  }

  private getDocumentDetailDeductions(detail: {
    nuAmountDiscount?: number;
    nuAmountCollectDiscount?: number;
    nuAmountRetention?: number;
    nuAmountRetention2?: number;
  } | null | undefined): number {
    if (!detail) {
      return 0;
    }
    return Number(detail.nuAmountDiscount ?? 0)
      + Number(detail.nuAmountCollectDiscount ?? 0)
      + Number(detail.nuAmountRetention ?? 0)
      + Number(detail.nuAmountRetention2 ?? 0);
  }

  private resolveSavedDetailNuAmountPaid(
    detail: {
      nuAmountPaid?: number;
      nuBalanceDoc?: number;
      nuAmountDiscount?: number;
      nuAmountCollectDiscount?: number;
      nuAmountRetention?: number;
      nuAmountRetention2?: number;
    } | null | undefined,
    backupBalance: number,
  ): number {
    if (!detail) {
      return Number(backupBalance ?? 0);
    }
    const balance = this.resolveDetailGrossBalance(detail, { nuBalance: backupBalance });
    const deductions = this.getDocumentDetailDeductions(detail);
    const expectedNet = Math.max(0, balance - deductions);
    const igtfBase = this.collectService.getDocumentIgtfBase(detail, balance);

    const persistedPaid = Number(detail.nuAmountPaid);
    if (Number.isFinite(persistedPaid) && persistedPaid > 0) {
      if (deductions > 0 && persistedPaid >= balance) {
        return expectedNet;
      }
      if (deductions > 0 && persistedPaid <= deductions) {
        return expectedNet;
      }
      if (Math.abs(persistedPaid - expectedNet) < 0.01) {
        return expectedNet;
      }
      if (persistedPaid < balance) {
        return this.collectService.normalizeDocumentNetAmountFromPaid(
          persistedPaid,
          expectedNet,
          igtfBase,
        );
      }
    }
    return expectedNet;
  }

  private resolveSavedFullPaymentAmountForOpen(
    index: number,
    positionCollecDetails?: number,
  ): number {
    const pos = positionCollecDetails
      ?? this.collectService.documentSaleOpen?.positionCollecDetails
      ?? this.collectService.documentSales[index]?.positionCollecDetails;
    const detail = Number.isInteger(pos)
      ? this.collectService.collection.collectionDetails?.[pos as number]
      : undefined;
    const doc = this.collectService.documentSales[index];
    const backup = this.collectService.documentSalesBackup[index];
    const balance = this.resolveDetailGrossBalance(
      detail,
      backup,
      this.collectService.documentSaleOpen,
    );
    const deductions = this.getDocumentDetailDeductions({
      nuAmountDiscount: detail?.nuAmountDiscount,
      nuAmountCollectDiscount: detail?.nuAmountCollectDiscount,
      nuAmountRetention: detail?.nuAmountRetention ?? doc?.nuAmountRetention,
      nuAmountRetention2: detail?.nuAmountRetention2 ?? doc?.nuAmountRetention2,
    });
    const expectedNet = Math.max(0, balance - deductions);
    const igtfBase = this.collectService.getDocumentIgtfBase(detail, balance);

    const fromDoc = Number(doc?.nuAmountPaid ?? 0);
    if (doc?.isSave && fromDoc > 0 && fromDoc <= deductions && deductions > 0) {
      return expectedNet;
    }
    if (doc?.isSave && fromDoc > 0 && (deductions === 0 || fromDoc < balance)) {
      return this.collectService.normalizeDocumentNetAmountFromPaid(fromDoc, expectedNet, igtfBase);
    }

    const fromBackup = Number(backup?.nuAmountPaid ?? 0);
    if (backup?.isSave && fromBackup > 0 && fromBackup <= deductions && deductions > 0) {
      return expectedNet;
    }
    if (backup?.isSave && fromBackup > 0 && (deductions === 0 || fromBackup < balance)) {
      return this.collectService.normalizeDocumentNetAmountFromPaid(fromBackup, expectedNet, igtfBase);
    }

    const fromCurrent = Number(this.collectService.amountPaid ?? 0);
    if (fromCurrent > 0 && fromCurrent <= deductions && deductions > 0) {
      return expectedNet;
    }
    if (fromCurrent > 0 && (deductions === 0 || fromCurrent < balance)) {
      return this.collectService.normalizeDocumentNetAmountFromPaid(fromCurrent, expectedNet, igtfBase);
    }

    return this.resolveSavedDetailNuAmountPaid(detail, Number(backup?.nuBalance ?? 0));
  }

  private syncPersistedFullPaymentAmount(index: number): void {
    if (this.collectService.isPaymentPartial) {
      return;
    }
    const payment = this.resolveOpenDocumentPayment(index);
    this.applyDocumentAmountPaidDisplay(payment);
    this.syncDocumentAmountPaidState(index, this.collectService.amountPaid);
  }

  private resolveDocumentPaymentPartialFlag(
    detail?: { inPaymentPartial?: boolean | string | null; isSave?: boolean },
    doc?: { inPaymentPartial?: boolean | string | null; isSave?: boolean },
  ): boolean {
    if (detail != null) {
      return detail.inPaymentPartial === true
        || String(detail.inPaymentPartial ?? '').toLowerCase() === 'true';
    }
    return doc?.inPaymentPartial === true
      || String(doc?.inPaymentPartial ?? '').toLowerCase() === 'true';
  }

  private resolvePartialPaymentForOpenDocument(
    detail?: { inPaymentPartial?: boolean | string | null; isSave?: boolean },
    doc?: { inPaymentPartial?: boolean | string | null; isSave?: boolean },
  ): boolean {
    const cs = this.collectService;
    const isPersisted = detail?.isSave === true || doc?.isSave === true;
    if (isPersisted) {
      return this.resolveDocumentPaymentPartialFlag(detail, doc);
    }
    if (cs.isChangePaymentPartialPersistence) {
      return cs.isPaymentPartial;
    }
    return cs.alwaysPartialPayment;
  }

  private restoreCollectionPartialPaymentPreference(): void {
    const cs = this.collectService;
    if (cs.isChangePaymentPartialPersistence) {
      return;
    }
    cs.isPaymentPartial = cs.alwaysPartialPayment;
  }

  private applyDefaultPartialPaymentIfNeeded(index: number): void {
    const cs = this.collectService;
    if (!cs.alwaysPartialPayment || cs.isChangePaymentPartialPersistence) {
      return;
    }

    const pos = cs.documentSaleOpen?.positionCollecDetails;
    if (index < 0 || !Number.isInteger(pos)) {
      cs.isPaymentPartial = true;
      return;
    }

    this.syncDocumentPaymentPartialState(index, pos as number, true);
    cs.amountPaid = 0;
    this.valuePartialPayment = 0;
    this.centsAmountPaid = 0;
    this.displayAmountPaid = this.formatFromCents(0);
    this.disabledSaveButton = true;
  }

  private syncDocumentPaymentPartialState(
    index: number,
    positionCollecDetails: number,
    isPaymentPartial: boolean,
  ): void {
    this.collectService.isPaymentPartial = isPaymentPartial;
    this.collectService.documentSales[index].inPaymentPartial = isPaymentPartial;
    this.collectService.documentSalesBackup[index].inPaymentPartial = isPaymentPartial;
    if (this.collectService.documentSalesView[index]) {
      this.collectService.documentSalesView[index].inPaymentPartial = isPaymentPartial;
    }
    const detail = this.collectService.collection.collectionDetails?.[positionCollecDetails];
    if (detail) {
      detail.inPaymentPartial = isPaymentPartial;
    }
    if (this.collectService.documentSaleOpen) {
      this.collectService.documentSaleOpen.inPaymentPartial = isPaymentPartial;
    }
  }

  private resolvePartialPaymentAmountForOpen(index: number, positionCollecDetails?: number): number {
    const pos = positionCollecDetails
      ?? this.collectService.documentSaleOpen?.positionCollecDetails
      ?? this.collectService.documentSales[index]?.positionCollecDetails;
    const detail = Number.isInteger(pos)
      ? this.collectService.collection.collectionDetails?.[pos as number]
      : undefined;
    const doc = this.collectService.documentSales[index];
    const backup = this.collectService.documentSalesBackup[index];
    const isPartialPersisted = this.resolveDocumentPaymentPartialFlag(detail, doc);

    if (!isPartialPersisted) {
      return 0;
    }

    const docBalance = Number(
      detail?.nuBalanceDoc ?? backup?.nuBalance ?? doc?.nuBalance ?? 0,
    );
    const isPartialAmount = (amount: number): boolean =>
      amount > 0 && (docBalance <= 0 || amount < docBalance);

    const fromValue = Number(this.valuePartialPayment ?? 0);
    if (isPartialAmount(fromValue)) {
      return fromValue;
    }

    const fromDocSaved = Number(doc?.nuAmountPaid ?? 0);
    if (doc?.isSave && isPartialAmount(fromDocSaved)) {
      return fromDocSaved;
    }

    const fromBackupSaved = Number(backup?.nuAmountPaid ?? 0);
    if (backup?.isSave && isPartialAmount(fromBackupSaved)) {
      return fromBackupSaved;
    }

    const fromCents = (this.centsAmountPaid ?? 0) / this.centsFactor();
    if (isPartialAmount(fromCents)) {
      return fromCents;
    }

    const fromCurrent = Number(this.collectService.amountPaid ?? 0);
    if (isPartialAmount(fromCurrent)) {
      return fromCurrent;
    }

    const fromDetail = Number(detail?.nuAmountPaid ?? 0);
    if (
      (detail?.isSave === true || this.collectService.collection.stDelivery === 3)
      && isPartialAmount(fromDetail)
    ) {
      return fromDetail;
    }

    return 0;
  }

  private syncPersistedPartialPaymentAmount(index: number): void {
    if (!this.collectService.isPaymentPartial) {
      return;
    }
    const partialAmount = this.resolvePartialPaymentAmountForOpen(index);
    if (!(partialAmount > 0)) {
      return;
    }
    const factor = this.centsFactor();
    this.valuePartialPayment = partialAmount;
    this.collectService.amountPaid = partialAmount;
    if (this.collectService.documentSaleOpen) {
      this.collectService.documentSaleOpen.nuAmountPaid = partialAmount;
    }
    this.collectService.documentSales[index].nuAmountPaid = partialAmount;
    this.collectService.documentSalesBackup[index].nuAmountPaid = partialAmount;
    this.centsAmountPaid = Math.round(partialAmount * factor);
    this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
  }

  private syncPersistedCollectDiscountTotals(positionCollecDetails: number): void {
    if (!this.collectService.userCanSelectCollectDiscount) {
      return;
    }
    const detail = this.collectService.collection.collectionDetails?.[positionCollecDetails];
    if (!detail) {
      return;
    }
    const total = Number(detail.nuAmountCollectDiscount ?? 0);
    this.collectService.totalCollectDiscounts = total;
    this.collectService.totalCollectDiscountsView = this.formatNumber(total);
    this.collectService.totalCollectDiscountsSelected = Number(detail.nuCollectDiscount ?? 0);
  }

  async calculateDocumentSaleOpen(index: number): Promise<boolean> {
    try {
      const cs = this.collectService;
      const cur = this.currencyService;
      const factor = this.centsFactor();


      // Trabajar sólo con copias para evitar mutar documentSales / documentSalesBackup / documentSalesView
      const docOrig = cs.documentSales?.[index];
      const backupOrig = cs.documentSalesBackup?.[index];
      const doc = docOrig ? JSON.parse(JSON.stringify(docOrig)) : null;
      const backup = backupOrig ? JSON.parse(JSON.stringify(backupOrig)) : null;
      const positionCollecDetails = doc?.positionCollecDetails ?? 0;
      const difFaltate = cs.collection.collectionDetails?.[positionCollecDetails]?.nuAmountDiscount ?? 0;
      const detailAtPos = cs.collection.collectionDetails?.[positionCollecDetails];

      cs.isPaymentPartial = this.resolvePartialPaymentForOpenDocument(detailAtPos, doc);

      if (!doc || !backup) {
        console.warn('calculateDocumentSaleOpen: documento o backup no encontrados, index=', index);
        return false;
      }

      // Asegurar campos numéricos sobre las copias
      cs.ensureNumber(doc, 'nuAmountBase');
      cs.ensureNumber(doc, 'nuAmountPaid');

      let nuAmountPaid = 0;
      let nuBalance = 0;
      let nuAmountRetention = 0;
      let nuAmountRetention2 = 0;
      let daVoucher = '';
      let nuVaucherRetention = '';
      let nuAmountDiscount = cs.collection.collectionDetails?.[positionCollecDetails]?.nuAmountDiscount ?? 0;

      if (cs.collection.stDelivery == 3) {
        const pos = doc.positionCollecDetails;
        const detail = cs.collection.collectionDetails?.[pos];

        if (detail) {
          nuAmountRetention = Number(detail.nuAmountRetention ?? 0);
          nuAmountRetention2 = Number(detail.nuAmountRetention2 ?? 0);

          if (cs.isPaymentPartial) {
            nuAmountPaid = this.resolvePartialPaymentAmountForOpen(index, pos);
          } else {
            nuAmountPaid = this.resolveSavedFullPaymentAmountForOpen(index, pos);
          }

          nuBalance = this.resolveDetailGrossBalance(detail, backup);
          daVoucher = detail.daVoucher ?? '';
          nuVaucherRetention = detail.nuVoucherRetention ?? '';
        } else {
          nuAmountRetention = 0;
          nuAmountRetention2 = 0;
          nuBalance = Number(backup.nuBalance ?? 0);
          nuAmountPaid = nuBalance;
        }
      } else {
        const pos = doc.positionCollecDetails;
        const saved = cs.documentSalesBackup?.[index]?.isSave;

        if (saved) {
          const detail = cs.collection.collectionDetails?.[pos];
          if (detail) {
            nuAmountRetention = Number(detail.nuAmountRetention ?? 0);
            nuAmountRetention2 = Number(detail.nuAmountRetention2 ?? 0);
            daVoucher = detail.daVoucher ?? '';
            nuVaucherRetention = detail.nuVoucherRetention ?? '';
            nuBalance = this.resolveDetailGrossBalance(detail, backup);

            if (cs.isPaymentPartial) {
              nuAmountPaid = this.resolvePartialPaymentAmountForOpen(index, pos);
            } else {
              nuAmountPaid = this.resolveSavedFullPaymentAmountForOpen(index, pos);
            }
          } else {
            nuBalance = Number(backup.nuBalance ?? 0);
            nuAmountPaid = nuBalance;
          }
        } else {
          const detail = cs.collection.collectionDetails?.[pos];
          const sumRet = detail
            ? this.getDocumentDetailDeductions(detail)
            : nuAmountDiscount
              + Number(cs.documentSaleOpen?.nuAmountRetention ?? 0)
              + Number(cs.documentSaleOpen?.nuAmountRetention2 ?? 0);

          nuAmountRetention = Number(detail?.nuAmountRetention ?? cs.documentSaleOpen?.nuAmountRetention ?? 0);
          nuAmountRetention2 = Number(detail?.nuAmountRetention2 ?? cs.documentSaleOpen?.nuAmountRetention2 ?? 0);

          nuBalance = Number(backup.nuBalance ?? 0);
          if (cs.isPaymentPartial) {
            nuAmountPaid = this.resolvePartialPaymentAmountForOpen(index, pos);
          } else {
            nuAmountPaid = nuBalance - sumRet;
          }

          nuVaucherRetention = detail?.nuVoucherRetention ?? cs.documentSaleOpen?.nuVaucherRetention ?? '';
          daVoucher = detail?.daVoucher ?? cs.documentSaleOpen?.daVoucher ?? '';
        }
      }

      // Actualizar estados dependientes (estas son propiedades del servicio, no clones)
      cs.amountPaid = nuAmountPaid;
      this.centsAmountPaid = Math.round((cs.amountPaid ?? 0) * factor);
      this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
      this.displayDiscount = this.formatNumber(nuAmountDiscount);
      this.displayRetention = (nuAmountRetention ?? 0).toString();
      this.displayRetention2 = (nuAmountRetention2 ?? 0).toString();

      const nuAmountBase = Number(backup.nuAmountBase ?? 0);
      const nuAmountTotal = Number(backup.nuAmountTotal ?? 0);
      const nuAmountTax = Number(doc.nuAmountTax ?? 0);

      // Construir documentSaleOpen sin mutar otros objetos
      cs.documentSaleOpen = {
        idDocument: backup.idDocument,
        idClient: backup.idClient,
        coClient: backup.coClient,
        idDocumentSaleType: backup.idDocumentSaleType,
        coDocumentSaleType: backup.coDocumentSaleType,
        daDocument: backup.daDocument,
        daDueDate: backup.daDueDate,
        nuAmountBase: cur.cleanFormattedNumber(cur.formatNumber(nuAmountBase)),
        nuAmountDiscount: backup.nuAmountDiscount,
        nuAmountTax: cur.cleanFormattedNumber(cur.formatNumber(nuAmountTax)),
        nuAmountTotal: cur.cleanFormattedNumber(cur.formatNumber(nuAmountTotal)),
        nuAmountPaid: cur.cleanFormattedNumber(cur.formatNumber(nuAmountPaid)),
        nuBalance: cur.cleanFormattedNumber(cur.formatNumber(nuBalance)),
        coCurrency: doc.coCurrency,
        idCurrency: doc.idCurrency,
        nuDocument: doc.nuDocument,
        txComment: doc.txComment,
        coDocument: doc.coDocument,
        coCollection: cs.collection.coCollection,
        nuValueLocal: cs.collection.nuValueLocal,
        stDocumentSale: doc.stDocumentSale,
        coEnterprise: doc.coEnterprise,
        idEnterprise: doc.idEnterprise,
        naType: doc.naType,
        isSelected: doc.isSelected,
        positionCollecDetails: doc.positionCollecDetails,
        nuAmountRetention: Number(nuAmountRetention),
        nuAmountRetention2: Number(nuAmountRetention2),
        daVoucher: daVoucher,
        nuVaucherRetention: nuVaucherRetention,
        igtfAmount: doc.igtfAmount,
        txConversion: doc.txConversion,
        inPaymentPartial: cs.isPaymentPartial,
        historicPaymentPartial: doc.historicPaymentPartial,
        isSave: doc.isSave,
        colorRow: doc.colorRow,
        missingRetention: doc.missingRetention,
        daUpdate: doc.daUpdate,
      };

      if (cs.retencion) {
        cs.validNuRetention = (nuVaucherRetention ?? '').toString().length > 0;
      } else {
        cs.validNuRetention = false;
      }

      this.displayRetention = this.formatNumber(Number(this.displayRetention));
      this.displayRetention2 = this.formatNumber(Number(this.displayRetention2));
      if (cs.isPaymentPartial) {
        this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
      } else {
        this.displayAmountPaid = this.formatNumber(nuAmountPaid);
      }
      return true;
    } catch (err) {
      console.error('calculateDocumentSaleOpen error:', err);
      return false;
    }
  }

  async openDocumentSale(index: number, e: Event) {
    if (index < 0) return;
    const factor = this.centsFactor();

    this.indexDocumentSaleOpen = index;
    if (this.collectService.documentSales[index].isSelected) {

      const positionCollecDetails = this.collectService.documentSales[index].positionCollecDetails ?? index;

      // Mejor manejo: si es null o undefined asignar string vacío, si no asignar su valor
      const detail = this.collectService.collection.collectionDetails[positionCollecDetails];
      const comment = detail?.discountComment ?? '';
      const doc = this.collectService.documentSales[index];
      this.discountComment = comment;

      const openDetail = this.collectService.collection.collectionDetails[positionCollecDetails];
      this.collectService.missingRetentionValue = openDetail?.missingRetention === true;

      this.disabledSaveButton = true;
      this.collectService.documentSaleOpen = new DocumentSale;
      let voucherRetentionValue = "";
      let daVoucherValue = "";
      if (this.collectService.documentSales[index].isSave) {
        const savedDetailPos = this.collectService.documentSales[index].positionCollecDetails;
        const savedDetail = this.collectService.collection.collectionDetails[savedDetailPos];
        const isPaymentPartial = this.resolvePartialPaymentForOpenDocument(
          savedDetail,
          this.collectService.documentSales[index],
        );
        this.syncDocumentPaymentPartialState(index, savedDetailPos, isPaymentPartial);
        this.collectService.nuBalance = savedDetail.nuBalanceDoc;
        voucherRetentionValue = savedDetail.nuVoucherRetention;
        daVoucherValue = savedDetail.daVoucher!;
        const docBalance = Number(savedDetail.nuBalanceDoc ?? this.collectService.documentSales[index].nuBalance ?? 0);
        const savedPartialFromDoc = Number(this.collectService.documentSales[index]?.nuAmountPaid ?? 0);
        const savedPartialFromDetail = Number(savedDetail.nuAmountPaid ?? 0);
        if (isPaymentPartial && savedPartialFromDoc > 0 && savedPartialFromDoc < docBalance) {
          this.valuePartialPayment = savedPartialFromDoc;
        } else if (isPaymentPartial && savedPartialFromDetail > 0 && savedPartialFromDetail < docBalance) {
          this.valuePartialPayment = savedPartialFromDetail;
        } else {
          this.valuePartialPayment = 0;
        }
      } else {
        this.collectService.nuBalance = this.collectService.documentSales[index].nuBalance;
        const defaultPartial = this.resolvePartialPaymentForOpenDocument(
          this.collectService.collection.collectionDetails[positionCollecDetails],
          this.collectService.documentSales[index],
        );
        this.syncDocumentPaymentPartialState(index, positionCollecDetails, defaultPartial);
        this.valuePartialPayment = 0;
      }

      if (this.collectService.userCanSelectCollectDiscount) {
        if (this.collectService.collection.collectionDetails[positionCollecDetails]?.collectionDetailDiscounts &&
          this.collectService.collection.collectionDetails[positionCollecDetails].collectionDetailDiscounts?.length > 0) {
          const persistedDiscounts = this.collectService.collection.collectionDetails[positionCollecDetails].collectionDetailDiscounts!;
          this.manualCollectDiscountAmount = this.getManualCollectDiscountFromDetails(persistedDiscounts);
          this.manualCollectDiscountAmountBackup = this.manualCollectDiscountAmount;
          this.centsManualCollectDiscount = undefined;
          this.syncManualCollectDiscountInput();
          const selectedIds = persistedDiscounts
            .map(cdd => Number(cdd.idCollectDiscount))
            .filter(id => !Number.isNaN(id) && id > 0);
          this.collectService.selectedCollectDiscounts = selectedIds;
          this.setCollectionDetailDiscounts(positionCollecDetails, selectedIds);
        } else {
          this.manualCollectDiscountAmount = 0;
          this.manualCollectDiscountAmountBackup = 0;
          this.centsManualCollectDiscount = 0;
          this.displayManualCollectDiscount = '';
        }
      }

      await this.calculateSaldo(index);
      await this.calculateDocumentSaleOpen(index);
      this.syncPersistedCollectDiscountTotals(positionCollecDetails);

      if (this.collectService.retencion) {
        await this.ensureCollectRetentionsCatalog();
        await this.ensurePersistedDetailRetentionsLoaded(positionCollecDetails);
      }

      // Asignar el valor de nuVaucherRetention y daVoucher después de crear documentSaleOpen
      if (voucherRetentionValue !== undefined) {
        this.collectService.documentSaleOpen.nuVaucherRetention = voucherRetentionValue;
      }
      if (daVoucherValue !== undefined && daVoucherValue !== null && String(daVoucherValue).trim() !== '') {
        this.daVoucher = String(daVoucherValue).split('T')[0];
        this.collectService.documentSaleOpen.daVoucher = this.daVoucher;
      }

      if (this.collectService.collection.stDelivery == 3) {
        //este cobro fue guardado, se debe colocar los datos del documento como fueron guardados(si es q hubo alguna modificacion)
        const detail = this.collectService.collection.collectionDetails.find(
          d => d.coDocument == this.collectService.documentSaleOpen.coDocument && d.isSave
        );
        if (detail) {
          this.collectService.documentSaleOpen.nuAmountRetention = detail.nuAmountRetention;
          this.collectService.documentSaleOpen.nuAmountRetention2 = detail.nuAmountRetention2;
          this.collectService.documentSaleOpen.daVoucher = detail.daVoucher == null ? "" : detail.daVoucher;
          this.daVoucher = this.collectService.documentSaleOpen.daVoucher
            ? String(this.collectService.documentSaleOpen.daVoucher).split('T')[0]
            : '';
          this.collectService.documentSaleOpen.nuVaucherRetention = detail.nuVoucherRetention;
          this.collectService.documentSaleOpen.inPaymentPartial = detail.inPaymentPartial;
          this.collectService.documentSaleOpen.nuBalance = detail.nuBalanceDoc;
          this.collectService.nuBalance = this.collectService.documentSalesBackup[index].nuBalance;
          this.collectService.isPaymentPartial = this.resolvePartialPaymentForOpenDocument(
            detail,
            this.collectService.documentSales[index],
          );
          this.collectService.missingRetentionValue = detail.missingRetention === true;

        } else {
          this.collectService.nuBalance = this.collectService.documentSaleOpen.nuBalance;
        }

      }

      if (this.collectService.retencion) {
        this.hydrateDocumentRetentionLines(positionCollecDetails);
      }

      if (this.collectService.documentSaleOpen.daVoucher != "")
        this.collectService.validateDaVoucher = true

      this.collectService.ensureNumber(this.collectService.documentSaleOpen, 'nuAmountBase');
      this.collectService.ensureNumber(this.collectService.documentSaleOpen, 'nuAmountRetention');
      this.collectService.ensureNumber(this.collectService.documentSaleOpen, 'nuAmountRetention2');
      this.collectService.ensureNumber(this.collectService.documentSaleOpen, 'nuAmountTax');

      this.collectService.indexDocumentSaleOpen = index;

      if (this.collectService.collection.collectionDetails.length > 0) {

        const i = this.collectService.collection.collectionDetails.findIndex(
          d => d.coDocument == this.collectService.documentSaleOpen.coDocument
        );
        if (i !== -1) {
          const detailAtPos = this.collectService.collection.collectionDetails[i];
          const isPaymentPartial = this.resolvePartialPaymentForOpenDocument(
            detailAtPos,
            this.collectService.documentSales[index],
          );
          this.syncDocumentPaymentPartialState(index, i, isPaymentPartial);
          this.collectService.documentSaleOpen.positionCollecDetails = i;
        }
      } else
        this.collectService.isPaymentPartial = this.collectService.alwaysPartialPayment;

      this.syncAmountPaidDisplayForOpen(index);
      // Force UI update after saldo y nuVaucherRetention
      this.cdr.detectChanges();
      this.collectService.ensureCurrencyConversionReady();
      this.collectService.cobrosComponent = false;
      this.collectService.isOpen = true;

      if (this.collectService.userCanSelectCollectDiscount)
        this.checkCollectDiscount();
    }

    if (this.collectService.retencion)
      this.validateNuVaucherRetention(false);
    else
      this.collectService.validNuRetention = true;

    const isReopeningSavedPartial = this.collectService.documentSaleOpen?.isSave === true
      && this.collectService.isPaymentPartial;

    if (isReopeningSavedPartial) {
      this.syncPersistedPartialPaymentAmount(index);
    } else {
      this.applyDefaultPartialPaymentIfNeeded(index);
    }
  }

  checkCollectDiscount() {
    const idxDetail = Number.isInteger(this.collectService.documentSaleOpen?.positionCollecDetails)
      ? this.collectService.documentSaleOpen!.positionCollecDetails as number
      : this.collectService.collection.collectionDetails.findIndex(
        d => d.coDocument === this.collectService.documentSaleOpen?.coDocument
      );

    if (idxDetail === -1) {
      this.collectService.selectedCollectDiscounts = [];
      this.manualCollectDiscountAmount = 0;
      this.manualCollectDiscountAmountBackup = 0;
      this.centsManualCollectDiscount = 0;
      this.displayManualCollectDiscount = '';
      return;
    }

    const detail = this.collectService.collection.collectionDetails[idxDetail];
    const discounts = Array.isArray(detail?.collectionDetailDiscounts)
      ? detail.collectionDetailDiscounts
      : [];
    this.manualCollectDiscountAmount = this.getManualCollectDiscountFromDetails(discounts);
    this.manualCollectDiscountAmountBackup = this.manualCollectDiscountAmount;
    this.centsManualCollectDiscount = undefined;
    this.syncManualCollectDiscountInput();

    const ids = discounts
      .map(d => Number(d.idCollectDiscount))
      .filter(id => !Number.isNaN(id) && id > 0);
    this.collectService.selectedCollectDiscounts = Array.from(new Set(ids));
  }

  selectDocumentSale(documentSale: DocumentSale, indexDocumentSale: number, event: any) {
    if (indexDocumentSale < 0) return;
    documentSale.isSelected = event.detail.checked;
    console.log(indexDocumentSale);
    if (documentSale.nuBalance < 0 && this.collectService.collection.collectionDetails.length == 0 && this.collectService.coTypeModule == '0') {
      /*     if (documentSale.coDocumentSaleType == "NC" && this.collectService.collection.collectionDetails.length == 0) {
       */

      //NO PERMITO SELECCIONAR DE PRIMERO UN DOCUMENTO DE TIPO NOTA DE CREDITO, ENVIO MENSAJE?
      if (documentSale.isSelected) {
        this.collectService.collection.collectionDetails.splice(1, 1);
        setTimeout(() => {
          documentSale.isSelected = false;
        }, 300);

        this.alertMessageOpen = true;
        this.collectService.mensaje = "El primer documento a seleccionar no puede tener monto negativo";
      }

    } else if (documentSale.isSelected) {
      this.collectService.documentSales[indexDocumentSale].isSelected = true;
      this.collectService.documentSalesBackup[indexDocumentSale].isSelected = true;
      this.collectService.documentSalesView[indexDocumentSale].isSelected = true;
      this.collectService.haveDocumentSale = true;

      if (this.collectService.alwaysPartialPayment) {
        this.collectService.documentSales[indexDocumentSale].inPaymentPartial = true;
        this.collectService.documentSalesBackup[indexDocumentSale].inPaymentPartial = true;
        this.collectService.documentSalesView[indexDocumentSale].inPaymentPartial = true;
        if (!this.collectService.isChangePaymentPartialPersistence) {
          this.collectService.isPaymentPartial = true;
        }
      }

      this.initCollectionDetail(documentSale, indexDocumentSale);
    } else {
      //se reinician los valores del documento
      this.collectService.documentSales[indexDocumentSale].daDueDate = "";
      this.collectService.documentSales[indexDocumentSale].nuVaucherRetention = "";
      this.collectService.documentSales[indexDocumentSale].nuAmountPaid = this.collectService.documentSales[indexDocumentSale].nuBalance;
      this.collectService.documentSales[indexDocumentSale].nuAmountRetention = 0;
      this.collectService.documentSales[indexDocumentSale].nuAmountRetention2 = 0;
      this.collectService.documentSales[indexDocumentSale].isSelected = false;
      this.collectService.documentSales[indexDocumentSale].isSave = false;
      this.collectService.documentSalesView[indexDocumentSale].isSave = false;

      this.collectService.documentSalesBackup[indexDocumentSale] = JSON.parse(JSON.stringify(this.collectService.documentSales[indexDocumentSale]));
      let pos;
      pos = this.collectService.documentSales[indexDocumentSale].positionCollecDetails;
      console.log(pos);
      // Eliminar solo el elemento en la posición `pos` con validación de rangos
      if (Number.isInteger(pos) && pos >= 0 && pos < this.collectService.collection.collectionDetails.length) {
        this.collectService.collection.collectionDetails.splice(pos, 1);
      } else {
        console.warn('splice: posición inválida', pos);
      }
      //Reordeno los positionCollecDetails
      console.log(this.collectService.collection.collectionDetails)

      for (let i = 0; i < this.collectService.documentSales.length; i++) {
        if (this.collectService.documentSales[i].positionCollecDetails > pos) {
          this.collectService.documentSales[i].positionCollecDetails -= 1;
          this.collectService.documentSalesBackup[i].positionCollecDetails -= 1;
        }
        console.log(this.collectService.documentSales[i].positionCollecDetails);
      }

      this.collectService.documentSales[indexDocumentSale].positionCollecDetails = -1;
      this.collectService.documentSalesBackup[indexDocumentSale].positionCollecDetails = -1;

      this.collectService.documentSales[indexDocumentSale].inPaymentPartial = false;
      this.collectService.documentSalesBackup[indexDocumentSale].inPaymentPartial = false;

      if (this.collectService.collection.collectionDetails.length == 0) {


        this.collectService.haveDocumentSale = false;
        this.collectService.disabledSelectCollectMethodDisabled = true;

        this.collectService.collection.collectionPayments = [] as CollectionPayment[];
        this.collectService.pagoEfectivo = [] as PagoEfectivo[];
        this.collectService.pagoCheque = [] as PagoCheque[];
        this.collectService.pagoDeposito = [] as PagoDeposito[];
        this.collectService.pagoTransferencia = [] as PagoTransferencia[];
        this.collectService.pagoOtros = [] as PagoOtros[];
        this.collectService.collection.nuAmountFinal = 0;
        this.collectService.montoTotalPagar = 0;
        this.collectService.montoTotalPagarConversion = 0;
        this.collectService.montoTotalPagado = 0;
        this.collectService.montoTotalPagadoConversion = 0;
        this.collectService.collection.nuDifference = 0;
        this.collectService.collection.nuDifferenceConversion = 0;

        this.collectService.bankAccountSelected = [] as BankAccount[];

        this.collectService.onCollectionValidToSend(false);
      }

      this.collectService.documentSales[indexDocumentSale].isSelected = false
      this.collectService.documentSalesBackup[indexDocumentSale].isSelected = false;
      this.collectService.documentSales[indexDocumentSale].isSave = false
      this.collectService.documentSalesBackup[indexDocumentSale].isSave = false;
      this.collectService.calculatePayment("", 0);
      this.cdr.detectChanges();

    }


  }

  async initCollectionDetail(documentSale: DocumentSale, id: number) {
    let nuAmountTotal = 0, nuAmountBalance = 0, nuAmountTotalConversion = 0, nuAmountBalanceConversion = 0;

    const coTypeDoc = documentSale.coDocumentSaleType;
    const nuValueLocalDoc = this.collectService.collection.nuValueLocal;
    let nuBalanceOriginal, nuBalanceOriginalConversion;

    if (documentSale.isSave) {
      //EL DOCUMENTO YA FUE GUARDADO, POR LO TANTO SE DEBEN USAR LOS MONTOS YA CONVERTIDOS Y GUARDADOS
      let positionCollecDetails = documentSale.positionCollecDetails;
      nuAmountBalance = this.collectService.collection.collectionDetails[positionCollecDetails].nuBalanceDoc;
      nuAmountBalanceConversion = this.collectService.collection.collectionDetails[positionCollecDetails].nuBalanceDocConversion;
      nuAmountTotal = this.collectService.collection.collectionDetails[positionCollecDetails].nuAmountDoc;
      nuAmountTotalConversion = this.collectService.collection.collectionDetails[positionCollecDetails].nuAmountDocConversion;
      nuBalanceOriginal = documentSale.nuBalance;
      nuBalanceOriginalConversion = this.collectService.convertirMonto(documentSale.nuBalance, this.collectService.collection.nuValueLocal, documentSale.coCurrency);
    } else {
      if (documentSale.coCurrency != this.collectService.collection.coCurrency) {
        //AL SER MONEDAS DIFERENTES, SE DEBE CONVETIR EL MONTO DEL DOCUMENTO A LA MONEDA DEL COBRO
        //Y LOS MONTOS "CONVERSION" QUEDAN LOS ORIGINALES DEL DOCUMENTO
        nuAmountBalance = this.collectService.convertirMonto(documentSale.nuBalance, this.collectService.collection.nuValueLocal, documentSale.coCurrency);
        nuAmountBalanceConversion = documentSale.nuBalance;
        nuAmountTotal = this.collectService.convertirMonto(documentSale.nuAmountTotal, this.collectService.collection.nuValueLocal, documentSale.coCurrency);
        nuAmountTotalConversion = documentSale.nuAmountTotal;
        nuBalanceOriginalConversion = documentSale.nuBalance;
        nuBalanceOriginal = this.collectService.convertirMonto(documentSale.nuBalance, this.collectService.collection.nuValueLocal, documentSale.coCurrency);
      } else {
        //AL SER LA MISMA MONEDA, LOS MONTOS QUEDAN IGUALES, SOLO SE CALCULAN LOS MONTOS CONVERSION
        nuAmountTotal = documentSale.nuAmountTotal;
        nuAmountBalance = documentSale.nuBalance;
        nuAmountBalanceConversion = this.collectService.convertirMonto(nuAmountBalance, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency);
        nuAmountTotalConversion = this.collectService.convertirMonto(nuAmountTotal, this.collectService.collection.nuValueLocal, this.collectService.collection.coCurrency);
        nuBalanceOriginal = documentSale.nuBalance;
        nuBalanceOriginalConversion = this.collectService.convertirMonto(documentSale.nuBalance, this.collectService.collection.nuValueLocal, documentSale.coCurrency);
      }
    }

    let inPaymentPartial = false;
    let missingRetention = false;
    if (this.collectService.coTypeModule != "2") {
      const open = this.collectService.documentSaleOpen;
      inPaymentPartial = this.collectService.alwaysPartialPayment;
      missingRetention = this.collectService.alwaysRetention || !!open?.missingRetention;
    }

    this.collectService.collection.collectionDetails.push({
      //idCollectionDetail: null,
      coCollection: this.collectService.collection.coCollection,
      coDocument: documentSale.coDocument.toString(),
      idDocument: documentSale.idDocument,
      inPaymentPartial: inPaymentPartial,
      nuVoucherRetention: "",
      nuAmountRetention: 0, //iva
      nuAmountRetention2: 0, //islr
      nuAmountRetentionConversion: 0, //iva
      nuAmountRetention2Conversion: 0, //islr
      nuAmountRetentionIslrConversion: 0, //islr
      nuAmountRetentionIvaConversion: 0, //iva
      nuAmountPaid: nuAmountBalance,
      nuAmountPaidConversion: nuAmountBalanceConversion,
      nuAmountDiscount: 0,
      nuAmountDiscountConversion: 0,
      nuAmountDoc: nuAmountTotal!,
      nuAmountDocConversion: nuAmountTotalConversion,
      daDocument: documentSale.daDocument,
      nuBalanceDoc: nuAmountBalance!,
      nuBalanceDocConversion: nuAmountBalanceConversion,
      nuBalanceDocOriginal: nuBalanceOriginal!,
      nuBalanceDocOriginalConversion: nuBalanceOriginalConversion!,
      coOriginal: documentSale.coCurrency,
      coTypeDoc: documentSale.coDocumentSaleType,
      nuValueLocal: documentSale.nuValueLocal,
      nuAmountIgtf: 0,
      nuAmountIgtfConversion: 0,
      st: 0,
      isSave: false,
      daVoucher: this.daVoucher.split("T")[0],
      hasDiscount: false,
      discountComment: "",
      nuAmountCollectDiscount: 0,
      nuCollectDiscount: 0,
      missingRetention: missingRetention,
      nuAmountCollectDiscountConversion: 0,
    })
    this.collectService.documentSales[id].positionCollecDetails = this.collectService.collection.collectionDetails.length - 1;
    this.collectService.documentSalesBackup[id].positionCollecDetails = this.collectService.collection.collectionDetails.length - 1;
    this.collectService.documentSalesView[id].positionCollecDetails = this.collectService.collection.collectionDetails.length - 1;


    if (this.collectService.coTypeModule == "3") {
      this.collectService.collection.coOriginalCollection = documentSale.coCollection;
    }

    this.collectService.calculatePayment("", 0);
    this.cdr.detectChanges();
  }

  saveDocumentSale(action: Boolean) {
    let validate = false;
    // if (this.collectService.validNuRetention) {

    if (action) {
      if (this.disabledSaveButton)
        this.disabledSaveButton = false;

      this.flushPartialPaymentBeforeSave();
      this.flushFullPaymentBeforeSave();

      if (this.collectService.coTypeModule == '2') {
        this.collectService.amountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(this.collectService.amountPaidRetention));
        this.collectService.documentSaleOpen.nuAmountPaid = this.collectService.amountPaidRetention;
      }

      this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails]!.inPaymentPartial! = this.collectService.isPaymentPartial;

      if (this.collectService.coTypeModule != "2") {
        //ES COBRO O IGTF
        if (this.collectService.isPaymentPartial) {
          const partialAmount = this.resolvePartialPaymentAmount();
          if (partialAmount > 0) {
            const idx = this.collectService.documentSaleOpen.positionCollecDetails;
            const detail = this.collectService.collection.collectionDetails[idx];
            if (detail) {
              this.valuePartialPayment = partialAmount;
              this.collectService.amountPaid = partialAmount;
              this.collectService.documentSaleOpen.nuAmountPaid = partialAmount;
              this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].nuAmountPaid = partialAmount;
              this.collectService.documentSalesBackup[this.collectService.indexDocumentSaleOpen].nuAmountPaid = partialAmount;
              detail.nuAmountPaid = partialAmount;
              detail.nuAmountPaidConversion = this.collectService.convertirMonto(
                partialAmount,
                this.collectService.collection.nuValueLocal,
                this.collectService.documentSaleOpen.coCurrency
              );
            }
            validate = true;
          } else {
            console.log("el monto parcial no puede ser vacio")
          }
        } else {
          validate = true;
        }
      } else {
        validate = true;
      }

      if (validate) {
        const hasSelectedDiscounts = this.collectService.selectedCollectDiscounts.length > 0;
        if (this.collectService.coTypeModule == "0" && this.collectService.userCanSelectCollectDiscount &&
          (hasSelectedDiscounts || this.hasManualCollectDiscount())) {
          this.setCollectionDetailDiscounts(this.collectService.documentSaleOpen.positionCollecDetails!, this.collectService.selectedCollectDiscounts);
        }
        this.flushCollectRetentionLinesBeforeSave();
        if (this.collectService.retencion && !this.collectService.missingRetentionValue) {
          this.setCollectionDetailRetentions(this.collectService.documentSaleOpen.positionCollecDetails!);
        }
        this.collectService.copyDocumentSaleOpenToSalesAndDetails();
        this.collectService.calculatePayment("", 0, true);
        this.clearDocumentRetentionState();
        this.cdr.detectChanges();
        console.log("GUARDAR")
        this.collectService.isOpen = false;
      } else {
        console.log("HAY UN ERROR no debo dejar");
      }

      this.collectService.validNuRetention = false;
    } else {
      this.dontSaveDocumentSale(action);

    }
    this.displayAmountPaid = "0";
    this.displayDiscount = "0";
    this.displayRetention = "0";
    this.displayRetention2 = "0";
    this.centsAmountPaid = 0;
    this.centsDiscount = 0;
    this.centsRetention = 0;
    this.centsRetention2 = 0;
  }

  dontSaveDocumentSale(action: boolean) {
    this.collectService.selectedCollectDiscounts = [];
    this.clearTempSelection();
    console.log("CANCELAR")
    this.collectService.restoreDocumentSaleState(this.collectService.indexDocumentSaleOpen);
    if (this.disabledSaveButton)
      this.disabledSaveButton = false;

    this.restoreCollectionPartialPaymentPreference();

    this.collectService.validNuRetention = false;
    this.collectService.isOpen = action;
  }

  saveStatusDocument() {
    let validate = false;
    if (this.disabledSaveButton)
      this.disabledSaveButton = false;

    this.flushPartialPaymentBeforeSave();
    this.flushFullPaymentBeforeSave();

    const detailIdx = this.collectService.documentSaleOpen.positionCollecDetails;
    this.flushCollectRetentionLinesBeforeSave();
    if (this.collectService.retencion && !this.collectService.missingRetentionValue) {
      this.setCollectionDetailRetentions(detailIdx!);
    } else if (detailIdx != null && detailIdx >= 0) {
      const detail = this.collectService.collection.collectionDetails[detailIdx];
      this.collectService.syncDetailRetentionAmountsAndConversions(
        detail,
        this.collectService.documentSaleOpen
      );
    }

    // Usa el helper para actualizar documentSales y collectionDetails
    this.collectService.copyDocumentSaleOpenToSalesAndDetails();

    if (this.collectService.coTypeModule == '2') {
      this.collectService.amountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(this.collectService.amountPaidRetention));
      this.collectService.documentSaleOpen.nuAmountPaid = this.collectService.amountPaidRetention;
    }

    this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails]!.inPaymentPartial! = this.collectService.isPaymentPartial;

    if (this.collectService.coTypeModule != "2") {
      //ES COBRO O IGTF
      if (this.collectService.isPaymentPartial) {
        const partialAmount = this.resolvePartialPaymentAmount();
        if (partialAmount > 0) {
          const idx = this.collectService.documentSaleOpen.positionCollecDetails;
          const detail = this.collectService.collection.collectionDetails[idx];
          if (detail) {
            this.valuePartialPayment = partialAmount;
            this.collectService.amountPaid = partialAmount;
            this.collectService.documentSaleOpen.nuAmountPaid = partialAmount;
            detail.nuAmountPaid = partialAmount;
            detail.nuAmountPaidConversion = this.collectService.convertirMonto(
              partialAmount,
              this.collectService.collection.nuValueLocal,
              this.collectService.documentSaleOpen.coCurrency
            );
          }
          validate = true;
        } else {
          console.log("el monto parcial no puede ser vacio")
        }
      } else {
        validate = true;
      }
    } else {
      validate = true;
    }

    if (validate) {
      this.collectService.calculatePayment("", 0);
      this.cdr.detectChanges();
      console.log("GUARDAR")
      this.collectService.isOpen = false;
    } else {
      console.log("HAY UN ERROR no debo dejar");
    }

    this.collectService.validNuRetention = false;
  }

  private resolvePartialPaymentAmount(): number {
    const fromCents = (this.centsAmountPaid ?? 0) / this.centsFactor();
    if (fromCents > 0) {
      return fromCents;
    }
    const fromValue = Number(this.valuePartialPayment ?? 0);
    if (fromValue > 0) {
      return fromValue;
    }
    const fromCurrent = Number(this.collectService.amountPaid ?? 0);
    if (fromCurrent > 0) {
      return fromCurrent;
    }
    const index = this.collectService.indexDocumentSaleOpen;
    if (index >= 0) {
      return Number(this.collectService.documentSales[index]?.nuAmountPaid ?? 0);
    }
    return 0;
  }

  private flushFullPaymentBeforeSave(): void {
    if (this.collectService.isPaymentPartial || this.collectService.coTypeModule === '2') {
      return;
    }
    const cs = this.collectService;
    const index = cs.indexDocumentSaleOpen;
    const pos = cs.documentSaleOpen?.positionCollecDetails;
    const detail = Number.isInteger(pos)
      ? cs.collection.collectionDetails?.[pos as number]
      : undefined;
    const backup = index >= 0 ? cs.documentSalesBackup[index] : undefined;
    const balance = Number(
      detail?.nuBalanceDoc ?? backup?.nuBalance ?? cs.documentSaleOpen?.nuBalance ?? 0,
    );
    const difFaltante = Number(detail?.nuAmountDiscount ?? 0);
    const collectDiscount = Number(detail?.nuAmountCollectDiscount ?? 0);
    const payment = cs.resolveDocumentPaymentAmount({
      grossBalance: balance,
      nuAmountDiscount: difFaltante,
      nuAmountCollectDiscount: collectDiscount,
      nuAmountRetention: cs.documentSaleOpen?.nuAmountRetention ?? 0,
      nuAmountRetention2: cs.documentSaleOpen?.nuAmountRetention2 ?? 0,
    });
    const currentAmount = Number(cs.amountPaid ?? 0);
    const amountToSave = currentAmount > 0 && currentAmount <= balance
      && !cs.shouldIncludeIgtfInAmountToPay()
      ? currentAmount
      : payment.amountToPay;

    cs.amountPaid = amountToSave;
    if (cs.documentSaleOpen) {
      cs.documentSaleOpen.nuAmountPaid = amountToSave;
    }
    if (index >= 0) {
      cs.documentSales[index].nuAmountPaid = amountToSave;
      cs.documentSalesBackup[index].nuAmountPaid = amountToSave;
    }
    if (detail) {
      detail.nuAmountPaid = amountToSave;
      detail.nuAmountPaidConversion = cs.convertirMonto(
        amountToSave,
        cs.collection.nuValueLocal,
        cs.documentSaleOpen?.coCurrency ?? cs.collection.coCurrency,
      );
    }
  }

  private flushPartialPaymentBeforeSave(): void {
    if (!this.collectService.isPaymentPartial) {
      return;
    }
    const partialAmount = this.resolvePartialPaymentAmount();
    if (!(partialAmount > 0)) {
      return;
    }
    this.valuePartialPayment = partialAmount;
    this.collectService.amountPaid = partialAmount;
    if (this.collectService.documentSaleOpen) {
      this.collectService.documentSaleOpen.nuAmountPaid = partialAmount;
    }
  }

  private shouldSkipSendValidationOnPaymentRecalc(): boolean {
    const cs = this.collectService;
    if (!cs.isOpen) {
      return false;
    }
    const openIndex = cs.indexDocumentSaleOpen;
    if (openIndex < 0) {
      return false;
    }
    return !cs.documentSales[openIndex]?.isSave;
  }

  setAmountTotal() {
    const cs = this.collectService;
    const { coTypeModule } = cs;
    const index = cs.indexDocumentSaleOpen;
    const pos = cs.documentSaleOpen?.positionCollecDetails;
    const detail = Number.isInteger(pos) && pos! >= 0
      ? cs.collection.collectionDetails?.[pos]
      : undefined;

    const nuAmountRetention = cs.documentSaleOpen.nuAmountRetention ?? 0;
    const nuAmountRetention2 = cs.documentSaleOpen.nuAmountRetention2 ?? 0;
    const totalDeductions = this.getDocumentDetailDeductions({
      nuAmountDiscount: detail?.nuAmountDiscount,
      nuAmountCollectDiscount: detail?.nuAmountCollectDiscount,
      nuAmountRetention,
      nuAmountRetention2,
    });

    if (coTypeModule === '2') {
      const amountPaidRetention = totalDeductions;
      const amountPaidConversion = cs.convertirMonto(
        amountPaidRetention,
        cs.collection.nuValueLocal,
        cs.collection.coCurrency,
      );
      cs.amountPaidRetention = amountPaidRetention;
      cs.amountPaidConversion = amountPaidConversion;
      cs.amountPaid = totalDeductions;
      cs.documentSaleOpen.nuAmountPaid = this.currencyService.cleanFormattedNumber(
        this.currencyService.formatNumber(cs.amountPaidRetention),
      );
      cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(
        this.currencyService.formatNumber(cs.amountPaidDoc),
      );
      cs.amountPaid = this.currencyService.cleanFormattedNumber(
        this.currencyService.formatNumber(cs.amountPaid),
      );
      cs.amountPaidRetention = this.currencyService.cleanFormattedNumber(
        this.currencyService.formatNumber(cs.amountPaidRetention),
      );
    } else if (cs.isPaymentPartial) {
      const partialAmount = this.resolvePartialPaymentAmount();
      cs.amountPaid = partialAmount;
      cs.documentSaleOpen.nuAmountPaid = partialAmount;
      cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(
        this.currencyService.formatNumber(partialAmount),
      );
      cs.amountPaid = this.currencyService.cleanFormattedNumber(
        this.currencyService.formatNumber(cs.amountPaid),
      );
    } else if (index >= 0) {
      if (!this.validateOpenDocumentRetentionTotals(false)) {
        return;
      }
      this.recalculateOpenDocumentAmountAndIgtf(index);
    }

    this.centsAmountPaid = Math.round((cs.amountPaid ?? 0) * this.centsFactor());
    this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);

    const amountPaidAux = cs.amountPaid;
    let nuAmountRetentionAux = nuAmountRetention;
    let nuAmountRetention2Aux = nuAmountRetention2;

    // sincroniza en arrays usando índice abierto
    this.collectService.documentSales[cs.indexDocumentSaleOpen].nuAmountPaid = amountPaidAux;
    this.collectService.documentSales[cs.indexDocumentSaleOpen].nuAmountRetention = nuAmountRetentionAux;
    this.collectService.documentSales[cs.indexDocumentSaleOpen].nuAmountRetention2 = nuAmountRetention2Aux;

    this.collectService.documentSalesBackup[cs.indexDocumentSaleOpen].nuAmountPaid = amountPaidAux;
    this.collectService.documentSalesBackup[cs.indexDocumentSaleOpen].nuAmountRetention = nuAmountRetentionAux;
    this.collectService.documentSalesBackup[cs.indexDocumentSaleOpen].nuAmountRetention2 = nuAmountRetention2Aux;

    let positionCollecDetails = this.collectService.documentSaleOpen.positionCollecDetails;

    this.validate();

    return Promise.resolve(true);
  }

  missingRetention(event: any) {

    this.collectService.missingRetentionValue = event.target.checked;
    this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails]!.missingRetention = event.target.checked;
    this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].missingRetention = event.target.checked;

    if (event.target.checked) {
      this.disabledSaveButton = true;

    } else {
      this.collectService.documentSaleOpen.nuAmountRetention = 0;
      this.collectService.documentSaleOpen.nuAmountRetention2 = 0;
      this.collectService.documentSaleOpen.nuVaucherRetention = "";
      this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].nuAmountRetention = 0;
      this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].nuAmountRetention2 = 0;
      this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].nuVaucherRetention = "";
      this.disabledSaveButton = false;
    }
  }

  private restoreSavedDocumentRetentionsFromDetail(positionCollecDetails: number): void {
    const detail = this.collectService.collection.collectionDetails?.[positionCollecDetails];
    const open = this.collectService.documentSaleOpen;
    if (!detail || !open) {
      return;
    }
    open.nuAmountRetention = Number(detail.nuAmountRetention ?? 0);
    open.nuAmountRetention2 = Number(detail.nuAmountRetention2 ?? 0);
    open.daVoucher = detail.daVoucher ?? '';
    open.nuVaucherRetention = detail.nuVoucherRetention ?? '';
  }

  private restoreFullPaymentAmountAfterDisablingPartial(index: number): void {
    if (index < 0) {
      return;
    }

    this.valuePartialPayment = 0;
    const positionCollecDetails = this.collectService.documentSales[index]?.positionCollecDetails;

    this.calculateSaldo(index).then(() => {
      return this.calculateDocumentSaleOpen(index).then(() => {
        if (Number.isInteger(positionCollecDetails)) {
          this.collectService.documentSaleOpen.positionCollecDetails = positionCollecDetails as number;
        }
        this.collectService.documentSaleOpen.isSelected = true;
        this.collectService.documentSaleOpen.inPaymentPartial = false;
        this.collectService.documentSales[index].isSelected = true;
        this.collectService.documentSalesBackup[index].isSelected = true;

        this.syncAmountPaidDisplayForOpen(index);
        this.syncDocumentAmountPaidState(index, this.collectService.amountPaid);
        this.disabledSaveButton = false;

        this.validateNuVaucherRetention(false);
        this.validate();
        this.cdr.detectChanges();
      });
    });
  }

  partialPay(event: any) {
    this.collectService.isChangePaymentPartial = true;
    this.collectService.isChangePaymentPartialPersistence = true;
    const isPartialEnabled = event.detail?.checked ?? event.target?.checked;
    this.collectService.isPaymentPartial = isPartialEnabled;
    const factor = this.centsFactor();
    const index = this.collectService.indexDocumentSaleOpen;
    const pos = this.collectService.documentSaleOpen?.positionCollecDetails;

    if (isPartialEnabled) {
      const detail = Number.isInteger(pos)
        ? this.collectService.collection.collectionDetails?.[pos as number]
        : undefined;
      const persistedPartial = detail?.isSave === true
        ? this.resolvePartialPaymentAmountForOpen(index, pos)
        : 0;

      this.collectService.amountPaid = persistedPartial > 0 ? persistedPartial : 0;
      this.valuePartialPayment = persistedPartial > 0 ? persistedPartial : 0;

      this.centsAmountPaid = Math.round((this.collectService.amountPaid ?? 0) * factor);
      this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);

      if (this.collectService.collection.stDelivery != 3 && Number.isInteger(pos)) {
        this.collectService.collection.collectionDetails[pos as number]!.inPaymentPartial = true;
      }

      this.disabledSaveButton = !(this.collectService.amountPaid > 0);
      if (index >= 0 && Number.isInteger(pos)) {
        this.syncDocumentPaymentPartialState(index, pos as number, true);
      }

      if (!this.hasShownPartialPayMessage && this.collectService.totalHistoricPartialPayment > 0 && this.collectService.coTypeModule == "0") {
        if (this.collectService.historicPartialPayment &&
          this.collectService.documentSales[index]?.inPaymentPartial) {

          this.collectService.getPaymentPartialByDocument(
            this.synchronizationServices.getDatabase(),
            this.collectService.documentSales[index].coDocument,
          ).then(() => {
            if (this.collectService.paymentPartials.length > 0) {
              this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_HAVE_PAYPARTIAL')!;
              this.alertMessageOpen2 = true;
              this.hasShownPartialPayMessage = true;
            }
          });
        }
      }

      this.collectService.isChangePaymentPartial = false;
      return;
    }

    if (index >= 0 && Number.isInteger(pos)) {
      this.syncDocumentPaymentPartialState(index, pos as number, false);
    }

    if (this.collectService.collection.stDelivery == 3 && Number.isInteger(pos)) {
      this.restoreSavedDocumentRetentionsFromDetail(pos as number);
    } else if (Number.isInteger(pos)) {
      this.collectService.collection.collectionDetails[pos as number]!.inPaymentPartial = false;
    }

    this.restoreFullPaymentAmountAfterDisablingPartial(index);
    this.collectService.isChangePaymentPartial = false;
  }

  setPartialPay() {
    if (this.collectService.amountPaid == null || this.collectService.amountPaid <= 0) {
      this.disabledSaveButton = true;
      this.collectService.amountPaid = 0;
    } else if (this.collectService.amountPaid > 0) {
      //this.collectService.documentSaleOpen.nuBalance = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(this.collectService.amountPaid));
      this.collectService.documentSaleOpen.nuAmountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(this.collectService.amountPaid));
      this.collectService.amountPaidDoc = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(this.collectService.amountPaidDoc));
      this.valuePartialPayment = this.collectService.amountPaid;
      this.validate();
    }

  }

  private isNullOrZero(value: any): boolean {
    return value == null || value === 0;
  }

  private isEmptyOrZeroRetention(): boolean {
    if (this.documentRetentionLines.length > 0) {
      return this.documentRetentionLines.every(line => this.isNullOrZero(line.nuAmountRetention));
    }
    const { nuAmountRetention, nuAmountRetention2 } = this.collectService.documentSaleOpen;
    return this.isNullOrZero(nuAmountRetention) && this.isNullOrZero(nuAmountRetention2);
  }

  validate() {
    const cs = this.collectService;
    const doc = cs.documentSaleOpen;
    const index = cs.indexDocumentSaleOpen;
    const parteDecimal = cs.parteDecimal;
    const docOriginal = cs.documentSalesBackup[index];
    const isAlwaysPartialWithFixedMode = cs.alwaysPartialPayment && !cs.enablePartialPayment;
    this.syncOpenDocumentAmountPaidWithRetentions(index);
    const maxAmountToPay = this.resolveOpenDocumentMaxAmountToPay(index);
    const skipAmountExceedAlert = this.isCollectRetentionEntryInProgress();
    // Asegura valores numéricos antes de operar
    this.collectService.ensureNumber(doc, 'nuAmountRetention');
    this.collectService.ensureNumber(doc, 'nuAmountRetention2');
    this.collectService.ensureNumber(doc, 'nuAmountTax');
    this.collectService.ensureNumber(doc, 'nuAmountBase');
    this.collectService.ensureNumber(doc, 'nuAmountPaid');
    this.collectService.ensureNumber(doc, 'nuBalance');
    this.collectService.ensureNumber(doc, 'nuAmountRetention');
    this.collectService.ensureNumber(doc, 'nuAmountRetention2');
    // ...otros campos numéricos que uses...

    if (cs.coTypeModule == '2') {
      this.syncAllRetentionLinesValidation();
      this.disabledSaveButton = false;
      if (!cs.validNuRetention || !cs.validateDaVoucher) {
        this.disabledSaveButton = true;
      }
      cs.calculatePayment("", 0, false, this.shouldSkipSendValidationOnPaymentRecalc());
      this.cdr.detectChanges();
      return;
    }

    // Si es pago parcial
    if (cs.isPaymentPartial) {
      const montoDoc = maxAmountToPay;
      if (!isAlwaysPartialWithFixedMode && Math.abs(cs.amountPaid) >= this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(montoDoc))) {
        cs.mensaje = cs.collectionTags.get('COB_MSJ_PARTIALPAY_MAYOR_DOCAMOUNT')!;
        this.alertMessageOpen = true;
        this.disabledSaveButton = true;
        cs.amountPaid = doc.nuAmountPaid;
        cs.amountPaymentPartial = maxAmountToPay;
        cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaid));
        return;
      }
      this.disabledSaveButton = false;

      let amountPaid = 0;
      /*  if (this.collectService.currencySelected.localCurrency.toString() == "true") {
         //estoy en moneda local
         if (this.collectService.currencySelected.coCurrency == doc.coCurrency) {
           //moneda del documento es local
           amountPaid = cs.amountPaid;
         } else {
           //moneda del documento es hard
           amountPaid = cs.amountPaid / this.collectService.collection.nuValueLocal;
         }
       } else {
         //estoy ne moneda hard
         if (this.collectService.currencySelected.coCurrency == doc.coCurrency) {
           //moneda del documento es hard
           amountPaid = cs.amountPaid;
         } else {
           //moneda del documento es local
           amountPaid = cs.amountPaid * this.collectService.collection.nuValueLocal;
         }
       }
  */
      amountPaid = cs.amountPaid;
      //cs.documentSales[index].nuBalance = amountPaid;
      cs.documentSales[index].nuAmountPaid = amountPaid;
      //cs.documentSalesBackup[index].nuBalance = amountPaid;
      cs.documentSalesBackup[index].nuAmountPaid = amountPaid;

      cs.calculatePayment("", 0, false, this.shouldSkipSendValidationOnPaymentRecalc());
      this.cdr.detectChanges();
      return;
    }

    // Si hay retenciones
    const retentionTotal = this.getDocumentRetentionTotal();
    if (retentionTotal > 0 || doc.nuAmountRetention || doc.nuAmountRetention2) {
      this.syncAllRetentionLinesValidation();
      if (!this.validateOpenDocumentRetentionTotals(false)) {
        return;
      }
      if (cs.validNuRetention) {
        // Usa el helper aquí también
        if (this.isEmptyOrZeroRetention()) {
          this.disabledSaveButton = true;
          return;
        }
        if (!cs.validateDaVoucher) {
          this.disabledSaveButton = true;
          return;
        }
        if ((!isAlwaysPartialWithFixedMode && this.exceedsMaxAmountToPay(cs.amountPaid, maxAmountToPay))
          || cs.amountPaid < 0) {
          if (!skipAmountExceedAlert) {
            cs.mensaje = "El monto no puede ser mayor al monto del documento";
            this.alertMessageOpen = true;
          }
          this.disabledSaveButton = true;
          return;
        }
        cs.documentSales[index].nuAmountPaid = cs.amountPaid;
        cs.documentSalesBackup[index].nuAmountPaid = cs.amountPaid;
        cs.documentSales[index].nuAmountRetention = doc.nuAmountRetention;
        cs.documentSalesBackup[index].nuAmountRetention = doc.nuAmountRetention;
        cs.documentSales[index].nuAmountRetention2 = doc.nuAmountRetention2;
        cs.documentSalesBackup[index].nuAmountRetention2 = doc.nuAmountRetention2;
        this.disabledSaveButton = false;
        cs.calculatePayment("", 0, false, this.shouldSkipSendValidationOnPaymentRecalc());
        this.cdr.detectChanges();
        return;
      }
    }

    // Si el monto pagado es mayor al saldo permitido (neto + IGTF si aplica)
    if (!isAlwaysPartialWithFixedMode && this.exceedsMaxAmountToPay(cs.amountPaid, maxAmountToPay)) {
      if (skipAmountExceedAlert) {
        this.disabledSaveButton = true;
        return;
      }
      cs.mensaje = cs.isPaymentPartial
        ? cs.collectionTags.get('COB_MSJ_PARTIALPAY_MAYOR_DOCAMOUNT')!
        : cs.collectionTags.get('COB_MSJ_PAY_MAYOR_DOCAMOUNT')!;
      this.alertMessageOpen = true;
      this.disabledSaveButton = true;
      cs.amountPaid = maxAmountToPay;
      cs.amountPaymentPartial = maxAmountToPay;
      cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(
        this.currencyService.formatNumber(maxAmountToPay),
      );
      this.centsAmountPaid = Math.round((maxAmountToPay ?? 0) * this.centsFactor());
      this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
      return;
    }

    // Validación de retenciones vacías usando el helper
    if (cs.validNuRetention && this.isEmptyOrZeroRetention()) {
      this.disabledSaveButton = true;
      return;
    }

    let difFaltante = this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails].nuAmountDiscount

    if (difFaltante > 0)
      this.disabledSaveButton = false;
    else
      this.disabledSaveButton = true;


    cs.amountPaymentPartial = 0;
    doc.nuAmountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaid));
    cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaidDoc));

    if (!this.disabledSaveButton) {
      cs.calculatePayment("", 0, false, this.shouldSkipSendValidationOnPaymentRecalc());
      this.cdr.detectChanges();
    }

    if (cs.isChangePaymentPartial && !cs.isPaymentPartial) {
      this.disabledSaveButton = false;
      cs.calculatePayment("", 0, false, this.shouldSkipSendValidationOnPaymentRecalc());
      this.cdr.detectChanges();
    }

    //SI HAY DESCUENTOS APLICADOS, EL COMENTARIO NO PUEDE ESTAR VACIO
    /* if (this.collectService.tempSelectedCollectDiscounts.length > 0) {
      if (this.discountComment == null || this.discountComment == undefined || this.discountComment == "" || this.discountComment.trim() == "") {
        this.disabledSaveButton = true;
        return;
      } else {
        this.disabledSaveButton = false;
      }
    } */
  }

  imprimir() {
    console.log(this.collectService.collection)
  }

  public shouldShowRetentionLineLengthHint(idCollectRetention: number): boolean {
    if (this.collectService.sizeRetention <= 0) {
      return false;
    }
    const line = this.getRetentionLine(idCollectRetention);
    if (!line || this.isRetentionLineVoucherValid(idCollectRetention)) {
      return false;
    }
    return String(line.nuVoucherRetention ?? '').trim().length > 0;
  }

  public shouldShowRetentionLineDateHint(idCollectRetention: number): boolean {
    const line = this.getRetentionLine(idCollectRetention);
    if (!line || Number(line.nuAmountRetention ?? 0) <= 0) {
      return false;
    }
    const hasVoucher = String(line.nuVoucherRetention ?? '').trim().length > 0;
    return hasVoucher && !this.isRetentionLineDateValid(idCollectRetention);
  }

  public isRetentionLineVoucherValid(idCollectRetention: number): boolean {
    return this.retentionLineVoucherValidMap.get(idCollectRetention) === true;
  }

  public isRetentionLineDateValid(idCollectRetention: number): boolean {
    return this.retentionLineDateValidMap.get(idCollectRetention) === true;
  }

  public getRetentionLineVoucher(idCollectRetention: number): string {
    return this.getRetentionLine(idCollectRetention)?.nuVoucherRetention ?? '';
  }

  public setRetentionLineVoucher(idCollectRetention: number, value: string): void {
    const line = this.getRetentionLine(idCollectRetention);
    if (!line) {
      return;
    }
    line.nuVoucherRetention = value ?? '';
    this.validateRetentionLineVoucher(idCollectRetention, false);
    this.syncAllRetentionLinesValidation();
  }

  public getRetentionLineDaVoucher(idCollectRetention: number): string {
    const line = this.getRetentionLine(idCollectRetention);
    const value = line?.daVoucherRetention ?? '';
    return value ? String(value).split('T')[0] : '';
  }

  public getRetentionCalendarTriggerId(idCollectRetention: number): string {
    return `inputCalendar-${idCollectRetention}`;
  }

  public setRetentionLineDaVoucher(idCollectRetention: number, event?: CustomEvent): void {
    const line = this.getRetentionLine(idCollectRetention);
    if (!line) {
      return;
    }
    const rawValue = event?.detail?.value ?? line.daVoucherRetention;
    if (rawValue != null && String(rawValue).trim() !== '') {
      line.daVoucherRetention = String(rawValue).split('T')[0];
    }
    this.validateRetentionLineDate(idCollectRetention);
    this.syncAllRetentionLinesValidation();
    this.cdr.detectChanges();
  }

  private getRetentionLine(idCollectRetention: number) {
    return this.documentRetentionLines.find(
      item => item.idCollectRetention === idCollectRetention,
    );
  }

  public validateRetentionLineVoucher(idCollectRetention: number, sendMessage: boolean): boolean {
    const line = this.getRetentionLine(idCollectRetention);
    if (!line) {
      return false;
    }

    const voucher = String(line.nuVoucherRetention ?? '').trim();
    if (!voucher) {
      this.retentionLineVoucherValidMap.set(idCollectRetention, false);
      return false;
    }

    if (this.collectService.sizeRetention !== 0) {
      if (voucher.length !== this.collectService.sizeRetention) {
        this.collectService.mensaje =
          'El comprobante de retenci\u00f3n debe tener una longitud de ' + this.collectService.sizeRetention + ' caracteres ';
        if (sendMessage) {
          this.alertMessageOpen = true;
        }
        this.retentionLineVoucherValidMap.set(idCollectRetention, false);
        return false;
      }

      if (this.collectService.formatRetention === 'text' && this.collectService.regexOnlyText.test(voucher)) {
        this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_RETENTION_ONLY_TEXT')!;
        if (sendMessage) {
          this.alertMessageOpen = true;
        }
        this.retentionLineVoucherValidMap.set(idCollectRetention, false);
        return false;
      }

      if (this.collectService.formatRetention === 'alphanumeric'
        && this.collectService.regexAlphaNumeric.test(voucher)) {
        this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_RETENTION_ALPHANUMERIC')!;
        if (sendMessage) {
          this.alertMessageOpen = true;
        }
        this.retentionLineVoucherValidMap.set(idCollectRetention, false);
        return false;
      }
    }

    this.retentionLineVoucherValidMap.set(idCollectRetention, true);
    return true;
  }

  private validateRetentionLineDate(idCollectRetention: number): boolean {
    const line = this.getRetentionLine(idCollectRetention);
    if (!line) {
      return false;
    }

    const amount = Number(line.nuAmountRetention ?? 0);
    if (amount <= 0) {
      this.retentionLineDateValidMap.set(idCollectRetention, true);
      return true;
    }

    const isValid = String(line.daVoucherRetention ?? '').trim().length > 0;
    this.retentionLineDateValidMap.set(idCollectRetention, isValid);
    return isValid;
  }

  private syncAllRetentionLinesValidation(): void {
    if (!this.collectService.retencion || this.collectService.missingRetentionValue) {
      this.collectService.validNuRetention = false;
      this.collectService.validateDaVoucher = true;
      return;
    }

    const activeLines = this.documentRetentionLines.filter(
      line => Number(line.nuAmountRetention ?? 0) > 0,
    );

    if (activeLines.length === 0) {
      this.collectService.validNuRetention = this.documentRetentionLines.length === 0;
      this.collectService.validateDaVoucher = true;
      return;
    }

    let allValid = true;
    for (const line of activeLines) {
      const voucherValid = this.validateRetentionLineVoucher(line.idCollectRetention, false);
      const dateValid = this.validateRetentionLineDate(line.idCollectRetention);
      if (!voucherValid || !dateValid) {
        allValid = false;
      }
    }

    this.collectService.validNuRetention = allValid;
    this.collectService.validateDaVoucher = allValid;
    this.syncLegacyRetentionFieldsFromLines();
  }

  private syncLegacyRetentionFieldsFromLines(): void {
    const detailIdx = this.collectService.documentSaleOpen?.positionCollecDetails;
    const detail = detailIdx != null && detailIdx >= 0
      ? this.collectService.collection.collectionDetails?.[detailIdx]
      : undefined;
    if (!detail) {
      return;
    }

    this.collectService.syncLegacyDetailFieldsFromFirstRetentionLine(
      detail,
      this.documentRetentionLines,
      this.collectService.documentSaleOpen,
    );
  }

  /** @deprecated Usar validación por línea; se mantiene por compatibilidad de llamadas existentes. */
  validateNuVaucherRetention(sendMessage: boolean) {
    this.documentRetentionLines.forEach(line => {
      this.validateRetentionLineVoucher(line.idCollectRetention, sendMessage);
      this.validateRetentionLineDate(line.idCollectRetention);
    });
    this.syncAllRetentionLinesValidation();

    if (this.collectService.validNuRetention && this.isEmptyOrZeroRetention()) {
      this.disabledSaveButton = true;
    } else if (!this.collectService.validNuRetention) {
      this.disabledSaveButton = true;
    }

    this.cdr.detectChanges();
  }

  /** @deprecated Usar setRetentionLineDaVoucher por línea. */
  setDaVoucher(event?: CustomEvent) {
    const firstLine = this.documentRetentionLines[0];
    if (firstLine) {
      this.setRetentionLineDaVoucher(firstLine.idCollectRetention, event);
      return;
    }
    const rawValue = event?.detail?.value ?? this.daVoucher;
    if (rawValue != null && String(rawValue).trim() !== '') {
      this.daVoucher = String(rawValue).split('T')[0];
      this.collectService.documentSaleOpen.daVoucher = this.daVoucher;
    }
    this.cdr.detectChanges();
  }


  setResult(ev: any) {
    console.log('Apretó:' + ev.detail.role);

    this.collectService.separateIgtf = false;
    this.collectService.collection.hasIGTF = false;
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpen = false;
    } else {
      this.alertMessageOpen = false;
    }
  }

  setResult2(ev: any) {
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpen2 = false;
      //DEBO MOSTRAR LA MISMA TABLA(MODAL) D PAGOS PARCIALES QUE EN LA TABLA DOCUMENTOS
      this.openPartialPayment(this.collectService.documentSaleOpen.coDocument);
    } else {
      this.alertMessageOpen2 = false;
    }
  }

  openPartialPayment(coDocument: string) {
    const requestId = this.collectService.resetPaymentPartialsForDocument(coDocument);
    this.collectService.openPaymentPartial = false;

    this.messageService.showLoading().then(() => {
      this.collectService
        .loadPaymentPartialsForDocument(
          this.synchronizationServices.getDatabase(),
          coDocument,
          requestId,
        )
        .finally(() => this.messageService.hideLoading())
        .then(() => {
          if (!this.collectService.isPaymentPartialLoadCurrent(requestId)) {
            return;
          }
          this.collectService.openPaymentPartial = true;
        });
    });
  }

  print() {
    console.log(this.collectService.collection);
  }

  showDocumentIgtfField(): boolean {
    return this.collectService.shouldDisplayIgtfInTotals();
  }

  getCurrencyConversionCode(): string {
    return this.collectService.currencyConversion?.coCurrency
      ?? this.collectService.collection?.coCurrency
      ?? '';
  }

  formatDocumentIgtfAmount(): string {
    const igtfAmount = Number(this.collectService.documentSaleOpen?.igtfAmount ?? 0);
    return this.formatNumber(igtfAmount);
  }

  private refreshOpenDocumentAmountPaidIfNeeded(): void {
    const cs = this.collectService;
    if (!cs.isOpen || cs.indexDocumentSaleOpen < 0 || cs.coTypeModule === '2') {
      return;
    }
    this.syncAmountPaidDisplayForOpen(cs.indexDocumentSaleOpen);
  }

  formatNumber(num: number) {
    return this.currencyService.formatNumber(num);
  }

  formatMultiLineAmounts(text: string | null | undefined): string {
    if (!text) return '';
    const lines = String(text).split('\n');
    const formatted = lines.map(line => {
      const value = Number(line);
      if (!Number.isFinite(value)) return line;
      return this.formatNumber(value);
    });
    return formatted.join('\n');
  }

  getTasaByAmount(amount: number, nuValueLocal: number) {
    if (nuValueLocal == null) return this.formatNumber(amount);
    if (amount < 0) {
      this.collectService.calculateDifference = true;
      return this.formatNumber(nuValueLocal);
    } else {
      this.collectService.calculateDifference = true;
      return this.formatNumber(this.collectService.getNuValueLocal());
    }
  }

  oppositeCoCurrency(coCurrency: string): string {
    return this.currencyService.getOppositeCurrency(coCurrency)?.coCurrency ?? '';
  }

  public formatFromCents(cents?: number): string {
    if (cents === undefined || cents === null) return '';
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    const factor = this.centsFactor();
    const units = Math.floor(abs / factor);
    const decimals = String(abs % factor).padStart(this.getParteDecimal(), '0');
    const unitsStr = units.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sign}${unitsStr},${decimals}`;
  }

  private getParteDecimal(): number {
    return Number.parseInt(String(this.globalConfig.get('parteDecimal') ?? '2'), 10) || 2;
  }

  private centsFactor(): number {
    return Math.pow(10, this.getParteDecimal());
  }



  // --- DISCOUNT handlers ---
  private ensureDiscountInit(): void {
    if (this.centsDiscount !== undefined) return;
    const base = Number(this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails!].nuAmountDiscount ?? 0);
    const factor = this.centsFactor();
    this.centsDiscount = Math.round(base * factor) || 0;
    this.displayDiscount = this.formatFromCents(this.centsDiscount);
  }

  public onDiscountKeyDown(ev: any): void {
    const key = String(ev?.key ?? '');
    const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'];
    if (allowed.includes(key)) return;

    this.ensureDiscountInit();

    const MAX_CENTS = 999999999999;

    // Dígito
    if (/^\d$/.test(key)) {
      this.discountKeyInFlight = true;
      const digit = parseInt(key, 10);
      this.centsDiscount = Math.min(MAX_CENTS, (this.centsDiscount ?? 0) * 10 + digit);
      this.updateDiscountModel();
      ev.preventDefault();
      setTimeout(() => { this.discountKeyInFlight = false; }, 0);
      return;
    }

    // Backspace
    if (key === 'Backspace') {
      this.discountKeyInFlight = true;
      this.centsDiscount = Math.trunc((this.centsDiscount ?? 0) / 10);
      this.updateDiscountModel();
      ev.preventDefault();
      setTimeout(() => { this.discountKeyInFlight = false; }, 0);
      return;
    }

    // Delete -> reset
    if (key === 'Delete') {
      this.discountKeyInFlight = true;
      this.centsDiscount = 0;
      this.updateDiscountModel();
      ev.preventDefault();
      setTimeout(() => { this.discountKeyInFlight = false; }, 0);
      return;
    }

    ev.preventDefault();
  }

  public onDiscountFocus(): void {
    this.ensureDiscountInit();
    if ((this.centsDiscount ?? 0) === 0) {
      this.displayDiscount = this.formatFromCents(0);
    }
  }

  public onDiscountBlur(): void {
    this.ensureDiscountInit();
    const parsed = (this.centsDiscount ?? 0) / this.centsFactor();

    this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails!].nuAmountDiscount = parsed;
    // this.collectService.documentSaleOpen.nuAmountDiscount = parsed;
    try {
      this.displayDiscount = this.currencyService.formatNumber(parsed);
    } catch {
      this.displayDiscount = this.formatFromCents(this.centsDiscount);
    }
    // keep existing logic
    if (typeof (this as any).setAmountTotal === 'function') this.setAmountTotal();
  }

  private updateDiscountModel(): void {
    const cents = this.centsDiscount ?? 0;
    const value = cents / this.centsFactor();
    this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails!].nuAmountDiscount = value;

    //this.collectService.documentSaleOpen.nuAmountDiscount = value;
    this.displayDiscount = this.formatFromCents(cents);
    if (typeof (this as any).setAmountTotal === 'function') {
      this.setAmountTotal();
    }
    this.validateOpenDocumentRetentionTotals(false);
    this.validate();
    this.cdr.detectChanges();
  }

  // --- RETENTION IVA handlers ---
  private ensureRetentionInit(): void {
    if (this.centsRetention !== undefined) return;
    const base = Number(this.collectService.documentSaleOpen?.nuAmountRetention ?? 0);
    const factor = this.centsFactor();
    this.centsRetention = Math.round(base * factor) || 0;
    this.displayRetention = this.formatFromCents(this.centsRetention);
  }

  // --- RETENTION IVA handlers ---
  public onRetentionKeyDown(ev: any): void {
    const key = String(ev?.key ?? '');
    const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'];
    if (allowed.includes(key)) return;

    this.ensureRetentionInit();

    const MAX_CENTS = 999999999999;

    if (/^\d$/.test(key)) {
      this.retentionKeyInFlight = true;
      const digit = parseInt(key, 10);
      this.centsRetention = Math.min(MAX_CENTS, (this.centsRetention ?? 0) * 10 + digit);
      this.updateRetentionModel();
      ev.preventDefault();
      setTimeout(() => { this.retentionKeyInFlight = false; }, 0);
      return;
    }

    if (key === 'Backspace') {
      this.retentionKeyInFlight = true;
      this.centsRetention = Math.trunc((this.centsRetention ?? 0) / 10);
      this.updateRetentionModel();
      ev.preventDefault();
      setTimeout(() => { this.retentionKeyInFlight = false; }, 0);
      return;
    }

    if (key === 'Delete') {
      this.retentionKeyInFlight = true;
      this.centsRetention = 0;
      this.updateRetentionModel();
      ev.preventDefault();
      setTimeout(() => { this.retentionKeyInFlight = false; }, 0);
      return;
    }

    ev.preventDefault();
  }

  public onRetentionFocus(): void {
    this.ensureRetentionInit();
    if ((this.centsRetention ?? 0) === 0) {
      this.displayRetention = this.formatFromCents(0);
    }
  }

  public onRetentionBlur(): void {
    this.ensureRetentionInit();
    const parsed = (this.centsRetention ?? 0) / this.centsFactor();
    this.collectService.documentSaleOpen.nuAmountRetention = parsed;
    try {
      this.displayRetention = this.currencyService.formatNumber(parsed);
    } catch {
      this.displayRetention = this.formatFromCents(this.centsRetention);
    }
    if (typeof (this as any).setAmountTotal === 'function') {
      this.setAmountTotal();
    }
    this.validateOpenDocumentRetentionTotals(true);
    this.validate();
    this.cdr.detectChanges();
  }

  private updateRetentionModel(): void {
    const cents = this.centsRetention ?? 0;
    const value = cents / this.centsFactor();
    this.collectService.documentSaleOpen.nuAmountRetention = value;
    this.displayRetention = this.formatFromCents(cents);
    if (typeof (this as any).setAmountTotal === 'function') {
      this.setAmountTotal();
    }
    this.validateOpenDocumentRetentionTotals(false);
    this.validate();
    this.cdr.detectChanges();
  }

  // --- RETENTION ISLR handlers (retention2) ---
  private ensureRetention2Init(): void {
    if (this.centsRetention2 !== undefined) return;
    const base = Number(this.collectService.documentSaleOpen?.nuAmountRetention2 ?? 0);
    const factor = this.centsFactor();
    this.centsRetention2 = Math.round(base * factor) || 0;
    this.displayRetention2 = this.formatFromCents(this.centsRetention2);
  }

  // --- RETENTION ISLR handlers (retention2) ---
  public onRetention2KeyDown(ev: any): void {
    const key = String(ev?.key ?? '');
    const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'];
    if (allowed.includes(key)) return;

    this.ensureRetention2Init();

    const MAX_CENTS = 999999999999;

    if (/^\d$/.test(key)) {
      this.retention2KeyInFlight = true;
      const digit = parseInt(key, 10);
      this.centsRetention2 = Math.min(MAX_CENTS, (this.centsRetention2 ?? 0) * 10 + digit);
      this.updateRetention2Model();
      ev.preventDefault();
      setTimeout(() => { this.retention2KeyInFlight = false; }, 0);
      return;
    }

    if (key === 'Backspace') {
      this.retention2KeyInFlight = true;
      this.centsRetention2 = Math.trunc((this.centsRetention2 ?? 0) / 10);
      this.updateRetention2Model();
      ev.preventDefault();
      setTimeout(() => { this.retention2KeyInFlight = false; }, 0);
      return;
    }

    if (key === 'Delete') {
      this.retention2KeyInFlight = true;
      this.centsRetention2 = 0;
      this.updateRetention2Model();
      ev.preventDefault();
      setTimeout(() => { this.retention2KeyInFlight = false; }, 0);
      return;
    }

    ev.preventDefault();
  }

  public onRetention2Focus(): void {
    this.ensureRetention2Init();
    if ((this.centsRetention2 ?? 0) === 0) {
      this.displayRetention2 = this.formatFromCents(0);
    }
  }

  public onRetention2Blur(): void {
    this.ensureRetention2Init();
    const parsed = (this.centsRetention2 ?? 0) / this.centsFactor();
    this.collectService.documentSaleOpen.nuAmountRetention2 = parsed;
    try {
      this.displayRetention2 = this.currencyService.formatNumber(parsed);
    } catch {
      this.displayRetention2 = this.formatFromCents(this.centsRetention2);
    }
    if (typeof (this as any).setAmountTotal === 'function') {
      this.setAmountTotal();
    }
    this.validateOpenDocumentRetentionTotals(true);
    this.validate();
    this.cdr.detectChanges();
  }

  private updateRetention2Model(): void {
    const cents = this.centsRetention2 ?? 0;
    const value = cents / this.centsFactor();
    this.collectService.documentSaleOpen.nuAmountRetention2 = value;
    this.displayRetention2 = this.formatFromCents(cents);
    if (typeof (this as any).setAmountTotal === 'function') {
      this.setAmountTotal();
    }
    this.validateOpenDocumentRetentionTotals(false);
    this.validate();
    this.cdr.detectChanges();
  }



  private ensureAmountPaidInit(): void {
    if (this.centsAmountPaid !== undefined) return;
    const base = Number(this.collectService.amountPaid ?? 0);
    const factor = this.centsFactor();
    this.centsAmountPaid = Math.round(base * factor) || 0;
    this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
  }

  // key handling: digits add as last cent; Backspace removes last digit
  public onAmountPaidKeyDown(ev: any): void {
    const key = String(ev?.key ?? '');
    const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'];
    if (allowed.includes(key)) return;

    this.ensureAmountPaidInit();

    if (/^\d$/.test(key)) {
      this.amountPaidKeyInFlight = true;
      const digit = parseInt(key, 10);
      this.centsAmountPaid = Math.min(999999999999, (this.centsAmountPaid ?? 0) * 10 + digit);
      this.updateAmountPaidModel();
      ev.preventDefault();
      setTimeout(() => { this.amountPaidKeyInFlight = false; }, 0);
      return;
    }

    if (key === 'Backspace') {
      this.amountPaidKeyInFlight = true;
      this.centsAmountPaid = Math.floor((this.centsAmountPaid ?? 0) / 10);
      this.updateAmountPaidModel();
      ev.preventDefault();
      setTimeout(() => { this.amountPaidKeyInFlight = false; }, 0);
      return;
    }

    // bloquear otras teclas
    ev.preventDefault();
  }

  public onAmountPaidFocus(): void {
    this.ensureAmountPaidInit();
    if ((this.centsAmountPaid ?? 0) === 0) {
      this.displayAmountPaid = this.formatFromCents(0);
    }
  }

  public onAmountPaidBlur(): void {
    this.ensureAmountPaidInit();
    const parsed = (this.centsAmountPaid ?? 0) / this.centsFactor();
    this.collectService.amountPaid = parsed;
    // formato final con currencyService si existe
    try {
      this.displayAmountPaid = this.currencyService.formatNumber(parsed);
    } catch {
      this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
    }
    // mantener la lógica existente
    if (typeof (this as any).setPartialPay === 'function') this.setPartialPay();
  }

  public onAmountPaidInput(ev: any): void {
    if (this.amountPaidKeyInFlight) {
      this.amountPaidKeyInFlight = false;
      return;
    }

    try {
      const inputChar = typeof ev?.data === 'string' ? ev.data : undefined;
      const inputType = ev?.inputType ?? '';
      const MAX_CENTS = 999999999999;

      this.ensureAmountPaidInit();

      if (inputType.includes('delete') || inputChar === null) {
        this.centsAmountPaid = Math.trunc((this.centsAmountPaid ?? 0) / 10);
      } else if (inputChar && /^\d$/.test(inputChar)) {
        const digit = parseInt(inputChar, 10);
        this.centsAmountPaid = Math.min(MAX_CENTS, (this.centsAmountPaid ?? 0) * 10 + digit);
      } else {
        const raw = ev?.target?.value ?? String(ev ?? '');
        this.centsAmountPaid = this.parsePastedToCents(raw);
      }

      this.updateAmountPaidModel();
      this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
    } catch (e) {
      console.error(e);
    }
  }

  private updateAmountPaidModel(): void {
    const cents = this.centsAmountPaid ?? 0;
    const value = cents / this.centsFactor();
    // actualizar modelo numérico usado por la app
    this.collectService.amountPaid = value;
    // actualizar texto mostrado
    this.displayAmountPaid = this.formatFromCents(cents);
    // llamar a la lógica existente en cada cambio
    if (typeof (this as any).setPartialPay === 'function') this.setPartialPay();
  }

  // --- Paste helpers (normalizar texto pegado a céntimos) ---
  private parsePastedToCents(raw: string | null | undefined): number {
    if (!raw) return 0;
    let text = String(raw).trim();

    // Eliminar símbolos de moneda y espacios, dejar dígitos, puntos, comas y signo menos
    text = text.replace(/[^0-9\.,\-]/g, '');

    // Si contiene ambos, asumimos '.' = miles y ',' = decimal (ej. "1.234,56")
    if (text.indexOf('.') > -1 && text.indexOf(',') > -1) {
      text = text.replace(/\./g, ''); // quitar separador de miles
      text = text.replace(',', '.');  // convertir coma decimal a punto
    } else if (text.indexOf(',') > -1 && text.indexOf('.') === -1) {
      // Solo coma -> coma es decimal (ej. "1234,56")
      text = text.replace(',', '.');
    } else {
      // Solo puntos o ninguno:
      // Si hay múltiples puntos, probablemente son separadores de miles -> quitarlos
      const dotCount = (text.match(/\./g) || []).length;
      if (dotCount > 1) {
        text = text.replace(/\./g, '');
      }
      // Si hay un solo punto, lo dejamos como decimal
    }

    const value = parseFloat(text || '0');
    if (isNaN(value)) return 0;

    // Convertir a céntimos y aplicar límites coherentes con flow de teclado
    const cents = Math.round(value * this.centsFactor());
    const MAX_CENTS = 999999999999;
    return Math.min(MAX_CENTS, Math.max(-MAX_CENTS, cents));
  }

  public onDiscountPaste(ev: ClipboardEvent): void {
    ev.preventDefault();
    const text = ev.clipboardData?.getData('text') ?? '';
    const cents = this.parsePastedToCents(text);
    this.centsDiscount = cents;
    this.updateDiscountModel();
  }

  public onRetentionPaste(ev: ClipboardEvent): void {
    ev.preventDefault();
    const text = ev.clipboardData?.getData('text') ?? '';
    const cents = this.parsePastedToCents(text);
    this.centsRetention = cents;
    this.updateRetentionModel();
  }

  public onRetention2Paste(ev: ClipboardEvent): void {
    ev.preventDefault();
    const text = ev.clipboardData?.getData('text') ?? '';
    const cents = this.parsePastedToCents(text);
    this.centsRetention2 = cents;
    this.updateRetention2Model();
  }


  public onDiscountInput(ev: any): void {
    try {
      const inputChar = typeof ev?.data === 'string' ? ev.data : undefined;
      const inputType = ev?.inputType ?? '';
      const MAX_CENTS = 999999999999;

      this.ensureDiscountInit();

      if (inputType.includes('delete') || inputChar === null) {
        // teclado virtual borró un carácter
        this.centsDiscount = Math.trunc((this.centsDiscount ?? 0) / 10);
      } else if (inputChar && /^\d$/.test(inputChar)) {
        // dígito insertado por teclado virtual: comportarse igual que onDiscountKeyDown
        const digit = parseInt(inputChar, 10);
        this.centsDiscount = Math.min(MAX_CENTS, (this.centsDiscount ?? 0) * 10 + digit);
      } else {
        // pegado o input no estándar: parsear todo el valor
        const raw = ev?.target?.value ?? String(ev ?? '');
        this.centsDiscount = this.parsePastedToCents(raw);
      }

      this.updateDiscountModel();
      this.displayDiscount = this.formatFromCents(this.centsDiscount);
    } catch (e) {
      console.error(e);
    }
  }


  public onRetentionInput(ev: any): void {
    try {
      const inputChar = typeof ev?.data === 'string' ? ev.data : undefined;
      const inputType = ev?.inputType ?? '';
      const MAX_CENTS = 999999999999;

      this.ensureRetentionInit();

      if (inputType.includes('delete') || inputChar === null) {
        this.centsRetention = Math.trunc((this.centsRetention ?? 0) / 10);
      } else if (inputChar && /^\d$/.test(inputChar)) {
        const digit = parseInt(inputChar, 10);
        this.centsRetention = Math.min(MAX_CENTS, (this.centsRetention ?? 0) * 10 + digit);
      } else {
        const raw = ev?.target?.value ?? String(ev ?? '');
        this.centsRetention = this.parsePastedToCents(raw);
      }

      this.updateRetentionModel();
      this.displayRetention = this.formatFromCents(this.centsRetention);
    } catch (e) {
      console.error(e);
    }
  }

  public onRetention2Input(ev: any): void {
    try {
      const inputChar = typeof ev?.data === 'string' ? ev.data : undefined;
      const inputType = ev?.inputType ?? '';
      const MAX_CENTS = 999999999999;

      this.ensureRetention2Init();

      if (inputType.includes('delete') || inputChar === null) {
        this.centsRetention2 = Math.trunc((this.centsRetention2 ?? 0) / 10);
      } else if (inputChar && /^\d$/.test(inputChar)) {
        const digit = parseInt(inputChar, 10);
        this.centsRetention2 = Math.min(MAX_CENTS, (this.centsRetention2 ?? 0) * 10 + digit);
      } else {
        const raw = ev?.target?.value ?? String(ev ?? '');
        this.centsRetention2 = this.parsePastedToCents(raw);
      }

      this.updateRetention2Model();
      this.displayRetention2 = this.formatFromCents(this.centsRetention2);
    } catch (e) {
      console.error(e);
    }
  }

  // --- MANUAL COLLECT DISCOUNT handlers ---
  private syncManualCollectDiscountInput(amount?: number): void {
    if (amount !== undefined) {
      this.manualCollectDiscountAmount = Math.max(0, Number(amount) || 0);
    }
    const factor = this.centsFactor();
    this.centsManualCollectDiscount = Math.round(this.manualCollectDiscountAmount * factor) || 0;
    if (this.manualCollectDiscountAmount > 0) {
      try {
        this.displayManualCollectDiscount = this.currencyService.formatNumber(this.manualCollectDiscountAmount);
      } catch {
        this.displayManualCollectDiscount = this.formatFromCents(this.centsManualCollectDiscount);
      }
    } else {
      this.displayManualCollectDiscount = '';
    }
  }

  private ensureManualCollectDiscountInit(): void {
    if (this.centsManualCollectDiscount !== undefined) return;
    this.syncManualCollectDiscountInput();
  }

  public onManualCollectDiscountKeyDown(ev: any): void {
    const key = String(ev?.key ?? '');
    const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'];
    if (allowed.includes(key)) return;

    this.ensureManualCollectDiscountInit();

    const MAX_CENTS = 999999999999;

    if (/^\d$/.test(key)) {
      this.manualCollectDiscountKeyInFlight = true;
      const digit = parseInt(key, 10);
      this.centsManualCollectDiscount = Math.min(MAX_CENTS, (this.centsManualCollectDiscount ?? 0) * 10 + digit);
      this.updateManualCollectDiscountModel();
      ev.preventDefault();
      setTimeout(() => { this.manualCollectDiscountKeyInFlight = false; }, 0);
      return;
    }

    if (key === 'Backspace') {
      this.manualCollectDiscountKeyInFlight = true;
      this.centsManualCollectDiscount = Math.trunc((this.centsManualCollectDiscount ?? 0) / 10);
      this.updateManualCollectDiscountModel();
      ev.preventDefault();
      setTimeout(() => { this.manualCollectDiscountKeyInFlight = false; }, 0);
      return;
    }

    if (key === 'Delete') {
      this.manualCollectDiscountKeyInFlight = true;
      this.centsManualCollectDiscount = 0;
      this.updateManualCollectDiscountModel();
      ev.preventDefault();
      setTimeout(() => { this.manualCollectDiscountKeyInFlight = false; }, 0);
      return;
    }

    ev.preventDefault();
  }

  public onManualCollectDiscountFocus(): void {
    this.ensureManualCollectDiscountInit();
    if ((this.centsManualCollectDiscount ?? 0) === 0) {
      this.displayManualCollectDiscount = this.formatFromCents(0);
    }
  }

  public onManualCollectDiscountBlur(): void {
    this.ensureManualCollectDiscountInit();
    const parsed = (this.centsManualCollectDiscount ?? 0) / this.centsFactor();
    this.manualCollectDiscountAmount = Math.max(0, parsed);
    try {
      this.displayManualCollectDiscount = parsed > 0
        ? this.currencyService.formatNumber(parsed)
        : '';
    } catch {
      this.displayManualCollectDiscount = this.formatFromCents(this.centsManualCollectDiscount);
    }
  }

  public onManualCollectDiscountInput(ev: any): void {
    if (this.manualCollectDiscountKeyInFlight) {
      this.manualCollectDiscountKeyInFlight = false;
      return;
    }

    try {
      const inputChar = typeof ev?.data === 'string' ? ev.data : undefined;
      const inputType = ev?.inputType ?? '';
      const MAX_CENTS = 999999999999;

      this.ensureManualCollectDiscountInit();

      if (inputType.includes('delete') || inputChar === null) {
        this.centsManualCollectDiscount = Math.trunc((this.centsManualCollectDiscount ?? 0) / 10);
      } else if (inputChar && /^\d$/.test(inputChar)) {
        const digit = parseInt(inputChar, 10);
        this.centsManualCollectDiscount = Math.min(MAX_CENTS, (this.centsManualCollectDiscount ?? 0) * 10 + digit);
      } else {
        const raw = ev?.target?.value ?? String(ev ?? '');
        this.centsManualCollectDiscount = this.parsePastedToCents(raw);
      }

      this.updateManualCollectDiscountModel();
      this.displayManualCollectDiscount = this.formatFromCents(this.centsManualCollectDiscount);
    } catch (e) {
      console.error(e);
    }
  }

  public onManualCollectDiscountPaste(ev: ClipboardEvent): void {
    ev.preventDefault();
    const text = ev.clipboardData?.getData('text') ?? '';
    this.centsManualCollectDiscount = this.parsePastedToCents(text);
    this.updateManualCollectDiscountModel();
  }

  private updateManualCollectDiscountModel(): void {
    const cents = this.centsManualCollectDiscount ?? 0;
    this.manualCollectDiscountAmount = Math.max(0, cents / this.centsFactor());
    this.displayManualCollectDiscount = this.formatFromCents(cents);
  }

  selectCollectDiscount(event: any) {
    const selected = event?.detail?.value ?? this.collectService.selectedCollectDiscounts;
    console.log('selectCollectDiscount - selected ids:', selected);
  }

  isCollectDiscountSelected(id: number): boolean {
    this.disabledCollectDiscountButton = false;
    for (var i = 0; i < this.collectService.tempSelectedCollectDiscounts.length; i++) {
      if (this.collectService.tempSelectedCollectDiscounts[i].requireInput)
        this.disabledCollectDiscountButton = true;
    }

    this.validateCollectDiscountsInputs();
    return Array.isArray(this.collectService.tempSelectedCollectDiscounts) &&
      this.collectService.tempSelectedCollectDiscounts.some(d => d.idCollectDiscount === id);
  }

  openAssignDiscounts() {
    this.manualCollectDiscountAmountBackup = this.manualCollectDiscountAmount;
    this.centsManualCollectDiscount = undefined;
    this.syncManualCollectDiscountInput();
    // Normalize selectedCollectDiscounts into prevSelectedCollectDiscounts
    if (Array.isArray(this.collectService.selectedCollectDiscounts)) {
      this.collectService.prevSelectedCollectDiscounts = (this.collectService.selectedCollectDiscounts as any[]).map(item => {
        if (typeof item === 'number') {
          const found = this.collectService.collectDiscounts.find(cd => cd.idCollectDiscount === item);
          return found ? { ...found } : null;
        } else {
          return { ...item } as CollectDiscounts;
        }
      }).filter((x): x is CollectDiscounts => x !== null);
    } else {
      this.collectService.prevSelectedCollectDiscounts = [];
    }

    // Merge prevSelectedCollectDiscounts with existing tempSelectedCollectDiscounts.
    // Preserve any user edits already present in tempSelectedCollectDiscounts (nuCollectDiscount / naCollectDiscount).
    const existingMap = new Map<number, CollectDiscounts>();
    (this.collectService.tempSelectedCollectDiscounts || []).forEach(t => existingMap.set(t.idCollectDiscount, t));

    this.collectService.tempSelectedCollectDiscounts = this.collectService.prevSelectedCollectDiscounts.map(ps => {
      const existing = existingMap.get(ps.idCollectDiscount);
      if (!existing) return { ...ps };
      return {
        ...ps,
        nuCollectDiscount: existing.nuCollectDiscount ?? ps.nuCollectDiscount,
        naCollectDiscount: existing.naCollectDiscount ?? ps.naCollectDiscount,
        requireInput: ps.requireInput
      };
    });

    this.assignDiscountsOpen = true;
    this.cdr.detectChanges();
  }

  toggleTempSelection(id: number) {
    const d = this.collectService.collectDiscounts.find(cd => cd.idCollectDiscount === id);
    if (!d) return;
    const idx = this.collectService.tempSelectedCollectDiscounts.findIndex(x => x.idCollectDiscount === id);
    if (idx >= 0) {
      // quitar selección
      this.collectService.tempSelectedCollectDiscounts.splice(idx, 1);
      // Recalcular y actualizar flag de bloqueo
      const totalAfterRemoval = this.collectService.tempSelectedCollectDiscounts.reduce((acc, t) => acc + Number(t.nuCollectDiscount ?? 0), 0);
      this.collectService.totalCollectDiscountsSelected = totalAfterRemoval;
      this.disableDiscountCheckboxes = totalAfterRemoval >= 100;
      this.cdr.detectChanges();
      return;
    }

    // Añadir: validar que no supere 100
    const currentTotal = this.collectService.tempSelectedCollectDiscounts.reduce((acc, t) => acc + Number(t.nuCollectDiscount || 0), 0);
    const toAdd = Number(d.nuCollectDiscount ?? 0);
    const candidateTotal = currentTotal + toAdd;

    if (candidateTotal > 100) {
      // No permitir selección que exceda 100
      this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_DISCOUNT_EXCEEDS_100') || 'La suma de descuentos no puede exceder 100%';
      // opcional: abrir alerta si la app usa alertMessageOpen
      this.alertMessageOpen = true;
      return;
    }

    // añadir copia del descuento (guardar todos los campos)
    let na: any, nu: any;
    if (d.requireInput) {
      na = null;
      nu = null;
    } else {
      na = d.naCollectDiscount;
      nu = d.nuCollectDiscount;
    }
    this.collectService.tempSelectedCollectDiscounts.push({ ...d, nuCollectDiscount: nu, naCollectDiscount: na } as any);

    // Si llega exactamente a 100, bloquear los checkboxes
    this.disableDiscountCheckboxes = candidateTotal >= 100;
    this.collectService.totalCollectDiscountsSelected = candidateTotal;
    this.cdr.detectChanges();
  }

  getDiscountSelectionOrder(id: number): number | null {
    const idx = this.collectService.tempSelectedCollectDiscounts.findIndex(x => x.idCollectDiscount === id);
    if (idx < 0) return null;
    const manualOffset = this.hasManualCollectDiscount() ? 1 : 0;
    return idx + 1 + manualOffset;
  }

  clearTempSelection() {
    this.collectService.tempSelectedCollectDiscounts = [];
    this.manualCollectDiscountAmount = 0;
    this.manualCollectDiscountAmountBackup = 0;
    this.centsManualCollectDiscount = 0;
    this.displayManualCollectDiscount = '';
    let index = this.collectService.documentSaleOpen.positionCollecDetails;

    if (Number.isInteger(index) && index >= 0 && index < (this.collectService.collection.collectionDetails?.length ?? 0)) {
      this.collectService.collection.collectionDetails[index].discountComment = this.discountComment;
    }

    this.validate();
    this.disableDiscountCheckboxes = false;
    this.collectService.totalCollectDiscountsSelected = 0;
    this.cdr.detectChanges();
  }

  async acceptCollectDiscounts() {
    this.onManualCollectDiscountBlur();

    this.collectService.selectedCollectDiscounts = this.collectService.tempSelectedCollectDiscounts.map(d => d.idCollectDiscount);

    // aplicar cambios y esperar cálculos antes de cerrar el modal
    await this.applyCollectDiscounts();

    this.assignDiscountsOpen = false;
    this.cdr.detectChanges();

    const selectedIds: number[] = Array.isArray(this.collectService.selectedCollectDiscounts)
      ? this.collectService.selectedCollectDiscounts
      : [];

    // verificar inputs requeridos
    const requiringInput = selectedIds
      .map(id => this.collectService.collectDiscounts.find(cd => cd.idCollectDiscount === id))
      .filter(d => !!d && d!.requireInput);
    if (requiringInput.length > 0) {
      // mantener la validación actual (botón se deshabilita por validateCollectDiscountsInputs)
    }
  }

  cancelCollectDiscounts() {
    // Restore from persisted collection detail discounts for current document
    const idxDetail = this.collectService.documentSaleOpen.positionCollecDetails;
    const details = Number.isInteger(idxDetail) && (idxDetail as number) >= 0
      ? (this.collectService.collection.collectionDetails[idxDetail as number]?.collectionDetailDiscounts ?? [])
      : [];

    const restored: CollectDiscounts[] = details
      .filter(dd => Number(dd?.idCollectDiscount) > 0)
      .map(dd => {
        const base = this.collectService.collectDiscounts.find(cd => cd.idCollectDiscount === dd.idCollectDiscount);
        const merged: CollectDiscounts = {
          ...(base || {} as any),
          idCollectDiscount: dd.idCollectDiscount,
          nuCollectDiscount: (dd as any).nuCollectDiscountOther ?? base?.nuCollectDiscount,
          naCollectDiscount: (dd as any).naCollectDiscountOther ?? base?.naCollectDiscount,
          nuAmountCollectDiscount: (dd as any).nuAmountCollectDiscountOther ?? base?.nuAmountCollectDiscount,
        } as any;
        return merged;
      });

    this.collectService.tempSelectedCollectDiscounts = restored;
    this.collectService.prevSelectedCollectDiscounts = restored.map(d => ({ ...d }));
    const manualFromDetails = this.getManualCollectDiscountFromDetails(details as CollectionDetailDiscounts[]);
    this.manualCollectDiscountAmount = manualFromDetails > 0
      ? manualFromDetails
      : this.manualCollectDiscountAmountBackup;
    this.manualCollectDiscountAmountBackup = this.manualCollectDiscountAmount;
    this.centsManualCollectDiscount = undefined;
    this.syncManualCollectDiscountInput();
    // Keep modal closed
    this.assignDiscountsOpen = false;
    this.cdr.detectChanges();
  }

  public async applyCollectDiscounts() {
    try {
      // saldo base actualizado
      await this.calculateSaldo(this.indexDocumentSaleOpen);

      const selectedIds: number[] = Array.isArray(this.collectService.selectedCollectDiscounts)
        ? this.collectService.selectedCollectDiscounts
        : [];

      // asegurar posición del detalle
      let idxDetail = this.collectService.documentSaleOpen.positionCollecDetails;
      if (!Number.isInteger(idxDetail) || (idxDetail as number) < 0) {
        idxDetail = this.collectService.collection.collectionDetails
          .findIndex(d => d.coDocument === this.collectService.documentSaleOpen.coDocument);
        if ((idxDetail as number) >= 0) this.collectService.documentSaleOpen.positionCollecDetails = idxDetail as number;
      }

      const parteDecimal = Number.parseInt(String(this.globalConfig.get('parteDecimal') ?? '0'), 10) || 0;
      const factor = Math.pow(10, parteDecimal);

      // Siempre recalcular partiendo del saldo original (no del saldo ya descontado)
      /*  const detailBalance = Number(
         Number.isInteger(idxDetail) && (idxDetail as number) >= 0
           ? this.collectService.collection.collectionDetails[idxDetail as number]?.nuBalanceDoc
           : NaN
       ); */
      const documentSale = this.collectService.documentSaleOpen;
      const detailBase = this.collectService.documentSaleOpen.nuAmountBase;
      const percentDiscount = this.collectService.documentSaleOpen.nuAmountDiscount;
      const discountBase = detailBase * percentDiscount;
      let detailBaseNew = detailBase - discountBase;
      const monedaDoc = this.collectService.documentSaleOpen.coCurrency;
      const backupBalance = Number(this.collectService.documentSalesBackup?.[this.indexDocumentSaleOpen]?.nuBalance ?? NaN);
      const currentBalance = Number(this.collectService.documentSaleOpen?.nuBalance ?? NaN);
      let viewBalance = 0;
      if (this.collectService.collection.coCurrency == monedaDoc) {
        viewBalance = Number(this.collectService.documentSalesView?.[this.indexDocumentSaleOpen]?.nuBalance);
      } else {
        viewBalance = this.collectService.convertirMonto(Number(this.collectService.documentSalesView?.[this.indexDocumentSaleOpen]?.nuBalance), this.collectService.collection.nuValueLocal, monedaDoc);
      }

      const candidates = [viewBalance].filter(v => !Number.isNaN(v));
      const baseBalance = candidates.length ? candidates[0] : 0;
      let runningBalance = baseBalance;

      // aplicar descuentos secuencialmente, guardando el monto por iteración
      const calculatedDiscounts: CollectDiscounts[] = [];
      let discountTotal = 0;
      const rawManualDiscount = Number(this.manualCollectDiscountAmount ?? 0);
      const manualDiscount = Number.isFinite(rawManualDiscount) ? Math.max(0, rawManualDiscount) : 0;
      const manualDiscountApplied = Math.min(manualDiscount, Math.max(0, runningBalance));

      if (manualDiscountApplied > 0) {
        detailBaseNew = Math.max(0, detailBaseNew - manualDiscountApplied);
        discountTotal += manualDiscountApplied;
        runningBalance = Number((runningBalance - manualDiscountApplied).toFixed(parteDecimal));
        calculatedDiscounts.push({
          idCollectDiscount: this.MANUAL_COLLECT_DISCOUNT_ID,
          nuCollectDiscount: 0,
          naCollectDiscount: this.MANUAL_COLLECT_DISCOUNT_LABEL,
          requireInput: false,
          nuAmountCollectDiscount: manualDiscountApplied,
          nuAmountCollectDiscountConversion: this.collectService.convertirMonto(
            manualDiscountApplied,
            this.collectService.collection.nuValueLocal,
            this.collectService.documentSaleOpen.coCurrency
          ),
          position: 1
        } as CollectDiscounts);
      }
      this.manualCollectDiscountAmount = manualDiscountApplied;
      this.centsManualCollectDiscount = Math.round(manualDiscountApplied * factor) || 0;

      selectedIds.forEach(id => {
        const temp = this.collectService.tempSelectedCollectDiscounts.find(cd => cd.idCollectDiscount === id);
        const catalog = this.collectService.collectDiscounts.find(cd => cd.idCollectDiscount === id);
        const source = temp ?? catalog;
        if (!source) return;

        const rate = Number(source.nuCollectDiscount ?? 0);
        const stepRaw = (detailBaseNew * rate) / 100;
        const step = Math.round(stepRaw * factor) / factor;
        // Propagar a temp si existe
        if (temp) temp.nuAmountCollectDiscount = step;
        discountTotal += step;
        detailBaseNew -= step;


        const entry: CollectDiscounts = {
          ...source,
          nuAmountCollectDiscount: step,
          position: calculatedDiscounts.length + 1
        } as any;
        calculatedDiscounts.push(entry);



        runningBalance = Number((runningBalance - step).toFixed(parteDecimal));
      });


      const totalDiscounts = calculatedDiscounts.reduce((acc, d) => acc + Number(d.nuCollectDiscount ?? 0), 0);
      let discounts = this.collectService.documentSaleOpen.nuAmountRetention
        + this.collectService.documentSaleOpen.nuAmountRetention2
        + this.collectService.collection.collectionDetails[idxDetail].nuAmountDiscount;
      const newBalance = runningBalance - discounts;
      const isPartialPayment = this.collectService.isPaymentPartial;
      const netToApply = Math.max(0, newBalance);

      if (isPartialPayment) {
        const partialAmount = this.resolvePartialPaymentAmount();
        this.collectService.amountPaid = partialAmount;
        if (this.collectService.documentSaleOpen) {
          this.collectService.documentSaleOpen.nuAmountPaid = partialAmount;
        }
        this.valuePartialPayment = partialAmount;
        this.centsAmountPaid = Math.round((partialAmount ?? 0) * factor);
        this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
      } else {
        const detailRef = Number.isInteger(idxDetail)
          ? this.collectService.collection.collectionDetails[idxDetail as number]
          : undefined;
        const payment = this.collectService.resolveDocumentPaymentAmount({
          grossBalance: baseBalance,
          nuAmountDiscount: detailRef?.nuAmountDiscount,
          nuAmountCollectDiscount: discountTotal,
          nuAmountRetention: this.collectService.documentSaleOpen.nuAmountRetention,
          nuAmountRetention2: this.collectService.documentSaleOpen.nuAmountRetention2,
        });
        this.applyDocumentAmountPaidDisplay(payment);
      }

      this.validateOpenDocumentRetentionTotals(false);

      const amountToApply = Number(this.collectService.amountPaid ?? 0);

      // sincronizar estados de descuentos
      this.collectService.tempSelectedCollectDiscounts = calculatedDiscounts.map(d => ({ ...d }));
      this.collectService.prevSelectedCollectDiscounts = calculatedDiscounts.map(d => ({ ...d }));
      this.collectService.totalCollectDiscounts = discountTotal;
      this.collectService.totalCollectDiscountsSelected = totalDiscounts;
      this.collectService.totalCollectDiscountsView = this.formatNumber(discountTotal);
      this.manualCollectDiscountAmountBackup = this.manualCollectDiscountAmount;

      // actualizar detalle de colección
      if (Number.isInteger(idxDetail) && (idxDetail as number) >= 0) {
        const detail = this.collectService.collection.collectionDetails[idxDetail as number];
        const updated = {
          ...detail,
          nuAmountCollectDiscount: discountTotal,
          nuAmountCollectDiscountConversion: this.collectService.convertirMonto(discountTotal, this.collectService.collection.nuValueLocal, this.collectService.documentSaleOpen.coCurrency),
          nuCollectDiscount: totalDiscounts,
          hasDiscount: discountTotal > 0,
          nuAmountPaid: amountToApply
        };
        const clonedDetails = [...this.collectService.collection.collectionDetails];
        clonedDetails[idxDetail as number] = updated;
        this.collectService.collection.collectionDetails = clonedDetails;
      }

      // sincronizar arrays de documentos (no mutar nuBalance: calculatePayment lo usa como saldo base)
      const ds = [...this.collectService.documentSales];
      if (ds[this.indexDocumentSaleOpen]) {
        ds[this.indexDocumentSaleOpen] = { ...ds[this.indexDocumentSaleOpen], nuAmountPaid: amountToApply };
      }
      this.collectService.documentSales = ds;

      const dsb = [...this.collectService.documentSalesBackup];
      if (dsb[this.indexDocumentSaleOpen]) {
        dsb[this.indexDocumentSaleOpen] = { ...dsb[this.indexDocumentSaleOpen], nuAmountPaid: amountToApply };
      }
      this.collectService.documentSalesBackup = dsb;

      // recalcular documento abierto y totales
      const isDocumentSaved = this.collectService.documentSales[this.indexDocumentSaleOpen]?.isSave === true;
      await Promise.resolve(this.collectService.calculatePayment("", 0, false, !isDocumentSaved));

      if (!isDocumentSaved) {
        this.collectService.onCollectionValidToSend(false);
      }

      // actualizar UI
      this.centsAmountPaid = Math.round((this.collectService.amountPaid ?? 0) * factor);
      this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);

      if (this.hasSelectedOrManualCollectDiscounts()) {
        this.disabledSaveButton = false;
      } else {
        this.validate();
      }

      this.cdr.detectChanges();
    } catch (err) {
      console.error('selectCollectDiscounts error:', err);
    }
  }

  setCollectionDetailDiscounts(index: number, selectedIds: number[]) {
    delete this.collectService.collection.collectionDetails[index].collectionDetailDiscounts;
    this.detailCollectDiscountsPos = -1;
    this.collectService.collection.collectionDetails[index].collectionDetailDiscounts = [] as CollectionDetailDiscounts[];
    const idCollectionDetail = this.collectService.collection.collectionDetails[index].idCollectionDetail!;
    const coCollection = this.collectService.collection.collectionDetails[index].coCollection!;
    const coDocument = this.collectService.collection.collectionDetails[index].coDocument!;
    selectedIds.forEach(id => {
      const discount = this.collectService.collectDiscounts.find(cd => cd.idCollectDiscount === id);
      if (discount) {
        const cdd: CollectionDetailDiscounts = {
          idCollectionDetailDiscount: discount.idCollectDiscount!,
          idCollectionDetail: idCollectionDetail!,
          idCollectDiscount: discount.idCollectDiscount!,
          coCollection: coCollection,
          nuCollectDiscountOther: this.getNuCollectDiscount(discount.idCollectDiscount!),
          naCollectDiscountOther: this.getNaCollectDiscount(discount.idCollectDiscount!),
          nuAmountCollectDiscountOther: this.getNuAmountCollectDiscount(discount.idCollectDiscount!),
          nuAmountCollectDiscountOtherConversion: this.collectService.convertirMonto(this.getNuAmountCollectDiscount(discount.idCollectDiscount!), this.collectService.collection.nuValueLocal, this.collectService.documentSaleOpen.coCurrency),
          posicion: this.detailCollectDiscountsPos + 1,
          coDocument: coDocument
        };
        this.collectService.collection.collectionDetails[index].collectionDetailDiscounts!.push(cdd);
        this.detailCollectDiscountsPos++;
      }
    });

    if (this.hasManualCollectDiscount()) {
      const currencyCode = this.collectService.documentSaleOpen?.coCurrency || this.collectService.collection.coCurrency;
      const manualAmount = Number(this.manualCollectDiscountAmount ?? 0);
      const manualDiscount: CollectionDetailDiscounts = {
        idCollectionDetailDiscount: this.MANUAL_COLLECT_DISCOUNT_ID,
        idCollectionDetail: idCollectionDetail!,
        idCollectDiscount: this.MANUAL_COLLECT_DISCOUNT_ID,
        coCollection: coCollection,
        nuCollectDiscountOther: null,
        naCollectDiscountOther: this.MANUAL_COLLECT_DISCOUNT_LABEL,
        nuAmountCollectDiscountOther: manualAmount,
        nuAmountCollectDiscountOtherConversion: this.collectService.convertirMonto(
          manualAmount,
          this.collectService.collection.nuValueLocal,
          currencyCode
        ),
        posicion: this.detailCollectDiscountsPos + 1,
        coDocument: coDocument
      };
      this.collectService.collection.collectionDetails[index].collectionDetailDiscounts!.push(manualDiscount);
      this.detailCollectDiscountsPos++;
    }


    this.collectService.tempSelectedCollectDiscounts = [];
    this.collectService.prevSelectedCollectDiscounts = [];
    this.collectService.selectedCollectDiscounts = [];
    this.disabledSaveButton = false;
  }

  public getSelectedCollectDiscountsNames(): string {
    const ids: number[] = Array.isArray(this.collectService.selectedCollectDiscounts)
      ? this.collectService.selectedCollectDiscounts
      : [];

    const names: string[] = [];
    if (this.hasManualCollectDiscount()) {
      names.push(`${this.MANUAL_COLLECT_DISCOUNT_LABEL}: ${this.formatNumber(this.manualCollectDiscountAmount)}`);
    }

    const percentageNames = ids.map(id => {
      const d = this.collectService.collectDiscounts.find(cd => cd.idCollectDiscount === id);
      if (!d) return '';
      const rate = d.nuCollectDiscount != null ? String(d.nuCollectDiscount) : '';
      const label = d.naCollectDiscount ? String(d.naCollectDiscount) : '';
      if (rate && label) return `${rate}% - ${label}`;
      if (rate) return `${rate}%`;
      if (label) return label;
      return '';
    }).filter(n => !!n);

    names.push(...percentageNames);
    return names.join(', ');
  }

  public setManualCollectDiscountAmount(value: any): void {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    const cleanValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    this.syncManualCollectDiscountInput(cleanValue);
  }

  public hasSelectedOrManualCollectDiscounts(): boolean {
    return this.collectService.selectedCollectDiscounts.length > 0 || this.hasManualCollectDiscount();
  }

  private hasManualCollectDiscount(): boolean {
    return Number(this.manualCollectDiscountAmount ?? 0) > 0;
  }

  private getManualCollectDiscountFromDetails(discounts: CollectionDetailDiscounts[]): number {
    const manualDiscount = discounts.find(d => Number(d?.idCollectDiscount) === this.MANUAL_COLLECT_DISCOUNT_ID);
    if (!manualDiscount) return 0;
    const amount = Number(manualDiscount.nuAmountCollectDiscountOther ?? 0);
    return Number.isFinite(amount) ? Math.max(0, amount) : 0;
  }

  setNuCollectDiscount(idCollectDiscount: number, nuCollectDiscount: any) {
    // Enforce that totalCollectDiscountsSelected + new value <= 100
    const newVal = Number(nuCollectDiscount);
    if (isNaN(newVal)) return;

    // Sum of other discounts (exclude the one being edited)
    const othersTotal = this.collectService.tempSelectedCollectDiscounts
      .filter(cd => cd.idCollectDiscount !== idCollectDiscount)
      .reduce((acc, t) => acc + Number(t.nuCollectDiscount ?? 0), 0);

    const allowed = Math.max(0, 100 - othersTotal);

    // Find the temp selected discount and update safely
    this.collectService.tempSelectedCollectDiscounts.forEach(cd => {
      if (cd.idCollectDiscount === idCollectDiscount) {
        if (newVal > allowed) {
          // Do not allow values that push total over 100; clamp to allowed and notify
          cd.nuCollectDiscount = allowed;
          this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_DISCOUNT_EXCEEDS_100') || 'La suma de descuentos no puede exceder 100%';
          this.alertMessageOpen = true;
        } else {
          cd.nuCollectDiscount = newVal;
        }
      }
    });

    // Update aggregated total and validation
    const total = this.collectService.tempSelectedCollectDiscounts.reduce((acc, t) => acc + Number(t.nuCollectDiscount ?? 0), 0);
    this.collectService.totalCollectDiscountsSelected = total;
    this.validateCollectDiscountsInputs();
    this.disableDiscountCheckboxes = total >= 100;
    this.cdr.detectChanges();
  }

  setNaCollectDiscount(idCollectDiscount: number, naCollectDiscount: any) {
    this.collectService.tempSelectedCollectDiscounts.forEach(cd => {
      if (cd.idCollectDiscount === idCollectDiscount) {
        cd.naCollectDiscount = naCollectDiscount;
      }
    });
  }

  setNuAmountCollectDiscount(idCollectDiscount: number, nuAmountCollectDiscount: any) {
    this.collectService.tempSelectedCollectDiscounts.forEach(cd => {
      if (cd.idCollectDiscount === idCollectDiscount) {
        cd.nuAmountCollectDiscount = nuAmountCollectDiscount;
      }
    });
  }

  getNuCollectDiscount(idCollectDiscount: number): any {
    const cd = this.collectService.tempSelectedCollectDiscounts.find(cd => cd.idCollectDiscount === idCollectDiscount);
    this.validateCollectDiscountsInputs();
    return cd ? cd.nuCollectDiscount : null;


  }

  getNaCollectDiscount(idCollectDiscount: number): any {
    const cd = this.collectService.tempSelectedCollectDiscounts.find(cd => cd.idCollectDiscount === idCollectDiscount);

    this.validateCollectDiscountsInputs();
    return cd ? cd.naCollectDiscount : null;
  }

  getNuAmountCollectDiscount(idCollectDiscount: number): any {
    const cd = this.collectService.tempSelectedCollectDiscounts.find(cd => cd.idCollectDiscount === idCollectDiscount);

    this.validateCollectDiscountsInputs();
    return cd ? cd.nuAmountCollectDiscount : null;
  }

  validateCollectDiscountsInputs(): boolean {
    // Si no hay selecciones temporales, nada que validar
    if (!Array.isArray(this.collectService.tempSelectedCollectDiscounts) || this.collectService.tempSelectedCollectDiscounts.length === 0) {
      this.disabledCollectDiscountButton = false;
      return true;
    }

    // Buscar al menos un descuento seleccionado que requiera input y tenga campos vacíos/null
    const hasInvalid = this.collectService.tempSelectedCollectDiscounts.some(cd => {
      if (!cd || !cd.requireInput) return false;
      const nu = cd.nuCollectDiscount;
      const na = cd.naCollectDiscount;
      const nuEmpty = nu === null || nu === undefined || String(nu).trim() === '';
      const naEmpty = na === null || na === undefined || String(na).trim() === '';
      return nuEmpty || naEmpty;
    });

    this.disabledCollectDiscountButton = hasInvalid;
    return !hasInvalid;
  }

  // Validación por campo (para mostrar color en inputs)
  isTempCollectDiscountFieldValid(id: number, field: 'nuCollectDiscount' | 'naCollectDiscount'): boolean {
    const cd = this.collectService.tempSelectedCollectDiscounts.find(t => t.idCollectDiscount === id);
    if (!cd) return false;
    if (!cd.requireInput) return true;
    const val = (cd as any)[field];
    if (field === 'nuCollectDiscount') {
      return val !== null && val !== undefined && String(val).trim() !== '' && !isNaN(Number(val));
    }
    return String(val ?? '').trim().length > 0;
  }

  isTempCollectDiscountFieldInvalid(id: number, field: 'nuCollectDiscount' | 'naCollectDiscount'): boolean {
    return !this.isTempCollectDiscountFieldValid(id, field);
  }

  getCollectDiscountPosition(idCollectDiscount: number): number | null {
    const idx = this.collectService.tempSelectedCollectDiscounts.findIndex(cd => cd.idCollectDiscount === idCollectDiscount);
    return idx >= 0 ? idx + 1 : null;
  }

  setDiscountComment() {
    //this.validate();
    let index = this.collectService.documentSaleOpen.positionCollecDetails;
    this.collectService.collection.collectionDetails[index].discountComment = this.discountComment;
    //this.disabledSaveButton = false;
  }

  public hasCollectRetentions(): boolean {
    return this.collectService.retencion && this.collectService.collectRetentions.length > 0;
  }

  public usesLegacyRetentionInputs(): boolean {
    return this.collectService.retencion && !this.hasCollectRetentions();
  }

  private async ensureCollectRetentionsCatalog(): Promise<void> {
    if (!this.collectService.retencion || this.collectService.collectRetentions.length > 0) {
      return;
    }
    const idEnterprise = this.collectService.collection?.idEnterprise;
    if (!idEnterprise) {
      return;
    }
    try {
      await this.collectService.getCollectRetentions(
        this.synchronizationServices.getDatabase(),
        idEnterprise
      );
    } catch (err) {
      console.warn('ensureCollectRetentionsCatalog error:', err);
    }
  }

  public hasAvailableCollectRetentions(): boolean {
    return this.getAvailableCollectRetentions().length > 0;
  }

  public getAvailableCollectRetentions(): CollectRetentions[] {
    const selectedIds = new Set(this.documentRetentionLines.map(line => line.idCollectRetention));
    return this.collectService.collectRetentions.filter(
      retention => !selectedIds.has(retention.idCollectRetention)
    );
  }

  public getSelectedCollectRetentions(): Array<{
    idCollectRetention: number;
    coCollectRetention: string;
    nuAmountRetention: number;
  }> {
    return this.documentRetentionLines;
  }

  public onCollectRetentionSelectionChange(event: CustomEvent): void {
    const rawValue = event?.detail?.value ?? this.selectedCollectRetentionId;
    const idCollectRetention = Number(rawValue);
    if (!Number.isFinite(idCollectRetention) || idCollectRetention <= 0) {
      return;
    }
    const retention = this.collectService.collectRetentions.find(
      item => item.idCollectRetention === idCollectRetention
    );
    if (!retention) {
      return;
    }
    this.documentRetentionLines.push({
      idCollectRetention: retention.idCollectRetention,
      coCollectRetention: retention.coCollectRetention,
      nuAmountRetention: 0,
      nuVoucherRetention: '',
      daVoucherRetention: '',
    });
    this.collectRetentionCentsMap.set(idCollectRetention, 0);
    this.retentionLineVoucherValidMap.set(idCollectRetention, false);
    this.retentionLineDateValidMap.set(idCollectRetention, false);
    this.selectedCollectRetentionId = undefined;
    this.syncOpenRetentionFromLines();
    this.syncAllRetentionLinesValidation();
    this.setAmountTotal();
    this.validate();
  }

  public removeCollectRetention(idCollectRetention: number): void {
    this.documentRetentionLines = this.documentRetentionLines.filter(
      line => line.idCollectRetention !== idCollectRetention
    );
    this.collectRetentionCentsMap.delete(idCollectRetention);
    this.collectRetentionDisplayMap.delete(idCollectRetention);
    this.collectRetentionKeyInFlightMap.delete(idCollectRetention);
    this.retentionLineVoucherValidMap.delete(idCollectRetention);
    this.retentionLineDateValidMap.delete(idCollectRetention);
    this.syncOpenRetentionFromLines();
    const detailIdx = this.collectService.documentSaleOpen?.positionCollecDetails;
    if (detailIdx != null && detailIdx >= 0
      && this.collectService.retencion
      && !this.collectService.missingRetentionValue) {
      this.setCollectionDetailRetentions(detailIdx);
    }
    this.setAmountTotal();
    this.validate();
  }

  public getCollectRetentionName(coCollectRetention: string): string {
    const retention = this.collectService.collectRetentions.find(
      item => item.coCollectRetention === coCollectRetention
    );
    return retention?.naCollectRetention ?? coCollectRetention;
  }

  public getRetentionInputId(idCollectRetention: number): string {
    return `collect-retention-${idCollectRetention}`;
  }

  public getCollectRetentionCents(idCollectRetention: number): number {
    return this.collectRetentionCentsMap.get(idCollectRetention) ?? 0;
  }

  public getCollectRetentionDisplay(idCollectRetention: number): string {
    const display = this.collectRetentionDisplayMap.get(idCollectRetention);
    if (display) {
      return display;
    }
    return this.formatFromCents(this.getCollectRetentionCents(idCollectRetention));
  }

  private ensureCollectRetentionInit(idCollectRetention: number): void {
    if (this.collectRetentionCentsMap.has(idCollectRetention)) {
      return;
    }
    const line = this.documentRetentionLines.find(item => item.idCollectRetention === idCollectRetention);
    const base = Number(line?.nuAmountRetention ?? 0);
    const factor = this.centsFactor();
    const cents = Math.round(base * factor) || 0;
    this.collectRetentionCentsMap.set(idCollectRetention, cents);
    this.collectRetentionDisplayMap.set(idCollectRetention, this.formatFromCents(cents));
  }

  public onCollectRetentionKeyDown(idCollectRetention: number, ev: KeyboardEvent): void {
    const key = String(ev?.key ?? '');
    const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'];
    if (allowed.includes(key)) {
      return;
    }

    this.ensureCollectRetentionInit(idCollectRetention);
    const MAX_CENTS = 999999999999;
    const current = this.collectRetentionCentsMap.get(idCollectRetention) ?? 0;

    if (/^\d$/.test(key)) {
      this.collectRetentionKeyInFlightMap.set(idCollectRetention, true);
      const digit = parseInt(key, 10);
      this.collectRetentionCentsMap.set(
        idCollectRetention,
        Math.min(MAX_CENTS, current * 10 + digit)
      );
      this.updateCollectRetentionModel(idCollectRetention);
      ev.preventDefault();
      setTimeout(() => this.collectRetentionKeyInFlightMap.set(idCollectRetention, false), 0);
      return;
    }

    if (key === 'Backspace') {
      this.collectRetentionKeyInFlightMap.set(idCollectRetention, true);
      this.collectRetentionCentsMap.set(idCollectRetention, Math.trunc(current / 10));
      this.updateCollectRetentionModel(idCollectRetention);
      ev.preventDefault();
      setTimeout(() => this.collectRetentionKeyInFlightMap.set(idCollectRetention, false), 0);
      return;
    }

    if (key === 'Delete') {
      this.collectRetentionKeyInFlightMap.set(idCollectRetention, true);
      this.collectRetentionCentsMap.set(idCollectRetention, 0);
      this.updateCollectRetentionModel(idCollectRetention);
      ev.preventDefault();
      setTimeout(() => this.collectRetentionKeyInFlightMap.set(idCollectRetention, false), 0);
      return;
    }

    ev.preventDefault();
  }

  public onCollectRetentionFocus(idCollectRetention: number): void {
    this.ensureCollectRetentionInit(idCollectRetention);
    if ((this.collectRetentionCentsMap.get(idCollectRetention) ?? 0) === 0) {
      this.collectRetentionDisplayMap.set(idCollectRetention, this.formatFromCents(0));
    }
  }

  public onCollectRetentionBlur(idCollectRetention: number): void {
    this.ensureCollectRetentionInit(idCollectRetention);
    const cents = this.collectRetentionCentsMap.get(idCollectRetention) ?? 0;
    const parsed = cents / this.centsFactor();
    const line = this.documentRetentionLines.find(item => item.idCollectRetention === idCollectRetention);
    if (line) {
      line.nuAmountRetention = parsed;
    }
    try {
      this.collectRetentionDisplayMap.set(
        idCollectRetention,
        this.currencyService.formatNumber(parsed)
      );
    } catch {
      this.collectRetentionDisplayMap.set(idCollectRetention, this.formatFromCents(cents));
    }
    this.syncOpenRetentionFromLines();
    this.validateRetentionLineDate(idCollectRetention);
    this.syncAllRetentionLinesValidation();
    this.setAmountTotal();
    this.validateOpenDocumentRetentionTotals(true);
    this.validate();
    this.cdr.detectChanges();
  }

  public onCollectRetentionPaste(idCollectRetention: number, ev: ClipboardEvent): void {
    ev.preventDefault();
    this.ensureCollectRetentionInit(idCollectRetention);
    const text = ev.clipboardData?.getData('text') ?? '';
    this.collectRetentionCentsMap.set(idCollectRetention, this.parsePastedToCents(text));
    this.updateCollectRetentionModel(idCollectRetention);
  }

  public onCollectRetentionInput(idCollectRetention: number, ev: Event): void {
    if (this.collectRetentionKeyInFlightMap.get(idCollectRetention)) {
      return;
    }

    try {
      const inputEvent = ev as InputEvent;
      const inputChar = typeof inputEvent?.data === 'string' ? inputEvent.data : undefined;
      const inputType = inputEvent?.inputType ?? '';
      const MAX_CENTS = 999999999999;

      this.ensureCollectRetentionInit(idCollectRetention);
      const current = this.collectRetentionCentsMap.get(idCollectRetention) ?? 0;

      if (inputType.includes('delete') || inputChar === null) {
        this.collectRetentionCentsMap.set(idCollectRetention, Math.trunc(current / 10));
      } else if (inputChar && /^\d$/.test(inputChar)) {
        const digit = parseInt(inputChar, 10);
        this.collectRetentionCentsMap.set(
          idCollectRetention,
          Math.min(MAX_CENTS, current * 10 + digit)
        );
      } else {
        const input = ev.target as HTMLInputElement | null;
        const raw = input?.value ?? String(ev ?? '');
        this.collectRetentionCentsMap.set(idCollectRetention, this.parsePastedToCents(raw));
      }

      this.updateCollectRetentionModel(idCollectRetention);
    } catch (err) {
      console.error(err);
    }
  }

  private updateCollectRetentionModel(idCollectRetention: number): void {
    const cents = this.collectRetentionCentsMap.get(idCollectRetention) ?? 0;
    const value = cents / this.centsFactor();
    const line = this.documentRetentionLines.find(item => item.idCollectRetention === idCollectRetention);
    if (line) {
      line.nuAmountRetention = value;
    }
    this.collectRetentionDisplayMap.set(idCollectRetention, this.formatFromCents(cents));
    this.syncOpenRetentionFromLines();
    this.setAmountTotal();
    this.validateOpenDocumentRetentionTotals(false);
    this.validate();
    this.cdr.detectChanges();
  }

  private getDocumentRetentionTotal(): number {
    if (this.documentRetentionLines.length > 0) {
      return this.documentRetentionLines.reduce(
        (sum, line) => sum + Number(line.nuAmountRetention ?? 0),
        0
      );
    }
    return Number(this.collectService.documentSaleOpen?.nuAmountRetention ?? 0)
      + Number(this.collectService.documentSaleOpen?.nuAmountRetention2 ?? 0);
  }

  private syncOpenRetentionFromLines(): void {
    const total = this.getDocumentRetentionTotal();
    const cs = this.collectService;
    const index = cs.indexDocumentSaleOpen;

    cs.documentSaleOpen.nuAmountRetention = total;
    cs.documentSaleOpen.nuAmountRetention2 = 0;

    if (index >= 0) {
      cs.documentSales[index].nuAmountRetention = total;
      cs.documentSalesBackup[index].nuAmountRetention = total;
      cs.documentSales[index].nuAmountRetention2 = 0;
      cs.documentSalesBackup[index].nuAmountRetention2 = 0;
    }
  }

  private hydrateDocumentRetentionLines(positionCollecDetails: number): void {
    this.clearDocumentRetentionState();
    const detail = this.collectService.collection.collectionDetails?.[positionCollecDetails];
    if (!detail) {
      return;
    }

    const persisted = (detail.collectionDetailRetentions ?? []).filter(
      item => Number(item.nuAmountRetention ?? 0) > 0 && Number(item.idCollectRetention ?? 0) > 0
    );
    if (persisted.length > 0) {
      this.applyDocumentRetentionLinesFromPersisted(persisted);
      this.syncOpenRetentionFromLines();
      this.finalizeHydratedRetentionAmounts();
      return;
    }

    const legacyIva = Number(detail.nuAmountRetention ?? 0);
    const legacyIslr = Number(detail.nuAmountRetention2 ?? 0);
    if (legacyIva > 0 || legacyIslr > 0) {
      this.hydrateLegacyRetentionLines(legacyIva, legacyIslr);
      this.syncOpenRetentionFromLines();
      this.finalizeHydratedRetentionAmounts();
    }
  }

  private applyDocumentRetentionLinesFromPersisted(
    persisted: CollectionDetailRetentions[]
  ): void {
    this.documentRetentionLines = persisted.map(item => ({
      idCollectRetention: Number(item.idCollectRetention),
      coCollectRetention: item.coCollectRetention,
      nuAmountRetention: Number(item.nuAmountRetention ?? 0),
      nuVoucherRetention: String(item.nuVoucherRetention ?? ''),
      daVoucherRetention: String(item.daVoucherRetention ?? '').split('T')[0],
    }));
    this.documentRetentionLines.forEach(line => {
      this.initCollectRetentionDisplayMaps(line.idCollectRetention, line.nuAmountRetention);
      this.validateRetentionLineVoucher(line.idCollectRetention, false);
      this.validateRetentionLineDate(line.idCollectRetention);
    });
  }

  private hydrateLegacyRetentionLines(legacyIva: number, legacyIslr: number): void {
    const catalog = this.collectService.collectRetentions;
    const detailIdx = this.collectService.documentSaleOpen?.positionCollecDetails;
    const detail = detailIdx != null && detailIdx >= 0
      ? this.collectService.collection.collectionDetails?.[detailIdx]
      : undefined;
    const legacyVoucher = String(detail?.nuVoucherRetention ?? this.collectService.documentSaleOpen?.nuVaucherRetention ?? '').trim();
    const legacyDate = String(detail?.daVoucher ?? this.collectService.documentSaleOpen?.daVoucher ?? '').split('T')[0].trim();

    if (legacyIva > 0 && catalog[0]) {
      this.documentRetentionLines.push({
        idCollectRetention: catalog[0].idCollectRetention,
        coCollectRetention: catalog[0].coCollectRetention,
        nuAmountRetention: legacyIva,
        nuVoucherRetention: legacyVoucher,
        daVoucherRetention: legacyDate,
      });
    }
    if (legacyIslr > 0 && catalog[1]) {
      this.documentRetentionLines.push({
        idCollectRetention: catalog[1].idCollectRetention,
        coCollectRetention: catalog[1].coCollectRetention,
        nuAmountRetention: legacyIslr,
        nuVoucherRetention: '',
        daVoucherRetention: '',
      });
    }
    this.documentRetentionLines.forEach(line => {
      this.initCollectRetentionDisplayMaps(line.idCollectRetention, line.nuAmountRetention);
      this.validateRetentionLineVoucher(line.idCollectRetention, false);
      this.validateRetentionLineDate(line.idCollectRetention);
    });
  }

  private initCollectRetentionDisplayMaps(idCollectRetention: number, amount: number): void {
    const factor = this.centsFactor();
    const normalizedAmount = Number(amount ?? 0);
    const cents = Math.round(normalizedAmount * factor);
    this.collectRetentionCentsMap.set(idCollectRetention, cents);
    try {
      this.collectRetentionDisplayMap.set(
        idCollectRetention,
        normalizedAmount > 0 ? this.currencyService.formatNumber(normalizedAmount) : this.formatFromCents(0)
      );
    } catch {
      this.collectRetentionDisplayMap.set(idCollectRetention, this.formatFromCents(cents));
    }
  }

  private flushCollectRetentionLinesBeforeSave(): void {
    if (!this.collectService.retencion || this.documentRetentionLines.length === 0) {
      return;
    }

    const factor = this.centsFactor();
    this.documentRetentionLines.forEach(line => {
      const cents = this.collectRetentionCentsMap.get(line.idCollectRetention);
      if (cents != null) {
        line.nuAmountRetention = cents / factor;
      }
    });
    this.syncOpenRetentionFromLines();
  }

  private async ensurePersistedDetailRetentionsLoaded(positionCollecDetails: number): Promise<void> {
    const detail = this.collectService.collection.collectionDetails?.[positionCollecDetails];
    if (!detail || this.collectService.collection.stDelivery !== 3) {
      return;
    }

    const hasDynamic = (detail.collectionDetailRetentions ?? []).some(
      line => Number(line.nuAmountRetention ?? 0) > 0 && Number(line.idCollectRetention ?? 0) > 0
    );
    if (hasDynamic) {
      return;
    }

    const coCollection = this.collectService.collection.coCollection;
    if (!coCollection) {
      return;
    }

    try {
      const retentions = await this.collectService.getCollectionDetailsRetentions(
        this.synchronizationServices.getDatabase(),
        coCollection,
      );
      this.collectService.attachCollectionDetailRetentionsToDetails(
        this.collectService.collection.collectionDetails,
        retentions || [],
        coCollection,
      );
    } catch (err) {
      console.warn('ensurePersistedDetailRetentionsLoaded error:', err);
    }
  }

  private finalizeHydratedRetentionAmounts(): void {
    if (this.getDocumentRetentionTotal() <= 0) {
      return;
    }
    this.syncOpenRetentionFromLines();
    this.syncAllRetentionLinesValidation();
    if (!this.collectService.isPaymentPartial) {
      this.setAmountTotal();
    }
  }

  private setCollectionDetailRetentions(index: number): void {
    const detail = this.collectService.collection.collectionDetails[index];
    if (!detail) {
      return;
    }

    this.detailCollectRetentionsPos = 0;
    detail.collectionDetailRetentions = [] as CollectionDetailRetentions[];
    const coCollection = detail.coCollection ?? this.collectService.collection.coCollection;
    const coDocument = this.collectService.normalizeCoDocument(
      detail.coDocument ?? this.collectService.documentSaleOpen.coDocument
    );

    this.documentRetentionLines.forEach(line => {
      const amount = Number(line.nuAmountRetention ?? 0);
      if (amount <= 0) {
        return;
      }
      const retentionLine = this.collectService.normalizeCollectionDetailRetentionLine(
        {
          idCollectionDetailRetention: null,
          idCollectionDetail: index,
          coCollection: coCollection,
          coDocument: coDocument,
          idCollectRetention: line.idCollectRetention,
          coCollectRetention: line.coCollectRetention,
          nuAmountRetention: amount,
          nuAmountRetentionConversion: this.collectService.resolveDetailRetentionLineConversion(
            amount,
            detail,
            this.collectService.documentSaleOpen
          ),
          nuVoucherRetention: String(line.nuVoucherRetention ?? '').trim(),
          daVoucherRetention: String(line.daVoucherRetention ?? '').split('T')[0].trim(),
          posicion: this.detailCollectRetentionsPos + 1,
        },
        coCollection,
        coDocument,
        index,
        this.detailCollectRetentionsPos
      );
      detail.collectionDetailRetentions!.push(retentionLine);
      this.detailCollectRetentionsPos++;
    });

    this.collectService.syncDetailRetentionAmountsAndConversions(
      detail,
      this.collectService.documentSaleOpen,
      index
    );
    this.collectService.syncLegacyDetailFieldsFromFirstRetentionLine(
      detail,
      this.documentRetentionLines,
      this.collectService.documentSaleOpen,
    );
  }

  private clearDocumentRetentionState(): void {
    this.documentRetentionLines = [];
    this.collectRetentionCentsMap.clear();
    this.collectRetentionDisplayMap.clear();
    this.collectRetentionKeyInFlightMap.clear();
    this.retentionLineVoucherValidMap.clear();
    this.retentionLineDateValidMap.clear();
    this.selectedCollectRetentionId = undefined;
    this.detailCollectRetentionsPos = 0;
  }

}
