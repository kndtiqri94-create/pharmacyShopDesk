export const environment = {
  production: false,
  apiUrl: 'http://localhost:7071/api',
  appName: 'Department Budget Manager',
  version: '1.0.0',
  msalConfig: {
    auth: {
      clientId: '',
      authority: '',
      redirectUrl: '',
    },
  },
  apiConfig: {
    scopes: ['email', 'offline_access', 'openid', 'profile', 'user.read', 'People.read'],
    uri: 'https://graph.microsoft.com/v1.0/me',
  },
  graphApiSearchUrl: 'https://graph.microsoft.com/v1.0/',
  defaultOrganizationId: 1,
  logging: {
    level: 'debug',
    enableConsoleLogging: true,
  },
  features: {
    enableAnalytics: false,
    enableErrorReporting: false,
  },
};
