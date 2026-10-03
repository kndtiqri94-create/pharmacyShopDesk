import { Routes } from '@angular/router';
import { ModuleKey } from '../../core/models/enums/module-key.enum';
import { getModuleDefinition } from '../../core/utils/module-definitions.util';
import { ModulePlaceholderComponent } from './module-placeholder/module-placeholder.component';

export function createModuleRoutes(key: ModuleKey): Routes {
  return [
    {
      path: '',
      component: ModulePlaceholderComponent,
      data: { module: key },
      title: getModuleDefinition(key).label,
    },
  ];
}
