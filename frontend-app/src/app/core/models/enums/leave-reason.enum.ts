export const LeaveReason = {
  PERSONAL: 'Personal',
  MEDICAL: 'Medical',
  FAMILY: 'Family',
  TRAVEL: 'Travel',
  BEREAVEMENT: 'Bereavement',
  OTHER: 'Other',
} as const;

export type LeaveReason = (typeof LeaveReason)[keyof typeof LeaveReason];
