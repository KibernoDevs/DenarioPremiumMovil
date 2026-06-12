import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ProductUtil } from 'src/app/modelos/ProductUtil';
import { ReturnDetail } from 'src/app/modelos/tables/ReturnDetail';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { ReturnMotive } from 'src/app/modelos/tables/returnMotive';
import { Unit } from 'src/app/modelos/tables/unit';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ProductStructureService } from 'src/app/services/productStructures/product-structure.service';
import { ProductService } from 'src/app/services/products/product.service';
import { ReturnLogicService } from 'src/app/services/returns/return-logic.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

@Component({
  selector: 'devolucion-product-list',
  templateUrl: './devolucion-product-list.component.html',
  styleUrls: ['./devolucion-product-list.component.scss'],
  standalone: false
})
export class DevolucionProductListComponent implements OnInit, OnDestroy {



  productStructureService = inject(ProductStructureService);
  productService = inject(ProductService);
  returnLogic = inject(ReturnLogicService);
  messageService = inject(MessageService);
  services = inject(ServicesService);
  db = inject(SynchronizationDBService);
  dateServ = inject(DateServiceService);

  showReturnDetail: Boolean = true;
  tags = new Map<string, string>([]);
  productListSub: any;
  productListCartSub: any;
  productList: ReturnDetail[] = [];
  returnMotives: ReturnMotive[] = [];
  selectedDate: string = '';

  messageAlert!: MessageAlert;
  // estado cacheado para evitar emitir eventos redundantes
  private _lastValidState: boolean | null = null;
  // throttle para setChange
  private _lastSetChangeAt = 0;

  /*   newProductToReturn = new FormGroup({
      coDocument: new FormControl('', [Validators.required]),
      quProduct: new FormControl('', [Validators.required]),
    }); */

  constructor() { }

  ngOnInit() {
    this.selectedDate = this.dateServ.onlyDateHoyISO();
    /* this.newProductToReturn.markAllAsTouched(); */
    this.messageService.showLoading().then(() => {
      this.getTags();  //buscamos los tags
      this.productList = this.returnLogic.productList;
      this.returnMotives = this.returnLogic.returnMotives;
      this.productListSub = this.productStructureService.productStructures.subscribe((data) => {
        this.showReturnDetail = !data;
      });
    });


    this.productListCartSub = this.returnLogic.productListCart.subscribe((data) => {
      this.productList = data;
    });

    //console.log('Lista de devoluciones: ' + JSON.stringify(this.productList));
  }

  getTags() {
    this.tags = this.returnLogic.tags;
    this.messageService.hideLoading();
  }

  ngOnDestroy(): void {
    this.productListSub.unsubscribe();
  }

  removeProduct(index: number) {
    //console.log('Removi el item ' + index);
    this.returnLogic.removeProductDev(index);
    if (this.productList.length <= 0) {
      this.returnLogic.onReturnValidToSend(false);
    } else {
      this.onCoDocumentTextChanged();
    }
  }

  onOpenCalendar(index: number) {
    //console.log('MUTHEN');
    this.productList[index].daDueDate = '';
  }

  datePick(index: number) {
    //this.productList[index].daDueDate = this.selectedDate.substring(0, 10);
    console.log('daDueDate ' + this.productList[index].daDueDate);
  }

  dateFormat(date: string | null) {
    if (date != null) {
      return this.dateServ.formatShort(date);
    }
    return 'Seleccione Fecha';
  }

  onValidateUnitChanged(product: ReturnDetail, listIndex: number) {
    if (this.returnLogic.validateReturn) {
      let validateUnit = this.returnLogic.newReturn.invoicedetailUnits.find((inv) => inv.idProductUnit === product.unit?.idProductUnit);
      if (product.quProduct < 1 || product.quProduct > validateUnit!.quUnit) {
        console.log("ValidateReturn - Aqui debo mostrar el alrt indicando unidad invalida");
        this.messageAlert = new MessageAlert(
          this.tags.get('DENARIO_DEV')!,
          this.tags.get('DEV_INVALID_QU_UNIT')! + ' ' + validateUnit!.quUnit,
        );
        this.messageService.alertModal(this.messageAlert);
        this.returnLogic.onReturnValidToSend(false);
      } else {
        this.onCoDocumentTextChanged();
      }
    } else {
      this.onCoDocumentTextChanged();
    }
  }

  onCoDocumentTextChanged() {
    let bandera = false
    if (!this.returnLogic.requeridedNroFactura && !this.returnLogic.validateReturn) {
      bandera = true;
    }
    for (let index = 0; index < this.productList.length; index++) {
      const element = this.productList[index];
      if (bandera) {
        if (element.coDocument!.trim() === '')
          element.coDocument = "0";
      }

      if (!element.coDocument || !element.quProduct) {
        this.returnLogic.onReturnValidToSend(false);
        break;
      } else {
        if (index === this.productList.length - 1) {
          this.returnLogic.onReturnValidToSend(true);
        }
      }
    }
  }


  changeProductUnit(index: number, idUnit: number) {
    this.productList[index].unit = this.productList[index].productUnits.find(pu => pu.idUnit == idUnit);
    this.returnLogic.setChange(true, true);
  }

  setShowDateModal(i: number, val: boolean) {
    this.productList[i].showDateModal = val;
  }

  formatShort(date: string | null) {
    if (date != null) {
      return this.dateServ.formatShort(date);
    }
    return this.tags.get('DENARIO_DEV_DATE');
  }

  updateSendButtonState(): void {
    const requerid = this.returnLogic.requeridedNroFactura === true;
    const list = Array.isArray(this.productList) ? this.productList : [];

    // validación: si requeridedNroFactura==true => coDocument + quProduct obligatorios
    // si requeridedNroFactura==false => solo quProduct obligatorio
    const valid = list.length > 0 && list.every(item => {
      const qty = Number(item?.quProduct);
      const qtyValid = !isNaN(qty) && qty > 0;

      if (requerid) {
        const co = (item?.coDocument ?? '').toString().trim();
        return co.length > 0 && qtyValid;
      } else {
        return qtyValid;
      }
    });

    // Emitir solo si cambió el estado (evita trabajo innecesario en listeners)
    if (this._lastValidState !== valid) {
      this.returnLogic.onReturnValidToSend(valid);
      this._lastValidState = valid;
    }

    // Llamada a setChange throttled para evitar ráfagas si se dispara muy seguido
    const now = Date.now();
    if (now - this._lastSetChangeAt > 200) { // umbral 200ms (ajustable)
      this.returnLogic.setChange(true, true);
      this._lastSetChangeAt = now;
    }
  }

  cleanString(str: string): string {
    // Elimina ;
    str = str.replace(/;/g, '');
    // Elimina comillas simples
    str = str.replace(/'/g, '');
    // Elimina comillas dobles
    str = str.replace(/"/g, '');


    return str;
  }

  cleanInput(input: string | null | undefined | number): string {
    this.updateSendButtonState()
    if (!input) {
      return '';
    }
    return this.cleanString(input.toString());
  }

}
