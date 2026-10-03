export const PoStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PART_RECEIVED: 'PART_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type PoStatus = (typeof PoStatus)[keyof typeof PoStatus];
