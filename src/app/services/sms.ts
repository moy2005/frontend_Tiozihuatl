import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SmsService {
  private api = environment.apiUrl;

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
