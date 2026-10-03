import { Route, Routes } from '@angular/router';
import { authGuard, authMatchGuard } from './core/guards/auth.guard';
import { landingGuard } from './core/guards/landing.guard';
import { moduleAccessActivateGuard, moduleAccessGuard } from './core/guards/module-access.guard';
import { signInRedirectGuard } from './core/guards/sign-in-redirect.guard';
import { ModuleKey } from './core/models/enums/module-key.enum';
import { getModuleDefinition } from './core/utils/module-definitions.util';

function moduleRoute(key: ModuleKey, loadChildren: NonNullable<Route['loadChildren']>): Route {
  return {
    path: getModuleDefinition(key).path,
    data: { module: key },
    canMatch: [moduleAccessGuard],
    canActivate: [moduleAccessActivateGuard],
    loadChildren,
  };
}

export const routes: Routes = [
  {
    path: 'sign-in',
    canActivate: [signInRedirectGuard],
    title: 'Sign in',
    loadComponent: () =>
      import('./features/auth/sign-in/sign-in.component').then(file => file.SignInComponent),
  },
  {
    path: '',
    canMatch: [authMatchGuard],
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/shell/app-shell/app-shell.component').then(file => file.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', canActivate: [landingGuard], children: [] },
      moduleRoute(ModuleKey.DASHBOARD, () =>
        import('./features/modules/dashboard/dashboard.routes').then(file => file.DASHBOARD_ROUTES)
      ),
      moduleRoute(ModuleKey.PRODUCTS, () =>
        import('./features/modules/products/products.routes').then(file => file.PRODUCTS_ROUTES)
      ),
      moduleRoute(ModuleKey.GRN, () =>
        import('./features/modules/grn/grn.routes').then(file => file.GRN_ROUTES)
      ),
      moduleRoute(ModuleKey.PURCHASE_ORDERS, () =>
        import('./features/modules/purchase-orders/purchase-orders.routes').then(
          file => file.PURCHASE_ORDERS_ROUTES
        )
      ),
      moduleRoute(ModuleKey.SUPPLIERS, () =>
        import('./features/modules/suppliers/suppliers.routes').then(file => file.SUPPLIERS_ROUTES)
      ),
      moduleRoute(ModuleKey.EMPLOYEES, () =>
        import('./features/modules/employees/employees.routes').then(file => file.EMPLOYEES_ROUTES)
      ),
      moduleRoute(ModuleKey.RELOAD_UTILITY, () =>
        import('./features/modules/reload-utility/reload-utility.routes').then(
          file => file.RELOAD_UTILITY_ROUTES
        )
      ),
      moduleRoute(ModuleKey.USERS, () =>
        import('./features/modules/users/users.routes').then(file => file.USERS_ROUTES)
      ),
      moduleRoute(ModuleKey.SETTINGS, () =>
        import('./features/modules/settings/settings.routes').then(file => file.SETTINGS_ROUTES)
      ),
      {
        path: 'access-denied',
        title: 'Access denied',
        loadComponent: () =>
          import('./features/errors/access-denied/access-denied.component').then(
            file => file.AccessDeniedComponent
          ),
      },
      {
        path: '**',
        title: 'Page not found',
        loadComponent: () =>
          import('./features/errors/not-found/not-found.component').then(
            file => file.NotFoundComponent
          ),
      },
    ],
  },
];
