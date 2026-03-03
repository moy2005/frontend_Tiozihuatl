import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment.prod';

export interface Libro {
   id: number;
  titulo: string;
  autor: string;
  editorial: string;
  materia: string;

  total: number | null;
  disponibles: number | null;

  pdf_url: string | null;

  tiene_fisico: number;
  tiene_digital: number;
  previewUrl?: string;
}


@Injectable({
  providedIn: 'root'
})
export class CatalogService {

  //private readonly API_URL = 'http://localhost:4000/api/catalog';
  private API_URL = `${environment.apiUrl}/catalog`;
  

  constructor(private http: HttpClient) {}

  obtenerCatalogo(
    search?: string,
    materia?: string,
    formato?: string,
    ordenAutor?: string
  ) {
    return this.http.get<any[]>(`${this.API_URL}`, {
      params: {
        search: search || '',
        materia: materia || '',
        formato: formato || '',
        ordenAutor: ordenAutor || ''
      }
    });
  }

  obtenerMaterias() {
    return this.http.get<{ nombre: string }[]>(`${this.API_URL}/materias`);
  }

  obtenerPdfSeguro(id: number) {
    return this.http.get<{ url: string }>(
      `${this.API_URL}/libros/${id}/pdf`
    );
  }

  obtenerPreview(id: number) {
    return this.http.get<{ previewUrl: string }>(
      `${this.API_URL}/libros/${id}/preview`
    );
  }

}
