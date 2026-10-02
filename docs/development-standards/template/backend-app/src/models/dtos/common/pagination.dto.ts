export class PaginationDto {
  // Pagination
  page: number = 1;
  pageSize: number = 10;
  
  // Sorting
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' = 'asc';

  normalizePagination() {
    this.page = isNaN(this.page) ? 1 : Math.max(1, this.page);
    this.pageSize = isNaN(this.pageSize) ? 10 : Math.max(1, Math.min(100, this.pageSize));
    this.sortOrder = (this.sortOrder === 'desc') ? 'desc' : 'asc';
  }
}
