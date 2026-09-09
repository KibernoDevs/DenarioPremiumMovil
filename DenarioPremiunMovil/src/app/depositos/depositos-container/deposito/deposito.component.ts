import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DepositService } from 'src/app/services/deposit/deposit.service';

@Component({
    selector: 'app-deposito',
    templateUrl: './deposito.component.html',
    styleUrls: ['./deposito.component.scss'],
    standalone: false
})
export class DepositoComponent implements OnInit, OnDestroy {

  public depositService = inject(DepositService);
  private cdr = inject(ChangeDetectorRef);

  public segment = 'default';
  private focusTabSub?: Subscription;

  constructor() { }

  ngOnInit() {
    this.focusTabSub = this.depositService.focusSendValidationTab.subscribe((tab) => {
      this.applySendValidationTabFocus(tab);
    });
  }

  ngOnDestroy() {
    this.focusTabSub?.unsubscribe();
  }

  /**
   * Salta a la pestaña del primer error tras fallo de Enviar (DEP-SEND-001).
   * Misma prioridad que getDepositValidationMessage / resolveSendValidationFocusTab.
   */
  private applySendValidationTabFocus(
    tab: 'default' | 'cobros' | 'total' | 'adjuntos',
  ): void {
    const generalOk = this.depositService.depositValid
      || this.depositService.generalTabValidForSave
      || this.depositService.isSelectedBank;

    // Sin General OK no se pueden abrir cobros/adjuntos (pestañas deshabilitadas).
    if ((tab === 'cobros' || tab === 'total' || tab === 'adjuntos') && !generalOk) {
      tab = 'default';
    }

    // Si General ya está OK, desbloquear pestañas para poder mostrar el error ahí.
    if (generalOk && !this.depositService.depositValid) {
      this.depositService.depositValid = true;
    }

    this.segment = tab;
    this.onChangeTab(tab === 'default' ? 'general' : tab);
    this.cdr.detectChanges();
  }

  shouldShowSendErrorHintOnTab(
    tab: 'default' | 'cobros' | 'total' | 'adjuntos',
  ): boolean {
    if (!this.depositService.sendValidationAttempted) {
      return false;
    }
    const focus = this.depositService.resolveSendValidationFocusTab();
    return focus != null && focus === tab;
  }

  onChangeTab(tab: string) {
    if (tab == "total") {
      this.depositService.tabTotal = true;
    } else {
      this.depositService.tabTotal = false;
    }
  }

}
