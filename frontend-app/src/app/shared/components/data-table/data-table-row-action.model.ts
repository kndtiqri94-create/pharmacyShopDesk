import { IconName } from '../../../core/models/shared/icon-name.model';

export interface DataTableRowAction {
  id: string;
  label: string;
  icon: IconName;
}

export interface DataTableRowActionEvent<T> {
  actionId: string;
  row: T;
}

export const MAX_ROW_ACTIONS = 3;
