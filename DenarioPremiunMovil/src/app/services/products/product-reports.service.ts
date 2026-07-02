import { Injectable, inject } from '@angular/core';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { Share } from '@capacitor/share';
import { Directory } from '@capacitor/filesystem';
import * as XLSX from 'xlsx';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { ProductStructureService } from '../productStructures/product-structure.service';
import { ProductStructure } from 'src/app/modelos/tables/productStructure';
import { TypeProductStructure } from 'src/app/modelos/tables/typeProductStructure';
import { ImageServicesService } from '../imageServices/image-services.service';
import { CurrencyService } from '../currency/currency.service';
import { PdfCreatorService } from '../pdf-creator/pdf-creator.service';
import {
  ProductReportExportFormat,
  ProductReportFilterType,
  ProductReportOptions,
  ProductReportRow,
  ProductReportSortField,
  ProductReportType,
} from 'src/app/productos/product-report.models';

@Injectable({
  providedIn: 'root',
})
export class ProductReportsService {
  private readonly config = inject(GlobalConfigService);
  private readonly dbService = inject(SynchronizationDBService);
  private readonly structureService = inject(ProductStructureService);
  private readonly imageServices = inject(ImageServicesService);
  private readonly currencyService = inject(CurrencyService);
  private readonly pdfCreator = inject(PdfCreatorService);

  isProductReportsEnabled(): boolean {
    return this.config.get('allowProductReports').toLowerCase() === 'true';
  }

  async loadFilterStructures(
    idEnterprise: number,
    filterType: ProductReportFilterType,
  ): Promise<ProductStructure[]> {
    if (filterType === 'all') {
      return [];
    }

    const db = this.dbService.getDatabase();
    await this.structureService.getTypeProductStructuresByIdEnterprise(db, idEnterprise);
    const type = this.resolveFilterType(this.structureService.typeProductStructureList, filterType);
    if (!type) {
      return [];
    }

    await this.structureService.getProductStructuresByIdTypeProductStructureAndIdEnterprise(
      db,
      type.idTypeProductStructure,
      idEnterprise,
    );
    return [...this.structureService.productStructureList];
  }

  async fetchReportRows(options: ProductReportOptions): Promise<ProductReportRow[]> {
    const db = this.dbService.getDatabase();
    await this.currencyService.setup(db);
    const structureIds = await this.resolveTargetStructureIds(db, options);
    const orderClause = this.buildOrderClause(options.reportType, options.sortField);
    const whereClause = this.buildWhereClause(structureIds, options.idEnterprise);
    const select = this.buildReportSelectQuery(whereClause, orderClause);

    const result = await db.executeSql(select, [options.idEnterprise]);
    const rows: ProductReportRow[] = [];

    for (let index = 0; index < result.rows.length; index++) {
      rows.push(this.mapReportRow(result.rows.item(index)));
    }

    return rows;
  }

  async generateAndShareReport(options: ProductReportOptions): Promise<void> {
    const rows = await this.fetchReportRows(options);
    if (options.reportType === 'priceList' && options.exportFormat === 'excel') {
      await this.sharePriceListExcel(rows, options);
      return;
    }

    if (options.reportType === 'priceList') {
      await this.sharePriceListPdf(rows, options);
      return;
    }

    await this.shareCatalogPdf(rows, options);
  }

  private resolveFilterType(
    types: TypeProductStructure[],
    filterType: ProductReportFilterType,
  ): TypeProductStructure | null {
    if (filterType === 'all' || types.length === 0) {
      return null;
    }

    const keywords: Record<Exclude<ProductReportFilterType, 'all'>, string[]> = {
      category: ['categoria', 'categoría', 'category'],
      brand: ['marca', 'brand'],
      tag: ['etiqueta', 'label', 'tag'],
    };

    const matches = types.find((type) =>
      keywords[filterType].some((keyword) =>
        type.naTypeProductStructure.toLowerCase().includes(keyword),
      ),
    );
    if (matches) {
      return matches;
    }

    const levelByFilter: Record<Exclude<ProductReportFilterType, 'all'>, number> = {
      category: 1,
      brand: 2,
      tag: 3,
    };
    const targetLevel = levelByFilter[filterType];
    return types.find((type) => type.nuLevel === targetLevel)
      ?? types[Math.min(targetLevel - 1, types.length - 1)]
      ?? null;
  }

  private async resolveTargetStructureIds(
    db: SQLiteObject,
    options: ProductReportOptions,
  ): Promise<number[] | null> {
    if (options.filterType === 'all' || !options.structureId) {
      return null;
    }

    const selected = await this.getStructureById(db, options.structureId, options.idEnterprise);
    if (!selected) {
      return null;
    }

    await this.structureService.getLowestsProductStructuresByCoProductStructuresAndIdEnterprise(
      db,
      selected.coProductStructure,
      options.idEnterprise,
    );
    return [...this.structureService.idProductStructureList];
  }

  private async getStructureById(
    db: SQLiteObject,
    idProductStructure: number,
    idEnterprise: number,
  ): Promise<ProductStructure | null> {
    const result = await db.executeSql(
      'SELECT * FROM product_structures WHERE id_product_structure = ? AND id_enterprise = ? LIMIT 1',
      [idProductStructure, idEnterprise],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows.item(0);
    return {
      idProductStructure: row.id_product_structure,
      coProductStructure: row.co_product_structure,
      naProductStructure: row.na_product_structure,
      quProducts: row.qu_products,
      idTypeProductStructure: row.id_type_product_structure,
      coTypeProductStructure: row.co_type_product_structure,
      coEnterprise: row.co_enterprise,
      idEnterprise: row.id_enterprise,
      scoProductStructure: row.sco_product_structure,
      snaProductStructure: row.sna_product_structure,
      type: row.type,
    };
  }

  private buildWhereClause(structureIds: number[] | null, idEnterprise: number): string {
    if (!structureIds || structureIds.length === 0) {
      return `p.id_enterprise = ${idEnterprise}`;
    }

    return `p.id_enterprise = ${idEnterprise} AND p.id_product_structure IN (${structureIds.join(',')})`;
  }

  private buildOrderClause(reportType: ProductReportType, sortField: ProductReportSortField): string {
    if (reportType === 'catalog') {
      return 'p.na_product ASC';
    }

    return sortField === 'code' ? 'p.co_product ASC' : 'p.na_product ASC';
  }

  private buildReportSelectQuery(whereClause: string, orderClause: string): string {
    return `
      SELECT
        p.id_product,
        p.co_product,
        p.na_product,
        COALESCE(p.tx_description, '') AS tx_description,
        COALESCE(p.tx_packing, '') AS tx_packing,
        COALESCE(u.na_unit, '') AS na_unit,
        COALESCE(u.co_unit, p.co_primary_unit, '') AS co_unit,
        COALESCE(ps.na_product_structure, '') AS na_product_structure,
        COALESCE((
          SELECT pl.nu_price
          FROM price_lists pl
          LEFT JOIN lists l ON pl.id_list = l.id_list
          WHERE pl.id_product = p.id_product
          ORDER BY l.na_list
          LIMIT 1
        ), NULL) AS nu_price,
        COALESCE((
          SELECT pl.co_currency
          FROM price_lists pl
          LEFT JOIN lists l ON pl.id_list = l.id_list
          WHERE pl.id_product = p.id_product
          ORDER BY l.na_list
          LIMIT 1
        ), '') AS co_currency,
        COALESCE((
          SELECT pmm.qu_minimum
          FROM product_min_muls pmm
          WHERE pmm.id_product = p.id_product
          LIMIT 1
        ), 1) AS qu_minimum,
        COALESCE((
          SELECT pmm.qu_multiple
          FROM product_min_muls pmm
          WHERE pmm.id_product = p.id_product
          LIMIT 1
        ), 1) AS qu_multiple,
        COALESCE((
          SELECT CAST(pu.qu_unit AS TEXT)
          FROM product_units pu
          JOIN units u2 ON pu.id_unit = u2.id_unit
          WHERE pu.id_product = p.id_product
            AND u2.co_unit != p.co_primary_unit
          ORDER BY pu.qu_unit DESC
          LIMIT 1
        ), COALESCE(p.tx_packing, '')) AS bulk_units
      FROM products p
      LEFT JOIN product_structures ps ON p.id_product_structure = ps.id_product_structure
      LEFT JOIN units u ON p.co_primary_unit = u.co_unit AND p.id_enterprise = u.id_enterprise
      WHERE ${whereClause}
      ORDER BY ${orderClause}
    `;
  }

  private mapReportRow(row: Record<string, unknown>): ProductReportRow {
    const coProduct = String(row['co_product'] ?? '');
    const imageFromService = this.imageServices.getImgForProduct(coProduct);
    const fallbackImage = this.imageServices.mapImagesFiles.get(coProduct)?.[0]
      ?? '../../../assets/images/nodisponible.png';

    return {
      idProduct: Number(row['id_product'] ?? 0),
      coProduct,
      naProduct: String(row['na_product'] ?? ''),
      txDescription: String(row['tx_description'] ?? ''),
      txPacking: String(row['tx_packing'] ?? ''),
      naUnit: String(row['na_unit'] ?? ''),
      coUnit: String(row['co_unit'] ?? ''),
      nuPrice: row['nu_price'] == null ? null : Number(row['nu_price']),
      coCurrency: String(row['co_currency'] ?? ''),
      quMinimum: Number(row['qu_minimum'] ?? 1),
      quMultiple: Number(row['qu_multiple'] ?? 1),
      bulkUnits: String(row['bulk_units'] ?? ''),
      naProductStructure: String(row['na_product_structure'] ?? ''),
      imageSrc: imageFromService ?? fallbackImage,
    };
  }

  private formatPrice(value: number | null, currency: string): string {
    if (value == null || Number.isNaN(value)) {
      return 'N/A';
    }

    return `${this.currencyService.formatNumber(value)} ${currency}`.trim();
  }

  private buildPriceListColumns(): Array<{ label: string; align?: 'left' | 'center' | 'right'; width?: string }> {
    return [
      { label: 'Codigo', width: '12%' },
      { label: 'Nombre', width: '30%' },
      { label: 'Precio', align: 'right', width: '14%' },
      { label: 'Moneda', width: '10%' },
      { label: 'Unidad', width: '12%' },
      { label: 'Estructura', width: '22%' },
    ];
  }

  private mapPriceListPdfRows(rows: ProductReportRow[]): string[][] {
    return rows.map((row) => [
      row.coProduct,
      row.naProduct,
      row.nuPrice == null ? 'N/A' : this.currencyService.formatNumber(row.nuPrice),
      row.coCurrency || 'N/A',
      row.naUnit || row.coUnit || 'N/A',
      row.naProductStructure,
    ]);
  }

  private async sharePriceListExcel(rows: ProductReportRow[], options: ProductReportOptions): Promise<void> {
    const sheetRows = rows.map((row) => ({
      Codigo: row.coProduct,
      Nombre: row.naProduct,
      Precio: row.nuPrice ?? '',
      Moneda: row.coCurrency,
      Unidad: row.naUnit || row.coUnit,
      Estructura: row.naProductStructure,
      Embalaje: row.txPacking,
      VentaMinima: row.quMinimum > 1 ? row.quMinimum : '',
      Multiplo: row.quMultiple > 1 ? row.quMultiple : '',
      Notas: row.txDescription,
    }));

    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ListaPrecios');
    const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const fileName = this.buildFileName('lista_precios', 'xlsx', options);
    const saved = await this.pdfCreator.savePdf(base64, fileName, Directory.Cache);
    await this.shareFile(saved.uri, fileName);
  }

  private async sharePriceListPdf(rows: ProductReportRow[], options: ProductReportOptions): Promise<void> {
    const doc = await this.pdfCreator.generateSummaryPdfDoc({
      title: 'Lista de precios',
      meta: [
        { label: 'Empresa', value: options.enterpriseLabel },
        { label: 'Productos', value: String(rows.length) },
        { label: 'Orden', value: options.sortField === 'code' ? 'Codigo' : 'Descripcion' },
      ],
      columns: this.buildPriceListColumns(),
      rows: this.mapPriceListPdfRows(rows),
      fileName: this.buildFileName('lista_precios', 'pdf', options),
    }, { orientation: 'landscape', format: 'letter' });

    const base64 = doc.output('datauristring').split(',')[1];
    const fileName = this.buildFileName('lista_precios', 'pdf', options);
    const saved = await this.pdfCreator.savePdf(base64, fileName, Directory.Cache);
    await this.shareFile(saved.uri, fileName);
  }

  private async shareCatalogPdf(rows: ProductReportRow[], options: ProductReportOptions): Promise<void> {
    const html = await this.buildCatalogHtml(rows, options);
    const doc = await this.pdfCreator.generateWithJsPDF(html, {
      orientation: 'portrait',
      scale: 2,
      layoutScale: 1,
    });
    const base64 = doc.output('datauristring').split(',')[1];
    const fileName = this.buildFileName('catalogo_productos', 'pdf', options);
    const saved = await this.pdfCreator.savePdf(base64, fileName, Directory.Cache);
    await this.shareFile(saved.uri, fileName);
  }

  private async buildCatalogHtml(rows: ProductReportRow[], options: ProductReportOptions): Promise<string> {
    const cards = await Promise.all(rows.map((row) => this.buildCatalogCardHtml(row)));
    return `
      <div style="font-family: Arial, sans-serif; color: #222; width: 100%; box-sizing: border-box; padding: 16px; background: #fff;">
        <div style="background: #430197; color: #fff; border-radius: 12px; padding: 16px 18px; margin-bottom: 16px;">
          <div style="font-size: 22px; font-weight: 700;">Catalogo de productos</div>
          <div style="font-size: 13px; margin-top: 6px;">${this.escapeHtml(options.enterpriseLabel)}</div>
        </div>
        ${cards.join('')}
      </div>
    `;
  }

  private async buildCatalogCardHtml(row: ProductReportRow): Promise<string> {
    const imageSrc = await this.resolveImageDataUri(row);
    const minSale = row.quMinimum > 1 ? String(row.quMinimum) : 'N/A';
    const bulk = row.bulkUnits || row.txPacking || 'N/A';

    return `
      <div style="display: flex; gap: 14px; border: 1px solid #e0d5ef; border-radius: 12px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid;">
        <div style="width: 120px; min-width: 120px;">
          <img src="${imageSrc}" alt="${this.escapeHtml(row.coProduct)}" style="width: 110px; height: 110px; object-fit: contain; border-radius: 8px; background: #f7f4fb;" />
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 16px; font-weight: 700; color: #430197; margin-bottom: 6px;">${this.escapeHtml(row.naProduct)}</div>
          <div style="font-size: 12px; margin-bottom: 4px;"><strong>Codigo:</strong> ${this.escapeHtml(row.coProduct)}</div>
          <div style="font-size: 12px; margin-bottom: 4px;"><strong>Precio:</strong> ${this.escapeHtml(this.formatPrice(row.nuPrice, row.coCurrency))}</div>
          <div style="font-size: 12px; margin-bottom: 4px;"><strong>Unidad:</strong> ${this.escapeHtml(row.naUnit || row.coUnit || 'N/A')}</div>
          <div style="font-size: 12px; margin-bottom: 4px;"><strong>Bulto:</strong> ${this.escapeHtml(bulk)}</div>
          <div style="font-size: 12px; margin-bottom: 4px;"><strong>Venta minima:</strong> ${this.escapeHtml(minSale)}</div>
          <div style="font-size: 12px; margin-bottom: 4px;"><strong>Notas:</strong> ${this.escapeHtml(row.txDescription || 'N/A')}</div>
        </div>
      </div>
    `;
  }

  private async resolveImageDataUri(row: ProductReportRow): Promise<string> {
    if (row.imageSrc.startsWith('data:')) {
      return row.imageSrc;
    }

    if (row.imageSrc.includes('nodisponible.png')) {
      return row.imageSrc;
    }

    try {
      const base64 = await this.imageServices.getImageBase64(`${row.coProduct}.jpg`);
      if (base64) {
        return `data:image/jpeg;base64,${base64}`;
      }
    } catch {
      // fallback below
    }

    return row.imageSrc;
  }

  private buildFileName(prefix: string, extension: string, options: ProductReportOptions): string {
    const date = new Date().toISOString().slice(0, 10);
    return `${prefix}_${options.idEnterprise}_${date}.${extension}`;
  }

  private async shareFile(uri: string, title: string): Promise<void> {
    try {
      await Share.share({ title, url: uri });
    } catch (error) {
      console.error('[ProductReportsService] Error sharing report file', error);
    }
  }

  private escapeHtml(input: string): string {
    return String(input ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
