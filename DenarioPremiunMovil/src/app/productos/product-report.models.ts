export type ProductReportType = 'priceList' | 'catalog';

export type ProductReportFilterType = 'all' | 'category' | 'brand' | 'tag';

export type ProductReportSortField = 'code' | 'description';

export type ProductReportExportFormat = 'excel' | 'pdf';

export interface ProductReportOptions {
  reportType: ProductReportType;
  filterType: ProductReportFilterType;
  structureId: number | null;
  sortField: ProductReportSortField;
  exportFormat: ProductReportExportFormat;
  idEnterprise: number;
  enterpriseLabel: string;
  coEnterprise?: string;
}

export interface ProductReportRow {
  idProduct: number;
  coProduct: string;
  naProduct: string;
  txDescription: string;
  txPacking: string;
  naUnit: string;
  coUnit: string;
  nuPrice: number | null;
  coCurrency: string;
  quMinimum: number;
  quMultiple: number;
  bulkUnits: string;
  naProductStructure: string;
  imageSrc: string;
}
