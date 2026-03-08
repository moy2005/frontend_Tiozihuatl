import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class NewsService {
  private api = `${API_URL}/news`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  /** 📄 Listar noticias */
  getAll() {
    return this.http.get<any[]>(`${this.api}/admin`, {
      headers: this.getAuthHeaders(),
    });
  }

  /** ➕ Crear noticia */
  create(data: FormData) {
    return this.http.post(`${this.api}/admin`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  /** ✏️ Actualizar noticia */
  update(id: number, data: FormData) {
    return this.http.put(`${this.api}/admin/${id}`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  /** 🗑️ Eliminar */
  delete(id: number) {
    return this.http.delete(`${this.api}/admin/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  /** 🌐 Listar noticias públicas */
  getPublicNews() {
    return this.http.get<any[]>(`${this.api}`);
  }
}
