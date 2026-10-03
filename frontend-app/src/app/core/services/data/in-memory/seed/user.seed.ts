import { AppUser } from '../../../../models/domain/app-user.model';
import { UserRole } from '../../../../models/enums/user-role.enum';
import { UserStatus } from '../../../../models/enums/user-status.enum';

export const USER_SEED: readonly AppUser[] = [
  {
    id: 'usr-001',
    username: 'nimal',
    displayName: 'Nimal Perera',
    initials: 'NP',
    role: UserRole.ADMIN,
    employeeId: 'emp-001',
    status: UserStatus.ACTIVE,
    lastSignIn: '2026-09-21T08:40:00',
  },
  {
    id: 'usr-002',
    username: 'kamal',
    displayName: 'Kamal Silva',
    initials: 'KS',
    role: UserRole.MANAGER,
    employeeId: 'emp-002',
    status: UserStatus.ACTIVE,
    lastSignIn: '2026-09-20T17:05:00',
  },
  {
    id: 'usr-003',
    username: 'dilani',
    displayName: 'Dilani Fernando',
    initials: 'DF',
    role: UserRole.PHARMACIST,
    employeeId: 'emp-003',
    status: UserStatus.ACTIVE,
    lastSignIn: '2026-09-21T07:52:00',
  },
  {
    id: 'usr-004',
    username: 'ruwani',
    displayName: 'Ruwani Jayawardena',
    initials: 'RJ',
    role: UserRole.CASHIER,
    employeeId: 'emp-004',
    status: UserStatus.ACTIVE,
    lastSignIn: '2026-09-21T07:58:00',
  },
];
