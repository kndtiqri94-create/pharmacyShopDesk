import { MockCredential } from './mock-credential.model';

// Sample sign-in details for testing only. This is not real security. The production build
// replaces this file with mock-credentials.prod.ts (see angular.json fileReplacements).
export const MOCK_CREDENTIALS: readonly MockCredential[] = [
  { username: 'nimal', password: 'Owner@2026', userId: 'usr-001' },
  { username: 'kamal', password: 'Manager@2026', userId: 'usr-002' },
  { username: 'dilani', password: 'Pharmacist@2026', userId: 'usr-003' },
  { username: 'ruwani', password: 'Cashier@2026', userId: 'usr-004' },
];
