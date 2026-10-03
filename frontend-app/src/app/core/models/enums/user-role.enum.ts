export const UserRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  PHARMACIST: 'PHARMACIST',
  CASHIER: 'CASHIER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ALL_USER_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.PHARMACIST,
  UserRole.CASHIER,
];
