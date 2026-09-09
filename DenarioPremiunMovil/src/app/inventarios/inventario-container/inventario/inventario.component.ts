import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';


@Component({
    selector: 'app-inventario',
    templateUrl: './inventario.component.html',
    styleUrls: ['./inventario.component.scss'],
    standalone: false
})
export class InventarioComponent implements OnInit, OnDestroy {

  public inventariosLogicService = inject(InventariosLogicService);

  public segment: string = 'default';
  public previousSegment: string = 'default';
  public stockValid: Boolean = false;
  private focusTabSub?: Subscription;
  private stockValidSub?: Subscription;

  constructor() { }

  ngOnInit() {
    if (this.inventariosLogicService.initInventario) {
      this.stockValidFunc();
    } else {
      this.stockValid = true;
      this.segment = "inventario";
    }

    this.focusTabSub = this.inventariosLogicService.focusSendValidationTab.subscribe((tab) => {
      this.applySendValidationTabFocus(tab);
    });
  }

  /** Salta a la pestaña del primer error tras fallo de Enviar/Guardar (INV-SEND-001). */
  private applySendValidationTabFocus(
    tab: 'default' | 'inventario' | 'actividades' | 'adjuntos',
  ): void {
    if (tab === 'inventario' && !this.inventariosLogicService.hideTab) {
      tab = 'actividades';
    }
    this.onChangeTab(tab);
  }

  shouldShowSendErrorHintOnTab(
    tab: 'default' | 'inventario' | 'actividades' | 'adjuntos',
  ): boolean {
    if (!this.inventariosLogicService.sendValidationAttempted) {
      return false;
    }
    const focus = this.inventariosLogicService.resolveSendValidationFocusTab();
    return focus != null && focus === tab;
  }

  onChangeTab(tab: string) {
    if (this.previousSegment === 'inventario' && tab !== 'inventario') {
      this.inventariosLogicService.showProductList = false;
    }
    this.previousSegment = this.segment;
    this.segment = tab;
  }

  stockValidFunc() {
    this.stockValidSub = this.inventariosLogicService.stockValid.subscribe((data: Boolean) => {
      this.stockValid = data;
    });
  }

  ngOnDestroy() {
    this.focusTabSub?.unsubscribe();
    this.stockValidSub?.unsubscribe();
  }

}
