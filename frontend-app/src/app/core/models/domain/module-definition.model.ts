import { ModuleKey } from '../enums/module-key.enum';
import { IconName } from '../shared/icon-name.model';

export type ModuleGroup = 'OVERVIEW' | 'INVENTORY' | 'PEOPLE' | 'SERVICES' | 'SYSTEM';

export interface ModuleDefinition {
  key: ModuleKey;
  path: string;
  label: string;
  icon: IconName;
  group: ModuleGroup;
  subtitle: string;
}
