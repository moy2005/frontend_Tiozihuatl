import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private api = `${environment.apiUrl}/users/admin`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  /** 👥 Listar todos los usuarios */
  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}`, { headers: this.getAuthHeaders() });
  }

  /** ➕ Crear usuario */
  create(data: any): Observable<any> {
    return this.http.post(`${this.api}`, data, { headers: this.getAuthHeaders() });
  }

  /** ✏️ Actualizar usuario */
  update(id: number, data: any): Observable<any> {
    return this.http.put(`${this.api}/${id}`, data, { headers: this.getAuthHeaders() });
  }

  /** 🚫 Desactivar usuario */
  delete(id: number): Observable<any> {
    return this.http.delete(`${this.api}/${id}`, { headers: this.getAuthHeaders() });
  }

  /** 🎭 Obtener roles activos */
  getRoles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/roles/all`, { headers: this.getAuthHeaders() });
  }

getCarreras(): Observable<any[]> {
  return this.http.get<any[]>(`${this.api}/carreras`, {
    headers: this.getAuthHeaders(),
  });
}

getSemestres(): Observable<any[]> {
  return this.http.get<any[]>(`${this.api}/semestres`, {
    headers: this.getAuthHeaders(),
  });
}

}

