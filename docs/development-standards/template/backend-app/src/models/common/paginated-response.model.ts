export class PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  constructor(data: T[], page: number, pageSize: number, totalItems: number) {
    this.data = data;
    this.pagination = {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      hasNextPage: page < Math.ceil(totalItems / pageSize),
      hasPreviousPage: page > 1
    };
  }
}
