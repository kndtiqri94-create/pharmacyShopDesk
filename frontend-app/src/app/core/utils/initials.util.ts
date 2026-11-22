export function initialsFromName(name: string): string {
  const words = name
    .trim()
    .split(' ')
    .filter(word => word.length > 0);
  const letters = words.slice(0, 2).map(word => word[0]);
  return letters.join('').toUpperCase();
}
