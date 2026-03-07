import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment.prod';
import { API_URL } from '../api.config';

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

  private baseUrl = `${API_URL}/catalog`;
  

  constructor(private http: HttpClient) {}

  obtenerCatalogo(
    search?: string,
    materia?: string,
    formato?: string,
    ordenAutor?: string
  ) {
    return this.http.get<any[]>(`${this.baseUrl}`, {
      params: {
        search: search || '',
        materia: materia || '',
        formato: formato || '',
        ordenAutor: ordenAutor || ''
      }
    });
  }

  obtenerMaterias() {
    return this.http.get<{ nombre: string }[]>(`${this.baseUrl}/materias`);
  }
/*
  obtenerPdfSeguro(id: number) {
    return this.http.get<{ url: string }>(
      `${this.baseUrl}/libros/${id}/pdf`
    );
  }*/
  obtenerPdfSeguro(id: number) {
  return this.http.get<{ url: string, titulo: string }>(
    `${this.baseUrl}/libros/${id}/pdf-url`  // ← ruta correcta
  );
}

  obtenerPreview(id: number) {
    return this.http.get<{ previewUrl: string }>(
      `${this.baseUrl}/libros/${id}/preview`
    );
  }

}
