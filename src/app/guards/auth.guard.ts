import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../api/services/auth';
import Swal from 'sweetalert2';
import { lastValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    // 🚫 Sin tokens → redirige a login
    if (!accessToken || !refreshToken) {
      return this.redirectToLogin('Inicia sesión para continuar.');
    }

    const decoded = this.decodeToken(accessToken);
    if (!decoded || this.isExpired(decoded.exp)) {
      const refreshed = await this.tryRefreshToken();
      if (!refreshed) return this.redirectToLogin('Tu sesión expiró. Inicia sesión nuevamente.');
    }

    // ✅ Verificar rol (si la ruta tiene restricción de roles)
    const allowedRoles: string[] = route.data?.['roles'] || [];
    if (allowedRoles.length > 0) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user?.rol || !allowedRoles.includes(user.rol)) {
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

  // ==========================================================
  // 🔁 Refrescar token automáticamente
  // ==========================================================
  private async tryRefreshToken(): Promise<boolean> {
    try {
      const res: any = await lastValueFrom(this.auth.refreshToken());
      if (res?.accessToken && res?.refreshToken) {
        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('refreshToken', res.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ==========================================================
  // 🔍 Decodificar token JWT
  // ==========================================================
  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  }

  // ==========================================================
  // ⏰ Verificar expiración
  // ==========================================================
  private isExpired(exp: number): boolean {
    return Date.now() >= exp * 1000;
  }

  // ==========================================================
  // 🚪 Redirigir al login
  // ==========================================================
  private redirectToLogin(msg: string): UrlTree {
    Swal.fire('Sesión cerrada', msg, 'info');
    localStorage.clear();
    return this.router.createUrlTree(['/login']);
  }
}
