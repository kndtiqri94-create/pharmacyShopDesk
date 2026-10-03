import { ModuleDefinition, ModuleGroup } from '../models/domain/module-definition.model';
import { ModuleKey } from '../models/enums/module-key.enum';

export const MODULE_GROUP_ORDER: readonly ModuleGroup[] = [
  'OVERVIEW',
  'INVENTORY',
  'PEOPLE',
  'SERVICES',
  'SYSTEM',
];

export const MODULE_DEFINITIONS: readonly ModuleDefinition[] = [
  {
    key: ModuleKey.DASHBOARD,
    path: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    group: 'OVERVIEW',
    subtitle: 'Today at a glance, with stock alerts and what needs your attention.',
  },
  {
    key: ModuleKey.PRODUCTS,
    path: 'products',
    label: 'Products',
    icon: 'package',
    group: 'INVENTORY',
    subtitle: 'Everything you sell, with stock, batches and expiry dates.',
  },
  {
    key: ModuleKey.GRN,
    path: 'grn',
    label: 'GRN',
    icon: 'inbox',
    group: 'INVENTORY',
    subtitle: 'Every delivery you receive, with batches, expiry and what you owe.',
  },
  {
    key: ModuleKey.PURCHASE_ORDERS,
    path: 'purchase-orders',
    label: 'Purchase orders',
    icon: 'clipboard',
    group: 'INVENTORY',
    subtitle: 'Orders you have sent to suppliers and what is still on the way.',
  },
  {
    key: ModuleKey.SUPPLIERS,
    path: 'suppliers',
    label: 'Suppliers',
    icon: 'truck',
    group: 'INVENTORY',
    subtitle: 'The people you buy from and what you owe them.',
  },
  {
    key: ModuleKey.EMPLOYEES,
    path: 'employees',
    label: 'Employees',
    icon: 'idcard',
    group: 'PEOPLE',
    subtitle: 'Your staff, their shifts and who can sign in.',
  },
  {
    key: ModuleKey.USERS,
    path: 'users',
    label: 'Users',
    icon: 'shield',
    group: 'PEOPLE',
    subtitle: 'Who can sign in to ShopDesk and what they can do.',
  },
  {
    key: ModuleKey.RELOAD_UTILITY,
    path: 'reload-utility',
    label: 'Reload & Utility',
    icon: 'phone',
    group: 'SERVICES',
    subtitle: 'Sell mobile reloads and take bill payments at the counter.',
  },
  {
    key: ModuleKey.SETTINGS,
    path: 'settings',
    label: 'Settings',
    icon: 'settings',
    group: 'SYSTEM',
    subtitle: 'One shop, one place to change how it runs.',
  },
];

export function getModuleDefinition(key: ModuleKey): ModuleDefinition {
  const definition = MODULE_DEFINITIONS.find(candidate => candidate.key === key);
  if (!definition) throw new Error(`Unknown module key: ${key}`);
  return definition;
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return MODULE_DEFINITIONS.some(candidate => candidate.key === value);
}

export function moduleKeyFromUrl(url: string): ModuleKey | null {
  const pathOnly = url.split('?')[0].split('#')[0];
  const firstSegment = pathOnly.split('/').find(segment => segment.length > 0);
  const match = MODULE_DEFINITIONS.find(candidate => candidate.path === firstSegment);
  return match?.key ?? null;
}
