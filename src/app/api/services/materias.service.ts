import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../api.config';

export interface CanDeleteResponse {
  puedeEliminar: boolean;
  relaciones: { tabla: string; columna: string; total: number }[];
}

@Injectable({ providedIn: 'root' })
export class MateriasService {

  private apiUrl = `${API_URL}/materias`;

  constructor(private http: HttpClient) {}

  getAll(params?: any) {
    return this.http.get<any[]>(this.apiUrl, { params });
  }
  
  create(data: any) {
    return this.http.post(this.apiUrl, data);
  }

  update(id: number, data: any) {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  toggle(id: number, activo: number) {
    return this.http.put(`${this.apiUrl}/${id}/status`, { activo });
  }

  canDelete(id: number) {
    return this.http.get<CanDeleteResponse>(`${this.apiUrl}/${id}/can-delete`);
  }

  delete(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}