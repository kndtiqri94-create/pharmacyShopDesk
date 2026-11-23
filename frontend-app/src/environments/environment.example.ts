// Copy to environment.ts (git-ignored) for local development.
// dataSource: 'mock' keeps data in memory; 'local' stores data in this browser (IndexedDB).
export const environment = {
  production: false,
  appName: 'ShopDesk',
  dataSource: 'mock' as 'mock' | 'local',
  mockAuthEnabled: true,
};
