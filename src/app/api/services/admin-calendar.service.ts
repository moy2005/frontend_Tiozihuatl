import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../api/environments/environment.prod';

@Injectable({
  providedIn: 'root'
})
export class AdminCalendarService {

  private readonly API_URL = `${environment.apiUrl}/calendarios/admin`;

  constructor(private http: HttpClient) {}

  // 📥 Obtener todos
  getAll() {
    return this.http.get<any[]>(this.API_URL);
  }

  // ➕ Crear (JSON)
  create(data: any) {
    return this.http.post(this.API_URL, data);
  }

  // ✏️ Actualizar (JSON)
  update(id: number, data: any) {
    return this.http.put(`${this.API_URL}/${id}`, data);
  }

  // 🔄 Activar / Desactivar
  toggleStatus(id: number, activo: number) {
    return this.http.put(`${this.API_URL}/${id}/status`, { activo });
  }

  // 🗑 Eliminar
  delete(id: number) {
    return this.http.delete(`${this.API_URL}/${id}`);
  }
}