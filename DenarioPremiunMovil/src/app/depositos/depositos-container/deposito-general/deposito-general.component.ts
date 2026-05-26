import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { BankAccount } from 'src/app/modelos/tables/bankAccount';
import { Currencies } from 'src/app/modelos/tables/currencies';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { DepositService } from 'src/app/services/deposit/deposit.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { COLOR_LILA, COLOR_VERDE } from 'src/app/utils/appConstants';

@Component({
  selector: 'app-deposito-general',
  templateUrl: './deposito-general.component.html',
  styleUrls: ['./deposito-general.component.scss'],
  standalone: false
})
export class DepositoGeneralComponent implements OnInit {

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

    if (this.depositService.deposit.stDeposit == 1) {
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

  }

  print() {
    console.log(this.depositService.deposit);
  }

  onBankSelect() {
    this.depositService.deposit.nuAccount = this.depositService.bankSelected.nuAccount;
    this.depositService.deposit.coBank = this.depositService.bankSelected.coBank;
    this.depositService.isSelectedBank = true;
    this.depositService.depositValid = true;
    this.depositService.markDepositDirty();
    this.depositService.onDepositValidToSave(true);
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
    this.depositService.markDepositDirty();
  }

  onTxCommentInput() {
    const clean = this.cleanString(this.depositService.txComment);
    if (this.depositService.txComment !== clean) {
      this.depositService.txComment = clean;
      if (this.inputTxComment && this.inputTxComment.value !== clean) {
        this.inputTxComment.value = clean;
      }
    }
    this.depositService.deposit.txComment = this.depositService.txComment.trim();
    this.depositService.markDepositDirty();
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
    this.depositService.markDepositDirty();
  }

  changeCurrencyMsj(event: any) {
    this.depositService.currencySelected = event.detail.value as Currencies;
    if (this.depositService.deposit.depositCollect.length > 0) {
      this.depositService.message = "Al cambiar la moneda se reiniciará el Depósito, ¿Desea reiniciar del Depósito?"
      this.alertMessageOpen = true;
    } else {
      this.changeCurrency();
    }
  }

  changeCurrency() {
    this.alertMessageOpen = false;
    this.depositService.resetDeposit().then(r => {
      this.depositService.deposit.idCurrency = this.depositService.currencySelected.idCurrency;
      this.depositService.deposit.coCurrency = this.depositService.currencySelected.coCurrency;
      /* this.depositService.initOpenDeposit(); */
      this.depositService.bankList = [] as BankAccount[];
      this.depositService.bankSelected = {} as BankAccount;
      this.depositService.getCurrencyConversion(this.depositService.currencySelected.coCurrency);
      this.depositService.updateBankAccounts(this.db.getDatabase()).then(result => {
        this.depositService.isSelectedBank = false;
        this.depositService.getBankAccounts(this.db.getDatabase(), this.depositService.deposit.idEnterprise,
          this.depositService.currencySelected.coCurrency).then(resp => {
            //ya tengo todo para iniciar el deposito
            this.depositService.getAllCollectsToDeposit(this.db.getDatabase(), this.depositService.deposit.coCurrency).then(resp1 => {
              this.depositService.getAllCollectsAnticipoToDeposit(this.db.getDatabase(), this.depositService.deposit.coCurrency).then(resp2 => {
                console.log(resp1.length);
                console.log(resp2.length);
              })
            })
          })

      })
    })

  }

  setShowDateModal(val: boolean) {
    this.showDateModal = val;
  }

  setResult(ev: any) {
    console.log('Apretó:' + ev.detail.role);
    if (ev.detail.role === 'confirm') {
      this.alertMessageOpen = false;
      this.changeCurrency();
    } else {
      /* this.depositService.currencySelected.idCurrency = this.depositService.deposit.idCurrency;
      this.depositService.currencySelected.coCurrency = this.depositService.deposit.coCurrency; */
      for (var i = 0; i < this.depositService.currencyList.length; i++) {
        if (this.depositService.currencyList[i].idCurrency == this.depositService.deposit.idCurrency) {
          this.depositService.currencySelected = this.depositService.currencyList[i]
          i = this.depositService.currencyList.length + 1;
          break
        }
      }

      this.alertMessageOpen = false;
    }
  }
}
