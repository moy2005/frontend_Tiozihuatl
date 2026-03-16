import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../api.config';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap, filter, take, switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = `${API_URL}`;

  // ✅ Control para evitar múltiples refresh simultáneos
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient) {}

  register(data: {
    nombre: string;
    apaterno: string;
    amaterno: string;
    correo: string;
    telefono: string;
    contrasena: string;
  }): Observable<any> {
    return this.http.post(`${this.api}/auth/register`, data);
  }
  verificarCorreo(correo: string) {
    return this.http.get<{ exists: boolean }>(`${this.api}/auth/check-email?correo=${correo}`);
  }
  verificarTelefono(telefono: string) {
    return this.http.get<{ exists: boolean }>(`${this.api}/auth/check-phone?telefono=${telefono}`);
  }
  login(data: {
    credential: string;
    contrasena: string;
    rolSeleccionado: string;
  }): Observable<any> {
    return this.http.post(`${this.api}/auth/login`, data);
  }

  logout(): Observable<any> {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      this.clearSession();
      return throwError(() => new Error('No hay sesión activa.'));
    }
    return this.http
      .post(
        `${this.api}/auth/logout`,
        {},
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) },
      )
      .pipe(
        tap(() => this.clearSession()),
        catchError((err) => {
          this.clearSession();
          return throwError(() => err);
        }),
      );
  }

  /**
   * ✅ Refresh serializado — solo una petición real a la vez.
   * Las demás esperan el resultado de la primera.
   */
  refreshToken(): Observable<any> {
    const refresh = localStorage.getItem('refreshToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!refresh || !user?.id) {
      this.clearSession();
      return throwError(() => new Error('Sesión expirada.'));
    }

    // Si ya hay un refresh en curso, esperar su resultado
    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(
        filter((token) => token !== null),
        take(1),
        switchMap((token) => [{ accessToken: token }]),
      );
    }

    // Primera petición — iniciar el refresh
    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    const payload = { id_usuario: user.id, refreshToken: refresh };

    return this.http.post(`${this.api}/auth/refresh`, payload).pipe(
      tap((res: any) => {
        if (res?.accessToken && res?.refreshToken) {
          localStorage.setItem('accessToken', res.accessToken);
          localStorage.setItem('refreshToken', res.refreshToken);
          this.refreshTokenSubject.next(res.accessToken);
          this.isRefreshing = false;
        } else {
          this.clearSession();
        }
      }),
     catchError((err) => {
    // Solo limpiar si el token es realmente inválido (401)
    // No limpiar por errores de red (0, 500, etc.)
    if (err.status === 401) {
      this.clearSession();
    }
    this.isRefreshing = false; // siempre liberar el lock
    return throwError(() => err);
  }),
    );
  }

  clearSession() {
    this.isRefreshing = false;
    this.refreshTokenSubject.next(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  preRegistro(data: any) {
    return this.http.post(`${this.api}/auth/pre-registro`, data);
  }
  verifyEmailLink(token: string) {
    return this.http.get(`${this.api}/auth/verify-email?token=${token}`);
  }
  finalizarRegistro(data: any) {
    return this.http.post(`${this.api}/auth/finalizar-registro`, data);
  }
  forgotPassword(payload: { correo: string; palabra_secreta: string }) {
    return this.http.post(`${this.api}/password/forgot`, payload);
  }
  validateToken(token: string) {
    return this.http.get(`${this.api}/password/validate?token=${token}`);
  }
  resetPassword(payload: { token: string; nuevaContrasena: string }) {
    return this.http.post(`${this.api}/password/reset`, payload);
  }

  /** Verificar token de activación antes de mostrar formulario */
verifyActivationToken(token: string): Observable<any> {
  return this.http.get(`${this.api}/auth/activate-account?token=${token}`);
}

/** Activar cuenta con token + contraseña */
activateAccount(payload: {
  token: string;
  password: string;
  confirm_password: string;
}): Observable<any> {
  return this.http.post(`${this.api}/auth/activate-account`, payload);
}
}
