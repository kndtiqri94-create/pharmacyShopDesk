import { Table } from 'dexie';
import { cloneValue } from '../../../utils/clone.util';
import { LocalDatabase, Row } from './local-database';

export function stripRow<T extends object>(row: Row<T>): T {
  const copy: Record<string, unknown> = { ...row };
  delete copy['_ord'];
  return copy as T;
}

export class LocalCollection<T extends object> {
  constructor(
    private readonly table: Table<Row<T>, string>,
    private readonly keyField: keyof T & string = 'id' as keyof T & string
  ) {}

  async all(): Promise<T[]> {
    const rows = await this.table.orderBy('_ord').toArray();
    return rows.map(row => stripRow<T>(row));
  }

  async byId(key: string): Promise<T | null> {
    const row = await this.table.get(key);
    return row === undefined ? null : stripRow<T>(row);
  }

  async upsert(item: T): Promise<T> {
    const copy = cloneValue(item);
    const key = String(copy[this.keyField]);
    const existing = await this.table.get(key);
    const order = existing?._ord ?? (await this.nextOrder());
    await this.table.put({ ...copy, _ord: order } as Row<T>);
    this.notify(key, 'put');
    return cloneValue(copy);
  }

  async remove(key: string): Promise<boolean> {
    const existing = await this.table.get(key);
    if (existing === undefined) return false;
    await this.table.delete(key);
    this.notify(key, 'delete');
    return true;
  }

  private notify(key: string, operation: 'put' | 'delete'): void {
    (this.table.db as LocalDatabase).afterWrite(this.table.name, key, operation);
  }

  private async nextOrder(): Promise<number> {
    const last = await this.table.orderBy('_ord').last();
    return (last?._ord ?? 0) + 1;
  }
}
