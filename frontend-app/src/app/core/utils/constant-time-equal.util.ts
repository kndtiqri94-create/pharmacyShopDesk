export function constantTimeEqual(first: string, second: string): boolean {
  const longest = Math.max(first.length, second.length);
  let difference = first.length ^ second.length;
  for (let index = 0; index < longest; index += 1) {
    difference |= (first.codePointAt(index) ?? 0) ^ (second.codePointAt(index) ?? 0);
  }
  return difference === 0;
}
