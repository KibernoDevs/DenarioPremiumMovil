import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ProductSuggestedUtil } from 'src/app/modelos/ProductSuggestedUtil';
import { ClientStocksDetail } from 'src/app/modelos/tables/client-stocks';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';

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

  disableOrderButton = true;
  private modalCtrl = inject(ModalController);
  private currencyService = inject(CurrencyService);
  private config = inject(GlobalConfigService);

  quUnitDecimals = false;
  suggestedOrderByDispatchAndReturn = false;

  constructor() {}

  ngOnInit() {
    this.quUnitDecimals = this.config.get("quUnitDecimals").toLocaleLowerCase() === 'true';
    this.suggestedOrderByDispatchAndReturn = this.config.get("suggestedOrderByDispatchAndReturn").toLocaleLowerCase() === 'true';
    for(let product of this.productsSuggested) {
      for(let unit of product.unitsSuggested) {
        if(unit.quUnitSuggested && unit.quUnitSuggested > 0) {
          this.disableOrderButton = false;
          break;
        }
      }
      if(!this.disableOrderButton) {
        break;
      }
    }
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

  formatNumber(value: number) {
    if(value === null || value === undefined) {
      return '-';
    }
    if(value < 0) {
      value = 0;
    }
    if(this.quUnitDecimals) {
    return this.currencyService.formatNumber(value);
    } else {
      return value.toString();
    }
  }

  formatDecimal(value: number) {
    return this.currencyService.formatNumber(value);
  }

  close(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm(): void {
    this.modalCtrl.dismiss(null, 'confirm');
  }
}