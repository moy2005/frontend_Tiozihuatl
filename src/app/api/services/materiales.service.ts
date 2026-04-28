import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_URL } from '../api.config';
import { Observable } from 'rxjs';

export interface MaterialesResponse {
  data:       any[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class MaterialesService {

  private api = `${API_URL}/material`;

  constructor(private http: HttpClient) {}

  // ── PÚBLICO (alumnos) ─────────────────────────────────────────

  getAll(filters: any = {}) {
    const params = this.buildParams(filters);
    return this.http.get(this.api, { params });
  }

  getAllMateriales(filters: {
    search?:   string;
    docente?:  string | number;
    tipo?:     string;
    semestre?: string | number;  
    materia?:  string | number;
    page?:     number;
    limit?:    number;
  } = {}): Observable<MaterialesResponse> {
    let params = new HttpParams()
      .set('search',   filters.search   ?? '')
      .set('docente',  String(filters.docente  ?? ''))
      .set('tipo',     filters.tipo     ?? '')
      .set('semestre', String(filters.semestre ?? ''))
      .set('materia',  String(filters.materia  ?? ''))
      .set('page',     String(filters.page     ?? 1))
      .set('limit',    String(filters.limit    ?? 9));

    return this.http.get<MaterialesResponse>(`${this.api}/materiales/todos`, { params });
  }

  getDocentes() {
    return this.http.get(`${this.api}/docentes`);
  }

  getDocenteInfo(id: number) {
    return this.http.get(`${this.api}/docente/${id}`);
  }

  getByDocente(id: number, filters: any = {}) {
    const params = this.buildParams(filters);
    return this.http.get(`${this.api}/docente/${id}/materiales`, { params });
  }

  // ── DOCENTE ──────────────────────────────────────────────────

  getMine(filters: any = {}) {
    const params = this.buildParams(filters);
    return this.http.get(`${this.api}/docente/mis-materiales`, { params });
  }

  create(data: FormData) {
    return this.http.post(`${this.api}/docente`, data);
  }

  update(id: number, data: FormData) {
    return this.http.put(`${this.api}/docente/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete(`${this.api}/docente/${id}`);
  }

  getById(id: number) {
    return this.http.get(`${this.api}/docente/${id}`);
  }

  getMaterias() {
    return this.http.get(`${this.api}/materias`);
  }

  getSemestres() {
    return this.http.get(`${this.api}/semestres`);
  }

  changeStatus(id: number, estado: number) {
    return this.http.patch(`${this.api}/docente/${id}/estado`, { activo: estado });
  }

  // ── ADMINISTRADOR ──────────────────────────────────────────────────
  getAllAdmin(filters: any = {}) {
    const params = this.buildParams(filters);
    return this.http.get(`${this.api}/admin/todos`, { params });
  }

  private buildParams(filters: any): Record<string, string> {
    const params: Record<string, string> = {};
    Object.keys(filters).forEach(key => {
      const val = filters[key];
      if (val !== undefined && val !== null && val !== '') {
        params[key] = String(val);
      }
    });
    return params;
  }

  updateAdmin(id: number, data: FormData) {
    return this.http.put(`${this.api}/admin/${id}`, data);
  }

  deleteAdmin(id: number) {
    return this.http.delete(`${this.api}/admin/${id}`);
  }

  getByIdAdmin(id: number) {
    return this.http.get(`${this.api}/admin/${id}`);
  }

  changeStatusAdmin(id: number, estado: number) {
    return this.http.patch(`${this.api}/admin/${id}/estado`, { activo: estado });
  }
}
