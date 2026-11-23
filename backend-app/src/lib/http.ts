import { z } from 'zod';
import { validationError } from '../errors.js';
import { issuesToDetails } from '../services/records.js';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export interface Paging {
  page: number;
  pageSize: number;
}

export function parseQuery<T extends z.ZodType>(schema: T, query: unknown): z.infer<T> {
  const parsed = schema.safeParse(query ?? {});
  if (!parsed.success) {
    throw validationError('The query is not valid.', issuesToDetails(parsed.error));
  }
  return parsed.data;
}

export function parsePaging(query: unknown): Paging {
  return parseQuery(pagingSchema, query);
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function paginate<T>(rows: readonly T[], paging: Paging): Page<T> {
  const start = (paging.page - 1) * paging.pageSize;
  return {
    items: rows.slice(start, start + paging.pageSize),
    page: paging.page,
    pageSize: paging.pageSize,
    total: rows.length,
  };
}
