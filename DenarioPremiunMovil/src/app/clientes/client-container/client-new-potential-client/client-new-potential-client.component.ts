import { Component, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';

import { Enterprise } from '../../../modelos/tables/enterprise';
import { PotentialClient } from '../../../modelos/tables/potentialClient';
import { SynchronizationDBService } from '../../../services/synchronization/synchronization-db.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ServicesService } from '../../../services/services.service';
import { AutoSendService } from '../../../services/autoSend/auto-send.service';
import { PendingTransaction } from '../../../modelos/tables/pendingTransactions';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { CLIENT_POTENTIAL_STATUS_NEW, CLIENT_POTENTIAL_STATUS_TO_SEND, CLIENT_POTENTIAL_STATUS_SENT, COLOR_VERDE } from 'src/app/utils/appConstants';
import { PotentialClientDatabaseServicesService } from 'src/app/services/clientes/potentialClient/potential-client-database-services.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { Subscription } from 'rxjs';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';


@Component({
  selector: 'app-client-new-potential-client',
  templateUrl: './client-new-potential-client.component.html',
  styleUrls: ['./client-new-potential-client.component.scss'],
  standalone: false
})

export class NewPotentialClientComponent implements OnInit {

  public messageService = inject(MessageService);
  public synchronizationServices = inject(SynchronizationDBService);
  public services = inject(ServicesService);
  public autoSend = inject(AutoSendService);
  public clientLogic = inject(ClientLogicService)
  public dbService = inject(PotentialClientDatabaseServicesService);
  public dateServ = inject(DateServiceService);
  public enterpriseServ = inject(EnterpriseService);
  public geoServ = inject(GeolocationService);

  public adjuntoService = inject(AdjuntoService);

  public config = inject(GlobalConfigService);


  @ViewChild('naClientInput', { static: false })
  naClientInput: any;

  @ViewChild('nuRifInput', { static: false })
  nuRifInput: any;

  @ViewChild('txAddressInput', { static: false })
  txAddressInput: any;

  @ViewChild('txAddressDispatchInput', { static: false })
  txAddressDispatchInput: any;

  @ViewChild('txClientInput', { static: false })
  txClientInput: any;

  @ViewChild('naResponsibleInput', { static: false })
  naResponsibleInput: any;

  @ViewChild('emClientInput', { static: false })
  emClientInput: any;

  @ViewChild('nuPhoneInput', { static: false })
  nuPhoneInput: any;

  @ViewChild('naWebSiteInput', { static: false })
  naWebSiteInput: any;
  @ViewChild('coordenadaInput', { static: false })
  coordenadaInput: any;



  public subs: any;
  public mensaje!: string;
  public tags = new Map<string, string>([]);
  public sub!: object;
  public isDisabled: boolean = true;
  public isMultiEnterprise: boolean = false;
  public isAlertOpen = false;
  public alertButtons = ['OK'];
  public messageAlert!: MessageAlert;
  public segment: string = 'default';
  public disabledSelectEnterprise: boolean = false;

  public newPotentialClient = new FormGroup({
    coPotentialClient: new FormControl(''),
    idEnterprise: new FormControl<number | null>(null, [Validators.required]), naClient: new FormControl('', [Validators.required]),
    nuRif: new FormControl('', [Validators.required]),
    txAddress: new FormControl('', [Validators.required]),
    txAddressDispatch: new FormControl('', [Validators.required]),
    txClient: new FormControl('', [Validators.required]),
    naResponsible: new FormControl('', [Validators.required]),
    emClient: new FormControl('', [Validators.required, Validators.email, // Angular's built-in email validator
    Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/)]),
    nuPhone: new FormControl('', [Validators.required, Validators.pattern(/^(?=(?:\D*\d){7,15}\D*$)(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)|\d{2,4})(?:[ .-]?\d{2,4}){1,3}$/)]),
    naWebSite: new FormControl(''),
    coordenadaClient: new FormControl(''),
  });

  /* /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/ */

  constructor() {
    this.subscribeSendSave()
    this.newPotentialClient.markAllAsTouched();

  }

  ngOnInit() {
    /* this.onChanges(); */
    this.clientLogic.setNombreModulo('CLI_POT_LISTADO', 'Clientes');

    this.isMultiEnterprise = this.enterpriseServ.esMultiempresa()
    if (!this.isMultiEnterprise)
      this.newPotentialClient.get('idEnterprise')?.disable();

    this.clientLogic.saveOrExitOpen = false;
    this.clientLogic.getEnterprisePotentialClient().then(resp => {

      console.log(resp);
      if (this.clientLogic.potentialClient.stPotentialClient == undefined) {
        //ES NUEVO
        this.clientLogic.potentialClient = {} as PotentialClient;
        this.geoServ.getCurrentPosition().then(coords => { this.clientLogic.potentialClient.coordenada = coords });
        this.clientLogic.potentialClient.coClient = this.dateServ.generateCO(0);;
        this.clientLogic.potentialClient.stPotentialClient = 0;
        this.isDisabled = false;
        this.clientLogic.saveSendPotentialClient = true;
        this.adjuntoService.setup(this.synchronizationServices.getDatabase(), this.config.get('signatureClient') == 'true', false, COLOR_VERDE);
        this.onChanges();
        this.checkForm();
      } else if (this.clientLogic.potentialClient.stPotentialClient == 0) {
        //ES GUARDADO
        this.isDisabled = false;
        this.newPotentialClient.get('idEnterprise')!.setValue(this.clientLogic.potentialClient.idEnterprise);

        this.clientLogic.cannotSavePotentialClient = true;
        this.clientLogic.cannotSendPotentialClient = false;
        this.adjuntoService.setup(this.synchronizationServices.getDatabase(), this.config.get('signatureClient') == 'true', false, COLOR_VERDE);
        this.adjuntoService.getSavedPhotos(this.synchronizationServices.getDatabase(), this.clientLogic.potentialClient.coClient, 'clientes');
        this.clientLogic.saveSendPotentialClient = true;
        this.onChanges();
        this.checkForm();


      } else {
        //POR ENVIAR O ENVIADO
        this.isDisabled = true;
        this.newPotentialClient.get('idEnterprise')!.setValue(this.clientLogic.potentialClient.idEnterprise);
        this.clientLogic.saveSendPotentialClient = false;
        this.clientLogic.savePotentialClient = true;
        this.adjuntoService.setup(this.synchronizationServices.getDatabase(), this.config.get('signatureClient') == 'true', true, COLOR_VERDE);
        this.adjuntoService.getSavedPhotos(this.synchronizationServices.getDatabase(), this.clientLogic.potentialClient.coClient, 'clientes');
        this.clientLogic.disabledEnterprise = true;
        this.clientLogic.empresaSeleccionada = this.clientLogic.listaEmpresa.find(ent => ent.idEnterprise == this.clientLogic.potentialClient.idEnterprise)!;
        this.clientLogic.potentialClient.idEnterprise = this.clientLogic.empresaSeleccionada.idEnterprise;
        this.disabledSelectEnterprise = true;
      }
      this.clientLogic.newPotentialClientChanged = false;
    })
  }

  ngOnDestroy() {
    if (this.subs) {
      this.subs.unsubscribe();
    }
  }

  async validatePotentialClient(potencialClient: FormGroup, saveSend: Boolean) {
    if (this.idEnterprise!.errors == null && this.naClient.errors == null && this.nuRif!.errors == null && this.txAddress!.errors == null
      && this.txAddressDispatch!.errors == null && this.txClient!.errors == null
      && this.emClient!.errors == null && this.nuPhone!.errors == null) {
      this.messageService.showLoading().then(() => {
        potencialClient.value.idEnterprise = this.clientLogic.empresaSeleccionada.idEnterprise;
        potencialClient.value.coEnterprise = this.clientLogic.empresaSeleccionada.coEnterprise;
        potencialClient.value.stPotentialClient = this.clientLogic.potentialClient.stPotentialClient;
        potencialClient.value.coClient = this.clientLogic.potentialClient.coClient;
        potencialClient.value.hasAttachments = this.adjuntoService.hasItems();
        potencialClient.value.nuAttachments = this.adjuntoService.getNuAttachment();
        potencialClient.value.coordenadaClient = this.clientLogic.potentialClient.coordenadaClient;
        this.dbService.insertPotentialClient(potencialClient.value, this.clientLogic.potentialClient.coordenada, saveSend).then(async result => {
          await this.adjuntoService.savePhotos(this.synchronizationServices.getDatabase(), potencialClient.value.coClient, "clientes");
          if (saveSend) {
            this.clientLogic.saveSendPotentialClient = false;
            let pendingTransaction = {} as PendingTransaction;
            pendingTransaction.coTransaction = potencialClient.value.coClient;
            pendingTransaction.idTransaction = 0
            pendingTransaction.type = "potentialClient";
            if (localStorage.getItem("connected") == "true") {
              /*
              this.messageAlert = new MessageAlert(
                "Denario Cliente",
                "¡Cliente potencial sera enviado!"
              );
              this.messageService.alertModal(this.messageAlert);
              */
              this.services.insertPendingTransaction(this.synchronizationServices.getDatabase(), pendingTransaction).then(result => {
                if (result) {
                  void this.autoSend.runPendingQueue();
                  this.clientLogic.clientNewPotentialClientComponent = false;
                  this.clientLogic.clienteNuevoBlancoImg = true;
                  this.clientLogic.clientContainerComponent = true;
                }
              })
            } else {
              void this.autoSend.runPendingQueue();
              this.clientLogic.clientNewPotentialClientComponent = false;
              this.clientLogic.clientPotentialClientComponent = true;
              this.clientLogic.clienteNuevoBlancoImg = true;
              /*
              this.messageAlert = new MessageAlert(
                "Denario Cliente",
                "¡Cliente potencial sera enviado al tener conexión de datos!"
              );
              this.messageService.alertModal(this.messageAlert);*/
            }

          } else {
            this.messageAlert = new MessageAlert(
              "Denario Cliente",
              "¡Cliente Potencial Guardado con exito!"
            );
            this.messageService.alertModal(this.messageAlert);

            if (this.clientLogic.saveOrExitOpen) {
              this.clientLogic.newPotentialClientChanged = false;
              this.clientLogic.saveOrExitOpen = false;
              this.clientLogic.saveSendPotentialClient = false;
              this.clientLogic.saveSendPotentialClient = false;
              this.clientLogic.clientNewPotentialClientComponent = false;
              this.clientLogic.clientContainerComponent = true;
            }
          }
          this.messageService.hideLoading();
        });
      });
    } else {
      this.newPotentialClient.markAllAsTouched();
    }
  }

  subscribeSendSave() {
    this.subs = this.dbService.saveSend.subscribe((data) => {
      this.validatePotentialClient(this.newPotentialClient, data);
    })
  }

  changeEnterprise(enterpriseOrId: Enterprise | number) {
    let enterprise: Enterprise | undefined;
    if (typeof enterpriseOrId === 'number') {
      enterprise = this.clientLogic.enterprises.find(ent => ent.idEnterprise === enterpriseOrId);
    } else {
      enterprise = enterpriseOrId as Enterprise;
    }

    if (!enterprise) return;

    this.clientLogic.empresaSeleccionada = enterprise;
    this.clientLogic.potentialClient.idEnterprise = enterprise.idEnterprise;

    // mantener el FormControl sincronizado (usando number)
    const ctl = this.newPotentialClient.get('idEnterprise');
    if (ctl) ctl.setValue(enterprise.idEnterprise);

    this.checkForm();
  }

  checkForm() {
    if (this.idEnterprise!.errors == null && this.naClient!.errors == null && this.nuRif!.errors == null && this.txAddress!.errors == null
      && this.txAddressDispatch!.errors == null && this.txClient!.errors == null
      && this.emClient!.errors == null && this.nuPhone!.errors == null) {

      this.clientLogic.cannotSavePotentialClient = false;
      this.clientLogic.cannotSendPotentialClient = false;
      this.clientLogic.validPotentialClient = true;
      /* this.clientLogic.newPotentialClientChanged = true; */
      return Promise.resolve(true);
    } else {
      this.clientLogic.cannotSendPotentialClient = true;
      this.clientLogic.cannotSavePotentialClient = true;
      this.clientLogic.validPotentialClient = false;

      /* this.clientLogic.newPotentialClientChanged = false; */
      return Promise.resolve(false);
    }
  }

  onChanges(): void {
    this.newPotentialClient.valueChanges.subscribe(val => {
      /* console.log("entre", this.newPotentialClient.valueChanges) */
      this.checkForm().then(resp => {
        if (resp)
          this.clientLogic.newPotentialClientChanged = true;
      })

    });
  }

  onChangeTab(tab: string) {
    this.segment = tab;
  }


  get idEnterprise() { return this.newPotentialClient.controls['idEnterprise']; }
  get naClient() { return this.newPotentialClient.controls['naClient']; }
  get nuRif() { return this.newPotentialClient.get('nuRif'); }
  get txAddress() { return this.newPotentialClient.get('txAddress'); }
  get daExpirationForm() { return this.newPotentialClient.get('daExpirationForm'); }
  get txAddressDispatch() { return this.newPotentialClient.get('txAddressDispatch'); }
  get txClient() { return this.newPotentialClient.get('txClient'); }
  get emClient() { return this.newPotentialClient.get('emClient'); }
  get nuPhone() { return this.newPotentialClient.get('nuPhone'); }

  cleanString(str: string): string {
    // Elimina ;
    str = str.replace(/;/g, '');
    // Elimina comillas simples
    str = str.replace(/'/g, '');
    // Elimina comillas dobles
    str = str.replace(/"/g, '');
    return str;
  }

  onNaClientChange() {
    const clean = this.cleanString(this.newPotentialClient.get('naClient')?.value || '');
    if (this.clientLogic.potentialClient.naClient !== clean) {
      this.clientLogic.potentialClient.naClient = clean;
    }
    if (this.naClientInput && this.naClientInput.value !== clean) {
      this.naClientInput.value = (clean);
    }
  }

  onNuRifChange() {
    const clean = this.cleanString(this.newPotentialClient.get('nuRif')?.value || '');
    if (this.clientLogic.potentialClient.nuRif !== clean) {
      this.clientLogic.potentialClient.nuRif = clean;
    }
    if (this.nuRifInput && this.nuRifInput.value !== clean) {
      this.nuRifInput.value = (clean);;
    }
  }

  onTxAddressChange() {
    const clean = this.cleanString(this.newPotentialClient.get('txAddress')?.value || '');
    if (this.clientLogic.potentialClient.txAddress !== clean) {
      this.clientLogic.potentialClient.txAddress = clean;
    }
    if (this.txAddressInput && this.txAddressInput.value !== clean) {
      this.txAddressInput.value = (clean);;
    }
  }

  onTxAddressDispatchChange() {
    const clean = this.cleanString(this.newPotentialClient.get('txAddressDispatch')?.value || '');
    if (this.clientLogic.potentialClient.txAddressDispatch !== clean) {
      this.clientLogic.potentialClient.txAddressDispatch = clean;
    }
    if (this.txAddressDispatchInput && this.txAddressDispatchInput.value !== clean) {
      this.txAddressDispatchInput.value = (clean);;
    }
  }

  onTxClientChange() {
    const clean = this.cleanString(this.newPotentialClient.get('txClient')?.value || '');
    if (this.clientLogic.potentialClient.txClient !== clean) {
      this.clientLogic.potentialClient.txClient = clean;
    }
    if (this.txClientInput && this.txClientInput.value !== clean) {
      this.txClientInput.value = (clean);;
    }
  }

  onNaResponsibleChange() {
    const clean = this.cleanString(this.newPotentialClient.get('naResponsible')?.value || '');
    if (this.clientLogic.potentialClient.naResponsible !== clean) {
      this.clientLogic.potentialClient.naResponsible = clean;
    }
    if (this.naResponsibleInput && this.naResponsibleInput.value !== clean) {
      this.naResponsibleInput.value = (clean);;
    }
  }

  onEmClientChange() {
    const clean = this.cleanString(this.newPotentialClient.get('emClient')?.value || '');
    if (this.clientLogic.potentialClient.emClient !== clean) {
      this.clientLogic.potentialClient.emClient = clean;
    }
    if (this.emClientInput && this.emClientInput.value !== clean) {
      this.emClientInput.value = (clean);
    }
  }

  onNuPhoneChange() {
    const clean = this.cleanString(this.newPotentialClient.get('nuPhone')?.value || '');
    if (this.clientLogic.potentialClient.nuPhone !== clean) {
      this.clientLogic.potentialClient.nuPhone = clean;
    }
    if (this.nuPhoneInput && this.nuPhoneInput.value !== clean) {
      this.nuPhoneInput.value = (clean);
    }
  }

  onNaWebSiteChange() {
    const clean = this.cleanString(this.newPotentialClient.get('naWebSite')?.value || '');
    if (this.clientLogic.potentialClient.naWebSite !== clean) {
      this.clientLogic.potentialClient.naWebSite = clean;
    }
    if (this.naWebSiteInput && this.naWebSiteInput.value !== clean) {
      this.naWebSiteInput.value = (clean);;
    }
  }

  onCoordenadaChange() {
    this.clientLogic.viewCoordenadaPotentialClient(this.clientLogic.potentialClient, 'potentialClient');
  }
}
