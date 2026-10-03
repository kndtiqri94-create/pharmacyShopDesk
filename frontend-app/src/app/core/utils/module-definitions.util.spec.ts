import { ModuleKey } from '../models/enums/module-key.enum';
import {
  MODULE_DEFINITIONS,
  MODULE_GROUP_ORDER,
  getModuleDefinition,
  isModuleKey,
  moduleKeyFromUrl,
} from './module-definitions.util';

describe('module-definitions.util', () => {
  it('lists exactly nine modules with unique paths', () => {
    expect(MODULE_DEFINITIONS).toHaveSize(9);
    expect(new Set(MODULE_DEFINITIONS.map(definition => definition.path)).size).toBe(9);
  });

  it('places modules in the documented groups', () => {
    const byGroup = (group: string) =>
      MODULE_DEFINITIONS.filter(definition => definition.group === group).map(d => d.label);
    expect(MODULE_GROUP_ORDER).toEqual(['OVERVIEW', 'INVENTORY', 'PEOPLE', 'SERVICES', 'SYSTEM']);
    expect(byGroup('OVERVIEW')).toEqual(['Dashboard']);
    expect(byGroup('INVENTORY')).toEqual(['Products', 'GRN', 'Purchase orders', 'Suppliers']);
    expect(byGroup('PEOPLE')).toEqual(['Employees', 'Users']);
    expect(byGroup('SERVICES')).toEqual(['Reload & Utility']);
    expect(byGroup('SYSTEM')).toEqual(['Settings']);
  });

  it('finds a definition by key and throws for unknown keys', () => {
    expect(getModuleDefinition(ModuleKey.GRN).path).toBe('grn');
    expect(() => getModuleDefinition('nope' as ModuleKey)).toThrow();
  });

  it('recognises module keys', () => {
    expect(isModuleKey('products')).toBeTrue();
    expect(isModuleKey('admin')).toBeFalse();
    expect(isModuleKey(undefined)).toBeFalse();
  });

  it('maps a url to a module key', () => {
    expect(moduleKeyFromUrl('/products/123?tab=1')).toBe(ModuleKey.PRODUCTS);
    expect(moduleKeyFromUrl('/purchase-orders#top')).toBe(ModuleKey.PURCHASE_ORDERS);
    expect(moduleKeyFromUrl('/access-denied')).toBeNull();
    expect(moduleKeyFromUrl('/')).toBeNull();
  });
});
