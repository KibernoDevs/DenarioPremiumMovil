import { TestBed } from '@angular/core/testing';

import { AutoSendService } from './auto-send.service';
import { of } from 'rxjs';
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

describe('AutoSendService', () => {
  let service: AutoSendService;
  let executeSqlSpy: jasmine.Spy;
  let runPendingQueueSpy: jasmine.Spy;
  let alertModalSpy: jasmine.Spy;

  beforeEach(() => {
    executeSqlSpy = jasmine.createSpy('executeSql').and.resolveTo({ rows: { length: 0, item: () => null } });
    alertModalSpy = jasmine.createSpy('alertModal');

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
        { provide: AdjuntoService, useValue: {} },
        { provide: ReturnDatabaseService, useValue: {} },
        { provide: CollectionService, useValue: {} },
        { provide: DepositService, useValue: {} },
        { provide: VisitasService, useValue: {} },
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

  it('moves unhandled server errors to failed_transactions and continues the queue', async () => {
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
    expect(runPendingQueueSpy).toHaveBeenCalled();
    expect(alertModalSpy).not.toHaveBeenCalled();
  });

  it('skips bad request transactions without removing them from pending', async () => {
    (service as any).callService.and.returnValue(
      of({
        httpStatus: 400,
        errorCode: '400',
        errorMessage: 'Bad Request'
      })
    );
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
    expect(runPendingQueueSpy).toHaveBeenCalled();
  });
});
