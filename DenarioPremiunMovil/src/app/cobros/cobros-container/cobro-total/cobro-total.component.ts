import { Component, OnInit, Input, inject } from '@angular/core';

import { Retention } from 'src/app/modelos/retention';
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

  constructor() {
  }

  ngOnInit() {
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
        //idCollectionDetail: null,
        coCollection: this.collectService.collection.coCollection,
        coDocument: this.collectService.retention.coDocument,
        idDocument: 0,
        inPaymentPartial: false,
        nuVoucherRetention: this.collectService.retention.nuVoucherRetention,
        nuAmountRetention: this.collectService.retention.nuAmountRetention, //iva
        nuAmountRetention2: this.collectService.retention.nuAmountRetention2, //islr
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
      })
    }
    this.collectService.addRetention = false;
    this.validate();
    void this.collectService.calculatePayment('', 0, true);
    this.collectService.validateToSend();
  }

  validate() {

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
      const retentionAmount = Number(details[i].nuAmountRetention ?? 0)
        + Number(details[i].nuAmountRetention2 ?? 0);
      const ivaConversion = Number(
        details[i].nuAmountRetentionConversion ?? details[i].nuAmountRetentionIvaConversion ?? 0,
      );
      const islrConversion = Number(
        details[i].nuAmountRetention2Conversion ?? details[i].nuAmountRetentionIslrConversion ?? 0,
      );
      let retentionConversion = ivaConversion + islrConversion;
      if (retentionConversion <= 0 && retentionAmount > 0) {
        retentionConversion = this.collectService.convertirMonto(
          retentionAmount,
          details[i].nuValueLocal ?? this.collectService.collection.nuValueLocal,
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

}
