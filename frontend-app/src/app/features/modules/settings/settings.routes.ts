import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { createModuleRoutes } from '../module-routes.factory';

export const SETTINGS_ROUTES = createModuleRoutes(ModuleKey.SETTINGS);
