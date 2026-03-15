import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../api/services/auth';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    // Sin tokens → redirigir a login
    if (!accessToken || !refreshToken) {
      return this.redirectToLogin('Inicia sesión para continuar.');
    }

    // ✅ Solo verificar que el token sea decodificable
    // El interceptor renueva automáticamente si expira — no hacerlo aquí
    const decoded = this.decodeToken(accessToken);
    if (!decoded) {
      return this.redirectToLogin('Sesión inválida. Inicia sesión nuevamente.');
    }

    // Verificar rol si la ruta lo requiere
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

  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  }

  private redirectToLogin(msg: string): UrlTree {
    Swal.fire('Autenticación requerida', msg, 'info');
    localStorage.clear();
    return this.router.createUrlTree(['/login']);
  }
}