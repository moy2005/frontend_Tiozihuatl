import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';

export interface PrestamoAdmin {
  id_prestamo: number;
  id_usuario: number;
  libro_id: number;
  titulo: string;
  nombre: string;
  fecha_prestamo: string;
  fecha_vencimiento: string;
  fecha_devolucion: string | null;
  estado: 'Activo' | 'Devuelto' | 'Vencido' | 'Cancelado';
  gestionado_por: number | null;
  observaciones: string | null;
}

@Injectable({ providedIn: 'root' })
export class PrestamoAdminService {
  private baseUrl = `${API_URL}/prestamos/admin`;

  constructor(private http: HttpClient) {}

  listar(): Observable<{ success: boolean; data: PrestamoAdmin[] }> {
    return this.http.get<{ success: boolean; data: PrestamoAdmin[] }>(this.baseUrl);
  }

  devolver(id: number, observaciones?: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/devolver`, { observaciones });
  }

  cancelar(id: number, observaciones?: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/cancelar`, { observaciones });
  }

  marcarVencido(id: number, observaciones?: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/vencido`, { observaciones });
  }

  actualizarObservaciones(id: number, observaciones: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/${id}/observaciones`, { observaciones });
  }
}

