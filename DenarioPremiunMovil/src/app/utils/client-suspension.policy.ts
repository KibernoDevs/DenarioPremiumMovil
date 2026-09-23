import { Client } from '../modelos/tables/client';

export const MSG_CLIENT_SUSPENDED_ORDER = 'Cliente suspendido: no se pueden crear pedidos';
export const MSG_CLIENT_SUSPENDED_COLLECTION = 'Cliente suspendido sin deuda: no se pueden crear cobros';

export type ClientSelectionMode = 'order' | 'collection' | 'default';

function parseSqliteBoolean(value: unknown): boolean {
  return value === true
    || value === 1
    || String(value ?? '').toLowerCase() === 'true'
    || String(value ?? '') === '1';
}

export function isClientSuspended(client: Client | null | undefined): boolean {
  return parseSqliteBoolean(client?.inSuspension);
}

/** Debe: cualquier saldo abierto > 0 (saldo1/saldo2 del listado). */
export function clientHasDebt(client: Client | null | undefined): boolean {
  const s1 = Number(client?.saldo1 ?? 0);
  const s2 = Number(client?.saldo2 ?? 0);
  return s1 > 0 || s2 > 0;
}

export function canCreateOrderForClient(client: Client | null | undefined): boolean {
  return !isClientSuspended(client);
}

export function canCreateCollectionForClient(client: Client | null | undefined): boolean {
  if (!isClientSuspended(client)) {
    return true;
  }
  return clientHasDebt(client);
}

export function isClientOperationallyVisible(client: Client | null | undefined): boolean {
  if (!isClientSuspended(client)) {
    return true;
  }
  return clientHasDebt(client);
}

export function filterClientsBySelectionMode(
  clients: Client[],
  _mode: ClientSelectionMode,
): Client[] {
  if (!clients?.length) {
    return [];
  }
  return clients;
}

export function resolveClientSelectionMode(coModule: string | null | undefined): ClientSelectionMode {
  const mod = (coModule || '').toLowerCase();
  if (mod === 'ped') {
    return 'order';
  }
  if (mod === 'cob') {
    return 'collection';
  }
  return 'default';
}
