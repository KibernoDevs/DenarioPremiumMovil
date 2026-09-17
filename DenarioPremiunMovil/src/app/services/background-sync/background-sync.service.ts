import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Network } from '@capacitor/network';
import { Platform } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import createTables from 'src/assets/database/createTables.json';

import { AutoSendService } from '../autoSend/auto-send.service';
import { ServicesService } from '../services.service';

@Injectable({ providedIn: 'root' })
export class BackgroundSyncService {
  private started = false;
  private syncing = false;
  private readonly intervalMs = 5 * 60 * 1000; // 5 minutes
  private timerId?: ReturnType<typeof setInterval>;
  // Tablas a sincronizar en segundo plano (IDs de tableKeyMap en synchronization.component)
  private readonly backgroundTableIds = [6, 13, 23, 25,33]; //document_sales, price_lists, lists, stocks
  private sqlTableMap: Record<string, { table: string; id: string; idName: string }> = {};
  private tableKeyMap: Record<number, string> = {
    6: 'document_sales',
    13: 'price_lists',
    23: 'lists',
    25: 'stocks',
    33: 'visits'
  };
  private autoSend = inject(AutoSendService);
  private services = inject(ServicesService);
  private synchronizationServices = inject(SynchronizationDBService)

  constructor(
    private http: HttpClient,
    private router: Router,
    private platform: Platform,
    private zone: NgZone
  ) { }

  async start() {
    if (this.started) return;
    this.started = true;
    console.log('[BackgroundSync] start() called');
    await this.platform.ready();
    console.log('[BackgroundSync] platform ready');

    Network.addListener('networkStatusChange', status => {
      console.log('[BackgroundSync] networkStatusChange', status);
      if (status.connected) {
        this.trySync('network-recovered');
      }
    });

    this.timerId = setInterval(() => this.trySync('interval'), this.intervalMs);
    console.log('[BackgroundSync] timer set', this.intervalMs, 'ms');
    this.trySync('startup');
  }

  async stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
    this.started = false;
  }

  private async trySync(reason: string) {
    if (this.syncing) return;
    this.syncing = true;
    console.log('[BackgroundSync] trySync', reason);

    try {
      const status = await Network.getStatus();
      console.log('[BackgroundSync] network status', status);
      if (!status.connected) return;

      await this.autoSend.runPendingQueue();

      /*   const hasChanges = await this.checkServerDelta();
        console.log('[BackgroundSync] checkServerDelta ->', hasChanges);
        if (hasChanges) {
          await this.syncInBackground();
        } */
      await this.syncInBackground();

    } catch (error: any) {
      if (error?.status === 401) {
        localStorage.setItem('tokenExpired', 'true');
      }
      // swallow errors to avoid crashing the scheduler
      console.warn('[BackgroundSync] skipped run', reason, error?.message ?? error);
    } finally {
      this.syncing = false;
    }
  }

  private async checkServerDelta(): Promise<boolean> {
    const idUser = localStorage.getItem('idUser');
    if (!idUser) return false;

    const lastSync = localStorage.getItem('lastUpdate') || '2000-01-01 00:00:00.000';
    const url = `${this.services.getURLService()}syncservice/getsync`;
    const payload: Record<string, any> = {
      userId: Number(idUser),
      lastSyncDate: lastSync
    };
    if (this.backgroundTableIds.length) {
      payload['tableIds'] = this.backgroundTableIds;
    }

    const authOptions = this.services.getHttpOptionsAuthorization();
    const response = await firstValueFrom(
      this.http.post<{ changes?: boolean; hasChanges?: boolean; syncRequired?: boolean }>(
        url,
        payload,
        {
          headers: authOptions.headers as Record<string, string>,
          responseType: 'json'
        }
      )
    );

    return Boolean(response?.changes ?? response?.hasChanges ?? response?.syncRequired);
  }

  private ensureSqlTableMap() {
    if (Object.keys(this.sqlTableMap).length) return;
    for (const table of createTables as any[]) {
      this.sqlTableMap[String(table.name)] = {
        table: table.name,
        id: String(table.id),
        idName: table.idName
      };
    }
  }

  private async syncInBackground() {
    this.ensureSqlTableMap();
    const versions = await this.synchronizationServices.getTablesVersion();
    const lastUpdateById: Record<number, string> = {};
    versions.forEach((row: any) => {
      lastUpdateById[row.id_table] = row.last_update;
    });

    for (const tableId of this.backgroundTableIds) {
      const key = this.tableKeyMap[tableId];
      if (!key) {
        console.warn('[BackgroundSync] tableId without key mapping', tableId);
        continue;
      }

      const cfg = this.insertConfig[key];
      if (!cfg) {
        console.warn('[BackgroundSync] missing insert config for key', key);
        continue;
      }

      const tableLastUpdate = lastUpdateById[tableId] ?? '2000-01-01 00:00:00.000';
      let page = 0;
      let morePages = true;

      while (morePages) {
        const tablaPayload: any = { [cfg.tableKey]: tableLastUpdate, page };
        const result = await firstValueFrom(this.services.getSync(JSON.stringify(tablaPayload)));
        const resTable: any = (result.data as any)[cfg.rowKey];
        const sqlInfo = this.sqlTableMap[key as string];

        if (!resTable) {
          console.error(`[BackgroundSync] Tabla no sincronizada: id=${tableId} key=${key} reason=missing_response`);
          break;
        }

        if (resTable.deletedRowsIds != null && sqlInfo) {
          await this.synchronizationServices.deleteDataTable(resTable.deletedRowsIds, sqlInfo.table, sqlInfo.idName);
        }

        if (resTable.numberOfPages === 0) {
          await this.synchronizationServices.updateVersionsTables(resTable.updateTime, Number(resTable.id));
          morePages = false;
          break;
        }

        if (resTable.row != null) {
          await cfg.batchFn(resTable.row);
          page++;

          if (page >= resTable.numberOfPages) {
            await this.synchronizationServices.updateVersionsTables(resTable.updateTime, Number(resTable.id));
            morePages = false;
          }
        } else {
          morePages = false;
        }
      }
    }
  }

  private readonly insertConfig: Record<string, {
    batchFn: (arr: any[]) => Promise<void>;
    rowKey: string;
    tableKey: string;
    pageKey?: string;
    numberOfPagesKey?: string;
  }> = {
    document_sales: {
      batchFn: this.synchronizationServices.insertDocumentSaleBatch.bind(this.synchronizationServices),
      rowKey: 'documentSaleTable',
      tableKey: 'documentSaleTableLastUpdate'
    },
    price_lists: {
      batchFn: this.synchronizationServices.insertPriceListBatch.bind(this.synchronizationServices),
      rowKey: 'priceListTable',
      tableKey: 'priceListTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    lists: {
      batchFn: this.synchronizationServices.insertListBatch.bind(this.synchronizationServices),
      rowKey: 'listTable',
      tableKey: 'listTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
    stocks: {
      batchFn: this.synchronizationServices.insertStockBatch.bind(this.synchronizationServices),
      rowKey: 'stockTable',
      tableKey: 'stockTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
      visits: {
      batchFn: this.synchronizationServices.insertVisitsBatch.bind(this.synchronizationServices),
      rowKey: 'visitTable',
      tableKey: 'visitTableLastUpdate',
      pageKey: 'page',
      numberOfPagesKey: 'numberOfPages'
    },
  };
}
