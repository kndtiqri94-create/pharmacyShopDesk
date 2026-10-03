import { InMemoryCollection } from './in-memory-collection';

interface Item {
  id: string;
  name: string;
}

describe('InMemoryCollection', () => {
  const seed: readonly Item[] = [{ id: '1', name: 'First' }];

  it('returns copies, never the internal references', () => {
    const collection = new InMemoryCollection<Item>(seed);
    collection.all()[0].name = 'Changed';
    collection.byId('1')!.name = 'Changed';
    expect(collection.byId('1')?.name).toBe('First');
  });

  it('does not change the seed it was built from', () => {
    const collection = new InMemoryCollection<Item>(seed);
    collection.upsert({ id: '1', name: 'Edited' });
    expect(seed[0].name).toBe('First');
  });

  it('inserts new items and replaces existing ones', () => {
    const collection = new InMemoryCollection<Item>(seed);
    collection.upsert({ id: '2', name: 'Second' });
    collection.upsert({ id: '1', name: 'Edited' });
    expect(collection.all().map(item => item.name)).toEqual(['Edited', 'Second']);
  });

  it('returns null for an unknown id', () => {
    expect(new InMemoryCollection<Item>(seed).byId('missing')).toBeNull();
  });

  it('starts from the original seed for every new instance', () => {
    const first = new InMemoryCollection<Item>(seed);
    first.upsert({ id: '1', name: 'Edited' });
    expect(new InMemoryCollection<Item>(seed).byId('1')?.name).toBe('First');
  });
});
