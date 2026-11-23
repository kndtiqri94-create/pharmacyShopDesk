import { Provider } from '@angular/core';
import Dexie, { DexieOptions } from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { MOCK_AUTH_ENABLED, SIGN_IN_THROTTLE_MS } from '../app/core/services/auth/auth.tokens';
import { provideDataServices } from '../app/core/services/data/data-providers';
import { LocalDatabase } from '../app/core/services/data/local/local-database';
import { LOCAL_DATABASE_FACTORY } from '../app/core/services/data/local/local-database.provider';
import {
  STORAGE_MANAGER,
  StorageManagerLike,
} from '../app/core/services/data/local/storage-persistence.service';

export const GRANTING_STORAGE: StorageManagerLike = {
  persisted: () => Promise.resolve(false),
  persist: () => Promise.resolve(true),
};

export const REFUSING_STORAGE: StorageManagerLike = {
  persisted: () => Promise.resolve(false),
  persist: () => Promise.resolve(false),
};

export interface LocalTestEnvironment {
  indexedDB: IDBFactory;
  databaseOptions: DexieOptions;
  databaseName: string;
  createDatabase: () => LocalDatabase;
  providers: (storage?: StorageManagerLike) => Provider[];
  cleanup: () => Promise<void>;
}

export interface LocalTestEnvironmentOptions {
  realBrowserStore?: boolean;
}

export function createLocalTestEnvironment(
  name = 'shopdesk-test',
  options: LocalTestEnvironmentOptions = {}
): LocalTestEnvironment {
  const indexedDB = new IDBFactory();
  const databaseName = options.realBrowserStore ? `${name}-${crypto.randomUUID()}` : name;
  const databaseOptions: DexieOptions = options.realBrowserStore ? {} : { indexedDB, IDBKeyRange };
  const createDatabase = () => new LocalDatabase(databaseName, databaseOptions);
  return {
    indexedDB,
    databaseOptions,
    databaseName,
    createDatabase,
    cleanup: () => (options.realBrowserStore ? Dexie.delete(databaseName) : Promise.resolve()),
    providers: (storage = GRANTING_STORAGE) => [
      provideDataServices('local'),
      { provide: LOCAL_DATABASE_FACTORY, useValue: createDatabase },
      { provide: STORAGE_MANAGER, useValue: storage },
    ],
  };
}

export function freshLocalProviders(): Provider[] {
  return createLocalTestEnvironment().providers();
}

export function localAuthProviders(environment: LocalTestEnvironment): Provider[] {
  return [
    ...environment.providers(),
    { provide: SIGN_IN_THROTTLE_MS, useValue: 0 },
    { provide: MOCK_AUTH_ENABLED, useValue: true },
  ];
}
