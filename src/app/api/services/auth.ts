import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = `${API_URL}`;
  private refreshRequest$: Observable<any> | null = null;

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
    return this.http.get<{ exists: boolean }>(
      `${this.api}/auth/check-email?correo=${correo}`,
    );
  }

  verificarTelefono(telefono: string) {
    return this.http.get<{ exists: boolean }>(
      `${this.api}/auth/check-phone?telefono=${telefono}`,
    );
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
      return throwError(() => new Error('No hay sesiÃ³n activa.'));
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

  refreshToken(): Observable<any> {
    const refresh = localStorage.getItem('refreshToken');
    const userId = this.getSessionUserId();

    if (!refresh || refresh === 'biometric-placeholder' || !userId) {
      this.clearSession();
      return throwError(() => new Error('SesiÃ³n expirada.'));
    }

    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const payload = { id_usuario: userId, refreshToken: refresh };

    this.refreshRequest$ = this.http.post(`${this.api}/auth/refresh`, payload).pipe(
      tap((res: any) => {
        if (!res?.accessToken) {
          this.clearSession();
          throw new Error('No se recibiÃ³ un access token nuevo.');
        }

        this.storeSession({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken || refresh,
          user: this.getStoredUser(),
        });
      }),
      catchError((err) => {
        if (err.status === 401 || err.status === 403) {
          this.clearSession();
        }
        return throwError(() => err);
      }),
      finalize(() => {
        this.refreshRequest$ = null;
      }),
      shareReplay(1),
    );

    return this.refreshRequest$;
  }

  clearSession() {
    this.refreshRequest$ = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userData');
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
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

  verifyActivationToken(token: string): Observable<any> {
    return this.http.get(`${this.api}/auth/activate-account?token=${token}`);
  }

  activateAccount(payload: {
    token: string;
    password: string;
    confirm_password: string;
  }): Observable<any> {
    return this.http.post(`${this.api}/auth/activate-account`, payload);
  }

  storeSession(payload: {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
    user?: any;
  }) {
    const accessToken = payload.accessToken || payload.token;
    if (!accessToken) return;

    localStorage.setItem('accessToken', accessToken);

    if (payload.refreshToken) {
      localStorage.setItem('refreshToken', payload.refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }

    const normalizedUser = this.normalizeUser(payload.user, accessToken);
    if (normalizedUser) {
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    }
  }

  getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }

  getSessionUserId(): number | string | null {
    const user = this.getStoredUser();
    if (user?.id) return user.id;
    if (user?.id_usuario) return user.id_usuario;

    const payload = this.decodeToken(localStorage.getItem('accessToken'));
    return payload?.id || payload?.id_usuario || null;
  }

  isTokenExpired(token: string | null): boolean {
    const payload = this.decodeToken(token);
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000;
  }

  private normalizeUser(user: any, accessToken: string) {
    const payload = this.decodeToken(accessToken) || {};
    const baseUser = user || {};
    const id = baseUser.id ?? baseUser.id_usuario ?? payload.id ?? payload.id_usuario;

    if (!id && !baseUser.nombre && !payload.correo) {
      return null;
    }

    return {
      ...baseUser,
      id,
      id_usuario: baseUser.id_usuario ?? id,
      rol: baseUser.rol ?? payload.rol ?? null,
      correo: baseUser.correo ?? payload.correo ?? null,
      nombre: baseUser.nombre ?? payload.nombre ?? null,
      metodo_autenticacion:
        baseUser.metodo_autenticacion ?? payload.metodo_autenticacion ?? null,
    };
  }

  private decodeToken(token: string | null) {
    if (!token) return null;

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
}
