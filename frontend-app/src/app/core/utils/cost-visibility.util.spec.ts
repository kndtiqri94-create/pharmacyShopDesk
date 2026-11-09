import { UserRole } from '../models/enums/user-role.enum';
import { canSeeCostPrice } from './cost-visibility.util';

describe('canSeeCostPrice', () => {
  it('allows only Admin and Manager', () => {
    expect(canSeeCostPrice(UserRole.ADMIN)).toBe(true);
    expect(canSeeCostPrice(UserRole.MANAGER)).toBe(true);
  });

  it('denies every other role, an unknown role and no user', () => {
    expect(canSeeCostPrice(UserRole.PHARMACIST)).toBe(false);
    expect(canSeeCostPrice(UserRole.CASHIER)).toBe(false);
    expect(canSeeCostPrice('SUPERUSER')).toBe(false);
    expect(canSeeCostPrice(null)).toBe(false);
    expect(canSeeCostPrice(undefined)).toBe(false);
  });
});
