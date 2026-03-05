import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private api = `${API_URL}/users/profile`;

  constructor(private http: HttpClient) {}

  /** 🧠 Obtener el perfil del usuario autenticado */
  getProfile() {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.api}`, { headers });
  }

  /** 🛠️ Actualizar los datos del perfil */
  updateProfile(data: any) {
    const headers = this.getAuthHeaders();
    return this.http.put<any>(`${this.api}`, data, { headers });
  }

  /** 🔒 Cambiar contraseña del usuario */
  changePassword(actual: string, nueva: string) {
    const headers = this.getAuthHeaders();
    const body = { contrasenaActual: actual, nuevaContrasena: nueva };
    return this.http.put<any>(`${this.api}/change-password`, body, { headers });
  }

  /** 🔐 Helper para agregar token automáticamente */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }
}
