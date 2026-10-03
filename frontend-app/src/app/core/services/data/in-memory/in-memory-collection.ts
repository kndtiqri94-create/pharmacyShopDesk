import { cloneValue } from '../../../utils/clone.util';

export class InMemoryCollection<T extends { id: string }> {
  private items: T[];

  constructor(seed: readonly T[]) {
    this.items = cloneValue([...seed]);
  }

  all(): T[] {
    return cloneValue(this.items);
  }

  byId(id: string): T | null {
    const found = this.items.find(item => item.id === id);
    return found ? cloneValue(found) : null;
  }

  upsert(item: T): T {
    const copy = cloneValue(item);
    const index = this.items.findIndex(existing => existing.id === copy.id);
    if (index === -1) {
      this.items.push(copy);
    } else {
      this.items[index] = copy;
    }
    return cloneValue(copy);
  }
}
