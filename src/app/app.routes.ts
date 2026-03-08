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
import { CatalogoComponent } from './pages/biblioteca/catalogo-bibliografico/catalog.component';
import { GestionCatalogoComponent} from './pages/admin/gestion-catalogo/gestion-catalogo';
// Componentes de error
import { Error400Component } from './pages/error/error-400/error-400.component';
import { Error404Component } from './pages/error/error-404/error-404.component';
import { Error500Component } from './pages/error/error-500/error-500.component';
//Calendario
import { GestionCalendarioComponent } from './pages/admin/gestion-calendario/gestion-calendario'


export const routes: Routes = [
  { path: '', redirectTo: '/inicio', pathMatch: 'full' },

  // 🔓 Públicas
  { path: 'login', component: LoginComponent,
     data: { breadcrumb: 'Inicio' }
   },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path:'reset-password', component: ResetPasswordComponent},
  { path: 'verificar-correo', component: VerificarCorreoComponent },
  { path: 'inicio',component: InicioComponent},

  { path: 'about', component: AboutComponent },
  
  { path: 'privacidad', component: Privacidad},
  { path: 'terminos', component: Terminos},
  { path: 'seguridad', component: Seguridad},

  { path: 'catalogo', component: CatalogoComponent},

  

  // 🔐 Protegidas (todas con AuthGuard)
  { path: 'perfil', component: PerfilUsuarioComponent, canActivate: [AuthGuard],
   /*  data: {
      breadcrumb: 'Perfil' // 🔴 NUEVO → etiqueta para breadcrumb
    }*/
   },

{
  path: 'magazines',
  canActivate: [AuthGuard],
  //data: { breadcrumb: 'Revistas' },
  loadComponent: () =>
    import('./pages/magazines/magazines.component')
      .then(m => m.MagazinesComponent)
},
{
  path: 'magazines/view/:id',
  canActivate: [AuthGuard],
  //data: { breadcrumb: 'Detalle' },
  loadComponent: () =>
    import('./pages/magazines/magazine-viewer.component')
      .then(m => m.MagazineViewerComponent)
},
{
  path: 'magazines/:id',
  //data: { breadcrumb: 'Revista' },
  loadComponent: () =>
    import('./pages/magazines/magazine-detail.component')
      .then(m => m.MagazineDetailComponent)
},

{
  path: 'cart',
  canActivate: [AuthGuard],
  //data: { breadcrumb: 'Carrito' }, 
  loadComponent: () => import('./pages/cart/cart.component')
    .then(m => m.CartComponent)
},

{
  path: 'checkout',
  canActivate: [AuthGuard],
  //data: { breadcrumb: 'Checkout' },
  loadComponent: () => import('./pages/checkout/checkout.component')
    .then(m => m.CheckoutComponent)
},

  // 🧑‍💼 Panel de administrador con rutas anidadas
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    data: { roles: ['Administrador'],
    //breadcrumb: 'Panel administrativo', //breadcrumb padre
    hideNavbar: true
    },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent},
      { path: 'usuarios', component: GestionUsuariosComponent},
      { path: 'preguntas', component: GestionFaqComponent},
      { path: 'contactos', component: GestionContactoComponent },

      { path: 'about', component: GestionAboutComponent },
      { path: 'revistas', component: GestionRevistasComponent, canActivate: [AuthGuard], data: { roles: ['Administrador'] } },
      { path: 'libros', component: GestionCatalogoComponent },
      { path: 'calendario', component: GestionCalendarioComponent },

      //{ path: 'revistas', component: AdminRevistasComponent },
      //{ path: 'noticias', component: AdminNoticiasComponent },
    ]
  },
    // Rutas de error específicas (públicas)
  { path: 'error-400', component: Error400Component },
  { path: 'error-404', component: Error404Component },
  { path: 'error-500', component: Error500Component },


  { path: '**', redirectTo: '/error-404' },
];

