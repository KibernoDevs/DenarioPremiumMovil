import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { Client } from 'src/app/modelos/tables/client';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { PdfCreatorService } from 'src/app/services/pdf-creator/pdf-creator.service';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

@Component({
  selector: 'app-client-share-modal',
  templateUrl: './client-share-modal.component.html',
  styleUrls: ['./client-share-modal.component.scss'],
  standalone: false,
})
export class ClientShareModalComponent implements OnInit, OnChanges {
  public clientLogic = inject(ClientLogicService);
  public currencyService = inject(CurrencyService);
  private globalConfig = inject(GlobalConfigService);
  private pdfCreator = inject(PdfCreatorService);
  private imageServices = inject(ImageServicesService);
  private message = this.clientLogic.message;

  public localCurrency = '';
  public hardCurrency = '';

  @Input() client?: Client;
  @Input() documents: DocumentSale[] = [];

  public document: DocumentSale[] = [];
  public tagRif = '';
  public exporting = false;

  get showConversion(): boolean {
    return this.clientLogic.multiCurrency && this.clientLogic.showConversion;
  }

  ngOnInit(): void {
    this.initializeModalContext();
    this.syncDocumentsFromInput();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['documents']) {
      this.syncDocumentsFromInput();
    }
  }

  private initializeModalContext(): void {
    this.localCurrency = this.currencyService.localCurrency?.coCurrency ?? '';
    if (this.clientLogic.multiCurrency) {
      this.hardCurrency = this.currencyService.hardCurrency?.coCurrency ?? '';
    }
    this.client = this.client ?? this.clientLogic.datos?.client;
    this.tagRif = this.globalConfig.get('tagRif')!;
  }

  private syncDocumentsFromInput(): void {
    const source = this.documents?.length
      ? this.documents
      : (this.clientLogic.documentsSaleSelectShared ?? []);

    this.document = [...source];
  }

  getDaDueDate(daDueDate: string): number {
    if (!daDueDate) {
      return 0;
    }

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

    if (!dueDate) {
      return 0;
    }

    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    return Math.abs(Math.floor((todayOnly.getTime() - dueDateOnly.getTime()) / 86400000));
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

  async exportPdf(): Promise<void> {
    if (this.exporting || !this.client || this.document.length === 0) {
      console.error('ClientShareModal: missing client or documents for PDF export');
      return;
    }

    this.exporting = true;
    await this.message.showLoading();

    const shareDirectory = Directory.Cache;

    try {
      const tags = this.clientLogic.clientTags;
      const showConversion = this.clientLogic.multiCurrency && this.clientLogic.showConversion;
      const client = this.client!;

      const coEnterprise = client.coEnterprise ?? this.clientLogic.empresaSeleccionada?.coEnterprise;
      const empresa = this.clientLogic.empresaSeleccionada
        ?? this.clientLogic.enterpriseServ.getEnterprises()
          .find((item) => item.idEnterprise === client.idEnterprise);

      const logoBase64 = await this.imageServices.getLogoBase64ForEnterprise(coEnterprise);

      const doc = await this.pdfCreator.generateSummaryPdfDoc({
        title: tags.get('CLI_DETAIL_TAB_DOCUMENTO_VENTA') ?? 'Documentos de venta',
        enterpriseHeader: {
          name: (empresa?.naEnterprise || empresa?.lbEnterprise || client.lblEnterprise || '').trim(),
          rif: empresa?.nuRif ?? '',
          address: empresa?.txAddress ?? '',
          logoBase64,
        },
        meta: [
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
      const filename = `invoice_${client.coClient ?? 'client'}.pdf`;
      const res = await this.pdfCreator.savePdf(trimmed, filename, shareDirectory);

      await this.message.hideLoading();

      try {
        await Share.share({
          title: filename,
          dialogTitle: 'Compartir PDF',
          files: [res.uri],
        });
        this.finishShare(filename, shareDirectory);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes('cancel')) {
          this.deleteTempPdf(filename, shareDirectory);
          return;
        }
        console.error('Error sharing PDF:', err);
        this.deleteTempPdf(filename, shareDirectory);
      }
    } catch (err) {
      console.error('Error saving PDF:', err);
      await this.message.hideLoading();
    } finally {
      this.exporting = false;
    }
  }

  cancelPreview() {
    this.clientLogic.closeClientShareModalFunction();
  }

  deleteTempPdf(fileName: string, directory: Directory = Directory.External) {
    this.pdfCreator.deletePdf(fileName, directory).then(() => {
      console.log('Temporary PDF deleted:', fileName);
    }).catch((delErr: unknown) => {
      console.error('Error deleting temporary PDF file:', delErr);
    });
  }

  finishShare(filename?: string, directory: Directory = Directory.External) {
    if (filename) {
      this.deleteTempPdf(filename, directory);
    }
    this.clientLogic.closeClientShareModalFunction();
    void this.message.hideLoading();
  }
}
