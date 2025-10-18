import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { DashboardComponent } from './dashboard/dashboard';

export const routes: Routes = [

  { 
    path: '', 
    redirectTo: '/login', 
    pathMatch: 'full' 
  },
  { 
    path: 'login', 
    component: LoginComponent 
  },

  { 
    path: 'register', 
    component: RegisterComponent 
  },
    {
    path: 'dashboard',
    component: DashboardComponent
  },
  { 
    path: '**', 
    redirectTo: '/login' 
  }
];


