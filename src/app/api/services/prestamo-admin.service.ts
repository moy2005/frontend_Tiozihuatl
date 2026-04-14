import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';

export interface PrestamoAdmin {
  id_prestamo: number;
  id_usuario: number;
  libro_id: number;
  fecha_prestamo: string;
  fecha_vencimiento: string;
  fecha_devolucion: string | null;
  estado: 'Activo' | 'Devuelto' | 'Vencido' | 'Cancelado';
  gestionado_por: number | null;
  observaciones: string | null;
  nombre_estudiante: string;
  nombre: string;
  a_paterno: string | null;
  a_materno: string | null;
  matricula: string | null;
  estado_usuario: string | null;
  carrera: string | null;
  semestre: string | null;
  grupo: string | null;
  titulo: string;
  editorial: string | null;
  autores: string | null;
  stock_total: number | null;
  stock_disponible: number | null;
  gestionado_por_nombre: string | null;
}

export interface PrestamoAdminPayload {
  id_usuario: number;
  libro_id: number;
  observaciones?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PrestamoAdminService {
  private readonly baseUrl = `${API_URL}/prestamos/admin`;

  constructor(private http: HttpClient) {}

  listar(): Observable<{ success: boolean; data: PrestamoAdmin[] }> {
    return this.http.get<{ success: boolean; data: PrestamoAdmin[] }>(this.baseUrl);
  }

  crear(payload: PrestamoAdminPayload): Observable<any> {
    return this.http.post(this.baseUrl, payload);
  }

  actualizar(id: number, payload: PrestamoAdminPayload): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, payload);
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  devolver(id: number, observaciones?: string | null): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/devolver`, { observaciones });
  }

  cancelar(id: number, observaciones?: string | null): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/cancelar`, { observaciones });
  }

  marcarVencido(id: number, observaciones?: string | null): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/vencido`, { observaciones });
  }

  activar(id: number, observaciones?: string | null): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/activar`, { observaciones });
  }

  actualizarObservaciones(id: number, observaciones: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/observaciones`, { observaciones });
  }
}
