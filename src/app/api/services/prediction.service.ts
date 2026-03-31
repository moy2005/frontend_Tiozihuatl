import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class PredictionService {
  private api = `${API_URL}/prediction`;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /** FIG 2 — Lista completa de préstamos */
  getPrestamos(): Observable<any> {
    return this.http.get<any>(`${this.api}/prestamos`, { headers: this.headers() });
  }

  /** FIG 3 — Préstamos agrupados por periodo y materia */
  getAgrupados(): Observable<any> {
    return this.http.get<any>(`${this.api}/agrupados`, { headers: this.headers() });
  }

  /** FIG 4 — Modelo exponencial + datos para gráfica */
  getModelo(): Observable<any> {
    return this.http.get<any>(`${this.api}/modelo`, { headers: this.headers() });
  }

  /** FIG 5 — Histórico: periodos + cruce materia×periodo */
  getHistorico(): Observable<any> {
    return this.http.get<any>(`${this.api}/historico`, { headers: this.headers() });
  }

  /** FIG 6 — Predicción total (3 periodos futuros) */
  getPrediccionTotal(): Observable<any> {
    return this.http.get<any>(`${this.api}/total`, { headers: this.headers() });
  }

  /** FIG 7 — Listado de materias disponibles */
  getMaterias(): Observable<any> {
    return this.http.get<any>(`${this.api}/materia`, { headers: this.headers() });
  }

  /** FIG 7 — Préstamos + predicción de una materia específica */
  getPorMateria(nombre: string): Observable<any> {
    return this.http.get<any>(`${this.api}/materia`, {
      headers: this.headers(),
      params: { nombre },
    });
  }

  /** Carga unificada del dashboard principal (FIG 4 + FIG 6 + materias) */
  getDashboard(): Observable<any> {
    return forkJoin({
      modelo:  this.getModelo(),
      total:   this.getPrediccionTotal(),
      materias: this.getMaterias(),
    });
  }
}