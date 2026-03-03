import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password';
import { ResetPasswordComponent } from './auth/reset-password/reset-password';
import { PerfilUsuarioComponent } from './pages/perfil-usuario/perfil-usuario';
import { AuthGuard } from './guards/auth.guard';
import { VerificarCorreoComponent } from './auth/verificar-correo/verificar-correo';
import { Privacidad } from './pages/legal/privacidad/privacidad';
import { Terminos } from './pages/legal/terminos/terminos';
import { Seguridad } from './pages/legal/seguridad/seguridad';
import { InicioComponent } from './pages/inicio/inicio';
import { AdminLayoutComponent } from './pages/admin/admin-layout/admin-layout';
import { AdminDashboardComponent } from './pages/admin/admin-dashboard/admin-dashboard';
import { GestionUsuariosComponent } from './pages/admin/gestion-usuarios/gestion-usuarios';
import { GestionFaqComponent } from './pages/admin/gestion-faq/gestion-faq';
import { GestionContactoComponent } from './pages/admin/gestion-contacto/gestion-contacto';
import { GestionAboutComponent } from './pages/admin/gestion-about/gestion-about';

import { AboutComponent } from './pages/about/about.component';
import { GestionRevistasComponent } from './pages/admin/gestion-revistas/gestion-revistas.component';


export const routes: Routes = [
  { path: '', redirectTo: '/inicio', pathMatch: 'full' },

  // 🔓 Públicas
  { path: 'login', component: LoginComponent,
     data: { breadcrumb: 'Inicio' }
   },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  {path:'reset-password', component: ResetPasswordComponent},
  { path: 'verificar-correo', component: VerificarCorreoComponent },
  { path: 'inicio',component: InicioComponent},

  { path: 'about', component: AboutComponent },
  
  { path: 'privacidad', component: Privacidad},
  {path: 'terminos', component: Terminos},
  {path: 'seguridad', component: Seguridad},

  

  // 🔐 Protegidas (todas con AuthGuard)
  { path: 'perfil', component: PerfilUsuarioComponent, canActivate: [AuthGuard],
     data: {
      breadcrumb: 'Perfil' // 🔴 NUEVO → etiqueta para breadcrumb
    }
   },

{
  path: 'magazines',
  canActivate: [AuthGuard],
  loadComponent: () =>
    import('./pages/magazines/magazines.component')
      .then(m => m.MagazinesComponent)
},
{
  path: 'magazines/view/:id',
  canActivate: [AuthGuard],
  loadComponent: () =>
    import('./pages/magazines/magazine-viewer.component')
      .then(m => m.MagazineViewerComponent)
},
{
  path: 'magazines/:id',
  loadComponent: () =>
    import('./pages/magazines/magazine-detail.component')
      .then(m => m.MagazineDetailComponent)
},

{
  path: 'cart',
  canActivate: [AuthGuard],
  loadComponent: () => import('./pages/cart/cart.component')
    .then(m => m.CartComponent)
},

{
  path: 'checkout',
  canActivate: [AuthGuard],
  loadComponent: () => import('./pages/checkout/checkout.component')
    .then(m => m.CheckoutComponent)
},

  // 🧑‍💼 Panel de administrador con rutas anidadas
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    data: { roles: ['Administrador'],
    breadcrumb: 'Panel administrativo', //breadcrumb padre
    hideNavbar: true
    },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent},
      { path: 'usuarios', component: GestionUsuariosComponent},
      { path: 'preguntas', component: GestionFaqComponent},
      { path: 'contactos', component: GestionContactoComponent },
      {path: 'about',component: GestionAboutComponent},
      {path: 'revistas',component: GestionRevistasComponent,canActivate: [AuthGuard],data: { roles: ['Administrador'] } },

      //{ path: 'libros', component: AdminLibrosComponent },
      //{ path: 'revistas', component: AdminRevistasComponent },
      //{ path: 'noticias', component: AdminNoticiasComponent },
    ]
  },

  { path: '**', redirectTo: '/inicio' },
];

