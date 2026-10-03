export const GrnStatus = {
  DRAFT: 'DRAFT',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type GrnStatus = (typeof GrnStatus)[keyof typeof GrnStatus];
