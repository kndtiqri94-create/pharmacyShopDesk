import { LocalDatabase } from './local-database';

export const META_KEYS = {
  deviceCode: 'deviceCode',
  invoiceCounter: 'invoiceCounter',
  movementSeq: 'movementSeq',
  schemaVersion: 'schemaVersion',
  seededAt: 'seededAt',
  autoSyncEnabled: 'autoSyncEnabled',
  lastSyncAt: 'lastSyncAt',
  pullCursor: 'pullCursor',
  syncLease: 'syncLease',
} as const;

export const DOCUMENT_IDS = {
  appSettings: 'app-settings',
  payrollSettings: 'payroll-settings',
  roleMatrix: 'role-matrix',
} as const;

export async function readMeta<T>(db: LocalDatabase, key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function writeMeta(db: LocalDatabase, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function readDocument<T>(db: LocalDatabase, id: string): Promise<T | undefined> {
  const row = await db.documents.get(id);
  return row?.value as T | undefined;
}

export async function writeDocument(db: LocalDatabase, id: string, value: unknown): Promise<void> {
  await db.transaction('rw', db.documents, db.outbox, async () => {
    await db.documents.put({ id, value });
    await db.enqueue('documents', id, 'put', value);
  });
}
