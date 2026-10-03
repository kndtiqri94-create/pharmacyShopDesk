import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { createModuleRoutes } from '../module-routes.factory';

export const EMPLOYEES_ROUTES = createModuleRoutes(ModuleKey.EMPLOYEES);
