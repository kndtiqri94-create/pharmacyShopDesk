import { ModuleKey } from '../models/enums/module-key.enum';
import {
  MODULE_DEFINITIONS,
  MODULE_GROUP_ORDER,
  getModuleDefinition,
  isModuleKey,
  moduleKeyFromUrl,
} from './module-definitions.util';

describe('module-definitions.util', () => {
  it('lists exactly ten modules with unique paths', () => {
    expect(MODULE_DEFINITIONS).toHaveSize(10);
    expect(new Set(MODULE_DEFINITIONS.map(definition => definition.path)).size).toBe(10);
  });

  it('flags only Payroll as hidden from the sidebar', () => {
    expect(
      MODULE_DEFINITIONS.filter(definition => definition.hideFromSidebar).map(d => d.key)
    ).toEqual([ModuleKey.PAYROLL]);
    expect(getModuleDefinition(ModuleKey.PAYROLL).path).toBe('employees/payroll');
  });

  it('places modules in the documented groups', () => {
    const byGroup = (group: string) =>
      MODULE_DEFINITIONS.filter(definition => definition.group === group).map(d => d.label);
    expect(MODULE_GROUP_ORDER).toEqual(['OVERVIEW', 'INVENTORY', 'PEOPLE', 'SERVICES', 'SYSTEM']);
    expect(byGroup('OVERVIEW')).toEqual(['Dashboard']);
    expect(byGroup('INVENTORY')).toEqual(['Products', 'GRN', 'Purchase orders', 'Suppliers']);
    expect(byGroup('PEOPLE')).toEqual(['Employees', 'Payroll', 'Users']);
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
    expect(moduleKeyFromUrl('/employees')).toBe(ModuleKey.EMPLOYEES);
    expect(moduleKeyFromUrl('/employees/payroll')).toBe(ModuleKey.EMPLOYEES);
    expect(moduleKeyFromUrl('/employees/12/edit?x=1')).toBe(ModuleKey.EMPLOYEES);
    expect(moduleKeyFromUrl('/payroll')).toBeNull();
    expect(moduleKeyFromUrl('/access-denied')).toBeNull();
    expect(moduleKeyFromUrl('/')).toBeNull();
  });
});
