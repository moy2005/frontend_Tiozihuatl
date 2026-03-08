import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class HelpService {
  private api = `${API_URL}/help`;

  constructor(private http: HttpClient) {}

  /** 🔐 Headers con token */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  // =======================
  // ADMIN
  // =======================

  /** 📄 Obtener todas las FAQ (admin) */
  getAllAdmin() {
    return this.http.get<any[]>(`${this.api}/admin`, {
      headers: this.getAuthHeaders(),
    });
  }

  /** ➕ Crear FAQ */
  createFaq(data: any) {
    return this.http.post(`${this.api}/admin`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  /** ✏️ Actualizar FAQ */
  updateFaq(id: number, data: any) {
    return this.http.put(`${this.api}/admin/${id}`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  /** 🗑️ Eliminar FAQ */
  deleteFaq(id: number) {
    return this.http.delete(`${this.api}/admin/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  // =======================
  // PUBLIC
  // =======================

  /** 🌐 Obtener FAQ públicas */
  getPublicFaqs() {
    return this.http.get<any[]>(`${this.api}`);
  }
}
