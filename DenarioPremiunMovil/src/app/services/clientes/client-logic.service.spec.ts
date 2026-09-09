import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ModalController } from '@ionic/angular';

import { ClientLogicService } from './client-logic.service';
import { CurrencyService } from '../currency/currency.service';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { ClientesDatabaseServicesService } from './clientes-database-services.service';
import { PotentialClientDatabaseServicesService } from './potentialClient/potential-client-database-services.service';
import { MessageService } from '../messageService/message.service';
import { EnterpriseService } from '../enterprise/enterprise.service';
import { ServicesService } from '../services.service';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import {
  CLIENT_POTENTIAL_STATUS_SENT,
  CLIENT_POTENTIAL_STATUS_TO_SEND,
} from 'src/app/utils/appConstants';

describe('ClientLogicService', () => {
  let service: ClientLogicService;
  let currencyService: CurrencyService;
  const rate = 737.88;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ClientLogicService,
        { provide: SynchronizationDBService, useValue: { getDatabase: () => ({}) } },
        { provide: ClientesDatabaseServicesService, useValue: {} },
        { provide: PotentialClientDatabaseServicesService, useValue: {} },
        { provide: MessageService, useValue: {} },
        { provide: EnterpriseService, useValue: {} },
        { provide: ServicesService, useValue: {} },
        {
          provide: AdjuntoService,
          useValue: {
            weightLimitExceeded: false,
            hasItems: () => true,
          },
        },
        { provide: ModalController, useValue: { create: () => Promise.resolve({}) } },
        {
          provide: GlobalConfigService,
          useValue: {
            get: (clave: string) => {
              if (clave === 'multiCurrency') return 'true';
              if (clave === 'transportRole') return 'false';
              return '';
            },
          },
        },
        {
          provide: CurrencyService,
          useValue: {
            multimoneda: true,
            hasValidExchangeRate: () => true,
            toLocalCurrency: (n: number) => n * rate,
            toHardCurrency: (n: number) => n / rate,
            toOppositeCurrency: (_co: string, n: number) => n,
            getLocalCurrency: () => ({ coCurrency: 'BS' }),
            getHardCurrency: () => ({ coCurrency: 'USD' }),
            getCurrencyModule: () => ({
              localCurrencyDefault: 'false',
              showConversion: 'true',
            }),
          },
        },
      ],
    });
    service = TestBed.inject(ClientLogicService);
    currencyService = TestBed.inject(CurrencyService);

    service.localCurrency = { coCurrency: 'BS' } as any;
    service.hardCurrency = { coCurrency: 'USD' } as any;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('fixClientListSaldos / CLI-SALDOS-001', () => {
    it('A AS04: co_currency BS + buckets docs 0/2096 → USD 2096, no 2,84; no muta coCurrency', () => {
      currencyService.multimoneda = true;
      const clients = [{ coCurrency: 'BS', saldo1: 0, saldo2: 2096.23 }] as any[];
      service.fixClientListSaldos(clients);

      expect(clients[0].coCurrency).toBe('BS');
      expect(clients[0].saldo2).toBeCloseTo(2096.23, 2);
      expect(clients[0].saldo1).toBeCloseTo(2096.23 * rate, 0);
      expect(clients[0].saldo2).not.toBeCloseTo(2.84, 1);
    });

    it('B cliente correcto local: buckets L/0 → Saldo BS = L', () => {
      currencyService.multimoneda = true;
      const clients = [{ coCurrency: 'USD', saldo1: 1000, saldo2: 0 }] as any[];
      service.fixClientListSaldos(clients);

      expect(clients[0].coCurrency).toBe('USD');
      expect(clients[0].saldo1).toBeCloseTo(1000, 2);
      expect(clients[0].saldo2).toBeCloseTo(1000 / rate, 2);
    });
  });

  describe('resolveClientBalanceTotals', () => {
    it('local/hard combine (document buckets)', () => {
      const totals = service.resolveClientBalanceTotals(0, 2096.23, 'BS', true);
      expect(totals.saldoFuerte).toBeCloseTo(2096.23, 2);
      expect(totals.saldoLocal).toBeCloseTo(2096.23 * rate, 0);
    });

    it('sin tasa: opuesto en 0', () => {
      spyOn(currencyService, 'hasValidExchangeRate').and.returnValue(false);
      const pair = service.resolveClientCurrencyPairBalances(100, 50, 'USD');
      expect(pair.saldoCliente).toBe(100);
      expect(pair.saldoOpuesto).toBe(0);
    });
  });

  describe('DM-CLT-032 / canShowConversion', () => {
    it('DM-CLT-032: checkUserStatus marca esTransportista desde localStorage', () => {
      localStorage.setItem('user', JSON.stringify({ transportista: true }));
      service.checkUserStatus();
      expect(service.esTransportista).toBeTrue();

      localStorage.setItem('user', JSON.stringify({ transportista: false }));
      service.checkUserStatus();
      expect(service.esTransportista).toBeFalse();

      localStorage.removeItem('user');
      service.checkUserStatus();
      expect(service.esTransportista).toBeFalse();
    });

    it('canShowConversion exige showConversion + multiCurrency + tasa', () => {
      service.showConversion = true;
      service.multiCurrency = true;
      spyOn(currencyService, 'hasValidExchangeRate').and.returnValue(true);
      expect(service.canShowConversion()).toBeTrue();

      (currencyService.hasValidExchangeRate as jasmine.Spy).and.returnValue(false);
      expect(service.canShowConversion()).toBeFalse();
    });

    it('CLI-CURRENCY-001: localCurrencyDefault=false muestra USD primero en etiquetas y saldos', () => {
      service.localCurrencyDefault = false;
      service.localCurrency = { coCurrency: 'BS' } as any;
      service.hardCurrency = { coCurrency: 'USD' } as any;

      expect(service.getPrimaryCurrencyLabel()).toBe('USD');
      expect(service.getSecondaryCurrencyLabel()).toBe('BS');

      const client = { saldo1: 1000, saldo2: 50 } as any;
      expect(service.getPrimarySaldo(client)).toBe(50);
      expect(service.getSecondarySaldo(client)).toBe(1000);
      expect(service.pickPrimaryFromLocalHard(1000, 50)).toBe(50);
      expect(service.pickSecondaryFromLocalHard(1000, 50)).toBe(1000);
    });

    it('CLI-CURRENCY-001: localCurrencyDefault=true muestra BS primero', () => {
      service.localCurrencyDefault = true;

      expect(service.getPrimaryCurrencyLabel()).toBe('BS');
      expect(service.getSecondaryCurrencyLabel()).toBe('USD');

      const client = { saldo1: 1000, saldo2: 50 } as any;
      expect(service.getPrimarySaldo(client)).toBe(1000);
      expect(service.getSecondarySaldo(client)).toBe(50);
    });
  });

  describe('DM-CLT-002 / isDueSoon', () => {
    it('DM-CLT-002: vencido ayer → true; mañana → false; null → false', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(service.isDueSoon(yesterday)).toBeTrue();
      expect(service.isDueSoon(tomorrow)).toBeFalse();
      expect(service.isDueSoon(null)).toBeFalse();
    });
  });

  describe('POT-SAVE-001 / POT-SEND-001 Clientes potenciales', () => {
    function buildValidPotentialForm(): FormGroup {
      return new FormGroup({
        idEnterprise: new FormControl(1, [Validators.required]),
        naClient: new FormControl('Cliente QA', [Validators.required]),
        nuRif: new FormControl('J-00000021-1', [Validators.required]),
        txAddress: new FormControl('Dir 1', [Validators.required]),
        txAddressDispatch: new FormControl('Dir 2', [Validators.required]),
        txClient: new FormControl('Obs', [Validators.required]),
        naResponsible: new FormControl('Resp', [Validators.required]),
        emClient: new FormControl('qa@test.com', [Validators.required, Validators.email]),
        nuPhone: new FormControl('04121234021', [Validators.required]),
      });
    }

    beforeEach(() => {
      service.clientTags.set('CLI_POT_MSJ_ERROR_NO_ENTERPRISE', 'Seleccione empresa');
      service.clientTags.set('CLI_POT_MSJ_ERROR_INCOMPLETE_FORM', 'Complete campos');
      service.clientTags.set('CLI_NEW_POT_MENSAJE_ERROR_NOMBRE_CLIENTE', 'Nombre obligatorio');
      service.potentialClient = { coordenada: '10,20' } as any;
      service.empresaSeleccionada = { idEnterprise: 1 } as any;
      service.saveSendPotentialClient = true;
      service.userMustActivateGPS = false;
    });

    it('POT-SAVE-001: Guardar ON con dirty aunque falte nombre; error al validar', () => {
      service.registerPotentialClientForm(new FormGroup({
        naClient: new FormControl('', [Validators.required]),
      }));
      service.onPotentialClientGeneralValid(true);
      service.resetPotentialClientExitBaseline();

      service.updatePotentialClientSaveButtonAvailability();
      expect(service.cannotSavePotentialClient).toBeFalse();
      expect(service.hasPotentialClientSaveErrors()).toBeTrue();
      expect(service.getPotentialClientSaveValidationMessage()).toContain('Nombre obligatorio');

      service.potentialClientForm?.get('naClient')?.setValue('Cliente QA');
      expect(service.hasPotentialClientSaveErrors()).toBeFalse();

      service.applyPotentialClientPersistSucceededBaseline();
      expect(service.cannotSavePotentialClient).toBeTrue();

      service.markPotentialClientDirty();
      service.updatePotentialClientSaveButtonAvailability();
      expect(service.cannotSavePotentialClient).toBeFalse();
    });

    it('POT-SAVE-001: Guardar no exige formulario completo', () => {
      service.registerPotentialClientForm(new FormGroup({
        idEnterprise: new FormControl(1, [Validators.required]),
        naClient: new FormControl('Solo nombre', [Validators.required]),
        nuRif: new FormControl('', [Validators.required]),
        naResponsible: new FormControl('', [Validators.required]),
      }));
      service.onPotentialClientGeneralValid(true);
      service.resetPotentialClientExitBaseline();

      expect(service.hasPotentialClientSaveErrors()).toBeFalse();
      expect(service.hasPotentialClientFieldErrors()).toBeTrue();
      service.updatePotentialClientSaveButtonAvailability();
      expect(service.cannotSavePotentialClient).toBeFalse();
    });

    it('POT-SEND-001: Enviar ON con General aunque form incompleto; no se apaga tras fallo', () => {
      service.registerPotentialClientForm(new FormGroup({
        idEnterprise: new FormControl(1, [Validators.required]),
        naClient: new FormControl('', [Validators.required]),
      }));
      service.onPotentialClientGeneralValid(true);
      service.sendBlockedByFields = true;

      service.updatePotentialClientSendButtonAvailability();
      expect(service.cannotSendPotentialClient).toBeFalse();
      expect(service.hasPotentialClientFieldErrors()).toBeTrue();
      expect(service.getPotentialClientValidationMessage()).toContain('Nombre obligatorio');
    });

    it('POT-SEND-001: al completar campos se limpia sendBlockedByFields', () => {
      const form = buildValidPotentialForm();
      form.get('naResponsible')?.setValue('');
      service.registerPotentialClientForm(form);
      service.onPotentialClientGeneralValid(true);
      service.sendBlockedByFields = true;

      expect(service.hasPotentialClientFieldErrors()).toBeTrue();
      service.refreshPotentialClientSendBlockedState();
      expect(service.sendBlockedByFields).toBeTrue();

      form.get('naResponsible')?.setValue('Resp');
      service.notifyPotentialClientEdited();
      expect(service.sendBlockedByFields).toBeFalse();
      expect(service.cannotSendPotentialClient).toBeFalse();
    });
    it('POT-SEND-001: naResponsible vacío bloquea validación al click', () => {
      const form = buildValidPotentialForm();
      form.get('naResponsible')?.setValue('');
      service.registerPotentialClientForm(form);
      service.onPotentialClientGeneralValid(true);

      expect(service.hasPotentialClientFieldErrors()).toBeTrue();
      expect(service.getPotentialClientValidationMessage()).toContain('Complete campos');
    });

    it('POT-SEND-001: signatureClient no exige adjuntos (solo muestra firma)', () => {
      spyOn(service['globalConfig'], 'get').and.callFake((key: string) => {
        if (key === 'signatureClient') {
          return 'true';
        }
        return '';
      });
      service.registerPotentialClientForm(buildValidPotentialForm());
      service.onPotentialClientGeneralValid(true);
      spyOn(service.adjuntoService, 'hasItems').and.returnValue(false);

      expect(service.hasPotentialClientFieldErrors()).toBeFalse();
    });

    it('POT-SEND-001: estatus por enviar queda read-only', () => {
      service.registerPotentialClientForm(new FormGroup({
        naClient: new FormControl('Cliente QA', [Validators.required]),
      }));
      service.potentialClient.stPotentialClient = CLIENT_POTENTIAL_STATUS_TO_SEND;
      service.onPotentialClientGeneralValid(true);

      service.updatePotentialClientSaveButtonAvailability();
      service.updatePotentialClientSendButtonAvailability();
      expect(service.cannotSavePotentialClient).toBeTrue();
      expect(service.cannotSendPotentialClient).toBeTrue();
    });

    it('POT-SAVE-002: reabrir guardado deja Guardar OFF hasta editar', () => {
      service.registerPotentialClientForm(new FormGroup({
        naClient: new FormControl('Cliente QA', [Validators.required]),
      }));
      service.onPotentialClientGeneralValid(true);
      service.markPotentialClientOpenedFromPersistedCopy();

      expect(service.cannotSavePotentialClient).toBeTrue();
      expect(service.cannotSendPotentialClient).toBeFalse();

      service.markPotentialClientDirty();
      service.updatePotentialClientSaveButtonAvailability();
      expect(service.cannotSavePotentialClient).toBeFalse();
    });
  });

  describe('getClientTag', () => {
    it('resuelve DENARIO_DOC_VIGENTE desde clientTagsDenario si falta en clientTags', () => {
      service.clientTagsDenario.set('DENARIO_DOC_VIGENTE', 'Documento vigente');

      expect(service.getClientTag('DENARIO_DOC_VIGENTE')).toBe('Documento vigente');
    });

    it('prioriza clientTags sobre clientTagsDenario', () => {
      service.clientTags.set('DENARIO_DOC_VIGENTE', 'Vigente lista');
      service.clientTagsDenario.set('DENARIO_DOC_VIGENTE', 'Documento vigente');

      expect(service.getClientTag('DENARIO_DOC_VIGENTE')).toBe('Vigente lista');
    });
  });
});
