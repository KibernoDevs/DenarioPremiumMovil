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
import { PotentialClientDynamicFieldService } from 'src/app/services/clientes/potentialClient/potential-client-dynamic-field.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { Subscription } from 'rxjs';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import {
  TEXT_COMMENT_MIN_LENGTH,
} from 'src/app/utils/text-comment-field.constants';
import { applyTextCommentMaxLength } from 'src/app/utils/text-comment-field.util';
import {
  POTENTIAL_CLIENT_FIELD_MAX,
  PotentialClientTextField,
} from 'src/app/utils/potential-client-field.constants';


@Component({
  selector: 'app-client-new-potential-client',
  templateUrl: './client-new-potential-client.component.html',
  styleUrls: ['./client-new-potential-client.component.scss'],
  standalone: false
})

export class NewPotentialClientComponent implements OnInit {

  readonly fieldMax = POTENTIAL_CLIENT_FIELD_MAX;
  /** Opcionales (Web): el hint puede decir Mín. 0. */
  readonly textCommentMinLength = TEXT_COMMENT_MIN_LENGTH;
  /** Obligatorios: Validators.required ⇒ el contador muestra Mín. 1 (no cambia la validación). */
  readonly textCommentRequiredMinLength = 1;

  public messageService = inject(MessageService);
  public synchronizationServices = inject(SynchronizationDBService);
  public services = inject(ServicesService);
  public autoSend = inject(AutoSendService);
  public clientLogic = inject(ClientLogicService)
  public dbService = inject(PotentialClientDatabaseServicesService);
  public dynamicFieldService = inject(PotentialClientDynamicFieldService);
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
    this.clientLogic.registerPotentialClientForm(this.newPotentialClient);
    this.clientLogic.resetPotentialClientValidationUxFlags();

    this.isMultiEnterprise = this.enterpriseServ.esMultiempresa()
    if (!this.isMultiEnterprise)
      this.newPotentialClient.get('idEnterprise')?.disable();

    this.clientLogic.saveOrExitOpen = false;
    this.clientLogic.getEnterprisePotentialClient().then(resp => {

      console.log(resp);
      if (!this.isMultiEnterprise && this.clientLogic.empresaSeleccionada) {
        this.newPotentialClient.get('idEnterprise')?.setValue(this.clientLogic.empresaSeleccionada.idEnterprise);
      }
      if (this.clientLogic.potentialClient.stPotentialClient == undefined) {
        //ES NUEVO
        this.clientLogic.potentialClient = {} as PotentialClient;
        this.geoServ.getCurrentPosition().then(coords => { this.clientLogic.potentialClient.coordenada = coords });
        this.clientLogic.potentialClient.coClient = this.dateServ.generateCO(0);;
        this.clientLogic.potentialClient.stPotentialClient = 0;
        this.isDisabled = false;
        this.clientLogic.saveSendPotentialClient = true;
        this.clientLogic.resetPotentialClientExitBaseline();
        this.clientLogic.onPotentialClientGeneralValid(!!this.clientLogic.empresaSeleccionada);
        this.adjuntoService.setup(this.synchronizationServices.getDatabase(), this.config.get('signatureClient') == 'true', false, COLOR_VERDE);
        this.onChanges();
        void this.reloadDynamicFields(false).then(() => this.checkForm());
      } else if (this.clientLogic.potentialClient.stPotentialClient == 0) {
        //ES GUARDADO
        this.isDisabled = false;
        this.newPotentialClient.get('idEnterprise')!.setValue(this.clientLogic.potentialClient.idEnterprise);

        this.adjuntoService.setup(this.synchronizationServices.getDatabase(), this.config.get('signatureClient') == 'true', false, COLOR_VERDE);
        this.adjuntoService.getSavedPhotos(this.synchronizationServices.getDatabase(), this.clientLogic.potentialClient.coClient, 'clientes');
        this.clientLogic.saveSendPotentialClient = true;
        this.clientLogic.markPotentialClientOpenedFromPersistedCopy();
        this.clientLogic.onPotentialClientGeneralValid(true);
        this.onChanges();
        void this.reloadDynamicFields(false).then(() => this.checkForm());


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
        void this.reloadDynamicFields(false).then(() => {
          this.disableDynamicControls();
          this.checkForm();
        });
      }
      this.clientLogic.newPotentialClientChanged = false;
    })
  }

  ngOnDestroy() {
    this.clientLogic.clearPotentialClientForm();
    if (this.subs) {
      this.subs.unsubscribe();
    }
  }

  /**
   * Persiste el potencial. Guardar: solo exige nombre.
   * Enviar: formulario completo + firma/GPS (hasPotentialClientFieldErrors).
   */
  async validatePotentialClient(potencialClient: FormGroup, saveSend: Boolean) {
    const isSend = saveSend === true;
    const blocked = isSend
      ? this.clientLogic.hasPotentialClientFieldErrors()
      : this.clientLogic.hasPotentialClientSaveErrors();

    if (blocked) {
      if (isSend) {
        this.newPotentialClient.markAllAsTouched();
      } else {
        this.newPotentialClient.get('naClient')?.markAsTouched();
      }
      return;
    }

    const raw = potencialClient.getRawValue() as Record<string, unknown>;
    const enterprise = this.clientLogic.empresaSeleccionada;
    const payload = {
      ...raw,
      naClient: String(raw['naClient'] ?? this.clientLogic.potentialClient?.naClient ?? '').trim(),
      nuRif: String(raw['nuRif'] ?? ''),
      txAddress: String(raw['txAddress'] ?? ''),
      txAddressDispatch: String(raw['txAddressDispatch'] ?? ''),
      txClient: String(raw['txClient'] ?? ''),
      naResponsible: String(raw['naResponsible'] ?? ''),
      emClient: String(raw['emClient'] ?? ''),
      nuPhone: String(raw['nuPhone'] ?? ''),
      naWebSite: String(raw['naWebSite'] ?? ''),
      idEnterprise: Number(
        enterprise?.idEnterprise
        ?? raw['idEnterprise']
        ?? this.clientLogic.potentialClient?.idEnterprise
        ?? 0,
      ),
      coEnterprise: String(
        enterprise?.coEnterprise
        ?? this.clientLogic.potentialClient?.coEnterprise
        ?? '',
      ),
      stPotentialClient: this.clientLogic.potentialClient.stPotentialClient,
      coClient: this.clientLogic.potentialClient.coClient,
      hasAttachments: this.adjuntoService.hasItems(),
      nuAttachments: this.adjuntoService.getNuAttachment(),
      coordenadaClient: this.clientLogic.potentialClient.coordenadaClient ?? '',
    };

    this.messageService.showLoading().then(() => {
      this.dbService.insertPotentialClient(
        payload as any,
        this.clientLogic.potentialClient.coordenada,
        saveSend,
      ).then(async result => {
        const fieldValues = this.dynamicFieldService.getFieldValuesFromForm(this.newPotentialClient);
        await this.dynamicFieldService.saveValues(payload.coClient, fieldValues);
        await this.adjuntoService.savePhotos(
          this.synchronizationServices.getDatabase(),
          payload.coClient,
          'clientes',
        );
        if (saveSend) {
          this.clientLogic.saveSendPotentialClient = false;
          let pendingTransaction = {} as PendingTransaction;
          pendingTransaction.coTransaction = payload.coClient;
          pendingTransaction.idTransaction = 0
          pendingTransaction.type = "potentialClient";
          if (localStorage.getItem("connected") == "true") {
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
            await this.clientLogic.getPotentialClient();
          }
          this.clientLogic.applyPotentialClientPersistSucceededBaseline();
          this.clientLogic.resetPotentialClientSendValidationUx();
          this.messageService.alertModal(
            {
              header: this.clientLogic.clientTags.get('DENARIO_NOMBRE_APP')!,
              message: this.clientLogic.clientTags.get('CLI_SEND_MSG')!,
            }
          );

        } else {
          this.clientLogic.applyPotentialClientPersistSucceededBaseline();
          this.clientLogic.resetPotentialClientSendValidationUx();
          this.messageAlert = new MessageAlert(
            "Denario Cliente",
            "¡Cliente Potencial Guardado con exito!"
          );
          this.messageService.alertModal(this.messageAlert);

          if (this.clientLogic.exitToPotentialClientListAfterSave) {
            this.clientLogic.exitToPotentialClientListAfterSave = false;
            this.clientLogic.newPotentialClientChanged = false;
            this.clientLogic.saveSendPotentialClient = false;
            this.clientLogic.clientNewPotentialClientComponent = false;
            this.clientLogic.clienteNuevoBlancoImg = true;
            this.clientLogic.clientPotentialClientComponent = true;
            await this.clientLogic.getPotentialClient();
          } else if (this.clientLogic.saveOrExitOpen) {
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

    this.clientLogic.onPotentialClientGeneralValid(true);
    this.clientLogic.notifyPotentialClientEdited();
    void this.reloadDynamicFields(true).then(() => this.checkForm());
  }

  /**
   * Recarga defs/opciones de la empresa y (opcionalmente) valores guardados.
   * clearValues=true en cambio de empresa: limpia controles dyn_*.
   */
  private async reloadDynamicFields(clearValues: boolean): Promise<void> {
    const idEnterprise = Number(
      this.clientLogic.empresaSeleccionada?.idEnterprise
      ?? this.newPotentialClient.get('idEnterprise')?.value
      ?? this.clientLogic.potentialClient?.idEnterprise
      ?? 0,
    );

    let existingValues = undefined;
    if (!clearValues && this.clientLogic.potentialClient?.coClient) {
      existingValues = await this.dynamicFieldService.loadValues(
        this.clientLogic.potentialClient.coClient,
      );
    }

    await this.dynamicFieldService.replaceDynamicControls(
      this.newPotentialClient,
      idEnterprise,
      existingValues,
    );

    if (this.isDisabled) {
      this.disableDynamicControls();
    }
  }

  private disableDynamicControls(): void {
    for (const field of this.dynamicFieldService.dynamicFields) {
      this.newPotentialClient.get(`dyn_${field.coField}`)?.disable({ emitEvent: false });
    }
  }

  checkForm() {
    const ok = this.clientLogic.syncPotentialClientFormValidity();
    this.clientLogic.refreshPotentialClientSendBlockedState();
    this.clientLogic.updatePotentialClientSaveButtonAvailability();
    this.clientLogic.updatePotentialClientSendButtonAvailability();
    return Promise.resolve(ok);
  }

  onChanges(): void {
    this.newPotentialClient.valueChanges.subscribe(() => {
      this.checkForm();
      this.clientLogic.notifyPotentialClientEdited();
      this.clientLogic.newPotentialClientChanged = true;
    });
  }

  shouldShowEnterpriseSendError(): boolean {
    return this.clientLogic.sendValidationAttempted
      && this.clientLogic.isPotentialClientEnterpriseMissing();
  }

  shouldShowFieldSendError(controlName: string): boolean {
    if (!this.clientLogic.sendValidationAttempted) {
      return false;
    }
    const control = this.newPotentialClient.get(controlName);
    return !!control && control.errors != null;
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

  private applyPotentialTextMax(
    raw: string | null | undefined,
    field: PotentialClientTextField,
  ): string {
    return applyTextCommentMaxLength(
      this.cleanString(raw || ''),
      this.fieldMax[field],
    );
  }

  onNaClientChange() {
    const clean = this.applyPotentialTextMax(this.newPotentialClient.get('naClient')?.value, 'naClient');
    if (this.clientLogic.potentialClient.naClient !== clean) {
      this.clientLogic.potentialClient.naClient = clean;
    }
    if (this.naClientInput && this.naClientInput.value !== clean) {
      this.naClientInput.value = clean;
    }
  }

  onNuRifChange() {
    const clean = this.applyPotentialTextMax(this.newPotentialClient.get('nuRif')?.value, 'nuRif');
    if (this.clientLogic.potentialClient.nuRif !== clean) {
      this.clientLogic.potentialClient.nuRif = clean;
    }
    if (this.nuRifInput && this.nuRifInput.value !== clean) {
      this.nuRifInput.value = clean;
    }
  }

  onTxAddressChange() {
    const clean = this.applyPotentialTextMax(this.newPotentialClient.get('txAddress')?.value, 'txAddress');
    if (this.clientLogic.potentialClient.txAddress !== clean) {
      this.clientLogic.potentialClient.txAddress = clean;
    }
    if (this.txAddressInput && this.txAddressInput.value !== clean) {
      this.txAddressInput.value = clean;
    }
  }

  onTxAddressDispatchChange() {
    const clean = this.applyPotentialTextMax(
      this.newPotentialClient.get('txAddressDispatch')?.value,
      'txAddressDispatch',
    );
    if (this.clientLogic.potentialClient.txAddressDispatch !== clean) {
      this.clientLogic.potentialClient.txAddressDispatch = clean;
    }
    if (this.txAddressDispatchInput && this.txAddressDispatchInput.value !== clean) {
      this.txAddressDispatchInput.value = clean;
    }
  }

  onTxClientChange() {
    const clean = this.applyPotentialTextMax(this.newPotentialClient.get('txClient')?.value, 'txClient');
    if (this.clientLogic.potentialClient.txClient !== clean) {
      this.clientLogic.potentialClient.txClient = clean;
    }
    if (this.txClientInput && this.txClientInput.value !== clean) {
      this.txClientInput.value = clean;
    }
  }

  onNaResponsibleChange() {
    const clean = this.applyPotentialTextMax(
      this.newPotentialClient.get('naResponsible')?.value,
      'naResponsible',
    );
    if (this.clientLogic.potentialClient.naResponsible !== clean) {
      this.clientLogic.potentialClient.naResponsible = clean;
    }
    if (this.naResponsibleInput && this.naResponsibleInput.value !== clean) {
      this.naResponsibleInput.value = clean;
    }
  }

  onEmClientChange() {
    const clean = this.applyPotentialTextMax(this.newPotentialClient.get('emClient')?.value, 'emClient');
    if (this.clientLogic.potentialClient.emClient !== clean) {
      this.clientLogic.potentialClient.emClient = clean;
    }
    if (this.emClientInput && this.emClientInput.value !== clean) {
      this.emClientInput.value = clean;
    }
  }

  onNuPhoneChange() {
    const clean = this.applyPotentialTextMax(this.newPotentialClient.get('nuPhone')?.value, 'nuPhone');
    if (this.clientLogic.potentialClient.nuPhone !== clean) {
      this.clientLogic.potentialClient.nuPhone = clean;
    }
    if (this.nuPhoneInput && this.nuPhoneInput.value !== clean) {
      this.nuPhoneInput.value = clean;
    }
  }

  onNaWebSiteChange() {
    const clean = this.applyPotentialTextMax(this.newPotentialClient.get('naWebSite')?.value, 'naWebSite');
    if (this.clientLogic.potentialClient.naWebSite !== clean) {
      this.clientLogic.potentialClient.naWebSite = clean;
    }
    if (this.naWebSiteInput && this.naWebSiteInput.value !== clean) {
      this.naWebSiteInput.value = clean;
    }
  }

  onCoordenadaChange() {
    this.clientLogic.viewCoordenadaPotentialClient(this.clientLogic.potentialClient, 'potentialClient');
  }
}
