import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';

export interface AdminDiscountPayload {
  nombre: string;
  tipo: 'porcentaje' | 'monto';
  valor: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'Activo' | 'Inactivo';
  revistas: number[];
}

export interface AdminDiscount {
  id_descuento: number;
  nombre: string;
  tipo: 'porcentaje' | 'monto';
  valor: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'Activo' | 'Inactivo';
  vigente: number;
  total_revistas: number;
  revista_ids: number[];
  revistas: string | null;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminDiscountsService {
  private api = `${API_URL}/discounts/admin`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<AdminDiscount[]> {
    return this.http.get<AdminDiscount[]>(this.api, { headers: this.authHeaders() });
  }

  create(payload: AdminDiscountPayload) {
    return this.http.post(this.api, payload, { headers: this.authHeaders() });
  }

  update(id: number, payload: AdminDiscountPayload) {
    return this.http.put(`${this.api}/${id}`, payload, { headers: this.authHeaders() });
  }

  toggleStatus(id: number) {
    return this.http.patch(`${this.api}/${id}/toggle-status`, {}, { headers: this.authHeaders() });
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
