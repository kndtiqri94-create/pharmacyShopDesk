import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  initials: string;
  role: UserRole;
  employeeId: string | null;
  status: UserStatus;
  lastSignIn: string;
}
