export const environment = {
  production: true,
  apiUrl: 'https://your-azure-function-app.azurewebsites.net/api',
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
    scopes: [
      'email',
      'offline_access',
      'openid',
      'profile',
      'user.read',
      'People.read',
      'People.Read.All',
    ],
    uri: 'https://graph.microsoft.com/v1.0/me',
  },
  graphApiSearchUrl: 'https://graph.microsoft.com/v1.0/',
  defaultOrganizationId: 1,
  logging: {
    level: 'error',
    enableConsoleLogging: false,
  },
  features: {
    enableAnalytics: true,
    enableErrorReporting: true,
  },
};
