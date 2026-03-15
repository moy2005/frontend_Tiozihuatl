import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';

export interface SolicitarPrestamoResponse {
  success: boolean;
  message?: string;
  id?: number;
}

export interface Prestamo {
  id_prestamo: number;
  id_usuario: number;
  libro_id: number;
  fecha_prestamo: string;
  fecha_vencimiento: string;
  fecha_devolucion: string | null;
  estado: string;
  gestionado_por: number | null;
  observaciones: string | null;
  titulo?: string;
  tiene_digital?: number;
  previewUrl?: string;
  pdf_url?: string;
}

export interface MisPrestamosResponse {
  success: boolean;
  data?: Prestamo[];
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class PrestamoService {
  private baseUrl = `${API_URL}/prestamos`;

  constructor(private http: HttpClient) {}

  solicitarPrestamo(libro_id: number): Observable<SolicitarPrestamoResponse> {
    return this.http.post<SolicitarPrestamoResponse>(
      this.baseUrl,
      { libro_id }
    );
  }

  obtenerMisPrestamos(): Observable<MisPrestamosResponse> {
    return this.http.get<MisPrestamosResponse>(this.baseUrl);
  }
}