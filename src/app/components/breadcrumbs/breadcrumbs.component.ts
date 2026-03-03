import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../api/services/auth';

interface Breadcrumb {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './breadcrumbs.component.html'
})
export class BreadcrumbsComponent {
  breadcrumbs: Breadcrumb[] = [];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.breadcrumbs = this.buildBreadcrumbs();
      });
  }

  // 🔐 SOLO mostrar si hay sesión
  get showBreadcrumbs(): boolean {
    return this.authService.isLoggedIn();
  }

  // 🧭 Breadcrumbs LÓGICOS
  private buildBreadcrumbs(): Breadcrumb[] {
    const crumbs: Breadcrumb[] = [];
    const url = this.router.url;

    if (!this.authService.isLoggedIn()) {
      return crumbs;
    }

    // Inicio lógico (privado)
    crumbs.push({ label: 'Inicio', url: '/perfil' });

    // Perfil
    if (url.includes('/perfil') || url.includes('/admin')) {
      crumbs.push({ label: 'Perfil de usuario', url: '/perfil' });
    }

    // Panel administrativo
    if (url.includes('/admin')) {
      crumbs.push({ label: 'Panel administrativo', url: '/admin-panel' });
    }

    return crumbs;
  }
}
