export interface SearchQueryBase {
  PageIndex: number;
  PageSize: number;
  SortModel: SortModel;
  OrganizationId: number;
}

type SortModel = Record<string, any>;
