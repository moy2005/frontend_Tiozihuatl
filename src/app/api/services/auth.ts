import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment.prod';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** 🔹 Registro de usuario */
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

  /** 🔹 Login tradicional */
  login(data: {
    credential: string;
    contrasena: string;
    rolSeleccionado: string;
  }): Observable<any> {
    return this.http.post(`${this.api}/auth/login`, data);
  }

  /** 🔹 Logout — cierra sesión y limpia datos */
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

  /** 🔄 Refresh token seguro */
  refreshToken(): Observable<any> {
    const refresh = localStorage.getItem('refreshToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // 🚫 Si no hay datos válidos, no continuar
    if (!refresh || !user?.id) {
      console.warn('⚠️ Sin refresh token o usuario, cerrando sesión.');
      this.clearSession();
      return throwError(() => new Error('Sesión expirada.'));
    }

    const payload = { id_usuario: user.id, refreshToken: refresh };

    return this.http.post(`${this.api}/auth/refresh`, payload).pipe(
      tap((res: any) => {
        if (res?.accessToken && res?.refreshToken) {
          localStorage.setItem('accessToken', res.accessToken);
          localStorage.setItem('refreshToken', res.refreshToken);
          console.log('✅ Tokens actualizados correctamente');
        } else {
          console.warn('⚠️ Tokens inválidos en respuesta, cerrando sesión.');
          this.clearSession();
        }
      }),
      catchError((err) => {
        console.error('❌ Error al renovar tokens:', err);
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  /** 🔧 Limpia el almacenamiento local */
  clearSession() {
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


// ===============================
// Recuperación de contraseña
// ===============================

// 1) Enviar correo con enlace
forgotPassword(payload: { correo: string }) {
  return this.http.post(`${this.api}/password/forgot`, payload);
}

// 2) Validar token del enlace
validateToken(token: string) {
  return this.http.get(`${this.api}/password/validate?token=${token}`);
}

// 3) Restablecer contraseña usando token
resetPassword(payload: { token: string; nuevaContrasena: string }) {
  return this.http.post(`${this.api}/password/reset`, payload);
}

}
