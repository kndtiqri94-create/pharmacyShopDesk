import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { MsalGuard } from '@azure/msal-angular';
import { SampleFormComponent } from './sample-form/sample-form.component';
import { ManageUsersComponent } from './admin/manageusers/manageusers.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [MsalGuard],
  },
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [MsalGuard],
  },
  {
    path: 'sample-form',
    component: SampleFormComponent,
    canActivate: [MsalGuard],
  },
  {
    path: 'users',
    component: ManageUsersComponent,
    canActivate: [MsalGuard],
  },
];
