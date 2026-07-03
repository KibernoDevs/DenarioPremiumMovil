import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { ProductStructure } from 'src/app/modelos/tables/productStructure';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ProductReportsService } from 'src/app/services/products/product-reports.service';
import {
  ProductReportExportFormat,
  ProductReportFilterType,
  ProductReportOptions,
  ProductReportSortField,
  ProductReportType,
} from '../product-report.models';

@Component({
  selector: 'productos-reports',
  templateUrl: './productos-reports.component.html',
  styleUrls: ['./productos-reports.component.scss'],
  standalone: false,
})
export class ProductosReportsComponent implements OnInit {
  @Input() empresaSeleccionada!: Enterprise;
  @Input() productTags = new Map<string, string>();
  @Output() backClicked = new EventEmitter<void>();

  private readonly reportsService = inject(ProductReportsService);
  private readonly messageService = inject(MessageService);

  reportType: ProductReportType = 'priceList';
  filterType: ProductReportFilterType = 'all';
  sortField: ProductReportSortField = 'description';
  structureId: number | null = null;
  filterStructures: ProductStructure[] = [];
  isGenerating = false;

  readonly reportTypes: Array<{ value: ProductReportType; label: string }> = [
    { value: 'priceList', label: 'Lista de precios' },
    { value: 'catalog', label: 'Catalogo de productos' },
  ];

  readonly filterTypes: Array<{ value: ProductReportFilterType; label: string }> = [
    { value: 'all', label: 'Todos los productos' },
    { value: 'category', label: 'Categoria' },
    { value: 'brand', label: 'Marca' },
    { value: 'tag', label: 'Etiqueta' },
  ];

  readonly sortFields: Array<{ value: ProductReportSortField; label: string }> = [
    { value: 'code', label: 'Codigo' },
    { value: 'description', label: 'Descripcion' },
  ];

  ngOnInit(): void {
    void this.reloadFilterStructures();
  }

  async onFilterTypeChanged(): Promise<void> {
    this.structureId = null;
    await this.reloadFilterStructures();
  }

  async reloadFilterStructures(): Promise<void> {
    if (!this.empresaSeleccionada?.idEnterprise || this.filterType === 'all') {
      this.filterStructures = [];
      this.structureId = null;
      return;
    }

    this.filterStructures = await this.reportsService.loadFilterStructures(
      this.empresaSeleccionada.idEnterprise,
      this.filterType,
    );
  }

  canGenerateExcel(): boolean {
    return this.reportType === 'priceList';
  }

  async generateReport(exportFormat: ProductReportExportFormat): Promise<void> {
    if (!this.empresaSeleccionada?.idEnterprise || this.isGenerating) {
      return;
    }

    if (this.filterType !== 'all' && !this.structureId) {
      await this.messageService.transaccionMsjModalNB('Seleccione un valor para el filtro elegido.');
      return;
    }

    const options = this.buildReportOptions(exportFormat);
    this.isGenerating = true;

    try {
      await this.messageService.showLoading();
      await this.reportsService.generateAndShareReport(options);
    } catch (error) {
      console.error('[ProductosReportsComponent] Error generating report', error);
      await this.messageService.transaccionMsjModalNB('No se pudo generar el reporte. Intente nuevamente.');
    } finally {
      this.isGenerating = false;
      await this.messageService.hideLoading();
    }
  }

  onBack(): void {
    this.backClicked.emit();
  }

  private buildReportOptions(exportFormat: ProductReportExportFormat): ProductReportOptions {
    return {
      reportType: this.reportType,
      filterType: this.filterType,
      structureId: this.structureId,
      sortField: this.sortField,
      exportFormat,
      idEnterprise: this.empresaSeleccionada.idEnterprise,
      enterpriseLabel: this.empresaSeleccionada.lbEnterprise,
    };
  }
}
