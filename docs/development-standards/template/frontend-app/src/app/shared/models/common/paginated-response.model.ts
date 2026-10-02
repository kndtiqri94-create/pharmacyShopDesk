import { PaginationInfo } from './pagination-info.model';

export class PaginatedResponse<T> {
  items!: T[];
  pagination!: PaginationInfo;
}
