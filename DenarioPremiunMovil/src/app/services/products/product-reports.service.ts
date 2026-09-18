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
import { EnterpriseService } from '../enterprise/enterprise.service';
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
  private readonly enterpriseService = inject(EnterpriseService);

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
    const whereClause = this.buildWhereClause(structureIds);
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

  private buildWhereClause(structureIds: number[] | null): string {
    if (!structureIds || structureIds.length === 0) {
      return 'p.id_enterprise = ?';
    }

    return `p.id_enterprise = ? AND p.id_product_structure IN (${structureIds.join(',')})`;
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
        COALESCE(
          CASE
            WHEN TRIM(COALESCE(p.tx_description, '')) = '' THEN NULL
            WHEN LOWER(TRIM(p.tx_description)) IN ('null', 'undefined', 'n/a', 'na') THEN NULL
            ELSE TRIM(p.tx_description)
          END,
          ''
        ) AS tx_description,
        COALESCE(
          CASE
            WHEN TRIM(COALESCE(p.tx_packing, '')) = '' THEN NULL
            WHEN LOWER(TRIM(p.tx_packing)) IN ('null', 'undefined', 'n/a', 'na') THEN NULL
            ELSE TRIM(p.tx_packing)
          END,
          ''
        ) AS tx_packing,
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
            AND pmm.id_enterprise = p.id_enterprise
            AND (pmm.flag = 1 OR LOWER(CAST(pmm.flag AS TEXT)) IN ('true', '1'))
            AND NOT (pmm.flag = 0 OR LOWER(CAST(pmm.flag AS TEXT)) IN ('false', '0'))
          LIMIT 1
        ), 1) AS qu_minimum,
        COALESCE((
          SELECT pmm.qu_multiple
          FROM product_min_muls pmm
          WHERE pmm.id_product = p.id_product
            AND pmm.id_enterprise = p.id_enterprise
            AND (pmm.flag = 1 OR LOWER(CAST(pmm.flag AS TEXT)) IN ('true', '1'))
            AND NOT (pmm.flag = 0 OR LOWER(CAST(pmm.flag AS TEXT)) IN ('false', '0'))
          LIMIT 1
        ), 1) AS qu_multiple,
        COALESCE(
          (
            SELECT CAST(pu.qu_unit AS TEXT)
            FROM product_units pu
            JOIN units u2 ON pu.id_unit = u2.id_unit
            WHERE pu.id_product = p.id_product
              AND u2.co_unit != p.co_primary_unit
              AND pu.qu_unit IS NOT NULL
            ORDER BY pu.qu_unit DESC
            LIMIT 1
          ),
          CASE
            WHEN TRIM(COALESCE(p.tx_packing, '')) = '' THEN NULL
            WHEN LOWER(TRIM(p.tx_packing)) IN ('null', 'undefined', 'n/a', 'na') THEN NULL
            ELSE TRIM(p.tx_packing)
          END,
          ''
        ) AS bulk_units
      FROM products p
      LEFT JOIN product_structures ps ON p.id_product_structure = ps.id_product_structure
      LEFT JOIN units u ON p.co_primary_unit = u.co_unit AND p.id_enterprise = u.id_enterprise
      WHERE ${whereClause}
      ORDER BY ${orderClause}
    `;
  }

  private sanitizeDisplayValue(value: unknown): string {
    if (value == null) {
      return '';
    }

    const text = String(value).trim();
    if (!text) {
      return '';
    }

    const normalized = text.toLowerCase();
    if (normalized === 'null' || normalized === 'undefined' || normalized === 'n/a' || normalized === 'na') {
      return '';
    }

    return text;
  }

  private tag(tags: Map<string, string> | undefined, key: string, fallback: string): string {
    return tags?.get(key) ?? fallback;
  }

  private displayOrNa(value: string, tags?: Map<string, string>): string {
    return value.trim() ? value : this.tag(tags, 'PROD_REPORT_NA', 'N/A');
  }

  private mapReportRow(row: Record<string, unknown>): ProductReportRow {
    const coProduct = this.sanitizeDisplayValue(row['co_product']);
    const imageFromService = this.imageServices.getProductThumbnail(coProduct);
    const bulkUnits = this.sanitizeDisplayValue(row['bulk_units']);
    const txPacking = this.sanitizeDisplayValue(row['tx_packing']);

    return {
      idProduct: Number(row['id_product'] ?? 0),
      coProduct,
      naProduct: this.sanitizeDisplayValue(row['na_product']),
      txDescription: this.sanitizeDisplayValue(row['tx_description']),
      txPacking,
      naUnit: this.sanitizeDisplayValue(row['na_unit']),
      coUnit: this.sanitizeDisplayValue(row['co_unit']),
      nuPrice: row['nu_price'] == null ? null : Number(row['nu_price']),
      coCurrency: this.sanitizeDisplayValue(row['co_currency']),
      quMinimum: Number(row['qu_minimum'] ?? 1),
      quMultiple: Number(row['qu_multiple'] ?? 1),
      bulkUnits: bulkUnits || txPacking,
      naProductStructure: this.sanitizeDisplayValue(row['na_product_structure']),
      imageSrc: imageFromService,
    };
  }

  private formatPrice(value: number | null, currency: string, tags?: Map<string, string>): string {
    if (value == null || Number.isNaN(value)) {
      return this.tag(tags, 'PROD_REPORT_NA', 'N/A');
    }

    return `${this.currencyService.formatNumber(value)} ${currency}`.trim();
  }

  private buildPriceListColumns(
    tags?: Map<string, string>,
  ): Array<{ label: string; align?: 'left' | 'center' | 'right'; width?: string }> {
    return [
      { label: this.tag(tags, 'PROD_COD_PROD', 'Código'), width: '12%' },
      { label: this.tag(tags, 'PROD_NAME_PROD', 'Nombre'), width: '30%' },
      { label: this.tag(tags, 'PROD_PRICE_PROD', 'Precio'), align: 'right', width: '14%' },
      { label: this.tag(tags, 'PROD_REPORT_COL_CURRENCY', 'Moneda'), width: '10%' },
      { label: this.tag(tags, 'PROD_REPORT_COL_UNIT', 'Unidad'), width: '12%' },
      { label: this.tag(tags, 'PROD_REPORT_COL_STRUCTURE', 'Estructura'), width: '22%' },
    ];
  }

  private mapPriceListPdfRows(rows: ProductReportRow[], tags?: Map<string, string>): string[][] {
    const na = this.tag(tags, 'PROD_REPORT_NA', 'N/A');
    return rows.map((row) => [
      row.coProduct,
      row.naProduct,
      row.nuPrice == null ? na : this.currencyService.formatNumber(row.nuPrice),
      this.displayOrNa(row.coCurrency, tags),
      this.displayOrNa(row.naUnit || row.coUnit, tags),
      this.displayOrNa(row.naProductStructure, tags),
    ]);
  }

  private async sharePriceListExcel(rows: ProductReportRow[], options: ProductReportOptions): Promise<void> {
    const tags = options.tags;
    const colCodigo = this.tag(tags, 'PROD_COD_PROD', 'Código');
    const colNombre = this.tag(tags, 'PROD_NAME_PROD', 'Nombre');
    const colPrecio = this.tag(tags, 'PROD_PRICE_PROD', 'Precio');
    const colMoneda = this.tag(tags, 'PROD_REPORT_COL_CURRENCY', 'Moneda');
    const colUnidad = this.tag(tags, 'PROD_REPORT_COL_UNIT', 'Unidad');
    const colEstructura = this.tag(tags, 'PROD_REPORT_COL_STRUCTURE', 'Estructura');
    const colEmbalaje = this.tag(tags, 'PROD_REPORT_COL_PACKING', 'Embalaje');
    const colVentaMinima = this.tag(tags, 'PROD_REPORT_COL_MIN_SALE', 'Venta mínima');
    const colMultiplo = this.tag(tags, 'PROD_REPORT_COL_MULTIPLE', 'Múltiplo');
    const colNotas = this.tag(tags, 'PROD_REPORT_COL_NOTES', 'Notas');

    const sheetRows = rows.map((row) => ({
      [colCodigo]: row.coProduct,
      [colNombre]: row.naProduct,
      [colPrecio]: row.nuPrice ?? '',
      [colMoneda]: row.coCurrency,
      [colUnidad]: row.naUnit || row.coUnit,
      [colEstructura]: row.naProductStructure,
      [colEmbalaje]: row.txPacking || row.bulkUnits,
      [colVentaMinima]: row.quMinimum > 1 ? row.quMinimum : '',
      [colMultiplo]: row.quMultiple > 1 ? row.quMultiple : '',
      [colNotas]: row.txDescription,
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
    const tags = options.tags;
    const enterpriseHeader = await this.buildEnterprisePdfHeader(options);
    const sortLabel = options.sortField === 'code'
      ? this.tag(tags, 'PROD_COD_PROD', 'Código')
      : this.tag(tags, 'PROD_DESC_PROD', 'Descripción');

    const doc = await this.pdfCreator.generateSummaryPdfDoc({
      title: this.tag(tags, 'PROD_REPORT_TYPE_PRICE_LIST', 'Lista de precios'),
      enterpriseHeader,
      meta: [
        { label: this.tag(tags, 'PROD_REPORT_META_PRODUCTS', 'Productos'), value: String(rows.length) },
        { label: this.tag(tags, 'PROD_REPORT_ORDER', 'Orden'), value: sortLabel },
      ],
      columns: this.buildPriceListColumns(tags),
      rows: this.mapPriceListPdfRows(rows, tags),
      fileName: this.buildFileName('lista_precios', 'pdf', options),
    }, { orientation: 'landscape', format: 'letter' });

    const dataUri = doc.output('datauristring');
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    if (!base64) {
      throw new Error('PDF de lista de precios vacio');
    }

    const fileName = this.buildFileName('lista_precios', 'pdf', options);
    const saved = await this.pdfCreator.savePdf(base64, fileName, Directory.Cache);
    await this.shareFile(saved.uri, fileName);
  }

  private async shareCatalogPdf(rows: ProductReportRow[], options: ProductReportOptions): Promise<void> {
    const tags = options.tags;
    const enterpriseHeader = await this.buildEnterprisePdfHeader(options);

    const doc = await this.pdfCreator.generateSummaryPdfDoc({
      title: this.tag(tags, 'PROD_REPORT_TYPE_CATALOG', 'Catálogo de productos'),
      enterpriseHeader,
      meta: [
        { label: this.tag(tags, 'PROD_REPORT_META_PRODUCTS', 'Productos'), value: String(rows.length) },
        {
          label: this.tag(tags, 'PROD_REPORT_META_ENTERPRISE', 'Empresa'),
          value: options.enterpriseLabel || enterpriseHeader.name || '',
        },
      ],
      columns: this.buildCatalogColumns(tags),
      rows: this.mapCatalogPdfRows(rows, tags),
      fileName: this.buildFileName('catalogo_productos', 'pdf', options),
    }, { orientation: 'landscape', format: 'letter' });

    const dataUri = doc.output('datauristring');
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    if (!base64) {
      throw new Error('PDF de catalogo vacio');
    }

    const fileName = this.buildFileName('catalogo_productos', 'pdf', options);
    const saved = await this.pdfCreator.savePdf(base64, fileName, Directory.Cache);
    await this.shareFile(saved.uri, fileName);
  }

  /**
   * Cabecera de empresa con logo (mismo patrón que clientes/pedidos).
   */
  private async buildEnterprisePdfHeader(options: ProductReportOptions): Promise<{
    name: string;
    rif: string;
    address: string;
    logoBase64: string | null;
  }> {
    await this.ensureEnterprisesLoaded();
    const enterprise = this.resolveEnterprise(options);
    const coEnterprise = (options.coEnterprise || enterprise?.coEnterprise || '').trim();
    const logoBase64 = coEnterprise
      ? await this.imageServices.getLogoBase64ForEnterprise(coEnterprise)
      : null;

    return {
      name: (
        enterprise?.naEnterprise
        || enterprise?.lbEnterprise
        || options.enterpriseLabel
        || ''
      ).trim(),
      rif: enterprise?.nuRif ?? '',
      address: enterprise?.txAddress ?? '',
      logoBase64,
    };
  }

  private resolveEnterprise(options: ProductReportOptions) {
    const enterprises = this.enterpriseService.getEnterprises() ?? [];
    const byId = enterprises.find(
      (item) => Number(item.idEnterprise) === Number(options.idEnterprise),
    );
    if (byId) {
      return byId;
    }

    const coEnterprise = (options.coEnterprise || '').trim().toLowerCase();
    if (coEnterprise) {
      const byCode = enterprises.find(
        (item) => String(item.coEnterprise ?? '').trim().toLowerCase() === coEnterprise,
      );
      if (byCode) {
        return byCode;
      }
    }

    return enterprises[0];
  }

  private buildCatalogColumns(
    tags?: Map<string, string>,
  ): Array<{ label: string; align?: 'left' | 'center' | 'right'; width?: string }> {
    return [
      { label: this.tag(tags, 'PROD_COD_PROD', 'Código'), width: '12%' },
      { label: this.tag(tags, 'PROD_NAME_PROD', 'Nombre'), width: '28%' },
      { label: this.tag(tags, 'PROD_PRICE_PROD', 'Precio'), align: 'right', width: '12%' },
      { label: this.tag(tags, 'PROD_REPORT_COL_UNIT', 'Unidad'), width: '10%' },
      { label: this.tag(tags, 'PROD_REPORT_COL_BULK', 'Bulto'), width: '12%' },
      { label: this.tag(tags, 'PROD_REPORT_COL_MIN', 'Mín.'), align: 'right', width: '8%' },
      { label: this.tag(tags, 'PROD_REPORT_COL_NOTES', 'Notas'), width: '18%' },
    ];
  }

  private mapCatalogPdfRows(rows: ProductReportRow[], tags?: Map<string, string>): string[][] {
    const na = this.tag(tags, 'PROD_REPORT_NA', 'N/A');
    return rows.map((row) => [
      row.coProduct,
      row.naProduct,
      this.formatPrice(row.nuPrice, row.coCurrency, tags),
      this.displayOrNa(row.naUnit || row.coUnit, tags),
      this.displayOrNa(row.bulkUnits || row.txPacking, tags),
      row.quMinimum > 1 ? String(row.quMinimum) : na,
      this.displayOrNa(row.txDescription, tags),
    ]);
  }

  private async ensureEnterprisesLoaded(): Promise<void> {
    const enterprises = this.enterpriseService.getEnterprises();
    if (Array.isArray(enterprises) && enterprises.length > 0) {
      return;
    }
    await this.enterpriseService.setup(this.dbService.getDatabase());
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
}
