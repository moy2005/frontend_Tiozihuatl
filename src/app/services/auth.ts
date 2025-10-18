import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** 🔹 Registro de usuario con 2FA */
  register(data: {
    nombre: string; apaterno: string; amaterno: string;
    correo: string; telefono: string; contrasena: string;
  }): Observable<any> {
    return this.http.post(`${this.api}/auth/register`, data);
  }
  verificarCorreo(correo: string) {
  return this.http.get<{ exists: boolean }>(`${this.api}/auth/check-email?correo=${correo}`);
}

verificarTelefono(telefono: string) {
  return this.http.get<{ exists: boolean }>(`${this.api}/auth/check-phone?telefono=${telefono}`);
}


  /** 🔹 Login tradicional (correo + contraseña) */
  login(data: { correo: string; contrasena: string }): Observable<any> {
    return this.http.post(`${this.api}/auth/login`, data);
  }

  /** 🔹 Logout — Cierra sesión e invalida tokens */
  logout(): Observable<any> {
    const token = localStorage.getItem('token');
    return this.http.post(`${this.api}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  
  refreshToken(): Observable<any> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return new Observable((observer) => observer.error('No hay refresh token'));

  return this.http.post(`${this.api}/auth/refresh`, { refreshToken });
}

}
