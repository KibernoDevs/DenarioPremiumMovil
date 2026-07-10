import { Component, OnInit, Input, inject } from '@angular/core';

import { Retention } from 'src/app/modelos/retention';
import { CollectionDetail, CollectionDetailRetentions } from 'src/app/modelos/tables/collection';
import { CollectRetentions } from 'src/app/modelos/tables/collectRetentions';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { COLLECT_STATUS_SAVED, COLLECT_STATUS_SENT, COLLECT_STATUS_TO_SEND, COLLECT_STATUS_NEW } from 'src/app/utils/appConstants';


@Component({
  selector: 'app-cobro-total',
  templateUrl: './cobro-total.component.html',
  styleUrls: ['./cobro-total.component.scss'],
  standalone: false
})
export class CobroTotalComponent implements OnInit {

  @Input()
  cobroTotalTags = new Map<string, string>([]);

  public collectService = inject(CollectionService);
  public globalConfig = inject(GlobalConfigService);
  public currencyService = inject(CurrencyService)
  public dateServ = inject(DateServiceService);
  public synchronizationServices = inject(SynchronizationDBService);
  public COLLECT_STATUS_SAVED = COLLECT_STATUS_SAVED;
  public COLLECT_STATUS_SENT = COLLECT_STATUS_SENT;
  public COLLECT_STATUS_TO_SEND = COLLECT_STATUS_TO_SEND;
  public COLLECT_STATUS_NEW = COLLECT_STATUS_NEW;

  public disabledButton: Boolean = true;
  public fechaHoy = '';
  public selectedManualRetentionId?: number;
  public manualRetentionLines: Array<{
    idCollectRetention: number;
    coCollectRetention: string;
    nuAmountRetention: number;
    nuVoucherRetention: string;
    daVoucherRetention: string;
  }> = [];

  constructor() {
  }

  ngOnInit() {
    this.fechaHoy = this.dateServ.hoyISO().split('T')[0];
    if (this.collectService.calculateDifference) {
      this.calculateDifDocsNegativos();
    }
  }


  imprimir() {
    console.log(this.collectService.collection)
  }



  addRetencion() {
    this.collectService.addRetention = true;
    this.collectService.retention = new Retention;
    this.resetManualRetentionState();
    if (this.usesDynamicRetentionTotalization()) {
      void this.ensureManualCollectRetentionsCatalog();
    }
  }

  private resetManualRetentionState(): void {
    this.manualRetentionLines = [];
    this.selectedManualRetentionId = undefined;
  }

  private async ensureManualCollectRetentionsCatalog(): Promise<void> {
    if (this.collectService.collectRetentions.length > 0) {
      return;
    }
    const idEnterprise = this.collectService.collection?.idEnterprise;
    if (!idEnterprise) {
      return;
    }
    try {
      await this.collectService.getCollectRetentions(
        this.synchronizationServices.getDatabase(),
        idEnterprise,
      );
    } catch (err) {
      console.warn('ensureManualCollectRetentionsCatalog error:', err);
    }
  }

  hasManualCollectRetentions(): boolean {
    return this.usesDynamicRetentionTotalization()
      && this.collectService.collectRetentions.length > 0;
  }

  hasAvailableManualCollectRetentions(): boolean {
    return this.getAvailableManualCollectRetentions().length > 0;
  }

  getAvailableManualCollectRetentions(): CollectRetentions[] {
    const selectedIds = new Set(this.manualRetentionLines.map(line => line.idCollectRetention));
    return this.collectService.collectRetentions.filter(
      retention => !selectedIds.has(retention.idCollectRetention),
    );
  }

  onManualCollectRetentionSelectionChange(event: CustomEvent): void {
    const rawValue = event?.detail?.value ?? this.selectedManualRetentionId;
    const idCollectRetention = Number(rawValue);
    if (!Number.isFinite(idCollectRetention) || idCollectRetention <= 0) {
      return;
    }
    const retention = this.collectService.collectRetentions.find(
      item => item.idCollectRetention === idCollectRetention,
    );
    if (!retention) {
      return;
    }
    this.manualRetentionLines.push({
      idCollectRetention: retention.idCollectRetention,
      coCollectRetention: retention.coCollectRetention,
      nuAmountRetention: 0,
      nuVoucherRetention: '',
      daVoucherRetention: '',
    });
    this.selectedManualRetentionId = undefined;
    this.validate();
  }

  removeManualCollectRetention(idCollectRetention: number): void {
    this.manualRetentionLines = this.manualRetentionLines.filter(
      line => line.idCollectRetention !== idCollectRetention,
    );
    this.validate();
  }

  getManualCollectRetentionName(coCollectRetention: string): string {
    const retention = this.collectService.collectRetentions.find(
      item => item.coCollectRetention === coCollectRetention,
    );
    return retention?.naCollectRetention ?? coCollectRetention;
  }

  getManualRetentionLine(idCollectRetention: number) {
    return this.manualRetentionLines.find(line => line.idCollectRetention === idCollectRetention);
  }

  getManualRetentionCalendarTriggerId(idCollectRetention: number): string {
    return `manual-retention-calendar-${idCollectRetention}`;
  }

  setManualRetentionLineDaVoucher(idCollectRetention: number, event?: CustomEvent): void {
    const line = this.getManualRetentionLine(idCollectRetention);
    if (!line) {
      return;
    }
    const rawValue = event?.detail?.value ?? line.daVoucherRetention;
    if (rawValue != null && String(rawValue).trim() !== '') {
      line.daVoucherRetention = String(rawValue).split('T')[0];
    }
    this.validate();
  }

  getManualRetentionVoucherMaxDigits(idCollectRetention: number): number {
    const type = this.collectService.collectRetentions.find(
      item => item.idCollectRetention === idCollectRetention,
    );
    return Math.max(0, Number(type?.nuVoucherLength ?? 0));
  }

  isManualRetentionVoucherMandatory(idCollectRetention: number): boolean {
    const type = this.collectService.collectRetentions.find(
      item => item.idCollectRetention === idCollectRetention,
    );
    return type?.requireInput === true;
  }

  shouldUseManualNumericRetentionVoucherInput(idCollectRetention: number): boolean {
    return this.getManualRetentionVoucherMaxDigits(idCollectRetention) > 0;
  }

  shouldShowManualRetentionLineDateValidBorder(idCollectRetention: number): boolean {
    const line = this.getManualRetentionLine(idCollectRetention);
    return String(line?.daVoucherRetention ?? '').trim().length > 0;
  }

  shouldShowManualRetentionLineDateInvalidBorder(idCollectRetention: number): boolean {
    return !this.shouldShowManualRetentionLineDateValidBorder(idCollectRetention);
  }

  isManualRetentionLineVoucherValid(idCollectRetention: number): boolean {
    const line = this.getManualRetentionLine(idCollectRetention);
    if (!line) {
      return false;
    }
    const voucher = String(line.nuVoucherRetention ?? '').trim();
    const mandatory = this.isManualRetentionVoucherMandatory(idCollectRetention);
    const requiredLength = this.getManualRetentionVoucherMaxDigits(idCollectRetention);
    if (!voucher) {
      return !mandatory;
    }
    if (requiredLength > 0 && voucher.length !== requiredLength) {
      return false;
    }
    return true;
  }

  shouldShowManualRetentionLineVoucherValidBorder(idCollectRetention: number): boolean {
    const line = this.getManualRetentionLine(idCollectRetention);
    const hasValue = String(line?.nuVoucherRetention ?? '').trim().length > 0;
    return hasValue && this.isManualRetentionLineVoucherValid(idCollectRetention);
  }

  shouldShowManualRetentionLineVoucherInvalidBorder(idCollectRetention: number): boolean {
    if (this.shouldShowManualRetentionLineVoucherValidBorder(idCollectRetention)) {
      return false;
    }
    const line = this.getManualRetentionLine(idCollectRetention);
    const hasValue = String(line?.nuVoucherRetention ?? '').trim().length > 0;
    if (hasValue) {
      return true;
    }
    return this.isManualRetentionVoucherMandatory(idCollectRetention);
  }

  shouldShowManualCollectRetentionAmountValidBorder(idCollectRetention: number): boolean {
    const line = this.getManualRetentionLine(idCollectRetention);
    return Number(line?.nuAmountRetention ?? 0) > 0;
  }

  shouldShowManualCollectRetentionAmountInvalidBorder(idCollectRetention: number): boolean {
    return !this.shouldShowManualCollectRetentionAmountValidBorder(idCollectRetention);
  }

  setManualRetentionLineVoucher(idCollectRetention: number, value: string): void {
    const line = this.getManualRetentionLine(idCollectRetention);
    if (!line) {
      return;
    }
    let sanitized = value ?? '';
    const maxDigits = this.getManualRetentionVoucherMaxDigits(idCollectRetention);
    if (maxDigits > 0) {
      sanitized = sanitized.replace(/\D/g, '').slice(0, maxDigits);
    }
    line.nuVoucherRetention = sanitized;
    this.validate();
  }

  getManualRetentionTotal(): number {
    return this.manualRetentionLines.reduce(
      (sum, line) => sum + Number(line.nuAmountRetention ?? 0),
      0,
    );
  }

  private validateManualRetentionBeforeSave(): boolean {
    const coDocument = String(this.collectService.retention.coDocument ?? '').trim();
    if (!coDocument) {
      return false;
    }

    const activeLines = this.manualRetentionLines.filter(
      line => Number(line.nuAmountRetention ?? 0) > 0,
    );
    if (activeLines.length === 0) {
      return false;
    }

    return activeLines.every(line => {
      const hasDate = String(line.daVoucherRetention ?? '').trim().length > 0;
      return hasDate && this.isManualRetentionLineVoucherValid(line.idCollectRetention);
    });
  }

  private saveDynamicRetentionDetail(): void {
    const daVoucher = this.dateServ.hoyISO();
    const nuValueLocal = this.collectService.collection.nuValueLocal;
    const coCurrency = this.collectService.collection.coCurrency;
    const coCollection = this.collectService.collection.coCollection;
    const coDocument = this.collectService.retention.coDocument;
    const detailIndex = this.collectService.collection.collectionDetails.length;
    const detailRetentions: CollectionDetailRetentions[] = [];
    let lineIndex = 0;

    for (const line of this.manualRetentionLines) {
      const amount = Number(line.nuAmountRetention ?? 0);
      if (amount <= 0) {
        continue;
      }
      detailRetentions.push(this.collectService.normalizeCollectionDetailRetentionLine(
        {
          idCollectionDetailRetention: null,
          idCollectionDetail: detailIndex,
          coCollection,
          coDocument,
          idCollectRetention: line.idCollectRetention,
          coCollectRetention: line.coCollectRetention,
          nuAmountRetention: amount,
          nuAmountRetentionConversion: this.collectService.convertirMonto(amount, nuValueLocal, coCurrency),
          posicion: lineIndex + 1,
          nuVoucherRetention: line.nuVoucherRetention,
          daVoucherRetention: line.daVoucherRetention,
        },
        coCollection,
        coDocument,
        detailIndex,
        lineIndex,
      ));
      lineIndex++;
    }

    const detail: CollectionDetail = {
      coCollection,
      coDocument,
      idDocument: 0,
      inPaymentPartial: false,
      nuVoucherRetention: detailRetentions[0]?.nuVoucherRetention ?? '',
      nuAmountRetention: 0,
      nuAmountRetention2: 0,
      nuAmountRetentionConversion: 0,
      nuAmountRetentionIvaConversion: 0,
      nuAmountRetention2Conversion: 0,
      nuAmountRetentionIslrConversion: 0,
      nuAmountPaid: 0,
      nuAmountPaidConversion: 0,
      nuAmountDiscount: 0,
      nuAmountDiscountConversion: 0,
      nuAmountDoc: 0,
      nuAmountDocConversion: 0,
      daDocument: daVoucher.split('T')[0],
      nuBalanceDoc: 0,
      nuBalanceDocConversion: 0,
      nuBalanceDocOriginal: 0,
      nuBalanceDocOriginalConversion: 0,
      coOriginal: '',
      coTypeDoc: '',
      nuValueLocal,
      nuAmountIgtf: 0,
      nuAmountIgtfConversion: 0,
      st: 0,
      isSave: true,
      daVoucher: detailRetentions[0]?.daVoucherRetention ?? daVoucher.split('T')[0],
      hasDiscount: false,
      discountComment: '',
      nuAmountCollectDiscount: 0,
      nuCollectDiscount: 0,
      missingRetention: this.collectService.missingRetentionValue,
      nuAmountCollectDiscountConversion: 0,
      collectionDetailRetentions: detailRetentions,
    };

    this.collectService.syncDetailRetentionAmountsAndConversions(detail, undefined, detailIndex);
    detail.nuAmountPaid = this.getDetailRetentionLinesTotal(detail);
    detail.nuAmountPaidConversion = this.currencyService.cleanFormattedNumber(
      this.currencyService.formatNumber(
        this.collectService.convertirMonto(detail.nuAmountPaid, nuValueLocal, coCurrency),
      ),
    );
    this.collectService.collection.collectionDetails.push(detail);
  }

  deleteRetention(index: number) {
    console.log(index);
    const coDocument = this.collectService.collection.collectionDetails[index].coDocument;
    // Buscar y deseleccionar en documentSales
    const docSale = this.collectService.documentSales.find(d => d.coDocument == coDocument);
    if (docSale) docSale.isSelected = false;
    // Buscar y deseleccionar en documentSalesBackup
    const docSaleBackup = this.collectService.documentSalesBackup.find(d => d.coDocument == coDocument);
    if (docSaleBackup) docSaleBackup.isSelected = false;

    const docSaleBackupView = this.collectService.documentSalesView.find(d => d.coDocument == coDocument);
    if (docSaleBackupView) docSaleBackupView.isSelected = false;
    // Eliminar el detalle
    this.collectService.collection.collectionDetails.splice(index, 1);
    if (this.collectService.collection.collectionDetails.length == 0)
      this.collectService.onCollectionValidToSend(false);
    else
      void this.collectService.calculatePayment('', 0, true);
  }

  saveRetention(isSave: Boolean) {
    console.log(isSave);
    if (isSave) {
      if (this.usesDynamicRetentionTotalization()) {
        if (!this.validateManualRetentionBeforeSave()) {
          return;
        }
        this.saveDynamicRetentionDetail();
      } else {
        let daVoucher = this.dateServ.hoyISO();
        const nuValueLocal = this.collectService.collection.nuValueLocal;
        const coCurrency = this.collectService.collection.coCurrency;
        const ivaConversion = this.collectService.convertirMonto(
          this.collectService.retention.nuAmountRetention,
          nuValueLocal,
          coCurrency,
        );
        const islrConversion = this.collectService.convertirMonto(
          this.collectService.retention.nuAmountRetention2,
          nuValueLocal,
          coCurrency,
        );
        const retentionTotalConversion = ivaConversion + islrConversion;
        this.collectService.collection.collectionDetails.push({
          coCollection: this.collectService.collection.coCollection,
          coDocument: this.collectService.retention.coDocument,
          idDocument: 0,
          inPaymentPartial: false,
          nuVoucherRetention: this.collectService.retention.nuVoucherRetention,
          nuAmountRetention: this.collectService.retention.nuAmountRetention,
          nuAmountRetention2: this.collectService.retention.nuAmountRetention2,
          nuAmountRetentionConversion: ivaConversion,
          nuAmountRetentionIvaConversion: ivaConversion,
          nuAmountRetention2Conversion: islrConversion,
          nuAmountRetentionIslrConversion: islrConversion,
          nuAmountPaid: this.collectService.retention.nuAmountPaid,
          nuAmountPaidConversion: this.currencyService.cleanFormattedNumber(
            this.currencyService.formatNumber(retentionTotalConversion),
          ),
          nuAmountDiscount: 0,
          nuAmountDiscountConversion: 0,
          nuAmountDoc: 0,
          nuAmountDocConversion: 0,
          daDocument: daVoucher.split("T")[0],
          nuBalanceDoc: 0,
          nuBalanceDocConversion: 0,
          nuBalanceDocOriginal: 0,
          nuBalanceDocOriginalConversion: 0,
          coOriginal: "",
          coTypeDoc: "",
          nuValueLocal: nuValueLocal,
          nuAmountIgtf: 0,
          nuAmountIgtfConversion: 0,
          st: 0,
          isSave: true,
          daVoucher: daVoucher.split("T")[0],
          hasDiscount: false,
          discountComment: "",
          nuAmountCollectDiscount: 0,
          nuCollectDiscount: 0,
          missingRetention: this.collectService.missingRetentionValue,
          nuAmountCollectDiscountConversion: 0,
        });
      }
    }
    this.collectService.addRetention = false;
    this.resetManualRetentionState();
    this.validate();
    void this.collectService.calculatePayment('', 0, true);
    this.collectService.validateToSend();
  }

  validate() {
    if (this.usesDynamicRetentionTotalization()) {
      const coDocument = String(this.collectService.retention?.coDocument ?? '').trim();
      const total = this.getManualRetentionTotal();
      this.collectService.retention.nuAmountPaid = total;
      this.disabledButton = coDocument.length > 0 && total > 0 && this.validateManualRetentionBeforeSave();
      return;
    }

    this.collectService.retention.nuAmountPaid =
      this.collectService.retention.nuAmountRetention + this.collectService.retention.nuAmountRetention2;

    if (this.collectService.retention.nuAmountPaid > 0)
      this.disabledButton = false;
    else
      this.disabledButton = true;
  }

  totalizationRetention() {
    this.collectService.collection.nuAmountFinal = 0;
    this.collectService.collection.nuAmountTotal = 0;
    this.collectService.collection.nuAmountFinalConversion = 0;
    this.collectService.collection.nuAmountTotalConversion = 0;

    const details = this.collectService.collection.collectionDetails ?? [];
    for (let i = 0; i < details.length; i++) {
      const detail = details[i];
      const retentionAmount = this.usesDynamicRetentionTotalization()
        ? this.getDetailRetentionLinesTotal(detail)
        : Number(detail.nuAmountRetention ?? 0) + Number(detail.nuAmountRetention2 ?? 0);
      const ivaConversion = Number(
        detail.nuAmountRetentionConversion ?? detail.nuAmountRetentionIvaConversion ?? 0,
      );
      const islrConversion = Number(
        detail.nuAmountRetention2Conversion ?? detail.nuAmountRetentionIslrConversion ?? 0,
      );
      let retentionConversion = this.usesDynamicRetentionTotalization()
        ? (detail.collectionDetailRetentions ?? []).reduce(
          (sum, line) => sum + Number(line.nuAmountRetentionConversion ?? 0),
          0,
        )
        : ivaConversion + islrConversion;
      if (retentionConversion <= 0 && retentionAmount > 0) {
        retentionConversion = this.collectService.convertirMonto(
          retentionAmount,
          detail.nuValueLocal ?? this.collectService.collection.nuValueLocal,
          this.collectService.collection.coCurrency,
        );
      }

      this.collectService.collection.nuAmountFinal += retentionAmount;
      this.collectService.collection.nuAmountTotal += retentionAmount;
      this.collectService.collection.nuAmountFinalConversion += retentionConversion;
      this.collectService.collection.nuAmountTotalConversion = this.collectService.collection.nuAmountFinalConversion;
    }
  }

  calculateDifDocsNegativos() {
    let exist = false;
    let monto = 0;
    this.collectService.difDocsNegativosByRate = 0;
    this.collectService.difDocsNegativosByOriginalRate = 0;
    this.collectService.difference = 0;
    this.collectService.collection.collectionDetails.forEach(doc => {
      if (doc.nuBalanceDoc < 0) {
        this.collectService.difDocsNegativosByRate +=
          this.collectService.convertirMonto(doc.nuBalanceDoc,
            this.collectService.collection.nuValueLocal,
            this.collectService.collection.coCurrency);

        this.collectService.difDocsNegativosByOriginalRate +=
          this.collectService.convertirMonto(doc.nuBalanceDoc,
            doc.nuValueLocal,
            this.collectService.collection.coCurrency);
        exist = true;
      }


    });

    if (exist) {
      this.collectService.difference =
        this.collectService.difDocsNegativosByRate
        - this.collectService.difDocsNegativosByOriginalRate;
    } else {
      this.collectService.difDocsNegativosByRate = 0;
      this.collectService.difDocsNegativosByOriginalRate = 0;
      this.collectService.calculateDifference = false;
    }
  }

  private normalizeTotalizationAmount(amount: unknown): number {
    const value = Number(amount ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  shouldShowTotalizationAmount(amount: unknown): boolean {
    return this.normalizeTotalizationAmount(amount) > 0;
  }

  formatTotalizationAmount(amount: unknown): string {
    if (!this.shouldShowTotalizationAmount(amount)) {
      return '';
    }

    return this.currencyService.formatNumber(this.normalizeTotalizationAmount(amount));
  }

  hasTotalizationColumnAmount(
    field: 'discount' | 'retentionIva' | 'retentionIslr' | 'igtf' | 'collectDiscount',
  ): boolean {
    const details = this.collectService.collection?.collectionDetails ?? [];

    return details.some(detail => {
      switch (field) {
        case 'discount':
          return this.shouldShowTotalizationAmount(detail.nuAmountDiscount);
        case 'retentionIva':
          return this.shouldShowTotalizationAmount(detail.nuAmountRetention);
        case 'retentionIslr':
          return this.shouldShowTotalizationAmount(detail.nuAmountRetention2);
        case 'igtf':
          return this.shouldShowTotalizationAmount(
            this.collectService.resolveCollectionDetailPaymentDisplay(detail).igtfAmount,
          );
        case 'collectDiscount':
          return this.shouldShowTotalizationAmount(detail.nuAmountCollectDiscount);
        default:
          return false;
      }
    });
  }

  shouldShowTotalizationIgtfSummary(): boolean {
    return this.collectService.shouldDisplayIgtfInTotals()
      && this.collectService.coTypeModule !== '4'
      && this.shouldShowTotalizationAmount(this.collectService.montoIgtf);
  }

  usesDynamicRetentionTotalization(): boolean {
    return this.collectService.dynamicRetentions === true && this.collectService.retencion === true;
  }

  getTotalizationRetentionColumns(): Array<{
    idCollectRetention: number;
    coCollectRetention: string;
    label: string;
  }> {
    if (!this.usesDynamicRetentionTotalization()) {
      return [];
    }

    const columnMap = new Map<number, {
      idCollectRetention: number;
      coCollectRetention: string;
      label: string;
    }>();

    for (const retention of this.collectService.collectRetentions ?? []) {
      columnMap.set(retention.idCollectRetention, {
        idCollectRetention: retention.idCollectRetention,
        coCollectRetention: retention.coCollectRetention,
        label: this.buildRetentionColumnLabel(retention),
      });
    }

    const details = this.collectService.collection?.collectionDetails ?? [];
    for (const detail of details) {
      for (const line of detail.collectionDetailRetentions ?? []) {
        const id = Number(line.idCollectRetention ?? 0);
        if (id <= 0 || columnMap.has(id)) {
          continue;
        }

        const code = String(line.coCollectRetention ?? '').trim();
        columnMap.set(id, {
          idCollectRetention: id,
          coCollectRetention: code,
          label: code || String(id),
        });
      }
    }

    return Array.from(columnMap.values());
  }

  getDetailDynamicRetentionAmount(detail: CollectionDetail, idCollectRetention: number): number {
    const lines = detail.collectionDetailRetentions ?? [];
    const match = lines.find(line => Number(line.idCollectRetention) === idCollectRetention);
    return this.normalizeTotalizationAmount(match?.nuAmountRetention);
  }

  hasDynamicRetentionColumnAmount(idCollectRetention: number): boolean {
    const details = this.collectService.collection?.collectionDetails ?? [];
    return details.some(
      detail => this.getDetailDynamicRetentionAmount(detail, idCollectRetention) > 0,
    );
  }

  getDetailRetentionDisplayLines(detail: CollectionDetail): CollectionDetailRetentions[] {
    if (!this.usesDynamicRetentionTotalization()) {
      return [];
    }

    return (detail.collectionDetailRetentions ?? []).filter(
      line => this.normalizeTotalizationAmount(line.nuAmountRetention) > 0,
    );
  }

  getDetailRetentionLinesTotal(detail: CollectionDetail): number {
    return this.getDetailRetentionDisplayLines(detail).reduce(
      (sum, line) => sum + this.normalizeTotalizationAmount(line.nuAmountRetention),
      0,
    );
  }

  getRetentionLineDisplayLabel(line: CollectionDetailRetentions): string {
    const catalog = (this.collectService.collectRetentions ?? []).find(
      item => item.idCollectRetention === line.idCollectRetention,
    );
    if (catalog) {
      return this.buildRetentionColumnLabel(catalog);
    }

    const code = String(line.coCollectRetention ?? '').trim();
    return code || this.collectService.collectionTags.get('COB_RETENCIONES') || 'Retención';
  }

  private buildRetentionColumnLabel(retention: CollectRetentions): string {
    const code = String(retention.coCollectRetention ?? '').trim();
    const name = String(retention.naCollectRetention ?? '').trim();
    if (code && name) {
      return `${code} - ${name}`;
    }
    return code || name || String(retention.idCollectRetention);
  }

}
