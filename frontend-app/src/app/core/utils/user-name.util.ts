export function getFirstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? '';
}
