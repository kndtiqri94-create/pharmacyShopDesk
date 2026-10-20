export const LEAVE_FIELD_ID_PREFIX = 'leave-';

export function leaveFieldId(key: string): string {
  return `${LEAVE_FIELD_ID_PREFIX}${key}`;
}

export function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}
