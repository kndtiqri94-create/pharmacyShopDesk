export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  NOT_YET: 'NOT_YET',
  ON_LEAVE: 'ON_LEAVE',
} as const;

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];
