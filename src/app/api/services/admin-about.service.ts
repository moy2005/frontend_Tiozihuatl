import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { environment } from '../environments/environment';//CORRECTO

@Injectable({ providedIn: 'root' })
export class AdminAboutService {

  private api = `${environment.apiUrl}/admin/about`;

  constructor(private http: HttpClient) {}

  // 🔐 Headers con token
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  getAll() {
    return this.http.get<any[]>(this.api, {
      headers: this.getAuthHeaders()
    });
  }

  create(data: any) {
    return this.http.post(this.api, data, {
      headers: this.getAuthHeaders()
    });
  }

  update(id: number, data: any) {
    return this.http.put(`${this.api}/${id}`, data, {
      headers: this.getAuthHeaders()
    });
  }

  delete(id: number) {
    return this.http.delete(`${this.api}/${id}`, {
      headers: this.getAuthHeaders()
    });
  }
}
