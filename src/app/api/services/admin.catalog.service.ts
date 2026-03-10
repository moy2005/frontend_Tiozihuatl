import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../environments/environment.prod';
import { API_URL } from '../api.config';

export interface LibroFormato {
  tipo: 'FISICO' | 'DIGITAL';
  total?: number;
  disponibles?: number;
  pdf_url?: string | null;
}

export interface LibroAdmin {
  id?: number;
  titulo: string;
  autores: string;
  editorial?: string;
  categoria_id: number; 
  materias?: string;   
  materia_id?: number;
  tiene_fisico?: number;
  total?: number;
  disponibles?: number;
  tiene_digital?: number;
  pdf_url?: string | null;
  activo?: number;
  formatos?: LibroFormato[];
}

@Injectable({
  providedIn: 'root'
})
export class CatalogAdminService {
  private readonly baseUrl = `${API_URL}/catalog/admin`;

  constructor(private http: HttpClient) {}

  crearLibro(data: any) {
    return this.http.post(`${this.baseUrl}/libros`, data);
  }

  obtenerLibros(filtros?: any) {

  let params: any = {};

  if (filtros) {

    if (filtros.search) params.search = filtros.search;

    if (filtros.materia) params.materia = filtros.materia;

    if (filtros.formato) params.formato = filtros.formato;

    if (filtros.ordenAutor) params.ordenAutor = filtros.ordenAutor;

    // SOLO enviar si tiene valor
    if (filtros.activo !== '' && filtros.activo !== null && filtros.activo !== undefined) {
      params.activo = filtros.activo;
    }

  }

  return this.http.get<any>(`${this.baseUrl}/libros`, { params }).pipe(
    map(response => {

      if (response && response.data && Array.isArray(response.data)) {
        return response.data;
      }

      if (Array.isArray(response)) {
        return response;
      }

        return [];
      })
    );
  }

  actualizarLibro(id: number, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/libros/${id}`, data);
  }

  cambiarEstado(id: number, activo: number): Observable<any> {
    return this.http.patch(`${this.baseUrl}/libros/${id}/estado`, { activo });
  }

  obtenerMaterias() {
    return this.http.get<any[]>(`${environment.apiUrl}/catalog/materias`);
  }
  obtenerAutores(): Observable<any[]> {
  return this.http.get<any[]>(`${this.baseUrl}/autores`);
}
}
