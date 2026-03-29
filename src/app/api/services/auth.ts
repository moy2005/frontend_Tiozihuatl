import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${API_URL}`;
  private readonly refreshSkewMs = 60_000;
  private refreshRequest$: Observable<any> | null = null;

  constructor(private readonly http: HttpClient) {}

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
    const token = this.getAccessToken();
    const userId = this.getSessionUserId();

    if (!token) {
      this.clearSession();
      return throwError(() => new Error('No hay sesión activa.'));
    }

    return this.http
      .post(
        `${this.api}/auth/logout`,
        { id_usuario: userId },
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

    if (!refresh || !userId) {
      this.clearSession();
      return throwError(() => new Error('Sesión expirada.'));
    }

    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const payload = { id_usuario: userId, refreshToken: refresh };

    this.refreshRequest$ = this.http.post(`${this.api}/auth/refresh`, payload).pipe(
      tap((res: any) => {
        if (!res?.accessToken) {
          this.clearSession();
          throw new Error('No se recibió un access token nuevo.');
        }

        this.storeSession({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken || refresh,
          user: res.user || this.getStoredUser(),
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

  ensureValidSession(): Observable<string | null> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      this.clearSession();
      return throwError(() => new Error('No hay sesión activa.'));
    }

    if (!this.shouldRefreshAccessToken(accessToken)) {
      return of(accessToken);
    }

    if (!this.hasUsableRefreshToken()) {
      this.clearSession();
      return throwError(() => new Error('Sesión expirada.'));
    }

    return this.refreshToken().pipe(
      map((res: any) => res?.accessToken || this.getAccessToken()),
    );
  }

  hasUsableRefreshToken(): boolean {
    const refresh = localStorage.getItem('refreshToken');
    return !!refresh;
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken') || localStorage.getItem('token');
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
    localStorage.setItem('token', accessToken);

    if (payload.refreshToken !== undefined) {
      if (payload.refreshToken) {
        localStorage.setItem('refreshToken', payload.refreshToken);
      } else {
        localStorage.removeItem('refreshToken');
      }
    } else if (!localStorage.getItem('refreshToken')) {
      localStorage.removeItem('refreshToken');
    }

    const normalizedUser = this.normalizeUser(payload.user, accessToken);
    if (normalizedUser) {
      const serializedUser = JSON.stringify(normalizedUser);
      localStorage.setItem('user', serializedUser);
      localStorage.setItem('userData', serializedUser);
      localStorage.setItem('usuario', serializedUser);
    }
  }

  getStoredUser() {
    const candidates = ['user', 'userData', 'usuario'];

    for (const key of candidates) {
      try {
        const value = localStorage.getItem(key);
        if (value) return JSON.parse(value);
      } catch {
        continue;
      }
    }

    return {};
  }

  getSessionUserId(): number | string | null {
    const user = this.getStoredUser();
    if (user?.id) return user.id;
    if (user?.id_usuario) return user.id_usuario;

    const payload = this.decodeToken(this.getAccessToken());
    return payload?.id || payload?.id_usuario || null;
  }

  isTokenExpired(token: string | null): boolean {
    const payload = this.decodeToken(token);
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000;
  }

  shouldRefreshAccessToken(
    token: string | null = this.getAccessToken(),
    skewMs = this.refreshSkewMs,
  ): boolean {
    const payload = this.decodeToken(token);
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000 - skewMs;
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
