export const PermissionLevel = {
  FULL: 'FULL',
  VIEW: 'VIEW',
  NONE: 'NONE',
} as const;

export type PermissionLevel = (typeof PermissionLevel)[keyof typeof PermissionLevel];
