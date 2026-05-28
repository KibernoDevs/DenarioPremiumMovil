import { Input, inject, AfterViewInit } from '@angular/core';
import { Component, OnInit } from '@angular/core';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { Collection, CollectionDetail, CollectionPayment } from 'src/app/modelos/tables/collection';
import { PagoEfectivo } from 'src/app/modelos/pago-efectivo';
import { PagoCheque } from 'src/app/modelos/pago-cheque';
import { PagoDeposito } from 'src/app/modelos/pago-deposito';
import { PagoTransferencia } from 'src/app/modelos/pago-transferencia';
import { PagoOtros } from 'src/app/modelos/pago-otros';
import { PagoMovil } from 'src/app/modelos/pago-movil';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { DifferenceCode } from 'src/app/modelos/tables/differenceCode';

@Component({
  selector: 'app-cobro-pagos',
  templateUrl: './cobro-pagos.component.html',
  styleUrls: ['./cobro-pagos.component.scss'],
  standalone: false
})
export class CobroPagosComponent implements OnInit {

  /**
   * Flag para mostrar el mensaje de automated prepaid solo una vez por ciclo de true.
   * Se resetea cuando createAutomatedPrepaid pasa a false.
   */
  private hasShownAutomatedPrepaidMsg = false;

  public collectService = inject(CollectionService);
  public globalConfig = inject(GlobalConfigService);
  public currencyService = inject(CurrencyService)
  public dateServ = inject(DateServiceService);

  public collectionPayment!: CollectionPayment;

  public alertMessageOpen: Boolean = false;
  public showEventModal: Boolean = false;
  public listBankAccount!: any;

  private centsMap: { [uid: string]: number } = {};
  private displayMap: { [uid: string]: string } = {};
  private __uidCounter = 0;
  private debounceTimers: { [uid: string]: any } = {};
  private debounceDelay = 2000;
  private ignoreInputMap: { [uid: string]: boolean } = {};


  public alertButtons = [
    /*  {
       text: '',
       role: 'cancel'
     }, */
    {
      text: '',
      role: 'confirm'
    },
  ];

  constructor() {
    console.log('[CobroPagos] constructor start');
    console.time('[CobroPagos] constructor');
    if (isNaN(this.collectService.montoTotalPagar))
      this.collectService.montoTotalPagar = 0;
    console.timeEnd('[CobroPagos] constructor');
  }

  ngOnInit() {
    this.alertButtons[0].text = this.collectService.collectionTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
  }

  ngAfterViewInit(): void {
    // Medición simple: tiempo desde creación del componente hasta template montado
    try {
      console.time('[CobroPagos] afterViewInit');
      // end immediately to print time (this measures sync work up to this hook)
      console.timeEnd('[CobroPagos] afterViewInit');
      console.log('[CobroPagos] montoTotalPagar=', this.collectService.montoTotalPagar, 'items ef=', this.collectService.pagoEfectivo.length);
    } catch (e) {
      console.warn('[CobroPagos] afterViewInit warn', e);
    }
  }

  // trackBy para evitar recrear nodos DOM innecesarios
  trackByIndex(index: number, item: any) {
    if (!item) return index;
    return item.id ?? item.coCollection ?? item.__amountUid ?? index;
  }

  addTipoPago(type: string) {
    this.collectService.lengthMethodPaid++;
    this.collectService.collection.collectionPayments[this.collectService.collection.collectionPayments.length] = new CollectionPayment;
    this.collectService.collection.collectionPayments[this.collectService.collection.collectionPayments.length - 1].coCollection = this.collectService.collection.coCollection;
    this.collectService.tiposPago.forEach(tp => tp.selected = false);


    // Normalize dateRate: if it's in 'YYYY-MM-DD' form, append ' 00:00:00'.
    // If it's already 'YYYY-MM-DD HH:MM:SS' keep as-is.
    const rawDateRate = (this.collectService.dateRate || '').toString().trim();
    let daRate = rawDateRate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDateRate)) {
      daRate = rawDateRate + ' 00:00:00';
    } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(rawDateRate)) {
      // already has time, keep as-is
      daRate = rawDateRate;
    } else {
      // fallback: leave as raw value (could be empty or different format)
      daRate = rawDateRate;
    }

    this.collectService.onCollectionValidToSend(false)
    // Nuevo: referencia al pago creado (se asigna dentro del switch)
    let newPago: any = null;

    switch (type) {
      case "ef": {
        let newPagoEfectivo: PagoEfectivo = new PagoEfectivo;
        newPagoEfectivo.posCollectionPayment = this.collectService.collection.collectionPayments!.length - 1;
        if (this.collectService.validateCollectionDate) {
          // use normalized daRate (may already include time)
          newPagoEfectivo.fecha = daRate;
        } else {
          newPagoEfectivo.fecha = this.dateServ.hoyISO();
        }

        this.collectService.pagoEfectivo.push(newPagoEfectivo);
        newPago = newPagoEfectivo;
        break
      }

      case "ch": {
        let newPagoCheque: PagoCheque = new PagoCheque;
        newPagoCheque.posCollectionPayment = this.collectService.collection.collectionPayments!.length - 1;
        if (this.collectService.validateCollectionDate) {
          // use normalized daRate (may already include time)
          newPagoCheque.fecha = daRate;
          newPagoCheque.fechaValor = daRate;
        } else {
          newPagoCheque.fecha = this.dateServ.hoyISO();
          newPagoCheque.fechaValor = this.dateServ.hoyISO();
        }
        this.collectService.pagoCheque.push(newPagoCheque);
        newPago = newPagoCheque;
        break;
      }

      case "de": {
        let newPagoDeposito: PagoDeposito = new PagoDeposito;
        newPagoDeposito.posCollectionPayment = this.collectService.collection.collectionPayments!.length - 1;
        if (this.collectService.validateCollectionDate) {
          newPagoDeposito.fecha = daRate;
        } else {
          newPagoDeposito.fecha = this.dateServ.hoyISO();
        }
        this.collectService.pagoDeposito.push(newPagoDeposito);
        newPago = newPagoDeposito;
        break
      }

      case "tr": {
        let newPagoTransferencia: PagoTransferencia = new PagoTransferencia;
        newPagoTransferencia.posCollectionPayment = this.collectService.collection.collectionPayments!.length - 1;
        if (this.collectService.validateCollectionDate) {
          newPagoTransferencia.fecha = daRate;
        } else {
          newPagoTransferencia.fecha = this.dateServ.hoyISO();
        }
        this.collectService.pagoTransferencia.push(newPagoTransferencia);
        newPago = newPagoTransferencia;
        break;
      }

      case "pm": {
        let newPagoMovil: PagoMovil = new PagoMovil;
        newPagoMovil.posCollectionPayment = this.collectService.collection.collectionPayments!.length - 1;
        if (this.collectService.typeDocumentList.length > 0) {
          newPagoMovil.tipoDocumento = this.collectService.typeDocumentList[0].coTypeDocument as any;
        }
        if (this.collectService.codePhoneNumberList.length > 0) {
          newPagoMovil.codigoTelefono = this.collectService.codePhoneNumberList[0].coCodePhoneNumber as any;
        }
        if (this.collectService.validateCollectionDate) {
          newPagoMovil.fecha = daRate;
        } else {
          newPagoMovil.fecha = this.dateServ.hoyISO();
        }
        this.collectService.pagoMovil.push(newPagoMovil);
        this.syncPagoMovilDocumento(this.collectService.pagoMovil.length - 1);
        this.syncPagoMovilTelefono(this.collectService.pagoMovil.length - 1);
        newPago = newPagoMovil;
        break;
      }

      case "ot": {
        // PagoOtros requires constructor args; bypass strict constructor signature by casting to any
        let newPagoOtros: PagoOtros = new (PagoOtros as any)();
        newPagoOtros.posCollectionPayment = this.collectService.collection.collectionPayments!.length - 1;
        if (this.collectService.validateCollectionDate) {
          // use normalized daRate (may already include time)
          newPagoOtros.fecha = daRate;
        } else {
          newPagoOtros.fecha = this.dateServ.hoyISO();
        }
        this.collectService.pagoOtros.push(newPagoOtros);
        newPago = newPagoOtros;
        break;
      }
    }

    const cpIndex = this.collectService.collection.collectionPayments.length - 1;
    const cp = this.collectService.collection.collectionPayments[cpIndex] as any;

    if (newPago) {
      // genera/asegura uid en el objeto pago y recupera uid (usa getUid o ensureInitFor)
      const uid = this.getUid(newPago);
      // asigna mismo uid al collectionPayment (cp)
      try {
        if (!(cp as any).__amountUid) {
          Object.defineProperty(cp, '__amountUid', { value: uid, enumerable: false, configurable: true, writable: false });
        }
      } catch {
        (cp as any).__amountUid = uid;
      }
      // inicializa mapas inmediatamente (puedes usar ensureInitFor en vez de estas líneas)
      this.centsMap[uid] = Math.round((newPago.monto ?? 0) * this.getMultiplier());
      this.displayMap[uid] = this.formatFromMinorUnits(this.centsMap[uid]);
    }
  }

  deleteTipoPago(index: number, type: string) {
    this.collectService.messageSended = false;
    if (this.collectService.disabledSelectCollectMethodDisabled)
      this.collectService.disabledSelectCollectMethodDisabled = false;

    this.collectService.lengthMethodPaid--;
    this.collectService.anticipoAutomatico = [];
    this.collectService.createAutomatedPrepaid = false;

    // Diccionario para mapear tipo a arrays y propiedades
    type TipoPagoKey = 'ef' | 'ch' | 'de' | 'tr' | 'pm' | 'ot';
    const map: Record<TipoPagoKey, any[]> = {
      ef: this.collectService.pagoEfectivo,
      ch: this.collectService.pagoCheque,
      de: this.collectService.pagoDeposito,
      tr: this.collectService.pagoTransferencia,
      pm: this.collectService.pagoMovil,
      ot: this.collectService.pagoOtros,
    };

    if (!['ef', 'ch', 'de', 'tr', 'pm', 'ot'].includes(type)) return;
    const pagoArray = map[type as TipoPagoKey];
    if (!pagoArray) return;
    if (!pagoArray[index]) return;

    // Capturar el pago y su posición en collectionPayments ANTES de borrar
    const removedPago = pagoArray[index];
    const removedPos = removedPago.posCollectionPayment ?? index;

    // Capturar uid del collectionPayment que vamos a eliminar (antes de hacer splice)
    const removedCp = (this.collectService.collection.collectionPayments && this.collectService.collection.collectionPayments[removedPos]) as any | undefined;
    const removedCpUid = removedCp?.__amountUid;

    // Eliminar collectionPayment y bankAccountSelected en la posición correcta
    if (this.collectService.collection.collectionPayments && this.collectService.collection.collectionPayments.length > removedPos) {
      this.collectService.collection.collectionPayments!.splice(removedPos, 1);
    }
    if (this.collectService.bankAccountSelected && this.collectService.bankAccountSelected.length > removedPos) {
      this.collectService.bankAccountSelected.splice(removedPos, 1);
    }

    // Remover el pago del arreglo correspondiente
    pagoArray.splice(index, 1);

    // Reducir posCollectionPayment en 1 para TODOS los pagos cuya posCollectionPayment era mayor al eliminado
    const allPagoArrays = [
      this.collectService.pagoEfectivo,
      this.collectService.pagoCheque,
      this.collectService.pagoDeposito,
      this.collectService.pagoTransferencia,
      this.collectService.pagoMovil,
      this.collectService.pagoOtros
    ];

    allPagoArrays.forEach(arr => {
      if (Array.isArray(arr)) {
        arr.forEach(p => {
          if (p && typeof p.posCollectionPayment === 'number' && p.posCollectionPayment > removedPos) {
            p.posCollectionPayment = p.posCollectionPayment - 1;
          }
        });
      }
    });

    // Borrar mapas asociados al collectionPayment eliminado (si existían)
    if (removedCpUid) {
      delete this.centsMap[removedCpUid];
      delete this.displayMap[removedCpUid];
    }

    // Recalcular totales con la lógica central (calcularMontos -> calculatePayment)
    this.collectService.calcularMontos('', 0).then(() => {
      this.collectService.validateToSend();
      if (!this.collectService.collection.collectionPayments || this.collectService.collection.collectionPayments.length === 0) {
        this.collectService.onCollectionValidToSend(false);
      }
    });
  }

  getFecha(fecha: string, index: number, type: string) {

    switch (type) {
      case "ef": {
        break
      }

      case "ch": {
        this.collectService.pagoCheque[index].fecha = fecha + " 00:00:00";

        this.collectService.collection.collectionPayments![this.collectService.pagoCheque[index].posCollectionPayment]!.daCollectionPayment = fecha + " 00:00:00";
        this.collectService.validateToSend();
        break;
      }

      case "de": {
        this.collectService.pagoDeposito[index].fecha = fecha;
        this.collectService.collection.collectionPayments![this.collectService.pagoDeposito[index].posCollectionPayment]!.daCollectionPayment = fecha.split("T")[0] + " " + fecha.split("T")[1];;
        this.collectService.validateToSend();
        break;
      }

      case "tr": {
        this.collectService.pagoTransferencia[index].fecha = fecha;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.daCollectionPayment = fecha.split("T")[0] + " " + fecha.split("T")[1];;
        this.collectService.validateToSend();
        break;
      }

      case "pm": {
        this.collectService.pagoMovil[index].fecha = fecha;
        this.collectService.collection.collectionPayments![this.collectService.pagoMovil[index].posCollectionPayment]!.daCollectionPayment = fecha.split("T")[0] + " " + fecha.split("T")[1];
        this.collectService.validateToSend();
        break;
      }

      case "ot": {
        this.collectService.validateToSend();
        break;
      }
    }
  }

  getFechaValor(fecha: string, index: number, type: string) {

    switch (type) {
      case "ef": {
        if (this.collectService.validateCollectionDate) {
          this.collectService.pagoEfectivo[index].fecha = this.collectService.dateRate + " 00:00:00";
        } else {
          this.collectService.pagoEfectivo[index].fecha = fecha + " 00:00:00";
          fecha = fecha + " 00:00:00";
        }
        break
      }

      case "ch": {
        if (this.collectService.validateCollectionDate) {
          this.collectService.pagoCheque[index].fechaValor = this.collectService.dateRate + " 00:00:00";
        } else {
          this.collectService.pagoCheque[index].fechaValor = fecha + " 00:00:00";
          fecha = fecha + " 00:00:00";
        }


        this.collectService.collection.collectionPayments![this.collectService.pagoCheque[index].posCollectionPayment]!.daValue = fecha.split("T")[0] + " " + fecha.split("T")[1];;
        this.collectService.validateToSend();
        break;
      }

      case "de": {
        if (this.collectService.validateCollectionDate) {
          this.collectService.pagoDeposito[index].fecha = this.collectService.dateRate + " 00:00:00";
        } else {
          this.collectService.pagoDeposito[index].fecha = fecha + " 00:00:00";
          fecha = fecha + " 00:00:00";
        }

        this.collectService.collection.collectionPayments![this.collectService.pagoDeposito[index].posCollectionPayment]!.daValue = fecha.split("T")[0] + " " + fecha.split("T")[1];;
        this.collectService.validateToSend();
        break
      }

      case "tr": {
        if (this.collectService.validateCollectionDate) {
          this.collectService.pagoTransferencia[index].fecha = this.collectService.dateRate + " 00:00:00";
        } else {
          this.collectService.pagoTransferencia[index].fecha = fecha + " 00:00:00";
          fecha = fecha + " 00:00:00";
        }


        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.daCollectionPayment = fecha.split("T")[0] + " " + fecha.split("T")[1];;
        this.collectService.validateToSend();
        break;
      }

      case "pm": {
        if (this.collectService.validateCollectionDate) {
          this.collectService.pagoMovil[index].fecha = this.collectService.dateRate + " 00:00:00";
        } else {
          this.collectService.pagoMovil[index].fecha = fecha + " 00:00:00";
          fecha = fecha + " 00:00:00";
        }

        this.collectService.collection.collectionPayments![this.collectService.pagoMovil[index].posCollectionPayment]!.daCollectionPayment = fecha.split("T")[0] + " " + fecha.split("T")[1];
        this.collectService.validateToSend();
        break;
      }

      case "ot": {
        if (this.collectService.validateCollectionDate) {
          this.collectService.pagoOtros[index].fecha = this.collectService.dateRate + " 00:00:00";
        } else {
          this.collectService.pagoOtros[index].fecha = fecha + " 00:00:00";
          fecha = fecha + " 00:00:00";
        }
        this.collectService.validateToSend();
        break;
      }
    }


  }

  selectBankAccount(index: number, type: string,) {

    const applyDateToPayment = (posCollectionPayment: number, setFecha: (v: string) => void) => {
      const payment = this.collectService.collection.collectionPayments![posCollectionPayment]!;

      if (this.collectService.validateCollectionDate) {
        const dateRate = this.collectService.dateRate + " 00:00:00";
        setFecha(dateRate);
        payment.daCollectionPayment = dateRate;
        payment.daValue = dateRate;
        this.collectService.enableDate = true;
      } else {
        const today = this.dateServ.hoyISO();
        setFecha(today);
        const formatted = today.split("T")[0] + " " + today.split("T")[1];
        payment.daCollectionPayment = formatted;
        payment.daValue = formatted;
        this.collectService.enableDate = false;
      }
    };

    switch (type) {
      case "ef": {
        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.coCollection! = this.collectService.collection.coCollection;
        this.validatePayment("ef", index);

        break
      }

      case "ch": {
        const pos = this.collectService.pagoCheque[index].posCollectionPayment;
        const payment = this.collectService.collection.collectionPayments![pos]!;
        const selectedBank = this.collectService.bankAccountSelected?.[pos];

        if (selectedBank) {
          this.collectService.pagoCheque[index].idBanco = selectedBank.idBank;
          this.collectService.pagoCheque[index].nombreBanco = selectedBank.naBank;
        }

        if (this.collectService.clientBankAccount) {
          if (this.collectService.pagoCheque[index].nombreBanco == "Nueva Cuenta") {
            this.collectService.pagoCheque[index].showNuevaCuenta = true;
          } else {
            this.collectService.pagoCheque[index].showNuevaCuenta = false;
            payment.coClientBankAccount!
              = this.collectService.pagoCheque[index].nombreBanco;

            payment.newNuClientBankAccount = "";
          }
        } else {
          this.collectService.pagoCheque[index].showNuevaCuenta = false;
        }

        applyDateToPayment(pos, (v) => this.collectService.pagoCheque[index].fecha = v);
        this.collectService.pagoCheque[index].fechaValor = this.dateServ.hoyISO();
        this.collectService.pagoCheque[index].disabled = false;

        payment.coCollection = this.collectService.collection.coCollection;
        payment.coClientBankAccount
          = this.collectService.pagoCheque[index].nombreBanco;

        payment.naBank
          = this.collectService.pagoCheque[index].nombreBanco;

        payment.coPaymentMethod = type;
        payment.coType = type;


        this.validatePayment("ch", index);

        break;
      }

      case "de": {
        const pos = this.collectService.pagoDeposito[index].posCollectionPayment;
        const payment = this.collectService.collection.collectionPayments![pos]!;
        const selectedBank = this.collectService.bankAccountSelected?.[pos];

        if (selectedBank) {
          this.collectService.pagoDeposito[index].idBanco = selectedBank.idBank;
          this.collectService.pagoDeposito[index].nombreBanco = selectedBank.naBank;
          this.collectService.pagoDeposito[index].numeroCuenta = selectedBank.nuAccount;
        }

        applyDateToPayment(pos, (v) => this.collectService.pagoDeposito[index].fecha = v);

        payment.coCollection = this.collectService.collection.coCollection;
        payment.coPaymentMethod = type;
        payment.idBank = this.collectService.pagoDeposito[index].idBanco;
        payment.naBank = this.collectService.pagoDeposito[index].nombreBanco;
        payment.nuClientBankAccount = this.collectService.pagoDeposito[index].numeroCuenta;
        payment.coType = type;

        this.collectService.pagoDeposito[index].disabled = false;
        this.validatePayment("de", index);
        break
      }

      case "tr": {
        const pos = this.collectService.pagoTransferencia[index].posCollectionPayment;
        const payment = this.collectService.collection.collectionPayments![pos]!;
        const selectedClientBank = this.collectService.clientBankAccountSelected?.[pos];

        this.collectService.pagoTransferencia[index].numeroCuentaCliente = selectedClientBank?.nuAccount;
        //
        if (this.collectService.clientBankAccount) {
          if (this.collectService.pagoTransferencia[index].numeroCuentaCliente == "Nueva Cuenta") {
            payment.coClientBankAccount = selectedClientBank?.nuAccount;
            this.collectService.pagoTransferencia[index].showNuevaCuenta = true;
          } else {
            this.collectService.pagoTransferencia[index].showNuevaCuenta = false;
            payment.nuClientBankAccount = selectedClientBank?.nuAccount;
            payment.coClientBankAccount = selectedClientBank?.coClientBankAccount == null ? selectedClientBank?.coBank : selectedClientBank?.coClientBankAccount;
            payment.newNuClientBankAccount = "";
          }
        } else {
          this.collectService.pagoTransferencia[index].showNuevaCuenta = false;
        }

        applyDateToPayment(pos, (v) => this.collectService.pagoTransferencia[index].fecha = v);
        this.collectService.pagoTransferencia[index].disabled = false;

        payment.coCollection = this.collectService.collection.coCollection;
        payment.coPaymentMethod = type;
        payment.coType = type


        this.validatePayment("tr", index);
        break;
      }

      case "pm": {
        const pos = this.collectService.pagoMovil[index].posCollectionPayment;
        const payment = this.collectService.collection.collectionPayments![pos]!;
        const selectedBank = this.collectService.bankAccountSelected?.[pos];

        if (selectedBank) {
          this.collectService.pagoMovil[index].idBancoEmisor = selectedBank.idBank;
          this.collectService.pagoMovil[index].nombreBancoEmisor = selectedBank.naBank;
        }

        applyDateToPayment(pos, (v) => this.collectService.pagoMovil[index].fecha = v);
        this.collectService.pagoMovil[index].disabled = false;

        payment.coCollection = this.collectService.collection.coCollection;
        payment.coPaymentMethod = type;
        payment.coType = type;
        payment.coClientBankAccount = selectedBank?.coBank ?? selectedBank?.naBank ?? '';
        payment.nuClientBankAccount = selectedBank?.naBank ?? '';

        this.syncPagoMovilDocumento(index);
        this.syncPagoMovilTelefono(index);
        this.validatePayment("pm", index);
        break;
      }

      case "ot": {
        const pos = this.collectService.pagoOtros[index].posCollectionPayment;
        const payment = this.collectService.collection.collectionPayments![pos]!;

        applyDateToPayment(pos, (v) => this.collectService.pagoOtros[index].fecha = v);

        this.collectService.pagoOtros[index].disabled = false;
        payment.coCollection = this.collectService.collection.coCollection;
        payment.coPaymentMethod = type;
        payment.coType = type;

        this.validatePayment("ot", index);
        break;
      }
    }
  }

  onOpenCalendar(i: number, type: string) {

    switch (type) {
      case "ef": {
        this.collectService.pagoEfectivo[i].fecha = this.dateServ.hoyISO();
        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[i].posCollectionPayment]!.daCollectionPayment
          = this.collectService.pagoEfectivo[i].fecha.split("T")[0] + " " + this.collectService.pagoEfectivo[i].fecha.split("T")[1];;
        this.collectService.validateToSend();
        break
      }

      case "ch": {

        break;
      }

      case "de": {
        this.collectService.pagoDeposito[i].fecha = this.dateServ.hoyISO();
        this.collectService.collection.collectionPayments![this.collectService.pagoDeposito[i].posCollectionPayment]!.daCollectionPayment
          = this.collectService.pagoDeposito[i].fecha.split("T")[0] + " " + this.collectService.pagoDeposito[i].fecha.split("T")[1];;
        this.collectService.validateToSend();
        break
      }

      case "tr": {
        this.collectService.pagoTransferencia[i].fecha = this.dateServ.hoyISO();
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[i].posCollectionPayment]!.daCollectionPayment
          = this.collectService.pagoTransferencia[i].fecha.split("T")[0] + " " + this.collectService.pagoTransferencia[i].fecha.split("T")[1];;
        this.collectService.validateToSend();
        break;
      }

      case "pm": {
        this.collectService.pagoMovil[i].fecha = this.dateServ.hoyISO();
        this.collectService.collection.collectionPayments![this.collectService.pagoMovil[i].posCollectionPayment]!.daCollectionPayment
          = this.collectService.pagoMovil[i].fecha.split("T")[0] + " " + this.collectService.pagoMovil[i].fecha.split("T")[1];
        this.collectService.validateToSend();
        break;
      }

      case "ot": {
        this.collectService.pagoOtros[i].fecha = this.dateServ.hoyISO();
        this.collectService.collection.collectionPayments![this.collectService.pagoOtros[i].posCollectionPayment]!.daCollectionPayment
          = this.collectService.pagoOtros[i].fecha.split("T")[0] + " " + this.collectService.pagoOtros[i].fecha.split("T")[1];;
        this.collectService.validateToSend();
        break;
      }
    }
  }

  setMonto(monto: number, index: number, type: string) {
    let change = false;
    if (!this.collectService.disableSendButton) {
      this.collectService.disableSendButton = true;
      change = true;
    }

    switch (type) {
      case "ef": {
        this.collectService.pagoEfectivo[index].monto = monto;

        this.collectService.pagoEfectivo[index].montoConversion = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);

        this.collectService.pagoEfectivo[index].fecha = this.dateServ.hoyISO();
        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.coType = type
        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.coPaymentMethod = type;
        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.nuAmountPartial = monto;
        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.nuAmountPartialConversion
          = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);

        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.daCollectionPayment
          = this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.daValue
          = this.collectService.pagoEfectivo[index].fecha.split("T")[0] + " " + this.collectService.pagoEfectivo[index].fecha.split("T")[1];
        this.validatePayment("ef", index);
        break
      }

      case "ch": {
        this.collectService.pagoCheque[index].monto = monto;
        this.collectService.pagoCheque[index].montoConversion = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);
        this.collectService.collection.collectionPayments![this.collectService.pagoCheque[index].posCollectionPayment]!.nuAmountPartial = monto;
        this.collectService.collection.collectionPayments![this.collectService.pagoCheque[index].posCollectionPayment]!.nuAmountPartialConversion
          = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);
        this.validatePayment("ch", index);
        break;
      }

      case "de": {
        this.collectService.pagoDeposito[index].monto = monto;
        this.collectService.pagoDeposito[index].montoConversion = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);
        this.collectService.collection.collectionPayments![this.collectService.pagoDeposito[index].posCollectionPayment]!.nuAmountPartial = monto;
        this.collectService.collection.collectionPayments![this.collectService.pagoDeposito[index].posCollectionPayment]!.nuAmountPartialConversion
          = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);
        this.validatePayment("de", index);
        break
      }

      case "tr": {
        this.collectService.pagoTransferencia[index].monto = monto;
        this.collectService.pagoTransferencia[index].montoConversion = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.nuAmountPartial = monto;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.nuAmountPartialConversion
          = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);
        this.validatePayment("tr", index);
        break;
      }

      case "pm": {
        this.collectService.pagoMovil[index].monto = monto;
        this.collectService.pagoMovil[index].montoConversion = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);
        this.collectService.collection.collectionPayments![this.collectService.pagoMovil[index].posCollectionPayment]!.nuAmountPartial = monto;
        this.collectService.collection.collectionPayments![this.collectService.pagoMovil[index].posCollectionPayment]!.nuAmountPartialConversion
          = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);
        this.collectService.collection.collectionPayments![this.collectService.pagoMovil[index].posCollectionPayment]!.coType = type;
        this.collectService.collection.collectionPayments![this.collectService.pagoMovil[index].posCollectionPayment]!.coPaymentMethod = type;
        this.validatePayment("pm", index);
        break;
      }

      case "ot": {
        this.collectService.pagoOtros[index].monto = monto;
        this.collectService.pagoOtros[index].montoConversion = this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);
        this.collectService.collection.collectionPayments![this.collectService.pagoOtros[index].posCollectionPayment]!.nuAmountPartial = monto;

        this.collectService.collection.collectionPayments![this.collectService.pagoOtros[index].posCollectionPayment]!.coType = type
        this.collectService.collection.collectionPayments![this.collectService.pagoOtros[index].posCollectionPayment]!.coPaymentMethod = type;

        this.collectService.collection.collectionPayments![this.collectService.pagoOtros[index].posCollectionPayment]!.nuAmountPartialConversion =
          this.collectService.convertirMonto(monto, 0, this.collectService.collection.coCurrency);

        this.collectService.collection.collectionPayments![this.collectService.pagoOtros[index].posCollectionPayment]!.daCollectionPayment
          = this.collectService.collection.collectionPayments![this.collectService.pagoOtros[index].posCollectionPayment]!.daValue
          = this.dateServ.hoyISOFullTime();

        this.validatePayment("ot", index);
        break;
      }
    }

    if (change) {
      this.collectService.disableSendButton = false;
    }

    this.collectService.collection.nuAmountFinal = 0;
    this.collectService.collection.nuAmountTotal = 0;
    for (var i = 0; i < this.collectService.collection.collectionPayments!.length; i++) {
      this.collectService.collection.nuAmountFinal += this.collectService.collection.collectionPayments![i].nuAmountPartial;
      this.collectService.collection.nuAmountTotal += this.collectService.collection.collectionPayments![i].nuAmountPartial;
    }

    this.collectService.collection.nuAmountFinalConversion = this.collectService.convertirMonto(this.collectService.collection.nuAmountFinal, 0, this.collectService.collection.coCurrency);
    this.collectService.collection.nuAmountTotal = this.collectService.collection.nuAmountTotal;
  }

  setNroTransanccion(nroTrans: string, index: number, type: string) {

    nroTrans = this.collectService.cleanString(nroTrans);

    switch (type) {
      case "ef": {
        this.collectService.pagoEfectivo[index].nuRecibo = nroTrans;
        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.nuPaymentDoc = nroTrans;
        if (this.collectService.pagoEfectivo[index].monto > 0 && this.collectService.pagoEfectivo[index].nuRecibo != "")
          this.collectService.validateToSend();

        break
      }

      case "ch": {
        this.collectService.pagoCheque[index].numeroCheque = nroTrans;
        this.collectService.collection.collectionPayments![this.collectService.pagoCheque[index].posCollectionPayment]!.nuPaymentDoc = nroTrans;
        this.validatePayment("ch", index);

        break;
      }

      case "de": {
        this.collectService.pagoDeposito[index].numeroDeposito = nroTrans;
        this.collectService.collection.collectionPayments![this.collectService.pagoDeposito[index].posCollectionPayment]!.nuPaymentDoc = nroTrans;
        this.validatePayment("de", index);

        break
      }

      case "tr": {
        this.collectService.pagoTransferencia[index].numeroTransferencia = nroTrans;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.nuPaymentDoc = nroTrans;
        this.validatePayment("tr", index);

        break;
      }

      case "pm": {
        const onlyNumbers = (nroTrans || '').replace(/\D/g, '');
        this.collectService.pagoMovil[index].numeroReferencia = onlyNumbers;
        this.collectService.collection.collectionPayments![this.collectService.pagoMovil[index].posCollectionPayment]!.nuPaymentDoc = onlyNumbers;
        this.validatePayment("pm", index);
        break;
      }

      case "ot": {
        this.collectService.pagoOtros[index].nombre = nroTrans;
        this.collectService.collection.collectionPayments![this.collectService.pagoOtros[index].posCollectionPayment]!.nuPaymentDoc = nroTrans;
        if (this.collectService.pagoOtros[index].monto > 0 && this.collectService.pagoOtros[index].nombre != "")
          this.validatePayment("ot", index);

        break;
      }
    }

    this.collectService.validateReferencePayment();

  }

  setTipoDocumentoPagoMovil(index: number, tipo: string) {
    this.collectService.pagoMovil[index].tipoDocumento = tipo;
    this.syncPagoMovilDocumento(index);
    this.validatePayment('pm', index);
  }

  setCodigoTelefonoPagoMovil(index: number, codigo: string) {
    this.collectService.pagoMovil[index].codigoTelefono = codigo;
    this.syncPagoMovilTelefono(index);
    this.validatePayment('pm', index);
  }

  onPagoMovilNumeroDocumentoInput(index: number, value: string) {
    const onlyNumbers = (value || '').replace(/\D/g, '');
    this.collectService.pagoMovil[index].numeroDocumento = onlyNumbers;
    this.syncPagoMovilDocumento(index);
    this.validatePayment('pm', index);
  }

  onPagoMovilReferenciaInput(index: number, value: string) {
    const onlyNumbers = (value || '').replace(/\D/g, '');
    this.collectService.pagoMovil[index].numeroReferencia = onlyNumbers;
    this.collectService.collection.collectionPayments![this.collectService.pagoMovil[index].posCollectionPayment]!.nuPaymentDoc = onlyNumbers;
    this.validatePayment('pm', index);
  }

  onPagoMovilTelefonoInput(index: number, value: string) {
    const onlyNumbers = (value || '').replace(/\D/g, '').slice(0, 8);
    this.collectService.pagoMovil[index].numeroTelefono = onlyNumbers;
    this.syncPagoMovilTelefono(index);
    this.validatePayment('pm', index);
  }

  private syncPagoMovilDocumento(index: number) {
    const pago = this.collectService.pagoMovil[index];
    const payment = this.collectService.collection.collectionPayments?.[pago.posCollectionPayment];
    if (!payment) return;
    const selectedTypeDocument = this.collectService.typeDocumentList.find(
      typeDocument => typeDocument.coTypeDocument === pago.tipoDocumento
    );

    payment.idTypeDocument = selectedTypeDocument?.idTypeDocument ?? null;
    payment.nuDocument = pago.numeroDocumento || '';
  }

  private syncPagoMovilTelefono(index: number) {
    const pago = this.collectService.pagoMovil[index];
    const payment = this.collectService.collection.collectionPayments?.[pago.posCollectionPayment];
    if (!payment) return;

    const selectedCodePhone = this.collectService.codePhoneNumberList.find(
      codePhoneNumber => codePhoneNumber.coCodePhoneNumber === pago.codigoTelefono
    );

    payment.idCodePhoneNumber = selectedCodePhone?.idCodePhoneNumber ?? null;
    payment.nuPhoneNumber = pago.numeroTelefono || '';
  }

  setNuevaCuenta(dato: string, index: number, type: string) {

    switch (type) {
      case "ef": {
        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.newNuClientBankAccount = dato;
        this.collectService.collection.collectionPayments![this.collectService.pagoEfectivo[index].posCollectionPayment]!.nuClientBankAccount = dato;
        break
      }

      case "ch": {
        this.collectService.collection.collectionPayments![this.collectService.pagoCheque[index].posCollectionPayment]!.newNuClientBankAccount = dato;
        this.collectService.collection.collectionPayments![this.collectService.pagoCheque[index].posCollectionPayment]!.nuClientBankAccount = dato;
        break;
      }

      case "de": {
        this.collectService.collection.collectionPayments![this.collectService.pagoDeposito[index].posCollectionPayment]!.newNuClientBankAccount = dato;
        this.collectService.collection.collectionPayments![this.collectService.pagoDeposito[index].posCollectionPayment]!.nuClientBankAccount = dato;
        break
      }

      case "tr": {
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.newNuClientBankAccount = dato;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.nuClientBankAccount = dato;;
        break;
      }

      case "pm": {
        this.collectService.collection.collectionPayments![this.collectService.pagoMovil[index].posCollectionPayment]!.newNuClientBankAccount = dato;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.nuClientBankAccount = dato;;
        break;
      }

      case "ot": {
        break;
      }
    }

  }
  imprimir() {
    console.log(this.collectService.collection)
  }

  addCollectMethod(e: any) {
    this.showEventModal = true;
    this.addTipoPago(e.target.value.type);
  }

  onAceptarTiposPago() {
    // Obtiene todos los tipos de pago seleccionados
    const seleccionados = this.collectService.tiposPago.filter(tp => tp.selected);
    // Llama a addCollectMethod por cada tipo seleccionado
    seleccionados.forEach(tp => this.addCollectMethod({ target: { value: tp } }));
    this.setShowEventModal(false);
  }

  checkCreateAutomatedPrepaid() {
    if (!this.collectService.recentOpenCollect && this.collectService.createAutomatedPrepaid && !this.hasShownAutomatedPrepaidMsg) {
      this.collectService.mensaje = this.collectService.collectionTags.get('COB_MSG_AUTOMATED_PREPAID')! + " " + this.currencyService.formatNumber(this.collectService.collection.nuDifference);
      this.alertMessageOpen = true;
      this.hasShownAutomatedPrepaidMsg = true;
    }

  }


  validatePayment(type: string, index: number) {
    this.collectService.alertMessageOpen = false;
    // Si createAutomatedPrepaid pasa a false, resetea el flag para volver a mostrar el mensaje en el próximo ciclo
    if (!this.collectService.createAutomatedPrepaid) {
      this.hasShownAutomatedPrepaidMsg = false;
    }
    switch (type) {
      case "ef": {
        if (this.collectService.pagoEfectivo[index].monto >= 0) {
          this.collectService.calcularMontos(type, index).then(resp => {
            if (this.collectService.createAutomatedPrepaid)
              this.checkCreateAutomatedPrepaid();
            this.collectService.validateToSend();

          })
        }

        break
      }
      case "ch": {

        /* if (this.collectService.pagoCheque[index].fecha != "" && this.collectService.pagoCheque[index].fechaValor != "" && this.collectService.pagoCheque[index].monto > 0
          && this.collectService.pagoCheque[index].nombreBanco != "" && this.collectService.pagoCheque[index].nuevaCuenta != ""
          && this.collectService.pagoCheque[index].numeroCheque != "") {
          this.collectService.validateToSend();
        } */
        if (this.collectService.pagoCheque[index].monto >= 0) {
          this.collectService.calcularMontos(type, index).then(resp => {
            if (this.collectService.pagoCheque[index].fecha != ""
              && this.collectService.pagoCheque[index].fechaValor != ""
              && this.collectService.pagoCheque[index].nombreBanco != ""
              && this.collectService.pagoCheque[index].numeroCheque != "") {
              if (this.collectService.createAutomatedPrepaid)
                this.checkCreateAutomatedPrepaid();

              this.collectService.validateToSend();
            }
          })
        }

        break
      }

      case "de": {
        /* if (this.collectService.pagoDeposito[index].fecha != "" && this.collectService.pagoDeposito[index].monto > 0
          && this.collectService.pagoDeposito[index].nombreBanco != "" && this.collectService.pagoDeposito[index].numeroCuenta != ""
          && this.collectService.pagoDeposito[index].numeroDeposito != "") {
          this.collectService.validateToSend();
        } */
        if (this.collectService.pagoDeposito[index].monto >= 0) {
          this.collectService.calcularMontos(type, index).then(resp => {
            if (this.collectService.pagoDeposito[index].fecha != ""
              && this.collectService.pagoDeposito[index].nombreBanco != ""
              && this.collectService.pagoDeposito[index].numeroCuenta != ""
              && this.collectService.pagoDeposito[index].numeroDeposito != "") {
              if (this.collectService.createAutomatedPrepaid)
                this.checkCreateAutomatedPrepaid();

              this.collectService.validateToSend();
            }
          })
        }
        break;
      }

      case "tr": {
        /* if (this.collectService.pagoTransferencia[index].fecha != "" && this.collectService.pagoTransferencia[index].monto > 0
          && this.collectService.pagoTransferencia[index].nombreBanco != "" && this.collectService.pagoTransferencia[index].nuevaCuenta != ""
          && this.collectService.pagoTransferencia[index].numeroTransferencia != "") {
          this.collectService.validateToSend();
        } */
        if (this.collectService.clientBankAccount) {
          if (this.collectService.pagoTransferencia[index].monto >= 0) {
            this.collectService.calcularMontos(type, index).then(resp => {
              if (this.collectService.pagoTransferencia[index].fecha != ""
                && this.collectService.pagoTransferencia[index].nombreBanco != ""
                && this.collectService.pagoTransferencia[index].nuevaCuenta != ""
                && this.collectService.pagoTransferencia[index].numeroTransferencia != "") {
                if (this.collectService.createAutomatedPrepaid)
                  this.checkCreateAutomatedPrepaid();

                this.collectService.validateToSend();
              }
            })
          }
        } else {
          if (this.collectService.pagoTransferencia[index].monto >= 0) {
            this.collectService.calcularMontos(type, index).then(resp => {
              if (this.collectService.pagoTransferencia[index].fecha != ""
                && this.collectService.pagoTransferencia[index].nombreBanco != ""
                && this.collectService.pagoTransferencia[index].numeroTransferencia != "") {
                if (this.collectService.createAutomatedPrepaid)
                  this.checkCreateAutomatedPrepaid();

                this.collectService.validateToSend();
              }
            })
          }
        }

        break;
      }

      case "pm": {
        if (this.collectService.pagoMovil[index].monto >= 0) {
          this.collectService.calcularMontos(type, index).then(() => {
            if (this.collectService.pagoMovil[index].fecha != ""
              && this.collectService.pagoMovil[index].nombreBancoEmisor != ""
              && this.collectService.pagoMovil[index].nombreBancoDestino != ""
              && this.collectService.pagoMovil[index].numeroDocumento != ""
              && this.collectService.pagoMovil[index].numeroReferencia != "") {
              if (this.collectService.createAutomatedPrepaid)
                this.checkCreateAutomatedPrepaid();

              this.collectService.validateToSend();
            }
          })
        }
        break;
      }

      case "ot": {
        if (this.collectService.pagoOtros[index].monto >= 0) {
          this.collectService.calcularMontos(type, index).then(resp => {
            if (this.collectService.pagoOtros[index].nombre != "") {
              this.collectService.validateToSend();
            }
          })
        }
        /*  if (this.collectService.pagoOtros[index].monto > 0 && this.collectService.pagoOtros[index].nombre != "") {
           this.collectService.validateToSend();
         } */
        break;
      }
    }
  }

  selectListBankAccount(index: number, type: string,) {

    switch (type) {
      case "ef": {

        break
      }
      case "ch": {



        break
      }

      case "de": {


        break;
      }

      case "tr": {
        this.collectService.pagoTransferencia[index].idBanco = this.collectService.bankAccountSelected[this.collectService.pagoTransferencia[index].posCollectionPayment].idBank;
        this.collectService.pagoTransferencia[index].nombreBanco = this.collectService.bankAccountSelected[this.collectService.pagoTransferencia[index].posCollectionPayment].naBank;
        this.collectService.pagoTransferencia[index].numeroCuenta = this.collectService.bankAccountSelected[this.collectService.pagoTransferencia[index].posCollectionPayment].nuAccount;
        //
        if (this.collectService.validateCollectionDate) {
          //LA FECHA DE LOS PAGOS DEBE SER LA MISMA QUE LA FECHA DE LA TASA
          this.collectService.pagoTransferencia[index].fecha = this.collectService.dateRate + " 00:00:00";

          this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.daCollectionPayment!
            = this.collectService.dateRate + " 00:00:00";

          this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.daValue!
            = this.collectService.dateRate + " 00:00:00";

          this.collectService.enableDate = true;

        } else {
          this.collectService.pagoTransferencia[index].fecha = this.dateServ.hoyISO();

          this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.daCollectionPayment!
            = this.collectService.pagoTransferencia[index].fecha.split("T")[0] + " " + this.collectService.pagoTransferencia[index].fecha.split("T")[1];

          this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.daValue!
            = this.collectService.pagoTransferencia[index].fecha.split("T")[0] + " " + this.collectService.pagoTransferencia[index].fecha.split("T")[1];

          this.collectService.enableDate = false;

        }

        this.collectService.pagoTransferencia[index].disabled = false;

        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.coCollection! = this.collectService.collection.coCollection;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.coPaymentMethod = type;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.idBank = this.collectService.pagoTransferencia[index].idBanco;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.naBank = this.collectService.pagoTransferencia[index].nombreBanco;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.nuBankAccount = this.collectService.pagoTransferencia[index].numeroCuenta;
        this.collectService.collection.collectionPayments![this.collectService.pagoTransferencia[index].posCollectionPayment]!.coType = type;


        this.validatePayment("tr", index);
        break;

        break;
      }

      case "pm": {
        const pago = this.collectService.pagoMovil[index];
        const pos = pago.posCollectionPayment;
        const selectedDestBank = this.collectService.clientBankAccountSelected?.[pos];
        if (!selectedDestBank) break;

        pago.idBancoDestino = selectedDestBank.idBank;
        pago.nombreBancoDestino = selectedDestBank.naBank;
        pago.numeroCuentaDestino = selectedDestBank.nuAccount;

        if (this.collectService.validateCollectionDate) {
          pago.fecha = this.collectService.dateRate + " 00:00:00";
          this.collectService.collection.collectionPayments![pos]!.daCollectionPayment = this.collectService.dateRate + " 00:00:00";
          this.collectService.collection.collectionPayments![pos]!.daValue = this.collectService.dateRate + " 00:00:00";
          this.collectService.enableDate = true;
        } else {
          pago.fecha = this.dateServ.hoyISO();
          this.collectService.collection.collectionPayments![pos]!.daCollectionPayment = pago.fecha.split("T")[0] + " " + pago.fecha.split("T")[1];
          this.collectService.collection.collectionPayments![pos]!.daValue = pago.fecha.split("T")[0] + " " + pago.fecha.split("T")[1];
          this.collectService.enableDate = false;
        }

        pago.disabled = false;
        this.collectService.collection.collectionPayments![pos]!.coCollection = this.collectService.collection.coCollection;
        this.collectService.collection.collectionPayments![pos]!.coPaymentMethod = type;
        this.collectService.collection.collectionPayments![pos]!.idBank = pago.idBancoDestino;
        this.collectService.collection.collectionPayments![pos]!.naBank = pago.nombreBancoDestino;
        this.collectService.collection.collectionPayments![pos]!.nuBankAccount = pago.numeroCuentaDestino;
        this.collectService.collection.collectionPayments![pos]!.coType = type;

        this.syncPagoMovilDocumento(index);
        this.validatePayment("pm", index);
        break;
      }

      case "ot": {

        break;
      }
    }
  }

  compareWith(o1: any, o2: any) {
    return "";
    /* return o1 && o2 ? o1.id === o2.id : o1 === o2; */
  }

  setResult(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    this.collectService.alertMessageOpen = false;
    this.alertMessageOpen = false;
    this.collectService.mensaje = '';
  }

  print() {
    console.log(this.collectService.collection);
  }

  setShowDateChequeVenceModal(i: number, val: boolean) {
    let cheque = this.collectService.pagoCheque[i];
    cheque.showDateVenceModal = val;
  }

  setShowDateChequeValorModal(i: number, val: boolean) {
    let cheque = this.collectService.pagoCheque[i];
    cheque.showDateValorModal = val;
  }

  setShowDateDepositoModal(i: number, val: boolean) {
    let deposito = this.collectService.pagoDeposito[i];
    deposito.showDateModal = val;
  }

  setShowDateTransferenciaModal(i: number, val: boolean) {
    let transferencia = this.collectService.pagoTransferencia[i];
    transferencia.showDateModal = val;
  }

  setShowDatePagoMovilModal(i: number, val: boolean) {
    let pagoMovil = this.collectService.pagoMovil[i];
    pagoMovil.showDateModal = val;
  }

  setShowDateEfectivoModal(i: number, val: boolean) {
    let efectivo = this.collectService.pagoEfectivo[i];
    efectivo.showDateModal = val;
  }

  setShowDateOtrosModal(i: number, val: boolean) {
    let otros = this.collectService.pagoOtros[i];
    otros.showDateModal = val;
  }

  setShowEventModal(value: boolean) {
    this.showEventModal = value;
    // Si se está abriendo el modal, limpiar selección
    if (value) {
      this.collectService.tiposPago.forEach(tp => tp.selected = false);
    }
  }

  getSelectedTipoPago() {
    // Devuelve el primer tipo de pago seleccionado (puedes ajustar para múltiples si lo necesitas)
    return this.collectService.tiposPago.find((tipoPago: any) => tipoPago.selected);
  }

  onSelectTipoPago(tipoSeleccionado: any, type: number) {
    // Solo uno puede estar seleccionado
    this.collectService.tiposPago.forEach(tp => tp.selected = false);
    tipoSeleccionado.selected = true;
  }

  onFechaValorChange(value: string, index: number, type: string) {
    // Guarda solo la parte de la fecha (YYYY-MM-DD)
    switch (type) {
      case "ef": {
        if (value) {
          this.collectService.pagoEfectivo[index].fecha = value.split('T')[0];
          this.getFechaValor(this.collectService.pagoEfectivo[index].fecha, index, 'ef');
        }
        break
      }
      case "de": {
        if (value) {
          this.collectService.pagoDeposito[index].fecha = value.split('T')[0];
          this.getFechaValor(this.collectService.pagoDeposito[index].fecha, index, 'de');
        }
        break
      }
      case "ch": {
        if (value) {
          this.collectService.pagoCheque[index].fechaValor = value.split('T')[0];
          this.getFechaValor(this.collectService.pagoCheque[index].fechaValor, index, 'ch');
        }
        break
      }
      case "tr": {
        if (value) {
          this.collectService.pagoTransferencia[index].fecha = value.split('T')[0];
          this.getFechaValor(this.collectService.pagoTransferencia[index].fecha, index, 'tr');
        }
        break
      }
      case "pm": {
        if (value) {
          this.collectService.pagoMovil[index].fecha = value.split('T')[0];
          this.getFechaValor(this.collectService.pagoMovil[index].fecha, index, 'pm');
        }
        break
      }
      case "ot": {
        if (value) {
          this.collectService.pagoOtros[index].fecha = value.split('T')[0];
          this.getFechaValor(this.collectService.pagoOtros[index].fecha, index, 'ot');
        }
        break
      }
    }
  }

  onFechaChange(value: string, index: number, type: string) {
    // Guarda solo la parte de la fecha (YYYY-MM-DD)
    if (value) {
      this.collectService.pagoCheque[index].fecha = value.split('T')[0];
      this.getFecha(this.collectService.pagoCheque[index].fecha, index, 'ch');
    }
  }

  private getDecimals(): number {
    // Prefer global config value if present, fallback to service property, then default 2
    const fromGlobal = Number.parseInt(String(this.globalConfig.get('parteDecimal') ?? ''), 10);
    if (Number.isInteger(fromGlobal) && fromGlobal >= 0) return fromGlobal;
    const d = Number(this.collectService?.parteDecimal);
    return Number.isInteger(d) && d >= 0 ? d : 2; // default 2 decimales
  }

  private getMultiplier(): number {
    return Math.pow(10, this.getDecimals());
  }

  public formatFromMinorUnits(minorUnits: number): string {
    const decimals = this.getDecimals();
    const sign = minorUnits < 0 ? '-' : '';
    const abs = Math.abs(minorUnits);
    const units = Math.floor(abs / this.getMultiplier());
    const fraction = (abs % this.getMultiplier()).toString().padStart(decimals, '0');
    const unitsStr = units.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sign}${unitsStr || '0'},${fraction}`;
  }

  public formatFromCents(cents: number): string {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    const units = Math.floor(abs / 100);
    const cent = (abs % 100).toString().padStart(2, '0');
    const unitsStr = units.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sign}${unitsStr || '0'},${cent}`;
  }

  private parsePastedToMinorUnits(raw: string): number {
    if (!raw || typeof raw !== 'string') return 0;
    // Remove non-numeric except comma and dot and minus
    let cleaned = raw.replace(/\s/g, '');
    // If it contains comma as decimal separator and dot thousands, convert
    // Normalize: remove thousands dots, convert comma to dot
    cleaned = cleaned.replace(/\./g, '');
    cleaned = cleaned.replace(/,/g, '.');
    // Remove any characters except digits, dot and minus
    cleaned = cleaned.replace(/[^0-9.-]/g, '');
    if (cleaned === '' || cleaned === '.' || cleaned === '-') return 0;
    const n = Number(cleaned);
    if (isNaN(n)) return 0;
    return Math.round(n * this.getMultiplier());
  }

  public onMontoInput(event: any, pago: any, index: number, type: string) {
    // Support Ionic's ionInput and native InputEvent shapes
    const detail = event?.detail ?? {};
    const inputEvent = detail?.event ?? event;
    const data = inputEvent?.data ?? detail?.data ?? null;
    const inputType = inputEvent?.inputType ?? detail?.inputType ?? null;
    const value = detail?.value ?? (event?.target?.value ?? '');

    const uid = this.ensureInitFor(pago);

    // If keydown already handled this input, ignore the subsequent input event
    if (this.ignoreInputMap[uid]) {
      delete this.ignoreInputMap[uid];
      return;
    }

    // Paste or drop
    if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') {
      const minor = this.parsePastedToMinorUnits(String(value));
      this.centsMap[uid] = minor;
      this.updateAfterChange(uid, pago, index, type);
      return;
    }

    // Single digit insertion
    if (/^\d$/.test(String(data)) && (inputType === 'insertText' || inputType === 'insertCompositionText' || inputType === null)) {
      const digit = parseInt(String(data), 10);
      this.centsMap[uid] = Math.min(999999999999, (this.centsMap[uid] ?? 0) * 10 + digit);
      this.updateAfterChange(uid, pago, index, type);
      return;
    }

    // Backspace / cut
    if (inputType === 'deleteContentBackward' || inputType === 'deleteByCut') {
      this.centsMap[uid] = Math.floor((this.centsMap[uid] ?? 0) / 10);
      this.updateAfterChange(uid, pago, index, type);
      return;
    }

    // Fallback: parse the whole field value
    const minor = this.parsePastedToMinorUnits(String(value));
    this.centsMap[uid] = minor;
    this.updateAfterChange(uid, pago, index, type);
  }

  // Añade este helper en la clase
  private makeUid(): string {
    // id corto basado en tiempo + random (colisiones prácticamente imposibles en UI)
    return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private getUid(obj: any): string {
    if (!obj) {
      // Si por alguna razón te pasan null, genera uno (pero idealmente no debería pasar)
      return this.makeUid();
    }
    if (!obj.__amountUid) {
      Object.defineProperty(obj, '__amountUid', {
        value: this.makeUid(),
        enumerable: false,
        configurable: true,
        writable: false
      });
    }
    return obj.__amountUid;
  }

  private ensureInitFor(obj: any): string {
    const uid = this.getUid(obj);
    if (this.centsMap[uid] === undefined) {
      const base = Number(obj?.monto ?? 0) || 0;
      this.centsMap[uid] = Math.round(base * this.getMultiplier());
      this.displayMap[uid] = this.formatFromMinorUnits(this.centsMap[uid]);
    }
    return uid;
  }

  public getDisplay(obj: any, idx?: number, type?: string): string {
    const uid = this.ensureInitFor(obj);
    return this.displayMap[uid] ?? this.formatFromMinorUnits(0);
  }

  private updateAfterChange(uid: string, pago: any, index?: number, type?: string) {
    const minor = Math.max(0, this.centsMap[uid] ?? 0);
    this.centsMap[uid] = minor;
    pago.monto = (minor / this.getMultiplier());
    this.displayMap[uid] = this.formatFromMinorUnits(minor);

    if (this.debounceTimers[uid]) clearTimeout(this.debounceTimers[uid]);
    this.debounceTimers[uid] = setTimeout(() => {
      if (typeof (this as any).setMonto === 'function') {
        try { (this as any).setMonto(pago.monto, index ?? 0, type ?? ''); } catch { }
      }
      delete this.debounceTimers[uid];
    }, this.debounceDelay);
  }

  public onMontoKeyDown(event: any, pago: any, index: number, type: string) {


    const hasPartial = !!(this.collectService.collection &&
      Array.isArray(this.collectService.collection.collectionDetails) &&
      this.collectService.collection.collectionDetails.some((cd: any) => cd && cd.inPaymentPartial === true));

    this.debounceDelay = hasPartial ? 1500 : 0;

    const key = event?.key;
    const uid = this.ensureInitFor(pago);
    const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'];
    if (allowed.includes(key)) return;

    const inputEl = event?.target as HTMLInputElement | null;
    const selStart = inputEl?.selectionStart ?? null;
    const selEnd = inputEl?.selectionEnd ?? null;
    const hasSelection = selStart !== null && selEnd !== null && (selEnd - selStart) > 0;

    // Si seleccionan todo y borran -> poner 0
    if ((key === 'Backspace' || key === 'Delete') && hasSelection) {
      this.centsMap[uid] = 0;
      this.ignoreInputMap[uid] = true;
      this.updateAfterChange(uid, pago, index, type);
      event.preventDefault();
      return;
    }

    if (key === 'Delete') {
      // borra último dígito (derecha)
      this.centsMap[uid] = Math.floor((this.centsMap[uid] ?? 0) / 10);
      this.ignoreInputMap[uid] = true;
      this.updateAfterChange(uid, pago, index, type);
      event.preventDefault();
      return;
    }

    if (/^\d$/.test(key)) {
      const digit = parseInt(key, 10);
      // desplaza y añade dígito en unidades menores (funciona para cualquier parteDecimal)
      this.centsMap[uid] = Math.min(999999999999, (this.centsMap[uid] ?? 0) * 10 + digit);
      this.ignoreInputMap[uid] = true;
      this.updateAfterChange(uid, pago, index, type);
      event.preventDefault();
      return;
    }

    if (key === 'Backspace') {
      this.centsMap[uid] = Math.floor((this.centsMap[uid] ?? 0) / 10);
      this.ignoreInputMap[uid] = true;
      this.updateAfterChange(uid, pago, index, type);
      event.preventDefault();
      return;
    }

    event.preventDefault();
  }

  public onMontoFocus(pago: any, index: number, type: string) {
    const uid = this.ensureInitFor(pago);
    if (this.centsMap[uid] === undefined) {
      this.centsMap[uid] = 0;
      this.displayMap[uid] = this.formatFromMinorUnits(0);
    }
  }

  public onMontoBlur(pago: any, index: number, type: string) {
    const uid = this.ensureInitFor(pago);
    // forzar ejecución inmediata del debounce si hay timer
    if (this.debounceTimers[uid]) {
      clearTimeout(this.debounceTimers[uid]);
      if (typeof (this as any).setMonto === 'function') {
        try { (this as any).setMonto(pago.monto, index, type); } catch { }
      }
      delete this.debounceTimers[uid];
    } else {
      if (typeof (this as any).setMonto === 'function') {
        try { (this as any).setMonto(pago.monto, index, type); } catch { }
      }
    }
    // asegurar mínimo y formato final
    const minor = Math.max(0, this.centsMap[uid] ?? 0);
    this.centsMap[uid] = minor;
    this.displayMap[uid] = this.formatFromMinorUnits(minor);
  }

  selectDifferenceCode(index: number) {
    let posCollectionPayment = this.collectService.pagoOtros[index].posCollectionPayment;
    const differenceCode = this.collectService.pagoOtros[index].differenceCode;

    this.collectService.collection.collectionPayments![posCollectionPayment]!.idDifferenceCode = differenceCode!.idDifferenceCode;
    this.collectService.collection.collectionPayments![posCollectionPayment]!.coDifferenceCode = differenceCode!.coDifferenceCode;
    this.validatePayment("ot", index);
  }
}
