import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';
import { ResetPasswordComponent } from './auth/reset-password/reset-password';
import { PerfilUsuarioComponent } from './pages/perfil-usuario/perfil-usuario';
import { AuthGuard } from './guards/auth.guard';
import { AdminPanelComponent } from './pages/admin/admin-panel/admin-panel';
import { VerificarCorreoComponent } from './auth/verificar-correo/verificar-correo';
import { Privacidad } from './pages/legal/privacidad/privacidad';
import { Terminos } from './pages/legal/terminos/terminos';
import { Seguridad } from './pages/legal/seguridad/seguridad';
import { InicioComponent } from './pages/inicio/inicio';

export const routes: Routes = [
  { path: '', redirectTo: '/inicio', pathMatch: 'full' },

  // 🔓 Públicas
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  {path:'reset-password', component: ResetPasswordComponent},
  { path: 'verificar-correo', component: VerificarCorreoComponent },
  { path: 'inicio',component: InicioComponent},
  
  { path: 'privacidad', component: Privacidad},
  {path: 'terminos', component: Terminos},
  {path: 'seguridad', component: Seguridad},

  // 🔐 Protegidas (todas con AuthGuard)
  { path: 'perfil', component: PerfilUsuarioComponent, canActivate: [AuthGuard] },

  // 🧑‍💼 Panel de administrador (solo rol "Administrador")
  { path: 'admin-panel', component: AdminPanelComponent, canActivate: [AuthGuard], data: { roles: ['Administrador'] }, },

  { path: '**', redirectTo: '/inicio' },
];

