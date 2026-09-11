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
import {
  COLLECT_STATUS_TO_SEND,
  VISIT_STATUS_TO_SEND,
  VISIT_STATUS_VISITED,
  VISIT_STATUS_NOT_VISITED,
} from 'src/app/utils/appConstants';

describe('AutoSendService', () => {
  let service: AutoSendService;
  let executeSqlSpy: jasmine.Spy;
  let runPendingQueueSpy: jasmine.Spy;
  let alertModalSpy: jasmine.Spy;
  let getVisitSpy: jasmine.Spy;
  let getNuAttachImagesSpy: jasmine.Spy;

  beforeEach(() => {
    executeSqlSpy = jasmine.createSpy('executeSql').and.resolveTo({ rows: { length: 0, item: () => null } });
    alertModalSpy = jasmine.createSpy('alertModal');
    getVisitSpy = jasmine.createSpy('getVisit');
    getNuAttachImagesSpy = jasmine.createSpy('getNuAttachImages').and.resolveTo(0);

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
            getNuAttachImages: getNuAttachImagesSpy,
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

  it('shows 118 alert once per session and keeps pending without stopping retries', async () => {
    localStorage.setItem('connected', 'true');
    (service as any).callService.and.returnValue(
      of({
        errorCode: '118',
        errorMessage: 'Rechazo de negocio 118',
      })
    );

    const first = await service.sendTransaction({ payload: 'x' }, 'order', 'CO-118');
    const second = await service.sendTransaction({ payload: 'x' }, 'order', 'CO-118');

    expect(first).toBeTrue();
    expect(second).toBeTrue();
    expect(alertModalSpy).toHaveBeenCalledTimes(1);
    expect(executeSqlSpy).not.toHaveBeenCalledWith(
      jasmine.stringMatching(/DELETE FROM pending_transactions/),
      jasmine.any(Array)
    );

    service.resetSessionBusinessRejectAlerts();
    await service.sendTransaction({ payload: 'x' }, 'order', 'CO-118b');
    expect(alertModalSpy).toHaveBeenCalledTimes(2);
  });

  it('treats 119 like 118 for session alert dedupe', async () => {
    localStorage.setItem('connected', 'true');
    (service as any).callService.and.returnValue(
      of({
        errorCode: '119',
        errorMessage: 'Rechazo de negocio 119',
      })
    );

    await service.sendTransaction({ payload: 'x' }, 'visit', 'V-119');
    await service.sendTransaction({ payload: 'x' }, 'visit', 'V-119');

    expect(alertModalSpy).toHaveBeenCalledTimes(1);
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

    let visitPendingDeleted = false;
    executeSqlSpy.and.callFake((sql: string) => {
      if (
        typeof sql === 'string' &&
        sql.includes('FROM pending_transactions') &&
        !sql.includes('attachments') &&
        !sql.includes('DELETE') &&
        !sql.includes('INSERT') &&
        !sql.includes('UPDATE')
      ) {
        if (visitPendingDeleted) {
          return Promise.resolve({ rows: { length: 0, item: () => null } });
        }
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
    spyOn(service as any, 'deletePendingTransaction').and.callFake(async () => {
      visitPendingDeleted = true;
    });

    localStorage.setItem('connected', 'true');

    await Promise.all([service.runPendingQueue(), service.runPendingQueue(), service.ngOnInit()]);

    expect(callCount).toBe(1);
    expect(getVisitSpy).toHaveBeenCalledTimes(1);
  });

  it('COB-PREPAID-006: sendCollectPendingNow delega en dispatchCollectTransaction', async () => {
    const dispatchSpy = spyOn<any>(service, 'dispatchCollectTransaction').and.resolveTo(true);

    const sent = await service.sendCollectPendingNow('ANT-001');

    expect(sent).toBeTrue();
    expect(dispatchSpy).toHaveBeenCalledWith('ANT-001');
  });

  it('COB-PREPAID-006: isCollectUnsent true tras 400 (fuera de pending, aún Por Enviar)', async () => {
    const collectionService = TestBed.inject(CollectionService) as CollectionService;
    collectionService.getCollection = jasmine.createSpy('getCollection').and.resolveTo({
      coCollection: '1789140257081.0',
      idCollection: 0,
      stDelivery: COLLECT_STATUS_TO_SEND,
      stCollection: COLLECT_STATUS_TO_SEND,
    } as any);

    const unsent = await service.isCollectUnsent('1789140257081.0');

    expect(unsent).toBeTrue();
  });

  it('COB-PREPAID-006: isCollectUnsent false cuando ya tiene id_collection', async () => {
    const collectionService = TestBed.inject(CollectionService) as CollectionService;
    collectionService.getCollection = jasmine.createSpy('getCollection').and.resolveTo({
      coCollection: 'ANT-OK',
      idCollection: 99,
      stDelivery: COLLECT_STATUS_TO_SEND,
      stCollection: COLLECT_STATUS_TO_SEND,
    } as any);

    const unsent = await service.isCollectUnsent('ANT-OK');

    expect(unsent).toBeFalse();
  });

  it('COB-PREPAID-002: runPendingQueue during processing marks dirty and sends newly queued item', async () => {
    runPendingQueueSpy.and.callThrough();

    const firstCo = 'COL-A';
    const secondCo = 'COL-B';
    let pendingRows: Array<{ co_transaction: string; id_transaction: number; type: string }> = [
      { co_transaction: firstCo, id_transaction: 0, type: 'collect' },
    ];

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
            length: pendingRows.length,
            item: (i: number) => pendingRows[i],
          },
        });
      }
      return Promise.resolve({ rows: { length: 0, item: () => null } });
    });

    const settled: string[] = [];
    spyOn(service as any, 'settlePendingTransaction').and.callFake(async (pt: { coTransaction: string }) => {
      settled.push(pt.coTransaction);
      if (pt.coTransaction === firstCo) {
        pendingRows = [
          { co_transaction: secondCo, id_transaction: 0, type: 'collect' },
        ];
        void service.runPendingQueue();
        await new Promise((resolve) => setTimeout(resolve, 20));
      } else if (pt.coTransaction === secondCo) {
        pendingRows = [];
      }
      return true;
    });

    localStorage.setItem('connected', 'true');

    await service.runPendingQueue();

    expect(settled).toEqual([firstCo, secondCo]);
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

  it('updateTransaction visit with is_visited false persists NOT_VISITED', async () => {
    const coVisit = 'VIS-REAG-001';
    executeSqlSpy.and.callFake((sql: string) => {
      if (typeof sql === 'string' && sql.includes('SELECT is_visited')) {
        return Promise.resolve({
          rows: {
            length: 1,
            item: () => ({ isVisited: false }),
          },
        });
      }
      return Promise.resolve({ rows: { length: 0, item: () => null } });
    });

    await service.updateTransaction(coVisit, 101, 'visit');

    expect(executeSqlSpy).toHaveBeenCalledWith(
      'UPDATE visits SET id_visit = ?, st_visit = ? WHERE co_visit = ?',
      [101, VISIT_STATUS_NOT_VISITED, coVisit],
    );
  });

  it('updateTransaction visit with is_visited true and is_reassigned true persists VISITED', async () => {
    const coVisit = 'VIS-REAG-002';
    executeSqlSpy.and.callFake((sql: string) => {
      if (typeof sql === 'string' && sql.includes('SELECT is_visited')) {
        return Promise.resolve({
          rows: {
            length: 1,
            item: () => ({ isVisited: true, isReassigned: true }),
          },
        });
      }
      return Promise.resolve({ rows: { length: 0, item: () => null } });
    });

    await service.updateTransaction(coVisit, 202, 'visit');

    expect(executeSqlSpy).toHaveBeenCalledWith(
      'UPDATE visits SET id_visit = ?, st_visit = ? WHERE co_visit = ?',
      [202, VISIT_STATUS_VISITED, coVisit],
    );
  });

  it('sets visit attachment fields from persisted images/files count before POST', async () => {
    const coVisit = 'VIS-WEB-001';
    getVisitSpy.and.resolveTo({
      coVisit,
      idVisit: 10,
      stVisit: VISIT_STATUS_TO_SEND,
      visitDetails: [],
      coordenadaSaved: false,
      hasAttachments: false,
      nuAttachments: 0,
    });
    getNuAttachImagesSpy.and.resolveTo(2);

    const sendTransactionSpy = spyOn<any>(service, 'sendTransaction').and.resolveTo(true);

    await (service as any).dispatchVisitTransaction(coVisit);

    expect(getNuAttachImagesSpy).toHaveBeenCalledWith(
      jasmine.any(Object),
      coVisit,
      'visitas',
    );
    expect(sendTransactionSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        visit: jasmine.objectContaining({
          hasAttachments: true,
          nuAttachments: 2,
        }),
      }),
      'visit',
      coVisit,
    );
  });

  it('falls back to visit row attachment metadata when persisted count is zero', async () => {
    const coVisit = 'VIS-WEB-002';
    getVisitSpy.and.resolveTo({
      coVisit,
      idVisit: 10,
      stVisit: VISIT_STATUS_TO_SEND,
      visitDetails: [],
      coordenadaSaved: false,
      hasAttachments: 'true',
      nuAttachments: 3,
    });
    getNuAttachImagesSpy.and.resolveTo(0);

    const sendTransactionSpy = spyOn<any>(service, 'sendTransaction').and.resolveTo(true);

    await (service as any).dispatchVisitTransaction(coVisit);

    expect(sendTransactionSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        visit: jasmine.objectContaining({
          hasAttachments: true,
          nuAttachments: 3,
        }),
      }),
      'visit',
      coVisit,
    );
  });
});
