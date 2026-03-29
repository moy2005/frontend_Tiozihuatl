import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { API_URL } from '../api.config';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private api = `${API_URL}/users/admin`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  /** 👥 Listar todos los usuarios */
  getAll(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}`, { headers: this.getAuthHeaders() });
  }

  /** ➕ Crear usuario */
  create(data: any): Observable<any> {
    return this.http.post(`${this.api}`, data, { headers: this.getAuthHeaders() });
  }

  /** ✏️ Actualizar usuario */
  update(id: number, data: any): Observable<any> {
    return this.http.put(`${this.api}/${id}`, data, { headers: this.getAuthHeaders() });
  }

  /** 🚫 Desactivar usuario */
  delete(id: number): Observable<any> {
    return this.http.delete(`${this.api}/${id}`, { headers: this.getAuthHeaders() });
  }

  /** 🎭 Obtener roles activos */
  getRoles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/roles/all`, { headers: this.getAuthHeaders() });
  }

  /** 🏫 Obtener carreras */
  getCarreras(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/carreras`, { headers: this.getAuthHeaders() });
  }

  /** 📅 Obtener semestres */
  getSemestres(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/semestres`, { headers: this.getAuthHeaders() });
  }

  /** 📤 Importar usuarios desde Excel */
  importExcel(formData: FormData): Observable<any> {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
    return this.http.post<any>(`${this.api}/import`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /** 📥 Descargar plantilla Excel */
  downloadTemplate(idRol: number | string): Observable<Blob> {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
    return this.http.get(`${this.api}/template`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: new HttpParams().set('id_rol', String(idRol)),
      responseType: 'blob',
    });
  }

  /** 🔍 Filtros avanzados de usuarios */
  getFiltered(filters: {
    rol?: string;
    id_carrera?: number | string;
    id_semestre?: number | string;
    grupo?: string;
    id_periodo?: number | string;
  }): Observable<any[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== null && val !== undefined && val !== '') {
        params = params.set(key, String(val));
      }
    });
    return this.http.get<any[]>(`${this.api}/filtros`, {
      headers: this.getAuthHeaders(),
      params,
    });
  }

  /** ⏭️ Avanzar semestre global por periodo */
avanzarSemestre(payload: {
  id_periodo_origen: number | string;
  id_periodo_destino: number | string;
  estudiantes: { id_usuario: number; accion: string }[];
}): Observable<any> {
  return this.http.post<any>(
    `${this.api}/avanzar-semestre`,
    payload,
    { headers: this.getAuthHeaders() }
  );
}

/** 👁 Preview de estudiantes para avanzar semestre */
getPreviewAvance(id_periodo: number | string): Observable<any[]> {
  return this.http.get<any[]>(`${this.api}/avanzar-preview`, {
    headers: this.getAuthHeaders(),
    params: new HttpParams().set('id_periodo', String(id_periodo))
  });
}

getPeriodosTodos(): Observable<any[]> {
  return this.http.get<any[]>(`${this.api}/periodos`, { headers: this.getAuthHeaders() });
}

  /** 📆 Obtener periodos */
  getPeriodosActivos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/periodos/activo`, { headers: this.getAuthHeaders() });
  }

  /** 🔍 Obtener semestres y grupos disponibles de un periodo */
getOpcionesPorPeriodo(id_periodo: number | string): Observable<{ semestres: any[], grupos: string[] }> {
  return this.http.get<any>(`${this.api}/filtros-opciones`, {
    headers: this.getAuthHeaders(),
    params: new HttpParams().set('id_periodo', String(id_periodo))
  });
}

/** Regenerar token de activación */
regenerarToken(id_usuario: number): Observable<any> {
  return this.http.post(
    `${this.api}/regenerar-token/${id_usuario}`,
    {},
    { headers: this.getAuthHeaders() }
  );
}

}
