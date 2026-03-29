import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../api/services/auth';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
    const accessToken = this.auth.getAccessToken();

    if (!accessToken) {
      return this.redirectToLogin('Inicia sesión para continuar.');
    }

    try {
      await firstValueFrom(this.auth.ensureValidSession());
    } catch {
      return this.redirectToLogin('Tu sesión expiró. Inicia sesión nuevamente.');
    }

    const currentToken = this.auth.getAccessToken() || '';
    const decoded = this.decodeToken(currentToken);
    if (!decoded) {
      return this.redirectToLogin('Sesión inválida. Inicia sesión nuevamente.');
    }

    const allowedRoles: string[] = route.data?.['roles'] || [];
    if (allowedRoles.length > 0) {
      const user = this.auth.getStoredUser();
      const userRole = user?.rol || decoded?.rol;

      if (!userRole || !allowedRoles.includes(userRole)) {
        Swal.fire({
          icon: 'warning',
          title: 'Acceso denegado',
          text: 'No tienes permisos para acceder a esta sección.',
          confirmButtonColor: '#E53E3E',
        });
        return this.router.createUrlTree(['/perfil']);
      }
    }

    return true;
  }

  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;

      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  private redirectToLogin(message: string): UrlTree {
    Swal.fire('Autenticación requerida', message, 'info');
    this.auth.clearSession();
    return this.router.createUrlTree(['/login']);
  }
}
