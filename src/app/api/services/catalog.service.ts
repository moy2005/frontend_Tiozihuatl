import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment.prod';
import { API_URL } from '../api.config';

export interface Libro {
  id: number;
  titulo: string;
  autores: string;
  editorial: string | null;
  materias: string | null;
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
  editorial: string | null;
  autores: string;
  materias: string;
  semestres: string | null;
  disponibles: number | null;
  tiene_digital: boolean;
  tiene_fisico: boolean;
  previewUrl: string | null;
  similitud_coseno: number;
  angulo_grados: number;
  caracteristicas_compartidas: string[];
  cantidad_caracteristicas_compartidas: number;
  motivo: string;
}

export interface BookRecommendationsResponse {
  libro_origen: { id: number; titulo: string };
  modelo: {
    tipo: 'recomendacion_basada_en_contenido';
    medida: 'similitud_coseno';
    version_artefacto: number;
    generado_en: string;
  };
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
  model: { type: string; k: number; random_state: number; metrics: Record<string, number> };
  period: { start: string; end: string; month3: string; month2: string; month1: string };
  shelves: ReadingProfileShelf[];
}

export interface MonthlyClusterMetrics {
  sesiones_mes_3: number;
  sesiones_mes_2: number;
  sesiones_mes_1: number;
  usuarios_unicos_3m: number;
  promedio_tiempo_segundos_3m: number;
  porcentaje_promedio_avance_3m: number;
  prestamos_mes_3: number;
  prestamos_mes_2: number;
  prestamos_mes_1: number;
  tendencia_sesiones: number;
  tendencia_prestamos: number;
}

export interface ClusterProfileSummary {
  cluster: number;
  profileName: string;
  totalBooks: number;
  studentLabel: string;
  description: string;
  icon: string;
  action: string;
  averages: MonthlyClusterMetrics;
}

export interface AdminClusterBook {
  id: number;
  titulo: string;
  cluster: number;
  profileName: string;
  action: string;
  metrics: MonthlyClusterMetrics;
}

export interface AdminClustersResponse {
  model: { type: string; k: number; random_state: number; metrics: Record<string, number> };
  period: { start: string; end: string; month3: string; month2: string; month1: string };
  totalBooks: number;
  profiles: ClusterProfileSummary[];
  books: AdminClusterBook[];
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

  obtenerRecomendaciones(id: number, limit = 5) {
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

  obtenerAnalisisClusters() {
    return this.http.get<AdminClustersResponse>(
      `${API_URL}/recommendations/clusters/admin`
    );
  }

}
