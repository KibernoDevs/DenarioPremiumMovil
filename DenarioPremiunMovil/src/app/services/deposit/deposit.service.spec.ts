import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { DepositService } from './deposit.service';
import { DEPOSIT_APPROVAL_STATUS_REJECTED, DEPOSITO_STATUS_SAVED, DEPOSITO_STATUS_SENT, DEPOSITO_STATUS_TO_SEND } from 'src/app/utils/appConstants';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';

describe('DepositService', () => {
  let service: DepositService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(DepositService);
    service.userMustActivateGPS = false;
    service.deposit = {
      depositCollect: [],
      coBank: '',
      nuAccount: '',
      nuDocument: '',
      daDocument: '',
      coordenada: '',
      stDelivery: DEPOSITO_STATUS_SAVED,
    } as any;
    service.depositTags.set('DEP_MSJ_ERROR_NO_BANK', 'Seleccione un banco');
    service.depositTags.set('DEP_MSJ_ERROR_NO_COLLECT', 'Seleccione un cobro');
    service.depositTags.set('DEP_MSJ_ERROR_NO_DOCUMENT', 'Ingrese plantilla');
    service.depositTags.set('DEP_MSJ_ERROR_NO_ATTACHMENTS', 'Adjunte firma');
    service.adjuntoService.weightLimitExceeded = false;
    spyOn(service.adjuntoService, 'hasItems').and.returnValue(true);
    spyOn(service.globalConfig, 'get').and.callFake((key: string) => {
      if (key === 'signatureCollection') {
        return 'false';
      }
      if (key === 'userMustActivateGPS') {
        return 'false';
      }
      return '';
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('DEP-SAVE-001 Guardar borrador sin exigir cobros/firma', () => {
    it('depósito nuevo sin baseline habilita Guardar sin General', () => {
      service.generalTabValidForSave = false;
      service.resetDepositExitBaseline();
      let saveEnabled: boolean | undefined;
      service.depositValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });

    it('hasDepositSaveErrors false con banco aunque no haya cobros', () => {
      service.generalTabValidForSave = true;
      service.isSelectedBank = true;
      service.deposit.coBank = 'B001';
      service.deposit.nuAccount = '123';
      service.deposit.depositCollect = [];

      expect(service.hasDepositSaveErrors()).toBeFalse();
      expect(service.hasDepositFieldErrors()).toBeTrue();
    });

    it('baseline limpio deshabilita Guardar', () => {
      service.depositPersistedBaseline = true;
      service.depositDirtySincePersist = false;
      let saveEnabled: boolean | undefined;
      service.depositValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeFalse();
    });

    it('markDepositDirty re-habilita Guardar tras baseline', () => {
      let saveEnabled: boolean | undefined;
      service.depositValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.applyPersistSucceededBaseline();

      expect(saveEnabled).toBeFalse();
      service.markDepositDirty();
      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });
  });

  describe('DEP-SEND-001 Enviar y validación al click', () => {
    it('Enviar ON de entrada aunque General no sea válida', () => {
      service.generalTabValidForSave = false;
      let sendEnabled: boolean | undefined;
      service.depositValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeTrue();
    });

    it('sendBlockedByFields apaga Enviar hasta editar', () => {
      service.sendBlockedByFields = true;
      let sendEnabled: boolean | undefined;
      service.depositValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeFalse();

      service.notifyDepositEdited();
      expect(service.sendBlockedByFields).toBeFalse();
      expect(sendEnabled).toBeTrue();
    });

    it('hasDepositFieldErrors true sin cobros seleccionados', () => {
      service.generalTabValidForSave = true;
      service.isSelectedBank = true;
      service.deposit.coBank = 'B001';
      service.deposit.nuAccount = '123';
      service.nuDocument = 'PLT-001';
      service.deposit.nuDocument = 'PLT-001';
      service.daDocument = '2026-01-01';
      service.deposit.daDocument = '2026-01-01';

      expect(service.hasDepositFieldErrors()).toBeTrue();
      expect(service.getDepositValidationMessage()).toContain('Seleccione un cobro');
      expect(service.resolveSendValidationFocusTab()).toBe('cobros');
    });

    it('hasDepositFieldErrors true sin número de plantilla', () => {
      service.generalTabValidForSave = true;
      service.isSelectedBank = true;
      service.deposit.coBank = 'B001';
      service.deposit.nuAccount = '123';
      service.deposit.depositCollect = [{ coCollection: 'C1' } as any];

      expect(service.hasDepositFieldErrors()).toBeTrue();
      expect(service.getDepositValidationMessage()).toContain('Ingrese plantilla');
      expect(service.resolveSendValidationFocusTab()).toBe('default');
    });

    it('SEND-TAB-001: depósito completo resolve es null y request no emite', () => {
      service.generalTabValidForSave = true;
      service.isSelectedBank = true;
      service.userMustActivateGPS = false;
      service.deposit.coBank = 'B001';
      service.deposit.nuAccount = '123';
      service.deposit.depositCollect = [{ coCollection: 'C1' } as any];
      service.nuDocument = 'PLT-001';
      service.deposit.nuDocument = 'PLT-001';
      service.daDocument = '2026-01-01';
      service.deposit.daDocument = '2026-01-01';
      let focused: string | undefined = 'sentinel';
      service.focusSendValidationTab.subscribe((tab) => focused = tab);

      expect(service.resolveSendValidationFocusTab()).toBeNull();
      service.requestSendValidationTabFocus();
      expect(focused).toBe('sentinel');
    });

    it('depósito por enviar queda read-only', () => {
      service.deposit.stDelivery = DEPOSITO_STATUS_TO_SEND;
      service.generalTabValidForSave = true;
      let saveEnabled: boolean | undefined;
      let sendEnabled: boolean | undefined;
      service.depositValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.depositValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSaveButtonAvailability();
      service.updateSendButtonAvailability();
      expect(saveEnabled).toBeFalse();
      expect(sendEnabled).toBeFalse();
    });

    it('stDeposit de aprobación no fuerza read-only; solo stDelivery como Cobros', () => {
      service.deposit.stDelivery = DEPOSITO_STATUS_SAVED;
      service.deposit.stDeposit = 2;
      expect(service.isDepositReadOnlyForEdit()).toBeFalse();

      service.deposit.stDeposit = 6;
      expect(service.isDepositReadOnlyForEdit()).toBeFalse();
    });
  });

  describe('Estatus de aprobación en lista', () => {
    beforeEach(() => {
      service.depositTags.set('DEP_DEV_SAVED', 'Guardado');
      service.depositTags.set('DEP_DEV_TO_BE_SENDED', 'Por Enviar');
      service.depositTags.set('DEP_DEV_SENDED', 'Enviado');
    });

    it('getStatusOrderName prioriza na_status del servidor cuando stDeposit != 0', () => {
      const label = service.getStatusOrderName(2, DEPOSITO_STATUS_SENT, 'Rechazado');
      expect(label).toBe('Rechazado');
    });

    it('getStatusOrderName usa historial integrado tras sync', () => {
      const label = service.getStatusOrderName(6, DEPOSITO_STATUS_SENT, 'Integrado');
      expect(label).toBe('Integrado');
    });

    it('getStatusOrderName cae a stDelivery cuando no hay na_status util', () => {
      const label = service.getStatusOrderName(0, DEPOSITO_STATUS_SAVED, null);
      expect(label).toBe('Guardado');
    });

    it('getStatusOrderName con st_deposit=0 deriva de st_delivery como Cobros', () => {
      const label = service.getStatusOrderName(0, 0, { na_status: 'Recaudado' });
      expect(label).toBe('');
    });

    it('getStatusOrderName no deja en blanco con st_deposit=0 y st_delivery enviado', () => {
      const label = service.getStatusOrderName(0, DEPOSITO_STATUS_SENT, '');
      expect(label).toBe('Enviado');
    });
  });

  describe('Liberación de cobros en depósito rechazado', () => {
    it('isDepositRejectedForCollectRelease true cuando Web rechazó depósito enviado', () => {
      expect(service.isDepositRejectedForCollectRelease(2, DEPOSITO_STATUS_SENT, 123)).toBeTrue();
    });

    it('isDepositRejectedForCollectRelease false en borrador local Por Enviar', () => {
      expect(service.isDepositRejectedForCollectRelease(
        DEPOSITO_STATUS_TO_SEND,
        DEPOSITO_STATUS_TO_SEND,
        0,
      )).toBeFalse();
    });

    it('isDepositRejectedForCollectRelease false en depósito aprobado o pendiente', () => {
      expect(service.isDepositRejectedForCollectRelease(1, DEPOSITO_STATUS_SENT, 123)).toBeFalse();
      expect(service.isDepositRejectedForCollectRelease(3, DEPOSITO_STATUS_SENT, 123)).toBeFalse();
    });

    it('saveDepositBatch borra deposit_collects cuando sync trae depósito rechazado sin cobros', async () => {
      const executed: Array<[string, unknown[]]> = [];
      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.returnValue(Promise.resolve({ rows: { length: 0, item: () => ({}) } })),
        sqlBatch: jasmine.createSpy('sqlBatch').and.callFake((queries: Array<[string, unknown[]]>) => {
          executed.push(...queries);
          return Promise.resolve(true);
        }),
      } as unknown as SQLiteObject;

      await service.saveDepositBatch(dbMock, [{
        idDeposit: 99,
        coDeposit: 'DEP-REJ-1',
        daDeposit: '2026-01-01 00:00:00',
        coBank: 'B001',
        nuAccount: '123',
        nuDocument: 'PLT',
        daDocument: '2026-01-01',
        nuAmountDoc: 100,
        coCurrency: '$',
        idEnterprise: 1,
        coEnterprise: 'DIESE',
        stDeposit: DEPOSIT_APPROVAL_STATUS_REJECTED,
        stDelivery: DEPOSITO_STATUS_SENT,
        txComment: '',
        nuAmountDocConversion: 0,
        nuValueLocal: 1,
        idCurrency: 1,
        coordenada: '',
        collectionIds: [],
      } as any]);

      const deleteCollects = executed.filter(([sql]) =>
        sql.includes('DELETE FROM deposit_collects') && (sql as string).includes('co_deposit = ?'),
      );
      expect(deleteCollects.length).toBe(1);
      expect(deleteCollects[0][1]).toEqual(['DEP-REJ-1']);

      const insertCollects = executed.filter(([sql]) => sql.includes('INSERT OR REPLACE INTO deposit_collects'));
      expect(insertCollects.length).toBe(0);
    });

    it('saveDepositBatch borra deposit_collects cuando id servidor sync sin collectionIds', async () => {
      const executed: Array<[string, unknown[]]> = [];
      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.returnValue(Promise.resolve({ rows: { length: 0, item: () => ({}) } })),
        sqlBatch: jasmine.createSpy('sqlBatch').and.callFake((queries: Array<[string, unknown[]]>) => {
          executed.push(...queries);
          return Promise.resolve(true);
        }),
      } as unknown as SQLiteObject;

      await service.saveDepositBatch(dbMock, [{
        idDeposit: 55,
        coDeposit: 'DEP-CLR-1',
        daDeposit: '2026-01-01 00:00:00',
        coBank: 'B001',
        nuAccount: '123',
        nuDocument: 'PLT',
        daDocument: '2026-01-01',
        nuAmountDoc: 100,
        coCurrency: '$',
        idEnterprise: 1,
        coEnterprise: 'DIESE',
        stDeposit: 3,
        stDelivery: DEPOSITO_STATUS_SENT,
        txComment: '',
        nuAmountDocConversion: 0,
        nuValueLocal: 1,
        idCurrency: 1,
        coordenada: '',
        collectionIds: [],
      } as any]);

      const deleteCollects = executed.filter(([sql]) =>
        sql.includes('DELETE FROM deposit_collects'),
      );
      expect(deleteCollects.length).toBe(1);
      expect(deleteCollects[0][1]).toEqual(['DEP-CLR-1']);
    });

    it('checkHistoricDeposits clasifica status_action 1 y 3 como enviados', async () => {
      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.returnValue(Promise.resolve({
          rows: {
            length: 1,
            item: () => ({ id_status: 21, status_action: 3 }),
          },
        })),
      } as unknown as SQLiteObject;

      service.listTransactionStatusDeposits = [{
        idTransactionStatus: 2,
        daTransactionStatuses: '2026-03-01 11:00:00',
        idTransactionType: 6,
        coTransactionType: 'dep',
        coTransaction: 'DEP-OK-1',
        idTransaction: 78,
        idStatus: 21,
        coStatus: 'INT',
        txComment: '',
      } as any];

      await service.checkHistoricDeposits(dbMock);
      expect(service.depositSended.length).toBe(1);
      expect(service.depositRefused.length).toBe(0);
    });

    it('checkHistoricDeposits marca depósitos con status_action=2 como rechazados', async () => {
      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.returnValue(Promise.resolve({
          rows: {
            length: 1,
            item: () => ({ id_status: 20, status_action: 2 }),
          },
        })),
      } as unknown as SQLiteObject;

      service.listTransactionStatusDeposits = [{
        idTransactionStatus: 1,
        daTransactionStatuses: '2026-03-01 10:00:00',
        idTransactionType: 6,
        coTransactionType: 'dep',
        coTransaction: 'DEP-R1',
        idTransaction: 77,
        idStatus: 20,
        coStatus: 'REJ',
        txComment: '',
      } as any];

      await service.checkHistoricDeposits(dbMock);
      expect(service.depositRefused.length).toBe(1);
      expect(service.depositRefused[0].coTransaction).toBe('DEP-R1');
    });

    it('releaseCollectsFromRefusedDeposits actualiza st_deposit y borra deposit_collects', async () => {
      const executed: Array<[string, unknown[]]> = [];
      const dbMock = {
        sqlBatch: jasmine.createSpy('sqlBatch').and.callFake((queries: Array<[string, unknown[]]>) => {
          executed.push(...queries);
          return Promise.resolve(true);
        }),
      } as unknown as SQLiteObject;

      service.depositRefused = [{
        idTransactionStatus: 1,
        daTransactionStatuses: '2026-03-01 10:00:00',
        idTransactionType: 6,
        coTransactionType: 'dep',
        coTransaction: 'DEP-R1',
        idTransaction: 77,
        idStatus: 20,
        coStatus: 'REJ',
        txComment: '',
      } as any];

      await service.releaseCollectsFromRefusedDeposits(dbMock);

      expect(executed.some(([sql, params]) =>
        sql.includes('UPDATE deposits SET st_deposit')
        && params.includes(DEPOSIT_APPROVAL_STATUS_REJECTED)
        && params.includes(77),
      )).toBeTrue();
      expect(executed.some(([sql, params]) =>
        sql.includes('DELETE FROM deposit_collects')
        && (params.includes('DEP-R1') || params.includes(77)),
      )).toBeTrue();
    });

    it('releaseCollectsFromRefusedCollections borra vínculos por co_collection', async () => {
      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.returnValue(Promise.resolve(true)),
      } as unknown as SQLiteObject;

      await service.releaseCollectsFromRefusedCollections(dbMock, ['COL-1', 'COL-1', '']);
      expect(dbMock.executeSql).toHaveBeenCalledWith(
        'DELETE FROM deposit_collects WHERE co_collection IN (?)',
        ['COL-1'],
      );
    });

    it('mergeSyncedDepositsWithLocal preserva st_deposit rechazado si sync no lo trae', async () => {
      const dbMock = {
        executeSql: jasmine.createSpy('executeSql').and.callFake((sql: string) => {
          if (sql.includes('FROM deposits')) {
            return Promise.resolve({
              rows: {
                length: 1,
                item: () => ({
                  co_deposit: 'DEP-R1',
                  da_deposit: '2026-01-01 00:00:00',
                  st_deposit: DEPOSIT_APPROVAL_STATUS_REJECTED,
                  st_delivery: DEPOSITO_STATUS_SENT,
                  id_deposit: 77,
                }),
              },
            });
          }
          return Promise.resolve({ rows: { length: 0, item: () => ({}) } });
        }),
      } as unknown as SQLiteObject;

      const merged = await service.mergeSyncedDepositsWithLocal(dbMock, [{
        idDeposit: 77,
        coDeposit: 'DEP-R1',
        daDeposit: '2026-01-01 00:00:00',
        coBank: 'B001',
        nuAccount: '123',
        nuDocument: 'PLT',
        daDocument: '2026-01-01',
        nuAmountDoc: 100,
        coCurrency: '$',
        idEnterprise: 1,
        coEnterprise: 'DIESE',
        stDeposit: 1,
        stDelivery: DEPOSITO_STATUS_SENT,
        txComment: '',
        nuAmountDocConversion: 0,
        nuValueLocal: 1,
        idCurrency: 1,
        coordenada: '',
        collectionIds: [],
      } as any]);

      expect(merged[0].stDeposit).toBe(DEPOSIT_APPROVAL_STATUS_REJECTED);
      expect(merged[0].stDelivery).toBe(DEPOSITO_STATUS_SENT);
    });
  });

  describe('DEP-SEND-001 adjuntos signatureCollection', () => {
    beforeEach(() => {
      (service.globalConfig.get as jasmine.Spy).and.callFake((key: string) => {
        if (key === 'signatureCollection') {
          return 'true';
        }
        if (key === 'userMustActivateGPS') {
          return 'false';
        }
        return '';
      });
    });

    it('signatureCollection no exige adjuntos en depósito (solo muestra firma)', () => {
      service.generalTabValidForSave = true;
      service.isSelectedBank = true;
      service.deposit.coBank = 'B001';
      service.deposit.nuAccount = '123';
      service.nuDocument = 'PLT-001';
      service.deposit.nuDocument = 'PLT-001';
      service.daDocument = '2026-01-01';
      service.deposit.daDocument = '2026-01-01';
      service.deposit.depositCollect = [{ coCollection: 'C1' } as any];
      (service.adjuntoService.hasItems as jasmine.Spy).and.returnValue(false);

      expect(service.hasDepositFieldErrors()).toBeFalse();
    });
  });
});
