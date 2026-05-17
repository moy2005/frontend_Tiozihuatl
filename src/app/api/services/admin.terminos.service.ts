import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../app/api/environments/environment.prod';

export interface SeccionTermino {
  id?:        number;
  numero:     number;
  titulo:     string;
  subtitulo?: string;
  contenido:  string;
  activo?:    number;
  orden:      number;
}

@Injectable({ providedIn: 'root' })
export class AdminTerminosService {

  private base = `${environment.apiUrl}/terminos/admin`;

  constructor(private http: HttpClient) {}

  listar(): Observable<SeccionTermino[]> {
    return this.http.get<SeccionTermino[]>(this.base);
  }

  crear(data: SeccionTermino): Observable<any> {
    return this.http.post(this.base, data);
  }

  actualizar(id: number, data: SeccionTermino): Observable<any> {
    return this.http.put(`${this.base}/${id}`, data);
  }

  cambiarEstado(id: number, activo: number): Observable<any> {
    return this.http.patch(`${this.base}/${id}/estado`, { activo });
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`);
  }
}