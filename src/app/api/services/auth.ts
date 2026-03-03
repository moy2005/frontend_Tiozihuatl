import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment.prod';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ==========================================================
  // 🔹 Registro de usuario
  // ==========================================================
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
    return this.http.get<{ exists: boolean }>(
      `${this.api}/auth/check-email?correo=${correo}`
    );
  }

  verificarTelefono(telefono: string) {
    return this.http.get<{ exists: boolean }>(
      `${this.api}/auth/check-phone?telefono=${telefono}`
    );
  }

  // ==========================================================
  // 🔹 Login
  // ==========================================================
  login(data: {
    credential: string;
    contrasena: string;
    rolSeleccionado: string;
  }): Observable<any> {
    return this.http.post(`${this.api}/auth/login`, data);
  }

  // ==========================================================
  // 🔹 Logout
  // ==========================================================
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
        { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      )
      .pipe(
        tap(() => this.clearSession()),
        catchError((err) => {
          this.clearSession();
          return throwError(() => err);
        })
      );
  }

  // ==========================================================
  // 🔄 Refresh token
  // ==========================================================
  refreshToken(): Observable<any> {
    const refresh = localStorage.getItem('refreshToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!refresh || !user?.id) {
      this.clearSession();
      return throwError(() => new Error('Sesión expirada.'));
    }

    const payload = { id_usuario: user.id, refreshToken: refresh };

    return this.http.post(`${this.api}/auth/refresh`, payload).pipe(
      tap((res: any) => {
        if (res?.accessToken && res?.refreshToken) {
          localStorage.setItem('accessToken', res.accessToken);
          localStorage.setItem('refreshToken', res.refreshToken);
        } else {
          this.clearSession();
        }
      }),
      catchError((err) => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  // ==========================================================
  // 🔐 ESTADO DE SESIÓN (CLAVE PARA BREADCRUMBS / NAVBAR)
  // ==========================================================
  isLoggedIn(): boolean {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    return !!accessToken && !!refreshToken;
  }

  // ==========================================================
  // 👤 USUARIO ACTUAL
  // ==========================================================
  getUser(): any {
    return JSON.parse(localStorage.getItem('user') || '{}');
  }

  // ==========================================================
  // 🔧 Limpia sesión
  // ==========================================================
  clearSession(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  // ==========================================================
  // 🔹 Pre-registro / verificación
  // ==========================================================
  preRegistro(data: any) {
    return this.http.post(`${this.api}/auth/pre-registro`, data);
  }

  verifyEmailLink(token: string) {
    return this.http.get(`${this.api}/auth/verify-email?token=${token}`);
  }

  finalizarRegistro(data: any) {
    return this.http.post(`${this.api}/auth/finalizar-registro`, data);
  }

  // ==========================================================
  // 🔑 Recuperación de contraseña
  // ==========================================================
  forgotPassword(payload: { correo: string; palabra_secreta: string }) {
    return this.http.post(`${this.api}/password/forgot`, payload);
  }

  validateToken(token: string) {
    return this.http.get(`${this.api}/password/validate?token=${token}`);
  }

  resetPassword(payload: { token: string; nuevaContrasena: string }) {
    return this.http.post(`${this.api}/password/reset`, payload);
  }
}
