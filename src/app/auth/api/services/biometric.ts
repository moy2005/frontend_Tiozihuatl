import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class BiometricService {
  private api = `${environment.apiUrl}/webauthn`;

  constructor(private http: HttpClient) {}

registerWithBiometric(data: any) {
  return this.http.post<any>(`${this.api}/register/biometric`, data);
}

  registerOptions(data: { correo: string; tipo: string }) {
    return this.http.post<any>(`${this.api}/register/options`, data);
  }

  verifyRegister(data: any) {
    return this.http.post<any>(`${this.api}/register/verify`, data);
  }

  authOptions(data: { correo: string; tipo: string }) {
    return this.http.post<any>(`${this.api}/auth/options`, data);
  }

  authenticate(data: any) {
    return this.http.post<any>(`${this.api}/auth/verify`, data);
  }

  obtenerTipoBiometria(correo: string) {
    return this.http.get<any>(`${this.api}/tipo/${correo}`);
  }

  
}
