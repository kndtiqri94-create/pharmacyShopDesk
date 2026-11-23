function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== 'object' || value === null) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort((first, second) => first.localeCompare(second))) {
    sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function sameContent(first: unknown, second: unknown): boolean {
  return JSON.stringify(sortKeys(first)) === JSON.stringify(sortKeys(second));
}
