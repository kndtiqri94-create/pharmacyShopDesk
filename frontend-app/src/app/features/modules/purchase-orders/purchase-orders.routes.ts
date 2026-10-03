import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { createModuleRoutes } from '../module-routes.factory';

export const PURCHASE_ORDERS_ROUTES = createModuleRoutes(ModuleKey.PURCHASE_ORDERS);
