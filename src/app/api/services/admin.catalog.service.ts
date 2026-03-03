import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment.prod';

export interface LibroFormato {
  tipo: 'FISICO' | 'DIGITAL';

  // físico
  total?: number;
  disponibles?: number;

  // digital
  pdf_url?: string | null;
}

export interface LibroAdmin {
  id?: number;

  titulo: string;
  autor: string;
  editorial?: string;

  materias: number[];
  materia?: string;   // ← para mostrar en el HTML

  // 📦 FORMATO FÍSICO
  tiene_fisico?: number;     // 1 | 0 (viene del backend)
  total?: number;
  disponibles?: number;

  // 📄 FORMATO DIGITAL
  tiene_digital?: number;    // 1 | 0
  pdf_url?: string | null;

  // 🔄 ESTADO
  activo?: number;

  formatos?: LibroFormato[];
}

@Injectable({
  providedIn: 'root'
})
export class CatalogAdminService {


  constructor(private http: HttpClient) {}

  //private readonly API_URL = 'http://localhost:4000/api/catalog/admin';
  private readonly API_URL = `${environment.apiUrl}/catalog/admin`;

  /** ➕ Crear libro */
  crearLibro(data: LibroAdmin) {
    return this.http.post(`${this.API_URL}/libros`, data);
  }

obtenerLibros() {
  return this.http.get<LibroAdmin[]>(`${this.API_URL}/libros`);
}

  /** 🔹 Editar libro */
  actualizarLibro(id: number, data: LibroAdmin): Observable<any> {
    return this.http.put(`${this.API_URL}/libros/${id}`, data);
  }

  /** 🔹 Activar / Desactivar libro */
  cambiarEstado(id: number, activo: number): Observable<any> {
    return this.http.patch(`${this.API_URL}/libros/${id}/estado`, { activo });
  }
}
