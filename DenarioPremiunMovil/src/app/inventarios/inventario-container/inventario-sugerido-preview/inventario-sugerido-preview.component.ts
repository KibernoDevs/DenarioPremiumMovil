import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ProductSuggestedUtil } from 'src/app/modelos/ProductSuggestedUtil';
import { ClientStocksDetail } from 'src/app/modelos/tables/client-stocks';
import { CurrencyEnterprise } from 'src/app/modelos/tables/currencyEnterprise';
import { CurrencyModules } from 'src/app/modelos/tables/currencyModules';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

@Component({
  selector: 'app-inventario-sugerido-preview',
  templateUrl: './inventario-sugerido-preview.component.html',
  styleUrls: ['./inventario-sugerido-preview.component.scss'],
  standalone: false
})
export class InventarioSugeridoPreviewComponent implements OnInit {
  @Input() productsSuggested: ProductSuggestedUtil[] = [];
  @Input() clientStockDetails: ClientStocksDetail[] = [];
  @Input() inventarioTags: Map<string, string> = new Map<string, string>();
  @Input() diasDesdeUltimoInventario: number = 0;
  @Input() diasHastaSiguienteInventario: number = 0;
  @Input() empresaSeleccionada: Enterprise = {} as Enterprise;
  @Input() monedaLabel = 'Moneda';

  disableOrderButton = true;
  previewReady = false;

  currencyModulePed: CurrencyModules = new CurrencyModules(0, 0, true, true, true);
  monedaSeleccionadaPreview: CurrencyEnterprise | null = null;

  /** Etiquetas / binding template (local + opcional hard). */
  localCurrency!: CurrencyEnterprise;
  hardCurrency!: CurrencyEnterprise;

  private modalCtrl = inject(ModalController);
  private currencyService = inject(CurrencyService);
  private config = inject(GlobalConfigService);
  private dbServ = inject(SynchronizationDBService);

  quUnitDecimals = false;
  suggestedOrderByDispatchAndReturn = false;

  readonly compareCurrencyEnterprise = (
    a: CurrencyEnterprise | null,
    b: CurrencyEnterprise | null,
  ): boolean => !!(a && b ? a.idCurrency === b.idCurrency : a === b);

  get multimoneda(): boolean {
    return this.currencyService.multimoneda;
  }

  isCurrencySelectorDisabled(): boolean {
    if (!this.currencyService.multimoneda) {
      return true;
    }
    if (this.isCurrencyModuleEnabled()) {
      return !this.currencyModulePed.currencySelector;
    }
    const multiCurrencyOrder = this.config.get('multiCurrencyOrder').toLocaleLowerCase() === 'true';
    return !multiCurrencyOrder;
  }

  ngOnInit(): void {
    this.quUnitDecimals = this.config.get("quUnitDecimals").toLocaleLowerCase() === 'true';
    this.suggestedOrderByDispatchAndReturn = this.config
      .get("suggestedOrderByDispatchAndReturn")
      .toLocaleLowerCase() === 'true';

    this.disableOrderButton = this.computeDisableOrderButton();
    void this.initCurrencyUi();
  }

  getProductName(idProduct: number): string {
    return this.clientStockDetails.find(p => p.idProduct === idProduct)?.naProduct || '-';
  }

  getProductCode(idProduct: number): string {
    return this.clientStockDetails.find(p => p.idProduct === idProduct)?.coProduct || '-';
  }

  getUnitName(idProduct: number, idUnit: number): string {
    const detail = this.clientStockDetails.find(p => p.idProduct === idProduct);
    return detail?.clientStockDetailUnits.find(u => u.idUnit === idUnit)?.naUnit || '-';
  }

  formatNumber(value: number): string {
    if (value === null || value === undefined) {
      return '-';
    }
    let normalized = value;
    if (normalized < 0) {
      normalized = 0;
    }
    if (this.quUnitDecimals) {
      return this.currencyService.formatNumber(normalized);
    }
    return normalized.toString();
  }

  formatDecimal(value: number): string {
    return this.currencyService.formatNumber(value);
  }

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm(): void {
    const currency = this.monedaSeleccionadaPreview ?? undefined;
    this.modalCtrl.dismiss({ monedaSeleccionada: currency }, 'confirm');
  }

  private async initCurrencyUi(): Promise<void> {
    try {
      await this.currencyService.setup(this.dbServ.getDatabase());
      this.currencyModulePed = this.currencyService.getCurrencyModule('ped');
      this.localCurrency = this.currencyService.getLocalCurrency();
      this.hardCurrency = this.currencyService.getHardCurrency();
      this.monedaSeleccionadaPreview = this.resolveDefaultPedidosCurrency(this.empresaSeleccionada);
    } finally {
      this.previewReady = true;
    }
  }

  private computeDisableOrderButton(): boolean {
    for (const product of this.productsSuggested) {
      for (const unit of product.unitsSuggested) {
        if (unit.quUnitSuggested && unit.quUnitSuggested > 0) {
          return false;
        }
      }
    }
    return true;
  }

  private resolveDefaultPedidosCurrency(enterprise: Enterprise): CurrencyEnterprise | null {
    if (!enterprise?.idEnterprise) {
      return this.currencyService.getLocalCurrency();
    }
    if (!this.currencyService.multimoneda) {
      return this.currencyService.getLocalCurrency();
    }
    if (this.isCurrencyModuleEnabled() && this.currencyModulePed.idModule > 0) {
      return this.currencyModulePed.localCurrencyDefault
        ? this.currencyService.getLocalCurrency()
        : this.currencyService.getHardCurrency();
    }
    return this.currencyService.getCurrency(enterprise.coCurrencyDefault);
  }

  private isCurrencyModuleEnabled(): boolean {
    return this.config.get('currencyModule').toLocaleLowerCase() === 'true';
  }
}
