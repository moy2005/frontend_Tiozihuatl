import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../api.config';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SmsService {
  private api = `${API_URL}`;

  constructor(private http: HttpClient) {}

  /** 🚀 Enviar código OTP al teléfono */
  sendOTP(data: { telefono: string }): Observable<any> {
    return this.http.post(`${this.api}/sms/send`, data);
  }

  /** ✅ Verificar OTP recibido */
  verifyOTP(data: { telefono: string; otp: string }): Observable<any> {
    return this.http.post(`${this.api}/sms/verify`, data);
  }
}
