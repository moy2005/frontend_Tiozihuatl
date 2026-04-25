import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class EventsService {
  private api = `${API_URL}/events`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('accessToken') || localStorage.getItem('token') || ''
        : '';

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  private buildParams(filters: Record<string, any> = {}): HttpParams {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    });

    return params;
  }

  getAll(filters: Record<string, any> = {}) {
    return this.http.get<any[]>(`${this.api}/admin`, {
      headers: this.getAuthHeaders(),
      params: this.buildParams(filters),
    });
  }

  create(data: FormData) {
    return this.http.post(`${this.api}/admin`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  update(id: number, data: FormData) {
    return this.http.put(`${this.api}/admin/${id}`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  delete(id: number) {
    return this.http.delete(`${this.api}/admin/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  updateDestacado(id: number, destacado: boolean) {
    return this.http.patch(
      `${this.api}/admin/${id}/destacado`,
      { destacado },
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  deleteImagen(idImagen: number) {
    return this.http.delete(`${this.api}/admin/imagenes/${idImagen}`, {
      headers: this.getAuthHeaders(),
    });
  }

  reorderImagenes(imagenes: Array<{ id_imagen: number; orden: number }>) {
    return this.http.put(
      `${this.api}/admin/imagenes/reordenar`,
      { imagenes },
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  getPublicEvents(filters: Record<string, any> = {}) {
    return this.http.get<any[]>(this.api, {
      params: this.buildParams(filters),
    });
  }

  getPublicEventById(id: number) {
    return this.http.get<any>(`${this.api}/${id}`);
  }
}
