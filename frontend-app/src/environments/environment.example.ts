// Copy to environment.ts (git-ignored) for local development.
// dataSource: 'mock' keeps data in memory; 'local' stores data in this browser (IndexedDB).
// apiAuthToken: never commit a real token. Leave it empty here and set it only in your own environment.ts.
export const environment = {
  production: false,
  appName: 'ShopDesk',
  dataSource: 'mock' as 'mock' | 'local',
  mockAuthEnabled: true,
  apiBaseUrl: 'http://localhost:3000/api/v1',
  apiAuthToken: '',
  syncIntervalMs: 60000,
};
