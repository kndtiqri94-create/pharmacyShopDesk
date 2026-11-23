import { AppUser } from '../../../models/domain/app-user.model';

const SECRET_FIELDS: readonly string[] = [
  'password',
  'passwordHash',
  'passwordSalt',
  'hash',
  'salt',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
];

export function sanitizeUser(user: AppUser): AppUser {
  const kept = Object.entries(user).filter(([field]) => !SECRET_FIELDS.includes(field));
  return Object.fromEntries(kept) as unknown as AppUser;
}
