import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';

export interface SolicitarPrestamoResponse {
  success: boolean;
  message?: string;
  id?: number;
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
}