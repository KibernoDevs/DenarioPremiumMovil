import { TestBed } from '@angular/core/testing';

import { AutoSendService } from './auto-send.service';
import { delay, of } from 'rxjs';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { ServicesService } from '../services.service';
import { MessageService } from '../messageService/message.service';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { ReturnDatabaseService } from '../returns/return-database.service';
import { CollectionService } from '../collection/collection-logic.service';
import { DepositService } from '../deposit/deposit.service';
import { VisitasService } from 'src/app/visitas/visitas.service';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { ClientLocationService } from '../clientes/locationClient/client-location.service';
import { InventariosLogicService } from '../inventarios/inventarios-logic.service';
import { PotentialClientDatabaseServicesService } from '../clientes/potentialClient/potential-client-database-services.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { VISIT_STATUS_TO_SEND } from 'src/app/utils/appConstants';

describe('AutoSendService', () => {
  let service: AutoSendService;
  let executeSqlSpy: jasmine.Spy;
  let runPendingQueueSpy: jasmine.Spy;
  let alertModalSpy: jasmine.Spy;
  let getVisitSpy: jasmine.Spy;

  beforeEach(() => {
    executeSqlSpy = jasmine.createSpy('executeSql').and.resolveTo({ rows: { length: 0, item: () => null } });
    alertModalSpy = jasmine.createSpy('alertModal');
    getVisitSpy = jasmine.createSpy('getVisit');

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SynchronizationDBService,
          useValue: {
            getDatabase: () => ({ executeSql: executeSqlSpy })
          }
        },
        {
          provide: ServicesService,
          useValue: {
            getURLService: () => '',
            getHttpOptionsAuthorization: () => ({ headers: {} })
          }
        },
        { provide: MessageService, useValue: { alertModal: alertModalSpy } },
        {
          provide: AdjuntoService,
          useValue: {
            sendPendingPhotos: jasmine.createSpy('sendPendingPhotos').and.resolveTo(),
            sendPhotos: jasmine.createSpy('sendPhotos').and.resolveTo(),
          }
        },
        { provide: ReturnDatabaseService, useValue: {} },
        { provide: CollectionService, useValue: {} },
        { provide: DepositService, useValue: {} },
        { provide: VisitasService, useValue: { getVisit: getVisitSpy } },
        { provide: PedidosService, useValue: {} },
        { provide: ClientLocationService, useValue: {} },
        { provide: InventariosLogicService, useValue: {} },
        { provide: PotentialClientDatabaseServicesService, useValue: {} },
        { provide: HttpClient, useValue: {} },
        { provide: Router, useValue: {} }
      ]
    });
    service = TestBed.inject(AutoSendService);
    runPendingQueueSpy = spyOn(service, 'runPendingQueue').and.resolveTo();
    spyOn<any>(service, 'callService').and.returnValue(of({
      errorCode: '500',
      errorMessage: 'Error de prueba'
    }));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('moves bad request transactions to failed_transactions and continues the queue', async () => {
    (service as any).callService.and.returnValue(
      of({
        httpStatus: 400,
        errorCode: '400',
        errorMessage: 'Bad Request'
      })
    );
    localStorage.setItem('connected', 'true');

    await service.sendTransaction({ payload: 'x' }, 'order', 'CO-1');
    await Promise.resolve();

    expect(executeSqlSpy).toHaveBeenCalledWith(
      jasmine.stringMatching(/INSERT INTO failed_transactions/),
      jasmine.any(Array)
    );
    expect(executeSqlSpy).toHaveBeenCalledWith(
      jasmine.stringMatching(/DELETE FROM pending_transactions/),
      ['CO-1', 'order']
    );
    expect(alertModalSpy).not.toHaveBeenCalled();
  });

  it('keeps pending for server errors greater than 99 that are not bad request', async () => {
    localStorage.setItem('connected', 'true');

    await service.sendTransaction({ payload: 'x' }, 'order', 'CO-2');
    await Promise.resolve();

    expect(executeSqlSpy).not.toHaveBeenCalledWith(
      jasmine.stringMatching(/INSERT INTO failed_transactions/),
      jasmine.any(Array)
    );
    expect(executeSqlSpy).not.toHaveBeenCalledWith(
      jasmine.stringMatching(/DELETE FROM pending_transactions/),
      jasmine.any(Array)
    );
  });

  it('delegates ngOnInit to runPendingQueue', () => {
    service.ngOnInit();
    expect(runPendingQueueSpy).toHaveBeenCalled();
  });

  it('sends a visit only once when queue is triggered concurrently with multiple incidences', async () => {
    runPendingQueueSpy.and.callThrough();

    const coVisit = 'VIS-001';
    getVisitSpy.and.resolveTo({
      coVisit,
      idVisit: 0,
      stVisit: VISIT_STATUS_TO_SEND,
      visitDetails: [
        { coIncid: 1, coType: 1, coCause: 1, txDescription: 'a' },
        { coIncid: 2, coType: 1, coCause: 2, txDescription: 'b' },
        { coIncid: 3, coType: 1, coCause: 3, txDescription: 'c' },
      ],
      coordenadaSaved: false,
    });

    executeSqlSpy.and.callFake((sql: string) => {
      if (
        typeof sql === 'string' &&
        sql.includes('FROM pending_transactions') &&
        !sql.includes('attachments') &&
        !sql.includes('DELETE') &&
        !sql.includes('INSERT') &&
        !sql.includes('UPDATE')
      ) {
        return Promise.resolve({
          rows: {
            length: 1,
            item: () => ({
              co_transaction: coVisit,
              id_transaction: 0,
              type: 'visit',
            }),
          },
        });
      }
      return Promise.resolve({ rows: { length: 0, item: () => null } });
    });

    let callCount = 0;
    (service as any).callService.and.callFake(() => {
      callCount++;
      return of({
        errorCode: '000',
        errorMessage: 'OK',
        coTransaction: coVisit,
        type: 'visit',
        idVisit: 99,
      }).pipe(delay(40));
    });

    spyOn(service as any, 'persistServerSuccessForPending').and.resolveTo();
    spyOn(service as any, 'deletePendingTransaction').and.resolveTo();

    localStorage.setItem('connected', 'true');

    await Promise.all([service.runPendingQueue(), service.runPendingQueue(), service.ngOnInit()]);

    expect(callCount).toBe(1);
    expect(getVisitSpy).toHaveBeenCalledTimes(1);
  });

  it('skips duplicate in-flight visit sends for the same coVisit', async () => {
    runPendingQueueSpy.and.stub();

    const coVisit = 'VIS-002';
    getVisitSpy.and.resolveTo({
      coVisit,
      idVisit: 0,
      stVisit: VISIT_STATUS_TO_SEND,
      visitDetails: [
        { coIncid: 1, coType: 1, coCause: 1, txDescription: 'a' },
        { coIncid: 2, coType: 1, coCause: 2, txDescription: 'b' },
      ],
      coordenadaSaved: false,
    });

    let callCount = 0;
    (service as any).callService.and.callFake(() => {
      callCount++;
      return of({
        errorCode: '000',
        errorMessage: 'OK',
        coTransaction: coVisit,
        type: 'visit',
        idVisit: 77,
      }).pipe(delay(40));
    });

    spyOn(service as any, 'persistServerSuccessForPending').and.resolveTo();
    spyOn(service as any, 'deletePendingTransaction').and.resolveTo();
    localStorage.setItem('connected', 'true');

    const pending = [{ coTransaction: coVisit, idTransaction: 0, type: 'visit' }];
    await Promise.all([
      service.initTransaction(pending),
      service.initTransaction(pending),
    ]);

    expect(callCount).toBe(1);
  });
});
