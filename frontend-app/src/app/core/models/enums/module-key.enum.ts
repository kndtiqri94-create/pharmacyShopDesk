export const ModuleKey = {
  DASHBOARD: 'dashboard',
  PRODUCTS: 'products',
  GRN: 'grn',
  PURCHASE_ORDERS: 'purchase-orders',
  SUPPLIERS: 'suppliers',
  EMPLOYEES: 'employees',
  RELOAD_UTILITY: 'reload-utility',
  USERS: 'users',
  SETTINGS: 'settings',
} as const;

export type ModuleKey = (typeof ModuleKey)[keyof typeof ModuleKey];
