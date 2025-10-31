import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { DashboardComponent } from './dashboard/dashboard';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';

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
    path: 'forgot-password',
    component:ForgotPasswordComponent
  },
  { 
    path: '**', 
    redirectTo: '/login' 
  }
];


