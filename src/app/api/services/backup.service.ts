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
    return this.http.get(`${this.api}/database`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob',
      observe: 'response'
    });
  }

  backupTable(table: string) {
    return this.http.get(`${this.api}/table/${table}`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob',
      observe: 'response'
    });
  }

  getBackupHistory() {
    return this.http.get<any[]>(`${this.api}/history`, {
      headers: this.getAuthHeaders()
    });
  }

  //  Descarga el .sql desde la URL de Cloudinary
  downloadFromUrl(url: string) {
    return this.http.get(url, {
      responseType: 'blob',
      observe: 'response'
    });
  }

}