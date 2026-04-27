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

  runMaintenance() {
    return this.http.post(
      `${this.api}/run`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  getStatus() {
    return this.http.get(
      `${this.api}/status`,
      { headers: this.getAuthHeaders() }
    );
  }

  getLogs() {
    return this.http.get(
      `${this.api}/logs`,
      { headers: this.getAuthHeaders() }
    );
  }

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

  limpiarLogs(dias: number = 90) {
    return this.http.delete(
      `${this.api}/logs/limpiar?dias=${dias}`,
      { headers: this.getAuthHeaders() }
    );
  }
}
