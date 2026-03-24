import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class MaintenanceService {

  private api = `${API_URL}/maintenance`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /*Ejecutar mantenimiento manual */
  runMaintenance() {
    return this.http.post(
      `${this.api}/run`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  /* Estado del sistema */
  getStatus() {
    return this.http.get(
      `${this.api}/status`,
      { headers: this.getAuthHeaders() }
    );
  }

  /* Historial de ejecuciones */
  getLogs() {
    return this.http.get(
      `${this.api}/logs`,
      { headers: this.getAuthHeaders() }
    );
  }

  /* Detalle completo de una ejecución */
  getLogDetail(id: number) {
    return this.http.get(
      `${this.api}/logs/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getTablasDetectadas() {
    return this.http.get(
      `${this.api}/tablas-detectadas`,
      { headers: this.getAuthHeaders() }
    );
  }
}
