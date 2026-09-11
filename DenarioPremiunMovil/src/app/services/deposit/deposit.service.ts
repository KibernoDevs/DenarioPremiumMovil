import { inject, Injectable } from '@angular/core';
import { CurrencyService } from '../currency/currency.service';
import { DateServiceService } from '../dates/date-service.service';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { ServicesService } from '../services.service';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { Subject } from 'rxjs';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { Currencies } from 'src/app/modelos/tables/currencies';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { EnterpriseService } from '../enterprise/enterprise.service';
import { Deposit, DepositCollect } from 'src/app/modelos/tables/deposit';
import { BankAccount } from 'src/app/modelos/tables/bankAccount';
import { CollectDeposit } from 'src/app/modelos/collect-deposit';
import { HistoryTransaction } from '../historyTransaction/historyTransaction';
import { ItemListaDepositos } from 'src/app/depositos/item-lista-depositos';
import { DEPOSIT_APPROVAL_STATUS_REJECTED, DEPOSITO_STATUS_NEW, DEPOSITO_STATUS_SAVED, DEPOSITO_STATUS_SENT, DEPOSITO_STATUS_TO_SEND, DELIVERY_STATUS_SAVED, DELIVERY_STATUS_SENT, DELIVERY_STATUS_TO_SEND } from 'src/app/utils/appConstants';
import { Return } from 'src/app/modelos/tables/return';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { TransactionStatuses } from 'src/app/modelos/tables/transactionStatuses';

@Injectable({
  providedIn: 'root'
})
export class DepositService {

  private static readonly DEPOSIT_PAYMENT_METHODS_SQL = "('ef', 'ch')";

  /** Excluye cobros ya usados en depósitos activos; libera los de depósitos rechazados en Web. */
  private static readonly DEPOSIT_COLLECTS_BLOCKING_SUBQUERY =
    'c.co_collection NOT IN (' +
    '  SELECT dc.co_collection FROM deposit_collects dc' +
    '  INNER JOIN deposits d ON d.co_deposit = dc.co_deposit' +
    '  WHERE NOT (' +
    '    (' +
    '      d.st_deposit = ' + DEPOSIT_APPROVAL_STATUS_REJECTED +
    '      AND d.st_delivery = ' + DEPOSITO_STATUS_SENT +
    '      AND IFNULL(d.id_deposit, 0) > 0' +
    '    )' +
    '    OR EXISTS (' +
    '      SELECT 1 FROM transaction_statuses ts' +
    '      JOIN statuses s ON s.id_status = ts.id_status' +
    '      WHERE ts.id_transaction_type = 6' +
    '        AND IFNULL(d.id_deposit, 0) > 0' +
    '        AND ts.id_transaction = d.id_deposit' +
    '        AND s.status_action = ' + DEPOSIT_APPROVAL_STATUS_REJECTED +
    '        AND ts.da_transaction_statuses = (' +
    '          SELECT MAX(ts2.da_transaction_statuses)' +
    '          FROM transaction_statuses ts2' +
    '          WHERE ts2.id_transaction_type = 6' +
    '            AND ts2.id_transaction = d.id_deposit' +
    '        )' +
    '    )' +
    '  )' +
    ')';

  public listTransactionStatusDeposits: TransactionStatuses[] = [];
  public depositRefused: TransactionStatuses[] = [];
  public depositSended: TransactionStatuses[] = [];

  public globalConfig = inject(GlobalConfigService);
  public services = inject(ServicesService);
  public dateServ = inject(DateServiceService);
  private currencyServices = inject(CurrencyService);
  public enterpriseServ = inject(EnterpriseService);
  public historyTransaction = inject(HistoryTransaction);
  public adjuntoService = inject(AdjuntoService);


  private database!: SQLiteObject;
  public currencyList!: Currencies[];
  public currencySelected!: Currencies;
  public currencyConversion!: Currencies;
  public enterpriseList!: Enterprise[];
  public enterpriseSelected!: Enterprise;
  public deposit!: Deposit;
  public bankList!: BankAccount[];
  public bankSelected!: BankAccount;
  public cobrosDetails!: CollectDeposit[];
  public listDeposits: Deposit[] = [];
  public itemListaDepositos: ItemListaDepositos[] = [];

  public dateDeposit: string = "";
  public nuDocument: string = "";
  public txComment: string = "";
  public message: string = "";
  public multiCurrency: string = "";

  public daDocument: string = this.dateServ.hoyISOFullTime();;

  public showHeaderButtons: Boolean = false;
  public depositComponent: Boolean = false;
  public depositNewComponent: Boolean = false;
  public depositListComponent: Boolean = false;
  public disabledEnterprise: boolean = false;
  public disabledCurrency: boolean = false;
  public isSelectedBank: boolean = false;
  public disabledSaveButton: boolean = true;
  public disabledSendButton: boolean = true;
  public depositValid: boolean = false;
  public isSelected: boolean = false;
  public tabTotal: boolean = false;
  public hideDeposit: boolean = false;
  public userMustActivateGPS: boolean = true; //si la pongo en false puedes entrar al clickear rapido
  public saveOrExitOpen = false;

  /** Tras guardar o abrir desde lista: hay copia coherente en BD. */
  public depositPersistedBaseline = false;
  /** Cambios locales desde el último guardado / apertura limpia. */
  public depositDirtySincePersist = false;

  /** General válida: banco seleccionado (desbloquea pestañas y base Guardar/Enviar). */
  public generalTabValidForSave = false;
  public sendValidationAttempted = false;
  public sendBlockedByFields = false;
  public depositSendFocusMissingCollect = false;
  public focusSendValidationTab = new Subject<'default' | 'cobros' | 'total' | 'adjuntos'>();

  public coordenadas = '';
  public fechaMayor: string = this.dateServ.hoyISO();
  public fechaMenor!: string;

  public backRoute = new Subject<string>;
  public showButtons = new Subject<Boolean>;
  public depositValidToSave = new Subject<Boolean>;
  public depositValidToSend = new Subject<Boolean>;

  public depositTags = new Map<string, string>([]);
  public depositTagsDenario = new Map<string, string>([]);

  public totalDeposit: number = 0;
  public parteDecimal: number = 0;
  public nuAmountDoc: number = 0;
  public nuAmountDocConversion: number = 0;

  public sendDeposit = new Subject<string>;

  public showConversion: boolean = true;
  public localCurrencyDefault: boolean = false;
  public currencyModule: any;

  public DEPOSITO_STATUS_NEW = DEPOSITO_STATUS_NEW;
  public DEPOSITO_STATUS_SAVED = DEPOSITO_STATUS_SAVED;
  public DEPOSITO_STATUS_TO_SEND = DEPOSITO_STATUS_TO_SEND;
  public DEPOSITO_STATUS_SENT = DEPOSITO_STATUS_SENT;

  public alertButtons = [
    {
      text: '',
      role: 'cancel'
    },
    {
      text: '',
      role: 'confirm'
    },
  ];
  public alertButtonsSend = [
    {
      text: '',
      role: 'cancel'
    },
    {
      text: '',
      role: 'confirm'
    },
  ];


  constructor() {
    this.multiCurrency = this.globalConfig.get("multiCurrency");

  }


  getTags(dbServ: SQLiteObject) {
    return this.services.getTags(dbServ, "DEP", "ESP").then(result => {
      for (var i = 0; i < result.length; i++) {
        this.depositTags.set(
          result[i].coApplicationTag, result[i].tag
        )
      }
      return this.services.getTags(dbServ, "DEN", "ESP").then(result => {
        for (var i = 0; i < result.length; i++) {
          this.depositTags.set(
            result[i].coApplicationTag, result[i].tag
          )
        }
        return Promise.resolve(true);
      });


    });
  }
  getTagsDenario(dbServ: SQLiteObject) {
    return this.services.getTags(dbServ, "DEN", "ESP").then(result => {
      for (var i = 0; i < result.length; i++) {
        this.depositTagsDenario.set(
          result[i].coApplicationTag, result[i].tag
        )
      }
      this.alertButtonsSend[0].text = this.depositTagsDenario.get('DENARIO_BOTON_CANCELAR')!
      this.alertButtonsSend[1].text = this.depositTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
      this.alertButtons[0].text = this.depositTagsDenario.get('DENARIO_BOTON_CANCELAR')!
      this.alertButtons[1].text = this.depositTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
      return Promise.resolve(true);
    })
  }

  showBackRoute(route: string) {
    console.log('Back-Service: ' + route);
    this.backRoute.next(route);
  }

  showHeaderButtonsFunction(headerButtos: boolean) {
    this.showButtons.next(headerButtos);
  }

  onDepositValidToSave(valid: boolean) {
    console.log('returnLogicService: onReturnValid');
    this.depositValidToSave.next(valid);
  }

  onDepositValidToSend(validToSend: boolean) {
    console.log('returnLogicService: onReturnValidToSend');
    this.depositValidToSend.next(validToSend);
  }

  onDepositGeneralValid(valid: boolean): void {
    this.generalTabValidForSave = valid;
    this.depositValid = valid;
    this.updateSaveButtonAvailability();
    this.updateSendButtonAvailability();
  }

  isDepositReadOnlyForEdit(): boolean {
    const stDelivery = Number(this.deposit?.stDelivery ?? 0);
    return stDelivery === DEPOSITO_STATUS_TO_SEND
      || stDelivery === DEPOSITO_STATUS_SENT
      || stDelivery === 6;
  }

  /**
   * Depósito rechazado en Web (st_deposit=status_action 2, ya enviado y con id servidor).
   * Distinto del borrador local Por Enviar (st_delivery=2, id_deposit=0).
   */
  isDepositRejectedForCollectRelease(
    stDeposit: number,
    stDelivery: number,
    idDeposit: number | null,
  ): boolean {
    return Number(stDeposit) === DEPOSIT_APPROVAL_STATUS_REJECTED
      && Number(stDelivery) === DEPOSITO_STATUS_SENT
      && Number(idDeposit ?? 0) > 0;
  }

  public updateSaveButtonAvailability(): void {
    if (this.isDepositReadOnlyForEdit() || this.hideDeposit) {
      this.disabledSaveButton = true;
      this.onDepositValidToSave(false);
      return;
    }
    if (this.adjuntoService.weightLimitExceeded) {
      this.disabledSaveButton = true;
      this.onDepositValidToSave(false);
      return;
    }
    // Guardar ON al entrar / con cambios (General se valida al pulsar).
    const hasChangesToSave =
      !this.depositPersistedBaseline || this.depositDirtySincePersist;
    this.disabledSaveButton = !hasChangesToSave;
    this.onDepositValidToSave(hasChangesToSave);
  }

  public updateSendButtonAvailability(): void {
    if (this.isDepositReadOnlyForEdit() || this.hideDeposit) {
      this.disabledSendButton = true;
      this.onDepositValidToSend(false);
      return;
    }
    if (this.adjuntoService.weightLimitExceeded) {
      this.disabledSendButton = true;
      this.onDepositValidToSend(false);
      return;
    }
    // Tras fallo de Enviar, apagar hasta que el usuario edite.
    if (this.sendBlockedByFields) {
      this.disabledSendButton = true;
      this.onDepositValidToSend(false);
      return;
    }
    // Enviar ON de entrada; banco/cobros/firma se validan al click (DEP-SEND-001).
    this.disabledSendButton = false;
    this.onDepositValidToSend(true);
  }

  public resetSendValidationUx(): void {
    this.sendValidationAttempted = false;
    this.sendBlockedByFields = false;
    this.depositSendFocusMissingCollect = false;
    this.updateSendButtonAvailability();
  }

  public refreshSendBlockedState(): void {
    if (!this.sendBlockedByFields) {
      return;
    }
    // Al editar, reactivar Enviar para reintentar y ver el siguiente mensaje exacto.
    this.sendBlockedByFields = false;
  }

  /** Marca edición de usuario y refresca botones (no usar en hidratación/reapertura). */
  notifyDepositEdited(): void {
    this.markDepositDirty();
    this.refreshSendBlockedState();
    this.updateSaveButtonAvailability();
    this.updateSendButtonAvailability();
  }

  private hasMissingGpsCoordinate(): boolean {
    if (!this.userMustActivateGPS) {
      return false;
    }
    const coord = (this.deposit?.coordenada ?? '').toString().trim();
    return coord.length === 0;
  }

  private hasBankSelected(): boolean {
    return this.isSelectedBank
      && !!(this.deposit?.coBank?.trim())
      && !!(this.deposit?.nuAccount?.trim());
  }

  private hasNuDocumentFilled(): boolean {
    const doc = (this.nuDocument ?? this.deposit?.nuDocument ?? '').toString().trim();
    return doc.length > 0;
  }

  private hasDaDocumentFilled(): boolean {
    const date = (this.daDocument ?? this.deposit?.daDocument ?? '').toString().trim();
    return date.length > 0;
  }

  /**
   * Errores que bloquean Enviar: banco + cobros + plantilla (+ GPS si config).
   * Firma/adjuntos no son obligatorios: `signatureCollection` solo muestra el panel de firma.
   * (A diferencia de Cobros, no existe `requiredDepositAttachments`.)
   */
  public hasDepositFieldErrors(): boolean {
    if (!this.generalTabValidForSave || !this.hasBankSelected()) {
      return true;
    }
    if (!this.hasAtLeastOneDepositCollectRow()) {
      return true;
    }
    if (!this.hasNuDocumentFilled()) {
      return true;
    }
    if (!this.hasDaDocumentFilled()) {
      return true;
    }
    if (this.hasMissingGpsCoordinate()) {
      return true;
    }
    return false;
  }

  /** Guardar solo exige banco en General. Cobros/plantilla/GPS van en Enviar. */
  public hasDepositSaveErrors(): boolean {
    return !this.generalTabValidForSave || !this.hasBankSelected();
  }

  public getDepositSaveValidationMessage(): string {
    return this.depositTags.get('DEP_MSJ_ERROR_NO_BANK')
      ?? 'Seleccione un banco para continuar.';
  }

  public getDepositValidationMessage(): string {
    if (!this.generalTabValidForSave || !this.hasBankSelected()) {
      return this.depositTags.get('DEP_MSJ_ERROR_NO_BANK')
        ?? 'Seleccione un banco para continuar.';
    }
    if (!this.hasAtLeastOneDepositCollectRow()) {
      this.depositSendFocusMissingCollect = true;
      return this.depositTags.get('DEP_MSJ_ERROR_NO_COLLECT')
        ?? this.depositTags.get('DEP_SELECT_COB_DEP')
        ?? 'Seleccione al menos un cobro para el depósito.';
    }
    if (!this.hasNuDocumentFilled()) {
      return this.depositTags.get('DEP_MSJ_ERROR_NO_DOCUMENT')
        ?? 'Ingrese el número de plantilla para continuar.';
    }
    if (!this.hasDaDocumentFilled()) {
      return this.depositTags.get('DEP_MSJ_ERROR_NO_DATE')
        ?? 'Ingrese la fecha del documento para continuar.';
    }
    if (this.hasMissingGpsCoordinate()) {
      return this.depositTags.get('DEP_MSJ_ERROR_NO_GPS')
        ?? 'Debe activar el GPS y obtener la ubicación antes de continuar.';
    }
    return this.depositTags.get('DEP_MSJ_ERROR_NO_COLLECT')
      ?? 'Complete los campos obligatorios del depósito.';
  }

  /**
   * Pestaña del primer error (misma prioridad que getDepositValidationMessage).
   * Null = sin errores de Enviar (SEND-TAB-001: no pintar General en rojo ni saltar).
   */
  public resolveSendValidationFocusTab(): 'default' | 'cobros' | 'total' | 'adjuntos' | null {
    if (!this.generalTabValidForSave || !this.hasBankSelected()) {
      return 'default';
    }
    if (!this.hasAtLeastOneDepositCollectRow()) {
      return 'cobros';
    }
    if (!this.hasNuDocumentFilled() || !this.hasDaDocumentFilled()) {
      return 'default';
    }
    if (this.hasMissingGpsCoordinate()) {
      return 'default';
    }
    return null;
  }

  public requestSendValidationTabFocus(
    tab?: 'default' | 'cobros' | 'total' | 'adjuntos' | null,
  ): void {
    const focus = tab === undefined ? this.resolveSendValidationFocusTab() : tab;
    if (focus == null) {
      return;
    }
    this.focusSendValidationTab.next(focus);
  }

  /** Al menos una fila en `deposit_collects` cargada/seleccionada (requisito para Enviar). */
  hasAtLeastOneDepositCollectRow(): boolean {
    return !!(this.deposit?.depositCollect && this.deposit.depositCollect.length > 0);
  }

  markDepositDirty(): void {
    this.depositDirtySincePersist = true;
  }

  /** Tras INSERT/REPLACE exitoso o envío persistido en esta pantalla. */
  applyPersistSucceededBaseline(): void {
    this.depositDirtySincePersist = false;
    this.depositPersistedBaseline = true;
    this.updateSaveButtonAvailability();
    this.updateSendButtonAvailability();
  }

  /** Depósito nuevo en pantalla (aún sin guardar en esta sesión). */
  resetDepositExitBaseline(): void {
    this.depositPersistedBaseline = false;
    this.depositDirtySincePersist = false;
    this.updateSaveButtonAvailability();
    this.updateSendButtonAvailability();
  }

  /** Depósito abierto desde lista: ya existe en BD, sin edits locales aún. Llamar al cerrar init de apertura. */
  markDepositOpenedFromPersistedCopy(): void {
    this.depositPersistedBaseline = true;
    this.depositDirtySincePersist = false;
    this.updateSaveButtonAvailability();
    this.updateSendButtonAvailability();
  }

  private resetDepositValidationUxFlags(): void {
    this.generalTabValidForSave = false;
    this.sendValidationAttempted = false;
    this.sendBlockedByFields = false;
    this.depositSendFocusMissingCollect = false;
  }

  initServices(dbServ: SQLiteObject) {
    this.resetDepositValidationUxFlags();
    this.enterpriseServ.setup(dbServ).then(() => {
      this.hideDeposit = false;
      this.depositValid = false;
      this.enterpriseList = this.enterpriseServ.empresas;
      this.enterpriseSelected = this.enterpriseList[0];
      this.parteDecimal = Number(this.globalConfig.get('parteDecimal'));
      this.disabledEnterprise = this.globalConfig.get('enterpriseEnabled') === 'true' ? false : true;
      this.disabledCurrency = this.globalConfig.get('multiCurrency') === 'true' ? false : true;
      this.userMustActivateGPS = this.globalConfig.get("userMustActivateGPS").toLowerCase() === 'true';
      if (this.globalConfig.get("currencyModule") == "true" ? true : false) {
        this.currencyModule = this.currencyServices.getCurrencyModule("dep");
        this.localCurrencyDefault = this.currencyModule.localCurrencyDefault.toString() === 'true' ? true : false;
        this.showConversion = this.currencyModule.showConversion.toString() === 'true' ? true : false;
        this.disabledCurrency = this.currencyModule.currencySelector.toString() === "true" ? false : true;

      }


      this.deposit = {
        idUser: Number(localStorage.getItem("idUser")),
        coUser: localStorage.getItem("coUser")!,
        idDeposit: null,
        coDeposit: this.dateServ.generateCO(0),
        daDeposit: this.dateDeposit,
        coBank: "",
        nuAccount: "",
        nuDocument: "",
        daDocument: this.daDocument,
        nuAmountDoc: 0,
        nuAmountDocConversion: 0,
        coCurrency: "",
        idEnterprise: this.enterpriseSelected.idEnterprise,
        coEnterprise: this.enterpriseSelected.coEnterprise,
        txComment: "",
        nuValueLocal: 0,
        idCurrency: 0,
        stDeposit: DEPOSITO_STATUS_NEW,
        stDelivery: DEPOSITO_STATUS_NEW,
        isEdit: true,
        isEditTotal: false,
        isSave: false,
        coordenada: this.coordenadas,
        collectionIds: [],
        depositCollect: [] as DepositCollect[]
      }

      this.resetDepositExitBaseline();

      this.onDepositGeneralValid(false);

      this.getCurrencies(dbServ, this.deposit.idEnterprise).then(resp => {
        this.getBankAccounts(dbServ, this.deposit.idEnterprise, this.currencySelected.coCurrency).then(resp => {
          //ya tengo todo para iniciar el deposito
          this.getAllCollectsToDeposit(dbServ, this.deposit.coCurrency, this.deposit.idEnterprise).then(resp1 => {
            this.getAllCollectsAnticipoToDeposit(dbServ, this.deposit.coCurrency, this.deposit.idEnterprise).then(resp2 => {
              console.log(resp1.length);
              console.log(resp2.length);
            })
          })
        })
      })
    })
  }

  initOpenDeposit(dbServ: SQLiteObject) {
    return this.enterpriseServ.setup(dbServ).then(() => {
      this.parteDecimal = Number(this.globalConfig.get('parteDecimal'));
      this.syncFormFieldsFromDeposit();
      this.bankSelected = {} as BankAccount;
      this.depositValid = false;
      this.enterpriseList = this.enterpriseServ.empresas;
      this.enterpriseSelected = this.enterpriseList[0];
      this.isSelectedBank = true;
      this.onDepositGeneralValid(true);

      return this.getCurrencies(dbServ, this.deposit.idEnterprise).then(resp => {
        for (var i = 0; i < this.currencyList.length; i++) {
          if (this.currencyList[i].idCurrency == this.deposit.idCurrency) {
            this.currencySelected = this.currencyList[i];
            i = this.currencyList.length;
            break;
          }
        }
        return this.getBankAccounts(dbServ, this.deposit.idEnterprise, this.currencySelected.coCurrency).then(resp => {
          //ya tengo todo para iniciar el deposito
          for (var i = 0; i < this.bankList.length; i++) {
            if (this.bankList[i].coBank == this.deposit.coBank) {
              this.bankSelected = this.bankList[i];
              i = this.bankList.length;
              break;
            }
          }

          return this.finalizeConversionAfterOpen(dbServ).then(() => {
            this.markDepositOpenedFromPersistedCopy();
            return true;
          });
          /* this.getAllCollectsToDeposit(this.deposit.coCurrency).then(resp1 => {
            this.getAllCollectsAnticipoToDeposit(this.deposit.coCurrency).then(resp2 => {
              return Promise.resolve(true)
            })
          }) */
        });
      })
    })
  }

  updateBankAccounts(dbServ: SQLiteObject) {
    return this.getBankAccounts(dbServ, this.deposit.idEnterprise, this.currencySelected.coCurrency).then(resp => {
      //ya tengo todo para iniciar el deposito
      for (var i = 0; i < this.bankList.length; i++) {
        if (this.bankList[i].coBank == this.deposit.coBank) {
          this.bankSelected = this.bankList[i];
          i = this.bankList.length;
          break;
        }
      }

      return Promise.resolve(true);
      /* this.getAllCollectsToDeposit(this.deposit.coCurrency).then(resp1 => {
        this.getAllCollectsAnticipoToDeposit(this.deposit.coCurrency).then(resp2 => {
          return Promise.resolve(true)
        })
      }) */
    })
  }

  resetDeposit() {
    this.depositValid = false;
    this.generalTabValidForSave = false;
    this.enterpriseList = this.enterpriseServ.empresas;
    this.enterpriseSelected = this.enterpriseList[0];
    this.parteDecimal = Number(this.globalConfig.get('parteDecimal'));
    this.disabledEnterprise = this.globalConfig.get('enterpriseEnabled') === 'true' ? false : true;
    this.disabledCurrency = this.globalConfig.get('multiCurrency') === 'true' ? false : true;
    this.userMustActivateGPS = this.globalConfig.get("userMustActivateGPS").toLowerCase() === 'true';

    this.deposit = {
      idUser: Number(localStorage.getItem("idUser")),
      coUser: localStorage.getItem("coUser")!,
      idDeposit: null,
      coDeposit: this.dateServ.generateCO(0),
      daDeposit: this.dateDeposit,
      coBank: "",
      nuAccount: "",
      nuDocument: "",
      daDocument: this.daDocument,
      nuAmountDoc: 0,
      nuAmountDocConversion: 0,
      coCurrency: "",
      idEnterprise: this.enterpriseSelected.idEnterprise,
      coEnterprise: this.enterpriseSelected.coEnterprise,
      txComment: "",
      nuValueLocal: 0,
      idCurrency: 0,
      stDeposit: DEPOSITO_STATUS_NEW,
      stDelivery: DEPOSITO_STATUS_NEW,
      isEdit: true,
      isEditTotal: false,
      isSave: false,
      coordenada: this.coordenadas,
      collectionIds: [],
      depositCollect: [] as DepositCollect[]
    }

    this.resetDepositExitBaseline();

    this.nuDocument = '';
    this.txComment = '';
    this.cobrosDetails = [] as CollectDeposit[];
    this.bankList = [] as BankAccount[];
    this.bankSelected = {} as BankAccount;
    this.isSelectedBank = false;

    this.onDepositGeneralValid(false);

    return Promise.resolve(true);
  }


  convertirMonto(monto: number): string {
    if (!this.isMultiCurrencyEnabled()) {
      return monto.toFixed(this.parteDecimal);
    }
    const nu = Number(this.deposit?.nuValueLocal ?? 0);
    if (!Number.isFinite(nu) || nu <= 0) {
      return (0).toFixed(this.parteDecimal);
    }
    const co = String(this.deposit?.coCurrency ?? '').trim();
    if (!co) {
      return (0).toFixed(this.parteDecimal);
    }
    let converted: number;
    if (this.currencyServices.isLocalCurrency(co)) {
      converted = this.currencyServices.toHardCurrencyByNuValueLocal(monto, nu);
    } else if (this.currencyServices.isHardCurrency(co)) {
      converted = this.currencyServices.toLocalCurrencyByNuValueLocal(monto, nu);
    } else {
      const localCo = String(this.currencyServices.getLocalCurrency()?.coCurrency ?? '');
      converted =
        localCo && co === localCo
          ? this.currencyServices.toHardCurrencyByNuValueLocal(monto, nu)
          : this.currencyServices.toLocalCurrencyByNuValueLocal(monto, nu);
    }
    if (!Number.isFinite(converted)) {
      converted = 0;
    }
    return converted.toFixed(this.parteDecimal);
  }

  totalizarDeposito() {
    this.deposit.nuAmountDoc = 0;
    this.deposit.nuAmountDocConversion = 0;
    let total = 0;
    if (this.deposit && Array.isArray(this.deposit.depositCollect)) {
      for (const dc of this.deposit.depositCollect) {
        const val = Number((dc as any).nuTotalDeposit ?? (dc as any).nu_total_deposit ?? 0);
        total += isNaN(val) ? 0 : val;
      }
    }

    const factor = Math.pow(10, Number(this.parteDecimal ?? 2));
    this.deposit.nuAmountDoc = Math.round(total * factor) / factor;
    //this.nuAmountDoc = this.deposit.nuAmountDoc;

    if (!this.isMultiCurrencyEnabled()) {
      this.deposit.nuAmountDocConversion = 0;
      return;
    }

    // convertir y guardar la conversión tanto en el objeto deposit como en la variable de servicio
    const conv = Number(this.convertirMonto(this.deposit.nuAmountDoc));
    this.deposit.nuAmountDocConversion =
      Number.isFinite(conv) && !isNaN(conv) ? conv : 0;
    //this.nuAmountDocConversion = this.deposit.nuAmountDocConversion;
  }

  //querys

  getCurrencies(dbServ: SQLiteObject, idEnterprise: number) {
    this.database = dbServ
    return this.database.executeSql('SELECT ' +
      'id_currency_enterprise as idCurrencyEnterprise, ' +
      'id_currency as idCurrency, ' +
      'co_currency as coCurrency, ' +
      'local_currency as localCurrency, ' +
      'hard_currency as hardCurrency, ' +
      'co_enterprise as coEnterprise, ' +
      'id_enterprise as idEnterprise ' +
      'FROM currency_enterprises WHERE id_enterprise = ?',
      [idEnterprise]).then(data => {
        this.currencyList = [] as Currencies[];
        const isTrue = (v: any) => v === true || String(v ?? '').toLowerCase() === 'true';
        const currencyModuleEnabled = isTrue(this.globalConfig.get('currencyModule'));
        for (let i = 0; i < data.rows.length; i++) {
          const item = data.rows.item(i);
          //currencies.push(item);
          this.currencyList.push(item);
          if (!currencyModuleEnabled) {
            if (this.enterpriseSelected.coCurrencyDefault == item.coCurrency) {
              this.currencySelected = item;
              this.deposit.idCurrency = item.idCurrency;
              this.deposit.coCurrency = item.coCurrency;
            } else {
              this.currencyConversion = item;
            }
          }
        }

        if (currencyModuleEnabled) {
          const savedCo = String(this.deposit?.coCurrency ?? '').trim();
          let selectedCurrency: typeof this.currencyList[number] | undefined;
          if (savedCo.length > 0) {
            selectedCurrency = this.currencyList.find(c => String(c?.coCurrency ?? '').trim() === savedCo);
          }
          if (!selectedCurrency) {
            if (this.localCurrencyDefault) {
              selectedCurrency = this.currencyList.find(
                c =>
                  ((c?.coCurrency ?? '').toString() === this.currencyServices.getLocalCurrency().coCurrency));
            } else {
              selectedCurrency = this.currencyList.find(
                c =>
                  ((c?.coCurrency ?? '').toString() === this.currencyServices.getHardCurrency().coCurrency));
            }
          }
          this.currencySelected = selectedCurrency!;
          this.deposit.idCurrency = selectedCurrency!.idCurrency;
          this.deposit.coCurrency = selectedCurrency!.coCurrency;
        }
        return Promise.resolve(true);
      }).catch(e => {
        console.log(e);
      })
  }

  getBankAccounts(dbServ: SQLiteObject, idEnterprise: number, coCurrency: string) {
    let selectStatement = 'SELECT ' +
      'bank_accounts.id_bank_account as idBankAccount,' +
      'bank_accounts.co_bank as coBank,' +
      'bank_accounts.id_bank as idBank,' +
      'bank_accounts.co_account as coAccount,' +
      'bank_accounts.nu_account as nuAccount,' +
      'bank_accounts.co_type as coType,' +
      'bank_accounts.co_currency as coCurrency,' +
      'bank_accounts.id_currency as idCurrency,' +
      'bank_accounts.co_enterprise as coEnterprise,' +
      'bank_accounts.id_enterprise as idEnterprise,' +
      'banks.na_bank as naBank ' +
      'FROM bank_accounts, banks ' +
      'WHERE bank_accounts.id_enterprise = ? ' +
      'AND bank_accounts.co_currency = ? ' +
      'AND bank_accounts.co_bank = banks.co_bank ' +
      'AND banks.id_enterprise = ?';
    this.database = dbServ;
    return this.database.executeSql(selectStatement,
      [idEnterprise, coCurrency, idEnterprise]).then(data => {
        this.bankList = [] as BankAccount[];
        for (let i = 0; i < data.rows.length; i++) {
          const item = data.rows.item(i);
          //currencies.push(item);
          this.bankList.push(item);
        }
        return Promise.resolve(true);
      }).catch(e => {
        console.log(e);
      })
  }


  getAllCollectsToDeposit(dbServ: SQLiteObject, coCurrency: string, idEnterprise?: number) {
    this.database = dbServ;
    const enterpriseId = Number(idEnterprise ?? this.deposit?.idEnterprise ?? 0);
    /*  let selectStatement = "SELECT DISTINCT(c.co_collection), c.*, cd.co_document, " +
       " (SELECT SUM(cp2.nu_amount_partial) FROM collection_payments cp2 WHERE cp2.co_collection =" +
       " c.co_collection AND cp2.co_payment_method <> 'de' AND cp2.co_payment_method <> 'tr' AND cp2.co_payment_method <> 'ot') as total_deposit," +
       " (SELECT SUM(cp2.nu_amount_partial_conversion) FROM collection_payments cp2 WHERE cp2.co_collection =" +
       " c.co_collection AND cp2.co_payment_method <> 'de' AND cp2.co_payment_method <> 'tr' AND cp2.co_payment_method <> 'ot') as total_deposit_conversion" +
       " FROM collections c, collection_payments cp LEFT OUTER JOIN collection_details cd ON c.co_collection = cd.co_collection" +
       " WHERE c.co_currency = ? AND c.st_collection <> 0 AND c.co_collection = cp.co_collection AND cp.co_payment_method <> 'de'" +
       " AND cp.co_payment_method <> 'tr' AND cd.co_type_doc <> 'CR' and c.id_collection <> 0" +
       " AND c.co_collection NOT IN (SELECT dc.co_collection FROM deposit_collects dc) GROUP BY c.co_collection"; */

    const depositPaymentMethods = DepositService.DEPOSIT_PAYMENT_METHODS_SQL;
    let selectStatement =
      "SELECT DISTINCT(c.co_collection), c.*, cd.co_document, " +
      " (SELECT SUM(cp2.nu_amount_partial) FROM collection_payments cp2 WHERE cp2.co_collection = c.co_collection AND cp2.co_payment_method IN " + depositPaymentMethods + ") AS total_deposit, " +
      " (SELECT SUM(cp2.nu_amount_partial_conversion) FROM collection_payments cp2 WHERE cp2.co_collection = c.co_collection AND cp2.co_payment_method IN " + depositPaymentMethods + ") AS total_deposit_conversion " +
      " FROM collections c " +
      " JOIN collection_payments cp ON c.co_collection = cp.co_collection " +
      " LEFT OUTER JOIN collection_details cd ON c.co_collection = cd.co_collection " +
      " WHERE c.co_currency = ? AND c.id_enterprise = ? AND c.st_delivery <> 0 " +
      " AND cp.co_payment_method IN " + depositPaymentMethods + " " +
      " AND cd.co_type_doc <> 'CR' AND c.id_collection <> 0 " +
      " AND " + DepositService.DEPOSIT_COLLECTS_BLOCKING_SUBQUERY + " " +
      " GROUP BY c.co_collection ORDER BY c.co_collection DESC";

    return this.database.executeSql(selectStatement,
      [coCurrency, enterpriseId]).then(data => {
        this.cobrosDetails = [] as CollectDeposit[];
        for (var i = 0; i < data.rows.length; i++) {
          const item = data.rows.item(i);
          item.da_collection = this.normalizeDaDeposit(item.da_collection)
          this.cobrosDetails.push(item);
        }
        return Promise.resolve(data.rows);
      }).catch(e => {
        console.log(e);
      })
  }

  getAllCollectsAnticipoToDeposit(dbServ: SQLiteObject, coCurrency: string, idEnterprise?: number) {
    this.database = dbServ
    const enterpriseId = Number(idEnterprise ?? this.deposit?.idEnterprise ?? 0);
   /*  let selectStatement = "SELECT DISTINCT(c.co_collection), c.*, (SELECT SUM(cp2.nu_amount_partial) FROM collection_payments cp2 WHERE " +
      "cp2.co_collection = c.co_collection AND cp2.co_payment_method <> 'de' AND cp2.co_payment_method <> 'tr' AND cp2.co_payment_method <> 'ot') as total_deposit " +
      "FROM collections c, collection_payments cp " +
      "WHERE c.co_currency = ? AND c.st_collection <> 0 AND c.co_collection = cp.co_collection AND cp.co_payment_method <> 'de' " +
      "AND cp.co_payment_method <> 'tr' AND c.id_collection <> 0 AND c.co_type = '1' " +
      "AND c.co_collection NOT IN (SELECT dc.co_collection FROM deposit_collects dc) GROUP BY c.co_collection"; */

    const depositPaymentMethods = DepositService.DEPOSIT_PAYMENT_METHODS_SQL;
    let selectStatement =
      "SELECT c.co_collection, c.*, " +
      "  (SELECT SUM(cp2.nu_amount_partial) " +
      "   FROM collection_payments cp2 " +
      "   WHERE cp2.co_collection = c.co_collection " +
      "     AND cp2.co_payment_method IN " + depositPaymentMethods + ") AS total_deposit, " +
      "  (SELECT SUM(cp2.nu_amount_partial_conversion) " +
      "   FROM collection_payments cp2 " +
      "   WHERE cp2.co_collection = c.co_collection " +
      "     AND cp2.co_payment_method IN " + depositPaymentMethods + ") AS total_deposit_conversion " +
      "FROM collections c " +
      "INNER JOIN collection_payments cp ON c.co_collection = cp.co_collection " +
      "WHERE c.co_currency = ? " +
      "  AND c.id_enterprise = ? " +
      "  AND c.st_collection <> 0 " +
      "  AND cp.co_payment_method IN " + depositPaymentMethods + " " +
      "  AND c.id_collection <> 0 " +
      "  AND c.co_type = '1' " +
      "  AND " + DepositService.DEPOSIT_COLLECTS_BLOCKING_SUBQUERY + " " +
      "GROUP BY c.co_collection";

    return this.database.executeSql(selectStatement,
      [coCurrency, enterpriseId]).then(data => {
        for (var i = 0; i < data.rows.length; i++) {
          const item = data.rows.item(i);
          item.da_collection = this.normalizeDaDeposit(item.da_collection)
          this.cobrosDetails.push(item);
        }
        return Promise.resolve(data.rows);
      }).catch(e => {
        console.log(e);
      })
  }

  deleteDepositsBatch(dbServ: SQLiteObject, deposits: Deposit[]) {
    let queries: any[] = [];
    const deleteStatement = "DELETE FROM deposits WHERE co_deposit = ?";
    const deleteDetailsStatement = "DELETE FROM deposit_collects WHERE co_deposit = ?";

    for (let i = 0; i < deposits.length; i++) {
      let coDeposit = deposits[i].coDeposit;
      queries.push([deleteDetailsStatement, [coDeposit]]);
      queries.push([deleteStatement, [coDeposit]]);
    }
    return dbServ.sqlBatch(queries).then(() => {
      console.log("[Deposit Service] deleteDepositsBatch exitoso");
    }).catch(error => {
      console.log("[Deposit Service] Error al ejecutar deleteDepositsBatch.");
      console.log(error);
    });
  }

  /**
   * Antes de aplicar sync: conserva cobros vinculados y estados locales de depósitos
   * guardados o pendientes de envío que el servidor aún no refleja por completo.
   */
  mergeSyncedDepositsWithLocal(dbServ: SQLiteObject, deposits: Deposit[]): Promise<Deposit[]> {
    if (!Array.isArray(deposits) || deposits.length === 0) {
      return Promise.resolve(deposits);
    }

    const coDeposits = deposits
      .map((item) => this.normalizeSyncedDeposit(item).coDeposit?.trim())
      .filter((coDeposit): coDeposit is string => !!coDeposit);

    if (coDeposits.length === 0) {
      return Promise.resolve(deposits.map((item) => this.normalizeSyncedDeposit(item)));
    }

    const placeholders = coDeposits.map(() => '?').join(',');
    const loadLocalDeposits = dbServ.executeSql(
      `SELECT co_deposit, da_deposit, st_deposit, st_delivery, id_deposit
       FROM deposits WHERE co_deposit IN (${placeholders})`,
      coDeposits,
    );
    const loadLocalCollects = dbServ.executeSql(
      `SELECT id_deposit_collect, co_deposit_collect, co_deposit, co_collection,
              id_collection, co_document, nu_amount_total, nu_total_deposit
       FROM deposit_collects WHERE co_deposit IN (${placeholders})`,
      coDeposits,
    );

    return Promise.all([loadLocalDeposits, loadLocalCollects]).then(([depRes, colRes]) => {
      const localDepositByCo = new Map<string, {
        daDeposit: string;
        stDeposit: number;
        stDelivery: number;
        idDeposit: number | null;
      }>();

      for (let i = 0; i < depRes.rows.length; i++) {
        const row = depRes.rows.item(i);
        localDepositByCo.set(String(row.co_deposit), {
          daDeposit: row.da_deposit ?? '',
          stDeposit: Number(row.st_deposit ?? 0),
          stDelivery: Number(row.st_delivery ?? 0),
          idDeposit: row.id_deposit ?? null,
        });
      }

      const collectsByCo = new Map<string, DepositCollect[]>();
      for (let i = 0; i < colRes.rows.length; i++) {
        const row = colRes.rows.item(i);
        const coDeposit = String(row.co_deposit);
        const list = collectsByCo.get(coDeposit) ?? [];
        list.push(this.mapLocalDepositCollectRow(row));
        collectsByCo.set(coDeposit, list);
      }

      return deposits.map((raw) => {
        const deposit = this.normalizeSyncedDeposit(raw);
        const local = localDepositByCo.get(deposit.coDeposit);
        const localCollects = collectsByCo.get(deposit.coDeposit) ?? [];

        if (local) {
          const localDaDeposit = (local.daDeposit ?? '').trim();
          if (localDaDeposit.length > 0 && !(deposit.daDeposit ?? '').trim()) {
            deposit.daDeposit = localDaDeposit;
          }

          const isLocalUnsynced =
            local.stDeposit === this.DEPOSITO_STATUS_SAVED ||
            local.stDeposit === this.DEPOSITO_STATUS_TO_SEND;
          const serverHasNoId = deposit.idDeposit == null || Number(deposit.idDeposit) === 0;

          if (isLocalUnsynced && serverHasNoId) {
            deposit.stDeposit = local.stDeposit;
            deposit.stDelivery = local.stDelivery;
            if (local.idDeposit != null && Number(local.idDeposit) > 0) {
              deposit.idDeposit = local.idDeposit;
            }
          }

          // Si ya quedó rechazado por transaction_statuses, no dejar que sync de deposits lo pise.
          const localRejected = this.isDepositRejectedForCollectRelease(
            local.stDeposit,
            local.stDelivery,
            local.idDeposit,
          );
          const serverRejected = this.isDepositRejectedForCollectRelease(
            Number(deposit.stDeposit ?? 0),
            Number(deposit.stDelivery ?? 0),
            deposit.idDeposit,
          );
          if (localRejected && !serverRejected) {
            deposit.stDeposit = DEPOSIT_APPROVAL_STATUS_REJECTED;
            deposit.stDelivery = DEPOSITO_STATUS_SENT;
            if (local.idDeposit != null && Number(local.idDeposit) > 0) {
              deposit.idDeposit = local.idDeposit;
            }
          }
        }

        if (!this.hasSyncCollectPayload(deposit) && localCollects.length > 0) {
          deposit.depositCollect = localCollects;
        }

        return deposit;
      });
    }).catch((error) => {
      console.log('[DepositService] mergeSyncedDepositsWithLocal error', error);
      return deposits.map((item) => this.normalizeSyncedDeposit(item));
    });
  }

  /** No borra depósitos que aún están en la cola de envío pendiente. */
  filterAndDeleteDepositsByServerIds(dbServ: SQLiteObject, ids: number[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) {
      return Promise.resolve();
    }

    const placeholders = ids.map(() => '?').join(',');
    const selectSafeIds = `
      SELECT d.id_deposit, d.co_deposit
      FROM deposits d
      WHERE d.id_deposit IN (${placeholders})
        AND NOT EXISTS (
          SELECT 1 FROM pending_transactions pt
          WHERE pt.co_transaction = d.co_deposit AND pt.type = 'deposit'
        )`;

    return dbServ.executeSql(selectSafeIds, ids).then((result) => {
      if (result.rows.length === 0) {
        return;
      }

      const safeIds: number[] = [];
      const safeCoDeposits: string[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        safeIds.push(Number(row.id_deposit));
        safeCoDeposits.push(String(row.co_deposit));
      }

      const coPlaceholders = safeCoDeposits.map(() => '?').join(',');
      const idPlaceholders = safeIds.map(() => '?').join(',');

      return dbServ.executeSql(
        `DELETE FROM deposit_collects WHERE co_deposit IN (${coPlaceholders})`,
        safeCoDeposits,
      ).then(() =>
        dbServ.executeSql(
          `DELETE FROM deposits WHERE id_deposit IN (${idPlaceholders})`,
          safeIds,
        ),
      );
    }).catch((error) => {
      console.log('[DepositService] filterAndDeleteDepositsByServerIds error', error);
    });
  }

  async saveDepositBatch(dbServ: SQLiteObject, deposits: Deposit[]) {
    this.database = dbServ;

    const insertDeposit = 'INSERT OR REPLACE INTO deposits (' +
      'id_deposit,' +
      'co_deposit,' +
      'da_deposit,' +
      'co_bank,' +
      'nu_account,' +
      'nu_document, ' +
      'da_document, ' +
      'nu_amount_doc, ' +
      'co_currency, ' +
      'id_enterprise, ' +
      'co_enterprise, ' +
      'st_deposit, ' +
      'st_delivery, ' +
      'tx_comment, ' +
      'nu_amount_doc_conversion, ' +
      'nu_value_local, ' +
      'id_currency,' +
      'coordenada' +
      ') VALUES (' +
      '?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

    const insertDepositCollect = 'INSERT OR REPLACE INTO deposit_collects (' +
      'id_deposit_collect,' +
      'co_deposit_collect,' +
      'co_deposit,' +
      'co_collection, ' +
      'id_collection, ' +
      'co_document, ' +
      'nu_amount_total, ' +
      'nu_total_deposit' +
      ') VALUES (' +
      '?,?,?,?,?,?,?,?)';

    const deleteCollectsStatement = 'DELETE FROM deposit_collects WHERE co_deposit = ?';
    const allQueries: [string, unknown[]][] = [];

    for (const rawDeposit of deposits) {
      const deposit = this.normalizeSyncedDeposit(rawDeposit);
      const nuPersist = this.resolveNuAmountDocConversionForPersist(deposit.nuAmountDocConversion);
      deposit.nuAmountDocConversion = nuPersist;

      allQueries.push([insertDeposit, [
        deposit.idDeposit,
        deposit.coDeposit,
        deposit.daDeposit,
        deposit.coBank,
        deposit.nuAccount,
        deposit.nuDocument,
        deposit.daDocument,
        deposit.nuAmountDoc,
        deposit.coCurrency,
        deposit.idEnterprise,
        deposit.coEnterprise,
        deposit.stDeposit,
        deposit.stDelivery,
        deposit.txComment,
        nuPersist,
        deposit.nuValueLocal,
        deposit.idCurrency,
        deposit.coordenada,
      ]]);

      const collects = await this.resolveDepositCollectsForPersist(dbServ, deposit);
      const syncedServerId = Number(deposit.idDeposit ?? 0) > 0;
      const shouldClearCollects =
        this.isDepositRejectedForCollectRelease(
          Number(deposit.stDeposit ?? 0),
          Number(deposit.stDelivery ?? 0),
          deposit.idDeposit,
        )
        || (collects.length === 0 && syncedServerId);

      if (shouldClearCollects) {
        allQueries.push([deleteCollectsStatement, [deposit.coDeposit]]);
      } else if (collects.length > 0) {
        allQueries.push([deleteCollectsStatement, [deposit.coDeposit]]);
        for (const collect of collects) {
          allQueries.push([insertDepositCollect, [
            collect.idDepositCollect ?? 0,
            collect.coDepositCollect || `${deposit.coDeposit}_${collect.coCollection}`,
            deposit.coDeposit,
            collect.coCollection,
            collect.idCollection,
            collect.coDocument,
            collect.nuAmountTotal,
            collect.nuTotalDeposit,
          ]]);
        }
      }
    }

    return dbServ.sqlBatch(allQueries).then(() => {
      return Promise.resolve(true);
    }).catch((e) => {
      console.log('Error al ejecutar saveDepositBatch:', e);
      return Promise.reject(e);
    });
  }

  private normalizeSyncedDeposit(raw: Deposit | Record<string, unknown>): Deposit {
    const source = raw as Record<string, unknown>;
    const hasCamelCase = typeof source['coDeposit'] === 'string';
    const deposit = hasCamelCase
      ? { ...(raw as Deposit) }
      : Deposit.depositJson(raw as Deposit);

    const rawCollects =
      source['depositCollect'] ??
      source['deposit_collect'] ??
      source['depositCollects'] ??
      [];

    if (Array.isArray(rawCollects) && rawCollects.length > 0) {
      deposit.depositCollect = rawCollects.map((item) => {
        const collect = item as Record<string, unknown>;
        return collect['coCollection']
          ? (item as DepositCollect)
          : DepositCollect.depositCollectJson(item as DepositCollect);
      });
    }

    const rawCollectionIds = source['collectionIds'] ?? source['collection_ids'];
    if (Array.isArray(rawCollectionIds)) {
      deposit.collectionIds = rawCollectionIds as number[];
    }

    return deposit;
  }

  private hasSyncCollectPayload(deposit: Deposit): boolean {
    return (
      (Array.isArray(deposit.depositCollect) && deposit.depositCollect.length > 0) ||
      (Array.isArray(deposit.collectionIds) && deposit.collectionIds.length > 0)
    );
  }

  private mapLocalDepositCollectRow(row: Record<string, unknown>): DepositCollect {
    return {
      idDepositCollect: Number(row['id_deposit_collect'] ?? 0),
      coDepositCollect: String(row['co_deposit_collect'] ?? ''),
      coDeposit: String(row['co_deposit'] ?? ''),
      coCollection: String(row['co_collection'] ?? ''),
      idCollection: Number(row['id_collection'] ?? 0),
      coDocument: String(row['co_document'] ?? ''),
      nuAmountTotal: Number(row['nu_amount_total'] ?? 0),
      nuTotalDeposit: Number(row['nu_total_deposit'] ?? 0),
      st: 0,
      isSave: true,
      lbClient: '',
      daCollection: '',
    };
  }

  private async resolveDepositCollectsForPersist(
    dbServ: SQLiteObject,
    deposit: Deposit,
  ): Promise<DepositCollect[]> {
    if (Array.isArray(deposit.depositCollect) && deposit.depositCollect.length > 0) {
      return deposit.depositCollect.map((collect) => ({
        ...collect,
        coDeposit: deposit.coDeposit,
      }));
    }

    if (!Array.isArray(deposit.collectionIds) || deposit.collectionIds.length === 0) {
      return [];
    }

    const placeholders = deposit.collectionIds.map(() => '?').join(',');
    const selectCollections = `
      SELECT c.co_collection as coCollection,
             c.id_collection as idCollection,
             c.nu_amount_total as nuAmountTotal,
             c.nu_amount_final as nuAmountFinal,
             cd.co_document as coDocument
      FROM collections c
      JOIN collection_details cd ON c.co_collection = cd.co_collection
      WHERE c.id_collection IN (${placeholders})`;

    try {
      const collectionsResult = await dbServ.executeSql(selectCollections, deposit.collectionIds);
      const collects: DepositCollect[] = [];
      for (let i = 0; i < collectionsResult.rows.length; i++) {
        const row = collectionsResult.rows.item(i);
        collects.push({
          idDepositCollect: 0,
          coDepositCollect: `${deposit.coDeposit}_${row.coCollection}`,
          coDeposit: deposit.coDeposit,
          coCollection: row.coCollection,
          idCollection: row.idCollection,
          coDocument: row.coDocument,
          nuAmountTotal: row.nuAmountTotal,
          nuTotalDeposit: row.nuAmountFinal,
          st: 0,
          isSave: true,
          lbClient: '',
          daCollection: '',
        });
      }
      return collects;
    } catch (e) {
      console.log('Error al consultar collections para deposit_collects:', e);
      return [];
    }
  }

  saveDeposit(dbServ: SQLiteObject, deposit: Deposit) {
    const nuPersist = this.resolveNuAmountDocConversionForPersist(deposit.nuAmountDocConversion);
    deposit.nuAmountDocConversion = nuPersist;

    let deleteStatementDeposit = 'DELETE FROM deposits WHERE co_deposit = ?';
    let deleteStatementDepositCollect = 'DELETE FROM deposit_collects WHERE co_deposit = ?';
    this.database.executeSql(deleteStatementDepositCollect, [deposit.coDeposit]);
    this.database.executeSql(deleteStatementDeposit, [deposit.coDeposit]);

    this.database = dbServ
    let insertStatement = 'INSERT OR REPLACE INTO deposits (' +
      'id_deposit,' +
      'co_deposit,' +
      'da_deposit,' +
      'co_bank,' +
      'nu_account,' +
      'nu_document, ' +
      'da_document, ' +
      'nu_amount_doc, ' +
      'co_currency, ' +
      'id_enterprise, ' +
      'co_enterprise, ' +
      'st_deposit, ' +
      'st_delivery, ' +
      'tx_comment, ' +
      'nu_amount_doc_conversion, ' +
      'nu_value_local, ' +
      'id_currency,' +
      'coordenada' +
      ') VALUES (' +
      '?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
    return this.database.executeSql(insertStatement,
      [
        0,
        deposit.coDeposit,
        deposit.daDeposit,
        deposit.coBank,
        deposit.nuAccount,
        deposit.nuDocument,
        deposit.daDocument,
        deposit.nuAmountDoc,
        deposit.coCurrency,
        deposit.idEnterprise,
        deposit.coEnterprise,
        deposit.stDeposit,
        deposit.stDelivery,
        deposit.txComment,
        nuPersist,
        deposit.nuValueLocal,
        deposit.idCurrency,
        deposit.coordenada
      ]
    ).then(data => {
      console.log("deposit INSERT", data);
      return this.saveDepositCollect(deposit.depositCollect).then(r => {
        return Promise.resolve(true);
      })
    }).catch(e => {
      console.log(e);
    })
  }

  saveDepositCollect(depositCollect: DepositCollect[]) {
    let statementsDepositCollects = [];
    let insertStatement = 'INSERT OR REPLACE INTO deposit_collects (' +
      'id_deposit_collect,' +
      'co_deposit_collect,' +
      'co_deposit,' +
      'co_collection, ' +
      'id_collection, ' +
      'co_document, ' +
      'nu_amount_total, ' +
      'nu_total_deposit' +
      ') VALUES (' +
      '?,?,?,?,?,?,?,?)';

    for (var i = 0; i < depositCollect.length; i++) {
      statementsDepositCollects.push([insertStatement, [
        0,
        depositCollect[i].coDepositCollect,
        depositCollect[i].coDeposit,
        depositCollect[i].coCollection,
        depositCollect[i].idCollection,
        depositCollect[i].coDocument,
        depositCollect[i].nuAmountTotal,
        depositCollect[i].nuTotalDeposit
      ]]);
    }

    return this.database.sqlBatch(statementsDepositCollects).then(res => {
      console.log("DEPOSIT_COLLECTS INSERT", res);
      return Promise.resolve(true);
    }).catch(e => {
      console.log(e);
    })
  }

  getDeposit(dbServ: SQLiteObject, coDeposit: string) {
    return dbServ.executeSql(
      'SELECT * FROM deposits WHERE co_deposit = ?', [coDeposit
    ]).then(res => {
      let deposit = {} as Deposit;
      if (res.rows.length > 0) {

        deposit.coDeposit = res.rows.item(0).co_deposit;
        deposit.daDeposit = res.rows.item(0).da_deposit;
        deposit.coBank = res.rows.item(0).co_bank;
        deposit.nuAccount = res.rows.item(0).nu_account;
        deposit.nuDocument = res.rows.item(0).nu_document;
        deposit.daDocument = res.rows.item(0).da_document;
        deposit.nuAmountDoc = res.rows.item(0).nu_amount_doc;
        deposit.nuAmountDocConversion = res.rows.item(0).nu_amount_doc_conversion;
        deposit.coCurrency = res.rows.item(0).co_currency;
        deposit.idEnterprise = res.rows.item(0).id_enterprise;
        deposit.coEnterprise = res.rows.item(0).co_enterprise;
        deposit.txComment = res.rows.item(0).tx_comment;
        deposit.nuValueLocal = res.rows.item(0).nu_value_local;
        deposit.idCurrency = res.rows.item(0).id_currency;
        deposit.stDeposit = res.rows.item(0).st_deposit;
        deposit.stDelivery = res.rows.item(0).st_delivery;
        deposit.isEdit = false;
        deposit.isEditTotal = false;
        deposit.isSave = false;
        deposit.coordenada = res.rows.item(0).coordenada;
        deposit.depositCollect = [] as DepositCollect[];

      }
      return deposit;
    }).catch(e => {
      let deposit = {} as Deposit;
      console.log(e);
      return deposit;
    })
  }

  /** Depósito persistido listo para POST (cabecera + cobros + estatus TO_SEND). */
  isDepositReadyForSend(deposit: Deposit | null | undefined): boolean {
    if (!deposit?.coDeposit?.trim()) {
      return false;
    }
    if (!String(deposit.coBank ?? '').trim() || !String(deposit.coCurrency ?? '').trim()) {
      return false;
    }
    const collectionIds = Array.isArray(deposit.collectionIds) ? deposit.collectionIds : [];
    const collects = Array.isArray(deposit.depositCollect) ? deposit.depositCollect : [];
    if (collectionIds.length === 0 && collects.length === 0) {
      return false;
    }
    return Number(deposit.stDelivery ?? 0) === this.DEPOSITO_STATUS_TO_SEND;
  }

  normalizeDepositSendStatuses(deposit: Deposit): void {
    const stDelivery = Number(deposit.stDelivery ?? 0);
    const stDeposit = Number(deposit.stDeposit ?? 0);
    if (stDelivery === this.DEPOSITO_STATUS_TO_SEND && stDeposit === this.DEPOSITO_STATUS_NEW) {
      deposit.stDeposit = this.DEPOSITO_STATUS_TO_SEND;
    }
  }

  async fetchDepositCollectRowsForSend(dbServ: SQLiteObject, coDeposit: string): Promise<DepositCollect[]> {
    try {
      const res = await dbServ.executeSql(
        'SELECT * FROM deposit_collects WHERE co_deposit = ?',
        [coDeposit],
      );
      const collects: DepositCollect[] = [];
      for (let i = 0; i < res.rows.length; i++) {
        collects.push(this.mapLocalDepositCollectRow(res.rows.item(i) as Record<string, unknown>));
      }
      return collects;
    } catch (e) {
      console.log('[fetchDepositCollectRowsForSend] error:', e);
      return [];
    }
  }

  async prepareDepositForSend(dbServ: SQLiteObject, coDeposit: string): Promise<Deposit | null> {
    const deposit = await this.getDeposit(dbServ, coDeposit);
    if (!deposit?.coDeposit?.trim()) {
      return null;
    }

    deposit.depositCollect = await this.fetchDepositCollectRowsForSend(dbServ, coDeposit);
    const rawIds = await this.getIdsDepositCollect(dbServ, coDeposit);
    deposit.collectionIds = Array.isArray(rawIds)
      ? rawIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];

    this.normalizeDepositSendStatuses(deposit);

    return this.isDepositReadyForSend(deposit) ? deposit : null;
  }

  getDepositCollect(dbServ: SQLiteObject, coDeposit: string) {
    /* Alias explícitos: SELECT * JOIN duplica nombres (co_collection, id_collection, ...) y SQLite/Cordova
       dejan un solo valor; además antes se reusaba una sola referencia DepositCollect en el bucle. */
    const selectStatement =
      'SELECT ' +
      'dc.id_deposit_collect AS dc_id_deposit_collect, ' +
      'dc.co_deposit_collect AS dc_co_deposit_collect, ' +
      'dc.co_deposit AS dc_co_deposit, ' +
      'dc.co_collection AS dc_co_collection, ' +
      'dc.id_collection AS dc_id_collection, ' +
      'dc.nu_amount_total AS dc_nu_amount_total, ' +
      'dc.nu_total_deposit AS dc_nu_total_deposit, ' +
      'dc.co_document AS dc_co_document, ' +
      'c.* ' +
      'FROM deposit_collects dc ' +
      'INNER JOIN collections c ON dc.co_collection = c.co_collection ' +
      'WHERE dc.co_deposit = ?';
    return dbServ.executeSql(selectStatement, [coDeposit]).then(res => {
      this.deposit == undefined ? this.deposit = {} as Deposit : null;
      this.deposit.depositCollect = [] as DepositCollect[];
      this.cobrosDetails = [] as CollectDeposit[];
      for (let i = 0; i < res.rows.length; i++) {
        const row = res.rows.item(i);
        const nuTotalDeposit = Number(row.dc_nu_total_deposit ?? 0);

        const depositCollect = {
          idDepositCollect: row.dc_id_deposit_collect,
          coDepositCollect: row.dc_co_deposit_collect ?? '',
          coDeposit: row.dc_co_deposit ?? '',
          coDocument: row.dc_co_document ?? '',
          nuAmountTotal: Number(row.dc_nu_amount_total ?? 0),
          nuTotalDeposit: Number.isFinite(nuTotalDeposit) ? nuTotalDeposit : 0,
          coCollection: row.dc_co_collection ?? '',
          idCollection: Number(row.dc_id_collection ?? 0),
          st: 0,
          isSave: true,
          lbClient: String(row.lb_client ?? ''),
          daCollection: this.normalizeDaDeposit(String(row.da_collection ?? '')),
        } as DepositCollect;
        this.deposit.depositCollect.push(depositCollect);

        const item = row as unknown as CollectDeposit;
        item.isSelected =
          this.deposit.stDelivery === this.DEPOSITO_STATUS_SAVED ||
          this.deposit.stDelivery === this.DEPOSITO_STATUS_SENT ||
          this.deposit.stDelivery == null;
        item.da_collection = this.normalizeDaDeposit(item.da_collection);
        item.total_deposit = nuTotalDeposit;
        item.inDepositCollect = true;
        this.cobrosDetails.push(item);
      }
      return this.deposit;
    }).catch(e => {
      this.deposit.depositCollect = [] as DepositCollect[];
      console.log(e);
      return this.deposit;
    });
  }

  getIdsDepositCollect(dbServ: SQLiteObject, coDeposit: string) {
    return dbServ.executeSql(
      'SELECT id_collection FROM deposit_collects WHERE co_deposit = ?', [coDeposit
    ]).then(res => {
      let collectionIds = [];
      for (var i = 0; i < res.rows.length; i++) {
        collectionIds.push(res.rows.item(i).id_collection)
      }
      //collection.idCollection = res.rows.item(0).id_collection;
      return collectionIds;


    }).catch(e => {
      console.log(e);
      return [] as number[];
    })
  }

  getAllDeposits(dbServ: SQLiteObject) {

    return dbServ.executeSql(
      'SELECT ' +
      'id_deposit as idDeposit, ' +
      'co_deposit as coDeposit, ' +
      'da_deposit as daDeposit, ' +
      'co_bank as coBank, ' +
      'id_bank as idBank, ' +
      'nu_account as nuAccount, ' +
      'nu_document as nuDocument, ' +
      'da_document as daDocument, ' +
      'nu_amount_doc as nuAmountDoc, ' +
      'id_currency as idCurrenty, ' +
      'co_currency as coCurrency,' +
      'id_enterprise as idEnterprise,' +
      'co_enterprise as coEnterprise,' +
      'st_deposit as stDeposit,' +
      'st_delivery as stDelivery,' +
      'tx_comment as txComment,' +
      'nu_value_local as nuValueLocal,' +
      'nu_amount_doc_conversion as nuAmountDocConversion,' +
      'coordenada as coordenada ' +
      'FROM deposits ORDER BY st_delivery DESC, da_deposit DESC, st_deposit ASC, id_deposit DESC ', []).then(async res => {
        let promises: Promise<void>[] = [];

        this.listDeposits = [] as Deposit[];
        this.itemListaDepositos = [] as ItemListaDepositos[];

        for (var i = 0; i < res.rows.length; i++) {
          const rawRow = res.rows.item(i);
          const item = { ...rawRow } as Deposit & Record<string, unknown>;
          item.nuDocument = this.readRowString(rawRow as Record<string, unknown>, ['nuDocument', 'nu_document']);
          item.txComment = this.readRowString(rawRow as Record<string, unknown>, ['txComment', 'tx_comment']);
          const rawAmt =
            Number((rawRow as Record<string, unknown>)['nuAmountDoc'] ??
              (rawRow as Record<string, unknown>)['nu_amount_doc']);
          item.nuAmountDoc = Number.isFinite(rawAmt) ? rawAmt : 0;
          this.listDeposits.push(item);
          let p = this.historyTransaction.getStatusTransaction(dbServ, 6, item.idDeposit!).then(status => {
            const itemListaDeposit: ItemListaDepositos = {
              idDeposit: item.idDeposit ?? 0,
              coDeposit: item.coDeposit,
              stDeposit: item.stDeposit,
              stDelivery: item.stDelivery,
              daDeposit: this.normalizeDaDeposit(item.daDeposit),
              naStatus: typeof status === 'object' && status != null
                ? String((status as { na_status?: string }).na_status ?? '')
                : '',
              nuAmountDoc: item.nuAmountDoc.toFixed(this.parteDecimal),
              coCurrency: item.coCurrency,
              coBank: item.coBank
            };
            this.itemListaDepositos.push(itemListaDeposit);
          });

          promises.push(p);

        }
        await Promise.all(promises);

        return this.listDeposits;
      }).catch(e => {
        this.listDeposits = [] as Deposit[];
        console.log(e);
        return this.listDeposits;
      })
  }

  deleteDeposit(dbServ: SQLiteObject, coDeposit: string) {
    return dbServ.executeSql(
      'DELETE FROM deposits WHERE co_deposit = ?', [coDeposit
    ]).then(res => {
      console.log("DELETED DEPOSIT", res);
      return Promise.resolve(this.deleteDepositCollect(dbServ, coDeposit));
    }).catch(e => {
      console.log(e);
      return Promise.resolve(false);
    })
  }
  deleteDepositCollect(dbServ: SQLiteObject, coDeposit: string) {
    return dbServ.executeSql(
      'DELETE FROM deposit_collects WHERE co_deposit = ?', [coDeposit
    ]).then(res => {
      console.log("DELETED DEPOSIT_COLLECT", res);
      return Promise.resolve(true);
    }).catch(e => {
      console.log(e);
      return Promise.resolve(false);
    })
  }

  getCurrencyConversion(coCurrency: string) {
    this.currencyConversion = this.currencyServices.getOppositeCurrency(coCurrency);
  }

  private isMultiCurrencyEnabled(): boolean {
    return this.globalConfig.get('multiCurrency') === 'true';
  }

  private resolveNuAmountDocConversionForPersist(value: unknown): number {
    if (!this.isMultiCurrencyEnabled()) {
      return 0;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return 0;
    }
    return n;
  }

  /** Tras cargar cobros y cuentas, aplica tasa del día si aplica y recalcula totales. */
  private finalizeConversionAfterOpen(dbServ: SQLiteObject): Promise<boolean> {
    const syncConversionAndTotals = (): boolean => {
      const coCurrency = this.deposit?.coCurrency;
      if (coCurrency && coCurrency.length > 0) {
        this.getCurrencyConversion(coCurrency);
      }
      this.syncNuValueLocalFromCurrencyServiceFallback();
      this.totalizarDeposito();
      return true;
    };

    if (!this.isMultiCurrencyEnabled()) {
      return Promise.resolve(syncConversionAndTotals());
    }

    return this.ensureCurrencyServiceRatesLoaded(dbServ)
      .then(() => this.applyTodayNuValueLocalIfEditable(dbServ))
      .then(() => syncConversionAndTotals());
  }

  /** setup() no espera los SELECT de tasas; forzar consultas antes de convertir con CurrencyService. */
  private ensureCurrencyServiceRatesLoaded(dbServ: SQLiteObject): Promise<void> {
    return this.currencyServices.setup(dbServ).then(() =>
      Promise.all([
        this.currencyServices.queryLocalValue(dbServ),
        this.currencyServices.queryCurrencyRelation(dbServ),
      ]).then(() => undefined),
    );
  }

  private applyTodayNuValueLocalIfEditable(dbServ: SQLiteObject): Promise<void> {
    if (!this.isMultiCurrencyEnabled()) {
      return Promise.resolve();
    }
    if (this.deposit?.stDelivery === this.DEPOSITO_STATUS_SENT) {
      return Promise.resolve();
    }
    const today = this.dateServ.onlyDateHoyISO();
    return this.currencyServices
      .getLocalValuebyDate(dbServ, today)
      .then((raw: unknown) => {
        const rate = Number(raw);
        if (Number.isFinite(rate) && rate > 0) {
          this.deposit.nuValueLocal = rate;
          return;
        }
        this.syncNuValueLocalFromStoredOrCurrencyRelation();
      });
  }

  /** Si falta nuValueLocal válido tras abrir BD, completar con localValue ya cargado en CurrencyService. */
  private syncNuValueLocalFromCurrencyServiceFallback(): void {
    if (!this.isMultiCurrencyEnabled()) {
      return;
    }
    const stored = Number(this.deposit?.nuValueLocal ?? 0);
    if (Number.isFinite(stored) && stored > 0) {
      return;
    }
    this.syncNuValueLocalFromStoredOrCurrencyRelation();
  }

  private syncNuValueLocalFromStoredOrCurrencyRelation(): void {
    const lv = Number(this.currencyServices.localValue);
    if (!Number.isFinite(lv) || lv <= 0) {
      return;
    }
    this.deposit.nuValueLocal = lv;
  }

  /**
   * El general del depósito enlaza `[(ngModel)]` a propiedades planas del servicio
   * (nuDocument, txComment, daDocument), no solo a `deposit`; al reabrir desde lista
   * hay que copiar desde `deposit` para que el campo muestre lo guardado en SQLite.
   */
  private syncFormFieldsFromDeposit(): void {
    const d = this.deposit;
    if (!d) {
      return;
    }
    const row = d as unknown as Record<string, unknown>;
    this.nuDocument = this.readRowString(row, ['nuDocument', 'nu_document']);
    this.txComment = this.readRowString(row, ['txComment', 'tx_comment']);
    const daDoc = this.readRowString(row, ['daDocument', 'da_document']);
    if (daDoc.length > 0) {
      this.daDocument = daDoc;
    }
    const daDep = this.readRowString(row, ['daDeposit', 'da_deposit']);
    if (daDep.length > 0) {
      this.dateDeposit = daDep;
    }
  }

  /** Cordova/SQLite a veces devuelve claves en otro casing; busca candidatos y por coincidencia insensible. */
  private readRowString(row: Record<string, unknown>, candidates: string[]): string {
    for (const key of candidates) {
      const v = row[key];
      if (v !== undefined && v !== null && String(v).trim().length > 0) {
        return String(v);
      }
    }
    const rowKeys = Object.keys(row);
    for (const cand of candidates) {
      const want = cand.toLowerCase().replace(/_/g, '');
      for (const rk of rowKeys) {
        const norm = rk.toLowerCase().replace(/_/g, '');
        if (norm === want) {
          const v = row[rk];
          if (v !== undefined && v !== null && String(v).trim().length > 0) {
            return String(v);
          }
        }
      }
    }
    return '';
  }

  private normalizeDaDeposit(value: string): string {
    if (!value) {
      return value;
    }

    // Formato esperado: YYYY-MM-DD HH:mm:ss
    // Si viene como ISO con zona: YYYY-MM-DDTHH:mm:ss.sss+00:00
    if (value.includes('T')) {
      return value.substring(0, 19).replace('T', ' ');
    }

    // Si solo trae fecha, agrega hora
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value} 00:00:00`;
    }

    // Si trae minutos sin segundos, agrega segundos
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
      return `${value}:00`;
    }

    return value;
  }

  checkRequireApproval(db: SQLiteObject): Promise<boolean> {
    const selectStatement =
      'SELECT require_approval as requireApproval FROM transaction_types WHERE id_transaction_type = 6';
    let requireApproval = false;
    return db.executeSql(selectStatement, []).then((res) => {
      requireApproval = res.rows.item(0).requireApproval === 'true';
      return requireApproval;
    }).catch(() => Promise.resolve(requireApproval));
  }

  /**
   * Clasifica transaction_statuses de depósitos (tipo 6) como Cobros hace con tipo 3.
   * status_action = 2 → depósito rechazado → liberar cobros del detalle.
   */
  async checkHistoricDeposits(db: SQLiteObject): Promise<boolean> {
    this.depositRefused = [] as TransactionStatuses[];
    this.depositSended = [] as TransactionStatuses[];
    try {
      const list = Array.isArray(this.listTransactionStatusDeposits)
        ? this.listTransactionStatusDeposits
        : [];
      if (list.length === 0) {
        return false;
      }

      const dedupMap = new Map<string, TransactionStatuses>();
      for (const ts of list) {
        if (!ts) {
          continue;
        }
        const idTrans = ts.idTransaction ?? (ts as any).id_transaction ?? (ts as any).id;
        const coTrans = (
          ts.coTransaction
          ?? (ts as any).co_transaction
          ?? (ts as any).coDeposit
          ?? (ts as any).co_deposit
          ?? ''
        ).toString();
        const key = `${idTrans ?? ''}#${coTrans}`;
        const curDate = ts.daTransactionStatuses ? new Date(ts.daTransactionStatuses) : null;
        const existing = dedupMap.get(key);
        if (!existing) {
          dedupMap.set(key, ts);
          continue;
        }
        const existingDate = existing.daTransactionStatuses
          ? new Date(existing.daTransactionStatuses)
          : null;
        if (curDate && (!existingDate || curDate > existingDate)) {
          dedupMap.set(key, ts);
        }
      }

      const dedupedList = Array.from(dedupMap.values());
      if (dedupedList.length === 0) {
        return false;
      }

      const ids = Array.from(new Set(
        dedupedList
          .map((ts) => ts?.idStatus ?? (ts as any)?.id_status ?? (ts as any)?.id)
          .filter((id) => id !== undefined && id !== null)
          .map(String),
      ));
      if (ids.length === 0) {
        return false;
      }

      const placeholders = ids.map(() => '?').join(',');
      const res = await db.executeSql(
        `SELECT * FROM statuses WHERE id_status IN (${placeholders})`,
        ids,
      );
      const statusMap = new Map<string, number>();
      for (let i = 0; i < res.rows.length; i++) {
        const row = res.rows.item(i);
        statusMap.set(String(row.id_status), Number(row.status_action));
      }

      for (const ts of dedupedList) {
        const idStatus = ts.idStatus ?? (ts as any).id_status ?? (ts as any).id;
        if (idStatus == null) {
          continue;
        }
        switch (statusMap.get(String(idStatus))) {
          case 1:
            this.depositSended.push(ts);
            break;
          case 2:
            this.depositRefused.push(ts);
            break;
          case 3:
            this.depositSended.push(ts);
            break;
          default:
            break;
        }
      }
    } catch (err) {
      console.error('[checkHistoricDeposits] error:', err);
    }
    return true;
  }

  /**
   * Paralelismo Cobros→documentos: depósito rechazado → liberar cobros del detalle
   * (marca st_deposit=2 y borra deposit_collects para que vuelvan al selector).
   */
  async releaseCollectsFromRefusedDeposits(db: SQLiteObject): Promise<void> {
    const refused = Array.isArray(this.depositRefused) ? this.depositRefused : [];
    if (refused.length === 0) {
      return;
    }

    const queries: Array<[string, unknown[]]> = [];
    const seen = new Set<string>();

    for (const ts of refused) {
      const idDeposit = Number(
        ts.idTransaction ?? (ts as any).id_transaction ?? 0,
      );
      const coDeposit = String(
        ts.coTransaction
        ?? (ts as any).co_transaction
        ?? (ts as any).coDeposit
        ?? (ts as any).co_deposit
        ?? '',
      ).trim();

      if (idDeposit > 0) {
        const key = `id:${idDeposit}`;
        if (!seen.has(key)) {
          seen.add(key);
          queries.push([
            'UPDATE deposits SET st_deposit = ? WHERE id_deposit = ? AND IFNULL(id_deposit, 0) > 0',
            [DEPOSIT_APPROVAL_STATUS_REJECTED, idDeposit],
          ]);
          queries.push([
            'DELETE FROM deposit_collects WHERE co_deposit IN (SELECT co_deposit FROM deposits WHERE id_deposit = ?)',
            [idDeposit],
          ]);
        }
      }

      if (coDeposit.length > 0) {
        const key = `co:${coDeposit}`;
        if (!seen.has(key)) {
          seen.add(key);
          queries.push([
            'UPDATE deposits SET st_deposit = ? WHERE co_deposit = ? AND IFNULL(id_deposit, 0) > 0',
            [DEPOSIT_APPROVAL_STATUS_REJECTED, coDeposit],
          ]);
          queries.push([
            'DELETE FROM deposit_collects WHERE co_deposit = ?',
            [coDeposit],
          ]);
        }
      }
    }

    if (queries.length === 0) {
      return;
    }

    try {
      await db.sqlBatch(queries);
      this.applyRefusedStatusToInMemoryLists(refused);
    } catch (err) {
      console.error('[releaseCollectsFromRefusedDeposits] error:', err);
    }
  }

  /** Refresca stDeposit en listas en memoria para que la UI muestre Rechazado sin reentrar. */
  private applyRefusedStatusToInMemoryLists(refused: TransactionStatuses[]): void {
    for (const ts of refused) {
      const idDeposit = Number(ts.idTransaction ?? (ts as any).id_transaction ?? 0);
      const coDeposit = String(
        ts.coTransaction
        ?? (ts as any).co_transaction
        ?? (ts as any).coDeposit
        ?? (ts as any).co_deposit
        ?? '',
      ).trim();

      for (const deposit of this.listDeposits ?? []) {
        const matchById = idDeposit > 0 && Number(deposit.idDeposit ?? 0) === idDeposit;
        const matchByCo = coDeposit.length > 0 && String(deposit.coDeposit ?? '').trim() === coDeposit;
        if (matchById || matchByCo) {
          deposit.stDeposit = DEPOSIT_APPROVAL_STATUS_REJECTED;
          deposit.stDelivery = DEPOSITO_STATUS_SENT;
        }
      }

      for (const item of this.itemListaDepositos ?? []) {
        const matchById = idDeposit > 0 && Number(item.idDeposit ?? 0) === idDeposit;
        const matchByCo = coDeposit.length > 0 && String(item.coDeposit ?? '').trim() === coDeposit;
        if (matchById || matchByCo) {
          item.stDeposit = DEPOSIT_APPROVAL_STATUS_REJECTED;
          item.stDelivery = DEPOSITO_STATUS_SENT;
        }
      }
    }
  }

  /**
   * Si un cobro vinculado a un depósito es rechazado, libera ese cobro del detalle
   * para que pueda volver a listarse (igual que documentos al rechazar cobro).
   */
  async releaseCollectsFromRefusedCollections(
    db: SQLiteObject,
    coCollections: string[],
  ): Promise<void> {
    const codes = Array.from(
      new Set(
        (coCollections ?? [])
          .filter((c) => c != null)
          .map(String)
          .map((c) => c.trim())
          .filter((c) => c.length > 0),
      ),
    );
    if (codes.length === 0) {
      return;
    }

    const placeholders = codes.map(() => '?').join(',');
    try {
      await db.executeSql(
        `DELETE FROM deposit_collects WHERE co_collection IN (${placeholders})`,
        codes,
      );
    } catch (err) {
      console.error('[releaseCollectsFromRefusedCollections] error:', err);
    }
  }

  getStatusOrderName(stDeposit: number, stDelivery: number, naStatus: unknown): string {
    const delivery = Number(stDelivery);
    const deposit = Number(stDeposit);
    const resolvedNaStatus = this.resolveNaStatusLabel(naStatus);

    if (deposit !== 0 && resolvedNaStatus) {
      return resolvedNaStatus;
    }
    return this.getStatus(delivery, resolvedNaStatus);
  }

  private resolveNaStatusLabel(naStatus: unknown): string {
    if (naStatus == null) {
      return '';
    }
    if (typeof naStatus === 'string') {
      const trimmed = naStatus.trim();
      if (!trimmed || trimmed === 'Enviado' || trimmed.startsWith('Error')) {
        return '';
      }
      return trimmed;
    }
    if (typeof naStatus === 'object') {
      const fromObject = String((naStatus as { na_status?: string }).na_status ?? '').trim();
      return fromObject;
    }
    return String(naStatus).trim();
  }

  getStatus(status: number, naStatus: unknown): string {
    switch (status) {
      case DELIVERY_STATUS_SAVED:
        return this.depositTags.get('DEP_DEV_SAVED') ?? '';
      case DELIVERY_STATUS_TO_SEND:
        return this.depositTags.get('DEP_DEV_TO_BE_SENDED') ?? '';
      case DELIVERY_STATUS_SENT:
        return naStatus == null || String(naStatus).trim() === ''
          ? (this.depositTags.get('DEP_DEV_SENDED') ?? '')
          : String(naStatus);
      case 6:
        if (naStatus == null || String(naStatus).trim() === '') {
          return 'Enviado';
        }
        if (typeof naStatus === 'string') {
          return naStatus;
        }
        if (typeof naStatus === 'object') {
          return String((naStatus as { na_status?: string }).na_status ?? '');
        }
        return String(naStatus);
      default:
        return '';
    }
  }

}
