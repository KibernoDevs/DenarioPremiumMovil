import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { ClientShareModalComponent } from '../client-share-modal/client-share-modal.component';
import { SynchronizationDBService } from '../../../services/synchronization/synchronization-db.service';
import { Client } from '../../../modelos/tables/client';
import { ClientesDatabaseServicesService } from '../../../services/clientes/clientes-database-services.service';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';
import { SelectedClient } from 'src/app/modelos/selectedClient';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { Coordinate } from 'src/app/modelos/coordinate';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { AddresClient } from 'src/app/modelos/tables/addresClient';

type ClientWithBalanceAlias = Client & { saldo?: number };

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss'],
  standalone: false
})
export class ClienteComponent implements OnInit {

  private globalConfig = inject(GlobalConfigService);
  public clientLogic = inject(ClientLogicService);
  public currencyService = inject(CurrencyService);

  public params!: any;
  public document!: DocumentSale[];
  public client!: Client;
  public sub!: object;
  public idCliente!: number;
  public multiCurrency!: Boolean;
  public tagRif: string = "";
  public nuCreditLimitConversion: string = "";
  public availableCreditConversion: string = "";
  public localCurrency = '';
  public hardCurrency = '';
  public decimales = 2;
  public selectedAddress!: AddresClient;
  public saldoLocal: number = 0;
  public saldoFuerte: number = 0;

  subjectClientShareModalOpen: any;
  // selección múltiple de documentos
  public selectedDocuments: string[] = [];

  // control de modales
  public clientShareModalOpen = false;
  public clientSelectShareModalOpen = false;


  @Input() showHeader: boolean = false;

  constructor() {
    this.clientLogic.initService();
  }

  ngOnInit() {
    //console.log(this.clientDetail);
    this.client = this.clientLogic.datos.client;

    this.client.txDescription1 = this.sanitizeDescription(this.client.txDescription1);
    this.client.txDescription2 = this.sanitizeDescription(this.client.txDescription2);


    this.selectedAddress = this.clientLogic.listaDirecciones.find(address => address.idAddress === this.client.idAddressClients)!;

    this.localCurrency = this.currencyService.localCurrency.coCurrency;
    if (this.clientLogic.multiCurrency) {
      this.hardCurrency = this.currencyService.hardCurrency.coCurrency;
    }
    this.decimales = this.currencyService.precision;

    this.initializeClientBalances();

    if (this.clientLogic.multiCurrency && this.currencyService.multimoneda) {
      if (this.client.coCurrency === this.clientLogic.localCurrency.coCurrency) {
        this.nuCreditLimitConversion = this.formatNumber(this.currencyService.toHardCurrency(this.client.nuCreditLimit));
        this.availableCreditConversion = this.formatNumber(this.currencyService.toHardCurrency(this.getAvailableCredit()));
      } else {
        this.nuCreditLimitConversion = this.formatNumber(this.currencyService.toLocalCurrency(this.client.nuCreditLimit));
        this.availableCreditConversion = this.formatNumber(this.currencyService.toLocalCurrency(this.getAvailableCredit()));
      }
    }


    this.document = this.clientLogic.datos.document;

    this.tagRif = this.globalConfig.get("tagRif")!;

    this.subjectClientShareModalOpen = this.clientLogic.closeClientShareModal.subscribe((open: Boolean) => {
      this.clientShareModalOpen = false;
    });

    this.getColorRowDocumentSale();

  }

  ngOnDestroy() {
    this.subjectClientShareModalOpen.unsubscribe();
  }

  private sanitizeDescription(value: any): string {
    if (value == null || value === undefined) return '';
    const s = String(value).trim();
    if (s === '' || s.toLowerCase() === 'null') return '';
    return s;
  }

  private initializeClientBalances(): void {
    const saldo1 = this.getClientSaldo1();
    const saldo2 = this.getClientSaldo2();

    this.saldoLocal = saldo1;
    this.saldoFuerte = saldo2;

    if (!this.clientLogic.multiCurrency || !this.currencyService.multimoneda) {
      return;
    }

    this.saldoLocal = saldo1 + this.currencyService.toLocalCurrency(saldo2);
    this.saldoFuerte = this.currencyService.toHardCurrency(this.saldoLocal);
  }

  private getClientSaldo1(): number {
    const client = this.client as ClientWithBalanceAlias;
    return Number(client?.saldo1 ?? client?.saldo ?? 0);
  }

  private getClientSaldo2(): number {
    return Number(this.client?.saldo2 ?? 0);
  }

  openDoc(idDocumento: number, index: number) {
    console.log(idDocumento, index);
    console.log(this.document[index]);
    this.clientLogic.documentSaleSelect = {} as DocumentSale;
    this.clientLogic.documentSaleSelect = this.document[index];
    this.clientLogic.clientDetailComponent = false;
    this.clientLogic.clientDocumentSaleComponent = true;
    this.clientLogic.opendDocClick = true;
  }

  viewCoordenada(verCrear: Boolean, client: Client, module: string) {
    if (verCrear)
      console.log("ver mapa");
    else
      console.log("crear ubicacion");
    this.clientLogic.viewCoordenada(client, module);
  }

  hayCoordenada(coord: string) {
    if (coord == null || coord.trim() === "" ||
      coord.toLowerCase().trim() === "null" || coord.trim() == "0,0") {
      return false;
    }
    return true;
  }

  //funcion que devuelve la coordenada si existe
  getCoordenada(coord: string) {
    if (this.hayCoordenada(coord)) {
      return coord;
    }
    return "";
  }

  //Hacer estas conversiones en el servicio de moneda
  //tomaria muchos queries a la bd, lo hacemos aca mejor.
  toLocalCurrency(hardAmount: number, doc: DocumentSale): string {
    if (doc.coCurrency == this.localCurrency) {
      //si la moneda es la misma, no se convierte
      return this.formatNumber(hardAmount);
    }
    return this.formatNumber(((hardAmount * doc.nuValueLocal) / this.currencyService.currencyRelation));
  }

  toHardCurrency(localAmount: number, doc: DocumentSale): string {
    if (doc.coCurrency == this.hardCurrency) {
      return this.formatNumber(localAmount);
    }
    return this.formatNumber(((localAmount * this.currencyService.currencyRelation) / doc.nuValueLocal));
  }

  formatNumber(num: number) {
    return this.currencyService.formatNumber(num);
  }

  getAvailableCredit(): number {
    return Number(this.client?.nuCreditLimit ?? 0) - (this.getClientSaldo1() + this.getClientSaldo2());
  }

  getDaDueDate(daDueDate: string) {
    if (!daDueDate) return 0;

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

    if (!dueDate) return 0;

    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    const diffDays = Math.floor((todayOnly.getTime() - dueDateOnly.getTime()) / 86400000);
    return Math.abs(diffDays);
  }

  oppositeCoCurrency(coCurrency: string) {
    return this.currencyService.oppositeCoCurrency(coCurrency);
  }

  public toggleDocumentSelection(coDocument: string, event?: any): void {
    const checked = event?.detail?.checked ?? !!event?.target?.checked;
    if (!Array.isArray(this.selectedDocuments)) this.selectedDocuments = [];
    const idx = this.selectedDocuments.indexOf(coDocument);
    if (checked) {
      if (idx === -1) this.selectedDocuments.push(coDocument);
    } else {
      if (idx !== -1) this.selectedDocuments.splice(idx, 1);
    }
  }

  public selectAllDocuments(): void {
    this.selectedDocuments = Array.isArray(this.clientLogic.datos?.document)
      ? this.clientLogic.datos.document.map(d => d.coDocument)
      : [];
  }

  public openSelectShareModal(open: boolean): void {
    this.clientSelectShareModalOpen = !!open;
  }

  public openShareModal(open: boolean): void {
    // Obtener lista de documentos actuales
    const docs: DocumentSale[] = Array.isArray(this.clientLogic.datos?.document)
      ? this.clientLogic.datos.document
      : [];

    // Asegurar array destino
    if (!Array.isArray(this.clientLogic.documentsSaleSelectShared)) {
      this.clientLogic.documentsSaleSelectShared = [];
    }

    // Mapear selectedDocuments (coDocument strings) a objetos DocumentSale y asignar sin duplicados
    const selectedDocs = this.selectedDocuments
      .map(co => docs.find(d => d.coDocument === co))
      .filter((d): d is DocumentSale => !!d);

    // Reemplazamos la colección compartida por los objetos seleccionados (sin duplicados)
    this.clientLogic.documentsSaleSelectShared = selectedDocs;

    // Abrir/cerrar modal
    this.clientShareModalOpen = !!open;
  }

  onChangeAddress($event: any) {
    //cargamos la data de la direccion al cliente para usarla luego en modal de direcciones.
    //his.selectedAddress = $event.detail.value;
    this.client.txAddress = this.selectedAddress.txAddress;
    this.client.idAddressClients = this.selectedAddress.idAddress;
    this.client.coAddressClients = this.selectedAddress.coAddress;
    this.client.coordenada = this.selectedAddress.coordenada;
    this.client.editable = this.selectedAddress.editable;

    //console.log(this.client.coordenada);
  }

  addressCompare(o1: AddresClient, o2: AddresClient): boolean {
    return o1 && o2 ? o1.idAddress === o2.idAddress : o1 === o2;
  }

  showDocVentasTab() {
    if (this.clientLogic.esTransportista) {
      return false;
    }
    /*
    if (this.clientLogic.fromSelector){
      return false;
    }
      */
    return true;
  }

  convertirMonto(monto: number, rate: number, currency: string) {

    if (currency == this.localCurrency) {
      return this.currencyService.formatNumber(this.cleanFormattedNumber(this.currencyService.formatNumber(monto / rate)));
    } else {
      return this.currencyService.formatNumber(this.cleanFormattedNumber(this.currencyService.formatNumber(monto * rate)));
    }
  }

  public cleanFormattedNumber(str: string): number {
    // Elimina espacios
    str = str.trim();
    // Elimina separador de miles (puntos)
    str = str.replace(/\./g, '');
    // Cambia la coma decimal por punto
    str = str.replace(/,/g, '.');
    // Convierte a número
    return Number(str);
  }

  getColorRowDocumentSale() {
    try {
      if (!Array.isArray(this.document)) return;

      for (let i = 0; i < this.document.length; i++) {
        const doc = this.document[i];
        if (!doc) continue;

        const currentColor = String(doc.colorRow ?? '').trim().toLowerCase();

        // Si ya está en rojo, no se vuelve a modificar.
        if (currentColor === 'red') {
          doc.colorRow = 'Red';
          this.document[i].colorRow = 'Red';
          continue;
        }

        const docNuBalance = Number(doc.nuBalance ?? 0);
        if (docNuBalance <= 0) {
          doc.colorRow = 'black';
        } else {
          const dueSoon = this.clientLogic.isDueSoon(doc.daDueDate);
          doc.colorRow = dueSoon ? 'Red' : 'Blue';
        }

        // Asegura que el array fuente refleje el color calculado.
        this.document[i].colorRow = doc.colorRow;


        // Mantener mapa actualizado (si existe entrada por idDocument)
        /*  if (doc.idDocument != null && this.mapDocumentsSales && this.mapDocumentsSales.has(doc.idDocument)) {
           const mapped = this.mapDocumentsSales.get(doc.idDocument)!;
           mapped.colorRow = doc.colorRow;
           this.mapDocumentsSales.set(doc.idDocument, mapped);
         } */
      }
    } catch (err) {
      console.warn('[CollectionService] getColorRowDocumentSale error:', err);
    }
  }
}
