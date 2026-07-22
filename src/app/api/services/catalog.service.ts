import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment.prod';
import { API_URL } from '../api.config';

export interface Libro {
  id: number;
  titulo: string;
  autores: string;
  editorial: string;
  materia: string;
  semestres?: string;
  semestres_ids?: string;
  total: number | null;
  disponibles: number | null;
  pdf_url: string | null;
  tiene_fisico: number;
  tiene_digital: number;
  previewUrl?: string;
}

export interface BookRecommendation {
  id: number;
  titulo: string;
  autores: string;
  materias: string;
  semestres: string | null;
  disponibles: number | null;
  tiene_digital: boolean;
  tiene_fisico: boolean;
  previewUrl: string | null;
  score: number;
  reglas_coincidentes: number;
  nivel_evidencia: 'CONSOLIDADA' | 'EXPLORATORIA';
  confianza: number;
  lift: number;
  motivo: string;
}

export interface BookRecommendationsResponse {
  libro_origen: { id: number; titulo: string };
  modelo: { tipo: string; reglas_evaluadas: number };
  recomendaciones: BookRecommendation[];
}

export interface ClusterBook {
  id: number; titulo: string; autores: string; editorial: string; materias: string | null;
  disponibles: number | null; tiene_digital: boolean; tiene_fisico: boolean; previewUrl: string | null;
}

export interface ReadingProfileShelf {
  cluster: number; label: string; profileName: string; description: string; icon: string;
  totalBooks: number; books: ClusterBook[];
}

export interface ReadingProfilesResponse {
  model: { type: string; k: number; generatedAt: string };
  shelves: ReadingProfileShelf[];
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
    ordenAutor?: string,
    semestre?: string 
  ) {
    return this.http.get<any[]>(`${this.baseUrl}`, {
      params: {
        search: search || '',
        materia: materia || '',
        formato: formato || '',
        ordenAutor: ordenAutor || '',
        semestre: semestre || ''
      }
    });
  }

  obtenerMaterias() {
    return this.http.get<{ nombre: string }[]>(`${this.baseUrl}/materias`);
  }

  obtenerPdfSeguro(id: number) {
  return this.http.get<{ url: string, titulo: string }>(
    `${this.baseUrl}/libros/${id}/pdf-url` 
  );
}

  obtenerPreview(id: number) {
    return this.http.get<{ previewUrl: string }>(
      `${this.baseUrl}/libros/${id}/preview`
    );
  }

  obtenerSemestres() {
  return this.http.get<any[]>(`${this.baseUrl}/semestres`);
}

  obtenerRecomendaciones(id: number, limit = 1) {
    return this.http.get<BookRecommendationsResponse>(
      `${API_URL}/recommendations/books/${id}`,
      { params: { limit } }
    );
  }

  obtenerPerfilesLectura(limit = 12) {
    return this.http.get<ReadingProfilesResponse>(
      `${API_URL}/recommendations/clusters/student`, { params: { limit } }
    );
  }

}
