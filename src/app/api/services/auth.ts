import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = `${API_URL}`;
  private readonly refreshSkewMs = 5 * 60_000;
  private readonly refreshRetryMs = 60_000;
  private readonly sessionIdleWindowMs = 7 * 24 * 60 * 60_000;
  private readonly sessionActivityKey = 'sessionLastActivityAt';
  private refreshRequest$: Observable<any> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private lifecycleInitialized = false;

  constructor(private readonly http: HttpClient) {
    this.initializeSessionLifecycle();
  }

  registerSessionActivity() {
    if (!this.hasStoredSession()) return;

    if (this.isSessionInactiveExpired()) {
      this.clearSession();
      return;
    }

    this.persistSessionActivity();
    this.scheduleProactiveRefresh();
  }

  private initializeSessionLifecycle() {
    if (typeof window === 'undefined' || this.lifecycleInitialized) return;

    this.lifecycleInitialized = true;

    const markActivity = () => this.registerSessionActivity();

    window.addEventListener('pointerdown', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity);
    window.addEventListener('touchstart', markActivity, { passive: true });
    window.addEventListener('focus', markActivity);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.registerSessionActivity();
      }
    });
    window.addEventListener('storage', (event) => {
      if (
        !event.key ||
        ['accessToken', 'token', 'refreshToken', 'sessionUserId', 'user', 'userData', 'usuario'].includes(
          event.key,
        )
      ) {
        if (this.hasStoredSession()) {
          this.ensureSessionActivityTimestamp();
          this.scheduleProactiveRefresh();
        } else {
          this.stopProactiveRefresh();
        }
      }
    });

    if (this.hasStoredSession()) {
      this.ensureSessionActivityTimestamp();
      this.scheduleProactiveRefresh();
    }
  }

  private hasStoredSession(): boolean {
    return !!localStorage.getItem('refreshToken') || !!this.getAccessToken();
  }

  private ensureSessionActivityTimestamp() {
    if (!this.hasStoredSession()) return;

    const current = Number(localStorage.getItem(this.sessionActivityKey));
    if (!Number.isFinite(current) || current <= 0) {
      localStorage.setItem(this.sessionActivityKey, String(Date.now()));
    }
  }

  private persistSessionActivity() {
    localStorage.setItem(this.sessionActivityKey, String(Date.now()));
  }

  private getLastSessionActivity(): number {
    const value = Number(localStorage.getItem(this.sessionActivityKey));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private isSessionInactiveExpired(): boolean {
    const lastActivity = this.getLastSessionActivity();
    if (!lastActivity) return false;

    return Date.now() - lastActivity >= this.sessionIdleWindowMs;
  }

  private stopProactiveRefresh() {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private getRefreshDelayMs(token: string | null): number {
    const payload = this.decodeToken(token);
    if (!payload?.exp) return 250;

    return payload.exp * 1000 - this.refreshSkewMs - Date.now();
  }

  private scheduleProactiveRefresh(delayMs?: number) {
    this.stopProactiveRefresh();

    if (!this.hasStoredSession()) return;

    this.ensureSessionActivityTimestamp();

    if (this.isSessionInactiveExpired()) {
      this.clearSession();
      return;
    }

    if (!localStorage.getItem('refreshToken')) return;

    const rawDelay = delayMs ?? this.getRefreshDelayMs(this.getAccessToken());
    const nextDelay = Math.max(250, rawDelay);

    this.refreshTimer = setTimeout(() => {
      this.runProactiveRefresh();
    }, nextDelay);
  }

  private runProactiveRefresh() {
    if (!this.hasUsableRefreshToken()) {
      this.stopProactiveRefresh();
      return;
    }

    if (this.isSessionInactiveExpired()) {
      this.clearSession();
      return;
    }

    if (this.getAccessToken() && !this.shouldRefreshAccessToken()) {
      this.scheduleProactiveRefresh();
      return;
    }

    this.refreshToken({ trackActivity: false }).subscribe({
      next: () => {
        this.scheduleProactiveRefresh();
      },
      error: () => {
        if (this.hasUsableRefreshToken()) {
          this.scheduleProactiveRefresh(this.refreshRetryMs);
        }
      },
    });
  }

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

  refreshToken(options: { trackActivity?: boolean } = {}): Observable<any> {
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
        }, { trackActivity: options.trackActivity ?? false });
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
      if (!this.hasUsableRefreshToken()) {
        this.clearSession();
        return throwError(() => new Error('No hay sesión activa.'));
      }

      return this.refreshToken().pipe(
        map((res: any) => res?.accessToken || this.getAccessToken()),
      );
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
    if (!refresh) return false;

    if (this.isSessionInactiveExpired()) {
      this.clearSession();
      return false;
    }

    return true;
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken') || localStorage.getItem('token');
  }

  clearSession() {
    this.refreshRequest$ = null;
    this.stopProactiveRefresh();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('sessionUserId');
    localStorage.removeItem(this.sessionActivityKey);
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

  storeSession(
    payload: {
      accessToken?: string;
      token?: string;
      refreshToken?: string;
      user?: any;
    },
    options: { trackActivity?: boolean } = {},
  ) {
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
    if (normalizedUser?.id !== undefined && normalizedUser?.id !== null) {
      localStorage.setItem('sessionUserId', String(normalizedUser.id));
    }

    if (normalizedUser) {
      const serializedUser = JSON.stringify(normalizedUser);
      localStorage.setItem('user', serializedUser);
      localStorage.setItem('userData', serializedUser);
      localStorage.setItem('usuario', serializedUser);
    }

    this.ensureSessionActivityTimestamp();

    if (options.trackActivity ?? true) {
      this.persistSessionActivity();
    }

    this.scheduleProactiveRefresh();
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

    const storedSessionUserId = localStorage.getItem('sessionUserId');
    if (storedSessionUserId) {
      const numericId = Number(storedSessionUserId);
      return Number.isNaN(numericId) ? storedSessionUserId : numericId;
    }

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
