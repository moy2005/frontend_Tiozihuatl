import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { DashboardComponent } from './dashboard/dashboard';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';
import { PerfilUsuarioComponent } from './pages/perfil-usuario/perfil-usuario';
import { AuthGuard } from './guards/auth.guard';
import { AdminPanelComponent } from './pages/admin/admin-panel/admin-panel';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  // 🔓 Públicas
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },

  // 🔐 Protegidas (todas con AuthGuard)
  { path: 'perfil', component: PerfilUsuarioComponent, canActivate: [AuthGuard] },

  // 🧑‍💼 Panel de administrador (solo rol "Administrador")
  {
    path: 'admin-panel',
    component: AdminPanelComponent,
    canActivate: [AuthGuard],
    data: { roles: ['Administrador'] },
  },

  { path: '**', redirectTo: '/login' },
];