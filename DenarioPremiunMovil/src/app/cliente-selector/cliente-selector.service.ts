import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { ServicesService } from '../services/services.service';
import { Client } from '../modelos/tables/client';
import { CurrencyModules } from '../modelos/tables/currencyModules';
import { ClientLogicService } from '../services/clientes/client-logic.service';
import { ApplicationTags } from '../modelos/tables/applicationTags';

@Injectable({
  providedIn: 'root'
})
export class ClienteSelectorService {
  private syncServ = inject(SynchronizationDBService);
  private servicesServ = inject(ServicesService);
  private clientLogic = inject(ClientLogicService);

  public tags = new Map<string, string>([]);
  public db!: SQLiteObject;
  public clientes!: Client[];
  public clienteAnterior: null | Client = null;
  public checkClient = false;

  public colorModulo: string = '';

  public nombreModulo: string = '';

  public currencyModule: CurrencyModules = {} as CurrencyModules;

  /** ped / cob / otros módulos que reusan el selector. */
  public selectionCoModule: string = '';

  ClientChanged = new Subject<Client>;
  idEnterprise: number = 0;

  private tagsLoadPromise: Promise<void> | null = null;

  constructor() {
    this.db = this.syncServ.getDatabase();
    void this.ensureTagsLoaded();
  }

  /** Recarga tags desde SQLite (CLI + COB + DEN). DEN al final para no perder leyenda DENARIO_*. */
  ensureTagsLoaded(forceReload = false): Promise<void> {
    const legendReady = this.getTag('DENARIO_DOC_VIGENTE').length > 0
      && this.getTag('DENARIO_DOC_VENCIDO').length > 0;
    if (!forceReload && legendReady) {
      return Promise.resolve();
    }
    if (this.tagsLoadPromise) {
      return this.tagsLoadPromise;
    }
    this.tagsLoadPromise = this.loadTagsFromDb().finally(() => {
      this.tagsLoadPromise = null;
    });
    return this.tagsLoadPromise;
  }

  getTag(tagKey: string, fallback = ''): string {
    const key = tagKey?.trim() ?? '';
    if (!key) {
      return fallback;
    }

    const fromSelector = this.tags.get(key);
    if (fromSelector != null && String(fromSelector).trim().length > 0) {
      return String(fromSelector).trim();
    }

    const fromClientLogic = this.clientLogic.getClientTag(key);
    if (fromClientLogic.length > 0) {
      return fromClientLogic;
    }

    const fromGlobal = this.servicesServ.tags.get(key);
    if (fromGlobal != null && String(fromGlobal).trim().length > 0) {
      return String(fromGlobal).trim();
    }

    return fallback;
  }

  private loadTagsFromDb(): Promise<void> {
    this.db = this.syncServ.getDatabase();

    return this.servicesServ.getTags(this.db, 'CLI', 'ESP').then(cliTags => {
      this.applyTagRows(cliTags);
      return this.servicesServ.getTags(this.db, 'COB', 'ESP');
    }).then(cobTags => {
      this.applyTagRows(cobTags);
      return this.servicesServ.getTags(this.db, 'DEN', 'ESP');
    }).then(denarioTags => {
      this.applyTagRows(denarioTags, true);
    });
  }

  private applyTagRows(rows: ApplicationTags[], denario = false): void {
    for (let i = 0; i < rows.length; i++) {
      this.storeTag(rows[i].coApplicationTag, rows[i].tag, denario);
    }
  }

  private storeTag(key: string, value: string, denario = false): void {
    const normalizedKey = key?.trim() ?? '';
    if (!normalizedKey) {
      return;
    }
    const normalizedValue = value != null ? String(value) : '';
    this.tags.set(normalizedKey, normalizedValue);

    if (denario || normalizedKey.startsWith('CLI_')) {
      this.clientLogic.clientTags.set(normalizedKey, normalizedValue);
    }
    if (denario) {
      this.clientLogic.clientTagsDenario.set(normalizedKey, normalizedValue);
    }
  }

  onCLientChanged(client: Client) {
    this.ClientChanged.next(client);
  }
}
