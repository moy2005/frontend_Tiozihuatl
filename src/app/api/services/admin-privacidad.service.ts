import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../app/api/environments/environment.prod'

export interface SeccionPolitica {
  id?: number;
  seccion_numero: number;
  titulo: string;
  contenido: string;
  icono: string;
  orden: number;
  activo?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminPrivacidadService {
  private base = `${environment.apiUrl}/privacidad/admin`;

  constructor(private http: HttpClient) {}

  listar(filtros: any = {}): Observable<SeccionPolitica[]> {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined)
        params = params.set(k, String(v));
    });
    return this.http.get<SeccionPolitica[]>(this.base, { params });
  }

  crear(data: SeccionPolitica): Observable<any> {
    return this.http.post(this.base, data);
  }

  actualizar(id: number, data: SeccionPolitica): Observable<any> {
    return this.http.put(`${this.base}/${id}`, data);
  }

  cambiarEstado(id: number, activo: number): Observable<any> {
    return this.http.patch(`${this.base}/${id}/estado`, { activo });
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete(`${this.base}/${id}`);
  }
}