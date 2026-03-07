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
  autor: string;
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

  obtenerLibros() {
    return this.http.get<any>(`${this.baseUrl}/libros`).pipe(
      map(response => {
        // Si response.data existe y es array, usa eso
        if (response && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        // Si response ya es array, úsalo
        if (Array.isArray(response)) {
          return response;
        }
        // Si no, devuelve array vacío
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
}