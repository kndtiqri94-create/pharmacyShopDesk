import { PaginationDto } from '../pagination.dto';

export class SearchBudgetsDto extends PaginationDto {
  departmentId?: number;
  fiscalYear?: number;
  month?: number;
  status?: string;
  approvedBy?: number;
  searchTerm?: string;
}
