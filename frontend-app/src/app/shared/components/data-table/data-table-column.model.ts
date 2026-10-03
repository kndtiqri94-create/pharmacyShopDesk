export type DataTableColumnKind = 'text' | 'money' | 'number' | 'code';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  kind?: DataTableColumnKind;
  value?: (row: T) => string | number;
  subValue?: (row: T) => string;
}
