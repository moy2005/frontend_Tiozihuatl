import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';

export interface AdminPaymentFilters {
  estado?: string;
  usuario?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  limit?: number;
}

export interface AdminPayment {
  id_compra: number;
  id_usuario: number | null;
  id_pago: number | null;
  usuario: string | null;
  correo: string | null;
  revistas: string;
  total_compra: number | string;
  monto_pagado: number | string;
  descuento_total: number | string;
  metodo: string;
  referencia: string | null;
  estado_compra: string;
  estado_pago: string;
  estado: 'aprobado' | 'pendiente' | 'cancelado';
  fecha: string | null;
}

export interface AdminPaymentStats {
  total_compras: number;
  aprobadas: number;
  pendientes: number;
  canceladas: number;
  ingresos: number | string;
  descuentos: number | string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminPaymentsService {
  private api = `${API_URL}/payments/admin`;

  constructor(private http: HttpClient) {}

  getPurchases(filters: AdminPaymentFilters = {}): Observable<AdminPayment[]> {
    return this.http.get<AdminPayment[]>(`${this.api}/purchases`, {
      headers: this.authHeaders(),
      params: this.cleanParams(filters),
    });
  }

  getStats(filters: AdminPaymentFilters = {}): Observable<AdminPaymentStats> {
    return this.http.get<AdminPaymentStats>(`${this.api}/stats`, {
      headers: this.authHeaders(),
      params: this.cleanParams(filters),
    });
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private cleanParams(filters: AdminPaymentFilters): HttpParams {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    });

    return params;
  }
}
