import { UserRole } from '../models/enums/user-role.enum';
import { formatSessionRoleLabel, formatUserRoleLabel } from './user-role-label.util';

describe('user-role-label.util', () => {
  it('labels every role', () => {
    expect(formatUserRoleLabel(UserRole.MANAGER)).toBe('Manager');
    expect(formatUserRoleLabel(UserRole.PHARMACIST)).toBe('Pharmacist');
    expect(formatUserRoleLabel(UserRole.CASHIER)).toBe('Cashier');
    expect(formatUserRoleLabel(UserRole.ADMIN)).toBe('Admin');
  });

  it('shows the admin as Owner in the session label only', () => {
    expect(formatSessionRoleLabel(UserRole.ADMIN)).toBe('Owner');
    expect(formatSessionRoleLabel(UserRole.CASHIER)).toBe('Cashier');
  });
});
