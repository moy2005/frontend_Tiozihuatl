import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class BackupService {

  private api = `${API_URL}/backups`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  backupDatabase() {
    return this.http.get<{ message: string; fileName: string; url: string }>(
      `${this.api}/database`,
      { headers: this.getAuthHeaders() }
    );
  }

  backupTable(table: string) {
    return this.http.get<{ message: string; fileName: string; url: string }>(
      `${this.api}/table/${table}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getBackupHistory() {
    return this.http.get<any[]>(`${this.api}/history`, {
      headers: this.getAuthHeaders()
    });
  }

  getTables() {
    return this.http.get<{ tables: string[] }>(`${this.api}/tables`, {
      headers: this.getAuthHeaders()
    });
  }

}
