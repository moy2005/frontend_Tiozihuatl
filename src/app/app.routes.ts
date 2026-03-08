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
import { ContactanosComponent } from './pages/contactanos/contactanos';
import { GestionNoticiasComponent } from './pages/admin/gestion-noticias/gestion-noticias';
import { NoticiasComponent } from './pages/noticias/noticias';
import { CatalogoComponent } from './pages/biblioteca/catalogo-bibliografico/catalog.component';
import { CalendarioComponent } from './pages/calendario/calendario.component';
import { GestionCatalogoComponent} from './pages/admin/gestion-catalogo/gestion-catalogo';
import { GestionCalendarioComponent } from './pages/admin/gestion-calendario/gestion-calendario'

// Componentes de error
import { Error400Component } from './pages/error/error-400/error-400.component';
import { Error404Component } from './pages/error/error-404/error-404.component';
import { Error500Component } from './pages/error/error-500/error-500.component';
import { GestionPrestamosComponent } from './pages/admin/gestion-prestamos/gestion-prestamos';
import { VisorLibroComponent } from './pages/biblioteca/catalogo-bibliografico/visor-libro.component';
import {GestionBackupsComponent} from './pages/admin/gestion-backups/gestion-backups';

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
  { path: 'terminos', component: Terminos},
  { path: 'seguridad', component: Seguridad},
  { path: 'contactanos',component: ContactanosComponent},
  { path:'noticias',component:NoticiasComponent},
  { path: 'biblioteca/libro/:id', component: VisorLibroComponent, canActivate: [AuthGuard], data: { roles: ['Alumno', 'Administrador', 'Docente', 'Bibliotecario'] }},
  { path: 'catalogo', component: CatalogoComponent, canActivate: [AuthGuard],
    data: {
      roles: ['Alumno', 'Administrador', 'Docente','Bibliotecario'] // los que sí pueden
      }
  },
  { path: 'calendario', component: CalendarioComponent},


  // 🔐 Protegidas (todas con AuthGuard)
  { path: 'perfil', component: PerfilUsuarioComponent, canActivate: [AuthGuard] },

  // 🧑‍💼 Panel de administrador con rutas anidadas
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    data: { roles: ['Administrador'],
    hideNavbar: true
    },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'usuarios', component: GestionUsuariosComponent },
      { path: 'preguntas', component: GestionFaqComponent },
      { path: 'contactos', component: GestionContactoComponent },
      { path:'noticias',component:GestionNoticiasComponent},
      { path: 'libros', component: GestionCatalogoComponent },
      { path : 'calendario-admin', component: GestionCalendarioComponent },
      { path : 'prestamos', component:GestionPrestamosComponent },
      { path : 'backups', component:GestionBackupsComponent },
      //{ path: 'revistas', component: AdminRevistasComponent },
    ]
  },
  
  // Rutas de error específicas (públicas)
  { path: 'error-400', component: Error400Component },
  { path: 'error-404', component: Error404Component },
  { path: 'error-500', component: Error500Component },

  { path: '**', redirectTo: '/error-404' },
];

