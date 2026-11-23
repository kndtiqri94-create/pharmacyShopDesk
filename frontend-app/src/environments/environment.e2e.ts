// Used only by the Playwright end-to-end build (ng build --configuration e2e).
// The token is a throwaway value for the local in-memory test API, not a real secret.
export const environment = {
  production: false,
  appName: 'ShopDesk',
  dataSource: 'local' as 'mock' | 'local',
  mockAuthEnabled: true,
  apiBaseUrl: 'http://127.0.0.1:3100/api/v1',
  apiAuthToken: 'e2e-throwaway-token',
  syncIntervalMs: 1500,
};
