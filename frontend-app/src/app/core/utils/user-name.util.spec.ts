import { getFirstName } from './user-name.util';

describe('user-name.util', () => {
  it('takes the first word of the display name', () => {
    expect(getFirstName('Nimal Perera')).toBe('Nimal');
    expect(getFirstName('  Kamal  Silva ')).toBe('Kamal');
    expect(getFirstName('Admin')).toBe('Admin');
    expect(getFirstName('')).toBe('');
  });
});
