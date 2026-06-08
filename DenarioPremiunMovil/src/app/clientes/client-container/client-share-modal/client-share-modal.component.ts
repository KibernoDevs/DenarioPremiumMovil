import { Component, inject, Input, OnInit } from '@angular/core';
import { Client } from 'src/app/modelos/tables/client';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { PdfCreatorService } from 'src/app/services/pdf-creator/pdf-creator.service';
import { Share } from '@capacitor/share';

@Component({
  selector: 'app-client-share-modal',
  templateUrl: './client-share-modal.component.html',
  styleUrls: ['./client-share-modal.component.scss'],
  standalone: false,
})
export class ClientShareModalComponent implements OnInit {
  public clientLogic = inject(ClientLogicService);
  public currencyService = inject(CurrencyService);
  private globalConfig = inject(GlobalConfigService);
  private pdfCreator = inject(PdfCreatorService);
  private message = this.clientLogic.message;

  public localCurrency = '';
  public hardCurrency = '';

  @Input() client?: Client;

  public document: DocumentSale[] = [];
  public tagRif = '';
  public exporting = false;

  get showConversion(): boolean {
    return this.clientLogic.multiCurrency && this.clientLogic.showConversion;
  }

  ngOnInit() {
    this.localCurrency = this.currencyService.localCurrency?.coCurrency ?? '';
    if (this.clientLogic.multiCurrency) {
      this.hardCurrency = this.currencyService.hardCurrency?.coCurrency ?? '';
    }
    this.document = this.clientLogic.documentsSaleSelectShared ?? [];
    this.client = this.client ?? this.clientLogic.datos?.client;
    this.tagRif = this.globalConfig.get('tagRif')!;

    if (!this.client || this.document.length === 0) {
      console.error('ClientShareModal: missing client or documents for PDF export');
      this.cancelPreview();
      return;
    }
  }

  getDaDueDate(daDueDate: string) {
    const dateDoc = new Date(daDueDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$2/$1/$3')).getTime();
    return Math.abs(Math.round((new Date().getTime() - dateDoc) / 86400000));
  }

  formatNumber(num: number) {
    return this.currencyService.formatNumber(num);
  }

  toLocalCurrency(hardAmount: number, doc: DocumentSale): string {
    if (doc.coCurrency == this.localCurrency) {
      return this.formatNumber(hardAmount);
    }
    return this.formatNumber(this.currencyService.toLocalCurrencyByNuValueLocal(hardAmount, doc.nuValueLocal));
  }

  toHardCurrency(localAmount: number, doc: DocumentSale): string {
    if (doc.coCurrency == this.hardCurrency) {
      return this.formatNumber(localAmount);
    }
    return this.formatNumber(this.currencyService.toHardCurrencyByNuValueLocal(localAmount, doc.nuValueLocal));
  }

  private buildPdfColumns(showConversion: boolean) {
    const tags = this.clientLogic.clientTags;
    const columns: Array<{ label: string; align?: 'left' | 'center' | 'right'; width?: string; noWrap?: boolean }> = [
      { label: tags.get('CLI_DETAIL_TIPO') ?? 'Tipo', align: 'center', width: '6%', noWrap: true },
      { label: tags.get('CLI_DETAIL_NUMERO_DOCUMENTO') ?? 'Documento', align: 'center', width: '10%', noWrap: true },
      { label: tags.get('CLI_DETAIL_MONEDA_DOC') ?? 'Moneda', align: 'center', width: '6%', noWrap: true },
      { label: tags.get('CLI_DETAIL_DIAS_VENCIMIENTO') ?? 'Dias', align: 'center', width: '6%', noWrap: true },
    ];

    if (showConversion) {
      columns.push({ label: tags.get('CLI_DETAIL_TASA') ?? 'Tasa', align: 'center', width: '7%', noWrap: true });
    }

    columns.push(
      { label: `${tags.get('CLI_DETAIL_MONTO') ?? 'Monto'} ${this.localCurrency}`, align: 'center', width: '9%', noWrap: true },
    );

    if (showConversion) {
      columns.push({
        label: `${tags.get('CLI_DETAIL_MONTO') ?? 'Monto'} ${this.hardCurrency}`,
        align: 'center',
        width: '9%',
        noWrap: true,
      });
    }

    columns.push(
      { label: `${tags.get('CLI_DETAIL_SALDO') ?? 'Saldo'} ${this.localCurrency}`, align: 'center', width: '9%', noWrap: true },
    );

    if (showConversion) {
      columns.push({
        label: `${tags.get('CLI_DETAIL_SALDO') ?? 'Saldo'} ${this.hardCurrency}`,
        align: 'center',
        width: '9%',
        noWrap: true,
      });
    }

    columns.push(
      { label: tags.get('CLI_DETAIL_FECHA_DOCUMENTO') ?? 'Fecha doc.', align: 'center', width: '8%', noWrap: true },
      { label: tags.get('CLI_DETAIL_FECHA_VENCIMIENTO') ?? 'Fecha venc.', align: 'center', width: '8%', noWrap: true },
    );

    return columns;
  }

  private buildPdfRows(showConversion: boolean): string[][] {
    return this.document.map(documento => {
      const row: string[] = [
        String(documento.coDocumentSaleType ?? ''),
        String(documento.coDocument ?? ''),
        String(documento.coCurrency ?? ''),
        String(this.getDaDueDate(documento.daDueDate)),
      ];

      if (showConversion) {
        row.push(this.formatNumber(documento.nuValueLocal));
      }

      row.push(this.toLocalCurrency(documento.nuAmountTotal, documento));

      if (showConversion) {
        row.push(this.toHardCurrency(documento.nuAmountTotal, documento));
      }

      row.push(this.toLocalCurrency(documento.nuBalance, documento));

      if (showConversion) {
        row.push(this.toHardCurrency(documento.nuBalance, documento));
      }

      row.push(String(documento.daDocument ?? ''), String(documento.daDueDate ?? ''));
      return row;
    });
  }

  async exportPdf() {
    if (this.exporting || !this.client) {
      return;
    }

    this.exporting = true;
    await this.message.showLoading();

    try {
      const tags = this.clientLogic.clientTags;
      const showConversion = this.clientLogic.multiCurrency && this.clientLogic.showConversion;
      const client = this.client!;

      const doc = await this.pdfCreator.generateSummaryPdfDoc({
        title: tags.get('CLI_DETAIL_TAB_DOCUMENTO_VENTA') ?? 'Documentos de venta',
        meta: [
          { label: `${tags.get('CLI_DETAIL_EMPRESA') ?? 'Empresa'}:`, value: client.lblEnterprise ?? '' },
          { label: `${tags.get('CLI_DETAIL_NOMBRE') ?? 'Nombre'}:`, value: client.naClient ?? '' },
          { label: `${tags.get('CLI_DETAIL_CODIGO') ?? 'Codigo'}:`, value: client.coClient ?? '' },
          { label: `${tags.get('CLI_DETAIL_LISTA_PRECIO') ?? 'Lista precio'}:`, value: client.naPriceList ?? '' },
          { label: `${this.tagRif}:`, value: client.nuRif ?? '' },
          { label: `${tags.get('CLI_DETAIL_CONTACTO') ?? 'Contacto'}:`, value: client.naResponsible ?? '' },
          { label: `${tags.get('CLI_DETAIL_EMAIL') ?? 'Email'}:`, value: client.naEmail ?? '' },
          { label: `${tags.get('CLI_DETAIL_TELEFONO') ?? 'Telefono'}:`, value: client.nuPhone ?? '' },
        ],
        columns: this.buildPdfColumns(showConversion),
        rows: this.buildPdfRows(showConversion),
      }, { orientation: 'landscape', format: 'letter' });

      const base64 = doc.output('datauristring');
      const trimmed = base64.split(',')[1];
      const filename = 'invoice_' + (client.lbClient ?? 'client') + '.pdf';
      const res = await this.pdfCreator.savePdf(trimmed, filename);

      try {
        await Share.share({ url: res.uri });
      } catch (err) {
        console.error('Error sharing PDF:', err);
      }

      this.finishShare(filename);
    } catch (err) {
      console.error('Error saving PDF:', err);
      this.finishShare();
    } finally {
      this.exporting = false;
    }
  }

  cancelPreview() {
    this.clientLogic.closeClientShareModalFunction();
  }

  deleteTempPdf(fileName: string) {
    this.pdfCreator.deletePdf(fileName).then(() => {
      console.log('Temporary PDF deleted:', fileName);
    }).catch((delErr: any) => {
      console.error('Error deleting temporary PDF file:', delErr);
    });
  }

  finishShare(filename?: string) {
    if (filename) {
      this.deleteTempPdf(filename);
    }
    this.clientLogic.closeClientShareModalFunction();
    this.message.hideLoading();
  }
}
