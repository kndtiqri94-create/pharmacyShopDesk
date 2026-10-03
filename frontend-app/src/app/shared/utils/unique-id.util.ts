let counter = 0;

export function createUniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
