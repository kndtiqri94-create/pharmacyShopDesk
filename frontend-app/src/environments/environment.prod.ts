// The two __PLACEHOLDER__ values are replaced at build time by scripts/inject-api-env.mjs (CI only).
// Never commit a real token or URL here.
export const environment = {
  production: true,
  appName: 'ShopDesk',
  dataSource: 'local' as 'mock' | 'local',
  mockAuthEnabled: false,
  apiBaseUrl: '__API_BASE_URL__',
  apiAuthToken: '__API_AUTH_TOKEN__',
  syncIntervalMs: 60000,
};
