import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class BiometricService {
  private api = `${API_URL}/webauthn`;

  constructor(private http: HttpClient) {}

registerBiometric(data: any) {
  return this.http.post<any>(`${this.api}/register/biometric`, data);
}

  registerOptions(data: { correo: string; tipo: string }) {
    return this.http.post<any>(`${this.api}/register/options`, data);
  }

  verifyRegister(data: any) {
    return this.http.post<any>(`${this.api}/register/verify`, data);
  }

  authOptions(data: { credential: string; tipo?: string }) {
    return this.http.post<any>(`${this.api}/auth/options`, data);
  }

  authenticate(data: any) {
    return this.http.post<any>(`${this.api}/auth/verify`, data);
  }

  obtenerTipoBiometria(credential: string) {
    return this.http.get<any>(`${this.api}/tipo/${encodeURIComponent(credential)}`);
  }

  
}
