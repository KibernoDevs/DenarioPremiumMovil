import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CollectionDetailDiscounts, CollectionPayment } from 'src/app/modelos/tables/collection';
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
import { MessageService } from 'src/app/services/messageService/message.service';


@Component({
  selector: 'app-cobro-documents',
  templateUrl: './cobro-documents.component.html',
  styleUrls: ['./cobro-documents.component.scss'],
  standalone: false
})
export class CobrosDocumentComponent implements OnInit {

  public collectService = inject(CollectionService);
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
  public disabledCollectDiscountButton: boolean = false;
  // When true, discount checkboxes should be disabled in the template
  public disableDiscountCheckboxes: boolean = false;

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
    this.applyDocumentFilter(this.collectService.documentCurrency);
    // this.collectService.deepFreeze(this.collectService.documentSalesView);
  }



  onChangeCurrencyDoc(event: any) {
    const selectedCurrency = event?.target?.value?.coCurrency ?? '';

    this.collectService.documentCurrency = selectedCurrency;
    this.applyDocumentFilter(selectedCurrency);

    if (this.collectService.historicPartialPayment) {
      this.collectService.findIsPaymentPartial(
        this.synchronizationServices.getDatabase(),
        this.collectService.collection.idClient
      ).then(() => {
      });
    }
  }

  private applyDocumentFilter(coCurrency: string): void {
    const source = this.collectService.documentSalesView?.length
      ? this.collectService.documentSalesView
      : this.collectService.documentSales;

    if (!Array.isArray(source) || source.length === 0) {
      this.filteredDocumentsView = [];
      this.collectService.documentsSaleComponent = false;
      return;
    }

    this.filteredDocumentsView = (!coCurrency || coCurrency === 'Moneda')
      ? source
      : source.filter(doc => doc.coCurrency === coCurrency);

    this.collectService.documentsSaleComponent = this.filteredDocumentsView.length > 0;
  }

  public getSourceIndex(documentSale: DocumentSale): number {
    const byId = this.collectService.documentSales.findIndex(d => d.idDocument === documentSale.idDocument);
    if (byId >= 0) return byId;

    return this.collectService.documentSales.findIndex(
      d => d.coDocument === documentSale.coDocument && d.idEnterprise === documentSale.idEnterprise
    );
  }

  getDocumentsSale(idClient: number, coCurrency: string, coCollection: string, idEnterprise: number) {
    this.collectService.getDocumentsSales(this.synchronizationServices.getDatabase(), idClient, coCurrency, coCollection, idEnterprise).then(response => {
      this.applyDocumentFilter(this.collectService.documentCurrency || coCurrency);

      if (this.collectService.historicPartialPayment) {
        this.collectService.findIsPaymentPartial(this.synchronizationServices.getDatabase(), this.collectService.collection.idClient).then(() => {
        });
      }
    })
  }

  getDaDueDate(daDueDate: string) {
    let dateDoc = new Date(daDueDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$2/$1/$3")).getTime();
    //minutes = 1000*60
    //hours = minutes * 60
    //days = hours * 24
    //var days = 86400000; /* 1000 * 60 * 60 * 24; */

    return Math.abs(Math.round(((new Date()).getTime() - dateDoc) / 86400000));
  }

  getIgtfList() {
    const found = this.collectService.igtfList.find(item => item.defaultIgtf === "true");
    if (found) {
      this.collectService.igtfSelected = found;
    }
  }

  onChangeIgtf(event: any) {
    console.log(event.target.value);
    this.collectService.igtfSelected = event.target.value;

    if (event.target.value.price == 0)
      this.collectService.separateIgtf = false;

    this.collectService.calculatePayment("", 0);
    this.cdr.detectChanges();
  }

  separateIgtf() {
    /* console.log(igtfDefault)
    this.collectService.separateIgtf = igtfDefault.target.checked; */
    this.collectService.collection.hasIGTF = this.collectService.separateIgtf;
    this.collectService.calculatePayment("", 0);
    this.cdr.detectChanges();
    if (this.collectService.igtfSelected.price <= 0 && this.collectService.separateIgtf) {
      //MANDAR MENSAJE DE ERROR, IGTF SEPARADO DEBE SER MAYOR A 0
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

      cs.isPaymentPartial = !!doc?.inPaymentPartial;

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

          if (detail.inPaymentPartial) {
            nuAmountPaid = Number(detail.nuAmountPaid ?? 0);
          } else {
            const sumRet = nuAmountDiscount + Number(detail.nuAmountRetention ?? 0) + Number(detail.nuAmountRetention2 ?? 0);
            nuAmountPaid = Number(detail.nuBalanceDoc ?? 0) - sumRet;
          }

          nuBalance = Number(detail.nuBalanceDoc ?? 0);
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
          const difFaltante = detail.nuAmountDiscount ?? 0;
          const retention = detail.nuAmountRetention ?? 0;
          const retention2 = detail.nuAmountRetention2 ?? 0;
          /*  const sumRet = difFaltante + retention + retention2; */
          const sumRet = 0;
          if (detail) {
            nuAmountRetention = Number(detail.nuAmountRetention ?? 0);
            nuAmountRetention2 = Number(detail.nuAmountRetention2 ?? 0);
            daVoucher = detail.daVoucher ?? '';
            nuVaucherRetention = detail.nuVoucherRetention ?? '';

            if (cs.isPaymentPartial) {
              nuAmountPaid = Number(detail.nuAmountPaid - sumRet);
            } else {
              nuAmountPaid = Number(detail.nuBalanceDoc - sumRet);
            }

            nuBalance = Number(detail.nuBalanceDoc - sumRet);
          } else {
            nuBalance = Number(backup.nuBalance - sumRet);
            nuAmountPaid = nuBalance;
          }
        } else {
          const sumRet = nuAmountDiscount +
            Number(cs.documentSaleOpen?.nuAmountRetention ?? 0) +
            Number(cs.documentSaleOpen?.nuAmountRetention2 ?? 0);

          nuAmountRetention = Number(cs.documentSaleOpen?.nuAmountRetention ?? 0);
          nuAmountRetention2 = Number(cs.documentSaleOpen?.nuAmountRetention2 ?? 0);

          nuBalance = Number(backup.nuBalance ?? 0);
          nuAmountPaid = nuBalance - sumRet;

          nuVaucherRetention = cs.documentSaleOpen?.nuVaucherRetention ?? '';
          daVoucher = cs.documentSaleOpen?.daVoucher ?? '';
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
      this.displayAmountPaid = this.formatNumber(Number(this.displayAmountPaid));
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

      // Mejor manejo: si es null o undefined asignar string vacío, si no asignar su valor
      const detail = this.collectService.collection.collectionDetails[index];
      const comment = detail?.discountComment ?? '';
      const doc = this.collectService.documentSales[index];
      this.discountComment = comment;


      this.disabledSaveButton = true;
      this.collectService.documentSaleOpen = new DocumentSale;
      let voucherRetentionValue = "";
      let daVoucherValue = "";
      if (this.collectService.documentSales[index].isSave) {
        const positionCollecDetails = this.collectService.documentSales[index].positionCollecDetails;
        this.collectService.isPaymentPartial = this.collectService.collection.collectionDetails[positionCollecDetails].inPaymentPartial;
        this.collectService.nuBalance = this.collectService.collection.collectionDetails[positionCollecDetails].nuBalanceDoc;
        voucherRetentionValue = this.collectService.collection.collectionDetails[positionCollecDetails].nuVoucherRetention;
        daVoucherValue = this.collectService.collection.collectionDetails[positionCollecDetails].daVoucher!;
        this.valuePartialPayment = this.collectService.collection.collectionDetails[positionCollecDetails].nuAmountPaid;
      } else {
        this.collectService.nuBalance = this.collectService.documentSales[index].nuBalance;
      }

      if (this.collectService.userCanSelectCollectDiscount) {
        if (this.collectService.collection.collectionDetails[index]?.collectionDetailDiscounts &&
          this.collectService.collection.collectionDetails[index].collectionDetailDiscounts?.length > 0) {
          const persistedDiscounts = this.collectService.collection.collectionDetails[index].collectionDetailDiscounts!;
          this.manualCollectDiscountAmount = this.getManualCollectDiscountFromDetails(persistedDiscounts);
          this.manualCollectDiscountAmountBackup = this.manualCollectDiscountAmount;
          const selectedIds = persistedDiscounts
            .map(cdd => Number(cdd.idCollectDiscount))
            .filter(id => !Number.isNaN(id) && id > 0);
          this.collectService.selectedCollectDiscounts = selectedIds;
          this.setCollectionDetailDiscounts(index, selectedIds);
        } else {
          this.manualCollectDiscountAmount = 0;
          this.manualCollectDiscountAmountBackup = 0;
        }
      }

      await this.calculateSaldo(index);
      await this.calculateDocumentSaleOpen(index);

      // Asignar el valor de nuVaucherRetention y daVoucher después de crear documentSaleOpen
      if (voucherRetentionValue !== undefined) {
        this.collectService.documentSaleOpen.nuVaucherRetention = voucherRetentionValue;
      }
      if (daVoucherValue !== undefined) {
        this.collectService.documentSaleOpen.daVoucher = daVoucherValue;
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
          this.collectService.documentSaleOpen.nuVaucherRetention = detail.nuVoucherRetention;
          this.collectService.documentSaleOpen.inPaymentPartial = detail.inPaymentPartial;
          this.collectService.documentSaleOpen.nuBalance = detail.nuBalanceDoc;
          this.collectService.nuBalance = this.collectService.documentSalesBackup[index].nuBalance;
          this.collectService.isPaymentPartial = detail.inPaymentPartial;

        } else {
          this.collectService.nuBalance = this.collectService.documentSaleOpen.nuBalance;
        }

      }

      if (this.collectService.documentSaleOpen.daVoucher != "")
        this.collectService.validateDaVoucher = true
      if (this.collectService.coTypeModule == '0') {
        this.collectService.documentSaleOpen.isSave == true ? this.collectService.amountPaid = this.collectService.documentSaleOpen.nuAmountPaid : this.collectService.amountPaid = this.collectService.documentSaleOpen.nuBalance;
        console.log(this.collectService.documentSaleOpen.isSave);
        console.log(this.collectService.amountPaid, "AMOUNT PAID AL ABRIR");
        console.log(this.collectService.documentSaleOpen.nuAmountPaid, "DOCUMENTO ABIERTO");
        console.log(this.collectService.documentSaleOpen.nuBalance, "DOCUMENTO ABIERTO");
      } else
        this.collectService.amountPaidRetention =
          this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber((this.collectService.documentSaleOpen.nuAmountRetention + this.collectService.documentSaleOpen.nuAmountRetention2)));

      // <-- ADD: inicializar displayAmountPaid para que el input muestre el valor al abrir
      if (this.collectService.isPaymentPartial) {
        this.centsAmountPaid = Math.round((this.collectService.amountPaid ?? 0) * factor);
        this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
      } else {
        try {
          this.centsAmountPaid = Math.round((this.collectService.documentSaleOpen.nuAmountPaid ?? 0) * factor);
          this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
        } catch {
          this.centsAmountPaid = Math.round((this.collectService.documentSaleOpen.nuAmountPaid ?? 0) * factor);
          this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
        }
      }

      this.collectService.ensureNumber(this.collectService.documentSaleOpen, 'nuAmountBase');
      this.collectService.ensureNumber(this.collectService.documentSaleOpen, 'nuAmountRetention');
      this.collectService.ensureNumber(this.collectService.documentSaleOpen, 'nuAmountRetention2');
      this.collectService.ensureNumber(this.collectService.documentSaleOpen, 'nuAmountTax');

      if (this.collectService.multiCurrency) {
        if (this.collectService.userCanSelectIGTF)
          this.collectService.documentSaleOpen.igtfAmount
            = this.Number(this.collectService.documentSaleOpen.nuBalance * (this.collectService.igtfSelected.price / 100));

      }
      this.collectService.indexDocumentSaleOpen = index;

      if (this.collectService.collection.collectionDetails.length > 0) {

        const i = this.collectService.collection.collectionDetails.findIndex(
          d => d.coDocument == this.collectService.documentSaleOpen.coDocument
        );
        if (i !== -1) {
          /* this.collectService.isPaymentPartial =
            this.collectService.collection.collectionDetails[i].inPaymentPartial.toString() == "true"; */

          this.collectService.isPaymentPartial = this.collectService.documentSaleOpen.inPaymentPartial.toString() == "true";
          this.collectService.documentSaleOpen.positionCollecDetails = i;
        }
      } else
        this.collectService.isPaymentPartial = this.collectService.alwaysPartialPayment;
      // Force UI update after saldo y nuVaucherRetention
      this.cdr.detectChanges();
      this.collectService.cobrosComponent = false;
      this.collectService.isOpen = true;

      if (this.collectService.userCanSelectCollectDiscount)
        this.checkCollectDiscount();
    }

    if (this.collectService.retencion)
      this.validateNuVaucherRetention(false);
    else
      this.collectService.validNuRetention = true;

    if (this.collectService.documentSaleOpen.missingRetention || this.collectService.alwaysPartialPayment) {
      let event = { target: { checked: true } };
      this.partialPay(event)
    }
    console.log(this.collectService.amountPaid, "AMOUNT PAID AL ABRIR")
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
      return;
    }

    const detail = this.collectService.collection.collectionDetails[idxDetail];
    const discounts = Array.isArray(detail?.collectionDetailDiscounts)
      ? detail.collectionDetailDiscounts
      : [];
    this.manualCollectDiscountAmount = this.getManualCollectDiscountFromDetails(discounts);
    this.manualCollectDiscountAmountBackup = this.manualCollectDiscountAmount;

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
      this.collectService.disabledSelectCollectMethodDisabled = false;

      if (this.collectService.alwaysPartialPayment) {
        this.collectService.documentSales[indexDocumentSale].inPaymentPartial = true;
        this.collectService.documentSalesBackup[indexDocumentSale].inPaymentPartial = true;
        this.collectService.documentSalesView[indexDocumentSale].inPaymentPartial = true;
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
      inPaymentPartial = this.collectService.alwaysPartialPayment || !!open?.inPaymentPartial;
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

      // Actualiza los datos de documentSales y collectionDetails con el helper
      this.collectService.copyDocumentSaleOpenToSalesAndDetails();

      if (this.collectService.coTypeModule == '2') {
        this.collectService.amountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(this.collectService.amountPaidRetention));
        this.collectService.documentSaleOpen.nuAmountPaid = this.collectService.amountPaidRetention;
      }

      // Lógica de validación y flags
      //this.collectService.isPaymentPartial = !this.collectService.isPaymentPartial;
      this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails]!.inPaymentPartial! = this.collectService.isPaymentPartial;

      if (this.collectService.coTypeModule != "2") {
        //ES COBRO O IGTF
        if (this.collectService.isPaymentPartial) {
          if (this.collectService.documentSaleOpen.nuAmountPaid > 0) {
            const idx = this.collectService.documentSaleOpen.positionCollecDetails;
            const open = this.collectService.documentSaleOpen;
            const detail = this.collectService.collection.collectionDetails[idx];
            const discount = detail.nuAmountDiscount + detail.nuAmountRetention! + detail.nuAmountRetention2!;
            if (detail) {
              detail.nuAmountPaid = this.valuePartialPayment - discount;
              if (!this.collectService.isPaymentPartial && this.collectService.multiCurrency) {
                detail.nuAmountPaidConversion = this.valuePartialPayment - discount;
              }
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
        this.collectService.calculatePayment("", 0);
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

    if (!this.collectService.documentSaleOpen.inPaymentPartial)
      this.collectService.isPaymentPartial = false;

    this.collectService.validNuRetention = false;
    this.collectService.isOpen = action;
  }

  saveStatusDocument() {
    let validate = false;
    if (this.disabledSaveButton)
      this.disabledSaveButton = false;

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
        if (this.collectService.documentSaleOpen.nuAmountPaid > 0) {
          const idx = this.collectService.documentSaleOpen.positionCollecDetails;
          const open = this.collectService.documentSaleOpen;
          const detail = this.collectService.collection.collectionDetails[idx];
          if (detail) {
            detail.nuAmountPaid = open.nuAmountPaid;
            if (!this.collectService.isPaymentPartial && this.collectService.multiCurrency) {
              detail.nuAmountPaidConversion = open.nuAmountPaid;
            }
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

  setAmountTotal() {
    const cs = this.collectService;
    const {
      coTypeModule,
      igtfSelected,
      multiCurrency
    } = cs;

    const documentSale = cs.documentSales[cs.indexDocumentSaleOpen];
    const backup = cs.documentSalesBackup[cs.indexDocumentSaleOpen];

    // Obtener saldo original (preferir backup, luego collectionDetails si aplica)
    let originalBalance = 0;
    const pos = cs.documentSaleOpen?.positionCollecDetails;
    if (backup && backup.nuBalance != null) {
      originalBalance = Number(backup.nuBalance);
    } else if (Number.isInteger(pos) && pos! >= 0 && cs.collection.collectionDetails?.[pos]) {
      originalBalance = Number(cs.collection.collectionDetails[pos].nuBalanceDoc ?? 0);
    } else {
      originalBalance = Number(cs.documentSaleOpen?.nuBalance ?? 0);
    }

    const nuAmountRetention = cs.documentSaleOpen.nuAmountRetention ?? 0;
    const nuAmountRetention2 = cs.documentSaleOpen.nuAmountRetention2 ?? 0;
    let amountPaidRetention = 0;
    let amountPaidConversion = 0;
    // difFaltante = descuento actual aplicado en detalle (valor fijo, no acumulativo)
    let difFaltante = cs.collection.collectionDetails[cs.documentSaleOpen.positionCollecDetails!]?.nuAmountDiscount ?? 0;

    // --- Retenciones y conversiones ---
    const sumRetentions = difFaltante + nuAmountRetention + nuAmountRetention2;

    if (coTypeModule === '2') {
      amountPaidRetention = sumRetentions;
      amountPaidConversion = cs.convertirMonto(amountPaidRetention, cs.collection.nuValueLocal, cs.documentSaleOpen.coCurrency);
      cs.amountPaidRetention = amountPaidRetention;
      cs.amountPaidConversion = amountPaidConversion;

      cs.amountPaid = sumRetentions;

      cs.documentSaleOpen.nuAmountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaidRetention));
      cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaidDoc));
      cs.amountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaid));
      cs.amountPaidRetention = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaidRetention));

    } else {
      if (cs.isPaymentPartial) {
        let amount = documentSale.isSave ? documentSale.nuAmountPaid : this.valuePartialPayment;
        cs.amountPaid = amount - sumRetentions;
      } else {
        // usar siempre originalBalance para calcular el nuevo monto al aplicar descuento/retenciones
        cs.amountPaid = originalBalance - sumRetentions;
      }

      cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaidDoc));
      cs.amountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaid));
      this.collectService.documentSaleOpen.igtfAmount = cs.amountPaid * (igtfSelected.price / 100);

    }





    this.displayAmountPaid = cs.amountPaid.toString();

    let amountPaidAux = cs.amountPaid;
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
    this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails]!.inPaymentPartial = event.target.checked;
    this.collectService.isPaymentPartial = event.target.checked;
    this.collectService.isChangePaymentPartial = true;
    this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].inPaymentPartial = event.target.checked;
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
    this.partialPay(event);
  }

  partialPay(event: any) {
    this.collectService.isChangePaymentPartial = true;
    this.collectService.isPaymentPartial = event.target.checked;
    const factor = this.centsFactor();
    if (event.target.checked) {
      if (!this.collectService.documentSaleOpen.isSave)
        this.collectService.amountPaid = 0;

      this.centsAmountPaid = Math.round((this.collectService.amountPaid ?? 0) * factor);
      this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
      if (this.collectService.collection.stDelivery != 3)
        this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails]!.inPaymentPartial = true;

      this.disabledSaveButton = true;
      this.collectService.isChangePaymentPartial = false;

      if (!this.hasShownPartialPayMessage && this.collectService.totalHistoricPartialPayment > 0 && this.collectService.coTypeModule == "0") {
        if (this.collectService.historicPartialPayment &&
          this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].inPaymentPartial) {

          this.collectService.getPaymentPartialByDocument(this.synchronizationServices.getDatabase(), this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].coDocument).then(resp => {
            if (this.collectService.paymentPartials.length > 0) {
              this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_HAVE_PAYPARTIAL')!;
              this.alertMessageOpen2 = true;
              this.hasShownPartialPayMessage = true;
            }
          })

        }
      }

      return; // Early return, no más lógica abajo
    }

    if (this.collectService.collection.stDelivery == 3) {
      this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].inPaymentPartial = false;
      this.collectService.documentSalesBackup[this.collectService.indexDocumentSaleOpen].inPaymentPartial = false;
      this.collectService.documentSalesView[this.collectService.indexDocumentSaleOpen].inPaymentPartial = false;
      this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails].inPaymentPartial = false;
      this.collectService.documentSaleOpen.nuAmountRetention = this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails].nuAmountRetention;
      this.collectService.documentSaleOpen.nuAmountRetention2 = this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails].nuAmountRetention2;
      this.collectService.documentSaleOpen.daVoucher = this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails].daVoucher!;

      if (this.collectService.isPaymentPartial) {
        this.collectService.amountPaid = this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails].nuAmountPaid;
        this.centsAmountPaid = Math.round((this.collectService.amountPaid ?? 0) * factor);
        this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
      } else {
        const sumRetentions = this.collectService.documentSaleOpen.nuAmountRetention +
          this.collectService.documentSaleOpen.nuAmountRetention2;
        this.collectService.amountPaid = this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails].nuBalanceDoc - sumRetentions
        this.centsAmountPaid = Math.round((this.collectService.amountPaid ?? 0) * factor);
        this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
      }
      this.collectService.documentSaleOpen.nuVaucherRetention = this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails].nuVoucherRetention;
    }

    this.calculateSaldo(this.collectService.indexDocumentSaleOpen).then(() => {
      let positionCollecDetails = this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].positionCollecDetails;
      this.calculateDocumentSaleOpen(this.collectService.indexDocumentSaleOpen).then(() => {
        this.collectService.documentSaleOpen.positionCollecDetails = positionCollecDetails;
        this.collectService.documentSaleOpen.isSelected = true;
        this.collectService.documentSaleOpen.inPaymentPartial = false;
        this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].isSelected = true;
        this.collectService.documentSalesBackup[this.collectService.indexDocumentSaleOpen].isSelected = true;
        //this.disabledSaveButton = true;
        this.validateNuVaucherRetention(false)
        this.centsAmountPaid = Math.round((this.collectService.documentSaleOpen.nuAmountPaid ?? 0) * factor);
        this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);

        if (this.collectService.collection.stDelivery != 3)
          this.collectService.collection.collectionDetails[this.collectService.documentSaleOpen.positionCollecDetails]!.inPaymentPartial = false;

        this.validate();
      });
    });


/*     this.collectService.amountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(this.collectService.amountPaid));
 */    this.collectService.documentSales[this.collectService.indexDocumentSaleOpen].inPaymentPartial = event.target.checked;
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
      this.disabledSaveButton = false;
      if (cs.validNuRetention && doc.daVoucher === '') {
        this.disabledSaveButton = true;
      }
      cs.calculatePayment("", 0);
      this.cdr.detectChanges();
      return;
    }

    // Si es pago parcial
    if (cs.isPaymentPartial) {
      let montoDoc = 0;
      montoDoc = this.collectService.documentSales[index].nuBalance;
      /* if (this.collectService.currencySelected.localCurrency.toString() === "true") {
        if (this.collectService.currencySelected.coCurrency === doc.coCurrency) {
          //moneda del cobro loca, moneda del documento local
          montoDoc = this.collectService.documentSales[index].nuBalance;
        } else {
          //moneda del cobro loca, moneda del documento hard
          montoDoc = this.collectService.toLocal(this.collectService.documentSales[index].nuBalance);
        }
      } else {
        if (this.collectService.currencySelected.coCurrency === doc.coCurrency) {
          //moneda del cobro hard, moneda documento hard
          montoDoc = this.collectService.documentSales[index].nuBalance;
        } else {
          //moneda del cobro hard, moneda en local
          montoDoc = this.collectService.toHard(this.collectService.documentSales[index].nuBalance);
        }
      } */
      if (!isAlwaysPartialWithFixedMode && Math.abs(cs.amountPaid) >= this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(montoDoc))) {
        cs.mensaje = cs.collectionTags.get('COB_MSJ_PARTIALPAY_MAYOR_DOCAMOUNT')!;
        this.alertMessageOpen = true;
        this.disabledSaveButton = true;
        cs.amountPaid = doc.nuAmountPaid;
        cs.amountPaymentPartial = doc.nuBalance;
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

      cs.calculatePayment("", 0);
      this.cdr.detectChanges();
      return;
    }

    // Si hay retenciones
    if (doc.nuAmountRetention || doc.nuAmountRetention2) {
      if (cs.validNuRetention) {
        // Usa el helper aquí también
        if (this.isEmptyOrZeroRetention()) {
          this.disabledSaveButton = true;
          return;
        }
        if (doc.daVoucher === "") {
          this.disabledSaveButton = true;
          if ((!isAlwaysPartialWithFixedMode && Math.abs(cs.amountPaid) > doc.nuBalance) || cs.amountPaid < 0) {
            cs.mensaje = "El monto no puede ser mayor al monto del documento";
            this.alertMessageOpen = true;
          }
          return;
        }
        if ((!isAlwaysPartialWithFixedMode && Math.abs(cs.amountPaid) > doc.nuBalance) || cs.amountPaid < 0) {
          cs.mensaje = "El monto no puede ser mayor al monto del documento";
          this.alertMessageOpen = true;
          this.disabledSaveButton = true;
          return;
        }
        cs.documentSales[index].nuBalance = cs.amountPaid;
        this.disabledSaveButton = false;
        cs.calculatePayment("", 0);
        this.cdr.detectChanges();
        return;
      }
    }

    // Si el monto pagado es mayor al saldo
    if (!isAlwaysPartialWithFixedMode && Math.abs(cs.amountPaid) > Math.abs(doc.nuBalance)) {
      cs.mensaje = cs.isPaymentPartial
        ? cs.collectionTags.get('COB_MSJ_PARTIALPAY_MAYOR_DOCAMOUNT')!
        : cs.collectionTags.get('COB_MSJ_PAY_MAYOR_DOCAMOUNT')!;
      this.alertMessageOpen = true;
      this.disabledSaveButton = true;
      cs.amountPaid = doc.nuBalance;
      cs.amountPaymentPartial = doc.nuBalance;
      cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaid));
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
    doc.nuBalance = docOriginal.nuBalance - (difFaltante + cs.amountPaymentPartial + doc.nuAmountRetention + doc.nuAmountRetention2);
    doc.nuAmountPaid = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaid));
    cs.amountPaidDoc = this.currencyService.cleanFormattedNumber(this.currencyService.formatNumber(cs.amountPaidDoc));

    if (!this.disabledSaveButton) {
      cs.calculatePayment("", 0);
      this.cdr.detectChanges();
    }

    if (cs.isChangePaymentPartial && !cs.isPaymentPartial) {
      this.disabledSaveButton = false;
      cs.calculatePayment("", 0);
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

  //[a-zA-Z ]

  validateNuVaucherRetention(sendMessage: boolean) {
    //sizeRetention esta variable nos dira el tamaño aceptado de la retencion
    if (this.collectService.sizeRetention != 0) {
      if (this.collectService.documentSaleOpen.nuVaucherRetention == "" || this.collectService.documentSaleOpen.nuVaucherRetention == null) {
        this.disabledSaveButton = true;
        this.collectService.validNuRetention = false;
        this.collectService.documentSaleOpen.nuVaucherRetention = "";
        this.collectService.documentSaleOpen.nuAmountRetention = 0;
        this.collectService.documentSaleOpen.nuAmountRetention2 = 0;
        return;
      }

      if (this.collectService.formatRetention === "number") {
        //SOLO NUMERO
        if (this.collectService.documentSaleOpen.nuVaucherRetention.toString().length != this.collectService.sizeRetention) {
          //console.warn("error, el campo nuVaucherRetention no puede ser mayor a", this.globalConfig.get('sizeRetention'))
          this.disabledSaveButton = true;
          //this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_RETENTION_LONG_CARACTERES')!;
          this.collectService.mensaje = 'El comprobante de retenci\u00f3n debe tener una longitud de ' + this.collectService.sizeRetention + ' caracteres ';
          if (sendMessage)
            this.alertMessageOpen = true;

          this.collectService.validNuRetention = false;
        } else {
          this.disabledSaveButton = false;
          this.collectService.validNuRetention = true;
        }
      } else if (this.collectService.formatRetention === "text") {
        //SOLO TEXTO
        if (this.collectService.documentSaleOpen.nuVaucherRetention.length != this.collectService.sizeRetention) {
          //this.regexLongitude.exec(this.clientLogic.coordenada.lng.toString())
          if (this.collectService.regexOnlyText.test(this.collectService.documentSaleOpen.nuVaucherRetention)) {
            //good
            this.disabledSaveButton = true;
            //this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_RETENTION_LONG_CARACTERES')!;
            this.collectService.mensaje = 'El comprobante de retenci\u00f3n debe tener una longitud de ' + this.collectService.sizeRetention + ' caracteres ';

            if (sendMessage)
              this.alertMessageOpen = true;
            this.collectService.validNuRetention = false;
          } else {
            //error
            this.disabledSaveButton = true;
            this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_RETENTION_ONLY_TEXT')!;
            if (sendMessage)
              this.alertMessageOpen = true;
            this.collectService.validNuRetention = false;
          }
        } else {
          this.disabledSaveButton = false;
          this.collectService.validNuRetention = true;
        }
      } else {
        //alphanumeric
        if (this.collectService.documentSaleOpen.nuVaucherRetention.length != this.collectService.sizeRetention) {
          //this.regexLongitude.exec(this.clientLogic.coordenada.lng.toString())
          if (this.collectService.regexAlphaNumeric.test(this.collectService.documentSaleOpen.nuVaucherRetention)) {
            //good
            this.disabledSaveButton = true;
            //this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_RETENTION_LONG_CARACTERES')!;
            this.collectService.mensaje = 'El comprobante de retenci\u00f3n debe tener una longitud de ' + this.collectService.sizeRetention + ' caracteres ';
            this.alertMessageOpen = true;
            this.collectService.validNuRetention = false;
          } else {
            //error
            this.disabledSaveButton = true;
            this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSJ_RETENTION_ALPHANUMERIC')!;
            this.alertMessageOpen = true;
            this.collectService.validNuRetention = false;
          }

        } else {
          this.disabledSaveButton = false;
          this.collectService.validNuRetention = true;
        }
      }
    } else {
      //si es 0 no hay validaciones
      this.disabledSaveButton = false;
      if (this.collectService.documentSaleOpen.nuVaucherRetention == "")
        this.collectService.validNuRetention = false;
      else
        this.collectService.validNuRetention = true;
    }

    if (this.collectService.validNuRetention && this.isEmptyOrZeroRetention()) {
      this.disabledSaveButton = true;
      return;
    }

    if (this.collectService.validNuRetention && this.collectService.documentSaleOpen.daVoucher == "") {
      this.collectService.validateDaVoucher = false;
      this.disabledSaveButton = true;
    }


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

  setDaVoucher() {
    console.log(this.daVoucher);
    this.collectService.validateDaVoucher = true;
    this.daVoucher = this.daVoucher.split("T")[0];
    this.collectService.documentSaleOpen.daVoucher = this.daVoucher;
    if (this.collectService.validNuRetention) {
      if (!this.collectService.retencion) {
        this.disabledSaveButton = false;
      } else if (this.collectService.documentSaleOpen.nuAmountRetention + this.collectService.documentSaleOpen.nuAmountRetention2 == 0) {
        this.disabledSaveButton = true;
      } else
        this.disabledSaveButton = false;

    } else
      this.disabledSaveButton = false;
  }

  openPartialPayment(coDocument: string) {
    this.messageService.showLoading().then(() => {
      this.collectService.findCollect(this.synchronizationServices.getDatabase()).then(resp => {
        this.collectService.getPaymentPartialByDocument(this.synchronizationServices.getDatabase(), coDocument).then(resp => {
          this.messageService.hideLoading();
          this.collectService.openPaymentPartial = true;
        })
      })
    });
  }

  print() {
    console.log(this.collectService.collection);
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
    if (typeof (this as any).setAmountTotal === 'function') this.setAmountTotal();
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
    if (typeof (this as any).setAmountTotal === 'function') this.setAmountTotal();
  }

  private updateRetentionModel(): void {
    const cents = this.centsRetention ?? 0;
    const value = cents / this.centsFactor();
    this.collectService.documentSaleOpen.nuAmountRetention = value;
    this.displayRetention = this.formatFromCents(cents);
    if (typeof (this as any).setAmountTotal === 'function') this.setAmountTotal();
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
    if (typeof (this as any).setAmountTotal === 'function') this.setAmountTotal();
  }

  private updateRetention2Model(): void {
    const cents = this.centsRetention2 ?? 0;
    const value = cents / this.centsFactor();
    this.collectService.documentSaleOpen.nuAmountRetention2 = value;
    this.displayRetention2 = this.formatFromCents(cents);
    if (typeof (this as any).setAmountTotal === 'function') this.setAmountTotal();
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
    this.setManualCollectDiscountAmount(this.manualCollectDiscountAmount);

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
        + this.collectService.collection.collectionDetails[idxDetail].nuAmountDiscount
      const newBalance = runningBalance - discounts;

      // Reflejar de inmediato el nuevo monto a pagar
      this.collectService.amountPaid = newBalance;
      if (this.collectService.documentSaleOpen) {
        this.collectService.documentSaleOpen.nuAmountPaid = newBalance;
        this.collectService.documentSaleOpen.nuBalance = newBalance;
      }

      // Actualizar visual de monto a pagar en caliente
      this.centsAmountPaid = Math.round((newBalance ?? 0) * factor);
      try {
        this.displayAmountPaid = this.currencyService.formatNumber(newBalance);
      } catch {
        this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);
      }

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
          nuAmountPaid: newBalance
        };
        const clonedDetails = [...this.collectService.collection.collectionDetails];
        clonedDetails[idxDetail as number] = updated;
        this.collectService.collection.collectionDetails = clonedDetails;
      }

      // sincronizar arrays de documentos
      const ds = [...this.collectService.documentSales];
      if (ds[this.indexDocumentSaleOpen]) {
        ds[this.indexDocumentSaleOpen] = { ...ds[this.indexDocumentSaleOpen], nuBalance: newBalance, nuAmountPaid: newBalance };
      }
      this.collectService.documentSales = ds;

      const dsb = [...this.collectService.documentSalesBackup];
      if (dsb[this.indexDocumentSaleOpen]) {
        dsb[this.indexDocumentSaleOpen] = { ...dsb[this.indexDocumentSaleOpen], nuBalance: newBalance, nuAmountPaid: newBalance };
      }
      this.collectService.documentSalesBackup = dsb;

      // recalcular documento abierto y totales
      //await this.calculateSaldo(this.indexDocumentSaleOpen);
      //await this.calculateDocumentSaleOpen(this.indexDocumentSaleOpen);
      await Promise.resolve(this.collectService.calculatePayment("", 0));

      // actualizar UI
      this.centsAmountPaid = Math.round((this.collectService.amountPaid ?? 0) * factor);
      this.displayAmountPaid = this.formatFromCents(this.centsAmountPaid);

      //const hasDiscountComment = typeof this.discountComment === 'string' && this.discountComment.trim().length > 0;
      //if (hasDiscountComment) {
      this.disabledSaveButton = false;
      //}

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
    this.manualCollectDiscountAmount = cleanValue;
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


}
