import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { BankAccount } from 'src/app/modelos/tables/bankAccount';
import { Currencies } from 'src/app/modelos/tables/currencies';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { DepositService } from 'src/app/services/deposit/deposit.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { COLOR_LILA } from 'src/app/utils/appConstants';
import {
  TEXT_COMMENT_MAX_LENGTH,
  TEXT_COMMENT_MIN_LENGTH,
} from 'src/app/utils/text-comment-field.constants';
import { applyTextCommentMaxLength } from 'src/app/utils/text-comment-field.util';

type DepositResetKind = 'currency' | 'enterprise';

@Component({
  selector: 'app-deposito-general',
  templateUrl: './deposito-general.component.html',
  styleUrls: ['./deposito-general.component.scss'],
  standalone: false
})
export class DepositoGeneralComponent implements OnInit {

  readonly textCommentMaxLength = TEXT_COMMENT_MAX_LENGTH;
  readonly textCommentMinLength = TEXT_COMMENT_MIN_LENGTH;

  public depositService = inject(DepositService);
  public dateServ = inject(DateServiceService);
  private geoServ = inject(GeolocationService);
  db = inject(SynchronizationDBService)
  private adjuntoService = inject(AdjuntoService);
  private synchronizationServices = inject(SynchronizationDBService);
  private globalConfig = inject(GlobalConfigService);


  @ViewChild('inputNuDocument', { static: false })
  inputNuDocument: any;

  @ViewChild('inputTxComment', { static: false })
  inputTxComment: any;


  public daDocument: string = this.dateServ.hoyISO();
  public alertMessageOpen: boolean = false;
  public showDateModal: boolean = false;
  private pendingResetKind: DepositResetKind | null = null;


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


  constructor() {

  }


  ngOnInit() {
    this.alertButtons[0].text = this.depositService.depositTagsDenario.get('DENARIO_BOTON_CANCELAR')!
    this.alertButtons[1].text = this.depositService.depositTagsDenario.get('DENARIO_BOTON_ACEPTAR')!
    this.adjuntoService.setup(this.synchronizationServices.getDatabase(), this.globalConfig.get("signatureCollection") == "true", this.depositService.hideDeposit, COLOR_LILA);
    this.adjuntoService.getSavedPhotos(this.synchronizationServices.getDatabase(), this.depositService.deposit.coDeposit, 'depositos');

    if (this.depositService.isDepositReadOnlyForEdit()) {
      this.depositService.disabledEnterprise = true;
      this.depositService.disabledCurrency = true;
    } else {
      this.geoServ.getCurrentPosition().then(coords => {
        if (this.depositService.userMustActivateGPS) {
          //prevenimos que sobreescriba coordenadas con string vacio
          if (coords.length > 0) {
            this.depositService.deposit.coordenada = coords
          }
        } else {
          this.depositService.deposit.coordenada = coords
        }
      });
    }
  }


  onEnterpriseSelect() {
    const selected = this.depositService.enterpriseSelected;
    const currentId = Number(this.depositService.deposit?.idEnterprise ?? 0);
    if (!selected || Number(selected.idEnterprise) === currentId) {
      return;
    }

    if ((this.depositService.deposit?.depositCollect?.length ?? 0) > 0) {
      this.pendingResetKind = 'enterprise';
      this.depositService.message =
        'Al cambiar la empresa se reiniciará el Depósito, ¿Desea reiniciar el Depósito?';
      this.alertMessageOpen = true;
      return;
    }

    void this.changeEnterprise();
  }

  shouldShowBankSendError(): boolean {
    return this.depositService.sendValidationAttempted
      && !this.depositService.generalTabValidForSave;
  }

  shouldShowDocumentSendError(): boolean {
    return this.depositService.sendValidationAttempted
      && this.depositService.generalTabValidForSave
      && !(this.depositService.nuDocument?.trim() || this.depositService.deposit?.nuDocument?.trim());
  }

  onBankSelect() {
    this.depositService.deposit.nuAccount = this.depositService.bankSelected.nuAccount;
    this.depositService.deposit.coBank = this.depositService.bankSelected.coBank;
    this.depositService.isSelectedBank = true;
    this.depositService.onDepositGeneralValid(true);
    this.depositService.notifyDepositEdited();
  }

  onNuDocumentInput() {
    const clean = this.cleanString(this.depositService.nuDocument);
    if (this.depositService.nuDocument !== clean) {
      this.depositService.nuDocument = clean;
      if (this.inputNuDocument && this.inputNuDocument.value !== clean) {
        this.inputNuDocument.value = clean;
      }
    }
    this.depositService.deposit.nuDocument = this.depositService.nuDocument.trim();
    this.depositService.notifyDepositEdited();
  }

  onTxCommentInput() {
    const clean = applyTextCommentMaxLength(
      this.cleanString(this.depositService.txComment),
      this.textCommentMaxLength,
    );
    if (this.depositService.txComment !== clean) {
      this.depositService.txComment = clean;
      if (this.inputTxComment && this.inputTxComment.value !== clean) {
        this.inputTxComment.value = clean;
      }
    }
    this.depositService.deposit.txComment = this.depositService.txComment.trim();
    this.depositService.notifyDepositEdited();
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

  changeDaDocument() {
    this.depositService.deposit.daDocument = this.depositService.daDocument;
    this.depositService.notifyDepositEdited();
  }

  changeCurrencyMsj(event: any) {
    this.depositService.currencySelected = event.detail.value as Currencies;
    if (this.depositService.deposit.depositCollect.length > 0) {
      this.pendingResetKind = 'currency';
      this.depositService.message = "Al cambiar la moneda se reiniciará el Depósito, ¿Desea reiniciar del Depósito?"
      this.alertMessageOpen = true;
    } else {
      this.changeCurrency();
    }
  }

  changeCurrency() {
    this.alertMessageOpen = false;
    this.pendingResetKind = null;
    const selectedCurrency = this.depositService.currencySelected;
    const selectedEnterprise = this.depositService.enterpriseSelected;
    this.depositService.resetDeposit().then(() => {
      if (selectedEnterprise) {
        this.depositService.enterpriseSelected = selectedEnterprise;
        this.depositService.deposit.idEnterprise = selectedEnterprise.idEnterprise;
        this.depositService.deposit.coEnterprise = selectedEnterprise.coEnterprise;
      }
      this.depositService.currencySelected = selectedCurrency;
      this.depositService.deposit.idCurrency = selectedCurrency.idCurrency;
      this.depositService.deposit.coCurrency = selectedCurrency.coCurrency;
      this.depositService.bankList = [] as BankAccount[];
      this.depositService.bankSelected = {} as BankAccount;
      this.depositService.getCurrencyConversion(selectedCurrency.coCurrency);
      return this.reloadBanksAndCollects();
    });
  }

  async changeEnterprise(): Promise<void> {
    this.alertMessageOpen = false;
    this.pendingResetKind = null;

    const selectedEnterprise = this.depositService.enterpriseSelected;
    if (!selectedEnterprise) {
      return;
    }

    await this.depositService.resetDeposit();
    this.depositService.enterpriseSelected = selectedEnterprise;
    this.depositService.deposit.idEnterprise = selectedEnterprise.idEnterprise;
    this.depositService.deposit.coEnterprise = selectedEnterprise.coEnterprise;

    const db = this.db.getDatabase();
    await this.depositService.getCurrencies(db, selectedEnterprise.idEnterprise);
    this.depositService.getCurrencyConversion(this.depositService.currencySelected.coCurrency);
    await this.reloadBanksAndCollects();
    this.adjuntoService.getSavedPhotos(
      this.synchronizationServices.getDatabase(),
      this.depositService.deposit.coDeposit,
      'depositos',
    );
    this.depositService.markDepositDirty();
  }

  private async reloadBanksAndCollects(): Promise<void> {
    const db = this.db.getDatabase();
    const idEnterprise = this.depositService.deposit.idEnterprise;
    const coCurrency = this.depositService.currencySelected?.coCurrency
      || this.depositService.deposit.coCurrency;

    this.depositService.isSelectedBank = false;
    await this.depositService.updateBankAccounts(db);
    await this.depositService.getBankAccounts(db, idEnterprise, coCurrency);
    await this.depositService.getAllCollectsToDeposit(db, coCurrency, idEnterprise);
    await this.depositService.getAllCollectsAnticipoToDeposit(db, coCurrency, idEnterprise);
  }

  private restorePreviousEnterprise(): void {
    const previousId = Number(this.depositService.deposit?.idEnterprise ?? 0);
    const previous = this.depositService.enterpriseList.find(
      (emp: Enterprise) => Number(emp.idEnterprise) === previousId,
    );
    if (previous) {
      this.depositService.enterpriseSelected = previous;
    }
  }

  private restorePreviousCurrency(): void {
    for (let i = 0; i < this.depositService.currencyList.length; i++) {
      if (this.depositService.currencyList[i].idCurrency == this.depositService.deposit.idCurrency) {
        this.depositService.currencySelected = this.depositService.currencyList[i];
        break;
      }
    }
  }

  setShowDateModal(val: boolean) {
    this.showDateModal = val;
  }

  setResult(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpen = false;
      if (this.pendingResetKind === 'enterprise') {
        void this.changeEnterprise();
      } else {
        this.changeCurrency();
      }
      return;
    }

    if (this.pendingResetKind === 'enterprise') {
      this.restorePreviousEnterprise();
    } else {
      this.restorePreviousCurrency();
    }
    this.pendingResetKind = null;
    this.alertMessageOpen = false;
  }
}
