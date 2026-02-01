import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private api = `${environment.apiUrl}/contact/admin`;

  constructor(private http: HttpClient) {}

  /** 🔐 Headers con token */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  /** 📄 Obtener info de contacto (admin) */
  getContactInfo() {
    return this.http.get<any>(this.api, {
      headers: this.getAuthHeaders(),
    });
  }

  /** 💾 Guardar / actualizar info de contacto */
  saveContactInfo(data: any) {
    return this.http.post(this.api, data, {
      headers: this.getAuthHeaders(),
    });
  }
}
