import { Component, EventEmitter, OnInit, Output, ViewChild, inject } from '@angular/core';
import { IonModal } from '@ionic/angular';
import { Invoice } from 'src/app/modelos/tables/invoice';
import { ReturnLogicService } from 'src/app/services/returns/return-logic.service';

@Component({
  selector: 'invoice-selector',
  templateUrl: './invoice-selector.component.html',
  styleUrls: ['./invoice-selector.component.scss'],
  standalone: false
})
export class InvoiceSelectorComponent implements OnInit {

  returnLogic = inject(ReturnLogicService);

  public isModalOpen: boolean = false;
  public searchText: string = '';
  public colorModulo: string = 'fondoAmarillo';
  public nombreModulo: string = 'Devoluciones';

  btnAceptar: string = '';
  btnCancelar: string = '';
  headerConfirm: string = '';
  mensajeInvoiceChange: string = '';
  public invoiceChangeOpen: boolean = false;

  invoiceACambiar: Invoice | null = null;

  @ViewChild(IonModal) modal!: IonModal;

  @Output() invoiceSeleccionado: EventEmitter<Invoice> = new EventEmitter<Invoice>();

  public buttonsInvoiceChange = [
    {
      text: 'Aceptar',
      role: 'confirm',
    },
    {
      text: 'Cancelar',
      role: 'cancel',
    }
  ];

  constructor() { }

  ngOnInit() {
    this.btnAceptar = this.returnLogic.tags.get("DENARIO_BOTON_ACEPTAR") || "";
    this.btnCancelar = this.returnLogic.tags.get("DENARIO_BOTON_CANCELAR") || "";
    this.headerConfirm = this.returnLogic.tags.get("DEV_HEADER_ALERTA") || "";
    this.mensajeInvoiceChange = this.returnLogic.tags.get("DEV_RESET_CONFIRMA") || "";
    this.buttonsInvoiceChange = [
      {
        text: this.btnAceptar,
        role: 'confirm',
      },
      {
        text: this.btnCancelar,
        role: 'cancel',
      }
    ];
  }

  selectInvoice(input: Invoice) {
    const currentInvoiceId = this.returnLogic.newReturn.idInvoice;
    if (currentInvoiceId && currentInvoiceId !== input.idInvoice) {
      // Guarda la factura pendiente y pide confirmación.
      this.invoiceACambiar = input;
      this.invoiceChangeOpen = true;
      return;
    }

    this.assignInvoice(input);
  }

  assignInvoice(input: Invoice): void {
    const selectedInvoice = this.returnLogic.invoices.find(inv => inv.idInvoice === input.idInvoice) ?? input;
    this.returnLogic.newReturn.coInvoice = selectedInvoice.coInvoice;
    this.returnLogic.newReturn.idInvoice = selectedInvoice.idInvoice;
    this.returnLogic.findInvoiceDetailUnits().then();
    this.returnLogic.onReturnValid(true);
    this.returnLogic.setChange(true, true);
    this.invoiceSeleccionado.emit(selectedInvoice);
    this.closeModal();
  }

  onInvoiceChangeDismiss(event: CustomEvent): void {
    this.invoiceChangeOpen = false;
    const pendingInvoice = this.invoiceACambiar;
    this.invoiceACambiar = null;

    if (!pendingInvoice) {
      return;
    }

    // Solo Cancelar mantiene la factura actual.
    if (event.detail?.role === 'cancel') {
      return;
    }

    // Aceptar, backdrop u otro cierre fuera de Cancelar: aplica el cambio.
    this.returnLogic.invoiceChanged.next(pendingInvoice);
    this.closeModal();
  }

  closeModal() {
    this.invoiceChangeOpen = false;
    this.invoiceACambiar = null;
    this.modal.dismiss(null, 'cancel');
  }

  handleInput(event: any) {
    this.searchText = event.target.value.toLowerCase();
  }

}
